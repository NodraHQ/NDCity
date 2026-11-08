import { createRng } from "./rng";

/**
 * Gera o desenho de uma cidade (ruas, lotes, praças, caminhos dos
 * carrinhos e pessoas) só a partir de uma "seed" (normalmente o nome
 * da cidade). Mesma seed => exatamente a mesma cidade, sempre.
 *
 * Este arquivo roda tanto no navegador (para desenhar) quanto no
 * servidor (para conferir se o lote escolhido existe).
 *
 * ATENÇÃO: os lotes são numerados (lot.index) e o banco guarda esse
 * número. Mudar este algoritmo muda a posição dos lotes de cidades que
 * já têm casinhas. Se for preciso mudar, crie uma nova versão
 * (LAYOUT_VERSION) e guarde a versão em cada cidade.
 */
export const LAYOUT_VERSION = 1;

export type TileKind = "grass" | "road" | "lot" | "park" | "plaza" | "water" | "sand";

export type Lot = {
  index: number;
  row: number;
  col: number;
};

export type Point = { r: number; c: number };

export type Path = {
  kind: "car" | "person";
  points: Point[]; // laço fechado (o último ponto volta ao primeiro)
  speed: number; // tiles por segundo
  offset: number; // 0..1, onde começa no laço
  variant: number;
};

export type Decoration = {
  kind: "tree" | "bush" | "fountain" | "flowers" | "bench";
  row: number;
  col: number;
  variant: number;
};

export type CityLayout = {
  version: number;
  seed: string;
  width: number;
  height: number;
  tiles: TileKind[][]; // tiles[row][col]
  lots: Lot[];
  cityHall: { row: number; col: number; size: number }; // canto de cima
  decorations: Decoration[];
  paths: Path[];
};

type Block = { r0: number; r1: number; c0: number; c1: number }; // interior inclusivo

function roadLines(rng: ReturnType<typeof createRng>, start: number, end: number): number[] {
  const lines = [start];
  let pos = start;
  while (true) {
    const size = rng.int(3, 5);
    if (pos + size + 1 > end) break;
    pos += size + 1;
    lines.push(pos);
  }
  return lines;
}

