(() => {
  const STORAGE_KEY = 'profiprofit-language';
  const dictionaries = {
    en: {
      'Личный кабинет':'Student Portal','Ваши занятия и баланс':'Your lessons and balance',
      'Внесено':'Payments received','Списано':'Amount charged','Баланс':'Balance',
      'Проведенных занятий':'Lessons completed','Стоимость занятия':'Lesson price',
      'Пополнения':'Top-ups','Занятия':'Lessons','Показаны все прошедшие занятия и ближайшие 5 запланированных.':'All past lessons and the next 5 scheduled lessons are shown.',
      'Занятия, ученики и оплаты':'Lessons, students and payments','Календарь':'Calendar','Финансы':'Finances',
      'Управление занятиями и оплатами':'Manage lessons and payments','Для преподавателей':'For tutors',
      'Меньше ручной работы.':'Less admin work.','Больше контроля над оплатами.':'More control over payments.',
      'ProfiProfit помогает вести календарь занятий, отслеживать посещаемость, оплаты и баланс учеников — без таблиц и сложных систем.':'ProfiProfit helps you manage your lesson calendar, attendance, payments and student balances — without spreadsheets or complicated tools.',
      'Войти':'Log in','Регистрация':'Sign up','Войти в аккаунт':'Log in to your account','Создать аккаунт':'Create an account',
      'После регистрации может потребоваться подтверждение email.':'You may need to confirm your email after signing up.',
      'Пароль':'Password','Повторите пароль':'Confirm password','Показать пароль':'Show password','Скрыть пароль':'Hide password',
      'Зарегистрироваться':'Create account','Продолжить с Google':'Continue with Google',
      'Зачем ProfiProfit':'Why ProfiProfit','Всё, что нужно преподавателю для финансового учёта':'Everything tutors need to manage lesson finances',
      'Занятия, группы, посещаемость и оплаты находятся в одном месте, поэтому не приходится собирать информацию из календаря, заметок и таблиц.':'Lessons, groups, attendance and payments in one place — no need to juggle calendars, notes and spreadsheets.',
      'Оплаты':'Payments','Группы':'Groups','Календарь, повторяющиеся занятия и статусы проведённых, перенесённых и отменённых уроков.':'A calendar, recurring lessons, and statuses for completed, rescheduled and cancelled lessons.',
      'Пополнения, списания и актуальный баланс каждого ученика.':'Track top-ups, charges and each student’s current balance.',
      'Стоимость занятия группы рассчитывается автоматически с учётом участников.':'Group lesson costs are calculated automatically based on participants.',
      'Дальше':'What’s next','Как будем развивать ProfiProfit':'The future of ProfiProfit',
      'Удобство':'Ease of use','Более быстрый ввод занятий и оплат, удобная работа с группами и посещаемостью.':'Faster lesson and payment entry, with easier group and attendance management.',
      'Аналитика':'Analytics','Отчёты по доходам, загрузке, ученикам и группам.':'Reports on income, workload, students and groups.',
      'Кабинет ученика':'Student portal','Развитие личного кабинета и прозрачное взаимодействие с учениками.':'A better student portal and clearer communication with students.',
      'Новое занятие':'New lesson','Ученик / группа':'Student / group','Дата':'Date','Длительность':'Duration','минут':'minutes','Время':'Time',
      'Стоимость':'Price','Статус':'Status','Комментарий':'Notes','(необязательно)':'(optional)','Повторять еженедельно':'Repeat weekly',
      'Пн':'Mon','Вт':'Tue','Ср':'Wed','Чт':'Thu','Пт':'Fri','Сб':'Sat','Вс':'Sun','Удалить':'Delete',
      'Удалить занятие и все последующие':'Delete this and all following lessons','Сохранить':'Save','Внести оплату':'Add payment',
      'Сумма':'Amount','Ученик':'Student','Имя':'Name','Email':'Email','Telegram':'Telegram','Стоимость занятия':'Lesson price',
      'Включить в группу':'Add to group','Добавить':'Add','Платёж':'Payment','Сегодня':'Today','Ученики':'Students',
      'Настройка списка':'List settings','Нажмите на ученика, чтобы увидеть детали':'Select a student to view details',
      'Сортировать':'Sort by','Сначала новые':'Newest first','Сначала старые':'Oldest first','А-Я (A-Z)':'A–Z','Я-А (Z-A)':'Z–A',
      'Показать архив':'Show archived','Учеников нет':'No students yet','без группы':'No group','архив':'archived',
      'Изменить':'Edit','Ожидаемый платёж за занятие':'Expected payment per lesson','Учеников в группе пока нет':'No students in this group yet',
      '+ Добавить ученика':'+ Add student','Групп пока нет':'No groups yet','Название группы':'Group name','Создать группу':'Create group',
      'Внести платеж':'Record payment','Отмена':'Cancel','Группа':'Group','Включить в группу':'Add to group',
      'Внесите сумму, отличную от нуля':'Enter an amount other than zero','Введите сумму':'Enter an amount',
      'Введите имя':'Enter a name','Сначала создайте группу':'Create a group first','Заполните данные платежа':'Complete the payment details',
      'Заполните все поля':'Fill in all fields','Пароли не совпадают':'Passwords do not match',
      'Пароль должен содержать минимум 6 символов':'Password must contain at least 6 characters',
      'Аккаунт создан. Проверьте email для подтверждения.':'Account created. Check your email to confirm your address.',
      'Не удалось зарегистрироваться':'Could not create account','Введите email и пароль':'Enter your email and password',
      'Пользователь не авторизован':'User is not authenticated','На этот день занятий нет':'No lessons for this day',
      'Запланировано':'Scheduled','Проведено':'Completed','Перенесено':'Rescheduled','Отменено — списать':'Cancelled — charge','Отменено — не списывать':'Cancelled — no charge',
      'Пробный урок — бесплатно':'Trial lesson — free','Пробный урок — бесплатно':'Trial lesson — free',
      'мин ·':'min ·','BYN':'BYN','Выйти':'Log out','Язык':'Language'
    },
    ru: {}
  };
  const reverse = {};
  Object.entries(dictionaries.en).forEach(([ru,en]) => reverse[en] = ru);
  dictionaries.ru = reverse;
  let language = localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ru';
  const originalStatusLabels = {
    pending:'Запланировано', conducted:'Проведено', rescheduled:'Перенесено',
    cancelled_charge:'Отменено — списать', cancelled_free:'Отменено — не списывать'
  };
  function translateText(value) {
    let result = value;
    const map = dictionaries[language];
    Object.keys(map).sort((a,b)=>b.length-a.length).forEach(key => {
      if (result.includes(key)) result = result.split(key).join(map[key]);
    });
    return result;
  }
  function translateNode(node) {
    if (!node || node.nodeType !== 1) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(t => {
      if (t.parentElement && ['SCRIPT','STYLE'].includes(t.parentElement.tagName)) return;
      const next = translateText(t.nodeValue);
      if (next !== t.nodeValue) t.nodeValue = next;
    });
    node.querySelectorAll('input[placeholder],textarea[placeholder],[title],[aria-label]').forEach(el => {
      ['placeholder','title','aria-label'].forEach(attr => {
        if (el.hasAttribute(attr)) el.setAttribute(attr, translateText(el.getAttribute(attr)));
      });
    });
  }
  function updateButtons() {
    document.querySelectorAll('[data-language-toggle]').forEach(el => {
      el.textContent = language === 'ru' ? 'EN' : 'RU';
      el.setAttribute('aria-label', language === 'ru' ? 'Switch to English' : 'Переключить на русский');
      el.title = language === 'ru' ? 'Switch to English' : 'Переключить на русский';
    });
    document.documentElement.lang = language;
    if (typeof statusLabels !== 'undefined') {
      Object.keys(originalStatusLabels).forEach(key => {
        statusLabels[key] = language === 'en' ? (dictionaries.en[originalStatusLabels[key]] || originalStatusLabels[key]) : originalStatusLabels[key];
      });
    }
  }
  function setLanguage(next) {
    language = next === 'en' ? 'en' : 'ru';
    localStorage.setItem(STORAGE_KEY, language);
    updateButtons();
    translateNode(document.body);
    if (typeof renderWeek === 'function') renderWeek();
    if (typeof renderDay === 'function') renderDay();
    if (typeof renderStudents === 'function' && document.getElementById('students-list')) renderStudents();
  }
  window.getLanguage = () => language;
  window.setLanguage = setLanguage;
  window.toggleLanguage = () => setLanguage(language === 'ru' ? 'en' : 'ru');
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-language-toggle]').forEach(el => el.addEventListener('click', window.toggleLanguage));
    updateButtons();
    translateNode(document.body);
    const observer = new MutationObserver(records => records.forEach(record => {
      if (record.type === 'childList') record.addedNodes.forEach(n => {
        if (n.nodeType === 1) translateNode(n);
        else if (n.nodeType === 3) n.nodeValue = translateText(n.nodeValue);
      });
      if (record.type === 'characterData') {
        const next = translateText(record.target.nodeValue);
        if (next !== record.target.nodeValue) record.target.nodeValue = next;
      }
      if (record.type === 'attributes' && record.target.nodeType === 1) {
        const el = record.target;
        ['placeholder','title','aria-label'].forEach(attr => {
          if (el.hasAttribute(attr)) {
            const next = translateText(el.getAttribute(attr));
            if (next !== el.getAttribute(attr)) el.setAttribute(attr,next);
          }
        });
      }
    }));
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
  });
})();