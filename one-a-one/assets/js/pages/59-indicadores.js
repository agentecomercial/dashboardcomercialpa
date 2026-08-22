/* =========================================================================
   pages/59-indicadores.js — Indicadores da equipe e evolucao.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, g = App.g, db = App.db, A = App.analise, cat = App.cat;

  const est = { janela: 30 };

  function render(view) {
    const box = u.el('div.view__inner');
    const r = A.resumoEquipe();

    box.appendChild(u.el('div.page-head', {}, [
      u.el('div', {}, [
        u.el('div.page-head__title', { text: 'Indicadores' }),
        u.el('div.page-head__desc', { text: 'Como a equipe está evoluindo em performance, acompanhamento e desenvolvimento.' })
      ]),
      u.el('div.seg', {}, [7, 30, 90].map(n => u.el('button.seg__btn' + (est.janela === n ? '.is-on' : ''), {
        type: 'button', text: n + ' dias',
        onclick: ev => {
          est.janela = n;
          u.$$('.seg__btn', ev.currentTarget.parentNode).forEach(b => b.classList.remove('is-on'));
          ev.currentTarget.classList.add('is-on');
          App.recarregarTela();
        }
      })))
    ]));

    if (!db.colaboradores.ativos().length) {
      box.appendChild(u.el('div.card', {}, [p.vazio({
        icone: 'chart', titulo: 'Sem dados para analisar',
        desc: 'Cadastre a equipe e registre observações para os indicadores ganharem vida.',
        acoes: [
          { label: 'Cadastrar colaborador', icone: 'userPlus', onClick: () => App.colabModal.abrir() },
        { label: 'Ver exemplos', tipo: 'outline', icone: 'sparkles', onClick: () => App.router.go('/config/exemplos') }
        ]
      })]));
      u.clear(view); view.appendChild(box);
      return;
    }

    /* ------------------------------ KPIs ------------------------------ */
    box.appendChild(u.el('div.grid.grid-kpi.u-mb-5.stagger', {}, [
      p.kpi({
        label: 'Meta da equipe', valor: u.fmtMoedaCurta(r.metaTotal), icone: 'target', tom: 'brand',
        rodape: '<span class="t-muted2">Realizado ' + u.fmtMoedaCurta(r.realTotal) + '</span>'
      }),
      p.kpi({
        label: '% da meta', valor: u.fmtPct(r.pctMeta), icone: 'trendUp',
        tom: r.pctMeta >= 100 ? 'ok' : r.pctMeta >= 80 ? 'warn' : 'danger'
      }),
      p.kpi({ label: 'Observações (30d)', valor: r.observacoes30, icone: 'eye', tom: 'purple' }),
      p.kpi({ label: 'Feedbacks', valor: r.feedbacksTotal, icone: 'chat', tom: 'info' }),
      p.kpi({ label: 'One a Ones', valor: r.encontrosTotal, icone: 'handshake', tom: 'ok' }),
      p.kpi({
        label: 'Planos concluídos', valor: r.planosConcluidos, icone: 'checkCircle', tom: 'ok',
        rodape: '<span class="t-muted2">' + r.planosAbertos + ' em aberto</span>'
      })
    ]));

    const grid = u.el('div.grid.grid-2');

    /* --------------------- Ranking de meta --------------------- */
    const rank = A.rankingMeta();
    grid.appendChild(g.card({
      titulo: 'Ranking de meta', desc: 'Percentual atingido por colaborador',
      grafico: () => g.ranking({
        itens: rank.map((x, i) => ({
          no: true, label: x.colaborador.nome, valor: Math.round(x.pct),
          sub: u.fmtMoedaCurta(x.realizado) + ' de ' + u.fmtMoedaCurta(x.meta),
          cor: x.pct >= 100 ? g.STATUS.bom : x.pct >= 80 ? g.STATUS.atencao : g.STATUS.critico
        })),
        formatar: v => v + '%',
        msgVazio: 'Sem metas cadastradas.'
      }),
      tabela: () => g.tabela(rank.map(x => x.colaborador.nome), [
        { label: 'Realizado', valores: rank.map(x => x.realizado) },
        { label: 'Meta', valores: rank.map(x => x.meta) }
      ], v => u.fmtMoeda(v))
    }));

    /* --------------------- Evolução da meta --------------------- */
    const serieMeta = A.serieMetaEquipe();
    grid.appendChild(g.card({
      titulo: 'Evolução da meta da equipe', desc: 'Soma mensal de meta e realizado',
      grafico: () => serieMeta.length
        ? g.linha({
            labels: serieMeta.map(x => x.label),
            series: [
              { label: 'Realizado', valores: serieMeta.map(x => x.realizado), cor: g.cor(0) },
              { label: 'Meta', valores: serieMeta.map(x => x.meta), cor: g.cor(1) }
            ],
            formatar: v => u.fmtMoedaCurta(v), altura: 230
          })
        : u.el('div.chart-empty', { text: 'Sem histórico mensal cadastrado.' }),
      tabela: () => serieMeta.length ? g.tabela(serieMeta.map(x => x.label), [
        { label: 'Realizado', valores: serieMeta.map(x => x.realizado) },
        { label: 'Meta', valores: serieMeta.map(x => x.meta) }
      ], v => u.fmtMoeda(v)) : u.el('div.chart-empty', { text: 'Sem dados.' })
    }));

    /* --------------------- Positivos x atenção --------------------- */
    const serieObs = A.serieObservacoes(est.janela);
    grid.appendChild(g.card({
      titulo: 'Positivos x pontos de atenção', desc: 'Últimos ' + est.janela + ' dias, toda a equipe',
      grafico: () => g.barras({
        labels: serieObs.map(s => s.label), altura: 230, empilhado: true,
        series: [
          { label: 'Positivos', valores: serieObs.map(s => s.positivo), cor: g.STATUS.bom },
          { label: 'Neutros', valores: serieObs.map(s => s.neutro), cor: 'var(--border-strong)' },
          { label: 'Atenção', valores: serieObs.map(s => s.atencao), cor: g.STATUS.critico }
        ],
        msgVazio: 'Nenhuma observação no período.'
      }),
      tabela: () => g.tabela(serieObs.map(s => s.label), [
        { label: 'Positivos', valores: serieObs.map(s => s.positivo) },
        { label: 'Neutros', valores: serieObs.map(s => s.neutro) },
        { label: 'Atenção', valores: serieObs.map(s => s.atencao) }
      ])
    }));

    /* --------------------- Distribuição por tipo --------------------- */
    const dist = A.distribuicaoTipos();
    grid.appendChild(g.card({
      titulo: 'Distribuição das observações', desc: 'Por tipo de registro',
      grafico: () => g.donut({
        itens: g.dobrarEmOutros(dist.map((d, i) => ({ label: d.label, valor: d.total, emoji: d.emoji, cor: g.cor(i) }))),
        centroTitulo: 'observações',
        msgVazio: 'Nenhuma observação registrada.'
      }),
      tabela: () => g.tabela(dist.map(d => d.label), [{ label: 'Registros', valores: dist.map(d => d.total) }])
    }));

    /* --------------------- Ritmo de acompanhamento --------------------- */
    const serieFb = A.serieFeedbacks(6);
    grid.appendChild(g.card({
      titulo: 'Ritmo de acompanhamento', desc: 'Feedbacks, encontros e planos concluídos por mês',
      grafico: () => g.barras({
        labels: serieFb.map(x => x.label), altura: 230, empilhado: false,
        series: [
          { label: 'Feedbacks', valores: serieFb.map(x => x.feedbacks), cor: g.cor(0) },
          { label: 'One a Ones', valores: serieFb.map(x => x.encontros), cor: g.cor(1) },
          { label: 'Planos concluídos', valores: serieFb.map(x => x.planos), cor: g.cor(2) }
        ]
      }),
      tabela: () => g.tabela(serieFb.map(x => x.label), [
        { label: 'Feedbacks', valores: serieFb.map(x => x.feedbacks) },
        { label: 'One a Ones', valores: serieFb.map(x => x.encontros) },
        { label: 'Planos concluídos', valores: serieFb.map(x => x.planos) }
      ])
    }));

    /* --------------------- Competências da equipe --------------------- */
    const ativos = db.colaboradores.ativos();
    const mediaEquipe = cat.COMPETENCIAS.map(comp => {
      const notas = ativos.map(c => {
        const at = A.competenciasAtuais(c.id)[comp.id];
        return at ? at.nota : null;
      }).filter(x => x !== null);
      return { id: comp.id, label: comp.label, media: notas.length ? u.sum(notas) / notas.length : 0, n: notas.length };
    });
    const temComp = mediaEquipe.some(x => x.n > 0);

    grid.appendChild(g.card({
      titulo: 'Competências da equipe', desc: 'Média das últimas avaliações de cada colaborador',
      grafico: () => temComp
        ? g.radar({
            eixos: mediaEquipe.map(x => x.label.split(' ')[0]),
            series: [{ label: 'Média da equipe', valores: mediaEquipe.map(x => x.media) }]
          })
        : p.vazio({
            icone: 'award', titulo: 'Sem avaliações de competência',
            desc: 'As competências são avaliadas dentro do One a One.',
            acoes: [{ label: 'Preparar um encontro', icone: 'sparkles', onClick: () => App.router.go('/one-a-one') }]
          }),
      tabela: () => g.tabela(mediaEquipe.map(x => x.label), [
        { label: 'Média', valores: mediaEquipe.map(x => x.media) }
      ], v => (v ? v.toFixed(1).replace('.', ',') : '—'))
    }));

    box.appendChild(grid);

    /* --------------------- Balanço por colaborador --------------------- */
    const bal = A.balancoEquipe();
    box.appendChild(u.el('div.card.u-mt-5', {}, [
      u.el('div.card__head', {}, [
        u.el('div', {}, [
          u.el('div.card__title', { text: 'Balanço por colaborador' }),
          u.el('div.t-sm.t-muted', { text: 'Registros, saldo de observações, ações e situação do próximo encontro' })
        ])
      ]),
      u.el('div.tbl-wrap', {}, [u.el('table.tbl.tbl--click', {}, [
        u.el('thead', {}, [u.el('tr', {}, ['Colaborador', '% da meta', 'Registros', 'Positivos', 'Atenção', 'Feedbacks', 'Ações abertas', 'Competências', 'Próximo 1:1']
          .map((h, i) => u.el('th', { class: i >= 1 && i <= 6 ? 'u-right' : '', text: h })))]),
        u.el('tbody', {}, bal.map(x => {
          const c = x.colaborador;
          const ind = A.indicadores(c);
          const media = A.mediaCompetencias(c.id);
          return u.el('tr', { onclick: () => App.router.go('/colaborador/' + c.id) }, [
            u.el('td', {}, [u.el('div.u-row.u-gap-2', {}, [p.avatar(c, 'xs'), u.el('span.t-semi', { text: c.nome })])]),
            u.el('td', { class: 'u-right t-num' + (ind.pctMeta >= 100 ? ' t-ok t-strong' : ind.pctMeta < 60 ? ' t-danger' : ''), text: u.fmtPct(ind.pctMeta) }),
            u.el('td', { class: 'u-right t-num', text: String(x.total) }),
            u.el('td', { class: 'u-right t-num t-ok', text: String(x.positivos) }),
            u.el('td', { class: 'u-right t-num' + (x.atencao ? ' t-warn t-strong' : ''), text: String(x.atencao) }),
            u.el('td', { class: 'u-right t-num', text: String(db.feedbacks.doColaborador(c.id).length) }),
            u.el('td', { class: 'u-right t-num', text: String(db.planos.abertos(c.id).length) }),
            u.el('td', { class: 't-sm', text: media ? media.toFixed(1).replace('.', ',') + ' / 5' : '—' }),
            u.el('td', {}, [p.badge1a1(c)])
          ]);
        }))
      ])])
    ]));

    u.clear(view);
    view.appendChild(box);
  }

  App.pages = App.pages || {};
  App.pages.indicadores = { render, titulo: 'Indicadores', sub: 'Performance e desenvolvimento' };
})(window.App);
