export interface RGB { r: number; g: number; b: number }
export interface HSV { h: number; s: number; v: number }
export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function hexToRGB(hex: string): RGB {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

export function rgbToHSV({ r, g, b }: RGB): HSV {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? delta / max : 0, v: max };
}

export function hsvToRGB({ h, s, v }: HSV): RGB {
  h = ((h % 360) + 360) % 360;
  s = clamp(s); v = clamp(v);
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return { r: f(5), g: f(3), b: f(1) };
}

export function formatHex(rgb: RGB, alpha: number, original: string): string {
  const byte = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
  let hex = '#' + byte(rgb.r) + byte(rgb.g) + byte(rgb.b);
  if (original.length === 9 || alpha !== 255) hex += byte(alpha);
  return /[a-f]/.test(original) && !/[A-F]/.test(original) ? hex : hex.toUpperCase();
}
