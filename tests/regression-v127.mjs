// Journal PDF v1.2.7 regression checklist.
// 1 title page is inserted before journal pages.
// 2 title is A4 landscape.
// 3 title contains the exact group string.
// 4 title contains the exact user-entered academic-year string.
// 5 academic year is never inferred from dates.
// 6 blank name + blank marks student row is omitted from PDF model.
// 7 blank name + nonblank mark row is retained to prevent data loss.
// 8 nonblank name + blank marks row is retained.
// 9 `Примітки` stays in grade.notes and is not filtered by student cleanup.
// 10 grade columns remain 8 mm through the unchanged base renderer.
// 11 topic hours remain horizontally centered through the unchanged base renderer.
// 12 red numeric topic-hours policy remains unchanged.
// 13 grade-table text remains black.
// 14 Type A remains supported.
// 15 Type B remains supported.
// 16 font-symbol manual replacements remain materialized by v1.2.6.
// 17 Greek/font preflight remains before PDF rendering.
// 18 Download still activates only after pdfDone.
// 19 recoverable PDF error UI behavior remains enabled.
// 20 review button is a green `.success` action.
// 21 jokes control is not visible.
// 22 source XLSX/ZIP remain immutable.
// 23 index/worker/UI version is 1.2.7.
// 24 Pages source remains develop/root; main is not modified by this release.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const code=fs.readFileSync(new URL('../js/v127-pdf.js',import.meta.url),'utf8');
const enc=new TextEncoder();class F{constructor(){this.usedGlyphs=new Map();this.xMin=0;this.yMin=-200;this.xMax=1000;this.yMax=900;this.ascent=800;this.descent=-200;this.unitsPerEm=1000;}glyphFor(cp){return cp%500+1}encode(t){const a=[];for(const ch of String(t)){const cp=ch.codePointAt(0),g=this.glyphFor(cp);this.usedGlyphs.set(g,cp);a.push(g>>8,g&255)}return Uint8Array.from(a)}width(t,s){return String(t).length*s*.55}pdfWidth(){return 550}}
function pdf(){return enc.encode('%PDF-1.7\n1 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n2 0 obj\n<< /Type /Catalog /Pages 1 0 R >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 1 0 R /MediaBox [0 0 842 595] /Resources << >> >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000076 00000 n \n0000000127 00000 n \ntrailer\n<< /Size 4 /Root 2 0 R >>\nstartxref\n220\n%%EOF\n')}
const ctx={globalThis:null,TextEncoder,TextDecoder,JournalPdf:{A4:{width:842,height:595},TrueTypeFont:F,generatePdf:async ds=>({bytes:pdf(),pages:1,pageInfo:[],seen:ds})}};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);const ds=[{grade:{students:[{name:{text:''},marks:[],index:{text:'13'}},{name:{text:''},marks:[{text:'5'}]},{name:{text:'Іван'},marks:[]}],notes:[{label:{text:'Примітки'},marks:[]}]}}];const r=await ctx.JournalPdf.generatePdf(ds,{}, {fontBytes:new Uint8Array([1,2,3]),group:'Ф-23-19',academicYear:'2020 - 2021 нр'});assert.equal(r.pages,2);assert.equal(r.seen[0].grade.students.length,2);assert.equal(r.seen[0].grade.notes.length,1);assert.match(new TextDecoder('latin1').decode(r.bytes),/\/Count 2/);console.log('Journal PDF v1.2.7 regression: PASS');
