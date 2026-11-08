"use client";

import { useState } from "react";
import { INSTAGRAM_PROFILE } from "@/config/site";

export type LoginResult = { handle: string; citySlug: string; hasPassword: boolean };

/**
 * Janela de "Entrar": @ + senha (ou código de acesso/resgate) e a tela de
 * "Esqueci minha senha". Usada no mapa do Brasil e nas cidades.
 */
export default function LoginDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: (r: LoginResult) => void }) {
  const [view, setView] = useState<"login" | "forgot">("login");
  const [handle, setHandle] = useState("");
  const [secret, setSecret] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const profile = INSTAGRAM_PROFILE ? <b>@{INSTAGRAM_PROFILE}</b> : "o perfil";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/me/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, secret }),
    });
    const json = await res.json().catch(() => ({ ok: false, message: "Erro de conexão." }));
    setBusy(false);
    if (!json.ok) return setError(json.message);
    onSuccess(json);
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      {view === "login" ? (
        <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
          <h2>Entrar</h2>
          <p>Use seu @ do Instagram e sua senha. Ainda não criou senha? Use o código que recebeu por DM.</p>
          <input
            autoFocus
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@seu.instagram"
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            className="normal-case"
          />
          <input
            type={show ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Senha ou código"
            autoComplete="current-password"
            spellCheck={false}
            className="normal-case"
          />
          <label className="check">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> mostrar
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row between">
            <button type="button" className="login-switch" onClick={() => setView("forgot")}>Esqueci minha senha</button>
            <div className="row">
              <button type="button" className="btn" onClick={onClose}>Cancelar</button>
              <button className="btn primary" disabled={busy || secret.trim().length < 4}>{busy ? "Entrando…" : "Entrar"}</button>
            </div>
          </div>
        </form>
      ) : (
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>🔑 Esqueceu a senha?</h2>
          <p>
            Sem problema! Mande <b>ENTRAR</b> por DM para {profile} no Instagram. Você recebe na hora um <b>código de acesso</b> (vale uma
            vez, por 24h).
          </p>
          <p>Depois volte aqui e entre com seu @ + o código. Aí é só criar uma senha nova.</p>
          <div className="row wrap">
            {INSTAGRAM_PROFILE && (
              <a className="btn" href={`https://ig.me/m/${INSTAGRAM_PROFILE}`} target="_blank" rel="noreferrer">Abrir DM no Instagram</a>
            )}
            <button className="btn primary" onClick={() => setView("login")}>Já tenho o código</button>
          </div>
        </div>
      )}
    </div>
  );
}
