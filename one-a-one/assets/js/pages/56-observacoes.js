/* =========================================================================
   pages/56-observacoes.js — Todas as observacoes da equipe, com filtros.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, g = App.g, db = App.db, cat = App.cat, A = App.analise;

  /* `pol` filtra por polaridade (positivo / atenção) e existe para os cards
     de cima serem clicáveis. É independente de `tipo`, que filtra um tipo só. */
  const f = { colab: '', tipo: 'todos', contexto: 'todos', impacto: 'todos', periodo: '30', busca: '', lote: 'todos', pol: 'todos', desde: '' };

  function render(view, params, query) {
    /* Filtros vindos por link (os KPIs do Preparar apontam para ca). Cada um
       so e aplicado quando vem na URL, para nao apagar o que o usuario ja
       tinha escolhido ao voltar para a tela. */
    if (query) {
      if (query.colab) f.colab = query.colab;
      if (query.pol) f.pol = query.pol;
      if (query.lote) f.lote = query.lote;
      if (query.desde) { f.desde = query.desde; f.periodo = 'todos'; }
      else if (query.colab || query.pol) { f.desde = ''; }
    }
    const box = u.el('div.view__inner');

    box.appendChild(u.el('div.page-head', {}, [
      u.el('div', {}, [
        u.el('div.page-head__title', { text: 'Observações' }),
        u.el('div.page-head__desc', { text: 'Tudo o que você registrou no dia a dia — a matéria-prima dos One a Ones.' })
      ]),
      u.el('div.u-row.u-gap-2', {}, [
        u.el('button.btn.btn--outline', {
          type: 'button', html: App.icon('download') + '<span>Exportar</span>', onclick: exportar
        }),
        u.el('button.btn.btn--primary', {
          type: 'button', html: App.icon('plus') + '<span>Nova observação</span>',
          onclick: () => App.obsModal.abrir(f.colab ? { colaboradorId: f.colab } : {})
        })
      ])
    ]));

    /* --------------------------- filtros --------------------------- */
    const barra = u.el('div.card.card--pad-sm.u-mb-4');
    const linha = u.el('div.u-row.u-wrap.u-gap-3');

    const busca = u.el('div.search', { style: { flex: '1 1 220px', minWidth: '180px' } }, [
      u.el('span', { html: App.icon('search') }),
      u.el('input', { type: 'search', placeholder: 'Buscar no texto da observação', value: f.busca })
    ]);
    busca.querySelector('input').addEventListener('input', u.debounce(function () { f.busca = this.value; pintar(); }, 150));
    linha.appendChild(busca);

    linha.appendChild(p.selectColaborador(f.colab, { onChange: v => { f.colab = v; pintar(); } }));

    linha.appendChild(selectDe('tipo', 'Todos os tipos', cat.TIPOS_OBS.map(t => ({ id: t.id, label: t.emoji + ' ' + t.label }))));
    linha.appendChild(selectDe('contexto', 'Todos os contextos', cat.CONTEXTOS.map(t => ({ id: t.id, label: t.emoji + ' ' + t.label }))));
    linha.appendChild(selectDe('impacto', 'Qualquer impacto', cat.IMPACTOS.map(t => ({ id: t.id, label: 'Impacto ' + t.label.toLowerCase() }))));
    linha.appendChild(selectDe('lote', 'Individuais e em lote',
      [{ id: 'so', label: '👥 Só lançamentos em lote' }, { id: 'nao', label: 'Só registros individuais' }]));
    linha.appendChild(selectDe('periodo', 'Todo o período',
      [{ id: '7', label: 'Últimos 7 dias' }, { id: '30', label: 'Últimos 30 dias' }, { id: '90', label: 'Últimos 90 dias' }], 'todos'));

    const limpar = u.el('button.btn.btn--sm.btn--ghost', {
      type: 'button', html: App.icon('x') + '<span>Limpar filtros</span>',
      onclick: () => {
        f.colab = ''; f.tipo = 'todos'; f.contexto = 'todos'; f.impacto = 'todos'; f.periodo = 'todos'; f.busca = ''; f.lote = 'todos'; f.pol = 'todos'; f.desde = '';
        App.recarregarTela();
      }
    });
    linha.appendChild(limpar);
    barra.appendChild(linha);
    box.appendChild(barra);

    function selectDe(chave, rotuloVazio, itens, valorVazio) {
      const s = u.el('select.select.select--sm', { style: { width: 'auto' } });
      s.appendChild(u.el('option', { value: valorVazio || 'todos', text: rotuloVazio }));
      itens.forEach(i => s.appendChild(u.el('option', { value: i.id, text: i.label })));
      s.value = f[chave];
      s.addEventListener('change', () => { f[chave] = s.value; pintar(); });
      return s;
    }

    const resumo = u.el('div.u-mb-4');
    const lista = u.el('div.u-col.u-gap-3');
    box.appendChild(resumo);
    box.appendChild(lista);

    function filtradas() {
      let obs = db.observacoes.todos();
      if (f.colab) obs = obs.filter(o => o.colaboradorId === f.colab);
      if (f.tipo !== 'todos') obs = obs.filter(o => o.tipo === f.tipo);
      if (f.contexto !== 'todos') obs = obs.filter(o => o.contexto === f.contexto);
      if (f.impacto !== 'todos') obs = obs.filter(o => o.impacto === f.impacto);
      if (f.lote === 'so') obs = obs.filter(o => !!o.loteId);
      else if (f.lote === 'nao') obs = obs.filter(o => !o.loteId);
      if (f.pol === 'pos') obs = obs.filter(o => cat.tipoObs(o.tipo).pol > 0);
      else if (f.pol === 'ate') obs = obs.filter(o => cat.tipoObs(o.tipo).pol < 0);
      /* `desde` vem do Preparar: recorta exatamente o periodo do encontro,
         para o numero do card bater com a lista que abre aqui. */
      if (f.desde) obs = obs.filter(o => u.diffDays(f.desde, o.data) >= 0);
      else if (f.periodo !== 'todos') obs = obs.filter(o => u.diffDays(o.data, new Date()) <= +f.periodo);
      const q = u.norm(f.busca).trim();
      if (q) obs = obs.filter(o => u.norm(o.texto).indexOf(q) >= 0);
      return u.sortBy(obs, o => o.data, 'desc');
    }

    /* Alterna um filtro pelo card: clicar de novo no card ativo desliga. */
    function alternarFiltro(chave, valor) {
      f[chave] = f[chave] === valor ? 'todos' : valor;
      pintar();
      resumo.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function pintar() {
      const obs = filtradas();
      const pos = obs.filter(o => cat.tipoObs(o.tipo).pol > 0).length;
      const aten = obs.filter(o => cat.tipoObs(o.tipo).pol < 0).length;
      const tocados = u.uniq(obs.map(o => o.colaboradorId));
      const emLote = obs.filter(o => o.loteId);
      const algumFiltro = f.colab || f.busca || f.desde || f.pol !== 'todos' || f.lote !== 'todos' ||
        f.tipo !== 'todos' || f.contexto !== 'todos' || f.impacto !== 'todos' || f.periodo !== 'todos';

      u.clear(resumo);
      if (f.desde) {
        resumo.appendChild(u.el('div.note.note--brand.u-mb-3.u-row.u-wrap.u-gap-2', { style: { alignItems: 'center' } }, [
          u.el('span', { html: App.icon('calendar', '', 14) }),
          u.el('span.u-grow', {
            text: 'Período do One a One' + (f.colab ? ' de ' + u.primeiroNome(db.colaboradores.nome(f.colab)) : '') +
                  ' — desde ' + u.fmtDate(f.desde) + '.'
          }),
          u.el('button.btn.btn--xs.btn--outline', {
            type: 'button', text: 'Ver todo o histórico',
            onclick: () => { f.desde = ''; f.periodo = 'todos'; pintar(); }
          })
        ]));
      }
      resumo.appendChild(u.el('div.grid.grid-kpi', {}, [
        p.kpi({
          label: 'Registros no filtro', valor: obs.length, icone: 'eye', tom: 'brand',
          tip: algumFiltro ? 'Limpar todos os filtros' : 'Nenhum filtro ativo',
          onClick: algumFiltro ? (() => limpar.click()) : null,
          rodape: algumFiltro ? '<span class="t-muted2">clique para limpar os filtros</span>' : null
        }),
        p.kpi({
          label: 'Positivos', valor: pos, icone: 'star', tom: 'ok',
          ativo: f.pol === 'pos',
          tip: f.pol === 'pos' ? 'Mostrando só os positivos — clique para voltar' : 'Ver só os positivos',
          onClick: () => alternarFiltro('pol', 'pos')
        }),
        p.kpi({
          label: 'Pontos de atenção', valor: aten, icone: 'alert', tom: aten ? 'warn' : 'neutral',
          ativo: f.pol === 'ate',
          tip: f.pol === 'ate' ? 'Mostrando só os pontos de atenção — clique para voltar' : 'Ver só os pontos de atenção',
          onClick: () => alternarFiltro('pol', 'ate')
        }),
        p.kpi({
          /* Sem clique: quem escolhe o consultor e o seletor da barra de cima.
             O card so informa quantas pessoas aparecem no recorte atual. */
          label: 'Colaboradores tocados', valor: tocados.length, icone: 'users', tom: 'purple',
          ativo: !!f.colab,
          rodape: f.colab
            ? '<span class="t-muted2">filtrando ' + u.esc(u.primeiroNome(db.colaboradores.nome(f.colab))) + '</span>'
            : (tocados.length ? '<span class="t-muted2">de ' + db.colaboradores.ativos().length + ' ativos</span>' : null)
        }),
        p.kpi({
          label: 'Lançamentos em lote',
          valor: u.uniq(emLote.map(o => o.loteId)).length,
          icone: 'users', tom: 'info',
          ativo: f.lote === 'so',
          tip: f.lote === 'so' ? 'Mostrando só os lançamentos em lote — clique para voltar' : 'Ver só os lançamentos em lote',
          onClick: () => alternarFiltro('lote', 'so'),
          rodape: '<span class="t-muted2">' + u.plural(emLote.length, 'registro gerado', 'registros gerados') + '</span>'
        })
      ]));

      u.clear(lista);
      if (!obs.length) {
        lista.appendChild(u.el('div.card', {}, [p.vazio({
          icone: 'eye', titulo: 'Nenhuma observação neste filtro',
          desc: 'Ajuste os filtros acima ou registre uma nova observação — leva 20 segundos.',
          acoes: [
            { label: 'Nova observação', icone: 'plus', onClick: () => App.obsModal.abrir(f.colab ? { colaboradorId: f.colab } : {}) },
            { label: 'Limpar filtros', tipo: 'outline', onClick: () => limpar.click() }
          ]
        })]));
        return;
      }

      const porDia = u.groupBy(obs, o => u.toISODate(o.data));
      Object.keys(porDia).sort().reverse().forEach(dia => {
        lista.appendChild(u.el('div.u-row.u-gap-2', { style: { marginTop: '8px' } }, [
          u.el('span.t-up', { text: u.fmtDateLong(dia) }),
          u.el('span.t-xs.t-muted2', { text: '· ' + u.fmtRelativo(dia) + ' · ' + u.plural(porDia[dia].length, 'registro') })
        ]));
        porDia[dia].forEach(o => lista.appendChild(p.cardObservacao(o, {
          comColaborador: true,
          aoEditar: x => App.obsModal.abrir({ observacao: x }),
          aoRemover: x => App.obsModal.remover(x)
        })));
      });
    }

    pintar();
    u.clear(view);
    view.appendChild(box);

    function exportar() {
      const obs = filtradas();
      if (!obs.length) { App.toast.aviso('Nada para exportar', 'O filtro atual não retornou registros.'); return; }
      const L = [['Data', 'Colaborador', 'Tipo', 'Contexto', 'Impacto', 'Observação', 'Evidências', 'Lote']];
      obs.forEach(o => L.push([
        u.fmtDateTime(o.data), db.colaboradores.nome(o.colaboradorId),
        cat.tipoObs(o.tipo).label, cat.contexto(o.contexto).label, cat.impacto(o.impacto).label,
        o.texto, (o.evidencias || []).map(e => e.nome).join(' | '),
        o.loteId ? 'Em lote (' + db.observacoes.doLote(o.loteId).length + ')' : 'Individual'
      ]));
      const csv = L.map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
      u.baixarArquivo('observacoes-' + u.today() + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
      App.toast.ok('Arquivo gerado', u.plural(obs.length, 'observação exportada', 'observações exportadas'));
    }
  }

  App.pages = App.pages || {};
  App.pages.observacoes = { render, titulo: 'Observações', sub: 'Registros do dia a dia' };
})(window.App);
