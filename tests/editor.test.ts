import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { buildDecorations } from '../src/editor';

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
