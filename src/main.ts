import { editorLivePreviewField, MarkdownView, Notice, Plugin } from 'obsidian';
import { observeBases } from './bases';
import { createHexEditorExtension } from './editor';
import { clearReading, decorateReading } from './reading';
import { ColorPicker, type ColorTarget } from './picker';
import { basesTarget, readingTarget } from './targets';

export default class HexPreviewPlugin extends Plugin {
  private documents = new Map<Document, () => void>();
  private pickers = new Map<Document, ColorPicker>();
  private openPicker = (target: ColorTarget): void => {
    const doc = target.anchor.ownerDocument;
    let picker = this.pickers.get(doc);
    if (!picker) { picker = new ColorPicker(); this.pickers.set(doc, picker); }
    picker.open(target);
  };

  onload(): void {
    this.registerEditorExtension(createHexEditorExtension(editorLivePreviewField, this.openPicker));
    this.registerMarkdownPostProcessor((el, ctx) => decorateReading(el, (anchor, hex) => {
      void readingTarget(this.app, el, ctx, anchor, hex).then(target => {
        if (anchor.isConnected && this.documents.has(anchor.ownerDocument)) this.openPicker(target);
      }).catch(() => { new Notice('Could not read the note for this color. Please try again.'); });
    }));
    this.app.workspace.onLayoutReady(() => {
      this.watchDocuments();
      // Run processors with a real source context for already-open Reading views.
      this.app.workspace.getLeavesOfType('markdown').forEach(leaf => {
        if (leaf.view instanceof MarkdownView) leaf.view.previewMode.rerender(true);
      });
    });
    this.registerEvent(this.app.workspace.on('layout-change', () => this.watchDocuments()));
    this.registerEvent(this.app.workspace.on('window-open', (_workspaceWindow, win) => this.watchDocument(win.document)));
    this.registerEvent(this.app.workspace.on('window-close', (_workspaceWindow, win) => this.releaseDocument(win.document)));
  }

  private watchDocuments(): void {
    this.watchDocument(document);
    this.app.workspace.iterateAllLeaves(leaf => this.watchDocument(leaf.view.containerEl.ownerDocument));
  }

  private watchDocument(doc: Document): void {
    if (this.documents.has(doc)) return;
    this.documents.set(doc, observeBases(doc, (anchor, value, hex) => this.openPicker(basesTarget(this.app, anchor, value, hex))));
  }

  private releaseDocument(doc: Document): void {
    this.pickers.get(doc)?.close();
    this.pickers.delete(doc);
    this.documents.get(doc)?.();
    clearReading(doc);
    this.documents.delete(doc);
  }

  onunload(): void {
    for (const doc of this.documents.keys()) this.releaseDocument(doc);
  }
}
