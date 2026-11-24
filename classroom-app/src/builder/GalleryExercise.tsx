import {createPortal} from 'react-dom';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Block} from '../planning/model';
import {ui} from '../i18n';
import {FormattedText,formatOf} from './textFormatting';
import {classroomImageUrl,uploadClassroomImage,type GalleryImage} from './galleryStorage';
type GalleryBlock=Block&{galleryImages?:GalleryImage[]};
const pictures=(block:Block)=>(block as GalleryBlock).galleryImages||[];

function LocalPicture({scope,image,index}:{scope:string;image:GalleryImage;index:number}){
 const [src,setSrc]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let disposed=false,url='',revoke:(()=>void)|undefined;setSrc('');setError('');void classroomImageUrl(image,scope).then(result=>{if(disposed){result.revoke?.();return;}url=result.src;revoke=result.revoke;setSrc(url);}).catch(e=>{if(!disposed)setError((e as Error).message);});return()=>{disposed=true;revoke?.();};},[scope,image.id]);
 return error?<p role="alert">{ui(error)}</p>:src?<img className="mb-gallery-image" src={src} alt={image.caption||ui('Image')+' '+(index+1)}/>:<span role="status">{ui('Loading image…')}</span>;
}
function GalleryView({scope,images,index,setIndex,expandable=false}:{scope:string;images:GalleryImage[];index:number;setIndex:(n:number)=>void;expandable?:boolean}){
 const current=Math.min(index,Math.max(0,images.length-1)),image=images[current],[expanded,setExpanded]=useState(false);
 return <div className={'mb-gallery-view'+(expanded?' is-expanded':'')} onKeyDown={e=>{if(e.key==='ArrowLeft'&&current>0){e.preventDefault();setIndex(current-1);}if(e.key==='ArrowRight'&&current<images.length-1){e.preventDefault();setIndex(current+1);}}}>
 <div className="mb-gallery-stage">{image?<LocalPicture key={image.id} scope={scope} image={image} index={current}/>:<span>{ui('Add your first image')}</span>}{image&&expandable&&<button type="button" className="mb-gallery-expand" aria-pressed={expanded} aria-label={ui(expanded?'Fit image':'Expand image')} title={ui(expanded?'Fit image':'Expand image')} onClick={()=>setExpanded(v=>!v)}>{expanded?'↙':'↗'}</button>}</div>
 {images.length>0&&<div className="mb-gallery-navigation"><button aria-label={ui('Previous image')} disabled={current===0} onClick={()=>setIndex(current-1)}>‹</button><span role="status">{current+1} / {images.length}</span><button aria-label={ui('Next image')} disabled={current===images.length-1} onClick={()=>setIndex(current+1)}>›</button></div>}
 </div>;
}
export function GalleryEditor({block,onChange,scope}:{block:Block;onChange:(b:Block)=>void;scope:string}){
 const [index,setIndex]=useState(0),[upload,setUpload]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const latest=useRef(block),alive=useRef(true),inFlight=useRef(false);latest.current=block;useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const images=pictures(block),current=Math.min(index,Math.max(0,images.length-1)),image=images[current];
 async function add(files:File[]){if(inFlight.current||!files.length)return;setError('');if(pictures(latest.current).length+files.length>30){setError(ui('A gallery can contain up to 30 images.'));return;}inFlight.current=true;setBusy(true);try{const entries=await Promise.all(files.map(uploadClassroomImage));if(!alive.current)return;const before=pictures(latest.current);onChange({...latest.current,galleryImages:[...before,...entries]} as Block);setIndex(before.length);setUpload(false);}catch(e){if(alive.current)setError(ui((e as Error).message));}finally{inFlight.current=false;if(alive.current)setBusy(false);}}
 return <div className="mb-gallery-editor">
 {block.content&&<div className="mb-columns-existing"><FormattedText text={block.content} html={formatOf(block,'content',block.content)}/></div>}
 {images.length?<GalleryView scope={scope} images={images} index={current} setIndex={setIndex}/>:<div className="mb-gallery-stage mb-gallery-empty"><button className="primary" onClick={()=>setUpload(true)}>{ui('Upload images')}</button></div>}
 {image&&<label className="mb-field">{ui('Image description (optional)')}<textarea rows={2} aria-label={ui('Image description (optional)')} value={image.caption} onChange={e=>onChange({...block,galleryImages:images.map(i=>i.id===image.id?{...i,caption:e.target.value}:i)} as Block)}/></label>}
 <div className="mb-gallery-editor-actions"><button onClick={()=>{setError('');setUpload(true);}}>+ {ui('Add images')}</button>{image&&<button onClick={()=>{if(confirm(ui('Remove this image from the gallery?'))){onChange({...block,galleryImages:images.filter(i=>i.id!==image.id)} as Block);setIndex(Math.max(0,current-1));}}}>{ui('Remove image')}</button>}</div>
 <p className="mb-help">{ui('Images are stored securely in Supabase. Previously uploaded local images still require migration.')}</p>
 {upload&&<ImageUpload busy={busy} error={error} onFiles={files=>void add(files)} onClose={()=>{if(!busy)setUpload(false);}}/>}
 </div>;
}
export function ImageUpload({busy,error,onFiles,onClose}:{busy:boolean;error:string;onFiles:(files:File[])=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null);
 useLayoutEffect(()=>{dialog.current?.showModal();},[]);
 return createPortal(<dialog ref={dialog} className="mb-dialog mb-image-upload" onMouseDown={e=>e.stopPropagation()} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)onFiles(Array.from(e.dataTransfer.files));}} onPaste={e=>{const files=Array.from(e.clipboardData.files);if(files.length){e.preventDefault();if(!busy)onFiles(files);}}}>
 <div className="mb-image-upload-heading"><h2>{ui('Add images')}</h2><button disabled={busy} aria-label={ui('Close')} onClick={onClose}>×</button></div>
 <span className="mb-image-upload-tab">{ui('Upload your own')}</span>
 <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" multiple hidden aria-label={ui('Choose image files')} disabled={busy} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';onFiles(files);}}/>
 <button className="mb-image-dropzone" disabled={busy} onClick={()=>input.current?.click()}>{ui(busy?'Saving images…':'Drop images here, paste with Ctrl+V, or click to upload')}</button>
 <p className="mb-help">{ui('PNG, JPEG, WebP, GIF or AVIF · up to 10 MB each · up to 30 images')}</p>
 {error&&<p role="alert">{error}</p>}
 </dialog>,document.body);
}
export function GalleryPreview({block,scope}:{block:Block;scope:string}){
 const [index,setIndex]=useState(0),images=pictures(block),current=Math.min(index,Math.max(0,images.length-1));
 return <div className="mb-gallery-preview">{block.content&&<div className="mb-columns-existing"><FormattedText text={block.content} html={formatOf(block,'content',block.content)}/></div>}<GalleryView scope={scope} images={images} index={current} setIndex={setIndex} expandable/>{images[current]?.caption&&<p className="mb-gallery-caption">{images[current].caption}</p>}</div>;
}
