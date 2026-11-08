"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SITE_NAME } from "@/config/site";
import { findCity, searchCities } from "@/lib/geo/cities";
import { localTime } from "@/lib/sun";
import ElectionCard, { type ElectionV, officeTitle } from "../ElectionCard";
import LoginDialog, { type LoginResult } from "../LoginDialog";
import Tracker from "../Tracker";
import type { ActiveInfo } from "./scene";

const WorldCanvas = dynamic(() => import("./WorldCanvas"), {
  ssr: false,
  loading: () => <div className="city-loading">Desenhando o Brasil…</div>,
});

type Me = { handle: string; citySlug: string | null } | null;

export default function WorldView({ initialActive }: { initialActive: ActiveInfo[] }) {
  const [active, setActive] = useState(initialActive);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [query, setQuery] = useState("");
  const [me, setMe] = useState<Me>(null);
  const zoomRef = useRef<((f: number) => void) | null>(null);
  const [offices, setOffices] = useState<{ president: string | null; governors: Record<string, string> } | null>(null);
  const [elections, setElections] = useState<ElectionV[]>([]);
  const [showElections, setShowElections] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  function onLogin(r: LoginResult) {
    window.location.href = `/c/${r.citySlug}${r.hasPassword ? "" : "?senha=1"}`;
  }

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((j) => setMe(j.resident))
      .catch(() => {});
    fetch("/api/civic")
      .then((r) => r.json())
      .then((j) => {
        setOffices(j.offices);
        setElections(j.elections ?? []);
      })
      .catch(() => {});
    const id = setInterval(async () => {
      const r = await fetch("/api/cities", { cache: "no-store" });
      if (r.ok) setActive((await r.json()).cities);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const results = useMemo(() => searchCities(query), [query]);
  const activeMap = useMemo(() => new Map(active.map((a) => [a.slug, a])), [active]);
  const totalHouses = active.reduce((n, a) => n + a.houses, 0);
  const city = selected ? findCity(selected) : null;
  const info = selected ? activeMap.get(selected) : undefined;
  const myCity = me?.citySlug ? findCity(me.citySlug) : null;
  const myElections = elections.filter((e) => e.status === "open" && e.canParticipate);
  const governor = city ? (offices?.governors[city.uf] ?? null) : null;

  function choose(slug: string) {
    setSelected(slug);
    setFocusKey((k) => k + 1);
    setQuery("");
  }

  return (
    <main className="city-page">
      <Tracker path="/" />
      <WorldCanvas active={active} selected={selected} focusKey={focusKey} onCityTap={setSelected} zoomRef={zoomRef} />

      <header className="topbar world">
        <div className="title">
          <strong>{SITE_NAME} · Brasil</strong>
          <span>
            {active.length} cidade{active.length === 1 ? "" : "s"} com moradores · {totalHouses} casinha{totalHouses === 1 ? "" : "s"}
          </span>
        </div>
        <div className="search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Buscar cidade…"
            autoComplete="off"
            spellCheck={false}
          />
          {results.length > 0 && (
            <ul className="results">
              {results.map((c) => (
                <li key={c.slug}>
                  <button onClick={() => choose(c.slug)}>
                    {c.name} <small>{c.uf}</small>
                    {activeMap.has(c.slug) && <em> · {activeMap.get(c.slug)!.houses}🏠</em>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {offices?.president && (
        <div className="authorities">
          <div className="authority">🇧🇷 Presidente<br /><b>@{offices.president}</b></div>
        </div>
      )}

      {!selected && myElections.length > 0 && !showElections && (
        <button className="banner vote" onClick={() => setShowElections(true)}>
          🗳 Eleição aberta: {officeTitle(myElections[0])}. <b>Toque para participar!</b>
        </button>
      )}
      {showElections && (
        <div className="sheet tall">
          <button className="close" onClick={() => setShowElections(false)} aria-label="Fechar">✕</button>
          <h3>🗳 Eleições</h3>
          {elections.filter((e) => e.status === "open").map((e) => (
            <ElectionCard key={e.id} election={e} onChange={(ne) => setElections((l) => l.map((x) => (x.id === ne.id ? ne : x)))} />
          ))}
        </div>
      )}

      {!me && !selected && !showElections && (
        <button className="btn my-city" onClick={() => setShowLogin(true)}>🔑 Entrar</button>
      )}
      {showLogin && <LoginDialog onClose={() => setShowLogin(false)} onSuccess={onLogin} />}

      {myCity && !selected && !showElections && (
        <Link className="btn primary my-city" href={`/c/${myCity.slug}`}>
          🏠 Minha cidade: {myCity.name}
        </Link>
      )}

      <div className="zoom">
        <button className="btn" aria-label="Aproximar" onClick={() => zoomRef.current?.(1.6)}>+</button>
        <button className="btn" aria-label="Afastar" onClick={() => zoomRef.current?.(1 / 1.6)}>−</button>
      </div>

      {city && (
        <div className="sheet">
          <button className="close" onClick={() => setSelected(null)} aria-label="Fechar">✕</button>
          <h3>
            {city.name} <small>· {city.uf}</small>
          </h3>
          <p className="muted">🕒 {localTime(city.timezone)} agora</p>
          {info ? (
            <p>
              🏛 Prefeito(a): <b>@{info.mayorHandle}</b>
              <br />
              🏠 {info.houses} casinha{info.houses === 1 ? "" : "s"}
            </p>
          ) : (
            <p>🔒 Ninguém mora aqui ainda. Quem resgatar a primeira casinha vira <b>prefeito</b> e libera a cidade!</p>
          )}
          {governor && <p className="muted">Governador(a) de {city.uf}: <b>@{governor}</b></p>}
          <div className="row">
            <Link className="btn primary" href={`/c/${city.slug}`}>Visitar {city.name} →</Link>
          </div>
        </div>
      )}
    </main>
  );
}
