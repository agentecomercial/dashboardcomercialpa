/* ============================================================
   GESTAO DE USUARIOS
============================================================ */
// _getSessao definida em 02-main.js

function abrirPainelUsuarios(){
  document.getElementById('usuariosOverlay').classList.add('open');
  // GARANTE que a equipe da turma (allConsultors/allTrainers) esteja em memória
  // ANTES de renderizar. Bug anterior: com _turmaAtiva presente mas allConsultors
  // vazio (volátil — zera ao trocar de contexto), o painel renderizava 0/0 mesmo
  // a turma tendo membros. Ordem das fontes: memória → _turmaAtiva → Firebase.
  function _arr(v){ return Array.isArray(v)?v:(v?Object.values(v).filter(Boolean):[]); }
  // Cria contas faltantes p/ os membros da turma (escolha do ADM: contas
  // automáticas) e então renderiza. Idempotente — só cria quem não tem.
  function _render(){ if(window._backfillContasEquipe) window._backfillContasEquipe(); _renderUsuariosGrid(); }

  // 1) Já temos a equipe em memória → render direto.
  if(allConsultors.length||allTrainers.length){ _render(); return; }

  // 2) _turmaAtiva tem as listas → repopula e renderiza.
  if(_turmaAtiva){
    var _c=_arr(_turmaAtiva.consultores), _tr=_arr(_turmaAtiva.treinadores);
    if(_c.length||_tr.length){
      if(!allConsultors.length) allConsultors=_c.slice();
      if(!allTrainers.length)   allTrainers=_tr.slice();
      _render(); return;
    }
  }

  // 3) Buscar do Firebase pela turma ativa (memória ou localStorage).
  var turmaId=(_turmaAtiva&&_turmaAtiva.id)||localStorage.getItem(TURMA_ATIVA_KEY);
  if(turmaId&&window._fbGet){
    window._fbGet('turmas/'+turmaId).then(function(t){
      if(t){
        _turmaAtiva=Object.assign({id:turmaId},t);
        window._turmaAtiva=_turmaAtiva;
        if(!allConsultors.length) allConsultors=_arr(t.consultores).slice();
        if(!allTrainers.length)   allTrainers=_arr(t.treinadores).slice();
      }
      _render();
    }).catch(function(){ _render(); });
  } else {
    _render();
  }
}
function fecharPainelUsuarios(){document.getElementById('usuariosOverlay').classList.remove('open');}

/* ══════════════════════════════════════════════════════════
   WIZARD — NOVO USUÁRIO (3 passos)
══════════════════════════════════════════════════════════ */
var _wzPasso = 1;
var _wzPermsLabels = {
  verGeral:          'Ver painel geral',
  verConsultor:      'Ver consultores',
  verTreinador:      'Ver treinadores',
  verProduto:        'Ver produtos',
  verValores:        'Ver valores (R$)',
  editar:            'Editar dados',
  exportar:          'Exportar PDF/JSON',
  gerenciarUsuarios: 'Gerenciar usuários',
  configuracoes:     'Configurações críticas'
};

function abrirWizardNovoUsuario(){
  _wzPasso = 1;
  document.getElementById('wzNome').value = '';
  document.getElementById('wzLogin').value = '';
  document.getElementById('wzSenha').value = '';
  document.getElementById('wzWhatsapp').value = '';
  document.getElementById('wzPerfil').value = 'consultor';
  wizardAtualizarPerms();
  _wzMostrarPasso(1);
  document.getElementById('wizardUsuarioOverlay').classList.add('open');
  setTimeout(function(){ document.getElementById('wzNome').focus(); }, 100);
}
window.abrirWizardNovoUsuario = abrirWizardNovoUsuario;

function fecharWizardUsuario(){
  document.getElementById('wizardUsuarioOverlay').classList.remove('open');
}
window.fecharWizardUsuario = fecharWizardUsuario;

function _wzMostrarPasso(n){
  _wzPasso = n;
  [1,2,3].forEach(function(i){
    var el = document.getElementById('wizardPasso'+i);
    if(el) el.style.display = i===n ? '' : 'none';
  });
  var titulos = ['Novo Usuário — Passo 1 de 3','Novo Usuário — Passo 2 de 3','Novo Usuário — Passo 3 de 3'];
  var subs = ['Dados básicos e perfil','Permissões — ajuste se necessário','Confirme antes de salvar'];
  document.getElementById('wizardTitulo').textContent = titulos[n-1];
  document.getElementById('wizardSubtitulo').textContent = subs[n-1];
  document.getElementById('wzBtnVoltar').style.display = n > 1 ? '' : 'none';
  document.getElementById('wzBtnAvancar').textContent = n < 3 ? 'Próximo →' : '✓ Criar usuário';
  if(n === 3) _wzGerarResumo();
}

function wizardAtualizarPerms(){
  var perfil = document.getElementById('wzPerfil').value;
  var perms = Object.assign({}, PERMS_PADRAO[perfil] || PERMS_PADRAO.consultor);
  var grid = document.getElementById('wzPermsGrid');
  if(!grid) return;
  grid.innerHTML = Object.keys(_wzPermsLabels).map(function(k){
    var chk = perms[k] ? ' checked' : '';
    return '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text);cursor:pointer;">'
      +'<input type="checkbox" id="wzP_'+k+'"'+chk+' style="width:14px;height:14px;accent-color:var(--accent);">'
      +_wzPermsLabels[k]+'</label>';
  }).join('');
}
window.wizardAtualizarPerms = wizardAtualizarPerms;

function wizardAvancar(){
  if(_wzPasso === 1){
    var nome = (document.getElementById('wzNome').value||'').trim();
    var login = (document.getElementById('wzLogin').value||'').trim().toLowerCase().replace(/\s+/g,'.');
    var senha = (document.getElementById('wzSenha').value||'').trim();
    if(!nome){ _showToast('Informe o nome do usuário.','var(--amber)'); return; }
    if(!login){ _showToast('Informe o login.','var(--amber)'); return; }
    if(senha.length < 6){ _showToast('Senha deve ter pelo menos 6 caracteres.','var(--amber)'); return; }
    document.getElementById('wzLogin').value = login;
    _wzMostrarPasso(2);
  } else if(_wzPasso === 2){
    _wzMostrarPasso(3);
  } else if(_wzPasso === 3){
    _wzSalvar();
  }
}
window.wizardAvancar = wizardAvancar;

function wizardVoltar(){
  if(_wzPasso > 1) _wzMostrarPasso(_wzPasso - 1);
}
window.wizardVoltar = wizardVoltar;

function _wzGerarResumo(){
  var nome   = (document.getElementById('wzNome').value||'').toUpperCase();
  var login  = document.getElementById('wzLogin').value||'';
  var perfil = document.getElementById('wzPerfil').value||'consultor';
  var wpp    = document.getElementById('wzWhatsapp').value||'—';
  var permsAtivas = Object.keys(_wzPermsLabels).filter(function(k){
    var el = document.getElementById('wzP_'+k); return el && el.checked;
  }).map(function(k){ return _wzPermsLabels[k]; });
  var corPerfil = {adm:'var(--accent)',consultor:'var(--green)',treinador:'var(--amber)',ministrante:'var(--blue)'}[perfil]||'var(--muted)';
  var labelPerfil = {adm:'ADM',consultor:'Consultor',treinador:'Treinador',ministrante:'Ministrante'}[perfil]||perfil;
  document.getElementById('wzResumo').innerHTML =
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">'
    +'<div style="width:40px;height:40px;border-radius:50%;background:'+corPerfil+'22;color:'+corPerfil+';border:2px solid '+corPerfil+'55;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;">'+nome[0]+'</div>'
    +'<div><div style="font-size:15px;font-weight:700;color:var(--text);">'+nome+'</div>'
    +'<div style="font-size:11px;color:'+corPerfil+';">'+labelPerfil+' · @'+login+'</div></div>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:6px;">WhatsApp: '+wpp+'</div>'
    +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Permissões:</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px;">'
    +permsAtivas.map(function(p){
      return '<span style="font-size:10px;background:rgba(200,240,90,.1);color:var(--accent);border:1px solid rgba(200,240,90,.25);border-radius:20px;padding:2px 8px;">'+p+'</span>';
    }).join('')
    +'</div>';
}

function _wzSalvar(){
  var nome   = (document.getElementById('wzNome').value||'').trim().toUpperCase();
  var login  = (document.getElementById('wzLogin').value||'').trim();
  var senha  = document.getElementById('wzSenha').value||'';
  var perfil = document.getElementById('wzPerfil').value||'consultor';
  var wpp    = (document.getElementById('wzWhatsapp').value||'').trim();
  var perms  = {};
  Object.keys(_wzPermsLabels).forEach(function(k){
    var el = document.getElementById('wzP_'+k); perms[k] = !!(el && el.checked);
  });
  var uid = perfil+'_'+_normalizeUid(nome)+'_'+Date.now();
  var novoUser = {
    nome: nome, login: login, senha: senha, perfil: perfil,
    whatsapp: wpp, ativo: true, primeiroAcesso: true,
    permissoes: perms, createdAt: Date.now(), updatedAt: Date.now()
  };
  /* salvar local */
  var local = _getUsuariosLocal();
  local[uid] = novoUser;
  _saveUsuariosLocal(local);
  /* tentar Firebase */
  var salvoFb = false;
  if(window._fbSave){
    try{ window._fbSave('usuarios/'+uid, novoUser); salvoFb = true; }catch(e){}
  }
  fecharWizardUsuario();
  _renderUsuariosGrid();
  _showToast('✅ Usuário '+nome+' criado!'+(salvoFb?' ☁️':''),'var(--accent)');
}

/* ── Fix 2: funções complementares — NÃO alteram estrutura existente ──────────
   Extraem consultores presentes em data[] e os adicionam à lista de membros
   sem remover nenhum existente e sem duplicar.
─────────────────────────────────────────────────────────────────────────────── */
function extrairConsultoresDoData(){
  var consultores=new Set();
  (Array.isArray(data)?data:[]).forEach(function(c){
    if(c.consultor&&c.consultor.trim()!=='')
      consultores.add(c.consultor.trim().toUpperCase());
  });
  return Array.from(consultores);
}

