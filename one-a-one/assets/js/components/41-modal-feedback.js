/* =========================================================================
   components/41-modal-feedback.js — Feedback estruturado por comportamento
   e evidencia (fato -> impacto -> esperado -> acao).
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, cat = App.cat, db = App.db;

  const BLOCOS = [
    { id: 'oQueAconteceu', rot: 'O que aconteceu?', ph: 'Descreva o fato observado, sem julgamento: o que foi dito ou feito, quando e onde.', icone: 'eye', obrig: true },
    { id: 'impacto',       rot: 'Qual foi o impacto?', ph: 'Explique a consequência desse comportamento para o cliente, para o time ou para o resultado.', icone: 'zap', obrig: true },
    { id: 'oQueDeveria',   rot: 'O que deveria acontecer?', ph: 'Defina com clareza o comportamento esperado.', icone: 'target' },
    { id: 'comoMelhorar',  rot: 'Como vamos melhorar?', ph: 'Ação prática, com prazo e apoio definidos.', icone: 'trendUp' }
  ];

  /** abrir({ colaboradorId, feedback, observacao, oneAOneId, aoSalvar }) */
  function abrir(opts) {
    opts = opts || {};
    const edicao = opts.feedback || null;
    const ativos = db.colaboradores.ativos();
    if (!ativos.length) {
      App.toast.aviso('Nenhum colaborador ativo', 'Cadastre a equipe antes de registrar feedbacks.');
      return null;
    }

    const dados = {
      colaboradorId: edicao ? edicao.colaboradorId : (opts.colaboradorId || (opts.observacao && opts.observacao.colaboradorId) || ativos[0].id),
      classificacao: edicao ? edicao.classificacao : 'desenvolvimento',
      data: edicao ? edicao.data : u.nowISO(),
      oQueAconteceu: edicao ? edicao.oQueAconteceu : (opts.observacao ? opts.observacao.texto : ''),
      impacto: edicao ? edicao.impacto : '',
      oQueDeveria: edicao ? edicao.oQueDeveria : '',
      comoMelhorar: edicao ? edicao.comoMelhorar : ''
    };

    const corpo = u.el('div.u-col.u-gap-5');

    const sel = p.selectColaborador(dados.colaboradorId, {
      vazio: false, somenteAtivos: false, onChange: v => { dados.colaboradorId = v; }
    });
    const dt = u.el('input.input', { type: 'datetime-local', value: dados.data });
    dt.addEventListener('change', () => { dados.data = dt.value || u.nowISO(); });

    corpo.appendChild(u.el('div.grid.grid-2', {}, [
      p.campo('Colaborador', sel, { obrigatorio: true }),
      p.campo('Data', dt)
    ]));

    corpo.appendChild(p.campo('Classificação',
      p.escolhas(cat.CLASSIF_FEEDBACK, dados.classificacao, v => { dados.classificacao = v; }),
      { obrigatorio: true, hint: 'Define o tom da conversa: reconhecer, desenvolver, corrigir, orientar ou acompanhar.' }));

    const campos = {};
    BLOCOS.forEach((b, i) => {
      const ta = u.el('textarea.textarea', { placeholder: b.ph, rows: 3 });
      ta.value = dados[b.id] || '';
      if (i === 0) ta.setAttribute('data-autofocus', '');
      ta.addEventListener('input', () => {
        dados[b.id] = ta.value;
        campos[b.id].classList.remove('has-err');
      });
      const c = p.campo((i + 1) + '. ' + b.rot, ta, { obrigatorio: b.obrig, erro: 'Preencha este bloco.' });
      campos[b.id] = c;
      corpo.appendChild(c);
    });

    const up = p.uploadEvidencias(edicao ? edicao.evidencias : (opts.observacao ? (opts.observacao.evidencias || []) : []));
    corpo.appendChild(p.campo('Evidências', up.el, { hint: 'Anexe o que comprova o fato — o feedback fica muito mais fácil de sustentar.' }));

    function salvar() {
      let ok = true;
      BLOCOS.forEach(b => {
        if (b.obrig && !String(dados[b.id] || '').trim()) { campos[b.id].classList.add('has-err'); ok = false; }
      });
      if (!ok) {
        App.toast.aviso('Faltam informações', 'Preencha pelo menos o fato e o impacto.');
        return false;
      }
      const doc = {
        colaboradorId: dados.colaboradorId,
        classificacao: dados.classificacao,
        data: dados.data || u.nowISO(),
        oQueAconteceu: dados.oQueAconteceu.trim(),
        impacto: String(dados.impacto || '').trim(),
        oQueDeveria: String(dados.oQueDeveria || '').trim(),
        comoMelhorar: String(dados.comoMelhorar || '').trim(),
        evidencias: up.lista.slice(),
        oneAOneId: opts.oneAOneId || (edicao && edicao.oneAOneId) || null,
        observacaoId: (opts.observacao && opts.observacao.id) || (edicao && edicao.observacaoId) || null
      };
      const acao = edicao ? db.feedbacks.atualizar(edicao.id, doc) : db.feedbacks.criar(doc);
      return acao.then(salvo => {
        App.toast.ok(edicao ? 'Feedback atualizado' : 'Feedback registrado com sucesso',
          cat.classif(doc.classificacao).label + ' · ' + u.primeiroNome(db.colaboradores.nome(doc.colaboradorId)));
        if (opts.aoSalvar) opts.aoSalvar(salvo);
        return true;
      }).catch(e => { App.toast.erro('Não foi possível salvar', e.message); return false; });
    }

    return App.modal.abrir({
      titulo: edicao ? 'Editar feedback' : 'Novo feedback',
      desc: 'Comportamento observado, impacto gerado, comportamento esperado e ação combinada.',
      icone: 'chat', tamanho: 'lg', corpo,
      acoes: [
        { label: 'Cancelar', tipo: 'ghost' },
        { label: edicao ? 'Salvar alterações' : 'Registrar feedback', tipo: 'primary', icone: 'check', onClick: salvar }
      ]
    });
  }

  function remover(f) {
    return App.modal.confirmar({
      titulo: 'Excluir feedback',
      mensagem: 'O feedback sai do histórico do colaborador. Não dá para desfazer.',
      confirmar: 'Excluir', perigo: true
    }).then(ok => ok ? db.feedbacks.remover(f.id).then(() => { App.toast.ok('Feedback excluído'); return true; }) : false);
  }

  App.fbModal = { abrir, remover };
})(window.App);
