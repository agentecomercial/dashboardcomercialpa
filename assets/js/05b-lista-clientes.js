/* ══════════════════════════════════════════════════════════════
   MODAL LISTA DE CLIENTES v12
   — Edição inline completa
   — Checkbox por linha + selecionar todos + excluir em massa
   — NÃO fecha com ESC nem com backdrop
   — Salvar atualiza data[] e Firebase
   (extraído de 05-importacao.js na Fase 16 — code-split)
══════════════════════════════════════════════════════════════ */
var _lcIndicesFiltrados = []; // índices reais no array data[]

function abrirListaClientes(){
  var overlay = document.getElementById('listaClientesOverlay');
  var input   = document.getElementById('lcSearchInput');
  if(!overlay){ console.error('[abrirListaClientes] listaClientesOverlay não encontrado'); return; }
  if(input) input.value = '';
  try{ lcRenderizar(''); } catch(e){ console.warn('[abrirListaClientes] lcRenderizar:', e); }
  // Botão de redistribuição — só ADM e só quando há sem-consultor
  var btn=document.getElementById('lcBtnDistribuir');
  if(btn){
    var isAdm=typeof _getSessao==='function'&&((_getSessao()||{}).perfil==='adm');
    if(isAdm){
      var arr=(typeof data!=='undefined'&&Array.isArray(data))?data:[];
      var sem=arr.filter(function(d){return d&&(!d.consultor||!d.consultor.trim());}).length;
      if(sem>0){btn.textContent='⚖ Distribuir sem consultor ('+sem+')';btn.style.display='';}
      else btn.style.display='none';
    } else {
      btn.style.display='none';
    }
  }
  overlay.classList.add('open');
}
function fecharListaClientes(){
  document.getElementById('listaClientesOverlay').classList.remove('open');
}

