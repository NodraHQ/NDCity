"use client";

import { useState } from "react";

export type LoginResult = { handle: string; citySlug: string | null; hasPassword: boolean };

/**
 * Janela de "Entrar": @ + senha (ou código de acesso/resgate) e a tela de
 * "Esqueci minha senha". Usada no mapa do Brasil e nas cidades.
 */
export default function LoginDialog({
  onClose,
  onSuccess,
  onSignup,
}: {
  onClose: () => void;
  onSuccess: (r: LoginResult) => void;
  onSignup?: () => void;
}) {
  const [view, setView] = useState<"login" | "forgot">("login");
  const [handle, setHandle] = useState("");
  const [secret, setSecret] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
          <p>Entre com seu nome de usuário e sua senha.</p>
          <input
            autoFocus
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="nome de usuário"
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            className="normal-case"
          />
          <input
            type={show ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="senha"
            autoComplete="current-password"
            spellCheck={false}
            className="normal-case"
          />
          <label className="check">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> mostrar
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row between">
            <span className="row left">
              <button type="button" className="login-switch" onClick={() => setView("forgot")}>Esqueci minha senha</button>
              {onSignup && <button type="button" className="login-switch" onClick={onSignup}>Criar conta</button>}
            </span>
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
            Sem problema! Fale com a equipe do NDCity e diga seu nome de usuário. Você recebe um <b>código de acesso</b> (vale uma vez,
            por 24h).
          </p>
          <p>Depois volte aqui e entre com seu usuário + o código no lugar da senha. Aí é só criar uma senha nova no menu.</p>
          <div className="row wrap">
            <button className="btn primary" onClick={() => setView("login")}>Já tenho o código</button>
          </div>
        </div>
      )}
    </div>
  );
}
