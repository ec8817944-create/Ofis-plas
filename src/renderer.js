'use strict';

const editor = document.querySelector('#editor');
const openButton = document.querySelector('#open-button');
const newButton = document.querySelector('#new-button');
const saveButton = document.querySelector('#save-button');
const readButton = document.querySelector('#read-button');
const selectionButton = document.querySelector('#selection-button');
const stopButton = document.querySelector('#stop-button');
const rateInput = document.querySelector('#rate-input');
const rateOutput = document.querySelector('#rate-output');
const voiceSelect = document.querySelector('#voice-select');
const documentName = document.querySelector('#document-name');
const documentFormat = document.querySelector('#document-format');
const documentKind = document.querySelector('#document-kind');
const wordCount = document.querySelector('#word-count');
const liveStatus = document.querySelector('#live-status');
const urgentStatus = document.querySelector('#urgent-status');
const helpDialog = document.querySelector('#help-dialog');
const saveDialog = document.querySelector('#save-dialog');
const helpButton = document.querySelector('#help-button');
const closeHelp = document.querySelector('#close-help');
const saveForm = document.querySelector('#save-form');
const cancelSave = document.querySelector('#cancel-save');
const saveName = document.querySelector('#save-name');

const state = {
  name: 'Yeni, kaydedilmemiş not',
  format: 'TXT',
  kind: 'text',
  dirty: false,
  reading: false,
  paused: false,
  voices: []
};

function announce(message, urgent = false) {
  const target = urgent ? urgentStatus : liveStatus;
  // Clear first so the same notification is announced more than once.
  target.textContent = '';
  window.setTimeout(() => { target.textContent = message; }, 30);
}

function updateDocumentDetails() {
  documentName.textContent = state.name;
  documentFormat.textContent = state.format;
  const descriptions = {
    text: 'Metin belgesi. Düzenleyebilir ve sesli olarak okuyabilirsiniz.',
    braille: 'BRF Braille belgesi. İçeriği düzenleyebilir ve sesli olarak okuyabilirsiniz.',
    music: 'Müzik notası. Nota adları konuşma için düzenlenmiş olarak gösteriliyor.'
  };
  documentKind.textContent = descriptions[state.kind] || descriptions.text;
}

function updateWordCount() {
  const trimmed = editor.value.trim();
  const count = trimmed ? trimmed.split(/\s+/u).length : 0;
  wordCount.textContent = `${count} kelime`;
}

function rateLabel(rate) {
  if (rate < 0.8) return 'Yavaş';
  if (rate < 1.2) return 'Normal';
  if (rate < 1.6) return 'Hızlı';
  return 'Çok hızlı';
}

function currentVoice() {
  return state.voices.find((voice) => voice.voiceURI === voiceSelect.value);
}

function stopReading(announceStop = true) {
  window.speechSynthesis.cancel();
  state.reading = false;
  state.paused = false;
  readButton.setAttribute('aria-pressed', 'false');
  readButton.innerHTML = 'Okumayı başlat <span aria-hidden="true">(F5)</span>';
  if (announceStop) announce('Okuma durduruldu.');
}

function splitForSpeech(text) {
  // Browsers can silently stop a very long utterance. Keeping chunks moderate is more reliable.
  const sentences = text.replace(/\s+/gu, ' ').trim().match(/[^.!?;]+[.!?;]*|.+$/gu) || [];
  const chunks = [];
  let chunk = '';
  for (const sentence of sentences) {
    if ((chunk + sentence).length > 900 && chunk) {
      chunks.push(chunk.trim());
      chunk = sentence;
    } else {
      chunk += ` ${sentence}`;
    }
  }
  if (chunk.trim()) chunks.push(chunk.trim());
  return chunks;
}

function speak(text, label = 'Metin') {
  const clean = String(text || '').trim();
  if (!clean) {
    announce('Okunacak metin yok.', true);
    return;
  }
  stopReading(false);
  const chunks = splitForSpeech(clean);
  let index = 0;
  state.reading = true;
  readButton.setAttribute('aria-pressed', 'true');
  readButton.innerHTML = 'Okumayı durdur <span aria-hidden="true">(F5)</span>';
  announce(`${label} okunuyor.`);

  const speakNext = () => {
    if (!state.reading || index >= chunks.length) {
      state.reading = false;
      state.paused = false;
      readButton.setAttribute('aria-pressed', 'false');
      readButton.innerHTML = 'Okumayı başlat <span aria-hidden="true">(F5)</span>';
      if (index >= chunks.length) announce('Okuma tamamlandı.');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index++]);
    utterance.lang = 'tr-TR';
    utterance.rate = Number(rateInput.value);
    utterance.pitch = 1;
    const voice = currentVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = speakNext;
    utterance.onerror = (event) => {
      // "canceled" is expected after user chooses stop; other errors should be spoken to the screen reader.
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        stopReading(false);
        announce('Sesli okuma başlatılamadı. Windows konuşma seslerini kontrol edin.', true);
      }
    };
    window.speechSynthesis.speak(utterance);
  };
  speakNext();
}