/* Renderiza tabela com edição inline */
function lcRenderizar(filtro){
  var tbody  = document.getElementById('lcTbody');
  var vazio  = document.getElementById('lcVazio');
  var count  = document.getElementById('lcCount');
  var sub    = document.getElementById('lcSubtitle');
  if(!tbody) return;

  var arr = (typeof data !== 'undefined' && Array.isArray(data)) ? data : [];
  var q   = (filtro || '').toLowerCase().trim();

  // Montar lista de índices filtrados (ignora entradas null)
  _lcIndicesFiltrados = [];
  arr.forEach(function(r, i){
    if(!r) return; // skip entradas null/undefined (lixo de splice/Firebase)
    if(!q){
      _lcIndicesFiltrados.push(i);
    } else if(
      (r.cliente    ||'').toLowerCase().indexOf(q)>=0 ||
      (r.treinamento||'').toLowerCase().indexOf(q)>=0 ||
      (r.consultor  ||'').toLowerCase().indexOf(q)>=0 ||
      (r.treinador  ||'').toLowerCase().indexOf(q)>=0
    ){
      _lcIndicesFiltrados.push(i);
    }
  });

  // Ordenar agrupando linhas do mesmo cliente (ordem original como tiebreak — estável)
  _lcIndicesFiltrados.sort(function(a,b){
    var rA=arr[a], rB=arr[b];
    if(!rA&&!rB) return 0;
    if(!rA) return 1;
    if(!rB) return -1;
    var ca=(rA.cliente||'').toLowerCase();
    var cb=(rB.cliente||'').toLowerCase();
    if(ca<cb) return -1;
    if(ca>cb) return 1;
    return a-b;
  });

  if(!_lcIndicesFiltrados.length){
    tbody.innerHTML = '';
    vazio.style.display = 'block';
    count.textContent   = '0 clientes';
    var _totU0 = (typeof _contarClientesUnicos==='function')?_contarClientesUnicos(arr):arr.length;
    if(sub) sub.textContent = _totU0 + ' cliente'+(_totU0!==1?'s':'')+' · '+arr.length+' treinamento'+(arr.length!==1?'s':'')+' no total — nenhum encontrado.';
    lcAtualizarMassaBar();
    return;
  }

  vazio.style.display = 'none';

  var STATUS_OPTS = [
    {v:'aberto',l:'ABERTO'},{v:'pago',l:'PAGO'},{v:'entrada',l:'ENTRADA'},
    {v:'negociacao',l:'NEGOCIAÇÃO'},{v:'desistiu',l:'DESISTIU'},{v:'estorno',l:'ESTORNO'},{v:'-',l:'—'}
  ];

  // Fontes dos selects: mesmas do modal "Novo cliente"
  var _treinLst = (typeof allTreinamentos!=='undefined'&&Array.isArray(allTreinamentos))?allTreinamentos:[];
  var _trainLst = (typeof allTrainers!=='undefined'&&Array.isArray(allTrainers))?allTrainers:[];
  var _consLst  = (typeof allConsultors!=='undefined'&&Array.isArray(allConsultors))?allConsultors:[];

  var html = '';
  var _prevCliente = null; // tracking para detectar sub-rows (2º+ treino do mesmo cliente)
  _lcIndicesFiltrados.forEach(function(realIdx){
    var r = arr[realIdx];
    if(!r) return; // guard defensivo (caso de race com splice/listener)
    var _ehSubRow = (r.cliente||'') === _prevCliente && _prevCliente !== '';
    _prevCliente = r.cliente || '';

    // SELECT treinamento — Fix 7: opção vazia obrigatória, nunca pré-preencher
    var treinOpts = '<option value="">—</option>'
      + _treinLst.map(function(t){
          return '<option value="'+t+'"'+((r.treinamento||'')=== t?' selected':'')+'>'+t+'</option>';
        }).join('');

    // SELECT treinador (âmbar)
    var trainOpts = '<option value="-"'+((!r.treinador||r.treinador==='-')?' selected':'')+'>—</option>'
      + _trainLst.map(function(t){
          return '<option value="'+t+'"'+(r.treinador===t?' selected':'')+'>'+t.toUpperCase()+'</option>';
        }).join('');

    // SELECT consultor (verde)
    var consOpts = '<option value=""'+(!r.consultor?' selected':'')+'>—</option>'
      + _consLst.map(function(c){
          return '<option value="'+c+'"'+(r.consultor===c?' selected':'')+'>'+c.toUpperCase()+'</option>';
        }).join('');

    // SELECT status
    var selOpts = STATUS_OPTS.map(function(s){
      return '<option value="'+s.v+'"'+((r.status||'aberto')===s.v?' selected':'')+'>'+s.l+'</option>';
    }).join('');

    // Fix 5: formatar valor/entrada como BRL para exibição no input
    var valEdit = r.valor  ? Number(r.valor).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})  : '';
    var entEdit = r.entrada? Number(r.entrada).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '';
    // Cor de ticket: Low (0-5k)=azul, Middle (5001-10k)=âmbar, High (10k+)=verde
    var ticketCorLC = Number(r.valor||0) >= 10000.01 ? 'var(--green)'
                    : Number(r.valor||0) >= 5001     ? 'var(--amber)'
                    : Number(r.valor||0) > 0         ? 'var(--blue)'
                    : 'var(--muted)';

    html += '<tr data-idx="'+realIdx+'"'+(_ehSubRow?' class="lc-sub-row"':'')+'>'
      // Checkbox — Fix 2: mantido no modal Gerenciar
      +'<td style="text-align:center;width:36px;">'
        +'<input type="checkbox" class="lc-row-chk" data-idx="'+realIdx+'" onchange="lcOnChkChange()" style="accent-color:var(--accent);width:14px;height:14px;cursor:pointer;">'
      +'</td>'
      // Cliente — sub-row mostra "└" cinza + texto itálico menor
      +'<td class="lc-cell-cliente" style="text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">'
        +(_ehSubRow
          ? '<span class="lc-sub-cliente">'+_lcEsc(r.cliente||'')+'</span>'
          : '<span style="font-size:12px;font-weight:600;color:var(--text);">'+_lcEsc(r.cliente||'')+'</span>')
      +'</td>'
      // Treinamento — SELECT com opção vazia + botão "+" para adicionar outro treino ao mesmo cliente
      +'<td style="text-align:center;vertical-align:middle;">'
        +'<div class="lc-cell-trein-wrap">'
          +'<select class="lc-cell-select" data-idx="'+realIdx+'" data-campo="treinamento" onchange="lcCellChange(this)">'+treinOpts+'</select>'
          +'<button class="lc-plus-trein" onclick="event.stopPropagation();window._abrirMenuCliente&&window._abrirMenuCliente(event,\''+String(r.cliente||'').replace(/\'/g,"\\'")+'\','+realIdx+')" title="Adicionar / Editar / Ver informações">+</button>'
        +'</div>'
      +'</td>'
      // Treinador — SELECT âmbar
      +'<td class="lc-cell-treinador" style="text-align:center;vertical-align:middle;">'
        +'<select class="lc-cell-select" data-idx="'+realIdx+'" data-campo="treinador" onchange="lcCellChange(this)" style="color:var(--amber);border-color:rgba(255,183,64,.25);">'+trainOpts+'</select>'
      +'</td>'
      // Consultor — SELECT verde
      +'<td class="lc-cell-consultor" style="text-align:center;vertical-align:middle;">'
        +'<select class="lc-cell-select" data-idx="'+realIdx+'" data-campo="consultor" onchange="lcCellChange(this)" style="color:var(--accent);border-color:rgba(200,240,90,.25);">'+consOpts+'</select>'
      +'</td>'
      // Valor — cor por faixa de ticket, alinhamento direita
      +'<td style="text-align:right;vertical-align:middle;min-width:100px;padding:3px 4px;">'
        +'<input type="text" inputmode="numeric" class="lc-cell-input" data-idx="'+realIdx+'" data-campo="valor"'
          +' value="'+valEdit+'" oninput="this.value=lcMoneyMask(this.value)" onchange="lcCellChange(this)" placeholder="0,00"'
          +' style="text-align:right;font-family:\'DM Mono\',monospace;font-variant-numeric:tabular-nums;font-weight:700;color:'+ticketCorLC+';min-width:90px;">'
      +'</td>'
      // Status — SELECT centralizado
      +'<td style="text-align:center;vertical-align:middle;">'
        +'<select class="lc-cell-select" data-idx="'+realIdx+'" data-campo="status" onchange="lcCellChange(this)">'+selOpts+'</select>'
      +'</td>'
      // Entrada — alinhamento direita, azul
      +'<td style="text-align:right;vertical-align:middle;min-width:90px;padding:3px 4px;">'
        +'<input type="text" inputmode="numeric" class="lc-cell-input" data-idx="'+realIdx+'" data-campo="entrada"'
          +' value="'+entEdit+'" oninput="this.value=lcMoneyMask(this.value)" onchange="lcCellChange(this)" placeholder="0,00"'
          +' style="text-align:right;font-family:\'DM Mono\',monospace;font-variant-numeric:tabular-nums;font-weight:600;color:var(--blue);min-width:80px;">'
      +'</td>'
      +'</tr>';
  });

  tbody.innerHTML = html;
  // Solução D: contagens duplas (clientes únicos · treinamentos)
  var _filtArr = _lcIndicesFiltrados.map(function(i){return arr[i];}).filter(function(d){return d;});
  var _filtUnicos = (typeof _contarClientesUnicos==='function')?_contarClientesUnicos(_filtArr):_lcIndicesFiltrados.length;
  var _totUnicos  = (typeof _contarClientesUnicos==='function')?_contarClientesUnicos(arr):arr.length;
  count.textContent = _filtUnicos + ' cliente' + (_filtUnicos!==1?'s':'')
    + ' · ' + _lcIndicesFiltrados.length + ' treinamento' + (_lcIndicesFiltrados.length!==1?'s':'')
    + (q?' (filtrados)':'');
  if(sub) sub.textContent = 'Total no sistema: '+_totUnicos+' cliente'+(_totUnicos!==1?'s':'')
    +' com '+arr.length+' treinamento'+(arr.length!==1?'s':'')+' cadastrado'+(arr.length!==1?'s':'')+'. Edição inline ativada.';
  lcAtualizarMassaBar();
}

