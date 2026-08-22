/* =========================================================================
   core/03-router.js — Roteador por hash (funciona em file:// e http://)
   Rotas: #/dashboard  #/equipe  #/colaborador/:id  #/colaborador/:id/:aba
          #/observacoes  #/feedbacks  #/one-a-one  #/one-a-one/:id
          #/preparar/:colabId  #/planos  #/indicadores  #/config
   ========================================================================= */
(function (App) {
  'use strict';

  const rotas = [];
  let atual = null;
  let anterior = null;          // ultima rota INTERNA visitada
  let naoEncontrado = null;

  const Router = {
    /** add('/colaborador/:id/:aba?', handler) */
    add(padrao, handler) {
      const partes = padrao.split('/').filter(Boolean);
      rotas.push({ padrao, partes, handler });
      return Router;
    },
    fallback(fn) { naoEncontrado = fn; return Router; },

    /** Navega. replace=true nao empilha no historico. */
    go(hash, replace) {
      const h = hash.charAt(0) === '#' ? hash : '#' + (hash.charAt(0) === '/' ? '' : '/') + hash;
      if (location.hash === h) { Router.resolve(); return; }
      if (replace) location.replace(location.pathname + location.search + h);
      else location.hash = h;
    },

    /**
     * Volta para a rota interna anterior. Nao usa history.back(): dentro de
     * um iframe (ou ao abrir o app direto numa rota) o back sai do app e
     * deixa a tela em branco. Sem rota anterior, cai no destino informado.
     */
    voltar(destinoPadrao) {
      if (anterior && anterior !== atualCaminho()) Router.go(anterior);
      else Router.go(destinoPadrao || '/dashboard');
    },

    /** Rota interna anterior, se houver. */
    anterior() { return anterior; },

    atual() { return atual; },

    resolve() {
      const bruto = (location.hash || '#/dashboard').replace(/^#\/?/, '');
      const [caminho, qs] = bruto.split('?');
      const segs = caminho.split('/').filter(Boolean);
      const query = {};
      if (qs) qs.split('&').forEach(p => {
        const [k, v] = p.split('=');
        if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });

      for (const r of rotas) {
        const params = casa(r.partes, segs);
        if (params) {
          const caminhoNovo = '/' + segs.join('/');
          if (atual && atual.caminho !== caminhoNovo) anterior = atual.caminho;
          atual = { padrao: r.padrao, caminho: caminhoNovo, params, query, segs };
          App.state.set('rota', atual);
          App.bus.emit('rota:mudou', atual);
          try { r.handler(params, query); } catch (e) {
            console.error('[router]', e);
            if (App.toast) App.toast.erro('Erro ao abrir a tela', e.message || String(e));
          }
          return;
        }
      }
      if (naoEncontrado) naoEncontrado(segs);
    },

    iniciar() {
      window.addEventListener('hashchange', Router.resolve);
      Router.resolve();
    }
  };

  function atualCaminho() { return atual ? atual.caminho : null; }

  function casa(partes, segs) {
    const params = {};
    let i = 0, j = 0;
    while (i < partes.length) {
      const p = partes[i];
      const opcional = p.slice(-1) === '?';
      const nome = p.replace(/^:|\?$/g, '');
      const s = segs[j];
      if (p.charAt(0) === ':') {
        if (s === undefined) { if (!opcional) return null; i++; continue; }
        params[nome] = s; i++; j++; continue;
      }
      if (s !== p) return null;
      i++; j++;
    }
    return j === segs.length ? params : null;
  }

  App.router = Router;
})(window.App);
