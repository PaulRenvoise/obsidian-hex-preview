import assert from 'node:assert/strict';
import test from 'node:test';
import { findHex, isHex } from '../src/hex';

test('accepts exactly six or eight case-insensitive hex digits', () => {
  for (const hex of ['#23264F', '#aAbBcC', '#23264f80', '#00000000', '#FFFFFFFF']) assert.ok(isHex(hex), hex);
  for (const hex of ['#abc', '#abcd', '#12345', '#1234567', '#123456789', '#GGGGGG', 'abcdef', ' #aabbcc']) assert.equal(isHex(hex), false, hex);
});

test('finds multiple colors without consuming punctuation or truncating alpha', () => {
  const text = 'Palette: (#aAbBcC), `#23264f80`; #000000/#FFFFFF';
  assert.deepEqual(findHex(text).map(m => m.hex), ['#aAbBcC', '#23264f80']);
  for (const match of findHex(text)) assert.equal(text.slice(match.from, match.to), match.hex);
  assert.deepEqual(findHex('#000000, #ffffff #ABCDEF80').map(m => m.hex), ['#000000', '#ffffff', '#ABCDEF80']);
});

test('rejects partial values, identifiers, nested tags, URLs and escaped hashes', () => {
  for (const text of ['#123456789', '#1234567', '#abcdefg', 'id#123456', 'é#abcdef', '#abcdef_suffix', '#abcdef-tag', '#tag/abcdef', 'https://example.com/#abcdef', 'https://example.com?q=#abcdef', '\\#abcdef']) {
    assert.deepEqual(findHex(text), [], text);
  }
});
