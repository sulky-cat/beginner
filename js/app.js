/* Контроллер приложения: состояние, маршрутизация в hash, события, undo, импорт/экспорт. */
(function () {
  'use strict';
  const C = NV.core, store = NV.store, { esc, fmt, uid, download, clone, icon, plural } = NV;
  const $ = (s, e) => (e || document).querySelector(s);
  const $$ = (s, e) => Array.from((e || document).querySelectorAll(s));

  const loaded = store.load();
  let state = loaded.state;
  const undo = store.createUndo();
  const prefs = store.prefs();
  let ui = { view: 'overview', filter: 'all', dept: '', search: '', sort: 'attention', selected: new Set(), savedViewId: '' };
  let selectedId = null, drawerMessage = '', priorFocus = null, confirmCb = null, dragId = null;
  let theme = prefs.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  /* ---------- тема, служебные индикаторы ---------- */
  function setTheme() {
    document.documentElement.dataset.theme = theme;
    $('#theme').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
    $('#theme').setAttribute('aria-label', theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
  }
  function saveState() {
    store.trimLogs(state);
    const ok = store.save(state);
    const el = $('#save-state');
    el.className = 'save-state' + (ok ? '' : ' memory');
    el.innerHTML = ok ? icon('check') + 'Сохранено в браузере' : icon('alert') + 'Только в памяти';
    $('#undo').disabled = undo.size() === 0;
  }
  function toast(text, type, actionLabel, action) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'ok');
    el.innerHTML = icon(type === 'error' ? 'alert' : type === 'warn' ? 'info' : 'check') + '<p>' + esc(text) + '</p>' +
      (actionLabel ? '<button class="btn sm secondary toast-action">' + esc(actionLabel) + '</button>' : '') +
      '<button class="icon-btn toast-close" aria-label="Закрыть уведомление">' + icon('close') + '</button>';
    $('#toasts').append(el);
    const remove = () => { el.classList.add('leaving'); setTimeout(() => el.remove(), 180); };
    const timer = setTimeout(remove, actionLabel ? 9000 : 5000);
    $('.toast-close', el).addEventListener('click', () => { clearTimeout(timer); remove(); });
    if (actionLabel) $('.toast-action', el).addEventListener('click', () => { clearTimeout(timer); remove(); action(); });
  }

  /* ---------- URL ---------- */
  function url() {
    const p = new URLSearchParams({ view: ui.view, filter: ui.filter, sort: ui.sort });
    if (ui.dept) p.set('department', ui.dept);
    if (ui.search) p.set('q', ui.search);
    if (ui.savedViewId) p.set('saved', ui.savedViewId);
    if (selectedId) p.set('person', selectedId);
    try { history.replaceState(null, '', '#' + p.toString()); } catch { /* file:// или песочница могут запрещать replaceState */ }
  }
  function readUrl() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (['overview', 'attention', 'guide'].includes(p.get('view'))) ui.view = p.get('view');
    if (['all', 'active', 'attention', 'today', 'overdue'].includes(p.get('filter'))) ui.filter = p.get('filter');
    if (C.DEPARTMENTS.includes(p.get('department'))) ui.dept = p.get('department');
    ui.search = (p.get('q') || '').slice(0, 100);
    if (['attention', 'name', 'day', 'manual'].includes(p.get('sort'))) ui.sort = p.get('sort');
    ui.savedViewId = p.get('saved') || '';
    return p.get('person');
  }

  /* ---------- список ---------- */
  function baseList() {
    const q = ui.search.trim().toLowerCase();
    return state.employees.filter(e => {
      if (ui.view === 'attention' && !C.issues(e).length) return false;
      if (ui.dept && e.department !== ui.dept) return false;
      if (q && !(e.name + ' ' + e.role + ' ' + e.mentor).toLowerCase().includes(q)) return false;
      return true;
    });
  }
  function matchesFilter(e, f) {
    if (f === 'active') return C.active(e);
    if (f === 'attention') return C.issues(e).length > 0;
    if (f === 'overdue') return C.active(e) && e.tasks.some(t => C.overdue(e, t));
    if (f === 'today') return C.active(e) && e.tasks.some(t => C.dueToday(e, t));
    return true;
  }
  function list() {
    const a = baseList().filter(e => matchesFilter(e, ui.filter));
    if (ui.sort === 'name') a.sort((x, y) => x.name.localeCompare(y.name, 'ru'));
    else if (ui.sort === 'day') a.sort((x, y) => C.day(y) - C.day(x));
    else if (ui.sort === 'attention') a.sort((x, y) => C.issues(y).length - C.issues(x).length || x.name.localeCompare(y.name, 'ru'));
    return a;
  }
  function renderTabs() {
    const base = baseList();
    const defs = [['all', 'Все'], ['active', 'В первые 90 дней'], ['attention', 'Требуют внимания'], ['today', 'Шаги сегодня'], ['overdue', 'Просрочки']];
    $('#tabs').innerHTML = defs.map(([f, label]) => {
      const n = base.filter(e => matchesFilter(e, f)).length;
      return '<button class="tab" data-filter="' + f + '" aria-pressed="' + (ui.filter === f) + '">' + label + '<span class="n">' + n + '</span></button>';
    }).join('');
  }
  function renderRows() {
    const a = list();
    $('#body').innerHTML = a.map(e => NV.views.rowHTML(e, ui)).join('');
    $('#employees').hidden = !a.length;
    $('#empty').hidden = !!a.length;
    $('#result-count').textContent = String(a.length);
    $('#table-count').textContent = 'Показано ' + a.length + ' из ' + state.employees.length + ' ' + plural(state.employees.length, ['сотрудника', 'сотрудников', 'сотрудников']);
    const visibleIds = a.map(e => e.id);
    const selectedVisible = visibleIds.filter(id => ui.selected.has(id));
    const all = $('#check-all');
    all.checked = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
    all.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleIds.length;
    $('#bulkbar').hidden = ui.selected.size === 0;
    $('#bulk-count').textContent = 'Выбрано: ' + ui.selected.size;
    $$('.metric').forEach(m => m.setAttribute('aria-pressed', String(m.dataset.metric === ui.filter)));
    renderTabs();
  }
  function renderSavedViews() {
    const sel = $('#saved-view');
    if (!sel) return;
    const views = store.views();
    sel.innerHTML = '<option value="">Сохранённые представления</option>' + views.map(v => '<option value="' + esc(v.id) + '"' + (v.id === ui.savedViewId ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('');
  }
  function render() {
    const s = C.summary(state);
    $('#nav-total').textContent = String(s.active);
    $('#nav-attention').textContent = String(s.attention);
    $$('[data-nav]').forEach(b => b.setAttribute('aria-current', b.dataset.nav === ui.view ? 'page' : 'false'));
    $('#breadcrumb').textContent = { overview: 'Обзор', attention: 'Требуют внимания', guide: 'Инструкция' }[ui.view];
    if (ui.view === 'guide') { $('#view').innerHTML = NV.views.guideHTML(); return; }
    $('#view').innerHTML = NV.views.overviewHTML(state, ui);
    $('#search').addEventListener('input', e => { ui.search = e.target.value; ui.savedViewId = ''; renderRows(); url(); });
    $('#dept').addEventListener('change', e => { ui.dept = e.target.value; ui.savedViewId = ''; renderRows(); url(); });
    $('#sort').addEventListener('change', e => { ui.sort = e.target.value; ui.savedViewId = ''; renderRows(); url(); });
    $('#saved-view').addEventListener('change', e => {
      const v = store.views().find(x => x.id === e.target.value);
      if (!v) { ui.savedViewId = ''; url(); return; }
      ui = { ...ui, view: v.view, filter: v.filter, dept: v.dept, search: v.search, sort: v.sort, savedViewId: v.id, selected: new Set() };
      render(); url();
    });
    $('#check-all').addEventListener('change', e => {
      const ids = list().map(x => x.id);
      if (e.target.checked) ids.forEach(id => ui.selected.add(id)); else ids.forEach(id => ui.selected.delete(id));
      renderRows();
    });
    renderSavedViews();
    renderRows();
  }

  /* ---------- мутации ---------- */
  function mutate(label, fn, opts) {
    undo.push(state, label);
    fn();
    saveState();
    render();
    if (selectedId) renderDrawer(true);
    url();
    if (opts && opts.toast) toast(opts.toast, opts.type || 'ok', opts.undoable === false ? null : 'Отменить', doUndo);
  }
  function doUndo() {
    const item = undo.pop();
    if (!item) return;
    state = item.snapshot;
    ui.selected.clear();
    if (selectedId && !state.employees.some(e => e.id === selectedId)) closeDrawer(false);
    saveState(); render(); if (selectedId) renderDrawer(true); url();
    toast('Отменено: ' + item.label, 'ok');
  }
  function find(id) { return state.employees.find(e => e.id === id); }
  function log(e, text) { e.history.push({ date: C.TODAY, text }); }

  /* ---------- drawer ---------- */
  function renderDrawer(preserve) {
    const e = find(selectedId);
    if (!e) return;
    const dialog = $('#drawer');
    const scroll = $('.drawer-body', dialog) ? $('.drawer-body', dialog).scrollTop : 0;
    const activeTask = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.task : null;
    dialog.innerHTML = NV.drawer.drawerHTML(e, drawerMessage);
    $('#mentor-form', dialog).addEventListener('submit', ev => {
      ev.preventDefault();
      const value = $('#mentor', dialog).value.trim();
      if (value.length > 100) { drawerMessage = 'Имя наставника: не больше 100 символов.'; renderDrawer(true); return; }
      if (value === e.mentor) { drawerMessage = 'Наставник не изменился.'; renderDrawer(true); return; }
      mutate('Изменение наставника', () => {
        e.mentor = value;
        log(e, value ? 'Назначен наставник: ' + value : 'Наставник снят');
        drawerMessage = value ? 'Наставник назначен. Остальные вопросы, если они есть, показаны выше.' : 'Наставник снят. Требуется назначить нового.';
      }, { undoable: false });
    });
    $('#checkin', dialog).addEventListener('submit', ev => {
      ev.preventDefault();
      const f = new FormData(ev.target), note = String(f.get('note') || '').trim();
      if (note.length < 5) { $('#checkin-error', dialog).textContent = 'Добавьте хотя бы 5 символов об итогах разговора.'; return; }
      const needsHelp = f.get('status') === 'help';
      mutate('Запись разговора', () => {
        e.checkins.push({ date: C.TODAY, needsHelp, note });
        log(e, needsHelp ? 'Записан разговор: нужна помощь' : 'Записан разговор: вопросы решены');
        drawerMessage = needsHelp ? 'Разговор записан. Нужно обсудить просьбу о помощи.' : 'Разговор записан. Просьба о помощи больше не требует действия.';
      }, { undoable: false });
      const msg = $('#drawer-message', dialog); if (msg) msg.scrollIntoView({ block: 'nearest' });
    });
    if (preserve) {
      $('.drawer-body', dialog).scrollTop = scroll;
      if (activeTask) { const b = $('[data-task="' + activeTask + '"]', dialog); if (b) b.focus({ preventScroll: true }); }
    }
  }
  function openDrawer(id, explain) {
    const e = find(id); if (!e) return;
    priorFocus = document.activeElement;
    selectedId = id; drawerMessage = '';
    renderDrawer(false);
    const dialog = $('#drawer');
    if (!dialog.open) dialog.showModal();
    $('.drawer-body', dialog).scrollTop = 0;
    $('[data-close-drawer]', dialog).focus();
    if (explain) { const box = $('#status-explanation', dialog); if (box) box.scrollIntoView({ block: 'start' }); }
    url();
  }
  function closeDrawer(update) {
    const dialog = $('#drawer');
    if (dialog.open) dialog.close();
    selectedId = null; drawerMessage = '';
    if (priorFocus && priorFocus.isConnected) priorFocus.focus(); else $('#main').focus();
    if (update !== false) url();
  }
  $('#drawer').addEventListener('cancel', e => { e.preventDefault(); closeDrawer(); });
  $('#drawer').addEventListener('close', () => { if (selectedId) { selectedId = null; drawerMessage = ''; url(); } });
  $('#drawer').addEventListener('click', e => { if (e.target === $('#drawer')) closeDrawer(); });

  /* ---------- модальные окна ---------- */
  function openModal(id) { const d = $(id); if (!d.open) d.showModal(); }
  function closeModal(d) { if (d.open) d.close(); }
  $$('dialog.modal').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) closeModal(d); });
    $$('[data-close-modal]', d).forEach(b => b.addEventListener('click', () => closeModal(d)));
  });
  function confirmAction(title, text, okLabel, danger, cb) {
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    const ok = $('#confirm-ok');
    ok.textContent = okLabel;
    ok.className = 'btn ' + (danger ? 'danger' : 'primary');
    confirmCb = cb;
    openModal('#confirm-modal');
    ok.focus();
  }
  $('#confirm-ok').addEventListener('click', () => { const cb = confirmCb; confirmCb = null; closeModal($('#confirm-modal')); if (cb) cb(); });

  function openEmployeeModal(id) {
    const form = $('#employee-form');
    form.reset(); $('#employee-error').textContent = '';
    if (id) {
      const e = find(id); if (!e) return;
      $('#employee-title').textContent = 'Редактировать сотрудника';
      $('#employee-submit').textContent = 'Сохранить';
      form.elements.id.value = e.id; form.elements.name.value = e.name; form.elements.department.value = e.department;
      form.elements.start.value = e.start; form.elements.role.value = e.role; form.elements.mentor.value = e.mentor;
    } else {
      $('#employee-title').textContent = 'Новый сотрудник';
      $('#employee-submit').textContent = 'Создать план';
      form.elements.id.value = ''; form.elements.start.value = C.TODAY;
    }
    openModal('#employee-modal');
    form.elements.name.focus();
  }
  $('#employee-form').addEventListener('submit', ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    try {
      if (f.id) {
        const e = find(f.id); if (!e) throw Error('Сотрудник не найден');
        const next = C.create(f, e.id);
        const events = e.tasks.filter(t => t.done).map(t => t.completedAt).concat(e.checkins.map(c => c.date));
        if (events.some(d => d < next.start)) throw Error('Дата выхода не может быть позже уже записанных событий');
        mutate('Редактирование сотрудника', () => {
          const oldDept = e.department;
          e.name = next.name; e.role = next.role; e.start = next.start; e.mentor = next.mentor;
          if (oldDept !== f.department) {
            const old = new Map(e.tasks.map(t => [t.id, t]));
            e.department = f.department;
            e.tasks = C.template(f.department).map(t => { const o = old.get(t.id); return o ? { ...t, done: o.done, completedAt: o.completedAt } : t; });
          }
          log(e, 'Изменены данные сотрудника');
        }, { toast: 'Данные сотрудника обновлены.' });
      } else {
        if (state.employees.length >= C.LIMITS.employees) throw Error('В демо не больше ' + C.LIMITS.employees + ' сотрудников');
        const e = C.create(f, uid());
        mutate('Добавление сотрудника', () => { log(e, 'Создан план адаптации'); state.employees.push(e); }, { toast: 'Сотрудник добавлен, план создан.' });
        ui.view = 'overview'; ui.filter = 'all'; ui.dept = ''; ui.search = ''; ui.selected.clear();
        render(); openDrawer(e.id);
      }
      closeModal($('#employee-modal'));
    } catch (error) { $('#employee-error').textContent = error.message; }
  });

  /* ---------- импорт / экспорт / сброс ---------- */
  function exportJSON() { download('novichok-data.json', JSON.stringify(state, null, 2), 'application/json'); toast('JSON-копия данных скачана.'); }
  $('#import').addEventListener('change', async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      if (f.size > 2 * 1024 * 1024) throw Error('Файл больше 2 МБ');
      const next = C.validate(JSON.parse(await f.text()));
      confirmAction('Загрузить данные?', 'Текущие данные будут заменены. Действие можно отменить сразу после загрузки.', 'Заменить', false, () => {
        mutate('Импорт данных', () => { state = next; ui.selected.clear(); if (selectedId) closeDrawer(false); }, { toast: 'Данные проверены и загружены.' });
      });
    } catch (error) { toast('Не удалось загрузить данные: ' + error.message, 'error'); }
    finally { ev.target.value = ''; }
  });
  function resetDemo() {
    confirmAction('Вернуть исходное демо?', 'Текущие изменения будут заменены исходными 12 сотрудниками. Действие можно отменить.', 'Вернуть демо', true, () => {
      mutate('Сброс к демо', () => { state = NV.seed(); ui.selected.clear(); if (selectedId) closeDrawer(false); }, { toast: 'Исходные данные восстановлены: 12 сотрудников, 4 требуют внимания.' });
    });
  }

  /* ---------- сохранённые представления ---------- */
  $('#view-form').addEventListener('submit', ev => {
    ev.preventDefault();
    const name = String(new FormData(ev.target).get('name') || '').trim();
    if (!name) { $('#view-error').textContent = 'Введите название.'; return; }
    const views = store.views();
    const v = { id: uid(), name, view: ui.view, filter: ui.filter, dept: ui.dept, search: ui.search, sort: ui.sort };
    views.push(v); store.setViews(views); ui.savedViewId = v.id;
    closeModal($('#view-modal')); render(); url(); toast('Представление сохранено.');
  });
  function deleteView() {
    const v = store.views().find(x => x.id === ui.savedViewId);
    if (!v) { toast('Сначала выберите сохранённое представление.', 'warn'); return; }
    confirmAction('Удалить представление?', '«' + v.name + '» будет удалено. Данные сотрудников не изменятся.', 'Удалить', true, () => {
      store.setViews(store.views().filter(x => x.id !== v.id)); ui.savedViewId = ''; render(); url(); toast('Представление удалено.');
    });
  }

  /* ---------- навигация и делегированные клики ---------- */
  function navigate(to) {
    if ($('#drawer').open) closeDrawer(false);
    ui.view = to; ui.filter = to === 'attention' ? 'attention' : 'all'; ui.dept = ''; ui.search = ''; ui.selected.clear(); ui.savedViewId = '';
    render(); url();
  }
  $$('[data-nav]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.nav)));
  $('#theme').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; store.setPrefs({ ...store.prefs(), theme }); setTheme(); });
  $('#undo').addEventListener('click', doUndo);

  document.addEventListener('click', ev => {
    const t = ev.target;
    const explain = t.closest('[data-explain]'); if (explain) { openDrawer(explain.dataset.explain, true); return; }
    const open = t.closest('[data-open]'); if (open) { openDrawer(open.dataset.open); return; }
    if (t.closest('[data-close-drawer]')) { closeDrawer(); return; }
    const task = t.closest('[data-task]');
    if (task && selectedId) {
      const e = find(selectedId), step = e.tasks.find(x => x.id === task.dataset.task);
      mutate('Отметка шага', () => {
        step.done = !step.done; step.completedAt = step.done ? C.TODAY : null;
        log(e, (step.done ? 'Выполнен шаг: ' : 'Отменено выполнение: ') + step.title);
        drawerMessage = step.done ? 'Шаг отмечен выполненным. Список требуемых действий обновлён.' : 'Выполнение отменено. Проверьте, не стал ли шаг просроченным.';
      }, { undoable: false });
      return;
    }
    const check = t.closest('[data-check]');
    if (check) { const id = check.dataset.check; if (check.checked) ui.selected.add(id); else ui.selected.delete(id); renderRows(); return; }
    const tab = t.closest('[data-filter]'); if (tab) { ui.filter = tab.dataset.filter; ui.savedViewId = ''; renderRows(); url(); return; }
    const metric = t.closest('[data-metric]'); if (metric) { ui.view = 'overview'; ui.filter = metric.dataset.metric; ui.dept = ''; ui.search = ''; ui.selected.clear(); ui.savedViewId = ''; render(); url(); return; }
    const a = t.closest('[data-action]'); if (!a) return;
    switch (a.dataset.action) {
      case 'guide': navigate('guide'); break;
      case 'clear': ui.filter = 'all'; ui.dept = ''; ui.search = ''; ui.savedViewId = ''; render(); url(); break;
      case 'add': openEmployeeModal(); break;
      case 'edit': openEmployeeModal(a.dataset.id || selectedId); break;
      case 'delete': {
        const id = a.dataset.id || selectedId, e = find(id); if (!e) break;
        confirmAction('Удалить сотрудника?', e.name + ' будет удалён из демо. Действие можно отменить сразу после удаления.', 'Удалить', true, () => {
          mutate('Удаление сотрудника', () => { state.employees = state.employees.filter(x => x.id !== id); ui.selected.delete(id); if (selectedId === id) closeDrawer(false); }, { toast: e.name + ' удалён(а).' });
        });
        break;
      }
      case 'bulk-delete': {
        const ids = Array.from(ui.selected); if (!ids.length) break;
        confirmAction('Удалить выбранных?', 'Будет удалено: ' + ids.length + '. Действие можно отменить сразу после удаления.', 'Удалить', true, () => {
          mutate('Массовое удаление', () => { state.employees = state.employees.filter(x => !ui.selected.has(x.id)); if (selectedId && ui.selected.has(selectedId)) closeDrawer(false); ui.selected.clear(); }, { toast: 'Удалено: ' + ids.length + '.' });
        });
        break;
      }
      case 'bulk-clear': ui.selected.clear(); renderRows(); break;
      case 'export': exportJSON(); break;
      case 'import': $('#import').click(); break;
      case 'reset': resetDemo(); break;
      case 'save-view': $('#view-form').reset(); $('#view-error').textContent = ''; openModal('#view-modal'); $('#view-form').elements.name.focus(); break;
      case 'delete-view': deleteView(); break;
    }
  });

  /* ---------- перетаскивание в ручном порядке ---------- */
  document.addEventListener('dragstart', e => {
    const tr = e.target.closest('tr[draggable=true]'); if (!tr) return;
    dragId = tr.dataset.id; tr.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId);
  });
  document.addEventListener('dragover', e => {
    const tr = e.target.closest('tr[draggable=true]'); if (!tr || !dragId || tr.dataset.id === dragId) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    $$('.drag-over').forEach(x => x.classList.remove('drag-over')); tr.classList.add('drag-over');
  });
  document.addEventListener('drop', e => {
    const tr = e.target.closest('tr[draggable=true]'); if (!tr || !dragId) return;
    e.preventDefault();
    const targetId = tr.dataset.id;
    if (targetId !== dragId) {
      mutate('Изменение порядка', () => {
        const from = state.employees.findIndex(x => x.id === dragId), to = state.employees.findIndex(x => x.id === targetId);
        const [moved] = state.employees.splice(from, 1); state.employees.splice(to, 0, moved);
      }, { toast: 'Порядок изменён.', undoable: false });
    }
    dragId = null; $$('.drag-over,.dragging').forEach(x => x.classList.remove('drag-over', 'dragging'));
  });
  document.addEventListener('dragend', () => { dragId = null; $$('.drag-over,.dragging').forEach(x => x.classList.remove('drag-over', 'dragging')); });

  /* ---------- клавиатура ---------- */
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.matches('input,textarea')) { e.preventDefault(); doUndo(); }
  });

  /* ---------- старт ---------- */
  setTheme();
  const person = readUrl();
  render();
  saveState();
  if (person && find(person)) openDrawer(person);
  url();
  if (loaded.error) toast('Сохранённые данные повреждены, загружено исходное демо: ' + loaded.error, 'warn');
  else if (loaded.restored) toast('Открыта сохранённая копия в этом браузере.');
  if (store.isMemoryOnly()) toast('localStorage недоступен: изменения живут только до закрытия страницы. Сохраняйте JSON.', 'warn');
})();
