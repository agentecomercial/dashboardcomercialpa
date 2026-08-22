/* =========================================================================
   pages/53-oneaone-lista.js — Agenda de One a Ones + historico da equipe.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, db = App.db, A = App.analise, cat = App.cat;

  const est = { filtro: 'agenda' };

  function render(view, params, query) {
    if (query && query.filtro === 'atrasados') est.filtro = 'agenda';
    const box = u.el('div.view__inner');

    box.appendChild(u.el('div.page-head', {}, [
      u.el('div', {}, [
        u.el('div.page-head__title', { text: 'One a One' }),
        u.el('div.page-head__desc', { text: 'Prepare, conduza e registre os encontros individuais com evidências do período.' })
      ]),
      u.el('div.u-row.u-gap-2', {}, [
        u.el('button.btn.btn--outline', {
          type: 'button', html: App.icon('calendar') + '<span>Agendar</span>',
          onclick: () => escolherColaborador('Agendar One a One', c => App.colabModal.reagendar(c))
        }),
        u.el('button.btn.btn--primary', {
          type: 'button', html: App.icon('sparkles') + '<span>Preparar encontro</span>',
          onclick: () => escolherColaborador('Preparar One a One', c => App.router.go('/preparar/' + c.id))
        })
      ])
    ]));

    const seg = u.el('div.seg.u-mb-4');
    [['agenda', 'Agenda'], ['historico', 'Histórico'], ['andamento', 'Em andamento']].forEach(([id, lb]) => {
      seg.appendChild(u.el('button.seg__btn' + (est.filtro === id ? '.is-on' : ''), {
        type: 'button', text: lb,
        onclick: () => {
          est.filtro = id;
          u.$$('.seg__btn', seg).forEach(b => b.classList.toggle('is-on', b.textContent === lb));
          pintar();
        }
      }));
    });
    box.appendChild(seg);

    const conteudo = u.el('div');
    box.appendChild(conteudo);

    function pintar() {
      u.clear(conteudo);
      if (est.filtro === 'agenda') agenda(conteudo);
      else if (est.filtro === 'historico') historico(conteudo);
      else andamento(conteudo);
    }
    pintar();

    u.clear(view);
    view.appendChild(box);
  }

  /* ---------------------------- Agenda ---------------------------- */
  function agenda(alvo) {
    const ativos = db.colaboradores.ativos();
    if (!ativos.length) {
      alvo.appendChild(u.el('div.card', {}, [p.vazio({
        icone: 'users', titulo: 'Nenhum colaborador ativo',
        desc: 'Cadastre a equipe para montar a agenda de One a Ones. Para ver como um encontro fica registrado, consulte os exemplos.',
        acoes: [
          { label: 'Cadastrar colaborador', icone: 'userPlus', onClick: () => App.colabModal.abrir() },
        { label: 'Ver exemplos', tipo: 'outline', icone: 'sparkles', onClick: () => App.router.go('/config/exemplos') }
        ]
      })]));
      return;
    }

    const grupos = { atrasado: [], hoje: [], semana: [], depois: [], sem_data: [] };
    ativos.forEach(c => {
      const s = A.situacao1a1(c);
      if (s.estado === 'sem_data') grupos.sem_data.push({ c, s });
      else if (s.estado === 'atrasado') grupos.atrasado.push({ c, s });
      else if (s.dias === 0) grupos.hoje.push({ c, s });
      else if (s.dias <= 7) grupos.semana.push({ c, s });
      else grupos.depois.push({ c, s });
    });

    const secoes = [
      ['atrasado', 'Atrasados', 'danger', 'Reagende ou realize hoje — quanto mais tempo passa, menos evidência fresca sobra.'],
      ['hoje', 'Hoje', 'warn', 'Encontros do dia.'],
      ['semana', 'Próximos 7 dias', 'info', 'Prepare com antecedência para chegar com o resumo pronto.'],
      ['depois', 'Mais adiante', 'neutral', ''],
      ['sem_data', 'Sem data definida', 'warn', 'Defina uma frequência para não perder o ritmo de acompanhamento.']
    ];

    let algum = false;
    secoes.forEach(([id, titulo, tom, desc]) => {
      const lista = u.sortBy(grupos[id], x => (x.s.dias === null ? 9999 : x.s.dias));
      if (!lista.length) return;
      algum = true;
      alvo.appendChild(u.el('div.u-row.u-gap-2.u-mb-3', { style: { marginTop: '22px' } }, [
        u.el('span.card__title', { text: titulo }),
        u.el('span', { class: 'badge badge--' + (tom === 'neutral' ? 'outline' : tom), text: String(lista.length) }),
        desc ? u.el('span.t-sm.t-muted.u-truncate', { text: '— ' + desc }) : null
      ]));
      const grid = u.el('div.grid.grid-cards.stagger');
      lista.forEach(({ c, s }) => grid.appendChild(cardAgenda(c, s)));
      alvo.appendChild(grid);
    });

    if (!algum) {
      alvo.appendChild(u.el('div.card', {}, [p.vazio({
        icone: 'calendar', titulo: 'Nenhum encontro na agenda',
        desc: 'Defina a data do próximo One a One de cada colaborador no cadastro.'
      })]));
    }
  }

  function cardAgenda(c, s) {
    const res = A.resumoPeriodo(c.id);
    const abertos = db.planos.abertos(c.id).length;
    const atrasadas = db.planos.atrasados(c.id).length;

    return u.el('div.card.card--hover.card--pad', {}, [
      u.el('div.u-row.u-gap-3.u-mb-3', {}, [
        p.avatar(c, 'md', true),
        u.el('div.u-grow', { style: { minWidth: 0 } }, [
          u.el('div.t-semi.u-truncate', { text: c.nome }),
          u.el('div.t-xs.t-muted.u-truncate', { text: c.cargo })
        ]),
        p.badge1a1(c)
      ]),
      u.el('div.t-sm.t-muted', {
        text: s.ultimo ? 'Último encontro em ' + u.fmtDate(s.ultimo) + ' (' + u.fmtRelativo(s.ultimo) + ')'
                       : 'Nenhum encontro realizado até agora'
      }),
      (s.proximo && App.cal.motivo(s.proximo))
        ? u.el('div.t-xs.t-warn.u-row.u-gap-2', { style: { marginTop: '6px' } }, [
            u.el('span', { html: App.icon('alert', '', 13) }),
            u.el('span', { text: 'Marcado em ' + App.cal.motivo(s.proximo).toLowerCase() + ' — dia não útil' })
          ])
        : null,
      u.el('div.u-row.u-wrap.u-gap-2.u-mt-3', {}, [
        u.el('span.badge.badge--outline', { text: u.plural(res.total, 'registro') }),
        res.atencao ? u.el('span.badge.badge--warn', { text: u.plural(res.atencao, 'atenção', 'atenção') }) : null,
        abertos ? u.el('span', { class: 'badge badge--' + (atrasadas ? 'danger' : 'info'), text: u.plural(abertos, 'ação aberta', 'ações abertas') }) : null
      ]),
      u.el('div.u-row.u-gap-2.u-mt-4', {}, [
        u.el('button.btn.btn--sm.btn--primary.u-grow', {
          type: 'button', html: App.icon('sparkles') + '<span>Preparar</span>',
          onclick: () => App.router.go('/preparar/' + c.id)
        }),
        u.el('button.btn.btn--sm.btn--outline', {
          type: 'button', 'data-tip': 'Reagendar', 'aria-label': 'Reagendar', html: App.icon('calendar'),
          onclick: () => App.colabModal.reagendar(c)
        }),
        u.el('button.btn.btn--sm.btn--outline', {
          type: 'button', 'data-tip': 'Abrir perfil', 'aria-label': 'Abrir perfil', html: App.icon('user'),
          onclick: () => App.router.go('/colaborador/' + c.id)
        })
      ])
    ]);
  }

  /* ---------------------------- Historico ---------------------------- */
  function historico(alvo) {
    const encontros = u.sortBy(db.oneones.onde(o => o.status === 'concluido'), o => o.data, 'desc');
    if (!encontros.length) {
      alvo.appendChild(u.el('div.card', {}, [p.vazio({
        icone: 'history', titulo: 'Nenhum One a One concluído',
        desc: 'Assim que você concluir o primeiro encontro, ele aparece aqui com todo o roteiro registrado.'
      })]));
      return;
    }

    const tb = u.el('tbody');
    encontros.forEach(e => {
      const c = db.colaboradores.por(e.colaboradorId);
      const r = e.roteiro || {};
      tb.appendChild(u.el('tr', { onclick: () => App.router.go('/one-a-one/' + e.id) }, [
        u.el('td', {}, [u.el('div.u-row.u-gap-3', {}, [
          c ? p.avatar(c, 'sm') : null,
          u.el('div', {}, [
            u.el('div.t-semi', { text: c ? c.nome : 'Colaborador removido' }),
            u.el('div.t-xs.t-muted', { text: c ? c.cargo : '' })
          ])
        ])]),
        u.el('td', { class: 'u-nowrap' }, [
          u.el('div.t-semi', { text: u.fmtDate(e.data) }),
          u.el('div.t-xs.t-muted', { text: u.fmtRelativo(e.data) })
        ]),
        u.el('td', { class: 't-sm', text: e.duracaoMin ? e.duracaoMin + ' min' : '—' }),
        u.el('td', { class: 'u-right t-num', text: String((e.observacoesDiscutidas || []).length) }),
        u.el('td', { class: 'u-right t-num', text: String((r.compromissos || []).length) }),
        u.el('td', { class: 't-sm u-clamp-2', style: { maxWidth: '320px' }, text: r.fechamento || '—' })
      ]));
    });

    alvo.appendChild(u.el('div.card', {}, [u.el('div.tbl-wrap', {}, [
      u.el('table.tbl.tbl--click', {}, [
        u.el('thead', {}, [u.el('tr', {}, ['Colaborador', 'Data', 'Duração', 'Evidências', 'Compromissos', 'Fechamento']
          .map((h, i) => u.el('th', { class: i === 3 || i === 4 ? 'u-right' : '', text: h })))]),
        tb
      ])
    ])]));
  }

  /* ---------------------------- Em andamento ---------------------------- */
  function andamento(alvo) {
    const abertos = db.oneones.onde(o => o.status === 'em_andamento');
    if (!abertos.length) {
      alvo.appendChild(u.el('div.card', {}, [p.vazio({
        icone: 'checkCircle', titulo: 'Nenhum encontro em andamento',
        desc: 'Encontros iniciados e não finalizados aparecem aqui para você retomar de onde parou.',
        acoes: [{ label: 'Preparar um encontro', icone: 'sparkles', onClick: () => escolherColaborador('Preparar One a One', c => App.router.go('/preparar/' + c.id)) }]
      })]));
      return;
    }
    const grid = u.el('div.grid.grid-cards.stagger');
    abertos.forEach(e => {
      const c = db.colaboradores.por(e.colaboradorId);
      grid.appendChild(u.el('div.card.card--hover.card--pad', {}, [
        u.el('div.u-row.u-gap-3.u-mb-3', {}, [
          c ? p.avatar(c, 'md') : null,
          u.el('div.u-grow', {}, [
            u.el('div.t-semi', { text: c ? c.nome : 'Colaborador removido' }),
            u.el('div.t-xs.t-muted', { text: 'Iniciado em ' + u.fmtDateTime(e.data) })
          ]),
          u.el('span.badge.badge--warn', { text: 'Em andamento' })
        ]),
        u.el('button.btn.btn--sm.btn--primary.btn--block', {
          type: 'button', html: App.icon('play') + '<span>Continuar</span>',
          onclick: () => App.router.go('/one-a-one/' + e.id)
        })
      ]));
    });
    alvo.appendChild(grid);
  }

  /* ---------------------------- Seletor ---------------------------- */
  function escolherColaborador(titulo, aoEscolher) {
    const ativos = db.colaboradores.ativos();
    if (!ativos.length) {
      App.toast.aviso('Nenhum colaborador ativo', 'Cadastre a equipe primeiro.');
      return;
    }
    const lista = u.el('div');
    const m = App.modal.abrir({
      titulo, desc: 'Com quem será o encontro?', icone: 'users', tamanho: 'sm',
      corpo: lista, acoes: [{ label: 'Cancelar', tipo: 'ghost' }]
    });
    ativos.forEach(c => {
      const s = A.situacao1a1(c);
      lista.appendChild(u.el('button.list-row', {
        type: 'button',
        onclick: () => { m.fechar(); setTimeout(() => aoEscolher(c), 60); }
      }, [
        p.avatar(c, 'sm', true),
        u.el('div.u-grow', { style: { minWidth: 0 } }, [
          u.el('div.t-semi.u-truncate', { text: c.nome }),
          u.el('div.t-xs.t-muted', { text: s.proximo ? 'Próximo em ' + u.fmtDate(s.proximo) : 'Sem data definida' })
        ]),
        p.badge1a1(c)
      ]));
    });
  }

  App.pages = App.pages || {};
  App.pages.oneones = { render, titulo: 'One a One', sub: 'Agenda e histórico de encontros', escolherColaborador };
})(window.App);
