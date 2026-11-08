"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { id: number; handle: string; body: string; createdAt: string };

/** Chat da cidade: só moradores com o chat ativo. Atualiza a cada 4s. */
export default function ChatPanel({
  slug,
  cityName,
  me,
  mayor,
  onClose,
}: {
  slug: string;
  cityName: string;
  me: string;
  mayor: string | null;
  onClose: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const lastId = useRef(0);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const res = await fetch(`/api/chat/${slug}?after=${lastId.current}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (stop || !json) return;
      if (!json.ok) return setError(json.message);
      if (json.messages.length) {
        lastId.current = json.messages[json.messages.length - 1].id;
        setMsgs((m) => [...m, ...json.messages].slice(-200));
      }
    };
    load();
    const id = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [slug]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError("");
    const res = await fetch(`/api/chat/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const json = await res.json().catch(() => ({ ok: false, message: "Erro de conexão." }));
    setSending(false);
    if (!json.ok) return setError(json.message);
    setText("");
    if (json.message.id > lastId.current) {
      lastId.current = json.message.id;
      setMsgs((m) => [...m, json.message]);
    }
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <strong>💬 Chat de {cityName}</strong>
        <button className="close" onClick={onClose} aria-label="Fechar">✕</button>
      </div>
      <div className="chat-list" ref={list}>
        {!msgs.length && <p className="muted">Ninguém falou nada ainda. Diga oi para os vizinhos!</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.handle === me ? "mine" : ""}`}>
            <b>
              @{m.handle}
              {m.handle === mayor ? " 🏛" : ""}
            </b>
            <span>{m.body}</span>
            <time>{new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
          </div>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <form className="chat-form" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Escreva para os vizinhos…" />
        <button className="btn primary" disabled={sending || !text.trim()}>Enviar</button>
      </form>
    </div>
  );
}
