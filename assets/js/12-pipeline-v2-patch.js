/* ════════════════════════════════════════════════════════════
   NOVA PIPELINE v2 — PATCH SOBRE O MÓDULO EXISTENTE
   1. getCol() — escala de cores oficial
   2. _npGetMetaAtiva() — detecta qual tier está em jogo
   3. npAbrirModalMeta — 3 campos por consultor
   4. npSalvarMetas — salva metaBasica/metaMinima/metaMaster
   5. _npRenderMetas — cards com tiers visuais
   6. _npRenderDashboard — status strip + cores corretas
   7. npRenderRanking — ordena por % meta
════════════════════════════════════════════════════════════ */
(function _npV2Patch(){

  /* ── Paleta oficial ─────────────────────────────────── */
  function _npGetCol(pct){
    if(pct>=100) return{bar:'#c8f05a',text:'#c8f05a',bg:'rgba(200,240,90,.08)',border:'rgba(200,240,90,.3)',badge:'Meta atingida! ✅',cls:'c100'};
    if(pct>=75)  return{bar:'#00f0ff',text:'#00f0ff',bg:'rgba(0,240,255,.06)',border:'rgba(0,240,255,.25)',badge:'Quase lá! 🔵',cls:'c75'};
    if(pct>=50)  return{bar:'#ffe000',text:'#ffe000',bg:'rgba(255,238,0,.06)',border:'rgba(255,238,0,.25)',badge:'Em progresso 🟡',cls:'c50'};
    if(pct>=25)  return{bar:'#ff5500',text:'#ff5500',bg:'rgba(255,85,0,.06)',border:'rgba(255,85,0,.25)',badge:'Atenção 🟠',cls:'c25'};
    return         {bar:'#ff1744',text:'#ff1744',bg:'rgba(255,23,68,.06)',border:'rgba(255,23,68,.25)',badge:'Crítico 🔴',cls:'c0'};
  }

  /* Meta ativa = a menor meta ainda não batida */
  function _npGetMetaAtiva(goal, real){
    var b=+(goal.metaBasica||goal.metaValor||0);
    var m=+(goal.metaMinima||0);
    var M=+(goal.metaMaster||0);
    /* Descobrir qual tier está em jogo */
    if(M>0&&real>=M) return{meta:M,tier:'master',label:'🥇 Master',pct:Math.round(real/M*100)};
    if(M>0&&real>=b) return{meta:M,tier:'master',label:'🥇 Master',pct:Math.round(real/M*100)};
    if(m>0&&real>=b) return{meta:m,tier:'minima',label:'🥈 Mínima',pct:Math.round(real/m*100)};
    if(b>0)          return{meta:b,tier:'basica', label:'🥉 Básica',pct:Math.round(real/b*100)};
    return{meta:0,tier:'',label:'—',pct:0};
  }

  /* Próximo tier a perseguir — ordem PROGRESSIVA: Mínima → Básica → Master.
     Retorna {meta, label, falta, batida} ou {batida:'master'} se já bateu tudo. */
  function _npProxTier(goal, real){
    var m=+(goal.metaMinima||0);
    var b=+(goal.metaBasica||goal.metaValor||0);
    var M=+(goal.metaMaster||0);
    real = +(real||0);
    if(m>0 && real<m) return {meta:m,label:'🥈 Mínima',falta:m-real,batida:null};
    if(b>0 && real<b) return {meta:b,label:'🥉 Básica',falta:b-real,batida:null};
    if(M>0 && real<M) return {meta:M,label:'🥇 Master',falta:M-real,batida:null};
    /* Bateu tudo configurado */
    if(M>0 && real>=M) return {meta:M,label:'🥇 Master',falta:0,batida:'master'};
    if(b>0 && real>=b) return {meta:b,label:'🥉 Básica',falta:0,batida:'basica'};
    if(m>0 && real>=m) return {meta:m,label:'🥈 Mínima',falta:0,batida:'minima'};
    return {meta:0,label:'',falta:0,batida:null};
  }
  window._npProxTier = _npProxTier;

  function _npFmtR(v){
    return 'R$\u00a0'+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function _npFmtR2(v){
    return 'R$\u00a0'+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  /* Formata n\u00famero (em reais) para input com centavos, sem prefixo R$. Ex.: 1500 \u2192 "1.500,00" */
  function _npFmtMoneyInput(v){
    return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function _esc2(s){ return window._esc(s); }
  function _escJS2(s){ return window._escJs(s); }

  /* ── Modal Metas — 3 campos por consultor ──────────── */
  window.npAbrirModalMeta=function(focoConsultor){
    if(typeof _npColetarConsultores==='function') _npColetarConsultores();
    var el=document.getElementById('npModalMetaMes');
    if(el) el.textContent=typeof _mesLabel==='function'?_mesLabel():'--';
    var body=document.getElementById('npModalMetaBody');
    if(!body) return;
    var _cons=window._npConsultores||[];
    var _goals=window._npGoals||{};
    var COR=window._npCOR||['#c8f05a','#60a5fa','#34d399','#f59e0b','#a78bfa','#f472b6','#fb923c','#38bdf8'];

    /* ── Opção 5 · CSS injetado uma vez ───────────────── */
    if(!document.getElementById('npMetaV5Css')){
      var v5 = document.createElement('style'); v5.id = 'npMetaV5Css';
      v5.textContent = ''
        + '.np-meta-grid{display:grid;grid-template-columns:280px 1fr;gap:16px;align-items:start;}'
        + '.np-meta-grid .np-lote-panel{background:var(--surface2,#1c2128);border:1px solid var(--border);border-radius:12px;padding:14px;position:sticky;top:0;display:flex;flex-direction:column;gap:14px;margin:0;border-bottom:1px solid var(--border);z-index:1;}'
        + '.np-meta-grid .np-lote-panel h4{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin:0;}'
        + '.np-lote-sel{display:flex;flex-direction:column;gap:6px;padding-bottom:14px;border-bottom:1px dashed var(--border);}'
        + '.np-lote-sel .np-sel-btn{justify-content:flex-start;text-align:left;width:100%;}'
        + '.np-lote-sel .np-sel-cnt{font-size:11px;color:var(--muted);margin-top:4px;}'
        + '.np-lote-sel .np-sel-cnt b{color:var(--accent);}'
        + '.np-lote-vals{display:flex;flex-direction:column;gap:10px;}'
        + '.np-lote-acts{display:flex;flex-direction:column;gap:8px;padding-top:14px;border-top:1px dashed var(--border);}'
        + '.np-meta-list{display:flex;flex-direction:column;gap:6px;min-width:0;}'
        + '.np-meta-list .np-meta-row{background:var(--surface2,#1c2128);border:1px solid var(--border);border-radius:8px;padding:10px 12px;display:grid;grid-template-columns:34px 22px 36px minmax(0,1fr) auto 1fr 1fr 1fr 30px;gap:8px;align-items:center;margin:0;}'
        + '.np-meta-list .np-meta-row.has{border-left:3px solid #ffe000;padding-left:9px;}'
        + '.np-meta-list .np-meta-row.hl{box-shadow:0 0 0 2px rgba(200,240,90,.3);}'
        + '.np-meta-list .np-meta-row .np-meta-pos{margin:0;}'
        + '.np-meta-list .np-meta-row .np-meta-av-circ{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;border:1.5px solid;flex-shrink:0;}'
        + '.np-meta-list .np-meta-row .np-meta-nome-lbl{display:flex;align-items:center;gap:8px;cursor:pointer;min-width:0;}'
        + '.np-meta-list .np-meta-row .np-meta-nome-txt{font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}'
        + '.np-meta-list .np-meta-row .np-meta-badge{font-size:9px;font-weight:800;background:rgba(255,238,0,.15);color:#ffe000;border:1px solid rgba(255,238,0,.3);border-radius:4px;padding:2px 7px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;}'
        + '.np-meta-list .np-meta-row .np-meta-badge.muted{background:transparent;color:var(--muted);border-color:transparent;opacity:.45;}'
        + '.np-meta-list .np-meta-row .np-form-input{width:100%;padding:6px 8px;font-size:11px;font-variant-numeric:tabular-nums;}'
        + '.np-meta-list .np-meta-row .np-meta-copy{background:rgba(200,240,90,.10);border:1px solid rgba(200,240,90,.30);color:var(--accent);font-size:14px;padding:0;width:28px;height:28px;border-radius:6px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;}'
        + '.np-meta-list .np-meta-row .np-meta-copy:hover{background:rgba(200,240,90,.20);transform:translateY(-1px);}'
        + '@media(max-width:900px){.np-meta-grid{grid-template-columns:1fr;}.np-meta-grid .np-lote-panel{position:static;}}'
        + '@media(max-width:700px){.np-meta-list .np-meta-row{grid-template-columns:32px 22px 34px minmax(0,1fr) auto;row-gap:8px;}.np-meta-list .np-meta-row .np-form-input{grid-column:span 5;}.np-meta-list .np-meta-row .np-meta-copy{grid-column:span 5;width:100%;height:30px;}}';
      document.head.appendChild(v5);
    }

    /* Opções de consultores com meta para o select "Copiar de" */
    var _consComMetaOpts = '<option value="">&#x2015; selecionar consultor &#x2015;</option>';
    _cons.forEach(function(cn){
      var cg = _goals[cn] || {};
      if(cg.metaMinima || cg.metaBasica || cg.metaMaster){
        _consComMetaOpts += '<option value="'+_esc2(cn)+'">'+_esc2(cn)+'</option>';
      }
    });

    var batchHtml='<aside class="np-lote-panel" id="npLotePanel">'
      +'<div class="np-lote-sel">'
      +'<span style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px;">Selecionar</span>'
      +'<button type="button" class="np-sel-btn" onclick="npSelTodos()" title="Marcar todos os consultores">&#x2713; Todos</button>'
      +'<button type="button" class="np-sel-btn np-sel-btn-sem" onclick="npSelSemMeta()" title="Marcar só consultores AINDA SEM meta — útil após copiar valores de quem já tem">&#x25CB; Sem meta</button>'
      +'<button type="button" class="np-sel-btn np-sel-btn-com" onclick="npSelComMeta()" title="Marcar só consultores que JÁ TÊM meta definida">&#x25CF; Com meta</button>'
      +'<button type="button" class="np-sel-btn np-sel-btn-clear" onclick="npLimparSel()" title="Desmarcar todos">&#x2715; Limpar</button>'
      +'<span id="npLoteCounter" class="np-sel-cnt"><b>0</b> de '+_cons.length+' selecionados</span>'
      +'<label style="display:none;"><input type="checkbox" id="npLoteSelAll" onchange="npToggleSelAll(this)"></label>'
      +'</div>'
      +'<div class="np-lote-vals">'
      /* ── Passo 1: Copiar de consultor ── */
      +'<div><div style="font-size:9px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">&#x1F4CB; Copiar de consultor</div>'
      +'<select id="npLoteCopiarDe" onchange="npCopiarDe(this)" style="width:100%;background:var(--bg-2,#161b22);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:11px;font-family:inherit;cursor:pointer;appearance:auto;">'
      +_consComMetaOpts+'</select></div>'
      /* ── 3 campos de meta ── */
      +'<div><div style="font-size:9px;font-weight:800;color:#ffe000;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">&#x1F948; M\xednima</div>'
      +'<input type="text" id="npLoteMinima" class="np-form-input" placeholder="manter atual" oninput="this.value=npMoneyMask(this.value);npVerificarPctLote()" style="border-color:rgba(255,238,0,.3);width:100%;"></div>'
      +'<div><div style="font-size:9px;font-weight:800;color:#ff5252;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">&#x1F949; B\xe1sica</div>'
      +'<input type="text" id="npLoteBasica" class="np-form-input" placeholder="manter atual" oninput="this.value=npMoneyMask(this.value);npVerificarPctLote()" style="border-color:rgba(255,82,82,.3);width:100%;"></div>'
      +'<div><div style="font-size:9px;font-weight:800;color:#c8f05a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">&#x1F947; Master</div>'
      +'<input type="text" id="npLoteMaster" class="np-form-input" placeholder="manter atual" oninput="this.value=npMoneyMask(this.value);npVerificarPctLote()" style="border-color:rgba(200,240,90,.3);width:100%;"></div>'
      /* ── Passo 2: Botões 50% / 75% (ocultos até ter valor nos campos) ── */
      +'<div id="npLotePct" style="display:none;border-top:1px dashed var(--border);padding-top:10px;">'
      +'<div style="font-size:9px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Aplicar % dos valores <span style="font-weight:600;text-transform:none;letter-spacing:0;opacity:.7;">(opcional)</span></div>'
      +'<div style="display:flex;gap:8px;">'
      +'<button type="button" id="npLotePct50" onclick="npAplicarPctLote(50)" style="flex:1;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;">50%</button>'
      +'<button type="button" id="npLotePct75" onclick="npAplicarPctLote(75)" style="flex:1;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;">75%</button>'
      +'</div>'
      +'<div style="font-size:9px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 6px;border-top:1px dashed var(--border);padding-top:10px;">Proporcional ao tempo <span style="font-weight:600;text-transform:none;letter-spacing:0;opacity:.7;">(\xf7 dias do m\xeas \xd7 dias restantes)</span></div>'
      +'<button type="button" id="npLotePctDias" onclick="npAplicarDiasUteisLote()" style="width:100%;background:rgba(56,189,248,.06);border:1px solid rgba(56,189,248,.25);color:#38bdf8;border-radius:6px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;">&#x1F4C5; \xd7 dias \xfateis restantes do m\xeas</button>'
      +'</div>'
      +'</div>'
      +'<div class="np-lote-acts">'
      +'<button class="np-btn" style="font-size:12px;padding:8px 14px;width:100%;" onclick="npAplicarMetaLote()">Aplicar aos selecionados</button>'
      +'<button class="np-btn-sec" style="font-size:11px;padding:7px 14px;width:100%;background:rgba(255,82,82,.07);border-color:rgba(255,82,82,.3);color:#ff5252;" onclick="npLimparMetaSelecionados()" title="Zera Mínima/Básica/Master dos consultores selecionados">&#x1F5D1; Limpar meta</button>'
      +'<button class="np-btn-sec" style="font-size:11px;padding:7px 14px;width:100%;" onclick="npCopiarMetasMesAnterior()">&#x21E6; Copiar m\xeas anterior</button>'
      +'</div>'
      +'</aside>';

    if(!_cons.length){
      body.innerHTML='<div class="np-meta-grid">'+batchHtml
        +'<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">Nenhum consultor encontrado.</div>'
        +'</div>';
    } else {
      var listHtml=_cons.map(function(nome,i){
        var g=_goals[nome]||{};
        var cor=COR[i%COR.length];
        var hl=focoConsultor&&focoConsultor===nome;
        var temMeta=!!(g.metaBasica||g.metaMinima||g.metaMaster);
        var posAtual = i+1;
        var chkId = 'npMetaChk_'+i; /* ID único e seguro (índice numérico) */
        return '<div class="np-meta-row '+(temMeta?'has ':'')+(hl?'hl ':'')+'" data-pos="'+posAtual+'" data-cons-row="'+_esc2(nome)+'">'
          +'<input type="number" min="1" max="'+_cons.length+'" class="np-meta-pos" data-cons-pos="'+_esc2(nome)+'" value="'+posAtual+'" onchange="window.npSetOrdem&&window.npSetOrdem(this.dataset.consPos, +this.value)" title="Digite a posição desejada e dê Tab — a lista reordena" style="background:var(--bg-2,#161b22);color:var(--text);border:1px solid var(--border);border-radius:5px;font-size:11px;font-weight:800;font-family:inherit;text-align:center;padding:5px 4px;">'
          +'<input type="checkbox" id="'+chkId+'" class="np-meta-chk" data-cons-chk="'+_esc2(nome)+'" onchange="npUpdateSelCounter()" onclick="npChkClick(event,this)" style="width:15px;height:15px;accent-color:var(--accent);cursor:pointer;justify-self:center;">'
          +'<label for="'+chkId+'" class="np-meta-nome-lbl" title="Clique para selecionar este consultor" style="grid-column:3 / span 2;">'
          +'<span class="np-meta-av-circ" style="background:'+cor+'22;color:'+cor+';border-color:'+cor+'55;">'+nome.charAt(0).toUpperCase()+'</span>'
          +'<span class="np-meta-nome-txt">'+_esc2(nome)+'</span>'
          +'</label>'
          +(temMeta
            ? '<span class="np-meta-badge">meta</span>'
            : '<span class="np-meta-badge muted">—</span>')
          +'<input type="text" class="np-form-input" data-cons="'+_esc2(nome)+'" data-tipo="metaMinima" placeholder="0,00" value="'+(g.metaMinima?_npFmtMoneyInput(g.metaMinima):'')+'" oninput="this.value=npMoneyMask(this.value)" style="border-color:rgba(255,238,0,.3);">'
          +'<input type="text" class="np-form-input" data-cons="'+_esc2(nome)+'" data-tipo="metaBasica" placeholder="0,00" value="'+(g.metaBasica?_npFmtMoneyInput(g.metaBasica):'')+'" oninput="this.value=npMoneyMask(this.value)" style="border-color:rgba(255,82,82,.3);">'
          +'<input type="text" class="np-form-input" data-cons="'+_esc2(nome)+'" data-tipo="metaMaster" placeholder="0,00" value="'+(g.metaMaster?_npFmtMoneyInput(g.metaMaster):'')+'" oninput="this.value=npMoneyMask(this.value)" style="border-color:rgba(200,240,90,.3);">'
          +(temMeta?'<button type="button" class="np-meta-copy" onclick="event.stopPropagation();event.preventDefault();npCopiarMetaConsultor(this)" title="📋 Copiar Mín/Bás/Mas deste consultor para o painel ao lado">📋</button>':'<span></span>')
          +'</div>';
      }).join('');
      body.innerHTML='<div class="np-meta-grid">'+batchHtml+'<div class="np-meta-list">'+listHtml+'</div></div>';
    }
    document.getElementById('npModalMeta').classList.add('open');

    if(focoConsultor){
      setTimeout(function(){
        var inp=body.querySelector('[data-cons="'+focoConsultor+'"]');
        if(inp){inp.scrollIntoView({behavior:'smooth',block:'center'});inp.focus();}
      },100);
    }
  };

  var _npLastChk=null;
  window.npChkClick=function(ev,cb){
    var body=document.getElementById('npModalMetaBody');
    if(!body) return;
    var all=Array.from(body.querySelectorAll('.np-meta-chk'));
    if(ev.shiftKey&&_npLastChk&&_npLastChk!==cb){
      var ia=all.indexOf(_npLastChk),ib=all.indexOf(cb);
      if(ia>=0&&ib>=0){
        var lo=Math.min(ia,ib),hi=Math.max(ia,ib);
        for(var k=lo;k<=hi;k++) all[k].checked=cb.checked;
      }
    }
    _npLastChk=cb;
  };

  window.npToggleSelAll=function(selAllCb){
    var body=document.getElementById('npModalMetaBody');
    if(!body) return;
    body.querySelectorAll('.np-meta-chk').forEach(function(cb){cb.checked=selAllCb.checked;});
    npUpdateSelCounter();
  };

  /* Copia os 3 valores (Mínima/Básica/Master) da linha do consultor clicado
     para os inputs do painel superior (lote). Depois o usuário marca os
     destinos e clica "Aplicar aos selecionados". Usa closest() para não
     depender de escape do nome — funciona com qualquer caractere. */
  window.npCopiarMetaConsultor=function(btn){
    var row = btn && btn.closest ? btn.closest('.np-meta-row') : null;
    if(!row){ return; }
    var inpMin = row.querySelector('[data-tipo="metaMinima"]');
    var inpBas = row.querySelector('[data-tipo="metaBasica"]');
    var inpMas = row.querySelector('[data-tipo="metaMaster"]');
    var loteMin = document.getElementById('npLoteMinima');
    var loteBas = document.getElementById('npLoteBasica');
    var loteMas = document.getElementById('npLoteMaster');
    if(loteMin) loteMin.value = (inpMin && inpMin.value) || '';
    if(loteBas) loteBas.value = (inpBas && inpBas.value) || '';
    if(loteMas) loteMas.value = (inpMas && inpMas.value) || '';
    /* Guarda base para cálculo de % e reseta select "Copiar de" */
    window._npLoteBase = {
      min: npParseMoney((inpMin && inpMin.value) || '') || 0,
      bas: npParseMoney((inpBas && inpBas.value) || '') || 0,
      mas: npParseMoney((inpMas && inpMas.value) || '') || 0
    };
    window._npLotePct = null; window._npLoteDias = false;
    var sel = document.getElementById('npLoteCopiarDe'); if(sel) sel.value = '';
    if(typeof npVerificarPctLote === 'function') npVerificarPctLote();
    var consName = (row.getAttribute('data-cons-row')||'consultor').trim();
    if(typeof _showToast==='function'){
      _showToast('&#x1F4CB; Valores de '+consName+' copiados. Marque os destinos e clique "Aplicar aos selecionados".','var(--accent)');
    }
    var panel = document.getElementById('npLotePanel');
    if(panel){ panel.style.transition='box-shadow .3s'; panel.style.boxShadow='0 0 0 2px rgba(200,240,90,.4)';
      setTimeout(function(){ panel.style.boxShadow=''; }, 900); }
  };
  /* ── Passo 1: Copiar de consultor pelo select do painel lote ── */
  window.npCopiarDe = function(sel) {
    var nome = sel ? sel.value : '';
    if(!nome) return;
    var goals = window._npGoals || {};
    var g = goals[nome] || {};
    /* Lê do DOM (captura edições não salvas) */
    var body = document.getElementById('npModalMetaBody');
    if(body) {
      var dMin = body.querySelector('[data-cons="'+nome+'"][data-tipo="metaMinima"]');
      var dBas = body.querySelector('[data-cons="'+nome+'"][data-tipo="metaBasica"]');
      var dMas = body.querySelector('[data-cons="'+nome+'"][data-tipo="metaMaster"]');
      g = {
        metaMinima: (dMin && npParseMoney(dMin.value)) || g.metaMinima || 0,
        metaBasica: (dBas && npParseMoney(dBas.value)) || g.metaBasica || 0,
        metaMaster: (dMas && npParseMoney(dMas.value)) || g.metaMaster || 0
      };
    }
    var fmt = typeof _npFmtMoneyInput === 'function' ? _npFmtMoneyInput : function(v){ return String(v); };
    var lMin = document.getElementById('npLoteMinima');
    var lBas = document.getElementById('npLoteBasica');
    var lMas = document.getElementById('npLoteMaster');
    if(lMin) lMin.value = g.metaMinima ? fmt(g.metaMinima) : '';
    if(lBas) lBas.value = g.metaBasica ? fmt(g.metaBasica) : '';
    if(lMas) lMas.value = g.metaMaster ? fmt(g.metaMaster) : '';
    window._npLoteBase = { min: g.metaMinima||0, bas: g.metaBasica||0, mas: g.metaMaster||0 };
    window._npLotePct = null; window._npLoteDias = false;
    npVerificarPctLote();
    var panel = document.getElementById('npLotePanel');
    if(panel){ panel.style.transition='box-shadow .3s'; panel.style.boxShadow='0 0 0 2px rgba(200,240,90,.4)';
      setTimeout(function(){ panel.style.boxShadow=''; }, 900); }
    if(typeof _showToast==='function') _showToast('&#x1F4CB; Meta de '+nome+' copiada. Selecione % ou aplique diretamente.','var(--accent)');
  };

  /* ── Passo 2: Mostrar/ocultar botões de % ──
     Modelo de modificadores combináveis: o valor exibido é sempre
     base × (% se ativo) × (dias_restantes/dias_mês se ativo).
     Assim 50% + dias encadeiam: ex. 174.128,05 × 50% ÷ 22 × 9. */
  window.npVerificarPctLote = function() {
    var pctDiv = document.getElementById('npLotePct');
    if(!pctDiv) return;
    var vMin = (document.getElementById('npLoteMinima') || {}).value || '';
    var vBas = (document.getElementById('npLoteBasica') || {}).value || '';
    var vMas = (document.getElementById('npLoteMaster') || {}).value || '';
    var temValor = !!(vMin.trim() || vBas.trim() || vMas.trim());
    pctDiv.style.display = temValor ? '' : 'none';
    if(!temValor){ window._npLoteBase = null; window._npLotePct = null; window._npLoteDias = false; _npLoteBtnsVisual(); }
  };

  /* Dias úteis (seg-sex) do mês vigente: total e restantes a partir de hoje */
  function _npDiasUteisMes() {
    var hoje = new Date(); hoje.setHours(0,0,0,0);
    var primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    var ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    var total = 0, restantes = 0;
    for(var dd = new Date(primeiroDia); dd <= ultimoDia; dd.setDate(dd.getDate() + 1)) {
      var dow = dd.getDay();
      if(dow >= 1 && dow <= 5){ total++; if(+dd >= +hoje) restantes++; }
    }
    return { total: total, restantes: restantes };
  }

  /* Garante que _npLoteBase exista (snapshot do valor atual dos campos) */
  function _npGarantirBaseLote() {
    if(window._npLoteBase) return;
    window._npLoteBase = {
      min: npParseMoney((document.getElementById('npLoteMinima')||{}).value||'') || 0,
      bas: npParseMoney((document.getElementById('npLoteBasica')||{}).value||'') || 0,
      mas: npParseMoney((document.getElementById('npLoteMaster')||{}).value||'') || 0
    };
  }

  /* Atualiza estado visual dos 3 botões conforme _npLotePct / _npLoteDias */
  function _npLoteBtnsVisual() {
    [50,75].forEach(function(p){
      var b = document.getElementById('npLotePct'+p);
      if(!b) return;
      var on = window._npLotePct === p;
      b.style.background = on ? 'rgba(200,240,90,.15)' : 'rgba(255,255,255,.05)';
      b.style.color      = on ? 'var(--accent)' : 'var(--muted)';
      b.style.borderColor= on ? 'rgba(200,240,90,.4)' : 'var(--border)';
    });
    var bd = document.getElementById('npLotePctDias');
    if(bd){
      var onD = !!window._npLoteDias;
      bd.style.background = onD ? 'rgba(56,189,248,.16)' : 'rgba(56,189,248,.06)';
      bd.style.color      = '#38bdf8';
      bd.style.borderColor= onD ? 'rgba(56,189,248,.5)' : 'rgba(56,189,248,.25)';
    }
  }

  /* Recalcula os 3 campos a partir da base aplicando % e dias (combinados) */
  function _npLoteRecalc() {
    if(!window._npLoteBase) return;
    var base = window._npLoteBase;
    var pmult = window._npLotePct ? (window._npLotePct / 100) : 1;
    var dmult = 1;
    if(window._npLoteDias){
      var d = _npDiasUteisMes();
      dmult = (d.total && d.restantes) ? (d.restantes / d.total) : 1;
    }
    var mult = pmult * dmult;
    var fmt = typeof _npFmtMoneyInput === 'function' ? _npFmtMoneyInput : function(v){ return String(v); };
    var lMin = document.getElementById('npLoteMinima');
    var lBas = document.getElementById('npLoteBasica');
    var lMas = document.getElementById('npLoteMaster');
    /* arredonda para centavos */
    function r2(v){ return Math.round(v * 100) / 100; }
    if(lMin) lMin.value = base.min ? fmt(r2(base.min * mult)) : '';
    if(lBas) lBas.value = base.bas ? fmt(r2(base.bas * mult)) : '';
    if(lMas) lMas.value = base.mas ? fmt(r2(base.mas * mult)) : '';
    _npLoteBtnsVisual();
  }

  window.npAplicarPctLote = function(pct) {
    _npGarantirBaseLote();
    /* Toggle: clicou no % já ativo → desliga */
    window._npLotePct = (window._npLotePct === pct) ? null : pct;
    _npLoteRecalc();
    if(typeof _showToast==='function'){
      if(window._npLotePct) _showToast(pct+'% aplicado'+(window._npLoteDias?' + dias úteis':'')+'. Clique "Aplicar aos selecionados" para confirmar.','var(--accent)');
      else _showToast('% removido.','var(--muted)');
    }
  };

  window.npAplicarDiasUteisLote = function() {
    _npGarantirBaseLote();
    /* Toggle: clicou de novo → desliga */
    window._npLoteDias = !window._npLoteDias;
    if(window._npLoteDias){
      var d = _npDiasUteisMes();
      if(!d.total || !d.restantes){
        window._npLoteDias = false;
        if(typeof _showToast==='function') _showToast('Nenhum dia \xfatil dispon\xedvel.','var(--amber)');
        return;
      }
      _npLoteRecalc();
      if(typeof _showToast==='function') _showToast('&#x1F4C5; \xf7 '+d.total+' dias do m\xeas \xd7 '+d.restantes+' restantes'+(window._npLotePct?' (sobre '+window._npLotePct+'%)':'')+'. Clique "Aplicar aos selecionados".','var(--accent)');
    } else {
      _npLoteRecalc();
      if(typeof _showToast==='function') _showToast('Proporcional removido.','var(--muted)');
    }
  };

  /* Hover style do botão Copiar — injetado uma vez */
  (function(){
    if(document.getElementById('npMetaCopyStyle')) return;
    var st=document.createElement('style'); st.id='npMetaCopyStyle';
    st.textContent=''
      +'.np-meta-copy:hover{background:rgba(200,240,90,.18) !important;border-color:rgba(200,240,90,.5) !important;transform:translateY(-1px);}'
      +'.np-sel-btn{background:var(--surface2,#1c2128);border:1px solid var(--border);color:var(--muted);font-size:11px;font-weight:700;padding:6px 12px;border-radius:7px;cursor:pointer;font-family:inherit;transition:all .15s;display:inline-flex;align-items:center;gap:5px;}'
      +'.np-sel-btn:hover{color:var(--text);border-color:var(--border2,rgba(255,255,255,.14));transform:translateY(-1px);}'
      +'.np-sel-btn-sem:hover{color:#ffe000;border-color:rgba(255,238,0,.4);background:rgba(255,238,0,.06);}'
      +'.np-sel-btn-com:hover{color:#c8f05a;border-color:rgba(200,240,90,.4);background:rgba(200,240,90,.06);}'
      +'.np-sel-btn-clear:hover{color:#ff5252;border-color:rgba(255,82,82,.4);background:rgba(255,82,82,.06);}';
    document.head.appendChild(st);
  })();

  /* ── Seleção rápida — 4 atalhos ───────────────────────
     Usam closest('.np-meta-row') + .querySelector pra detectar
     se a linha tem meta (algum dos 3 inputs preenchido > 0).
     Não dependem do _npGoals em memória — leem o DOM atual,
     então funcionam mesmo após edições não salvas. */
  function _npLinhaTemMeta(row){
    if(!row) return false;
    var tipos=['metaMinima','metaBasica','metaMaster'];
    for(var i=0;i<tipos.length;i++){
      var inp=row.querySelector('[data-tipo="'+tipos[i]+'"]');
      if(inp && inp.value && inp.value.replace(/[\s.,R$]/g,'') !== '0' && inp.value.trim() !== ''){
        return true;
      }
    }
    return false;
  }
  function _npAplicarSelecao(predicado, msg){
    var body=document.getElementById('npModalMetaBody');
    if(!body) return;
    var n=0;
    body.querySelectorAll('.np-meta-row').forEach(function(row){
      var chk=row.querySelector('.np-meta-chk');
      if(!chk) return;
      var marca=predicado(row);
      chk.checked=marca;
      if(marca) n++;
    });
    if(typeof window.npUpdateSelCounter==='function') window.npUpdateSelCounter();
    if(msg && typeof _showToast==='function') _showToast(msg.replace('{n}', n), 'var(--accent)');
  }
  window.npSelTodos=function(){
    _npAplicarSelecao(function(){ return true; }, '✓ {n} consultores marcados');
  };
  window.npSelSemMeta=function(){
    _npAplicarSelecao(function(row){ return !_npLinhaTemMeta(row); }, '○ {n} consultores SEM meta marcados');
  };
  window.npSelComMeta=function(){
    _npAplicarSelecao(function(row){ return _npLinhaTemMeta(row); }, '● {n} consultores COM meta marcados');
  };
  window.npLimparSel=function(){
    _npAplicarSelecao(function(){ return false; }, '✕ Seleção limpa');
  };

  /* ── Reordenação por numeração editável (opção 5) ──
     Digita um número novo num row → reorganiza a lista local +
     re-renderiza + salva ordem em _npGoals[nome].metaOrdem.
     A persistência efetiva acontece quando o gestor clicar em
     "Salvar metas" (junto com os valores das metas). */
  window.npSetOrdem = function(nome, novaPos){
    var lista = window._npConsultores || [];
    if(!lista.length) return;
    novaPos = Math.max(1, Math.min(lista.length, parseInt(novaPos,10)||1));
    var posAtual = lista.indexOf(nome);
    if(posAtual < 0){
      /* tenta achar case-insensitive */
      posAtual = lista.findIndex(function(n){ return String(n).toUpperCase() === String(nome).toUpperCase(); });
      if(posAtual < 0) return;
      nome = lista[posAtual];
    }
    if(posAtual === novaPos - 1) return;  /* mesma posição, nada a fazer */

    /* Coleta os VALORES de todos os inputs atuais (pra preservar
       edições não salvas durante o reordenamento) */
    var body = document.getElementById('npModalMetaBody');
    var rascunho = {};
    if(body){
      body.querySelectorAll('.np-form-input[data-cons]').forEach(function(inp){
        var n = inp.getAttribute('data-cons');
        var t = inp.getAttribute('data-tipo');
        if(!n || !t) return;
        rascunho[n] = rascunho[n] || {};
        var v = npParseMoney(inp.value);
        if(v != null) rascunho[n][t] = v;
      });
    }

    /* Move o item da posição atual pra nova */
    lista.splice(posAtual, 1);
    lista.splice(novaPos - 1, 0, nome);

    /* Atualiza _npGoals com metaOrdem sequencial (1, 2, 3, ...) +
       preserva o rascunho coletado dos inputs */
    var goals = window._npGoals || {};
    lista.forEach(function(n, i){
      goals[n] = goals[n] || {};
      goals[n].metaOrdem = i + 1;
      if(rascunho[n]){
        if(rascunho[n].metaMinima != null) goals[n].metaMinima = rascunho[n].metaMinima;
        if(rascunho[n].metaBasica != null) goals[n].metaBasica = rascunho[n].metaBasica;
        if(rascunho[n].metaMaster != null) goals[n].metaMaster = rascunho[n].metaMaster;
      }
    });
    window._npConsultores = lista;
    window._npGoals = goals;

    /* Re-renderiza o modal mantendo foco no item movido */
    window.npAbrirModalMeta(nome);
    if(typeof _showToast === 'function') _showToast('🔢 '+nome+' movido pra posição '+novaPos+' · clique "Salvar metas" pra confirmar', 'var(--accent)');
  };

  /* Helper: parser de input monetário do modal (já existe em outro lugar
     mas pode não estar exposto — fallback seguro) */
  function npParseMoney(v){
    if(v == null || v === '') return null;
    var s = String(v).replace(/\./g,'').replace(',','.').replace(/[^\d.-]/g,'');
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  window.npUpdateSelCounter=function(){
    var body=document.getElementById('npModalMetaBody');
    var counter=document.getElementById('npLoteCounter');
    var selAll=document.getElementById('npLoteSelAll');
    if(!body) return;
    var all=body.querySelectorAll('.np-meta-chk');
    var sel=body.querySelectorAll('.np-meta-chk:checked');
    if(counter) counter.textContent=sel.length+' de '+all.length+' selecionados';
    if(selAll){
      selAll.indeterminate=sel.length>0&&sel.length<all.length;
      selAll.checked=sel.length===all.length&&all.length>0;
    }
    all.forEach(function(cb){
      var row=cb.closest('.np-meta-row');
      if(row) row.style.background=cb.checked?'rgba(200,240,90,.05)':'';
    });
  };

  window.npAplicarMetaLote=function(){
    var body=document.getElementById('npModalMetaBody');
    if(!body) return;
    var selecionados=Array.from(body.querySelectorAll('.np-meta-chk:checked')).map(function(cb){return cb.dataset.consChk;});
    if(!selecionados.length){
      if(typeof _showToast==='function') _showToast('Selecione ao menos um consultor.','var(--amber)');
      return;
    }
    var vMin=(document.getElementById('npLoteMinima')||{}).value||'';
    var vBas=(document.getElementById('npLoteBasica')||{}).value||'';
    var vMas=(document.getElementById('npLoteMaster')||{}).value||'';
    if(!vMin&&!vBas&&!vMas){
      if(typeof _showToast==='function') _showToast('Preencha ao menos um campo de meta.','var(--amber)');
      return;
    }
    var _goals=window._npGoals||{};
    var comMeta=selecionados.filter(function(n){var g=_goals[n]||{};return !!(g.metaBasica||g.metaMinima||g.metaMaster);});
    if(comMeta.length){
      var msg=comMeta.length+' consultor'+(comMeta.length>1?'es ja tem':'  ja tem')+' metas definidas.\n\nSobrescrever tudo? Clique OK para confirmar ou Cancelar para abortar.';
      if(!confirm(msg)) return;
    }
    selecionados.forEach(function(nome){
      if(vMin){var i=body.querySelector('[data-cons="'+nome+'"][data-tipo="metaMinima"]');if(i) i.value=vMin;}
      if(vBas){var i2=body.querySelector('[data-cons="'+nome+'"][data-tipo="metaBasica"]');if(i2) i2.value=vBas;}
      if(vMas){var i3=body.querySelector('[data-cons="'+nome+'"][data-tipo="metaMaster"]');if(i3) i3.value=vMas;}
    });
    if(typeof _showToast==='function') _showToast('Template aplicado a '+selecionados.length+' consultor'+(selecionados.length>1?'es':'')+'. Clique em "Salvar metas" para confirmar.','var(--accent)');
  };

  window.npLimparMetaSelecionados=function(){
    var body=document.getElementById('npModalMetaBody');
    if(!body) return;
    var selecionados=Array.from(body.querySelectorAll('.np-meta-chk:checked')).map(function(cb){return cb.dataset.consChk;});
    if(!selecionados.length){
      if(typeof _showToast==='function') _showToast('Selecione ao menos um consultor.','var(--amber)');
      return;
    }
    if(!confirm('Zerar Mínima, Básica e Master de '+selecionados.length+' consultor'+(selecionados.length>1?'es':'')+' selecionado'+(selecionados.length>1?'s':'')+' ? Clique OK para confirmar.')) return;
    selecionados.forEach(function(nome){
      ['metaMinima','metaBasica','metaMaster'].forEach(function(tipo){
        var inp=body.querySelector('[data-cons="'+nome+'"][data-tipo="'+tipo+'"]');
        if(inp) inp.value='';
      });
      /* Remove badge "meta" da linha */
      var row=body.querySelector('[data-cons-row="'+nome+'"]');
      if(row){
        var badge=row.querySelector('.np-meta-badge');
        if(badge){ badge.textContent='—'; badge.classList.add('muted'); }
        row.classList.remove('has');
      }
    });
    if(typeof _showToast==='function') _showToast('&#x1F5D1; Metas zeradas para '+selecionados.length+' consultor'+(selecionados.length>1?'es':'')+'. Clique em "Salvar metas" para confirmar.','var(--amber)');
  };

  window.npCopiarMetasMesAnterior=function(){
    var mk=typeof _mesKey==='function'?_mesKey():'';
    if(!mk) return;
    var partes=mk.split('-');
    var ano=parseInt(partes[0]),mes=parseInt(partes[1]);
    mes--;if(mes<1){mes=12;ano--;}
    var prevMk=ano+'-'+(mes<10?'0':'')+mes;
    if(typeof _showToast==='function') _showToast('Carregando metas de '+prevMk+'...','var(--muted)');
    window._fbGet('pipelineGoals/'+prevMk).then(function(d){
      if(!d||!Object.keys(d).length){
        if(typeof _showToast==='function') _showToast('Nenhuma meta encontrada em '+prevMk+'.','var(--amber)');
        return;
      }
      var body=document.getElementById('npModalMetaBody');
      if(!body) return;
      var count=0;
      Object.entries(d).forEach(function(e){
        var nome=e[0],g=e[1]||{};
        ['metaMinima','metaBasica','metaMaster'].forEach(function(tipo){
          var inp=body.querySelector('[data-cons="'+nome+'"][data-tipo="'+tipo+'"]');
          if(inp&&g[tipo]){
            inp.value=typeof _npFmtMoneyInput==='function'?_npFmtMoneyInput(g[tipo]):String(g[tipo]);
            count++;
          }
        });
      });
      if(typeof _showToast==='function') _showToast('Metas de '+prevMk+' copiadas para '+count/3+' consultor(es). Clique em "Salvar metas" para confirmar.','var(--accent)');
    }).catch(function(){
      if(typeof _showToast==='function') _showToast('Erro ao carregar metas de '+prevMk+'.','var(--red)');
    });
  };

  /* ── Salvar 3 metas no Firebase ─────────────────────── */
  window.npSalvarMetas=function(){
    var body=document.getElementById('npModalMetaBody');
    if(!body) return;
    var mk=typeof _mesKey==='function'?_mesKey():'';
    /* Parser robusto: aceita "R$ 1.500", "1.500,00", "1500", etc. */
    function _parseMoney(v){
      var s=String(v==null?'':v).replace(/[^\d,.]/g,'');
      if(!s) return 0;
      if(s.indexOf(',')>=0) s=s.replace(/\./g,'').replace(',','.');
      else s=s.replace(/\./g,'');
      var n=parseFloat(s);
      return isFinite(n)?n:0;
    }
    var updates={};
    ['metaBasica','metaMinima','metaMaster','metaQtd'].forEach(function(tipo){
      body.querySelectorAll('[data-tipo="'+tipo+'"]').forEach(function(inp){
        var nome=inp.dataset.cons;
        if(!updates[nome]) updates[nome]={};
        if(tipo==='metaQtd'){
          updates[nome][tipo]=parseInt(String(inp.value||'').replace(/\D/g,''),10)||0;
        } else {
          var num=_parseMoney(inp.value);
          updates[nome][tipo]=num;
          /* Compatibilidade: metaValor = metaBasica */
          if(tipo==='metaBasica') updates[nome].metaValor=num;
        }
      });
    });
    /* metaOrdem (opção 5 · numeração editável) — persiste a posição
       de cada consultor na lista. Lê _npConsultores que reflete a
       ordem atual da UI (atualizada por npSetOrdem). */
    var cons = window._npConsultores || [];
    cons.forEach(function(nome, i){
      if(!updates[nome]) updates[nome] = {};
      updates[nome].metaOrdem = i + 1;
    });
    var promises=Object.entries(updates).map(function(e){
      return window._fbSave('pipelineGoals/'+mk+'/'+e[0],e[1]);
    });
    Promise.all(promises).then(function(){
      if(typeof window._audit==='function') window._audit('meta.update',{type:'meta',id:mk},updates);
      var _mlbl=typeof _mesLabel==='function'?_mesLabel():mk;
      if(typeof _showToast==='function')_showToast('✅ Metas de '+_mlbl+' salvas!','var(--accent)');
      /* Modal permanece aberto — fecha só pelo botão Fechar */
      window._fbGet('pipelineGoals/'+mk).then(function(d){
        window._npGoals=d||{};
        if(typeof _npRenderTudo==='function') _npRenderTudo();
      }).catch(function(){});
    }).catch(function(){
      if(typeof _showToast==='function')_showToast('❌ Erro ao salvar metas.','var(--red)');
    });
  };

  /* ── Modal Meta Geral ────────────────────────────────── */
  window.npAbrirModalMetaGeral=function(){
    var mk=window._mesKey?window._mesKey():'';
    var lbl=window._mesLabel?window._mesLabel():mk;
    var el=document.getElementById('npModalMetaGeralMes');
    if(el) el.textContent=lbl;

    /* Preencher input com valor atual */
    var inp=document.getElementById('npInputMetaGeral');
    if(inp){
      var val=window._npMetaGeral&&window._npMetaGeral.valor>0?window._npMetaGeral.valor:0;
      inp.value=val>0?_npFmtMoneyInput(val):'';
    }

    /* Painel de referência */
    var somaInd=Object.values(window._npGoals||{}).reduce(function(s,g){return s+(+(g.metaBasica||g.metaValor||0));},0);
    var mgVal=window._npMetaGeral&&window._npMetaGeral.valor>0?window._npMetaGeral.valor:0;
    var todas=window._npTodasVendas?window._npTodasVendas():[];
    var faturado=todas.reduce(function(s,v){return s+((v.status||'').toLowerCase()==='pago'?+(v.valor||0):0);},0);
    var diff=mgVal>0?(mgVal-faturado):0;
    var diffHtml=mgVal>0
      ?'<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-weight:700;color:'+(diff<=0?'var(--green)':'var(--amber)')+';">'+(diff<=0?'✅ Meta atingida! +'+_npFmtR(Math.abs(diff))+' acima':'Faltam: '+_npFmtR(diff))+'</div>'
      :'';
    var refEl=document.getElementById('npMetaGeralRef');
    if(refEl){
      refEl.innerHTML='<div>Meta Geral: <strong style="color:#60a5fa;">'+(mgVal>0?_npFmtR(mgVal):'—')+'</strong></div>'
        +'<div>Σ metas individuais: <strong style="color:var(--muted);">'+_npFmtR(somaInd)+'</strong></div>'
        +'<div>Faturado (pago): <strong style="color:var(--accent);">'+_npFmtR(faturado)+'</strong></div>'
        +diffHtml
        +'<div style="margin-top:10px;font-size:10px;color:var(--muted);">Quando definida, a Meta Geral substitui a soma das metas individuais no Performance do Time e em "Faltam para meta".</div>';
    }

    /* Botão remover — só ativo se há meta salva */
    var btnRem=document.getElementById('npBtnRemoverMetaGeral');
    if(btnRem) btnRem.style.opacity=mgVal>0?'1':'0.4';

    var overlay=document.getElementById('npModalMetaGeral');
    if(overlay) overlay.classList.add('open');
  };

  window.npFecharModalMetaGeral=function(){
    var overlay=document.getElementById('npModalMetaGeral');
    if(overlay) overlay.classList.remove('open');
  };

  window.npSalvarMetaGeral=function(){
    var mk=window._mesKey?window._mesKey():'';
    var inp=document.getElementById('npInputMetaGeral');
    if(!inp) return;
    var s=String(inp.value||'').replace(/[^\d,.]/g,'');
    if(s.indexOf(',')>=0) s=s.replace(/\./g,'').replace(',','.');
    else s=s.replace(/\./g,'');
    var valor=parseFloat(s)||0;
    var payload={valor:valor,atualizadoEm:Date.now()};
    window._fbSave('pipelineMetaGeral/'+mk,payload).then(function(){
      window._npMetaGeral=valor>0?payload:null;
      if(window._npAtualizarBtnConfigurar) window._npAtualizarBtnConfigurar();
      if(window._npRenderTudo) window._npRenderTudo();
      var lbl=window._mesLabel?window._mesLabel():mk;
      if(typeof _showToast==='function') _showToast('✅ Meta geral de '+lbl+' salva! ('+_npFmtR(valor)+')','var(--accent)');
      window.npFecharModalMetaGeral();
    }).catch(function(){
      if(typeof _showToast==='function') _showToast('❌ Erro ao salvar meta geral.','var(--red)');
    });
  };

  window.npRemoverMetaGeral=function(){
    var mk=window._mesKey?window._mesKey():'';
    if(!window._npMetaGeral||!(window._npMetaGeral.valor>0)) return;
    if(!confirm('Remover a Meta Geral deste mês? O sistema voltará a usar a soma das metas individuais.')) return;
    window._fbSave('pipelineMetaGeral/'+mk,null).then(function(){
      window._npMetaGeral=null;
      if(window._npAtualizarBtnConfigurar) window._npAtualizarBtnConfigurar();
      if(window._npRenderTudo) window._npRenderTudo();
      if(typeof _showToast==='function') _showToast('Meta geral removida. Usando soma das metas individuais.','var(--muted)');
      window.npFecharModalMetaGeral();
    }).catch(function(){
      if(typeof _showToast==='function') _showToast('❌ Erro ao remover meta geral.','var(--red)');
    });
  };

  /* ── Render Metas — cards com 3 tiers ────────────────── */
  function _npRenderMetasV2(todas){
    var grid=document.getElementById('npMetasGrid');if(!grid) return;
    /* Mês sem vendas: invalidar o cache de linhas (senão o sort/toggle
       Card-Lista repinta a tabela do MÊS ANTERIOR sob o rótulo novo) e
       só mostrar vazio se também não houver METAS configuradas no mês —
       com metas cadastradas a lista renderiza normalmente com 0%. */
    if(_npVendasTurma.length===0&&Object.keys(_npVendasAvulso||{}).length===0){
      var _temMetaMes=Object.values(window._npGoals||{}).some(function(g){
        return g&&(+(g.metaMinima||0)>0||+(g.metaBasica||g.metaValor||0)>0||+(g.metaMaster||0)>0);
      });
      if(!_temMetaMes){
        window._npMetasRows=null;
        grid.innerHTML='<div class="np-empty">Nenhum dado para este mês.</div>';return;
      }
    }
    /* Fonte da grid Metas: UNIÃO de 3 origens (dedup case-insensitive):
       1) usuários da Gestão de Usuários com perfil='consultor'
       2) quem tem META configurada no mês (pipelineGoals) — ex.: consultor
          sem conta em usuarios/ mas com meta lançada não pode sumir da lista
       3) quem tem VENDA no mês (ranking)
       Antes era só (1): NATALIA/JULIANA sumiram da grid ao perderem a conta
       em usuarios/, mesmo com meta e faturamento no mês. */
    var _usuariosGU=(window._npUsuarios&&typeof window._npUsuarios==='object')?window._npUsuarios:{};
    var ranking=typeof window._npPorConsultor==='function'?window._npPorConsultor(todas,'','pago'):[];
    var _consSet={};
    function _addCons(nome){
      if(!nome) return;
      var k=String(nome).toUpperCase().trim();
      if(!k) return;
      /* Pausado na Gestão de Usuários não aparece em nenhuma lista */
      if(typeof window._npEhPausado==='function'&&window._npEhPausado(nome)) return;
      if(!_consSet[k]) _consSet[k]=String(nome).trim();
    }
    Object.values(_usuariosGU).forEach(function(u){
      if(u&&u.perfil==='consultor'&&u.nome&&u.ativo!==false) _addCons(u.nome);
    });
    Object.entries(window._npGoals||{}).forEach(function(e){
      var g=e[1]||{};
      if(+(g.metaMinima||0)>0||+(g.metaBasica||g.metaValor||0)>0||+(g.metaMaster||0)>0) _addCons(e[0]);
    });
    ranking.forEach(function(r){ if(r&&r.pago>0) _addCons(r.nome); });
    var _cons=Object.values(_consSet);
    _cons.sort(function(a,b){return String(a).localeCompare(String(b),'pt-BR');});
    /* Para consultor logado: mostra só o card dele */
    var _sessMv=(typeof _getSessao==='function')?_getSessao():null;
    if(_sessMv && _sessMv.perfil==='consultor'){
      var _meuNomeMv=String(_sessMv.nome||_sessMv.login||'').toUpperCase().trim();
      _cons=_cons.filter(function(n){return String(n).toUpperCase().trim()===_meuNomeMv;});
      if(!_cons.length){grid.innerHTML='<div class="np-empty">Nenhuma meta vinculada a você neste mês.</div>';return;}
    } else {
      if(!_cons.length){grid.innerHTML='<div class="np-empty">Nenhum consultor cadastrado em Gestão de Usuários.</div>';return;}
    }
    var COR=window._npCOR||['#c8f05a','#60a5fa','#34d399','#f59e0b','#a78bfa','#f472b6','#fb923c','#38bdf8'];
    /* Helpers de semana (expostos por 11-pipeline-comercial.js) */
    var SEMU = window._npSemUtil || null;
    var semanas = SEMU ? SEMU.semanas() : [];
    var semAtual = SEMU ? SEMU.semanaAtual() : null;
    window._npSemSelV2 = window._npSemSelV2 || {};
    var _rows=_cons.map(function(nome,i){
      var g=window._npGoals[nome]||{};
      var r=ranking.find(function(x){return x.nome===nome;})||{total:0,pago:0,qtd:0,qtdPago:0};
      var real=r.pago; /* apenas status PAGO abate meta */
      var tierInfo=_npGetMetaAtiva(g,real);
      var pct=tierInfo.pct;
      var col=_npGetCol(pct);
      var isSuperMeta=g.metaMaster&&real>=+(g.metaMaster||0)&&+(g.metaMaster||0)>0;
      var cor=COR[i%COR.length];
      var b=+(g.metaBasica||g.metaValor||0);
      var m=+(g.metaMinima||0);
      var M=+(g.metaMaster||0);
      var pctB=b?Math.min(200,Math.round(real/b*100)):0;
      var pctM=m?Math.min(200,Math.round(real/m*100)):0;
      var pctMas=M?Math.min(200,Math.round(real/M*100)):0;
      var nomeJS=String(nome||'').replace(/\\/g,'\\\\').replace(/\x27/g,'\\\x27');

      /* ── Indicador semanal (chip + pace) ── */
      var semChipHtml = '', pacelineHtml = '';
      if(SEMU && semanas.length){
        var semSel = window._npSemSelV2[nome] || semAtual || (semanas[semanas.length-1].num);
        var jSel = semanas.find(function(s){return s.num===semSel;}) || semanas[0];
        var goalsSem = SEMU.goals();
        var mSem = +(((goalsSem[nome])||{})[semSel]||{}).min || 0;
        var fSem = SEMU.faturado(todas, nome, jSel);
        var pctSem = mSem ? Math.round(fSem/mSem*100) : 0;
        var semIco, semLbl, semColor, semBg, semBorder;
        if(!mSem){ semIco='—'; semLbl='SEM META SEM'; semColor='#888'; semBg='rgba(255,255,255,.04)'; semBorder='rgba(255,255,255,.10)'; }
        else if(pctSem >= 100){ semIco='✅'; semLbl='BATEU'; semColor='#86efac'; semBg='rgba(52,211,153,.15)'; semBorder='rgba(52,211,153,.30)'; }
        else if(pctSem >= 60){ semIco='🔥'; semLbl='NO RITMO'; semColor='#f0c896'; semBg='rgba(212,165,116,.15)'; semBorder='rgba(212,165,116,.30)'; }
        else { semIco='⚠'; semLbl='DEVAGAR'; semColor='#fbbf24'; semBg='rgba(245,158,11,.15)'; semBorder='rgba(245,158,11,.30)'; }
        semChipHtml = '<span class="np-status-badge" title="Semana '+semSel+' ('+jSel.iniLabel+'-'+jSel.fimLabel+')" style="background:'+semBg+';color:'+semColor+';border:1px solid '+semBorder+';margin-left:4px;">'+semIco+' '+pctSem+'% S'+semSel+'</span>';
        /* Pace line — usa hoje pra calcular dias úteis restantes; só renderiza se for a semana atual ou se houver meta */
        var dias = SEMU.diasUteisRestantes(jSel);
        var hojeYMD = SEMU.ymd();
        var encerrada = (hojeYMD > jSel.fim);
        if(mSem){
          var paceTxt;
          if(fSem >= mSem){
            paceTxt = '📅 <b>S'+semSel+' ('+jSel.iniLabel+'-'+jSel.fimLabel+'):</b> '+SEMU.fmtR(fSem)+' de <b>'+SEMU.fmtR(mSem)+'</b> · <b>Bateu +'+SEMU.fmtR(fSem-mSem)+'</b> 🏆';
          } else if(encerrada || dias===0){
            paceTxt = '📅 <b>S'+semSel+' ('+jSel.iniLabel+'-'+jSel.fimLabel+'):</b> '+SEMU.fmtR(fSem)+' de <b>'+SEMU.fmtR(mSem)+'</b> · Encerrada';
          } else {
            var falta = Math.max(0, mSem - fSem);
            var ritmo = dias>0 ? Math.round(falta/dias) : 0;
            paceTxt = '📅 <b>S'+semSel+' ('+jSel.iniLabel+'-'+jSel.fimLabel+'):</b> Faltam <b>'+SEMU.fmtR(falta)+'</b> de <b>'+SEMU.fmtR(mSem)+'</b> em <b>'+dias+' dias úteis</b> ('+SEMU.fmtR(ritmo)+'/dia)';
          }
          pacelineHtml = '<div class="np-mc-pace-mini">'+paceTxt+'</div>';
        }
      }

      var cardHtml='<div class="np-meta-card clickable'+(isSuperMeta?' np-super-meta':'')+'" role="button" tabindex="0"'
        +' onclick="npAbrirConsultorDetalhe(\''+nomeJS+'\')"'
        +' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();npAbrirConsultorDetalhe(\''+nomeJS+'\');}"'
        +' style="border-color:'+col.border+';background:'+col.bg+';">'
        /* Header */
        +'<div class="np-meta-header">'
        +'<div class="np-meta-avatar" style="background:'+cor+'22;color:'+cor+';border:1.5px solid '+cor+'55;">'+nome.charAt(0).toUpperCase()+'</div>'
        +'<div style="flex:1;min-width:0;">'
        +'<div class="np-meta-nome">'+_esc2(nome)+'</div>'
        +'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px;">'
        +'<span class="np-status-badge" style="background:'+col.bg+';color:'+col.text+';border:1px solid '+col.border+';">'+col.badge+'</span>'
        + semChipHtml
        +'</div>'
        +'</div>'
        +(isSuperMeta?'<div style="font-size:18px;" title="Super Meta!">🚀</div>':'')
        +'</div>'
        /* Progresso principal */
        +'<div style="margin:10px 0 4px;display:flex;justify-content:space-between;font-size:11px;color:var(--muted);">'
        +'<span>'+_npFmtR2(real)+'</span>'
        +'<span style="font-weight:800;color:'+col.text+';">'+pct+'% — '+tierInfo.label+'</span>'
        +'</div>'
        +'<div class="np-meta-progress" style="height:8px;">'
        +'<div class="np-meta-bar" style="width:'+Math.min(100,pct)+'%;background:'+col.bar+';"></div>'
        +'</div>'
        /* 3 tiers — ordem: MÍNIMA → BÁSICA → MASTER */
        +(b||m||M?
          '<div class="np-meta-tiers" style="margin-top:10px;">'
          +(m?'<div class="np-tier np-tier--minima'+(tierInfo.tier==='minima'?' ativa':'')+'">'
            +'<div class="np-tier-label">🥈 Mínima</div>'
            +'<div class="np-tier-val" style="color:'+(pctM>=100?'#c8f05a':'#ffe000')+';">'+(pctM>=100?'✅ Batida':'<span class="np-tier-val-lbl">Falta</span><span class="np-tier-val-amt">'+_npFmtR(Math.max(0,m-real))+'</span>')+'</div>'
            +'<div class="np-tier-pct">'+pctM+'%</div>'
            +'</div>':'<div class="np-tier np-tier--minima" style="opacity:.3;"><div class="np-tier-label">🥈 Mínima</div><div class="np-tier-val">—</div></div>')
          +(b?'<div class="np-tier np-tier--basica'+(tierInfo.tier==='basica'?' ativa':'')+'">'
            +'<div class="np-tier-label">🥉 Básica</div>'
            +'<div class="np-tier-val" style="color:'+(pctB>=100?'#c8f05a':'#ff5252')+';">'+(pctB>=100?'✅ Batida':'<span class="np-tier-val-lbl">Falta</span><span class="np-tier-val-amt">'+_npFmtR(Math.max(0,b-real))+'</span>')+'</div>'
            +'<div class="np-tier-pct">'+pctB+'%</div>'
            +'</div>':'<div class="np-tier np-tier--basica" style="opacity:.3;"><div class="np-tier-label">🥉 Básica</div><div class="np-tier-val">—</div></div>')
          +(M?'<div class="np-tier np-tier--master'+(tierInfo.tier==='master'?' ativa':'')+'">'
            +'<div class="np-tier-label">🥇 Master</div>'
            +'<div class="np-tier-val" style="color:'+(pctMas>=100?'#c8f05a':'#c8f05a')+';">'+(pctMas>=100?'✅ Batida':'<span class="np-tier-val-lbl">Falta</span><span class="np-tier-val-amt">'+_npFmtR(Math.max(0,M-real))+'</span>')+'</div>'
            +'<div class="np-tier-pct">'+pctMas+'%</div>'
            +'</div>':'<div class="np-tier np-tier--master" style="opacity:.3;"><div class="np-tier-label">🥇 Master</div><div class="np-tier-val">—</div></div>')
          +'</div>'
        :'<div style="font-size:11px;color:var(--muted);margin-top:8px;text-align:center;">Sem metas configuradas</div>')
        /* Pace semanal (linha discreta) */
        + pacelineHtml
        /* Botões */
        +'<div class="np-meta-foot-v2">'
        +'<button class="np-meta-edit" onclick="event.stopPropagation();npAbrirModalMeta(\''+_escJS2(nome)+'\')">⚙ Configurar metas</button>'
        +'<button class="np-meta-edit np-meta-edit-sem" onclick="event.stopPropagation();npAbrirModalSemanal(\''+_escJS2(nome)+'\')" title="Configurar metas semanais">📅 Semanal</button>'
        +'<button class="np-meta-edit np-meta-copy-img" onclick="event.stopPropagation();npCopiarMetaImg(\''+_escJS2(nome)+'\')" title="Copiar imagem do card (só o mês)">📸 Copiar</button>'
        +'<button class="np-meta-edit np-meta-copy-sem" onclick="event.stopPropagation();npCopiarMetaImg(\''+_escJS2(nome)+'\',true)" title="Copiar imagem do card com o bloco da semana">📸📅 c/ semana</button>'
        +'</div>'
        +'</div>';
      return {nome:nome,i:i,cor:cor,real:real,pct:pct,col:col,tier:tierInfo,
              m:m,b:b,M:M,pctM:pctM,pctB:pctB,pctMas:pctMas,card:cardHtml};
    });
    window._npMetasRows=_rows;
    /* Card ou Lista — preferência persistida */
    var _view=window._npMetasView;
    if(!_view){ try{ _view=localStorage.getItem('npMetasView'); }catch(e){} _view=_view||'card'; window._npMetasView=_view; }
    /* Ordenação persistida */
    if(!window._npMetasSort){ try{ var _ss=localStorage.getItem('npMetasSort'); if(_ss) window._npMetasSort=JSON.parse(_ss); }catch(e){} }
    if(typeof _npAtualizarViewToggle==='function') _npAtualizarViewToggle();
    grid.className=(_view==='lista')?'np-metas-lista':'np-metas-grid';
    grid.innerHTML=(_view==='lista')?_npRenderMetasListaHtml(_rows):_rows.map(function(r){return r.card;}).join('');
    if(_view==='lista' && typeof _npMetasAtualizarSelAll==='function') _npMetasAtualizarSelAll();
  }

  /* ── Render Metas em LISTA (Tabela Compacta) ─────────── */
  function _npRenderMetasListaHtml(rows){
    function tcell(falta,pct,hasMeta){
      if(!hasMeta) return '<span style="color:var(--muted);opacity:.45;">—</span>';
      if(pct>=100) return '<span style="color:#c8f05a;font-weight:700;">&#x2705; '+pct+'%</span>';
      return '<span class="np-lista-falta">'+_npFmtR(falta)+'</span> <b class="np-lista-pct">'+pct+'%</b>';
    }
    /* ── Ordenação ── */
    var s=window._npMetasSort||{col:'nome',dir:1};
    rows=rows.slice().sort(function(a,b){
      if(s.col==='nome') return String(a.nome).localeCompare(String(b.nome),'pt-BR')*s.dir;
      var va,vb;
      switch(s.col){
        case 'status': case 'progresso': va=a.pct; vb=b.pct; break;
        case 'faturado': va=a.real; vb=b.real; break;
        case 'minima': va=a.pctM; vb=b.pctM; break;
        case 'basica': va=a.pctB; vb=b.pctB; break;
        case 'master': va=a.pctMas; vb=b.pctMas; break;
        default: va=0; vb=0;
      }
      if(va===vb) return String(a.nome).localeCompare(String(b.nome),'pt-BR');
      return (va-vb)*s.dir;
    });
    function sh(col,label,cls){
      var arr=(s.col===col)?(s.dir>0?' <span class="np-sort-arr">&#x25B2;</span>':' <span class="np-sort-arr">&#x25BC;</span>'):'';
      return '<th'+(cls?' class="'+cls+'"':'')+' onclick="npSortMetasLista(\''+col+'\')" style="cursor:pointer;user-select:none;">'+label+arr+'</th>';
    }
    var sel=window._npMetasSel||{};
    var th='<thead><tr>'
      +'<th class="np-lista-chk-col"><input type="checkbox" id="npListaSelAll" class="np-lista-chk" title="Selecionar todos" onclick="npMetasListaSelAll(this)"></th>'
      +sh('nome','Consultor')
      +sh('status','Status')
      +sh('faturado','Faturado','r')
      +sh('progresso','Progresso')
      +sh('minima','&#x1F948; M\xednima')
      +sh('basica','&#x1F949; B\xe1sica')
      +sh('master','&#x1F947; Master')
      +'<th></th>'
      +'</tr></thead>';
    var body=rows.map(function(r){
      var nm=_escJS2(r.nome);
      var chk=sel[r.nome]?' checked':'';
      return '<tr class="np-lista-row'+(sel[r.nome]?' sel':'')+'" role="button" tabindex="0" onclick="npAbrirConsultorDetalhe(\''+nm+'\')">'
        +'<td class="np-lista-chk-col" onclick="event.stopPropagation();"><input type="checkbox" class="np-lista-chk" data-nome="'+_esc2(r.nome)+'"'+chk+' onclick="event.stopPropagation();npMetasListaSelChange(this)"></td>'
        +'<td><div class="np-lista-id"><span class="np-lista-av" style="background:'+r.cor+'22;color:'+r.cor+';border:1.5px solid '+r.cor+'55;">'+r.nome.charAt(0).toUpperCase()+'</span><span class="np-lista-nome">'+_esc2(r.nome)+'</span></div></td>'
        +'<td><span class="np-status-badge" style="background:'+r.col.bg+';color:'+r.col.text+';border:1px solid '+r.col.border+';">'+r.col.badge+'</span></td>'
        +'<td class="r np-lista-money">'+_npFmtR2(r.real)+'</td>'
        +'<td class="np-lista-prog"><div class="np-lista-prog-top"><span>'+r.tier.label+'</span><b style="color:'+r.col.text+';">'+r.pct+'%</b></div><div class="np-meta-progress" style="height:6px;"><div class="np-meta-bar" style="width:'+Math.min(100,r.pct)+'%;background:'+r.col.bar+';"></div></div></td>'
        +'<td class="np-lista-tier">'+tcell(Math.max(0,r.m-r.real),r.pctM,!!r.m)+'</td>'
        +'<td class="np-lista-tier">'+tcell(Math.max(0,r.b-r.real),r.pctB,!!r.b)+'</td>'
        +'<td class="np-lista-tier">'+tcell(Math.max(0,r.M-r.real),r.pctMas,!!r.M)+'</td>'
        +'<td><div class="np-lista-acts" onclick="event.stopPropagation();">'
          +'<button class="np-meta-edit" title="Configurar metas" onclick="event.stopPropagation();npAbrirModalMeta(\''+nm+'\')">&#x2699;</button>'
          +'<button class="np-meta-edit np-meta-edit-sem" title="Metas semanais" onclick="event.stopPropagation();npAbrirModalSemanal(\''+nm+'\')">&#x1F4C5;</button>'
          +'<button class="np-meta-edit np-meta-copy-img" title="Copiar imagem do card (só o mês)" onclick="event.stopPropagation();npCopiarMetaImg(\''+nm+'\')">&#x1F4F8;</button>'
          +'<button class="np-meta-edit np-meta-copy-sem" title="Copiar imagem com o bloco da semana" onclick="event.stopPropagation();npCopiarMetaImg(\''+nm+'\',true)">&#x1F4F8;&#x1F4C5;</button>'
        +'</div></td>'
        +'</tr>';
    }).join('');
    var hasSel=false; for(var _k in sel){ if(sel[_k]){ hasSel=true; break; } }
    return '<table class="np-metas-table">'+th+'<tbody>'+body+'</tbody></table>'
      +'<div class="np-lista-soma'+(hasSel?' on':'')+'" id="npListaSoma">'+_npSomaHtml()+'</div>';
  }

  /* Conteúdo da barra de soma do faturado dos selecionados */
  function _npSomaHtml(){
    var sel=window._npMetasSel||{};
    var rows=window._npMetasRows||[];
    var n=0, soma=0;
    rows.forEach(function(r){ if(sel[r.nome]){ n++; soma+=r.real; } });
    if(n===0) return '<span class="np-soma-hint">&#x2611;&#xFE0F; Marque consultores para somar o faturado</span>';
    return '<span class="np-soma-cnt"><b>'+n+'</b> selecionado'+(n>1?'s':'')+'</span>'
      +'<span class="np-soma-val">Faturado somado: <b>'+_npFmtR2(soma)+'</b></span>'
      +'<button type="button" class="np-soma-clear" onclick="npMetasListaLimparSel()">Limpar</button>';
  }

  function _npMetasAtualizarSoma(){
    var el=document.getElementById('npListaSoma'); if(!el) return;
    var sel=window._npMetasSel||{}, has=false;
    for(var k in sel){ if(sel[k]){ has=true; break; } }
    el.className='np-lista-soma'+(has?' on':'');
    el.innerHTML=_npSomaHtml();
  }

  function _npMetasAtualizarSelAll(){
    var sa=document.getElementById('npListaSelAll'); if(!sa) return;
    var all=document.querySelectorAll('.np-lista-row .np-lista-chk');
    var marc=document.querySelectorAll('.np-lista-row .np-lista-chk:checked');
    sa.checked=all.length>0 && marc.length===all.length;
    sa.indeterminate=marc.length>0 && marc.length<all.length;
  }

  window.npMetasListaSelChange=function(cb){
    window._npMetasSel=window._npMetasSel||{};
    var nome=cb?cb.getAttribute('data-nome'):null;
    if(nome!=null){ if(cb.checked) window._npMetasSel[nome]=true; else delete window._npMetasSel[nome]; }
    var tr=cb?cb.closest('tr'):null; if(tr) tr.classList.toggle('sel', !!(cb&&cb.checked));
    _npMetasAtualizarSoma();
    _npMetasAtualizarSelAll();
  };

  window.npMetasListaSelAll=function(cb){
    window._npMetasSel=window._npMetasSel||{};
    var rows=window._npMetasRows||[];
    document.querySelectorAll('.np-lista-row .np-lista-chk').forEach(function(c){
      c.checked=cb.checked;
      var tr=c.closest('tr'); if(tr) tr.classList.toggle('sel', cb.checked);
    });
    rows.forEach(function(r){ if(cb.checked) window._npMetasSel[r.nome]=true; else delete window._npMetasSel[r.nome]; });
    _npMetasAtualizarSoma();
  };

  window.npMetasListaLimparSel=function(){
    window._npMetasSel={};
    document.querySelectorAll('.np-lista-row .np-lista-chk').forEach(function(c){
      c.checked=false; var tr=c.closest('tr'); if(tr) tr.classList.remove('sel');
    });
    var sa=document.getElementById('npListaSelAll'); if(sa){ sa.checked=false; sa.indeterminate=false; }
    _npMetasAtualizarSoma();
  };

  function _npAtualizarViewToggle(){
    var view=window._npMetasView||'card';
    var bc=document.getElementById('npViewCard'), bl=document.getElementById('npViewLista');
    if(!bc||!bl) return;
    function on(b){ b.style.background='rgba(56,189,248,.16)'; b.style.color='#38bdf8'; }
    function off(b){ b.style.background='none'; b.style.color='var(--muted)'; }
    if(view==='lista'){ on(bl); off(bc); } else { on(bc); off(bl); }
  }

  window.npToggleMetasView=function(view){
    window._npMetasView=view;
    try{ localStorage.setItem('npMetasView',view); }catch(e){}
    _npAtualizarViewToggle();
    var grid=document.getElementById('npMetasGrid');
    var rows=window._npMetasRows;
    if(!grid||!rows){ if(window._npRenderTudo) window._npRenderTudo(); return; }
    grid.className=(view==='lista')?'np-metas-lista':'np-metas-grid';
    grid.innerHTML=(view==='lista')?_npRenderMetasListaHtml(rows):rows.map(function(r){return r.card;}).join('');
    if(view==='lista') _npMetasAtualizarSelAll();
  };

  window.npSortMetasLista=function(col){
    var s=window._npMetasSort||{col:'nome',dir:1};
    if(s.col===col){ s.dir=-s.dir; }
    else { s.col=col; s.dir=(col==='nome')?1:-1; }  /* numéricos começam decrescente */
    window._npMetasSort=s;
    try{ localStorage.setItem('npMetasSort',JSON.stringify(s)); }catch(e){}
    var grid=document.getElementById('npMetasGrid');
    var rows=window._npMetasRows;
    if(grid&&rows){ grid.innerHTML=_npRenderMetasListaHtml(rows); _npMetasAtualizarSelAll(); }
  };

  /* ── Status strip no dashboard ───────────────────────── */
  function _npRenderStatusStrip(todas){
    var el=document.getElementById('npStatusStrip');if(!el) return;
    if(_npVendasTurma.length===0&&Object.keys(_npVendasAvulso||{}).length===0){
      el.innerHTML='';return;
    }
    var _cons=window._npConsultores||[];
    var _goals=window._npGoals||{};
    var ranking=typeof window._npPorConsultor==='function'?window._npPorConsultor(todas,'','pago'):[];
    var buckets={c0:0,c25:0,c50:0,c75:0,c100:0};
    _cons.forEach(function(nome){
      var g=_goals[nome]||{};
      var r=(ranking.find(function(x){return x.nome===nome;})||{}).pago||0; /* só PAGO */
      var t=_npGetMetaAtiva(g,r);
      if(!t.meta) return;
      var col=_npGetCol(t.pct);
      buckets[col.cls]=(buckets[col.cls]||0)+1;
    });
    var defs=[
      {cls:'c0',  label:'Crítico',      cor:'#ff1744',bg:'rgba(255,23,68,.07)',border:'rgba(255,23,68,.25)'},
      {cls:'c25', label:'Atenção',      cor:'#ff5500',bg:'rgba(255,85,0,.07)',border:'rgba(255,85,0,.25)'},
      {cls:'c50', label:'Em progresso', cor:'#ffe000',bg:'rgba(255,238,0,.07)',border:'rgba(255,238,0,.25)'},
      {cls:'c75', label:'Quase lá!',    cor:'#00f0ff',bg:'rgba(0,240,255,.07)',border:'rgba(0,240,255,.25)'},
      {cls:'c100',label:'Meta atingida',cor:'#c8f05a',bg:'rgba(200,240,90,.07)',border:'rgba(200,240,90,.25)'},
    ];
    el.innerHTML=defs.map(function(d){
      var n=buckets[d.cls]||0;
      return '<div class="np-ss-card" style="background:'+d.bg+';border-color:'+d.border+';">'
        +'<div class="np-ss-num" style="color:'+d.cor+';">'+n+'</div>'
        +'<div class="np-ss-label" style="color:'+d.cor+';">'+d.label+'</div>'
        +'</div>';
    }).join('');
  }

  /* ── Ranking com % meta ──────────────────────────────── */
  window.npRenderRanking=function(){
    var filtroSrc=(document.getElementById('npRankFiltro')||{}).value||'';
    var sortBy=(document.getElementById('npRankSort')||{}).value||'pago';
    var todas=typeof window._npTodasVendas==='function'?window._npTodasVendas():[];
    var ranking=typeof window._npPorConsultor==='function'?window._npPorConsultor(todas,filtroSrc,'pago'):[];
    var el=document.getElementById('npRankingList');
    var kpisEl=document.getElementById('npRankKpis');
    if(!el) return;
    if(!ranking.length){
      el.innerHTML='<div class="np-empty">Sem dados neste período.</div>';
      if(kpisEl) kpisEl.innerHTML='';
      return;
    }
    var COR=window._npCOR||['#c8f05a','#60a5fa','#34d399','#f59e0b','#a78bfa','#f472b6','#fb923c','#38bdf8'];
    var _goals=window._npGoals||{};
    var medalBorder=['#fbbf24','#c0c0c0','#cd7f32'];

    ranking.forEach(function(r){
      /* PROGRESSIVO — mesma lógica do top 3 do dashboard:
         Mínima -> Básica -> Master. Mostra o próximo alvo a perseguir. */
      var g=_goals[r.nome]||{};
      var px=_npProxTier(g, r.pago);
      var pct=(px.meta>0)?Math.round(r.pago/px.meta*100):0;
      r._tier={
        meta: px.meta,
        label: px.label,
        falta: px.falta,
        batida: px.batida,
        pct: pct
      };
      r._col=_npGetCol(pct);
      r._conv=r.qtd?Math.round(r.qtdPago/r.qtd*100):0;
      r._ticket=r.qtdPago?Math.round(r.pago/r.qtdPago):0;
    });

    ranking=ranking.slice().sort(function(a,b){
      if(sortBy==='pct'){
        var pa=a._tier.pct||0,pb=b._tier.pct||0;
        if(pb!==pa) return pb-pa;
        return b.pago-a.pago;
      }
      if(sortBy==='total') return b.total-a.total;
      if(sortBy==='qtd') return b.qtd-a.qtd;
      return b.pago-a.pago;
    });

    if(kpisEl){
      var totPago=ranking.reduce(function(acc,r){return acc+r.pago;},0);
      var totPot=ranking.reduce(function(acc,r){return acc+r.total;},0);
      var totPagoN=ranking.reduce(function(acc,r){return acc+r.qtdPago;},0);
      var totQtd=ranking.reduce(function(acc,r){return acc+r.qtd;},0);
      var convG=totQtd?Math.round(totPagoN/totQtd*100):0;
      /* "Na meta" = bateu pelo menos a Básica (ou Master). Não conta só a Mínima. */
      var naMeta=ranking.filter(function(r){
        var b=r._tier&&r._tier.batida;
        return b==='basica'||b==='master';
      }).length;
      kpisEl.innerHTML='<div class="np-rank-kpis">'
        +'<div class="np-rank-kpi"><div class="np-rank-kpi-v">'+_npFmtR2(totPago)+'</div><div class="np-rank-kpi-l">Faturado</div></div>'
        +'<div class="np-rank-kpi"><div class="np-rank-kpi-v">'+_npFmtR2(totPot)+'</div><div class="np-rank-kpi-l">Potencial</div></div>'
        +'<div class="np-rank-kpi"><div class="np-rank-kpi-v">'+convG+'%</div><div class="np-rank-kpi-l">Conversão</div></div>'
        +'<div class="np-rank-kpi"><div class="np-rank-kpi-v">'+naMeta+' / '+ranking.length+'</div><div class="np-rank-kpi-l">Na meta</div></div>'
        +'</div>';
    }

    var medalhas=['🥇','🥈','🥉'];
    el.innerHTML=ranking.map(function(r,i){
      var cor=COR[i%COR.length];
      var col=r._col;
      var t=r._tier;
      var barW=t.pct!==null?Math.min(t.pct,100):0;
      var accentBorder=i<3?'border-left:3px solid '+medalBorder[i]+';':'';
      /* Tag de progresso PROGRESSIVO: "Faltam R$X para 🥈 Mínima" / 🥉 Básica / 🥇 Master,
         ou "✅ Master batida (+R$ X)" se já passou de todas. */
      var gap='';
      if(t.batida==='master'){
        gap='✅ Master batida (+'+_npFmtR(r.pago-t.meta)+')';
      } else if(t.meta>0 && t.falta>0){
        gap='Faltam '+_npFmtR(t.falta)+' p/ '+t.label;
      }
      var pctBadge=t.meta
        ?'<span class="np-ri-pct-badge" style="background:'+col.bg+';color:'+col.text+';border:1px solid '+col.border+';">'+t.pct+'%</span>'
        :'';
      var potHtml=r.total>0
        ?'<span class="np-ri-val-sub">pot. '+_npFmtR2(r.total)+'</span>'
        :'';
      return '<div class="np-ranking-item" style="'+accentBorder+'border-color:'+col.border+';background:'+col.bg+';">'
        /* posição */
        +'<div class="np-ri-pos">'+(medalhas[i]||'<span style="font-size:13px;font-weight:700;">'+(i+1)+'°</span>')+'</div>'
        /* avatar */
        +'<div class="np-ri-avatar" style="background:'+cor+'22;color:'+cor+';border:1.5px solid '+cor+'55;">'+r.nome.charAt(0).toUpperCase()+'</div>'
        /* info central */
        +'<div class="np-ri-info">'
          +'<div class="np-ri-nome">'+_esc2(r.nome)+'</div>'
          +(t.meta?'<div class="np-ri-bar"><div class="np-ri-bar-fill" style="width:'+barW+'%;background:'+col.bar+';"></div></div>':'')
          +'<div class="np-ri-tags">'
            +'<span class="np-ri-tier" style="color:'+col.text+';border-color:'+col.border+';">'+t.label+'</span>'
            +pctBadge
            +(gap?'<span class="np-ri-badge">'+(t.batida==='master'?'':'⏳ ')+gap+'</span>':'')
            +'<span class="np-ri-badge">'+r.qtdPago+'/'+r.qtd+' pago'+(r.qtdPago!==1?'s':'')+'</span>'
            +'<span class="np-ri-badge">'+r._conv+'% conv</span>'
            +(r._ticket?'<span class="np-ri-badge">tkt '+_npFmtR(r._ticket)+'</span>':'')
          +'</div>'
        +'</div>'
        /* valores */
        +'<div class="np-ri-vals">'
          +'<div class="np-ri-val" style="color:'+col.text+';">'+_npFmtR2(r.pago)+'</div>'
          +potHtml
        +'</div>'
        +'</div>';
    }).join('');
  };

  /* ── Hooks: interceptar _npRenderTudo para usar V2 ────── */
  var _origRenderTudo=window._npRenderTudo;
  window._npRenderTudo=function(){
    if(!window._npAtivo) return;
    if(typeof window._npRenderLabel==='function') window._npRenderLabel();
    if(typeof window._npColetarConsultores==='function') window._npColetarConsultores();
    if(typeof window._npPopularFiltros==='function') window._npPopularFiltros();
    var todas=typeof window._npTodasVendas==='function'?window._npTodasVendas():[];
    var tab=window._npTabAtiva||'dashboard';
    if(tab==='dashboard'){
      if(typeof window._npRenderDashboard==='function') window._npRenderDashboard(todas);
      _npRenderStatusStrip(todas);
    } else if(tab==='vendas'){
      if(typeof window.npRenderVendas==='function') window.npRenderVendas();
    } else if(tab==='metas'){
      _npRenderMetasV2(todas);
    } else if(tab==='ranking'){
      window.npRenderRanking();
    }
  };

  /* Expor _npRenderMetasV2 como override — garante que _npRenderTudo interno use a versão com tiers */
  window._npRenderMetasOverride=_npRenderMetasV2;

  /* Hook npShowTab para usar _npRenderMetasV2 na aba metas */
  var _origShowTab=window.npShowTab;
  window.npShowTab=function(tab){
    window._npTabAtiva=tab;
    /* Classe no body para CSS (ex: ocultar campo busca fora do funil) */
    document.body.classList.remove('tab-dashboard','tab-vendas','tab-metas','tab-ranking','tab-funil');
    document.body.classList.add('tab-'+tab);
    /* Limpar busca ao sair do funil */
    if(tab!=='funil'){
      var _si=document.getElementById('fnlSearch');
      if(_si) _si.value='';
      if(typeof window._fnlBuscaFechar==='function') window._fnlBuscaFechar();
    }
    document.querySelectorAll('.np-tab').forEach(function(b){
      b.classList.toggle('ativo',b.dataset.tab===tab);
    });
    document.querySelectorAll('.np-body').forEach(function(b){
      b.classList.toggle('ativo',b.id==='npTab'+tab.charAt(0).toUpperCase()+tab.slice(1));
    });
    var todas=typeof window._npTodasVendas==='function'?window._npTodasVendas():[];
    if(tab==='dashboard'){
      if(typeof window._npRenderDashboard==='function') window._npRenderDashboard(todas);
      _npRenderStatusStrip(todas);
    } else if(tab==='vendas'){
      if(typeof window.npRenderVendas==='function') window.npRenderVendas();
    } else if(tab==='metas'){
      _npRenderMetasV2(todas);
    } else if(tab==='ranking'){
      window.npRenderRanking();
    } else if(tab==='funil'){
      if(typeof window._fnlRender==='function') window._fnlRender();
    }
  };

  /* Expor _npGetCol e _npGetMetaAtiva globalmente */
  window._npGetCol=_npGetCol;
  window._npGetMetaAtiva=_npGetMetaAtiva;
  window._npCOR=['#c8f05a','#60a5fa','#34d399','#f59e0b','#a78bfa','#f472b6','#fb923c','#38bdf8'];

  /* ── Copiar card do consultor como imagem (Canvas) ─── */
  function _npRRect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.min(w, h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function _npToastCopy(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(0);background:#1c2128;color:#c8f05a;border:1px solid rgba(200,240,90,.35);border-radius:8px;padding:10px 22px;font-size:13px;font-weight:600;z-index:99999;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,.5);font-family:inherit;';
    document.body.appendChild(t);
    setTimeout(function() { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function() { t.remove(); }, 350); }, 1900);
  }

  function _npDownloadMetaImg(blob, nome) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'meta-' + String(nome).toLowerCase().replace(/\s+/g, '-') + '.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1200);
    _npToastCopy('⬇ Imagem salva!');
  }

  /* comSemanal=true → acrescenta o bloco "📅 SEMANA N" no rodapé (layout B) */
  window.npCopiarMetaImg = function(nome, comSemanal) {
    var g    = window._npGoals[nome] || {};
    var todas = typeof window._npTodasVendas === 'function' ? window._npTodasVendas() : [];
    var rank  = typeof window._npPorConsultor === 'function' ? window._npPorConsultor(todas, '', 'pago') : [];
    var r    = rank.find(function(x) { return x.nome === nome; }) || { pago: 0 };
    var real = r.pago;

    var b    = +(g.metaBasica || g.metaValor || 0);
    var m    = +(g.metaMinima || 0);
    var M    = +(g.metaMaster || 0);
    var pctM   = m ? Math.min(999, Math.round(real / m   * 100)) : 0;
    var pctB   = b ? Math.min(999, Math.round(real / b   * 100)) : 0;
    var pctMas = M ? Math.min(999, Math.round(real / M   * 100)) : 0;

    var MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    var now   = new Date();
    var mesAno = MESES[now.getMonth()].toUpperCase() + '/' + now.getFullYear();

    /* dias úteis restantes no mês (seg-sex, a partir de hoje inclusive) */
    var dias = (function() {
      var hoje = new Date(); hoje.setHours(0,0,0,0);
      var ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0); ultimo.setHours(0,0,0,0);
      var cnt = 0;
      for (var d = new Date(hoje); d <= ultimo; d.setDate(d.getDate() + 1)) {
        var dow = d.getDay(); if (dow >= 1 && dow <= 5) cnt++;
      }
      return cnt;
    })();

    var tiers = [
      { ico: '🥈', lbl: 'Mínima', val: m,   pct: pctM,   col: '#5b7fa6', falta: Math.max(0, m - real) },
      { ico: '🥉', lbl: 'Básica', val: b,   pct: pctB,   col: '#c47d0a', falta: Math.max(0, b - real) },
      { ico: '🥇', lbl: 'Master',       val: M,   pct: pctMas, col: '#b8960a', falta: Math.max(0, M - real) }
    ];
    var pending = tiers.filter(function(t) { return t.val > 0 && t.pct < 100; });
    var configured = tiers.filter(function(t) { return t.val > 0; });

    /* ── Dados da semana (só no botão "Copiar c/ semana") ──
       Mesma semana que o card da tela está mostrando (_npSemSelV2),
       caindo pra semana atual / última do mês quando não há escolha. */
    var sem = null;
    var SEMU = window._npSemUtil || null;
    if (comSemanal && SEMU) {
      var _semanas = SEMU.semanas() || [];
      if (_semanas.length) {
        var _semSel = (window._npSemSelV2 || {})[nome] || SEMU.semanaAtual() || _semanas[_semanas.length - 1].num;
        var _jan = _semanas.find(function(s) { return s.num === _semSel; }) || _semanas[0];
        var _gs  = (((SEMU.goals() || {})[nome]) || {})[_jan.num] || {};
        var _fatSem = SEMU.faturado(todas, nome, _jan);
        var _semTiers = [
          { ico: '🥈', lbl: 'Mínima', val: +(_gs.min || 0) },
          { ico: '🥉', lbl: 'Básica', val: +(_gs.bas || 0) },
          { ico: '🥇', lbl: 'Master', val: +(_gs.mas || 0) }
        ];
        _semTiers.forEach(function(t) {
          t.pct   = t.val ? Math.min(999, Math.round(_fatSem / t.val * 100)) : 0;
          t.falta = Math.max(0, t.val - _fatSem);
        });
        sem = {
          jan:  _jan,
          fat:  _fatSem,
          dias: SEMU.diasUteisRestantes(_jan),
          cfg:  _semTiers.filter(function(t) { return t.val > 0; }),
          pend: _semTiers.filter(function(t) { return t.val > 0 && t.pct < 100; })
        };
      }
    }

    /* ── Canvas · Layout Dark Gradient ── */
    var W = 520;
    var bandRows = pending.length > 0 ? pending.length : 1;
    var Hbase = 54 + 14 + (configured.length * 36) + 20 + (bandRows * 24) + 14;
    if (Hbase < 230) Hbase = 230;
    var extraSem = sem ? (38 + (sem.pend.length || 1) * 24) : 0;
    var H = Hbase + extraSem;
    var DPR = 2, px = 20;
    var cv = document.createElement('canvas');
    cv.width = W * DPR; cv.height = H * DPR;
    var ctx = cv.getContext('2d');
    ctx.scale(DPR, DPR);
    var SAN = 'system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';

    function barH(x, y, w, h, pct, fill) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; _npRRect(ctx, x, y, w, h, h / 2); ctx.fill();
      if (pct > 0) {
        ctx.fillStyle = fill;
        _npRRect(ctx, x, y, Math.max(h, w * Math.min(pct, 100) / 100), h, h / 2); ctx.fill();
      }
    }
    function lnH(y, x0, x1, col) {
      ctx.strokeStyle = col || 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    }

    /* fundo escuro */
    ctx.fillStyle = '#080e18'; ctx.fillRect(0, 0, W, H);

    /* header com gradiente lateral azul */
    var gh = ctx.createLinearGradient(0, 0, W, 0);
    gh.addColorStop(0, 'rgba(56,189,248,0.18)'); gh.addColorStop(1, 'rgba(56,189,248,0.0)');
    ctx.fillStyle = gh; ctx.fillRect(0, 0, W, 54);
    lnH(54, 0, W, 'rgba(56,189,248,0.3)');
    ctx.font = '700 16px ' + SAN; ctx.fillStyle = '#e6edf3'; ctx.textBaseline = 'middle';
    ctx.fillText(nome, px, 27);
    ctx.font = '500 10px ' + SAN; ctx.fillStyle = '#636e7b'; ctx.textAlign = 'right';
    ctx.fillText(mesAno, W - px, 18);
    ctx.font = '700 14px ' + SAN; ctx.fillStyle = '#56d364';
    ctx.fillText(_npFmtR(real), W - px, 36);
    ctx.textAlign = 'left';

    /* tiers com faixa de cor e gradiente */
    var y = 68;
    tiers.forEach(function(t) {
      if (!t.val) return;
      var done = t.pct >= 100;
      var ac = done ? '#56d364' : t.col;
      /* fundo sutil da linha */
      ctx.fillStyle = done ? 'rgba(86,211,100,0.06)' : 'rgba(255,255,255,0.03)';
      _npRRect(ctx, px - 4, y - 14, W - px * 2 + 8, 32, 6); ctx.fill();
      /* borda esquerda com gradiente */
      var bg2 = ctx.createLinearGradient(0, y - 14, 0, y + 18);
      bg2.addColorStop(0, ac); bg2.addColorStop(1, 'transparent');
      ctx.fillStyle = bg2; ctx.fillRect(px - 4, y - 14, 3, 32);
      /* nome */
      ctx.font = '13px ' + SAN; ctx.fillStyle = done ? '#56d364' : '#e6edf3'; ctx.textBaseline = 'middle';
      ctx.fillText(t.ico + ' ' + t.lbl, px + 6, y);
      /* valor completo */
      ctx.font = '500 10px ' + SAN; ctx.fillStyle = '#8b949e';
      ctx.fillText(_npFmtR(t.val), px + 88, y);
      /* barra (encurtada p/ não cobrir o %) */
      barH(px + 196, y - 5, 132, 10, t.pct, done ? '#56d364' : t.col);
      /* % — alinhado à direita, com folga após a barra */
      ctx.font = '700 11px ' + SAN; ctx.fillStyle = done ? '#56d364' : '#f0b429';
      ctx.textAlign = 'right'; ctx.fillText(t.pct + '%', px + 388, y); ctx.textAlign = 'left';
      /* badge ou ícone — encostado à direita */
      if (done) {
        var bx = px + 416, by = y - 8, bw = 64, bh = 16;
        ctx.fillStyle = 'rgba(86,211,100,0.15)'; _npRRect(ctx, bx, by, bw, bh, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(86,211,100,0.4)'; ctx.lineWidth = 1; _npRRect(ctx, bx, by, bw, bh, 4); ctx.stroke();
        ctx.font = '700 9px ' + SAN; ctx.fillStyle = '#56d364';
        ctx.textAlign = 'center'; ctx.fillText('✅ BATIDA', bx + bw / 2, y + 0.5); ctx.textAlign = 'left';
      } else {
        ctx.font = '9px ' + SAN; ctx.fillStyle = '#f0b429';
        ctx.textAlign = 'center'; ctx.fillText('⏳', px + 448, y); ctx.textAlign = 'left';
      }
      y += 36;
    });

    /* separador + seção ⚡ Para bater a meta */
    lnH(y + 2, px, W - px, 'rgba(245,158,11,0.2)');
    var bandY = y + 14;
    ctx.font = '700 11px ' + SAN; ctx.fillStyle = '#f59e0b'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡ PARA BATER A META', px, bandY);
    ctx.font = '500 10px ' + SAN; ctx.fillStyle = '#636e7b';
    ctx.fillText('· ' + dias + (dias === 1 ? ' dia útil restante' : ' dias úteis restantes'), px + 166, bandY);
    bandY += 22;

    if (pending.length === 0) {
      ctx.font = '700 13px ' + SAN; ctx.fillStyle = '#56d364';
      ctx.textAlign = 'center'; ctx.fillText('🚀 Todas as metas batidas! Parabéns!', W / 2, bandY + 4); ctx.textAlign = 'left';
    } else {
      pending.forEach(function(p) {
        var ritmo = dias > 0 ? Math.round(p.falta / dias) : 0;
        ctx.font = '12px ' + SAN; ctx.fillStyle = '#e6edf3'; ctx.textBaseline = 'middle';
        ctx.fillText(p.ico + ' ' + p.lbl, px, bandY);
        ctx.font = '500 10px ' + SAN; ctx.fillStyle = '#636e7b';
        ctx.fillText('faltam', px + 82, bandY);
        ctx.font = '700 12px ' + SAN; ctx.fillStyle = '#e3b341';
        ctx.fillText(_npFmtR(p.falta), px + 124, bandY);
        var pw = 120, ph = 18, ppx = W - px - pw;
        ctx.fillStyle = 'rgba(245,158,11,0.15)'; _npRRect(ctx, ppx, bandY - ph / 2, pw, ph, 5); ctx.fill();
        ctx.font = '700 10px ' + SAN; ctx.fillStyle = '#f59e0b';
        ctx.textAlign = 'center'; ctx.fillText(_npFmtR(ritmo) + ' / dia', ppx + pw / 2, bandY + 0.5); ctx.textAlign = 'left';
        bandY += 24;
      });
    }

    /* ── Bloco 📅 SEMANA N (layout B) — mesma estética da banda acima, em azul ── */
    if (sem) {
      var yb = Hbase;
      lnH(yb + 2, px, W - px, 'rgba(56,189,248,0.25)');
      ctx.font = '700 11px ' + SAN; ctx.fillStyle = '#38bdf8'; ctx.textBaseline = 'middle';
      ctx.fillText('📅 SEMANA ' + sem.jan.num + ' (' + sem.jan.iniLabel + '–' + sem.jan.fimLabel + ')', px, yb + 18);
      ctx.font = '500 10px ' + SAN; ctx.fillStyle = '#636e7b'; ctx.textAlign = 'right';
      ctx.fillText('· ' + sem.dias + (sem.dias === 1 ? ' dia útil' : ' dias úteis') + ' · faturado ' + _npFmtR(sem.fat), W - px, yb + 18);
      ctx.textAlign = 'left';
      var yS = yb + 40;
      if (!sem.cfg.length) {
        ctx.font = '500 11px ' + SAN; ctx.fillStyle = '#636e7b';
        ctx.textAlign = 'center'; ctx.fillText('Sem meta semanal configurada', W / 2, yS); ctx.textAlign = 'left';
      } else if (!sem.pend.length) {
        ctx.font = '700 12px ' + SAN; ctx.fillStyle = '#56d364';
        ctx.textAlign = 'center';
        ctx.fillText('🏆 Semana batida! +' + _npFmtR(sem.fat - sem.cfg[sem.cfg.length - 1].val), W / 2, yS);
        ctx.textAlign = 'left';
      } else {
        sem.pend.forEach(function(p) {
          var ritmoS = sem.dias > 0 ? Math.round(p.falta / sem.dias) : 0;
          ctx.font = '12px ' + SAN; ctx.fillStyle = '#e6edf3'; ctx.textBaseline = 'middle';
          ctx.fillText(p.ico + ' ' + p.lbl, px, yS);
          ctx.font = '500 10px ' + SAN; ctx.fillStyle = '#636e7b';
          ctx.fillText('faltam', px + 82, yS);
          ctx.font = '700 12px ' + SAN; ctx.fillStyle = '#7cc4f5';
          ctx.fillText(_npFmtR(p.falta), px + 124, yS);
          var pwS = 120, phS = 18, ppxS = W - px - pwS;
          ctx.fillStyle = 'rgba(56,189,248,0.14)'; _npRRect(ctx, ppxS, yS - phS / 2, pwS, phS, 5); ctx.fill();
          ctx.font = '700 10px ' + SAN; ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center'; ctx.fillText(_npFmtR(ritmoS) + ' / dia', ppxS + pwS / 2, yS + 0.5); ctx.textAlign = 'left';
          yS += 24;
        });
      }
    }

    /* cópia */
    cv.toBlob(function(blob) {
      if (!blob) return;
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          .then(function() { _npToastCopy('📋 Imagem copiada!'); })
          .catch(function() { _npDownloadMetaImg(blob, nome + (sem ? ' semana' : '')); });
      } else {
        _npDownloadMetaImg(blob, nome + (sem ? ' semana' : ''));
      }
    }, 'image/png');
  };

  /* debug log removido */
})();

