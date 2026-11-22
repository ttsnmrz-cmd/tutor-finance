import {useEffect,useState} from 'react';
import {supabase} from '../supabase';
import {ui} from '../i18n';
import {LoadingIndicator} from '../blocks/LoadingIndicator';
import {LessonNotesHistory} from './LessonNotesHistory';
import {ensureFinancialStudent,StudentLinkError} from './financialStudentLink';
export type {FinanceProof} from './financialStudentLink';
import type {FinanceProof} from './financialStudentLink';
export function StudentLearningPanel({sourceId,proof}:{sourceId:string;name:string;proof:()=>Promise<FinanceProof>}){
 const [linked,setLinked]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true;setLoading(true);setLinked('');setError('');void(async()=>{try{
  if(!supabase)throw Error();const source=await proof();if(!alive)return;
  const client=supabase;
  const studentId=await ensureFinancialStudent(body=>client.functions.invoke('financial-student-link',{body}),sourceId,source,()=>alive);
  if(alive){setLinked(studentId);window.dispatchEvent(new Event('classroom:students-updated'));}
 }catch(e){if(alive)setError(e instanceof StudentLinkError&&e.reason==='access'?'Sign in to both cabinets with the same teacher account.':'Could not load lesson notes. Please check the connection and try again.');}finally{if(alive)setLoading(false);}})();return()=>{alive=false;};},[sourceId,retry]);
 if(loading)return <LoadingIndicator label={ui('Loading lesson notes')}/>;
 if(linked)return <LessonNotesHistory key={linked} teacher studentId={linked} embedded/>;
 return <div className="student-link-panel"><h3>{ui('Lessons & Notes')}</h3><p role="alert">{ui(error)}</p><button onClick={()=>setRetry(n=>n+1)}>{ui('Try again')}</button></div>;
}
