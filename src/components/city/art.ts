import { Graphics } from "pixi.js";
import type { BuildingType } from "@/lib/buildings";
import type { CityLayout, Decoration, TileKind } from "@/lib/city/generate";
import { createRng } from "@/lib/city/rng";
import { FLAG_H, FLAG_W, type Style, flagColors, hexToNum } from "@/lib/styles";

/**
 * Desenhos em pixel art feitos 100% por código (formas simples), sem
 * imagens de terceiros. Cada desenho vira uma textura pequena que é
 * ampliada sem suavizar, o que dá o visual "pixelado".
 *
 * Sistema de coordenadas: (r, c) = linha/coluna do mapa, z = altura em
 * pixels. Um tile tem 32x16 pixels na tela.
 */
export const TW = 32;
export const TH = 16;

type P3 = [number, number, number];

export function shade(color: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((color & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

/** Ajuda a desenhar em projeção isométrica dentro de uma textura. */
export class Iso {
  constructor(
    public g: Graphics,
    public n: number, // tamanho do terreno em tiles
    public head: number, // espaço acima do chão (altura máx. do desenho)
  ) {}
  get width() {
    return this.n * TW;
  }
  get height() {
    return this.n * TH + this.head;
  }
  pt([r, c, z]: P3): [number, number] {
    return [Math.round((c - r) * (TW / 2) + this.n * (TW / 2)), Math.round((c + r) * (TH / 2) + this.head - z)];
  }
  poly(pts: P3[], color: number, alpha = 1) {
    this.g.poly(pts.flatMap((p) => this.pt(p))).fill({ color, alpha });
  }
  px(p: P3, color: number, w = 1, h = 1) {
    const [x, y] = this.pt(p);
    this.g.rect(x, y, w, h).fill(color);
  }
  /** Caixa (paredes + teto) com as duas faces da frente visíveis. */
  box(r0: number, c0: number, r1: number, c1: number, z0: number, z1: number, color: number, top?: number) {
    this.poly([[r1, c0, z0], [r1, c1, z0], [r1, c1, z1], [r1, c0, z1]], shade(color, 0.9)); // face esquerda
    this.poly([[r0, c1, z0], [r1, c1, z0], [r1, c1, z1], [r0, c1, z1]], shade(color, 0.72)); // face direita
    this.poly([[r0, c0, z1], [r0, c1, z1], [r1, c1, z1], [r1, c0, z1]], top ?? shade(color, 1.12));
  }
  /** Retângulo na face esquerda (r fixo): u = posição em c, z = altura. */
  leftRect(r: number, u0: number, u1: number, z0: number, z1: number, color: number) {
    this.poly([[r, u0, z0], [r, u1, z0], [r, u1, z1], [r, u0, z1]], color);
  }
  /** Retângulo na face direita (c fixo): u = posição em r. */
  rightRect(c: number, u0: number, u1: number, z0: number, z1: number, color: number) {
    this.poly([[u0, c, z0], [u1, c, z0], [u1, c, z1], [u0, c, z1]], color);
  }
  /** Telhado de duas águas com a cumeeira no sentido de c. */
  gableRoof(r0: number, c0: number, r1: number, c1: number, z: number, rise: number, color: number) {
    const rm = (r0 + r1) / 2;
    this.poly([[r0, c0, z], [r0, c1, z], [rm, c1, z + rise], [rm, c0, z + rise]], shade(color, 0.8));
    this.poly([[r0, c1, z], [r1, c1, z], [rm, c1, z + rise]], shade(color, 0.62));
    this.poly([[r1, c0, z], [r1, c1, z], [rm, c1, z + rise], [rm, c0, z + rise]], color);
  }
}

// ---------------------------------------------------------------- chão

const GROUND: Record<TileKind, number> = {
  grass: 0x5fae4e,
  park: 0x4f9f44,
  lot: 0x79b85a,
  plaza: 0xd8cdb3,
  road: 0x54575e,
  water: 0x3a8bd4,
  sand: 0xe4d197,
};

/** Desenha o chão inteiro da cidade numa só imagem. */
export function drawGround(layout: CityLayout): { g: Graphics; ox: number; width: number; height: number } {
  const g = new Graphics();
  const ox = layout.height * (TW / 2);
  const width = (layout.width + layout.height) * (TW / 2);
  const height = (layout.width + layout.height) * (TH / 2);
  const rng = createRng(`${layout.seed}#ground`);
  const kind = (r: number, c: number): TileKind | null =>
    r < 0 || c < 0 || r >= layout.height || c >= layout.width ? null : layout.tiles[r][c];

  const P = (r: number, c: number): [number, number] => [
    Math.round((c - r) * (TW / 2) + ox),
    Math.round((c + r) * (TH / 2)),
  ];
  const quad = (r0: number, c0: number, r1: number, c1: number, color: number) => {
    g.poly([...P(r0, c0), ...P(r0, c1), ...P(r1, c1), ...P(r1, c0)]).fill(color);
  };
  const dot = (r: number, c: number, color: number, w = 1) => {
    const [x, y] = P(r, c);
    g.rect(x, y, w, 1).fill(color);
  };

  for (let r = 0; r < layout.height; r++) {
    for (let c = 0; c < layout.width; c++) {
      const k = layout.tiles[r][c];
      const base = GROUND[k];
      quad(r, c, r + 1, c + 1, base);

      if (k === "grass" || k === "park" || k === "lot") {
        for (let i = 0; i < 6; i++) {
          dot(r + 0.1 + rng.next() * 0.8, c + 0.1 + rng.next() * 0.8, shade(base, rng.chance(0.5) ? 0.86 : 1.14));
        }
        if (k === "lot") {
          // cerquinha de terra em volta do lote
          quad(r + 0.08, c + 0.08, r + 0.92, c + 0.92, shade(base, 1.05));
        }
      } else if (k === "water") {
        if (rng.chance(0.5)) dot(r + 0.3 + rng.next() * 0.4, c + 0.2 + rng.next() * 0.6, 0x7fbaf0, 3);
      } else if (k === "sand") {
        for (let i = 0; i < 3; i++) dot(r + rng.next(), c + rng.next(), 0xcdb878);
      } else if (k === "plaza") {
        // ladrilhos
        quad(r + 0.48, c, r + 0.52, c + 1, shade(base, 0.9));
        quad(r, c + 0.48, r + 1, c + 0.52, shade(base, 0.9));
      } else if (k === "road") {
        const up = kind(r - 1, c) === "road";
        const down = kind(r + 1, c) === "road";
        const left = kind(r, c - 1) === "road";
        const right = kind(r, c + 1) === "road";
        const sw = 0xb8b2a6;
        const e = 0.14;
        // calçadas onde a rua encosta em outra coisa
        if (!up) quad(r, c, r + e, c + 1, sw);
        if (!down) quad(r + 1 - e, c, r + 1, c + 1, sw);
        if (!left) quad(r, c, r + 1, c + e, sw);
        if (!right) quad(r, c + 1 - e, r + 1, c + 1, sw);
        const horizontal = left || right;
        const vertical = up || down;
        const cross = horizontal && vertical && (up ? 1 : 0) + (down ? 1 : 0) + (left ? 1 : 0) + (right ? 1 : 0) >= 3;
        if (cross) {
          // faixa de pedestre
          for (let i = 0; i < 4; i++) {
            const t = 0.2 + i * 0.18;
            if (up) quad(r + 0.02, c + t, r + 0.12, c + t + 0.08, 0xe8e8e8);
            if (down) quad(r + 0.88, c + t, r + 0.98, c + t + 0.08, 0xe8e8e8);
          }
        } else if (horizontal) {
          quad(r + 0.47, c + 0.15, r + 0.53, c + 0.45, 0xf0d25a);
          quad(r + 0.47, c + 0.6, r + 0.53, c + 0.9, 0xf0d25a);
        } else if (vertical) {
          quad(r + 0.15, c + 0.47, r + 0.45, c + 0.53, 0xf0d25a);
          quad(r + 0.6, c + 0.47, r + 0.9, c + 0.53, 0xf0d25a);
        }
      }
    }
  }
  return { g, ox, width, height };
}

// ---------------------------------------------------------- construções

const WALLS = {
  casa: [0xf1e3c6, 0xf4c7a1, 0xbfe0f2, 0xf6e27f, 0xd9f0c4],
  predio: [0x9fb4c8, 0xc8b8a6, 0xa8c4b0, 0xd2c6d8, 0xb7bcc4],
  oficina: [0x8b9bb0, 0xa59a8a, 0x8ea89a, 0x9a9aa8, 0xb0a28a],
  padaria: [0xf5d9a0, 0xf7e7c5, 0xf3caa0, 0xeedab0, 0xfae4b5],
  cabare: [0x6b2e7a, 0x8a1f4f, 0x3b2a6b, 0x7a2550, 0x502a7a],
};
const ROOFS = [0xc0483a, 0x8a4b32, 0x3f6fa8, 0x5a7d3a, 0x9c3a60];

const WINDOW = 0x2f4a6b;
const WINDOW_LIT = 0xffe27a;

export type Drawing = { g: Graphics; width: number; height: number; ox: number; oy: number };

function finish(iso: Iso): Drawing {
  return { g: iso.g, width: iso.width, height: iso.height, ox: iso.n * (TW / 2), oy: iso.head };
}

/** Pinta uma bandeira (12x8) em pixels. step=2 desenha em tamanho pequeno (6x4). */
function paintFlag(g: Graphics, x: number, y: number, flag: string, step = 1) {
  const colors = flagColors(flag);
  for (let fy = 0; fy < FLAG_H; fy += step)
    for (let fx = 0; fx < FLAG_W; fx += step) g.rect(x + fx / step, y + fy / step, 1, 1).fill(colors[fy * FLAG_W + fx]);
}

/** Mastro com bandeira pequena ao lado da construção. */
function houseFlag(iso: Iso, flag: string, top: number) {
  const [x, y] = iso.pt([0.1, 0.94, 0]);
  iso.g.rect(x, y - top, 1, top).fill(0x55555a);
  paintFlag(iso.g, x - FLAG_W / 2, y - top, flag, 2);
}

export function drawBuilding(type: BuildingType, variant: number, style?: Style | null): Drawing {
  const d = drawBuildingBody(type, variant, style);
  if (style?.flag) {
    const iso = d.iso;
    houseFlag(iso, style.flag, Math.min(iso.head - 2, type === "predio" ? 22 : 18));
  }
  return finish(d.iso);
}

function drawBuildingBody(type: BuildingType, variant: number, style?: Style | null): { iso: Iso } {
  const v = Math.abs(variant) % 5;
  const wall = hexToNum(style?.wall, WALLS[type][v]);
  const roof = hexToNum(style?.roof, ROOFS[v]);
  const accent = (fallback: number) => hexToNum(style?.accent, fallback);
  switch (type) {
    case "casa": {
      const iso = new Iso(new Graphics(), 1, 22);
      const [a, b] = [0.2, 0.8];
      iso.box(a, a, b, b, 0, 9, wall);
      iso.leftRect(b, 0.32, 0.46, 0, 6, accent(0x7a4a2a)); // porta
      iso.leftRect(b, 0.56, 0.72, 3, 7, WINDOW);
      iso.rightRect(b, 0.3, 0.46, 3, 7, WINDOW);
      iso.rightRect(b, 0.56, 0.7, 3, 7, WINDOW);
      iso.gableRoof(a - 0.05, a - 0.05, b + 0.05, b + 0.05, 9, 8, roof);
      return { iso };
    }
    case "predio": {
      const iso = new Iso(new Graphics(), 1, 46);
      const [a, b] = [0.14, 0.86];
      const h = 36 + (v % 3) * 2;
      iso.box(a, a, b, b, 0, h, wall, style?.roof ? roof : shade(wall, 0.8));
      for (let z = 5; z < h - 4; z += 6) {
        for (const u of [0.24, 0.44, 0.64]) {
          const lit = (z * 7 + u * 100 + v) % 5 < 1;
          iso.leftRect(b, u, u + 0.12, z, z + 3, lit ? WINDOW_LIT : WINDOW);
          iso.rightRect(b, u, u + 0.12, z, z + 3, lit ? WINDOW_LIT : WINDOW);
        }
      }
      iso.leftRect(b, 0.42, 0.58, 0, 4, 0x3a3a44);
      iso.box(0.3, 0.45, 0.5, 0.65, h, h + 4, accent(0x8a8f99)); // caixa d'água
      return { iso };
    }
    case "oficina": {
      const iso = new Iso(new Graphics(), 1, 20);
      const [a, b] = [0.1, 0.9];
      iso.box(a, a, b, b, 0, 11, wall, style?.roof ? roof : 0x6d7380);
      iso.leftRect(b, 0.2, 0.7, 0, 8, 0x4a4f58); // portão
      for (let z = 1; z < 8; z += 2) iso.leftRect(b, 0.2, 0.7, z, z + 1, 0x5d636d);
      iso.rightRect(b, 0.3, 0.7, 4, 8, WINDOW);
      iso.box(0.15, 0.62, 0.32, 0.8, 11, 17, 0x6a5b52); // chaminé
      iso.leftRect(b, 0.74, 0.86, 2, 6, accent(0xf0a020)); // placa
      return { iso };
    }
    case "padaria": {
      const iso = new Iso(new Graphics(), 1, 22);
      const [a, b] = [0.14, 0.86];
      iso.box(a, a, b, b, 0, 11, wall);
      iso.leftRect(b, 0.22, 0.4, 0, 7, 0x8a5a32); // porta
      iso.leftRect(b, 0.48, 0.78, 2, 7, 0xa8dcf0); // vitrine
      // toldo listrado
      for (let i = 0; i < 6; i++) {
        const u = 0.16 + i * 0.12;
        iso.poly(
          [[b, u, 9], [b, u + 0.12, 9], [b + 0.14, u + 0.12, 7], [b + 0.14, u, 7]],
          i % 2 ? 0xffffff : accent(0xd8392b),
        );
      }
      iso.gableRoof(a - 0.03, a - 0.03, b + 0.03, b + 0.03, 11, 6, style?.roof ? roof : 0x8a4b32);
      iso.box(0.25, 0.25, 0.38, 0.38, 14, 20, 0xb0a090); // chaminé do forno
      return { iso };
    }
    case "cabare": {
      const iso = new Iso(new Graphics(), 1, 28);
      const [a, b] = [0.14, 0.86];
      iso.box(a, a, b, b, 0, 14, wall, style?.roof ? roof : shade(wall, 0.7));
      const neon = accent([0xff4fd8, 0x4ff0ff, 0xffe14f][v % 3]);
      iso.leftRect(b, a, b, 13, 14, neon); // neon no topo
      iso.rightRect(b, a, b, 13, 14, neon);
      iso.leftRect(b, 0.38, 0.58, 0, 7, 0x1a0a20); // porta
      iso.leftRect(b, 0.36, 0.6, 7, 8, 0xff4f6a);
      iso.rightRect(b, 0.3, 0.45, 5, 9, 0xff7ad8);
      iso.rightRect(b, 0.58, 0.72, 5, 9, 0xff7ad8);
      // letreiro em cima, com estrela
      iso.box(0.4, 0.3, 0.46, 0.7, 14, 21, 0x22102a);
      iso.leftRect(0.46, 0.34, 0.66, 16, 19, neon);
      iso.px([0.43, 0.5, 25], 0xffe14f, 3, 3);
      // luzinhas no chão
      for (const u of [0.2, 0.32, 0.68, 0.8]) iso.px([b + 0.05, u, 1], 0xffe14f);
      return { iso };
    }
  }
}

/** A prefeitura (2x2 tiles). */
export function drawCityHall(style?: Style | null): Drawing {
  const iso = new Iso(new Graphics(), 2, 56);
  const wall = hexToNum(style?.wall, 0xf2efe6);
  const gold = hexToNum(style?.accent, 0xe8b830);
  const flag = hexToNum(style?.roof, 0x2e9e4a);
  const [a, b] = [0.2, 1.8];
  iso.box(a - 0.1, a - 0.1, b + 0.1, b + 0.1, 0, 3, 0xc9c2b0); // escadaria/base
  iso.box(a, a, b, b, 3, 22, wall);
  // colunas na frente
  for (let u = 0.35; u < 1.7; u += 0.25) iso.leftRect(b + 0.02, u, u + 0.08, 3, 20, 0xffffff);
  for (let u = 0.35; u < 1.7; u += 0.25) iso.leftRect(b + 0.02, u + 0.08, u + 0.1, 3, 20, 0xc9c2b0);
  iso.leftRect(b + 0.02, 0.88, 1.12, 3, 11, 0x6a4628); // porta grande
  for (const u of [0.4, 0.8, 1.2, 1.5]) iso.rightRect(b, u, u + 0.12, 8, 15, WINDOW);
  iso.box(a, a, b, b, 22, 24, 0xd8d2c0, 0xc8c0a8); // cornija
  // cúpula dourada
  iso.box(0.7, 0.7, 1.3, 1.3, 24, 30, 0xe9e4d8);
  iso.box(0.78, 0.78, 1.22, 1.22, 30, 34, gold, shade(gold, 1.15));
  iso.box(0.86, 0.86, 1.14, 1.14, 34, 37, gold, shade(gold, 1.15));
  // mastro e bandeira
  iso.poly([[1, 1, 37], [1, 1.04, 37], [1, 1.04, 52], [1, 1, 52]], 0x55555a);
  if (style?.flag) {
    const [fx, fy] = iso.pt([1, 1.04, 52]);
    paintFlag(iso.g, fx, fy, style.flag);
  } else {
    iso.poly([[1, 1.04, 52], [1, 1.34, 52], [1, 1.34, 46], [1, 1.04, 46]], flag);
    iso.px([1, 1.19, 50], 0xf5d02a, 2, 2);
  }
  return finish(iso);
}

/** Lote vazio: plaquinha "disponível". */
export function drawForSaleSign(): Drawing {
  const iso = new Iso(new Graphics(), 1, 10);
  iso.poly([[0.62, 0.5, 0], [0.62, 0.53, 0], [0.62, 0.53, 5], [0.62, 0.5, 5]], 0x6b4a2a);
  iso.leftRect(0.62, 0.4, 0.62, 4, 8, 0xf3e3b5);
  iso.leftRect(0.62, 0.44, 0.58, 5, 6, 0xc0483a);
  return finish(iso);
}

/** Moldura amarela para destacar lotes no modo "escolher lote". */
export function drawLotHighlight(color: number): Drawing {
  const iso = new Iso(new Graphics(), 1, 0);
  const t = 0.07;
  iso.poly([[0, 0, 0], [0, 1, 0], [t, 1, 0], [t, 0, 0]], color);
  iso.poly([[1 - t, 0, 0], [1 - t, 1, 0], [1, 1, 0], [1, 0, 0]], color);
  iso.poly([[0, 0, 0], [1, 0, 0], [1, t, 0], [0, t, 0]], color);
  iso.poly([[0, 1 - t, 0], [1, 1 - t, 0], [1, 1, 0], [0, 1, 0]], color);
  iso.poly([[t, t, 0], [t, 1 - t, 0], [1 - t, 1 - t, 0], [1 - t, t, 0]], color, 0.25);
  return finish(iso);
}

// ------------------------------------------------------------ enfeites

export function drawDecoration(kind: Decoration["kind"], variant: number): Drawing {
  const iso = new Iso(new Graphics(), 1, 24);
  const g = iso.g;
  const [cx, cy] = iso.pt([0.5, 0.5, 0]);
  switch (kind) {
    case "tree": {
      const greens = [0x2f7d32, 0x3d8f3a, 0x2a6e4a];
      const col = greens[variant % 3];
      g.rect(cx - 1, cy - 6, 2, 6).fill(0x6b4a2a);
      g.circle(cx, cy - 11, 6).fill(shade(col, 0.85));
      g.circle(cx - 1, cy - 12, 5).fill(col);
      g.rect(cx - 3, cy - 15, 2, 2).fill(shade(col, 1.3));
      break;
    }
    case "bush": {
      const col = [0x3f9440, 0x4a9e3a, 0x358a50][variant % 3];
      g.circle(cx, cy - 3, 4).fill(col);
      g.rect(cx - 2, cy - 5, 1, 1).fill(shade(col, 1.3));
      break;
    }
    case "flowers": {
      const cols = [0xff6b8a, 0xffe14f, 0xffffff, 0xb07aff];
      for (let i = 0; i < 6; i++) {
        const dx = ((i * 37 + variant * 11) % 13) - 6;
        const dy = ((i * 23 + variant * 7) % 7) - 3;
        g.rect(cx + dx, cy + dy - 1, 1, 2).fill(0x2f7d32);
        g.rect(cx + dx, cy + dy - 2, 1, 1).fill(cols[(i + variant) % cols.length]);
      }
      break;
    }
    case "bench": {
      iso.box(0.4, 0.3, 0.55, 0.7, 0, 2, 0x8a5a32);
      iso.box(0.4, 0.3, 0.45, 0.7, 2, 5, 0x9a6a3a);
      break;
    }
    case "fountain": {
      iso.box(0.2, 0.2, 0.8, 0.8, 0, 3, 0xbfb8a8, 0x4aa0e0);
      iso.box(0.44, 0.44, 0.56, 0.56, 3, 8, 0xbfb8a8);
      g.rect(cx - 1, cy - 14, 2, 4).fill(0xa8dcff);
      g.rect(cx - 3, cy - 12, 1, 2).fill(0xa8dcff);
      g.rect(cx + 2, cy - 12, 1, 2).fill(0xa8dcff);
      break;
    }
  }
  return finish(iso);
}

// --------------------------------------------------- carrinhos e pessoas

const CAR_COLORS = [0xd83a3a, 0x3a6fd8, 0xf0c030, 0x3aaa5a, 0xf0f0f0];

/** Carrinho. axis "c" = andando ao longo de c, "r" = ao longo de r. */
export function drawCar(variant: number, axis: "r" | "c"): Drawing {
  const iso = new Iso(new Graphics(), 1, 10);
  const col = CAR_COLORS[variant % CAR_COLORS.length];
  const [l, w] = [0.2, 0.11]; // meia-largura no sentido do movimento / lateral
  const box = (dl: number, dw: number, z0: number, z1: number, color: number, top?: number) => {
    if (axis === "c") iso.box(0.5 - dw, 0.5 - dl, 0.5 + dw, 0.5 + dl, z0, z1, color, top);
    else iso.box(0.5 - dl, 0.5 - dw, 0.5 + dl, 0.5 + dw, z0, z1, color, top);
  };
  box(l, w, 1, 4, col);
  box(l * 0.55, w * 0.9, 4, 7, 0xbfe4ff, shade(col, 1.1));
  return finish(iso);
}

const SHIRTS = [0xe84a4a, 0x4a7ae8, 0xf0c030, 0x3aaa5a, 0xb05ae8, 0xff8a3a];
const SKINS = [0xf5cfa8, 0xd9a06e, 0x9a6a42, 0x6b4a2e];

export function drawPerson(variant: number): Drawing {
  const iso = new Iso(new Graphics(), 1, 10);
  const g = iso.g;
  const [cx, cy] = iso.pt([0.5, 0.5, 0]);
  g.rect(cx - 1, cy - 2, 1, 2).fill(0x333344);
  g.rect(cx, cy - 2, 1, 2).fill(0x333344);
  g.rect(cx - 1, cy - 5, 2, 3).fill(SHIRTS[variant % SHIRTS.length]);
  g.rect(cx - 1, cy - 7, 2, 2).fill(SKINS[variant % SKINS.length]);
  return finish(iso);
}

// ---------------------------------------------------------------- noite

/** Brilho de luz (janelas, postes, faróis) para somar por cima à noite. */
export function drawGlow(color: number, radius: number): Drawing {
  const g = new Graphics();
  const size = radius * 2 + 2;
  const c = radius + 1;
  for (let r = radius; r > 0; r -= Math.max(1, Math.floor(radius / 5))) {
    const a = 0.08 + 0.32 * (1 - r / radius);
    g.ellipse(c, c, r, r * 0.6).fill({ color, alpha: a });
  }
  return { g, width: size, height: size, ox: c, oy: c };
}

/** Poste de luz (fica de dia e de noite). */
export function drawLamp(): Drawing {
  const iso = new Iso(new Graphics(), 1, 16);
  const [x, y] = iso.pt([0.5, 0.5, 0]);
  iso.g.rect(x, y - 12, 1, 12).fill(0x3a3a44);
  iso.g.rect(x - 1, y - 13, 3, 2).fill(0xfff1b0);
  return finish(iso);
}
