export interface HexMatch { from: number; to: number; hex: string }

export function isHex(value: string): boolean {
  return /^#(?:[\da-f]{8}|[\da-f]{6})$/i.test(value);
}

// Delimiters exclude identifiers, nested tags, URL fragments and escaped hashes.
// No lookbehind: this also runs on older mobile WebViews.
export function findHex(text: string): HexMatch[] {
  const matches: HexMatch[] = [];
  const pattern = /(^|[^\p{L}\p{N}_/#\\&=?.%+\-])(#(?:[\da-f]{8}|[\da-f]{6}))(?![\p{L}\p{N}_/\-])/giu;
  for (const match of text.matchAll(pattern)) {
    const from = match.index! + match[1].length;
    matches.push({ from, to: from + match[2].length, hex: match[2] });
  }
  return matches;
}

export function createSwatch(doc: Document, hex: string): HTMLElement {
  const swatch = doc.createElement('span');
  swatch.className = 'hex-preview-swatch';
  swatch.style.setProperty('--hex-preview-color', hex);
  swatch.setAttribute('aria-hidden', 'true');
  swatch.title = hex;
  return swatch;
}
