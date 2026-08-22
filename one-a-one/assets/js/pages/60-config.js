/* =========================================================================
   pages/60-config.js — Configurações em abas:
   Preferências · Dados · Exemplos · Sistema.

   A aba Exemplos é o catálogo de demonstração: os registros existem no
   banco marcados com { exemplo: true } e ficam FORA da operação. Aqui eles
   são lidos no escopo 'exemplos', reaproveitando a mesma lógica das telas
   reais — por isso um colaborador de exemplo abre o perfil completo, com
   timeline, competências e preparação de One a One.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, db = App.db, cat = App.cat, A = App.analise;

  const ABAS = [
    { id: 'preferencias', label: 'Preferências', icone: 'user' },
    { id: 'dados',        label: 'Dados',        icone: 'database' },
    { id: 'exemplos',     label: 'Exemplos',     icone: 'sparkles' },
    { id: 'sistema',      label: 'Sistema',      icone: 'layers' }
  ];

  const est = { tipo: 'colaboradores' };

  const TIPOS = [
    { id: 'colaboradores', label: 'Colaboradores', icone: 'users' },
    { id: 'observacoes',   label: 'Observações',   icone: 'eye' },
    { id: 'feedbacks',     label: 'Feedbacks',     icone: 'chat' },
    { id: 'oneones',       label: 'One a Ones',    icone: 'handshake' },
    { id: 'planos',        label: 'Planos de ação', icone: 'flag' }
  ];

  function render(view, params) {
    const aba = ABAS.some(a => a.id === params.aba) ? params.aba : 'preferencias';
    const largura = aba === 'exemplos' ? null : '900px';
    const box = u.el('div.view__inner', { style: largura ? { maxWidth: largura } : null });

    box.appendChild(u.el('div.page-head', {}, [
      u.el('div', {}, [
        u.el('div.page-head__title', { text: 'Configurações' }),
        u.el('div.page-head__desc', { text: 'Preferências, dados, exemplos de uso e informações do sistema.' })
      ])
    ]));

    /* ------------------------------ abas ------------------------------ */
    const tabs = u.el('div.tabs.u-mb-5');
    const nExemplos = db.totalExemplos();
    ABAS.forEach(a => {
      tabs.appendChild(u.el('button.tab' + (a.id === aba ? '.is-on' : ''), {
        type: 'button',
        onclick: () => App.router.go('/config/' + a.id),
        html: App.icon(a.icone) + '<span>' + u.esc(a.label) + '</span>' +
          (a.id === 'exemplos' && nExemplos ? '<span class="tab__count">' + nExemplos + '</span>' : '')
      }));
    });
    box.appendChild(tabs);

    const corpo = u.el('div.anim-fade');
    box.appendChild(corpo);

    ({ preferencias: abaPreferencias, dados: abaDados, exemplos: abaExemplos, sistema: abaSistema })[aba](corpo);

    u.clear(view);
    view.appendChild(box);
  }

  /* ====================================================================== */
  /*  Preferências                                                          */
  /* ====================================================================== */
  function abaPreferencias(box) {
    const cfg = db.config.get('coordenador', {}) || {};
    const inpNome = u.el('input.input', { type: 'text', placeholder: 'Como você quer ser chamado', value: cfg.nome || '' });
    inpNome.addEventListener('change', () => {
      db.config.set('coordenador', Object.assign({}, cfg, {
        nome: inpNome.value.trim(), iniciais: u.iniciais(inpNome.value || 'CC')
      })).then(() => {
        App.toast.ok('Perfil atualizado');
        if (App.montarShell) { App.montarShell(); App.recarregarTela(); }
      });
    });

    box.appendChild(cartao('Seu perfil', 'Usado na saudação do dashboard e na identificação dos registros.', [
      p.campo('Nome do coordenador', inpNome)
    ]));

    const temas = u.el('div.u-row.u-gap-3.u-wrap');
    [['light', 'Claro', ['#f5f6f9', '#ffffff', '#6366f1']], ['dark', 'Escuro', ['#0a0c11', '#14181f', '#7c7ff5']]]
      .forEach(([id, lb, cores]) => {
        const card = u.el('button.theme-card' + (App.tema.atual() === id ? '.is-on' : ''), {
          type: 'button',
          onclick: () => {
            App.tema.definir(id);
            u.$$('.theme-card', temas).forEach(x => x.classList.remove('is-on'));
            card.classList.add('is-on');
          }
        }, [
          u.el('div.theme-card__prev', { style: { background: cores[0] } }, [
            u.el('i', { style: { background: cores[2], width: '40%' } }),
            u.el('i', { style: { background: cores[1] } }),
            u.el('i', { style: { background: cores[1], width: '70%' } })
          ]),
          u.el('div.theme-card__lbl', { text: lb })
        ]);
        temas.appendChild(card);
      });
    box.appendChild(cartao('Aparência', 'O tema fica salvo neste navegador.', [temas]));

    box.appendChild(cartaoFeriados());

    const atalhos = [
      ['Ctrl + N', 'Nova observação'],
      ['Ctrl + K', 'Busca global'],
      ['Ctrl + Enter', 'Salvar no modal aberto'],
      ['ESC', 'Fechar modal, menu ou painel'],
      ['G depois D', 'Ir para o Dashboard'],
      ['G depois E', 'Ir para Equipe'],
      ['G depois O', 'Ir para One a One']
    ];
    box.appendChild(cartao('Atalhos de teclado', 'Velocidade importa: registrar não pode custar navegação.',
      atalhos.map(([k, d]) => u.el('div.set-row', {}, [
        u.el('div.set-row__t', { text: d }),
        u.el('span', { html: k.split(' + ').map(x => '<kbd>' + u.esc(x) + '</kbd>').join(' + ') })
      ]))));
  }


  /* ------------------------- Dias úteis e feriados ------------------------- */
  function cartaoFeriados() {
    const cal = App.cal;
    const corpo = u.el('div');

    function pintar() {
      u.clear(corpo);

      corpo.appendChild(u.el('div.note.note--brand.u-mb-4', {
        text: 'Nenhum One a One calculado pelo sistema cai em fim de semana ou feriado — ' +
              'ao concluir um encontro, a próxima data pula para o dia útil seguinte. ' +
              'Datas escolhidas à mão continuam valendo: o app apenas avisa.'
      }));

      const locais = cal.feriadosLocais();
      const proximos = cal.proximosFeriados(8);

      if (proximos.length) {
        const lista = u.el('div.u-mb-4');
        proximos.forEach(f => {
          lista.appendChild(u.el('div.list-row', {}, [
            u.el('div.u-col', { style: { minWidth: '92px' } }, [
              u.el('div.t-semi', { text: u.fmtDate(f.data, false) }),
              u.el('div.t-xs.t-muted2', { text: u.fmtDiaCurto(f.data).split(' ')[0] })
            ]),
            u.el('div.u-grow', {}, [
              u.el('div.t-md', { text: f.nome }),
              u.el('div.t-xs.t-muted2', { text: u.fmtRelativo(f.data) })
            ]),
            u.el('span', {
              class: 'badge badge--' + (f.tipo === 'local' ? 'brand' : 'outline'),
              text: f.tipo === 'local' ? 'Local' : 'Nacional'
            }),
            f.tipo === 'local'
              ? u.el('button.icon-btn', {
                  type: 'button', 'aria-label': 'Remover feriado', 'data-tip': 'Remover',
                  html: App.icon('trash'),
                  onclick: () => cal.removerFeriadoLocal(f.data).then(() => {
                    App.toast.ok('Feriado removido', f.nome);
                    pintar();
                  })
                })
              : null
          ]));
        });
        corpo.appendChild(lista);
      }

      /* adicionar feriado local */
      const inpData = u.el('input.input', { type: 'date', value: u.today() });
      const inpNome = u.el('input.input', { type: 'text', placeholder: 'Ex.: Aniversário da cidade' });
      const btn = u.el('button.btn.btn--outline', {
        type: 'button', html: App.icon('plus') + '<span>Adicionar</span>',
        onclick: () => {
          if (!inpData.value) { App.toast.aviso('Escolha a data do feriado'); return; }
          cal.adicionarFeriadoLocal(inpData.value, inpNome.value || 'Feriado local').then(ok => {
            if (!ok) { App.toast.aviso('Essa data já está cadastrada'); return; }
            App.toast.ok('Feriado cadastrado', u.fmtDateLong(inpData.value));
            pintar();
          });
        }
      });

      corpo.appendChild(u.el('div', {}, [
        u.el('div.t-up.u-mb-2', { text: 'Feriado local ou ponto facultativo da empresa' }),
        u.el('div.u-row.u-wrap.u-gap-2', { style: { alignItems: 'flex-end' } }, [
          u.el('div', { style: { flex: '0 0 170px' } }, [p.campo('Data', inpData)]),
          u.el('div.u-grow', { style: { minWidth: '200px' } }, [p.campo('Nome', inpNome)]),
          btn
        ]),
        locais.length
          ? u.el('div.field__hint.u-mt-2', { text: u.plural(locais.length, 'feriado local cadastrado', 'feriados locais cadastrados') + '.' })
          : u.el('div.field__hint.u-mt-2', { text: 'Os feriados nacionais (inclusive Carnaval, Sexta-feira Santa e Corpus Christi) já entram automaticamente.' })
      ]));
    }

    pintar();
    return u.el('div.card.u-mb-5', {}, [
      u.el('div.card__head', {}, [
        u.el('div', {}, [
          u.el('div.card__title', { text: 'Dias úteis e feriados' }),
          u.el('div.t-sm.t-muted', { text: 'Quando o sistema pode marcar um One a One' })
        ])
      ]),
      u.el('div.card__body', {}, [corpo])
    ]);
  }

  /* ====================================================================== */
  /*  Dados                                                                 */
  /* ====================================================================== */
  function abaDados(box) {
    const linhas = [
      ['Colaboradores', 'colaboradores'],
      ['Observações', 'observacoes'],
      ['Feedbacks', 'feedbacks'],
      ['One a Ones', 'oneones'],
      ['Planos de ação', 'planos'],
      ['Autoavaliações', 'autoavaliacoes']
    ];

    const tb = u.el('tbody');
    linhas.forEach(([rot, col]) => {
      const total = db.cache[col].length;
      const exemplos = db.cache[col].filter(x => x.exemplo).length;
      tb.appendChild(u.el('tr', {}, [
        u.el('td', { class: 't-semi', text: rot }),
        u.el('td', { class: 'u-right t-num t-strong', text: String(total - exemplos) }),
        u.el('td', { class: 'u-right t-num t-muted', text: String(exemplos) }),
        u.el('td', { class: 'u-right t-num t-muted', text: String(total) })
      ]));
    });

    box.appendChild(cartao('O que está gravado',
      'Tudo fica salvo neste navegador (localStorage). Exporte um backup antes de limpar o cache.', [
      u.el('div.tbl-wrap', {}, [u.el('table.tbl', {}, [
        u.el('thead', {}, [u.el('tr', {}, ['Coleção', 'Operação', 'Exemplos', 'Total']
          .map((h, i) => u.el('th', { class: i ? 'u-right' : '', text: h })))]),
        tb
      ])]),
      u.el('div.u-row.u-wrap.u-gap-2.u-mt-4', {}, [
        u.el('button.btn.btn--outline', {
          type: 'button', html: App.icon('download') + '<span>Exportar backup (JSON)</span>', onclick: exportar
        }),
        u.el('button.btn.btn--outline', {
          type: 'button', html: App.icon('upload') + '<span>Importar backup</span>', onclick: importar
        }),
        u.el('button.btn.btn--danger-soft', {
          type: 'button', html: App.icon('trash') + '<span>Apagar tudo</span>', onclick: apagarTudo
        })
      ])
    ]));

    box.appendChild(cartao('Começar do zero',
      'Remove apenas a operação (equipe, observações, feedbacks, One a Ones e planos reais). Os exemplos continuam disponíveis para consulta.', [
      u.el('button.btn.btn--outline', {
        type: 'button', html: App.icon('refresh') + '<span>Limpar dados da operação</span>',
        onclick: limparOperacao
      })
    ]));
  }

  /* ====================================================================== */
  /*  Exemplos                                                              */
  /* ====================================================================== */
  function abaExemplos(box) {
    /* a aba inteira lê no escopo de demonstração */
    db.setEscopo('exemplos');

    const total = db.totalExemplos();

    if (!total) {
      box.appendChild(u.el('div.card', {}, [p.vazio({
        icone: 'sparkles', titulo: 'Nenhum exemplo instalado',
        desc: 'Os exemplos são uma equipe fictícia completa — com observações, feedbacks, One a Ones e planos — para consultar como o sistema funciona na prática. Eles nunca entram na sua operação.',
        acoes: [{ label: 'Instalar exemplos', icone: 'download', onClick: restaurarExemplos }]
      })]));
      return;
    }

    box.appendChild(u.el('div.note.note--brand.u-mb-4', {}, [
      u.el('div.u-row.u-gap-3', { style: { alignItems: 'flex-start' } }, [
        u.el('span', { html: App.icon('info') }),
        u.el('div.u-grow', {}, [
          u.el('div.t-strong', { text: 'Material de consulta, separado da operação.' }),
          u.el('div.t-sm', { style: { marginTop: '3px' }, text:
            'Estes registros não aparecem na Equipe, no Dashboard, no One a One, nos Indicadores nem na busca. ' +
            'Clique em qualquer um para abrir o exemplo completo — perfil, timeline, competências e preparação de One a One funcionam normalmente.' })
        ])
      ])
    ]));

    /* --------------------------- números --------------------------- */
    box.appendChild(u.el('div.grid.grid-kpi.u-mb-4', {}, [
      p.kpi({ label: 'Colaboradores', valor: db.colaboradores.contar(), icone: 'users', tom: 'brand' }),
      p.kpi({ label: 'Observações', valor: db.observacoes.contar(), icone: 'eye', tom: 'purple' }),
      p.kpi({ label: 'Feedbacks', valor: db.feedbacks.contar(), icone: 'chat', tom: 'info' }),
      p.kpi({ label: 'One a Ones', valor: db.oneones.contar(), icone: 'handshake', tom: 'ok' }),
      p.kpi({ label: 'Planos de ação', valor: db.planos.contar(), icone: 'flag', tom: 'warn' })
    ]));

    /* --------------------------- filtros --------------------------- */
    const chips = u.el('div.u-row.u-wrap.u-gap-2.u-mb-4');
    TIPOS.forEach(t => {
      const n = db[t.id].contar();
      chips.appendChild(u.el('button.chip' + (est.tipo === t.id ? '.is-on' : ''), {
        type: 'button', text: t.label + ' · ' + n,
        onclick: () => { est.tipo = t.id; App.recarregarTela(); }
      }));
    });
    chips.appendChild(u.el('span.u-grow'));
    chips.appendChild(u.el('button.btn.btn--sm.btn--outline', {
      type: 'button', html: App.icon('refresh') + '<span>Restaurar exemplos</span>',
      'data-tip': 'Repõe qualquer exemplo excluído, sem tocar na operação',
      onclick: restaurarExemplos
    }));
    chips.appendChild(u.el('button.btn.btn--sm.btn--ghost', {
      type: 'button', html: App.icon('trash') + '<span>Remover exemplos</span>',
      onclick: removerExemplos
    }));
    box.appendChild(chips);

    const lista = u.el('div');
    box.appendChild(lista);
    ({
      colaboradores: listaColaboradores,
      observacoes: listaObservacoes,
      feedbacks: listaFeedbacks,
      oneones: listaOneOnes,
      planos: listaPlanos
    })[est.tipo](lista);
  }

  /* --------------------------- listas --------------------------- */
  function listaColaboradores(alvo) {
    const grid = u.el('div.grid.grid-cards.stagger');
    db.colaboradores.todosOrdenados().forEach(c => {
      const ind = A.indicadores(c);
      const res = A.resumoPeriodo(c.id);
      grid.appendChild(u.el('div.card.card--hover.person-card', {
        onclick: () => App.router.go('/colaborador/' + c.id),
        role: 'button', tabindex: '0',
        onkeydown: ev => { if (ev.key === 'Enter') App.router.go('/colaborador/' + c.id); }
      }, [
        u.el('div.person-card__head', {}, [
          p.avatar(c, 'lg', true),
          u.el('div.u-grow', { style: { minWidth: 0 } }, [
            u.el('div.person-card__name.u-truncate', { text: c.nome }),
            u.el('div.person-card__role.u-truncate', { text: c.cargo })
          ])
        ]),
        c.status === 'inativo' ? u.el('span.badge.badge--outline', { text: 'Inativo' }) : p.barraMeta(ind.pctMeta),
        u.el('div.person-card__meta', {}, [
          bloco('Realizado', u.fmtMoedaCurta(ind.realizado)),
          bloco('Próximo 1:1', c.proximoOneAOne ? u.fmtDate(c.proximoOneAOne, false) : '—'),
          bloco('Registros', String(res.total) + (res.atencao ? ' · ' + res.atencao + ' atenção' : '')),
          bloco('One a Ones', String(db.oneones.doColaborador(c.id).length))
        ]),
        u.el('div.u-row.u-gap-2', {}, [
          p.badge1a1(c),
          u.el('span.u-grow'),
          u.el('span.t-xs.t-brand.t-strong.u-row.u-gap-1', {
            html: '<span>Ver exemplo completo</span>' + App.icon('arrowRight', '', 13)
          })
        ])
      ]));
    });
    alvo.appendChild(grid);
  }

  function bloco(l, v) {
    return u.el('div', {}, [
      u.el('div.person-card__meta-l', { text: l }),
      u.el('div.person-card__meta-v.u-truncate', { text: v })
    ]);
  }

  function listaObservacoes(alvo) {
    const obs = u.sortBy(db.observacoes.todos(), o => o.data, 'desc');
    const l = u.el('div.u-col.u-gap-3');
    obs.forEach(o => l.appendChild(p.cardObservacao(o, { comColaborador: true })));
    alvo.appendChild(l);
  }

  function listaFeedbacks(alvo) {
    const fbs = u.sortBy(db.feedbacks.todos(), f => f.data, 'desc');
    const g = u.el('div.grid.grid-wide.stagger');
    fbs.forEach(f => g.appendChild(p.cardFeedback(f, { comColaborador: true })));
    alvo.appendChild(g);
  }

  function listaOneOnes(alvo) {
    const encontros = u.sortBy(db.oneones.todos(), o => o.data, 'desc');
    const grid = u.el('div.grid.grid-wide.stagger');
    encontros.forEach(e => {
      const c = db.colaboradores.por(e.colaboradorId);
      const r = e.roteiro || {};
      const comps = Object.keys(e.competencias || {}).filter(k => e.competencias[k] && e.competencias[k].nota);
      const media = comps.length ? (u.sum(comps, k => e.competencias[k].nota) / comps.length) : null;
      grid.appendChild(u.el('div.card.card--hover.card--pad', {
        onclick: () => App.router.go('/one-a-one/' + e.id),
        role: 'button', tabindex: '0'
      }, [
        u.el('div.u-row.u-gap-3.u-mb-3', {}, [
          c ? p.avatar(c, 'sm') : null,
          u.el('div.u-grow', { style: { minWidth: 0 } }, [
            u.el('div.t-semi.u-truncate', { text: c ? c.nome : '—' }),
            u.el('div.t-xs.t-muted', { text: u.fmtDateLong(e.data) + (e.duracaoMin ? ' · ' + e.duracaoMin + ' min' : '') })
          ]),
          u.el('span', { class: 'badge badge--' + cat.status1a1(e.status).tom, text: cat.status1a1(e.status).label })
        ]),
        r.fechamento ? u.el('div.t-sm.u-clamp-3', { style: { color: 'var(--text-2)' }, text: r.fechamento }) : null,
        u.el('div.u-row.u-wrap.u-gap-2.u-mt-3', {}, [
          (r.compromissos || []).length ? u.el('span.badge.badge--brand', { text: u.plural(r.compromissos.length, 'compromisso') }) : null,
          media ? u.el('span.badge.badge--info', { text: 'Competências ' + media.toFixed(1).replace('.', ',') + '/5' }) : null
        ])
      ]));
    });
    alvo.appendChild(grid);
  }

  function listaPlanos(alvo) {
    alvo.appendChild(App.pages.planos.kanban(db.planos.todos(), {
      comColaborador: true,
      aoAbrir: pl => App.router.go('/colaborador/' + pl.colaboradorId + '/plano')
    }));
  }

  /* ====================================================================== */
  /*  Sistema                                                               */
  /* ====================================================================== */
  function abaSistema(box) {
    box.appendChild(cartao('Onde os dados ficam',
      'A camada de persistência é plugável: trocar de backend não exige reescrever as telas.', [
      u.el('div.set-row', {}, [
        u.el('div', {}, [
          u.el('div.set-row__t', { text: 'Adapter ativo' }),
          u.el('div.set-row__d', {
            text: 'Todo acesso a dados passa por App.adapter. Hoje: ' + App.adapter.nome +
              '. Para migrar para Supabase, Firebase ou API própria, basta implementar os mesmos métodos ' +
              '(init, list, insert, update, remove, replaceAll) e registrar o novo adapter.'
          })
        ]),
        u.el('span.badge.badge--brand.badge--lg', { text: App.adapter.nome })
      ]),
      u.el('div.set-row', {}, [
        u.el('div', {}, [
          u.el('div.set-row__t', { text: 'Separação operação × exemplos' }),
          u.el('div.set-row__d', { text: 'Registros marcados com exemplo:true ficam fora de toda consulta operacional. As telas leem no escopo "operação"; a aba Exemplos eleva o escopo e reaproveita exatamente a mesma lógica de análise.' })
        ]),
        u.el('span.badge.badge--outline.badge--lg', { text: 'Escopo de leitura' })
      ]),
      u.el('div.set-row', {}, [
        u.el('div', {}, [
          u.el('div.set-row__t', { text: 'Autoavaliação do colaborador' }),
          u.el('div.set-row__d', { text: 'A estrutura já existe (coleção autoavaliacoes + comparativo com a avaliação do coordenador no perfil). Falta apenas a tela de acesso do próprio colaborador, quando houver login por perfil.' })
        ]),
        u.el('span.badge.badge--outline.badge--lg', { text: 'Preparado' })
      ]),
      u.el('div.set-row', {}, [
        u.el('div', {}, [
          u.el('div.set-row__t', { text: 'Níveis de acesso' }),
          u.el('div.set-row__d', { text: 'Hoje o sistema opera no perfil Coordenador / Administrador. As permissões estão concentradas em um único ponto, prontas para receber os perfis Colaborador e Gestor.' })
        ]),
        u.el('span.badge.badge--outline.badge--lg', { text: 'Coordenador' })
      ])
    ]));
  }

  /* ====================================================================== */
  function cartao(titulo, desc, filhos) {
    return u.el('div.card.u-mb-5', {}, [
      u.el('div.card__head', {}, [
        u.el('div', {}, [
          u.el('div.card__title', { text: titulo }),
          desc ? u.el('div.t-sm.t-muted', { text: desc }) : null
        ])
      ]),
      u.el('div.card__body', {}, filhos)
    ]);
  }

  /* ------------------------------ ações ------------------------------ */
  function restaurarExemplos() {
    App.seed.restaurar().then(() => {
      App.toast.ok('Exemplos restaurados', 'Nada da sua operação foi alterado.');
      App.recarregarTela();
    }).catch(e => App.toast.erro('Não foi possível restaurar', e.message));
  }

  function removerExemplos() {
    App.modal.confirmar({
      titulo: 'Remover exemplos',
      mensagem: 'Os registros de demonstração serão apagados. Sua operação continua intacta e você pode reinstalá-los a qualquer momento.',
      confirmar: 'Remover', perigo: true
    }).then(ok => {
      if (!ok) return;
      App.seed.remover().then(() => {
        App.toast.ok('Exemplos removidos');
        App.recarregarTela();
      });
    });
  }

  function limparOperacao() {
    App.modal.confirmar({
      titulo: 'Limpar dados da operação',
      mensagem: 'Colaboradores, observações, feedbacks, One a Ones e planos reais serão apagados. Os exemplos continuam disponíveis para consulta. Exporte um backup antes se quiser guardar.',
      confirmar: 'Limpar operação', perigo: true
    }).then(ok => {
      if (!ok) return;
      const alvos = App.seed.COLECOES_EXEMPLO;
      Promise.all(alvos.map(c => {
        const exemplos = db.cache[c].filter(x => x.exemplo);
        db.cache[c] = exemplos;
        return App.adapter.replaceAll(c, exemplos);
      })).then(() => {
        App.bus.emit('dados:mudou', { colecao: '*', acao: 'recarregar', doc: null });
        App.toast.ok('Operação zerada', 'A equipe está pronta para receber as pessoas reais.');
        App.router.go('/dashboard');
      });
    });
  }

  function exportar() {
    const snap = db.exportar();
    u.baixarArquivo('backup-one-a-one-' + u.today() + '.json', JSON.stringify(snap, null, 2), 'application/json');
    App.toast.ok('Backup gerado', 'Guarde o arquivo em local seguro.');
  }

  function importar() {
    const inp = u.el('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
    document.body.appendChild(inp);
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        let snap;
        try { snap = JSON.parse(r.result); } catch (e) {
          App.toast.erro('Arquivo inválido', 'Não foi possível ler o JSON.');
          return;
        }
        if (!snap || !snap.dados) { App.toast.erro('Arquivo inválido', 'Formato de backup não reconhecido.'); return; }
        App.modal.confirmar({
          titulo: 'Importar backup',
          mensagem: 'Todos os dados atuais serão substituídos pelo conteúdo do arquivo. Essa ação não pode ser desfeita.',
          confirmar: 'Substituir tudo', perigo: true
        }).then(ok => {
          if (!ok) return;
          db.importar(snap).then(() => {
            App.toast.ok('Backup importado', 'Dados restaurados com sucesso.');
            App.router.go('/dashboard');
            App.recarregarTela();
          });
        });
      };
      r.readAsText(f);
    });
    inp.click();
  }

  function apagarTudo() {
    App.modal.confirmar({
      titulo: 'Apagar todos os dados',
      mensagem: 'Operação e exemplos serão removidos deste navegador. Exporte um backup antes se quiser guardar.',
      confirmar: 'Apagar tudo', perigo: true
    }).then(ok => {
      if (!ok) return;
      db.limpar().then(() => {
        App.toast.ok('Base limpa', 'O sistema está zerado.');
        App.router.go('/dashboard');
        App.recarregarTela();
      });
    });
  }

  App.pages = App.pages || {};
  App.pages.config = { render, titulo: 'Configurações', sub: 'Preferências, dados e exemplos' };
})(window.App);
