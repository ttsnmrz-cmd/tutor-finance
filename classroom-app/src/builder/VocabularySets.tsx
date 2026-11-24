import {useEffect,useState} from 'react';
import './vocabulary-sets.css';
import {EmojiPicker} from './EmojiPicker';
import {supabase} from '../supabase';
export type VocabularySet={id:string;name:string;pairs:string[][]};
export function VocabularySets({onPlay}:{onPlay?:(set:VocabularySet)=>void}){
 const [sets,setSets]=useState<VocabularySet[]>([]),[draft,setDraft]=useState<VocabularySet|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const {data,error}=await supabase.from('vocabulary_sets').select('id,name,pairs').order('name');if(error)setError(error.message);else setSets(data as VocabularySet[]);}
 useEffect(()=>{void load();},[]);
 const fresh=()=>({id:'',name:'',pairs:Array.from({length:5},()=>['',''])});
 function change(i:number,j:number,value:string){setDraft(old=>old?{...old,pairs:old.pairs.map((p,k)=>k===i?p.map((v,l)=>l===j?value:v):p)}:old);}
 async function save(play:boolean){if(!draft||busy)return;const name=draft.name.trim(),pairs=draft.pairs.map(p=>p.map(v=>v.trim())).filter(p=>p.some(Boolean));if(!name||pairs.length<2||pairs.some(p=>!p[0]||!p[1])||new Set(pairs.map(p=>p[0].toLowerCase())).size!==pairs.length){setError('Enter a name and at least two complete pairs with unique words.');return;}setBusy(true);setError('');try{const query=draft.id?supabase.from('vocabulary_sets').update({name,pairs}).eq('id',draft.id):supabase.from('vocabulary_sets').insert({name,pairs});const {data,error}=await query.select('id,name,pairs').single();if(error)throw error;setDraft(null);await load();if(play)onPlay?.(data as VocabularySet);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function remove(id:string){if(!window.confirm('Delete this vocabulary set?'))return;const {error}=await supabase.from('vocabulary_sets').delete().eq('id',id);if(error)setError(error.message);else void load();}
 return <section className="vocab-sets"><div className="vocab-heading"><strong>My sets</strong><button className="vocab-primary" onClick={()=>{setError('');setDraft(fresh());}}>+ Create set</button></div>
 {error&&<p role="alert">{error}</p>}
 {!draft&&sets.map(s=><div key={s.id} className="vocab-list-row">{onPlay?<button onClick={()=>onPlay(s)}>{s.name} · {s.pairs.length}</button>:<strong>{s.name} · {s.pairs.length}</strong>}<button onClick={()=>setDraft(s)}>Edit</button><button onClick={()=>setDraft({...s,id:'',name:s.name+' (copy)'})}>Copy</button><button onClick={()=>void remove(s.id)}>Delete</button></div>)}
 {draft&&<><input className="vocab-name" aria-label="Set name" placeholder="Set name" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/>{draft.pairs.map((p,i)=><div key={i} className="vocab-pair"><input aria-label={'Word '+(i+1)} placeholder="English word" value={p[0]} onChange={e=>change(i,0,e.target.value)}/><EmojiPicker word={p[0]} value={p[1]} onChange={value=>change(i,1,value)}/><button className="vocab-remove" aria-label="Remove pair" onClick={()=>setDraft({...draft,pairs:draft.pairs.filter((_,k)=>k!==i)})}>×</button></div>)}<div className="vocab-add"><button disabled={draft.pairs.length>=100} onClick={()=>setDraft({...draft,pairs:[...draft.pairs,['','']]})}>+ Add pair</button></div><div className="vocab-footer"><button disabled={busy} onClick={()=>setDraft(null)}>Cancel</button><span/><button className="vocab-primary" disabled={busy} onClick={()=>void save(false)}>Save set</button>{onPlay&&<button className="vocab-primary" disabled={busy} onClick={()=>void save(true)}>Save & Play</button>}</div></>}
 </section>;
}
