import type { JSDOM } from 'jsdom';

/** Model Obsidian's DOM helpers in JSDOM, including owner-document adoption. */
export function installObsidianDom(dom: JSDOM): void {
  const doc = dom.window.document;
  function create<K extends keyof HTMLElementTagNameMap>(tag: K, options?: DomElementInfo | string): HTMLElementTagNameMap[K] {
    const el = doc.createElement(tag);
    const info = typeof options === 'string' ? { cls: options } : options;
    if (info?.cls) el.className = Array.isArray(info.cls) ? info.cls.join(' ') : info.cls;
    if (info?.text) el.append(info.text);
    if (info?.attr) for (const [key, value] of Object.entries(info.attr)) {
      if (value !== null) el.setAttribute(key, String(value));
    }
    info?.parent?.appendChild(el);
    return el;
  }
  Object.assign(globalThis, {
    createEl: create,
    createDiv: (options?: DomElementInfo | string) => create('div', options),
    createSpan: (options?: DomElementInfo | string) => create('span', options),
    createFragment: () => doc.createDocumentFragment(),
  });
  Object.assign(dom.window.Node.prototype, {
    createEl<K extends keyof HTMLElementTagNameMap>(this: Node, tag: K, options?: DomElementInfo | string): HTMLElementTagNameMap[K] {
      return this.appendChild(create(tag, options));
    },
    createDiv(this: Node, options?: DomElementInfo | string): HTMLDivElement {
      return this.createEl('div', options);
    },
    createSpan(this: Node, options?: DomElementInfo | string): HTMLSpanElement {
      return this.createEl('span', options);
    },
  });
}
