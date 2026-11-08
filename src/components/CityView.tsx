"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILDING_TYPES, type BuildingType, buildingLabel } from "@/lib/buildings";
import { generateCity } from "@/lib/city/generate";
import type { CityData } from "@/lib/city-data";
import { INSTAGRAM_PROFILE, SITE_NAME } from "@/config/site";

const CityCanvas = dynamic(() => import("./city/CityCanvas"), {
  ssr: false,
  loading: () => <div className="city-loading">Construindo a cidade…</div>,
});

type Step =
  | { name: "idle" }
  | { name: "code"; error?: string; busy?: boolean }
  | { name: "type"; code: string; handle: string }
  | { name: "lot"; code: string; handle: string; type: BuildingType; lot: number | null; error?: string; busy?: boolean }
  | { name: "done"; handle: string; isMayor: boolean };

type Info = { kind: "house"; lotIndex: number } | { kind: "hall" } | { kind: "free" } | null;

export default function CityView({ initial }: { initial: CityData }) {
  const [data, setData] = useState(initial);
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [info, setInfo] = useState<Info>(null);
  const [focusLot, setFocusLot] = useState<number | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const zoomRef = useRef<((f: number) => void) | null>(null);
  const lotCount = useMemo(() => generateCity(initial.city.seed).lots.length, [initial.city.seed]);
  const slug = data.city.slug;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/cities/${slug}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [slug]);

  useEffect(() => {
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [refresh]);

  const occupied = useMemo(() => new Set(data.houses.map((h) => h.lotIndex)), [data.houses]);
  const freeCount = lotCount - occupied.size;
  const locked = !data.city.mayorHandle;

  // ---- passo 1: código
  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setStep({ name: "code", busy: true });
    const res = await fetch("/api/claim/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: codeInput }),
    });
    const json = await res.json().catch(() => ({ ok: false, message: "Erro de conexão." }));
    if (!json.ok) return setStep({ name: "code", error: json.message });
    setStep({ name: "type", code: json.code, handle: json.handle });
  }

  // ---- passo 3: confirmar
  async function confirmClaim() {
    if (step.name !== "lot" || step.lot == null) return;
    setStep({ ...step, busy: true, error: undefined });
    const res = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: step.code, citySlug: slug, lotIndex: step.lot, buildingType: step.type }),
    });
    const json = await res.json().catch(() => ({ ok: false, message: "Erro de conexão." }));
    await refresh();
    if (!json.ok) {
      if (json.error === "lot_taken") return setStep({ ...step, lot: null, busy: false, error: json.message });
      return setStep({ ...step, busy: false, error: json.message });
    }
    setCodeInput("");
    setFocusLot(json.lotIndex);
    setStep({ name: "done", handle: json.handle, isMayor: json.isMayor });
  }

  function pickRandom() {
    if (step.name !== "lot") return;
    const free = Array.from({ length: lotCount }, (_, i) => i).filter((i) => !occupied.has(i));
    if (!free.length) return;
    const lot = free[Math.floor(Math.random() * free.length)];
    setStep({ ...step, lot, error: undefined });
    setFocusLot(lot);
  }

  const onLotTap = useCallback(
    (lotIndex: number, isOccupied: boolean) => {
      if (step.name === "lot") {
        if (!isOccupied) setStep({ ...step, lot: lotIndex, error: undefined });
        return;
      }
      setInfo(isOccupied ? { kind: "house", lotIndex } : { kind: "free" });
    },
    [step],
  );
  const onCityHallTap = useCallback(() => {
    if (step.name !== "lot") setInfo({ kind: "hall" });
  }, [step.name]);
  const onEmptyTap = useCallback(() => setInfo(null), []);

  const tappedHouse = info?.kind === "house" ? data.houses.find((h) => h.lotIndex === info.lotIndex) : null;
  const picking = step.name === "lot";

  return (
    <main className="city-page">
      <CityCanvas
        seed={data.city.seed}
        houses={data.houses}
        mayorHandle={data.city.mayorHandle}
        mode={picking ? "pick" : "view"}
        pickedLot={picking ? step.lot : null}
        ghostType={picking ? step.type : null}
        focusLot={focusLot}
        onLotTap={onLotTap}
        onCityHallTap={onCityHallTap}
        onEmptyTap={onEmptyTap}
        zoomRef={zoomRef}
      />

      <header className="topbar">
        <div className="title">
          <strong>{data.city.name}</strong>
          <span>
            {data.houses.length} casinha{data.houses.length === 1 ? "" : "s"} · {freeCount} livre{freeCount === 1 ? "" : "s"}
          </span>
        </div>
        {!picking && (
          <button className="btn primary" onClick={() => { setInfo(null); setStep({ name: "code" }); }}>
            🏠 Resgatar casinha
          </button>
        )}
      </header>

      {locked && !picking && step.name === "idle" && (
        <div className="banner">🔒 Cidade bloqueada! Quem resgatar a primeira casinha vira <b>prefeito</b> e libera a cidade.</div>
      )}
      {data.storeKind === "memory" && <div className="banner small warn">Modo teste: sem banco de dados, nada fica salvo.</div>}

      <div className="zoom">
        <button className="btn" aria-label="Aproximar" onClick={() => zoomRef.current?.(1.4)}>+</button>
        <button className="btn" aria-label="Afastar" onClick={() => zoomRef.current?.(1 / 1.4)}>−</button>
      </div>

      {/* ---------- cartão de informação ao tocar */}
      {info && !picking && step.name === "idle" && (
        <div className="sheet">
          <button className="close" onClick={() => setInfo(null)} aria-label="Fechar">✕</button>
          {tappedHouse && (
            <>
              <h3>@{tappedHouse.handle}</h3>
              <p>{buildingLabel(tappedHouse.type)}{tappedHouse.handle === data.city.mayorHandle ? " · 🏛 Prefeito(a)" : ""}</p>
              <a className="btn" href={`https://instagram.com/${tappedHouse.handle}`} target="_blank" rel="noreferrer">Ver no Instagram</a>
            </>
          )}
          {info.kind === "hall" && (
            <>
              <h3>🏛 Prefeitura</h3>
              {data.city.mayorHandle ? (
                <p>Prefeito(a): <b>@{data.city.mayorHandle}</b>, a primeira pessoa a morar aqui.</p>
              ) : (
                <p>Ainda sem prefeito. Quem resgatar a primeira casinha ganha a prefeitura como troféu!</p>
              )}
            </>
          )}
          {info.kind === "free" && (
            <>
              <h3>Lote disponível</h3>
              <p>Esse lote está livre. Tem um código? Resgate sua casinha!</p>
              <button className="btn primary" onClick={() => { setInfo(null); setStep({ name: "code" }); }}>Resgatar casinha</button>
            </>
          )}
        </div>
      )}

      {/* ---------- passo 1: código */}
      {step.name === "code" && (
        <div className="modal-bg" onClick={() => setStep({ name: "idle" })}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitCode}>
            <h2>Resgatar casinha</h2>
            <p>
              Digite o código que você recebeu por DM
              {INSTAGRAM_PROFILE ? <> do <b>@{INSTAGRAM_PROFILE}</b></> : null}.
            </p>
            <input
              autoFocus
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="NDC-XXXX-XXXX"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
            {step.error && <p className="error">{step.error}</p>}
            <div className="row">
              <button type="button" className="btn" onClick={() => setStep({ name: "idle" })}>Cancelar</button>
              <button className="btn primary" disabled={step.busy || codeInput.trim().length < 4}>
                {step.busy ? "Conferindo…" : "Continuar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- passo 2: tipo de construção */}
      {step.name === "type" && (
        <div className="modal-bg">
          <div className="modal">
            <h2>Olá, @{step.handle}! 👋</h2>
            <p>O que você quer construir?</p>
            <div className="types">
              {BUILDING_TYPES.map((b) => (
                <button
                  key={b.id}
                  className="btn type"
                  onClick={() => setStep({ name: "lot", code: step.code, handle: step.handle, type: b.id, lot: null })}
                >
                  <span className="emoji">{b.emoji}</span>
                  {b.label}
                </button>
              ))}
            </div>
            <div className="row">
              <button className="btn" onClick={() => setStep({ name: "idle" })}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- passo 3: escolher o lote no mapa */}
      {step.name === "lot" && (
        <div className="sheet">
          <h3>Escolha seu lote</h3>
          <p>
            {step.lot == null
              ? "Toque num lote amarelo no mapa (arraste e dê zoom para achar um lugar legal)."
              : `Lote escolhido (marcado em verde)! Confirme para construir: ${buildingLabel(step.type)}.`}
          </p>
          {step.error && <p className="error">{step.error}</p>}
          <div className="row wrap">
            <button className="btn" onClick={() => setStep({ name: "type", code: step.code, handle: step.handle })} disabled={step.busy}>
              ← Voltar
            </button>
            <button className="btn" onClick={pickRandom} disabled={step.busy}>🎲 Escolher pra mim</button>
            <button className="btn primary" onClick={confirmClaim} disabled={step.lot == null || step.busy}>
              {step.busy ? "Construindo…" : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      {/* ---------- pronto! */}
      {step.name === "done" && (
        <div className="modal-bg" onClick={() => setStep({ name: "idle" })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {step.isMayor ? (
              <>
                <h2>🏛 Você é o(a) prefeito(a)!</h2>
                <p>
                  Você foi a primeira pessoa a morar em {data.city.name}. A prefeitura agora leva o seu @
                  como troféu, e a cidade está liberada para todo mundo.
                </p>
              </>
            ) : (
              <>
                <h2>🎉 Casinha pronta!</h2>
                <p>Bem-vindo(a) a {data.city.name}, @{step.handle}! Sua casinha já está no mapa.</p>
              </>
            )}
            <div className="row">
              <button className="btn primary" onClick={() => setStep({ name: "idle" })}>Ver minha casinha</button>
            </div>
          </div>
        </div>
      )}

      <footer className="credit">{SITE_NAME}</footer>
    </main>
  );
}
