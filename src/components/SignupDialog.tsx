"use client";

import { useState } from "react";

/** Criar conta: nome de usuário + senha. A pessoa já sai logada. */
export default function SignupDialog({
  cityName,
  onClose,
  onSuccess,
  onLogin,
}: {
  cityName?: string;
  onClose: () => void;
  onSuccess: (handle: string) => void;
  onLogin: () => void;
}) {
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) return setError("As duas senhas não são iguais.");
    setBusy(true);
    setError("");
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, password }),
    });
    const json = await res.json().catch(() => ({ ok: false, message: "Erro de conexão." }));
    setBusy(false);
    if (!json.ok) return setError(json.message);
    onSuccess(json.handle);
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="auth-tabs">
          <button type="button" onClick={onLogin}>Entrar</button>
          <button type="button" className="on">Criar conta</button>
        </div>
        <p>
          Escolha um nome de usuário e uma senha.{" "}
          {cityName ? <>Depois é só escolher seu lote em <b>{cityName}</b>.</> : "Depois é só escolher sua cidade no mapa."}
        </p>
        <input
          autoFocus
          value={handle}
          onChange={(e) => setHandle(e.target.value.replace(/\s/g, "").replace(/^@/, "").toLowerCase())}
          placeholder="nome de usuário"
          autoCapitalize="none"
          autoComplete="username"
          spellCheck={false}
          maxLength={21}
          className="normal-case"
        />
        <p className="muted">3 a 20 caracteres: letras, números, ponto ou _. É o nome que aparece na sua casinha.</p>
        <input
          type={show ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="senha (mínimo 6)"
          autoComplete="new-password"
          className="normal-case"
        />
        <input
          type={show ? "text" : "password"}
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          placeholder="repita a senha"
          autoComplete="new-password"
          className="normal-case"
        />
        <label className="check">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> mostrar senha
        </label>
        <p className="muted">
          Ao criar a conta você concorda com os <a href="/termos" target="_blank">Termos e a Privacidade</a>.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn primary" disabled={busy || handle.length < 3 || password.length < 6 || !password2}>
              {busy ? "Criando…" : "Criar conta"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
