/* =========================================================================
   services/10-adapter.js — Camada de persistencia PLUGAVEL.

   Toda a aplicacao fala apenas com esta interface. Trocar de localStorage
   para Supabase / Firebase / API propria = escrever outro adapter com os
   mesmos metodos e registrar em App.adapter.

   Interface (tudo assincrono, sempre Promise):
     init()                     -> carrega/prepara a fonte
     list(colecao)              -> Array
     insert(colecao, doc)       -> doc gravado (com id)
     update(colecao, id, patch) -> doc atualizado
     remove(colecao, id)        -> true
     replaceAll(colecao, arr)   -> arr
     limparTudo()               -> true
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u;

  const COLECOES = [
    'colaboradores', 'observacoes', 'feedbacks', 'oneones',
    'planos', 'autoavaliacoes', 'notificacoes', 'config'
  ];
  App.COLECOES = COLECOES;

  /* ===================================================================== */
  /*  Adapter local (localStorage)                                         */
  /* ===================================================================== */
  function LocalAdapter(prefixo) {
    this.nome = 'localStorage';
    this.prefixo = prefixo || 'oao:';
    this.cache = {};
  }

  LocalAdapter.prototype._key = function (c) { return this.prefixo + c; };

  LocalAdapter.prototype._ler = function (c) {
    if (this.cache[c]) return this.cache[c];
    let arr = [];
    try {
      const raw = localStorage.getItem(this._key(c));
      if (raw) arr = JSON.parse(raw);
      if (!Array.isArray(arr)) arr = [];
    } catch (e) {
      console.warn('[adapter] falha ao ler', c, e);
      arr = [];
    }
    this.cache[c] = arr;
    return arr;
  };

  LocalAdapter.prototype._gravar = function (c, arr) {
    this.cache[c] = arr;
    try {
      localStorage.setItem(this._key(c), JSON.stringify(arr));
    } catch (e) {
      console.error('[adapter] falha ao gravar', c, e);
      App.bus.emit('dados:erro', { colecao: c, erro: e });
      throw e;
    }
    return arr;
  };

  LocalAdapter.prototype.init = function () {
    COLECOES.forEach(c => this._ler(c));
    return Promise.resolve(true);
  };

  LocalAdapter.prototype.list = function (c) { return Promise.resolve(this._ler(c).slice()); };

  LocalAdapter.prototype.insert = function (c, doc) {
    const arr = this._ler(c).slice();
    if (!doc.id) doc.id = u.uid(c.slice(0, 3));
    doc.criadoEm = doc.criadoEm || u.nowISO();
    arr.push(doc);
    this._gravar(c, arr);
    return Promise.resolve(doc);
  };

  LocalAdapter.prototype.update = function (c, id, patch) {
    const arr = this._ler(c).slice();
    const i = arr.findIndex(x => x.id === id);
    if (i < 0) return Promise.reject(new Error('Registro nao encontrado: ' + c + '/' + id));
    arr[i] = Object.assign({}, arr[i], patch, { id: id, atualizadoEm: u.nowISO() });
    this._gravar(c, arr);
    return Promise.resolve(arr[i]);
  };

  LocalAdapter.prototype.remove = function (c, id) {
    const arr = this._ler(c).filter(x => x.id !== id);
    this._gravar(c, arr);
    return Promise.resolve(true);
  };

  LocalAdapter.prototype.replaceAll = function (c, arr) {
    this._gravar(c, arr.slice());
    return Promise.resolve(arr);
  };

  LocalAdapter.prototype.limparTudo = function () {
    COLECOES.forEach(c => { this.cache[c] = []; localStorage.removeItem(this._key(c)); });
    return Promise.resolve(true);
  };

  /* ===================================================================== */
  /*  Adapter de memoria (fallback quando localStorage esta bloqueado)      */
  /* ===================================================================== */
  function MemoryAdapter() {
    LocalAdapter.call(this, 'mem:');
    this.nome = 'memoria';
  }
  MemoryAdapter.prototype = Object.create(LocalAdapter.prototype);
  MemoryAdapter.prototype.constructor = MemoryAdapter;
  MemoryAdapter.prototype._ler = function (c) { return (this.cache[c] = this.cache[c] || []); };
  MemoryAdapter.prototype._gravar = function (c, arr) { this.cache[c] = arr; return arr; };
  MemoryAdapter.prototype.limparTudo = function () { this.cache = {}; return Promise.resolve(true); };

  /* ===================================================================== */
  /*  Esqueleto para backend remoto — pronto para ser preenchido            */
  /*  Ex.: new App.RestAdapter('https://api.suaempresa.com', () => token)   */
  /* ===================================================================== */
  function RestAdapter(baseUrl, tokenFn) {
    this.nome = 'rest';
    this.base = String(baseUrl).replace(/\/$/, '');
    this.tokenFn = tokenFn || (() => null);
  }
  RestAdapter.prototype._req = function (metodo, caminho, corpo) {
    const h = { 'Content-Type': 'application/json' };
    const tk = this.tokenFn();
    if (tk) h.Authorization = 'Bearer ' + tk;
    return fetch(this.base + caminho, {
      method: metodo, headers: h, body: corpo ? JSON.stringify(corpo) : undefined
    }).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + caminho);
      return r.status === 204 ? true : r.json();
    });
  };
  RestAdapter.prototype.init       = function () { return Promise.resolve(true); };
  RestAdapter.prototype.list       = function (c) { return this._req('GET', '/' + c); };
  RestAdapter.prototype.insert     = function (c, doc) { return this._req('POST', '/' + c, doc); };
  RestAdapter.prototype.update     = function (c, id, patch) { return this._req('PATCH', '/' + c + '/' + id, patch); };
  RestAdapter.prototype.remove     = function (c, id) { return this._req('DELETE', '/' + c + '/' + id); };
  RestAdapter.prototype.replaceAll = function (c, arr) { return this._req('PUT', '/' + c, arr); };
  RestAdapter.prototype.limparTudo = function () { return this._req('DELETE', '/tudo'); };

  App.LocalAdapter = LocalAdapter;
  App.MemoryAdapter = MemoryAdapter;
  App.RestAdapter = RestAdapter;

  /* Adapter ativo — trocar aqui para migrar de backend. */
  function criarPadrao() {
    try {
      const k = '__oao_test__';
      localStorage.setItem(k, '1'); localStorage.removeItem(k);
      return new LocalAdapter('oao:');
    } catch (e) {
      console.warn('[adapter] localStorage indisponivel, usando memoria.');
      return new MemoryAdapter();
    }
  }
  App.adapter = criarPadrao();
})(window.App);
