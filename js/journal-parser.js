(function (root) {
  'use strict';

  const Validation = root.JournalValidation;
  if (!Validation) throw new Error('JournalValidation is required before journal-parser.js');

  function text(v) { return v === null || v === undefined ? '' : String(v); }
  function norm(v) { return text(v).replace(/\s+/g, ' ').trim().toLocaleLowerCase('uk-UA'); }
  function nonempty(v) { return text(v).trim() !== ''; }
  function isIntegerLike(v) {
    const s = text(v).trim().replace(',', '.');
    return /^\d+$/.test(s) && Number(s) > 0 && Number(s) < 1000;
  }
  function isRed(hex) {
    const h = text(hex).replace(/^#/, '').slice(-6);
    if (!/^[0-9a-f]{6}$/i.test(h)) return false;
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return r >= 160 && g <= 110 && b <= 110 && r >= g * 1.5 && r >= b * 1.5;
  }
  function cellKey(file, sheet, ref) { return `${file}|${sheet}|${ref}`; }
  function modelCell(file, sheetName, cell) {
    if (!cell) return { text: '', isRed: false, sources: [] };
    const source = {
      key: cellKey(file, sheetName, cell.ref), file, sheet: sheetName, cell: cell.ref,
      text: text(cell.value), isRed: isRed(cell.fontColor), formula: text(cell.formula),
      isError: Boolean(cell.isError), hasCachedFormulaResult: Boolean(cell.hasCachedFormulaResult),
    };
    return { text: text(cell.value), isRed: source.isRed, sources: [source] };
  }
  function combineCells(cells, separator = ' ') {
    const useful = cells.filter((c) => c && nonempty(c.text));
    return {
      text: useful.map((c) => c.text).join(separator),
      isRed: useful.length > 0 && useful.every((c) => c.isRed),
      separator,
      segments: useful.flatMap((c) => (c.sources || []).length ? c.sources.map((src) => ({ text: src.text, isRed: src.isRed, key: src.key })) : [{ text: c.text, isRed: c.isRed, key: '' }]),
      sources: useful.flatMap((c) => c.sources || []),
    };
  }
  function getCell(sheet, r, c) { return sheet.getCell(r, c); }
  function value(sheet, r, c) { return getCell(sheet, r, c)?.value ?? ''; }
  function nonemptyRows(sheet) {
    const rows = [];
    for (const [r, map] of sheet.rows.entries()) {
      if (Array.from(map.values()).some((c) => nonempty(c.value))) rows.push(r);
    }
    rows.sort((a,b)=>a-b);
    return rows;
  }

  function extractMeta(sheet, displayFile) {
    let found = '';
    for (const r of nonemptyRows(sheet).filter((x) => x <= 12)) {
      for (let c = 1; c <= Math.min(sheet.maxCol, 24); c += 1) {
        const v = text(value(sheet, r, c));
        if (/викладач/i.test(v)) { found = v; break; }
      }
      if (found) break;
    }
    let subject = '', teacher = '';
    if (found) {
      const m = /^([\s\S]*?)\s*викладач\s*:?\s*([\s\S]*)$/i.exec(found);
      if (m) { subject = m[1].trim(); teacher = m[2].trim(); }
    }
    if (!subject) subject = displayFile.replace(/^.*\//, '').replace(/\.(xlsx|xlsm)$/i, '').trim();
    return { subject, teacher, raw: found };
  }

  function detectTopicHeader(sheet) {
    let best = null;
    for (const r of nonemptyRows(sheet)) {
      if (r > 450) break;
      let dateCol = null, hoursCol = null, topicCol = null;
      for (let c = 1; c <= Math.min(sheet.maxCol, 40); c += 1) {
        const n = norm(value(sheet, r, c));
        if (!n) continue;
        if (!dateCol && (n === 'дата' || n.startsWith('дата '))) dateCol = c;
        if (!hoursCol && n.includes('кількість') && n.includes('год')) hoursCol = c;
        if (!topicCol && n.includes('тем') && n.includes('занят')) topicCol = c;
      }
      if (dateCol && hoursCol && topicCol) {
        const score = 1000 - r + (topicCol > hoursCol && hoursCol > dateCol ? 20 : 0);
        if (!best || score > best.score) best = { row: r, dateCol, hoursCol, topicCol, score };
      }
    }
    return best;
  }

  function studentPairForCandidate(sheet, headerRow, dateCol, stopRow) {
    let best = null;
    const limit = Math.min(stopRow || (headerRow + 180), headerRow + 180, sheet.maxRow || headerRow + 180);
    for (let idxCol = 1; idxCol <= Math.min(6, Math.max(1, dateCol - 1)); idxCol += 1) {
      const nameCol = idxCol + 1;
      const rows = [];
      let started = false, gaps = 0, seqHits = 0, expected = 1;
      for (let r = headerRow + 1; r <= limit; r += 1) {
        const iv = value(sheet, r, idxCol), nv = value(sheet, r, nameCol);
        if (isIntegerLike(iv) && nonempty(nv)) {
          rows.push(r); started = true; gaps = 0;
          const num = Number(text(iv).trim());
          if (num === expected || (rows.length > 1 && num === Number(text(value(sheet, rows[rows.length-2], idxCol)).trim()) + 1)) seqHits += 1;
          expected = num + 1;
        } else if (started) {
          gaps += 1;
          if (gaps >= 5) break;
        }
      }
      const score = rows.length * 20 + seqHits * 2;
      if (rows.length >= 3 && (!best || score > best.score)) best = { idxCol, nameCol, rows, score };
    }
    return best;
  }

  function detectGradeHeader(sheet, topicHeader) {
    let best = null;
    for (const r of nonemptyRows(sheet)) {
      if (r > 80) break;
      for (let c = 1; c <= Math.min(sheet.maxCol, 16); c += 1) {
        const n = norm(value(sheet, r, c));
        if (!(n === 'дата' || n.startsWith('дата '))) continue;
        if (topicHeader && topicHeader.row === r && topicHeader.dateCol === c) continue;
        const pair = studentPairForCandidate(sheet, r, c, topicHeader ? topicHeader.row - 1 : undefined);
        if (!pair) continue;
        let headerData = 0;
        for (let gc = c + 1; gc <= Math.min(sheet.maxCol, 180); gc += 1) if (nonempty(value(sheet, r, gc))) headerData += 1;
        const score = pair.score + Math.min(headerData, 80) * 3 - r;
        if (!best || score > best.score) best = { row: r, dateCol: c, ...pair, score };
      }
    }
    return best;
  }

  function rowHasNotesLabel(sheet, row, dateCol) {
    for (let c = 1; c <= Math.max(2, dateCol); c += 1) if (norm(value(sheet, row, c)).startsWith('приміт')) return true;
    return false;
  }
  function buildAuxRow(file, sheet, row, dateCol, gradeCols, isNotesRow = false) {
    const prefix = []; for (let c = 1; c <= dateCol; c += 1) prefix.push(modelCell(file, sheet.name, getCell(sheet, row, c)));
    return { sourceRow: row, isNotesRow, label: combineCells(prefix, ' '), marks: gradeCols.map((c) => modelCell(file, sheet.name, getCell(sheet, row, c))) };
  }

  function buildGradeModel(workbook, sheet, info) {
    const file = workbook.displayFile;
    const lastStudent = Math.max(...info.rows);
    const topicHeader = detectTopicHeader(sheet);
    const stop = topicHeader ? topicHeader.row : Math.min(lastStudent + 12, sheet.maxRow + 1);
    const candidateRows = [];
    for (let r = lastStudent + 1; r < stop; r += 1) {
      let any = false; for (let c = 1; c <= Math.min(sheet.maxCol, 180); c += 1) if (nonempty(value(sheet, r, c))) { any = true; break; }
      if (any) candidateRows.push(r);
    }
    const notesAt = candidateRows.findIndex((r) => rowHasNotesLabel(sheet, r, info.dateCol));
    const noteRows = notesAt >= 0 ? candidateRows.slice(0, notesAt + 1) : candidateRows;
    const interstitialRowNumbers = (topicHeader && notesAt >= 0) ? candidateRows.slice(notesAt + 1) : [];
    const relevantRows = [info.row, ...info.rows, ...candidateRows];
    let lastCol = info.dateCol;
    for (let c = info.dateCol + 1; c <= Math.min(sheet.maxCol, 180) + 0; c += 1) if (relevantRows.some((r) => nonempty(value(sheet, r, c)))) lastCol = c;
    const gradeCols = []; for (let c = info.dateCol + 1; c <= lastCol; c += 1) if (relevantRows.some((r) => nonempty(value(sheet, r, c)))) gradeCols.push(c);
    const headers = gradeCols.map((c) => modelCell(file, sheet.name, getCell(sheet, info.row, c)));
    const students = info.rows.map((r) => ({ sourceRow:r, index:modelCell(file,sheet.name,getCell(sheet,r,info.idxCol)), name:modelCell(file,sheet.name,getCell(sheet,r,info.nameCol)), marks:gradeCols.map((c)=>modelCell(file,sheet.name,getCell(sheet,r,c))) }));
    const notes = noteRows.map((r) => buildAuxRow(file, sheet, r, info.dateCol, gradeCols, rowHasNotesLabel(sheet,r,info.dateCol)));
    const interstitialRows = interstitialRowNumbers.map((r) => buildAuxRow(file, sheet, r, info.dateCol, gradeCols, false));
    const columnContexts = headers.map((h,index)=>({index,label:h.text,type:Validation.isAttestationHeader(h.text)?'attestation':'grade'}));
    const meaningfulGradeColumns = gradeCols.filter((_,i)=>nonempty(headers[i]?.text)||students.some((st)=>nonempty(st.marks[i]?.text)));
    return { sheet:sheet.name, headerRow:info.row, dateCol:info.dateCol, gradeCols, headers, students, notes, interstitialRows, columnContexts, meaningfulGradeColumns:meaningfulGradeColumns.length, hasMeaningfulGradeContent:meaningfulGradeColumns.length>0 };
  }

  function buildTopicModel(workbook, sheet, info) {
    const file = workbook.displayFile;
    const rawRows = [];
    let lastRelevant = info.row;
    for (const r of nonemptyRows(sheet)) {
      if (r <= info.row) continue;
      if (r > 700) break;
      const d = value(sheet, r, info.dateCol), h = value(sheet, r, info.hoursCol), t = value(sheet, r, info.topicCol);
      if (nonempty(d) || nonempty(h) || nonempty(t)) lastRelevant = Math.max(lastRelevant, r);
    }
    for (let r = info.row + 1; r <= lastRelevant; r += 1) {
      const d = modelCell(file, sheet.name, getCell(sheet, r, info.dateCol));
      const h = modelCell(file, sheet.name, getCell(sheet, r, info.hoursCol));
      const t = modelCell(file, sheet.name, getCell(sheet, r, info.topicCol));
      if (!nonempty(d.text) && !nonempty(h.text) && !nonempty(t.text)) continue;
      rawRows.push({ sourceRow: r, date: d, hours: h, topic: { ...t, separator: '\n', segments: nonempty(t.text) ? (t.sources || []).map((src) => ({ text: src.text, isRed: src.isRed, key: src.key })) : [] } });
    }
    const rows = [];
    let continuations = 0;
    for (const row of rawRows) {
      const safeContinuation = !nonempty(row.date.text) && !nonempty(row.hours.text) && nonempty(row.topic.text);
      const prev = rows[rows.length - 1];
      if (safeContinuation && prev && nonempty(prev.topic.text)) {
        prev.topic.text += `\n${row.topic.text}`;
        prev.topic.separator = '\n';
        prev.topic.segments = [...(prev.topic.segments || []), ...(row.topic.segments || [])];
        prev.topic.sources.push(...row.topic.sources);
        prev.sourceRows = [...(prev.sourceRows || [prev.sourceRow]), row.sourceRow];
        continuations += 1;
      } else {
        rows.push({ ...row, sourceRows: [row.sourceRow] });
      }
    }
    return {
      sheet: sheet.name, headerRow: info.row, dateCol: info.dateCol, hoursCol: info.hoursCol, topicCol: info.topicCol,
      header: {
        date: modelCell(file, sheet.name, getCell(sheet, info.row, info.dateCol)),
        hours: modelCell(file, sheet.name, getCell(sheet, info.row, info.hoursCol)),
        topic: modelCell(file, sheet.name, getCell(sheet, info.row, info.topicCol)),
      },
      rows, continuations,
    };
  }

  function collectSources(node, out = []) {
    if (!node) return out;
    if (Array.isArray(node)) { node.forEach((x) => collectSources(x, out)); return out; }
    if (typeof node !== 'object') return out;
    if (Array.isArray(node.sources)) out.push(...node.sources);
    for (const [k, v] of Object.entries(node)) if (k !== 'sources' && k !== 'sourceManifest') collectSources(v, out);
    return out;
  }

  function uniqueSources(node) {
    const map = new Map();
    for (const s of collectSources(node, [])) if (s && s.key && nonempty(s.text)) map.set(s.key, s);
    return Array.from(map.values());
  }

  function warningFromSource(source, kind, message, extra = {}) {
    return { id:source.key, kind, message, file:source.file, sheet:source.sheet, cell:source.cell, original:source.text, formula:source.formula||'', correctable:true, requiresDecision:true, allowReplace:true, ...extra };
  }
  function validateSources(sourceManifest, subject) {
    const warnings=[]; for(const s of sourceManifest){
      if(s.formula&&(!s.hasCachedFormulaResult||s.isError)) warnings.push(warningFromSource(s,'formula_error','Формула не має коректного кешованого результату. Формула не виконується; оберіть значення лише для PDF.',{category:'excel_error',groupKey:`excel_error|${norm(s.text)}`,subject,columnContext:'Excel formula/error'}));
      else if(s.isError) warnings.push(warningFromSource(s,'cell_error','У клітинці Excel міститься помилка. Оберіть: прибрати, залишити або замінити лише у PDF.',{category:'excel_error',groupKey:`excel_error|${norm(s.text)}`,subject,columnContext:'Excel error'}));
    } return warnings;
  }
  function applyGradeNormalization(grade, discipline, warnings) {
    if(!grade)return{auto:0}; let auto=0;
    for(let ci=0;ci<grade.headers.length;ci+=1){const context=grade.columnContexts[ci]||{type:'grade',label:grade.headers[ci]?.text||''};
      for(const student of grade.students){const mark=student.marks[ci],src=mark?.sources?.[0]; if(!src||!nonempty(mark.text))continue; if(src.isError||(src.formula&&!src.hasCachedFormulaResult))continue; const r=Validation.normalizeGradeValue(mark.text,context.type);
        if(r.status==='auto'){mark.pdfText=r.value;mark.autoNormalization={from:mark.text,to:r.value,reason:r.reason,columnContext:context.type};auto+=1;}
        else if(r.status==='review'){const category=context.type==='attestation'?'attestation':'nonstandard_grade'; warnings.push(warningFromSource(src,context.type==='attestation'?'nonstandard_attestation':'nonstandard_grade',context.type==='attestation'?'У колонці атестації/переатестації знайдено нестандартне значення.':'У звичайній клітинці оцінки знайдено нестандартне значення.',{category,groupKey:`${category}|${norm(mark.text)}`,subject:discipline.subject,columnContext:context.label||(context.type==='attestation'?'Атестація':'Звичайна оцінка')}));}
      }
    } return{auto};
  }
  function addInterstitialWarnings(grade, discipline, warnings) {
    if(!grade?.interstitialRows?.length)return; for(const row of grade.interstitialRows){const cells=[row.label,...(row.marks||[])].flatMap(c=>c?.sources||[]).filter(s=>nonempty(s.text));if(!cells.length)continue;const refs=cells.map(s=>s.cell),original=cells.map(s=>`${s.cell}: ${s.text}`).join(' | '),id=`interstitial|${discipline.file}|${grade.sheet}|${row.sourceRow}`;row.warningId=id;warnings.push({id,kind:'interstitial_text',category:'extra_text',groupKey:`extra_text|${norm(original)}`,message:'Знайдено зайвий текст між таблицею оцінок і таблицею тем. Вирішіть, чи переносити його в PDF.',file:discipline.file,subject:discipline.subject,sheet:grade.sheet,cell:refs.length===1?refs[0]:`${refs[0]}…${refs[refs.length-1]}`,original,formula:'',correctable:true,requiresDecision:true,allowReplace:false,columnContext:'Між «Примітки» та таблицею тем',sourceKeys:cells.map(s=>s.key)});}
  }

  function analyzeWorkbook(workbook) {
    const displayFile = workbook.displayFile;
    const sheetAnalyses = workbook.sheets.map((sheet) => {
      const topic = detectTopicHeader(sheet);
      const grade = detectGradeHeader(sheet, topic);
      return { sheet, topic, grade, meta: extractMeta(sheet, displayFile) };
    });
    const gradeCandidates = sheetAnalyses.filter((x) => x.grade).sort((a,b)=>b.grade.score-a.grade.score);
    const topicCandidates = sheetAnalyses.filter((x) => x.topic).sort((a,b)=>b.topic.score-a.topic.score);
    const warnings = [];
    const warning = (kind, message, sheet = '', cell = '') => warnings.push({
      id: `${displayFile}|${sheet}|${cell}|${kind}`, kind, category:'structure', message, file: displayFile, subject:'', sheet, cell, original: '', formula: '', correctable: false, requiresDecision:false,
    });

    if (!gradeCandidates.length) warning('structure', 'Не вдалося надійно визначити аркуш з оцінками.');
    if (!topicCandidates.length) warning('structure', 'Не вдалося надійно визначити таблицю «Дата | Кількість годин | Теми занять».');
    if (gradeCandidates.length > 1 && gradeCandidates[1].grade.score >= gradeCandidates[0].grade.score * 0.9) {
      warning('structure', `Виявлено кілька можливих аркушів з оцінками: ${gradeCandidates.slice(0,3).map((x)=>x.sheet.name).join(', ')}.`);
    }
    if (topicCandidates.length > 1 && topicCandidates[1].topic.score >= topicCandidates[0].topic.score * 0.98) {
      warning('structure', `Виявлено кілька можливих таблиць тем: ${topicCandidates.slice(0,3).map((x)=>x.sheet.name).join(', ')}.`);
    }

    const g = gradeCandidates[0] || null;
    const t = topicCandidates[0] || null;
    const grade = g ? buildGradeModel(workbook, g.sheet, g.grade) : null;
    const topics = t ? buildTopicModel(workbook, t.sheet, t.topic) : null;
    const type = g && t ? (g.sheet.name === t.sheet.name ? 'A' : 'B') : 'partial';
    const metaPrimary = g?.meta || t?.meta || { subject: displayFile.replace(/^.*\//,'').replace(/\.(xlsx|xlsm)$/i,''), teacher: '' };
    const metaOther = g && t && g.sheet.name !== t.sheet.name ? t.meta : null;
    if (metaOther && norm(metaPrimary.subject) && norm(metaOther.subject) && norm(metaPrimary.subject) !== norm(metaOther.subject)) {
      warning('structure', `Назва дисципліни відрізняється між аркушами «${g.sheet.name}» та «${t.sheet.name}». Використано назву з аркуша оцінок.`);
    }
    if (metaOther && norm(metaPrimary.teacher) && norm(metaOther.teacher) && norm(metaPrimary.teacher) !== norm(metaOther.teacher)) {
      warning('structure', `ПІБ викладача відрізняється між аркушами «${g.sheet.name}» та «${t.sheet.name}». Використано значення з аркуша оцінок.`);
    }
    if (!metaPrimary.teacher) warning('structure', 'Не вдалося визначити викладача.', g?.sheet.name || t?.sheet.name || '');

    const discipline = {
      file: displayFile,
      subject: metaPrimary.subject,
      teacher: metaPrimary.teacher,
      type,
      grade,
      topics,
      stats: {
        students: grade?.students.length || 0,
        gradeColumns: grade?.headers.length || 0,
        meaningfulGradeColumns: grade?.meaningfulGradeColumns || 0,
        gradePageEligible: Boolean(grade?.students.length && grade?.hasMeaningfulGradeContent),
        emptyGradePageSkippedCandidate: Boolean(grade?.students.length && !grade?.hasMeaningfulGradeContent),
        topicRows: topics?.rows.length || 0,
        topicContinuationsMerged: topics?.continuations || 0,
        autoNormalizations: 0,
      },
    };
    for (const w of warnings) if (!w.subject) w.subject = discipline.subject;
    if (grade && grade.students.length && !grade.hasMeaningfulGradeContent) { warning('structure', 'Список студентів знайдено, але змістовних колонок оцінок/дат/атестації немає. Порожню сторінку оцінок буде пропущено.', grade.sheet); warnings[warnings.length-1].subject=discipline.subject; }
    if (topics && topics.rows.length === 0) { warning('structure', 'Заголовок таблиці тем знайдено, але заповнених рядків тем немає.', topics.sheet); warnings[warnings.length-1].subject=discipline.subject; }
    const normalized=applyGradeNormalization(grade,discipline,warnings); discipline.stats.autoNormalizations=normalized.auto; addInterstitialWarnings(grade,discipline,warnings);
    const sourceManifest = uniqueSources(discipline);
    warnings.push(...validateSources(sourceManifest,discipline.subject));
    discipline.sourceManifest = sourceManifest;
    discipline.stats.selectedSourceCells = sourceManifest.length;
    discipline.stats.redSourceCells = sourceManifest.filter((s)=>s.isRed).length;
    discipline.stats.decisionRequired = warnings.filter((w)=>w.requiresDecision).length;
    return { discipline, warnings };
  }

  root.JournalParser = {
    analyzeWorkbook, detectTopicHeader, detectGradeHeader, extractMeta, uniqueSources, isRed, norm, cellKey,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.JournalParser;
})(typeof globalThis !== 'undefined' ? globalThis : self);