function complementarMembrosComData(membros){
  // Recebe o objeto membros e adiciona consultores de data[] que ainda não estão na lista
  var novos=extrairConsultoresDoData();
  novos.forEach(function(nome){
    var jaExiste=membros.consultores.some(function(m){
      return m.toUpperCase().trim()===nome.toUpperCase().trim();
    });
    if(!jaExiste) membros.consultores.push(nome);
  });
  return membros; // retorna o mesmo objeto enriquecido
}

function _getMembros(){
  // 1. Turma ativa em memória
  if(_turmaAtiva){
    return {consultores:_turmaAtiva.consultores||[],treinadores:_turmaAtiva.treinadores||[]};
  }
  // 2. localStorage
  var turmaId=localStorage.getItem(TURMA_ATIVA_KEY);
  var turmas=_getTurmas();
  var turma=turmaId?turmas.find(function(t){return t.id===turmaId;}):turmas[0];
  if(turma&&(turma.consultores||turma.treinadores)){
    return {consultores:turma.consultores||[],treinadores:turma.treinadores||[]};
  }
  // 3. allConsultors/allTrainers em memória
  if(allConsultors.length||allTrainers.length){
    return {consultores:allConsultors,treinadores:allTrainers};
  }
  // 4. Fallback: dados fixos da turma IF15
  return {
    consultores:['LARISSA','DANIEL','DARLEY'],
    treinadores:['RAFAEL SIMÕES','JOSIANE BORGES','THIAGO PINHEIRO']
  };
}

/* Fix 2: carregarUsuarios — sempre busca do Firebase, localStorage como fallback */
async function carregarUsuarios(){
  var local = _getUsuariosLocal();
  if(window._fbGet){
    try{
      var fbUsuarios = await window._fbGet('usuarios');
      if(fbUsuarios&&Object.keys(fbUsuarios).length>0){
        // Mesclar: Firebase tem prioridade, mas preservar dados locais ausentes no Firebase
        Object.keys(local).forEach(function(uid){
          if(!fbUsuarios[uid]) fbUsuarios[uid]=local[uid];
        });
        _saveUsuariosLocal(fbUsuarios);
        return fbUsuarios;
      }
    }catch(e){ console.warn('[carregarUsuarios] Firebase erro:',e); }
  }
  return local;
}

function _renderUsuariosGrid(){
  var grid=document.getElementById('usuariosGrid');
  if(!grid) return;
  // Não re-renderizar se um sub-modal de edição estiver aberto (protege o admin enquanto edita)
  var subModaisAbertos=['novoUsuarioOverlay','alterarSenhaOverlay'];
  var temSubModalAberto=subModaisAbertos.some(function(id){
    var el=document.getElementById(id);
    return el&&el.classList.contains('open');
  });
  if(temSubModalAberto) return;
  grid.innerHTML='<div style="color:var(--muted);font-size:13px;padding:20px 0;text-align:center;">Carregando...</div>';
  var membros={consultores:[],treinadores:[]};

  function _renderComUsuarios(usuarios){
    var ministrante=_getTurmaMinistante();
    if(ministrante&&usuarios){
      Object.keys(usuarios).forEach(function(uid){
        var u=usuarios[uid];
        if(u.nome&&u.nome.toUpperCase()===ministrante.toUpperCase()) u.perfil='ministrante';
        else if(u.perfil==='ministrante') u.perfil='treinador';
      });
    }
    /* alerta de usuários ainda com senha em texto plano */
    var alertEl=document.getElementById('usuariosAlertaLegado');
    if(alertEl&&usuarios){
      var legados=Object.values(usuarios).filter(function(u){ return u.senha&&!u.authUid; }).length;
      if(legados>0){
        alertEl.textContent='⚠ '+legados+' usuário'+(legados>1?'s ainda usam':'ainda usa')+' senha em modo legado. A migração ocorre automaticamente no próximo login de cada um.';
        alertEl.style.display='';
      } else {
        alertEl.style.display='none';
      }
    }
    /* Montar membros UNINDO duas fontes:
       1) contas em usuarios/ (têm login/senha/perfil)
       2) a equipe da turma (allConsultors/allTrainers) — garante que TODO
          consultor/treinador da turma apareça no painel, mesmo SEM conta
          em usuarios/ (aparece com dot "sem acesso"). Sem isto, um membro
          cuja gravação em usuarios/ falhou sumia do painel. */
    membros={consultores:[],treinadores:[],adms:[]};
    function _addUnico(lista,nome){
      if(!nome) return;
      var nn=String(nome).toUpperCase().trim();
      var existe=lista.some(function(n){ return String(n).toUpperCase().trim()===nn; });
      if(!existe) lista.push(nome);
    }
    Object.values(usuarios||{}).forEach(function(u){
      if(!u.nome) return;
      var perfil=u.perfil||'consultor';
      if(perfil==='adm') _addUnico(membros.adms, u.nome);
      else if(perfil==='consultor') _addUnico(membros.consultores, u.nome);
      else if(perfil==='treinador'||perfil==='ministrante') _addUnico(membros.treinadores, u.nome);
    });
    /* Une com a equipe da turma ativa */
    if(typeof allConsultors!=='undefined' && Array.isArray(allConsultors)){
      allConsultors.forEach(function(n){ _addUnico(membros.consultores, n); });
    }
    if(typeof allTrainers!=='undefined' && Array.isArray(allTrainers)){
      allTrainers.forEach(function(n){ if(n && n!=='-') _addUnico(membros.treinadores, n); });
    }
    _montarGrid(membros,usuarios||{});
  }

  function _buildLocal(){
    /* Fix: NÃO injetar membros da turma como usuários sintéticos.
       O painel de gestão de usuários reflete EXCLUSIVAMENTE o nó `usuarios/`.
       Membros da turma sem entrada em `usuarios/` aparecem nos demais módulos
       (como consultor/treinador) mas não devem aparecer aqui. */
    return _getUsuariosLocal();
  }

  var _done=false;
  var _timeout=setTimeout(function(){
    if(!_done){_done=true;_renderComUsuarios(_buildLocal());}
  },2000);

  if(window._fbGet){
    window._fbGet('usuarios').then(function(u){
      if(!_done){
        _done=true;clearTimeout(_timeout);
        // Firebase é fonte de verdade: usar apenas dados do Firebase
        // (não mesclar com local para evitar "fantasmas" de usuários excluídos)
        if(u&&Object.keys(u).length>0){
          _saveUsuariosLocal(u);
          _renderComUsuarios(u);
        } else {
          _renderComUsuarios({});
        }
      }
    }).catch(function(){
      if(!_done){_done=true;clearTimeout(_timeout);_renderComUsuarios(_buildLocal());}
    });
  } else {
    clearTimeout(_timeout);
    _renderComUsuarios(_buildLocal());
  }
}

function _getUsuariosLocal(){
  try{
    var u=JSON.parse(localStorage.getItem('ci_usuarios'));
    if(u&&typeof u==='object') return u;
  }catch(e){}
  // Fix 3: retornar objeto vazio — sem fallback hardcoded que causava usuários fantasma
  return {};
}

function _saveUsuariosLocal(u){
  try{localStorage.setItem('ci_usuarios',JSON.stringify(u));}catch(e){}
}

