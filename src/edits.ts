import { findHex, isHex } from './hex';

export interface TextEdit { snapshot: string; from: number; to: number; hex: string }

/** Match within the rendered section; refuse ambiguous hidden Markdown occurrences. */
export function locateReadingEdit(text: string, lineStart: number, lineEnd: number, hex: string, index: number, renderedCount: number): TextEdit | null {
  const lines = text.split('\n');
  const offset = lines.slice(0, lineStart).reduce((n, line) => n + line.length + 1, 0);
  const section = lines.slice(lineStart, lineEnd + 1).join('\n');
  const matches = findHex(section).filter(match => match.hex === hex);
  if (matches.length !== renderedCount || !matches[index]) return null;
  const match = matches[index];
  return { snapshot: text, from: offset + match.from, to: offset + match.to, hex };
}

export function replaceText(current: string, edit: TextEdit, next: string): string {
  if (!isHex(next)) throw new Error('Choose a valid six- or eight-digit hex color.');
  if (current !== edit.snapshot || current.slice(edit.from, edit.to) !== edit.hex) {
    throw new Error('The note changed. Close this picker and reopen the swatch.');
  }
  return current.slice(0, edit.from) + next + current.slice(edit.to);
}

export function replaceProperty(current: unknown, snapshot: string | string[], index: number | null, hex: string, next: string): string | string[] {
  if (!isHex(next)) throw new Error('Choose a valid six- or eight-digit hex color.');
  if (JSON.stringify(current) !== JSON.stringify(snapshot)) throw new Error('The property changed. Close this picker and reopen the swatch.');
  if (Array.isArray(snapshot) && index !== null && snapshot[index]?.trim() === hex) {
    const result = snapshot.slice(); result[index] = snapshot[index].replace(hex, next); return result;
  }
  if (typeof snapshot === 'string' && index === null && snapshot.trim() === hex) {
    return snapshot.replace(hex, next);
  }
  throw new Error('Could not identify the original color. Reopen the swatch.');
}