function _lcEsc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* Edição inline do nome do cliente — só ADM */
function lcEditarNomeCliente(btn, idx){
  var td = btn.parentElement;
  var span = td.querySelector('span');
  var nomeAtual = (Array.isArray(data)&&data[idx])?data[idx].cliente||'':'';
  // Substituir conteúdo da célula por input
  td.innerHTML = '<input id="lcNomeEdit_'+idx+'" class="lc-cell-input" value="'+_lcEsc(nomeAtual)+'"'
    +' style="width:100%;min-width:120px;" placeholder="Nome..."'
    +' onblur="lcSalvarNomeCliente(this,'+idx+')" onkeydown="if(event.key===\'Enter\')this.blur();if(event.key===\'Escape\'){lcCancelarNomeCliente(this,'+idx+',\''+_lcEsc(nomeAtual)+'\')}">';
  var inp = document.getElementById('lcNomeEdit_'+idx);
  if(inp){ inp.focus(); inp.select(); }
}

function lcSalvarNomeCliente(inp, idx){
  var novo = inp.value.trim();
  if(novo && Array.isArray(data) && data[idx]){
    data[idx].cliente = novo;
    if(typeof markUnsaved==='function') markUnsaved();
    if(typeof saveStorage==='function') saveStorage();
  }
  lcRenderizar(document.getElementById('lcSearchInput').value||'');
}

