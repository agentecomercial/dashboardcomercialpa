/* =========================================================================
   core/02-bus.js — Barramento de eventos + estado de UI reativo.
   App.bus.on / off / emit      App.state.get / set / sub
   ========================================================================= */
(function (App) {
  'use strict';

  /* ------------------------------ Event bus ------------------------------ */
  const mapa = new Map();
  const bus = {
    on(ev, fn) {
      if (!mapa.has(ev)) mapa.set(ev, new Set());
      mapa.get(ev).add(fn);
      return () => bus.off(ev, fn);
    },
    once(ev, fn) {
      const off = bus.on(ev, function (p) { off(); fn(p); });
      return off;
    },
    off(ev, fn) { const s = mapa.get(ev); if (s) s.delete(fn); },
    emit(ev, payload) {
      const s = mapa.get(ev);
      if (s) Array.from(s).forEach(fn => { try { fn(payload); } catch (e) { console.error('[bus:' + ev + ']', e); } });
      const all = mapa.get('*');
      if (all) Array.from(all).forEach(fn => { try { fn({ ev, payload }); } catch (e) { console.error(e); } });
    }
  };
  App.bus = bus;

  /* ---------------------- Estado de UI (nao persistido) ---------------------- */
  const dados = {
    rota: null,               // { pagina, params }
    sidebarAberta: false,
    sidebarColapsada: false,
    carregando: true,
    busca: '',
    filtros: {}               // filtros por pagina
  };
  const subs = new Set();

  App.state = {
    get(k) { return k === undefined ? dados : dados[k]; },
    set(k, v) {
      if (typeof k === 'object') Object.assign(dados, k);
      else dados[k] = v;
      subs.forEach(fn => { try { fn(dados); } catch (e) { console.error(e); } });
    },
    sub(fn) { subs.add(fn); return () => subs.delete(fn); }
  };
})(window.App);
