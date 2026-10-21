import assert from 'node:assert/strict';
import test from 'node:test';
import { formatHex, hexToRGB, hsvToRGB, rgbToHSV } from '../src/color';
import { locateReadingEdit, replaceProperty, replaceText } from '../src/edits';

test('RGB and wheel colors round-trip including black, gray and hue boundaries', () => {
  for (const hex of ['#000000', '#ffffff', '#808080', '#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#23264f', '#010203', '#feff01']) {
    const rgb = hexToRGB(hex);
    assert.deepEqual(hsvToRGB(rgbToHSV(rgb)), rgb, hex);
  }
});

test('hex output preserves original alpha length and letter case', () => {
  const rgb = { r: 170, g: 187, b: 204 };
  assert.equal(formatHex(rgb, 128, '#23264F80'), '#AABBCC80');
  assert.equal(formatHex(rgb, 255, '#23264fff'), '#aabbccff');
  assert.equal(formatHex(rgb, 255, '#23264f'), '#aabbcc');
  assert.equal(formatHex(rgb, 0, '#23264F'), '#AABBCC00');
});

test('Reading view targets only the selected duplicate and rejects a stale note', () => {
  const snapshot = 'Heading\n\nFirst #aabbcc, second `#aabbcc`.\n';
  const edit = locateReadingEdit(snapshot, 2, 2, '#aabbcc', 1, 2)!;
  assert.equal(replaceText(snapshot, edit, '#00000080'), 'Heading\n\nFirst #aabbcc, second `#00000080`.\n');
  assert.throws(() => replaceText('Changed\n' + snapshot, edit, '#000000'), /note changed/);
  assert.equal(locateReadingEdit(snapshot, 2, 2, '#aabbcc', 0, 1), null);
  assert.equal(locateReadingEdit(snapshot, 2, 2, '#aabbcc', -1, 2), null);
});

test('Bases edits the exact list index and refuses a reordered or changed property', () => {
  const before = ['#aabbcc', 'other', '#aabbcc'];
  assert.deepEqual(replaceProperty(before, before, 2, '#aabbcc', '#112233'), ['#aabbcc', 'other', '#112233']);
  assert.deepEqual(before, ['#aabbcc', 'other', '#aabbcc']);
  assert.throws(() => replaceProperty(['#aabbcc', '#aabbcc', 'other'], before, 2, '#aabbcc', '#112233'), /property changed/);
  assert.throws(() => replaceProperty(before, before, 1, '#aabbcc', '#112233'), /identify/);
  assert.equal(replaceProperty(' #aabbcc ', ' #aabbcc ', null, '#aabbcc', '#11223380'), ' #11223380 ');
  assert.deepEqual(replaceProperty([' #aabbcc '], [' #aabbcc '], 0, '#aabbcc', '#112233'), [' #112233 ']);
});