function lcCancelarNomeCliente(inp, idx, original){
  lcRenderizar(document.getElementById('lcSearchInput').value||'');
}
function _lcFmtEdit(v){ var n=Number(v)||0; return n?String(n).replace('.',','):''; }
function _lcParseNum(s){ if(!s&&s!==0)return 0; var n=parseFloat(String(s).trim().replace(/R\$\s*/,'').replace(/\./g,'').replace(',','.')); return isNaN(n)?0:n; }

/* Atualiza data[] ao mudar uma célula (select ou input) */
function lcCellChange(el){
  var idx   = parseInt(el.dataset.idx);
  var campo = el.dataset.campo;
  var val   = el.value;
  if(!Array.isArray(data)||!data[idx]) return;
  if(campo==='valor'||campo==='entrada'){
    // Fix 5: parse BRL correto — remover pontos de milhar, trocar vírgula por ponto decimal
    var raw = val.trim()
      .replace(/R\$\s*/g,'')
      .replace(/\./g,'')
      .replace(',','.');
    data[idx][campo] = parseFloat(raw)||0;
  } else {
    data[idx][campo] = val;
  }
  /* SYNC schema híbrido: ao mudar o select TREINAMENTO inline, atualiza
     também o array d.treinamentos[] — senão _migrarTreinamentosHibrido
     reverte o scalar pra treinamentos[0].cod no próximo render. */
  if(campo==='treinamento'){
    var d = data[idx];
    if(!Array.isArray(d.treinamentos) || !d.treinamentos.length){
      d.treinamentos = [{
        cod: val,
        valor: Number(d.valor||0)||0,
        entrada: Number(d.entrada||0)||0,
        status: d.status || 'aberto'
      }];
    } else if(d.treinamentos.length === 1){
      d.treinamentos[0].cod = val;
    } else {
      /* Cliente com 2+ subs: ambíguo, mas atualiza o primeiro pra refletir
         a escolha do usuário (única intenção possível pelo select da grade). */
      d.treinamentos[0].cod = val;
    }
  }
  /* SYNC STATUS: _statusEfetivoCliente() (chamado em _migrarTreinamentosHibrido)
     recalcula d.status baseado em d.treinamentos[].status. Sem propagar pros
     subs, mudança manual no select STATUS é revertida no render seguinte. */
  if(campo==='status'){
    var dS = data[idx];
    if(Array.isArray(dS.treinamentos) && dS.treinamentos.length){
      if(dS.treinamentos.length === 1){
        dS.treinamentos[0].status = val;
      } else if(val === 'pago'){
        dS.treinamentos.forEach(function(t){ if(t) t.status = 'pago'; });
      } else {
        dS.treinamentos.forEach(function(t){
          if(t && t.status !== 'pago') t.status = val;
        });
      }
    }
  }
  if(typeof markUnsaved==='function') markUnsaved();
  if(typeof saveStorage==='function') saveStorage();
  // Re-render instantâneo após edição inline no modal Gerenciar Clientes
  if(window._consultorAtivo && document.getElementById('consultorDetail') &&
     document.getElementById('consultorDetail').style.display!=='none'){
    if(typeof _renderConsultorDetail==='function') _renderConsultorDetail(window._consultorAtivo);
  } else {
    if(typeof renderAll==='function') renderAll();
    if(typeof renderConsultor==='function') renderConsultor();
  }
}

