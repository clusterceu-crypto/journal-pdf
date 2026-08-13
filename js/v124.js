(function(root){'use strict';
const V='1.2.4';
function fontHasCodePoint(font,cp){if(font&&typeof font.hasCodePoint==='function')return Boolean(font.hasCodePoint(cp));if(font&&typeof font.glyphFor==='function')return cp===0||font.glyphFor(cp)!==0;return false;}
if(root.JournalPdf?.TrueTypeFont&&!root.JournalPdf.TrueTypeFont.prototype.hasCodePoint){root.JournalPdf.TrueTypeFont.prototype.hasCodePoint=function(cp){return cp===0||this.glyphFor(cp)!==0;};}
if(root.JournalV123){root.JournalV123.fontHasCodePoint=fontHasCodePoint;root.JournalV123.standardGreekSupported=function(font){const lower=[];for(let n=0x03B1;n<=0x03C9;n++){if(n===0x03C2)continue;if(!fontHasCodePoint(font,n))lower.push(`U+${n.toString(16).toUpperCase().padStart(4,'0')}`);}const upper=[];for(const ch of 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ')if(!fontHasCodePoint(font,ch.codePointAt(0)))upper.push(`U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}`);return{ok:!lower.length&&!upper.length,lower,upper};};}
const oldReport=root.JournalValidation?.buildTechnicalReport;if(oldReport){root.JournalValidation.buildTechnicalReport=function(r={}){return oldReport({...r,version:V});};}
root.JournalV124={VERSION:V,fontHasCodePoint};
})(typeof globalThis!=='undefined'?globalThis:self);