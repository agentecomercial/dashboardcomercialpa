/* ═══════════════════════════════════════════════════════════════════
   APP "PROPOSTA" — tela cheia, foco exclusivo em montar proposta
   ───────────────────────────────────────────────────────────────────
   Liga com  dashboard.html?modo=proposta  (ou #proposta).

   É o MESMO arquivo e os MESMOS scripts do dashboard — de propósito.
   Assim tudo que evolui no Montar Proposta (regras de faixa, Modo de
   Exceção, textos da Seção I, lote, PDF) vale nos dois na mesma hora,
   sem cópia para sincronizar depois.

   O app NÃO mostra nenhuma outra aba do painel. Nada de tela de
   turmas, mapeamento, pipeline ou dashboard: só o Montar Proposta,
   ocupando a janela inteira, com uma barra fina no topo.

   A turma (de onde vêm os clientes e consultores) é escolhida por um
   seletor da própria barra — sem sair da tela.

   Desligar sem reverter:
     localStorage.setItem('modo_proposta_off','1'); location.reload();
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var VERSAO = '1.0';
  var TELAS  = ['turmasScreen','telaTurmasScreen','mapeamentoScreen','dashboard',
                'propostaComercialScreen','turmaInativaScreen','novaPipelineScreen'];

  var ligado = /[?&]modo=proposta(?:&|$)/.test(location.search)
            || location.hash === '#proposta';
  if(!ligado) return;
  try{ if(localStorage.getItem('modo_proposta_off') === '1') return; }catch(e){}

  document.documentElement.classList.add('modo-proposta');
  document.title = 'Proposta';
  window._modoProposta = true;
  window._propostaAppVersao = VERSAO;

  /* ── Moldura: card em tela cheia, barra de 38px no topo ───────── */
  var st = document.createElement('style');
  st.textContent =
    /* nenhuma tela do painel aparece neste app */
    'html.modo-proposta #' + TELAS.join(',html.modo-proposta #') + '{display:none !important;}'
  + 'html.modo-proposta body{padding-top:38px;background:var(--bg);}'
  /* o overlay do modal deixa de ser modal: vira a página */
  + 'html.modo-proposta #propostaOverlay{position:static !important;background:transparent !important;'
  + 'padding:0 !important;display:none;}'
  + 'html.modo-proposta #propostaOverlay.open{display:flex !important;}'
  + 'html.modo-proposta #propostaOverlay > div{width:100% !important;max-width:none !important;'
  + 'border-radius:0 !important;border-left:none !important;border-right:none !important;'
  + 'min-height:calc(100vh - 38px);}'
  + 'html.modo-proposta #propostaOverlay > div > div:nth-child(2){min-height:calc(100vh - 120px) !important;}'
  /* barra do app */
  + 'html.modo-proposta #mp-barra{position:fixed;top:0;left:0;right:0;height:38px;z-index:1500;'
  + 'display:flex;align-items:center;gap:9px;padding:0 14px;background:var(--surface);'
  + 'border-bottom:1px solid var(--border2);font-family:\'DM Sans\',sans-serif;}'
  + 'html.modo-proposta #mp-barra .n{font-size:13px;font-weight:800;color:var(--text);}'
  + 'html.modo-proposta #mp-barra .v{font-size:10px;color:var(--muted);}'
  + 'html.modo-proposta #mp-barra .sp{flex:1;}'
  + 'html.modo-proposta #mp-barra button{height:26px;padding:0 11px;border-radius:var(--radius-sm);'
  + 'background:none;border:1px solid var(--border2);color:var(--muted);font-size:11px;font-weight:700;'
  + 'cursor:pointer;font-family:inherit;white-space:nowrap;}'
  + 'html.modo-proposta #mp-barra button.pri{background:rgba(200,240,90,.14);'
  + 'border-color:rgba(200,240,90,.45);color:var(--accent);}'
  /* seletor de turma */
  + 'html.modo-proposta #mp-turmas{position:fixed;top:40px;right:14px;z-index:1600;width:330px;'
  + 'max-height:70vh;overflow-y:auto;background:var(--surface);border:1px solid var(--border2);'
  + 'border-radius:10px;box-shadow:0 14px 40px rgba(0,0,0,.55);display:none;padding:6px;}'
  + 'html.modo-proposta #mp-turmas.open{display:block;}'
  + 'html.modo-proposta #mp-turmas .it{padding:9px 11px;border-radius:7px;cursor:pointer;font-size:12px;'
  + 'color:var(--text);}'
  + 'html.modo-proposta #mp-turmas .it:hover{background:var(--surface2);}'
  + 'html.modo-proposta #mp-turmas .it small{display:block;color:var(--muted);font-size:10.5px;margin-top:1px;}'
  + 'html.modo-proposta #mp-turmas .vazio{padding:12px;color:var(--muted);font-size:11.5px;line-height:1.5;}';
  document.head.appendChild(st);

  /* ── Barra do app ─────────────────────────────────────────────── */
  function _barra(){
    if(document.getElementById('mp-barra')) return;
    var b = document.createElement('div');
    b.id = 'mp-barra';
    b.innerHTML = '<span class="n">📄 Proposta</span><span class="v">v' + VERSAO + '</span>'
      + '<span class="sp"></span>'
      + '<button id="mp-btn-turma" onclick="_mpTurmas()" title="Escolher de qual turma vêm os clientes">Turma: —</button>'
      + '<button class="pri" onclick="_mpAbrir()">Montar proposta</button>'
      + '<button onclick="logout()">Sair</button>';
    document.body.appendChild(b);

    var d = document.createElement('div');
    d.id = 'mp-turmas';
    document.body.appendChild(d);

    document.addEventListener('click', function(ev){
      var m = document.getElementById('mp-turmas');
      if(!m || !m.classList.contains('open')) return;
      if(m.contains(ev.target) || ev.target.id === 'mp-btn-turma') return;
      m.classList.remove('open');
    });
  }

  function _rotuloTurma(){
    var t = window._turmaAtiva;
    var bt = document.getElementById('mp-btn-turma');
    if(!bt) return;
    bt.textContent = 'Turma: ' + (t ? (t.nome || t.codigo || t.id) : '—');
  }

  /* ── Seletor de turma, dentro do próprio app ──────────────────── */
  function _mpTurmas(){
    var m = document.getElementById('mp-turmas');
    if(!m) return;
    if(m.classList.contains('open')){ m.classList.remove('open'); return; }
    m.classList.add('open');
    m.innerHTML = '<div class="vazio">Carregando turmas…</div>';

    if(typeof window._fbGet !== 'function'){
      m.innerHTML = '<div class="vazio">Sem conexão com o Firebase. Você ainda pode montar a proposta digitando o cliente manualmente.</div>';
      return;
    }
    window._fbGet('turmas').then(function(ts){
      var lista = [];
      if(ts && typeof ts === 'object'){
        Object.keys(ts).forEach(function(id){
          var t = ts[id];
          if(!t) return;
          lista.push({ id:id, nome:t.nome || t.titulo || id, codigo:t.codigo || '', ativa:t.ativa });
        });
      }
      lista.sort(function(a,b){ return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
      if(!lista.length){
        m.innerHTML = '<div class="vazio">Nenhuma turma encontrada.</div>';
        return;
      }
      m.innerHTML = lista.map(function(t){
        return '<div class="it" onclick="_mpEntrarTurma(\'' + t.id + '\')">' + t.nome
             + (t.codigo ? '<small>' + t.codigo + '</small>' : '') + '</div>';
      }).join('');
    }).catch(function(e){
      m.innerHTML = '<div class="vazio">Falha ao ler as turmas: ' + (e && e.message ? e.message : e) + '</div>';
    });
  }

  function _mpEntrarTurma(id){
    var m = document.getElementById('mp-turmas');
    if(m) m.classList.remove('open');
    if(typeof window.entrarTurma === 'function') window.entrarTurma(id);
    /* entrarTurma termina em _mostrarTela('dashboard'), que o gancho
       abaixo transforma em "abrir a proposta". */
  }

  /* ── Abrir o Montar Proposta ──────────────────────────────────── */
  function _mpAbrir(){
    if(typeof window.abrirPropostaModal !== 'function'){
      if(window._showToast) _showToast('⚠️ Proposta ainda carregando…', 'var(--amber)');
      return;
    }
    window.abrirPropostaModal();
    _rotuloTurma();
    var sub = document.getElementById('propostaSub');
    if(sub && !window._turmaAtiva){
      sub.textContent = 'Escolha a turma no topo para carregar os clientes, ou digite o cliente manualmente';
    }
  }

  /* ── Gancho: nenhuma tela do painel entra em cena ─────────────── */
  function _instalarGancho(){
    var orig = window._mostrarTela;
    if(typeof orig !== 'function') return false;
    window._mostrarTela = function(id, useFlex){
      orig.call(window, id, useFlex);
      if(id === 'loginScreen') return;          /* o login precisa aparecer */
      /* qualquer outra tela do painel fica fora: este app é só proposta */
      TELAS.forEach(function(t){
        var el = document.getElementById(t);
        if(el) el.style.display = 'none';
      });
      /* 'dashboard' significa que a turma terminou de carregar */
      if(id === 'dashboard') setTimeout(_mpAbrir, 80);
      else if(!document.querySelector('#propostaOverlay.open')) setTimeout(_mpAbrir, 80);
    };
    return true;
  }

  /* Fechar a proposta não pode deixar tela vazia: reabre. */
  function _instalarFechar(){
    var orig = window.fecharPropostaModal;
    if(typeof orig !== 'function') return false;
    window.fecharPropostaModal = function(){
      orig.apply(window, arguments);
      setTimeout(function(){
        var log = document.getElementById('loginScreen');
        var logAberto = log && log.style.display && log.style.display !== 'none';
        if(!logAberto && !document.querySelector('#propostaOverlay.open')) _mpAbrir();
      }, 30);
    };
    return true;
  }

  window._mpAbrir       = _mpAbrir;
  window._mpTurmas      = _mpTurmas;
  window._mpEntrarTurma = _mpEntrarTurma;

  function _boot(){
    _barra();
    _instalarGancho();
    _instalarFechar();
    /* Se a sessão já estava válida, o login não passa por _mostrarTela:
       abre a proposta assim que os scripts terminarem. */
    setTimeout(function(){
      var log = document.getElementById('loginScreen');
      var logAberto = log && log.style.display && log.style.display !== 'none';
      if(!logAberto && !document.querySelector('#propostaOverlay.open')) _mpAbrir();
    }, 400);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();
})();
