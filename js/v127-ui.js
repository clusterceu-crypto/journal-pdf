(function(root){'use strict';const V='1.2.7';
function stamp(){document.title=`Journal PDF v${V}`;const v=document.getElementById('version');if(v)v.textContent=`Journal PDF v${V}`;}
const original=root.Worker?.prototype?.postMessage;if(original&&!root.Worker.prototype.__jp127){root.Worker.prototype.postMessage=function(message,transfer){if(message&&message.type==='generate'){message={...message,academicYear:String(document.getElementById('academicYear')?.value||'').trim()};}return transfer===undefined?original.call(this,message):original.call(this,message,transfer);};root.Worker.prototype.__jp127=true;}
if(root.JournalValidation?.buildTechnicalReport&&!root.JournalValidation.__jp127Report){const old=root.JournalValidation.buildTechnicalReport;root.JournalValidation.buildTechnicalReport=r=>old({...r,version:V});root.JournalValidation.__jp127Report=true;}
stamp();setTimeout(stamp,0);root.JournalV127UI={VERSION:V,stamp};})(typeof globalThis!=='undefined'?globalThis:self);
