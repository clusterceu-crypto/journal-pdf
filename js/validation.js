(function (root) {
  'use strict';
  function text(v) { return v === null || v === undefined ? '' : String(v); }
  function norm(v) { return text(v).trim().toLocaleLowerCase('uk-UA'); }
  function isGradeNumber(v) { const s=norm(v); return /^\d{1,2}$/.test(s)&&Number(s)>=1&&Number(s)<=12; }
  function isAttestationHeader(v) { const s=norm(v).replace(/\s+/g,' '); return /^(пере)?атестаці/.test(s)||/(^|\s)(пере)?атестаці/.test(s); }
  function normalizeGradeValue(rawValue,columnContext='grade') {
    const raw=text(rawValue), s=norm(raw); if(!s)return{status:'valid',value:raw,changed:false,reason:'empty'};
    if(columnContext==='attestation'){
      if(isGradeNumber(s))return{status:'valid',value:raw,changed:false,reason:'numeric_attestation'};
      if(s==='н/а')return{status:'valid',value:raw,changed:false,reason:'not_attested'};
      if(s==='н'||s==='на')return{status:'auto',value:'н/а',changed:raw!=='н/а',reason:'attestation_not_attested'};
      return{status:'review',value:raw,changed:false,reason:'nonstandard_attestation'};
    }
    if(isGradeNumber(s))return{status:'valid',value:raw,changed:false,reason:'numeric_grade'};
    if(s==='нб')return{status:'valid',value:raw,changed:false,reason:'absence'};
    if(s==='н')return{status:'auto',value:'нб',changed:true,reason:'normalize_absence'};
    if(s.includes('/')){
      const parts=s.split('/'); if(parts.length!==2)return{status:'review',value:raw,changed:false,reason:'ambiguous_slash'};
      let [left,right]=parts.map(p=>p.trim()); if(left==='н')left='нб'; if(right==='н')right='нб';
      const lg=isGradeNumber(left), rg=isGradeNumber(right), le=left===''||left==='-', re=right===''||right==='-';
      if(lg&&rg)return{status:'valid',value:raw,changed:false,reason:'two_grades'};
      if(le&&(rg||right==='нб'))return{status:'auto',value:right,changed:true,reason:'drop_empty_left'};
      if(re&&(lg||left==='нб'))return{status:'auto',value:left,changed:true,reason:'drop_empty_right'};
      if(left==='нб'&&rg)return{status:'auto',value:right,changed:true,reason:'prefer_grade_over_absence'};
      if(right==='нб'&&lg)return{status:'auto',value:left,changed:true,reason:'prefer_grade_over_absence'};
      if((left==='нб'&&right==='зрх')||(left==='зрх'&&right==='нб'))return{status:'auto',value:'нб',changed:true,reason:'absence_over_credit_marker'};
      return{status:'review',value:raw,changed:false,reason:'ambiguous_slash'};
    }
    return{status:'review',value:raw,changed:false,reason:'nonstandard_grade'};
  }
  function normalizeOverride(o){if(!o||o.mode==='keep'||!o.mode)return{mode:'keep',value:''};if(o.mode==='blank')return{mode:'blank',value:''};if(o.mode==='replace')return{mode:'replace',value:o.value==null?'':String(o.value)};return{mode:'keep',value:''};}
  function hasExplicitOverride(overrides,key){return Boolean(key&&overrides&&Object.prototype.hasOwnProperty.call(overrides,key));}
  function resolveSource(source,overrides){const key=source?.key||'',o=normalizeOverride(overrides?.[key]);if(o.mode==='blank')return{text:'',isRed:Boolean(source?.isRed),key};if(o.mode==='replace')return{text:o.value,isRed:Boolean(source?.isRed),key};return{text:source?.text==null?'':String(source.text),isRed:Boolean(source?.isRed),key};}
  function resolveCell(cell,overrides){
    if(!cell)return{text:'',isRed:false,segments:[],sources:[]}; const sources=Array.isArray(cell.sources)?cell.sources:[];
    if(sources.length===1&&cell.pdfText!==undefined&&!hasExplicitOverride(overrides,sources[0].key)){const src=sources[0];return{text:String(cell.pdfText??''),isRed:Boolean(src.isRed),segments:[{text:String(cell.pdfText??''),isRed:Boolean(src.isRed),key:src.key}],separator:'',sources,autoNormalized:Boolean(cell.autoNormalization)};}
    if(Array.isArray(cell.segments)&&cell.segments.length){const resolved=[];for(const seg of cell.segments){const src=sources.find(s=>s.key===seg.key)||(seg.key?{key:seg.key,text:seg.text,isRed:seg.isRed}:null);const r=src?resolveSource(src,overrides):{text:String(seg.text??''),isRed:Boolean(seg.isRed),key:seg.key||''};if(r.text!=='')resolved.push(r);}const separator=cell.separator===undefined?'':String(cell.separator);return{text:resolved.map(s=>s.text).join(separator),isRed:resolved.length>0&&resolved.every(s=>s.isRed),segments:resolved,separator,sources};}
    if(sources.length>1){const separator=cell.separator===undefined?' ':String(cell.separator);const resolved=sources.map(s=>resolveSource(s,overrides)).filter(s=>s.text!=='');return{text:resolved.map(s=>s.text).join(separator),isRed:resolved.length>0&&resolved.every(s=>s.isRed),segments:resolved,separator,sources};}
    if(sources.length===1){const r=resolveSource(sources[0],overrides);return{text:r.text,isRed:r.isRed,segments:[r],separator:'',sources};}
    return{text:String(cell.text??''),isRed:Boolean(cell.isRed),segments:[{text:String(cell.text??''),isRed:Boolean(cell.isRed),key:''}],separator:'',sources:[]};
  }
  function buildTechnicalReport(input={}){const {version,stage,warning,error,stats}=input,nav=input.browser||(typeof navigator!=='undefined'?navigator.userAgent:'Node/test runtime'),safeError=error?String(error?.message||error):'',w=warning||input,st=stats||input;return[`Journal PDF v${String(version||'1.2.1').replace(/^v/,'')}`,`Браузер: ${nav}`,`Етап: ${stage||'невідомо'}`,`Файл: ${w.file||''}`,`Дисципліна: ${w.subject||''}`,`Аркуш: ${w.sheet||''}`,`Клітинка: ${w.cell||''}`,`Тип: ${w.kind||w.errorType||(error?'technical_error':'')}`,`Автонормалізацій: ${st.autoNormalizations??''}`,`Потребують рішення: ${st.decisionRequired??''}`,`Пропущено порожніх grade-pages: ${st.emptyGradePagesSkipped??''}`,`Технічний текст: ${safeError||w.message||''}`].join('\n');}
  root.JournalValidation={resolveCell,resolveSource,normalizeOverride,buildTechnicalReport,normalizeGradeValue,isGradeNumber,isAttestationHeader,hasExplicitOverride};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.JournalValidation;
})(typeof globalThis!=='undefined'?globalThis:self);
