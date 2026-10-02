import {PDFDocument,StandardFonts,rgb,type PDFFont} from 'pdf-lib';
import QRCode from 'qrcode';
import {qrLocalOnly} from './vehicle-qr';
export type QrLabelVehicle={plate:string;model:string;code:string|null;qrRevision:number};
const mm=(value:number)=>value*72/25.4;
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function printable(value:string,font:PDFFont){return Array.from(value.replace(/[\r\n\t]/g,' ')).map(c=>{try{font.encodeText(c);return c;}catch{return '?';}}).join('');}
function lines(value:string,font:PDFFont,size:number,width:number,max=2){const output:string[]=[];let row='';for(const character of printable(value,font)){if(font.widthOfTextAtSize(row+character,size)>width){output.push(row.trim());row='';}row+=character;}if(row)output.push(row.trim());if(output.length>max){output.length=max;let last=output[max-1];while(font.widthOfTextAtSize(last+'...',size)>width)last=last.slice(0,-1);output[max-1]=last+'...';}return output;}
export async function vehicleQrPdf(v:QrLabelVehicle,url:string,format:'label'|'a4'){
 const doc=await PDFDocument.create();doc.setTitle(`Checklist - ${v.plate}`);doc.setAuthor('Central de Controle de Frota');
 const page=doc.addPage(format==='a4'?[mm(210),mm(297)]:[mm(100),mm(150)]),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const left=(page.getWidth()-mm(100))/2,bottom=(page.getHeight()-mm(150))/2;
 const center=(text:string,y:number,size:number,strong=false)=>{const f=strong?bold:font,safe=printable(text,f);page.drawText(safe,{x:left+(mm(100)-f.widthOfTextAtSize(safe,size))/2,y:bottom+mm(y),size,font:f,color:rgb(0,0,0)});};
 page.drawRectangle({x:left+mm(2),y:bottom+mm(2),width:mm(96),height:mm(146),borderWidth:0.5,borderColor:rgb(.55,.55,.55)});
 center('CHECKLIST DO MOTORISTA',137,11,true);center(v.plate,125,23,true);
 lines(v.model,font,10,mm(86)).forEach((line,i)=>center(line,117-i*4.5,10));
 if(v.code)center(lines(`Prefixo: ${v.code}`,font,9,mm(86),1)[0],104,9);
 // A vector QR keeps module boundaries sharp at any printer resolution; four-module quiet zone.
 const qr=QRCode.create(url,{errorCorrectionLevel:'M'}),count=qr.modules.size,cell=mm(70)/(count+8),x=left+mm(15),y=bottom+mm(30);
 page.drawRectangle({x,y,width:mm(70),height:mm(70),color:rgb(1,1,1)});
 for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(qr.modules.get(row,col))page.drawRectangle({x:x+(col+4)*cell,y:y+(count-row+3)*cell,width:cell,height:cell,color:rgb(0,0,0)});
 center('Aponte a câmera e realize o checklist.',23,9);center('Acesso exclusivo ao checklist deste veículo.',18,8);
 center(qrLocalOnly(url)?'Endereço local - configurar acesso antes de afixar.':new URL(url).hostname,12,qrLocalOnly(url)?7:8);
 center(`Revisão ${v.qrRevision} | Etiqueta 100 x 150 mm`,6,7);
 if(format==='a4'){page.drawText('Imprima em tamanho real (100%). Recorte a etiqueta pela borda.',{x:mm(20),y:mm(20),font,size:10});}
 return doc.save();
}
export async function vehicleQrPrintHtml(v:QrLabelVehicle,url:string,nonce:string){
 const image=await QRCode.toDataURL(url,{width:1000,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000',light:'#ffffff'}});
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Etiqueta ${escape(v.plate)}</title><style nonce="${nonce}">@page{size:100mm 150mm;margin:0}*{box-sizing:border-box}body{margin:0;background:#edf1f4;font-family:Arial,sans-serif;color:#000}.toolbar{text-align:center;padding:16px}button{padding:12px 24px;cursor:pointer}.label{width:100mm;height:150mm;margin:16px auto;background:#fff;padding:7mm 5mm;border:1px solid #aaa;text-align:center;overflow:hidden}.label h1{font-size:23pt;margin:5mm 0 2mm}.label h2{font-size:11pt;margin:0}.model{font-size:10pt;line-height:4.5mm;height:9mm;overflow:hidden;margin:0;overflow-wrap:anywhere}.prefix{font-size:9pt;height:5mm;margin:2mm 0;overflow:hidden}.qr{width:70mm;height:70mm;display:block;margin:auto}.instruction{font-size:9pt;margin:3mm 0 2mm}.note{font-size:8pt;margin:2mm 0;overflow-wrap:anywhere}.revision{font-size:7pt;margin:2mm 0}@media print{body{background:white}.toolbar{display:none}.label{margin:0;border:0}}</style></head><body><div class="toolbar"><button id="print">Imprimir etiqueta</button><p>Use papel 100 x 150 mm, escala 100%, sem cabeçalhos e rodapés.</p></div><main class="label"><h2>CHECKLIST DO MOTORISTA</h2><h1>${escape(v.plate)}</h1><p class="model">${escape(v.model)}</p><p class="prefix">${v.code?`Prefixo: ${escape(v.code)}`:''}</p><img class="qr" src="${image}" alt="QR Code do checklist"><p class="instruction">Aponte a câmera e realize o checklist.</p><p class="note">Acesso exclusivo ao checklist deste veículo.</p><p class="note">${qrLocalOnly(url)?'Endereço local - configurar acesso antes de afixar.':escape(new URL(url).hostname)}</p><p class="revision">Revisão ${v.qrRevision} | Etiqueta 100 x 150 mm</p></main><script nonce="${nonce}">document.getElementById('print').addEventListener('click',()=>window.print());window.addEventListener('load',()=>window.print());</script></body></html>`;
}
