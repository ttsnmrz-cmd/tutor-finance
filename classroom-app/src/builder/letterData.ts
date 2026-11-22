import type {Item} from '../planning/model';
import type {SentenceItem} from './sentenceData';
export type LetterItem=Item&{letterWordId:string};
export const blankLetterWord=():LetterItem=>({letterWordId:crypto.randomUUID(),prompt:'',expected:''});
export const wordLetters=(word:string)=>Array.from(word.trim().normalize('NFC'));
export function letterSentence(item:LetterItem):SentenceItem{return {...item,sentenceId:item.letterWordId,sentenceTiles:wordLetters(item.expected||'').map((letter,index)=>({id:item.letterWordId+'-'+index,parts:[letter]}))};}
