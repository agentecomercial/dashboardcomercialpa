/* ══════════════════════════════════════════════════════════════
   PROPOSTA · SELETOR DE TEXTO DA SEÇÃO I (Introdução & Reconhecimento)
   ──────────────────────────────────────────────────────────────
   Fica no modal "Montar Proposta", entre os 3 botões de montagem
   rápida (Elite / Legacy / Selecionar GGB) e a lista de Treinamentos.

   Textos fixos (não editáveis, não removíveis):
     • GGB — o texto histórico da proposta (_PROPOSTA_TEXTO)
     • CIS — para quem AINDA VAI fazer o Método CIS (antecipação)
     • Green Belt / Golden Belt — escolhidos sozinhos ao clicar nos
       botões de faixa; ao desmarcar a faixa, volta para o GGB

   O botão "+" cria textos personalizados, salvos em localStorage
   (por navegador/máquina). Personalizados podem ser editados e
   removidos.

   PRECEDÊNCIA no gerador (20-propostas-main.js):
     GGB selecionado  → comportamento antigo: se Elite/Legacy Belt
                        estiver ativo, o texto do belt vence.
     Qualquer outro   → o texto escolhido aqui vence sobre o belt.
   Assim nada muda para quem já usava Elite/Legacy Belt.
   ══════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var LS_TEXTOS = 'proposta_intro_textos_v1';
  var LS_SEL    = 'proposta_intro_sel_v1';

  /* Texto CIS — o cliente ainda NÃO fez o Método CIS: acabou de decidir
     fazê-lo e recebe a proposta da jornada que começa ali. Tom de
     antecipação, olhando para o futuro. */
  var TXT_CIS = 'Antes de qualquer resultado, existe uma decisão — e você acabou de tomar a sua. Ao escolher viver o Método CIS, você fez o que a maioria adia a vida inteira: parou de apenas desejar uma vida extraordinária e agiu em direção a ela. Essa escolha já o separa de quem sonha em mudar e nunca sai do lugar. Nos próximos dias, você vai mergulhar em uma imersão intensa, construída para transformar consciência em ferramenta e ferramenta em prática. E saiba desde já: o CIS é o ponto de partida de uma jornada que segue muito além dele, sustentada passo a passo pelo que vem depois. A decisão foi sua. Honrá-la ao máximo, a partir de agora, é o nosso compromisso com você.';

  /* Textos das faixas — os botões 🟢 Green Belt / 🥇 Golden Belt do modal
     selecionam estes automaticamente (54-proposta-belt.js). */
  var TXT_GREEN = 'Existe um marco na jornada Febracis que separa quem experimenta de quem assume: o Green Belt. Ele não é um certificado pendurado na parede — é o reconhecimento de que você percorreu uma formação consistente e transformou conhecimento em prática nas suas emoções, nas suas finanças, na sua carreira e nos seus relacionamentos. Você já está nesse caminho, e falta menos do que imagina para chegar lá. Os treinamentos desta proposta são exatamente os que completam a sua faixa e firmam o seu nome entre os que levaram a própria evolução a sério. O Green Belt está ao seu alcance. Conquiste-o.';
  var TXT_GOLD  = 'Poucos chegam ao Golden Belt, e não é por acaso: ele exige a formação completa, o percurso inteiro, sem atalhos. É a mais alta distinção da jornada Febracis, reservada a quem levou o próprio desenvolvimento até o fim e converteu cada treinamento em resultado real na vida e nos negócios. Você já provou que tem disciplina para começar e constância para seguir — agora está a poucos passos de fechar o ciclo. Os treinamentos desta proposta são os que faltam para completar a sua formação e colocar o seu nome onde estão os que não se contentaram com metade do caminho. O Golden Belt é o seu próximo lugar. Assuma-o.';

  /* Fixos. O texto do GGB é lido de _PROPOSTA_TEXTO em tempo de uso
     (a variável é global do 20-propostas-main.js). */
  function _fixos(){
    var ggb = (typeof _PROPOSTA_TEXTO !== 'undefined') ? _PROPOSTA_TEXTO : '';
    return [
      { id:'ggb',        nome:'GGB',         texto:ggb,       fixo:true },
      { id:'cis',        nome:'CIS',         texto:TXT_CIS,   fixo:true },
      { id:'greenbelt',  nome:'Green Belt',  texto:TXT_GREEN, fixo:true },
      { id:'goldenbelt', nome:'Golden Belt', texto:TXT_GOLD,  fixo:true }
    ];
  }

  function _custom(){
    try{
      var raw = localStorage.getItem(LS_TEXTOS);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(function(t){ return t && t.id && t.nome; }) : [];
    }catch(e){ return []; }
  }
  function _salvarCustom(arr){
    try{ localStorage.setItem(LS_TEXTOS, JSON.stringify(arr)); }catch(e){}
  }

  /* Lista completa: fixos + personalizados */
  function _todos(){ return _fixos().concat(_custom()); }

  function _selId(){
    var id;
    try{ id = localStorage.getItem(LS_SEL); }catch(e){}
    if(!id) return 'ggb';
    /* Se o texto foi apagado, volta pro GGB */
    var achou = _todos().some(function(t){ return t.id === id; });
    return achou ? id : 'ggb';
  }
  function _setSel(id){
    try{ localStorage.setItem(LS_SEL, id); }catch(e){}
  }

  function _porId(id){
    var lista = _todos();
    for(var i=0;i<lista.length;i++) if(lista[i].id === id) return lista[i];
    return null;
  }

  /* ── API para o gerador de PDF ──────────────────────────────
     Retorna o texto escolhido, ou null quando é o GGB (aí o
     gerador segue a regra antiga: belt ativo > _PROPOSTA_TEXTO). */
  function _introTextoAtivo(){
    var id = _selId();
    if(id === 'ggb') return null;
    var t = _porId(id);
    return (t && t.texto) ? t.texto : null;
  }

  /* Nome do texto ativo — usado só para exibição/diagnóstico */
  function _introNomeAtivo(){
    var t = _porId(_selId());
    return t ? t.nome : 'GGB';
  }

  /* ── UI ─────────────────────────────────────────────────────── */
  function _esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function _chip(t, ativo){
    var base = 'flex:0 0 auto;height:30px;display:inline-flex;align-items:center;gap:5px;'
             + 'box-sizing:border-box;padding:0 11px;line-height:1;border-radius:var(--radius-sm);'
             + 'font-size:11px;font-weight:700;cursor:pointer;font-family:\'DM Sans\',sans-serif;'
             + 'transition:all .15s;letter-spacing:.04em;white-space:nowrap;max-width:170px;'
             + 'overflow:hidden;text-overflow:ellipsis;';
    var cor = ativo
      ? 'background:rgba(200,240,90,.16);border:1px solid rgba(200,240,90,.55);color:var(--accent);'
      : 'background:var(--surface2);border:1px solid var(--border2);color:var(--muted);';
    return '<button type="button" onclick="_introSelecionar(\''+_esc(t.id)+'\')" '
      + 'title="' + _esc(t.texto.slice(0,180) + (t.texto.length>180?'…':'')) + '" '
      + 'style="'+base+cor+'">'
      + (ativo ? '<span style="font-size:10px;">●</span>' : '')
      + _esc(t.nome)
      + '</button>';
  }

  function _render(){
    var box = document.getElementById('propIntroChips');
    if(!box) return;
    var sel = _selId();
    var html = _todos().map(function(t){ return _chip(t, t.id === sel); }).join('');
    html += '<button type="button" onclick="_introNovo()" title="Adicionar um novo texto de introdução"'
          + ' style="flex:0 0 auto;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;'
          + 'box-sizing:border-box;line-height:1;background:rgba(80,140,255,.10);border:1px solid rgba(80,140,255,.35);'
          + 'border-radius:var(--radius-sm);font-size:15px;font-weight:700;color:#93c5fd;cursor:pointer;'
          + 'font-family:\'DM Sans\',sans-serif;transition:all .15s;"'
          + ' onmouseover="this.style.background=\'rgba(80,140,255,.20)\'"'
          + ' onmouseout="this.style.background=\'rgba(80,140,255,.10)\'">+</button>';
    box.innerHTML = html;

    /* Trecho do texto ativo + ações do personalizado */
    var pv = document.getElementById('propIntroPreview');
    if(pv){
      var t = _porId(sel);
      var txt = t ? String(t.texto || '').replace(/\n/g,' ') : '';
      var trecho = txt.length > 155 ? txt.slice(0,155) + '…' : txt;
      var acoes = '';
      if(t && !t.fixo){
        acoes = ' <a href="#" onclick="event.preventDefault();_introEditar(\''+_esc(t.id)+'\')" style="color:#93c5fd;text-decoration:none;font-weight:700;">✎ editar</a>'
              + ' <a href="#" onclick="event.preventDefault();_introExcluir(\''+_esc(t.id)+'\')" style="color:var(--red);text-decoration:none;font-weight:700;">🗑 excluir</a>';
      }
      pv.innerHTML = '<span style="color:var(--muted);">'+_esc(trecho)+'</span>' + acoes;
    }
  }

  /* Seleciona um texto e regenera o preview do PDF */
  function _introSelecionar(id){
    _setSel(id);
    _render();
    if(typeof window._propostaPreview === 'function') window._propostaPreview();
  }

  /* ── Editor (novo / edição) ─────────────────────────────────── */
  var _editandoId = null;

  function _abrirEditor(id){
    _editandoId = id || null;
    var ed  = document.getElementById('propIntroEditor');
    var inN = document.getElementById('propIntroNome');
    var inT = document.getElementById('propIntroTexto');
    var tit = document.getElementById('propIntroEdTitulo');
    if(!ed || !inN || !inT) return;
    var t = id ? _porId(id) : null;
    inN.value = t ? t.nome  : '';
    inT.value = t ? t.texto : '';
    if(tit) tit.textContent = t ? ('Editar «' + t.nome + '»') : 'Novo texto de introdução';
    ed.style.display = 'block';
    _introContar();
    inN.focus();
  }
  function _introNovo(){ _abrirEditor(null); }
  function _introEditar(id){
    var t = _porId(id);
    if(!t || t.fixo) return;
    _abrirEditor(id);
  }
  function _introCancelar(){
    var ed = document.getElementById('propIntroEditor');
    if(ed) ed.style.display = 'none';
    _editandoId = null;
  }

  /* Contador de caracteres — a faixa navy da Seção I comporta bem
     até ~800 caracteres antes de empurrar a tabela para outra página. */
  function _introContar(){
    var inT = document.getElementById('propIntroTexto');
    var out = document.getElementById('propIntroContador');
    if(!inT || !out) return;
    var n = inT.value.length;
    out.textContent = n + ' caracteres';
    out.style.color = n > 900 ? 'var(--red)' : (n > 800 ? 'var(--amber)' : 'var(--muted)');
  }

  function _introSalvar(){
    var inN = document.getElementById('propIntroNome');
    var inT = document.getElementById('propIntroTexto');
    if(!inN || !inT) return;
    var nome  = String(inN.value || '').trim();
    var texto = String(inT.value || '').trim();
    if(!nome){  alert('Dê um nome ao texto (ex.: CIS GLOBAL, MAESTRIA…).'); inN.focus(); return; }
    if(!texto){ alert('Escreva o texto da introdução.'); inT.focus(); return; }

    var arr = _custom();
    if(_editandoId){
      for(var i=0;i<arr.length;i++){
        if(arr[i].id === _editandoId){ arr[i].nome = nome; arr[i].texto = texto; break; }
      }
    } else {
      /* id estável e único sem depender de Date/Math.random do gerador */
      var base = nome.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'texto';
      var id = base, n = 2;
      while(_porId(id)){ id = base + '-' + n; n++; }
      arr.push({ id:id, nome:nome, texto:texto });
      _editandoId = id;
    }
    _salvarCustom(arr);
    _setSel(_editandoId);
    _introCancelar();
    _render();
    if(typeof window._propostaPreview === 'function') window._propostaPreview();
  }

  function _introExcluir(id){
    var t = _porId(id);
    if(!t || t.fixo) return;
    if(!confirm('Excluir o texto «' + t.nome + '»?')) return;
    _salvarCustom(_custom().filter(function(x){ return x.id !== id; }));
    if(_selId() === id) _setSel('ggb');
    _render();
    if(typeof window._propostaPreview === 'function') window._propostaPreview();
  }

  /* Larga o texto de faixa e volta ao GGB — chamado quando o gestor
     sai do Green/Golden Belt (desmarca, ou escolhe Elite/Legacy/GGB). */
  function _introLimparFaixa(){
    var id = _selId();
    if(id === 'greenbelt' || id === 'goldenbelt') _introSelecionar('ggb');
  }

  /* Chamado por abrirPropostaModal() a cada abertura */
  function _introReset(){
    _introCancelar();
    _introLimparFaixa();
    _render();
  }

  window._introSelecionar   = _introSelecionar;
  window._introNovo         = _introNovo;
  window._introEditar       = _introEditar;
  window._introExcluir      = _introExcluir;
  window._introSalvar       = _introSalvar;
  window._introCancelar     = _introCancelar;
  window._introContar       = _introContar;
  window._introReset        = _introReset;
  window._introLimparFaixa  = _introLimparFaixa;
  window._introTextoAtivo   = _introTextoAtivo;
  window._introNomeAtivo    = _introNomeAtivo;
  window._introTextos       = _todos;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _render);
  } else {
    _render();
  }
})();
