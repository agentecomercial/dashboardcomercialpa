/* ═══════════════════════════════════════════════════════════════════
   PROPOSTA · ELITE BELT / LEGACY BELT
   ───────────────────────────────────────────────────────────────────
   Modalidades de proposta que montam automaticamente os treinamentos
   PENDENTES do cliente, lendo o "mapeamento da turma" (planilha onde
   cada célula vale ADQUIRIDO ou PENDENTE).

   • Elite Belt  → marca todos os treinamentos PENDENTES do cliente.
   • Legacy Belt → pendentes + CI obrigatório.

   Fontes da grade (Fase 1): link (Google Sheets publicado / URL de CSV)
   e arquivo .xlsx / .xls / .csv (via SheetJS). Imagem (OCR) e PDF ficam
   para a Fase 2.

   Integração: reaproveita o modal "Montar Proposta" — marca os mesmos
   checkboxes prop_<CHAVE> e chama _propostaRecalcular() (preço pela
   forma de pagamento já selecionada).
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* Mapa: rótulo da coluna no mapeamento → chave do catálogo (_PROPOSTA_PRECOS).
     Confirmado com o gestor: CIS→CIS_GLOBAL, FOP→CEOP, MLS→ML5, TV→TAV. */
  var _BELT_COLMAP = {
    'CIS':'CIS_GLOBAL', 'CIS GLOBAL':'CIS_GLOBAL', 'CIS_GLOBAL':'CIS_GLOBAL',
    'FGPC':'FGPC', 'FCIS':'FCIS', 'IF':'IF', 'BHP':'BHP',
    'FOP':'CEOP', 'CEOP':'CEOP',
    'MLS':'ML5', 'ML5':'ML5', 'ML':'ML5',
    'MASTER':'MASTER', 'MASTER COACHING':'MASTER',
    'CI':'CI',
    'TV':'TAV', 'TAV':'TAV',
    'MAESTRIA':'MAESTRIA'
  };

  function _norm(s){
    return String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'')
      .toUpperCase().replace(/\s+/g,' ').trim();
  }
  function _precos(){ return window._PROPOSTA_PRECOS || {}; }

  /* rótulo da coluna → chave do catálogo (ou null se não reconhecido) */
  function _colKey(header){
    var h = _norm(header);
    if(!h) return null;
    if(_BELT_COLMAP[h]) return _BELT_COLMAP[h];
    if(_precos()[h]) return h;        // já é uma chave válida
    return null;
  }
  /* valor da célula → 'PENDENTE' | 'ADQUIRIDO' | null */
  function _statusCelula(v){
    var s = _norm(v);
    if(!s) return null;
    if(s.indexOf('PEND') !== -1) return 'PENDENTE';
    if(s.indexOf('ADQ')  !== -1) return 'ADQUIRIDO';
    return null;
  }

  /* ── Parser: AOA (array de arrays) → { clientes, grade, desconhecidas } ── */
  function _parseAOA(aoa){
    if(!aoa || !aoa.length) throw new Error('Planilha vazia');
    // 1) achar a linha de cabeçalho (a que tem a coluna CLIENTE)
    var hi = -1, idxCliente = -1;
    for(var r=0; r<Math.min(aoa.length,30); r++){
      var row = aoa[r] || [];
      for(var c=0; c<row.length; c++){
        if(_norm(row[c]) === 'CLIENTE'){ hi = r; idxCliente = c; break; }
      }
      if(hi >= 0) break;
    }
    if(hi < 0) throw new Error('Não encontrei a coluna "CLIENTE" no cabeçalho.');
    var header = aoa[hi] || [];

    // 2) colunas de treinamento reconhecidas
    var cols = [];           // {idx, key, raw}
    header.forEach(function(h,c){
      if(c === idxCliente) return;
      var key = _colKey(h);
      if(key) cols.push({idx:c, key:key, raw:String(h||'')});
    });
    if(!cols.length) throw new Error('Nenhuma coluna de treinamento reconhecida no cabeçalho.');

    // 3) clientes
    var clientes = {};
    for(var r2=hi+1; r2<aoa.length; r2++){
      var row2 = aoa[r2] || [];
      var nome = String(row2[idxCliente]==null ? '' : row2[idxCliente]).trim();
      var nk = _norm(nome);
      if(!nk || nk === 'CLIENTE') continue;
      var rec = {};
      cols.forEach(function(col){
        var st = _statusCelula(row2[col.idx]);
        if(st) rec[col.key] = st;
      });
      clientes[nk] = { nome: nome, status: rec };
    }

    // 4) colunas com status mas SEM mapeamento conhecido → aviso
    var desconhecidas = [];
    header.forEach(function(h,c){
      if(c === idxCliente || _colKey(h)) return;
      for(var r3=hi+1; r3<Math.min(aoa.length, hi+10); r3++){
        if(_statusCelula((aoa[r3]||[])[c])){ desconhecidas.push(String(h||('col'+c)).trim()); break; }
      }
    });

    return {
      clientes: clientes,
      grade: cols.map(function(x){return x.key;}),
      desconhecidas: desconhecidas,
      header: header,
      headerLinha: hi + 1,
      idxCliente: idxCliente,
      cols: cols,
      totalClientes: Object.keys(clientes).length
    };
  }

  /* ── Localiza o cliente no mapeamento (exato → aproximado) ── */
  function _acharCliente(nome){
    if(!window._beltMapa) return null;
    var nk = _norm(nome);
    var cl = window._beltMapa.clientes;
    if(cl[nk]) return cl[nk];
    var keys = Object.keys(cl);
    var hit = keys.filter(function(k){ return k.indexOf(nk) !== -1 || nk.indexOf(k) !== -1; })
                  .sort(function(a,b){ return Math.abs(a.length-nk.length) - Math.abs(b.length-nk.length); })[0];
    return hit ? cl[hit] : null;
  }

  function _pendentes(rec){
    var pend = [];
    Object.keys(rec.status).forEach(function(key){
      if(rec.status[key] === 'PENDENTE' && _precos()[key]) pend.push(key);
    });
    return pend;
  }

  function _clienteSelecionado(){
    var sel = document.getElementById('propostaCliente');
    if(!sel) return '';
    if(sel.value === '__manual__'){
      var inp = document.getElementById('propostaClienteManual');
      return inp ? inp.value.trim() : '';
    }
    return sel.value || '';
  }

  function _setStatus(html, isWarn){
    var el = document.getElementById('beltStatus');
    if(!el) return;
    el.innerHTML = html || '';
    el.style.color = isWarn ? 'var(--amber)' : 'var(--muted)';
  }

  /* ── Acordeão (recolhível) ── */
  function _beltExpandir(open){
    var body = document.getElementById('beltAccBody');
    var car  = document.getElementById('beltCaret');
    if(body) body.style.display = open ? 'block' : 'none';
    if(car)  car.style.transform = open ? 'rotate(180deg)' : '';
  }
  function _beltToggleAcc(){
    var body = document.getElementById('beltAccBody');
    _beltExpandir(!(body && body.style.display === 'block'));
  }
  /* Chip-resumo no cabeçalho do acordeão. estado: ok | warn | info | none */
  function _beltSetChip(texto, estado){
    var c = document.getElementById('beltChip');
    if(!c) return;
    c.textContent = texto;
    var map = {
      ok:   ['rgba(86,211,100,.14)', '#56d364'],
      warn: ['rgba(240,180,40,.16)', '#f0b429'],
      info: ['rgba(80,140,255,.14)', '#93c5fd'],
      none: ['rgba(255,255,255,.08)', 'var(--muted)']
    };
    var s = map[estado] || map.none;
    c.style.background = s[0]; c.style.color = s[1];
  }

  /* ── Carrega XLSX (SheetJS) sob demanda ── */
  function _ensureXLSX(){
    if(window.XLSX) return Promise.resolve();
    if(typeof window._ensureXLSX === 'function'){
      var p = window._ensureXLSX();
      return (p && typeof p.then === 'function') ? p : Promise.resolve();
    }
    return Promise.reject(new Error('Biblioteca de planilhas (XLSX) indisponível'));
  }

  function _aoaFromWorkbook(wb){
    var ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
  }

  /* Monta um preview textual das primeiras linhas/colunas lidas */
  function _previewAOA(aoa, maxR, maxC){
    maxR = maxR || 6; maxC = maxC || 14;
    var esc = function(s){ return String(s==null?'':s).replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
    var out = [];
    for(var r=0; r<Math.min(aoa.length, maxR); r++){
      var row = aoa[r] || [];
      var cells = [];
      for(var c=0; c<Math.min(Math.max(row.length,1), maxC); c++){ cells.push(esc(row[c])); }
      out.push('L'+(r+1)+': ' + cells.join(' | '));
    }
    if(!out.length) out.push('(vazio)');
    return out.join('\n');
  }

  var _PRE = 'white-space:pre-wrap;word-break:break-word;background:var(--surface);border:1px solid var(--border2);border-radius:6px;padding:8px;margin:6px 0 0;font-size:10px;line-height:1.5;max-height:220px;overflow:auto;color:var(--text);';

  /* Bloco que mostra SEMPRE o que foi lido (abas + dimensões + preview) */
  function _blocoLeitura(abas, abaLida, aoa){
    var nCols = (aoa[0]||[]).length;
    return '<b>Leitura do arquivo</b>'
      + '<br>Abas: ' + (abas && abas.length ? abas.join(' · ') : '(única)')
      + '<br>Aba lida: <b>'+(abaLida||'—')+'</b> · linhas: '+aoa.length+' · colunas (L1): '+nCols
      + '<br><pre style="'+_PRE+'">' + _previewAOA(aoa, 8, 18) + '</pre>';
  }

  /* Lista cada coluna do cabeçalho e como foi interpretada */
  function _blocoColunas(res){
    var esc = function(s){ return String(s==null?'':s).replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
    var keyDe = {}; res.cols.forEach(function(c){ keyDe[c.idx] = c.key; });
    var linhas = (res.header||[]).map(function(h,i){
      var raw = String(h==null?'':h).trim();
      if(!raw && i !== res.idxCliente) return null;
      var tag;
      if(i === res.idxCliente)      tag = '<span style="color:var(--accent)">CLIENTE</span>';
      else if(keyDe[i])             tag = '→ <b>'+keyDe[i]+'</b>';
      else                          tag = '<span style="color:var(--muted)">ignorada</span>';
      return 'C'+(i+1)+' "'+esc(raw||'(vazio)')+'" '+tag;
    }).filter(Boolean);
    return '<br><b>Colunas detectadas</b> (cabeçalho na linha '+res.headerLinha+'):'
      + '<br><pre style="'+_PRE+'">' + linhas.join('\n') + '</pre>';
  }

  function _processar(abas, abaLida, aoa){
    window._beltUltimoAOA = aoa;        // inspeção via console
    window._beltAbas = abas;
    var leitura = _blocoLeitura(abas, abaLida, aoa);
    try{
      var res = _parseAOA(aoa);
      if(!res.totalClientes) throw new Error('Cabeçalho encontrado, mas nenhum cliente nas linhas abaixo.');
      window._beltMapa = res;
      var ok = '<br><span style="color:#56d364">✅ Grade carregada: <b>'+res.totalClientes+'</b> clientes · '
             + res.grade.length+' treinamentos (' + res.grade.join(', ') + ')</span>';
      if(res.desconhecidas.length) ok += '<br><span style="color:var(--amber)">⚠ Colunas sem correspondente (ignoradas): '+res.desconhecidas.join(', ')+'</span>';
      _setStatus(leitura + _blocoColunas(res) + ok, false);
      _beltSetChip(res.totalClientes + ' clientes', 'ok');
    }catch(e){
      window._beltMapa = null;
      _setStatus(leitura
        + '<br><span style="color:var(--amber)">Erro ao interpretar: '+(e.message||e)+'</span>'
        + '<br><span style="font-size:10px;">Veja o preview acima e me diga em qual linha está o cabeçalho / qual coluna é o cliente.</span>', false);
      _beltSetChip('erro na leitura', 'warn');
      _beltExpandir(true);
    }
  }

  /* Consome um workbook do SheetJS (arquivo ou link) */
  function _consumirWB(wb){
    var abas = wb.SheetNames || [];
    var abaNome = abas[0];
    var ws = wb.Sheets[abaNome];
    var aoa = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
    _processar(abas, abaNome, aoa);
  }

  /* Consome um AOA já pronto (compatibilidade) */
  function _consumir(aoa){ _processar([], '(única)', aoa); }

  /* ── Entrada por LINK (Google Sheets compartilhado/publicado ou URL de CSV) ── */
  /* Gera uma LISTA de URLs de CSV para tentar em ordem (cada tipo de link tem
     endpoints diferentes; testamos até um responder). */
  function _googleSheetCsvUrls(url){
    var gid = '0';
    var g = url.match(/[#&?]gid=(\d+)/);
    if(g) gid = g[1];
    // já é um link de CSV/export/gviz/pub? usa direto
    if(/output=csv|format=csv|tqx=out:csv/i.test(url)) return [url];
    // "Publicar na web": /spreadsheets/d/e/<token>/...  (token começa com 2PACX)
    var e = url.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
    if(e){
      var t = e[1];
      return [
        'https://docs.google.com/spreadsheets/d/e/' + t + '/pub?output=csv&gid=' + gid,
        'https://docs.google.com/spreadsheets/d/e/' + t + '/pub?output=csv'
      ];
    }
    // Link normal de compartilhamento: /spreadsheets/d/<id>/edit...
    var m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if(m){
      var id = m[1];
      return [
        'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&gid=' + gid,
        'https://docs.google.com/spreadsheets/d/' + id + '/export?format=csv&gid=' + gid
      ];
    }
    return [url]; // não é Google Sheets: tenta como URL de CSV cru
  }
  function _beltLerLink(){
    var inp = document.getElementById('beltLink');
    var url = inp ? inp.value.trim() : '';
    if(!url){ _setStatus('Cole o link da planilha primeiro.', true); return; }
    _setStatus('Lendo link…', false);
    var urls = _googleSheetCsvUrls(url);
    var ultimoErro = '';
    (function tentar(i){
      if(i >= urls.length){
        _setStatus('Não consegui ler o link (' + (ultimoErro||'falhou') + ').<br>' +
          'Use <b>Arquivo → Compartilhar → Qualquer pessoa com o link (Leitor)</b> ' +
          'OU <b>Arquivo → Compartilhar → Publicar na web → CSV</b> e cole o link gerado.', true);
        return;
      }
      fetch(urls[i])
        .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function(text){
          var t = (text||'').trim();
          // se vier página HTML (login/erro) em vez de CSV, tenta o próximo endpoint
          if(/^<!DOCTYPE|^<html/i.test(t)) throw new Error('planilha não pública');
          return _ensureXLSX().then(function(){
            var wb = XLSX.read(text, { type:'string' });
            _consumirWB(wb);
          });
        })
        .catch(function(e){ ultimoErro = (e && e.message) || e; tentar(i+1); });
    })(0);
  }

  /* ─────────────────────────────────────────────────────────────────
     FASE 2 · Imagem (OCR Tesseract) e PDF (PDF.js)
     ───────────────────────────────────────────────────────────────── */
  function _loadScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function(){ res(); };
      s.onerror = function(){ rej(new Error('Falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
  }
  function _ensureTesseract(){
    if(window.Tesseract) return Promise.resolve();
    return _loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  }
  function _ensurePdfjs(){
    if(window.pdfjsLib) return Promise.resolve();
    return _loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js').then(function(){
      try{ window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; }catch(e){}
    });
  }

  /* Reconstrói uma matriz (AOA) a partir de itens posicionados {text,x,y,h}.
     topFirst=true quando o y cresce para baixo (Tesseract bbox);
     topFirst=false para PDF (y cresce para cima — invertemos). */
  function _itemsToAOA(items, topFirst){
    items = (items||[]).filter(function(it){ return it && String(it.text).trim() !== ''; });
    if(!items.length) return [];
    items.forEach(function(it){ it.text = String(it.text).trim(); it._y = topFirst ? it.y : -it.y; });
    items.sort(function(a,b){ return a._y - b._y; });

    // tolerância de linha = ~60% da altura mediana do texto
    var hs = items.map(function(i){ return i.h || 10; }).sort(function(a,b){ return a-b; });
    var medH = hs[Math.floor(hs.length/2)] || 10;
    var rowTol = Math.max(medH * 0.6, 4);

    // agrupar em linhas
    var rows = [], curRow = [items[0]], curY = items[0]._y;
    for(var i=1; i<items.length; i++){
      if(Math.abs(items[i]._y - curY) > rowTol){ rows.push(curRow); curRow = []; curY = items[i]._y; }
      curRow.push(items[i]);
    }
    rows.push(curRow);

    // detectar colunas: clusteriza os x (canto esquerdo) com gap > 1.8% da largura
    var xs = items.map(function(i){ return i.x; }).sort(function(a,b){ return a-b; });
    var span = Math.max(xs[xs.length-1] - xs[0], 1);
    var gapTol = span * 0.018;
    var clusters = [], start = xs[0], prev = xs[0];
    for(var k=1; k<xs.length; k++){
      if(xs[k] - prev > gapTol){ clusters.push([start, prev]); start = xs[k]; }
      prev = xs[k];
    }
    clusters.push([start, prev]);
    var centers = clusters.map(function(c){ return (c[0] + c[1]) / 2; });

    // montar AOA: cada item vai para a coluna de centro mais próximo
    return rows.map(function(row){
      var cells = centers.map(function(){ return ''; });
      row.sort(function(a,b){ return a.x - b.x; });
      row.forEach(function(it){
        var best = 0, bd = Infinity;
        for(var c=0; c<centers.length; c++){ var d = Math.abs(it.x - centers[c]); if(d < bd){ bd = d; best = c; } }
        cells[best] = cells[best] ? (cells[best] + ' ' + it.text) : it.text;
      });
      return cells;
    });
  }

  /* OCR de imagem (ou canvas) → AOA → pipeline padrão */
  function _ocrImagem(imgOuCanvas, rotulo){
    _setStatus('Rodando OCR' + (rotulo ? ' ('+rotulo+')' : '') + '… pode levar alguns segundos.', false);
    return _ensureTesseract().then(function(){
      return Tesseract.recognize(imgOuCanvas, 'por+eng', {
        logger: function(m){ if(m && m.status === 'recognizing text'){ _setStatus('OCR… ' + Math.round((m.progress||0)*100) + '%', false); } }
      });
    }).then(function(out){
      var data = (out && out.data) || {};
      var words = (data.words || []).map(function(w){
        var b = w.bbox || {};
        return { text:w.text, x:(b.x0||0), y:(b.y0||0), h:((b.y1||0)-(b.y0||0))||10 };
      });
      var aoa;
      if(words.length) aoa = _itemsToAOA(words, true);
      else aoa = (data.text||'').split(/\r?\n/).map(function(l){ return l.split(/\s{2,}|\t/); });
      _processar(['(imagem OCR)'], rotulo || 'OCR', aoa);
    }).catch(function(e){ _setStatus('Falha no OCR: ' + (e.message||e), true); });
  }

  /* PDF: extrai texto posicionado (PDF.js); se for escaneado, rasteriza e OCR */
  function _pdfParaAOA(buf){
    _setStatus('Lendo PDF…', false);
    return _ensurePdfjs().then(function(){
      return window.pdfjsLib.getDocument({ data: buf }).promise;
    }).then(function(pdf){
      return pdf.getPage(1).then(function(page){
        return page.getTextContent().then(function(tc){
          var items = (tc.items||[]).map(function(it){
            var tr = it.transform || [1,0,0,1,0,0];
            return { text: it.str, x: tr[4], y: tr[5], h: Math.abs(tr[3]) || 10 };
          }).filter(function(i){ return String(i.text).trim() !== ''; });
          if(items.length >= 8){
            _processar(['PDF p.1'], 'PDF (texto)', _itemsToAOA(items, false));
          } else {
            _setStatus('PDF sem texto selecionável — convertendo a página em imagem para OCR…', false);
            var viewport = page.getViewport({ scale: 2 });
            var canvas = document.createElement('canvas');
            canvas.width = viewport.width; canvas.height = viewport.height;
            var ctx = canvas.getContext('2d');
            return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function(){
              return _ocrImagem(canvas, 'PDF rasterizado');
            });
          }
        });
      });
    }).catch(function(e){ _setStatus('Falha ao ler PDF: ' + (e.message||e), true); });
  }

  /* ── Entrada por ARQUIVO (.xlsx/.xls/.csv · PNG/JPG/JPEG/WEBP · PDF) ── */
  function _beltArquivoChange(input){
    var f = input.files && input.files[0];
    if(!f){ return; }
    var ext = (f.name.split('.').pop() || '').toLowerCase();
    var planilha = ['xlsx','xls','csv'];
    var imagem   = ['png','jpg','jpeg','webp'];

    if(planilha.indexOf(ext) !== -1){
      _setStatus('Lendo arquivo ' + f.name + '…', false);
      _ensureXLSX().then(function(){
        var reader = new FileReader();
        reader.onload = function(e){
          try{
            var wb;
            if(ext === 'csv') wb = XLSX.read(e.target.result, { type:'binary', codepage:1252 });
            else               wb = XLSX.read(e.target.result, { type:'array' });
            _consumirWB(wb);
          }catch(err){ _setStatus('Erro ao ler o arquivo: ' + (err.message||err), true); }
        };
        reader.onerror = function(){ _setStatus('Falha ao abrir o arquivo.', true); };
        if(ext === 'csv') reader.readAsBinaryString(f);
        else               reader.readAsArrayBuffer(f);
      }).catch(function(e){ _setStatus('Biblioteca de planilhas indisponível: ' + (e.message||e), true); });

    } else if(imagem.indexOf(ext) !== -1){
      _ocrImagem(f, 'imagem');

    } else if(ext === 'pdf'){
      var rd = new FileReader();
      rd.onload = function(e){ _pdfParaAOA(e.target.result); };
      rd.onerror = function(){ _setStatus('Falha ao abrir o PDF.', true); };
      rd.readAsArrayBuffer(f);

    } else {
      _setStatus('Formato não suportado: .' + ext + ' (use .xlsx, .csv, imagem PNG/JPG/WEBP ou PDF).', true);
    }
    input.value = '';
  }

  /* Reflete visualmente qual modalidade está ativa (sem depender do hover,
     que mexe só no background — por isso usamos box-shadow). */
  function _beltAtualizarBotoes(ativo){
    var e = document.getElementById('btnEliteBelt');
    var l = document.getElementById('btnLegacyBelt');
    var g = document.getElementById('btnPropostaSelecionarGGB');
    if(e){ e.style.boxShadow = (ativo==='elite')  ? '0 0 0 2px #f0b429 inset' : ''; e.innerHTML = (ativo==='elite'  ? '✓ ' : '🟡 ') + 'Elite Belt'; }
    if(l){ l.style.boxShadow = (ativo==='legacy') ? '0 0 0 2px #a78bfa inset' : ''; l.innerHTML = (ativo==='legacy' ? '✓ ' : '🟣 ') + 'Legacy Belt'; }
    if(g){ g.style.boxShadow = (ativo==='ggb')    ? '0 0 0 2px #5096ff inset' : ''; g.textContent = (ativo==='ggb' ? '✓ GGB selecionado' : 'Selecionar GGB'); }
  }

  /* Desmarca apenas os checkboxes que a modalidade marcou */
  function _beltDesmarcarConjunto(){
    var container = document.getElementById('propostaTreinamentos');
    if(!container) return;
    var set = window._beltMarcados || [];
    container.querySelectorAll('input[type=checkbox]').forEach(function(chk){
      if(set.indexOf(chk.id.replace('prop_','')) !== -1) chk.checked = false;
    });
  }

  /* ── Aplica/alterna a modalidade ──
     Elite  = pendentes SEM o CI.
     Legacy = pendentes (sem CI) + CI obrigatório.
     Clicar de novo no mesmo botão (mesmo cliente) desmarca. */
  function _beltAplicar(modo){ // 'elite' | 'legacy'
    var nome = _clienteSelecionado();

    // TOGGLE: mesma modalidade + mesmo cliente → desmarca
    if(window._beltAtivo === modo && window._beltAtivoCliente === nome){
      _beltDesmarcarConjunto();
      window._beltAtivo = null; window._beltAtivoCliente = null; window._beltMarcados = [];
      _beltAtualizarBotoes(null);
      if(typeof window._propostaRecalcular === 'function') window._propostaRecalcular();
      _setStatus('Seleção do ' + (modo==='legacy'?'Legacy':'Elite') + ' Belt removida.', false);
      _beltSetChip(window._beltMapa ? (window._beltMapa.totalClientes + ' clientes') : 'sem grade', window._beltMapa ? 'ok' : 'none');
      return;
    }

    if(!nome){ if(window._showToast)_showToast('⚠️ Selecione um cliente primeiro.','var(--amber)'); _setStatus('Selecione o cliente no campo acima.', true); _beltSetChip('selecione o cliente','warn'); return; }
    if(!window._beltMapa){ if(window._showToast)_showToast('⚠️ Carregue a grade da turma.','var(--amber)'); _setStatus('Carregue a grade da turma (link ou arquivo) antes.', true); _beltSetChip('carregue a grade','warn'); _beltExpandir(true); return; }

    var rec = _acharCliente(nome);
    if(!rec){ _setStatus('Cliente "<b>'+nome+'</b>" não encontrado no mapeamento. Confira se o nome bate com a planilha.', true); _beltSetChip('cliente não achado','warn'); _beltExpandir(true); return; }

    var pend = _pendentes(rec);
    var ciPendente = pend.indexOf('CI') !== -1;
    var pendSemCI = pend.filter(function(k){ return k !== 'CI'; });   // CI nunca entra pela grade
    var marcar = pendSemCI.slice();
    if(modo === 'legacy') marcar.push('CI');                          // só o Legacy adiciona CI

    var container = document.getElementById('propostaTreinamentos');
    if(!container){ _setStatus('Modal de treinamentos não está pronto.', true); return; }
    container.querySelectorAll('input[type=checkbox]').forEach(function(chk){
      var key = chk.id.replace('prop_','');
      chk.checked = marcar.indexOf(key) !== -1;
    });
    window._beltAtivo = modo; window._beltAtivoCliente = nome; window._beltMarcados = marcar.slice();
    _beltAtualizarBotoes(modo);
    _beltSetChip((modo==='legacy' ? '🟣 Legacy' : '🟡 Elite') + ' · ' + marcar.length + ' itens', 'info');
    if(typeof window._propostaRecalcular === 'function') window._propostaRecalcular();

    // resumo / revisão
    var adq = Object.keys(rec.status).filter(function(k){ return rec.status[k] === 'ADQUIRIDO'; });
    var titulo = (modo === 'legacy' ? '🟣 Legacy Belt' : '🟡 Elite Belt');
    var html = '<b>'+titulo+'</b> · ' + rec.nome
      + '<br>Marcados ('+marcar.length+'): ' + (marcar.length ? marcar.join(', ') : '—')
      + (modo === 'legacy' ? ' <i style="color:var(--accent)">(CI obrigatório)</i>' : '')
      + '<br><span style="color:var(--muted)">Já adquiridos: ' + (adq.length ? adq.join(', ') : '—') + '</span>';
    if(modo === 'elite' && ciPendente) html += '<br><span style="color:var(--muted);font-size:10px;">CI fica fora do Elite — use Legacy Belt para incluí-lo.</span>';
    if(!pendSemCI.length && modo === 'elite') html += '<br><span style="color:var(--amber)">Nenhum treinamento pendente (fora o CI) para este cliente.</span>';
    if(window._beltMapa.desconhecidas.length) html += '<br><span style="color:var(--amber)">⚠ Colunas ignoradas no mapeamento: '+window._beltMapa.desconhecidas.join(', ')+'</span>';
    html += '<br><span style="color:var(--muted);font-size:10px;">Clique de novo no botão para desmarcar. Revise antes de gerar o PDF.</span>';
    _setStatus(html, false);
  }

  /* ── Textos da Seção I (Introdução & Reconhecimento) por modalidade ──
     Substituem _PROPOSTA_TEXTO no PDF quando a modalidade está ativa. */
  var _BELT_TEXTOS = {
    elite: 'Você já demonstrou um nível de comprometimento e evolução que o coloca entre um grupo seleto de pessoas que escolhem não se contentar com o comum. Sua trajetória revela disciplina, coragem e a decisão de buscar a melhor versão de si mesmo. Agora, falta apenas concluir os treinamentos restantes para alcançar um patamar reservado àqueles que fazem da excelência um padrão de vida e te coloca na elite. Parabéns Golden Belt.',
    legacy: 'Você já demonstrou um nível de comprometimento, disciplina e evolução que o diferencia da maioria das pessoas. Sua trajetória revela a coragem de investir em si mesmo, superar desafios e buscar continuamente a sua melhor versão. Hoje, você faz parte de um grupo seleto de indivíduos que não aceitam viver no padrão comum, mas escolhem a excelência como estilo de vida. Agora, resta apenas concluir os treinamentos pendentes para consolidar essa jornada e ocupar definitivamente um lugar entre aqueles que transformam conhecimento em resultados, influência e referência para os que estão ao seu redor. Parabéns Golden Belt. Esse é o seu legado.'
  };
  /* Retorna o texto da modalidade ativa, ou null (gerador usa o texto padrão). */
  function _beltTextoIntro(){
    return (window._beltAtivo && _BELT_TEXTOS[window._beltAtivo]) || null;
  }
  /* Limpa a modalidade ativa (chamado ao (re)abrir o modal de proposta) */
  function _beltReset(){
    window._beltAtivo = null; window._beltAtivoCliente = null; window._beltMarcados = [];
    _beltAtualizarBotoes(null);
    _beltExpandir(false);
    if(window._beltMapa) _beltSetChip(window._beltMapa.totalClientes + ' clientes', 'ok');
    else _beltSetChip('sem grade', 'none');
  }

  /* ═══════════════════════════════════════════════════════════════════
     LOTE · gerar propostas de TODOS os clientes de um consultor
     ───────────────────────────────────────────────────────────────────
     Modos: All Elite (todos sem CI) · All Legacy (todos com CI) ·
     Manual (base por regra + edição por cliente, com seletor de treino).
     Saída: 1 PDF único (gerarPropostaLotePDF). Pulados são listados.
     ═══════════════════════════════════════════════════════════════════ */
  var _lote = null; // { consultor, pagamento, pagLabel, modo, clientes:[...] }

  function _loteClientesDoConsultor(consultor){
    var alvo = _norm(consultor);
    /* `data` é uma `let` global (não vira window.data) — acessa direto, com fallback. */
    var arr = (typeof data !== 'undefined' && Array.isArray(data)) ? data
            : (Array.isArray(window.data) ? window.data : []);
    var vistos = {}, nomes = [];
    arr.forEach(function(d){
      if(!d || !d.cliente || !d.consultor) return;
      if(_norm(d.consultor) !== alvo) return;
      var nk = _norm(d.cliente);
      if(vistos[nk]) return;
      vistos[nk] = true; nomes.push(d.cliente);
    });
    return nomes;
  }

  function _lotePreco(cod, pag){
    var p = _precos()[cod];
    if(!p) return 0;
    var v = p[pag];
    return (v == null) ? 0 : v;
  }
  function _loteTemCI(rec){ return rec && rec.status && rec.status['CI'] === 'ADQUIRIDO'; }
  function _lotePendBase(rec){ return _pendentes(rec).filter(function(k){ return k !== 'CI'; }); }

  /* Gatilho: chamado no onchange do select de consultor */
  function _beltAoSelecionarConsultor(){
    var sel = document.getElementById('propostaConsultor');
    if(!sel) return;
    var c = sel.value;
    if(!c || c === '__manual__') return;
    var nomes = _loteClientesDoConsultor(c);
    if(!nomes.length) return;                       // consultor sem clientes na turma → ignora
    if(!window.confirm('Selecionar todos os clientes do consultor ' + c + ' (' + nomes.length + ')?\n\nVai montar as propostas de todos de uma vez (Elite/Legacy).')) return;
    if(!window._beltMapa){
      if(window._showToast) _showToast('⚠️ Carregue a grade da turma antes (campo "Grade da turma").','var(--amber)');
      _beltExpandir(true);
      return;
    }
    _loteAbrir(c, nomes);
  }

  function _loteAbrir(consultor, nomes){
    var pag = document.getElementById('propostaPagamento') ? document.getElementById('propostaPagamento').value : 'integral';
    var pagLabel = (window._PROPOSTA_LABELS && window._PROPOSTA_LABELS[pag]) || pag;
    var clientes = nomes.map(function(nome){
      var rec = _acharCliente(nome);
      var temCI = _loteTemCI(rec);
      var pend = rec ? _lotePendBase(rec) : [];
      var tem = rec ? Object.keys(rec.status).filter(function(k){ return rec.status[k] === 'ADQUIRIDO'; }) : [];
      return { nome: nome, rec: rec, temCI: temCI, pend: pend, tem: tem, incluir: [], modalidade: 'elite' };
    });
    _lote = { consultor: consultor, pagamento: pag, pagLabel: pagLabel, modo: 'elite', clientes: clientes };
    _loteGarantirOverlay();
    _loteSetModo('elite');
    var ov = document.getElementById('beltLoteOverlay');
    if(ov && ov._fillHead) ov._fillHead();
    ov.classList.add('open');
  }

  function _loteSetModo(m){
    _lote.modo = m;
    _lote.clientes.forEach(function(c){
      if(!c.rec){ c.incluir = []; c.modalidade = 'elite'; return; }
      if(m === 'elite'){      c.modalidade = 'elite';  c.incluir = c.pend.slice(); }
      else if(m === 'legacy'){c.modalidade = 'legacy';
                              /* CI só para quem AINDA não possui — quem já tem não recebe de novo
                                 (re-adicionar CI nesse caso só pelo modo Manual). */
                              c.incluir = c.temCI ? c.pend.slice() : c.pend.concat(['CI']); }
      else { /* manual */     c.modalidade = c.temCI ? 'elite' : 'legacy';
                              c.incluir = c.temCI ? c.pend.slice() : c.pend.concat(['CI']); }
    });
    _loteRender();
  }

  function _loteToggleTreino(idx, cod){
    var c = _lote.clientes[idx]; if(!c) return;
    var k = c.incluir.indexOf(cod);
    if(k === -1) c.incluir.push(cod); else c.incluir.splice(k, 1);
    _loteRender();
    if(document.getElementById('beltSelOverlay') && document.getElementById('beltSelOverlay').classList.contains('open')) _loteSelGrid();
  }

  var _loteSelIdx = null;
  function _loteAddTreino(idx){ _loteSelIdx = idx; _loteGarantirOverlay(); document.getElementById('beltSelOverlay').classList.add('open'); _loteSelGrid(); }
  function _loteSelFechar(){ var o = document.getElementById('beltSelOverlay'); if(o) o.classList.remove('open'); }
  function _loteSelGrid(){
    var c = _lote.clientes[_loteSelIdx]; if(!c) return;
    document.getElementById('beltSelTitulo').textContent = 'Adicionar treinamento · ' + c.nome;
    var grid = document.getElementById('beltSelGrid'); grid.innerHTML = '';
    Object.keys(_precos()).forEach(function(cod){
      var meta = (window._PRODUTOS_PROPOSTA && window._PRODUTOS_PROPOSTA[cod]) || {};
      var nome = meta.nome || cod;
      var jaTem = c.tem.indexOf(cod) !== -1;
      var incluso = c.incluir.indexOf(cod) !== -1;
      var b = document.createElement('button');
      /* No Manual tudo é clicável — inclusive os já possuídos (permite readicionar o CI). */
      b.className = 'belt-topt' + (incluso ? ' inc' : '');
      b.innerHTML = cod + '<small>' + (incluso ? 'incluído ✓' : (jaTem ? 'já possui · add' : nome.slice(0,16))) + '</small>';
      b.onclick = function(){ _loteToggleTreino(_loteSelIdx, cod); };
      grid.appendChild(b);
    });
  }

  function _loteFechar(){ var o = document.getElementById('beltLoteOverlay'); if(o) o.classList.remove('open'); }

  function _loteGerar(){
    var pag = _lote.pagamento, pagLabel = _lote.pagLabel;
    var lista = [], pulados = [];
    _lote.clientes.forEach(function(c){
      /* Gera quem tiver treinamentos a incluir — no Manual isso vale até para
         quem não está na grade (montado manualmente). */
      if(!c.incluir.length){ pulados.push(c.nome + ' — ' + (c.rec ? 'sem treinamentos a incluir' : 'sem treinamentos (não estava no mapeamento)')); return; }
      var selec = c.incluir.map(function(cod){ return { nome: cod, val: _lotePreco(cod, pag), qty: 1 }; });
      var total = selec.reduce(function(a,s){ return a + (s.val||0); }, 0);
      lista.push({
        cliente: c.nome, consultor: _lote.consultor, pagamento: pag, pagLabel: pagLabel,
        selecionados: selec, total: total,
        txtIntro: (_BELT_TEXTOS[c.modalidade] || null)
      });
    });
    if(!lista.length){ if(window._showToast) _showToast('Nenhum cliente com treinamentos para gerar.','var(--amber)'); return; }
    if(typeof window.gerarPropostaLotePDF === 'function'){
      window.gerarPropostaLotePDF(lista, 'Propostas ' + String(_lote.consultor).toUpperCase() + '.pdf');
    }
    var msg = '✅ ' + lista.length + ' propostas geradas em 1 PDF.';
    if(pulados.length) msg += '\n\nPulados (' + pulados.length + '):\n• ' + pulados.join('\n• ');
    _loteFechar();
    setTimeout(function(){ window.alert(msg); }, 300);
  }

  function _loteRender(){
    _loteGarantirOverlay();
    var manual = (_lote.modo === 'manual');
    var inc = [], pul = [];
    _lote.clientes.forEach(function(c, i){
      /* No Manual TODOS sobem para a lista editável (até quem seria pulado),
         pra poder ajustar. Nos outros modos, pulados ficam separados. */
      if(manual){ inc.push({c:c, i:i}); return; }
      if(!c.rec){ pul.push({c:c, motivo:'não está no mapeamento'}); return; }
      if(!c.incluir.length){ pul.push({c:c, motivo:'sem treinamentos a incluir'}); return; }
      inc.push({c:c, i:i});
    });
    var geraveis = _lote.clientes.filter(function(c){ return c.incluir.length > 0; }).length;
    // botões de modo
    ['elite','legacy','manual'].forEach(function(m){
      var b = document.getElementById('beltLoteModo-'+m);
      if(b) b.classList.toggle('on', _lote.modo === m);
    });
    var hint = document.getElementById('beltLoteHint');
    if(hint) hint.textContent = (_lote.modo==='elite') ? 'All Elite: cada cliente recebe seus pendentes, sem CI.'
      : (_lote.modo==='legacy') ? 'All Legacy: cada cliente recebe seus pendentes + CI (quem já tem CI não recebe de novo).'
      : 'Manual: todos os clientes ficam editáveis. Clique num treinamento âmbar para remover; "+ treino" abre o seletor.';

    var html = '';
    inc.forEach(function(o){
      var c = o.c, i = o.i;
      var badge = c.modalidade==='legacy' ? '<span class="belt-bdg bg-legacy">Legacy</span>' : '<span class="belt-bdg bg-elite">Elite</span>';
      var temChips = c.tem.map(function(t){ return '<span class="belt-chip '+(t==='CI'?'c-ci':'c-has')+'">'+t+'</span>'; }).join('') || '<span style="color:var(--muted);font-size:10px;">—</span>';
      var incChips;
      if(manual){
        incChips = (c.incluir.length
          ? c.incluir.map(function(t){ return '<span class="belt-chip c-inc edit '+(t==='CI'?'c-ci':'')+'" onclick="_beltLoteToggleTreino('+i+',\''+t+'\')" title="remover">'+t+' ✕</span>'; }).join('')
          : '<span style="color:var(--muted);font-size:10px;">nenhum</span>')
          + ' <span class="belt-chip c-add" onclick="_beltLoteAddTreino('+i+')">+ treino</span>';
      } else {
        incChips = c.incluir.map(function(t){ return '<span class="belt-chip '+(t==='CI'?'c-ci':'c-inc')+'">'+t+'</span>'; }).join('');
      }
      html += '<div class="belt-cli">'
        + '<div class="belt-cli-nome">'+c.nome+' '+badge+'</div>'
        + '<div class="belt-chips" style="margin-bottom:4px;"><span class="belt-lbl">tem</span>'+temChips+'</div>'
        + '<div class="belt-chips"><span class="belt-lbl">incluir</span>'+incChips+'</div>'
        + '</div>';
    });
    if(!html) html = '<div style="padding:16px;color:var(--muted);font-size:12px;text-align:center;">Nenhum cliente.</div>';
    document.getElementById('beltLoteLista').innerHTML = html;
    document.getElementById('beltLoteCont').textContent = inc.length + (manual ? ' clientes' : ' a gerar');

    var pulHtml = pul.length
      ? pul.map(function(p){ return '<div class="belt-cli"><div class="belt-cli-nome" style="font-weight:600;">'+p.c.nome+' <span style="color:var(--muted);font-weight:400;font-size:11px;">— '+p.motivo+'</span></div></div>'; }).join('')
      : '<div style="padding:10px 14px;color:var(--muted);font-size:11px;">'+(manual?'No modo Manual todos ficam editáveis acima.':'Nenhum.')+'</div>';
    document.getElementById('beltLotePulados').innerHTML = pulHtml;
    document.getElementById('beltLotePuladosCont').textContent = pul.length;
    document.getElementById('beltLoteResumo').innerHTML = 'Serão geradas <b>'+geraveis+' propostas</b> em <b>1 PDF</b>'+(pul.length?(' · '+pul.length+' puladas'):'');
    document.getElementById('beltLoteBtnGerar').textContent = '📄 Gerar PDF do lote ('+geraveis+')';
  }

  /* Cria os overlays (lote + seletor) uma única vez */
  function _loteGarantirOverlay(){
    if(document.getElementById('beltLoteOverlay')) return;
    var st = document.createElement('style');
    st.textContent =
      '#beltLoteOverlay,#beltSelOverlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1700;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 0;}'
      +'#beltLoteOverlay.open,#beltSelOverlay.open{display:flex;}'
      +'#beltSelOverlay{z-index:1750;align-items:center;}'
      +'.belt-lote-card{width:780px;max-width:96vw;background:var(--surface);border:1px solid var(--border2);border-radius:14px;margin:auto;overflow:hidden;box-shadow:0 16px 44px rgba(0,0,0,.6);}'
      +'.belt-lote-h{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}'
      +'.belt-lote-h .t{font-size:16px;font-weight:800;}.belt-lote-h .s{font-size:12px;color:var(--muted);margin-top:2px;}'
      +'.belt-lote-b{padding:16px 20px;}'
      +'.belt-modos{display:flex;gap:8px;margin-bottom:8px;}'
      +'.belt-modo{flex:1;height:52px;border-radius:9px;cursor:pointer;font-family:inherit;font-weight:800;font-size:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;line-height:1.2;}'
      +'.belt-modo small{font-weight:500;font-size:9.5px;opacity:.8;}'
      +'.belt-modo.m-e{background:rgba(240,180,40,.10);border:1px solid rgba(240,180,40,.4);color:#f0b429;}'
      +'.belt-modo.m-l{background:rgba(167,139,250,.10);border:1px solid rgba(167,139,250,.4);color:#a78bfa;}'
      +'.belt-modo.m-m{background:rgba(96,165,250,.10);border:1px solid rgba(96,165,250,.4);color:#93c5fd;}'
      +'.belt-modo.on{box-shadow:0 0 0 2px currentColor inset;}'
      +'.belt-hint{font-size:11px;color:var(--muted);margin:0 0 12px;min-height:15px;}'
      +'.belt-grupo{border:1px solid var(--border2);border-radius:10px;margin-bottom:12px;overflow:hidden;}'
      +'.belt-grupo-h{padding:9px 14px;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:space-between;background:var(--surface2);}'
      +'.belt-grupo-h.skip{background:rgba(239,68,68,.10);color:#fca5a5;}'
      +'.belt-cli{padding:9px 14px;border-bottom:1px solid var(--border);}.belt-cli:last-child{border-bottom:none;}'
      +'.belt-cli-nome{font-size:12px;font-weight:700;margin-bottom:5px;display:flex;align-items:center;gap:8px;}'
      +'.belt-bdg{font-size:9px;font-weight:800;padding:1px 7px;border-radius:20px;}.bg-elite{background:rgba(240,180,40,.16);color:#f0b429;}.bg-legacy{background:rgba(167,139,250,.18);color:#a78bfa;}'
      +'.belt-chips{display:flex;flex-wrap:wrap;gap:4px;align-items:center;}'
      +'.belt-chip{font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:20px;}'
      +'.belt-chip.c-has{background:rgba(86,211,100,.12);color:#56d364;}.belt-chip.c-inc{background:rgba(240,180,40,.16);color:#f0b429;}.belt-chip.c-ci{background:rgba(167,139,250,.18);color:#a78bfa;}'
      +'.belt-chip.edit{cursor:pointer;}.belt-chip.edit:hover{filter:brightness(1.25);}'
      +'.belt-chip.c-add{background:none;border:1px dashed var(--border2);color:var(--muted);cursor:pointer;}.belt-chip.c-add:hover{border-color:var(--accent);color:var(--accent);}'
      +'.belt-lbl{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-right:4px;}'
      +'.belt-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:14px;border-top:1px solid var(--border);}'
      +'.belt-foot .r{font-size:12px;color:var(--muted);}.belt-foot .r b{color:var(--text);}'
      +'.belt-gerar{background:linear-gradient(180deg,#d4f565,#c8f05a);border:none;color:#0a0e1a;font-weight:800;padding:10px 18px;border-radius:9px;font-size:13px;cursor:pointer;}'
      +'.belt-x{background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;}'
      +'.belt-sel-card{width:720px;max-width:96vw;background:var(--surface);border:1px solid var(--border2);border-radius:12px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.6);}'
      +'.belt-sel-h{padding:13px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:800;}'
      +'.belt-sel-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:14px 16px;max-height:56vh;overflow:auto;}'
      +'.belt-topt{border-radius:8px;padding:8px 5px;font-size:11px;font-weight:700;cursor:pointer;text-align:center;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-family:inherit;}'
      +'.belt-topt:hover{border-color:var(--accent);color:var(--accent);}'
      +'.belt-topt.inc{background:rgba(240,180,40,.16);border-color:rgba(240,180,40,.5);color:#f0b429;}'
      +'.belt-topt.has{opacity:.45;cursor:not-allowed;}'
      +'.belt-topt small{display:block;font-size:8px;font-weight:600;opacity:.7;margin-top:1px;}'
      +'.belt-sel-f{padding:10px 16px;border-top:1px solid var(--border);text-align:right;}'
      +'.belt-sel-f button{background:var(--accent);color:#0a0e1a;border:none;border-radius:7px;padding:7px 16px;font-weight:800;font-size:12px;cursor:pointer;}';
    document.head.appendChild(st);

    var ov = document.createElement('div'); ov.id = 'beltLoteOverlay';
    ov.innerHTML =
      '<div class="belt-lote-card">'
      +'<div class="belt-lote-h"><div><div class="t">📦 Lote de propostas · Consultor: <span id="beltLoteConsultor"></span></div><div class="s" id="beltLoteSub"></div></div><button class="belt-x" onclick="_beltLoteFechar()">✕</button></div>'
      +'<div class="belt-lote-b">'
      +'<div class="belt-modos">'
      +'<button class="belt-modo m-e" id="beltLoteModo-elite" onclick="_beltLoteSetModo(\'elite\')">🟡 All Elite<small>todos sem CI</small></button>'
      +'<button class="belt-modo m-l" id="beltLoteModo-legacy" onclick="_beltLoteSetModo(\'legacy\')">🟣 All Legacy<small>todos com CI</small></button>'
      +'<button class="belt-modo m-m" id="beltLoteModo-manual" onclick="_beltLoteSetModo(\'manual\')">✏️ Manual<small>editar por cliente</small></button>'
      +'</div>'
      +'<p class="belt-hint" id="beltLoteHint"></p>'
      +'<div class="belt-grupo"><div class="belt-grupo-h"><span>Clientes do consultor</span><span id="beltLoteCont">—</span></div><div id="beltLoteLista"></div></div>'
      +'<div class="belt-grupo"><div class="belt-grupo-h skip"><span>⏭ SERÃO PULADOS</span><span id="beltLotePuladosCont">0</span></div><div id="beltLotePulados"></div></div>'
      +'<div class="belt-foot"><span class="r" id="beltLoteResumo"></span><button class="belt-gerar" id="beltLoteBtnGerar" onclick="_beltLoteGerar()">📄 Gerar PDF do lote</button></div>'
      +'</div></div>';
    document.body.appendChild(ov);

    var sel = document.createElement('div'); sel.id = 'beltSelOverlay';
    sel.innerHTML =
      '<div class="belt-sel-card">'
      +'<div class="belt-sel-h"><span id="beltSelTitulo">Adicionar treinamento</span><button class="belt-x" onclick="_beltLoteSelFechar()">✕</button></div>'
      +'<div class="belt-sel-grid" id="beltSelGrid"></div>'
      +'<div class="belt-sel-f"><button onclick="_beltLoteSelFechar()">Concluir</button></div>'
      +'</div>';
    document.body.appendChild(sel);

    // preencher cabeçalho na abertura
    var _fillHead = function(){
      if(!_lote) return;
      var hc = document.getElementById('beltLoteConsultor'); if(hc) hc.textContent = _lote.consultor;
      var hs = document.getElementById('beltLoteSub');
      if(hs) hs.textContent = _lote.clientes.length + ' clientes · pagamento: ' + _lote.pagLabel + (window._beltMapa ? (' · grade: '+window._beltMapa.totalClientes+' clientes') : '');
    };
    ov._fillHead = _fillHead;
  }

  // expõe ao escopo global (usado nos onclick do modal)
  window._beltAoSelecionarConsultor = _beltAoSelecionarConsultor;
  window._beltLoteSetModo      = _loteSetModo;
  window._beltLoteToggleTreino = _loteToggleTreino;
  window._beltLoteAddTreino    = _loteAddTreino;
  window._beltLoteSelFechar    = _loteSelFechar;
  window._beltLoteGerar        = _loteGerar;
  window._beltLoteFechar       = _loteFechar;
  window._beltLerLink       = _beltLerLink;
  window._beltArquivoChange = _beltArquivoChange;
  window._beltAplicar       = _beltAplicar;
  window._beltTextoIntro    = _beltTextoIntro;
  window._beltReset         = _beltReset;
  window._beltToggleAcc     = _beltToggleAcc;
})();
