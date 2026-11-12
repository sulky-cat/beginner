/* Рендер карточки сотрудника (drawer). */
(function (root) {
  'use strict';
  root.NV = root.NV || {};
  const C = root.NV.core, { esc, fmt, fmtFull, initials, plural, icon } = root.NV;

  function taskHTML(e, t) {
    const late = C.overdue(e, t), today = C.dueToday(e, t), due = C.due(e, t);
    const owner = t.owner === 'Наставник' ? (e.mentor || 'Наставник не назначен') : t.owner;
    const timing = t.done ? 'Выполнено ' + fmt(t.completedAt) : late ? 'Просрочено на ' + C.days(due, C.TODAY) + ' ' + plural(C.days(due, C.TODAY), ['день', 'дня', 'дней']) : today ? 'Срок сегодня' : 'Срок ' + fmt(due);
    return '<div class="task' + (late ? ' late' : today ? ' today' : '') + '">' +
      '<button class="task-btn" data-task="' + esc(t.id) + '" aria-pressed="' + t.done + '" aria-label="' + (t.done ? 'Отменить выполнение' : 'Отметить выполненным') + ': ' + esc(t.title) + '">' + (t.done ? icon('check') : '') + '</button>' +
      '<div class="task-copy' + (t.done ? ' done' : '') + '"><div class="task-name">' + esc(t.title) + '</div>' +
      '<div class="task-meta"><span>' + esc(owner) + '</span><span class="' + (late ? 'warn-text' : today ? 'ok-text' : '') + '">' + timing + '</span><span>День ' + (t.offset + 1) + '</span></div></div></div>';
  }

  function drawerHTML(e, message) {
    const reasons = C.issues(e), last = e.checkins[e.checkins.length - 1], d = C.day(e), st = C.stage(e);
    let explanation;
    if (reasons.length) {
      explanation = '<div class="issue-box"><h3>' + icon('alert') + 'Что нужно сделать</h3>' + reasons.map(r => '<div class="issue-item"><strong>' + esc(r.label) + '</strong><p>' + esc(r.detail) + '</p></div>').join('') + '</div>';
    } else if (st !== 'active') {
      explanation = '<div class="note-box"><strong>' + (st === 'future' ? 'Сотрудник ещё не вышел' : 'Первые 90 дней завершены') + '</strong><p class="small muted" style="margin-top:4px">' + (st === 'future' ? 'План подготовлен. Проверка вопросов начнётся в день выхода.' : 'Автоматические проверки в этом прототипе ограничены первыми 90 днями.') + '</p></div>';
    } else {
      explanation = '<div class="good-box" id="status-explanation"><h3>' + icon('shield') + 'Нет незакрытых вопросов — что это значит</h3>' +
        '<p>✓ Наставник назначен: ' + esc(e.mentor) + '.</p><p>✓ Нет невыполненных шагов, у которых уже прошёл срок.</p>' +
        '<p>✓ ' + (last ? 'В последней записи разговора не отмечена просьба о помощи.' : 'Разговор пока не записан: сведений о просьбе о помощи нет.') + '</p>' +
        '<p class="muted">План выполнен на ' + C.progress(e) + '%, а не обязательно целиком. Этот статус не заменяет разговор с человеком.</p></div>';
    }
    const timeline = e.tasks.map(t => '<span class="' + (t.done ? 'done' : C.overdue(e, t) ? 'late' : C.dueToday(e, t) ? 'today' : '') + '" title="' + esc(t.title) + '"></span>').join('');
    return '<div class="drawer-top"><span class="tiny muted">Карточка адаптации · ' + esc(e.id.toUpperCase()) + '</span><button class="icon-btn" data-close-drawer aria-label="Закрыть карточку">' + icon('close') + '</button></div>' +
      '<div class="drawer-body"><div class="person-title"><div class="avatar" aria-hidden="true">' + esc(initials(e.name)) + '</div><div><h2 id="drawer-name">' + esc(e.name) + '</h2><p>' + esc(e.role) + ' · ' + esc(e.department) + '</p></div></div>' +
      '<dl class="metadata"><div><dt>Дата выхода</dt><dd>' + fmtFull(e.start) + '</dd></div><div><dt>Этап</dt><dd>' + (st === 'future' ? 'Ещё не вышел' : st === 'finished' ? 'Первые 90 дней завершены' : 'День ' + d + ' из 90') + '</dd></div></dl>' +
      (message ? '<div id="drawer-message" role="status" class="inline">' + esc(message) + '</div>' : '') + explanation +
      '<div class="drawer-actions"><button class="btn secondary sm" data-action="edit" data-id="' + esc(e.id) + '">' + icon('edit') + 'Редактировать</button><button class="btn danger sm" data-action="delete" data-id="' + esc(e.id) + '">' + icon('trash') + 'Удалить</button></div>' +
      '<form id="mentor-form" class="mentor-form"><label class="field">Наставник<input id="mentor" name="mentor" list="mentors" value="' + esc(e.mentor) + '" maxlength="100" placeholder="Выберите или введите имя" autocomplete="off"><datalist id="mentors">' + C.MENTORS[e.department].map(n => '<option value="' + esc(n) + '"></option>').join('') + '</datalist></label><button class="btn secondary" type="submit">Назначить</button></form>' +
      '<section class="drawer-section"><div class="section-row"><h3>' + icon('check') + 'План адаптации</h3><span class="small muted mono">' + C.doneCount(e) + ' из ' + e.tasks.length + ' · ' + C.progress(e) + '%</span></div>' +
      '<div class="timeline" aria-hidden="true">' + timeline + '</div>' +
      '<p class="tiny muted">Процент считается по всему плану, включая будущие шаги. Это не оценка сотрудника. Отмечайте только фактически выполненное.</p>' +
      e.tasks.map(t => taskHTML(e, t)).join('') + '</section>' +
      '<section class="drawer-section"><h3>' + icon('chat') + 'Разговор с новичком</h3><p class="small muted">HR или руководитель записывает итог разговора. Приложение не опрашивает сотрудника самостоятельно.</p>' +
      (last ? '<div class="last-note"><span class="tiny muted">Последняя запись · ' + fmt(last.date) + '</span><p><strong>' + (last.needsHelp ? 'Нужна помощь' : 'Вопросы решены / всё понятно') + '</strong></p><p>' + esc(last.note) + '</p></div>' : '<p class="small muted">Разговор пока не записан. Отсутствие просьбы о помощи в системе не означает, что трудностей нет.</p>') +
      '<form id="checkin" class="form-stack"><fieldset><legend>Итог разговора</legend><div class="radios"><label class="radio"><input type="radio" name="status" value="help" required>Нужна помощь</label><label class="radio"><input type="radio" name="status" value="ok" required>Вопросы решены</label></div></fieldset>' +
      '<label class="field">О чём договорились<textarea name="note" required minlength="5" maxlength="1000" placeholder="Что обсудили и кто что сделает дальше"></textarea></label>' +
      '<p id="checkin-error" class="error" role="alert"></p><button class="btn secondary" type="submit">Записать итог разговора</button></form></section>' +
      '<section class="drawer-section"><h3>' + icon('clock') + 'История изменений</h3><div class="history">' + (e.history.length ? e.history.slice(-12).reverse().map(h => '<div><time>' + fmt(h.date) + ' · демо-дата</time>' + esc(h.text) + '</div>').join('') : '<p class="small muted">Здесь появятся ваши действия.</p>') + '</div></section></div>';
  }

  root.NV.drawer = { drawerHTML, taskHTML };
})(typeof globalThis !== 'undefined' ? globalThis : this);
