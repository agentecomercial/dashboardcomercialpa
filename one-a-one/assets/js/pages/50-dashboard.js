/* =========================================================================
   pages/50-dashboard.js — Dashboard executivo do coordenador.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, g = App.g, db = App.db, A = App.analise, cat = App.cat;

  function render(view) {
    const cfg = db.config.get('coordenador', {}) || {};
    const r = A.resumoEquipe();
    const box = u.el('div.view__inner');

    /* ============================== HERO ============================== */
    const hero = u.el('div.hero.anim-rise', {}, [
      u.el('div.hero__grid', {}, [
        u.el('div', {}, [
          u.el('div.hero__hi', { text: u.saudacao() + (cfg.nome ? ', ' + u.primeiroNome(cfg.nome) : '') + '!' }),
          u.el('div.hero__sub', {
            text: r.oneOnesAtrasados
              ? u.plural(r.oneOnesAtrasados, 'One a One atrasado', 'One a Ones atrasados') + ' pedindo atenção. ' +
                u.plural(r.observacoes7, 'observação registrada', 'observações registradas') + ' nos últimos 7 dias.'
              : 'Nenhum One a One atrasado. ' + u.plural(r.observacoes7, 'observação registrada', 'observações registradas') + ' nos últimos 7 dias.'
          }),
          u.el('div.u-row.u-gap-2.u-mt-4.u-wrap', {}, [
            u.el('button.btn.btn--lg', {
              type: 'button',
              style: { background: '#fff', color: '#1b2140' },
              html: App.icon('plus') + '<span>Nova observação</span>',
              onclick: () => App.obsModal.abrir()
            }),
            u.el('button.btn.btn--lg', {
              type: 'button',
              style: { background: 'rgba(255,255,255,.13)', color: '#fff', border: '1px solid rgba(255,255,255,.22)' },
              html: App.icon('handshake') + '<span>Preparar One a One</span>',
              onclick: () => App.router.go('/one-a-one')
            })
          ])
        ]),
        u.el('div.hero__stats', {}, [
          estatHero(r.totalColaboradores, 'na equipe'),
          estatHero(r.observacoesTotal, 'observações'),
          estatHero(r.encontrosTotal, 'one a ones'),
          estatHero(u.fmtPct(r.pctMeta), 'da meta')
        ])
      ]),
      u.el('div.hero__flow', {}, montarFluxo())
    ]);
    box.appendChild(hero);

    /* ============================== KPIs ============================== */
    const kpis = u.el('div.grid.grid-kpi.stagger.u-mb-5', {}, [
      p.kpi({
        label: 'Colaboradores', valor: r.totalColaboradores, icone: 'users', tom: 'brand',
        rodape: r.totalInativos ? '<span class="t-muted2">' + r.totalInativos + ' inativo(s)</span>' : '<span class="t-muted2">Todos ativos</span>',
        onClick: () => App.router.go('/equipe')
      }),
      p.kpi({
        label: 'One a Ones próximos', valor: r.oneOnesProximos, icone: 'calendar', tom: 'info',
        rodape: '<span class="t-muted2">Nos próximos 7 dias</span>',
        onClick: () => App.router.go('/one-a-one')
      }),
      p.kpi({
        label: 'One a Ones atrasados', valor: r.oneOnesAtrasados, icone: 'alert',
        tom: r.oneOnesAtrasados ? 'danger' : 'ok',
        rodape: r.oneOnesAtrasados
          ? '<span class="t-danger t-strong">Precisa reagendar</span>'
          : '<span class="t-ok t-strong">Agenda em dia</span>',
        onClick: () => App.router.go('/one-a-one?filtro=atrasados')
      }),
      p.kpi({
        label: 'Observações registradas', valor: r.observacoesTotal, icone: 'eye', tom: 'purple',
        rodape: '<span class="t-muted2">' + r.observacoes30 + ' nos últimos 30 dias</span>',
        onClick: () => App.router.go('/observacoes')
      }),
      p.kpi({
        label: 'Planos em andamento', valor: r.planosAbertos, icone: 'flag', tom: 'warn',
        rodape: '<span class="t-muted2">' + r.planosConcluidos + ' já concluídos</span>',
        onClick: () => App.router.go('/planos')
      }),
      p.kpi({
        label: 'Planos atrasados', valor: r.planosAtrasados, icone: 'clock',
        tom: r.planosAtrasados ? 'danger' : 'ok',
        rodape: r.planosAtrasados
          ? '<span class="t-danger t-strong">Cobrar no próximo encontro</span>'
          : '<span class="t-ok t-strong">Nada vencido</span>',
        onClick: () => App.router.go('/planos?status=atrasado')
      })
    ]);
    box.appendChild(kpis);

    /* ====================== PRÓXIMOS ONE A ONES ====================== */
    const proximos = u.sortBy(db.colaboradores.ativos().map(c => {
      const s = A.situacao1a1(c);
      return { c, s, ordem: s.dias === null ? 9999 : s.dias };
    }), x => x.ordem).slice(0, 6);

    const secProx = u.el('section.u-mb-5', {}, [
      p.secao('Próximos One a Ones',
        u.el('button.btn.btn--sm.btn--ghost', {
          type: 'button', html: '<span>Ver todos</span>' + App.icon('arrowRight'),
          onclick: () => App.router.go('/one-a-one')
        }),
        'Ordenados por urgência — quem está mais atrasado aparece primeiro.')
    ]);

    if (!proximos.length) {
      secProx.appendChild(u.el('div.card', {}, [p.vazio({
        icone: 'users', titulo: 'Nenhum colaborador cadastrado',
        desc: 'Cadastre sua equipe para começar a registrar observações e conduzir One a Ones estruturados. Se quiser ver o sistema em funcionamento antes, consulte os exemplos.',
        acoes: [
          { label: 'Cadastrar colaborador', icone: 'userPlus', onClick: () => App.colabModal.abrir() },
        { label: 'Ver exemplos', tipo: 'outline', icone: 'sparkles', onClick: () => App.router.go('/config/exemplos') }
        ]
      })]));
    } else {
      const grid = u.el('div.grid.grid-cards.stagger');
      proximos.forEach(({ c, s }) => grid.appendChild(cardProximo(c, s)));
      secProx.appendChild(grid);
    }
    box.appendChild(secProx);

    /* ============ ATENÇÃO DO COORDENADOR + ATIVIDADE ============ */
    const colunas = u.el('div.grid.grid-main');

    /* ---- Atenção ---- */
    const alertas = A.alertas().slice(0, 8);
    const cardAlertas = u.el('div.card', {}, [
      u.el('div.card__head', {}, [
        u.el('div.u-row.u-gap-2', {}, [
          u.el('span.kpi__icon.tone-danger', { html: App.icon('alert') }),
          u.el('div', {}, [
            u.el('div.card__title', { text: 'Atenção do coordenador' }),
            u.el('div.t-sm.t-muted', { text: 'O que o sistema detectou sozinho nos seus registros' })
          ])
        ]),
        alertas.length ? u.el('span.badge.badge--danger', { text: String(A.alertas().length) }) : null
      ])
    ]);
    if (!alertas.length) {
      cardAlertas.appendChild(p.vazio({
        icone: 'checkCircle', titulo: 'Nada crítico agora',
        desc: 'Sem One a One atrasado, plano vencido ou concentração de pontos de atenção.'
      }));
    } else {
      const lista = u.el('div');
      alertas.forEach(a => {
        const colab = a.colaboradorId ? db.colaboradores.por(a.colaboradorId) : null;
        lista.appendChild(u.el('button.alert-row.alert-row--' + a.tom, {
          type: 'button', onclick: () => App.router.go(a.rota.replace('#', ''))
        }, [
          colab ? p.avatar(colab, 'sm') : u.el('span.alert-row__ic.tone-' + a.tom, { html: App.icon(a.icone) }),
          u.el('div.u-grow', { style: { minWidth: 0 } }, [
            u.el('div.alert-row__t', { text: a.titulo }),
            u.el('div.alert-row__d', { text: a.desc })
          ]),
          u.el('span.t-muted2', { html: App.icon('chevronRight') })
        ]));
      });
      cardAlertas.appendChild(lista);
      if (A.alertas().length > 8) {
        cardAlertas.appendChild(u.el('div.card__foot.u-center', {}, [
          u.el('button.btn.btn--sm.btn--ghost', {
            type: 'button', text: 'Ver todas as ' + A.alertas().length + ' pendências',
            onclick: () => App.notificacoes.abrir()
          })
        ]));
      }
    }
    colunas.appendChild(cardAlertas);

    /* ---- Coluna lateral ---- */
    const lateral = u.el('div.u-col.u-gap-4');

    /* pulso de observações */
    const serie = A.serieObservacoes(21);
    lateral.appendChild(u.el('div.card', {}, [
      u.el('div.card__head', {}, [
        u.el('div', {}, [
          u.el('div.card__title', { text: 'Pulso de registros' }),
          u.el('div.t-sm.t-muted', { text: 'Últimos 21 dias' })
        ])
      ]),
      u.el('div.card__body', {}, [
        g.barras({
          labels: serie.map(s => s.label), altura: 190, empilhado: true,
          series: [
            { label: 'Positivos', valores: serie.map(s => s.positivo), cor: g.STATUS.bom },
            { label: 'Neutros', valores: serie.map(s => s.neutro), cor: 'var(--border-strong)' },
            { label: 'Atenção', valores: serie.map(s => s.atencao), cor: g.STATUS.critico }
          ],
          msgVazio: 'Registre observações para acompanhar o pulso da equipe.'
        })
      ])
    ]));

    /* últimas observações */
    const recentes = db.observacoes.recentes(5);
    const cardRec = u.el('div.card', {}, [
      u.el('div.card__head', {}, [
        u.el('div.card__title', { text: 'Últimos registros' }),
        u.el('button.btn.btn--xs.btn--ghost', {
          type: 'button', text: 'Ver todos', onclick: () => App.router.go('/observacoes')
        })
      ])
    ]);
    if (!recentes.length) {
      cardRec.appendChild(p.vazio({
        icone: 'eye', titulo: 'Nenhuma observação ainda',
        desc: 'O primeiro registro leva 20 segundos.',
        acoes: [{ label: 'Registrar agora', icone: 'plus', onClick: () => App.obsModal.abrir() }]
      }));
    } else {
      const l = u.el('div');
      recentes.forEach(o => {
        const t = cat.tipoObs(o.tipo);
        const colab = db.colaboradores.por(o.colaboradorId);
        l.appendChild(u.el('button.list-row', {
          type: 'button',
          onclick: () => App.router.go('/colaborador/' + o.colaboradorId + '/observacoes')
        }, [
          u.el('span.cmdk__ic.tone-' + (t.tom === 'neutral' ? 'neutral' : t.tom), { text: t.emoji }),
          u.el('div.u-grow', { style: { minWidth: 0 } }, [
            u.el('div.t-sm.u-clamp-2', { style: { color: 'var(--text-2)' }, text: o.texto }),
            u.el('div.t-xs.t-muted2', { style: { marginTop: '3px' }, text: (colab ? u.primeiroNome(colab.nome) : '—') + ' · ' + u.fmtRelativo(o.data) })
          ])
        ]));
      });
      cardRec.appendChild(l);
    }
    lateral.appendChild(cardRec);

    colunas.appendChild(lateral);
    box.appendChild(colunas);

    u.clear(view);
    view.appendChild(box);
  }

  function estatHero(valor, rotulo) {
    return u.el('div', {}, [
      u.el('div.hero__stat-v', { text: String(valor) }),
      u.el('div.hero__stat-l', { text: rotulo })
    ]);
  }

  function montarFluxo() {
    const passos = ['Observação', 'Registro', 'Evidência', 'One a One', 'Feedback', 'Plano', 'Acompanhamento', 'Evolução'];
    const out = [];
    passos.forEach((s, i) => {
      out.push(u.el('span.hero__flow-step', { text: s }));
      if (i < passos.length - 1) out.push(u.el('span.hero__flow-arrow', { text: '→' }));
    });
    return out;
  }

  function cardProximo(c, s) {
    const res = A.resumoPeriodo(c.id);
    const tend = A.tendencia(c.id);
    const pendentes = db.planos.abertos(c.id).length;

    const estadoClasse = s.estado === 'atrasado' ? '.is-late'
      : (s.estado === 'hoje' || s.estado === 'proximo') ? '.is-soon' : '';

    const evolucao = {
      subindo: ['trendUp', 't-ok', 'Em evolução'],
      caindo: ['trendDown', 't-danger', 'Em queda'],
      estavel: ['arrowRight', 't-muted', 'Estável']
    }[tend.estado];

    return u.el('div.card.card--hover.next-card', {
      onclick: () => App.router.go('/preparar/' + c.id),
      role: 'button', tabindex: '0',
      onkeydown: ev => { if (ev.key === 'Enter') App.router.go('/preparar/' + c.id); }
    }, [
      u.el('div.next-card__top', {}, [
        p.avatar(c, 'lg', true),
        u.el('div.u-grow', { style: { minWidth: 0 } }, [
          u.el('div.person-card__name.u-truncate', { text: c.nome }),
          u.el('div.person-card__role.u-truncate', { text: c.cargo }),
          u.el('div.u-row.u-gap-2', { style: { marginTop: '5px' } }, [
            u.el('span', { class: 't-xs ' + evolucao[1], html: App.icon(evolucao[0], '', 13) }),
            u.el('span', { class: 't-xs ' + evolucao[1], text: evolucao[2] })
          ])
        ])
      ]),
      u.el('div.next-card__when' + estadoClasse, {}, [
        u.el('span.u-row.u-gap-2', {}, [
          u.el('span', { html: App.icon('calendar', '', 14) }),
          u.el('span', { text: s.proximo ? u.fmtDate(s.proximo) : 'Sem data definida' })
        ]),
        u.el('span.t-strong', {
          text: s.dias === null ? '—'
            : s.dias === 0 ? 'hoje'
            : s.dias < 0 ? Math.abs(s.dias) + 'd atrasado'
            : 'em ' + s.dias + 'd'
        })
      ]),
      u.el('div.next-card__mini', {}, [
        miniStat(res.total, 'registros'),
        miniStat(res.atencao, 'atenção'),
        miniStat(pendentes, 'ações')
      ]),
      u.el('button.btn.btn--sm.btn--soft.btn--block', {
        type: 'button',
        html: App.icon('sparkles') + '<span>Preparar One a One</span>',
        onclick: ev => { ev.stopPropagation(); App.router.go('/preparar/' + c.id); }
      })
    ]);
  }

  function miniStat(v, l) {
    return u.el('div', {}, [u.el('b', { text: String(v) }), u.el('span', { text: l })]);
  }

  App.pages = App.pages || {};
  App.pages.dashboard = { render, titulo: 'Dashboard', sub: 'Visão geral da equipe' };
})(window.App);
