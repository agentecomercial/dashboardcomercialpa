/* =========================================================================
   pages/58-planos.js — Planos de desenvolvimento (quadro + lista).
   Expoe App.pages.planos.kanban() reaproveitado no perfil do colaborador.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, db = App.db, cat = App.cat;

  const f = { colab: '', status: 'todos', modo: 'quadro' };

  /* Colunas do quadro (cancelado entra só quando existir) */
  const COLUNAS = ['nao_iniciado', 'em_andamento', 'atrasado', 'concluido'];

  function render(view, params, query) {
    if (query && query.status) f.status = query.status;
    const box = u.el('div.view__inner');

    box.appendChild(u.el('div.page-head', {}, [
      u.el('div', {}, [
        u.el('div.page-head__title', { text: 'Planos de desenvolvimento' }),
        u.el('div.page-head__desc', { text: 'O que foi combinado nos One a Ones — com dono, prazo e indicador de sucesso.' })
      ]),
      u.el('button.btn.btn--primary', {
        type: 'button', html: App.icon('plus') + '<span>Novo plano</span>',
        onclick: () => App.planoModal.abrir({
          colaboradorId: f.colab || undefined,
          aoSalvar: () => App.recarregarTela()
        })
      })
    ]));

    /* KPIs */
    const todos = db.planos.todos();
    const abertos = db.planos.abertos();
    const atrasados = db.planos.atrasados();
    const concluidos = todos.filter(x => x.status === 'concluido');
    const taxa = todos.length ? (concluidos.length / todos.filter(x => x.status !== 'cancelado').length) * 100 : 0;

    box.appendChild(u.el('div.grid.grid-kpi.u-mb-5.stagger', {}, [
      p.kpi({ label: 'Planos ativos', valor: abertos.length, icone: 'flag', tom: 'brand' }),
      p.kpi({ label: 'Atrasados', valor: atrasados.length, icone: 'alert', tom: atrasados.length ? 'danger' : 'ok' }),
      p.kpi({ label: 'Concluídos', valor: concluidos.length, icone: 'checkCircle', tom: 'ok' }),
      p.kpi({
        label: 'Taxa de conclusão', valor: u.fmtPct(taxa), icone: 'target', tom: 'purple',
        rodape: '<span class="t-muted2">Dos planos não cancelados</span>'
      })
    ]));

    /* Filtros */
    const barra = u.el('div.u-row.u-wrap.u-gap-3.u-mb-4');
    barra.appendChild(p.selectColaborador(f.colab, { onChange: v => { f.colab = v; pintar(); } }));

    const selStatus = u.el('select.select.select--sm', { style: { width: 'auto' } });
    selStatus.appendChild(u.el('option', { value: 'todos', text: 'Todos os status' }));
    cat.STATUS_PLANO.forEach(s => selStatus.appendChild(u.el('option', { value: s.id, text: s.emoji + ' ' + s.label })));
    selStatus.value = f.status;
    selStatus.addEventListener('change', () => { f.status = selStatus.value; pintar(); });
    barra.appendChild(selStatus);

    barra.appendChild(u.el('span.u-grow'));

    const segModo = u.el('div.seg');
    [['quadro', 'grid'], ['lista', 'list']].forEach(([id, ic]) => {
      segModo.appendChild(u.el('button.seg__btn' + (f.modo === id ? '.is-on' : ''), {
        type: 'button', html: App.icon(ic), 'data-tip': id === 'quadro' ? 'Ver em quadro' : 'Ver em lista',
        onclick: ev => {
          f.modo = id;
          u.$$('.seg__btn', segModo).forEach(b => b.classList.remove('is-on'));
          ev.currentTarget.classList.add('is-on');
          pintar();
        }
      }));
    });
    barra.appendChild(segModo);
    box.appendChild(barra);

    const conteudo = u.el('div');
    box.appendChild(conteudo);

    function filtrados() {
      let lista = db.planos.todos();
      if (f.colab) lista = lista.filter(x => x.colaboradorId === f.colab);
      if (f.status !== 'todos') lista = lista.filter(x => db.planos.statusEfetivo(x) === f.status);
      return lista;
    }

    function pintar() {
      u.clear(conteudo);
      const lista = filtrados();
      if (!lista.length) {
        conteudo.appendChild(u.el('div.card', {}, [p.vazio({
          icone: 'flag', titulo: 'Nenhum plano neste filtro',
          desc: 'Planos nascem dos compromissos do One a One — ou você cria um direto por aqui.',
          acoes: [{ label: 'Criar plano de ação', icone: 'plus', onClick: () => App.planoModal.abrir({ colaboradorId: f.colab || undefined, aoSalvar: () => App.recarregarTela() }) }]
        })]));
        return;
      }
      conteudo.appendChild(f.modo === 'quadro' ? kanban(lista, { comColaborador: !f.colab }) : tabela(lista));
    }

    pintar();
    u.clear(view);
    view.appendChild(box);
  }

  /* ------------------------------ Quadro ------------------------------ */
  function kanban(planos, opts) {
    opts = opts || {};
    const colunas = COLUNAS.slice();
    if (planos.some(x => x.status === 'cancelado')) colunas.push('cancelado');

    const kb = u.el('div.kanban');
    colunas.forEach(st => {
      const meta = cat.statusPlano(st);
      const itens = planos.filter(x => db.planos.statusEfetivo(x) === st);
      const col = u.el('div.kb-col', {}, [
        u.el('div.kb-col__h', {}, [
          u.el('span', { text: meta.emoji }),
          u.el('span.kb-col__t', { text: meta.label }),
          u.el('span.kb-col__n', { text: String(itens.length) })
        ])
      ]);
      if (!itens.length) {
        col.appendChild(u.el('div.t-xs.t-muted2', { style: { padding: '10px 6px', textAlign: 'center' }, text: 'Nada aqui' }));
      } else {
        u.sortBy(itens, x => x.prazo || '9999').forEach(pl => {
          const card = p.cardPlano(pl, {
            comColaborador: opts.comColaborador !== false,
            aoAbrir: x => App.planoModal.abrir({ plano: x, aoSalvar: () => App.recarregarTela() })
          });
          card.addEventListener('contextmenu', ev => {
            ev.preventDefault();
            App.planoModal.menuStatus(card, pl, () => App.recarregarTela());
          });
          col.appendChild(card);
        });
      }
      kb.appendChild(col);
    });
    return kb;
  }

  /* ------------------------------ Lista ------------------------------ */
  function tabela(planos) {
    const tb = u.el('tbody');
    u.sortBy(planos, x => x.prazo || '9999').forEach(pl => {
      const st = db.planos.statusEfetivo(pl);
      const c = db.colaboradores.por(pl.colaboradorId);
      tb.appendChild(u.el('tr', { onclick: () => App.planoModal.abrir({ plano: pl, aoSalvar: () => App.recarregarTela() }) }, [
        u.el('td', {}, [u.el('div.u-row.u-gap-2', {}, [
          c ? p.avatar(c, 'xs') : null,
          u.el('span.t-sm', { text: c ? u.primeiroNome(c.nome) : '—' })
        ])]),
        u.el('td', {}, [
          u.el('div.t-semi', { text: pl.ponto }),
          pl.acao ? u.el('div.t-xs.t-muted.u-clamp-2', { text: pl.acao }) : null
        ]),
        u.el('td', { class: 't-sm', text: pl.indicador || '—' }),
        u.el('td', { class: 't-sm u-nowrap' + (st === 'atrasado' ? ' t-danger t-strong' : ''), text: pl.prazo ? u.fmtDate(pl.prazo) : '—' }),
        u.el('td', {}, [p.badgeStatusPlano(st)]),
        u.el('td', { class: 'u-right' }, [u.el('button.icon-btn', {
          type: 'button', 'aria-label': 'Ações', html: App.icon('more'),
          onclick: ev => {
            ev.stopPropagation();
            App.menu(ev.currentTarget, [
              { label: 'Editar plano', icone: 'edit', onClick: () => App.planoModal.abrir({ plano: pl, aoSalvar: () => App.recarregarTela() }) },
              { label: 'Mudar status', icone: 'refresh', onClick: () => App.planoModal.menuStatus(ev.currentTarget, pl, () => App.recarregarTela()) },
              { label: 'Abrir perfil', icone: 'user', onClick: () => App.router.go('/colaborador/' + pl.colaboradorId + '/plano') },
              { sep: true },
              { label: 'Excluir', icone: 'trash', perigo: true, onClick: () => App.planoModal.remover(pl) }
            ]);
          }
        })])
      ]));
    });

    return u.el('div.card', {}, [u.el('div.tbl-wrap', {}, [
      u.el('table.tbl.tbl--click', {}, [
        u.el('thead', {}, [u.el('tr', {}, ['Quem', 'Ponto a desenvolver', 'Indicador', 'Prazo', 'Status', '']
          .map(h => u.el('th', { text: h })))]),
        tb
      ])
    ])]);
  }

  App.pages = App.pages || {};
  App.pages.planos = { render, kanban, titulo: 'Planos de desenvolvimento', sub: 'Acompanhamento das ações' };
})(window.App);
