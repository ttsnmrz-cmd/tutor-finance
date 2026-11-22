import {ui} from '../i18n';
import './loading.css';
export function LoadingIndicator({label='Loading',overlay=false}:{label?:string;overlay?:boolean}){
 return <div className={'page-loader'+(overlay?' page-loader-overlay':'')} role="status" aria-label={ui(label)}><span className="loading-spinner" aria-hidden="true"/></div>;
}
