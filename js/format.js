/* Мелкие helpers форматирования и DOM. Без зависимостей. */
(function (root) {
  'use strict';
  root.NV = root.NV || {};
  const C = root.NV.core;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
  const fmt = s => C.date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const fmtFull = s => C.date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const initials = n => n.trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();
  function plural(n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }
  const deptDot = { 'Склад': 'var(--warn)', 'Магазины': 'var(--primary)', 'Продажи': 'var(--info)', 'Офис': 'var(--lime)' };
  const uid = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const clone = o => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
  Object.assign(root.NV, { esc, fmt, fmtFull, initials, plural, deptDot, uid, download, clone });
})(typeof globalThis !== 'undefined' ? globalThis : this);