/* Toggle checkbox individual */
function lcOnChkChange(){
  lcAtualizarMassaBar();
  document.querySelectorAll('#lcTbody tr').forEach(function(tr){
    var chk = tr.querySelector('.lc-row-chk');
    if(chk) tr.classList.toggle('lc-selected', chk.checked);
  });
  var todos    = document.querySelectorAll('.lc-row-chk');
  var marcados = document.querySelectorAll('.lc-row-chk:checked');
  var chkAll   = document.getElementById('lcChkAll');
  if(chkAll) chkAll.indeterminate = (marcados.length>0 && marcados.length<todos.length);
  if(chkAll) chkAll.checked       = (marcados.length===todos.length && todos.length>0);
}

/* Toggle todos */
function lcToggleAll(checked){
  document.querySelectorAll('.lc-row-chk').forEach(function(c){ c.checked=checked; });
  document.querySelectorAll('#lcTbody tr').forEach(function(tr){ tr.classList.toggle('lc-selected',checked); });
  lcAtualizarMassaBar();
}

function lcDeselecionarTodos(){
  lcToggleAll(false);
  var ca=document.getElementById('lcChkAll');
  if(ca){ca.checked=false;ca.indeterminate=false;}
}

/* Barra de ações em massa */
function lcAtualizarMassaBar(){
  var sels  = document.querySelectorAll('.lc-row-chk:checked').length;
  var total = document.querySelectorAll('.lc-row-chk').length;
  var bar   = document.getElementById('lcMassaBar');
  var cnt   = document.getElementById('lcMassaCount');
  var btn   = document.getElementById('lcBtnExcluirDin');
  var btnRC = document.getElementById('lcBtnRemoverCons');

  if(!bar) return;

  if(sels>0){
    bar.classList.add('visible');
    if(cnt) cnt.textContent = sels+' selecionado'+(sels!==1?'s':(sels===total&&total>0?' (todos)':''));
    if(btn){
      btn.style.display = 'inline-flex';
      btn.innerHTML = sels===total && total>0
        ? '🗑 Remover Todos ('+total+')'
        : '🗑 Remover selecionados ('+sels+')';
    }
    if(btnRC){
      var _arr = (typeof data!=='undefined'&&Array.isArray(data))?data:[];
      var _comCons = Array.from(document.querySelectorAll('.lc-row-chk:checked')).filter(function(c){
        var d=_arr[parseInt(c.dataset.idx)]; return d && (d.consultor||'')!=='';
      }).length;
      btnRC.innerHTML = '🚫 Remover consultor'+(_comCons?' ('+_comCons+')':'');
      btnRC.style.opacity = _comCons ? '1' : '.5';
    }
    // Popular selects De/Para com listas dinâmicas
    var _consLst  = (typeof allConsultors!=='undefined'&&Array.isArray(allConsultors))?allConsultors:[];
    var _treinLst = (typeof allTreinamentos!=='undefined'&&Array.isArray(allTreinamentos))?allTreinamentos:[];
    function _populatePar(deId, paraId, opts){
      [deId, paraId].forEach(function(id, isP){
        var el = document.getElementById(id);
        if(!el) return;
        var prev = el.value;
        el.innerHTML = '<option value="">'+(isP?'— Para —':'— De —')+'</option>'
          + opts.map(function(o){ return '<option value="'+o.v+'"'+(prev===o.v?' selected':'')+'>'+o.l+'</option>'; }).join('');
      });
    }
    var consOpts  = _consLst.map(function(c){ return {v:c, l:c.toUpperCase()}; });
    var treinOpts = _treinLst.map(function(t){ return {v:t, l:t}; });
    _populatePar('lcMassaConsultorDe',   'lcMassaConsultorPara',   consOpts);
    _populatePar('lcMassaTreinamentoDe', 'lcMassaTreinamentoPara', treinOpts);
  } else {
    bar.classList.remove('visible');
    if(btn) btn.style.display='none';
  }
}

