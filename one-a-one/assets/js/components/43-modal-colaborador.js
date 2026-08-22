/* =========================================================================
   components/43-modal-colaborador.js — Cadastro / edicao de colaborador.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, cat = App.cat, db = App.db;

  function abrir(opts) {
    opts = opts || {};
    const edicao = opts.colaborador || null;

    const d = {
      nome: edicao ? edicao.nome : '',
      foto: edicao ? (edicao.foto || '') : '',
      cor: edicao ? (edicao.cor || u.PALETA[0]) : u.PALETA[Math.floor(Math.random() * u.PALETA.length)],
      cargo: edicao ? edicao.cargo : cat.CARGOS[0],
      dataEntrada: edicao ? edicao.dataEntrada : u.today(),
      meta: edicao ? edicao.meta : 0,
      telefone: edicao ? edicao.telefone : '',
      email: edicao ? edicao.email : '',
      status: edicao ? edicao.status : 'ativo',
      proximoOneAOne: edicao ? (edicao.proximoOneAOne || '') : App.cal.agendar(new Date(), 7),
      frequenciaDias: edicao ? (+edicao.frequenciaDias || 14) : 14,
      indicadores: Object.assign({ realizado: 0, vendas: 0, leads: 0, followups: 0, conversao: 0 },
        (edicao && edicao.indicadores) || {})
    };

    const corpo = u.el('div.u-col.u-gap-5');

    /* ---------------- Identidade ---------------- */
    const preview = u.el('span.avatar.avatar--xl', { style: { background: d.cor } });
    function pintarAvatar() {
      preview.innerHTML = d.foto
        ? '<img src="' + u.esc(d.foto) + '" alt="">'
        : u.esc(u.iniciais(d.nome || '?'));
      preview.style.background = d.cor;
    }

    const inputFoto = u.el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    inputFoto.addEventListener('change', () => {
      const f = inputFoto.files && inputFoto.files[0];
      if (!f) return;
      if (f.size > 1.6 * 1024 * 1024) { App.toast.aviso('Imagem grande demais', 'Use uma foto de até 1,5 MB.'); return; }
      u.fileToDataURL(f).then(dataUrl => { d.foto = dataUrl; pintarAvatar(); });
      inputFoto.value = '';
    });

    const cores = u.el('div.u-row.u-wrap.u-gap-2');
    u.PALETA.forEach(c => {
      cores.appendChild(u.el('button', {
        type: 'button', 'aria-label': 'Cor ' + c,
        style: {
          width: '24px', height: '24px', borderRadius: '50%', background: c,
          border: d.cor === c ? '2px solid var(--text)' : '2px solid transparent',
          outline: '1px solid var(--border)'
        },
        onclick: ev => {
          d.cor = c; pintarAvatar();
          u.$$('button', cores).forEach(b => { b.style.border = '2px solid transparent'; });
          ev.currentTarget.style.border = '2px solid var(--text)';
        }
      }));
    });

    const blocoAvatar = u.el('div.u-row.u-gap-4', { style: { alignItems: 'center' } }, [
      preview,
      u.el('div.u-col.u-gap-2.u-grow', {}, [
        u.el('div.u-row.u-gap-2', {}, [
          u.el('button.btn.btn--sm.btn--outline', { type: 'button', html: App.icon('upload') + '<span>Enviar foto</span>', onclick: () => inputFoto.click() }),
          d.foto || edicao ? u.el('button.btn.btn--sm.btn--ghost', {
            type: 'button', text: 'Remover foto', onclick: () => { d.foto = ''; pintarAvatar(); }
          }) : null,
          inputFoto
        ]),
        u.el('div.field__hint', { text: 'Sem foto, usamos as iniciais na cor escolhida.' }),
        cores
      ])
    ]);
    corpo.appendChild(blocoAvatar);

    /* ---------------- Campos ---------------- */
    const inpNome = u.el('input.input', { type: 'text', placeholder: 'Nome completo', 'data-autofocus': true });
    inpNome.value = d.nome;
    const campoNome = p.campo('Nome', inpNome, { obrigatorio: true, erro: 'Informe o nome do colaborador.' });
    inpNome.addEventListener('input', () => { d.nome = inpNome.value; campoNome.classList.remove('has-err'); pintarAvatar(); });

    const selCargo = u.el('select.select');
    const cargos = cat.CARGOS.slice();
    if (d.cargo && cargos.indexOf(d.cargo) < 0) cargos.push(d.cargo);
    cargos.forEach(c => selCargo.appendChild(u.el('option', { value: c, text: c })));
    selCargo.value = d.cargo;
    selCargo.addEventListener('change', () => { d.cargo = selCargo.value; });

    corpo.appendChild(u.el('div.grid.grid-2', {}, [campoNome, p.campo('Cargo', selCargo)]));

    const inpEntrada = u.el('input.input', { type: 'date', value: d.dataEntrada });
    inpEntrada.addEventListener('change', () => { d.dataEntrada = inpEntrada.value; });

    const inpMeta = u.el('input.input', { type: 'number', min: '0', step: '1000', placeholder: '0' });
    inpMeta.value = d.meta || '';
    inpMeta.addEventListener('input', () => { d.meta = +inpMeta.value || 0; });

    const selStatus = u.el('select.select');
    [['ativo', 'Ativo'], ['inativo', 'Inativo']].forEach(s =>
      selStatus.appendChild(u.el('option', { value: s[0], text: s[1] })));
    selStatus.value = d.status;
    selStatus.addEventListener('change', () => { d.status = selStatus.value; });

    corpo.appendChild(u.el('div.grid.grid-3', {}, [
      p.campo('Data de entrada', inpEntrada),
      p.campo('Meta do período (R$)', inpMeta),
      p.campo('Status', selStatus)
    ]));

    const inpTel = u.el('input.input', { type: 'tel', placeholder: '(00) 00000-0000' });
    inpTel.value = d.telefone || '';
    inpTel.addEventListener('input', () => { d.telefone = inpTel.value; });
    const inpMail = u.el('input.input', { type: 'email', placeholder: 'nome@empresa.com.br' });
    inpMail.value = d.email || '';
    inpMail.addEventListener('input', () => { d.email = inpMail.value; });

    corpo.appendChild(u.el('div.grid.grid-2', {}, [
      p.campo('Telefone', inpTel), p.campo('E-mail', inpMail)
    ]));

    const campoProx = p.campoDataUtil(d.proximoOneAOne || '', {
      onChange: v => { d.proximoOneAOne = v; }
    });
    const selFreq = u.el('select.select');
    cat.FREQUENCIAS.forEach(f => selFreq.appendChild(u.el('option', { value: f.id, text: f.label + ' (' + f.id + ' dias)' })));
    selFreq.value = String(d.frequenciaDias);
    selFreq.addEventListener('change', () => {
      d.frequenciaDias = +selFreq.value;
      if (!campoProx.valor()) {
        const nova = App.cal.agendar(new Date(), d.frequenciaDias);
        campoProx.input.value = nova;
        d.proximoOneAOne = nova;
        campoProx.repintar();
      }
    });

    corpo.appendChild(u.el('div.grid.grid-2', {}, [
      p.campo('Data do próximo One a One', campoProx.el, {
        hint: 'Recalculada ao concluir um encontro, sempre em dia útil.'
      }),
      p.campo('Frequência do One a One', selFreq)
    ]));

    /* ---------------- Indicadores ---------------- */
    const indCampos = [
      ['realizado', 'Realizado (R$)', 'number'],
      ['vendas', 'Vendas', 'number'],
      ['leads', 'Leads', 'number'],
      ['followups', 'Follow-ups', 'number'],
      ['conversao', 'Conversão (%)', 'number']
    ];
    const gridInd = u.el('div.grid', { style: { gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' } });
    indCampos.forEach(([k, rot]) => {
      const i = u.el('input.input', { type: 'number', min: '0', step: k === 'conversao' ? '0.1' : '1' });
      i.value = d.indicadores[k] || '';
      i.addEventListener('input', () => { d.indicadores[k] = +i.value || 0; });
      gridInd.appendChild(p.campo(rot, i));
    });
    corpo.appendChild(u.el('div', {}, [
      u.el('div.t-up.u-mb-2', { text: 'Indicadores do período' }),
      gridInd,
      u.el('div.field__hint.u-mt-2', { text: 'Alimentam os cards de performance e os gráficos de evolução do perfil.' })
    ]));

    function salvar() {
      if (!inpNome.value.trim()) {
        campoNome.classList.add('has-err'); inpNome.focus();
        App.toast.aviso('Falta o nome', 'Informe o nome do colaborador.');
        return false;
      }
      const doc = {
        nome: inpNome.value.trim(), foto: d.foto, cor: d.cor, cargo: d.cargo,
        dataEntrada: d.dataEntrada, meta: +d.meta || 0,
        telefone: d.telefone, email: d.email, status: d.status,
        proximoOneAOne: campoProx.valor() || '', frequenciaDias: +d.frequenciaDias || 14,
        indicadores: d.indicadores,
        historico: (edicao && edicao.historico) || [],
        ultimoOneAOne: (edicao && edicao.ultimoOneAOne) || ''
      };
      const acao = edicao ? db.colaboradores.atualizar(edicao.id, doc) : db.colaboradores.criar(doc);
      return acao.then(salvo => {
        App.toast.ok(edicao ? 'Cadastro atualizado' : 'Colaborador cadastrado', doc.nome);
        if (opts.aoSalvar) opts.aoSalvar(salvo);
        else if (!edicao) App.router.go('/colaborador/' + salvo.id);
        return true;
      }).catch(e => { App.toast.erro('Não foi possível salvar', e.message); return false; });
    }

    pintarAvatar();

    return App.modal.abrir({
      titulo: edicao ? 'Editar colaborador' : 'Novo colaborador',
      desc: edicao ? edicao.nome : 'Cadastre quem faz parte da equipe comercial.',
      icone: 'userPlus', tamanho: 'lg', corpo,
      acoes: [
        { label: 'Cancelar', tipo: 'ghost' },
        { label: edicao ? 'Salvar alterações' : 'Cadastrar', tipo: 'primary', icone: 'check', onClick: salvar }
      ]
    });
  }

  function remover(c) {
    const obs = db.observacoes.contar(o => o.colaboradorId === c.id);
    const enc = db.oneones.contar(o => o.colaboradorId === c.id);
    return App.modal.confirmar({
      titulo: 'Excluir ' + u.primeiroNome(c.nome) + '?',
      mensagem: 'Isso apaga também ' + u.plural(obs, 'observação', 'observações') + ', ' +
        u.plural(enc, 'One a One') + ', feedbacks e planos de ação dessa pessoa. ' +
        'Se ela apenas saiu da equipe, prefira marcar como Inativo.',
      confirmar: 'Excluir tudo', perigo: true
    }).then(ok => {
      if (!ok) return false;
      const alvos = [];
      db.observacoes.onde(o => o.colaboradorId === c.id).forEach(o => alvos.push(db.observacoes.remover(o.id)));
      db.feedbacks.onde(f => f.colaboradorId === c.id).forEach(f => alvos.push(db.feedbacks.remover(f.id)));
      db.oneones.onde(o => o.colaboradorId === c.id).forEach(o => alvos.push(db.oneones.remover(o.id)));
      db.planos.onde(pl => pl.colaboradorId === c.id).forEach(pl => alvos.push(db.planos.remover(pl.id)));
      db.autoavaliacoes.onde(a => a.colaboradorId === c.id).forEach(a => alvos.push(db.autoavaliacoes.remover(a.id)));
      return Promise.all(alvos)
        .then(() => db.colaboradores.remover(c.id))
        .then(() => { App.toast.ok('Colaborador excluído', c.nome); return true; });
    });
  }

  /** Reagendar rapidamente o proximo 1:1 (sempre sugerindo dia util). */
  function reagendar(c) {
    const freq = +c.frequenciaDias || 14;
    const campo = p.campoDataUtil(c.proximoOneAOne || App.cal.agendar(new Date(), freq));

    const atalhos = u.el('div.u-row.u-wrap.u-gap-2.u-mt-3');
    [['Amanhã', 1], ['Em 3 dias', 3], ['Em 1 semana', 7],
     ['Frequência (' + freq + 'd)', freq], ['Em 30 dias', 30]].forEach(([lb, n]) => {
      const destino = App.cal.agendar(new Date(), n);
      atalhos.appendChild(u.el('button.chip', {
        type: 'button', text: lb,
        'data-tip': u.fmtDiaCurto(destino),
        onclick: () => { campo.input.value = destino; campo.repintar(); }
      }));
    });

    App.modal.abrir({
      titulo: 'Agendar One a One', desc: c.nome, icone: 'calendar', tamanho: 'sm',
      corpo: u.el('div', {}, [
        p.campo('Data do próximo encontro', campo.el, {
          hint: 'Os atalhos já pulam fins de semana e feriados.'
        }),
        atalhos
      ]),
      acoes: [
        { label: 'Cancelar', tipo: 'ghost' },
        {
          label: 'Salvar', tipo: 'primary',
          onClick: () => {
            const v = campo.valor();
            if (!v) { App.toast.aviso('Escolha uma data'); return false; }
            return db.colaboradores.atualizar(c.id, { proximoOneAOne: v })
              .then(() => {
                const motivo = App.cal.motivo(v);
                App.toast.ok('One a One agendado',
                  u.fmtDateLong(v) + (motivo ? ' · ' + motivo + ' (mantido por sua escolha)' : ''));
                return true;
              });
          }
        }
      ]
    });
  }

  App.colabModal = { abrir, remover, reagendar };
})(window.App);
