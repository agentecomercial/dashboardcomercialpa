/* =========================================================================
   pages/57-feedbacks.js — Todos os feedbacks da equipe.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, db = App.db, cat = App.cat;

  const f = { colab: '', classe: 'todos', busca: '' };

  function render(view) {
    const box = u.el('div.view__inner');

    box.appendChild(u.el('div.page-head', {}, [
      u.el('div', {}, [
        u.el('div.page-head__title', { text: 'Feedbacks' }),
        u.el('div.page-head__desc', { text: 'Fato observado, impacto gerado, comportamento esperado e ação combinada.' })
      ]),
      u.el('button.btn.btn--primary', {
        type: 'button', html: App.icon('plus') + '<span>Novo feedback</span>',
        onclick: () => App.fbModal.abrir(f.colab ? { colaboradorId: f.colab } : {})
      })
    ]));

    const barra = u.el('div.u-row.u-wrap.u-gap-3.u-mb-4');
    const busca = u.el('div.search', { style: { flex: '1 1 220px', maxWidth: '320px' } }, [
      u.el('span', { html: App.icon('search') }),
      u.el('input', { type: 'search', placeholder: 'Buscar no conteúdo do feedback', value: f.busca })
    ]);
    busca.querySelector('input').addEventListener('input', u.debounce(function () { f.busca = this.value; pintar(); }, 150));
    barra.appendChild(busca);
    barra.appendChild(p.selectColaborador(f.colab, { onChange: v => { f.colab = v; pintar(); } }));

    const chips = u.el('div.u-row.u-wrap.u-gap-2');
    function pintarChips() {
      u.clear(chips);
      chips.appendChild(u.el('button.chip' + (f.classe === 'todos' ? '.is-on' : ''), {
        type: 'button', text: 'Todas', onclick: () => { f.classe = 'todos'; pintarChips(); pintar(); }
      }));
      cat.CLASSIF_FEEDBACK.forEach(c => {
        const n = db.feedbacks.contar(x => x.classificacao === c.id);
        chips.appendChild(u.el('button.chip' + (f.classe === c.id ? '.is-on' : ''), {
          type: 'button', text: c.emoji + ' ' + c.label + (n ? ' · ' + n : ''),
          onclick: () => { f.classe = c.id; pintarChips(); pintar(); }
        }));
      });
    }
    pintarChips();

    box.appendChild(barra);
    box.appendChild(u.el('div.u-mb-4', {}, [chips]));

    const lista = u.el('div.grid.grid-wide.stagger');
    box.appendChild(lista);

    function pintar() {
      let fbs = db.feedbacks.todos();
      if (f.colab) fbs = fbs.filter(x => x.colaboradorId === f.colab);
      if (f.classe !== 'todos') fbs = fbs.filter(x => x.classificacao === f.classe);
      const q = u.norm(f.busca).trim();
      if (q) fbs = fbs.filter(x => u.norm([x.oQueAconteceu, x.impacto, x.oQueDeveria, x.comoMelhorar].join(' ')).indexOf(q) >= 0);
      fbs = u.sortBy(fbs, x => x.data, 'desc');

      u.clear(lista);
      if (!fbs.length) {
        lista.className = '';
        lista.appendChild(u.el('div.card', {}, [p.vazio({
          icone: 'chat', titulo: 'Nenhum feedback neste filtro',
          desc: 'O feedback estruturado é o que transforma observação solta em desenvolvimento real.',
          acoes: [{ label: 'Registrar feedback', icone: 'plus', onClick: () => App.fbModal.abrir(f.colab ? { colaboradorId: f.colab } : {}) }]
        })]));
        return;
      }
      lista.className = 'grid grid-wide stagger';
      fbs.forEach(x => lista.appendChild(p.cardFeedback(x, {
        comColaborador: true,
        aoEditar: y => App.fbModal.abrir({ feedback: y }),
        aoRemover: y => App.fbModal.remover(y)
      })));
    }

    pintar();
    u.clear(view);
    view.appendChild(box);
  }

  App.pages = App.pages || {};
  App.pages.feedbacks = { render, titulo: 'Feedbacks', sub: 'Conversas estruturadas' };
})(window.App);
