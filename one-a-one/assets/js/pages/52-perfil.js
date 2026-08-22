/* =========================================================================
   pages/52-perfil.js — Perfil completo do colaborador (7 abas).
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, g = App.g, db = App.db, A = App.analise, cat = App.cat;

  const ABAS = [
    { id: 'visao',       label: 'Visão geral',            icone: 'compass' },
    { id: 'observacoes', label: 'Observações',            icone: 'eye' },
    { id: 'oneones',     label: 'One a Ones',             icone: 'handshake' },
    { id: 'feedbacks',   label: 'Feedbacks',              icone: 'chat' },
    { id: 'plano',       label: 'Plano de desenvolvimento', icone: 'flag' },
    { id: 'evolucao',    label: 'Evolução',               icone: 'trendUp' },
    { id: 'evidencias',  label: 'Evidências',             icone: 'paperclip' }
  ];

  const filtros = { obsTipo: 'todos', obsContexto: 'todos', obsPeriodo: 'todos', timeline: 'todos' };

  function render(view, params) {
    const c = db.colaboradores.por(params.id);
    if (!c) {
      u.clear(view);
      view.appendChild(u.el('div.view__inner', {}, [u.el('div.card', {}, [p.vazio({
        icone: 'user', titulo: 'Colaborador não encontrado',
        desc: 'Esse cadastro pode ter sido excluído.',
        acoes: [{ label: 'Voltar para a equipe', onClick: () => App.router.go('/equipe') }]
      })])]));
      return;
    }

    /* Colaborador de demonstracao: a tela inteira passa a ler no escopo
       'exemplos' — inclusive os cliques de filtro, que acontecem depois. */
    if (c.exemplo) db.setEscopo('exemplos');

    const abaAtual = ABAS.some(a => a.id === params.aba) ? params.aba : 'visao';
    const box = u.el('div.view__inner');

    if (c.exemplo) box.appendChild(p.faixaExemplo(
      'Perfil de demonstração. Tudo aqui é material de consulta e não afeta a operação.'));

    box.appendChild(cabecalho(c, abaAtual));

    /* --------------------------- abas --------------------------- */
    const tabs = u.el('div.tabs.u-mb-5');
    const contagens = {
      observacoes: db.observacoes.doColaborador(c.id).length,
      oneones: db.oneones.doColaborador(c.id).length,
      feedbacks: db.feedbacks.doColaborador(c.id).length,
      plano: db.planos.doColaborador(c.id).length,
      evidencias: todasEvidencias(c.id).length
    };
    ABAS.forEach(a => {
      tabs.appendChild(u.el('button.tab' + (a.id === abaAtual ? '.is-on' : ''), {
        type: 'button',
        onclick: () => App.router.go('/colaborador/' + c.id + '/' + a.id),
        html: App.icon(a.icone) + '<span>' + u.esc(a.label) + '</span>' +
          (contagens[a.id] ? '<span class="tab__count">' + contagens[a.id] + '</span>' : '')
      }));
    });
    box.appendChild(tabs);

    const conteudo = u.el('div.anim-fade');
    box.appendChild(conteudo);

    const pintar = {
      visao: () => abaVisao(conteudo, c),
      observacoes: () => abaObservacoes(conteudo, c),
      oneones: () => abaOneOnes(conteudo, c),
      feedbacks: () => abaFeedbacks(conteudo, c),
      plano: () => abaPlano(conteudo, c),
      evolucao: () => abaEvolucao(conteudo, c),
      evidencias: () => abaEvidencias(conteudo, c)
    };
    pintar[abaAtual]();

    u.clear(view);
    view.appendChild(box);
  }

  /* ====================================================================== */
  /*  Cabecalho                                                             */
  /* ====================================================================== */
  function cabecalho(c, aba) {
    const s = A.situacao1a1(c);
    const ind = A.indicadores(c);

    const head = u.el('div.profile-head.anim-rise', {}, [
      u.el('div.profile-head__cover'),
      u.el('div.profile-head__body', {}, [
        u.el('div.profile-head__av', {}, [p.avatar(c, '2xl')]),
        u.el('div.profile-head__info', {}, [
          u.el('div.u-row.u-gap-3.u-wrap', {}, [
            u.el('div.profile-head__name', { text: c.nome }),
            u.el('span', {
              class: 'badge badge--' + (c.status === 'inativo' ? 'outline' : 'ok') + ' badge--lg',
              text: c.status === 'inativo' ? 'Inativo' : 'Ativo'
            })
          ]),
          u.el('div.profile-head__facts', {}, [
            fato('briefcase', c.cargo),
            u.el('span.dot-sep'),
            fato('clock', u.tempoDeCasa(c.dataEntrada) + ' de casa'),
            u.el('span.dot-sep'),
            fato('history', s.ultimo ? 'Último 1:1 em ' + u.fmtDate(s.ultimo) : 'Nenhum 1:1 realizado'),
            u.el('span.dot-sep'),
            fato('calendar', s.proximo ? 'Próximo em ' + u.fmtDate(s.proximo) + ' · ' + u.fmtRelativo(s.proximo) : 'Próximo 1:1 sem data'),
            c.telefone ? u.el('span.dot-sep') : null,
            c.telefone ? fato('phone', c.telefone) : null,
            c.email ? u.el('span.dot-sep') : null,
            c.email ? fato('mail', c.email) : null
          ])
        ]),
        u.el('div.profile-head__actions', {}, c.exemplo ? [
          u.el('span.badge.badge--warn.badge--lg', { text: '✨ Exemplo · somente consulta' })
        ] : [
          u.el('button.btn.btn--primary', {
            type: 'button', html: App.icon('plus') + '<span>Observação</span>',
            onclick: () => App.obsModal.abrir({ colaboradorId: c.id })
          }),
          u.el('button.btn.btn--soft', {
            type: 'button', html: App.icon('sparkles') + '<span>Preparar One a One</span>',
            onclick: () => App.router.go('/preparar/' + c.id)
          }),
          u.el('button.btn.btn--outline.btn--icon', {
            type: 'button', 'aria-label': 'Mais ações', 'data-tip': 'Mais ações', html: App.icon('more'),
            onclick: ev => App.menu(ev.currentTarget, [
              { label: 'Novo feedback', icone: 'chat', onClick: () => App.fbModal.abrir({ colaboradorId: c.id }) },
              { label: 'Novo plano de ação', icone: 'flag', onClick: () => App.planoModal.abrir({ colaboradorId: c.id }) },
              { label: 'Agendar One a One', icone: 'calendar', onClick: () => App.colabModal.reagendar(c) },
              { sep: true },
              { label: 'Editar cadastro', icone: 'edit', onClick: () => App.colabModal.abrir({ colaborador: c, aoSalvar: () => App.recarregarTela() }) },
              { label: 'Exportar histórico', icone: 'download', onClick: () => exportarHistorico(c) },
              { sep: true },
              { label: 'Excluir colaborador', icone: 'trash', perigo: true, onClick: () => App.colabModal.remover(c).then(ok => { if (ok) App.router.go('/equipe'); }) }
            ])
          })
        ])
      ])
    ]);

    /* indicadores */
    const tiles = u.el('div.grid.u-mb-5', { style: { gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' } }, [
      tile('Meta', u.fmtMoedaCurta(ind.meta), 'do período'),
      tile('Realizado', u.fmtMoedaCurta(ind.realizado), u.plural(ind.vendas, 'venda')),
      tileMeta(ind.pctMeta),
      tile('Conversão', u.fmtPct(ind.conversao, 1), ind.leads + ' leads'),
      tile('Leads', u.fmtNum(ind.leads), 'na carteira'),
      tile('Follow-ups', u.fmtNum(ind.followups), 'no período')
    ]);

    return u.el('div', {}, [head, tiles]);
  }

  function fato(icone, txt) {
    return u.el('span.u-row.u-gap-2', {}, [
      u.el('span.t-muted2', { html: App.icon(icone, '', 14) }),
      u.el('span', { text: txt })
    ]);
  }
  function tile(l, v, s) {
    return u.el('div.stat-tile', {}, [
      u.el('div.stat-tile__l', { text: l }),
      u.el('div.stat-tile__v', { text: v }),
      s ? u.el('div.stat-tile__s', { text: s }) : null
    ]);
  }
  function tileMeta(pct) {
    const t = u.el('div.stat-tile', {}, [
      u.el('div.stat-tile__l', { text: '% da meta' }),
      u.el('div', { class: 'stat-tile__v ' + (pct >= 100 ? 't-ok' : pct < 60 ? 't-danger' : ''), text: u.fmtPct(pct) })
    ]);
    t.appendChild(u.el('div.u-mt-2', {}, [p.barraMeta(pct, false)]));
    return t;
  }

  /* ====================================================================== */
  /*  Aba: Visao geral                                                      */
  /* ====================================================================== */
  function abaVisao(alvo, c) {
    u.clear(alvo);
    const res = A.resumoPeriodo(c.id);
    const tend = A.tendencia(c.id);
    const comps = A.competenciasAtuais(c.id);
    const media = A.mediaCompetencias(c.id);

    const cols = u.el('div.grid.grid-main');
    const esq = u.el('div.u-col.u-gap-4');

    /* resumo do periodo */
    const chips = u.el('div.grid', { style: { gridTemplateColumns: 'repeat(auto-fill,minmax(108px,1fr))', gap: '10px' } }, [
      mini(res.total, 'Observações', 'brand'),
      mini(res.positivos, 'Positivos', 'ok'),
      mini(res.atencao, 'Atenção', res.atencao ? 'warn' : 'neutral'),
      mini(res.totalFeedbacks, 'Feedbacks', 'info'),
      mini(res.acoesConcluidas, 'Ações OK', 'ok'),
      mini(res.acoesPendentes, 'Pendentes', res.acoesAtrasadas ? 'danger' : 'neutral')
    ]);

    const tendTxt = { subindo: ['t-ok', 'trendUp', 'Evoluindo em relação ao período anterior'],
                      caindo: ['t-danger', 'trendDown', 'Em queda em relação ao período anterior'],
                      estavel: ['t-muted', 'arrowRight', 'Estável em relação ao período anterior'] }[tend.estado];

    esq.appendChild(u.el('div.card', {}, [
      u.el('div.card__head', {}, [
        u.el('div', {}, [
          u.el('div.card__title', { text: 'Resumo do período' }),
          u.el('div.t-sm.t-muted', { text: 'Desde ' + u.fmtDate(res.de) + ' · ' + u.plural(res.dias, 'dia') })
        ]),
        u.el('span.u-row.u-gap-2', { class: 't-sm ' + tendTxt[0] }, [
          u.el('span', { html: App.icon(tendTxt[1], '', 15) }),
          u.el('span.u-nowrap', { text: tend.estado === 'subindo' ? 'Em evolução' : tend.estado === 'caindo' ? 'Em queda' : 'Estável' })
        ])
      ]),
      u.el('div.card__body', {}, [
        chips,
        u.el('div.note.u-mt-4', { class: 'note ' + (tend.estado === 'caindo' ? 'note--warn' : 'note--brand'), text: tendTxt[2] + '.' }),
        u.el('div.u-row.u-gap-2.u-mt-4.u-wrap', {}, [
          u.el('button.btn.btn--sm.btn--soft', {
            type: 'button', html: App.icon('sparkles') + '<span>Preparar One a One</span>',
            onclick: () => App.router.go('/preparar/' + c.id)
          }),
          u.el('button.btn.btn--sm.btn--outline', {
            type: 'button', html: App.icon('chat') + '<span>Registrar feedback</span>',
            onclick: () => App.fbModal.abrir({ colaboradorId: c.id })
          })
        ])
      ])
    ]));

    /* timeline resumida */
    const eventos = A.timeline(c.id, 'todos', 8);
    esq.appendChild(u.el('div.card', {}, [
      u.el('div.card__head', {}, [
        u.el('div.card__title', { text: 'Linha do tempo' }),
        u.el('button.btn.btn--xs.btn--ghost', {
          type: 'button', html: '<span>Ver completa</span>' + App.icon('arrowRight'),
          onclick: () => App.router.go('/colaborador/' + c.id + '/evolucao')
        })
      ]),
      u.el('div.card__body', {}, [
        p.timeline(eventos, {
          acoesVazio: [{ label: 'Registrar observação', icone: 'plus', onClick: () => App.obsModal.abrir({ colaboradorId: c.id }) }]
        })
      ])
    ]));

    cols.appendChild(esq);

    /* lateral */
    const lat = u.el('div.u-col.u-gap-4');

    /* competencias */
    const avaliadas = Object.keys(comps).filter(k => comps[k]);
    lat.appendChild(u.el('div.card', {}, [
      u.el('div.card__head', {}, [
        u.el('div', {}, [
          u.el('div.card__title', { text: 'Competências' }),
          u.el('div.t-sm.t-muted', { text: avaliadas.length ? 'Média ' + media.toFixed(1).replace('.', ',') + ' / 5' : 'Ainda sem avaliação' })
        ])
      ]),
      u.el('div.card__body', {}, [
        avaliadas.length
          ? g.radar({
              eixos: cat.COMPETENCIAS.map(x => x.label.split(' ')[0]),
              series: [{ label: 'Avaliação do coordenador', valores: cat.COMPETENCIAS.map(x => comps[x.id] ? comps[x.id].nota : 0) }]
            })
          : p.vazio({
              icone: 'award', titulo: 'Sem avaliação de competências',
              desc: 'As competências são avaliadas dentro do One a One, com nota de 1 a 5 e justificativa.',
              acoes: [{ label: 'Iniciar One a One', icone: 'play', onClick: () => App.router.go('/preparar/' + c.id) }]
            })
      ])
    ]));

    /* planos abertos */
    const abertos = db.planos.abertos(c.id);
    const cardPl = u.el('div.card', {}, [
      u.el('div.card__head', {}, [
        u.el('div.card__title', { text: 'Ações em aberto' }),
        u.el('button.btn.btn--xs.btn--soft', {
          type: 'button', html: App.icon('plus') + '<span>Novo</span>',
          onclick: () => App.planoModal.abrir({ colaboradorId: c.id, aoSalvar: () => App.recarregarTela() })
        })
      ])
    ]);
    if (!abertos.length) {
      cardPl.appendChild(p.vazio({ icone: 'checkCircle', titulo: 'Nenhuma ação pendente', desc: 'Tudo o que foi combinado está concluído.' }));
    } else {
      const l = u.el('div.card__body.u-col.u-gap-2');
      abertos.forEach(pl => l.appendChild(p.cardPlano(pl, { aoAbrir: x => App.planoModal.abrir({ plano: x, aoSalvar: () => App.recarregarTela() }) })));
      cardPl.appendChild(l);
    }
    lat.appendChild(cardPl);

    cols.appendChild(lat);
    alvo.appendChild(cols);
  }

  function mini(v, l, tom) {
    return u.el('div', {
      style: {
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', padding: '11px 8px', textAlign: 'center'
      }
    }, [
      u.el('div', { class: 'stat-tile__v t-' + (tom === 'ok' ? 'ok' : tom === 'warn' ? 'warn' : tom === 'danger' ? 'danger' : tom === 'brand' ? 'brand' : ''), text: String(v) }),
      u.el('div.t-xs.t-muted2', { text: l })
    ]);
  }

  /* ====================================================================== */
  /*  Aba: Observacoes                                                      */
  /* ====================================================================== */
  function abaObservacoes(alvo, c) {
    u.clear(alvo);

    const barra = u.el('div.u-row.u-wrap.u-gap-3.u-mb-4');
    const selTipo = u.el('select.select.select--sm', { style: { width: 'auto' } });
    selTipo.appendChild(u.el('option', { value: 'todos', text: 'Todos os tipos' }));
    cat.TIPOS_OBS.forEach(t => selTipo.appendChild(u.el('option', { value: t.id, text: t.emoji + ' ' + t.label })));
    selTipo.value = filtros.obsTipo;
    selTipo.addEventListener('change', () => { filtros.obsTipo = selTipo.value; pintar(); });

    const selCtx = u.el('select.select.select--sm', { style: { width: 'auto' } });
    selCtx.appendChild(u.el('option', { value: 'todos', text: 'Todos os contextos' }));
    cat.CONTEXTOS.forEach(t => selCtx.appendChild(u.el('option', { value: t.id, text: t.emoji + ' ' + t.label })));
    selCtx.value = filtros.obsContexto;
    selCtx.addEventListener('change', () => { filtros.obsContexto = selCtx.value; pintar(); });

    const selPer = u.el('select.select.select--sm', { style: { width: 'auto' } });
    [['todos', 'Todo o histórico'], ['periodo', 'Desde o último One a One'], ['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias']]
      .forEach(([id, lb]) => selPer.appendChild(u.el('option', { value: id, text: lb })));
    selPer.value = filtros.obsPeriodo;
    selPer.addEventListener('change', () => { filtros.obsPeriodo = selPer.value; pintar(); });

    barra.appendChild(selTipo); barra.appendChild(selCtx); barra.appendChild(selPer);
    barra.appendChild(u.el('span.u-grow'));
    barra.appendChild(u.el('button.btn.btn--sm.btn--primary', {
      type: 'button', html: App.icon('plus') + '<span>Nova observação</span>',
      onclick: () => App.obsModal.abrir({ colaboradorId: c.id })
    }));
    alvo.appendChild(barra);

    const lista = u.el('div.u-col.u-gap-3');
    alvo.appendChild(lista);

    function pintar() {
      u.clear(lista);
      let obs = db.observacoes.doColaborador(c.id);
      if (filtros.obsTipo !== 'todos') obs = obs.filter(o => o.tipo === filtros.obsTipo);
      if (filtros.obsContexto !== 'todos') obs = obs.filter(o => o.contexto === filtros.obsContexto);
      if (filtros.obsPeriodo === 'periodo') {
        const de = A.inicioPeriodo(c.id);
        obs = obs.filter(o => u.diffDays(de, o.data) >= 0);
      } else if (filtros.obsPeriodo !== 'todos') {
        const n = +filtros.obsPeriodo;
        obs = obs.filter(o => u.diffDays(o.data, new Date()) <= n);
      }

      if (!obs.length) {
        lista.appendChild(u.el('div.card', {}, [p.vazio({
          icone: 'eye', titulo: 'Nenhuma observação neste filtro',
          desc: 'Registre o que você observou no dia a dia — é isso que sustenta o feedback no One a One.',
          acoes: [
            { label: 'Registrar observação', icone: 'plus', onClick: () => App.obsModal.abrir({ colaboradorId: c.id }) },
            { label: 'Limpar filtros', tipo: 'outline', onClick: () => {
              filtros.obsTipo = 'todos'; filtros.obsContexto = 'todos'; filtros.obsPeriodo = 'todos';
              selTipo.value = 'todos'; selCtx.value = 'todos'; selPer.value = 'todos'; pintar();
            } }
          ]
        })]));
        return;
      }

      const porDia = u.groupBy(obs, o => u.toISODate(o.data));
      Object.keys(porDia).sort().reverse().forEach(dia => {
        lista.appendChild(u.el('div.u-row.u-gap-2', { style: { marginTop: '6px' } }, [
          u.el('span.t-up', { text: u.fmtDateLong(dia) }),
          u.el('span.t-xs.t-muted2', { text: '· ' + u.fmtRelativo(dia) })
        ]));
        porDia[dia].forEach(o => lista.appendChild(p.cardObservacao(o, {
          aoEditar: x => App.obsModal.abrir({ observacao: x }),
          aoRemover: x => App.obsModal.remover(x)
        })));
      });
    }
    pintar();
  }

  /* ====================================================================== */
  /*  Aba: One a Ones                                                       */
  /* ====================================================================== */
  function abaOneOnes(alvo, c) {
    u.clear(alvo);
    const encontros = db.oneones.doColaborador(c.id);
    const emAndamento = db.oneones.emAndamento(c.id);

    alvo.appendChild(u.el('div.u-row.u-wrap.u-gap-3.u-mb-4', {}, [
      u.el('div', {}, [
        u.el('div.card__title', { text: 'Histórico de encontros' }),
        u.el('div.t-sm.t-muted', { text: u.plural(encontros.filter(e => e.status === 'concluido').length, 'encontro concluído', 'encontros concluídos') })
      ]),
      u.el('span.u-grow'),
      emAndamento
        ? u.el('button.btn.btn--warn.btn--primary', {
            type: 'button', html: App.icon('play') + '<span>Continuar encontro em andamento</span>',
            onclick: () => App.router.go('/one-a-one/' + emAndamento.id)
          })
        : u.el('button.btn.btn--primary', {
            type: 'button', html: App.icon('sparkles') + '<span>Preparar e iniciar</span>',
            onclick: () => App.router.go('/preparar/' + c.id)
          })
    ]));

    if (!encontros.length) {
      alvo.appendChild(u.el('div.card', {}, [p.vazio({
        icone: 'handshake', titulo: 'Nenhum One a One registrado',
        desc: 'O sistema monta a preparação automaticamente com tudo o que você registrou desde o último encontro.',
        acoes: [{ label: 'Preparar o primeiro', icone: 'sparkles', onClick: () => App.router.go('/preparar/' + c.id) }]
      })]));
      return;
    }

    const grid = u.el('div.grid.grid-wide.stagger');
    encontros.forEach(e => {
      const st = cat.status1a1(e.status);
      const r = e.roteiro || {};
      const comps = Object.keys(e.competencias || {}).filter(k => e.competencias[k] && e.competencias[k].nota);
      const mediaC = comps.length ? (u.sum(comps, k => e.competencias[k].nota) / comps.length) : null;

      grid.appendChild(u.el('div.card.card--hover.card--pad', {
        onclick: () => App.router.go('/one-a-one/' + e.id),
        role: 'button', tabindex: '0'
      }, [
        u.el('div.u-between.u-gap-2.u-mb-3', {}, [
          u.el('div', {}, [
            u.el('div.t-semi', { text: u.fmtDateLong(e.data) }),
            u.el('div.t-xs.t-muted', { text: u.fmtWeekday(e.data) + ' · ' + u.fmtRelativo(e.data) + (e.duracaoMin ? ' · ' + e.duracaoMin + ' min' : '') })
          ]),
          u.el('span', { class: 'badge badge--' + (st.tom === 'neutral' ? 'outline' : st.tom), text: st.label })
        ]),
        r.fechamento ? u.el('div.t-sm.u-clamp-3', { style: { color: 'var(--text-2)' }, text: r.fechamento }) : null,
        u.el('div.u-row.u-wrap.u-gap-2.u-mt-3', {}, [
          (r.compromissos || []).length ? u.el('span.badge.badge--brand', { text: u.plural(r.compromissos.length, 'compromisso') }) : null,
          (e.observacoesDiscutidas || []).length ? u.el('span.badge.badge--outline', { text: u.plural(e.observacoesDiscutidas.length, 'evidência discutida', 'evidências discutidas') }) : null,
          mediaC ? u.el('span.badge.badge--info', { text: 'Competências ' + mediaC.toFixed(1).replace('.', ',') + '/5' }) : null
        ])
      ]));
    });
    alvo.appendChild(grid);
  }

  /* ====================================================================== */
  /*  Aba: Feedbacks                                                        */
  /* ====================================================================== */
  function abaFeedbacks(alvo, c) {
    u.clear(alvo);
    const fbs = db.feedbacks.doColaborador(c.id);

    alvo.appendChild(u.el('div.u-row.u-wrap.u-gap-3.u-mb-4', {}, [
      u.el('div', {}, [
        u.el('div.card__title', { text: 'Feedbacks registrados' }),
        u.el('div.t-sm.t-muted', { text: 'Fato → impacto → comportamento esperado → ação' })
      ]),
      u.el('span.u-grow'),
      u.el('button.btn.btn--primary', {
        type: 'button', html: App.icon('plus') + '<span>Novo feedback</span>',
        onclick: () => App.fbModal.abrir({ colaboradorId: c.id })
      })
    ]));

    if (!fbs.length) {
      alvo.appendChild(u.el('div.card', {}, [p.vazio({
        icone: 'chat', titulo: 'Nenhum feedback formal ainda',
        desc: 'O feedback estruturado transforma a observação em conversa de desenvolvimento.',
        acoes: [{ label: 'Registrar feedback', icone: 'plus', onClick: () => App.fbModal.abrir({ colaboradorId: c.id }) }]
      })]));
      return;
    }

    const grid = u.el('div.grid.grid-wide.stagger');
    fbs.forEach(f => grid.appendChild(p.cardFeedback(f, {
      aoEditar: x => App.fbModal.abrir({ feedback: x }),
      aoRemover: x => App.fbModal.remover(x)
    })));
    alvo.appendChild(grid);
  }

  /* ====================================================================== */
  /*  Aba: Plano de desenvolvimento                                         */
  /* ====================================================================== */
  function abaPlano(alvo, c) {
    u.clear(alvo);
    const planos = db.planos.doColaborador(c.id);

    alvo.appendChild(u.el('div.u-row.u-wrap.u-gap-3.u-mb-4', {}, [
      u.el('div', {}, [
        u.el('div.card__title', { text: 'Plano de desenvolvimento' }),
        u.el('div.t-sm.t-muted', { text: 'O que foi combinado, com dono, prazo e indicador de sucesso.' })
      ]),
      u.el('span.u-grow'),
      u.el('button.btn.btn--primary', {
        type: 'button', html: App.icon('plus') + '<span>Novo plano</span>',
        onclick: () => App.planoModal.abrir({ colaboradorId: c.id, aoSalvar: () => App.recarregarTela() })
      })
    ]));

    if (!planos.length) {
      alvo.appendChild(u.el('div.card', {}, [p.vazio({
        icone: 'flag', titulo: 'Nenhum plano de ação',
        desc: 'Sem plano, o One a One vira conversa solta. Defina o ponto, a ação, o prazo e como medir.',
        acoes: [{ label: 'Criar plano de ação', icone: 'plus', onClick: () => App.planoModal.abrir({ colaboradorId: c.id, aoSalvar: () => App.recarregarTela() }) }]
      })]));
      return;
    }

    alvo.appendChild(App.pages.planos.kanban(planos, { comColaborador: false }));

    /* historico em tabela */
    const tb = u.el('tbody');
    u.sortBy(planos, x => x.prazo || '9999', 'desc').forEach(pl => {
      const st = db.planos.statusEfetivo(pl);
      tb.appendChild(u.el('tr', { onclick: () => App.planoModal.abrir({ plano: pl, aoSalvar: () => App.recarregarTela() }) }, [
        u.el('td', {}, [
          u.el('div.t-semi', { text: pl.ponto }),
          pl.acao ? u.el('div.t-xs.t-muted.u-clamp-2', { text: pl.acao }) : null
        ]),
        u.el('td', { class: 't-sm', text: pl.indicador || '—' }),
        u.el('td', { class: 't-sm u-nowrap', text: pl.inicio ? u.fmtDate(pl.inicio) : '—' }),
        u.el('td', { class: 't-sm u-nowrap' + (st === 'atrasado' ? ' t-danger t-strong' : ''), text: pl.prazo ? u.fmtDate(pl.prazo) : '—' }),
        u.el('td', {}, [p.badgeStatusPlano(st)])
      ]));
    });
    alvo.appendChild(u.el('div.card.u-mt-5', {}, [
      u.el('div.card__head', {}, [u.el('div.card__title', { text: 'Todos os planos' })]),
      u.el('div.tbl-wrap', {}, [u.el('table.tbl.tbl--click', {}, [
        u.el('thead', {}, [u.el('tr', {}, ['Ponto a desenvolver', 'Indicador de sucesso', 'Início', 'Prazo', 'Status']
          .map(h => u.el('th', { text: h })))]),
        tb
      ])])
    ]));
  }

  /* ====================================================================== */
  /*  Aba: Evolucao                                                         */
  /* ====================================================================== */
  function abaEvolucao(alvo, c) {
    u.clear(alvo);

    /* --- timeline com filtros --- */
    const eventosTodos = A.timeline(c.id, 'todos');
    const contagens = { todos: eventosTodos.length };
    cat.TIPOS_TIMELINE.forEach(t => {
      if (t.id !== 'todos') contagens[t.id] = eventosTodos.filter(e => e.grupo === t.id).length;
    });

    const cardTl = u.el('div.card.u-mb-5');
    cardTl.appendChild(u.el('div.card__head', {}, [
      u.el('div', {}, [
        u.el('div.card__title', { text: 'Linha do tempo' }),
        u.el('div.t-sm.t-muted', { text: 'Todo o histórico de acompanhamento' })
      ])
    ]));
    const corpoTl = u.el('div.card__body');
    const filtroBox = u.el('div.u-mb-4');
    corpoTl.appendChild(filtroBox);
    const listaTl = u.el('div');
    corpoTl.appendChild(listaTl);
    cardTl.appendChild(corpoTl);

    function pintarTl() {
      u.clear(filtroBox);
      filtroBox.appendChild(p.filtrosTimeline(filtros.timeline, v => { filtros.timeline = v; pintarTl(); }, contagens));
      u.clear(listaTl);
      listaTl.appendChild(p.timeline(A.timeline(c.id, filtros.timeline), {
        acoesVazio: [{ label: 'Registrar observação', icone: 'plus', onClick: () => App.obsModal.abrir({ colaboradorId: c.id }) }]
      }));
    }
    pintarTl();
    alvo.appendChild(cardTl);

    /* --- graficos --- */
    const hist = A.historico(c);
    const grid = u.el('div.grid.grid-2');

    grid.appendChild(g.card({
      titulo: 'Meta x realizado', desc: 'Evolução mensal',
      grafico: () => hist.length
        ? g.linha({
            labels: hist.map(h => u.fmtMesAno(h.mes + '-01')),
            series: [
              { label: 'Realizado', valores: hist.map(h => h.realizado), cor: g.cor(0) },
              { label: 'Meta', valores: hist.map(h => h.meta), cor: g.cor(1) }
            ],
            formatar: v => u.fmtMoedaCurta(v), altura: 220
          })
        : p.vazio({ icone: 'chart', titulo: 'Sem histórico mensal', desc: 'Preencha o histórico no cadastro para ver a curva de performance.' }),
      tabela: () => hist.length ? g.tabela(hist.map(h => u.fmtMesAno(h.mes + '-01')), [
        { label: 'Realizado', valores: hist.map(h => h.realizado) },
        { label: 'Meta', valores: hist.map(h => h.meta) }
      ], v => u.fmtMoeda(v)) : u.el('div.chart-empty', { text: 'Sem dados.' })
    }));

    const serieObs = A.serieObservacoes(30, c.id);
    grid.appendChild(g.card({
      titulo: 'Positivos x pontos de atenção', desc: 'Últimos 30 dias',
      grafico: () => g.barras({
        labels: serieObs.map(s => s.label), altura: 220, empilhado: false,
        series: [
          { label: 'Positivos', valores: serieObs.map(s => s.positivo), cor: g.STATUS.bom },
          { label: 'Atenção', valores: serieObs.map(s => s.atencao), cor: g.STATUS.critico }
        ],
        msgVazio: 'Sem observações no período.'
      }),
      tabela: () => g.tabela(serieObs.map(s => s.label), [
        { label: 'Positivos', valores: serieObs.map(s => s.positivo) },
        { label: 'Atenção', valores: serieObs.map(s => s.atencao) }
      ])
    }));

    /* evolucao de competencias */
    const evo = A.evolucaoCompetencias(c.id);
    if (evo.datas.length >= 2) {
      const labels = evo.datas.map(d => u.fmtDate(d, false));
      const series = evo.series.filter(s => s.valores.some(v => v !== null)).slice(0, 4).map((s, i) => ({
        label: s.label, valores: s.valores, cor: g.cor(i)
      }));
      grid.appendChild(g.card({
        titulo: 'Evolução das competências', desc: 'Nota por encontro (as 4 primeiras competências)',
        grafico: () => g.linha({ labels, series, altura: 220, maxSugerido: 5, area: false, formatar: v => v.toFixed(0) }),
        tabela: () => g.tabela(labels, series, v => (v ? v.toFixed(0) : '—'))
      }));
    }

    /* distribuicao por tipo */
    const dist = A.distribuicaoTipos(c.id);
    grid.appendChild(g.card({
      titulo: 'Distribuição das observações', desc: 'Por tipo de registro',
      grafico: () => g.donut({
        itens: g.dobrarEmOutros(dist.map((d, i) => ({ label: d.label, valor: d.total, emoji: d.emoji, cor: g.cor(i) }))),
        centroTitulo: 'observações',
        msgVazio: 'Nenhuma observação registrada.'
      }),
      tabela: () => g.tabela(dist.map(d => d.label), [{ label: 'Registros', valores: dist.map(d => d.total) }])
    }));

    alvo.appendChild(grid);

    /* deltas de competencia */
    const deltas = A.deltaCompetencias(c.id);
    if (deltas.length) {
      const l = u.el('div.card__body.u-col.u-gap-3');
      deltas.forEach(d => {
        l.appendChild(u.el('div.u-between.u-gap-3', {}, [
          u.el('span.t-md.t-semi', { text: d.label }),
          u.el('span.u-row.u-gap-2', {}, [
            u.el('span.t-sm.t-muted', { text: d.de + ' → ' + d.para }),
            u.el('span', {
              class: 'badge badge--' + (d.delta > 0 ? 'ok' : 'danger'),
              text: (d.delta > 0 ? '+' : '') + d.delta
            })
          ])
        ]));
      });
      alvo.appendChild(u.el('div.card.u-mt-5', {}, [
        u.el('div.card__head', {}, [
          u.el('div', {}, [
            u.el('div.card__title', { text: 'O que mudou nas competências' }),
            u.el('div.t-sm.t-muted', { text: 'Comparando os dois últimos One a Ones' })
          ])
        ]), l
      ]));
    }

    /* comparativo auto x coordenador */
    const comp = A.comparativoAuto(c.id);
    if (comp) {
      alvo.appendChild(u.el('div.card.u-mt-5', {}, [
        u.el('div.card__head', {}, [
          u.el('div', {}, [
            u.el('div.card__title', { text: 'Autoavaliação x avaliação do coordenador' }),
            u.el('div.t-sm.t-muted', { text: 'Autoavaliação de ' + u.fmtDate(comp.data) })
          ])
        ]),
        u.el('div.card__body', {}, [
          g.radar({
            eixos: comp.linhas.map(l => l.label.split(' ')[0]),
            series: [
              { label: 'Autoavaliação', valores: comp.linhas.map(l => l.auto || 0), cor: g.cor(1) },
              { label: 'Coordenador', valores: comp.linhas.map(l => l.coord || 0), cor: g.cor(0) }
            ]
          }),
          u.el('div.u-mt-4', {}, [g.tabela(comp.linhas.map(l => l.label), [
            { label: 'Autoavaliação', valores: comp.linhas.map(l => l.auto) },
            { label: 'Coordenador', valores: comp.linhas.map(l => l.coord) }
          ], v => (v ? v + '/5' : '—'))])
        ])
      ]));
    }
  }

  /* ====================================================================== */
  /*  Aba: Evidencias                                                       */
  /* ====================================================================== */
  function todasEvidencias(colabId) {
    const out = [];
    db.observacoes.doColaborador(colabId).forEach(o =>
      (o.evidencias || []).forEach(e => out.push({ ev: e, origem: 'Observação', data: o.data, texto: o.texto, ref: o, rota: 'observacoes' })));
    db.feedbacks.doColaborador(colabId).forEach(f =>
      (f.evidencias || []).forEach(e => out.push({ ev: e, origem: 'Feedback', data: f.data, texto: f.oQueAconteceu, ref: f, rota: 'feedbacks' })));
    return u.sortBy(out, x => x.data, 'desc');
  }

  function abaEvidencias(alvo, c) {
    u.clear(alvo);
    const lista = todasEvidencias(c.id);

    alvo.appendChild(u.el('div.u-row.u-wrap.u-gap-3.u-mb-4', {}, [
      u.el('div', {}, [
        u.el('div.card__title', { text: 'Evidências' }),
        u.el('div.t-sm.t-muted', { text: 'Tudo o que foi anexado a observações e feedbacks' })
      ])
    ]));

    if (!lista.length) {
      alvo.appendChild(u.el('div.card', {}, [p.vazio({
        icone: 'paperclip', titulo: 'Nenhuma evidência anexada',
        desc: 'Prints, gravações, PDFs e links tornam o feedback concreto — e muito mais fácil de sustentar na conversa.',
        acoes: [{ label: 'Registrar com evidência', icone: 'plus', onClick: () => App.obsModal.abrir({ colaboradorId: c.id }) }]
      })]));
      return;
    }

    const grid = u.el('div.grid.grid-cards.stagger');
    lista.forEach(x => {
      grid.appendChild(u.el('div.card.card--pad-sm.card--hover', {}, [
        u.el('div.u-between.u-gap-2.u-mb-3', {}, [
          u.el('span.badge.badge--outline', { text: x.origem }),
          u.el('span.tl__date', { text: u.fmtDate(x.data) })
        ]),
        p.evidencia(x.ev),
        u.el('div.t-sm.t-muted.u-clamp-3.u-mt-3', { text: x.texto }),
        u.el('button.btn.btn--xs.btn--ghost.u-mt-2', {
          type: 'button', html: '<span>Ver registro</span>' + App.icon('arrowRight'),
          onclick: () => App.router.go('/colaborador/' + c.id + '/' + x.rota)
        })
      ]));
    });
    alvo.appendChild(grid);
  }

  /* ====================================================================== */
  /*  Exportar historico                                                    */
  /* ====================================================================== */
  function exportarHistorico(c) {
    const L = [];
    const ind = A.indicadores(c);
    L.push('HISTÓRICO DE DESENVOLVIMENTO — ' + c.nome);
    L.push(c.cargo + ' · ' + u.tempoDeCasa(c.dataEntrada) + ' de casa · gerado em ' + u.fmtDateTime(new Date()));
    L.push('');
    L.push('INDICADORES: meta ' + u.fmtMoeda(ind.meta) + ' · realizado ' + u.fmtMoeda(ind.realizado) +
      ' (' + u.fmtPct(ind.pctMeta) + ') · ' + ind.vendas + ' vendas · conversão ' + u.fmtPct(ind.conversao, 1));
    L.push('');

    L.push('== ONE A ONES ==');
    db.oneones.doColaborador(c.id).forEach(e => {
      const r = e.roteiro || {};
      L.push('');
      L.push('— ' + u.fmtDateLong(e.data) + ' (' + cat.status1a1(e.status).label + ')');
      if (r.comoEsta) L.push('  Como está: ' + r.comoEsta);
      if (r.conquistas) L.push('  Conquistas: ' + r.conquistas);
      if (r.dificuldades) L.push('  Dificuldades: ' + r.dificuldades);
      (r.compromissos || []).forEach(x => L.push('  Compromisso: ' + x));
      if (r.fechamento) L.push('  Fechamento: ' + r.fechamento);
    });

    L.push(''); L.push('== FEEDBACKS ==');
    db.feedbacks.doColaborador(c.id).forEach(f => {
      L.push('');
      L.push('— ' + u.fmtDate(f.data) + ' · ' + cat.classif(f.classificacao).label);
      L.push('  O que aconteceu: ' + f.oQueAconteceu);
      if (f.impacto) L.push('  Impacto: ' + f.impacto);
      if (f.oQueDeveria) L.push('  Esperado: ' + f.oQueDeveria);
      if (f.comoMelhorar) L.push('  Ação: ' + f.comoMelhorar);
    });

    L.push(''); L.push('== PLANOS DE AÇÃO ==');
    db.planos.doColaborador(c.id).forEach(pl => {
      L.push('— [' + cat.statusPlano(db.planos.statusEfetivo(pl)).label + '] ' + pl.ponto +
        ' | ação: ' + pl.acao + ' | prazo: ' + (pl.prazo ? u.fmtDate(pl.prazo) : '—') +
        (pl.indicador ? ' | indicador: ' + pl.indicador : ''));
    });

    L.push(''); L.push('== OBSERVAÇÕES ==');
    db.observacoes.doColaborador(c.id).forEach(o => {
      L.push('— ' + u.fmtDateTime(o.data) + ' [' + cat.tipoObs(o.tipo).label + ' · ' +
        cat.contexto(o.contexto).label + ' · impacto ' + cat.impacto(o.impacto).label + '] ' + o.texto);
    });

    u.baixarArquivo('historico-' + u.slug(c.nome) + '-' + u.today() + '.txt', L.join('\r\n'));
    App.toast.ok('Histórico exportado', c.nome);
  }

  App.pages = App.pages || {};
  App.pages.perfil = { render, titulo: 'Perfil do colaborador' };
})(window.App);
