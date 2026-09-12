/* ══════════════════════════════════════════════════════════════════
   63-turma-frz-sync.js — ⟳ Sincronizar FRZ DENTRO de uma turma.

   O problema que isto resolve
   ───────────────────────────
   A Pipeline Comercial tinha o botão "⟳ Sincronizar FRZ" (58-frz-sync.js) e a
   aba Turmas não tinha nada: a turma só recebia dado à mão ou por importação de
   planilha. Resultado prático na IF21 — a Pipeline mostrando as vendas do
   período e a turma inteira zerada, porque a importação trouxe só a lista de
   presença (`_importado:true`, valor 0, treinamento vazio).

   Como funciona
   ─────────────
   Mesma fonte do botão da Pipeline: Supabase `pipeline_entries` (FRZ // PIPELINE
   HUD), leitura anônima com chave publishable — sem servidor no meio. A
   diferença é o RECORTE: a Pipeline filtra por `month`, a turma filtra pela
   JANELA DE DATAS da turma (periodStart → periodEnd), porque `pipeline_entries`
   não tem coluna de turma. É a mesma regra do Turma-Lancar-FRZ.ps1.

   Regras
   ──────
   • Escopo de consultores e de-para de status vêm de window.FRZ (58-frz-sync.js).
     Nunca duplicar esses mapas aqui: chave errada = consultor some sem erro.
   • Valor sobe como está no HUD. NÃO recalcula nada — inclusive no Coaching
     Individual, que no HUD já vem pela metade. O dedup turma × CRM da Pipeline
     (11-pipeline-comercial.js) casa por soma e trata o CI, então não há dupla
     contagem no KPI.
   • und > 1 vira sufixo no nome do treinamento ("CIS ×2"), igual ao 58.
   • COMBO: "CEOP/MASTER/ FGPC" no HUD é UMA linha com o valor fechado, mas na
     turma são 3 treinamentos. O sync quebra em 3 subs, sugere o rateio pela
     tabela de preços e deixa os valores EDITÁVEIS na prévia (só quem lançou
     sabe quanto foi cada um). A soma tem que fechar o total do HUD, senão o
     Aplicar recusa. Rateio ajustado à mão é preservado nas sincronizações
     seguintes enquanto o total não mudar no HUD.
   • ESPELHO FIEL, mas SÓ do que veio do FRZ: cada sub importado leva
     _frz:true + frzId. Treinamento lançado à mão na turma nunca é tocado.
   • Aluno que não está na turma é CRIADO (leva _frzCliente:true). Se depois
     sumir do HUD, o aluno criado some junto; aluno do roster fica, só perde o
     treinamento importado.
   • Sempre com PRÉVIA. A janela de datas pega tudo que o consultor fechou
     naqueles dias — inclusive venda de carteira que não é da turma. Quem decide
     é quem clica.
   ══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var LS_PREFIX = 'turmaFrzUltima:';
  var _rodando  = false;
  var _itens    = null;   /* o que o último clique leu do HUD (usado no Aplicar) */
  var _janelaAtiva = null;/* janela que gerou a prévia na tela */

  function _toast(msg, cor){
    if(typeof window._showToast === 'function') window._showToast(msg, cor||'var(--accent)');
    else console.log('[FRZ turma]', msg);
  }
  function _fmt(v){
    return (typeof window.formatVal === 'function')
      ? window.formatVal(v)
      : 'R$ ' + (+v||0).toFixed(2);
  }
  function _esc(s){
    return String(s==null?'':s).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }

  /* Normalização de nome — gêmea de _npDedupNorm (11-pipeline-comercial.js:689).
     Sem acento, espaço simples, maiúsculo. */
  function _norm(s){
    var t = String(s||'');
    try{ t = t.normalize('NFD').replace(/[̀-ͯ]/g,''); }catch(e){}
    return t.replace(/\s+/g,' ').trim().toUpperCase();
  }

  /* Casamento de nome — gêmea de _npDedupMesmoCliente (11-pipeline-comercial.js:696).
     Os nomes divergem entre as bases ("Jéssica Laiza" × "JESSICA LAIZA MOTA"):
     casa por primeiro nome + um sobrenome de 3+ letras em comum. */
  function _mesmoCliente(a,b){
    if(!a||!b) return false;
    if(a===b) return true;
    var pa=a.split(' '), pb=b.split(' ');
    if(pa[0]!==pb[0]) return false;
    for(var i=1;i<pa.length;i++){
      if(pa[i].length<3) continue;
      for(var j=1;j<pb.length;j++){ if(pa[i]===pb[j]) return true; }
    }
    /* um lado só com primeiro nome ("Mariana") casa pelo primeiro */
    return pa.length===1 || pb.length===1;
  }

  /* ── De-para de curso ───────────────────────────────────────────────
     O HUD é campo livre (o consultor digita "MCIS", "mcis 252", "Método CIS").
     A turma trabalha com os CÓDIGOS do catálogo (window.allTreinamentos:
     BHP, CEOP, CI, FCIS, FGPC, IF, ML5, CIS, CIS_GLOBAL, MASTER COACHING…).
     Ordem: catálogo → alias → catálogo sem o número da turma → passa direto
     com ⚠ na prévia. */
  var ALIAS = {
    'MCIS':'CIS', 'METODO CIS':'CIS', 'METODO CIS PRESENCIAL':'CIS',
    'CIS PRESENCIAL':'CIS', 'MCIS PRESENCIAL':'CIS',
    'MCIS GLOBAL':'CIS_GLOBAL', 'METODO CIS GLOBAL':'CIS_GLOBAL',
    'CIS GLOBAL':'CIS_GLOBAL', 'CIS-GL':'CIS_GLOBAL', 'CIS GL':'CIS_GLOBAL',
    'COACHING INDIVIDUAL':'CI',
    'MASTER':'MASTER COACHING', 'MC':'MASTER COACHING',
    'IA':'MENT. IA PARA NEGOCIOS', 'IA PARA NEGOCIOS':'MENT. IA PARA NEGOCIOS',
    'MENT IA':'MENT. IA PARA NEGOCIOS',
    'TCE BRONZE':'TCE - BRONZE', 'TOUR BRONZE':'TCE - BRONZE',
    'TCE OURO':'TCE - OURO',     'TOUR OURO':'TCE - OURO',
    'TCE BLACK':'TCE - BLACK',   'TOUR BLACK':'TCE - BLACK',
    'TCE VIP':'TCE - VIP',       'TOUR VIP':'TCE - VIP',
    'ML':'ML5', 'FORMACAO DE LIDERES':'ML5',
    'DP':'DP', 'DIP':'DP'
  };

  function _catalogo(){
    return (Array.isArray(window.allTreinamentos) && window.allTreinamentos.length)
      ? window.allTreinamentos.slice() : [];
  }
  /* Um pedaço de curso → código do catálogo, ou null se não reconhecer. */
  function _umCod(txt){
    var k = _norm(txt);
    if(!k) return null;
    var cat = _catalogo(), i;
    for(i=0;i<cat.length;i++){ if(_norm(cat[i])===k) return cat[i]; }
    if(ALIAS[k]) return ALIAS[k];
    /* "MCIS 252" / "CEOP 14" — o número é a turma do produto, não o produto */
    var semNum = k.replace(/\s+\d+\s*$/,'').trim();
    if(semNum && semNum!==k){
      for(i=0;i<cat.length;i++){ if(_norm(cat[i])===semNum) return cat[i]; }
      if(ALIAS[semNum]) return ALIAS[semNum];
    }
    return null;
  }

  /* Preço "de tabela" (grade fixada em 11/09/2026) — usado SÓ para sugerir o
     rateio de um combo. Quem não está aqui entra com peso igual ao dos outros. */
  var PRECO_TABELA = {
    'FCIS':10796.49, 'MASTER COACHING':7796.47, 'ML5':7196.46,
    'FGPC':5996.45, 'CEOP':5996.45, 'BHP':5996.45,
    'IF':3596.40, 'FPF':5998.50, 'TAV':2997.00
  };

  /* ── Combo ("CEOP/MASTER/ FGPC") ───────────────────────────────────
     O curso no HUD é campo livre e o consultor lança a grade inteira numa
     linha só, com o valor fechado. Na turma isso são N treinamentos, senão a
     aba Produto e o ranking por treinamento ficam cegos.
     Só quebra quando TODOS os pedaços casam com o catálogo — "A/B" que não
     casa continua uma linha só, com ⚠, em vez de virar lixo. */
  function _partesTreino(cursoHud, valorTotal){
    var bruto = String(cursoHud||'').trim();
    if(!bruto) return [{ cod:'-', valor:valorTotal, aviso:'sem treinamento no HUD' }];

    var pedacos = bruto.split(/\s*[\/+]\s*/).map(function(s){ return s.trim(); })
                       .filter(function(s){ return s; });
    if(pedacos.length > 1){
      var cods = pedacos.map(_umCod);
      if(cods.every(function(c){ return !!c; })){
        return _ratear(cods, valorTotal);
      }
    }
    var cod = _umCod(bruto);
    return [{ cod: cod || bruto, valor: valorTotal, aviso: cod ? '' : 'curso fora do catálogo' }];
  }

  /* Combo fechado num valor REDONDO foi negociado em números redondos: quem
     vende R$ 14.000 de CEOP+MASTER+FGPC divide 4.000 / 4.000 / 6.000, não
     4.242,19 / 5.515,62 / 4.242,19. O passo é o maior valor "inteiro" que
     divide o total; total quebrado (R$ 13.993,46) não tem passo e fica no
     proporcional puro. */
  function _passoRedondo(total){
    var c = Math.round(total * 100);
    if(c <= 0) return 0;
    if(c % 100000 === 0) return 1000;
    if(c % 50000  === 0) return 500;
    if(c % 10000  === 0) return 100;
    return 0;
  }

  /* Rateio proporcional ao preço de tabela, arredondado ao passo redondo. O
     resto vai para a maior parte, então a soma fecha EXATAMENTE o valor do HUD
     (é isso que o Aplicar cobra). */
  function _ratear(cods, total){
    var pesos = cods.map(function(c){ return PRECO_TABELA[c] || 0; });
    if(pesos.some(function(p){ return !p; })) pesos = cods.map(function(){ return 1; });
    var somaP = pesos.reduce(function(a,b){ return a+b; }, 0);
    var partes = cods.map(function(c,i){
      return { cod:c, valor: Math.round((total * pesos[i] / somaP) * 100) / 100, aviso:'' };
    });

    var passo = _passoRedondo(total);
    if(passo){
      var arred = partes.map(function(p){ return Math.round(p.valor / passo) * passo; });
      /* se o arredondamento zerar alguma parte, não serve — fica o proporcional */
      if(arred.every(function(v){ return v > 0; })){
        partes.forEach(function(p,i){ p.valor = arred[i]; });
      }
    }

    var dif = Math.round((total - partes.reduce(function(a,p){ return a+p.valor; },0)) * 100) / 100;
    if(dif){
      var maior = 0;
      partes.forEach(function(p,i){ if(p.valor > partes[maior].valor) maior = i; });
      partes[maior].valor = Math.round((partes[maior].valor + dif) * 100) / 100;
    }
    return partes;
  }

  /* ── Janela da turma ─────────────────────────────────────────────
     A turma não termina no último dia do evento: quem assistiu fecha depois.
     Na IF21 (08→10/09) a venda da Vanessa Burgaleri saiu em 11/09 e é dela —
     sem folga o FATURADO dava R$ 77.156,39 em vez dos R$ 84.152,85 reais.
     Por isso o padrão é periodEnd + PÓS_EVENTO dias, e a janela fica EDITÁVEL
     na prévia e gravada em turmas/{id}/frzJanela: o espelho apaga o que está
     fora da janela, então ela precisa ser a mesma em toda sincronização. */
  var POS_EVENTO = 7;

  function _somarDias(iso, n){
    var p = iso.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1]-1, +p[2]));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0,10);
  }
  function _dataOk(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s||''); }

  function _janelaPadrao(){
    var t = window._turmaAtiva || null;
    var ini = (t && t.periodStart) || '';
    var fim = (t && t.periodEnd)   || '';
    if(!ini){ var a=document.getElementById('periodStart'); if(a) ini=a.value||''; }
    if(!fim){ var b=document.getElementById('periodEnd');   if(b) fim=b.value||''; }
    if(!_dataOk(ini) || !_dataOk(fim)) return null;
    return { ini:ini, fim:_somarDias(fim, POS_EVENTO) };
  }
  /* janela em uso: a salva na turma vence o padrão */
  function _janela(){
    var t = window._turmaAtiva || null;
    var sv = t && t.frzJanela;
    if(sv && _dataOk(sv.ini) && _dataOk(sv.fim)) return { ini:sv.ini, fim:sv.fim };
    return _janelaPadrao();
  }

  /* Lançamentos que o usuário marcou como "não é desta turma" na prévia.
     Guardados na turma (turmas/{id}/frzIgnorados) porque o espelho roda toda
     vez: sem isso, a mesma venda de carteira voltaria a cada sincronização. */
  function _ignorados(){
    var t = window._turmaAtiva || null;
    return (t && t.frzIgnorados) || {};
  }

  /* ── Leitura do HUD ────────────────────────────────────────────── */
  function _buscar(jan){
    var F = window.FRZ;
    var nomes = Object.keys(F.CONSULTORES);
    if(!nomes.length) return Promise.resolve([]);
    var url = F.SB_URL
      + '?select=*'
      + '&data_iso=gte.' + encodeURIComponent(jan.ini)
      + '&data_iso=lte.' + encodeURIComponent(jan.fim)
      + '&consultant=in.' + encodeURIComponent('(' + nomes.map(function(n){ return '"'+n+'"'; }).join(',') + ')')
      + '&status=in.' + encodeURIComponent('(' + Object.keys(F.STATUS).map(function(s){ return '"'+s+'"'; }).join(',') + ')')
      + '&limit=2000';
    return fetch(url, { headers: { apikey: F.SB_KEY, Authorization: 'Bearer ' + F.SB_KEY } })
      .then(function(r){
        if(!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  /* EXTRACLASSE (vendas do Pablo no ZS) — mesma ponte do 58: o ZS exige login e
     não libera CORS, então quem lê é o Sync-Extraclasse-ZS.ps1, que gera o
     59-extraclasse-zs.js. Aqui só entram as que caem na janela da turma. */
  function _extraclasse(jan){
    var d = window.EXTRACLASSE_ZS, F = window.FRZ;
    if(!d || !d.vendas || !d.vendas.length) return [];
    return d.vendas.filter(function(v){
      var dt = String(v.data||'');
      return dt >= jan.ini && dt <= jan.fim;
    }).map(function(v){
      var valor = +v.valor || 0;
      return _item('zs_' + v.id, String(v.cliente||'').trim().toUpperCase(),
                   F.EXTRACLASSE_NOME, v.produto, 1, valor,
                   F.statusApp(v.status || 'FECHADO') || 'pago', v.data || jan.ini);
    });
  }

  /* Um lançamento do HUD vira UM item com N partes (1 no caso normal, N no
     combo). O frzId da parte é o do lançamento com sufixo "#i" quando há mais
     de uma, para o espelho continuar funcionando parte a parte. */
  function _item(frzId, aluno, consultor, cursoRaw, und, valor, status, data){
    var partes = _partesTreino(cursoRaw, valor);
    var suf = partes.length > 1;
    return {
      frzId: frzId,
      aluno: aluno,
      consultor: consultor,
      cursoRaw: String(cursoRaw||'').trim(),
      valor: valor,            /* total do lançamento — a soma das partes tem que fechar nele */
      status: status,
      data: data,
      combo: partes.length > 1,
      partes: partes.map(function(p, i){
        return {
          frzId: suf ? (frzId + '#' + i) : frzId,
          /* und > 1 vira sufixo no nome, igual ao 58 (a turma não tem campo de quantidade) */
          cod:   p.cod + (und > 1 ? ' ×'+und : ''),
          valor: p.valor,
          aviso: p.aviso
        };
      })
    };
  }

  function _coletar(jan){
    return _buscar(jan).then(function(rows){
      var F = window.FRZ, out = [];
      (rows||[]).forEach(function(e){
        var consultor = F.CONSULTORES[e.consultant];
        var status    = F.statusApp(e.status);
        if(!consultor || !status) return;
        out.push(_item('frz_' + e.id, String(e.aluno||'').trim().toUpperCase(),
                       consultor, e.curso, +(e.und||1), +e.valor || 0,
                       status, e.data_iso || jan.ini));
      });
      _extraclasse(jan).forEach(function(it){ out.push(it); });
      return out.filter(function(it){ return it.aluno; });
    });
  }

  /* ── Plano (prévia e aplicação usam ESTE cálculo, nunca dois) ───────
     Não guarda índice nenhum: tudo é reencontrado por frzId na hora de
     aplicar, então o plano não quebra se o realtime mexer no array. */
  function _sub(it, parte){
    return {
      cod: parte.cod, valor: parte.valor, entrada: 0, status: it.status,
      formaPagamento: '', parcelas: 1,
      _frz: true, frzId: parte.frzId
    };
  }
  function _igual(sub, it, parte){
    return sub && sub.cod === parte.cod
        && (+sub.valor||0) === (+parte.valor||0)
        && sub.status === it.status;
  }

  /* Acha o registro do aluno: mesmo nome E mesmo consultor (é a chave que o
     próprio app usa — "1 registro por cliente+consultor"). */
  function _acharCliente(data, it){
    var alvo = _norm(it.aluno), i, d;
    for(i=0;i<data.length;i++){
      d = data[i];
      if(!d || !d.cliente) continue;
      if((d.consultor||'') !== it.consultor) continue;
      if(_norm(d.cliente) === alvo) return d;
    }
    for(i=0;i<data.length;i++){
      d = data[i];
      if(!d || !d.cliente) continue;
      if((d.consultor||'') !== it.consultor) continue;
      if(_mesmoCliente(_norm(d.cliente), alvo)) return d;
    }
    return null;
  }
  function _acharSub(d, frzId){
    var subs = Array.isArray(d.treinamentos) ? d.treinamentos : [];
    for(var i=0;i<subs.length;i++){ if(subs[i] && subs[i].frzId === frzId) return subs[i]; }
    return null;
  }
  function _noEscopo(consultor){
    var F = window.FRZ;
    if(consultor === F.EXTRACLASSE_NOME) return true;
    return Object.keys(F.CONSULTORES).some(function(n){ return F.CONSULTORES[n] === consultor; });
  }

  /* Rateio de combo ajustado à mão na turma é PRESERVADO: se os códigos batem e
     a soma das partes já fecha o total do HUD, o sync não mexe nos valores. Só
     redistribui quando o total muda lá. Sem isso, toda sincronização desfaria o
     ajuste (ex.: CEOP 4.000 / FGPC 4.000 / MASTER 6.000). */
  function _rateioPreservado(d, it){
    if(!it.combo || !d) return false;
    var soma = 0;
    for(var i=0;i<it.partes.length;i++){
      var s = _acharSub(d, it.partes[i].frzId);
      if(!s || s.cod !== it.partes[i].cod) return false;
      soma += (+s.valor||0);
    }
    return Math.abs(soma - (+it.valor||0)) < 0.01;
  }

  function _planejar(itens, data){
    var novos=[], atualizados=[], removidos=[], fora=[], iguais=[], vivos={}, criados={};
    itens.forEach(function(it){
      if(it.ignorado){ fora.push({ it:it }); return; }
      var d = _acharCliente(data, it);
      var preserva = _rateioPreservado(d, it);
      var chave = _norm(it.aluno) + '|' + it.consultor;
      var mexeu = false;
      it.partes.forEach(function(p){
        vivos[p.frzId] = true;
        var sub = d ? _acharSub(d, p.frzId) : null;
        if(sub){
          if(preserva || _igual(sub, it, p)) return;
          mexeu = true;
          atualizados.push({ it:it, parte:p, alvo:d.cliente, de:sub.cod+' · '+_fmt(sub.valor) });
        } else {
          /* 2 compras do mesmo aluno novo = 1 aluno criado, não 2: na aplicação o
             2º lançamento já encontra o registro que o 1º criou. */
          var novoAluno = !d && !criados[chave];
          if(novoAluno) criados[chave] = true;
          mexeu = true;
          novos.push({ it:it, parte:p, alvo: d ? d.cliente : null, novoAluno: novoAluno });
        }
      });
      /* Já está na turma e sem diferença. Entra na prévia assim mesmo, com o
         check marcado: é a única forma de DESMARCAR depois de sincronizado —
         sem este bloco, a prévia ficaria vazia e a venda de carteira que entrou
         por engano não teria como sair. */
      if(!mexeu) iguais.push({ it:it, alvo: d ? d.cliente : it.aluno });
    });
    data.forEach(function(d){
      if(!d || !Array.isArray(d.treinamentos)) return;
      if(!_noEscopo(d.consultor||'')) return;
      d.treinamentos.forEach(function(sub){
        if(!sub || !sub._frz || !sub.frzId) return;
        if(vivos[sub.frzId]) return;
        removidos.push({ frzId:sub.frzId, alvo:d.cliente, cod:sub.cod, valor:sub.valor,
                         consultor:d.consultor||'', apagaAluno: !!d._frzCliente && d.treinamentos.length===1 });
      });
    });
    return { novos:novos, atualizados:atualizados, removidos:removidos,
             fora:fora, iguais:iguais, total:itens.length };
  }

  /* ── Aplicação ─────────────────────────────────────────────────── */
  function _executar(itens){
    var data = window.__getData ? window.__getData() : null;
    if(!Array.isArray(data)) throw new Error('turma sem dados carregados');
    var n={novos:0, atualizados:0, removidos:0, alunos:0}, vivos={}, tocados=[];

    itens.forEach(function(it){
      if(it.ignorado) return;   /* marcado como "não é desta turma": nem entra, nem fica */
      it.partes.forEach(function(p){ vivos[p.frzId] = true; });
      var d = _acharCliente(data, it);
      var preserva = _rateioPreservado(d, it);

      if(!d){
        /* aluno que não está na turma: nasce com a 1ª parte e as demais entram
           no laço abaixo, já achando este registro */
        var s0 = _sub(it, it.partes[0]);
        d = {
          cliente: it.aluno,
          treinamento: s0.cod,
          treinamentos: [],
          treinador: '-',
          consultor: it.consultor,
          valor: 0,
          status: it.status,
          entrada: 0,
          info: '',
          criadoPor: 'FRZ',
          presenca: 'pendente',
          presencaLog: [],
          _frzCliente: true
        };
        data.push(d);
        n.alunos++;
      }
      if(!Array.isArray(d.treinamentos)) d.treinamentos = [];
      if(tocados.indexOf(d) < 0) tocados.push(d);

      it.partes.forEach(function(p){
        var sub = _acharSub(d, p.frzId);
        if(sub){
          if(preserva || _igual(sub, it, p)) return;
          sub.cod = p.cod; sub.valor = p.valor; sub.status = it.status;
          n.atualizados++;
        } else {
          d.treinamentos.push(_sub(it, p));
          n.novos++;
        }
      });
    });

    /* espelho: o que sumiu do HUD sai daqui — só o que tem _frz e é do escopo */
    data.forEach(function(d){
      if(!d || !Array.isArray(d.treinamentos)) return;
      if(!_noEscopo(d.consultor||'')) return;
      var antes = d.treinamentos.length;
      d.treinamentos = d.treinamentos.filter(function(sub){
        if(!sub || !sub._frz || !sub.frzId) return true;
        return !!vivos[sub.frzId];
      });
      if(antes !== d.treinamentos.length){
        n.removidos += (antes - d.treinamentos.length);
        if(tocados.indexOf(d) < 0) tocados.push(d);
      }
    });

    /* d.valor do nível-row = soma dos subs. Os RANKINGS (treinador e consultor,
       02-main.js:2029/2038) somam d.valor direto, não os subs — sem esta linha o
       cliente entra nos KPIs mas aparece zerado no ranking. É a mesma recomposição
       que a edição inline faz (28-modais-cliente.js:573). */
    tocados.forEach(function(d){
      d.valor = (Array.isArray(d.treinamentos) ? d.treinamentos : [])
        .reduce(function(s,t){ return s + (t && +t.valor || 0); }, 0);
    });
    /* aluno criado pelo sync que ficou sem nada volta a não existir;
       aluno do roster (_importado) fica, só zerado */
    for(var i=data.length-1;i>=0;i--){
      var d2 = data[i];
      if(d2 && d2._frzCliente && (!d2.treinamentos || !d2.treinamentos.length)) data.splice(i,1);
    }

    if(typeof window._migrarTreinamentosHibrido === 'function') window._migrarTreinamentosHibrido(data);
    return n;
  }

  function _repintar(){
    if(typeof window.markUnsaved === 'function') window.markUnsaved('clientes');
    if(typeof window.saveStorage === 'function') window.saveStorage();
    ['renderAll','renderConsultor','renderTreinador','renderProduto'].forEach(function(f){
      if(typeof window[f] === 'function'){ try{ window[f](); }catch(e){ console.warn('[FRZ turma] '+f, e); } }
    });
  }

  /* ── Carimbo da última sincronização ───────────────────────────── */
  function _chaveLS(){
    var t = window._turmaAtiva;
    return LS_PREFIX + ((t && t.id) || 'sem-turma');
  }
  var TITULO_BASE = 'Sincronizar FRZ — puxar os lançamentos do FRZ Pipeline HUD do período desta turma';

  /* O botão é só o ícone ⟳ (34×34, do tamanho do "⋯") porque a barra de
     Clientes não tem folga pra um rótulo de 150px mais o carimbo ao lado.
     Então a última sincronização vive no title, não num <span> próprio. */
  function _mostrarUltima(){
    var b = document.getElementById('turmaBtnFrzSync');
    if(!b) return;
    var v = null;
    try{ v = localStorage.getItem(_chaveLS()); }catch(e){}
    b.title = TITULO_BASE + (v ? ('\nÚltima: ' + v) : '');
  }
  window._turmaFrzMostrarUltima = _mostrarUltima;

  /* Sem rótulo pra trocar: o estado "rodando" aparece no ícone (…), no title e
     na opacidade. O card Clientes zera toda animation/transform via
     `.tpanel:has(#cliBarUnica) *` (main.css), então um spin no ⟳ não rodaria. */
  function _marcarBotao(txt, disabled){
    var b = document.getElementById('turmaBtnFrzSync');
    if(!b) return;
    b.textContent = disabled ? '…' : '⟳';
    b.disabled = !!disabled;
    b.style.opacity = disabled ? '.6' : '';
    if(disabled) b.title = txt; else _mostrarUltima();
  }

  /* ── Modal de prévia ───────────────────────────────────────────── */
  function _overlay(){
    var ov = document.getElementById('turmaFrzOverlay');
    if(ov) return ov;
    ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.id = 'turmaFrzOverlay';
    ov.style.zIndex = '1600';
    ov.innerHTML =
      '<div class="modal" style="width:min(96vw,820px);max-height:88vh;display:flex;flex-direction:column;">'
      + '<div class="modal-title">⟳ Sincronizar FRZ</div>'
      + '<div class="modal-subtitle" id="turmaFrzSub"></div>'
      + '<div id="turmaFrzCorpo" style="flex:1;overflow-y:auto;margin:14px 0;"></div>'
      + '<div class="modal-actions">'
        + '<button class="modal-cancel" onclick="_turmaFrzFechar()">Cancelar</button>'
        + '<button id="turmaFrzOk" onclick="_turmaFrzAplicar()" '
          + 'style="background:var(--accent);color:#0f0f0f;border:none;border-radius:var(--radius-sm);'
          + 'padding:10px 18px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">Aplicar</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    return ov;
  }

  function _linha(txt, aviso){
    return '<div style="display:flex;gap:8px;align-items:baseline;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px;">'
      + '<span style="flex:1;">' + txt + '</span>'
      + (aviso ? '<span style="color:var(--amber);font-size:11px;white-space:nowrap;">⚠ '+_esc(aviso)+'</span>' : '')
      + '</div>';
  }
  function _bloco(titulo, cor, linhas){
    if(!linhas.length) return '';
    return '<div style="margin-bottom:16px;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:'+cor+';margin-bottom:6px;">'
        + _esc(titulo) + ' · ' + linhas.length + '</div>'
      + linhas.join('') + '</div>';
  }

  function _renderPrevia(plano, jan){
    var ov = _overlay();
    var sub = document.getElementById('turmaFrzSub');
    var corpo = document.getElementById('turmaFrzCorpo');
    var ok = document.getElementById('turmaFrzOk');

    var pad = _janelaPadrao() || {ini:'',fim:''};
    sub.innerHTML =
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      + '<span>Lançamentos do FRZ // PIPELINE HUD com data entre</span>'
      + '<input type="date" id="turmaFrzIni" value="' + _esc(jan.ini) + '" '
        + 'style="background:var(--surface2);border:1px solid var(--border2);color:var(--text);'
        + 'border-radius:4px;padding:3px 6px;font:inherit;font-size:12px;">'
      + '<span>e</span>'
      + '<input type="date" id="turmaFrzFim" value="' + _esc(jan.fim) + '" '
        + 'style="background:var(--surface2);border:1px solid var(--border2);color:var(--text);'
        + 'border-radius:4px;padding:3px 6px;font:inherit;font-size:12px;">'
      + '<button onclick="turmaSyncFrz(true)" style="background:var(--surface2);color:var(--text);'
        + 'border:1px solid var(--border2);border-radius:4px;padding:4px 10px;font:inherit;'
        + 'font-size:11px;cursor:pointer;">⟳ Reler</button>'
      + '</div>'
      + '<div style="margin-top:6px;font-size:11px;color:var(--muted);">'
        + plano.total + ' lançamento(s) lido(s). O padrão é o período da turma + ' + POS_EVENTO
        + ' dias, porque muita venda do evento fecha depois. '
        + '<strong>Desmarque</strong> o que não for desta turma — fica registrado e não volta.'
      + '</div>';

    /* Valor de uma parte de COMBO é editável: o HUD traz a grade inteira numa
       linha só com o valor fechado, e o rateio por tabela de preço é só um
       chute. Quem lança sabe quanto foi cada treinamento. O que for digitado
       aqui é o que grava — e a próxima sincronização preserva, desde que a soma
       continue fechando o total do lançamento. */
    function _valorCampo(o){
      var it = o.it, p = o.parte;
      if(!it.combo) return _fmt(p.valor);
      return '<input type="text" id="turmaFrzVal_' + _esc(p.frzId) + '" value="'
        + (+p.valor||0).toFixed(2).replace('.',',') + '" inputmode="decimal" '
        + 'style="width:96px;background:var(--surface2);border:1px solid var(--border2);'
        + 'color:var(--text);border-radius:4px;padding:3px 6px;font:inherit;font-size:12px;text-align:right;">';
    }
    function _selo(o){
      if(!o.it.combo) return '';
      return ' <span style="color:var(--amber);font-size:10px;">combo · '
        + _esc(o.it.cursoRaw) + ' = ' + _fmt(o.it.valor) + '</span>';
    }

    /* Um check por LANÇAMENTO (não por parte): o combo é uma venda só.
       Desmarcado = "não é desta turma" → não entra e, se já estiver lá, sai. */
    var vistos = {};
    function _check(it){
      if(vistos[it.frzId]) return '<span style="width:16px;display:inline-block;"></span>';
      vistos[it.frzId] = true;
      return '<input type="checkbox" class="turmaFrzChk" data-frz="' + _esc(it.frzId) + '"'
        + (it.ignorado ? '' : ' checked') + ' style="margin:0 6px 0 0;vertical-align:middle;">';
    }

    var lNovos = plano.novos.map(function(o){
      var it = o.it;
      return _linha(
        _check(it)
        + '<strong>' + _esc(it.aluno) + '</strong>'
        + (o.novoAluno ? ' <span style="color:var(--blue);font-size:11px;">(aluno novo)</span>' : '')
        + ' · ' + _esc(o.parte.cod) + ' · ' + _valorCampo(o)
        + ' · <span style="color:var(--muted);">' + _esc(it.status) + ' · ' + _esc(it.consultor)
        + ' · ' + _esc(it.data.split('-').reverse().join('/')) + '</span>'
        + _selo(o),
        o.parte.aviso);
    });
    var lAtu = plano.atualizados.map(function(o){
      var it = o.it;
      return _linha(
        _check(it)
        + '<strong>' + _esc(o.alvo) + '</strong> · ' + _esc(o.de)
        + ' → ' + _esc(o.parte.cod) + ' · ' + _valorCampo(o) + ' · ' + _esc(it.status)
        + _selo(o),
        o.parte.aviso);
    });
    var lRem = plano.removidos.map(function(o){
      return _linha(
        '<span style="width:16px;display:inline-block;"></span>'
        + '<strong>' + _esc(o.alvo) + '</strong> · ' + _esc(o.cod) + ' · ' + _fmt(o.valor)
        + (o.apagaAluno ? ' <span style="color:var(--muted);font-size:11px;">(aluno criado pelo sync sai junto)</span>' : ''),
        '');
    });
    function _resumo(it, opaco){
      return (opaco ? '<span style="opacity:.6;">' : '<span>')
        + '<strong>' + _esc(it.aluno) + '</strong> · '
        + _esc(it.partes.map(function(p){ return p.cod; }).join(' + ')) + ' · ' + _fmt(it.valor)
        + ' · ' + _esc(it.status) + ' · ' + _esc(it.consultor)
        + ' · ' + _esc(it.data.split('-').reverse().join('/')) + '</span>';
    }
    /* já na turma, sem diferença — desmarque para tirar */
    var lIgual = plano.iguais.map(function(o){
      return _linha(_check(o.it) + _resumo(o.it, true), '');
    });
    /* fora da turma — marque para trazer */
    var lFora = plano.fora.map(function(o){
      return _linha(_check(o.it) + _resumo(o.it, true), '');
    });

    var html = _bloco('ENTRAM', 'var(--accent)', lNovos)
             + _bloco('ATUALIZAM', 'var(--blue)', lAtu)
             + _bloco('SAEM (apagados no HUD)', 'var(--red)', lRem)
             + _bloco('JÁ NA TURMA (desmarque para tirar)', 'var(--muted)', lIgual)
             + _bloco('FORA DA TURMA (marque para trazer)', 'var(--muted)', lFora);
    if(!html){
      html = '<div style="padding:24px 0;text-align:center;color:var(--muted);font-size:13px;">'
           + 'Nenhum lançamento do FRZ nesta janela. Amplie as datas acima.</div>';
      ok.style.display = 'none';
    } else {
      ok.style.display = '';
      ok.textContent = (lNovos.length || lAtu.length || lRem.length) ? 'Aplicar' : 'Salvar seleção';
      ok.disabled = false;
    }
    corpo.innerHTML = html;
    ov.classList.add('open');
  }

  window._turmaFrzFechar = function(){
    var ov = document.getElementById('turmaFrzOverlay');
    if(ov) ov.classList.remove('open');
    _itens = null;
  };

  /* Lê os campos de rateio de combo da prévia de volta para o plano.
     Recusa se a soma não fechar o total do lançamento: combo que não soma o
     valor do HUD faria o FATURADO da turma divergir da Pipeline — que é
     exatamente o problema que este botão existe para resolver. */
  function _lerRateios(){
    var erro = null;
    (_itens||[]).forEach(function(it){
      if(!it.combo || erro) return;
      var soma = 0, achou = false;
      it.partes.forEach(function(p){
        var el = document.getElementById('turmaFrzVal_' + p.frzId);
        if(!el) return;
        achou = true;
        var v = parseFloat(String(el.value||'').replace(/\./g,'').replace(',','.'));
        p.valor = isNaN(v) ? 0 : Math.round(v*100)/100;
        soma += p.valor;
      });
      if(achou && Math.abs(soma - (+it.valor||0)) >= 0.01){
        erro = it.aluno + ' — ' + it.cursoRaw + ': as partes somam ' + _fmt(soma)
             + ', mas o lançamento no HUD é ' + _fmt(it.valor) + '.';
      }
    });
    return erro;
  }

  /* Lê os checkboxes de volta para o plano. Desmarcado vira "ignorado" e fica
     gravado na turma — senão a mesma venda de carteira voltaria toda vez. */
  function _lerChecks(){
    var mapa = {}, i;
    var chks = document.querySelectorAll ? document.querySelectorAll('.turmaFrzChk') : [];
    for(i=0;i<chks.length;i++) mapa[chks[i].getAttribute('data-frz')] = !!chks[i].checked;
    (_itens||[]).forEach(function(it){
      if(mapa.hasOwnProperty(it.frzId)) it.ignorado = !mapa[it.frzId];
    });
  }

  /* A janela e a lista de ignorados vivem no nó da turma, não no localStorage:
     o espelho apaga o que está fora delas, então precisam valer para todo mundo
     que abrir a turma, em qualquer dispositivo. */
  function _gravarConfig(jan){
    var t = window._turmaAtiva;
    if(!t || !t.id) return;
    var ign = {};
    (_itens||[]).forEach(function(it){ if(it.ignorado) ign[it.frzId] = true; });
    /* preserva ignorados de lançamentos fora da janela atual */
    var antigos = t.frzIgnorados || {};
    Object.keys(antigos).forEach(function(k){
      var naJanela = (_itens||[]).some(function(it){ return it.frzId === k; });
      if(!naJanela) ign[k] = true;
    });
    t.frzJanela = { ini:jan.ini, fim:jan.fim };
    t.frzIgnorados = ign;
    if(typeof window._fbSave === 'function'){
      window._fbSave('turmas/' + t.id + '/frzJanela', t.frzJanela).catch(function(e){
        console.warn('[FRZ turma] não gravei a janela', e);
      });
      window._fbSave('turmas/' + t.id + '/frzIgnorados', Object.keys(ign).length ? ign : null)
        .catch(function(e){ console.warn('[FRZ turma] não gravei os ignorados', e); });
    }
  }

  window._turmaFrzAplicar = function(){
    if(!_itens){ window._turmaFrzFechar(); return; }
    var ok = document.getElementById('turmaFrzOk');
    _lerChecks();
    var erroRateio = _lerRateios();
    if(erroRateio){
      _toast('⚠️ ' + erroRateio, 'var(--amber)');
      return;
    }
    if(ok){ ok.disabled = true; ok.textContent = 'Aplicando…'; }
    var n;
    try{
      n = _executar(_itens);
    }catch(err){
      console.error('[FRZ turma] aplicar falhou', err);
      _toast('❌ Não consegui aplicar (' + (err && err.message || 'erro') + ').', 'var(--red)');
      window._turmaFrzFechar();
      return;
    }
    _gravarConfig(_janelaAtiva || _janela());
    _repintar();
    var quando = new Date().toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
    try{ localStorage.setItem(_chaveLS(), quando); }catch(e){}
    _mostrarUltima();
    window._turmaFrzFechar();

    var partes = [];
    if(n.novos)       partes.push(n.novos + ' novo' + (n.novos>1?'s':'') + (n.alunos ? ' ('+n.alunos+' aluno'+(n.alunos>1?'s':'')+' criado'+(n.alunos>1?'s':'')+')' : ''));
    if(n.atualizados) partes.push(n.atualizados + ' atualizado' + (n.atualizados>1?'s':''));
    if(n.removidos)   partes.push(n.removidos + ' removido' + (n.removidos>1?'s':''));
    _toast(partes.length ? '✅ FRZ: ' + partes.join(', ') + '.' : '✅ FRZ: nada mudou.');
  };

  /* ── Botão ⟳ Sincronizar FRZ ─────────────────────────────────────
     `daTela` = o "⟳ Reler" da prévia, que usa as datas digitadas nos campos
     em vez da janela salva. */
  window.turmaSyncFrz = function(daTela){
    if(_rodando) return;
    if(!window.FRZ){
      _toast('⚠️ 58-frz-sync.js não carregou — sem ele não sei quais consultores entram.', 'var(--amber)');
      return;
    }
    if(!window._turmaAtiva || !window._turmaAtiva.id){
      _toast('⚠️ Entre numa turma antes de sincronizar.', 'var(--amber)');
      return;
    }
    if(typeof window.__getData !== 'function' || !Array.isArray(window.__getData())){
      _toast('⚠️ Os dados da turma ainda não carregaram.', 'var(--amber)');
      return;
    }
    var jan = _janela();
    if(daTela){
      var a = document.getElementById('turmaFrzIni'), b = document.getElementById('turmaFrzFim');
      var ini = a && a.value, fim = b && b.value;
      if(!_dataOk(ini) || !_dataOk(fim)){ _toast('⚠️ Preencha as duas datas.', 'var(--amber)'); return; }
      if(ini > fim){ _toast('⚠️ A data inicial é maior que a final.', 'var(--amber)'); return; }
      /* o que estava desmarcado na tela continua desmarcado depois do Reler */
      _lerChecks();
      jan = { ini:ini, fim:fim };
    }
    if(!jan){
      _toast('⚠️ Esta turma não tem período definido — é o período que diz quais vendas do HUD são dela.', 'var(--amber)');
      return;
    }

    var ignPrev = {};
    (_itens||[]).forEach(function(it){ if(it.ignorado) ignPrev[it.frzId] = true; });

    _rodando = true;
    _janelaAtiva = jan;
    _marcarBotao('Lendo o FRZ…', true);

    _coletar(jan)
      .then(function(itens){
        var salvos = _ignorados();
        itens.forEach(function(it){ it.ignorado = !!(salvos[it.frzId] || ignPrev[it.frzId]); });
        _itens = itens;
        _renderPrevia(_planejar(itens, window.__getData()), jan);
      })
      .catch(function(err){
        console.error('[FRZ turma] leitura falhou', err);
        _toast('❌ Não consegui ler o FRZ HUD (' + (err && err.message || 'erro') + ').', 'var(--red)');
      })
      .then(function(){
        _rodando = false;
        _marcarBotao('Sincronizar FRZ', false);
      });
  };

  document.addEventListener('DOMContentLoaded', _mostrarUltima);
  if(document.readyState !== 'loading') _mostrarUltima();
})();