function _montarGrid(membros,usuarios){
  var grid=document.getElementById('usuariosGrid');
  if(!grid) return;

  // Ordenar alfabeticamente para evitar reordenação entre renders
  membros.consultores=membros.consultores.slice().sort(function(a,b){return a.localeCompare(b,'pt-BR',{sensitivity:'base'});});
  membros.treinadores=membros.treinadores.slice().sort(function(a,b){return a.localeCompare(b,'pt-BR',{sensitivity:'base'});});

  // Ministrante real da turma — fonte de verdade
  var _ministranteAtual=_getTurmaMinistante();

  function enc(s){return (s||'').replace(/"/g,'').replace(/'/g,'');}

  function _card(uid,u){
    var temLogin=!!(u.login&&u.senha);
    var ativo=u.ativo!==false;
    var congelado=u.congelado===true;
    var primAcesso=u.primeiroAcesso===true;
    var _ehMinistranteReal=u.perfil==='treinador'||u.perfil==='ministrante'
      ?(_ministranteAtual&&_ministranteAtual.toUpperCase()===(u.nome||'').toUpperCase())
      :false;
    var perfilCls=u.perfil==='consultor'?'consultor':_ehMinistranteReal?'ministrante':'treinador';
    var perfilL=u.perfil==='consultor'?'Consultor':_ehMinistranteReal?'Ministrante':'Treinador';
    var inicial=(u.nome||'?')[0].toUpperCase();
    var nomeU=(u.nome||'').toUpperCase();
    var loginTxt=u.login?'@'+u.login:'—';

    // bolinha de status — ordem: sem-acesso → pausado → congelado → pendente → ativo
    var dotCls=!temLogin?'sem-acesso':!ativo?'pausado':congelado?'congelado':primAcesso?'pendente':'ativo';
    var dotTip=!temLogin?'Sem acesso configurado'
      :!ativo?'⏸ Pausado — sem login + sumido dos selects'
      :congelado?'❄ Congelado — sem login MAS continua nos selects da turma'
      :primAcesso?'Primeiro acesso pendente'
      :'Ativo';

    // itens do dropdown — ONCLICK INLINE (robusto): o dropdown é movido pra
    // document.body (portal), e o addEventListener delegado às vezes não
    // disparava (bug do "excluir não funciona"). onclick inline sobrevive ao
    // portal e lê this.dataset, então sempre executa. enc() limpa aspas;
    // o nome (mesmo com acento) é lido de this.dataset.nome, nunca interpolado
    // no JS — seguro contra caracteres especiais.
    var FECHA='window._fecharUrDd&&window._fecharUrDd();';
    var ddItems='';
    if(!temLogin){
      ddItems='<button class="ur-dd-item" data-uid="'+uid+'" data-nome="'+enc(u.nome)+'" data-perfil="'+u.perfil+'" onclick="'+FECHA+'_abrirConfigurarAcesso(this.dataset.uid,this.dataset.nome,this.dataset.perfil)">⚙️ Configurar acesso</button>'
        +'<button class="ur-dd-item" data-uid="'+uid+'" data-nome="'+enc(u.nome)+'" data-perfil="'+u.perfil+'" data-ativo="'+(ativo?'true':'false')+'" onclick="'+FECHA+'_toggleAtivo(this.dataset.uid,this.dataset.ativo!==&quot;true&quot;,this.dataset.nome,this.dataset.perfil)">'+(ativo?'⏸ Pausar usuário':'▶ Reativar usuário')+'</button>';
    } else {
      ddItems='<button class="ur-dd-item" data-uid="'+uid+'" onclick="'+FECHA+'_abrirEditarAcesso(this.dataset.uid)">✏️ Editar</button>'
        +'<button class="ur-dd-item" data-uid="'+uid+'" data-nome="'+enc(nomeU)+'" onclick="'+FECHA+'_abrirAlterarSenhaUsuario(this.dataset.uid,this.dataset.nome)">🔑 Alterar senha</button>'
        +'<button class="ur-dd-item" data-uid="'+uid+'" data-nome="'+enc(u.nome)+'" onclick="'+FECHA+'resetarSenhaUsuario(this.dataset.uid,this.dataset.nome)">🔁 Resetar senha</button>'
        +'<hr class="ur-dd-sep">'
        +'<button class="ur-dd-item" data-uid="'+uid+'" data-nome="'+enc(u.nome)+'" data-perfil="'+u.perfil+'" onclick="'+FECHA+'abrirPermsModal(this.dataset.uid,this.dataset.nome,this.dataset.perfil)">🔒 Permissões</button>'
        +'<button class="ur-dd-item" data-uid="'+uid+'" data-congelado="'+(congelado?'true':'false')+'" onclick="'+FECHA+'_toggleCongelado(this.dataset.uid,this.dataset.congelado!==&quot;true&quot;)">'+(congelado?'☀ Descongelar':'❄ Congelar')+'</button>'
        +'<button class="ur-dd-item" data-uid="'+uid+'" data-ativo="'+(ativo?'true':'false')+'" onclick="'+FECHA+'_toggleAtivo(this.dataset.uid,this.dataset.ativo!==&quot;true&quot;)">'+(ativo?'⏸ Pausar acesso':'▶ Ativar acesso')+'</button>';
    }
    ddItems+='<hr class="ur-dd-sep"><button class="ur-dd-item danger" data-uid="'+uid+'" data-nome="'+enc(u.nome)+'" onclick="'+FECHA+'_excluirUsuario(this.dataset.uid,this.dataset.nome)">🗑 Excluir usuário</button>';

    return '<div class="usuario-row" data-nome="'+nomeU+'" data-ativo="'+(ativo?'true':'false')+'">'
      +'<div class="ur-avatar '+perfilCls+'">'+inicial+'</div>'
      +'<div class="ur-info">'
        +'<div class="ur-nome">'+nomeU+'</div>'
        +'<div class="ur-login">'+loginTxt+'</div>'
      +'</div>'
      +'<span class="ur-badge badge-'+perfilCls+'">'+perfilL+'</span>'
      +'<div class="ur-dot '+dotCls+'" title="'+dotTip+'"></div>'
      +'<div class="ur-acoes">'
        +'<button class="ur-menu-btn" data-uid="'+uid+'" data-dd="'+uid+'">⋯</button>'
      +'</div>'
      +'<div class="ur-dd-data" data-uid="'+uid+'" style="display:none;">'+ddItems+'</div>'
    +'</div>';
  }

  function encontrar(nome,perfil){
    return Object.entries(usuarios).find(function(e){
      return e[1].nome&&e[1].nome.toUpperCase()===nome.toUpperCase()&&e[1].perfil===perfil;
    });
  }

  function uid_(perfil,nome){
    return perfil+'_'+_normalizeUid(nome);
  }

  // ── Busca ─────────────────────────────────────────────────────
  var html='';

  /* Pausados (ativo===false) saem das seções normais e vão para a seção
     "⏸ Pausados" no fim do painel — somem do resto do app, mas continuam
     reativáveis por aqui. */
  var _pausados=[];
  function _soAtivos(lista){
    return lista.filter(function(entry){
      if(entry&&entry[1]&&entry[1].ativo===false){ _pausados.push(entry); return false; }
      return true;
    });
  }

  // Barra de busca (span grid-column:1/-1)
  html+='<div style="grid-column:1/-1;margin-bottom:8px;">'
    +'<input id="usuariosBusca" type="text" placeholder="🔍  Buscar usuário..." autocomplete="off"'
    +' oninput="_filtrarUsuariosGrid(this.value)"'
    +' style="width:100%;box-sizing:border-box;padding:8px 14px;border-radius:var(--radius-sm);'
    +'border:1px solid var(--border2);background:var(--surface2);color:var(--text);'
    +'font-family:\'DM Sans\',sans-serif;font-size:13px;outline:none;">'
    +'</div>';

  /* (Bloco "⚡ Acesso rápido" removido a pedido — poluía o topo do modal.) */

  function _secaoHeader(titulo, count, perfil){
    return '<div class="ur-secao-header">'
      +'<div class="ur-secao-titulo">'+titulo+'<span class="ur-secao-count">'+count+'</span></div>'
      +'<button class="btn-perms-grupo" data-perfil="'+perfil+'" style="background:none;border:1px solid var(--border2);border-radius:var(--radius-sm);cursor:pointer;font-size:11px;padding:3px 10px;color:var(--muted);">🔒 Permissões</button>'
      +'</div>';
  }

  /* Fix: só renderiza membros que TÊM entrada em `usuarios/`.
     Membro de turma sem cadastro em `usuarios/` (ou recém-excluído)
     NÃO deve aparecer no painel de gestão — `encontrar()` decide. */
  var admsValidos=_soAtivos(((membros.adms&&membros.adms.length)?membros.adms.slice().sort(function(a,b){return a.localeCompare(b,'pt-BR',{sensitivity:'base'});}):[])
    .map(function(nome){return encontrar(nome,'adm');}).filter(Boolean));

  /* Resolve [uid, dados] de um membro: usa a conta de usuarios/ se existir,
     senão cria um placeholder "sem acesso" (login/senha vazios). Garante que
     membro da turma sem conta apareça no painel pra poder configurar/excluir. */
  function _resolverMembro(nome, perfil){
    var e = encontrar(nome, perfil);
    if(!e && perfil==='treinador') e = encontrar(nome, 'ministrante');
    if(e) return e;
    return [ uid_(perfil, nome), {nome:nome, perfil:perfil, login:'', senha:'', ativo:true} ];
  }

  var consValidos=_soAtivos(membros.consultores.map(function(nome){return _resolverMembro(nome,'consultor');}));
  var treinValidos=_soAtivos(membros.treinadores.map(function(nome){return _resolverMembro(nome,'treinador');}));

  /* Fix: garantir que TODO usuário em `usuarios/` apareça no painel.
     Usuários com perfil ausente/desconhecido (não-adm/consultor/treinador/ministrante)
     eram descartados silenciosamente — agora caem num grupo "Outros". */
  var jaRenderizados={};
  admsValidos.forEach(function(e){ jaRenderizados[e[0]]=1; });
  consValidos.forEach(function(e){ jaRenderizados[e[0]]=1; });
  treinValidos.forEach(function(e){ jaRenderizados[e[0]]=1; });
  _pausados.forEach(function(e){ jaRenderizados[e[0]]=1; });
  var outros=_soAtivos(Object.entries(usuarios||{}).filter(function(e){
    return e[1]&&!jaRenderizados[e[0]];
  }).sort(function(a,b){return (a[1].nome||'').localeCompare(b[1].nome||'','pt-BR',{sensitivity:'base'});}));
  // garantir nome placeholder para exibição
  outros.forEach(function(e){ if(!e[1].nome) e[1].nome='(sem nome — uid: '+e[0]+')'; });

  /* ── LAYOUT: navegação lateral (perfis + status) ──
     Coluna à esquerda com contadores; só o grupo selecionado renderiza
     visível à direita. Bloco STATUS filtra por situação (Ativo,
     1º acesso pendente, Pausado, Sem acesso) — Pausado aparece SOMENTE
     por aqui (único lugar do app). */
  var grupos=[
    {id:'consultor', ico:'🟢', titulo:'Consultores', perfil:'consultor', entries:consValidos},
    {id:'treinador', ico:'🟡', titulo:'Treinadores', perfil:'treinador', entries:treinValidos}
  ];
  if(admsValidos.length) grupos.push({id:'adm', ico:'⭐', titulo:'ADM', perfil:'adm', entries:admsValidos});
  if(outros.length) grupos.push({id:'outros', ico:'❔', titulo:'Outros', perfil:'outros', entries:outros});
  var totalAtivos=grupos.reduce(function(s,g){return s+g.entries.length;},0);

  /* Status de cada usuário — pausado tem prioridade sobre os demais */
  function _statusDe(u){
    if(u.ativo===false) return 'pausado';
    if(!(u.login&&u.senha)) return 'sem-acesso';
    if(u.congelado===true) return 'congelado';
    if(u.primeiroAcesso===true) return 'pendente';
    return 'ativo';
  }
  var statusListas={'ativo':[],'pendente':[],'pausado':[],'sem-acesso':[]};
  grupos.forEach(function(g){ g.entries.forEach(function(e){
    var st=_statusDe(e[1]||{}); if(statusListas[st]) statusListas[st].push(e);
  });});
  _pausados.forEach(function(e){ if(!e[1].nome) e[1].nome='(sem nome — uid: '+e[0]+')'; statusListas['pausado'].push(e); });
  Object.keys(statusListas).forEach(function(k){
    statusListas[k].sort(function(a,b){return (a[1].nome||'').localeCompare(b[1].nome||'','pt-BR',{sensitivity:'base'});});
  });
  var statusDefs=[
    {id:'st-ativo',    dot:'ativo',      titulo:'Ativo',              lista:statusListas['ativo']},
    {id:'st-pendente', dot:'pendente',   titulo:'1º acesso pendente', lista:statusListas['pendente']},
    {id:'st-pausado',  dot:'pausado',    titulo:'Pausado',            lista:statusListas['pausado']},
    {id:'st-sem',      dot:'sem-acesso', titulo:'Sem acesso',         lista:statusListas['sem-acesso']}
  ];

  var grupoSel='consultor';
  try{ grupoSel=localStorage.getItem('urGrupoSel')||'consultor'; }catch(e){}
  var _selValida=(grupoSel==='todos')
    ||grupos.some(function(g){return g.id===grupoSel;})
    ||statusDefs.some(function(s){return s.id===grupoSel;});
  if(!_selValida) grupoSel='consultor';

  html+='<div class="ur-split">';
  /* Coluna lateral */
  html+='<div class="ur-side">';
  html+='<div class="ur-side-lbl">Perfil</div>';
  grupos.forEach(function(g){
    html+='<button type="button" class="ur-side-item'+((grupoSel===g.id)?' on':'')+'" data-grupo="'+g.id+'" onclick="_urSelGrupo(this.dataset.grupo)">'
      +g.ico+' '+g.titulo+'<span class="ur-side-num">'+g.entries.length+'</span></button>';
  });
  html+='<button type="button" class="ur-side-item'+((grupoSel==='todos')?' on':'')+'" data-grupo="todos" onclick="_urSelGrupo(this.dataset.grupo)">👥 Todos<span class="ur-side-num">'+totalAtivos+'</span></button>';
  html+='<hr class="ur-side-sep">';
  html+='<div class="ur-side-lbl">Status</div>';
  statusDefs.forEach(function(s){
    html+='<button type="button" class="ur-side-item'+((grupoSel===s.id)?' on':'')+'" data-grupo="'+s.id+'" onclick="_urSelGrupo(this.dataset.grupo)">'
      +'<span class="ur-dot '+s.dot+'"></span>'+s.titulo+'<span class="ur-side-num">'+s.lista.length+'</span></button>';
  });
  html+='</div>';

  /* Painel principal — grupos de perfil */
  html+='<div class="ur-main">';
  grupos.forEach(function(g){
    var vis=(grupoSel==='todos'||grupoSel===g.id);
    html+='<div class="ur-grp'+(vis?' on':'')+'" data-grupo="'+g.id+'">';
    html+=_secaoHeader(g.titulo, g.entries.length, g.perfil);
    html+='<div class="ur-grp-lista">'
      +(g.entries.length?g.entries.map(function(e){return _card(e[0],e[1]);}).join(''):'<div class="ur-vazio">Nenhum usuário.</div>')
      +'</div></div>';
  });
  /* Painéis de STATUS (sem botão Permissões — permissão é por perfil) */
  statusDefs.forEach(function(s){
    var vis=(grupoSel===s.id);
    html+='<div class="ur-grp ur-grp-status'+(vis?' on':'')+'" data-grupo="'+s.id+'">';
    html+='<div class="ur-secao-header"><div class="ur-secao-titulo"><span class="ur-dot '+s.dot+'"></span>'+s.titulo
      +'<span class="ur-secao-count">'+s.lista.length+'</span></div>'
      +(s.id==='st-pausado'?'<span style="font-size:10.5px;color:var(--muted);">ocultos de todo o aplicativo</span>':'')
      +'</div>';
    html+='<div class="ur-grp-lista"'+(s.id==='st-pausado'?' style="opacity:.65;"':'')+'>'
      +(s.lista.length?s.lista.map(function(e){return _card(e[0],e[1]);}).join(''):'<div class="ur-vazio">Nenhum usuário.</div>')
      +'</div></div>';
  });
  html+='</div>'; /* /ur-main */
  html+='</div>'; /* /ur-split */

  grid.innerHTML=html;

  // ── Dropdown no body (evita clipping do overflow do grid) ──
  window._fecharUrDd=function(){
    var dd=document.getElementById('_urBodyDd');
    if(dd) dd.remove();
  };

  function _abrirUrDd(menuBtn){
    _fecharUrDd();
    var uid=menuBtn.dataset.uid;
    var ddData=document.querySelector('.ur-dd-data[data-uid="'+uid+'"]');
    if(!ddData) return;
    var rect=menuBtn.getBoundingClientRect();
    var dd=document.createElement('div');
    dd.id='_urBodyDd';
    dd.innerHTML=ddData.innerHTML;
    dd.style.cssText='position:fixed;z-index:9999;background:#12201200;border:1px solid #2a3a2a;border-radius:10px;'
      +'min-width:180px;box-shadow:0 8px 40px rgba(0,0,0,.9);overflow:hidden;'
      +'right:'+(window.innerWidth-rect.right)+'px;top:'+(rect.bottom+4)+'px;';
    // fundo sólido via elemento filho
    dd.style.background='#12201f';
    dd.style.background='#111d11';
    document.body.appendChild(dd);

    // ações
    dd.addEventListener('click',function(e){
      var btn=e.target.closest('button');
      if(!btn) return;
      window._fecharUrDd();
      if(btn.classList.contains('btn-configurar-acesso')){
        _abrirConfigurarAcesso(btn.dataset.uid, btn.dataset.nome, btn.dataset.perfil);
      } else if(btn.classList.contains('btn-editar-acesso')){
        _abrirEditarAcesso(btn.dataset.uid);
      } else if(btn.classList.contains('btn-alterar-senha')){
        _abrirAlterarSenhaUsuario(btn.dataset.uid, btn.dataset.nome);
      } else if(btn.classList.contains('btn-reset-senha')){
        resetarSenhaUsuario(btn.dataset.uid, btn.dataset.nome);
      } else if(btn.classList.contains('btn-toggle-ativo')){
        _toggleAtivo(btn.dataset.uid, btn.dataset.ativo==='true'?false:true);
      } else if(btn.classList.contains('btn-toggle-congelado')){
        _toggleCongelado(btn.dataset.uid, btn.dataset.congelado==='true'?false:true);
      } else if(btn.classList.contains('btn-excluir-usuario')){
        _excluirUsuario(btn.dataset.uid, btn.dataset.nome);
      } else if(btn.classList.contains('btn-perms')){
        abrirPermsModal(btn.dataset.uid, btn.dataset.nome, btn.dataset.perfil);
      }
    });
  }

  // Fechar ao clicar fora — registrar apenas uma vez
  // Usamos 'mousedown' (não 'click') porque vários onclick inline no app
  // chamam event.stopPropagation(), o que impediria o bubble do click
  // chegar ao document. mousedown dispara antes do click e não é
  // interceptado por esses handlers, fechando o dropdown de forma confiável.
  if(!window._urDdCloseHandler){
    window._urDdCloseHandler=function(e){
      if(!document.getElementById('_urBodyDd')) return;
      if(e.target.closest('#_urBodyDd')) return;
      if(e.target.closest('.ur-menu-btn')) return;
      window._fecharUrDd();
    };
    document.addEventListener('mousedown',window._urDdCloseHandler);
  }

  // Event delegation do grid
  if(grid._urClickHandler) grid.removeEventListener('click',grid._urClickHandler);
  grid._urClickHandler=function(e){
    var menuBtn=e.target.closest('.ur-menu-btn:not(.btn-criar-acesso-membro)');
    if(menuBtn){ e.stopPropagation(); _abrirUrDd(menuBtn); return; }
    window._fecharUrDd();
    var btn=e.target.closest('button');
    if(!btn) return;
    if(btn.classList.contains('btn-perms-grupo')) abrirPermsGrupo(btn.dataset.perfil);
    if(btn.classList.contains('btn-criar-acesso-membro')){
      _abrirCriarAcessoMembro(btn.dataset.nome);
    }
  };
  grid.addEventListener('click',grid._urClickHandler);
}

/* ── Recentes / Busca de usuários ──────────────────────────── */
function _getUsuariosRecentes(){
  try{ var r=JSON.parse(localStorage.getItem('ci_usuarios_recentes')); return Array.isArray(r)?r:[]; }catch(e){ return []; }
}
function _addUsuarioRecente(uid,nome,perfil){
  var lista=_getUsuariosRecentes().filter(function(r){ return r.uid!==uid; });
  lista.unshift({uid:uid,nome:nome,perfil:perfil});
  if(lista.length>5) lista=lista.slice(0,5);
  try{ localStorage.setItem('ci_usuarios_recentes',JSON.stringify(lista)); }catch(e){}
}
function _filtrarUsuariosGrid(q){
  var t=(q||'').trim().toUpperCase();
  /* Busca ativa: classe .ur-buscando revela TODOS os grupos (e pausados)
     para o filtro ser global; ao limpar, volta ao grupo selecionado. */
  var grid=document.getElementById('usuariosGrid');
  if(grid) grid.classList.toggle('ur-buscando', !!t);
  document.querySelectorAll('#usuariosGrid .usuario-row').forEach(function(row){
    var nome=(row.dataset.nome||'').toUpperCase();
    row.style.display=(!t||nome.indexOf(t)>=0)?'':'none';
  });
}

/* ── Navegação lateral da Gestão de Usuários ── */
function _urSelGrupo(id){
  try{ localStorage.setItem('urGrupoSel',id); }catch(e){}
  var grid=document.getElementById('usuariosGrid'); if(!grid) return;
  grid.querySelectorAll('.ur-side-item').forEach(function(b){
    b.classList.toggle('on', b.dataset.grupo===id);
  });
  grid.querySelectorAll('.ur-grp').forEach(function(g){
    g.classList.toggle('on', id==='todos'||g.dataset.grupo===id);
  });
}
window._urSelGrupo=_urSelGrupo;
function _loginRapido(uid){
  // Abre modal de senha pré-preenchendo o login do usuário recente
  var recentes=_getUsuariosRecentes();
  var r=recentes.find(function(x){ return x.uid===uid; });
  if(!r) return;
  // Simular clique no botão Editar do card desse usuário
  var btn=document.querySelector('#usuariosGrid .usuario-card[data-nome="'+r.nome.toUpperCase()+'"] .btn-editar-acesso, #usuariosGrid .usuario-card[data-nome="'+r.nome.toUpperCase()+'"] .btn-configurar-acesso');
  if(btn){ btn.click(); return; }
  // Fallback: foca no campo de login padrão se existir
  var inp=document.getElementById('usuarioLoginInput');
  if(inp){ inp.value=r.nome.split(' ')[0].toLowerCase(); inp.focus(); }
}

function _abrirConfigurarAcesso(uid,nome,perfil){
  document.getElementById('novoUsuarioUid').value=uid;
  document.getElementById('novoUsuarioTitulo').textContent='Configurar acesso';
  document.getElementById('novoUsuarioNome').value=nome;
  document.getElementById('novoUsuarioPerfil').value=perfil;
  var _localU=_getUsuariosLocal();
  document.getElementById('novoUsuarioWhatsapp').value=(_localU[uid]&&_localU[uid].whatsapp)||'';
  var _chkP=document.getElementById('novoUsuarioPausado');
  if(_chkP) _chkP.checked=!!(_localU[uid]&&_localU[uid].ativo===false);
  var loginSugerido=nome.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g,'');
  document.getElementById('novoUsuarioLogin').value=loginSugerido;
  document.getElementById('novoUsuarioSenha').value='';
  document.getElementById('campoVinculo').style.display='none';
  document.getElementById('novoUsuarioOverlay').classList.add('open');
  setTimeout(function(){document.getElementById('novoUsuarioSenha').focus();},100);
}

function _abrirCriarAcessoMembro(nome){
  // Membro da turma sem conta — gera UID temporário baseado no nome
  var uid='membro_'+nome.toLowerCase().replace(/[^a-z0-9]/g,'_')+'_'+Date.now();
  _abrirConfigurarAcesso(uid, nome.toUpperCase(), 'consultor');
}

function _abrirEditarAcesso(uid){
  function _preencherModal(u){
    if(!u){alert('Usuario nao encontrado.');return;}
    document.getElementById('novoUsuarioUid').value=uid;
    document.getElementById('novoUsuarioTitulo').textContent='Editar acesso';
    document.getElementById('novoUsuarioNome').value=(u.nome||'').toUpperCase();
    document.getElementById('novoUsuarioPerfil').value=u.perfil||'treinador';
    document.getElementById('novoUsuarioLogin').value=u.login||'';
    document.getElementById('novoUsuarioSenha').value='';
    var _chkP=document.getElementById('novoUsuarioPausado');
    if(_chkP) _chkP.checked=(u.ativo===false);
    document.getElementById('campoVinculo').style.display='none';
    document.getElementById('novoUsuarioOverlay').classList.add('open');
  }
  // Tentar local primeiro
  var local=_getUsuariosLocal();
  if(local[uid]){_preencherModal(local[uid]);return;}
  // Firebase com timeout
  if(window._fbGet){
    var _done=false;
    var _t=setTimeout(function(){if(!_done){_done=true;alert('Firebase indisponível.');}},3000);
    window._fbGet('usuarios/'+uid).then(function(u){
      if(!_done){_done=true;clearTimeout(_t);_preencherModal(u);}
    }).catch(function(){
      if(!_done){_done=true;clearTimeout(_t);alert('Erro ao buscar usuário.');}
    });
  } else {
    alert('Usuario nao encontrado.');
  }
}

function _abrirAlterarSenhaUsuario(uid,nome){
  document.getElementById('alterarSenhaUid').value=uid;
  document.getElementById('alterarSenhaSub').textContent='Nova senha para '+nome+'.';
  document.getElementById('alterarSenhaNova').value='';
  document.getElementById('alterarSenhaOverlay').classList.add('open');
  setTimeout(function(){document.getElementById('alterarSenhaNova').focus();},100);
}

function _toggleCongelado(uid,novoEstado){
  var msg=novoEstado
    ?'CONGELAR este usuário?\n\nEle NÃO conseguirá fazer login, MAS continuará aparecendo\nnos selects da turma para que você possa mover clientes vinculados.\n\nUse PAUSAR se quiser sumir totalmente dos selects.'
    :'Descongelar este usuário? Ele voltará a conseguir logar.';
  if(!confirm(msg)) return;
  window._fbSave('usuarios/'+uid+'/congelado',novoEstado).then(function(){
    _renderUsuariosGrid();
    if(typeof _showToast==='function'){
      _showToast(novoEstado?'❄ Login bloqueado (mantido nos selects)':'☀ Usuário descongelado','var(--blue)');
    }
    /* Audit-log */
    if(typeof _addPendLog==='function'){
      _addPendLog(novoEstado?'Usuário congelado (só login)':'Usuário descongelado','UID: '+uid,novoEstado?'❄':'☀');
    }
    /* Não toca em allConsultors/allTrainers — congelar NÃO remove dos selects.
       Apenas o login (29-login.js) é bloqueado via u.congelado === true. */
  }).catch(function(e){alert('Erro: '+(e&&e.message?e.message:e));});
}

/* ── PROPAGAÇÃO IMEDIATA de pausados ──
   Atualiza cache de pausados e remove dos selects/arrays da turma ativa.
   Usada pelo _toggleAtivo E pelo salvarUsuario (checkbox Pausado do modal). */
function _propagarPausados(){
  try {
    window._fbGet && window._fbGet('usuarios').then(function(us){
      var blqSet = new Set();
      Object.values(us||{}).forEach(function(u){
        if(u && u.nome && u.ativo === false){
          blqSet.add(String(u.nome).toUpperCase().trim());
        }
      });
      window._pausadosNomesSet = blqSet;
      window._bloqueadosNomesSet = blqSet;
      // Remove imediatamente dos arrays globais
      if(typeof allConsultors !== 'undefined' && Array.isArray(allConsultors)){
        allConsultors = allConsultors.filter(function(n){ return !blqSet.has(String(n||'').toUpperCase().trim()); });
        window.allConsultors = allConsultors;
      }
      if(typeof allTrainers !== 'undefined' && Array.isArray(allTrainers)){
        allTrainers = allTrainers.filter(function(n){ return !blqSet.has(String(n||'').toUpperCase().trim()); });
        window.allTrainers = allTrainers;
      }
      // Re-render dos selects/filtros
      if(typeof buildSelects==='function')    buildSelects();
      if(typeof buildFilterBtns==='function') buildFilterBtns();
      if(typeof renderAll==='function')       renderAll();
    });
  } catch(e){}
}

function _toggleAtivo(uid,novoEstado,nome,perfil){
  var msg=novoEstado
    ?'Reativar este usuário?\n\nEle voltará a aparecer no aplicativo e poderá logar.'
    :'PAUSAR este usuário?\n\nEle não conseguirá logar e SOME de todos os locais do aplicativo\n(selects, cards, rankings). Para reativar, use a seção "Pausados"\nno fim da Gestão de Usuários.';
  if(!confirm(msg)) return;
  /* Membro da turma sem conta em usuarios/: grava nome+perfil junto com o
     ativo, senão o registro fica sem nome e o filtro global (que casa por
     nome) não enxerga o pausado. Para conta existente o merge é inócuo. */
  var op = (nome && window._fbUpdate)
    ? window._fbUpdate('usuarios/'+uid,{nome:nome,perfil:perfil||'consultor',ativo:novoEstado})
    : window._fbSave('usuarios/'+uid+'/ativo',novoEstado);
  op.then(function(){
    _renderUsuariosGrid();
    _propagarPausados();
    if(typeof _showToast==='function'){
      _showToast(novoEstado?'▶ Usuário reativado':'⏸ Usuário pausado — some de todo o app','var(--blue)');
    }
  }).catch(function(e){alert('Erro: '+(e&&e.message?e.message:e));});
}

async function salvarUsuario(){
  var uid   = document.getElementById('novoUsuarioUid').value.trim();
  var nome  = document.getElementById('novoUsuarioNome').value.trim().toUpperCase();
  var login = document.getElementById('novoUsuarioLogin').value.trim().toLowerCase();
  var senhaEl = document.getElementById('novoUsuarioSenha');
  var senha = (senhaEl&&senhaEl.value) ? senhaEl.value.trim() : '';
  var perfil  = document.getElementById('novoUsuarioPerfil').value || 'consultor';
  var whatsapp= (document.getElementById('novoUsuarioWhatsapp')||{value:''}).value.replace(/\D/g,'');

  // ── Validações ──────────────────────────────────────────────
  if(!nome){_showToast('❌ Nome obrigatório.','var(--red)');return;}
  if(!login||login.length<2){_showToast('❌ Login deve ter pelo menos 2 caracteres.','var(--red)');return;}
  if(!senha||senha.length<3){_showToast('❌ Senha deve ter pelo menos 3 caracteres.','var(--red)');return;}

  // ── Fix 3: Verificar duplicidade ────────────────────────────
  var local = _getUsuariosLocal();
  /* UPSERT: se o UID veio vazio (fluxo de auto-acesso / configurar acesso)
     mas já existe uma conta com o MESMO nome (e perfil compatível), reusa
     esse UID. Sem isto, configurar acesso de quem já tem conta — ex.:
     consultor criado silenciosamente na importação, ou re-configuração —
     era tratado como NOVO e colidia com a própria conta ("login já em uso").
     treinador↔ministrante são compatíveis. */
  if(!uid){
    var _uidExistente = Object.keys(local).find(function(k){
      var u = local[k];
      if(!u || !u.nome || u.nome.toUpperCase() !== nome) return false;
      if(!u.perfil) return true;
      if(u.perfil === perfil) return true;
      return (perfil === 'treinador' && u.perfil === 'ministrante');
    });
    if(_uidExistente) uid = _uidExistente;
  }
  var existentes = Object.values(local);
  var nomeJaExiste = existentes.some(function(u){
    return u.nome&&u.nome.toUpperCase()===nome && (!uid || Object.keys(local).find(function(k){return local[k]===u;})!==uid);
  });
  var loginJaExiste = existentes.some(function(u){
    return u.login&&u.login.toLowerCase()===login && (!uid || Object.keys(local).find(function(k){return local[k]===u;})!==uid);
  });
  if(nomeJaExiste){_showToast('❌ Já existe um usuário com este nome.','var(--red)');return;}
  if(loginJaExiste){_showToast('❌ Este login já está em uso.','var(--red)');return;}

  // ── Montar objeto ────────────────────────────────────────────
  var isNovo = !uid || !local[uid];
  if(!uid) uid = (perfil==='consultor'?'consultor_':'treinador_')+_normalizeUid(nome);
  var jaExiste = local[uid];
  /* Checkbox "Pausado" do modal: ativo = !pausado. Antes gravava ativo:true
     fixo, o que REATIVAVA silenciosamente um usuário pausado ao editar. */
  var _pausadoChk = document.getElementById('novoUsuarioPausado');
  var _ficaPausado = !!(_pausadoChk && _pausadoChk.checked);
  var dados = {
    nome:nome, login:login, senha:senha, perfil:perfil,
    ativo:!_ficaPausado, vinculo:nome, whatsapp:whatsapp,
    primeiroAcesso: isNovo ? true : (jaExiste&&jaExiste.primeiroAcesso)||false,
    updatedAt: Date.now()
  };
  if(isNovo) dados.createdAt = Date.now();

  // ── Fix 2: Salvar no Firebase PRIMEIRO, depois local ────────
  var salvoNoFirebase = false;
  if(window._fbSave||window._fbUpdate){
    try{
      var fbOp = window._fbUpdate
        ? window._fbUpdate('usuarios/'+uid, dados)
        : window._fbSave('usuarios/'+uid, dados);
      await fbOp;
      salvoNoFirebase = true;
      // Criar conta Firebase Auth para novos usuários
      if(isNovo && typeof window._fbAuthCreate==='function'){
        try{
          var authCred = await window._fbAuthCreate(_loginToEmail(login), senha);
          await window._fbUpdate('usuarios/'+uid,{authUid:authCred.user.uid});
        }catch(authErr){
          // Conta pode já existir (criada anteriormente) — não é erro crítico
          console.warn('[salvarUsuario] Auth create:',authErr.code||authErr.message);
        }
      }
    }catch(e){
      console.error('[salvarUsuario] Firebase erro:',e);
      _showToast('⚠️ Firebase indisponível. Salvo localmente.','var(--amber)');
    }
  }

  // ── Atualizar estado local ───────────────────────────────────
  local[uid] = dados;
  _saveUsuariosLocal(local);

  // ── Fechar modal e atualizar UI ──────────────────────────────
  /* Marca que SALVOU (impede o alerta "ficou fantasma" do fluxo auto-acesso) */
  window._autoAcessoEmAndamento = null;
  document.getElementById('novoUsuarioOverlay').classList.remove('open');
  _renderUsuariosGrid();
  _propagarPausados();
  _showToast('✅ '+(isNovo?'Acesso criado':'Acesso atualizado')+' para '+nome+'!'+(_ficaPausado?' (⏸ pausado)':'')+(salvoNoFirebase?' ☁️':''),'var(--accent)');
  /* Encadeia próximo pendente de auto-criação (caso o adm tenha adicionado vários
     consultores/treinadores em lote via "🧙 Novos Membros"). */
  if(typeof window._autoAcessoProxPendente === 'function'){
    setTimeout(window._autoAcessoProxPendente, 100);
  }
}

function abrirEditarUsuario(uid){_abrirEditarAcesso(uid);}
function abrirNovoUsuario(){
  var _chkP=document.getElementById('novoUsuarioPausado');
  if(_chkP) _chkP.checked=false;
  document.getElementById('novoUsuarioOverlay').classList.add('open');
}
function fecharNovoUsuario(){
  document.getElementById('novoUsuarioOverlay').classList.remove('open');
  /* Se foi aberto pelo fluxo auto-acesso e o adm fechou SEM salvar,
     pergunta o que fazer com o nome adicionado à turma. */
  if(typeof window._autoAcessoFechouSemSalvar === 'function'){
    setTimeout(window._autoAcessoFechouSemSalvar, 50);
  }
}
function _excluirUsuario(uid,nome){
  if(!confirm('Excluir "'+nome+'"?\nRemove o acesso (login) E desvincula da turma (cards de consultor/treinador).\nClientes já vinculados mantêm o nome no histórico.\n\nEsta ação não pode ser desfeita.')) return;
  var local=_getUsuariosLocal();
  /* Nome CONFIÁVEL: prioriza o nome salvo na própria conta (uid), caindo
     pro param só se não houver conta. Evita falha quando o data-nome do
     botão chega vazio/divergente e _removerDaEquipe não casaria. */
  var nomeReal = (local[uid] && local[uid].nome) ? local[uid].nome : nome;
  if(local[uid]){ delete local[uid]; _saveUsuariosLocal(local); }
  /* SYNC inverso: ação TOTAL — remove de allConsultors E allTrainers (null
     = força os dois). Usa o nome confiável (não o do botão). */
  if(window._removerDaEquipe) window._removerDaEquipe(nomeReal, null);
  /* GARANTIA DE PERSISTÊNCIA: grava o nó da turma no Firebase EXPLICITAMENTE
     com os arrays já filtrados. Antes dependia só de _atualizarEquipeTurma
     (dentro de _removerDaEquipe) — se aquele não rodasse (mexeu=false por
     nome divergente), o nó turmas/{id}/consultores ficava com o nome e ele
     voltava no reload. Aqui forçamos a gravação após a remoção. */
  var _ta = window._turmaAtiva || (typeof _turmaAtiva!=='undefined' ? _turmaAtiva : null);
  if(window._fbSave && _ta && _ta.id){
    var _TN=(typeof TURMAS_NODE!=='undefined')?TURMAS_NODE:'turmas';
    try{ window._fbSave(_TN+'/'+_ta.id+'/consultores', (window.allConsultors||[]).slice()); }catch(e){}
    try{ window._fbSave(_TN+'/'+_ta.id+'/treinadores', (window.allTrainers||[]).slice()); }catch(e){}
  }
  if(window._fbSave){
    window._fbSave('usuarios/'+uid,null).then(function(){
      _showToast('🗑 '+nomeReal+' removido (acesso + turma).','var(--accent)');
      _renderUsuariosGrid();
    }).catch(function(e){
      _showToast('❌ Erro ao excluir: '+(e&&e.message?e.message:String(e)),'var(--red)');
    });
  } else {
    _renderUsuariosGrid();
  }
}
function excluirUsuario(uid,nome){_excluirUsuario(uid,nome);}
function abrirAlterarSenha(uid,nome){_abrirAlterarSenhaUsuario(uid,nome);}
function confirmarAlterarSenha(){
  var uid=document.getElementById('alterarSenhaUid').value;
  var nova=document.getElementById('alterarSenhaNova').value.trim();
  if(!nova||nova.length<3){alert('Senha deve ter pelo menos 3 caracteres.');return;}
  if(uid==='adm'){
    localStorage.setItem('ci_adm_senha',nova);
    document.getElementById('alterarSenhaOverlay').classList.remove('open');
    alert('Senha do ADM alterada!');
  } else {
    window._fbSave('usuarios/'+uid+'/senha',nova).then(function(){
      document.getElementById('alterarSenhaOverlay').classList.remove('open');
      _renderUsuariosGrid();
      alert('Senha alterada!');
    }).catch(function(e){alert('Erro: '+e.message);});
  }
}

/* ============================================================
   FECHAR MODAIS USUARIOS AO CLICAR FORA
============================================================ */
/* ═══════════════════════════════════════════
   FECHAR MODAIS AO CLICAR FORA
═══════════════════════════════════════════ */
/* Fix 5: novoUsuarioOverlay e alterarSenhaOverlay NÃO fecham ao clicar fora —
   somente via botões "Cancelar" ou "Salvar" */
/* Consultor/Treinador (modais Editar e Novo): só fecham pelo botão dedicado —
   evita perda do digitado se o usuário clicar fora por engano. */
['modalOverlay','addModalOverlay','titleModalOverlay','infoModalOverlay','periodModalOverlay','clientInfoOverlay','confirmOverlay','novaTurmaOverlay','pagosModalOverlay','clientesModalOverlay','pdfExportOverlay','pendLogOverlay','permsModalOverlay','pdfClientesOverlay','propostaOverlay','propProdOverlay','gerenciarTurmasOverlay','salvarComoOverlay','clienteDetalheOverlay','syncModalOverlay'].forEach(id=>{
  const el=document.getElementById(id);if(el)el.addEventListener('click',e=>{if(e.target===el)el.classList.remove('open');});
});
// Modais que bloqueiam fechamento por clique fora (só fecham pelos botões):
['usuariosOverlay','novoUsuarioOverlay','alterarSenhaOverlay','editarConsultoresOverlay','editarTreinadoresOverlay','novoConsultorOverlay','novoTreinadorOverlay'].forEach(function(id){
  var el=document.getElementById(id);
  if(el) el.addEventListener('click',function(e){
    if(e.target===el){e.stopPropagation();return;}
  });
});
/* Bloquear ESC para syncModal e listaClientesOverlay */
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    if(document.getElementById('syncModalOverlay')&&document.getElementById('syncModalOverlay').classList.contains('open')){
      e.stopPropagation();e.preventDefault();return false;
    }
    if(document.getElementById('listaClientesOverlay')&&document.getElementById('listaClientesOverlay').classList.contains('open')){
      e.stopPropagation();e.preventDefault();return false;
    }
  }
},{capture:true});

