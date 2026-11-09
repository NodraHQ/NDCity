"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildingLabel } from "@/lib/buildings";
import type { HouseRow, LogEntry, OfficeHolder } from "@/lib/db/types";
import { STATE_FLAG_UFS } from "@/lib/flags";
import { type ProductId, PRODUCTS, formatPrice } from "@/lib/payments/products";

type Tab = "acessos" | "historico" | "codigos" | "casas" | "ocupacao" | "eleicoes" | "recursos" | "chat";
type CityStat = { slug: string; name: string; uf: string | null; houses: number; lots: number; pct: number; mayor: string | null };
type StateStat = { uf: string; municipios: number; occupied: number; houses: number; pct: number; governor: string | null };
type Overview = { houses: HouseRow[]; cities: CityStat[]; states: StateStat[]; president: string | null };
type ElectionV = {
  id: string;
  office: "governor" | "president";
  uf: string | null;
  status: "open" | "closed" | "canceled";
  endsAt: string;
  winner: string | null;
  candidates: { handle: string; votes: number }[];
};

const fmtDate = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const officeName = (o: string, uf?: string | null) => (o === "president" ? "Presidente" : `Governador(a) de ${uf}`);

async function api(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  return res.json().catch(() => ({ ok: false, message: "Erro de conexão." }));
}