/* Seleciona automaticamente as linhas cujo campo === valor ao escolher "De" */
function lcSelecionarPorDe(campo, valor){
  if(!valor) return; // "— De —" selecionado: não altera seleção
  var arr = (typeof data!=='undefined'&&Array.isArray(data))?data:[];
  document.querySelectorAll('.lc-row-chk').forEach(function(chk){
    var idx = parseInt(chk.dataset.idx);
    var d = arr[idx];
    if(!d) return;
    var match = (d[campo]||'') === valor;
    chk.checked = match;
    var tr = chk.closest('tr');
    if(tr) tr.classList.toggle('lc-selected', match);
  });
  var ca = document.getElementById('lcChkAll');
  var todos = document.querySelectorAll('.lc-row-chk');
  var marcados = document.querySelectorAll('.lc-row-chk:checked');
  if(ca){
    ca.checked = marcados.length === todos.length && todos.length > 0;
    ca.indeterminate = marcados.length > 0 && marcados.length < todos.length;
  }
  lcAtualizarMassaBar();
}

/* Aplicar alterações em massa com lógica De → Para */
function lcAplicarMassa(){
  var consDe   = (document.getElementById('lcMassaConsultorDe')    ||{}).value || '';
  var consPara = (document.getElementById('lcMassaConsultorPara')   ||{}).value || '';
  var stDe     = (document.getElementById('lcMassaStatusDe')        ||{}).value || '';
  var stPara   = (document.getElementById('lcMassaStatusPara')      ||{}).value || '';
  var treinDe  = (document.getElementById('lcMassaTreinamentoDe')   ||{}).value || '';
  var treinPara= (document.getElementById('lcMassaTreinamentoPara') ||{}).value || '';

  var temAlgo = (consPara) || (stPara) || (treinPara);
  if(!temAlgo){
    if(typeof _showToast==='function') _showToast('Preencha ao menos um campo "Para".','var(--amber)');
    return;
  }

  var indices = Array.from(document.querySelectorAll('.lc-row-chk:checked')).map(function(c){ return parseInt(c.dataset.idx); });
  if(!indices.length) return;

  var alterados = 0;
  indices.forEach(function(idx){
    if(!Array.isArray(data)||!data[idx]) return;
    var d = data[idx];
    var mudou = false;
    if(consPara && (!consDe || d.consultor === consDe)){
      d.consultor = consPara; mudou = true;
    }
    if(stPara && (!stDe || d.status === stDe)){
      d.status = stPara; mudou = true;
    }
    if(treinPara && (!treinDe || d.treinamento === treinDe)){
      if(typeof window._setTreinamentoScalar==='function') window._setTreinamentoScalar(d, treinPara);
      else d.treinamento = treinPara;
      mudou = true;
    }
    if(mudou) alterados++;
  });

  if(!alterados){
    if(typeof _showToast==='function') _showToast('Nenhum cliente correspondeu aos critérios "De".','var(--amber)');
    return;
  }

  if(typeof markUnsaved==='function') markUnsaved();
  if(typeof saveStorage==='function') saveStorage();

  // Resetar selects
  ['lcMassaConsultorDe','lcMassaConsultorPara','lcMassaStatusDe','lcMassaStatusPara',
   'lcMassaTreinamentoDe','lcMassaTreinamentoPara'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });

  lcDeselecionarTodos();
  lcRenderizar(document.getElementById('lcSearchInput').value||'');
  if(typeof renderAll==='function') renderAll();
  if(typeof renderConsultor==='function') renderConsultor();

  if(typeof _showToast==='function') _showToast('✅ '+alterados+' registro'+(alterados!==1?'s':'')+' alterado'+(alterados!==1?'s':'')+'!','var(--accent)');
}

