"use client";

import { Application, Container, Graphics, Rectangle, Sprite, Texture, TextureStyle } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import type { BuildingType } from "@/lib/buildings";
import { type Style, styleKey } from "@/lib/styles";
import { drawBuilding, drawCityHall } from "./art";

/**
 * Prévia ampliada da casa (ou da prefeitura) com as cores escolhidas,
 * desenhada com a mesma pixel art do mapa.
 */
export default function HousePreview({
  type,
  variant,
  style,
  hall = false,
}: {
  type: BuildingType;
  variant: number;
  style: Style | null;
  hall?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const texRef = useRef<Texture | null>(null);
  const [ready, setReady] = useState(false);
  const W = 220;
  const H = 230;

  useEffect(() => {
    let destroyed = false;
    TextureStyle.defaultOptions.scaleMode = "nearest";
    const app = new Application();
    app
      .init({ width: W, height: H, backgroundAlpha: 0, antialias: false, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true })
      .then(() => {
        if (destroyed) return app.destroy(true);
        host.current?.appendChild(app.canvas);
        appRef.current = app;
        setReady(true);
      });
    return () => {
      destroyed = true;
      texRef.current?.destroy(true);
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
    };
  }, []);

  const key = styleKey(style);
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    app.stage.removeChildren().forEach((c) => c.destroy({ children: true }));
    texRef.current?.destroy(true);

    const d = hall ? drawCityHall(style) : drawBuilding(type, variant, style);
    const n = hall ? 2 : 1;
    const tex = app.renderer.generateTexture({
      target: d.g,
      frame: new Rectangle(0, 0, d.width, d.height),
      resolution: 1,
      antialias: false,
      textureSourceOptions: { scaleMode: "nearest" },
    });
    d.g.destroy();
    texRef.current = tex;

    // chão do lote embaixo da construção
    const ground = new Graphics();
    const y = d.oy;
    ground
      .poly([n * 16, y, n * 32, y + n * 8, n * 16, y + n * 16, 0, y + n * 8])
      .fill(hall ? 0xd8cdb3 : 0x79b85a)
      .poly([n * 16, y + 1, n * 32 - 2, y + n * 8, n * 16, y + n * 16 - 1, 2, y + n * 8])
      .fill(hall ? 0xe2d8c0 : 0x86c264);

    const group = new Container();
    group.addChild(ground, new Sprite(tex));
    const scale = Math.floor(Math.min((W - 10) / d.width, (H - 10) / d.height) * 2) / 2;
    group.scale.set(scale);
    group.x = Math.round((W - d.width * scale) / 2);
    group.y = Math.round((H - d.height * scale) / 2);
    app.stage.addChild(group);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, type, variant, key, hall]);

  return <div ref={host} className="house-preview" aria-label="Prévia da construção" />;
}
