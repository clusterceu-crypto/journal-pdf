import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => {
  if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a;
}, []));
if (!args.zip || !args['type-b'] || !args.font || !args.out) {
  console.error('Usage: node tests/run-tests.mjs --zip group.zip --type-b example.xlsx --font Tinos-Regular.ttf --out result.pdf');
  process.exit(2);
}
const base = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
for (const f of ['archive.js','workbook-parser.js','journal-parser.js','validation.js','pdf-generator.js']) await import(pathToFileURL(path.join(base,'js',f)));

const results = [];
function test(name, fn) {
  try { const detail = fn(); results.push({ name, ok: true, detail }); }
  catch (e) { results.push({ name, ok: false, detail: e.message || String(e) }); }
}
function ab(buf) { return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); }
async function parseXlsx(bytes, display) {
  const wb = await JournalWorkbook.parseWorkbook(ab(bytes), display);
  return JournalParser.analyzeWorkbook(wb);
}

const groupBytes = fs.readFileSync(args.zip);
const outer = new JournalArchive.ZipReader(ab(groupBytes));
const entries = outer.listFiles().filter((e) => /\.(xlsx|xlsm)$/i.test(e.name) && !/(^|\/)~\$/.test(e.name));
const disciplines = [], warnings = [];
for (const e of entries) {
  const bytes = await outer.readEntry(e);
  const display = JournalArchive.decodeGoogleUnicodeName(e.name);
  const a = await parseXlsx(bytes, display);
  disciplines.push(a.discipline); warnings.push(...a.warnings);
}
const fontBytes = fs.readFileSync(args.font);
const pdf = await JournalPdf.generatePdf(disciplines, {}, { fontBytes, group: 'TEST' });
fs.writeFileSync(args.out, pdf.bytes);

const typeBBytes = fs.readFileSync(args['type-b']);
const typeB = await parseXlsx(typeBBytes, path.basename(args['type-b']));
const typeBPdf = await JournalPdf.generatePdf([typeB.discipline], {}, { fontBytes, group: 'TYPE-B-TEST' });

const sourceKeys = new Set(disciplines.flatMap((d) => d.sourceManifest.map((s) => s.key)));
const renderedKeys = new Set(pdf.renderedSourceKeys);
const missing = [...sourceKeys].filter((k) => !renderedKeys.has(k));
const redKeys = new Set(disciplines.flatMap((d) => d.sourceManifest.filter((s) => s.isRed).map((s) => s.key)));
const renderedRed = new Set(pdf.renderedRedSourceKeys);
const missingRed = [...redKeys].filter((k) => !renderedRed.has(k));

test('Test 1 — multi-subject ZIP', () => {
  if (entries.length !== disciplines.length) throw new Error(`${entries.length} Excel files but ${disciplines.length} disciplines`);
  if (pdf.bytes.length < 1000 || pdf.pages < disciplines.length) throw new Error('Final group PDF was not generated correctly');
  return `${entries.length} files -> ${disciplines.length} disciplines -> ${pdf.pages} pages`;
});

test('Test 2 — Type A', () => {
  const d = disciplines.find((x) => x.type === 'A' && x.grade && x.topics && x.grade.sheet === x.topics.sheet);
  if (!d) throw new Error('No Type A discipline detected');
  return `${d.subject}: ${d.grade.sheet}`;
});

test('Test 3 — Type B', () => {
  const d = typeB.discipline;
  if (d.type !== 'B' || !d.grade || !d.topics || d.grade.sheet === d.topics.sheet) throw new Error('Type B sheets were not merged into one discipline');
  if (typeBPdf.pages < 2) throw new Error('Type B PDF did not render grades and topics');
  return `grade=${d.grade.sheet}, topics=${d.topics.sheet}, students=${d.grade.students.length}, pages=${typeBPdf.pages}`;
});

test('Test 4 — topic continuations', () => {
  const d = disciplines.find((x) => x.stats?.topicContinuationsMerged > 0);
  if (!d) throw new Error('No continuation fixture found');
  const row = d.topics.rows.find((r) => (r.sourceRows || []).length > 1);
  if (!row) throw new Error('Continuation count exists but merged row not found');
  const expected = row.topic.segments.map((s) => s.text).join('\n');
  if (row.topic.text !== expected) throw new Error('Merged topic text differs from exact source segments');
  return `${d.subject}: ${d.stats.topicContinuationsMerged} continuation rows merged with exact source text`;
});

