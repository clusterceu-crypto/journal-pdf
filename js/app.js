(function () {
  'use strict';
  const APP_VERSION = '1.2.0';
  const $ = (id) => document.getElementById(id);
  let worker = null;
  let warnings = [];
  let overrides = {};
  let lastReport = null;
  let downloadUrl = '';

  function newWorker() {
    if (worker) worker.terminate();
    worker = new Worker('js/worker.js');
    worker.addEventListener('message', onWorkerMessage);
    worker.addEventListener('error', (event) => showFatal({ stage: 'worker', errorType: 'WorkerError', message: event.message || 'Помилка Web Worker.' }));
  }
  function clearDownload() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = '';
    $('downloadBtn').removeAttribute('href');
    $('downloadBtn').classList.add('disabled');
    $('downloadBtn').setAttribute('aria-disabled', 'true');
  }
  function resetUi() {
    warnings = []; overrides = {}; lastReport = null; clearDownload();
    $('zipName').textContent = '—'; $('subjectCount').textContent = '0'; $('warningCount').textContent = '0';
    $('subjectList').innerHTML = ''; $('warningsList').innerHTML = '';
    $('generateBtn').disabled = true; $('copyReportBtn').disabled = true;
    JournalProgress.setProgress(0, 'Очікую ZIP-архів.', '');
  }
  function safeText(value) { return value === null || value === undefined ? '' : String(value); }
  function showFatal(report) {
    lastReport = { version: APP_VERSION, browser: navigator.userAgent, ...report };
    $('copyReportBtn').disabled = false;
    JournalProgress.stopJokes();
    JournalProgress.setProgress(0, `Помилка: ${report.message || 'невідома помилка'}`, report.file || '');
    $('statusPanel').classList.add('error');
  }
  function onWorkerMessage(event) {
    const msg = event.data || {};
    if (msg.type === 'found') {
      $('subjectCount').textContent = String(msg.total || 0);
      $('groupName').textContent = msg.group || 'Група';
    } else if (msg.type === 'phase') {
      JournalProgress.setProgress(msg.percent, msg.message, msg.item);
    } else if (msg.type === 'analysisDone') {
      JournalProgress.stopJokes();
      JournalProgress.setProgress(100, `Перевірено ${msg.filesCount} з ${msg.filesCount}`, 'Перевірку завершено.');
      $('subjectCount').textContent = String(msg.subjectsCount);
      $('warningCount').textContent = String(msg.warnings.length);
      $('groupName').textContent = msg.group || 'Група';
      warnings = msg.warnings || [];
      renderSubjects(msg.subjects || []); renderWarnings();
      $('generateBtn').disabled = msg.subjectsCount < 1;
      $('copyReportBtn').disabled = warnings.length < 1;
      $('statusPanel').classList.remove('error');
    } else if (msg.type === 'pdfDone') {
      JournalProgress.stopJokes();
      const blob = new Blob([msg.buffer], { type: 'application/pdf' });
      clearDownload(); downloadUrl = URL.createObjectURL(blob);
      $('downloadBtn').href = downloadUrl; $('downloadBtn').download = msg.fileName || 'journal.pdf';
      $('downloadBtn').classList.remove('disabled'); $('downloadBtn').setAttribute('aria-disabled', 'false');
      $('pdfInfo').textContent = `Готово: ${msg.pages} стор. PDF. Файл зберігається лише у пам’яті браузера до завантаження/перезавантаження.`;
      JournalProgress.setProgress(100, `Оброблено ${$('subjectCount').textContent} з ${$('subjectCount').textContent} предметів`, 'PDF готовий.');
      $('generateBtn').disabled = false;
    } else if (msg.type === 'fatal') showFatal(msg.report || {});
  }
  function renderSubjects(subjects) {
    const frag = document.createDocumentFragment();
    for (const s of subjects) {
      const li = document.createElement('li');
      li.textContent = `${safeText(s.subject)} — Type ${safeText(s.type)}`;
      li.title = safeText(s.file); frag.appendChild(li);
    }
    $('subjectList').replaceChildren(frag);
  }
  function setOverride(warning, mode, value = '') {
    if (!warning.correctable) return;
    overrides[warning.id] = mode === 'keep' ? { mode: 'keep' } : mode === 'blank' ? { mode: 'blank' } : { mode: 'replace', value };
    renderWarnings();
  }
  function renderWarnings() {
    const host = $('warningsList'); host.innerHTML = '';
    if (!warnings.length) { host.textContent = 'Попереджень немає.'; return; }
    warnings.forEach((w, index) => {
      const card = document.createElement('article'); card.className = 'warning-card';
      const current = overrides[w.id] || { mode: 'keep' };
      const head = document.createElement('h4'); head.textContent = `${index + 1}. ${w.kind || 'warning'} — ${w.file || ''}`; card.appendChild(head);
      const meta = document.createElement('p'); meta.className = 'warning-meta'; meta.textContent = `Аркуш: ${w.sheet || '—'} · Клітинка: ${w.cell || '—'}`; card.appendChild(meta);
      const desc = document.createElement('p'); desc.textContent = w.message || ''; card.appendChild(desc);
      if (w.original !== undefined && w.original !== '') { const orig = document.createElement('p'); orig.className='original'; orig.textContent = `Вихідне значення: ${w.original}`; card.appendChild(orig); }
      if (w.correctable) {
        const input = document.createElement('input'); input.type='text'; input.className='override-input'; input.placeholder='Значення лише для PDF';
        input.value = current.mode === 'replace' ? safeText(current.value) : '';
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
        const buttons = document.createElement('div'); buttons.className='warning-actions';
        const keep = document.createElement('button'); keep.type='button'; keep.textContent='Залишити як є'; keep.className=current.mode==='keep'?'selected':''; keep.onclick=()=>setOverride(w,'keep');
        const replace = document.createElement('button'); replace.type='button'; replace.textContent='Використати введене лише у PDF'; replace.onclick=()=>setOverride(w,'replace',input.value);
        const blank = document.createElement('button'); blank.type='button'; blank.textContent='Порожньо лише у PDF'; blank.className=current.mode==='blank'?'selected':''; blank.onclick=()=>setOverride(w,'blank');
        buttons.append(keep,replace,blank); card.append(input,buttons);
      }
      host.appendChild(card);
    });
  }
  async function pickZip(file) {
    resetUi(); newWorker(); $('zipName').textContent = file.name; $('statusPanel').classList.remove('error');
    JournalProgress.startJokes($('jokesToggle').checked);
    JournalProgress.setProgress(1, 'Відкриваю ZIP локально у браузері…', file.name);
    try { const buffer = await file.arrayBuffer(); worker.postMessage({ type:'analyze', name:file.name, buffer }, [buffer]); }
    catch (error) { showFatal({ stage:'analysis', file:file.name, errorType:error.name, message:error.message }); }
  }
  function buildReport() {
    const w = warnings[0] || {};
    const report = lastReport || {
      version: APP_VERSION, browser: navigator.userAgent, stage: warnings.length ? 'validation' : 'idle',
      file: w.file || '', sheet: w.sheet || '', cell: w.cell || '', errorType: w.kind || '', message: w.message || 'Немає технічної помилки.',
    };
    return [
      `Journal PDF v${report.version || APP_VERSION}`,
      `Браузер: ${report.browser || navigator.userAgent}`,
      `Етап: ${report.stage || ''}`,
      `Файл: ${report.file || ''}`,
      `Аркуш: ${report.sheet || ''}`,
      `Клітинка: ${report.cell || ''}`,
      `Тип: ${report.errorType || ''}`,
      `Технічний текст: ${report.message || ''}`,
    ].join('\n');
  }

  $('openBtn').addEventListener('click', () => $('zipInput').click());
  $('zipInput').addEventListener('change', (e) => { const f=e.target.files?.[0]; if(f) pickZip(f); e.target.value=''; });
  $('generateBtn').addEventListener('click', () => {
    if (!worker) return;
    clearDownload(); $('generateBtn').disabled = true; $('pdfInfo').textContent = '';
    JournalProgress.startJokes($('jokesToggle').checked); worker.postMessage({ type:'generate', overrides });
  });
  $('copyReportBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(buildReport()); $('copyReportBtn').textContent='Технічний звіт скопійовано'; setTimeout(()=>{$('copyReportBtn').textContent='Скопіювати технічний звіт';},1800); }
    catch { const ta=document.createElement('textarea');ta.value=buildReport();document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove(); }
  });
  $('jokesToggle').addEventListener('change', () => { if(!$('jokesToggle').checked) { JournalProgress.stopJokes(); $('waitingJoke').textContent=''; } });
  window.addEventListener('beforeunload', () => { if(worker) worker.terminate(); clearDownload(); });
  $('version').textContent = `Journal PDF v${APP_VERSION}`; resetUi(); newWorker();
})();
