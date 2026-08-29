
/* ════════════════════════════════════════════════════════════
   NOVA PIPELINE COMERCIAL — JS COMPLETO
   Fonte A: turmas/{id}/clientes  (read-only, sync auto)
   Fonte B: pipelineSales/{mes}/  (escrita avulsos)
   Fonte C: pipelineGoals/{mes}/  (metas)
   Fonte D: usuarios/             (consultores)
════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* ── Estado ──────────────────────────────────────────── */
  var _npAtivo=false;
  var _npMes=new Date().getMonth()+1;   /* 1-12 */
  var _npAno=new Date().getFullYear();
  var _npTabAtiva='dashboard';
  var _npVendasTurma=[];   /* cache mensal — fonte A */
  var _npVendasAvulso={}; /* cache Firebase — fonte B */
  var _npGoals={};         /* cache Firebase — fonte C */
  var _npGoalsSem={};      /* cache Firebase — metas semanais [consultor][semNum] = {min, bas, mas} */
  var _npSemConfig={};     /* cache Firebase — config manual de janelas [mk] = [{ini,fim}, ...] */
  var _npFpcSemSel=null;   /* num da semana selecionada no carrossel FPC (null = auto/atual) */
  var _npConsultores=[];   /* lista unificada */
  var _npListeners=[];     /* funções de cleanup */
  var _npVendaEditId=null;
  var _npCarregando=false;
  var COR=['#c8f05a','#60a5fa','#34d399','#f59e0b','#a78bfa','#f472b6','#fb923c','#38bdf8'];

  /* ── Helpers ─────────────────────────────────────────── */
  function _fmtR(v){ return (typeof formatVal==='function')?formatVal(v):('R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})); }
  function _mesKey(){
    return _npAno+'-'+String(_npMes).padStart(2,'0');
  }
  function _mesLabel(){
    var M=['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
           'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return M[_npMes-1]+' / '+_npAno;
  }
  /* Retorna array de YYYY-MM cobrindo o período ativo.
     'mes'/'ano'/'dia' → [_mesKey()] (mês corrente).
     'periodo' → todos os meses entre start.y/m e end.y/m inclusivos. */
  function _npMesesAtivos(){
    if(_npCalMode === 'periodo' && _npPerSel && _npPerSel.start && _npPerSel.end){
      var meses = [];
      var y = _npPerSel.start.y, m = _npPerSel.start.m;
      var yF = _npPerSel.end.y, mF = _npPerSel.end.m;
      while(y < yF || (y === yF && m <= mF)){
        meses.push(y + '-' + String(m).padStart(2,'0'));
        m++; if(m > 12){ m = 1; y++; }
        if(meses.length > 60) break; /* salvaguarda: max 5 anos */
      }
      return meses.length ? meses : [_mesKey()];
    }
    return [_mesKey()];
  }

  /* ── Semanas (regra A): seg-sex + sáb/dom ANEXOS pra semana anterior,
        exceto sáb/dom que sejam dia 1 ou 2 do mês → vão pra semana POSTERIOR.
     Retorna array de {num, iniDate, fimDate, iniLabel, fimLabel, dias, label}
     Datas usam local time (não UTC) pra evitar bug de timezone. ──────── */
  function _ymd(d){
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function _dmShort(d){
    return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');
  }
  /* Conta dias úteis (seg-sex) no intervalo, inclusivo */
  function _contaDiasUteis(ini, fim){
    var n = 0, d = new Date(ini);
    while(d <= fim){
      var w = d.getDay();
      if(w >= 1 && w <= 5) n++;
      d.setDate(d.getDate()+1);
    }
    return n;
  }
  function _semanasDoMes(ano, mes){
    /* mes = 1-12. Se houver config manual salva pra este mês, usa ela. */
    var mk = ano+'-'+String(mes).padStart(2,'0');
    var cfg = _npSemConfig[mk];
    if(Array.isArray(cfg) && cfg.length){
      return cfg.map(function(j, idx){
        var iniM = /^(\d{4})-(\d{2})-(\d{2})$/.exec(j.ini||'');
        var fimM = /^(\d{4})-(\d{2})-(\d{2})$/.exec(j.fim||'');
        if(!iniM || !fimM) return null;
        var ini = new Date(+iniM[1], +iniM[2]-1, +iniM[3]);
        var fim = new Date(+fimM[1], +fimM[2]-1, +fimM[3]);
        if(isNaN(ini) || isNaN(fim) || fim < ini) return null;
        /* dias = o mesmo número exibido no painel de janelas (respeita corridos/úteis) */
        var tipo = j.tipo === 'uteis' ? 'uteis' : 'corridos';
        var dias = tipo === 'uteis'
          ? _contaDiasUteis(ini, fim)
          : Math.round((fim - ini) / 86400000) + 1;
        return {
          num: idx+1,
          iniDate: ini, fimDate: fim,
          ini: j.ini, fim: j.fim,
          iniLabel: _dmShort(ini), fimLabel: _dmShort(fim),
          dias: dias, tipo: tipo,
          label: 'Semana '+String(idx+1).padStart(2,'0')+' ('+_dmShort(ini)+' a '+_dmShort(fim)+')'
        };
      }).filter(Boolean);
    }
    return _semanasAutomaticas(ano, mes);
  }
  function _semanasAutomaticas(ano, mes){
    var primeiro = new Date(ano, mes-1, 1);
    var ultimo = new Date(ano, mes, 0); // último dia do mês
    var semanas = [];
    /* Cursor começa na primeira segunda do mês — se dia 1 não for segunda, retrocede.
       Mas: se dia 1 for sáb ou dom, ele inicia uma NOVA semana (exceção da regra A),
       então não retrocedemos pra mês anterior. */
    var dia1WD = primeiro.getDay(); // 0=dom, 1=seg... 6=sáb
    var cursor;
    if(dia1WD === 6 || dia1WD === 0){
      /* sáb/dom dia 1 → inicia semana nova, segunda é dia 3 (se dia 1=sáb) ou 2 (se dia 1=dom) */
      cursor = new Date(primeiro);
    } else {
      /* primeira semana começa na segunda da semana do dia 1 */
      var diff = (dia1WD === 0 ? -6 : 1 - dia1WD); // distância da segunda
      cursor = new Date(primeiro);
      cursor.setDate(primeiro.getDate() + diff);
      /* Se cursor caiu antes do dia 1 do mês, segura no dia 1 (semana parcial) */
      if(cursor < primeiro) cursor = new Date(primeiro);
    }
    var n = 0;
    while(cursor <= ultimo){
      n++;
      var ini = new Date(cursor);
      /* fim = sexta dessa semana (seg+4) */
      var fim = new Date(cursor); fim.setDate(cursor.getDate() + 4);
      /* Anexa sáb/dom se NÃO forem dia 1 ou 2 do próximo mês */
      var sab = new Date(fim); sab.setDate(fim.getDate()+1);
      var dom = new Date(fim); dom.setDate(fim.getDate()+2);
      var fimSemana = fim;
      [sab, dom].forEach(function(d){
        var ehProxMes = (d.getMonth() !== mes-1);
        var diaNum = d.getDate();
        if(ehProxMes && (diaNum === 1 || diaNum === 2)) return; // pula
        fimSemana = d;
      });
      /* Se a sexta passou do último dia do mês, trava em ultimo */
      if(fim > ultimo){
        fimSemana = ultimo;
        /* mas anexa sáb/dom se forem do próximo mês E NÃO forem dia 1 ou 2 */
        var d = new Date(ultimo); d.setDate(ultimo.getDate()+1);
        for(var k=0; k<2; k++){
          if(d.getMonth() === mes-1){ fimSemana = new Date(d); }
          else {
            var diaN = d.getDate();
            if(diaN !== 1 && diaN !== 2) fimSemana = new Date(d);
            else break;
          }
          d.setDate(d.getDate()+1);
        }
      }
      var dias = Math.round((fimSemana - ini) / 86400000) + 1;
      semanas.push({
        num: n,
        iniDate: ini, fimDate: fimSemana,
        ini: _ymd(ini), fim: _ymd(fimSemana),
        iniLabel: _dmShort(ini), fimLabel: _dmShort(fimSemana),
        dias: dias, tipo: 'corridos',
        label: 'Semana '+String(n).padStart(2,'0')+' ('+_dmShort(ini)+' a '+_dmShort(fimSemana)+')'
      });
      /* Próximo cursor: segunda da próxima semana */
      cursor = new Date(fim);
      cursor.setDate(fim.getDate() + 3); // sex + 3 = seg
    }
    return semanas;
  }
  /* Retorna o número da semana (1..N) onde a data YMD se encaixa pelo mês ativo,
     ou null se hoje não está no mês. */
  function _semanaDoYMD(ymd, semanas){
    if(!ymd || !semanas) return null;
    for(var i=0;i<semanas.length;i++){
      if(ymd >= semanas[i].ini && ymd <= semanas[i].fim) return semanas[i].num;
    }
    return null;
  }
  function _semanaAtual(){
    var hoje = new Date();
    var semanas = _semanasDoMes(_npAno, _npMes);
    return _semanaDoYMD(_ymd(hoje), semanas);
  }
  /* Retorna a janela de semana MAIS PROXIMA de uma data YMD.
     - Se hoje cai dentro de alguma semana, retorna essa
     - Se hoje < ini da primeira (semanas comecam depois): retorna a 1a
     - Se hoje > fim da ultima (semanas ja passaram): retorna a ultima
     - Se hoje cai num gap entre semanas: retorna a mais proxima (pela
       menor distancia em dias entre hoje e ini/fim) */
  function _semanaMaisProxima(ymd, semanas){
    if(!semanas || !semanas.length) return null;
    /* 1) caiu dentro? */
    for(var i=0;i<semanas.length;i++){
      if(ymd >= semanas[i].ini && ymd <= semanas[i].fim) return semanas[i];
    }
    /* 2) antes de todas → 1a futura */
    if(ymd < semanas[0].ini) return semanas[0];
    /* 3) depois de todas → ultima */
    if(ymd > semanas[semanas.length-1].fim) return semanas[semanas.length-1];
    /* 4) gap entre semanas → escolhe a mais perto por dias */
    var hojeMs = new Date(ymd+'T12:00:00').getTime();
    var melhor = null, menorDist = Infinity;
    semanas.forEach(function(s){
      var iniMs = new Date(s.ini+'T12:00:00').getTime();
      var fimMs = new Date(s.fim+'T12:00:00').getTime();
      var dist = Math.min(Math.abs(hojeMs-iniMs), Math.abs(hojeMs-fimMs));
      if(dist < menorDist){ menorDist = dist; melhor = s; }
    });
    return melhor || semanas[semanas.length-1];
  }
  /* Status agregado da semana (faturado time vs meta minima time):
       'futuro'  -> semana ainda nao comecou
       'batida'  -> faturado >= soma metaMin (>= 100%)
       'parcial' -> faturado > 0 e meta > 0
       'zero'    -> nada faturado */
  function _statusSemanaFPC(s, todasVendas){
    if(!s) return 'futuro';
    var hojeYMD = _ymd(new Date());
    var futuro = (s.ini > hojeYMD);
    var usu = (window._npUsuarios && typeof window._npUsuarios==='object') ? window._npUsuarios : {};
    var fat = 0, mMin = 0;
    Object.values(usu).forEach(function(u){
      if(u && u.perfil==='consultor' && u.nome){
        fat += _faturadoNaSemana(todasVendas, u.nome, s);
        var g = (_npGoalsSem && _npGoalsSem[u.nome] && _npGoalsSem[u.nome][s.num]) || {};
        mMin += +(g.min||0);
      }
    });
    if(futuro && fat===0) return 'futuro';
    if(mMin>0 && fat>=mMin) return 'batida';
    if(fat>0) return 'parcial';
    return 'zero';
  }
  function _statusLabelFPC(st){
    return st==='batida' ? '✓ BATIDA'
         : st==='parcial' ? '⏳ PARCIAL'
         : st==='zero' ? '— ZERO'
         : 'FUTURO';
  }
  /* Renderiza linha de pills (S1·S2·S3·S4…) com cor de status no header
     do card "Faturado por consultor — Semanal". Opcao 02 do preview:
     todas as semanas visiveis, cor por status, 1 clique para trocar. */
  function _renderFpcCarousel(semanas, atual, semAtualNum, todasVendas){
    if(!atual || !semanas || !semanas.length){
      return '<span style="color:var(--muted);">Sem semana ativa</span>';
    }
    var atualNum = atual.num;
    var titulo = 'Faturado por consultor — Semanal · S'+atual.num+' ('+atual.iniLabel+'–'+atual.fimLabel+')';
    var pills = semanas.map(function(s){
      var st = _statusSemanaFPC(s, todasVendas);
      var sel = (s.num===atualNum) ? ' on' : '';
      var aria = 'S'+s.num+' · '+s.iniLabel+' a '+s.fimLabel+' · '+_statusLabelFPC(st);
      return '<button type="button" class="fpc-pill st-'+st+sel+'" '
        + 'onclick="window._npFpcSemGo('+s.num+')" title="'+aria+'">S'+s.num+'</button>';
    }).join('');
    return '<div class="fpc-pills-row">'
      + '<span class="fpc-pills-ttl">'+titulo+'</span>'
      + '<span class="fpc-pills">'+pills+'</span>'
      + '</div>';
  }
  window._npFpcSemGo = function(num){
    _npFpcSemSel = +num || null;
    /* re-render do dashboard pra atualizar o card inteiro */
    if(typeof window._npRenderTudo==='function') window._npRenderTudo();
  };

  /* Dias úteis (seg-sex) restantes na janela (a partir de hoje, inclusive) */
  function _diasUteisRestantes(janela){
    var hoje = new Date(); hoje.setHours(0,0,0,0);
    var fim = new Date(janela.fimDate); fim.setHours(0,0,0,0);
    if(hoje > fim) return 0;
    var ini = hoje > janela.iniDate ? hoje : janela.iniDate;
    ini = new Date(ini); ini.setHours(0,0,0,0);
    var dias = 0;
    var d = new Date(ini);
    while(d <= fim){
      var w = d.getDay();
      if(w >= 1 && w <= 5) dias++;
      d.setDate(d.getDate()+1);
    }
    return dias;
  }
  /* Faturado por consultor numa janela específica (ini/fim em YYYY-MM-DD).
     Aceita array (todas) ou objeto (raw _npVendasAvulso). Considera só status 'pago'.
     Bate com a regra do _npPorConsultor — fonte unificada das turmas + avulsas. */
  function _faturadoNaSemana(vendas, consultor, janela){
    if(!vendas || !janela) return 0;
    var lista = Array.isArray(vendas) ? vendas : Object.values(vendas);
    var soma = 0;
    lista.forEach(function(v){
      if(!v) return;
      var st = String(v.status||'').toLowerCase();
      if(st !== 'pago') return;
      var nomeC = v.consultor || v.consultorNome || '';
      if(nomeC !== consultor) return;
      var data = (v.data || v.criadoEm || '').slice(0,10);
      if(!data) return;
      if(data >= janela.ini && data <= janela.fim) soma += +(v.valor||0);
    });
    return soma;
  }

  /* Expõe helpers de semana pra outros módulos (ex.: 12-pipeline-v2-patch.js) */
  window._npSemUtil = {
    semanas: function(ano, mes){ return _semanasDoMes(ano||_npAno, mes||_npMes); },
    semanaAtual: function(){ return _semanaAtual(); },
    diasUteisRestantes: function(j){ return _diasUteisRestantes(j); },
    faturado: function(vendas, consultor, janela){ return _faturadoNaSemana(vendas, consultor, janela); },
    goals: function(){ return _npGoalsSem || {}; },
    fmtR: function(v){ return _fmtR(v); },
    ymd: function(d){ return _ymd(d||new Date()); }
  };
  function _esc(s){ return window._esc(s); }
  function _avatar(nome,i){
    var cor=COR[i%COR.length];
    var ini=(nome||'?').trim().charAt(0).toUpperCase();
    return '<div class="np-meta-avatar" style="background:'+cor+'22;color:'+cor+';border:1.5px solid '+cor+'55;">'+ini+'</div>';
  }
  function _stClass(st){
    var m={pago:'pago',aberto:'aberto',entrada:'entrada',negociacao:'negociacao',
           desistiu:'desistiu',estorno:'estorno'};
    return 'np-st np-st-'+(m[(st||'aberto').toLowerCase()]||'aberto');
  }
  function _npMoneyMask(v){
    /* Modo centavo: cada par de dígitos forma os centavos; formata como 1.500,00 */
    var n=String(v||'').replace(/\D/g,'');
    if(!n) return '';
    n=(parseInt(n,10)/100).toFixed(2);
    return n.replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  }

  /* ── Meta Geral: retorna valor definido ou Σ metas básicas ──
     (metas de consultores pausados ficam fora da soma) */
  function getMetaEquipeMes(){
    if(window._npMetaGeral&&window._npMetaGeral.valor>0) return window._npMetaGeral.valor;
    return Object.entries(window._npGoals||{}).reduce(function(s,e){
      if(_npEhPausado(e[0])) return s;
      var g=e[1]||{};
      return s+(+(g.metaBasica||g.metaValor||0));
    },0);
  }
  function _npAtualizarBtnConfigurar(){
    var _fmt=function(n){return 'R$ '+Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});};
    var todas=_npTodasVendas();
    var totalPago=todas.filter(function(vd){
      return String(vd.status||'').toLowerCase()==='pago';
    }).reduce(function(s,vd){return s+(+(vd.valor||0));},0);
    /* Faturado */
    var btnFat=document.getElementById('npBtnFaturamento');
    if(btnFat){
      var spans=btnFat.querySelectorAll('span');
      if(spans[1]) spans[1].textContent=_fmt(totalPago);
    }
    /* Falta */
    var btnFalta=document.getElementById('npBtnFaltaMeta');
    if(btnFalta){
      if(window._npMetaGeral&&window._npMetaGeral.valor>0){
        var v=window._npMetaGeral.valor;
        var falta=Math.max(0,v-totalPago);
        var batida=falta<=0;
        var spans2=btnFalta.querySelectorAll('span');
        if(spans2[0]) spans2[0].textContent=batida?'Meta batida!':'Falta p/ meta';
        if(spans2[1]) spans2[1].textContent=batida?'✅':'_fmt(falta)'.replace('_fmt(falta)',_fmt(falta));
        if(spans2[1]) spans2[1].textContent=batida?'✅ Batida!':_fmt(falta);
        btnFalta.style.background=batida?'rgba(52,211,153,.08)':'rgba(200,240,90,.06)';
        btnFalta.style.borderColor=batida?'rgba(52,211,153,.25)':'rgba(200,240,90,.2)';
        if(spans2[0]) spans2[0].style.color=batida?'rgba(52,211,153,.7)':'rgba(200,240,90,.7)';
        if(spans2[1]) spans2[1].style.color=batida?'var(--green)':'var(--accent)';
        btnFalta.style.display='flex';
      } else { btnFalta.style.display='none'; }
    }
  }

  /* ── Pausado na Gestão de Usuários (ativo===false) ──
     Regra: pausado NÃO aparece em nenhuma lista de pessoas do app
     (selects, metas, rankings, gráficos). As linhas de VENDAS
     continuam íntegras — vendas nunca são ocultadas. */
  function _npEhPausado(nome){
    var k=String(nome||'').toUpperCase().trim();
    if(!k) return false;
    var us=window._npUsuarios||{};
    var ids=Object.keys(us);
    for(var i=0;i<ids.length;i++){
      var u=us[ids[i]];
      if(u&&u.nome&&String(u.nome).toUpperCase().trim()===k) return u.ativo===false;
    }
    return false;
  }
  window._npEhPausado=_npEhPausado;

  /* ── Coletar consultores unificados ─────────────────── */
  function _npColetarConsultores(){
    var set={};
    /* De usuarios Firebase (perfil consultor) — pausado fica de fora */
    if(window._npUsuarios){
      Object.values(window._npUsuarios).forEach(function(u){
        if(u&&u.perfil==='consultor'&&u.nome&&u.ativo!==false){
          set[u.nome.toUpperCase()]=u.nome;
        }
      });
    }
    /* De todas as vendas do mês (turma + avulso normalizados) */
    _npTodasVendas().forEach(function(v){
      var nome=(v.consultor||'').trim();
      if(nome) set[nome.toUpperCase()]=nome;
    });
    /* Remover pausados (inclusive quem entrou via vendas do mês) */
    Object.keys(set).forEach(function(k){
      if(_npEhPausado(set[k])) delete set[k];
    });
    /* Ordena: prioriza metaOrdem customizado (salvo em _npGoals[nome].metaOrdem),
       fallback alfabético. metaOrdem 0/undefined cai pro final do bloco custom. */
    var goals = window._npGoals || {};
    _npConsultores = Object.values(set).sort(function(a, b){
      var oa = goals[a] && +(goals[a].metaOrdem) || 0;
      var ob = goals[b] && +(goals[b].metaOrdem) || 0;
      if(oa && ob) return oa - ob;     /* ambos com ordem custom */
      if(oa) return -1;                /* só A tem ordem → A vem antes */
      if(ob) return 1;                 /* só B tem ordem → B vem antes */
      return a.localeCompare(b, 'pt-BR');
    });
    return _npConsultores;
  }

  /* ── Geração para invalidar callbacks/listeners antigos ── */
  var _npGen = 0;

  /* ── Coletar vendas da turma do mês ────────────────── */
  function _npColetarVendasTurma(){
    _npVendasTurma=[];
    window._npTurmasMeta={};  /* reset cache de metas das turmas do mês */
    if(typeof window._fbGet!=='function') return;
    var mkSnap = _mesKey();
    var mksRange = _npMesesAtivos(); /* array de YYYY-MM no período ativo */
    var multiMes = mksRange.length > 1;
    var genSnap = _npGen;
    /* Skeleton enquanto carrega */
    var _skelAlvos=['npTop3','npChartConsultores','npChartMeta','npMetasGrid','npTurmasAtingimentoGrid'];
    _skelAlvos.forEach(function(id){
      var el=document.getElementById(id);
      if(el&&typeof _skelOn==='function') _skelOn(el,_skelCards(3));
    });
    /* Buscar turmas e goals em paralelo — garante que _npGoals está pronto antes de renderizar */
    Promise.all([
      window._fbGet('turmas'),
      window._fbGet('pipelineGoals/'+mkSnap).catch(function(){return {};})
    ]).then(function(res){
      var turmas=res[0]; var goals=res[1];
      if(genSnap !== _npGen) return;
      /* Remover skeleton independente do resultado */
      _skelAlvos.forEach(function(id){
        var el=document.getElementById(id);
        if(el&&typeof _skelOff==='function') _skelOff(el);
      });
      /* Atualizar goals com dados frescos do mês */
      if(goals&&Object.keys(goals).length>0) _npGoals=goals;
      if(!turmas) { _npRenderTudo(); return; }
      Object.entries(turmas).forEach(function(e){
        var tid=e[0],td=e[1];
        if(td.mesMeta){
          /* Vínculo explícito (turmas com mesMeta definido) */
          if(multiMes){ if(mksRange.indexOf(td.mesMeta) < 0) return; }
          else { if(td.mesMeta!==mkSnap) return; }
        } else {
          /* Fallback legado: âncora em periodEnd — turma conta só no mês em que termina.
             Use mesMeta no modal ou _migrarMesMetaLegado() para controle explícito. */
          var pe=(td.periodEnd||td.periodStart||'').slice(0,7);
          if(multiMes){ if(mksRange.indexOf(pe) < 0) return; }
          else { if(pe!==mkSnap) return; }
        }
        /* Cachear meta da turma para o bloco de atingimento */
        window._npTurmasMeta[tid]={nome:td.nome||tid,meta:+(td.meta||0)};
        var cls=td.clientes||[];
        if(!Array.isArray(cls)&&typeof cls==='object') cls=Object.values(cls).filter(Boolean);
        cls.forEach(function(cl){
          if(!cl.consultor||!cl.consultor.trim()) return; /* sem consultor = não conta */
          /* BUG-FIX: achatar treinamentos[] em vendas independentes.
             Cliente com múltiplos treinamentos (ex: 1 IF pago + 1 CEOP em negociação)
             precisa virar N vendas separadas — cada uma com seu próprio status/valor.
             Sem isso, todos os subs herdam o status do scalar primário. */
          var subs = Array.isArray(cl.treinamentos) ? cl.treinamentos.filter(Boolean) : [];
          var clienteNome = cl.cliente||cl.nome||'—';
          var consNome = (cl.consultor||'').trim();
          var dataPad = cl.data||td.periodStart||'';
          if(subs.length > 0){
            /* Cliente com array de sub-treinamentos: 1 venda por sub */
            subs.forEach(function(sub){
              if(!sub) return;
              _npVendasTurma.push({
                _src:'turma', _turmaId:tid, _turmaNome:td.nome||tid,
                cliente:clienteNome,
                consultor:consNome,
                treinamento:sub.cod||cl.treinamento||'—',
                valor:+(sub.valor||0),
                entrada:+(sub.entrada||0),
                status:String(sub.status||cl.status||'aberto').toLowerCase(),
                data:sub.data||dataPad
              });
            });
          } else {
            /* Cliente legado sem array: usa scalar (comportamento antigo) */
            _npVendasTurma.push({
              _src:'turma', _turmaId:tid, _turmaNome:td.nome||tid,
              cliente:clienteNome,
              consultor:consNome,
              treinamento:cl.treinamento||'—',
              valor:+(cl.valor||0),
              entrada:+(cl.entrada||0),
              status:(cl.status||'aberto').toLowerCase(),
              data:dataPad
            });
          }
        });
      });
      _npRenderTudo();
    }).catch(function(e){
      _skelAlvos.forEach(function(id){var el=document.getElementById(id);if(el&&typeof _skelOff==='function')_skelOff(el);});
      console.error('[NP] Erro ao carregar turmas/goals:',e);
      _showToast('❌ Erro ao carregar dados do mês','error');
    });
  }

  /* ── Listener Firebase para vendas avulsas ────────── */
  var _npListenerAvulso=null;
  var _npListenerGoals=null;
  var _npListenerGoalsSem=null;
  var _npListenerSemConfig=null;
  var _npListenerUsuarios=null;
  var _npListenerMetaGeral=null;
  window._npMetaGeral=null;

  function _npIniciarListeners(){
    /* Incrementar geração: callbacks antigos devem ignorar payloads */
    _npGen++;
    var _genLocal = _npGen;

    /* Limpar listeners anteriores (suporte síncrono e Promise vinda do stub) */
    function _safeUnsub(u){
      if(!u) return;
      if(typeof u === 'function'){ try{ u(); }catch(e){} return; }
      if(u && typeof u.then === 'function'){
        u.then(function(real){ if(typeof real === 'function'){ try{ real(); }catch(e){} } }).catch(function(){});
      }
    }
    _safeUnsub(_npListenerAvulso);     _npListenerAvulso=null;
    _safeUnsub(_npListenerGoals);      _npListenerGoals=null;
    _safeUnsub(_npListenerGoalsSem);   _npListenerGoalsSem=null;
    _safeUnsub(_npListenerSemConfig);  _npListenerSemConfig=null;
    _safeUnsub(_npListenerUsuarios);   _npListenerUsuarios=null;
    _safeUnsub(_npListenerMetaGeral);  _npListenerMetaGeral=null;
    window._npMetaGeral=null;

    var mk=_mesKey();
    var mksRange = _npMesesAtivos();

    /* Vendas avulsas. Mês único → listener (real-time). Multi-mês → fbGet
       paralelo de todos os meses do range, merge e render (snapshot). */
    if(mksRange.length === 1 && typeof window._fbChange==='function'){
      _npListenerAvulso=window._fbChange('pipelineSales/'+mk, function(data){
        if(_genLocal !== _npGen) return;
        _npVendasAvulso=data||{};
        _npRenderTudo();
      });
    } else if(mksRange.length > 1){
      Promise.all(mksRange.map(function(k){
        return window._fbGet('pipelineSales/'+k).catch(function(){ return {}; });
      })).then(function(arr){
        if(_genLocal !== _npGen) return;
        var merged={};
        arr.forEach(function(d){ if(d) Object.assign(merged, d); });
        _npVendasAvulso=merged;
        _npRenderTudo();
      });
    } else {
      /* Fallback: fbGet mês único */
      window._fbGet('pipelineSales/'+mk).then(function(d){
        if(_genLocal !== _npGen) return;
        _npVendasAvulso=d||{};
        _npRenderTudo();
      }).catch(function(){
        if(_genLocal !== _npGen) return;
        _npVendasAvulso={};_npRenderTudo();
      });
    }

    /* Goals do mês */
    if(typeof window._fbChange==='function'){
      _npListenerGoals=window._fbChange('pipelineGoals/'+mk, function(data){
        if(_genLocal !== _npGen) return;
        _npGoals=data||{};
        _npRenderTudo();
      });
    } else {
      window._fbGet('pipelineGoals/'+mk).then(function(d){
        if(_genLocal !== _npGen) return;
        _npGoals=d||{};
        _npRenderTudo();
      }).catch(function(){
        if(_genLocal !== _npGen) return;
        _npGoals={};_npRenderTudo();
      });
    }

    /* Goals SEMANAIS do mês */
    if(typeof window._fbChange==='function'){
      _npListenerGoalsSem=window._fbChange('pipelineGoalsSem/'+mk, function(data){
        if(_genLocal !== _npGen) return;
        _npGoalsSem=data||{};
        _npRenderTudo();
      });
    } else {
      window._fbGet('pipelineGoalsSem/'+mk).then(function(d){
        if(_genLocal !== _npGen) return;
        _npGoalsSem=d||{};
        _npRenderTudo();
      }).catch(function(){
        if(_genLocal !== _npGen) return;
        _npGoalsSem={};_npRenderTudo();
      });
    }

    /* Config manual de janelas de semanas */
    if(typeof window._fbChange==='function'){
      _npListenerSemConfig=window._fbChange('pipelineSemConfig/'+mk, function(data){
        if(_genLocal !== _npGen) return;
        _npSemConfig[mk] = Array.isArray(data) ? data : (data ? Object.values(data) : null);
        _npRenderTudo();
      });
    } else {
      window._fbGet('pipelineSemConfig/'+mk).then(function(d){
        if(_genLocal !== _npGen) return;
        _npSemConfig[mk] = Array.isArray(d) ? d : (d ? Object.values(d) : null);
        _npRenderTudo();
      }).catch(function(){
        if(_genLocal !== _npGen) return;
        _npSemConfig[mk] = null; _npRenderTudo();
      });
    }

    /* Meta Geral do time */
    if(typeof window._fbChange==='function'){
      _npListenerMetaGeral=window._fbChange('pipelineMetaGeral/'+mk, function(data){
        if(_genLocal !== _npGen) return;
        window._npMetaGeral=(data&&data.valor>0)?data:null;
        _npAtualizarBtnConfigurar();
        _npRenderTudo();
      });
    } else {
      window._fbGet('pipelineMetaGeral/'+mk).then(function(d){
        if(_genLocal !== _npGen) return;
        window._npMetaGeral=(d&&d.valor>0)?d:null;
        _npAtualizarBtnConfigurar();
        _npRenderTudo();
      }).catch(function(){});
    }

    /* Usuarios (consultores) */
    if(typeof window._fbChange==='function'){
      _npListenerUsuarios=window._fbChange('usuarios', function(us){
        if(_genLocal !== _npGen) return;
        window._npUsuarios=us||{};
        _npColetarConsultores();
        _npRenderTudo();
      });
    } else {
      window._fbGet('usuarios').then(function(us){
        if(_genLocal !== _npGen) return;
        window._npUsuarios=us||{};
        _npColetarConsultores();
      }).catch(function(){});
    }
  }

  /* ── Dedup turma × CRM ───────────────────────────────
     A mesma venda chega por dois caminhos: a turma (fonte A, nó `turmas`) e o
     pipelineSales (fonte B, que o Sincronizar-FRZ importa do ZS). Somar as duas
     conta o mesmo dinheiro duas vezes.

     O casamento é por CLIENTE, comparando SOMA com SOMA — nunca linha a linha:
     a turma detalha a grade item a item e o ZS agrupa numa venda só (Diogo =
     6 linhas de R$ 26.293,25 na turma × 1 venda de R$ 26.293,25 no ZS). Chave
     por linha não casaria nenhum desses.

     FAIL-OPEN: cliente cuja soma não bate continua contando normalmente. Na
     dúvida a venda aparece — some nunca. O que ficou de fora sai em
     window._npDedupInfo.semPar e no rodapé do KPI. */
  function _npDedupNorm(s){
    var t=String(s||'');
    try{ t=t.normalize('NFD').replace(/[̀-ͯ]/g,''); }catch(e){}
    return t.replace(/\s+/g,' ').trim().toUpperCase();
  }
  /* nomes divergem entre as bases ("Camila Vilela" × "Camila Virginia Vilela
     Borges"): casa por primeiro nome + um sobrenome em comum de 3+ letras. */
  function _npDedupMesmoCliente(a,b){
    if(!a||!b) return false;
    if(a===b) return true;
    var pa=a.split(' '),pb=b.split(' ');
    if(pa[0]!==pb[0]) return false;
    for(var i=1;i<pa.length;i++){
      if(pa[i].length<3) continue;
      for(var j=1;j<pb.length;j++){ if(pa[i]===pb[j]) return true; }
    }
    /* um lado só com primeiro nome (ex.: "Wellington") casa pelo primeiro */
    return pa.length===1||pb.length===1;
  }
  var _npDedupInfo={cobertas:[],semPar:[],valorCoberto:0};

  /* ── Todas as vendas do mês (A + B, sem dupla contagem) ── */
  function _npTodasVendas(){
    var avulsos=Object.entries(_npVendasAvulso||{}).map(function(e){
      var v=e[1]||{};
      /* Compat: vendas avulsas antigas guardam o nome em consultorNome/clienteNome.
         Normaliza para consultor/cliente para que filtros, ranking e dashboard funcionem. */
      return Object.assign({},v,{
        _id:e[0],
        _src:'avulso',
        consultor:v.consultor||v.consultorNome||'',
        cliente:v.cliente||v.clienteNome||''
      });
    });

    var over=(window._npDedupOverride||{});
    var pagoTurma=[],restoTurma=[];
    (_npVendasTurma||[]).forEach(function(v){
      if((v.status||'').toLowerCase()==='pago') pagoTurma.push(v); else restoTurma.push(v);
    });

    /* soma paga por cliente na turma */
    var somaT={};
    pagoTurma.forEach(function(v){
      var k=_npDedupNorm(v.cliente); somaT[k]=(somaT[k]||0)+(+(v.valor)||0);
    });
    var pagosB=avulsos.filter(function(v){return (v.status||'').toLowerCase()==='pago';});

    /* Procura o SUBCONJUNTO das vendas do CRM daquele cliente que soma o total
       da turma. Subconjunto, e não soma total, porque o cliente pode ter
       comprado fora do evento no mesmo mês (Giumar: R$ 6.997 no evento + outra
       venda) e porque o match de nome pode trazer homônimo junto. Poucos itens
       por cliente, então força bruta com bitmask resolve; acima de 16 desiste. */
    function _npSubconjunto(cands,alvo){
      var n=Math.min(cands.length,16),i,j,soma,melhor=null;
      for(i=1;i<(1<<n);i++){
        soma=0;
        for(j=0;j<n;j++){ if(i&(1<<j)) soma+=(+cands[j].valor||0); }
        if(Math.abs(soma-alvo)<0.02){
          /* entre empates, o de menos itens (casamento mais justo) */
          var q=0; for(j=0;j<n;j++){ if(i&(1<<j)) q++; }
          if(melhor===null||q<melhor.q) melhor={mask:i,q:q};
        }
      }
      if(!melhor) return null;
      var out=[];
      for(j=0;j<n;j++){ if(melhor.mask&(1<<j)) out.push(cands[j]); }
      return out;
    }

    _npDedupInfo={cobertas:[],semPar:[],valorCoberto:0};
    var cobertoPorCliente={},jaUsada=[];
    Object.keys(somaT).forEach(function(kt){
      var forc=over[kt];                          /* 'crm' | 'contar' */
      if(forc==='contar'){ return; }
      var cands=pagosB.filter(function(v){
        return jaUsada.indexOf(v)<0 && _npDedupMesmoCliente(kt,_npDedupNorm(v.cliente));
      });
      var par=_npSubconjunto(cands,somaT[kt]);
      if(forc==='crm'&&!par) par=cands.slice();   /* override: cobre com o que houver */
      if(par&&par.length){
        par.forEach(function(v){ jaUsada.push(v); });  /* consumo 1:1, sem reuso */
        cobertoPorCliente[kt]={vendasB:par,valor:somaT[kt],forcado:forc==='crm'};
        _npDedupInfo.valorCoberto+=somaT[kt];
      } else {
        var somaCand=cands.reduce(function(s,v){return s+(+v.valor||0);},0);
        _npDedupInfo.semPar.push({cliente:kt,valor:somaT[kt],
          parB:cands.length?_npDedupNorm(cands[0].cliente):null,
          valorB:cands.length?somaCand:null});
      }
    });

    /* remove as linhas de turma cobertas e anota a origem na venda do CRM,
       para o filtro "Só turma"/t:<id> e a aba Vendas continuarem achando */
    var turmaFinal=restoTurma.slice();
    pagoTurma.forEach(function(v){
      var k=_npDedupNorm(v.cliente),c=cobertoPorCliente[k];
      if(!c){ turmaFinal.push(v); return; }
      _npDedupInfo.cobertas.push(v);
      if(!c._anot){
        c._anot=true;
        (c.vendasB||[]).forEach(function(a){
          a._turmaId=a._turmaId||v._turmaId;
          a._turmaNome=a._turmaNome||v._turmaNome;
          a._cobreTurma=true;
        });
      }
    });

    window._npDedupInfo=_npDedupInfo;
    return turmaFinal.concat(avulsos);
  }

  /* ── Aplicar filtros ─────────────────────────────── */
  function _npFiltrar(lista){
    var q=(document.getElementById('npVendasSearch')||{}).value||'';
    var cons=(document.getElementById('npFiltroConsultor')||{}).value||'';
    var st=(document.getElementById('npFiltroStatus')||{}).value||'';
    var ori=(document.getElementById('npFiltroOrigem')||{}).value||'';
    var sessao=typeof _getSessao==='function'?_getSessao():null;
    var isPerfil=sessao&&sessao.perfil==='consultor';

    /* Filtro de data baseado no calendário (canto superior direito).
       'dia' → só vendas com v.data === dia exato.
       'periodo' → só vendas com v.data dentro do range [start, end].
       'mes'/'ano' → já filtrado upstream pelo _mesKey() na coleta do Firebase. */
    var dataIni=null, dataFim=null;
    if(_npCalMode==='dia' && _npDiaSel){
      var dy=_npDiaSel.y, dm=String(_npDiaSel.m).padStart(2,'0'), dd=String(_npDiaSel.d).padStart(2,'0');
      dataIni=dataFim=dy+'-'+dm+'-'+dd;
    } else if(_npCalMode==='periodo' && _npPerSel && _npPerSel.start && _npPerSel.end){
      var s=_npPerSel.start, e=_npPerSel.end;
      dataIni=s.y+'-'+String(s.m).padStart(2,'0')+'-'+String(s.d).padStart(2,'0');
      dataFim=e.y+'-'+String(e.m).padStart(2,'0')+'-'+String(e.d).padStart(2,'0');
    }

    return lista.filter(function(v){
      if(isPerfil){
        var meuNome=(sessao.nome||sessao.login||'').toUpperCase();
        var consVenda=(v.consultor||'').toUpperCase();
        if(!consVenda||consVenda!==meuNome) return false;
      }
      if(cons&&(v.consultor||'').toUpperCase()!==cons.toUpperCase()) return false;
      if(st&&(v.status||'').toLowerCase()!==st.toLowerCase()) return false;
      if(ori){
        if(ori.slice(0,2)==='t:'){if(v._turmaId!==ori.slice(2)) return false;}
        else{if(v._src!==ori) return false;}
      }
      if(dataIni && dataFim){
        /* Filtra apenas vendas com data explicitamente fora do range.
           Vendas sem data (turma com cl.data vazio) passam — assume que
           pertencem ao mês carregado pelo Firebase. */
        var dV=String(v.data||'').slice(0,10);
        if(dV && (dV<dataIni || dV>dataFim)) return false;
      }
      if(q){
        var ql=q.toLowerCase();
        if(!(v.cliente||'').toLowerCase().includes(ql)&&
           !(v.consultor||'').toLowerCase().includes(ql)&&
           !(v.treinamento||v.produto||'').toLowerCase().includes(ql)) return false;
      }
      return true;
    });
  }

  /* ── Calcular KPIs ───────────────────────────────── */
  function _npCalcKpis(vendas){
    var faturado=0,emAberto=0,entrada=0,potencial=0;
    var qtdPago=0,qtdAberto=0,qtdEntrada=0,qtdNegociacao=0;
    var turmaV=0,avulsoV=0,qtdT=0,qtdA=0,qtdTurmaAll=0;
    vendas.forEach(function(v){
      var val=+(v.valor||0);
      var st=(v.status||'').toLowerCase();
      if(st==='cancelado') return;
      /* Potencial total = somente vendas em negociação */
      if(st==='negociacao'){potencial+=val;qtdNegociacao++;}
      if(st==='pago'){faturado+=val;qtdPago++;}
      else if(st==='aberto'){emAberto+=val;qtdAberto++;}
      else if(st==='entrada'){entrada+=val;qtdEntrada++;}
      if(v._src==='turma'){
        qtdTurmaAll++;
        if(st==='pago'){turmaV+=val;qtdT++;}
      } else {
        if(st!=='cancelado'){avulsoV+=val;qtdA++;}
      }
    });
    var total=turmaV+avulsoV;
    var qtd=qtdT+qtdA;
    return{faturado,emAberto,entrada,potencial,
           qtdPago,qtdAberto,qtdEntrada,qtdNegociacao,
           total,turmaV,avulsoV,qtdT,qtdA,qtd,qtdTurmaAll,
           ticket:qtd?total/qtd:0,
           conv:qtdTurmaAll?Math.round(qtdT/qtdTurmaAll*100):0};
  }

  /* ── Calcular por consultor ──────────────────────── */
  /* sortBy: 'pago' (padrão, para metas) | 'total' (para ranking de volume) */
  function _npPorConsultor(vendas,filtroSrc,sortBy){
    var map={};
    vendas.forEach(function(v){
      if(filtroSrc&&v._src!==filtroSrc) return;
      var n=(v.consultor||'Sem consultor').trim();
      if(_npEhPausado(n)) return; /* pausado some de ranking/top3/gráficos */
      if(!map[n]) map[n]={nome:n,total:0,pago:0,qtd:0,qtdPago:0};
      var val=+(v.valor||0);
      var st=(v.status||'').toLowerCase();
      map[n].qtd++;
      if(st==='pago'){
        map[n].pago+=val;   /* único status que abate meta */
        map[n].qtdPago++;
      }
      if(st==='negociacao') map[n].total+=val; /* potencial = somente em negociação */
    });
    var _sb=sortBy||'pago';
    return Object.values(map).sort(function(a,b){return b[_sb]-a[_sb];});
  }
  window._npPorConsultor=_npPorConsultor;

  /* ── Render tudo ─────────────────────────────────── */
  function _npRenderTudo(){
    if(!_npAtivo) return;
    _npRenderLabel();
    _npAtualizarBtnConfigurar();
    _npColetarConsultores();
    _npPopularFiltros();
    var todas=_npTodasVendas();
    if(_npTabAtiva==='dashboard') _npRenderDashboard(todas);
    else if(_npTabAtiva==='vendas') { if(typeof window.npRenderVendas==='function') window.npRenderVendas(); }
    else if(_npTabAtiva==='metas'){ if(typeof window._npRenderMetasOverride==='function') window._npRenderMetasOverride(todas); else _npRenderMetas(todas); }
    else if(_npTabAtiva==='ranking') { if(typeof window.npRenderRanking==='function') window.npRenderRanking(); }
    else if(_npTabAtiva==='funil') { if(typeof window._fnlRender==='function') window._fnlRender(); }
    if(typeof window._fuInit==='function') window._fuInit(_mesKey());
    if(typeof window._ldInit==='function') window._ldInit(_mesKey());
  }

  function _npRenderLabel(){
    var el=document.getElementById('npMesLabel');
    var el2=document.getElementById('npBadgeMes');
    if(el) el.textContent=_mesLabel();
    if(el2) el2.textContent=_mesKey();
  }

  function _npPopularFiltros(){
    var sel=document.getElementById('npFiltroConsultor');
    if(!sel) return;
    var cur=sel.value;
    sel.innerHTML='<option value="">Todos consultores</option>';
    _npConsultores.forEach(function(n){
      var o=document.createElement('option');o.value=n;o.textContent=n;sel.appendChild(o);
    });
    if(cur) sel.value=cur;
    /* Se valor anterior não existe mais entre as options (consultor sem vendas neste mês),
       resetar explicitamente e disparar refiltragem para evitar filtro silenciosamente vazio. */
    if(cur && sel.value !== cur){
      sel.value='';
      if(typeof _npFiltrar==='function') _npFiltrar();
    }
    /* Popular select do modal */
    var mSel=document.getElementById('npVendaConsultor');
    if(mSel){
      var mc=mSel.value;
      mSel.innerHTML='<option value="">— Selecione —</option>';
      _npConsultores.forEach(function(n){
        var o=document.createElement('option');o.value=n;o.textContent=n;mSel.appendChild(o);
      });
      if(mc) mSel.value=mc;
    }
    /* Popular turmas no filtro de origem (Vendas) */
    var oriSel=document.getElementById('npFiltroOrigem');
    if(oriSel){
      var prevOri=oriSel.value;
      oriSel.innerHTML='<option value="">Turma + Avulso</option>'
        +'<option value="turma">S\xf3 turma</option>'
        +'<option value="avulso">S\xf3 avulso</option>';
      var _turmas=window._npTurmasMeta||{};
      Object.entries(_turmas).sort(function(a,b){return (a[1].nome||'').localeCompare(b[1].nome||'','pt');}).forEach(function(e){
        var o=document.createElement('option');
        o.value='t:'+e[0];
        o.textContent=e[1].nome||e[0];
        oriSel.appendChild(o);
      });
      if(prevOri) oriSel.value=prevOri;
    }
  }

  /* ── Dashboard ───────────────────────────────────── */
  function _npRenderDashboard(todas){
    function set(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}

    var COR=window._npCOR||['#c8f05a','#60a5fa','#34d399','#f59e0b','#a78bfa','#f472b6','#fb923c','#38bdf8'];

    /* Filtro por perfil — consultor vê apenas as próprias vendas em KPIs/charts.
       ADM continua vendo tudo. Ranking (npRenderRanking) é a exceção (global). */
    todas = (typeof window._npFiltrarPorPerfil === 'function')
      ? window._npFiltrarPorPerfil(todas)
      : todas;

    /* Sem dados no mes */
    var semDados=_npVendasTurma.length===0&&Object.keys(_npVendasAvulso||{}).length===0;
    if(semDados){
      ['npKpiFaturado','npKpiAberto','npKpiPotencial','npKpiEntrada'].forEach(function(id){set(id,'R$ 0');});
      set('npKpiFaturadoSub','0 pagos');set('npKpiAbertoSub','0 em aberto');
      set('npKpiPotencialSub','0 negocios');set('npKpiEntradaSub','0 entradas');
      set('npKpiFaltam','--');set('npKpiFaltamSub','');
      var _t3=document.getElementById('npTop3');
      if(_t3)_t3.innerHTML='<div class="np-empty">Nenhum dado para este mes.</div>';
      var _cc=document.getElementById('npChartConsultores');if(_cc)_cc.innerHTML='';
      var _ccs=document.getElementById('npChartConsultoresSem');if(_ccs)_ccs.innerHTML='';
      var _cm=document.getElementById('npChartMeta');if(_cm)_cm.innerHTML='';
      var _al=document.getElementById('npAlertaStrip');if(_al)_al.classList.remove('visible');
      var _ta=document.getElementById('npTurmasAtingimento');if(_ta)_ta.style.display='none';
      var _pp=document.getElementById('npPerfPanel');if(_pp)_pp.style.display='none';
      return;
    }
    var pp=document.getElementById('npPerfPanel');if(pp) pp.style.display='';

    var kpis=_npCalcKpis(todas);

    /* KPI cards */
    set('npKpiFaturado',_fmtR(kpis.faturado));
    /* o sub mostra quantas vendas de turma foram ignoradas por já virem do CRM,
       para o número não parecer "menor do que deveria" sem explicação */
    var _dd=window._npDedupInfo||{cobertas:[],semPar:[],valorCoberto:0};
    var _subFat=kpis.qtdPago+' pago'+(kpis.qtdPago!==1?'s':'');
    if(_dd.cobertas.length){
      _subFat+=' · 🎓 '+_dd.cobertas.length+' de turma já contadas via CRM ('
        +_fmtR(_dd.valorCoberto)+')';
    }
    if(_dd.semPar.length){
      _subFat+=' · ⚠ '+_dd.semPar.length+' de turma sem par no CRM';
    }
    set('npKpiFaturadoSub',_subFat);
    set('npKpiAberto',_fmtR(kpis.emAberto));
    set('npKpiAbertoSub',kpis.qtdAberto+' em aberto');
    set('npKpiPotencial',_fmtR(kpis.potencial));
    set('npKpiPotencialSub',(kpis.qtdNegociacao||0)+' em negociação');
    set('npKpiEntrada',_fmtR(kpis.entrada));
    set('npKpiEntradaSub',kpis.qtdEntrada+' entrada'+(kpis.qtdEntrada!==1?'s':''));

    /* Faltam para meta (meta geral se definida, senão soma metas básicas).
       Para consultor: usar meta INDIVIDUAL dele (metaBasica em _npGoals). */
    var metaEquipe=getMetaEquipeMes();
    var _temMetaGeral=!!(window._npMetaGeral&&window._npMetaGeral.valor>0);
    var _somaIndividual=Object.values(_npGoals||{}).reduce(function(s,g){return s+(+(g.metaBasica||g.metaValor||0));},0);
    var _tipoMeta=_temMetaGeral?' · 🌐 meta geral':(_somaIndividual>0?' · Σ individuais':'');
    /* Override para consultor: SEMPRE progressivo até a meta MASTER.
       Mesmo após bater Básica ou Mínima, segue mostrando "Falta X para Master".
       Fallback (se master não cadastrada): minima → basica. */
    var _sessFM=(typeof _getSessao==='function')?_getSessao():null;
    var _tiersAtingidos = ''; /* Texto de tiers batidos: "🥉✓ 🥈✓" */
    if(_sessFM && _sessFM.perfil==='consultor'){
      var _meuNomeFM=String(_sessFM.nome||_sessFM.login||'').toUpperCase().trim();
      var _meuGoalFM=null;
      var _goalsFM=window._npGoals||{};
      for(var _kFM in _goalsFM){
        if(String(_kFM).toUpperCase().trim()===_meuNomeFM){ _meuGoalFM=_goalsFM[_kFM]; break; }
      }
      if(_meuGoalFM){
        var _mMaster=+(_meuGoalFM.metaMaster||0);
        var _mMin=+(_meuGoalFM.metaMinima||0);
        var _mBas=+(_meuGoalFM.metaBasica||_meuGoalFM.metaValor||0);
        metaEquipe = _mMaster || _mMin || _mBas || 0;
        _tipoMeta = _mMaster ? ' · 🏆 master' : (_mMin ? ' · mínima' : ' · básica');
        /* Tiers já batidos pelo faturado atual */
        var _fat=kpis.faturado;
        if(_mBas>0 && _fat>=_mBas) _tiersAtingidos += '🥉✓ ';
        if(_mMin>0 && _fat>=_mMin) _tiersAtingidos += '🥈✓ ';
        if(_mMaster>0 && _fat>=_mMaster) _tiersAtingidos += '🥇✓';
      } else {
        metaEquipe = 0;
        _tipoMeta = ' · meta individual';
      }
    }
    var faltamCard=document.getElementById('npKpiFaltamCard');
    if(metaEquipe<=0){
      set('npKpiFaltam','--');set('npKpiFaltamSub','Meta não configurada');
      if(faltamCard) faltamCard.className='np-kpi np-kpi--red';
    } else {
      var faltamV=Math.max(metaEquipe-kpis.faturado,0);
      var pctAtg=Math.round(kpis.faturado/metaEquipe*100);
      var _suffix = _tiersAtingidos ? ' · '+_tiersAtingidos.trim() : '';
      if(faltamV===0){
        set('npKpiFaltam','MASTER!');
        set('npKpiFaltamSub','+'+_fmtR(kpis.faturado-metaEquipe)+' acima'+_tipoMeta+_suffix);
        if(faltamCard) faltamCard.className='np-kpi np-kpi--green';
      } else {
        set('npKpiFaltam',_fmtR(faltamV));
        set('npKpiFaltamSub',pctAtg+'% para'+_tipoMeta+_suffix);
        if(faltamCard) faltamCard.className='np-kpi np-kpi--red';
      }
    }

    /* Performance bar — gradiente verde→amarelo; fire quando atinge a meta */
    var getCol=typeof window._npGetCol==='function'?window._npGetCol:function(){return{bar:'#888',text:'var(--muted)'};};
    if(metaEquipe>0){
      var perfPct=Math.round(kpis.faturado/metaEquipe*100);
      var col=getCol(perfPct);
      var barW=Math.min(perfPct,100);
      var fill=document.getElementById('npPerfFill');
      var pctEl=document.getElementById('npPerfPct');
      var atingiuMeta = perfPct>=100;
      if(fill){
        fill.style.width=barW+'%';
        fill.style.background=''; /* deixa o CSS aplicar o gradiente */
        fill.classList.toggle('fire', atingiuMeta);
      }
      if(pctEl){pctEl.textContent=perfPct+'%';pctEl.style.color=atingiuMeta?'#ffe000':col.text;}
      set('npPerfFat','FATURADO: '+_fmtR(kpis.faturado));
      set('npPerfMeta','META: '+_fmtR(metaEquipe));
      var faltaEl=document.getElementById('npPerfFalta');
      if(faltaEl){
        if(atingiuMeta){
          faltaEl.innerHTML='META ATINGIDA! 🏆';
          faltaEl.className='np-perf-falta atingiu';
        } else {
          faltaEl.textContent='Faltam: '+_fmtR(faltamV);
          faltaEl.className='np-perf-falta';
        }
      }
    } else {
      var fill2=document.getElementById('npPerfFill');
      var pctEl2=document.getElementById('npPerfPct');
      if(fill2){fill2.style.width='0%';fill2.style.background='rgba(255,255,255,.1)';fill2.classList.remove('fire');}
      if(pctEl2){pctEl2.textContent='--';pctEl2.style.color='var(--muted)';}
      set('npPerfFat','Configure metas para ver performance');
      set('npPerfMeta','');
      set('npPerfFalta','');
    }

    /* Top 3 */
    var ranking=_npPorConsultor(todas,'');
    var top3=document.getElementById('npTop3');
    if(top3){
      if(!ranking.length){
        top3.innerHTML='<div class="np-empty">Sem vendas neste mes.</div>';
        var _cc2=document.getElementById('npChartConsultores');if(_cc2)_cc2.innerHTML='';
        var _ccs2=document.getElementById('npChartConsultoresSem');if(_ccs2)_ccs2.innerHTML='';
        var _cm2=document.getElementById('npChartMeta');if(_cm2)_cm2.innerHTML='';
        var _al2=document.getElementById('npAlertaStrip');if(_al2)_al2.classList.remove('visible');
        return;
      }
      var _goals3=window._npGoals||{};
      top3.innerHTML=ranking.slice(0,3).map(function(r,i){
        var cor=COR[i%COR.length];
        /* PROGRESSIVO: % calculada contra o PRÓXIMO tier (Mínima→Básica→Master) */
        var px = (typeof _npProxTier==='function')?_npProxTier(_goals3[r.nome]||{},r.pago):null;
        var col, pctTxt, tierInfo;
        if(!px || !px.meta){
          col = _npGetCol(0);
          pctTxt = '';
          tierInfo = 'Sem meta configurada';
        } else if(px.batida === 'master'){
          col = _npGetCol(100);
          pctTxt = '<span class="pct" style="color:var(--pago);">✅</span>';
          tierInfo = '✅ Master batida! (+'+_fmtR(r.pago-px.meta)+')';
        } else {
          var pctNext = Math.round(r.pago / px.meta * 100);
          col = _npGetCol(pctNext);
          pctTxt = '<span class="pct" style="color:'+col.text+';">'+pctNext+'%</span>';
          tierInfo = 'Falta '+_fmtR(px.falta)+' para '+px.label;
        }
        var convTxt = r.qtd?Math.round(r.qtdPago/r.qtd*100):0;
        var _nomeEsc=String(r.nome||'').replace(/\\/g,'\\\\').replace(/\x27/g,'\\\x27');
        return '<div class="np-rank-card" onclick="window.npAbrirConsultorDetalhe&&window.npAbrirConsultorDetalhe(\''+_nomeEsc+'\')" style="border-color:'+col.border+';background:'+col.bg+';cursor:pointer;" title="Ver detalhe de '+_esc(r.nome)+'">'
          +'<div class="np-rank-pos">'+(i+1)+'</div>'
          +'<div class="np-rank-avatar" style="background:'+cor+'22;color:'+cor+';border:1.5px solid '+cor+'55;">'+r.nome.charAt(0).toUpperCase()+'</div>'
          +'<div class="np-rank-info"><div class="np-rank-nome">'+_esc(r.nome)+'</div>'
          +'<div class="np-rank-val" style="color:'+col.text+';">'+_fmtR(r.pago)+pctTxt+'</div>'
          +'<div class="np-rank-sub">'+tierInfo+' &middot; '+convTxt+'% conv</div>'
          +'</div>'
          +'</div>';
      }).join('');
    }

    /* Grafico consultores — Tabela compacta no estilo .fpc-tbl do IC.
       9 colunas: # · Consultor · Progresso · Faturado · % · Meta ·
       Falta Mínima · Falta Básica · Falta Master */
    var chartCons=document.getElementById('npChartConsultores');
    if(chartCons){
      var _goalsCh=window._npGoals||{};
      var maxV=ranking.length?Math.max.apply(null,ranking.map(function(r){return r.pago;})):1;
      if(!maxV) maxV=1;
      var medals=['🥇','🥈','🥉'];

      function _faltaCellNP(meta, total){
        if(!meta || meta<=0) return '<td class="fpc-falta muted">—</td>';
        var diff = meta - total;
        if(diff<=0) return '<td class="fpc-falta txt-green">✓ batida</td>';
        return '<td class="fpc-falta txt-amber">'+_fmtR(diff)+'</td>';
      }

      if(!ranking.length){
        chartCons.innerHTML='<div class="np-empty">Sem dados.</div>';
      } else {
        var html='<table class="fpc-tbl">'
          +'<thead><tr>'
          +'<th class="c">#</th>'
          +'<th class="c">Consultor</th>'
          +'<th class="c">Progresso</th>'
          +'<th class="c">Faturado</th>'
          +'<th class="c">%</th>'
          +'<th class="c">Meta</th>'
          +'<th class="c">Falta Mínima</th>'
          +'<th class="c">Falta Básica</th>'
          +'<th class="c">Falta Master</th>'
          +'</tr></thead><tbody>';

        ranking.forEach(function(r,i){
          var cor=COR[i%COR.length];
          var medal = medals[i] || '';

          var g = _goalsCh[r.nome] || {};
          var metaMin = +(g.metaMinima || 0);
          var metaBas = +(g.metaBasica || g.metaValor || 0);
          var metaMas = +(g.metaMaster || 0);

          /* LÓGICA PROGRESSIVA — tier-alvo muda dinamicamente.
             Faturado < Mínima → alvo=Mínima · ≥Mínima → Básica · ≥Básica → Master */
          var px = (typeof _npProxTier==='function') ? _npProxTier(g, r.pago) : null;
          var metaRef = (px && px.meta) || 0;
          var tierLbl = px ? String(px.label||'').replace(/^[^A-Za-zÀ-ú]+/,'').trim() : '';
          var tierKey = px && px.batida ? px.batida : (px ? (px.label||'').toLowerCase().replace(/[^a-z]/g,'') : '');
          if(!tierKey && tierLbl){ tierKey = tierLbl.toLowerCase().replace(/[^a-z]/g,''); }
          var temMeta = metaRef > 0;
          var pctMeta = temMeta ? Math.round((r.pago / metaRef) * 100) : null;
          var pctClass = !temMeta ? 'muted' : pctMeta >= 100 ? 'txt-green' : pctMeta >= 70 ? 'txt-amber' : 'txt-red';
          var pctDisp = !temMeta ? '—' : (pctMeta + '%');

          /* Barra segmentada: cada um dos 3 tiers enche conforme avança.
             Mínima: 0 → metaMin     · Básica: metaMin → metaBas    · Master: metaBas → metaMas */
          var fMin = metaMin > 0 ? Math.min(100, Math.round(r.pago/metaMin*100)) : 0;
          var fBas = (metaBas > 0 && metaBas > metaMin) ? Math.max(0, Math.min(100, Math.round((r.pago-metaMin)/(metaBas-metaMin)*100))) : 0;
          var fMas = (metaMas > 0 && metaMas > metaBas) ? Math.max(0, Math.min(100, Math.round((r.pago-metaBas)/(metaMas-metaBas)*100))) : 0;
          var hasMin = metaMin > 0, hasBas = metaBas > 0, hasMas = metaMas > 0;

          var progHtml = '';
          if(temMeta){
            progHtml = '<div class="fpc-bar-tiers">'
              + '<div class="fpc-seg minima"><div class="fpc-seg-fill" style="width:'+(hasMin?fMin:0)+'%"></div></div>'
              + '<div class="fpc-seg basica"><div class="fpc-seg-fill" style="width:'+(hasBas?fBas:0)+'%"></div></div>'
              + '<div class="fpc-seg master"><div class="fpc-seg-fill" style="width:'+(hasMas?fMas:0)+'%"></div></div>'
            + '</div>'
            + '<div class="fpc-seg-labels">'
              + '<div class="fpc-seg-l'+(fMin>=100?' batida':'')+'">Mín</div>'
              + '<div class="fpc-seg-l'+(fBas>=100?' batida':'')+'">Bás</div>'
              + '<div class="fpc-seg-l'+(fMas>=100?' batida':'')+'">Mas</div>'
            + '</div>';
          } else {
            var barPct = Math.round(r.pago/maxV*100);
            progHtml = '<div class="fpc-bar"><div class="fpc-bar-fill" style="width:'+barPct+'%;background:'+cor+';"></div></div>';
          }

          html += '<tr class="fpc-row">'
            +'<td class="fpc-rk">'+(i+1)+'</td>'
            +'<td class="fpc-nome">'+(medal?'<span class="fpc-medal">'+medal+'</span> ':'')+_esc(r.nome)+'</td>'
            +'<td class="fpc-prog">'+progHtml+'</td>'
            +'<td class="fpc-val txt-green">'+_fmtR(r.pago)+'</td>'
            +'<td class="fpc-pct '+pctClass+'">'+pctDisp+(tierLbl?'<div class="fpc-tier">'+tierLbl+'</div>':'')+'</td>'
            +'<td class="fpc-meta">'+(temMeta?_fmtR(metaRef):'sem meta')+'</td>'
            + _faltaCellNP(metaMin, r.pago)
            + _faltaCellNP(metaBas, r.pago)
            + _faltaCellNP(metaMas, r.pago)
            +'</tr>';
        });

        html += '</tbody></table>';
        chartCons.innerHTML = html;
      }
    }

    /* ── Faturado por consultor — SEMANAL (semana atual) ──────────────
       Mesma estrutura visual do mensal, mas filtrando vendas pela janela
       da semana atual e usando metas semanais (_npGoalsSem). */
    var chartConsSem = document.getElementById('npChartConsultoresSem');
    var chartConsSemTit = document.getElementById('npChartConsultoresSemTit');
    if(chartConsSem){
      var semanasDash = _semanasDoMes(_npAno, _npMes);
      var semAtualDash = _semanaAtual();
      /* Resolucao da semana exibida:
         1) Se ha selecao manual via carrossel (_npFpcSemSel) -> usa
         2) Caso contrario: semana de hoje, se nao, a mais proxima */
      var jSemDash;
      if(_npFpcSemSel){
        jSemDash = semanasDash.find(function(s){return s.num===_npFpcSemSel;}) || null;
      }
      if(!jSemDash){
        jSemDash = semAtualDash
          ? semanasDash.find(function(s){return s.num===semAtualDash;})
          : _semanaMaisProxima(_ymd(new Date()), semanasDash);
      }
      if(chartConsSemTit){
        chartConsSemTit.innerHTML = _renderFpcCarousel(semanasDash, jSemDash, semAtualDash, todas);
      }
      if(!jSemDash){
        chartConsSem.innerHTML = '<div class="np-empty">Sem semana ativa no mês.</div>';
      } else {
        /* Calcula faturado por consultor na janela da semana atual */
        var faturadoSemMap = {};
        (_npConsultores||[]).forEach(function(nome){
          faturadoSemMap[nome] = _faturadoNaSemana(todas, nome, jSemDash);
        });
        /* Fonte de consultores: mesma que a aba Metas (usuários cadastrados em GU)
           pra todos aparecerem mesmo sem meta semanal nem faturamento. */
        var _usuariosGUSem = (window._npUsuarios && typeof window._npUsuarios==='object') ? window._npUsuarios : {};
        var consSemList = [];
        Object.values(_usuariosGUSem).forEach(function(u){
          if(u && u.perfil==='consultor' && u.nome) consSemList.push(u.nome);
        });
        if(!consSemList.length) consSemList = (_npConsultores||[]).slice();
        consSemList.sort(function(a,b){ return String(a).localeCompare(String(b),'pt-BR'); });
        var rankingSem = consSemList.map(function(nome){
          var g = (_npGoalsSem && _npGoalsSem[nome] && _npGoalsSem[nome][jSemDash.num]) || {};
          return {
            nome: nome,
            pago: _faturadoNaSemana(todas, nome, jSemDash),
            metaMin: +(g.min||0),
            metaBas: +(g.bas||0),
            metaMas: +(g.mas||0)
          };
        }).sort(function(a,b){
          /* Quem tem meta sobe; depois quem tem faturado; depois alfabético */
          var aHas = a.metaMin>0?1:0, bHas = b.metaMin>0?1:0;
          if(aHas !== bHas) return bHas - aHas;
          if(a.pago !== b.pago) return b.pago - a.pago;
          return String(a.nome).localeCompare(String(b.nome),'pt-BR');
        });
        var medalsSem = ['🥇','🥈','🥉'];
        var dUteisSem = _diasUteisRestantes(jSemDash);
        var hojeYMD = _ymd(new Date());
        var encerradaSem = (hojeYMD > jSemDash.fim);

        if(!rankingSem.length){
          chartConsSem.innerHTML = '<div class="np-empty">Nenhum dado semanal. Configure metas via 📅 Semanal no card do consultor.</div>';
        } else {
          /* Estrutura IDÊNTICA ao card Mensal: barra segmentada 3 tiers,
             coluna % com tier ativo, 3 colunas Falta (Min/Bas/Mas). */
          function _faltaCellSem(meta, pago){
            if(!meta || meta<=0) return '<td class="fpc-falta muted">—</td>';
            var diff = meta - pago;
            if(diff<=0) return '<td class="fpc-falta txt-green">✓ batida</td>';
            return '<td class="fpc-falta txt-amber">'+_fmtR(diff)+'</td>';
          }
          var maxVSem = Math.max.apply(null, rankingSem.map(function(r){return r.pago;}));
          if(!maxVSem) maxVSem = 1;
          var htmlSem = '<table class="fpc-tbl">'
            +'<thead><tr>'
            +'<th class="c">#</th>'
            +'<th class="c">Consultor</th>'
            +'<th class="c">Progresso</th>'
            +'<th class="c">Faturado</th>'
            +'<th class="c">%</th>'
            +'<th class="c">Meta</th>'
            +'<th class="c">Falta Mínima</th>'
            +'<th class="c">Falta Básica</th>'
            +'<th class="c">Falta Master</th>'
            +'</tr></thead><tbody>';

          rankingSem.forEach(function(r,i){
            var cor = COR[i % COR.length];
            var medal = medalsSem[i] || '';
            var metaMin = r.metaMin, metaBas = r.metaBas, metaMas = r.metaMas;
            /* Próximo tier (alvo dinâmico) — usa o helper já existente */
            var goalSem = { metaMinima:metaMin, metaBasica:metaBas, metaMaster:metaMas };
            var px = (typeof _npProxTier === 'function') ? _npProxTier(goalSem, r.pago) : null;
            var metaRef = (px && px.meta) || 0;
            var tierLbl = px ? String(px.label||'').replace(/^[^A-Za-zÀ-ú]+/,'').trim() : '';
            var temMeta = metaRef > 0;
            var pctMeta = temMeta ? Math.round((r.pago / metaRef) * 100) : null;
            var pctClass = !temMeta ? 'muted' : pctMeta >= 100 ? 'txt-green' : pctMeta >= 70 ? 'txt-amber' : 'txt-red';
            var pctDisp = !temMeta ? '—' : (pctMeta + '%');

            /* Barra segmentada igual ao mensal */
            var fMin = metaMin > 0 ? Math.min(100, Math.round(r.pago/metaMin*100)) : 0;
            var fBas = (metaBas > 0 && metaBas > metaMin) ? Math.max(0, Math.min(100, Math.round((r.pago-metaMin)/(metaBas-metaMin)*100))) : 0;
            var fMas = (metaMas > 0 && metaMas > metaBas) ? Math.max(0, Math.min(100, Math.round((r.pago-metaBas)/(metaMas-metaBas)*100))) : 0;
            var hasMin = metaMin > 0, hasBas = metaBas > 0, hasMas = metaMas > 0;

            var progHtml;
            if(temMeta){
              progHtml = '<div class="fpc-bar-tiers">'
                + '<div class="fpc-seg minima"><div class="fpc-seg-fill" style="width:'+(hasMin?fMin:0)+'%"></div></div>'
                + '<div class="fpc-seg basica"><div class="fpc-seg-fill" style="width:'+(hasBas?fBas:0)+'%"></div></div>'
                + '<div class="fpc-seg master"><div class="fpc-seg-fill" style="width:'+(hasMas?fMas:0)+'%"></div></div>'
              + '</div>'
              + '<div class="fpc-seg-labels">'
                + '<div class="fpc-seg-l'+(fMin>=100?' batida':'')+'">Mín</div>'
                + '<div class="fpc-seg-l'+(fBas>=100?' batida':'')+'">Bás</div>'
                + '<div class="fpc-seg-l'+(fMas>=100?' batida':'')+'">Mas</div>'
              + '</div>';
            } else {
              var barPct = Math.round(r.pago/maxVSem*100);
              progHtml = '<div class="fpc-bar"><div class="fpc-bar-fill" style="width:'+barPct+'%;background:'+cor+';"></div></div>';
            }

            htmlSem += '<tr class="fpc-row">'
              +'<td class="fpc-rk">'+(i+1)+'</td>'
              +'<td class="fpc-nome">'+(medal?'<span class="fpc-medal">'+medal+'</span> ':'')+_esc(r.nome)+'</td>'
              +'<td class="fpc-prog">'+progHtml+'</td>'
              +'<td class="fpc-val txt-green">'+_fmtR(r.pago)+'</td>'
              +'<td class="fpc-pct '+pctClass+'">'+pctDisp+(tierLbl?'<div class="fpc-tier">'+tierLbl+'</div>':'')+'</td>'
              +'<td class="fpc-meta">'+(temMeta?_fmtR(metaRef):'sem meta')+'</td>'
              + _faltaCellSem(metaMin, r.pago)
              + _faltaCellSem(metaBas, r.pago)
              + _faltaCellSem(metaMas, r.pago)
              +'</tr>';
          });
          htmlSem += '</tbody></table>';
          chartConsSem.innerHTML = htmlSem;
        }
      }
    }

    /* Grafico Meta x Realizado */
    var chartMeta=document.getElementById('npChartMeta');
    if(chartMeta){
      var _consNasTurmasChart=new Set(_npVendasTurma.map(function(v){return (v.consultor||'').trim().toUpperCase();}));
      var rows=_npConsultores.filter(function(nome){return _consNasTurmasChart.has((nome||'').trim().toUpperCase());}).map(function(nome,i){
        var meta=_npGoals[nome]?+((_npGoals[nome].metaValor)||0):0;
        var real=(ranking.find(function(r){return r.nome.toUpperCase()===nome.toUpperCase();})||{}).pago||0;
        var pctMeta=meta>0?Math.round(real/meta*100):0;
        return{nome:nome,meta:meta,real:real,pctMeta:pctMeta,i:i};
      }).filter(function(r){return r.meta>0||r.real>0;}).sort(function(a,b){return b.real-a.real;});
      var _vals=rows.map(function(r){return Math.max(r.meta,r.real);});
      var maxMR=_vals.length?Math.max.apply(null,_vals):1;
      if(!maxMR) maxMR=1;
      chartMeta.innerHTML=rows.length
        ?rows.map(function(r){
            var cor=COR[r.i%COR.length];
            var pctR=Math.round(r.real/maxMR*100);
            var pctM=Math.round(r.meta/maxMR*100);
            return '<div class="np-bar-row" style="flex-direction:column;align-items:stretch;margin-bottom:10px;">'
              +'<div style="font-size:11px;color:var(--text);margin-bottom:4px;">'+_esc(r.nome)+'</div>'
              +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">'
              +'<div style="font-size:9px;color:var(--accent);width:60px;">Realizado</div>'
              +'<div class="np-bar-track" style="flex:1;"><div class="np-bar-fill" style="width:'+pctR+'%;background:'+cor+'"></div></div>'
              +'<div style="font-size:10px;font-weight:700;color:var(--text);width:90px;text-align:right;">'+_fmtR(r.real)+'</div></div>'
              +'<div style="display:flex;align-items:center;gap:6px;">'
              +'<div style="font-size:9px;color:var(--muted);width:60px;">Meta</div>'
              +'<div class="np-bar-track" style="flex:1;"><div class="np-bar-fill" style="width:'+pctM+'%;background:rgba(255,255,255,.15)"></div></div>'
              +'<div style="font-size:10px;color:var(--muted);width:90px;text-align:right;">'+_fmtR(r.meta)+'</div></div>'
              +'</div>';
          }).join('')
        :'<div class="np-empty">Configure metas para ver o comparativo.</div>';
    }

    /* Atingimento por Turma */
    _npRenderTurmasAtingimento();

    /* Alertas */
    var alertEl=document.getElementById('npAlertaStrip');
    if(alertEl){
      var _consNasTurmasAlerta=new Set(_npVendasTurma.map(function(v){return (v.consultor||'').trim().toUpperCase();}));
      var abaixo=_npConsultores.filter(function(nome){
        if(!_consNasTurmasAlerta.has((nome||'').trim().toUpperCase())) return false;
        var meta=_npGoals[nome]?+((_npGoals[nome].metaValor)||0):0;
        if(!meta) return false;
        var real=(ranking.find(function(r){return r.nome.toUpperCase()===nome.toUpperCase();})||{}).pago||0;
        return real<meta*0.7;
      });
      var comMeta=_npConsultores.filter(function(nome){
        return _npGoals[nome]&&+((_npGoals[nome].metaValor)||0)>0;
      });
      if(abaixo.length){
        var msg = (comMeta.length>0 && abaixo.length===comMeta.length)
          ? 'Todos os consultores estão abaixo de 70% da meta'
          : 'Abaixo de 70% da meta: '+abaixo.join(', ');
        alertEl.textContent=msg;
        alertEl.classList.add('visible');
      } else {
        alertEl.classList.remove('visible');
      }
    }
  }

  /* ── Atingimento por Turma (formato simples, original) ──────
     Card compacto: nome turma, %, valor, qtd faturado/ativos, badge.
     Para consultor: filtrado por consultor (valores são só dele). */
  function _npRenderTurmasAtingimento(){
    var sec=document.getElementById('npTurmasAtingimento');
    var grid=document.getElementById('npTurmasAtingimentoGrid');
    if(!sec||!grid) return;
    var metas=window._npTurmasMeta||{};
    if(!Object.keys(metas).length){sec.style.display='none';return;}

    /* Vendas filtradas por perfil (consultor vê só as próprias) */
    var vendasBase = (typeof window._npFiltrarPorPerfil === 'function')
      ? window._npFiltrarPorPerfil(_npVendasTurma)
      : _npVendasTurma;

    /* Agrupar realizado por turmaId — apenas PAGO conta para atingimento */
    var realizado={}, qtdPagosT={}, qtdAtivosT={};
    vendasBase.forEach(function(v){
      if(!v._turmaId) return;
      var st=(v.status||'').toLowerCase().trim();
      if(st==='cancelado') return;
      qtdAtivosT[v._turmaId]=(qtdAtivosT[v._turmaId]||0)+1;
      if(st==='pago'){
        realizado[v._turmaId]=(realizado[v._turmaId]||0)+(+(v.valor||0));
        qtdPagosT[v._turmaId]=(qtdPagosT[v._turmaId]||0)+1;
      }
    });

    var cards=Object.entries(metas).map(function(e){
      var id=e[0],info=e[1];
      var real=realizado[id]||0;
      var meta=+(info.meta||0);
      var pct=meta>0?Math.round(real/meta*100):null;
      return {id:id,nome:info.nome,meta:meta,real:real,pct:pct,
              qtdPagos:qtdPagosT[id]||0, qtdAtivos:qtdAtivosT[id]||0};
    });

    cards.sort(function(a,b){
      if(a.pct!==null&&b.pct===null) return -1;
      if(a.pct===null&&b.pct!==null) return 1;
      if(a.pct!==null&&b.pct!==null) return b.pct-a.pct;
      return b.real-a.real;
    });

    function _cls(pct){
      if(pct===null) return 'sem-meta';
      if(pct>=100) return 'c100';
      if(pct>=75) return 'c75';
      if(pct>=50) return 'c50';
      if(pct>=25) return 'c25';
      return 'c0';
    }
    function _label(pct){
      if(pct===null) return 'Meta não definida';
      if(pct>=100) return 'Meta atingida ✅';
      if(pct>=75) return 'Quase lá! 🔵';
      if(pct>=50) return 'Em progresso 🟡';
      if(pct>=25) return 'Atenção 🟠';
      return 'Crítico 🔴';
    }

    sec.style.display='';
    grid.innerHTML=cards.map(function(c){
      var cls=_cls(c.pct);
      var pctDisp=c.pct!==null?(c.pct>999?'999%+':c.pct+'%'):'—';
      var barW=c.pct!==null?Math.min(c.pct,100):0;
      return '<div class="np-turma-atg-card" onclick="window._npAbrirModalTurma(\''+_esc(c.id)+'\')">'
        +'<div class="np-turma-atg-nome" title="'+_esc(c.nome)+'">'+_esc(c.nome)+'</div>'
        +'<div class="np-turma-atg-vals">'
          +'<span class="np-turma-atg-pct '+cls+'">'+pctDisp+'</span>'
          +'<span class="np-turma-atg-sub">'+_fmtR(c.real)+(c.meta>0?'<br><span style="font-size:10px;">meta '+_fmtR(c.meta)+'</span>':'')+'</span>'
        +'</div>'
        +(c.meta>0?'<div class="np-turma-atg-track"><div class="np-turma-atg-fill '+cls+'" style="width:'+barW+'%"></div></div>':'')
        +(c.meta===0?'<div style="font-size:10px;color:var(--muted);margin-top:4px;">Meta não definida</div>':'')
        +'<div class="np-turma-atg-footer">'
          +'<span>'+c.qtdPagos+' faturado'+(c.qtdPagos!==1?'s':'')+' / '+c.qtdAtivos+' ativo'+(c.qtdAtivos!==1?'s':'')+'</span>'
          +'<span class="np-turma-atg-badge '+cls+'">'+_label(c.pct)+'</span>'
        +'</div>'
        +'</div>';
    }).join('');
  }

  /* ── Modal Atingimento da Turma — Combo A+B compacto, KPIs clicáveis ───────
     Header compacto (% + faturado + KPIs em 1 linha) + lista clicável que
     filtra por status (Pago/Aberto/Negociação/Entrada/Desistiu).
     - Consultor: vê apenas as próprias vendas dele na turma.
     - ADM: vê agregado da turma inteira.
  ──────────────────────────────────────────────────────────────────────── */
  window._npAbrirModalTurma=function(turmaId){
    var metaInfo=(window._npTurmasMeta||{})[turmaId];
    if(!metaInfo) return;
    var overlay=document.getElementById('npTurmaModalOverlay');
    var titulo=document.getElementById('npTurmaModalTitulo');
    var body=document.getElementById('npTurmaModalBody');
    if(!overlay||!titulo||!body) return;

    /* Filtro por perfil — consultor vê só os próprios clientes da turma */
    var clientesTurma=_npVendasTurma.filter(function(v){return v._turmaId===turmaId;});
    clientesTurma = (typeof window._npFiltrarPorPerfil==='function')
      ? window._npFiltrarPorPerfil(clientesTurma)
      : clientesTurma;

    var _sessMd=(typeof _getSessao==='function')?_getSessao():null;
    var _isConsMd = _sessMd && _sessMd.perfil==='consultor';
    var _nomeMd = _isConsMd ? (_sessMd.nome||_sessMd.login||'') : '';

    /* Agrupar por status */
    var statusKeys=['pago','aberto','negociacao','entrada','desistiu'];
    var stats={};
    statusKeys.forEach(function(k){stats[k]={count:0,valor:0,clientes:[]};});
    clientesTurma.forEach(function(v){
      var st=String(v.status||'aberto').toLowerCase().trim();
      if(st==='cancelado') return;
      if(!stats[st]) stats[st]={count:0,valor:0,clientes:[]};
      stats[st].count++;
      stats[st].valor += +(v.valor||0);
      stats[st].clientes.push(v);
    });

    /* Meta usada — consultor: meta individual; ADM: meta da turma */
    var totalMeta=+(metaInfo.meta||0);
    var metaUsada=totalMeta;
    var metaLabel='Meta turma';
    if(_isConsMd){
      var goalsObj=window._npGoals||{};
      var meuNomeUp=_nomeMd.toUpperCase().trim();
      var meuGoal=null;
      for(var _k in goalsObj){
        if(String(_k).toUpperCase().trim()===meuNomeUp){ meuGoal=goalsObj[_k]; break; }
      }
      if(meuGoal){
        var _mM=+(meuGoal.metaMaster||0), _mMn=+(meuGoal.metaMinima||0), _mB=+(meuGoal.metaBasica||meuGoal.metaValor||0);
        metaUsada = _mM || _mMn || _mB || 0;
        metaLabel = _mM ? '🏆 Meta master' : (_mMn ? 'Meta mínima' : 'Meta básica');
      } else {
        metaUsada = totalMeta>0 ? totalMeta : 0;
      }
    }
    var pagoTotal=stats.pago.valor;
    var pctMeta=metaUsada>0?Math.round(pagoTotal/metaUsada*100):null;
    var faltam=metaUsada>0?Math.max(0,metaUsada-pagoTotal):0;
    var pctCls = pctMeta===null?'':(pctMeta>=100?'c100':pctMeta>=75?'c75':pctMeta>=50?'c50':pctMeta>=25?'c25':'c0');
    var pctDisp = pctMeta!==null?(pctMeta>999?'999%+':pctMeta+'%'):'—';

    function _f(v){return 'R\$ '+(+v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}

    /* Hero compacto + 4 KPIs em uma linha */
    var heroHtml = ''
      +'<div class="ntm-grid">'
        +'<div class="ntm-hero">'
          +'<div class="ntm-hero-l">% '+(_isConsMd?'meta individual':'meta turma')+'</div>'
          +'<div class="ntm-hero-pct '+pctCls+'">'+pctDisp+'</div>'
          +'<div class="ntm-hero-meta">'
            +(metaUsada>0
              ? metaLabel+' '+_f(metaUsada)+(faltam>0?' · falta '+_f(faltam):' · ✅ batida')
              : 'Meta não configurada')
          +'</div>'
        +'</div>'
        +'<div class="ntm-kpis">'
          +_kpiHtml('pago','Pago','✅',stats.pago,'pago')
          +_kpiHtml('aberto','Aberto','🟠',stats.aberto,'aberto')
          +_kpiHtml('negociacao','Neg.','🔵',stats.negociacao,'negociacao')
          +_kpiHtml('entrada','Entr.','⚡',stats.entrada,'entrada')
        +'</div>'
      +'</div>';

    function _kpiHtml(key,lbl,ico,s,colorClass){
      var active = key==='pago' ? ' ativo' : ''; /* default: pago */
      return '<button class="ntm-kpi '+colorClass+active+'" data-st="'+key+'" onclick="window._npModalSetTab(\''+key+'\')">'
        +'<div class="ntm-kpi-h"><span class="ntm-kpi-l">'+lbl+'</span><span class="ntm-kpi-i">'+ico+'</span></div>'
        +'<div class="ntm-kpi-v">'+_f(s.valor)+'</div>'
        +'<div class="ntm-kpi-q">'+s.count+(s.count===1?' venda':' vendas')+'</div>'
      +'</button>';
    }

    /* Listas (uma por status, oculta a inativa) */
    function _listaHtml(st,s,iconLabel){
      if(!s.count){
        return '<div class="ntm-lista" data-st="'+st+'"'+(st==='pago'?'':' style="display:none;"')+'>'
          +'<div class="ntm-empty">Sem '+iconLabel.toLowerCase()+' nesta turma.</div>'
          +'</div>';
      }
      var rows=s.clientes
        .slice()
        .sort(function(a,b){return (+(b.valor||0))-(+(a.valor||0));})
        .map(function(v){
          var sub='';
          if(_isConsMd){
            sub = _esc(v.treinamento||'—');
          } else {
            sub = _esc((v.consultor||'—')+' · '+(v.treinamento||'—'));
          }
          return '<div class="ntm-cli-row '+st+'">'
            +'<div class="ntm-cli-info">'
              +'<div class="ntm-cli-nome">'+_esc(v.cliente||v.clienteNome||'—')+'</div>'
              +'<div class="ntm-cli-sub">'+sub+'</div>'
            +'</div>'
            +'<div class="ntm-cli-val '+st+'">'+_f(+(v.valor||0))+'</div>'
          +'</div>';
        }).join('');
      return '<div class="ntm-lista" data-st="'+st+'"'+(st==='pago'?'':' style="display:none;"')+'>'
        +'<div class="ntm-lista-h"><span>'+iconLabel+'</span><span>'+_f(s.valor)+' · '+s.count+(s.count===1?' venda':' vendas')+'</span></div>'
        +rows
        +'</div>';
    }

    var listasHtml = ''
      +_listaHtml('pago',       stats.pago,       '✅ Pagos')
      +_listaHtml('aberto',     stats.aberto,     '🟠 Em aberto')
      +_listaHtml('negociacao', stats.negociacao, '🔵 Em negociação')
      +_listaHtml('entrada',    stats.entrada,    '⚡ Entradas')
      +(stats.desistiu.count?_listaHtml('desistiu', stats.desistiu, '❌ Desistiram'):'');

    /* Render final */
    titulo.textContent='🏫 '+metaInfo.nome+(_isConsMd?' · Sua performance':'');
    body.innerHTML = heroHtml + '<div class="ntm-listas-wrap">'+listasHtml+'</div>';
    overlay.classList.add('open');
  };

  /* Trocar aba ativa (clique no KPI) */
  window._npModalSetTab = function(st){
    var body=document.getElementById('npTurmaModalBody');
    if(!body) return;
    /* Atualiza estado dos KPIs */
    body.querySelectorAll('.ntm-kpi').forEach(function(el){
      el.classList.toggle('ativo', el.getAttribute('data-st')===st);
    });
    /* Mostra apenas a lista correspondente */
    body.querySelectorAll('.ntm-lista').forEach(function(el){
      el.style.display = (el.getAttribute('data-st')===st) ? '' : 'none';
    });
  };

  window._npFecharModalTurma=function(){
    var o=document.getElementById('npTurmaModalOverlay');
    if(o) o.classList.remove('open');
  };

  /* ── Vendas ──────────────────────────────────────── */
  var _npSortTurma={col:'',dir:1};
  var _npSortAvulso={col:'',dir:1};
  window.npSortAvulso=function(col){
    if(_npSortAvulso.col===col){_npSortAvulso.dir*=-1;}
    else{_npSortAvulso.col=col;_npSortAvulso.dir=1;}
    window.npRenderVendas();
  };
  window.npSortTurma=function(col){
    if(_npSortTurma.col===col){_npSortTurma.dir*=-1;}
    else{_npSortTurma.col=col;_npSortTurma.dir=1;}
    window.npRenderVendas();
  };
  window.npRenderVendas=function(){
    var todas=_npTodasVendas();
    var filtradas=_npFiltrar(todas);
    var turma=filtradas.filter(function(v){return v._src==='turma';});
    /* Ordenação turma */
    var sc=_npSortTurma.col,sd=_npSortTurma.dir;
    if(sc){
      turma=turma.slice().sort(function(a,b){
        var va,vb;
        if(sc==='valor'){va=+(a.valor||0);vb=+(b.valor||0);return (va-vb)*sd;}
        if(sc==='cliente'){va=(a.cliente||'').toLowerCase();vb=(b.cliente||'').toLowerCase();}
        else if(sc==='consultor'){va=(a.consultor||'').toLowerCase();vb=(b.consultor||'').toLowerCase();}
        else if(sc==='treinamento'){va=(a.treinamento||'').toLowerCase();vb=(b.treinamento||'').toLowerCase();}
        else if(sc==='status'){va=(a.status||'').toLowerCase();vb=(b.status||'').toLowerCase();}
        else if(sc==='turma'){va=(a._turmaNome||'').toLowerCase();vb=(b._turmaNome||'').toLowerCase();}
        else{return 0;}
        return va<vb?-sd:va>vb?sd:0;
      });
    }
    /* Atualizar setas */
    ['cliente','consultor','treinamento','valor','status','turma'].forEach(function(c){
      var el=document.getElementById('npSortArrow_'+c);
      if(!el) return;
      if(c!==sc){el.textContent='⇅';}
      else{el.textContent=sd===1?'↓':'↑';}
    });
    var avulso=filtradas.filter(function(v){return v._src==='avulso';});
    /* Ordenação avulso */
    var scA=_npSortAvulso.col,sdA=_npSortAvulso.dir;
    if(scA){
      avulso=avulso.slice().sort(function(a,b){
        var va,vb;
        if(scA==='valor'){va=+(a.valor||0);vb=+(b.valor||0);return (va-vb)*sdA;}
        if(scA==='cliente'){va=(a.clienteNome||a.cliente||'').toLowerCase();vb=(b.clienteNome||b.cliente||'').toLowerCase();}
        else if(scA==='consultor'){va=(a.consultorNome||a.consultor||'').toLowerCase();vb=(b.consultorNome||b.consultor||'').toLowerCase();}
        else if(scA==='produto'){va=(a.produto||'').toLowerCase();vb=(b.produto||'').toLowerCase();}
        else if(scA==='status'){va=(a.status||'').toLowerCase();vb=(b.status||'').toLowerCase();}
        else if(scA==='data'){va=String(a.data||'');vb=String(b.data||'');}
        else{return 0;}
        return va<vb?-sdA:va>vb?sdA:0;
      });
    }
    /* Atualizar setas avulso */
    ['cliente','consultor','produto','valor','status','data'].forEach(function(c){
      var el=document.getElementById('npSortArrowA_'+c);
      if(!el) return;
      if(c!==scA){el.textContent='⇅';}
      else{el.textContent=sdA===1?'↓':'↑';}
    });

    /* Badge — count + SOMA total (mostra valor agregado do filtro vigente) */
    var _stAtivo=(document.getElementById('npFiltroStatus')||{}).value||'';
    var somaTurma=turma.reduce(function(s,v){return s+(+(v.valor||0));},0);
    var somaAvulso=avulso.reduce(function(s,v){return s+(+(v.valor||0));},0);
    var somaGeral=somaTurma+somaAvulso;
    var qtdGeral=turma.length+avulso.length;
    var sufixo = _stAtivo ? ' · '+_stAtivo.toUpperCase() : '';
    var bT=document.getElementById('npBadgeTurma');
    if(bT){
      bT.innerHTML = turma.length + ' &middot; <span style="color:var(--accent);font-weight:800;">'+_fmtR(somaTurma)+'</span>'+sufixo;
    }
    var bA=document.getElementById('npBadgeAvulso');
    if(bA){
      bA.innerHTML = avulso.length + ' &middot; <span style="color:var(--accent);font-weight:800;">'+_fmtR(somaAvulso)+'</span>'+sufixo;
    }
    /* Tfoot — total por tabela */
    var tT=document.getElementById('npTotalTurma');     if(tT) tT.textContent = _fmtR(somaTurma);
    var tA=document.getElementById('npTotalAvulso');    if(tA) tA.textContent = _fmtR(somaAvulso);
    /* Total geral combinado */
    var tG=document.getElementById('npTotalGeralValor'); if(tG) tG.textContent = _fmtR(somaGeral);
    var tGs=document.getElementById('npTotalGeralSub');
    if(tGs){
      tGs.textContent = qtdGeral + ' venda' + (qtdGeral!==1?'s':'') + ' · '
        + turma.length + ' de turma · ' + avulso.length + ' avulsa' + (avulso.length!==1?'s':'')
        + (_stAtivo ? ' · filtrado por ' + _stAtivo.toUpperCase() : '');
    }

    /* Tabela turma */
    var tbT=document.getElementById('npTbodyTurma');
    if(tbT) tbT.innerHTML=turma.length
      ?turma.map(function(v){
          var isNeg=(v.status||'').toLowerCase()==='negociacao';
          var fuBtn=isNeg
            ?'<button class="np-fu-btn" data-cons="'+_esc(v.consultor)+'" data-cli="'+_esc(v.cliente)+'"'
              +' onclick="npAbrirFollowUp(\''+_esc(v.consultor)+'\',\''+_esc(v.cliente)+'\')"'
              +' style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 6px;opacity:.5;color:var(--muted);transition:opacity .15s;border-radius:4px;"'
              +' title="Definir próxima ação">📅</button>'
            :'';
          return '<tr>'
            +'<td>'+_esc(v.cliente)+'</td>'
            +'<td>'+_esc(v.consultor)+'</td>'
            +'<td>'+_esc(v.treinamento||'—')+'</td>'
            +'<td class="r">'+_fmtR(v.valor)+'</td>'
            +'<td><span class="'+_stClass(v.status)+'">'+_esc((v.status||'aberto').toUpperCase())+'</span>'+fuBtn+'</td>'
            +'<td style="font-size:10px;color:var(--muted);">'+_esc(v._turmaNome||'—')+'</td>'
            +'</tr>';
        }).join('')
      :'<tr><td colspan="6" class="np-empty">Nenhuma venda de turma neste período.</td></tr>';
    /* Atualizar indicadores de follow-up nos botões recém-criados */
    if(typeof window._fuInjetarBotoes==='function') setTimeout(window._fuInjetarBotoes, 50);

    /* Tabela avulso */
    var tbA=document.getElementById('npTbodyAvulso');
    /* Converte data ISO (yyyy-mm-dd) para dd/mm/yyyy. Aceita também strings já formatadas. */
    function _fmtData(d){
      if(!d) return '—';
      var m=String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if(m) return m[3]+'/'+m[2]+'/'+m[1];
      return d;
    }
    if(tbA) tbA.innerHTML=avulso.length
      ?avulso.map(function(v){
          return '<tr>'
            +'<td>'+_esc(v.clienteNome||v.cliente||'—')+'</td>'
            +'<td>'+_esc(v.consultorNome||v.consultor||'—')+'</td>'
            +'<td>'+_esc(v.produto||'—')+'</td>'
            +'<td class="r">'+_fmtR(v.valor)+'</td>'
            +'<td><span class="'+_stClass(v.status)+'">'+_esc((v.status||'aberto').toUpperCase())+'</span></td>'
            +'<td style="font-size:10px;color:var(--muted);">'+_esc(_fmtData(v.data))+'</td>'
            +'<td style="white-space:nowrap;width:90px;text-align:right;">'
              +'<button title="Editar" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:4px 8px;margin-right:8px;border-radius:4px;transition:background .15s;" onmouseover="this.style.background=\'rgba(255,255,255,.08)\'" onmouseout="this.style.background=\'none\'" onclick="npEditarVenda(\''+v._id+'\')">✏</button>'
              +'<button title="Excluir" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:4px 8px;border-radius:4px;transition:background .15s;" onmouseover="this.style.background=\'rgba(255,95,87,.12)\'" onmouseout="this.style.background=\'none\'" onclick="npExcluirVenda(\''+v._id+'\')">✕</button>'
            +'</td>'
            +'</tr>';
        }).join('')
      :'<tr><td colspan="7" class="np-empty">Nenhuma venda avulsa neste período.</td></tr>';
  };

  /* ── Metas ───────────────────────────────────────── */
  function _npRenderMetas(todas){
    var grid=document.getElementById('npMetasGrid');if(!grid) return;
    if(_npVendasTurma.length===0&&Object.keys(_npVendasAvulso||{}).length===0){
      grid.innerHTML='<div class="np-empty">Nenhum dado para este mês.</div>';return;
    }
    if(!_npConsultores.length){
      grid.innerHTML='<div class="np-empty">Nenhum consultor encontrado.</div>';return;
    }
    /* Para consultor: mostrar apenas a própria meta */
    var _sessMt=(typeof _getSessao==='function')?_getSessao():null;
    var _consList = _npConsultores;
    if(_sessMt && _sessMt.perfil==='consultor'){
      var _meuNomeMt=String(_sessMt.nome||_sessMt.login||'').toUpperCase().trim();
      _consList = _npConsultores.filter(function(n){return String(n).toUpperCase().trim()===_meuNomeMt;});
      if(!_consList.length){
        grid.innerHTML='<div class="np-empty">Nenhuma meta vinculada a você neste mês.</div>';return;
      }
    }
    var ranking=_npPorConsultor(todas,'','pago');
    var semanas = _semanasDoMes(_npAno, _npMes);
    var semAtualAuto = _semanaAtual();
    _npSemSel = _npSemSel || {};
    grid.innerHTML=_consList.map(function(nome,i){
      var goal=_npGoals[nome]||{};
      var metaMin = +(goal.metaMinima || goal.metaValor || 0);
      var metaBas = +(goal.metaBasica || metaMin);
      var metaMas = +(goal.metaMaster || metaBas);
      var r=ranking.find(function(x){return x.nome===nome;})||{total:0,pago:0,qtd:0,qtdPago:0};
      var pctMin = metaMin ? Math.round(r.pago/metaMin*100) : 0;
      /* Tier mensal atual */
      var tierLbl, tierBg, tierColor;
      if(metaMas && r.pago >= metaMas){ tierLbl='MASTER'; tierBg='linear-gradient(135deg,#d4a574,#b88a5a)'; tierColor='#0a0e1a'; }
      else if(metaBas && r.pago >= metaBas){ tierLbl='BÁSICA'; tierBg='rgba(212,165,116,.18)'; tierColor='#f0c896'; }
      else if(metaMin && r.pago >= metaMin){ tierLbl='MÍNIMA'; tierBg='rgba(52,211,153,.18)'; tierColor='#86efac'; }
      else { tierLbl='CRÍTICO'; tierBg='linear-gradient(135deg,#ef4444,#b91c1c)'; tierColor='#fff'; }

      /* Semana selecionada (default = atual) */
      var semSel = _npSemSel[nome] || semAtualAuto || (semanas.length?semanas[semanas.length-1].num:1);
      var janela = semanas.find(function(s){return s.num===semSel;}) || (semanas[0] || null);

      /* Metas semanais salvas (override) */
      var metasSemConsultor = (_npGoalsSem && _npGoalsSem[nome]) || {};
      var mSem = metasSemConsultor[semSel] || {};
      var metaSemMin = +(mSem.min || 0);

      /* Faturado da semana selecionada */
      var fatSem = janela ? _faturadoNaSemana(todas, nome, janela) : 0;
      var pctSem = metaSemMin ? Math.round(fatSem/metaSemMin*100) : 0;

      /* Chip semanal */
      var semIco, semLbl, semChipBg, semChipColor, semChipBorder;
      if(!metaSemMin){ semIco='—'; semLbl='SEM META'; semChipBg='rgba(255,255,255,.05)'; semChipColor='var(--muted)'; semChipBorder='var(--border)'; }
      else if(pctSem >= 100){ semIco='✅'; semLbl='BATEU'; semChipBg='rgba(52,211,153,.18)'; semChipColor='#86efac'; semChipBorder='rgba(52,211,153,.35)'; }
      else if(pctSem >= 60){ semIco='🔥'; semLbl='NO RITMO'; semChipBg='rgba(212,165,116,.18)'; semChipColor='#f0c896'; semChipBorder='rgba(212,165,116,.35)'; }
      else { semIco='⚠'; semLbl='DEVAGAR'; semChipBg='rgba(245,158,11,.18)'; semChipColor='#fbbf24'; semChipBorder='rgba(245,158,11,.35)'; }

      /* Stepper */
      var stepperHtml = semanas.map(function(s){
        var cls = 'np-step-dot';
        if(s.num < (semAtualAuto||0)) cls += ' past';
        if(s.num === semSel) cls += ' curr';
        return '<button class="'+cls+'" data-step-n="'+s.num+'" title="Semana '+s.num+' ('+s.iniLabel+'-'+s.fimLabel+')">'+s.num+'</button>';
      }).join('<span class="np-step-conn"></span>');

      /* Pace text */
      var paceHtml = '';
      if(janela){
        var dias = _diasUteisRestantes(janela);
        var encerrada = (_ymd(new Date()) > janela.fim);
        if(metaSemMin){
          if(fatSem >= metaSemMin){
            paceHtml = '📅 <b>Semana '+semSel+' ('+janela.iniLabel+'-'+janela.fimLabel+'):</b> Faturou '+_fmtR(fatSem)+' de <b>'+_fmtR(metaSemMin)+'</b> · <b>Bateu +'+_fmtR(fatSem-metaSemMin)+'</b> 🏆';
          } else if(encerrada || dias===0){
            paceHtml = '📅 <b>Semana '+semSel+' ('+janela.iniLabel+'-'+janela.fimLabel+'):</b> Faturou '+_fmtR(fatSem)+' de <b>'+_fmtR(metaSemMin)+'</b> · Encerrada';
          } else {
            var falta = Math.max(0, metaSemMin - fatSem);
            var ritmo = dias>0 ? Math.round(falta/dias) : 0;
            paceHtml = '📅 <b>Semana '+semSel+' ('+janela.iniLabel+'-'+janela.fimLabel+'):</b> Faltam <b>'+_fmtR(falta)+'</b> de <b>'+_fmtR(metaSemMin)+'</b> em <b>'+dias+' dias úteis</b> ('+_fmtR(ritmo)+'/dia)';
          }
        } else {
          paceHtml = '📅 <b>Semana '+semSel+' ('+janela.iniLabel+'-'+janela.fimLabel+'):</b> sem meta semanal configurada · clique em <b>📅 Semanal</b> para definir';
        }
      }

      var nomeEsc = String(nome||'').replace(/\\/g,'\\\\').replace(/\x27/g,'\\\x27');
      return '<div class="np-meta-card np-meta-card-v9">'
        +'<div class="np-mc-h">'
        +  '<div class="np-mc-av">'+nome.charAt(0).toUpperCase()+'</div>'
        +  '<div style="flex:1;min-width:0;">'
        +    '<div class="np-mc-nome">'+_esc(nome)+'</div>'
        +    '<div class="np-mc-chips">'
        +      '<span class="np-mc-chip" style="background:'+tierBg+';color:'+tierColor+';">'+tierLbl+'</span>'
        +      '<span class="np-mc-chip" style="background:'+semChipBg+';color:'+semChipColor+';border:1px solid '+semChipBorder+';">'+semIco+' '+pctSem+'% · S'+semSel+'</span>'
        +    '</div>'
        +  '</div>'
        +'</div>'
        +(semanas.length>1 ? '<div class="np-mc-stepper">'+stepperHtml+'</div>' : '')
        +'<div class="np-mc-big">'
        +  '<div class="np-mc-big-v">'+_fmtR(r.pago)+' <small>faturado total</small></div>'
        +  '<div><span class="np-mc-pct'+(pctMin<70?' bad':pctMin>=100?' ok':' warn')+'">'+pctMin+'%</span> <span class="np-mc-pct s '+(pctSem<60?'bad':pctSem>=100?'ok':'warn')+'"> · '+pctSem+'%</span></div>'
        +'</div>'
        +'<div class="np-mc-tiers">'
        +  '<div class="np-mc-t"><div class="lbl">MÍNIMA</div><div class="v">'+_fmtR(metaMin)+'</div></div>'
        +  '<div class="np-mc-t"><div class="lbl">BÁSICA</div><div class="v">'+_fmtR(metaBas)+'</div></div>'
        +  '<div class="np-mc-t"><div class="lbl">MASTER</div><div class="v">'+_fmtR(metaMas)+'</div></div>'
        +'</div>'
        +(paceHtml ? '<div class="np-mc-pace">'+paceHtml+'</div>' : '')
        +'<div class="np-mc-foot">'
        +  '<button class="np-mc-btn" onclick="npAbrirModalMeta(\''+nomeEsc+'\')">⚙ Configurar metas</button>'
        +  '<button class="np-mc-btn sem" onclick="npAbrirModalSemanal(\''+nomeEsc+'\')">📅 Semanal</button>'
        +'</div>'
        +'</div>';
    }).join('');

    /* Wire stepper: muda a semana selecionada e re-render */
    grid.querySelectorAll('[data-step-n]').forEach(function(b){
      b.addEventListener('click', function(){
        var card = b.closest('.np-meta-card');
        if(!card) return;
        var btnConf = card.querySelector('.np-mc-btn');
        if(!btnConf) return;
        /* extrai nome do onclick do botão configurar */
        var m = /npAbrirModalMeta\('([^']+)'\)/.exec(btnConf.getAttribute('onclick')||'');
        if(!m) return;
        var nome = m[1].replace(/\\\\/g,'\\').replace(/\\'/g,"'");
        _npSemSel[nome] = +b.dataset.stepN;
        _npRenderMetas(todas);
      });
    });
  }
  var _npSemSel = {};   /* cache em sessão: { consultor: numSemana selecionada } */

  /* ── Ranking ─────────────────────────────────────── */
  /* Renderização sobrescrita pelo 12-pipeline-v2-patch.js — placeholder para evitar erro se v2 não carregar */
  window.npRenderRanking=window.npRenderRanking||function(){
    var el=document.getElementById('npRankingList');
    if(el) el.innerHTML='<div class="np-empty">Carregando...</div>';
  };

  /* Popular dropdown de Produto/Serviço com os mesmos treinamentos da
     lista global allTreinamentos (gerenciada pelo modal "Gerenciar Treinamentos").
     selVal: valor já gravado na venda — se não estiver na lista, é incluído como
     "personalizado" para não ser perdido na edição. */
  function _npPopularProdutoOptions(selVal){
    var sel=document.getElementById('npVendaProduto');
    if(!sel) return;
    var lista=(typeof window.allTreinamentos!=='undefined'&&Array.isArray(window.allTreinamentos))?window.allTreinamentos.slice()
             :(typeof allTreinamentos!=='undefined'&&Array.isArray(allTreinamentos))?allTreinamentos.slice()
             :[];
    /* Garantir que o valor atual da venda continua selecionável mesmo se foi removido da lista */
    var atual=String(selVal||'').trim();
    if(atual && lista.indexOf(atual)<0 && lista.indexOf(atual.toUpperCase())<0){
      lista.push(atual);
    }
    /* Ordenar alfabeticamente */
    lista.sort(function(a,b){return String(a).localeCompare(String(b),'pt-BR');});
    var html='<option value="">— Selecione um treinamento —</option>';
    lista.forEach(function(n){
      var sl=(atual && (n===atual||String(n).toUpperCase()===atual.toUpperCase()))?' selected':'';
      html+='<option value="'+_esc(n)+'"'+sl+'>'+_esc(n)+'</option>';
    });
    sel.innerHTML=html;
  }

  /* ── Modal Nova Venda ────────────────────────────── */
  window.npAbrirModalVenda=function(){
    _npVendaEditId=null;
    document.getElementById('npModalVendaTitulo').textContent='Nova Venda Avulsa';
    document.getElementById('npVendaId').value='';
    document.getElementById('npVendaCliente').value='';
    document.getElementById('npVendaValor').value='';
    document.getElementById('npVendaOrigem').value='';
    document.getElementById('npVendaObs').value='';
    document.getElementById('npVendaStatus').value='aberto';
    document.getElementById('npVendaData').value=new Date().toISOString().slice(0,10);
    _npPopularFiltros();
    _npPopularProdutoOptions('');
    /* Se perfil=consultor: pré-preencher e bloquear campo consultor */
    var sessao=typeof _getSessao==='function'?_getSessao():null;
    var isConsultor=sessao&&sessao.perfil==='consultor';
    var selC=document.getElementById('npVendaConsultor');
    if(selC&&isConsultor){
      var nomeC=sessao.nome||sessao.login||'';
      selC.value=nomeC;
      selC.disabled=true;
      selC.style.opacity='.6';
    } else if(selC){
      selC.disabled=false;
      selC.style.opacity='';
    }
    document.getElementById('npModalVenda').classList.add('open');
  };

  window.npEditarVenda=function(id){
    var v=_npVendasAvulso[id];if(!v) return;
    _npVendaEditId=id;
    document.getElementById('npModalVendaTitulo').textContent='Editar Venda';
    document.getElementById('npVendaId').value=id;
    document.getElementById('npVendaCliente').value=v.clienteNome||v.cliente||'';
    document.getElementById('npVendaValor').value=(+(v.valor||0)).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    document.getElementById('npVendaOrigem').value=v.origemManual||'';
    document.getElementById('npVendaObs').value=v.obs||'';
    document.getElementById('npVendaStatus').value=v.status||'aberto';
    document.getElementById('npVendaData').value=v.data||'';
    _npPopularFiltros();
    _npPopularProdutoOptions(v.produto||'');
    setTimeout(function(){
      var mSel=document.getElementById('npVendaConsultor');
      if(mSel) mSel.value=v.consultorNome||v.consultor||'';
    },50);
    document.getElementById('npModalVenda').classList.add('open');
  };

  window.npFecharModalVenda=function(){
    document.getElementById('npModalVenda').classList.remove('open');
  };

  /* ── Detalhe de KPI (Faturado / Em Aberto / Potencial / Entrada) ── */
  /* tipo: 'faturado' | 'aberto' | 'potencial' | 'entrada' */
  window.npAbrirKpiDetalhe=function(tipo){
    var TIPOS={
      faturado :{titulo:'💚 Faturado',           sub:'Vendas com status PAGO (não cancelado)',  filtro:function(v){return (v.status||'').toLowerCase()==='pago';}},
      aberto   :{titulo:'🟠 Em aberto',          sub:'Vendas com status ABERTO',                filtro:function(v){return (v.status||'').toLowerCase()==='aberto';}},
      potencial:{titulo:'🔵 Potencial total',    sub:'Vendas em NEGOCIAÇÃO',                    filtro:function(v){return (v.status||'').toLowerCase()==='negociacao';}},
      entrada  :{titulo:'⚡ Total entrada',      sub:'Vendas com status ENTRADA',               filtro:function(v){return (v.status||'').toLowerCase()==='entrada';}}
    };
    var def=TIPOS[tipo]; if(!def) return;
    var todas=typeof _npTodasVendas==='function'?_npTodasVendas():[];
    /* Para consultor: filtrar apenas vendas próprias antes de aplicar o filtro de status */
    todas = (typeof window._npFiltrarPorPerfil==='function')
      ? window._npFiltrarPorPerfil(todas)
      : todas;
    var lista=todas.filter(def.filtro);
    var total=lista.reduce(function(s,v){return s+(+(v.valor||0));},0);
    var qtd=lista.length;

    document.getElementById('npKpiDetalheTitulo').textContent=def.titulo+' — '+(typeof _mesLabel==='function'?_mesLabel():'');

    var resumoHtml=def.sub
      +' &middot; <strong style="color:var(--text);">'+qtd+'</strong> venda'+(qtd!==1?'s':'')
      +' &middot; total <strong style="color:var(--text);">'+_fmtR(total)+'</strong>';
    document.getElementById('npKpiDetalheResumo').innerHTML=resumoHtml;

    var body=document.getElementById('npKpiDetalheBody');
    if(!qtd){
      body.innerHTML='<div class="np-kpi-detail-empty">Nenhuma venda neste critério.</div>';
    } else {
      var head='<div class="np-kpi-detail-row head">'
        +'<div>Cliente</div><div>Consultor</div><div>Treinamento/Produto</div>'
        +'<div class="v-money">Valor</div><div>Status</div><div>Origem</div>'
        +'</div>';
      var rows=lista
        .slice()
        .sort(function(a,b){return (+(b.valor||0))-(+(a.valor||0));})
        .map(function(v){
          var nomeCliente=v.cliente||v.clienteNome||'—';
          var nomeCons=v.consultor||v.consultorNome||'—';
          var produto=v.treinamento||v.produto||'—';
          var st=(v.status||'aberto').toLowerCase();
          var origem=v._src==='turma'?(v._turmaNome||'Turma'):'Avulso';
          return '<div class="np-kpi-detail-row">'
            +'<div title="'+_esc(nomeCliente)+'" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_esc(nomeCliente)+'</div>'
            +'<div title="'+_esc(nomeCons)+'" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_esc(nomeCons)+'</div>'
            +'<div title="'+_esc(produto)+'" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);">'+_esc(produto)+'</div>'
            +'<div class="v-money">'+_fmtR(v.valor||0)+'</div>'
            +'<div><span class="'+_stClass(st)+'">'+_esc(st.toUpperCase())+'</span></div>'
            +'<div title="'+_esc(origem)+'" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:var(--muted);">'+_esc(origem)+'</div>'
            +'</div>';
        }).join('');
      body.innerHTML=head+rows;
    }
    document.getElementById('npModalKpiDetalhe').classList.add('open');
  };

  window.npFecharKpiDetalhe=function(){
    var el=document.getElementById('npModalKpiDetalhe');
    if(el) el.classList.remove('open');
  };

  /* ── Detalhe do Consultor (clique no card de meta) ─────── */
  window.npAbrirConsultorDetalhe=function(nome){
    if(!nome) return;
    var todas=typeof _npTodasVendas==='function'?_npTodasVendas():[];
    var nomeUp=String(nome).toUpperCase();
    var lista=todas.filter(function(v){return String(v.consultor||'').toUpperCase()===nomeUp;});

    /* Agregados */
    var faturado=0,emAberto=0,emEntrada=0,emNegociacao=0,cancelado=0;
    var qtdPago=0,qtdAberto=0,qtdEntrada=0,qtdNegociacao=0,qtdCancelado=0;
    lista.forEach(function(v){
      var val=+(v.valor||0); var st=String(v.status||'').toLowerCase();
      if(st==='pago'){faturado+=val;qtdPago++;}
      else if(st==='aberto'){emAberto+=val;qtdAberto++;}
      else if(st==='entrada'){emEntrada+=val;qtdEntrada++;}
      else if(st==='negociacao'){emNegociacao+=val;qtdNegociacao++;}
      else if(st==='cancelado'){cancelado+=val;qtdCancelado++;}
    });
    var ativos=lista.filter(function(v){return String(v.status||'').toLowerCase()!=='cancelado';});
    var totalAtivo=ativos.reduce(function(s,v){return s+(+(v.valor||0));},0);
    var ticket=ativos.length?totalAtivo/ativos.length:0;

    /* Meta atual — detecta o tier em jogo (Básica/Mínima/Master) */
    var g=(window._npGoals||{})[nome]||{};
    var b=+(g.metaBasica||g.metaValor||0);
    var m=+(g.metaMinima||0);
    var M=+(g.metaMaster||0);
    var tierAtual=(typeof _npGetMetaAtiva==='function')
      ?_npGetMetaAtiva(g,faturado)
      :{meta:b,tier:b>0?'basica':'',label:b>0?'🥉 Básica':'—',pct:b>0?Math.round(faturado/b*100):0};
    var temMeta=!!(b||m||M);
    var batida=tierAtual.meta>0&&faturado>=tierAtual.meta;
    /* Próxima meta a perseguir, se já bateu o tier atual */
    var proxMeta=0,proxLabel='';
    if(batida){
      if(tierAtual.tier==='basica'&&m>0){proxMeta=m;proxLabel='Mínima';}
      else if((tierAtual.tier==='basica'||tierAtual.tier==='minima')&&M>0){proxMeta=M;proxLabel='Master';}
    }

    /* Header */
    document.getElementById('npConsDetalheTitulo').textContent='👤 '+nome+' — '+(typeof _mesLabel==='function'?_mesLabel():'');

    /* KPIs do consultor — clicáveis para filtrar a lista por status */
    var kpiCard=function(label,val,sub,color,stFilter){
      var clickable = stFilter ? ' clickable" onclick="window._npConsKpiFiltrar(\''+stFilter+'\')" data-st="'+stFilter+'"' : '"';
      return '<div class="np-cons-kpi'+clickable+'>'
        +'<div class="np-cons-kpi-label">'+label+'</div>'
        +'<div class="np-cons-kpi-val"'+(color?' style="color:'+color+';"':'')+'>'+val+'</div>'
        +(sub?'<div class="np-cons-kpi-sub">'+sub+'</div>':'')
        +'</div>';
    };
    var metaLabel,metaVal,metaSub,metaCor;
    if(!temMeta){
      metaLabel='Sem meta';
      metaVal='—';
      metaSub='Configure metas pelo botão "⚙ Configurar metas"';
      metaCor='var(--muted)';
    } else if(batida && proxMeta>0){
      /* já bateu o tier atual e ainda há um desafio acima */
      var pctProx=Math.round(faturado/proxMeta*100);
      metaLabel='% '+proxLabel+' (próxima)';
      metaVal=pctProx+'%';
      metaSub='✅ '+tierAtual.label.replace(/^[^A-Za-zÀ-ú]+/,'')+' batida — faltam '+_fmtR(Math.max(0,proxMeta-faturado))+' para a '+proxLabel;
      metaCor=pctProx>=100?'var(--green)':'var(--amber)';
    } else if(batida){
      /* bateu o tier mais alto disponível (ou todos os configurados) */
      metaLabel='% '+tierAtual.label.replace(/^[^A-Za-zÀ-ú]+/,'').trim();
      metaVal=tierAtual.pct+'%';
      metaSub='✅ '+tierAtual.label+' batida — +'+_fmtR(faturado-tierAtual.meta)+' acima';
      metaCor='var(--green)';
    } else {
      /* perseguindo o tier atual (ainda não bateu) */
      metaLabel='% '+tierAtual.label.replace(/^[^A-Za-zÀ-ú]+/,'').trim();
      metaVal=tierAtual.pct+'%';
      metaSub='Faltam '+_fmtR(Math.max(0,tierAtual.meta-faturado))+' para a '+tierAtual.label.replace(/^[^A-Za-zÀ-ú]+/,'').trim();
      metaCor=tierAtual.pct>=75?'var(--accent)':tierAtual.pct>=50?'var(--amber)':'var(--red)';
    }
    document.getElementById('npConsDetalheKpis').innerHTML=
       kpiCard('Faturado',_fmtR(faturado),qtdPago+' pago'+(qtdPago!==1?'s':''),'var(--pago)','pago')
      +kpiCard('Em aberto',_fmtR(emAberto),qtdAberto+' em aberto','var(--amber)','aberto')
      +kpiCard('Entrada',_fmtR(emEntrada),qtdEntrada+' entrada'+(qtdEntrada!==1?'s':''),'var(--accent)','entrada')
      +kpiCard('Em negociação',_fmtR(emNegociacao),qtdNegociacao+' negocia'+(qtdNegociacao!==1?'ções':'ção'),'var(--blue)','negociacao')
      +kpiCard('Ticket médio',_fmtR(ticket),ativos.length+' venda'+(ativos.length!==1?'s':'')+' ativa'+(ativos.length!==1?'s':''),'')
      +kpiCard(metaLabel,metaVal,metaSub,metaCor);

    /* Lista de vendas */
    var body=document.getElementById('npConsDetalheBody');
    if(!lista.length){
      body.innerHTML='<div class="np-kpi-detail-empty">Este consultor não tem vendas neste mês.</div>';
    } else {
      var head='<div class="np-kpi-detail-row head">'
        +'<div>Cliente</div><div>Treinamento/Produto</div><div>Origem</div>'
        +'<div class="v-money">Valor</div><div>Status</div><div>Data</div>'
        +'</div>';
      function _fmtData(d){
        if(!d) return '—';
        var mt=String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
        return mt?(mt[3]+'/'+mt[2]+'/'+mt[1]):d;
      }
      var rows=lista.slice().sort(function(a,b){return (+(b.valor||0))-(+(a.valor||0));}).map(function(v){
        var nomeCliente=v.cliente||v.clienteNome||'—';
        var produto=v.treinamento||v.produto||'—';
        var st=String(v.status||'aberto').toLowerCase();
        var origem=v._src==='turma'?(v._turmaNome||'Turma'):'Avulso';
        return '<div class="np-kpi-detail-row">'
          +'<div title="'+_esc(nomeCliente)+'" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_esc(nomeCliente)+'</div>'
          +'<div title="'+_esc(produto)+'" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);">'+_esc(produto)+'</div>'
          +'<div title="'+_esc(origem)+'" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:var(--muted);">'+_esc(origem)+'</div>'
          +'<div class="v-money">'+_fmtR(v.valor||0)+'</div>'
          +'<div><span class="'+_stClass(st)+'">'+_esc(st.toUpperCase())+'</span></div>'
          +'<div style="font-size:11px;color:var(--muted);">'+_esc(_fmtData(v.data))+'</div>'
          +'</div>';
      }).join('');
      body.innerHTML=head+rows;
    }
    document.getElementById('npModalConsultorDetalhe').classList.add('open');
  };

  window.npFecharConsultorDetalhe=function(){
    var el=document.getElementById('npModalConsultorDetalhe');
    if(el) el.classList.remove('open');
  };

  /* Filtra as linhas da lista do consultor por status (toggle ON/OFF).
     Chamado quando user clica em qualquer KPI clicável no topo do modal. */
  window._npConsKpiFiltrar=function(st){
    var body=document.getElementById('npConsDetalheBody');
    if(!body) return;
    var kpis=document.querySelectorAll('#npConsDetalheKpis .np-cons-kpi[data-st]');
    var jaAtivo=false;
    kpis.forEach(function(k){
      if(k.getAttribute('data-st')===st && k.classList.contains('ativo')) jaAtivo=true;
    });
    kpis.forEach(function(k){ k.classList.remove('ativo'); });
    if(jaAtivo){
      // toggle off: mostrar todas
      body.querySelectorAll('.np-kpi-detail-row:not(.head)').forEach(function(r){ r.style.display=''; });
      return;
    }
    // ativa só o clicado e filtra linhas
    kpis.forEach(function(k){
      if(k.getAttribute('data-st')===st) k.classList.add('ativo');
    });
    body.querySelectorAll('.np-kpi-detail-row:not(.head)').forEach(function(r){
      var stCell=r.querySelector('span[class^="np-st"]');
      var rowSt=stCell?String(stCell.textContent||'').toLowerCase().trim():'';
      // 'em aberto' → 'aberto', 'negociação' → 'negociacao'
      rowSt=rowSt.replace(/ç/g,'c').replace(/ã/g,'a').replace(/\s+/g,'').replace(/^em/,'');
      r.style.display=(rowSt===st)?'':'none';
    });
  };

  window.npSalvarVenda=function(){
    var cliente=(document.getElementById('npVendaCliente').value||'').trim();
    var sessaoS=typeof _getSessao==='function'?_getSessao():null;
    var consultor=sessaoS&&sessaoS.perfil==='consultor'
      ?(sessaoS.nome||sessaoS.login||'')
      :(document.getElementById('npVendaConsultor').value||'');
    /* Parser robusto: aceita "R$ 1.500,00", "1.500,00", "1500,00", "1500", "1500.00" */
    var _vRaw=String(document.getElementById('npVendaValor').value||'').replace(/[^\d,.]/g,'');
    if(_vRaw.indexOf(',')>=0) _vRaw=_vRaw.replace(/\./g,'').replace(',','.');
    else _vRaw=_vRaw.replace(/\./g,'');
    var valor=parseFloat(_vRaw)||0;
    if(!cliente){if(typeof _showToast==='function')_showToast('⚠️ Nome do cliente obrigatório.','var(--amber)');return;}
    if(!consultor){if(typeof _showToast==='function')_showToast('⚠️ Selecione um consultor.','var(--amber)');return;}
    if(!valor){if(typeof _showToast==='function')_showToast('⚠️ Informe o valor.','var(--amber)');return;}
    var obj={
      clienteNome:cliente,
      consultorNome:consultor,
      produto:(document.getElementById('npVendaProduto').value||'').trim(),
      valor:valor,
      status:document.getElementById('npVendaStatus').value||'aberto',
      data:document.getElementById('npVendaData').value||new Date().toISOString().slice(0,10),
      origemManual:(document.getElementById('npVendaOrigem').value||'').trim(),
      obs:(document.getElementById('npVendaObs').value||'').trim(),
      mes:_mesKey(),
      _src:'avulso',
      ts:Date.now()
    };
    var mk=_mesKey();
    var vendaId = _npVendaEditId || ('v'+Date.now());
    var path='pipelineSales/'+mk+'/'+vendaId;
    window._fbSave(path,obj).then(function(){
      if(typeof _showToast==='function')_showToast('✅ Venda salva!','var(--accent)');
      npFecharModalVenda();
      /* Re-fetch se não tem listener */
      if(!_npListenerAvulso||typeof window._fbChange!=='function'){
        window._fbGet('pipelineSales/'+mk).then(function(d){
          _npVendasAvulso=d||{};_npRenderTudo();
        }).catch(function(){});
      }
      /* Sync automático pro Funil de Vendas (lead com status mapeado) */
      if(typeof window._fvAdicionarLeadDePipeline === 'function'){
        try { window._fvAdicionarLeadDePipeline(obj, vendaId); }
        catch(e){ console.warn('[NP] sync funil falhou', e); }
      }
    }).catch(function(e){
      if(typeof _showToast==='function')_showToast('❌ Erro ao salvar.','var(--red)');
      console.error('[NP] Erro salvar venda:',e);
    });
  };

  window.npExcluirVenda=function(id){
    if(!confirm('Excluir esta venda?')) return;
    var mk=_mesKey();
    window._fbSave('pipelineSales/'+mk+'/'+id,null).then(function(){
      if(typeof _showToast==='function')_showToast('🗑 Venda excluída.','var(--red)');
      if(!_npListenerAvulso||typeof window._fbChange!=='function'){
        window._fbGet('pipelineSales/'+mk).then(function(d){
          _npVendasAvulso=d||{};_npRenderTudo();
        }).catch(function(){});
      }
    }).catch(function(){});
  };

  /* ── Modal Metas ─────────────────────────────────── */
  window.npAbrirModalMeta=function(focoConsultor){
    _npColetarConsultores();
    var el=document.getElementById('npModalMetaMes');
    if(el) el.textContent=_mesLabel();
    var body=document.getElementById('npModalMetaBody');
    if(!body) return;
    body.innerHTML=_npConsultores.map(function(nome,i){
      var g=_npGoals[nome]||{};
      var highlight=focoConsultor&&focoConsultor===nome;
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);'+(highlight?'background:rgba(200,240,90,.04);border-radius:6px;padding:10px;margin:-2px -2px;':'')+'">'
        +'<div style="width:32px;height:32px;border-radius:50%;background:'+COR[i%COR.length]+'22;color:'+COR[i%COR.length]+';border:1.5px solid '+COR[i%COR.length]+'55;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;">'+nome.charAt(0).toUpperCase()+'</div>'
        +'<div style="flex:1;font-size:12px;font-weight:600;color:var(--text);">'+_esc(nome)+'</div>'
        +'<input type="text" class="np-form-input" data-cons="'+_esc(nome)+'" data-tipo="metaValor" placeholder="R$ Meta" style="width:110px;" value="'+(g.metaValor?_fmtR(g.metaValor):'')+'" oninput="this.value=npMoneyMask(this.value)">'
        +'<input type="number" class="np-form-input" data-cons="'+_esc(nome)+'" data-tipo="metaQtd" placeholder="Qtd" style="width:70px;text-align:center;" value="'+(g.metaQtd||'')+'">'
        +'</div>';
    }).join('')||'<div class="np-empty">Nenhum consultor encontrado. Crie turmas ou usuários primeiro.</div>';
    document.getElementById('npModalMeta').classList.add('open');
    if(focoConsultor){
      /* Scroll até o consultor focado */
      setTimeout(function(){
        var inp=body.querySelector('[data-cons="'+focoConsultor+'"]');
        if(inp){inp.scrollIntoView({behavior:'smooth',block:'center'});inp.focus();}
      },100);
    }
  };

  window.npFecharModalMeta=function(){
    document.getElementById('npModalMeta').classList.remove('open');
  };

  window.npSalvarMetas=function(){
    var body=document.getElementById('npModalMetaBody');
    if(!body) return;
    var mk=_mesKey();
    var updates={};
    function _parseM(v){
      var s=String(v==null?'':v).replace(/[^\d,.]/g,'');
      if(!s) return 0;
      if(s.indexOf(',')>=0) s=s.replace(/\./g,'').replace(',','.'); else s=s.replace(/\./g,'');
      var n=parseFloat(s); return isFinite(n)?n:0;
    }
    body.querySelectorAll('[data-tipo="metaValor"]').forEach(function(inp){
      var nome=inp.dataset.cons;
      if(!updates[nome]) updates[nome]={};
      updates[nome].metaValor=_parseM(inp.value);
    });
    body.querySelectorAll('[data-tipo="metaQtd"]').forEach(function(inp){
      var nome=inp.dataset.cons;
      var val=parseInt(String(inp.value||'').replace(/\D/g,''),10)||0;
      if(!updates[nome]) updates[nome]={};
      updates[nome].metaQtd=val;
    });
    var promises=Object.entries(updates).map(function(e){
      return window._fbSave('pipelineGoals/'+mk+'/'+e[0],e[1]);
    });
    Promise.all(promises).then(function(){
      if(typeof _showToast==='function')_showToast('✅ Metas salvas!','var(--accent)');
      npFecharModalMeta();
      window._fbGet('pipelineGoals/'+mk).then(function(d){
        _npGoals=d||{};_npRenderTudo();
      }).catch(function(){});
    }).catch(function(){
      if(typeof _showToast==='function')_showToast('❌ Erro ao salvar metas.','var(--red)');
    });
  };

  window.npMoneyMask=function(v){
    return _npMoneyMask(v);
  };

  /* ── Modal META SEMANAL (batch · padrão "Configurar metas" mensal) ──── */
  var _npSemModalSel = 1;   /* semana selecionada no modal (1..N) */
  var _npSemModalPre = '';  /* consultor pré-marcado ao abrir */
  window.npAbrirModalSemanal = function(nome){
    _npSemModalPre = nome || '';
    var semanas = _semanasDoMes(_npAno, _npMes);
    if(!semanas.length) return;
    var semAtual = _semanaAtual();
    _npSemModalSel = semAtual || semanas[0].num;

    /* Fonte de consultores: usuarios cadastrados em GU (mesma do _npRenderMetasV2).
       Pausado (ativo===false) fica de fora de qualquer lista. */
    var _usuariosGU = (window._npUsuarios && typeof window._npUsuarios==='object') ? window._npUsuarios : {};
    var consList = [];
    Object.values(_usuariosGU).forEach(function(u){
      if(u && u.perfil==='consultor' && u.nome && u.ativo!==false) consList.push(u.nome);
    });
    if(!consList.length) consList = (_npConsultores||[]).slice();
    consList.sort(function(a,b){ return String(a).localeCompare(String(b),'pt-BR'); });

    /* Inject CSS one-shot */
    if(!document.getElementById('npSemModalCss')){
      var st = document.createElement('style'); st.id = 'npSemModalCss';
      st.textContent = ''
        + '.np-sem-ov{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(4px);}'
        + '.np-sem-modal{background:var(--surface);border:1px solid var(--border2);border-radius:14px;width:100%;max-width:min(1200px,96vw);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 30px 60px -15px rgba(0,0,0,.7);}'
        + '.np-sem-h{display:flex;justify-content:space-between;align-items:flex-start;padding:14px 16px;border-bottom:1px solid var(--border2);}'
        + '.np-sem-tit{font-size:15px;font-weight:700;color:var(--text);}'
        + '.np-sem-sub{font-size:11px;color:var(--muted);margin-top:2px;}'
        + '.np-sem-x{background:transparent;border:1px solid var(--border2);color:var(--muted);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;}'
        + '.np-sem-x:hover{color:var(--accent);border-color:var(--accent);}'
        + '.np-sem-b{padding:14px 16px;overflow-y:auto;overflow-x:hidden;flex:1;display:flex;flex-direction:column;gap:14px;min-width:0;}'
        /* Stepper */
        + '.np-sem-stepper-wrap{display:flex;gap:8px;align-items:stretch;}'
        + '.np-sem-stepper{flex:1;display:flex;gap:5px;flex-wrap:wrap;}'
        + '.np-sem-cfg-btn{padding:0 12px;background:rgba(212,165,116,.08);border:1px solid rgba(212,165,116,.30);border-radius:7px;color:var(--accent);font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;}'
        + '.np-sem-cfg-btn:hover{background:rgba(212,165,116,.18);border-color:var(--accent);}'
        + '.np-sem-cfg-btn.on{background:var(--accent);color:#0a0e1a;border-color:var(--accent);}'
        + '.np-sem-step{flex:1;min-width:90px;padding:8px 6px;border:1px solid var(--border2);border-radius:7px;cursor:pointer;background:rgba(255,255,255,.02);text-align:center;font-size:10px;font-weight:600;color:var(--muted);font-family:inherit;transition:all .12s;line-height:1.3;}'
        + '.np-sem-step:hover{border-color:var(--accent);color:var(--accent);}'
        + '.np-sem-step.curr{background:linear-gradient(135deg,#d4a574,#b88a5a);color:#0a0e1a;border-color:#d4a574;box-shadow:0 3px 10px rgba(212,165,116,.30);}'
        + '.np-sem-step.atual::after{content:" · ATUAL";font-size:8px;display:block;opacity:.8;}'
        + '.np-sem-step small{display:block;font-size:9px;font-weight:500;opacity:.75;margin-top:2px;}'
        /* Config panel (janelas manuais) */
        + '.np-sem-cfg-panel{background:rgba(212,165,116,.04);border:1px dashed rgba(212,165,116,.25);border-radius:10px;padding:14px;}'
        + '.np-sem-cfg-tit{font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;}'
        + '.np-sem-cfg-sub{font-size:10px;color:var(--muted);margin-bottom:12px;}'
        + '.np-sem-cfg-toggle{display:inline-flex;background:rgba(0,0,0,.3);border-radius:6px;padding:2px;gap:2px;margin-bottom:14px;}'
        + '.np-sem-cfg-toggle button{padding:6px 14px;border:none;background:transparent;color:var(--muted);font-size:10px;font-weight:700;cursor:pointer;border-radius:4px;font-family:inherit;}'
        + '.np-sem-cfg-toggle button.on{background:var(--accent);color:#0a0e1a;}'
        + '.np-sem-cfg-dual{display:grid;grid-template-columns:220px 1fr;gap:16px;}'
        + '@media(max-width:680px){.np-sem-cfg-dual{grid-template-columns:1fr;}}'
        /* Calendário */
        + '.np-sem-cfg-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}'
        + '.np-sem-cfg-wd{font-size:9px;color:var(--muted);text-align:center;padding:3px 0;font-weight:700;text-transform:uppercase;}'
        + '.np-sem-cfg-d{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border-radius:5px;background:rgba(255,255,255,.03);border:1px solid var(--border2);}'
        + '.np-sem-cfg-d.off{opacity:.25;}'
        + '.np-sem-cfg-d.weekend{color:var(--muted);}'
        + '.np-sem-cfg-d.s1{background:rgba(212,165,116,.25);border-color:rgba(212,165,116,.50);color:#d4a574;}'
        + '.np-sem-cfg-d.s2{background:rgba(168,85,247,.25);border-color:rgba(168,85,247,.50);color:#c4b5fd;}'
        + '.np-sem-cfg-d.s3{background:rgba(59,130,246,.25);border-color:rgba(59,130,246,.50);color:#93c5fd;}'
        + '.np-sem-cfg-d.s4{background:rgba(52,211,153,.25);border-color:rgba(52,211,153,.50);color:#86efac;}'
        + '.np-sem-cfg-d.s5{background:rgba(245,158,11,.25);border-color:rgba(245,158,11,.50);color:#fbbf24;}'
        + '.np-sem-cfg-d.s6{background:rgba(239,68,68,.25);border-color:rgba(239,68,68,.50);color:#fca5a5;}'
        /* Lista */
        + '.np-sem-cfg-list{display:flex;flex-direction:column;gap:6px;}'
        + '.np-sem-cfg-row{display:grid;grid-template-columns:42px 1fr 16px 1fr 90px 90px 30px;gap:8px;align-items:center;padding:8px 10px;border:1px solid var(--border2);border-radius:7px;background:rgba(255,255,255,.02);}'
        + '.np-sem-cfg-row.s1{border-left:3px solid #d4a574;} .np-sem-cfg-row.s2{border-left:3px solid #a855f7;}'
        + '.np-sem-cfg-row.s3{border-left:3px solid #3b82f6;} .np-sem-cfg-row.s4{border-left:3px solid #34d399;}'
        + '.np-sem-cfg-row.s5{border-left:3px solid #f59e0b;} .np-sem-cfg-row.s6{border-left:3px solid #ef4444;}'
        + '.np-sem-cfg-row .lbl{font-size:11px;font-weight:700;color:var(--accent);}'
        + '.np-sem-cfg-row .seta{color:var(--muted);text-align:center;font-size:13px;}'
        + '.np-sem-cfg-row input[type=date]{width:100%;background:rgba(0,0,0,.3);border:1px solid var(--border2);color:var(--text);padding:5px 7px;border-radius:5px;font-size:11px;font-family:inherit;}'
        + '.np-sem-cfg-row input:focus{outline:none;border-color:var(--accent);}'
        + '.np-sem-cfg-dias{font-size:11px;font-weight:700;color:var(--accent);text-align:center;background:rgba(212,165,116,.08);padding:5px 7px;border-radius:5px;font-variant-numeric:tabular-nums;}'
        + '.np-sem-cfg-dias small{display:block;font-size:8px;color:var(--muted);font-weight:600;}'
        + '.np-sem-cfg-dias-grp{display:flex;align-items:center;gap:5px;}'
        + '.np-sem-cfg-dias-grp input[type=number]{width:42px;text-align:right;background:rgba(0,0,0,.3);border:1px solid var(--border2);color:var(--accent);padding:5px 6px;border-radius:4px;font-size:11px;font-family:inherit;font-weight:700;font-variant-numeric:tabular-nums;}'
        + '.np-sem-cfg-dias-grp input:focus{outline:none;border-color:var(--accent);}'
        + '.np-sem-cfg-dias-grp .lbl-d{font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em;}'
        + '.np-sem-cfg-dias-grp .lbl-d.uteis{color:#86efac;}'
        + '.np-sem-cfg-tipo{font-size:9px;padding:5px 8px;border-radius:12px;font-weight:700;background:rgba(212,165,116,.12);color:var(--accent);border:1px solid rgba(212,165,116,.30);cursor:pointer;user-select:none;text-align:center;font-family:inherit;line-height:1;white-space:nowrap;}'
        + '.np-sem-cfg-tipo:hover{filter:brightness(1.15);}'
        + '.np-sem-cfg-tipo.uteis{background:rgba(52,211,153,.12);color:#86efac;border-color:rgba(52,211,153,.30);}'
        + '.np-sem-cfg-row .rm{background:transparent;border:1px solid var(--border2);color:var(--muted);width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit;line-height:1;}'
        + '.np-sem-cfg-row .rm:hover{color:#fca5a5;border-color:rgba(239,68,68,.30);background:rgba(239,68,68,.06);}'
        + '.np-sem-cfg-list-h{display:grid;grid-template-columns:42px 1fr 16px 1fr 90px 90px 30px;gap:8px;padding:0 10px 5px;font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;}'
        + '.np-sem-cfg-list-h > div{text-align:center;}'
        + '.np-sem-cfg-list-h > div:nth-child(2),.np-sem-cfg-list-h > div:nth-child(4){text-align:left;padding-left:6px;}'
        + '.np-sem-cfg-sumario{display:flex;gap:14px;font-size:10px;color:var(--muted);padding:8px 10px;background:rgba(0,0,0,.2);border-radius:6px;margin-top:10px;}'
        + '.np-sem-cfg-sumario b{color:var(--accent);font-weight:700;}'
        + '.np-sem-cfg-acts{display:flex;justify-content:space-between;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border2);}'
        + '.np-sem-cfg-acts .left{display:flex;gap:6px;}'
        + '.np-sem-cfg-acts button{font-size:10px;padding:6px 12px;border-radius:5px;cursor:pointer;font-family:inherit;border:1px solid var(--border2);background:transparent;color:var(--text);font-weight:600;}'
        + '.np-sem-cfg-acts button:hover{border-color:var(--accent);color:var(--accent);}'
        + '.np-sem-cfg-acts .add{color:var(--accent);border-color:rgba(212,165,116,.40);background:rgba(212,165,116,.06);}'
        + '.np-sem-cfg-acts .primary{background:var(--accent);color:#0a0e1a;border-color:var(--accent);}'
        + '.np-sem-cfg-acts .primary:hover{background:#f0c896;}'
        /* Batch panel */
        + '.np-sem-batch{background:rgba(212,165,116,.05);border:1px solid rgba(212,165,116,.18);border-radius:10px;padding:12px;}'
        + '.np-sem-batch-h{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--muted);margin-bottom:10px;}'
        + '.np-sem-batch-h label{display:flex;align-items:center;gap:7px;cursor:pointer;font-weight:600;color:var(--text);}'
        + '.np-sem-batch-h label input{width:14px;height:14px;accent-color:var(--accent);cursor:pointer;}'
        + '.np-sem-batch-h .cnt{color:var(--accent);font-weight:700;}'
        + '.np-sem-batch-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;}'
        + '.np-sem-batch-row .fld{display:flex;flex-direction:column;gap:4px;}'
        + '.np-sem-batch-row .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;display:flex;gap:4px;align-items:center;}'
        + '.np-sem-batch-row .lbl.min{color:#ffe000;} .np-sem-batch-row .lbl.bas{color:#ff5252;} .np-sem-batch-row .lbl.mas{color:#c8f05a;}'
        + '.np-sem-batch-row input{background:rgba(0,0,0,.3);border:1px solid var(--border2);color:var(--text);padding:6px 9px;border-radius:5px;font-size:11px;font-family:inherit;text-align:left;}'
        + '.np-sem-batch-row input:focus{outline:none;border-color:var(--accent);}'
        + '.np-sem-batch-acts{display:flex;gap:6px;}'
        + '.np-sem-batch-btn{font-size:10px;padding:7px 12px;border-radius:5px;cursor:pointer;font-family:inherit;border:1px solid var(--border2);background:transparent;color:var(--text);font-weight:600;}'
        + '.np-sem-batch-btn:hover{border-color:var(--accent);color:var(--accent);}'
        + '.np-sem-batch-btn.primary{background:var(--accent);color:#0a0e1a;border-color:var(--accent);}'
        + '.np-sem-batch-btn.primary:hover{background:#f0c896;}'
        + '.np-sem-batch-btn.primary:disabled{opacity:.5;cursor:not-allowed;}'
        /* Lista de consultores */
        + '.np-sem-list{display:flex;flex-direction:column;gap:5px;}'
        + '.np-sem-cons-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--border2);border-radius:7px;background:rgba(255,255,255,.02);font-size:11px;}'
        + '.np-sem-cons-row:hover{background:rgba(212,165,116,.04);border-color:rgba(212,165,116,.20);}'
        + '.np-sem-cons-row.has{border-color:rgba(255,224,0,.30);}'
        + '.np-sem-cons-row.pre{background:rgba(212,165,116,.10);border-color:rgba(212,165,116,.35);}'
        + '.np-sem-cons-num{width:18px;text-align:center;font-size:10px;color:var(--muted);font-weight:700;}'
        + '.np-sem-cons-row input[type=checkbox]{width:14px;height:14px;accent-color:var(--accent);cursor:pointer;flex-shrink:0;}'
        + '.np-sem-cons-av{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;}'
        + '.np-sem-cons-nome{flex:1;font-weight:600;color:var(--text);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
        + '.np-sem-cons-tag{font-size:9px;padding:2px 7px;border-radius:4px;background:rgba(255,224,0,.15);color:#ffe000;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;}'
        + '.np-sem-cons-vals{font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums;text-align:right;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
        + '.np-sem-cons-vals b{color:var(--accent);}'
        /* ── Opção 5 · Split sidebar + lista ────────────── */
        + '.np-sem-grid{display:grid;grid-template-columns:260px 1fr;gap:14px;align-items:start;margin-top:14px;}'
        + '.np-sem-grid .np-sem-batch{position:sticky;top:0;display:flex;flex-direction:column;gap:12px;}'
        + '.np-sem-grid .np-sem-batch-h{display:flex;flex-direction:column;align-items:stretch;gap:6px;margin-bottom:0;padding-bottom:10px;border-bottom:1px dashed var(--border2);}'
        + '.np-sem-grid .np-sem-batch-h .np-sem-sel-btn{justify-content:flex-start;text-align:left;width:100%;}'
        + '.np-sem-grid .np-sem-batch-h .cnt{font-size:11px;color:var(--muted);margin-top:4px;}'
        + '.np-sem-grid .np-sem-batch-row{grid-template-columns:1fr;margin-bottom:0;padding-bottom:10px;border-bottom:1px dashed var(--border2);}'
        + '.np-sem-grid .np-sem-batch-acts{flex-direction:column;}'
        + '.np-sem-grid .np-sem-batch-btn{width:100%;text-align:center;}'
        + '.np-sem-grid .np-sem-list{display:flex;flex-direction:column;gap:5px;min-width:0;}'
        + '.np-sem-grid .np-sem-cons-row{display:grid;grid-template-columns:24px 18px 28px minmax(0,1fr) auto minmax(0,1fr) auto;gap:8px;align-items:center;}'
        + '@media(max-width:780px){.np-sem-grid{grid-template-columns:1fr;}.np-sem-grid .np-sem-batch{position:static;}}'
        /* Resumo inferior: Σ semanas × meta mensal, nos 3 tiers */
        + '.np-sem-res{padding:10px 16px;border-top:1px solid var(--border2);background:rgba(0,0,0,.25);}'
        + '.np-sem-res-cap{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;gap:10px;}'
        + '.np-sem-res-cap em{font-style:normal;font-weight:600;text-transform:none;letter-spacing:0;font-size:9.5px;opacity:.75;}'
        + '.np-sem-res-hh,.np-sem-res-r{display:grid;grid-template-columns:88px minmax(0,1fr) 14px 122px 122px 172px;gap:9px;align-items:center;}'
        + '.np-sem-res-hh{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#5a5a5a;padding-bottom:5px;border-bottom:1px solid var(--border2);margin-bottom:3px;}'
        + '.np-sem-res-hh > span:nth-child(4),.np-sem-res-hh > span:nth-child(5){text-align:right;}'
        + '.np-sem-res-hh > span:nth-child(6){text-align:center;}'
        + '.np-sem-res-r{padding:5px 0;}'
        + '.np-sem-res-r + .np-sem-res-r{border-top:1px dashed rgba(255,255,255,.06);}'
        + '.np-sem-res-k{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;}'
        + '.np-sem-res-k.min{color:#ffe000;} .np-sem-res-k.bas{color:#ff5252;} .np-sem-res-k.mas{color:#c8f05a;}'
        + '.np-sem-res-chips{display:flex;gap:4px;flex-wrap:wrap;min-width:0;}'
        + '.np-sem-res-chip{font-size:9.5px;font-variant-numeric:tabular-nums;padding:3px 8px;border-radius:5px;background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--muted);white-space:nowrap;}'
        + '.np-sem-res-chip b{color:var(--text);font-weight:700;}'
        + '.np-sem-res-chip.vazia{border-color:rgba(255,95,87,.28);background:rgba(255,95,87,.06);}'
        + '.np-sem-res-chip.vazia b{color:#ff8b85;}'
        + '.np-sem-res-chip.curr{border-color:rgba(212,165,116,.45);background:rgba(212,165,116,.10);}'
        + '.np-sem-res-eq{color:#4a4a4a;font-size:12px;text-align:center;}'
        + '.np-sem-res-v{font-size:11px;font-variant-numeric:tabular-nums;text-align:right;min-width:0;}'
        + '.np-sem-res-v b{font-weight:800;color:var(--text);}'
        + '.np-sem-res-v.goal b{color:var(--accent);}'
        + '.np-sem-res-v small{display:block;font-size:7.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;}'
        + '.np-sem-res-st{font-size:10px;font-weight:800;padding:5px 10px;border-radius:14px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
        + '.np-sem-res-st.ok{background:rgba(52,211,153,.15);color:#86efac;border:1px solid rgba(52,211,153,.35);}'
        + '.np-sem-res-st.lo{background:rgba(255,183,64,.15);color:#fbbf24;border:1px solid rgba(255,183,64,.35);}'
        + '.np-sem-res-st.hi{background:rgba(255,95,87,.15);color:#ff8b85;border:1px solid rgba(255,95,87,.35);}'
        + '.np-sem-res-st.na{background:rgba(255,255,255,.04);color:var(--muted);border:1px solid var(--border2);}'
        + '@media(max-width:900px){.np-sem-res-hh{display:none;}.np-sem-res-r{grid-template-columns:1fr;gap:5px;}.np-sem-res-eq{display:none;}.np-sem-res-v{text-align:left;}}'
        /* Footer */
        + '.np-sem-f{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--border2);gap:10px;}'
        + '.np-sem-f .info{font-size:10px;color:var(--muted);}'
        + '.np-sem-f .actions{display:flex;gap:8px;}'
        + '.np-sem-btn{font-size:11px;padding:7px 14px;border-radius:6px;cursor:pointer;font-family:inherit;border:1px solid var(--border2);background:transparent;color:var(--text);font-weight:600;}'
        + '.np-sem-btn:hover{border-color:var(--accent);color:var(--accent);}'
        /* Atalhos de seleção rápida no header do lote */
        + '.np-sem-sel-btn{background:var(--surface2,#1c2128);border:1px solid var(--border);color:var(--muted);font-size:11px;font-weight:700;padding:6px 12px;border-radius:7px;cursor:pointer;font-family:inherit;transition:all .15s;display:inline-flex;align-items:center;gap:5px;}'
        + '.np-sem-sel-btn:hover{color:var(--text);border-color:var(--border2,rgba(255,255,255,.14));transform:translateY(-1px);}'
        + '.np-sem-sel-sem:hover{color:#ffe000;border-color:rgba(255,238,0,.4);background:rgba(255,238,0,.06);}'
        + '.np-sem-sel-com:hover{color:#c8f05a;border-color:rgba(200,240,90,.4);background:rgba(200,240,90,.06);}'
        + '.np-sem-sel-clear:hover{color:#ff5252;border-color:rgba(255,82,82,.4);background:rgba(255,82,82,.06);}'
        /* Botão Copiar por linha */
        + '.np-sem-cons-copy:hover{background:rgba(200,240,90,.18) !important;border-color:rgba(200,240,90,.5) !important;transform:translateY(-1px);}';
      document.head.appendChild(st);
    }

    /* Stepper */
    var stepperHtml = semanas.map(function(s){
      return '<button class="np-sem-step'+(s.num===_npSemModalSel?' curr':'')+(s.num===semAtual?' atual':'')+'" data-step-n="'+s.num+'">'
        +'S'+String(s.num).padStart(2,'0')
        +'<small>'+s.iniLabel+' a '+s.fimLabel+' · '+s.dias+(s.tipo==='uteis'?'du':'d')+'</small>'
        +'</button>';
    }).join('');

    /* Lista de consultores — mostra valores da semana selecionada se já configurados */
    function _consRowHtml(nome, i){
      var ms = (((_npGoalsSem && _npGoalsSem[nome])||{})[_npSemModalSel]) || {};
      var has = !!(ms.min || ms.bas || ms.mas);
      var corC = COR[i % COR.length];
      var ini = String(nome||'?').charAt(0).toUpperCase();
      var vals = has ? '<b>Mín:</b> '+_fmtR(ms.min||0)+' · <b>Bás:</b> '+_fmtR(ms.bas||0)+' · <b>Mas:</b> '+_fmtR(ms.mas||0) : '<span style="opacity:.5;">—</span>';
      var preMark = (_npSemModalPre && String(_npSemModalPre).toUpperCase().trim() === String(nome).toUpperCase().trim());
      var rowCls = (has?'has':'') + (preMark?' pre':'');
      var nomeEsc = nome.replace(/"/g,'&quot;');
      return '<label class="np-sem-cons-row '+rowCls+'" data-cons="'+nomeEsc+'">'
        + '<span class="np-sem-cons-num">'+(i+1)+'</span>'
        + '<input type="checkbox" data-sem-ck="'+nomeEsc+'" '+(preMark?'checked':'')+'>'
        + '<span class="np-sem-cons-av" style="background:'+corC+'22;color:'+corC+';border:1.5px solid '+corC+'55;">'+ini+'</span>'
        + '<span class="np-sem-cons-nome">'+_esc(nome)+'</span>'
        + (has?'<span class="np-sem-cons-tag">meta definida</span>':'')
        + '<span class="np-sem-cons-vals">'+vals+'</span>'
        + (has?'<button type="button" class="np-sem-cons-copy" data-copy-nome="'+nomeEsc+'" title="Copiar Mín/Bás/Mas desta semana para o painel superior" style="background:rgba(200,240,90,.10);border:1px solid rgba(200,240,90,.30);color:var(--accent);font-size:10px;font-weight:700;padding:5px 10px;border-radius:6px;cursor:pointer;font-family:inherit;flex-shrink:0;margin-left:6px;transition:all .15s;">📋 Copiar</button>':'')
        + '</label>';
    }
    var listaHtml = consList.map(_consRowHtml).join('');

    var html = '<div class="np-sem-ov" id="npSemOv">'
      + '<div class="np-sem-modal">'
      +   '<div class="np-sem-h">'
      +     '<div>'
      +       '<div class="np-sem-tit">📅 Meta semanal · '+_mesLabel()+'</div>'
      +       '<div class="np-sem-sub">Selecione consultores, defina os valores e clique <b>Aplicar aos selecionados</b>. Vazio = mantém atual.</div>'
      +     '</div>'
      +     '<button class="np-sem-x" onclick="npFecharModalSemanal()">✕</button>'
      +   '</div>'
      +   '<div class="np-sem-b">'
      +     '<div class="np-sem-stepper-wrap">'
      +       '<div class="np-sem-stepper" id="npSemStepper">'+stepperHtml+'</div>'
      +       '<button class="np-sem-cfg-btn" id="npSemCfgBtn" title="Configurar janelas das semanas manualmente">⚙ Janelas</button>'
      +     '</div>'
      +     '<div class="np-sem-cfg-panel" id="npSemCfgPanel" style="display:none;"></div>'
      +     '<div class="np-sem-grid">'
      +       '<aside class="np-sem-batch">'
      +         '<div class="np-sem-batch-h">'
      +           '<span style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;">Selecionar</span>'
      +           '<button type="button" class="np-sem-sel-btn" data-sel="all" title="Marcar todos">✓ Todos</button>'
      +           '<button type="button" class="np-sem-sel-btn np-sem-sel-sem" data-sel="sem" title="Marcar só consultores SEM meta nesta semana — útil após copiar valores de quem já tem">○ Sem meta</button>'
      +           '<button type="button" class="np-sem-sel-btn np-sem-sel-com" data-sel="com" title="Marcar só consultores COM meta nesta semana">● Com meta</button>'
      +           '<button type="button" class="np-sem-sel-btn np-sem-sel-clear" data-sel="clear" title="Desmarcar tudo">✕ Limpar</button>'
      +           '<label style="display:none;"><input type="checkbox" id="npSemAllCk"></label>'
      +           '<span class="cnt"><span id="npSemSelN">0</span> de '+consList.length+' selecionados</span>'
      +         '</div>'
      +         '<div class="np-sem-batch-row">'
      +           '<div class="fld"><span class="lbl min">🥈 MÍNIMA</span><input id="npSemBatchMin" placeholder="manter atual" oninput="this.value=npMoneyMask(this.value)"></div>'
      +           '<div class="fld"><span class="lbl bas">🥉 BÁSICA</span><input id="npSemBatchBas" placeholder="manter atual" oninput="this.value=npMoneyMask(this.value)"></div>'
      +           '<div class="fld"><span class="lbl mas">🥇 MASTER</span><input id="npSemBatchMas" placeholder="manter atual" oninput="this.value=npMoneyMask(this.value)"></div>'
      +         '</div>'
      +         '<div class="np-sem-batch-acts">'
      +           '<button class="np-sem-batch-btn primary" id="npSemAplicar" disabled>Aplicar aos selecionados</button>'
      +           '<button class="np-sem-batch-btn" id="npSemCopiarAnt">↺ Copiar semana anterior</button>'
      +           '<button class="np-sem-batch-btn" id="npSemCopiarMensal" title="Divide a meta mensal proporcionalmente aos dias de cada semana">⥥ Da meta mensal</button>'
      +         '</div>'
      +       '</aside>'
      +       '<div class="np-sem-list" id="npSemList">'+listaHtml+'</div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="np-sem-res" id="npSemResumo"></div>'
      +   '<div class="np-sem-f">'
      +     '<div class="info">💡 Mudou no Firebase ao clicar <b>Aplicar</b>. Cada venda conta para semanal E mensal.</div>'
      +     '<div class="actions">'
      +       '<button class="np-sem-btn" onclick="npFecharModalSemanal()">Fechar</button>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '</div>';
    var wrap = document.createElement('div'); wrap.innerHTML = html; document.body.appendChild(wrap.firstChild);
    var ov = document.getElementById('npSemOv');
    ov.addEventListener('click', function(e){ if(e.target === ov) window.npFecharModalSemanal(); });

    /* Handlers */
    function _atualizarContador(){
      var n = ov.querySelectorAll('[data-sem-ck]:checked').length;
      ov.querySelector('#npSemSelN').textContent = n;
      ov.querySelector('#npSemAplicar').disabled = (n === 0);
      ov.querySelector('#npSemAllCk').checked = (n === consList.length && n>0);
    }
    function _rerender(){
      var lst = ov.querySelector('#npSemList');
      lst.innerHTML = consList.map(_consRowHtml).join('');
      _atualizarContador();
      _lblCopiarMensal(); /* % do rateio muda conforme a semana selecionada */
      _atualizarResumo(); /* Σ das semanas × meta mensal */
    }
    /* Click stepper */
    ov.querySelectorAll('[data-step-n]').forEach(function(b){
      b.addEventListener('click', function(){
        _npSemModalSel = +b.dataset.stepN;
        ov.querySelectorAll('[data-step-n]').forEach(function(x){ x.classList.toggle('curr', +x.dataset.stepN === _npSemModalSel); });
        _rerender();
      });
    });
    /* Select all (hidden, mantido pra compat) */
    ov.querySelector('#npSemAllCk').addEventListener('change', function(e){
      ov.querySelectorAll('[data-sem-ck]').forEach(function(c){ c.checked = e.target.checked; });
      _atualizarContador();
    });
    /* 4 atalhos de seleção rápida — usa .has class no row pra detectar meta */
    function _semAplicarSelecao(modo){
      var n=0;
      ov.querySelectorAll('.np-sem-cons-row').forEach(function(row){
        var chk = row.querySelector('[data-sem-ck]');
        if(!chk) return;
        var has = row.classList.contains('has');
        var marca = false;
        if(modo === 'all') marca = true;
        else if(modo === 'clear') marca = false;
        else if(modo === 'sem') marca = !has;
        else if(modo === 'com') marca = has;
        chk.checked = marca;
        if(marca) n++;
      });
      _atualizarContador();
      if(typeof _showToast==='function'){
        var msgs = { all:'✓ '+n+' consultores marcados', clear:'✕ Seleção limpa',
                     sem:'○ '+n+' SEM meta marcados', com:'● '+n+' COM meta marcados' };
        _showToast(msgs[modo]||'', 'var(--accent)');
      }
    }
    ov.querySelectorAll('[data-sel]').forEach(function(b){
      b.addEventListener('click', function(){ _semAplicarSelecao(b.dataset.sel); });
    });
    /* 📋 Copiar — lê valores da semana ativa do consultor clicado e preenche
       o painel superior. Como o button está dentro do <label>, precisa
       parar a propagação pra não togglar o checkbox da linha. */
    ov.addEventListener('click', function(ev){
      var btn = ev.target.closest('.np-sem-cons-copy');
      if(!btn) return;
      ev.stopPropagation();
      ev.preventDefault();
      var nome = btn.getAttribute('data-copy-nome');
      if(!nome) return;
      /* Desfaz a entidade HTML do data-attr (data-copy-nome usa &quot;) */
      nome = nome.replace(/&quot;/g, '"');
      var ms = (((_npGoalsSem||{})[nome])||{})[_npSemModalSel] || {};
      if(!ms.min && !ms.bas && !ms.mas){
        if(typeof _showToast==='function') _showToast('Sem valores pra copiar de '+nome+' na semana '+_npSemModalSel, 'var(--amber)');
        return;
      }
      function _fmtNum(v){ return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
      var iMin = ov.querySelector('#npSemBatchMin');
      var iBas = ov.querySelector('#npSemBatchBas');
      var iMas = ov.querySelector('#npSemBatchMas');
      if(iMin) iMin.value = ms.min ? _fmtNum(ms.min) : '';
      if(iBas) iBas.value = ms.bas ? _fmtNum(ms.bas) : '';
      if(iMas) iMas.value = ms.mas ? _fmtNum(ms.mas) : '';
      if(typeof _showToast==='function') _showToast('📋 Valores de '+nome+' (Sem '+_npSemModalSel+') copiados. Marque os destinos e clique Aplicar.', 'var(--accent)');
    });
    /* Click checkbox individual */
    ov.addEventListener('change', function(e){
      if(e.target.dataset && e.target.dataset.semCk) _atualizarContador();
    });
    _atualizarContador();
    /* Aplicar aos selecionados */
    ov.querySelector('#npSemAplicar').addEventListener('click', function(){
      var sel = Array.prototype.map.call(ov.querySelectorAll('[data-sem-ck]:checked'), function(c){ return c.dataset.semCk; });
      if(!sel.length) return;
      function _parseM(v){
        var s=String(v==null?'':v).replace(/[^\d,.]/g,'');
        if(!s) return null; /* null = manter atual */
        if(s.indexOf(',')>=0) s=s.replace(/\./g,'').replace(',','.'); else s=s.replace(/\./g,'');
        var n=parseFloat(s); return isFinite(n)?n:null;
      }
      var vMin = _parseM(ov.querySelector('#npSemBatchMin').value);
      var vBas = _parseM(ov.querySelector('#npSemBatchBas').value);
      var vMas = _parseM(ov.querySelector('#npSemBatchMas').value);
      if(vMin===null && vBas===null && vMas===null){
        if(typeof _showToast==='function') _showToast('Preencha ao menos um tier (Mínima/Básica/Master)','var(--amber)');
        return;
      }
      var mk = _mesKey();
      var promises = sel.map(function(nome){
        var atual = (((_npGoalsSem||{})[nome])||{})[_npSemModalSel] || {};
        var novo = {
          min: vMin !== null ? vMin : +(atual.min||0),
          bas: vBas !== null ? vBas : +(atual.bas||0),
          mas: vMas !== null ? vMas : +(atual.mas||0)
        };
        return window._fbSave('pipelineGoalsSem/'+mk+'/'+nome+'/'+_npSemModalSel, novo);
      });
      Promise.all(promises).then(function(){
        if(typeof _showToast==='function') _showToast('✅ Metas aplicadas a '+sel.length+' consultor(es) na Semana '+_npSemModalSel,'var(--accent)');
        /* Atualiza cache local */
        sel.forEach(function(nome){
          if(!_npGoalsSem[nome]) _npGoalsSem[nome] = {};
          _npGoalsSem[nome][_npSemModalSel] = {
            min: vMin !== null ? vMin : +((_npGoalsSem[nome][_npSemModalSel]||{}).min||0),
            bas: vBas !== null ? vBas : +((_npGoalsSem[nome][_npSemModalSel]||{}).bas||0),
            mas: vMas !== null ? vMas : +((_npGoalsSem[nome][_npSemModalSel]||{}).mas||0)
          };
        });
        ov.querySelector('#npSemBatchMin').value='';
        ov.querySelector('#npSemBatchBas').value='';
        ov.querySelector('#npSemBatchMas').value='';
        _rerender();
        _npRenderTudo();
      }).catch(function(){
        if(typeof _showToast==='function') _showToast('❌ Erro ao salvar.','var(--red)');
      });
    });
    /* Copiar semana anterior (preenche os 3 inputs com valores da semana anterior — mas só do PRIMEIRO consultor selecionado) */
    ov.querySelector('#npSemCopiarAnt').addEventListener('click', function(){
      var semAnt = _npSemModalSel - 1;
      if(semAnt < 1){
        if(typeof _showToast==='function') _showToast('Não há semana anterior.','var(--amber)');
        return;
      }
      var sel = Array.prototype.map.call(ov.querySelectorAll('[data-sem-ck]:checked'), function(c){ return c.dataset.semCk; });
      var refNome = sel[0] || consList[0];
      var ref = (((_npGoalsSem||{})[refNome])||{})[semAnt] || {};
      if(!ref.min && !ref.bas && !ref.mas){
        if(typeof _showToast==='function') _showToast('Semana '+semAnt+' do '+refNome+' está sem meta — nada pra copiar.','var(--amber)');
        return;
      }
      function _fmt(v){ if(!v) return ''; return _npMoneyMask(String((+v).toFixed(2)).replace('.','')); }
      ov.querySelector('#npSemBatchMin').value = _fmt(ref.min);
      ov.querySelector('#npSemBatchBas').value = _fmt(ref.bas);
      ov.querySelector('#npSemBatchMas').value = _fmt(ref.mas);
      if(typeof _showToast==='function') _showToast('📋 Valores da Semana '+semAnt+' ('+refNome+') copiados — clique Aplicar.','var(--accent)');
    });
    /* Copiar da meta mensal — rateio PROPORCIONAL aos dias da semana selecionada.
       Semana de 6 dias leva mais meta que uma de 4. Cai no ÷N igualitário se as
       janelas não tiverem dias válidos. */
    function _totalDiasSemanas(){
      return semanas.reduce(function(s,x){ return s + (+x.dias || 0); }, 0);
    }
    function _pesoSemana(num){
      var tot = _totalDiasSemanas();
      var s = semanas.filter(function(x){ return x.num === num; })[0];
      if(!tot || !s || !s.dias) return semanas.length ? 1/semanas.length : 0;
      return s.dias / tot;
    }
    function _lblCopiarMensal(){
      var b = ov.querySelector('#npSemCopiarMensal'); if(!b) return;
      var s = semanas.filter(function(x){ return x.num === _npSemModalSel; })[0];
      var tot = _totalDiasSemanas();
      var pct = Math.round(_pesoSemana(_npSemModalSel)*1000)/10;
      b.textContent = '⥥ Da meta mensal ('+pct+'%)';
      b.title = (s && tot)
        ? 'Rateio proporcional aos dias — S'+String(s.num).padStart(2,'0')+' tem '+s.dias+' de '+tot+' dias'+(s.tipo==='uteis'?' (úteis)':'')+' = '+pct+'% da meta mensal'
        : 'Divide a meta mensal proporcionalmente aos dias de cada semana';
    }
    ov.querySelector('#npSemCopiarMensal').addEventListener('click', function(){
      var sel = Array.prototype.map.call(ov.querySelectorAll('[data-sem-ck]:checked'), function(c){ return c.dataset.semCk; });
      var refNome = sel[0] || consList[0];
      var g = _npGoals[refNome] || {};
      var mMin = +(g.metaMinima || g.metaValor || 0);
      var mBas = +(g.metaBasica || mMin);
      var mMas = +(g.metaMaster || mBas);
      if(!mMin && !mBas && !mMas){
        if(typeof _showToast==='function') _showToast('Sem meta mensal pra '+refNome+'.','var(--amber)');
        return;
      }
      var peso = _pesoSemana(_npSemModalSel);
      var semSel = semanas.filter(function(x){ return x.num === _npSemModalSel; })[0];
      function _fmt(v){ if(!v) return ''; return _npMoneyMask(String((+v).toFixed(2)).replace('.','')); }
      ov.querySelector('#npSemBatchMin').value = _fmt(mMin*peso);
      ov.querySelector('#npSemBatchBas').value = _fmt(mBas*peso);
      ov.querySelector('#npSemBatchMas').value = _fmt(mMas*peso);
      if(typeof _showToast==='function'){
        var det = semSel && _totalDiasSemanas()
          ? ' ('+semSel.dias+' de '+_totalDiasSemanas()+' dias = '+(Math.round(peso*1000)/10)+'%)'
          : '';
        _showToast('📋 Meta mensal de '+refNome+' rateada pros dias da S'+String(_npSemModalSel).padStart(2,'0')+det+' — clique Aplicar.','var(--accent)');
      }
    });
    /* ── Resumo inferior: Σ das semanas × meta mensal, nos 3 tiers ──
       Soma as metas semanais de TODOS os consultores da lista e confronta com a
       soma das metas mensais deles. Serve pra bater o olho e ver se a conta fecha. */
    var RES_TIERS = [
      { k:'min', ico:'🥈', nm:'Mínima' },
      { k:'bas', ico:'🥉', nm:'Básica' },
      { k:'mas', ico:'🥇', nm:'Master' }
    ];
    /* Mesma cascata de fallback usada no rateio da meta mensal */
    function _metaMensalCons(nome){
      var g = (_npGoals && _npGoals[nome]) || {};
      var mMin = +(g.metaMinima || g.metaValor || 0);
      var mBas = +(g.metaBasica || mMin);
      var mMas = +(g.metaMaster || mBas);
      return { min:mMin, bas:mBas, mas:mMas };
    }
    function _fmtKR(v){
      v = +v || 0;
      if(Math.abs(v) >= 1000) return (v/1000).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'k';
      return v.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0});
    }
    function _atualizarResumo(){
      var box = ov.querySelector('#npSemResumo'); if(!box) return;
      var porSem = semanas.map(function(){ return { min:0, bas:0, mas:0 }; });
      var mensal = { min:0, bas:0, mas:0 };
      consList.forEach(function(nome){
        var mm = _metaMensalCons(nome);
        mensal.min += mm.min; mensal.bas += mm.bas; mensal.mas += mm.mas;
        var gs = (_npGoalsSem && _npGoalsSem[nome]) || {};
        semanas.forEach(function(s, i){
          var v = gs[s.num] || {};
          porSem[i].min += +(v.min||0);
          porSem[i].bas += +(v.bas||0);
          porSem[i].mas += +(v.mas||0);
        });
      });
      var linhas = RES_TIERS.map(function(t){
        var soma = porSem.reduce(function(a,p){ return a + p[t.k]; }, 0);
        var meta = mensal[t.k];
        var d = soma - meta;
        var stCls, stTxt;
        if(!meta){ stCls='na'; stTxt='— sem meta mensal'; }
        else if(Math.abs(d) < 1){ stCls='ok'; stTxt='✅ Fecha certo'; }   /* tolerância de R$ 1 por centavos */
        else if(d < 0){ stCls='lo'; stTxt='⚠ Faltam '+_fmtR(-d); }
        else { stCls='hi'; stTxt='❗ Excede '+_fmtR(d); }
        var chips = semanas.map(function(s, i){
          var v = porSem[i][t.k];
          return '<span class="np-sem-res-chip'+(v?'':' vazia')+(s.num===_npSemModalSel?' curr':'')+'"'
            + ' title="Semana '+s.num+' ('+s.iniLabel+' a '+s.fimLabel+' · '+s.dias+(s.tipo==='uteis'?' dias úteis':' dias')+') — '+t.nm+': '+_fmtR(v)+'">'
            + 'S'+String(s.num).padStart(2,'0')+' <b>'+_fmtKR(v)+'</b></span>';
        }).join('');
        return '<div class="np-sem-res-r">'
          + '<span class="np-sem-res-k '+t.k+'">'+t.ico+' '+t.nm+'</span>'
          + '<div class="np-sem-res-chips">'+chips+'</div>'
          + '<span class="np-sem-res-eq">=</span>'
          + '<div class="np-sem-res-v"><b>'+_fmtR(soma)+'</b><small>Σ semanas</small></div>'
          + '<div class="np-sem-res-v goal"><b>'+_fmtR(meta)+'</b><small>meta mensal</small></div>'
          + '<span class="np-sem-res-st '+stCls+'" title="'+stTxt.replace(/"/g,'')+'">'+stTxt+'</span>'
          + '</div>';
      }).join('');
      box.innerHTML = ''
        + '<div class="np-sem-res-cap">'
        +   '<span>Σ Somatória das semanas × meta mensal</span>'
        +   '<em>'+consList.length+' consultor'+(consList.length!==1?'es':'')+' · '+semanas.length+' semana'+(semanas.length!==1?'s':'')+'</em>'
        + '</div>'
        + '<div class="np-sem-res-hh"><span>Tier</span><span>Por semana</span><span></span><span>Σ Semanas</span><span>Meta mensal</span><span>Situação</span></div>'
        + linhas;
    }
    _lblCopiarMensal();
    _atualizarResumo();

    /* ── Configurar janelas das semanas (modo manual) ── */
    var cfgPanel = ov.querySelector('#npSemCfgPanel');
    var cfgBtn = ov.querySelector('#npSemCfgBtn');
    var mk = _mesKey();
    /* Estado local do painel (não persiste até clicar Salvar) */
    var cfgEditando = Array.isArray(_npSemConfig[mk]) && _npSemConfig[mk].length;
    var cfgLocal = cfgEditando
      ? _npSemConfig[mk].map(function(j){ return { ini:j.ini, fim:j.fim, tipo: j.tipo || 'corridos' }; })
      : semanas.map(function(s){ return { ini:s.ini, fim:s.fim, tipo: 'corridos' }; });

    function _parseYmd(s){
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');
      return m ? new Date(+m[1], +m[2]-1, +m[3]) : null;
    }
    function _diff(iniYmd, fimYmd){
      var a = _parseYmd(iniYmd), b = _parseYmd(fimYmd);
      if(!a || !b || b < a) return 0;
      return Math.round((b - a) / 86400000) + 1;
    }
    function _diffUteis(iniYmd, fimYmd){
      var a = _parseYmd(iniYmd), b = _parseYmd(fimYmd);
      if(!a || !b || b < a) return 0;
      var n = 0;
      var d = new Date(a);
      while(d <= b){
        var w = d.getDay();
        if(w >= 1 && w <= 5) n++;
        d.setDate(d.getDate()+1);
      }
      return n;
    }
    /* Soma N dias (corridos ou úteis) a partir de uma data e retorna data Fim em YMD.
       N inclusivo: somar 1 corrido a partir de hoje = hoje. */
    function _somaDias(iniYmd, n, tipo){
      var a = _parseYmd(iniYmd); if(!a || !n || n < 1) return iniYmd;
      if(tipo === 'uteis'){
        var count = 0;
        var d = new Date(a);
        while(count < n){
          var w = d.getDay();
          if(w >= 1 && w <= 5){
            count++;
            if(count === n) return _ymd(d);
          }
          d.setDate(d.getDate()+1);
        }
        return _ymd(d);
      }
      var fim = new Date(a); fim.setDate(a.getDate() + n - 1);
      return _ymd(fim);
    }
    /* Dias de uma janela respeitando o modo (corridos/úteis) — é o número mostrado na coluna Dias */
    function _diasJanela(j){
      return j.tipo === 'uteis' ? _diffUteis(j.ini, j.fim) : _diff(j.ini, j.fim);
    }
    function _renderCfgPanel(){
      var modo = cfgEditando ? 'manual' : 'auto';
      /* Calendário visual: pinta cada dia do mês com cor da semana correspondente */
      var primeiroDS = new Date(_npAno, _npMes-1, 1).getDay(); // 0=dom
      var ultimoDia = new Date(_npAno, _npMes, 0).getDate();
      var calCells = [];
      for(var p=0; p<primeiroDS; p++) calCells.push({off:true});
      for(var d=1; d<=ultimoDia; d++){
        var ymd = _npAno+'-'+String(_npMes).padStart(2,'0')+'-'+String(d).padStart(2,'0');
        var semIdx = -1;
        cfgLocal.forEach(function(j, i){ if(ymd >= j.ini && ymd <= j.fim) semIdx = i; });
        var dt = new Date(_npAno, _npMes-1, d);
        var wd = dt.getDay();
        calCells.push({ d:d, sem: semIdx>=0 ? semIdx+1 : 0, weekend:(wd===0||wd===6) });
      }
      var calHtml = '<div class="np-sem-cfg-wd">D</div><div class="np-sem-cfg-wd">S</div><div class="np-sem-cfg-wd">T</div><div class="np-sem-cfg-wd">Q</div><div class="np-sem-cfg-wd">Q</div><div class="np-sem-cfg-wd">S</div><div class="np-sem-cfg-wd">S</div>';
      calCells.forEach(function(c){
        if(c.off){ calHtml += '<div class="np-sem-cfg-d off"></div>'; }
        else {
          var cls = 'np-sem-cfg-d' + (c.weekend?' weekend':'') + (c.sem?' s'+Math.min(6,c.sem):'');
          calHtml += '<div class="'+cls+'">'+c.d+'</div>';
        }
      });
      /* Lista de linhas */
      var listaHtml = cfgLocal.map(function(j, i){
        var dias = _diasJanela(j);
        var tipoLbl = j.tipo === 'uteis' ? 'ÚTEIS' : 'DIAS';
        var pillCls = j.tipo === 'uteis' ? ' uteis' : '';
        var pillTxt = j.tipo === 'uteis' ? '💼 Úteis' : '📅 Corridos';
        return '<div class="np-sem-cfg-row s'+Math.min(6,i+1)+'" data-cfg-i="'+i+'">'
          + '<span class="lbl">S'+String(i+1).padStart(2,'0')+'</span>'
          + '<input type="date" data-cfg-k="ini" value="'+(j.ini||'')+'">'
          + '<span class="seta">→</span>'
          + '<input type="date" data-cfg-k="fim" value="'+(j.fim||'')+'">'
          + '<div class="np-sem-cfg-dias-grp">'
          +   '<input type="number" data-cfg-k="dias" value="'+dias+'" min="1" max="31">'
          +   '<span class="lbl-d'+(j.tipo==='uteis'?' uteis':'')+'">'+tipoLbl+'</span>'
          + '</div>'
          + '<button class="np-sem-cfg-tipo'+pillCls+'" data-cfg-tipo="'+i+'" title="Click pra alternar entre dias corridos e úteis">'+pillTxt+'</button>'
          + '<button class="rm" data-cfg-rm="'+i+'" title="Remover esta semana">−</button>'
          + '</div>';
      }).join('');
      /* Sumário */
      var totalDias = cfgLocal.reduce(function(s,j){ return s + _diasJanela(j); }, 0);
      cfgPanel.innerHTML = ''
        + '<div class="np-sem-cfg-tit">⚙ Configurar janelas das semanas · '+_mesLabel()+'</div>'
        + '<div class="np-sem-cfg-sub">Use o modo manual para definir datas customizadas. Sistema usa essa configuração no lugar da automática.</div>'
        + '<div class="np-sem-cfg-toggle">'
        +   '<button data-cfg-modo="auto" class="'+(modo==='auto'?'on':'')+'">🤖 Automático</button>'
        +   '<button data-cfg-modo="manual" class="'+(modo==='manual'?'on':'')+'">✏ Manual</button>'
        + '</div>'
        + (modo==='manual'
          ? '<div class="np-sem-cfg-dual">'
            + '<div><div class="np-sem-cfg-cal">'+calHtml+'</div></div>'
            + '<div>'
            +   '<div class="np-sem-cfg-list-h"><div>Sem.</div><div>Início</div><div></div><div>Fim</div><div>Dias</div><div>Modo</div><div></div></div>'
            +   '<div class="np-sem-cfg-list">'+listaHtml+'</div>'
            +   '<div class="np-sem-cfg-sumario">'
            +     '<span>Total: <b>'+cfgLocal.length+'</b> semanas</span>'
            +     '<span>Dias atribuídos: <b>'+totalDias+'</b></span>'
            +   '</div>'
            +   '<div class="np-sem-cfg-acts">'
            +     '<div class="left"><button class="add" id="npSemCfgAdd">+ Adicionar semana</button></div>'
            +     '<div>'
            +       '<button id="npSemCfgCancel">Cancelar</button>'
            +       '<button class="primary" id="npSemCfgSave">💾 Salvar definição</button>'
            +     '</div>'
            +   '</div>'
            + '</div>'
            + '</div>'
          : '<div style="font-size:11px;color:var(--muted);padding:10px;background:rgba(0,0,0,.2);border-radius:6px;">'
            + '🤖 Modo automático ativo. As janelas seguem a regra: seg-sex + sáb/dom anexos à semana anterior (exceto dias 1-2 do mês).'
            + '</div>')
        ;
      _wireCfgPanel();
    }
    function _wireCfgPanel(){
      cfgPanel.querySelectorAll('[data-cfg-modo]').forEach(function(b){
        b.addEventListener('click', function(){
          var modo = b.dataset.cfgModo;
          if(modo === 'manual' && !cfgEditando){
            cfgEditando = true;
            cfgLocal = semanas.map(function(s){ return { ini:s.ini, fim:s.fim }; });
          } else if(modo === 'auto' && cfgEditando){
            if(!confirm('Voltar pro modo automático apaga a configuração manual salva. Continuar?')) return;
            cfgEditando = false;
            window._fbSave('pipelineSemConfig/'+mk, null).then(function(){
              _npSemConfig[mk] = null;
              cfgLocal = _semanasAutomaticas(_npAno, _npMes).map(function(s){ return { ini:s.ini, fim:s.fim }; });
              if(typeof _showToast==='function') _showToast('✅ Modo automático restaurado.','var(--accent)');
              _renderCfgPanel();
              _npRenderTudo();
            }).catch(function(){
              if(typeof _showToast==='function') _showToast('❌ Erro ao restaurar.','var(--red)');
            });
            return;
          }
          _renderCfgPanel();
        });
      });
      cfgPanel.querySelectorAll('[data-cfg-i]').forEach(function(row){
        var i = +row.dataset.cfgI;
        row.querySelectorAll('input[data-cfg-k]').forEach(function(inp){
          inp.addEventListener('change', function(){
            var k = inp.dataset.cfgK;
            var j = cfgLocal[i];
            if(k === 'ini'){
              j.ini = inp.value;
              /* Mantém o número de dias atual e recalcula Fim */
              var diasAtual = j.tipo === 'uteis' ? _diffUteis(j.ini, j.fim) : _diff(j.ini, j.fim);
              if(diasAtual > 0 && j.ini){
                j.fim = _somaDias(j.ini, diasAtual, j.tipo);
              }
            } else if(k === 'fim'){
              j.fim = inp.value;
              /* Dias passa a ser o novo diff */
            } else if(k === 'dias'){
              var n = parseInt(inp.value, 10) || 1;
              if(n < 1) n = 1;
              if(j.ini){
                j.fim = _somaDias(j.ini, n, j.tipo);
              }
            }
            _renderCfgPanel();
          });
        });
      });
      cfgPanel.querySelectorAll('[data-cfg-tipo]').forEach(function(b){
        b.addEventListener('click', function(){
          var i = +b.dataset.cfgTipo;
          var j = cfgLocal[i];
          /* Alterna entre corridos e úteis; mantém data Início e o NÚMERO de dias */
          var diasAtual = j.tipo === 'uteis' ? _diffUteis(j.ini, j.fim) : _diff(j.ini, j.fim);
          j.tipo = (j.tipo === 'uteis') ? 'corridos' : 'uteis';
          /* Recalcula Fim mantendo o mesmo N de dias mas no novo modo */
          if(j.ini && diasAtual > 0){
            j.fim = _somaDias(j.ini, diasAtual, j.tipo);
          }
          _renderCfgPanel();
        });
      });
      cfgPanel.querySelectorAll('[data-cfg-rm]').forEach(function(b){
        b.addEventListener('click', function(){
          if(cfgLocal.length <= 1){
            if(typeof _showToast==='function') _showToast('Mantenha ao menos 1 semana.','var(--amber)');
            return;
          }
          cfgLocal.splice(+b.dataset.cfgRm, 1);
          _renderCfgPanel();
        });
      });
      var addBtn = cfgPanel.querySelector('#npSemCfgAdd');
      if(addBtn) addBtn.addEventListener('click', function(){
        var last = cfgLocal[cfgLocal.length-1];
        var tipoN = (last && last.tipo) || 'corridos';
        var iniN = '', fimN = '';
        if(last && last.fim){
          var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(last.fim);
          if(m){
            var ini = new Date(+m[1], +m[2]-1, +m[3]+1);
            iniN = _ymd(ini);
            fimN = _somaDias(iniN, 7, tipoN);
          }
        }
        cfgLocal.push({ ini: iniN, fim: fimN, tipo: tipoN });
        _renderCfgPanel();
      });
      var cancelBtn = cfgPanel.querySelector('#npSemCfgCancel');
      if(cancelBtn) cancelBtn.addEventListener('click', function(){
        cfgPanel.style.display = 'none';
        cfgBtn.classList.remove('on');
      });
      var saveBtn = cfgPanel.querySelector('#npSemCfgSave');
      if(saveBtn) saveBtn.addEventListener('click', function(){
        /* Validação básica: cada linha tem ini e fim, e fim >= ini */
        for(var i=0;i<cfgLocal.length;i++){
          if(!cfgLocal[i].ini || !cfgLocal[i].fim){
            if(typeof _showToast==='function') _showToast('Preencha ini e fim da Semana '+(i+1)+'.','var(--amber)');
            return;
          }
          if(cfgLocal[i].fim < cfgLocal[i].ini){
            if(typeof _showToast==='function') _showToast('Fim < Início na Semana '+(i+1)+'.','var(--amber)');
            return;
          }
        }
        var payload = cfgLocal.map(function(j){ return { ini:j.ini, fim:j.fim, tipo:(j.tipo||'corridos') }; });
        window._fbSave('pipelineSemConfig/'+mk, payload).then(function(){
          _npSemConfig[mk] = payload;
          if(typeof _showToast==='function') _showToast('✅ Janelas das semanas salvas.','var(--accent)');
          cfgPanel.style.display = 'none';
          cfgBtn.classList.remove('on');
          window.npFecharModalSemanal();
          window.npAbrirModalSemanal(_npSemModalPre); /* re-abre com nova config */
          _npRenderTudo();
        }).catch(function(){
          if(typeof _showToast==='function') _showToast('❌ Erro ao salvar.','var(--red)');
        });
      });
    }
    cfgBtn.addEventListener('click', function(){
      var aberto = cfgPanel.style.display !== 'none';
      if(aberto){
        cfgPanel.style.display = 'none';
        cfgBtn.classList.remove('on');
      } else {
        _renderCfgPanel();
        cfgPanel.style.display = 'block';
        cfgBtn.classList.add('on');
      }
    });
  };
  window.npFecharModalSemanal = function(){
    var ov = document.getElementById('npSemOv');
    if(ov) ov.remove();
  };

  /* ── Tabs ────────────────────────────────────────── */
  window.npShowTab=function(tab){
    _npTabAtiva=tab;
    document.querySelectorAll('.np-tab').forEach(function(b){
      b.classList.toggle('ativo',b.dataset.tab===tab);
    });
    document.querySelectorAll('.np-body').forEach(function(b){
      b.classList.toggle('ativo',b.id==='npTab'+tab.charAt(0).toUpperCase()+tab.slice(1));
    });
    var todas=_npTodasVendas();
    if(tab==='dashboard') _npRenderDashboard(todas);
    else if(tab==='vendas') npRenderVendas();
    else if(tab==='metas') _npRenderMetas(todas);
    else if(tab==='ranking') npRenderRanking();
    else if(tab==='funil'&&typeof _fnlRender==='function') _fnlRender();
    else if(tab==='leads'){ if(typeof window._ldInit==='function') window._ldInit(_mesKey()); setTimeout(function(){ if(typeof window._initDrop==='function') window._initDrop(); },200); }
  };

  /* ── Mês anterior / próximo ──────────────────────── */
  window.npMesAnterior=function(){
    _npMes--; if(_npMes<1){_npMes=12;_npAno--;}
    _npTrocarMes();
  };
  window.npMesProximo=function(){
    _npMes++; if(_npMes>12){_npMes=1;_npAno++;}
    _npTrocarMes();
  };

  /* ── Atalhos / popover personalizado (Ano · Mês · Dia) ──────────
     UI extra para escolher o período. Por enquanto a filtragem dos
     dados segue mês-based (Firebase pipelineVendas/{YYYY-MM}/...).
     Modo "Ano" cai para Jan/{ano} e modo "Dia" usa o mês do dia
     escolhido — o dia exato fica registrado em window._npDiaSel
     para usos futuros (filtragem ao vivo no front, etc). */
  var _npCalMode = 'mes';      /* 'ano' | 'mes' | 'dia' | 'periodo' */
  var _npDiaSel  = null;       /* {y,m,d} quando modo='dia' */
  var _npPerSel  = null;       /* {start:{y,m,d}, end:{y,m,d}} quando modo='periodo' */
  var _npCalY    = _npAno;
  var _npCalM    = _npMes;
  /* Estado dos 2 mini-cals do período */
  var _npPerIniY = _npAno, _npPerIniM = _npMes;
  var _npPerFimY = _npAno, _npPerFimM = _npMes;
  var _MESES_BR_   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var _MESES_FULL_ = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var _DOW_        = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  function _npHoje(){
    var d = new Date();
    return { y: d.getFullYear(), m: d.getMonth()+1, d: d.getDate() };
  }
  function _npDiffMeses(y,m){
    var H = _npHoje();
    return (y - H.y) * 12 + (m - H.m);
  }
  function _npDiasNoMes(y,m){ return new Date(y, m, 0).getDate(); }

  function _npAtualizarBadgeState(){
    var bg = document.getElementById('npStateBadge');
    if(!bg) return;
    bg.classList.remove('corrente','fechado','futuro');
    var H = _npHoje();
    if(_npCalMode === 'dia' && _npDiaSel){
      var sToday = new Date(H.y, H.m-1, H.d).getTime();
      var sSel   = new Date(_npDiaSel.y, _npDiaSel.m-1, _npDiaSel.d).getTime();
      if(sSel === sToday){ bg.textContent='HOJE'; bg.classList.add('corrente'); }
      else if(sSel < sToday){ bg.textContent='DIA PASSADO'; bg.classList.add('fechado'); }
      else { bg.textContent='FUTURO'; bg.classList.add('futuro'); }
      return;
    }
    if(_npCalMode === 'ano'){
      if(_npAno === H.y){ bg.textContent='ANO CORRENTE'; bg.classList.add('corrente'); }
      else if(_npAno < H.y){ bg.textContent='ANO FECHADO'; bg.classList.add('fechado'); }
      else { bg.textContent='FUTURO'; bg.classList.add('futuro'); }
      return;
    }
    if(_npCalMode === 'periodo' && _npPerSel && _npPerSel.start && _npPerSel.end){
      var dias = Math.round((_npTsDmy(_npPerSel.end) - _npTsDmy(_npPerSel.start)) / 86400000) + 1;
      bg.textContent='PERÍODO · '+dias+' dia'+(dias!==1?'s':'');
      bg.classList.add('corrente');
      return;
    }
    var df = _npDiffMeses(_npAno, _npMes);
    if(df === 0){ bg.textContent='MÊS CORRENTE'; bg.classList.add('corrente'); }
    else if(df < 0){ bg.textContent='FECHADO'; bg.classList.add('fechado'); }
    else { bg.textContent='FUTURO'; bg.classList.add('futuro'); }
  }

  function _npAtualizarAtalhos(){
    var H = _npHoje();
    var df = _npDiffMeses(_npAno, _npMes);
    function _meseN(n){
      var m = H.m + n, y = H.y;
      while(m < 1){ m += 12; y--; }
      while(m > 12){ m -= 12; y++; }
      return _MESES_FULL_[m-1] + ' / ' + y;
    }
    var btns = document.querySelectorAll('#npAtalhos .np-atalho');
    btns.forEach(function(b){
      b.classList.remove('active');
      var sc = b.getAttribute('data-shortcut');
      /* Tooltip dinâmico mostrando o mês concreto que cada atalho vai abrir */
      if(sc === 'hoje')      b.title = 'Ir para ' + _meseN(0);
      else if(sc === '-1')   b.title = 'Ir para ' + _meseN(-1);
      else if(sc === '-3')   b.title = 'Ir para ' + _meseN(-3);
      else if(sc === '-6')   b.title = 'Ir para ' + _meseN(-6);
      else if(sc === 'jan')  b.title = 'Ir para Janeiro / ' + H.y;
      if(_npCalMode !== 'mes') return;
      if(sc === 'hoje' && df === 0) b.classList.add('active');
      else if(sc === '-1' && df === -1) b.classList.add('active');
      else if(sc === '-3' && df === -3) b.classList.add('active');
      else if(sc === '-6' && df === -6) b.classList.add('active');
      else if(sc === 'jan' && _npAno === H.y && _npMes === 1) b.classList.add('active');
    });
  }

  /* Substitui o label do mês conforme o modo escolhido */
  function _npAtualizarLabelMes(){
    var lbl = document.getElementById('npMesLabel');
    var pill = document.getElementById('npBadgeMes');
    if(_npCalMode === 'ano'){
      if(lbl) lbl.textContent = 'Ano ' + _npAno;
      if(pill) pill.textContent = String(_npAno);
    } else if(_npCalMode === 'dia' && _npDiaSel){
      if(lbl) lbl.textContent = String(_npDiaSel.d).padStart(2,'0') + ' ' + _MESES_FULL_[_npDiaSel.m-1] + ' / ' + _npDiaSel.y;
      if(pill) pill.textContent = _npDiaSel.y + '-' + String(_npDiaSel.m).padStart(2,'0') + '-' + String(_npDiaSel.d).padStart(2,'0');
    } else if(_npCalMode === 'periodo' && _npPerSel && _npPerSel.start && _npPerSel.end){
      if(lbl) lbl.textContent = _npFmtDataCurta(_npPerSel.start) + ' → ' + _npFmtDataCurta(_npPerSel.end);
      if(pill){
        var s = _npPerSel.start.y+'-'+String(_npPerSel.start.m).padStart(2,'0')+'-'+String(_npPerSel.start.d).padStart(2,'0');
        var e = _npPerSel.end.y+'-'+String(_npPerSel.end.m).padStart(2,'0')+'-'+String(_npPerSel.end.d).padStart(2,'0');
        pill.textContent = s+' → '+e;
      }
    } else {
      if(lbl) lbl.textContent = _mesLabel();
      if(pill) pill.textContent = _mesKey();
    }
    _npAtualizarBadgeState();
    _npAtualizarAtalhos();
  }

  /* Atalhos rápidos — sempre relativos à data de HOJE, não à seleção atual */
  window._npAtalho = function(sc){
    _npCalMode = 'mes';
    _npDiaSel = null; window._npDiaSel = null;
    _npPerSel = null; window._npPerSel = null;
    var H = _npHoje();
    if(sc === 'hoje'){ _npAno=H.y; _npMes=H.m; }
    else if(sc === '-1'){ _npAno=H.y; _npMes=H.m-1; if(_npMes<1){_npMes=12;_npAno--;} }
    else if(sc === '-3'){ _npAno=H.y; _npMes=H.m-3; while(_npMes<1){_npMes+=12;_npAno--;} }
    else if(sc === '-6'){ _npAno=H.y; _npMes=H.m-6; while(_npMes<1){_npMes+=12;_npAno--;} }
    else if(sc === 'jan'){ _npAno=H.y; _npMes=1; }
    _npSincronizarTabs();
    if(typeof _npTrocarMes === 'function'){
      _npTrocarMes();        /* refresh dos dados + label do dashboard */
    }
    /* Atualiza label custom + badge + active state dos atalhos */
    setTimeout(_npAtualizarLabelMes, 0);
  };

  /* Wrappers de npMesAnterior/npMesProximo para também atualizar o badge */
  var _origAnt = window.npMesAnterior;
  window.npMesAnterior = function(){
    _npCalMode = 'mes'; _npDiaSel = null; window._npDiaSel = null; _npPerSel = null; window._npPerSel = null;
    if(typeof _origAnt === 'function') _origAnt();
    setTimeout(_npAtualizarLabelMes, 0);
  };
  var _origProx = window.npMesProximo;
  window.npMesProximo = function(){
    _npCalMode = 'mes'; _npDiaSel = null; window._npDiaSel = null; _npPerSel = null; window._npPerSel = null;
    if(typeof _origProx === 'function') _origProx();
    setTimeout(_npAtualizarLabelMes, 0);
  };

  /* Popover open/close + seleção pendente (só comita ao clicar "Aplicar") */
  var _npPendingSel = null; /* {mode,y,m,d} */
  window._npAbrirCalPop = function(e){
    if(e){ e.stopPropagation(); }
    var pop = document.getElementById('npCalPop');
    if(!pop) return;
    _npCalY = _npAno; _npCalM = _npMes;
    var H = _npHoje();
    _npPendingSel = {
      mode: _npCalMode,
      y: _npAno,
      m: _npMes,
      d: _npDiaSel ? _npDiaSel.d : H.d,
      per: _npPerSel ? { start: _npPerSel.start ? Object.assign({}, _npPerSel.start) : null,
                         end:   _npPerSel.end   ? Object.assign({}, _npPerSel.end)   : null }
                     : { start:null, end:null }
    };
    /* Sync mini-cals do período no init */
    if(_npPerSel && _npPerSel.start){ _npPerIniY = _npPerSel.start.y; _npPerIniM = _npPerSel.start.m; }
    if(_npPerSel && _npPerSel.end){ _npPerFimY = _npPerSel.end.y; _npPerFimM = _npPerSel.end.m; }
    _npSincronizarTabs();
    _npRenderCalAtual();
    _npAtualizarResumoSel();
    pop.classList.add('show');
  };
  window._npFecharCalPop = function(e){
    if(e) e.stopPropagation();
    var pop = document.getElementById('npCalPop');
    if(pop) pop.classList.remove('show');
    _npPendingSel = null;
  };
  function _npFecharCalPop(e){ window._npFecharCalPop(e); }

  function _npAtualizarResumoSel(){
    var el = document.getElementById('npCalResumo');
    if(!el || !_npPendingSel) return;
    var p = _npPendingSel;
    var txt;
    if(p.mode === 'ano') txt = 'Selecionado: <b>Ano '+p.y+'</b>';
    else if(p.mode === 'dia') txt = 'Selecionado: <b>'+String(p.d).padStart(2,'0')+' '+_MESES_FULL_[p.m-1]+' / '+p.y+'</b>';
    else if(p.mode === 'periodo'){
      if(p.per && p.per.start && p.per.end){
        var dias = Math.round((_npTsDmy(p.per.end) - _npTsDmy(p.per.start)) / 86400000) + 1;
        txt = 'Período: <b>'+_npFmtDataCurta(p.per.start)+' → '+_npFmtDataCurta(p.per.end)+'</b> · '+dias+' dia'+(dias!==1?'s':'');
      } else if(p.per && p.per.start){
        txt = 'Início: <b>'+_npFmtDataCurta(p.per.start)+'</b> · escolha o fim';
      } else {
        txt = 'Escolha início e fim do período';
      }
    }
    else txt = 'Selecionado: <b>'+_MESES_FULL_[p.m-1]+' / '+p.y+'</b>';
    el.innerHTML = txt;
  }

  /* Aplicar — comita a seleção pendente */
  window._npAplicarSel = function(e){
    if(e) e.stopPropagation();
    if(!_npPendingSel){ window._npFecharCalPop(); return; }
    var p = _npPendingSel;
    _npCalMode = p.mode;
    if(p.mode === 'ano'){
      _npAno = p.y; _npMes = 1; _npDiaSel = null; window._npDiaSel = null;
      _npPerSel = null; window._npPerSel = null;
    } else if(p.mode === 'dia'){
      _npAno = p.y; _npMes = p.m;
      _npDiaSel = { y:p.y, m:p.m, d:p.d }; window._npDiaSel = _npDiaSel;
      _npPerSel = null; window._npPerSel = null;
    } else if(p.mode === 'periodo'){
      /* Período só é comitado se tiver início + fim */
      if(p.per && p.per.start && p.per.end){
        _npPerSel = { start: Object.assign({}, p.per.start), end: Object.assign({}, p.per.end) };
        window._npPerSel = _npPerSel;
        /* Como a filtragem de dados ainda é mês-based, usamos o mês do início como base.
           O label/badge mostram que é período. Aggregar todos os meses do range fica para
           uma fase 2 que toque a coleta de vendas no Firebase. */
        _npAno = p.per.start.y; _npMes = p.per.start.m;
        _npDiaSel = null; window._npDiaSel = null;
      } else {
        /* Período incompleto: ignora e fecha sem aplicar */
        window._npFecharCalPop();
        return;
      }
    } else {
      _npAno = p.y; _npMes = p.m;
      _npDiaSel = null; window._npDiaSel = null;
      _npPerSel = null; window._npPerSel = null;
    }
    _npSincronizarTabs();
    window._npFecharCalPop();
    if(typeof _npTrocarMes === 'function') _npTrocarMes();
    setTimeout(_npAtualizarLabelMes, 0);
  };
  document.addEventListener('click', function(e){
    var pop = document.getElementById('npCalPop');
    if(!pop) return;
    if(pop.contains(e.target)) return;
    if(e.target.closest('.np-mes-label')) return;
    if(e.target.closest('.np-atalho-custom')) return;
    pop.classList.remove('show');
  });

  /* Tabs Ano/Mês/Dia */
  function _npSincronizarTabs(){
    document.querySelectorAll('#npCalPop .np-cal-tab').forEach(function(t){
      t.classList.toggle('active', t.getAttribute('data-mode') === _npCalMode);
    });
    document.querySelectorAll('#npCalPop .np-cal-pane').forEach(function(p){
      p.classList.toggle('show', p.getAttribute('data-pane') === _npCalMode);
    });
  }
  window._npCalTab = function(mode, e){
    if(e) e.stopPropagation();
    /* Quando o popover está aberto, alterar a aba só atualiza o pending
       (a aplicação só acontece no botão Aplicar). Quando fechado, é
       a alternância "global" e atualiza o _npCalMode efetivo. */
    if(_npPendingSel){
      _npPendingSel.mode = mode;
    } else {
      _npCalMode = mode;
    }
    /* Sincroniza visualmente as abas usando o mode "ativo" no popover */
    document.querySelectorAll('#npCalPop .np-cal-tab').forEach(function(t){
      t.classList.toggle('active', t.getAttribute('data-mode') === mode);
    });
    document.querySelectorAll('#npCalPop .np-cal-pane').forEach(function(p){
      p.classList.toggle('show', p.getAttribute('data-pane') === mode);
    });
    _npRenderCalAtual();
    _npAtualizarResumoSel();
  };
  window._npCalMesNav = function(d, e){
    if(e) e.stopPropagation();
    _npCalY += d;
    _npRenderCalMes();
  };
  window._npCalDiaNav = function(d, e){
    if(e) e.stopPropagation();
    _npCalM += d;
    if(_npCalM<1){_npCalM=12;_npCalY--;}
    if(_npCalM>12){_npCalM=1;_npCalY++;}
    _npRenderCalDia();
  };

  function _npRenderCalAtual(){
    var mode = _npPendingSel ? _npPendingSel.mode : _npCalMode;
    if(mode === 'ano') _npRenderCalAno();
    else if(mode === 'mes') _npRenderCalMes();
    else if(mode === 'dia') _npRenderCalDia();
    else if(mode === 'periodo') _npRenderCalPeriodo();
    /* Alarga o popover no modo Período */
    var pop = document.getElementById('npCalPop');
    if(pop) pop.classList.toggle('modo-periodo', mode === 'periodo');
  }
  /* Highlight usa o pending (enquanto popover aberto) ou o atual */
  function _npHl(){
    if(_npPendingSel) return _npPendingSel;
    return { mode:_npCalMode, y:_npAno, m:_npMes, d:_npDiaSel?_npDiaSel.d:null };
  }
  function _npRenderCalAno(){
    var grid = document.getElementById('npCalGridAno');
    if(!grid) return;
    grid.innerHTML = '';
    var H = _npHoje();
    var hl = _npHl();
    var base = H.y - 4;
    for(var i=0;i<9;i++){
      var ano = base + i;
      var btn = document.createElement('button');
      btn.className = 'np-cal-cell';
      btn.textContent = ano;
      if(ano === H.y) btn.classList.add('atual');
      if(ano === hl.y && hl.mode === 'ano') btn.classList.add('selected');
      (function(a){
        btn.addEventListener('click', function(e){
          e.stopPropagation();
          if(_npPendingSel){
            _npPendingSel.mode='ano';
            _npPendingSel.y=a;
          }
          _npRenderCalAno();
          _npAtualizarResumoSel();
        });
      })(ano);
      grid.appendChild(btn);
    }
  }
  function _npRenderCalMes(){
    var lbl = document.getElementById('npCalMesYearLabel');
    if(lbl) lbl.textContent = _npCalY;
    var grid = document.getElementById('npCalGridMes');
    if(!grid) return;
    grid.innerHTML = '';
    var H = _npHoje();
    var hl = _npHl();
    for(var i=1;i<=12;i++){
      var btn = document.createElement('button');
      btn.className = 'np-cal-cell';
      btn.textContent = _MESES_BR_[i-1];
      if(_npCalY===H.y && i===H.m) btn.classList.add('atual');
      if(_npCalY===hl.y && i===hl.m && hl.mode==='mes') btn.classList.add('selected');
      (function(mi){
        btn.addEventListener('click', function(e){
          e.stopPropagation();
          if(_npPendingSel){
            _npPendingSel.mode='mes';
            _npPendingSel.y=_npCalY;
            _npPendingSel.m=mi;
          }
          _npRenderCalMes();
          _npAtualizarResumoSel();
        });
      })(i);
      grid.appendChild(btn);
    }
  }
  function _npRenderCalDia(){
    var lbl = document.getElementById('npCalDiaLabel');
    if(lbl) lbl.textContent = _MESES_FULL_[_npCalM-1] + ' / ' + _npCalY;
    var grid = document.getElementById('npCalGridDia');
    if(!grid) return;
    grid.innerHTML = '';
    _DOW_.forEach(function(d){
      var h = document.createElement('div');
      h.className = 'dow'; h.textContent = d;
      grid.appendChild(h);
    });
    var prim = new Date(_npCalY, _npCalM-1, 1).getDay();
    var total = _npDiasNoMes(_npCalY, _npCalM);
    for(var v=0; v<prim; v++){
      var ph = document.createElement('div');
      ph.className = 'np-cal-cell empty';
      grid.appendChild(ph);
    }
    var H = _npHoje();
    var hl = _npHl();
    for(var i=1;i<=total;i++){
      var btn = document.createElement('button');
      btn.className = 'np-cal-cell';
      btn.textContent = i;
      if(_npCalY===H.y && _npCalM===H.m && i===H.d) btn.classList.add('atual');
      if(hl.mode==='dia' && _npCalY===hl.y && _npCalM===hl.m && i===hl.d) btn.classList.add('selected');
      (function(di){
        btn.addEventListener('click', function(e){
          e.stopPropagation();
          if(_npPendingSel){
            _npPendingSel.mode='dia';
            _npPendingSel.y=_npCalY;
            _npPendingSel.m=_npCalM;
            _npPendingSel.d=di;
          }
          _npRenderCalDia();
          _npAtualizarResumoSel();
        });
      })(i);
      grid.appendChild(btn);
    }
  }

  /* ── Modo Período (de X até Y) ── */
  function _npTsDmy(o){ return o ? new Date(o.y, o.m-1, o.d).getTime() : null; }
  function _npFmtDataCurta(o){ return o ? String(o.d).padStart(2,'0')+'/'+String(o.m).padStart(2,'0')+'/'+o.y : '—'; }

  function _npRenderPerMiniCal(gridId, y, m){
    var grid = document.getElementById(gridId);
    if(!grid) return;
    grid.innerHTML = '';
    _DOW_.forEach(function(d){
      var h = document.createElement('div');
      h.className = 'dow'; h.textContent = d;
      grid.appendChild(h);
    });
    var pendingPer = (_npPendingSel && _npPendingSel.per) ? _npPendingSel.per : (_npPerSel || {start:null,end:null});
    var prim = new Date(y, m-1, 1).getDay();
    var total = _npDiasNoMes(y, m);
    for(var v=0; v<prim; v++){
      var ph = document.createElement('div');
      ph.className = 'np-cal-cell empty';
      grid.appendChild(ph);
    }
    var H = _npHoje();
    var sIni = _npTsDmy(pendingPer.start);
    var sFim = _npTsDmy(pendingPer.end);
    for(var i=1;i<=total;i++){
      var btn = document.createElement('button');
      btn.className = 'np-cal-cell';
      btn.textContent = i;
      var sCur = new Date(y, m-1, i).getTime();
      if(y===H.y && m===H.m && i===H.d) btn.classList.add('atual');
      if((sIni && sCur===sIni) || (sFim && sCur===sFim)) btn.classList.add('range-edge');
      else if(sIni && sFim && sCur>sIni && sCur<sFim) btn.classList.add('range-mid');
      (function(di, dy, dm){
        btn.addEventListener('click', function(e){
          e.stopPropagation();
          _npPerCellClick({y:dy, m:dm, d:di});
        });
      })(i, y, m);
      grid.appendChild(btn);
    }
  }
  function _npRenderCalPeriodo(){
    var lblI = document.getElementById('npCalPerIniLabel');
    var lblF = document.getElementById('npCalPerFimLabel');
    if(lblI) lblI.textContent = _MESES_FULL_[_npPerIniM-1]+' / '+_npPerIniY;
    if(lblF) lblF.textContent = _MESES_FULL_[_npPerFimM-1]+' / '+_npPerFimY;
    _npRenderPerMiniCal('npCalGridPerIni', _npPerIniY, _npPerIniM);
    _npRenderPerMiniCal('npCalGridPerFim', _npPerFimY, _npPerFimM);
    var res = document.getElementById('npCalPerResumo');
    if(!res) return;
    var pendingPer = (_npPendingSel && _npPendingSel.per) ? _npPendingSel.per : (_npPerSel || {start:null,end:null});
    if(pendingPer.start && pendingPer.end){
      var dias = Math.round((_npTsDmy(pendingPer.end) - _npTsDmy(pendingPer.start)) / 86400000) + 1;
      res.innerHTML = '<b>'+_npFmtDataCurta(pendingPer.start)+'</b> → <b>'+_npFmtDataCurta(pendingPer.end)+'</b> · '+dias+' dia'+(dias!==1?'s':'');
    } else if(pendingPer.start){
      res.innerHTML = '<b>'+_npFmtDataCurta(pendingPer.start)+'</b> → escolha o fim';
    } else {
      res.textContent = '— escolha início e fim —';
    }
  }
  function _npPerCellClick(date){
    if(!_npPendingSel) return;
    if(!_npPendingSel.per) _npPendingSel.per = { start:null, end:null };
    var p = _npPendingSel.per;
    var sCur = _npTsDmy(date);
    var sIni = _npTsDmy(p.start);
    if(!p.start){
      p.start = date; p.end = null;
    } else if(p.start && !p.end){
      if(sCur < sIni){ p.start = date; }
      else { p.end = date; }
    } else {
      p.start = date; p.end = null;
    }
    /* Limpa preset ativo */
    document.querySelectorAll('.np-per-preset').forEach(function(b){ b.classList.remove('active'); });
    _npRenderCalPeriodo();
    _npAtualizarResumoSel();
  }
  window._npPerNav = function(qual, delta, e){
    if(e) e.stopPropagation();
    if(qual === 'ini'){
      _npPerIniM += delta;
      if(_npPerIniM<1){_npPerIniM=12;_npPerIniY--;}
      if(_npPerIniM>12){_npPerIniM=1;_npPerIniY++;}
    } else {
      _npPerFimM += delta;
      if(_npPerFimM<1){_npPerFimM=12;_npPerFimY--;}
      if(_npPerFimM>12){_npPerFimM=1;_npPerFimY++;}
    }
    _npRenderCalPeriodo();
  };
  window._npPerPreset = function(preset, e){
    if(e) e.stopPropagation();
    if(!_npPendingSel) return;
    var H = _npHoje();
    var hojeDate = new Date(H.y, H.m-1, H.d);
    function _toDmy(dt){ return { y: dt.getFullYear(), m: dt.getMonth()+1, d: dt.getDate() }; }
    var start=null, end=null;
    if(preset === 'semana'){
      var dow = hojeDate.getDay();
      start = _toDmy(new Date(H.y, H.m-1, H.d - dow));
      end   = _toDmy(new Date(H.y, H.m-1, H.d - dow + 6));
    } else if(preset === 'mes'){
      start = { y:H.y, m:H.m, d:1 };
      end   = { y:H.y, m:H.m, d:_npDiasNoMes(H.y, H.m) };
    } else if(preset === 'trimestre'){
      var qIni = Math.floor((H.m-1)/3)*3 + 1;
      var qFim = qIni + 2;
      start = { y:H.y, m:qIni, d:1 };
      end   = { y:H.y, m:qFim, d:_npDiasNoMes(H.y, qFim) };
    } else if(preset === 'ano'){
      start = { y:H.y, m:1,  d:1 };
      end   = { y:H.y, m:12, d:31 };
    } else if(preset === 'ult30'){
      var fim30 = hojeDate, ini30 = new Date(fim30); ini30.setDate(ini30.getDate() - 29);
      start = _toDmy(ini30); end = _toDmy(fim30);
    } else if(preset === 'ult90'){
      var fim90 = hojeDate, ini90 = new Date(fim90); ini90.setDate(ini90.getDate() - 89);
      start = _toDmy(ini90); end = _toDmy(fim90);
    }
    _npPendingSel.mode = 'periodo';
    _npPendingSel.per = { start:start, end:end };
    if(start){ _npPerIniY = start.y; _npPerIniM = start.m; }
    if(end){   _npPerFimY = end.y;   _npPerFimM = end.m; }
    document.querySelectorAll('.np-per-preset').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-preset') === preset);
    });
    _npRenderCalPeriodo();
    _npAtualizarResumoSel();
  };

  /* Inicializa label/atalhos quando a Pipeline abre */
  var _origAbrirNovaPipeline = window.abrirNovaPipeline;
  window.abrirNovaPipeline = function(){
    if(typeof _origAbrirNovaPipeline === 'function') _origAbrirNovaPipeline();
    setTimeout(_npAtualizarLabelMes, 80);
  };
  function _npTrocarMes(){
    _npVendasTurma=[];_npVendasAvulso={};_npGoals={};
    /* Invalida o cache de linhas da aba Metas — sem isto, o toggle
       Card/Lista e a ordenação repintavam a tabela do mês anterior. */
    window._npMetasRows=null;
    /* Renderizar imediatamente o estado vazio para evitar mostrar dados do mês anterior */
    if(typeof _npRenderTudo==='function') _npRenderTudo();
    _npIniciarListeners();
    _npColetarVendasTurma(); /* já busca goals em paralelo com as turmas */
    _npRenderLabel();
    var el=document.getElementById('npModalMetaMes');
    if(el) el.textContent=_mesLabel();
  }

  /* ── Abrir / Fechar ──────────────────────────────── */
  window.abrirNovaPipeline=function(){
    _npAtivo=true;
    _mostrarTela('novaPipelineScreen', true);
    var el=document.getElementById('novaPipelineScreen');
    if(el) el.classList.add('active');
    _npColetarConsultores();
    _npIniciarListeners();
    _npColetarVendasTurma();
    npShowTab('dashboard');
  };

  window.fecharNovaPipeline=function(){
    _npAtivo=false;
    var el=document.getElementById('novaPipelineScreen');
    if(el) el.classList.remove('active');
    if(_npListenerAvulso) _npListenerAvulso();
    if(_npListenerGoals) _npListenerGoals();
    if(_npListenerGoalsSem) _npListenerGoalsSem();
    if(_npListenerUsuarios) _npListenerUsuarios();
    if(_npListenerMetaGeral) _npListenerMetaGeral();
    _npListenerAvulso=null;_npListenerGoals=null;_npListenerGoalsSem=null;_npListenerUsuarios=null;_npListenerMetaGeral=null;
    window._npMetaGeral=null;
    _mostrarTela('turmasScreen');
  };

  /* ── Hook: sync automático ao salvar clientes turma ── */
  var _origRenderAll=window.renderAll;
  var _npRefreshTimer=null;
  window.renderAll=function(){
    if(typeof _origRenderAll==='function') _origRenderAll.apply(this,arguments);
    if(_npAtivo){
      /* Atualizar vendas de turma em background (debounced) */
      clearTimeout(_npRefreshTimer);
      _npRefreshTimer=setTimeout(_npColetarVendasTurma,200);
    }
  };

  /* ── Input moeda no modal ────────────────────────── */
  (function(){
    var inp=document.getElementById('npVendaValor');
    if(inp) inp.addEventListener('input',function(){
      this.value=_npMoneyMask(this.value);
    });
  })();

  /* ── ESC fecha modais ────────────────────────────── */
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){
      var mv=document.getElementById('npModalVenda');
      var mm=document.getElementById('npModalMeta');
      var mg=document.getElementById('npModalMetaGeral');
      if(mv&&mv.classList.contains('open')) npFecharModalVenda();
      else if(mg&&mg.classList.contains('open')) npFecharModalMetaGeral();
      else if(mm&&mm.classList.contains('open')) npFecharModalMeta();
    }
  });

  /* debug log removido */

  /* Expor vars privadas para scripts externos (v2 patch) */
  Object.defineProperty(window,'_npConsultores',{get:function(){return _npConsultores;},set:function(v){_npConsultores=v;},configurable:true});
  Object.defineProperty(window,'_npGoals',{get:function(){return _npGoals;},set:function(v){_npGoals=v;},configurable:true});
  Object.defineProperty(window,'_npAtivo',{get:function(){return _npAtivo;},set:function(v){_npAtivo=v;},configurable:true});
  Object.defineProperty(window,'_npTabAtiva',{get:function(){return _npTabAtiva;},set:function(v){_npTabAtiva=v;},configurable:true});
  Object.defineProperty(window,'_npVendasTurma',{get:function(){return _npVendasTurma;},set:function(v){_npVendasTurma=v;},configurable:true});
  Object.defineProperty(window,'_npVendasAvulso',{get:function(){return _npVendasAvulso;},set:function(v){_npVendasAvulso=v;},configurable:true});
  Object.defineProperty(window,'_npMes',{get:function(){return _npMes;},set:function(v){_npMes=v;},configurable:true});
  Object.defineProperty(window,'_npAno',{get:function(){return _npAno;},set:function(v){_npAno=v;},configurable:true});
  window._npRenderTudo=_npRenderTudo;
  window._npColetarVendasTurma=_npColetarVendasTurma;
  window._npTodasVendas=_npTodasVendas;
  window._npPorConsultor=_npPorConsultor;
  window._npColetarConsultores=_npColetarConsultores;
  window._npPopularFiltros=_npPopularFiltros;
  window._npRenderDashboard=_npRenderDashboard;
  window._npRenderLabel=_npRenderLabel;
  window._mesKey=_mesKey;
  window._mesLabel=_mesLabel;
  window._npAtualizarBtnConfigurar=_npAtualizarBtnConfigurar;
  window._npGetMetaEquipe=getMetaEquipeMes;

})();

