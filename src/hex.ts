export interface HexMatch { from: number; to: number; hex: string }

export function isHex(value: string): boolean {
  return /^#(?:[\da-f]{8}|[\da-f]{6})$/i.test(value);
}

// Delimiters exclude identifiers, nested tags, URL fragments and escaped hashes.
// No lookbehind: this also runs on older mobile WebViews.
export function findHex(text: string): HexMatch[] {
  const matches: HexMatch[] = [];
  const pattern = /(^|[^\p{L}\p{N}_/#\\&=?.%+-])(#(?:[\da-f]{8}|[\da-f]{6}))(?![\p{L}\p{N}_/-])/giu;
  for (const match of text.matchAll(pattern)) {
    const from = match.index + match[1].length;
    matches.push({ from, to: from + match[2].length, hex: match[2] });
  }
  return matches;
}

export function createSwatch(doc: Document, hex: string): HTMLElement {
  const swatch = doc.adoptNode(createSpan());
  swatch.className = 'hex-preview-swatch';
  swatch.style.setProperty('--hex-preview-color', hex);
  swatch.setAttribute('aria-hidden', 'true');
  swatch.title = hex;
  return swatch;
}

export function bindSwatch(swatch: HTMLElement, hex: string, open: () => void): void {
  swatch.removeAttribute('aria-hidden');
  swatch.setAttribute('role', 'button');
  swatch.setAttribute('tabindex', '0');
  swatch.setAttribute('contenteditable', 'false');
  swatch.setAttribute('aria-label', `Edit color ${hex}`);
  swatch.setAttribute('aria-haspopup', 'dialog');
  swatch.title = `Edit ${hex}`;
  // Capture before native Bases editors, tags or CodeMirror handle the pointer.
  swatch.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); }, true);
  swatch.addEventListener('mousedown', event => { event.preventDefault(); event.stopPropagation(); }, true);
  swatch.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); open(); }, true);
  swatch.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopPropagation(); open();
    }
  });
}
