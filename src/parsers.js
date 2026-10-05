'use strict';

function extensionOf(filePath) {
  const path = require('node:path');
  return path.extname(filePath).toLocaleLowerCase('tr-TR').replace('.', '');
}

function decodeText(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le');
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString('utf16le');
  }
  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

const STEP_NAMES = { C: 'do', D: 're', E: 'mi', F: 'fa', G: 'sol', A: 'la', B: 'si' };
const TYPE_NAMES = {
  whole: 'birlik', half: 'ikilik', quarter: 'dörtlük', eighth: 'sekizlik',
  '16th': 'onaltılık', '32nd': 'otuz ikilik', '64th': 'altmış dörtlük'
};

function decodeXmlText(value) {
  return String(value || '').replace(/<[^>]*>/gu, '').replace(/&amp;/gu, '&').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").trim();
}

function xmlTag(xml, tagName) {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'iu').exec(xml);
  return match ? decodeXmlText(match[1]) : '';
}

function attributeValue(attributes, name) {
  const match = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'iu').exec(attributes || '');
  return match ? match[1] : '';
}

/**
 * Convert common MusicXML partwise notation to a short, speech-friendly Turkish sequence.
 * The parser deliberately reads only the notation elements needed for speech, avoiding a
 * complex external library in the packaged desktop application.
 */
function parseMusicXml(source) {
  const cleaned = String(source || '').replace(/<!--[\s\S]*?-->/gu, '');
  if (!/<score-(?:partwise|timewise)\b/iu.test(cleaned)) {
    throw new Error('Bu XML dosyasında MusicXML nota bilgisi bulunamadı.');
  }
  const partPattern = /<part\b[^>]*>([\s\S]*?)<\/part>/giu;
  const parts = [...cleaned.matchAll(partPattern)];
  if (!parts.length) throw new Error('MusicXML dosyasında okunabilir parti bulunamadı.');

  const phrases = [];
  let noteNumber = 0;
  for (const [partIndex, partMatch] of parts.entries()) {
    const partContent = partMatch[1];
    const measures = [...partContent.matchAll(/<measure\b([^>]*)>([\s\S]*?)<\/measure>/giu)];
    if (parts.length > 1) phrases.push(`${partIndex + 1}. parti`);
    for (const [measureIndex, measureMatch] of measures.entries()) {
      const measureNumber = attributeValue(measureMatch[1], 'number') || String(measureIndex + 1);
      const notes = [...measureMatch[2].matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/giu)];
      if (!notes.length) continue;
      phrases.push(`${measureNumber}. ölçü`);
      for (const noteMatch of notes) {
        const note = noteMatch[1];
        noteNumber += 1;
        const type = TYPE_NAMES[xmlTag(note, 'type')] || '';
        if (/<rest\b[^>]*\/?\s*>/iu.test(note)) {
          phrases.push(`${type ? `${type} ` : ''}sus`);
          continue;
        }
        const pitchMatch = /<pitch\b[^>]*>([\s\S]*?)<\/pitch>/iu.exec(note);
        if (!pitchMatch) continue;
        const pitch = pitchMatch[1];
        const step = xmlTag(pitch, 'step').toUpperCase();
        if (!step) continue;
        const alter = Number(xmlTag(pitch, 'alter') || 0);
        const accidental = alter === 1 ? 'diyez' : alter === -1 ? 'bemol' : alter > 1 ? 'çift diyez' : alter < -1 ? 'çift bemol' : '';
        const octaveValue = xmlTag(pitch, 'octave');
        const octave = octaveValue ? `${octaveValue}. oktav` : '';
        const tie = /<tie\b[^>]*type\s*=\s*["'](?:start|stop)["'][^>]*\/?\s*>/iu.test(note) ? 'bağlı' : '';
        phrases.push([STEP_NAMES[step] || step, accidental, octave, type, tie].filter(Boolean).join(' '));
      }
    }
  }
  if (!noteNumber) throw new Error('MusicXML dosyasında okunabilir nota bulunamadı.');
  return `Müzik notası. ${noteNumber} nota bulundu. ${phrases.join('. ')}.`;
}

function parseMidi(buffer) {
  if (buffer.subarray(0, 4).toString('ascii') !== 'MThd') throw new Error('Geçerli bir MIDI dosyası değil.');
  const tracks = buffer.readUInt16BE(10);
  let offset = 14;
  const events = [];
  const readVLQ = () => {
    let value = 0;
    let byte;
    do {
      if (offset >= buffer.length) throw new Error('MIDI dosyası beklenmedik biçimde sona erdi.');
      byte = buffer[offset++];
      value = (value << 7) | (byte & 0x7f);
    } while (byte & 0x80);
    return value;
  };

  for (let t = 0; t < tracks && offset + 8 <= buffer.length; t += 1) {
    if (buffer.subarray(offset, offset + 4).toString('ascii') !== 'MTrk') break;
    const length = buffer.readUInt32BE(offset + 4);
    const end = Math.min(offset + 8 + length, buffer.length);
    offset += 8;
    let runningStatus = 0;
    while (offset < end) {
      readVLQ();
      let status = buffer[offset++];
      if (status < 0x80) { offset -= 1; status = runningStatus; }
      else if (status < 0xf0) runningStatus = status;
      if (status === 0xff) {
        offset += 1;
        const len = readVLQ();
        offset += len;
      } else if (status === 0xf0 || status === 0xf7) {
        const len = readVLQ();
        offset += len;
      } else {
        const command = status & 0xf0;
        const channel = status & 0x0f;
        const first = buffer[offset++];
        const singleData = command === 0xc0 || command === 0xd0;
        const second = singleData ? undefined : buffer[offset++];
        if (command === 0x90 && second > 0) {
          const octave = Math.floor(first / 12) - 1;
          const chromaticNames = ['do', 'do diyez', 're', 're diyez', 'mi', 'fa', 'fa diyez', 'sol', 'sol diyez', 'la', 'la diyez', 'si'];
          events.push(`${chromaticNames[first % 12]}, ${octave}. oktav, kanal ${channel + 1}`);
        }
      }
    }
    offset = end;
  }
  if (!events.length) throw new Error('Bu MIDI dosyasında çalınacak nota bulunamadı.');
  const shown = events.slice(0, 500);
  const remainder = events.length - shown.length;
  return `MIDI nota dizisi. ${events.length} ses bulundu. ${shown.join('. ')}${remainder ? `. Okunmayan ${remainder} ses var.` : ''}`;
}

module.exports = { decodeText, parseMusicXml, parseMidi, extensionOf };
