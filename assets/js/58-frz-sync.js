/* ══════════════════════════════════════════════════════════════════
   58-frz-sync.js — Importa os lançamentos do FRZ // PIPELINE HUD
   (https://frz-pipeline-hud.vercel.app) para as VENDAS AVULSAS da
   Pipeline Comercial.

   Como funciona
   ─────────────
   O HUD grava tudo no Supabase, tabela `pipeline_entries`, filtrando por
   `consultant` (nome curto: "Gabriela") + `month` ("AAAA-MM"). A leitura é
   anônima (chave publishable), então dá pra ler direto do navegador — sem
   servidor no meio.

   Regras combinadas (03/08/2026)
   ──────────────────────────────
   • Só entram os consultores listados em CONSULTORES (hoje: Gabriela).
     Para incluir outro, basta acrescentar a linha "Nome no HUD": "NOME NO APP".
   • Status: FECHADO → pago, ABERTO → aberto. PROJEÇÃO não é importada.
   • ESPELHO FIEL: o HUD manda. Editou lá → atualiza aqui; apagou lá (ou
     virou PROJEÇÃO) → some daqui. Vendas importadas ficam com _frz:true e
     NÃO devem ser editadas no app — a próxima sincronização sobrescreve.
   • Só roda quando se clica em "⟳ Sincronizar FRZ" (nada automático).
   • SÓ o mês vigente (hoje = agosto/2026). Com a tela em qualquer outro mês
     o botão recusa e avisa — julho e anteriores ficam intocados, tanto para
     importar quanto para remover.

   Detalhes de conversão
   ─────────────────────
   • valor: vai o valor cheio do lançamento. A regra do HUD de contar
     metade em "C.I" é do gauge deles, não vale como valor de venda.
   • und > 1: o app não tem campo de quantidade em venda avulsa, então a
     quantidade entra no nome do produto ("MASTER COACHING ×2").
   ══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var SB_URL = 'https://mnfxnepsfdfcmoglmgec.supabase.co/rest/v1/pipeline_entries';
  var SB_KEY = 'sb_publishable_hbmxtsjNBloNR6CYBXZ8Zw_FQeMZXOC';

  /* Nome no HUD  →  nome do consultor no app (Gestão de Usuários) */
  var CONSULTORES = {
    'Gabriela': 'GABRIELA SOUZA',
    'Karla':    'KARLA FERREIRA'   /* liberada em 03/08/2026 */
  };

  /* Status do HUD → status da Pipeline. Ausente = não importa. */
  var STATUS = { 'FECHADO':'pago', 'ABERTO':'aberto' };

  var LS_ULTIMA = 'frzSyncUltima';
  var _rodando = false;

  function _toast(msg, cor){
    if(typeof window._showToast === 'function') window._showToast(msg, cor||'var(--accent)');
    else console.log('[FRZ]', msg);
  }

  /* Data: o HUD já grava data_iso (AAAA-MM-DD). Sem ela, monta a partir de
     "dd/mm" + o ano/mês da chave do mês. */
  function _data(e, mk){
    if(e.data_iso && /^\d{4}-\d{2}-\d{2}$/.test(e.data_iso)) return e.data_iso;
    var m = /^(\d{2})\/(\d{2})$/.exec(String(e.data||''));
    if(m) return mk.slice(0,4) + '-' + m[2] + '-' + m[1];
    return mk + '-01';
  }

  /* Objeto de venda avulsa no formato que a Pipeline já usa
     (mesmos campos de npSalvarVenda) */
  function _venda(e, mk){
    var und = +(e.und||1);
    var produto = String(e.curso||'').trim() + (und > 1 ? ' ×'+und : '');
    return {
      clienteNome:   String(e.aluno||'').trim(),
      consultorNome: CONSULTORES[e.consultant],
      produto:       produto,
      valor:         +(e.valor||0),
      status:        STATUS[e.status],
      data:          _data(e, mk),
      origemManual:  'FRZ HUD' + (e.origem ? ' · ' + e.origem : ''),
      obs:           '',
      mes:           mk,
      _src:          'avulso',
      _frz:          true,
      frzId:         e.id,
      ts:            Date.parse(e.created_at) || Date.now()
    };
  }

  /* Compara só o que vem do HUD — ignora ts pra não regravar à toa */
  function _igual(a, b){
    if(!a || !b) return false;
    return a.clienteNome === b.clienteNome
        && a.consultorNome === b.consultorNome
        && a.produto === b.produto
        && (+a.valor||0) === (+b.valor||0)
        && a.status === b.status
        && a.data === b.data
        && a.origemManual === b.origemManual;
  }

  function _buscar(mk){
    var nomes = Object.keys(CONSULTORES);
    if(!nomes.length) return Promise.resolve([]);
    var url = SB_URL
      + '?select=*'
      + '&month=eq.' + encodeURIComponent(mk)
      + '&consultant=in.' + encodeURIComponent('(' + nomes.map(function(n){ return '"'+n+'"'; }).join(',') + ')')
      + '&status=in.' + encodeURIComponent('(' + Object.keys(STATUS).map(function(s){ return '"'+s+'"'; }).join(',') + ')')
      + '&limit=2000';
    return fetch(url, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
      .then(function(r){
        if(!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  function _marcarBotao(txt, disabled){
    var b = document.getElementById('npBtnFrzSync');
    if(!b) return;
    b.textContent = txt;
    b.disabled = !!disabled;
    b.style.opacity = disabled ? '.6' : '';
  }

  function _mostrarUltima(){
    var el = document.getElementById('npFrzUltima');
    if(!el) return;
    var v = null;
    try{ v = localStorage.getItem(LS_ULTIMA); }catch(e){}
    el.textContent = v ? ('FRZ: ' + v) : '';
  }

  /* ── Sincronização (botão ⟳ Sincronizar FRZ) ───────────────────── */
  window.npSyncFrz = function(){
    if(_rodando) return;
    if(typeof window._fbGet !== 'function' || typeof window._fbSave !== 'function'){
      _toast('⚠️ Firebase offline — não dá pra gravar a importação.', 'var(--amber)');
      return;
    }
    var mk = (typeof window._mesKey === 'function') ? window._mesKey() : null;
    if(!mk){ _toast('⚠️ Mês não identificado.', 'var(--amber)'); return; }
    /* Trava: só o mês vigente. Evita mexer no histórico (julho e anteriores). */
    var hoje = new Date();
    var mkHoje = hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0');
    if(mk !== mkHoje){
      _toast('⚠️ A sincronização do FRZ só roda no mês vigente (' + mkHoje + '). Volte para o mês atual.', 'var(--amber)');
      return;
    }

    _rodando = true;
    _marcarBotao('⟳ Sincronizando…', true);

    Promise.all([ _buscar(mk), window._fbGet('pipelineSales/' + mk) ])
      .then(function(res){
        var remotos = res[0] || [];
        var locais  = res[1] || {};
        var novos = 0, atualizados = 0, removidos = 0;
        var ops = [];

        /* 1) HUD → app: cria ou atualiza */
        remotos.forEach(function(e){
          if(!CONSULTORES[e.consultant] || !STATUS[e.status]) return;
          var id = 'frz_' + e.id;
          var novo = _venda(e, mk);
          var atual = locais[id];
          if(!atual){ novos++; }
          else if(_igual(atual, novo)){ return; }   /* nada mudou */
          else { atualizados++; }
          ops.push(window._fbSave('pipelineSales/' + mk + '/' + id, novo));
        });

        /* 2) Apagado no HUD (ou virou PROJEÇÃO) → remove aqui.
              Só mexe no que veio do FRZ e é de consultor do escopo — venda
              lançada à mão no app nunca é tocada. */
        var vivos = {};
        remotos.forEach(function(e){ vivos['frz_' + e.id] = true; });
        Object.keys(locais).forEach(function(id){
          var v = locais[id];
          if(!v || !v._frz) return;
          var doEscopo = Object.keys(CONSULTORES).some(function(n){
            return CONSULTORES[n] === v.consultorNome;
          });
          if(!doEscopo) return;
          if(vivos[id]) return;
          removidos++;
          ops.push(window._fbSave('pipelineSales/' + mk + '/' + id, null));
        });

        return Promise.all(ops).then(function(){
          return { novos:novos, atualizados:atualizados, removidos:removidos, total:remotos.length };
        });
      })
      .then(function(r){
        /* Recarrega o cache do mês e repinta */
        return window._fbGet('pipelineSales/' + mk).then(function(d){
          window._npVendasAvulso = d || {};
          if(typeof window._npRenderTudo === 'function') window._npRenderTudo();
          return r;
        });
      })
      .then(function(r){
        var quando = new Date().toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
        try{ localStorage.setItem(LS_ULTIMA, quando); }catch(e){}
        _mostrarUltima();
        var partes = [];
        if(r.novos)       partes.push(r.novos + ' novo' + (r.novos>1?'s':''));
        if(r.atualizados) partes.push(r.atualizados + ' atualizado' + (r.atualizados>1?'s':''));
        if(r.removidos)   partes.push(r.removidos + ' removido' + (r.removidos>1?'s':''));
        _toast(partes.length
          ? '✅ FRZ: ' + partes.join(', ') + '.'
          : '✅ FRZ: já estava tudo em dia (' + r.total + ' lançamento' + (r.total!==1?'s':'') + ').');
      })
      .catch(function(err){
        console.error('[FRZ] sync falhou', err);
        _toast('❌ Não consegui ler o FRZ HUD (' + (err && err.message || 'erro') + ').', 'var(--red)');
      })
      .then(function(){
        _rodando = false;
        _marcarBotao('⟳ Sincronizar FRZ', false);
      });
  };

  document.addEventListener('DOMContentLoaded', _mostrarUltima);
  if(document.readyState !== 'loading') _mostrarUltima();
})();
