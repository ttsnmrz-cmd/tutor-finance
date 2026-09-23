const SUPABASE_URL = 'https://dmasuczggcxzrxasgoov.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nXL_z4-dtwKcGXmMAXgJSg_v1Op_W1q';
const API = SUPABASE_URL + '/rest/v1';

const AUTH_SITE_URL = 'https://ttsnmrz-cmd.github.io/tutor-finance/';

function authSetError(id, message){
  const el = document.getElementById(id);
  if(el) el.textContent = message || '';
}

function authOpen(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.remove('hidden');
  el.classList.add('flex');
}

function authClose(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.add('hidden');
  el.classList.remove('flex');
}

function authLoginForm(){
  authClose('teacher-signup-modal');
  authClose('teacher-reset-modal');
  authClose('teacher-password-modal');
  authOpen('teacher-login-modal');
}

function authAddModals(){
  if(document.getElementById('teacher-signup-modal')) return;

  const login = document.getElementById('teacher-login-modal');
  if(!login) return;

  const loginActions = login.querySelector('p#teacher-login-error');
  if(loginActions){
    loginActions.insertAdjacentHTML('afterend', `
      <div class="flex justify-between text-sm pt-1">
        <button type="button" onclick="authOpenSignup()" class="text-indigo-700 font-semibold hover:underline">Зарегистрироваться</button>
        <button type="button" onclick="authOpenReset()" class="text-slate-500 hover:underline">Забыли пароль?</button>
      </div>
    `);
  }

  document.body.insertAdjacentHTML('beforeend', `
    <div id="teacher-signup-modal" class="hidden fixed inset-0 modal-bg z-50 items-center justify-center p-4">
      <div class="app-card rounded-3xl p-6 w-full max-w-sm space-y-3">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-bold">Регистрация</h2>
          <button type="button" onclick="authLoginForm()" class="text-2xl text-slate-400">×</button>
        </div>
        <p class="text-sm text-slate-500">Создайте аккаунт преподавателя с email и паролем.</p>
        <input id="teacher-signup-email" type="email" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Email" autocomplete="email">
        <input id="teacher-signup-password" type="password" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Пароль" autocomplete="new-password">
        <input id="teacher-signup-password2" type="password" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Повторите пароль" autocomplete="new-password" onkeydown="if(event.key==='Enter')teacherSignUp()">
        <button type="button" onclick="teacherSignUp()" class="primary-btn w-full rounded-xl py-2 font-semibold">Зарегистрироваться</button>
        <button type="button" onclick="authLoginForm()" class="w-full rounded-xl py-2 text-sm text-slate-500">Назад ко входу</button>
        <p id="teacher-signup-message" class="text-sm"></p>
      </div>
    </div>

    <div id="teacher-reset-modal" class="hidden fixed inset-0 modal-bg z-50 items-center justify-center p-4">
      <div class="app-card rounded-3xl p-6 w-full max-w-sm space-y-3">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-bold">Восстановление пароля</h2>
          <button type="button" onclick="authLoginForm()" class="text-2xl text-slate-400">×</button>
        </div>
        <p class="text-sm text-slate-500">Введите email. Мы отправим ссылку для восстановления пароля.</p>
        <input id="teacher-reset-email" type="email" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Email" autocomplete="email" onkeydown="if(event.key==='Enter')sendPasswordReset()">
        <button type="button" onclick="sendPasswordReset()" class="primary-btn w-full rounded-xl py-2 font-semibold">Отправить ссылку</button>
        <button type="button" onclick="authLoginForm()" class="w-full rounded-xl py-2 text-sm text-slate-500">Назад ко входу</button>
        <p id="teacher-reset-message" class="text-sm"></p>
      </div>
    </div>

    <div id="teacher-password-modal" class="hidden fixed inset-0 modal-bg z-50 items-center justify-center p-4">
      <div class="app-card rounded-3xl p-6 w-full max-w-sm space-y-3">
        <h2 class="text-xl font-bold">Новый пароль</h2>
        <p class="text-sm text-slate-500">Введите новый пароль для аккаунта.</p>
        <input id="teacher-new-password" type="password" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Новый пароль" autocomplete="new-password">
        <input id="teacher-new-password2" type="password" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Повторите пароль" autocomplete="new-password" onkeydown="if(event.key==='Enter')updateTeacherPassword()">
        <button type="button" onclick="updateTeacherPassword()" class="primary-btn w-full rounded-xl py-2 font-semibold">Сохранить пароль</button>
        <p id="teacher-password-message" class="text-sm"></p>
      </div>
    </div>
  `);
}

