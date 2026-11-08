/**
 * Altura do sol no céu (em graus) para uma latitude/longitude e horário.
 * Positivo = dia, negativo = noite. Fórmula simplificada da NOAA, mais
 * do que suficiente para pintar o dia e a noite.
 */
export function sunElevation(lat: number, lng: number, date: Date): number {
  const rad = Math.PI / 180;
  const day = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000;
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (day - 1 + (hours - 12) / 24);
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqTime =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const trueSolarMin = (hours * 60 + eqTime + 4 * lng + 1440) % 1440;
  const hourAngle = (trueSolarMin / 4 - 180) * rad;
  const cosZenith = Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(hourAngle);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZenith))) / rad;
}

/** 0 = dia claro, 1 = noite fechada (com crepúsculo suave). */
export function darknessFor(elevation: number): number {
  if (elevation >= 6) return 0;
  if (elevation <= -8) return 1;
  return (6 - elevation) / 14;
}

/** Hora local de uma cidade, ex.: "21:37". */
export function localTime(timezone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(date);
}