/* ============================================================
   SISTEMA DE LOG DE PENDÊNCIAS
============================================================ */
var _pendLog=[];
var _PEND_KEY='ci_pendlog';

function _loadPendLog(){
  try{
    var saved=localStorage.getItem(_PEND_KEY);
    if(saved)_pendLog=JSON.parse(saved)||[];
  }catch(e){_pendLog=[];}
  _updatePendBadge();
}

function _savePendLog(){
  try{localStorage.setItem(_PEND_KEY,JSON.stringify(_pendLog));}catch(e){}
}

function _addPendLog(acao,detalhe,icon){
  icon=icon||'📝';
  var item={
    id:Date.now()+'_'+Math.random().toString(36).slice(2,6),
    acao:acao,
    detalhe:detalhe||'',
    icon:icon,
    ts:new Date().toISOString(),
    enviado:false
  };
  _pendLog.unshift(item);
  if(_pendLog.length>100)_pendLog=_pendLog.slice(0,100);
  _savePendLog();
  _updatePendBadge();
}

function _updatePendBadge(){
  var badge=document.getElementById('netStatusBadge');
  var label=document.getElementById('netStatusLabel');
  if(!badge||!label)return;
  var pendentes=_pendLog.filter(function(i){return !i.enviado;}).length;
  var online=navigator.onLine;
  badge.className='net-badge '+(online?'online':'offline');
  if(online){
    label.textContent=pendentes>0?'Online · '+pendentes+' pend.':'Online';
  } else {
    label.textContent=pendentes>0?'Offline · '+pendentes+' pend.':'Offline';
  }
}

