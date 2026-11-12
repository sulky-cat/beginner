'use strict';
/* Браузерные сценарии: node tests/browser.test.js. Требуется npm i и npx playwright install chromium. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('../server.js');

const AXE = require.resolve('axe-core/axe.min.js');
const results = [];
let page, browser, server, base, errors;

function ok(name) { results.push(name); console.log('ok -', name); }
async function fresh() {
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#body tr');
}
const metricValues = () => page.$$eval('.metric-value', els => els.map(e => e.textContent.trim()));
const rowCount = () => page.$$eval('#body tr', r => r.length);
const attention = () => page.textContent('#nav-attention');
async function openPerson(name) {
  await page.locator('.person-btn', { hasText: name }).first().click();
  await page.waitForSelector('#drawer[open]');
}
async function closeDrawer() { await page.keyboard.press('Escape'); await page.waitForSelector('#drawer:not([open])', { state: 'hidden' }); }
async function confirm() { await page.waitForSelector('#confirm-modal[open]'); await page.click('#confirm-ok'); await page.waitForSelector('#confirm-modal:not([open])', { state: 'hidden' }); }
async function axeCheck(label) {
  // Замеряем только конечное состояние: анимации появления и переход темы
  // иначе дают промежуточные цвета и ложные нарушения контраста.
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.waitForTimeout(80);
  await page.addScriptTag({ path: AXE });
  const res = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
  const serious = res.violations.filter(v => ['serious', 'critical'].includes(v.impact));
  if (serious.length) console.log(JSON.stringify(serious, null, 2));
  assert.equal(serious.length, 0, label + ': серьёзных нарушений axe нет');
}

(async () => {
  server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 960 } });
  page = await ctx.newPage();
  errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await fresh();
  assert.deepEqual(await metricValues(), ['11', '4', '3', '4']);
  assert.equal(await rowCount(), 12);
  assert.equal(await attention(), '4');
  ok('исходные цифры демо: 11 / 4 / 3 / 4, 12 строк');

  await page.locator('[data-nav="attention"]').first().click();
  assert.equal(await rowCount(), 4);
  ok('раздел «Требуют внимания» показывает 4 сотрудников');

  await openPerson('Мария Соколова');
  assert.equal(await page.locator('#drawer .issue-item').count(), 2);
  await page.fill('#mentor', 'Ольга Кедрова');
  await page.locator('#mentor-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#drawer').textContent.includes('Назначить наставника'));
  assert.equal(await attention(), '4');
  await page.locator('#drawer [data-task="access"]').click();
  await page.waitForFunction(() => document.querySelector('#nav-attention').textContent === '3');
  assert.match(await page.textContent('#drawer .section-row .mono'), /4 из 8 · 50%/);
  ok('Мария: наставник + шаг, счётчик 4 → 3, план 50%');
  await closeDrawer();
  assert.equal(await rowCount(), 3);

  await openPerson('Илья Горин');
  await page.locator('#checkin input[value=ok]').check();
  await page.fill('#checkin textarea', 'Провели смену с наставником. Вопросы по сборке разобраны.');
  await page.locator('#checkin button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('#nav-attention').textContent === '2');
  await closeDrawer();
  ok('Илья: итог разговора закрывает просьбу о помощи, 3 → 2');

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#body tr');
  assert.equal(await attention(), '2');
  await page.locator('[data-nav="overview"]').first().click();
  await openPerson('Мария Соколова');
  assert.equal(await page.inputValue('#mentor'), 'Ольга Кедрова');
  await closeDrawer();
  ok('localStorage сохраняет изменения после перезагрузки');
  assert.ok(await page.locator('#undo').isDisabled());
  ok('после перезагрузки стек отмены не переносится, сохранённые данные остаются');

  await fresh();
  await page.locator('[data-action="add"]').first().click();
  await page.fill('#employee-form [name=name]', 'Тест Новый');
  await page.fill('#employee-form [name=role]', 'Стажёр');
  await page.selectOption('#employee-form [name=department]', 'Склад');
  await page.locator('#employee-form button[type=submit]').click();
  await page.waitForSelector('#drawer[open]');
  assert.equal(await page.textContent('#drawer-name'), 'Тест Новый');
  assert.equal(await page.locator('#drawer .task').count(), 8);
  await closeDrawer();
  assert.equal(await rowCount(), 13);
  ok('добавление новичка создаёт план из 8 шагов');

  await openPerson('Тест Новый');
  await page.locator('#drawer [data-action="edit"]').click();
  await page.fill('#employee-form [name=name]', 'Тест Переименован');
  await page.locator('#employee-form button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('#drawer-name').textContent === 'Тест Переименован');
  ok('редактирование сотрудника обновляет карточку');
  await page.locator('#drawer [data-action="delete"]').click();
  await confirm();
  assert.equal(await rowCount(), 12);
  await page.click('#undo');
  assert.equal(await rowCount(), 13);
  ok('удаление сотрудника отменяется');
  await openPerson('Тест Переименован');
  await page.locator('#drawer [data-action="delete"]').click();
  await confirm();
  assert.equal(await rowCount(), 12);

  await fresh();
  await page.fill('#search', 'кассир');
  assert.equal(await rowCount(), 1);
  assert.match(await page.textContent('#body'), /Софья Рощина/);
  await page.fill('#search', '');
  await page.selectOption('#dept', 'Склад');
  assert.equal(await rowCount(), 3);
  await page.selectOption('#dept', '');
  await page.selectOption('#sort', 'name');
  const first = await page.textContent('#body tr:first-child .person-btn');
  assert.equal(first, 'Анна Ладина');
  ok('поиск, фильтр подразделения и сортировка работают');

  await page.locator('[data-filter="overdue"]').click();
  assert.equal(await rowCount(), 3);
  await page.locator('[data-filter="today"]').click();
  assert.equal(await rowCount(), 3); // 4 шага сегодня у 3 сотрудников: Софья (2), Михаил (1), Ева (1)
  assert.equal((await metricValues())[3], '4');
  await page.locator('[data-filter="all"]').click();
  ok('вкладки «Просрочки» и «Шаги сегодня» фильтруют список');

  await page.check('#check-all');
  assert.equal(await page.textContent('#bulk-count'), 'Выбрано: 12');
  await page.locator('[data-action="bulk-delete"]').click();
  await confirm();
  assert.equal(await rowCount(), 0);
  await page.click('#undo');
  assert.equal(await rowCount(), 12);
  ok('массовое выделение и удаление с отменой');

  await page.selectOption('#dept', 'Офис');
  await page.locator('[data-filter="attention"]').click();
  await page.locator('[data-action="save-view"]').click();
  await page.fill('#view-form [name=name]', 'Офис · вопросы');
  await page.locator('#view-form button[type=submit]').click();
  await page.waitForSelector('#view-modal:not([open])', { state: 'hidden' });
  await page.selectOption('#dept', '');
  await page.locator('[data-filter="all"]').click();
  await page.selectOption('#saved-view', { label: 'Офис · вопросы' });
  assert.equal(await page.inputValue('#dept'), 'Офис');
  assert.equal(await page.locator('[data-filter="attention"]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-action="delete-view"]').click();
  await confirm();
  ok('сохранённые представления сохраняются, применяются и удаляются');

  await fresh();
  await page.selectOption('#sort', 'manual');
  assert.equal(await page.locator('#body tr[draggable=true]').count(), 12);
  const before = await page.$$eval('#body tr', r => r.map(x => x.dataset.id));
  await page.evaluate(() => {
    const rows = document.querySelectorAll('#body tr');
    const dt = new DataTransfer();
    rows[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    rows[2].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    rows[2].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    rows[0].dispatchEvent(new DragEvent('dragend', { bubbles: true }));
  });
  const after = await page.$$eval('#body tr', r => r.map(x => x.dataset.id));
  assert.notDeepEqual(before, after);
  ok('ручной порядок перетаскиванием меняет порядок строк');

  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action="export"]').first().click()]);
  const file = await download.path();
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(data.employees.length, 12);
  ok('экспорт JSON скачивает валидную копию данных');

  data.employees[0].name = 'Импортированная Мария';
  await page.setInputFiles('#import', { name: 'data.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await confirm();
  await page.waitForFunction(() => document.body.textContent.includes('Импортированная Мария'));
  ok('импорт JSON заменяет данные после подтверждения');

  await page.setInputFiles('#import', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":99}') });
  await page.waitForSelector('.toast.error');
  assert.equal(await rowCount(), 12);
  ok('повреждённый JSON отклоняется без потери данных');

  await page.locator('[data-nav="guide"]').first().click();
  await page.locator('[data-action="reset"]').first().click();
  await confirm();
  await page.locator('[data-nav="overview"]').first().click();
  assert.deepEqual(await metricValues(), ['11', '4', '3', '4']);
  ok('возврат исходного демо восстанавливает цифры');

  await page.locator('[data-action="add"]').first().click();
  await page.fill('#employee-form [name=name]', '<img src=x onerror="window.__xss=1">');
  await page.fill('#employee-form [name=role]', 'Тест');
  await page.locator('#employee-form button[type=submit]').click();
  await page.waitForSelector('#drawer[open]');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('#drawer img').count(), 0);
  assert.match(await page.textContent('#drawer-name'), /<img/);
  await closeDrawer();
  ok('имя с HTML экранируется и не выполняет скрипт');

  await page.click('#theme');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  await page.reload({ waitUntil: 'load' });
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  await page.click('#theme');
  ok('тема переключается и сохраняется');

  await fresh();
  await axeCheck('обзор, светлая тема');
  await page.locator('[data-nav="guide"]').first().click();
  await axeCheck('инструкция');
  await page.locator('[data-nav="overview"]').first().click();
  await openPerson('Мария Соколова');
  await axeCheck('карточка сотрудника');
  await closeDrawer();
  await page.click('#theme');
  await axeCheck('обзор, тёмная тема');
  await page.click('#theme');
  ok('axe-core WCAG A/AA: серьёзных нарушений нет');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(150);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, 'нет горизонтального переполнения на 375px');
  assert.ok(await page.locator('.mobile-nav').isVisible());
  await openPerson('Мария Соколова');
  const box = await page.locator('#drawer').boundingBox();
  assert.ok(box.width <= 375);
  await closeDrawer();
  await page.setViewportSize({ width: 1440, height: 960 });
  ok('мобильная раскладка 375px без переполнения, карточка помещается');

  await fresh();
  await page.evaluate(() => localStorage.setItem('novichok.state.v1', '{broken'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.toast.warn');
  assert.deepEqual(await metricValues(), ['11', '4', '3', '4']);
  ok('повреждённое localStorage не ломает приложение');

  assert.deepEqual(errors, []);
  ok('нет ошибок JavaScript в консоли за все сценарии');

  fs.mkdirSync(path.join(__dirname, '..', 'docs'), { recursive: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await fresh();
  await page.screenshot({ path: path.join(__dirname, '..', 'docs', 'screenshot-light.png'), fullPage: false });
  await page.click('#theme');
  await page.screenshot({ path: path.join(__dirname, '..', 'docs', 'screenshot-dark.png'), fullPage: false });
  await page.click('#theme');

  console.log('\n' + results.length + ' браузерных сценариев пройдено.');
})().catch(async e => {
  console.error(e);
  if (page) await page.screenshot({ path: path.join(__dirname, '..', 'docs', 'failure.png'), fullPage: true }).catch(() => {});
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(r => server.close(r));
});
