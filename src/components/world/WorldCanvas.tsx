"use client";

import { type RefObject, useEffect, useRef } from "react";
import { allCities } from "@/lib/geo/cities";
import { type ActiveInfo, WorldScene } from "./scene";

type Props = {
  active: ActiveInfo[];
  selected: string | null;
  focusKey: number;
  onCityTap: (slug: string | null) => void;
  zoomRef: RefObject<((f: number) => void) | null>;
};

export default function WorldCanvas({ active, selected, focusKey, onCityTap, zoomRef }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<WorldScene | null>(null);
  const tapRef = useRef(onCityTap);
  tapRef.current = onCityTap;
  const initial = useRef({ active, selected });
  initial.current = { active, selected };

  useEffect(() => {
    if (!host.current) return;
    let cancelled = false;
    let created: WorldScene | null = null;
    WorldScene.create(host.current, allCities(), { onCityTap: (s) => tapRef.current(s) }).then((s) => {
      if (cancelled) return s.destroy();
      created = s;
      scene.current = s;
      s.setActive(initial.current.active);
      s.select(initial.current.selected);
      zoomRef.current = (f) => s.zoomBy(f);
    });
    return () => {
      cancelled = true;
      created?.destroy();
      scene.current = null;
    };
  }, [zoomRef]);

  useEffect(() => {
    scene.current?.setActive(active);
  }, [active]);
  useEffect(() => {
    scene.current?.select(selected, focusKey > 0);
  }, [selected, focusKey]);

  return <div ref={host} className="city-canvas" />;
}