function _abrirPendLog(){
  _loadPendLog();
  _renderPendLog();
  document.getElementById('pendLogOverlay').classList.add('open');
}

function _fecharPendLog(){
  document.getElementById('pendLogOverlay').classList.remove('open');
}

function _renderPendLog(){
  var list=document.getElementById('pendLogList');
  var sel=document.getElementById('pendLogSelCount');
  if(!list)return;
  if(!_pendLog.length){
    list.innerHTML='<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px;">Nenhuma pendência registrada.</div>';
    if(sel)sel.textContent='';
    return;
  }
  list.innerHTML=_pendLog.map(function(item){
    var dt=new Date(item.ts);
    var timeStr=dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    return '<div class="pend-log-item" id="pli_'+item.id+'" onclick="_togglePendItem(\''+item.id+'\')">'
      +'<input type="checkbox" '+(item._sel?'checked':'')+' onclick="event.stopPropagation();_togglePendItem(\''+item.id+'\')" />'
      +'<span class="pend-log-icon">'+item.icon+'</span>'
      +'<div class="pend-log-info">'
        +'<div class="pend-log-action">'+item.acao+' '+(item.enviado?'✅':'⏳')+'</div>'
        +'<div class="pend-log-detail">'+(item.detalhe||'')+'</div>'
      +'</div>'
      +'<span class="pend-log-time">'+timeStr+'</span>'
      +'</div>';
  }).join('');
  _atualizarContadorSel();
}

