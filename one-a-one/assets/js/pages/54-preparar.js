/* =========================================================================
   pages/54-preparar.js — PREPARAR ONE A ONE.
   O sistema monta sozinho: resumo do período, 3 pontos positivos,
   3 pontos de atenção, o que evoluiu, o que acompanhar e perguntas
   sugeridas para conduzir a conversa.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, g = App.g, db = App.db, A = App.analise, cat = App.cat;

  function render(view, params) {
    const c = db.colaboradores.por(params.colabId);
    if (!c) {
      u.clear(view);
      view.appendChild(u.el('div.view__inner', {}, [u.el('div.card', {}, [p.vazio({
        icone: 'user', titulo: 'Colaborador não encontrado',
        acoes: [{ label: 'Voltar', onClick: () => App.router.go('/one-a-one') }]
      })])]));
      return;
    }

    if (c.exemplo) db.setEscopo('exemplos');

    const prep = A.prepararOneOne(c.id);
    const box = u.el('div.view__inner');

    if (c.exemplo) box.appendChild(p.faixaExemplo(
      'Preparação de demonstração — mostra como a pauta é montada a partir dos registros do período.'));

    /* ------------------------------ topo ------------------------------ */
    box.appendChild(u.el('button.btn.btn--sm.btn--ghost.u-mb-3', {
      type: 'button', html: App.icon('arrowLeft') + '<span>Voltar</span>',
      onclick: () => App.router.voltar('/one-a-one')
    }));

    const emAndamento = db.oneones.emAndamento(c.id);

    box.appendChild(u.el('div.card.card--glass.card--pad.u-mb-5.anim-rise', {}, [
      u.el('div.u-row.u-wrap.u-gap-4', { style: { alignItems: 'center' } }, [
        p.avatar(c, 'xl'),
        u.el('div.u-grow', { style: { minWidth: '200px' } }, [
          u.el('div.t-xs.t-up', { text: 'Preparação do One a One' }),
          u.el('div.page-head__title', { text: c.nome }),
          u.el('div.t-sm.t-muted', {
            text: c.cargo + ' · período de ' + u.fmtDate(prep.de) + ' até hoje (' +
              u.plural(prep.resumo.dias, 'dia') + ')' +
              (prep.ultimoEncontro ? ' · último encontro em ' + u.fmtDate(prep.ultimoEncontro.data) : ' · primeiro encontro')
          })
        ]),
        u.el('div.u-row.u-gap-2.u-wrap', {}, [
          u.el('button.btn.btn--outline', {
            type: 'button', html: App.icon('print') + '<span>Imprimir pauta</span>',
            onclick: () => window.print()
          }),
          u.el('button.btn.btn--outline', {
            type: 'button', html: App.icon('copy') + '<span>Copiar resumo</span>',
            onclick: () => copiarResumo(prep)
          }),
          c.exemplo
            ? u.el('span.badge.badge--warn.badge--lg', { text: '✨ Exemplo · somente consulta' })
            : emAndamento
              ? u.el('button.btn.btn--lg.btn--primary', {
                  type: 'button', html: App.icon('play') + '<span>Continuar encontro</span>',
                  onclick: () => App.router.go('/one-a-one/' + emAndamento.id)
                })
              : u.el('button.btn.btn--lg.btn--primary', {
                  type: 'button', html: App.icon('play') + '<span>Iniciar One a One</span>',
                  onclick: () => iniciar(c)
                })
        ])
      ])
    ]));

    /* --------------------------- resumo --------------------------- */
    const r = prep.resumo;
    box.appendChild(u.el('div.grid.grid-kpi.u-mb-5.stagger', {}, [
      p.kpi({ label: 'Observações', valor: r.total, icone: 'eye', tom: 'brand', rodape: '<span class="t-muted2">No período</span>' }),
      p.kpi({ label: 'Pontos positivos', valor: r.positivos, icone: 'star', tom: 'ok' }),
      p.kpi({ label: 'Pontos de atenção', valor: r.atencao, icone: 'alert', tom: r.atencao ? 'warn' : 'neutral' }),
      p.kpi({ label: 'Feedbacks', valor: r.totalFeedbacks, icone: 'chat', tom: 'info' }),
      p.kpi({ label: 'Ações concluídas', valor: r.acoesConcluidas, icone: 'checkCircle', tom: 'ok' }),
      p.kpi({
        label: 'Ações pendentes', valor: r.acoesPendentes, icone: 'flag',
        tom: r.acoesAtrasadas ? 'danger' : 'neutral',
        rodape: r.acoesAtrasadas ? '<span class="t-danger t-strong">' + r.acoesAtrasadas + ' atrasada(s)</span>' : ''
      })
    ]));

    /* --------------------------- blocos --------------------------- */
    const cols = u.el('div.grid.grid-main');
    const esq = u.el('div.u-col.u-gap-4');

    esq.appendChild(blocoLista('3 pontos positivos', 'star', 'ok',
      prep.positivos.map(o => ({
        titulo: cat.tipoObs(o.tipo).emoji + ' ' + cat.tipoObs(o.tipo).label + ' · ' + u.fmtDate(o.data),
        texto: o.texto,
        acao: () => App.router.go('/colaborador/' + c.id + '/observacoes')
      })),
      'Nenhum ponto positivo registrado no período. Reconhecer o que funciona é metade do One a One.'));

    esq.appendChild(blocoLista('3 pontos de atenção', 'alert', 'warn',
      prep.atencao.map(o => ({
        titulo: cat.tipoObs(o.tipo).emoji + ' ' + cat.tipoObs(o.tipo).label + ' · impacto ' + cat.impacto(o.impacto).label.toLowerCase() + ' · ' + u.fmtDate(o.data),
        texto: o.texto,
        acao: () => App.router.go('/colaborador/' + c.id + '/observacoes')
      })),
      'Nenhum ponto de atenção no período. Bom sinal — vale reforçar o que está sustentando isso.'));

    esq.appendChild(blocoLista('O que evoluiu', 'trendUp', 'ok',
      prep.evolucao.map(e => ({ texto: e.texto })),
      'Ainda não dá para afirmar evolução com os registros deste período.'));

    esq.appendChild(blocoLista('Pontos a acompanhar', 'target', 'danger',
      prep.acompanhar.map(e => ({ texto: e.texto })),
      'Nada em aberto vindo de encontros anteriores.'));

    cols.appendChild(esq);

    /* ---------------------------- lateral ---------------------------- */
    const lat = u.el('div.u-col.u-gap-4');

    /* perguntas sugeridas */
    const qs = u.el('div.card__body');
    prep.perguntas.forEach(q => {
      qs.appendChild(u.el('div.q-suggest', {}, [
        u.el('span', { text: '“' + q + '”' }),
        u.el('button.icon-btn.q-suggest__copy', {
          type: 'button', 'data-tip': 'Copiar pergunta', 'aria-label': 'Copiar pergunta',
          html: App.icon('copy'),
          onclick: () => u.copiar(q).then(() => App.toast.ok('Pergunta copiada'))
        })
      ]));
    });
    lat.appendChild(u.el('div.card', {}, [
      u.el('div.card__head', {}, [
        u.el('div.u-row.u-gap-2', {}, [
          u.el('span.kpi__icon.tone-purple', { html: App.icon('lightbulb') }),
          u.el('div', {}, [
            u.el('div.card__title', { text: 'Perguntas sugeridas' }),
            u.el('div.t-sm.t-muted', { text: 'Geradas a partir dos seus registros' })
          ])
        ])
      ]), qs
    ]));

    /* competencias atuais */
    const compsAvaliadas = Object.keys(prep.competencias).filter(k => prep.competencias[k]);
    if (compsAvaliadas.length) {
      const lista = u.el('div.card__body.u-col.u-gap-2');
      u.sortBy(cat.COMPETENCIAS.filter(x => prep.competencias[x.id]), x => prep.competencias[x.id].nota)
        .slice(0, 5).forEach(x => {
          const v = prep.competencias[x.id];
          lista.appendChild(u.el('div.u-between.u-gap-3', {}, [
            u.el('span.t-sm.u-truncate', { text: x.label }),
            u.el('span', {
              class: 'badge badge--' + (v.nota >= 4 ? 'ok' : v.nota === 3 ? 'warn' : 'danger'),
              text: v.nota + '/5'
            })
          ]));
        });
      lat.appendChild(u.el('div.card', {}, [
        u.el('div.card__head', {}, [
          u.el('div', {}, [
            u.el('div.card__title', { text: 'Competências mais baixas' }),
            u.el('div.t-sm.t-muted', { text: 'Última avaliação registrada' })
          ])
        ]), lista
      ]));
    }

    /* indicadores */
    const ind = prep.indicadores;
    lat.appendChild(u.el('div.card', {}, [
      u.el('div.card__head', {}, [u.el('div.card__title', { text: 'Indicadores do período' })]),
      u.el('div.card__body', {}, [
        p.barraMeta(ind.pctMeta),
        u.el('div.grid.grid-2.u-mt-4', {}, [
          u.el('div', {}, [u.el('div.stat-tile__l', { text: 'Realizado' }), u.el('div.stat-tile__v', { text: u.fmtMoedaCurta(ind.realizado) })]),
          u.el('div', {}, [u.el('div.stat-tile__l', { text: 'Meta' }), u.el('div.stat-tile__v', { text: u.fmtMoedaCurta(ind.meta) })]),
          u.el('div', {}, [u.el('div.stat-tile__l', { text: 'Vendas' }), u.el('div.stat-tile__v', { text: u.fmtNum(ind.vendas) })]),
          u.el('div', {}, [u.el('div.stat-tile__l', { text: 'Conversão' }), u.el('div.stat-tile__v', { text: u.fmtPct(ind.conversao, 1) })])
        ])
      ])
    ]));

    cols.appendChild(lat);
    box.appendChild(cols);

    /* ---------------------- timeline do período ---------------------- */
    const eventos = A.timeline(c.id, 'todos').filter(e => u.diffDays(prep.de, e.data) >= 0);
    box.appendChild(u.el('div.card.u-mt-5', {}, [
      u.el('div.card__head', {}, [
        u.el('div', {}, [
          u.el('div.card__title', { text: 'Tudo o que aconteceu no período' }),
          u.el('div.t-sm.t-muted', { text: u.plural(eventos.length, 'evento') + ' desde ' + u.fmtDate(prep.de) })
        ]),
        u.el('button.btn.btn--xs.btn--ghost', {
          type: 'button', html: '<span>Histórico completo</span>' + App.icon('arrowRight'),
          onclick: () => App.router.go('/colaborador/' + c.id + '/evolucao')
        })
      ]),
      u.el('div.card__body', {}, [p.timeline(eventos, {
        acoesVazio: [{ label: 'Registrar observação', icone: 'plus', onClick: () => App.obsModal.abrir({ colaboradorId: c.id }) }]
      })])
    ]));

    u.clear(view);
    view.appendChild(box);
  }

  /* ------------------------------------------------------------------ */
  function blocoLista(titulo, icone, tom, itens, msgVazio) {
    const card = u.el('div.card', {}, [
      u.el('div.card__head', {}, [
        u.el('div.u-row.u-gap-2', {}, [
          u.el('span.kpi__icon.tone-' + tom, { html: App.icon(icone) }),
          u.el('div.card__title', { text: titulo })
        ]),
        u.el('span.badge.badge--outline', { text: String(itens.length) })
      ])
    ]);
    const body = u.el('div.card__body');
    if (!itens.length) {
      body.appendChild(u.el('div.t-md.t-muted', { text: msgVazio }));
    } else {
      itens.forEach((it, i) => {
        body.appendChild(u.el('div.prep-li' + (it.acao ? '' : ''), {
          style: it.acao ? { cursor: 'pointer' } : null,
          onclick: it.acao || null
        }, [
          u.el('span.prep-li__n', { text: String(i + 1) }),
          u.el('div.u-grow', {}, [
            it.titulo ? u.el('div.t-xs.t-muted2', { style: { marginBottom: '3px' }, text: it.titulo }) : null,
            u.el('div.u-pre', { text: it.texto })
          ])
        ]));
      });
    }
    card.appendChild(body);
    return card;
  }

  /* ------------------------------------------------------------------ */
  function iniciar(c) {
    const modelo = db.oneones.novoModelo(c.id);
    const prep = A.prepararOneOne(c.id);
    modelo.resumoSalvo = {
      total: prep.resumo.total, positivos: prep.resumo.positivos, atencao: prep.resumo.atencao,
      feedbacks: prep.resumo.totalFeedbacks, acoesConcluidas: prep.resumo.acoesConcluidas,
      acoesPendentes: prep.resumo.acoesPendentes
    };
    /* ja traz as evidencias sugeridas marcadas para discussao */
    modelo.observacoesDiscutidas = prep.positivos.concat(prep.atencao).map(o => o.id);

    db.oneones.criar(modelo).then(novo => {
      App.toast.ok('One a One iniciado', c.nome + ' · roteiro pronto para conduzir');
      App.router.go('/one-a-one/' + novo.id);
    }).catch(e => App.toast.erro('Não foi possível iniciar', e.message));
  }

  /* ------------------------------------------------------------------ */
  function copiarResumo(prep) {
    const L = [];
    const c = prep.colaborador;
    L.push('PREPARAÇÃO DO ONE A ONE — ' + c.nome);
    L.push('Período: ' + u.fmtDate(prep.de) + ' a ' + u.fmtDate(prep.ate) + ' (' + u.plural(prep.resumo.dias, 'dia') + ')');
    L.push('');
    L.push('RESUMO: ' + prep.resumo.total + ' observações · ' + prep.resumo.positivos + ' positivos · ' +
      prep.resumo.atencao + ' pontos de atenção · ' + prep.resumo.totalFeedbacks + ' feedbacks · ' +
      prep.resumo.acoesConcluidas + ' ações concluídas · ' + prep.resumo.acoesPendentes + ' pendentes');
    L.push('');
    L.push('3 PONTOS POSITIVOS');
    prep.positivos.forEach((o, i) => L.push((i + 1) + '. ' + o.texto));
    if (!prep.positivos.length) L.push('— nenhum registro positivo no período');
    L.push('');
    L.push('3 PONTOS DE ATENÇÃO');
    prep.atencao.forEach((o, i) => L.push((i + 1) + '. ' + o.texto));
    if (!prep.atencao.length) L.push('— nenhum ponto de atenção no período');
    L.push('');
    L.push('O QUE EVOLUIU');
    prep.evolucao.forEach(e => L.push('• ' + e.texto));
    if (!prep.evolucao.length) L.push('— sem evolução mensurável no período');
    L.push('');
    L.push('PONTOS A ACOMPANHAR');
    prep.acompanhar.forEach(e => L.push('• ' + e.texto));
    if (!prep.acompanhar.length) L.push('— nada em aberto');
    L.push('');
    L.push('PERGUNTAS SUGERIDAS');
    prep.perguntas.forEach(q => L.push('• ' + q));

    u.copiar(L.join('\n'))
      .then(() => App.toast.ok('Resumo copiado', 'Cole onde quiser conduzir a conversa.'))
      .catch(() => App.toast.erro('Não foi possível copiar'));
  }

  App.pages = App.pages || {};
  App.pages.preparar = { render, titulo: 'Preparar One a One', iniciar };
})(window.App);
