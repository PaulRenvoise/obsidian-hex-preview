import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { decorateCell, observeBases } from '../src/bases';
import { clearReading, decorateReading } from '../src/reading';

const mark = '.hex-preview-base-value';
function dom(html: string) { return new JSDOM(html, { pretendToBeVisual: true }); }

test('Bases decorates list pills independently, preserving nodes, controls and text', () => {
  const { window } = dom('<div class="bases-table-cell"><div class="multi-select-container"><div class="multi-select-pill"><div class="multi-select-pill-content">#23264F</div><button>×</button></div><div class="multi-select-pill"><div class="multi-select-pill-content">#23264F80</div></div><div contenteditable="true" tabindex="0"></div></div></div>');
  const cell = window.document.querySelector('div')!;
  const before = cell.textContent;
  const pill = cell.querySelector('.multi-select-pill-content');
  decorateCell(cell);
  decorateCell(cell);
  assert.equal(cell.querySelectorAll(mark).length, 2);
  assert.equal(cell.querySelector('.multi-select-pill-content'), pill);
  assert.equal(cell.textContent, before);
  assert.equal(cell.querySelector('button')?.textContent, '×');
  assert.equal(cell.querySelectorAll(`${mark} ${mark}`).length, 0);
  window.close();
});

test('Bases clears recycled cells and suspends previews while editing', () => {
  const { window } = dom('<div class="bases-table-cell"><div contenteditable="true" tabindex="0">#aabbcc</div></div>');
  const cell = window.document.querySelector('div')!;
  const value = cell.firstElementChild as HTMLElement;
  decorateCell(cell);
  assert.equal(cell.querySelectorAll(mark).length, 1);
  value.focus();
  decorateCell(cell);
  assert.equal(cell.querySelectorAll(mark).length, 0);
  value.blur();
  value.textContent = '#aabbcc80';
  decorateCell(cell);
  assert.equal(value.style.getPropertyValue('--hex-preview-color'), '#aabbcc80');
  value.textContent = 'ordinary text';
  decorateCell(cell);
  assert.equal(value.classList.contains('hex-preview-base-value'), false);
  assert.equal(value.style.getPropertyValue('--hex-preview-color'), '');
  window.close();
});

test('Bases observer handles new rows, text mutations, and teardown', async () => {
  const { window } = dom('<div class="bases-view"></div>');
  const cleanup = observeBases(window.document);
  const root = window.document.querySelector('div')!;
  root.innerHTML = '<div class="bases-table-cell">#ff0000</div>';
  await new Promise(resolve => window.setTimeout(resolve, 50));
  assert.equal(root.querySelectorAll(mark).length, 1);
  const cell = root.firstElementChild as HTMLElement;
  cell.lastChild!.textContent = '#00ff0080';
  await new Promise(resolve => window.setTimeout(resolve, 50));
  assert.equal(cell.style.getPropertyValue('--hex-preview-color'), '#00ff0080');
  cleanup();
  assert.equal(root.querySelectorAll(mark).length, 0);
  cell.textContent = '#ffffff';
  await new Promise(resolve => window.setTimeout(resolve, 50));
  assert.equal(root.querySelectorAll(mark).length, 0);
  window.close();
});

test('Bases ignores file links and invalid or shorthand values', () => {
  const { window } = dom('<div class="bases-table-cell"><span class="internal-link">#abcdef</span><span>#abc</span><span>#abcdefg</span></div>');
  decorateCell(window.document.querySelector('div')!);
  assert.equal(window.document.querySelectorAll(mark).length, 0);
  window.close();
});

test('Reading view handles inline code and tags, skips links and code blocks, and cleans up', () => {
  const { window } = dom('<main><p>Color #23264F and <code>#aabbcc80</code> <a class="tag">#ff0000</a>.</p><pre>#000000</pre><a href="/#ffffff">#ffffff</a><div class="bases-view">#123456</div></main>');
  const root = window.document.querySelector('main')!;
  const before = root.innerHTML;
  decorateReading(root);
  decorateReading(root);
  assert.equal(root.querySelectorAll('.hex-preview-swatch').length, 3);
  assert.equal(root.querySelectorAll('.hex-preview-token .hex-preview-token').length, 0);
  clearReading(root);
  assert.equal(root.innerHTML, before);
  window.close();
});
