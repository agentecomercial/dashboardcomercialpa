/* =========================================================================
   components/31-partes.js — Pecas de interface reaproveitadas nas telas.
   Tudo aqui devolve Element (ou string HTML quando o nome termina em Html).
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, cat = App.cat, db = App.db;
  const P = {};

  /* ------------------------------ Avatar ------------------------------ */
  P.avatarHtml = function (colab, tam, comStatus) {
    if (!colab) return '<span class="avatar avatar--' + (tam || 'md') + '" style="background:#94a3b8">?</span>';
    const cor = colab.cor || u.corPorTexto(colab.nome);
    const inner = colab.foto
      ? '<img src="' + u.esc(colab.foto) + '" alt="' + u.esc(colab.nome) + '">'
      : u.esc(u.iniciais(colab.nome));
    const st = comStatus
      ? '<i class="avatar__status' + (colab.status === 'inativo' ? ' avatar__status--off' : '') + '"></i>' : '';
    return '<span class="avatar avatar--' + (tam || 'md') + '" style="background:' + cor + '" title="' +
      u.esc(colab.nome) + '">' + inner + st + '</span>';
  };
  P.avatar = function (colab, tam, comStatus) {
    const s = u.el('span');
    s.innerHTML = P.avatarHtml(colab, tam, comStatus);
    return s.firstChild;
  };

  /* ------------------------------ Badges ------------------------------ */
  P.badgeTipoObs = function (tipoId, comEmoji) {
    const t = cat.tipoObs(tipoId);
    const b = u.el('span.badge.badge--' + (t.tom === 'neutral' ? 'outline' : t.tom));
    b.textContent = (comEmoji === false ? '' : t.emoji + ' ') + t.label;
    return b;
  };
  P.badgeImpacto = function (id) {
    const i = cat.impacto(id);
    const b = u.el('span.badge' + (i.id === 'alto' ? '.badge--danger' : i.id === 'medio' ? '.badge--warn' : '.badge--outline'));
    b.textContent = 'Impacto ' + i.label.toLowerCase();
    return b;
  };
  P.badgeStatusPlano = function (id) {
    const s = cat.statusPlano(id);
    const b = u.el('span.badge.badge--' + (s.tom === 'neutral' ? 'outline' : s.tom));
    b.textContent = s.label;
    return b;
  };
  P.badgeClassif = function (id) {
    const c = cat.classif(id);
    const b = u.el('span.badge.badge--' + (c.tom === 'neutral' ? 'outline' : c.tom));
    b.textContent = c.emoji + ' ' + c.label;
    return b;
  };
  P.badge1a1 = function (colab) {
    const s = App.analise.situacao1a1(colab);
    const mapa = {
      atrasado: ['danger', 'Atrasado ' + Math.abs(s.dias) + 'd'],
      hoje:     ['warn',   'É hoje'],
      proximo:  ['info',   'Em ' + s.dias + 'd'],
      agendado: ['outline', u.fmtDate(s.proximo, false)],
      sem_data: ['outline', 'Sem data']
    };
    const [tom, txt] = mapa[s.estado] || mapa.sem_data;
    const b = u.el('span.badge.badge--' + tom);
    b.textContent = txt;
    return b;
  };

  /* --------------------------- Faixa de demonstracao --------------------------- */
  /** Marca visivelmente que a tela mostra material de exemplo, nao a operacao. */
  P.faixaExemplo = function (texto) {
    return u.el('div.note.note--warn.u-mb-4.u-row.u-gap-3', { style: { alignItems: 'center' } }, [
      u.el('span', { html: App.icon('sparkles') }),
      u.el('span.u-grow', {
        text: texto || 'Registro de demonstração — não entra na Equipe, no Dashboard nem nos Indicadores.'
      }),
      u.el('button.btn.btn--xs.btn--outline.u-nowrap', {
        type: 'button', text: 'Voltar aos exemplos',
        onclick: () => App.router.go('/config/exemplos')
      })
    ]);
  };

  /* --------------------------- Estados vazios --------------------------- */
  P.vazio = function (cfg) {
    const box = u.el('div.empty', {}, [
      u.el('div.empty__art', { html: App.icon(cfg.icone || 'inbox') }),
      u.el('div.empty__title', { text: cfg.titulo || 'Nada por aqui ainda' }),
      cfg.desc ? u.el('div.empty__desc', { text: cfg.desc }) : null
    ]);
    if (cfg.acoes && cfg.acoes.length) {
      const cta = u.el('div.empty__cta');
      cfg.acoes.forEach(a => cta.appendChild(u.el('button.btn.btn--' + (a.tipo || 'primary'), {
        type: 'button',
        html: (a.icone ? App.icon(a.icone) : '') + '<span>' + u.esc(a.label) + '</span>',
        onclick: a.onClick
      })));
      box.appendChild(cta);
    }
    return box;
  };

  /* ----------------------------- Skeleton ----------------------------- */
  P.skeletonCards = function (n, altura) {
    const g = u.el('div.grid.grid-cards');
    for (let i = 0; i < (n || 3); i++) {
      g.appendChild(u.el('div.sk.sk--card', { style: altura ? { height: altura } : null }));
    }
    return g;
  };
  P.skeletonLinhas = function (n) {
    const g = u.el('div');
    g.appendChild(u.el('div.sk.sk--title'));
    for (let i = 0; i < (n || 4); i++) {
      g.appendChild(u.el('div.sk.sk--text', { style: { width: (60 + (i * 13) % 38) + '%' } }));
    }
    return g;
  };

  /* -------------------------- Cabecalho de secao -------------------------- */
  P.secao = function (titulo, direita, sub) {
    return u.el('div.u-between.u-mb-3', {}, [
      u.el('div', {}, [
        u.el('div', { class: 'card__title', text: titulo }),
        sub ? u.el('div.t-sm.t-muted.secao-sub', { text: sub }) : null
      ]),
      direita || null
    ]);
  };

  /* ------------------------------ KPI card ------------------------------ */
  /** { label, valor, icone, tom, rodape, onClick, tip } */
  P.kpi = function (c) {
    const node = u.el('div.kpi' + (c.onClick ? '.kpi--click' : ''), {
      onclick: c.onClick || null,
      'data-tip': c.tip || null,
      role: c.onClick ? 'button' : null,
      tabindex: c.onClick ? '0' : null,
      onkeydown: c.onClick ? (ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); c.onClick(ev); } }) : null
    }, [
      u.el('div.kpi__top', {}, [
        u.el('div.kpi__label', { text: c.label }),
        u.el('div.kpi__icon.tone-' + (c.tom || 'brand'), { html: App.icon(c.icone || 'chart') })
      ]),
      u.el('div.kpi__value', { text: c.valor }),
      c.rodape ? u.el('div.kpi__foot', { html: c.rodape }) : null
    ]);
    return node;
  };

  /* ---------------------------- Barra de meta ---------------------------- */
  P.barraMeta = function (pct, mostrarTexto) {
    const p = u.clamp(pct || 0, 0, 130);
    const classe = p >= 100 ? 'bar__fill--ok' : p >= 80 ? '' : p >= 50 ? 'bar__fill--warn' : 'bar__fill--danger';
    const box = u.el('div');
    if (mostrarTexto !== false) {
      box.appendChild(u.el('div.u-between.t-xs.t-muted.u-mb-2', {}, [
        u.el('span', { text: 'Meta' }),
        u.el('span', { class: 't-strong ' + (p >= 100 ? 't-ok' : p < 50 ? 't-danger' : ''), text: u.fmtPct(pct) })
      ]));
    }
    box.appendChild(u.el('div.bar', {}, [
      u.el('div.bar__fill' + (classe ? '.' + classe : ''), { style: { width: Math.min(100, p) + '%' } })
    ]));
    return box;
  };

  /* ---------------------------- Evidencias ---------------------------- */
  P.evidencia = function (ev, aoRemover) {
    const icone = ev.tipo === 'link' ? 'link' : (ev.mime && ev.mime.indexOf('image') === 0) ? 'image' : 'file';
    const conteudo = App.icon(icone) + '<span class="u-truncate">' + u.esc(ev.nome || 'Evidência') + '</span>';
    let node;
    if (ev.url && !aoRemover) {
      node = u.el('a.evi', { href: ev.url, target: '_blank', rel: 'noopener', html: conteudo });
    } else if (ev.dados && !aoRemover) {
      node = u.el('a.evi', {
        href: ev.dados, download: ev.nome || 'evidencia', html: conteudo,
        onclick: ev.mime && ev.mime.indexOf('image') === 0 ? (e => { e.preventDefault(); P.verImagem(ev); }) : null
      });
    } else {
      node = u.el('span.evi', { html: conteudo });
    }
    if (aoRemover) {
      node.appendChild(u.el('button.evi__x', {
        type: 'button', 'aria-label': 'Remover evidência',
        html: App.icon('x'), onclick: e => { e.preventDefault(); e.stopPropagation(); aoRemover(ev); }
      }));
    }
    return node;
  };

  P.verImagem = function (ev) {
    App.modal.abrir({
      titulo: ev.nome || 'Evidência', tamanho: 'lg',
      corpo: u.el('div', { style: { textAlign: 'center' } }, [
        u.el('img', { src: ev.dados || ev.url, alt: ev.nome || '', style: { maxHeight: '68vh', margin: '0 auto', borderRadius: 'var(--r-md)' } })
      ]),
      acoes: [{ label: 'Fechar', tipo: 'ghost' }]
    });
  };

  P.listaEvidencias = function (lista, aoRemover) {
    if (!lista || !lista.length) return null;
    const box = u.el('div.u-row.u-wrap.u-gap-2');
    lista.forEach(ev => box.appendChild(P.evidencia(ev, aoRemover)));
    return box;
  };

  /* -------------------------- Card de observacao -------------------------- */
  /** opts: { comColaborador, aoEditar, aoRemover, compacto } */
  P.cardObservacao = function (o, opts) {
    opts = opts || {};
    const t = cat.tipoObs(o.tipo);
    const colab = db.colaboradores.por(o.colaboradorId);
    const cores = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', info: 'var(--info)', purple: 'var(--purple)', brand: 'var(--brand-500)', neutral: 'var(--border-strong)' };

    const head = u.el('div.obs-card__head', {}, [
      u.el('span', { class: 'badge badge--' + (t.tom === 'neutral' ? 'outline' : t.tom), text: t.emoji + ' ' + t.label }),
      opts.comColaborador && colab
        ? u.el('button.u-row.u-gap-2', {
            type: 'button', style: { fontSize: 'var(--fs-sm)', fontWeight: '580' },
            onclick: () => App.router.go('/colaborador/' + colab.id),
            html: P.avatarHtml(colab, 'xs') + '<span>' + u.esc(u.primeiroNome(colab.nome)) + '</span>'
          })
        : null,
      u.el('span.u-grow'),
      u.el('span.tl__date', { text: u.fmtDateTime(o.data), 'data-tip': u.fmtRelativo(o.data) })
    ]);

    const card = u.el('div.obs-card', { style: { paddingLeft: '17px' } }, [
      u.el('div.obs-card__bar', { style: { background: cores[t.tom] || cores.neutral } }),
      head,
      u.el('div.obs-card__txt', { text: o.texto })
    ]);

    const foot = u.el('div.obs-card__foot', {}, [
      u.el('span', { text: cat.contexto(o.contexto).emoji + ' ' + cat.contexto(o.contexto).label }),
      u.el('span.dot-sep'),
      u.el('span', { text: 'Impacto ' + cat.impacto(o.impacto).label.toLowerCase() })
    ]);
    const evi = P.listaEvidencias(o.evidencias);
    if (evi) { foot.appendChild(u.el('span.dot-sep')); foot.appendChild(evi); }

    if (opts.aoEditar || opts.aoRemover) {
      foot.appendChild(u.el('span.u-grow'));
      const acoes = u.el('div.u-row.u-gap-1');
      if (opts.aoEditar) acoes.appendChild(u.el('button.btn.btn--xs.btn--ghost', {
        type: 'button', html: App.icon('edit') + '<span>Editar</span>', onclick: () => opts.aoEditar(o)
      }));
      if (opts.aoRemover) acoes.appendChild(u.el('button.btn.btn--xs.btn--ghost', {
        type: 'button', 'aria-label': 'Excluir', 'data-tip': 'Excluir observação',
        html: App.icon('trash'), onclick: () => opts.aoRemover(o)
      }));
      foot.appendChild(acoes);
    }
    card.appendChild(foot);
    return card;
  };

  /* --------------------------- Card de feedback --------------------------- */
  P.cardFeedback = function (f, opts) {
    opts = opts || {};
    const c = cat.classif(f.classificacao);
    const colab = db.colaboradores.por(f.colaboradorId);

    const linha = (rot, txt, icone) => txt ? u.el('div.u-mt-3', {}, [
      u.el('div.t-up.u-row.u-gap-2', {}, [u.el('span', { html: App.icon(icone) }), u.el('span', { text: rot })]),
      u.el('div.t-md.u-pre', { style: { color: 'var(--text-2)', marginTop: '3px', lineHeight: '1.55' }, text: txt })
    ]) : null;

    const card = u.el('div.card.card--pad-sm', {}, [
      u.el('div.u-row.u-wrap.u-gap-2', {}, [
        P.badgeClassif(f.classificacao),
        opts.comColaborador && colab
          ? u.el('button.u-row.u-gap-2', {
              type: 'button', style: { fontSize: 'var(--fs-sm)', fontWeight: '580' },
              onclick: () => App.router.go('/colaborador/' + colab.id),
              html: P.avatarHtml(colab, 'xs') + '<span>' + u.esc(u.primeiroNome(colab.nome)) + '</span>'
            }) : null,
        u.el('span.u-grow'),
        u.el('span.tl__date', { text: u.fmtDate(f.data) })
      ]),
      linha('O que aconteceu', f.oQueAconteceu, 'eye'),
      linha('Qual foi o impacto', f.impacto, 'zap'),
      linha('O que deveria acontecer', f.oQueDeveria, 'target'),
      linha('Como vamos melhorar', f.comoMelhorar, 'trendUp')
    ]);

    const evi = P.listaEvidencias(f.evidencias);
    if (evi) card.appendChild(u.el('div.u-mt-3', {}, [evi]));

    if (opts.aoEditar || opts.aoRemover) {
      const acoes = u.el('div.u-row.u-gap-1.u-mt-3', { style: { justifyContent: 'flex-end' } });
      if (opts.aoEditar) acoes.appendChild(u.el('button.btn.btn--xs.btn--ghost', {
        type: 'button', html: App.icon('edit') + '<span>Editar</span>', onclick: () => opts.aoEditar(f)
      }));
      if (opts.aoRemover) acoes.appendChild(u.el('button.btn.btn--xs.btn--ghost', {
        type: 'button', 'data-tip': 'Excluir feedback', html: App.icon('trash'), onclick: () => opts.aoRemover(f)
      }));
      card.appendChild(acoes);
    }
    return card;
  };

  /* ----------------------------- Card de plano ----------------------------- */
  P.cardPlano = function (p, opts) {
    opts = opts || {};
    const st = db.planos.statusEfetivo(p);
    const colab = db.colaboradores.por(p.colaboradorId);
    const dias = p.prazo ? u.daysUntil(p.prazo) : null;

    return u.el('div.kb-card', {
      onclick: () => (opts.aoAbrir ? opts.aoAbrir(p) : App.planoModal.abrir({ plano: p }))
    }, [
      u.el('div.kb-card__t', { text: p.ponto || p.acao }),
      p.acao && p.ponto ? u.el('div.t-sm.t-muted.u-clamp-2', { style: { marginTop: '4px' }, text: p.acao }) : null,
      u.el('div.kb-card__m', {}, [
        opts.comColaborador && colab ? u.el('span', { html: P.avatarHtml(colab, 'xs') }) : null,
        opts.comColaborador && colab ? u.el('span', { text: u.primeiroNome(colab.nome) }) : null,
        opts.comColaborador && colab ? u.el('span.dot-sep') : null,
        u.el('span', {
          class: st === 'atrasado' ? 't-danger t-strong' : (dias !== null && dias <= 3 && st !== 'concluido' ? 't-warn t-strong' : ''),
          text: p.prazo ? (st === 'concluido' ? 'Concluído ' + u.fmtDate(p.concluidoEm || p.prazo, false)
                : st === 'atrasado' ? 'Venceu ' + u.fmtDate(p.prazo, false)
                : 'Prazo ' + u.fmtDate(p.prazo, false)) : 'Sem prazo'
        })
      ])
    ]);
  };

  /* ------------------------------ Timeline ------------------------------ */
  /** eventos vindos de App.analise.timeline */
  P.timeline = function (eventos, opts) {
    opts = opts || {};
    if (!eventos.length) {
      return P.vazio({
        icone: 'history', titulo: 'Nenhum evento neste filtro',
        desc: 'Troque o filtro acima ou registre uma nova observação para começar a construir o histórico.',
        acoes: opts.acoesVazio || null
      });
    }
    const tl = u.el('div.tl');
    eventos.forEach((e, i) => {
      const item = u.el('div.tl__item', { style: { animationDelay: Math.min(i * 30, 400) + 'ms' } });
      item.appendChild(u.el('div.tl__dot', { text: e.emoji }));

      const card = u.el('div.tl__card' + (opts.aoClicar ? '.tl__card--click' : ''), {
        onclick: opts.aoClicar ? () => opts.aoClicar(e) : null
      });
      const meta = u.el('div.tl__meta', {}, [
        u.el('span', { class: 'badge badge--' + (e.tom === 'neutral' ? 'outline' : e.tom), text: e.titulo }),
        u.el('span.tl__date', { text: u.fmtDate(e.data) + ' · ' + u.fmtRelativo(e.data) })
      ]);
      card.appendChild(meta);
      card.appendChild(u.el('div.t-md.u-pre', { style: { color: 'var(--text-2)', lineHeight: '1.55' }, text: e.texto || '' }));
      if (e.meta && e.meta.length) {
        card.appendChild(u.el('div.u-row.u-wrap.u-gap-2.u-mt-2', {},
          e.meta.map(m => u.el('span.t-xs.t-muted2', { text: m }))));
      }
      const evi = P.listaEvidencias(e.evidencias);
      if (evi) card.appendChild(u.el('div.u-mt-2', {}, [evi]));
      item.appendChild(card);
      tl.appendChild(item);
    });
    return tl;
  };

  /* --------------------------- Filtros de timeline --------------------------- */
  P.filtrosTimeline = function (ativo, aoTrocar, contagens) {
    const box = u.el('div.u-row.u-wrap.u-gap-2');
    cat.TIPOS_TIMELINE.forEach(t => {
      const n = contagens ? contagens[t.id] : null;
      box.appendChild(u.el('button.chip' + (ativo === t.id ? '.is-on' : ''), {
        type: 'button',
        text: t.label + (n !== null && n !== undefined ? ' · ' + n : ''),
        onclick: () => aoTrocar(t.id)
      }));
    });
    return box;
  };

  /* -------------------------- Data com aviso de dia util ------------------------- */
  /**
   * Campo de data que avisa quando o dia nao e util e oferece o ajuste em um
   * clique — sem impedir a escolha manual. Devolve { el, input, valor() }.
   */
  P.campoDataUtil = function (valor, opts) {
    opts = opts || {};
    const inp = u.el('input.input', { type: 'date', value: valor || '' });
    const aviso = u.el('div');
    const wrap = u.el('div', {}, [inp, aviso]);

    /* Só fica true quando o coordenador confirma no botão "Manter".
       Sem essa confirmação, o salvamento desloca para o dia útil: a regra
       é que o sistema NUNCA agende em fim de semana ou feriado sozinho. */
    let manterManual = false;

    function ir(destino) {
      inp.value = destino;
      manterManual = false;
      pintar();
      if (opts.onChange) opts.onChange(destino);
    }

    function pintar() {
      u.clear(aviso);
      const v = inp.value;
      if (!v) return;
      const motivo = App.cal.motivo(v);
      if (!motivo) return;

      const antes = u.toISODate(App.cal.utilAnterior(u.addDays(v, -1)));
      const depois = u.toISODate(App.cal.proximoUtil(v));

      aviso.appendChild(u.el('div.note.u-mt-2', {
        class: manterManual ? 'note--brand' : 'note--warn'
      }, [
        u.el('div.u-row.u-gap-2', { style: { alignItems: 'flex-start' } }, [
          u.el('span', { html: App.icon(manterManual ? 'checkCircle' : 'alert') }),
          u.el('span.t-sm.u-grow', {
            text: manterManual
              ? motivo + ' — mantido por sua escolha. Será salvo exatamente nesta data.'
              : motivo + ' — dia não útil. Ao salvar, será movido para ' + u.fmtDiaCurto(depois) + '.'
          })
        ]),
        u.el('div.u-row.u-gap-2.u-wrap.u-mt-2', {}, [
          u.el('button.btn.btn--xs.btn--outline', {
            type: 'button', text: 'Antecipar · ' + u.fmtDiaCurto(antes), onclick: () => ir(antes)
          }),
          u.el('button.btn.btn--xs.btn--outline', {
            type: 'button', text: 'Adiar · ' + u.fmtDiaCurto(depois), onclick: () => ir(depois)
          }),
          u.el('button.btn.btn--xs' + (manterManual ? '.btn--soft' : '.btn--ghost'), {
            type: 'button',
            text: manterManual ? '✓ Mantendo nesta data' : 'Manter nesta data mesmo assim',
            onclick: () => { manterManual = !manterManual; pintar(); }
          })
        ])
      ]));
    }

    inp.addEventListener('change', () => {
      manterManual = false;                 // data nova volta a seguir a regra
      pintar();
      if (opts.onChange) opts.onChange(inp.value);
    });
    pintar();

    return {
      el: wrap,
      input: inp,
      /** Valor cru do campo, sem aplicar a regra. */
      valor: () => inp.value,
      /** Valor a gravar: desloca para dia útil salvo confirmação explícita. */
      valorFinal() {
        const v = inp.value;
        if (!v || manterManual) return v;
        return App.cal.ehUtil(v) ? v : u.toISODate(App.cal.proximoUtil(v));
      },
      /** true quando o salvamento deslocou a data. */
      foiAjustado() {
        const v = inp.value;
        return !!v && !manterManual && !App.cal.ehUtil(v);
      },
      manual: () => manterManual,
      repintar: pintar
    };
  };

  /* ------------------------- Seletor de colaborador ------------------------- */
  P.selectColaborador = function (valor, opts) {
    opts = opts || {};
    const sel = u.el('select.select', { name: opts.name || 'colaboradorId' });
    if (opts.vazio !== false) sel.appendChild(u.el('option', { value: '', text: opts.vazio || 'Todos os colaboradores' }));
    db.colaboradores.todosOrdenados().forEach(c => {
      if (opts.somenteAtivos && c.status === 'inativo') return;
      sel.appendChild(u.el('option', {
        value: c.id, text: c.nome + (c.status === 'inativo' ? ' (inativo)' : ''),
        selected: c.id === valor ? true : null
      }));
    });
    if (valor) sel.value = valor;
    if (opts.onChange) sel.addEventListener('change', () => opts.onChange(sel.value));
    return sel;
  };

  /* ------------------------------ Campo ------------------------------ */
  /** campo('Nome', inputEl, {hint, obrigatorio, erro}) */
  P.campo = function (rotulo, controle, opts) {
    opts = opts || {};
    const f = u.el('div.field', {}, [
      rotulo ? u.el('label.field__label', {}, [
        u.el('span', { text: rotulo }),
        opts.obrigatorio ? u.el('span.req', { text: '*' }) : null,
        opts.dica ? u.el('span', { 'data-tip': opts.dica, class: 't-muted2', html: App.icon('info', '', 13) }) : null
      ]) : null,
      controle,
      opts.hint ? u.el('div.field__hint', { text: opts.hint }) : null,
      u.el('div.field__err', { text: opts.erro || 'Campo obrigatório.' })
    ]);
    const lbl = f.querySelector('label');
    if (lbl && controle.id) lbl.setAttribute('for', controle.id);
    return f;
  };

  /* -------------------------- Grupo de escolhas -------------------------- */
  /** escolhas(lista, valorAtual, aoEscolher, {multi}) */
  P.escolhas = function (lista, valor, aoEscolher, opts) {
    opts = opts || {};
    const grid = u.el('div.choice-grid');
    const sel = opts.multi ? (valor || []) : valor;
    lista.forEach(item => {
      const ativo = opts.multi ? sel.indexOf(item.id) >= 0 : sel === item.id;
      const b = u.el('button.choice' + (ativo ? '.is-on' : ''), {
        type: 'button', 'data-id': item.id, 'data-tip': item.label,
        onclick: () => {
          if (opts.multi) {
            const i = sel.indexOf(item.id);
            if (i >= 0) sel.splice(i, 1); else sel.push(item.id);
            aoEscolher(sel.slice());
          } else {
            aoEscolher(item.id);
          }
          u.$$('.choice', grid).forEach(x => {
            const on = opts.multi ? sel.indexOf(x.getAttribute('data-id')) >= 0 : x.getAttribute('data-id') === item.id;
            x.classList.toggle('is-on', on);
          });
        }
      }, [
        item.emoji ? u.el('span.choice__emoji', { text: item.emoji }) : null,
        u.el('span.u-truncate', { text: item.label })
      ]);
      grid.appendChild(b);
    });
    return grid;
  };

  /* ------------------------------ Rating 1-5 ------------------------------ */
  P.rating = function (valor, aoEscolher, opts) {
    opts = opts || {};
    const box = u.el('div.rating', { role: 'radiogroup' });
    for (let v = 1; v <= 5; v++) {
      const on = valor === v;
      const b = u.el('button.rating__dot' + (on ? '.is-on.lvl-' + v : ''), {
        type: 'button', text: String(v), 'data-v': v,
        'data-tip': cat.ESCALA[v], role: 'radio', 'aria-checked': on ? 'true' : 'false',
        onclick: () => {
          const novo = opts.permiteLimpar && valor === v ? null : v;
          aoEscolher(novo);
          u.$$('.rating__dot', box).forEach(d => {
            const dv = +d.getAttribute('data-v');
            d.className = 'rating__dot' + (novo === dv ? ' is-on lvl-' + dv : '');
            d.setAttribute('aria-checked', novo === dv ? 'true' : 'false');
          });
          valor = novo;
        }
      });
      box.appendChild(b);
    }
    return box;
  };

  /* --------------------------- Upload de evidencias --------------------------- */
  /** Retorna { el, lista } — lista e mutavel e reflete o que o usuario anexou. */
  P.uploadEvidencias = function (iniciais) {
    const lista = (iniciais || []).slice();
    const wrap = u.el('div');
    const zona = u.el('div.dropzone', {
      html: App.icon('paperclip') + ' <span>Clique para anexar imagem, PDF ou arquivo — ou arraste aqui</span>',
      onclick: () => input.click()
    });
    const input = u.el('input', { type: 'file', multiple: true, style: { display: 'none' } });
    const linhaLink = u.el('div.u-row.u-gap-2.u-mt-2');
    const inputLink = u.el('input.input.input--sm', { type: 'url', placeholder: 'Ou cole um link (CRM, gravação, documento)' });
    const btnLink = u.el('button.btn.btn--sm.btn--outline', { type: 'button', text: 'Anexar link' });
    linhaLink.appendChild(inputLink); linhaLink.appendChild(btnLink);
    const listaEl = u.el('div.u-row.u-wrap.u-gap-2.u-mt-2');

    function pintar() {
      u.clear(listaEl);
      lista.forEach(ev => listaEl.appendChild(P.evidencia(ev, alvo => {
        const i = lista.indexOf(alvo); if (i >= 0) lista.splice(i, 1);
        pintar();
      })));
    }

    function receber(arquivos) {
      const fs = Array.prototype.slice.call(arquivos || []);
      if (!fs.length) return;
      Promise.all(fs.map(f => {
        if (f.size > 3 * 1024 * 1024) {
          App.toast.aviso('Arquivo muito grande', f.name + ' passa de 3 MB e não será anexado.');
          return null;
        }
        return u.fileToDataURL(f).then(dados => ({
          tipo: 'arquivo', nome: f.name, mime: f.type, tamanho: f.size, dados
        }));
      })).then(res => {
        res.filter(Boolean).forEach(ev => lista.push(ev));
        pintar();
      });
    }

    input.addEventListener('change', () => { receber(input.files); input.value = ''; });
    zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('is-drag'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('is-drag'));
    zona.addEventListener('drop', e => {
      e.preventDefault(); zona.classList.remove('is-drag');
      receber(e.dataTransfer.files);
    });
    btnLink.addEventListener('click', () => {
      const v = inputLink.value.trim();
      if (!v) return;
      lista.push({ tipo: 'link', nome: v.replace(/^https?:\/\//, '').slice(0, 60), url: v });
      inputLink.value = ''; pintar();
    });
    inputLink.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); btnLink.click(); } });

    wrap.appendChild(zona); wrap.appendChild(input);
    wrap.appendChild(linhaLink); wrap.appendChild(listaEl);
    pintar();
    return { el: wrap, lista, limpar() { lista.length = 0; pintar(); } };
  };

  /* --------------------------- Lista editavel de itens --------------------------- */
  /** Ex.: compromissos, pontos positivos. Retorna { el, itens } */
  P.listaEditavel = function (iniciais, placeholder) {
    const itens = (iniciais || []).slice();
    const wrap = u.el('div');
    const lista = u.el('div.pill-list');
    const linha = u.el('div.u-row.u-gap-2.u-mt-3');
    const inp = u.el('input.input', { type: 'text', placeholder: placeholder || 'Escreva e pressione Enter' });
    const btn = u.el('button.btn.btn--soft', { type: 'button', html: App.icon('plus') + '<span>Adicionar</span>' });

    function pintar() {
      u.clear(lista);
      if (!itens.length) {
        lista.appendChild(u.el('div.t-sm.t-muted2', { text: 'Nenhum item adicionado ainda.' }));
        return;
      }
      itens.forEach((txt, i) => {
        lista.appendChild(u.el('div.pill-item', {}, [
          u.el('span.t-muted2.t-sm', { text: (i + 1) + '.' }),
          u.el('span.u-grow', { text: txt }),
          u.el('button.pill-item__x', {
            type: 'button', 'aria-label': 'Remover', html: App.icon('x'),
            onclick: () => { itens.splice(i, 1); pintar(); }
          })
        ]));
      });
    }
    function add() {
      const v = inp.value.trim();
      if (!v) return;
      itens.push(v); inp.value = ''; pintar(); inp.focus();
    }
    btn.addEventListener('click', add);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

    linha.appendChild(inp); linha.appendChild(btn);
    wrap.appendChild(lista); wrap.appendChild(linha);
    pintar();
    return { el: wrap, itens };
  };

  App.p = P;
})(window.App);
