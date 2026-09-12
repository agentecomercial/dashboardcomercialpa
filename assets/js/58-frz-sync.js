/* ══════════════════════════════════════════════════════════════════
   58-frz-sync.js — Importa os lançamentos do FRZ // PIPELINE HUD
   (https://frz-pipeline-hud.vercel.app) para as VENDAS AVULSAS da
   Pipeline Comercial.

   Como funciona
   ─────────────
   O HUD grava tudo no Supabase, tabela `pipeline_entries`, filtrando por
   `consultant` (nome curto: "Gabriela") + `month` ("AAAA-MM"). A leitura é
   anônima (chave publishable), então dá pra ler direto do navegador — sem
   servidor no meio.

   Regras combinadas (03/08/2026)
   ──────────────────────────────
   • Só entram os consultores listados em CONSULTORES (hoje: Gabriela).
     Para incluir outro, basta acrescentar a linha "Nome no HUD": "NOME NO APP".
   • Status: FECHADO → pago, ABERTO → aberto, PROJEÇÃO → negociação
     (entra no KPI "Potencial total", que soma só o que está em negociação).
   • ESPELHO FIEL: o HUD manda. Editou lá → atualiza aqui; apagou lá → some
     daqui. Mudou de status lá → muda aqui. Vendas importadas ficam com
     _frz:true e NÃO devem ser editadas no app — a próxima sincronização
     sobrescreve.
   • Só roda quando se clica em "⟳ Sincronizar FRZ" (nada automático).
   • SÓ o mês vigente (hoje = agosto/2026). Com a tela em qualquer outro mês
     o botão recusa e avisa — julho e anteriores ficam intocados, tanto para
     importar quanto para remover.

   Detalhes de conversão
   ─────────────────────
   • valor: sobe o LÍQUIDO, nunca o bruto (15/08/2026). O líquido é o valor
     que está lançado no HUD — inclusive no COACHING INDIVIDUAL, onde o
     lançamento já vem pela metade. O sync espelha, não recalcula.
     Se um CI estiver no HUD pelo bruto, corrija no HUD.
   • und > 1: o app não tem campo de quantidade em venda avulsa, então a
     quantidade entra no nome do produto ("MASTER COACHING ×2").
   ══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var SB_URL = 'https://mnfxnepsfdfcmoglmgec.supabase.co/rest/v1/pipeline_entries';
  var SB_KEY = 'sb_publishable_hbmxtsjNBloNR6CYBXZ8Zw_FQeMZXOC';

  /* Nome no HUD  →  nome do consultor no app (Gestão de Usuários)
     ⚠️ A chave tem que ser IGUALZINHA ao campo `consultant` do Supabase —
     lá a maioria é só o primeiro nome, mas o Heverton está com nome e
     sobrenome. Errou a chave, o filtro não casa e o consultor some do
     sync sem dar erro nenhum. */
  var CONSULTORES = {
    'Gabriela':          'GABRIELA SOUZA',
    'Karla':             'KARLA FERREIRA',    /* liberada em 03/08/2026 */
    'Heverton Leonardo': 'HEVERTON LEONARDO', /* liberado em 05/08/2026 */
    'Natália':           'NATALIA OLIVEIRA'   /* liberada em 15/08/2026 — chave COM acento, igual ao HUD */
  };

  /* EXTRACLASSE (Pablo) — NÃO vem do HUD.
     O Pablo não lança no pipeline_entries: as vendas dele vivem no ZS. Como o
     ZS exige login e não libera CORS, o navegador nunca conseguiria buscar de
     lá — então o Sync-Extraclasse-ZS.ps1 gera o arquivo de dados
     assets/js/59-extraclasse-zs.js (window.EXTRACLASSE_ZS) e o sync lê dali,
     direto para a Pipeline, sem passar pelo HUD. Rode o .ps1 antes de clicar
     no botão para atualizar os números. */
  var EXTRACLASSE_NOME = 'EXTRACLASSE';

  /* Status do HUD → status da Pipeline. Ausente = não importa.
     PROJEÇÃO virou "negociação" em 05/08/2026 — é o status que o app soma
     no KPI "Potencial total". */
  var STATUS = { 'FECHADO':'pago', 'ABERTO':'aberto', 'PROJEÇÃO':'negociacao' };

  /* A comparação do status é feita sem acento e em maiúsculas, senão um
     "Projeção" digitado diferente no HUD passa batido sem erro nenhum.
     NFD separa a letra do acento; o replace tira tudo que não é ASCII,
     que depois da decomposição é só o acento solto. */
  function _stKey(s){
    return String(s||'').normalize('NFD').replace(/[^\x00-\x7F]/g,'').toUpperCase().trim();
  }
  var _STATUS_N = {};
  Object.keys(STATUS).forEach(function(k){ _STATUS_N[_stKey(k)] = STATUS[k]; });
  function _statusApp(s){ return _STATUS_N[_stKey(s)]; }

  var LS_ULTIMA = 'frzSyncUltima';
  var _rodando = false;

  function _toast(msg, cor){
    if(typeof window._showToast === 'function') window._showToast(msg, cor||'var(--accent)');
    else console.log('[FRZ]', msg);
  }

  /* Data: o HUD já grava data_iso (AAAA-MM-DD). Sem ela, monta a partir de
     "dd/mm" + o ano/mês da chave do mês. Lançamento em PROJEÇÃO em geral vem
     SEM data nenhuma (ainda não tem venda), então cai no created_at — melhor
     que jogar todo mundo no dia 01. Se o created_at for de outro mês, aí sim
     usa o dia 01 pra não vazar a venda pra fora do mês sincronizado. */
  function _data(e, mk){
    if(e.data_iso && /^\d{4}-\d{2}-\d{2}$/.test(e.data_iso)) return e.data_iso;
    var m = /^(\d{2})\/(\d{2})$/.exec(String(e.data||''));
    if(m) return mk.slice(0,4) + '-' + m[2] + '-' + m[1];
    if(e.created_at){
      var d = new Date(e.created_at);
      if(!isNaN(d.getTime())){
        var iso = d.getFullYear() + '-'
                + String(d.getMonth()+1).padStart(2,'0') + '-'
                + String(d.getDate()).padStart(2,'0');
        if(iso.slice(0,7) === mk) return iso;
      }
    }
    return mk + '-01';
  }

  /* LÍQUIDO — o que sobe para a Pipeline.
     O HUD é a fonte do líquido: o valor lançado lá JÁ É o que deve subir.
     No COACHING INDIVIDUAL isso significa o lançamento com a metade (o outro
     50% é do coach) — ex.: Thayná Deps, HUD R$ 27.001,77 para uma venda de
     R$ 54.003,54 no ZS. O sync NÃO divide nada: se dividisse, esse caso
     viraria metade da metade.
     ⚠️ Quem lançar o BRUTO no CI sobe errado — a correção é no HUD, não aqui. */
  function _liquido(curso, valor){
    return +valor || 0;
  }

  /* Objeto de venda avulsa no formato que a Pipeline já usa
     (mesmos campos de npSalvarVenda) */
  function _venda(e, mk){
    var und = +(e.und||1);
    var produto = String(e.curso||'').trim() + (und > 1 ? ' ×'+und : '');
    return {
      clienteNome:   String(e.aluno||'').trim(),
      consultorNome: CONSULTORES[e.consultant],
      produto:       produto,
      valor:         _liquido(e.curso, e.valor),
      status:        _statusApp(e.status),
      data:          _data(e, mk),
      origemManual:  'FRZ HUD' + (e.origem ? ' · ' + e.origem : ''),
      obs:           '',
      mes:           mk,
      _src:          'avulso',
      _frz:          true,
      frzId:         e.id,
      ts:            Date.parse(e.created_at) || Date.now()
    };
  }

  /* Compara só o que vem do HUD — ignora ts pra não regravar à toa */
  function _igual(a, b){
    if(!a || !b) return false;
    return a.clienteNome === b.clienteNome
        && a.consultorNome === b.consultorNome
        && a.produto === b.produto
        && (+a.valor||0) === (+b.valor||0)
        && a.status === b.status
        && a.data === b.data
        && a.origemManual === b.origemManual;
  }

  function _buscar(mk){
    var nomes = Object.keys(CONSULTORES);
    if(!nomes.length) return Promise.resolve([]);
    var url = SB_URL
      + '?select=*'
      + '&month=eq.' + encodeURIComponent(mk)
      + '&consultant=in.' + encodeURIComponent('(' + nomes.map(function(n){ return '"'+n+'"'; }).join(',') + ')')
      + '&status=in.' + encodeURIComponent('(' + Object.keys(STATUS).map(function(s){ return '"'+s+'"'; }).join(',') + ')')
      + '&limit=2000';
    return fetch(url, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
      .then(function(r){
        if(!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  /* ── EXTRACLASSE: vendas do ZS do Pablo (arquivo 59-extraclasse-zs.js) ──
     Formato esperado:
       window.EXTRACLASSE_ZS = {
         mes: '2026-08',
         geradoEm: '15/08/2026 21:40',
         vendas: [ { id, cliente, produto, valor, data, status } ]
       }
     `id` é o id da oportunidade no ZS — vira 'zs_<id>' no app, então
     regerar o arquivo atualiza a mesma venda em vez de duplicar. */
  function _extraclasse(mk){
    var d = window.EXTRACLASSE_ZS;
    if(!d || !d.vendas || !d.vendas.length) return [];
    if(d.mes && d.mes !== mk) return [];   /* arquivo de outro mês: ignora */
    return d.vendas.map(function(v){
      return {
        id: 'zs_' + v.id,
        venda: {
          clienteNome:   String(v.cliente||'').trim(),
          consultorNome: EXTRACLASSE_NOME,
          produto:       String(v.produto||'').trim(),
          valor:         _liquido(v.produto, v.valor),   /* mesma regra do líquido */
          status:        _statusApp(v.status || 'FECHADO') || 'pago',
          data:          v.data || (mk + '-01'),
          origemManual:  'ZS · Extraclasse',
          obs:           '',
          mes:           mk,
          _src:          'avulso',
          _frz:          true,
          frzId:         'zs_' + v.id,
          ts:            Date.now()
        }
      };
    });
  }

  function _marcarBotao(txt, disabled){
    var b = document.getElementById('npBtnFrzSync');
    if(!b) return;
    b.textContent = txt;
    b.disabled = !!disabled;
    b.style.opacity = disabled ? '.6' : '';
  }

  function _mostrarUltima(){
    var el = document.getElementById('npFrzUltima');
    if(!el) return;
    var v = null;
    try{ v = localStorage.getItem(LS_ULTIMA); }catch(e){}
    el.textContent = v ? ('FRZ: ' + v) : '';
  }

  /* ── Sincronização (botão ⟳ Sincronizar FRZ) ───────────────────── */
  window.npSyncFrz = function(){
    if(_rodando) return;
    if(typeof window._fbGet !== 'function' || typeof window._fbSave !== 'function'){
      _toast('⚠️ Firebase offline — não dá pra gravar a importação.', 'var(--amber)');
      return;
    }
    var mk = (typeof window._mesKey === 'function') ? window._mesKey() : null;
    if(!mk){ _toast('⚠️ Mês não identificado.', 'var(--amber)'); return; }
    /* Trava: só o mês vigente. Evita mexer no histórico (julho e anteriores). */
    var hoje = new Date();
    var mkHoje = hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0');
    if(mk !== mkHoje){
      _toast('⚠️ A sincronização do FRZ só roda no mês vigente (' + mkHoje + '). Volte para o mês atual.', 'var(--amber)');
      return;
    }

    _rodando = true;
    _marcarBotao('⟳ Sincronizando…', true);

    Promise.all([ _buscar(mk), window._fbGet('pipelineSales/' + mk) ])
      .then(function(res){
        var remotos = res[0] || [];
        var locais  = res[1] || {};
        var novos = 0, atualizados = 0, removidos = 0;
        var ops = [];

        /* Junta as duas fontes num único conjunto {id, venda}:
           HUD (pipeline_entries) + EXTRACLASSE (ZS do Pablo, arquivo local) */
        var itens = [];
        remotos.forEach(function(e){
          if(!CONSULTORES[e.consultant] || !_statusApp(e.status)) return;
          itens.push({ id: 'frz_' + e.id, venda: _venda(e, mk) });
        });
        var extra = _extraclasse(mk);
        extra.forEach(function(it){ itens.push(it); });

        /* 1) fonte → app: cria ou atualiza */
        itens.forEach(function(it){
          var atual = locais[it.id];
          if(!atual){ novos++; }
          else if(_igual(atual, it.venda)){ return; }   /* nada mudou */
          else { atualizados++; }
          ops.push(window._fbSave('pipelineSales/' + mk + '/' + it.id, it.venda));
        });

        /* 2) Apagado na origem (ou com status fora do mapa) → remove aqui.
              Só mexe no que veio do FRZ/ZS e é de consultor do escopo — venda
              lançada à mão no app nunca é tocada. */
        var vivos = {};
        itens.forEach(function(it){ vivos[it.id] = true; });
        Object.keys(locais).forEach(function(id){
          var v = locais[id];
          if(!v || !v._frz) return;
          var doEscopo = (v.consultorNome === EXTRACLASSE_NOME)
            || Object.keys(CONSULTORES).some(function(n){
                 return CONSULTORES[n] === v.consultorNome;
               });
          if(!doEscopo) return;
          if(vivos[id]) return;
          removidos++;
          ops.push(window._fbSave('pipelineSales/' + mk + '/' + id, null));
        });

        return Promise.all(ops).then(function(){
          return { novos:novos, atualizados:atualizados, removidos:removidos, total:itens.length };
        });
      })
      .then(function(r){
        /* Recarrega o cache do mês e repinta */
        return window._fbGet('pipelineSales/' + mk).then(function(d){
          window._npVendasAvulso = d || {};
          if(typeof window._npRenderTudo === 'function') window._npRenderTudo();
          return r;
        });
      })
      .then(function(r){
        var quando = new Date().toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
        try{ localStorage.setItem(LS_ULTIMA, quando); }catch(e){}
        _mostrarUltima();
        var partes = [];
        if(r.novos)       partes.push(r.novos + ' novo' + (r.novos>1?'s':''));
        if(r.atualizados) partes.push(r.atualizados + ' atualizado' + (r.atualizados>1?'s':''));
        if(r.removidos)   partes.push(r.removidos + ' removido' + (r.removidos>1?'s':''));
        _toast(partes.length
          ? '✅ FRZ: ' + partes.join(', ') + '.'
          : '✅ FRZ: já estava tudo em dia (' + r.total + ' lançamento' + (r.total!==1?'s':'') + ').');
      })
      .catch(function(err){
        console.error('[FRZ] sync falhou', err);
        _toast('❌ Não consegui ler o FRZ HUD (' + (err && err.message || 'erro') + ').', 'var(--red)');
      })
      .then(function(){
        _rodando = false;
        _marcarBotao('⟳ Sincronizar FRZ', false);
      });
  };

  /* ── Constantes compartilhadas ───────────────────────────────────
     O 63-turma-frz-sync.js (⟳ Sincronizar FRZ da aba Turmas) precisa do MESMO
     mapa de consultores e do MESMO de-para de status. Duplicar lá é justamente
     o risco que o comentário do CONSULTORES descreve: chave errada = consultor
     some do sync sem dar erro nenhum. Então a fonte é uma só, publicada aqui. */
  window.FRZ = {
    CONSULTORES: CONSULTORES,
    EXTRACLASSE_NOME: EXTRACLASSE_NOME,
    STATUS: STATUS,
    stKey: _stKey,
    statusApp: _statusApp,
    SB_URL: SB_URL,
    SB_KEY: SB_KEY
  };

  document.addEventListener('DOMContentLoaded', _mostrarUltima);
  if(document.readyState !== 'loading') _mostrarUltima();
})();
