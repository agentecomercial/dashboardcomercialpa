/* =========================================================================
   services/14-adapter-firebase.js — Persistência compartilhada (Firebase RTDB)

   Faz os três endereços (localhost:5500, file:// e GitHub Pages) lerem e
   gravarem a MESMA base: o que é cadastrado em um aparece nos outros.

   Implementa a mesma interface de App.LocalAdapter, então nenhuma tela
   precisa saber que o backend mudou. O SDK do Firebase é carregado por um
   <script type="module"> INLINE no index.html (módulo externo via src é
   bloqueado em file://) e exposto em window.EvoluiFB.

   Se o Firebase não estiver disponível — sem internet, SDK bloqueado — o
   boot cai no localStorage e o app continua funcionando offline.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u;

  /**
   * @param fb    window.EvoluiFB — { db, ref, get, set, update, remove, onValue }
   * @param raiz  nó do Realtime Database (padrão: 'evolui')
   */
  function FirebaseAdapter(fb, raiz) {
    this.nome = 'Firebase';
    this.fb = fb;
    this.raiz = raiz || 'evolui';
    this.cache = {};
    this._assinado = false;
  }

  /* ------------------------------------------------------------------ */
  /*  Conversões: o RTDB guarda objetos indexados por id, o app usa array */
  /* ------------------------------------------------------------------ */
  function paraArray(obj) {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj.filter(Boolean);
    return Object.keys(obj).map(k => obj[k]).filter(Boolean);
  }
  function paraObjeto(arr) {
    const o = {};
    (arr || []).forEach(x => { if (x && x.id) o[String(x.id)] = x; });
    return o;
  }
  /** O RTDB rejeita undefined; normaliza para null. */
  function limpar(v) {
    if (v === undefined) return null;
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(limpar);
    const o = {};
    Object.keys(v).forEach(k => { if (v[k] !== undefined) o[k] = limpar(v[k]); });
    return o;
  }

  FirebaseAdapter.prototype._ref = function (caminho) {
    return this.fb.ref(this.fb.db, this.raiz + (caminho ? '/' + caminho : ''));
  };

  /* ------------------------------------------------------------------ */
  /*  init: carrega tudo e passa a ouvir mudanças de outros navegadores   */
  /* ------------------------------------------------------------------ */
  FirebaseAdapter.prototype.init = function () {
    const self = this;
    return this.fb.get(this._ref()).then(snap => {
      const dados = snap.exists() ? snap.val() : {};
      App.COLECOES.forEach(c => { self.cache[c] = paraArray(dados[c]); });
      self._ouvir();
      return true;
    });
  };

  /** Espelha no app o que outro endereço gravar. */
  FirebaseAdapter.prototype._ouvir = function () {
    if (this._assinado) return;
    this._assinado = true;
    const self = this;

    this.fb.onValue(this._ref(), snap => {
      const dados = snap.exists() ? snap.val() : {};
      let mudou = false;

      App.COLECOES.forEach(c => {
        const novo = paraArray(dados[c]);
        /* comparação por conteúdo: a escrita local volta como eco e não
           pode disparar um re-render em loop */
        if (JSON.stringify(novo) !== JSON.stringify(self.cache[c] || [])) {
          self.cache[c] = novo;
          if (App.db && App.db.cache) App.db.cache[c] = novo;
          mudou = true;
        }
      });

      if (mudou) {
        App.bus.emit('dados:externo', null);
        App.bus.emit('dados:mudou', { colecao: '*', acao: 'sincronizar', doc: null });
      }
    }, erro => {
      console.warn('[firebase] sincronização interrompida:', erro && erro.message);
      App.bus.emit('sync:erro', erro);
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Interface do adapter                                              */
  /* ------------------------------------------------------------------ */
  FirebaseAdapter.prototype.list = function (c) {
    return Promise.resolve((this.cache[c] || []).slice());
  };

  FirebaseAdapter.prototype.insert = function (c, doc) {
    if (!doc.id) doc.id = u.uid(c.slice(0, 3));
    doc.criadoEm = doc.criadoEm || u.nowISO();
    this.cache[c] = (this.cache[c] || []).concat([doc]);
    return this.fb.set(this._ref(c + '/' + doc.id), limpar(doc)).then(() => doc);
  };

  FirebaseAdapter.prototype.update = function (c, id, patch) {
    const arr = (this.cache[c] || []).slice();
    const i = arr.findIndex(x => x.id === id);
    const atualizado = Object.assign({}, i >= 0 ? arr[i] : { id }, patch, { id });
    if (i >= 0) { arr[i] = atualizado; this.cache[c] = arr; }
    return this.fb.update(this._ref(c + '/' + id), limpar(patch)).then(() => atualizado);
  };

  FirebaseAdapter.prototype.remove = function (c, id) {
    this.cache[c] = (this.cache[c] || []).filter(x => x.id !== id);
    return this.fb.remove(this._ref(c + '/' + id)).then(() => true);
  };

  FirebaseAdapter.prototype.replaceAll = function (c, arr) {
    this.cache[c] = (arr || []).slice();
    return this.fb.set(this._ref(c), limpar(paraObjeto(arr))).then(() => arr);
  };

  FirebaseAdapter.prototype.limparTudo = function () {
    const self = this;
    App.COLECOES.forEach(c => { self.cache[c] = []; });
    return this.fb.remove(this._ref()).then(() => true);
  };

  App.FirebaseAdapter = FirebaseAdapter;

  /* ------------------------------------------------------------------ */
  /*  Escolha do backend no boot                                        */
  /* ------------------------------------------------------------------ */
  /**
   * Aguarda o SDK (carregado inline no index.html) por até `ms` e devolve o
   * adapter do Firebase. Se não vier, mantém o localStorage: melhor um app
   * offline funcionando do que uma tela de erro.
   */
  /** Nunca deixa o boot pendurado: promessa sem resposta vira erro. */
  function comPrazo(promessa, ms, rotulo) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('tempo esgotado (' + rotulo + ')')), ms);
      promessa.then(
        v => { clearTimeout(t); resolve(v); },
        e => { clearTimeout(t); reject(e); }
      );
    });
  }

  App.escolherAdapter = function (ms) {
    const limite = ms || 6000;

    return new Promise(resolve => {
      if (window.EvoluiFB && window.EvoluiFB.db) return resolve(window.EvoluiFB);
      if (window.EvoluiFBErro) return resolve(null);

      let pronto = false;
      const fim = () => { if (!pronto) { pronto = true; resolve(window.EvoluiFB || null); } };
      window.addEventListener('evolui-fb:pronto', fim, { once: true });
      window.addEventListener('evolui-fb:erro', () => { pronto = true; resolve(null); }, { once: true });
      setTimeout(fim, limite);
    }).then(fb => {
      if (!fb || !fb.db) {
        console.warn('[adapter] Firebase indisponível — usando armazenamento local.');
        App.bus.emit('backend:local', null);
        return App.adapter;                       // segue com o LocalAdapter
      }

      const remoto = new FirebaseAdapter(fb, 'evolui');
      const local = App.adapter;

      /* O RTDB abre WebSocket; em file:// (origem nula) a conexao pode
         simplesmente nunca responder. Sem prazo, o boot travaria. */
      return comPrazo(remoto.init(), 12000, 'conexão com a base compartilhada')
        .then(() => migrarSeNecessario(local, remoto))
        .then(() => {
          App.adapter = remoto;
          App.bus.emit('backend:firebase', null);
          return remoto;
        })
        .catch(e => {
          console.warn('[adapter] falha ao conectar no Firebase:', e && e.message);
          App.bus.emit('backend:local', e);
          return App.adapter;
        });
    });
  };

  /**
   * Primeira conexão: sobe a operação deste navegador quando a base
   * compartilhada ainda não tem NENHUM colaborador real.
   *
   * O critério é "colaborador real", não "base vazia": um navegador que
   * abriu antes pode ter deixado só os exemplos no Firebase, e isso não
   * pode impedir o envio da equipe de verdade. Havendo operação lá, nada
   * é sobrescrito.
   */
  function migrarSeNecessario(local, remoto) {
    const remotoTemOperacao = (remoto.cache.colaboradores || []).some(x => !x.exemplo);
    if (remotoTemOperacao) return Promise.resolve(false);

    return local.init()
      .then(() => Promise.all(App.COLECOES.map(c => local.list(c))))
      .then(listas => {
        const pacote = {};
        App.COLECOES.forEach((c, i) => { pacote[c] = listas[i] || []; });

        const reais = (pacote.colaboradores || []).filter(x => !x.exemplo).length;
        /* sem equipe real aqui, não há o que enviar — evita que um navegador
           recém-aberto publique apenas os exemplos na base compartilhada */
        if (!reais) return false;
        console.info('[adapter] enviando base local para o Firebase (' +
          reais + ' colaborador(es) da operação).');

        return Promise.all(App.COLECOES.map(c => remoto.replaceAll(c, pacote[c])))
          .then(() => { App.bus.emit('backend:migrado', { colaboradores: reais }); return true; });
      })
      .catch(() => false);
  }
})(window.App);
