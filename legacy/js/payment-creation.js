// A UUID belongs to a payment operation, not to an amount/date combination.
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
  if(Object.values(paymentSubmissions).some(s=>s.busy)||state.committed)return;
  state.busy=true;
  paymentBusy(kind,true);
  try{
    if(!navigator.locks?.request)throw new Error(paymentText('Open ProfiProfit in a current browser to save payments safely.','Откройте ProfiProfit в актуальном браузере, чтобы безопасно сохранить платёж.'));
    const prefix=kind==='add'?'add-payment':'student-payment';
    const studentField=document.getElementById(prefix+(kind==='add'?'-student':'-id'));
    const amountField=document.getElementById(prefix+'-amount');
    const dateField=document.getElementById(prefix+'-date');
    const details={p_student_id:studentField.value.replace(/^student:/,''),p_amount:Number(amountField.value.trim()),p_date:dateField.value};
    await navigator.locks.request('profiprofit:payment-submit',{ifAvailable:true},async lock=>{
      if(!lock)throw new Error(paymentText('A payment is being saved in another tab. Check its result there before trying again.','Платёж сохраняется в другой вкладке. Сначала проверьте результат там.'));
      const {data:{session},error}=await supabaseClient.auth.getSession();
      if(error||!session?.user?.id||!session.access_token)throw new Error(paymentText('Your session expired. Sign in again.','Сессия истекла. Войдите снова.'));
      const storageKey='pp-payment-operation:v2:'+session.user.id;
      let pending;
      let legacyKeys;
      try{
        const legacyPrefix='pp-payment-operation:v1:'+session.user.id+':';
        legacyKeys=['student','add'].map(form=>legacyPrefix+form).filter(key=>sessionStorage.getItem(key));
        const records=[localStorage.getItem(storageKey),...legacyKeys.map(key=>sessionStorage.getItem(key))].filter(Boolean).map(record=>JSON.parse(record));
        if(records.some(record=>!record?.id||!record.details))throw new Error('Invalid stored operation');
        pending=records[0];
        if(records.some(record=>record.id!==pending.id))throw new Error('Multiple pending operations');
        if(legacyKeys.length){
          localStorage.setItem(storageKey,JSON.stringify(pending));
          for(const key of legacyKeys)sessionStorage.removeItem(key);
        }
      }catch{
        throw new Error(paymentText('Cannot safely recover the payment. Keep this browser’s data and check the payment history before trying again.','Не удалось безопасно восстановить платёж. Сохраните данные браузера и проверьте историю платежей перед повтором.'));
      }
      if(pending&&(pending.details.p_student_id!==details.p_student_id||pending.details.p_amount!==details.p_amount||pending.details.p_date!==details.p_date)){
        const original=students.find(s=>String(s.id)===pending.details.p_student_id);
        if(!original)throw new Error(paymentText('The student for the unconfirmed payment is unavailable. Check the payment history before continuing.','Ученик из неподтверждённого платежа недоступен. Проверьте историю платежей перед продолжением.'));
        amountField.value=String(pending.details.p_amount);
        dateField.value=pending.details.p_date;
        studentField.value=pending.details.p_student_id;
        if(kind==='student')document.getElementById('student-payment-name').textContent=original.name;
        showPaymentWarning(paymentText('A previous payment is unconfirmed. Its student, amount and date have been restored. Review them and press Save to check that payment.','Предыдущий платёж не подтверждён. Ученик, сумма и дата восстановлены. Проверьте их и нажмите «Сохранить», чтобы уточнить результат.'));
        return null;
      }
      if(!students.some(s=>String(s.id)===details.p_student_id)||!Number.isFinite(details.p_amount)||details.p_amount===0||!details.p_date){
        throw new Error(paymentText('Select a student, a non-zero amount and a date.','Выберите ученика, ненулевую сумму и дату.'));
      }
      const operation=pending||{id:crypto.randomUUID(),details};
      if(!pending){
        try{localStorage.setItem(storageKey,JSON.stringify(operation));}
        catch{throw new Error(paymentText('Could not retain the payment operation. Nothing was sent.','Не удалось сохранить ключ операции. Платёж не отправлен.'));}
      }
      let response;
      try{
        response=await db('/rpc/create_payment_once',{
          method:'POST',headers:{...headers,Authorization:'Bearer '+session.access_token},
          body:JSON.stringify({p_operation_id:operation.id,...operation.details})
        });
      }catch(error){
        let code;
        try{code=JSON.parse(error.message).code;}catch{}
        // A rejection of a retry does not rule out an earlier successful write.
        if(!pending&&['22003','22007','22008','22P02','23502','23503','23514','42501','PGRST202'].includes(code)){
          try{localStorage.removeItem(storageKey);}catch{}
        }
        throw error;
      }
      const payment=Array.isArray(response)?response[0]:response;
      if(!payment?.id)throw new Error(paymentText('Payment result is unconfirmed. Retry the original payment.','Результат не подтверждён. Повторите исходный платёж.'));
      state.committed=true;
      try{localStorage.removeItem(storageKey);}catch{/* Keeping the original key is safer than issuing a new one. */}
      let warning='';
      try{
        const {error,data}=await supabaseClient.functions.invoke('notify-payment',{body:{payment_id:String(payment.id)}});
        if(error||data?.errors?.length)throw new Error('Notification unconfirmed');
      }catch{
        warning=paymentText('Payment saved. Telegram delivery could not be confirmed.','Платёж сохранён. Доставку уведомления в Telegram подтвердить не удалось.');
      }
      try{
        closeModal(kind==='add'?'add-modal':'student-payment-modal');
        await loadData();
        renderStudents();
        if(kind==='student')document.getElementById('detail-'+(payment.student_id||details.p_student_id))?.classList.remove('hidden');
      }catch{
        showError(new Error(paymentText('Payment saved. Could not refresh the screen; reload the page. Do not enter the payment again.','Платёж сохранён. Не удалось обновить экран; перезагрузите страницу. Повторно вносить платёж не нужно.')));
      }
      if(warning)showPaymentWarning(warning);
    });
  }catch(error){
    showError(error);
  }finally{
    state.busy=false;
    paymentBusy(kind,false);
  }
}

function showPaymentWarning(message){
  document.getElementById('payment-warning')?.remove();
  const notice=document.createElement('div');
  notice.id='payment-warning';
  notice.className='app-card rounded-xl p-4';
  notice.setAttribute('role','status');
  Object.assign(notice.style,{position:'fixed',bottom:'1rem',right:'1rem',maxWidth:'min(24rem, calc(100vw - 2rem))',zIndex:'1000'});
  const text=document.createElement('span');
  text.textContent=message;
  const close=document.createElement('button');
  close.type='button';
  close.className='soft-input rounded-lg px-3 py-1';
  close.textContent=paymentText('Dismiss','Закрыть');
  close.onclick=()=>notice.remove();
  notice.append(text,document.createTextNode(' '),close);
  document.body.append(notice);
}