/* Remover o consultor dos clientes selecionados (deixa "sem consultor").
   Útil logo após importar: zera todos e depois atribui um único via "Para". */
function lcRemoverConsultorSelecionados(){
  var sels = Array.from(document.querySelectorAll('.lc-row-chk:checked')).map(function(c){ return parseInt(c.dataset.idx); });
  if(!sels.length){
    if(typeof _showToast==='function') _showToast('Selecione ao menos um cliente.','var(--amber)');
    return;
  }
  var comCons = sels.filter(function(idx){ return Array.isArray(data)&&data[idx]&&(data[idx].consultor||'')!==''; });
  if(!comCons.length){
    if(typeof _showToast==='function') _showToast('Os selecionados já estão sem consultor.','var(--muted)');
    return;
  }
  if(!confirm('Remover o consultor de '+sels.length+' cliente'+(sels.length!==1?'s':'')+' selecionado'+(sels.length!==1?'s':'')+'?\n\nEles ficarão SEM consultor — depois você pode atribuir um único a todos pelo campo "Para".')) return;

  comCons.forEach(function(idx){ data[idx].consultor = ''; });

  if(typeof markUnsaved==='function') markUnsaved();
  if(typeof saveStorage==='function') saveStorage();

  lcDeselecionarTodos();
  lcRenderizar((document.getElementById('lcSearchInput')||{}).value||'');
  if(typeof renderAll==='function') renderAll();
  if(typeof renderConsultor==='function') renderConsultor();

  if(typeof _showToast==='function') _showToast('🚫 Consultor removido de '+comCons.length+' cliente'+(comCons.length!==1?'s':'')+'!','var(--accent)');
}

/* Excluir linha individual */
function lcExcluirLinha(idx){
  if(!Array.isArray(data)||!data[idx]) return;
  var nome = data[idx].cliente||'este cliente';
  if(!confirm('Excluir "'+nome+'"? Esta ação não pode ser desfeita.')) return;
  data.splice(idx,1);
  if(typeof markUnsaved==='function') markUnsaved();
  if(typeof saveStorage==='function') saveStorage();
  lcRenderizar(document.getElementById('lcSearchInput').value);
  if(typeof renderAll==='function') renderAll();
}

/* Fix 2: excluir selecionados — confirm obrigatório por spec */
function lcExcluirSelecionados(){
  var sels  = Array.from(document.querySelectorAll('.lc-row-chk:checked')).map(function(c){ return parseInt(c.dataset.idx); });
  var total = document.querySelectorAll('.lc-row-chk').length;
  if(!sels.length) return;
  if(!confirm('Deseja realmente excluir os clientes selecionados?')) return;
  sels.sort(function(a,b){return b-a;});
  sels.forEach(function(idx){ if(Array.isArray(data)&&data[idx]) data.splice(idx,1); });
  if(typeof markUnsaved==='function') markUnsaved();
  if(typeof saveStorage==='function') saveStorage();
  lcRenderizar(document.getElementById('lcSearchInput').value||'');
  if(typeof renderAll==='function') renderAll();
  if(typeof renderConsultor==='function') renderConsultor();
  if(typeof _showToast==='function') _showToast('🗑 '+sels.length+' registro'+(sels.length!==1?'s':'')+' excluído'+(sels.length!==1?'s':'')+'!','var(--red)');
}

