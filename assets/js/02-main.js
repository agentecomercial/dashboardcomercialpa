/* ═══════════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════════ */
const STORAGE_KEY='ci_dashboard_v1',BACKUP_KEY='ci_dashboard_backup',TURMAS_KEY='ci_turmas_index',TURMA_ATIVA_KEY='ci_turma_ativa';
/* === NOVO NÓ UNIFICADO === */
const TURMAS_NODE='turmas'; // turmas/{id} = metadados + clientes
let _turmaAtiva=null,_periodText='',_periodStart='',_periodEnd='';
let _turmaGlobalAtiva=null;
/* Rastreia quais campos foram alterados desde o último save granular */
var _dashDirty={clientes:false,titulo:false,info:false,period:false,equipe:false};
function _resetDirty(){_dashDirty={clientes:false,titulo:false,info:false,period:false,equipe:false};}
function _buildPatch(){
  var titulo=document.getElementById('dashTitle')?document.getElementById('dashTitle').textContent:'';
  var info=document.getElementById('infoBarText')?document.getElementById('infoBarText').textContent:'';
  var patch={updatedAt:Date.now()};
  if(_dashDirty.clientes) patch.clientes=data;
  if(_dashDirty.titulo)   patch.titulo=titulo;
  if(_dashDirty.info)     patch.info=info;
  if(_dashDirty.period){  patch.periodStart=_periodStart;patch.periodEnd=_periodEnd;patch.periodText=_periodText; }
  if(_dashDirty.equipe){
    if(typeof allConsultors!=='undefined') patch.consultores=allConsultors;
    if(typeof allTrainers!=='undefined')   patch.treinadores=allTrainers;
  }
  /* Se nada marcado (save manual sem flag), enviar tudo como segurança */
  var algum=Object.values(_dashDirty).some(Boolean);
  if(!algum){
    patch.clientes=data;patch.titulo=titulo;patch.info=info;
    patch.periodStart=_periodStart;patch.periodEnd=_periodEnd;patch.periodText=_periodText;
    if(typeof allConsultors!=='undefined') patch.consultores=allConsultors;
    if(typeof allTrainers!=='undefined')   patch.treinadores=allTrainers;
  }
  return patch;
}

function definirTurmaAtiva(id){
  if(_turmaGlobalAtiva===id){
    // Desativar
    _turmaGlobalAtiva=null;
    localStorage.removeItem('ci_turma_global_ativa');
    if(window._fbSave){
      window._fbSave('config/turma_global_ativa',null).then(function(){
        _showToast('⛔ Turma desativada.','var(--amber)');
      }).catch(function(){
        _showToast('⚠️ Desativado localmente.','var(--amber)');
      });
    }
  } else {
    // Ativar
    _turmaGlobalAtiva=id;
    localStorage.setItem('ci_turma_global_ativa',id);
    if(window._fbSave){
      window._fbSave('config/turma_global_ativa',id).then(function(){
        _showToast('✅ Turma ativa definida para todos os usuários!','var(--accent)');
      }).catch(function(){
        _showToast('⚠️ Salvo localmente. Sincronize para atualizar no Firebase.','var(--amber)');
      });
    }
  }
  renderTurmasGrid();
}

function _carregarTurmaGlobalAtiva(cb){
  const local=localStorage.getItem('ci_turma_global_ativa');
  if(local) _turmaGlobalAtiva=local;
  if(window._fbGet){
    var _cbChamado=false;
    var _timeout=setTimeout(function(){
      if(!_cbChamado){_cbChamado=true;if(cb)cb();}
    },2000);
    window._fbGet('config/turma_global_ativa').then(function(v){
      if(v){_turmaGlobalAtiva=v;localStorage.setItem('ci_turma_global_ativa',v);}
      if(!_cbChamado){_cbChamado=true;clearTimeout(_timeout);if(cb)cb();}
    }).catch(function(){
      if(!_cbChamado){_cbChamado=true;clearTimeout(_timeout);if(cb)cb();}
    });
  } else {
    if(cb)cb();
  }
}
let META=0,editIdx=null,confirmIdx=null;
let activeTrainer=null,activeConsultor=null,activeStatus=null,activeCliente=null;
let activeConsultorStatus=null,activeTreinadorStatus=null;
let sortCol=null,sortDir=1,entradaRealizada=false,addEntradaRealizada=false;
let savedData='[]',data=[];
let allTrainers=[],allConsultors=[];

/* Getter dinâmico p/ data/allTrainers/allConsultors — necessário porque
   essas variáveis são REATRIBUÍDAS em runtime (ex: data = s.data) e
   atribuir window.data uma vez não acompanha as mudanças. */
window.__getData         = function(){ return data; };
window.__getAllTrainers  = function(){ return allTrainers; };
window.__getAllConsultors = function(){ return allConsultors; };

/* ═══════════════════════════════════════════
   PERMISSÕES PADRÃO POR PERFIL
═══════════════════════════════════════════ */
const PERMS_PADRAO={
  adm:       {verGeral:true, verConsultor:true, verTreinador:true, verProduto:true, verValores:true, editar:true, exportar:true,  gerenciarUsuarios:true,  configuracoes:true },
  ministrante:{verGeral:true, verConsultor:true, verTreinador:true, verProduto:false,verValores:true, editar:false,exportar:false, gerenciarUsuarios:false, configuracoes:false},
  consultor:  {verGeral:false,verConsultor:true, verTreinador:false,verProduto:true, verValores:true, editar:false,exportar:false, gerenciarUsuarios:false, configuracoes:false},
  treinador:  {verGeral:false,verConsultor:false,verTreinador:true, verProduto:false,verValores:true, editar:false,exportar:false, gerenciarUsuarios:false, configuracoes:false}
};

function _getPermsUsuario(perfil, permissoesSalvas){
  var padrao=PERMS_PADRAO[perfil]||PERMS_PADRAO.consultor;
  if(!permissoesSalvas) return Object.assign({},padrao);
  var merged=Object.assign({},padrao,permissoesSalvas);
  // Permissões que o perfil garante por padrão não podem ser removidas por
  // registros antigos no Firebase (ex: consultor sempre tem verProduto).
  Object.keys(padrao).forEach(function(k){ if(padrao[k]===true) merged[k]=true; });
  return merged;
}
// ── Constantes centralizadas (Fase 1.A — fonte única) ──
window.APP_CONST = {
  MESES_CURTO: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
  MESES_FULL:  ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
  PALETTE_T:   ['#60a5fa','#34d399','#ffb740','#f472b6','#a78bfa','#fb923c','#38bdf8'],
  /* PALETTE_C — 15 cores distintas pra que nomes de consultores adjacentes
     nunca repitam tonalidade. Cobrem espectro completo (roxo, azul, ciano,
     verde, lima, amarelo, laranja, vermelho, rosa, magenta, violeta). */
  PALETTE_C:   ['#c084fc','#38bdf8','#fb923c','#34d399','#f472b6','#ffb740','#60a5fa','#ef4444','#06b6d4','#a78bfa','#84cc16','#f97316','#ec4899','#14b8a6','#fde047'],
  PALETTE_SWIM:    ['var(--blue)','var(--accent)','#a78bfa','var(--red)','var(--amber)','var(--green)','#f472b6','#fb923c','#38bdf8','#e879f9'],
  PALETTE_SWIM_BG: ['rgba(96,165,250,.15)','rgba(200,240,90,.15)','rgba(167,139,250,.18)','rgba(255,95,87,.15)','rgba(255,183,64,.15)','rgba(52,211,153,.15)','rgba(244,114,182,.15)','rgba(251,146,60,.15)','rgba(56,189,248,.15)','rgba(232,121,249,.15)'],
  NB_CLS: ['nb-blue','nb-green','nb-amber','nb-pink','nb-purple','nb-orange'],
  TREINAMENTOS: ['BHP','CEOP','CI','FCIS','FGPC','IF','ML5','TAV','MAESTRIA','MASTER COACHING','CIS_GLOBAL','CIS','TCE - BRONZE','TCE - OURO','TCE - BLACK','TCE - VIP','MENT. IA PARA NEGOCIOS','JE','GE','PDA','DP','TEAM COACHING'],
};

// Aliases preservando 100% da API existente
const allTreinamentos = APP_CONST.TREINAMENTOS;
const PALETTE_T = APP_CONST.PALETTE_T;
const PALETTE_C = APP_CONST.PALETTE_C;
const NB_CLS = APP_CONST.NB_CLS;

/* Exposição explícita ao window:
   const/let no top-level de scripts clássicos NÃO criam propriedades
   em window. Outros módulos (ex: 35-ms-filters.js dentro de IIFE) podem
   falhar ao acessá-las. Exportamos as referências aqui — como são arrays
   mutados via push/splice (nunca reatribuídos), a sincronização é
   automática entre `allTreinamentos` e `window.allTreinamentos`. */
window.allTreinamentos = allTreinamentos;

function _normalizeUid(str){
  return str.toLowerCase()
    .replace(/[áàâãäå]/g,'a').replace(/[éèêë]/g,'e')
    .replace(/[íìîï]/g,'i').replace(/[óòôõö]/g,'o')
    .replace(/[úùûü]/g,'u').replace(/ç/g,'c').replace(/ñ/g,'n')
    .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
}
let tColors={},tBorder={},tBg={},cColors={},cBg={};

function _buildColors(){
  tColors={};tBorder={};tBg={};
  allTrainers.forEach((t,i)=>{const c=PALETTE_T[i%PALETTE_T.length];tColors[t]=c;tBorder[t]=c;const h=c.slice(1);tBg[t]='rgba('+parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16)+',.1)';});
  cColors={};cBg={};
  allConsultors.forEach((c,i)=>{const cor=PALETTE_C[i%PALETTE_C.length];cColors[c]=cor;const h=cor.slice(1);cBg[c]='rgba('+parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16)+',.1)';});
}

/* Cor ÚNICA e determinística por consultor para a faixa do card mobile.
   O hue é espaçado pelo índice do consultor em allConsultors, então dois
   consultores diferentes NUNCA recebem a mesma cor (ao contrário das
   classes CSS fixas cons-*, que colidiam no fallback azul). Aplicada inline
   no banner — sobrepõe a classe. Retorna null quando não há consultor. */
function _gradConsultorMobile(nome){
  if(!nome) return null;
  var lista=(typeof allConsultors!=='undefined'&&allConsultors.length)?allConsultors:[];
  var idx=lista.indexOf?lista.indexOf(nome):-1;
  var tot=lista.length||1;
  if(idx<0){ /* não está na lista atual — deriva hash estável do nome */
    var hsh=0,s=String(nome);
    for(var k=0;k<s.length;k++) hsh=(hsh*31+s.charCodeAt(k))>>>0;
    tot=Math.max(tot,12); idx=hsh%tot;
  }
  var hue=Math.round(idx*360/Math.max(tot,1))%360;
  return {
    grad:'linear-gradient(180deg,hsl('+hue+',58%,26%) 0%,hsl('+hue+',64%,7%) 100%)',
    border:'hsl('+hue+',55%,56%)'
  };
}
window._gradConsultorMobile=_gradConsultorMobile;

/* ═══════════════════════════════════════════
   FORMATAÇÃO
═══════════════════════════════════════════ */
function hexToRgba(hex,a){var h=hex.replace('#','');if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];return'rgba('+parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16)+','+a+')';}

