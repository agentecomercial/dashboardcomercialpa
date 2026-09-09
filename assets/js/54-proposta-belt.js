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

  /* ── Localiza o cliente no mapeamento (exato → aproximado) ──
     O aproximado antigo casava por substring solta: "MARIA" casava com
     "ANA MARIA COSTA" — que é cliente de OUTRO consultor. No lote isso
     trazia gente de fora para dentro da lista (visível no modo Manual,
     onde todos sobem para a lista editável).
     Agora o aproximado só aceita PREFIXO DE PALAVRA INTEIRA e só quando
     há um único candidato; havendo dois ou mais, é ambíguo e não casa. */
  var _beltAmbiguo = null;   /* nomes candidatos do último casamento ambíguo */

  function _acharCliente(nome){
    _beltAmbiguo = null;
    if(!window._beltMapa) return null;
    var nk = _norm(nome);
    var cl = window._beltMapa.clientes;
    if(cl[nk]) return cl[nk];

    var cands = Object.keys(cl).filter(function(k){
      /* um é prefixo do outro, cortando em palavra inteira */
      return (k + ' ').indexOf(nk + ' ') === 0 || (nk + ' ').indexOf(k + ' ') === 0;
    });
    if(cands.length === 1) return cl[cands[0]];
    if(cands.length > 1){
      _beltAmbiguo = cands.map(function(k){ return cl[k].nome; });
    }
    return null;
  }
  /* Motivo da falha do último _acharCliente, para a mensagem de tela */
  function _beltMotivoNaoAchou(){
    return _beltAmbiguo
      ? ('nome ambíguo na planilha — casa com ' + _beltAmbiguo.join(' / '))
      : 'não está no mapeamento';
  }

  /* ═══════════════════════════════════════════════════════════════
     FAIXA · GREEN BELT / GOLDEN BELT
     ───────────────────────────────────────────────────────────────
     Green  = 5 treinamentos · Golden = 8.
     "Fora da contagem": o treinamento não ocupa vaga na meta e nunca
     é marcado na proposta.
     O CIS nasce fora da contagem nas DUAS faixas: ele entra na conta do
     aluno mas não ocupa vaga na meta.
       Green  → "até 6"  (CIS + 5)
       Golden → "até 9"  (CIS + 8)
     Como fora o CIS existem exatamente 8 treinamentos na grade, o Golden
     fecha com todos eles. Tudo isso é configurável pelo gestor e fica salvo.
     ═══════════════════════════════════════════════════════════════ */
  var _FAIXA_GRADE = ['IF','MASTER','CEOP','FGPC','BHP','FCIS','ML5','TAV','CIS_GLOBAL'];
  var _FAIXA_META  = { green:5, gold:8 };
  var _FAIXA_NOME  = { green:'🟢 Green Belt', gold:'🥇 Golden Belt' };
  /* v3: o CIS voltou a ficar fora da contagem também no Golden. A troca
     de chave descarta a configuração antiga em vez de herdar o padrão velho. */
  var LS_FORA = 'proposta_belt_fora_v3';
  var _FAIXA_FORA_PADRAO = { green:{ CIS_GLOBAL:true }, gold:{ CIS_GLOBAL:true } };

  function _faixaFora(){
    var f = null;
    try{ f = JSON.parse(localStorage.getItem(LS_FORA)); }catch(e){}
    if(!f || !f.green || !f.gold){
      f = { green:{}, gold:{} };
      Object.keys(_FAIXA_FORA_PADRAO.green).forEach(function(k){ f.green[k] = _FAIXA_FORA_PADRAO.green[k]; });
      Object.keys(_FAIXA_FORA_PADRAO.gold).forEach(function(k){ f.gold[k] = _FAIXA_FORA_PADRAO.gold[k]; });
    }
    return f;
  }
  function _faixaSalvarFora(f){
    try{ localStorage.setItem(LS_FORA, JSON.stringify(f)); }catch(e){}
  }
  /* Forma de pagamento escolhida no modal — é ela que define o
     "menor investimento" (o valor que o cliente vê na proposta). */
  function _faixaPag(){
    var el = document.getElementById('propostaPagamento');
    return el ? el.value : 'integral';
  }
  function _faixaPreco(cod){
    var p = _precos()[cod];
    if(!p) return Infinity;
    var v = p[_faixaPag()];
    return (v == null) ? Infinity : v;
  }
  /* ── MODO DE EXCEÇÃO ─────────────────────────────────────────
     Ligado, o gestor escolhe os treinamentos que devem ser
     OBRIGATORIAMENTE analisados. Eles furam a fila do menor
     investimento e entram primeiro, NA ORDEM EM QUE FORAM CLICADOS.
     Caso o cliente já os tenha, a fila normal segue e completa a faixa
     com os outros treinamentos.
     Por ser exceção, o obrigatório também passa por cima da lista
     "fora da contagem" — mas nunca por cima do par MASTER + FCIS/ML5.
     A seleção fica salva; o modo nasce DESLIGADO a cada abertura do
     modal, para não montar proposta errada sem querer. */
  var LS_EXC = 'proposta_belt_excecao_v1';
  var _excAtivo = false;

  /* Lista ORDENADA: a posição é a ordem de entrada na proposta. */
  function _excLista(){
    var a = null;
    try{ a = JSON.parse(localStorage.getItem(LS_EXC)); }catch(e){}
    if(!Array.isArray(a)) return [];
    return a.filter(function(k){ return _FAIXA_GRADE.indexOf(k) !== -1; });
  }
  function _excSalvar(a){
    try{ localStorage.setItem(LS_EXC, JSON.stringify(a)); }catch(e){}
  }
  function _excOn(){ return _excAtivo && _excLista().length > 0; }

  /* ── PAR OBRIGATÓRIO ─────────────────────────────────────────
     O MASTER só pode ESTAR na proposta se o FCIS ou o ML5 também
     estiver nela — ou se o cliente já tiver um dos dois. Ele nunca
     entra sozinho: quando chega a vez dele na fila, o liberador mais
     barato entra junto, desde que haja vaga para os dois. Se não
     houver, o MASTER é pulado e a vaga vai para o próximo da fila. */
  var _FAIXA_PAR = { MASTER: ['FCIS','ML5'] };

  /* O par já está satisfeito? (adquirido ou já dentro da proposta) */
  function _parOk(k, st, dentro){
    var req = _FAIXA_PAR[k];
    if(!req) return true;
    for(var i = 0; i < req.length; i++){
      if(st[req[i]] === 'ADQUIRIDO') return true;
      if(dentro.indexOf(req[i]) !== -1) return true;
    }
    return false;
  }
  /* Liberador que dá para puxar: pendente, disponível na fila e fora da
     proposta. Escolhe o mais barato. */
  function _parPuxavel(k, fila, dentro){
    var req = _FAIXA_PAR[k];
    if(!req) return null;
    var op = req.filter(function(x){ return fila.indexOf(x) !== -1 && dentro.indexOf(x) === -1; })
                .sort(function(a, b){ return _faixaPreco(a) - _faixaPreco(b); });
    return op.length ? op[0] : null;
  }
  /* Monta a seleção passo a passo, puxando o liberador quando preciso. */
  function _faixaMontar(fila, vagas, st){
    var selec = [], guard = 0;
    while(selec.length < vagas && guard++ < 60){
      var entrar = null;
      for(var i = 0; i < fila.length; i++){
        var k = fila[i];
        if(selec.indexOf(k) !== -1) continue;
        if(_parOk(k, st, selec)){ entrar = [k]; break; }
        var lib = _parPuxavel(k, fila, selec);
        if(lib && (selec.length + 2) <= vagas){ entrar = [lib, k]; break; }
      }
      if(entrar === null) break;
      for(var j = 0; j < entrar.length; j++) selec.push(entrar[j]);
    }
    return selec;
  }


  /* Treinamentos que vão SEMPRE para o fim da fila, independente do preço:
     só são escolhidos quando não sobrou mais nada que conte para a faixa.
     Regra do gestor: o TAV é sempre o último, no Green e no Golden. */
  var _FAIXA_ULTIMO = { TAV:true };

  /* Grade ordenada do mais barato ao mais caro; os "últimos" vão para o fim;
     empate de preço desfeito pela ordem da grade. */
  function _faixaOrdenada(){
    return _FAIXA_GRADE.map(function(k,i){ return {k:k, i:i}; })
      .sort(function(a,b){
        var ua = _FAIXA_ULTIMO[a.k] ? 1 : 0, ub = _FAIXA_ULTIMO[b.k] ? 1 : 0;
        if(ua !== ub) return ua - ub;
        return (_faixaPreco(a.k) - _faixaPreco(b.k)) || (a.i - b.i);
      })
      .map(function(x){ return x.k; });
  }
  /* A REGRA. rec = registro do cliente na grade da turma. */
  function _faixaCalcular(modo, rec){
    var meta = _FAIXA_META[modo];
    var fora = _faixaFora()[modo] || {};
    var st   = (rec && rec.status) ? rec.status : {};

    /* Modo de Exceção: os obrigatórios furam a fila e o "fora da contagem" */
    var excOn   = _excOn();
    var obrig   = excOn ? _excLista() : [];
    var ehObrig = function(k){ return obrig.indexOf(k) !== -1; };
    var conta   = function(k){ return !fora[k] || ehObrig(k); };

    var jaTem   = _FAIXA_GRADE.filter(function(k){ return conta(k) && st[k] === 'ADQUIRIDO'; });
    var foraAdq = _FAIXA_GRADE.filter(function(k){ return !conta(k) && st[k] === 'ADQUIRIDO'; });
    var faltam  = meta - jaTem.length;
    var pend    = _faixaOrdenada().filter(function(k){ return conta(k) && st[k] === 'PENDENTE'; });
    /* Obrigatórios na ORDEM DE CLIQUE à frente; depois a fila normal */
    var cand    = obrig.filter(function(k){ return pend.indexOf(k) !== -1; })
                       .concat(pend.filter(function(k){ return !ehObrig(k); }));
    var marcar  = _faixaMontar(cand, Math.max(0, faltam), st);
    /* BARRADO = pendente que ficou de fora porque o par não foi satisfeito:
       nem adquirido, nem entrou nesta proposta. */
    var bloq    = cand.filter(function(k){
      return marcar.indexOf(k) === -1 && !_parOk(k, st, marcar);
    });
    var semInfo = _FAIXA_GRADE.filter(function(k){ return !st[k]; });

    return { modo:modo, meta:meta, jaTem:jaTem, foraAdq:foraAdq, faltam:faltam,
             marcar:marcar, cand:cand, bloqueados:bloq, semInfo:semInfo, fora:fora,
             excAtivo: excOn, excObrig: obrig,
             excTem:   obrig.filter(function(k){ return st[k] === 'ADQUIRIDO'; }),
             excFalta: obrig.filter(function(k){ return st[k] !== 'ADQUIRIDO'; }),
             excEntrou: marcar.filter(ehObrig),
             completa: faltam <= 0,
             insuficiente: faltam > cand.length,
             totalFinal: jaTem.length + marcar.length + foraAdq.length };
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
  /* Fallback JSONP (gviz) — o Google NÃO manda cabeçalho CORS nos endpoints de
     CSV, então o fetch() sempre morre com "Failed to fetch" mesmo com a planilha
     pública (e pior ainda com a página aberta em file://). Carregando por <script>
     não existe CORS: o gviz devolve o conteúdo já embrulhado no nosso callback.
     headers=1 = títulos vêm em cols[].label (obrigatório: coluna de CHECKBOX
     tipada boolean descartaria o texto do cabeçalho); remontamos o AOA. */
  function _gvizJsonp(id, gid){
    if(typeof window._gvizAOA === 'function') return window._gvizAOA(id, gid);
    return new Promise(function(resolve, reject){
      var cb = '_beltGviz' + Date.now() + Math.floor(Math.random()*1000);
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
            if(!cel || (cel.v == null && cel.f == null)) { linha.push(''); continue; }
            if(cel.f != null)                 linha.push(String(cel.f));
            else if(typeof cel.v === 'boolean') linha.push(cel.v ? 'TRUE' : 'FALSE');
            else                                linha.push(String(cel.v));
          }
          return linha;
        });
        if(header.some(function(h){ return h !== ''; })) aoa.unshift(header);
        resolve(aoa);
      };
      s.src = 'https://docs.google.com/spreadsheets/d/' + id +
              '/gviz/tq?tqx=out:json;responseHandler:' + cb + '&headers=1&gid=' + gid;
      s.onerror = function(){ limpar(); reject(new Error('não consegui abrir a planilha (link privado?)')); };
      document.head.appendChild(s);
    });
  }

  function _beltLerLink(){
    var inp = document.getElementById('beltLink');
    var url = inp ? inp.value.trim() : '';
    if(!url){ _setStatus('Cole o link da planilha primeiro.', true); return; }
    _setStatus('Lendo link…', false);
    var urls = _googleSheetCsvUrls(url);
    var mId  = url.match(/\/spreadsheets\/d\/(?!e\/)([a-zA-Z0-9-_]+)/);
    var mGid = url.match(/[#&?]gid=(\d+)/);
    var ultimoErro = '';
    function desistir(){
      _setStatus('Não consegui ler o link (' + (ultimoErro||'falhou') + ').<br>' +
        'Use <b>Arquivo → Compartilhar → Qualquer pessoa com o link (Leitor)</b> ' +
        'OU <b>Arquivo → Compartilhar → Publicar na web → CSV</b> e cole o link gerado.<br>' +
        '<span style="font-size:10px;">Se a planilha já está compartilhada, baixe-a ' +
        '(<b>Arquivo → Fazer download → .xlsx</b>) e use o botão <b>Escolher arquivo</b>.</span>', true);
    }
    (function tentar(i){
      if(i >= urls.length){
        // último recurso: JSONP, imune a CORS (só serve para link normal /d/<id>)
        if(mId){
          _setStatus('Lendo link (modo alternativo)…', false);
          _gvizJsonp(mId[1], mGid ? mGid[1] : '0')
            .then(function(aoa){ _processar([], 'via link · gid ' + (mGid?mGid[1]:'0'), aoa); })
            .catch(function(e){ ultimoErro = (e && e.message) || e; desistir(); });
          return;
        }
        desistir();
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
    var gr = document.getElementById('btnGreenBelt');
    var go = document.getElementById('btnGoldenBelt');
    if(gr){ gr.style.boxShadow = (ativo==='green') ? '0 0 0 2px #34d399 inset' : ''; gr.innerHTML = (ativo==='green' ? '✓ ' : '🟢 ') + 'Green Belt'; }
    if(go){ go.style.boxShadow = (ativo==='gold')  ? '0 0 0 2px #f5c451 inset' : ''; go.innerHTML = (ativo==='gold'  ? '✓ ' : '🥇 ') + 'Golden Belt'; }
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
  function _beltAplicar(modo){ // 'elite' | 'legacy' | 'green' | 'gold'
    var nome = _clienteSelecionado();
    var eFaixa = (modo === 'green' || modo === 'gold');
    var rotulo = eFaixa ? _FAIXA_NOME[modo]
               : ((modo==='legacy'?'Legacy':'Elite') + ' Belt');

    // TOGGLE: mesma modalidade + mesmo cliente → desmarca
    if(window._beltAtivo === modo && window._beltAtivoCliente === nome){
      _beltDesmarcarConjunto();
      window._beltAtivo = null; window._beltAtivoCliente = null; window._beltMarcados = [];
      _beltAtualizarBotoes(null);
      /* Faixa também governa o texto da Seção I — ao desmarcar, volta ao GGB. */
      if(eFaixa && typeof window._introSelecionar === 'function') window._introSelecionar('ggb');
      if(typeof window._propostaRecalcular === 'function') window._propostaRecalcular();
      _setStatus('Seleção do ' + rotulo + ' removida.', false);
      _beltSetChip(window._beltMapa ? (window._beltMapa.totalClientes + ' clientes') : 'sem grade', window._beltMapa ? 'ok' : 'none');
      return;
    }

    if(!nome){ if(window._showToast)_showToast('⚠️ Selecione um cliente primeiro.','var(--amber)'); _setStatus('Selecione o cliente no campo acima.', true); _beltSetChip('selecione o cliente','warn'); return; }
    if(!window._beltMapa){ if(window._showToast)_showToast('⚠️ Carregue a grade da turma.','var(--amber)'); _setStatus('Carregue a grade da turma (link ou arquivo) antes.', true); _beltSetChip('carregue a grade','warn'); _beltExpandir(true); return; }

    var rec = _acharCliente(nome);
    if(!rec){
      var amb = _beltAmbiguo;
      _setStatus('Cliente "<b>'+nome+'</b>" não encontrado no mapeamento.'
        + (amb ? '<br><span style="color:var(--amber)">O nome é ambíguo: casa com <b>' + amb.join('</b> e <b>')
                 + '</b>. Escreva o nome completo para eu não pegar o cliente errado.</span>'
               : '<br>Confira se o nome bate com a planilha.'), true);
      _beltSetChip(amb ? 'nome ambíguo' : 'cliente não achado','warn'); _beltExpandir(true); return;
    }

    /* ── Ramo GREEN / GOLDEN BELT ─────────────────────────────── */
    if(eFaixa){
      var r = _faixaCalcular(modo, rec);
      var contFx = document.getElementById('propostaTreinamentos');
      if(!contFx){ _setStatus('Modal de treinamentos não está pronto.', true); return; }

      if(r.completa){
        _setStatus('<b>'+rotulo+'</b> · '+rec.nome
          + '<br><span style="color:var(--amber)">Ele já fechou a faixa: '+r.jaTem.length+' de '+r.meta
          + ' treinamentos que contam ('+r.jaTem.join(', ')+'). Nada a propor.</span>', false);
        _beltSetChip('faixa já fechada', 'warn');
        return;
      }

      var marcarFx = r.marcar.slice();
      contFx.querySelectorAll('input[type=checkbox]').forEach(function(chk){
        chk.checked = marcarFx.indexOf(chk.id.replace('prop_','')) !== -1;
      });
      window._beltAtivo = modo; window._beltAtivoCliente = nome; window._beltMarcados = marcarFx.slice();
      _beltAtualizarBotoes(modo);
      _beltSetChip(rotulo + ' · ' + marcarFx.length + ' itens', 'info');
      /* A faixa manda no texto da Seção I */
      if(typeof window._introSelecionar === 'function') window._introSelecionar(modo === 'green' ? 'greenbelt' : 'goldenbelt');
      if(typeof window._propostaRecalcular === 'function') window._propostaRecalcular();

      var hFx = '';
      if(r.excAtivo){
        var _rot = function(k){ return _FAIXA_ROTULO[k] || k; };
        hFx += '<div style="margin-bottom:5px;padding:6px 9px;border-radius:6px;'
             + 'background:rgba(255,183,64,.10);border:1px solid rgba(255,183,64,.35);color:#f0b429;">'
             + '⚠ <b>Modo de Exceção</b> · '
             + r.excObrig.map(function(k,i){ return (i+1) + 'º ' + _rot(k); }).join(' → ')
             + (r.excEntrou.length ? '<br>Entrou(entraram) na frente da fila: <b>' + r.excEntrou.map(_rot).join(', ') + '</b>.' : '')
             + (r.excTem.length ? '<br>Ele já tem: <b>' + r.excTem.map(_rot).join(', ') + '</b> — a fila normal completou a faixa.' : '')
             + '</div>';
      }
      hFx += '<b>'+rotulo+'</b> · ' + rec.nome
        + '<br>Marcados ('+marcarFx.length+'): ' + (marcarFx.length ? marcarFx.join(', ') : '—')
        + '<br><span style="color:var(--muted)">Já contam para a faixa: '
        + (r.jaTem.length ? r.jaTem.join(', ') : '—') + ' · meta de ' + r.meta + ' → faltavam ' + r.faltam + '</span>';
      if(r.foraAdq.length){
        hFx += '<br><span style="color:var(--muted)">Fora da contagem e ele já tem: '+r.foraAdq.join(', ')
             + ' — fecha com <b>'+r.totalFinal+' treinamentos no total</b>.</span>';
      }
      if(r.bloqueados.length){
        hFx += '<br><span style="color:#a78bfa">🔒 Barrado: ' + r.bloqueados.map(function(k){
          return '<b>' + k + '</b> (exige ' + _FAIXA_PAR[k].join(' ou ') + ' na mesma proposta)';
        }).join(', ') + ' — a vaga foi para o próximo da fila.</span>';
      }
      if(r.insuficiente){
        hFx += '<br><span style="color:var(--amber)">Não fecha a faixa: faltavam '+r.faltam
             + ' e só havia '+r.cand.length+' pendente(s) na grade.</span>';
      }
      if(r.semInfo.length){
        hFx += '<br><span style="color:var(--amber)">⚠ Sem informação na planilha — <b>'+rec.nome
             + '</b> está em branco em: <b>'+r.semInfo.join(', ')+'</b>. '
             + 'Esses ficaram de fora da conta.</span>';
      }
      /* Colunas da planilha que o leitor não reconheceu: é a causa mais comum
         de um treinamento "sumir" da regra (ex.: cabeçalho do TAV ou do CIS
         escrito de um jeito que não está no mapa de colunas). */
      if(window._beltMapa.desconhecidas && window._beltMapa.desconhecidas.length){
        hFx += '<br><span style="color:var(--amber)">⚠ Colunas ignoradas no mapeamento: <b>'
             + window._beltMapa.desconhecidas.join(', ') + '</b> — não entraram na conta.</span>';
      }
      /* Leitura completa da grade para este cliente — mostra de onde veio cada decisão */
      hFx += '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">'
        + _FAIXA_GRADE.map(function(k){
            var rot = _FAIXA_ROTULO[k] || k;
            var st  = rec.status[k];
            var cor, txt;
            if(r.fora[k])                { cor = 'rgba(255,183,64,.14);color:#f0b429';  txt = rot + ' ∅'; }
            else if(r.bloqueados.indexOf(k) !== -1){ cor = 'rgba(167,139,250,.16);color:#a78bfa'; txt = rot + ' 🔒'; }
            else if(st === 'ADQUIRIDO')  { cor = 'rgba(86,211,100,.12);color:#56d364';  txt = rot + ' ✓'; }
            else if(marcarFx.indexOf(k) !== -1){ cor = 'rgba(200,240,90,.16);color:var(--accent)'; txt = rot + ' +'; }
            else if(st === 'PENDENTE')   { cor = 'rgba(255,255,255,.06);color:var(--muted)'; txt = rot; }
            else                         { cor = 'rgba(255,95,87,.12);color:#fca5a5';   txt = rot + ' ?'; }
            return '<span style="font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:20px;background:'+cor+';">'+txt+'</span>';
          }).join('')
        + '</div>'
        + '<div style="color:var(--muted);font-size:9.5px;margin-top:3px;">'
        + '✓ já tem · + entra na proposta · ∅ fora da contagem · 🔒 barrado (falta o par) · ? sem informação na planilha · sem marca = pendente que não coube</div>';
      hFx += '<br><span style="color:var(--muted);font-size:10px;">Clique de novo no botão para desmarcar. Revise antes de gerar o PDF.</span>';
      _setStatus(hFx, false);
      return;
    }

    /* Elite/Legacy não usam texto de faixa — se vinha de Green/Golden, solta. */
    if(typeof window._introLimparFaixa === 'function') window._introLimparFaixa();

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
    green: 'Existe um marco na jornada Febracis que separa quem experimenta de quem assume: o Green Belt. Ele não é um certificado pendurado na parede — é o reconhecimento de que você percorreu uma formação consistente e transformou conhecimento em prática nas suas emoções, nas suas finanças, na sua carreira e nos seus relacionamentos. Você já está nesse caminho, e falta menos do que imagina para chegar lá. Os treinamentos desta proposta são exatamente os que completam a sua faixa e firmam o seu nome entre os que levaram a própria evolução a sério. O Green Belt está ao seu alcance. Conquiste-o.',
    gold: 'Poucos chegam ao Golden Belt, e não é por acaso: ele exige a formação completa, o percurso inteiro, sem atalhos. É a mais alta distinção da jornada Febracis, reservada a quem levou o próprio desenvolvimento até o fim e converteu cada treinamento em resultado real na vida e nos negócios. Você já provou que tem disciplina para começar e constância para seguir — agora está a poucos passos de fechar o ciclo. Os treinamentos desta proposta são os que faltam para completar a sua formação e colocar o seu nome onde estão os que não se contentaram com metade do caminho. O Golden Belt é o seu próximo lugar. Assuma-o.',
    legacy: 'Você já demonstrou um nível de comprometimento, disciplina e evolução que o diferencia da maioria das pessoas. Sua trajetória revela a coragem de investir em si mesmo, superar desafios e buscar continuamente a sua melhor versão. Hoje, você faz parte de um grupo seleto de indivíduos que não aceitam viver no padrão comum, mas escolhem a excelência como estilo de vida. Agora, resta apenas concluir os treinamentos pendentes para consolidar essa jornada e ocupar definitivamente um lugar entre aqueles que transformam conhecimento em resultados, influência e referência para os que estão ao seu redor. Parabéns Golden Belt. Esse é o seu legado.'
  };
  /* Retorna o texto da modalidade ativa, ou null (gerador usa o texto padrão). */
  function _beltTextoIntro(){
    return (window._beltAtivo && _BELT_TEXTOS[window._beltAtivo]) || null;
  }
  /* ── Painel de configuração "fora da contagem" (Green / Golden) ──
     Fica no modal, abaixo dos botões de faixa. A escolha é salva e
     vale para a proposta individual e para o lote. */
  var _FAIXA_ROTULO = { CIS_GLOBAL:'CIS' };
  function _faixaConfigRender(){
    var box = document.getElementById('propFaixaFora');
    if(!box) return;
    var f = _faixaFora();
    var linhas = _FAIXA_GRADE.map(function(k){
      var nome = _FAIXA_ROTULO[k] || k;
      var cel = function(modo){
        return '<td style="text-align:center;padding:3px 4px;">'
             + '<input type="checkbox" ' + (f[modo][k] ? 'checked ' : '')
             + 'onchange="_faixaConfigToggle(\'' + modo + '\',\'' + k + '\')" '
             + 'style="width:15px;height:15px;accent-color:var(--accent);cursor:pointer;"></td>';
      };
      return '<tr><td style="padding:3px 4px;font-weight:700;">' + nome + '</td>'
           + cel('green') + cel('gold') + '</tr>';
    }).join('');

    /* Aviso quando sobrou treinamento de menos para a meta */
    var avisos = [];
    [['green','Green',5], ['gold','Golden',8]].forEach(function(m){
      var disp = _FAIXA_GRADE.filter(function(k){ return !f[m[0]][k]; }).length;
      if(disp < m[2]) avisos.push(m[1] + ': meta ' + m[2] + ', mas só ' + disp + ' na contagem — a faixa nunca fecha.');
    });

    box.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:10.5px;">'
      + '<tr><th style="text-align:left;padding:3px 4px;color:var(--muted);font-size:9px;letter-spacing:.06em;">Treinamento</th>'
      + '<th style="padding:3px 4px;color:#34d399;font-size:9px;">FORA DO GREEN</th>'
      + '<th style="padding:3px 4px;color:#f5c451;font-size:9px;">FORA DO GOLDEN</th></tr>'
      + linhas + '</table>'
      + (avisos.length ? '<div style="color:var(--amber);font-size:10px;margin-top:6px;line-height:1.5;">' + avisos.join('<br>') + '</div>' : '')
      + '<div style="color:var(--muted);font-size:10px;margin-top:6px;line-height:1.45;">'
      + 'O marcado não ocupa vaga na meta e nunca entra na proposta. A escolha fica salva.<br>'
      + 'Padrão: o CIS fica fora da contagem nas duas faixas — Green fecha com 6 (CIS + 5) e Golden com 9 (CIS + 8).</div>';
  }
  function _faixaConfigToggle(modo, key){
    var f = _faixaFora();
    f[modo][key] = !f[modo][key];
    _faixaSalvarFora(f);
    _faixaConfigRender();
    /* Se a faixa está ativa, reaplica para refletir na hora */
    if(window._beltAtivo === 'green' || window._beltAtivo === 'gold'){
      var m = window._beltAtivo;
      window._beltAtivo = null;           /* evita o toggle de desmarcar */
      _beltAplicar(m);
    }
  }
  /* ── UI do Modo de Exceção ─────────────────────────────────── */
  function _excRender(){
    var bt = document.getElementById('btnModoExcecao');
    if(!bt) return;
    var lista = _excLista();

    bt.style.background  = _excAtivo ? 'rgba(255,183,64,.20)' : 'var(--surface2)';
    bt.style.borderColor = _excAtivo ? 'rgba(255,183,64,.65)' : 'var(--border2)';
    bt.style.color       = _excAtivo ? '#f0b429' : 'var(--muted)';
    bt.style.boxShadow   = _excAtivo ? '0 0 0 2px rgba(255,183,64,.35) inset' : '';
    bt.innerHTML = (_excAtivo ? '\u26A0 Modo de Exceção LIGADO' : '\u26A0 Modo de Exceção')
                 + (_excAtivo && lista.length ? ' \u00b7 ' + lista.length : '');

    var pn = document.getElementById('propExcPainel');
    if(pn) pn.style.display = _excAtivo ? 'block' : 'none';
    if(!_excAtivo) return;

    var ch = document.getElementById('propExcChips');
    if(ch){
      ch.innerHTML = _FAIXA_GRADE.map(function(k){
        var pos = lista.indexOf(k);
        var nome = _FAIXA_ROTULO[k] || k;
        return '<button type="button" onclick="_excItem(\'' + k + '\')" '
          + 'style="flex:0 0 auto;height:27px;padding:0 9px;border-radius:var(--radius-sm);'
          + 'font-size:10.5px;font-weight:700;cursor:pointer;font-family:\'DM Sans\',sans-serif;'
          + 'letter-spacing:.03em;transition:all .15s;display:inline-flex;align-items:center;gap:4px;'
          + (pos >= 0 ? 'background:rgba(255,183,64,.20);border:1px solid rgba(255,183,64,.6);color:#f0b429;'
                      : 'background:var(--surface);border:1px solid var(--border2);color:var(--muted);')
          + '">'
          + (pos >= 0 ? '<span style="background:rgba(255,183,64,.3);border-radius:20px;padding:1px 5px;font-size:9px;">'
                        + (pos+1) + '\u00ba</span>' : '')
          + nome + '</button>';
      }).join('');
    }
    var rs = document.getElementById('propExcOrdem');
    if(rs){
      rs.innerHTML = lista.length
        ? 'Ordem de entrada: <b style="color:#f0b429;">'
          + lista.map(function(k,i){ return (i+1) + '\u00ba ' + (_FAIXA_ROTULO[k] || k); }).join(' \u2192 ') + '</b>'
        : '<span style="color:var(--amber)">Clique nos treinamentos na ordem em que devem entrar. Sem nenhum, o modo não muda nada.</span>';
    }
  }
  function _excToggle(){
    _excAtivo = !_excAtivo;
    _excRender();
    _excReaplicar();
  }
  function _excItem(k){
    var a = _excLista();
    var i = a.indexOf(k);
    if(i >= 0) a.splice(i, 1); else a.push(k);   /* o clique define a ordem */
    _excSalvar(a);
    _excRender();
    _excReaplicar();
  }
  /* Refaz a seleção da faixa ativa para refletir na hora */
  function _excReaplicar(){
    if(window._beltAtivo === 'green' || window._beltAtivo === 'gold'){
      var m = window._beltAtivo;
      window._beltAtivo = null;
      _beltAplicar(m);
    }
  }

  function _faixaToggleAcc(){
    var b = document.getElementById('propFaixaAccBody');
    var c = document.getElementById('propFaixaCaret');
    var abrir = !(b && b.style.display === 'block');
    if(b) b.style.display = abrir ? 'block' : 'none';
    if(c) c.style.transform = abrir ? 'rotate(180deg)' : '';
  }

  /* Limpa a modalidade ativa (chamado ao (re)abrir o modal de proposta) */
  function _beltReset(){
    window._beltAtivo = null; window._beltAtivoCliente = null; window._beltMarcados = [];
    _beltAtualizarBotoes(null);
    _beltExpandir(false);
    if(window._beltMapa) _beltSetChip(window._beltMapa.totalClientes + ' clientes', 'ok');
    else _beltSetChip('sem grade', 'none');
    _faixaConfigRender();
    _excAtivo = false;      /* o Modo de Exceção nunca vem ligado de fábrica */
    _excRender();
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
    if(!window.confirm('Selecionar todos os clientes do consultor ' + c + ' (' + nomes.length + ')?\n\nVai montar as propostas de todos de uma vez (Elite / Legacy / Green Belt / Golden Belt).')) return;
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
      var motivo = rec ? null : _beltMotivoNaoAchou();
      var temCI = _loteTemCI(rec);
      var pend = rec ? _lotePendBase(rec) : [];
      var tem = rec ? Object.keys(rec.status).filter(function(k){ return rec.status[k] === 'ADQUIRIDO'; }) : [];
      /* Nome com que a planilha casou — quando difere, o gestor precisa ver */
      var casado = (rec && _norm(rec.nome) !== _norm(nome)) ? rec.nome : null;
      return { nome: nome, rec: rec, motivoSemRec: motivo, casado: casado,
               temCI: temCI, pend: pend, tem: tem, incluir: [], qtd: {}, modalidade: 'elite' };
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
      c.qtd = {}; /* troca de modo reconstrói a lista → zera as quantidades (tudo volta a 1) */
      if(!c.rec){ c.incluir = []; c.modalidade = 'elite'; return; }
      if(m === 'green' || m === 'gold'){
        /* Mesma regra da proposta individual, cliente a cliente. */
        var rf = _faixaCalcular(m, c.rec);
        c.modalidade = m;
        c.faixa = rf;
        c.incluir = rf.completa ? [] : rf.marcar.slice();
        return;
      }
      c.faixa = null;
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

  /* Quantidade de um treinamento incluído (default 1 quando presente). */
  function _loteQtd(c, cod){
    if(c.incluir.indexOf(cod) === -1) return 0;
    return (c.qtd && c.qtd[cod]) ? c.qtd[cod] : 1;
  }
  /* Clique no card do seletor: 1ª vez inclui (×1); cliques seguintes somam +1. */
  function _loteIncTreino(idx, cod){
    var c = _lote.clientes[idx]; if(!c) return;
    if(!c.qtd) c.qtd = {};
    if(c.incluir.indexOf(cod) === -1){ c.incluir.push(cod); c.qtd[cod] = 1; }
    else { c.qtd[cod] = (c.qtd[cod] || 1) + 1; }
    _loteRender();
    if(document.getElementById('beltSelOverlay') && document.getElementById('beltSelOverlay').classList.contains('open')) _loteSelGrid();
  }
  /* Remove por completo o treinamento (✕). */
  function _loteRemoveTreino(idx, cod){
    var c = _lote.clientes[idx]; if(!c) return;
    var k = c.incluir.indexOf(cod);
    if(k !== -1) c.incluir.splice(k, 1);
    if(c.qtd) delete c.qtd[cod];
    _loteRender();
    if(document.getElementById('beltSelOverlay') && document.getElementById('beltSelOverlay').classList.contains('open')) _loteSelGrid();
  }

  function _loteToggleTreino(idx, cod){
    var c = _lote.clientes[idx]; if(!c) return;
    if(!c.qtd) c.qtd = {};
    var k = c.incluir.indexOf(cod);
    if(k === -1){ c.incluir.push(cod); c.qtd[cod] = 1; }
    else { c.incluir.splice(k, 1); delete c.qtd[cod]; }
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
      var n = _loteQtd(c, cod);
      var b = document.createElement('button');
      /* No Manual tudo é clicável — inclusive os já possuídos (permite readicionar o CI).
         Clique no card = +1 quantidade; clique no ✕ = remove. */
      b.className = 'belt-topt' + (incluso ? ' inc' : '');
      var sub = incluso ? ('×' + n + ' · clique p/ +1') : (jaTem ? 'já possui · add' : nome.slice(0,16));
      b.innerHTML = cod + '<small>' + sub + '</small>' + (incluso ? '<span class="belt-qx" title="Remover">✕</span>' : '');
      b.onclick = function(ev){
        if(ev && ev.target && ev.target.classList && ev.target.classList.contains('belt-qx')){
          _loteRemoveTreino(_loteSelIdx, cod);
        } else {
          _loteIncTreino(_loteSelIdx, cod);
        }
      };
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
      var selec = c.incluir.map(function(cod){ var q = _loteQtd(c, cod); return { nome: cod, val: _lotePreco(cod, pag) * q, qty: q }; });
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

  /* Gera 1 PDF apenas do cliente do índice (botão "Gerar só este"). */
  function _loteGerarUm(idx){
    var c = _lote && _lote.clientes ? _lote.clientes[idx] : null;
    if(!c) return;
    if(!c.incluir.length){
      if(window._showToast) _showToast('⚠️ ' + c.nome + ' — sem treinamentos a incluir.','var(--amber)');
      return;
    }
    var pag = _lote.pagamento, pagLabel = _lote.pagLabel;
    var selec = c.incluir.map(function(cod){ var q = _loteQtd(c, cod); return { nome: cod, val: _lotePreco(cod, pag) * q, qty: q }; });
    var total = selec.reduce(function(a,s){ return a + (s.val||0); }, 0);
    var item = {
      cliente: c.nome, consultor: _lote.consultor, pagamento: pag, pagLabel: pagLabel,
      selecionados: selec, total: total,
      txtIntro: (_BELT_TEXTOS[c.modalidade] || null)
    };
    if(typeof window.gerarPropostaLotePDF === 'function'){
      window.gerarPropostaLotePDF([item], 'Proposta ' + String(c.nome).toUpperCase() + '.pdf');
    }
    if(window._showToast) _showToast('📄 Proposta de ' + c.nome + ' gerada.','var(--accent)');
  }

  function _loteRender(){
    _loteGarantirOverlay();
    var manual = (_lote.modo === 'manual');
    var inc = [], pul = [];
    _lote.clientes.forEach(function(c, i){
      /* No Manual TODOS sobem para a lista editável (até quem seria pulado),
         pra poder ajustar. Nos outros modos, pulados ficam separados. */
      if(manual){ inc.push({c:c, i:i}); return; }
      if(!c.rec){ pul.push({c:c, motivo: c.motivoSemRec || 'não está no mapeamento'}); return; }
      if(!c.incluir.length){
        pul.push({c:c, motivo: (c.faixa && c.faixa.completa)
          ? ('já fechou a faixa (' + c.faixa.jaTem.length + '/' + c.faixa.meta + ')')
          : (c.faixa ? 'sem pendente na grade' : 'sem treinamentos a incluir') });
        return;
      }
      inc.push({c:c, i:i});
    });
    var geraveis = _lote.clientes.filter(function(c){ return c.incluir.length > 0; }).length;
    // botões de modo
    ['elite','legacy','green','gold','manual'].forEach(function(m){
      var b = document.getElementById('beltLoteModo-'+m);
      if(b) b.classList.toggle('on', _lote.modo === m);
    });
    var hint = document.getElementById('beltLoteHint');
    if(hint) hint.textContent = (_lote.modo==='elite') ? 'All Elite: cada cliente recebe seus pendentes, sem CI.'
      : (_lote.modo==='legacy') ? 'All Legacy: cada cliente recebe seus pendentes + CI (quem já tem CI não recebe de novo).'
      : (_lote.modo==='green') ? ('All Green: para cada cliente, os pendentes mais baratos até fechar 5.' + (_excOn() ? ' ⚠ Modo de Exceção ligado: ' + _excLista().join(' → ') + ' entram primeiro.' : ''))
      : (_lote.modo==='gold') ? ('All Golden: para cada cliente, os pendentes mais baratos até fechar 8.' + (_excOn() ? ' ⚠ Modo de Exceção ligado: ' + _excLista().join(' → ') + ' entram primeiro.' : ''))
      : 'Manual: todos os clientes ficam editáveis. Clique num treinamento âmbar para remover; "+ treino" abre o seletor.';

    /* Aviso de células em branco na planilha — nomeia cliente e treinamento */
    var elVaz = document.getElementById('beltLoteVazios');
    if(elVaz){
      var vazios = _lote.clientes.filter(function(c){ return c.rec; })
        .map(function(c){ return { nome:c.nome, cols:_FAIXA_GRADE.filter(function(k){ return !c.rec.status[k]; }) }; })
        .filter(function(v){ return v.cols.length; });
      if(vazios.length && (_lote.modo==='green' || _lote.modo==='gold')){
        elVaz.style.display = 'block';
        elVaz.innerHTML = '<b>&#9888; Células em branco na planilha &middot; '+vazios.length+' cliente(s)</b>'
          + '<div style="margin-top:5px;max-height:150px;overflow-y:auto;">'
          + vazios.map(function(v){ return '<div><b>'+v.nome+'</b> — sem informação em: '+v.cols.join(', ')+'</div>'; }).join('')
          + '</div><div style="opacity:.75;margin-top:5px;">Ficaram de fora da conta desses clientes.</div>';
      } else { elVaz.style.display = 'none'; elVaz.innerHTML = ''; }
    }

    var html = '';
    inc.forEach(function(o){
      var c = o.c, i = o.i;
      var badge = c.modalidade==='legacy' ? '<span class="belt-bdg bg-legacy">Legacy</span>'
                : c.modalidade==='green'  ? '<span class="belt-bdg bg-green">Green</span>'
                : c.modalidade==='gold'   ? '<span class="belt-bdg bg-gold">Golden</span>'
                : '<span class="belt-bdg bg-elite">Elite</span>';
      var temChips = c.tem.map(function(t){ return '<span class="belt-chip '+(t==='CI'?'c-ci':'c-has')+'">'+t+'</span>'; }).join('') || '<span style="color:var(--muted);font-size:10px;">—</span>';
      var incChips;
      if(manual){
        incChips = (c.incluir.length
          ? c.incluir.map(function(t){ var q=_loteQtd(c,t); return '<span class="belt-chip c-inc edit '+(t==='CI'?'c-ci':'')+'" onclick="_beltLoteToggleTreino('+i+',\''+t+'\')" title="remover">'+t+(q>1?' ×'+q:'')+' ✕</span>'; }).join('')
          : '<span style="color:var(--muted);font-size:10px;">nenhum</span>')
          + ' <span class="belt-chip c-add" onclick="_beltLoteAddTreino('+i+')">+ treino</span>';
      } else {
        incChips = c.incluir.map(function(t){ var q=_loteQtd(c,t); return '<span class="belt-chip '+(t==='CI'?'c-ci':'c-inc')+'">'+t+(q>1?' ×'+q:'')+'</span>'; }).join('');
        if(c.faixa && c.faixa.bloqueados && c.faixa.bloqueados.length){
          incChips += c.faixa.bloqueados.map(function(t){
            return '<span class="belt-chip" style="background:rgba(167,139,250,.16);color:#a78bfa;" title="exige '
                 + _FAIXA_PAR[t].join(' ou ') + ' na mesma proposta">' + t + ' 🔒</span>';
          }).join('');
        }
      }
      /* Botão "Gerar só este": gera 1 PDF apenas deste cliente.
         Desabilitado quando não há treinamentos a incluir (nada pra gerar). */
      var podeGerarUm = c.incluir.length > 0;
      var btnUm = '<button class="belt-cli-gerar" '+(podeGerarUm?'':'disabled')+' '
        + 'onclick="event.stopPropagation();_beltLoteGerarUm('+i+')" '
        + 'title="'+(podeGerarUm?'Gerar só a proposta deste cliente':'Sem treinamentos a incluir')+'">📄 Gerar só este</button>';
      /* Sinaliza quem não está na grade e quem casou com outro nome da planilha */
      var aviso = '';
      if(!c.rec){
        aviso = ' <span class="belt-bdg" style="background:rgba(239,68,68,.16);color:#fca5a5;">fora da grade — '
              + (c.motivoSemRec || 'não está no mapeamento') + '</span>';
      } else if(c.casado){
        aviso = ' <span class="belt-bdg" style="background:rgba(255,183,64,.16);color:#f0b429;">planilha: '
              + c.casado + '</span>';
      }
      html += '<div class="belt-cli" style="display:flex;align-items:flex-start;gap:10px;">'
        + '<div style="flex:1;min-width:0;">'
        +   '<div class="belt-cli-nome">'+c.nome+' '+badge+aviso+'</div>'
        +   '<div class="belt-chips" style="margin-bottom:4px;"><span class="belt-lbl">tem</span>'+temChips+'</div>'
        +   '<div class="belt-chips"><span class="belt-lbl">incluir</span>'+incChips+'</div>'
        + '</div>'
        + btnUm
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
    document.getElementById('beltLoteBtnGerar').textContent = '📄 Gerar todos ('+geraveis+')';
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
      +'.belt-modo.m-g{background:rgba(52,211,153,.10);border:1px solid rgba(52,211,153,.45);color:#34d399;}'
      +'.belt-modo.m-o{background:rgba(240,180,40,.14);border:1px solid rgba(240,180,40,.55);color:#f5c451;}'
      +'.belt-modos{flex-wrap:wrap;}.belt-modo{flex:1 1 128px;}'
      +'.belt-modo.on{box-shadow:0 0 0 2px currentColor inset;}'
      +'.belt-hint{font-size:11px;color:var(--muted);margin:0 0 12px;min-height:15px;}'
      +'.belt-grupo{border:1px solid var(--border2);border-radius:10px;margin-bottom:12px;overflow:hidden;}'
      +'.belt-grupo-h{padding:9px 14px;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:space-between;background:var(--surface2);}'
      +'.belt-grupo-h.skip{background:rgba(239,68,68,.10);color:#fca5a5;}'
      +'.belt-cli{padding:9px 14px;border-bottom:1px solid var(--border);}.belt-cli:last-child{border-bottom:none;}'
      +'.belt-cli-nome{font-size:12px;font-weight:700;margin-bottom:5px;display:flex;align-items:center;gap:8px;}'
      +'.belt-bdg{font-size:9px;font-weight:800;padding:1px 7px;border-radius:20px;}.bg-elite{background:rgba(240,180,40,.16);color:#f0b429;}.bg-legacy{background:rgba(167,139,250,.18);color:#a78bfa;}'
      +'.bg-green{background:rgba(52,211,153,.16);color:#34d399;}.bg-gold{background:rgba(240,180,40,.22);color:#f5c451;}'
      +'.belt-chips{display:flex;flex-wrap:wrap;gap:4px;align-items:center;}'
      +'.belt-chip{font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:20px;}'
      +'.belt-chip.c-has{background:rgba(86,211,100,.12);color:#56d364;}.belt-chip.c-inc{background:rgba(240,180,40,.16);color:#f0b429;}.belt-chip.c-ci{background:rgba(167,139,250,.18);color:#a78bfa;}'
      +'.belt-chip.edit{cursor:pointer;}.belt-chip.edit:hover{filter:brightness(1.25);}'
      +'.belt-chip.c-add{background:none;border:1px dashed var(--border2);color:var(--muted);cursor:pointer;}.belt-chip.c-add:hover{border-color:var(--accent);color:var(--accent);}'
      +'.belt-cli-gerar{flex-shrink:0;align-self:center;background:rgba(200,240,90,.10);border:1px solid rgba(200,240,90,.35);color:var(--accent);font-size:10.5px;font-weight:700;padding:6px 11px;border-radius:7px;cursor:pointer;font-family:inherit;white-space:nowrap;transition:background .15s;}'
      +'.belt-cli-gerar:hover{background:rgba(200,240,90,.2);}'
      +'.belt-cli-gerar:disabled{opacity:.4;cursor:not-allowed;}'
      +'.belt-lbl{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-right:4px;}'
      +'.belt-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:14px;border-top:1px solid var(--border);}'
      +'.belt-foot .r{font-size:12px;color:var(--muted);}.belt-foot .r b{color:var(--text);}'
      +'.belt-gerar{background:linear-gradient(180deg,#d4f565,#c8f05a);border:none;color:#0a0e1a;font-weight:800;padding:10px 18px;border-radius:9px;font-size:13px;cursor:pointer;}'
      +'.belt-x{background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;}'
      +'.belt-sel-card{width:720px;max-width:96vw;background:var(--surface);border:1px solid var(--border2);border-radius:12px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.6);}'
      +'.belt-sel-h{padding:13px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:800;}'
      +'.belt-sel-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:14px 16px;max-height:56vh;overflow:auto;}'
      +'.belt-topt{position:relative;border-radius:8px;padding:8px 5px;font-size:11px;font-weight:700;cursor:pointer;text-align:center;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-family:inherit;}'
      +'.belt-qx{position:absolute;top:2px;right:3px;width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1;}'
      +'.belt-qx:hover{background:rgba(255,95,87,.55);}'
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
      +'<button class="belt-modo m-g" id="beltLoteModo-green" onclick="_beltLoteSetModo(\'green\')">&#128994; All Green<small>fechar a faixa &middot; 5</small></button>'
      +'<button class="belt-modo m-o" id="beltLoteModo-gold" onclick="_beltLoteSetModo(\'gold\')">&#129351; All Golden<small>fechar a faixa &middot; 8</small></button>'
      +'<button class="belt-modo m-m" id="beltLoteModo-manual" onclick="_beltLoteSetModo(\'manual\')">✏️ Manual<small>editar por cliente</small></button>'
      +'</div>'
      +'<p class="belt-hint" id="beltLoteHint"></p>'
      +'<div id="beltLoteVazios" style="display:none;margin:0 0 12px;padding:10px 12px;background:rgba(255,183,64,.08);border:1px solid rgba(255,183,64,.32);border-radius:9px;font-size:11.5px;line-height:1.65;color:#f0b429;"></div>'
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
  window._beltLoteGerarUm      = _loteGerarUm;
  window._beltLoteFechar       = _loteFechar;
  window._beltLerLink       = _beltLerLink;
  window._beltArquivoChange = _beltArquivoChange;
  window._beltAplicar       = _beltAplicar;
  window._beltTextoIntro    = _beltTextoIntro;
  window._beltReset         = _beltReset;
  window._beltToggleAcc     = _beltToggleAcc;
  window._faixaConfigToggle = _faixaConfigToggle;
  window._faixaConfigRender = _faixaConfigRender;
  window._faixaToggleAcc    = _faixaToggleAcc;
  window._excToggle         = _excToggle;
  window._excItem           = _excItem;
  window._excRender         = _excRender;
  /* usado pelos testes: liga/desliga sem passar pela UI */
  window._excSet            = function(v){ _excAtivo = !!v; };
  window._faixaCalcular     = _faixaCalcular;
})();
