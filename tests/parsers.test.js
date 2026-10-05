'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeText, extensionOf, parseMusicXml, parseMidi } = require('../src/parsers');

test('decodes UTF-8 and UTF-16LE note text', () => {
  assert.equal(decodeText(Buffer.from('\uFEFFMerhaba', 'utf8')), 'Merhaba');
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Not', 'utf16le')]);
  assert.equal(decodeText(utf16), 'Not');
});

test('identifies document extensions without regard to case', () => {
  assert.equal(extensionOf('C:/Kitaplar/DERS.BRF'), 'brf');
  assert.equal(extensionOf('solfej.musicxml'), 'musicxml');
});

test('speaks simple MusicXML in Turkish solfege terms', () => {
  const xml = `<?xml version="1.0"?><score-partwise version="3.1"><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><type>quarter</type></note><note><rest/><type>quarter</type></note><note><pitch><step>D</step><alter>1</alter><octave>4</octave></pitch><type>half</type></note></measure></part></score-partwise>`;
  const speech = parseMusicXml(xml);
  assert.match(speech, /3 nota bulundu/u);
  assert.match(speech, /do 4\. oktav dörtlük/u);
  assert.match(speech, /dörtlük sus/u);
  assert.match(speech, /re diyez 4\. oktav ikilik/u);
});

test('speaks note-on events from a small MIDI track', () => {
  const midi = Buffer.from([
    // Header: format 0, one track, 96 ticks / quarter
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
    // Track: delta 0 note on C4, delta 96 note off, end of track
    0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 12,
    0, 0x90, 60, 100, 0x60, 0x80, 60, 0, 0, 0xff, 0x2f, 0
  ]);
  assert.match(parseMidi(midi), /do, 4\. oktav, kanal 1/u);
});
