/* =========================================================================
   components/44-busca.js — Busca global (Ctrl+K).
   Pesquisa colaboradores, observacoes, feedbacks, One a Ones, planos,
   evidencias e acoes rapidas do sistema.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, cat = App.cat, db = App.db;

  const ACOES = [
    { id: 'nova_obs', titulo: 'Nova observação', sub: 'Ctrl + N', emoji: '👁', tom: 'brand', run: () => App.obsModal.abrir() },
    { id: 'novo_fb', titulo: 'Novo feedback', sub: 'Registrar feedback estruturado', emoji: '💬', tom: 'info', run: () => App.fbModal.abrir() },
    { id: 'novo_plano', titulo: 'Novo plano de ação', sub: 'Definir ação com prazo e indicador', emoji: '🎯', tom: 'purple', run: () => App.planoModal.abrir() },
    { id: 'novo_colab', titulo: 'Cadastrar colaborador', sub: 'Adicionar alguém à equipe', emoji: '➕', tom: 'ok', run: () => App.colabModal.abrir() },
    { id: 'ir_dash', titulo: 'Ir para o Dashboard', sub: 'Visão geral da equipe', emoji: '🏠', tom: 'neutral', run: () => App.router.go('/dashboard') },
    { id: 'ir_equipe', titulo: 'Ir para Equipe', sub: 'Todos os colaboradores', emoji: '👥', tom: 'neutral', run: () => App.router.go('/equipe') },
    { id: 'ir_1a1', titulo: 'Ir para One a One', sub: 'Encontros e preparação', emoji: '🤝', tom: 'neutral', run: () => App.router.go('/one-a-one') },
    { id: 'ir_ind', titulo: 'Ir para Indicadores', sub: 'Gráficos e evolução', emoji: '📊', tom: 'neutral', run: () => App.router.go('/indicadores') },
    { id: 'tema', titulo: 'Alternar tema claro / escuro', sub: 'Aparência do sistema', emoji: '🌗', tom: 'neutral', run: () => App.tema.alternar() }
  ];

  let aberto = null;

  function abrir(termoInicial) {
    if (aberto) return aberto;

    const input = u.el('input', {
      type: 'text', placeholder: 'Buscar pessoas, observações, feedbacks, planos…',
      'aria-label': 'Busca global', 'data-autofocus': true, autocomplete: 'off'
    });
    const resultados = u.el('div.cmdk__results');

    const corpo = u.el('div.cmdk', {}, [
      u.el('div.cmdk__input', {}, [
        u.el('span', { html: App.icon('search') }),
        input,
        u.el('kbd', { text: 'ESC' })
      ]),
      resultados,
      u.el('div.cmdk__foot', {}, [
        u.el('span', { html: '<kbd>↑</kbd> <kbd>↓</kbd> navegar' }),
        u.el('span', { html: '<kbd>Enter</kbd> abrir' }),
        u.el('span', { html: '<kbd>Ctrl</kbd> + <kbd>N</kbd> nova observação' })
      ])
    ]);

    const m = App.modal.abrir({ tamanho: 'md', corpo, aoFechar: () => { aberto = null; } });
    m.box.style.padding = '0';
    m.body.style.padding = '0';
    m.box.classList.add('card--flat');
    aberto = m;

    let itens = [], cursor = 0;

    function ir(fn) { m.fechar(); setTimeout(fn, 60); }

    function buscar(q) {
      const termo = u.norm(q).trim();
      const grupos = [];

      if (!termo) {
        grupos.push({ titulo: 'Ações rápidas', itens: ACOES.slice(0, 5).map(a => ({
          emoji: a.emoji, tom: a.tom, titulo: a.titulo, sub: a.sub, run: () => ir(a.run)
        })) });
        const recentes = db.observacoes.recentes(4);
        if (recentes.length) {
          grupos.push({ titulo: 'Registros recentes', itens: recentes.map(o => obsItem(o, '')) });
        }
        return grupos;
      }

      const casa = txt => u.norm(txt || '').indexOf(termo) >= 0;

      const colabs = db.colaboradores.todos().filter(c => casa(c.nome) || casa(c.cargo) || casa(c.email));
      if (colabs.length) grupos.push({ titulo: 'Colaboradores', itens: colabs.slice(0, 6).map(c => ({
        avatar: c, titulo: c.nome, sub: c.cargo + (c.status === 'inativo' ? ' · inativo' : ''),
        run: () => ir(() => App.router.go('/colaborador/' + c.id)), termo: q
      })) });

      const obs = db.observacoes.todos().filter(o => casa(o.texto) ||
        casa(cat.tipoObs(o.tipo).label) || casa(db.colaboradores.nome(o.colaboradorId)));
      if (obs.length) grupos.push({
        titulo: 'Observações', itens: u.sortBy(obs, o => o.data, 'desc').slice(0, 6).map(o => obsItem(o, q))
      });

      const fbs = db.feedbacks.todos().filter(f => casa(f.oQueAconteceu) || casa(f.comoMelhorar) ||
        casa(f.impacto) || casa(f.oQueDeveria) || casa(db.colaboradores.nome(f.colaboradorId)));
      if (fbs.length) grupos.push({
        titulo: 'Feedbacks', itens: u.sortBy(fbs, f => f.data, 'desc').slice(0, 5).map(f => ({
          emoji: '💬', tom: cat.classif(f.classificacao).tom,
          titulo: u.trunc(f.oQueAconteceu, 76),
          sub: cat.classif(f.classificacao).label + ' · ' + db.colaboradores.nome(f.colaboradorId) + ' · ' + u.fmtDate(f.data),
          termo: q, run: () => ir(() => App.router.go('/colaborador/' + f.colaboradorId + '/feedbacks'))
        }))
      });

      const encontros = db.oneones.todos().filter(o => {
        const r = o.roteiro || {};
        return casa(db.colaboradores.nome(o.colaboradorId)) || casa(r.fechamento) || casa(r.comoEsta) ||
          casa(r.conquistas) || casa(r.dificuldades) || (r.compromissos || []).some(casa);
      });
      if (encontros.length) grupos.push({
        titulo: 'One a Ones', itens: u.sortBy(encontros, o => o.data, 'desc').slice(0, 5).map(o => ({
          emoji: '🤝', tom: 'brand',
          titulo: 'One a One · ' + db.colaboradores.nome(o.colaboradorId),
          sub: u.fmtDateLong(o.data) + ' · ' + cat.status1a1(o.status).label,
          termo: q, run: () => ir(() => App.router.go('/one-a-one/' + o.id))
        }))
      });

      const pls = db.planos.todos().filter(x => casa(x.ponto) || casa(x.acao) || casa(x.objetivo) ||
        casa(x.indicador) || casa(db.colaboradores.nome(x.colaboradorId)));
      if (pls.length) grupos.push({
        titulo: 'Planos de ação', itens: pls.slice(0, 5).map(x => ({
          emoji: '🎯', tom: cat.statusPlano(db.planos.statusEfetivo(x)).tom,
          titulo: x.ponto || x.acao,
          sub: db.colaboradores.nome(x.colaboradorId) + ' · ' + cat.statusPlano(db.planos.statusEfetivo(x)).label +
            (x.prazo ? ' · prazo ' + u.fmtDate(x.prazo) : ''),
          termo: q, run: () => ir(() => App.planoModal.abrir({ plano: x }))
        }))
      });

      /* evidencias */
      const evid = [];
      db.observacoes.todos().forEach(o => (o.evidencias || []).forEach(e => {
        if (casa(e.nome)) evid.push({ e, o });
      }));
      db.feedbacks.todos().forEach(f => (f.evidencias || []).forEach(e => {
        if (casa(e.nome)) evid.push({ e, o: f, fb: true });
      }));
      if (evid.length) grupos.push({
        titulo: 'Evidências', itens: evid.slice(0, 5).map(x => ({
          emoji: x.e.tipo === 'link' ? '🔗' : '📎', tom: 'neutral',
          titulo: x.e.nome, sub: db.colaboradores.nome(x.o.colaboradorId) + ' · ' + u.fmtDate(x.o.data),
          termo: q,
          run: () => ir(() => App.router.go('/colaborador/' + x.o.colaboradorId + (x.fb ? '/feedbacks' : '/observacoes')))
        }))
      });

      const acoes = ACOES.filter(a => casa(a.titulo) || casa(a.sub));
      if (acoes.length) grupos.push({
        titulo: 'Ações', itens: acoes.slice(0, 5).map(a => ({
          emoji: a.emoji, tom: a.tom, titulo: a.titulo, sub: a.sub, termo: q, run: () => ir(a.run)
        }))
      });

      return grupos;
    }

    function obsItem(o, q) {
      const t = cat.tipoObs(o.tipo);
      return {
        emoji: t.emoji, tom: t.tom,
        titulo: u.trunc(o.texto, 80),
        sub: db.colaboradores.nome(o.colaboradorId) + ' · ' + t.label + ' · ' + u.fmtDate(o.data),
        termo: q,
        run: () => ir(() => App.router.go('/colaborador/' + o.colaboradorId + '/observacoes'))
      };
    }

    function pintar() {
      const grupos = buscar(input.value);
      u.clear(resultados);
      itens = [];
      if (!grupos.length) {
        resultados.appendChild(p.vazio({
          icone: 'search', titulo: 'Nada encontrado',
          desc: 'Nenhum registro combina com "' + input.value.trim() + '". Tente outro termo ou o nome do colaborador.'
        }));
        return;
      }
      grupos.forEach(g => {
        resultados.appendChild(u.el('div.cmdk__group', { text: g.titulo }));
        g.itens.forEach(it => {
          const node = u.el('button.cmdk__item', { type: 'button', onclick: it.run }, [
            it.avatar ? p.avatar(it.avatar, 'sm')
              : u.el('span.cmdk__ic.tone-' + (it.tom === 'neutral' ? 'neutral' : it.tom), { text: it.emoji }),
            u.el('div.u-grow', { style: { minWidth: 0 } }, [
              u.el('div.t-md.t-semi.u-truncate', { html: it.termo ? u.marca(it.titulo, it.termo.trim()) : u.esc(it.titulo) }),
              it.sub ? u.el('div.t-xs.t-muted.u-truncate', { text: it.sub }) : null
            ]),
            u.el('span.t-muted2', { html: App.icon('chevronRight') })
          ]);
          resultados.appendChild(node);
          itens.push(node);
        });
      });
      cursor = 0;
      marcar();
    }

    function marcar() {
      itens.forEach((n, i) => n.classList.toggle('is-cursor', i === cursor));
      if (itens[cursor]) itens[cursor].scrollIntoView({ block: 'nearest' });
    }

    input.addEventListener('input', u.debounce(pintar, 110));
    input.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); cursor = Math.min(itens.length - 1, cursor + 1); marcar(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); cursor = Math.max(0, cursor - 1); marcar(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); if (itens[cursor]) itens[cursor].click(); }
    });

    if (termoInicial) input.value = termoInicial;
    pintar();
    return m;
  }

  App.busca = { abrir };
})(window.App);