function authOpenSignup(){
  authClose('teacher-login-modal');
  authClose('teacher-reset-modal');
  authClose('teacher-password-modal');
  authSetError('teacher-signup-message','');
  authOpen('teacher-signup-modal');
  document.getElementById('teacher-signup-email')?.focus();
}

function authOpenReset(){
  authClose('teacher-login-modal');
  authClose('teacher-signup-modal');
  authClose('teacher-password-modal');
  authSetError('teacher-reset-message','');
  authOpen('teacher-reset-modal');
  document.getElementById('teacher-reset-email')?.focus();
}

async function teacherSignUp(){
  const email = document.getElementById('teacher-signup-email')?.value.trim();
  const password = document.getElementById('teacher-signup-password')?.value || '';
  const password2 = document.getElementById('teacher-signup-password2')?.value || '';

  authSetError('teacher-signup-message','');

  if(!email || !password || !password2){
    return authSetError('teacher-signup-message','Заполните все поля');
  }

  if(password.length < 6){
    return authSetError('teacher-signup-message','Пароль должен содержать минимум 6 символов');
  }

  if(password !== password2){
    return authSetError('teacher-signup-message','Пароли не совпадают');
  }

  try{
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options:{
        emailRedirectTo: AUTH_SITE_URL
      }
    });

    if(error) throw error;

    if(data.session){
      headers = {
        apikey: SUPABASE_KEY,
        Authorization:'Bearer '+data.session.access_token,
        'Content-Type':'application/json'
      };

      authClose('teacher-signup-modal');
      document.getElementById('teacher-app')?.classList.remove('hidden');
      await loadData();
      renderWeek();
      renderDay();
      return;
    }

    authSetError(
      'teacher-signup-message',
      'Регистрация создана. Проверьте почту и перейдите по ссылке подтверждения.'
    );
  }catch(e){
    console.error(e);
    authSetError('teacher-signup-message', e.message || 'Не удалось зарегистрироваться');
  }
}

async function sendPasswordReset(){
  const email = document.getElementById('teacher-reset-email')?.value.trim();
  authSetError('teacher-reset-message','');

  if(!email){
    return authSetError('teacher-reset-message','Введите email');
  }

  try{
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: AUTH_SITE_URL
    });

    if(error) throw error;

    authSetError(
      'teacher-reset-message',
      'Если такой аккаунт существует, письмо для восстановления отправлено на указанный email.'
    );
  }catch(e){
    console.error(e);
    authSetError('teacher-reset-message', e.message || 'Не удалось отправить письмо');
  }
}

async function updateTeacherPassword(){
  const password = document.getElementById('teacher-new-password')?.value || '';
  const password2 = document.getElementById('teacher-new-password2')?.value || '';
  authSetError('teacher-password-message','');

  if(!password || !password2){
    return authSetError('teacher-password-message','Заполните оба поля');
  }

  if(password.length < 6){
    return authSetError('teacher-password-message','Пароль должен содержать минимум 6 символов');
  }

  if(password !== password2){
    return authSetError('teacher-password-message','Пароли не совпадают');
  }

  try{
    const { error } = await supabaseClient.auth.updateUser({ password });

    if(error) throw error;

    authSetError('teacher-password-message','Пароль успешно изменён. Сейчас откроется вход.');

    setTimeout(async()=>{
      await supabaseClient.auth.signOut();
      location.replace(AUTH_SITE_URL);
    },900);
  }catch(e){
    console.error(e);
    authSetError('teacher-password-message', e.message || 'Не удалось изменить пароль');
  }
}

function authSetup(){
  authAddModals();

  if(typeof supabaseClient === 'undefined') return;

  supabaseClient.auth.onAuthStateChange((event)=>{
    if(event === 'PASSWORD_RECOVERY'){
      authClose('teacher-login-modal');
      authClose('teacher-signup-modal');
      authClose('teacher-reset-modal');
      authOpen('teacher-password-modal');
    }
  });

  if(location.hash.includes('type=recovery')){
    setTimeout(()=>{
      authClose('teacher-login-modal');
      authOpen('teacher-password-modal');
    },300);
  }
}

document.addEventListener('DOMContentLoaded', authSetup);
