import { editorLivePreviewField, Plugin } from 'obsidian';
import { observeBases } from './bases';
import { createHexEditorExtension } from './editor';
import { clearReading, decorateReading } from './reading';

export default class HexPreviewPlugin extends Plugin {
  private documents = new Map<Document, () => void>();

  onload(): void {
    this.registerEditorExtension(createHexEditorExtension(editorLivePreviewField));
    this.registerMarkdownPostProcessor(el => decorateReading(el));
    this.app.workspace.onLayoutReady(() => this.watchDocuments());
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
    this.documents.set(doc, observeBases(doc));
    // Also enhance already-rendered notes when the plugin is first enabled.
    doc.querySelectorAll<HTMLElement>('.markdown-preview-view .markdown-preview-section').forEach(decorateReading);
  }

  private releaseDocument(doc: Document): void {
    this.documents.get(doc)?.();
    clearReading(doc);
    this.documents.delete(doc);
  }

  onunload(): void {
    for (const doc of this.documents.keys()) this.releaseDocument(doc);
  }
}
