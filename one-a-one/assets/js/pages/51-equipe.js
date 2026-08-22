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

    box.appendChild(u.el('div.u-row.u-wrap.u-gap-3.u-mb-4', {}, [
      busca, segStatus, selOrdem, u.el('span.u-grow'), segModo
    ]));

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
          ]),
          u.el('button.icon-btn', {
            type: 'button', 'aria-label': 'Ações', html: App.icon('more'),
            onclick: ev => { ev.stopPropagation(); menuColab(ev.currentTarget, c); }
          })
        ]),
        c.status === 'inativo' ? u.el('span.badge.badge--outline', { text: 'Inativo' }) : p.barraMeta(ind.pctMeta),
        u.el('div.person-card__meta', {}, [
          metaBloco('Realizado', u.fmtMoedaCurta(ind.realizado)),
          metaBloco('Próximo 1:1', c.status === 'inativo' ? '—' : (c.proximoOneAOne ? u.fmtDate(c.proximoOneAOne, false) : 'sem data')),
          metaBloco('Registros', String(res.total) + (res.atencao ? ' · ' + res.atencao + ' atenção' : '')),
          metaBloco('Ações abertas', String(abertos))
        ]),
        u.el('div.u-row.u-gap-2', {}, [
          p.badge1a1(c),
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

  function metaBloco(l, v) {
    return u.el('div', {}, [
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
        u.el('td', { class: 'u-right t-num', text: u.fmtMoedaCurta(ind.realizado) }),
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
        u.el('thead', {}, [u.el('tr', {}, ['Colaborador', 'Status', 'Realizado', '% da meta', 'Registros', 'Atenção', 'Próximo 1:1', '']
          .map((h, i) => u.el('th', { class: i === 2 || i === 4 || i === 5 ? 'u-right' : '', text: h })))]),
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
