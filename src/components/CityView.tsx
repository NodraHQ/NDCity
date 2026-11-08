"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INSTAGRAM_PROFILE } from "@/config/site";
import { BUILDING_TYPES, type BuildingType, buildingLabel } from "@/lib/buildings";
import { generateCity } from "@/lib/city/generate";
import type { CityData } from "@/lib/city-data";
import { type ProductId, PRODUCTS, formatPrice } from "@/lib/payments/products";
import { PALETTE, STYLE_PARTS, type Style } from "@/lib/styles";
import { darknessFor, localTime, sunElevation } from "@/lib/sun";
import ChatPanel from "./ChatPanel";
import ElectionCard, { type ElectionV, officeTitle } from "./ElectionCard";
import FlagEditor from "./FlagEditor";
import Tracker from "./Tracker";
import { PRESETS } from "@/lib/presets";

const CityCanvas = dynamic(() => import("./city/CityCanvas"), {
  ssr: false,
  loading: () => <div className="city-loading">Construindo a cidade…</div>,
});

type Perks = { chatUntil: string | null; customize: boolean; moveCredits: number };
type ProposalV = { id: string; proposer: string; style: Style; endsAt: string; yes: number; no: number; residents: number; myVote: boolean | null; canVote: boolean };
type Civic = { offices: { president: string | null; governors: Record<string, string> }; elections: ElectionV[] };
type Me = { handle: string; citySlug: string | null; perks: Perks } | null;

type Step =
  | { name: "idle" }
  | { name: "code"; error?: string; busy?: boolean }
  | { name: "login"; error?: string; busy?: boolean }
  | { name: "type"; purpose: "claim" | "move"; code: string; handle: string }
  | { name: "lot"; purpose: "claim" | "move"; code: string; handle: string; type: BuildingType | null; lot: number | null; error?: string; busy?: boolean }
  | { name: "done"; handle: string; isMayor: boolean; moved?: boolean }
  | { name: "menu" }
  | { name: "chat" }
  | { name: "customize"; target: "house" | "hall"; style: Style; busy?: boolean; error?: string }
  | { name: "paywall"; product: ProductId; message?: string; busy?: boolean }
  | { name: "proposal"; busy?: boolean; error?: string }
  | { name: "elections" }
  | { name: "notice"; title: string; text: string };

type Info = { kind: "house"; lotIndex: number } | { kind: "hall" } | { kind: "free" } | null;

async function postJSON(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => ({ ok: false, message: "Erro de conexão." }));
}

