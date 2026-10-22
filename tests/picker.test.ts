import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { ColorPicker } from '../src/picker';
import { decorateCell } from '../src/bases';

function setup() {
  const dom = new JSDOM('<button id="anchor">Swatch</button>', { pretendToBeVisual: true });
  const doc = dom.window.document;
  const anchor = doc.querySelector<HTMLElement>('#anchor')!;
  const picker = new ColorPicker();
  return { dom, doc, anchor, picker };
}

test('picker previews RGB changes without writing, applies once and preserves alpha', async () => {
  const { dom, doc, anchor, picker } = setup();
  const writes: string[] = [];
  picker.open({ anchor, hex: '#23264F80', apply: hex => { writes.push(hex); } });
  const red = doc.querySelector<HTMLInputElement>('[aria-label="Red"]')!;
  red.value = '255'; red.dispatchEvent(new dom.window.Event('input'));
  assert.deepEqual(writes, []);
  assert.equal(doc.querySelector('output')!.textContent, '#FF264F80');
  const apply = doc.querySelector<HTMLButtonElement>('.mod-cta')!;
  apply.click(); apply.click();
  await Promise.resolve();
  assert.deepEqual(writes, ['#FF264F80']);
  assert.equal(doc.querySelector('[role="dialog"]'), null);
  assert.equal(doc.activeElement, anchor);
  dom.window.close();
});

test('Escape and outside clicks cancel without writing; only one popover remains', () => {
  const { dom, doc, anchor, picker } = setup();
  let writes = 0;
  const target = { anchor, hex: '#aabbcc', apply: () => { writes++; } };
  picker.open(target); picker.open(target);
  assert.equal(doc.querySelectorAll('[role="dialog"]').length, 1);
  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(doc.querySelector('[role="dialog"]'), null);
  picker.open(target);
  doc.body.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
  assert.equal(doc.querySelector('[role="dialog"]'), null);
  assert.equal(writes, 0);
  picker.close(); dom.window.close();
});

test('keyboard color selection works and write conflicts are reported without closing', async () => {
  const { dom, doc, anchor, picker } = setup();
  picker.open({ anchor, hex: '#FF0000', apply: () => { throw new Error('The note changed.'); } });
  doc.querySelector('.hex-preview-hue-ring')!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.notEqual(doc.querySelector('output')!.textContent, '#FF0000');
  doc.querySelector<HTMLButtonElement>('.mod-cta')!.click();
  await Promise.resolve();
  assert.match(doc.querySelector('[role="status"]')!.textContent!, /note changed/);
  assert.ok(doc.querySelector('[role="dialog"]'));
  picker.close(); dom.window.close();
});

test('read-only formula colors expose the picker but cannot apply', () => {
  const { dom, doc, anchor, picker } = setup();
  picker.open({ anchor, hex: '#aabbcc', readOnlyReason: 'Calculated value' });
  assert.equal(doc.querySelector<HTMLButtonElement>('.mod-cta')!.disabled, true);
  assert.equal(doc.querySelector('[role="status"]')!.textContent, 'Calculated value');
  picker.close(); dom.window.close();
});

test('close button replaces Cancel and dismisses edits without writing', () => {
  const { dom, doc, anchor, picker } = setup();
  let writes = 0;
  picker.open({ anchor, hex: '#FF0000', apply: () => { writes++; } });
  assert.equal(doc.querySelector('[aria-label="Brightness"]'), null);
  assert.equal(Array.from(doc.querySelectorAll('button')).some(button => button.textContent === 'Cancel'), false);
  const red = doc.querySelector<HTMLInputElement>('[aria-label="Red"]')!;
  red.value = '50'; red.dispatchEvent(new dom.window.Event('input'));
  doc.querySelector<HTMLButtonElement>('[aria-label="Close color picker"]')!.click();
  assert.equal(writes, 0);
  assert.equal(doc.querySelector('[role="dialog"]'), null);
  assert.equal(doc.activeElement, anchor);
  dom.window.close();
});

