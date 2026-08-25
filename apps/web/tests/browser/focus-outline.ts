export function computedCssColorAlpha(color: string) {
  const normalized = color.trim().toLowerCase();
  if (normalized === "transparent") return 0;

  const components = normalized.match(/[-+]?(?:\d*\.)?\d+%?/g) ?? [];
  if (components.length < 4) return 1;

  const alpha = components.at(-1)!;
  const value = Number.parseFloat(alpha);
  return alpha.endsWith("%") ? value / 100 : value;
}
