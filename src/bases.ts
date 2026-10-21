import { bindSwatch, createSwatch, isHex } from './hex';

const CELL = '.bases-table-cell';
const MARK = 'hex-preview-base-value';
const COLOR = '--hex-preview-color';

export type OpenBasesColor = (anchor: HTMLElement, value: HTMLElement, hex: string) => void;

/** Insert empty swatch controls, keeping native text nodes and property controls intact. */
export function decorateCell(cell: HTMLElement, open?: OpenBasesColor): void {
  const candidates = [cell, ...cell.querySelectorAll<HTMLElement>('*')];
  const desired = new Map<HTMLElement, string>();
  for (const el of candidates) {
    if (el.matches('input, textarea, svg, button, .hex-preview-swatch') || el.closest('a, .internal-link, .external-link, .multi-select-pill-remove-button')) continue;
    const value = el.textContent?.trim() ?? '';
    if (!isHex(value)) continue;
    // The smallest value element avoids duplicate swatches on nested containers.
    if (Array.from(el.children).some(child => child.textContent?.trim() === value)) continue;
    const editor = el.closest('[contenteditable]');
    if (editor?.getAttribute('contenteditable') !== 'false' && editor?.contains(el.ownerDocument.activeElement) && !el.ownerDocument.activeElement?.matches('.hex-preview-swatch')) continue;
    desired.set(el, value);
  }
  for (const el of candidates) {
    const hex = desired.get(el);
    if (hex) {
      if (!el.classList.contains(MARK)) el.classList.add(MARK);
      if (el.style.getPropertyValue(COLOR) !== hex) el.style.setProperty(COLOR, hex);
      const old = el.querySelector<HTMLElement>(':scope > .hex-preview-swatch');
      if (!old || old.dataset.hex !== hex) {
        old?.remove();
        const swatch = createSwatch(el.ownerDocument, hex);
        swatch.dataset.hex = hex;
        if (open) bindSwatch(swatch, hex, () => open(swatch, el, hex));
        el.prepend(swatch);
      }
    } else if (el.classList.contains(MARK)) {
      el.classList.remove(MARK);
      el.style.removeProperty(COLOR);
      el.querySelector(':scope > .hex-preview-swatch')?.remove();
    }
  }
}

/** One observer per document, including pop-out windows. Batches only changed cells. */
export function observeBases(doc: Document, open?: OpenBasesColor): () => void {
  const win = doc.defaultView!;
  const pending = new Set<HTMLElement>();
  let frame: number | null = null;
  const collect = (node: Node) => {
    const el = node.nodeType === 1 ? node as HTMLElement : node.parentElement;
    if (!el) return;
    const cell = el.closest<HTMLElement>(CELL);
    if (cell) pending.add(cell);
    el.querySelectorAll<HTMLElement>(CELL).forEach(cell => pending.add(cell));
  };
  const schedule = () => {
    if (pending.size && frame === null) frame = win.requestAnimationFrame(flush);
  };
  const options: MutationObserverInit = {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['contenteditable', 'class'],
  };
  const observer = new win.MutationObserver(records => {
    for (const record of records) {
      collect(record.target);
      record.addedNodes.forEach(collect);
    }
    schedule();
  });
  function flush() {
    frame = null;
    observer.disconnect();
    for (const cell of pending) if (cell.isConnected) decorateCell(cell, open);
    pending.clear();
    observer.observe(doc.body, options);
  }
  const focus = (event: FocusEvent) => {
    collect(event.target as Node);
    schedule();
  };
  collect(doc.body);
  flush();
  doc.addEventListener('focusin', focus);
  doc.addEventListener('focusout', focus);
  return () => {
    observer.disconnect();
    if (frame !== null) win.cancelAnimationFrame(frame);
    pending.clear();
    doc.removeEventListener('focusin', focus);
    doc.removeEventListener('focusout', focus);
    doc.querySelectorAll<HTMLElement>(`.${MARK}`).forEach(el => {
      el.classList.remove(MARK);
      el.style.removeProperty(COLOR);
      el.querySelector(':scope > .hex-preview-swatch')?.remove();
    });
  };
}