/* Salvar tudo */
function lcSalvarTodos(){
  if(typeof markUnsaved==='function') markUnsaved();
  if(typeof saveStorage==='function') saveStorage();
  if(typeof buildSelects==='function') buildSelects();
  if(typeof buildFilterBtns==='function') buildFilterBtns();
  if(typeof renderAll==='function') renderAll();
  if(typeof renderConsultor==='function') renderConsultor();
  if(typeof renderTreinador==='function') renderTreinador();
  if(typeof renderProduto==='function') renderProduto();
  // Sincronizar com Firebase se disponível
  if(typeof _fbSave==='function' && typeof _turmaAtiva!=='undefined' && _turmaAtiva){
    var _tid=(_turmaAtiva&&_turmaAtiva.id)||_turmaAtiva;
    if(_tid && typeof _tid==='string'){
      _fbSave('turmas/'+_tid+'/clientes', data).catch(function(e){console.warn('[LC] Firebase save:',e);});
    }
  }
  _showToast && _showToast('✅ Alterações salvas!','var(--accent)');
}

function lcFiltrar(){
  var q=document.getElementById('lcSearchInput').value;
  lcRenderizar(q);
}

/* Adiciona um novo treinamento ao mesmo cliente.
   Copia consultor + treinador do registro de origem; treinamento/valor/status zerados.
   Aparece imediatamente abaixo (agrupado por nome de cliente no sort do renderizar). */
function lcAddTreinoCliente(refIdx){
  if(!Array.isArray(data) || !data[refIdx]) return;
  var src = data[refIdx];
  var novo = {
    cliente:     src.cliente,
    consultor:   src.consultor || '',
    treinador:   src.treinador || '-',
    treinamento: '',
    valor:       0,
    status:      'aberto',
    entrada:     0,
    info:        ''
  };
  data.push(novo);
  if(typeof markUnsaved==='function') markUnsaved();
  if(typeof saveStorage==='function') saveStorage();
  // Re-render e tenta focar no select do novo treino
  lcRenderizar((document.getElementById('lcSearchInput')||{}).value || '');
  // Sincronizar com Firebase se disponível
  if(typeof _fbSave==='function' && typeof _turmaAtiva!=='undefined' && _turmaAtiva){
    var _tid=(_turmaAtiva&&_turmaAtiva.id)||_turmaAtiva;
    if(_tid && typeof _tid==='string'){
      _fbSave('turmas/'+_tid+'/clientes', data).catch(function(e){console.warn('[LC] Firebase save:',e);});
    }
  }
  // Solução D: contar treinos atuais do cliente para feedback rico
  var _qtdTreinos = (typeof _contarTreinosCliente==='function')?_contarTreinosCliente(data, src.cliente):0;
  if(typeof _showToast==='function') _showToast('+ Treinamento adicionado a '+(src.cliente||'cliente')+(_qtdTreinos>1?' (agora '+_qtdTreinos+' treinamentos)':''),'var(--accent)');
}

// Expor globalmente
window.abrirListaClientes  = abrirListaClientes;
window.fecharListaClientes = fecharListaClientes;
window.lcFiltrar           = lcFiltrar;
window.lcRenderizar        = lcRenderizar;
window.lcCellChange        = lcCellChange;
window.lcOnChkChange       = lcOnChkChange;
window.lcToggleAll         = lcToggleAll;
window.lcDeselecionarTodos = lcDeselecionarTodos;
window.lcExcluirLinha      = lcExcluirLinha;
window.lcExcluirSelecionados = lcExcluirSelecionados;
window.lcSalvarTodos       = lcSalvarTodos;
window.lcAplicarMassa      = lcAplicarMassa;
window.lcSelecionarPorDe   = lcSelecionarPorDe;
window.lcEditarNomeCliente  = lcEditarNomeCliente;
window.lcSalvarNomeCliente  = lcSalvarNomeCliente;
window.lcCancelarNomeCliente= lcCancelarNomeCliente;
window.lcAddTreinoCliente   = lcAddTreinoCliente;

// BLOQUEIOS: modal NÃO fecha com ESC nem backdrop
// (backdrop bloqueado via onclick="event.stopPropagation()" no HTML)

/* ══ fim MODAL LISTA DE CLIENTES v12 ══ */
