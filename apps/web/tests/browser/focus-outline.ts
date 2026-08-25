function parseAlpha(alpha: string) {
  const value = Number.parseFloat(alpha);
  if (!Number.isFinite(value)) return 1;

  const normalized = alpha.trim().endsWith("%") ? value / 100 : value;
  return Math.min(1, Math.max(0, normalized));
}

export function computedCssColorAlpha(color: string) {
  const normalized = color.trim().toLowerCase();
  if (normalized === "transparent") return 0;

  const content = normalized.slice(normalized.indexOf("(") + 1, -1);
  const slash = content.lastIndexOf("/");
  if (slash >= 0) return parseAlpha(content.slice(slash + 1));

  if (normalized.startsWith("rgba(")) {
    const components = content.split(",");
    if (components.length === 4) return parseAlpha(components[3]!);
  }

  return 1;
}
