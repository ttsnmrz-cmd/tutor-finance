import {PronunciationEditor} from './PronunciationEditor';
import {PronunciationPlayer} from './PronunciationPlayer';
/** Standard block contract. Legacy My evening activities keep their renderer. */
export const blockRegistry={pronunciation_practice:{label:'Pronunciation Practice',schemaVersion:1,Editor:PronunciationEditor,Player:PronunciationPlayer}} as const;
