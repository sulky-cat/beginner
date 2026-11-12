'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const seed = require('../js/seed.js');

const TODAY = C.TODAY;
const emp = (over = {}) => C.create({ name: 'Тест Тестов', role: 'Роль', department: 'Склад', start: TODAY, mentor: 'Наставник', ...over }, 't1');

test('date принимает корректную дату и отклоняет мусор', () => {
  assert.equal(C.date('2026-11-11').toISOString().slice(0, 10), '2026-11-11');
  for (const bad of ['2026-02-30', '2026-13-01', '11-11-2026', '', null, 42]) assert.throws(() => C.date(bad));
});

test('shift корректно переходит через месяц и год', () => {
  assert.equal(C.shift('2026-11-11', 1), '2026-11-12');
  assert.equal(C.shift('2026-11-11', -12), '2026-10-30');
  assert.equal(C.shift('2026-12-31', 1), '2027-01-01');
  assert.equal(C.shift('2026-01-01', -1), '2025-12-31');
});

test('день 1 — дата выхода сегодня', () => {
  const e = emp(); assert.equal(C.day(e), 1); assert.equal(C.stage(e), 'active'); assert.ok(C.active(e));
});

test('день 90 ещё активен, день 91 уже завершён', () => {
  const e90 = emp({ start: C.shift(TODAY, -89) }); assert.equal(C.day(e90), 90); assert.ok(C.active(e90));
  const e91 = emp({ start: C.shift(TODAY, -90) }); assert.equal(C.day(e91), 91); assert.equal(C.stage(e91), 'finished'); assert.ok(!C.active(e91));
});

test('будущий сотрудник не активен и не требует внимания', () => {
  const e = emp({ start: C.shift(TODAY, 1), mentor: '' });
  assert.equal(C.stage(e), 'future'); assert.deepEqual(C.issues(e), []);
});

test('завершённый после 90 дней не попадает в автоматические вопросы', () => {
  const e = emp({ start: C.shift(TODAY, -120), mentor: '' });
  e.tasks[0].done = false;
  assert.deepEqual(C.issues(e), []);
});

test('template: 8 уникальных шагов для каждого подразделения', () => {
  for (const d of C.DEPARTMENTS) {
    const t = C.template(d);
    assert.equal(t.length, 8);
    assert.equal(new Set(t.map(x => x.id)).size, 8);
    assert.ok(t.every(x => x.done === false && x.completedAt === null));
  }
  assert.throws(() => C.template('Маркетинг'));
});

test('срок сегодня не является просрочкой', () => {
  const e = emp(); const t = e.tasks[0];
  assert.ok(C.dueToday(e, t)); assert.ok(!C.overdue(e, t));
});

test('вчерашний невыполненный шаг просрочен, выполненный — нет', () => {
  const e = emp({ start: C.shift(TODAY, -1) }); const t = e.tasks[0];
  assert.ok(C.overdue(e, t));
  t.done = true; t.completedAt = TODAY;
  assert.ok(!C.overdue(e, t)); assert.ok(!C.dueToday(e, t));
});

test('issues: нет наставника у активного сотрудника', () => {
  const e = emp({ mentor: '   ' });
  assert.deepEqual(C.issues(e).map(x => x.code), ['mentor']);
});

test('issues: просроченные шаги считаются по шагам, не по людям', () => {
  const e = emp({ start: C.shift(TODAY, -10) });
  const codes = C.issues(e).map(x => x.code);
  assert.ok(codes.includes('overdue'));
  const label = C.issues(e).find(x => x.code === 'overdue').label;
  assert.match(label, /Закрыть просроченные шаги: \d+/);
});

test('issues: просьба о помощи берётся из последней записи', () => {
  const e = emp();
  e.checkins.push({ date: TODAY, needsHelp: true, note: 'Нужна помощь с кассой' });
  assert.ok(C.issues(e).some(x => x.code === 'help'));
  e.checkins.push({ date: TODAY, needsHelp: false, note: 'Вопрос решён' });
  assert.ok(!C.issues(e).some(x => x.code === 'help'));
});

test('progress: 5 из 8 = 63%, это не оценка сотрудника', () => {
  const e = emp(); e.tasks.slice(0, 5).forEach(t => { t.done = true; t.completedAt = TODAY; });
  assert.equal(C.doneCount(e), 5); assert.equal(C.progress(e), 63);
});

test('summary исходного демо: 12 / 11 / 4 / 3 / 4', () => {
  const s = C.summary(seed());
  assert.deepEqual({ total: s.total, active: s.active, attention: s.attention, overdue: s.overdue, today: s.today, future: s.future },
    { total: 12, active: 11, attention: 4, overdue: 3, today: 4, future: 1 });
});

