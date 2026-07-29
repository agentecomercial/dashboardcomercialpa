/* ═══════════════════════════════════════════════════════════
   17-presenca.js — Controle de Presença de Clientes
   Módulo autônomo: não polui 02-main.js
   Integra com: data[], saveStorage(), _getSessao(), renderAll()
═══════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ── Constantes ── */
var PRESENCA_OPTS = [
  { v: 'pendente',  l: 'Pendente', icon: '⏳', cor: 'var(--muted)', bg: 'rgba(136,136,136,.12)', border: 'rgba(136,136,136,.3)' },
  { v: 'presente',  l: 'Presente', icon: '✅', cor: '#34d399',      bg: 'rgba(52,211,153,.12)',  border: 'rgba(52,211,153,.35)' },
  { v: 'falta',     l: 'Falta',    icon: '❌', cor: '#ff5f57',      bg: 'rgba(255,95,87,.10)',   border: 'rgba(255,95,87,.35)'  }
];

/* ── Estado ── */
var _filtroPresenca = null; // null = todos

/* ── Lookup rápido ── */
function _opt(v){ return PRESENCA_OPTS.find(function(o){ return o.v===v; }) || PRESENCA_OPTS[0]; }

/* ── Verificar permissão de edição ── */
function _podeEditar(ri){
  var d = (typeof data !== 'undefined') ? data[ri] : null;
  if(!d) return false;
  var sess = (typeof _getSessao === 'function') ? _getSessao() : null;
  if(!sess) return true; // sem sessão = adm local
  var perfil = sess.perfil || 'adm';
  if(perfil === 'adm') return true;
  if(perfil === 'consultor'){
    var vinculo = (sess.vinculo || '').toUpperCase();
    return (d.consultor || '').toUpperCase() === vinculo;
  }
  return false;
}

/* ── Alterar presença inline ── */
window._alterarPresenca = function(ri, novoStatus){
  if(!_podeEditar(ri)) return;
  var d = data[ri];
  if(!d) return;
  var anterior = d.presenca || 'pendente';
  if(anterior === novoStatus) return;

  // Registrar no histórico
  var sess = (typeof _getSessao === 'function') ? _getSessao() : null;
  var quem = sess ? (sess.vinculo || sess.nome || sess.login || 'adm') : 'adm';
  if(!d.presencaLog) d.presencaLog = [];
  d.presencaLog.push({
    por: quem,
    em: new Date().toISOString(),
    de: anterior,
    para: novoStatus
  });

  d.presenca = novoStatus;

  if(typeof markUnsaved === 'function') markUnsaved();
  if(typeof saveStorage === 'function') saveStorage();

  // Atualizar somente o badge — sem re-renderizar tudo
  _atualizarBadge(ri);
  _atualizarContadores();
  if(typeof window._atualizarBarraPresencaConsultor==='function') window._atualizarBarraPresencaConsultor();

  // Toast
  var opt = _opt(novoStatus);
  if(typeof _showToast === 'function'){
    _showToast(opt.icon + ' ' + d.cliente + ' → ' + opt.l, opt.cor);
  }
};

