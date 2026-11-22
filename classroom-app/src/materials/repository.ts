import type {Plan} from '../planning/model';
import type {PlanRow,VersionRow} from '../planning/api';

export type MaterialSection={id:string;teacher_id:string;parent_id:string|null;title:string;position:number;updated_at:string};
export type LibraryPlan=PlanRow&{section_id:string|null};
export interface StudioRepository {
 recoveryKey:string;
 storageKey?:string;
 library():Promise<{drafts:PlanRow[];versions:VersionRow[]}>;
 savePlan(id:string|null,body:Plan,revision:number):Promise<PlanRow>;
}
export interface MaterialsRepository extends StudioRepository {
 sections():Promise<MaterialSection[]>;
 createFolder(title:string,parent:string|null):Promise<void>;
 renameFolder(id:string,title:string):Promise<void>;
 moveFolder(id:string,parent:string|null):Promise<void>;
 moveMaterial(id:string,parent:string|null):Promise<void>;
 createDraft(title:string,parent:string|null):Promise<LibraryPlan>;
}
