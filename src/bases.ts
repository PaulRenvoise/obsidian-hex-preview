import { isHex } from './hex';

const CELL = '.bases-table-cell';
const MARK = 'hex-preview-base-value';
const COLOR = '--hex-preview-color';

/** Decorate native cells with CSS only: never rewrite property text or editing DOM. */
export function decorateCell(cell: HTMLElement): void {
  const candidates = [cell, ...cell.querySelectorAll<HTMLElement>('*')];
  const desired = new Map<HTMLElement, string>();
  for (const el of candidates) {
    if (el.matches('input, textarea, svg, button') || el.closest('a, .internal-link, .external-link, .multi-select-pill-remove-button')) continue;
    const value = el.textContent?.trim() ?? '';
    if (!isHex(value)) continue;
    // The smallest value element avoids duplicate swatches on nested containers.
    if (Array.from(el.children).some(child => child.textContent?.trim() === value)) continue;
    const editor = el.closest('[contenteditable]');
    if (editor?.getAttribute('contenteditable') !== 'false' && editor?.contains(el.ownerDocument.activeElement)) continue;
    desired.set(el, value);
  }
  for (const el of candidates) {
    const hex = desired.get(el);
    if (hex) {
      if (!el.classList.contains(MARK)) el.classList.add(MARK);
      if (el.style.getPropertyValue(COLOR) !== hex) el.style.setProperty(COLOR, hex);
    } else if (el.classList.contains(MARK)) {
      el.classList.remove(MARK);
      el.style.removeProperty(COLOR);
    }
  }
}

/** One observer per document, including pop-out windows. Batches only changed cells. */
export function observeBases(doc: Document): () => void {
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
    for (const cell of pending) if (cell.isConnected) decorateCell(cell);
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
    });
  };
}