function populateVoices() {
  const previous = voiceSelect.value;
  state.voices = window.speechSynthesis.getVoices();
  voiceSelect.replaceChildren();
  const fallback = new Option('Windows varsayılan sesi', '');
  voiceSelect.add(fallback);
  for (const voice of state.voices) {
    const option = new Option(`${voice.name} — ${voice.lang}${voice.default ? ' (varsayılan)' : ''}`, voice.voiceURI);
    voiceSelect.add(option);
  }
  voiceSelect.value = [...voiceSelect.options].some((option) => option.value === previous) ? previous : '';
}

function newNote() {
  stopReading(false);
  editor.value = '';
  state.name = 'Yeni, kaydedilmemiş not';
  state.format = 'TXT';
  state.kind = 'text';
  state.dirty = false;
  updateDocumentDetails();
  updateWordCount();
  editor.focus();
  announce('Yeni boş not hazır. Metin alanına yazabilirsiniz.');
}

async function openDocument() {
  stopReading(false);
  const result = await window.sesliNota.chooseDocument();
  if (result.canceled) return;
  if (result.error) {
    announce(result.error, true);
    return;
  }
  const documentInfo = result.document;
  editor.value = documentInfo.text;
  state.name = documentInfo.name;
  state.format = documentInfo.format;
  state.kind = documentInfo.kind;
  state.dirty = false;
  updateDocumentDetails();
  updateWordCount();
  editor.focus();
  editor.setSelectionRange(0, 0);
  const typeLabel = documentInfo.kind === 'music' ? 'Müzik notası' : documentInfo.format;
  announce(`${documentInfo.name} açıldı. ${typeLabel}. ${editor.value.trim() ? 'Okumak için F5 tuşuna basın.' : 'Belge boş.'}`);
}

function openSaveDialog() {
  if (!editor.value.trim()) {
    announce('Kaydedilecek metin yok.', true);
    return;
  }
  const cleanName = state.name.replace(/\.(txt|brf|pdf|musicxml|xml|mid|midi)$/iu, '') || 'Yeni not';
  saveName.value = cleanName;
  saveDialog.showModal();
  saveName.focus();
  saveName.select();
}

async function saveNote() {
  const selected = saveForm.querySelector('input[name="save-type"]:checked');
  const type = selected ? selected.value : 'txt';
  const result = await window.sesliNota.saveDocument({ name: saveName.value, type, text: editor.value });
  if (result.canceled) {
    announce('Kaydetme iptal edildi.');
    return;
  }
  state.name = result.path.split(/[\\/]/u).pop();
  state.format = type.toUpperCase();
  state.kind = type === 'brf' ? 'braille' : 'text';
  state.dirty = false;
  updateDocumentDetails();
  announce(`Not kaydedildi. ${state.name}`);
}

openButton.addEventListener('click', openDocument);
newButton.addEventListener('click', newNote);
saveButton.addEventListener('click', openSaveDialog);
readButton.addEventListener('click', () => {
  if (state.reading) stopReading();
  else speak(editor.value, state.kind === 'music' ? 'Müzik notası' : 'Belge');
});
selectionButton.addEventListener('click', () => {
  const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd);
  speak(selected, 'Seçili metin');
});
stopButton.addEventListener('click', () => stopReading());
rateInput.addEventListener('input', () => {
  rateOutput.textContent = rateLabel(Number(rateInput.value));
  announce(`Okuma hızı: ${rateOutput.textContent}.`);
});
voiceSelect.addEventListener('change', () => {
  const voice = currentVoice();
  announce(voice ? `Ses seçildi: ${voice.name}.` : 'Windows varsayılan sesi seçildi.');
});
editor.addEventListener('input', () => { state.dirty = true; updateWordCount(); });

helpButton.addEventListener('click', () => { helpDialog.showModal(); closeHelp.focus(); });
closeHelp.addEventListener('click', () => { helpDialog.close(); helpButton.focus(); });
cancelSave.addEventListener('click', () => { saveDialog.close(); saveButton.focus(); });
saveForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  saveDialog.close();
  await saveNote();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !helpDialog.open && !saveDialog.open && state.reading) {
    event.preventDefault();
    stopReading();
  }
  if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'r') {
    event.preventDefault();
    const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    speak(selected, 'Seçili metin');
  }
});

window.speechSynthesis.onvoiceschanged = populateVoices;
populateVoices();
updateDocumentDetails();
updateWordCount();

window.sesliNota.onMenuCommand((command) => {
  const actions = {
    open: openDocument,
    new: newNote,
    save: openSaveDialog,
    'toggle-speech': () => readButton.click(),
    'read-selection': () => selectionButton.click(),
    'go-start': () => { editor.focus(); editor.setSelectionRange(0, 0); announce('Metnin başına gidildi.'); },
    help: () => helpButton.click(),
    guide: () => helpButton.click()
  };
  if (actions[command]) actions[command]();
});
