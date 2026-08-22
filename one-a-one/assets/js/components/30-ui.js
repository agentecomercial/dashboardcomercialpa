/* =========================================================================
   components/30-ui.js — Toast, Modal, Confirm, Tooltip, Popover, Drawer.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u;

  /* ====================================================================== */
  /*  TOAST                                                                 */
  /* ====================================================================== */
  let toastRoot = null;
  function raizToast() {
    if (!toastRoot) {
      toastRoot = u.el('div.toast-root', { role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(toastRoot);
    }
    return toastRoot;
  }

  const ICONE_TOAST = { ok: 'checkCircle', warn: 'alert', danger: 'alert', info: 'info' };

  function toast(titulo, msg, tipo, ms) {
    const t = tipo || 'info';
    const node = u.el('div.toast' + (t !== 'info' ? '.toast--' + t : ''), {}, [
      u.el('div.toast__icon.t-' + (t === 'ok' ? 'ok' : t === 'danger' ? 'danger' : t === 'warn' ? 'warn' : 'brand'),
        { html: App.icon(ICONE_TOAST[t] || 'info') }),
      u.el('div.u-grow', {}, [
        u.el('div.toast__title', { text: titulo }),
        msg ? u.el('div.toast__msg', { text: msg }) : null
      ]),
      u.el('button.icon-btn.btn--xs', {
        'aria-label': 'Fechar', html: App.icon('x'), onclick: () => fechar()
      })
    ]);
    raizToast().appendChild(node);
    let h = setTimeout(fechar, ms || 3600);
    function fechar() {
      clearTimeout(h);
      if (!node.parentNode) return;
      node.classList.add('is-out');
      setTimeout(() => node.remove(), 240);
    }
    node.addEventListener('mouseenter', () => clearTimeout(h));
    node.addEventListener('mouseleave', () => { h = setTimeout(fechar, 1600); });
    return fechar;
  }

  App.toast = Object.assign(toast, {
    ok:    (t, m) => toast(t, m, 'ok'),
    erro:  (t, m) => toast(t, m, 'danger', 5200),
    aviso: (t, m) => toast(t, m, 'warn', 4400),
    info:  (t, m) => toast(t, m, 'info')
  });

  /* ====================================================================== */
  /*  MODAL                                                                 */
  /* ====================================================================== */
  const pilha = [];

  /**
   * App.modal.abrir({ titulo, desc, tamanho:'sm|md|lg|xl', corpo:Node|string,
   *                   acoes:[{label,tipo,onClick,fechar}], aoFechar, semScrimClose })
   * Retorna { fechar, el, body }
   */
  function abrir(cfg) {
    cfg = cfg || {};
    const root = u.el('div.modal-root.is-open', { role: 'dialog', 'aria-modal': 'true' });
    const scrim = u.el('div.modal__scrim');
    const box = u.el('div.modal' + (cfg.tamanho && cfg.tamanho !== 'md' ? '.modal--' + cfg.tamanho : ''));

    if (cfg.titulo || cfg.desc) {
      box.appendChild(u.el('div.modal__head', {}, [
        cfg.icone ? u.el('div.kpi__icon.tone-' + (cfg.tom || 'brand'), { html: App.icon(cfg.icone) }) : null,
        u.el('div.u-grow', {}, [
          u.el('div.modal__title', { text: cfg.titulo || '' }),
          cfg.desc ? u.el('div.modal__desc', { text: cfg.desc }) : null
        ]),
        u.el('button.icon-btn', { 'aria-label': 'Fechar', html: App.icon('x'), onclick: () => fechar() })
      ]));
    }

    const body = u.el('div.modal__body');
    if (typeof cfg.corpo === 'string') body.innerHTML = cfg.corpo;
    else if (cfg.corpo) body.appendChild(cfg.corpo);
    box.appendChild(body);

    if (cfg.acoes && cfg.acoes.length) {
      const foot = u.el('div.modal__foot');
      cfg.acoes.forEach(a => {
        const b = u.el('button.btn.btn--' + (a.tipo || 'ghost'), {
          text: a.label,
          type: 'button',
          onclick: ev => {
            const r = a.onClick ? a.onClick(ev, api) : undefined;
            if (a.fechar !== false && r !== false) {
              if (r && typeof r.then === 'function') r.then(x => { if (x !== false) fechar(); });
              else fechar();
            }
          }
        });
        if (a.id) b.id = a.id;
        if (a.icone) b.insertBefore(App.iconEl(a.icone), b.firstChild);
        foot.appendChild(b);
      });
      box.appendChild(foot);
    }

    const wrap = u.el('div.modal__wrap', {}, [box]);
    root.appendChild(scrim); root.appendChild(wrap);
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';

    if (!cfg.semScrimClose) scrim.addEventListener('click', () => fechar());

    const api = { el: root, box, body, fechar };
    pilha.push(api);

    /* foco no primeiro campo util */
    setTimeout(() => {
      const alvo = box.querySelector('[data-autofocus]') ||
                   box.querySelector('input:not([type=hidden]), textarea, select');
      if (alvo) { try { alvo.focus(); alvo.select && alvo.select(); } catch (e) {} }
    }, 90);

    function fechar() {
      const i = pilha.indexOf(api);
      if (i < 0) return;
      pilha.splice(i, 1);
      root.classList.add('is-closing');
      setTimeout(() => {
        root.remove();
        if (!pilha.length) document.body.style.overflow = '';
      }, 150);
      if (cfg.aoFechar) cfg.aoFechar();
    }

    return api;
  }

  function fecharTopo() {
    if (pilha.length) pilha[pilha.length - 1].fechar();
    return pilha.length > 0;
  }

  function confirmar(cfg) {
    return new Promise(resolve => {
      let decidido = false;
      abrir({
        titulo: cfg.titulo || 'Confirmar',
        tamanho: 'sm',
        icone: cfg.icone || (cfg.perigo ? 'alert' : 'info'),
        tom: cfg.perigo ? 'danger' : 'brand',
        corpo: u.el('div', {}, [
          u.el('div', { class: 't-md', style: { color: 'var(--text-2)', lineHeight: '1.6' }, text: cfg.mensagem || '' })
        ]),
        acoes: [
          { label: cfg.cancelar || 'Cancelar', tipo: 'ghost', onClick: () => { decidido = true; resolve(false); } },
          { label: cfg.confirmar || 'Confirmar', tipo: cfg.perigo ? 'danger' : 'primary', onClick: () => { decidido = true; resolve(true); } }
        ],
        aoFechar: () => { if (!decidido) resolve(false); }
      });
    });
  }

  App.modal = { abrir, confirmar, fecharTopo, pilha };

  /* ====================================================================== */
  /*  TOOLTIP  (atributo data-tip)                                          */
  /* ====================================================================== */
  const tip = u.el('div.tip-el', { role: 'tooltip' });
  let tipAtivo = null;
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(tip));

  function posicionarTip(alvo) {
    const r = alvo.getBoundingClientRect();
    tip.textContent = alvo.getAttribute('data-tip');
    tip.classList.add('is-on');
    const tr = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - tr.width / 2;
    let y = r.top - tr.height - 8;
    if (y < 6) y = r.bottom + 8;
    x = u.clamp(x, 6, window.innerWidth - tr.width - 6);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  document.addEventListener('mouseover', ev => {
    const alvo = ev.target.closest && ev.target.closest('[data-tip]');
    if (!alvo || alvo === tipAtivo) return;
    tipAtivo = alvo;
    if (!tip.parentNode) document.body.appendChild(tip);
    posicionarTip(alvo);
  });
  document.addEventListener('mouseout', ev => {
    if (!tipAtivo) return;
    const alvo = ev.target.closest && ev.target.closest('[data-tip]');
    if (alvo === tipAtivo) { tip.classList.remove('is-on'); tipAtivo = null; }
  });
  window.addEventListener('scroll', () => { tip.classList.remove('is-on'); tipAtivo = null; }, true);

  /* ====================================================================== */
  /*  POPOVER / MENU                                                        */
  /* ====================================================================== */
  let popAtual = null;
  function fecharPop() {
    if (popAtual) { popAtual.remove(); popAtual = null; document.removeEventListener('mousedown', aoClicarFora, true); }
  }
  function aoClicarFora(ev) { if (popAtual && !popAtual.contains(ev.target)) fecharPop(); }

  /** menu(alvoEl, [{label, icone, onClick, perigo, sep, titulo}]) */
  function menu(alvo, itens, opts) {
    fecharPop();
    opts = opts || {};
    const pop = u.el('div.pop', { role: 'menu' });
    itens.forEach(it => {
      if (it.sep) { pop.appendChild(u.el('div.pop__sep')); return; }
      if (it.titulo) { pop.appendChild(u.el('div.pop__label', { text: it.titulo })); return; }
      pop.appendChild(u.el('button.pop__item' + (it.perigo ? '.pop__item--danger' : ''), {
        type: 'button',
        html: (it.icone ? App.icon(it.icone) : '') + '<span>' + u.esc(it.label) + '</span>',
        onclick: ev => { fecharPop(); it.onClick && it.onClick(ev); }
      }));
    });
    document.body.appendChild(pop);
    const r = alvo.getBoundingClientRect(), pr = pop.getBoundingClientRect();
    let x = opts.alinhar === 'left' ? r.left : r.right - pr.width;
    let y = r.bottom + 6;
    if (y + pr.height > window.innerHeight - 8) y = Math.max(8, r.top - pr.height - 6);
    pop.style.left = u.clamp(x, 8, window.innerWidth - pr.width - 8) + 'px';
    pop.style.top = y + 'px';
    popAtual = pop;
    setTimeout(() => document.addEventListener('mousedown', aoClicarFora, true), 0);
    return pop;
  }
  App.menu = menu;
  App.fecharMenu = fecharPop;
  window.addEventListener('resize', fecharPop);

  /* ====================================================================== */
  /*  DRAWER                                                                */
  /* ====================================================================== */
  function drawer(cfg) {
    const scrim = u.el('div.scrim');
    const box = u.el('div.drawer', { role: 'dialog', 'aria-label': cfg.titulo || 'Painel' });
    box.appendChild(u.el('div.drawer__head', {}, [
      u.el('div', {}, [
        u.el('div', { class: 'card__title', text: cfg.titulo || '' }),
        cfg.desc ? u.el('div.t-sm.t-muted', { text: cfg.desc }) : null
      ]),
      u.el('div.u-row.u-gap-1', {}, [
        cfg.acaoTopo || null,
        u.el('button.icon-btn', { 'aria-label': 'Fechar', html: App.icon('x'), onclick: () => fechar() })
      ])
    ]));
    const body = u.el('div.drawer__body');
    if (cfg.corpo) body.appendChild(cfg.corpo);
    box.appendChild(body);

    document.body.appendChild(scrim);
    document.body.appendChild(box);
    requestAnimationFrame(() => { scrim.classList.add('is-open'); box.classList.add('is-open'); });
    scrim.addEventListener('click', () => fechar());

    function fechar() {
      scrim.classList.remove('is-open'); box.classList.remove('is-open');
      setTimeout(() => { scrim.remove(); box.remove(); }, 320);
      cfg.aoFechar && cfg.aoFechar();
    }
    return { fechar, body, el: box };
  }
  App.drawer = drawer;

  /* ESC fecha o que estiver por cima */
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    if (popAtual) { fecharPop(); return; }
    if (pilha.length) { fecharTopo(); return; }
    const d = document.querySelector('.drawer.is-open');
    if (d) { const s = document.querySelector('.scrim.is-open'); s && s.click(); }
  });
})(window.App);
