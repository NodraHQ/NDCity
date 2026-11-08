/** Tipos de construção que a pessoa pode escolher. */
export const BUILDING_TYPES = [
  { id: "casa", label: "Casa", emoji: "🏠" },
  { id: "predio", label: "Prédio", emoji: "🏢" },
  { id: "oficina", label: "Oficina", emoji: "🔧" },
  { id: "padaria", label: "Padaria", emoji: "🥖" },
  { id: "cabare", label: "Cabaré", emoji: "💃" },
  { id: "mansao", label: "Mansão", emoji: "🏰" },
  { id: "igreja", label: "Igreja", emoji: "⛪" },
  { id: "escola", label: "Escola", emoji: "🏫" },
  { id: "mercado", label: "Mercado", emoji: "🛒" },
  { id: "boteco", label: "Boteco", emoji: "🍺" },
  { id: "lanchonete", label: "Lanchonete", emoji: "🍔" },
  { id: "academia", label: "Academia", emoji: "🏋️" },
  { id: "farmacia", label: "Farmácia", emoji: "💊" },
  { id: "hotel", label: "Hotel", emoji: "🏨" },
  { id: "barbearia", label: "Barbearia", emoji: "💈" },
  { id: "sorveteria", label: "Sorveteria", emoji: "🍦" },
  { id: "posto", label: "Posto", emoji: "⛽" },
] as const;

export type BuildingType = (typeof BUILDING_TYPES)[number]["id"];

export function isBuildingType(value: unknown): value is BuildingType {
  return BUILDING_TYPES.some((b) => b.id === value);
}

export function buildingLabel(id: string): string {
  return BUILDING_TYPES.find((b) => b.id === id)?.label ?? id;
}
