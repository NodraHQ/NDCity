"use client";

import { type RefObject, useEffect, useMemo, useRef } from "react";
import { generateCity } from "@/lib/city/generate";
import type { PreviewRenderer } from "./HousePreview";
import { CityScene, type SceneCallbacks, type SceneState } from "./scene";

type Props = SceneState &
  SceneCallbacks & {
    seed: string;
    size: number;
    zoomRef?: RefObject<((f: number) => void) | null>;
    previewRef?: RefObject<PreviewRenderer | null>;
  };

/** O mapa da cidade (PixiJS) dentro de um componente React. */
export default function CityCanvas(props: Props) {
  const { seed, size, zoomRef, previewRef, onLotTap, onCityHallTap, onEmptyTap, ...state } = props;
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CityScene | null>(null);
  const layout = useMemo(() => generateCity(seed, size), [seed, size]);

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
      if (previewRef) previewRef.current = (o) => s.renderPreview(o);
    });
    return () => {
      cancelled = true;
      if (previewRef) previewRef.current = null;
      created?.destroy();
      scene.current = null;
    };
  }, [layout, zoomRef, previewRef]);

  const { houses, mayorHandle, hallStyle, darkness, mode, pickedLot, ghostType, focusLot } = state;
  useEffect(() => {
    scene.current?.update({ houses, mayorHandle, hallStyle, darkness, mode, pickedLot, ghostType, focusLot });
  }, [houses, mayorHandle, hallStyle, darkness, mode, pickedLot, ghostType, focusLot]);

  return <div ref={host} className="city-canvas" />;
}
