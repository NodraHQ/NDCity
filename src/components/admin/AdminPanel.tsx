"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildingLabel } from "@/lib/buildings";
import type { Code, HouseRow, OfficeHolder } from "@/lib/db/types";
import { STATE_FLAG_UFS } from "@/lib/flags";
import { type ProductId, PRODUCTS, formatPrice } from "@/lib/payments/products";

type Tab = "codigos" | "casas" | "ocupacao" | "eleicoes" | "recursos";
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
  const [tab, setTab] = useState<Tab>("casas");
  const [overview, setOverview] = useState<Overview | null>(null);

  const loadOverview = useCallback(async () => {
    const j = await api("/api/admin/overview");
    if (j.ok) setOverview(j);
  }, []);
  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  async function logout() {
    await api("/api/admin/logout", "POST");
    window.location.reload();
  }

  const TABS: [Tab, string][] = [
    ["casas", "🏠 Casas"],
    ["ocupacao", "📊 Ocupação"],
    ["codigos", "🎟 Códigos"],
    ["eleicoes", "🗳 Eleições"],
    ["recursos", "✨ Recursos pagos"],
  ];

  return (
    <main className="admin wide">
      <div className="admin-head">
        <h1>🏗 NDCity · Admin</h1>
        <div className="row">
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
      {tab === "casas" && <HousesTab overview={overview} reload={loadOverview} />}
      {tab === "ocupacao" && <OccupancyTab overview={overview} />}
      {tab === "codigos" && <CodesTab />}
      {tab === "eleicoes" && <ElectionsTab />}
      {tab === "recursos" && <PerksTab />}
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
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>@</th><th>Cidade</th><th>UF</th><th>Tipo</th><th>Desde</th><th></th></tr>
          </thead>
          <tbody>
            {shown.map((h) => (
              <tr key={h.handle}>
                <td>
                  <a href={`https://instagram.com/${h.handle}`} target="_blank" rel="noreferrer">@{h.handle}</a>
                  {h.isMayor && " 🏛"}
                </td>
                <td><a href={`/c/${h.citySlug}`}>{h.cityName}</a></td>
                <td>{h.uf ?? "—"}</td>
                <td>{buildingLabel(h.type)}</td>
                <td>{new Date(h.createdAt).toLocaleDateString("pt-BR")}</td>
                <td><button className="btn tiny danger" aria-label={`Remover @${h.handle}`} onClick={() => remove(h)}>✕</button></td>
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
  const [codes, setCodes] = useState<Code[]>([]);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [last, setLast] = useState<Code | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const j = await api("/api/admin/codes");
    if (j.ok) setCodes(j.codes);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const j = await api("/api/admin/codes", "POST", { handle });
    setBusy(false);
    if (!j.ok) return setMsg({ text: j.message, error: true });
    setLast(j.code);
    setHandle("");
    load();
  }

  async function remove(code: string) {
    if (!confirm(`Apagar o código ${code}?`)) return;
    await api(`/api/admin/codes?code=${encodeURIComponent(code)}`, "DELETE");
    load();
  }

  const dmText = (c: Code) => `Seu código do NDCity: ${c.code}\nResgate sua casinha em ${window.location.origin}`;

  return (
    <>
      <form className="card" onSubmit={generate}>
        <h2>Gerar código</h2>
        <p>Digite o @ do Instagram da pessoa. O código só vai funcionar para esse @.</p>
        <div className="row">
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@fulano" autoCapitalize="none" autoComplete="off" />
          <button className="btn primary" disabled={busy || !handle.trim()}>Gerar</button>
        </div>
        {msg && <p className={msg.error ? "error" : "ok"}>{msg.text}</p>}
        {last && (
          <div className="new-code">
            <p>Código para <b>@{last.instagramHandle}</b>:</p>
            <div className="code">{last.code}</div>
            <div className="row wrap">
              <button type="button" className="btn" onClick={() => navigator.clipboard.writeText(last.code)}>Copiar código</button>
              <button type="button" className="btn" onClick={() => navigator.clipboard.writeText(dmText(last))}>Copiar mensagem pra DM</button>
            </div>
          </div>
        )}
      </form>
      <div className="card">
        <h2>Códigos ({codes.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>@</th><th>Código</th><th>Situação</th><th></th></tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.code}>
                  <td>@{c.instagramHandle}</td>
                  <td><code>{c.code}</code></td>
                  <td>{c.usedAt ? "✅ usado" : "⏳ esperando"}</td>
                  <td>{!c.usedAt && <button className="btn tiny" onClick={() => remove(c.code)}>apagar</button>}</td>
                </tr>
              ))}
              {!codes.length && <tr><td colSpan={4}>Nenhum código ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
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

function PerksTab() {
  const [handle, setHandle] = useState("");
  const [product, setProduct] = useState<ProductId>("chat_mensal");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    const j = await api("/api/admin/entitlements", "POST", { handle, product });
    if (!j.ok) return setMsg({ text: j.message, error: true });
    const p = j.perks;
    const parts = [
      p.chatUntil ? `chat até ${new Date(p.chatUntil).toLocaleDateString("pt-BR")}` : "sem chat",
      p.customize ? "personalização liberada" : "sem personalização",
      `${p.moveCredits} mudança(s)`,
    ];
    setMsg({ text: `${j.message} Agora tem: ${parts.join(", ")}.` });
  }

  return (
    <form className="card" onSubmit={grant}>
      <h2>Liberar recurso pago</h2>
      <p>Enquanto o pagamento online não está pronto: a pessoa paga por Pix direto pra você e você libera aqui.</p>
      <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@fulano" autoCapitalize="none" autoComplete="off" />
      <select value={product} onChange={(e) => setProduct(e.target.value as ProductId)}>
        {(Object.keys(PRODUCTS) as ProductId[]).map((id) => (
          <option key={id} value={id}>{PRODUCTS[id].label} — {formatPrice(PRODUCTS[id].priceCents)}</option>
        ))}
      </select>
      <button className="btn primary" disabled={!handle.trim()}>Liberar</button>
      {msg && <p className={msg.error ? "error" : "ok"}>{msg.text}</p>}
    </form>
  );
}
