/* =========================================================================
   components/42-modal-plano.js — Plano de desenvolvimento (acao acordada).
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, cat = App.cat, db = App.db;

  /** abrir({ colaboradorId, plano, oneAOneId, ponto, aoSalvar }) */
  function abrir(opts) {
    opts = opts || {};
    const edicao = opts.plano || null;
    const ativos = db.colaboradores.ativos();
    if (!ativos.length && !edicao) {
      App.toast.aviso('Nenhum colaborador ativo', 'Cadastre a equipe antes de criar planos.');
      return null;
    }

    const colabPadrao = edicao ? edicao.colaboradorId : (opts.colaboradorId || (ativos[0] && ativos[0].id));
    const dados = {
      colaboradorId: colabPadrao,
      ponto: edicao ? edicao.ponto : (opts.ponto || ''),
      objetivo: edicao ? edicao.objetivo : '',
      acao: edicao ? edicao.acao : '',
      responsavel: edicao ? edicao.responsavel : db.colaboradores.nome(colabPadrao),
      inicio: edicao ? edicao.inicio : u.today(),
      prazo: edicao ? edicao.prazo : u.toISODate(u.addDays(new Date(), 14)),
      indicador: edicao ? edicao.indicador : '',
      status: edicao ? edicao.status : 'nao_iniciado'
    };

    const corpo = u.el('div.u-col.u-gap-4');

    const selColab = p.selectColaborador(dados.colaboradorId, {
      vazio: false, onChange: v => {
        dados.colaboradorId = v;
        if (!edicao) { inpResp.value = db.colaboradores.nome(v); dados.responsavel = inpResp.value; }
      }
    });

    const inpPonto = u.el('input.input', { type: 'text', placeholder: 'Ex.: Cadência de follow-up', 'data-autofocus': true });
    inpPonto.value = dados.ponto;
    const campoPonto = p.campo('Ponto a desenvolver', inpPonto, { obrigatorio: true, erro: 'Diga qual ponto será desenvolvido.' });
    inpPonto.addEventListener('input', () => { dados.ponto = inpPonto.value; campoPonto.classList.remove('has-err'); });

    corpo.appendChild(u.el('div.grid.grid-2', {}, [
      p.campo('Colaborador', selColab, { obrigatorio: true }),
      campoPonto
    ]));

    const taObj = u.el('textarea.textarea', { rows: 2, placeholder: 'O que precisa mudar de fato até o prazo.' });
    taObj.value = dados.objetivo;
    taObj.addEventListener('input', () => { dados.objetivo = taObj.value; });
    corpo.appendChild(p.campo('Objetivo', taObj));

    const taAcao = u.el('textarea.textarea', { rows: 2, placeholder: 'A prática concreta: o que a pessoa vai fazer, com que frequência.' });
    taAcao.value = dados.acao;
    const campoAcao = p.campo('Ação', taAcao, { obrigatorio: true, erro: 'Descreva a ação combinada.' });
    taAcao.addEventListener('input', () => { dados.acao = taAcao.value; campoAcao.classList.remove('has-err'); });
    corpo.appendChild(campoAcao);

    const inpResp = u.el('input.input', { type: 'text', placeholder: 'Quem executa' });
    inpResp.value = dados.responsavel || '';
    inpResp.addEventListener('input', () => { dados.responsavel = inpResp.value; });

    const inpIni = u.el('input.input', { type: 'date', value: dados.inicio });
    inpIni.addEventListener('change', () => { dados.inicio = inpIni.value; });
    const inpPrazo = u.el('input.input', { type: 'date', value: dados.prazo });
    inpPrazo.addEventListener('change', () => { dados.prazo = inpPrazo.value; });

    corpo.appendChild(u.el('div.grid.grid-3', {}, [
      p.campo('Responsável', inpResp),
      p.campo('Data de início', inpIni),
      p.campo('Prazo', inpPrazo, { hint: 'Vence e não concluiu? Vira atrasado automaticamente.' })
    ]));

    const inpInd = u.el('input.input', { type: 'text', placeholder: 'Ex.: zero oportunidades sem toque há mais de 7 dias' });
    inpInd.value = dados.indicador;
    inpInd.addEventListener('input', () => { dados.indicador = inpInd.value; });

    const selStatus = u.el('select.select');
    cat.STATUS_PLANO.forEach(s => selStatus.appendChild(u.el('option', { value: s.id, text: s.emoji + '  ' + s.label })));
    selStatus.value = dados.status;
    selStatus.addEventListener('change', () => { dados.status = selStatus.value; });

    corpo.appendChild(u.el('div.grid.grid-2', {}, [
      p.campo('Indicador de sucesso', inpInd, { hint: 'Como saberemos que funcionou.' }),
      p.campo('Status', selStatus)
    ]));

    function salvar() {
      let ok = true;
      if (!inpPonto.value.trim()) { campoPonto.classList.add('has-err'); ok = false; }
      if (!taAcao.value.trim()) { campoAcao.classList.add('has-err'); ok = false; }
      if (!ok) { App.toast.aviso('Faltam informações', 'Ponto a desenvolver e ação são obrigatórios.'); return false; }
      if (dados.prazo && dados.inicio && u.parseDate(dados.prazo) < u.parseDate(dados.inicio)) {
        App.toast.aviso('Datas invertidas', 'O prazo não pode ser anterior à data de início.');
        return false;
      }

      const doc = {
        colaboradorId: dados.colaboradorId,
        ponto: inpPonto.value.trim(), objetivo: taObj.value.trim(), acao: taAcao.value.trim(),
        responsavel: inpResp.value.trim(), inicio: dados.inicio, prazo: dados.prazo,
        indicador: inpInd.value.trim(), status: dados.status,
        oneAOneId: opts.oneAOneId || (edicao && edicao.oneAOneId) || null,
        concluidoEm: dados.status === 'concluido' ? ((edicao && edicao.concluidoEm) || u.today()) : null
      };
      const acao = edicao ? db.planos.atualizar(edicao.id, doc) : db.planos.criar(doc);
      return acao.then(salvo => {
        App.toast.ok(edicao ? 'Plano atualizado' : 'Plano de ação criado',
          doc.ponto + ' · ' + u.primeiroNome(db.colaboradores.nome(doc.colaboradorId)));
        if (opts.aoSalvar) opts.aoSalvar(salvo);
        return true;
      }).catch(e => { App.toast.erro('Não foi possível salvar', e.message); return false; });
    }

    const acoes = [{ label: 'Cancelar', tipo: 'ghost' }];
    if (edicao && edicao.status !== 'concluido') {
      acoes.push({
        label: 'Marcar como concluído', tipo: 'ok', icone: 'check',
        onClick: () => db.planos.atualizar(edicao.id, { status: 'concluido', concluidoEm: u.today() })
          .then(() => { App.toast.ok('Plano concluído', 'Boa! Isso entra como evolução na timeline.'); if (opts.aoSalvar) opts.aoSalvar(); return true; })
      });
    }
    acoes.push({ label: edicao ? 'Salvar alterações' : 'Criar plano', tipo: 'primary', icone: 'check', onClick: salvar });

    return App.modal.abrir({
      titulo: edicao ? 'Editar plano de ação' : 'Novo plano de ação',
      desc: 'O que foi combinado precisa ter dono, prazo e indicador — senão não é acompanhamento, é conversa.',
      icone: 'flag', tamanho: 'lg', corpo, acoes
    });
  }

  function remover(pl) {
    return App.modal.confirmar({
      titulo: 'Excluir plano de ação',
      mensagem: 'O plano sai do acompanhamento do colaborador. Não dá para desfazer.',
      confirmar: 'Excluir', perigo: true
    }).then(ok => ok ? db.planos.remover(pl.id).then(() => { App.toast.ok('Plano excluído'); return true; }) : false);
  }

  /** Menu rapido de status usado nos cards. */
  function menuStatus(alvo, pl, aoTrocar) {
    App.menu(alvo, [{ titulo: 'Mudar status' }].concat(cat.STATUS_PLANO.map(s => ({
      label: s.emoji + '  ' + s.label,
      onClick: () => db.planos.atualizar(pl.id, {
        status: s.id,
        concluidoEm: s.id === 'concluido' ? (pl.concluidoEm || u.today()) : null
      }).then(() => { App.toast.ok('Status atualizado', s.label); aoTrocar && aoTrocar(); })
    }))));
  }

  App.planoModal = { abrir, remover, menuStatus };
})(window.App);
