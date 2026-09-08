/* =========================================================================
   pages/55-sessao.js — Conducao do One a One (roteiro em 10 etapas).
   Salva sozinho a cada alteracao; ao concluir, transforma compromissos
   em planos de acao e reagenda o proximo encontro.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, p = App.p, g = App.g, db = App.db, A = App.analise, cat = App.cat;

  let etapaAtual = 'preparo';
  let inicioSessao = null;

  function render(view, params) {
    const enc = db.oneones.por(params.id);
    if (!enc) {
      u.clear(view);
      view.appendChild(u.el('div.view__inner', {}, [u.el('div.card', {}, [p.vazio({
        icone: 'handshake', titulo: 'Encontro não encontrado',
        desc: 'Esse One a One pode ter sido excluído.',
        acoes: [{ label: 'Voltar para One a One', onClick: () => App.router.go('/one-a-one') }]
      })])]));
      return;
    }
    if (enc.exemplo) db.setEscopo('exemplos');
    const c = db.colaboradores.por(enc.colaboradorId);
    if (enc.status === 'concluido' || enc.status === 'cancelado') return leitura(view, enc, c);
    return conduzir(view, enc, c);
  }

  /* ====================================================================== */
  /*  MODO CONDUCAO                                                         */
  /* ====================================================================== */
  function conduzir(view, enc, c) {
    if (!inicioSessao || inicioSessao.id !== enc.id) inicioSessao = { id: enc.id, t: Date.now() };

    const dados = u.clone(enc);
    dados.roteiro = Object.assign({
      comoEsta: '', conquistas: '', dificuldades: '',
      autoavaliacao: { fezBem: '', poderiaMelhor: '', dificuldade: '', apoio: '' },
      /* Perguntas alem das quatro fixas: as que voce registrou no periodo e
         as escritas na hora. [{ id, pergunta, resposta, obsId }] */
      perguntasExtras: [],
      positivos: [], desenvolver: [], compromissos: [], fechamento: '', registro: ''
    }, dados.roteiro || {});
    dados.competencias = dados.competencias || {};
    dados.observacoesDiscutidas = dados.observacoesDiscutidas || [];
    dados.feedbacksDiscutidos = dados.feedbacksDiscutidos || [];
    /* Ordem em que o coordenador quer CONTAR as evidencias. Guarda os ids de
       todas as observacoes do periodo, marcadas ou nao — e ela que define a
       sequencia na tela, no array de discutidas e na pauta impressa. */
    dados.ordemObs = dados.ordemObs || [];
    /* 'data' | 'pontos' | 'manual' — so muda qual botao aparece aceso; a
       sequencia real mora sempre em ordemObs. */
    dados.ordemModo = dados.ordemModo || 'data';

    const box = u.el('div.view__inner');
    const salvoEl = u.el('span.t-xs.t-muted2', { text: 'Salvo automaticamente' });

    const salvar = u.debounce(() => {
      db.oneones.atualizar(enc.id, {
        roteiro: dados.roteiro,
        competencias: dados.competencias,
        observacoesDiscutidas: dados.observacoesDiscutidas,
        feedbacksDiscutidos: dados.feedbacksDiscutidos,
        ordemObs: dados.ordemObs,
        ordemModo: dados.ordemModo
      }).then(() => {
        salvoEl.textContent = 'Salvo às ' + u.fmtTime(new Date());
      }).catch(() => { salvoEl.textContent = 'Erro ao salvar'; });
    }, 500);

    /* ---------------------------- cabecalho ---------------------------- */
    box.appendChild(u.el('div.card.card--glass.card--pad.u-mb-4', {}, [
      u.el('div.u-row.u-wrap.u-gap-4', { style: { alignItems: 'center' } }, [
        c ? p.avatar(c, 'lg') : null,
        u.el('div.u-grow', { style: { minWidth: '180px' } }, [
          u.el('div.u-row.u-gap-2', {}, [
            u.el('span.badge.badge--warn.badge--dot', { text: 'Encontro em andamento' }),
            salvoEl
          ]),
          u.el('div.page-head__title', { text: c ? c.nome : 'Colaborador removido' }),
          u.el('div.t-sm.t-muted', { text: u.fmtDateLong(enc.data) + ' · período desde ' + u.fmtDate(enc.periodoInicio) })
        ]),
        u.el('div.u-row.u-gap-2.u-wrap', {}, [
          u.el('button.btn.btn--outline', {
            type: 'button', html: App.icon('x') + '<span>Descartar</span>',
            onclick: () => descartar(enc, c)
          }),
          u.el('button.btn.btn--lg.btn--ok', {
            type: 'button', html: App.icon('check') + '<span>Concluir One a One</span>',
            onclick: () => concluir(enc, dados, c)
          })
        ])
      ])
    ]));

    /* ---------------------------- layout ---------------------------- */
    const stage = u.el('div.oo-stage');
    const navCard = u.el('div.card.oo-steps', {}, [
      u.el('div.card__head', {}, [u.el('div.card__title', { text: 'Roteiro' })])
    ]);
    const navBody = u.el('div.card__body', { style: { padding: '10px' } });
    navCard.appendChild(navBody);

    const painel = u.el('div');

    function preenchida(id) {
      const r = dados.roteiro;
      switch (id) {
        case 'preparo': return true;
        case 'como_esta': return !!r.comoEsta.trim();
        case 'conquistas': return !!r.conquistas.trim();
        case 'dificuldades': return !!r.dificuldades.trim();
        case 'autoavaliacao': return Object.keys(r.autoavaliacao).some(k => String(r.autoavaliacao[k] || '').trim());
        case 'feedback': return dados.observacoesDiscutidas.length > 0 || dados.feedbacksDiscutidos.length > 0;
        case 'competencias': return Object.keys(dados.competencias).some(k => dados.competencias[k] && dados.competencias[k].nota);
        case 'positivos': return r.positivos.length > 0;
        case 'desenvolver': return r.desenvolver.length > 0;
        case 'compromissos': return r.compromissos.length > 0;
        case 'fechamento': return !!r.fechamento.trim();
      }
      return false;
    }

    function pintarNav() {
      u.clear(navBody);
      cat.ETAPAS_1A1.forEach(e => {
        const on = etapaAtual === e.id;
        const done = preenchida(e.id) && !on;
        navBody.appendChild(u.el('button.oo-step' + (on ? '.is-on' : '') + (done ? '.is-done' : ''), {
          type: 'button',
          onclick: () => { etapaAtual = e.id; pintarNav(); pintarPainel(); painel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        }, [
          u.el('span.oo-step__n', { html: done ? App.icon('check', '', 11) : String(e.n) }),
          u.el('span.u-grow', { text: e.titulo })
        ]));
      });
    }

    function pintarPainel() {
      aoMarcarEvidencia = null;
      /* O guia da etapa e montado depois do cabecalho, ver `guiaDaEtapa`. */
      u.clear(painel);
      const meta = cat.ETAPAS_1A1.find(x => x.id === etapaAtual);
      const idx = cat.ETAPAS_1A1.findIndex(x => x.id === etapaAtual);

      const card = u.el('div.card.oo-section', {}, [
        u.el('div.card__head', {}, [
          u.el('div', {}, [
            u.el('div.oo-q', { text: (typeof meta.n === 'number' ? meta.n + '. ' : '') + meta.titulo }),
            u.el('div.oo-hint', { text: meta.hint })
          ])
        ])
      ]);
      const body = u.el('div.card__body');
      card.appendChild(body);

      /* Guia da etapa: o que fazer, o que dizer e o que evitar NESTA etapa,
         montado dos registros reais do consultor. Vem antes do formulario
         porque e leitura de apoio, nao campo a preencher. */
      const guia = App.guia.guiaEtapa(c, etapaAtual, enc.periodoInicio);
      if (guia) body.appendChild(guia);

      montar[etapaAtual](body);

      /* navegacao entre etapas */
      const foot = u.el('div.card__foot.u-between', {}, [
        idx > 0 ? u.el('button.btn.btn--sm.btn--ghost', {
          type: 'button', html: App.icon('chevronLeft') + '<span>Anterior</span>',
          onclick: () => { etapaAtual = cat.ETAPAS_1A1[idx - 1].id; pintarNav(); pintarPainel(); }
        }) : u.el('span'),
        idx < cat.ETAPAS_1A1.length - 1
          ? u.el('button.btn.btn--sm.btn--soft', {
              type: 'button', html: '<span>Próxima etapa</span>' + App.icon('chevronRight'),
              onclick: () => { etapaAtual = cat.ETAPAS_1A1[idx + 1].id; pintarNav(); pintarPainel(); }
            })
          : u.el('button.btn.btn--sm.btn--ok', {
              type: 'button', html: App.icon('check') + '<span>Concluir encontro</span>',
              onclick: () => concluir(enc, dados, c)
            })
      ]);
      card.appendChild(foot);
      painel.appendChild(card);
    }

    /* -------------------------- construtores -------------------------- */
    function areaTexto(valor, ph, aoMudar, linhas) {
      const ta = u.el('textarea.textarea', { placeholder: ph, rows: linhas || 5 });
      ta.value = valor || '';
      ta.addEventListener('input', () => { aoMudar(ta.value); salvar(); pintarNav(); });
      /* ao sair do campo, o corretor de digitacao passa no texto inteiro —
         corrigir durante a digitacao brigaria com o cursor do usuario */
      ta.addEventListener('blur', () => {
        const v = corrigirTexto(ta.value);
        if (v !== ta.value) { ta.value = v; aoMudar(v); salvar(); pintarNav(); }
      });
      return ta;
    }

    /* Um clique resume as observacoes do periodo que o COMO CONDUZIR mostra
       e joga na lista — resumo LOCAL, nao copia-e-cola: de cada observacao
       fica so a frase com mais substancia (valores, numeros, resultado,
       comportamento), sem emojis, interjeicoes nem vocativo com o nome.
       O que ja esta na lista nao entra de novo; sem novidade o botao some. */
    function resumirObs(texto) {
      const limpo = String(texto || '')
        .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
        .split('\n').map(x => x.trim()).filter(Boolean).join(' ')
        .replace(/\s{2,}/g, ' ').trim()
        .replace(/(\d)\.(\d)/g, '$1\u0001$2');   /* ponto de milhar nao encerra frase */
      const frases = (limpo.match(/[^.!?…]+[.!?…]*/g) || [limpo])
        .map(f => f.replace(/\u0001/g, '.').trim()).filter(Boolean);
      const chave = /meta|venda|prospec|fechament|negocia|cliente|follow|lead|time|autonomia|evolu|resultado|comportament|respeito|organiza|treinament|decis|soluç|alternativ|escalar|n[ií]vel|foco|atitude/i;
      let melhor = frases[0] || '', nota = -Infinity;
      frases.forEach(f => {
        let s = 0;
        if (/R\$\s?[\d.,]+|\d+[.,]?\d*\s?%|\b\d{2,}\b/.test(f)) s += 3;   /* numeros = fato */
        if (chave.test(f)) s += 2;
        if (/\?\s*$/.test(f)) s -= 5;                                      /* pergunta nao resume */
        if (/^(vamos l[aá]|olha|ent[aã]o|bom[,.]|beleza|blz|a[ií] )/i.test(f)) s -= 2;
        s -= Math.abs(f.length - 90) / 60;                                 /* nem curta, nem parede */
        if (f.length < 15) s -= 2;
        if (s > nota) { nota = s; melhor = f; }
      });
      let out = melhor;
      if (c && c.nome) {                                                   /* "..., Gabi!" -> "!" */
        const pfx = u.primeiroNome(c.nome).slice(0, 3);
        out = out.replace(new RegExp(',\\s*' + pfx + '[\\wà-úÀ-Ú]*\\s*([!.…?])', 'i'), '$1');
      }
      out = corrigirTexto(out.replace(/\s{2,}/g, ' ').trim());
      if (out.length > 140) out = out.slice(0, 139).replace(/\s+\S*$/, '') + '…';
      if (out) out = out.charAt(0).toUpperCase() + out.slice(1);
      if (out && !/[.!?…]$/.test(out)) out += '.';
      return out;
    }

    /* Alinhamento final gerado do que a sessao combinou: compromissos,
       foco de desenvolvimento e um reconhecimento para fechar bem. */
    function gerarFechamento() {
      const r = dados.roteiro;
      const minus = t => { t = String(t || '').trim().replace(/[.!?…]+$/, ''); return t ? t.charAt(0).toLowerCase() + t.slice(1) : ''; };
      const listar = arr => {
        const l = (arr || []).map(t => minus(itemComoAcao(t))).filter(Boolean);
        return l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : (l[0] || '');
      };
      const partes = [];
      if ((r.compromissos || []).length) partes.push('Ficou combinado: ' + listar(r.compromissos) + '.');
      if ((r.desenvolver || []).length) {
        partes.push('Até o próximo encontro, o foco de desenvolvimento é: ' + listar(r.desenvolver));
      } else {
        const av = cat.COMPETENCIAS.filter(x => dados.competencias[x.id] && dados.competencias[x.id].nota);
        if (av.length) {
          const pior = av.reduce((a, b) => dados.competencias[b.id].nota < dados.competencias[a.id].nota ? b : a);
          partes.push('Até o próximo encontro, o foco de desenvolvimento é ' + pior.label + ' (' + dados.competencias[pior.id].nota + '/5).');
        }
      }
      if ((r.positivos || []).length) partes.push('Fica o reconhecimento do período: ' + minus(r.positivos[0]) + '.');
      partes.push('Vou acompanhar os combinados no dia a dia e voltamos a conversar no próximo One a One.');
      return corrigirTexto(partes.join('\n'));
    }

    function botaoTranscrever(lista, filtro, rotulo) {
      const obsPer = db.observacoes.noPeriodo(enc.colaboradorId, enc.periodoInicio, u.nowISO())
        .filter(o => cat.tipoObs(o.tipo) && filtro(cat.tipoObs(o.tipo).pol));
      const novos = obsPer.map(o => resumirObs(o.texto)).filter(t => t && lista.indexOf(t) < 0);
      if (!novos.length) return null;
      return u.el('button.btn.btn--sm.btn--soft.u-mb-3', {
        type: 'button', html: App.icon('sparkles') + '<span>' + rotulo + ' (' + novos.length + ')</span>',
        onclick: () => {
          novos.forEach(t => lista.push(t));
          salvar(); pintarNav(); pintarPainel();
          App.toast.ok(u.plural(novos.length, 'item adicionado', 'itens adicionados'), 'Resumos do período transcritos — edite o que quiser.');
        }
      });
    }

    const montar = {
      preparo(body) {
        const prep = A.prepararOneOne(enc.colaboradorId);
        if (!prep) { body.appendChild(u.el('div.t-muted', { text: 'Sem dados para preparar.' })); return; }
        const r = prep.resumo;
        body.appendChild(u.el('div.grid', { style: { gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: '10px' } }, [
          miniStat(r.total, 'Observações'), miniStat(r.positivos, 'Positivos'),
          miniStat(r.atencao, 'Atenção'), miniStat(r.totalFeedbacks, 'Feedbacks'),
          miniStat(r.acoesConcluidas, 'Ações OK'), miniStat(r.acoesPendentes, 'Pendentes')
        ]));

        const blocos = u.el('div.grid.grid-2.u-mt-5');
        blocos.appendChild(prepBloco('3 pontos positivos', prep.positivos.map(o => o.texto), 'Nenhum registro positivo no período.'));
        blocos.appendChild(prepBloco('3 pontos de atenção', prep.atencao.map(o => o.texto), 'Nenhum ponto de atenção no período.'));
        blocos.appendChild(prepBloco('O que evoluiu', prep.evolucao.map(e => e.texto), 'Sem evolução mensurável ainda.'));
        blocos.appendChild(prepBloco('Pontos a acompanhar', prep.acompanhar.map(e => e.texto), 'Nada em aberto.'));
        body.appendChild(blocos);

        body.appendChild(u.el('div.u-mt-5', {}, [
          u.el('div.t-up.u-mb-2', { text: 'Perguntas sugeridas' })
        ].concat(prep.perguntas.map(q => u.el('div.q-suggest', {}, [
          u.el('span', { text: '“' + q + '”' }),
          u.el('button.icon-btn.q-suggest__copy', {
            type: 'button', 'data-tip': 'Copiar', html: App.icon('copy'),
            onclick: () => u.copiar(q).then(() => App.toast.ok('Pergunta copiada'))
          })
        ])))));
      },

      como_esta(body) {
        body.appendChild(areaTexto(dados.roteiro.comoEsta,
          'Como a pessoa chegou? Energia, motivação, contexto pessoal que afeta o trabalho...',
          v => { dados.roteiro.comoEsta = v; }));
      },

      conquistas(body) {
        body.appendChild(areaTexto(dados.roteiro.conquistas,
          'O que ela destaca como conquista do período — deixe ela falar primeiro.',
          v => { dados.roteiro.conquistas = v; }));
      },

      dificuldades(body) {
        body.appendChild(areaTexto(dados.roteiro.dificuldades,
          'O que travou, o que atrapalhou, o que ela não conseguiu resolver sozinha.',
          v => { dados.roteiro.dificuldades = v; }));
      },

      autoavaliacao(body) {
        dados.roteiro.perguntasExtras = dados.roteiro.perguntasExtras || [];

        cat.PERGUNTAS_AUTO.forEach(q => {
          body.appendChild(u.el('div.u-mb-4', {}, [
            p.campo(q.label, areaTexto(dados.roteiro.autoavaliacao[q.id], 'Resposta do colaborador...',
              v => { dados.roteiro.autoavaliacao[q.id] = v; }, 3))
          ]));
        });

        /* ---- perguntas proprias, ja adicionadas ---- */
        dados.roteiro.perguntasExtras.forEach((q, idx) => {
          const campo = p.campo(q.pergunta, areaTexto(q.resposta, 'Resposta do colaborador...',
            v => { q.resposta = v; }, 3));
          const lbl = campo.querySelector('.field__label');
          if (lbl) {
            lbl.appendChild(u.el('span.u-grow'));
            if (q.obsId) lbl.appendChild(u.el('span.badge.badge--outline.t-xs', { text: 'do período' }));
            lbl.appendChild(u.el('button.btn.btn--xs.btn--ghost', {
              type: 'button', 'aria-label': 'Remover pergunta', 'data-tip': 'Tirar da pauta',
              html: App.icon('x'),
              onclick: () => {
                dados.roteiro.perguntasExtras.splice(idx, 1);
                salvar(); pintarPainel();
              }
            }));
          }
          body.appendChild(u.el('div.u-mb-4', {}, [campo]));
        });

        /* ---- o que ja foi perguntado no periodo e ainda nao esta na pauta ----
           Uma observacao que termina em "?" e pergunta, nao evidencia: o lugar
           dela e aqui, virando resposta do colaborador. */
        const jaNaPauta = {};
        dados.roteiro.perguntasExtras.forEach(q => { if (q.obsId) jaNaPauta[q.obsId] = true; });

        const perguntadas = db.observacoes
          .noPeriodo(enc.colaboradorId, enc.periodoInicio, u.nowISO())
          .filter(o => !jaNaPauta[o.id] && /\?\s*$/.test((o.texto || '').trim()));

        const acoes = u.el('div.u-row.u-wrap.u-gap-2.u-mt-2');

        acoes.appendChild(u.el('button.btn.btn--sm.btn--outline', {
          type: 'button', html: App.icon('plus') + '<span>Nova pergunta</span>',
          onclick: () => novaPergunta()
        }));

        if (perguntadas.length) {
          acoes.appendChild(u.el('button.btn.btn--sm.btn--soft', {
            type: 'button',
            html: App.icon('eye') + '<span>Puxar do período (' + perguntadas.length + ')</span>',
            'data-tip': 'Perguntas que você já registrou como observação neste período',
            onclick: () => escolherDoPeriodo(perguntadas)
          }));
        }

        body.appendChild(u.el('div.note.u-mt-4', {}, [
          u.el('div.t-sm', {
            text: 'As quatro de cima são fixas. Abaixo delas você pode trazer uma pergunta que já '
                + 'registrou no período — ou escrever outra agora.'
          }),
          acoes
        ]));
      },

      feedback(body) {
        const de = enc.periodoInicio;
        const obs = db.observacoes.noPeriodo(enc.colaboradorId, de, u.nowISO());
        const fbs = db.feedbacks.noPeriodo(enc.colaboradorId, de, u.nowISO());

        if (!obs.length && !fbs.length) {
          body.appendChild(p.vazio({
            icone: 'eye', titulo: 'Nenhum registro no período',
            desc: 'Não há observações nem feedbacks desde o último encontro. A conversa vai depender só da memória — registre no dia a dia para o próximo.',
            acoes: [{ label: 'Registrar agora', icone: 'plus', onClick: () => App.obsModal.abrir({ colaboradorId: enc.colaboradorId }) }]
          }));
          return;
        }

        /* Painel de abertura: muda conforme o que for marcado abaixo.
           Fica num container proprio para repintar sem refazer a etapa. */
        const guia = u.el('div');
        body.appendChild(guia);

        const resumoPer = A.resumoPeriodo(enc.colaboradorId, de, u.nowISO());
        function pintarGuia() {
          u.clear(guia);
          const marc = App.guia.marcadoPorPolaridade(dados.observacoesDiscutidas, enc.colaboradorId, de);
          guia.appendChild(App.guia.abertura(
            db.colaboradores.por(enc.colaboradorId), marc,
            { positivos: resumoPer.positivos, atencao: resumoPer.atencao }
          ));
        }
        pintarGuia();
        aoMarcarEvidencia = pintarGuia;

        /* ---- marcar / desmarcar tudo ----
           Vale para os dois grupos do bloco: observacoes e feedbacks. O rotulo
           acompanha o estado, e nada e "marcado" duas vezes por engano. */
        const totalEvid = obs.length + fbs.length;
        const marcadas = () => dados.observacoesDiscutidas.length + dados.feedbacksDiscutidos.length;

        function alternarTodas() {
          if (marcadas() >= totalEvid) {
            dados.observacoesDiscutidas.length = 0;
            dados.feedbacksDiscutidos.length = 0;
          } else {
            dados.observacoesDiscutidas.length = 0;
            aplicarOrdem(obs).forEach(o => dados.observacoesDiscutidas.push(o.id));
            dados.feedbacksDiscutidos.length = 0;
            fbs.forEach(f => dados.feedbacksDiscutidos.push(f.id));
          }
          salvar(); pintarNav(); pintarPainel();
        }

        const todasOn = marcadas() >= totalEvid;
        body.appendChild(u.el('div.note.note--brand.u-mb-4.u-row.u-wrap.u-gap-3', { style: { alignItems: 'center' } }, [
          u.el('span.u-grow', {
            text: 'Marque o que será discutido nesta conversa. O que você marcar fica registrado no encontro como evidência tratada.'
          }),
          u.el('button.btn.btn--xs.btn--outline.u-nowrap', {
            type: 'button',
            html: App.icon(todasOn ? 'x' : 'check') +
                  '<span>' + (todasOn ? 'Desmarcar todas' : 'Marcar todas (' + totalEvid + ')') + '</span>',
            'data-tip': todasOn
              ? 'Tira todas as evidências da conversa'
              : 'Traz as ' + totalEvid + ' evidências do período para a conversa',
            onclick: alternarTodas
          }),
          marcadas() && !todasOn
            ? u.el('span.t-xs.t-muted2.u-nowrap', { text: marcadas() + ' de ' + totalEvid + ' marcadas' })
            : null
        ]));

        if (obs.length) {
          const segOrdem = u.el('div.seg.seg--xs');
          [['data', 'Data', 'Ordem cronológica, da mais antiga para a mais recente'],
           ['pontos', 'Pontuação', 'Do que mais soma para o que mais desconta — reconhecimento primeiro, crítico por último'],
           ['manual', 'Manual', 'A sequência que você montou arrastando']
          ].forEach(([id, lb, tip]) => {
            /* "Manual" so aparece depois de a pessoa ter arrastado alguma coisa. */
            if (id === 'manual' && dados.ordemModo !== 'manual') return;
            segOrdem.appendChild(u.el('button.seg__btn' + (dados.ordemModo === id ? '.is-on' : ''), {
              type: 'button', text: lb, 'data-tip': tip,
              onclick: () => { aplicarModo(id, obs); }
            }));
          });

          body.appendChild(u.el('div.u-row.u-wrap.u-gap-2.u-mb-2', { style: { alignItems: 'center' } }, [
            u.el('span.t-up', { text: u.plural(obs.length, 'observação no período', 'observações no período') }),
            u.el('span.t-xs.t-muted2.u-grow', { text: '— arraste pelo ⠿ para montar a sequência da conversa' }),
            u.el('span.t-xs.t-muted2', { text: 'ordenar por' }),
            segOrdem
          ]));

          const lista = u.el('div.u-col.u-gap-2.u-mb-5.pick-list');
          const ordenadas = aplicarOrdem(obs);

          ordenadas.forEach((o, i) => lista.appendChild(itemSelecionavel(
            o.id, dados.observacoesDiscutidas,
            cat.tipoObs(o.tipo).emoji + ' ' + cat.tipoObs(o.tipo).label + ' · ' + u.fmtDate(o.data) + ' · ' + cat.contexto(o.contexto).label,
            o.texto,
            {
              ordenavel: true, indice: i, total: ordenadas.length, tipoObs: o.tipo,
              aoMover: (de, para) => {
                mover(ordenadas.map(x => x.id), de, para);
                sincronizarDiscutidas(obs);
                salvar(); pintarPainel();
              }
            })));
          body.appendChild(lista);
        }

        if (fbs.length) {
          body.appendChild(u.el('div.t-up.u-mb-2', { text: u.plural(fbs.length, 'feedback no período', 'feedbacks no período') }));
          const lista = u.el('div.u-col.u-gap-2');
          fbs.forEach(f => lista.appendChild(itemSelecionavel(
            f.id, dados.feedbacksDiscutidos,
            '💬 ' + cat.classif(f.classificacao).label + ' · ' + u.fmtDate(f.data),
            f.oQueAconteceu)));
          body.appendChild(lista);
        }

        body.appendChild(u.el('button.btn.btn--sm.btn--outline.u-mt-4', {
          type: 'button', html: App.icon('plus') + '<span>Registrar feedback nesta conversa</span>',
          onclick: () => App.fbModal.abrir({
            colaboradorId: enc.colaboradorId, oneAOneId: enc.id,
            aoSalvar: fb => { dados.feedbacksDiscutidos.push(fb.id); salvar(); pintarPainel(); }
          })
        }));
      },

      competencias(body) {
        const anterior = A.competenciasAtuais(enc.colaboradorId);
        body.appendChild(u.el('div.note.u-mb-4', {
          text: 'Avalie de 1 a 5 e justifique com um fato observado. Sem justificativa, a nota vira opinião. '
              + 'A pergunta abaixo de cada competência é um atalho para chegar ao fato — dispense as que não servirem.'
        }));
        cat.COMPETENCIAS.forEach(comp => {
          const atual = dados.competencias[comp.id] || {};
          const ant = anterior[comp.id];

          const linha = u.el('div.comp-row');
          const cabec = u.el('div', {}, [
            u.el('div.comp-row__name', { text: comp.label }),
            ant ? u.el('div.t-xs.t-muted2', { text: 'Última avaliação: ' + ant.nota + '/5 em ' + u.fmtDate(ant.data) }) : null
          ]);
          /* Pergunta diagnostica da base de referencia — dispensavel uma a uma. */
          const q = App.guia.perguntaCompetencia(comp.id, () => pintarPainel());
          if (q) cabec.appendChild(q);
          linha.appendChild(cabec);
          linha.appendChild(p.rating(atual.nota || null, v => {
            dados.competencias[comp.id] = Object.assign({}, dados.competencias[comp.id], { nota: v });
            salvar(); pintarNav();
          }, { permiteLimpar: true }));

          const cmt = u.el('input.input.input--sm', { type: 'text', placeholder: 'Justificativa / evidência — ex.: "sustenta valor mas cede na objeção de preço"' });
          cmt.value = atual.comentario || '';
          cmt.addEventListener('input', () => {
            dados.competencias[comp.id] = Object.assign({}, dados.competencias[comp.id], { comentario: cmt.value });
            salvar();
          });
          cmt.addEventListener('blur', () => {
            const v = corrigirTexto(cmt.value);
            if (v !== cmt.value) {
              cmt.value = v;
              dados.competencias[comp.id] = Object.assign({}, dados.competencias[comp.id], { comentario: v });
              salvar();
            }
          });
          linha.appendChild(u.el('div.comp-row__cmt', {}, [cmt]));
          body.appendChild(linha);
        });
      },

      positivos(body) {
        const b = botaoTranscrever(dados.roteiro.positivos, pol => pol > 0, 'Adicionar os reconhecimentos do período');
        if (b) body.appendChild(b);
        body.appendChild(listaComSync(dados.roteiro.positivos, 'Ex.: sustentou valor na negociação da Vitória Log', salvar, pintarNav));
      },

      desenvolver(body) {
        const b = botaoTranscrever(dados.roteiro.desenvolver, pol => pol < 0, 'Adicionar os pontos de atenção do período');
        if (b) body.appendChild(b);
        body.appendChild(listaComSync(dados.roteiro.desenvolver, 'Ex.: cadência de follow-up no CRM', salvar, pintarNav, { acao: true }));
      },

      compromissos(body) {
        body.appendChild(u.el('div.note.note--brand.u-mb-4', {
          text: 'Cada compromisso pode virar um plano de ação com prazo e indicador ao concluir o encontro.'
        }));
        body.appendChild(listaComSync(dados.roteiro.compromissos, 'Ex.: zerar oportunidades sem toque há mais de 7 dias', salvar, pintarNav, { acao: true }));

        const abertos = db.planos.abertos(enc.colaboradorId);
        if (abertos.length) {
          body.appendChild(u.el('div.t-up.u-mt-5.u-mb-2', { text: 'Planos que já estavam em aberto' }));
          const l = u.el('div.u-col.u-gap-2');
          abertos.forEach(pl => l.appendChild(p.cardPlano(pl, {
            aoAbrir: x => App.planoModal.abrir({ plano: x, aoSalvar: () => pintarPainel() })
          })));
          body.appendChild(l);
        }
      },

      fechamento(body) {
        const taFech = areaTexto(dados.roteiro.fechamento,
          'Alinhamento final: o que ficou combinado, o que você vai acompanhar e quando vocês se falam de novo.',
          v => { dados.roteiro.fechamento = v; });
        body.appendChild(u.el('button.btn.btn--sm.btn--soft.u-mb-3', {
          type: 'button', html: App.icon('sparkles') + '<span>Gerar alinhamento com o que foi combinado</span>',
          onclick: () => {
            const aplicar = () => {
              dados.roteiro.fechamento = gerarFechamento();
              taFech.value = dados.roteiro.fechamento;
              salvar(); pintarNav();
            };
            if (String(dados.roteiro.fechamento || '').trim()) {
              App.modal.confirmar({
                titulo: 'Substituir o alinhamento final',
                mensagem: 'O texto atual será trocado pelo resumo dos compromissos, foco de desenvolvimento e reconhecimento desta sessão.',
                confirmar: 'Substituir'
              }).then(ok => { if (ok) aplicar(); });
            } else aplicar();
          }
        }));
        body.appendChild(taFech);

        const resumo = u.el('div.u-mt-5');
        resumo.appendChild(u.el('div.t-up.u-mb-2', { text: 'Como este encontro vai ficar registrado' }));
        const itens = [
          ['Pontos positivos', dados.roteiro.positivos.length],
          ['Pontos de desenvolvimento', dados.roteiro.desenvolver.length],
          ['Compromissos', dados.roteiro.compromissos.length],
          ['Evidências discutidas', dados.observacoesDiscutidas.length + dados.feedbacksDiscutidos.length],
          ['Competências avaliadas', Object.keys(dados.competencias).filter(k => dados.competencias[k] && dados.competencias[k].nota).length]
        ];
        itens.forEach(([l, n]) => resumo.appendChild(u.el('div.u-between', { style: { padding: '7px 0', borderBottom: '1px solid var(--border)' } }, [
          u.el('span.t-sm', { text: l }),
          u.el('span', { class: 'badge badge--' + (n ? 'brand' : 'outline'), text: String(n) })
        ])));
        body.appendChild(resumo);

        /* Registro automatico: o texto e gerado na primeira vez que a etapa
           abre e depois vira do coordenador — editar aqui nao e sobrescrito.
           "Gerar de novo" reconstroi do zero com o que esta nos passos 1 a 9. */
        if (!String(dados.roteiro.registro || '').trim()) {
          dados.roteiro.registro = gerarRegistro(dados, c, enc);
          salvar();
        }
        const taReg = u.el('textarea.textarea', { rows: 18, style: { fontSize: 'var(--fs-sm)', lineHeight: '1.55' } });
        taReg.value = dados.roteiro.registro;
        taReg.addEventListener('input', () => { dados.roteiro.registro = taReg.value; salvar(); });
        taReg.addEventListener('blur', () => {
          const v = corrigirTexto(taReg.value);
          if (v !== taReg.value) { dados.roteiro.registro = v; taReg.value = v; salvar(); }
        });

        const regHead = u.el('div.u-between.u-mt-5.u-mb-2', {}, [
          u.el('div.t-up', { text: 'Texto do registro (gerado automaticamente)' }),
          u.el('button.btn.btn--xs.btn--soft', {
            type: 'button', html: App.icon('refresh') + '<span>Gerar de novo</span>',
            onclick: () => {
              App.modal.confirmar({
                titulo: 'Gerar o registro de novo',
                mensagem: 'O texto atual será substituído pelo resumo montado com o que está nos passos 1 a 10. Edições manuais serão perdidas.',
                confirmar: 'Gerar de novo'
              }).then(ok => {
                if (!ok) return;
                dados.roteiro.registro = gerarRegistro(dados, c, enc);
                taReg.value = dados.roteiro.registro;
                salvar();
              });
            }
          })
        ]);
        body.appendChild(regHead);
        body.appendChild(taReg);
        body.appendChild(u.el('div.t-xs.t-muted2.u-mt-2', {
          text: 'Montado com o que foi digitado nos passos anteriores. Edite à vontade — este texto vai para o histórico e é o que sai no "Copiar ata".'
        }));

        body.appendChild(u.el('button.btn.btn--lg.btn--ok.btn--block.u-mt-5', {
          type: 'button', html: App.icon('check') + '<span>Concluir One a One</span>',
          onclick: () => concluir(enc, dados, c)
        }));
      }
    };

    /* ------------------------- ordem das evidencias -------------------------
       `dados.ordemObs` guarda os ids na sequencia escolhida. Quem nao estiver
       nela entra depois, na ordem cronologica — assim uma observacao registrada
       DEPOIS da reordenacao nao some nem embaralha o que ja foi montado.
       ---------------------------------------------------------------------- */
    function aplicarOrdem(lista) {
      if (!dados.ordemObs.length) return lista;
      const pos = {};
      dados.ordemObs.forEach((id, i) => { pos[id] = i; });
      const dentro = lista.filter(o => pos[o.id] !== undefined).sort((a, b) => pos[a.id] - pos[b.id]);
      const fora = lista.filter(o => pos[o.id] === undefined);
      return dentro.concat(fora);
    }

    /** Peso da observacao no saldo: polaridade x impacto. */
    function pontosDe(o) {
      return cat.tipoObs(o.tipo).pol * cat.impacto(o.impacto).peso;
    }

    /**
     * Troca o criterio de ordenacao. Sempre grava a sequencia resultante em
     * ordemObs — assim a pauta impressa segue o que esta na tela, seja qual
     * for o modo escolhido.
     */
    function aplicarModo(modo, lista) {
      dados.ordemModo = modo;
      if (modo === 'data') {
        dados.ordemObs = [];
      } else if (modo === 'pontos') {
        /* Do que mais soma para o que mais desconta. Empate desempata pela
           data, da mais antiga para a mais recente — a historia anda junto. */
        dados.ordemObs = lista.slice().sort((a, b) => {
          const d = pontosDe(b) - pontosDe(a);
          return d !== 0 ? d : (a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
        }).map(o => o.id);
      }
      sincronizarDiscutidas(lista);
      salvar();
      pintarPainel();
    }

    /** Move um id de posicao e grava a nova sequencia completa. */
    function mover(ids, de, para) {
      if (de === para || para < 0 || para >= ids.length) return;
      const arr = ids.slice();
      const [x] = arr.splice(de, 1);
      arr.splice(para, 0, x);
      dados.ordemObs = arr;
      dados.ordemModo = 'manual';      /* arrastou: o criterio passa a ser o dele */
    }

    /** As discutidas seguem a mesma sequencia — e o que a pauta imprime. */
    function sincronizarDiscutidas(lista) {
      const ordem = aplicarOrdem(lista).map(o => o.id);
      dados.observacoesDiscutidas.sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
    }

    /* Preenchida pela etapa 5 enquanto ela esta na tela; o clique numa
       evidencia repinta o painel de abertura, que depende do que foi marcado. */
    let aoMarcarEvidencia = null;

    /** Acrescenta uma pergunta a pauta da autoavaliacao. */
    function addPergunta(texto, obsId) {
      dados.roteiro.perguntasExtras = dados.roteiro.perguntasExtras || [];
      dados.roteiro.perguntasExtras.push({
        id: u.uid('pq'), pergunta: texto, resposta: '', obsId: obsId || ''
      });
      salvar(); pintarNav(); pintarPainel();
    }

    /** Escreve uma pergunta na hora. */
    function novaPergunta() {
      const ta = u.el('textarea.textarea', {
        rows: 3, 'data-autofocus': true, maxlength: 400,
        placeholder: 'Ex.: Você se sentiu na obrigação de comemorar ou foi por outro motivo?'
      });
      App.modal.abrir({
        titulo: 'Nova pergunta', icone: 'chat', tamanho: 'sm',
        desc: 'Entra na pauta da autoavaliação, com campo para a resposta do colaborador.',
        corpo: u.el('div', {}, [p.campo('Pergunta', ta)]),
        acoes: [
          { label: 'Cancelar', tipo: 'ghost' },
          { label: 'Adicionar', tipo: 'primary', icone: 'check', onClick: () => {
              const t = ta.value.trim();
              if (!t) { App.toast.aviso('Escreva a pergunta'); return false; }
              addPergunta(t, '');
              return true;
            } }
        ]
      });
    }

    /** Traz para a pauta uma pergunta ja registrada como observacao. */
    function escolherDoPeriodo(lista) {
      const box = u.el('div');
      const m = App.modal.abrir({
        titulo: 'Perguntas do período', icone: 'eye', tamanho: 'md',
        desc: 'Registros que terminam em pergunta. Clique para trazer à pauta da autoavaliação.',
        corpo: box, acoes: [{ label: 'Fechar', tipo: 'ghost' }]
      });
      lista.forEach(o => {
        const t = cat.tipoObs(o.tipo);
        box.appendChild(u.el('button.pick-item', {
          type: 'button',
          onclick: () => { m.fechar(); setTimeout(() => addPergunta(o.texto.trim(), o.id), 60); }
        }, [
          u.el('span.pick-item__box', { html: App.icon('plus') }),
          u.el('div.u-grow', { style: { minWidth: 0 } }, [
            u.el('div.t-xs.t-muted2', { style: { marginBottom: '3px' },
              text: t.emoji + ' ' + t.label + ' · ' + u.fmtDate(o.data) + (o.loteId ? ' · em lote' : '') }),
            u.el('div.t-md.u-pre', { style: { color: 'var(--text-2)' }, text: o.texto })
          ])
        ]));
      });
    }

    function itemSelecionavel(id, arr, titulo, texto, opts) {
      opts = opts || {};
      const on = arr.indexOf(id) >= 0;
      const node = u.el('button.pick-item' + (on ? '.is-on' : ''), {
        type: 'button',
        onclick: () => {
          const i = arr.indexOf(id);
          if (i >= 0) arr.splice(i, 1); else arr.push(id);
          node.classList.toggle('is-on', arr.indexOf(id) >= 0);
          if (opts.ordenavel) sincronizarDiscutidas(
            db.observacoes.noPeriodo(enc.colaboradorId, enc.periodoInicio, u.nowISO()));
          salvar(); pintarNav();
          if (aoMarcarEvidencia) aoMarcarEvidencia();
        }
      }, [
        u.el('span.pick-item__box', { html: App.icon('check') }),
        u.el('div.u-grow', { style: { minWidth: 0 } }, [
          u.el('div.t-xs.t-muted2', { style: { marginBottom: '3px' }, text: titulo }),
          u.el('div.t-md.u-pre', { style: { color: 'var(--text-2)' }, text: texto }),
          /* Como tratar ESTE tipo na conversa — vem da base de livros. */
          (function () {
            const d = opts.tipoObs ? App.biblio.dicaTipo(opts.tipoObs) : null;
            return d ? u.el('div.pick-item__dica', {}, [
              u.el('span', { html: App.icon('chat', '', 12) }),
              u.el('span.u-grow', {}, [
                u.el('span', { text: d.texto }),
                d.fonte ? u.el('span.pick-item__fonte', { text: d.fonte }) : null
              ])
            ]) : null;
          })()
        ])
      ]);

      if (!opts.ordenavel) return node;

      /* ---- envelope arrastavel: alca + setas + o item ---- */
      const linha = u.el('div.pick-row', { draggable: 'true', 'data-i': String(opts.indice) });

      const alca = u.el('span.pick-row__alca', {
        'data-tip': 'Arraste para mudar a ordem da conversa',
        'aria-hidden': 'true', text: '⠿'
      });

      const setas = u.el('div.pick-row__setas', {}, [
        u.el('button.icon-btn.icon-btn--xs', {
          type: 'button', 'aria-label': 'Mover para cima', 'data-tip': 'Mover para cima',
          disabled: opts.indice === 0 ? true : null,
          html: App.icon('chevronUp', '', 14),
          onclick: ev => { ev.stopPropagation(); opts.aoMover(opts.indice, opts.indice - 1); }
        }),
        u.el('button.icon-btn.icon-btn--xs', {
          type: 'button', 'aria-label': 'Mover para baixo', 'data-tip': 'Mover para baixo',
          disabled: opts.indice === opts.total - 1 ? true : null,
          html: App.icon('chevronDown', '', 14),
          onclick: ev => { ev.stopPropagation(); opts.aoMover(opts.indice, opts.indice + 1); }
        })
      ]);

      linha.appendChild(u.el('span.pick-row__n', { text: String(opts.indice + 1) }));
      linha.appendChild(alca);
      linha.appendChild(node);
      linha.appendChild(setas);

      linha.addEventListener('dragstart', ev => {
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', String(opts.indice));
        linha.classList.add('is-dragging');
      });
      linha.addEventListener('dragend', () => {
        linha.classList.remove('is-dragging');
        u.$$('.pick-row', linha.parentNode || document).forEach(x => x.classList.remove('is-over'));
      });
      linha.addEventListener('dragover', ev => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        linha.classList.add('is-over');
      });
      linha.addEventListener('dragleave', () => linha.classList.remove('is-over'));
      linha.addEventListener('drop', ev => {
        ev.preventDefault();
        linha.classList.remove('is-over');
        const de = parseInt(ev.dataTransfer.getData('text/plain'), 10);
        if (!isNaN(de)) opts.aoMover(de, opts.indice);
      });

      return linha;
    }

    pintarNav(); pintarPainel();
    stage.appendChild(navCard);
    stage.appendChild(painel);
    box.appendChild(stage);

    u.clear(view);
    view.appendChild(box);
  }

  /* opts.acao: alem da correcao de digitacao, o verbo inicial vira
     infinitivo — itens de desenvolvimento e compromissos sao acoes. */
  function listaComSync(arr, ph, salvar, pintarNav, opts) {
    const wrap = u.el('div');
    const lista = u.el('div.pill-list');
    const linha = u.el('div.u-row.u-gap-2.u-mt-3');
    const inp = u.el('input.input', { type: 'text', placeholder: ph });
    const btn = u.el('button.btn.btn--soft', { type: 'button', html: App.icon('plus') + '<span>Adicionar</span>' });

    function pintar() {
      u.clear(lista);
      if (!arr.length) {
        lista.appendChild(u.el('div.t-sm.t-muted2', { text: 'Nenhum item adicionado ainda.' }));
      } else {
        arr.forEach((txt, i) => {
          lista.appendChild(u.el('div.pill-item', {}, [
            u.el('span.t-muted2.t-sm', { text: (i + 1) + '.' }),
            u.el('span.u-grow', { text: txt }),
            u.el('button.pill-item__x', {
              type: 'button', 'aria-label': 'Remover', html: App.icon('x'),
              onclick: () => { arr.splice(i, 1); pintar(); salvar(); pintarNav(); }
            })
          ]));
        });
      }
    }
    function add() {
      let v = corrigirTexto(inp.value.trim());
      if (opts && opts.acao) v = itemComoAcao(v);
      if (!v) return;
      arr.push(v); inp.value = ''; pintar(); salvar(); pintarNav(); inp.focus();
    }
    btn.addEventListener('click', add);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

    linha.appendChild(inp); linha.appendChild(btn);
    wrap.appendChild(lista); wrap.appendChild(linha);
    pintar();
    return wrap;
  }

  function miniStat(v, l) {
    return u.el('div', {
      style: { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '11px 8px', textAlign: 'center' }
    }, [
      u.el('div.stat-tile__v', { text: String(v) }),
      u.el('div.t-xs.t-muted2', { text: l })
    ]);
  }

  function prepBloco(titulo, itens, vazio) {
    return u.el('div.prep-block', {}, [
      u.el('div.prep-block__h', { text: titulo }),
      u.el('div.prep-block__b', {}, itens.length
        ? itens.map((t, i) => u.el('div.prep-li', {}, [
            u.el('span.prep-li__n', { text: String(i + 1) }),
            u.el('div.u-grow.u-pre', { text: t })
          ]))
        : [u.el('div.t-sm.t-muted2', { text: vazio })])
    ]);
  }

  /* ====================================================================== */
  /*  CONCLUIR                                                              */
  /* ====================================================================== */
  function concluir(enc, dados, c) {
    const comp = dados.roteiro.compromissos || [];
    const corpo = u.el('div');

    corpo.appendChild(u.el('div.t-md', {
      style: { color: 'var(--text-2)', lineHeight: '1.6' },
      text: 'O encontro será registrado no histórico de ' + (c ? u.primeiroNome(c.nome) : 'colaborador') +
        ' e o próximo One a One será reagendado automaticamente conforme a frequência definida.'
    }));

    const marcados = comp.slice();
    if (comp.length) {
      corpo.appendChild(u.el('div.t-up.u-mt-5.u-mb-2', { text: 'Transformar compromissos em planos de ação' }));
      const lista = u.el('div.u-col.u-gap-2');
      comp.forEach(txt => {
        const on = () => marcados.indexOf(txt) >= 0;
        const node = u.el('button.pick-item.is-on', {
          type: 'button',
          onclick: () => {
            const i = marcados.indexOf(txt);
            if (i >= 0) marcados.splice(i, 1); else marcados.push(txt);
            node.classList.toggle('is-on', on());
          }
        }, [
          u.el('span.pick-item__box', { html: App.icon('check') }),
          u.el('div.u-grow.t-md', { text: txt })
        ]);
        lista.appendChild(node);
      });
      corpo.appendChild(lista);
      corpo.appendChild(u.el('div.field__hint.u-mt-2', {
        text: 'Cada plano nasce com prazo padrão de 14 dias — você ajusta depois na aba Plano de desenvolvimento.'
      }));
    }

    App.modal.abrir({
      titulo: 'Concluir One a One', icone: 'checkCircle', tom: 'ok', tamanho: 'md', corpo,
      acoes: [
        { label: 'Voltar', tipo: 'ghost' },
        {
          label: 'Concluir encontro', tipo: 'ok', icone: 'check',
          onClick: () => {
            const duracao = inicioSessao && inicioSessao.id === enc.id
              ? Math.max(1, Math.round((Date.now() - inicioSessao.t) / 60000)) : null;

            const patch = {
              status: 'concluido',
              data: u.nowISO(),
              periodoFim: u.nowISO(),
              duracaoMin: duracao,
              roteiro: dados.roteiro,
              competencias: dados.competencias,
              observacoesDiscutidas: dados.observacoesDiscutidas,
              feedbacksDiscutidos: dados.feedbacksDiscutidos,
              resumoSalvo: Object.assign({}, enc.resumoSalvo || {}, {
                total: db.observacoes.noPeriodo(enc.colaboradorId, enc.periodoInicio, u.nowISO()).length
              })
            };

            /* Reabrir e concluir de novo nao duplica: só vira plano o
               compromisso que ainda nao gerou plano NESTE encontro. */
            const jaCriados = db.planos.doColaborador(enc.colaboradorId)
              .filter(p => p.oneAOneId === enc.id)
              .map(p => String(p.acao || p.ponto || '').trim().toLowerCase());
            const novos = marcados.filter(txt => jaCriados.indexOf(String(txt).trim().toLowerCase()) < 0);

            return db.oneones.atualizar(enc.id, patch)
              .then(() => Promise.all(novos.map(txt => db.planos.criar({
                colaboradorId: enc.colaboradorId,
                oneAOneId: enc.id,
                ponto: u.trunc(txt, 70),
                objetivo: '',
                acao: txt,
                responsavel: c ? c.nome : '',
                inicio: u.today(),
                prazo: u.toISODate(u.addDays(new Date(), 14)),
                indicador: '',
                status: 'nao_iniciado'
              }))))
              .then(() => db.colaboradores.reagendar(enc.colaboradorId, new Date()))
              .then(() => {
                inicioSessao = null;
                etapaAtual = 'preparo';
                App.toast.ok('One a One concluído',
                  (novos.length ? u.plural(novos.length, 'plano criado', 'planos criados') + ' · ' : '') +
                  (marcados.length > novos.length ? (marcados.length - novos.length) + ' já existia(m) · ' : '') +
                  'próximo encontro reagendado.');
                App.router.go('/one-a-one/' + enc.id);
                return true;
              })
              .catch(e => { App.toast.erro('Não foi possível concluir', e.message); return false; });
          }
        }
      ]
    });
  }

  function descartar(enc, c) {
    App.modal.confirmar({
      titulo: 'Descartar encontro?',
      mensagem: 'Tudo o que foi preenchido neste One a One em andamento será perdido. Os registros do período continuam intactos.',
      confirmar: 'Descartar', perigo: true
    }).then(ok => {
      if (!ok) return;
      db.oneones.remover(enc.id).then(() => {
        inicioSessao = null;
        App.toast.ok('Encontro descartado');
        App.router.go(c ? '/colaborador/' + c.id + '/oneones' : '/one-a-one');
      });
    });
  }

  /* ====================================================================== */
  /*  MODO LEITURA (encontro concluido)                                     */
  /* ====================================================================== */
  function leitura(view, enc, c) {
    const r = enc.roteiro || {};
    const box = u.el('div.view__inner');

    box.appendChild(u.el('button.btn.btn--sm.btn--ghost.u-mb-3.no-print', {
      type: 'button', html: App.icon('arrowLeft') + '<span>Voltar</span>',
      onclick: () => App.router.voltar('/one-a-one')
    }));

    if (enc.exemplo) box.appendChild(p.faixaExemplo(
      'One a One de demonstração — o roteiro completo de um encontro já realizado.'));

    box.appendChild(u.el('div.card.card--pad.u-mb-5', {}, [
      u.el('div.u-row.u-wrap.u-gap-4', { style: { alignItems: 'center' } }, [
        c ? p.avatar(c, 'lg') : null,
        u.el('div.u-grow', { style: { minWidth: '180px' } }, [
          u.el('div.u-row.u-gap-2', {}, [
            u.el('span.badge.badge--ok', { text: 'Encontro concluído' }),
            enc.duracaoMin ? u.el('span.t-xs.t-muted2', { text: enc.duracaoMin + ' minutos' }) : null
          ]),
          u.el('div.page-head__title', { text: c ? c.nome : 'Colaborador removido' }),
          u.el('div.t-sm.t-muted', {
            text: u.fmtDateLong(enc.data) + ' · período de ' + u.fmtDate(enc.periodoInicio) + ' a ' + u.fmtDate(enc.periodoFim || enc.data)
          })
        ]),
        u.el('div.u-row.u-gap-2.no-print', {}, [
          u.el('button.btn.btn--outline', {
            type: 'button', html: App.icon('print') + '<span>Imprimir</span>', onclick: () => window.print()
          }),
          u.el('button.btn.btn--outline', {
            type: 'button', html: App.icon('copy') + '<span>Copiar ata</span>', onclick: () => copiarAta(enc, c)
          }),
          c ? u.el('button.btn.btn--soft', {
            type: 'button', html: App.icon('sparkles') + '<span>Preparar o próximo</span>',
            onclick: () => App.router.go('/preparar/' + c.id)
          }) : null,
          u.el('button.btn.btn--outline.btn--icon', {
            type: 'button', 'aria-label': 'Mais', html: App.icon('more'),
            onclick: ev => App.menu(ev.currentTarget, [
              { label: 'Reabrir encontro', icone: 'refresh', onClick: () => reabrir(enc) },
              { sep: true },
              { label: 'Excluir encontro', icone: 'trash', perigo: true, onClick: () => excluir(enc, c) }
            ])
          })
        ])
      ])
    ]));

    /* resumo salvo */
    const rs = enc.resumoSalvo || {};
    if (Object.keys(rs).length) {
      box.appendChild(u.el('div.grid.grid-kpi.u-mb-5', {}, [
        rs.total !== undefined ? p.kpi({ label: 'Observações no período', valor: rs.total, icone: 'eye', tom: 'brand' }) : null,
        rs.positivos !== undefined ? p.kpi({ label: 'Positivos', valor: rs.positivos, icone: 'star', tom: 'ok' }) : null,
        rs.atencao !== undefined ? p.kpi({ label: 'Pontos de atenção', valor: rs.atencao, icone: 'alert', tom: 'warn' }) : null,
        p.kpi({ label: 'Compromissos', valor: (r.compromissos || []).length, icone: 'flag', tom: 'purple' })
      ].filter(Boolean)));
    }

    const cols = u.el('div.grid.grid-main');
    const esq = u.el('div.u-col.u-gap-4');

    const add = n => { if (n) esq.appendChild(n); };
    if (String(r.registro || '').trim()) {
      const corpoReg = u.el('div.card__body');
      corpoReg.innerHTML = renderRegistro(r.registro);
      esq.appendChild(u.el('div.card', {}, [
        u.el('div.card__head', {}, [u.el('div.card__title', { text: '📋 Registro do encontro' })]),
        corpoReg
      ]));
    }
    add(secaoTexto('1. Como você está?', r.comoEsta));
    add(secaoTexto('2. Principais conquistas', r.conquistas));
    add(secaoTexto('3. Principais dificuldades', r.dificuldades));

    const auto = r.autoavaliacao || {};
    const extras = (r.perguntasExtras || []).filter(q => q.resposta);
    if (Object.keys(auto).some(k => auto[k]) || extras.length) {
      const b = u.el('div.card__body.u-col.u-gap-4');
      cat.PERGUNTAS_AUTO.forEach(q => {
        if (!auto[q.id]) return;
        b.appendChild(u.el('div', {}, [
          u.el('div.t-up.u-mb-2', { text: q.label }),
          u.el('div.t-md.u-pre', { style: { color: 'var(--text-2)' }, text: auto[q.id] })
        ]));
      });
      /* Perguntas proprias do encontro entram depois das quatro fixas. */
      extras.forEach(q => {
        b.appendChild(u.el('div', {}, [
          u.el('div.t-up.u-mb-2', { text: q.pergunta }),
          u.el('div.t-md.u-pre', { style: { color: 'var(--text-2)' }, text: q.resposta })
        ]));
      });
      esq.appendChild(u.el('div.card', {}, [
        u.el('div.card__head', {}, [u.el('div.card__title', { text: '4. Autoavaliação' })]), b
      ]));
    }

    /* evidencias discutidas */
    const obsD = (enc.observacoesDiscutidas || []).map(id => db.observacoes.por(id)).filter(Boolean);
    const fbD = (enc.feedbacksDiscutidos || []).map(id => db.feedbacks.por(id)).filter(Boolean);
    if (obsD.length || fbD.length) {
      const b = u.el('div.card__body.u-col.u-gap-3');
      obsD.forEach(o => b.appendChild(p.cardObservacao(o, {})));
      fbD.forEach(f => b.appendChild(p.cardFeedback(f, {})));
      esq.appendChild(u.el('div.card', {}, [
        u.el('div.card__head', {}, [
          u.el('div', {}, [
            u.el('div.card__title', { text: '5. Feedback do coordenador' }),
            u.el('div.t-sm.t-muted', { text: u.plural(obsD.length + fbD.length, 'evidência discutida', 'evidências discutidas') })
          ])
        ]), b
      ]));
    }

    add(secaoLista('7. Pontos positivos', r.positivos, 'star'));
    add(secaoLista('8. Pontos de desenvolvimento', r.desenvolver, 'trendUp'));
    add(secaoLista('9. Compromissos', r.compromissos, 'flag'));
    add(secaoTexto('10. Fechamento', r.fechamento));

    if (!esq.children.length) {
      esq.appendChild(u.el('div.card', {}, [p.vazio({
        icone: 'clipboard', titulo: 'Encontro sem roteiro preenchido',
        desc: 'Este One a One foi concluído sem registro dos blocos da pauta.'
      })]));
    }

    cols.appendChild(esq);

    /* lateral: competências */
    const lat = u.el('div.u-col.u-gap-4');
    const comps = enc.competencias || {};
    const avaliadas = cat.COMPETENCIAS.filter(x => comps[x.id] && comps[x.id].nota);

    /* O card aparece mesmo sem nota: um encontro concluido sem avaliar
       competencias precisa de um caminho para corrigir isso depois. */
    const bComp = u.el('div.card__body');
    if (avaliadas.length) {
      bComp.appendChild(g.radar({
        eixos: cat.COMPETENCIAS.map(x => x.label.split(' ')[0]),
        series: [{ label: 'Avaliação', valores: cat.COMPETENCIAS.map(x => (comps[x.id] && comps[x.id].nota) || 0) }],
        mostrarValores: true
      }));
      const l = u.el('div.u-col.u-gap-3.u-mt-4');
      avaliadas.forEach(x => {
        const v = comps[x.id];
        l.appendChild(u.el('div', {}, [
          u.el('div.u-between.u-gap-2', {}, [
            u.el('span.t-sm.t-semi', { text: x.label }),
            u.el('span', { class: 'badge badge--' + (v.nota >= 4 ? 'ok' : v.nota === 3 ? 'warn' : 'danger'), text: v.nota + '/5' })
          ]),
          v.comentario ? u.el('div.t-sm.t-muted', { style: { marginTop: '3px' }, text: v.comentario }) : null
        ]));
      });
      bComp.appendChild(l);
    } else {
      bComp.appendChild(u.el('div.t-sm.t-muted', {
        text: 'Nenhuma competência avaliada neste encontro.'
      }));
    }

    lat.appendChild(u.el('div.card', {}, [
      u.el('div.card__head', {}, [
        u.el('div.card__title.u-grow', { text: '6. Competências' }),
        enc.exemplo ? null : u.el('button.btn.btn--xs.btn--outline', {
          type: 'button',
          html: App.icon('edit') + '<span>' + (avaliadas.length ? 'Editar' : 'Avaliar') + '</span>',
          'data-tip': 'Ajustar as notas deste encontro',
          onclick: () => editarCompetencias(enc, c)
        })
      ]),
      bComp
    ]));

    /* planos originados */
    const planos = db.planos.onde(x => x.oneAOneId === enc.id);
    if (planos.length) {
      const b = u.el('div.card__body.u-col.u-gap-2');
      planos.forEach(pl => b.appendChild(p.cardPlano(pl, {
        aoAbrir: x => App.planoModal.abrir({ plano: x, aoSalvar: () => App.recarregarTela() })
      })));
      lat.appendChild(u.el('div.card', {}, [
        u.el('div.card__head', {}, [
          u.el('div', {}, [
            u.el('div.card__title', { text: 'Planos criados neste encontro' }),
            u.el('div.t-sm.t-muted', { text: u.plural(planos.filter(x => x.status === 'concluido').length, 'já concluído', 'já concluídos') })
          ])
        ]), b
      ]));
    }

    cols.appendChild(lat);
    box.appendChild(cols);

    u.clear(view);
    view.appendChild(box);
  }

  function secaoTexto(titulo, texto) {
    if (!texto) return null;
    return u.el('div.card', {}, [
      u.el('div.card__head', {}, [u.el('div.card__title', { text: titulo })]),
      u.el('div.card__body', {}, [u.el('div.t-md.u-pre', { style: { color: 'var(--text-2)', lineHeight: '1.65' }, text: texto })])
    ]);
  }

  function secaoLista(titulo, itens, icone) {
    if (!itens || !itens.length) return null;
    return u.el('div.card', {}, [
      u.el('div.card__head', {}, [
        u.el('div.u-row.u-gap-2', {}, [
          u.el('span.kpi__icon.tone-brand', { html: App.icon(icone) }),
          u.el('div.card__title', { text: titulo })
        ])
      ]),
      u.el('div.card__body', {}, itens.map((t, i) => u.el('div.prep-li', {}, [
        u.el('span.prep-li__n', { text: String(i + 1) }),
        u.el('div.u-grow.u-pre', { text: t })
      ])))
    ]);
  }

  function reabrir(enc) {
    App.modal.confirmar({
      titulo: 'Reabrir encontro',
      mensagem: 'O encontro volta para "em andamento" e você poderá editar o roteiro. Os planos já criados continuam.',
      confirmar: 'Reabrir'
    }).then(ok => {
      if (!ok) return;
      db.oneones.atualizar(enc.id, { status: 'em_andamento' }).then(() => {
        App.toast.ok('Encontro reaberto');
        App.recarregarTela();
      });
    });
  }

  function excluir(enc, c) {
    App.modal.confirmar({
      titulo: 'Excluir encontro',
      mensagem: 'O One a One sai do histórico do colaborador. Planos criados a partir dele continuam existindo.',
      confirmar: 'Excluir', perigo: true
    }).then(ok => {
      if (!ok) return;
      db.oneones.remover(enc.id).then(() => {
        App.toast.ok('Encontro excluído');
        App.router.go(c ? '/colaborador/' + c.id + '/oneones' : '/one-a-one');
      });
    });
  }

  /* ======================================================================
     Corretor LOCAL de digitação — dicionário de palavras sem acento e erros
     comuns. Só entra o que é inequívoco: "esta/pratica/media(verbo)" e afins
     ficam de fora para não corrigir o que estava certo. Preserva maiúsculas.
     ====================================================================== */
  const CORRECOES_PT = {
    nao:'não', voce:'você', voces:'vocês', vc:'você', tambem:'também', ate:'até', ja:'já', so:'só',
    sao:'são', entao:'então', alguem:'alguém', ninguem:'ninguém', porem:'porém', atraves:'através',
    apos:'após', alem:'além', ha:'há', estao:'estão', sera:'será', serao:'serão', irao:'irão',
    tera:'terá', vao:'vão', mes:'mês', tres:'três',
    junior:'júnior', senior:'sênior', nivel:'nível', niveis:'níveis', unico:'único', unica:'única',
    ultimo:'último', ultima:'última', proximo:'próximo', proxima:'próxima', numero:'número',
    numeros:'números', otimo:'ótimo', otima:'ótima', rapido:'rápido', facil:'fácil',
    dificil:'difícil', possivel:'possível', impossivel:'impossível', incrivel:'incrível',
    disponivel:'disponível', responsavel:'responsável', agil:'ágil', util:'útil',
    area:'área', areas:'áreas', historico:'histórico', historia:'história', relatorio:'relatório',
    relatorios:'relatórios', negocio:'negócio', negocios:'negócios', servico:'serviço',
    servicos:'serviços', preco:'preço', precos:'preços', comeco:'começo', espaco:'espaço',
    esforco:'esforço', matricula:'matrícula', matriculas:'matrículas', estrategia:'estratégia',
    estrategias:'estratégias', estrategico:'estratégico', media:'média',
    experiencia:'experiência', excelencia:'excelência', frequencia:'frequência',
    consequencia:'consequência', tendencia:'tendência', urgencia:'urgência',
    referencia:'referência', transferencia:'transferência', presenca:'presença',
    ausencia:'ausência', mudanca:'mudança', lideranca:'liderança', confianca:'confiança',
    seguranca:'segurança', cobranca:'cobrança', alcancar:'alcançar',
    acao:'ação', acoes:'ações', atencao:'atenção', situacao:'situação', informacao:'informação',
    informacoes:'informações', negociacao:'negociação', negociacoes:'negociações',
    prospeccao:'prospecção', prospeccoes:'prospecções', comunicacao:'comunicação',
    organizacao:'organização', avaliacao:'avaliação', apresentacao:'apresentação',
    reuniao:'reunião', reunioes:'reuniões', decisao:'decisão', decisoes:'decisões',
    gestao:'gestão', questao:'questão', questoes:'questões', sugestao:'sugestão',
    sugestoes:'sugestões', conclusao:'conclusão', conversao:'conversão', comissao:'comissão',
    pressao:'pressão', missao:'missão', visao:'visão', revisao:'revisão', previsao:'previsão',
    expansao:'expansão', condicao:'condição', condicoes:'condições', posicao:'posição',
    evolucao:'evolução', solucao:'solução', solucoes:'soluções', execucao:'execução',
    producao:'produção', promocao:'promoção', correcao:'correção', direcao:'direção',
    relacao:'relação', operacao:'operação', motivacao:'motivação', dedicacao:'dedicação',
    desanimacao:'desanimação', participacao:'participação', capacitacao:'capacitação',
    certificacao:'certificação', obrigacao:'obrigação', obrigacoes:'obrigações',
    /* erros de digitação já vistos nos registros */
    comprtamento:'comportamento', principalemnte:'principalmente', abrigacao:'obrigação',
    enganjado:'engajado', portifolio:'portfólio', 'abrigação':'obrigação'
  };
  function corrigirTexto(t) {
    return String(t || '').replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, w => {
      const c = CORRECOES_PT[w.toLowerCase()];
      if (!c) return w;
      if (w.length > 1 && w === w.toUpperCase()) return c.toUpperCase();
      if (w.charAt(0) === w.charAt(0).toUpperCase()) return c.charAt(0).toUpperCase() + c.slice(1);
      return c;
    });
  }
  /* Reescrita leve dos itens de lista: verbo inicial no presente vira
     infinitivo ("Melhora o comportamento" -> "Melhorar o comportamento"). */
  const VERBO_INFINITIVO = {
    melhora:'melhorar', aumenta:'aumentar', estuda:'estudar', organiza:'organizar',
    prospecta:'prospectar', treina:'treinar', cria:'criar', gere:'gerir', busca:'buscar',
    foca:'focar', reduz:'reduzir', zera:'zerar', revisa:'revisar', acompanha:'acompanhar',
    controla:'controlar', mantem:'manter', 'mantém':'manter', faz:'fazer', entrega:'entregar'
  };
  function itemComoAcao(t) {
    t = String(t || '').trim();
    const m = t.match(/^([A-Za-zÀ-ÖØ-öø-ÿ]+)(\s|$)/);
    if (m) {
      const inf = VERBO_INFINITIVO[m[1].toLowerCase()];
      if (inf) t = inf.charAt(0).toUpperCase() + inf.slice(1) + t.slice(m[1].length);
    }
    return t;
  }

  /* ======================================================================
     Gerador LOCAL do registro do encontro (sem IA externa).
     Monta um texto corrido a partir do que foi digitado nos passos 1 a 10:
     organiza em seções, numera listas, resume evidências e competências e
     omite o que ficou vazio. O texto nasce editável na etapa Fechamento.
     ====================================================================== */
  function gerarRegistro(dados, c, enc) {
    const r = dados.roteiro || {};
    const L = [];
    const limpa = t => String(t || '').replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean).join('\n');
    const umaLinha = t => limpa(t).replace(/\n+/g, ' ');
    const frase = t => {
      t = String(t || '').trim();
      if (!t) return '';
      t = t.charAt(0).toUpperCase() + t.slice(1);
      return /[.!?…:)]$/.test(t) ? t : t + '.';
    };
    const secao = (titulo, corpo) => { if (corpo) { L.push(titulo); L.push(corpo); L.push(''); } };

    L.push('REGISTRO DO ONE A ONE — ' + (c ? c.nome : 'Colaborador'));
    L.push(u.fmtDateLong(enc.data) + ' · Período: ' + u.fmtDate(enc.periodoInicio) + ' a ' + u.fmtDate(enc.periodoFim || enc.data));
    L.push('');

    secao('COMO ESTÁ', limpa(r.comoEsta));
    secao('CONQUISTAS DO PERÍODO', limpa(r.conquistas));
    secao('DIFICULDADES', limpa(r.dificuldades));

    const a = r.autoavaliacao || {};
    const rotAuto = { fezBem: 'Fez bem', poderiaMelhor: 'Poderia ter feito melhor', dificuldade: 'Maior dificuldade', apoio: 'Apoio que pediu' };
    const linhasAuto = Object.keys(rotAuto).filter(k => String(a[k] || '').trim())
      .map(k => '- ' + rotAuto[k] + ': ' + frase(umaLinha(a[k])));
    secao('AUTOAVALIAÇÃO', linhasAuto.join('\n'));

    const qx = (r.perguntasExtras || []).filter(q => q.resposta);
    secao('PERGUNTAS DO ENCONTRO', qx.map(q =>
      '- ' + frase(umaLinha(q.pergunta)) + '\n  Resposta: ' + frase(umaLinha(q.resposta))).join('\n'));

    const obsD = (dados.observacoesDiscutidas || []).map(id => db.observacoes.por(id)).filter(Boolean);
    const nFb = (dados.feedbacksDiscutidos || []).length;
    if (obsD.length || nFb) {
      let pos = 0, neg = 0;
      obsD.forEach(o => { const pol = cat.tipoObs(o.tipo).pol; if (pol > 0) pos++; else if (pol < 0) neg++; });
      const outras = obsD.length - pos - neg;
      const partes = [];
      if (pos) partes.push(pos + (pos > 1 ? ' reconhecimentos' : ' reconhecimento'));
      if (neg) partes.push(neg + (neg > 1 ? ' pontos de atenção' : ' ponto de atenção'));
      if (outras) partes.push(outras + (outras > 1 ? ' outras observações' : ' outra observação'));
      if (nFb) partes.push(nFb + (nFb > 1 ? ' feedbacks formais' : ' feedback formal'));
      secao('EVIDÊNCIAS TRABALHADAS',
        'Foram discutidas ' + (obsD.length + nFb) + ' evidências do período: ' + partes.join(', ') + '.');
    }

    const comps = dados.competencias || {};
    const av = cat.COMPETENCIAS.filter(x => comps[x.id] && comps[x.id].nota);
    if (av.length) {
      const media = av.reduce((s, x) => s + comps[x.id].nota, 0) / av.length;
      const grupo = (min, max) => av.filter(x => comps[x.id].nota >= min && comps[x.id].nota <= max).map(x => x.label).join(', ');
      const lc = ['Média ' + media.toFixed(1).replace('.', ',') + '/5.'];
      const fortes = grupo(4, 5), meio = grupo(3, 3), fracas = grupo(1, 2);
      if (fortes) lc.push('- Pontos fortes (4–5): ' + fortes + '.');
      if (meio) lc.push('- Intermediárias (3): ' + meio + '.');
      if (fracas) lc.push('- A desenvolver (1–2): ' + fracas + '.');
      secao('COMPETÊNCIAS', lc.join('\n'));
    }

    const listaNum = arr => (arr || []).map((t, i) => (i + 1) + ') ' + frase(itemComoAcao(umaLinha(t)))).join('\n');
    secao('PONTOS POSITIVOS', listaNum(r.positivos));
    secao('PONTOS DE DESENVOLVIMENTO', listaNum(r.desenvolver));
    secao('COMPROMISSOS', listaNum(r.compromissos));
    secao('FECHAMENTO', limpa(r.fechamento));

    return corrigirTexto(L.join('\n').trim());
  }

  /* ======================================================================
     Exibicao formatada do registro na leitura do encontro concluido.
     O texto salvo continua puro; aqui ele vira HTML: titulos de secao com
     icone, rotulos em negrito, itens numerados e respostas recuadas.
     ====================================================================== */
  /* icone + tom de cor de cada secao (tons casam com os tokens do tema) */
  const REG_SECOES = {
    'COMO ESTÁ':                 { ico: '💬', tom: 'info' },
    'CONQUISTAS':                { ico: '🏆', tom: 'ok' },
    'DIFICULDADES':              { ico: '🚧', tom: 'warn' },
    'AUTOAVALIAÇÃO':             { ico: '🪞', tom: 'purple' },
    'PERGUNTAS':                 { ico: '❓', tom: 'accent' },
    'EVIDÊNCIAS':                { ico: '📌', tom: 'pink' },
    'COMPETÊNCIAS':              { ico: '📊', tom: 'brand' },
    'PONTOS POSITIVOS':          { ico: '⭐', tom: 'ok' },
    'PONTOS DE DESENVOLVIMENTO': { ico: '📈', tom: 'warn' },
    'COMPROMISSOS':              { ico: '🎯', tom: 'brand' },
    'FECHAMENTO':                { ico: '🤝', tom: 'accent' }
  };
  function regSecao(titulo) {
    const k = Object.keys(REG_SECOES).find(k => titulo.indexOf(k) === 0);
    return k ? REG_SECOES[k] : { ico: '📄', tom: 'brand' };
  }
  /* "Rotulo: resto" -> <b>Rotulo:</b> resto (rotulo curto, sem pontuacao) */
  function regRotulo(l) {
    const m = l.match(/^([^:]{2,42}):\s*(.*)$/);
    if (m && !/[.!?…]/.test(m[1])) return '<b>' + u.esc(m[1]) + ':</b> ' + u.esc(m[2]);
    return u.esc(l);
  }
  function renderRegistro(texto) {
    const linhas = String(texto || '').replace(/\r/g, '').split('\n');
    let h = '', secAberta = false;
    const fechaSec = () => { if (secAberta) { h += '</div>'; secAberta = false; } };

    linhas.forEach((l, i) => {
      const t = l.trim();
      if (!t) return;
      if (i === 0 && /^REGISTRO DO ONE A ONE/i.test(t)) {
        const nome = (t.split('—')[1] || '').trim();
        h += '<div class="reg-head"><div class="reg-head__t">Registro do One a One</div>'
          + '<div class="reg-head__nome">' + u.esc(nome) + '</div>';
        return;
      }
      if (i === 1 && h.indexOf('reg-head') >= 0) { h += '<div class="reg-head__sub">' + u.esc(t) + '</div></div>'; return; }
      if (t.length <= 48 && /^[A-ZÀ-ÖØ-Þ0-9 ()\/–—-]+$/.test(t) && /[A-ZÀ-ÖØ-Þ]{3}/.test(t)) {
        fechaSec();
        const s = regSecao(t);
        h += '<div class="reg-sec reg-sec--' + s.tom + '"><div class="reg-sec__h">'
          + '<span class="reg-sec__ico">' + s.ico + '</span>' + u.esc(t) + '</div>';
        secAberta = true;
        return;
      }
      if (/^\s+Resposta:/.test(l)) {
        h += '<div class="reg-resp"><b>↳ Resposta:</b> ' + u.esc(t.replace(/^Resposta:\s*/, '')) + '</div>';
        return;
      }
      const n = t.match(/^(\d+)\)\s*(.*)$/);
      if (n) { h += '<div class="reg-num"><span class="reg-num__n">' + n[1] + '</span><span>' + regRotulo(n[2]) + '</span></div>'; return; }
      if (/^- /.test(t)) { h += '<div class="reg-li"><span>' + regRotulo(t.slice(2)) + '</span></div>'; return; }
      h += '<div class="reg-p">' + regRotulo(t) + '</div>';
    });
    fechaSec();
    return h;
  }

  function copiarAta(enc, c) {
    const r = enc.roteiro || {};
    /* Quando o registro automatico existe, ele E a ata — ja nasce curado. */
    if (String(r.registro || '').trim()) {
      u.copiar(r.registro.trim()).then(() => App.toast.ok('Ata copiada'));
      return;
    }
    const L = [];
    L.push('ATA DE ONE A ONE — ' + (c ? c.nome : ''));
    L.push(u.fmtDateLong(enc.data) + (enc.duracaoMin ? ' · ' + enc.duracaoMin + ' minutos' : ''));
    L.push('Período coberto: ' + u.fmtDate(enc.periodoInicio) + ' a ' + u.fmtDate(enc.periodoFim || enc.data));
    L.push('');
    if (r.comoEsta) { L.push('1. COMO VOCÊ ESTÁ?'); L.push(r.comoEsta); L.push(''); }
    if (r.conquistas) { L.push('2. PRINCIPAIS CONQUISTAS'); L.push(r.conquistas); L.push(''); }
    if (r.dificuldades) { L.push('3. PRINCIPAIS DIFICULDADES'); L.push(r.dificuldades); L.push(''); }
    const a = r.autoavaliacao || {};
    const qx = (r.perguntasExtras || []).filter(q => q.resposta);
    if (Object.keys(a).some(k => a[k]) || qx.length) {
      L.push('4. AUTOAVALIAÇÃO');
      cat.PERGUNTAS_AUTO.forEach(q => { if (a[q.id]) { L.push('- ' + q.label); L.push('  ' + a[q.id]); } });
      qx.forEach(q => { L.push('- ' + q.pergunta); L.push('  ' + q.resposta); });
      L.push('');
    }
    const comps = enc.competencias || {};
    const av = cat.COMPETENCIAS.filter(x => comps[x.id] && comps[x.id].nota);
    if (av.length) {
      L.push('6. COMPETÊNCIAS');
      av.forEach(x => L.push('- ' + x.label + ': ' + comps[x.id].nota + '/5' + (comps[x.id].comentario ? ' — ' + comps[x.id].comentario : '')));
      L.push('');
    }
    if ((r.positivos || []).length) { L.push('7. PONTOS POSITIVOS'); r.positivos.forEach(t => L.push('- ' + t)); L.push(''); }
    if ((r.desenvolver || []).length) { L.push('8. PONTOS DE DESENVOLVIMENTO'); r.desenvolver.forEach(t => L.push('- ' + t)); L.push(''); }
    if ((r.compromissos || []).length) { L.push('9. COMPROMISSOS'); r.compromissos.forEach(t => L.push('- ' + t)); L.push(''); }
    if (r.fechamento) { L.push('10. FECHAMENTO'); L.push(r.fechamento); }

    u.copiar(L.join('\n')).then(() => App.toast.ok('Ata copiada'));
  }

  /* ======================================================================
     Editar as competencias de um encontro JA CONCLUIDO.

     Existe porque a avaliacao costuma amadurecer depois da conversa — e
     porque um encontro pode ter sido fechado sem avaliar nada. As notas
     do ultimo encontro concluido sao o que A.competenciasAtuais devolve,
     entao corrigir aqui corrige o perfil, o delta e o confronto junto.
     ====================================================================== */
  function editarCompetencias(enc, c) {
    const atuais = Object.assign({}, enc.competencias || {});
    /* A referencia e a avaliacao ANTERIOR a este encontro, para o coordenador
       ver de onde veio a nota — nao a atual, que e a que ele esta editando. */
    const anteriores = A.competenciasAtuais(enc.colaboradorId, enc.id);

    const corpo = u.el('div.u-col.u-gap-2');
    corpo.appendChild(u.el('div.note.u-mb-2', {
      text: 'Avalie de 1 a 5 e justifique com um fato observado. Sem justificativa, a nota vira opinião.'
    }));

    cat.COMPETENCIAS.forEach(comp => {
      const v = atuais[comp.id] || {};
      const ant = anteriores[comp.id];

      const linha = u.el('div.comp-row');
      linha.appendChild(u.el('div', {}, [
        u.el('div.comp-row__name', { text: comp.label }),
        ant ? u.el('div.t-xs.t-muted2', { text: 'Antes: ' + ant.nota + '/5' }) : null
      ]));
      linha.appendChild(p.rating(v.nota || null, nota => {
        atuais[comp.id] = Object.assign({}, atuais[comp.id], { nota: nota });
      }, { permiteLimpar: true }));

      const cmt = u.el('input.input.input--sm', {
        type: 'text', placeholder: 'Justificativa / evidência'
      });
      cmt.value = v.comentario || '';
      cmt.addEventListener('input', () => {
        atuais[comp.id] = Object.assign({}, atuais[comp.id], { comentario: cmt.value });
      });
      cmt.addEventListener('blur', () => {
        const vc = corrigirTexto(cmt.value);
        if (vc !== cmt.value) { cmt.value = vc; atuais[comp.id] = Object.assign({}, atuais[comp.id], { comentario: vc }); }
      });
      linha.appendChild(u.el('div.comp-row__cmt', {}, [cmt]));
      corpo.appendChild(linha);
    });

    App.modal.abrir({
      titulo: 'Competências de ' + u.primeiroNome(c ? c.nome : ''),
      desc: 'Encontro de ' + u.fmtDate(enc.data) + '. O que você mudar aqui vale como a avaliação vigente.',
      icone: 'chart', tamanho: 'lg', corpo: corpo,
      acoes: [
        { label: 'Cancelar', tipo: 'ghost' },
        { label: 'Salvar', tipo: 'primary', icone: 'check', onClick: () => {
            /* Nota limpa some do registro: guardar {comentario} sem nota
               faria a competencia contar como avaliada nas telas. */
            const limpo = {};
            Object.keys(atuais).forEach(k => {
              const x = atuais[k];
              if (x && x.nota) limpo[k] = x;
            });
            return db.oneones.atualizar(enc.id, { competencias: limpo }).then(() => {
              App.toast.ok('Competências atualizadas',
                u.plural(Object.keys(limpo).length, 'competência avaliada', 'competências avaliadas'));
              App.recarregarTela();
              return true;
            }).catch(e => { App.toast.erro('Não foi possível salvar', e.message); return false; });
          } }
      ]
    });
  }

  App.pages = App.pages || {};
  App.pages.sessao = { render, titulo: 'One a One' };
})(window.App);