/* ─── fmtMoney — fonte canônica de formatação BRL (Fase 1.C) ───
   Modos:
     'display'         number → 'R$ 1.234,56'   (default, com prefixo)
     'displayNoSymbol' number → '1.234,56'       (sem prefixo)
     'parse'           string → number           ('R$ 1.234,56' → 1234.56)
     'inputMask'       string → '1.234,56' ou '' (para input em tempo real, base centavos)
*/
window.fmtMoney = function(input, mode){
  mode = mode || 'display';
  if(mode === 'display')         return 'R$ ' + Number(input||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(mode === 'displayNoSymbol') return Number(input||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(mode === 'parse'){
    if(!input) return 0;
    return parseFloat(String(input).trim().replace(/R\$\s*/,'').replace(/\./g,'').replace(',','.')) || 0;
  }
  if(mode === 'inputMask'){
    if(!input && input !== 0) return '';
    var raw = String(input).replace(/\D/g,'');
    if(!raw) return '';
    return (parseInt(raw,10)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  return String(input||'');
};

function formatVal(v){return fmtMoney(v, 'display');}
function parseVal(s){return fmtMoney(s, 'parse');}
function formatDate(d){if(!d)return '';const[y,m,dd]=d.split('-');return dd+'/'+m+'/'+y;}

/* ─── Helpers de modal (Fase 1.B — uso opcional, padroniza abrir/fechar) ───
   Padrão atual: classList.add('open') / classList.remove('open') em #xxxOverlay.
   Aceita id (string) ou o próprio elemento. Retorna o elemento ou null. */
window.modalOpen  = function(idOrEl){var el = (typeof idOrEl === 'string') ? document.getElementById(idOrEl) : idOrEl; if(el) el.classList.add('open'); return el || null;};
window.modalClose = function(idOrEl){var el = (typeof idOrEl === 'string') ? document.getElementById(idOrEl) : idOrEl; if(el) el.classList.remove('open'); return el || null;};

/* ═══════════════════════════════════════════
   SISTEMA DE TURMAS
═══════════════════════════════════════════ */
const IF15_DATA=[
  {cliente:'LAILA',consultor:'LARISSA',entrada:0,info:'FILHA DA LEILA - COMPROU O CI COM O RAFAEL SIMÕES',status:'pago',treinador:'RAFAEL SIMÕES',treinamento:'CI',valor:70000},
  {cliente:'GIOVANNI',consultor:'LARISSA',entrada:0,status:'pago',treinador:'-',treinamento:'BHP',valor:5996.46},
  {cliente:'LEILA',consultor:'LARISSA',entrada:0,status:'aberto',treinador:'RAFAEL SIMÕES',treinamento:'CI',valor:70000},
  {cliente:'MARIA BEATRIZ',consultor:'LARISSA',entrada:0,status:'pago',treinador:'JOSIANE BORGES',treinamento:'CI',valor:30000},
  {cliente:'MARIA BEATRIZ',consultor:'LARISSA',entrada:0,info:'COMPROU O CIS PARA A MARIA LUIZA',status:'pago',treinador:'-',treinamento:'CIS-GL',valor:2396.41},
  {cliente:'MARIA LUIZA',consultor:'LARISSA',entrada:0,status:'aberto',treinador:'JOSIANE BORGES',treinamento:'CI',valor:30000},
  {cliente:'RUAN SERGE',consultor:'DARLEY',entrada:0,status:'aberto',treinador:'THIAGO PINHEIRO',treinamento:'CI',valor:30000},
  {cliente:'RUAN SERGE',consultor:'DARLEY',entrada:0,status:'pago',treinador:'-',treinamento:'CEOP',valor:5996.46},
  {cliente:'TATHIANE',consultor:'DANIEL',entrada:0,status:'aberto',treinador:'THIAGO PINHEIRO',treinamento:'CI',valor:30000},
  {cliente:'DENIZE',consultor:'DARLEY',entrada:0,status:'aberto',treinador:'THIAGO PINHEIRO',treinamento:'CI',valor:30000},
  {cliente:'JOAQUIM',consultor:'DARLEY',entrada:5000,info:'FICOU DE PAGAR O CI DIA 01/04/2026',status:'aberto',treinador:'THIAGO PINHEIRO',treinamento:'CI',valor:30000},
  {cliente:'CRISTIANNE BARBOSA',consultor:'DANIEL',entrada:0,info:'COMPROU NO PITCH DO IF15 PARA O MARIDO\nNOME: JODSON CASTRO\nTREINAMENTOS: \nIF, TCE BLACK E DP',status:'pago',treinador:'-',treinamento:'IF',valor:5996.46},
  {cliente:'JOAQUIM',consultor:'DARLEY',entrada:0,status:'pago',treinador:'-',treinamento:'TAV',valor:2997},
  {cliente:'JOAQUIM',consultor:'DARLEY',entrada:0,status:'pago',treinador:'-',treinamento:'MASTER COACHING',valor:6896},
  {cliente:'JOAQUIM',consultor:'DARLEY',entrada:0,status:'pago',treinador:'-',treinamento:'TOUR BLACK BEL',valor:1497},
  {cliente:'FERNANDA',consultor:'DANIEL',entrada:0,status:'aberto',treinador:'JOSIANE BORGES',treinamento:'CI',valor:30000},
];

/* ── Helpers de contagem (Solução D — distinguir clientes únicos de registros) ── */
function _contarClientesUnicos(arr){
  if(!Array.isArray(arr)) return 0;
  var s = new Set();
  for(var i=0;i<arr.length;i++){
    var d = arr[i];
    if(d && d.cliente) s.add(String(d.cliente).toUpperCase().trim());
  }
  return s.size;
}
function _contarTreinosCliente(arr, nomeCliente){
  if(!Array.isArray(arr)||!nomeCliente) return 0;
  var alvo = String(nomeCliente).toUpperCase().trim();
  var n = 0;
  for(var i=0;i<arr.length;i++){
    var d = arr[i];
    if(d && d.cliente && String(d.cliente).toUpperCase().trim()===alvo && d.treinamento && d.treinamento!=='-' && d.treinamento!=='') n++;
  }
  return n;
}
window._contarClientesUnicos = _contarClientesUnicos;
window._contarTreinosCliente = _contarTreinosCliente;

/* ── Helpers de turma — tudo vai para turmas/{id} no Firebase ── */
function _getTurmas(){try{return JSON.parse(localStorage.getItem(TURMAS_KEY))||[];}catch(e){return[];}}
function _getTurmaData(id){try{return JSON.parse(localStorage.getItem('ci_turma_'+id))||null;}catch(e){return null;}}

/* Salva turma inteira (meta + clientes) em turmas/{id} */
function _saveTurmaData(id,state){
  if(window._fbSave){
    window._fbSave(TURMAS_NODE+'/'+id,state).catch(function(e){console.error('[FB] save turma erro:',e);});
  }
}

/* Salva apenas metadados (sem clientes) em turmas/{id}/{campo} */
function _saveTurmaMeta(id,campo,valor){
  if(window._fbSave){
    window._fbSave(TURMAS_NODE+'/'+id+'/'+campo,valor).catch(function(e){console.error('[FB] save meta erro:',e);});
  }
}

function _saveTurmas(l){
  // Legacy — apenas para compatibilidade. Preferir _saveTurmaMeta.
  if(window._fbSave){
    // Atualizar ministrante em cada turma individualmente
    if(Array.isArray(l)){
      l.forEach(function(t){
        if(t&&t.id) window._fbSave(TURMAS_NODE+'/'+t.id+'/ministrante',t.ministrante||null).catch(function(e){ window._errSilent&&window._errSilent('salvar ministrante',e); });
      });
    }
  }
}


// ── Navegação centralizada: oculta todas as telas, mostra apenas a pedida ──
var _TELAS=['loginScreen','turmasScreen','telaTurmasScreen','mapeamentoScreen','dashboard','propostaComercialScreen','turmaInativaScreen','novaPipelineScreen'];
function _mostrarTela(id,useFlex){
  _TELAS.forEach(function(t){
    var el=document.getElementById(t);if(el)el.style.display='none';
  });
  var alvo=document.getElementById(id);
  if(alvo)alvo.style.display=useFlex?'flex':'block';
}

function entrarTurma(id){
  // Memorizar de qual tela veio para poder voltar corretamente
  var _TELAS_NAV=['telaTurmasScreen','turmasScreen','propostaComercialScreen'];
  window._telaOrigem='turmasScreen';
  for(var _ti=0;_ti<_TELAS_NAV.length;_ti++){
    var _el=document.getElementById(_TELAS_NAV[_ti]);
    if(_el&&_el.style.display&&_el.style.display!=='none'){window._telaOrigem=_TELAS_NAV[_ti];break;}
  }
  // Buscar metadados da turma do Firebase (índice)
  function _doEntrar(turmaObj,dadosJaCarregados){
    _turmaAtiva=turmaObj;
    window._turmaAtiva=_turmaAtiva;
    if(!_turmaAtiva){_showToast('❌ Turma não encontrada.','var(--red)');return;}
  _periodText='';_periodStart='';_periodEnd='';
  document.getElementById('periodBarInner').style.display='none';
  document.getElementById('periodBarText').textContent='';
  document.getElementById('infoBar').style.display='none';
  document.getElementById('infoBarText').textContent='';
  META=(_turmaAtiva.meta!=null&&_turmaAtiva.meta!==undefined)?_turmaAtiva.meta:0;
  if(!allTrainers.length&&_turmaAtiva.treinadores&&_turmaAtiva.treinadores.length){allTrainers=_turmaAtiva.treinadores.slice();}
  if(!allConsultors.length&&_turmaAtiva.consultores&&_turmaAtiva.consultores.length){allConsultors=_turmaAtiva.consultores.slice();}
  _buildColors();
  document.getElementById('turmaAtivaLabel').textContent=_turmaAtiva.codigo;
  document.getElementById('turmaMetaLabel').innerHTML='META: <strong style="color:var(--text);">'+formatVal(META)+'</strong>';
  var _metaMob=document.getElementById('turmaMetaLabelMobile'); if(_metaMob) _metaMob.textContent=formatVal(META);
  document.getElementById('metaValLabel').textContent=formatVal(META);
  _mostrarTela('dashboard');
  // P1: botão ← Turmas visível para ADM e para consultor em desktop
  var _sessBtn=_getSessao?_getSessao():null;
  var _perfilBtn=_sessBtn?_sessBtn.perfil:'adm';
  var _bvt=document.getElementById('btnVoltarTurmas');
  var _isConsDesk=(typeof window._eConsultorDesktop==='function')&&window._eConsultorDesktop();
  if(_bvt) _bvt.style.display=(_perfilBtn==='adm'||_isConsDesk)?'':'none';

  function _aplicarDados(td){
    data=td&&td.data&&td.data.length?td.data:[];
    document.getElementById('dashTitle').textContent=(td&&td.titulo)||(_turmaAtiva.nome+' — '+_turmaAtiva.codigo);
    if(td&&td.info){document.getElementById('infoBarText').textContent=td.info;document.getElementById('infoBar').style.display='block';}

    // Período fixo — prioridade: turma > dados
    const ps=_turmaAtiva.periodStart||(td&&td.periodStart)||'';
    const pe=_turmaAtiva.periodEnd||(td&&td.periodEnd)||'';
    const pt=_turmaAtiva.periodText||(td&&td.periodText)||'';
    if(ps&&pe){
      _periodStart=ps;_periodEnd=pe;
      _periodText=pt||formatDate(ps)+'  →  '+formatDate(pe);
      document.getElementById('periodBarText').textContent=_periodText;
      document.getElementById('periodBarInner').style.display='flex';
      const psi=document.getElementById('periodStart');if(psi)psi.value=_periodStart;
      const pei=document.getElementById('periodEnd');if(pei)pei.value=_periodEnd;
    }

    // Controle de acesso por perfil
    var sess=_getSessao?_getSessao():null;
    var perfil=sess?sess.perfil:'adm';
    var isAdm=perfil==='adm';

    // Abas visíveis por perfil — lê permissões salvas do usuário se disponível
    var _userPerms=null;
    if(sess&&sess.uid){
      var _localU=_getUsuariosLocal();
      var _uObj=_localU[sess.uid]||null;
      if(_uObj&&_uObj.permissoes) _userPerms=_getPermsUsuario(perfil,_uObj.permissoes);
    }
    if(!_userPerms) _userPerms=_getPermsUsuario(perfil,null);

    // Modo leitura: apenas para perfis sem edição
    if(_userPerms.editar){document.body.classList.remove('modo-leitura');}
    else{document.body.classList.add('modo-leitura');}

    // Proposta: visível para ADM e consultor
    var _btnProp=document.getElementById('btnProposta');
    if(_btnProp)_btnProp.style.display=(isAdm||perfil==='consultor')?'':'none';

    // Botões de período/membros: só ADM
    var _btnPM=document.getElementById('btnPeriodModal');
    if(_btnPM) _btnPM.style.display=isAdm?'':'none';
    ['btnEditarTreinadores','btnEditarConsultores'].forEach(function(bid){
      var b=document.getElementById(bid);if(b)b.style.display=isAdm?'':'none';
    });

    // Exportar: permissão individual
    var _btnExp=document.getElementById('btnExportar');
    if(_btnExp) _btnExp.style.display=(_userPerms&&_userPerms.exportar)?'':'none';

    // Gerenciar turmas: só ADM
    var _btnGT=document.getElementById('btnGerenciarTurmas');
    if(_btnGT) _btnGT.style.display=isAdm?'':'none';

    // Gerenciar usuários: só ADM
    var _btnGU=document.querySelector('[onclick*="abrirPainelUsuarios"]');
    if(_btnGU) _btnGU.style.display=isAdm?'':'none';

    // Configurações críticas: só ADM
    document.querySelectorAll('.title-edit-btn').forEach(function(b){
      var txt=b.textContent||'';
      var bid=b.id||'';
      if(bid==='btnEditarTreinadores'||bid==='btnEditarConsultores'||bid==='btnExportarUsuarios'||bid==='btnPdfConsultor'||bid==='btnProposta') return;
      var isActionBtn=txt.includes('Salvar')||txt.includes('Sincronizar')||
        txt.includes('Desfazer')||txt.includes('Importar')||
        txt.includes('Usuários')||
        b.getAttribute('onclick')==='openInfoModal()'||
        b.getAttribute('onclick')==='openTitleModal()';
      if(isActionBtn) b.style.display=(_userPerms&&_userPerms.configuracoes)?'':'none';
    });

    var _abaMap={geral:'verGeral',consultor:'verConsultor',treinador:'verTreinador',produto:'verProduto'};
    document.querySelectorAll('.tab').forEach(function(b){
      var tab=b.getAttribute('onclick')?b.getAttribute('onclick').match(/switchTab\('(\w+)'\)/):null;
      if(!tab)return;
      var aba=tab[1];
      var visivel=isAdm||((_abaMap[aba]&&_userPerms[_abaMap[aba]])||false);
      b.style.display=visivel?'':'none';
    });

    // Aba inicial por perfil
    var abaInicial={
      'adm':'geral','ministrante':'treinador','consultor':'consultor','treinador':'treinador'
    }[perfil]||'geral';

    // Limpar ministrante residual se não existir na lista de treinadores
    if(_turmaAtiva&&_turmaAtiva.ministrante&&allTrainers.indexOf(_turmaAtiva.ministrante)===-1){
      var _tls=_getTurmas();
      var _tli=_tls.findIndex(function(t){return t.id===_turmaAtiva.id;});
      if(_tli!==-1){_tls[_tli].ministrante=null;_saveTurmas(_tls);_turmaAtiva=_tls[_tli];}
    }

    /* Normaliza schema híbrido (cliente.treinamento legado → cliente.treinamentos[])
       antes de qualquer render para evitar perda de treinamentos vinculados
       quando o array está vazio mas o scalar legado existe. */
    if(typeof _migrarTreinamentosHibrido==='function') _migrarTreinamentosHibrido(data);
    savedData=JSON.stringify(data);

    // allConsultors e allTrainers já populados pelo entrarTurma (usuarios/ + clientes)
    buildSelects();buildFilterBtns();renderAll();
    switchTab(abaInicial);
    startRealtimeSync();

    /* Notifica o asserter e o smoke-test que os dados foram aplicados. */
    try { document.dispatchEvent(new CustomEvent('data:applied',{detail:{data:data}})); } catch(_){}
  }

  // Usar dados já carregados pelo chamador
  document.getElementById('dashTitle').textContent=_turmaAtiva.nome+' — '+_turmaAtiva.codigo;
  if(dadosJaCarregados&&dadosJaCarregados.data&&dadosJaCarregados.data.length){
    _showToast('✅ '+dadosJaCarregados.data.length+' clientes carregados!','var(--accent)');
    _aplicarDados(dadosJaCarregados);
  } else {
    _showToast('⚠️ Nenhum dado encontrado no Firebase para esta turma.','var(--amber)');
    _aplicarDados(dadosJaCarregados||null);
  }
  } // end _doEntrar

  // Firebase: lê nó unificado turmas/{id} + usuarios/ + lista global de treinamentos
  if(window._fbGet){
    Promise.all([
      window._fbGet(TURMAS_NODE+'/'+id).catch(function(){return null;}),
      window._fbGet('turma_dados/'+id).catch(function(){return null;}),
      window._fbGet('usuarios').catch(function(){return null;}),
      window._fbGet('appConfig/treinamentos').catch(function(){return null;})
    ]).then(function(results){
      var fbTurma=results[0];    // novo nó unificado
      var fbDadosAntigo=results[1]; // fallback estrutura antiga
      var fbUsuarios=results[2]; // nó usuarios/
      var fbTreinGlobais=results[3]; // lista global de treinamentos (appConfig/treinamentos)

      var consultoresDB=[];
      var treinadoresDB=[];

      // ── Construir turmaObj e dadosFinais ──
      var turmaObj=null;
      var dadosFinais=null;

      if(fbTurma&&typeof fbTurma==='object'){
        // ── Novo nó turmas/{id} ──
        var clientes=fbTurma.clientes;
        if(clientes&&!Array.isArray(clientes)&&typeof clientes==='object'){
          clientes=Object.values(clientes).filter(Boolean);
        }
        clientes=clientes||[];
        // FIX: se clientes vazio no novo nó, tentar fallback para estrutura antiga turma_dados/
        // (idêntico ao que _executarPuxar já faz corretamente)
        if(clientes.length===0&&fbDadosAntigo){
          var _d=fbDadosAntigo.data||fbDadosAntigo;
          if(!Array.isArray(_d)&&typeof _d==='object'){
            _d=Object.values(_d).filter(function(v){return v&&v.cliente;});
          }
          if(Array.isArray(_d)&&_d.length>0) clientes=_d;
        }
        turmaObj={
          id:id, nome:fbTurma.nome||fbTurma.titulo||id,
          codigo:fbTurma.codigo||(id.replace(/^turma_/,'').split('_')[0].toUpperCase()),
          meta:fbTurma.meta||0, ministrante:fbTurma.ministrante||null,
          ordem:fbTurma.ordem||0, criadoEm:fbTurma.criadoEm||'',
          periodStart:fbTurma.periodStart||'', periodEnd:fbTurma.periodEnd||'',
          periodText:fbTurma.periodText||'',
          treinadores:Array.isArray(fbTurma.treinadores)?fbTurma.treinadores:(fbTurma.treinadores?Object.values(fbTurma.treinadores):[]),
          consultores:Array.isArray(fbTurma.consultores)?fbTurma.consultores:(fbTurma.consultores?Object.values(fbTurma.consultores):[])
        };
        dadosFinais={
          data:clientes, titulo:fbTurma.titulo||fbTurma.nome||'',
          info:fbTurma.info||'', periodStart:fbTurma.periodStart||'',
          periodEnd:fbTurma.periodEnd||'', periodText:fbTurma.periodText||''
        };
      } else if(fbDadosAntigo){
        // ── Fallback: estrutura antiga turma_dados/{id} ──
        var d=fbDadosAntigo.data||fbDadosAntigo;
        if(!Array.isArray(d)&&typeof d==='object'){
          d=Object.values(d).filter(function(v){return v&&v.cliente;});
        }
        turmaObj={
          id:id, nome:fbDadosAntigo.titulo||id,
          codigo:(id.replace(/^turma_/,'').split('_')[0].toUpperCase()),
          meta:fbDadosAntigo.meta||0, ministrante:fbDadosAntigo.ministrante||null,
          periodStart:fbDadosAntigo.periodStart||'', periodEnd:fbDadosAntigo.periodEnd||'',
          periodText:fbDadosAntigo.periodText||'',
          treinadores:Array.isArray(fbDadosAntigo.treinadores)?fbDadosAntigo.treinadores:(fbDadosAntigo.treinadores?Object.values(fbDadosAntigo.treinadores):[]),
          consultores:Array.isArray(fbDadosAntigo.consultores)?fbDadosAntigo.consultores:(fbDadosAntigo.consultores?Object.values(fbDadosAntigo.consultores):[])
        };
        dadosFinais={
          data:Array.isArray(d)?d:[], titulo:fbDadosAntigo.titulo||'',
          info:fbDadosAntigo.info||'', periodStart:fbDadosAntigo.periodStart||'',
          periodEnd:fbDadosAntigo.periodEnd||'', periodText:fbDadosAntigo.periodText||''
        };
        // Migração automática removida — sistema só lê, nunca escreve sem ação do usuário
      } else {
        turmaObj={id:id,nome:id,codigo:id.toUpperCase(),meta:0,ministrante:null};
        dadosFinais={data:[]};
      }

      // Set de usuários BLOQUEADOS — apenas PAUSADOS (ativo:false) são removidos
      // dos selects. Congelados (congelado:true) continuam aparecendo, pois só
      // bloqueiam LOGIN, permitindo ao adm gerenciar clientes vinculados.
      var _bloqueadosTurmaSet = new Set();
      var _registradosNomesSet = new Set(); // nomes que existem em usuarios/ (cadastrados)
      if(fbUsuarios && typeof fbUsuarios === 'object'){
        Object.values(fbUsuarios).forEach(function(u){
          if(!u || !u.nome) return;
          var nomeUp = String(u.nome).toUpperCase().trim();
          _registradosNomesSet.add(nomeUp);
          if(u.ativo === false){
            _bloqueadosTurmaSet.add(nomeUp);
          }
        });
      }
      window._pausadosNomesSet = _bloqueadosTurmaSet; // compat: nome legado
      window._bloqueadosNomesSet = _bloqueadosTurmaSet;
      window._usuariosRegistradosSet = _registradosNomesSet;
      function _naoBloqueado(nome){
        return !_bloqueadosTurmaSet.has(String(nome||'').toUpperCase().trim());
      }
      function _ehRegistrado(nome){
        return _registradosNomesSet.has(String(nome||'').toUpperCase().trim());
      }

      // FONTE DE VERDADE: consultores/treinadores SALVOS explicitamente na turma
      var _consExplicitos = (turmaObj && Array.isArray(turmaObj.consultores) && turmaObj.consultores.length>0);
      var _treinExplicitos = (turmaObj && Array.isArray(turmaObj.treinadores) && turmaObj.treinadores.length>0);
      if(turmaObj && Array.isArray(turmaObj.consultores)){
        turmaObj.consultores.forEach(function(n){
          if(n && n.trim() && !consultoresDB.includes(n) && _naoBloqueado(n)) consultoresDB.push(n);
        });
      }
      if(turmaObj && Array.isArray(turmaObj.treinadores)){
        turmaObj.treinadores.forEach(function(n){
          if(n && n.trim() && n !== '-' && !treinadoresDB.includes(n) && _naoBloqueado(n)) treinadoresDB.push(n);
        });
      }
      // FALLBACK do data[] APENAS para turmas legadas sem config explícita.
      // Mesmo no fallback, só adiciona se o nome for de um usuário REGISTRADO
      // (existe em usuarios/) — corta o bug de "nomes fantasma" digitados em planilhas.
      if(dadosFinais.data && dadosFinais.data.length){
        dadosFinais.data.forEach(function(c){
          if(!_consExplicitos && c.consultor && c.consultor.trim()
             && !consultoresDB.includes(c.consultor)
             && _naoBloqueado(c.consultor)
             && _ehRegistrado(c.consultor)) consultoresDB.push(c.consultor);
          if(!_treinExplicitos && c.treinador && c.treinador.trim() && c.treinador !== '-'
             && !treinadoresDB.includes(c.treinador)
             && _naoBloqueado(c.treinador)
             && _ehRegistrado(c.treinador)) treinadoresDB.push(c.treinador);
        });
      }
      consultoresDB.sort(function(a,b){return a.localeCompare(b,'pt-BR');});
      treinadoresDB.sort(function(a,b){return a.localeCompare(b,'pt-BR');});
      allConsultors=consultoresDB;
      allTrainers=treinadoresDB;

      /* allTreinamentos = UNION (unique, case-insensitive) de 3 fontes:
         1) appConfig/treinamentos (GLOBAL — fonte de verdade nova)
         2) turmas/{id}/treinamentos OU turma_dados (LEGADO — turmas antigas)
         3) APP_CONST.TREINAMENTOS (DEFAULT hardcoded)
         Garante que treinamentos criados em qualquer turma apareçam em todas.
         IMPORTANTE: Firebase às vezes retorna arrays como objetos
         ({0:"X",1:"Y"}) — _toArr() normaliza nas duas formas. */
      function _toArr(v){
        if(Array.isArray(v)) return v;
        if(v && typeof v==='object') return Object.values(v);
        return [];
      }
      var _treinGlobais = _toArr(fbTreinGlobais);
      var _treinTurma   = fbTurma ? _toArr(fbTurma.treinamentos)
                        : fbDadosAntigo ? _toArr(fbDadosAntigo.treinamentos)
                        : [];
      var _treinDefault = _toArr(APP_CONST.TREINAMENTOS);
      var _seen = {};
      var _merge = [];
      [_treinGlobais, _treinTurma, _treinDefault].forEach(function(arr){
        arr.forEach(function(t){
          if(!t) return;
          var up = String(t).trim().toUpperCase();
          if(!up || _seen[up]) return;
          _seen[up] = true;
          _merge.push(String(t).trim());
        });
      });
      allTreinamentos.length = 0;
      _merge.forEach(function(t){ allTreinamentos.push(t); });
      /* Diagnóstico: facilita rastrear se a lista global está chegando */
      console.log('[Treinamentos] globais='+_treinGlobais.length
        +' · turma='+_treinTurma.length
        +' · default='+_treinDefault.length
        +' → final='+allTreinamentos.length, allTreinamentos);

      /* MIGRAÇÃO AUTOMÁTICA: turmas antigas têm treinamentos salvos
         localmente em turmas/{id}/treinamentos que NUNCA foram coletados
         para appConfig/treinamentos. Se a lista global está incompleta
         (menos itens que a soma de todas as turmas), varremos todas as
         turmas, coletamos o que falta e gravamos no nó global.
         Roda só 1x por sessão (cache em window._treinMigDone).
         DESABILITADA em 2026-05-29 (Etapa 5): cumpriu seu papel de
         consolidar turmas antigas; agora causava re-injeção de itens
         removidos (TOURs, CIS-GL etc). appConfig/treinamentos virou
         a fonte única após a Etapa 4. Pra reativar: remover "false &&". */
      if(false && !window._treinMigDone && typeof window._fbGet==='function'){
        window._treinMigDone = true;
        window._fbGet(TURMAS_NODE).then(function(todasTurmas){
          if(!todasTurmas || typeof todasTurmas !== 'object') return;
          var coletados = {};
          allTreinamentos.forEach(function(t){
            coletados[String(t).trim().toUpperCase()] = String(t).trim();
          });
          var antes = Object.keys(coletados).length;
          Object.values(todasTurmas).forEach(function(t){
            if(!t) return;
            var lt = _toArr(t.treinamentos);
            lt.forEach(function(item){
              if(!item) return;
              var up = String(item).trim().toUpperCase();
              if(!up || coletados[up]) return;
              coletados[up] = String(item).trim();
            });
          });
          var depois = Object.keys(coletados).length;
          if(depois > antes){
            var listaFinal = Object.values(coletados);
            /* Atualiza global em runtime */
            allTreinamentos.length = 0;
            listaFinal.forEach(function(t){ allTreinamentos.push(t); });
            if(typeof buildSelects==='function') buildSelects();
            /* Persiste no nó global pra outras turmas/sessões */
            if(typeof window._fbSave==='function'){
              window._fbSave('appConfig/treinamentos', listaFinal)
                .then(function(){
                  console.log('[Treinamentos] migração: +'+(depois-antes)+' itens coletados das turmas antigas, salvos no global. Total='+depois);
                })
                .catch(function(e){ console.warn('[Treinamentos] migração save:', e); });
            }
          } else {
            console.log('[Treinamentos] migração: nenhum item novo nas turmas antigas.');
          }
        }).catch(function(e){ console.warn('[Treinamentos] migração:', e); });
      }

      _doEntrar(turmaObj,dadosFinais);
    }).catch(function(e){
      _showToast('❌ Erro ao carregar turma: '+(e&&e.message?e.message:e),'var(--red)');
    });
  } else {
    _doEntrar({id:id,nome:id,codigo:id.toUpperCase(),meta:0,ministrante:null},null);
  }
}

// Navegação de "voltar" sempre respeita o perfil
// ADM/ministrante → turmasScreen | outros → logout
function _voltarParaHome(){
  var _s=_getSessao?_getSessao():null;
  var _p=_s?_s.perfil:'adm';
  if(_p==='adm'||_p==='ministrante'){
    var _destino=window._telaOrigem||'turmasScreen';
    _mostrarTela(_destino);
    renderTurmasGrid();
  } else {
    logout();
  }
}

function voltarTurmas(){
  if(_turmaAtiva&&(window._fbUpdate||window._fbSave)){
    var patch=_buildPatch();
    var op=window._fbUpdate
      ? window._fbUpdate(TURMAS_NODE+'/'+_turmaAtiva.id, patch)
      : window._fbSave(TURMAS_NODE+'/'+_turmaAtiva.id, patch);
    op.catch(function(e){ window._err && window._err('voltarTurmas: salvar dados', e); });
  }
  _resetDirty();
  _turmaAtiva=null;
  _voltarParaHome();
}

function excluirTurma(id,nome){
  if(!confirm('Excluir "'+nome+'" do Firebase?\nEsta ação é permanente e afeta todos os usuários.'))return;
  _showToast('🗑️ Excluindo turma...','var(--muted)');
  if(!window._fbSave){_showToast('❌ Firebase não disponível.','var(--red)');return;}
  // Apagar nó unificado + legados
  Promise.all([
    window._fbSave(TURMAS_NODE+'/'+id, null),
    window._fbSave('turma_dados/'+id, null)
  ]).then(function(){
    if(typeof window._audit==='function') window._audit('turma.delete',{type:'turma',id:id},{nome:nome});
    _showToast('✅ Turma "'+nome+'" excluída!','var(--accent)');
    fecharGerenciarTurmas();
    renderTurmasGrid();
  }).catch(function(e){
    _showToast('❌ Erro: '+(e&&e.message?e.message:e),'var(--red)');
  });
}

let _ntTreinadores=[],_ntConsultores=[];

/* Popula o select de Mês na Pipeline com 6 meses passados + atual + 6 futuros */
function _ntPopularMesMeta(valorAtual){
  var sel=document.getElementById('ntMesMeta');
  if(!sel) return;
  var hoje=new Date();
  var opts=['<option value="">— Automático (mesmo mês do início) —</option>'];
  for(var d=-6;d<=6;d++){
    var dt=new Date(hoje.getFullYear(),hoje.getMonth()+d,1);
    var yr=dt.getFullYear();
    var mo=String(dt.getMonth()+1).padStart(2,'0');
    var key=yr+'-'+mo;
    var M=['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
           'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    var lbl=M[dt.getMonth()]+' / '+yr;
    opts.push('<option value="'+key+'"'+(key===valorAtual?' selected':'')+'>'+lbl+'</option>');
  }
  sel.innerHTML=opts.join('');
}

/* Sincroniza o select quando o usuário escolhe a data de início */
function _ntSincronizarMesMeta(){
  var ps=document.getElementById('ntPeriodStart').value;
  var sel=document.getElementById('ntMesMeta');
  if(!sel) return;
  /* Só auto-seleciona se o select ainda está em "Automático" */
  if(!sel.value && ps) {
    var mk=ps.slice(0,7);
    if(sel.querySelector('option[value="'+mk+'"]'))
      sel.value=mk;
  }
}

function abrirNovaTurma(){
  _ntTreinadores=[];_ntConsultores=[];
  ['ntNome','ntCodigo','ntMeta','ntTreinadorInput','ntConsultorInput'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ntPeriodStart').value='';
  document.getElementById('ntPeriodEnd').value='';
  _ntPopularMesMeta('');
  _renderTags();
  _ntCarregarUsuariosFirebase();
  document.getElementById('novaTurmaOverlay').classList.add('open');
  setTimeout(function(){document.getElementById('ntNome').focus();},100);
}

function _ntCarregarUsuariosFirebase(){
  var elT=document.getElementById('ntTreinadorChips');
  var elC=document.getElementById('ntConsultorChips');
  if(!elT||!elC) return;
  elT.innerHTML='<span style="font-size:11px;color:var(--muted);">Carregando...</span>';
  elC.innerHTML='<span style="font-size:11px;color:var(--muted);">Carregando...</span>';
  if(!window._fbGet){elT.innerHTML='';elC.innerHTML='';return;}
  window._fbGet('usuarios').then(function(usuarios){
    var treinadores=[],consultores=[];
    if(usuarios&&typeof usuarios==='object'){
      Object.values(usuarios).forEach(function(u){
        if(!u||!u.nome||u.ativo===false) return;
        var p=u.perfil||'';
        if(p==='treinador'||p==='ministrante') treinadores.push(u.nome.toUpperCase());
        if(p==='consultor') consultores.push(u.nome.toUpperCase());
      });
    }
    treinadores.sort(); consultores.sort();
    window._ntTreinadoresDB=treinadores;
    window._ntConsultoresDB=consultores;
    _renderChips();
  }).catch(function(){
    if(elT) elT.innerHTML='<span style="font-size:11px;color:var(--muted);">Erro ao carregar.</span>';
    if(elC) elC.innerHTML='<span style="font-size:11px;color:var(--muted);">Erro ao carregar.</span>';
  });
}
function _renderChips(){
  var elT=document.getElementById('ntTreinadorChips');
  var elC=document.getElementById('ntConsultorChips');
  var dbT=window._ntTreinadoresDB||[];
  var dbC=window._ntConsultoresDB||[];
  if(elT){
    if(!dbT.length){elT.innerHTML='<span style="font-size:11px;color:var(--muted);">Nenhum treinador no BD.</span>';}
    else{elT.innerHTML=dbT.map(function(n){
      var sel=_ntTreinadores.includes(n);
      return '<button class="fbtn'+(sel?' active':'')+'" onclick="_ntToggleChip(\'treinador\',\''+n+'\')" type="button">'+n+'</button>';
    }).join('');}
  }
  if(elC){
    if(!dbC.length){elC.innerHTML='<span style="font-size:11px;color:var(--muted);">Nenhum consultor no BD.</span>';}
    else{elC.innerHTML=dbC.map(function(n){
      var sel=_ntConsultores.includes(n);
      return '<button class="fbtn'+(sel?' active':'')+'" onclick="_ntToggleChip(\'consultor\',\''+n+'\')" type="button">'+n+'</button>';
    }).join('');}
  }
}
function _ntToggleChip(tipo,nome){
  var arr=tipo==='treinador'?_ntTreinadores:_ntConsultores;
  var idx=arr.indexOf(nome);
  if(idx===-1) arr.push(nome);
  else arr.splice(idx,1);
  _renderTags();
  _renderChips();
}
function fecharNovaTurma(){document.getElementById('novaTurmaOverlay').classList.remove('open');}
function addTag(tipo){
  const inp=document.getElementById('nt'+(tipo==='treinador'?'Treinador':'Consultor')+'Input');
  const val=inp.value.trim().toUpperCase();if(!val)return;
  if(tipo==='treinador'&&!_ntTreinadores.includes(val))_ntTreinadores.push(val);
  if(tipo==='consultor'&&!_ntConsultores.includes(val))_ntConsultores.push(val);
  inp.value='';_renderTags();
}
function removeTag(tipo,val){
  if(tipo==='treinador')_ntTreinadores=_ntTreinadores.filter(t=>t!==val);
  else _ntConsultores=_ntConsultores.filter(c=>c!==val);
  _renderTags();
}
function _renderTags(){
  document.getElementById('ntTreinadorList').innerHTML=_ntTreinadores.map(t=>`<span class="tag-item">${t}<button class="tag-remove" onclick="removeTag('treinador','${t}')">✕</button></span>`).join('');
  document.getElementById('ntConsultorList').innerHTML=_ntConsultores.map(c=>`<span class="tag-item">${c}<button class="tag-remove" onclick="removeTag('consultor','${c}')">✕</button></span>`).join('');
  _renderChips();
}
function salvarNovaTurma(){
  const nome=document.getElementById('ntNome').value.trim();
  const codigo=document.getElementById('ntCodigo').value.trim().toUpperCase();
  const meta=parseFloat(document.getElementById('ntMeta').value)||0;
  const periodStart=document.getElementById('ntPeriodStart').value;
  const periodEnd=document.getElementById('ntPeriodEnd').value;
  if(!nome){alert('Informe o nome.');return;}
  if(!codigo){alert('Informe o código.');return;}
  // meta é opcional — 0 é valor válido
  if(!periodStart){alert('Informe a data de início do período.');return;}
  if(!periodEnd){alert('Informe a data de fim do período.');return;}
  if(periodEnd<periodStart){alert('A data de fim deve ser após a data de início.');return;}
  // Treinadores são opcionais — apenas consultores são obrigatórios
  if(!_ntConsultores.length){alert('Adicione ao menos um consultor.');return;}
  const periodText=formatDate(periodStart)+'  →  '+formatDate(periodEnd);
  var id='turma_'+codigo.toLowerCase()+'_'+Date.now();
  var ordemAtual=0; // será ajustado na lista
  /* mesMeta: explícito se selecionado, senão fallback para mês de início */
  var mesMeta=(document.getElementById('ntMesMeta')||{value:''}).value||periodStart.slice(0,7);
  var novaTurmaObj={
    id:id, nome:nome, codigo:codigo, meta:meta,
    titulo:nome+' — '+codigo, info:'',
    periodStart:periodStart, periodEnd:periodEnd, periodText:periodText,
    mesMeta:mesMeta,
    criadoEm:new Date().toLocaleDateString('pt-BR'),
    ministrante:null, ordem:Date.now(),
    treinadores:_ntTreinadores.slice(),
    consultores:_ntConsultores.slice(),
    clientes:[]
  };
  if(window._fbSave){
    window._fbSave(TURMAS_NODE+'/'+id, novaTurmaObj).then(function(){
      if(typeof window._audit==='function') window._audit('turma.create',{type:'turma',id:id},{nome:nome,codigo:codigo});
      fecharNovaTurma();renderTurmasGrid();
      _showToast('✅ Turma "'+nome+'" criada!','var(--accent)');
    }).catch(function(e){
      _showToast('❌ Erro ao criar turma: '+(e&&e.message?e.message:e),'var(--red)');
    });
  } else {
    _showToast('❌ Firebase não disponível.','var(--red)');
  }
  if(typeof _addPendLog==='function')_addPendLog('Nova turma criada',nome+' ('+codigo+')','🏫');
}

/* ═══════════════════════════════════════════
   MIGRAÇÃO DEFENSIVA — modelo híbrido d.treinamento (scalar)
   ↔ d.treinamentos[] (array). Garante que TODO d carregado tenha
   AMBOS preenchidos e coerentes. Idempotente (rodar 2x = igual).
═══════════════════════════════════════════ */
function _migrarTreinamentosHibrido(arr){
  if(!Array.isArray(arr)) return arr;
  /* Coleta correções para persistir no Firebase (auto-healing).
     Adicionado em 2026-05-29: evita que órfãos (sub.valor=0 mas scalar>0)
     fiquem só corrigidos em memória — sem persistir, o bug volta toda sessão
     e quebra filtros/somatórias agregadas por status (negociação, etc). */
  var _correcoesValor = [];   /* [{idx, valor}] */
  var _correcoesEntrada = []; /* [{idx, entrada}] */
  arr.forEach(function(d, idx){
    if(!d) return;
    var temArray  = Array.isArray(d.treinamentos) && d.treinamentos.length>0;
    var temScalar = d.treinamento && String(d.treinamento).trim()!=='' && String(d.treinamento)!=='—';
    if(!temArray && temScalar){
      // CASO A: legado puro → cria array com 1 sub a partir dos campos do nível-row
      d.treinamentos = [{
        cod:            String(d.treinamento),
        valor:          Number(d.valor||0)||0,
        entrada:        Number(d.entrada||0)||0,
        status:         d.status || 'aberto',
        formaPagamento: d.formaPagamento || '',
        parcelas:       (d.parcelas&&d.parcelas>0) ? d.parcelas : 1
      }];
    } else if(temArray){
      // CASO B: tem array → garante que scalar reflete o primeiro sub
      // (não força quando o scalar atual já bate com algum sub — preserva preferência)
      var codsArr = d.treinamentos.map(function(t){return String(t&&t.cod||'').toUpperCase();});
      var scalarUp = String(d.treinamento||'').toUpperCase();
      if(!scalarUp || codsArr.indexOf(scalarUp)===-1){
        d.treinamento = d.treinamentos[0].cod || d.treinamento || '';
      }
      // Coerência de ENTRADA: se d.entrada > 0 mas nenhum sub tem entrada,
      // deposita no primeiro sub (evita perda no achatamento e dupla contagem).
      var rowEnt = Number(d.entrada||0)||0;
      if(rowEnt > 0){
        var algumSubTemEntrada = d.treinamentos.some(function(t){return t && Number(t.entrada||0)>0;});
        if(!algumSubTemEntrada){
          d.treinamentos[0] = d.treinamentos[0] || {};
          d.treinamentos[0].entrada = rowEnt;
          _correcoesEntrada.push({idx: idx, entrada: rowEnt});
        }
      }
      // Coerência de VALOR: se algum sub não tem valor mas d.valor>0 e há só 1 sub,
      // deposita d.valor nesse sub.
      if(d.treinamentos.length===1){
        var s0 = d.treinamentos[0] || {};
        var subVal = Number(s0.valor||0)||0;
        var rowVal = Number(d.valor||0)||0;
        if(subVal===0 && rowVal>0){
          s0.valor = rowVal; d.treinamentos[0] = s0;
          _correcoesValor.push({idx: idx, valor: rowVal, cliente: d.cliente});
        }
      }
    }
    // CASO C (sem array nem scalar): deixa como está — cliente sem treinamento é válido

    // ── REGRA DE NEGÓCIO: sobrescreve d.status com o status EFETIVO ──
    // Garante que TODOS os consumidores que leem d.status (rankings, cards de
    // treinador/consultor, lista de turmas, PDFs, supremo, etc.) fiquem coerentes
    // com o Faturado/Aberto/Negociação. A regra está em _statusEfetivoCliente:
    //   • 1 sub: status do sub, ou 'negociacao' se tem entrada
    //   • 2+ subs: todos pagos = 'pago'; algum aberto = 'aberto'
    if(typeof _statusEfetivoCliente === 'function'){
      var statusEfetivo = _statusEfetivoCliente(d);
      if(statusEfetivo) d.status = statusEfetivo;
    }
  });

  /* AUTO-HEAL: persiste as correções no Firebase de forma idempotente.
     Evita órfãos crônicos (sub.valor=0 com scalar>0) que faziam o KPI
     Negociação NÃO somar o cliente. Roda 1x por sessão por turma. */
  if((_correcoesValor.length || _correcoesEntrada.length)
     && typeof window._fbSave === 'function'
     && window._turmaAtiva && window._turmaAtiva.id){
    var _tid = window._turmaAtiva.id;
    _correcoesValor.forEach(function(c){
      window._fbSave('turmas/'+_tid+'/clientes/'+c.idx+'/treinamentos/0/valor', c.valor)
        .then(function(){ console.log('[Auto-heal] '+c.cliente+' · sub.valor → R$ '+c.valor.toLocaleString('pt-BR')); })
        .catch(function(e){ console.warn('[Auto-heal] falha:', e); });
    });
    _correcoesEntrada.forEach(function(c){
      window._fbSave('turmas/'+_tid+'/clientes/'+c.idx+'/treinamentos/0/entrada', c.entrada)
        .catch(function(e){ console.warn('[Auto-heal entrada] falha:', e); });
    });
  }
  return arr;
}
window._migrarTreinamentosHibrido = _migrarTreinamentosHibrido;

/* Escreve no scalar legado E sincroniza com d.treinamentos[].
   Uso: lugares que alteram só o "treinamento principal" do cliente
   (edição rápida, importação sync, etc.) sem perder coerência. */
function _setTreinamentoScalar(d, novoCod){
  if(!d) return;
  var cod = String(novoCod||'').trim();
  d.treinamento = cod;
  if(!Array.isArray(d.treinamentos) || d.treinamentos.length===0){
    // sem array — cria com 1 sub a partir dos campos do nível-row
    if(cod){
      d.treinamentos = [{
        cod:            cod,
        valor:          Number(d.valor||0)||0,
        entrada:        Number(d.entrada||0)||0,
        status:         d.status || 'aberto',
        formaPagamento: d.formaPagamento || '',
        parcelas:       (d.parcelas&&d.parcelas>0) ? d.parcelas : 1
      }];
    } else {
      d.treinamentos = [];
    }
    return;
  }
  // tem array — atualiza o PRIMEIRO sub para refletir o novo cod
  // (não mexe nos demais — preserva múltiplas compras do cliente)
  d.treinamentos[0] = d.treinamentos[0] || {};
  d.treinamentos[0].cod = cod;
}
window._setTreinamentoScalar = _setTreinamentoScalar;

/* Achata data[] em uma lista flat de "compras" (1 item por sub-treinamento).
   Cliente com treinamentos=[A,B,C] vira 3 itens; cliente legado com
   só d.treinamento='X' vira 1 item. Cada item preserva _ri (índice
   original em data[]) e _ai (índice no sub-array) para edição. */
function _achatarItens(arr){
  arr = (arr && arr.length) ? arr : (typeof data!=='undefined' ? data : []);
  /* CRÍTICO: _ri DEVE ser o índice no `data` GLOBAL (não no arr filtrado),
     porque os callbacks dos cards (ex: _abrirMenuCliente, openConfirm, etc.)
     usam esse índice para `data[ri]`. Se passamos f (filtrado), o forEach
     ri seria índice em f — apontaria pro cliente errado.
     Solução: mapa por referência → índice real em data[]. */
  var _idxRealMap = null;
  if(arr !== data && typeof data !== 'undefined' && Array.isArray(data)){
    _idxRealMap = new Map();
    data.forEach(function(d, i){ _idxRealMap.set(d, i); });
  }
  var out = [];
  (arr||[]).forEach(function(d, ri){
    if(!d || !d.cliente) return;
    var realRi = _idxRealMap ? (_idxRealMap.has(d) ? _idxRealMap.get(d) : ri) : ri;
    var base = {
      _ri:       realRi,
      cliente:   d.cliente,
      consultor: d.consultor || '—',
      treinador: d.treinador || '—',
      info:      d.info || ''
    };
    if(Array.isArray(d.treinamentos) && d.treinamentos.length>0){
      d.treinamentos.forEach(function(sub, ai){
        if(!sub) return;
        /* Entrada vem da função canônica _entradaParaSub:
           - sub pago retorna 0
           - sub não-pago elegível recebe entradas reatribuídas dos pagos
           - fallback legado para d.entrada quando nenhum sub tem entrada */
        var _entFlat = _entradaParaSub(d, ai);
        out.push(Object.assign({}, base, {
          _ai:             ai,
          treinamento:     String(sub.cod || d.treinamento || '—'),
          valor:           Number(sub.valor!=null?sub.valor:0)||0,
          entrada:         _entFlat,
          status:          sub.status || d.status || 'aberto',
          formaPagamento:  sub.formaPagamento || d.formaPagamento || '',
          parcelas:        (sub.parcelas&&sub.parcelas>0) ? sub.parcelas
                          : ((d.parcelas&&d.parcelas>0) ? d.parcelas : 1)
        }));
      });
    } else {
      out.push(Object.assign({}, base, {
        _ai:             -1,
        treinamento:     String(d.treinamento || '—'),
        valor:           Number(d.valor||0)||0,
        entrada:         Number(d.entrada||0)||0,
        status:          d.status || 'aberto',
        formaPagamento:  d.formaPagamento || '',
        parcelas:        (d.parcelas&&d.parcelas>0) ? d.parcelas : 1
      }));
    }
  });
  return out;
}
window._achatarItens = _achatarItens;

/* Retorna true se o cliente d possui o produto `produto` em qualquer lugar:
   - scalar legado d.treinamento
   - array d.treinamentos[].cod
   Aceita produto=null|'null' como "qualquer produto". */
function _clientePossuiProduto(d, produto){
  if(!d) return false;
  if(produto===null || produto==='null' || produto==='') return true;
  var alvo = String(produto);
  if(String(d.treinamento||'—') === alvo) return true;
  if(Array.isArray(d.treinamentos) && d.treinamentos.some(function(t){ return t && String(t.cod||'')===alvo; })) return true;
  return false;
}
window._clientePossuiProduto = _clientePossuiProduto;

/* Verifica se o cliente d possui um sub-compra do produto com o status pedido.
   Considera status NO SUB primeiro (sub.status); se não tem, herda d.status.
   Usado por filtros que cruzam (produto × status) — ex: "pagos do produto IF". */
function _clientePossuiProdutoComStatus(d, produto, statusAlvo){
  if(!d || !d.cliente) return false;
  var alvoStatus = String(statusAlvo||'').toLowerCase();
  var alvoProd   = produto;
  function _statusEfetivo(sub){
    var s = (sub && sub.status) || d.status || 'aberto';
    return String(s||'').toLowerCase();
  }
  if(Array.isArray(d.treinamentos) && d.treinamentos.length>0){
    return d.treinamentos.some(function(t){
      if(!t) return false;
      if(alvoProd!==null && alvoProd!=='null' && alvoProd!==''){
        if(String(t.cod||'') !== String(alvoProd)) return false;
      }
      if(alvoStatus && _statusEfetivo(t) !== alvoStatus) return false;
      return true;
    });
  }
  // Cliente legado puro (sem array)
  if(alvoProd!==null && alvoProd!=='null' && alvoProd!==''){
    if(String(d.treinamento||'—') !== String(alvoProd)) return false;
  }
  if(alvoStatus && String(d.status||'').toLowerCase() !== alvoStatus) return false;
  return true;
}
window._clientePossuiProdutoComStatus = _clientePossuiProdutoComStatus;

/* Status EFETIVO do cliente — regra de negócio:
   • 0 ou 1 sub:
     - sub.status==='pago' → 'pago'
     - sub.entrada > 0     → 'negociacao'
     - senão               → sub.status (fallback d.status)
   • 2+ subs:
     - todos pagos          → 'pago'
     - algum em aberto      → 'aberto'
     - senão                → primeiro status não-pago encontrado
   Usado em KPIs (Faturado/Aberto/Negociação) e no Card Produto.
   Não altera d.status nos dados — é cálculo on-the-fly. */
function _statusEfetivoCliente(d){
  if(!d) return 'aberto';
  function _ss(t){ return (t && t.status) || d.status || 'aberto'; }
  var subs = Array.isArray(d.treinamentos) && d.treinamentos.length ? d.treinamentos : null;
  if(!subs){
    return d.status || 'aberto';
  }
  if(subs.length >= 2){
    if(subs.every(function(t){return _ss(t)==='pago';})) return 'pago';
    if(subs.some(function(t){return _ss(t)==='aberto';})) return 'aberto';
    if(subs.some(function(t){return _ss(t)==='negociacao';})) return 'negociacao';
    return _ss(subs[0]);
  }
  // 1 sub
  var st = _ss(subs[0]);
  if(st === 'pago') return 'pago';
  var temEntrada = Number((subs[0] && subs[0].entrada) || 0) > 0 || Number(d.entrada || 0) > 0;
  if(temEntrada) return 'negociacao';
  return st;
}
window._statusEfetivoCliente = _statusEfetivoCliente;

/* Soma do valor dos sub-treinamentos do cliente que estão no `statusAlvo`.
   Para clientes sem array (legados), cai no scalar `c.status`+`c.valor`.
   Regra granular do "dinheiro real por status" — usada por KPIs Faturado,
   Aberto, Negociação no dashboard, tela Turmas e Mapeamento.
   Garantia: cliente com 1 sub pago + 1 sub em negociação contribui em
   AMBOS os totais (com o valor de cada sub respectivo). */
function _valorPorStatus(d, statusAlvo){
  if(!d) return 0;
  if(Array.isArray(d.treinamentos) && d.treinamentos.length){
    return d.treinamentos.reduce(function(a, sub){
      if(!sub) return a;
      var st = sub.status || d.status || 'aberto';
      return st === statusAlvo ? a + (Number(sub.valor)||0) : a;
    }, 0);
  }
  return d.status === statusAlvo ? (Number(d.valor)||0) : 0;
}
window._valorPorStatus = _valorPorStatus;

/* Atalhos */
function _faturadoDoCliente(d){    return _valorPorStatus(d, 'pago');       }
function _abertoDoCliente(d){      return _valorPorStatus(d, 'aberto');     }
function _negociacaoDoCliente(d){  return _valorPorStatus(d, 'negociacao'); }
window._faturadoDoCliente   = _faturadoDoCliente;
window._abertoDoCliente     = _abertoDoCliente;
window._negociacaoDoCliente = _negociacaoDoCliente;

/* Entrada PENDENTE: soma entradas reatribuídas dos subs ainda NÃO pagos.
   Entradas originalmente em subs pagos migram automaticamente para o
   primeiro sub não-pago via _entradaParaSub. Garante que o total
   pendente do cliente reflita o dinheiro REAL ainda em negociação. */
function _entradaPendenteDoCliente(d){
  if(!d) return 0;
  if(Array.isArray(d.treinamentos) && d.treinamentos.length){
    return d.treinamentos.reduce(function(a, _sub, ai){
      return a + _entradaParaSub(d, ai);
    }, 0);
  }
  return d.status === 'pago' ? 0 : (Number(d.entrada)||0);
}
window._entradaPendenteDoCliente = _entradaPendenteDoCliente;

/* Entrada efetiva DO SUB (após reatribuição automática):
   - Subs pagos → 0 (entrada virou histórico, não mostra)
   - Sub NÃO pago + é o "elegível" (primeiro não-pago) → soma:
       · sua própria entrada (sub.entrada)
       · + entradas dos subs PAGOS do mesmo cliente (entrada "migra" do pago para o não-pago)
       · + d.entrada scalar SE nenhum sub tem entrada (fallback legado)
   - Outros subs não-pagos → só sua própria entrada
   Garante coerência: total de entradas pendentes do cliente = soma do que aparece
   nos cards/KPIs/modais sem dependência de qual sub originalmente recebeu o sinal. */
function _entradaParaSub(d, ai){
  if(!d || !Array.isArray(d.treinamentos) || !d.treinamentos[ai]) return 0;
  var sub = d.treinamentos[ai];
  var stSub = sub.status || d.status || 'aberto';
  if(stSub === 'pago'){
    /* Sub pago normalmente retorna 0 (entrada foi consumida na venda e reatribuída
       a outro sub não-pago). MAS se for o ÚNICO sub do cliente, não há pra onde
       reatribuir — retorna a entrada própria (caso JOABE: 1 sub CI pago com R$ 20k
       de entrada PIX deve ser visível no modal). */
    if(d.treinamentos.length === 1){
      var entSub = Number(sub.entrada||0)||0;
      return entSub || Number(d.entrada||0)||0;
    }
    return 0;
  }
  var minha = Number(sub.entrada||0)||0;
  var idxElegivel = _idxSubElegivelEntrada(d);
  if(ai === idxElegivel){
    /* Acumula entradas de TODOS os subs pagos (reatribuição) */
    var entradasPagos = d.treinamentos.reduce(function(acc, s){
      if(!s) return acc;
      var st = s.status || d.status || 'aberto';
      return st === 'pago' ? acc + (Number(s.entrada)||0) : acc;
    }, 0);
    minha += entradasPagos;
    /* Fallback: se NENHUM sub tinha entrada, herda d.entrada (scalar legado) */
    var _algumSubTemEntrada = d.treinamentos.some(function(t){ return t && Number(t.entrada||0) > 0; });
    if(!_algumSubTemEntrada && minha === 0){
      minha = Number(d.entrada||0)||0;
    }
  }
  return minha;
}
window._entradaParaSub = _entradaParaSub;

/* Retorna o índice do PRIMEIRO sub elegível a receber o fallback de d.entrada.
   Heurística: primeiro sub NÃO PAGO (faz sentido — entrada é dinheiro ainda devido).
   Se todos os subs estão pagos, retorna 0 (caso raro com d.entrada > 0). */
function _idxSubElegivelEntrada(d){
  if(!d || !Array.isArray(d.treinamentos) || !d.treinamentos.length) return -1;
  for(var i=0; i<d.treinamentos.length; i++){
    var t = d.treinamentos[i];
    if(!t) continue;
    var st = (t.status || d.status || 'aberto');
    if(st !== 'pago') return i;
  }
  return 0;
}
window._idxSubElegivelEntrada = _idxSubElegivelEntrada;

/* ═══════════════════════════════════════════
   PERSISTÊNCIA
═══════════════════════════════════════════ */
/* Worker real do save — escreve no Firebase + envia broadcast.
   Não chamado direto: passa pelo RTBuffer p/ coalescer edições rápidas. */
function _saveStorageNow(){
  if(_turmaAtiva&&(window._fbUpdate||window._fbSave)){
    var patch=_buildPatch();
    if(window.RTBus) window.RTBus.emit('save:start', { patch: patch });
    var op=window._fbUpdate
      ? window._fbUpdate(TURMAS_NODE+'/'+_turmaAtiva.id, patch)
      : window._fbSave(TURMAS_NODE+'/'+_turmaAtiva.id, patch);
    op.then(function(){
      if(window.RTBus) window.RTBus.emit('save:ok', { patch: patch });
    }).catch(function(e){
      console.error('[FB] saveStorage erro:',e);
      if(window.RTBus) window.RTBus.emit('save:fail', { patch: patch, err: e });
    });
  }
  try{window._bc.postMessage({data,_turmaId:_turmaAtiva?_turmaAtiva.id:null});}catch(e){}
}

/* saveStorage agora coalesce chamadas via RTBuffer (F2):
   - múltiplas edições em <300ms viram 1 só write ao Firebase
   - reduz tráfego de rede + render no eco
   Fallback p/ comportamento antigo se RTBuffer não carregou. */
function saveStorage(){
  if(window.RTBuffer){
    var key = 'saveStorage:' + (_turmaAtiva ? _turmaAtiva.id : 'none');
    window.RTBuffer.schedule(key, _saveStorageNow, 300);
  } else {
    _saveStorageNow();
  }
}

/* Força save imediato (ex: ao trocar turma, beforeunload).
   Cancela pendentes do RTBuffer e roda já. */
function saveStorageNow(){
  if(window.RTBuffer && _turmaAtiva){
    window.RTBuffer.cancel('saveStorage:' + _turmaAtiva.id);
  }
  _saveStorageNow();
}
window.saveStorageNow = saveStorageNow;
function applyState(s){
  if(!s)return;
  if(s.data&&s.data.length){ data=s.data; _migrarTreinamentosHibrido(data); }
  if(s.titulo){const el=document.getElementById('dashTitle');if(el)el.textContent=s.titulo;}
  if(s.info&&document.getElementById('infoBarText')){document.getElementById('infoBarText').textContent=s.info;document.getElementById('infoBar').style.display='block';}
  if(s.periodText){
    _periodText=s.periodText;_periodStart=s.periodStart||'';_periodEnd=s.periodEnd||'';
    const el=document.getElementById('periodBarText');if(el)el.textContent=s.periodText;
    const bar=document.getElementById('periodBarInner');if(bar)bar.style.display='flex';
    const ps=document.getElementById('periodStart');if(ps)ps.value=_periodStart;
    const pe=document.getElementById('periodEnd');if(pe)pe.value=_periodEnd;
  }
}
function startRealtimeSync(){
  try{window._bc=new BroadcastChannel(STORAGE_KEY);window._bc.onmessage=function(e){if(document.getElementById('dashboard').style.display==='none')return;applyState(e.data);renderAll();const a=document.querySelector('.tab.active');if(a){const t=a.textContent.toLowerCase();if(t==='consultor')renderConsultor();if(t==='treinador')renderTreinador();}};}catch(e){}
  window.addEventListener('storage',function(e){
    if(e.key!==STORAGE_KEY) return;
    if(document.getElementById('dashboard').style.display==='none') return;
    try{
      var newState=JSON.parse(e.newValue);
      /* Se outra aba está numa turma diferente, ignorar para evitar dados cruzados */
      var turmaAtivaId=(typeof _turmaAtiva!=='undefined' && _turmaAtiva && _turmaAtiva.id) ? _turmaAtiva.id : null;
      if(newState && newState.turmaId && turmaAtivaId && newState.turmaId !== turmaAtivaId) return;
      applyState(newState);
      renderAll();
    }catch(er){}
  });
}


function getCol(pct){
  if(pct>=100)return{bar:'#c8f05a',grad:'#c8f05a',text:'#c8f05a',cls:'c100',badge:'Meta atingida!'};
  if(pct>=75) return{bar:'#00f0ff',grad:'#00f0ff',text:'#00f0ff',cls:'c75', badge:'Quase lá!'};
  if(pct>=50) return{bar:'#ffe000',grad:'#ffe000',text:'#ffe000',cls:'c50', badge:'Em progresso'};
  if(pct>=25) return{bar:'#ff5500',grad:'#ff5500',text:'#ff5500',cls:'c25', badge:'Atenção'};
  return       {bar:'#ff1744',grad:'#ff1744',text:'#ff1744',cls:'c0',  badge:'Crítico'};
}
function sortBy(col){
  if(sortCol===col)sortDir*=-1;else{sortCol=col;sortDir=1;}
  ['cliente','treinador','treinamento','consultor','valor','status','entrada'].forEach(c=>{const th=document.getElementById('th-'+c);if(th)th.className='sortable'+(sortCol===c?(sortDir===1?' sort-asc':' sort-desc'):'');});
  renderAll();
}
function buildSelects(){
  ['mTreinamento','aTreinamento'].forEach(id=>{const s=document.getElementById(id);if(!s)return;s.innerHTML='<option value="-">—</option>';allTreinamentos.forEach(t=>s.innerHTML+=`<option value="${t}">${t}</option>`);});
  ['mTreinador','aTreinador'].forEach(id=>{const s=document.getElementById(id);if(!s)return;s.innerHTML='<option value="-">—</option>';allTrainers.forEach(t=>s.innerHTML+=`<option value="${t}">${t}</option>`);});
  ['mConsultor','aConsultor'].forEach(id=>{const s=document.getElementById(id);if(!s)return;s.innerHTML='';allConsultors.forEach(c=>s.innerHTML+=`<option value="${c}">${c}</option>`);});
}
function buildFilterBtns(){
  const tb=document.getElementById('trainerFBtns');if(tb){tb.innerHTML='';allTrainers.forEach(t=>{const b=document.createElement('button');b.className='fbtn';b.textContent=t.split(' ')[0];b.id='ft_'+t;b.onclick=()=>toggleTrainer(t);tb.appendChild(b);});}
  const cb=document.getElementById('consultorFBtns');if(cb){cb.innerHTML='';allConsultors.forEach(c=>{const b=document.createElement('button');b.className='fbtn';b.textContent=c;b.id='fc_'+c;b.onclick=()=>toggleConsultor(c);cb.appendChild(b);});}
  // Sincronizar selects mobile — refletem APENAS o estado global atual
  const tSel=document.getElementById('filtroTreinadorSel');
  if(tSel){
    tSel.innerHTML='<option value="">Treinador ▾</option>'+allTrainers.map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join('');
    tSel.value=activeTrainer||'';
    tSel.classList.toggle('ativo',!!activeTrainer);
  }
  const cSel=document.getElementById('filtroConsultorSel');
  if(cSel){
    cSel.innerHTML='<option value="">Consultor ▾</option>'+allConsultors.map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('');
    cSel.value=activeConsultor||'';
    cSel.classList.toggle('ativo',!!activeConsultor);
  }
  const pSel=document.getElementById('filtroPresencaSel');
  if(pSel && typeof window._getFiltroPresenca==='function'){
    pSel.value=window._getFiltroPresenca()||'';
    pSel.classList.toggle('ativo',!!pSel.value);
  }
}
function toggleTrainer(t){activeTrainer=activeTrainer===t?null:t;renderAll();}
function toggleConsultor(c){activeConsultor=activeConsultor===c?null:c;renderAll();}
window._filtroMobTrainer=function(v){activeTrainer=v||null;renderAll();};
window._filtroMobConsultor=function(v){activeConsultor=v||null;renderAll();};
window._filtroMobPresenca=function(v){
  /* _setFiltroPresenca faz toggle (mesmo valor zera). Para set direto, garantimos que o
     valor atual seja diferente antes de chamar. */
  if(typeof window._setFiltroPresenca!=='function') return;
  var atual=typeof window._getFiltroPresenca==='function'?window._getFiltroPresenca():null;
  if(!v){
    /* user escolheu "Presença ▾" — limpar */
    if(atual) window._setFiltroPresenca(atual); /* toggle off */
    return;
  }
  if(atual===v) return; /* já está */
  if(atual) window._setFiltroPresenca(atual); /* limpa primeiro */
  window._setFiltroPresenca(v);
};
function setStatus(s){activeStatus=s;renderAll();}
function setStatusDropdown(v){activeStatus=v||null;renderAll();}
function clearAll(){
  activeTrainer=null;activeConsultor=null;activeStatus=null;activeCliente=null;
  // Limpa os 5 multi-selects (status, treinador, consultor, presença, treinamento)
  if(window.activeStatusSet)       window.activeStatusSet.clear();
  if(window.activeTrainerSet)      window.activeTrainerSet.clear();
  if(window.activeConsultorSet)    window.activeConsultorSet.clear();
  if(window.activePresencaSet)     window.activePresencaSet.clear();
  if(window.activeTreinamentoSet)  window.activeTreinamentoSet.clear();
  // Re-renderiza popovers para refletir estado vazio
  if(typeof window._msFiltRebuildAll === 'function') window._msFiltRebuildAll();
  var _pop=document.getElementById('statusFilterPop');
  if(_pop){
    _pop.querySelectorAll('input[type=checkbox]').forEach(function(c){ c.checked=false; });
  }
  var _lbl=document.getElementById('statusFilterLabel');
  if(_lbl) _lbl.textContent='TODOS';
  var _allChk=document.getElementById('msStatus_all');
  if(_allChk){ _allChk.checked=false; _allChk.indeterminate=false; }
  // Legacy <select> caso ainda exista em algum lugar
  var _sf=document.getElementById('statusFilter');if(_sf)_sf.value='';
  /* Limpar filtro de presença (estado global no módulo 17-presenca) */
  if(typeof window._getFiltroPresenca==='function' && typeof window._setFiltroPresenca==='function'){
    var _pAtual=window._getFiltroPresenca();
    if(_pAtual) window._setFiltroPresenca(_pAtual); /* toggle off */
  }
  /* Resetar visualmente os selects mobile */
  ['filtroTreinadorSel','filtroConsultorSel','filtroPresencaSel'].forEach(function(id){
    var el=document.getElementById(id);
    if(el){el.value='';el.classList.remove('ativo');}
  });
  /* Limpa também o campo de busca (× desktop e "Limpar" mobile) */
  var _si=document.getElementById('searchInput');
  if(_si) _si.value='';
  renderAll();
}
function toggleCliente(nome){
  if(activeCliente===nome){
    activeCliente=null;activeTrainer=null;activeConsultor=null;
  } else {
    activeCliente=nome;
    const linha=data.find(function(d){return d.cliente===nome&&d.entrada>0;});
    activeTrainer=(linha&&linha.treinador&&linha.treinador.trim())?linha.treinador:null;
    activeConsultor=linha?linha.consultor:null;
  }
  renderAll();
}
function setConsultorStatus(s){
  activeConsultorStatus=s;
  ['fcAll','fcAberto','fcPago','fcEntrada','fcNegociacao'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.remove('active');});
  const aid=s===null?'fcAll':s==='aberto'?'fcAberto':s==='pago'?'fcPago':s==='negociacao'?'fcNegociacao':'fcEntrada';
  const el=document.getElementById(aid);if(el)el.classList.add('active');
  if(document.getElementById('consultorDetail').style.display!=='none'&&window._consultorAtivo)_renderConsultorDetail(window._consultorAtivo);
  else renderConsultor();
}
function setTreinadorStatus(s){
  activeTreinadorStatus=s;
  ['ftAll','ftAberto','ftPago','ftEntrada','ftNegociacao'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.remove('active');});
  const aid=s===null?'ftAll':s==='aberto'?'ftAberto':s==='pago'?'ftPago':s==='negociacao'?'ftNegociacao':'ftEntrada';
  const el=document.getElementById(aid);if(el)el.classList.add('active');
  if(document.getElementById('treinadorDetail').style.display!=='none'&&window._treinadorAtivo)_renderTreinadorDetail(window._treinadorAtivo);
  else renderTreinador();
}
function filtered(){
  const q=(document.getElementById('searchInput')?.value||'').toLowerCase().trim();
  // Multi-selects (card Clientes aba Geral): se Set tem items, usa Set;
  // senão cai no legacy single (activeTrainer/activeConsultor/activeStatus).
  const _statusSet       = (window.activeStatusSet       && window.activeStatusSet.size       > 0) ? window.activeStatusSet       : null;
  const _trainerSet      = (window.activeTrainerSet      && window.activeTrainerSet.size      > 0) ? window.activeTrainerSet      : null;
  const _consultorSet    = (window.activeConsultorSet    && window.activeConsultorSet.size    > 0) ? window.activeConsultorSet    : null;
  const _presencaSet     = (window.activePresencaSet     && window.activePresencaSet.size     > 0) ? window.activePresencaSet     : null;
  const _treinamentoSet  = (window.activeTreinamentoSet  && window.activeTreinamentoSet.size  > 0) ? window.activeTreinamentoSet  : null;

  /* Status: cliente passa se PELO MENOS UM treinamento dele (scalar ou
     array de subs) tem o status selecionado. Sem isso, cliente com
     [IF pago + CEOP aberto] (scalar='aberto') sumia do filtro "pago",
     mesmo tendo um treinamento pago. */
  const _matchStatus = function(d){
    if(_statusSet){
      /* "entrada" continua olhando o campo entrada (scalar) — soma agregada */
      if(_statusSet.has('entrada') && d.entrada > 0) return true;
      /* Scalar primário */
      if(_statusSet.has(d.status)) return true;
      /* Subs (array) — se algum tem status no Set, passa */
      if(Array.isArray(d.treinamentos)){
        for(var i=0; i<d.treinamentos.length; i++){
          var sub = d.treinamentos[i];
          if(sub && sub.status && _statusSet.has(sub.status)) return true;
          if(_statusSet.has('entrada') && sub && +(sub.entrada||0) > 0) return true;
        }
      }
      return false;
    }
    if(!activeStatus) return true;
    if(activeStatus==='entrada') return d.entrada>0;
    if(d.status === activeStatus) return true;
    /* Single legacy: também varre subs */
    if(Array.isArray(d.treinamentos)){
      for(var j=0; j<d.treinamentos.length; j++){
        var s = d.treinamentos[j];
        if(s && s.status === activeStatus) return true;
      }
    }
    return false;
  };
  const _matchTrainer = function(d){
    if(_trainerSet) return _trainerSet.has(d.treinador);
    if(!activeTrainer) return true;
    return d.treinador === activeTrainer;
  };
  const _matchConsultor = function(d){
    if(_consultorSet) return _consultorSet.has(d.consultor);
    if(!activeConsultor) return true;
    return d.consultor === activeConsultor;
  };
  const _matchPresenca = function(d){
    // Se o módulo 17-presenca define filtro single (_getFiltroPresenca), respeita;
    // se há Set, prevalece.
    if(_presencaSet){
      var p = d.presenca || 'pendente';
      return _presencaSet.has(p);
    }
    if(typeof window._getFiltroPresenca === 'function'){
      var single = window._getFiltroPresenca();
      if(single){
        var p2 = d.presenca || 'pendente';
        return single === p2;
      }
    }
    return true;
  };
  /* Treinamento: cliente passa se PELO MENOS UM treinamento dele (scalar ou
     array) está nos selecionados. Comparação case-insensitive + trim para
     tolerar clientes legados com case/whitespace diferente (ex: "if",
     "TCE BLACK" vs "TCE - BLACK"). */
  const _normTrein = function(s){ return String(s||'').toUpperCase().trim().replace(/\s+/g,' '); };
  const _treinamentoSetNorm = _treinamentoSet
    ? new Set(Array.from(_treinamentoSet).map(_normTrein))
    : null;
  const _matchTreinamento = function(d){
    if(!_treinamentoSetNorm) return true;
    // Opção "—": clientes sem treinamento atribuído (scalar vazio/'-'/'—')
    if(_treinamentoSetNorm.has('—')){
      var scalarRaw = String(d.treinamento||'').trim();
      if(!scalarRaw || scalarRaw === '-' || scalarRaw === '—') return true;
    }
    if(d.treinamento && _treinamentoSetNorm.has(_normTrein(d.treinamento))) return true;
    if(Array.isArray(d.treinamentos)){
      for(var i=0; i<d.treinamentos.length; i++){
        var t = d.treinamentos[i];
        if(t && t.cod && _treinamentoSetNorm.has(_normTrein(t.cod))) return true;
      }
    }
    return false;
  };

  let f=data.filter(d=>d&&d.cliente).filter(d=>
    _matchTrainer(d)&&
    _matchConsultor(d)&&
    _matchTreinamento(d)&&
    (!activeCliente||(d.cliente===activeCliente&&d.entrada>0))&&
    _matchStatus(d)&&
    _matchPresenca(d)&&
    (!q||d.cliente.toLowerCase().includes(q)||(d.treinador||'').toLowerCase().includes(q)||(d.consultor||'').toLowerCase().includes(q)||(d.treinamento||'').toLowerCase().includes(q))
  );
  if(sortCol){f=[...f].sort((a,b)=>{const av=a[sortCol],bv=b[sortCol];if(typeof av==='number')return(av-bv)*sortDir;return String(av).localeCompare(String(bv),'pt-BR')*sortDir;});}
  return f;
}

/* ═══════════════════════════════════════════
   DEDUPLICAÇÃO DE CLIENTES
   Mescla registros com mesmo cliente+consultor
   gerados pelo modelo antigo (1 registro por treinamento)
═══════════════════════════════════════════ */
function _dedupClientesInterno(silencioso){
  // Agrupar por chave cliente+consultor
  var grupos={};
  data.forEach(function(d,i){
    var chave=(d.cliente||'').toUpperCase()+'|'+(d.consultor||'');
    if(!grupos[chave]) grupos[chave]=[];
    grupos[chave].push({d:d,i:i});
  });

  var indicesToRemover=[];
  var houveMesclagem=false;

  Object.keys(grupos).forEach(function(chave){
    var grupo=grupos[chave];
    if(grupo.length<=1) return; // sem duplicata

    // Ordenar: preferir o registro com treinamentos[] mais completo
    grupo.sort(function(a,b){
      var la=(a.d.treinamentos&&a.d.treinamentos.length)||0;
      var lb=(b.d.treinamentos&&b.d.treinamentos.length)||0;
      if(lb!==la) return lb-la; // mais treinamentos primeiro
      return (b.d.valor||0)-(a.d.valor||0); // maior valor primeiro
    });

    var principal=grupo[0].d;

    // Coletar todos os treinamentos únicos de todos os registros do grupo
    var treinsMesclados=[];
    var codsVistos={};
    grupo.forEach(function(g){
      var treins=g.d.treinamentos&&g.d.treinamentos.length
        ? g.d.treinamentos
        : [{cod:g.d.treinamento||'-', valor:g.d.valor||0}];
      treins.forEach(function(t){
        if(t.cod&&t.cod!=='-'&&!codsVistos[t.cod]){
          codsVistos[t.cod]=true;
          treinsMesclados.push({cod:t.cod,valor:t.valor||0});
        }
      });
    });

    // Status: pago > negociacao > aberto > desistiu > estorno > -
    var _prioridade={pago:5,negociacao:4,aberto:3,desistiu:2,estorno:1,'-':0};
    var melhorStatus=grupo.reduce(function(best,g){
      var p=_prioridade[g.d.status]||0;
      return p>(_prioridade[best]||0)?g.d.status:best;
    }, principal.status||'aberto');

    // Aplicar ao registro principal
    principal.treinamentos=treinsMesclados;
    principal.treinamento=treinsMesclados.length?treinsMesclados[0].cod:'-';
    principal.valor=treinsMesclados.reduce(function(a,t){return a+(t.valor||0);},0);
    principal.status=melhorStatus;

    // Marcar índices dos duplicados (todos exceto o principal) para remoção
    for(var k=1;k<grupo.length;k++) indicesToRemover.push(grupo[k].i);
    houveMesclagem=true;
  });

  if(!houveMesclagem) return 0;

  // Remover duplicados (ordem decrescente para não deslocar índices)
  indicesToRemover.sort(function(a,b){return b-a;});
  indicesToRemover.forEach(function(i){ data.splice(i,1); });

  if(!silencioso){
    if(typeof markUnsaved==='function') markUnsaved();
    if(typeof saveStorage==='function') saveStorage();
    if(typeof renderAll==='function') renderAll();
    if(typeof renderConsultor==='function') renderConsultor();
    if(typeof _showToast==='function') _showToast('✅ '+indicesToRemover.length+' registro(s) duplicado(s) removido(s) e mesclados.','var(--accent)');
  }

  return indicesToRemover.length;
}
window._deduplicarClientes=function(){ _dedupClientesInterno(false); };

/* ── Accordion dos cards de cliente em mobile ── */
window._toggleClienteMobile=function(ri){
  var card=document.getElementById('mobcard_'+ri);
  if(!card) return;
  var open=card.classList.contains('open');
  document.querySelectorAll('.mob-card.open').forEach(function(c){ c.classList.remove('open'); });
  if(!open) card.classList.add('open');
};
window._mobToggleTreinador=function(ri){
  var card=document.getElementById('mobcard_'+ri);
  if(!card) return;
  var trein=card.querySelector('[data-campo="treinamento"]');
  var field=card.querySelector('.mob-field-treinador');
  if(trein && field){ field.style.display = trein.value==='CI' ? 'flex' : 'none'; }
};

/* ═══════════════════════════════════════════
   RENDER ALL
═══════════════════════════════════════════ */
function renderAll(){
  const f=filtered();
  // Controle de acesso — ocultar botões de ação para não-ADM
  var _sess=_getSessao?_getSessao():null;
  var _isAdm=!_sess||_sess.perfil==='adm';
  var _perfil=_sess?_sess.perfil:'adm';
  var _vinculo=_sess?(_sess.vinculo||'').toUpperCase():'';
  // Base de dados filtrada por vínculo para consultor
  var _base=(_perfil==='consultor'&&_vinculo)
    ? data.filter(function(d){return d&&d.cliente&&(d.consultor||'').toUpperCase()===_vinculo;})
    : data.filter(function(d){return d&&d.cliente;});
  var _btnNC=document.getElementById('btnNovoCliente');
  if(_btnNC)_btnNC.style.display=_isAdm?'':'none';
  // ⟳ Sincronizar FRZ (63-turma-frz-sync.js): escreve na turma, então só ADM
  var _btnFrz=document.getElementById('turmaBtnFrzSync');
  if(_btnFrz)_btnFrz.style.display=_isAdm?'':'none';
  var _frzUlt=document.getElementById('turmaFrzUltima');
  if(_frzUlt)_frzUlt.style.display=_isAdm?'':'none';
  if(typeof window._turmaFrzMostrarUltima==='function') window._turmaFrzMostrarUltima();
  // Título "Clientes" clicável: só ADM + desktop ≥ 769px
  var _ptCli=document.getElementById('panelTitleClientes');
  if(_ptCli){
    var _ehAdmDesk=_isAdm && window.innerWidth>=769;
    _ptCli.classList.toggle('pt-clickable',_ehAdmDesk);
    if(_ehAdmDesk) _ptCli.title='Abrir lista completa de clientes'; else _ptCli.removeAttribute('title');
  }
  // Atualizar botões filtro
  allTrainers.forEach(t=>{const b=document.getElementById('ft_'+t);if(b)b.className='fbtn'+(activeTrainer===t?' active':'');});
  allConsultors.forEach(c=>{const b=document.getElementById('fc_'+c);if(b)b.className='fbtn'+(activeConsultor===c?' active':'');});
  // Sincronizar dropdown de status
  var _sf=document.getElementById('statusFilter');
  if(_sf)_sf.value=activeStatus||'';

  // REGRA GRANULAR — soma APENAS os SUBS com cada status (não cliente inteiro).
  // Cliente com [IF pago R$1.850 + MENT.IA negociação R$8.997] contribui:
  //   1.850 em Faturado + 8.997 em Negociação (não 10.847 em só um deles).
  // Unifica com filtros do card Clientes, tela Turmas e Mapeamento.
  const totalPago       = _base.reduce((a,d)=>a+_faturadoDoCliente(d),0);
  const totalAberto     = _base.reduce((a,d)=>a+_abertoDoCliente(d),0);
  const totalNegociacao = _base.reduce((a,d)=>a+_negociacaoDoCliente(d),0);
  const clientesNegociacao = _base.filter(d=>_negociacaoDoCliente(d)>0);
  // Entrada PENDENTE — exclui entradas de subs já pagos (histórico)
  const clientesEntrada=_base.filter(d=>_entradaPendenteDoCliente(d)>0);
  const totalEntradas=_base.reduce((a,d)=>a+_entradaPendenteDoCliente(d),0);
  const pctGeral=Math.round((totalPago/META)*100);
  const colGeral=getCol(pctGeral);
  const ultrapassado=Math.max(totalPago-META,0);
  const faltam=Math.max(META-totalPago,0);
  const barW=Math.min(Math.round((totalPago/(META*1.5))*100),100);
  const needlePct=Math.round((META/(META*1.5))*100);

  document.getElementById('mTotal').textContent=formatVal(totalNegociacao);
  // Solução D: subtítulos dos KPIs usam DISTINCT (clientes únicos) só em desktop
  var _ehDeskKPI = window.innerWidth>=769;
  // Contagens com status EFETIVO (mesma regra dos totais acima — evita divergência).
  // Clientes em cada categoria = têm pelo menos 1 sub naquele status (valor > 0).
  // Mantém coerência com os totais granulares acima.
  var _abertos = _base.filter(d=>_abertoDoCliente(d)>0);
  var _pagos   = _base.filter(d=>_faturadoDoCliente(d)>0);
  var _qNeg    = _ehDeskKPI ? _contarClientesUnicos(clientesNegociacao) : clientesNegociacao.length;
  var _qAb     = _ehDeskKPI ? _contarClientesUnicos(_abertos)            : _abertos.length;
  var _qPg     = _ehDeskKPI ? _contarClientesUnicos(_pagos)              : _pagos.length;
  var _qEnt    = _ehDeskKPI ? _contarClientesUnicos(clientesEntrada)     : clientesEntrada.length;
  document.getElementById('mTotalSub').textContent=_qNeg+' em negociação';
  document.getElementById('mAberto').textContent=formatVal(totalAberto);
  document.getElementById('mAbertoSub').textContent=_qAb+' cliente'+(_qAb!==1?'s':'');
  document.getElementById('mPago').textContent=formatVal(totalPago);
  document.getElementById('mPagoSub').textContent=_qPg+' pago(s)';
  document.getElementById('mEntradas').textContent=formatVal(totalEntradas);
  document.getElementById('mEntradasSub').textContent=_qEnt===0?'Nenhuma entrada':_qEnt+' com entrada';
  document.getElementById('mFaltam').textContent=faltam>0?formatVal(faltam):'META ATINGIDA! 🏆';
  document.getElementById('mFaltam').style.color=faltam>0?'var(--red)':'#c8f05a';
  document.getElementById('mPctSub').innerHTML=pctGeral+'% ATINGIDO'+(ultrapassado>0?' · <span style="color:#c8f05a;font-weight:600;">+'+formatVal(ultrapassado)+' ACIMA</span>':'');
  document.getElementById('geralPct').textContent=pctGeral+'%';document.getElementById('geralPct').style.color=colGeral.text;
  const fill=document.getElementById('geralFill');
  fill.style.width=barW+'%';fill.className='meta-fill '+(pctGeral>=100?'neon-green':pctGeral>=50?'neon-amber':'neon-red');
  document.getElementById('geralNeedle').style.left=needlePct+'%';
  const fc=document.getElementById('fireCanvas');
  if(fc){if(pctGeral>=100){fc.style.display='block';startFireCanvas(needlePct,barW);}else{fc.style.display='none';stopFireCanvas();}}
  document.getElementById('geralFat').textContent='FATURADO: '+formatVal(totalPago);
  const gf=document.getElementById('geralFalta');
  if(faltam>0){gf.textContent='FALTAM: '+formatVal(faltam);gf.style.color='var(--red)';}
  else{gf.textContent='META ATINGIDA! 🏆';gf.style.color='#c8f05a';}

  // Cards treinadores
  const _ministranteGeral=_getTurmaMinistante();
  document.getElementById('trainerMetaRows').innerHTML=allTrainers.map(t=>{
    const tP=data.filter(d=>d&&d.cliente&&d.treinador===t&&d.status==='pago').reduce((a,d)=>a+d.valor,0);
    const tT=data.filter(d=>d&&d.cliente&&d.treinador===t).reduce((a,d)=>a+d.valor,0);
    const tA=data.filter(d=>d&&d.cliente&&d.treinador===t&&d.status==='aberto').reduce((a,d)=>a+d.valor,0);
    const tC=data.filter(d=>d&&d.cliente&&d.treinador===t).length;
    const pct=Math.round((tP/META)*100),bw=Math.min(Math.round((tP/(META*1.5))*100),100);
    const col=getCol(pct),fat=Math.max(META-tP,0),border=tBorder[t]||'#888';
    const isMiniG=_ministranteGeral===t;
    return `<div class="tc" style="border-left-color:${border};">
      <div class="tc-header"><div><div class="tc-name">${t.toUpperCase()}</div><div class="tc-clients">${tC} cliente${tC!==1?'s':''}</div></div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">${isMiniG?`<span class="tc-badge" style="background:rgba(96,165,250,.15);color:#60a5fa;border:1px solid rgba(96,165,250,.3);">Ministrante</span>`:''}<span class="tc-badge ${col.cls}">${col.badge}</span></div></div>
      <div class="tc-pct" style="color:${col.text};">${pct}%</div>
      <div class="tc-track"><div class="tc-fill" style="width:${bw}%;background:${col.bar};box-shadow:0 0 15px 10px ${hexToRgba(col.bar,.35)},0 0 10px 10px ${hexToRgba(col.bar,.45)};"></div></div>
      <div class="tc-stats">
        <div class="tc-stat"><span class="tc-stat-label">Faturado</span><span class="tc-stat-val" style="color:var(--pago);">${formatVal(tP)}</span></div>
        <div class="tc-stat"><span class="tc-stat-label">Potencial</span><span class="tc-stat-val">${formatVal(tT)}</span></div>
        <div class="tc-stat"><span class="tc-stat-label">Em aberto</span><span class="tc-stat-val" style="color:var(--amber);">${formatVal(tA)}</span></div>
        <div class="tc-stat"><span class="tc-stat-label">Da meta</span><span class="tc-stat-val">${pct}%</span></div>
      </div>
      <div class="tc-faltam"><span class="tc-faltam-label">Faltam para meta</span><span style="color:${fat>0?'var(--red)':'#c8f05a'};">${fat>0?formatVal(fat):'Atingida!'}</span></div>
    </div>`;
  }).join('');

  // ── Tabela de clientes: visualização + edição inline ──
  // Card é somente visualização/edição — sem checkbox, sem coluna Ação
  // Toda seleção/exclusão ocorre no modal Gerenciar Clientes

  document.getElementById('clientTable').innerHTML=f.length===0
    ?'<tr class="empty-row"><td colspan="7" style="text-align:center;">Nenhum cliente para os filtros selecionados.</td></tr>'
    :f.map(d=>{
      const ri=data.indexOf(d), pago=d.status==='pago', hasInfo=!!(d.info&&d.info.trim());
      const statusCls='cs-status-'+(d.status||'aberto');

      // Fix 5: formatar valor/entrada como BRL para exibição no input
      // ENTRADA — total visível (soma dos subs ou fallback p/ scalar):
      // garante que entrada cadastrada via modal (em sub.entrada) apareça
      // na grade do card, mesmo quando d.entrada (scalar) ficou em 0.
      const entradaTotalVisivel = (function(){
        if(Array.isArray(d.treinamentos) && d.treinamentos.length){
          var sumSubs = d.treinamentos.reduce(function(a, s){ return a + (Number(s && s.entrada)||0); }, 0);
          if(sumSubs > 0) return sumSubs;
        }
        return Number(d.entrada || 0);
      })();
      const valEdit = d.valor  ? d.valor.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})  : '';
      const entEdit = entradaTotalVisivel ? entradaTotalVisivel.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '';

      // Fix 7: treinamento — opção vazia obrigatória, NUNCA pré-selecionar
      const treinOpts='<option value="">—</option>'
        +allTreinamentos.map(t=>`<option value="${t}"${(d.treinamento||'')=== t?' selected':''}>${t}</option>`).join('');

      // Treinador com selected
      const trainOpts=`<option value="-"${(d.treinador||'-')==='-'?' selected':''}>—</option>`
        +allTrainers.map(t=>`<option value="${t}"${d.treinador===t?' selected':''}>${t.toUpperCase()}</option>`).join('');

      // Consultor com selected
      const consOpts=`<option value=""${!d.consultor?' selected':''}>—</option>`
        +allConsultors.map(c=>`<option value="${c}"${d.consultor===c?' selected':''}>${c.toUpperCase()}</option>`).join('');

      // Status com selected
      const statOpts=[
        {v:'aberto',l:'ABERTO'},{v:'pago',l:'PAGO'},{v:'negociacao',l:'NEGOCIAÇÃO'},
        {v:'entrada',l:'ENTRADA'},{v:'desistiu',l:'DESISTIU'},{v:'estorno',l:'ESTORNO'},{v:'-',l:'—'}
      ].map(s=>`<option value="${s.v}"${(d.status||'aberto')===s.v?' selected':''}>${s.l}</option>`).join('');

      // Fix 6: todas as colunas centralizadas; nome do cliente alinhado à esquerda
      // Cor de ticket: Low (0-5k)=azul, Middle (5k-10k)=âmbar, High (10k+)=verde
      const ticketCor = d.valor >= 10000.01 ? 'var(--green)'
                      : d.valor >= 5001     ? 'var(--amber)'
                      : d.valor > 0         ? 'var(--blue)'
                      : 'var(--muted)';

      return `<tr data-ri="${ri}" style="border-left:${pago?'2px solid var(--pago)':'2px solid transparent'};">
        <td style="text-align:left;font-weight:600;text-transform:uppercase;white-space:nowrap;${pago?'color:var(--pago);':''}">
          <span style="display:inline-flex;align-items:center;gap:6px;">${d.cliente}<span data-presenca-ri="${ri}">${window._presencaBadgeHtml?window._presencaBadgeHtml(ri):''}</span><button onclick="event.stopPropagation();window._abrirMenuCliente(event,'${d.cliente.replace(/'/g,"\\'")}',${ri})" title="Adicionar / Editar / Ver informações" style="background:rgba(200,240,90,.12);border:1px solid rgba(200,240,90,.3);border-radius:50%;width:20px;height:20px;cursor:pointer;color:var(--accent);font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0;line-height:1;flex-shrink:0;">+</button></span>
        </td>
        <td style="text-align:center;white-space:nowrap;padding:3px 5px;">
          <select class="card-sel cs-treinador" data-ri="${ri}" data-campo="treinador" onchange="cardCellChange(this)">${trainOpts}</select>
        </td>
        <td style="text-align:center;white-space:nowrap;padding:3px 5px;">
          <select class="card-sel" data-ri="${ri}" data-campo="treinamento" onchange="cardCellChange(this)">${treinOpts}</select>
        </td>
        <td style="text-align:center;white-space:nowrap;padding:3px 5px;">
          <select class="card-sel cs-consultor" data-ri="${ri}" data-campo="consultor" onchange="cardCellChange(this)">${consOpts}</select>
        </td>
        <td style="text-align:center;white-space:nowrap;padding:3px 6px;min-width:100px;vertical-align:middle;">
          <input type="text" inputmode="numeric" class="card-num-input card-num-valor" data-ri="${ri}" data-campo="valor"
            value="${valEdit}" oninput="cardMoneyMask(this)" onchange="cardNumChange(this)" placeholder="0,00"
            style="color:${pago?'var(--pago)':d.valor<=5000?'var(--blue)':d.valor<=10000?'var(--amber)':'var(--green)'};font-weight:${pago?'700':'600'};">
        </td>
        <td style="text-align:center;white-space:nowrap;padding:3px 5px;vertical-align:middle;">
          <select class="card-sel ${statusCls}" data-ri="${ri}" data-campo="status" onchange="cardCellChange(this);cardUpdateStatusClass(this)">${statOpts}</select>
        </td>
        <td style="text-align:center;white-space:nowrap;padding:3px 6px;min-width:90px;vertical-align:middle;">
          <input type="text" inputmode="numeric" class="card-num-input card-num-entrada" data-ri="${ri}" data-campo="entrada"
            value="${entEdit}" oninput="cardMoneyMask(this)" onchange="cardNumChange(this)" placeholder="—"
            style="color:var(--blue);font-weight:500;">
        </td>
      </tr>`;
    }).join('');

  // ── Pré-cálculo: filtra os SUB-treinamentos pelo status/treinamento ativo ──
  // Usado tanto pelo total visível quanto pelo agregado mobile.
  const _stSetActive    = (window.activeStatusSet      && window.activeStatusSet.size      > 0) ? window.activeStatusSet      : null;
  const _stSingleActive = (!_stSetActive && activeStatus && activeStatus!=='entrada') ? activeStatus : null;
  const _trSetActive    = (window.activeTreinamentoSet && window.activeTreinamentoSet.size > 0) ? window.activeTreinamentoSet : null;
  const _normTr2 = function(s){ return String(s||'').toUpperCase().trim().replace(/\s+/g,' '); };
  const _trSetNorm = _trSetActive ? new Set(Array.from(_trSetActive).map(_normTr2)) : null;
  const _haFiltroSubs = !!(_stSetActive || _stSingleActive || _trSetNorm);
  function _itemBateFiltro(it){
    var st = it.status || 'aberto';
    if(_stSetActive && !_stSetActive.has(st)) return false;
    if(_stSingleActive && st !== _stSingleActive) return false;
    if(_trSetNorm){
      if(_trSetNorm.has('—')){
        var raw = String(it.treinamento||'').trim();
        if(!raw || raw==='-' || raw==='—') return true;
      }
      if(!_trSetNorm.has(_normTr2(it.treinamento))) return false;
    }
    return true;
  }
  /* Computa subs filtrados — independente de existir mobile card */
  const _flatRawAll = (typeof _achatarItens==='function') ? _achatarItens(f) : [];
  const _flatFiltrado = _haFiltroSubs ? _flatRawAll.filter(_itemBateFiltro) : _flatRawAll;
  const _totalSubsFiltrados = _haFiltroSubs
    ? _flatFiltrado.reduce(function(a,it){return a+(it.valor||0);}, 0)
    : f.reduce(function(a,d){return a+(d.valor||0);}, 0);

  // ── Renderização de cards mobile (espelha a tabela acima) ──
  const _ccEl=document.getElementById('clientCards');
  if(_ccEl){
    if(f.length===0){
      _ccEl.innerHTML='<div class="mob-empty">Nenhum cliente para os filtros selecionados.</div>';
    } else {
      // === MOBILE AGREGADO POR CLIENTE ===
      const _grupos={};
      const _ordem=[];
      /* Reusa _flatFiltrado calculado acima — já considera status + treinamento */
      _flatFiltrado.forEach(function(it){
        if(!it||!it.cliente) return;
        const _nome=String(it.cliente).toUpperCase().trim();
        if(!_grupos[_nome]){
          _grupos[_nome]={
            cliente:it.cliente,
            consultores:new Set(),
            treinos:[],
            anchorRi:it._ri,
            totalPago:0,totalAberto:0,totalGeral:0,
            qtdPagos:0,qtdAbertos:0,qtdTotal:0
          };
          _ordem.push(_nome);
        }
        const g=_grupos[_nome];
        if(it.consultor) g.consultores.add(it.consultor);
        g.treinos.push({cod:it.treinamento||'—', status:it.status||'aberto', valor:it.valor||0, ri:it._ri});
        g.qtdTotal++;
        const _stBaixo=String(it.status||'').toLowerCase();
        const _desist=(_stBaixo==='desistiu' || _stBaixo==='desistencia' || _stBaixo==='cancelado' || _stBaixo==='cancelada');
        if(it.status==='pago'){ g.totalPago+=(it.valor||0); g.qtdPagos++; }
        else if(it.status==='aberto'){ g.totalAberto+=(it.valor||0); g.qtdAbertos++; }
        /* Desistencias/cancelados NAO entram no total geral do cliente */
        if(!_desist) g.totalGeral+=(it.valor||0);
      });
      const _escAttr=function(s){return String(s||'').replace(/'/g,"\\'");};
      // === Card mobile · Opção 05 — compacto com chips de treinamento ===
      _ccEl.innerHTML=_ordem.map(function(nome){
        const g=_grupos[nome];
        const pago = g.qtdTotal>0 && g.qtdPagos===g.qtdTotal;
        const aberto = !pago && g.qtdAbertos>0;
        const stCls = pago?'pago':(aberto?'aberto':'semst');
        const stLabel = pago ? 'Pago' : (aberto ? 'Em aberto' : 'Sem status');
        const cnt = g.qtdTotal + ' treinamento' + (g.qtdTotal!==1?'s':'');
        const pills = g.treinos.map(function(t){
          const cls = t.status==='pago'?'p':(t.status==='aberto'?'a':'n');
          return '<span class="mob-trein-pill '+cls+'">'+String(t.cod||'—').toUpperCase()+'</span>';
        }).join('');
        const presencaHtml = window._presencaBadgeHtml ? window._presencaBadgeHtml(g.anchorRi) : '<span style="color:var(--muted);font-size:10px;">—</span>';
        /* Select de consultor — mesmo handler do desktop (cardCellChange).
           Usa anchorRi (primeiro sub do cliente); se houver mais de 1 sub com
           consultores diferentes, mostra o do primeiro e marca com ⚠. */
        var consAtual = '';
        g.consultores.forEach(function(c){ if(!consAtual) consAtual = c; });
        var consDivergentes = g.consultores.size > 1;
        var consOpts = '<option value=""'+(!consAtual?' selected':'')+'>— Atribuir consultor —</option>'
          + allConsultors.map(function(c){
              return '<option value="'+c+'"'+(consAtual===c?' selected':'')+'>'+c.toUpperCase()+'</option>';
            }).join('');
        /* Banner do consultor no TOPO do card (Opção 10): faixa colorida com
           gradiente. Cor personalizada por consultor (1º nome em lower-case
           vira a classe cons-<nome>); fallback azul (com consultor) ou laranja
           (sem). O <select> nativo fica sobreposto e abre o picker no tap. */
        var consSlug = consAtual
          ? consAtual.trim().split(/\s+/)[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
          : '';
        /* Cor única por consultor (inline sobrepõe a classe) — garante que
           consultores diferentes nunca tenham a mesma faixa. */
        var _gc = (typeof _gradConsultorMobile==='function') ? _gradConsultorMobile(consAtual) : null;
        var consBannerStyle = _gc ? ' style="background:'+_gc.grad+';border-bottom-color:'+_gc.border+';"' : '';
        var consBannerHtml = '<div class="mob-cons-banner'+(consAtual?' has':' empty')+(consSlug?' cons-'+consSlug:'')+'"'+consBannerStyle+'>'
          + '<span class="bub bub-a"></span>'
          + '<span class="bub bub-b"></span>'
          + '<span class="bub bub-c"></span>'
          + '<span class="bub bub-d"></span>'
          + '<span class="mob-cons-banner-txt">'
          +   (consDivergentes ? '⚠ ' : '')
          +   (consAtual ? consAtual : '— Atribuir consultor —')
          + '</span>'
          + '<span class="mob-cons-banner-caret">▾</span>'
          + '<select class="mob-cons-banner-sel" data-ri="'+g.anchorRi+'" data-campo="consultor" onchange="cardCellChange(this)" onclick="event.stopPropagation();" aria-label="Atribuir consultor">'
          +   consOpts
          + '</select>'
          + '</div>';
        return '<div class="mob-card mob-card-agg '+stCls+'" id="mobcard_'+g.anchorRi+'">'
          + consBannerHtml
          + '<div class="mob-header">'
          +   '<div class="mob-info">'
          +     '<div class="mob-name-row">'
          +       '<span class="mob-name '+stCls+'">'+g.cliente+'</span>'
          +       '<span class="mob-presenca" data-presenca-ri="'+g.anchorRi+'">'+presencaHtml+'</span>'
          +       '<button class="mob-plus-btn" onclick="event.stopPropagation();window._abrirMenuCliente(event,\''+_escAttr(g.cliente)+'\','+g.anchorRi+')" title="Adicionar / Editar / Ver informações">+</button>'
          +     '</div>'
          +     '<div class="mob-meta-row">'
          +       '<span class="mob-st '+stCls+'">'+stLabel+' · '+cnt+'</span>'
          +       '<span class="mob-val '+stCls+'">'+formatVal(g.totalGeral)+'</span>'
          +     '</div>'
          +   '</div>'
          + '</div>'
          + (pills ? '<div class="mob-chips-row">'+pills+'</div>' : '')
          + '</div>';
      }).join('');
    }
  }

  const _totalValid=data.filter(d=>d&&d.cliente).length;
  document.getElementById('tableCount').textContent=`${f.length} de ${_totalValid} cliente${_totalValid!==1?'s':''}`;
  document.getElementById('tableTotal').innerHTML='Total visível: <span>'+formatVal(_totalSubsFiltrados)+'</span>';

  // Barras por treinador — NEON + PERCENTUAL
  const maxV=Math.max(1,...allTrainers.map(t=>data.filter(d=>d&&d.cliente&&d.treinador===t).reduce((a,d)=>a+d.valor,0)));

  // Permissão: consultor não interage com rankings e barras da aba Geral
  var _sessG=_getSessao?_getSessao():null;
  var _perfilG=_sessG?_sessG.perfil:'adm';
  var _rankClicavel=(_perfilG==='adm'||_perfilG==='ministrante');

  // Correlação cruzada — calculada antes de qualquer renderização dos painéis
  const consultoresDoTreinadorAtivo = activeTrainer
    ? new Set(data.filter(d=>d&&d.cliente&&d.treinador===activeTrainer).map(d=>d.consultor))
    : null;
  const treinadoresDoConsultorAtivo = activeConsultor
    ? new Set(data.filter(d=>d&&d.cliente&&d.consultor===activeConsultor).map(d=>d.treinador))
    : null;
  document.getElementById('trainerBars').innerHTML=allTrainers.map((t,i)=>{
    const tv=data.filter(d=>d&&d.cliente&&d.treinador===t).reduce((a,d)=>a+d.valor,0);
    const tp=data.filter(d=>d&&d.cliente&&d.treinador===t&&d.status==='pago').reduce((a,d)=>a+d.valor,0);
    const bw=Math.round((tv/maxV)*100);
    const pctT=tv>0?Math.round((tp/tv)*100):0;
    const cor=tColors[t]||PALETTE_T[i%PALETTE_T.length];
    const nb=NB_CLS[i%NB_CLS.length];
    var opB=1;
    if(activeTrainer&&activeTrainer!==t) opB=0.3;
    else if(treinadoresDoConsultorAtivo&&!treinadoresDoConsultorAtivo.has(t)) opB=0.3;
    var _attrBar=_rankClicavel?`onclick="toggleTrainer('${t}')"`:`style="pointer-events:none;"`;
    return `<div class="bar-srow" style="opacity:${opB};transition:opacity .15s;" ${_attrBar}>
      <div class="bar-sname">${t.toUpperCase()}</div>
      <div class="bar-sbg">
        <div class="bar-sfill ${nb}" style="width:${bw}%;background:${cor};overflow:visible;">
          ${bw>15?`<span class="bar-pct">${pctT}%</span>`:''}
        </div>
        ${bw<=15&&bw>0?`<span style="position:absolute;left:${bw+2}%;top:50%;transform:translateY(-50%);font-size:10px;font-weight:700;color:${cor};">${pctT}%</span>`:''}
      </div>
      <div class="bar-sval">
        <div>${formatVal(tv)}</div>
        ${tp>0?`<div style="color:var(--green);">✓ ${formatVal(tp)}</div>`:''}
      </div>
    </div>`;
  }).join('');

  // Rankings
  const medals=['gold','silver','bronze'];
  // _rankClicavel já declarado acima no bloco de barras

  const rankT=[...allTrainers].map(t=>({nome:t,total:data.filter(d=>d&&d.cliente&&d.treinador===t).reduce((a,d)=>a+d.valor,0),pago:data.filter(d=>d&&d.cliente&&d.treinador===t&&d.status==='pago').reduce((a,d)=>a+d.valor,0),clientes:data.filter(d=>d&&d.cliente&&d.treinador===t).length})).sort((a,b)=>b.pago-a.pago);
  document.getElementById('rankingTreinador').innerHTML=rankT.map((t,i)=>{
    var opT=1;
    if(activeTrainer&&activeTrainer!==t.nome) opT=0.3;
    else if(treinadoresDoConsultorAtivo&&!treinadoresDoConsultorAtivo.has(t.nome)) opT=0.3;
    var _attrT=_rankClicavel?`onclick="toggleTrainer('${t.nome}')" style="cursor:pointer;opacity:${opT};transition:opacity .15s;" title="Filtrar por ${t.nome}"`:`style="cursor:default;opacity:${opT};transition:opacity .15s;"`;
    return `<div class="rank-row" ${_attrT}><div class="rank-num ${medals[i]||''}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div><div class="rank-info"><div class="rank-name">${t.nome.toUpperCase()}</div><div class="rank-detail">${t.clientes} clientes · ${formatVal(t.pago)} faturado</div></div><div class="rank-val">${formatVal(t.pago)}</div></div>`;
  }).join('');

  const rankC=[...allConsultors].map(c=>({nome:c,total:data.filter(d=>d&&d.cliente&&d.consultor===c).reduce((a,d)=>a+d.valor,0),pago:data.filter(d=>d&&d.cliente&&d.consultor===c&&d.status==='pago').reduce((a,d)=>a+d.valor,0),entrada:data.filter(d=>d&&d.cliente&&d.consultor===c).reduce((a,d)=>a+d.entrada,0),clientes:data.filter(d=>d&&d.cliente&&d.consultor===c).length})).sort((a,b)=>b.pago-a.pago);
  document.getElementById('rankingConsultor').innerHTML=rankC.map((c,i)=>{
    var opC=1;
    if(activeConsultor&&activeConsultor!==c.nome) opC=0.3;
    else if(consultoresDoTreinadorAtivo&&!consultoresDoTreinadorAtivo.has(c.nome)) opC=0.3;
    var _attrC=_rankClicavel?`onclick="abrirClientesVinculados('${c.nome}')" style="cursor:pointer;opacity:${opC};transition:opacity .15s;" title="Ver clientes de ${c.nome}"`:`style="cursor:default;opacity:${opC};transition:opacity .15s;"`;
    return `<div class="rank-row" ${_attrC}><div class="rank-num ${medals[i]||''}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div><div class="rank-info"><div class="rank-name">${c.nome.toUpperCase()}</div><div class="rank-detail">${c.clientes} clientes · ${formatVal(c.entrada)} entrada</div></div><div class="rank-val">${formatVal(c.pago)}</div></div>`;
  }).join('');
  /* Considera o schema hibrido: entrada pode estar no scalar (d.entrada)
     OU dentro de d.treinamentos[i].entrada. _entradaPendenteDoCliente
     ja consolida ambos. */
  const ce2=data.filter(d=>d&&d.cliente&&_entradaPendenteDoCliente(d)>0);
  document.getElementById('entradaRows').innerHTML=ce2.length===0?'<div style="font-size:12px;color:var(--muted);padding:8px 0;">Nenhuma entrada registrada.</div>':ce2.map(d=>{var _ent=_entradaPendenteDoCliente(d);return `<div class="srow" onclick="toggleCliente('${d.cliente}')" style="cursor:pointer;opacity:${activeCliente&&activeCliente!==d.cliente?0.3:1};transition:opacity .15s;" title="Filtrar por ${d.cliente}"><div><div class="srow-name">${d.cliente}</div><div class="srow-sub">${(d.consultor||'').toUpperCase()} · ${d.treinamento||'—'}</div></div><span class="srow-val" style="color:var(--green);">${formatVal(_ent)}</span></div>`;}).join('');

  // Sync abas abertas
  if(window._consultorAtivo&&document.getElementById('consultorDetail').style.display!=='none')_renderConsultorDetail(window._consultorAtivo);
  if(window._treinadorAtivo&&document.getElementById('treinadorDetail').style.display!=='none')_renderTreinadorDetail(window._treinadorAtivo);

  // Re-renderizar aba ativa
  var _abaAtiva=document.querySelector('.tab.active');
  if(_abaAtiva){
    var _tabTxt=(_abaAtiva.textContent||'').toLowerCase().trim();
    if(_tabTxt==='consultor') renderConsultor();
    if(_tabTxt==='treinador') renderTreinador();
    if(_tabTxt==='produto') renderProduto();
  }
}

/* Atalho: clique no título "CLIENTES" da aba Geral abre o modal Lista de Clientes.
   Restrito a ADM em viewport ≥ 769px (desktop). */
window._abrirListaClientesAdm = function(){
  var sess = (typeof _getSessao==='function') ? _getSessao() : null;
  if(!sess || sess.perfil !== 'adm') return;
  if(window.innerWidth < 769) return;
  if(typeof abrirListaClientes === 'function') abrirListaClientes();
};
window.addEventListener('resize', function(){
  var el = document.getElementById('panelTitleClientes');
  if(!el) return;
  var sess = (typeof _getSessao==='function') ? _getSessao() : null;
  var ehAdmDesk = !!(sess && sess.perfil === 'adm') && window.innerWidth >= 769;
  el.classList.toggle('pt-clickable', ehAdmDesk);
});

