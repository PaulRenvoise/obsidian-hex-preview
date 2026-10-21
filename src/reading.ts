import { bindSwatch, createSwatch, findHex } from './hex';

const SKIP = '.hex-preview-token, .bases-view, .metadata-container, pre, a:not(.tag), .internal-link, .external-link, script, style, textarea, input, [contenteditable="true"], .math';

export function decorateReading(root: HTMLElement, open?: (anchor: HTMLElement, hex: string) => void): void {
  if (root.closest(SKIP)) return;
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.parentElement?.closest(SKIP) && findHex(node.data).length) nodes.push(node);
  }
  for (const node of nodes) {
    const fragment = doc.createDocumentFragment();
    let offset = 0;
    for (const match of findHex(node.data)) {
      fragment.append(node.data.slice(offset, match.from));
      const token = doc.createElement('span');
      token.className = 'hex-preview-token';
      const swatch = createSwatch(doc, match.hex);
      if (open) bindSwatch(swatch, match.hex, () => open(swatch, match.hex));
      token.append(swatch, doc.createTextNode(match.hex));
      fragment.append(token);
      offset = match.to;
    }
    fragment.append(node.data.slice(offset));
    node.replaceWith(fragment);
  }
}

export function clearReading(root: ParentNode): void {
  root.querySelectorAll('.hex-preview-token').forEach(token => {
    const parent = token.parentNode;
    token.replaceWith(token.ownerDocument.createTextNode(token.textContent ?? ''));
    parent?.normalize();
  });
}
