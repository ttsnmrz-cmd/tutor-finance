export type FinanceProof = {legacyToken:string;legacyKey:string};
type Result = {data:unknown;error:unknown};
type Invoke = (body:Record<string,unknown>)=>Promise<Result>;
type LinkResponse = {studentId:string|null};

export class StudentLinkError extends Error {
 constructor(public readonly reason:'access'|'connection'|'response') {super(reason);}
}

function response(result:Result):LinkResponse {
 if(result.error)throw result.error;
 const data=result.data as Partial<LinkResponse>&{error?:unknown}|null;
 if(!data||data.error||!(data.studentId===null||typeof data.studentId==='string'&&data.studentId.length>0))throw new StudentLinkError('response');
 return {studentId:data.studentId};
}

// Use the deployed read/link protocol. The service-only RPC serializes creation by
// source teacher + student; a retry never creates another profile for that source.
export async function ensureFinancialStudent(invoke:Invoke,sourceStudentId:string,proof:FinanceProof,isCurrent:()=>boolean=()=>true):Promise<string> {
 const read=async()=>response(await invoke({action:'read',sourceStudentId,...proof})).studentId;
 try {
  const existing=await read();
  if(!isCurrent())throw new StudentLinkError('connection');
  if(existing)return existing;
  try {
   const linked=response(await invoke({action:'link',sourceStudentId,...proof,createNew:true})).studentId;
   if(!linked)throw new StudentLinkError('response');
   return linked;
  } catch(error) {
   // A concurrent request or a lost response may already have committed the link.
   // Read it back; do not retry a write or choose another profile by name.
   if(!isCurrent())throw error;
   const recovered=await read();
   if(recovered)return recovered;
   throw error;
  }
 } catch(error) {
  if(error instanceof StudentLinkError)throw error;
  const status=(error as {context?:{status?:number}}|null)?.context?.status;
  throw new StudentLinkError(status===401||status===403?'access':'connection');
 }
}
