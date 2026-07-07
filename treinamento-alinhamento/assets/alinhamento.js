// Treinamento Alinhamento Inicial — navegação, auto-escala, edição de textos e ocultação de slides
(function () {
  const stage = document.querySelector('.stage');
  const deck = document.querySelector('.deck');
  if (!stage || !deck) return;

  const allSlides = Array.from(deck.querySelectorAll('.slide'));

  allSlides.forEach((s, i) => { s.dataset.slideId = String(i + 1); });

  const STEP_SELECTORS = [
    '.script-list > .item',
    '.dialog > .turn',
    '.seq > .step',
    '.aida > .block',
    '.funnel > .step',
    '.matrix > .quad',
    '.grid > .card',
    '.cis-table tbody > tr',
  ];
  const STEP_FALLBACK_LIST = [
    '.split > .col ul > li',
    '.split > .col > .card',
    'ul.dot-list > li',
    'ul.tick-list > li',
    'ul.x-list > li',
  ];

  const stepState = new Map();

  function collectInDomOrder(slide, selectors) {
    const set = new Set();
    const all = [];
    selectors.forEach(sel => {
      slide.querySelectorAll(sel).forEach(el => {
        if (!set.has(el)) { set.add(el); all.push(el); }
      });
    });
    all.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
    return all;
  }

  allSlides.forEach(slide => {
    if (slide.classList.contains('module-cover')) return;
    let items = [];
    for (const sel of STEP_SELECTORS) {
      const found = slide.querySelectorAll(sel);
      if (found.length >= 3) { items = Array.from(found); break; }
    }
    if (items.length < 3) {
      const combined = collectInDomOrder(slide, STEP_FALLBACK_LIST);
      if (combined.length >= 3) items = combined;
    }
    if (items.length >= 3) {
      items.forEach((el, i) => {
        el.classList.add('cis-step');
        el.dataset.stepI = String(i);
      });
      slide.dataset.steps = String(items.length);
    }
  });

  const EDIT_SELECTOR = 'h1, h2, h3, h4, p, li, cite, .chip, .quote, .bubble, .label, .value, .who, .num, .meta, .axis-x, .axis-y, .pullquote, .module-badge';
  allSlides.forEach(slide => {
    slide.querySelectorAll(EDIT_SELECTOR).forEach((el, i) => {
      if (el.closest('svg, script, style, .progress, .hud, .home-button, [data-no-edit]')) return;
      if (!el.dataset.edId) el.dataset.edId = slide.dataset.slideId + '.' + i;
    });
  });

  const STAGGER_SELECTORS = [
    '.grid > *', '.seq > *', '.aida > *', '.funnel > *',
    '.split > *', '.cols-aside > *',
    '.matrix > .quad', '.matrix > .axis-y', '.matrix > .axis-x',
    'ul.dot-list > li', 'ul.tick-list > li', 'ul.x-list > li',
    '.cis-table tbody > tr'
  ];
  allSlides.forEach(slide => {
    STAGGER_SELECTORS.forEach(sel => {
      slide.querySelectorAll(sel).forEach((el, i) => el.style.setProperty('--i', i));
    });
    slide.querySelectorAll('.metric').forEach((m) => {
      const card = m.closest('.card');
      if (card && card.style.getPropertyValue('--i')) {
        m.style.setProperty('--i-card', card.style.getPropertyValue('--i'));
      }
    });
  });

  const STORAGE_KEY = 'cis-edits:' + (location.pathname.split('/').slice(-2).join('/') || 'index');
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function saveStore(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
  let store = loadStore();
  if (!store.edits) store.edits = {};
  if (!store.hidden) store.hidden = [];

  function applyEdits() {
    Object.entries(store.edits).forEach(([edId, html]) => {
      const el = deck.querySelector('[data-ed-id="' + CSS.escape(edId) + '"]');
      if (el) el.innerHTML = html;
    });
  }
  function applyHidden() {
    allSlides.forEach(s => s.classList.toggle('is-hidden-slide', store.hidden.includes(s.dataset.slideId)));
  }
  applyEdits();
  applyHidden();

  function visibleSlides() {
    if (document.documentElement.classList.contains('edit-mode')) return allSlides;
    return allSlides.filter(s => !store.hidden.includes(s.dataset.slideId));
  }

  const counterEl = document.querySelector('[data-counter]');
  const progressEl = document.querySelector('.progress > span');
  let idx = 0;

  if (counterEl) {
    counterEl.style.cursor = 'pointer';
    counterEl.title = 'Clique para ir a um slide específico';
    counterEl.addEventListener('click', (e) => {
      if (counterEl.querySelector('.goto-input')) return;
      const total = visibleSlides().length;
      counterEl.innerHTML = '';
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.max = String(total);
      input.value = String(idx + 1);
      input.className = 'goto-input';
      const suffix = document.createElement('span');
      suffix.textContent = ' / ' + total;
      suffix.style.color = 'var(--cis-muted)';
      counterEl.appendChild(input);
      counterEl.appendChild(suffix);
      input.focus();
      input.select();

      let committed = false;
      const commit = () => {
        if (committed) return; committed = true;
        const n = parseInt(input.value, 10);
        if (!isNaN(n) && n >= 1 && n <= total) go(n - 1);
        else render();
      };
      const cancel = () => { if (committed) return; committed = true; render(); };
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
        else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
        ev.stopPropagation();
      });
      input.addEventListener('blur', commit);
    });
  }

  function fitDeck() {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const sw = deck.clientWidth;
    const sh = deck.clientHeight;
    const scale = Math.min(W / sw, H / sh) * 0.96;
    deck.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
    deck.style.position = 'absolute';
    deck.style.top = '50%';
    deck.style.left = '50%';
  }

  function applyStepReveal(slide, mode) {
    const total = parseInt(slide.dataset.steps || '0', 10);
    if (!total) return;
    let cur;
    if (mode === 'all') cur = total - 1;
    else if (mode === 'first') cur = 0;
    else cur = stepState.get(slide) ?? 0;
    if (mode === 'first' || mode === 'all') stepState.set(slide, cur);
    slide.querySelectorAll('.cis-step').forEach((el, i) => {
      el.classList.toggle('is-revealed', i <= cur);
    });
  }

  function stepInfo(slide) {
    const total = parseInt(slide.dataset.steps || '0', 10);
    const cur = stepState.get(slide) ?? -1;
    return { total, cur, hasMore: total > 0 && cur < total - 1 };
  }

  function render(prevIdx) {
    const slides = visibleSlides();
    if (idx >= slides.length) idx = Math.max(0, slides.length - 1);
    const dir = prevIdx == null ? 'next' : (idx >= prevIdx ? 'next' : 'prev');
    allSlides.forEach(s => { s.classList.remove('dir-prev', 'dir-next', 'is-active', 'is-leaving'); });
    const current = slides[idx];
    if (!current) return;
    current.classList.add('is-active');
    if (dir === 'prev') current.classList.add('dir-prev');
    if (counterEl) counterEl.innerHTML = '<b>' + (idx + 1) + '</b> / ' + slides.length;
    if (progressEl) progressEl.style.width = (((idx + 1) / slides.length) * 100) + '%';
    const url = new URL(window.location.href);
    url.hash = 'slide-' + (idx + 1);
    history.replaceState(null, '', url);

    if (current.dataset.steps) {
      if (!stepState.has(current)) applyStepReveal(current, 'first');
      else applyStepReveal(current, 'state');
    }
    updateAdvanceButton();

    if (window.parent !== window && current.dataset.slideId) {
      parent.postMessage({ type: 'cis-slide-changed', n: parseInt(current.dataset.slideId, 10) }, '*');
    }
  }

  function go(n) {
    const len = visibleSlides().length;
    const prevIdx = idx;
    idx = Math.max(0, Math.min(len - 1, n));
    render(prevIdx === idx ? undefined : prevIdx);
  }

  function next() {
    const slides = visibleSlides();
    const current = slides[idx];
    if (current && current.dataset.steps) applyStepReveal(current, 'all');
    go(idx + 1);
  }

  function prev() { go(idx - 1); }

  function advance() {
    const slides = visibleSlides();
    const current = slides[idx];
    if (!current) return next();
    const info = stepInfo(current);
    if (info.hasMore) {
      stepState.set(current, info.cur + 1);
      applyStepReveal(current, 'state');
      updateAdvanceButton();
    } else {
      next();
    }
  }

  function updateAdvanceButton() {
    const btn = document.querySelector('[data-nav="advance"]');
    if (!btn) return;
    btn.style.display = 'inline-flex';
    const slides = visibleSlides();
    const current = slides[idx];
    const lbl = btn.querySelector('.adv-label');
    if (!current || !current.dataset.steps) {
      if (lbl) lbl.textContent = 'Avançar';
      btn.classList.add('is-exhausted');
      btn.title = 'Avançar para o próximo slide';
      return;
    }
    const info = stepInfo(current);
    if (lbl) lbl.textContent = info.hasMore ? 'Avançar (' + (info.cur + 2) + '/' + info.total + ')' : 'Avançar';
    btn.classList.toggle('is-exhausted', !info.hasMore);
    btn.title = info.hasMore ? 'Revelar o próximo item' : 'Avançar para o próximo slide';
  }

  const m = location.hash.match(/slide-(\d+)/);
  if (m) idx = Math.max(0, Math.min(visibleSlides().length - 1, parseInt(m[1], 10) - 1));

  document.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.isContentEditable) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(visibleSlides().length - 1); }
    else if (e.key === 'f' || e.key === 'F') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    }
    else if (e.key === 'e' || e.key === 'E') {
      if (e.ctrlKey || e.metaKey) return;
      toggleEditMode();
    }
  });

  document.querySelectorAll('[data-nav="prev"]').forEach(b => b.addEventListener('click', prev));
  document.querySelectorAll('[data-nav="next"]').forEach(b => b.addEventListener('click', next));

  function ensureAdvanceButton() {
    const nav = document.querySelector('.hud .nav-buttons');
    if (!nav) return;
    if (nav.querySelector('[data-nav="advance"]')) return;
    const btn = document.createElement('button');
    btn.dataset.nav = 'advance';
    btn.className = 'adv-btn';
    btn.title = 'Avançar item por item';
    btn.innerHTML = `<span class="adv-label">Avançar</span> ▸`;
    btn.addEventListener('click', advance);
    const prevBtn = nav.querySelector('[data-nav="prev"]');
    const nextBtn = nav.querySelector('[data-nav="next"]');
    if (prevBtn && nextBtn && prevBtn.parentNode === nav) nav.insertBefore(btn, nextBtn);
    else nav.appendChild(btn);
  }
  ensureAdvanceButton();

  function ensureMenuButton() {
    const nav = document.querySelector('.hud .nav-buttons');
    if (!nav) return;
    if (nav.querySelector('[data-nav="menu"]')) return;
    const btn = document.createElement('button');
    btn.dataset.nav = 'menu';
    btn.className = 'menu-btn';
    btn.title = 'Voltar ao menu';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg> Menu`;
    btn.addEventListener('click', () => {
      if (window.parent !== window) parent.postMessage({ type: 'cis-nav', target: 'menu' }, '*');
      else location.href = 'index.html';
    });
    nav.insertBefore(btn, nav.firstChild);
  }
  ensureMenuButton();

  (function reorderHud() {
    const nav = document.querySelector('.hud .nav-buttons');
    if (!nav) return;
    const order = ['menu', 'edit', 'reset', 'prev', 'advance', 'next', 'fullscreen'];
    order.forEach(key => {
      const b = nav.querySelector('[data-nav="' + key + '"]');
      if (b) nav.appendChild(b);
    });
  })();

  window.addEventListener('message', (e) => {
    const msg = e.data || {};
    if (msg.type === 'cis-goto' && typeof msg.n === 'number') {
      const target = allSlides[msg.n - 1];
      if (!target) return;
      const slides = visibleSlides();
      const found = slides.indexOf(target);
      if (found >= 0) go(found);
    }
    // O shell alterou os slides ocultos no localStorage — recarrega e re-renderiza
    if (msg.type === 'cis-reload-hidden') {
      store = loadStore(); if (!store.edits) store.edits = {}; if (!store.hidden) store.hidden = [];
      applyHidden();
      if (typeof refreshEditUI === 'function') refreshEditUI();
      const list = visibleSlides(); if (idx >= list.length) idx = Math.max(0, list.length - 1);
      render();
    }
  });

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  }
  function syncFsButtons() {
    const on = !!document.fullscreenElement;
    document.querySelectorAll('[data-nav="fullscreen"]').forEach(b => {
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      const lbl = b.querySelector('.fs-label');
      if (lbl) lbl.textContent = on ? 'Sair' : 'Tela cheia';
    });
  }
  document.querySelectorAll('[data-nav="fullscreen"]').forEach(b => b.addEventListener('click', toggleFullscreen));
  document.addEventListener('fullscreenchange', syncFsButtons);

  function setEditable(on) {
    deck.querySelectorAll('[data-ed-id]').forEach(el => {
      if (on) { el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'true'); }
      else { el.removeAttribute('contenteditable'); el.removeAttribute('spellcheck'); }
    });
  }

  function onEditBlur(e) {
    const el = e.target.closest('[data-ed-id]');
    if (!el) return;
    store.edits[el.dataset.edId] = el.innerHTML;
    saveStore(store);
  }

  function toggleSlideHidden(slide) {
    const id = slide.dataset.slideId;
    const i = store.hidden.indexOf(id);
    if (i >= 0) store.hidden.splice(i, 1);
    else store.hidden.push(id);
    saveStore(store);
    applyHidden();
    if (!document.documentElement.classList.contains('edit-mode')) {
      const list = visibleSlides();
      if (idx >= list.length) idx = list.length - 1;
      render();
    } else {
      refreshEditUI();
    }
  }

  function buildSlideEditOverlay(slide) {
    if (slide.querySelector('.slide-edit-overlay')) return;
    const ov = document.createElement('div');
    ov.className = 'slide-edit-overlay';
    ov.innerHTML = `
      <button class="se-btn se-hide" title="Ocultar/mostrar este slide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z"/><circle cx="12" cy="12" r="3"/></svg>
        <span class="se-label">Ocultar slide</span>
      </button>
      <span class="se-badge">OCULTO</span>
    `;
    slide.appendChild(ov);
    ov.querySelector('.se-hide').addEventListener('click', (e) => { e.stopPropagation(); toggleSlideHidden(slide); });
  }
  function removeSlideEditOverlay(slide) {
    const ov = slide.querySelector('.slide-edit-overlay');
    if (ov) ov.remove();
  }

  function refreshEditUI() {
    allSlides.forEach(s => {
      const isHidden = store.hidden.includes(s.dataset.slideId);
      s.classList.toggle('is-hidden-slide', isHidden);
      const lbl = s.querySelector('.se-hide .se-label');
      if (lbl) lbl.textContent = isHidden ? 'Mostrar slide' : 'Ocultar slide';
    });
  }

  function toggleEditMode(force) {
    const html = document.documentElement;
    const on = (force == null) ? !html.classList.contains('edit-mode') : !!force;
    html.classList.toggle('edit-mode', on);
    setEditable(on);
    allSlides.forEach(s => { if (on) buildSlideEditOverlay(s); else removeSlideEditOverlay(s); });
    refreshEditUI();
    document.querySelectorAll('[data-nav="edit"]').forEach(b => {
      b.classList.toggle('is-on', on);
      const lbl = b.querySelector('.edit-label');
      if (lbl) lbl.textContent = on ? 'Sair da edição' : 'Editar';
    });
    if (!on) {
      const list = visibleSlides();
      if (idx >= list.length) idx = Math.max(0, list.length - 1);
      render();
    }
  }

  function resetAll() {
    if (!confirm('Restaurar todos os textos e mostrar todos os slides? Esta ação não tem desfazer.')) return;
    store = { edits: {}, hidden: [] };
    saveStore(store);
    location.reload();
  }

  deck.addEventListener('blur', onEditBlur, true);

  function ensureEditButtons() {
    const hud = document.querySelector('.hud .nav-buttons');
    if (!hud) return;
    if (!hud.querySelector('[data-nav="edit"]')) {
      const btn = document.createElement('button');
      btn.className = 'fs-btn';
      btn.dataset.nav = 'edit';
      btn.title = 'Modo edição (E) — clique no texto para editar';
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z"/></svg> <span class="edit-label">Editar</span>`;
      btn.addEventListener('click', () => toggleEditMode());
      hud.insertBefore(btn, hud.firstChild);
    }
    if (!hud.querySelector('[data-nav="reset"]')) {
      const btn = document.createElement('button');
      btn.className = 'fs-btn';
      btn.dataset.nav = 'reset';
      btn.title = 'Restaurar conteúdo original';
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>`;
      btn.addEventListener('click', resetAll);
      btn.style.display = 'none';
      btn.classList.add('reset-btn');
      hud.insertBefore(btn, hud.firstChild);
    }
    refreshResetVisibility();
  }
  function refreshResetVisibility() {
    const has = (store.hidden && store.hidden.length) || (store.edits && Object.keys(store.edits).length);
    document.querySelectorAll('[data-nav="reset"]').forEach(b => b.style.display = has ? 'inline-flex' : 'none');
  }

  const inIframe = window.parent !== window;
  if (inIframe) {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.endsWith('index.html')) {
        e.preventDefault();
        parent.postMessage({ type: 'cis-nav', target: 'menu' }, '*');
      } else {
        const mm = href.match(/modulo-(\d+)\.html/);
        if (mm) {
          e.preventDefault();
          parent.postMessage({ type: 'cis-nav', target: 'module', n: parseInt(mm[1], 10) }, '*');
        }
      }
    });
    document.documentElement.classList.add('in-shell');
    document.querySelectorAll('[data-nav="fullscreen"]').forEach(b => {
      const newBtn = b.cloneNode(true);
      b.parentNode.replaceChild(newBtn, b);
      newBtn.addEventListener('click', () => { parent.postMessage({ type: 'cis-nav', target: 'fullscreen' }, '*'); });
    });
    window.addEventListener('message', (e) => {
      const msg = e.data || {};
      if (msg.type === 'cis-fullscreen-state') {
        document.querySelectorAll('[data-nav="fullscreen"]').forEach(b => {
          b.classList.toggle('is-on', !!msg.on);
          const lbl = b.querySelector('.fs-label');
          if (lbl) lbl.textContent = msg.on ? 'Sair' : 'Tela cheia';
        });
      }
    });
    document.querySelectorAll('a.home-button').forEach(a => {
      if (getComputedStyle(a).position === 'fixed') a.style.display = 'none';
    });
  }

  ensureEditButtons();

  (function reorderHudFinal() {
    const nav = document.querySelector('.hud .nav-buttons');
    if (!nav) return;
    const order = ['menu', 'edit', 'reset', 'prev', 'advance', 'next', 'fullscreen'];
    order.forEach(key => {
      const b = nav.querySelector('[data-nav="' + key + '"]');
      if (b) nav.appendChild(b);
    });
  })();

  let tx = 0;
  stage.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (document.documentElement.classList.contains('edit-mode')) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 40) (dx < 0 ? next() : prev());
  });

  deck.addEventListener('blur', () => refreshResetVisibility(), true);
  window.addEventListener('resize', fitDeck);
  fitDeck();
  render();

  // ── Botão "Mostrar todos os slides" (desocultar todos SEM apagar textos) ──
  (function ensureUnhideAllButton() {
    const nav = document.querySelector('.hud .nav-buttons');
    if (!nav || nav.querySelector('[data-nav="unhide-all"]')) return;
    if (!document.getElementById('unhideAllCss')) {
      const st = document.createElement('style');
      st.id = 'unhideAllCss';
      st.textContent = 'html:not(.edit-mode) [data-nav="unhide-all"]{display:none!important}';
      document.head.appendChild(st);
    }
    const btn = document.createElement('button');
    btn.className = 'fs-btn';
    btn.dataset.nav = 'unhide-all';
    btn.title = 'Mostrar todos os slides (desocultar todos, sem apagar os textos)';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z"/><circle cx="12" cy="12" r="3"/></svg> <span>Mostrar todos</span>';
    btn.addEventListener('click', function () {
      if (!store.hidden || !store.hidden.length) return;
      store.hidden = [];
      saveStore(store);
      applyHidden();
      if (typeof refreshEditUI === 'function') refreshEditUI();
      if (typeof refreshResetVisibility === 'function') refreshResetVisibility();
      const list = visibleSlides();
      if (idx >= list.length) idx = Math.max(0, list.length - 1);
      render();
    });
    const editBtn = nav.querySelector('[data-nav="edit"]');
    if (editBtn) nav.insertBefore(btn, editBtn.nextSibling);
    else nav.insertBefore(btn, nav.firstChild);
  })();
})();
