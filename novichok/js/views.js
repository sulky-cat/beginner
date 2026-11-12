/* Рендер основных экранов. Возвращает HTML-строки; данные экранируются. */
(function (root) {
  'use strict';
  root.NV = root.NV || {};
  const C = root.NV.core, { esc, fmt, initials, plural, deptDot, icon } = root.NV;

  function statusHTML(e) {
    const st = C.stage(e), reasons = C.issues(e);
    if (st === 'future') return '<span class="badge neutral">' + icon('calendar') + 'Ещё не вышел</span>';
    if (st === 'finished') return '<span class="badge neutral">' + icon('check') + 'Первые 90 дней завершены</span>';
    if (reasons.length) return '<div class="status-list">' + reasons.map(r =>
      '<button class="badge warn" data-open="' + esc(e.id) + '" title="' + esc(r.detail) + '">' + icon('alert') + esc(r.label) + '</button>'
    ).join('') + '</div>';
    return '<button class="badge good" data-explain="' + esc(e.id) + '" aria-label="Почему нет незакрытых вопросов у ' + esc(e.name) + '?" title="Нажмите, чтобы увидеть расшифровку">' + icon('shield') + 'Нет незакрытых вопросов</button>';
  }

  function rowHTML(e, ui) {
    const d = C.day(e), pr = C.progress(e), st = C.stage(e);
    const stageText = st === 'future' ? 'Выход ' + fmt(e.start) : st === 'finished' ? d + ' ' + plural(d, ['день', 'дня', 'дней']) + ' в компании' : 'День ' + d + ' из 90';
    const checked = ui.selected.has(e.id);
    const drag = ui.sort === 'manual';
    return '<tr data-id="' + esc(e.id) + '" class="' + (checked ? 'selected' : '') + (drag ? ' draggable' : '') + '"' + (drag ? ' draggable="true"' : '') + '>' +
      '<td class="check-col"><input type="checkbox" class="row-check" data-check="' + esc(e.id) + '" aria-label="Выбрать: ' + esc(e.name) + '"' + (checked ? ' checked' : '') + '></td>' +
      (drag ? '<td class="grip-col" title="Перетащите, чтобы изменить порядок">' + icon('grip') + '</td>' : '<td class="grip-col"></td>') +
      '<td class="person-cell"><div class="person"><div class="avatar" aria-hidden="true">' + esc(initials(e.name)) + '</div><div><button class="person-btn" data-open="' + esc(e.id) + '">' + esc(e.name) + '</button><small>' + esc(e.role) + '</small></div></div></td>' +
      '<td class="dept-col"><span class="dept-chip" style="--dot:' + deptDot[e.department] + '">' + esc(e.department) + '</span></td>' +
      '<td class="stage-col"><div class="stage">' + stageText + '</div><div class="tiny muted">' + fmt(e.start) + ' ' + e.start.slice(0, 4) + '</div></td>' +
      '<td class="mentor-col">' + (e.mentor ? esc(e.mentor) : '<span class="warn-text">Не назначен</span>') + '</td>' +
      '<td class="progress-col"><div class="progress"><div class="track" aria-hidden="true"><span style="width:' + pr + '%"></span></div><span class="tiny mono">' + pr + '%</span></div><div class="tiny muted">' + C.doneCount(e) + ' из ' + e.tasks.length + ' шагов</div></td>' +
      '<td class="status-col">' + statusHTML(e) + '</td></tr>';
  }

  function metric(key, label, value, caption, iconName, tone, pressed) {
    return '<button class="metric reveal ' + tone + '" data-metric="' + key + '" aria-pressed="' + pressed + '">' +
      '<div class="metric-top"><span>' + label + '</span>' + icon(iconName) + '</div>' +
      '<div class="metric-value">' + value + '</div><div class="metric-caption">' + caption + '</div></button>';
  }

  function overviewHTML(state, ui) {
    const s = C.summary(state);
    const priority = state.employees.find(e => e.id === 'n01' && C.issues(e).length) || state.employees.find(e => C.issues(e).length);
    const attention = ui.view === 'attention';
    return '<div class="heading reveal"><div><div class="eyebrow">' + icon('spark') + 'Рабочее место HR / руководителя</div>' +
      '<h1>' + (attention ? 'Кому нужна помощь HR' : 'Первые 90 дней') + '</h1>' +
      '<p>' + (attention ? 'Только сотрудники, по которым есть конкретное незавершённое действие. Откройте карточку и закройте вопрос.' : 'Вовремя назначить наставника, выполнить шаг плана и ответить на просьбу о помощи — без скоринга людей и прогнозов увольнения.') + '</p></div>' +
      '<button class="btn primary" data-action="add">' + icon('plus') + 'Добавить новичка</button></div>' +
      '<section class="metrics" aria-label="Показатели адаптации">' +
      metric('active', 'В первые 90 дней', s.active, 'Уже вышли на работу', 'users', '', ui.filter === 'active') +
      metric('attention', 'Требуют внимания', s.attention, 'Сотрудников с незакрытым вопросом', 'alert', 'warn', ui.filter === 'attention') +
      metric('overdue', 'Просрочено шагов', s.overdue, 'Срок прошёл, выполнение не отмечено', 'clock', 'warn', ui.filter === 'overdue') +
      metric('today', 'Шагов на сегодня', s.today, '11 ноября · ещё не просрочка', 'calendar', 'info', ui.filter === 'today') +
      '</section>' +
      '<aside class="meaning reveal" aria-label="Объяснение статусов">' + icon('info') + '<div><strong>Что значит «Нет незакрытых вопросов»?</strong>' +
      '<p>Назначен наставник, нет просроченных невыполненных шагов, а в последней записи разговора не отмечена просьба о помощи. Будущие шаги могут быть ещё не выполнены. Это вывод только по карточке, а не оценка человека.</p>' +
      '<button class="btn ghost sm" data-action="guide">Подробнее о статусах ' + icon('arrow') + '</button></div></aside>' +
      (priority ? '<section class="priority reveal"><div class="priority-copy"><div class="priority-pulse">' + icon('alert') + '</div><div><strong>' + esc(priority.name) + ': ' + esc(C.issues(priority)[0].label.toLowerCase()) + '</strong><p>' + (C.issues(priority).length > 1 ? 'Всего вопросов: ' + C.issues(priority).length + '. Все причины видны в карточке.' : esc(C.issues(priority)[0].detail)) + '</p></div></div><button class="btn secondary" data-open="' + esc(priority.id) + '">Открыть карточку ' + icon('arrow') + '</button></section>' : '') +
      '<section class="list-panel reveal" aria-labelledby="list-title">' +
      '<div class="list-head"><h2 id="list-title">' + icon('table') + 'Сотрудники <span class="count-pill" id="result-count"></span></h2>' +
      '<div class="saved-views"><label class="sr-only" for="saved-view">Сохранённое представление</label><select id="saved-view"><option value="">Сохранённые представления</option></select>' +
      '<button class="icon-btn" data-action="save-view" title="Сохранить текущие фильтры" aria-label="Сохранить текущие фильтры">' + icon('bookmark') + '</button>' +
      '<button class="icon-btn" data-action="delete-view" title="Удалить выбранное представление" aria-label="Удалить выбранное представление">' + icon('trash') + '</button></div></div>' +
      '<div class="filters"><label class="search">' + icon('search') + '<span class="sr-only">Поиск по имени, должности, наставнику</span><input id="search" type="search" maxlength="100" placeholder="Имя, должность или наставник" value="' + esc(ui.search) + '"></label>' +
      '<label><span class="sr-only">Подразделение</span><select id="dept"><option value="">Все подразделения</option>' + C.DEPARTMENTS.map(d => '<option' + (ui.dept === d ? ' selected' : '') + '>' + d + '</option>').join('') + '</select></label>' +
      '<label><span class="sr-only">Сортировка</span><select id="sort"><option value="attention"' + (ui.sort === 'attention' ? ' selected' : '') + '>Сначала требующие внимания</option><option value="name"' + (ui.sort === 'name' ? ' selected' : '') + '>По имени</option><option value="day"' + (ui.sort === 'day' ? ' selected' : '') + '>По дню адаптации</option><option value="manual"' + (ui.sort === 'manual' ? ' selected' : '') + '>Ручной порядок (перетаскивание)</option></select></label></div>' +
      '<div class="tabs" role="group" aria-label="Фильтр списка" id="tabs"></div>' +
      '<div class="bulkbar" id="bulkbar" hidden><strong id="bulk-count"></strong><button class="btn sm danger" data-action="bulk-delete">' + icon('trash') + 'Удалить выбранных</button><button class="btn sm ghost" data-action="bulk-clear">Снять выделение</button><span class="tiny muted">Удаление можно отменить сразу после действия.</span></div>' +
      '<div class="table-wrap"><table id="employees"><thead><tr><th class="check-col"><input type="checkbox" id="check-all" aria-label="Выбрать всех в списке"></th><th class="grip-col"></th><th>Сотрудник</th><th class="dept-col">Подразделение</th><th>Этап</th><th class="mentor-col">Наставник</th><th>План</th><th>Статус / действие</th></tr></thead><tbody id="body"></tbody></table>' +
      '<div class="empty" id="empty" hidden>' + icon('search') + '<h3>Никого не найдено</h3><p>Измените поиск или фильтры. Сейчас в базе ' + state.employees.length + ' ' + plural(state.employees.length, ['сотрудник', 'сотрудника', 'сотрудников']) + '.</p><button class="btn secondary" data-action="clear" style="margin-top:14px">Сбросить фильтры</button></div></div>' +
      '<div class="table-foot"><span id="table-count"></span><span>Счётчики сверху относятся ко всему демо, а не к результатам поиска.</span></div></section>';
  }

  function guideHTML() {
    return '<div class="heading reveal"><div><div class="eyebrow">' + icon('book') + 'Памятка проверяющему</div><h1>Как читать статусы и что нажимать</h1><p>Короткая проверка основного сценария, объяснение цифр и честные ограничения прототипа.</p></div><button class="btn primary" data-action="export">' + icon('download') + 'Скачать данные JSON</button></div>' +
      '<div class="guide-grid">' +
      '<section class="panel reveal"><h2>' + icon('shield') + 'Что значит «Нет незакрытых вопросов»</h2><p>По данным карточки одновременно: <strong>назначен наставник</strong>, <strong>нет просроченных невыполненных шагов</strong>, <strong>в последней записи разговора не отмечена просьба о помощи</strong>.</p><p>Это не значит, что план выполнен на 100% или у человека точно всё хорошо. Если разговора ещё не было, сведений о просьбе просто нет.</p><div class="guide-line"><strong>Пример: Анна Ладина</strong><p>5 из 8 шагов — 63%. Наставник назначен, просрочек нет, просьбы о помощи в последней записи нет. Остальные шаги запланированы на будущее.</p></div><p class="tiny">Проверки действуют с 1-го по 90-й день включительно. Срок «сегодня» ещё не просрочка.</p></section>' +
      '<section class="panel reveal"><h2>' + icon('alert') + 'Когда требуется действие</h2><table class="status-table"><thead><tr><th>Надпись</th><th>Что сделать</th></tr></thead><tbody>' +
      '<tr><td><strong>Назначить наставника</strong></td><td>Открыть карточку, указать имя и нажать «Назначить».</td></tr>' +
      '<tr><td><strong>Закрыть просроченные шаги: N</strong></td><td>Разобраться в причине, выполнить шаг и только затем поставить отметку.</td></tr>' +
      '<tr><td><strong>Обсудить просьбу о помощи</strong></td><td>Обсудить вопрос и записать новый итог разговора.</td></tr>' +
      '<tr><td><strong>Ещё не вышел</strong></td><td>План создан; проверки начнутся в день выхода.</td></tr>' +
      '<tr><td><strong>Первые 90 дней завершены</strong></td><td>Автоматические проверки ограничены первыми 90 днями.</td></tr>' +
      '</tbody></table><p class="tiny">Несколько вопросов у одного сотрудника показываются отдельно, но в счётчике «Требуют внимания» он считается один раз.</p></section>' +
      '<section class="panel reveal"><h2>' + icon('check') + 'Проверка за 2–3 минуты</h2><ol><li>Откройте «Требуют внимания»: в исходном демо <strong>4</strong> сотрудника.</li><li>Откройте <strong>Марию Соколову</strong>: не назначен наставник и просрочен 1 шаг.</li><li>Назначьте <strong>Ольгу Кедрову</strong>. Мария останется в списке из-за шага.</li><li>Отметьте «Познакомиться с кассой и правилами возврата» выполненным. Мария исчезнет из списка: счётчик <strong>4 → 3</strong>.</li><li>Откройте <strong>Илью Горина</strong>, выберите «Вопросы решены», запишите итог. Счётчик <strong>3 → 2</strong>.</li><li>Обновите страницу: изменения сохранятся в браузере. Для переноса скачайте JSON.</li></ol></section>' +
      '<section class="panel reveal"><h2>' + icon('users') + 'Цифры исходного демо</h2><p><strong>12</strong> сотрудников в списке, <strong>11</strong> в первые 90 дней, <strong>4</strong> требуют внимания, <strong>3</strong> просроченных шага, <strong>4</strong> шага со сроком сегодня.</p><p>Максим Речнов выйдет 13 ноября и пока не входит в первые 90 дней. План — доля выполненных шагов из восьми, включая будущие; это не оценка качества работы.</p><p>Поиск, фильтры и сортировка меняют список, но не общие счётчики. Есть ручная сортировка перетаскиванием, массовое удаление с отменой и сохранённые представления.</p></section>' +
      '<section class="panel reveal"><h2>' + icon('download') + 'Данные и сохранение</h2><p>Изменения автоматически сохраняются в localStorage этого браузера. Если хранилище недоступно, приложение предупредит и будет работать только в памяти.</p><p><strong>JSON</strong> — резервная копия и способ переноса. Импорт проверяет формат и заменяет данные после подтверждения. Любое заменяющее действие можно отменить кнопкой «Отменить».</p><div class="guide-actions"><button class="btn secondary" data-action="export">' + icon('download') + 'Скачать JSON</button><button class="btn secondary" data-action="import">' + icon('upload') + 'Загрузить JSON</button><button class="btn ghost" data-action="reset">' + icon('undo') + 'Вернуть исходное демо</button></div></section>' +
      '<section class="panel reveal"><h2>' + icon('info') + 'Честные ограничения</h2><p>Демо-дата зафиксирована: <strong>11 ноября 2026</strong>. Все сотрудники и разговоры вымышлены.</p><p>Нет подключения к Битрикс24, уведомлений, сервера, авторизации и совместной работы. Итог разговора записывает HR или руководитель, а не сам новичок.</p><p>Это список рабочих вопросов, а не рейтинг человека и не прогноз увольнения. Отсутствие вопросов в карточке не заменяет личного разговора. Не используйте реальные персональные данные.</p></section>' +
      '</div>';
  }

  root.NV.views = { statusHTML, rowHTML, overviewHTML, guideHTML };
})(typeof globalThis !== 'undefined' ? globalThis : this);