test('RGB and Hexa edits synchronize the ring, square, channels and opacity', () => {
  const { dom, doc, anchor, picker } = setup();
  picker.open({ anchor, hex: '#000000', apply: () => {} });
  const input = (label: string) => doc.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  const edit = (label: string, value: string) => {
    input(label).value = value; input(label).dispatchEvent(new dom.window.Event('input'));
  };
  const hue = doc.querySelector('.hex-preview-hue-ring')!;
  const square = doc.querySelector<HTMLElement>('.hex-preview-sv-square')!;
  const marker = doc.querySelector<HTMLElement>('.hex-preview-sv-marker')!;
  edit('Green', '255');
  assert.equal(input('Hexa').value, '#00FF00');
  assert.equal(hue.getAttribute('aria-valuenow'), '120');
  assert.equal(square.style.getPropertyValue('--hex-preview-hue'), 'hsl(120, 100%, 50%)');
  assert.equal(marker.style.left, '100%'); assert.equal(marker.style.top, '0%');
  edit('Hexa', '00008080');
  assert.deepEqual(['Red', 'Green', 'Blue'].map(label => input(label).value), ['0', '0', '128']);
  assert.equal(input('Opacity').value, '128');
  assert.equal(hue.getAttribute('aria-valuenow'), '240');
  assert.equal(marker.style.left, '100%');
  assert.ok(Math.abs(parseFloat(marker.style.top) - (1 - 128 / 255) * 100) < 0.001);
  edit('Hexa', '#FFFFFF');
  assert.equal(hue.getAttribute('aria-valuenow'), '240', 'achromatic colors retain selected hue');
  assert.equal(marker.style.left, '0%'); assert.equal(marker.style.top, '0%');
  assert.equal(input('Opacity').value, '128', 'six digits preserve opacity');
  input('Hexa').dispatchEvent(new dom.window.Event('blur'));
  assert.equal(input('Hexa').value, '#FFFFFF80');
  picker.close(); dom.window.close();
});

test('partial Hexa and invalid RGB values cannot be applied', async () => {
  const { dom, doc, anchor, picker } = setup();
  const writes: string[] = [];
  picker.open({ anchor, hex: '#000000', apply: hex => { writes.push(hex); } });
  const hex = doc.querySelector<HTMLInputElement>('[aria-label="Hexa"]')!;
  const red = doc.querySelector<HTMLInputElement>('[aria-label="Red"]')!;
  const apply = doc.querySelector<HTMLButtonElement>('.mod-cta')!;
  for (const value of ['#', '#00FF00F', '#GGFF00']) {
    hex.value = value; hex.dispatchEvent(new dom.window.Event('input'));
    assert.equal(hex.value, value);
    assert.equal(hex.getAttribute('aria-invalid'), 'true');
    assert.equal(apply.disabled, true); apply.click();
  }
  hex.value = '#00FF00FF'; hex.dispatchEvent(new dom.window.Event('input'));
  assert.equal(apply.disabled, false);
  assert.equal(hex.hasAttribute('aria-invalid'), false);
  for (const value of ['', '256', '-1', '1.5']) {
    red.value = value; red.dispatchEvent(new dom.window.Event('input'));
    assert.equal(apply.disabled, true); apply.click();
  }
  assert.deepEqual(writes, []);
  red.value = '128'; red.dispatchEvent(new dom.window.Event('input'));
  assert.equal(hex.value, '#80FF00FF');
  apply.click(); await Promise.resolve();
  assert.deepEqual(writes, ['#80FF00FF']);
  dom.window.close();
});

