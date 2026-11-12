/* Доменная логика «Новичок». Без DOM и без сайд-эффектов: работает и в браузере, и в Node (тесты). */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else { root.NV = root.NV || {}; root.NV.core = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TODAY = '2026-11-11';           // демо-дата зафиксирована намеренно
  const DAY = 86400000;
  const DEPARTMENTS = ['Склад', 'Магазины', 'Продажи', 'Офис'];
  const MENTORS = {
    'Склад': ['Виктор Лесов', 'Елена Туманова'],
    'Магазины': ['Ольга Кедрова', 'Никита Заречный'],
    'Продажи': ['Роман Яснев', 'Алина Светлова'],
    'Офис': ['Татьяна Липова', 'Марк Озёрный']
  };
  const LIMITS = { employees: 300, checkins: 500, history: 1000, name: 100, role: 100, mentor: 100, note: 1000, historyText: 1200 };

  function date(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error('Некорректная дата');
    const d = new Date(s + 'T12:00:00Z');
    if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== s) throw Error('Некорректная дата');
    return d;
  }
  const shift = (s, n) => new Date(+date(s) + n * DAY).toISOString().slice(0, 10);
  const days = (a, b) => Math.round((+date(b) - +date(a)) / DAY);
  const day = e => days(e.start, TODAY) + 1;
  const stage = e => { const d = day(e); return d < 1 ? 'future' : d > 90 ? 'finished' : 'active'; };
  const active = e => stage(e) === 'active';

  function template(dept) {
    const spec = {
      'Склад': ['Пройти инструктаж по безопасности', 'Отработать приёмку товара с наставником'],
      'Магазины': ['Познакомиться с кассой и правилами возврата', 'Провести первую консультацию с наставником'],
      'Продажи': ['Получить доступ к CRM и прайс-листу', 'Разобрать первый заказ с наставником'],
      'Офис': ['Получить доступ к рабочим системам', 'Выполнить первую задачу с наставником']
    }[dept];
    if (!spec) throw Error('Неизвестное подразделение');
    return [
      ['welcome', 'Познакомиться с командой и планом', 0, 'Руководитель'],
      ['access', spec[0], 0, 'Руководитель'],
      ['practice', spec[1], 2, 'Наставник'],
      ['week', 'Обсудить первую неделю один на один', 6, 'Руководитель'],
      ['fortnight', 'Проверить, что задачи и ожидания понятны', 13, 'Наставник'],
      ['month', 'Обсудить первый месяц и затруднения', 29, 'Руководитель'],
      ['sixty', 'Договориться о целях на третий месяц', 59, 'Руководитель'],
      ['ninety', 'Подвести итоги 90 дней вместе с новичком', 89, 'Руководитель']
    ].map(([id, title, offset, owner]) => ({ id, title, offset, owner, done: false, completedAt: null }));
  }

  const due = (e, t) => shift(e.start, t.offset);
  const overdue = (e, t) => !t.done && due(e, t) < TODAY;
  const dueToday = (e, t) => !t.done && due(e, t) === TODAY;

  function issues(e) {
    if (!active(e)) return [];
    const r = [];
    if (!e.mentor.trim()) r.push({ code: 'mentor', label: 'Назначить наставника', detail: 'В карточке не указано, к кому новичок может обратиться за помощью.' });
    const n = e.tasks.filter(t => overdue(e, t)).length;
    if (n) r.push({ code: 'overdue', label: 'Закрыть просроченные шаги: ' + n, detail: 'Срок прошёл, а выполнение не отмечено. Уточните причину и выполните шаг, прежде чем ставить отметку.' });
    const last = e.checkins[e.checkins.length - 1];
    if (last && last.needsHelp) r.push({ code: 'help', label: 'Обсудить просьбу о помощи', detail: 'В последнем записанном разговоре отмечено «Нужна помощь». Запишите новый итог после обсуждения.' });
    return r;
  }

  const doneCount = e => e.tasks.filter(t => t.done).length;
  const progress = e => Math.round(doneCount(e) / e.tasks.length * 100);

  function summary(s) {
    const a = s.employees.filter(active);
    return {
      total: s.employees.length,
      active: a.length,
      future: s.employees.filter(e => stage(e) === 'future').length,
      finished: s.employees.filter(e => stage(e) === 'finished').length,
      attention: a.filter(e => issues(e).length).length,
      overdue: a.reduce((n, e) => n + e.tasks.filter(t => overdue(e, t)).length, 0),
      today: a.reduce((n, e) => n + e.tasks.filter(t => dueToday(e, t)).length, 0)
    };
  }

  function clean(v, max, field, min) {
    const s = String(v == null ? '' : v).trim();
    if (s.length < (min || 0) || s.length > max) throw Error(field + ': допустимо от ' + (min || 0) + ' до ' + max + ' символов');
    return s;
  }

  function create(f, id) {
    const name = clean(f.name, LIMITS.name, 'Имя', 2);
    const role = clean(f.role, LIMITS.role, 'Должность', 2);
    const mentor = clean(f.mentor, LIMITS.mentor, 'Наставник', 0);
    date(f.start);
    if (f.start < '2000-01-01' || f.start > '2100-12-31') throw Error('Дата выхода: с 2000 по 2100 год');
    if (!DEPARTMENTS.includes(f.department)) throw Error('Выберите подразделение');
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw Error('Некорректный ID');
    return { id, name, role, department: f.department, start: f.start, mentor, tasks: template(f.department), checkins: [], history: [] };
  }

  function validate(s) {
    if (!s || s.schemaVersion !== 1 || s.today !== TODAY || !Array.isArray(s.employees) || s.employees.length > LIMITS.employees)
      throw Error('Нужна JSON-копия демо версии 1 (до 300 сотрудников, дата ' + TODAY + ')');
    const ids = new Set();
    const employees = s.employees.map(e => {
      if (!e || typeof e.id !== 'string' || ids.has(e.id)) throw Error('Повреждён или повторяется ID сотрудника');
      ids.add(e.id);
      const c = create(e, e.id);
      if (!Array.isArray(e.tasks) || e.tasks.length !== c.tasks.length) throw Error('Повреждён план адаптации');
      const seen = new Set();
      c.tasks = c.tasks.map(t => {
        const matches = e.tasks.filter(x => x && x.id === t.id);
        if (matches.length !== 1) throw Error('Повреждён или дублируется шаг плана');
        const o = matches[0];
        if (seen.has(t.id)) throw Error('Дублируется шаг плана');
        seen.add(t.id);
        if (typeof o.done !== 'boolean') throw Error('Повреждён шаг плана');
        if (o.done) {
          date(o.completedAt);
          if (o.completedAt < e.start || o.completedAt > TODAY) throw Error('Дата выполнения шага вне допустимого диапазона');
        } else if (o.completedAt !== null) throw Error('У невыполненного шага есть дата выполнения');
        return { ...t, done: o.done, completedAt: o.done ? o.completedAt : null };
      });
      if (!Array.isArray(e.checkins) || e.checkins.length > LIMITS.checkins || !Array.isArray(e.history) || e.history.length > LIMITS.history)
        throw Error('Повреждён журнал');
      c.checkins = e.checkins.map(x => {
        if (!x) throw Error('Повреждена запись разговора');
        date(x.date);
        if (x.date < e.start || x.date > TODAY) throw Error('Дата разговора вне допустимого диапазона');
        if (typeof x.needsHelp !== 'boolean') throw Error('Повреждена запись разговора');
        return { date: x.date, needsHelp: x.needsHelp, note: clean(x.note, LIMITS.note, 'Итог разговора', 5) };
      });
      c.history = e.history.map(x => {
        if (!x) throw Error('Повреждена история');
        date(x.date);
        if (x.date > TODAY) throw Error('Дата истории вне допустимого диапазона');
        return { date: x.date, text: clean(x.text, LIMITS.historyText, 'Запись истории', 1) };
      });
      return c;
    });
    return { schemaVersion: 1, today: TODAY, employees };
  }

  return { TODAY, DAY, DEPARTMENTS, MENTORS, LIMITS, date, shift, days, day, stage, active, template, due, overdue, dueToday, issues, doneCount, progress, summary, create, validate };
});
