/* ═══════════════════════════════════════════════════════════
   UTILS — helpers compartilhados
   ──────────────────────────────────────────────────────────
   Mantenha este arquivo MUITO enxuto. Coloque aqui apenas funções
   puras, sem dependências, reutilizadas em vários módulos.
   ──────────────────────────────────────────────────────────
   Já disponíveis globalmente em outros lugares:
     - window.fmtMoney(v, mode)   →  02-main.js (canônica)
     - formatVal(v)               →  02-main.js   (= fmtMoney(v,'display'))
     - parseVal(s)                →  02-main.js   (= fmtMoney(s,'parse'))
     - formatDate(iso)            →  02-main.js   (yyyy-mm-dd → dd/mm/yyyy)

   Centralizado aqui:
     - window._esc(s)             →  HTML-escape (versão completa, com ')
     - window._escJs(s)           →  Escape para string JS literal
═══════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* HTML-escape — versão completa. Escapa também aspas simples para uso
     seguro em atributos HTML (onclick='...', title='...'). */
  if(!window._esc){
    window._esc = function(s){
      return String(s==null?'':s)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
    };
  }

  /* Escape para uso em string JS literal (ex: gerar onclick="fn('NAME')") */
  if(!window._escJs){
    window._escJs = function(s){
      return String(s==null?'':s)
        .replace(/\\/g,'\\\\')
        .replace(/'/g,"\\'");
    };
  }

  /* ── Tratamento centralizado de erros ──────────────────────
     Padrão recomendado para novos catches:

       fbGet(...).then(...).catch(function(e){ window._err('contexto', e); });

     - _err     → console.warn + toast vermelho (quando _showToast disponível)
     - _errSilent → apenas console.warn (para erros já tratados na UI)

     Comportamento defensivo: nunca lança. Recebe contexto pra
     facilitar debug.
  ──────────────────────────────────────────────────────────── */
  if(!window._err){
    window._err = function(ctx, err){
      try{ console.warn('['+ctx+']', err); }catch(_){}
      if(typeof window._showToast === 'function'){
        var msg = (err && err.message) ? err.message : (typeof err === 'string' ? err : 'Erro inesperado');
        try{ window._showToast('❌ '+ctx+': '+msg, 'var(--red)'); }catch(_){}
      }
    };
  }
  if(!window._errSilent){
    window._errSilent = function(ctx, err){
      try{ console.warn('['+ctx+']', err); }catch(_){}
    };
  }

  /* ── Debug log condicional ──────────────────────────────────
     Substitui console.log direto. Só imprime se:
       localStorage.setItem('DEBUG','1')
     em produção fica silencioso. Para erros reais, use _err.
  ──────────────────────────────────────────────────────────── */
  var _DEBUG = false;
  try{ _DEBUG = localStorage.getItem('DEBUG') === '1'; }catch(_){}
  if(!window._log){
    window._log = function(){
      if(!_DEBUG) return;
      try{ console.log.apply(console, arguments); }catch(_){}
    };
  }
  /* Helper para ligar/desligar via console:
       _setDebug(true) | _setDebug(false)  */
  if(!window._setDebug){
    window._setDebug = function(on){
      _DEBUG = !!on;
      try{
        if(on) localStorage.setItem('DEBUG','1');
        else localStorage.removeItem('DEBUG');
        console.info('[utils] DEBUG =', _DEBUG);
      }catch(_){}
    };
  }

  /* ── Lazy-load de libs externas ─────────────────────────────
     Injeta scripts CDN sob demanda. Promise singleton: várias
     chamadas no início concorrentes vão esperar a mesma carga.
  ──────────────────────────────────────────────────────────── */
  function _injectScript(src){
    return new Promise(function(resolve,reject){
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function(){ resolve(); };
      s.onerror = function(e){ reject(e); };
      document.head.appendChild(s);
    });
  }

  /* XLSX (SheetJS) — usado em Importação de planilhas */
  var _xlsxPromise = null;
  if(!window._ensureXLSX){
    window._ensureXLSX = function(){
      if(typeof XLSX !== 'undefined') return Promise.resolve();
      if(_xlsxPromise) return _xlsxPromise;
      _xlsxPromise = _injectScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      _xlsxPromise.catch(function(){ _xlsxPromise = null; });
      return _xlsxPromise;
    };
  }

  /* jsPDF + autotable — usado em PDFs (clientes, propostas, consultor) */
  var _jspdfPromise = null;
  if(!window._ensureJsPDF){
    window._ensureJsPDF = function(){
      if(typeof window.jspdf !== 'undefined') return Promise.resolve();
      if(_jspdfPromise) return _jspdfPromise;
      _jspdfPromise = _injectScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
        .then(function(){ return _injectScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js'); });
      _jspdfPromise.catch(function(){ _jspdfPromise = null; });
      return _jspdfPromise;
    };
  }

  /* ── Google Sheets sem CORS (JSONP via gviz) ──────────────────────────
     Os endpoints de CSV do Google (/export?format=csv e /gviz/tq?tqx=out:csv)
     NÃO mandam Access-Control-Allow-Origin: mesmo com a planilha pública, o
     fetch() morre em "Failed to fetch" — e em file:// (origem null) nunca
     funciona. Carregando por <script> não existe CORS: o gviz devolve o
     conteúdo já embrulhado no nosso callback.
     headers=1 → o gviz consome a linha 1 como cabeçalho e devolve os títulos
     em cols[].label. É obrigatório: em colunas de CHECKBOX (tipadas boolean)
     o texto do cabeçalho não é boolean e o gviz o descartaria como célula
     vazia (ex.: a coluna "PRESENÇA" perderia o título). Remontamos o AOA com
     a linha de cabeçalho na frente, igual ao CSV.
     Retorna Promise<AOA> (array de arrays de string).                      */
  if(!window._gvizAOA){
    window._gvizAOA = function(idOuLink, gid){
      var m  = String(idOuLink||'').match(/\/spreadsheets\/d\/(?!e\/)([a-zA-Z0-9-_]+)/);
      var id = m ? m[1] : String(idOuLink||'').trim();
      if(!id) return Promise.reject(new Error('link do Google Sheets inválido'));
      if(gid == null){
        var g = String(idOuLink||'').match(/[#&?]gid=(\d+)/);
        gid = g ? g[1] : '0';
      }
      return new Promise(function(resolve, reject){
        var cb = '_gviz' + Date.now() + Math.floor(Math.random()*1000);
        var s  = document.createElement('script');
        var tm = setTimeout(function(){ limpar(); reject(new Error('tempo esgotado — planilha privada?')); }, 20000);
        function limpar(){
          clearTimeout(tm);
          try{ delete window[cb]; }catch(_){ window[cb] = undefined; }
          if(s.parentNode) s.parentNode.removeChild(s);
        }
        window[cb] = function(resp){
          limpar();
          if(!resp || resp.status === 'error'){
            var er = resp && resp.errors && resp.errors[0];
            var ms = er ? (er.detailed_message || er.message || 'erro') : 'resposta vazia';
            reject(new Error(String(ms).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,140)));
            return;
          }
          var tb = resp.table || {}, cols = tb.cols || [], rows = tb.rows || [];
          var header = cols.map(function(c){ return String((c && c.label) || '').trim(); });
          var aoa = rows.map(function(r){
            var c = (r && r.c) || [], linha = [];
            for(var i=0; i<cols.length; i++){
              var cel = c[i];
              if(!cel || (cel.v == null && cel.f == null))   linha.push('');
              else if(cel.f != null)                          linha.push(String(cel.f));
              else if(typeof cel.v === 'boolean')             linha.push(cel.v ? 'TRUE' : 'FALSE');
              else                                            linha.push(String(cel.v));
            }
            return linha;
          });
          /* Cabeçalho primeiro — só se veio algum título (senão o gviz não
             detectou header e os dados já estão completos nas rows). */
          if(header.some(function(h){ return h !== ''; })) aoa.unshift(header);
          resolve(aoa);
        };
        s.src = 'https://docs.google.com/spreadsheets/d/' + id +
                '/gviz/tq?tqx=out:json;responseHandler:' + cb + '&headers=1&gid=' + gid;
        s.onerror = function(){ limpar(); reject(new Error('não consegui abrir a planilha (link privado?)')); };
        document.head.appendChild(s);
      });
    };
  }
})();
