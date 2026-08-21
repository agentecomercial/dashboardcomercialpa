/* ═══════════════════════════════════════════════════════════════════
   MODO TREINADOR — duas janelas sincronizadas
   ───────────────────────────────────────────────────────────────────
   Papéis, decididos pela query string:

     (sem ?role)     → DECK avulso. Alguém estudando sozinho. Tem o
                       botão 🎤 que inicia o modo treinador.
     ?role=palco     → PALCO: o deck limpo que vai para o projetor.
                       Sem botão de treinador, sem selo, sem roteiro.
     ?role=console   → CONSOLE: slide atual, próximo, roteiro,
                       cronômetros e controles.

   ── POR QUE DOIS CAMINHOS PARA COMEÇAR ──────────────────────────
   O Chrome NÃO deixa uma página posicionar janela em outro monitor
   sem a permissão "window-management": ele clampa left/top de volta
   para o monitor atual. E requestFullscreen() exige gesto do usuário
   NA PRÓPRIA janela — a ativação do opener não se propaga para uma
   janela recém-aberta. Isso mata a ideia ingênua de "abrir o popup já
   em tela cheia no projetor".

   Caminho COMPANION (1 clique, quando há permissão e 2+ telas):
     Esta janela chama requestFullscreen({screen: projetor}) em si
     mesma — ela se muda para o projetor e vira o PALCO — e, no mesmo
     gesto, abre o CONSOLE na tela do notebook. O Chrome permite esse
     popup mesmo com a ativação já consumida pelo fullscreen (é a
     exceção "fullscreen companion window"). Fisicamente dá exatamente
     o que se quer: apresentação no projetor, console com o treinador.

   Caminho CLÁSSICO (sem permissão ou monitor único):
     Abre o palco como popup e esta janela vira console. O palco tenta
     tela cheia sozinho e, se o navegador recusar, mostra um convite
     de um clique.

   ── ATENÇÃO A file:// ───────────────────────────────────────────
   Em file:// a permissão "window-management" não persiste de forma
   confiável no Chrome, então o caminho companion tende a nunca ficar
   disponível. Servindo por http://localhost a permissão é concedida
   uma vez e grava para a origem — aí o 1 clique funciona sempre.

   ── SINCRONIZAÇÃO ───────────────────────────────────────────────
   Simétrica: quem tem window.opener cumprimenta ("olá") até ser
   reconhecido; quem recebe guarda ev.source e responde ("ack"). Assim
   funciona nos dois caminhos, independentemente de quem abriu quem.
     PALCO → CONSOLE : {t:'ml5e:estado', ...} a cada mudança do DOM
     CONSOLE → PALCO : {t:'ml5e:cmd', cmd:'avancar'|'anterior'|...}

   O console não conhece as funções internas do ml5.js (estão no escopo
   do IIFE dele): comanda o palco clicando nos botões do HUD.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PAPEL = (location.search.match(/[?&]role=([a-z]+)/) || [])[1] || 'deck';
  var BASE = location.href.split('#')[0].split('?')[0];

  /* ══════════════ Aperto de mão simétrico ══════════════ */
  function ligar(meuPapel, aoConhecer) {
    var par = null, fechado = false;

    function cumprimentar() {
      if (fechado) return;
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ t: 'ml5e:ola', papel: meuPapel }, '*');
        }
      } catch (e) {}
    }

    var relogio = setInterval(function () {
      if (fechado) { clearInterval(relogio); return; }
      cumprimentar();
    }, 600);
    cumprimentar();

    function fixar(p) {
      if (!p) return;
      par = p; fechado = true;
      if (aoConhecer) aoConhecer(par);
    }

    window.addEventListener('message', function (ev) {
      var m = ev.data || {};
      if (m.papel === meuPapel) return;                 /* eco de si mesmo */
      if (m.t === 'ml5e:ola') {
        fixar(ev.source);
        try { ev.source.postMessage({ t: 'ml5e:ack', papel: meuPapel }, '*'); } catch (e) {}
      } else if (m.t === 'ml5e:ack') {
        fixar(ev.source || window.opener);
      }
    });

    return {
      par: function () { return par; },
      vivo: function () { try { return !!(par && !par.closed); } catch (e) { return false; } },
      fixar: fixar
    };
  }

  /* ══════════════ Telas (Window Management API) ══════════════ */
  var telas = null;

  function lerTelas() {
    /* Só pré-carrega quando a permissão JÁ está concedida: aí resolve
       sem prompt e sem exigir gesto. Com estado 'prompt' não chamamos
       aqui — chamar sem ativação rejeita com NotAllowedError. */
    if (!window.getScreenDetails || !navigator.permissions) return Promise.resolve();
    return navigator.permissions.query({ name: 'window-management' })
      .then(function (st) {
        if (st.state !== 'granted') return;
        return window.getScreenDetails().then(function (d) { telas = d; });
      })['catch'](function () { /* nome antigo/ausente: segue sem */ });
  }

  function projetor() {
    if (!telas || !telas.screens) return null;
    var fora = telas.screens.filter(function (s) { return !s.isPrimary; });
    return fora[0] || null;
  }
  function telaDeCasa() {
    if (!telas || !telas.screens) return null;
    var casa = telas.screens.filter(function (s) { return s.isPrimary; });
    return casa[0] || telas.currentScreen || null;
  }

  function abrirPalco(comFullscreen) {
    var t = projetor();
    var f = 'popup,menubar=no,toolbar=no,location=no,status=no';
    if (comFullscreen) f += ',fullscreen';   /* ignorado onde não houver suporte */
    if (t) {
      f += ',left=' + t.availLeft + ',top=' + t.availTop
        +  ',width=' + t.availWidth + ',height=' + t.availHeight;
    } else {
      var sw = (window.screen && screen.width) || 1280;
      var sh = (window.screen && screen.height) || 720;
      f += ',left=0,top=0,width=' + sw + ',height=' + sh;
    }
    return window.open(BASE + '?role=palco', 'ml5e-palco', f);
  }

  /* ══════════════ Entrada ══════════════ */
  if (PAPEL === 'console') montarConsole();
  else montarDeck(PAPEL === 'palco');


  /* ═══════════════════════════════════════════════════════════════
     DECK / PALCO
     ═══════════════════════════════════════════════════════════════ */
  function montarDeck(jaEhPalco) {
    if (jaEhPalco) { virarPalco(false); }
    else { prepararBotao(); }
    pontesDoIframe();
  }

  /* ---------- Botão 🎤 do deck avulso ---------- */
  function prepararBotao() {
    var nav = document.querySelector('.hud .nav-buttons');

    var toast = document.createElement('div');
    toast.className = 't-toast';
    document.body.appendChild(toast);
    var relogioToast = null;
    function aviso(txt, ms) {
      toast.innerHTML = txt;
      toast.classList.add('on');
      clearTimeout(relogioToast);
      relogioToast = setTimeout(function () { toast.classList.remove('on'); }, ms || 3000);
    }

    lerTelas();   /* silencioso; só funciona se a permissão já existir */

    function comecar() {
      var alvo = projetor();

      /* ---- 1 clique: fullscreen no projetor + console de companhia ---- */
      if (alvo) { caminhoCompanion(alvo, aviso); return; }

      /* ---- Há 2ª tela mas falta permissão: pede agora (1º uso) ---- */
      if (window.screen && screen.isExtended && window.getScreenDetails && !telas) {
        aviso('Autorize o <b>gerenciamento de janelas</b> para eu abrir direto no projetor…', 7000);
        window.getScreenDetails().then(function (d) {
          telas = d;
          aviso('Telas liberadas. <b>Clique em “Modo treinador” de novo</b> para apresentar no projetor.', 8000);
        })['catch'](function () {
          aviso('Sem permissão de telas. Abrindo do jeito clássico…', 4000);
          caminhoClassico(aviso);
        });
        return;
      }

      /* ---- Monitor único ou navegador sem a API ---- */
      caminhoClassico(aviso);
    }

    if (nav) {
      var btn = document.createElement('button');
      btn.dataset.nav = 'treinador';
      btn.className = 't-btn';
      btn.title = 'Modo treinador: apresentação no projetor e painel do treinador na sua tela (T)';
      btn.innerHTML = '🎤 Modo treinador';
      btn.addEventListener('click', comecar);
      nav.insertBefore(btn, nav.firstChild);
    }

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.activeElement && document.activeElement.isContentEditable) return;
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); comecar(); }
    });
  }

  /* ---------- Caminho 1 clique ---------- */
  function caminhoCompanion(alvo, aviso) {
    /* Esta janela se muda para o projetor e vira o palco. */
    try { document.documentElement.requestFullscreen({ screen: alvo }); } catch (e) {}

    /* Mesmo gesto: o console nasce na tela de casa. O Chrome libera este
       popup por ser a "janela de companhia" de um fullscreen multi-tela. */
    var casa = telaDeCasa();
    var f = 'popup,menubar=no,toolbar=no,location=no,status=no';
    if (casa) {
      f += ',left=' + casa.availLeft + ',top=' + casa.availTop
        +  ',width=' + Math.min(1320, casa.availWidth)
        +  ',height=' + Math.min(880, casa.availHeight);
    }
    var con = window.open(BASE + '?role=console', 'ml5e-console', f);
    if (!con && aviso) {
      aviso('O navegador bloqueou a janela do console.<br>Libere os pop-ups deste site.', 6000);
    }
    virarPalco(true);
  }

  /* ---------- Caminho clássico ---------- */
  function caminhoClassico(aviso) {
    var palco = abrirPalco(true);
    if (!palco) {
      aviso('O navegador bloqueou a janela de apresentação.<br>Libere os pop-ups deste site e tente de novo.', 6000);
      return;
    }
    aviso('Abrindo a apresentação…');
    setTimeout(function () { location.replace(BASE + '?role=console'); }, 120);
  }

  /* ---------- Vira palco (no load com ?role=palco, ou no lugar) ---------- */
  function virarPalco(noLugar) {
    document.documentElement.classList.add('is-palco');
    var btn = document.querySelector('[data-nav="treinador"]');
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    if (noLugar) {
      try { history.replaceState(null, '', BASE + '?role=palco'); } catch (e) {}
    }

    /* ---- Tela cheia ----
       No caminho companion já entramos via requestFullscreen({screen}).
       No clássico tentamos assim mesmo; se o navegador recusar (a
       ativação do opener não se propaga), o convite resolve com 1 clique. */
    var convite = document.createElement('div');
    convite.className = 'palco-convite';
    /* Em file:// o Chrome não persiste a permissão de gerenciamento de
       janelas, então esta janela NÃO consegue se mudar sozinha para o
       projetor. Em vez de fingir que dá, instruímos: arrastar e clicar. */
    convite.innerHTML = (location.protocol === 'file:')
      ? '<b>Arraste esta janela para o projetor</b>'
        + '<small>Depois <u>clique aqui</u> para entrar em tela cheia — ou <kbd>Win</kbd>+<kbd>Shift</kbd>+<kbd>→</kbd> para mover e <kbd>F</kbd> para a tela cheia</small>'
      : '<b>Clique para iniciar em tela cheia</b>'
        + '<small>ou aperte <kbd>F</kbd> a qualquer momento</small>';
    document.body.appendChild(convite);

    function emTelaCheia() { return !!document.fullscreenElement; }
    function esconder() { convite.classList.remove('on'); }
    function mostrar() { if (!emTelaCheia()) convite.classList.add('on'); }

    function pedirTelaCheia() {
      if (emTelaCheia()) return;
      var p;
      try { p = document.documentElement.requestFullscreen(); }
      catch (e) { mostrar(); return; }
      if (p && p.then) p.then(esconder)['catch'](mostrar);
    }

    convite.addEventListener('click', function () { pedirTelaCheia(); });
    document.addEventListener('fullscreenchange', function () { if (emTelaCheia()) esconder(); });
    if (!noLugar) pedirTelaCheia();
    setTimeout(function () { if (!emTelaCheia()) mostrar(); }, 600);

    /* ---- Conversa com o console ---- */
    var canal = ligar('palco', function () { publicar(); });

    function lerEstado() {
      var deck = document.querySelector('.deck');
      if (!deck) return null;
      var todos = Array.prototype.slice.call(deck.querySelectorAll('.slide'));
      var visiveis = todos.filter(function (s) { return !s.classList.contains('is-hidden-slide'); });
      var atual = deck.querySelector('.slide.is-active');
      if (!atual) return null;
      var i = visiveis.indexOf(atual);
      var prox = i >= 0 && i + 1 < visiveis.length ? visiveis[i + 1] : null;
      return {
        t: 'ml5e:estado', papel: 'palco',
        slideId: atual.dataset.slideId || String(todos.indexOf(atual) + 1),
        proxId: prox ? (prox.dataset.slideId || String(todos.indexOf(prox) + 1)) : null,
        n: i + 1,
        total: visiveis.length,
        passos: parseInt(atual.dataset.steps || '0', 10),
        revelados: atual.querySelectorAll('.cis-step.is-revealed').length,
        ocultos: todos.filter(function (s) { return s.classList.contains('is-hidden-slide'); })
                      .map(function (s) { return s.dataset.slideId; })
      };
    }

    function publicar() {
      var par = canal.par();
      if (!par) return;
      var e = lerEstado();
      if (e) { try { par.postMessage(e, '*'); } catch (er) {} }
    }

    var pendente = null;
    function agendar() {
      if (pendente) return;
      pendente = setTimeout(function () { pendente = null; publicar(); }, 60);
    }

    var deckEl = document.querySelector('.deck');
    if (deckEl) {
      new MutationObserver(agendar).observe(deckEl, {
        subtree: true, attributes: true, attributeFilter: ['class']
      });
    }

    window.addEventListener('message', function (ev) {
      var m = ev.data || {};
      if (m.t !== 'ml5e:cmd') return;
      canal.fixar(ev.source);
      if (m.cmd === 'ir' && typeof m.n === 'number') {
        window.postMessage({ type: 'cis-goto', n: m.n }, '*');    /* o ml5.js escuta isso */
      } else if (m.cmd === 'telaCheia') {
        window.focus();
        if (emTelaCheia()) document.exitFullscreen();
        else { pedirTelaCheia(); setTimeout(mostrar, 400); }
      } else if (m.cmd !== 'ping') {
        var mapa = { avancar: 'advance', anterior: 'prev', proximo: 'next' };
        var alvoBtn = document.querySelector('[data-nav="' + mapa[m.cmd] + '"]');
        if (alvoBtn) alvoBtn.click();
      }
      agendar();
    });
  }

  /* ---------- Links "versão completa" quando embutido no treinamento ---------- */
  function pontesDoIframe() {
    if (window.parent === window) return;
    document.querySelectorAll('a.home-button[href*="treinamento-ml5/index.html"]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        parent.postMessage({ type: 'cis-nav', target: 'menu' }, '*');
      });
    });
    var menu = document.querySelector('[data-nav="menu"]');
    if (menu) {
      var clone = menu.cloneNode(true);          /* descarta o listener do ml5.js */
      menu.parentNode.replaceChild(clone, menu);
      clone.title = 'Voltar ao treinamento completo';
      clone.addEventListener('click', function () {
        parent.postMessage({ type: 'cis-nav', target: 'menu' }, '*');
      });
    }
  }


  /* ═══════════════════════════════════════════════════════════════
     CONSOLE
     ═══════════════════════════════════════════════════════════════ */
  function montarConsole() {
    document.documentElement.classList.add('is-console');
    lerTelas();

    var deckAtual = document.querySelector('.deck');
    if (!deckAtual) return;

    /* O ml5.js não roda aqui (sai cedo com ?role=console), então os ids
       estáveis de slide não existem. Criamos os mesmos: índice no DOM. */
    function carimbar(deck) {
      deck.querySelectorAll('.slide').forEach(function (s, i) { s.dataset.slideId = String(i + 1); });
    }
    carimbar(deckAtual);

    var deckProx = deckAtual.cloneNode(true);
    carimbar(deckProx);

    var titulos = Array.prototype.map.call(deckAtual.querySelectorAll('.slide'), function (s) {
      var t = s.querySelector('.slide-title');
      return t ? t.textContent.replace(/\s+/g, ' ').trim() : '';
    });

    var raiz = document.createElement('div');
    raiz.className = 'cs';
    raiz.innerHTML = ''
      + '<div class="cs-top">'
      +   '<div class="cs-brand">⚡ ML5 Essencial <small>Console do treinador</small></div>'
      +   '<div class="cs-sp"></div>'
      +   '<div class="cs-timers">'
      +     '<div class="cs-timer"><b id="csTotal">00:00</b><span>total</span></div>'
      +     '<div class="cs-timer" id="csBoxSlide"><b id="csNoSlide">00:00</b><span>neste slide</span></div>'
      +     '<button class="cs-btn-sm" id="csZerar">zerar</button>'
      +   '</div>'
      +   '<div class="cs-sp"></div>'
      +   '<div class="cs-count"><b id="csN">–</b> / <span id="csTotalN">–</span></div>'
      +   '<button class="cs-btn-sm" id="csPalco" title="Abrir ou trazer para a frente a tela de apresentação">⧉ Telão</button>'
      +   '<div class="cs-link off" id="csLink"><span class="dot"></span><span id="csLinkTxt">procurando…</span></div>'
      + '</div>'
      + '<div class="cs-body">'
      +   '<div class="cs-col">'
      +     '<div class="cs-lbl">No telão agora <b id="csTit"></b></div>'
      +     '<div class="cs-view" id="csAtual"></div>'
      +     '<div class="cs-steps" id="csSteps"></div>'
      +   '</div>'
      +   '<div class="cs-col">'
      +     '<div class="cs-lbl">Próximo slide <b id="csTitProx"></b></div>'
      +     '<div class="cs-view prox" id="csProx"></div>'
      +     '<div class="cs-nota" id="csNota"><div class="tk">🎤 Roteiro</div><p>—</p></div>'
      +   '</div>'
      + '</div>'
      + '<div class="cs-bar">'
      +   '<button data-cmd="anterior">◀ Anterior</button>'
      +   '<button data-cmd="avancar" class="pri" id="csAdv">▸ Avançar</button>'
      +   '<button data-cmd="proximo">Próximo slide ▶</button>'
      +   '<button data-cmd="telaCheia" title="Põe a apresentação em tela cheia">⛶ Tela cheia no telão</button>'
      +   '<div class="cs-hint"><kbd>Espaço</kbd> ou <kbd>→</kbd> avança · <kbd>←</kbd> volta · <kbd>P</kbd> pausa o cronômetro<br>Clique num número da régua para pular</div>'
      + '</div>'
      + '<div class="cs-rail" id="csRail"></div>';
    document.body.appendChild(raiz);

    /* Cada preview é uma ÁREA elástica com uma MOLDURA dentro. A moldura
       recebe do JS o tamanho exato do slide escalado, então a borda
       abraça o slide — sem tarja preta sobrando dos lados. */
    var boxAtual = raiz.querySelector('#csAtual');
    var boxProx = raiz.querySelector('#csProx');
    var frameAtual = document.createElement('div');
    var frameProx = document.createElement('div');
    frameAtual.className = frameProx.className = 'cs-frame';
    frameAtual.appendChild(deckAtual);
    frameProx.appendChild(deckProx);
    boxAtual.appendChild(frameAtual);
    boxProx.appendChild(frameProx);

    function escalar(area, frame, deck) {
      var w = area.clientWidth, h = area.clientHeight;
      if (!w || !h) return;
      var k = Math.min(w / 1280, h / 720);
      frame.style.width = Math.round(1280 * k) + 'px';
      frame.style.height = Math.round(720 * k) + 'px';
      deck.style.transform = 'scale(' + k + ')';
    }
    function escalarTudo() {
      escalar(boxAtual, frameAtual, deckAtual);
      escalar(boxProx, frameProx, deckProx);
    }
    window.addEventListener('resize', escalarTudo);
    /* O resize da janela não cobre tudo: o roteiro muda de altura a cada
       slide, a régua pode quebrar linha e o zoom do navegador não dispara
       resize de forma confiável. O observador pega todos esses casos. */
    if (window.ResizeObserver) {
      var obs = new ResizeObserver(escalarTudo);
      obs.observe(boxAtual);
      obs.observe(boxProx);
    }

    /* ---- Régua ---- */
    var rail = raiz.querySelector('#csRail');
    var botoesRail = [];
    deckAtual.querySelectorAll('.slide').forEach(function (s, i) {
      var b = document.createElement('button');
      b.textContent = String(i + 1);
      b.title = titulos[i] || ('Slide ' + (i + 1));
      b.addEventListener('click', function () { enviar('ir', i + 1); });
      rail.appendChild(b);
      botoesRail.push(b);
    });

    /* ---- Ligação com o palco ---- */
    var canal = ligar('console', function () { marcarLink(true); });

    function marcarLink(ok) {
      raiz.querySelector('#csLink').classList.toggle('off', !ok);
      raiz.querySelector('#csLinkTxt').textContent = ok ? 'telão conectado' : 'telão fechado';
    }

    function enviar(cmd, n) {
      if (!canal.vivo()) { marcarLink(false); return; }
      try { canal.par().postMessage({ t: 'ml5e:cmd', cmd: cmd, n: n }, '*'); } catch (e) {}
    }

    window.addEventListener('message', function (ev) {
      var m = ev.data || {};
      if (m.t !== 'ml5e:estado') return;
      canal.fixar(ev.source);
      marcarLink(true);
      aplicarEstado(m);
    });

    raiz.querySelectorAll('[data-cmd]').forEach(function (b) {
      b.addEventListener('click', function () { enviar(b.dataset.cmd); });
    });

    raiz.querySelector('#csPalco').addEventListener('click', function () {
      if (canal.vivo()) { canal.par().focus(); return; }
      var w = abrirPalco(true);
      if (w) canal.fixar(w);
    });

    setInterval(function () { marcarLink(canal.vivo()); }, 1500);

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); enviar('avancar'); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); enviar('anterior'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); enviar('proximo'); }
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); alternarPausa(); }
    });

    /* ---- Estado ---- */
    var slideAtualId = null;

    function mostrar(deck, id) {
      deck.querySelectorAll('.slide').forEach(function (s) {
        s.classList.toggle('is-active', s.dataset.slideId === String(id));
      });
    }

    function aplicarEstado(m) {
      if (m.slideId !== slideAtualId) { slideAtualId = m.slideId; segundosNoSlide = 0; }
      mostrar(deckAtual, m.slideId);
      boxProx.classList.toggle('vazio', !m.proxId);
      if (m.proxId) mostrar(deckProx, m.proxId);
      else deckProx.querySelectorAll('.slide').forEach(function (s) { s.classList.remove('is-active'); });
      escalarTudo();

      raiz.querySelector('#csN').textContent = m.n;
      raiz.querySelector('#csTotalN').textContent = m.total;

      var idxDom = parseInt(m.slideId, 10) - 1;
      raiz.querySelector('#csTit').textContent = titulos[idxDom] || '';
      /* O título do próximo em texto legível: a miniatura serve para
         reconhecer o slide, o texto é que carrega a informação. */
      var idxProx = m.proxId ? parseInt(m.proxId, 10) - 1 : -1;
      raiz.querySelector('#csTitProx').textContent =
        idxProx >= 0 ? (titulos[idxProx] || '') : '— fim do deck';

      botoesRail.forEach(function (b, i) {
        b.classList.toggle('on', i === idxDom);
        b.classList.toggle('oculto', (m.ocultos || []).indexOf(String(i + 1)) !== -1);
      });
      var ativo = botoesRail[idxDom];
      if (ativo && ativo.scrollIntoView) ativo.scrollIntoView({ block: 'nearest', inline: 'center' });

      var passos = raiz.querySelector('#csSteps');
      if (m.passos > 0) {
        var pips = '';
        for (var i = 0; i < m.passos; i++) pips += '<span class="pip' + (i < m.revelados ? ' on' : '') + '"></span>';
        passos.innerHTML = pips + ' <span>revelado <em>' + m.revelados + '</em> de ' + m.passos + '</span>';
      } else {
        passos.innerHTML = '<span>slide sem revelação por item</span>';
      }

      raiz.querySelector('#csAdv').innerHTML = (m.passos > 0 && m.revelados < m.passos)
        ? '▸ Revelar item ' + (m.revelados + 1) + ' de ' + m.passos
        : '▸ Avançar para o próximo slide';

      var slide = deckAtual.querySelector('.slide[data-slide-id="' + m.slideId + '"]');
      var nota = slide && slide.querySelector('.tnote');
      var box = raiz.querySelector('#csNota');
      if (nota) {
        box.innerHTML = nota.innerHTML;
        box.classList.remove('vazio');
        minutosSugeridos = lerMinutos(nota);
      } else {
        box.innerHTML = '<div class="tk">🎤 Roteiro</div><p>Este slide não tem roteiro de condução.</p>';
        box.classList.add('vazio');
        minutosSugeridos = 0;
      }
    }

    function lerMinutos(nota) {
      var chip = nota.querySelector('.tk span');
      var m = chip && chip.textContent.match(/(\d+)\s*min/);
      return m ? parseInt(m[1], 10) : 0;
    }

    /* ---- Cronômetros ---- */
    var segundosTotal = 0, segundosNoSlide = 0, minutosSugeridos = 0, pausado = false;

    function doisDig(n) { return (n < 10 ? '0' : '') + n; }
    function formatar(s) { return doisDig(Math.floor(s / 60)) + ':' + doisDig(s % 60); }

    function alternarPausa() {
      pausado = !pausado;
      raiz.querySelector('#csZerar').textContent = pausado ? 'pausado' : 'zerar';
    }
    raiz.querySelector('#csZerar').addEventListener('click', function () {
      if (pausado) { alternarPausa(); return; }
      segundosTotal = 0; segundosNoSlide = 0;
    });

    setInterval(function () {
      if (!pausado) { segundosTotal++; segundosNoSlide++; }
      raiz.querySelector('#csTotal').textContent = formatar(segundosTotal);
      raiz.querySelector('#csNoSlide').textContent = formatar(segundosNoSlide);
      raiz.querySelector('#csBoxSlide').classList.toggle(
        'estourou', minutosSugeridos > 0 && segundosNoSlide > minutosSugeridos * 60);
    }, 1000);

    escalarTudo();
    setTimeout(escalarTudo, 120);
  }
})();