test('Test 5 — red dispatcher marks', () => {
  if (!redKeys.size) throw new Error('No red source cells found in fixture');
  if (missingRed.length) throw new Error(`${missingRed.length} red source cells were not rendered as red`);
  const raw = Buffer.from(pdf.bytes).toString('latin1');
  if (!raw.includes('0.85 0 0 rg')) throw new Error('PDF content has no red text operator');
  return `${redKeys.size} red source cells retained as red`;
});

test('Test 6 — few grade columns', () => {
  const d = disciplines.filter((x) => x.grade?.headers?.length > 0 && x.grade.headers.length <= 12).sort((a,b)=>a.grade.headers.length-b.grade.headers.length)[0];
  if (!d) throw new Error('No small-date discipline found');
  const pages = pdf.pageInfo.filter((p) => p.kind === 'grades' && p.subject === d.subject);
  const expected = 8 * JournalPdf.PT_PER_MM;
  if (!pages.length || pages.some((p) => Math.abs(p.gradeWidth - expected) > 0.001)) throw new Error('Grade width is not fixed at 8 mm');
  const available = JournalPdf.A4.width - 20 * JournalPdf.PT_PER_MM;
  if (pages[0].tableWidth >= available - 1) throw new Error('Small grade table was stretched to page width');
  return `${d.subject}: ${d.grade.headers.length} columns, width=8 mm, table=${(pages[0].tableWidth/JournalPdf.PT_PER_MM).toFixed(1)} mm`;
});

test('Test 7 — many grade columns', () => {
  const d = disciplines.filter((x) => x.grade?.headers?.length >= 50).sort((a,b)=>b.grade.headers.length-a.grade.headers.length)[0];
  if (!d) throw new Error('No many-date discipline found');
  const pages = pdf.pageInfo.filter((p) => p.kind === 'grades' && p.subject === d.subject);
  if (pages.length < 2) throw new Error('Many grade columns were not paginated');
  const expected = 8 * JournalPdf.PT_PER_MM;
  if (pages.some((p) => Math.abs(p.gradeWidth - expected) > 0.001)) throw new Error('Grade widths differ across pages');
  if (pages.some((p) => p.studentCount !== d.grade.students.length)) throw new Error('Full student list not repeated on a grade page');
  return `${d.subject}: ${d.grade.headers.length} columns -> ${pages.length} grade pages; ${d.grade.students.length} students repeated each page`;
});

test('Test 8 — problem-cell decisions', () => {
  const w = warnings.find((x) => x.correctable && x.cell);
  if (!w) throw new Error('No correctable Excel problem found in fixture');
  const src = disciplines.flatMap((d)=>d.sourceManifest).find((s)=>s.key===w.id);
  if (!src) throw new Error('Warning source cell missing from model');
  const keep = JournalValidation.resolveSource(src, { [src.key]: { mode:'keep' } }).text;
  const replace = JournalValidation.resolveSource(src, { [src.key]: { mode:'replace', value:'MANUAL_TEST' } }).text;
  const blank = JournalValidation.resolveSource(src, { [src.key]: { mode:'blank' } }).text;
  if (keep !== src.text || replace !== 'MANUAL_TEST' || blank !== '') throw new Error('PDF-only override modes failed');
  return `${w.file} | ${w.sheet}!${w.cell}: keep / replace / blank verified`;
});

test('Data-loss audit — model to PDF', () => {
  if (missing.length) throw new Error(`${missing.length} recognized source cells not represented in PDF render manifest`);
  if (missingRed.length) throw new Error(`${missingRed.length} red source cells lost their red rendering`);
  return `${sourceKeys.size} recognized source cells represented; 0 missing; ${redKeys.size} red cells represented as red`;
});

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({
  version:'1.2.0', files:entries.length, disciplines:disciplines.length, warnings:warnings.length,
  pages:pdf.pages, typeBWarnings:typeB.warnings.length, sourceCells:sourceKeys.size, redSourceCells:redKeys.size,
  results,
}, null, 2));
process.exit(failed.length ? 1 : 0);
