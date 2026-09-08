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
      data: edicao ? edicao.data : u.nowISO(),
      lote: false,                      // mesma observacao para varios consultores
      loteIds: []                       // quem esta dentro do lote (da para tirar)
    };
    let modal = null;                   // preenchido depois de App.modal.abrir

    const ativos = db.colaboradores.ativos();
    if (!ativos.length) {
      App.toast.aviso('Nenhum colaborador ativo', 'Cadastre a equipe antes de registrar observações.');
      App.router.go('/equipe');
      return null;
    }
    if (!dados.colaboradorId) dados.colaboradorId = ativos[0].id;

    const corpo = u.el('div.u-col.u-gap-5');

    /* ---------------- Colaborador (tiras de avatar, 1 clique) ----------------
       O chip "Todos" liga o modo lote: a MESMA observacao e gravada uma vez
       para cada consultor ativo, cada uma com seu proprio registro (da para
       editar e excluir uma sem mexer nas outras). Tipo, contexto, impacto e
       polaridade sao os mesmos do formulario — nada muda de regra no lote. */
    const podeLote = !edicao && ativos.length > 1;
    const tiras = u.el('div.u-row.u-wrap.u-gap-2');
    const hintLote = u.el('div.field__hint.u-mt-2');

    /** Quantos entram no lote agora. */
    function noLote() { return dados.loteIds.length; }

    function alternarLote() {
      dados.lote = !dados.lote;
      /* Ao ligar, entra todo mundo; a partir dai o coordenador vai tirando. */
      if (dados.lote) dados.loteIds = ativos.map(c => c.id);
      pintarTiras();
    }

    /** No lote o clique inclui/exclui. Fora dele, troca o selecionado. */
    function clicarConsultor(c) {
      if (!dados.lote) {
        dados.colaboradorId = c.id;
        pintarTiras();
        return;
      }
      const i = dados.loteIds.indexOf(c.id);
      if (i >= 0) {
        if (dados.loteIds.length === 1) {
          App.toast.aviso('Precisa sobrar alguém',
            'Desligue o lote se quiser registrar para um consultor só.');
          return;
        }
        dados.loteIds.splice(i, 1);
      } else {
        dados.loteIds.push(c.id);
      }
      pintarTiras();
    }

    function pintarTiras() {
      u.clear(tiras);
      if (podeLote) {
        const todosDentro = noLote() === ativos.length;
        tiras.appendChild(u.el('button.chip.chip--lote' + (dados.lote ? '.is-on' : ''), {
          type: 'button',
          'data-tip': dados.lote
            ? 'Desliga o lote e volta ao registro individual'
            : 'Registra esta observação para cada consultor ativo',
          onclick: alternarLote,
          html: App.icon('users', '', 14) + '<span>' +
            (dados.lote && !todosDentro
              ? noLote() + ' de ' + ativos.length
              : 'Todos (' + ativos.length + ')') + '</span>'
        }));
        tiras.appendChild(u.el('span.chip-sep'));
      }

      ativos.forEach(c => {
        const dentro = dados.lote
          ? dados.loteIds.indexOf(c.id) >= 0
          : dados.colaboradorId === c.id;
        tiras.appendChild(u.el(
          'button.chip' + (dentro ? '.is-on' : '') +
          (dados.lote ? (dentro ? '.is-lote' : '.is-fora') : ''), {
            type: 'button',
            'data-tip': dados.lote
              ? (dentro ? 'Clique para tirar do lote' : 'Clique para incluir no lote')
              : null,
            onclick: () => clicarConsultor(c),
            html: p.avatarHtml(c, 'xs') + '<span>' + u.esc(u.primeiroNome(c.nome)) + '</span>'
          }));
      });

      const fora = ativos.length - noLote();
      hintLote.textContent = !dados.lote ? ''
        : 'Em lote: ' + u.plural(noLote(), 'registro') + ', um para cada consultor marcado.' +
          (fora ? ' ' + u.plural(fora, 'consultor fora', 'consultores fora') + ' do lote.'
                : ' Clique num nome para tirar do lote.');
      atualizarBotaoSalvar();
    }

    /* O rotulo do botao primario acompanha o modo, para nao haver surpresa. */
    function atualizarBotaoSalvar() {
      if (!modal || edicao) return;          // editando, o rotulo e "Salvar alterações"
      const b = modal.box.querySelector('#btnSalvarObs');
      if (!b) return;
      const label = dados.lote
        ? 'Registrar para ' + u.plural(noLote(), 'consultor', 'consultores')
        : 'Registrar observação';
      const ultimo = b.childNodes[b.childNodes.length - 1];
      if (ultimo && ultimo.nodeType === 3) ultimo.nodeValue = label;
      else b.textContent = label;
    }

    pintarTiras();
    const campoColab = p.campo('Colaborador', tiras, { obrigatorio: true });
    campoColab.appendChild(hintLote);
    corpo.appendChild(campoColab);

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

    /** Limpa o texto e mantem o resto — usado pelo "Salvar e registrar outra". */
    function prepararProxima() {
      ta.value = ''; dados.texto = '';
      contador.textContent = '0 caracteres';
      up.limpar();
      ta.focus();
    }

    function salvar(fecharDepois) {
      const d = coletar();
      if (!d) return false;
      const t = cat.tipoObs(d.tipo);

      if (edicao) {
        return db.observacoes.atualizar(edicao.id, d).then(() => {
          App.toast.ok('Observação atualizada',
            t.emoji + ' ' + t.label + ' · ' + u.primeiroNome(db.colaboradores.nome(d.colaboradorId)));
          return true;
        }).catch(e => {
          App.toast.erro('Não foi possível salvar', e.message);
          return false;
        });
      }

      /* Um registro por consultor. Sequencial de proposito: erro em um nao
         derruba os outros, e o relato final diz exatamente quem ficou de fora. */
      const alvos = dados.lote ? dados.loteIds.slice() : [d.colaboradorId];
      if (!alvos.length) {
        App.toast.aviso('Nenhum consultor no lote', 'Marque pelo menos um antes de registrar.');
        return false;
      }
      const loteId = alvos.length > 1 ? u.uid('lote') : null;

      return alvos.reduce((prom, cid) => prom.then(res => {
        const doc = Object.assign({}, d, { colaboradorId: cid });
        if (loteId) doc.loteId = loteId;
        return db.observacoes.criar(doc)
          .then(() => { res.ok++; return res; })
          .catch(() => { res.falhas.push(u.primeiroNome(db.colaboradores.nome(cid))); return res; });
      }), Promise.resolve({ ok: 0, falhas: [] })).then(res => {
        const assinatura = t.emoji + ' ' + t.label;

        if (!res.ok) {
          App.toast.erro('Não foi possível registrar', 'Nenhum registro foi gravado. Tente de novo.');
          return false;
        }
        if (res.falhas.length) {
          App.toast.aviso('Registrado parcialmente',
            assinatura + ' · ' + res.ok + ' de ' + alvos.length +
            ' · ficou de fora: ' + res.falhas.join(', '));
        } else if (loteId) {
          App.toast.ok('Observação registrada para ' + res.ok + ' consultores',
            assinatura + ' · cada um com o próprio registro');
        } else {
          App.toast.ok('Observação registrada com sucesso',
            assinatura + ' · ' + u.primeiroNome(db.colaboradores.nome(d.colaboradorId)));
        }

        if (!fecharDepois) { prepararProxima(); return false; }
        return true;
      });
    }

    const acoes = [{ label: 'Cancelar', tipo: 'ghost' }];
    if (!edicao) acoes.push({ label: 'Salvar e registrar outra', tipo: 'outline', onClick: () => salvar(false) });
    acoes.push({
      id: 'btnSalvarObs',
      label: edicao ? 'Salvar alterações' : 'Registrar observação',
      tipo: 'primary', icone: 'check', onClick: () => salvar(true)
    });

    const m = App.modal.abrir({
      titulo: edicao ? 'Editar observação' : 'Nova observação',
      desc: edicao ? 'Ajuste o registro sem perder o histórico.' : 'Registre agora — vira evidência no próximo One a One.',
      icone: 'eye', tamanho: 'lg', corpo, acoes
    });
    modal = m;
    atualizarBotaoSalvar();

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
