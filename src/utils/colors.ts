export function readableTextColor(background: string) {
  const rgb = hexToRgb(background);
  if (!rgb) return "#111827";

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.68 ? "#111827" : "#FFFFFF";
}

export function mutedTextColor(textColor: string) {
  return textColor === "#FFFFFF" ? "rgba(255,255,255,0.78)" : "#475569";
}

export function normalizeHexColor(value: string) {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return undefined;
  return `#${normalized.toUpperCase()}`;
}

export function suggestedIconBackgroundColor(rowBackground: string) {
  const rgb = hexToRgb(rowBackground);
  if (!rgb) return "#FFFFFF";

  const rowTextColor = readableTextColor(rowBackground);
  const target = rowTextColor === "#FFFFFF"
    ? { r: 255, g: 255, b: 255 }
    : { r: 17, g: 24, b: 39 };
  const amount = rowTextColor === "#FFFFFF" ? 0.2 : 0.1;

  return rgbToHex({
    r: mixChannel(rgb.r, target.r, amount),
    g: mixChannel(rgb.g, target.g, amount),
    b: mixChannel(rgb.b, target.b, amount),
  });
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return null;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function mixChannel(value: number, target: number, amount: number) {
  return Math.round(value + (target - value) * amount);
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${
    [r, g, b]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  }`;
}
