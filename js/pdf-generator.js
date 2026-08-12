(function (root) {
  'use strict';

  const Validation = root.JournalValidation;
  if (!Validation) throw new Error('JournalValidation is required before pdf-generator.js');

  const PT_PER_MM = 72 / 25.4;
  const A4 = { width: 297 * PT_PER_MM, height: 210 * PT_PER_MM };
  const BLACK = [0, 0, 0];
  const RED = [0.85, 0, 0];
  const FONT_URLS = [
    './assets/Tinos-Regular.ttf',
    'https://cdn.jsdelivr.net/gh/googlefonts/tinos@3b4482a99b80ea5fc75f187b1be3120a3f5905b3/fonts/ttf/Tinos-Regular.ttf',
    'https://raw.githubusercontent.com/googlefonts/tinos/3b4482a99b80ea5fc75f187b1be3120a3f5905b3/fonts/ttf/Tinos-Regular.ttf',
  ];

  function u16(v, o) { return v.getUint16(o, false); }
  function i16(v, o) { return v.getInt16(o, false); }
  function u32(v, o) { return v.getUint32(o, false); }
  function tag(v, o) { return String.fromCharCode(v.getUint8(o), v.getUint8(o+1), v.getUint8(o+2), v.getUint8(o+3)); }
  function scale1000(n, upm) { return Math.round(Number(n || 0) * 1000 / upm); }

  class TrueTypeFont {
    constructor(bytes) {
      this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
      this.tables = this._tables();
      const head = this.tables.head, hhea = this.tables.hhea, maxp = this.tables.maxp, hmtx = this.tables.hmtx, cmap = this.tables.cmap;
      if (!head || !hhea || !maxp || !hmtx || !cmap) throw new Error('Tinos TTF пошкоджений або має непідтримувану структуру.');
      this.unitsPerEm = u16(this.view, head.offset + 18);
      this.xMin = i16(this.view, head.offset + 36); this.yMin = i16(this.view, head.offset + 38);
      this.xMax = i16(this.view, head.offset + 40); this.yMax = i16(this.view, head.offset + 42);
      this.ascent = i16(this.view, hhea.offset + 4); this.descent = i16(this.view, hhea.offset + 6);
      this.numGlyphs = u16(this.view, maxp.offset + 4);
      this.numberOfHMetrics = u16(this.view, hhea.offset + 34);
      this.advanceWidths = this._hmtx(hmtx.offset);
      this.cmap = this._cmap(cmap.offset);
      this.usedGlyphs = new Map();
    }
    _tables() {
      const num = u16(this.view, 4); const out = {};
      for (let i=0;i<num;i+=1) {
        const p=12+i*16; const name=tag(this.view,p); out[name]={ checksum:u32(this.view,p+4), offset:u32(this.view,p+8), length:u32(this.view,p+12) };
      }
      return out;
    }
    _hmtx(offset) {
      const widths = new Uint16Array(this.numGlyphs); let last = 0;
      for (let i=0;i<this.numberOfHMetrics;i+=1) { last=u16(this.view, offset+i*4); widths[i]=last; }
      for (let i=this.numberOfHMetrics;i<this.numGlyphs;i+=1) widths[i]=last;
      return widths;
    }
    _cmap(offset) {
      const num = u16(this.view, offset + 2); const records = [];
      for (let i=0;i<num;i+=1) {
        const p=offset+4+i*8; records.push({ platform:u16(this.view,p), encoding:u16(this.view,p+2), subOffset:u32(this.view,p+4) });
      }
      let best = null;
      for (const r of records) {
        const p=offset+r.subOffset; const format=u16(this.view,p);
        const score = format===12 ? 100 + (r.platform===3?10:0) : format===4 ? 50 + (r.platform===3?10:0) : 0;
        if (score && (!best || score>best.score)) best={...r,p,format,score};
      }
      if (!best) throw new Error('Tinos TTF: не знайдено cmap format 4/12.');
      return best.format===12 ? this._cmap12(best.p) : this._cmap4(best.p);
    }
    _cmap12(p) {
      const groups = u32(this.view,p+12); const arr=[];
      for (let i=0;i<groups;i+=1) { const q=p+16+i*12; arr.push([u32(this.view,q),u32(this.view,q+4),u32(this.view,q+8)]); }
      return (cp) => {
        let lo=0,hi=arr.length-1; while(lo<=hi){const mid=(lo+hi)>>1,g=arr[mid]; if(cp<g[0])hi=mid-1; else if(cp>g[1])lo=mid+1; else return g[2]+(cp-g[0]);} return 0;
      };
    }
    _cmap4(p) {
      const segCount=u16(this.view,p+6)/2; const endStart=p+14; const startStart=endStart+segCount*2+2; const deltaStart=startStart+segCount*2; const rangeStart=deltaStart+segCount*2;
      const ends=[],starts=[],deltas=[],ranges=[];
      for(let i=0;i<segCount;i+=1){ends.push(u16(this.view,endStart+i*2));starts.push(u16(this.view,startStart+i*2));deltas.push(i16(this.view,deltaStart+i*2));ranges.push(u16(this.view,rangeStart+i*2));}
      return (cp)=>{
        if(cp>0xffff)return 0;
        for(let i=0;i<segCount;i+=1){ if(cp>ends[i])continue; if(cp<starts[i])return 0; if(ranges[i]===0)return (cp+deltas[i])&0xffff; const roPos=rangeStart+i*2; const glyphPos=roPos+ranges[i]+2*(cp-starts[i]); if(glyphPos+2>this.view.byteLength)return 0; const glyph=u16(this.view,glyphPos); return glyph===0?0:(glyph+deltas[i])&0xffff; } return 0;
      };
    }
    glyphFor(cp) { return this.cmap(cp); }
    encode(text) {
      const out=[];
      for (const ch of String(text || '')) {
        const cp=ch.codePointAt(0); const gid=this.glyphFor(cp);
        if (!gid && cp !== 0) throw new Error(`Шрифт Tinos не містить символ U+${cp.toString(16).toUpperCase().padStart(4,'0')} (${ch}). Дані не замінено.`);
        out.push((gid>>8)&255,gid&255); if (!this.usedGlyphs.has(gid)) this.usedGlyphs.set(gid,cp);
      }
      return new Uint8Array(out);
    }
    width(text,size) {
      let sum=0; for(const ch of String(text||'')){const gid=this.glyphFor(ch.codePointAt(0)); sum += this.advanceWidths[gid] || this.advanceWidths[0] || 0;} return sum * size / this.unitsPerEm;
    }
    pdfWidth(gid) { return scale1000(this.advanceWidths[gid] || this.advanceWidths[0] || 0, this.unitsPerEm); }
  }

  function ascii(s) { return new TextEncoder().encode(s); }
  function concat(parts) { const len=parts.reduce((n,p)=>n+p.length,0); const out=new Uint8Array(len); let o=0; for(const p of parts){out.set(p,o);o+=p.length;} return out; }
  function hex(bytes) { let s=''; for(const b of bytes)s+=b.toString(16).padStart(2,'0'); return s.toUpperCase(); }
  function num(n) { const s=Number(n).toFixed(3); return s.replace(/\.000$/,'').replace(/(\.\d*?)0+$/,'$1'); }
  function colorCmd(c) { return `${num(c[0])} ${num(c[1])} ${num(c[2])} rg`; }
  function escName(name) { return String(name).replace(/[^A-Za-z0-9_.-]/g,'-'); }
  function utf16Hex(cp) {
    if (cp <= 0xffff) return cp.toString(16).padStart(4,'0').toUpperCase();
    const x=cp-0x10000, hi=0xd800+(x>>10), lo=0xdc00+(x&0x3ff); return hi.toString(16).padStart(4,'0').toUpperCase()+lo.toString(16).padStart(4,'0').toUpperCase();
  }

  class PageCanvas {
    constructor(font) { this.font=font; this.commands=[]; this.redTextCalls=0; }
    line(x1,y1,x2,y2,width=0.55) { this.commands.push(`${num(width)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`); }
    rect(x,y,w,h,width=0.55) { this.commands.push(`${num(width)} w ${num(x)} ${num(y)} ${num(w)} ${num(h)} re S`); }
    text(text,x,y,size=8,color=BLACK,rotation=0) {
      if (text === null || text === undefined || String(text)==='') return;
      if (color === RED) this.redTextCalls += 1;
      const bytes=this.font.encode(String(text)); const a=rotation===90?'0 1 -1 0':rotation===-90?'0 -1 1 0':'1 0 0 1';
      this.commands.push(`BT /F1 ${num(size)} Tf ${colorCmd(color)} ${a} ${num(x)} ${num(y)} Tm <${hex(bytes)}> Tj ET`);
    }
    stream() { return ascii(this.commands.join('\n')+'\n'); }
  }

  function splitLongToken(token,color,maxWidth,font,size){
    if(font.width(token,size)<=maxWidth)return [{text:token,color}]; const out=[];let cur='';
    for(const ch of token){const probe=cur+ch;if(cur&&font.width(probe,size)>maxWidth){out.push({text:cur,color});cur=ch;}else cur=probe;} if(cur)out.push({text:cur,color});return out;
  }
  function tokenizeResolved(cell){
    const segs=cell?.segments?.length?cell.segments:[{text:cell?.text||'',isRed:cell?.isRed}]; const sep=cell?.separator??''; const out=[];
    segs.forEach((seg,si)=>{ if(si>0&&sep){ for(const ch of String(sep)) out.push({text:ch,color:BLACK,newline:ch==='\n'}); }
      const parts=String(seg.text||'').replace(/\r\n?/g,'\n').split(/(\n|[^\S\n]+)/).filter((x)=>x!=='');
      for(const p of parts){if(p==='\n')out.push({text:'\n',color:BLACK,newline:true});else out.push({text:p,color:seg.isRed?RED:BLACK});}
    }); return out;
  }
  function wrapResolved(cell,maxWidth,font,size){
    const tokens=tokenizeResolved(cell); const lines=[[]]; let width=0;
    for(const tok of tokens){
      if(tok.newline){lines.push([]);width=0;continue;}
      const pieces=splitLongToken(tok.text,tok.color,maxWidth,font,size);
      for(const piece of pieces){const w=font.width(piece.text,size); if(width>0&&width+w>maxWidth){lines.push([]);width=0;} lines[lines.length-1].push(piece);width+=w;}
    }
    return lines.length?lines:[[]];
  }
  function lineWidth(line,font,size){return line.reduce((s,x)=>s+font.width(x.text,size),0);}
  function drawResolvedLine(canvas,line,x,y,font,size,align,maxWidth){
    const w=lineWidth(line,font,size); let cx=align==='center'?x+(maxWidth-w)/2:align==='right'?x+maxWidth-w:x;
    for(const seg of line){canvas.text(seg.text,cx,y,size,seg.color);cx+=font.width(seg.text,size);}
  }
  function drawResolvedCell(canvas,cell,x,y,w,h,font,{size=8,align='left',padding=2,maxLines=99}={}){
    let fs=size,lines=wrapResolved(cell,Math.max(1,w-padding*2),font,fs),leading=fs*1.18;
    while((lines.length>maxLines||lines.length*leading>h-padding*2)&&fs>4.1){fs-=0.3;leading=fs*1.18;lines=wrapResolved(cell,Math.max(1,w-padding*2),font,fs);}
    const usable=Math.max(0,h-padding*2); const total=Math.min(lines.length,maxLines)*leading; let yy=y+padding+(usable-total)/2+total-leading+fs*0.12;
    for(let i=0;i<Math.min(lines.length,maxLines);i+=1){drawResolvedLine(canvas,lines[i],x+padding,yy,font,fs,align,w-padding*2);yy-=leading;}
    return {fontSize:fs,lines};
  }

  function registerSources(manifest, cell, overrides) {
    if (!cell?.sources) return;
    for (const src of cell.sources) { const r=Validation.resolveSource(src,overrides); if(r.text!=='')manifest.add(src.key); }
  }
  function resolved(cell,overrides,manifest){registerSources(manifest,cell,overrides);return Validation.resolveCell(cell,overrides);}
  function blackCell(cell){if(!cell)return cell;return{...cell,isRed:false,segments:(cell.segments||[]).map(seg=>({...seg,isRed:false}))};}
  function numericRedHoursCell(sourceCell,resolvedCell,renderedRed){const txt=String(resolvedCell?.text||'').trim(),numeric=/^\d+$/.test(txt),redSources=numeric?(sourceCell?.sources||[]).filter(s=>s.isRed):[];if(!numeric||!redSources.length)return blackCell(resolvedCell);for(const src of redSources)renderedRed.add(src.key);return{...resolvedCell,isRed:true,segments:(resolvedCell.segments?.length?resolvedCell.segments:[{text:txt,key:redSources[0]?.key||''}]).map(seg=>({...seg,isRed:true}))};}
  function drawSubjectHeader(c,discipline,font){const subject=discipline.subject||discipline.file||'Журнал',teacher=discipline.teacher?`Викладач: ${discipline.teacher}`:'Викладач:';const sw=font.width(subject,11);c.text(subject,(A4.width-sw)/2,A4.height-24,11,BLACK);const tw=font.width(teacher,9.5);c.text(teacher,(A4.width-tw)/2,A4.height-39,9.5,BLACK);}
  function includedInterstitialRows(grade,overrides){return(grade?.interstitialRows||[]).filter(row=>overrides?.[row.warningId]?.mode==='keep');}
  function gradePages(discipline,font,overrides,manifest,renderedRed){
    const grade=discipline.grade;if(!grade||!grade.students.length||!grade.hasMeaningfulGradeContent)return[];
    const margin=10*PT_PER_MM,idxW=9*PT_PER_MM,nameW=70*PT_PER_MM,gradeW=8*PT_PER_MM,available=A4.width-margin*2,maxCols=Math.max(1,Math.floor((available-idxW-nameW)/gradeW));
    const chunks=[];for(let i=0;i<grade.headers.length;i+=maxCols)chunks.push(Array.from({length:Math.min(maxCols,grade.headers.length-i)},(_,k)=>i+k));if(!chunks.length)return[];const pages=[],extraRows=includedInterstitialRows(grade,overrides);
    for(const chunk of chunks){const c=new PageCanvas(font);drawSubjectHeader(c,discipline,font);const top=A4.height-54,headerH=78,rows=[...grade.students,...grade.notes,...extraRows],bodyAvail=top-margin-headerH,rowH=Math.min(17,bodyAvail/Math.max(1,rows.length));if(rowH<11.5)throw new Error(`Забагато рядків для A4 без втрати читабельності: ${discipline.subject}.`);const tableW=idxW+nameW+chunk.length*gradeW;let y=top-headerH;c.rect(margin,y,idxW,headerH);c.rect(margin+idxW,y,nameW,headerH);drawResolvedCell(c,{text:'№',segments:[{text:'№',isRed:false}]},margin,y,idxW,headerH,font,{size:8.2,align:'center'});drawResolvedCell(c,{text:'ПІБ студента',segments:[{text:'ПІБ студента',isRed:false}]},margin+idxW,y,nameW,headerH,font,{size:8.2,align:'center'});
      chunk.forEach((ci,j)=>{const x=margin+idxW+nameW+j*gradeW;c.rect(x,y,gradeW,headerH);const cell=blackCell(resolved(grade.headers[ci],overrides,manifest)),txt=String(cell.text||'').replace(/\r\n|\r|\n/g,' ');let fs=7,maxH=headerH-8,tw=font.width(txt,fs);if(tw>maxH&&tw>0)fs=Math.max(4.8,fs*maxH/tw);c.text(txt,x+gradeW/2+fs*0.32,y+4,fs,BLACK,90);});
      let ry=y;for(const r of grade.students){ry-=rowH;c.rect(margin,ry,idxW,rowH);c.rect(margin+idxW,ry,nameW,rowH);drawResolvedCell(c,blackCell(resolved(r.index,overrides,manifest)),margin,ry,idxW,rowH,font,{size:7.2,align:'center',padding:1.3,maxLines:2});drawResolvedCell(c,blackCell(resolved(r.name,overrides,manifest)),margin+idxW,ry,nameW,rowH,font,{size:7.7,align:'left',padding:2,maxLines:2});chunk.forEach((ci,j)=>{const x=margin+idxW+nameW+j*gradeW;c.rect(x,ry,gradeW,rowH);drawResolvedCell(c,blackCell(resolved(r.marks[ci],overrides,manifest)),x,ry,gradeW,rowH,font,{size:6.2,align:'center',padding:1,maxLines:2});});}
      for(const r of [...grade.notes,...extraRows]){ry-=rowH;c.rect(margin,ry,idxW+nameW,rowH);drawResolvedCell(c,blackCell(resolved(r.label,overrides,manifest)),margin,ry,idxW+nameW,rowH,font,{size:r.isNotesRow?7.1:6.2,align:'left',padding:2,maxLines:2});chunk.forEach((ci,j)=>{const x=margin+idxW+nameW+j*gradeW;c.rect(x,ry,gradeW,rowH);drawResolvedCell(c,blackCell(resolved(r.marks[ci],overrides,manifest)),x,ry,gradeW,rowH,font,{size:5.8,align:'center',padding:1,maxLines:2});});}
      pages.push({canvas:c,kind:'grades',subject:discipline.subject,gradeColumns:chunk.length,gradeStart:chunk[0]??0,gradeEnd:chunk[chunk.length-1]??-1,tableWidth:tableW,gradeWidth:gradeW,studentCount:grade.students.length,redTextCount:c.redTextCalls,notesRows:grade.notes.length,interstitialRowsKept:extraRows.length,notesLabelWidth:idxW+nameW});}
    return pages;
  }
  function topicHeader(c,discipline,font,topics,overrides,manifest,margin,dateW,hoursW,topicW,top){drawSubjectHeader(c,discipline,font);const h=30,y=top-h,heads=[blackCell(resolved(topics.header.date,overrides,manifest)),blackCell(resolved(topics.header.hours,overrides,manifest)),blackCell(resolved(topics.header.topic,overrides,manifest))],defs=[heads[0].text?heads[0]:{text:'Дата',segments:[{text:'Дата',isRed:false}]},heads[1].text?heads[1]:{text:'Кількість годин',segments:[{text:'Кількість годин',isRed:false}]},heads[2].text?heads[2]:{text:'Теми занять',segments:[{text:'Теми занять',isRed:false}]}];c.rect(margin,y,dateW,h);c.rect(margin+dateW,y,hoursW,h);c.rect(margin+dateW+hoursW,y,topicW,h);drawResolvedCell(c,defs[0],margin,y,dateW,h,font,{size:8.2,align:'center'});drawResolvedCell(c,defs[1],margin+dateW,y,hoursW,h,font,{size:8,align:'center'});drawResolvedCell(c,defs[2],margin+dateW+hoursW,y,topicW,h,font,{size:8.2,align:'center'});return y;}
  function topicPages(discipline,font,overrides,manifest,renderedRed){const topics=discipline.topics;if(!topics)return[];const margin=10*PT_PER_MM,dateW=22*PT_PER_MM,hoursW=26*PT_PER_MM,topicW=A4.width-margin*2-dateW-hoursW,top=A4.height-54,bottom=margin,pages=[];let c=new PageCanvas(font),y=topicHeader(c,discipline,font,topics,overrides,manifest,margin,dateW,hoursW,topicW,top);const pushPage=()=>pages.push({canvas:c,kind:'topics',subject:discipline.subject,redTextCount:c.redTextCalls});const newPage=()=>{pushPage();c=new PageCanvas(font);y=topicHeader(c,discipline,font,topics,overrides,manifest,margin,dateW,hoursW,topicW,top);};
    for(const row of topics.rows){const dc=blackCell(resolved(row.date,overrides,manifest)),rawHours=resolved(row.hours,overrides,manifest),hc=numericRedHoursCell(row.hours,rawHours,renderedRed),tc=blackCell(resolved(row.topic,overrides,manifest)),fs=8.2,lead=fs*1.22,dLines=wrapResolved(dc,dateW-5,font,fs),hLines=wrapResolved(hc,hoursW-5,font,fs),tLines=wrapResolved(tc,topicW-6,font,fs),all=Math.max(dLines.length,hLines.length,tLines.length,1);let offset=0,first=true;while(offset<all){if(y-bottom<lead+6)newPage();const fit=Math.max(1,Math.floor((y-bottom-6)/lead)),take=Math.min(all-offset,fit),rowH=Math.max(lead+6,take*lead+6),yy=y-rowH;c.rect(margin,yy,dateW,rowH);c.rect(margin+dateW,yy,hoursW,rowH);c.rect(margin+dateW+hoursW,yy,topicW,rowH);function drawLines(lines,x,w,align){let ly=yy+rowH-3-lead+fs*0.12;for(const line of lines.slice(offset,offset+take)){drawResolvedLine(c,line,x+2,ly,font,fs,align,w-4);ly-=lead;}}if(first){drawLines(dLines,margin,dateW,'center');drawLines(hLines,margin+dateW,hoursW,'center');}drawLines(tLines,margin+dateW+hoursW,topicW,'left');y=yy;offset+=take;first=false;if(offset<all)newPage();}}
    pushPage();return pages;
  }

  function buildToUnicode(font){
    const pairs=Array.from(font.usedGlyphs.entries()).filter(([gid])=>gid!==0).sort((a,b)=>a[0]-b[0]); const lines=[];
    for(let i=0;i<pairs.length;i+=100){const chunk=pairs.slice(i,i+100);lines.push(`${chunk.length} beginbfchar`);for(const [gid,cp] of chunk)lines.push(`<${gid.toString(16).padStart(4,'0').toUpperCase()}> <${utf16Hex(cp)}>`);lines.push('endbfchar');}
    return ascii(`/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${lines.join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`);
  }
  function buildWidths(font){
    const gids=Array.from(font.usedGlyphs.keys()).filter((g)=>g!==0).sort((a,b)=>a-b);const groups=[];let cur=[];
    for(const g of gids){if(!cur.length||g===cur[cur.length-1]+1)cur.push(g);else{groups.push(cur);cur=[g];}}if(cur.length)groups.push(cur);
    return groups.map((grp)=>`${grp[0]} [${grp.map((g)=>font.pdfWidth(g)).join(' ')}]`).join(' ');
  }

  class PdfBuilder {
    constructor(){this.objects=[];}
    reserve(){this.objects.push(null);return this.objects.length;}
    set(id,bytes){this.objects[id-1]=bytes instanceof Uint8Array?bytes:ascii(bytes);}
    add(bytes){const id=this.reserve();this.set(id,bytes);return id;}
    stream(dict,bytes){return concat([ascii(`<< ${dict} /Length ${bytes.length} >>\nstream\n`),bytes,ascii('\nendstream')]);}
    save(rootId,infoId){
      const parts=[ascii('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n')];const offsets=[0];let pos=parts[0].length;
      for(let i=0;i<this.objects.length;i+=1){if(!this.objects[i])throw new Error(`PDF internal object ${i+1} missing`);const head=ascii(`${i+1} 0 obj\n`),tail=ascii('\nendobj\n');offsets[i+1]=pos;parts.push(head,this.objects[i],tail);pos+=head.length+this.objects[i].length+tail.length;}
      const xrefPos=pos;let x=`xref\n0 ${this.objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=this.objects.length;i+=1)x+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
      x+=`trailer\n<< /Size ${this.objects.length+1} /Root ${rootId} 0 R${infoId?` /Info ${infoId} 0 R`:''} >>\nstartxref\n${xrefPos}\n%%EOF\n`;parts.push(ascii(x));return concat(parts);
    }
  }

  function infoString(s){const cps=Array.from(String(s||''));let h='FEFF';for(const ch of cps){const cp=ch.codePointAt(0);h+=utf16Hex(cp);}return `<${h}>`;}
  function assemblePdf(pageDefs,font,fontBytes,title){
    const pdf=new PdfBuilder();const fontFileId=pdf.add(pdf.stream('/Length1 '+fontBytes.length,fontBytes));const toUni=buildToUnicode(font);const toUniId=pdf.add(pdf.stream('',toUni));
    const bbox=[font.xMin,font.yMin,font.xMax,font.yMax].map((x)=>scale1000(x,font.unitsPerEm));
    const descId=pdf.add(`<< /Type /FontDescriptor /FontName /${escName('Tinos-Regular')} /Flags 4 /FontBBox [${bbox.join(' ')}] /ItalicAngle 0 /Ascent ${scale1000(font.ascent,font.unitsPerEm)} /Descent ${scale1000(font.descent,font.unitsPerEm)} /CapHeight ${scale1000(font.ascent,font.unitsPerEm)} /StemV 80 /FontFile2 ${fontFileId} 0 R >>`);
    const cidId=pdf.add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${escName('Tinos-Regular')} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descId} 0 R /DW 1000 /W [${buildWidths(font)}] /CIDToGIDMap /Identity >>`);
    const type0Id=pdf.add(`<< /Type /Font /Subtype /Type0 /BaseFont /${escName('Tinos-Regular')} /Encoding /Identity-H /DescendantFonts [${cidId} 0 R] /ToUnicode ${toUniId} 0 R >>`);
    const pagesId=pdf.reserve();const pageIds=[];
    for(const def of pageDefs){const stream=def.canvas.stream();const contentId=pdf.add(pdf.stream('',stream));const pageId=pdf.add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(A4.width)} ${num(A4.height)}] /Resources << /Font << /F1 ${type0Id} 0 R >> >> /Contents ${contentId} 0 R >>`);pageIds.push(pageId);}
    pdf.set(pagesId,`<< /Type /Pages /Kids [${pageIds.map((id)=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);const catalogId=pdf.add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);const infoId=pdf.add(`<< /Title ${infoString(title)} /Author ${infoString('Journal PDF v1.2.1')} /Producer ${infoString('Journal PDF browser-only')} >>`);return pdf.save(catalogId,infoId);
  }

  async function loadFontBytes(options={}){
    if(options.fontBytes)return options.fontBytes instanceof Uint8Array?options.fontBytes:new Uint8Array(options.fontBytes);const urls=options.fontUrls||FONT_URLS;let last;
    for(const url of urls){try{const r=await fetch(url,{cache:'force-cache',mode:'cors'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const b=new Uint8Array(await r.arrayBuffer());if(b.length<100000)throw new Error('файл шрифту надто малий');return b;}catch(e){last=e;}}
    throw new Error(`Не вдалося завантажити Unicode-шрифт Tinos. ${last?last.message:''}`);
  }

  async function generatePdf(disciplines,overrides={},options={}){
    const fontBytes=await loadFontBytes(options);const font=new TrueTypeFont(fontBytes);const manifest=new Set(),renderedRed=new Set();const pageDefs=[];const sorted=[...disciplines].sort((a,b)=>String(a.subject).localeCompare(String(b.subject),'uk'));
    for(let i=0;i<sorted.length;i+=1){const d=sorted[i];if(options.onProgress)await options.onProgress(i,sorted.length,d.subject);pageDefs.push(...gradePages(d,font,overrides,manifest,renderedRed));pageDefs.push(...topicPages(d,font,overrides,manifest,renderedRed));if(options.onProgress)await options.onProgress(i+1,sorted.length,d.subject);}
    if(!pageDefs.length)throw new Error('Не вдалося сформувати жодної сторінки PDF.');const title=`Журнал групи ${options.group||''}`.trim();const bytes=assemblePdf(pageDefs,font,fontBytes,title);
    return {bytes,pages:pageDefs.length,pageInfo:pageDefs.map((p)=>({kind:p.kind,subject:p.subject,gradeColumns:p.gradeColumns||0,tableWidth:p.tableWidth||0,gradeWidth:p.gradeWidth||0,gradeStart:p.gradeStart??0,gradeEnd:p.gradeEnd??-1,studentCount:p.studentCount||0,redTextCount:p.canvas?.redTextCalls||p.redTextCount||0,notesRows:p.notesRows||0,interstitialRowsKept:p.interstitialRowsKept||0,notesLabelWidth:p.notesLabelWidth||0})),renderedSourceKeys:Array.from(manifest),renderedRedSourceKeys:Array.from(renderedRed),emptyGradePagesSkipped:sorted.filter((d)=>d.stats?.emptyGradePageSkippedCandidate).length};
  }

  root.JournalPdf = { generatePdf, TrueTypeFont, A4, PT_PER_MM, FONT_URLS, wrapResolved };
  if(typeof module!=='undefined'&&module.exports)module.exports=root.JournalPdf;
})(typeof globalThis!=='undefined'?globalThis:self);
