"use client";

import { type RefObject, useEffect, useMemo, useRef } from "react";
import { generateCity } from "@/lib/city/generate";
import { CityScene, type SceneCallbacks, type SceneState } from "./scene";

type Props = SceneState & SceneCallbacks & { seed: string; zoomRef?: RefObject<((f: number) => void) | null> };

/** O mapa da cidade (PixiJS) dentro de um componente React. */
export default function CityCanvas(props: Props) {
  const { seed, zoomRef, onLotTap, onCityHallTap, onEmptyTap, ...state } = props;
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CityScene | null>(null);
  const layout = useMemo(() => generateCity(seed), [seed]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const cbRef = useRef<SceneCallbacks>({ onLotTap, onCityHallTap, onEmptyTap });
  cbRef.current = { onLotTap, onCityHallTap, onEmptyTap };

  useEffect(() => {
    if (!host.current) return;
    let cancelled = false;
    let created: CityScene | null = null;
    const callbacks: SceneCallbacks = {
      onLotTap: (i, o) => cbRef.current.onLotTap(i, o),
      onCityHallTap: () => cbRef.current.onCityHallTap(),
      onEmptyTap: () => cbRef.current.onEmptyTap(),
    };
    CityScene.create(host.current, layout, callbacks).then((s) => {
      if (cancelled) return s.destroy();
      created = s;
      scene.current = s;
      s.update(stateRef.current);
      if (zoomRef) zoomRef.current = (f) => s.zoomBy(f);
    });
    return () => {
      cancelled = true;
      created?.destroy();
      scene.current = null;
    };
  }, [layout, zoomRef]);

  const { houses, mayorHandle, mode, pickedLot, ghostType, focusLot } = state;
  useEffect(() => {
    scene.current?.update({ houses, mayorHandle, mode, pickedLot, ghostType, focusLot });
  }, [houses, mayorHandle, mode, pickedLot, ghostType, focusLot]);

  return <div ref={host} className="city-canvas" />;
}