/* ── Ciclo de clique no badge ── */
/* ── Abrir dropdown de seleção ── */
window._abrirDropPresenca = function(e, ri){
  e.stopPropagation();
  if(!_podeEditar(ri)){
    if(typeof _showToast === 'function') _showToast('⛔ Sem permissão para alterar presença.','var(--red)');
    return;
  }
  // Fechar dropdown anterior
  var old = document.getElementById('_presDropdown');
  if(old){ old.remove(); return; }

  var d = data[ri];
  var btn = e.currentTarget;
  var rect = btn.getBoundingClientRect();

  var drop = document.createElement('div');
  drop.id = '_presDropdown';
  drop.style.cssText = 'position:fixed;z-index:99999;background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:6px;min-width:180px;box-shadow:0 16px 48px rgba(0,0,0,.75);display:flex;flex-direction:column;gap:3px;';
  drop.style.top  = Math.min(rect.bottom + 6, window.innerHeight - 200) + 'px';
  drop.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';

  PRESENCA_OPTS.forEach(function(opt){
    var item = document.createElement('button');
    var atual = (d.presenca || 'pendente') === opt.v;
    item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;border:1px solid '+(atual?opt.border:'transparent')+';background:'+(atual?opt.bg:'transparent')+';font-family:"DM Sans",sans-serif;font-size:12px;color:'+(atual?opt.cor:'var(--muted)')+';width:100%;text-align:left;transition:background .1s;';
    item.innerHTML = '<span style="font-size:14px;">'+opt.icon+'</span><span style="font-weight:'+(atual?'700':'400')+';">'+opt.l+'</span>'+(atual?'<span style="margin-left:auto;font-size:10px;color:'+opt.cor+';">●</span>':'');
    item.onmouseover = function(){ if(!atual){ this.style.background='var(--surface2)'; this.style.color='var(--text)'; } };
    item.onmouseout  = function(){ if(!atual){ this.style.background='transparent'; this.style.color='var(--muted)'; } };
    item.onclick = function(){ drop.remove(); window._alterarPresenca(ri, opt.v); };
    drop.appendChild(item);
  });

  document.body.appendChild(drop);
  setTimeout(function(){
    document.addEventListener('click', function _c(){ drop.remove(); document.removeEventListener('click',_c); });
  }, 0);
};

/* ── Gerar HTML do badge para a tabela ── */
window._presencaBadgeHtml = function(ri){
  var d = data[ri];
  if(!d) return '';
  var opt = _opt(d.presenca || 'pendente');
  var podeEdit = _podeEditar(ri);
  var cursor = podeEdit ? 'cursor:pointer;' : 'cursor:default;';
  var onclick = podeEdit
    ? 'onclick="_abrirDropPresenca(event,'+ri+')"'
    : '';
  return '<span '+onclick+' title="'+opt.l+(podeEdit?' · Clique para alterar':'')+'" style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;border:1px solid '+opt.border+';background:'+opt.bg+';color:'+opt.cor+';'+cursor+'white-space:nowrap;user-select:none;transition:opacity .15s;" onmouseover="this.style.opacity=\'0.8\'" onmouseout="this.style.opacity=\'1\'">'
    + opt.icon + ' ' + opt.l + '</span>';
};

/* ── Atualizar só o badge de 1 linha (sem re-render) ── */
function _atualizarBadge(ri){
  // Atualiza em qualquer elemento com data-presenca-ri (td na tabela geral, div no accordion)
  document.querySelectorAll('[data-presenca-ri="'+ri+'"]').forEach(function(el){
    el.innerHTML = window._presencaBadgeHtml(ri);
  });
}

/* ── Contadores de presença ── */
function _atualizarContadores(){
  var bar = document.getElementById('presencaCountBar');
  if(!bar) return;
  var base = (typeof data !== 'undefined') ? data.filter(function(d){ return d&&d.cliente; }) : [];
  if(_filtroPresenca) base = base.filter(function(d){ return (d.presenca||'pendente')===_filtroPresenca; });
  var total    = base.length;
  var presente = base.filter(function(d){ return d.presenca==='presente'; }).length;
  var falta    = base.filter(function(d){ return d.presenca==='falta'; }).length;
  var pendente = base.filter(function(d){ return !d.presenca||d.presenca==='pendente'; }).length;
  var pct      = total>0 ? Math.round((presente/total)*100) : 0;

  bar.innerHTML =
    '<span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-right:8px;">Presença</span>'
    +'<span style="font-size:11px;color:#34d399;font-weight:700;" title="Presentes">✅ '+presente+'</span>'
    +'<span style="font-size:11px;color:var(--muted);margin:0 6px;">·</span>'
    +'<span style="font-size:11px;color:#ff5f57;font-weight:700;" title="Faltas">❌ '+falta+'</span>'
    +'<span style="font-size:11px;color:var(--muted);margin:0 6px;">·</span>'
    +'<span style="font-size:11px;color:var(--muted);" title="Pendentes">⏳ '+pendente+'</span>'
    +'<span style="font-size:11px;color:var(--muted);margin:0 8px;">|</span>'
    +'<span style="font-size:12px;font-weight:700;color:'+(pct>=80?'#34d399':pct>=50?'#ffb740':'#ff5f57')+';">'+pct+'% presença</span>';
}
window._presencaAtualizarContadores = _atualizarContadores;

