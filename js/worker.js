'use strict';
importScripts('archive.js', 'workbook-parser.js', 'validation.js', 'journal-parser.js', 'pdf-generator.js');

const APP_VERSION = '1.2.1';
let currentDisciplines = [];
let currentWarnings = [];
let currentGroup = 'Група';
let currentZipName = '';

function post(type, payload = {}, transfer = []) { self.postMessage({ type, ...payload }, transfer); }
function errorPayload(error, stage, context = {}) {
  return {
    version: APP_VERSION,
    stage,
    file: context.file || '',
    sheet: context.sheet || '',
    cell: context.cell || '',
    errorType: error?.name || 'Error',
    message: error?.message || String(error),
  };
}
function displayName(name) { return JournalArchive.decodeGoogleUnicodeName(name); }
function deriveGroup(files) {
  for (const entry of files) {
    const parts = displayName(entry.name).split('/').filter(Boolean);
    if (parts.length > 1) return parts[0];
  }
  return 'Група';
}
function aggregateStats() {
  return {
    selectedSourceCells: currentDisciplines.reduce((n, d) => n + (d.stats?.selectedSourceCells || 0), 0),
    redSourceCells: currentDisciplines.reduce((n, d) => n + (d.stats?.redSourceCells || 0), 0),
    topicContinuationsMerged: currentDisciplines.reduce((n, d) => n + (d.stats?.topicContinuationsMerged || 0), 0),
    autoNormalizations: currentDisciplines.reduce((n, d) => n + (d.stats?.autoNormalizations || 0), 0),
    decisionRequired: currentWarnings.filter((w) => w.requiresDecision).length,
    structureWarnings: currentWarnings.filter((w) => !w.requiresDecision).length,
    emptyGradePagesSkipped: currentDisciplines.filter((d) => d.stats?.emptyGradePageSkippedCandidate).length,
  };
}

async function analyzeArchive(buffer, zipName) {
  currentDisciplines = [];
  currentWarnings = [];
  currentZipName = zipName || '';
  post('phase', { stage: 'analysis', state: 'running', percent: 0, current: 0, total: 0, item: '', message: 'Перевіряю структуру ZIP…' });
  const zip = new JournalArchive.ZipReader(buffer);
  const files = zip.listFiles().filter((e) => /\.(xlsx|xlsm)$/i.test(e.name) && !/(^|\/)~\$/.test(e.name) && !/(^|\/)__MACOSX\//i.test(e.name));
  if (!files.length) throw new Error('В архіві не знайдено журналів .xlsx або .xlsm.');
  if (files.length > 200) throw new Error('Архів містить понад 200 Excel-журналів; розділіть його на менші архіви.');
  currentGroup = deriveGroup(files);
  post('found', { total: files.length, group: currentGroup });

  for (let i = 0; i < files.length; i += 1) {
    const entry = files[i];
    const file = displayName(entry.name);
    post('phase', {
      stage: 'analysis', state: 'running', current: i, total: files.length,
      percent: Math.round((i / files.length) * 100), item: file,
      message: `Перевірено ${i} з ${files.length}`,
    });
    try {
      const bytes = await zip.readEntry(entry);
      const wb = await JournalWorkbook.parseWorkbook(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), file);
      const result = JournalParser.analyzeWorkbook(wb);
      currentDisciplines.push(result.discipline);
      currentWarnings.push(...result.warnings);
    } catch (error) {
      currentWarnings.push({
        id: `${file}|||workbook`, kind: 'workbook', category: 'structure', groupKey: `workbook|${file}`,
        file, subject: '', sheet: '', cell: '', original: '',
        message: `Не вдалося однозначно прочитати журнал: ${error.message || error}`,
        correctable: false, requiresDecision: false, technical: String(error?.stack || error),
      });
    }
    post('phase', {
      stage: 'analysis', state: 'running', current: i + 1, total: files.length,
      percent: Math.round(((i + 1) / files.length) * 100), item: file,
      message: `Перевірено ${i + 1} з ${files.length}`,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  currentDisciplines.sort((a, b) => String(a.subject).localeCompare(String(b.subject), 'uk'));
  post('analysisDone', {
    version: APP_VERSION,
    zipName: currentZipName,
    group: currentGroup,
    filesCount: files.length,
    subjectsCount: currentDisciplines.length,
    subjects: currentDisciplines.map((d) => ({ subject: d.subject, type: d.type, file: d.file })),
    warnings: currentWarnings,
    stats: aggregateStats(),
  });
}

async function generate(overrides) {
  if (!currentDisciplines.length) throw new Error('Спочатку відкрийте та перевірте архів журналів.');
  const unresolved = currentWarnings.filter((w) => w.requiresDecision && !Object.prototype.hasOwnProperty.call(overrides || {}, w.id));
  if (unresolved.length) throw new Error(`Залишилося ${unresolved.length} нестандартних значень без рішення користувача.`);
  post('phase', { stage: 'pdf', state: 'running', current: 0, total: currentDisciplines.length, percent: 0, item: '', message: 'Готую PDF…' });
  const result = await JournalPdf.generatePdf(currentDisciplines, overrides || {}, {
    group: currentGroup,
    onProgress: async (current, total, item) => {
      post('phase', {
        stage: 'pdf', state: 'running', current, total,
        percent: Math.round((current / Math.max(1, total)) * 100), item,
        message: `Оброблено ${current} з ${total} предметів`,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  });
  post('pdfDone', {
    pages: result.pages,
    fileName: `Журнал_групи_${String(currentGroup || 'Група').replace(/[^0-9A-Za-zА-Яа-яІіЇїЄєҐґ_-]+/g, '_')}.pdf`,
    byteLength: result.bytes.byteLength,
    audit: {
      renderedSourceCells: result.renderedSourceKeys.length,
      renderedRedHourCells: result.renderedRedSourceKeys.length,
      emptyGradePagesSkipped: result.emptyGradePagesSkipped || 0,
    },
    buffer: result.bytes.buffer,
  }, [result.bytes.buffer]);
}

self.addEventListener('message', async (event) => {
  const msg = event.data || {};
  try {
    if (msg.type === 'analyze') await analyzeArchive(msg.buffer, msg.name);
    else if (msg.type === 'generate') await generate(msg.overrides || {});
    else if (msg.type === 'reset') { currentDisciplines = []; currentWarnings = []; currentGroup = 'Група'; currentZipName = ''; }
  } catch (error) {
    post('fatal', { report: errorPayload(error, msg.type === 'generate' ? 'pdf' : 'analysis', msg.context || {}) });
  }
});
