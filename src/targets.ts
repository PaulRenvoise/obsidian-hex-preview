import { type App, MarkdownView, type MarkdownPostProcessorContext, TFile } from 'obsidian';
import { locateReadingEdit, replaceProperty, replaceText } from './edits';
import type { ColorTarget } from './picker';

export async function readingTarget(app: App, root: HTMLElement, ctx: MarkdownPostProcessorContext, anchor: HTMLElement, hex: string): Promise<ColorTarget> {
  const target: ColorTarget = { anchor, hex, readOnlyReason: 'Open this note in Live Preview to edit this color.' };
  const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
  if (!(file instanceof TFile)) return target;
  const source = await app.vault.read(file);
  const info = ctx.getSectionInfo(root);
  if (!info || !anchor.isConnected) return target;
  const section = source.split('\n').slice(info.lineStart, info.lineEnd + 1).join('\n');
  // Obsidian contexts may provide the full source or only the rendered section.
  if (info.text !== source && info.text !== section) return target;
  const tokens = Array.from(root.querySelectorAll<HTMLElement>('.hex-preview-token')).filter(el => el.textContent === hex);
  const index = tokens.indexOf(anchor.parentElement!);
  const edit = locateReadingEdit(source, info.lineStart, info.lineEnd, hex, index, tokens.length);
  if (!edit) return target;
  return { anchor, hex, apply: async next => {
    // Prefer an open editor to keep undo history and avoid racing an unsaved buffer.
    const views = app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view)
      .filter((view): view is MarkdownView => view instanceof MarkdownView && view.file === file && view.getMode() === 'source');
    for (const view of views) replaceText(view.editor.getValue(), edit, next);
    if (views.length) {
      const editor = views[0].editor;
      editor.replaceRange(next, editor.offsetToPos(edit.from), editor.offsetToPos(edit.to));
    } else {
      await app.vault.process(file, current => replaceText(current, edit, next));
    }
  } };
}

export function basesTarget(app: App, anchor: HTMLElement, value: HTMLElement, hex: string): ColorTarget {
  const column = value.closest<HTMLElement>('.bases-td[data-property]');
  const property = column?.dataset.property;
  const unavailable = (reason: string): ColorTarget => ({ anchor, hex, readOnlyReason: reason });
  if (!property?.startsWith('note.')) return unavailable('This is a calculated value. Edit its source property instead.');
  const row = column?.closest('.bases-tr');
  // Only file-property links identify the row. Never infer a file from other linked properties.
  const fileLink = row?.querySelector<HTMLElement>('.bases-td[data-property="file.name"] [data-href], .bases-td[data-property="file.path"] [data-href], .bases-td[data-property="file.link"] [data-href]');
  const path = fileLink?.dataset.href;
  const file = path ? app.vault.getAbstractFileByPath(path) : null;
  if (!(file instanceof TFile)) return unavailable('Show the File name column in this Base to edit colors.');
  const key = property.slice(5);
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
  if (!frontmatter || !Object.prototype.hasOwnProperty.call(frontmatter, key)) return unavailable('The property is not available yet. Close and reopen the picker.');
  const current: unknown = frontmatter[key];
  const pill = value.closest('.multi-select-pill');
  const index = pill ? Array.from(column!.querySelectorAll('.multi-select-pill')).indexOf(pill) : null;
  if (!(typeof current === 'string' || (Array.isArray(current) && current.every(v => typeof v === 'string')))) {
    return unavailable('This property is not an editable text color.');
  }
  const snapshot: string | string[] = Array.isArray(current) ? current.slice() : current;
  try { replaceProperty(current, snapshot, index, hex, hex); }
  catch { return unavailable('The property changed. Close and reopen the picker.'); }
  return { anchor, hex, apply: async next => {
    await app.fileManager.processFrontMatter(file, (data: Record<string, unknown>) => {
      data[key] = replaceProperty(data[key], snapshot, index, hex, next);
    });
  } };
}
