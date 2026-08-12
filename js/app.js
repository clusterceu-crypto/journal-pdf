(function () {
  'use strict';
  const APP_VERSION = '1.2.1';
  const $ = (id) => document.getElementById(id);
  const CATEGORY_TITLES = {
    nonstandard_grade: 'Нестандартні оцінки',
    attestation: 'Атестація / переатестація',
    extra_text: 'Зайвий текст між таблицями',
    excel_error: 'Формули / Excel errors',
  };
  let worker = null;
  let warnings = [];
  let overrides = {};
  let stats = {};
  let lastReport = null;
  let downloadUrl = '';

  function safeText(value) { return value === null || value === undefined ? '' : String(value); }
  function decisionWarnings() { return warnings.filter((w) => w.requiresDecision); }
  function pendingWarnings() { return decisionWarnings().filter((w) => !Object.prototype.hasOwnProperty.call(overrides, w.id)); }
  function structuralWarnings() { return warnings.filter((w) => !w.requiresDecision); }
  function newWorker() {
    if (worker) worker.terminate();
    worker = new Worker('js/worker.js');
    worker.addEventListener('message', onWorkerMessage);
    worker.addEventListener('error', (event) => showFatal({ stage: 'worker', errorType: 'WorkerError', message: event.message || 'Помилка Web Worker.' }));
  }
  function clearDownload() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = '';
    $('downloadBtn').removeAttribute('href'); $('downloadBtn').classList.add('disabled'); $('downloadBtn').setAttribute('aria-disabled', 'true');
  }
  function resetUi() {
    warnings = []; overrides = {}; stats = {}; lastReport = null; clearDownload();
    $('zipName').textContent='—'; $('groupName').textContent='—'; $('subjectCount').textContent='0'; $('autoCount').textContent='0'; $('decisionCount').textContent='0';
    $('subjectList').innerHTML=''; $('warningsList').textContent='Попереджень немає.'; $('pdfInfo').textContent='';
    $('reviewBtn').disabled=true; $('generateBtn').disabled=true; $('copyReportBtn').disabled=true;
    JournalProgress.setProgress(0,'Очікую ZIP-архів.','');
  }
  function showFatal(report) {
    lastReport={version:APP_VERSION,browser:navigator.userAgent,...report}; $('copyReportBtn').disabled=false;
    JournalProgress.stopJokes(); JournalProgress.setProgress(0,`Помилка: ${report.message||'невідома помилка'}`,report.file||''); $('statusPanel').classList.add('error');
  }
  function updateDecisionUi() {
    const pending=pendingWarnings().length, total=decisionWarnings().length;
    $('decisionCount').textContent=String(total); $('reviewPending').textContent=String(pending);
    $('reviewBtn').disabled=total===0; $('generateBtn').disabled=pending>0 || Number($('subjectCount').textContent)<1;
    $('applyGenerateBtn').disabled=pending>0;
  }
  function onWorkerMessage(event) {
    const msg=event.data||{};
    if(msg.type==='found'){$('subjectCount').textContent=String(msg.total||0);$('groupName').textContent=msg.group||'Група';}
    else if(msg.type==='phase'){JournalProgress.setProgress(msg.percent,msg.message,msg.item);}
    else if(msg.type==='analysisDone'){
      JournalProgress.stopJokes(); JournalProgress.setProgress(100,`Перевірено ${msg.filesCount} з ${msg.filesCount}`,'Перевірку завершено.');
      $('subjectCount').textContent=String(msg.subjectsCount); $('groupName').textContent=msg.group||'Група'; warnings=msg.warnings||[]; stats=msg.stats||{};
      $('autoCount').textContent=String(stats.autoNormalizations||0); renderSubjects(msg.subjects||[]); renderStructuralWarnings(); updateDecisionUi();
      $('copyReportBtn').disabled=warnings.length<1; $('statusPanel').classList.remove('error');
      if(decisionWarnings().length) $('pdfInfo').textContent=`Знайдено ${decisionWarnings().length} випадків, що потребують вашого рішення перед PDF.`;
      else $('pdfInfo').textContent='Нестандартних значень, що потребують рішення, не знайдено.';
    } else if(msg.type==='pdfDone'){
      JournalProgress.stopJokes(); const blob=new Blob([msg.buffer],{type:'application/pdf'}); clearDownload(); downloadUrl=URL.createObjectURL(blob);
      $('downloadBtn').href=downloadUrl; $('downloadBtn').download=msg.fileName||'journal.pdf'; $('downloadBtn').classList.remove('disabled'); $('downloadBtn').setAttribute('aria-disabled','false');
      $('pdfInfo').textContent=`Готово: ${msg.pages} стор. · червоних службових цифр годин: ${msg.audit?.renderedRedHourCells||0} · пропущено порожніх сторінок оцінок: ${msg.audit?.emptyGradePagesSkipped||0}.`;
      JournalProgress.setProgress(100,`Оброблено ${$('subjectCount').textContent} з ${$('subjectCount').textContent} предметів`,'PDF готовий.'); $('generateBtn').disabled=false;
    } else if(msg.type==='fatal')showFatal(msg.report||{});
  }
  function renderSubjects(subjects){const f=document.createDocumentFragment();for(const s of subjects){const li=document.createElement('li');li.textContent=`${safeText(s.subject)} — Type ${safeText(s.type)}`;li.title=safeText(s.file);f.appendChild(li);}$('subjectList').replaceChildren(f);}
  function renderStructuralWarnings(){const host=$('warningsList');host.innerHTML='';const list=structuralWarnings();if(!list.length){host.textContent='Попереджень немає.';return;}for(const w of list){const card=document.createElement('article');card.className='warning-card';const h=document.createElement('h4');h.textContent=w.subject||w.file||w.kind||'Попередження';const p=document.createElement('p');p.textContent=w.message||'';const m=document.createElement('p');m.className='warning-meta';m.textContent=`Файл: ${w.file||'—'} · Аркуш: ${w.sheet||'—'} · Клітинка: ${w.cell||'—'}`;card.append(h,p,m);host.appendChild(card);}}
  function setDecision(ids, mode, value=''){for(const id of ids)overrides[id]=mode==='blank'?{mode:'blank'}:mode==='replace'?{mode:'replace',value}:{mode:'keep'};renderReview();updateDecisionUi();}
  function makeButton(label,fn,cls=''){const b=document.createElement('button');b.type='button';b.textContent=label;if(cls)b.className=cls;b.addEventListener('click',fn);return b;}
  function renderReview(){
    const host=$('reviewGroups');host.innerHTML='';const list=decisionWarnings();const grouped=new Map();
    for(const w of list){const cat=w.category||'nonstandard_grade';const key=`${cat}::${w.groupKey||w.original||w.kind||w.id}`;if(!grouped.has(key))grouped.set(key,{category:cat,items:[]});grouped.get(key).items.push(w);}
    const byCat=new Map();for(const g of grouped.values()){if(!byCat.has(g.category))byCat.set(g.category,[]);byCat.get(g.category).push(g);}
    for(const [cat,groups] of byCat){const sec=document.createElement('section');sec.className='review-category';const title=document.createElement('h3');title.textContent=CATEGORY_TITLES[cat]||cat;sec.appendChild(title);
      for(const g of groups){const items=g.items,first=items[0],card=document.createElement('article');card.className='review-card';const h=document.createElement('h4');h.textContent=`«${safeText(first.original)}» — ${items.length} входж.`;const desc=document.createElement('p');desc.textContent=first.message||'';card.append(h,desc);
        const bulk=document.createElement('div');bulk.className='warning-actions';const ids=items.map(x=>x.id);bulk.append(makeButton('Прибрати всі',()=>setDecision(ids,'blank')),makeButton('Залишити всі',()=>setDecision(ids,'keep')));
        if(first.allowReplace!==false){const input=document.createElement('input');input.type='text';input.placeholder='Нове значення лише для PDF';input.className='override-input';bulk.append(input,makeButton('Замінити всі на…',()=>setDecision(ids,'replace',input.value)));}card.appendChild(bulk);
        const details=document.createElement('details');details.className='case-details';const sum=document.createElement('summary');sum.textContent='Показати конкретні клітинки';details.appendChild(sum);
        for(const w of items){const row=document.createElement('div');row.className='case-row';const meta=document.createElement('div');meta.innerHTML='';const line=document.createElement('strong');line.textContent=`${w.file||'—'} · ${w.subject||'—'}`;const loc=document.createElement('span');loc.textContent=`${w.sheet||'—'}!${w.cell||'—'} · ${w.columnContext||'тип колонки не визначено'}`;meta.append(line,loc);const acts=document.createElement('div');acts.className='case-actions';acts.append(makeButton('Прибрати',()=>setDecision([w.id],'blank')),makeButton('Залишити',()=>setDecision([w.id],'keep')));if(w.allowReplace!==false){const inp=document.createElement('input');inp.type='text';inp.placeholder='Замінити на…';acts.append(inp,makeButton('Замінити',()=>setDecision([w.id],'replace',inp.value)));}const status=document.createElement('em');const d=overrides[w.id];status.textContent=d?`Рішення: ${d.mode==='blank'?'прибрати':d.mode==='keep'?'залишити':`замінити → ${d.value}`}`:'Рішення не вибрано';row.append(meta,acts,status);details.appendChild(row);}card.appendChild(details);
        if(cat==='extra_text'){const hint=document.createElement('p');hint.className='key-hint';hint.textContent='Для цього блоку: Y = Прибрати, N = Залишити (кнопки вище залишаються основним способом).';card.tabIndex=0;card.addEventListener('keydown',(e)=>{if(e.key.toLowerCase()==='y')setDecision(ids,'blank');if(e.key.toLowerCase()==='n')setDecision(ids,'keep');});card.appendChild(hint);}sec.appendChild(card);}
      host.appendChild(sec);}
    updateDecisionUi();
  }
  function openReview(){renderReview();$('reviewDialog').showModal();}
  function startGenerate(){if(pendingWarnings().length){openReview();return;}if(!worker)return;clearDownload();$('generateBtn').disabled=true;$('pdfInfo').textContent='';JournalProgress.startJokes($('jokesToggle').checked);worker.postMessage({type:'generate',overrides});}
  async function pickZip(file){resetUi();newWorker();$('zipName').textContent=file.name;$('statusPanel').classList.remove('error');JournalProgress.startJokes($('jokesToggle').checked);JournalProgress.setProgress(1,'Відкриваю ZIP локально у браузері…',file.name);try{const buffer=await file.arrayBuffer();worker.postMessage({type:'analyze',name:file.name,buffer},[buffer]);}catch(error){showFatal({stage:'analysis',file:file.name,errorType:error.name,message:error.message});}}
  function buildReport(){const w=decisionWarnings()[0]||structuralWarnings()[0]||{};const report=lastReport||{version:APP_VERSION,browser:navigator.userAgent,stage:w.id?'validation':'idle',file:w.file||'',sheet:w.sheet||'',cell:w.cell||'',errorType:w.kind||'',message:w.message||'Немає технічної помилки.'};return JournalValidation.buildTechnicalReport?JournalValidation.buildTechnicalReport({...report,version:APP_VERSION,browser:navigator.userAgent,autoNormalizations:stats.autoNormalizations||0,decisionRequired:decisionWarnings().length,emptyGradePagesSkipped:stats.emptyGradePagesSkipped||0}):[`Journal PDF v${APP_VERSION}`,`Браузер: ${navigator.userAgent}`,`Етап: ${report.stage||''}`,`Файл: ${report.file||''}`,`Аркуш: ${report.sheet||''}`,`Клітинка: ${report.cell||''}`,`Тип: ${report.errorType||''}`,`Технічний текст: ${report.message||''}`].join('\n');}

  $('openBtn').addEventListener('click',()=>$('zipInput').click());$('zipInput').addEventListener('change',(e)=>{const f=e.target.files?.[0];if(f)pickZip(f);e.target.value='';});
  $('reviewBtn').addEventListener('click',openReview);$('generateBtn').addEventListener('click',startGenerate);$('applyGenerateBtn').addEventListener('click',()=>{if(pendingWarnings().length)return; $('reviewDialog').close();startGenerate();});$('closeReviewBtn').addEventListener('click',()=>$('reviewDialog').close());$('cancelReviewBtn').addEventListener('click',()=>$('reviewDialog').close());
  $('copyReportBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(buildReport());$('copyReportBtn').textContent='Технічний звіт скопійовано';setTimeout(()=>{$('copyReportBtn').textContent='Скопіювати технічний звіт';},1800);}catch{const ta=document.createElement('textarea');ta.value=buildReport();document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}});
  $('jokesToggle').addEventListener('change',()=>{if(!$('jokesToggle').checked){JournalProgress.stopJokes();$('waitingJoke').textContent='';}});window.addEventListener('beforeunload',()=>{if(worker)worker.terminate();clearDownload();});
  $('version').textContent=`Journal PDF v${APP_VERSION}`;resetUi();newWorker();
})();
