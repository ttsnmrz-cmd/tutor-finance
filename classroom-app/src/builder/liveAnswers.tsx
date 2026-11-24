import {createContext,useContext,useEffect,useState,type Dispatch,type SetStateAction} from 'react';
export type LiveAnswerContextValue={student:boolean;enabled:boolean;values:Record<string,unknown>;send:(key:string,value:unknown)=>void};
export const LiveAnswerContext=createContext<LiveAnswerContextValue|null>(null);
export function useLiveAnswer<T>(key:string,initial:T):[T,Dispatch<SetStateAction<T>>]{
 const context=useContext(LiveAnswerContext);
 const [local,setLocal]=useState(initial);
 const send=context?.send,student=context?.student;
 useEffect(()=>{if(student&&send)send(key,local);},[key,local,student,send]);
 const remote=context?.values[key];
 return [context?.enabled&&!student&&remote!==undefined?remote as T:local,setLocal];
}