function _togglePendItem(id){
  var item=_pendLog.find(function(i){return i.id===id;});
  if(!item)return;
  item._sel=!item._sel;
  var el=document.getElementById('pli_'+id);
  if(el){
    el.classList.toggle('selected',!!item._sel);
    var cb=el.querySelector('input[type=checkbox]');
    if(cb)cb.checked=!!item._sel;
  }
  _atualizarContadorSel();
}

function _atualizarContadorSel(){
  var sel=_pendLog.filter(function(i){return i._sel;}).length;
  var el=document.getElementById('pendLogSelCount');
  if(el)el.textContent=sel>0?sel+' selecionado'+(sel>1?'s':''):'';
}

function _marcarEnviados(){
  var ids=_pendLog.filter(function(i){return i._sel;}).map(function(i){return i.id;});
  if(!ids.length){_showToast('⚠️ Selecione ao menos uma pendência.','var(--amber)');return;}
  ids.forEach(function(id){
    var item=_pendLog.find(function(i){return i.id===id;});
    if(item){item.enviado=true;item._sel=false;}
  });
  _savePendLog();_renderPendLog();_updatePendBadge();
  _showToast('✅ '+ids.length+' item(ns) marcado(s) como enviado(s).','var(--accent)');
}

function _excluirSelecionados(){
  var ids=_pendLog.filter(function(i){return i._sel;}).map(function(i){return i.id;});
  if(!ids.length){_showToast('⚠️ Selecione ao menos uma pendência.','var(--amber)');return;}
  _pendLog=_pendLog.filter(function(i){return !i._sel;});
  _savePendLog();_renderPendLog();_updatePendBadge();
  _showToast('🗑 '+ids.length+' item(ns) excluído(s).','var(--muted)');
}

