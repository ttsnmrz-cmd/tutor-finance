const SUPABASE_URL = 'https://dmasuczggcxzrxasgoov.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nXL_z4-dtwKcGXmMAXgJSg_v1Op_W1q';
const API = SUPABASE_URL + '/rest/v1';
const AUTH_SITE_URL = 'https://ttsnmrz-cmd.github.io/tutor-finance/';

function authSetError(id,message){
  const el=document.getElementById(id);
  if(el)el.textContent=message||'';
}

function authFocusLogin(){
  document.getElementById('landing-page')?.classList.remove('hidden');
  document.getElementById('teacher-header')?.classList.add('hidden');
  document.getElementById('teacher-main')?.classList.add('hidden');
  document.getElementById('auth')?.scrollIntoView({behavior:'smooth',block:'center'});
  document.getElementById('teacher-email-input')?.focus();
}

function authStartSignup(){
  document.getElementById('auth')?.scrollIntoView({behavior:'smooth',block:'center'});
  showAuthMode?.('register');
  document.getElementById('teacher-register-email')?.focus();
}

document.addEventListener('DOMContentLoaded',()=>{
  const yearEl=document.getElementById('current-year');
  if(yearEl)yearEl.textContent=String(new Date().getFullYear());
});
