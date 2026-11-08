"use client";

import { useState } from "react";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json().catch(() => ({ ok: false, message: "Erro de conexão." }));
    setBusy(false);
    if (!json.ok) return setError(json.message);
    window.location.reload();
  }

  return (
    <main className="admin">
      <form className="card" onSubmit={submit}>
        <h1>🔐 Admin</h1>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" autoFocus />
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy || !password}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
