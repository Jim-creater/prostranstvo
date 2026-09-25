// Демо-режим кабинета: те же правила, что на сервере, но данные живут только в браузере.
// Включается в config.js (demo: true). Нужен, чтобы показать кабинет до подключения сервера.
window.PRDemo = (() => {
  'use strict';

  const FORMATS = {
    lit: { name: 'Литературный клуб', group: 'club' },
    script: { name: 'Сценарный клуб', group: 'club' },
    guest: { name: 'Специальный гость', group: 'weekend' },
    film: { name: 'Кино', group: 'weekend' },
    costume: { name: 'История костюма', group: 'costume' },
    art: { name: 'Рисунок и история искусств', group: 'art' },
  };
  const PLANS = {
    club1: { name: 'Один клуб', price: 3500, clubs: 1, weekend: 2, costume: 0, art: 0 },
    clubs: { name: 'Клубы и гости', price: 6500, clubs: 2, weekend: 4, costume: 0, art: 0 },
    all: { name: 'Всё Пространство', price: 12000, clubs: 2, weekend: 6, costume: 2, art: 4 },
  };
  const GROUP_LABELS = { weekend: 'Выходные: гости и кино', costume: 'История костюма', art: 'Рисунок' };
  const COUNTED = ['booked', 'attended', 'noshow', 'late_cancel'];
  const SINGLE = 2500;
  const CAPACITY = 40;
  const MON_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const MON_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  const pad = (n) => String(n).padStart(2, '0');
  const toS = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  const parse = (s) => { const [a, b = '00:00'] = s.split(' '); const [y, m, d] = a.split('-').map(Number); const [h, mi] = b.split(':').map(Number); return new Date(y, m - 1, d, h, mi); };
  const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const nowS = () => toS(new Date());
  const curMonth = () => ym(new Date());
  const nextMonth = () => { const d = new Date(); return ym(new Date(d.getFullYear(), d.getMonth() + 1, 1)); };
  const monthLabel = (k) => MON_NOM[Number(k.slice(5, 7)) - 1];
  const lastDay = (k) => { const [y, m] = k.split('-').map(Number); return new Date(y, m, 0); };
  const human = (d, withTime = true) => `${d.getDate()} ${MON_GEN[d.getMonth()]}` + (withTime ? `, ${pad(d.getHours())}:${pad(d.getMinutes())}` : '');
  const clone = (x) => JSON.parse(JSON.stringify(x));
  function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }

  // ---------- данные для показа ----------
  let seq = 100;
  const db = { clients: [], events: [], bookings: [], memberships: [], purchases: [] };
  const ME = 1;

  const NAMES = ['Мария Кузнецова', 'Екатерина Орлова', 'Дмитрий Волков', 'Ольга Лебедева', 'Сергей Морозов', 'Наталья Соколова', 'Алексей Павлов', 'Ирина Фёдорова', 'Татьяна Николаева', 'Михаил Егоров', 'Юлия Семёнова', 'Андрей Васильев', 'Елена Зайцева', 'Павел Голубев', 'Светлана Виноградова', 'Артём Богданов', 'Ксения Воробьёва', 'Никита Тарасов', 'Анастасия Белова', 'Григорий Комаров', 'Вера Киселёва', 'Илья Макаров', 'Дарья Андреева', 'Максим Ковалёв', 'Полина Ильина', 'Роман Гусев', 'Алина Титова', 'Виктор Кудрявцев', 'Софья Баранова', 'Олег Куликов', 'Людмила Алексеева', 'Степан Степанов', 'Варвара Яковлева', 'Константин Сорокин', 'Евгения Романова', 'Фёдор Захаров', 'Александра Борисова', 'Тимофей Королёв', 'Надежда Герасимова', 'Игорь Пономарёв', 'Валерия Григорьева', 'Борис Лазарев', 'Маргарита Медведева', 'Кирилл Ершов', 'Лариса Никитина'];

  function seed() {
    db.clients.push({ id: ME, name: 'Анна Смирнова', phone: '79001234567', telegram: true, tg_username: 'anna_reads', max: false, is_staff: true, consent_pd: true, consent_news: true, notify_tg: true, notify_max: false, notify_24h: true, notify_2h: true, note: '', created_at: '2026-09-02 12:00:00' });
    NAMES.forEach((name, i) => db.clients.push({ id: i + 2, name, phone: '7916' + String(1000000 + i * 7919).slice(-7), telegram: true, tg_username: i % 3 ? null : 'guest' + (i + 2), max: false, is_staff: false, consent_pd: true, consent_news: i % 2 === 0, notify_tg: true, notify_max: false, notify_24h: true, notify_2h: true, note: '', created_at: '2026-08-' + pad(1 + (i % 28)) + ' 18:00:00' }));

    // Темы встреч — те же, что в афише на сайте.
    const topics = {
      '09-25 script': 'Первая сцена: как зацепить зрителя',
      '09-26 lit': 'Читаем вслух: Чехов, «Дама с собачкой»',
      '09-26 film': 'Кино: «Июльский дождь», Марлен Хуциев',
      '09-27 art': 'Натюрморт: свет и тень',
      '09-28 lit': '«Лавр» Евгения Водолазкина',
      '09-28 script': 'Диалоги без лишних слов',
      '10-01 costume': 'Костюм 1920-х: свобода и новый силуэт',
      '10-04 art': 'Импрессионисты: как нарисовать воздух',
      '10-15 costume': 'Цвет и фактура: собираем свою палитру',
    };
    const template = [
      [1, '18:00', 'lit', 120], [1, '20:15', 'script', 105],
      [3, '18:00', 'lit', 120], [3, '20:15', 'script', 105],
      [4, '12:00', 'costume', 120, [1, 3]],
      [5, '19:30', 'script', 120],
      [6, '12:00', 'lit', 120], [6, '16:00', 'guest', 120], [6, '19:30', 'film', 150],
      [0, '12:00', 'art', 120], [0, '16:00', 'guest', 120], [0, '19:30', 'film', 150],
    ];
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 10);
    for (let i = 0; i < 56; i++) {
      const day = new Date(start); day.setDate(start.getDate() + i);
      const week = Math.floor((day.getDate() - 1) / 7) + 1;
      template.forEach(([wd, time, format, dur, weeks]) => {
        if (day.getDay() !== wd || (weeks && !weeks.includes(week))) return;
        const [h, m] = time.split(':').map(Number);
        const d = new Date(day); d.setHours(h, m);
        const key = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${format}`;
        let title = topics[key] || FORMATS[format].name;
        if (format === 'guest') title = 'Встреча со специальным гостем';
        db.events.push({ id: seq++, format, title, host: '', description: '', starts_at: toS(d), duration_min: dur, capacity: CAPACITY, price: null, included: 1, cancelled: 0 });
      });
    }
    // 24 октября — Павел Глоба.
    const globa = db.events.find((e) => e.format === 'guest' && e.starts_at.slice(5, 10) === '10-24');
    if (globa) Object.assign(globa, { title: 'Павел Глоба', host: 'Специальный гость', description: 'Большая встреча со специальным гостем Пространства. Приходите заранее: зал будет полным.' });

    // Абонемент Анны на текущий месяц.
    const m = { id: seq++, client_id: ME, plan: 'clubs', month: curMonth(), club: null, status: 'active', price: 6500 };
    db.memberships.push(m);
    db.purchases.push({ id: seq++, client_id: ME, kind: 'membership', amount: 6500, status: 'paid', provider: 'yookassa', description: 'Абонемент «Клубы и гости» на ' + monthLabel(curMonth()), paid_at: '2026-09-02 12:10:00' });
    // Абонементы у части гостей.
    db.clients.slice(1).forEach((c, i) => {
      if (i % 3 === 2) return;
      const plan = ['club1', 'clubs', 'all'][i % 3];
      db.memberships.push({ id: seq++, client_id: c.id, plan, month: curMonth(), club: plan === 'club1' ? (i % 2 ? 'lit' : 'script') : null, status: 'active', price: PLANS[plan].price });
    });

    const now = new Date();
    const future = db.events.filter((e) => parse(e.starts_at) > now);
    const past = db.events.filter((e) => parse(e.starts_at) < now);
    const add = (cid, e, status, by = 'membership') => {
      const mem = activeMembership(cid, e.starts_at.slice(0, 7));
      db.bookings.push({ id: seq++, client_id: cid, event_id: e.id, status, paid_by: by, membership_id: by === 'membership' && mem ? mem.id : null, created_at: nowS(), updated_at: nowS() });
    };
    // Анна: была на встрече с гостем и в клубе, записана на кино и на клуб.
    const pastGuest = [...past].reverse().find((e) => e.format === 'guest' && e.starts_at.slice(0, 7) === curMonth());
    if (pastGuest) add(ME, pastGuest, 'attended');
    const pastLit = [...past].reverse().find((e) => e.format === 'lit');
    if (pastLit) add(ME, pastLit, 'attended');
    const film = future.find((e) => e.format === 'film');
    if (film) add(ME, film, 'booked');
    const lit = future.find((e) => e.format === 'lit' && parse(e.starts_at) - now > 30 * 3600e3);
    if (lit) add(ME, lit, 'booked');

    // Гости: где-то людно, где-то почти всё занято.
    future.forEach((e, i) => {
      let n = [12, 18, 7, 25, 15, 9, 21][i % 7];
      if (e === film) n = 37;
      if (globa && e.id === globa.id) n = CAPACITY;
      for (let k = 0; k < n; k++) {
        const cid = 2 + ((k * 7 + i * 3) % NAMES.length);
        if (!db.bookings.some((b) => b.client_id === cid && b.event_id === e.id)) add(cid, e, 'booked', coverage(cid, e).type === 'membership' ? 'membership' : 'single');
      }
    });
    past.slice(-8).forEach((e, i) => {
      for (let k = 0; k < 10 + (i % 5); k++) {
        const cid = 2 + ((k * 5 + i) % NAMES.length);
        if (!db.bookings.some((b) => b.client_id === cid && b.event_id === e.id)) add(cid, e, k % 6 ? 'attended' : 'noshow', coverage(cid, e).type === 'membership' ? 'membership' : 'single');
      }
    });
  }

  // ---------- те же правила, что в api/lib/rules.php ----------
  function activeMembership(cid, month) {
    return db.memberships.filter((m) => m.client_id === cid && m.month === month && m.status === 'active').pop() || null;
  }
  function eventOf(id) { return db.events.find((e) => e.id === id); }
  function usedCount(mid, group, exclude = 0) {
    return db.bookings.filter((b) => b.membership_id === mid && b.paid_by === 'membership' && b.id !== exclude && COUNTED.includes(b.status) && FORMATS[eventOf(b.event_id).format].group === group).length;
  }
  function planClubs(m) { return PLANS[m.plan].clubs >= 2 ? ['lit', 'script'] : [m.club]; }
  function coverage(cid, e, exclude = 0) {
    const price = e.price || SINGLE;
    const single = { type: 'single', price, note: 'Разовое посещение — ' + price.toLocaleString('ru-RU') + ' ₽' };
    if (!e.included) return { ...single, reason: 'Встреча не входит в абонементы' };
    const m = activeMembership(cid, e.starts_at.slice(0, 7));
    if (!m) return single;
    const group = FORMATS[e.format].group;
    if (group === 'club') {
      return planClubs(m).includes(e.format)
        ? { type: 'membership', membership_id: m.id, note: 'Входит в ваш абонемент' }
        : { ...single, reason: 'Этот клуб не входит в ваш абонемент' };
    }
    const limit = PLANS[m.plan][group];
    if (!limit) return { ...single, reason: 'Не входит в ваш абонемент' };
    const used = usedCount(m.id, group, exclude);
    if (used < limit) return { type: 'membership', membership_id: m.id, note: `По абонементу · останется ${limit - used - 1} из ${limit}` };
    return { ...single, reason: `Посещения по абонементу закончились: ${limit} из ${limit}` };
  }
  function seatsTaken(eid) {
    return db.bookings.filter((b) => b.event_id === eid && ['booked', 'attended', 'noshow', 'pending_payment'].includes(b.status)).length;
  }
  function usage(m) {
    const plan = PLANS[m.plan];
    const clubs = planClubs(m);
    const items = [{ label: clubs.length === 2 ? 'Литературный и сценарный клубы' : FORMATS[clubs[0]].name, unlimited: true }];
    ['weekend', 'costume', 'art'].forEach((g) => { if (plan[g]) items.push({ label: GROUP_LABELS[g], used: usedCount(m.id, g), limit: plan[g] }); });
    return { id: m.id, plan: m.plan, name: plan.name, month: m.month, month_label: monthLabel(m.month), ends: human(lastDay(m.month), false), club: m.club, items };
  }
  function pub(e, cid) {
    const start = parse(e.starts_at);
    const freeUntil = new Date(start.getTime() - 24 * 3600e3);
    const out = {
      id: e.id, format: e.format, format_name: FORMATS[e.format].name, title: e.title, host: e.host, description: e.description,
      starts_at: e.starts_at, duration_min: e.duration_min, capacity: e.capacity, left: Math.max(0, e.capacity - seatsTaken(e.id)),
      included: !!e.included, price: e.price || SINGLE, free_cancel_until: human(freeUntil), free_cancel: new Date() <= freeUntil,
    };
    if (cid) {
      const b = db.bookings.find((x) => x.client_id === cid && x.event_id === e.id);
      out.my_status = b ? b.status : null;
      out.booking_id = b ? b.id : null;
      out.paid_by = b ? b.paid_by : null;
      out.cover = ['booked', 'attended'].includes(out.my_status) ? null : coverage(cid, e);
    }
    return out;
  }
  const me = () => db.clients.find((c) => c.id === ME);

  // ---------- маршруты API ----------
  const routes = {
    'auth/telegram': () => ({ token: 'demo', client: me() }),
    'auth/widget': () => ({ token: 'demo', client: me() }),
    'auth/logout': () => ({ ok: true }),
    me(body) {
      const c = me();
      if (body) {
        if ('name' in body) { if (!String(body.name).trim()) fail('Укажите имя'); c.name = String(body.name).trim(); }
        if ('phone' in body) {
          let d = String(body.phone).replace(/\D+/g, '');
          if (d.length === 11 && (d[0] === '8' || d[0] === '7')) d = '7' + d.slice(1);
          else if (d.length === 10 && d[0] === '9') d = '7' + d;
          else fail('Проверьте номер телефона: нужен российский номер, например +7 900 000-00-00');
          c.phone = d;
        }
        if (body.consent_pd) c.consent_pd = true;
        ['consent_news', 'notify_tg', 'notify_max', 'notify_24h', 'notify_2h'].forEach((k) => { if (k in body) c[k] = !!body[k]; });
      }
      const cur = activeMembership(ME, curMonth());
      const nxt = activeMembership(ME, nextMonth());
      const since = toS(new Date(Date.now() - 3 * 3600e3));
      const nb = db.bookings
        .filter((b) => b.client_id === ME && ['booked', 'waitlist', 'pending_payment'].includes(b.status))
        .map((b) => eventOf(b.event_id)).filter((e) => e.starts_at >= since && !e.cancelled)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
      return {
        client: c,
        membership: cur ? usage(cur) : null,
        next_membership: nxt ? usage(nxt) : null,
        month: { current: curMonth(), current_label: monthLabel(curMonth()), next: nextMonth(), next_label: monthLabel(nextMonth()), ends: human(lastDay(curMonth()), false) },
        next_booking: nb ? pub(nb, ME) : null,
        links: { telegram_bot: 'https://t.me/', max_bot: null, members_chat: cur ? 'https://t.me/' : null },
      };
    },
    events(_, q) {
      const from = (q.from || '') + ' 00:00:00';
      const to = (q.to || '9999') + ' 23:59:59';
      const since = toS(new Date(Date.now() - 3600e3));
      return { events: db.events.filter((e) => !e.cancelled && e.starts_at >= from && e.starts_at <= to && e.starts_at >= since).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map((e) => pub(e, ME)) };
    },
    book(body) {
      const e = db.events.find((x) => x.id === body.event_id && !x.cancelled);
      if (!e) fail('Встреча не найдена');
      if (parse(e.starts_at) < new Date()) fail('Эта встреча уже началась');
      let b = db.bookings.find((x) => x.client_id === ME && x.event_id === e.id);
      if (b && ['booked', 'attended'].includes(b.status)) return { status: b.status, event: pub(e, ME) };
      const save = (data) => {
        if (b && b.status === 'pending_payment' && b.purchase_id) { const p = db.purchases.find((x) => x.id === b.purchase_id); if (p && p.status === 'pending') p.status = 'cancelled'; }
        if (b) Object.assign(b, data, { updated_at: nowS() });
        else { b = { id: seq++, client_id: ME, event_id: e.id, created_at: nowS(), updated_at: nowS(), ...data }; db.bookings.push(b); }
      };
      const cov = coverage(ME, e, b ? b.id : 0);
      const taken = seatsTaken(e.id) - (b && b.status === 'pending_payment' ? 1 : 0);
      if (taken >= e.capacity) { save({ status: 'waitlist', paid_by: null, membership_id: null, purchase_id: null }); return { status: 'waitlist', event: pub(e, ME) }; }
      if (cov.type === 'membership') { save({ status: 'booked', paid_by: 'membership', membership_id: cov.membership_id, purchase_id: null }); return { status: 'booked', event: pub(e, ME) }; }
      if (!me().phone) fail('Укажите телефон в профиле: на него придёт чек', 409);
      const pid = seq++;
      db.purchases.push({ id: pid, client_id: ME, kind: 'single', amount: cov.price, status: 'pending', provider: 'demo', description: 'Посещение: ' + e.title + ', ' + human(parse(e.starts_at)), paid_at: null });
      save({ status: 'pending_payment', paid_by: 'single', membership_id: null, purchase_id: pid });
      return { status: 'payment_required', payment_url: 'demo-pay:' + pid, amount: cov.price };
    },
    cancel(body) {
      const b = db.bookings.find((x) => x.id === body.booking_id && x.client_id === ME);
      if (!b || !['booked', 'waitlist', 'pending_payment'].includes(b.status)) fail('Запись не найдена');
      const e = eventOf(b.event_id);
      const hours = (parse(e.starts_at) - new Date()) / 3600e3;
      const was = b.status;
      let returned = true;
      if (was === 'booked') {
        if (hours >= 24) b.status = 'cancelled'; else { b.status = 'late_cancel'; returned = false; }
      } else {
        b.status = 'cancelled';
        if (b.purchase_id) { const p = db.purchases.find((x) => x.id === b.purchase_id); if (p && p.status === 'pending') p.status = 'cancelled'; }
      }
      b.updated_at = nowS();
      return { ok: true, returned, refund: returned && b.paid_by === 'single' && was === 'booked' };
    },
    bookings() {
      const border = toS(new Date(Date.now() - 2 * 3600e3));
      const list = db.bookings.filter((b) => b.client_id === ME && b.status !== 'cancelled').map((b) => eventOf(b.event_id)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const upcoming = [], past = [];
      list.forEach((e) => {
        const item = pub(e, ME);
        if (e.starts_at >= border && item.my_status !== 'late_cancel') upcoming.push(item);
        else if (e.starts_at < border) past.push(item);
      });
      return { upcoming, past: past.reverse() };
    },
    plans() {
      return {
        plans: Object.entries(PLANS).map(([key, p]) => ({ key, ...p })), single_price: SINGLE,
        months: [curMonth(), nextMonth()].map((k) => ({ key: k, label: monthLabel(k), ends: human(lastDay(k), false) })),
      };
    },
    buy(body) {
      if (!PLANS[body.plan]) fail('Выберите абонемент');
      if (![curMonth(), nextMonth()].includes(body.month)) fail('Абонемент можно купить на текущий или следующий месяц');
      if (PLANS[body.plan].clubs === 1 && !['lit', 'script'].includes(body.club)) fail('Выберите клуб: литературный или сценарный');
      if (activeMembership(ME, body.month)) fail('На ' + monthLabel(body.month) + ' у вас уже есть абонемент');
      if (!me().phone) fail('Укажите телефон в профиле: на него придёт чек', 409);
      const plan = PLANS[body.plan];
      const pid = seq++;
      db.purchases.push({ id: pid, client_id: ME, kind: 'membership', amount: plan.price, status: 'pending', provider: 'demo', description: `Абонемент «${plan.name}» на ${monthLabel(body.month)}`, paid_at: null });
      db.memberships.push({ id: seq++, client_id: ME, plan: body.plan, month: body.month, club: plan.clubs === 1 ? body.club : null, status: 'pending', price: plan.price, purchase_id: pid });
      return { payment_url: 'demo-pay:' + pid, purchase_id: pid };
    },
    purchase(_, q) {
      const p = db.purchases.find((x) => x.id === Number(q.id) && x.client_id === ME);
      if (!p) fail('Платёж не найден', 404);
      const m = p.kind === 'membership' ? db.memberships.find((x) => x.purchase_id === p.id && x.status === 'active') : null;
      return { id: p.id, kind: p.kind, status: p.status, amount: p.amount, membership: m ? usage(m) : null };
    },
    'staff/day'(_, q) {
      const date = q.date;
      const events = db.events.filter((e) => !e.cancelled && e.starts_at.slice(0, 10) === date).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      return {
        date,
        events: events.map((e) => ({
          ...pub(e),
          people: db.bookings.filter((b) => b.event_id === e.id && ['booked', 'attended', 'noshow', 'waitlist'].includes(b.status))
            .map((b) => { const c = db.clients.find((x) => x.id === b.client_id); return { booking_id: b.id, status: b.status, paid_by: b.paid_by, client_id: c.id, name: c.name, phone: c.phone }; })
            .sort((a, b) => (a.status === 'waitlist') - (b.status === 'waitlist') || a.name.localeCompare(b.name, 'ru')),
        })),
      };
    },
    'staff/attend'(body) {
      const b = db.bookings.find((x) => x.id === body.booking_id);
      if (b && ['booked', 'attended', 'noshow'].includes(b.status)) b.status = body.attended ? 'attended' : 'booked';
      return { ok: true };
    },
    'staff/event'(body) {
      if (!FORMATS[body.format]) fail('Выберите формат');
      if (!body.title || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !/^\d{2}:\d{2}$/.test(body.time)) fail('Заполните название, дату и время');
      const ids = [];
      for (let i = 0; i < Math.max(1, Math.min(26, body.repeat_weeks || 1)); i++) {
        const d = parse(body.date + ' ' + body.time); d.setDate(d.getDate() + i * 7);
        const id = seq++;
        db.events.push({ id, format: body.format, title: body.title, host: body.host || '', description: body.description || '', starts_at: toS(d), duration_min: body.duration_min || 120, capacity: body.capacity || CAPACITY, price: body.price ? Number(body.price) : null, included: body.included ? 1 : 0, cancelled: 0 });
        ids.push(id);
      }
      return { ok: true, ids };
    },
    'staff/event_cancel'(body) {
      const e = eventOf(body.event_id);
      if (!e) fail('Встреча не найдена');
      e.cancelled = 1;
      db.bookings.filter((b) => b.event_id === e.id && ['booked', 'waitlist', 'pending_payment'].includes(b.status)).forEach((b) => { b.status = 'cancelled'; });
      return { ok: true };
    },
    'staff/clients'(_, q) {
      const s = String(q.q || '').toLowerCase();
      const digits = s.replace(/\D+/g, '');
      return {
        clients: db.clients.filter((c) => !s || c.name.toLowerCase().includes(s) || (c.tg_username || '').includes(s.replace('@', '')) || (digits && c.phone.includes(digits)))
          .slice(0, 30).map((c) => { const m = activeMembership(c.id, curMonth()); return { id: c.id, name: c.name, phone: c.phone, tg_username: c.tg_username, membership: m ? PLANS[m.plan].name : null }; }),
      };
    },
    'staff/client'(_, q) {
      const c = db.clients.find((x) => x.id === Number(q.id));
      if (!c) fail('Клиент не найден', 404);
      return {
        client: c,
        memberships: db.memberships.filter((m) => m.client_id === c.id && m.status === 'active').sort((a, b) => b.month.localeCompare(a.month)).map(usage),
        bookings: db.bookings.filter((b) => b.client_id === c.id).map((b) => { const e = eventOf(b.event_id); return { status: b.status, title: e.title, starts_at: e.starts_at }; }).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 20),
        purchases: db.purchases.filter((p) => p.client_id === c.id).reverse().slice(0, 20),
      };
    },
    'staff/sell'(body) {
      const c = db.clients.find((x) => x.id === body.client_id);
      if (!c || !PLANS[body.plan]) fail('Проверьте клиента, абонемент и месяц');
      if (activeMembership(c.id, body.month)) fail('На этот месяц у клиента уже есть абонемент');
      const plan = PLANS[body.plan];
      db.purchases.push({ id: seq++, client_id: c.id, kind: 'membership', amount: plan.price, status: 'paid', provider: 'cash', description: `Абонемент «${plan.name}» на ${monthLabel(body.month)} (на месте)`, paid_at: nowS() });
      db.memberships.push({ id: seq++, client_id: c.id, plan: body.plan, month: body.month, club: plan.clubs === 1 ? body.club : null, status: 'active', price: plan.price });
      return { ok: true };
    },
    'staff/note'(body) {
      const c = db.clients.find((x) => x.id === body.client_id);
      if (c) c.note = String(body.note || '').slice(0, 2000);
      return { ok: true };
    },
  };

  function markPaid(pid) {
    const p = db.purchases.find((x) => x.id === pid);
    if (!p || p.status === 'paid') return;
    p.status = 'paid';
    p.paid_at = nowS();
    if (p.kind === 'membership') {
      const m = db.memberships.find((x) => x.purchase_id === pid);
      if (m) m.status = 'active';
    } else {
      const b = db.bookings.find((x) => x.purchase_id === pid);
      if (b) { b.status = 'booked'; b.paid_by = 'single'; }
    }
  }

  // ---------- связь с кабинетом ----------
  let ui = null;

  function api(route, body, query) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const fn = routes[route];
          if (!fn) fail('Неизвестный запрос', 404);
          resolve(clone(fn(body ? clone(body) : null, query || {})));
        } catch (e) { reject(e); }
      }, 160);
    });
  }

  function pay(url) {
    const pid = Number(String(url).split(':')[1]);
    const p = db.purchases.find((x) => x.id === pid);
    if (!p) return;
    ui.openSheet(`
      <p class="eyebrow">Демо-оплата</p>
      <h2 class="sheet__title" id="sheetTitle">К оплате ${p.amount.toLocaleString('ru-RU')}&nbsp;₽</h2>
      <div class="card card--flat"><p>${p.description.replace(/</g, '&lt;')}</p></div>
      <p class="muted">В настоящем кабинете здесь откроется страница платёжной системы: карта, СБП или SberPay. Чек придёт на телефон.</p>
      <div class="stack">
        <button class="pill pill--accent pill--wide" type="button" data-demo-pay="${pid}">Оплатить</button>
        <button class="pill pill--quiet pill--wide" type="button" data-close>Отмена</button>
      </div>`);
  }

  function ics() {
    ui.openSheet(`
      <p class="eyebrow">Календарь</p>
      <h2 class="sheet__title" id="sheetTitle">Встреча — в календаре телефона</h2>
      <p class="muted">В настоящем кабинете по этой кнопке скачается файл календаря. Телефон сам предложит добавить встречу, а календарь напомнит о ней за 2 часа.</p>
      <button class="pill pill--ink pill--wide" type="button" data-close>Понятно</button>`);
  }

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-demo-pay]');
    if (!btn) return;
    const pid = Number(btn.dataset.demoPay);
    markPaid(pid);
    ui.closeSheet();
    setTimeout(() => ui.checkPurchase(pid), 320);
  });

  function init(hooks) {
    ui = hooks;
    const logo = document.querySelector('.top__logo');
    if (logo && !document.querySelector('.demo-flag')) {
      logo.insertAdjacentHTML('afterend', '<span class="badge badge--wait demo-flag" title="Данные ненастоящие: можно нажимать всё">демо</span>');
    }
  }

  seed();
  return { api, pay, ics, init };
})();
