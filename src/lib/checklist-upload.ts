import { MAX_PHOTO_BYTES } from './driver-inspection';

export function decodeChecklistPhoto(data:string):Uint8Array<ArrayBuffer> {
  const encoded = data.slice('data:image/jpeg;base64,'.length);
  const bytes = Buffer.from(encoded,'base64');
  if (!data.startsWith('data:image/jpeg;base64,') || bytes.length > MAX_PHOTO_BYTES || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9 || bytes.toString('base64') !== encoded) throw new Error('PHOTO');
  return new Uint8Array(bytes);
}

export async function readLimitedBody(request:Request,limit=9_100_000):Promise<string> {
  if (Number(request.headers.get('content-length') ?? 0)>limit) throw new Error('TOO_LARGE');
  if (!request.body) return '';
  const reader = request.body.getReader(); const chunks:Uint8Array[]=[]; let size=0;
  try {
    while (true) {const {done,value}=await reader.read();if(done) break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('TOO_LARGE');}chunks.push(value);}
    return Buffer.concat(chunks).toString('utf8');
  } finally {reader.releaseLock();}
}
