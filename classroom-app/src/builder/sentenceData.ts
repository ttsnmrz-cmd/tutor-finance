import type {Item} from '../planning/model';
export type SentenceTile={id:string;parts:string[]};
export type SentenceItem=Item&{sentenceId:string;sentenceTiles:SentenceTile[]};
export const tileText=(tile:SentenceTile)=>tile.parts.join(' ');
export function rebuildSentence(text:string,old:SentenceTile[]=[]):SentenceTile[]{
 const words=text.match(/\S+/g)||[],used=new Set<string>(),tiles:SentenceTile[]=[];
 for(let i=0;i<words.length;){const found=old.find(t=>!used.has(t.id)&&t.parts.length>0&&t.parts.every((p,j)=>words[i+j]===p));
 if(found){tiles.push({...found,parts:[...found.parts]});used.add(found.id);i+=found.parts.length;}else{tiles.push({id:crypto.randomUUID(),parts:[words[i]]});i++;}}
 return tiles;
}
export function updateSentence(item:SentenceItem,tiles:SentenceTile[]):SentenceItem{const prompt=tiles.map(tileText).join(' ');return {...item,prompt,expected:prompt,options:tiles.map(tileText),sentenceTiles:tiles};}
export function blankSentence(text=''):SentenceItem{return updateSentence({sentenceId:crypto.randomUUID(),sentenceTiles:[],prompt:''},rebuildSentence(text));}
export function shuffledTiles(tiles:SentenceTile[]){const out=[...tiles];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}if(out.length>1&&out.every((t,i)=>tileText(t)===tileText(tiles[i]))){const different=out.findIndex(t=>tileText(t)!==tileText(out[0]));if(different>0)[out[0],out[different]]=[out[different],out[0]];}return out.map(t=>t.id);}
