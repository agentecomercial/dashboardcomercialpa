/* =========================================================================
   core/00-utils.js — Utilitarios puros (sem dependencias).
   Expostos em App.u
   ========================================================================= */
window.App = window.App || {};

(function () {
  'use strict';

  const u = {};

  /* ----------------------------- DOM ----------------------------- */
  u.$  = (sel, ctx) => (ctx || document).querySelector(sel);
  u.$$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));

  /** Cria elemento: el('div.card', {onclick}, [filhos|string]) */
  u.el = function (spec, attrs, children) {
    const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(spec) || [];
    const tag = m[1] || 'div';
    const node = document.createElement(tag);
    (m[2] || '').split(/(?=[.#])/).forEach(tok => {
      if (!tok) return;
      if (tok[0] === '.') node.classList.add(tok.slice(1));
      if (tok[0] === '#') node.id = tok.slice(1);
    });
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        /* 'class' SOMA as classes do seletor, nunca substitui */
        else if (k === 'class') String(v).split(/\s+/).forEach(cl => cl && node.classList.add(cl));
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return node;
  };

  /** Converte string HTML em elemento (primeiro filho). */
  u.frag = function (htmlStr) {
    const t = document.createElement('template');
    t.innerHTML = String(htmlStr).trim();
    return t.content;
  };

  u.esc = function (s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /** Delegacao de eventos: on(root,'click','.sel', handler) */
  u.on = function (root, type, sel, fn) {
    root.addEventListener(type, function (ev) {
      const t = ev.target.closest(sel);
      if (t && root.contains(t)) fn.call(t, ev, t);
    });
  };

  u.clear = function (node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; };

  /* ----------------------------- ID / misc ----------------------------- */
  let _seq = 0;
  u.uid = function (prefix) {
    _seq += 1;
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + _seq.toString(36) +
           Math.random().toString(36).slice(2, 6);
  };

  u.clone = obj => (obj === undefined ? obj : JSON.parse(JSON.stringify(obj)));

  u.debounce = function (fn, ms) {
    let h; return function () {
      const a = arguments, c = this;
      clearTimeout(h); h = setTimeout(() => fn.apply(c, a), ms || 180);
    };
  };

  u.sleep = ms => new Promise(r => setTimeout(r, ms));

  u.clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  u.sum = (arr, f) => arr.reduce((a, x) => a + (Number(f ? f(x) : x) || 0), 0);

  u.groupBy = function (arr, keyFn) {
    return arr.reduce((acc, item) => {
      const k = keyFn(item);
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  };

  u.sortBy = function (arr, fn, dir) {
    const d = dir === 'desc' ? -1 : 1;
    return arr.slice().sort((a, b) => {
      const x = fn(a), y = fn(b);
      return x < y ? -d : x > y ? d : 0;
    });
  };

  u.uniq = arr => Array.from(new Set(arr));

  /* ----------------------------- Datas ----------------------------- */
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const MES_ABR = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const DIAS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  u.MESES = MESES; u.MES_ABR = MES_ABR;

  /** Data local a partir de 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:mm' (evita UTC shift). */
  u.parseDate = function (v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(v));
    if (!m) { const d = new Date(v); return isNaN(d) ? null : d; }
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  };

  const pad = n => String(n).padStart(2, '0');

  u.toISODate = function (d) {
    d = u.parseDate(d) || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  u.toISODateTime = function (d) {
    d = u.parseDate(d) || new Date();
    return u.toISODate(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  };
  u.today = () => u.toISODate(new Date());
  u.nowISO = () => u.toISODateTime(new Date());

  u.startOfDay = function (d) { d = u.parseDate(d) || new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

  u.addDays = function (d, n) {
    const x = u.startOfDay(d); x.setDate(x.getDate() + n); return x;
  };
  u.addMonths = function (d, n) {
    const x = u.parseDate(d) || new Date();
    return new Date(x.getFullYear(), x.getMonth() + n, x.getDate(), x.getHours(), x.getMinutes());
  };

  /** Diferenca em dias (b - a), sempre em dias inteiros locais. */
  u.diffDays = function (a, b) {
    const x = u.startOfDay(a), y = u.startOfDay(b || new Date());
    return Math.round((y - x) / 86400000);
  };
  /** Dias ate a data (futuro positivo, passado negativo). */
  u.daysUntil = d => u.diffDays(new Date(), d);

  u.fmtDate = function (d, withYear) {
    const x = u.parseDate(d); if (!x) return '—';
    return pad(x.getDate()) + '/' + pad(x.getMonth() + 1) + (withYear === false ? '' : '/' + x.getFullYear());
  };
  u.fmtDateShort = d => { const x = u.parseDate(d); return x ? pad(x.getDate()) + '/' + pad(x.getMonth() + 1) : '—'; };
  u.fmtTime = d => { const x = u.parseDate(d); return x ? pad(x.getHours()) + ':' + pad(x.getMinutes()) : ''; };
  u.fmtDateTime = d => { const x = u.parseDate(d); return x ? u.fmtDate(x) + ' ' + u.fmtTime(x) : '—'; };
  u.fmtDateLong = function (d) {
    const x = u.parseDate(d); if (!x) return '—';
    return x.getDate() + ' de ' + MESES[x.getMonth()] + ' de ' + x.getFullYear();
  };
  u.fmtWeekday = d => { const x = u.parseDate(d); return x ? DIAS[x.getDay()] : ''; };
  const DIAS_ABR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  /** "seg 24/08" — usado nos botoes de ajuste de data. */
  u.fmtDiaCurto = d => { const x = u.parseDate(d); return x ? DIAS_ABR[x.getDay()] + ' ' + u.fmtDate(x, false) : '—'; };
  u.fmtMesAno = d => { const x = u.parseDate(d); return x ? MES_ABR[x.getMonth()] + '/' + String(x.getFullYear()).slice(2) : ''; };

  /** "hoje", "ontem", "há 3 dias", "em 5 dias" */
  u.fmtRelativo = function (d) {
    const n = u.diffDays(d, new Date());
    if (n === 0) return 'hoje';
    if (n === 1) return 'ontem';
    if (n === -1) return 'amanhã';
    if (n > 1)  return n < 30 ? 'há ' + n + ' dias' : 'há ' + Math.round(n / 30) + ' ' + (Math.round(n / 30) === 1 ? 'mês' : 'meses');
    const k = -n;
    return k < 30 ? 'em ' + k + ' dias' : 'em ' + Math.round(k / 30) + ' ' + (Math.round(k / 30) === 1 ? 'mês' : 'meses');
  };

  /** Tempo de casa: "1 ano e 3 meses" */
  u.tempoDeCasa = function (d) {
    const x = u.parseDate(d); if (!x) return '—';
    const hoje = new Date();
    let meses = (hoje.getFullYear() - x.getFullYear()) * 12 + (hoje.getMonth() - x.getMonth());
    if (hoje.getDate() < x.getDate()) meses -= 1;
    if (meses < 0) meses = 0;
    const a = Math.floor(meses / 12), m = meses % 12;
    if (a === 0) return m <= 1 ? (m === 0 ? 'menos de 1 mês' : '1 mês') : m + ' meses';
    const pa = a === 1 ? '1 ano' : a + ' anos';
    return m === 0 ? pa : pa + ' e ' + (m === 1 ? '1 mês' : m + ' meses');
  };

  /* ----------------------------- Numeros ----------------------------- */
  u.fmtNum = function (n, dec) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec === undefined ? 0 : dec });
  };
  u.fmtMoeda = function (n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };
  u.fmtMoedaCurta = function (n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const a = Math.abs(n);
    if (a >= 1e6) return 'R$ ' + (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + 'M';
    if (a >= 1e3) return 'R$ ' + (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace('.', ',') + 'k';
    return 'R$ ' + u.fmtNum(n);
  };
  u.fmtPct = function (n, dec) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toFixed(dec === undefined ? 0 : dec).replace('.', ',') + '%';
  };
  u.pct = (parte, total) => (!total ? 0 : (parte / total) * 100);

  /* ----------------------------- Texto ----------------------------- */
  u.iniciais = function (nome) {
    const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  };
  u.primeiroNome = nome => String(nome || '').trim().split(/\s+/)[0] || '';

  u.slug = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  u.norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  u.trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

  u.plural = (n, sing, plur) => n + ' ' + (n === 1 ? sing : (plur || sing + 's'));

  /** Realca ocorrencias do termo com <mark>. Retorna HTML seguro. */
  u.marca = function (texto, termo) {
    const t = u.esc(texto);
    if (!termo) return t;
    const alvo = u.norm(texto), q = u.norm(termo);
    const i = alvo.indexOf(q);
    if (i < 0) return t;
    // reconstroi respeitando o texto original (mesmo comprimento apos normalizar acentos)
    const raw = String(texto);
    return u.esc(raw.slice(0, i)) + '<mark>' + u.esc(raw.slice(i, i + termo.length)) + '</mark>' + u.esc(raw.slice(i + termo.length));
  };

  u.saudacao = function (d) {
    const h = (u.parseDate(d) || new Date()).getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  /** Data por extenso para o cabecalho: "quinta-feira, 21 de agosto de 2026" */
  u.dataExtenso = function (d) {
    const x = u.parseDate(d) || new Date();
    return DIAS[x.getDay()] + ', ' + x.getDate() + ' de ' + MESES[x.getMonth()] + ' de ' + x.getFullYear();
  };

  /* ----------------------------- Cores ----------------------------- */
  const PALETA = ['#6366f1','#14b8a6','#f59e0b','#ec4899','#8b5cf6','#3b82f6','#10b981','#ef4444','#0ea5e9','#f97316'];
  u.PALETA = PALETA;
  u.corPorTexto = function (txt) {
    let h = 0; const s = String(txt || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return PALETA[h % PALETA.length];
  };

  /* ----------------------------- Arquivos ----------------------------- */
  u.fileToDataURL = function (file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  };
  u.tamanhoArquivo = function (bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB';
  };

  u.copiar = function (texto) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texto);
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); resolve(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  };

  u.baixarArquivo = function (nome, conteudo, mime) {
    const blob = new Blob([conteudo], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  App.u = u;
})();