/** Escuridão (0..1) agora na cidade. "?hora=22" na URL simula um horário. */
function useDarkness(lat: number, lng: number) {
  const [d, setD] = useState(0);
  useEffect(() => {
    const calc = () => {
      const forced = new URLSearchParams(window.location.search).get("hora");
      let date = new Date();
      if (forced != null && !Number.isNaN(Number(forced))) {
        date = new Date();
        date.setUTCHours((Number(forced) + 3) % 24, 0, 0, 0); // horário de Brasília
      }
      setD(darknessFor(sunElevation(lat, lng, date)));
    };
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [lat, lng]);
  return d;
}

export default function CityView({ initial }: { initial: CityData }) {
  const [data, setData] = useState(initial);
  const [me, setMe] = useState<Me>(null);
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [info, setInfo] = useState<Info>(null);
  const [focusLot, setFocusLot] = useState<number | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [clock, setClock] = useState("");
  const [proposal, setProposal] = useState<ProposalV | null>(null);
  const [civic, setCivic] = useState<Civic | null>(null);
  const zoomRef = useRef<((f: number) => void) | null>(null);
  const { city } = data;
  const slug = city.slug;
  const lotCount = useMemo(() => generateCity(city.seed, city.layoutSize).lots.length, [city.seed, city.layoutSize]);
  const darkness = useDarkness(city.lat, city.lng);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/cities/${slug}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [slug]);
  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (res.ok) setMe((await res.json()).resident);
  }, []);
  const refreshCivic = useCallback(async () => {
    const [p, c] = await Promise.all([
      fetch(`/api/proposal/${slug}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/civic", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    if (p) setProposal(p.proposal);
    if (c?.offices) setCivic(c);
  }, [slug]);

  useEffect(() => {
    refreshMe();
    refreshCivic();
    const id = setInterval(() => {
      refresh();
      refreshCivic();
    }, 20_000);
    return () => clearInterval(id);
  }, [refresh, refreshMe, refreshCivic]);

  useEffect(() => {
    const tick = () => setClock(localTime(city.timezone));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [city.timezone]);

  const occupied = useMemo(() => new Set(data.houses.map((h) => h.lotIndex)), [data.houses]);
  const freeCount = lotCount - occupied.size;
  const locked = !city.mayorHandle;
  const livesHere = !!me && me.citySlug === slug;
  const livesElsewhere = !!me?.citySlug && me.citySlug !== slug;
  const isMayor = livesHere && city.mayorHandle === me!.handle;
  const myHouse = livesHere ? data.houses.find((h) => h.handle === me!.handle) : undefined;

  // prévia da personalização direto no mapa
  const shownHouses = useMemo(() => {
    if (step.name !== "customize" || step.target !== "house" || !me) return data.houses;
    return data.houses.map((h) => (h.handle === me.handle ? { ...h, style: step.style } : h));
  }, [data.houses, step, me]);
  const shownHallStyle =
    step.name === "customize" && step.target === "hall"
      ? step.style
      : step.name === "proposal" && proposal
        ? proposal.style
        : city.hallStyle;
  const governor = city.uf ? (civic?.offices.governors[city.uf] ?? null) : null;
  const president = civic?.offices.president ?? null;
  const myElections = (civic?.elections ?? []).filter((e) => e.status === "open" && e.canParticipate);

  // ------------------------------------------------------------ ações

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setStep({ name: "code", busy: true });
    const json = await postJSON("/api/claim/check", { code: codeInput });
    if (!json.ok) return setStep({ name: "code", error: json.message });
    setStep({ name: "type", purpose: "claim", code: json.code, handle: json.handle });
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setStep({ name: "login", busy: true });
    const json = await postJSON("/api/me/login", { code: codeInput });
    if (!json.ok) return setStep({ name: "login", error: json.message });
    setCodeInput("");
    await refreshMe();
    setStep({ name: "idle" });
    if (json.citySlug && json.citySlug !== slug) window.location.href = `/c/${json.citySlug}`;
  }

  async function logout() {
    await postJSON("/api/me/logout");
    setMe(null);
    setStep({ name: "idle" });
  }

  async function confirmLot() {
    if (step.name !== "lot" || step.lot == null) return;
    setStep({ ...step, busy: true, error: undefined });
    const json =
      step.purpose === "claim"
        ? await postJSON("/api/claim", { code: step.code, citySlug: slug, lotIndex: step.lot, buildingType: step.type })
        : await postJSON("/api/me/move", { citySlug: slug, lotIndex: step.lot, buildingType: step.type });
    await refresh();
    if (!json.ok) {
      if (json.error === "lot_taken") return setStep({ ...step, lot: null, busy: false, error: json.message });
      return setStep({ ...step, busy: false, error: json.message });
    }
    setCodeInput("");
    setFocusLot(json.lotIndex);
    await refreshMe();
    setStep({ name: "done", handle: json.handle ?? me?.handle ?? "", isMayor: json.isMayor, moved: step.purpose === "move" });
  }

  function pickRandom() {
    if (step.name !== "lot") return;
    const free = Array.from({ length: lotCount }, (_, i) => i).filter((i) => !occupied.has(i));
    if (!free.length) return;
    const lot = free[Math.floor(Math.random() * free.length)];
    setStep({ ...step, lot, error: undefined });
    setFocusLot(lot);
  }

  function startMove() {
    if (!me) return;
    if (me.perks.moveCredits < 1) return setStep({ name: "paywall", product: "mudanca" });
    setInfo(null);
    setStep({ name: "type", purpose: "move", code: "", handle: me.handle });
  }

  function openChat() {
    if (!me?.perks.chatUntil) return setStep({ name: "paywall", product: "chat_mensal" });
    setStep({ name: "chat" });
  }

  function openCustomize(target: "house" | "hall") {
    if (!me?.perks.customize) return setStep({ name: "paywall", product: "personalizar" });
    const current = target === "hall" ? city.hallStyle : myHouse?.style;
    setStep({ name: "customize", target, style: { ...(current ?? {}) } });
  }

  async function saveStyle() {
    if (step.name !== "customize") return;
    setStep({ ...step, busy: true, error: undefined });
    const json = await postJSON("/api/me/style", { target: step.target, style: step.style });
    if (!json.ok) return setStep({ ...step, busy: false, error: json.message });
    await Promise.all([refresh(), refreshCivic()]);
    if (step.target === "hall") setStep({ name: "notice", title: "🏛 Prefeitura", text: json.message });
    else setStep({ name: "idle" });
  }

  async function voteProposal(approve: boolean) {
    setStep({ name: "proposal", busy: true });
    const json = await postJSON(`/api/proposal/${slug}`, { approve });
    if (!json.ok) return setStep({ name: "proposal", error: json.message });
    await refresh();
    setProposal(json.proposal);
    if (json.decided) setStep({ name: "notice", title: "🗳 Votação encerrada", text: "A maioria decidiu! Confira a prefeitura." });
    else setStep({ name: "proposal" });
  }

  async function buy(product: ProductId) {
    setStep({ name: "paywall", product, busy: true });
    const json = await postJSON("/api/purchase", { product });
    if (json.url) window.location.href = json.url;
    else setStep({ name: "paywall", product, message: json.message });
  }

  const onLotTap = useCallback(
    (lotIndex: number, isOccupied: boolean) => {
      if (step.name === "lot") {
        if (!isOccupied) setStep({ ...step, lot: lotIndex, error: undefined });
        return;
      }
      if (step.name !== "idle") return;
      setInfo(isOccupied ? { kind: "house", lotIndex } : { kind: "free" });
    },
    [step],
  );
  const onCityHallTap = useCallback(() => {
    if (step.name === "idle") setInfo({ kind: "hall" });
  }, [step.name]);
  const onEmptyTap = useCallback(() => setInfo(null), []);

  const tappedHouse = info?.kind === "house" ? data.houses.find((h) => h.lotIndex === info.lotIndex) : null;
  const picking = step.name === "lot";
  const isNight = darkness > 0.5;

  // ------------------------------------------------------------ tela

  return (
    <main className="city-page">
      <Tracker path={`/c/${slug}`} />
      <CityCanvas
        seed={city.seed}
        size={city.layoutSize}
        houses={shownHouses}
        mayorHandle={city.mayorHandle}
        hallStyle={shownHallStyle}
        darkness={darkness}
        mode={picking ? "pick" : "view"}
        pickedLot={picking ? step.lot : null}
        ghostType={picking ? (step.type ?? myHouse?.type ?? "casa") : null}
        focusLot={focusLot}
        onLotTap={onLotTap}
        onCityHallTap={onCityHallTap}
        onEmptyTap={onEmptyTap}
        zoomRef={zoomRef}
      />

      <header className="topbar">
        <div className="title-row">
          <Link className="btn icon" href="/" aria-label="Voltar ao mapa do Brasil">←</Link>
          <div className="title">
            <strong>
              {city.name}
              {city.uf ? <small> · {city.uf}</small> : null}
            </strong>
            <span>
              {isNight ? "🌙" : "☀️"} {clock} · {data.houses.length} casa{data.houses.length === 1 ? "" : "s"} · {freeCount} livre
              {freeCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {!picking && (
          <div className="actions">
            {!me && (
              <>
                <button className="btn primary" onClick={() => { setInfo(null); setStep({ name: "code" }); }}>
                  🏠 Resgatar casinha
                </button>
                <button className="btn small-link" onClick={() => setStep({ name: "login" })}>Já tenho casinha</button>
              </>
            )}
            {livesHere && (
              <button className="btn primary" onClick={() => setStep({ name: "menu" })}>☰ @{me!.handle}</button>
            )}
            {livesElsewhere && (
              <>
                <button className="btn primary" onClick={startMove}>🚚 Mudar pra cá</button>
                <Link className="btn small-link" href={`/c/${me!.citySlug}`}>Minha cidade</Link>
              </>
            )}
          </div>
        )}
      </header>

      {locked && !picking && step.name === "idle" && (
        <div className="banner">🔒 Cidade bloqueada! Quem chegar primeiro vira <b>prefeito</b> e libera {city.name}.</div>
      )}
      {data.storeKind === "memory" && <div className="banner small warn">Modo teste: sem banco de dados, nada fica salvo.</div>}

      {step.name === "idle" && !info && proposal && (
        <button className="banner vote" onClick={() => setStep({ name: "proposal" })}>
          📜 @{proposal.proposer} quer pintar a prefeitura.{" "}
          {proposal.canVote ? (proposal.myVote == null ? <b>Toque para votar!</b> : "Você já votou.") : "Toque para ver."}
        </button>
      )}
      {step.name === "idle" && !info && !proposal && myElections.length > 0 && (
        <button className="banner vote" onClick={() => setStep({ name: "elections" })}>
          🗳 Eleição aberta: {officeTitle(myElections[0])}. <b>Toque para participar!</b>
        </button>
      )}

      {livesHere && step.name === "idle" && (
        <button className="btn chat-fab" onClick={openChat}>💬 Chat de {city.name}</button>
      )}

      <div className="zoom">
        <button className="btn" aria-label="Aproximar" onClick={() => zoomRef.current?.(1.4)}>+</button>
        <button className="btn" aria-label="Afastar" onClick={() => zoomRef.current?.(1 / 1.4)}>−</button>
      </div>

      {/* ---------- cartão ao tocar no mapa */}
      {info && step.name === "idle" && (
        <div className="sheet">
          <button className="close" onClick={() => setInfo(null)} aria-label="Fechar">✕</button>
          {tappedHouse && (
            <>
              <h3>@{tappedHouse.handle}</h3>
              <p>
                {buildingLabel(tappedHouse.type)}
                {tappedHouse.handle === city.mayorHandle ? " · 🏛 Prefeito(a)" : ""}
              </p>
              <a className="btn" href={`https://instagram.com/${tappedHouse.handle}`} target="_blank" rel="noreferrer">Ver no Instagram</a>
            </>
          )}
          {info.kind === "hall" && (
            <>
              <h3>🏛 Prefeitura de {city.name}</h3>
              {city.mayorHandle ? (
                <p>Prefeito(a): <b>@{city.mayorHandle}</b>, o morador mais antigo da cidade.</p>
              ) : (
                <p>A prefeitura está vaga. Quem chegar primeiro ganha a prefeitura como troféu!</p>
              )}
              {(governor || president) && (
                <p>
                  {governor && <>Governador(a) de {city.uf}: <b>@{governor}</b><br /></>}
                  {president && <>Presidente: <b>@{president}</b></>}
                </p>
              )}
              <div className="row wrap left">
                {isMayor && <button className="btn" onClick={() => { setInfo(null); openCustomize("hall"); }}>🎨 Propor nova pintura</button>}
                {proposal && <button className="btn" onClick={() => { setInfo(null); setStep({ name: "proposal" }); }}>📜 Ver votação</button>}
              </div>
            </>
          )}
          {info.kind === "free" && (
            <>
              <h3>Lote disponível</h3>
              {!me && (
                <>
                  <p>Esse lote está livre. Tem um código? Resgate sua casinha!</p>
                  <button className="btn primary" onClick={() => { setInfo(null); setStep({ name: "code" }); }}>Resgatar casinha</button>
                </>
              )}
              {livesElsewhere && (
                <>
                  <p>Quer morar aqui? Traga sua casa com o caminhão de mudança.</p>
                  <button className="btn primary" onClick={startMove}>🚚 Mudar pra cá</button>
                </>
              )}
              {livesHere && <p>Esse lote está livre para um novo vizinho.</p>}
            </>
          )}
        </div>
      )}

      {/* ---------- código de resgate */}
      {step.name === "code" && (
        <div className="modal-bg" onClick={() => setStep({ name: "idle" })}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitCode}>
            <h2>Resgatar casinha em {city.name}</h2>
            <p>
              Digite o código que você recebeu por DM{INSTAGRAM_PROFILE ? <> do <b>@{INSTAGRAM_PROFILE}</b></> : null}. Atenção: você vai
              morar em <b>{city.name}</b>. Para trocar depois, só com o caminhão de mudança.
            </p>
            <input autoFocus value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="NDC-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
            {step.error && <p className="error">{step.error}</p>}
            <div className="row">
              <button type="button" className="btn" onClick={() => setStep({ name: "idle" })}>Cancelar</button>
              <button className="btn primary" disabled={step.busy || codeInput.trim().length < 4}>{step.busy ? "Conferindo…" : "Continuar"}</button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- entrar */}
      {step.name === "login" && (
        <div className="modal-bg" onClick={() => setStep({ name: "idle" })}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitLogin}>
            <h2>Entrar</h2>
            <p>Digite o mesmo código que você usou para resgatar sua casinha.</p>
            <input autoFocus value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="NDC-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
            {step.error && <p className="error">{step.error}</p>}
            <div className="row">
              <button type="button" className="btn" onClick={() => setStep({ name: "idle" })}>Cancelar</button>
              <button className="btn primary" disabled={step.busy || codeInput.trim().length < 4}>{step.busy ? "Entrando…" : "Entrar"}</button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- tipo de construção */}
      {step.name === "type" && (
        <div className="modal-bg">
          <div className="modal">
            <h2>{step.purpose === "move" ? "🚚 Mudança" : `Olá, @${step.handle}! 👋`}</h2>
            <p>{step.purpose === "move" ? `O que você quer construir em ${city.name}? Pode trocar o tipo!` : "O que você quer construir?"}</p>
            <div className="types">
              {BUILDING_TYPES.map((b) => (
                <button key={b.id} className="btn type" onClick={() => setStep({ name: "lot", purpose: step.purpose, code: step.code, handle: step.handle, type: b.id, lot: null })}>
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

      {/* ---------- escolher lote */}
      {step.name === "lot" && (
        <div className="sheet">
          <h3>{step.purpose === "move" ? "🚚 Escolha o lote da mudança" : "Escolha seu lote"}</h3>
          <p>{step.lot == null ? "Toque num lote amarelo no mapa (arraste e dê zoom para achar um lugar legal)." : "Lote escolhido (marcado em verde)! Confirme para construir."}</p>
          {step.purpose === "move" && <p className="muted">Isso usa 1 caminhão de mudança. Sua casa sai da cidade antiga.</p>}
          {step.error && <p className="error">{step.error}</p>}
          <div className="row wrap">
            <button className="btn" disabled={step.busy} onClick={() => setStep({ name: "type", purpose: step.purpose, code: step.code, handle: step.handle })}>← Voltar</button>
            <button className="btn" onClick={pickRandom} disabled={step.busy}>🎲 Escolher pra mim</button>
            <button className="btn primary" onClick={confirmLot} disabled={step.lot == null || step.busy}>{step.busy ? "Construindo…" : "Confirmar"}</button>
          </div>
        </div>
      )}

      {/* ---------- pronto */}
      {step.name === "done" && (
        <div className="modal-bg" onClick={() => setStep({ name: "idle" })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {step.isMayor ? (
              <>
                <h2>🏛 Você é o(a) prefeito(a)!</h2>
                <p>Você é a primeira pessoa a morar em {city.name}. A prefeitura agora leva o seu @, e a cidade está liberada para todo mundo.</p>
              </>
            ) : (
              <>
                <h2>{step.moved ? "🚚 Mudança feita!" : "🎉 Casinha pronta!"}</h2>
                <p>Bem-vindo(a) a {city.name}! Sua casa já está no mapa.</p>
              </>
            )}
            <div className="row">
              <button className="btn primary" onClick={() => setStep({ name: "idle" })}>Ver minha casinha</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- menu do morador */}
      {step.name === "menu" && me && (
        <div className="sheet">
          <button className="close" onClick={() => setStep({ name: "idle" })} aria-label="Fechar">✕</button>
          <h3>@{me.handle}{isMayor ? " · 🏛 Prefeito(a)" : ""}</h3>
          <div className="menu">
            {myHouse && <button className="btn" onClick={() => { setFocusLot(null); setTimeout(() => setFocusLot(myHouse.lotIndex)); setStep({ name: "idle" }); }}>📍 Ver minha casa</button>}
            <button className="btn" onClick={openChat}>💬 Chat {me.perks.chatUntil ? "" : "🔒"}</button>
            <button className="btn" onClick={() => openCustomize("house")}>🎨 Pintar minha casa {me.perks.customize ? "" : "🔒"}</button>
            {isMayor && <button className="btn" onClick={() => openCustomize("hall")}>🏛 Propor pintura da prefeitura {me.perks.customize ? "" : "🔒"}</button>}
            {myElections.length > 0 && <button className="btn" onClick={() => setStep({ name: "elections" })}>🗳 Eleições ({myElections.length})</button>}
            {proposal && <button className="btn" onClick={() => setStep({ name: "proposal" })}>📜 Votação da prefeitura</button>}
            <Link className="btn" href="/">🚚 Mudar de cidade{me.perks.moveCredits ? ` (${me.perks.moveCredits})` : " 🔒"}</Link>
            <button className="btn" onClick={logout}>Sair</button>
          </div>
          {me.perks.chatUntil && <p className="muted">Chat liberado até {new Date(me.perks.chatUntil).toLocaleDateString("pt-BR")}.</p>}
        </div>
      )}

      {/* ---------- chat */}
      {step.name === "chat" && me && <ChatPanel slug={slug} cityName={city.name} me={me.handle} mayor={city.mayorHandle} onClose={() => setStep({ name: "idle" })} />}

      {/* ---------- personalizar */}
      {step.name === "customize" && (
        <div className="sheet tall">
          <h3>{step.target === "hall" ? "🏛 Proposta para a prefeitura" : "🎨 Pintar minha casa"}</h3>
          {step.target === "hall" && <p className="muted">Você escolhe; os moradores votam sim ou não (24h). Mais da metade decide.</p>}
          <div className="palette-row">
            <span>Modelos prontos</span>
            <div className="presets">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="btn tiny preset"
                  onClick={() =>
                    setStep({
                      ...step,
                      style: step.target === "hall" ? { ...step.style, wall: p.style.wall, accent: p.style.accent } : { ...step.style, ...p.style },
                    })
                  }
                >
                  <span className="dots">
                    <i style={{ background: p.style.wall }} />
                    <i style={{ background: step.target === "hall" ? p.style.accent : p.style.roof }} />
                    <i style={{ background: step.target === "hall" ? p.style.wall : p.style.accent }} />
                  </span>
                  {p.emoji} {p.name}
                </button>
              ))}
            </div>
          </div>
          {STYLE_PARTS.filter((part) => step.target === "house" || part.key !== "roof").map((part) => (
            <div key={part.key} className="palette-row">
              <span>{step.target === "hall" ? part.hallLabel : part.label}</span>
              <div className="palette">
                <button className={`swatch none ${!step.style[part.key] ? "on" : ""}`} aria-label="Original" onClick={() => setStep({ ...step, style: { ...step.style, [part.key]: undefined } })}>↺</button>
                {PALETTE.map((c) => (
                  <button key={c} className={`swatch ${step.style[part.key] === c ? "on" : ""}`} style={{ background: c }} aria-label={c} onClick={() => setStep({ ...step, style: { ...step.style, [part.key]: c } })} />
                ))}
              </div>
            </div>
          ))}
          <div className="palette-row">
            <span>Bandeira</span>
            <FlagEditor value={step.style.flag} defaultUf={city.uf} onChange={(flag) => setStep({ ...step, style: { ...step.style, flag } })} />
          </div>
          {step.error && <p className="error">{step.error}</p>}
          <div className="row">
            <button className="btn" onClick={() => setStep({ name: "idle" })} disabled={step.busy}>Cancelar</button>
            <button className="btn primary" onClick={saveStyle} disabled={step.busy}>
              {step.busy ? "Enviando…" : step.target === "hall" ? "Propor aos moradores" : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* ---------- votação da prefeitura */}
      {step.name === "proposal" && (
        <div className="sheet">
          <button className="close" onClick={() => setStep({ name: "idle" })} aria-label="Fechar">✕</button>
          {proposal ? (
            <>
              <h3>📜 Nova pintura da prefeitura</h3>
              <p>
                O(a) prefeito(a) <b>@{proposal.proposer}</b> propôs a pintura que aparece agora no mapa. Mais da metade dos {proposal.residents}{" "}
                moradores precisa aprovar.
              </p>
              <p>
                👍 {proposal.yes} · 👎 {proposal.no} · termina {new Date(proposal.endsAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
              {step.error && <p className="error">{step.error}</p>}
              {proposal.canVote ? (
                <div className="row">
                  <button className={`btn ${proposal.myVote === false ? "primary" : ""}`} disabled={step.busy} onClick={() => voteProposal(false)}>👎 Não</button>
                  <button className={`btn ${proposal.myVote === true ? "primary" : ""}`} disabled={step.busy} onClick={() => voteProposal(true)}>👍 Sim</button>
                </div>
              ) : (
                <p className="muted">Só moradores de {city.name} votam.</p>
              )}
            </>
          ) : (
            <p>Nenhuma votação aberta.</p>
          )}
        </div>
      )}

      {/* ---------- eleições */}
      {step.name === "elections" && (
        <div className="sheet tall">
          <button className="close" onClick={() => setStep({ name: "idle" })} aria-label="Fechar">✕</button>
          <h3>🗳 Eleições</h3>
          {(civic?.elections ?? []).filter((e) => e.status === "open").map((e) => (
            <ElectionCard
              key={e.id}
              election={e}
              onChange={(ne) => setCivic((c) => (c ? { ...c, elections: c.elections.map((x) => (x.id === ne.id ? ne : x)) } : c))}
            />
          ))}
        </div>
      )}

      {step.name === "notice" && (
        <div className="modal-bg" onClick={() => setStep({ name: "idle" })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{step.title}</h2>
            <p>{step.text}</p>
            <div className="row"><button className="btn primary" onClick={() => setStep({ name: "idle" })}>OK</button></div>
          </div>
        </div>
      )}

      {/* ---------- recurso pago */}
      {step.name === "paywall" && (
        <div className="modal-bg" onClick={() => setStep({ name: "idle" })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>✨ {PRODUCTS[step.product].label}</h2>
            <p>{PRODUCTS[step.product].description}</p>
            <p className="price">{formatPrice(PRODUCTS[step.product].priceCents)}{step.product === "chat_mensal" ? " / mês" : ""}</p>
            {step.message && <p className="ok">{step.message}</p>}
            <div className="row">
              <button className="btn" onClick={() => setStep({ name: "idle" })}>Agora não</button>
              {!step.message && <button className="btn primary" disabled={step.busy} onClick={() => buy(step.product)}>Quero!</button>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