function _selecionarTodosPend(){
  var todos=_pendLog.every(function(i){return i._sel;});
  _pendLog.forEach(function(i){i._sel=!todos;});
  _renderPendLog();
}

function _limparPendLog(){
  if(!confirm('Limpar todo o histórico de pendências?'))return;
  _pendLog=[];_savePendLog();_renderPendLog();_updatePendBadge();
}

/* ============================================================
   ONLINE / OFFLINE
============================================================ */
function _initNetworkEvents(){
  window.addEventListener('online',function(){
    _updatePendBadge();
    _showToast('🟢 Conexão restaurada!','var(--green)');
  });
  window.addEventListener('offline',function(){
    _updatePendBadge();
    _showToast('🔴 Sem conexão. Ações registradas como pendentes.','var(--red)');
  });
  _loadPendLog();
}
document.addEventListener('DOMContentLoaded',function(){
  _initNetworkEvents();
  // Mostrar loginScreen se nenhuma outra tela foi ativada pelo auto-login
  var algumaTelaMostrada=_TELAS.some(function(id){
    var el=document.getElementById(id);
    return el&&el.style.display&&el.style.display!=='none';
  });
  if(!algumaTelaMostrada){
    _mostrarTela('loginScreen',true);
  }
  // Safety net: se após 8s nenhuma tela estiver visível (Firebase travou),
  // força loginScreen com aviso — evita tela em branco silenciosa.
  setTimeout(function(){
    var algumaVisivel=_TELAS.some(function(id){
      var el=document.getElementById(id);
      return el&&el.style.display&&el.style.display!=='none';
    });
    if(!algumaVisivel){
      console.warn('[UI] Nenhuma tela visível após 8s — forçando loginScreen.');
      _mostrarTela('loginScreen',true);
      try{ if(typeof _showToast==='function') _showToast('⚠️ Carregamento demorou. Tente fazer login novamente.','var(--amber)'); }catch(_){}
    }
  }, 8000);
});


/* ============================================================
   CONTROLE DE PERMISSÕES
============================================================ */

var _permsUidAtual=null;
var _permsPerfilAtual=null;


