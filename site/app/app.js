// Кабинет Пространства: один код для сайта и для мини-приложения в Telegram.
(() => {
  'use strict';

  const CFG = Object.assign({
    api: '../api/', bot: '', miniapp: '', site: '../', img: '../img/',
    privacy: '../privacy.html', consent: '../consent.html', demo: false,
  }, window.PR_CONFIG || {});
  const TG = window.Telegram && window.Telegram.WebApp;
  const inTG = !!(TG && TG.initData);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- справочники ----------
  const FORMAT = {
    lit:     { name: 'Литературный клуб', img: 'ch-lit', about: 'Читаем книги и обсуждаем их: спорим, соглашаемся, делимся любимыми цитатами. Иногда читаем вслух по ролям. Можно прийти, не дочитав.' },
    script:  { name: 'Сценарный клуб', img: 'ch-script', about: 'Пишем сценарии короткого и полного метра, разбираем сцены и диалоги, читаем друг другу по ролям. Подходит и тем, кто только начинает, и тем, кто уже пишет.' },
    guest:   { name: 'Специальный гость', img: 'ch-guest', about: 'Встреча с гостем: писателем, режиссёром или художником. Сначала рассказ, потом вопросы и разговор за чаем.' },
    film:    { name: 'Кино', img: 'ch-film', about: 'Смотрим фильм на большом экране и обсуждаем его вместе. Чай и плед прилагаются.' },
    costume: { name: 'История костюма', img: 'ch-costume', about: 'Как менялась одежда от эпохи к эпохе и что из этого подходит именно вам. Разбираем силуэты, ткани и цвета и собираем свой стиль.' },
    art:     { name: 'Рисунок и история искусств', img: 'ch-art', about: 'Рисуем с натуры и узнаём, как смотрели на мир художники разных эпох. Опыт не нужен, бумагу и уголь дадим.' },
  };
  const FILTERS = [
    ['all', 'Все', null],
    ['club', 'Клубы', ['lit', 'script'], 'var(--c-lit)'],
    ['weekend', 'Гости и кино', ['guest', 'film'], 'var(--c-guest)'],
    ['costume', 'Костюм', ['costume'], 'var(--c-costume)'],
    ['art', 'Рисунок', ['art'], 'var(--c-art)'],
  ];
  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const WD_DAT = ['воскресеньям', 'понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам'];
  const WD_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const MON_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MON_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MON_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const SCREENS = ['home', 'schedule', 'bookings', 'plans', 'staff'];
  const NEEDS = { home: ['me', 'events', 'ach'], schedule: ['me', 'events'], bookings: ['me', 'bookings'], plans: ['me', 'plans'], staff: ['me'] };

  // Значок и цвет каждого достижения.
  const ACH = {
    first: ['a-door', 'var(--accent)'], lit: ['a-book', 'var(--c-lit)'], script: ['a-pen', 'var(--c-script)'],
    film: ['a-film', 'var(--c-film)'], guest: ['a-mic', 'var(--c-guest)'], costume: ['a-hanger', 'var(--c-costume)'],
    art: ['a-brush', 'var(--c-art)'], formats: ['a-star', 'var(--accent)'], week: ['a-spark', 'var(--accent)'],
    regular: ['a-key', 'var(--fg)'], season: ['a-leaf', 'var(--c-lit)'], halfyear: ['a-heart', 'var(--c-guest)'],
  };

  const S = {
    token: null, me: null, events: null, bookings: null, plans: null, ach: null,
    screen: 'home', day: null, filter: 'all', planMonth: null, club: 'lit',
    staff: { tab: 'day', date: null, q: '', sell: { plan: 'clubs', month: null, club: 'lit' } },
  };

  // ---------- мелочи ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } },
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const rub = (n) => Number(n).toLocaleString('ru-RU') + ' ₽';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const icon = (id, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  function plural(n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }
  const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'друг';

  // «2026-09-27 19:30:00» — время Москвы, показываем как есть.
  function dt(s) {
    const [d, t = '00:00:00'] = String(s).split(' ');
    const [y, m, dd] = d.split('-').map(Number);
    const [h, mi] = t.split(':').map(Number);
    return new Date(y, m - 1, dd, h, mi);
  }
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const longDate = (d) => `${d.getDate()} ${MON_GEN[d.getMonth()]}`;
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function dayWord(d) {
    const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 864e5);
    if (diff === 0) return 'сегодня';
    if (diff === 1) return 'завтра';
    return WD_FULL[d.getDay()];
  }
  function dur(min) {
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return `${m} мин`;
    return m ? `${h} ч ${m} мин` : `${h} ч`;
  }

  // ---------- связь с сервером ----------
  function apiError(message, status) { const e = new Error(message); e.status = status; return e; }

  async function api(route, body, query) {
    if (CFG.demo) return window.PRDemo.api(route, body || null, query || {});
    let url = CFG.api + 'index.php?r=' + route;
    for (const [k, v] of Object.entries(query || {})) url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
    const headers = {};
    if (S.token) { headers.Authorization = 'Bearer ' + S.token; headers['X-Auth-Token'] = S.token; }
    if (body) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(url, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    } catch (e) {
      throw apiError('Нет связи. Проверьте интернет и попробуйте ещё раз.', 0);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* пустой ответ */ }
    if (res.status === 401 && S.token && !route.startsWith('auth/')) {
      sessionLost();
    }
    if (!res.ok) throw apiError((data && data.error) || 'Что-то пошло не так. Попробуйте ещё раз.', res.status);
    return data || {};
  }

  const loaders = {
    me: () => api('me').then((d) => { S.me = d; paintMe(); }),
    events: () => {
      const today = new Date();
      return api('events', null, { from: ymd(today), to: ymd(addDays(today, 42)) }).then((d) => { S.events = d.events; });
    },
    bookings: () => api('bookings').then((d) => { S.bookings = d; paintBadge(); }),
    plans: () => api('plans').then((d) => { S.plans = d; }),
    ach: () => api('achievements').then((d) => { S.ach = d.achievements; }),
  };
  const refresh = (...keys) => Promise.all(keys.map((k) => loaders[k]()));

  function setToken(t) {
    S.token = t;
    if (!inTG && !CFG.demo) store.set('pr_token', t);
  }

  function sessionLost() {
    setToken(null);
    if (inTG) { location.reload(); return; }
    closeSheet();
    showLogin();
  }

  // ---------- отклик и уведомления ----------
  function haptic(kind = 'light') {
    if (!inTG || !TG.HapticFeedback) return;
    try {
      if (kind === 'ok') TG.HapticFeedback.notificationOccurred('success');
      else if (kind === 'err') TG.HapticFeedback.notificationOccurred('error');
      else if (kind === 'tick') TG.HapticFeedback.selectionChanged();
      else TG.HapticFeedback.impactOccurred(kind);
    } catch (e) { /* старый клиент */ }
  }

  let toastTimer;
  function toast(text, ok = false, ms = 3400) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.toggle('is-ok', ok);
    t.hidden = false;
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  function busy(btn, on = true) {
    if (!btn) return;
    btn.classList.toggle('is-busy', on);
    btn.disabled = on;
  }

  // ---------- шторка ----------
  let sheetOnClose = null;
  function openSheet(html, opts = {}) {
    const el = $('#sheet');
    const body = $('#sheetBody');
    body.innerHTML = html;
    body.classList.toggle('has-hero', !!opts.hero);
    el.hidden = false;
    el.classList.remove('is-closing');
    $('.sheet__panel', el).scrollTop = 0;
    document.documentElement.style.overflow = 'hidden';
    sheetOnClose = opts.onClose || null;
    if (inTG) TG.BackButton.show();
  }
  function closeSheet() {
    const el = $('#sheet');
    if (el.hidden || el.classList.contains('is-closing')) return;
    el.classList.add('is-closing');
    setTimeout(() => { el.hidden = true; el.classList.remove('is-closing'); $('#sheetBody').innerHTML = ''; }, 260);
    document.documentElement.style.overflow = '';
    if (inTG) TG.BackButton.hide();
    if (/^#(event-\d+|profile|achievements)$/.test(location.hash)) history.replaceState(null, '', '#' + S.screen);
    const cb = sheetOnClose;
    sheetOnClose = null;
    if (cb) cb();
  }
  const sheetOpen = () => !$('#sheet').hidden && !$('#sheet').classList.contains('is-closing');

  // ---------- экраны ----------
  function show(id) {
    ['boot', 'login', 'onboarding', 'app'].forEach((x) => {
      const el = document.getElementById(x);
      if (x === 'boot') { el.classList.toggle('is-gone', id !== 'boot'); return; }
      el.hidden = x !== id;
    });
  }

  function isStaff() { return !!(S.me && S.me.client.is_staff); }

  function route() {
    const h = decodeURIComponent((location.hash || '#home').slice(1));
    const m = h.match(/^event-(\d+)$/);
    if (m) {
      if (S.screen !== 'schedule' || $('#s-schedule').hidden) showScreen('schedule');
      openEvent(Number(m[1]));
      return;
    }
    if (h === 'profile' || h === 'achievements') {
      // Шторка открывается поверх экрана; если экран ещё не нарисован (открыли по ссылке), рисуем главную.
      if (!$('#s-' + S.screen).innerHTML.trim()) showScreen(S.screen);
      if (h === 'profile') openProfile(); else openAchievements();
      return;
    }
    let name = h;
    if (!SCREENS.includes(name) || (name === 'staff' && !isStaff())) {
      name = 'home';
      history.replaceState(null, '', '#home');
    }
    if (sheetOpen()) closeSheet();
    showScreen(name);
  }

  function showScreen(name) {
    const changed = S.screen !== name || $('#s-' + name).hidden;
    S.screen = name;
    $$('.screen').forEach((s) => { s.hidden = s.dataset.screen !== name; });
    $$('.tab').forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    render(name);
    if (changed) window.scrollTo(0, 0);
  }

  function render(name = S.screen) {
    const box = $('#s-' + name);
    const missing = (NEEDS[name] || []).filter((k) => S[k] == null);
    if (missing.length) {
      box.innerHTML = skeleton();
      refresh(...missing)
        .then(() => { if (S.screen === name) render(name); })
        .catch((e) => { box.innerHTML = errorBlock(e.message); });
      return;
    }
    RENDER[name](box);
  }

  const skeleton = () => `<div class="skel" style="height:90px"></div><div class="skel" style="height:220px"></div><div class="skel" style="height:140px"></div>`;
  const errorBlock = (msg) => `<div class="empty"><p>${esc(msg)}</p><button class="pill pill--ink" data-act="retry">Попробовать ещё раз</button></div>`;

  // Данные поменялись (запись, отмена, оплата): обновляем всё, что видно.
  async function reloadAll() {
    await refresh('me', 'events', 'bookings', 'ach');
    if (S.plans == null) await refresh('plans').catch(() => {});
    render();
  }

  function paintMe() {
    const c = S.me.client;
    $('#meInitial').textContent = (firstName(c.name)[0] || 'П').toUpperCase();
    $('#staffTab').hidden = !c.is_staff;
  }
  function paintBadge() {
    const n = S.bookings ? S.bookings.upcoming.filter((e) => e.my_status === 'pending_payment').length : 0;
    const b = $('#bookBadge');
    b.hidden = !n;
    b.textContent = n;
  }

  // ---------- общие куски разметки ----------
  const fmtName = (e) => (FORMAT[e.format] ? FORMAT[e.format].name : e.format_name);
  const color = (f) => `var(--c-${f in FORMAT ? f : 'lit'})`;

  function datebox(d, f) {
    return `<span class="datebox" style="--c:${color(f)}"><span>${WD[d.getDay()]}</span><b>${d.getDate()}</b><span>${MON_SHORT[d.getMonth()]}</span></span>`;
  }
  // Крупная цена: цифры антиквой, знак рубля — гротеском (в антикве его нет).
  const rubBig = (n) => `${Number(n).toLocaleString('ru-RU')}<span class="cur">₽</span>`;

  function statusBadge(e) {
    switch (e.my_status) {
      case 'booked': case 'attended': return `<span class="badge badge--ok">${icon('check')}Вы записаны</span>`;
      case 'waitlist': return '<span class="badge badge--wait">Лист ожидания</span>';
      case 'pending_payment': return '<span class="badge badge--pay">Ждёт оплаты</span>';
      default: return '';
    }
  }

  function evCard(e, withDay = false) {
    const d = dt(e.starts_at);
    const name = fmtName(e);
    const mine = statusBadge(e);
    let foot = mine;
    if (!mine) {
      if (e.left === 0) {
        foot = '<span class="badge">Мест нет</span><span class="ev__cta">В лист ожидания' + icon('arrow') + '</span>';
      } else {
        const cov = e.cover && e.cover.type === 'membership'
          ? '<span class="badge badge--plan">По абонементу</span>'
          : `<span class="badge badge--price">${rub(e.price)}</span>`;
        const few = e.left <= 10 ? `<span class="badge badge--few">осталось ${e.left} ${plural(e.left, ['место', 'места', 'мест'])}</span>` : '';
        foot = cov + few + '<span class="ev__cta">Записаться' + icon('arrow') + '</span>';
      }
    }
    const time = withDay
      ? `<span class="ev__time">${d.getDate()}<small>${MON_SHORT[d.getMonth()]}, ${WD[d.getDay()]}</small></span>`
      : `<span class="ev__time">${hm(d)}<small>${dur(e.duration_min)}</small></span>`;
    return `<button class="ev" type="button" data-act="event" data-id="${e.id}" style="--c:${color(e.format)}">
      ${time}
      <span class="ev__body">
        ${e.title !== name ? `<span class="ev__fmt">${esc(name)}</span>` : ''}
        <span class="ev__title">${esc(e.title)}</span>
        ${e.host ? `<span class="ev__host">${esc(e.host)}</span>` : ''}
        ${withDay ? `<span class="ev__host">${cap(dayWord(d))}, ${hm(d)} · ${dur(e.duration_min)}</span>` : ''}
        <span class="ev__foot">${foot}</span>
      </span>
    </button>`;
  }

  // ---------- главная ----------
  function membershipCard() {
    const { membership: m, next_membership: nm, month } = S.me;
    const single = S.plans ? S.plans.single_price : 2500;
    if (!m) {
      if (nm) {
        return `<article class="mcard mcard--empty" data-month="${cap(nm.month_label)}">
          <p class="eyebrow">Абонемент</p>
          <h2 class="mcard__name">${esc(nm.name)}</h2>
          <div class="notice notice--ok">${icon('check')}<span>Оплачен на ${esc(nm.month_label)}. Начнёт действовать 1-го числа, а записываться можно уже сейчас.</span></div>
          <p class="muted small">В ${esc(month.current_label)} встречи — по разовой оплате, ${rub(single)}.</p>
        </article>`;
      }
      return `<article class="mcard mcard--empty" data-month="${cap(month.current_label)}">
        <p class="eyebrow">Абонемент</p>
        <h2 class="mcard__name">Пока без абонемента</h2>
        <p class="muted">С абонементом клубы без ограничений, а на выходные встречи есть проходки. Без него каждая встреча — ${rub(single)}.</p>
        <a class="pill pill--ink pill--wide" href="#plans">Выбрать абонемент</a>
      </article>`;
    }
    const rows = m.items.map((it) => {
      if (it.unlimited) return `<li><span>${esc(it.label)}</span><b>без ограничений</b></li>`;
      const left = Math.max(0, it.limit - it.used);
      const dots = Array.from({ length: it.limit }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('');
      return `<li><span>${esc(it.label)}</span><b>осталось ${left} из ${it.limit}</b><span class="dots" aria-hidden="true">${dots}</span></li>`;
    }).join('') + '<li><span>Чат держателей карты</span><b>' + (S.me.links.members_chat ? `<a href="${esc(S.me.links.members_chat)}" target="_blank" rel="noopener" data-ext>открыть</a>` : 'есть') + '</b></li>';

    const end = dt(month.current + '-01 00:00:00');
    end.setMonth(end.getMonth() + 1);
    const daysLeft = Math.max(0, Math.ceil((end - new Date()) / 864e5) - 1);
    let foot = '';
    if (nm) {
      foot = `<p class="mcard__ok">${icon('check')}${cap(nm.month_label)} уже оплачен</p>`;
    } else if (daysLeft <= 7) {
      foot = `<p class="small" style="color:var(--muted)">${daysLeft ? `До конца абонемента ${daysLeft} ${plural(daysLeft, ['день', 'дня', 'дней'])}` : 'Сегодня последний день абонемента'}.</p>
        <a class="pill pill--light pill--wide" href="#plans" data-act="plans-next">Продлить на ${esc(month.next_label)}</a>`;
    }
    return `<article class="mcard" data-month="${cap(m.month_label)}">
      <div class="mcard__top"><span class="eyebrow">Абонемент · ${esc(m.month_label)}</span><span class="small" style="color:var(--muted)">до ${esc(m.ends)}</span></div>
      <h2 class="mcard__name">${esc(m.name)}</h2>
      <ul class="mcard__rows">${rows}</ul>
      ${foot ? `<div class="mcard__foot">${foot}</div>` : ''}
    </article>`;
  }

  function nextCard() {
    const e = S.me.next_booking;
    if (!e) {
      return `<article class="card">
        <p class="eyebrow">Ближайшая запись</p>
        <p>Вы пока никуда не записаны. Выберите встречу: запись занимает пару касаний.</p>
        <a class="pill pill--ink" href="#schedule">Открыть расписание</a>
      </article>`;
    }
    const d = dt(e.starts_at);
    const booked = e.my_status === 'booked';
    return `<article class="card">
      <div class="card__head"><p class="eyebrow">Ближайшая запись</p>${statusBadge(e)}</div>
      <button class="next" type="button" data-act="event" data-id="${e.id}">
        ${datebox(d, e.format)}
        <span><span class="next__title">${esc(e.title)}</span><span class="next__meta">${cap(dayWord(d))}, ${hm(d)} · ${dur(e.duration_min)}</span></span>
      </button>
      <div class="btn-row">
        ${booked ? `<button class="pill pill--ghost pill--sm" data-act="ics" data-id="${e.booking_id}">${icon('cal')}В календарь</button>` : ''}
        ${e.my_status === 'pending_payment' ? `<button class="pill pill--accent pill--sm" data-act="book" data-id="${e.id}">Оплатить ${rub(e.price)}</button>` : ''}
        <a class="pill pill--quiet pill--sm" href="#bookings">Все записи</a>
      </div>
    </article>`;
  }

  // ---------- достижения ----------
  function medal(a, cls = '') {
    const [ic, c] = ACH[a.code] || ['a-star', 'var(--accent)'];
    return `<span class="medal${a.done ? ' is-done' : ''}${cls}" style="--c:${c};--p:${Math.round((a.progress / a.goal) * 100)}" aria-hidden="true">${icon(ic)}</span>`;
  }
  const pbar = (a) => `<span class="pbar"><i style="width:${Math.round((a.progress / a.goal) * 100)}%"></i></span>`;

  function achCard() {
    const list = S.ach || [];
    if (!list.length) return '';
    const done = list.filter((a) => a.done);
    const next = list.filter((a) => !a.done)
      .sort((x, y) => (y.progress / y.goal) - (x.progress / x.goal) || (x.goal - x.progress) - (y.goal - y.progress))[0];
    return `<article class="card">
      <div class="card__head"><p class="eyebrow">Достижения</p><button class="link" type="button" data-act="ach">${done.length} из ${list.length}${icon('arrow')}</button></div>
      ${done.length ? `<div class="ach-row">${done.map((a) => medal(a, ' medal--sm')).join('')}</div>` : ''}
      ${next ? `<button class="ach-next" type="button" data-act="ach" style="--c:${(ACH[next.code] || [])[1] || 'var(--accent)'}">${medal(next, ' medal--sm')}<span><span class="ach-next__t">Дальше: «${esc(next.title)}»</span><span class="ach-next__s">${esc(next.text)} · ${next.progress} из ${next.goal}</span>${pbar(next)}</span></button>` : ''}
    </article>`;
  }

  async function openAchievements() {
    if (!S.ach) {
      try { await refresh('ach'); } catch (e) { toast(e.message); return; }
    }
    const list = S.ach;
    const done = list.filter((a) => a.done).length;
    openSheet(`
      <p class="eyebrow">Достижения</p>
      <h2 class="sheet__title" id="sheetTitle">Получено ${done} из ${list.length}</h2>
      <p class="muted">Считаем встречи, на которых вы были, и месяцы с абонементом. О новом достижении напишет бот.</p>
      <div class="ach-grid">${list.map((a) => `<div class="ach${a.done ? ' is-done' : ''}" style="--c:${(ACH[a.code] || [])[1] || 'var(--accent)'}">
        ${medal(a)}
        <p class="ach__t">${esc(a.title)}</p>
        <p class="ach__s">${esc(a.text)}</p>
        ${a.done ? `<p class="ach__d">${icon('check')}${a.earned_at ? 'Получено ' + esc(a.earned_at) : 'Получено'}</p>` : `${pbar(a)}<p class="ach__d">${a.progress} из ${a.goal}</p>`}
      </div>`).join('')}</div>
    `);
    if (location.hash !== '#achievements') history.replaceState(null, '', '#achievements');
  }

  function renderHome(box) {
    const c = S.me.client;
    const now = new Date();
    const h = now.getHours();
    const hi = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    const soon = (S.events || []).filter((e) => !e.my_status || e.my_status === 'cancelled').slice(0, 3);
    box.innerHTML = `
      <div class="hello">
        <p class="eyebrow">${WD_FULL[now.getDay()]}, ${longDate(now)}</p>
        <h1 class="h1">${hi},<br><em>${esc(firstName(c.name))}</em></h1>
      </div>
      ${membershipCard()}
      ${nextCard()}
      ${achCard()}
      ${soon.length ? `
        <div class="section-title"><h2>Скоро в Пространстве</h2><a class="link" href="#schedule">Всё${icon('arrow')}</a></div>
        <div class="evlist">${soon.map((e) => evCard(e, true)).join('')}</div>` : ''}
      ${!c.phone ? `<button class="notice" type="button" data-act="phone" style="border:0;text-align:left;cursor:pointer;font:inherit">${icon('phone')}<span>Добавьте телефон: на него придёт чек об оплате. <b style="color:var(--accent)">Добавить</b></span></button>` : ''}
    `;
  }

  // ---------- расписание ----------
  function filteredEvents() {
    const f = FILTERS.find((x) => x[0] === S.filter);
    return (S.events || []).filter((e) => !f || !f[2] || f[2].includes(e.format));
  }

  function renderSchedule(box) {
    const list = filteredEvents();
    const byDay = {};
    list.forEach((e) => { (byDay[e.starts_at.slice(0, 10)] = byDay[e.starts_at.slice(0, 10)] || []).push(e); });
    const today = startOfDay(new Date());
    const days = Array.from({ length: 35 }, (_, i) => addDays(today, i));
    if (!S.day || !days.some((d) => ymd(d) === S.day) || (!byDay[S.day] && S.dayAuto)) {
      const first = days.find((d) => byDay[ymd(d)]);
      S.day = ymd(first || today);
      S.dayAuto = true;
    }
    const strip = days.map((d, i) => {
      const key = ymd(d);
      const evs = byDay[key] || [];
      const fm = [...new Set(evs.map((e) => e.format))].slice(0, 3);
      const month = (i === 0 || d.getDate() === 1) ? `<span class="day__month">${MON_NOM[d.getMonth()]}</span>` : '';
      return `${month}<button class="day${i === 0 ? ' is-today' : ''}${key === S.day ? ' is-sel' : ''}${evs.length ? '' : ' is-empty'}" type="button" data-act="day" data-day="${key}" aria-pressed="${key === S.day}" aria-label="${WD_FULL[d.getDay()]}, ${longDate(d)}: ${evs.length ? evs.length + ' ' + plural(evs.length, ['встреча', 'встречи', 'встреч']) : 'нет встреч'}">
        <small>${i === 0 ? 'сегодня' : WD[d.getDay()]}</small><b>${d.getDate()}</b><span class="dd">${fm.map((f) => `<i style="--c:${color(f)}"></i>`).join('')}</span>
      </button>`;
    }).join('');
    const sel = dt(S.day + ' 00:00:00');
    const evs = byDay[S.day] || [];
    let body;
    if (evs.length) {
      body = `<div class="evlist">${evs.map((e) => evCard(e)).join('')}</div>`;
    } else {
      const nextDay = days.find((d) => d > sel && byDay[ymd(d)]);
      body = `<div class="empty"><p>В этот день ${S.filter === 'all' ? 'встреч нет' : 'таких встреч нет'}.</p>${nextDay ? `<button class="pill pill--ghost pill--sm" data-act="day" data-day="${ymd(nextDay)}">Ближайшие — ${dayWord(nextDay) === 'завтра' ? 'завтра' : WD[nextDay.getDay()] + ', ' + longDate(nextDay)}</button>` : ''}</div>`;
    }
    box.innerHTML = `
      <div class="screen__head"><h1 class="h1">Расписание</h1><p>Выберите день и нажмите на встречу, чтобы записаться.</p></div>
      <div class="chips" role="group" aria-label="Что показать">${FILTERS.map(([k, label, , c]) => `<button class="chip" type="button" data-act="filter" data-f="${k}" aria-pressed="${S.filter === k}">${c ? `<i style="--c:${c}"></i>` : ''}${label}</button>`).join('')}</div>
      <div class="days" id="days">${strip}</div>
      <div class="daytitle"><h2>${dayWord(sel)}${dayWord(sel) === WD_FULL[sel.getDay()] ? '' : ', ' + WD_FULL[sel.getDay()]}, ${longDate(sel)}</h2></div>
      ${body}
    `;
    const strip$ = $('#days', box);
    const selBtn = $('.day.is-sel', strip$);
    if (selBtn) strip$.scrollLeft = Math.max(0, selBtn.offsetLeft - strip$.clientWidth / 2 + selBtn.clientWidth / 2);
  }

  function findEvent(id) {
    const pools = [S.events || [], S.bookings ? S.bookings.upcoming : [], S.me && S.me.next_booking ? [S.me.next_booking] : []];
    for (const p of pools) { const e = p.find((x) => x.id === id); if (e) return e; }
    return null;
  }

  async function openEvent(id) {
    let e = findEvent(id);
    if (!e) {
      try { await refresh('events'); } catch (err) { /* ниже покажем сообщение */ }
      e = findEvent(id);
    }
    if (!e) { toast('Встреча уже прошла или отменена'); history.replaceState(null, '', '#schedule'); return; }
    const d = dt(e.starts_at);
    const end = new Date(d.getTime() + e.duration_min * 60000);
    const f = FORMAT[e.format] || { name: e.format_name, img: 'hall', about: '' };
    const st = e.my_status;
    const booked = st === 'booked' || st === 'attended';
    const onPlan = e.cover && e.cover.type === 'membership';

    let cover;
    if (booked) cover = `<div class="cover"><b>Вы записаны</b><small>${e.paid_by === 'single' ? 'Разовое посещение оплачено.' : 'По абонементу.'} Напомним в Telegram накануне и за 2 часа.</small></div>`;
    else if (st === 'waitlist') cover = `<div class="cover cover--single"><b>Вы в листе ожидания</b><small>Если место освободится, напишем в Telegram. Останется только подтвердить запись.</small></div>`;
    else if (st === 'pending_payment') cover = `<div class="cover cover--single"><b>Ждёт оплаты — ${rub(e.price)}</b><small>Место держим 30 минут с момента записи.</small></div>`;
    else if (onPlan) {
      const left = (e.cover.note.match(/останется .+$/) || [])[0];
      cover = `<div class="cover"><b>Входит в абонемент</b><small>${left ? 'После записи ' + esc(left) + '.' : 'Клубы по вашему абонементу — без ограничений.'}</small></div>`;
    }
    else {
      const noPlan = !S.me.membership && !S.me.next_membership;
      cover = `<div class="cover cover--single"><b>Разовое посещение — ${rub(e.price)}</b><small>${esc(e.cover && e.cover.reason ? e.cover.reason + '.' : 'Оплата онлайн, чек придёт на телефон.')}${noPlan ? ' <a href="#plans" data-act="to-plans" style="color:inherit">С абонементом выгоднее →</a>' : ''}</small></div>`;
    }

    let actions = '';
    if (booked) {
      actions = `<div class="btn-row">
        <button class="pill pill--ghost" data-act="ics" data-id="${e.booking_id}">${icon('cal')}В календарь</button>
        <button class="pill pill--danger" data-act="cancel" data-id="${e.id}">Отменить</button></div>`;
    } else if (st === 'waitlist') {
      actions = (e.left > 0 ? `<button class="pill pill--ink pill--wide" data-act="book" data-id="${e.id}">Место есть — записаться</button>` : '') +
        `<button class="pill pill--ghost pill--wide" data-act="cancel" data-id="${e.id}">Выйти из листа ожидания</button>`;
    } else if (st === 'pending_payment') {
      actions = `<button class="pill pill--accent pill--wide" data-act="book" data-id="${e.id}">Оплатить ${rub(e.price)}</button>
        <button class="pill pill--ghost pill--wide" data-act="cancel" data-id="${e.id}">Отменить запись</button>`;
    } else if (e.left === 0) {
      actions = `<button class="pill pill--ink pill--wide" data-act="book" data-id="${e.id}">Встать в лист ожидания</button>`;
    } else if (onPlan) {
      actions = `<button class="pill pill--ink pill--wide" data-act="book" data-id="${e.id}">Записаться</button>`;
    } else {
      actions = `<button class="pill pill--accent pill--wide" data-act="book" data-id="${e.id}">Записаться и оплатить ${rub(e.price)}</button>`;
    }
    const rule = e.free_cancel
      ? `Отменить запись без списания можно до ${esc(e.free_cancel_until)}.`
      : 'До встречи меньше суток: если отменить запись сейчас, посещение спишется.';

    openSheet(`
      <div class="sheet__hero"><img src="${CFG.img}${f.img}-s.webp" alt="" width="1200" height="800"></div>
      ${e.title !== f.name ? `<p class="eyebrow" style="color:${color(e.format)}">${esc(f.name)}</p>` : ''}
      <h2 class="sheet__title" id="sheetTitle">${esc(e.title)}</h2>
      ${e.host ? `<p class="muted">Ведёт: ${esc(e.host)}</p>` : ''}
      <div class="facts">
        <div>${icon('cal')}${cap(dayWord(d))}${dayWord(d) === WD_FULL[d.getDay()] ? '' : ', ' + WD_FULL[d.getDay()]}, ${longDate(d)}</div>
        <div>${icon('clock')}${hm(d)}–${hm(end)} · ${dur(e.duration_min)}</div>
        <div>${icon('seat')}${e.left > 0 ? `Свободно ${e.left} ${plural(e.left, ['место', 'места', 'мест'])} из ${e.capacity}` : 'Мест нет: можно встать в лист ожидания'}</div>
      </div>
      <p>${esc(e.description || f.about)}</p>
      ${cover}
      <div class="sheet__actions">${actions}<p class="sheet__rule">${rule}</p></div>
    `, { hero: true });
    if (location.hash !== '#event-' + e.id) history.replaceState(null, '', '#event-' + e.id);
  }

  // ---------- запись и отмена ----------
  async function book(id, btn) {
    busy(btn);
    try {
      const r = await api('book', { event_id: id });
      if (r.status === 'payment_required') { goPay(r.payment_url); return; }
      haptic('ok');
      closeSheet();
      await reloadAll();
      toast(r.status === 'waitlist' ? 'Вы в листе ожидания. Напишем, если место освободится.' : 'Вы записаны! Напомним накануне.', true);
    } catch (err) {
      if (err.status === 409) { askPhone(() => book(id)); return; }
      haptic('err');
      toast(err.message);
    } finally { busy(btn, false); }
  }

  function askCancel(id) {
    const e = findEvent(id);
    if (!e) return;
    const d = dt(e.starts_at);
    let text;
    if (e.my_status === 'waitlist') text = 'Вы выйдете из листа ожидания.';
    else if (e.my_status === 'pending_payment') text = 'Место, которое мы держали для вас, освободится.';
    else if (e.free_cancel) text = e.paid_by === 'single'
      ? `До встречи больше суток, поэтому мы вернём ${rub(e.price)}. Обычно деньги приходят за несколько дней.`
      : 'До встречи больше суток, поэтому посещение вернётся на абонемент.';
    else text = (e.paid_by === 'single' ? 'До встречи меньше суток, поэтому деньги за посещение не вернутся' : 'До встречи меньше суток, поэтому посещение спишется')
      + ': так устроены правила. Но всё равно лучше отменить: место достанется тому, кто ждёт.';
    openSheet(`
      <p class="eyebrow">Отмена записи</p>
      <h2 class="sheet__title" id="sheetTitle">${e.my_status === 'waitlist' ? 'Выйти из листа ожидания?' : 'Отменить запись?'}</h2>
      <div class="card card--flat"><p class="h3">${esc(e.title)}</p><p class="muted">${cap(dayWord(d))}, ${longDate(d)}, ${hm(d)}</p></div>
      <p>${text}</p>
      <div class="stack">
        <button class="pill pill--danger pill--wide" data-act="cancel-yes" data-id="${e.booking_id}">Да, отменить</button>
        <button class="pill pill--quiet pill--wide" data-close>Нет, оставить</button>
      </div>
    `);
  }

  async function cancelBooking(bookingId, btn) {
    busy(btn);
    try {
      const r = await api('cancel', { booking_id: bookingId });
      haptic('ok');
      closeSheet();
      await reloadAll();
      toast(r.refund ? 'Запись отменена. Деньги вернём в течение нескольких дней.' : r.returned ? 'Запись отменена' : 'Запись отменена, посещение списано', true);
    } catch (err) { toast(err.message); } finally { busy(btn, false); }
  }

  function icsUrl(bookingId) {
    return new URL(CFG.api + 'index.php?r=ics&t=' + encodeURIComponent(S.token) + (bookingId ? '&booking=' + bookingId : ''), location.href).href;
  }
  function addToCalendar(bookingId) {
    if (CFG.demo) { window.PRDemo.ics(bookingId); return; }
    const url = icsUrl(bookingId);
    if (inTG) TG.openLink(url); else location.href = url;
  }

  // ---------- оплата ----------
  function goPay(url) {
    if (CFG.demo) { window.PRDemo.pay(url); return; }
    toast('Открываем оплату…');
    location.href = url;
  }

  async function checkPurchase(id) {
    toast('Проверяем оплату…', false, 20000);
    for (let i = 0; i < 12; i++) {
      let p = null;
      try { p = await api('purchase', null, { id }); } catch (e) { /* попробуем ещё */ }
      if (p && p.status === 'paid') {
        $('#toast').hidden = true;
        haptic('ok');
        await reloadAll().catch(() => {});
        if (p.kind === 'membership') {
          const m = p.membership || S.me.membership || S.me.next_membership;
          const chat = S.me.links.members_chat;
          openSheet(`
            <div class="center stack" style="justify-items:center;padding-top:10px">
              <span style="width:64px;height:64px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center">${icon('check')}</span>
              <p class="eyebrow">Оплата прошла</p>
              <h2 class="sheet__title" style="padding:0">Абонемент «${esc(m ? m.name : '')}» ваш</h2>
              <p class="muted">${m ? `Действует до ${esc(m.ends)}. ` : ''}Теперь записывайтесь на встречи: по абонементу это одно касание.</p>
            </div>
            <div class="stack">
              <a class="pill pill--ink pill--wide" href="#schedule">Выбрать встречи</a>
              ${chat ? `<a class="pill pill--ghost pill--wide" href="${esc(chat)}" target="_blank" rel="noopener" data-ext>${icon('chat')}Вступить в чат держателей карты</a>` : ''}
            </div>`);
        } else {
          toast('Оплата прошла, вы записаны!', true);
        }
        return;
      }
      if (p && p.status === 'cancelled') { toast('Оплата не прошла. Можно попробовать ещё раз.'); return; }
      await sleep(i < 4 ? 1500 : 3000);
    }
    toast('Оплата ещё обрабатывается. Когда она пройдёт, пришлём сообщение в Telegram.', false, 6000);
  }

  // ---------- мои записи ----------
  function renderBookings(box) {
    const { upcoming, past } = S.bookings;
    const hasBooked = upcoming.some((e) => e.my_status === 'booked');
    const cards = upcoming.map((e) => {
      const d = dt(e.starts_at);
      let note = '', acts = '';
      if (e.my_status === 'booked') {
        note = e.paid_by === 'single' ? 'Разовое посещение, оплачено' : 'По абонементу';
        if (e.free_cancel) note += ` · отмена без списания до ${esc(e.free_cancel_until)}`;
        acts = `<button class="pill pill--ghost pill--sm" data-act="ics" data-id="${e.booking_id}">${icon('cal')}В календарь</button><button class="pill pill--quiet pill--sm" data-act="cancel" data-id="${e.id}">Отменить</button>`;
      } else if (e.my_status === 'waitlist') {
        note = e.left > 0 ? 'Место освободилось — успейте записаться' : 'Напишем в Telegram, если освободится место';
        acts = (e.left > 0 ? `<button class="pill pill--ink pill--sm" data-act="book" data-id="${e.id}">Записаться</button>` : '') + `<button class="pill pill--quiet pill--sm" data-act="cancel" data-id="${e.id}">Выйти из листа</button>`;
      } else if (e.my_status === 'pending_payment') {
        note = 'Место держим 30 минут с момента записи';
        acts = `<button class="pill pill--accent pill--sm" data-act="book" data-id="${e.id}">Оплатить ${rub(e.price)}</button><button class="pill pill--quiet pill--sm" data-act="cancel" data-id="${e.id}">Отменить</button>`;
      }
      return `<article class="card bk">
        <button class="next" type="button" data-act="event" data-id="${e.id}">
          ${datebox(d, e.format)}
          <span><span class="next__title">${esc(e.title)}</span><span class="next__meta">${cap(dayWord(d))}, ${hm(d)} · ${dur(e.duration_min)}</span></span>
        </button>
        <div class="card__head">${statusBadge(e)}</div>
        <p class="bk__note">${note}</p>
        <div class="bk__acts">${acts}</div>
      </article>`;
    }).join('');
    const pastLabel = { attended: 'были', noshow: 'не пришли', late_cancel: 'поздняя отмена', booked: 'прошла', waitlist: 'лист ожидания', pending_payment: 'не оплачена' };
    box.innerHTML = `
      <div class="screen__head"><h1 class="h1">Мои записи</h1>
        <p>${upcoming.length ? `Впереди ${upcoming.length} ${plural(upcoming.length, ['встреча', 'встречи', 'встреч'])}.` : 'Здесь появятся встречи, на которые вы записались.'}</p></div>
      ${hasBooked ? `<button class="notice" type="button" data-act="ics" data-id="" style="border:0;text-align:left;cursor:pointer;font:inherit;background:#fff;box-shadow:var(--shadow)">${icon('cal')}<span><b>Добавить все встречи в календарь телефона</b><br><span class="muted small">Календарь сам напомнит за 2 часа</span></span></button>` : ''}
      ${upcoming.length ? `<div class="evlist">${cards}</div>` : `<div class="empty"><p>Пока записей нет. Загляните в расписание: там клубы, гости и кино.</p><a class="pill pill--ink" href="#schedule">Открыть расписание</a></div>`}
      ${past.length ? `<details class="past"><summary>Прошедшие встречи · ${past.length}${icon('right')}</summary>
        <div class="past__list">${past.slice(0, 30).map((e) => { const d = dt(e.starts_at); return `<div class="past__item"><span>${esc(e.title)}<br><span class="muted small">${longDate(d)}</span></span><span>${pastLabel[e.my_status] || ''}</span></div>`; }).join('')}</div></details>` : ''}
    `;
  }

  // ---------- абонементы ----------
  function planFeatures(p) {
    const f = [];
    f.push(p.clubs === 1 ? 'Один клуб на выбор: литературный или сценарный, без ограничений' : 'Литературный и сценарный клубы без ограничений');
    f.push(`${p.weekend} ${plural(p.weekend, ['проходка', 'проходки', 'проходок'])} на выходные: гости и кино`);
    if (p.costume) f.push(`История костюма: ${p.costume} ${plural(p.costume, ['занятие', 'занятия', 'занятий'])} (чт, 12:00)`);
    if (p.art) f.push(`Рисунок и история искусств: ${p.art} ${plural(p.art, ['занятие', 'занятия', 'занятий'])} по 2 часа (вс, 12:00)`);
    f.push('Чат держателей карты');
    return f;
  }

  function renderPlans(box) {
    const P = S.plans, me = S.me;
    const owned = { [me.month.current]: me.membership, [me.month.next]: me.next_membership };
    if (!S.planMonth || !owned.hasOwnProperty(S.planMonth)) S.planMonth = owned[me.month.current] ? me.month.next : me.month.current;
    const sel = P.months.find((m) => m.key === S.planMonth) || P.months[0];
    const own = owned[sel.key];

    const end = dt(me.month.current + '-01 00:00:00');
    end.setMonth(end.getMonth() + 1);
    const daysLeft = Math.max(0, Math.ceil((end - new Date()) / 864e5) - 1);

    let body;
    if (own) {
      body = `<div class="plan__own">${icon('check')}<span>На ${esc(sel.label)} у вас «${esc(own.name)}». Он действует до ${esc(own.ends)}.</span></div>
        ${sel.key === me.month.current && !owned[me.month.next] ? `<button class="pill pill--ink pill--wide" data-act="plan-month" data-m="${me.month.next}">Оформить на ${esc(me.month.next_label)}</button>` : ''}`;
    } else {
      const hint = sel.key === me.month.current && daysLeft < 10
        ? `<div class="notice">${icon('clock')}<span>Абонемент действует до ${esc(sel.ends)}, то есть ещё ${daysLeft + 1} ${plural(daysLeft + 1, ['день', 'дня', 'дней'])}. Возможно, удобнее сразу взять на ${esc(me.month.next_label)}.</span></div>` : '';
      body = hint + P.plans.map((p) => {
        const hot = p.key === 'clubs';
        const clubPick = p.clubs === 1 ? `<div class="seg" role="group" aria-label="Какой клуб">
            <button type="button" data-act="club" data-club="lit" aria-pressed="${S.club === 'lit'}">Литературный</button>
            <button type="button" data-act="club" data-club="script" aria-pressed="${S.club === 'script'}">Сценарный</button></div>` : '';
        return `<article class="plan${hot ? ' plan--hot' : ''}">
          ${hot ? '<span class="plan__badge">Выбирают чаще</span>' : ''}
          <div class="plan__head"><h3 class="plan__name">${esc(p.name)}</h3><p class="plan__price">${rubBig(p.price)}<small> / мес</small></p></div>
          <ul>${planFeatures(p).map((t) => `<li>${icon('check')}<span>${t}</span></li>`).join('')}</ul>
          ${clubPick}
          <button class="pill ${hot ? 'pill--accent' : 'pill--ink'} pill--wide" data-act="buy" data-plan="${p.key}">Оплатить ${rub(p.price)}</button>
        </article>`;
      }).join('');
    }

    box.innerHTML = `
      <div class="screen__head"><h1 class="h1">Абонемент</h1><p>Действует календарный месяц: с 1-го по последнее число.</p></div>
      <div class="seg" role="group" aria-label="Месяц">${P.months.map((m) => `<button type="button" data-act="plan-month" data-m="${m.key}" aria-pressed="${m.key === sel.key}">${cap(m.label)}${owned[m.key] ? ' ✓' : ''}<small>до ${esc(m.ends)}</small></button>`).join('')}</div>
      ${body}
      <article class="card">
        <div class="plan__head"><h3 class="plan__name" style="font-size:24px">Разовое посещение</h3><p class="plan__price" style="font-size:30px">${rubBig(P.single_price)}</p></div>
        <p class="muted">Без абонемента: выберите встречу в расписании и оплатите при записи.</p>
        <a class="pill pill--ghost" href="#schedule">Открыть расписание</a>
      </article>
      <article class="card">
        <p class="eyebrow">Как это работает</p>
        <ol class="rules">
          <li><b>1</b><span>Абонемент действует календарный месяц, с 1-го по последнее число.</span></li>
          <li><b>2</b><span>Неиспользованные посещения в конце месяца сгорают, заморозки нет.</span></li>
          <li><b>3</b><span>Отменить запись без списания можно не позже чем за сутки до начала.</span></li>
          <li><b>4</b><span>В зале 40 мест. Если мест нет, встаньте в лист ожидания: напишем, когда место освободится.</span></li>
          <li><b>5</b><span>Оплата онлайн, чек придёт на телефон. Можно оплатить и на месте.</span></li>
        </ol>
      </article>
    `;
  }

  async function buy(plan, btn) {
    const body = { plan, month: S.planMonth };
    if (plan === 'club1') body.club = S.club;
    busy(btn);
    try {
      const r = await api('buy', body);
      goPay(r.payment_url);
    } catch (err) {
      if (err.status === 409) { askPhone(() => buy(plan)); return; }
      toast(err.message);
    } finally { busy(btn, false); }
  }

  // ---------- телефон ----------
  let afterPhone = null;
  function askPhone(then) {
    afterPhone = then || null;
    const canTg = inTG && typeof TG.requestContact === 'function' && TG.isVersionAtLeast('6.9');
    openSheet(`
      <p class="eyebrow">Ещё один шаг</p>
      <h2 class="sheet__title" id="sheetTitle">Нужен ваш телефон</h2>
      <p class="muted">На него придёт чек об оплате. Звоним, только если встреча вдруг переносится.</p>
      ${canTg ? `<button class="pill pill--ink pill--wide" data-act="tg-contact">${icon('tg')}Взять номер из Telegram</button><p class="center small muted">или введите вручную</p>` : ''}
      <label class="field"><span>Телефон</span><input class="input" id="phoneInput" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="${esc(S.me.client.phone ? '+' + S.me.client.phone : '')}"></label>
      <p class="form-error" id="phoneErr" hidden></p>
      <button class="pill ${canTg ? 'pill--ghost' : 'pill--ink'} pill--wide" data-act="save-phone">Сохранить и продолжить</button>
    `);
  }

  async function savePhone(phone, btn) {
    busy(btn);
    try {
      await api('me', { phone });
      await refresh('me');
      haptic('ok');
      const then = afterPhone;
      afterPhone = null;
      closeSheet();
      if (then) then(); else { toast('Телефон сохранён', true); render(); }
    } catch (err) {
      const box = $('#phoneErr');
      if (box) { box.textContent = err.message; box.hidden = false; } else toast(err.message);
    } finally { busy(btn, false); }
  }

  function tgContact(btn) {
    busy(btn);
    TG.requestContact(async (ok, resp) => {
      busy(btn, false);
      if (!ok) return;
      const phone = resp && resp.responseUnsafe && resp.responseUnsafe.contact && resp.responseUnsafe.contact.phone_number;
      if (phone) { savePhone(phone, btn); return; }
      // Номер пришёл боту: ждём, пока он сохранится.
      for (let i = 0; i < 6; i++) {
        await sleep(1200);
        await refresh('me').catch(() => {});
        if (S.me.client.phone) { savePhone(S.me.client.phone, btn); return; }
      }
      toast('Не получилось взять номер. Введите его вручную.');
    });
  }

  // ---------- профиль ----------
  function sw(key, title, hint, on) {
    return `<label class="switch"><span class="switch__text">${title}${hint ? `<small>${hint}</small>` : ''}</span>
      <input type="checkbox" data-act="flag" data-flag="${key}" ${on ? 'checked' : ''}><span class="switch__track"></span></label>`;
  }

  function openProfile() {
    const c = S.me.client, links = S.me.links;
    const maxRow = c.max
      ? sw('notify_max', 'В MAX', 'Дублируем напоминания в MAX', c.notify_max)
      : links.max_bot ? `<div class="switch" style="cursor:default"><span class="switch__text">В MAX<small>Напоминания придут и в MAX</small></span><a class="pill pill--ghost pill--sm" href="${esc(links.max_bot)}" target="_blank" rel="noopener" data-ext>Подключить</a></div>` : '';
    openSheet(`
      <p class="eyebrow">Профиль</p>
      <h2 class="sheet__title" id="sheetTitle">${esc(c.name || 'Без имени')}</h2>
      <div class="card">
        <label class="field"><span>Имя</span><input class="input" id="pfName" autocomplete="name" value="${esc(c.name || '')}"></label>
        <label class="field"><span>Телефон</span><input class="input" id="pfPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="${esc(c.phone ? '+' + c.phone : '')}"></label>
        <p class="form-error" id="pfErr" hidden></p>
        <button class="pill pill--ink" data-act="save-profile">Сохранить</button>
      </div>
      <div class="card" style="gap:0">
        <p class="eyebrow" style="padding-bottom:4px">Напоминания</p>
        ${sw('notify_24h', 'Накануне встречи', 'Пока ещё можно отменить без списания', c.notify_24h)}
        ${sw('notify_2h', 'За 2 часа до начала', '', c.notify_2h)}
        ${sw('notify_tg', 'В Telegram', c.telegram ? '' : 'Откройте кабинет через Telegram-бота', c.notify_tg)}
        ${maxRow}
        ${sw('consent_news', 'Анонсы и новости', 'Новые гости, фильмы и события', c.consent_news)}
      </div>
      <div class="card card--flat" style="gap:4px">
        ${links.members_chat ? `<a class="link" href="${esc(links.members_chat)}" target="_blank" rel="noopener" data-ext>${icon('chat')}Чат держателей карты</a>` : ''}
        ${links.telegram_bot && !inTG ? `<a class="link" href="${esc(links.telegram_bot)}" target="_blank" rel="noopener" data-ext>${icon('tg')}Бот Пространства в Telegram</a>` : ''}
        <a class="link" href="${esc(CFG.site)}" data-ext>${icon('home')}Сайт Пространства</a>
        <a class="link" href="${esc(CFG.privacy)}" target="_blank" rel="noopener" data-ext>${icon('card')}Политика конфиденциальности</a>
      </div>
      ${!inTG && !CFG.demo ? '<button class="pill pill--quiet pill--wide" data-act="logout">Выйти из кабинета</button>' : ''}
    `);
    if (location.hash !== '#profile') history.replaceState(null, '', '#profile');
  }

  async function saveProfile(btn) {
    const name = $('#pfName').value.trim();
    const phone = $('#pfPhone').value.trim();
    const body = { name };
    if (phone) body.phone = phone;
    busy(btn);
    try {
      await api('me', body);
      await refresh('me');
      haptic('ok');
      toast('Сохранено', true);
      closeSheet();
      render();
    } catch (err) {
      const e = $('#pfErr'); e.textContent = err.message; e.hidden = false;
    } finally { busy(btn, false); }
  }

  async function saveFlag(input) {
    try {
      await api('me', { [input.dataset.flag]: input.checked });
      haptic('tick');
      await refresh('me');
    } catch (err) {
      input.checked = !input.checked;
      toast(err.message);
    }
  }

  // ---------- первый вход ----------
  function showOnboarding() {
    const c = S.me.client;
    const canTg = inTG && typeof TG.requestContact === 'function' && TG.isVersionAtLeast('6.9');
    const box = $('#onboarding');
    box.innerHTML = `
      <p class="top__logo">Пространство</p>
      <div class="stack" style="gap:10px">
        <p class="eyebrow">Добро пожаловать</p>
        <h1 class="h1">Рады знакомству, <em>${esc(firstName(c.name))}</em></h1>
        <p class="onb__lead">Пара вопросов, и можно записываться на встречи.</p>
      </div>
      <label class="field"><span>Как к вам обращаться?</span><input class="input" id="obName" autocomplete="name" value="${esc(c.name || '')}"></label>
      <div class="field">
        <span>Телефон — можно добавить и позже</span>
        ${canTg ? `<button class="pill pill--ghost pill--wide" type="button" data-act="ob-contact">${icon('tg')}Взять номер из Telegram</button>` : ''}
        <input class="input" id="obPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="${esc(c.phone ? '+' + c.phone : '')}">
        <span class="field__hint">Нужен для чека об оплате. Звоним, только если встреча переносится.</span>
      </div>
      <label class="check"><input type="checkbox" id="obPd"><span>Даю <a href="${esc(CFG.consent)}" target="_blank" rel="noopener">согласие на обработку персональных данных</a></span></label>
      <label class="check"><input type="checkbox" id="obNews"><span>Хочу получать анонсы встреч и новости Пространства</span></label>
      <p class="small muted">Как мы храним и защищаем данные — в <a href="${esc(CFG.privacy)}" target="_blank" rel="noopener">политике конфиденциальности</a>.</p>
      <p class="form-error" id="obErr" hidden></p>
      <button class="pill pill--ink pill--wide" data-act="ob-done">Продолжить</button>
    `;
    show('onboarding');
  }

  async function finishOnboarding(btn) {
    const err = $('#obErr');
    const name = $('#obName').value.trim();
    const phone = $('#obPhone').value.trim();
    err.hidden = true;
    if (!name) { err.textContent = 'Напишите, как к вам обращаться'; err.hidden = false; return; }
    if (!$('#obPd').checked) { err.textContent = 'Без согласия на обработку данных мы не сможем записывать вас на встречи'; err.hidden = false; return; }
    const body = { name, consent_pd: true, consent_news: $('#obNews').checked };
    if (phone) body.phone = phone;
    busy(btn);
    try {
      await api('me', body);
      await refresh('me');
      haptic('ok');
      // Разрешение боту писать первым: без него напоминания не дойдут.
      if (inTG && TG.initDataUnsafe && TG.initDataUnsafe.user && TG.initDataUnsafe.user.allows_write_to_pm === false && TG.isVersionAtLeast('6.9')) {
        try { TG.requestWriteAccess(); } catch (e) { /* не страшно */ }
      }
      showApp();
    } catch (e) {
      err.textContent = e.message; err.hidden = false;
    } finally { busy(btn, false); }
  }

  // ---------- вход на сайте ----------
  function showLogin(message) {
    show('login');
    const w = $('#tgWidget');
    const open = $('#openInTg');
    const tgLink = CFG.miniapp || (CFG.bot ? `https://t.me/${CFG.bot}?start=app` : '');
    if (tgLink) { open.href = tgLink; open.hidden = false; }
    if (message) w.innerHTML = `<p class="form-error">${esc(message)}</p>`;
    if (CFG.bot && !w.querySelector('script')) {
      window.PRTelegramAuth = async (user) => {
        try {
          const r = await api('auth/widget', user);
          setToken(r.token);
          await refresh('me');
          if (!S.me.client.consent_pd) showOnboarding(); else showApp();
        } catch (e) { toast(e.message); }
      };
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://telegram.org/js/telegram-widget.js?22';
      s.setAttribute('data-telegram-login', CFG.bot);
      s.setAttribute('data-size', 'large');
      s.setAttribute('data-radius', '999');
      s.setAttribute('data-lang', 'ru');
      s.setAttribute('data-request-access', 'write');
      s.setAttribute('data-onauth', 'PRTelegramAuth(user)');
      w.appendChild(s);
    } else if (!CFG.bot && !message) {
      w.innerHTML = '<p class="muted small">Вход заработает, когда в config.js будет указан Telegram-бот.</p>';
    }
  }

  function showApp() {
    show('app');
    paintMe();
    route();
    refresh('bookings').catch(() => {});
    if (S.pendingPurchase) { const id = S.pendingPurchase; S.pendingPurchase = null; checkPurchase(id); }
  }

  // ---------- команда ----------
  function renderStaff(box) {
    const st = S.staff;
    if (!st.date) st.date = ymd(new Date());
    box.innerHTML = `
      <div class="screen__head"><h1 class="h1">Команда</h1><p>Отметки гостей, клиенты и расписание.</p></div>
      <div class="seg" role="group" aria-label="Раздел">
        <button type="button" data-act="stab" data-t="day" aria-pressed="${st.tab === 'day'}">Встречи</button>
        <button type="button" data-act="stab" data-t="clients" aria-pressed="${st.tab === 'clients'}">Клиенты</button>
        <button type="button" data-act="stab" data-t="new" aria-pressed="${st.tab === 'new'}">Добавить</button>
      </div>
      <div id="staffBody" class="stack" style="gap:14px"></div>`;
    const body = $('#staffBody', box);
    if (st.tab === 'day') staffDay(body);
    else if (st.tab === 'clients') staffClients(body);
    else staffNew(body);
  }

  async function staffDay(body) {
    const d = dt(S.staff.date + ' 00:00:00');
    body.innerHTML = `<div class="datenav"><button type="button" data-act="sday" data-d="-1" aria-label="Предыдущий день">${icon('left')}</button><b>${cap(dayWord(d))}${dayWord(d) === WD_FULL[d.getDay()] ? '' : ', ' + WD[d.getDay()]}, ${longDate(d)}</b><button type="button" data-act="sday" data-d="1" aria-label="Следующий день">${icon('right')}</button></div><div class="skel" style="height:160px"></div>`;
    let data;
    try { data = await api('staff/day', null, { date: S.staff.date }); } catch (e) { body.lastElementChild.outerHTML = errorBlock(e.message); return; }
    if (S.screen !== 'staff' || S.staff.tab !== 'day' || data.date !== S.staff.date) return;
    S.staff.dayEvents = data.events;
    const list = data.events.map((e) => {
      const going = e.people.filter((p) => p.status !== 'waitlist');
      const wait = e.people.filter((p) => p.status === 'waitlist');
      const here = going.filter((p) => p.status === 'attended').length;
      const row = (p, check) => `<div class="person">
          ${check ? `<button class="person__check${p.status === 'attended' ? ' is-on' : ''}" type="button" data-act="attend" data-id="${p.booking_id}" aria-pressed="${p.status === 'attended'}" aria-label="Пришёл">${icon('check')}</button>` : '<span></span>'}
          <button class="person__name" type="button" data-act="client" data-id="${p.client_id}" style="border:0;background:none;text-align:left;padding:0;cursor:pointer">${esc(p.name)}<small>${p.paid_by === 'single' ? 'разовое' : p.paid_by === 'membership' ? 'абонемент' : ''}</small></button>
          ${p.phone ? `<a href="tel:+${esc(p.phone)}" aria-label="Позвонить">${icon('phone')}</a>` : '<span></span>'}
        </div>`;
      const d0 = dt(e.starts_at);
      return `<article class="card" style="--c:${color(e.format)}">
        <div class="card__head"><div><p class="ev__fmt">${esc(fmtName(e))}</p><p class="h3">${hm(d0)} · ${esc(e.title)}</p></div><span class="badge">${going.length}/${e.capacity}</span></div>
        <p class="small muted">Пришли: ${here} из ${going.length}${wait.length ? ` · в листе ожидания: ${wait.length}` : ''}</p>
        <div class="people">${going.map((p) => row(p, true)).join('') || '<p class="muted small">Пока никто не записан</p>'}</div>
        ${wait.length ? `<p class="eyebrow" style="padding-top:6px">Лист ожидания</p><div class="people">${wait.map((p) => row(p, false)).join('')}</div>` : ''}
        <div class="btn-row">
          <button class="pill pill--ghost pill--sm" data-act="ev-edit" data-id="${e.id}">Изменить</button>
          <button class="pill pill--danger pill--sm" data-act="ev-cancel" data-id="${e.id}" data-title="${esc(e.title)}">Отменить</button>
        </div>
      </article>`;
    }).join('');
    body.lastElementChild.outerHTML = list || '<div class="empty"><p>В этот день встреч нет.</p><button class="pill pill--ghost pill--sm" data-act="stab" data-t="new">Добавить встречу</button></div>';
  }

  let searchTimer;
  async function staffClients(body, keepInput) {
    if (!keepInput) {
      body.innerHTML = `<input class="input" id="cq" type="search" placeholder="Имя, телефон или @ник" value="${esc(S.staff.q)}" autocomplete="off"><div class="card" id="clist"><div class="skel" style="height:120px"></div></div>`;
    }
    let data;
    try { data = await api('staff/clients', null, { q: S.staff.q }); } catch (e) { $('#clist').innerHTML = esc(e.message); return; }
    const box = $('#clist');
    if (!box) return;
    box.innerHTML = data.clients.length ? `<div class="clist">${data.clients.map((c) => `<button class="crow" type="button" data-act="client" data-id="${c.id}"><span>${esc(c.name || 'Без имени')}<small>${c.phone ? '+' + esc(c.phone) : ''}${c.tg_username ? ' · @' + esc(c.tg_username) : ''}</small></span>${c.membership ? `<span class="badge badge--plan">${esc(c.membership)}</span>` : '<span class="muted small">без абонемента</span>'}</button>`).join('')}</div>` : '<p class="muted">Никого не нашли</p>';
  }

  async function openClient(id) {
    openSheet('<div class="skel" style="height:280px"></div>');
    let d;
    try { d = await api('staff/client', null, { id }); } catch (e) { $('#sheetBody').innerHTML = `<p>${esc(e.message)}</p>`; return; }
    const c = d.client;
    const sell = S.staff.sell;
    const months = S.me.month;
    if (!sell.month) sell.month = months.current;
    const plans = S.plans ? S.plans.plans : [{ key: 'club1', name: 'Один клуб', price: 3500 }, { key: 'clubs', name: 'Клубы и гости', price: 6500 }, { key: 'all', name: 'Всё Пространство', price: 12000 }];
    const bLabel = { booked: 'записан', attended: 'был', noshow: 'не пришёл', late_cancel: 'поздняя отмена', cancelled: 'отменил', waitlist: 'ожидание', pending_payment: 'ждёт оплаты' };
    const m = d.memberships[0];
    $('#sheetBody').innerHTML = `
      <p class="eyebrow">Клиент</p>
      <h2 class="sheet__title" id="sheetTitle">${esc(c.name || 'Без имени')}</h2>
      <div class="card">
        <dl class="kv">
          <dt>Телефон</dt><dd>${c.phone ? `<a href="tel:+${esc(c.phone)}">+${esc(c.phone)}</a>` : '—'}</dd>
          <dt>Telegram</dt><dd>${c.tg_username ? `<a href="https://t.me/${esc(c.tg_username)}" target="_blank" rel="noopener">@${esc(c.tg_username)}</a>` : c.telegram ? 'есть' : '—'}</dd>
          <dt>С нами с</dt><dd>${esc(longDate(dt(c.created_at)))} ${dt(c.created_at).getFullYear()}</dd>
          <dt>Абонемент</dt><dd>${m ? `${esc(m.name)}, ${esc(m.month_label)}` : 'нет'}</dd>
          ${d.achievements ? `<dt>Достижения</dt><dd>${d.achievements.done} из ${d.achievements.total}</dd>` : ''}
        </dl>
        ${m ? `<ul class="mini">${m.items.filter((i) => !i.unlimited).map((i) => `<li><span>${esc(i.label)}</span><span>использовано ${i.used} из ${i.limit}</span></li>`).join('')}</ul>` : ''}
      </div>
      <div class="card">
        <p class="eyebrow">Продать абонемент на месте</p>
        <div class="seg" role="group">${plans.map((p) => `<button type="button" data-act="sell-plan" data-v="${p.key}" aria-pressed="${sell.plan === p.key}">${esc(p.name)}<small>${rub(p.price)}</small></button>`).join('')}</div>
        ${sell.plan === 'club1' ? `<div class="seg" role="group"><button type="button" data-act="sell-club" data-v="lit" aria-pressed="${sell.club === 'lit'}">Литературный</button><button type="button" data-act="sell-club" data-v="script" aria-pressed="${sell.club === 'script'}">Сценарный</button></div>` : ''}
        <div class="seg" role="group"><button type="button" data-act="sell-month" data-v="${months.current}" aria-pressed="${sell.month === months.current}">${cap(months.current_label)}</button><button type="button" data-act="sell-month" data-v="${months.next}" aria-pressed="${sell.month === months.next}">${cap(months.next_label)}</button></div>
        <button class="pill pill--ink" data-act="sell" data-id="${c.id}">Оплачено на месте — оформить</button>
      </div>
      <div class="card">
        <label class="field"><span>Заметка (видит только команда)</span><textarea class="textarea" id="cNote">${esc(c.note || '')}</textarea></label>
        <button class="pill pill--ghost pill--sm" data-act="note" data-id="${c.id}">Сохранить заметку</button>
      </div>
      ${d.bookings.length ? `<div class="card"><p class="eyebrow">Последние записи</p><ul class="mini">${d.bookings.map((b) => `<li><span>${esc(b.title)} · ${longDate(dt(b.starts_at))}</span><span>${bLabel[b.status] || b.status}</span></li>`).join('')}</ul></div>` : ''}
      ${d.purchases.length ? `<div class="card"><p class="eyebrow">Оплаты</p><ul class="mini">${d.purchases.map((p) => `<li><span>${esc(p.description)}</span><span>${rub(p.amount)}${p.status === 'paid' ? '' : ' · ' + (p.status === 'pending' ? 'не оплачено' : 'отменено')}</span></li>`).join('')}</ul></div>` : ''}
    `;
    S.staff.clientId = c.id;
  }

  // Поля встречи. p — приставка id: nf (новая) или ef (правка).
  function eventFields(p, e) {
    const d = e ? dt(e.starts_at) : null;
    const v = (x) => esc(x == null ? '' : x);
    const durs = [60, 90, 105, 120, 150, 180];
    if (e && !durs.includes(e.duration_min)) durs.push(e.duration_min);
    const price = `<label class="field"><span>Цена разово, ₽</span><input class="input" id="${p}Price" type="number" inputmode="numeric" placeholder="обычная: 2 500" value="${e && e.custom_price != null ? e.custom_price : ''}"></label>`;
    return `
      <label class="field"><span>Формат</span><select class="select" id="${p}Format">${Object.entries(FORMAT).map(([k, f]) => `<option value="${k}"${e && e.format === k ? ' selected' : ''}>${f.name}</option>`).join('')}</select></label>
      <label class="field"><span>Название или тема</span><input class="input" id="${p}Title" value="${v(e && e.title)}" placeholder="Например: «Лавр» Водолазкина"></label>
      <label class="field"><span>Ведущий или гость</span><input class="input" id="${p}Host" value="${v(e && e.host)}" placeholder="Необязательно"></label>
      <div class="field__row">
        <label class="field"><span>Дата</span><input class="input" id="${p}Date" type="date" value="${e ? ymd(d) : ymd(addDays(new Date(), 1))}"></label>
        <label class="field"><span>Начало</span><input class="input" id="${p}Time" type="time" value="${e ? hm(d) : '19:30'}"></label>
      </div>
      <div class="field__row">
        <label class="field"><span>Длительность</span><select class="select" id="${p}Dur">${durs.map((m) => `<option value="${m}"${m === (e ? e.duration_min : 120) ? ' selected' : ''}>${dur(m)}</option>`).join('')}</select></label>
        <label class="field"><span>Мест</span><input class="input" id="${p}Cap" type="number" inputmode="numeric" min="1" value="${e ? e.capacity : 40}"></label>
      </div>
      ${p === 'nf' ? `<div class="field__row">
        <label class="field"><span>Повторять</span><select class="select" id="nfRepeat"><option value="1">Один раз</option><option value="2">2 недели</option><option value="4">4 недели</option><option value="8">8 недель</option><option value="12">12 недель</option><option value="26">Полгода</option></select></label>
        ${price}</div>` : price}
      <label class="check"><input type="checkbox" id="${p}Incl"${!e || e.included ? ' checked' : ''}><span>Входит в абонементы</span></label>
      <label class="field"><span>Описание</span><textarea class="textarea" id="${p}Desc" placeholder="Пара предложений о встрече: их увидят гости">${v(e && e.description)}</textarea></label>`;
  }

  function readEventFields(p) {
    const v = (id) => $('#' + p + id).value.trim();
    return {
      format: v('Format'), title: v('Title') || FORMAT[v('Format')].name, host: v('Host'),
      date: v('Date'), time: v('Time'), duration_min: Number(v('Dur')), capacity: Number(v('Cap')) || 40,
      price: v('Price'), included: $('#' + p + 'Incl').checked, description: v('Desc'),
    };
  }

  function staffNew(body) {
    body.innerHTML = `
      <div class="notice">${icon('cal')}<span>Регулярный клуб: выберите «Повторять», и встречи появятся на несколько недель вперёд. Тему каждой встречи потом можно поменять кнопкой «Изменить» во вкладке «Встречи».</span></div>
      <div class="card">
        ${eventFields('nf', null)}
        <p class="form-error" id="nfErr" hidden></p>
        <button class="pill pill--ink pill--wide" data-act="nf-save">Добавить в расписание</button>
      </div>`;
  }

  async function saveNewEvent(btn) {
    const payload = Object.assign(readEventFields('nf'), { repeat_weeks: Number($('#nfRepeat').value) });
    busy(btn);
    try {
      const r = await api('staff/event', payload);
      S.events = null;
      haptic('ok');
      toast(r.ids.length > 1 ? `Добавлено встреч: ${r.ids.length}` : 'Встреча добавлена', true);
      S.staff.tab = 'day';
      S.staff.date = payload.date;
      render();
    } catch (e) {
      const err = $('#nfErr'); err.textContent = e.message; err.hidden = false;
    } finally { busy(btn, false); }
  }

  function openEditEvent(id) {
    const e = (S.staff.dayEvents || []).find((x) => x.id === id);
    if (!e) return;
    const d = dt(e.starts_at);
    S.staff.apply = 'one';
    S.staff.editing = e;
    openSheet(`
      <p class="eyebrow">Изменить встречу</p>
      <h2 class="sheet__title" id="sheetTitle">${esc(e.title)}</h2>
      <div class="card">
        ${eventFields('ef', e)}
        <div class="field"><span>Что изменить</span>
          <div class="seg" role="group" aria-label="Что изменить">
            <button type="button" data-act="ef-apply" data-v="one" aria-pressed="true">Только эту</button>
            <button type="button" data-act="ef-apply" data-v="series" aria-pressed="false">Эту и следующие</button>
          </div>
          <span class="field__hint" id="efHint">Поменяется только встреча ${longDate(d)}.</span>
        </div>
        <p class="form-error" id="efErr" hidden></p>
        <button class="pill pill--ink pill--wide" data-act="ef-save" data-id="${e.id}">Сохранить</button>
      </div>
      <p class="small muted">Если поменять дату или время, записанным гостям придёт сообщение о переносе.</p>
    `);
  }

  async function saveEditEvent(btn) {
    const e = S.staff.editing;
    const payload = Object.assign(readEventFields('ef'), { event_id: e.id, apply: S.staff.apply });
    busy(btn);
    try {
      const r = await api('staff/event_update', payload);
      S.events = null;
      haptic('ok');
      closeSheet();
      toast(r.moved ? `Сохранено. Перенесено встреч: ${r.moved}, гостям отправлены сообщения` : r.count > 1 ? `Сохранено для ${r.count} встреч` : 'Сохранено', true, 4500);
      if (payload.date !== ymd(dt(e.starts_at))) S.staff.date = payload.date;
      render('staff');
    } catch (err) {
      const box = $('#efErr'); box.textContent = err.message; box.hidden = false;
    } finally { busy(btn, false); }
  }

  const RENDER = { home: renderHome, schedule: renderSchedule, bookings: renderBookings, plans: renderPlans, staff: renderStaff };

  // ---------- действия по нажатию ----------
  const ACTIONS = {
    retry: () => { S.me && render(); },
    event: (el) => { haptic(); openEvent(Number(el.dataset.id)); },
    book: (el) => { haptic('medium'); book(Number(el.dataset.id), el); },
    cancel: (el) => askCancel(Number(el.dataset.id)),
    'cancel-yes': (el) => cancelBooking(Number(el.dataset.id), el),
    ics: (el) => addToCalendar(el.dataset.id ? Number(el.dataset.id) : 0),
    filter: (el) => { haptic('tick'); S.filter = el.dataset.f; S.dayAuto = true; render('schedule'); },
    day: (el) => { haptic('tick'); S.day = el.dataset.day; S.dayAuto = false; render('schedule'); },
    'plan-month': (el) => { haptic('tick'); S.planMonth = el.dataset.m; if (S.screen !== 'plans') location.hash = '#plans'; else render('plans'); },
    'plans-next': () => { S.planMonth = S.me.month.next; },
    'to-plans': () => { closeSheet(); },
    club: (el) => { haptic('tick'); S.club = el.dataset.club; render('plans'); },
    buy: (el) => { haptic('medium'); buy(el.dataset.plan, el); },
    phone: () => askPhone(null),
    'save-phone': (el) => savePhone($('#phoneInput').value.trim(), el),
    'tg-contact': (el) => tgContact(el),
    'save-profile': (el) => saveProfile(el),
    logout: async () => { try { await api('auth/logout', {}); } catch (e) { /* всё равно выходим */ } setToken(null); closeSheet(); S.me = S.events = S.bookings = null; showLogin(); },
    'ob-done': (el) => finishOnboarding(el),
    'ob-contact': (el) => {
      busy(el);
      TG.requestContact(async (ok, resp) => {
        busy(el, false);
        const phone = ok && resp && resp.responseUnsafe && resp.responseUnsafe.contact && resp.responseUnsafe.contact.phone_number;
        if (phone) { $('#obPhone').value = '+' + String(phone).replace(/^\+/, ''); haptic('ok'); }
        else if (ok) toast('Номер отправлен боту. Если поле пустое, введите номер вручную.');
      });
    },
    stab: (el) => { haptic('tick'); S.staff.tab = el.dataset.t; if (S.screen !== 'staff') location.hash = '#staff'; else render('staff'); },
    sday: (el) => { haptic('tick'); S.staff.date = ymd(addDays(dt(S.staff.date + ' 00:00:00'), Number(el.dataset.d))); render('staff'); },
    attend: async (el) => {
      const on = !el.classList.contains('is-on');
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', on);
      haptic('tick');
      try { await api('staff/attend', { booking_id: Number(el.dataset.id), attended: on }); } catch (e) { el.classList.toggle('is-on', !on); toast(e.message); }
    },
    'ev-cancel': (el) => {
      openSheet(`<p class="eyebrow">Отмена встречи</p><h2 class="sheet__title" id="sheetTitle">Отменить «${esc(el.dataset.title)}»?</h2>
        <p>Всем записанным придёт сообщение. Посещения по абонементу вернутся, а тем, кто платил разово, нужно будет вернуть деньги: они отмечены в базе.</p>
        <div class="stack"><button class="pill pill--danger pill--wide" data-act="ev-cancel-yes" data-id="${el.dataset.id}">Да, отменить встречу</button><button class="pill pill--quiet pill--wide" data-close>Не отменять</button></div>`);
    },
    'ev-cancel-yes': async (el) => {
      busy(el);
      try { await api('staff/event_cancel', { event_id: Number(el.dataset.id) }); S.events = null; closeSheet(); toast('Встреча отменена, гостям отправлены сообщения', true); render('staff'); }
      catch (e) { toast(e.message); } finally { busy(el, false); }
    },
    client: (el) => openClient(Number(el.dataset.id)),
    'sell-plan': (el) => { S.staff.sell.plan = el.dataset.v; openClient(S.staff.clientId); },
    'sell-club': (el) => { S.staff.sell.club = el.dataset.v; openClient(S.staff.clientId); },
    'sell-month': (el) => { S.staff.sell.month = el.dataset.v; openClient(S.staff.clientId); },
    sell: async (el) => {
      const s = S.staff.sell;
      busy(el);
      try {
        await api('staff/sell', { client_id: Number(el.dataset.id), plan: s.plan, month: s.month, club: s.club });
        haptic('ok');
        toast('Абонемент оформлен', true);
        openClient(Number(el.dataset.id));
      } catch (e) { toast(e.message); } finally { busy(el, false); }
    },
    note: async (el) => {
      busy(el);
      try { await api('staff/note', { client_id: Number(el.dataset.id), note: $('#cNote').value }); toast('Заметка сохранена', true); }
      catch (e) { toast(e.message); } finally { busy(el, false); }
    },
    'nf-save': (el) => saveNewEvent(el),
    'ev-edit': (el) => openEditEvent(Number(el.dataset.id)),
    'ef-apply': (el) => {
      S.staff.apply = el.dataset.v;
      $$('[data-act="ef-apply"]').forEach((b) => b.setAttribute('aria-pressed', b === el));
      const d = dt(S.staff.editing.starts_at);
      $('#efHint').textContent = el.dataset.v === 'series'
        ? `Поменяются все следующие встречи «${fmtName(S.staff.editing)}» по ${WD_DAT[d.getDay()]} в ${hm(d)}: время и то, что вы исправили. Темы других встреч останутся прежними.`
        : `Поменяется только встреча ${longDate(d)}.`;
    },
    'ef-save': (el) => saveEditEvent(el),
    ach: () => openAchievements(),
  };

  document.addEventListener('click', (ev) => {
    const closer = ev.target.closest('[data-close]');
    if (closer) { ev.preventDefault(); closeSheet(); return; }
    const ext = ev.target.closest('a[data-ext]');
    if (ext && inTG && /^https?:/.test(ext.href)) {
      ev.preventDefault();
      if (/^https:\/\/t\.me\//.test(ext.href)) TG.openTelegramLink(ext.href); else TG.openLink(ext.href);
      return;
    }
    const el = ev.target.closest('[data-act]');
    if (el && el.tagName !== 'INPUT' && ACTIONS[el.dataset.act]) {
      if (el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href').startsWith('#')) {
        ACTIONS[el.dataset.act](el);
        if (sheetOpen()) closeSheet();
        return;
      }
      ev.preventDefault();
      ACTIONS[el.dataset.act](el);
      return;
    }
    const a = ev.target.closest('a[href^="#"]');
    if (a && sheetOpen()) closeSheet();
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.matches('input[data-act="flag"]')) saveFlag(el);
  });

  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'cq') {
      S.staff.q = ev.target.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => staffClients($('#staffBody'), true), 250);
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && sheetOpen()) closeSheet();
    if (ev.key === 'Enter' && ev.target.id === 'phoneInput') { ev.preventDefault(); savePhone(ev.target.value.trim(), $('[data-act="save-phone"]')); }
  });

  $('#meBtn').addEventListener('click', () => { haptic(); openProfile(); });
  window.addEventListener('hashchange', () => { if (!$('#app').hidden) route(); });

  // Вернулись в приложение (например, после оплаты в другой вкладке) — обновляем данные.
  let lastRefresh = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.me && !$('#app').hidden && Date.now() - lastRefresh > 30000) {
      lastRefresh = Date.now();
      reloadAll().catch(() => {});
    }
  });

  // ---------- запуск ----------
  async function boot() {
    if (inTG) {
      try {
        TG.ready();
        TG.expand();
        TG.setHeaderColor('#F6F3EE');
        TG.setBackgroundColor('#F6F3EE');
        if (TG.isVersionAtLeast('7.7')) TG.disableVerticalSwipes();
      } catch (e) { /* старый клиент Telegram */ }
      TG.BackButton.onClick(() => closeSheet());
      document.documentElement.classList.add('in-tg');
    }

    const params = new URLSearchParams(location.search);
    const startParam = inTG && TG.initDataUnsafe ? TG.initDataUnsafe.start_param : '';
    let go = params.get('go') || startParam || '';
    if (!go && location.hash && !/^#tgWebApp/.test(location.hash)) go = location.hash.slice(1);
    S.pendingPurchase = Number(params.get('purchase')) || null;
    history.replaceState(null, '', location.pathname + '#' + (go || 'home'));

    try {
      if (CFG.demo) {
        window.PRDemo.init({
          openSheet, closeSheet, checkPurchase, toast,
          reload: async () => {
            await refresh('me');
            if (S.screen === 'staff' && !isStaff()) location.hash = '#home'; else render();
          },
        });
        setToken('demo');
      } else if (inTG) {
        const r = await api('auth/telegram', { initData: TG.initData });
        setToken(r.token);
      } else {
        S.token = store.get('pr_token');
      }
      if (!S.token) { showLogin(); return; }
      await refresh('me');
    } catch (err) {
      if (err.status === 401 && !inTG) { setToken(null); showLogin(); return; }
      $('#boot').innerHTML = `<p class="boot__word">Пространство</p><p class="muted center" style="max-width:20em">${esc(err.message)}</p><button class="pill pill--ink" onclick="location.reload()">Обновить</button>`;
      return;
    }
    refresh('plans').catch(() => {});
    if (!S.me.client.consent_pd) showOnboarding(); else showApp();
  }

  // Демо-режим: если demo.js не подключён на странице, подгружаем его сами.
  if (CFG.demo && !window.PRDemo) {
    const s = document.createElement('script');
    s.src = 'demo.js';
    s.onload = boot;
    document.head.appendChild(s);
  } else {
    boot();
  }
})();
