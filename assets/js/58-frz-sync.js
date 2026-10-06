/* ══════════════════════════════════════════════════════════════════
   58-frz-sync.js — botão "⟳ Sincronizar ZS" da Pipeline Comercial.

   Desde 06/10/2026 a fonte é o ZS (Sales Cube), não mais o FRZ // PIPELINE
   HUD. O HUD dependia de cada consultor lançar à mão; venda que estava no ZS
   e não foi lançada lá simplesmente não aparecia (caso da Gabriela em
   outubro/2026: R$ 6.994,96 no ZS, nada na Pipeline).

   Como funciona
   ─────────────
   O navegador não consegue ler o ZS (exige login e não libera CORS). Então o
   botão chama a rota /api/sync-zs do servidor do Meta Master, que roda neste
   PC (http://localhost:8765). Ela executa o Sincronizar-ZS.ps1 -Aplicar:
   lê as vendas ganhas do mês no ZS (Vitória + Teresina) e grava em Firebase
   pipelineSales/<mês>. Como o resultado fica no Firebase, os três endereços
   do dashboard (Local, Desktop e GitHub Pages) passam a mostrar o mesmo.

   Regras (todas no Sincronizar-ZS.ps1)
   ────────────────────────────────────
   • Espelho fiel: o ZS manda. Perdeu o "ganho" ou trocou de dono → sai daqui.
   • Só mexe no que tem _frz:true e é de consultor do escopo. Venda lançada à
     mão no app nunca é tocada. Os lançamentos antigos do HUD (frz_*) saem.
   • Valor LÍQUIDO item a item: Coaching Individual pela metade (o outro 50% é
     do coach). Item de R$ 0,00 (matrícula, bônus, 2ª vaga) não entra.
   • Só o mês vigente — a mesma trava de antes.
   • Pablo entra como EXTRACLASSE, pelo mesmo caminho (não precisa mais do
     Sync-Extraclasse-ZS.ps1 para a Pipeline).

   Fora deste PC, ou com o Meta Master desligado, o botão avisa e não mexe em
   nada. O ⟳ Sincronizar FRZ da aba Turmas (63-turma-frz-sync.js) continua no
   HUD e usa as constantes publicadas em window.FRZ, no fim deste arquivo.
   ══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* Rota do servidor do Meta Master que roda o Sincronizar-ZS.ps1 */
  var SYNC_ZS_URL = 'http://localhost:8765/api/sync-zs';
  var SYNC_ZS_TIMEOUT = 200000;   /* a leitura do ZS leva ~40 s; folga para o CRM lento */

  /* ── Constantes do HUD: só a aba Turmas ainda usa (window.FRZ, abaixo) ── */
  var SB_URL = 'https://mnfxnepsfdfcmoglmgec.supabase.co/rest/v1/pipeline_entries';
  var SB_KEY = 'sb_publishable_hbmxtsjNBloNR6CYBXZ8Zw_FQeMZXOC';
  /* Nome no HUD → nome do consultor no app. ⚠️ A chave tem que ser IGUALZINHA
     ao campo `consultant` do Supabase, senão o consultor some sem erro. */
  var CONSULTORES = {
    'Gabriela':          'GABRIELA SOUZA',
    'Karla':             'KARLA FERREIRA',
    'Heverton Leonardo': 'HEVERTON LEONARDO',
    'Natália':           'NATALIA OLIVEIRA'
  };
  var EXTRACLASSE_NOME = 'EXTRACLASSE';
  var STATUS = { 'FECHADO':'pago', 'ABERTO':'aberto', 'PROJEÇÃO':'negociacao' };
  function _stKey(s){
    return String(s||'').normalize('NFD').replace(/[^\x00-\x7F]/g,'').toUpperCase().trim();
  }
  var _STATUS_N = {};
  Object.keys(STATUS).forEach(function(k){ _STATUS_N[_stKey(k)] = STATUS[k]; });
  function _statusApp(s){ return _STATUS_N[_stKey(s)]; }

  var LS_ULTIMA = 'frzSyncUltima';
  var ROTULO = '⟳ Sincronizar ZS';
  var _rodando = false;

  function _toast(msg, cor){
    if(typeof window._showToast === 'function') window._showToast(msg, cor||'var(--accent)');
    else console.log('[ZS]', msg);
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
    el.textContent = v ? ('ZS: ' + v) : '';
  }

  function _brl(n){
    return 'R$ ' + (+n||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ── Sincronização (botão ⟳ Sincronizar ZS) ───────────────────── */
  window.npSyncFrz = function(){
    if(_rodando) return;
    if(typeof window._fbGet !== 'function'){
      _toast('⚠️ Firebase offline — não dá pra recarregar a Pipeline.', 'var(--amber)');
      return;
    }
    var mk = (typeof window._mesKey === 'function') ? window._mesKey() : null;
    if(!mk){ _toast('⚠️ Mês não identificado.', 'var(--amber)'); return; }
    /* Trava: só o mês vigente. Evita mexer no histórico. */
    var hoje = new Date();
    var mkHoje = hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0');
    if(mk !== mkHoje){
      _toast('⚠️ A sincronização com o ZS só roda no mês vigente (' + mkHoje + '). Volte para o mês atual.', 'var(--amber)');
      return;
    }

    _rodando = true;
    _marcarBotao('⟳ Lendo o ZS…', true);

    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var tmr = ctrl ? setTimeout(function(){ ctrl.abort(); }, SYNC_ZS_TIMEOUT) : null;
    var semServidor = false;

    fetch(SYNC_ZS_URL + '?periodo=' + encodeURIComponent(mk), { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .catch(function(err){
        /* rede recusou: servidor desligado, outro PC, ou permissão de rede local negada */
        semServidor = !(err && err.name === 'AbortError');
        throw err;
      })
      .then(function(r){
        return r.json().catch(function(){ throw new Error('resposta inválida do servidor (HTTP ' + r.status + ')'); });
      })
      .then(function(j){
        if(!j || !j.ok){
          var det = (j && (j.erro || (j.falhas && j.falhas.join('; ')))) || 'erro desconhecido';
          throw new Error(det);
        }
        /* Recarrega o cache do mês e repinta */
        return window._fbGet('pipelineSales/' + mk).then(function(d){
          window._npVendasAvulso = d || {};
          if(typeof window._npRenderTudo === 'function') window._npRenderTudo();
          return j;
        });
      })
      .then(function(j){
        var quando = new Date().toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
        try{ localStorage.setItem(LS_ULTIMA, quando); }catch(e){}
        _mostrarUltima();
        var partes = [];
        if(j.novos)       partes.push(j.novos + ' novo' + (j.novos>1?'s':''));
        if(j.atualizados) partes.push(j.atualizados + ' atualizado' + (j.atualizados>1?'s':''));
        if(j.removidos)   partes.push(j.removidos + ' removido' + (j.removidos>1?'s':''));
        var base = j.vendas + ' venda' + (j.vendas!==1?'s':'') + ' no ZS · ' + _brl(j.totalPago);
        _toast(partes.length
          ? '✅ ZS: ' + partes.join(', ') + ' (' + base + ').'
          : '✅ ZS: já estava tudo em dia (' + base + ').');
      })
      .catch(function(err){
        console.error('[ZS] sync falhou', err);
        if(semServidor){
          _toast('⚠️ Não achei o servidor do Meta Master neste PC (localhost:8765). Abra o Meta Master e clique de novo — a leitura do ZS só roda no PC do Pablo.', 'var(--amber)');
        } else if(err && err.name === 'AbortError'){
          _toast('⏱️ O ZS demorou demais para responder. Tente de novo em instantes.', 'var(--amber)');
        } else {
          _toast('❌ Sincronização com o ZS falhou: ' + (err && err.message || 'erro') + '.', 'var(--red)');
        }
      })
      .then(function(){
        if(tmr) clearTimeout(tmr);
        _rodando = false;
        _marcarBotao(ROTULO, false);
      });
  };

  /* ── Constantes compartilhadas com a aba Turmas ──────────────────
     O 63-turma-frz-sync.js (⟳ Sincronizar FRZ da aba Turmas) ainda lê o HUD e
     precisa do MESMO mapa de consultores e de-para de status. A fonte é uma
     só, publicada aqui. */
  window.FRZ = {
    CONSULTORES: CONSULTORES,
    EXTRACLASSE_NOME: EXTRACLASSE_NOME,
    STATUS: STATUS,
    stKey: _stKey,
    statusApp: _statusApp,
    SB_URL: SB_URL,
    SB_KEY: SB_KEY
  };

  document.addEventListener('DOMContentLoaded', _mostrarUltima);
  if(document.readyState !== 'loading') _mostrarUltima();
})();