/* ═══════════════════════════════════════════════════════════
   Barra de presença clicável + copiar card por status
   (compartilhado por consultor e treinador)
═══════════════════════════════════════════════════════════ */

/* Conta presente/falta/pendente/pct de um recorte de clientes */
function _presencaCounts(base){
  var presente = base.filter(function(d){ return d.presenca==='presente'; }).length;
  var falta    = base.filter(function(d){ return d.presenca==='falta'; }).length;
  var pendente = base.filter(function(d){ return !d.presenca||d.presenca==='pendente'; }).length;
  var tot = base.length;
  return { presente:presente, falta:falta, pendente:pendente, total:tot,
           pct: tot>0 ? Math.round(presente/tot*100) : 0 };
}

/* HTML da barra: status viram botões que filtram; com filtro ativo surge o botão copiar */
function _barraPresencaHtml(base, scope, filtroAtivo){
  var c = _presencaCounts(base);
  var corPct = c.pct>=80?'#34d399':c.pct>=50?'#ffb740':'#ff5f57';
  var setFn  = scope==='treinador' ? '_setFiltroPresencaTreinador' : '_setFiltroPresencaConsultor';
  function chip(v,n){
    var o=_opt(v), ativo=filtroAtivo===v;
    return '<button onclick="'+setFn+'(\''+v+'\')" title="Filtrar '+o.l+' e copiar" '
      +'style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .12s;white-space:nowrap;'
      +'border:1px solid '+(ativo?o.border:'transparent')+';background:'+(ativo?o.bg:'transparent')+';color:'+o.cor+';"'
      +' onmouseover="this.style.opacity=\'0.75\'" onmouseout="this.style.opacity=\'1\'">'+o.icon+' '+n+'</button>';
  }
  var html =
    '<span style="font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-right:2px;">Presença</span>'
    +chip('presente',c.presente)
    +'<span style="color:var(--muted);">·</span>'
    +chip('falta',c.falta)
    +'<span style="color:var(--muted);">·</span>'
    +chip('pendente',c.pendente)
    +'<span style="color:var(--muted);margin:0 4px;">|</span>'
    +'<span style="font-weight:700;color:'+corPct+';">'+c.pct+'% presença</span>';
  if(filtroAtivo){
    var o=_opt(filtroAtivo);
    var n=base.filter(function(d){ return (d.presenca||'pendente')===filtroAtivo; }).length;
    html += '<button onclick="_copiarCardPresenca(\''+scope+'\')" title="Copiar imagem — '+o.l+' ('+n+')" '
      +'style="display:inline-flex;align-items:center;gap:6px;margin-left:8px;padding:5px 12px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;'
      +'border:1px solid rgba(168,85,247,.4);background:rgba(168,85,247,.10);color:var(--purple);transition:all .15s;"'
      +' onmouseover="this.style.background=\'rgba(168,85,247,.18)\'" onmouseout="this.style.background=\'rgba(168,85,247,.10)\'">'
      +'📷 Copiar '+o.icon+' '+o.l+' ('+n+')</button>';
  }
  return html;
}

