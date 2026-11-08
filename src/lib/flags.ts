import { FLAG_H, FLAG_W } from "./styles";

/**
 * Bandeiras dos estados em pixel art (12x8), simplificadas e inspiradas
 * nas oficiais. Cada uma vira o texto usado em Style.flag.
 */
// índices na PALETTE (ver styles.ts)
const C = { W: 6, K: 21, G: 20, g: 25, Y: 26, y: 17, B: 27, b: 14, R: 28, r: 12, P: 24 } as const;
type Col = keyof typeof C;

class Painter {
  cells: number[] = new Array(FLAG_W * FLAG_H).fill(C.W);
  set(x: number, y: number, c: Col) {
    if (x >= 0 && y >= 0 && x < FLAG_W && y < FLAG_H) this.cells[y * FLAG_W + x] = C[c];
  }
  each(fn: (x: number, y: number) => Col | null) {
    for (let y = 0; y < FLAG_H; y++)
      for (let x = 0; x < FLAG_W; x++) {
        const c = fn(x, y);
        if (c) this.set(x, y, c);
      }
    return this;
  }
  fill(c: Col) {
    return this.each(() => c);
  }
  rows(cols: Col[]) {
    return this.each((_, y) => cols[Math.floor((y * cols.length) / FLAG_H)]);
  }
  cols(cols: Col[]) {
    return this.each((x) => cols[Math.floor((x * cols.length) / FLAG_W)]);
  }
  rect(x0: number, y0: number, w: number, h: number, c: Col) {
    return this.each((x, y) => (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h ? c : null));
  }
  diamond(c: Col, inset = 0) {
    return this.each((x, y) => (Math.abs(x + 0.5 - 6) / (6 - inset) + Math.abs(y + 0.5 - 4) / (4 - inset * 0.6) <= 1 ? c : null));
  }
  circle(cx: number, cy: number, r: number, c: Col) {
    return this.each((x, y) => (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r ? c : null));
  }
  dots(pts: [number, number][], c: Col) {
    for (const [x, y] of pts) this.set(x, y, c);
    return this;
  }
  /** "Estrela" de 1 pixel com brilho em cruz. */
  star(x: number, y: number, c: Col) {
    return this.dots([[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]], c);
  }
  /** Valor 0..~2 ao longo da diagonal (canto de cima à esquerda -> baixo à direita). */
  static diag(x: number, y: number) {
    return (x + 0.5) / FLAG_W + (y + 0.5) / FLAG_H;
  }
  /** Diagonal ao contrário (de baixo à esquerda -> cima à direita). */
  static anti(x: number, y: number) {
    return (x + 0.5) / FLAG_W - (y + 0.5) / FLAG_H;
  }
  toString() {
    return this.cells.map((n) => n.toString(36)).join("");
  }
}

const P = () => new Painter();
const canton = (p: Painter, c: Col) => p.rect(0, 0, 5, 4, c);

