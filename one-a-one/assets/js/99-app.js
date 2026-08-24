/* =========================================================================
   99-app.js — Shell da aplicacao: tema, sidebar, topbar, rotas, atalhos
   e bootstrap. E o unico arquivo que conhece todas as paginas.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, db = App.db;

  /* ====================================================================== */
  /*  TEMA                                                                  */
  /* ====================================================================== */
  const CHAVE_TEMA = 'oao:tema';
  const tema = {
    atual() { return document.documentElement.getAttribute('data-theme') || 'light'; },
    definir(t) {
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem(CHAVE_TEMA, t); } catch (e) {}
      App.bus.emit('tema:mudou', t);
      atualizarBotaoTema();
    },
    alternar() {
      const novo = tema.atual() === 'dark' ? 'light' : 'dark';
      tema.definir(novo);
      App.toast.info(novo === 'dark' ? 'Tema escuro ativado' : 'Tema claro ativado');
    },
    iniciar() {
      /* mesma regra do bloco inline do index.html:
         preferência salva > ?tema= (padrão de quem embute) > preferência do sistema */
      let t;
      try { t = localStorage.getItem(CHAVE_TEMA); } catch (e) {}
      if (!t) {
        const q = /[?&]tema=(dark|light)/.exec(location.search);
        t = q ? q[1]
              : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
      document.documentElement.setAttribute('data-theme', t);
    }
  };
  App.tema = tema;

  /* Mostra de onde vem o dado: base compartilhada ou so este navegador. */
  function atualizarSync(estado) {
    const b = u.$('#btnSync');
    if (!b) return;
    const compartilhado = estado === 'firebase' ||
      (estado === undefined && App.adapter && App.adapter.nome === 'Firebase');
    b.style.color = compartilhado ? 'var(--ok)' : 'var(--text-4)';
    b.setAttribute('data-tip', compartilhado
      ? 'Base compartilhada — o que você registra aparece nos outros endereços'
      : 'Somente neste navegador — sem conexão com a base compartilhada');
  }
  App.atualizarSync = atualizarSync;

  App.bus.on('backend:firebase', () => atualizarSync('firebase'));
  App.bus.on('backend:local', () => atualizarSync('local'));
  App.bus.on('backend:migrado', info => {
    setTimeout(() => App.toast.ok('Base compartilhada ativada',
      'Seus dados deste navegador foram enviados e agora aparecem nos três endereços.'), 1200);
  });

  function atualizarBotaoTema() {
    const b = u.$('#btnTema');
    if (!b) return;
    const dark = tema.atual() === 'dark';
    b.innerHTML = App.icon(dark ? 'sun' : 'moon');
    b.setAttribute('data-tip', dark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro');
  }

  /* ====================================================================== */
  /*  NAVEGACAO                                                             */
  /* ====================================================================== */
  const NAV = [
    {
      grupo: 'Gestão', itens: [
        { rota: '/dashboard',  label: 'Dashboard',  icone: 'home' },
        { rota: '/equipe',     label: 'Equipe',     icone: 'users' },
        { rota: '/one-a-one',  label: 'One a One',  icone: 'handshake', badge: () => contarAtrasados1a1() }
      ]
    },
    {
      grupo: 'Registros', itens: [
        { rota: '/observacoes', label: 'Observações', icone: 'eye',  badge: () => null },
        { rota: '/feedbacks',   label: 'Feedbacks',   icone: 'chat' },
        { rota: '/planos',      label: 'Planos de ação', icone: 'flag', badge: () => db.planos.atrasados().length || null }
      ]
    },
    {
      grupo: 'Análise', itens: [
        { rota: '/indicadores', label: 'Indicadores', icone: 'barchart' }
      ]
    },
    {
      grupo: 'Sistema', itens: [
        { rota: '/config', label: 'Configurações', icone: 'settings' }
      ]
    }
  ];

  const NAV_MOBILE = [
    { rota: '/dashboard',   label: 'Início',    icone: 'home' },
    { rota: '/equipe',      label: 'Equipe',    icone: 'users' },
    { rota: '/one-a-one',   label: 'One a One', icone: 'handshake' },
    { rota: '/observacoes', label: 'Registros', icone: 'eye' },
    { rota: '/indicadores', label: 'Números',   icone: 'barchart' }
  ];

  function contarAtrasados1a1() {
    const n = db.colaboradores.ativos().filter(c => App.analise.situacao1a1(c).estado === 'atrasado').length;
    return n || null;
  }

  /* ====================================================================== */
  /*  SHELL                                                                 */
  /* ====================================================================== */
  function montarShell() {
    const app = u.$('#app');
    u.clear(app);

    const cfg = db.config.get('coordenador', {}) || {};
    const nomeCoord = cfg.nome || 'Coordenador Comercial';

    /* --------------------------- sidebar --------------------------- */
    const sidebar = u.el('aside.sidebar', { id: 'sidebar' });
    sidebar.appendChild(u.el('div.sidebar__brand', {}, [
      u.el('div.sidebar__logo', { text: '1:1' }),
      u.el('div', {}, [
        u.el('div.sidebar__name', { text: 'Evolui' }),
        u.el('div.sidebar__tag', { text: 'Gestão de pessoas' })
      ])
    ]));

    const nav = u.el('nav.sidebar__nav', { id: 'nav' });
    sidebar.appendChild(nav);

    sidebar.appendChild(u.el('div.sidebar__foot', {}, [
      u.el('button.user-chip', {
        type: 'button', onclick: () => App.router.go('/config'),
        'data-tip': 'Abrir configurações'
      }, [
        u.el('span.avatar.avatar--sm', {
          style: { background: 'linear-gradient(140deg,var(--brand-500),var(--brand-700))' },
          text: u.iniciais(nomeCoord)
        }),
        u.el('div.user-chip__info.u-grow', { style: { minWidth: 0, textAlign: 'left' } }, [
          u.el('div.t-sm.t-semi.u-truncate', { text: nomeCoord }),
          u.el('div.t-xs.t-muted.u-truncate', { text: 'Coordenador · Admin' })
        ])
      ])
    ]));

    /* --------------------------- main --------------------------- */
    const main = u.el('main.main');
    const topbar = u.el('header.topbar', {}, [
      u.el('button.icon-btn', {
        type: 'button', id: 'btnMenu', 'aria-label': 'Abrir menu',
        html: App.icon('menu'),
        onclick: () => alternarSidebar()
      }),
      u.el('div.u-grow', { style: { minWidth: 0 } }, [
        u.el('div.topbar__title', { id: 'tituloTela', text: 'Dashboard' }),
        u.el('div.topbar__sub', { id: 'subTela', text: u.dataExtenso(new Date()) })
      ]),
      u.el('button.search.no-print', {
        type: 'button', id: 'btnBusca',
        style: { width: '260px', cursor: 'text' },
        onclick: () => App.busca.abrir()
      }, [
        u.el('span', { html: App.icon('search') }),
        u.el('span.t-md.t-muted2.u-grow', { style: { textAlign: 'left' }, text: 'Buscar...' }),
        u.el('kbd', { text: 'Ctrl K' })
      ]),
      u.el('button.icon-btn', {
        type: 'button', id: 'btnSync', 'aria-label': 'Estado da sincronização',
        html: App.icon('database'),
        onclick: () => App.router.go('/config/sistema')
      }),
      u.el('button.icon-btn', {
        type: 'button', id: 'btnNotif', 'aria-label': 'Notificações', 'data-tip': 'Notificações',
        html: App.icon('bell'),
        onclick: () => App.notificacoes.abrir()
      }),
      u.el('button.icon-btn', {
        type: 'button', id: 'btnTema', 'aria-label': 'Alternar tema',
        onclick: () => tema.alternar()
      }),
      u.el('button.btn.btn--primary.no-print', {
        type: 'button', id: 'btnNovaObs',
        html: App.icon('plus') + '<span class="obs-label">Nova observação</span>',
        'data-tip': 'Ctrl + N',
        onclick: () => App.obsModal.abrir()
      })
    ]);

    const view = u.el('div.view', { id: 'view' });
    main.appendChild(topbar);
    main.appendChild(view);

    app.appendChild(sidebar);
    app.appendChild(main);

    /* scrim mobile */
    const scrim = u.el('div.scrim', { id: 'scrimNav', onclick: () => alternarSidebar(false) });
    document.body.appendChild(scrim);

    /* nav mobile + FAB */
    const mob = u.el('nav.mobilenav', { id: 'mobilenav' }, [
      u.el('div.mobilenav__list', {}, NAV_MOBILE.map(i => u.el('button.mobilenav__item', {
        type: 'button', 'data-rota': i.rota,
        onclick: () => App.router.go(i.rota),
        html: App.icon(i.icone) + '<span>' + u.esc(i.label) + '</span>'
      })))
    ]);
    document.body.appendChild(mob);
    document.body.appendChild(u.el('button.fab', {
      type: 'button', 'aria-label': 'Nova observação',
      html: App.icon('plus'), onclick: () => App.obsModal.abrir()
    }));

    pintarNav();
    atualizarBotaoTema();
    atualizarSync();
    atualizarBadges();

    /* colapsar sidebar no desktop com duplo clique na marca */
    sidebar.querySelector('.sidebar__brand').addEventListener('dblclick', () => {
      app.classList.toggle('is-collapsed');
    });
  }
  App.montarShell = montarShell;

  function pintarNav() {
    const nav = u.$('#nav');
    if (!nav) return;
    u.clear(nav);
    NAV.forEach(g => {
      const grupo = u.el('div.nav-group', {}, [u.el('div.nav-group__label', { text: g.grupo })]);
      g.itens.forEach(i => {
        grupo.appendChild(u.el('button.nav-item', {
          type: 'button', 'data-rota': i.rota,
          onclick: () => { App.router.go(i.rota); alternarSidebar(false); },
          html: App.icon(i.icone) + '<span>' + u.esc(i.label) + '</span>'
        }));
      });
      nav.appendChild(grupo);
    });
    marcarAtivo();
  }

  /* Os contadores do menu falam SEMPRE da operacao, mesmo quando a tela
     aberta esta mostrando material de demonstracao. */
  function atualizarBadges() {
    db.comEscopo('operacao', _atualizarBadges);
  }

  function _atualizarBadges() {
    NAV.forEach(g => g.itens.forEach(i => {
      const el = u.$('.nav-item[data-rota="' + i.rota + '"]');
      if (!el) return;
      const antigo = el.querySelector('.nav-item__badge');
      if (antigo) antigo.remove();
      const n = i.badge ? i.badge() : null;
      if (n) el.appendChild(u.el('span.nav-item__badge', { text: String(n) }));
    }));

    const b = u.$('#btnNotif');
    if (b) {
      const antigo = b.querySelector('.icon-btn__dot');
      if (antigo) antigo.remove();
      const n = App.notificacoes.naoLidas();
      if (n) b.appendChild(u.el('span.icon-btn__dot', { text: n > 9 ? '9+' : String(n) }));
    }
  }
  App.atualizarBadges = atualizarBadges;

  function marcarAtivo() {
    const r = App.router.atual();
    const caminho = r ? r.caminho : '/dashboard';
    const raiz = '/' + (caminho.split('/')[1] || 'dashboard');
    const mapaRaiz = { '/colaborador': '/equipe', '/preparar': '/one-a-one' };
    /* material de demonstracao vive dentro de Configurações › Exemplos */
    const alvo = db.escopo() === 'exemplos' ? '/config' : (mapaRaiz[raiz] || raiz);

    u.$$('.nav-item').forEach(el => el.classList.toggle('is-active', el.getAttribute('data-rota') === alvo));
    u.$$('.mobilenav__item').forEach(el => el.classList.toggle('is-active', el.getAttribute('data-rota') === alvo));
  }

  function alternarSidebar(forcar) {
    const sb = u.$('#sidebar'), sc = u.$('#scrimNav');
    if (!sb) return;
    const abrir = forcar === undefined ? !sb.classList.contains('is-open') : forcar;
    if (window.innerWidth > 900) {
      u.$('#app').classList.toggle('is-collapsed');
      return;
    }
    sb.classList.toggle('is-open', abrir);
    sc.classList.toggle('is-open', abrir);
  }

  /* ====================================================================== */
  /*  ROTAS                                                                 */
  /* ====================================================================== */
  const ROTAS = [
    { padrao: '/dashboard',            pagina: 'dashboard' },
    { padrao: '/equipe',               pagina: 'equipe' },
    { padrao: '/colaborador/:id',      pagina: 'perfil' },
    { padrao: '/colaborador/:id/:aba', pagina: 'perfil' },
    { padrao: '/observacoes',          pagina: 'observacoes' },
    { padrao: '/feedbacks',            pagina: 'feedbacks' },
    { padrao: '/one-a-one',            pagina: 'oneones' },
    { padrao: '/one-a-one/:id',        pagina: 'sessao', semAuto: true },
    { padrao: '/preparar/:colabId',    pagina: 'preparar' },
    { padrao: '/planos',               pagina: 'planos' },
    { padrao: '/indicadores',          pagina: 'indicadores' },
    { padrao: '/config',               pagina: 'config' },
    { padrao: '/config/:aba',          pagina: 'config' },
    { padrao: '/config/:aba/:id',      pagina: 'config' }
  ];

  let telaAtual = null;

  function registrarRotas() {
    ROTAS.forEach(r => {
      App.router.add(r.padrao, (params, query) => {
        telaAtual = { rota: r, params, query };
        const view = u.$('#view');
        const pagina = App.pages[r.pagina];
        if (!pagina) {
          view.innerHTML = '<div class="view__inner"><div class="card"><div class="card__body">Página não implementada.</div></div></div>';
          return;
        }
        u.$('#tituloTela').textContent = pagina.titulo || '';
        u.$('#subTela').textContent = pagina.sub || u.dataExtenso(new Date());
        atualizarBadges();
        view.scrollTop = 0;
        /* toda tela comeca na operacao; quem mostra demonstracao eleva o
           escopo no proprio render (perfil/preparacao/sessao de exemplo). */
        db.setEscopo('operacao');
        pagina.render(view, params, query || {});
        /* depois do render: telas de demonstracao acendem "Configurações" */
        marcarAtivo();
      });
    });

    App.router.fallback(() => {
      const view = u.$('#view');
      u.clear(view);
      view.appendChild(u.el('div.view__inner', {}, [u.el('div.card', {}, [p.vazio({
        icone: 'compass', titulo: 'Página não encontrada',
        desc: 'O endereço acessado não existe neste sistema.',
        acoes: [{ label: 'Ir para o Dashboard', onClick: () => App.router.go('/dashboard') }]
      })])]));
    });
  }

  /** Redesenha a tela atual (usado apos gravar dados). */
  App.recarregarTela = function () {
    if (!telaAtual) return;
    const pagina = App.pages[telaAtual.rota.pagina];
    if (!pagina) return;
    const view = u.$('#view');
    const topo = view.scrollTop;
    pagina.render(view, telaAtual.params, telaAtual.query || {});
    view.scrollTop = topo;
    atualizarBadges();
  };

  /* Redesenha sozinho quando os dados mudam (exceto em telas de edicao). */
  const repintarAuto = u.debounce(() => {
    if (telaAtual && telaAtual.rota.semAuto) { atualizarBadges(); return; }
    App.recarregarTela();
  }, 220);

  App.bus.on('dados:mudou', repintarAuto);
  App.bus.on('tela:repintar', () => App.recarregarTela());
  App.bus.on('notificacoes:mudou', atualizarBadges);

  /* ====================================================================== */
  /*  ATALHOS DE TECLADO                                                    */
  /* ====================================================================== */
  const ATALHOS_G = {
    d: '/dashboard', e: '/equipe', o: '/one-a-one', r: '/observacoes',
    f: '/feedbacks', p: '/planos', i: '/indicadores', c: '/config'
  };

  /* A sequencia "g" + letra e uma MAQUINA DE ESTADO, nunca um listener
     aninhado: um listener extra registrado no 'g' sobreviveria ao timeout e
     dispararia na proxima tecla digitada — inclusive dentro de um campo de
     texto, jogando o usuario para outra tela no meio do trabalho. */
  let aguardandoG = false;
  let timerG = null;

  function cancelarSequencia() {
    aguardandoG = false;
    clearTimeout(timerG);
    timerG = null;
  }

  function atalhos() {
    document.addEventListener('keydown', ev => {
      const alvo = ev.target;
      const digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' ||
                                 alvo.tagName === 'SELECT' || alvo.isContentEditable);

      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'n' || ev.key === 'N')) {
        ev.preventDefault(); cancelarSequencia(); App.obsModal.abrir(); return;
      }
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
        ev.preventDefault(); cancelarSequencia(); App.busca.abrir(); return;
      }
      if (ev.key === '/' && !digitando) { ev.preventDefault(); App.busca.abrir(); return; }

      /* Qualquer digitacao, modificador ou modal aberto cancela a sequencia. */
      if (digitando || ev.ctrlKey || ev.metaKey || ev.altKey || App.modal.pilha.length) {
        cancelarSequencia();
        return;
      }

      if (aguardandoG) {
        const destino = ATALHOS_G[String(ev.key).toLowerCase()];
        cancelarSequencia();
        if (destino) { ev.preventDefault(); App.router.go(destino); }
        return;
      }

      if (ev.key === 'g' || ev.key === 'G') {
        aguardandoG = true;
        clearTimeout(timerG);
        timerG = setTimeout(cancelarSequencia, 900);
      }
    });

    /* clicar, focar um campo ou sair da janela tambem encerra a sequencia */
    document.addEventListener('mousedown', cancelarSequencia, true);
    document.addEventListener('focusin', cancelarSequencia, true);
    window.addEventListener('blur', cancelarSequencia);
  }

  /* ====================================================================== */
  /*  BOOT                                                                  */
  /* ====================================================================== */
  function esqueleto() {
    const view = u.$('#view');
    if (!view) return;
    u.clear(view);
    const box = u.el('div.view__inner');
    box.appendChild(u.el('div.sk', { style: { height: '150px', borderRadius: 'var(--r-xl)', marginBottom: '20px' } }));
    const grid = u.el('div.grid.grid-kpi.u-mb-5');
    for (let i = 0; i < 6; i++) grid.appendChild(u.el('div.sk', { style: { height: '110px', borderRadius: 'var(--r-lg)' } }));
    box.appendChild(grid);
    const grid2 = u.el('div.grid.grid-cards');
    for (let i = 0; i < 3; i++) grid2.appendChild(u.el('div.sk', { style: { height: '220px', borderRadius: 'var(--r-lg)' } }));
    box.appendChild(grid2);
    view.appendChild(box);
  }

  function iniciar() {
    tema.iniciar();
    montarShell();
    esqueleto();
    registrarRotas();
    atalhos();

    /* Base compartilhada primeiro: se o Firebase responder, os tres
       enderecos passam a ler e gravar os mesmos dados. Se nao responder,
       segue no armazenamento local sem travar o app. */
    App.escolherAdapter()
      .then(() => db.carregar())
      .then(() => {
        if (db.vazio()) {
          /* instalacao nova: os exemplos entram apenas como material de consulta */
          return App.seed.aplicar().then(() => {
            setTimeout(() => App.toast.info('Tudo pronto',
              'A equipe começa vazia. Os dados de demonstração estão em Configurações › Exemplos.'), 900);
          });
        }
        /* base existente: separa demonstracao da operacao (uma unica vez) */
        return App.seed.migrar().then(migrou => {
          if (migrou) {
            setTimeout(() => App.toast.info('Exemplos separados da operação',
              'Os registros de demonstração saíram da Equipe e foram para Configurações › Exemplos.'), 900);
          }
        });
      })
      .then(() => u.sleep(220))          /* respiro para o skeleton nao piscar */
      .then(() => {
        App.state.set('carregando', false);
        montarShell();                    /* remonta com o nome do coordenador */
        App.router.iniciar();
        window.addEventListener('resize', u.debounce(() => {
          if (window.innerWidth > 900) {
            const sb = u.$('#sidebar'), sc = u.$('#scrimNav');
            if (sb) sb.classList.remove('is-open');
            if (sc) sc.classList.remove('is-open');
          }
        }, 160));
      })
      .catch(e => {
        console.error('[boot]', e);
        const view = u.$('#view');
        if (view) {
          u.clear(view);
          view.appendChild(u.el('div.view__inner', {}, [u.el('div.card', {}, [p.vazio({
            icone: 'alert', titulo: 'Não foi possível carregar os dados',
            desc: String(e && e.message ? e.message : e),
            acoes: [{ label: 'Tentar de novo', onClick: () => location.reload() }]
          })])]));
        }
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window.App);
