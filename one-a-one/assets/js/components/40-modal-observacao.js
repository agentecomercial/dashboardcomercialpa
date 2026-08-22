/* =========================================================================
   components/40-modal-observacao.js — A acao mais importante do produto.
   Meta de UX: registrar uma observacao em ~20 segundos.
   Atalho global: Ctrl + N
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, cat = App.cat, db = App.db;

  /** abrir({ colaboradorId, observacao }) */
  function abrir(opts) {
    opts = opts || {};
    const edicao = opts.observacao || null;

    const dados = {
      colaboradorId: edicao ? edicao.colaboradorId : (opts.colaboradorId || ''),
      tipo: edicao ? edicao.tipo : 'positivo',
      contexto: edicao ? edicao.contexto : 'rotina',
      impacto: edicao ? edicao.impacto : 'medio',
      texto: edicao ? edicao.texto : '',
      data: edicao ? edicao.data : u.nowISO()
    };

    const ativos = db.colaboradores.ativos();
    if (!ativos.length) {
      App.toast.aviso('Nenhum colaborador ativo', 'Cadastre a equipe antes de registrar observações.');
      App.router.go('/equipe');
      return null;
    }
    if (!dados.colaboradorId) dados.colaboradorId = ativos[0].id;

    const corpo = u.el('div.u-col.u-gap-5');

    /* ---------------- Colaborador (tiras de avatar, 1 clique) ---------------- */
    const tiras = u.el('div.u-row.u-wrap.u-gap-2');
    function pintarTiras() {
      u.clear(tiras);
      ativos.forEach(c => {
        const on = dados.colaboradorId === c.id;
        tiras.appendChild(u.el('button.chip' + (on ? '.is-on' : ''), {
          type: 'button',
          onclick: () => { dados.colaboradorId = c.id; pintarTiras(); },
          html: p.avatarHtml(c, 'xs') + '<span>' + u.esc(u.primeiroNome(c.nome)) + '</span>'
        }));
      });
    }
    pintarTiras();
    corpo.appendChild(p.campo('Colaborador', tiras, { obrigatorio: true }));

    /* ---------------- Tipo ---------------- */
    corpo.appendChild(p.campo('Tipo de observação',
      p.escolhas(cat.TIPOS_OBS, dados.tipo, v => { dados.tipo = v; }), { obrigatorio: true }));

    /* ---------------- Observacao ---------------- */
    const ta = u.el('textarea.textarea', {
      placeholder: 'Descreva o que você observou...',
      rows: 4, 'data-autofocus': true, maxlength: 1200
    });
    ta.value = dados.texto;
    const contador = u.el('div.field__hint.u-right', { text: '0 caracteres' });
    ta.addEventListener('input', () => {
      dados.texto = ta.value;
      contador.textContent = ta.value.length + ' caracteres';
      campoTexto.classList.remove('has-err');
    });
    const campoTexto = p.campo('Observação', ta, { obrigatorio: true, erro: 'Descreva o que você observou.' });
    campoTexto.appendChild(contador);
    corpo.appendChild(campoTexto);
    contador.textContent = ta.value.length + ' caracteres';

    /* ---------------- Contexto + impacto lado a lado ---------------- */
    const linha = u.el('div.grid.grid-2');
    linha.appendChild(p.campo('Contexto',
      p.escolhas(cat.CONTEXTOS, dados.contexto, v => { dados.contexto = v; })));

    const segImpacto = u.el('div.seg');
    cat.IMPACTOS.forEach(i => {
      segImpacto.appendChild(u.el('button.seg__btn' + (dados.impacto === i.id ? '.is-on' : ''), {
        type: 'button', text: i.label,
        onclick: () => {
          dados.impacto = i.id;
          u.$$('.seg__btn', segImpacto).forEach(b => b.classList.toggle('is-on', b.textContent === i.label));
        }
      }));
    });
    const dt = u.el('input.input', { type: 'datetime-local', value: dados.data });
    dt.addEventListener('change', () => { dados.data = dt.value || u.nowISO(); });

    linha.appendChild(u.el('div.u-col.u-gap-4', {}, [
      p.campo('Impacto', segImpacto, { hint: 'O quanto isso afeta o resultado ou o time.' }),
      p.campo('Data e horário', dt, { hint: 'Preenchido automaticamente — ajuste se registrar depois.' })
    ]));
    corpo.appendChild(linha);

    /* ---------------- Evidencias ---------------- */
    const up = p.uploadEvidencias(edicao ? edicao.evidencias : []);
    corpo.appendChild(p.campo('Evidência', up.el, { hint: 'Print, PDF, arquivo ou link. Evidência é o que sustenta o feedback depois.' }));

    /* ---------------- Salvar ---------------- */
    function coletar() {
      dados.texto = ta.value.trim();
      if (!dados.texto) {
        campoTexto.classList.add('has-err');
        ta.focus();
        App.toast.aviso('Falta a observação', 'Descreva o que você observou para registrar.');
        return null;
      }
      return {
        colaboradorId: dados.colaboradorId,
        tipo: dados.tipo, contexto: dados.contexto, impacto: dados.impacto,
        texto: dados.texto, data: dados.data || u.nowISO(),
        evidencias: up.lista.slice()
      };
    }

    function salvar(fecharDepois) {
      const d = coletar();
      if (!d) return false;
      const nome = u.primeiroNome(db.colaboradores.nome(d.colaboradorId));
      const acao = edicao ? db.observacoes.atualizar(edicao.id, d) : db.observacoes.criar(d);
      return acao.then(() => {
        App.toast.ok(edicao ? 'Observação atualizada' : 'Observação registrada com sucesso',
          cat.tipoObs(d.tipo).emoji + ' ' + cat.tipoObs(d.tipo).label + ' · ' + nome);
        if (!fecharDepois) {
          /* modo rajada: limpa o texto e mantem o resto para o proximo registro */
          ta.value = ''; dados.texto = '';
          contador.textContent = '0 caracteres';
          up.limpar();
          ta.focus();
          return false;
        }
        return true;
      }).catch(e => {
        App.toast.erro('Não foi possível salvar', e.message);
        return false;
      });
    }

    const acoes = [{ label: 'Cancelar', tipo: 'ghost' }];
    if (!edicao) acoes.push({ label: 'Salvar e registrar outra', tipo: 'outline', onClick: () => salvar(false) });
    acoes.push({ label: edicao ? 'Salvar alterações' : 'Registrar observação', tipo: 'primary', icone: 'check', onClick: () => salvar(true) });

    const m = App.modal.abrir({
      titulo: edicao ? 'Editar observação' : 'Nova observação',
      desc: edicao ? 'Ajuste o registro sem perder o histórico.' : 'Registre agora — vira evidência no próximo One a One.',
      icone: 'eye', tamanho: 'lg', corpo, acoes
    });

    /* Ctrl+Enter salva */
    m.el.addEventListener('keydown', ev => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
        ev.preventDefault();
        Promise.resolve(salvar(true)).then(ok => { if (ok !== false) m.fechar(); });
      }
    });
    return m;
  }

  function remover(o) {
    return App.modal.confirmar({
      titulo: 'Excluir observação',
      mensagem: 'Esta observação sai do histórico e das evidências do próximo One a One. Não dá para desfazer.',
      confirmar: 'Excluir', perigo: true
    }).then(ok => {
      if (!ok) return false;
      return db.observacoes.remover(o.id).then(() => {
        App.toast.ok('Observação excluída');
        return true;
      });
    });
  }

  App.obsModal = { abrir, remover };
})(window.App);
