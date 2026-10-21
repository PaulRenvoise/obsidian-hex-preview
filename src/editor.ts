import { syntaxTree } from '@codemirror/language';
import { type EditorState, RangeSetBuilder, type StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import { bindSwatch, createSwatch, findHex } from './hex';
import type { ColorTarget } from './picker';

class HexSwatch extends WidgetType {
  constructor(private readonly hex: string, private readonly from: number, private readonly open?: (target: ColorTarget) => void) { super(); }
  eq(other: HexSwatch): boolean { return this.hex === other.hex && this.from === other.from && this.open === other.open; }
  toDOM(view: EditorView): HTMLElement {
    const swatch = createSwatch(view.dom.ownerDocument, this.hex);
    if (this.open) bindSwatch(swatch, this.hex, () => {
      const snapshot = view.state.doc;
      this.open!({ anchor: swatch, hex: this.hex, apply: next => {
        if (!view.dom.isConnected || view.state.doc !== snapshot || snapshot.sliceString(this.from, this.from + this.hex.length) !== this.hex) {
          throw new Error('The note changed. Close this picker and reopen the swatch.');
        }
        view.dispatch({ changes: { from: this.from, to: this.from + this.hex.length, insert: next }, userEvent: 'input' });
        view.focus();
      } });
    });
    return swatch;
  }
  ignoreEvent(): boolean { return true; }
}

export function buildDecorations(state: EditorState, ranges: readonly { from: number; to: number }[], livePreview: boolean, open?: (target: ColorTarget) => void): DecorationSet {
  if (!livePreview) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(state);
  let previousLine = -1;
  for (const { from, to } of ranges) {
    let pos = from;
    while (pos <= to) {
      const line = state.doc.lineAt(pos);
      if (line.number !== previousLine) {
        for (const match of findHex(line.text)) {
          const start = line.from + match.from;
          const end = line.from + match.to;
          let excluded = false;
          tree.iterate({ from: start, to: end, enter(node) {
            // Inline code is included; fenced/indented code, metadata, links and math are not.
            if (/(?:codeblock|fencedcode|frontmatter|url|link|math|comment|html)/i.test(node.name)) excluded = true;
          } });
          if (!excluded) builder.add(start, start, Decoration.widget({ widget: new HexSwatch(match.hex, start, open), side: -1 }));
        }
        previousLine = line.number;
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

export function createHexEditorExtension(livePreviewField: StateField<boolean>, open?: (target: ColorTarget) => void) {
  const build = (view: EditorView) => buildDecorations(view.state, view.visibleRanges, view.state.field(livePreviewField, false) ?? false, open);
  return ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = build(view); }
  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged ||
      syntaxTree(update.startState) !== syntaxTree(update.state) ||
      update.startState.field(livePreviewField, false) !== update.state.field(livePreviewField, false)) {
      this.decorations = build(update.view);
    }
  }
}, { decorations: value => value.decorations });
}