export function generateCity(seed: string): CityLayout {
  const rng = createRng(`${seed}#v${LAYOUT_VERSION}`);
  const margin = 3;
  const inner = 22;
  const width = inner + margin * 2;
  const height = inner + margin * 2;

  const tiles: TileKind[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => "grass" as TileKind),
  );

  // Água em um dos lados, para dar personalidade.
  const waterSide = rng.int(0, 3);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const d = [r, width - 1 - c, height - 1 - r, c][waterSide];
      const wobble = Math.floor(Math.sin((waterSide % 2 ? r : c) * 0.7 + rng.next() * 0.4) * 0.8);
      if (d + wobble <= 0) tiles[r][c] = "water";
      else if (d + wobble === 1) tiles[r][c] = "sand";
    }
  }

  const rows = roadLines(rng, margin, margin + inner - 1);
  const cols = roadLines(rng, margin, margin + inner - 1);
  const rMin = rows[0];
  const rMax = rows[rows.length - 1];
  const cMin = cols[0];
  const cMax = cols[cols.length - 1];

  for (const r of rows) for (let c = cMin; c <= cMax; c++) tiles[r][c] = "road";
  for (const c of cols) for (let r = rMin; r <= rMax; r++) tiles[r][c] = "road";

  const blocks: Block[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < cols.length - 1; j++) {
      blocks.push({ r0: rows[i] + 1, r1: rows[i + 1] - 1, c0: cols[j] + 1, c1: cols[j + 1] - 1 });
    }
  }

  // Quarteirão mais perto do centro vira a praça da prefeitura.
  const cr = (rMin + rMax) / 2;
  const cc = (cMin + cMax) / 2;
  let plazaIdx = 0;
  let best = Infinity;
  blocks.forEach((b, i) => {
    const d = Math.abs((b.r0 + b.r1) / 2 - cr) + Math.abs((b.c0 + b.c1) / 2 - cc);
    if (d < best) {
      best = d;
      plazaIdx = i;
    }
  });

  const decorations: Decoration[] = [];
  let cityHall = { row: 0, col: 0, size: 2 };

  blocks.forEach((b, i) => {
    const bw = b.c1 - b.c0 + 1;
    const bh = b.r1 - b.r0 + 1;
    if (i === plazaIdx) {
      for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) tiles[r][c] = "plaza";
      const hr = b.r0 + Math.floor((bh - 2) / 2);
      const hc = b.c0 + Math.floor((bw - 2) / 2);
      cityHall = { row: hr, col: hc, size: 2 };
      // Enfeites da praça nos cantos livres.
      const corners: Point[] = [
        { r: b.r0, c: b.c0 },
        { r: b.r0, c: b.c1 },
        { r: b.r1, c: b.c0 },
        { r: b.r1, c: b.c1 },
      ];
      corners.forEach((p, k) => {
        const insideHall = p.r >= hr && p.r < hr + 2 && p.c >= hc && p.c < hc + 2;
        if (!insideHall)
          decorations.push({ kind: k === 3 ? "fountain" : "tree", row: p.r, col: p.c, variant: k });
      });
      return;
    }
    const isPark = blocks.length > 6 && rng.chance(0.12);
    for (let r = b.r0; r <= b.r1; r++) {
      for (let c = b.c0; c <= b.c1; c++) {
        const onEdge = r === b.r0 || r === b.r1 || c === b.c0 || c === b.c1;
        if (!isPark && onEdge) {
          tiles[r][c] = "lot";
        } else {
          tiles[r][c] = "park";
          const roll = rng.next();
          if (roll < 0.45) decorations.push({ kind: "tree", row: r, col: c, variant: rng.int(0, 2) });
          else if (roll < 0.6) decorations.push({ kind: "flowers", row: r, col: c, variant: rng.int(0, 2) });
          else if (roll < 0.7) decorations.push({ kind: "bench", row: r, col: c, variant: 0 });
          else if (roll < 0.8) decorations.push({ kind: "bush", row: r, col: c, variant: rng.int(0, 2) });
        }
      }
    }
  });

  // Árvores espalhadas fora da cidade.
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (tiles[r][c] !== "grass") continue;
      const outside = r < rMin || r > rMax || c < cMin || c > cMax;
      if (outside && rng.chance(0.28)) {
        decorations.push({ kind: rng.chance(0.8) ? "tree" : "bush", row: r, col: c, variant: rng.int(0, 2) });
      }
    }
  }

  const lots: Lot[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (tiles[r][c] === "lot") lots.push({ index: lots.length, row: r, col: c });
    }
  }

  // Caminhos decorativos. Carros andam pela direita, em sentido horário
  // em volta de um quarteirão; pessoas andam na calçada.
  const paths: Path[] = [];
  const loopAround = (r1: number, r2: number, c1: number, c2: number, inset: number, reverse: boolean) => {
    const top = r1 + inset;
    const bottom = r2 + 1 - inset;
    const left = c1 + inset;
    const right = c2 + 1 - inset;
    const pts: Point[] = [
      { r: top, c: left },
      { r: top, c: right },
      { r: bottom, c: right },
      { r: bottom, c: left },
    ];
    return reverse ? pts.reverse() : pts;
  };

  const roadBlocks = blocks.map((b) => ({ r1: b.r0 - 1, r2: b.r1 + 1, c1: b.c0 - 1, c2: b.c1 + 1 }));
  // Volta grande ao redor da cidade.
  paths.push({ kind: "car", points: loopAround(rMin, rMax, cMin, cMax, 0.7, false), speed: 2.2, offset: 0, variant: 0 });
  paths.push({ kind: "car", points: loopAround(rMin, rMax, cMin, cMax, 0.7, false), speed: 2.2, offset: 0.5, variant: 1 });
  const carCount = Math.min(10, Math.max(4, Math.floor(blocks.length * 0.6)));
  for (let i = 0; i < carCount; i++) {
    const b = rng.pick(roadBlocks);
    paths.push({
      kind: "car",
      points: loopAround(b.r1, b.r2, b.c1, b.c2, 0.7, false),
      speed: 1.6 + rng.next(),
      offset: rng.next(),
      variant: rng.int(0, 4),
    });
  }
  const peopleCount = Math.min(18, blocks.length + 4);
  for (let i = 0; i < peopleCount; i++) {
    const b = rng.pick(roadBlocks);
    paths.push({
      kind: "person",
      points: loopAround(b.r1, b.r2, b.c1, b.c2, 0.92, rng.chance(0.5)),
      speed: 0.35 + rng.next() * 0.25,
      offset: rng.next(),
      variant: rng.int(0, 5),
    });
  }

  return { version: LAYOUT_VERSION, seed, width, height, tiles, lots, cityHall, decorations, paths };
}

/** Posição (r,c) num laço, dado quanto já andou (0..1 do perímetro). */
export function pointOnLoop(points: Point[], t: number): { r: number; c: number; dr: number; dc: number } {
  const segs: { a: Point; b: Point; len: number }[] = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.abs(b.r - a.r) + Math.abs(b.c - a.c);
    segs.push({ a, b, len });
    total += len;
  }
  let d = (((t % 1) + 1) % 1) * total;
  for (const s of segs) {
    if (d <= s.len || s === segs[segs.length - 1]) {
      const k = s.len === 0 ? 0 : Math.min(1, d / s.len);
      return {
        r: s.a.r + (s.b.r - s.a.r) * k,
        c: s.a.c + (s.b.c - s.a.c) * k,
        dr: Math.sign(s.b.r - s.a.r),
        dc: Math.sign(s.b.c - s.a.c),
      };
    }
    d -= s.len;
  }
  return { r: points[0].r, c: points[0].c, dr: 0, dc: 1 };
}

export function loopLength(points: Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.abs(b.r - a.r) + Math.abs(b.c - a.c);
  }
  return total;
}