test('ring and square pointer selection match their displayed colors and clamp drags', () => {
  const { dom, doc, anchor, picker } = setup();
  picker.open({ anchor, hex: '#FF0000', apply: () => {} });
  const hue = doc.querySelector<HTMLElement>('.hex-preview-hue-ring')!;
  const square = doc.querySelector<HTMLElement>('.hex-preview-sv-square')!;
  hue.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 } as DOMRect);
  square.getBoundingClientRect = () => ({ left: 50, top: 50, width: 100, height: 100 } as DOMRect);
  const pointer = (el: HTMLElement, type: string, x: number, y: number) => {
    const event = new dom.window.MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(event, 'pointerId', { value: 1 }); el.dispatchEvent(event);
  };
  pointer(hue, 'pointerdown', 10, 100);
  assert.equal(doc.querySelector('output')!.textContent, '#00FFFF');
  pointer(hue, 'pointerup', 10, 100);
  pointer(hue, 'pointerdown', 100, 100);
  assert.equal(hue.getAttribute('aria-valuenow'), '180', 'gap clicks do not change hue');
  pointer(hue, 'pointerdown', 100, 10);
  assert.equal(doc.querySelector('output')!.textContent, '#80FF00');
  pointer(hue, 'pointerup', 100, 10);
  pointer(square, 'pointerdown', 75, 75);
  assert.equal(doc.querySelector('output')!.textContent, '#A7BF8F');
  pointer(square, 'pointermove', 200, 0);
  assert.equal(doc.querySelector('output')!.textContent, '#80FF00');
  pointer(square, 'pointerup', 200, 0);
  square.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
  assert.equal(doc.querySelector('output')!.textContent, '#73E600');
  assert.equal(hue.getAttribute('aria-valuenow'), '90');
  picker.close(); dom.window.close();
});

test('Bases swatch opens without triggering native text editing or losing its text node', () => {
  const { dom, doc } = setup();
  const cell = doc.createElement('div');
  cell.className = 'bases-table-cell'; cell.textContent = '#aabbcc'; doc.body.append(cell);
  const textNode = cell.firstChild;
  let opens = 0, nativeClicks = 0;
  cell.addEventListener('click', () => { nativeClicks++; });
  decorateCell(cell, (_anchor, value, hex) => { assert.equal(value, cell); assert.equal(hex, '#aabbcc'); opens++; });
  const swatch = cell.querySelector<HTMLElement>('.hex-preview-swatch')!;
  swatch.click();
  swatch.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(opens, 2); assert.equal(nativeClicks, 0);
  assert.equal(cell.lastChild, textNode);
  assert.equal(cell.textContent, '#aabbcc');
  dom.window.close();
});


test('opacity percentage, slider and Hexa keep alpha and wheel transparency synchronized', async () => {
  const { dom, doc, anchor, picker } = setup();
  const writes: string[] = [];
  picker.open({ anchor, hex: '#0080FF', apply: hex => { writes.push(hex); } });
  const input = (label: string) => doc.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  const edit = (label: string, value: string) => {
    input(label).value = value; input(label).dispatchEvent(new dom.window.Event('input'));
  };
  const wheel = doc.querySelector<HTMLElement>('.hex-preview-wheel')!;
  const apply = doc.querySelector<HTMLButtonElement>('.mod-cta')!;
  assert.equal(input('Opacity percent').value, '100');
  assert.equal(input('Opacity').style.getPropertyValue('--hex-preview-opacity-color'), '0, 128, 255');
  edit('Opacity percent', '50');
  assert.equal(input('Opacity').value, '128');
  assert.equal(input('Hexa').value, '#0080FF80');
  assert.equal(Number(wheel.style.getPropertyValue('--hex-preview-alpha')), 128 / 255);
  for (const invalid of ['', '-1', '101', '1.5']) {
    edit('Opacity percent', invalid);
    assert.equal(apply.disabled, true);
    assert.equal(input('Opacity').value, '128');
  }
  edit('Opacity', '0');
  assert.equal(input('Opacity percent').value, '0');
  assert.equal(apply.disabled, false);
  assert.equal(wheel.style.getPropertyValue('--hex-preview-alpha'), '0');
  edit('Opacity percent', '100');
  assert.equal(input('Opacity').value, '255');
  assert.equal(wheel.style.getPropertyValue('--hex-preview-alpha'), '1');
  edit('Hexa', '#FF000040');
  assert.equal(input('Opacity percent').value, '25');
  assert.equal(input('Opacity').value, '64');
  assert.equal(Number(wheel.style.getPropertyValue('--hex-preview-alpha')), 64 / 255);
  assert.equal(input('Opacity').style.getPropertyValue('--hex-preview-opacity-color'), '255, 0, 0');
  edit('Green', '128');
  assert.equal(input('Opacity').style.getPropertyValue('--hex-preview-opacity-color'), '255, 128, 0');
  assert.equal(input('Opacity').value, '64', 'RGB edits preserve exact alpha, not rounded percentage');
  apply.click(); await Promise.resolve();
  assert.deepEqual(writes, ['#FF800040']);
  dom.window.close();
});
