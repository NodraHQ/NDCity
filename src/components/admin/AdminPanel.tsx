"use client";

import { useCallback, useEffect, useState } from "react";
import type { Code } from "@/lib/db/types";
import { type ProductId, PRODUCTS, formatPrice } from "@/lib/payments/products";

export default function AdminPanel({ storeKind }: { storeKind: "supabase" | "memory" }) {
  const [handle, setHandle] = useState("");
  const [codes, setCodes] = useState<Code[]>([]);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [last, setLast] = useState<Code | null>(null);
  const [removeHandle, setRemoveHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [grantHandle, setGrantHandle] = useState("");
  const [grantProduct, setGrantProduct] = useState<ProductId>("chat_mensal");
  const [grantMsg, setGrantMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/codes", { cache: "no-store" });
    const json = await res.json();
    if (json.ok) setCodes(json.codes);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.ok) return setMsg({ text: json.message, error: true });
    setLast(json.code);
    setHandle("");
    load();
  }

  async function remove(code: string) {
    if (!confirm(`Apagar o código ${code}?`)) return;
    await fetch(`/api/admin/codes?code=${encodeURIComponent(code)}`, { method: "DELETE" });
    load();
  }

  async function removeHouse(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Remover a casinha de @${removeHandle.replace(/^@/, "")}? A pessoa perde todo o acesso e isso não tem volta.`)) return;
    const res = await fetch(`/api/admin/claims?handle=${encodeURIComponent(removeHandle)}`, { method: "DELETE" });
    const json = await res.json();
    setMsg(json.ok ? { text: json.message } : { text: json.message, error: true });
    if (json.ok) {
      setRemoveHandle("");
      load();
    }
  }

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/entitlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: grantHandle, product: grantProduct }),
    });
    const json = await res.json();
    if (!json.ok) return setGrantMsg({ text: json.message, error: true });
    const p = json.perks;
    const parts = [
      p.chatUntil ? `chat até ${new Date(p.chatUntil).toLocaleDateString("pt-BR")}` : "sem chat",
      p.customize ? "personalização liberada" : "sem personalização",
      `${p.moveCredits} mudança(s)`,
    ];
    setGrantMsg({ text: `${json.message} Agora tem: ${parts.join(", ")}.` });
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  const dmText = (c: Code) =>
    `Seu código da Cidadezinha: ${c.code}\nResgate sua casinha em ${typeof window !== "undefined" ? window.location.origin : ""}`;

  return (
    <main className="admin">
      <div className="admin-head">
        <h1>🏗 Admin</h1>
        <div className="row">
          <a className="btn" href="/">Ver mapa</a>
          <button className="btn" onClick={logout}>Sair</button>
        </div>
      </div>
      {storeKind === "memory" && (
        <p className="banner-inline warn">Modo teste: o Supabase não está configurado, os códigos somem quando o servidor reinicia.</p>
      )}

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

      <form className="card" onSubmit={grant}>
        <h2>Liberar recurso pago</h2>
        <p>Enquanto o pagamento online não está pronto: a pessoa paga por Pix direto pra você e você libera aqui.</p>
        <input value={grantHandle} onChange={(e) => setGrantHandle(e.target.value)} placeholder="@fulano" autoCapitalize="none" autoComplete="off" />
        <select value={grantProduct} onChange={(e) => setGrantProduct(e.target.value as ProductId)}>
          {(Object.keys(PRODUCTS) as ProductId[]).map((id) => (
            <option key={id} value={id}>
              {PRODUCTS[id].label} — {formatPrice(PRODUCTS[id].priceCents)}
            </option>
          ))}
        </select>
        <button className="btn primary" disabled={!grantHandle.trim()}>Liberar</button>
        {grantMsg && <p className={grantMsg.error ? "error" : "ok"}>{grantMsg.text}</p>}
      </form>

      <form className="card" onSubmit={removeHouse}>
        <h2>Remover casinha</h2>
        <p>Para casos de abuso. A pessoa perde a casinha, os códigos e o login. Se era prefeita, a prefeitura passa para o morador mais antigo (ou fica vaga).</p>
        <div className="row">
          <input value={removeHandle} onChange={(e) => setRemoveHandle(e.target.value)} placeholder="@fulano" autoCapitalize="none" />
          <button className="btn danger" disabled={!removeHandle.trim()}>Remover</button>
        </div>
      </form>
    </main>
  );
}