const DESIGNS: Record<string, () => Painter> = {
  AC: () => P().each((x, y) => (Painter.diag(x, y) < 1 ? "Y" : "G")).star(2, 1, "R"),
  AL: () => P().cols(["R", "W", "b"]).dots([[5, 3], [6, 3], [5, 4], [6, 4]], "y"),
  AP: () => P().rows(["b", "b", "b", "b", "Y", "W", "G", "G"]).rect(1, 1, 3, 2, "K").dots([[2, 1], [2, 2]], "W"),
  AM: () => canton(P().rows(["W", "W", "W", "R", "R", "W", "W", "W"]), "b").dots([[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], "W"),
  BA: () => canton(P().rows(["W", "R", "W", "R"]), "b").dots([[2, 1], [1, 2], [2, 2], [3, 2]], "W"),
  CE: () => P().fill("G").diamond("Y").circle(6, 4, 1.8, "b").dots([[5, 4], [6, 4]], "W"),
  DF: () => P().fill("W").rect(4, 2, 4, 4, "G").dots([[5, 3], [6, 3], [5, 4], [6, 4], [4, 4], [7, 3]], "Y"),
  ES: () => P().rows(["b", "W", "P"]),
  GO: () => canton(P().rows(["G", "Y", "G", "Y", "G", "Y", "G", "Y"]), "b").dots([[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], "W"),
  MA: () => canton(P().rows(["R", "W", "K", "W", "R", "W", "K", "W"]), "b").star(2, 2, "W"),
  MT: () => P().fill("b").diamond("W").circle(6, 4, 2, "G").star(6, 4, "Y"),
  MS: () =>
    P()
      .each((x, y) => (Painter.anti(x, y) > 0.12 ? "B" : Painter.anti(x, y) < -0.12 ? "G" : "W"))
      .star(9, 1, "Y"),
  MG: () => P().fill("W").dots([[6, 1], [5, 2], [6, 2], [7, 2], [5, 3], [7, 3], [4, 4], [8, 4], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5]], "R"),
  PA: () =>
    P()
      .fill("R")
      .each((x, y) => (Math.abs(Painter.anti(x, y)) < 0.14 ? "W" : null))
      .star(6, 4, "b"),
  PB: () => P().cols(["R", "K", "K"]).dots([[5, 4], [7, 4], [9, 4], [10, 4]], "W"),
  PR: () =>
    P()
      .fill("G")
      .each((x, y) => (Math.abs(Painter.anti(x, y)) < 0.18 ? "W" : null))
      .circle(6, 4, 1.8, "b")
      .dots([[5, 4], [6, 3]], "W"),
  PE: () =>
    P()
      .rows(["b", "b", "b", "b", "b", "W", "W", "W"])
      .dots([[4, 2], [5, 1], [6, 1], [7, 2]], "Y")
      .dots([[3, 3], [8, 3]], "G")
      .star(6, 3, "Y")
      .dots([[6, 5], [6, 6], [5, 6], [7, 6], [6, 7]], "R"),
  PI: () => canton(P().rows(["G", "Y", "G", "Y", "G", "Y", "G", "Y"]), "b").star(2, 2, "W"),
  RJ: () =>
    P()
      .each((x, y) => ((x < 6) === (y < 4) ? "b" : "W"))
      .dots([[5, 3], [6, 3], [5, 4], [6, 4]], "y"),
  RN: () => P().rows(["G", "W"]).dots([[5, 3], [6, 3], [5, 4], [6, 4]], "y"),
  RS: () =>
    P()
      .each((x, y) => (Painter.diag(x, y) < 0.8 ? "G" : Painter.diag(x, y) < 1.2 ? "R" : "Y"))
      .dots([[5, 3], [6, 3], [5, 4], [6, 4]], "W"),
  RO: () =>
    P()
      .fill("b")
      .each((x, y) => (y >= 3 && Math.abs(x + 0.5 - 6) <= (y - 2) * 1.2 ? "Y" : null))
      .rect(0, 7, 12, 1, "G")
      .star(6, 1, "W"),
  RR: () =>
    P()
      .each((x, y) => {
        const d = Painter.diag(x, y);
        return d < 0.85 ? "b" : d < 0.97 ? "W" : d < 1.05 ? "R" : d < 1.17 ? "W" : "G";
      })
      .star(2, 2, "Y"),
  SC: () => P().rows(["R", "R", "W", "W", "W", "W", "R", "R"]).diamond("G", 2).dots([[5, 4], [6, 4]], "W"),
  SP: () => canton(P().rows(["K", "W", "K", "W", "K", "W", "K", "W"]), "R").circle(2.5, 2, 1.3, "W").dots([[2, 2]], "b"),
  SE: () => canton(P().rows(["G", "Y", "G", "Y", "G", "Y", "G", "Y"]), "b").dots([[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], "W"),
  TO: () =>
    P()
      .each((x, y) => (Painter.diag(x, y) < 0.88 ? "b" : Painter.diag(x, y) < 1.12 ? "W" : "Y"))
      .dots([[5, 3], [6, 3], [5, 4], [6, 4]], "Y"),
};

export const STATE_FLAG_UFS = Object.keys(DESIGNS).sort();

export function stateFlag(uf: string): string | null {
  const d = DESIGNS[uf.toUpperCase()];
  return d ? d().toString() : null;
}

export function blankFlag(): string {
  return new Painter().toString();
}
