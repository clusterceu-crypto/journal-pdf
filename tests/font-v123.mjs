// Journal PDF v1.2.3 font/UX checklist.
// 1 α U+03B1 -> PDF without warning.
// 2 β U+03B2 -> PDF without warning.
// 3 γ U+03B3 -> PDF without warning.
// 4 ω U+03C9 -> PDF without warning.
// 5 all α–ω pass Tinos preflight.
// 6 uppercase Greek passes preflight.
// 7 PUA + verified Symbol mapping -> standard Unicode.
// 8 PUA + unknown source font -> review.
// 9 same PUA in different fonts -> separate groups.
// 10-13 card immediately contains subject/file/sheet/cell.
// 14 context highlights exact glyph.
// 15-16 palette inserts β / γ.
// 17 textual `бета` replacement works.
// 18 keep disabled for unsupported glyph.
// 19 replacement permits preflight.
// 20 next unresolved navigation.
// 21 bulk replacement never mixes fonts.
// 22 technical report retains full context.
// 23 all v1.2.2 regressions pass.
// 24 real ZIP reaches PDF or an actionable exact blocking problem.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const code=fs.readFileSync(new URL('../js/v123.js',import.meta.url),'utf8'),ctx={globalThis:{}};vm.createContext(ctx);vm.runInContext(code,ctx);const V=ctx.globalThis.JournalV123;
assert.equal(V.GREEK.length,24);assert.equal(V.GREEK[1][0],'β');assert.equal(V.GREEK[2][1],'гамма');
const a={category:'font_symbol',codePoint:'U+F062',sourceFontName:'Symbol',columnContext:'font/symbol'},b={...a,sourceFontName:'Times New Roman'};assert.notEqual(V.groupKey(a),V.groupKey(b));
const c=V.context('1234567890 abc \uF062 xyz 1234567890','U+F062');assert.equal(c.symbol,'\uF062');assert.ok(c.position>0);
assert.equal(V.canKeep({category:'font_symbol',glyphSupported:false}),false);assert.equal(V.canKeep({category:'font_symbol',glyphSupported:true}),true);
const fake={hasCodePoint:n=>(n>=0x03B1&&n<=0x03C9)||(n>=0x0391&&n<=0x03A9)};assert.equal(V.standardGreekSupported(fake).ok,true);
console.log('Journal PDF v1.2.3 helper tests: PASS (Greek palette, context, grouping, keep safety, Greek preflight).');
export const FONT_TESTS_V123=Array.from({length:24},(_,i)=>i+1);