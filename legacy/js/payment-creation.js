// A UUID belongs to a form operation, not to an amount/date combination.
const paymentSubmissions={student:{busy:false,committed:false},add:{busy:false,committed:false}};
function paymentText(en,ru){return getLanguage()==='en'?en:ru;}
function beginPaymentForm(kind){
  const state=paymentSubmissions[kind];
  if(Object.values(paymentSubmissions).some(s=>s.busy))return false;
  state.committed=false;
  return true;
}
function paymentButton(kind){
  return kind==='add'?document.getElementById('add-payment-submit'):
    document.querySelector('#student-payment-modal [onclick="saveStudentPayment()"]');
}
function paymentBusy(kind,busy){
  const button=paymentButton(kind);
  if(!button)return;
  busy=busy||paymentSubmissions[kind].busy;
  if(busy){
    if(!button.dataset.paymentBusy)button.dataset.paymentLabel=button.innerHTML;
    button.dataset.paymentBusy='1';
    button.disabled=true;
    button.setAttribute('aria-busy','true');
    button.innerHTML='<span aria-hidden="true" class="inline-block w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin"></span>'+paymentText('Saving…','Сохранение…');
  }else{
    button.innerHTML=button.dataset.paymentLabel||button.innerHTML;
    delete button.dataset.paymentBusy;
    button.removeAttribute('aria-busy');
    button.disabled=paymentSubmissions[kind].busy||paymentSubmissions[kind].committed || (kind==='add'&&!document.getElementById('add-payment-student')?.value);
  }
}
async function submitPayment(kind){
  const state=paymentSubmissions[kind];
  // Before the first await: direct calls and keyboard activation are guarded too.
  if(Object.values(paymentSubmissions).some(s=>s.busy)||state.committed)return;
  state.busy=true;
  paymentBusy(kind,true);
  try{
    const prefix=kind==='add'?'add-payment':'student-payment';
    const id=kind==='add'?document.getElementById(prefix+'-student').value.replace(/^student:/,''):
      document.getElementById(prefix+'-id').value;
    const raw=document.getElementById(prefix+'-amount').value.trim();
    const amount=Number(raw);
    const date=document.getElementById(prefix+'-date').value;
    const student=students.find(s=>String(s.id)===String(id));
    if(!student||!raw||!Number.isFinite(amount)||amount===0||!date){
      throw new Error(paymentText('Select a student, a non-zero amount and a date.','Выберите ученика, ненулевую сумму и дату.'));
    }
    const {data:{session},error}=await supabaseClient.auth.getSession();
    if(error||!session?.user?.id||!session.access_token){
      throw new Error(paymentText('Your session expired. Sign in again.','Сессия истекла. Войдите снова.'));
    }
    headers.Authorization='Bearer '+session.access_token;
    const storageKey='pp-payment-operation:v1:'+session.user.id+':'+kind;
    const details={p_student_id:String(student.id),p_amount:amount,p_date:date};
    let operation;
    // Fail closed: do not send a request whose retry key cannot survive reload.
    try{operation=JSON.parse(sessionStorage.getItem(storageKey)||'null');}
    catch{throw new Error(paymentText('Enable session storage before saving a payment.','Разрешите хранение данных сессии перед сохранением платежа.'));}
    if(operation&&JSON.stringify(operation.details)!==JSON.stringify(details)){
      document.getElementById(prefix+'-amount').value=String(operation.details.p_amount);
      document.getElementById(prefix+'-date').value=operation.details.p_date;
      document.getElementById(prefix+(kind==='add'?'-student':'-id')).value=operation.details.p_student_id;
      if(kind==='student')document.getElementById('student-payment-name').textContent=students.find(s=>String(s.id)===operation.details.p_student_id)?.name||'';
      throw new Error(paymentText('A previous payment is unconfirmed. Its details have been restored; press Save to safely check it first.','Предыдущий платёж не подтверждён. Его данные восстановлены; нажмите сохранение, чтобы безопасно проверить результат.'));
    }
    if(!operation){
      operation={id:crypto.randomUUID(),details};
      try{sessionStorage.setItem(storageKey,JSON.stringify(operation));}
      catch{throw new Error(paymentText('Could not retain the payment operation. Nothing was sent.','Не удалось сохранить ключ операции. Платёж не отправлен.'));}
    }
    let response;
    try{
      response=await db('/rpc/create_payment_once',{
        method:'POST',headers:{...headers},
        body:JSON.stringify({p_operation_id:operation.id,...operation.details})
      });
    }catch(error){
      // A structured database validation/permission error proves the SQL
      // transaction did not commit. Let the teacher correct invalid input.
      // Network errors and key/payload conflicts MUST retain the original key.
      let code;
      try{code=JSON.parse(error.message).code;}catch{}
      if(['22003','22007','22008','22P02','23502','23503','23514','42501','PGRST202'].includes(code)){
        try{sessionStorage.removeItem(storageKey);}catch{}
      }
      throw error;
    }
    const payment=Array.isArray(response)?response[0]:response;
    if(!payment?.id)throw new Error(paymentText('Payment result is unconfirmed. Retry with the same details.','Результат не подтверждён. Повторите с теми же данными.'));
    // Confirm before notifications, cleanup or rendering can fail.
    state.committed=true;
    try{sessionStorage.removeItem(storageKey);}catch{/* Retaining the UUID is safe. */}
    try{
      const {error:notificationError,data}=await supabaseClient.functions.invoke('notify-payment',{body:{payment_id:String(payment.id)}});
      if(notificationError||data?.errors?.length)console.warn('Payment saved; notification delivery not confirmed.');
    }catch{console.warn('Payment saved; notification delivery not confirmed.');}
    try{
      closeModal(kind==='add'?'add-modal':'student-payment-modal');
      await loadData();
      renderStudents();
      if(kind==='student')document.getElementById('detail-'+id)?.classList.remove('hidden');
    }catch{
      showError(new Error(paymentText('Payment saved. Could not refresh the screen; reload the page. Do not enter the payment again.','Платёж сохранён. Не удалось обновить экран; перезагрузите страницу. Повторно вносить платёж не нужно.')));
    }
  }catch(error){
    showError(error);
  }finally{
    state.busy=false;
    paymentBusy(kind,false);
  }
}