/* Período da turma (mesma lógica do card financeiro) */
function _periodoPresencaStr(){
  var meses=['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
  var per='';
  if(typeof _periodText!=='undefined' && _periodText) per=String(_periodText).replace(/\s+/g,' ').trim();
  if(!per && typeof _periodStart!=='undefined' && _periodStart){
    var ps=String(_periodStart).split('-'); var mi=parseInt(ps[1],10)-1;
    if(mi>=0&&mi<=11) per=meses[mi]+'/'+ps[0];
  }
  if(!per){ var dn=new Date(); per=meses[dn.getMonth()]+'/'+dn.getFullYear(); }
  return per;
}
/* Nome da turma (nome — código) */
function _turmaLabelStr(){
  var t = window._turmaAtiva;
  if(!t) return '';
  if(t.codigo && t.nome && t.nome!==t.codigo) return t.nome+' — '+t.codigo;
  return t.codigo || t.nome || '';
}

/* Desenha o card de presença (lista de alunos do status filtrado) num canvas */
function _cardPresencaCanvas(nome, filtro, lista, counts, totalTurma, pct, periodo, turma){
  var SAN='system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
  var o=_opt(filtro);
  var corMap={ presente:'#34d399', falta:'#ff5f57', pendente:'#8b98ad' };
  var cor=corMap[filtro]||'#8b98ad';
  var W=1040, DPR=2, mg=34;
  var perCol=Math.max(Math.ceil(lista.length/2),1);
  var listTop=250, lineH=40, footerH=96;
  var H=listTop + perCol*lineH + footerH;

  var cv=document.createElement('canvas');
  cv.width=W*DPR; cv.height=H*DPR;
  var ctx=cv.getContext('2d'); ctx.scale(DPR,DPR);
  function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function hexA(hex,a){var n=parseInt(hex.slice(1),16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';}

  ctx.fillStyle='#080e18'; ctx.fillRect(0,0,W,H);

  // header com gradiente na cor do status
  var hH=104;
  var g=ctx.createLinearGradient(0,0,W,0);
  g.addColorStop(0,hexA(cor,0.20)); g.addColorStop(0.6,hexA(cor,0));
  ctx.fillStyle=g; ctx.fillRect(0,0,W,hH);
  ctx.strokeStyle=hexA(cor,0.35); ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,hH); ctx.lineTo(W,hH); ctx.stroke();

  // nome + turma
  ctx.textAlign='left'; ctx.fillStyle='#e6edf3'; ctx.font='800 34px '+SAN;
  ctx.fillText(nome.toUpperCase(), mg, 50);
  if(turma){ ctx.fillStyle='#8b98ad'; ctx.font='500 16px '+SAN; ctx.fillText('Turma '+turma, mg, 76); }
  // período (direita)
  ctx.textAlign='right'; ctx.fillStyle='#8b98ad'; ctx.font='600 15px '+SAN;
  ctx.fillText(periodo, W-mg, 50);

  // título da seção (status)
  ctx.textAlign='left'; ctx.fillStyle=cor; ctx.font='800 30px '+SAN;
  ctx.fillText(o.icon+'  '+o.l.toUpperCase()+'  ('+lista.length+')', mg, 170);
  // % presença geral (direita)
  var corPct = pct>=80?'#34d399':pct>=50?'#ffb740':'#ff5f57';
  ctx.textAlign='right'; ctx.fillStyle=corPct; ctx.font='800 30px '+SAN;
  ctx.fillText(pct+'% presença', W-mg, 170);

  // divisória
  ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(mg,196); ctx.lineTo(W-mg,196); ctx.stroke();

  // lista de nomes em 2 colunas
  ctx.textAlign='left'; ctx.font='600 19px '+SAN;
  var colW=(W-mg*2)/2;
  if(lista.length===0){
    ctx.fillStyle='#8b98ad'; ctx.font='500 18px '+SAN;
    ctx.fillText('Nenhum aluno neste status.', mg, listTop);
  } else {
    lista.forEach(function(nomeAluno,i){
      var col=i<perCol?0:1, row=i<perCol?i:i-perCol;
      var x=mg+col*colW, y=listTop+row*lineH;
      ctx.fillStyle=cor; ctx.beginPath(); ctx.arc(x+5,y-6,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#e6edf3'; ctx.font='600 19px '+SAN;
      var nm=String(nomeAluno).toUpperCase(), maxW=colW-40;
      while(ctx.measureText(nm).width>maxW && nm.length>4){ nm=nm.slice(0,-2); }
      if(String(nomeAluno).toUpperCase()!==nm) nm=nm+'…';
      ctx.fillText(nm, x+18, y);
    });
  }

  // rodapé: resumo dos 3 status + total
  var fy=H-footerH+34;
  ctx.strokeStyle='rgba(255,255,255,0.10)';
  ctx.beginPath(); ctx.moveTo(mg,fy-30); ctx.lineTo(W-mg,fy-30); ctx.stroke();
  var itens=[['✅',counts.presente,'#34d399'],['❌',counts.falta,'#ff5f57'],['⏳',counts.pendente,'#8b98ad']];
  ctx.textAlign='left'; ctx.font='800 22px '+SAN;
  var fx=mg;
  itens.forEach(function(it){
    ctx.fillStyle=it[2]; var t=it[0]+' '+it[1];
    ctx.fillText(t, fx, fy+8); fx += ctx.measureText(t).width + 34;
  });
  ctx.textAlign='right'; ctx.fillStyle='#8b98ad'; ctx.font='600 15px '+SAN;
  ctx.fillText(totalTurma+' aluno'+(totalTurma!==1?'s':'')+' na turma', W-mg, fy+6);

  return cv;
}

/* Texto que acompanha a imagem (para WhatsApp) */
function _textoPresenca(nome, filtro, lista, counts, pct, periodo, turma){
  var o=_opt(filtro);
  var L=[];
  L.push(o.icon+' '+nome.toUpperCase()+' — '+o.l.toUpperCase()+' ('+lista.length+')');
  L.push((turma?'Turma '+turma+' · ':'')+periodo);
  L.push('');
  if(lista.length) lista.forEach(function(n){ L.push('• '+String(n).toUpperCase()); });
  else L.push('(nenhum aluno neste status)');
  L.push('');
  L.push('✅ Presentes: '+counts.presente+' · ❌ Faltas: '+counts.falta+' · ⏳ Pendentes: '+counts.pendente);
  L.push('📊 '+pct+'% de presença');
  return L.join('\n');
}

/* Copiar imagem + texto do status filtrado (consultor ou treinador) */
window._copiarCardPresenca = function(scope){
  var nome, filtro, base;
  if(scope==='treinador'){
    nome=window._treinadorAtivo; filtro=_filtroPresencaTreinador;
    base=data.filter(function(d){ return d&&d.cliente&&d.treinador===nome; });
  } else {
    nome=window._consultorAtivo; filtro=_filtroPresencaConsultor;
    base=data.filter(function(d){ return d&&d.cliente&&d.consultor===nome; });
  }
  if(!nome || !filtro) return;

  var lista=base.filter(function(d){ return (d.presenca||'pendente')===filtro; })
                .map(function(d){ return d.cliente; })
                .sort(function(a,b){ return String(a).localeCompare(String(b),'pt-BR'); });
  var counts=_presencaCounts(base);
  var periodo=_periodoPresencaStr();
  var turma=_turmaLabelStr();
  var txt=_textoPresenca(nome, filtro, lista, counts, counts.pct, periodo, turma);
  var opt=_opt(filtro);

  function ok(){ if(typeof _showToast==='function') _showToast(opt.icon+' Card de '+opt.l+' copiado — cole no WhatsApp.', opt.cor); }
  function fail(){ if(_copiarTextoPresencaFallback(txt)) ok(); else if(typeof _showToast==='function') _showToast('❌ Falha ao copiar.','var(--red)'); }
  function soTexto(){
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok,fail);
    else fail();
  }

  var canvas=null;
  try{ canvas=_cardPresencaCanvas(nome, filtro, lista, counts, counts.total, counts.pct, periodo, turma); }catch(e){ canvas=null; }
  if(canvas && navigator.clipboard && window.ClipboardItem && navigator.clipboard.write){
    canvas.toBlob(function(blob){
      if(!blob){ soTexto(); return; }
      try{
        var item=new ClipboardItem({ 'image/png':blob, 'text/plain':new Blob([txt],{type:'text/plain'}) });
        navigator.clipboard.write([item]).then(ok, function(){ soTexto(); });
      }catch(e){ soTexto(); }
    },'image/png');
  } else soTexto();
};

function _copiarTextoPresencaFallback(txt){
  try{
    var ta=document.createElement('textarea');
    ta.value=txt; ta.style.position='fixed'; ta.style.top='-2000px'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    var ok=document.execCommand('copy'); document.body.removeChild(ta); return ok;
  }catch(e){ return false; }
}

/* ── Atualizar barra de presença no card do consultor ── */
window._atualizarBarraPresencaConsultor = function(){
  var bar = document.getElementById('presencaBarConsultor');
  if(!bar) return;
  var c = window._consultorAtivo;
  if(!c || typeof data === 'undefined') return;
  var base = data.filter(function(d){ return d&&d.cliente&&d.consultor===c; });
  bar.innerHTML = _barraPresencaHtml(base, 'consultor', _filtroPresencaConsultor);
};

/* ── Filtros de presença ── */
window._setFiltroPresenca = function(v){
  _filtroPresenca = (_filtroPresenca === v) ? null : v; // toggle
  // Atualizar botões
  PRESENCA_OPTS.forEach(function(opt){
    var btn = document.getElementById('pfbtn_'+opt.v);
    if(!btn) return;
    var ativo = _filtroPresenca === opt.v;
    btn.style.background = ativo ? opt.bg : 'transparent';
    btn.style.borderColor = ativo ? opt.border : 'rgba(255,255,255,.08)';
    btn.style.color = ativo ? opt.cor : 'var(--muted)';
    btn.style.fontWeight = ativo ? '700' : '400';
  });
  if(typeof renderAll === 'function') renderAll();
};

window._getFiltroPresenca = function(){ return _filtroPresenca; };

/* ── Estado filtro presença do card consultor ── */
var _filtroPresencaConsultor = null;

window._setFiltroPresencaConsultor = function(v){
  _filtroPresencaConsultor = (_filtroPresencaConsultor === v) ? null : v;
  _renderFiltrosPresencaConsultor();
  if(typeof _renderConsultorDetail === 'function' && window._consultorAtivo){
    _renderConsultorDetail(window._consultorAtivo);
  }
};

window._getFiltroPresencaConsultor = function(){ return _filtroPresencaConsultor; };

function _renderFiltrosPresencaConsultor(){
  var wrap = document.getElementById('presencaFBtnsConsultor');
  if(!wrap) return;
  wrap.innerHTML = PRESENCA_OPTS.map(function(opt){
    var ativo = _filtroPresencaConsultor === opt.v;
    return '<button id="pfbtnc_'+opt.v+'" onclick="_setFiltroPresencaConsultor(\''+opt.v+'\')" '
      +'style="font-size:11px;padding:3px 10px;border-radius:20px;border:1px solid '+(ativo?opt.border:'rgba(255,255,255,.08)')+';background:'+(ativo?opt.bg:'transparent')+';color:'+(ativo?opt.cor:'var(--muted)')+';cursor:pointer;font-family:\'DM Sans\',sans-serif;font-weight:'+(ativo?'700':'400')+';transition:all .12s;white-space:nowrap;"'
      +' onmouseover="this.style.opacity=\'0.8\'" onmouseout="this.style.opacity=\'1\'">'
      +opt.icon+' '+opt.l+'</button>';
  }).join('');
}
window._renderFiltrosPresencaConsultor = _renderFiltrosPresencaConsultor;

/* ── Atualizar barra de presença no card do treinador (espelho do consultor) ── */
window._atualizarBarraPresencaTreinador = function(){
  var bar = document.getElementById('presencaBarTreinador');
  if(!bar) return;
  var t = window._treinadorAtivo;
  if(!t || typeof data === 'undefined') return;
  var base = data.filter(function(d){ return d&&d.cliente&&d.treinador===t; });
  bar.innerHTML = _barraPresencaHtml(base, 'treinador', _filtroPresencaTreinador);
};

/* ── Estado filtro presença do card treinador ── */
var _filtroPresencaTreinador = null;

window._setFiltroPresencaTreinador = function(v){
  _filtroPresencaTreinador = (_filtroPresencaTreinador === v) ? null : v;
  _renderFiltrosPresencaTreinador();
  if(typeof _renderTreinadorDetail === 'function' && window._treinadorAtivo){
    _renderTreinadorDetail(window._treinadorAtivo);
  }
};

window._getFiltroPresencaTreinador = function(){ return _filtroPresencaTreinador; };

function _renderFiltrosPresencaTreinador(){
  var wrap = document.getElementById('presencaFBtnsTreinador');
  if(!wrap) return;
  wrap.innerHTML = PRESENCA_OPTS.map(function(opt){
    var ativo = _filtroPresencaTreinador === opt.v;
    return '<button id="pfbtnt_'+opt.v+'" onclick="_setFiltroPresencaTreinador(\''+opt.v+'\')" '
      +'style="font-size:11px;padding:3px 10px;border-radius:20px;border:1px solid '+(ativo?opt.border:'rgba(255,255,255,.08)')+';background:'+(ativo?opt.bg:'transparent')+';color:'+(ativo?opt.cor:'var(--muted)')+';cursor:pointer;font-family:\'DM Sans\',sans-serif;font-weight:'+(ativo?'700':'400')+';transition:all .12s;white-space:nowrap;"'
      +' onmouseover="this.style.opacity=\'0.8\'" onmouseout="this.style.opacity=\'1\'">'
      +opt.icon+' '+opt.l+'</button>';
  }).join('');
}
window._renderFiltrosPresencaTreinador = _renderFiltrosPresencaTreinador;

/* ── Renderizar botões de filtro (aba geral) ── */
window._renderFiltrosPresenca = function(){
  var wrap = document.getElementById('presencaFBtns');
  if(!wrap) return;
  wrap.innerHTML = PRESENCA_OPTS.map(function(opt){
    var ativo = _filtroPresenca === opt.v;
    return '<button id="pfbtn_'+opt.v+'" onclick="_setFiltroPresenca(\''+opt.v+'\')" '
      +'style="font-size:11px;padding:3px 10px;border-radius:20px;border:1px solid '+(ativo?opt.border:'rgba(255,255,255,.08)')+';background:'+(ativo?opt.bg:'transparent')+';color:'+(ativo?opt.cor:'var(--muted)')+';cursor:pointer;font-family:\'DM Sans\',sans-serif;font-weight:'+(ativo?'700':'400')+';transition:all .12s;white-space:nowrap;"'
      +' onmouseover="this.style.opacity=\'0.8\'" onmouseout="this.style.opacity=\'1\'">'
      +opt.icon+' '+opt.l+'</button>';
  }).join('');
};

/* ── Aplicar filtro de presença no filtered() — patch ── */
var _origFiltered = null;
function _patchFiltered(){
  if(typeof filtered !== 'function') return;
  if(_origFiltered) return; // já patchado
  _origFiltered = filtered;
  window.filtered = function(){
    var f = _origFiltered.apply(this, arguments);
    if(_filtroPresenca){
      f = f.filter(function(d){ return (d.presenca||'pendente') === _filtroPresenca; });
    }
    return f;
  };
}

/* ── Inicializar após DOM pronto ── */
function _init(){
  _patchFiltered();
  _atualizarContadores();
  _renderFiltrosPresenca();

  // Patch no renderAll para sempre atualizar contadores
  if(typeof renderAll === 'function' && !window._presencaRenderAllPatchado){
    window._presencaRenderAllPatchado = true;
    var _origRA = window.renderAll;
    window.renderAll = function(){
      _origRA.apply(this, arguments);
      _atualizarContadores();
      _renderFiltrosPresenca();
    };
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}

// Expor para re-init após login
window._presencaInit = _init;

window._log&&window._log('[Presença] Módulo carregado ✅');
})();
