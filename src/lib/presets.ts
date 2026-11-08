import type { Style } from "./styles";

/** Modelos prontos de cores (só cores da paleta). */
export const PRESETS: { id: string; name: string; emoji: string; style: Style }[] = [
  { id: "classica", name: "Clássica", emoji: "🏡", style: { wall: "#f1e3c6", roof: "#c0483a", accent: "#8a4b32" } },
  { id: "praia", name: "Praia", emoji: "🏖", style: { wall: "#bfe0f2", roof: "#3f6fa8", accent: "#f6e27f" } },
  { id: "tropical", name: "Tropical", emoji: "🌴", style: { wall: "#f6e27f", roof: "#2e9e4a", accent: "#ff8a3a" } },
  { id: "pastel", name: "Pastel", emoji: "🍬", style: { wall: "#d2c6d8", roof: "#e87aa0", accent: "#bfe0f2" } },
  { id: "noturna", name: "Noturna", emoji: "🌙", style: { wall: "#2f4a6b", roof: "#1f1d2b", accent: "#ffd400" } },
  { id: "neon", name: "Neon", emoji: "💡", style: { wall: "#1f1d2b", roof: "#7a5cff", accent: "#ff4fd8" } },
  { id: "colonial", name: "Colonial", emoji: "⛪", style: { wall: "#ffffff", roof: "#8a4b32", accent: "#1d3f8f" } },
  { id: "floresta", name: "Floresta", emoji: "🌲", style: { wall: "#d9f0c4", roof: "#1e6b34", accent: "#8a4b32" } },
  { id: "brasil", name: "Brasil", emoji: "🇧🇷", style: { wall: "#ffd400", roof: "#2e9e4a", accent: "#1d3f8f" } },
  { id: "fogo", name: "Fogo", emoji: "🔥", style: { wall: "#ff8a3a", roof: "#d81e1e", accent: "#ffd400" } },
  { id: "gotica", name: "Gótica", emoji: "🦇", style: { wall: "#6b2e7a", roof: "#1f1d2b", accent: "#8a1f4f" } },
  { id: "nuvem", name: "Nuvem", emoji: "☁️", style: { wall: "#ffffff", roof: "#9fb4c8", accent: "#bfe0f2" } },
];
