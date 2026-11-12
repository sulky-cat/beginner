/* Вымышленные демо-данные. Цифры совпадают с памяткой проверяющему: 12 человек, 11 в первые 90 дней, 4 требуют внимания, 3 просроченных шага, 4 шага на сегодня. */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./core.js'));
  else { root.NV = root.NV || {}; root.NV.seed = factory(root.NV.core); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';
  const rows = [
    ['n01', 'Мария Соколова', 'Магазины', 'Продавец-консультант', 12, '', ['access'], false],
    ['n02', 'Илья Горин', 'Склад', 'Комплектовщик', 6, 'Виктор Лесов', [], true],
    ['n03', 'Дарья Ветрова', 'Продажи', 'Менеджер по продажам', 31, 'Алина Светлова', ['month'], false],
    ['n04', 'Артём Берестов', 'Магазины', 'Продавец-консультант', 8, 'Ольга Кедрова', ['week'], false],
    ['n05', 'Анна Ладина', 'Офис', 'Бухгалтер', 22, 'Татьяна Липова', [], false],
    ['n06', 'Михаил Ольхов', 'Склад', 'Кладовщик', 3, 'Елена Туманова', [], false],
    ['n07', 'Софья Рощина', 'Магазины', 'Кассир', 1, 'Никита Заречный', [], false],
    ['n08', 'Денис Луговой', 'Продажи', 'Менеджер по продажам', 45, 'Роман Яснев', [], false],
    ['n09', 'Полина Кленова', 'Офис', 'Специалист по закупкам', 67, 'Марк Озёрный', [], false],
    ['n10', 'Кирилл Яров', 'Склад', 'Комплектовщик', 85, 'Виктор Лесов', [], false],
    ['n11', 'Ева Листова', 'Офис', 'Контент-менеджер', 14, 'Татьяна Липова', [], false],
    ['n12', 'Максим Речнов', 'Магазины', 'Продавец-консультант', -1, 'Ольга Кедрова', [], false]
  ];
  return function seed() {
    return {
      schemaVersion: 1,
      today: C.TODAY,
      employees: rows.map(([id, name, department, role, d, mentor, missed, help]) => {
        const e = C.create({ name, department, role, start: C.shift(C.TODAY, 1 - d), mentor }, id);
        e.tasks.forEach(t => { t.done = t.offset < d - 1 && !missed.includes(t.id); t.completedAt = t.done ? C.shift(e.start, t.offset) : null; });
        if (d > 3) e.checkins.push({
          date: C.shift(C.TODAY, -1),
          needsHelp: help,
          note: help ? 'Не уверен, как разбирать расхождения при сборке. Нужна ещё одна смена рядом с наставником.' : 'План понятен, могу обратиться к наставнику.'
        });
        e.history.push({ date: e.start > C.TODAY ? C.TODAY : e.start, text: 'Создан план адаптации (демо-запись)' });
        return e;
      })
    };
  };
});
