/* =========================================================================
   services/12-analise.js — Regras de negocio e inteligencia do produto.

   Tudo o que transforma REGISTRO em EVIDENCIA vive aqui:
   resumos de periodo, alertas do coordenador, preparacao automatica do
   One a One, timeline unificada e series para os graficos.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, db = App.db, cat = App.cat;

  const A = {};

  /* ==================================================================== */
  /*  1. Situacao do One a One                                            */
  /* ==================================================================== */
  /** estado: 'atrasado' | 'hoje' | 'proximo' (<=3d) | 'agendado' | 'sem_data' */
  A.situacao1a1 = function (colab) {
    const ultimo = db.oneones.ultimoConcluido(colab.id);
    const prox = colab.proximoOneAOne || null;
    const dias = prox ? u.daysUntil(prox) : null;
    let estado = 'sem_data';
    if (prox) {
      if (dias < 0) estado = 'atrasado';
      else if (dias === 0) estado = 'hoje';
      else if (dias <= 3) estado = 'proximo';
      else estado = 'agendado';
    }
    return {
      proximo: prox,
      dias,
      estado,
      ultimo: ultimo ? ultimo.data : (colab.ultimoOneAOne || null),
      ultimoId: ultimo ? ultimo.id : null,
      diasDesdeUltimo: ultimo ? u.diffDays(ultimo.data, new Date())
                              : (colab.ultimoOneAOne ? u.diffDays(colab.ultimoOneAOne, new Date()) : null)
    };
  };

  /** Inicio do periodo corrente = ultimo 1:1 concluido, ou 30 dias atras. */
  A.inicioPeriodo = function (colabId) {
    const ult = db.oneones.ultimoConcluido(colabId);
    if (ult) return ult.data;
    const c = db.colaboradores.por(colabId);
    const entrada = c && c.dataEntrada;
    const trintaDias = u.toISODate(u.addDays(new Date(), -30));
    if (entrada && u.parseDate(entrada) > u.parseDate(trintaDias)) return entrada;
    return trintaDias;
  };

  /* ==================================================================== */
  /*  2. Resumo de um periodo                                             */
  /* ==================================================================== */
  A.resumoPeriodo = function (colabId, de, ate) {
    de = de || A.inicioPeriodo(colabId);
    ate = ate || u.nowISO();

    const obs = db.observacoes.noPeriodo(colabId, de, ate);
    const fbs = db.feedbacks.noPeriodo(colabId, de, ate);
    const pls = db.planos.onde(p => p.colaboradorId === colabId);

    const porTipo = {};
    obs.forEach(o => { porTipo[o.tipo] = (porTipo[o.tipo] || 0) + 1; });

    const positivos = obs.filter(o => cat.tipoObs(o.tipo).pol > 0);
    const atencao   = obs.filter(o => cat.tipoObs(o.tipo).pol < 0);
    const neutros   = obs.filter(o => cat.tipoObs(o.tipo).pol === 0);

    const noPeriodo = p => {
      const ref = p.concluidoEm || p.inicio || p.criadoEm;
      if (!ref) return false;
      const t = (u.parseDate(ref) || new Date()).getTime();
      return t >= u.startOfDay(de).getTime() && t <= u.startOfDay(ate).getTime() + 86399999;
    };

    const concluidas = pls.filter(p => p.status === 'concluido' && noPeriodo(p));
    const pendentes  = db.planos.abertos(colabId);
    const atrasadas  = db.planos.atrasados(colabId);

    return {
      de, ate,
      dias: Math.max(0, u.diffDays(de, ate)),
      observacoes: obs,
      total: obs.length,
      positivos: positivos.length,
      atencao: atencao.length,
      neutros: neutros.length,
      porTipo,
      feedbacks: fbs,
      totalFeedbacks: fbs.length,
      planos: pls,
      acoesConcluidas: concluidas.length,
      acoesPendentes: pendentes.length,
      acoesAtrasadas: atrasadas.length,
      /** saldo: soma das polaridades ponderada pelo impacto */
      saldo: u.sum(obs, o => cat.tipoObs(o.tipo).pol * cat.impacto(o.impacto).peso)
    };
  };

  /** Comparativo do periodo atual com o periodo anterior de mesma duracao. */
  A.tendencia = function (colabId) {
    const ini = A.inicioPeriodo(colabId);
    const dias = Math.max(7, u.diffDays(ini, new Date()));
    const atual = A.resumoPeriodo(colabId, ini, u.nowISO());
    const antIni = u.toISODate(u.addDays(ini, -dias));
    const anterior = A.resumoPeriodo(colabId, antIni, ini);

    const delta = atual.saldo - anterior.saldo;
    let estado = 'estavel';
    if (delta >= 2) estado = 'subindo';
    else if (delta <= -2) estado = 'caindo';
    return { atual, anterior, delta, estado };
  };

  /* ==================================================================== */
  /*  3. Indicadores de performance                                       */
  /* ==================================================================== */
  A.indicadores = function (colab) {
    const i = colab.indicadores || {};
    const meta = +colab.meta || 0;
    const realizado = +i.realizado || 0;
    return {
      meta,
      realizado,
      pctMeta: meta ? (realizado / meta) * 100 : 0,
      vendas: +i.vendas || 0,
      leads: +i.leads || 0,
      followups: +i.followups || 0,
      conversao: i.conversao !== undefined ? +i.conversao : (i.leads ? (i.vendas / i.leads) * 100 : 0)
    };
  };

  /** Historico mensal (serie) do colaborador — usado nos graficos. */
  A.historico = function (colab) {
    const h = (colab && colab.historico) || [];
    return u.sortBy(h, x => x.mes);
  };

  /** Queda de desempenho: ultimo mes com % de meta bem abaixo da media anterior. */
  A.quedaDesempenho = function (colab) {
    const h = A.historico(colab);
    if (h.length < 3) return null;
    const ult = h[h.length - 1];
    const anteriores = h.slice(0, -1);
    const pctUlt = ult.meta ? (ult.realizado / ult.meta) * 100 : 0;
    const media = u.sum(anteriores, x => (x.meta ? (x.realizado / x.meta) * 100 : 0)) / anteriores.length;
    if (media - pctUlt >= 15 && pctUlt < 100) {
      return { mes: ult.mes, pct: pctUlt, media, queda: media - pctUlt };
    }
    return null;
  };

  /* ==================================================================== */
  /*  4. Competencias                                                     */
  /* ==================================================================== */
  /** Ultima avaliacao registrada por competencia. */
  A.competenciasAtuais = function (colabId) {
    const encontros = db.oneones.concluidos(colabId);
    const out = {};
    cat.COMPETENCIAS.forEach(c => { out[c.id] = null; });
    for (let i = 0; i < encontros.length; i++) {           // do mais recente ao mais antigo
      const comp = encontros[i].competencias || {};
      cat.COMPETENCIAS.forEach(c => {
        if (out[c.id] === null && comp[c.id] && comp[c.id].nota) {
          out[c.id] = { nota: comp[c.id].nota, comentario: comp[c.id].comentario || '', data: encontros[i].data };
        }
      });
    }
    return out;
  };

  /** Media geral das competencias avaliadas (0 se nunca avaliado). */
  A.mediaCompetencias = function (colabId) {
    const at = A.competenciasAtuais(colabId);
    const vals = Object.keys(at).map(k => at[k]).filter(Boolean).map(x => x.nota);
    return vals.length ? u.sum(vals) / vals.length : 0;
  };

  /** Serie de evolucao por competencia ao longo dos encontros. */
  A.evolucaoCompetencias = function (colabId) {
    const encontros = u.sortBy(db.oneones.concluidos(colabId), e => e.data);
    return {
      datas: encontros.map(e => e.data),
      series: cat.COMPETENCIAS.map(c => ({
        id: c.id, label: c.label,
        valores: encontros.map(e => (e.competencias && e.competencias[c.id] && e.competencias[c.id].nota) || null)
      }))
    };
  };

  /** Compara as duas ultimas avaliacoes: quem subiu, quem caiu. */
  A.deltaCompetencias = function (colabId) {
    const encontros = db.oneones.concluidos(colabId);
    if (encontros.length < 2) return [];
    const atual = encontros[0].competencias || {};
    const ant = encontros[1].competencias || {};
    const out = [];
    cat.COMPETENCIAS.forEach(c => {
      const a = atual[c.id] && atual[c.id].nota, b = ant[c.id] && ant[c.id].nota;
      if (a && b && a !== b) out.push({ id: c.id, label: c.label, de: b, para: a, delta: a - b });
    });
    return u.sortBy(out, x => -Math.abs(x.delta));
  };

  /** Autoavaliacao x avaliacao do coordenador (arquitetura ja pronta). */
  A.comparativoAuto = function (colabId) {
    const auto = db.autoavaliacoes.ultima(colabId);
    const coord = A.competenciasAtuais(colabId);
    if (!auto || !auto.competencias) return null;
    const linhas = cat.COMPETENCIAS.map(c => ({
      id: c.id, label: c.label,
      auto: auto.competencias[c.id] || null,
      coord: coord[c.id] ? coord[c.id].nota : null
    })).filter(l => l.auto || l.coord);
    return { data: auto.data, linhas };
  };

  /* ==================================================================== */
  /*  5. Alertas do coordenador                                           */
  /* ==================================================================== */
  A.alertas = function () {
    const out = [];
    db.colaboradores.ativos().forEach(c => {
      const s = A.situacao1a1(c);
      const res = A.resumoPeriodo(c.id);

      if (s.estado === 'atrasado') {
        out.push({
          id: 'oo_atraso_' + c.id, tipo: 'oneone_atrasado', tom: 'danger', icone: 'calendar',
          prioridade: 100 + Math.abs(s.dias),
          colaboradorId: c.id,
          titulo: 'One a One atrasado — ' + c.nome,
          desc: 'Previsto para ' + u.fmtDate(s.proximo) + ' (' + u.plural(Math.abs(s.dias), 'dia') + ' de atraso).',
          rota: '#/preparar/' + c.id, acaoLabel: 'Preparar agora'
        });
      } else if (s.estado === 'hoje' || s.estado === 'proximo') {
        out.push({
          id: 'oo_prox_' + c.id, tipo: 'oneone_proximo', tom: 'info', icone: 'clock',
          prioridade: 60 - s.dias,
          colaboradorId: c.id,
          titulo: 'One a One ' + (s.dias === 0 ? 'é hoje' : 'em ' + u.plural(s.dias, 'dia')) + ' — ' + c.nome,
          desc: res.total + ' ' + (res.total === 1 ? 'observação registrada' : 'observações registradas') + ' desde o último encontro.',
          rota: '#/preparar/' + c.id, acaoLabel: 'Preparar'
        });
      } else if (s.estado === 'sem_data') {
        out.push({
          id: 'oo_semdata_' + c.id, tipo: 'sem_data', tom: 'warn', icone: 'calendar',
          prioridade: 40, colaboradorId: c.id,
          titulo: 'Sem One a One agendado — ' + c.nome,
          desc: 'Defina a data do próximo encontro no cadastro.',
          rota: '#/colaborador/' + c.id, acaoLabel: 'Abrir perfil'
        });
      }

      const atrasadas = db.planos.atrasados(c.id);
      if (atrasadas.length) {
        out.push({
          id: 'pl_atraso_' + c.id, tipo: 'plano_atrasado', tom: 'danger', icone: 'flag',
          prioridade: 90 + atrasadas.length, colaboradorId: c.id,
          titulo: u.plural(atrasadas.length, 'plano atrasado', 'planos atrasados') + ' — ' + c.nome,
          desc: u.trunc(atrasadas[0].ponto || atrasadas[0].acao || '', 74),
          rota: '#/colaborador/' + c.id + '/plano', acaoLabel: 'Ver plano'
        });
      }

      const vencendo = db.planos.venceEm(3).filter(p => p.colaboradorId === c.id);
      if (vencendo.length) {
        out.push({
          id: 'pl_vence_' + c.id, tipo: 'plano_vencendo', tom: 'warn', icone: 'clock',
          prioridade: 50, colaboradorId: c.id,
          titulo: u.plural(vencendo.length, 'ação vence', 'ações vencem') + ' em até 3 dias — ' + c.nome,
          desc: u.trunc(vencendo[0].acao || vencendo[0].ponto || '', 74),
          rota: '#/colaborador/' + c.id + '/plano', acaoLabel: 'Ver plano'
        });
      }

      const criticos = res.observacoes.filter(o => o.tipo === 'critico');
      if (criticos.length) {
        out.push({
          id: 'obs_crit_' + c.id, tipo: 'critico', tom: 'danger', icone: 'alert',
          prioridade: 95 + criticos.length, colaboradorId: c.id,
          titulo: u.plural(criticos.length, 'comportamento crítico registrado', 'comportamentos críticos registrados') + ' — ' + c.nome,
          desc: u.trunc(criticos[0].texto, 74),
          rota: '#/colaborador/' + c.id + '/observacoes', acaoLabel: 'Ver registros'
        });
      } else if (res.atencao >= 3 && res.atencao > res.positivos) {
        out.push({
          id: 'obs_aten_' + c.id, tipo: 'muita_atencao', tom: 'warn', icone: 'alert',
          prioridade: 70 + res.atencao, colaboradorId: c.id,
          titulo: 'Concentração de pontos de atenção — ' + c.nome,
          desc: res.atencao + ' pontos de atenção contra ' + res.positivos + ' positivos no período.',
          rota: '#/colaborador/' + c.id + '/observacoes', acaoLabel: 'Ver registros'
        });
      }

      const ultFb = db.feedbacks.doColaborador(c.id)[0];
      const diasFb = ultFb ? u.diffDays(ultFb.data, new Date()) : null;
      if (!ultFb || diasFb > 30) {
        out.push({
          id: 'fb_sem_' + c.id, tipo: 'sem_feedback', tom: 'warn', icone: 'chat',
          prioridade: 45, colaboradorId: c.id,
          titulo: 'Sem feedback formal — ' + c.nome,
          desc: ultFb ? 'Último feedback há ' + u.plural(diasFb, 'dia') + '.' : 'Nenhum feedback registrado até agora.',
          rota: '#/colaborador/' + c.id + '/feedbacks', acaoLabel: 'Registrar'
        });
      }

      if (res.total === 0 && s.estado !== 'sem_data') {
        out.push({
          id: 'obs_zero_' + c.id, tipo: 'sem_observacao', tom: 'info', icone: 'eye',
          prioridade: 30, colaboradorId: c.id,
          titulo: 'Nenhuma observação no período — ' + c.nome,
          desc: 'Sem registros desde o último One a One. O próximo encontro ficará sem evidências.',
          rota: '#/colaborador/' + c.id + '/observacoes', acaoLabel: 'Registrar'
        });
      }

      /* agendamento em dia nao util: o sistema nunca cria, mas pode existir
         de base antiga ou de escolha manual — aqui vira aviso, nao correcao. */
      if (App.cal && s.proximo) {
        const motivo = App.cal.motivo(s.proximo);
        if (motivo && s.estado !== 'atrasado') {
          out.push({
            id: 'oo_naoutil_' + c.id, tipo: 'dia_nao_util', tom: 'warn', icone: 'calendar',
            prioridade: 55, colaboradorId: c.id,
            titulo: 'One a One marcado em dia não útil — ' + c.nome,
            desc: u.fmtDate(s.proximo) + ' cai em ' + motivo.toLowerCase() + '. Reagende se não for intencional.',
            rota: '#/one-a-one', acaoLabel: 'Reagendar'
          });
        }
      }

      const q = A.quedaDesempenho(c);
      if (q) {
        out.push({
          id: 'perf_queda_' + c.id, tipo: 'queda', tom: 'danger', icone: 'trendDown',
          prioridade: 85, colaboradorId: c.id,
          titulo: 'Queda de desempenho — ' + c.nome,
          desc: 'Fechou ' + u.fmtPct(q.pct) + ' da meta contra média de ' + u.fmtPct(q.media) + ' nos meses anteriores.',
          rota: '#/colaborador/' + c.id + '/evolucao', acaoLabel: 'Ver evolução'
        });
      }
    });

    return u.sortBy(out, a => -a.prioridade);
  };

  /* ==================================================================== */
  /*  6. Resumo executivo da equipe                                       */
  /* ==================================================================== */
  A.resumoEquipe = function () {
    const ativos = db.colaboradores.ativos();
    const hoje = new Date();
    let proximos = 0, atrasados = 0;
    ativos.forEach(c => {
      const s = A.situacao1a1(c);
      if (s.estado === 'atrasado') atrasados++;
      else if (s.dias !== null && s.dias <= 7) proximos++;
    });

    const obs7 = db.observacoes.onde(o => u.diffDays(o.data, hoje) <= 7 && u.diffDays(o.data, hoje) >= 0);
    const obs30 = db.observacoes.onde(o => u.diffDays(o.data, hoje) <= 30 && u.diffDays(o.data, hoje) >= 0);
    const abertos = db.planos.abertos();
    const atrasadosPl = db.planos.atrasados();

    const metaTotal = u.sum(ativos, c => +c.meta || 0);
    const realTotal = u.sum(ativos, c => (c.indicadores && +c.indicadores.realizado) || 0);

    return {
      totalColaboradores: ativos.length,
      totalInativos: db.colaboradores.contar(c => c.status === 'inativo'),
      oneOnesProximos: proximos,
      oneOnesAtrasados: atrasados,
      observacoes7: obs7.length,
      observacoes30: obs30.length,
      observacoesTotal: db.observacoes.contar(),
      feedbacksTotal: db.feedbacks.contar(),
      encontrosTotal: db.oneones.contar(o => o.status === 'concluido'),
      planosAbertos: abertos.length,
      planosAtrasados: atrasadosPl.length,
      planosConcluidos: db.planos.contar(p => p.status === 'concluido'),
      metaTotal, realTotal,
      pctMeta: metaTotal ? (realTotal / metaTotal) * 100 : 0
    };
  };

  /* ==================================================================== */
  /*  7. Timeline unificada                                               */
  /* ==================================================================== */
  /** filtro: todos|positivo|atencao|feedback|oneone|plano|evolucao */
  A.timeline = function (colabId, filtro, limite) {
    const ev = [];

    db.observacoes.doColaborador(colabId).forEach(o => {
      const t = cat.tipoObs(o.tipo);
      ev.push({
        id: o.id, kind: 'observacao', subtipo: o.tipo,
        grupo: t.pol > 0 ? 'positivo' : (t.pol < 0 ? 'atencao' : (o.tipo === 'evolucao' ? 'evolucao' : 'neutro')),
        data: o.data, emoji: t.emoji, tom: t.tom,
        titulo: t.label, texto: o.texto,
        meta: [cat.contexto(o.contexto).label, 'Impacto ' + cat.impacto(o.impacto).label],
        evidencias: o.evidencias || [], ref: o
      });
    });

    db.feedbacks.doColaborador(colabId).forEach(f => {
      const c = cat.classif(f.classificacao);
      ev.push({
        id: f.id, kind: 'feedback', subtipo: f.classificacao, grupo: 'feedback',
        data: f.data, emoji: '💬', tom: c.tom,
        titulo: 'Feedback · ' + c.label, texto: f.oQueAconteceu,
        meta: [], evidencias: f.evidencias || [], ref: f
      });
    });

    db.oneones.doColaborador(colabId).forEach(o => {
      if (o.status === 'cancelado') return;
      const r = o.resumoSalvo || {};
      ev.push({
        id: o.id, kind: 'oneone', subtipo: o.status, grupo: 'oneone',
        data: o.data, emoji: '🤝', tom: o.status === 'concluido' ? 'brand' : 'warn',
        titulo: o.status === 'concluido' ? 'One a One realizado' : 'One a One em andamento',
        texto: (o.roteiro && o.roteiro.fechamento) || (o.roteiro && o.roteiro.comoEsta) || 'Encontro registrado.',
        meta: [
          r.total !== undefined ? r.total + ' observações no período' : null,
          (o.roteiro && o.roteiro.compromissos && o.roteiro.compromissos.length)
            ? u.plural(o.roteiro.compromissos.length, 'compromisso') : null
        ].filter(Boolean),
        evidencias: [], ref: o
      });
    });

    db.planos.doColaborador(colabId).forEach(p => {
      const st = cat.statusPlano(db.planos.statusEfetivo(p));
      ev.push({
        id: p.id, kind: 'plano', subtipo: db.planos.statusEfetivo(p), grupo: 'plano',
        data: p.inicio || p.criadoEm, emoji: '🎯', tom: st.tom,
        titulo: 'Plano de ação · ' + st.label, texto: p.ponto || p.acao,
        meta: [p.prazo ? 'Prazo ' + u.fmtDate(p.prazo) : null, p.indicador ? 'Indicador: ' + p.indicador : null].filter(Boolean),
        evidencias: [], ref: p
      });
      if (p.status === 'concluido' && p.concluidoEm) {
        ev.push({
          id: p.id + '_ok', kind: 'plano_ok', subtipo: 'concluido', grupo: 'evolucao',
          data: p.concluidoEm, emoji: '🟢', tom: 'ok',
          titulo: 'Ação concluída', texto: p.acao || p.ponto,
          meta: p.indicador ? ['Indicador: ' + p.indicador] : [], evidencias: [], ref: p
        });
      }
    });

    let lista = u.sortBy(ev, e => e.data, 'desc');
    if (filtro && filtro !== 'todos') lista = lista.filter(e => e.grupo === filtro);
    return limite ? lista.slice(0, limite) : lista;
  };

  /* ==================================================================== */
  /*  8. Preparacao automatica do One a One                               */
  /* ==================================================================== */
  A.prepararOneOne = function (colabId) {
    const colab = db.colaboradores.por(colabId);
    if (!colab) return null;

    const de = A.inicioPeriodo(colabId);
    const resumo = A.resumoPeriodo(colabId, de, u.nowISO());
    const tend = A.tendencia(colabId);
    const peso = o => cat.impacto(o.impacto).peso * 10 - Math.min(9, u.diffDays(o.data, new Date()) / 3);

    const positivos = u.sortBy(
      resumo.observacoes.filter(o => cat.tipoObs(o.tipo).pol > 0), peso, 'desc').slice(0, 3);
    const atencao = u.sortBy(
      resumo.observacoes.filter(o => cat.tipoObs(o.tipo).pol < 0), peso, 'desc').slice(0, 3);

    /* ---- Evolucao: o que melhorou ---- */
    const evolucao = [];
    A.deltaCompetencias(colabId).filter(d => d.delta > 0).slice(0, 3).forEach(d => {
      evolucao.push({ texto: d.label + ' subiu de ' + d.de + ' para ' + d.para + ' na avaliação de competências.', fonte: 'competencia' });
    });
    db.planos.onde(p => p.colaboradorId === colabId && p.status === 'concluido' &&
      p.concluidoEm && u.diffDays(de, p.concluidoEm) >= 0)
      .slice(0, 3).forEach(p => {
        evolucao.push({ texto: 'Concluiu o plano "' + (p.ponto || p.acao) + '"' + (p.indicador ? ' — indicador: ' + p.indicador : '') + '.', fonte: 'plano' });
      });
    if (tend.estado === 'subindo') {
      evolucao.push({ texto: 'Saldo de observações melhorou em relação ao período anterior (' + (tend.delta > 0 ? '+' : '') + tend.delta + ' pontos).', fonte: 'tendencia' });
    }
    const ind = A.indicadores(colab);
    if (ind.pctMeta >= 100) evolucao.push({ texto: 'Bateu a meta do período: ' + u.fmtPct(ind.pctMeta) + '.', fonte: 'meta' });

    /* ---- Pontos a acompanhar ---- */
    const acompanhar = [];
    db.planos.atrasados(colabId).slice(0, 3).forEach(p => {
      acompanhar.push({ texto: 'Plano atrasado: "' + (p.ponto || p.acao) + '" — prazo era ' + u.fmtDate(p.prazo) + '.', fonte: 'plano', ref: p });
    });
    db.planos.abertos(colabId).filter(p => db.planos.statusEfetivo(p) !== 'atrasado').slice(0, 2).forEach(p => {
      acompanhar.push({ texto: 'Em aberto: "' + (p.ponto || p.acao) + '"' + (p.prazo ? ' (prazo ' + u.fmtDate(p.prazo) + ')' : '') + '.', fonte: 'plano', ref: p });
    });
    A.deltaCompetencias(colabId).filter(d => d.delta < 0).slice(0, 2).forEach(d => {
      acompanhar.push({ texto: d.label + ' caiu de ' + d.de + ' para ' + d.para + ' desde a última avaliação.', fonte: 'competencia' });
    });
    const baixas = A.competenciasAtuais(colabId);
    Object.keys(baixas).forEach(k => {
      if (baixas[k] && baixas[k].nota <= 2 && acompanhar.length < 6) {
        acompanhar.push({ texto: cat.competencia(k).label + ' segue em ' + baixas[k].nota + '/5 — precisa de plano específico.', fonte: 'competencia' });
      }
    });
    if (ind.meta && ind.pctMeta < 80) {
      acompanhar.push({ texto: 'Meta em ' + u.fmtPct(ind.pctMeta) + ' (' + u.fmtMoedaCurta(ind.realizado) + ' de ' + u.fmtMoedaCurta(ind.meta) + ').', fonte: 'meta' });
    }
    const q = A.quedaDesempenho(colab);
    if (q) acompanhar.push({ texto: 'Queda de ' + u.fmtPct(q.queda) + ' em relação à média dos meses anteriores.', fonte: 'meta' });

    /* ---- Perguntas sugeridas ---- */
    const perguntas = A.perguntasSugeridas(colabId, { resumo, atencao, acompanhar, tend, ind });

    return {
      colaborador: colab, de, ate: u.nowISO(), resumo, tendencia: tend,
      positivos, atencao, evolucao, acompanhar, perguntas,
      indicadores: ind,
      competencias: A.competenciasAtuais(colabId),
      ultimoEncontro: db.oneones.ultimoConcluido(colabId)
    };
  };

  A.perguntasSugeridas = function (colabId, ctx) {
    const out = [];
    const push = t => { if (out.indexOf(t) < 0) out.push(t); };

    push('O que mudou desde o nosso último encontro?');

    if (ctx.atencao && ctx.atencao.length) {
      const onde = cat.contexto(ctx.atencao[0].contexto).label.toLowerCase();
      push('Registrei ' + (ctx.atencao.length === 1 ? 'um ponto' : ctx.atencao.length + ' pontos') +
           ' de atenção no período, o mais recente em ' + onde + '. Como você enxerga essa situação?');
      push('O que você acredita que está impedindo sua evolução nesse ponto?');
    }
    if (ctx.acompanhar && ctx.acompanhar.some(a => a.fonte === 'plano')) {
      push('O que travou a execução do que combinamos no último One a One?');
      push('Que apoio você precisa de mim para destravar esse plano?');
    }
    if (ctx.ind && ctx.ind.meta && ctx.ind.pctMeta < 90) {
      push('Qual ação você acredita que pode gerar maior impacto na meta ainda neste ciclo?');
      push('Onde você está perdendo mais oportunidades hoje: prospecção, follow-up ou fechamento?');
    }
    if (ctx.ind && ctx.ind.pctMeta >= 100) {
      push('O que você fez de diferente neste período que podemos transformar em padrão para o time?');
    }
    if (ctx.tend && ctx.tend.estado === 'caindo') {
      push('Percebi uma mudança no seu ritmo no último período. O que está acontecendo?');
    }
    if (ctx.resumo && ctx.resumo.total === 0) {
      push('Como foi o seu período? Me conte o que aconteceu que eu não vi de perto.');
    }
    push('Se você pudesse mudar uma única coisa na sua rotina comercial, qual seria?');
    push('O que você espera de mim como coordenador até o nosso próximo encontro?');

    return out.slice(0, 7);
  };

  /* ==================================================================== */
  /*  9. Series para graficos                                             */
  /* ==================================================================== */
  /** Observacoes por dia nos ultimos N dias (equipe ou colaborador). */
  A.serieObservacoes = function (dias, colabId) {
    dias = dias || 30;
    const base = [];
    for (let i = dias - 1; i >= 0; i--) {
      const d = u.addDays(new Date(), -i);
      base.push({ data: u.toISODate(d), label: u.fmtDateShort(d), positivo: 0, atencao: 0, neutro: 0, total: 0 });
    }
    const ix = {}; base.forEach(b => { ix[b.data] = b; });
    db.observacoes.todos().forEach(o => {
      const k = u.toISODate(o.data);
      const b = ix[k];
      if (!b) return;
      if (colabId && o.colaboradorId !== colabId) return;
      const pol = cat.tipoObs(o.tipo).pol;
      b.total++;
      if (pol > 0) b.positivo++; else if (pol < 0) b.atencao++; else b.neutro++;
    });
    return base;
  };

  /** Distribuicao por tipo de observacao. */
  A.distribuicaoTipos = function (colabId) {
    const lista = colabId ? db.observacoes.doColaborador(colabId) : db.observacoes.todos();
    return cat.TIPOS_OBS.map(t => ({
      id: t.id, label: t.label, emoji: t.emoji, tom: t.tom,
      total: lista.filter(o => o.tipo === t.id).length
    })).filter(x => x.total > 0);
  };

  /** Ranking por % de meta. */
  A.rankingMeta = function () {
    return u.sortBy(db.colaboradores.ativos().map(c => {
      const i = A.indicadores(c);
      return { colaborador: c, pct: i.pctMeta, realizado: i.realizado, meta: i.meta };
    }), x => -x.pct);
  };

  /** Comparativo positivos x atencao por colaborador. */
  A.balancoEquipe = function () {
    return db.colaboradores.ativos().map(c => {
      const obs = db.observacoes.doColaborador(c.id);
      return {
        colaborador: c,
        positivos: obs.filter(o => cat.tipoObs(o.tipo).pol > 0).length,
        atencao: obs.filter(o => cat.tipoObs(o.tipo).pol < 0).length,
        total: obs.length
      };
    });
  };

  /** Feedbacks por mes (ultimos 6). */
  A.serieFeedbacks = function (meses) {
    meses = meses || 6;
    const out = [];
    for (let i = meses - 1; i >= 0; i--) {
      const d = u.addMonths(new Date(), -i);
      const chave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      out.push({ mes: chave, label: u.MES_ABR[d.getMonth()], feedbacks: 0, encontros: 0, planos: 0 });
    }
    const ix = {}; out.forEach(o => { ix[o.mes] = o; });
    const chaveDe = v => { const d = u.parseDate(v); return d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') : null; };
    db.feedbacks.todos().forEach(f => { const b = ix[chaveDe(f.data)]; if (b) b.feedbacks++; });
    db.oneones.todos().forEach(o => { if (o.status === 'concluido') { const b = ix[chaveDe(o.data)]; if (b) b.encontros++; } });
    db.planos.todos().forEach(p => { if (p.status === 'concluido' && p.concluidoEm) { const b = ix[chaveDe(p.concluidoEm)]; if (b) b.planos++; } });
    return out;
  };

  /** Evolucao da meta da equipe (media dos historicos mensais). */
  A.serieMetaEquipe = function () {
    const mapa = {};
    db.colaboradores.ativos().forEach(c => {
      A.historico(c).forEach(h => {
        const m = mapa[h.mes] || (mapa[h.mes] = { mes: h.mes, meta: 0, realizado: 0 });
        m.meta += +h.meta || 0;
        m.realizado += +h.realizado || 0;
      });
    });
    return u.sortBy(Object.keys(mapa).map(k => {
      const m = mapa[k];
      const [ano, mes] = k.split('-');
      m.label = u.MES_ABR[+mes - 1] + '/' + ano.slice(2);
      m.pct = m.meta ? (m.realizado / m.meta) * 100 : 0;
      return m;
    }), x => x.mes);
  };

  App.analise = A;
})(window.App);
