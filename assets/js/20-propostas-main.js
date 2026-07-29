function _mostrarTurmaInativa(){
  _mostrarTela('turmaInativaScreen',true);
}

function _mostrarPropostaComercial(){
  _mostrarTela('propostaComercialScreen');
  // Renderizar cards de produtos
  var grid = document.getElementById('propostaComercialCards');
  if(grid && typeof _PRODUTOS_PROPOSTA !== 'undefined'){
    grid.innerHTML = _getProdutosOrdem().map(function(cod){
      var p = _PRODUTOS_PROPOSTA[cod];
      var imgStyle = p.img ? (function(){
      var posMap={'JE':'center 45%','MAESTRIA':'center 50%','DP':'center 45%','CIS_GLOBAL':'center 20%','TEAM':'center 50%'};
      var pos=posMap[cod]||'center 5%';
      return 'background-image:url('+p.img+');background-size:115%;background-position:'+pos+';';
    })()
      : 'background:var(--surface2);';
      return '<div class="prop-prod-card" data-cod="'+cod+'" style="cursor:pointer;border-radius:10px;overflow:hidden;border:1px solid var(--border2);transition:transform .15s;" onmouseover="this.style.transform=\'scale(1.03)\'" onmouseout="this.style.transform=\'\'">'
        +'<div style="'+imgStyle+'height:140px;position:relative;overflow:hidden;">'
        +'<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.92) 0%,rgba(0,0,0,.3) 55%,transparent 100%);"></div>'
        +'<div style="position:absolute;top:7px;left:7px;background:rgba(200,240,90,.18);border:1px solid rgba(200,240,90,.35);border-radius:4px;font-size:8px;font-weight:700;color:#c8f05a;padding:2px 6px;letter-spacing:.06em;">'+cod+'</div>'
        +'<div style="position:absolute;bottom:10px;left:0;right:0;padding:0 10px;"><div style="font-size:11px;font-weight:700;color:#fff;line-height:1.3;">'+p.nome+'</div></div>'
        +'</div>'
        +'<div class="gp-btn" style="padding:7px 10px;background:#0a150a;text-align:center;font-size:10px;font-weight:600;color:#fff;letter-spacing:.04em;border-top:1px solid rgba(200,240,90,.15);transition:background .25s,color .25s;">Gerar Proposta</div>'
        +'</div>';
    }).join('');
    // Event delegation
    grid.addEventListener('click',function(e){
      var card=e.target.closest('.prop-prod-card');
      if(card&&card.dataset.cod) abrirPropProd(card.dataset.cod);
    });
  }
}

/* ============================================================
   PROPOSTA COMERCIAL
============================================================ */
var _PROPOSTA_TEXTO = "É uma imensa honra tê-lo conosco e poder fazer parte da sua jornada.\nSabemos que você superou diversos desafios para chegar até esse curso e queremos te parabenizar por isso. Acreditar que existe uma vida extraordinária e agir em direção a ela é um ato de ousadia e coragem.\nMas, reforçamos que existe um nível ainda mais alto e queremos muito te conduzir em direção a ele.\nE é justamente por esse motivo, que venho te lembrar dos treinamentos que ainda faltam para concluir a jornada e se tornar um GREEN OU GOLDEN BELT Febracis. Temos a total certeza de que juntos construiremos dia após dia o seu legado dentro e fora da Febracis.";

var _PROPOSTA_PRECOS = {
  'IF':        {integral:4596.40,  parcelado:383.03,  parcelado_desc:249.75,   avista_credito:2997.00, avista:2497.00,  reciclagem:1798.20},
  'MASTER':    {integral:8796.45,  parcelado:733.03,  parcelado_desc:649.75,   avista_credito:5997.00, avista:5997.00,  reciclagem:3898.24},
  'CEOP':      {integral:6996.45,  parcelado:583.03,  parcelado_desc:499.75,   avista_credito:4997.00, avista:3997.00,  reciclagem:2998.23},
  'FGPC':      {integral:6996.45,  parcelado:583.03,  parcelado_desc:499.75,   avista_credito:4997.00, avista:3997.00,  reciclagem:2998.23},
  'BHP':       {integral:6996.45,  parcelado:583.03,  parcelado_desc:499.75,   avista_credito:4997.00, avista:3997.00,  reciclagem:2998.23},
  'FCIS':      {integral:11796.49, parcelado:983.03,  parcelado_desc:899.75,   avista_credito:8997.00, avista:8997.00,  reciclagem:5398.25},
  'ML5':       {integral:11796.49, parcelado:983.03,  parcelado_desc:899.75,   avista_credito:5398.25, avista:5398.25,  reciclagem:5398.25},
  'TAV':       {integral:3997.00,  parcelado:333.08,  parcelado_desc:249.75,   avista_credito:2497.00, avista:1997.00,  reciclagem:1498.50},
  'MAESTRIA':  {integral:85000.00, parcelado:9925.48, parcelado_desc:9925.48,  avista_credito:85000.00,avista:85000.00, reciclagem:85000.00},
  'CIS_GLOBAL':{integral:1997.00,  parcelado:199.70,  parcelado_desc:199.70,   avista_credito:1997.00, avista:1997.00,  reciclagem:998.50},
  'CIS_PRESENCIAL_BRONZE': {integral:2997.00,  parcelado:299.70,   parcelado_desc:299.70,   avista_credito:2997.00,  avista:2997.00,  reciclagem:1498.50},
  'CIS_PRESENCIAL_BLACK':  {integral:4997.00,  parcelado:499.70,   parcelado_desc:499.70,   avista_credito:4997.00,  avista:4997.00,  reciclagem:2498.50},
  'CIS_PRESENCIAL_DIAMOND':{integral:12997.00, parcelado:1299.70,  parcelado_desc:1299.70,  avista_credito:12997.00, avista:12997.00, reciclagem:12997.00},
  'CIS_PRESENCIAL_VIP':    {integral:20000.00, parcelado:2000.01,  parcelado_desc:2000.01,  avista_credito:20000.00, avista:20000.00, reciclagem:20000.00},
  'CI':        {integral:60000.00, parcelado:5000.00, parcelado_desc:5000.00,  avista_credito:50000.00,avista:50000.00, reciclagem:60000.00},
  /* Placeholders adicionados — preços virão da hidratação do Firebase (appConfig/treinamentosMeta) */
  'JE':        {integral:0, parcelado:0, parcelado_desc:0, avista_credito:0, avista:0, reciclagem:0},
  'GE':        {integral:0, parcelado:0, parcelado_desc:0, avista_credito:0, avista:0, reciclagem:0},
  'PDA':       {integral:0, parcelado:0, parcelado_desc:0, avista_credito:0, avista:0, reciclagem:0},
  'DP':        {integral:0, parcelado:0, parcelado_desc:0, avista_credito:0, avista:0, reciclagem:0},
  'TEAM':      {integral:0, parcelado:0, parcelado_desc:0, avista_credito:0, avista:0, reciclagem:0},
};

var _PROPOSTA_LABELS = {
  integral:      'Integral',
  parcelado:     '12x',
  parcelado_desc:'12x c/ desconto',
  avista_credito:'À Vista no crédito',
  avista:        'À Vista',
  reciclagem:    'Reciclagem 50%'
};

// Treinamentos disponíveis para proposta (tabela de preços)
var _PROPOSTA_TREINAMENTOS = Object.keys(_PROPOSTA_PRECOS);

// Combo GGB — pacote de 8 treinamentos selecionado pelo botao "Selecionar GGB"
var _PROPOSTA_GGB = ['IF','MASTER','CEOP','FGPC','BHP','FCIS','ML5','TAV'];