test('демо: Мария — два вопроса, Анна — без вопросов и 63%, Илья — помощь', () => {
  const s = seed();
  const maria = s.employees.find(e => e.id === 'n01');
  const anna = s.employees.find(e => e.id === 'n05');
  const ilya = s.employees.find(e => e.id === 'n02');
  assert.deepEqual(C.issues(maria).map(x => x.code), ['mentor', 'overdue']);
  assert.deepEqual(C.issues(anna), []); assert.equal(C.progress(anna), 63);
  assert.deepEqual(C.issues(ilya).map(x => x.code), ['help']);
});

test('create обрезает пробелы и валидирует поля', () => {
  const e = C.create({ name: '  Имя Фамилия  ', role: ' Роль ', department: 'Офис', start: TODAY, mentor: '  ' }, 'x1');
  assert.equal(e.name, 'Имя Фамилия'); assert.equal(e.mentor, '');
  assert.throws(() => C.create({ name: 'А', role: 'Роль', department: 'Офис', start: TODAY }, 'x2'));
  assert.throws(() => C.create({ name: 'Имя', role: 'Р', department: 'Офис', start: TODAY }, 'x3'));
  assert.throws(() => C.create({ name: 'Имя', role: 'Роль', department: 'Маркетинг', start: TODAY }, 'x4'));
  assert.throws(() => C.create({ name: 'Имя', role: 'Роль', department: 'Офис', start: '1999-12-31' }, 'x5'));
  assert.throws(() => C.create({ name: 'Имя', role: 'Роль', department: 'Офис', start: TODAY, mentor: 'я'.repeat(101) }, 'x6'));
  assert.throws(() => C.create({ name: 'Имя', role: 'Роль', department: 'Офис', start: TODAY }, 'плохой id'));
});

test('validate принимает исходное демо', () => {
  const s = seed(); const v = C.validate(JSON.parse(JSON.stringify(s)));
  assert.equal(v.employees.length, 12); assert.equal(v.today, TODAY);
});

test('validate отклоняет чужую версию, дату и лишний объём', () => {
  assert.throws(() => C.validate(null));
  assert.throws(() => C.validate({ ...seed(), schemaVersion: 2 }));
  assert.throws(() => C.validate({ ...seed(), today: '2026-11-12' }));
  const big = seed(); big.employees = Array.from({ length: 301 }, (_, i) => ({ ...big.employees[0], id: 'n' + i }));
  assert.throws(() => C.validate(big));
});

test('validate отклоняет дубли ID сотрудников и шагов', () => {
  const s = seed(); s.employees[1].id = s.employees[0].id; assert.throws(() => C.validate(s));
  const s2 = seed(); s2.employees[0].tasks[1].id = s2.employees[0].tasks[0].id; assert.throws(() => C.validate(s2));
});

test('validate требует дату выполнения у выполненного шага и null у невыполненного', () => {
  const s = seed(); const t = s.employees[0].tasks.find(x => x.done); t.completedAt = null; assert.throws(() => C.validate(s));
  const s2 = seed(); const t2 = s2.employees[0].tasks.find(x => !x.done); t2.completedAt = TODAY; assert.throws(() => C.validate(s2));
});

test('validate отклоняет даты выполнения и разговоров вне диапазона', () => {
  const s = seed(); const e = s.employees[0]; const t = e.tasks.find(x => x.done); t.completedAt = C.shift(TODAY, 1); assert.throws(() => C.validate(s));
  const s2 = seed(); s2.employees[1].checkins[0].date = C.shift(TODAY, 1); assert.throws(() => C.validate(s2));
  const s3 = seed(); s3.employees[1].checkins[0].date = '2000-01-01'; assert.throws(() => C.validate(s3));
});

test('validate проверяет журналы и длину итога разговора', () => {
  const s = seed(); s.employees[1].checkins[0].note = 'ок'; assert.throws(() => C.validate(s));
  const s2 = seed(); s2.employees[1].checkins[0].needsHelp = 'да'; assert.throws(() => C.validate(s2));
  const s3 = seed(); s3.employees[0].history = [{ date: C.shift(TODAY, 1), text: 'будущее' }]; assert.throws(() => C.validate(s3));
  const s4 = seed(); s4.employees[0].history = null; assert.throws(() => C.validate(s4));
});

test('validate восстанавливает канонические заголовки шагов, а не доверяет импорту', () => {
  const s = seed(); s.employees[0].tasks[0].title = '<img src=x onerror=alert(1)>';
  const v = C.validate(s);
  assert.equal(v.employees[0].tasks[0].title, C.template('Магазины')[0].title);
});

test('issues не мутируют сотрудника и вызываются повторно стабильно', () => {
  const e = emp({ mentor: '' });
  const a = C.issues(e), b = C.issues(e);
  assert.deepEqual(a, b); assert.equal(e.mentor, '');
});
