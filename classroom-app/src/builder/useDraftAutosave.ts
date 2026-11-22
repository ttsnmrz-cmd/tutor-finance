import {useEffect,useMemo,useSyncExternalStore} from 'react';
import type {PlanRow} from '../planning/api';
import type {StudioRepository} from '../materials/repository';
import {DraftController} from './draftController';

export function useDraftAutosave(row:PlanRow,repository:StudioRepository){
 const controller=useMemo(()=>new DraftController(row,repository),[row.id,repository]);
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot);
 useEffect(()=>{
  if(controller.snapshot().status==='pending')void controller.flush();
  const checkpoint=()=>controller.checkpoint();
  const beforeUnload=(e:BeforeUnloadEvent)=>{controller.checkpoint();if(controller.dirty&&!controller.hasRecovery){e.preventDefault();e.returnValue='';}};
  const changed=(e:StorageEvent)=>{const key=(repository as StudioRepository&{storageKey?:string}).storageKey;if(!e.key||e.key===key)void controller.refreshExternal();};
  window.addEventListener('pagehide',checkpoint);window.addEventListener('beforeunload',beforeUnload);window.addEventListener('storage',changed);
  return()=>{window.removeEventListener('pagehide',checkpoint);window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('storage',changed);controller.dispose();};
 },[controller,repository]);
 return {controller,state};
}