var _PRODUTOS_PROPOSTA={
'IF':{customRenderer:true,nome:'Inteligência Financeira',codigo:'IF',img:'assets/img/propostas/IF.jpg',texto:'\u00c9 uma imensa honra convidá-lo(a) para o Inteligência Financeira.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'MASTER':{customRenderer:true,nome:'Master Coaching',codigo:'MASTER',img:'assets/img/propostas/MASTER.jpg',texto:'\u00c9 uma imensa honra convidá-lo(a) para o Master Coaching.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'CEOP':{customRenderer:true,nome:'Comunicação Eficaz e Oratória Persuasiva',codigo:'CEOP',img:'assets/img/propostas/CEOP.jpg',texto:'\u00c9 uma imensa honra convidá-lo(a) para o Comunicação Eficaz e Oratória Persuasiva.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'FGPC':{customRenderer:true,nome:'Formação em Gestão de Pessoas com Analise de Perfil Comportamental',codigo:'FGPC',img:'assets/img/propostas/FGPC.jpg',texto:'\u00c9 uma imensa honra convidá-lo(a) para o Formação em Gestão de Pessoas com Analise de Perfil Comportamental.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'BHP':{customRenderer:true,nome:'Gestão de Negócios',codigo:'BHP',img:'assets/img/propostas/BHP.jpg',texto:'\u00c9 uma imensa honra convidá-lo(a) para o BHP — Gestão de Negócios.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'FCIS':{customRenderer:true,nome:'Formação em Coaching Integral Sistêmico',codigo:'FCIS',img:'assets/img/propostas/FCIS.jpg',texto:'\u00c9 uma imensa honra convidá-lo(a) para o FCIS — Coaching Integral Sistêmico.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},

'ML5':{customRenderer:true,nome:'Formação de Líderes',codigo:'ML5',img:'assets/img/propostas/ML5.jpg',texto:'\u00c9 uma imensa honra convidá-lo(a) para o ML5 — Formação de Líderes.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'TAV':{customRenderer:true,nome:'Técnicas Avançadas de Vendas',codigo:'TAV',img:'assets/img/propostas/TAV.jpg',texto:'\u00c9 uma imensa honra convidá-lo(a) para o Técnicas Avançadas de Vendas.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'JE':{nome:'Jornada do Enriquecimento',codigo:'JE',img:'assets/img/propostas/JE.jpg',texto:'\u00c9 uma imensa honra convidá-lo(a) para o Jornada do Enriquecimento.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'GE':{nome:'Gestão Eficaz',codigo:'GE',img:'assets/img/propostas/GE.png',texto:'\u00c9 uma imensa honra convidá-lo(a) para o Gestão Eficaz.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'MAESTRIA':{nome:'Maestria em Negócios',codigo:'MAESTRIA',img:'assets/img/propostas/MAESTRIA.jpg',texto:'\u00c9 uma imensa honra convidá-lo(a) para o Maestria em Negócios.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'PDA':{nome:'O Poder da Ação',codigo:'PDA',img:'assets/img/propostas/PDA.png',texto:'\u00c9 uma imensa honra convidá-lo(a) para o O Poder da Ação.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'DP':{nome:'Decifre e Influencie Pessoas',codigo:'DP',img:'assets/img/propostas/DP.png',texto:'\u00c9 uma imensa honra convidá-lo(a) para o Decifre e Influencie Pessoas.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'CIS_GLOBAL':{customRenderer:true,nome:'Método CIS Global',codigo:'CIS_GLOBAL',img:'assets/img/propostas/CIS_GLOBAL.jpg',texto:'\u00c9 uma imensa honra convidá-lo(a) para o Método CIS Global.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'CIS_PRESENCIAL_BRONZE':{customRenderer:true,nome:'Método CIS Presencial Setor Bronze',codigo:'CIS_PRESENCIAL_BRONZE',img:'assets/img/propostas/CIS.png',texto:'É uma imensa honra convidá-lo(a) para o Método CIS Presencial Setor Bronze.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'CIS_PRESENCIAL_BLACK':{customRenderer:true,nome:'Método CIS Presencial Setor Black',codigo:'CIS_PRESENCIAL_BLACK',img:'assets/img/propostas/CIS.png',texto:'É uma imensa honra convidá-lo(a) para o Método CIS Presencial Setor Black.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'CIS_PRESENCIAL_DIAMOND':{customRenderer:true,nome:'Método CIS Presencial Setor Diamond',codigo:'CIS_PRESENCIAL_DIAMOND',img:'assets/img/propostas/CIS.png',texto:'É uma imensa honra convidá-lo(a) para o Método CIS Presencial Setor Diamond.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'CIS_PRESENCIAL_VIP':{customRenderer:true,nome:'Método CIS Presencial Setor Vip',codigo:'CIS_PRESENCIAL_VIP',img:'assets/img/propostas/CIS.png',texto:'É uma imensa honra convidá-lo(a) para o Método CIS Presencial Setor Vip.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'CIS':{customRenderer:true,nome:'Método CIS Presencial',codigo:'CIS',img:'assets/img/propostas/CIS.png',texto:'O Método CIS (Coaching Integral Sistêmico) é o maior e mais completo treinamento de inteligência emocional do mundo, criado por Paulo Vieira — especialista em comportamento humano e presidente da Febracis.\n\nCom mais de 248 edições realizadas e 1,8 milhão de pessoas impactadas em 83 países, o programa é projetado para ajudar você a desbloquear seu potencial máximo através de 5 pilares essenciais que transformam todas as 11 áreas da sua vida:\n\n✅ Performance: maior capacidade de liderança\n✅ Emocional: elimine hábitos tóxicos e sabotadores\n✅ Financeiro: organize e alavanche sua vida financeira\n✅ Profissional: cresça e se destaque na sua área\n✅ Relacionamentos: restaure e fortaleça seus laços\n\nSão mais de 50 horas de imersão profunda em 3 dias de treinamento presencial, com Paulo Vieira, Camila Vieira e Júlia Vieira.\n\nNão perca essa oportunidade de transformar sua vida de dentro para fora!',preco:'R$ [VALOR]',validade:'30 dias'},
'TEAM':{nome:'Team Coaching Febracis',codigo:'TEAM',img:'assets/img/propostas/TEAM.png',texto:'\u00c9 uma imensa honra convidá-lo(a) para o Team Coaching Febracis.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ [VALOR]',validade:'30 dias'},
'CI':{nome:'Coaching Individual',codigo:'CI',img:'assets/img/propostas/CI.jpg',texto:'É uma imensa honra convidá-lo(a) para o Coaching Individual.\n\n[TEXTO_DO_PRODUTO — substitua com base no PDF do treinamento]\n\nNão deixe essa oportunidade passar!',preco:'R$ 60.000,00',validade:'30 dias'},
};

/* ─────────────────────────────────────────────────────────────────
   HIDRATAÇÃO assíncrona: lê appConfig/treinamentosMeta do Firebase
   e sobrescreve preços e metadados (nome/img/texto/validade) em runtime.
   Permite admin editar tabela de preços e textos sem mexer no código.
   Os hardcoded acima permanecem como fallback se Firebase falhar.
   ─────────────────────────────────────────────────────────────── */
(function _hidratarPropostas(){
  if(typeof window._fbGet !== 'function') return;
  /* Mapeia chave canônica do Firebase → chave legada do hardcoded */
  var REVERSE = { 'MASTER COACHING':'MASTER', 'TEAM COACHING':'TEAM' };
  setTimeout(function(){
    window._fbGet('appConfig/treinamentosMeta').then(function(meta){
      if(!meta || typeof meta !== 'object') return;
      var n = 0;
      Object.keys(meta).forEach(function(canonKey){
        var m = meta[canonKey]; if(!m) return;
        var k = REVERSE[canonKey] || canonKey;
        /* Preços (sobrescreve campo-a-campo se vier) */
        if(m.precos && _PROPOSTA_PRECOS[k]){
          ['integral','avista','avista_credito','parcelado','parcelado_desc','reciclagem'].forEach(function(c){
            if(m.precos[c] != null) _PROPOSTA_PRECOS[k][c] = m.precos[c];
          });
          n++;
        }
        /* Metadados */
        if(_PRODUTOS_PROPOSTA[k]){
          if(m.nome)     _PRODUTOS_PROPOSTA[k].nome     = m.nome;
          if(m.img)      _PRODUTOS_PROPOSTA[k].img      = m.img;
          if(m.texto)    _PRODUTOS_PROPOSTA[k].texto    = m.texto;
          if(m.validade) _PRODUTOS_PROPOSTA[k].validade = m.validade;
        }
      });
      if(n > 0) console.log('[Propostas] '+n+' produto(s) hidratado(s) do Firebase (appConfig/treinamentosMeta)');
    }).catch(function(e){ console.warn('[Propostas] Falha ao hidratar:', e); });
  }, 1500);
})();

function abrirPropostaModal(){
  var sess = _getSessao ? _getSessao() : null;
  var isAdm = !sess || sess.perfil === 'adm';

  // Consultor responsável (auto)
  var nomeConsultor = '';
  if(isAdm){
    nomeConsultor = 'ADM';
  } else if(sess && sess.vinculo){
    nomeConsultor = sess.vinculo.toUpperCase();
  } else if(sess && sess.nome){
    nomeConsultor = sess.nome.toUpperCase();
  }
  var dispConsultor = document.getElementById('propostaConsultorDisplay');
  if(dispConsultor) dispConsultor.textContent = nomeConsultor || '—';

  // Popular select de consultores (lista única do data) + opção manual
  var selCon = document.getElementById('propostaConsultor');
  if(selCon){
    var consultores = [...new Set((Array.isArray(data)?data:[]).filter(function(d){return d&&d.consultor;}).map(function(d){return String(d.consultor).toUpperCase();}))].sort();
    /* Garante que o consultor logado apareça mesmo se não tiver registros no data */
    if(nomeConsultor && consultores.indexOf(nomeConsultor) === -1) consultores.unshift(nomeConsultor);
    var optsHtml = '';
    if(nomeConsultor){
      optsHtml += '<option value="'+nomeConsultor+'">'+nomeConsultor+' (você)</option>';
    } else {
      optsHtml += '<option value="">Selecione um consultor...</option>';
    }
    consultores.forEach(function(c){
      if(c === nomeConsultor) return; /* já adicionado acima como "(você)" */
      optsHtml += '<option value="'+c+'">'+c+'</option>';
    });
    optsHtml += '<option value="__manual__" style="color:var(--accent);font-weight:700;">✎ Outro consultor (manual)…</option>';
    selCon.innerHTML = optsHtml;
    selCon.value = nomeConsultor || '';
  }
  /* Reseta input manual de consultor */
  var inpConMan = document.getElementById('propostaConsultorManual');
  if(inpConMan){ inpConMan.value = ''; inpConMan.style.display = 'none'; }

  // Popular clientes da turma + opção manual
  var sel = document.getElementById('propostaCliente');
  sel.innerHTML = '<option value="">Selecione um cliente...</option>'
                + '<option value="__manual__" style="color:var(--accent);font-weight:700;">✎ Outro cliente (manual)…</option>';
  var clientes;
  if(!isAdm && sess && sess.vinculo){
    var meus = data.filter(function(d){return d&&d.cliente&&d.consultor&&d.consultor.toUpperCase()===(sess.vinculo||'').toUpperCase();});
    clientes = [...new Set(meus.map(function(d){return d.cliente;}))].sort();
  } else {
    clientes = [...new Set(data.filter(function(d){return d&&d.cliente;}).map(function(d){return d.cliente;}))].sort();
  }
  clientes.forEach(function(c){
    var opt = document.createElement('option');
    opt.value = c; opt.textContent = String(c||'').toUpperCase();
    sel.appendChild(opt);
  });
  /* Garante que o select tambem exiba o nome selecionado em caixa alta */
  sel.style.textTransform = 'uppercase';
  /* Reseta input manual */
  var inpMan = document.getElementById('propostaClienteManual');
  if(inpMan){ inpMan.value = ''; inpMan.style.display = 'none'; }

  // Renderizar treinamentos e resetar preview
  _propostaRenderTreinamentos();
  _propostaRecalcular();
  var frame = document.getElementById('propostaPreviewFrame');
  var ph = document.getElementById('propostaPreviewPlaceholder');
  if(frame){frame.src='about:blank';frame.style.display='none';}
  if(ph) ph.style.display='flex';
  /* Zera a modalidade Elite/Legacy Belt a cada abertura (evita vazar o texto
     da Seção I para uma proposta comum). A grade carregada é preservada. */
  if(typeof window._beltReset === 'function') window._beltReset();
  document.getElementById('propostaOverlay').classList.add('open');
  /* Ativa o preview em tempo real desde o início — qualquer interação
     (sliders, +/− qty, preço, checkbox) regenera o PDF instantaneamente
     sem precisar clicar em "Visualizar". */
  window._propostaPreviewAtivo = true;
}

function fecharPropostaModal(){
  document.getElementById('propostaOverlay').classList.remove('open');
  window._propostaPreviewAtivo = false; // reset para próxima abertura
}

/* visualizarPropostaPDF() — abre o "Espelho do PDF" em tela cheia.
   É ESTRITAMENTE de consulta: não altera nenhum dado da proposta nem
   dispara o download. Reaproveita o MESMO PDF do preview embutido
   (gerarPropostaPDF('preview') popula propostaPreviewFrame._lastBlobUrl),
   garantindo que a visualização = documento gerado, 1:1. */
function visualizarPropostaPDF(){
  var cliente = _propostaClienteAtual();
  if(!cliente){ if(window._showToast) _showToast('⚠️ Selecione um cliente.','var(--amber)'); return; }
  var marcados = document.querySelectorAll('#propostaTreinamentos input[type=checkbox]:checked').length;
  if(!marcados){ if(window._showToast) _showToast('⚠️ Selecione ao menos um treinamento.','var(--amber)'); return; }

  function _abrirVisual(){
    /* Gera/atualiza o blob do preview (mesmo gerador do "Gerar PDF") */
    try { gerarPropostaPDF('preview'); } catch(e){ console.error('[visualizarPropostaPDF]', e); }
    var framePv = document.getElementById('propostaPreviewFrame');
    var url = framePv && framePv._lastBlobUrl;
    if(!url){ if(window._showToast) _showToast('❌ Não foi possível montar a visualização.','var(--red)'); return; }
    var fsFrame = document.getElementById('propostaVisualFrame');
    if(fsFrame) fsFrame.src = url + '#toolbar=0&navpanes=0&view=FitH';
    var ov = document.getElementById('propostaVisualOverlay');
    if(ov) ov.classList.add('open');
  }

  /* Garante o jsPDF antes (1ª vez é assíncrono); senão o blob ainda não existe */
  if(typeof window.jspdf === 'undefined' && typeof window._ensureJsPDF === 'function'){
    if(window._showToast) _showToast('⏳ Preparando visualização…','var(--muted)');
    window._ensureJsPDF().then(_abrirVisual).catch(function(){
      if(window._showToast) _showToast('❌ Erro ao carregar gerador de PDF.','var(--red)');
    });
  } else {
    _abrirVisual();
  }
}

function fecharPropostaVisual(){
  var ov = document.getElementById('propostaVisualOverlay');
  if(ov) ov.classList.remove('open');
}

function _propostaRenderTreinamentos(){
  var pagamento = document.getElementById('propostaPagamento').value;
  var container = document.getElementById('propostaTreinamentos');
  container.innerHTML = '';

  // Treinamentos da tabela de preços
  _PROPOSTA_TREINAMENTOS.forEach(function(nome){
    var precos = _PROPOSTA_PRECOS[nome];
    var preco = precos[pagamento];
    var indisponivel = preco === null;

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:var(--radius-sm);border:1px solid var(--border2);background:var(--surface2);cursor:pointer;transition:all .15s;min-width:0;flex-wrap:nowrap;overflow:hidden;';
    /* Quando o treinamento nao tem preco-tabela para essa forma de pagamento,
       mantemos a row visualmente atenuada PORÉM editavel — o usuario pode
       preencher o valor manualmente e marcar o checkbox normalmente. */
    if(indisponivel) row.style.opacity = '0.7';

    var chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.id = 'prop_' + nome;
    /* disabled removido: permite marcar mesmo sem preco de tabela */
    chk.style.cssText = 'accent-color:var(--accent);width:15px;height:15px;flex-shrink:0;cursor:pointer;';
    chk.addEventListener('change', _propostaRecalcular);

    var label = document.createElement('label');
    label.htmlFor = 'prop_' + nome;
    label.style.cssText = 'flex:1;min-width:0;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:5px;flex-wrap:nowrap;overflow:hidden;';

    var nomeSpan = document.createElement('span');
    nomeSpan.style.cssText = 'font-size:13px;font-weight:600;color:var(--text);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    nomeSpan.textContent = nome;

    // Quantidade — padrão 1, mínimo 1 (sempre editavel)
    var qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.id = 'propqty_' + nome;
    qtyInput.min = '1';
    qtyInput.value = '1';
    qtyInput.title = 'Quantidade';
    qtyInput.style.cssText = 'width:34px;flex-shrink:0;background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:4px 3px;color:var(--text);font-size:11px;font-weight:700;text-align:center;font-family:DM Mono,monospace;';
    /* Usa 'input' (não 'change') pra capturar os clicks dos botões nativos
       +/− do input type=number — dispara a cada incremento, instantâneo. */
    qtyInput.addEventListener('input', function(){
      if(parseInt(this.value)<1 || isNaN(parseInt(this.value))) this.value='1';
      _propostaRecalcular();
    });
    qtyInput.addEventListener('focus', function(){this.select();});
    qtyInput.addEventListener('click', function(e){e.stopPropagation();});

    var precoInput = document.createElement('input');
    precoInput.type = 'text';
    precoInput.id = 'propval_' + nome;
    /* Quando indisponivel, mostra 0,00 (editavel) em vez de "—" */
    precoInput.value = indisponivel ? formatVal(0) : formatVal(preco);
    precoInput.placeholder = '0,00';
    precoInput.title = indisponivel ? 'Sem preco de tabela — digite manualmente' : 'Edite para sobrescrever o preco unitario';
    precoInput.style.cssText = 'width:112px;flex-shrink:0;background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:4px 8px;color:var(--accent);font-size:12px;font-weight:700;text-align:right;font-family:DM Mono,monospace;white-space:nowrap;';
    precoInput.addEventListener('focus', function(){this.select();});
    /* Listener único de 'input': PRIMEIRO marca como editado e grava
       o val unit customizado (= valor digitado / qty atual), DEPOIS
       chama _propostaRecalcular. A ordem importa porque o recalcular
       lê chk.dataset.edited pra decidir se preserva a edição manual
       ou reaplica o preço da tabela. */
    precoInput.addEventListener('input', function(){
      chk.dataset.edited = '1';
      this.value = (typeof lcMoneyMask==='function') ? lcMoneyMask(this.value) : this.value;
      var qtyInpNow = document.getElementById('propqty_' + nome);
      var qtyNow = qtyInpNow ? Math.max(1, parseInt(qtyInpNow.value) || 1) : 1;
      var valDigitado = parseVal(this.value);
      chk.dataset.editedVal = String(valDigitado / qtyNow);
      if(restoreBtn) restoreBtn.style.display = 'inline-flex';
      _propostaRecalcular();
    });

    /* Botao restaurar preco de tabela — fica oculto enquanto nao houve
       edicao manual e aparece quando o usuario digita algo. */
    var restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.title = 'Restaurar preco de tabela';
    restoreBtn.textContent = '↺';
    restoreBtn.style.cssText = 'display:none;width:20px;height:20px;flex-shrink:0;background:transparent;border:1px solid var(--border2);border-radius:var(--radius-sm);color:var(--muted);cursor:pointer;font-size:12px;line-height:1;padding:0;font-family:DM Sans,sans-serif;transition:all .15s;';
    restoreBtn.addEventListener('mouseover', function(){this.style.color='var(--accent)';this.style.borderColor='var(--accent)';});
    restoreBtn.addEventListener('mouseout', function(){this.style.color='var(--muted)';this.style.borderColor='var(--border2)';});
    restoreBtn.addEventListener('click', function(e){
      e.stopPropagation();
      delete chk.dataset.edited;
      delete chk.dataset.editedVal;
      var pgtoAtual = document.getElementById('propostaPagamento').value;
      var precoAtual = _PROPOSTA_PRECOS[nome][pgtoAtual];
      precoInput.value = (precoAtual !== null) ? formatVal(precoAtual) : formatVal(0);
      restoreBtn.style.display = 'none';
      _propostaRecalcular();
    });

    /* Subtotal = qty × preco unitario (somente leitura, atualizado por
       _propostaRecalcular). Caixa em destaque na cor accent. */
    var subtotalSpan = document.createElement('span');
    subtotalSpan.id = 'propsubtotal_' + nome;
    subtotalSpan.title = 'Subtotal (quantidade × preco)';
    subtotalSpan.textContent = formatVal(indisponivel ? 0 : preco);
    subtotalSpan.style.cssText = 'width:122px;flex-shrink:0;background:rgba(200,240,90,.08);border:1px solid rgba(200,240,90,.35);border-radius:var(--radius-sm);padding:4px 8px;color:var(--accent);font-size:12px;font-weight:800;text-align:right;font-family:DM Mono,monospace;line-height:1.4;white-space:nowrap;overflow:visible;';

    label.appendChild(nomeSpan);
    label.appendChild(qtyInput);
    label.appendChild(precoInput);
    label.appendChild(subtotalSpan);
    label.appendChild(restoreBtn);
    row.appendChild(chk);
    row.appendChild(label);
    row.addEventListener('click', function(e){
      if(e.target === chk || e.target === precoInput || e.target === qtyInput || indisponivel) return;
      chk.checked = !chk.checked;
      _propostaRecalcular();
    });
    container.appendChild(row);
  });

}

function _propostaSelecionarTodos(){
  var container = document.getElementById('propostaTreinamentos');
  if(!container) return;
  var chks = container.querySelectorAll('input[type=checkbox]:not(:disabled)');
  var todos = Array.from(chks).every(function(c){ return c.checked; });
  chks.forEach(function(c){ c.checked = !todos; });
  var btn = document.getElementById('btnPropostaSelecionarTodos');
  if(btn) btn.textContent = todos ? 'Selecionar todos' : 'Desmarcar todos';
  _propostaRecalcular();
}

/* Botão GGB com TOGGLE: 1º clique marca exclusivamente os 8 treinamentos do
   pacote GGB (desmarca o resto); clicar de novo desmarca os 8.
   Usa o mesmo estado das modalidades (window._beltAtivo) para que os 3 botões
   (Elite/Legacy/GGB) se excluam mutuamente e reflitam o destaque ativo. */
function _propostaSelecionarGGB(){
  var container = document.getElementById('propostaTreinamentos');
  if(!container) return;
  var jaAtivo = (window._beltAtivo === 'ggb');
  container.querySelectorAll('input[type=checkbox]').forEach(function(chk){
    var nome = chk.id.replace('prop_','');
    chk.checked = jaAtivo ? false : (_PROPOSTA_GGB.indexOf(nome) !== -1);
  });
  window._beltAtivo = jaAtivo ? null : 'ggb';
  window._beltAtivoCliente = null;
  window._beltMarcados = jaAtivo ? [] : _PROPOSTA_GGB.slice();
  if(typeof window._beltAtualizarBotoes === 'function') window._beltAtualizarBotoes(window._beltAtivo);
  _propostaRecalcular();
}
window._propostaSelecionarGGB = _propostaSelecionarGGB;

function _propostaAtualizar(){
  var sel = document.getElementById('propostaCliente');
  var inpMan = document.getElementById('propostaClienteManual');
  var cliente = sel ? sel.value : '';
  /* Alterna input manual quando "__manual__" é escolhido */
  if(inpMan){
    if(cliente === '__manual__'){
      inpMan.style.display = '';
      setTimeout(function(){ inpMan.focus(); }, 50);
    } else {
      inpMan.style.display = 'none';
    }
  }
  /* Cliente efetivo: input manual se selecionou "__manual__", senão o select */
  var clienteFinal = '';
  if(cliente === '__manual__'){
    clienteFinal = inpMan ? inpMan.value.trim().toUpperCase() : '';
  } else if(cliente){
    clienteFinal = cliente;
  }
  var sub = document.getElementById('propostaSub');
  if(clienteFinal && sub) sub.textContent = 'Cliente: ' + clienteFinal;
  else if(sub) sub.textContent = 'Selecione o cliente e os treinamentos';
}

/* Helper canônico — usar onde quer que se leia o cliente da proposta.
   Sempre retorna em CAIXA ALTA para uniformidade em preview/PDF/header. */
function _propostaClienteAtual(){
  var sel = document.getElementById('propostaCliente');
  var inpMan = document.getElementById('propostaClienteManual');
  var v = sel ? sel.value : '';
  if(v === '__manual__') return inpMan ? inpMan.value.trim().toUpperCase() : '';
  return v ? String(v).toUpperCase() : '';
}
window._propostaClienteAtual = _propostaClienteAtual;

/* Consultor: alterna input manual + dispara re-render do preview */
function _propostaConsultorAtualizar(){
  var sel = document.getElementById('propostaConsultor');
  var inpMan = document.getElementById('propostaConsultorManual');
  var v = sel ? sel.value : '';
  if(inpMan){
    if(v === '__manual__'){
      inpMan.style.display = '';
      setTimeout(function(){ inpMan.focus(); }, 50);
    } else {
      inpMan.style.display = 'none';
    }
  }
  /* Mantém o display oculto sincronizado para qualquer leitura legada */
  var disp = document.getElementById('propostaConsultorDisplay');
  if(disp) disp.textContent = _propostaConsultorAtual() || '—';
  /* Re-render do preview se já aberto */
  if(window._propostaPreviewAtivo){
    clearTimeout(window._propostaPreviewTimer);
    window._propostaPreviewTimer = setTimeout(function(){
      try { _propostaPreview(); } catch(e){}
    }, 150);
  }
}
window._propostaConsultorAtualizar = _propostaConsultorAtualizar;

/* Helper canônico — usar onde quer que se leia o consultor da proposta */
function _propostaConsultorAtual(){
  var sel = document.getElementById('propostaConsultor');
  var inpMan = document.getElementById('propostaConsultorManual');
  var v = sel ? sel.value : '';
  if(v === '__manual__') return inpMan ? inpMan.value.trim().toUpperCase() : '';
  if(v) return v;
  /* Fallback: legado (caso o select não exista por algum motivo) */
  var disp = document.getElementById('propostaConsultorDisplay');
  return disp ? (disp.textContent||'').trim() : '';
}
window._propostaConsultorAtual = _propostaConsultorAtual;

/* Quando a forma de pagamento eh parcelada (12x), o preco unitario exibido
   ja eh a parcela. Para mostrar o valor CHEIO (subtotal integral) e somar
   no total geral, multiplicamos pelo numero de parcelas. */
function _propostaParcelas(pagamento){
  return (pagamento === 'parcelado' || pagamento === 'parcelado_desc') ? 12 : 1;
}

function _propostaRecalcular(){
  var pagamento = document.getElementById('propostaPagamento').value;
  var parcelas = _propostaParcelas(pagamento);
  // Atualizar precos nos inputs respeitando edicoes manuais.
  // - Se o usuario ja editou (chk.dataset.edited), nunca sobrescreve.
  // - Se ha preco de tabela, atualiza para o novo valor da forma de pagamento.
  // - Se nao ha preco de tabela, deixa o input editavel em 0,00 (ou o que o
  //   usuario tiver digitado).
  /* Input azul "val unit" mostra (preço unit × qty). Se o usuário
     editou manualmente, usa o val unit customizado (chk.dataset.editedVal)
     em vez do preço da tabela — qty continua multiplicando normalmente. */
  _PROPOSTA_TREINAMENTOS.forEach(function(nome){
    var inp = document.getElementById('propval_' + nome);
    var chk = document.getElementById('prop_' + nome);
    var qtyInp = document.getElementById('propqty_' + nome);
    if(!inp || !chk) return;
    var qty = qtyInp ? Math.max(1, parseInt(qtyInp.value) || 1) : 1;
    if(chk.dataset.edited){
      /* val unit customizado pelo usuário × qty atual */
      var editedVal = parseFloat(chk.dataset.editedVal || '0') || 0;
      inp.value = formatVal(editedVal * qty);
      return;
    }
    var preco = _PROPOSTA_PRECOS[nome][pagamento];
    if(preco !== null){
      inp.value = formatVal(preco * qty);
    } else {
      /* sem preco de tabela e usuario ainda nao digitou — mantem 0,00 */
      if(!inp.value || inp.value === '—') inp.value = formatVal(0);
    }
  });

  // Subtotal verde = input × parcelas (valor CHEIO do investimento).
  // Como o input já contém val × qty, só multiplicamos por parcelas.
  _PROPOSTA_TREINAMENTOS.forEach(function(nome){
    var inp = document.getElementById('propval_' + nome);
    var sub = document.getElementById('propsubtotal_' + nome);
    if(!sub) return;
    var valLinha = inp ? parseVal(inp.value) : 0;
    sub.textContent = formatVal(valLinha * parcelas);
  });

  // Total = soma(input × parcelas) — valor cheio do investimento.
  var total = 0;
  var totalQty = 0;
  var selecionados = [];
  var container = document.getElementById('propostaTreinamentos');
  if(!container) return;
  container.querySelectorAll('input[type=checkbox]').forEach(function(chk){
    if(!chk.checked) return;
    var nome = chk.id.replace('prop_', '');
    var inp = document.getElementById('propval_' + nome);
    var qtyInp = document.getElementById('propqty_' + nome);
    var valLinha = inp ? parseVal(inp.value) : 0;
    var qty = qtyInp ? Math.max(1, parseInt(qtyInp.value) || 1) : 1;
    total += valLinha * parcelas;
    totalQty += qty;
    selecionados.push({nome: nome, val: valLinha, qty: qty});
  });

  document.getElementById('propostaTotal').textContent = formatVal(total);
  var detalhe = document.getElementById('propostaTotalDetalhe');
  if(detalhe){
    if(!selecionados.length){
      detalhe.textContent = 'Nenhum treinamento selecionado';
    } else {
      var base = totalQty + ' treinamento' + (totalQty > 1 ? 's' : '') + ' · ' + _PROPOSTA_LABELS[pagamento];
      /* Em parcelado, mostra ao lado a parcela mensal (= total cheio / 12). */
      if(parcelas > 1){
        base += ' · 12× ' + formatVal(total / parcelas);
      }
      detalhe.textContent = base;
    }
  }

  // PREVIEW EM TEMPO REAL — se já está aberto, re-renderiza com debounce
  if(window._propostaPreviewAtivo && selecionados.length > 0){
    clearTimeout(window._propostaPreviewTimer);
    window._propostaPreviewTimer = setTimeout(function(){
      try { _propostaPreview(); } catch(e){}
    }, 150);
  }
}

/* _propostaPreview() — delega ao gerador jsPDF em modo preview pra
   garantir preview = impresso 1:1. Inclui DEBOUNCE de 220ms pra não
   regenerar o PDF a cada milimetro dos sliders (gerar PDF custa CPU). */
function _propostaPreview(){
  window._propostaPreviewAtivo = true;
  if(window._propostaPreviewTimer) clearTimeout(window._propostaPreviewTimer);
  window._propostaPreviewTimer = setTimeout(function(){
    console.log('[_propostaPreview] disparando gerarPropostaPDF("preview")...');
    try { gerarPropostaPDF("preview"); }
    catch(e){ console.error("[_propostaPreview] ERRO:", e); }
  }, 220);
}

/* ─── Barra de zoom flutuante do preview ───
   Mantém o nível atual em window._propostaZoomNivel. Aceita:
   'fith' (padrão, encaixa pela largura), 'fit' (página inteira),
   '100' (tamanho real), 'in' (+25%), 'out' (-25%) ou um número (%).
   Re-aplica o zoom no iframe sem regerar o PDF. */
window._propostaZoomNivel = 'fith';

function _propostaZoomHash(){
  var n = window._propostaZoomNivel || 'fith';
  if(n === 'fith') return 'view=FitH&zoom=page-width';
  if(n === 'fit')  return 'view=Fit&zoom=page-fit';
  if(typeof n === 'number' || /^\d+$/.test(String(n))){
    return 'zoom=' + n;
  }
  return 'view=FitH&zoom=page-width';
}

window._propostaZoom = function(acao){
  var nivel = window._propostaZoomNivel;
  function toNum(v){
    if(v==='fith') return 100;
    if(v==='fit')  return 75;
    if(typeof v === 'number') return v;
    return parseInt(v,10) || 100;
  }
  if(acao === 'in')   nivel = Math.min(400, toNum(nivel) + 25);
  else if(acao === 'out') nivel = Math.max(25, toNum(nivel) - 25);
  else if(acao === 'fith') nivel = 'fith';
  else if(acao === 'fit')  nivel = 'fit';
  else if(acao === '100')  nivel = 100;
  else if(typeof acao === 'number') nivel = acao;

  window._propostaZoomNivel = nivel;

  /* Atualiza display do label */
  var lbl = document.getElementById('propZoomVal');
  if(lbl){
    if(nivel === 'fith') lbl.textContent = 'Largura';
    else if(nivel === 'fit')  lbl.textContent = 'Página';
    else lbl.textContent = nivel + '%';
  }
  /* Sincroniza o slider de zoom em real-time */
  var slider = document.getElementById('propZoomSlider');
  if(slider){
    var n = toNum(nivel);
    if(parseInt(slider.value,10) !== n) slider.value = n;
  }
  /* Marca botão ativo */
  ['propZoomFitH','propZoomFit','propZoom100'].forEach(function(id){
    var b = document.getElementById(id); if(b) b.classList.remove('on');
  });
  var ativo = nivel === 'fith' ? 'propZoomFitH' : nivel === 'fit' ? 'propZoomFit' : (nivel === 100 ? 'propZoom100' : null);
  if(ativo){ var ba = document.getElementById(ativo); if(ba) ba.classList.add('on'); }

  /* Re-aplica no iframe (sem regerar o PDF — só muda o hash) */
  var frame = document.getElementById('propostaPreviewFrame');
  if(frame && frame.src && frame.src.indexOf('blob:') === 0){
    var base = frame.src.split('#')[0];
    frame.src = base + '#toolbar=0&navpanes=0&' + _propostaZoomHash();
  }
};

/* gerarPropostaPDF(modo)
   modo = 'save'    (default) → doc.save() — baixa o arquivo
   modo = 'preview'           → renderiza no #propostaPreviewFrame via blob URL
   Em ambos os modos é gerado EXATAMENTE o mesmo PDF (mesmo código jsPDF),
   garantindo que preview = impresso 1:1. */
function gerarPropostaPDF(modo, loteCtx, loteDoc){
  modo = modo || 'save';
  var _emLote = !!loteCtx;                       // geração em lote (dados por parâmetro)
  var _ehSave = (modo === 'save') && !_emLote;
  var _ehPreview = (modo === 'preview') && !_emLote;
  var cliente = _emLote ? loteCtx.cliente : _propostaClienteAtual();
  if(!cliente){
    if(_ehSave) _showToast('⚠️ Selecione um cliente.','var(--amber)');
    return;
  }

  var pagamento = _emLote ? loteCtx.pagamento : document.getElementById('propostaPagamento').value;
  var pagLabel = _emLote ? loteCtx.pagLabel : _PROPOSTA_LABELS[pagamento];
  var selecionados;
  if(_emLote){
    selecionados = loteCtx.selecionados || [];
  } else {
    selecionados = [];
    var container = document.getElementById('propostaTreinamentos');
    container.querySelectorAll('input[type=checkbox]').forEach(function(chk){
      if(!chk.checked) return;
      var nome = chk.id.replace('prop_', '');
      var inp = document.getElementById('propval_' + nome);
      var qtyInp = document.getElementById('propqty_' + nome);
      var val = inp ? parseVal(inp.value) : 0;
      var qty = qtyInp ? Math.max(1, parseInt(qtyInp.value) || 1) : 1;
      selecionados.push({nome: nome, val: val, qty: qty});
    });
  }

  if(!selecionados.length){
    if(_ehSave) _showToast('⚠️ Selecione ao menos um treinamento.','var(--amber)');
    return;
  }
  if(typeof window.jspdf === 'undefined'){
    if(typeof window._ensureJsPDF==='function'){
      if(_ehSave) _showToast('⏳ Preparando gerador de PDF (primeira vez)…','var(--muted)');
      window._ensureJsPDF().then(function(){ gerarPropostaPDF(modo, loteCtx, loteDoc); }).catch(function(){
        if(_ehSave) _showToast('❌ Erro ao carregar jsPDF.','var(--red)');
      });
      return;
    }
    if(_ehSave) _showToast('❌ jsPDF não carregado.','var(--red)');return;
  }

  /* INVESTIMENTO FINAL = soma(input). O input já vem como val × qty
     do modal, então não multiplicamos por qty de novo. Em 12x mostra
     a parcela mensal acumulada (NÃO o cheio — o modal mostra o cheio). */
  var parcelas = _propostaParcelas(pagamento);
  var total = _emLote
    ? (loteCtx.total != null ? loteCtx.total : selecionados.reduce(function(a,s){return a + (s.val||0);},0))
    : selecionados.reduce(function(a,s){return a + s.val;},0);
  /* ─── Leitura dos ajustes visuais do MODAL (em tempo real) ───
     Defaults vêm do painel de controle preview-proposta-painel-controle.html
     última config validada: mg=12, esc=0.9, h1=19, h2=9, body=12, tbl=10,
     padCel=1, gap=7, cardH=13. */
  function _getN(id, def){
    var el = document.getElementById(id);
    if(!el) return def;
    var v = parseFloat(el.value);
    return isNaN(v) ? def : v;
  }
  var _mgUser  = _getN('propMargem', 12);
  var _escUser = _getN('propEscala', 0.9);
  var _h1User  = _getN('propH1', 19);
  var _h2User  = _getN('propH2', 9);
  var _bodyUser= _getN('propBody', 11);
  var _tblUser = _getN('propFonte', 10);   /* slider original "Fonte" agora controla a tabela */
  var _padUser = _getN('propPadding', 1);
  var _gapUser = _getN('propGap', 7);
  var _cardHUser = _getN('propCardH', 13);
  var _corH  = document.getElementById('propCorHeader') ? document.getElementById('propCorHeader').value || '#0f0f0f' : '#0f0f0f';
  var _corA  = document.getElementById('propCorAccent') ? document.getElementById('propCorAccent').value || '#c8f05a' : '#c8f05a';
  var _valid = document.getElementById('propValidade') ? document.getElementById('propValidade').value || '30' : '30';
  var _consultor = _emLote ? (loteCtx.consultor || '') : _propostaConsultorAtual();

  function _hexRgb(hex){
    var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return [r,g,b];
  }
  var rgbH = _hexRgb(_corH);
  var rgbA = _hexRgb(_corA);

  /* ═══════════════════════════════════════════════
     GERADOR DE PDF — Executive Financial (Preview 05)
     Reescrito do zero. Sem function declarations aninhadas
     (evita problemas em strict mode com hoisting de bloco).
  ═══════════════════════════════════════════════ */
  var doc = loteDoc || new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  if(_emLote && !loteCtx.isFirst){ doc.addPage(); }   // cada cliente começa em nova página
  var W = 210, H = 297, mg = _mgUser;
  /* Constantes calculadas a partir dos sliders do modal × escala global. */
  var ESC = _escUser;
  var SZ_H1     = _h1User * ESC;
  var SZ_H2     = _h2User * ESC;
  var SZ_BODY   = _bodyUser * ESC;
  var SZ_TBL    = _tblUser * ESC;
  var PAD_TBL   = _padUser * ESC;
  var GAP_SEC   = _gapUser * ESC;
  var ALT_CARD  = _cardHUser * ESC;

  var COR_NAVY     = [10, 31, 61];
  var COR_OURO     = [245, 180, 0];
  var COR_OURO_LT  = [255, 251, 232];
  var COR_CINZA    = [102, 102, 102];
  var COR_HAIRLINE = [229, 231, 235];
  var COR_ZEBRA    = [248, 250, 252];
  var COR_VERDE_BG = [220, 252, 231];
  var COR_VERDE_DK = [10, 128, 67];
  var COR_AZUL     = [29, 78, 216];

  var _dataAgora = (function(){
    var d = new Date();
    var dd = String(d.getDate()).padStart(2,'0');
    var mm = String(d.getMonth()+1).padStart(2,'0');
    return dd + ' · ' + mm + ' · ' + d.getFullYear();
  })();
  var _docRef = '2026/PROP/'+String(Date.now()).slice(-6);

  // Data de término da validade = emissão + N dias (mesmo formato da emissão)
  var _validNum = parseInt(_valid, 10);
  if(isNaN(_validNum) || _validNum < 1) _validNum = 30;
  var _dataFim = (function(){
    var d = new Date();
    d.setDate(d.getDate() + _validNum);
    var dd = String(d.getDate()).padStart(2,'0');
    var mm = String(d.getMonth()+1).padStart(2,'0');
    return dd + ' · ' + mm + ' · ' + d.getFullYear();
  })();

  // ── FAIXA OURO TOPO (5px) ────────────────────────
  doc.setFillColor(COR_OURO[0], COR_OURO[1], COR_OURO[2]);
  doc.rect(0, 0, W, 2, 'F');

  // ── HEADER ────────────────────────────────────────
  // "FEBRACIS · PROPOSTA COMERCIAL EXECUTIVA" letterspaced
  doc.setFont('helvetica','bold');
  doc.setFontSize(7.5);
  doc.setTextColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
  doc.text('F E B R A C I S    ·    P R O P O S T A   C O M E R C I A L   E X E C U T I V A', mg, 12);
  /* "DOC 2026/PROP/XXX" removido do header a pedido do usuário.
     _docRef continua sendo gerado pois é usado no rodapé (linha 1002). */

  // Título grande
  doc.setFont('helvetica','normal');
  doc.setFontSize(SZ_H1);
  doc.setTextColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
  doc.text('PROPOSTA', mg, 26);
  doc.setFont('helvetica','bold');
  doc.setTextColor(COR_OURO[0], COR_OURO[1], COR_OURO[2]);
  doc.text('COMERCIAL', mg, 33);

  // Emissão + término da validade (direita)
  doc.setFont('helvetica','bold');
  doc.setFontSize(6.5);
  doc.setTextColor(COR_CINZA[0], COR_CINZA[1], COR_CINZA[2]);
  doc.text('EMISSÃO', W - mg, 21, {align:'right'});
  doc.setFontSize(SZ_BODY);
  doc.setTextColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
  doc.text(_dataAgora, W - mg, 25, {align:'right'});
  doc.setFontSize(6.5);
  doc.setTextColor(COR_CINZA[0], COR_CINZA[1], COR_CINZA[2]);
  doc.text('VÁLIDA ATÉ · ' + _validNum + ' DIAS', W - mg, 29, {align:'right'});
  doc.setFontSize(SZ_BODY);
  doc.setTextColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
  doc.text(_dataFim, W - mg, 33, {align:'right'});

  // Linha divisória do header
  doc.setDrawColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
  doc.setLineWidth(0.4);
  doc.line(mg, 37, W - mg, 37);

  var y = 42;
  var maxW = W - mg*2;

  // ── DADOS-ROW (3 colunas com border) ──────────────
  /* Controles do painel: dadosH=8mm, dadosLbl=6pt, dadosVal=9pt × ESCALA */
  var DADOS_H_USER = _getN('propDadosH', 8) * ESC;
  var DADOS_LBL_USER = _getN('propDadosLbl', 6);
  var DADOS_VAL_USER = _getN('propDadosVal', 9);
  var colW = maxW / 3;
  var dadosH = DADOS_H_USER;
  /* Posições Y relativas à altura da faixa (35% pro label, 78% pro valor) */
  var yLbl = y + dadosH * 0.35;
  var yVal = y + dadosH * 0.78;
  doc.setDrawColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
  doc.setLineWidth(0.3);
  doc.rect(mg, y, maxW, dadosH, 'S');
  doc.line(mg + colW, y, mg + colW, y + dadosH);
  doc.line(mg + colW*2, y, mg + colW*2, y + dadosH);

  var _drawDado = function(x, label, valor, destaque){
    if(destaque){
      doc.setFillColor(COR_VERDE_BG[0], COR_VERDE_BG[1], COR_VERDE_BG[2]);
      doc.rect(x, y, colW, dadosH, 'F');
    }
    doc.setFont('helvetica','bold');
    doc.setFontSize(DADOS_LBL_USER);
    if(destaque){
      doc.setTextColor(COR_VERDE_DK[0], COR_VERDE_DK[1], COR_VERDE_DK[2]);
    } else {
      doc.setTextColor(COR_CINZA[0], COR_CINZA[1], COR_CINZA[2]);
    }
    doc.text(String(label).toUpperCase(), x + 2.5, yLbl);
    doc.setFont('times','bold');
    doc.setFontSize(DADOS_VAL_USER);
    if(destaque){
      doc.setTextColor(COR_VERDE_DK[0], COR_VERDE_DK[1], COR_VERDE_DK[2]);
    } else {
      doc.setTextColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
    }
    var maxTextW = colW - 5;
    var texto = String(valor||'—');
    while(texto.length > 4 && doc.getTextWidth(texto+'…') > maxTextW){ texto = texto.slice(0,-1); }
    if(texto !== String(valor||'—')) texto += '…';
    doc.text(texto, x + 2.5, yVal);
  };
  _drawDado(mg,           'Cliente',      cliente);
  _drawDado(mg + colW,    'Especialista', _consultor);
  _drawDado(mg + colW*2,  'Pagamento',    pagLabel, true);
  y += dadosH + GAP_SEC;

  // ── HELPERS DE SEÇÃO (function expressions — compatíveis com strict mode) ──
  var _quebraPagina = function(nec){
    if(y + nec > H - 30){
      doc.addPage();
      doc.setFillColor(COR_OURO[0], COR_OURO[1], COR_OURO[2]);
      doc.rect(0, 0, W, 2, 'F');
      y = 18;
    }
  };
  var _h2 = function(numeroRomano, titulo){
    _quebraPagina(9);
    doc.setFont('helvetica','bold');
    doc.setFontSize(SZ_H2);
    doc.setTextColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
    doc.text((numeroRomano + ' · ' + titulo).toUpperCase(), mg, y);
    y += 1.5;
    doc.setDrawColor(COR_OURO[0], COR_OURO[1], COR_OURO[2]);
    doc.setLineWidth(0.6);
    doc.line(mg, y, W - mg, y);
    y += 4;
  };

  // ── SEÇÃO I · Introdução & Reconhecimento (motivacional) ──
  _h2('I', 'Introdução & Reconhecimento');

  // Box motivacional · Estilo 26 (Fundo Navy + texto bege/dourado italic Times)
  var motivX = mg + 5;
  var motivMaxW = maxW - 10;
  /* Texto da Seção I: no lote vem por cliente; individual usa Elite/Legacy ativo ou padrão. */
  var _txtIntro = _emLote
    ? (loteCtx.txtIntro || _PROPOSTA_TEXTO)
    : ((typeof window._beltTextoIntro === 'function' && window._beltTextoIntro()) || _PROPOSTA_TEXTO);
  var motivLines = doc.splitTextToSize(_txtIntro.replace(/\n/g,' '), motivMaxW);
  var motivH = motivLines.length * 3.6 + 5;
  _quebraPagina(motivH + 3);
  /* Fundo navy escura sólida */
  doc.setFillColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
  doc.rect(mg, y, maxW, motivH, 'F');
  /* Borda lateral dourada esquerda */
  doc.setFillColor(COR_OURO[0], COR_OURO[1], COR_OURO[2]);
  doc.rect(mg, y, 1.6, motivH, 'F');
  /* Texto italic Times em bege/dourado claro */
  doc.setFont('times','italic');
  doc.setFontSize(SZ_BODY);
  doc.setTextColor(245, 225, 170);
  var motivY = y + 3.5;
  /* Texto JUSTIFICADO no padrão Word, com refinamento na distribuição:
     - Para cada linha (exceto a última), calcula o gap entre palavras
       baseado no espaço disponível.
     - O `splitTextToSize` quebra linhas pra caber em motivMaxW; aqui
       distribuímos pra ocupar EXATAMENTE motivMaxW.
     - Para evitar linhas com gaps muito grandes, recalcula o split
       com largura ligeiramente menor (98%) — assim cada linha tem
       sempre uma "folga" de ~2% pra distribuir uniformemente, evitando
       que algumas fiquem quase coladas e outras com buracos enormes. */
  var motivLinesRedone = doc.splitTextToSize(_txtIntro.replace(/\n/g,' '), motivMaxW * 0.98);
  /* Se o re-split deu o mesmo número de linhas, usa esse (mais bem
     distribuído); senão, mantém o original pra não estourar a faixa. */
  if(motivLinesRedone.length === motivLines.length) motivLines = motivLinesRedone;

  var spaceW = doc.getTextWidth(' ') || (SZ_BODY * 0.25);
  motivLines.forEach(function(line, i){
    var isUltima = (i === motivLines.length - 1);
    var palavras = String(line).trim().split(/\s+/).filter(Boolean);

    if(isUltima || palavras.length < 2){
      doc.text(line, motivX, motivY);
      motivY += 3.6;
      return;
    }

    var larguraPalavras = 0;
    palavras.forEach(function(w){ larguraPalavras += doc.getTextWidth(w); });

    var nGaps = palavras.length - 1;
    var espacoEntre = (motivMaxW - larguraPalavras) / nGaps;
    if(espacoEntre < spaceW) espacoEntre = spaceW;

    var curX = motivX;
    palavras.forEach(function(w){
      doc.text(w, curX, motivY);
      curX += doc.getTextWidth(w) + espacoEntre;
    });
    motivY += 3.6;
  });
  y += motivH + GAP_SEC;

  // ── SEÇÃO II · Investimento Consolidado (autoTable) ──
  _h2('II', 'Investimento Consolidado');
  var bodyRows = selecionados.map(function(s, i){
    /* Descrição = "CÓDIGO - Nome Completo" — busca o nome em _PRODUTOS_PROPOSTA.
       Se não houver nome cadastrado, mostra só o código. */
    var meta = _PRODUTOS_PROPOSTA[s.nome];
    var nomeCompleto = (meta && meta.nome) ? meta.nome : '';
    var descricao = nomeCompleto ? (s.nome + ' - ' + nomeCompleto) : s.nome;
    var qty = s.qty || 1;
    /* VALOR = input (= val × qty, mesmo valor do "val unit" azul do modal). */
    return ['L' + String(i+1).padStart(2,'0'), descricao, String(qty), pagLabel, formatVal(s.val)];
  });
  var _parcFinalPdf = (pagamento === 'parcelado' || pagamento === 'parcelado_desc') ? '12x' : '';
  bodyRows.push(['—', 'INVESTIMENTO FINAL', '', _parcFinalPdf, formatVal(total)]);

  /* Recalcula largura das colunas pra ocupar maxW totalmente
     5 colunas: LINHA · DESCRIÇÃO · UNIDADE · PAGAMENTO · VALOR */
  var _wTab1 = 14, _wTabU = 18, _wTab3 = 30, _wTab4 = 26;
  var _wTab2 = maxW - _wTab1 - _wTabU - _wTab3 - _wTab4;
  doc.autoTable({
    startY: y,
    head: [['LINHA', 'DESCRIÇÃO', 'UNIDADE', 'PAGAMENTO', 'VALOR (R$)']],
    body: bodyRows,
    margin: {left: mg, right: mg},
    styles: {
      fontSize: SZ_TBL,
      cellPadding: PAD_TBL,
      lineColor: COR_HAIRLINE,
      lineWidth: 0.15,
      textColor: [40,40,40]
    },
    headStyles: {
      fillColor: COR_NAVY,
      textColor: [255,255,255],
      fontStyle: 'bold',
      fontSize: SZ_TBL * 0.78,
      cellPadding: PAD_TBL * 1.5,
      halign: 'center'
    },
    columnStyles: {
      0: {cellWidth: _wTab1, halign: 'center'},
      1: {cellWidth: _wTab2, halign: 'left',   fontStyle: 'bold'},
      2: {cellWidth: _wTabU, halign: 'center', fontStyle: 'bold'},
      3: {cellWidth: _wTab3, halign: 'center'},
      4: {cellWidth: _wTab4, halign: 'center', fontStyle: 'bold', font: 'times'}
    },
    alternateRowStyles: {fillColor: COR_ZEBRA},
    didParseCell: function(d){
      var isFinal = d.row.index === bodyRows.length - 1;
      if(isFinal){
        d.cell.styles.fillColor = COR_VERDE_BG;
        d.cell.styles.textColor = COR_VERDE_DK;
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fontSize = (d.column.index === 4) ? SZ_TBL * 1.25 : SZ_TBL;
        d.cell.styles.cellPadding = PAD_TBL * 1.8;
      }
    }
  });
  y = doc.lastAutoTable.finalY + GAP_SEC;

  // ── NOTA DE EXCEÇÃO ────────────────────────────────
  var notaTxt = 'Nota de Exceção: bônus de "Desconto de Contingência de Diretoria" aplicado em caráter excepcional. Validade fixa de ' + _valid + ' dias a partir da emissão.';
  var notaLines = doc.splitTextToSize(notaTxt, maxW - 10);
  var notaH = notaLines.length * 3.2 + 4;
  _quebraPagina(notaH + 3);
  doc.setFillColor(COR_OURO_LT[0], COR_OURO_LT[1], COR_OURO_LT[2]);
  doc.rect(mg, y, maxW, notaH, 'F');
  doc.setFillColor(COR_OURO[0], COR_OURO[1], COR_OURO[2]);
  doc.rect(mg, y, 1.6, notaH, 'F');
  doc.setFont('helvetica','normal');
  doc.setFontSize(SZ_BODY * 0.85);
  doc.setTextColor(60, 60, 60);
  var notaY = y + 3;
  notaLines.forEach(function(line){
    doc.text(line, mg + 5, notaY);
    notaY += 3.2;
  });
  y += notaH + GAP_SEC;

  // ── SEÇÃO III · Formas de Pagamento (cards) ──
  /* O título III sempre sai. O checkbox "Mostrar cards de forma de pagamento"
     liga/desliga os cards CARTÃO / PIX; desmarcado, sobra o espaço em branco
     (mesma altura) para escrever à mão. No lote/preview sem modal, o default é mostrar. */
  var _chkFP = document.getElementById('propMostrarFormasPgto');
  var _mostrarFormasPgto = _chkFP ? _chkFP.checked : true;
  _h2('III', 'Formas de Pagamento');
  var fpH = ALT_CARD;
  var fpGap = 4;
  var fpW = (maxW - fpGap) / 2;
  _quebraPagina(fpH + 3);
  if(_mostrarFormasPgto){
    // Card 1: Cartão
    doc.setFillColor(240, 245, 251);
    doc.rect(mg, y, fpW, fpH, 'F');
    doc.setFillColor(COR_AZUL[0], COR_AZUL[1], COR_AZUL[2]);
    doc.rect(mg, y, 1.5, fpH, 'F');
    doc.setFont('helvetica','bold');
    doc.setFontSize(SZ_BODY * 0.85);
    doc.setTextColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
    doc.text('CARTÃO DE CRÉDITO', mg + 4, y + fpH * 0.4);
    doc.setFont('helvetica','normal');
    doc.setFontSize(SZ_BODY);
    doc.setTextColor(40, 40, 40);
    doc.text('Em até 12x', mg + 4, y + fpH * 0.78);
    // Card 2: PIX
    var xf2 = mg + fpW + fpGap;
    doc.setFillColor(240, 245, 251);
    doc.rect(xf2, y, fpW, fpH, 'F');
    doc.setFillColor(COR_AZUL[0], COR_AZUL[1], COR_AZUL[2]);
    doc.rect(xf2, y, 1.5, fpH, 'F');
    doc.setFont('helvetica','bold');
    doc.setFontSize(SZ_BODY * 0.85);
    doc.setTextColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
    doc.text('PIX À VISTA', xf2 + 4, y + fpH * 0.4);
    doc.setFont('helvetica','normal');
    doc.setFontSize(SZ_BODY);
    doc.setTextColor(40, 40, 40);
    doc.text('Com prioridade de acesso', xf2 + 4, y + fpH * 0.78);
  }
  // Avança o mesmo espaço em ambos os casos (cards ou branco para escrita)
  y += fpH + GAP_SEC;

  // ── ASSINATURAS DUPLAS ────────────────────────────
  _quebraPagina(22);
  var assinY = Math.max(y, H - 30);
  var assinW = (maxW - 10) / 2;
  doc.setDrawColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
  doc.setLineWidth(0.3);
  doc.line(mg, assinY, mg + assinW, assinY);
  doc.line(mg + assinW + 10, assinY, W - mg, assinY);
  doc.setFont('times','bold');
  doc.setFontSize(SZ_BODY * 1.05);
  doc.setTextColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
  doc.text(_consultor || '—', mg + 1, assinY + 4);
  doc.text(cliente || '—', mg + assinW + 11, assinY + 4);
  doc.setFont('helvetica','normal');
  doc.setFontSize(SZ_BODY * 0.75);
  doc.setTextColor(COR_CINZA[0], COR_CINZA[1], COR_CINZA[2]);
  doc.text('ESPECIALISTA FEBRACIS', mg + 1, assinY + 8);
  doc.text('ACEITE DO CLIENTE', mg + assinW + 11, assinY + 8);

  // ── RODAPÉ NAVY (no lote, só carimba quando for a última proposta) ──
  if(!_emLote || loteCtx.isLast){
    var totalPgs = doc.internal.getNumberOfPages();
    for(var pg = 1; pg <= totalPgs; pg++){
      doc.setPage(pg);
      doc.setFillColor(COR_NAVY[0], COR_NAVY[1], COR_NAVY[2]);
      doc.rect(0, H - 9, W, 9, 'F');
      doc.setFont('helvetica','bold');
      doc.setFontSize(6.5);
      doc.setTextColor(COR_OURO[0], COR_OURO[1], COR_OURO[2]);
      doc.text('FEBRACIS', mg, H - 3.5);
      doc.setFont('helvetica','normal');
      doc.setTextColor(170, 180, 200);
      doc.text('· DOC. ' + _docRef + ' · CONFIDENCIAL · USO INTERNO', mg + 14, H - 3.5);
      doc.text('PÁG. ' + pg + ' / ' + totalPgs, W - mg, H - 3.5, {align:'right'});
    }
  }

  /* No lote, devolve o doc compartilhado sem salvar/preview (salvo no fim pelo orquestrador). */
  if(_emLote){ return doc; }

  /* ── Ramificação final: save (baixa arquivo) ou preview (renderiza no iframe) ── */
  if(_ehPreview){
    try {
      var blobPv = doc.output('blob');
      var urlPv = URL.createObjectURL(blobPv);
      var framePv = document.getElementById('propostaPreviewFrame');
      var phPv = document.getElementById('propostaPreviewPlaceholder');
      if(framePv){
        /* Revoga blob URL anterior pra não vazar memória */
        if(framePv._lastBlobUrl){ try { URL.revokeObjectURL(framePv._lastBlobUrl); } catch(e){} }
        framePv._lastBlobUrl = urlPv;
        /* Limpa srcdoc antigo e seta src com PDF embutido */
        framePv.removeAttribute('srcdoc');
        /* Aplica o zoom atual (gerenciado pela barra de zoom flutuante).
           Default = FitH (encaixa pela largura, PDF aparece grande). */
        framePv.src = urlPv + '#toolbar=0&navpanes=0&' + _propostaZoomHash();
        /* Exibe a barra de zoom flutuante (escondida até o 1º render) */
        var zb = document.getElementById('propZoomBar');
        if(zb) zb.style.display = '';
        framePv.style.display = 'block';
        if(phPv) phPv.style.display = 'none';
      }
      window._propostaPreviewAtivo = true;
    } catch(ePv){ console.warn('[gerarPropostaPDF preview]', ePv); }
    return;
  }
  /* modo === 'save' */
  fecharPropostaModal();
  doc.save('Proposta Exclusiva '+String(cliente).toUpperCase()+'.pdf');
  _showToast('✅ Proposta gerada para '+cliente+'!','var(--accent)');
  if(typeof _addPendLog==='function') _addPendLog('Proposta gerada','Cliente: '+cliente+' · '+selecionados.length+' treinamentos','📋');
}

/* gerarPropostaLotePDF(lista, nomeArquivo)
   lista = [{cliente, consultor, pagamento, pagLabel, selecionados:[{nome,val,qty}], total, txtIntro}]
   Gera UM único PDF com todas as propostas (cada cliente em nova página),
   reutilizando o mesmo desenho da proposta individual. */
function gerarPropostaLotePDF(lista, nomeArquivo){
  if(!lista || !lista.length){ _showToast('⚠️ Nenhum cliente para gerar.','var(--amber)'); return; }
  if(typeof window.jspdf === 'undefined'){
    if(typeof window._ensureJsPDF==='function'){
      _showToast('⏳ Preparando gerador de PDF (primeira vez)…','var(--muted)');
      window._ensureJsPDF().then(function(){ gerarPropostaLotePDF(lista, nomeArquivo); }).catch(function(){
        _showToast('❌ Erro ao carregar jsPDF.','var(--red)');
      });
      return;
    }
    _showToast('❌ jsPDF não carregado.','var(--red)'); return;
  }
  var doc = null;
  lista.forEach(function(c, i){
    c.isFirst = (i === 0);
    c.isLast  = (i === lista.length - 1);
    doc = gerarPropostaPDF('save', c, doc);   // acumula no mesmo doc
  });
  if(doc){
    doc.save(nomeArquivo || 'Propostas em lote.pdf');
    _showToast('✅ '+lista.length+' proposta'+(lista.length!==1?'s':'')+' gerada'+(lista.length!==1?'s':'')+' em 1 PDF!','var(--accent)');
    if(typeof _addPendLog==='function') _addPendLog('Propostas em lote','('+lista.length+' clientes) em 1 PDF','📦');
  }
}
window.gerarPropostaLotePDF = gerarPropostaLotePDF;


/* ============================================================
   PROPOSTA PERSONALIZADA POR PRODUTO
============================================================ */

/* ============================================================
   ORDENAÇÃO DE CARDS POR DRAG-AND-DROP (ADM)
============================================================ */
var _PRODUTOS_ORDEM_KEY = 'ci_produtos_ordem';

/* Códigos OCULTOS da grade "Proposta Personalizada por Produto" (aba Produto).
   Permanecem disponíveis na aba Consultor → botão Proposta e na tabela de preços.
   Adicionados aqui sem autorização — mantidos no catálogo apenas para uso interno. */
var _PRODUTOS_OCULTOS_GRADE = [
  'CIS_PRESENCIAL_BRONZE',
  'CIS_PRESENCIAL_BLACK',
  'CIS_PRESENCIAL_DIAMOND',
  'CIS_PRESENCIAL_VIP'
];

function _getProdutosOrdem(){
  function _filtrarOcultos(arr){
    return arr.filter(function(cod){ return _PRODUTOS_OCULTOS_GRADE.indexOf(cod) === -1; });
  }
  try{
    var saved = localStorage.getItem(_PRODUTOS_ORDEM_KEY);
    if(saved){
      var arr = JSON.parse(saved);
      // Garantir que novos produtos sejam incluídos no final
      var todos = Object.keys(_PRODUTOS_PROPOSTA);
      todos.forEach(function(cod){ if(arr.indexOf(cod)===-1) arr.push(cod); });
      // Remover códigos que não existem mais
      arr = arr.filter(function(cod){ return _PRODUTOS_PROPOSTA[cod]; });
      return _filtrarOcultos(arr);
    }
  }catch(e){}
  return _filtrarOcultos(Object.keys(_PRODUTOS_PROPOSTA));
}

function _saveProdutosOrdem(arr){
  try{ localStorage.setItem(_PRODUTOS_ORDEM_KEY, JSON.stringify(arr)); }catch(e){}
}

function _isAdm(){
  var sess = typeof _getSessao === 'function' ? _getSessao() : null;
  return !sess || sess.perfil === 'adm';
}

var _dragSrcCod = null;


var _modoReordenar = false;

function _toggleReordenar(){
  _modoReordenar = true;
  document.getElementById('btnReordenar').style.display = 'none';
  document.getElementById('btnSalvarOrdem').style.display = 'inline-block';
  document.getElementById('btnResetOrdem').style.display = 'inline-block';
  var dica = document.getElementById('produtoPropDica');
  if(dica) dica.textContent = 'Arraste os cards para reordenar';
  _renderProdutoPropCardsOrdenado(true);
}

function _finalizarReordenar(){
  _modoReordenar = false;
  document.getElementById('btnReordenar').style.display = 'inline-block';
  document.getElementById('btnSalvarOrdem').style.display = 'none';
  document.getElementById('btnResetOrdem').style.display = 'none';
  var dica = document.getElementById('produtoPropDica');
  if(dica) dica.textContent = 'Clique no card para gerar';
  _renderProdutoPropCardsOrdenado(false);
}

function _resetOrdem(){
  if(!confirm('Resetar a ordem para o padrão original?')) return;
  try{ localStorage.removeItem('ci_produtos_ordem'); }catch(e){}
  _finalizarReordenar();
  _showToast('✅ Ordem resetada','var(--accent)');
}

function _buildCard(cod, dragMode){
  var p = _PRODUTOS_PROPOSTA[cod];
  var imgStyle = p.img
    ? (function(){
      var posMap={'JE':'center 45%','MAESTRIA':'center 50%','DP':'center 45%','CIS_GLOBAL':'center 20%','TEAM':'center 50%'};
      var pos=posMap[cod]||'center 5%';
      return 'background-image:url('+p.img+');background-size:115%;background-position:'+pos+';';
    })()
    : 'background:var(--surface2);';

  var dragAttrs = dragMode
    ? ' draggable="true" data-cod="'+cod+'"'
    : '';
  var hoverEvents = dragMode ? '' :
    ' onmouseover="this.style.transform=\'translateY(-5px) scale(1.02)\';this.style.boxShadow=\'0 12px 40px rgba(200,240,90,.18)\';this.style.borderColor=\'#c8f05a55\';this.querySelector(\'.gp-btn\').style.background=\'#c8f05a\';this.querySelector(\'.gp-btn\').style.color=\'#0a150a\'"'
    +' onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\';this.style.borderColor=\'#1a2a1a\';this.querySelector(\'.gp-btn\').style.background=\'#0a150a\';this.querySelector(\'.gp-btn\').style.color=\'#fff\'"';
  var clickAttr = dragMode ? '' : ' onclick="abrirPropProd(\''+cod+'\')"';
  var cursor = dragMode ? 'grab' : 'pointer';
  var extraStyle = dragMode ? 'opacity:.95;' : '';
  var dragHandle = dragMode
    ? '<div style="position:absolute;top:7px;right:7px;background:rgba(0,0,0,.5);border-radius:4px;padding:3px 5px;cursor:grab;" title="Arrastar para reordenar">'
      +'<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="3" cy="3" r="1.2" fill="#c8f05a"/><circle cx="9" cy="3" r="1.2" fill="#c8f05a"/><circle cx="3" cy="6" r="1.2" fill="#c8f05a"/><circle cx="9" cy="6" r="1.2" fill="#c8f05a"/><circle cx="3" cy="9" r="1.2" fill="#c8f05a"/><circle cx="9" cy="9" r="1.2" fill="#c8f05a"/></svg>'
      +'</div>'
    : '';

  return '<div'+dragAttrs+clickAttr+hoverEvents+' style="cursor:'+cursor+';border-radius:12px;overflow:hidden;border:1px solid #1a2a1a;background:#111;transition:transform .3s,box-shadow .3s,border-color .3s;'+extraStyle+'">'
    +'<div style="'+imgStyle+'height:140px;position:relative;overflow:hidden;">'
    +'<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.92) 0%,rgba(0,0,0,.3) 55%,transparent 100%);"></div>'
    +'<div style="position:absolute;top:7px;left:7px;background:rgba(200,240,90,.18);border:1px solid rgba(200,240,90,.35);border-radius:4px;font-size:8px;font-weight:700;color:#c8f05a;padding:2px 6px;letter-spacing:.06em;">'+cod+'</div>'
    + dragHandle
    +'<div style="position:absolute;bottom:10px;left:0;right:0;padding:0 10px;"><div style="font-size:11px;font-weight:700;color:#fff;line-height:1.3;">'+p.nome+'</div></div>'
    +'</div>'
    +'<div class="gp-btn" style="padding:7px 10px;background:#0a150a;text-align:center;font-size:10px;font-weight:600;color:#fff;letter-spacing:.04em;border-top:1px solid rgba(200,240,90,.15);transition:background .25s,color .25s;">'
    +(dragMode ? '<span style="color:rgba(200,240,90,.4);font-size:9px;">☰ segurar para mover</span>' : 'Gerar Proposta')
    +'</div>'
    +'</div>';
}

function _renderProdutoPropCardsOrdenado(dragMode){
  var grid = document.getElementById('produtoPropCards');
  if(!grid) return;
  var ordem = _getProdutosOrdem();
  grid.innerHTML = ordem.map(function(cod){ return _buildCard(cod, dragMode); }).join('');
  if(dragMode) _attachDragEvents(grid);
}

function _attachDragEvents(grid){
  var cards = grid.querySelectorAll('[draggable="true"]');
  cards.forEach(function(card){
    card.addEventListener('dragstart', function(e){
      _dragSrcCod = this.dataset.cod;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(function(){ card.style.opacity='0.4'; }, 0);
    });
    card.addEventListener('dragend', function(){
      card.style.opacity='';
      grid.querySelectorAll('[draggable="true"]').forEach(function(c){
        c.style.border='1px solid #1a2a1a';
        c.style.transform='';
      });
    });
    card.addEventListener('dragover', function(e){
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if(this.dataset.cod !== _dragSrcCod){
        this.style.border='1px solid #c8f05a88';
        this.style.transform='scale(1.03)';
      }
    });
    card.addEventListener('dragleave', function(){
      this.style.border='1px solid #1a2a1a';
      this.style.transform='';
    });
    card.addEventListener('drop', function(e){
      e.preventDefault();
      var destCod = this.dataset.cod;
      if(_dragSrcCod && destCod && _dragSrcCod !== destCod){
        var ordem = _getProdutosOrdem();
        var srcIdx = ordem.indexOf(_dragSrcCod);
        var dstIdx = ordem.indexOf(destCod);
        if(srcIdx > -1 && dstIdx > -1){
          ordem.splice(srcIdx, 1);
          ordem.splice(dstIdx, 0, _dragSrcCod);
          _saveProdutosOrdem(ordem);
          _renderProdutoPropCardsOrdenado(true);
          _showToast('✅ Ordem salva!','var(--accent)');
        }
      }
    });
  });
}

var _propProdAtual = null;

function _renderProdutoPropCards(){
  _renderProdutoPropCardsOrdenado(false);
  // Botão reordenar visível só para ADM
  var btnRow = document.getElementById('produtoPropBtnRow');
  if(btnRow) btnRow.style.display = _isAdm() ? 'flex' : 'none';
}
function _renderProdutoPropCards_UNUSED(){
  var grid = document.getElementById('produtoPropCards');
  if(!grid) return;
  grid.innerHTML = Object.keys(_PRODUTOS_PROPOSTA).map(function(cod){
    var p = _PRODUTOS_PROPOSTA[cod];
    var imgStyle = p.img
      ? (function(){
      var posMap={'JE':'center 45%','MAESTRIA':'center 50%','DP':'center 45%','CIS_GLOBAL':'center 20%','TEAM':'center 50%'};
      var pos=posMap[cod]||'center 5%';
      return 'background-image:url('+p.img+');background-size:115%;background-position:'+pos+';';
    })()
      : 'background:var(--surface2);';
    return '<div onclick="abrirPropProd(\''+cod+'\')" style="cursor:pointer;border-radius:12px;overflow:hidden;border:1px solid #1a2a1a;background:#111;transition:transform .3s,box-shadow .3s,border-color .3s;" onmouseover="this.style.transform=\'translateY(-5px) scale(1.02)\';this.style.boxShadow=\'0 12px 40px rgba(200,240,90,.18)\';this.style.borderColor=\'#c8f05a55\';this.querySelector(\'.gp-btn\').style.background=\'#c8f05a\';this.querySelector(\'.gp-btn\').style.color=\'#0a150a\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\';this.style.borderColor=\'#1a2a1a\';this.querySelector(\'.gp-btn\').style.background=\'#0a150a\';this.querySelector(\'.gp-btn\').style.color=\'#fff\'">'
      +'<div style="'+imgStyle+'height:140px;position:relative;overflow:hidden;">'
      +'<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.92) 0%,rgba(0,0,0,.3) 55%,transparent 100%);"></div>'
      +'<div style="position:absolute;top:7px;left:7px;background:rgba(200,240,90,.18);border:1px solid rgba(200,240,90,.35);border-radius:4px;font-size:8px;font-weight:700;color:#c8f05a;padding:2px 6px;letter-spacing:.06em;">'+cod+'</div>'
      +'<div style="position:absolute;bottom:10px;left:0;right:0;padding:0 10px;"><div style="font-size:11px;font-weight:700;color:#fff;line-height:1.3;">'+p.nome+'</div></div>'
      +'</div>'
      +'<div class="gp-btn" style="padding:7px 10px;background:#0a150a;text-align:center;font-size:10px;font-weight:600;color:#fff;letter-spacing:.04em;border-top:1px solid rgba(200,240,90,.15);transition:background .25s,color .25s;">Gerar Proposta</div>'
      +'</div>';
  }).join('');
}

function abrirPropProd(codigo){
  _propProdAtual = codigo;
  var p = _PRODUTOS_PROPOSTA[codigo];
  if(!p) return;
  if(p.customRenderer && window.PropostaRenderer && window.PropostaRenderer.tem(codigo)){ window.PropostaRenderer.abrir(codigo); return; }

  document.getElementById('propProdTitulo').textContent = p.nome;
  document.getElementById('propProdSub').textContent = 'Personalize a proposta para o cliente.';
  document.getElementById('propProdPreco').value = p.preco;
  document.getElementById('propProdValidade').value = '30';
  document.getElementById('propProdClienteManual').value = '';

  // Popular clientes da turma
  var sel = document.getElementById('propProdCliente');
  var sess = _getSessao ? _getSessao() : null;
  var isAdm = !sess || sess.perfil === 'adm';
  sel.innerHTML = '<option value="">Selecione ou digite abaixo</option>';
  var clientes = data && data.length
    ? (isAdm
        ? [...new Set(data.map(function(d){return d.cliente;}))]
        : [...new Set(data.filter(function(d){return d.consultor.toUpperCase()===(sess.vinculo||'').toUpperCase();}).map(function(d){return d.cliente;}))])
    : [];
  clientes.sort().forEach(function(c){
    var opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });

  // Consultor
  var nomeConsultor = isAdm ? 'ADM' : (sess && sess.vinculo ? sess.vinculo.toUpperCase() : (sess && sess.nome ? sess.nome.toUpperCase() : '—'));
  document.getElementById('propProdConsultor').textContent = nomeConsultor;

  document.getElementById('propProdOverlay').classList.add('open');
}

function fecharPropProd(){
  document.getElementById('propProdOverlay').classList.remove('open');
  _propProdAtual = null;
}

function gerarPropostaProduto(){
  // Helper local para escape HTML (prevenir XSS via dados de cliente/consultor)
  function _escHtml(s){ return window._esc(s); }
  var p = _PRODUTOS_PROPOSTA[_propProdAtual];
  if(!p){ _showToast('❌ Produto não encontrado.','var(--red)'); return; }

  var clienteSel = document.getElementById('propProdCliente').value;
  var clienteManual = document.getElementById('propProdClienteManual').value.trim().toUpperCase();
  var cliente = clienteManual || clienteSel;
  if(!cliente){ _showToast('⚠️ Informe o nome do cliente.','var(--amber)'); return; }

  var preco = document.getElementById('propProdPreco').value || p.preco;
  var validade = document.getElementById('propProdValidade').value || '30';
  var consultor = document.getElementById('propProdConsultor').textContent || '—';

  // WhatsApp do consultor
  var sess = _getSessao ? _getSessao() : null;
  var wpp = '';
  if(sess && sess.uid){
    var localU = _getUsuariosLocal();
    wpp = (localU[sess.uid] && localU[sess.uid].whatsapp) || '';
  }
  var wppLink = wpp ? 'https://wa.me/55'+wpp : '#';

  // Texto personalizado
  var texto = p.texto
    .replace('[NOME_CLIENTE]', cliente)
    .replace('[TEXTO_DO_PRODUTO]', '[Texto de apresentação do '+p.nome+' — edite conforme o PDF do produto]');

  // Gerar HTML
  var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Proposta — '+_escHtml(p.nome)+'</title>'
    +'<style>'
    +'*{box-sizing:border-box;margin:0;padding:0;}'
    +'body{font-family:\'Segoe UI\',sans-serif;background:#0a0a0a;color:#f0f0f0;min-height:100vh;}'
    +'.hero{width:100%;max-height:60vh;object-fit:cover;display:block;}'
    +'.container{max-width:600px;margin:0 auto;padding:28px 20px 60px;}'
    +'.badge{display:inline-block;background:rgba(200,240,90,.15);color:#c8f05a;border:1px solid rgba(200,240,90,.3);border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:16px;}'
    +'.titulo{font-size:28px;font-weight:800;color:#fff;margin-bottom:6px;line-height:1.2;}'
    +'.subtitulo{font-size:14px;color:#888;margin-bottom:24px;}'
    +'.cliente-box{background:#111;border:1px solid #222;border-radius:12px;padding:18px 20px;margin-bottom:24px;}'
    +'.cliente-label{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;}'
    +'.cliente-nome{font-size:20px;font-weight:700;color:#c8f05a;}'
    +'.texto{font-size:15px;color:#ccc;line-height:1.8;white-space:pre-line;margin-bottom:28px;}'
    +'.preco-titulo{font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;}'
    +'.preco-table{width:100%;border-collapse:collapse;background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;margin-bottom:24px;}'
    +'.preco-table th{font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em;padding:10px 14px;background:#0d0d0d;border-bottom:1px solid #222;text-align:left;}'
    +'.preco-table td{padding:10px 14px;font-size:14px;font-weight:600;color:#f0f0f0;border-bottom:1px solid #1a1a1a;}'
    +'.preco-table tr:last-child td{border-bottom:none;}'
    +'.preco-table td.val{color:#c8f05a;font-size:16px;font-weight:800;text-align:right;}'
    +'.preco-table tr.destaque td{background:rgba(200,240,90,.06);}'
    +'.validade{font-size:12px;color:#555;margin-bottom:24px;}'
    +'.wpp-btn{display:block;width:100%;background:#25d366;color:#fff;border:none;border-radius:12px;padding:16px;font-size:16px;font-weight:700;text-align:center;text-decoration:none;cursor:pointer;margin-bottom:16px;}'
    +'.consultor-box{text-align:center;font-size:12px;color:#444;padding-top:16px;border-top:1px solid #1a1a1a;}'
    +'</style>'
    +'</head><body>'
    +'<img class="hero" src="'+_escHtml(p.img)+'" alt="'+_escHtml(p.nome)+'" loading="lazy" />'
    +'<div class="container">'
    +'<div class="badge">Proposta Personalizada</div>'
    +'<div class="titulo">'+_escHtml(p.nome)+'</div>'
    +'<div class="subtitulo">Febracis · Escola de Negócios</div>'
    +'<div class="cliente-box">'
    +'<div class="cliente-label">Para</div>'
    +'<div class="cliente-nome">'+_escHtml(cliente)+'</div>'
    +'</div>'
    +'<div class="texto">'+_escHtml(texto)+'</div>'
    +(function(){
      var pc = _PROPOSTA_PRECOS[_propProdAtual];
      var fmtR = function(v){ return v==null ? '—' : 'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); };
      if(!pc) return '<div style="font-size:14px;color:#c8f05a;margin-bottom:24px;">'+_escHtml(preco)+'</div>';
      var linhas = [
        {k:'integral',      label:'Integral',             destaque:false},
        {k:'parcelado',     label:'12x (mensal)',          destaque:false},
        {k:'parcelado_desc',label:'12x c/ desconto (total)',destaque:true},
        {k:'avista_credito',label:'À Vista no crédito',    destaque:false},
        {k:'avista',        label:'À Vista',               destaque:true},
        {k:'reciclagem',    label:'Reciclagem 50%',        destaque:false},
      ];
      var rows = linhas.filter(function(l){ return pc[l.k]!=null; }).map(function(l){
        return '<tr'+(l.destaque?' class="destaque"':'')+'>'+
          '<td>'+l.label+'</td>'+
          '<td class="val">'+fmtR(pc[l.k])+'</td>'+
          '</tr>';
      }).join('');
      return '<div class="preco-titulo">Condições de Pagamento</div>'+
        '<table class="preco-table"><thead><tr><th>Modalidade</th><th style="text-align:right;">Valor</th></tr></thead>'+
        '<tbody>'+rows+'</tbody></table>';
    })()
    +'<div class="validade">Proposta válida por '+_escHtml(validade)+' dias</div>'
    +(wpp ? '<a class="wpp-btn" href="'+_escHtml(wppLink)+'" target="_blank">Falar com '+_escHtml(consultor)+' no WhatsApp</a>' : '')
    +'<div class="consultor-box">Proposta apresentada por <strong>'+_escHtml(consultor)+'</strong> · Febracis</div>'
    +'</div>'
    +'</body></html>';

  // Abrir preview — embute imagens como base64 ANTES do blob
  // (em file:// blob:null nao consegue carregar file:// das images)
  window._ppNomeArquivo = 'proposta-'+_propProdAtual.toLowerCase()+'-'+cliente.toLowerCase().replace(/\s+/g,'-')+'.html';
  window._ppBlobUrl = null;
  _showToast('🔄 Preparando proposta...','var(--muted)');

  var _processar = (window.PropostaRenderer && window.PropostaRenderer._embutirImagensInline)
    ? function(h){
        var hAbs = window.PropostaRenderer._absolutizarUrls(h);
        return window.PropostaRenderer._embutirImagensInline(hAbs);
      }
    : function(h){ return Promise.resolve(h); };

  _processar(html).then(function(htmlFinal){
    window._ppHtml = htmlFinal;
    var blob = new Blob([htmlFinal], {type:'text/html'});
    var url = URL.createObjectURL(blob);
    window._ppBlobUrl = url;

    var iframe = document.getElementById('ppIframe');
    iframe.src = url;
    document.getElementById('ppLinkInput').value = url;
    document.getElementById('ppPreviewTitulo').textContent = 'Proposta — '+p.nome+' · '+cliente;

    var ov = document.getElementById('propProdPreviewOverlay');
    ov.style.display = 'flex';

    fecharPropProd();
    _showToast('✅ Proposta gerada para '+cliente+'!','var(--accent)');
    if(typeof _addPendLog==='function') _addPendLog('Proposta HTML gerada',cliente+' · '+p.nome,'📄');
  });
}

function fecharPreviewPropProd(){
  var ov = document.getElementById('propProdPreviewOverlay');
  ov.style.display = 'none';
  document.getElementById('ppIframe').src = 'about:blank';
  if(window._ppBlobUrl){ URL.revokeObjectURL(window._ppBlobUrl); window._ppBlobUrl = null; }
}

function ppBaixar(){
  if(!window._ppHtml) return;
  var blob = new Blob([window._ppHtml], {type:'text/html'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = window._ppNomeArquivo || 'proposta.html';
  a.click();
  URL.revokeObjectURL(url);
}

function ppAbrirAba(){
  if(window._ppBlobUrl) window.open(window._ppBlobUrl, '_blank');
}

function ppCopiarLink(){
  var link = document.getElementById('ppLinkInput').value;
  if(!link) return;
  navigator.clipboard.writeText(link).then(function(){
    _showToast('🔗 Link copiado! Válido nesta sessão do navegador.','var(--accent)');
  }).catch(function(){
    document.getElementById('ppLinkInput').select();
    document.execCommand('copy');
    _showToast('🔗 Link copiado!','var(--accent)');
  });
}

function ppCopiarHtml(){
  if(!window._ppHtml) return;
  navigator.clipboard.writeText(window._ppHtml).then(function(){
    _showToast('📋 HTML copiado para a área de transferência!','var(--accent)');
  }).catch(function(){
    _showToast('❌ Não foi possível copiar.','var(--red)');
  });
}

/* ── Fix 4: Impedir fechamento de modais ao clicar fora ── */
(function _fixModalClick(){
  var ids=['novoUsuarioOverlay','alterarSenhaOverlay','primeiroAcessoOverlay',
           'usuariosOverlay','permsModalOverlay','novaTurmaOverlay'];
  function _bind(){
    ids.forEach(function(id){
      var el=document.getElementById(id);
      if(el&&!el._fixClick){
        el._fixClick=true;
        el.addEventListener('click',function(e){
          if(e.target===el) e.stopPropagation();
        });
      }
    });
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',_bind);
  } else {
    _bind();
  }
})();
