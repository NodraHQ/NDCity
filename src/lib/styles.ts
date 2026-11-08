/**
 * Personalização (recurso pago): cores escolhidas de uma paleta fixa em
 * pixel art. Paleta fechada = nada de cor estranha e fácil de validar.
 */
export const PALETTE = [
  "#f1e3c6", "#f4c7a1", "#f6e27f", "#d9f0c4", "#bfe0f2", "#d2c6d8",
  "#ffffff", "#9fb4c8", "#8b9bb0", "#6b2e7a", "#8a1f4f", "#2f4a6b",
  "#c0483a", "#8a4b32", "#3f6fa8", "#5a7d3a", "#9c3a60", "#e8b830",
  "#ff4fd8", "#4ff0ff", "#2e9e4a", "#1f1d2b", "#ff8a3a", "#7a5cff",
] as const;

export type Style = { wall?: string; roof?: string; accent?: string };

export const STYLE_PARTS: { key: keyof Style; label: string; hallLabel: string }[] = [
  { key: "wall", label: "Paredes", hallLabel: "Paredes" },
  { key: "roof", label: "Telhado", hallLabel: "Bandeira" },
  { key: "accent", label: "Detalhes", hallLabel: "Cúpula" },
];

export function sanitizeStyle(input: unknown): Style | null {
  if (!input || typeof input !== "object") return null;
  const out: Style = {};
  for (const { key } of STYLE_PARTS) {
    const v = (input as Record<string, unknown>)[key];
    if (typeof v === "string" && (PALETTE as readonly string[]).includes(v.toLowerCase())) out[key] = v.toLowerCase();
  }
  return Object.keys(out).length ? out : null;
}

export function hexToNum(hex: string | undefined, fallback: number): number {
  return hex ? parseInt(hex.slice(1), 16) : fallback;
}

export function styleKey(style: Style | null | undefined): string {
  return style ? `${style.wall ?? ""}${style.roof ?? ""}${style.accent ?? ""}` : "";
}
