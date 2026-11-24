import {createContext,useContext,useState,type Dispatch,type SetStateAction} from 'react';
export type LiveAnswerContextValue={student:boolean;enabled:boolean;values:Record<string,unknown>;send:(key:string,value:unknown)=>void};
export const LiveAnswerBlock=createContext('');
export const LiveAnswerContext=createContext<LiveAnswerContextValue|null>(null);
export function useLiveAnswer<T>(key:string,initial:T|(()=>T)):[T,Dispatch<SetStateAction<T>>]{
 const context=useContext(LiveAnswerContext);
 const [local,setLocal]=useState(initial);
 const remote=context?.values[key];
 const value=context?.enabled&&remote!==undefined?remote as T:local;
 const update:Dispatch<SetStateAction<T>>=next=>{
   if(!context?.enabled){setLocal(next);return;}
   const resolved=typeof next==='function'?(next as (old:T)=>T)(value):next;
   context.send(key,resolved);
 };
 return [value,update];
}
