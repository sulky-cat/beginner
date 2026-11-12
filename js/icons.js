/* Inline SVG-иконки (stroke, currentColor). Никаких внешних запросов. */
(function (root) {
  'use strict';
  root.NV = root.NV || {};
  const paths = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    moon: '<path d="M21 13A9 9 0 0 1 11 3 9 9 0 1 0 21 13Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 5.5a3.5 3.5 0 0 1 0 6.6M18 14.7c2.1.6 3.3 2.3 3.7 5.3"/>',
    alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9.5v4.5m0 3v.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4m8-4v4"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21V5.5Z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5"/><path d="M4 19.5h16"/>',
    upload: '<path d="M12 15V3m-5 5 5-5 5 5"/><path d="M4 19.5h16"/>',
    undo: '<path d="M8 5 3.5 9.5 8 14"/><path d="M3.5 9.5H15a5.5 5.5 0 0 1 0 11h-3"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13.5h9l1-13.5"/><path d="M10 11v6m4-6v6"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    grip: '<path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01"/>',
    filter: '<path d="M4 5h16l-6.5 8v6l-3 1.5V13L4 5Z"/>',
    bookmark: '<path d="M6.5 3.5h11V21L12 17.5 6.5 21V3.5Z"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    spark: '<path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6"/>',
    shield: '<path d="M12 3 4.5 6v6c0 4.5 3 7.5 7.5 9 4.5-1.5 7.5-4.5 7.5-9V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
    chat: '<path d="M4 5.5h16v11H10l-6 4v-15Z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.5"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9.5 9.5v10"/>'
  };
  root.NV.icon = function (name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (paths[name] || '') + '</svg>';
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
