/* Хранилище: localStorage + undo-стек + сохранённые представления + тема. */
(function (root) {
  'use strict';
  root.NV = root.NV || {};
  const C = root.NV.core, seed = root.NV.seed, clone = root.NV.clone;
  const KEY = 'novichok.state.v1', PREF = 'novichok.prefs.v1', VIEWS = 'novichok.views.v1';
  let memoryOnly = false;

  function safeGet(k) { try { return localStorage.getItem(k); } catch { memoryOnly = true; return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { memoryOnly = true; return false; } }
  function safeDel(k) { try { localStorage.removeItem(k); } catch { memoryOnly = true; } }

  function load() {
    const raw = safeGet(KEY);
    if (!raw) return { state: seed(), restored: false, memoryOnly };
    try { return { state: C.validate(JSON.parse(raw)), restored: true, memoryOnly }; }
    catch (e) { safeDel(KEY); return { state: seed(), restored: false, memoryOnly, error: e.message }; }
  }
  const save = state => safeSet(KEY, JSON.stringify(state));
  const clear = () => safeDel(KEY);
  const isMemoryOnly = () => memoryOnly;

  function prefs() {
    try { return JSON.parse(safeGet(PREF) || '{}') || {}; } catch { return {}; }
  }
  const setPrefs = p => safeSet(PREF, JSON.stringify(p));

  function views() {
    try { const v = JSON.parse(safeGet(VIEWS) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  const setViews = v => safeSet(VIEWS, JSON.stringify(v.slice(0, 20)));

  function createUndo() {
    const stack = [];
    return {
      push(state, label) { stack.push({ label, snapshot: clone(state) }); if (stack.length > 30) stack.shift(); },
      pop() { return stack.pop() || null; },
      peek() { return stack[stack.length - 1] || null; },
      clear() { stack.length = 0; },
      size() { return stack.length; }
    };
  }

  function trimLogs(state) {
    state.employees.forEach(e => {
      if (e.history.length > C.LIMITS.history) e.history = e.history.slice(-C.LIMITS.history);
      if (e.checkins.length > C.LIMITS.checkins) e.checkins = e.checkins.slice(-C.LIMITS.checkins);
    });
    return state;
  }

  root.NV.store = { load, save, clear, isMemoryOnly, prefs, setPrefs, views, setViews, createUndo, trimLogs, KEY };
})(typeof globalThis !== 'undefined' ? globalThis : this);
