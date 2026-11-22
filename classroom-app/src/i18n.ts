import {useSyncExternalStore} from 'react';
import {en,ru} from './i18n/translations';
export type Language='en'|'ru';
let language:Language='en';
try{language=localStorage.getItem('mec:language')==='ru'?'ru':'en';}catch{}
const listeners=new Set<()=>void>();
export const getLanguage=()=>language;
export function setLanguage(value:Language){
 if(value===language)return;language=value;try{localStorage.setItem('mec:language',value);}catch{}
 document.documentElement.lang=value;
 listeners.forEach(listener=>listener());
 window.dispatchEvent(new CustomEvent('classroom:language',{detail:{language:value}}));
}
export function useLanguage(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},getLanguage,()=> 'en' as Language);}
export function ui(value:unknown){
 if(value===null||value===undefined)return '';const raw=String(value),key=raw.trim();
 if(!key)return raw;
 const translated=language==='ru'?(ru[key]??key):(en[key]??key);
 return raw.slice(0,raw.length-raw.trimStart().length)+translated+raw.slice(raw.trimEnd().length);
}
export const dateLocale=()=>language==='ru'?'ru-RU':'en-GB';
export const interfaceDictionary=()=>language==='ru'?ru:en;