export default function AdminPanel({ storeKind }: { storeKind: "supabase" | "memory" }) {
  const [tab, setTab] = useState<Tab>("acessos");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadOverview = useCallback(async () => {
    const j = await api("/api/admin/overview");
    if (j.ok) setOverview(j);
  }, []);
  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  /** Recarrega tudo: os números do topo e a aba aberta. */
  async function refresh() {
    setRefreshing(true);
    await loadOverview();
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 400);
  }

  async function logout() {
    await api("/api/admin/logout", "POST");
    window.location.reload();
  }

  const TABS: [Tab, string][] = [
    ["acessos", "📈 Acessos"],
    ["historico", "📜 Histórico"],
    ["casas", "🏠 Casas"],
    ["ocupacao", "📊 Ocupação"],
    ["codigos", "🔑 Acesso"],
    ["chat", "💬 Chat"],
    ["eleicoes", "🗳 Eleições"],
    ["recursos", "✨ Recursos pagos"],
  ];

  return (
    <main className="admin wide">
      <div className="admin-head">
        <h1>🏗 NDCity · Admin</h1>
        <div className="row">
          <button className="btn" onClick={refresh} disabled={refreshing}>{refreshing ? "Atualizando…" : "🔄 Atualizar"}</button>
          <a className="btn" href="/">Ver mapa</a>
          <button className="btn" onClick={logout}>Sair</button>
        </div>
      </div>
      {storeKind === "memory" && (
        <p className="banner-inline warn">Modo teste: o Supabase não está configurado, os dados somem quando o servidor reinicia.</p>
      )}
      {overview && (
        <div className="stats">
          <div className="stat"><b>{overview.houses.length}</b><span>casas</span></div>
          <div className="stat"><b>{overview.cities.length}</b><span>cidades ocupadas</span></div>
          <div className="stat"><b>{overview.states.filter((s) => s.occupied).length}</b><span>estados</span></div>
          <div className="stat"><b>{overview.president ? `@${overview.president}` : "—"}</b><span>presidente</span></div>
        </div>
      )}
      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={`btn ${tab === id ? "primary" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      <div key={refreshKey} className="tab-body">
        {tab === "acessos" && <StatsTab />}
        {tab === "historico" && <LogsTab />}
        {tab === "casas" && <HousesTab overview={overview} reload={loadOverview} />}
        {tab === "ocupacao" && <OccupancyTab overview={overview} />}
        {tab === "codigos" && <CodesTab />}
        {tab === "eleicoes" && <ElectionsTab />}
        {tab === "recursos" && <PerksTab />}
        {tab === "chat" && <ChatTab />}
      </div>
    </main>
  );
}

// ------------------------------------------------------------------ casas

function HousesTab({ overview, reload }: { overview: Overview | null; reload: () => void }) {
  const [uf, setUf] = useState("");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  const houses = overview?.houses ?? [];
  const ufs = useMemo(() => [...new Set(houses.map((h) => h.uf ?? "—"))].sort(), [houses]);
  const citiesInUf = useMemo(
    () => [...new Map(houses.filter((h) => !uf || (h.uf ?? "—") === uf).map((h) => [h.citySlug, h.cityName])).entries()].sort((a, b) => a[1].localeCompare(b[1])),
    [houses, uf],
  );
  const shown = houses.filter(
    (h) => (!uf || (h.uf ?? "—") === uf) && (!city || h.citySlug === city) && (!q || h.handle.includes(q.toLowerCase().replace(/^@/, ""))),
  );

  const [issued, setIssued] = useState<Issued | null>(null);
  async function accessCode(h: HouseRow) {
    const j = await api("/api/admin/access-code", "POST", { handle: h.handle });
    if (j.ok) setIssued(j);
    else setMsg(j.message);
  }

  async function remove(h: HouseRow) {
    const extra = h.isMayor ? "\nEssa pessoa é PREFEITA: a prefeitura passa para o morador mais antigo." : "";
    if (!confirm(`Remover a casa de @${h.handle} em ${h.cityName}?\nA pessoa perde a casa, os códigos e o login.${extra}`)) return;
    const j = await api(`/api/admin/claims?handle=${encodeURIComponent(h.handle)}`, "DELETE");
    setMsg(j.message ?? "");
    reload();
  }

  return (
    <div className="card">
      <h2>Casas ativas ({shown.length})</h2>
      <div className="filters">
        <select value={uf} onChange={(e) => { setUf(e.target.value); setCity(""); }}>
          <option value="">Todos os estados</option>
          {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Todas as cidades</option>
          {citiesInUf.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar @" autoCapitalize="none" />
      </div>
      {msg && <p className="ok">{msg}</p>}
      {issued && <IssuedCode issued={issued} onClose={() => setIssued(null)} />}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>@</th><th>Cidade</th><th>UF</th><th>Tipo</th><th>Desde</th><th></th></tr>
          </thead>
          <tbody>
            {shown.map((h) => (
              <tr key={h.handle}>
                <td>
                  @{h.handle}
                  {h.isMayor && " 🏛"}
                </td>
                <td><a href={`/c/${h.citySlug}`}>{h.cityName}</a></td>
                <td>{h.uf ?? "—"}</td>
                <td>{buildingLabel(h.type)}</td>
                <td>{new Date(h.createdAt).toLocaleDateString("pt-BR")}</td>
                <td className="actions-cell">
                  <button className="btn tiny" title="Gerar código de acesso" aria-label={`Código de acesso para @${h.handle}`} onClick={() => accessCode(h)}>🔑</button>
                  <button className="btn tiny danger" aria-label={`Remover @${h.handle}`} onClick={() => remove(h)}>✕</button>
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={6}>{overview ? "Nenhuma casa com esses filtros." : "Carregando…"}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- ocupação

function OccupancyTab({ overview }: { overview: Overview | null }) {
  const [uf, setUf] = useState("");
  if (!overview) return <div className="card">Carregando…</div>;
  const cities = overview.cities.filter((c) => !uf || c.uf === uf);
  return (
    <>
      <div className="card">
        <h2>Estados</h2>
        <p>Ocupação = municípios com pelo menos uma casa ÷ total de municípios do estado.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>UF</th><th>Cidades ocupadas</th><th>Casas</th><th>Ocupação</th><th>Governador(a)</th></tr>
            </thead>
            <tbody>
              {overview.states.map((s) => (
                <tr key={s.uf} className={uf === s.uf ? "sel" : ""} onClick={() => setUf(uf === s.uf ? "" : s.uf)}>
                  <td><b>{s.uf}</b></td>
                  <td>{s.occupied} / {s.municipios}</td>
                  <td>{s.houses}</td>
                  <td><Bar pct={s.pct} /></td>
                  <td>{s.governor ? `@${s.governor}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2>Cidades {uf && `de ${uf}`} ({cities.length})</h2>
        <p>Ocupação = casas ÷ lotes da cidade. Toque num estado acima para filtrar.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Cidade</th><th>UF</th><th>Casas</th><th>Ocupação</th><th>Prefeito(a)</th></tr>
            </thead>
            <tbody>
              {cities.map((c) => (
                <tr key={c.slug}>
                  <td><a href={`/c/${c.slug}`}>{c.name}</a></td>
                  <td>{c.uf ?? "—"}</td>
                  <td>{c.houses} / {c.lots}</td>
                  <td><Bar pct={c.pct} /></td>
                  <td>{c.mayor ? `@${c.mayor}` : "vaga"}</td>
                </tr>
              ))}
              {!cities.length && <tr><td colSpan={5}>Nenhuma cidade ocupada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <span className="bar">
      <span style={{ width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%` }} />
      <em>{pct.toLocaleString("pt-BR")}%</em>
    </span>
  );
}

// ---------------------------------------------------------------- códigos

function CodesTab() {
  const [handle, setHandle] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [last, setLast] = useState<Issued | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const j = await api("/api/admin/access-code", "POST", { handle });
    setBusy(false);
    if (!j.ok) return setMsg({ text: j.message, error: true });
    setLast(j);
    setHandle("");
  }

  return (
    <form className="card" onSubmit={generate}>
      <h2>🔑 Código de acesso</h2>
      <p>
        Para quem esqueceu a senha: digite o nome de usuário e mande o <b>código de acesso</b> (ENT-…) para a pessoa. Ela entra com
        usuário + código no lugar da senha e depois cria uma senha nova. Vale uma vez só, por 24h.
      </p>
      <div className="row">
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="nome de usuário" autoCapitalize="none" autoComplete="off" />
        <button className="btn primary" disabled={busy || !handle.trim()}>Gerar</button>
      </div>
      {msg && <p className={msg.error ? "error" : "ok"}>{msg.text}</p>}
      {last && <IssuedCode issued={last} />}
    </form>
  );
}

// ------------------------------------------------------------------ chat

type ChatMsg = { id: number; handle: string; body: string; createdAt: string; citySlug: string; cityName: string };

function ChatTab() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const load = useCallback(async () => {
    const j = await api(`/api/admin/chat${city ? `?city=${encodeURIComponent(city)}` : ""}`);
    if (j.ok) setMsgs(j.messages);
  }, [city]);
  useEffect(() => {
    load();
  }, [load]);
  const cities = useMemo(() => [...new Map(msgs.map((m) => [m.citySlug, m.cityName])).entries()], [msgs]);
  const shown = msgs.filter((m) => !q || m.body.toLowerCase().includes(q.toLowerCase()) || m.handle.includes(q.toLowerCase()));

  async function remove(m: ChatMsg) {
    if (!confirm(`Apagar a mensagem de @${m.handle}?\n\n“${m.body}”`)) return;
    await api(`/api/admin/chat?id=${m.id}&handle=${encodeURIComponent(m.handle)}`, "DELETE");
    setMsgs((l) => l.filter((x) => x.id !== m.id));
  }

  return (
    <div className="card">
      <h2>💬 Chats das cidades</h2>
      <p>Últimas 200 mensagens. O ✕ apaga a mensagem na hora para todo mundo. Para casos graves, remova a casa da pessoa na aba Casas.</p>
      <div className="filters">
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Todas as cidades</option>
          {cities.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar palavra ou usuário" autoCapitalize="none" />
      </div>
      <div className="table-wrap">
        <table className="logs">
          <tbody>
            {shown.map((m) => (
              <tr key={m.id}>
                <td>{fmtDate(m.createdAt)}</td>
                <td>{m.cityName}</td>
                <td>@{m.handle}</td>
                <td>{m.body}</td>
                <td><button className="btn tiny danger" aria-label={`Apagar mensagem de @${m.handle}`} onClick={() => remove(m)}>✕</button></td>
              </tr>
            ))}
            {!shown.length && <tr><td>Nenhuma mensagem.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- eleições

function ElectionsTab() {
  const [elections, setElections] = useState<ElectionV[]>([]);
  const [offices, setOffices] = useState<OfficeHolder[]>([]);
  const [office, setOffice] = useState<"governor" | "president">("governor");
  const [uf, setUf] = useState("GO");
  const [days, setDays] = useState(7);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    const j = await api("/api/admin/elections");
    if (j.ok) {
      setElections(j.elections);
      setOffices(j.offices);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const j = await api("/api/admin/elections", "POST", { office, uf, days });
    setMsg(j.ok ? { text: "Eleição criada! Os moradores já podem se candidatar e votar." } : { text: j.message, error: true });
    load();
  }
  async function act(id: string, action: "close" | "cancel") {
    const label = action === "close" ? "Encerrar agora e empossar quem tiver mais votos?" : "Cancelar essa eleição? Ninguém assume.";
    if (!confirm(label)) return;
    const j = await api("/api/admin/elections", "PATCH", { id, action });
    setMsg(j.ok ? { text: action === "close" ? (j.winner ? `Eleito(a): @${j.winner}` : "Encerrada sem votos: ninguém assume.") : "Cancelada." } : { text: j.message, error: true });
    load();
  }
  async function clearOffice(o: OfficeHolder) {
    if (!confirm(`Tirar @${o.handle} do cargo de ${officeName(o.office, o.uf)}?`)) return;
    await api("/api/admin/elections", "PATCH", { action: "clear_office", office: o.office, uf: o.uf });
    load();
  }

  return (
    <>
      <form className="card" onSubmit={create}>
        <h2>Criar eleição</h2>
        <p>
          Moradores do estado (governador) ou do Brasil todo (presidente) se candidatam e votam. Ao fim, quem tiver mais votos assume.
          O cargo só aparece no mapa enquanto a pessoa tiver casa (governador: casa no estado).
        </p>
        <div className="filters">
          <select value={office} onChange={(e) => setOffice(e.target.value as "governor" | "president")}>
            <option value="governor">Governador(a)</option>
            <option value="president">Presidente</option>
          </select>
          {office === "governor" && (
            <select value={uf} onChange={(e) => setUf(e.target.value)}>
              {STATE_FLAG_UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} dia{d > 1 ? "s" : ""}</option>)}
          </select>
          <button className="btn primary">Criar</button>
        </div>
        {msg && <p className={msg.error ? "error" : "ok"}>{msg.text}</p>}
      </form>

      <div className="card">
        <h2>Cargos</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              {offices.map((o) => (
                <tr key={o.office + o.uf}>
                  <td>{officeName(o.office, o.uf)}</td>
                  <td>@{o.handle}</td>
                  <td>desde {new Date(o.since).toLocaleDateString("pt-BR")}</td>
                  <td><button className="btn tiny danger" onClick={() => clearOffice(o)}>✕</button></td>
                </tr>
              ))}
              {!offices.length && <tr><td>Ninguém eleito ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Eleições</h2>
        {!elections.length && <p>Nenhuma eleição criada.</p>}
        {elections.map((e) => (
          <div key={e.id} className="election">
            <div className="row between">
              <b>{officeName(e.office, e.uf)}</b>
              <span>
                {e.status === "open" ? `🟢 aberta até ${fmtDate(e.endsAt)}` : e.status === "closed" ? `🏁 encerrada${e.winner ? ` · eleito(a) @${e.winner}` : " · sem vencedor"}` : "❌ cancelada"}
              </span>
            </div>
            <ul>
              {e.candidates.map((c) => <li key={c.handle}>@{c.handle}: {c.votes} voto{c.votes === 1 ? "" : "s"}</li>)}
              {!e.candidates.length && <li>Nenhum candidato ainda.</li>}
            </ul>
            {e.status === "open" && (
              <div className="row">
                <button className="btn tiny" onClick={() => act(e.id, "close")}>Encerrar agora</button>
                <button className="btn tiny danger" onClick={() => act(e.id, "cancel")}>Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// --------------------------------------------------------- recursos pagos

function CapCard() {
  const [info, setInfo] = useState<{
    paidCents: number;
    reservedCents: number;
    capCents: number;
    mercadoPago: boolean;
    testMode: boolean;
    webhookSecret: boolean;
  } | null>(null);
  const [cap, setCap] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const load = useCallback(async () => {
    const j = await api("/api/admin/settings");
    if (j.ok) {
      setInfo(j);
      setCap(String(j.capCents / 100));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  if (!info) return <div className="card">Carregando…</div>;
  const pct = info.capCents ? Math.round((info.paidCents / info.capCents) * 1000) / 10 : 100;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const j = await api("/api/admin/settings", "POST", { capReais: Number(cap.replace(",", ".")) });
    setMsg(j.ok ? { text: "Limite salvo." } : { text: j.message, error: true });
    load();
  }

  return (
    <form className="card" onSubmit={save}>
      <h2>🛑 Limite mensal de vendas</h2>
      <p>
        Quando o total vendido no mês chegar no limite, o botão de comprar para sozinho e volta no dia 1º. Conta tudo que entrou como
        pagamento (Mercado Pago e Pix manual); cortesias não contam.
      </p>
      <p>
        Pagamento online:{" "}
        {info.mercadoPago ? (info.testMode ? "🧪 Mercado Pago em modo TESTE (dinheiro de mentira)" : "✅ Mercado Pago ligado") : "⏸ desligado (só liberação manual)"}
        {info.mercadoPago && !info.webhookSecret && " · ⚠️ falta a chave secreta do aviso (MP_WEBHOOK_SECRET)"}
      </p>
      <div className="stats">
        <div className="stat"><b>{formatPrice(info.paidCents)}</b><span>vendido este mês</span></div>
        <div className="stat"><b>{formatPrice(info.capCents)}</b><span>limite</span></div>
        <div className="stat"><b>{formatPrice(Math.max(0, info.capCents - info.paidCents))}</b><span>falta</span></div>
      </div>
      <span className="bar big"><span style={{ width: `${Math.min(100, pct)}%` }} /><em>{pct.toLocaleString("pt-BR")}%</em></span>
      {pct >= 100 ? (
        <p className="error">🛑 Limite atingido: as vendas estão pausadas até o mês que vem.</p>
      ) : pct >= 80 ? (
        <p className="error">⚠️ Já passou de 80% do limite deste mês.</p>
      ) : null}
      <div className="row left">
        <span>R$</span>
        <input value={cap} onChange={(e) => setCap(e.target.value)} inputMode="decimal" style={{ maxWidth: 160 }} />
        <button className="btn primary">Salvar limite</button>
      </div>
      {msg && <p className={msg.error ? "error" : "ok"}>{msg.text}</p>}
    </form>
  );
}

type SubRow = { id: string; handle: string; status: string; payerEmail: string | null; createdAt: string; updatedAt: string };

function SubscriptionsCard() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const load = useCallback(async () => {
    const j = await api("/api/admin/subscriptions");
    if (j.ok) setSubs(j.subscriptions);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const label: Record<string, string> = { authorized: "✅ ativa", paused: "⏸ pausada", pending: "⏳ não concluída", cancelled: "❌ cancelada" };
  const active = subs.filter((s) => s.status === "authorized").length;

  async function cancel(s: SubRow) {
    if (!confirm(`Cancelar a assinatura de @${s.handle}? Para de cobrar; o chat continua até o fim do mês pago.`)) return;
    const j = await api(`/api/admin/subscriptions?id=${s.id}`, "DELETE");
    if (!j.ok) alert(j.message);
    load();
  }

  return (
    <div className="card">
      <h2>💳 Assinaturas do chat ({active} ativa{active === 1 ? "" : "s"})</h2>
      <p>
        R$ 5/mês no cartão, renovando sozinha. Cada mensalidade paga entra no dinheiro movimentado e no limite do mês. O limite só barra
        assinaturas novas: as renovações continuam (se precisar, cancele aqui).
      </p>
      <div className="table-wrap">
        <table>
          <tbody>
            {subs.filter((s) => s.status !== "pending" || Date.now() - Date.parse(s.createdAt) < 86400_000).map((s) => (
              <tr key={s.id}>
                <td>@{s.handle}</td>
                <td>{label[s.status] ?? s.status}</td>
                <td>desde {new Date(s.createdAt).toLocaleDateString("pt-BR")}</td>
                <td className="muted">{s.payerEmail}</td>
                <td>{s.status !== "cancelled" && <button className="btn tiny danger" onClick={() => cancel(s)}>Cancelar</button>}</td>
              </tr>
            ))}
            {!subs.length && <tr><td>Nenhuma assinatura ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PerksTab() {
  const [handle, setHandle] = useState("");
  const [product, setProduct] = useState<ProductId>("chat_mensal");
  const [courtesy, setCourtesy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    const j = await api("/api/admin/entitlements", "POST", { handle, product, courtesy });
    if (!j.ok) return setMsg({ text: j.message, error: true });
    const p = j.perks;
    const parts = [
      p.chatUntil ? `chat até ${new Date(p.chatUntil).toLocaleDateString("pt-BR")}` : "sem chat",
      `${p.customizeCredits} pintura(s)`,
      `${p.moveCredits} mudança(s)`,
    ];
    setMsg({ text: `${j.message} Agora tem: ${parts.join(", ")}.` });
  }

  return (
    <>
    <CapCard />
    <SubscriptionsCard />
    <form className="card" onSubmit={grant}>
      <h2>Liberar recurso pago</h2>
      <p>Para Pix que chegou direto pra você (fora do Mercado Pago) ou para dar de presente (cortesia). Pagamentos pelo site são liberados sozinhos.</p>
      <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@fulano" autoCapitalize="none" autoComplete="off" />
      <select value={product} onChange={(e) => setProduct(e.target.value as ProductId)}>
        {(Object.keys(PRODUCTS) as ProductId[]).map((id) => (
          <option key={id} value={id}>{PRODUCTS[id].label} — {formatPrice(PRODUCTS[id].priceCents)}</option>
        ))}
      </select>
      <label className="check">
        <input type="checkbox" checked={courtesy} onChange={(e) => setCourtesy(e.target.checked)} /> Cortesia (de graça, não conta como pagamento)
      </label>
      <button className="btn primary" disabled={!handle.trim()}>Liberar</button>
      {msg && <p className={msg.error ? "error" : "ok"}>{msg.text}</p>}
    </form>
    </>
  );
}

// ---------------------------------------------------------------- acessos

type Stats = {
  online: { visitors: number; residents: string[] };
  today: { visitors: number; views: number; houses: number };
  last30: { visitors: number; views: number };
  days: { day: string; visitors: number; views: number; houses: number }[];
  topPages: { path: string; label: string; count: number }[];
  revenue: {
    totalCents: number;
    monthCents: number;
    last30Cents: number;
    count: number;
    byProduct: { label: string; count: number; cents: number }[];
    recent: { handle: string; label: string; cents: number; at: string; provider: string | null }[];
  };
};

const money = (c: number) => formatPrice(c);

function StatsTab() {
  const [st, setSt] = useState<Stats | null>(null);
  const load = useCallback(async () => {
    const j = await api("/api/admin/stats");
    if (j.ok) setSt(j);
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);
  if (!st) return <div className="card">Carregando…</div>;
  const maxV = Math.max(1, ...st.days.map((d) => d.visitors));
  const maxH = Math.max(1, ...st.days.map((d) => d.houses));
  return (
    <>
      <div className="stats">
        <div className="stat"><b>🟢 {st.online.visitors}</b><span>online agora</span></div>
        <div className="stat"><b>{st.online.residents.length}</b><span>moradores online</span></div>
        <div className="stat"><b>{st.today.visitors}</b><span>visitantes hoje</span></div>
        <div className="stat"><b>{st.today.views}</b><span>páginas vistas hoje</span></div>
        <div className="stat"><b>{st.last30.visitors}</b><span>visitantes (30 dias)</span></div>
        <div className="stat"><b>{st.today.houses}</b><span>casas novas hoje</span></div>
      </div>
      {st.online.residents.length > 0 && (
        <div className="card">
          <h2>Moradores online</h2>
          <p>{st.online.residents.map((h) => `@${h}`).join(", ")}</p>
        </div>
      )}
      <div className="card">
        <h2>Visitantes por dia (30 dias)</h2>
        <div className="chart">
          {st.days.map((d) => (
            <div key={d.day} className="col" title={`${d.day.slice(8)}/${d.day.slice(5, 7)}: ${d.visitors} visitantes, ${d.views} páginas`}>
              <span style={{ height: `${(d.visitors / maxV) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="chart-axis"><span>{st.days[0].day.slice(8)}/{st.days[0].day.slice(5, 7)}</span><span>hoje</span></div>
        <h2>Casas novas por dia</h2>
        <div className="chart small">
          {st.days.map((d) => (
            <div key={d.day} className="col" title={`${d.day.slice(8)}/${d.day.slice(5, 7)}: ${d.houses} casas`}>
              <span className="alt" style={{ height: `${(d.houses / maxH) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>Mais visitadas (7 dias)</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              {st.topPages.map((p) => <tr key={p.path}><td>{p.label}</td><td>{p.count} visitante{p.count === 1 ? "" : "s"}</td></tr>)}
              {!st.topPages.length && <tr><td>Sem dados ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2>💰 Dinheiro movimentado</h2>
        <div className="stats">
          <div className="stat"><b>{money(st.revenue.totalCents)}</b><span>total</span></div>
          <div className="stat"><b>{money(st.revenue.monthCents)}</b><span>este mês</span></div>
          <div className="stat"><b>{money(st.revenue.last30Cents)}</b><span>últimos 30 dias</span></div>
          <div className="stat"><b>{st.revenue.count}</b><span>vendas</span></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Produto</th><th>Vendas</th><th>Total</th></tr></thead>
            <tbody>
              {st.revenue.byProduct.map((p) => <tr key={p.label}><td>{p.label}</td><td>{p.count}</td><td>{money(p.cents)}</td></tr>)}
              {!st.revenue.byProduct.length && <tr><td colSpan={3}>Nenhuma venda ainda.</td></tr>}
            </tbody>
          </table>
        </div>
        <h2>Últimos pagamentos</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              {st.revenue.recent.map((p, i) => (
                <tr key={i}><td>{fmtDate(p.at)}</td><td>@{p.handle}</td><td>{p.label}</td><td>{money(p.cents)}</td><td>{p.provider === "manual" ? "Pix manual" : p.provider === "mercadopago" ? "Mercado Pago" : p.provider === "mercadopago_assinatura" ? "Assinatura" : p.provider}</td></tr>
              ))}
              {!st.revenue.recent.length && <tr><td>Nenhum pagamento ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// -------------------------------------------------------------- histórico

const LOG_LABELS: Record<string, string> = {
  chegou: "🏠 chegou",
  mudou: "🚚 mudou de cidade",
  removido: "✕ removido pelo admin",
  entrou: "🔑 entrou na conta",
  codigo_gerado: "🎟 código gerado",
  codigo_apagado: "🗑 código apagado",
  pagamento: "💰 pagamento",
  cortesia: "🎁 cortesia",
  casa_pintada: "🎨 pintou a casa",
  proposta_prefeitura: "📜 propôs pintura da prefeitura",
  voto_prefeitura: "🗳 votou na pintura da prefeitura",
  prefeitura_aprovada: "✅ pintura da prefeitura aprovada",
  prefeitura_rejeitada: "❌ pintura da prefeitura rejeitada",
  eleicao_criada: "🗳 eleição criada",
  eleicao_encerrada: "🏁 eleição encerrada",
  eleicao_cancelada: "❌ eleição cancelada",
  cargo_removido: "✕ cargo removido",
  candidatura: "🙋 se candidatou",
  desistiu: "↩ desistiu da candidatura",
  votou: "🗳 votou",
  admin_entrou: "🔐 admin entrou",
  codigo_acesso: "🔑 código de acesso gerado",
  compra_iniciada: "🛒 abriu um pagamento",
  assinatura_iniciada: "💳 começou a assinar o chat",
  assinatura_ativada: "✅ assinatura do chat ativada",
  assinatura_paga: "💰 mensalidade do chat paga",
  assinatura_cancelled: "❌ assinatura cancelada",
  assinatura_paused: "⏸ assinatura pausada",
  pagamento_suspeito: "⚠️ pagamento com valor diferente",
  estorno: "↩ estorno",
  limite_alterado: "🛑 limite mensal alterado",
  conta_criada: "🆕 criou conta",
  mensagem_apagada: "🧹 mensagem do chat apagada",
  senha_criada: "🔒 criou senha",
  senha_trocada: "🔒 trocou a senha",
};

function describe(l: LogEntry): string {
  const d = (l.details ?? {}) as Record<string, unknown>;
  const city = l.citySlug ? ` · ${l.citySlug}` : "";
  switch (l.action) {
    case "chegou":
      return `${buildingLabel(String(d.tipo ?? ""))}${d.prefeito ? " · virou prefeito(a) 🏛" : ""}${city}`;
    case "mudou":
      return `${d.de} → ${d.para} (${buildingLabel(String(d.tipo ?? ""))})${d.prefeito ? " · virou prefeito(a) 🏛" : ""}`;
    case "limite_alterado":
      return formatPrice(Math.round(Number(d.valor) * 100));
    case "assinatura_paga":
    case "pagamento":
    case "estorno":
    case "compra_iniciada":
    case "cortesia":
      return `${d.produto}${d.valor ? ` · ${formatPrice(Math.round(Number(d.valor) * 100))}` : ""}`;
    case "codigo_gerado":
    case "codigo_apagado":
      return String(d.codigo ?? "");
    case "eleicao_criada":
      return `${d.cargo} · ${d.dias} dia(s)`;
    case "eleicao_encerrada":
      return `${d.cargo}${l.handle ? ` · eleito(a) com ${d.votos} voto(s)` : " · sem vencedor"}`;
    case "prefeitura_aprovada":
    case "prefeitura_rejeitada":
      return `👍 ${d.sim} · 👎 ${d.nao} de ${d.moradores} moradores${city}`;
    case "voto_prefeitura":
      return `${d.aprovou ? "👍 sim" : "👎 não"}${city}`;
    case "votou":
    case "candidatura":
    case "desistiu":
    case "eleicao_cancelada":
    case "cargo_removido":
      return String(d.cargo ?? "");
    default:
      return city.replace(" · ", "");
  }
}

function LogsTab() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [action, setAction] = useState("");
  const [handle, setHandle] = useState("");
  const [more, setMore] = useState(true);

  const load = useCallback(
    async (before?: number) => {
      const qs = new URLSearchParams();
      if (before) qs.set("before", String(before));
      if (action) qs.set("action", action);
      if (handle.trim()) qs.set("handle", handle.trim());
      const j = await api(`/api/admin/logs?${qs}`);
      if (!j.ok) return;
      setLogs((l) => (before ? [...l, ...j.logs] : j.logs));
      setMore(j.logs.length === 50);
    },
    [action, handle],
  );
  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="card">
      <h2>Histórico</h2>
      <div className="filters">
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Tudo</option>
          {Object.entries(LOG_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Filtrar por @" autoCapitalize="none" />
      </div>
      <div className="table-wrap">
        <table className="logs">
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{fmtDate(l.createdAt)}</td>
                <td>{l.handle ? `@${l.handle}` : l.actor === "admin" ? "admin" : ""}</td>
                <td>{LOG_LABELS[l.action] ?? l.action}</td>
                <td className="muted">{describe(l)}</td>
              </tr>
            ))}
            {!logs.length && <tr><td>Nada registrado ainda.</td></tr>}
          </tbody>
        </table>
      </div>
      {more && logs.length > 0 && <button className="btn" onClick={() => load(logs[logs.length - 1].id)}>Carregar mais</button>}
    </div>
  );
}

// ------------------------------------------------------- código emitido

type Issued = { handle: string; kind: "acesso"; code: string | null; expiresAt: string | null; message: string };

function IssuedCode({ issued, onClose }: { issued: Issued; onClose?: () => void }) {
  const [copied, setCopied] = useState("");
  const copy = (t: string, what: string) => {
    navigator.clipboard.writeText(t);
    setCopied(what);
  };
  return (
    <div className="new-code">
      <div className="row between">
        <p>
          {issued.kind === "acesso" ? "🔑 Código de acesso" : "Conta"} para <b>{issued.handle}</b>
          {issued.expiresAt ? ` · vale até ${fmtDate(issued.expiresAt)}, uma vez só` : ""}
        </p>
        {onClose && <button className="btn tiny" onClick={onClose}>✕</button>}
      </div>
      {issued.code ? <div className="code">{issued.code}</div> : <p className="error">Esse usuário não tem conta.</p>}
      <div className="row wrap left">
        {issued.code && <button type="button" className="btn" onClick={() => copy(issued.code!, "código")}>Copiar código</button>}
        <button type="button" className="btn" onClick={() => copy(issued.message, "mensagem")}>Copiar mensagem pra DM</button>
        {copied && <span className="ok">✓ {copied} copiado</span>}
      </div>
      {issued.kind === "acesso" && <p className="muted">Confira se quem pediu é mesmo o dono da conta {issued.handle} antes de mandar.</p>}
    </div>
  );
}