/* ============================================================
   WRAPPERS — patches após declarações
============================================================ */
(function(){
  'use strict';

  function _modalFechou(id){
    var el=document.getElementById(id);
    return el&&!el.classList.contains('open');
  }

  /* ── Clientes ── */
  var _origSaveEdit=window.saveEdit;
  window.saveEdit=function(){
    if(typeof editIdx==='undefined'||editIdx===null)return _origSaveEdit();
    var nome=(document.getElementById('mCliente')||{}).value||'';
    nome=nome.trim().toUpperCase();
    _origSaveEdit();
    if(_modalFechou('modalOverlay')&&nome)_addPendLog('Cliente editado','Cliente: '+nome,'✏️');
  };

  var _origSaveAdd=window.saveAdd;
  window.saveAdd=function(){
    var nome=(document.getElementById('aNome')||{}).value||'';
    var valor=(document.getElementById('aValor')||{}).value||'';
    nome=nome.trim().toUpperCase();
    _origSaveAdd();
    if(_modalFechou('addModalOverlay')&&nome&&valor)_addPendLog('Novo cliente adicionado','Cliente: '+nome,'➕');
  };

  var _origExecuteDelete=window.executeDelete;
  window.executeDelete=function(){
    var nome='?';
    if(typeof confirmIdx!=='undefined'&&confirmIdx!==null&&data&&data[confirmIdx])nome=data[confirmIdx].cliente.toUpperCase();
    _origExecuteDelete();
    _addPendLog('Cliente excluído','Cliente: '+nome,'🗑️');
  };

  var _origSaveClientInfo=window.saveClientInfo;
  window.saveClientInfo=function(){
    var ciIdx=typeof _ciIdx!=='undefined'?_ciIdx:null;
    var cliente=ciIdx!==null&&data&&data[ciIdx]?data[ciIdx].cliente.toUpperCase():'?';
    _origSaveClientInfo();
    _addPendLog('Observação salva','Cliente: '+cliente,'📝');
  };

  /* ── Título / Info / Período ── */
  var _origSaveTitleModal=window.saveTitleModal;
  window.saveTitleModal=function(){
    var novoTitulo=(document.getElementById('titleInput')||{}).value||'';
    _origSaveTitleModal();
    _addPendLog('Título alterado',novoTitulo.trim()||"CI'S POR RESPONSÁVEL",'📌');
  };

  var _origSaveInfoModal=window.saveInfoModal;
  window.saveInfoModal=function(){
    var info=(document.getElementById('infoInput')||{}).value||'';
    _origSaveInfoModal();
    _addPendLog('Informação atualizada',info.trim()||'(removida)','ℹ️');
  };

  var _origSavePeriodModal=window.savePeriodModal;
  window.savePeriodModal=function(){
    _origSavePeriodModal();
    _addPendLog('Período atualizado',window._periodText||'(limpo)','📅');
  };

  var _origClearPeriod=window.clearPeriod;
  window.clearPeriod=function(){
    _origClearPeriod();
    _addPendLog('Período removido','','📅');
  };

  /* ── Ministrante ── */
  var _origSetMinistrante=window._setMinistrante;
  window._setMinistrante=function(nome,ativo){
    _origSetMinistrante(nome,ativo);
    _addPendLog(ativo?'Ministrante definido':'Ministrante removido','Treinador: '+nome,'🎙️');
  };

  /* ── Treinadores ── */
  var _origConfirmarRenomearTreinador=window._confirmarRenomearTreinador;
  window._confirmarRenomearTreinador=function(idx,nomeAtual){
    var inp=document.getElementById('inputRenomearTreinador_'+idx);
    var novoNome=inp?inp.value.trim().toUpperCase():null;
    _origConfirmarRenomearTreinador(idx,nomeAtual);
    if(novoNome&&novoNome!==nomeAtual)_addPendLog('Treinador renomeado',nomeAtual+' → '+novoNome,'✏️');
  };

  var _origAdicionarTreinadorModal=window.adicionarTreinadorModal;
  window.adicionarTreinadorModal=function(){
    var inp=document.getElementById('novoTreinadorModalInput');
    var nome=inp?inp.value.trim().toUpperCase():'';
    var qtdAntes=allTrainers.length;
    _origAdicionarTreinadorModal();
    if(nome&&allTrainers.length>qtdAntes)_addPendLog('Treinador adicionado','Treinador: '+nome,'👤');
  };

  var _origExecutarExcluirTreinador=window._executarExcluirTreinador;
  window._executarExcluirTreinador=function(nome){
    _origExecutarExcluirTreinador(nome);
    _addPendLog('Treinador removido','Treinador: '+nome,'🗑️');
  };

  /* ── Consultores ── */
  var _origConfirmarRenomearConsultor=window._confirmarRenomearConsultor;
  window._confirmarRenomearConsultor=function(idx,nomeAtual){
    var inp=document.getElementById('inputRenomearConsultor_'+idx);
    var novoNome=inp?inp.value.trim().toUpperCase():null;
    _origConfirmarRenomearConsultor(idx,nomeAtual);
    if(novoNome&&novoNome!==nomeAtual)_addPendLog('Consultor renomeado',nomeAtual+' → '+novoNome,'✏️');
  };

  var _origAdicionarConsultorModal=window.adicionarConsultorModal;
  window.adicionarConsultorModal=function(){
    var inp=document.getElementById('novoConsultorModalInput');
    var nome=inp?inp.value.trim().toUpperCase():'';
    _origAdicionarConsultorModal();
    if(nome)_addPendLog('Consultor adicionado','Consultor: '+nome,'👤');
  };

  var _origExecutarExcluirConsultor=window._executarExcluirConsultor;
  window._executarExcluirConsultor=function(nome){
    _origExecutarExcluirConsultor(nome);
    _addPendLog('Consultor removido','Consultor: '+nome,'🗑️');
  };

  /* ── Usuários ── */
  var _origSalvarUsuario=window.salvarUsuario;
  window.salvarUsuario=function(){
    var nome=(document.getElementById('novoUsuarioNome')||{}).value||'';
    var login=(document.getElementById('novoUsuarioLogin')||{}).value||'';
    var senha=(document.getElementById('novoUsuarioSenha')||{}).value||'';
    nome=nome.trim().toUpperCase();login=login.trim().toLowerCase();
    if(!nome||!login||login.length<3||!senha||senha.length<3)return _origSalvarUsuario();
    _origSalvarUsuario();
    if(_modalFechou('novoUsuarioOverlay'))_addPendLog('Acesso configurado',nome+' (@'+login+')','👥');
  };

  var _origConfirmarAlterarSenha=window.confirmarAlterarSenha;
  window.confirmarAlterarSenha=function(){
    var uid=(document.getElementById('alterarSenhaUid')||{}).value||'?';
    var nova=(document.getElementById('alterarSenhaNova')||{}).value||'';
    if(!nova||nova.length<3)return _origConfirmarAlterarSenha();
    _origConfirmarAlterarSenha();
    _addPendLog('Senha alterada','Usuário: '+uid,'🔑');
  };

  var _origToggleAtivo=window._toggleAtivo;
  window._toggleAtivo=function(uid,novoEstado){
    _origToggleAtivo(uid,novoEstado);
    _addPendLog(novoEstado?'Usuário reativado':'Usuário pausado','UID: '+uid,novoEstado?'✅':'⏸️');
  };

  var _origExcluirUsuario=window._excluirUsuario;
  window._excluirUsuario=function(uid,nome){
    _origExcluirUsuario(uid,nome);
    _addPendLog('Usuário excluído',(nome||uid),'🗑️');
  };

  /* ── Firebase / Persistência ── */
  var _origConfirmSave=window.confirmSave;
  window.confirmSave=function(){
    _origConfirmSave();
    _addPendLog('Dados salvos localmente',new Date().toLocaleTimeString('pt-BR'),'💾');
  };

  var _origExecutarEnviar=window._executarEnviar;
  window._executarEnviar=function(){
    _origExecutarEnviar();
    _addPendLog('Enviado → Firebase',data.length+' clientes','⬆️');
  };

  var _origExecutarPuxar=window._executarPuxar;
  window._executarPuxar=function(){
    _origExecutarPuxar();
    _addPendLog('Puxado ← Firebase','','⬇️');
  };

})();

/* ============================================================
   CONTROLE DE PERMISSÕES
============================================================ */

// Permissões configuráveis por perfil (rótulo, chave, descrição)
var PERMS_CONFIG={
  ministrante:[
    {chave:'verGeral',     label:'Ver aba Geral',      sub:'Acesso ao painel geral com métricas da turma'},
    {chave:'verConsultor', label:'Ver aba Consultor',  sub:'Acesso ao painel de consultores'},
    {chave:'verTreinador', label:'Ver aba Treinador',  sub:'Acesso ao painel de treinadores'},
    {chave:'verProduto',   label:'Ver aba Produto',    sub:'Acesso à tabela cruzada de produtos'},
    {chave:'verValores',   label:'Ver valores (R$)',   sub:'Exibir valores monetários dos clientes'},
    {chave:'exportar',     label:'Exportar dados',     sub:'Permitir exportar PDF e backup JSON'},
  ],
  consultor:[
    {chave:'verGeral',     label:'Ver aba Geral',      sub:'Visão geral da turma e métricas'},
    {chave:'verConsultor', label:'Ver aba Consultor',  sub:'Seus clientes e métricas individuais'},
    {chave:'verTreinador', label:'Ver aba Treinador',  sub:'Dados dos treinadores'},
    {chave:'verProduto',   label:'Ver aba Produto',    sub:'Tabela cruzada consultor × produto'},
    {chave:'verValores',   label:'Ver valores (R$)',   sub:'Exibir valores monetários'},
    {chave:'exportar',     label:'Exportar dados',     sub:'Baixar backup em JSON'},
  ],
  treinador:[
    {chave:'verGeral',     label:'Ver aba Geral',      sub:'Visão geral da turma e métricas'},
    {chave:'verConsultor', label:'Ver aba Consultor',  sub:'Dados dos consultores'},
    {chave:'verTreinador', label:'Ver aba Treinador',  sub:'Seus clientes e métricas individuais'},
    {chave:'verProduto',   label:'Ver aba Produto',    sub:'Tabela cruzada consultor × produto'},
    {chave:'verValores',   label:'Ver valores (R$)',   sub:'Exibir valores monetários'},
    {chave:'exportar',     label:'Exportar dados',     sub:'Baixar backup em JSON'},
  ]
};

var _permsModalUid=null;
var _permsModalPerfil=null;


function abrirPermsGrupo(perfil){
  // Abre permissões usando uid especial para o grupo
  var uid='_grupo_'+perfil;
  var perfilLabel=perfil==='consultor'?'Consultores':perfil==='treinador'?'Treinadores':'Ministrantes';
  abrirPermsModal(uid, 'Perfil: '+perfilLabel, perfil);
}
function abrirPermsModal(uid, nome, perfil){
  _permsModalUid=uid;
  _permsModalPerfil=perfil;

  document.getElementById('permsModalTitulo').textContent='🔒 Controle de permissões';
  document.getElementById('permsModalSub').textContent=nome+' · '+(perfil==='consultor'?'Consultor':perfil==='ministrante'?'Ministrante':'Treinador');

  var local=_getUsuariosLocal();
  var uObj=local[uid]||{};
  var permsAtivas=_getPermsUsuario(perfil,uObj.permissoes||null);
  var config=PERMS_CONFIG[perfil]||PERMS_CONFIG.consultor;

  var html='<div style="display:flex;flex-direction:column;gap:2px;">';
  config.forEach(function(item){
    var on=!!permsAtivas[item.chave];
    html+='<div class="perms-row'+(on?' perm-on':'')+'" onclick="_togglePerm(this,\''+item.chave+'\')">'
      +'<div style="flex:1;min-width:0;">'
        +'<div class="perms-row-label">'+item.label+'</div>'
        +'<div class="perms-row-desc">'+item.sub+'</div>'
      +'</div>'
      +'<button class="perms-tog'+(on?' perm-on':'')+'" tabindex="-1"></button>'
    +'</div>';
  });
  html+='</div>';
  html+='<div style="font-size:11px;color:var(--muted);padding:10px 0 0;">As alterações têm efeito no próximo login do usuário.</div>';

  document.getElementById('permsModalBody').innerHTML=html;
  document.getElementById('permsModalOverlay').classList.add('open');
}

function _togglePerm(row, chave){
  row.classList.toggle('perm-on');
  var tog=row.querySelector('.perms-tog');
  if(tog) tog.classList.toggle('perm-on');
}

function fecharPermsModal(){
  document.getElementById('permsModalOverlay').classList.remove('open');
  _permsModalUid=null;
  _permsModalPerfil=null;
}

function salvarPermissoes(){
  if(!_permsModalUid||!_permsModalPerfil)return;

  var config=PERMS_CONFIG[_permsModalPerfil]||PERMS_CONFIG.consultor;
  var permissoes={};
  var rows=document.querySelectorAll('#permsModalBody .perms-row');
  config.forEach(function(item,i){
    permissoes[item.chave]=rows[i]?rows[i].classList.contains('perm-on'):false;
  });

  // Salvar no objeto do usuário — padrão atual do sistema
  var local=_getUsuariosLocal();
  if(!local[_permsModalUid]) local[_permsModalUid]={};
  local[_permsModalUid].permissoes=permissoes;
  _saveUsuariosLocal(local);

  // Sincronizar com Firebase (padrão atual)
  if(window._fbSave){
    window._fbSave('usuarios/'+_permsModalUid+'/permissoes', permissoes)
      .catch(function(){_showToast('⚠️ Salvo localmente. Firebase indisponível.','var(--amber)');});
  }

  fecharPermsModal();
  _showToast('✅ Permissões de '+
    (local[_permsModalUid]?local[_permsModalUid].nome||_permsModalUid:_permsModalUid)+
    ' salvas!','var(--accent)');
}
