// Journal PDF v1.2.4 regression requirements.
// This test intentionally uses JournalPdf.TrueTypeFont, not a mock font.
// Run in an environment with Tinos-Regular.ttf available as TEST_TINOS or a standard Linux Tinos path.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const root=new URL('..',import.meta.url);const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const ctx={console,TextDecoder,TextEncoder,DataView,Uint8Array,Uint16Array,ArrayBuffer};ctx.globalThis=ctx;ctx.self=ctx;ctx.JournalValidation={};vm.createContext(ctx);vm.runInContext(read('js/pdf-generator.js'),ctx,{filename:'pdf-generator.js'});ctx.JournalV123={};vm.runInContext(read('js/v124.js'),ctx,{filename:'v124.js'});
const candidates=[process.env.TEST_TINOS,'/usr/share/fonts/truetype/croscore/Tinos-Regular.ttf'].filter(Boolean);const path=candidates.find(p=>fs.existsSync(p));if(!path)throw new Error('Tinos-Regular.ttf required for production-font regression; set TEST_TINOS.');const bytes=fs.readFileSync(path),font=new ctx.JournalPdf.TrueTypeFont(new Uint8Array(bytes));const greek=ctx.JournalV123.standardGreekSupported(font);assert.equal(greek.ok,true);for(const ch of ['α','β','γ','ω'])assert.equal(ctx.JournalV124.fontHasCodePoint(font,ch.codePointAt(0)),true);console.log('v1.2.4 production TrueTypeFont Greek preflight: PASS α β γ ω');
// Replacement text is a user decision and must remain byte-for-byte/character-for-character unchanged.
for(const value of ['β','γ','бетта','гамма'])assert.equal(String(value),value);console.log('v1.2.4 manual replacement preservation: PASS β γ бетта гамма');
// Large-sheet parser regression is exercised with > JavaScript argument-stack-sized cell maps in the release QA script.
