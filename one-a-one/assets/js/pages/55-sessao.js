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
      positivos: [], desenvolver: [], compromissos: [], fechamento: ''
    }, dados.roteiro || {});
    dados.competencias = dados.competencias || {};
    dados.observacoesDiscutidas = dados.observacoesDiscutidas || [];
    dados.feedbacksDiscutidos = dados.feedbacksDiscutidos || [];

    const box = u.el('div.view__inner');
    const salvoEl = u.el('span.t-xs.t-muted2', { text: 'Salvo automaticamente' });

    const salvar = u.debounce(() => {
      db.oneones.atualizar(enc.id, {
        roteiro: dados.roteiro,
        competencias: dados.competencias,
        observacoesDiscutidas: dados.observacoesDiscutidas,
        feedbacksDiscutidos: dados.feedbacksDiscutidos
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
      return ta;
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
        cat.PERGUNTAS_AUTO.forEach(q => {
          body.appendChild(u.el('div.u-mb-4', {}, [
            p.campo(q.label, areaTexto(dados.roteiro.autoavaliacao[q.id], 'Resposta do colaborador...',
              v => { dados.roteiro.autoavaliacao[q.id] = v; }, 3))
          ]));
        });
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

        body.appendChild(u.el('div.note.note--brand.u-mb-4', {
          text: 'Marque o que será discutido nesta conversa. O que você marcar fica registrado no encontro como evidência tratada.'
        }));

        if (obs.length) {
          body.appendChild(u.el('div.t-up.u-mb-2', { text: u.plural(obs.length, 'observação no período', 'observações no período') }));
          const lista = u.el('div.u-col.u-gap-2.u-mb-5');
          obs.forEach(o => lista.appendChild(itemSelecionavel(
            o.id, dados.observacoesDiscutidas,
            cat.tipoObs(o.tipo).emoji + ' ' + cat.tipoObs(o.tipo).label + ' · ' + u.fmtDate(o.data) + ' · ' + cat.contexto(o.contexto).label,
            o.texto)));
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
          text: 'Avalie de 1 a 5 e justifique com um fato observado. Sem justificativa, a nota vira opinião.'
        }));
        cat.COMPETENCIAS.forEach(comp => {
          const atual = dados.competencias[comp.id] || {};
          const ant = anterior[comp.id];

          const linha = u.el('div.comp-row');
          linha.appendChild(u.el('div', {}, [
            u.el('div.comp-row__name', { text: comp.label }),
            ant ? u.el('div.t-xs.t-muted2', { text: 'Última avaliação: ' + ant.nota + '/5 em ' + u.fmtDate(ant.data) }) : null
          ]));
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
          linha.appendChild(u.el('div.comp-row__cmt', {}, [cmt]));
          body.appendChild(linha);
        });
      },

      positivos(body) {
        body.appendChild(listaComSync(dados.roteiro.positivos, 'Ex.: sustentou valor na negociação da Vitória Log', salvar, pintarNav));
      },

      desenvolver(body) {
        body.appendChild(listaComSync(dados.roteiro.desenvolver, 'Ex.: cadência de follow-up no CRM', salvar, pintarNav));
      },

      compromissos(body) {
        body.appendChild(u.el('div.note.note--brand.u-mb-4', {
          text: 'Cada compromisso pode virar um plano de ação com prazo e indicador ao concluir o encontro.'
        }));
        body.appendChild(listaComSync(dados.roteiro.compromissos, 'Ex.: zerar oportunidades sem toque há mais de 7 dias', salvar, pintarNav));

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
        body.appendChild(areaTexto(dados.roteiro.fechamento,
          'Alinhamento final: o que ficou combinado, o que você vai acompanhar e quando vocês se falam de novo.',
          v => { dados.roteiro.fechamento = v; }));

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

        body.appendChild(u.el('button.btn.btn--lg.btn--ok.btn--block.u-mt-5', {
          type: 'button', html: App.icon('check') + '<span>Concluir One a One</span>',
          onclick: () => concluir(enc, dados, c)
        }));
      }
    };

    function itemSelecionavel(id, arr, titulo, texto) {
      const on = arr.indexOf(id) >= 0;
      const node = u.el('button.pick-item' + (on ? '.is-on' : ''), {
        type: 'button',
        onclick: () => {
          const i = arr.indexOf(id);
          if (i >= 0) arr.splice(i, 1); else arr.push(id);
          node.classList.toggle('is-on', arr.indexOf(id) >= 0);
          salvar(); pintarNav();
        }
      }, [
        u.el('span.pick-item__box', { html: App.icon('check') }),
        u.el('div.u-grow', { style: { minWidth: 0 } }, [
          u.el('div.t-xs.t-muted2', { style: { marginBottom: '3px' }, text: titulo }),
          u.el('div.t-md.u-pre', { style: { color: 'var(--text-2)' }, text: texto })
        ])
      ]);
      return node;
    }

    pintarNav(); pintarPainel();
    stage.appendChild(navCard);
    stage.appendChild(painel);
    box.appendChild(stage);

    u.clear(view);
    view.appendChild(box);
  }

  function listaComSync(arr, ph, salvar, pintarNav) {
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
      const v = inp.value.trim();
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

            return db.oneones.atualizar(enc.id, patch)
              .then(() => Promise.all(marcados.map(txt => db.planos.criar({
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
                  (marcados.length ? u.plural(marcados.length, 'plano criado', 'planos criados') + ' · ' : '') +
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
    add(secaoTexto('1. Como você está?', r.comoEsta));
    add(secaoTexto('2. Principais conquistas', r.conquistas));
    add(secaoTexto('3. Principais dificuldades', r.dificuldades));

    const auto = r.autoavaliacao || {};
    if (Object.keys(auto).some(k => auto[k])) {
      const b = u.el('div.card__body.u-col.u-gap-4');
      cat.PERGUNTAS_AUTO.forEach(q => {
        if (!auto[q.id]) return;
        b.appendChild(u.el('div', {}, [
          u.el('div.t-up.u-mb-2', { text: q.label }),
          u.el('div.t-md.u-pre', { style: { color: 'var(--text-2)' }, text: auto[q.id] })
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
    if (avaliadas.length) {
      const b = u.el('div.card__body');
      b.appendChild(g.radar({
        eixos: cat.COMPETENCIAS.map(x => x.label.split(' ')[0]),
        series: [{ label: 'Avaliação', valores: cat.COMPETENCIAS.map(x => (comps[x.id] && comps[x.id].nota) || 0) }]
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
      b.appendChild(l);
      lat.appendChild(u.el('div.card', {}, [
        u.el('div.card__head', {}, [u.el('div.card__title', { text: '6. Competências' })]), b
      ]));
    }

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

  function copiarAta(enc, c) {
    const r = enc.roteiro || {};
    const L = [];
    L.push('ATA DE ONE A ONE — ' + (c ? c.nome : ''));
    L.push(u.fmtDateLong(enc.data) + (enc.duracaoMin ? ' · ' + enc.duracaoMin + ' minutos' : ''));
    L.push('Período coberto: ' + u.fmtDate(enc.periodoInicio) + ' a ' + u.fmtDate(enc.periodoFim || enc.data));
    L.push('');
    if (r.comoEsta) { L.push('1. COMO VOCÊ ESTÁ?'); L.push(r.comoEsta); L.push(''); }
    if (r.conquistas) { L.push('2. PRINCIPAIS CONQUISTAS'); L.push(r.conquistas); L.push(''); }
    if (r.dificuldades) { L.push('3. PRINCIPAIS DIFICULDADES'); L.push(r.dificuldades); L.push(''); }
    const a = r.autoavaliacao || {};
    if (Object.keys(a).some(k => a[k])) {
      L.push('4. AUTOAVALIAÇÃO');
      cat.PERGUNTAS_AUTO.forEach(q => { if (a[q.id]) { L.push('- ' + q.label); L.push('  ' + a[q.id]); } });
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

  App.pages = App.pages || {};
  App.pages.sessao = { render, titulo: 'One a One' };
})(window.App);
