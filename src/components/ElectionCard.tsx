"use client";

import { useState } from "react";

export type ElectionV = {
  id: string;
  office: "governor" | "president";
  uf: string | null;
  status: "open" | "closed" | "canceled";
  endsAt: string;
  winner: string | null;
  candidates: { handle: string; votes: number }[];
  myVote: string | null;
  canParticipate: boolean;
  isCandidate: boolean;
};

export const officeTitle = (e: { office: string; uf: string | null }) =>
  e.office === "president" ? "Presidente do Brasil" : `Governador(a) de ${e.uf}`;

/** Uma eleição: candidatos, votos e botões de votar/candidatar. */
export default function ElectionCard({ election, onChange }: { election: ElectionV; onChange: (e: ElectionV) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const e = election;
  const total = e.candidates.reduce((n, c) => n + c.votes, 0);

  async function act(action: "candidate" | "withdraw" | "vote", candidate?: string) {
    if (action === "withdraw" && !confirm("Desistir da candidatura? Seus votos serão perdidos.")) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/civic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ electionId: e.id, action, candidate }),
    });
    const j = await res.json().catch(() => ({ ok: false, message: "Erro de conexão." }));
    setBusy(false);
    if (!j.ok) return setError(j.message);
    onChange(j.election);
  }

  return (
    <div className="election">
      <div className="row between">
        <b>🗳 {officeTitle(e)}</b>
        <small>
          {e.status === "open"
            ? `até ${new Date(e.endsAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
            : e.winner
              ? `eleito(a): @${e.winner}`
              : "encerrada"}
        </small>
      </div>
      <ul className="candidates">
        {e.candidates.map((c) => (
          <li key={c.handle} className={e.myVote === c.handle ? "mine" : ""}>
            <span>@{c.handle}</span>
            <span className="bar"><span style={{ width: `${total ? (c.votes / total) * 100 : 0}%` }} /><em>{c.votes}</em></span>
            {e.status === "open" && e.canParticipate && (
              <button className="btn tiny" disabled={busy || e.myVote === c.handle} onClick={() => act("vote", c.handle)}>
                {e.myVote === c.handle ? "✓ seu voto" : "Votar"}
              </button>
            )}
          </li>
        ))}
        {!e.candidates.length && <li className="muted">Nenhum candidato ainda. Seja o primeiro!</li>}
      </ul>
      {e.status === "open" && e.canParticipate && (
        <div className="row">
          {e.isCandidate ? (
            <button className="btn tiny" disabled={busy} onClick={() => act("withdraw")}>Desistir da candidatura</button>
          ) : (
            <button className="btn tiny primary" disabled={busy} onClick={() => act("candidate")}>🙋 Me candidatar</button>
          )}
        </div>
      )}
      {e.status === "open" && !e.canParticipate && (
        <p className="muted">{e.office === "governor" ? `Só moradores de ${e.uf} votam.` : "Só quem tem casa vota."}</p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
