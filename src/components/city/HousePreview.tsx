"use client";

import { useEffect, useRef } from "react";
import type { BuildingType } from "@/lib/buildings";
import { type Style, styleKey } from "@/lib/styles";

/** Imagem da construção desenhada pelo motor do mapa (ver CityScene.renderPreview). */
export type PreviewImage = { canvas: HTMLCanvasElement; width: number; height: number; oy: number; tiles: number };
export type PreviewRenderer = (opts: { type: BuildingType; variant: number; style: Style | null; hall: boolean }) => PreviewImage | null;

/**
 * Prévia ampliada da casa (ou da prefeitura) com as cores escolhidas.
 *
 * Importante: NÃO cria um segundo motor de desenho (Pixi). Quem desenha é o
 * próprio mapa; aqui só copiamos a imagem para um canvas comum, ampliando sem
 * borrar. (Dois motores ao mesmo tempo quebravam o mapa ao fechar o painel.)
 */
export default function HousePreview({
  render,
  type,
  variant,
  style,
  hall = false,
}: {
  render: PreviewRenderer | null;
  type: BuildingType;
  variant: number;
  style: Style | null;
  hall?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = 220;
  const H = 230;
  const key = styleKey(style);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const draw = () => {
      const img = render?.({ type, variant, style, hall });
      if (!img) {
        // o mapa ainda está carregando: tenta de novo daqui a pouco
        if (tries++ < 20) timer = setTimeout(draw, 150);
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = false;
      const scale = Math.floor(Math.min((W - 10) / img.width, (H - 10) / img.height) * 2) / 2;
      const x = Math.round((W - img.width * scale) / 2);
      const y = Math.round((H - img.height * scale) / 2);
      // chão do lote
      const n = img.tiles;
      const gy = y + img.oy * scale;
      const diamond = (inset: number, color: string) => {
        ctx.beginPath();
        ctx.moveTo(x + n * 16 * scale, gy + inset);
        ctx.lineTo(x + n * 32 * scale - inset * 2, gy + n * 8 * scale);
        ctx.lineTo(x + n * 16 * scale, gy + n * 16 * scale - inset);
        ctx.lineTo(x + inset * 2, gy + n * 8 * scale);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      };
      diamond(0, hall ? "#d8cdb3" : "#79b85a");
      diamond(scale, hall ? "#e2d8c0" : "#86c264");
      ctx.drawImage(img.canvas, x, y, img.width * scale, img.height * scale);
    };
    draw();
    return () => {
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render, type, variant, key, hall]);

  return (
    <div className="house-preview" aria-label="Prévia da construção">
      <canvas ref={ref} style={{ width: W, height: H }} />
    </div>
  );
}
