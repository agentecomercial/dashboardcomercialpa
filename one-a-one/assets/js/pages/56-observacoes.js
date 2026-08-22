/* =========================================================================
   pages/56-observacoes.js — Todas as observacoes da equipe, com filtros.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, g = App.g, db = App.db, cat = App.cat, A = App.analise;

  const f = { colab: '', tipo: 'todos', contexto: 'todos', impacto: 'todos', periodo: '30', busca: '' };

  function render(view, params, query) {
    if (query && query.colab) f.colab = query.colab;
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
    linha.appendChild(selectDe('periodo', 'Todo o período',
      [{ id: '7', label: 'Últimos 7 dias' }, { id: '30', label: 'Últimos 30 dias' }, { id: '90', label: 'Últimos 90 dias' }], 'todos'));

    const limpar = u.el('button.btn.btn--sm.btn--ghost', {
      type: 'button', html: App.icon('x') + '<span>Limpar filtros</span>',
      onclick: () => {
        f.colab = ''; f.tipo = 'todos'; f.contexto = 'todos'; f.impacto = 'todos'; f.periodo = 'todos'; f.busca = '';
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
      if (f.periodo !== 'todos') obs = obs.filter(o => u.diffDays(o.data, new Date()) <= +f.periodo);
      const q = u.norm(f.busca).trim();
      if (q) obs = obs.filter(o => u.norm(o.texto).indexOf(q) >= 0);
      return u.sortBy(obs, o => o.data, 'desc');
    }

    function pintar() {
      const obs = filtradas();
      const pos = obs.filter(o => cat.tipoObs(o.tipo).pol > 0).length;
      const aten = obs.filter(o => cat.tipoObs(o.tipo).pol < 0).length;

      u.clear(resumo);
      resumo.appendChild(u.el('div.grid.grid-kpi', {}, [
        p.kpi({ label: 'Registros no filtro', valor: obs.length, icone: 'eye', tom: 'brand' }),
        p.kpi({ label: 'Positivos', valor: pos, icone: 'star', tom: 'ok' }),
        p.kpi({ label: 'Pontos de atenção', valor: aten, icone: 'alert', tom: aten ? 'warn' : 'neutral' }),
        p.kpi({
          label: 'Colaboradores tocados', valor: u.uniq(obs.map(o => o.colaboradorId)).length,
          icone: 'users', tom: 'purple'
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
      const L = [['Data', 'Colaborador', 'Tipo', 'Contexto', 'Impacto', 'Observação', 'Evidências']];
      obs.forEach(o => L.push([
        u.fmtDateTime(o.data), db.colaboradores.nome(o.colaboradorId),
        cat.tipoObs(o.tipo).label, cat.contexto(o.contexto).label, cat.impacto(o.impacto).label,
        o.texto, (o.evidencias || []).map(e => e.nome).join(' | ')
      ]));
      const csv = L.map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
      u.baixarArquivo('observacoes-' + u.today() + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
      App.toast.ok('Arquivo gerado', u.plural(obs.length, 'observação exportada', 'observações exportadas'));
    }
  }

  App.pages = App.pages || {};
  App.pages.observacoes = { render, titulo: 'Observações', sub: 'Registros do dia a dia' };
})(window.App);
