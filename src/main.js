'use strict';

const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { decodeText, parseMusicXml, parseMidi, extensionOf } = require('./parsers');

let mainWindow;

const FILE_FILTERS = [
  { name: 'Okunabilir dosyalar', extensions: ['txt', 'brf', 'pdf', 'musicxml', 'xml', 'mid', 'midi'] },
  { name: 'Metin dosyaları', extensions: ['txt'] },
  { name: 'Braille dosyaları', extensions: ['brf'] },
  { name: 'PDF dosyaları', extensions: ['pdf'] },
  { name: 'Müzik dosyaları', extensions: ['musicxml', 'xml', 'mid', 'midi'] }
];

async function textFromPdf(filePath) {
  // PDF.js ships its current legacy Node build as an ES module.
  let pdfjsLib;
  try {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (error) {
    throw new Error('PDF okuyucu başlatılamadı. Uygulamayı yeniden kurup tekrar deneyin.');
  }
  const data = new Uint8Array(await fs.readFile(filePath));
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
  } catch (error) {
    throw new Error('PDF açılamadı. Dosya parolalı, bozuk ya da taranmış görüntü PDF olabilir.');
  }
  const pages = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const words = content.items.map((item) => item.str).filter(Boolean);
    pages.push(`Sayfa ${number}. ${words.join(' ')}`);
  }
  const text = pages.join('\n\n');
  if (!text.replace(/Sayfa \d+\./g, '').trim()) {
    throw new Error('Bu PDF metin içermiyor; taranmış bir belge olabilir. OCR ile metin tanıma henüz uygulamada yok.');
  }
  return text;
}

async function loadDocument(filePath) {
  const ext = extensionOf(filePath);
  const name = path.basename(filePath);
  if (ext === 'pdf') return { name, format: 'PDF', text: await textFromPdf(filePath), path: filePath, kind: 'text' };
  const buffer = await fs.readFile(filePath);
  if (ext === 'musicxml' || ext === 'xml') return { name, format: 'MusicXML', text: parseMusicXml(decodeText(buffer)), path: filePath, kind: 'music' };
  if (ext === 'mid' || ext === 'midi') return { name, format: 'MIDI', text: parseMidi(buffer), path: filePath, kind: 'music' };
  if (ext === 'brf') return { name, format: 'BRF', text: decodeText(buffer), path: filePath, kind: 'braille' };
  if (ext === 'txt') return { name, format: 'TXT', text: decodeText(buffer), path: filePath, kind: 'text' };
  throw new Error('Bu dosya türü desteklenmiyor.');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 760,
    minWidth: 760,
    minHeight: 540,
    backgroundColor: '#0b1521',
    title: 'Sesli Nota',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function sendShortcut(command) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('menu-command', command);
}

function buildMenu() {
  const template = [
    {
      label: 'Dosya',
      submenu: [
        { label: 'Dosya aç', accelerator: 'Ctrl+O', click: () => sendShortcut('open') },
        { label: 'Yeni not', accelerator: 'Ctrl+N', click: () => sendShortcut('new') },
        { label: 'Notu kaydet', accelerator: 'Ctrl+S', click: () => sendShortcut('save') },
        { type: 'separator' },
        { label: 'Çıkış', accelerator: 'Alt+F4', role: 'quit' }
      ]
    },
    {
      label: 'Oku',
      submenu: [
        { label: 'Okumayı başlat / durdur', accelerator: 'F5', click: () => sendShortcut('toggle-speech') },
        { label: 'Seçili metni oku', accelerator: 'Ctrl+R', click: () => sendShortcut('read-selection') },
        { label: 'Başa dön', accelerator: 'Ctrl+Home', click: () => sendShortcut('go-start') }
      ]
    },
    {
      label: 'Yardım',
      submenu: [
        { label: 'Klavye kısayolları', accelerator: 'F1', click: () => sendShortcut('help') },
        { label: 'Kullanım rehberi', click: () => sendShortcut('guide') },
        { label: 'Proje sayfasını aç', click: () => shell.openExternal('https://github.com/ec8817944-create/Ofis-plas') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('document:choose', async () => {
  const answer = await dialog.showOpenDialog(mainWindow, { title: 'Okunacak dosyayı seçin', properties: ['openFile'], filters: FILE_FILTERS });
  if (answer.canceled || !answer.filePaths[0]) return { canceled: true };
  try {
    return { canceled: false, document: await loadDocument(answer.filePaths[0]) };
  } catch (error) {
    return { canceled: false, error: error.message || 'Dosya okunamadı.' };
  }
});

ipcMain.handle('document:save', async (_event, payload) => {
  const requestedName = (payload && payload.name ? String(payload.name) : 'Yeni not').replace(/[\\/:*?"<>|]/g, '-').trim() || 'Yeni not';
  const type = payload && payload.type === 'brf' ? 'brf' : 'txt';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Notu kaydet',
    defaultPath: `${requestedName.replace(/\.(txt|brf)$/i, '')}.${type}`,
    filters: type === 'brf' ? [{ name: 'Braille dosyası', extensions: ['brf'] }] : [{ name: 'Metin dosyası', extensions: ['txt'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, String(payload && payload.text || ''), 'utf8');
  return { canceled: false, path: result.filePath };
});
