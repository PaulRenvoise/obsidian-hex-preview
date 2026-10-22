import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorState, StateField } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { JSDOM } from 'jsdom';
import { installObsidianDom } from './obsidian-dom';
import { buildDecorations, createHexEditorExtension } from '../src/editor';
import type { ColorTarget } from '../src/picker';

test('editor previews prose and inline code while excluding links and fenced code', () => {
  const state = EditorState.create({ doc: '#aabbcc `#11223380` [#445566](https://example.com/#aabbcc)\n\n```css\n#778899\n```', extensions: [markdown()] });
  const decorations = buildDecorations(state, [{ from: 0, to: state.doc.length }], true);
  const positions: number[] = [];
  decorations.between(0, state.doc.length, from => { positions.push(from); });
  assert.deepEqual(positions, [0, 9]);
  assert.equal(buildDecorations(state, [{ from: 0, to: state.doc.length }], false).size, 0);
});

test('editor checks full token boundaries at viewport edges without duplicate widgets', () => {
  const state = EditorState.create({ doc: '#11223380 #aabbcc\n#4455667' });
  const decorations = buildDecorations(state, [{ from: 2, to: 6 }, { from: 10, to: 15 }, { from: 17, to: state.doc.length }], true);
  assert.equal(decorations.size, 2);
});

test('a real CodeMirror swatch edits only the clicked occurrence and rejects a stale target', () => {
  const dom = new JSDOM('<div id="editor"></div>', { pretendToBeVisual: true });
  installObsidianDom(dom);
  const globals = ['window', 'document', 'MutationObserver'] as const;
  const previous = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  for (const key of globals) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom.window : dom.window[key] });
  const live = StateField.define({ create: () => true, update: value => value });
  let target: ColorTarget | undefined;
  const view = new EditorView({
    parent: dom.window.document.querySelector('#editor')!,
    state: EditorState.create({ doc: '#aabbcc and #aabbcc', extensions: [live, createHexEditorExtension(live, next => { target = next; })] }),
  });
  try {
    const swatches = view.dom.querySelectorAll<HTMLElement>('.hex-preview-swatch');
    assert.equal(swatches.length, 2);
    swatches[1].click();
    target!.apply!('#11223380');
    assert.equal(view.state.doc.toString(), '#aabbcc and #11223380');
    view.dom.querySelector<HTMLElement>('.hex-preview-swatch')!.click();
    view.dispatch({ changes: { from: 0, insert: 'New text ' } });
    assert.throws(() => target!.apply!('#ffffff'), /note changed/);
    assert.equal(view.state.doc.toString(), 'New text #aabbcc and #11223380');
  } finally {
    view.destroy(); dom.window.close();
    globals.forEach((key, i) => {
      if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
});
