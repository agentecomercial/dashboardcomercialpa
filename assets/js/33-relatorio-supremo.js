/* ══════════════════════════════════════════════════════════════
   RELATÓRIO SUPREMO — gera relatório customizável da turma ativa
   para colar em WhatsApp / email da chefia. ADM-only · desktop.
══════════════════════════════════════════════════════════════ */

(function(){

  // Seções disponíveis (id, label, ícone, default-on)
  var SECOES = [
    {id:'resumo',     ico:'💰', label:'Resumo financeiro',  on:true},
    {id:'pagos',      ico:'✅', label:'Treinamentos pagos', on:true},
    {id:'entradas',   ico:'💵', label:'Entradas',           on:true},
    {id:'negociacao', ico:'🤝', label:'Em negociação',      on:true},
    {id:'aberto',     ico:'⏳', label:'Em aberto',          on:false},
    {id:'consultor',  ico:'🏆', label:'Ranking consultores',on:false},
    {id:'treinador',  ico:'🎯', label:'Ranking treinadores',on:false},
    {id:'topTrein',   ico:'📚', label:'Top treinamentos',   on:false},
    {id:'meta',       ico:'🎯', label:'Meta vs realizado',  on:false},
    {id:'assinatura', ico:'✍️', label:'Assinatura/Gerador', on:false}
  ];
  var _sel = {}; // {id: true/false}
  SECOES.forEach(function(s){ _sel[s.id]=s.on; });

  // Exibição de colunas/sufixos no relatório: liga/desliga partes da linha de detalhe.
  // consultor=true mostra "· NOME DO CONSULTOR" no final; forma=true mostra "· FORMA Nx" antes.
  var _exibir = { consultor: true, forma: true };

  // Filtro de consultores: {NOME_UPPER: true/false}. Desmarcado = fora do relatório.
  // Inicializado em _renderModal a partir dos consultores presentes na turma ativa.
  var _consSel = {};
  // Ordena as linhas de detalhe por VALOR (maior→menor) quando true; senão alfabético por cliente.
  var _ordenarValor = false;

  // Consultores presentes na turma sendo impressa (distintos, em caixa alta, sem '—').
  function _consultoresDaTurma(){
    var vistos = {};
    _coletaItens().forEach(function(it){
      var n = String(it.consultor||'').trim();
      if(n && n !== '—') vistos[n] = true;
    });
    return Object.keys(vistos).sort(function(a,b){ return a.localeCompare(b,'pt-BR'); });
  }
  // Itens da turma já filtrados pelos consultores selecionados.
  function _itensFiltrados(){
    return _coletaItens().filter(function(it){ return _consSel[it.consultor] !== false; });
  }
  // Ordena uma lista de detalhe conforme o toggle. usaEntrada → ordena por it.entrada.
  function _ordenaDetalhe(lista, usaEntrada){
    return lista.slice().sort(function(a,b){
      if(_ordenarValor){
        var va = usaEntrada ? (a.entrada||0) : (a.valor||0);
        var vb = usaEntrada ? (b.entrada||0) : (b.valor||0);
        if(vb !== va) return vb - va;
        return a.cliente.localeCompare(b.cliente,'pt-BR'); // empate → alfabético
      }
      return a.cliente.localeCompare(b.cliente,'pt-BR');
    });
  }

  function _fmtR(v){ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  function _pad(s,n){ s=String(s||''); while(s.length<n) s+=' '; return s.slice(0,n); }
  function _padL(s,n){ s=String(s||''); while(s.length<n) s=' '+s; return s; }
  function _now(){ var d=new Date(); var p=function(n){return n<10?'0'+n:n;}; return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear()+' '+p(d.getHours())+':'+p(d.getMinutes()); }

  // 'YYYY-MM-DD' → 'dd/mm' (sem ano)
  function _fmtDataCurta(iso){
    var m = String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(!m) return String(iso||'');
    return m[3]+'/'+m[2];
  }
  // 'YYYY-MM-DD' → 'dd/mm/aaaa'
  function _fmtDataLonga(iso){
    var m = String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(!m) return String(iso||'');
    return m[3]+'/'+m[2]+'/'+m[1];
  }

  function _turmaTxt(){
    var t = (typeof _turmaAtiva!=='undefined' && _turmaAtiva) ? _turmaAtiva : null;
    var nome = t && (t.titulo||t.nome) || 'TURMA';
    var per  = '';
    if(t && t.periodStart && t.periodEnd) per = _fmtDataCurta(t.periodStart)+' → '+_fmtDataLonga(t.periodEnd);
    else if(t && t.periodStart) per = 'A partir de '+_fmtDataLonga(t.periodStart);
    else if(t && t.periodEnd) per = 'Até '+_fmtDataLonga(t.periodEnd);
    return {nome:String(nome).toUpperCase(), periodo:per};
  }

  // ── COLETA DE DADOS (achata d.treinamentos[] também) ───────────
  function _coletaItens(){
    var arr = (typeof data!=='undefined' && Array.isArray(data)) ? data : [];
    var itens = []; // {cliente,treinamento,valor,entrada,status,formaPagamento,parcelas,consultor,treinador}
    arr.forEach(function(d){
      if(!d || !d.cliente) return;
      var base = {
        cliente:   String(d.cliente||'').toUpperCase(),
        consultor: String(d.consultor||'—').toUpperCase(),
        treinador: String(d.treinador||'—').toUpperCase(),
        status:    d.status||'aberto'
      };
      if(Array.isArray(d.treinamentos) && d.treinamentos.length>0){
        d.treinamentos.forEach(function(sub, i){
          if(!sub) return;
          /* Entrada via helper canônico _entradaParaSub:
             - subs pagos retornam 0 (entrada já foi consumida)
             - subs não pagos com sub.entrada própria retornam esse valor
             - o primeiro sub elegível (não pago) herda d.entrada legado quando
               nenhum sub tem entrada própria, e acumula entradas dos pagos.
             Antes a lógica local jogava d.entrada sempre em i===0, gerando
             atribuição errada (ex.: ROBSON com entrada no MENT. IA aparecendo em IF). */
          var _entFlatS = (typeof window._entradaParaSub === 'function')
            ? window._entradaParaSub(d, i)
            : (Number(sub.entrada!=null?sub.entrada:0)||0);
          itens.push(Object.assign({}, base, {
            treinamento:    String(sub.cod||d.treinamento||'—').toUpperCase(),
            valor:          Number(sub.valor!=null?sub.valor:0)||0,
            entrada:        _entFlatS,
            formaPagamento: String(sub.formaPagamento||d.formaPagamento||'').toUpperCase(),
            parcelas:       (sub.parcelas&&sub.parcelas>0)?sub.parcelas:((d.parcelas&&d.parcelas>0)?d.parcelas:1),
            status:         (sub.status||d.status||'aberto')
          }));
        });
      } else {
        itens.push(Object.assign({}, base, {
          treinamento:    String(d.treinamento||'—').toUpperCase(),
          valor:          Number(d.valor||0)||0,
          entrada:        Number(d.entrada||0)||0,
          formaPagamento: String(d.formaPagamento||'').toUpperCase(),
          parcelas:       (d.parcelas&&d.parcelas>0)?d.parcelas:1
        }));
      }
    });
    return itens;
  }


  // ── BUILDERS por seção ─────────────────────────────────────────
  var SEP_LIN = '═══════════════════════════════════════════════════';
  var SEP_DOT = '───────────────────────────────────────────────────';

  function _bResumo(itens){
    var totPago=0, qtdPago=0, totEntTotal=0, totEntPend=0, totNeg=0, qtdNeg=0;
    var clientesPagos=new Set(), clientesEntTotal=new Set(), clientesEntPend=new Set(), clientesNeg=new Set();
    /* totEntTotal = TODAS entradas (mostra que entrada foi recebida; informativo).
       totEntPend  = apenas entradas de subs NÃO-pagos (entra no TOTAL GERAL sem
                     duplicar com totPago, que já contém o valor cheio dos pagos). */
    itens.forEach(function(it){
      if(it.status==='pago'){ totPago+=it.valor; qtdPago++; clientesPagos.add(it.cliente); }
      if(it.entrada>0){ totEntTotal+=it.entrada; clientesEntTotal.add(it.cliente); }
      if(it.entrada>0 && it.status!=='pago'){ totEntPend+=it.entrada; clientesEntPend.add(it.cliente); }
      if(it.status==='negociacao'){ totNeg+=it.valor; qtdNeg++; clientesNeg.add(it.cliente); }
    });
    var tg = totPago+totEntPend; /* Soma só entradas pendentes pra não duplicar */
    return [
      SEP_LIN,
      '💰 RESUMO FINANCEIRO',
      SEP_LIN,
      'Total faturado (PAGO):    '+_padL(_fmtR(totPago),14)+'  ·  '+qtdPago+' treinamento'+(qtdPago!==1?'s':'')+'  ·  '+clientesPagos.size+' cliente'+(clientesPagos.size!==1?'s':''),
      'Total em entradas:        '+_padL(_fmtR(totEntTotal),14)+'  ·  '+clientesEntTotal.size+' cliente'+(clientesEntTotal.size!==1?'s':''),
      'Em negociação:            '+_padL(_fmtR(totNeg),14)+'  ·  '+qtdNeg+' treinamento'+(qtdNeg!==1?'s':'')+'  ·  '+clientesNeg.size+' cliente'+(clientesNeg.size!==1?'s':''),
      SEP_DOT,
      'TOTAL GERAL (receita realizada): '+_padL(_fmtR(tg),14),
      ''
    ].join('\n');
  }

  // PIX, DÉBITO e TRANSFERÊNCIA são sempre à vista — não mostra "Nx"
  function _semParcelas(forma){
    var f = String(forma||'').toUpperCase().trim();
    return f==='PIX' || f==='CARTÃO DE DÉBITO' || f==='TRANSFERÊNCIA';
  }
  function _fmtForma(it){
    if(!_exibir.forma) return '';
    if(!it.formaPagamento) return '';
    if(_semParcelas(it.formaPagamento)) return ' · '+it.formaPagamento;
    return ' · '+it.formaPagamento+(it.parcelas>1?' '+it.parcelas+'x':' 1x');
  }
  function _sufConsultor(it){
    if(!_exibir.consultor) return '';
    return ' · '+(it.consultor||'—');
  }

  function _bPagos(itens){
    var pagos = _ordenaDetalhe(itens.filter(function(it){return it.status==='pago';}), false);
    if(!pagos.length) return SEP_LIN+'\n✅ TREINAMENTOS PAGOS (0)\n'+SEP_LIN+'\nNenhum pagamento registrado.\n';
    var linhas = pagos.map(function(it,i){
      var n=String(i+1).padStart(2,'0');
      return n+'. '+_pad(it.cliente,22)+' · '+_pad(it.treinamento,15)+' · '+_padL(_fmtR(it.valor),13)+_fmtForma(it)+_sufConsultor(it);
    });
    return [
      SEP_LIN,
      '✅ TREINAMENTOS PAGOS ('+pagos.length+')',
      SEP_LIN
    ].concat(linhas).join('\n')+'\n';
  }

  function _bEntradas(itens){
    // Filtro = quem pagou entrada (it.entrada>0); valor exibido = TOTAL do produto (it.valor).
    // Ordena por valor total para casar com o número mostrado quando _ordenarValor está ligado.
    var ents = _ordenaDetalhe(itens.filter(function(it){return it.entrada>0;}), false);
    if(!ents.length) return SEP_LIN+'\n💵 ENTRADAS RECEBIDAS (0)\n'+SEP_LIN+'\nNenhuma entrada registrada.\n';
    var linhas = ents.map(function(it,i){
      var n=String(i+1).padStart(2,'0');
      // Entrada também respeita: PIX/Débito/Transferência sem "Nx"
      var pgto = (_exibir.forma && it.formaPagamento) ? (' · '+it.formaPagamento) : '';
      return n+'. '+_pad(it.cliente,22)+' · '+_pad(it.treinamento,15)+' · '+_padL(_fmtR(it.valor),13)+pgto+_sufConsultor(it);
    });
    return [
      SEP_LIN,
      '💵 ENTRADAS RECEBIDAS ('+ents.length+')',
      SEP_LIN
    ].concat(linhas).join('\n')+'\n';
  }

  function _bAberto(itens){
    var abs = _ordenaDetalhe(itens.filter(function(it){return it.status==='aberto';}), false);
    if(!abs.length) return SEP_LIN+'\n⏳ EM ABERTO (0)\n'+SEP_LIN+'\nNada em aberto.\n';
    var totAberto = abs.reduce(function(s,it){return s+(it.valor||0);},0);
    var linhas = abs.map(function(it,i){
      var n=String(i+1).padStart(2,'0');
      return n+'. '+_pad(it.cliente,22)+' · '+_pad(it.treinamento,15)+' · '+_padL(_fmtR(it.valor),13)+_sufConsultor(it);
    });
    return [
      SEP_LIN,
      '⏳ EM ABERTO ('+abs.length+' · '+_fmtR(totAberto)+')',
      SEP_LIN
    ].concat(linhas).join('\n')+'\n';
  }

  function _bNegociacao(itens){
    var neg = _ordenaDetalhe(itens.filter(function(it){return it.status==='negociacao';}), false);
    if(!neg.length) return SEP_LIN+'\n🤝 EM NEGOCIAÇÃO (0)\n'+SEP_LIN+'\nNada em negociação.\n';
    var totNeg = neg.reduce(function(s,it){return s+(it.valor||0);},0);
    var linhas = neg.map(function(it,i){
      var n=String(i+1).padStart(2,'0');
      return n+'. '+_pad(it.cliente,22)+' · '+_pad(it.treinamento,15)+' · '+_padL(_fmtR(it.valor),13)+_sufConsultor(it);
    });
    return [
      SEP_LIN,
      '🤝 EM NEGOCIAÇÃO ('+neg.length+' · '+_fmtR(totNeg)+')',
      SEP_LIN
    ].concat(linhas).join('\n')+'\n';
  }

  function _bRanking(itens, campo, titulo, ico){
    var mapa = {};
    itens.forEach(function(it){
      if(it.status!=='pago') return;
      var k = it[campo]||'—';
      if(!mapa[k]) mapa[k]={total:0, treinos:0, clientes:new Set()};
      mapa[k].total += it.valor;
      mapa[k].treinos++;
      mapa[k].clientes.add(it.cliente);
    });
    var rank = Object.keys(mapa).map(function(k){
      return {nome:k, total:mapa[k].total, treinos:mapa[k].treinos, clientes:mapa[k].clientes.size};
    }).sort(function(a,b){return b.total-a.total;});
    if(!rank.length) return SEP_LIN+'\n'+ico+' '+titulo+' (0)\n'+SEP_LIN+'\nSem dados.\n';
    var medals=['🥇','🥈','🥉'];
    var linhas = rank.slice(0,3).map(function(r,i){
      var m = medals[i] || (i+1)+'º';
      return m+' '+_pad(r.nome,22)+' · '+_padL(_fmtR(r.total),14)+'  ·  '+r.treinos+' treinamento'+(r.treinos!==1?'s':'')+'  ·  '+r.clientes+' cliente'+(r.clientes!==1?'s':'');
    });
    return [SEP_LIN, ico+' '+titulo+' (por valor pago)', SEP_LIN].concat(linhas).join('\n')+'\n';
  }

  function _bTopTreinamentos(itens){
    // Agrupa por treinamento, ordena pelo MAIS VENDIDO/NEGOCIADO (quantidade desc)
    function _agruparPor(statusAlvo){
      var mapa = {};
      itens.forEach(function(it){
        if(it.status!==statusAlvo) return;
        var k = it.treinamento||'—';
        if(!mapa[k]) mapa[k]={total:0, qtd:0};
        mapa[k].total += it.valor;
        mapa[k].qtd++;
      });
      return Object.keys(mapa).map(function(k){return {nome:k,total:mapa[k].total,qtd:mapa[k].qtd};})
                 .sort(function(a,b){return (b.qtd-a.qtd) || (b.total-a.total);});
    }
    var rankPago = _agruparPor('pago');
    var rankNeg  = _agruparPor('negociacao');
    if(!rankPago.length && !rankNeg.length){
      return SEP_LIN+'\n📚 TOP TREINAMENTOS (0)\n'+SEP_LIN+'\nSem dados.\n';
    }
    var blocos = [SEP_LIN, '📚 TOP TREINAMENTOS', SEP_LIN];
    if(rankPago.length){
      var totalPagos = rankPago.reduce(function(s,r){return s+r.total;},0);
      var totalQtdPagos = rankPago.reduce(function(s,r){return s+r.qtd;},0);
      blocos.push('');
      blocos.push('✅ PAGOS ('+rankPago.length+' treinamento'+(rankPago.length!==1?'s':'')+'):');
      rankPago.forEach(function(r,i){
        blocos.push((i+1)+'º '+_pad(r.nome,18)+' · '+_padL(_fmtR(r.total),14)+'  ·  '+r.qtd+' venda'+(r.qtd!==1?'s':''));
      });
      blocos.push('   '+_pad('TOTAL',18)+' · '+_padL(_fmtR(totalPagos),14)+'  ·  '+totalQtdPagos+' venda'+(totalQtdPagos!==1?'s':''));
    }
    if(rankNeg.length){
      var totalNegs = rankNeg.reduce(function(s,r){return s+r.total;},0);
      var totalQtdNegs = rankNeg.reduce(function(s,r){return s+r.qtd;},0);
      blocos.push('');
      blocos.push('🤝 EM NEGOCIAÇÃO ('+rankNeg.length+' treinamento'+(rankNeg.length!==1?'s':'')+'):');
      rankNeg.forEach(function(r,i){
        blocos.push((i+1)+'º '+_pad(r.nome,18)+' · '+_padL(_fmtR(r.total),14)+'  ·  '+r.qtd+' negociaç'+(r.qtd!==1?'ões':'ão'));
      });
      blocos.push('   '+_pad('TOTAL',18)+' · '+_padL(_fmtR(totalNegs),14)+'  ·  '+totalQtdNegs+' negociaç'+(totalQtdNegs!==1?'ões':'ão'));
    }
    return blocos.join('\n')+'\n';
  }

  function _bMeta(itens){
    var META = (typeof window.META==='number'?window.META:(typeof META!=='undefined'?META:0));
    if(!META || META<=0) return SEP_LIN+'\n🎯 META\n'+SEP_LIN+'\nMeta não definida.\n';
    var pago = itens.filter(function(it){return it.status==='pago';}).reduce(function(s,it){return s+it.valor;},0);
    var pct = Math.round((pago/META)*100);
    var falta = Math.max(META-pago,0);
    var acima = Math.max(pago-META,0);
    var linhas = [
      'Meta:        '+_padL(_fmtR(META),14),
      'Realizado:   '+_padL(_fmtR(pago),14)+'  ('+pct+'%)'
    ];
    if(falta>0) linhas.push('Faltam:      '+_padL(_fmtR(falta),14));
    else linhas.push('Acima da meta: '+_fmtR(acima)+' 🏆');
    return [SEP_LIN, '🎯 META VS REALIZADO', SEP_LIN].concat(linhas).join('\n')+'\n';
  }

  function _bAssinatura(){
    var s = (typeof _getSessao==='function')?_getSessao():null;
    var nome = s ? (s.nome||s.login||'—') : '—';
    return [SEP_LIN, '✍️ GERADO POR', SEP_LIN, nome+' em '+_now(), ''].join('\n');
  }

  // ── MONTA RELATÓRIO COMPLETO ───────────────────────────────────
  function _gerarRelatorio(){
    var t = _turmaTxt();
    var itens = _itensFiltrados();
    var partes = [];
    partes.push('📊 RELATÓRIO — '+t.nome);
    if(t.periodo) partes.push('Período: '+t.periodo);
    partes.push('');
    if(_sel.resumo)     partes.push(_bResumo(itens));
    if(_sel.pagos)      partes.push(_bPagos(itens));
    if(_sel.entradas)   partes.push(_bEntradas(itens));
    if(_sel.negociacao) partes.push(_bNegociacao(itens));
    if(_sel.aberto)     partes.push(_bAberto(itens));
    if(_sel.consultor)  partes.push(_bRanking(itens,'consultor','RANKING CONSULTORES','🏆'));
    if(_sel.treinador)  partes.push(_bRanking(itens,'treinador','RANKING TREINADORES','🎯'));
    if(_sel.topTrein)   partes.push(_bTopTreinamentos(itens));
    if(_sel.meta)       partes.push(_bMeta(itens));
    if(_sel.assinatura) partes.push(_bAssinatura());
    return partes.join('\n');
  }

  // ── UI: contagens nas seções (preview de "quantos itens") ──────
  function _contagensSecao(){
    var itens = _itensFiltrados();
    var cnt = {
      resumo: 3,
      pagos:  itens.filter(function(it){return it.status==='pago';}).length,
      entradas: itens.filter(function(it){return it.entrada>0;}).length,
      negociacao: itens.filter(function(it){return it.status==='negociacao';}).length,
      aberto: itens.filter(function(it){return it.status==='aberto';}).length,
      consultor: 3,
      treinador: 3,
      topTrein: 5,
      meta: 1,
      assinatura: 1
    };
    return cnt;
  }

  // ── RENDER do modal (sidebar + preview) ────────────────────────
  function _renderModal(){
    var t = _turmaTxt();
    var subEl = document.getElementById('supSub');
    if(subEl) subEl.textContent = 'TURMA: '+t.nome + (t.periodo?(' · '+t.periodo):'');
    var cnt = _contagensSecao();
    var listEl = document.getElementById('supSecoes');
    if(listEl){
      var htmlSecoes = SECOES.map(function(s){
        var on = !!_sel[s.id];
        return '<div class="sup-side-item'+(on?' on':'')+'" data-sec="'+s.id+'" onclick="window._supToggle(\''+s.id+'\')">'
          +'<div class="dot">'+(on?'✓':'')+'</div>'
          +'<span class="nm">'+s.ico+' '+s.label+'</span>'
          +'<span class="cnt">'+(cnt[s.id]!=null?cnt[s.id]:'')+'</span>'
        +'</div>';
      }).join('');

      // Inicializa a seleção de consultores (default: todos marcados). Preserva
      // escolhas já feitas; só adiciona consultores novos da turma.
      var _consTurma = _consultoresDaTurma();
      _consTurma.forEach(function(n){ if(!(n in _consSel)) _consSel[n] = true; });

      // Grupo: EXIBIR no detalhe (toggles de sufixos + ordenação por valor)
      var htmlExibir = '<div class="sup-side-group">'
        + '<div class="sup-side-grouph">⚙️ Exibir no detalhe</div>'
        + (function(){
            var defs = [
              {id:'consultor', label:'Nome do consultor'},
              {id:'forma',     label:'Forma de pagamento'}
            ];
            return defs.map(function(d){
              var on = !!_exibir[d.id];
              return '<div class="sup-side-item small'+(on?' on':'')+'" data-exib="'+d.id+'" onclick="window._supToggleExibir(\''+d.id+'\')">'
                +'<div class="dot">'+(on?'✓':'')+'</div>'
                +'<span class="nm">'+d.label+'</span>'
              +'</div>';
            }).join('');
          })()
        + (function(){
            var on = !!_ordenarValor;
            return '<div class="sup-side-item small'+(on?' on':'')+'" data-ord="valor" onclick="window._supToggleOrdenar()">'
              +'<div class="dot">'+(on?'✓':'')+'</div>'
              +'<span class="nm">Ordenar por valor (maior→menor)</span>'
            +'</div>';
          })()
        + '</div>';

      // Grupo: CONSULTORES da turma (filtro — só os marcados entram no relatório)
      var htmlCons = '<div class="sup-side-group">'
        + '<div class="sup-side-grouph">👤 Consultores da turma</div>'
        + (_consTurma.length
            ? _consTurma.map(function(n){
                var on = _consSel[n] !== false;
                var attr = String(n).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
                return '<div class="sup-side-item small'+(on?' on':'')+'" data-cons="'+attr+'" onclick="window._supToggleCons(this.getAttribute(\'data-cons\'))">'
                  +'<div class="dot">'+(on?'✓':'')+'</div>'
                  +'<span class="nm">'+n+'</span>'
                +'</div>';
              }).join('')
            : '<div class="sup-side-item small" style="opacity:.6;cursor:default;"><span class="nm">Nenhum consultor na turma.</span></div>')
        + '</div>';

      listEl.innerHTML = htmlSecoes + htmlExibir + htmlCons;
    }
    _renderPreview();
  }

  function _renderPreview(){
    var prevEl = document.getElementById('supPreview');
    if(prevEl) prevEl.textContent = _gerarRelatorio();
  }

  // ── API PÚBLICA ────────────────────────────────────────────────
  window.abrirSupremo = function(){
    // ADM-only desktop
    var s = (typeof _getSessao==='function')?_getSessao():null;
    if(s && s.perfil!=='adm') return;
    if(window.innerWidth<769){
      if(typeof _showToast==='function') _showToast('Relatório Supremo disponível apenas em desktop.','var(--amber)');
      return;
    }
    _renderModal();
    var ov = document.getElementById('supremoOverlay');
    if(ov) ov.classList.add('open');
  };

  window.fecharSupremo = function(){
    var ov = document.getElementById('supremoOverlay');
    if(ov) ov.classList.remove('open');
  };

  window._supToggle = function(id){
    _sel[id] = !_sel[id];
    // Atualiza só o item afetado + preview
    var item = document.querySelector('.sup-side-item[data-sec="'+id+'"]');
    if(item){
      item.classList.toggle('on', _sel[id]);
      var dot = item.querySelector('.dot');
      if(dot) dot.textContent = _sel[id]?'✓':'';
    }
    _renderPreview();
  };

  window._supToggleExibir = function(campo){
    if(!(campo in _exibir)) return;
    _exibir[campo] = !_exibir[campo];
    var item = document.querySelector('.sup-side-item[data-exib="'+campo+'"]');
    if(item){
      var on = _exibir[campo];
      item.classList.toggle('on', on);
      var dot = item.querySelector('.dot');
      if(dot) dot.textContent = on?'✓':'';
    }
    _renderPreview();
  };

  // Filtro de consultor: alterna 1 consultor. Como muda contagens das seções,
  // re-renderiza o painel inteiro (preserva a seleção via _consSel persistente).
  window._supToggleCons = function(nome){
    if(nome==null) return;
    _consSel[nome] = (_consSel[nome] === false); // false→true / true(undefined)→false
    _renderModal();
  };

  // Ordenação por valor (maior→menor): não muda contagens, só a ordem do detalhe.
  window._supToggleOrdenar = function(){
    _ordenarValor = !_ordenarValor;
    var item = document.querySelector('.sup-side-item[data-ord="valor"]');
    if(item){
      item.classList.toggle('on', _ordenarValor);
      var dot = item.querySelector('.dot');
      if(dot) dot.textContent = _ordenarValor?'✓':'';
    }
    _renderPreview();
  };

  window._supMarcarTodos = function(marcar){
    SECOES.forEach(function(s){ _sel[s.id]=!!marcar; });
    // "Marcar tudo" / "Limpar" também aplicam aos toggles de exibir colunas
    Object.keys(_exibir).forEach(function(k){ _exibir[k] = !!marcar; });
    // ...e à seleção de consultores (limpar = relatório vazio; marcar = todos)
    _consultoresDaTurma().forEach(function(n){ _consSel[n] = !!marcar; });
    _renderModal();
  };

  window._supCopiar = function(){
    if(window._smoke && !window._smoke.gate('copiar relatório')) return;
    var txt = _gerarRelatorio();
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(function(){
        if(typeof _showToast==='function') _showToast('✅ Relatório supremo copiado — cole no WhatsApp/email da chefia','var(--pago)');
      }).catch(function(){
        // Fallback: textarea + execCommand
        _supCopiarFallback(txt);
      });
    } else {
      _supCopiarFallback(txt);
    }
  };

  function _supCopiarFallback(txt){
    try{
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.position='fixed';
      ta.style.opacity='0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if(typeof _showToast==='function') _showToast('✅ Relatório supremo copiado','var(--pago)');
    } catch(e){
      if(typeof _showToast==='function') _showToast('Falha ao copiar. Tente baixar .txt','var(--red)');
    }
  }

  window._supBaixarTxt = function(){
    if(window._smoke && !window._smoke.gate('baixar relatório TXT')) return;
    var t = _turmaTxt();
    var fname = 'relatorio-supremo-'+String(t.nome||'turma').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+new Date().toISOString().slice(0,10)+'.txt';
    var blob = new Blob([_gerarRelatorio()],{type:'text/plain;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(url);},800);
    if(typeof _showToast==='function') _showToast('💾 '+fname,'var(--accent)');
  };

  /* PDF — Corporate minimal (Preview 01): papel branco · serif executiva · preto/ocre/cinza */
  window._supBaixarPdf = function(){
    if(window._smoke && !window._smoke.gate('gerar PDF do relatório')) return;
    if(typeof _ensureJsPDF!=='function'){
      if(typeof _showToast==='function') _showToast('jsPDF não disponível.','var(--red)');
      return;
    }
    if(typeof _showToast==='function') _showToast('⏳ Gerando PDF...','var(--muted)');
    _ensureJsPDF().then(function(){
      try{
        var jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if(!jsPDFCtor){ if(typeof _showToast==='function') _showToast('jsPDF não inicializou.','var(--red)'); return; }
        var doc = new jsPDFCtor({orientation:'portrait',unit:'mm',format:'a4'});
        var t = _turmaTxt();
        var fname = 'relatorio-supremo-'+String(t.nome||'turma').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+new Date().toISOString().slice(0,10)+'.pdf';

        var pageW = doc.internal.pageSize.getWidth();   // 210
        var pageH = doc.internal.pageSize.getHeight();  // 297
        var margem = 12;
        var maxW = pageW - margem*2;

        // ── Paleta Corporate Minimal (Preview 01) ──────────────
        var PRETO    = [17, 17, 17];
        var OCRE     = [201, 161, 74];
        var CINZA    = [102, 102, 102];
        var HAIRLINE = [230, 230, 230];
        var ZEBRA    = [250, 250, 250];

        function _dataAgora(){
          var d = new Date();
          var dd = String(d.getDate()).padStart(2,'0');
          var mm = String(d.getMonth()+1).padStart(2,'0');
          return dd + '.' + mm + '.' + d.getFullYear();
        }

        // ── BRAND BAR Corporate (faixa ocre topo · título serif · linha hairline) ──
        doc.setFillColor(OCRE[0], OCRE[1], OCRE[2]);
        doc.rect(0, 0, pageW, 2.5, 'F');

        // "RELATÓRIO EXECUTIVO" — uppercase letterspaced em ocre
        doc.setFont('helvetica','bold');
        doc.setFontSize(8);
        doc.setTextColor(OCRE[0], OCRE[1], OCRE[2]);
        doc.text('R E L A T Ó R I O   E X E C U T I V O', margem, 14);

        // Título grande serif. Como o jsPDF padrão usa WinAnsi e não suporta "→" (U+2192),
        // partimos a string nos "→" e desenhamos a seta como gráfico entre os pedaços.
        doc.setFont('times','normal');
        doc.setFontSize(26);
        doc.setTextColor(PRETO[0], PRETO[1], PRETO[2]);
        var _tituloTop = String(t.nome||'TURMA').toUpperCase();
        if(t.periodo) _tituloTop += '  ·  ' + String(t.periodo).toUpperCase();

        function _drawSetaPdf(x, baseline, len){
          // Seta horizontal proporcional à fonte 26pt — centrada na altura "x-height"
          var cy = baseline - 2.2; // ajusta visual para alinhar com letras maiúsculas
          var lw = 0.6;
          doc.setDrawColor(PRETO[0], PRETO[1], PRETO[2]);
          doc.setLineWidth(lw);
          // hasta horizontal
          doc.line(x, cy, x + len, cy);
          // ponta (V apontando para direita)
          doc.line(x + len - 2.2, cy - 1.6, x + len, cy);
          doc.line(x + len - 2.2, cy + 1.6, x + len, cy);
        }

        function _drawTituloComSeta(texto, x, y){
          var partes = String(texto).split('→');
          if(partes.length < 2){
            doc.text(texto, x, y);
            return;
          }
          var cursor = x;
          for(var i=0; i<partes.length; i++){
            var p = partes[i];
            doc.text(p, cursor, y);
            cursor += doc.getTextWidth(p);
            if(i < partes.length - 1){
              // espaço + seta + espaço
              var setaLen = 6.5;
              var gap = 0.8;
              _drawSetaPdf(cursor + gap, y, setaLen);
              cursor += gap + setaLen + gap;
            }
          }
        }

        _drawTituloComSeta(_tituloTop, margem, 26);

        // Subtítulo cinza
        doc.setFont('helvetica','normal');
        doc.setFontSize(9);
        doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
        var _sessao = (typeof _getSessao==='function') ? _getSessao() : null;
        var _nomeGer = _sessao ? (_sessao.nome||_sessao.login||'') : '';
        var _subTop  = 'Gerado em ' + _dataAgora() + (_nomeGer ? (' por ' + _nomeGer) : '');
        doc.text(_subTop, margem, 33);

        // Linha hairline preta separadora
        doc.setDrawColor(PRETO[0], PRETO[1], PRETO[2]);
        doc.setLineWidth(0.3);
        doc.line(margem, 39, pageW - margem, 39);

        var y = 50;

        function _quebraPagina(necessario){
          if(y + necessario > pageH - margem - 10){
            doc.addPage();
            y = margem + 6;
          }
        }

        // H2: label uppercase ocre + linha ocre fina embaixo
        function _drawH2(titulo){
          _quebraPagina(14);
          y += 6;
          doc.setFont('helvetica','bold');
          doc.setFontSize(8.5);
          doc.setTextColor(OCRE[0], OCRE[1], OCRE[2]);
          doc.text(String(titulo).toUpperCase(), margem, y);
          y += 2;
          doc.setDrawColor(OCRE[0], OCRE[1], OCRE[2]);
          doc.setLineWidth(0.25);
          doc.line(margem, y, pageW - margem, y);
          y += 6;
        }

        // Sub-h2: dentro de uma seção, pequeno bold preto
        function _drawSub(titulo){
          _quebraPagina(8);
          y += 3;
          doc.setFont('helvetica','bold');
          doc.setFontSize(9);
          doc.setTextColor(PRETO[0], PRETO[1], PRETO[2]);
          doc.text(String(titulo).toUpperCase(), margem, y);
          y += 5;
        }

        // KV: label serif esquerda · valor serif bold direita · hairline embaixo
        function _drawKv(label, valor){
          _quebraPagina(7);
          doc.setFont('times','normal');
          doc.setFontSize(11);
          doc.setTextColor(PRETO[0], PRETO[1], PRETO[2]);
          var labelMax = maxW - 50;
          var labelTrunc = String(label||'');
          if(doc.getTextWidth(labelTrunc) > labelMax){
            while(labelTrunc.length > 5 && doc.getTextWidth(labelTrunc+'…') > labelMax) labelTrunc = labelTrunc.slice(0,-1);
            labelTrunc += '…';
          }
          doc.text(labelTrunc, margem, y);

          doc.setFont('times','bold');
          doc.text(String(valor||''), pageW - margem, y, {align:'right'});

          y += 2.5;
          doc.setDrawColor(HAIRLINE[0], HAIRLINE[1], HAIRLINE[2]);
          doc.setLineWidth(0.15);
          doc.line(margem, y, pageW - margem, y);
          y += 4;
        }

        // Linha de total: border-top preto grosso + label bold + valor ocre
        function _drawTotal(label, valor){
          _quebraPagina(11);
          y += 3;
          doc.setDrawColor(PRETO[0], PRETO[1], PRETO[2]);
          doc.setLineWidth(0.6);
          doc.line(margem, y, pageW - margem, y);
          y += 6;
          doc.setFont('helvetica','bold');
          doc.setFontSize(11);
          doc.setTextColor(PRETO[0], PRETO[1], PRETO[2]);
          doc.text(String(label||'').toUpperCase(), margem, y);
          doc.setFont('times','bold');
          doc.setFontSize(13);
          doc.setTextColor(OCRE[0], OCRE[1], OCRE[2]);
          doc.text(String(valor||''), pageW - margem, y, {align:'right'});
          y += 6;
        }

        // Header de tabela: uppercase cinza + border-bottom preto
        function _drawTableHead(cols, widths){
          _quebraPagina(9);
          doc.setFont('helvetica','bold');
          doc.setFontSize(7.5);
          doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
          var x = margem;
          cols.forEach(function(c, i){
            var w = widths[i];
            var tx = c.r ? (x + w - 1) : (x + 1);
            doc.text(String(c.label||'').toUpperCase(), tx, y, {align: c.r ? 'right' : 'left'});
            x += w;
          });
          y += 1.5;
          doc.setDrawColor(PRETO[0], PRETO[1], PRETO[2]);
          doc.setLineWidth(0.4);
          doc.line(margem, y, pageW - margem, y);
          y += 4;
        }

        // Linha de tabela
        function _drawTableRow(cells, widths){
          _quebraPagina(7);
          doc.setFontSize(8.5);
          doc.setTextColor(40, 40, 40);
          var x = margem;
          cells.forEach(function(cell, i){
            var w = widths[i];
            var tx = cell.r ? (x + w - 1) : (x + 1);
            doc.setFont(cell.r ? 'times' : 'helvetica', cell.bold ? 'bold' : 'normal');
            var texto = String(cell.text||'');
            // trunca se passar do width disponível (com folga de 2mm)
            var limite = w - 2;
            if(doc.getTextWidth(texto) > limite){
              while(texto.length > 3 && doc.getTextWidth(texto+'…') > limite) texto = texto.slice(0,-1);
              texto += '…';
            }
            doc.text(texto, tx, y, {align: cell.r ? 'right' : 'left'});
            x += w;
          });
          y += 1.8;
          doc.setDrawColor(HAIRLINE[0], HAIRLINE[1], HAIRLINE[2]);
          doc.setLineWidth(0.1);
          doc.line(margem, y, pageW - margem, y);
          y += 3.5;
        }

        // Linha de ranking: numeral romano ocre + nome + valor + sub
        function _drawRankRow(pos, nome, valor, meta){
          _quebraPagina(10);
          doc.setFont('times','italic');
          doc.setFontSize(13);
          doc.setTextColor(OCRE[0], OCRE[1], OCRE[2]);
          doc.text(String(pos||''), margem, y);

          doc.setFont('helvetica','bold');
          doc.setFontSize(10);
          doc.setTextColor(PRETO[0], PRETO[1], PRETO[2]);
          doc.text(String(nome||''), margem + 12, y);

          doc.setFont('times','bold');
          doc.setFontSize(11);
          doc.text(String(valor||''), pageW - margem, y, {align:'right'});

          if(meta){
            doc.setFont('helvetica','normal');
            doc.setFontSize(7.5);
            doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
            doc.text(String(meta), pageW - margem, y + 3.5, {align:'right'});
            y += 4.5;
          } else {
            y += 1.5;
          }
          doc.setDrawColor(HAIRLINE[0], HAIRLINE[1], HAIRLINE[2]);
          doc.setLineWidth(0.15);
          doc.line(margem, y, pageW - margem, y);
          y += 4;
        }

        // ── Coleta dados (já filtrada pelos consultores selecionados) ──
        var itens = _itensFiltrados();

        // Forma de pagamento formatada (PIX/DÉBITO/TRANSF não mostram parcelas)
        function _formaPgto(it){
          if(!it.formaPagamento) return '—';
          var x = String(it.formaPagamento||'').toUpperCase().trim();
          var semParc = (x==='PIX'||x==='CARTÃO DE DÉBITO'||x==='TRANSFERÊNCIA');
          return it.formaPagamento + (semParc ? '' : ' ' + (it.parcelas>1?it.parcelas:'1') + 'x');
        }

        // Tabela com colunas dinâmicas — Forma e Consultor podem ser ocultados via _exibir
        function _tabelaItens(lista, opts){
          opts = opts || {};
          var cols = [
            {label:'Cliente',     w:48, get:function(it){return it.cliente||'—';}},
            {label:'Treinamento', w:36, get:function(it){return it.treinamento||'—';}},
            {label:'Valor', r:true, w:26, bold:true, get:function(it){return _fmtR(opts.usaEntrada ? it.entrada : it.valor);}}
          ];
          if(_exibir.forma)     cols.push({label:'Forma',     w:30, get:function(it){return _formaPgto(it);}});
          if(_exibir.consultor) cols.push({label:'Consultor', w:42, get:function(it){return it.consultor||'—';}});

          // Redistribui o espaço sobrando entre as colunas de texto (Cliente/Treinamento)
          var somaW = cols.reduce(function(s,c){return s+c.w;},0);
          var sobra = maxW - somaW;
          if(sobra > 0){
            // metade para Cliente, metade para Treinamento
            cols[0].w += Math.floor(sobra/2);
            cols[1].w += sobra - Math.floor(sobra/2);
          }
          var widths = cols.map(function(c){return c.w;});

          _drawTableHead(cols.map(function(c){return {label:c.label, r:!!c.r};}), widths);
          lista.forEach(function(it){
            _drawTableRow(cols.map(function(c){
              return {text:c.get(it), r:!!c.r, bold:!!c.bold};
            }), widths);
          });
        }

        // ══════ Renderiza cada seção ativada ══════
        // RESUMO
        if(_sel.resumo){
          _drawH2('Resumo Financeiro');
          var totPago=0,qtdPago=0,totEntTotal=0,totEntPend=0,totNeg=0,qtdNeg=0;
          var cliPagos=new Set(),cliEntTotal=new Set(),cliEntPend=new Set(),cliNeg=new Set();
          /* Calcula 2 totais de entrada:
             - totEntTotal: TODAS as entradas (informativo · mostra que entrada foi recebida)
             - totEntPend: só entradas de subs NÃO-pagos (este é o que entra no TOTAL GERAL
               sem duplicar com totPago, que já contém o valor cheio dos subs pagos). */
          itens.forEach(function(it){
            if(it.status==='pago'){totPago+=it.valor;qtdPago++;cliPagos.add(it.cliente);}
            if(it.entrada>0){totEntTotal+=it.entrada;cliEntTotal.add(it.cliente);}
            if(it.entrada>0 && it.status!=='pago'){totEntPend+=it.entrada;cliEntPend.add(it.cliente);}
            if(it.status==='negociacao'){totNeg+=it.valor;qtdNeg++;cliNeg.add(it.cliente);}
          });
          _drawKv('Total faturado (PAGO) · '+qtdPago+' treinos · '+cliPagos.size+' clientes', _fmtR(totPago));
          _drawKv('Total em entradas · '+cliEntTotal.size+' clientes', _fmtR(totEntTotal));
          _drawKv('Em negociação · '+qtdNeg+' treinos · '+cliNeg.size+' clientes', _fmtR(totNeg));
          /* TOTAL GERAL = pago + entradas pendentes (de subs não-pagos).
             Entradas de subs JÁ PAGOS não entram aqui pois já estão em totPago. */
          _drawTotal('Total Geral (receita realizada)', _fmtR(totPago+totEntPend));
        }

        // PAGOS
        if(_sel.pagos){
          var pagos = _ordenaDetalhe(itens.filter(function(it){return it.status==='pago';}), false);
          _drawH2('Treinamentos Pagos ('+pagos.length+')');
          if(pagos.length) _tabelaItens(pagos);
          else _drawKv('Nenhum pagamento registrado.', '—');
        }

        // ENTRADAS — TODAS as entradas registradas (incluindo as de subs já pagos
        // para manter rastreabilidade histórica dos pagamentos parcelados)
        if(_sel.entradas){
          // Filtro = quem pagou entrada; valor exibido = TOTAL do produto (usaEntrada:false).
          var ents = _ordenaDetalhe(itens.filter(function(it){return it.entrada>0;}), false);
          _drawH2('Entradas Recebidas ('+ents.length+')');
          if(ents.length) _tabelaItens(ents, {usaEntrada:false});
          else _drawKv('Nenhuma entrada registrada.', '—');
        }

        // NEGOCIAÇÃO
        if(_sel.negociacao){
          var negs = _ordenaDetalhe(itens.filter(function(it){return it.status==='negociacao';}), false);
          var totN = negs.reduce(function(s,it){return s+it.valor;},0);
          _drawH2('Em Negociação ('+negs.length+' · '+_fmtR(totN)+')');
          if(negs.length) _tabelaItens(negs);
          else _drawKv('Nada em negociação.', '—');
        }

        // ABERTO
        if(_sel.aberto){
          var abs = _ordenaDetalhe(itens.filter(function(it){return it.status==='aberto';}), false);
          var totA = abs.reduce(function(s,it){return s+it.valor;},0);
          _drawH2('Em Aberto ('+abs.length+' · '+_fmtR(totA)+')');
          if(abs.length) _tabelaItens(abs);
          else _drawKv('Nada em aberto.', '—');
        }

        var _roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];

        // RANKING CONSULTORES
        if(_sel.consultor){
          _drawH2('Ranking de Consultores');
          var mp = {};
          itens.forEach(function(it){ if(it.status!=='pago') return; var k=it.consultor||'—'; if(!mp[k])mp[k]={total:0,t:0,c:new Set()}; mp[k].total+=it.valor; mp[k].t++; mp[k].c.add(it.cliente); });
          var rk = Object.keys(mp).map(function(k){return {nome:k,total:mp[k].total,t:mp[k].t,c:mp[k].c.size};}).sort(function(a,b){return b.total-a.total;});
          if(!rk.length) _drawKv('Sem dados de pagos.','—');
          rk.forEach(function(r,i){
            _drawRankRow(_roman[i]||(i+1)+'.', r.nome, _fmtR(r.total), r.t+' treinos · '+r.c+' clientes');
          });
        }

        // RANKING TREINADORES
        if(_sel.treinador){
          _drawH2('Ranking de Treinadores');
          var mt = {};
          itens.forEach(function(it){ if(it.status!=='pago') return; var k=it.treinador||'—'; if(!mt[k])mt[k]={total:0,t:0,c:new Set()}; mt[k].total+=it.valor; mt[k].t++; mt[k].c.add(it.cliente); });
          var rkt = Object.keys(mt).map(function(k){return {nome:k,total:mt[k].total,t:mt[k].t,c:mt[k].c.size};}).sort(function(a,b){return b.total-a.total;});
          if(!rkt.length) _drawKv('Sem dados.','—');
          rkt.forEach(function(r,i){
            _drawRankRow(_roman[i]||(i+1)+'.', r.nome, _fmtR(r.total), r.t+' treinos · '+r.c+' clientes');
          });
        }

        // TOP TREINAMENTOS
        if(_sel.topTrein){
          _drawH2('Top Treinamentos');
          function _aggTrein(stAlvo){
            var m={}; itens.forEach(function(it){ if(it.status!==stAlvo) return; var k=it.treinamento||'—'; if(!m[k])m[k]={total:0,q:0}; m[k].total+=it.valor; m[k].q++; });
            return Object.keys(m).map(function(k){return {nome:k,total:m[k].total,q:m[k].q};}).sort(function(a,b){return (b.q-a.q) || (b.total-a.total);});
          }
          var rpagos = _aggTrein('pago');
          var rnegs  = _aggTrein('negociacao');
          if(rpagos.length){
            _drawSub('Pagos ('+rpagos.length+' treinamento'+(rpagos.length!==1?'s':'')+')');
            var totalP=0, totalQp=0;
            rpagos.forEach(function(r){
              totalP+=r.total; totalQp+=r.q;
              _drawKv(r.nome+' · '+r.q+' venda'+(r.q!==1?'s':''), _fmtR(r.total));
            });
            _drawTotal('Total Pagos ('+totalQp+' venda'+(totalQp!==1?'s':'')+')', _fmtR(totalP));
          }
          if(rnegs.length){
            _drawSub('Em Negociação ('+rnegs.length+' treinamento'+(rnegs.length!==1?'s':'')+')');
            var totalN=0, totalQn=0;
            rnegs.forEach(function(r){
              totalN+=r.total; totalQn+=r.q;
              _drawKv(r.nome+' · '+r.q+' negociaç'+(r.q!==1?'ões':'ão'), _fmtR(r.total));
            });
            _drawTotal('Total Negociação ('+totalQn+' negociaç'+(totalQn!==1?'ões':'ão')+')', _fmtR(totalN));
          }
          if(!rpagos.length && !rnegs.length) _drawKv('Sem dados.','—');
        }

        // META
        if(_sel.meta){
          _drawH2('Meta vs Realizado');
          var META = (typeof window.META==='number'?window.META:(typeof META!=='undefined'?META:0));
          if(!META||META<=0) _drawKv('Meta não definida.','—');
          else {
            var pg = itens.filter(function(it){return it.status==='pago';}).reduce(function(s,it){return s+it.valor;},0);
            var pct = Math.round((pg/META)*100);
            var falta = Math.max(META-pg,0);
            var acima = Math.max(pg-META,0);
            _drawKv('Meta', _fmtR(META));
            _drawKv('Realizado ('+pct+'%)', _fmtR(pg));
            if(falta>0) _drawKv('Faltam', _fmtR(falta));
            else _drawKv('Acima da meta', _fmtR(acima));
          }
        }

        // ASSINATURA
        if(_sel.assinatura){
          _drawH2('Gerado por');
          var s2 = (typeof _getSessao==='function')?_getSessao():null;
          var nomeAssin = s2 ? (s2.nome||s2.login||'—') : '—';
          _drawKv(nomeAssin, _now());
        }

        // Rodapé Corporate: linha hairline + texto pequeno cinza centralizado
        var totalPgs = doc.internal.getNumberOfPages();
        for(var pg=1; pg<=totalPgs; pg++){
          doc.setPage(pg);
          doc.setDrawColor(HAIRLINE[0], HAIRLINE[1], HAIRLINE[2]);
          doc.setLineWidth(0.2);
          doc.line(margem, pageH - 12, pageW - margem, pageH - 12);
          doc.setFont('helvetica','normal');
          doc.setFontSize(7);
          doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
          doc.text(
            'CONFIDENCIAL · ' + (t.nome||'') + ' · Pág. ' + pg + '/' + totalPgs,
            pageW/2, pageH - 7,
            {align:'center'}
          );
        }

        doc.save(fname);
        if(typeof _showToast==='function') _showToast('📄 '+fname,'var(--accent)');
      } catch(e){
        if(typeof _showToast==='function') _showToast('Falha PDF: '+(e.message||e),'var(--red)');
      }
    }).catch(function(){
      if(typeof _showToast==='function') _showToast('Falha ao carregar jsPDF.','var(--red)');
    });
  };

  /* WhatsApp — copia o relatório com markdown WhatsApp (*bold* em headers).
     Não abre o WhatsApp; usuário cola onde quiser (chat, grupo, etc). */
  window._supWhatsApp = function(){
    if(window._smoke && !window._smoke.gate('copiar para WhatsApp')) return;
    var txt = _gerarRelatorio();
    // Aplica markdown WhatsApp: linhas que começam com emoji + texto = bold
    // (WhatsApp renderiza *texto* como negrito)
    txt = txt.split('\n').map(function(ln){
      var trimmed = ln.trim();
      // Detecta linhas-título (começam com emoji + letra maiúscula)
      if(/^[📊💰✅💵🤝⏳🏆🎯📚✍️🥇🥈🥉]\s+[A-ZÀ-Ý]/.test(trimmed) && trimmed.length<80){
        return '*'+trimmed+'*';
      }
      // Sub-blocos como "✅ PAGOS (top 5):" também viram bold
      if(/^[✅🤝]\s+[A-ZÀ-Ý].*:$/.test(trimmed)) return '*'+trimmed+'*';
      // Linhas "TOTAL GERAL:" ou similares também
      if(/^TOTAL\s/.test(trimmed)) return '*'+ln+'*';
      return ln;
    }).join('\n');

    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(function(){
        if(typeof _showToast==='function') _showToast('💬 Copiado para WhatsApp · Cole no chat (Ctrl+V)','var(--pago)');
      }).catch(function(){ _supCopiarFallback(txt); });
    } else {
      _supCopiarFallback(txt);
      if(typeof _showToast==='function') _showToast('💬 Copiado para WhatsApp','var(--pago)');
    }
  };

  // Mostrar/esconder botão Supremo conforme perfil/viewport
  function _atualizarBotaoSupremo(){
    var btn = document.getElementById('btnSupremo');
    if(!btn) return;
    var s = (typeof _getSessao==='function')?_getSessao():null;
    var ehAdm = !s || s.perfil==='adm';
    var ehDesk = window.innerWidth>=769;
    btn.style.display = (ehAdm && ehDesk) ? '' : 'none';
  }
  window.addEventListener('resize', _atualizarBotaoSupremo);
  document.addEventListener('DOMContentLoaded', _atualizarBotaoSupremo);
  // Também chama após login (renderAll é o gancho mais frequente)
  var _origRender = window.renderAll;
  if(typeof _origRender==='function'){
    window.renderAll = function(){ var r=_origRender.apply(this,arguments); _atualizarBotaoSupremo(); return r; };
  }

})();
