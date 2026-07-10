/* ═══════════════════════════════════════════════════════════════════
   MÓDULO TREINAMENTOS / APRESENTAÇÕES
   ───────────────────────────────────────────────────────────────────
   Isolado em IIFE. Não toca em nenhuma funcionalidade existente do
   dashboard. Roda via file:// (sem fetch, sem ES modules).

   API PÚBLICA (window):
     abrirTreinamentosApresentacoes()  ← chamado pelo 4º card da home
     voltarHomeTrap()                   ← botão Voltar interno

   DEPENDÊNCIAS (já presentes no dashboard):
     window.TRAP_REGISTRO    (seed em treinamentos/registro-inicial.js)
     window._fbGet/_fbSet/_fbChange  (stubs em 00-firebase-stubs.js)
     window._getSessao       (sessão p/ checar perfil admin)
     window._showToast       (notificações)

   PERSISTÊNCIA FIREBASE:
     treinamentos/overrides/{id}   → flags editáveis pelo admin
     treinamentos/adicionados/{id} → conteúdos adicionados via UI

   TELAS INTERNAS (navegáveis):
     1. Painel principal · lista + filtros
     2. Adicionar conteúdo · Caminho A (Claude) + Caminho B (HTML)
     3. Admin · gestão tabular + histórico
     4. (futuro) Editor de apresentação
     5. (futuro) Editor de treinamento
     6. (futuro) Modo apresentação fullscreen
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* ── Estado interno ─────────────────────────────────────────────── */
  var _montado = false;
  var _overrides = {};
  var _adicionados = {};
  var _telaAtual = 'painel'; /* painel | adicionar | admin | visualizar */
  var _filtroTipo = '';
  var _filtroStatus = 'publicado';
  var _filtroProduto = '';
  var _busca = '';
  var _modoGestao = false;
  var _listenerOver = null;
  var _listenerAdd = null;
  var _itemVisualizando = null;
  var _indiceMod = 0; /* item selecionado dentro de item.estrutura (índice nas partes VISÍVEIS) */

  /* ── Busca "estilo Word" dentro do treinamento (Ctrl+F) ─────────────
     Índice = todas as partes VISÍVEIS fatiadas em slides. Montado via
     fetch() (igual à impressão): só funciona ONLINE — em file:// o
     navegador bloqueia a leitura das partes e mostramos o aviso. */
  var _findOpen = false;         /* painel de busca aberto */
  var _findTerm = '';            /* termo digitado */
  var _findWord = false;         /* opção "palavra inteira" */
  var _findHits = [];            /* [{pi, slideId, ei, n, snip}] — 1 por slide com match */
  var _findActive = -1;          /* índice ativo em _findHits */
  var _findIndex = null;         /* [{pi, slideId, titulo, eyebrow, texto, textoN}] */
  var _findIndexFor = null;      /* id do item cujo índice está em _findIndex */
  var _findIndexing = false;     /* montando índice */
  var _findIndexErro = false;    /* fetch bloqueado (file://) */
  var _findPendingGoto = null;   /* {slideId, term} a aplicar quando o iframe recarregar */
  var _findDebounce = null;      /* timer do auto-pular ao digitar */

  /* ── Curadoria de páginas (ocultar partes da exibição em tela cheia) ── */
  var _gerPaginas = false;      /* painel "Gerenciar páginas" aberto */
  var _prevPaginas = false;     /* modo pré-visualização (mostra só o que ficará visível) */
  var _stagingOcultas = null;   /* array de URLs marcadas p/ ocultar, ainda não salvas */

  /* ── Estado do wizard Claude (Caminho A) ───────────────────────── */
  var _claudeStep = 1;
  var _claudePdfs = [];  /* [{name, size, dataUrl}] */
  var _claudeBriefing = { desc:'', tipo:'treinamento', produto:'', tema:'black-tie', publico:'' };
  var _claudeHtml = '';  /* HTML colado/editado */

  /* ── Helpers ────────────────────────────────────────────────────── */
  function _esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function _ehAdmin(){
    var s = (typeof window._getSessao === 'function') ? window._getSessao() : null;
    var p = s ? (s.perfil || s.role || '').toLowerCase() : '';
    return p === 'adm' || p === 'admin' || p === 'master' || p === 'gestor';
  }
  function _toast(msg, cor){
    if(typeof window._showToast === 'function') window._showToast(msg, cor || 'var(--accent)');
  }
  function _slug(s){
    return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0, 50) || ('item-' + Date.now());
  }

  /* ── Mesclagem SEED + adicionados + overrides ──────────────────── */
  function _getItens(){
    var seed = window.TRAP_REGISTRO || [];
    var todos = seed.concat(Object.values(_adicionados || {}));
    return todos.map(function(i){
      return Object.assign({}, i, _overrides[i.id] || {});
    }).sort(function(a, b){
      return (a.ordem || 999) - (b.ordem || 999);
    });
  }

  /* ── CSS injetado uma vez ───────────────────────────────────────── */
  function _injectCss(){
    if(document.getElementById('trapCss')) return;
    var css = ''
      /* ── Tela host segue padrão de #loginScreen/#turmasScreen (main.css:3):
            position:fixed cobrindo viewport. Sem isso, a safety net em
            18-usuarios.js força o login a aparecer sobreposto. ─────── */
      + '#trapScreen{ position:fixed; top:0; left:0; width:100%; height:100%; overflow-y:auto; overflow-x:hidden; z-index:1; -webkit-overflow-scrolling:touch; overscroll-behavior-y:contain; }'
      /* Layout base */
      + '.trap-app{ font-family:"DM Sans","Inter",sans-serif; color:var(--text); padding:24px; max-width:1280px; margin:0 auto; }'
      + '.trap-topbar{ display:flex; align-items:center; gap:14px; padding:12px 0 20px; border-bottom:1px solid var(--border); margin-bottom:24px; }'
      + '.trap-back{ background:none; border:1px solid var(--border); color:var(--muted,#9aa5b1); font-size:13px; font-weight:600; padding:7px 14px; border-radius:8px; cursor:pointer; font-family:inherit; transition:all .15s; }'
      + '.trap-back:hover{ color:var(--text); border-color:var(--border2,rgba(255,255,255,.14)); }'
      + '.trap-tit{ font-size:14px; font-weight:700; display:flex; align-items:center; gap:8px; }'
      + '.trap-spacer{ flex:1; }'
      + '.trap-nav-pills{ display:flex; gap:4px; background:var(--bg-3,#1c2128); border:1px solid var(--border); padding:4px; border-radius:10px; }'
      + '.trap-nav-pill{ background:none; border:none; color:var(--muted,#9aa5b1); font-size:12px; font-weight:700; padding:7px 14px; border-radius:7px; cursor:pointer; font-family:inherit; }'
      + '.trap-nav-pill.active{ background:rgba(200,240,90,.12); color:var(--accent); }'
      + '.trap-nav-pill:hover:not(.active){ color:var(--text); }'
      + '.trap-toggle-gestao{ background:rgba(200,240,90,.08); border:1px solid rgba(200,240,90,.25); color:var(--accent); font-size:11px; font-weight:700; padding:7px 12px; border-radius:8px; cursor:pointer; font-family:inherit; }'
      + '.trap-toggle-gestao.on{ background:var(--accent); color:var(--bg); }'

      /* Hero */
      + '.trap-hero{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:24px; padding-bottom:18px; border-bottom:1px solid var(--border); }'
      + '.trap-hero h1{ font-size:24px; font-weight:800; margin:0 0 6px; background:linear-gradient(135deg, #f0c896, #c8f05a); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }'
      + '.trap-hero p{ font-size:13px; color:var(--muted,#9aa5b1); margin:0; }'
      + '.trap-btn-primary{ background:var(--accent); border:none; color:var(--bg); padding:10px 18px; border-radius:9px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; display:inline-flex; align-items:center; gap:7px; transition:all .15s; }'
      + '.trap-btn-primary:hover{ transform:translateY(-1px); box-shadow:0 8px 24px rgba(200,240,90,.3); }'
      + '.trap-btn-sec{ background:transparent; border:1px solid var(--border2,rgba(255,255,255,.14)); color:var(--text); padding:9px 14px; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer; font-family:inherit; }'
      + '.trap-btn-sec:hover{ border-color:var(--accent); color:var(--accent); }'

      /* Stats */
      + '.trap-stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:22px; }'
      + '.trap-stat{ background:var(--bg-3,#1c2128); border:1px solid var(--border); border-radius:10px; padding:14px 16px; }'
      + '.trap-stat-n{ font-size:22px; font-weight:800; color:var(--text); }'
      + '.trap-stat-l{ font-size:10px; font-weight:700; color:var(--muted,#9aa5b1); text-transform:uppercase; letter-spacing:.06em; margin-top:4px; }'

      /* Tabs e filtros */
      + '.trap-tabs{ display:flex; gap:4px; margin-bottom:18px; background:var(--bg-3,#1c2128); border:1px solid var(--border); padding:4px; border-radius:10px; width:fit-content; }'
      + '.trap-tabs button{ background:none; border:none; color:var(--muted,#9aa5b1); font-size:12px; font-weight:700; padding:8px 16px; border-radius:7px; cursor:pointer; font-family:inherit; }'
      + '.trap-tabs button.active{ background:rgba(200,240,90,.12); color:var(--accent); }'
      + '.trap-filtros{ display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap; align-items:center; }'
      + '.trap-input, .trap-select{ background:var(--bg-3,#1c2128); border:1px solid var(--border); color:var(--text); font-size:12px; font-family:inherit; padding:9px 12px; border-radius:8px; }'
      + '.trap-input{ min-width:240px; }'
      + '.trap-input:focus, .trap-select:focus{ outline:none; border-color:var(--accent); }'
      + '.trap-chip{ background:var(--bg-3,#1c2128); border:1px solid var(--border); color:var(--muted,#9aa5b1); font-size:11px; font-weight:600; padding:8px 12px; border-radius:8px; cursor:pointer; font-family:inherit; }'
      + '.trap-chip.active{ background:rgba(200,240,90,.10); border-color:rgba(200,240,90,.35); color:var(--accent); }'

      /* Grid de cards */
      + '.trap-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:14px; }'
      + '.trap-card{ background:linear-gradient(180deg, var(--bg-3,#1c2128), #161b22); border:1px solid rgba(56,189,248,.45); border-radius:14px; padding:16px; position:relative; display:flex; flex-direction:column; transition:all .2s; cursor:pointer; box-shadow:0 0 14px rgba(56,189,248,.10); }'
      + '.trap-card:hover{ transform:translateY(-2px); border-color:rgba(56,189,248,.85); box-shadow:0 12px 36px rgba(0,0,0,.4), 0 0 20px rgba(56,189,248,.28); }'
      + '.trap-card.oculto{ opacity:.45; }'
      + '.trap-card-thumb{ aspect-ratio:16/9; background:linear-gradient(135deg, rgba(212,165,116,.15), rgba(212,165,116,.04)); border:1px solid var(--border); border-radius:10px; margin-bottom:12px; display:flex; align-items:center; justify-content:center; font-size:36px; color:#f0c896; }'
      + '.trap-card-thumb.t-trein{ background:linear-gradient(135deg, rgba(96,165,250,.15), rgba(96,165,250,.04)); color:var(--blue,#60a5fa); }'
      + '.trap-card-thumb.t-apres{ background:linear-gradient(135deg, rgba(167,139,250,.15), rgba(167,139,250,.04)); color:var(--purple,#a78bfa); }'
      + '.trap-card-thumb.t-ring{ background:linear-gradient(135deg, rgba(248,113,113,.16), rgba(248,113,113,.04)); color:var(--red,#f87171); }'
      + '.trap-card-thumb{ position:relative; overflow:hidden; }'
      + '.trap-thumb-img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; }'
      + '.trap-thumb-edit{ position:absolute; top:6px; right:6px; width:27px; height:27px; border-radius:7px; background:rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.20); color:#fff; font-size:13px; line-height:1; cursor:pointer; display:none; align-items:center; justify-content:center; padding:0; backdrop-filter:blur(2px); z-index:2; }'
      + '.trap-thumb-edit:hover{ background:rgba(0,0,0,.75); border-color:#fff; }'
      + '.trap-thumb-edit.del{ right:39px; }'
      + '.trap-card-thumb:hover .trap-thumb-edit{ display:inline-flex; }'
      + '.trap-poster:hover .trap-thumb-edit{ display:inline-flex; }'
      + '.trap-listrow:hover .trap-thumb-edit{ display:inline-flex; }'
      /* ── Seletor de modo de visualização ── */
      + '.trap-viewseg{ display:inline-flex; background:var(--surface2,#1c2128); border:1px solid var(--border); border-radius:9px; padding:2px; gap:2px; }'
      + '.trap-viewseg button{ background:none; border:none; color:var(--muted,#9aa5b1); border-radius:7px; padding:6px 11px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; transition:all .15s; }'
      + '.trap-viewseg button:hover{ color:var(--text,#e6edf3); }'
      + '.trap-viewseg button.on{ background:rgba(56,189,248,.16); color:#38bdf8; }'
      /* ── Modo PÔSTER (vertical) ── */
      + '.trap-grid-poster{ display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:14px; }'
      + '.trap-poster{ position:relative; border-radius:13px; overflow:hidden; aspect-ratio:3/4.1; cursor:pointer; border:1px solid var(--border); transition:transform .18s, box-shadow .18s; }'
      + '.trap-poster:hover{ box-shadow:0 16px 40px rgba(0,0,0,.5); border-color:rgba(255,255,255,.28); }'
      + '.trap-poster.oculto{ opacity:.5; }'
      + '.trap-poster .trap-poster-bg{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:46px; background:linear-gradient(160deg,#0e1322,#1b2540); color:#f0c896; }'
      + '.trap-poster .trap-poster-bg.t-trein{ background:linear-gradient(160deg, rgba(96,165,250,.28), rgba(16,26,52,.95)); color:#9cc2ff; }'
      + '.trap-poster .trap-poster-bg.t-apres{ background:linear-gradient(160deg, rgba(167,139,250,.28), rgba(28,18,52,.95)); color:#c4b5fd; }'
      + '.trap-poster .trap-poster-bg.t-ring{ background:linear-gradient(160deg, rgba(248,113,113,.28), rgba(52,18,18,.95)); color:#fca5a5; }'
      + '.trap-poster .trap-thumb-img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }'
      + '.trap-poster .trap-poster-grad{ position:absolute; inset:0; background:linear-gradient(transparent 65%, rgba(3,8,18,.37) 84%, rgba(3,8,18,.78)); opacity:0; transition:opacity .2s; }'
      + '.trap-poster:hover .trap-poster-grad{ opacity:1; }'
      + '.trap-poster-cap{ position:absolute; left:0; right:0; bottom:0; padding:14px 14px 16px; z-index:2; opacity:0; transition:opacity .2s; }'
      + '.trap-poster:hover .trap-poster-cap{ opacity:1; }'
      + '.trap-poster-prod{ font-size:21px; font-weight:900; color:#fff; line-height:1.1; text-transform:uppercase; text-shadow:1px 1px 0 rgba(0,0,0,.45), 2px 2px 0 rgba(0,0,0,.38), 3px 3px 0 rgba(0,0,0,.30), 4px 4px 9px rgba(0,0,0,.60), 0 0 2px rgba(0,0,0,.5); }'
      + '.trap-poster-tit{ font-size:10.5px; color:#eaf0f6; margin-top:5px; line-height:1.35; text-shadow:1px 1px 0 rgba(0,0,0,.45), 0 2px 5px rgba(0,0,0,.55); }'
      + '.trap-poster-cap .trap-badge{ margin-bottom:8px; }'
      + '.trap-poster-kebab{ position:absolute; top:8px; right:8px; z-index:3; width:30px; height:30px; border-radius:8px; background:rgba(0,0,0,.5); border:1px solid rgba(255,255,255,.20); color:#fff; font-size:18px; font-weight:800; line-height:1; cursor:pointer; display:none; align-items:center; justify-content:center; padding:0; backdrop-filter:blur(2px); }'
      + '.trap-poster:hover .trap-poster-kebab{ display:flex; }'
      + '.trap-poster-kebab:hover{ background:rgba(0,0,0,.78); border-color:#fff; }'
      /* ── Modo LISTA (banner largo) ── */
      + '.trap-list{ display:flex; flex-direction:column; gap:10px; }'
      + '.trap-listrow{ display:flex; background:var(--surf,#161b22); border:1px solid var(--border); border-radius:12px; overflow:hidden; cursor:pointer; min-height:104px; transition:border-color .15s, box-shadow .15s; }'
      + '.trap-listrow:hover{ border-color:var(--border2,rgba(255,255,255,.14)); box-shadow:0 10px 28px rgba(0,0,0,.35); }'
      + '.trap-listrow.oculto{ opacity:.5; }'
      + '.trap-listrow-thumb{ position:relative; width:240px; flex:0 0 auto; display:flex; align-items:center; justify-content:center; font-size:34px; overflow:hidden; }'
      + '.trap-listrow-thumb .trap-thumb-img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }'
      + '.trap-listrow-body{ flex:1; min-width:0; padding:14px 16px; display:flex; flex-direction:column; justify-content:center; }'
      + '.trap-listrow-body .trap-card-meta{ margin-bottom:7px; }'
      + '.trap-listrow-body h3{ font-size:15px; font-weight:700; margin:0 0 5px; line-height:1.3; }'
      + '.trap-listrow-body p{ font-size:11px; color:var(--muted,#9aa5b1); line-height:1.45; margin:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }'
      + '.trap-listrow-acts{ display:flex; flex-direction:column; gap:6px; align-items:stretch; justify-content:center; padding:0 14px; flex:0 0 auto; }'
      + '.trap-listrow-acts button{ background:rgba(200,240,90,.10); border:1px solid rgba(200,240,90,.30); color:var(--accent); font-size:11px; font-weight:700; padding:7px 14px; border-radius:6px; cursor:pointer; font-family:inherit; white-space:nowrap; }'
      + '.trap-listrow-acts button.sec{ background:transparent; color:var(--muted,#9aa5b1); border-color:var(--border); }'
      + '@media(max-width:680px){ .trap-listrow-thumb{ width:120px; } .trap-listrow-body p{ display:none; } }'
      + '.trap-card-meta{ display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap; }'
      + '.trap-badge{ font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; padding:3px 8px; border-radius:5px; display:inline-flex; align-items:center; gap:3px; }'
      + '.trap-badge.tr{ background:rgba(96,165,250,.14); color:var(--blue,#60a5fa); border:1px solid rgba(96,165,250,.3); }'
      + '.trap-badge.ap{ background:rgba(167,139,250,.14); color:var(--purple,#a78bfa); border:1px solid rgba(167,139,250,.3); }'
      + '.trap-badge.ring{ background:rgba(248,113,113,.14); color:var(--red,#f87171); border:1px solid rgba(248,113,113,.3); }'
      + '.trap-badge.prod{ background:rgba(212,165,116,.14); color:#f0c896; border:1px solid rgba(212,165,116,.3); }'
      + '.trap-badge.ativo{ background:rgba(52,211,153,.14); color:var(--green,#34d399); border:1px solid rgba(52,211,153,.3); }'
      + '.trap-badge.oculto{ background:rgba(239,68,68,.14); color:var(--red,#ef4444); border:1px solid rgba(239,68,68,.3); }'
      + '.trap-badge.novo{ background:var(--accent); color:var(--bg); }'
      + '.trap-card-tit{ font-size:15px; font-weight:700; margin:0 0 6px; line-height:1.3; }'
      + '.trap-card-desc{ font-size:11px; color:var(--muted,#9aa5b1); line-height:1.5; flex:1; margin:0 0 12px; }'
      + '.trap-card-foot{ display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px dashed var(--border); }'
      + '.trap-card-cta{ color:var(--accent); font-size:11px; font-weight:700; }'
      + '.trap-card-acts{ display:flex; gap:4px; }'
      + '.trap-icbtn{ background:transparent; border:1px solid var(--border); color:var(--muted,#9aa5b1); width:28px; height:28px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px; font-family:inherit; transition:all .15s; padding:0; }'
      + '.trap-icbtn:hover{ color:var(--accent); border-color:var(--accent); background:rgba(200,240,90,.06); }'
      + '.trap-icbtn.danger:hover{ color:var(--red,#ef4444); border-color:var(--red,#ef4444); background:rgba(239,68,68,.06); }'

      /* Card vazio (CTA) */
      + '.trap-card-add{ background:transparent; border:1px dashed var(--border2,rgba(255,255,255,.14)); align-items:center; justify-content:center; text-align:center; padding:30px 20px; color:var(--muted,#9aa5b1); cursor:pointer; }'
      + '.trap-card-add:hover{ border-color:var(--accent); color:var(--accent); }'
      + '.trap-card-add-ic{ font-size:36px; opacity:.4; margin-bottom:10px; }'
      + '.trap-card-add-tit{ font-size:13px; font-weight:700; margin-bottom:6px; }'
      + '.trap-card-add-sub{ font-size:11px; line-height:1.5; opacity:.8; }'

      /* Vazio total */
      + '.trap-empty{ background:var(--bg-3,#1c2128); border:1px dashed var(--border2,rgba(255,255,255,.14)); border-radius:14px; padding:60px 20px; text-align:center; color:var(--muted,#9aa5b1); }'
      + '.trap-empty-ic{ font-size:48px; opacity:.4; margin-bottom:12px; }'

      /* Tela ADICIONAR */
      + '.trap-add-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:18px; margin-bottom:24px; }'
      + '.trap-caminho{ background:linear-gradient(180deg, var(--bg-3,#1c2128), #161b22); border:1px solid var(--border); border-radius:14px; padding:22px; position:relative; }'
      + '.trap-caminho-tag{ position:absolute; top:14px; right:14px; font-size:9px; font-weight:800; padding:4px 10px; border-radius:100px; letter-spacing:.06em; color:var(--bg); }'
      + '.trap-caminho-tag.a{ background:linear-gradient(135deg, #c8f05a, #f0c896); }'
      + '.trap-caminho-tag.b{ background:linear-gradient(135deg, #60a5fa, #a78bfa); }'
      + '.trap-caminho-h{ display:flex; align-items:center; gap:12px; margin-bottom:16px; }'
      + '.trap-caminho-ic{ width:44px; height:44px; border-radius:11px; display:flex; align-items:center; justify-content:center; font-size:22px; border:1px solid; flex-shrink:0; }'
      + '.trap-caminho-ic.a{ background:rgba(200,240,90,.15); color:var(--accent); border-color:rgba(200,240,90,.3); }'
      + '.trap-caminho-ic.b{ background:rgba(96,165,250,.15); color:var(--blue,#60a5fa); border-color:rgba(96,165,250,.3); }'
      + '.trap-caminho-tag.c{ background:linear-gradient(135deg, #f0c896, #e0a050); }'
      + '.trap-caminho-ic.c{ background:rgba(240,200,150,.15); color:#f0c896; border-color:rgba(240,200,150,.3); }'
      + '.trap-cat-list{ display:flex; flex-direction:column; gap:8px; margin-bottom:14px; max-height:175px; overflow-y:auto; padding-right:5px; }'
      + '.trap-cat-list::-webkit-scrollbar{ width:8px; }'
      + '.trap-cat-list::-webkit-scrollbar-track{ background:transparent; }'
      + '.trap-cat-list::-webkit-scrollbar-thumb{ background:var(--border2,rgba(255,255,255,.16)); border-radius:4px; }'
      + '.trap-cat-list::-webkit-scrollbar-thumb:hover{ background:var(--muted,#9aa5b1); }'
      + '.trap-cat-item{ display:flex; align-items:center; gap:10px; background:var(--bg-2,#161b22); border:1px solid var(--border); border-radius:9px; padding:10px 12px; }'
      + '.trap-cat-item-ic{ font-size:18px; flex-shrink:0; }'
      + '.trap-cat-item-info{ flex:1; min-width:0; }'
      + '.trap-cat-item-t{ font-size:12px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
      + '.trap-cat-item-s{ font-size:10px; color:var(--muted,#9aa5b1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
      + '.trap-cat-item button{ background:rgba(200,240,90,.10); border:1px solid rgba(200,240,90,.30); color:var(--accent); font-size:11px; font-weight:700; padding:6px 10px; border-radius:6px; cursor:pointer; font-family:inherit; flex-shrink:0; transition:all .15s; }'
      + '.trap-cat-item button:hover{ background:rgba(200,240,90,.20); }'
      + '.trap-cat-item button.sec{ background:transparent; color:var(--muted,#9aa5b1); border-color:var(--border); padding:6px 9px; }'
      + '.trap-cat-item button.sec:hover{ color:var(--text); border-color:var(--border2,rgba(255,255,255,.14)); }'
      + '.trap-cat-menu-wrap{ flex-shrink:0; }'
      + '.trap-kebab{ font-size:16px; line-height:1; padding:5px 9px !important; font-weight:800; }'
      + '.trap-cat-menu{ display:none; position:fixed; z-index:9999; min-width:200px; background:var(--bg-2,#161b22); border:1px solid var(--border2,rgba(255,255,255,.14)); border-radius:9px; padding:5px; box-shadow:0 12px 34px rgba(0,0,0,.55); flex-direction:column; gap:2px; }'
      + '.trap-cat-menu.open{ display:flex; }'
      + '.trap-cat-menu button{ background:none !important; border:none !important; color:var(--text,#e6edf3) !important; text-align:left !important; width:100%; padding:9px 11px !important; border-radius:6px; font-size:11.5px; font-weight:600; cursor:pointer; font-family:inherit; transition:background .12s; }'
      + '.trap-cat-menu button:hover{ background:rgba(255,255,255,.08) !important; }'
      + '.trap-cat-empty{ font-size:11px; color:var(--muted,#9aa5b1); font-style:italic; padding:8px 0; }'
      + '.trap-caminho-t{ font-size:15px; font-weight:800; }'
      + '.trap-caminho-sub{ font-size:11px; color:var(--muted,#9aa5b1); }'
      + '.trap-caminho-desc{ font-size:12px; color:var(--muted,#9aa5b1); line-height:1.6; margin-bottom:16px; }'

      /* Form metadados */
      + '.trap-meta-form{ background:linear-gradient(135deg, rgba(212,165,116,.06), rgba(212,165,116,.01)); border:1px solid rgba(212,165,116,.25); border-radius:14px; padding:22px; }'
      + '.trap-meta-h{ display:flex; align-items:center; gap:12px; margin-bottom:18px; padding-bottom:14px; border-bottom:1px dashed rgba(212,165,116,.3); }'
      + '.trap-meta-h-ic{ width:36px; height:36px; border-radius:9px; background:rgba(212,165,116,.18); color:#f0c896; display:flex; align-items:center; justify-content:center; font-size:18px; }'
      + '.trap-meta-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:16px; }'
      + '.trap-fld label{ display:block; font-size:10px; font-weight:700; color:var(--muted,#9aa5b1); margin-bottom:5px; }'
      + '.trap-fld input, .trap-fld select, .trap-fld textarea{ width:100%; background:var(--bg-3,#1c2128); border:1px solid var(--border); color:var(--text); padding:9px 11px; border-radius:7px; font-size:12px; font-family:inherit; }'
      + '.trap-meta-foot{ display:flex; gap:14px; align-items:center; flex-wrap:wrap; padding-top:14px; border-top:1px dashed rgba(212,165,116,.2); }'

      /* Tela ADMIN */
      + '.trap-adm-bar{ background:var(--bg-3,#1c2128); border:1px solid var(--border); border-radius:10px; padding:14px 18px; margin-bottom:16px; display:flex; align-items:center; gap:14px; flex-wrap:wrap; }'
      + '.trap-adm-table{ width:100%; border-collapse:separate; border-spacing:0; background:var(--bg-2,#161b22); border:1px solid var(--border); border-radius:12px; overflow:hidden; }'
      + '.trap-adm-table th{ background:var(--bg-3,#1c2128); padding:10px 12px; text-align:left; font-size:9px; font-weight:800; color:var(--muted,#9aa5b1); text-transform:uppercase; letter-spacing:.06em; border-bottom:1px solid var(--border); }'
      + '.trap-adm-table td{ padding:12px; border-bottom:1px solid var(--border); font-size:12px; }'
      + '.trap-adm-table tr:hover td{ background:rgba(200,240,90,.02); }'
      + '.trap-toggle{ width:36px; height:20px; background:var(--bg-3,#1c2128); border:1px solid var(--border); border-radius:100px; position:relative; cursor:pointer; transition:all .15s; }'
      + '.trap-toggle::after{ content:""; position:absolute; left:2px; top:2px; width:14px; height:14px; background:var(--muted,#9aa5b1); border-radius:50%; transition:all .15s; }'
      + '.trap-toggle.on{ background:rgba(200,240,90,.25); border-color:var(--accent); }'
      + '.trap-toggle.on::after{ left:18px; background:var(--accent); }'

      /* Visualizador embutido (iframe) */
      + '.trap-viz{ position:fixed; inset:0; background:var(--bg-2,#161b22); z-index:5; display:flex; flex-direction:column; }'
      + '.trap-viz-bar{ display:flex; align-items:center; gap:10px; padding:10px 16px; background:var(--bg-3,#1c2128); border-bottom:1px solid var(--border); flex-shrink:0; }'
      + '.trap-viz-t{ font-size:13px; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0; }'
      + '.trap-viz-t small{ display:block; font-size:10px; font-weight:500; color:var(--muted,#9aa5b1); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
      + '.trap-viz-btn{ background:transparent; border:1px solid var(--border); color:var(--muted,#9aa5b1); padding:7px 12px; border-radius:7px; font-size:11px; font-weight:600; cursor:pointer; font-family:inherit; display:inline-flex; align-items:center; gap:5px; transition:all .15s; flex-shrink:0; }'
      + '.trap-viz-btn:hover{ color:var(--accent); border-color:var(--accent); background:rgba(200,240,90,.06); }'
      + '.trap-viz-body{ flex:1; display:grid; grid-template-columns:auto 1fr; overflow:hidden; min-height:0; }'
      + '.trap-viz-side{ background:var(--bg-2,#161b22); border-right:1px solid var(--border); width:260px; overflow-y:auto; padding:14px; }'
      + '.trap-viz-side h4{ font-size:10px; font-weight:800; color:var(--muted,#9aa5b1); text-transform:uppercase; letter-spacing:.08em; margin:0 0 12px; padding-bottom:8px; border-bottom:1px dashed var(--border); }'
      + '.trap-viz-mod{ display:block; width:100%; text-align:left; background:transparent; border:1px solid transparent; color:var(--muted,#9aa5b1); font-size:11px; font-weight:600; padding:9px 11px; border-radius:7px; cursor:pointer; font-family:inherit; margin-bottom:3px; transition:all .12s; line-height:1.4; }'
      + '.trap-viz-mod:hover{ color:var(--text); background:var(--bg-3,#1c2128); }'
      + '.trap-viz-mod.curr{ background:rgba(200,240,90,.10); border-color:rgba(200,240,90,.30); color:var(--accent); }'
      + '.trap-viz-mod-n{ display:inline-block; font-family:"DM Mono",monospace; font-size:10px; opacity:.6; margin-right:6px; }'

      /* ── Busca estilo Word (Localizar) dentro do treinamento ── */
      + '.trap-find{ display:flex; flex-direction:column; height:100%; }'
      + '.trap-find-box{ position:relative; display:flex; align-items:center; background:var(--bg-3,#1c2128); border:1px solid var(--border); border-radius:8px; padding:2px 4px 2px 10px; transition:border-color .15s; }'
      + '.trap-find-box:focus-within{ border-color:var(--accent); }'
      + '.trap-find-box .ic{ color:var(--muted,#9aa5b1); font-size:13px; margin-right:6px; }'
      + '.trap-find-box input{ flex:1; background:transparent; border:0; outline:0; color:var(--text); font-size:13px; font-family:inherit; padding:8px 4px; min-width:0; }'
      + '.trap-find-box input::placeholder{ color:var(--muted,#9aa5b1); }'
      + '.trap-find-count{ font-size:10px; color:var(--muted,#9aa5b1); font-variant-numeric:tabular-nums; padding:0 6px; white-space:nowrap; }'
      + '.trap-find-nav{ display:flex; }'
      + '.trap-find-nav button{ background:transparent; border:0; color:var(--muted,#9aa5b1); cursor:pointer; width:24px; height:26px; border-radius:5px; font-size:12px; display:flex; align-items:center; justify-content:center; }'
      + '.trap-find-nav button:hover:not(:disabled){ color:var(--accent); background:rgba(200,240,90,.08); }'
      + '.trap-find-nav button:disabled{ opacity:.3; cursor:default; }'
      + '.trap-find-clear{ background:transparent; border:0; color:var(--muted,#9aa5b1); cursor:pointer; width:22px; height:26px; border-radius:5px; font-size:13px; }'
      + '.trap-find-clear:hover{ color:var(--text); }'
      + '.trap-find-opts{ display:flex; gap:6px; margin:8px 0 4px; }'
      + '.trap-find-opt{ font-size:9px; font-weight:700; letter-spacing:.03em; color:var(--muted,#9aa5b1); background:var(--bg-3,#1c2128); border:1px solid var(--border); border-radius:6px; padding:4px 8px; cursor:pointer; user-select:none; }'
      + '.trap-find-opt.on{ color:var(--accent); border-color:rgba(200,240,90,.4); background:rgba(200,240,90,.10); }'
      + '.trap-find-summary{ font-size:10px; color:var(--muted,#9aa5b1); text-transform:uppercase; letter-spacing:.06em; font-weight:800; margin:14px 2px 8px; }'
      + '.trap-find-results{ flex:1; overflow-y:auto; margin:0 -4px; }'
      + '.trap-find-group{ margin-bottom:10px; }'
      + '.trap-find-group-h{ font-size:9px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:var(--accent); opacity:.85; padding:4px 8px; }'
      + '.trap-find-hit{ display:block; width:100%; text-align:left; background:transparent; border:1px solid transparent; border-radius:7px; padding:8px 10px; cursor:pointer; margin-bottom:2px; transition:all .12s; }'
      + '.trap-find-hit:hover{ background:var(--bg-3,#1c2128); }'
      + '.trap-find-hit.active{ background:rgba(200,240,90,.10); border-color:rgba(200,240,90,.30); }'
      + '.trap-find-hit-loc{ font-size:9.5px; font-weight:700; color:var(--muted,#9aa5b1); margin-bottom:3px; display:flex; align-items:center; gap:5px; }'
      + '.trap-find-hit-loc .pg{ font-family:"DM Mono",monospace; background:var(--bg-4,#21262d); border-radius:4px; padding:1px 5px; color:var(--text); white-space:nowrap; }'
      + '.trap-find-hit-snip{ font-size:11.5px; line-height:1.5; color:var(--text); opacity:.92; }'
      + '.trap-find-hit-snip mark, .trap-find-hit-loc mark{ background:#ffe066; color:#111; border-radius:2px; padding:0 1px; font-weight:700; }'
      + '.trap-find-empty{ padding:26px 10px; text-align:center; color:var(--muted,#9aa5b1); font-size:12px; line-height:1.6; }'
      + '.trap-find-empty .big{ font-size:24px; display:block; margin-bottom:8px; opacity:.55; }'

      + '.trap-viz-iframe-wrap{ position:relative; background:#fff; overflow:hidden; }'
      + '.trap-viz-iframe-wrap iframe{ width:100%; height:100%; border:0; display:block; }'
      + '.trap-viz-loading{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:var(--bg-2,#161b22); color:var(--muted,#9aa5b1); font-size:13px; z-index:2; }'
      + '.trap-viz-loading.hide{ display:none; }'
      + '.trap-viz-nav{ position:absolute; bottom:14px; left:50%; transform:translateX(-50%); display:flex; gap:8px; z-index:3; background:rgba(0,0,0,.6); backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,.1); border-radius:100px; padding:6px; }'
      + '.trap-viz-nav button{ background:transparent; border:none; color:#fff; padding:6px 14px; font-size:11px; font-weight:700; cursor:pointer; font-family:inherit; border-radius:100px; }'
      + '.trap-viz-nav button:hover{ background:rgba(255,255,255,.1); }'
      + '.trap-viz-nav button:disabled{ opacity:.35; cursor:not-allowed; }'
      + '.trap-viz-nav .pos{ color:rgba(255,255,255,.6); font-variant-numeric:tabular-nums; padding:0 8px; align-self:center; font-size:10px; }'

      /* ── Curadoria de páginas: barra de prévia ── */
      + '.trap-viz-prevbar{ display:flex; align-items:center; gap:12px; padding:9px 16px; background:linear-gradient(90deg, rgba(56,189,248,.18), rgba(56,189,248,.05)); border-bottom:1px solid rgba(56,189,248,.35); color:#7dd3fc; font-size:12px; font-weight:800; flex-shrink:0; }'
      + '.trap-viz-prevbar .sp{ flex:1; }'
      + '.trap-viz-prevbar button{ background:transparent; border:1px solid rgba(255,255,255,.20); color:var(--text); font-size:11px; font-weight:700; padding:6px 12px; border-radius:7px; cursor:pointer; font-family:inherit; }'
      + '.trap-viz-prevbar button:hover{ border-color:#38bdf8; color:#38bdf8; }'
      + '.trap-viz-prevbar button.pri{ background:var(--accent); border-color:var(--accent); color:var(--bg); }'
      + '.trap-viz-prevbar button.pri:hover{ color:var(--bg); filter:brightness(1.08); }'
      /* ── Curadoria de páginas: painel ── */
      + '.trap-gp-wrap{ flex:1; overflow-y:auto; padding:24px 22px; max-width:840px; margin:0 auto; width:100%; display:flex; flex-direction:column; }'
      + '.trap-gp-head{ margin-bottom:18px; }'
      + '.trap-gp-head h3{ font-size:17px; font-weight:800; margin:0 0 6px; }'
      + '.trap-gp-head p{ font-size:12px; color:var(--muted,#9aa5b1); margin:0; line-height:1.6; }'
      + '.trap-gp-list{ display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }'
      + '.trap-gp-row{ display:flex; align-items:center; gap:14px; background:var(--bg-2,#161b22); border:1px solid var(--border); border-radius:10px; padding:12px 16px; transition:opacity .15s, border-color .15s; }'
      + '.trap-gp-row.off{ opacity:.55; border-style:dashed; }'
      + '.trap-gp-n{ font-family:"DM Mono",monospace; font-size:12px; color:var(--muted,#9aa5b1); font-weight:700; flex-shrink:0; }'
      + '.trap-gp-info{ flex:1; min-width:0; }'
      + '.trap-gp-t{ font-size:13px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
      + '.trap-gp-u{ font-size:10px; color:var(--muted,#9aa5b1); font-family:"DM Mono",monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }'
      + '.trap-gp-status{ font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; flex-shrink:0; width:52px; text-align:right; }'
      + '.trap-gp-row.off .trap-gp-status{ color:var(--red,#ef4444); }'
      + '.trap-gp-row:not(.off) .trap-gp-status{ color:var(--green,#34d399); }'
      + '.trap-gp-toggle{ width:42px; height:24px; border-radius:100px; position:relative; cursor:pointer; flex-shrink:0; transition:all .15s; padding:0; background:var(--bg-3,#1c2128); border:1px solid var(--border); }'
      + '.trap-gp-toggle::after{ content:""; position:absolute; top:2px; left:2px; width:18px; height:18px; background:var(--muted,#9aa5b1); border-radius:50%; transition:all .15s; }'
      + '.trap-gp-toggle.on{ background:rgba(52,211,153,.25); border-color:var(--green,#34d399); }'
      + '.trap-gp-toggle.on::after{ left:20px; background:var(--green,#34d399); }'
      + '.trap-gp-foot{ position:sticky; bottom:0; display:flex; gap:10px; align-items:center; padding:14px 0 6px; margin-top:auto; background:linear-gradient(transparent, var(--bg-2,#161b22) 34%); flex-wrap:wrap; }'
      + '.trap-gp-foot .grow{ flex:1; }'
      + '.trap-gp-foot button{ font-size:12px; font-weight:700; padding:10px 16px; border-radius:8px; cursor:pointer; font-family:inherit; border:1px solid var(--border); background:transparent; color:var(--text); }'
      + '.trap-gp-foot button.ghost{ color:var(--muted,#9aa5b1); }'
      + '.trap-gp-foot button.ghost:hover{ color:var(--text); border-color:var(--border2,rgba(255,255,255,.14)); }'
      + '.trap-gp-foot button.prev{ border-color:rgba(56,189,248,.4); color:#38bdf8; }'
      + '.trap-gp-foot button.prev:hover{ background:rgba(56,189,248,.10); }'
      + '.trap-gp-foot button.save{ background:var(--accent); border-color:var(--accent); color:var(--bg); }'
      + '.trap-gp-foot button.save:hover{ filter:brightness(1.08); }'

      /* Botões de abrir no card (substitui o "Abrir em nova aba" sozinho) */
      + '.trap-card-actions{ display:flex; gap:6px; padding-top:12px; border-top:1px dashed var(--border); }'
      + '.trap-card-actions button{ flex:1; background:rgba(200,240,90,.10); border:1px solid rgba(200,240,90,.30); color:var(--accent); font-size:11px; font-weight:700; padding:7px 8px; border-radius:6px; cursor:pointer; font-family:inherit; transition:all .15s; }'
      + '.trap-card-actions button:hover{ background:rgba(200,240,90,.20); transform:translateY(-1px); }'
      + '.trap-card-actions button.sec{ background:transparent; color:var(--muted,#9aa5b1); border-color:var(--border); flex:0 0 auto; padding:7px 10px; }'
      + '.trap-card-actions button.sec:hover{ color:var(--text); border-color:var(--border2,rgba(255,255,255,.14)); background:rgba(255,255,255,.02); }'

      /* ── Wizard Claude ─────────────────────────────────────────── */
      + '.trap-wiz-steps{ display:flex; gap:8px; margin-bottom:24px; }'
      + '.trap-wiz-step{ flex:1; background:var(--bg-3,#1c2128); border:1px solid var(--border); border-radius:10px; padding:12px 14px; display:flex; align-items:center; gap:10px; opacity:.5; transition:all .2s; }'
      + '.trap-wiz-step.curr{ opacity:1; border-color:rgba(200,240,90,.35); background:linear-gradient(135deg, rgba(200,240,90,.06), rgba(200,240,90,.01)); }'
      + '.trap-wiz-step.done{ opacity:1; }'
      + '.trap-wiz-step-n{ width:30px; height:30px; border-radius:50%; background:var(--bg-2,#161b22); border:1.5px solid var(--border); color:var(--muted,#9aa5b1); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; flex-shrink:0; }'
      + '.trap-wiz-step.curr .trap-wiz-step-n{ background:var(--accent); color:var(--bg); border-color:var(--accent); }'
      + '.trap-wiz-step.done .trap-wiz-step-n{ background:rgba(52,211,153,.15); color:var(--green,#34d399); border-color:rgba(52,211,153,.4); }'
      + '.trap-wiz-step-t{ font-size:11px; font-weight:700; line-height:1.3; }'
      + '.trap-wiz-step-s{ font-size:9px; color:var(--muted,#9aa5b1); font-weight:600; text-transform:uppercase; letter-spacing:.05em; }'
      + '.trap-wiz-panel{ background:var(--bg-3,#1c2128); border:1px solid var(--border); border-radius:14px; padding:24px; margin-bottom:18px; }'
      + '.trap-wiz-panel h3{ font-size:16px; font-weight:800; margin:0 0 6px; }'
      + '.trap-wiz-panel .sub{ font-size:12px; color:var(--muted,#9aa5b1); margin-bottom:18px; }'
      + '.trap-wiz-nav{ display:flex; gap:8px; justify-content:space-between; align-items:center; padding:14px 0; }'
      + '.trap-wiz-nav .right{ display:flex; gap:8px; }'

      /* Chips de público-alvo (sugestões automáticas) */
      + '.trap-pub-chips{ display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }'
      + '.trap-pub-chip{ background:var(--bg-2,#161b22); border:1px solid var(--border); color:var(--muted,#9aa5b1); font-size:11px; font-weight:600; padding:5px 11px; border-radius:100px; cursor:pointer; font-family:inherit; transition:all .15s; display:inline-flex; align-items:center; gap:4px; }'
      + '.trap-pub-chip:hover{ color:var(--text); border-color:var(--border2,rgba(255,255,255,.14)); transform:translateY(-1px); }'
      + '.trap-pub-chip.on{ background:rgba(200,240,90,.15); border-color:rgba(200,240,90,.4); color:var(--accent); }'
      + '.trap-pub-chip.on::before{ content:"✓"; font-weight:800; }'
      /* Botão especial "Selecionar todos" — visual diferenciado */
      + '.trap-pub-chip.todos{ background:rgba(96,165,250,.10); border-color:rgba(96,165,250,.30); color:var(--blue,#60a5fa); font-weight:700; }'
      + '.trap-pub-chip.todos::before{ content:"" !important; }'
      + '.trap-pub-chip.todos:hover{ background:rgba(96,165,250,.20); color:var(--blue,#60a5fa); border-color:rgba(96,165,250,.5); }'
      + '.trap-pub-chip.todos.on{ background:rgba(239,68,68,.10); border-color:rgba(239,68,68,.30); color:var(--red,#ef4444); }'
      + '.trap-pub-chip.todos.on:hover{ background:rgba(239,68,68,.20); }'
      /* Botão extrair do PDF */
      + '.trap-extract-bar{ display:flex; gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap; }'
      + '.trap-extract-btn{ background:rgba(96,165,250,.10); border:1px solid rgba(96,165,250,.30); color:var(--blue,#60a5fa); font-size:11px; font-weight:700; padding:7px 12px; border-radius:7px; cursor:pointer; font-family:inherit; display:inline-flex; align-items:center; gap:5px; transition:all .15s; }'
      + '.trap-extract-btn:hover:not(:disabled){ background:rgba(96,165,250,.20); transform:translateY(-1px); }'
      + '.trap-extract-btn:disabled{ opacity:.5; cursor:not-allowed; }'
      + '.trap-extract-hint{ font-size:10px; color:var(--muted,#9aa5b1); }'
      /* PDF drop zone */
      + '.trap-dropzone{ background:var(--bg-2,#161b22); border:2px dashed var(--border2,rgba(255,255,255,.14)); border-radius:12px; padding:30px 20px; text-align:center; cursor:pointer; transition:all .2s; margin-bottom:14px; }'
      + '.trap-dropzone:hover, .trap-dropzone.over{ border-color:var(--accent); background:rgba(200,240,90,.04); }'
      + '.trap-dropzone-ic{ font-size:38px; opacity:.5; margin-bottom:8px; }'
      + '.trap-dropzone-t{ font-size:13px; font-weight:700; margin-bottom:4px; }'
      + '.trap-dropzone-s{ font-size:11px; color:var(--muted,#9aa5b1); }'
      + '.trap-pdf-list{ display:flex; flex-direction:column; gap:6px; margin-top:10px; }'
      + '.trap-pdf-item{ background:var(--bg-2,#161b22); border:1px solid var(--border); border-radius:8px; padding:10px 14px; display:flex; align-items:center; gap:10px; font-size:12px; }'
      + '.trap-pdf-item-ic{ font-size:18px; color:var(--red,#ef4444); flex-shrink:0; }'
      + '.trap-pdf-item-info{ flex:1; min-width:0; }'
      + '.trap-pdf-item-n{ font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
      + '.trap-pdf-item-s{ font-size:10px; color:var(--muted,#9aa5b1); }'
      + '.trap-pdf-item button{ background:transparent; border:1px solid var(--border); color:var(--muted,#9aa5b1); width:28px; height:28px; border-radius:6px; cursor:pointer; font-size:13px; font-family:inherit; }'
      + '.trap-pdf-item button:hover{ color:var(--red,#ef4444); border-color:var(--red,#ef4444); }'

      /* Prompt block */
      + '.trap-prompt-box{ background:#0a0e1a; border:1px solid var(--border2,rgba(255,255,255,.14)); border-radius:10px; padding:14px; font-family:"DM Mono",monospace; font-size:11px; color:var(--muted,#9aa5b1); line-height:1.6; max-height:280px; overflow-y:auto; white-space:pre-wrap; word-wrap:break-word; }'

      /* Editor + Preview (step 3) */
      + '.trap-ed-grid{ display:grid; grid-template-columns:1fr 1fr 220px; gap:14px; height:calc(100vh - 320px); min-height:480px; }'
      + '.trap-ed-pane{ background:var(--bg-2,#161b22); border:1px solid var(--border); border-radius:10px; display:flex; flex-direction:column; overflow:hidden; }'
      + '.trap-ed-pane-h{ background:var(--bg-3,#1c2128); padding:8px 12px; border-bottom:1px solid var(--border); font-size:10px; font-weight:800; color:var(--muted,#9aa5b1); text-transform:uppercase; letter-spacing:.06em; display:flex; align-items:center; gap:8px; }'
      + '.trap-ed-textarea{ flex:1; background:#0a0e1a; border:0; color:#e6edf3; font-family:"DM Mono",monospace; font-size:11px; padding:12px; resize:none; outline:none; line-height:1.6; }'
      + '.trap-ed-preview{ flex:1; background:#fff; position:relative; }'
      + '.trap-ed-preview iframe{ width:100%; height:100%; border:0; display:block; }'
      + '.trap-ed-preview-vazio{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:8px; color:var(--muted,#9aa5b1); font-size:12px; background:var(--bg-2,#161b22); }'
      + '.trap-ed-sug{ background:var(--bg-2,#161b22); border:1px solid var(--border); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:8px; overflow-y:auto; }'
      + '.trap-ed-sug h5{ font-size:10px; font-weight:800; color:var(--muted,#9aa5b1); text-transform:uppercase; letter-spacing:.08em; margin:0 0 4px; padding-bottom:6px; border-bottom:1px dashed var(--border); }'
      + '.trap-ed-sug h5:not(:first-child){ margin-top:14px; }'
      + '.trap-ed-sug-btn{ background:var(--bg-3,#1c2128); border:1px solid var(--border); color:var(--text); font-size:11px; font-weight:600; padding:9px 11px; border-radius:7px; cursor:pointer; font-family:inherit; text-align:left; line-height:1.4; transition:all .15s; }'
      + '.trap-ed-sug-btn:hover{ color:var(--accent); border-color:var(--accent); background:rgba(200,240,90,.06); transform:translateX(2px); }'

      + '@media(max-width:1100px){ .trap-ed-grid{ grid-template-columns:1fr 1fr; height:auto; } .trap-ed-sug{ grid-column:span 2; } }'
      + '@media(max-width:780px){ .trap-add-grid{ grid-template-columns:1fr; } .trap-stats{ grid-template-columns:repeat(2,1fr); } .trap-meta-grid{ grid-template-columns:1fr; } .trap-viz-body{ grid-template-columns:1fr; } .trap-viz-side{ display:none; } .trap-ed-grid{ grid-template-columns:1fr; } .trap-wiz-steps{ flex-direction:column; } }';
    var st = document.createElement('style');
    st.id = 'trapCss';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ── Shell HTML ─────────────────────────────────────────────────── */
  function _buildShell(){
    var host = document.getElementById('trapScreen');
    if(!host) return;
    host.innerHTML = ''
      + '<div class="trap-app">'
      +   '<div class="trap-topbar">'
      +     '<button class="trap-back" onclick="window.voltarHomeTrap()">‹ Voltar</button>'
      +     '<div class="trap-tit">📚 Treinamentos / Apresentações</div>'
      +     '<div class="trap-spacer"></div>'
      +     '<div class="trap-nav-pills">'
      +       '<button class="trap-nav-pill active" data-tela="painel">📋 Painel</button>'
      +       '<button class="trap-nav-pill" data-tela="adicionar">+ Adicionar</button>'
      +       '<button class="trap-nav-pill" data-tela="admin" id="trapNavAdmin" style="display:none;">⚙ Admin</button>'
      +     '</div>'
      +   '</div>'
      +   '<div id="trapConteudo"></div>'
      + '</div>';

    /* Click nas pills de navegação interna */
    host.querySelectorAll('.trap-nav-pill').forEach(function(b){
      b.addEventListener('click', function(){
        var tela = b.dataset.tela;
        host.querySelectorAll('.trap-nav-pill').forEach(function(x){ x.classList.toggle('active', x === b); });
        _telaAtual = tela;
        _renderTela();
      });
    });
  }

  /* ── Render tela atual ──────────────────────────────────────────── */
  function _renderTela(){
    var alvo = document.getElementById('trapConteudo');
    if(!alvo) return;
    /* Admin só pra admin */
    var pillAdmin = document.getElementById('trapNavAdmin');
    if(pillAdmin) pillAdmin.style.display = _ehAdmin() ? '' : 'none';
    if(_telaAtual === 'admin' && !_ehAdmin()){ _telaAtual = 'painel'; }

    if(_telaAtual === 'visualizar')        { alvo.innerHTML = _viewVisualizar(); }
    else if(_telaAtual === 'criar-claude') { alvo.innerHTML = _viewCriarClaude(); _bindCriarClaude(); }
    else if(_telaAtual === 'adicionar')    alvo.innerHTML = _viewAdicionar();
    else if(_telaAtual === 'admin')        { alvo.innerHTML = _viewAdmin(); _bindAdminEvents(); }
    else                                   { alvo.innerHTML = _viewPainel(); _bindPainelEvents(); }

    window.scrollTo(0, 0);
  }

  /* ────────────────────────────────────────────────────────────────
     VIEW · VISUALIZADOR EMBUTIDO (iframe)
     ────────────────────────────────────────────────────────────────
     Conteúdos com estrutura[] ganham sidebar de navegação entre
     os HTMLs vinculados (ex: Método CIS · 7 HTMLs).
     Conteúdo simples (sem estrutura) usa só o iframe. */

  /* Miolo do sidebar de navegação (lista de partes/módulos visíveis).
     Extraído para poder alternar com o painel de BUSCA no mesmo <aside>. */
  function _vizSideInner(partes, nOcultas){
    return '<h4>Conteúdo · '+partes.length+' partes'
      + (nOcultas > 0 ? ' <span style="color:var(--red,#ef4444);font-weight:800;">· '+nOcultas+' oculta'+(nOcultas>1?'s':'')+'</span>' : '')
      + '</h4>'
      + partes.map(function(s, i){
          var n = String(i + 1).padStart(2, '0');
          return '<button class="trap-viz-mod'+(i === _indiceMod ? ' curr' : '')+'" onclick="window._trapVizSetMod('+i+')">'
            + '<span class="trap-viz-mod-n">'+n+'</span>' + _esc(s.titulo)
            + '</button>';
        }).join('');
  }

  function _viewVisualizar(){
    var item = _itemVisualizando;
    if(!item) return _viewPainel();

    /* Painel de curadoria (ocultar/exibir páginas) tem view própria */
    if(_gerPaginas) return _viewGerenciarPaginas(item);

    var temEstrutura = Array.isArray(item.estrutura) && item.estrutura.length > 0;
    /* Partes ativas = apenas as VISÍVEIS (respeita paginasOcultas / staging no preview) */
    var partes = temEstrutura ? _vizPartesAtivas() : [];
    var totalEstrut = temEstrutura ? item.estrutura.length : 0;
    var nOcultas = totalEstrut - partes.length;
    /* Clamp do índice contra a lista visível */
    if(_indiceMod >= partes.length) _indiceMod = Math.max(0, partes.length - 1);
    var modAtual = partes.length ? partes[_indiceMod] : null;
    var urlAtual = modAtual ? modAtual.url : item.url;
    var subTit = modAtual ? modAtual.titulo : item.descricao;
    /* Conteúdo gerado pelo Claude é salvo inline em item.conteudo (sem URL real).
       Usa srcdoc no iframe nesse caso. */
    var ehInline = item.url && item.url.indexOf('__inline:') === 0 && item.conteudo;
    var podeCurar = _ehAdmin() && temEstrutura && totalEstrut > 1;

    var sideHtml = '';
    if(partes.length){
      sideHtml = '<aside class="trap-viz-side" id="trapVizSide">'
        + (_findOpen ? _findPanelHtml() : _vizSideInner(partes, nOcultas))
        + '</aside>';
    }

    var navHtml = '';
    if(partes.length > 1){
      var n = partes.length;
      navHtml = '<div class="trap-viz-nav">'
        + '<button onclick="window._trapVizAnt()" '+(_indiceMod === 0 ? 'disabled' : '')+' title="Anterior (atalho: ←)">‹ Anterior</button>'
        + '<span class="pos">'+(_indiceMod + 1)+' / '+n+'</span>'
        + '<button onclick="window._trapVizProx()" '+(_indiceMod === n - 1 ? 'disabled' : '')+' title="Próximo (atalho: →)">Próximo ›</button>'
        + '</div>';
    }

    /* Barra de PRÉVIA (modo pré-visualização antes de salvar) */
    var prevBar = '';
    if(_prevPaginas){
      prevBar = '<div class="trap-viz-prevbar">'
        + '👁 PRÉVIA · '+partes.length+' de '+totalEstrut+' páginas visíveis em tela cheia'
        + '<span class="sp"></span>'
        + '<button onclick="window._trapVizVoltarEditar()" title="Voltar a escolher as páginas">‹ Voltar a editar</button>'
        + '<button class="pri" onclick="window._trapVizSalvarPaginas()" title="Salvar esta configuração de exibição">💾 Salvar exibição</button>'
        + '</div>';
    }

    /* Em modo prévia, os botões do topo voltam à edição (não descartam a seleção) */
    var acaoVoltar = _prevPaginas ? 'window._trapVizVoltarEditar()' : 'window._trapVizFechar()';
    var tituloVoltar = _prevPaginas ? 'Voltar a editar as páginas (ESC)' : 'Fechar visualizador (ESC)';

    return ''
      + '<div class="trap-viz">'
      +   prevBar
      +   '<div class="trap-viz-bar">'
      +     '<button class="trap-viz-btn" onclick="'+acaoVoltar+'" title="'+tituloVoltar+'">‹ Voltar</button>'
      +     '<div class="trap-viz-t">'+_esc(item.icone||'📄')+' '+_esc(item.titulo)+'<small>'+_esc(subTit||'')+' · <code style="font-size:9px;">'+_esc(urlAtual)+'</code></small></div>'
      +     (_ehAdmin() && !ehInline && !_prevPaginas
            ? '<button class="trap-viz-btn" onclick="window._trapVizEditarSlides()" title="Ocultar/mostrar slides internos deste conteúdo (modo edição do deck)">🎬 Editar slides</button>'
            : '')
      +     (podeCurar && !_prevPaginas
            ? '<button class="trap-viz-btn" onclick="window._trapVizGerenciar()" title="Escolher quais páginas aparecem na tela cheia">👁 Gerenciar páginas'+(nOcultas>0 ? ' <b style="color:#f0a">('+nOcultas+')</b>' : '')+'</button>'
            : '')
      +     (partes.length && !_prevPaginas
            ? '<button class="trap-viz-btn'+(_findOpen?' on':'')+'" onclick="window._trapFindToggle()" title="Buscar dentro deste treinamento (Ctrl+F)">🔍 Buscar</button>'
            : '')
      +     (ehInline
            ? '<button class="trap-viz-btn" onclick="window._trapAbrirInlineNovaAba(\''+_esc(item.id)+'\')" title="Abrir esta página em nova aba">↗ Nova aba</button>'
            : '<button class="trap-viz-btn" onclick="window.open(\''+_esc(urlAtual)+'\',\'_blank\',\'noopener,noreferrer\')" title="Abrir esta página em nova aba">↗ Nova aba</button>')
      +     '<button class="trap-viz-btn" onclick="'+acaoVoltar+'" title="'+tituloVoltar+'" style="padding:7px 10px;">✕</button>'
      +   '</div>'
      +   '<div class="trap-viz-body">'
      +     sideHtml
      +     '<div class="trap-viz-iframe-wrap">'
      +       '<div class="trap-viz-loading" id="trapVizLoading">Carregando…</div>'
      +       (ehInline
            ? '<iframe srcdoc="'+_esc(_prepHtmlPreview(item.conteudo))+'" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" onload="var l=document.getElementById(\'trapVizLoading\');if(l)l.classList.add(\'hide\');window._trapFindIframeLoaded&&window._trapFindIframeLoaded();" title="'+_esc(item.titulo)+'"></iframe>'
            : '<iframe src="'+_esc(urlAtual)+'" onload="var l=document.getElementById(\'trapVizLoading\');if(l)l.classList.add(\'hide\');window._trapFindIframeLoaded&&window._trapFindIframeLoaded();" title="'+_esc(item.titulo)+'"></iframe>')
      +       navHtml
      +     '</div>'
      +   '</div>'
      + '</div>';
  }

  /* ────────────────────────────────────────────────────────────────
     VIEW · GERENCIAR PÁGINAS (curadoria de exibição em tela cheia)
     ────────────────────────────────────────────────────────────────
     Lista TODAS as partes com um toggle exibir/ocultar. As mudanças
     ficam em _stagingOcultas (não salvas) até o usuário clicar em
     "Salvar" — permitindo pré-visualizar antes de aplicar. */
  function _viewGerenciarPaginas(item){
    var parts = (item && item.estrutura) || [];
    var staging = _stagingOcultas || [];
    var nOcultas = parts.filter(function(p){ return p.url && staging.indexOf(p.url) !== -1; }).length;
    var nVisiveis = parts.length - nOcultas;

    var rows = parts.map(function(p, i){
      var oc = p.url && staging.indexOf(p.url) !== -1;
      var n = String(i + 1).padStart(2, '0');
      return '<div class="trap-gp-row'+(oc ? ' off' : '')+'">'
        +   '<div class="trap-gp-n">'+n+'</div>'
        +   '<div class="trap-gp-info">'
        +     '<div class="trap-gp-t">'+_esc(p.titulo || '(sem título)')+'</div>'
        +     '<div class="trap-gp-u">'+_esc(p.url || '')+'</div>'
        +   '</div>'
        +   '<div class="trap-gp-status">'+(oc ? 'Oculta' : 'Visível')+'</div>'
        +   '<button class="trap-gp-toggle'+(oc ? '' : ' on')+'" onclick="window._trapTogglePagina('+i+')" title="'+(oc ? 'Exibir esta página' : 'Ocultar esta página')+'"></button>'
        + '</div>';
    }).join('');

    return ''
      + '<div class="trap-viz">'
      +   '<div class="trap-viz-bar">'
      +     '<button class="trap-viz-btn" onclick="window._trapVizCancelarPaginas()" title="Descartar alterações (ESC)">‹ Voltar</button>'
      +     '<div class="trap-viz-t">👁 Gerenciar páginas<small>'+_esc(item.titulo)+' · '+nVisiveis+' visível(is), '+nOcultas+' oculta(s)</small></div>'
      +     '<button class="trap-viz-btn" onclick="window._trapDesocultarTodas()" title="Marcar todas as páginas como visíveis">↺ Desocultar todas</button>'
      +   '</div>'
      +   '<div class="trap-gp-wrap">'
      +     '<div class="trap-gp-head">'
      +       '<h3>Escolha o que aparece na tela cheia</h3>'
      +       '<p>Desligue as páginas que <b>não</b> devem entrar na navegação/apresentação. As páginas ocultas continuam guardadas — é só religar quando quiser. Nada é salvo até você clicar em <b>Salvar exibição</b>.</p>'
      +     '</div>'
      +     '<div class="trap-gp-list">'+rows+'</div>'
      +     '<div class="trap-gp-foot">'
      +       '<button class="ghost" onclick="window._trapVizCancelarPaginas()">Cancelar</button>'
      +       '<button class="ghost" onclick="window._trapDesocultarTodas()" title="Marca todas como visíveis">↺ Desocultar todas</button>'
      +       '<span class="grow"></span>'
      +       '<button class="prev" onclick="window._trapVizPreviewPaginas()" title="Ver como ficará a tela cheia antes de salvar">👁 Pré-visualizar</button>'
      +       '<button class="save" onclick="window._trapVizSalvarPaginas()" title="Salvar esta configuração">💾 Salvar exibição</button>'
      +     '</div>'
      +   '</div>'
      + '</div>';
  }

  /* Atalhos de teclado dentro do visualizador (setas ←/→) */
  document.addEventListener('keydown', function(e){
    if(_telaAtual !== 'visualizar') return;
    if(_gerPaginas) return; /* no painel de curadoria as setas não navegam */
    if(!_itemVisualizando || !Array.isArray(_itemVisualizando.estrutura)) return;
    /* Ctrl/Cmd+F → abre a busca (mesmo com foco no body) */
    if((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')){
      if(_vizPartesAtivas().length && !_prevPaginas){ e.preventDefault(); window._trapFindAbrir(); }
      return;
    }
    if(e.key === 'Escape' && _findOpen){ e.preventDefault(); window._trapFindFechar(); return; }
    /* Enquanto o foco está no campo de busca, as setas movem o cursor — não navegam partes */
    var ae = document.activeElement;
    if(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    if(ae && ae.tagName === 'IFRAME') return;
    if(e.key === 'ArrowRight'){ e.preventDefault(); window._trapVizProx(); }
    else if(e.key === 'ArrowLeft'){ e.preventDefault(); window._trapVizAnt(); }
  });

  /* ────────────────────────────────────────────────────────────────
     VIEW 1 · PAINEL PRINCIPAL
     ──────────────────────────────────────────────────────────────── */
  function _viewPainel(){
    var itens = _getItens();
    var produtos = Array.from(new Set(itens.map(function(i){ return i.produto; }))).sort();

    /* Stats */
    var stTrein = itens.filter(function(i){ return i.tipo === 'treinamento' && i.status === 'publicado'; }).length;
    var stApres = itens.filter(function(i){ return i.tipo === 'apresentacao' && i.status === 'publicado'; }).length;
    var stOcultos = itens.filter(function(i){ return i.status === 'oculto'; }).length;

    /* Filtro */
    var visiveis = itens.filter(function(i){
      if(_filtroTipo && i.tipo !== _filtroTipo) return false;
      if(_filtroStatus && i.status !== _filtroStatus) return false;
      if(_filtroProduto && i.produto !== _filtroProduto) return false;
      if(_busca){
        var t = (i.titulo + ' ' + i.descricao).toLowerCase();
        if(t.indexOf(_busca.toLowerCase()) < 0) return false;
      }
      /* Usuário comum nunca vê ocultos */
      if(!_modoGestao && i.status === 'oculto') return false;
      return true;
    });

    var html = ''
      + '<div class="trap-hero">'
      +   '<div><h1>Treinamentos & Apresentações</h1><p>Materiais internos e apresentações comerciais organizados por produto.</p></div>'
      +   '<div style="display:flex;gap:8px;align-items:center;">'
      +     '<button class="trap-btn-primary" onclick="window._trapIr(\'adicionar\')" style="background:transparent;border:1px solid var(--border2,rgba(255,255,255,.14));color:var(--text,#e6edf3);">+ Adicionar conteúdo</button>'
      +     '<button class="trap-btn-primary" onclick="window._trapExportarImgs()" title="Baixar um arquivo com todas as imagens dos cards definidas neste servidor" style="background:transparent;border:1px solid var(--border2,rgba(255,255,255,.14));color:var(--text,#e6edf3);">⬇ Exportar imagens</button>'
      +     '<button class="trap-btn-primary" onclick="window.abrirEditorApresentacao && window.abrirEditorApresentacao({novo:true})">📐 Nova apresentação</button>'
      +   '</div>'
      + '</div>'
      + '<div class="trap-stats">'
      +   '<div class="trap-stat"><div class="trap-stat-n">'+itens.length+'</div><div class="trap-stat-l">Total</div></div>'
      +   '<div class="trap-stat"><div class="trap-stat-n" style="color:var(--blue,#60a5fa);">'+stTrein+'</div><div class="trap-stat-l">Treinamentos</div></div>'
      +   '<div class="trap-stat"><div class="trap-stat-n" style="color:var(--purple,#a78bfa);">'+stApres+'</div><div class="trap-stat-l">Apresentações</div></div>'
      +   '<div class="trap-stat"><div class="trap-stat-n" style="color:'+(stOcultos?'var(--red,#ef4444)':'var(--muted,#9aa5b1)')+';">'+stOcultos+'</div><div class="trap-stat-l">Ocultos</div></div>'
      + '</div>'
      + '<div class="trap-tabs">'
      +   '<button class="'+(_filtroTipo===''?'active':'')+'" data-tipo="">📋 Tudo · '+itens.length+'</button>'
      +   '<button class="'+(_filtroTipo==='treinamento'?'active':'')+'" data-tipo="treinamento">🎓 Treinamentos · '+itens.filter(function(i){return i.tipo==='treinamento';}).length+'</button>'
      +   '<button class="'+(_filtroTipo==='apresentacao'?'active':'')+'" data-tipo="apresentacao">🎯 Apresentações · '+itens.filter(function(i){return i.tipo==='apresentacao';}).length+'</button>'
      +   '<button class="'+(_filtroTipo==='ring'?'active':'')+'" data-tipo="ring">🥊 Ring · '+itens.filter(function(i){return i.tipo==='ring';}).length+'</button>'
      + '</div>'
      + '<div class="trap-filtros">'
      +   '<input class="trap-input" id="trapBusca" placeholder="🔍 Buscar por título ou descrição..." value="'+_esc(_busca)+'">'
      +   '<select class="trap-select" id="trapProduto">'
      +     '<option value="">📦 Todos os produtos</option>'
      +     produtos.map(function(p){ return '<option value="'+_esc(p)+'"'+(p===_filtroProduto?' selected':'')+'>📦 '+_esc(p)+'</option>'; }).join('')
      +   '</select>'
      +   '<div class="trap-spacer"></div>'
      +   '<div class="trap-viewseg" id="trapViewSeg">'
      +     '<button data-view="card"   class="'+(_trapView()==='card'?'on':'')+'"   title="Cards">▦ Card</button>'
      +     '<button data-view="poster" class="'+(_trapView()==='poster'?'on':'')+'" title="Pôster vertical">🖼️ Pôster</button>'
      +     '<button data-view="lista"  class="'+(_trapView()==='lista'?'on':'')+'"  title="Lista">☰ Lista</button>'
      +   '</div>'
      +   '<button class="trap-chip '+(_filtroStatus==='publicado'?'active':'')+'" data-st="publicado">✓ Publicados</button>'
      +   (_modoGestao ? '<button class="trap-chip '+(_filtroStatus==='oculto'?'active':'')+'" data-st="oculto">⊘ Ocultos</button>' : '')
      +   '<button class="trap-chip '+(_filtroStatus===''?'active':'')+'" data-st="">Todos</button>'
      +   (_ehAdmin() ? '<button class="trap-toggle-gestao '+(_modoGestao?'on':'')+'" id="trapBtnGestao">⚙ Modo Gestão'+(_modoGestao?' ATIVO':'')+'</button>' : '')
      + '</div>';

    if(!visiveis.length){
      html += '<div class="trap-empty"><div class="trap-empty-ic">📭</div>'
        + (itens.length === 0
            ? '<div style="font-size:14px;font-weight:700;margin-bottom:6px;">Nenhum conteúdo cadastrado ainda</div>Use <b style="color:var(--accent);">+ Adicionar conteúdo</b> pra criar via Claude ou importar HTMLs existentes.'
            : '<div style="font-size:14px;font-weight:700;margin-bottom:6px;">Nenhum conteúdo encontrado</div>Tente ajustar os filtros.')
        + '</div>';
    } else {
      var _vw = _trapView();
      if(_vw === 'poster'){ html += '<div class="trap-grid-poster">' + visiveis.map(_posterHtml).join('') + '</div>'; }
      else if(_vw === 'lista'){ html += '<div class="trap-list">' + visiveis.map(_listHtml).join('') + '</div>'; }
      else { html += '<div class="trap-grid">' + visiveis.map(_cardHtml).join('') + '</div>'; }
    }
    return html;
  }

  /* ── Modo de visualização (card | poster | lista) — persistido ── */
  function _trapView(){ try{ return localStorage.getItem('trapView') || 'card'; }catch(e){ return 'card'; } }
  window._trapSetView = function(v){ try{ localStorage.setItem('trapView', v); }catch(e){} if(typeof _renderTela==='function') _renderTela(); };

  /* Helpers compartilhados pelos 3 modos */
  function _trapBadgesHtml(i){
    var tipoLabel = i.tipo === 'treinamento' ? '🎓 Treinamento' : (i.tipo === 'ring' ? '🥊 Ring' : '🎯 Apresentação');
    var tipoCls = i.tipo === 'treinamento' ? 'tr' : (i.tipo === 'ring' ? 'ring' : 'ap');
    return '<span class="trap-badge '+tipoCls+'">'+tipoLabel+'</span>'
      + '<span class="trap-badge prod">📦 '+_esc(i.produto)+'</span>'
      + (i.novo ? '<span class="trap-badge novo">✨ Novo</span>' : '')
      + (i.status === 'oculto' ? '<span class="trap-badge oculto">⊘ Oculto</span>' : '');
  }
  function _trapThumbEditHtml(id, imgUrl){
    return '<button class="trap-thumb-edit" onclick="event.stopPropagation();window._trapTrocarImg(\''+id+'\')" title="Trocar imagem">📷</button>'
      + (imgUrl ? '<button class="trap-thumb-edit del" onclick="event.stopPropagation();window._trapRemoverImg(\''+id+'\')" title="Remover imagem">✕</button>' : '');
  }
  function _trapAdminActsHtml(i){
    var id = _esc(i.id);
    return '<button class="trap-icbtn" onclick="event.stopPropagation();window._trapToggleStatus(\''+id+'\')" title="'+(i.status==='publicado'?'Ocultar':'Publicar')+'">'+(i.status==='publicado'?'👁':'⊘')+'</button>'
      + '<button class="trap-icbtn" onclick="event.stopPropagation();window._trapToggleNovo(\''+id+'\')" title="'+(i.novo?'Tirar badge Novo':'Marcar como Novo')+'">'+(i.novo?'✨':'⊕')+'</button>';
  }
  function _trapTemEstrutura(i){ return Array.isArray(i.estrutura) && i.estrutura.length > 0; }

  /* ── Curadoria de páginas: helpers ─────────────────────────────────
     item.paginasOcultas = [url, url, ...] → partes que NÃO entram na
     navegação/tela cheia. Persistido via override (mesclado por _getItens). */
  function _paginasOcultasDe(item){
    return Array.isArray(item && item.paginasOcultas) ? item.paginasOcultas.slice() : [];
  }
  function _partesVisiveis(item, ocultas){
    var parts = (item && item.estrutura) || [];
    var oc = ocultas || _paginasOcultasDe(item);
    return parts.filter(function(p){ return !(p && p.url && oc.indexOf(p.url) !== -1); });
  }
  /* Partes ativas do visualizador: em preview usa o staging; normal usa o salvo */
  function _vizPartesAtivas(){
    var item = _itemVisualizando;
    if(!item || !Array.isArray(item.estrutura)) return [];
    var oc = _prevPaginas ? (_stagingOcultas || []) : _paginasOcultasDe(item);
    return _partesVisiveis(item, oc);
  }
  /* Botão Imprimir (apresentação/apostila) — só para itens com partes (treinamentos) */
  function _trapPrintBtnHtml(i, cls){
    if(!_trapTemEstrutura(i)) return '';
    var id = _esc(i.id);
    return '<button class="'+(cls||'sec')+'" onclick="event.stopPropagation();window._trapBaixarPdfCompleto(\''+id+'\',this)" title="Imprimir / Salvar PDF (apresentação em slides ou apostila A4)">🖨️ Imprimir</button>';
  }

  function _cardHtml(i){
    var thumbCls = i.tipo === 'treinamento' ? 't-trein' : (i.tipo === 'ring' ? 't-ring' : 't-apres');
    var ocultoCls = i.status === 'oculto' ? ' oculto' : '';
    var id = _esc(i.id);
    var _imgUrl = _trapImgGet(i.id, 'wide');
    var _thumbInner = _imgUrl ? '<img class="trap-thumb-img" src="'+_imgUrl+'" alt="">' : _esc(i.icone||'📄');

    return ''
      + '<div class="trap-card'+ocultoCls+'" onclick="window._trapAbrirAqui(\''+id+'\')" title="Abrir embutido — clique nos botões para outras opções">'
      +   '<div class="trap-card-thumb '+thumbCls+(_imgUrl?' has-img':'')+'">'+_thumbInner+_trapThumbEditHtml(id,_imgUrl)+'</div>'
      +   '<div class="trap-card-meta">'+_trapBadgesHtml(i)+'</div>'
      +   '<h3 class="trap-card-tit">'+_esc(i.titulo)+'</h3>'
      +   '<p class="trap-card-desc">'+_esc(i.descricao)+'</p>'
      +   '<div class="trap-card-actions">'
      +     '<button onclick="event.stopPropagation();window._trapAbrirAqui(\''+id+'\')" title="Visualizar dentro do aplicativo">👁 Abrir aqui</button>'
      +     _trapPrintBtnHtml(i)
      +     '<button class="sec" onclick="event.stopPropagation();window._trapAbrirNovaAba(\''+id+'\')" title="Abrir em nova aba do navegador">↗</button>'
      +   '</div>'
      +   (_modoGestao ? '<div class="trap-card-foot" style="padding-top:8px;border-top:none;justify-content:flex-end;"><div class="trap-card-acts">'+_trapAdminActsHtml(i)+'</div></div>' : '')
      + '</div>';
  }

  /* Modo PÔSTER (vertical, estilo do anexo) */
  function _posterHtml(i){
    var ocultoCls = i.status === 'oculto' ? ' oculto' : '';
    var id = _esc(i.id);
    var imgUrl = _trapImgGet(i.id, 'poster');
    var bg = imgUrl
      ? '<img class="trap-thumb-img" src="'+imgUrl+'" alt="">'
      : '<div class="trap-poster-bg '+(i.tipo==='treinamento'?'t-trein':(i.tipo==='ring'?'t-ring':'t-apres'))+'">'+_esc(i.icone||'📄')+'</div>';
    var menuItems = ''
      + '<button onclick="event.stopPropagation();window._trapTrocarImg(\''+id+'\')">📷 Trocar imagem</button>'
      + (imgUrl ? '<button onclick="event.stopPropagation();window._trapRemoverImg(\''+id+'\')">✕ Remover imagem</button>' : '')
      + '<button onclick="event.stopPropagation();window._trapAbrirAqui(\''+id+'\')">👁 Abrir</button>'
      + (_trapTemEstrutura(i) ? '<button onclick="event.stopPropagation();window._trapBaixarPdfCompleto(\''+id+'\',this)">🖨️ Imprimir / PDF</button>' : '')
      + '<button onclick="event.stopPropagation();window._trapAbrirNovaAba(\''+id+'\')">↗ Abrir em nova aba</button>';
    return ''
      + '<div class="trap-poster'+ocultoCls+'" onclick="window._trapAbrirAqui(\''+id+'\')" title="Abrir">'
      +   bg
      +   '<div class="trap-poster-grad"></div>'
      +   '<button class="trap-poster-kebab" onclick="event.stopPropagation();window._trapToggleMenu(\'p_'+id+'\',this)" title="Mais ações">&#8942;</button>'
      +   '<div class="trap-cat-menu" id="trapMenu-p_'+id+'">'+menuItems+'</div>'
      +   '<div class="trap-poster-cap">'
      +     (i.status === 'oculto' ? '<span class="trap-badge oculto">⊘ Oculto</span>' : '')
      +     '<div class="trap-poster-prod">'+_esc(i.produto)+'</div>'
      +     '<div class="trap-poster-tit">'+_esc(i.titulo)+'</div>'
      +   '</div>'
      + '</div>';
  }

  /* Modo LISTA (banner largo) */
  function _listHtml(i){
    var thumbCls = i.tipo === 'treinamento' ? 't-trein' : (i.tipo === 'ring' ? 't-ring' : 't-apres');
    var ocultoCls = i.status === 'oculto' ? ' oculto' : '';
    var id = _esc(i.id);
    var imgUrl = _trapImgGet(i.id, 'wide');
    var thumbInner = imgUrl ? '<img class="trap-thumb-img" src="'+imgUrl+'" alt="">' : _esc(i.icone||'📄');
    return ''
      + '<div class="trap-listrow'+ocultoCls+'" onclick="window._trapAbrirAqui(\''+id+'\')" title="Abrir">'
      +   '<div class="trap-listrow-thumb '+thumbCls+'">'+thumbInner+_trapThumbEditHtml(id,imgUrl)+'</div>'
      +   '<div class="trap-listrow-body">'
      +     '<div class="trap-card-meta">'+_trapBadgesHtml(i)+'</div>'
      +     '<h3>'+_esc(i.titulo)+'</h3>'
      +     '<p>'+_esc(i.descricao)+'</p>'
      +   '</div>'
      +   '<div class="trap-listrow-acts">'
      +     '<button onclick="event.stopPropagation();window._trapAbrirAqui(\''+id+'\')">👁 Abrir aqui</button>'
      +     _trapPrintBtnHtml(i)
      +     '<button class="sec" onclick="event.stopPropagation();window._trapAbrirNovaAba(\''+id+'\')">↗ Nova aba</button>'
      +     (_modoGestao ? '<div style="display:flex;gap:4px;justify-content:center;margin-top:2px;">'+_trapAdminActsHtml(i)+'</div>' : '')
      +   '</div>'
      + '</div>';
  }

  /* ── Imagem personalizada do card (localStorage por treinamento) ── */
  var _trapImgPendingId = null;
  /* Manifest de imagens VERSIONADAS (arquivos no repo). Caminhos relativos à
     dashboard.html → funcionam igual em file://, 127.0.0.1:5500 e GitHub Pages.
     Gerado a partir de trap-imagens-cards.json (botão "Exportar imagens").
     O localStorage (override do usuário) tem prioridade sobre estes arquivos. */
  var TRAP_IMG_FILES = {
    'treinamento-tce':             { wide:'assets/img/treinamentos/treinamento-tce-wide.jpg',             poster:'assets/img/treinamentos/treinamento-tce-poster.jpg' },
    'treinamento-if':              { wide:'assets/img/treinamentos/treinamento-if-wide.jpg',              poster:'assets/img/treinamentos/treinamento-if-poster.jpg' },
    'treinamento-cis':             { wide:'assets/img/treinamentos/treinamento-cis-wide.jpg',             poster:'assets/img/treinamentos/treinamento-cis-poster.jpg' },
    'treinamento-ggb':             { wide:'assets/img/treinamentos/treinamento-ggb-wide.jpg',             poster:'assets/img/treinamentos/treinamento-ggb-poster.jpg' },
    'treinamento-fgpc':            { wide:'assets/img/treinamentos/treinamento-fgpc-wide.jpg',            poster:'assets/img/treinamentos/treinamento-fgpc-poster.jpg' },
    'treinamento-bhp':             { wide:'assets/img/treinamentos/treinamento-bhp-wide.jpg',             poster:'assets/img/treinamentos/treinamento-bhp-poster.jpg' },
    'treinamento-ml5':             { wide:'assets/img/treinamentos/treinamento-ml5-wide.jpg',             poster:'assets/img/treinamentos/treinamento-ml5-poster.jpg' },
    'treinamento-fcis':            { wide:'assets/img/treinamentos/treinamento-fcis-wide.jpg',            poster:'assets/img/treinamentos/treinamento-fcis-poster.jpg' },
    'treinamento-ceop':            { wide:'assets/img/treinamentos/treinamento-ceop-wide.jpg',            poster:'assets/img/treinamentos/treinamento-ceop-poster.jpg' },
    'treinamento-master-coaching': { wide:'assets/img/treinamentos/treinamento-master-coaching-wide.jpg', poster:'assets/img/treinamentos/treinamento-master-coaching-poster.jpg' },
    'treinamento-tav':             { wide:'assets/img/treinamentos/treinamento-tav-wide.jpg',             poster:'assets/img/treinamentos/treinamento-tav-poster.jpg' },
    'treinamento-alinhamento':     { wide:'assets/img/treinamentos/treinamento-alinhamento-wide.jpg',     poster:'assets/img/treinamentos/treinamento-alinhamento-poster.jpg' }
  };
  function _trapImgs(){
    try{ return JSON.parse(localStorage.getItem('trapCardImgs') || '{}'); }catch(e){ return {}; }
  }
  /* Formato (proporção) por modo de visualização: pôster (3:4) é independente de card/lista (16:9). */
  function _trapFmt(){ return (_trapView() === 'poster') ? 'poster' : 'wide'; }
  /* Lê a imagem do treinamento para um formato. Compatível com o formato antigo (string = 'wide').
     Prioridade: 1) override do usuário (localStorage) → 2) arquivo versionado (TRAP_IMG_FILES). */
  function _trapImgGet(id, fmt){
    var v = _trapImgs()[id];
    if(typeof v === 'string'){ if(fmt === 'wide' && v) return v; }   /* legado: string = imagem 16:9 */
    else if(v && typeof v === 'object' && v[fmt]) return v[fmt];
    var f = TRAP_IMG_FILES[id];
    if(f && f[fmt]) return f[fmt];
    return '';
  }
  function _trapImgStore(id, fmt, url){
    var m = _trapImgs();
    var v = m[id];
    if(typeof v === 'string') v = { wide: v };          /* migra legado */
    if(!v || typeof v !== 'object') v = {};
    if(url) v[fmt] = url; else delete v[fmt];
    if(Object.keys(v).length) m[id] = v; else delete m[id];
    try{ localStorage.setItem('trapCardImgs', JSON.stringify(m)); return true; }
    catch(e){ if(typeof _toast==='function') _toast('Não foi possível salvar (imagem grande demais). Tente outra menor.', 'var(--red)'); return false; }
  }
  function _trapEnsureImgInput(){
    if(document.getElementById('trapImgInput')) return;
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'trapImgInput'; inp.style.display = 'none';
    inp.addEventListener('change', function(){
      var f = inp.files && inp.files[0];
      if(!f || !_trapImgPendingId){ return; }
      var reader = new FileReader();
      reader.onload = function(ev){
        /* abre o editor de enquadramento (arrastar + zoom) */
        _trapAbrirCropper(_trapImgPendingId, ev.target.result);
      };
      reader.readAsDataURL(f);
    });
    document.body.appendChild(inp);
  }
  window._trapTrocarImg = function(id){
    _trapEnsureImgInput();
    _trapImgPendingId = id;
    var inp = document.getElementById('trapImgInput');
    if(inp){ inp.value = ''; inp.click(); }
  };
  window._trapRemoverImg = function(id){
    _trapImgStore(id, _trapFmt(), null);
    if(typeof _renderTela==='function') _renderTela();
    if(typeof _toast==='function') _toast('Imagem removida — voltou ao ícone.', 'var(--muted)');
  };

  /* Exporta todas as imagens dos cards (localStorage) num arquivo JSON.
     Como o localStorage é por origem (file:// ≠ 127.0.0.1:5500 ≠ Pages),
     este arquivo permite levar as imagens para os outros servidores
     ou ser convertido em arquivos versionados no repositório. */
  window._trapExportarImgs = function(){
    var m = _trapImgs();
    var ids = Object.keys(m || {});
    if(!ids.length){
      if(typeof _toast==='function') _toast('Nenhuma imagem personalizada definida neste servidor.', 'var(--amber,#f59e0b)');
      return;
    }
    /* conta quantas imagens (wide + poster) há no total */
    var total = 0;
    ids.forEach(function(id){
      var v = m[id];
      if(typeof v === 'string') total++;
      else if(v && typeof v === 'object'){ if(v.wide) total++; if(v.poster) total++; }
    });
    try{
      var payload = { _tipo:'trap-card-imgs', _exportadoEm:new Date().toISOString(), imagens:m };
      var blob = new Blob([JSON.stringify(payload)], { type:'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'trap-imagens-cards.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
      if(typeof _toast==='function') _toast('⬇ Exportadas '+total+' imagem(ns) de '+ids.length+' card(s). Envie o arquivo trap-imagens-cards.json.', 'var(--green,#34d399)');
    }catch(e){
      if(typeof _toast==='function') _toast('Erro ao exportar: '+(e&&e.message?e.message:''), 'var(--red)');
    }
  };

  /* ── Editor de enquadramento: arrastar + zoom no formato 16:9 do card ── */
  function _trapEnsureCropperCss(){
    if(document.getElementById('trapCropperCss')) return;
    var st = document.createElement('style'); st.id = 'trapCropperCss';
    st.textContent = ''
      + '.trap-crop-ov{ position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,.72); display:flex; align-items:center; justify-content:center; backdrop-filter:blur(3px); }'
      + '.trap-crop-box{ background:var(--bg-2,#161b22); border:1px solid var(--border2,rgba(255,255,255,.14)); border-radius:14px; padding:20px; width:min(92vw,580px); box-shadow:0 24px 70px rgba(0,0,0,.6); font-family:inherit; }'
      + '.trap-crop-h{ font-size:15px; font-weight:800; color:var(--text,#e6edf3); margin-bottom:3px; }'
      + '.trap-crop-sub{ font-size:11.5px; color:var(--muted,#9aa5b1); margin-bottom:14px; }'
      + '.trap-crop-vp{ position:relative; overflow:hidden; border-radius:10px; border:1px solid var(--border); background:#0a0e16; margin:0 auto; cursor:grab; touch-action:none; user-select:none; }'
      + '.trap-crop-vp.grabbing{ cursor:grabbing; }'
      + '.trap-crop-vp img{ position:absolute; top:0; left:0; max-width:none; pointer-events:none; user-select:none; }'
      + '.trap-crop-grid{ position:absolute; inset:0; pointer-events:none; background-image:linear-gradient(rgba(255,255,255,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.18) 1px,transparent 1px); background-size:33.333% 33.333%; opacity:.5; }'
      + '.trap-crop-zoom{ display:flex; align-items:center; gap:10px; margin:14px 2px 4px; }'
      + '.trap-crop-zoom span{ font-size:13px; opacity:.7; }'
      + '.trap-crop-zbtn{ background:rgba(255,255,255,.06); border:1px solid var(--border); border-radius:7px; padding:5px 9px; font-size:13px; line-height:1; cursor:pointer; font-family:inherit; transition:all .12s; }'
      + '.trap-crop-zbtn:hover{ border-color:rgba(56,189,248,.45); background:rgba(56,189,248,.10); }'
      + '.trap-crop-zbtn:active{ transform:scale(.92); }'
      + '.trap-crop-zoom input[type=range]{ flex:1; accent-color:#38bdf8; cursor:pointer; }'
      + '.trap-crop-tools{ display:flex; gap:6px; flex-wrap:wrap; margin-top:12px; }'
      + '.trap-crop-tools button{ flex:1; min-width:110px; background:rgba(255,255,255,.05); border:1px solid var(--border); color:var(--muted,#9aa5b1); border-radius:7px; padding:7px 8px; font-size:11px; font-weight:700; cursor:pointer; font-family:inherit; transition:all .12s; display:inline-flex; align-items:center; justify-content:center; gap:5px; }'
      + '.trap-crop-tools button:hover{ color:#38bdf8; border-color:rgba(56,189,248,.45); background:rgba(56,189,248,.08); }'
      + '.trap-crop-acts{ display:flex; gap:8px; justify-content:flex-end; margin-top:14px; }'
      + '.trap-crop-acts button{ border-radius:7px; padding:9px 18px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; border:1px solid var(--border); }'
      + '.trap-crop-cancel{ background:transparent; color:var(--muted,#9aa5b1); }'
      + '.trap-crop-cancel:hover{ color:var(--text); border-color:var(--border2,rgba(255,255,255,.14)); }'
      + '.trap-crop-save{ background:linear-gradient(135deg,#0ea5e9,#06b6d4); border:none; color:#fff; }'
      + '.trap-crop-save:hover{ filter:brightness(1.1); }';
    document.head.appendChild(st);
  }

  function _trapAbrirCropper(id, srcUrl){
    _trapEnsureCropperCss();
    var old = document.getElementById('trapCropper'); if(old) old.remove();
    /* O recorte segue o formato do MODO atual: Pôster = retrato 3:4.1, Card/Lista = 16:9 */
    var _vw = _trapView();
    var ASPW = (_vw === 'poster') ? 3 : 16;
    var ASPH = (_vw === 'poster') ? 4.1 : 9;
    var ASP = ASPW / ASPH;
    var fmtLabel = (_vw === 'poster') ? 'Pôster (retrato 3:4)' : 'Card / Lista (16:9)';
    var VW, VH;
    if(ASP >= 1){ VW = 520; VH = Math.round(VW / ASP); }   /* paisagem: fixa largura */
    else { VH = 430; VW = Math.round(VH * ASP); }           /* retrato: fixa altura */
    var ov = document.createElement('div');
    ov.id = 'trapCropper'; ov.className = 'trap-crop-ov';
    ov.innerHTML = ''
      + '<div class="trap-crop-box">'
      +   '<div class="trap-crop-h">🖼️ Ajustar imagem do card</div>'
      +   '<div class="trap-crop-sub">Formato: <b style="color:#38bdf8">' + fmtLabel + '</b> · clique, segure e arraste para posicionar · use o controle para aproximar/afastar</div>'
      +   '<div class="trap-crop-vp" id="trapCropVp" style="width:' + VW + 'px;height:' + VH + 'px;max-width:100%;">'
      +     '<img id="trapCropImg" alt="" draggable="false">'
      +     '<div class="trap-crop-grid"></div>'
      +   '</div>'
      +   '<div class="trap-crop-zoom"><button type="button" class="trap-crop-zbtn" id="trapCropZoomOut" title="Diminuir">🔍➖</button><input type="range" id="trapCropZoom" min="20" max="320" value="100"><button type="button" class="trap-crop-zbtn" id="trapCropZoomIn" title="Aumentar">🔍➕</button></div>'
      +   '<div class="trap-crop-tools">'
      +     '<button id="trapCropCenter" title="Centralizar a imagem">⊕ Centralizar</button>'
      +     '<button id="trapCropFill" title="Preencher o quadro (cobrir)">⤢ Preencher</button>'
      +     '<button id="trapCropFit" title="Mostrar a imagem inteira (conter)">▢ Mostrar tudo</button>'
      +   '</div>'
      +   '<div class="trap-crop-acts">'
      +     '<button class="trap-crop-cancel" id="trapCropCancel">Cancelar</button>'
      +     '<button class="trap-crop-save" id="trapCropSave">Salvar enquadramento</button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(ov);

    var img = document.getElementById('trapCropImg');
    var vp = document.getElementById('trapCropVp');
    var zoom = document.getElementById('trapCropZoom');
    var s = { iw:0, ih:0, base:1, scale:1, tx:0, ty:0, drag:false, ox:0, oy:0 };

    function clamp(){
      var W = vpW(), dw = s.iw * s.scale, dh = s.ih * s.scale;
      if(dw <= W){ if(s.tx < 0) s.tx = 0; if(s.tx > W - dw) s.tx = W - dw; }   /* menor: mantém dentro do quadro */
      else { if(s.tx > 0) s.tx = 0; if(s.tx < W - dw) s.tx = W - dw; }          /* maior: cobre */
      if(dh <= VH){ if(s.ty < 0) s.ty = 0; if(s.ty > VH - dh) s.ty = VH - dh; }
      else { if(s.ty > 0) s.ty = 0; if(s.ty < VH - dh) s.ty = VH - dh; }
    }
    function vpW(){ return vp.clientWidth || VW; }
    function syncZoom(){ var v = Math.round(s.scale / s.base * 100); zoom.value = Math.max(20, Math.min(320, v)); }
    function setScale(ns){ var cx = vpW() / 2, cy = VH / 2, k = ns / s.scale; s.tx = cx - (cx - s.tx) * k; s.ty = cy - (cy - s.ty) * k; s.scale = ns; clamp(); apply(); syncZoom(); }
    function doCenter(){ s.tx = (vpW() - s.iw * s.scale) / 2; s.ty = (VH - s.ih * s.scale) / 2; clamp(); apply(); }
    function doFill(){ s.scale = s.base; doCenter(); syncZoom(); }                       /* cobrir */
    function doFit(){ s.scale = Math.min(vpW() / s.iw, VH / s.ih); doCenter(); syncZoom(); } /* conter (mostra tudo) */
    function stepZoom(d){ var pct = Math.max(20, Math.min(320, Math.round(s.scale / s.base * 100) + d)); setScale(s.base * pct / 100); }
    function apply(){
      img.style.width = (s.iw * s.scale) + 'px';
      img.style.height = (s.ih * s.scale) + 'px';
      img.style.transform = 'translate(' + s.tx + 'px,' + s.ty + 'px)';
    }
    function init(){
      s.iw = img.naturalWidth; s.ih = img.naturalHeight;
      if(!s.iw || !s.ih){ return; }
      s.base = Math.max(vpW() / s.iw, VH / s.ih);   /* cobre o viewport */
      s.scale = s.base;
      s.tx = (vpW() - s.iw * s.scale) / 2;
      s.ty = (VH - s.ih * s.scale) / 2;
      clamp(); apply();
    }
    img.onload = init;
    img.src = srcUrl;
    if(img.complete && img.naturalWidth){ init(); }

    function pt(e){ var t = e.touches && e.touches[0]; return { x:(t ? t.clientX : e.clientX), y:(t ? t.clientY : e.clientY) }; }
    function down(e){ s.drag = true; vp.classList.add('grabbing'); var p = pt(e); s.ox = p.x - s.tx; s.oy = p.y - s.ty; e.preventDefault(); }
    function move(e){ if(!s.drag) return; var p = pt(e); s.tx = p.x - s.ox; s.ty = p.y - s.oy; clamp(); apply(); e.preventDefault(); }
    function up(){ s.drag = false; vp.classList.remove('grabbing'); }
    vp.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    vp.addEventListener('touchstart', down, { passive:false });
    window.addEventListener('touchmove', move, { passive:false });
    window.addEventListener('touchend', up);

    zoom.addEventListener('input', function(){
      var cx = vpW() / 2, cy = VH / 2;
      var prev = s.scale;
      s.scale = s.base * (parseInt(zoom.value, 10) / 100);
      var k = s.scale / prev;
      s.tx = cx - (cx - s.tx) * k;
      s.ty = cy - (cy - s.ty) * k;
      clamp(); apply();
    });

    function cleanup(){
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      ov.remove(); _trapImgPendingId = null;
    }
    document.getElementById('trapCropZoomOut').onclick = function(){ stepZoom(-15); };
    document.getElementById('trapCropZoomIn').onclick = function(){ stepZoom(15); };
    document.getElementById('trapCropCenter').onclick = doCenter;
    document.getElementById('trapCropFill').onclick = doFill;
    document.getElementById('trapCropFit').onclick = doFit;
    document.getElementById('trapCropCancel').onclick = cleanup;
    ov.addEventListener('click', function(e){ if(e.target === ov) cleanup(); });
    document.getElementById('trapCropSave').onclick = function(){
      var outW, outH;
      if(ASP >= 1){ outW = 720; outH = Math.round(outW / ASP); }
      else { outH = 980; outW = Math.round(outH * ASP); }
      var ratio = outW / vpW();
      var cv = document.createElement('canvas'); cv.width = outW; cv.height = outH;
      var ctx = cv.getContext('2d');
      var dw = s.iw * s.scale, dh = s.ih * s.scale;
      var covered = (dw >= vpW() - 0.5) && (dh >= VH - 0.5);
      /* desenha a imagem na posição/escala atuais; áreas vazias ficam transparentes (PNG) */
      try{ ctx.drawImage(img, s.tx * ratio, s.ty * ratio, dw * ratio, dh * ratio); }catch(e){}
      var url;
      try{ url = covered ? cv.toDataURL('image/jpeg', 0.85) : cv.toDataURL('image/png'); }catch(e){ url = srcUrl; }
      if(_trapImgStore(id, (ASP >= 1 ? 'wide' : 'poster'), url)){
        if(typeof _renderTela==='function') _renderTela();
        if(typeof _toast==='function') _toast('🖼️ Imagem atualizada (' + (ASP >= 1 ? 'Card/Lista' : 'Pôster') + ').', 'var(--green,#34d399)');
      }
      cleanup();
    };
  }

  function _bindPainelEvents(){
    var host = document.getElementById('trapConteudo');
    if(!host) return;
    _trapEnsureImgInput();
    host.querySelectorAll('.trap-tabs button').forEach(function(b){
      b.addEventListener('click', function(){ _filtroTipo = b.dataset.tipo; _renderTela(); });
    });
    host.querySelectorAll('.trap-chip[data-st]').forEach(function(b){
      b.addEventListener('click', function(){ _filtroStatus = b.dataset.st; _renderTela(); });
    });
    host.querySelectorAll('.trap-viewseg button[data-view]').forEach(function(b){
      b.addEventListener('click', function(){ window._trapSetView(b.dataset.view); });
    });
    var busca = host.querySelector('#trapBusca');
    if(busca) busca.addEventListener('input', function(){ _busca = busca.value; _renderTela(); setTimeout(function(){ var x=document.getElementById('trapBusca'); if(x){ x.focus(); x.setSelectionRange(_busca.length,_busca.length); } },0); });
    var prod = host.querySelector('#trapProduto');
    if(prod) prod.addEventListener('change', function(){ _filtroProduto = prod.value; _renderTela(); });
    var btnG = host.querySelector('#trapBtnGestao');
    if(btnG) btnG.addEventListener('click', function(){
      if(!_ehAdmin()){ _toast('❌ Acesso restrito a administradores', 'var(--red)'); return; }
      _modoGestao = !_modoGestao;
      _toast(_modoGestao ? '⚙ Modo Gestão ativado' : 'Modo usuário comum');
      _renderTela();
    });
  }

  /* ────────────────────────────────────────────────────────────────
     VIEW 2 · ADICIONAR CONTEÚDO (2 caminhos)
     ──────────────────────────────────────────────────────────────── */
  function _viewAdicionar(){
    return ''
      + '<div class="trap-hero">'
      +   '<div><h1>Adicionar conteúdo · 3 caminhos</h1><p>Crie do zero via Claude, importe HTMLs existentes ou adicione um treinamento pronto da biblioteca.</p></div>'
      + '</div>'
      + '<div class="trap-add-grid">'
      +   _caminhoAHtml()
      +   _caminhoBHtml()
      +   _caminhoCHtml()
      + '</div>'
      + _formMetadadosHtml();
  }

  function _caminhoAHtml(){
    return ''
      + '<div class="trap-caminho">'
      +   '<div class="trap-caminho-tag a">CAMINHO A</div>'
      +   '<div class="trap-caminho-h">'
      +     '<div class="trap-caminho-ic a">🤖</div>'
      +     '<div><div class="trap-caminho-t">Criar com o Claude</div><div class="trap-caminho-sub">Assistente IA gera o HTML</div></div>'
      +   '</div>'
      +   '<div class="trap-caminho-desc">Descreva o conteúdo em linguagem natural. O Claude monta a estrutura HTML completa (treinamento ou apresentação), aplica o tema visual e salva pronto para publicar.</div>'
      +   '<div class="trap-fld" style="margin-bottom:10px;"><label>Descreva o conteúdo</label><textarea rows="4" id="trapClaudeDesc" placeholder="Ex: Treinamento sobre Negociação Avançada em 5 módulos, com exercícios práticos no fim de cada módulo. Público: consultores closer."></textarea></div>'
      +   '<button class="trap-btn-primary" style="width:100%;" onclick="window._trapGerarClaude()">⚡ Gerar via Claude</button>'
      +   '<div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--border);font-size:10px;color:var(--muted,#9aa5b1);"><b style="color:var(--accent);">Quando usar:</b> ideias do zero, sem material pronto.</div>'
      + '</div>';
  }

  function _caminhoBHtml(){
    return ''
      + '<div class="trap-caminho">'
      +   '<div class="trap-caminho-tag b">CAMINHO B</div>'
      +   '<div class="trap-caminho-h">'
      +     '<div class="trap-caminho-ic b">📁</div>'
      +     '<div><div class="trap-caminho-t">Importar HTML existente</div><div class="trap-caminho-sub">Vincula sem alterar o arquivo</div></div>'
      +   '</div>'
      +   '<div class="trap-caminho-desc">Aponte o caminho relativo de um HTML standalone (ou pasta com index.html). Foi assim que o <code style="background:var(--bg-2,#161b22);padding:1px 4px;border-radius:3px;font-size:11px;color:var(--blue,#60a5fa);">treinamento-cis/</code> foi adicionado.</div>'
      +   '<div class="trap-fld" style="margin-bottom:10px;"><label>Caminho do HTML (relativo ao dashboard)</label><input type="text" id="trapCamUrl" placeholder="ex: meu-treinamento/index.html  ou  apresentacao-foo.html"></div>'
      +   '<button class="trap-btn-primary" style="width:100%;" onclick="window._trapPreviewHtml()">👁 Visualizar antes de adicionar</button>'
      +   '<div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--border);font-size:10px;color:var(--muted,#9aa5b1);"><b style="color:var(--blue,#60a5fa);">Quando usar:</b> material já feito; preserva 100% do HTML original.</div>'
      + '</div>';
  }

  /* CAMINHO C · Biblioteca de treinamentos prontos da Febracis.
     Lista os conteúdos standalone já construídos (origem 'html-existente'),
     reaproveitando as ações de abrir embutido / nova aba já existentes. */
  function _caminhoCHtml(){
    var prontos = _getItens().filter(function(i){ return i.origem === 'html-existente'; });
    var lista = prontos.length
      ? prontos.map(function(i){
          var partes = Array.isArray(i.estrutura) ? i.estrutura.length + ' partes' : 'standalone';
          var pub = i.status === 'publicado' ? ' · ✓ na listagem' : '';
          return ''
            + '<div class="trap-cat-item">'
            +   '<span class="trap-cat-item-ic">' + _esc(i.icone || '🎓') + '</span>'
            +   '<div class="trap-cat-item-info">'
            +     '<div class="trap-cat-item-t">' + _esc(i.titulo) + '</div>'
            +     '<div class="trap-cat-item-s">📦 ' + _esc(i.produto) + ' · ' + partes + pub + '</div>'
            +   '</div>'
            +   '<button onclick="window._trapAbrirAqui(\'' + _esc(i.id) + '\')" title="Abrir embutido no aplicativo">👁 Abrir</button>'
            +   '<div class="trap-cat-menu-wrap">'
            +     '<button class="sec trap-kebab" onclick="event.stopPropagation();window._trapToggleMenu(\'' + _esc(i.id) + '\',this)" title="Mais ações">⋮</button>'
            +     '<div class="trap-cat-menu" id="trapMenu-' + _esc(i.id) + '">'
            +       '<button onclick="window._trapBaixarPdfCompleto(\'' + _esc(i.id) + '\',this)">🖨️ Imprimir / Salvar PDF</button>'
            +       '<button onclick="window._trapBaixarHtml(\'' + _esc(i.id) + '\',this)">⬇ Baixar HTML</button>'
            +       '<button onclick="window._trapAbrirNovaAba(\'' + _esc(i.id) + '\')">↗ Abrir em nova aba</button>'
            +     '</div>'
            +   '</div>'
            + '</div>';
        }).join('')
      : '<div class="trap-cat-empty">Nenhum treinamento pronto na biblioteca ainda.</div>';
    return ''
      + '<div class="trap-caminho">'
      +   '<div class="trap-caminho-tag c">CAMINHO C</div>'
      +   '<div class="trap-caminho-h">'
      +     '<div class="trap-caminho-ic c">📚</div>'
      +     '<div><div class="trap-caminho-t">Treinamentos prontos</div><div class="trap-caminho-sub">Biblioteca Febracis · 1 clique</div></div>'
      +   '</div>'
      +   '<div class="trap-caminho-desc">Treinamentos comerciais standalone já construídos — com módulos completos e o módulo <b>SPIN Selling</b> adaptado ao produto. Já entram publicados na listagem; abra aqui ou em nova aba.</div>'
      +   '<div class="trap-cat-list">' + lista + '</div>'
      +   '<div style="margin-bottom:12px;padding:11px 13px;background:rgba(240,200,150,.06);border:1px solid rgba(240,200,150,.22);border-radius:9px;font-size:11px;color:var(--muted,#9aa5b1);line-height:1.6;"><b style="color:#f0c896;">➕ Adicionar um novo treinamento:</b><br>envie o PDF do produto ao <b>Claude Code</b> com o comando:<span style="display:block;margin-top:6px;background:#0a0e16;border:1px solid var(--border2,rgba(255,255,255,.14));border-radius:6px;padding:8px;font-family:ui-monospace,Consolas,monospace;color:#d6e2c0;">Novo treinamento: cria o treinamento comercial do produto &lt;nome&gt; a partir do PDF &lt;caminho&gt;, padr&atilde;o FGPC.</span><button onclick="window._trapCopiarComando(this)" style="margin-top:8px;background:rgba(200,240,90,.12);border:1px solid rgba(200,240,90,.30);color:var(--accent);font-size:10px;font-weight:700;padding:6px 11px;border-radius:6px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copiar comando</button></div>'
      +   '<div style="padding-top:10px;border-top:1px dashed var(--border);font-size:10px;color:var(--muted,#9aa5b1);"><b style="color:#f0c896;">Quando usar:</b> publicar um treinamento completo pronto da Febracis (ex.: FGPC, Método CIS).</div>'
      + '</div>';
  }

  /* ── Imprimir treinamento COMPLETO (Apresentação / Apostila) ─────────
     Busca cada parte via fetch (mesmo domínio — funciona online/Pages) e
     abre UMA janela de impressão com dois formatos:
       🎞 Apresentação (padrão) — os slides ORIGINAIS, 1 por página
          1280×720, com o CSS do próprio treinamento (visual idêntico ao
          deck) e as edições inline (cis-edits do localStorage) aplicadas.
       📖 Apostila — documento A4 claro remontado (formato anterior),
          com Retrato/Paisagem.
     Ocultos: respeita partes ocultas (item.paginasOcultas) e slides de
     olhinho (cis-edits:<parte>.hidden). Se houver qualquer item oculto,
     um modal pergunta antes: imprimir sem os ocultos · incluir tudo ·
     cancelar. Dispara window.print() na janela gerada. */

  /* Mesma enumeração de elementos editáveis do engine dos decks
     (data-ed-id = slideId + '.' + índice no querySelectorAll do slide). */
  var _PRINT_EDIT_SELECTOR = 'h1, h2, h3, h4, p, li, cite, .chip, .quote, .bubble, .label, .value, .who, .num, .meta, .axis-x, .axis-y, .pullquote, .module-badge';

  /* Lê o store cis-edits da parte (edições inline + slides de olhinho) */
  function _printStoreDe(url){
    try{
      var path = new URL(url, window.location.href).pathname;
      var key = 'cis-edits:' + (path.split('/').slice(-2).join('/') || 'index');
      var st = JSON.parse(localStorage.getItem(key) || '{}');
      return { edits: st.edits || {}, hidden: Array.isArray(st.hidden) ? st.hidden.map(String) : [] };
    }catch(e){ return { edits: {}, hidden: [] }; }
  }

  function _printTituloSlide(sl, n){
    var t = sl.querySelector('.slide-title') || sl.querySelector('h1, h2, h3');
    var txt = t ? t.textContent.replace(/\s+/g, ' ').trim() : '';
    if(txt.length > 70) txt = txt.slice(0, 67) + '…';
    return txt || ('Slide ' + n);
  }

  /* Modal: o treinamento tem itens ocultos — sem eles / incluir tudo / cancelar */
  function _printModalOcultos(inv, cb, onCancel){
    var old = document.getElementById('trapOcPrintOvl'); if(old) old.remove();
    var ovl = document.createElement('div');
    ovl.id = 'trapOcPrintOvl';
    ovl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
    var itens = inv.map(function(o){
      return '<div style="display:flex;gap:10px;align-items:baseline;padding:6px 0;border-bottom:1px dashed rgba(255,255,255,.08);font-size:13px;">'
        + '<span style="flex:none;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#ffb38a;background:rgba(255,120,60,.16);padding:2px 8px;border-radius:999px;">' + _esc(o.tipo) + '</span>'
        + '<span style="min-width:0;">' + _esc(o.txt) + ' <span style="color:#8b949e;font-size:11.5px;">· ' + _esc(o.onde) + '</span></span>'
        + '</div>';
    }).join('');
    ovl.innerHTML = '<div style="background:#12161d;color:#e6edf3;border:1px solid #30363d;border-radius:14px;max-width:540px;width:100%;padding:22px 24px;box-shadow:0 30px 80px rgba(0,0,0,.6);font-family:system-ui,sans-serif;">'
      + '<h3 style="margin:0 0 4px;font-size:17px;color:#ffb38a;">👁 Este treinamento tem itens ocultos</h3>'
      + '<p style="font-size:12.5px;color:#9aa5b1;margin:0 0 14px;line-height:1.5;">Os itens abaixo estão ocultados na apresentação (olhinho / páginas ocultas). Como você quer gerar o PDF?</p>'
      + '<div style="background:rgba(255,120,60,.07);border:1px solid rgba(255,120,60,.3);border-radius:10px;padding:10px 14px;margin-bottom:16px;max-height:250px;overflow:auto;">' + itens + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      +   '<button data-oc="sem" style="flex:1;min-width:150px;border-radius:8px;padding:11px 12px;font:700 13px system-ui;cursor:pointer;border:1px solid #9a7b1a;background:#9a7b1a;color:#fff;">Imprimir sem os ocultos</button>'
      +   '<button data-oc="tudo" style="flex:1;min-width:120px;border-radius:8px;padding:11px 12px;font:700 13px system-ui;cursor:pointer;border:1px solid #30363d;background:rgba(255,255,255,.05);color:#c9d1d9;">Incluir tudo</button>'
      +   '<button data-oc="cancel" style="flex:0 0 auto;border-radius:8px;padding:11px 14px;font:700 13px system-ui;cursor:pointer;border:1px solid #30363d;background:rgba(255,255,255,.05);color:#9aa5b1;">Cancelar</button>'
      + '</div></div>';
    document.body.appendChild(ovl);
    ovl.addEventListener('click', function(ev){
      var b = ev.target.closest('button[data-oc]');
      if(!b){ if(ev.target === ovl){ ovl.remove(); onCancel(); } return; }
      var op = b.getAttribute('data-oc');
      ovl.remove();
      if(op === 'cancel'){ onCancel(); return; }
      cb(op === 'tudo');
    });
  }

  window._trapBaixarPdfCompleto = function(id, btn){
    var item = _getItens().find(function(i){ return i.id === id; });
    if(!item || !Array.isArray(item.estrutura) || !item.estrutura.length){
      alert('Treinamento sem partes para gerar PDF.'); return;
    }
    var partes = item.estrutura.filter(function(p){ return p && p.url; });
    if(!partes.length){ alert('Treinamento sem partes.'); return; }
    var ocultasUrls = _paginasOcultasDe(item);
    var u0 = partes[0].url;
    var base = u0.substring(0, u0.lastIndexOf('/') + 1);
    var absBase = new URL(base, window.location.href).href;

    var lblOrig = btn ? btn.innerHTML : '';
    if(btn){ btn.disabled = true; btn.innerHTML = '⏳ Gerando…'; }
    function _restore(){ if(btn){ btn.disabled = false; btn.innerHTML = lblOrig; } }

    var parser = new DOMParser();
    var decks = [];     /* {parte, slides:[{el,id,titulo,oculto}], parteOculta} */
    var cssHref = '';   /* CSS do treinamento — identidade visual */

    /* Converte 1 slide em bloco de apostila (eyebrow + título + corpo) */
    function _slideToHtml(sl){
      sl.querySelectorAll('script').forEach(function(s){ s.remove(); });
      var eb = sl.querySelector('.eyebrow');
      var tt = sl.querySelector('.slide-title') || sl.querySelector('h1, h2');
      var body = sl.querySelector('.slide-body');
      var bodyHtml;
      if(body){ bodyHtml = body.innerHTML; }
      else {
        var clone = sl.cloneNode(true);
        var h = clone.querySelector('.slide-header'); if(h) h.remove();
        bodyHtml = clone.innerHTML;
      }
      var out = '<section class="ap-slide">';
      if(eb && eb.textContent.trim()) out += '<div class="ap-eyebrow">' + eb.innerHTML + '</div>';
      if(tt && tt.textContent.trim()) out += '<h2 class="ap-title">' + tt.innerHTML + '</h2>';
      out += '<div class="ap-body">' + bodyHtml + '</div></section>';
      return out;
    }

    /* Busca sequencial das partes (mantém a ordem da estrutura) */
    var seq = Promise.resolve();
    partes.forEach(function(p){
      seq = seq.then(function(){
        return fetch(p.url).then(function(r){ return r.ok ? r.text() : ''; }).then(function(txt){
          if(!txt) return;
          var doc = parser.parseFromString(txt, 'text/html');
          var deckEl = doc.querySelector('.deck');
          var slideEls = Array.prototype.slice.call((deckEl || doc).querySelectorAll('.slide'));
          if(!slideEls.length) return;   /* pula capa/menu (sem slides) */
          if(!cssHref){
            var _lnk = doc.querySelector('head link[rel="stylesheet"]');
            if(_lnk && _lnk.getAttribute('href')) cssHref = new URL(_lnk.getAttribute('href'), absBase).href;
          }
          var st = _printStoreDe(p.url);
          var slides = slideEls.map(function(sl, i){
            var sid = String(i + 1);
            /* aplica as edições inline (mesma enumeração do engine do deck) */
            Array.prototype.forEach.call(sl.querySelectorAll(_PRINT_EDIT_SELECTOR), function(el, k){
              if(el.closest('svg, script, style, .progress, .hud, .home-button, [data-no-edit]')) return;
              var v = st.edits[sid + '.' + k];
              if(typeof v === 'string') el.innerHTML = v;
            });
            return { el: sl, id: sid, titulo: _printTituloSlide(sl, i + 1), oculto: st.hidden.indexOf(sid) !== -1 };
          });
          decks.push({ parte: p, slides: slides, parteOculta: ocultasUrls.indexOf(p.url) !== -1 });
        }).catch(function(){ /* ignora parte que falhar */ });
      });
    });

    seq.then(function(){
      if(!decks.length){
        _restore();
        alert('Não foi possível extrair o conteúdo.\n\nA impressão completa precisa que você esteja acessando o painel ONLINE (GitHub Pages). Em arquivo local (file://) o navegador bloqueia a leitura das partes.');
        return;
      }

      /* Inventário de ocultos → modal antes de gerar */
      var inv = [];
      decks.forEach(function(d){
        var tp = d.parte.titulo || d.parte.url;
        if(d.parteOculta){ inv.push({ tipo: 'Parte', txt: tp, onde: 'página inteira oculta no painel' }); return; }
        d.slides.forEach(function(s){ if(s.oculto) inv.push({ tipo: 'Slide', txt: s.titulo, onde: tp + ' · slide ' + s.id }); });
      });
      if(!inv.length){ _gerar(false, 0); }
      else { _printModalOcultos(inv, function(incluir){ _gerar(incluir, inv.length); }, _restore); }

      function _gerar(incluirOcultos, nOcultos){
        var fdecks = decks
          .filter(function(d){ return incluirOcultos || !d.parteOculta; })
          .map(function(d){ return { parte: d.parte, slides: d.slides.filter(function(s){ return incluirOcultos || !s.oculto; }) }; })
          .filter(function(d){ return d.slides.length; });
        var totalSlides = 0;
        fdecks.forEach(function(d){ totalSlides += d.slides.length; });
        if(!totalSlides){ _restore(); alert('Nada a imprimir — todas as partes/slides estão ocultos.'); return; }

        /* Busca o CSS do treinamento p/ extrair a identidade visual; com fallback. */
        var fb = { ac:'#16a83e', acd:'#0a6d2c', hd:'#0d1b0d' };
        if(cssHref){
          fetch(cssHref).then(function(r){ return r.ok ? r.text() : ''; }).then(function(cssTxt){
            function pick(n, f){ var m = cssTxt.match(new RegExp('--' + n + '\\s*:\\s*([^;]+)')); return m ? m[1].trim() : f; }
            _montar({ ac: pick('cis-yellow', fb.ac), acd: pick('cis-yellow-deep', fb.acd), hd: pick('cis-blue-900', fb.hd) });
          }).catch(function(){ _montar(fb); });
        } else { _montar(fb); }

        function _montar(cor){
          function _tint(hex, a){
            hex = String(hex || '').trim().replace('#','');
            if(hex.length === 3) hex = hex.split('').map(function(c){ return c + c; }).join('');
            var r = parseInt(hex.substr(0,2),16), g = parseInt(hex.substr(2,2),16), b = parseInt(hex.substr(4,2),16);
            if(isNaN(r)||isNaN(g)||isNaN(b)) return 'rgba(16,168,62,' + a + ')';
            return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
          }
          var hoje = new Date();
          var dataStr = hoje.toLocaleDateString('pt-BR') + ' às ' + hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          /* Variáveis de identidade (apostila clara + capa da apresentação) */
          var rootVars = ':root{'
            + '--ac:' + cor.ac + ';--acd:' + cor.acd + ';--hd:' + cor.hd + ';'
            + '--tint:' + _tint(cor.ac, 0.10) + ';--tint2:' + _tint(cor.ac, 0.18) + ';--tline:' + _tint(cor.ac, 0.35) + ';'
            + '}';

          /* ---- vista APRESENTAÇÃO: capa + slides originais ---- */
          var apresHtml = '<section class="slide pv-capa"><div class="pv-capa-in">'
            + '<span class="pv-capa-badge">' + _esc(item.produto || 'Treinamento') + ' · Treinamento Comercial</span>'
            + '<h1>' + _esc(item.titulo) + '</h1>'
            + '<div class="pv-capa-sub">' + fdecks.length + ' parte' + (fdecks.length > 1 ? 's' : '') + ' · ' + totalSlides + ' slides · gerado em ' + _esc(dataStr) + '</div>'
            + '</div></section>';

          /* ---- vista APOSTILA: mesmos slides remontados em A4 claro ---- */
          var sectionsHtml = '';
          var partCount = 0;
          fdecks.forEach(function(d){
            partCount++;
            sectionsHtml += '<div class="ap-part' + (partCount > 1 ? ' brk' : '') + '">'
              + '<div class="ap-part-k">Parte ' + partCount + ' · ' + _esc(item.produto || '') + '</div>'
              + '<h1 class="ap-part-t">' + _esc(d.parte.titulo || ('Parte ' + partCount)) + '</h1>'
              + '</div>';
            d.slides.forEach(function(s){
              var cl = s.el.cloneNode(true);
              Array.prototype.forEach.call(cl.querySelectorAll('script'), function(x){ x.remove(); });
              cl.classList.remove('is-active', 'is-leaving', 'is-hidden-slide', 'dir-prev', 'dir-next');
              apresHtml += cl.outerHTML;
              sectionsHtml += _slideToHtml(cl.cloneNode(true));
            });
          });

          var css = '<style>'
            + rootVars
            + '*{ box-sizing:border-box; }'
            + 'html,body{ margin:0; padding:0; background:#fff; color:#1a1a1a; font-family:"Segoe UI",system-ui,-apple-system,sans-serif; font-size:12px; line-height:1.5; }'
            + 'img{ max-width:100% !important; height:auto; }'
            /* Capa */
            + '.ap-cover{ text-align:center; padding:6px 0 16px; border-bottom:3px solid var(--acd); margin-bottom:18px; }'
            + '.ap-cover .ap-prod{ font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--acd); font-weight:800; }'
            + '.ap-cover h1{ font-size:25px; margin:8px 0 6px; color:var(--hd); }'
            + '.ap-cover .ap-date{ font-size:11px; color:#555; }'
            + '.ap-cover .ap-desc{ font-size:11px; color:#444; max-width:620px; margin:8px auto 0; }'
            /* Separador de parte */
            + '.ap-part{ margin:16px 0 12px; padding:9px 14px; background:var(--tint); border-left:5px solid var(--acd); border-radius:4px; break-after:avoid; page-break-after:avoid; }'
            + '.ap-part.brk{ break-before:page; page-break-before:always; }'
            + '.ap-part-k{ font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--acd); font-weight:800; }'
            + '.ap-part-t{ font-size:18px; margin:2px 0 0; color:var(--hd); }'
            /* Bloco slide */
            + '.ap-slide{ margin:0 0 14px; padding:0 0 11px; border-bottom:1px solid var(--tline); }'
            + '.ap-eyebrow{ font-size:9.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--acd); font-weight:700; margin-bottom:2px; }'
            + '.ap-title{ font-size:15px; color:var(--hd); margin:0 0 8px; break-after:avoid; page-break-after:avoid; }'
            /* Conteúdo genérico */
            + '.ap-body *{ color:#1a1a1a !important; }'
            + '.ap-body strong{ color:var(--acd) !important; font-weight:700; }'
            + '.ap-body h3{ font-size:12.5px; margin:9px 0 3px; color:var(--hd) !important; break-after:avoid; }'
            + '.ap-body h4{ font-size:11.5px; margin:7px 0 3px; color:var(--hd) !important; }'
            + '.ap-body p{ margin:4px 0; }'
            + '.ap-body ul,.ap-body ol{ margin:4px 0 4px 18px; padding:0; }'
            + '.ap-body li{ margin:3px 0; break-inside:avoid; }'
            + '.ap-body li::marker{ color:var(--acd); }'
            + '.ap-body .grid{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }'
            + '.ap-body .grid-3{ grid-template-columns:1fr 1fr 1fr; }'
            + '.ap-body .grid-1{ grid-template-columns:1fr; }'
            + '.ap-body .card,.ap-body .quad,.ap-body .turn,.ap-body .col,.ap-body .step{ background:var(--tint) !important; border:1px solid var(--tline); border-radius:6px; padding:9px 11px; break-inside:avoid; page-break-inside:avoid; }'
            + '.ap-body .card.solid{ background:var(--tint2) !important; border-color:var(--acd); }'
            + '.ap-body .card h3,.ap-body .card h4{ margin-top:0; }'
            + '.ap-body .seq,.ap-body .aida,.ap-body .funnel,.ap-body .matrix,.ap-body .split,.ap-body .script-list,.ap-body .dialog,.ap-body .cols-aside{ display:block; }'
            + '.ap-body .seq>*,.ap-body .aida>*,.ap-body .funnel>*,.ap-body .script-list>*,.ap-body .split>*{ margin:5px 0; break-inside:avoid; page-break-inside:avoid; }'
            + '.ap-body table{ width:100%; border-collapse:collapse; margin:8px 0; font-size:11px; }'
            + '.ap-body th,.ap-body td{ border:1px solid var(--tline); padding:5px 8px; text-align:left; vertical-align:top; }'
            + '.ap-body thead th{ background:var(--tint) !important; color:var(--hd) !important; font-weight:700; }'
            + '.ap-body tr{ break-inside:avoid; page-break-inside:avoid; }'
            + '.ap-body [style*="background-image"]{ background-image:none !important; }'
            + '.ap-foot{ display:none; }'
            /* Tela (pré-visualização) */
            + '@media screen{ body{ background:#525659; } '
            +   '.ap-doc{ background:#fff; max-width:820px; margin:60px auto 40px; padding:30px 36px; box-shadow:0 8px 34px rgba(0,0,0,.45); border-radius:3px; } '
            +   '.ap-bar{ position:fixed; top:0; left:0; right:0; z-index:99; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; background:#161b22; color:#e6edf3; font:600 13px system-ui,sans-serif; padding:9px 16px; border-bottom:1px solid #30363d; } '
            +   '.ap-bar button{ background:rgba(255,255,255,.06); border:1px solid #30363d; color:#9aa5b1; border-radius:6px; padding:7px 13px; font:inherit; cursor:pointer; } '
            +   '.ap-bar button.on{ background:rgba(56,189,248,.16); border-color:#38bdf8; color:#38bdf8; } '
            +   '.ap-bar .ap-print{ background:var(--acd); border:none; color:#fff; font-weight:700; } }'
            /* Impressão */
            + '@media print{ '
            +   'body{ background:#fff !important; } '
            +   '*{ animation:none !important; transition:none !important; box-shadow:none !important; text-shadow:none !important; } '
            +   '.ap-bar{ display:none !important; } '
            +   '.ap-doc{ margin:0; padding:0; max-width:none; box-shadow:none; } '
            +   '.ap-foot{ display:block; position:fixed; bottom:6mm; left:0; right:0; text-align:center; font-size:8.5px; color:#888; } }'
            + '</style>';

          /* ---- CSS da vista Apresentação (receita validada: 1 slide = 1 página 1280×720) ---- */
          var apresCss = '<style>'
            /* html do deck traz overflow:hidden/height — sem este reset sobra 1 página em branco no fim */
            + 'html{ overflow:visible !important; height:auto !important; }'
            + 'body.view-apres{ background:#525659 !important; overflow:auto !important; height:auto !important; font-size:16px !important; }'
            + 'body.view-apres .ap-doc, body.view-apres .ap-foot{ display:none !important; }'
            + 'body.view-apost #pvApres{ display:none !important; }'
            + 'body.view-apres #grpOrient{ display:none !important; }'
            + '#pvApres .slide{ position:relative !important; inset:auto !important; display:flex !important; width:1280px !important; height:720px !important; margin:0 !important; border-radius:0 !important; box-shadow:none !important; overflow:hidden !important; animation:none !important; }'
            + '#pvApres .slide *{ animation:none !important; transition:none !important; }'
            + '#pvApres, #pvApres *{ -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }'
            + '.pv-capa{ background:radial-gradient(circle at 85% 15%, rgba(255,255,255,.06), transparent 45%), linear-gradient(160deg,#141414 0%,#111111 55%,#0d0d0d 100%) !important; }'
            + '.pv-capa .pv-capa-in{ margin:auto; text-align:center; position:relative; z-index:1; }'
            + '.pv-capa-badge{ display:inline-block; background:var(--ac); color:#111; font:800 13px/1 system-ui,sans-serif; letter-spacing:.14em; text-transform:uppercase; padding:8px 22px; border-radius:999px; }'
            + '.pv-capa h1{ color:var(--ac); font-size:58px; margin:26px 0 10px; font-family:"Inter","Segoe UI",sans-serif; }'
            + '.pv-capa-sub{ color:#9c9c9c; font-size:17px; font-family:"Inter","Segoe UI",sans-serif; }'
            + '@media screen{'
            +   '#pvApres{ padding:72px 0 46px; }'
            +   '#pvApres .slide{ zoom:.62; margin:0 auto 28px !important; box-shadow:0 10px 40px rgba(0,0,0,.55) !important; }'
            + '}'
            + '@media print{'
            +   '#pvApres{ padding:0; }'
            +   '#pvApres .slide{ page-break-after:always !important; box-shadow:none !important; }'
            +   '#pvApres .slide:last-child{ page-break-after:auto !important; }'
            + '}'
            + '</style>';

          var orientCss = '<style id="apOrient">@page{ size:1280px 720px; margin:0 }</style>';

          var chipOcultos = nOcultos
            ? '<span style="background:rgba(255,120,60,.15);border:1px solid rgba(255,120,60,.5);color:#ffb38a;border-radius:6px;padding:5px 10px;font-size:12px;">👁 ' + nOcultos + ' oculto' + (nOcultos > 1 ? 's' : '') + ' ' + (incluirOcultos ? 'incluído' + (nOcultos > 1 ? 's' : '') : 'fora') + '</span>'
            : '';
          var bar = '<div class="ap-bar">'
            + '<span>📄 ' + _esc(item.titulo) + '</span>'
            + '<span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
            +   chipOcultos
            +   '<span style="opacity:.7;font-weight:500;">Formato:</span>'
            +   '<button id="btnApres" class="on" onclick="setModo(\'apresentacao\')">🎞 Apresentação</button>'
            +   '<button id="btnApost" onclick="setModo(\'apostila\')">📖 Apostila A4</button>'
            +   '<span id="grpOrient" style="display:flex;gap:8px;align-items:center;">'
            +     '<span style="opacity:.7;font-weight:500;">A4:</span>'
            +     '<button id="btnPort" class="on" onclick="setOrient(\'portrait\')">Retrato</button>'
            +     '<button id="btnLand" onclick="setOrient(\'landscape\')">Paisagem</button>'
            +   '</span>'
            +   '<button class="ap-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>'
            + '</span>'
            + '</div>';
          var script = '<scr' + 'ipt>'
            + 'var PORT="@page{size:A4 portrait;margin:16mm 14mm 18mm}";'
            + 'var LAND="@page{size:A4 landscape;margin:14mm 16mm 16mm}";'
            + 'var APRES="@page{size:1280px 720px;margin:0}";'
            + 'var TIT=' + JSON.stringify(String(item.titulo || '')) + ';'
            + 'var _ori="portrait";'
            + 'function setOrient(o){_ori=o;var P=document.getElementById("btnPort"),L=document.getElementById("btnLand");if(P)P.className=(o==="portrait")?"on":"";if(L)L.className=(o==="landscape")?"on":"";if(document.body.className.indexOf("view-apost")>=0)document.getElementById("apOrient").textContent=(o==="landscape")?LAND:PORT;}'
            + 'function setModo(m){var a=(m==="apresentacao");document.body.className=a?"view-apres":"view-apost";var d=document.getElementById("deckCss");if(d)d.disabled=!a;document.getElementById("apOrient").textContent=a?APRES:((_ori==="landscape")?LAND:PORT);var A=document.getElementById("btnApres"),B=document.getElementById("btnApost");if(A)A.className=a?"on":"";if(B)B.className=a?"on":"";document.title=TIT+(a?" — Apresentação":" — Apostila");}'
            + '</scr' + 'ipt>';
          var cover = '<div class="ap-cover">'
            + '<div class="ap-prod">' + _esc(item.produto || '') + ' · Treinamento Comercial</div>'
            + '<h1>' + _esc(item.titulo) + '</h1>'
            + '<div class="ap-date">Documento gerado em ' + _esc(dataStr) + '</div>'
            + (item.descricao ? '<div class="ap-desc">' + _esc(item.descricao) + '</div>' : '')
            + '</div>';
          var foot = '<div class="ap-foot">Documento gerado automaticamente pelo sistema de treinamento</div>';

          var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">'
            + '<base href="' + absBase + '">'
            + css
            + (cssHref ? '<link id="deckCss" rel="stylesheet" href="' + cssHref + '">' : '')
            + apresCss + orientCss
            + '<title>' + _esc(item.titulo) + ' — Apresentação</title></head>'
            + '<body class="view-apres">'
            + bar
            + '<div id="pvApres">' + apresHtml + '</div>'
            + '<div class="ap-doc">' + cover + sectionsHtml + '</div>'
            + foot
            + script
            + '</body></html>';
          var w = window.open('', '_blank');
          if(!w){ _restore(); alert('Permita pop-ups (janelas) para gerar a impressão e tente novamente.'); return; }
          w.document.open(); w.document.write(html); w.document.close();
          _restore();
        }
      }
    });
  };

  /* ── Baixar treinamento COMPLETO como arquivo HTML ───────
     Replica a arquitetura real: SHELL (index.html, com o menu —
     Visão geral, Trilha completa, módulos) + cada módulo embutido
     como blob carregado no iframe. CSS e engine JS embutidos.
     Resultado: 1 arquivo com menu navegável + apresentações
     animadas, idêntico ao original. */
  window._trapBaixarHtml = function(id, btn){
    var item = _getItens().find(function(i){ return i.id === id; });
    if(!item || !Array.isArray(item.estrutura) || !item.estrutura.length){
      alert('Treinamento sem partes para gerar HTML.'); return;
    }
    var partes = item.estrutura.filter(function(p){ return p && p.url; });
    if(!partes.length){ alert('Treinamento sem partes.'); return; }
    var u0 = partes[0].url;
    var base = u0.substring(0, u0.lastIndexOf('/') + 1);
    var absBase = new URL(base, window.location.href).href;

    var lblOrig = btn ? btn.innerHTML : '';
    if(btn){ btn.disabled = true; btn.innerHTML = '⏳ Gerando…'; }
    function _restore(){ if(btn){ btn.disabled = false; btn.innerHTML = lblOrig; } }

    var parser = new DOMParser();
    var shellTxt = '';          /* index.html (menu) — parte SEM .deck */
    var moduleTxt = {};         /* nomeArquivo.html -> HTML cru (partes COM .deck) */
    var cssHref = '', jsHref = '';

    var seq = Promise.resolve();
    partes.forEach(function(p){
      seq = seq.then(function(){
        return fetch(p.url).then(function(r){ return r.ok ? r.text() : ''; }).then(function(txt){
          if(!txt) return;
          var fn = p.url.substring(p.url.lastIndexOf('/') + 1);
          var doc = parser.parseFromString(txt, 'text/html');
          if(doc.querySelector('.deck')){
            moduleTxt[fn] = txt;
            if(!cssHref){ var l = doc.querySelector('head link[rel="stylesheet"]'); if(l && l.getAttribute('href')) cssHref = new URL(l.getAttribute('href'), absBase).href; }
            if(!jsHref){ var s = doc.querySelector('script[src]'); if(s && s.getAttribute('src')) jsHref = new URL(s.getAttribute('src'), absBase).href; }
          } else if(!shellTxt){
            shellTxt = txt;   /* capa/índice = shell com o menu */
          }
        }).catch(function(){ /* ignora parte que falhar */ });
      });
    });

    seq.then(function(){
      var temMod = Object.keys(moduleTxt).length > 0;
      if(!temMod || !shellTxt){
        _restore();
        alert('Não foi possível montar o treinamento.\n\nA geração precisa que você esteja acessando o painel ONLINE (GitHub Pages). Em arquivo local (file://) o navegador bloqueia a leitura das partes.');
        return;
      }
      Promise.all([
        cssHref ? fetch(cssHref).then(function(r){ return r.ok ? r.text() : ''; }).catch(function(){ return ''; }) : Promise.resolve(''),
        jsHref  ? fetch(jsHref ).then(function(r){ return r.ok ? r.text() : ''; }).catch(function(){ return ''; }) : Promise.resolve('')
      ]).then(function(res){
        var cssText = res[0], jsText = res[1];

        /* Monta um documento self-contained (base + CSS inline + engine inline) */
        function selfContained(rawTxt, isShell){
          var d = parser.parseFromString(rawTxt, 'text/html');
          var head = d.querySelector('head');
          if(head){ var b = d.createElement('base'); b.setAttribute('href', absBase); head.insertBefore(b, head.firstChild); }
          if(cssText){
            var lnk = d.querySelector('head link[rel="stylesheet"]');
            var st = d.createElement('style'); st.textContent = cssText;
            if(lnk) lnk.replaceWith(st); else if(head) head.appendChild(st);
          }
          if(!isShell && jsText){   /* só módulos têm engine externa; o shell tem script inline próprio */
            var scr = d.querySelector('script[src]');
            var ns = d.createElement('script'); ns.textContent = jsText;
            if(scr) scr.replaceWith(ns); else d.body.appendChild(ns);
          }
          var t = d.querySelector('title'); if(t && isShell) t.textContent = item.titulo;
          return '<!DOCTYPE html>\n' + d.documentElement.outerHTML;
        }

        /* Módulos embutidos por nome de arquivo */
        var MOD = {};
        Object.keys(moduleTxt).forEach(function(fn){ MOD[fn] = selfContained(moduleTxt[fn], false); });

        /* Shell (menu) */
        var shellHtml = selfContained(shellTxt, true);
        /* Aponta as rotas (ROUTES) do menu para os blobs embutidos */
        shellHtml = shellHtml.replace(/file:\s*'([^']+\.html)'/g, function(m, fn){
          return "file: (window.__MODURL && window.__MODURL['" + fn + "'])";
        });
        /* Bootstrap: cria os módulos como blob URLs ANTES do script do menu */
        var modJson = JSON.stringify(MOD).replace(/<\/script/gi, '<\\/script');
        var boot = '<scr' + 'ipt>window.__MOD=' + modJson + ';window.__MODURL={};'
          + '(function(){for(var k in window.__MOD){try{window.__MODURL[k]=URL.createObjectURL(new Blob([window.__MOD[k]],{type:"text/html"}));}catch(e){}}})();'
          + '</scr' + 'ipt>';
        if(shellHtml.indexOf('</head>') >= 0) shellHtml = shellHtml.replace('</head>', boot + '</head>');
        else shellHtml = boot + shellHtml;

        /* Injeta a busca "estilo Word" no HTML baixado (índice embutido, sem fetch) */
        try{
          var fileTitulo = {};
          partes.forEach(function(p){ var fnm = p.url.substring(p.url.lastIndexOf('/') + 1); fileTitulo[fnm] = p.titulo || fnm; });
          var findIdx = _findBuildDownloadIndex(shellTxt, moduleTxt, fileTitulo);
          if(findIdx.length){
            var inj = _findDownloadInjection(findIdx);
            if(shellHtml.indexOf('</body>') >= 0) shellHtml = shellHtml.replace('</body>', inj + '</body>');
            else shellHtml = shellHtml + inj;
          }
        }catch(e){ /* se a indexação falhar, baixa o HTML sem a busca */ }

        var slug = String(item.id || item.titulo || 'treinamento').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
        try{
          var blob = new Blob([shellHtml], { type: 'text/html;charset=utf-8' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = slug + '-completo.html';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
          if(typeof _toast === 'function') _toast('HTML baixado: ' + slug + '-completo.html', 'var(--green,#34d399)');
        }catch(e){ alert('Erro ao baixar o HTML. ' + (e && e.message ? e.message : '')); }
        _restore();
      });
    });
  };

  /* ── Menu "⋮" (mais ações) do item de treinamento ────────
     Posiciona em fixed p/ não ser cortado pela lista rolável.
     Fecha ao clicar fora ou rolar. Um menu aberto por vez. */
  window._trapToggleMenu = function(id, btn){
    var menu = document.getElementById('trapMenu-' + id);
    if(!menu) return;
    var isOpen = menu.classList.contains('open');
    document.querySelectorAll('.trap-cat-menu.open').forEach(function(m){ m.classList.remove('open'); });
    if(isOpen) return;
    var r = btn.getBoundingClientRect();
    menu.style.top = (r.bottom + 5) + 'px';
    menu.style.left = Math.max(8, Math.min(r.right - 200, window.innerWidth - 208)) + 'px';
    menu.classList.add('open');
    setTimeout(function(){
      function close(ev){
        if(menu.contains(ev.target) || ev.target === btn) return;
        menu.classList.remove('open');
        document.removeEventListener('click', close, true);
        window.removeEventListener('scroll', close, true);
      }
      document.addEventListener('click', close, true);
      window.addEventListener('scroll', close, true);
    }, 0);
  };

  /* Copia para a área de transferência o comando-modelo de criação de treinamento. */
  function _trapCopiaFallback(txt){
    try{
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.top = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }catch(e){}
  }
  window._trapCopiarComando = function(btn){
    var txt = 'Novo treinamento: cria o treinamento comercial do produto <nome> a partir do PDF <caminho>, padrão FGPC.';
    function done(){
      if(!btn) { _toast('Comando copiado', 'var(--green,#34d399)'); return; }
      var orig = btn.innerHTML;
      btn.innerHTML = '✓ Copiado!';
      btn.style.background = 'var(--green,#34d399)';
      btn.style.color = 'var(--bg,#0d1117)';
      btn.style.borderColor = 'var(--green,#34d399)';
      setTimeout(function(){
        btn.innerHTML = orig;
        btn.style.background = 'rgba(200,240,90,.12)';
        btn.style.color = 'var(--accent)';
        btn.style.borderColor = 'rgba(200,240,90,.30)';
      }, 1600);
    }
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(txt).then(done, function(){ _trapCopiaFallback(txt); done(); });
      } else { _trapCopiaFallback(txt); done(); }
    }catch(e){ _trapCopiaFallback(txt); done(); }
  };

  function _formMetadadosHtml(){
    return ''
      + '<div class="trap-meta-form">'
      +   '<div class="trap-meta-h"><div class="trap-meta-h-ic">⚙</div><div><div style="font-size:14px;font-weight:800;color:#f0c896;">Metadados · etapa final (comum aos 2 caminhos)</div><div style="font-size:11px;color:var(--muted,#9aa5b1);">Define como o conteúdo aparece na listagem.</div></div></div>'
      +   '<div class="trap-meta-grid">'
      +     '<div class="trap-fld"><label>Título de exibição</label><input type="text" id="trapMTitulo" placeholder="Ex: Treinamento Método CIS"></div>'
      +     '<div class="trap-fld"><label>Tipo</label><select id="trapMTipo"><option value="treinamento">🎓 Treinamento</option><option value="apresentacao">🎯 Apresentação</option></select></div>'
      +     '<div class="trap-fld"><label>Produto</label><input type="text" id="trapMProduto" placeholder="Ex: CIS, Comercial, Pipeline"></div>'
      +   '</div>'
      +   '<div class="trap-fld" style="margin-bottom:14px;"><label>Descrição curta (exibida no card)</label><input type="text" id="trapMDesc" placeholder="Resumo em 1-2 frases"></div>'
      +   '<div class="trap-meta-grid" style="grid-template-columns:1fr 1fr 1fr;">'
      +     '<div class="trap-fld"><label>Ordem na lista (menor aparece antes)</label><input type="number" id="trapMOrdem" value="10"></div>'
      +     '<div class="trap-fld"><label>Ícone (emoji)</label><input type="text" id="trapMIcone" value="🎓" maxlength="4"></div>'
      +     '<div class="trap-fld"><label>URL / caminho do HTML</label><input type="text" id="trapMUrl" placeholder="caminho/index.html"></div>'
      +   '</div>'
      +   '<div class="trap-meta-foot">'
      +     '<label style="display:flex;align-items:center;gap:7px;font-size:11px;cursor:pointer;"><input type="checkbox" id="trapMPub" checked> <b>● Publicar imediatamente</b></label>'
      +     '<label style="display:flex;align-items:center;gap:7px;font-size:11px;cursor:pointer;"><input type="checkbox" id="trapMNovo" checked> ✨ Marcar como Novo</label>'
      +     '<div style="flex:1;"></div>'
      +     '<button class="trap-btn-sec" onclick="window._trapIr(\'painel\')">Cancelar</button>'
      +     '<button class="trap-btn-primary" onclick="window._trapAdicionar()">✓ Adicionar à listagem</button>'
      +   '</div>'
      + '</div>';
  }

  /* ────────────────────────────────────────────────────────────────
     VIEW · WIZARD CRIAR VIA CLAUDE (Caminho A · 4 etapas)
     ────────────────────────────────────────────────────────────────
     1. Briefing + PDFs · 2. Prompt + colar resposta
     3. Editor + sugestões + preview · 4. Metadados + salvar
     ──────────────────────────────────────────────────────────────── */
  function _viewCriarClaude(){
    var stepper = ''
      + '<div class="trap-wiz-steps">'
      +   _wizStepHtml(1, '📎', 'Briefing & PDFs', 'descreva + anexe materiais')
      +   _wizStepHtml(2, '🤖', 'Gerar via Claude', 'prompt + colar HTML')
      +   _wizStepHtml(3, '✎',  'Editor & Preview', 'ajuste com sugestões')
      +   _wizStepHtml(4, '✓',  'Salvar', 'metadados + adicionar')
      + '</div>';

    var corpo;
    if(_claudeStep === 1)      corpo = _wizStep1Html();
    else if(_claudeStep === 2) corpo = _wizStep2Html();
    else if(_claudeStep === 3) corpo = _wizStep3Html();
    else                       corpo = _wizStep4Html();

    return ''
      + '<div class="trap-hero">'
      +   '<div><h1>🤖 Criar com o Claude</h1><p>Wizard de 4 etapas. PDFs são anexados ao Claude; o HTML gerado é editado e visualizado antes de ir pra listagem.</p></div>'
      +   '<button class="trap-btn-sec" onclick="window._trapWizCancelar()">✕ Cancelar</button>'
      + '</div>'
      + stepper
      + corpo;
  }

  function _wizStepHtml(n, ic, t, s){
    var cls = (_claudeStep === n ? 'curr' : (_claudeStep > n ? 'done' : ''));
    return ''
      + '<div class="trap-wiz-step '+cls+'" onclick="window._trapWizIr('+n+')">'
      +   '<div class="trap-wiz-step-n">'+(_claudeStep > n ? '✓' : n)+'</div>'
      +   '<div><div class="trap-wiz-step-s">Etapa '+n+'</div><div class="trap-wiz-step-t">'+ic+' '+t+'</div></div>'
      + '</div>';
  }

  /* ── STEP 1 · Briefing + PDFs ── */
  function _wizStep1Html(){
    var b = _claudeBriefing;
    var pdfsHtml = '';
    if(_claudePdfs.length){
      pdfsHtml = '<div class="trap-pdf-list">'
        + _claudePdfs.map(function(p, i){
            return '<div class="trap-pdf-item">'
              + '<span class="trap-pdf-item-ic">📄</span>'
              + '<div class="trap-pdf-item-info"><div class="trap-pdf-item-n">'+_esc(p.name)+'</div><div class="trap-pdf-item-s">'+_fmtKb(p.size)+'</div></div>'
              + '<button onclick="window._trapPdfRemover('+i+')" title="Remover">✕</button>'
              + '</div>';
          }).join('')
        + '</div>';
    }

    return ''
      + '<div class="trap-wiz-panel">'
      +   '<h3>📎 Etapa 1 · Briefing & PDFs</h3>'
      +   '<div class="sub">Anexe os PDFs de referência (apresentações antigas, materiais base, artigos) e descreva o que quer criar. Os PDFs ficam disponíveis pra você anexar diretamente no Claude.ai.</div>'

      +   '<div id="trapDropzone" class="trap-dropzone" onclick="document.getElementById(\'trapPdfInput\').click()">'
      +     '<div class="trap-dropzone-ic">📎</div>'
      +     '<div class="trap-dropzone-t">Arraste PDFs aqui ou clique para selecionar</div>'
      +     '<div class="trap-dropzone-s">Aceita múltiplos arquivos · máx 20MB cada</div>'
      +   '</div>'
      +   '<input type="file" id="trapPdfInput" accept="application/pdf" multiple style="display:none;">'
      +   pdfsHtml

      +   '<div style="height:18px;"></div>'
      +   '<div class="trap-meta-grid" style="grid-template-columns:1fr 1fr;">'
      +     '<div class="trap-fld"><label>Tipo de conteúdo</label><select id="trapWBTipo"><option value="treinamento"'+(b.tipo==='treinamento'?' selected':'')+'>🎓 Treinamento (módulos/etapas)</option><option value="apresentacao"'+(b.tipo==='apresentacao'?' selected':'')+'>🎯 Apresentação (slides)</option></select></div>'
      +     '<div class="trap-fld"><label>Tema visual</label><select id="trapWBTema"><option value="black-tie"'+(b.tema==='black-tie'?' selected':'')+'>Black Tie (preto + dourado)</option><option value="champagne"'+(b.tema==='champagne'?' selected':'')+'>Champagne (claro)</option><option value="lima"'+(b.tema==='lima'?' selected':'')+'>Verde Lima</option><option value="febracis"'+(b.tema==='febracis'?' selected':'')+'>Febracis padrão</option></select></div>'
      +   '</div>'
      +   '<div class="trap-fld" style="margin-bottom:14px;">'
      +     '<label>Público-alvo · digite ou clique nas opções abaixo</label>'
      +     '<input type="text" id="trapWBPublico" placeholder="Ex: consultores closer com 6+ meses, gestores comerciais..." value="'+_esc(b.publico)+'">'
      +     _chipsPublicoHtml(b.publico)
      +   '</div>'
      +   '<div class="trap-fld">'
      +     '<label>Conteúdo · objetivo, escopo, módulos/slides desejados</label>'
      +     '<div class="trap-extract-bar">'
      +       '<button type="button" class="trap-extract-btn" id="trapBtnExtrair" onclick="window._trapExtrairPdf(this)"'+(_claudePdfs.length?'':' disabled')+'>🔍 Extrair automaticamente dos '+_claudePdfs.length+' PDF(s)</button>'
      +       '<span class="trap-extract-hint">'+(_claudePdfs.length?'O texto extraído é colocado no campo abaixo. Você pode editar livremente depois.':'Anexe PDFs na seção acima para habilitar a extração automática.')+'</span>'
      +     '</div>'
      +     '<textarea id="trapWBDesc" rows="8" placeholder="Ex: Treinamento sobre Negociação Avançada em 5 módulos. Cada módulo deve ter 1 vídeo conceitual + 1 exercício prático + checkpoint. Foco em quebra de objeções e fechamento sob pressão.\n\nOU clique em &quot;Extrair automaticamente dos PDFs&quot; acima.">'+_esc(b.desc)+'</textarea>'
      +   '</div>'
      + '</div>'

      + '<div class="trap-wiz-nav">'
      +   '<button class="trap-btn-sec" onclick="window._trapWizCancelar()">‹ Cancelar</button>'
      +   '<button class="trap-btn-primary" onclick="window._trapWizProx(1)">Continuar para o Claude →</button>'
      + '</div>';
  }

  /* ── STEP 2 · Prompt + colar HTML ── */
  function _wizStep2Html(){
    var prompt = _gerarPromptClaude();
    var temPdfs = _claudePdfs.length > 0;

    return ''
      + '<div class="trap-wiz-panel">'
      +   '<h3>🤖 Etapa 2 · Gerar via Claude</h3>'
      +   '<div class="sub">Use o botão abaixo pra copiar o prompt + abrir o Claude.ai. Anexe os '+(_claudePdfs.length)+' PDF(s) selecionado(s), cole o prompt, e cole o HTML gerado de volta aqui.</div>'

      +   '<div style="background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.25);border-radius:10px;padding:14px;margin-bottom:14px;">'
      +     '<div style="font-size:11px;font-weight:800;color:var(--blue,#60a5fa);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">📋 Como fazer (3 passos):</div>'
      +     '<ol style="font-size:12px;color:var(--muted,#9aa5b1);line-height:1.7;margin:0;padding-left:20px;">'
      +       '<li>Clique <b style="color:var(--blue,#60a5fa);">"Copiar + Abrir Claude.ai"</b> abaixo</li>'
      +       '<li>No Claude.ai: <b>anexe os PDFs</b> (clipe 📎)'+(temPdfs?'':' — você não tem PDFs anexados, mas pode subir lá direto')+', cole o prompt e envie</li>'
      +       '<li>Cole o HTML gerado pelo Claude no campo abaixo</li>'
      +     '</ol>'
      +   '</div>'

      +   '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">'
      +     '<button class="trap-btn-primary" onclick="window._trapCopiarEAbrirClaude()">📋 Copiar prompt + Abrir Claude.ai</button>'
      +     '<button class="trap-btn-sec" onclick="window._trapCopiarPrompt()">📋 Apenas copiar prompt</button>'
      +     '<button class="trap-btn-sec" onclick="window.open(\'https://claude.ai/new\',\'_blank\',\'noopener,noreferrer\')">↗ Abrir Claude.ai</button>'
      +   '</div>'

      +   '<div style="margin-bottom:14px;">'
      +     '<div style="font-size:10px;font-weight:800;color:var(--muted,#9aa5b1);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">PROMPT GERADO</div>'
      +     '<div class="trap-prompt-box" id="trapPromptBox">'+_esc(prompt)+'</div>'
      +   '</div>'

      +   '<div class="trap-fld">'
      +     '<label>Cole aqui o HTML completo que o Claude gerou (do &lt;!DOCTYPE html&gt; até &lt;/html&gt;)</label>'
      +     '<textarea id="trapWHtmlInput" rows="10" placeholder="<!DOCTYPE html>..." style="font-family:\'DM Mono\',monospace;font-size:11px;">'+_esc(_claudeHtml)+'</textarea>'
      +   '</div>'
      + '</div>'

      + '<div class="trap-wiz-nav">'
      +   '<button class="trap-btn-sec" onclick="window._trapWizIr(1)">‹ Voltar</button>'
      +   '<button class="trap-btn-primary" onclick="window._trapWizProx(2)">Editar HTML →</button>'
      + '</div>';
  }

  /* ── STEP 3 · Editor + Sugestões + Preview ── */
  function _wizStep3Html(){
    return ''
      + '<div class="trap-wiz-panel">'
      +   '<h3>✎ Etapa 3 · Editor com sugestões + Preview</h3>'
      +   '<div class="sub">Edite o HTML diretamente e veja o resultado em tempo real. Use as sugestões à direita para aplicar transformações rápidas.</div>'

      +   '<div class="trap-ed-grid">'
      +     '<div class="trap-ed-pane">'
      +       '<div class="trap-ed-pane-h">📝 HTML</div>'
      +       '<textarea class="trap-ed-textarea" id="trapEdHtml" spellcheck="false">'+_esc(_claudeHtml)+'</textarea>'
      +     '</div>'
      +     '<div class="trap-ed-pane">'
      +       '<div class="trap-ed-pane-h">👁 Preview ao vivo</div>'
      +       '<div class="trap-ed-preview" id="trapEdPreviewWrap">'
      +         (_claudeHtml
              ? '<iframe id="trapEdPreview" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>'
              : '<div class="trap-ed-preview-vazio"><div style="font-size:36px;opacity:.4;">📭</div>Cole o HTML pra ver o preview</div>')
      +       '</div>'
      +     '</div>'
      +     '<div class="trap-ed-sug">'
      +       '<h5>✨ Sugestões rápidas</h5>'
      +       '<button class="trap-ed-sug-btn" onclick="window._trapSug(\'capa\')">🎯 Adicionar capa atrativa<br><small style="opacity:.6;font-weight:500;">hero + título + subtítulo</small></button>'
      +       '<button class="trap-ed-sug-btn" onclick="window._trapSug(\'indice\')">📋 Inserir índice no início<br><small style="opacity:.6;font-weight:500;">TOC clicável com âncoras</small></button>'
      +       '<button class="trap-ed-sug-btn" onclick="window._trapSug(\'cta\')">🔗 Adicionar CTA final<br><small style="opacity:.6;font-weight:500;">Próximos passos + contato</small></button>'

      +       '<h5>🎨 Temas visuais</h5>'
      +       '<button class="trap-ed-sug-btn" onclick="window._trapSug(\'tema-blacktie\')">⚫ Black Tie (preto + dourado)</button>'
      +       '<button class="trap-ed-sug-btn" onclick="window._trapSug(\'tema-champagne\')">🥂 Champagne (claro elegante)</button>'
      +       '<button class="trap-ed-sug-btn" onclick="window._trapSug(\'tema-lima\')">🟢 Verde Lima</button>'

      +       '<h5>📐 Estrutura</h5>'
      +       '<button class="trap-ed-sug-btn" onclick="window._trapSug(\'fontes\')">✒ Aplicar Playfair + DM Sans</button>'
      +       '<button class="trap-ed-sug-btn" onclick="window._trapSug(\'responsivo\')">📱 Garantir responsividade</button>'
      +       '<button class="trap-ed-sug-btn" onclick="window._trapSug(\'limpar\')">🧹 Limpar comentários HTML</button>'
      +     '</div>'
      +   '</div>'
      + '</div>'

      + '<div class="trap-wiz-nav">'
      +   '<button class="trap-btn-sec" onclick="window._trapWizIr(2)">‹ Voltar</button>'
      +   '<div class="right">'
      +     '<button class="trap-btn-sec" onclick="window._trapDownloadHtml()">⬇ Baixar HTML</button>'
      +     '<button class="trap-btn-primary" onclick="window._trapWizProx(3)">Próximo: salvar →</button>'
      +   '</div>'
      + '</div>';
  }

  /* ── STEP 4 · Metadados + Salvar ── */
  function _wizStep4Html(){
    var b = _claudeBriefing;
    var tituloSug = _extrairTitulo(_claudeHtml) || '';

    return ''
      + '<div class="trap-wiz-panel">'
      +   '<h3>✓ Etapa 4 · Metadados & salvar</h3>'
      +   '<div class="sub">Defina como o conteúdo aparece na listagem. O HTML é salvo no Firebase (treinamentos/htmls/{id}) e abre embutido.</div>'

      +   '<div class="trap-meta-grid">'
      +     '<div class="trap-fld"><label>Título de exibição</label><input type="text" id="trapWMTit" value="'+_esc(tituloSug)+'" placeholder="Ex: Negociação Avançada para Closers"></div>'
      +     '<div class="trap-fld"><label>Tipo</label><select id="trapWMTipo"><option value="treinamento"'+(b.tipo==='treinamento'?' selected':'')+'>🎓 Treinamento</option><option value="apresentacao"'+(b.tipo==='apresentacao'?' selected':'')+'>🎯 Apresentação</option></select></div>'
      +     '<div class="trap-fld"><label>Produto</label><input type="text" id="trapWMProd" value="'+_esc(b.produto)+'" placeholder="Ex: CIS, Comercial"></div>'
      +   '</div>'
      +   '<div class="trap-fld" style="margin-bottom:14px;"><label>Descrição curta</label><input type="text" id="trapWMDesc" placeholder="1-2 frases que aparecem no card"></div>'
      +   '<div class="trap-meta-grid" style="grid-template-columns:1fr 1fr 1fr;">'
      +     '<div class="trap-fld"><label>Ordem</label><input type="number" id="trapWMOrdem" value="100"></div>'
      +     '<div class="trap-fld"><label>Ícone</label><input type="text" id="trapWMIcone" value="🤖" maxlength="4"></div>'
      +     '<div class="trap-fld"><label>Tamanho do HTML</label><input type="text" value="'+_fmtKb((_claudeHtml||'').length)+'" disabled></div>'
      +   '</div>'

      +   '<div style="background:rgba(200,240,90,.05);border:1px solid rgba(200,240,90,.2);border-radius:10px;padding:14px;margin-top:14px;">'
      +     '<div style="font-size:11px;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">👁 Última pré-visualização antes de adicionar</div>'
      +     '<div style="aspect-ratio:16/9;background:#fff;border-radius:6px;overflow:hidden;border:1px solid var(--border);">'
      +       '<iframe id="trapWMPreview" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" style="width:100%;height:100%;border:0;"></iframe>'
      +     '</div>'
      +   '</div>'

      +   '<div class="trap-meta-foot" style="margin-top:16px;">'
      +     '<label style="display:flex;align-items:center;gap:7px;font-size:11px;cursor:pointer;"><input type="checkbox" id="trapWMPub" checked> <b>● Publicar imediatamente</b></label>'
      +     '<label style="display:flex;align-items:center;gap:7px;font-size:11px;cursor:pointer;"><input type="checkbox" id="trapWMNovo" checked> ✨ Marcar como Novo</label>'
      +   '</div>'
      + '</div>'

      + '<div class="trap-wiz-nav">'
      +   '<button class="trap-btn-sec" onclick="window._trapWizIr(3)">‹ Voltar editar</button>'
      +   '<button class="trap-btn-primary" onclick="window._trapWizFinalizar()">✓ Adicionar à listagem</button>'
      + '</div>';
  }

  /* ── Helpers do wizard ─────────────────────────────────────────── */
  /* Sugestões de público-alvo (chips toggleáveis) */
  var _PUBLICOS_SUG = [
    'CEO','Diretores','Empresários','Gestores','Coordenadores',
    'Microempreendedores','Consultores','Closer','Equipe interna',
    'Marketing','Vendas','RH','Líderes','Sócios','Investidores'
  ];
  function _chipsPublicoHtml(valorAtual){
    var atuais = (valorAtual||'').split(/,\s*/).map(function(s){ return s.trim().toLowerCase(); }).filter(Boolean);
    var todosOn = _PUBLICOS_SUG.every(function(p){ return atuais.indexOf(p.toLowerCase()) >= 0; });
    return '<div class="trap-pub-chips">'
      + '<button type="button" class="trap-pub-chip todos'+(todosOn?' on':'')+'" onclick="window._trapPublicoTodos()" title="'+(todosOn?'Remover todas as sugestões':'Marcar todas as sugestões')+'">'+(todosOn?'✕ Limpar todos':'⚡ Selecionar todos')+'</button>'
      + _PUBLICOS_SUG.map(function(p){
          var on = atuais.indexOf(p.toLowerCase()) >= 0;
          return '<button type="button" class="trap-pub-chip'+(on?' on':'')+'" onclick="window._trapPublicoChip(\''+_esc(p)+'\',this)">'+_esc(p)+'</button>';
        }).join('')
      + '</div>';
  }

  /* Carrega pdf.js sob demanda (de CDN). Em file:// funciona pelo script tag.
     Worker URL é setado pra mesma CDN. Cache simples: só carrega 1x. */
  var _pdfJsCarregando = false;
  var _pdfJsFila = [];
  function _carregarPdfJs(cb){
    if(window.pdfjsLib){ cb(null); return; }
    _pdfJsFila.push(cb);
    if(_pdfJsCarregando) return;
    _pdfJsCarregando = true;
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = function(){
      if(window.pdfjsLib){
        try{ window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; }catch(e){}
        _pdfJsFila.forEach(function(f){ try{ f(null); }catch(e){} });
        _pdfJsFila = [];
      } else {
        _pdfJsFila.forEach(function(f){ try{ f(new Error('pdfjsLib não disponível')); }catch(e){} });
        _pdfJsFila = [];
      }
    };
    script.onerror = function(){
      _pdfJsCarregando = false;
      _pdfJsFila.forEach(function(f){ try{ f(new Error('Falha ao carregar pdf.js')); }catch(e){} });
      _pdfJsFila = [];
    };
    document.head.appendChild(script);
  }

  /* Lê um arquivo PDF e retorna o texto extraído (Promise<string>) */
  function _extrairTextoPdfFile(file){
    return new Promise(function(resolve, reject){
      var fr = new FileReader();
      fr.onload = function(e){
        try{
          window.pdfjsLib.getDocument({ data: e.target.result }).promise
            .then(function(pdf){
              var paginas = [];
              for(var i = 1; i <= pdf.numPages; i++) paginas.push(i);
              return Promise.all(paginas.map(function(n){
                return pdf.getPage(n).then(function(page){ return page.getTextContent(); });
              }));
            })
            .then(function(contents){
              var txt = contents.map(function(c){
                return c.items.map(function(it){ return it.str; }).join(' ');
              }).join('\n\n');
              resolve(txt.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
            })
            .catch(reject);
        }catch(err){ reject(err); }
      };
      fr.onerror = function(){ reject(new Error('Falha ao ler arquivo')); };
      fr.readAsArrayBuffer(file);
    });
  }

  function _fmtKb(n){
    if(!n) return '0 B';
    if(n < 1024) return n + ' B';
    if(n < 1024*1024) return Math.round(n/1024) + ' KB';
    return (n / (1024*1024)).toFixed(1) + ' MB';
  }
  function _extrairTitulo(html){
    if(!html) return '';
    var m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if(m) return m[1].trim();
    m = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    return m ? m[1].trim().replace(/<[^>]+>/g,'') : '';
  }
  function _gerarPromptClaude(){
    var b = _claudeBriefing;
    var temas = {
      'black-tie': 'Black Tie elegante: paleta preto (#0a0e1a) + dourado (#f0c896) + accent verde lima (#c8f05a). Fontes serif elegante (Playfair Display) para títulos + DM Sans para corpo.',
      'champagne': 'Champagne luxuoso: paleta off-white (#faf6ee) + dourado champagne + acentos discretos. Sensação de produto premium.',
      'lima': 'Verde Lima vibrante: paleta dark com accent verde-lima dominante. Energético, juvenil, contemporâneo.',
      'febracis': 'Padrão Febracis: cores institucionais, layout corporativo limpo, foco em legibilidade.'
    };
    var tipoDesc = b.tipo === 'treinamento'
      ? 'um TREINAMENTO com estrutura de módulos sequenciais (módulo 1, 2, 3...). Cada módulo deve ter: título, objetivo, conteúdo conceitual, exercício prático, checkpoint. Use seções <section> com âncoras para navegação.'
      : 'uma APRESENTAÇÃO com estrutura de SLIDES individuais (1 slide por seção). Use <section class="slide"> para cada slide. Inclua: capa, índice, slides de conteúdo, slide de CTA/contato.';
    var pdfsTxt = _claudePdfs.length ? '\n\nMATERIAIS DE REFERÊNCIA ANEXADOS:\n' + _claudePdfs.map(function(p){ return '- ' + p.name + ' (' + _fmtKb(p.size) + ')'; }).join('\n') + '\n\nLeia os PDFs anexados e use o conteúdo deles como base. Mantenha consistência com o que estiver nos PDFs.' : '';

    return ''
      + '# Briefing\n\n'
      + 'Gere ' + tipoDesc + '\n\n'
      + 'PÚBLICO-ALVO: ' + (b.publico || 'consultores comerciais') + '\n\n'
      + 'TEMA VISUAL: ' + (temas[b.tema] || temas['black-tie']) + '\n\n'
      + 'DESCRIÇÃO DO CONTEÚDO:\n' + (b.desc || '(preencha na etapa 1)') + '\n'
      + pdfsTxt + '\n\n'
      + '# Requisitos técnicos\n\n'
      + '- HTML5 standalone (sem dependências externas além de Google Fonts)\n'
      + '- CSS inline no <head> dentro de <style>\n'
      + '- Responsivo (mobile-first com media queries)\n'
      + '- Semântico (header, main, section, footer)\n'
      + '- Acessível (alt em imagens, contraste mínimo AA)\n'
      + '- Sem JavaScript externo (inline se necessário)\n'
      + '- Pronto pra abrir direto em file:// (sem fetch, sem CORS issues)\n\n'
      + '# Output\n\n'
      + 'Responda APENAS com o HTML completo (do <!DOCTYPE html> até </html>), sem markdown, sem comentários explicativos antes ou depois. Eu vou colar direto num editor.';
  }
  /* Pré-processa o HTML antes de injetar no srcdoc do preview:
     - Garante <base target="_blank"> no head — evita que clicks em
       links naveguem o iframe pra fora do srcdoc (causa de "some tudo")
     - Aceita HTML incompleto e envolve em estrutura mínima */
  function _prepHtmlPreview(html){
    if(!html) return '';
    /* Se já tem <base>, não duplica */
    if(/<base\b[^>]*>/i.test(html)) return html;
    if(/<head[^>]*>/i.test(html)){
      return html.replace(/<head([^>]*)>/i, '<head$1><base target="_blank">');
    }
    if(/<html[^>]*>/i.test(html)){
      return html.replace(/<html([^>]*)>/i, '<html$1><head><base target="_blank"></head>');
    }
    /* Fragmento solto — envolve com estrutura mínima */
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><base target="_blank"></head><body>' + html + '</body></html>';
  }

  function _atualizarPreview(){
    var ifr = document.getElementById('trapEdPreview');
    if(!ifr) return;
    try{
      var html = _claudeHtml
        ? _prepHtmlPreview(_claudeHtml)
        : '<html><body style="background:#fff;padding:30px;font-family:sans-serif;color:#666;text-align:center;">Cole o HTML para ver o preview</body></html>';
      ifr.srcdoc = html;
    }catch(e){}
  }

  function _bindCriarClaude(){
    if(_claudeStep === 1){
      _bindStep1();
    } else if(_claudeStep === 2){
      var ta = document.getElementById('trapWHtmlInput');
      if(ta){
        ta.addEventListener('input', function(){ _claudeHtml = ta.value; });
      }
    } else if(_claudeStep === 3){
      var ed = document.getElementById('trapEdHtml');
      if(ed){
        ed.addEventListener('input', function(){
          _claudeHtml = ed.value;
          _atualizarPreview();
        });
      }
      _atualizarPreview();
    } else if(_claudeStep === 4){
      _atualizarPreviewFinal();
    }
  }

  function _bindStep1(){
    var inp = document.getElementById('trapPdfInput');
    var drop = document.getElementById('trapDropzone');
    if(inp){
      inp.addEventListener('change', function(e){ _processarPdfs(e.target.files); });
    }
    if(drop){
      drop.addEventListener('dragover', function(e){ e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', function(){ drop.classList.remove('over'); });
      drop.addEventListener('drop', function(e){
        e.preventDefault();
        drop.classList.remove('over');
        _processarPdfs(e.dataTransfer.files);
      });
    }
    /* Captura inputs do briefing em tempo real */
    ['trapWBTipo','trapWBTema','trapWBPublico','trapWBDesc'].forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      var key = { trapWBTipo:'tipo', trapWBTema:'tema', trapWBPublico:'publico', trapWBDesc:'desc' }[id];
      el.addEventListener('input', function(){ _claudeBriefing[key] = el.value; });
      el.addEventListener('change', function(){ _claudeBriefing[key] = el.value; });
    });
  }

  function _processarPdfs(files){
    if(!files || !files.length) return;
    Array.from(files).forEach(function(f){
      if(f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')){
        _toast('Só PDFs são aceitos: ' + f.name, 'var(--amber)');
        return;
      }
      if(f.size > 20 * 1024 * 1024){
        _toast('Arquivo > 20MB ignorado: ' + f.name, 'var(--amber)');
        return;
      }
      /* Guarda referência ao File pra permitir extração de texto via pdf.js depois */
      _claudePdfs.push({ name: f.name, size: f.size, file: f });
    });
    _renderTela();
    _toast('📎 ' + _claudePdfs.length + ' PDF(s) anexado(s)');
  }

  /* Toggle de chip de público-alvo — adiciona/remove do input.
     Após mudar, re-sincroniza o estado do botão "Selecionar todos" */
  window._trapPublicoChip = function(label, btn){
    var input = document.getElementById('trapWBPublico');
    if(!input) return;
    var atual = input.value.trim();
    var arr = atual ? atual.split(/,\s*/).map(function(s){ return s.trim(); }).filter(Boolean) : [];
    var idx = -1;
    arr.forEach(function(s, i){ if(s.toLowerCase() === label.toLowerCase()) idx = i; });
    if(idx >= 0){
      arr.splice(idx, 1);
      if(btn && btn.classList) btn.classList.remove('on');
    } else {
      arr.push(label);
      if(btn && btn.classList) btn.classList.add('on');
    }
    input.value = arr.join(', ');
    _claudeBriefing.publico = input.value;
    _sincronizarBtnTodos();
  };

  /* Marca/desmarca TODAS as sugestões de público de uma vez.
     Preserva entradas manuais que o usuário digitou no campo. */
  window._trapPublicoTodos = function(){
    var input = document.getElementById('trapWBPublico');
    if(!input) return;
    var atuais = (input.value||'').split(/,\s*/).map(function(s){ return s.trim(); }).filter(Boolean);
    var atuaisLow = atuais.map(function(s){ return s.toLowerCase(); });
    var todosOn = _PUBLICOS_SUG.every(function(p){ return atuaisLow.indexOf(p.toLowerCase()) >= 0; });

    /* Manuais = qualquer entrada que NÃO está na lista de sugestões */
    var manuais = atuais.filter(function(s){
      return !_PUBLICOS_SUG.some(function(p){ return p.toLowerCase() === s.toLowerCase(); });
    });

    if(todosOn){
      /* Limpa só as sugestões, mantém as manuais */
      input.value = manuais.join(', ');
      _toast('✕ Sugestões de público removidas');
    } else {
      /* Adiciona todas as sugestões, mantendo as manuais primeiro */
      input.value = manuais.concat(_PUBLICOS_SUG).join(', ');
      _toast('⚡ Todas as ' + _PUBLICOS_SUG.length + ' sugestões marcadas');
    }
    _claudeBriefing.publico = input.value;

    /* Re-renderiza só o container de chips pra refletir o novo estado */
    var container = document.querySelector('.trap-pub-chips');
    if(container){
      var temp = document.createElement('div');
      temp.innerHTML = _chipsPublicoHtml(input.value);
      var novo = temp.firstChild;
      if(novo) container.parentNode.replaceChild(novo, container);
    }
  };

  /* Atualiza o texto/estado do botão "Selecionar todos" sem
     re-renderizar todos os chips individuais. */
  function _sincronizarBtnTodos(){
    var btn = document.querySelector('.trap-pub-chip.todos');
    if(!btn) return;
    var input = document.getElementById('trapWBPublico');
    if(!input) return;
    var atuaisLow = (input.value||'').split(/,\s*/).map(function(s){ return s.trim().toLowerCase(); }).filter(Boolean);
    var todosOn = _PUBLICOS_SUG.every(function(p){ return atuaisLow.indexOf(p.toLowerCase()) >= 0; });
    btn.classList.toggle('on', todosOn);
    btn.textContent = todosOn ? '✕ Limpar todos' : '⚡ Selecionar todos';
    btn.title = todosOn ? 'Remover todas as sugestões' : 'Marcar todas as sugestões';
  }

  /* Extrai texto de todos os PDFs anexados e injeta no campo de descrição.
     Carrega pdf.js sob demanda (lazy load). */
  window._trapExtrairPdf = function(btn){
    if(!_claudePdfs.length){ _toast('Anexe pelo menos um PDF antes', 'var(--amber)'); return; }
    var pdfsComFile = _claudePdfs.filter(function(p){ return p.file; });
    if(!pdfsComFile.length){
      _toast('PDFs não têm dados — reanexe os arquivos pra extrair', 'var(--amber)');
      return;
    }
    var txtOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Carregando pdf.js...';

    _carregarPdfJs(function(err){
      if(err){
        btn.disabled = false; btn.textContent = txtOriginal;
        _toast('❌ Falha ao carregar pdf.js (sem internet?). Cole o texto manualmente.', 'var(--red)');
        return;
      }
      btn.textContent = '⏳ Extraindo ' + pdfsComFile.length + ' PDF(s)...';
      Promise.all(pdfsComFile.map(function(p){
        return _extrairTextoPdfFile(p.file).then(
          function(t){ return { name: p.name, texto: t }; },
          function(e){ return { name: p.name, texto: '[Erro: '+(e.message||'falha')+']' }; }
        );
      })).then(function(resultados){
        var totalChars = 0;
        var combinado = resultados.map(function(r){
          var t = r.texto || '';
          totalChars += t.length;
          /* Limita por PDF pra não explodir o prompt (Claude tem limite) */
          if(t.length > 8000) t = t.slice(0, 8000) + '\n\n[... texto truncado em 8000 chars ...]';
          return '═══ ' + r.name + ' ═══\n\n' + t;
        }).join('\n\n');

        var desc = document.getElementById('trapWBDesc');
        if(desc){
          var atual = desc.value.trim();
          var prefixo = (atual ? atual + '\n\n──────────────\n\n' : '');
          desc.value = prefixo + '# Conteúdo extraído dos PDFs anexados\n\n' + combinado
            + '\n\n──────────────\n\n# Instruções complementares\n\n(opcional — adicione aqui ajustes/foco específico que o Claude deve respeitar)';
          _claudeBriefing.desc = desc.value;
          desc.focus();
          /* Scroll pro fim onde o usuário pode escrever instruções complementares */
          desc.scrollTop = desc.scrollHeight;
        }
        btn.disabled = false; btn.textContent = txtOriginal;
        _toast('✓ Extraído ' + Math.round(totalChars/1024) + 'KB de texto de ' + pdfsComFile.length + ' PDF(s)');
      }).catch(function(e){
        btn.disabled = false; btn.textContent = txtOriginal;
        console.error('[trap] extração PDF:', e);
        _toast('❌ Erro na extração: ' + (e.message || 'desconhecido'), 'var(--red)');
      });
    });
  };

  function _atualizarPreviewFinal(){
    var ifr = document.getElementById('trapWMPreview');
    if(!ifr) return;
    try{
      ifr.srcdoc = _claudeHtml
        ? _prepHtmlPreview(_claudeHtml)
        : '<html><body>Sem HTML pra previsualizar</body></html>';
    }catch(e){}
  }

  /* ── Handlers globais do wizard ────────────────────────────────── */
  window._trapWizCancelar = function(){
    if(!confirm('Cancelar criação? Os dados serão perdidos.')) return;
    _claudeStep = 1;
    _claudePdfs = [];
    _claudeBriefing = { desc:'', tipo:'treinamento', produto:'', tema:'black-tie', publico:'' };
    _claudeHtml = '';
    _telaAtual = 'adicionar';
    _renderTela();
  };
  window._trapWizIr = function(n){
    if(n < 1 || n > 4) return;
    /* Salva campos atuais antes de mudar */
    if(_claudeStep === 2){
      var ta = document.getElementById('trapWHtmlInput');
      if(ta) _claudeHtml = ta.value;
    } else if(_claudeStep === 3){
      var ed = document.getElementById('trapEdHtml');
      if(ed) _claudeHtml = ed.value;
    }
    _claudeStep = n;
    _renderTela();
  };
  window._trapWizProx = function(deStep){
    if(deStep === 1){
      if(!_claudeBriefing.desc || _claudeBriefing.desc.trim().length < 20){
        _toast('Descreva o conteúdo com mais detalhes (mín 20 chars) antes de continuar', 'var(--amber)');
        var d = document.getElementById('trapWBDesc'); if(d) d.focus();
        return;
      }
    } else if(deStep === 2){
      var ta = document.getElementById('trapWHtmlInput');
      if(ta) _claudeHtml = ta.value;
      if(!_claudeHtml || _claudeHtml.trim().length < 100){
        _toast('Cole o HTML completo gerado pelo Claude antes de continuar', 'var(--amber)');
        return;
      }
      if(!/<\/html>/i.test(_claudeHtml)){
        if(!confirm('O HTML parece incompleto (não tem </html>). Continuar mesmo assim?')) return;
      }
    } else if(deStep === 3){
      var ed = document.getElementById('trapEdHtml');
      if(ed) _claudeHtml = ed.value;
    }
    _claudeStep = deStep + 1;
    _renderTela();
  };
  window._trapPdfRemover = function(idx){
    _claudePdfs.splice(idx, 1);
    _renderTela();
    _toast('PDF removido');
  };

  window._trapCopiarPrompt = function(){
    var p = _gerarPromptClaude();
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(p).then(function(){
        _toast('📋 Prompt copiado pra área de transferência');
      }).catch(function(){
        _fallbackCopiar(p);
      });
    } else {
      _fallbackCopiar(p);
    }
  };
  window._trapCopiarEAbrirClaude = function(){
    window._trapCopiarPrompt();
    setTimeout(function(){
      window.open('https://claude.ai/new', '_blank', 'noopener,noreferrer');
    }, 200);
  };
  function _fallbackCopiar(txt){
    var ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.top = '-9999px';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); _toast('📋 Prompt copiado'); }
    catch(e){ _toast('❌ Não foi possível copiar — selecione manualmente'); }
    document.body.removeChild(ta);
  }

  window._trapDownloadHtml = function(){
    if(!_claudeHtml){ _toast('Nada pra baixar', 'var(--amber)'); return; }
    var blob = new Blob([_claudeHtml], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var slug = _slug(_extrairTitulo(_claudeHtml) || 'conteudo-gerado');
    a.download = slug + '.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    _toast('⬇ HTML baixado');
  };

  /* Sugestões — transformações simples no HTML */
  window._trapSug = function(tipo){
    if(!_claudeHtml){ _toast('Cole o HTML primeiro', 'var(--amber)'); return; }
    var html = _claudeHtml;
    var titulo = _extrairTitulo(html) || 'Conteúdo';
    if(tipo === 'capa'){
      var capa = '<section style="min-height:80vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:40px;background:linear-gradient(135deg,#0a0e1a,#1c2128);color:#f0c896;"><h1 style="font-family:\'Playfair Display\',serif;font-size:clamp(36px,6vw,72px);margin:0 0 20px;">'+titulo+'</h1><p style="font-size:18px;opacity:.8;max-width:600px;">'+_esc((_claudeBriefing.desc||'').slice(0,160))+'</p></section>';
      html = html.replace(/<body([^>]*)>/i, '<body$1>' + capa);
    } else if(tipo === 'indice'){
      var matches = html.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
      var lis = matches.map(function(m, i){
        var t = m.replace(/<[^>]+>/g, '');
        return '<li><a href="#sec-'+i+'" style="color:#f0c896;text-decoration:none;">'+t+'</a></li>';
      }).join('');
      if(lis){
        var idx = 0;
        html = html.replace(/<h2/gi, function(){ return '<h2 id="sec-'+(idx++)+'"'; });
        var indice = '<nav style="background:#1c2128;padding:24px;margin:20px;border-radius:12px;"><h3 style="color:#c8f05a;margin:0 0 12px;">📋 Índice</h3><ol style="line-height:1.8;">'+lis+'</ol></nav>';
        html = html.replace(/<body([^>]*)>/i, '<body$1>' + indice);
      }
    } else if(tipo === 'cta'){
      var cta = '<section style="padding:60px 30px;text-align:center;background:linear-gradient(135deg,#c8f05a,#f0c896);color:#0a0e1a;"><h2 style="font-size:32px;margin:0 0 16px;">Próximos passos</h2><p style="font-size:16px;max-width:500px;margin:0 auto 24px;">Pronto para aplicar? Entre em contato e implemente esses conceitos no seu time.</p><a href="#contato" style="display:inline-block;background:#0a0e1a;color:#c8f05a;padding:14px 32px;border-radius:8px;font-weight:700;text-decoration:none;">Falar com consultor →</a></section>';
      html = html.replace(/<\/body>/i, cta + '</body>');
    } else if(tipo === 'tema-blacktie'){
      html = html.replace(/<body([^>]*)>/i, '<body$1 style="background:#0a0e1a;color:#e6edf3;font-family:\'DM Sans\',sans-serif;">');
    } else if(tipo === 'tema-champagne'){
      html = html.replace(/<body([^>]*)>/i, '<body$1 style="background:#faf6ee;color:#3a2e1f;font-family:\'DM Sans\',sans-serif;">');
    } else if(tipo === 'tema-lima'){
      html = html.replace(/<body([^>]*)>/i, '<body$1 style="background:#0d1117;color:#c8f05a;font-family:\'DM Sans\',sans-serif;">');
    } else if(tipo === 'fontes'){
      var fontLink = '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Playfair+Display:wght@600&display=swap" rel="stylesheet">';
      if(!/Playfair/.test(html)){
        html = html.replace(/<\/head>/i, fontLink + '</head>');
      }
      html = html.replace(/<h1/gi, '<h1 style="font-family:\'Playfair Display\',serif"');
    } else if(tipo === 'responsivo'){
      if(!/viewport/i.test(html)){
        html = html.replace(/<head([^>]*)>/i, '<head$1><meta name="viewport" content="width=device-width,initial-scale=1">');
      }
    } else if(tipo === 'limpar'){
      html = html.replace(/<!--[\s\S]*?-->/g, '');
    }
    _claudeHtml = html;
    var ed = document.getElementById('trapEdHtml');
    if(ed) ed.value = html;
    _atualizarPreview();
    _toast('✨ Sugestão aplicada — confira o preview');
  };

  /* Finalizar wizard — grava conteúdo como item adicionado */
  window._trapWizFinalizar = function(){
    var titulo = (document.getElementById('trapWMTit')||{}).value.trim();
    var tipo = (document.getElementById('trapWMTipo')||{}).value;
    var produto = (document.getElementById('trapWMProd')||{}).value.trim();
    var desc = (document.getElementById('trapWMDesc')||{}).value.trim();
    var ordem = +((document.getElementById('trapWMOrdem')||{}).value) || 100;
    var icone = (document.getElementById('trapWMIcone')||{}).value || '🤖';
    var publicar = (document.getElementById('trapWMPub')||{}).checked;
    var novo = (document.getElementById('trapWMNovo')||{}).checked;

    if(!titulo){ _toast('Título é obrigatório', 'var(--amber)'); return; }
    if(!produto){ _toast('Produto é obrigatório', 'var(--amber)'); return; }
    if(!_claudeHtml){ _toast('HTML vazio', 'var(--red)'); return; }

    var id = _slug(titulo);
    if((window.TRAP_REGISTRO||[]).some(function(s){ return s.id === id; })){
      id = id + '-' + Date.now().toString(36).slice(-4);
    }

    var obj = {
      id: id, titulo: titulo, descricao: desc, produto: produto, tipo: tipo,
      status: publicar ? 'publicado' : 'oculto',
      novo: novo, ordem: ordem,
      url: '__inline:' + id, /* URL especial — conteúdo vem do campo conteudo */
      conteudo: _claudeHtml,  /* HTML completo armazenado */
      icone: icone,
      origem: 'claude',
      briefing: _claudeBriefing,
      criadoEm: new Date().toISOString()
    };
    _salvarAdicionado(id, obj);

    /* Reset wizard */
    _claudeStep = 1;
    _claudePdfs = [];
    _claudeBriefing = { desc:'', tipo:'treinamento', produto:'', tema:'black-tie', publico:'' };
    _claudeHtml = '';

    _toast('✓ "'+titulo+'" criado e adicionado à listagem');
    _telaAtual = 'painel';
    var host = document.getElementById('trapScreen');
    if(host) host.querySelectorAll('.trap-nav-pill').forEach(function(x){ x.classList.toggle('active', x.dataset.tela === 'painel'); });
    _renderTela();
  };

  /* ────────────────────────────────────────────────────────────────
     VIEW 3 · ADMIN (tabela completa + histórico básico)
     ──────────────────────────────────────────────────────────────── */
  function _viewAdmin(){
    var itens = _getItens();
    var rows = itens.map(function(i){
      var tipoLabel = i.tipo === 'treinamento' ? 'Treinamento' : 'Apresentação';
      var tipoCls = i.tipo === 'treinamento' ? 'tr' : 'ap';
      var stCls = i.status === 'publicado' ? 'ativo' : 'oculto';
      var stLabel = i.status === 'publicado' ? '● Publicado' : '⊘ Oculto';
      var orig = i.origem === 'claude' ? '🤖 Claude' : (i.origem === 'html-existente' ? '📁 HTML' : '—');
      var id = _esc(i.id);
      return ''
        + '<tr>'
        +   '<td><div style="font-weight:700;">'+_esc(i.titulo)+'</div><div style="font-size:10px;color:var(--muted,#9aa5b1);margin-top:2px;">'+_esc(i.descricao||'')+'</div></td>'
        +   '<td><span class="trap-badge '+tipoCls+'">'+tipoLabel+'</span></td>'
        +   '<td><span class="trap-badge prod">'+_esc(i.produto)+'</span></td>'
        +   '<td><span style="font-size:10px;color:var(--muted,#9aa5b1);">'+orig+'</span></td>'
        +   '<td><span class="trap-badge '+stCls+'">'+stLabel+'</span></td>'
        +   '<td><div class="trap-toggle '+(i.status==='publicado'?'on':'')+'" data-id="'+id+'" data-act="toggle-status" title="Alternar visibilidade"></div></td>'
        +   '<td style="font-size:10px;color:var(--muted,#9aa5b1);"><code style="background:var(--bg-3,#1c2128);padding:2px 5px;border-radius:3px;font-size:9px;">'+_esc(i.url)+'</code></td>'
        +   '<td><div style="display:flex;gap:4px;"><button class="trap-icbtn" data-id="'+id+'" data-act="abrir" title="Abrir">↗</button>'+
              (i.origem !== undefined ? '<button class="trap-icbtn danger" data-id="'+id+'" data-act="remover" title="Remover da lista">✕</button>' : '')+'</div></td>'
        + '</tr>';
    }).join('');

    return ''
      + '<div class="trap-hero">'
      +   '<div><h1>Admin · Gestão completa</h1><p>Visualize tudo (ativos + ocultos), edite visibilidade e veja origem de cada conteúdo.</p></div>'
      + '</div>'
      + '<div class="trap-adm-bar">'
      +   '<span style="font-size:11px;color:var(--muted,#9aa5b1);font-weight:700;">'+itens.length+' conteúdo(s) cadastrado(s)</span>'
      +   '<div style="flex:1;"></div>'
      +   '<button class="trap-btn-primary" onclick="window._trapIr(\'adicionar\')">+ Adicionar conteúdo</button>'
      + '</div>'
      + (itens.length === 0
          ? '<div class="trap-empty"><div class="trap-empty-ic">📭</div><div style="font-size:14px;font-weight:700;margin-bottom:6px;">Nenhum conteúdo cadastrado</div>Comece adicionando via <b style="color:var(--accent);">+ Adicionar conteúdo</b>.</div>'
          : '<table class="trap-adm-table"><thead><tr><th>Nome / Descrição</th><th>Tipo</th><th>Produto</th><th>Origem</th><th>Status</th><th>Visível</th><th>URL</th><th>Ações</th></tr></thead><tbody>'+rows+'</tbody></table>');
  }

  function _bindAdminEvents(){
    var host = document.getElementById('trapConteudo');
    if(!host) return;
    host.querySelectorAll('[data-act]').forEach(function(el){
      el.addEventListener('click', function(){
        var id = el.dataset.id;
        var act = el.dataset.act;
        if(act === 'toggle-status') window._trapToggleStatus(id);
        else if(act === 'abrir') window._trapAbrirConteudo(id);
        else if(act === 'remover') window._trapRemoverAdd(id);
      });
    });
  }

  /* ── Persistência ───────────────────────────────────────────────────
     Durável em DOIS níveis:
       1) localStorage → sobrevive a reload mesmo offline / via file://
       2) Firebase (_fbSave) → sincroniza entre máquinas quando online
     Obs.: o código antigo usava window._fbSet, que NUNCA foi definido
     (o real é _fbSave). Por isso nada persistia. Corrigido aqui. */
  var _LS_OVER = 'trap_overrides_v1';
  var _LS_ADD  = 'trap_adicionados_v1';
  function _lsGet(k){ try{ var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }catch(e){ return null; } }
  function _lsSet(k, obj){ try{ localStorage.setItem(k, JSON.stringify(obj || {})); }catch(e){} }
  function _fbSalvar(path, valor){
    if(typeof window._fbSave !== 'function') return;
    try{ var pr = window._fbSave(path, valor); if(pr && pr.catch) pr.catch(function(){}); }catch(e){}
  }
  function _salvarOverride(id, patch){
    _overrides[id] = Object.assign({}, _overrides[id] || {}, patch);
    _lsSet(_LS_OVER, _overrides);
    _fbSalvar('treinamentos/overrides/' + id, _overrides[id]);
  }
  function _salvarAdicionado(id, obj){
    _adicionados[id] = obj;
    _lsSet(_LS_ADD, _adicionados);
    _fbSalvar('treinamentos/adicionados/' + id, obj);
  }
  function _removerAdicionado(id){
    delete _adicionados[id];
    _lsSet(_LS_ADD, _adicionados);
    if(typeof window._fbRemove === 'function'){
      try{ var pr = window._fbRemove('treinamentos/adicionados/' + id); if(pr && pr.catch) pr.catch(function(){}); }catch(e){}
    } else {
      _fbSalvar('treinamentos/adicionados/' + id, null);
    }
  }

  /* ── Ações expostas ─────────────────────────────────────────────── */
  window._trapIr = function(tela){
    _telaAtual = tela;
    var host = document.getElementById('trapScreen');
    if(host){
      host.querySelectorAll('.trap-nav-pill').forEach(function(x){ x.classList.toggle('active', x.dataset.tela === tela); });
    }
    _renderTela();
  };

  /* Abrir em nova aba do navegador (opção secundária) */
  window._trapAbrirNovaAba = function(id){
    var item = _getItens().find(function(i){ return i.id === id; });
    if(!item) return;
    /* Para conteúdo inline (Claude), gera Blob URL e abre */
    if(item.url && item.url.indexOf('__inline:') === 0 && item.conteudo){
      return window._trapAbrirInlineNovaAba(id);
    }
    if(!item.url){ _toast('❌ Conteúdo sem URL', 'var(--red)'); return; }
    window.open(item.url, '_blank', 'noopener,noreferrer');
    _toast('↗ ' + item.titulo + ' aberto em nova aba');
  };

  /* Abrir conteúdo inline (Claude) em nova aba via Blob URL */
  window._trapAbrirInlineNovaAba = function(id){
    var item = _getItens().find(function(i){ return i.id === id; });
    if(!item || !item.conteudo){ _toast('❌ Sem conteúdo', 'var(--red)'); return; }
    var blob = new Blob([item.conteudo], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    /* Não revoga imediato — deixa a nova aba carregar */
    setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} }, 60000);
    _toast('↗ ' + item.titulo + ' aberto em nova aba');
  };

  /* Compat: chamadas antigas vão pra "abrir aqui" */
  window._trapAbrirConteudo = function(id){ window._trapAbrirAqui(id); };

  /* Abrir embutido (iframe dentro do app) — padrão */
  window._trapAbrirAqui = function(id){
    var item = _getItens().find(function(i){ return i.id === id; });
    if(!item) return;
    if(!item.url){ _toast('❌ Conteúdo sem URL', 'var(--red)'); return; }
    /* URL __editor:apr_xxx → apresentação criada no editor visual; reabre no editor */
    if(item.url.indexOf('__editor:') === 0 && typeof window.abrirEditorApresentacao === 'function'){
      var aprId = item.url.slice(9);
      window.abrirEditorApresentacao({ id: aprId });
      return;
    }
    _itemVisualizando = item;
    _indiceMod = 0;
    _telaAtual = 'visualizar';
    _findReset();
    _renderTela();
  };

  /* Trocar de módulo dentro do visualizador (índice nas partes VISÍVEIS) */
  window._trapVizSetMod = function(idx){
    if(!_itemVisualizando) return;
    var n = _vizPartesAtivas().length;
    if(!n) return;
    _indiceMod = Math.max(0, Math.min(n - 1, +idx || 0));
    _renderTela();
  };
  window._trapVizProx = function(){ window._trapVizSetMod(_indiceMod + 1); };
  window._trapVizAnt  = function(){ window._trapVizSetMod(_indiceMod - 1); };

  /* Fecha o visualizador embutido e volta ao painel */
  window._trapVizFechar = function(){
    _findReset();
    _itemVisualizando = null;
    _indiceMod = 0;
    _gerPaginas = false;
    _prevPaginas = false;
    _stagingOcultas = null;
    _telaAtual = 'painel';
    var host = document.getElementById('trapScreen');
    if(host) host.querySelectorAll('.trap-nav-pill').forEach(function(x){ x.classList.toggle('active', x.dataset.tela === 'painel'); });
    _renderTela();
  };

  /* Aciona o modo edição do DECK carregado no iframe (Fase 2: ocultar slides
     internos). Os decks (cis.js/apr.js/etc.) expõem o botão [data-nav="edit"]
     e salvam os slides ocultos no próprio localStorage. Same-origin (localhost/
     GitHub Pages) → clica direto; em file:// o acesso falha e mostramos a dica. */
  window._trapVizEditarSlides = function(){
    var iframe = document.querySelector('.trap-viz-iframe-wrap iframe');
    if(!iframe){ _toast('Abra um conteúdo primeiro', 'var(--amber)'); return; }
    var ok = false;
    try{
      var doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
      if(doc){
        var btn = doc.querySelector('[data-nav="edit"]');
        if(btn){ btn.click(); ok = true; }
        else {
          /* deck ainda carregando ou sem HUD de edição */
          if(iframe.contentWindow && iframe.contentWindow.dispatchEvent){
            iframe.contentWindow.dispatchEvent(new iframe.contentWindow.KeyboardEvent('keydown', { key:'e' }));
            ok = true;
          }
        }
      }
    }catch(e){ /* cross-origin (file://) — cai na dica abaixo */ }
    if(ok){
      _toast('🎬 Modo edição do deck — passe pelos slides e clique em "Ocultar slide"; use "Mostrar todos" para reverter');
    } else {
      _toast('Dentro do deck, clique em "Editar" (ou tecla E) para ocultar slides', 'var(--amber)');
    }
  };

  /* ── Ações de curadoria de páginas ──────────────────────────────── */
  /* Abre o painel "Gerenciar páginas" carregando o estado salvo no staging */
  window._trapVizGerenciar = function(){
    if(!_itemVisualizando) return;
    _stagingOcultas = _paginasOcultasDe(_itemVisualizando);
    _gerPaginas = true;
    _prevPaginas = false;
    _renderTela();
  };
  /* Liga/desliga uma página no staging (índice na estrutura completa) */
  window._trapTogglePagina = function(idx){
    if(!_itemVisualizando) return;
    var p = (_itemVisualizando.estrutura || [])[idx];
    if(!p || !p.url){ _toast('Esta página não tem URL própria — não dá pra ocultar', 'var(--amber)'); return; }
    if(!_stagingOcultas) _stagingOcultas = [];
    var pos = _stagingOcultas.indexOf(p.url);
    if(pos === -1) _stagingOcultas.push(p.url);
    else _stagingOcultas.splice(pos, 1);
    _renderTela();
  };
  /* Botão "Desocultar todas" — marca todas as páginas como visíveis (no staging) */
  window._trapDesocultarTodas = function(){
    _stagingOcultas = [];
    _toast('Todas as páginas marcadas como visíveis');
    _renderTela();
  };
  /* Pré-visualizar: entra no visualizador mostrando só as páginas visíveis do staging */
  window._trapVizPreviewPaginas = function(){
    if(!_itemVisualizando) return;
    var parts = _itemVisualizando.estrutura || [];
    var st = _stagingOcultas || [];
    var vis = parts.filter(function(p){ return !(p.url && st.indexOf(p.url) !== -1); });
    if(!vis.length){ _toast('Deixe ao menos 1 página visível', 'var(--amber)'); return; }
    _gerPaginas = false;
    _prevPaginas = true;
    _indiceMod = 0;
    _renderTela();
  };
  /* Da prévia, voltar a editar a lista de páginas */
  window._trapVizVoltarEditar = function(){
    _prevPaginas = false;
    _gerPaginas = true;
    _renderTela();
  };
  /* Salva a configuração de exibição (persiste via override) */
  window._trapVizSalvarPaginas = function(){
    var item = _itemVisualizando;
    if(!item) return;
    var parts = item.estrutura || [];
    /* mantém no array só URLs que ainda existem na estrutura */
    var st = (_stagingOcultas || []).filter(function(u){
      return parts.some(function(p){ return p.url === u; });
    });
    var vis = parts.filter(function(p){ return !(p.url && st.indexOf(p.url) !== -1); });
    if(!vis.length){ _toast('Deixe ao menos 1 página visível', 'var(--amber)'); return; }
    _salvarOverride(item.id, { paginasOcultas: st });
    /* recarrega o item mesclado (SEED + override) para refletir o salvo */
    _itemVisualizando = _getItens().find(function(i){ return i.id === item.id; }) || item;
    _stagingOcultas = null;
    _gerPaginas = false;
    _prevPaginas = false;
    _indiceMod = 0;
    _toast(st.length ? ('✓ Exibição salva · '+st.length+' página(s) oculta(s)') : '✓ Exibição salva · todas visíveis');
    _renderTela();
  };
  /* Cancela a curadoria e descarta o staging */
  window._trapVizCancelarPaginas = function(){
    _stagingOcultas = null;
    _gerPaginas = false;
    _prevPaginas = false;
    _renderTela();
  };

  /* Atalho ESC dentro do visualizador */
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape' || _telaAtual !== 'visualizar') return;
    if(_gerPaginas){ window._trapVizCancelarPaginas(); return; }
    if(_prevPaginas){ window._trapVizVoltarEditar(); return; }
    window._trapVizFechar();
  });

  window._trapToggleStatus = function(id){
    var item = _getItens().find(function(i){ return i.id === id; });
    if(!item) return;
    var novo = item.status === 'publicado' ? 'oculto' : 'publicado';
    _salvarOverride(id, { status: novo });
    _toast(novo === 'publicado' ? '✓ Conteúdo publicado' : '⊘ Conteúdo ocultado');
    _renderTela();
  };

  window._trapToggleNovo = function(id){
    var item = _getItens().find(function(i){ return i.id === id; });
    if(!item) return;
    _salvarOverride(id, { novo: !item.novo });
    _toast(item.novo ? 'Badge "Novo" removida' : '✨ Marcado como Novo');
    _renderTela();
  };

  window._trapRemoverAdd = function(id){
    if(!_adicionados[id]){ _toast('Itens do seed não podem ser removidos por aqui', 'var(--amber)'); return; }
    if(!confirm('Remover este conteúdo da listagem?\n\nO arquivo HTML original NÃO é apagado — só o vínculo.')) return;
    _removerAdicionado(id);
    _toast('✕ Conteúdo removido da listagem');
    _renderTela();
  };

  window._trapPreviewHtml = function(){
    var url = (document.getElementById('trapCamUrl')||{}).value;
    if(!url){ _toast('Informe o caminho do HTML primeiro', 'var(--amber)'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
    /* Auto-preenche metadados (sugestão) */
    var mUrl = document.getElementById('trapMUrl');
    if(mUrl && !mUrl.value) mUrl.value = url;
    var mTit = document.getElementById('trapMTitulo');
    if(mTit && !mTit.value){
      var nome = url.split('/').pop().replace(/\.html?$/i, '').replace(/-/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
      mTit.value = nome;
    }
  };

  window._trapGerarClaude = function(){
    /* Entra no wizard Caminho A. Pré-popula descrição se já tiver. */
    var desc = (document.getElementById('trapClaudeDesc')||{}).value;
    if(desc) _claudeBriefing.desc = desc;
    _claudeStep = 1;
    _telaAtual = 'criar-claude';
    _renderTela();
  };

  window._trapAdicionar = function(){
    var titulo = (document.getElementById('trapMTitulo')||{}).value.trim();
    var tipo = (document.getElementById('trapMTipo')||{}).value;
    var produto = (document.getElementById('trapMProduto')||{}).value.trim();
    var desc = (document.getElementById('trapMDesc')||{}).value.trim();
    var ordem = +((document.getElementById('trapMOrdem')||{}).value) || 100;
    var icone = (document.getElementById('trapMIcone')||{}).value || '📄';
    var url = (document.getElementById('trapMUrl')||{}).value.trim();
    var publicar = (document.getElementById('trapMPub')||{}).checked;
    var novo = (document.getElementById('trapMNovo')||{}).checked;

    if(!titulo){ _toast('Título é obrigatório', 'var(--amber)'); return; }
    if(!produto){ _toast('Produto é obrigatório', 'var(--amber)'); return; }
    if(!url){ _toast('URL/caminho do HTML é obrigatório', 'var(--amber)'); return; }

    var camUrl = (document.getElementById('trapCamUrl')||{}).value.trim();
    var origem = camUrl ? 'html-existente' : 'claude';
    var id = _slug(titulo);
    /* Evita colisão com seed */
    if((window.TRAP_REGISTRO||[]).some(function(s){ return s.id === id; })){
      id = id + '-' + Date.now().toString(36).slice(-4);
    }

    var obj = {
      id: id, titulo: titulo, descricao: desc, produto: produto, tipo: tipo,
      status: publicar ? 'publicado' : 'oculto',
      novo: novo, ordem: ordem, url: url, icone: icone, origem: origem,
      criadoEm: new Date().toISOString()
    };
    _salvarAdicionado(id, obj);
    _toast('✓ "'+titulo+'" adicionado à listagem');
    _telaAtual = 'painel';
    var host = document.getElementById('trapScreen');
    if(host) host.querySelectorAll('.trap-nav-pill').forEach(function(x){ x.classList.toggle('active', x.dataset.tela === 'painel'); });
    _renderTela();
  };

  /* ── Carregamento (localStorage + Firebase) ─────────────────────────
     Baseline vem do localStorage (durável, offline). O Firebase é
     MESCLADO por cima (chave a chave) — nunca substitui o baseline por
     um nó vazio, senão uma leitura offline apagaria as edições locais. */
  function _carregar(cb){
    _overrides   = _lsGet(_LS_OVER) || {};
    _adicionados = _lsGet(_LS_ADD)  || {};
    var pendentes = 2;
    function ok(){ pendentes--; if(pendentes <= 0 && cb) cb(); }
    if(typeof window._fbGet === 'function'){
      window._fbGet('treinamentos/overrides').then(function(d){ if(d) _overrides = Object.assign({}, _overrides, d); _lsSet(_LS_OVER, _overrides); ok(); }).catch(function(){ ok(); });
      window._fbGet('treinamentos/adicionados').then(function(d){ if(d) _adicionados = Object.assign({}, _adicionados, d); _lsSet(_LS_ADD, _adicionados); ok(); }).catch(function(){ ok(); });
      /* Listeners real-time */
      if(typeof window._fbChange === 'function'){
        if(!_listenerOver){
          _listenerOver = window._fbChange('treinamentos/overrides', function(d){
            if(d) _overrides = Object.assign({}, _overrides, d);
            _lsSet(_LS_OVER, _overrides);
            if(document.getElementById('trapScreen').style.display !== 'none') _renderTela();
          });
        }
        if(!_listenerAdd){
          _listenerAdd = window._fbChange('treinamentos/adicionados', function(d){
            if(d) _adicionados = Object.assign({}, _adicionados, d);
            _lsSet(_LS_ADD, _adicionados);
            if(document.getElementById('trapScreen').style.display !== 'none') _renderTela();
          });
        }
      }
    } else {
      if(cb) cb();
    }
  }

  /* ── Pontos de entrada GLOBAIS ──────────────────────────────────── */

  /* Registra trapScreen no array _TELAS pra que:
     - 18-usuarios.js (safety net 8s) reconheça que uma tela está visível
     - _mostrarTela() esconda trapScreen quando outra tela for ativada
     Idempotente: só adiciona uma vez. */
  function _registrarNoArrayTelas(){
    try{
      if(typeof window._TELAS !== 'undefined' && Array.isArray(window._TELAS)){
        if(window._TELAS.indexOf('trapScreen') < 0) window._TELAS.push('trapScreen');
      }
    }catch(e){}
  }

  window.abrirTreinamentosApresentacoes = function(){
    _injectCss();
    _registrarNoArrayTelas();
    var host = document.getElementById('trapScreen');
    if(!host) return;
    host.style.background = 'var(--bg, #0a0e1a)';

    /* Usa _mostrarTela do sistema (esconde todas + mostra trapScreen). */
    if(typeof window._mostrarTela === 'function'){
      window._mostrarTela('trapScreen', false);
    } else {
      /* Fallback: esconde manualmente */
      ['turmasScreen','telaTurmasScreen','mapeamentoScreen','novaPipelineScreen','dashboard','loginScreen','propostaComercialScreen','turmaInativaScreen'].forEach(function(t){
        var el = document.getElementById(t);
        if(el) el.style.display = 'none';
      });
      host.style.display = 'block';
    }

    if(!_montado){
      _buildShell();
      _montado = true;
    }
    _carregar(function(){ _renderTela(); });
    window.scrollTo(0, 0);
  };

  window.voltarHomeTrap = function(){
    /* Volta pra home (turmasScreen contém a .home-grid) usando o
       sistema do dashboard quando disponível. */
    if(typeof window._mostrarTela === 'function'){
      window._mostrarTela('turmasScreen', false);
    } else {
      var host = document.getElementById('trapScreen');
      if(host) host.style.display = 'none';
      var home = document.getElementById('turmasScreen');
      if(home) home.style.display = '';
    }
  };

  /* ════════════════════════════════════════════════════════════════
     BUSCA "ESTILO WORD" DENTRO DO TREINAMENTO
     ────────────────────────────────────────────────────────────────
     Vive só aqui no shell → cobre TODOS os treinamentos de uma vez.
     • Índice: fetch() de cada parte VISÍVEL, fatiada em slides (mesma
       leitura da impressão — só funciona online; file:// bloqueia).
     • Ir até: postMessage 'cis-goto' (suportado por todos os engines)
       + realce via contentDocument (same-origin online).
     ════════════════════════════════════════════════════════════════ */

  var _FIND_DIACR = new RegExp('[\\u0300-\\u036f]', 'g');
  function _findNorm(s){ return (s||'').toLowerCase().normalize('NFD').replace(_FIND_DIACR, ''); }
  function _findEscRe(s){ return (s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

  function _findReset(){
    if(_findDebounce){ clearTimeout(_findDebounce); _findDebounce = null; }
    _findOpen = false; _findTerm = ''; _findWord = false;
    _findHits = []; _findActive = -1;
    _findIndex = null; _findIndexFor = null; _findIndexing = false; _findIndexErro = false;
    _findPendingGoto = null;
  }

  /* ── Índice: fatia cada parte visível em slides pesquisáveis ── */
  function _findExtractSlides(doc, pi){
    var out = [];
    var deck = doc.querySelector('.deck') || doc;
    var slides = Array.prototype.slice.call(deck.querySelectorAll('.slide'));
    if(!slides.length){
      /* Capa/menu sem slides → indexa o corpo inteiro como uma entrada */
      var body = doc.body || doc.documentElement;
      var clone0 = body ? body.cloneNode(true) : null;
      if(clone0) clone0.querySelectorAll('script,style,noscript').forEach(function(x){ x.remove(); });
      var txt0 = clone0 ? (clone0.textContent||'').replace(/\s+/g,' ').trim() : '';
      if(txt0) out.push({ pi:pi, slideId:null, titulo:(doc.title||'Página'), eyebrow:'', texto:txt0, textoN:_findNorm(txt0) });
      return out;
    }
    slides.forEach(function(sl, i){
      var clone = sl.cloneNode(true);
      clone.querySelectorAll('script,style,noscript').forEach(function(x){ x.remove(); });
      var tt = clone.querySelector('.slide-title') || clone.querySelector('h1,h2');
      var eb = clone.querySelector('.eyebrow');
      var texto = (clone.textContent||'').replace(/\s+/g,' ').trim();
      out.push({
        pi:pi, slideId:(i+1),
        titulo:(tt ? tt.textContent.trim() : ('Slide '+(i+1))),
        eyebrow:(eb ? eb.textContent.trim() : ''),
        texto:texto, textoN:_findNorm(texto)
      });
    });
    return out;
  }

  function _findEnsureIndex(cb){
    var item = _itemVisualizando;
    if(!item){ if(cb) cb(); return; }
    if(_findIndex && _findIndexFor === item.id){ if(cb) cb(); return; }
    var partes = _vizPartesAtivas();
    _findIndex = null; _findIndexFor = item.id;
    _findIndexing = true; _findIndexErro = false;
    var acc = [];
    var seq = Promise.resolve();
    partes.forEach(function(p, pi){
      seq = seq.then(function(){
        if(!p.url || p.url.indexOf('__inline:') === 0) return;
        return fetch(p.url).then(function(r){ return r.ok ? r.text() : ''; }).then(function(txt){
          if(!txt) return;
          var doc = new DOMParser().parseFromString(txt, 'text/html');
          _findExtractSlides(doc, pi).forEach(function(e){ acc.push(e); });
        }).catch(function(){ _findIndexErro = true; });
      });
    });
    seq.then(function(){
      _findIndex = acc;
      _findIndexing = false;
      if(cb) cb();
    });
  }

  /* ── Busca no índice ── */
  function _findContar(textoN, tN){
    if(_findWord){
      var re = new RegExp('(^|[^a-z0-9])'+_findEscRe(tN)+'(?=[^a-z0-9]|$)','g');
      var n=0; while(re.exec(textoN)) n++; return n;
    }
    var c=0, i=0;
    while((i = textoN.indexOf(tN, i)) !== -1){ c++; i += tN.length; }
    return c;
  }
  function _findSnippet(texto, textoN, tN){
    var idx;
    if(_findWord){
      var m = new RegExp('(?:^|[^a-z0-9])('+_findEscRe(tN)+')(?=[^a-z0-9]|$)').exec(textoN);
      idx = m ? (m.index + m[0].length - tN.length) : textoN.indexOf(tN);
    } else { idx = textoN.indexOf(tN); }
    if(idx < 0) return _esc(texto.slice(0,80));
    var ini = Math.max(0, idx-32), fim = Math.min(texto.length, idx+tN.length+48);
    return (ini>0?'…':'') + _esc(texto.slice(ini, idx))
      + '<mark>' + _esc(texto.slice(idx, idx+tN.length)) + '</mark>'
      + _esc(texto.slice(idx+tN.length, fim)) + (fim<texto.length?'…':'');
  }
  function _findSearch(){
    var tN = _findNorm(_findTerm);
    _findHits = [];
    if(tN.length >= 1 && _findIndex){
      _findIndex.forEach(function(e, ei){
        var n = _findContar(e.textoN, tN);
        if(n > 0) _findHits.push({ ei:ei, pi:e.pi, slideId:e.slideId, n:n, snip:_findSnippet(e.texto, e.textoN, tN) });
      });
    }
    _findActive = _findHits.length ? 0 : -1;
  }

  /* ── HTML do painel ── */
  function _findCountLabel(){
    if(!_findTerm) return '';
    if(!_findHits.length) return '0/0';
    return (_findActive+1)+'/'+_findHits.length;
  }
  function _findResultsHtml(){
    var nPartes = _vizPartesAtivas().length;
    if(_findIndexing) return '<div class="trap-find-empty"><span class="big">⏳</span>Indexando as '+nPartes+' partes…</div>';
    if(!_findTerm) return '<div class="trap-find-empty"><span class="big">🔎</span>Digite uma palavra para localizar<br>em todas as '+nPartes+' partes do treinamento.</div>';
    if(_findIndexErro && (!_findIndex || !_findIndex.length))
      return '<div class="trap-find-empty"><span class="big">🔌</span>A busca precisa do painel <b>online</b> (GitHub&nbsp;Pages).<br>Em arquivo local (file://) o navegador bloqueia a leitura das partes.</div>';
    if(!_findHits.length) return '<div class="trap-find-empty"><span class="big">🚫</span>Nenhuma ocorrência de<br><b style="color:var(--text)">“'+_esc(_findTerm)+'”</b></div>';
    var totalOc = _findHits.reduce(function(a,h){ return a+h.n; }, 0);
    var partesArr = _vizPartesAtivas();
    var groups = '', lastP = -1;
    _findHits.forEach(function(h, k){
      if(h.pi !== lastP){
        if(lastP !== -1) groups += '</div>';
        var ptit = partesArr[h.pi] ? partesArr[h.pi].titulo : ('Parte '+(h.pi+1));
        groups += '<div class="trap-find-group"><div class="trap-find-group-h">'+_esc(ptit)+'</div>';
        lastP = h.pi;
      }
      var e = _findIndex[h.ei];
      var loc = h.slideId ? ('slide '+h.slideId) : 'página';
      groups += '<button class="trap-find-hit'+(k===_findActive?' active':'')+'" data-k="'+k+'" onclick="window._trapFindHit('+k+')">'
        + '<div class="trap-find-hit-loc"><span class="pg">'+loc+'</span> '+_esc(e.titulo)
        + (h.n>1?' <span style="opacity:.6">· '+h.n+'×</span>':'') + '</div>'
        + '<div class="trap-find-hit-snip">'+h.snip+'</div></button>';
    });
    groups += '</div>';
    return '<div class="trap-find-summary">'+totalOc+' ocorrência'+(totalOc>1?'s':'')+' em '+_findHits.length+' slide'+(_findHits.length>1?'s':'')+'</div>'
      + '<div class="trap-find-results">'+groups+'</div>';
  }
  function _findPanelHtml(){
    var dis = _findHits.length ? '' : 'disabled';
    return '<div class="trap-find">'
      + '<div class="trap-find-box">'
      +   '<span class="ic">🔍</span>'
      +   '<input id="trapFindInput" type="text" placeholder="Buscar no treinamento…" value="'+_esc(_findTerm)+'" autocomplete="off" spellcheck="false" oninput="window._trapFindInput(this.value)" onkeydown="window._trapFindKey(event)">'
      +   '<span class="trap-find-count">'+_findCountLabel()+'</span>'
      +   '<span class="trap-find-nav">'
      +     '<button id="trapFindPrev" '+dis+' title="Anterior (Shift+Enter)" onclick="window._trapFindPrev()">▲</button>'
      +     '<button id="trapFindNext" '+dis+' title="Próximo (Enter)" onclick="window._trapFindNext()">▼</button>'
      +   '</span>'
      +   '<button class="trap-find-clear" title="Fechar busca (Esc)" onclick="window._trapFindFechar()">✕</button>'
      + '</div>'
      + '<div class="trap-find-opts">'
      +   '<span class="trap-find-opt'+(_findWord?' on':'')+'" title="Localizar apenas palavras inteiras" onclick="window._trapFindWordToggle()">Palavra inteira</span>'
      + '</div>'
      + '<div id="trapFindResultsWrap" style="flex:1;display:flex;flex-direction:column;min-height:0;">'+_findResultsHtml()+'</div>'
      + '</div>';
  }

  function _findRefreshPanel(){
    var side = document.getElementById('trapVizSide');
    if(side) side.innerHTML = _findPanelHtml();
  }
  function _findFocusInput(){
    setTimeout(function(){
      var inp = document.getElementById('trapFindInput');
      if(inp){ inp.focus(); var v = inp.value.length; try{ inp.setSelectionRange(v, v); }catch(e){} }
    }, 0);
  }
  /* Atualização leve (sem recriar o input → não perde foco/cursor) */
  function _findMarkActive(){
    var side = document.getElementById('trapVizSide'); if(!side) return;
    Array.prototype.forEach.call(side.querySelectorAll('.trap-find-hit'), function(b){
      b.classList.toggle('active', (+b.getAttribute('data-k')) === _findActive);
    });
    var cnt = side.querySelector('.trap-find-count'); if(cnt) cnt.textContent = _findCountLabel();
    var act = side.querySelector('.trap-find-hit.active'); if(act) act.scrollIntoView({ block:'nearest' });
  }

  /* ── Realce dentro do iframe (same-origin, online) ── */
  function _findIframeDoc(){
    var iframe = document.querySelector('.trap-viz-iframe-wrap iframe');
    if(!iframe) return null;
    try{ return iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document) || null; }
    catch(e){ return null; }
  }
  function _findClearIframeHl(){
    var doc = _findIframeDoc(); if(!doc) return;
    var marks = Array.prototype.slice.call(doc.querySelectorAll('mark.trap-find-hl'));
    marks.forEach(function(m){
      if(!m.parentNode) return;
      var t = doc.createTextNode(m.textContent);
      var pn = m.parentNode;
      pn.replaceChild(t, m);
      if(pn.normalize) pn.normalize();
    });
  }
  function _findHighlightIframe(term){
    var doc = _findIframeDoc(); if(!doc) return;
    if(!doc.getElementById('trapFindHlCss')){
      var st = doc.createElement('style'); st.id = 'trapFindHlCss';
      st.textContent = 'mark.trap-find-hl{background:#ffe066!important;color:#111!important;border-radius:2px;padding:0 1px;} mark.trap-find-hl.cur{background:#ff9f45!important;box-shadow:0 0 0 3px rgba(255,159,69,.45);}';
      (doc.head || doc.documentElement).appendChild(st);
    }
    _findClearIframeHl();
    var tN = _findNorm(term); if(!tN) return;
    var scope = doc.querySelector('.slide.is-active') || doc.querySelector('.slide') || doc.body;
    if(!scope) return;
    var walker = doc.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], node;
    while((node = walker.nextNode())){
      if(!node.nodeValue || !node.nodeValue.trim()) continue;
      var tag = node.parentNode ? node.parentNode.nodeName : '';
      if(tag === 'SCRIPT' || tag === 'STYLE' || tag === 'MARK') continue;
      nodes.push(node);
    }
    var first = null;
    nodes.forEach(function(n){
      var text = n.nodeValue, hay = _findNorm(text), idx = hay.indexOf(tN);
      if(idx < 0) return;
      var frag = doc.createDocumentFragment(), last = 0;
      while(idx >= 0){
        if(idx > last) frag.appendChild(doc.createTextNode(text.slice(last, idx)));
        var mk = doc.createElement('mark'); mk.className = 'trap-find-hl'; mk.textContent = text.slice(idx, idx+tN.length);
        if(!first){ mk.className += ' cur'; first = mk; }
        frag.appendChild(mk);
        last = idx + tN.length; idx = hay.indexOf(tN, last);
      }
      if(last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
      if(n.parentNode) n.parentNode.replaceChild(frag, n);
    });
    if(first){ try{ first.scrollIntoView({ block:'center' }); }catch(e){} }
  }

  /* Manda o deck ir ao slide e realça o termo */
  function _findApplyToIframe(slideId, term){
    if(slideId){
      var iframe = document.querySelector('.trap-viz-iframe-wrap iframe');
      if(iframe && iframe.contentWindow){
        try{ iframe.contentWindow.postMessage({ type:'cis-goto', n: slideId }, '*'); }catch(e){}
      }
      setTimeout(function(){ _findHighlightIframe(term); }, 80);
    } else {
      _findHighlightIframe(term);
    }
  }

  /* Navega até a ocorrência k (troca de parte se preciso) */
  function _findGoto(k){
    if(k < 0 || k >= _findHits.length) return;
    _findActive = k;
    var h = _findHits[k];
    if(h.pi === _indiceMod){
      _findApplyToIframe(h.slideId, _findTerm);
      _findMarkActive();
    } else {
      _findPendingGoto = { slideId: h.slideId, term: _findTerm };
      window._trapVizSetMod(h.pi);   /* _renderTela reconstrói tudo; iframe.onload → _trapFindIframeLoaded */
    }
  }

  /* ── API pública da busca ── */
  window._trapFindToggle = function(){ if(_findOpen) window._trapFindFechar(); else window._trapFindAbrir(); };

  window._trapFindAbrir = function(){
    if(!_itemVisualizando || !_vizPartesAtivas().length) return;
    _findOpen = true;
    _findRefreshPanel();
    var b = document.querySelector('.trap-viz-bar .trap-viz-btn[onclick*="_trapFindToggle"]'); if(b) b.classList.add('on');
    _findFocusInput();
    _findEnsureIndex(function(){
      if(!_findOpen) return;
      if(_findTerm) _findSearch();
      _findRefreshPanel();
      _findFocusInput();
      if(_findTerm && _findHits.length) _findGoto(0);
    });
  };

  window._trapFindFechar = function(){
    _findOpen = false;
    if(_findDebounce){ clearTimeout(_findDebounce); _findDebounce = null; }
    _findClearIframeHl();
    var partes = _vizPartesAtivas();
    var totalEstrut = (_itemVisualizando && Array.isArray(_itemVisualizando.estrutura)) ? _itemVisualizando.estrutura.length : partes.length;
    var side = document.getElementById('trapVizSide');
    if(side) side.innerHTML = _vizSideInner(partes, totalEstrut - partes.length);
    var b = document.querySelector('.trap-viz-bar .trap-viz-btn[onclick*="_trapFindToggle"]'); if(b) b.classList.remove('on');
  };

  window._trapFindInput = function(val){
    _findTerm = val;
    _findSearch();
    var side = document.getElementById('trapVizSide'); if(!side) return;
    var wrap = side.querySelector('#trapFindResultsWrap'); if(wrap) wrap.innerHTML = _findResultsHtml();
    var cnt = side.querySelector('.trap-find-count'); if(cnt) cnt.textContent = _findCountLabel();
    var pv = side.querySelector('#trapFindPrev'), nx = side.querySelector('#trapFindNext');
    if(pv) pv.disabled = !_findHits.length; if(nx) nx.disabled = !_findHits.length;
    if(_findDebounce){ clearTimeout(_findDebounce); _findDebounce = null; }
    if(_findHits.length){
      if(_findHits[0].pi === _indiceMod){ _findGoto(0); }                 /* mesma parte → instantâneo */
      else { _findDebounce = setTimeout(function(){ _findGoto(0); }, 350); } /* outra parte → espera parar de digitar */
    } else {
      _findClearIframeHl();
    }
  };

  window._trapFindKey = function(e){
    if(e.key === 'Enter'){ e.preventDefault(); if(e.shiftKey) window._trapFindPrev(); else window._trapFindNext(); }
    else if(e.key === 'Escape'){ e.preventDefault(); window._trapFindFechar(); }
  };

  window._trapFindNext = function(){ if(_findHits.length) _findGoto((_findActive+1) % _findHits.length); };
  window._trapFindPrev = function(){ if(_findHits.length) _findGoto((_findActive-1+_findHits.length) % _findHits.length); };
  window._trapFindHit  = function(k){ _findGoto(k); };

  window._trapFindWordToggle = function(){
    _findWord = !_findWord;
    _findSearch();
    _findRefreshPanel();
    _findFocusInput();
    if(_findHits.length) _findGoto(0);
  };

  /* Chamado pelo onload do iframe (ver _viewVisualizar): aplica o goto
     pendente depois que o deck recarregou e registrou seu listener. */
  window._trapFindIframeLoaded = function(){
    if(!_findPendingGoto) return;
    var pg = _findPendingGoto; _findPendingGoto = null;
    setTimeout(function(){ _findApplyToIframe(pg.slideId, pg.term); _findMarkActive(); }, 60);
  };

  /* ════════════════════════════════════════════════════════════════
     BUSCA NO HTML BAIXADO (_trapBaixarHtml)
     ────────────────────────────────────────────────────────────────
     O arquivo baixado é auto-contido: shell (menu) + módulos como blob.
     Aqui embutimos um ÍNDICE em JSON (sem fetch) + um painel de busca +
     um runtime. O runtime é escrito como função JS normal e serializado
     com .toString() (evita escape manual). Ele navega via a própria
     window.openAtSlide do shell e realça dentro do #module-frame.
     ════════════════════════════════════════════════════════════════ */

  /* Índice: mapeia arquivo→rota (das ROUTES do shell) e fatia cada módulo. */
  function _findBuildDownloadIndex(shellTxt, moduleTxt, fileTitulo){
    var fileToKey = {};
    var rx = /(['"]?)([A-Za-z0-9_\-]+)\1\s*:\s*\{\s*file\s*:\s*'([^']+\.html)'/g, m;
    while((m = rx.exec(shellTxt))){ fileToKey[m[3]] = m[2]; }
    var idx = [];
    Object.keys(moduleTxt).forEach(function(fn){
      var key = fileToKey[fn] || fn.replace(/\.html$/, '');
      var label = fileTitulo[fn] || fn;
      var doc = new DOMParser().parseFromString(moduleTxt[fn], 'text/html');
      var deck = doc.querySelector('.deck') || doc;
      var slides = Array.prototype.slice.call(deck.querySelectorAll('.slide'));
      slides.forEach(function(sl, i){
        var c = sl.cloneNode(true);
        c.querySelectorAll('script,style,noscript').forEach(function(x){ x.remove(); });
        var tt = c.querySelector('.slide-title') || c.querySelector('h1,h2');
        var texto = (c.textContent||'').replace(/\s+/g,' ').trim();
        idx.push({ key:key, file:fn, mod:label, slideId:(i+1), titulo:(tt?tt.textContent.trim():('Slide '+(i+1))), texto:texto });
      });
    });
    return idx;
  }

  /* Runtime que roda DENTRO do arquivo baixado. Auto-contido: só usa
     window.__FINDIDX, window.openAtSlide/openRoute/__MODURL e o DOM. */
  function _findDownloadRuntime(){
    var IDX = window.__FINDIDX || [];
    var DIA = new RegExp('[\\u0300-\\u036f]', 'g');
    function norm(s){ return (s||'').toLowerCase().normalize('NFD').replace(DIA, ''); }
    IDX.forEach(function(e){ e.textoN = norm(e.texto); });
    function esc(s){ return (s||'').replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }
    var term='', hits=[], active=-1, deb=null;
    var panel=document.getElementById('tfindPanel'), btn=document.getElementById('tfindBtn'),
        inp=document.getElementById('tfindInput'), res=document.getElementById('tfindResults'),
        cnt=document.getElementById('tfindCount'), pv=document.getElementById('tfindPrev'), nx=document.getElementById('tfindNext');
    if(!panel || !btn || !inp) return;
    function frameEl(){ return document.getElementById('module-frame'); }
    function contar(h,t){ var c=0,i=0; while((i=h.indexOf(t,i))!==-1){ c++; i+=t.length; } return c; }
    function snip(x,h,t){ var i=h.indexOf(t); if(i<0) return esc(x.slice(0,80)); var a=Math.max(0,i-32), b=Math.min(x.length,i+t.length+48); return (a>0?'…':'')+esc(x.slice(a,i))+'<mark>'+esc(x.slice(i,i+t.length))+'</mark>'+esc(x.slice(i+t.length,b))+(b<x.length?'…':''); }
    function search(){ var t=norm(term); hits=[]; if(t){ IDX.forEach(function(e,ei){ var n=contar(e.textoN,t); if(n>0) hits.push({ei:ei,n:n,snip:snip(e.texto,e.textoN,t)}); }); } active=hits.length?0:-1; }
    function clearHl(doc){ if(!doc) return; var mk=[].slice.call(doc.querySelectorAll('mark.tfind-hl')); mk.forEach(function(k){ var t=doc.createTextNode(k.textContent); var p=k.parentNode; if(p){ p.replaceChild(t,k); if(p.normalize) p.normalize(); } }); }
    function hl(){
      var f=frameEl(); if(!f) return; var doc; try{ doc=f.contentDocument; }catch(e){ return; } if(!doc) return;
      if(!doc.getElementById('tfindHlCss')){ var st=doc.createElement('style'); st.id='tfindHlCss'; st.textContent='mark.tfind-hl{background:#ffe066!important;color:#111!important;border-radius:2px;padding:0 1px;}mark.tfind-hl.cur{background:#ff9f45!important;box-shadow:0 0 0 3px rgba(255,159,69,.45);}'; (doc.head||doc.documentElement).appendChild(st); }
      clearHl(doc);
      var t=norm(term); if(!t) return;
      var sc=doc.querySelector('.slide.is-active')||doc.querySelector('.slide')||doc.body; if(!sc) return;
      var w=doc.createTreeWalker(sc, NodeFilter.SHOW_TEXT, null, false), ns=[], nd;
      while((nd=w.nextNode())){ if(!nd.nodeValue||!nd.nodeValue.trim()) continue; var tg=nd.parentNode?nd.parentNode.nodeName:''; if(tg==='SCRIPT'||tg==='STYLE'||tg==='MARK') continue; ns.push(nd); }
      var first=null;
      ns.forEach(function(n){
        var x=n.nodeValue, h=norm(x), i=h.indexOf(t); if(i<0) return;
        var fr=doc.createDocumentFragment(), last=0;
        while(i>=0){ if(i>last) fr.appendChild(doc.createTextNode(x.slice(last,i))); var mko=doc.createElement('mark'); mko.className='tfind-hl'; mko.textContent=x.slice(i,i+t.length); if(!first){ mko.className+=' cur'; first=mko; } fr.appendChild(mko); last=i+t.length; i=h.indexOf(t,last); }
        if(last<x.length) fr.appendChild(doc.createTextNode(x.slice(last)));
        if(n.parentNode) n.parentNode.replaceChild(fr,n);
      });
      if(first){ try{ first.scrollIntoView({block:'center'}); }catch(e){} }
    }
    function mark(){ [].forEach.call(res.querySelectorAll('.tfind-hit'), function(b){ b.classList.toggle('active', (+b.getAttribute('data-k'))===active); }); cnt.textContent=hits.length?(active+1)+'/'+hits.length:(term?'0/0':''); var a=res.querySelector('.tfind-hit.active'); if(a) a.scrollIntoView({block:'nearest'}); }
    function goTo(k){
      if(k<0||k>=hits.length) return; active=k; var e=IDX[hits[k].ei]; var f=frameEl(); var key=String(e.key);
      var same=f&&f.dataset&&f.dataset.currentKey===key;
      function afterLoad(){ try{ f.contentWindow.postMessage({type:'cis-goto',n:e.slideId},'*'); }catch(x){} setTimeout(hl,90); }
      if(same){ try{ f.contentWindow.postMessage({type:'cis-goto',n:e.slideId},'*'); }catch(x){} setTimeout(hl,90); }
      else {
        if(f){ var ol=function(){ f.removeEventListener('load',ol); afterLoad(); }; f.addEventListener('load',ol); }
        if(typeof window.openAtSlide==='function') window.openAtSlide(key,e.slideId);
        else if(typeof window.openRoute==='function') window.openRoute(key);
        else if(f&&window.__MODURL&&window.__MODURL[e.file]) f.src=window.__MODURL[e.file];
      }
      mark();
    }
    function render(){
      pv.disabled=nx.disabled=!hits.length; cnt.textContent=hits.length?(active+1)+'/'+hits.length:(term?'0/0':'');
      if(!term){ res.innerHTML='<div class="tfind-empty"><span class="big">🔎</span>Digite uma palavra para localizar<br>em todo o treinamento.</div>'; return; }
      if(!hits.length){ res.innerHTML='<div class="tfind-empty"><span class="big">🚫</span>Nenhuma ocorrência de<br><b>“'+esc(term)+'”</b></div>'; return; }
      var oc=0; hits.forEach(function(h){ oc+=h.n; });
      var g='', lastK=null;
      hits.forEach(function(h,k){ var e=IDX[h.ei]; if(e.mod!==lastK){ if(lastK!==null) g+='</div>'; g+='<div class="tfind-group"><div class="tfind-group-h">'+esc(e.mod||'')+'</div>'; lastK=e.mod; } g+='<button class="tfind-hit'+(k===active?' active':'')+'" data-k="'+k+'"><div class="tfind-loc"><span class="pg">slide '+e.slideId+'</span> '+esc(e.titulo)+(h.n>1?' · '+h.n+'×':'')+'</div><div class="tfind-snip">'+h.snip+'</div></button>'; });
      g+='</div>';
      res.innerHTML='<div class="tfind-summary">'+oc+' ocorrência'+(oc>1?'s':'')+' em '+hits.length+' slide'+(hits.length>1?'s':'')+'</div>'+g;
      [].forEach.call(res.querySelectorAll('.tfind-hit'), function(b){ b.addEventListener('click', function(){ goTo(+b.getAttribute('data-k')); }); });
    }
    function onInput(){
      term=inp.value; search(); render();
      if(deb){ clearTimeout(deb); deb=null; }
      if(hits.length){ var e=IDX[hits[0].ei]; var f=frameEl(); var same=f&&f.dataset&&f.dataset.currentKey===String(e.key); if(same) goTo(0); else deb=setTimeout(function(){ goTo(0); }, 350); }
      else { var f2=frameEl(); if(f2){ try{ clearHl(f2.contentDocument); }catch(x){} } }
    }
    function openP(){ panel.classList.add('open'); setTimeout(function(){ inp.focus(); }, 0); }
    function closeP(){ panel.classList.remove('open'); var f=frameEl(); if(f){ try{ clearHl(f.contentDocument); }catch(x){} } }
    btn.addEventListener('click', function(){ panel.classList.contains('open')?closeP():openP(); });
    var xb=document.getElementById('tfindClose'); if(xb) xb.addEventListener('click', closeP);
    inp.addEventListener('input', onInput);
    inp.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); if(!hits.length) return; e.shiftKey?goTo((active-1+hits.length)%hits.length):goTo((active+1)%hits.length); } else if(e.key==='Escape'){ e.preventDefault(); closeP(); } });
    pv.addEventListener('click', function(){ if(hits.length) goTo((active-1+hits.length)%hits.length); });
    nx.addEventListener('click', function(){ if(hits.length) goTo((active+1)%hits.length); });
    document.addEventListener('keydown', function(e){ if((e.ctrlKey||e.metaKey)&&(e.key==='f'||e.key==='F')){ e.preventDefault(); openP(); } });
    render();
  }

  /* Monta o bloco (CSS + UI + índice + runtime) a injetar no shell baixado. */
  function _findDownloadInjection(idx){
    var json = JSON.stringify(idx).replace(/</g, '\\u003c');
    var css = '<style id="tfindCss">'
      + '#tfindBtn{position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;align-items:center;gap:6px;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:10px;padding:9px 13px;font:600 12px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.4);}'
      + '#tfindBtn:hover{border-color:#c8f05a;color:#c8f05a;}'
      + '#tfindPanel{position:fixed;top:0;right:0;bottom:0;width:340px;max-width:88vw;z-index:2147483001;background:#0f1319;border-left:1px solid #30363d;box-shadow:-8px 0 30px rgba(0,0,0,.45);display:none;flex-direction:column;font-family:system-ui,sans-serif;color:#e6edf3;}'
      + '#tfindPanel.open{display:flex;}'
      + '.tfind-top{display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid #21262d;}'
      + '.tfind-box{flex:1;display:flex;align-items:center;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:2px 4px 2px 10px;}'
      + '.tfind-box:focus-within{border-color:#c8f05a;}'
      + '.tfind-box input{flex:1;background:transparent;border:0;outline:0;color:#e6edf3;font-size:13px;padding:8px 4px;min-width:0;font-family:inherit;}'
      + '.tfind-count{font-size:10px;color:#9aa5b1;padding:0 6px;white-space:nowrap;}'
      + '.tfind-nav{display:flex;}'
      + '.tfind-nav button{background:transparent;border:0;color:#9aa5b1;cursor:pointer;width:26px;height:28px;border-radius:5px;font-size:12px;}'
      + '.tfind-nav button:hover:not(:disabled){color:#c8f05a;background:rgba(200,240,90,.08);}'
      + '.tfind-nav button:disabled{opacity:.3;cursor:default;}'
      + '.tfind-x{background:transparent;border:0;color:#9aa5b1;cursor:pointer;width:26px;height:28px;border-radius:5px;font-size:13px;}'
      + '.tfind-x:hover{color:#e6edf3;}'
      + '.tfind-results{flex:1;overflow-y:auto;padding:6px;}'
      + '.tfind-summary{font-size:10px;color:#9aa5b1;text-transform:uppercase;letter-spacing:.06em;font-weight:800;margin:8px 6px;}'
      + '.tfind-group-h{font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#c8f05a;opacity:.85;padding:6px 8px 3px;}'
      + '.tfind-hit{display:block;width:100%;text-align:left;background:transparent;border:1px solid transparent;border-radius:7px;padding:8px 10px;cursor:pointer;margin-bottom:2px;color:#e6edf3;font:inherit;}'
      + '.tfind-hit:hover{background:#161b22;}'
      + '.tfind-hit.active{background:rgba(200,240,90,.10);border-color:rgba(200,240,90,.30);}'
      + '.tfind-loc{font-size:9.5px;font-weight:700;color:#9aa5b1;margin-bottom:3px;}'
      + '.tfind-loc .pg{font-family:ui-monospace,monospace;background:#21262d;border-radius:4px;padding:1px 5px;color:#e6edf3;}'
      + '.tfind-snip{font-size:11.5px;line-height:1.5;color:#e6edf3;opacity:.92;}'
      + '.tfind-snip mark{background:#ffe066;color:#111;border-radius:2px;padding:0 1px;font-weight:700;}'
      + '.tfind-empty{padding:26px 12px;text-align:center;color:#9aa5b1;font-size:12px;line-height:1.6;}'
      + '.tfind-empty .big{font-size:24px;display:block;margin-bottom:8px;opacity:.55;}'
      + '@media print{#tfindBtn,#tfindPanel{display:none!important;}}'
      + '</style>';
    var ui = '<button id="tfindBtn" title="Buscar no treinamento (Ctrl+F)">🔍 Buscar</button>'
      + '<div id="tfindPanel"><div class="tfind-top">'
      +   '<div class="tfind-box"><input id="tfindInput" type="text" placeholder="Buscar no treinamento…" autocomplete="off" spellcheck="false">'
      +     '<span class="tfind-count" id="tfindCount"></span>'
      +     '<span class="tfind-nav"><button id="tfindPrev" disabled title="Anterior (Shift+Enter)">▲</button><button id="tfindNext" disabled title="Próximo (Enter)">▼</button></span>'
      +   '</div>'
      +   '<button class="tfind-x" id="tfindClose" title="Fechar (Esc)">✕</button>'
      + '</div><div class="tfind-results" id="tfindResults"></div></div>';
    return css + ui
      + '<scr'+'ipt>window.__FINDIDX=' + json + ';</scr'+'ipt>'
      + '<scr'+'ipt>(' + _findDownloadRuntime.toString() + ')();</scr'+'ipt>';
  }

})();
