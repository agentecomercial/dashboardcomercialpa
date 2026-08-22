/* ═══════════════════════════════════════════════════════════════════
   EVOLUI · Feedback contínuo e One a One — módulo isolado (card da home)
   ───────────────────────────────────────────────────────────────────
   O Evolui é uma aplicação completa e independente (one-a-one/index.html)
   com shell, rotas e persistência próprios. Aqui ele entra embutido em
   iframe — mesmo padrão dos decks de Regras Comerciais — para não haver
   nenhum conflito de CSS, de rota por hash ou de estado com o dashboard.

   API (window):
     abrirEvolui()        ← card da home
     voltarHomeEvolui()   ← volta para a home (turmasScreen)

   Roda via file:// e online. Não altera nada do que já existe.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var APP_URL = 'one-a-one/index.html?tema=dark';
  var COR = '74,222,128';           /* verde — matiz livre entre os cards */
  var _cssInjetado = false;

  /* ───────────────────────────── estilos ───────────────────────────── */
  function _injectCss() {
    if (_cssInjetado) return;
    _cssInjetado = true;
    var css = ''
      + '#evoluiScreen{display:none;background:var(--bg,#0b0e14);min-height:100vh;}'
      + '#evoluiScreen .evo-topbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;'
      +   'padding:10px 18px;background:rgba(15,18,26,.92);backdrop-filter:blur(10px);'
      +   'border-bottom:1px solid rgba(255,255,255,.08);}'
      + '#evoluiScreen .evo-back{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;'
      +   'border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);'
      +   'color:#e6e9ef;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s;}'
      + '#evoluiScreen .evo-back:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.24);}'
      + '#evoluiScreen .evo-title{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:700;color:#e6e9ef;letter-spacing:-.01em;}'
      + '#evoluiScreen .evo-badge{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;'
      +   'color:rgb(' + COR + ');background:rgba(' + COR + ',.15);border:1px solid rgba(' + COR + ',.34);'
      +   'padding:3px 8px;border-radius:999px;}'
      + '#evoluiScreen .evo-spacer{flex:1}'
      + '#evoluiScreen .evo-frame-wrap{height:calc(100vh - 53px);width:100%;background:#0a0c11;}'
      + '#evoluiScreen .evo-frame-wrap iframe{width:100%;height:100%;border:0;display:block;}'
      + '@media(max-width:768px){'
      +   '#evoluiScreen .evo-topbar{padding:8px 12px;}'
      +   '#evoluiScreen .evo-title span.evo-sub{display:none;}'
      +   '#evoluiScreen .evo-frame-wrap{height:calc(100vh - 49px);}'
      + '}';
    var tag = document.createElement('style');
    tag.id = 'evoluiCss';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  /* ─────────────────────── tela hospedeira ─────────────────────── */
  function _registrarNoArrayTelas() {
    try {
      if (typeof window._TELAS !== 'undefined' && Array.isArray(window._TELAS)) {
        if (window._TELAS.indexOf('evoluiScreen') < 0) window._TELAS.push('evoluiScreen');
      }
    } catch (e) {}
  }

  function _ensureScreen() {
    var host = document.getElementById('evoluiScreen');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'evoluiScreen';
    host.style.display = 'none';
    document.body.appendChild(host);
    return host;
  }

  function _montarShell() {
    var host = _ensureScreen();
    /* o iframe só é criado uma vez: recriar reiniciaria o app e perderia
       a tela em que o coordenador estava. */
    if (host.querySelector('iframe')) return host;

    host.innerHTML = ''
      + '<div class="evo-topbar">'
      +   '<button class="evo-back" onclick="window.voltarHomeEvolui()">‹ Voltar</button>'
      +   '<div class="evo-title">🌱 Evolui <span class="evo-sub" style="font-weight:500;opacity:.6">· Feedback contínuo e One a One</span></div>'
      +   '<span class="evo-badge">Pessoas</span>'
      +   '<div class="evo-spacer"></div>'
      +   '<button class="evo-back" onclick="window.open(\'' + APP_URL + '\',\'_blank\',\'noopener\')">↗ Nova aba</button>'
      + '</div>'
      + '<div class="evo-frame-wrap">'
      +   '<iframe src="' + APP_URL + '" title="Evolui — feedback contínuo e One a One" '
      +     'allow="clipboard-write; fullscreen" allowfullscreen></iframe>'
      + '</div>';
    return host;
  }

  /* ───────────────────────────── API ───────────────────────────── */
  window.abrirEvolui = function () {
    _injectCss();
    _registrarNoArrayTelas();
    _montarShell();

    if (typeof window._mostrarTela === 'function') {
      window._mostrarTela('evoluiScreen', false);
    } else {
      ['turmasScreen', 'telaTurmasScreen', 'mapeamentoScreen', 'novaPipelineScreen', 'dashboard',
       'loginScreen', 'propostaComercialScreen', 'turmaInativaScreen', 'trapScreen',
       'bibScreen', 'regrasScreen'].forEach(function (t) {
        var el = document.getElementById(t); if (el) el.style.display = 'none';
      });
      document.getElementById('evoluiScreen').style.display = 'block';
    }
    window.scrollTo(0, 0);
  };

  window.voltarHomeEvolui = function () {
    if (typeof window._mostrarTela === 'function') {
      window._mostrarTela('turmasScreen', false);
    } else {
      var host = document.getElementById('evoluiScreen'); if (host) host.style.display = 'none';
      var home = document.getElementById('turmasScreen'); if (home) home.style.display = '';
    }
  };
})();
