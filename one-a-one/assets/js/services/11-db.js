/* =========================================================================
   services/11-db.js — Repositorios de dominio.

   Le do adapter uma vez para um cache em memoria (leitura sincrona e rapida
   nas telas) e escreve sempre atraves do adapter (write-through).
   Cada escrita emite 'dados:mudou' -> as telas se re-renderizam sozinhas.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u, cat = App.cat;

  const cache = {};
  App.COLECOES.forEach(c => { cache[c] = []; });

  /* ------------------------------------------------------------------ */
  /*  ESCOPO DE LEITURA                                                  */
  /*  Registros marcados com { exemplo: true } sao material de           */
  /*  demonstracao: existem no banco, mas NAO participam da operacao.    */
  /*  Todas as telas leem no escopo 'operacao'; a aba Exemplos           */
  /*  (Configuracoes) le no escopo 'exemplos' e por isso reaproveita     */
  /*  exatamente a mesma logica de analise, sem codigo duplicado.        */
  /* ------------------------------------------------------------------ */
  let _escopo = 'operacao';                      // 'operacao' | 'exemplos' | 'tudo'

  function visivel(x) {
    if (_escopo === 'tudo') return true;
    return _escopo === 'exemplos' ? !!x.exemplo : !x.exemplo;
  }

  function notificar(colecao, acao, doc) {
    App.bus.emit('dados:mudou', { colecao, acao, doc });
  }

  /* ------------------------------------------------------------------ */
  /*  Repositorio generico                                              */
  /* ------------------------------------------------------------------ */
  function Repo(colecao) {
    this.c = colecao;
  }
  /** Base de leitura do escopo atual — toda consulta passa por aqui. */
  Repo.prototype.base = function () { return cache[this.c].filter(visivel); };
  Repo.prototype.todos = function () { return this.base(); };
  /** por(id) ignora o escopo de proposito: e usado para resolver nomes. */
  Repo.prototype.por = function (id) { return cache[this.c].find(x => x.id === id) || null; };
  Repo.prototype.onde = function (fn) { return this.base().filter(fn); };
  Repo.prototype.contar = function (fn) { const b = this.base(); return fn ? b.filter(fn).length : b.length; };
  /** Registros de demonstracao desta colecao, independente do escopo. */
  Repo.prototype.exemplos = function () { return cache[this.c].filter(x => x.exemplo); };
  Repo.prototype.tudo = function () { return cache[this.c].slice(); };

  Repo.prototype.criar = function (doc) {
    const novo = Object.assign({}, doc);
    if (!novo.id) novo.id = u.uid(this.c.slice(0, 3));
    novo.criadoEm = novo.criadoEm || u.nowISO();
    cache[this.c] = cache[this.c].concat([novo]);
    const self = this;
    return App.adapter.insert(this.c, novo).then(salvo => {
      notificar(self.c, 'criar', salvo);
      return salvo;
    });
  };

  Repo.prototype.atualizar = function (id, patch) {
    const i = cache[this.c].findIndex(x => x.id === id);
    if (i < 0) return Promise.reject(new Error('Registro não encontrado.'));
    const atualizado = Object.assign({}, cache[this.c][i], patch, { id, atualizadoEm: u.nowISO() });
    const arr = cache[this.c].slice(); arr[i] = atualizado; cache[this.c] = arr;
    const self = this;
    return App.adapter.update(this.c, id, patch).then(() => {
      notificar(self.c, 'atualizar', atualizado);
      return atualizado;
    });
  };

  Repo.prototype.remover = function (id) {
    const doc = this.por(id);
    cache[this.c] = cache[this.c].filter(x => x.id !== id);
    const self = this;
    return App.adapter.remove(this.c, id).then(() => {
      notificar(self.c, 'remover', doc);
      return true;
    });
  };

  Repo.prototype.substituirTudo = function (arr) {
    cache[this.c] = arr.slice();
    const self = this;
    return App.adapter.replaceAll(this.c, arr).then(() => {
      notificar(self.c, 'recarregar', null);
      return arr;
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Colaboradores                                                     */
  /* ------------------------------------------------------------------ */
  const colaboradores = new Repo('colaboradores');

  colaboradores.ativos = function () {
    return u.sortBy(this.onde(c => c.status !== 'inativo'), c => u.norm(c.nome));
  };
  colaboradores.todosOrdenados = function () {
    return u.sortBy(this.todos(), c => (c.status === 'inativo' ? 'z' : 'a') + u.norm(c.nome));
  };
  colaboradores.nome = function (id) { const c = this.por(id); return c ? c.nome : 'Colaborador removido'; };

  /**
   * Proximo 1:1 recalculado a partir do ultimo encontro concluido.
   * A data nunca cai em fim de semana ou feriado — App.cal.agendar desloca
   * para o proximo dia util.
   */
  colaboradores.reagendar = function (id, dataBase) {
    const c = this.por(id);
    if (!c) return Promise.resolve(null);
    const freq = +c.frequenciaDias || 14;
    return this.atualizar(id, {
      ultimoOneAOne: u.toISODate(dataBase),
      proximoOneAOne: App.cal.agendar(dataBase, freq)
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Observacoes                                                       */
  /* ------------------------------------------------------------------ */
  const observacoes = new Repo('observacoes');

  observacoes.doColaborador = function (id) {
    return u.sortBy(this.onde(o => o.colaboradorId === id), o => o.data, 'desc');
  };
  observacoes.recentes = function (n) {
    return u.sortBy(this.todos(), o => o.data, 'desc').slice(0, n || 20);
  };
  observacoes.noPeriodo = function (colabId, de, ate) {
    const d = de ? u.startOfDay(de).getTime() : -Infinity;
    const a = ate ? u.startOfDay(ate).getTime() + 86399999 : Infinity;
    return u.sortBy(this.onde(o => {
      if (colabId && o.colaboradorId !== colabId) return false;
      const t = (u.parseDate(o.data) || new Date()).getTime();
      return t >= d && t <= a;
    }), o => o.data, 'desc');
  };

  /* ------------------------------------------------------------------ */
  /*  Feedbacks                                                         */
  /* ------------------------------------------------------------------ */
  const feedbacks = new Repo('feedbacks');
  feedbacks.doColaborador = function (id) {
    return u.sortBy(this.onde(f => f.colaboradorId === id), f => f.data, 'desc');
  };
  feedbacks.noPeriodo = function (colabId, de, ate) {
    return observacoes.noPeriodo.call(feedbacks, colabId, de, ate);
  };

  /* ------------------------------------------------------------------ */
  /*  One a Ones                                                        */
  /* ------------------------------------------------------------------ */
  const oneones = new Repo('oneones');

  oneones.doColaborador = function (id) {
    return u.sortBy(this.onde(o => o.colaboradorId === id), o => o.data, 'desc');
  };
  oneones.concluidos = function (colabId) {
    return u.sortBy(this.onde(o => o.status === 'concluido' && (!colabId || o.colaboradorId === colabId)), o => o.data, 'desc');
  };
  oneones.ultimoConcluido = function (colabId) {
    return this.concluidos(colabId)[0] || null;
  };
  /** Rascunho aberto (em andamento) do colaborador, se existir. */
  oneones.emAndamento = function (colabId) {
    return this.onde(o => o.colaboradorId === colabId && o.status === 'em_andamento')[0] || null;
  };

  /** Modelo vazio de um encontro. */
  oneones.novoModelo = function (colabId) {
    const ult = oneones.ultimoConcluido(colabId);
    const colab = colaboradores.por(colabId);
    return {
      colaboradorId: colabId,
      data: u.nowISO(),
      status: 'em_andamento',
      periodoInicio: ult ? ult.data : (colab && colab.dataEntrada) || u.toISODate(u.addDays(new Date(), -30)),
      periodoFim: u.nowISO(),
      roteiro: {
        comoEsta: '', conquistas: '', dificuldades: '',
        autoavaliacao: { fezBem: '', poderiaMelhor: '', dificuldade: '', apoio: '' },
        positivos: [], desenvolver: [], compromissos: [], fechamento: ''
      },
      observacoesDiscutidas: [],
      feedbacksDiscutidos: [],
      competencias: {}
    };
  };

  /* ------------------------------------------------------------------ */
  /*  Planos de acao                                                    */
  /* ------------------------------------------------------------------ */
  const planos = new Repo('planos');

  /** Status efetivo: marca atrasado quando o prazo venceu e nao concluiu. */
  planos.statusEfetivo = function (p) {
    if (!p) return 'nao_iniciado';
    if (p.status === 'concluido' || p.status === 'cancelado') return p.status;
    if (p.prazo && u.diffDays(p.prazo, new Date()) > 0) return 'atrasado';
    return p.status || 'nao_iniciado';
  };
  planos.doColaborador = function (id) {
    return u.sortBy(this.onde(p => p.colaboradorId === id), p => p.prazo || '9999');
  };
  planos.abertos = function (colabId) {
    return this.onde(p => (!colabId || p.colaboradorId === colabId) &&
      ['concluido', 'cancelado'].indexOf(planos.statusEfetivo(p)) < 0);
  };
  planos.atrasados = function (colabId) {
    return this.onde(p => (!colabId || p.colaboradorId === colabId) && planos.statusEfetivo(p) === 'atrasado');
  };
  planos.venceEm = function (dias) {
    return this.onde(p => {
      const st = planos.statusEfetivo(p);
      if (st === 'concluido' || st === 'cancelado' || st === 'atrasado') return false;
      if (!p.prazo) return false;
      const d = u.daysUntil(p.prazo);
      return d >= 0 && d <= dias;
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Autoavaliacoes (modulo preparado para o colaborador)              */
  /* ------------------------------------------------------------------ */
  const autoavaliacoes = new Repo('autoavaliacoes');
  autoavaliacoes.doColaborador = function (id) {
    return u.sortBy(this.onde(a => a.colaboradorId === id), a => a.data, 'desc');
  };
  autoavaliacoes.ultima = function (id) { return this.doColaborador(id)[0] || null; };

  /* ------------------------------------------------------------------ */
  /*  Notificacoes lidas/descartadas                                    */
  /* ------------------------------------------------------------------ */
  const notificacoes = new Repo('notificacoes');

  /* ------------------------------------------------------------------ */
  /*  Config (chave/valor em uma unica colecao)                         */
  /* ------------------------------------------------------------------ */
  const configRepo = new Repo('config');
  const config = {
    get(chave, padrao) {
      const r = cache.config.find(x => x.id === chave);
      return r ? r.valor : padrao;
    },
    set(chave, valor) {
      const existe = cache.config.find(x => x.id === chave);
      if (existe) return configRepo.atualizar(chave, { valor });
      return configRepo.criar({ id: chave, valor });
    },
    tudo() { const o = {}; cache.config.forEach(x => { o[x.id] = x.valor; }); return o; }
  };

  /* ------------------------------------------------------------------ */
  /*  Bootstrap                                                         */
  /* ------------------------------------------------------------------ */
  const db = {
    colaboradores, observacoes, feedbacks, oneones, planos,
    autoavaliacoes, notificacoes, config,
    cache,

    /** Executa fn lendo em outro escopo e devolve o resultado. */
    comEscopo(escopo, fn) {
      const anterior = _escopo;
      _escopo = escopo;
      try { return fn(); } finally { _escopo = anterior; }
    },
    /**
     * Fixa o escopo ate a proxima troca de rota (o roteador reseta para
     * 'operacao' antes de cada render). Necessario porque os cliques de
     * filtro dentro de uma tela acontecem DEPOIS do render — um escopo
     * so por chamada nao os alcancaria.
     */
    setEscopo(escopo) { _escopo = escopo; },
    escopo() { return _escopo; },

    /** Total de registros de demonstracao em todas as colecoes. */
    totalExemplos() {
      return App.COLECOES.reduce((n, c) => n + cache[c].filter(x => x.exemplo).length, 0);
    },

    carregar() {
      return App.adapter.init()
        .then(() => Promise.all(App.COLECOES.map(c => App.adapter.list(c).then(arr => { cache[c] = arr || []; }))))
        .then(() => { App.bus.emit('dados:carregado'); return cache; });
    },

    /** Banco recem-instalado: nao ha absolutamente nada gravado. */
    vazio() {
      return cache.colaboradores.length === 0;
    },

    /** Nao ha equipe real cadastrada (so exemplos, ou nada). */
    semEquipe() {
      return cache.colaboradores.filter(x => !x.exemplo).length === 0;
    },

    /** Exporta um snapshot completo (backup / migracao de backend). */
    exportar() {
      const out = { versao: 1, geradoEm: u.nowISO(), dados: {} };
      App.COLECOES.forEach(c => { out.dados[c] = cache[c]; });
      return out;
    },

    /** Importa snapshot substituindo tudo. */
    importar(snapshot) {
      const d = (snapshot && snapshot.dados) || {};
      return Promise.all(App.COLECOES.map(c => {
        const arr = Array.isArray(d[c]) ? d[c] : [];
        cache[c] = arr;
        return App.adapter.replaceAll(c, arr);
      })).then(() => { App.bus.emit('dados:carregado'); notificar('*', 'recarregar', null); return true; });
    },

    limpar() {
      return App.adapter.limparTudo().then(() => {
        App.COLECOES.forEach(c => { cache[c] = []; });
        App.bus.emit('dados:carregado');
        notificar('*', 'recarregar', null);
        return true;
      });
    }
  };

  App.db = db;
})(window.App);
