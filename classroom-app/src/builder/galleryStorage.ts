import {supabase} from '../supabase';
export type GalleryImage={id:string;caption:string;name:string;storagePath?:string};
const BUCKET='classroom-images';
const extension:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
// Preserve small print and transparency; never replace an original with a larger file.
async function optimizeClassroomImage(file:File):Promise<File>{
 // GIF and AVIF may be animated; WebP may also contain animation.
 if(file.type!=='image/png'&&file.type!=='image/jpeg')return file;
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Image decode failed'));image.src=url;});
  const scale=Math.min(1,3200/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)return file;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',0.94));
  if(!blob||blob.type!=='image/webp'||blob.size>=file.size)return file;
  return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:blob.type,lastModified:file.lastModified});
 }catch{return file;}finally{URL.revokeObjectURL(url);}
}
export async function uploadClassroomImage(file:File):Promise<GalleryImage>{
 await validateLocalImage(file);
 const optimized=await optimizeClassroomImage(file);
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)throw Error('Sign in before uploading images.');
 const id=crypto.randomUUID(),path=`${user.id}/${id}.${extension[optimized.type]}`;
 const {error}=await supabase.storage.from(BUCKET).upload(path,optimized,{contentType:optimized.type,upsert:false});
 if(error)throw Error(`Image upload failed: ${error.message}`);
 return {id,name:file.name,caption:'',storagePath:path};
}
export async function classroomImageUrl(image:GalleryImage,scope:string):Promise<{src:string;revoke?:()=>void}>{
 if(image.storagePath&&scope.startsWith('public-image:')){
 const context=JSON.parse(scope.slice('public-image:'.length));
 const {data,error}=await supabase.functions.invoke('student-material-image',{body:{...context,path:image.storagePath}});
 if(error||!data?.signedUrl)throw Error('Unable to open image. Check your access.');
 return {src:data.signedUrl};
 }
 if(image.storagePath){const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(image.storagePath,3600);if(error||!data?.signedUrl)throw Error('Unable to open image. Check your access.');return {src:data.signedUrl};}
 const blob=await loadLocalImage(scope,image.id),src=URL.createObjectURL(blob);return {src,revoke:()=>URL.revokeObjectURL(src)};
}

const database='mec:local-preview-images:v1';
const allowed=new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif']);
export const MAX_IMAGE_BYTES=10*1024*1024;
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(database,1);request.onupgradeneeded=()=>{request.result.createObjectStore('images',{keyPath:['scope','id']});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Local image storage is unavailable.'));request.onblocked=()=>reject(Error('Close other preview tabs and try again.'));});}
export async function saveLocalImages(scope:string,images:{entry:GalleryImage;blob:Blob}[]){if(!scope)throw Error('Local image scope is unavailable.');const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('images','readwrite');for(const {entry,blob} of images)tx.objectStore('images').put({scope,id:entry.id,blob});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error('Image storage is full or unavailable. No images were added.'));tx.onabort=()=>reject(Error('Image storage is full or unavailable. No images were added.'));});}finally{db.close();}}
export async function loadLocalImage(scope:string,id:string):Promise<Blob>{if(!scope)throw Error('Local image scope is unavailable.');const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('images','readonly'),request=tx.objectStore('images').get([scope,id]);let row:{blob?:Blob}|undefined;request.onsuccess=()=>{row=request.result;};tx.oncomplete=()=>{if(row?.blob instanceof Blob&&allowed.has(row.blob.type))resolve(row.blob);else reject(Error('This image is not available in this browser.'));};tx.onerror=()=>reject(Error('Local image storage is unavailable.'));});}finally{db.close();}}
export async function validateLocalImage(file:File){if(!allowed.has(file.type))throw Error('Use PNG, JPEG, WebP, GIF or AVIF images.');if(file.size>MAX_IMAGE_BYTES)throw Error('Each image must be 10 MB or smaller.');if(!file.size)throw Error('This image could not be opened.');const bytes=new Uint8Array(await file.slice(0,64).arrayBuffer()),ascii=String.fromCharCode(...bytes);const magic=file.type==='image/png'?bytes[0]===137&&ascii.slice(1,4)==='PNG':file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:file.type==='image/webp'?ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP':file.type==='image/gif'?/^GIF8[79]a/.test(ascii):ascii.slice(4,8)==='ftyp'&&(/avif|avis/.test(ascii));if(!magic)throw Error('This image could not be opened.');const url=URL.createObjectURL(file);try{await new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>image.naturalWidth&&image.naturalHeight?resolve():reject(Error('This image could not be opened.'));image.onerror=()=>reject(Error('This image could not be opened.'));image.src=url;});}finally{URL.revokeObjectURL(url);}}
