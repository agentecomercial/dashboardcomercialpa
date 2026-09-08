/* =========================================================================
   pages/51-equipe.js — Lista/gestao de colaboradores.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, db = App.db, A = App.analise;

  const est = { busca: '', status: 'ativo', ordem: 'nome', modo: 'cards' };

  function render(view) {
    const box = u.el('div.view__inner');

    box.appendChild(u.el('div.page-head', {}, [
      u.el('div', {}, [
        u.el('div.page-head__title', { text: 'Equipe' }),
        u.el('div.page-head__desc', { text: 'Cadastro, indicadores e situação de acompanhamento de cada colaborador.' })
      ]),
      u.el('div.u-row.u-gap-2', {}, [
        u.el('button.btn.btn--outline', {
          type: 'button', html: App.icon('download') + '<span>Exportar</span>',
          'data-tip': 'Baixar a lista da equipe em CSV',
          onclick: exportarCsv
        }),
        u.el('button.btn.btn--primary', {
          type: 'button', html: App.icon('userPlus') + '<span>Novo colaborador</span>',
          onclick: () => App.colabModal.abrir({ aoSalvar: () => App.recarregarTela() })
        })
      ])
    ]));

    /* ---------------------------- filtros ---------------------------- */
    const busca = u.el('div.search', { style: { flex: '1 1 240px', maxWidth: '340px' } }, [
      u.el('span', { html: App.icon('search') }),
      u.el('input', { type: 'search', placeholder: 'Buscar por nome, cargo ou e-mail', value: est.busca })
    ]);
    busca.querySelector('input').addEventListener('input', u.debounce(function () {
      est.busca = this.value; pintar();
    }, 140));

    const segStatus = u.el('div.seg');
    [['ativo', 'Ativos'], ['todos', 'Todos'], ['inativo', 'Inativos']].forEach(([id, lb]) => {
      segStatus.appendChild(u.el('button.seg__btn' + (est.status === id ? '.is-on' : ''), {
        type: 'button', text: lb,
        onclick: () => {
          est.status = id;
          u.$$('.seg__btn', segStatus).forEach(b => b.classList.toggle('is-on', b.textContent === lb));
          pintar();
        }
      }));
    });

    const selOrdem = u.el('select.select.select--sm', { style: { width: 'auto' } });
    [['nome', 'Ordenar por nome'], ['meta', 'Maior % da meta'], ['proximo', 'Próximo One a One'], ['atencao', 'Mais pontos de atenção']]
      .forEach(([id, lb]) => selOrdem.appendChild(u.el('option', { value: id, text: lb })));
    selOrdem.value = est.ordem;
    selOrdem.addEventListener('change', () => { est.ordem = selOrdem.value; pintar(); });

    const segModo = u.el('div.seg');
    [['cards', 'grid'], ['tabela', 'list']].forEach(([id, ic]) => {
      segModo.appendChild(u.el('button.seg__btn' + (est.modo === id ? '.is-on' : ''), {
        type: 'button', html: App.icon(ic), 'data-tip': id === 'cards' ? 'Ver em cards' : 'Ver em tabela',
        onclick: ev => {
          est.modo = id;
          u.$$('.seg__btn', segModo).forEach(b => b.classList.remove('is-on'));
          ev.currentTarget.classList.add('is-on');
          pintar();
        }
      }));
    });

    const btnAtualizar = u.el('button.btn.btn--sm.btn--outline.u-nowrap', {
      type: 'button', id: 'btnAtualizarMetas',
      html: App.icon('refresh') + '<span>Atualizar valores</span>',
      'data-tip': 'Sincroniza as metas do Meta Master e recarrega a base',
      onclick: () => {
        /* Um erro aqui deixaria o clique sem resposta nenhuma — o pior tipo
           de falha, porque parece que o botao nao funciona. */
        try { abrirModalAtualizar(); }
        catch (e) { App.toast.erro('Não consegui abrir', e.message); }
      }
    });

    box.appendChild(u.el('div.u-row.u-wrap.u-gap-3.u-mb-4', {}, [
      busca, segStatus, selOrdem, u.el('span.u-grow'), btnAtualizar, segModo
    ]));

    /* ---- painel de meta do time, logo acima da lista ---- */
    const painelTime = u.el('div.u-mb-4');
    box.appendChild(painelTime);

    function pintarTime() {
      u.clear(painelTime);
      const t = A.metaTime();
      if (t.temMeta) painelTime.appendChild(cardTime(t));
    }
    pintarTime();

    /* ------------------------------------------------------------------
       Atualizar valores, em dois passos:

         1. SINCRONIZAR — chama /api/sincronizar, que roda o
            Sincronizar-Faturamento.ps1 no servidor local. É o passo que
            traz metas e faturamento novos do Meta Master.
         2. RECARREGAR  — relê a base compartilhada e repinta.

       O passo 1 só existe quando o app está servido pelo Servir.ps1. Em
       file:// o navegador não executa PowerShell, então sobra o passo 2 —
       e o toast diz o que falta, em vez de fingir que atualizou.
       ------------------------------------------------------------------ */
    const temServidor = location.protocol === 'http:' || location.protocol === 'https:';
    let carregando = false;

    /* ------------------------------------------------------------------
       Modal de atualizacao: escolhe a competencia e quem entra.
       O seletor de mes existe para o lancamento retroativo — sem ele o
       botao so alcancaria o mes corrente, e um ajuste em agosto que
       entrasse hoje nunca chegaria ao app.
       ------------------------------------------------------------------ */
    function abrirModalAtualizar() {
      if (carregando) return;
      const ativos = db.colaboradores.ativos().filter(c => !c.exemplo);
      if (!ativos.length) {
        App.toast.aviso('Nenhum colaborador ativo', 'Cadastre a equipe antes de sincronizar.');
        return;
      }
      const hoje = A.competenciaAtual();
      const escolhidos = {};
      ativos.forEach(c => { escolhidos[c.id] = true; });

      /* Competencias oferecidas: a atual mais as que aparecem no historico. */
      const comps = {};
      comps[hoje] = true;
      ativos.forEach(c => A.historico(c).forEach(h => { if (h.mes) comps[h.mes] = true; }));
      const listaComps = Object.keys(comps).sort().reverse();

      const selComp = u.el('select.select');
      listaComps.forEach(x => selComp.appendChild(u.el('option', {
        value: x, text: u.fmtCompetenciaLonga(x) + (x === hoje ? ' · mês corrente' : ''),
        selected: x === hoje ? true : null
      })));

      const chkGerar = u.el('input', { type: 'checkbox' });
      const lista = u.el('div.u-col.u-gap-1');
      const corpo = u.el('div.u-col.u-gap-4');

      function pintarLista() {
        u.clear(lista);
        const todosOn = ativos.every(c => escolhidos[c.id]);

        lista.appendChild(u.el('button.pick-item' + (todosOn ? '.is-on' : ''), {
          type: 'button',
          onclick: () => { ativos.forEach(c => { escolhidos[c.id] = !todosOn; }); pintarLista(); }
        }, [
          u.el('span.pick-item__box', { html: App.icon('check') }),
          u.el('div.u-grow', {}, [u.el('div.t-semi', { text: 'Todos (' + ativos.length + ')' })])
        ]));

        ativos.forEach(c => {
          const on = !!escolhidos[c.id];
          const m = A.metaMes(c);
          const comp = selComp.value;
          const linha = A.historico(c).filter(h => h.mes === comp)[0];
          const info = linha && +linha.meta
            ? u.fmtMoedaCurta(linha.realizado) + ' · ' + u.fmtPct((linha.realizado / linha.meta) * 100, 0)
            : (comp === m.periodo && m.temMeta
                ? u.fmtMoedaCurta(m.realizado) + ' · ' + u.fmtPct(m.pct, 0)
                : 'sem dado');

          lista.appendChild(u.el('button.pick-item' + (on ? '.is-on' : ''), {
            type: 'button',
            onclick: () => { escolhidos[c.id] = !escolhidos[c.id]; pintarLista(); }
          }, [
            u.el('span.pick-item__box', { html: App.icon('check') }),
            p.avatar(c, 'xs'),
            u.el('div.u-grow', { style: { minWidth: 0 } }, [
              u.el('div.t-sm.u-truncate', { text: c.nome })
            ]),
            u.el('span.t-xs.t-muted2.u-nowrap', { text: info })
          ]));
        });
      }

      selComp.addEventListener('change', pintarLista);
      pintarLista();

      /* Sem servidor o app nao executa PowerShell: sobra reler a base. Dizer
         isso aqui e melhor do que oferecer opcoes que nao vao surtir efeito. */
      if (!temServidor) {
        corpo.appendChild(u.el('div.note.note--warn', {}, [
          u.el('div.t-sm.t-strong', { text: 'Sem o servidor local, só dá para reler a base.' }),
          u.el('div.t-sm', { style: { marginTop: '3px' }, text:
            'Para sincronizar do Meta Master, feche esta aba e abra o app pelo "Abrir Evolui.vbs". '
            + 'O botão passa a rodar o Sincronizar-Faturamento.ps1 sozinho.' })
        ]));
      }

      corpo.appendChild(p.campo('Competência', selComp, {
        hint: temServidor
          ? 'Escolha um mês anterior para trazer lançamento que entrou atrasado.'
          : 'Sem servidor esta escolha não tem efeito — a base é apenas relida.'
      }));
      corpo.appendChild(u.el('div', {}, [
        u.el('div.t-up.u-mb-2', { text: 'Quem atualizar' }),
        lista
      ]));
      corpo.appendChild(u.el('label.u-row.u-gap-2', { style: { cursor: 'pointer' } }, [
        chkGerar,
        u.el('div', {}, [
          u.el('div.t-sm', { text: 'Consultar o Sales Cube antes' }),
          u.el('div.field__hint', { text: 'Regera o Meta Master do período. Mais demorado, necessário quando houve venda nova.' })
        ])
      ]));

      App.modal.abrir({
        titulo: 'Atualizar valores', icone: 'refresh', tamanho: 'sm',
        desc: 'Sincroniza metas e faturamento do Meta Master para o Evolui.',
        corpo: corpo,
        acoes: [
          { label: 'Cancelar', tipo: 'ghost' },
          { label: temServidor ? 'Atualizar' : 'Reler a base', tipo: 'primary', icone: 'check', onClick: () => {
              const ids = ativos.filter(c => escolhidos[c.id]).map(c => c.id);
              if (!ids.length) { App.toast.aviso('Ninguém selecionado'); return false; }
              atualizarValores({
                periodo: selComp.value,
                gerar: chkGerar.checked,
                consultores: ids.length === ativos.length ? [] : ids
              });
              return true;
            } }
        ]
      });
    }

    function atualizarValores(opts) {
      opts = opts || {};
      if (carregando) return;
      carregando = true;
      btnAtualizar.disabled = true;
      const antes = A.metaTime();

      function fim() {
        carregando = false;
        btnAtualizar.disabled = false;
        btnAtualizar.innerHTML = App.icon('refresh') + '<span>Atualizar valores</span>';
      }

      function recarregar(sync) {
        btnAtualizar.innerHTML = '<span class="spinner"></span><span>Lendo a base…</span>';
        return db.carregar().then(() => {
          const t = A.metaTime();
          pintarTime();
          pintar();
          const delta = t.realizado - antes.realizado;

          if (sync && sync.ok) {
            App.toast.ok('Sincronizado · ' + u.fmtCompetenciaLonga(sync.periodo || t.periodo),
              sync.gravados + ' de ' + sync.total + ' consultores atualizados a partir do Meta Master');
          } else if (!t.temMeta) {
            App.toast.aviso('Sem meta para ' + u.fmtCompetenciaLonga(t.periodo || t.competenciaHoje),
              temServidor ? 'A sincronização não trouxe metas — confira o metas-vitoria.json.'
                          : 'Abra o app pelo Servir.ps1 para o botão sincronizar sozinho.');
          } else if (Math.abs(delta) >= 0.01) {
            App.toast.ok('Valores atualizados',
              u.fmtMoedaExata(t.realizado) + ' líquido · ' +
              (delta > 0 ? '+' : '−') + u.fmtMoedaExata(Math.abs(delta)) + ' desde a última leitura');
          } else if (!temServidor) {
            App.toast.info('Base relida', 'Para sincronizar do Meta Master, abra o app pelo Servir.ps1.');
          } else {
            App.toast.info('Tudo em dia', 'Nenhuma mudança desde a última sincronização.');
          }
        });
      }

      if (!temServidor) {
        recarregar(null).catch(e => App.toast.erro('Não foi possível atualizar', e.message)).then(fim);
        return;
      }

      /* Com servidor: sincroniza antes de reler. O -Gerar consulta o Sales
         Cube e demora, então só é pedido quando preciso. */
      btnAtualizar.innerHTML = '<span class="spinner"></span><span>Sincronizando…</span>';
      const alvo = opts.periodo || A.competenciaAtual();
      const quem = (opts.consultores || []).join(',');

      fetch('/api/estado')
        .then(r => r.json())
        .then(est => {
          /* O dados.js precisa estar na competência pedida; se não estiver,
             regerar é obrigatório, marcado ou não. */
          const precisaGerar = opts.gerar || !est || est.metaMasterPeriodo !== alvo;
          if (precisaGerar) {
            btnAtualizar.innerHTML = '<span class="spinner"></span><span>Consultando o Sales Cube…</span>';
          }
          return fetch('/api/sincronizar?periodo=' + alvo +
                       (precisaGerar ? '&gerar=1' : '') +
                       (quem ? '&consultores=' + encodeURIComponent(quem) : ''))
            .then(r => r.json());
        })
        .then(sync => {
          if (!sync.ok) {
            App.toast.erro('A sincronização falhou',
              (sync.saida || sync.erro || '').split('\n').filter(Boolean).slice(-2).join(' · ') || 'Veja a janela do Servir.ps1.');
          }
          return recarregar(sync);
        })
        .catch(e => {
          /* Servidor no ar mas rota indisponivel: ainda vale reler a base. */
          return recarregar(null).then(() => {
            App.toast.aviso('Não consegui sincronizar', e.message + ' — a base foi relida assim mesmo.');
          });
        })
        .then(fim, fim);
    }

    const conteudo = u.el('div');
    box.appendChild(conteudo);

    function filtrados() {
      let lista = db.colaboradores.todos();
      if (est.status !== 'todos') lista = lista.filter(c => (c.status || 'ativo') === est.status);
      const q = u.norm(est.busca).trim();
      if (q) lista = lista.filter(c => u.norm(c.nome + ' ' + c.cargo + ' ' + (c.email || '')).indexOf(q) >= 0);

      if (est.ordem === 'nome') return u.sortBy(lista, c => u.norm(c.nome));
      if (est.ordem === 'meta') return u.sortBy(lista, c => -A.indicadores(c).pctMeta);
      if (est.ordem === 'proximo') return u.sortBy(lista, c => {
        const s = A.situacao1a1(c); return s.dias === null ? 9999 : s.dias;
      });
      return u.sortBy(lista, c => -A.resumoPeriodo(c.id).atencao);
    }

    function pintar() {
      u.clear(conteudo);
      const lista = filtrados();

      if (!lista.length) {
        conteudo.appendChild(u.el('div.card', {}, [p.vazio({
          icone: est.busca ? 'search' : 'users',
          titulo: est.busca ? 'Nenhum colaborador encontrado' : 'Nenhum colaborador nesta visão',
          desc: est.busca
            ? 'Nada combina com "' + est.busca + '". Ajuste a busca ou troque o filtro de status.'
            : 'Cadastre o primeiro integrante da equipe para começar o acompanhamento.',
          acoes: est.busca
            ? [{ label: 'Limpar busca', tipo: 'outline', onClick: () => { est.busca = ''; busca.querySelector('input').value = ''; pintar(); } }]
            : [
                { label: 'Cadastrar colaborador', icone: 'userPlus', onClick: () => App.colabModal.abrir({ aoSalvar: () => App.recarregarTela() }) },
        { label: 'Ver exemplos', tipo: 'outline', icone: 'sparkles', onClick: () => App.router.go('/config/exemplos') }
              ]
        })]));
        return;
      }

      conteudo.appendChild(est.modo === 'cards' ? emCards(lista) : emTabela(lista));
    }

    pintar();
    u.clear(view);
    view.appendChild(box);
  }

  /* ------------------------------ cards ------------------------------ */
  function emCards(lista) {
    const grid = u.el('div.grid.grid-cards.stagger');
    lista.forEach(c => {
      const ind = A.indicadores(c);
      const res = A.resumoPeriodo(c.id);
      const abertos = db.planos.abertos(c.id).length;

      grid.appendChild(u.el('div.card.card--hover.person-card.est-' + A.estadoCard(c), {
        onclick: () => App.router.go('/colaborador/' + c.id),
        role: 'button', tabindex: '0',
        onkeydown: ev => { if (ev.key === 'Enter') App.router.go('/colaborador/' + c.id); }
      }, [
        u.el('div.person-card__head', {}, [
          p.avatar(c, 'lg', true),
          u.el('div.u-grow', { style: { minWidth: 0 } }, [
            u.el('div.person-card__name.u-truncate', { text: c.nome }),
            u.el('div.person-card__role.u-truncate', { text: c.cargo })
          ]),
          u.el('button.icon-btn', {
            type: 'button', 'aria-label': 'Ações', html: App.icon('more'),
            onclick: ev => { ev.stopPropagation(); menuColab(ev.currentTarget, c); }
          })
        ]),
        c.status === 'inativo' ? u.el('span.badge.badge--outline', { text: 'Inativo' }) : p.metaFaixas(A.metaMes(c)),
        u.el('div.person-card__meta', {}, [
          (() => {
            const m = A.metaMes(c);
            return metaBloco('Falta p/ meta',
              !m.temMeta ? '—' : m.bateuMaster ? 'bateu a Master' : u.fmtMoedaCurta(m.falta) + ' · ' + m.proxima.curto,
              !m.temMeta ? null : m.bateuMaster
                ? 'Master batida · ' + u.fmtMoedaExata(m.excedente) + ' acima'
                : u.fmtMoedaExata(m.falta) + ' para a ' + m.proxima.label + ' de ' + u.fmtMoedaExata(m.proxima.valor));
          })(),
          metaBloco('Próximo 1:1', c.status === 'inativo' ? '—' : (c.proximoOneAOne ? u.fmtDate(c.proximoOneAOne, false) : 'sem data')),
          metaBloco('Registros', String(res.total) + (res.atencao ? ' · ' + res.atencao + ' atenção' : '')),
          metaBloco('Ações abertas', String(abertos))
        ]),
        u.el('div.u-row.u-wrap.u-gap-2', {}, [
          p.badge1a1(c),
          p.seloCicloFechado(c),
          u.el('span.u-grow'),
          u.el('button.btn.btn--xs.btn--soft', {
            type: 'button', html: App.icon('plus') + '<span>Observação</span>',
            onclick: ev => { ev.stopPropagation(); App.obsModal.abrir({ colaboradorId: c.id }); }
          })
        ])
      ]));
    });
    return grid;
  }

  /* O tooltip guarda o valor cheio, com centavos, que nao cabe no bloco. */
  /* ---------------------------- meta do time ----------------------------
     Mesma leitura do card individual, no agregado: onde a equipe esta e
     quanto falta para a proxima faixa coletiva.
     ---------------------------------------------------------------------- */
  function cardTime(t) {
    /* Ciclo novo: o time inteiro sem meta. Mostra o fechamento anterior. */
    if (t.cicloNovo) {
      const a = t.anterior || {};
      return u.el('div.card.card--pad.time-meta', {}, [
        u.el('div.u-between.u-wrap.u-gap-3.u-mb-3', {}, [
          u.el('div', {}, [
            u.el('div.card__title', { text: 'Time · ' + u.fmtCompetenciaLonga(t.periodo) }),
            u.el('div.t-xs.t-muted2', { text: 'Novo ciclo — as metas ainda não foram sincronizadas' })
          ]),
          u.el('span.badge.badge--warn', { text: 'Aguardando meta' })
        ]),
        u.el('div.note.note--brand', {}, [
          u.el('div.t-sm', {
            text: 'Rode o Sincronizar-Faturamento.ps1 quando as metas de ' +
              u.fmtCompetenciaLonga(t.periodo) + ' estiverem no metas-vitoria.json. ' +
              'O que aconteceu em ' + u.fmtCompetenciaLonga(a.periodo) + ' continua no histórico de cada consultor.'
          })
        ]),
        a.master
          ? u.el('div.meta-box__ant.u-mt-3', {}, [
              u.el('span.meta-box__rot', { text: u.fmtCompetenciaLonga(a.periodo) + ' fechou em' }),
              u.el('span', {}, [
                u.el('b', { text: u.fmtMoedaExata(a.realizado) }),
                u.el('span.t-muted', { text: ' de ' + u.fmtMoedaExata(a.master) }),
                u.el('span.t-muted', { text: ' · ' + u.plural(a.bateram, 'consultor bateu', 'consultores bateram') + ' a Master' })
              ])
            ])
          : null
      ]);
    }

    const barra = p.metaFaixas({
      temMeta: true, periodo: t.periodo, alvos: t.alvos,
      minima: t.minima, basica: t.basica, master: t.master,
      realizado: t.realizado, bruto: t.bruto, vendas: 0,
      pct: t.pct, atual: t.atual, proxima: t.proxima,
      falta: t.falta, excedente: t.excedente, bateuMaster: t.bateuMaster
    }, { rotulo: 'Meta do time' });

    const carimbo = t.atualizadoEm
      ? 'Sincronizado em ' + u.fmtDateTime(t.atualizadoEm)
      : 'Nunca sincronizado';

    return u.el('div.card.card--pad.time-meta', {}, [
      u.el('div.u-between.u-wrap.u-gap-3.u-mb-3', {}, [
        u.el('div', {}, [
          u.el('div.card__title', { text: 'Time · ' + (t.periodo ? u.fmtCompetenciaLonga(t.periodo) : 'mês atual') }),
          u.el('div.t-xs.t-muted2', {
            text: u.plural(t.consultores, 'consultor com meta', 'consultores com meta') +
              ' · ' + t.bateram + ' já bateu a Master · ' +
              (t.origem === 'unidade' ? 'meta da unidade' : 'soma das metas individuais')
          })
        ]),
        u.el('span', {
          class: 'badge badge--' + (t.bateuMaster ? 'ok' : t.atual ? 'info' : 'warn'),
          text: t.bateuMaster ? 'Master batida' : t.atual ? t.atual.label + ' batida' : 'Abaixo da Mínima'
        })
      ]),
      barra,
      u.el('div.u-mt-3', {
        class: 't-xs ' + (t.desatualizado ? 't-warn' : 't-muted2'),
        text: t.desatualizado
          ? carimbo + ' — números de ' + u.fmtCompetenciaLonga(t.periodo) +
            ', a competência vigente é ' + u.fmtCompetenciaLonga(t.competenciaHoje) + '.'
          : carimbo
      })
    ]);
  }

  function metaBloco(l, v, tip) {
    return u.el('div', { 'data-tip': tip || null }, [
      u.el('div.person-card__meta-l', { text: l }),
      u.el('div.person-card__meta-v.u-truncate', { text: v })
    ]);
  }

  /* ------------------------------ tabela ------------------------------ */
  function emTabela(lista) {
    const tb = u.el('tbody');
    lista.forEach(c => {
      const ind = A.indicadores(c);
      const res = A.resumoPeriodo(c.id);
      tb.appendChild(u.el('tr', { onclick: () => App.router.go('/colaborador/' + c.id) }, [
        u.el('td', {}, [u.el('div.u-row.u-gap-3', {}, [
          p.avatar(c, 'sm', true),
          u.el('div', {}, [
            u.el('div.t-semi', { text: c.nome }),
            u.el('div.t-xs.t-muted', { text: c.cargo })
          ])
        ])]),
        u.el('td', {}, [u.el('span', {
          class: 'badge badge--' + (c.status === 'inativo' ? 'outline' : 'ok'),
          text: c.status === 'inativo' ? 'Inativo' : 'Ativo'
        })]),
        u.el('td', { class: 'u-right t-num', 'data-tip': u.fmtMoedaExata(ind.realizado), text: u.fmtMoedaCurta(ind.realizado) }),
        (() => {
          const m = A.metaMes(c);
          return u.el('td', {
            class: 'u-right t-num',
            'data-tip': !m.temMeta ? null : m.bateuMaster
              ? 'Master batida · ' + u.fmtMoedaExata(m.excedente) + ' acima'
              : u.fmtMoedaExata(m.falta) + ' para a ' + m.proxima.label,
            text: !m.temMeta ? '—' : m.bateuMaster ? '✅' : u.fmtMoedaCurta(m.falta)
          });
        })(),
        u.el('td', { style: { minWidth: '120px' } }, [p.barraMeta(ind.pctMeta)]),
        u.el('td', { class: 'u-right t-num', text: String(res.total) }),
        u.el('td', { class: 'u-right t-num' + (res.atencao ? ' t-warn t-strong' : ''), text: String(res.atencao) }),
        u.el('td', {}, [p.badge1a1(c)]),
        u.el('td', { class: 'u-right' }, [u.el('button.icon-btn', {
          type: 'button', 'aria-label': 'Ações', html: App.icon('more'),
          onclick: ev => { ev.stopPropagation(); menuColab(ev.currentTarget, c); }
        })])
      ]));
    });

    return u.el('div.card', {}, [u.el('div.tbl-wrap', {}, [
      u.el('table.tbl.tbl--click', {}, [
        u.el('thead', {}, [u.el('tr', {}, ['Colaborador', 'Status', 'Líquido', 'Falta', '% da meta', 'Registros', 'Atenção', 'Próximo 1:1', '']
          .map((h, i) => u.el('th', { class: i === 2 || i === 3 || i === 5 || i === 6 ? 'u-right' : '', text: h })))]),
        tb
      ])
    ])]);
  }

  /* ------------------------------ menu ------------------------------ */
  function menuColab(alvo, c) {
    App.menu(alvo, [
      { label: 'Abrir perfil', icone: 'user', onClick: () => App.router.go('/colaborador/' + c.id) },
      { label: 'Nova observação', icone: 'plus', onClick: () => App.obsModal.abrir({ colaboradorId: c.id }) },
      { label: 'Novo feedback', icone: 'chat', onClick: () => App.fbModal.abrir({ colaboradorId: c.id }) },
      { label: 'Preparar One a One', icone: 'sparkles', onClick: () => App.router.go('/preparar/' + c.id) },
      { sep: true },
      { label: 'Agendar One a One', icone: 'calendar', onClick: () => App.colabModal.reagendar(c) },
      { label: 'Editar cadastro', icone: 'edit', onClick: () => App.colabModal.abrir({ colaborador: c, aoSalvar: () => App.recarregarTela() }) },
      {
        label: c.status === 'inativo' ? 'Reativar' : 'Marcar como inativo', icone: 'refresh',
        onClick: () => db.colaboradores.atualizar(c.id, { status: c.status === 'inativo' ? 'ativo' : 'inativo' })
          .then(() => App.toast.ok('Status atualizado', c.nome))
      },
      { sep: true },
      { label: 'Excluir', icone: 'trash', perigo: true, onClick: () => App.colabModal.remover(c) }
    ]);
  }

  /* ------------------------------ export ------------------------------ */
  function exportarCsv() {
    const linhas = [['Nome', 'Cargo', 'Status', 'Entrada', 'Meta', 'Realizado', '% Meta', 'Vendas', 'Leads', 'Conversão %', 'Próximo 1:1', 'Frequência (dias)', 'Telefone', 'E-mail']];
    db.colaboradores.todosOrdenados().forEach(c => {
      const i = A.indicadores(c);
      linhas.push([c.nome, c.cargo, c.status, c.dataEntrada, i.meta, i.realizado, i.pctMeta.toFixed(1),
        i.vendas, i.leads, i.conversao.toFixed(1), c.proximoOneAOne || '', c.frequenciaDias, c.telefone || '', c.email || '']);
    });
    const csv = linhas.map(l => l.map(v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    u.baixarArquivo('equipe-' + u.today() + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
    App.toast.ok('Arquivo gerado', 'equipe-' + u.today() + '.csv');
  }

  App.pages = App.pages || {};
  App.pages.equipe = { render, titulo: 'Equipe', sub: 'Colaboradores e acompanhamento' };
})(window.App);
