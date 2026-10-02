import { MAX_PHOTO_BYTES } from './driver-inspection';

/** Resizing strips camera metadata and keeps each mobile upload bounded. */
export async function prepareChecklistPhoto(file:File):Promise<string> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use uma foto JPG, PNG ou WebP. Se necessário, tire uma nova foto pela câmera.');
  if (file.size > 20_000_000) throw new Error('A foto é muito grande. Escolha uma imagem de até 20 MB.');
  let bitmap:ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('Não foi possível abrir a foto. Tire outra foto ou selecione uma imagem válida.'); }
  try {
    let longest = 1400;
    for (let attempt=0;attempt<5;attempt++) {
      const ratio = Math.min(1,longest/Math.max(bitmap.width,bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(bitmap.width*ratio)); canvas.height = Math.max(1,Math.round(bitmap.height*ratio));
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Não foi possível preparar a foto neste navegador.');
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const data = canvas.toDataURL('image/jpeg',0.78);
      if (Math.ceil((data.length-23)*3/4) <= MAX_PHOTO_BYTES) return data;
      longest = Math.floor(longest*0.75);
    }
    throw new Error('Não foi possível reduzir a foto. Tente outra imagem.');
  } finally {bitmap.close();}
}
