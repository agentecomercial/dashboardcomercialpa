/* =========================================================================
   components/32-graficos.js — Graficos em SVG puro (sem bibliotecas).

   Paleta categorica e de status validadas para daltonismo e contraste,
   com passo proprio para o tema escuro (nao e um "flip" automatico).
   Todos os graficos tem camada de hover com tooltip e legenda quando ha
   duas ou mais series; nenhuma informacao depende so da cor.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u;
  const G = {};

  const NS = 'http://www.w3.org/2000/svg';

  /* --------------------------- Paleta --------------------------- */
  const CAT_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  const CAT_DARK  = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
  const STATUS = { bom: '#0ca30c', atencao: '#fab219', serio: '#ec835a', critico: '#d03b3b' };
  G.STATUS = STATUS;

  function escuro() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  G.cor = i => (escuro() ? CAT_DARK : CAT_LIGHT)[i % 8];
  G.paleta = () => (escuro() ? CAT_DARK : CAT_LIGHT).slice();

  /* --------------------------- Helpers SVG --------------------------- */
  function svgEl(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    return n;
  }
  function base(w, h) {
    const s = svgEl('svg', {
      class: 'chart', viewBox: '0 0 ' + w + ' ' + h,
      width: '100%', height: 'auto', preserveAspectRatio: 'xMidYMid meet', role: 'img'
    });
    s.style.maxHeight = h + 'px';
    return s;
  }
  function txt(x, y, s, cls, anchor) {
    const t = svgEl('text', { x, y, class: cls || 'axis-t', 'text-anchor': anchor || 'middle' });
    t.textContent = s;
    return t;
  }
  function escala(min, max, altura, topo, base_) {
    const d = (max - min) || 1;
    return v => base_ - ((v - min) / d) * (base_ - topo);
  }
  /** Ticks "redondos" para o eixo Y. */
  function ticks(max, n) {
    n = n || 4;
    if (max <= 0) return [0, 1];
    const bruto = max / n;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const passo = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => x >= bruto) || mag * 10;
    const out = [];
    for (let v = 0; v <= max + passo * 0.001; v += passo) out.push(+v.toFixed(6));
    return out;
  }

  /* --------------------------- Tooltip --------------------------- */
  function comTooltip(wrap) {
    const tip = u.el('div', {
      style: {
        position: 'absolute', pointerEvents: 'none', opacity: '0',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)', boxShadow: 'var(--sh-lg)',
        padding: '8px 11px', fontSize: 'var(--fs-sm)', zIndex: '5',
        transition: 'opacity .12s ease', minWidth: '110px', lineHeight: '1.5'
      }
    });
    wrap.style.position = 'relative';
    wrap.appendChild(tip);
    return {
      mostrar(html, x, y) {
        tip.innerHTML = html;
        tip.style.opacity = '1';
        const lw = tip.offsetWidth, ww = wrap.clientWidth;
        tip.style.left = u.clamp(x - lw / 2, 4, Math.max(4, ww - lw - 4)) + 'px';
        tip.style.top = Math.max(2, y) + 'px';
      },
      esconder() { tip.style.opacity = '0'; }
    };
  }

  function legenda(series) {
    const box = u.el('div.chart-legend');
    series.forEach(s => box.appendChild(u.el('span.chart-legend__i', {}, [
      u.el('span.chart-legend__sw', { style: { background: s.cor } }),
      u.el('span', { text: s.label })
    ])));
    return box;
  }

  function vazio(msg) {
    return u.el('div.chart-empty', { text: msg || 'Sem dados suficientes para este gráfico ainda.' });
  }

  /* ====================================================================== */
  /*  LINHA — evolucao no tempo                                             */
  /*  cfg: { labels:[], series:[{label, valores:[], cor?}], altura, formatar,
  /*         area:true, minZero:true, maxSugerido }                          */
  /* ====================================================================== */
  G.linha = function (cfg) {
    const labels = cfg.labels || [];
    const series = (cfg.series || []).map((s, i) => Object.assign({ cor: G.cor(i) }, s));
    if (!labels.length || !series.length) return vazio(cfg.msgVazio);

    const W = 760, H = cfg.altura || 230;
    const ML = 46, MR = 14, MT = 14, MB = 28;
    const fmt = cfg.formatar || (v => u.fmtNum(v));

    const todos = series.reduce((a, s) => a.concat(s.valores.filter(v => v !== null && v !== undefined)), []);
    let max = Math.max.apply(null, todos.concat([cfg.maxSugerido || 0]));
    let min = cfg.minZero === false ? Math.min.apply(null, todos) : 0;
    if (max === min) max = min + 1;
    const tk = ticks(max, 4);
    max = Math.max(max, tk[tk.length - 1]);

    const y = escala(min, max, H, MT, H - MB);
    const passoX = labels.length > 1 ? (W - ML - MR) / (labels.length - 1) : 0;
    const x = i => ML + i * passoX + (labels.length === 1 ? (W - ML - MR) / 2 : 0);

    const wrap = u.el('div');
    const svg = base(W, H);

    /* grade + eixo Y */
    tk.forEach(v => {
      svg.appendChild(svgEl('line', { class: 'gridline', x1: ML, x2: W - MR, y1: y(v), y2: y(v) }));
      svg.appendChild(txt(ML - 8, y(v) + 3.5, fmt(v), 'axis-t', 'end'));
    });

    /* eixo X (rotulos espacados para nao colidir) */
    const passo = Math.max(1, Math.ceil(labels.length / 12));
    labels.forEach((l, i) => {
      if (i % passo !== 0 && i !== labels.length - 1) return;
      svg.appendChild(txt(x(i), H - MB + 17, l));
    });

    /* series */
    series.forEach((s, si) => {
      const pts = [];
      s.valores.forEach((v, i) => { if (v !== null && v !== undefined) pts.push([x(i), y(v), i, v]); });
      if (!pts.length) return;

      if (cfg.area !== false && series.length <= 2) {
        const gid = 'g' + si + '_' + Math.random().toString(36).slice(2, 7);
        const defs = svgEl('defs');
        const lg = svgEl('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' });
        lg.appendChild(svgEl('stop', { offset: '0%', 'stop-color': s.cor, 'stop-opacity': '.22' }));
        lg.appendChild(svgEl('stop', { offset: '100%', 'stop-color': s.cor, 'stop-opacity': '0' }));
        defs.appendChild(lg); svg.appendChild(defs);
        const dArea = 'M' + pts[0][0] + ' ' + (H - MB) + ' L' +
          pts.map(p => p[0] + ' ' + p[1]).join(' L') +
          ' L' + pts[pts.length - 1][0] + ' ' + (H - MB) + ' Z';
        svg.appendChild(svgEl('path', { d: dArea, fill: 'url(#' + gid + ')' }));
      }

      svg.appendChild(svgEl('path', {
        class: 'ln', d: 'M' + pts.map(p => p[0] + ' ' + p[1]).join(' L'),
        stroke: s.cor, 'stroke-width': 2
      }));

      const marcar = pts.length <= 14;
      pts.forEach(p => {
        if (!marcar && p[2] !== pts[pts.length - 1][2]) return;
        svg.appendChild(svgEl('circle', { class: 'pt', cx: p[0], cy: p[1], r: 4, fill: s.cor }));
      });
    });

    /* camada de hover */
    const cross = svgEl('line', { x1: 0, x2: 0, y1: MT, y2: H - MB, stroke: 'var(--border-strong)', 'stroke-width': 1, opacity: 0 });
    svg.appendChild(cross);
    const bolhas = series.map(s => {
      const c = svgEl('circle', { r: 5.5, fill: s.cor, stroke: 'var(--surface)', 'stroke-width': 2, opacity: 0 });
      svg.appendChild(c); return c;
    });
    const capa = svgEl('rect', { x: ML, y: MT, width: W - ML - MR, height: H - MT - MB, fill: 'transparent' });
    svg.appendChild(capa);

    wrap.appendChild(svg);
    const tip = comTooltip(wrap);

    capa.addEventListener('mousemove', ev => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      let i = passoX ? Math.round((px - ML) / passoX) : 0;
      i = u.clamp(i, 0, labels.length - 1);
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity', 1);
      let html = '<div style="font-weight:660;margin-bottom:4px">' + u.esc(labels[i]) + '</div>';
      series.forEach((s, si) => {
        const v = s.valores[i];
        if (v === null || v === undefined) { bolhas[si].setAttribute('opacity', 0); return; }
        bolhas[si].setAttribute('cx', x(i)); bolhas[si].setAttribute('cy', y(v)); bolhas[si].setAttribute('opacity', 1);
        html += '<div class="u-row u-gap-2"><span class="chart-legend__sw" style="background:' + s.cor +
          '"></span><span class="t-muted">' + u.esc(s.label) + '</span>' +
          '<b style="margin-left:auto">' + u.esc(fmt(v)) + '</b></div>';
      });
      const rw = wrap.getBoundingClientRect();
      tip.mostrar(html, ((x(i)) / W) * rw.width, 6);
    });
    capa.addEventListener('mouseleave', () => {
      cross.setAttribute('opacity', 0);
      bolhas.forEach(b => b.setAttribute('opacity', 0));
      tip.esconder();
    });

    if (series.length > 1) wrap.appendChild(legenda(series));
    return wrap;
  };

  /* ====================================================================== */
  /*  BARRAS EMPILHADAS / AGRUPADAS                                         */
  /*  cfg: { labels, series:[{label, valores, cor}], empilhado, altura }     */
  /* ====================================================================== */
  G.barras = function (cfg) {
    const labels = cfg.labels || [];
    const series = (cfg.series || []).map((s, i) => Object.assign({ cor: G.cor(i) }, s));
    if (!labels.length || !series.length) return vazio(cfg.msgVazio);

    const W = 760, H = cfg.altura || 230;
    const ML = 42, MR = 14, MT = 14, MB = 30;
    const fmt = cfg.formatar || (v => u.fmtNum(v));
    const empilhado = cfg.empilhado !== false;

    const totais = labels.map((_, i) =>
      empilhado ? u.sum(series, s => s.valores[i] || 0) : Math.max.apply(null, series.map(s => s.valores[i] || 0)));
    let max = Math.max.apply(null, totais.concat([1]));
    const tk = ticks(max, 4); max = tk[tk.length - 1];
    const y = escala(0, max, H, MT, H - MB);

    const larguraFaixa = (W - ML - MR) / labels.length;
    const larguraBarra = Math.max(3, Math.min(28, larguraFaixa * (empilhado ? 0.56 : 0.7 / series.length)));

    const wrap = u.el('div');
    const svg = base(W, H);
    tk.forEach(v => {
      svg.appendChild(svgEl('line', { class: 'gridline', x1: ML, x2: W - MR, y1: y(v), y2: y(v) }));
      svg.appendChild(txt(ML - 8, y(v) + 3.5, fmt(v), 'axis-t', 'end'));
    });

    const passoRot = Math.max(1, Math.ceil(labels.length / 14));
    labels.forEach((l, i) => {
      const cx = ML + larguraFaixa * (i + 0.5);
      if (i % passoRot === 0 || i === labels.length - 1) svg.appendChild(txt(cx, H - MB + 18, l));

      if (empilhado) {
        let acc = 0;
        series.forEach(s => {
          const v = s.valores[i] || 0;
          if (!v) return;
          const alt = Math.max(0, y(acc) - y(acc + v)) - 2;   /* 2px de respiro entre segmentos */
          if (alt <= 0) { acc += v; return; }
          svg.appendChild(svgEl('rect', {
            class: 'bar-r', x: cx - larguraBarra / 2, y: y(acc + v), width: larguraBarra,
            height: alt, rx: 4, fill: s.cor
          }));
          acc += v;
        });
      } else {
        series.forEach((s, si) => {
          const v = s.valores[i] || 0;
          const x0 = cx - (larguraBarra * series.length + 2 * (series.length - 1)) / 2 + si * (larguraBarra + 2);
          const alt = Math.max(0, (H - MB) - y(v));
          if (alt <= 0) return;
          svg.appendChild(svgEl('rect', {
            class: 'bar-r', x: x0, y: y(v), width: larguraBarra, height: alt, rx: 4, fill: s.cor
          }));
        });
      }
    });

    /* hover por faixa */
    const realce = svgEl('rect', { y: MT, height: H - MT - MB, fill: 'var(--text)', opacity: 0, rx: 6 });
    svg.appendChild(realce);
    const capa = svgEl('rect', { x: ML, y: MT, width: W - ML - MR, height: H - MT - MB, fill: 'transparent' });
    svg.appendChild(capa);
    wrap.appendChild(svg);
    const tip = comTooltip(wrap);

    capa.addEventListener('mousemove', ev => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const i = u.clamp(Math.floor((px - ML) / larguraFaixa), 0, labels.length - 1);
      realce.setAttribute('x', ML + larguraFaixa * i);
      realce.setAttribute('width', larguraFaixa);
      realce.setAttribute('opacity', .05);
      let html = '<div style="font-weight:660;margin-bottom:4px">' + u.esc(labels[i]) + '</div>';
      series.forEach(s => {
        html += '<div class="u-row u-gap-2"><span class="chart-legend__sw" style="background:' + s.cor +
          '"></span><span class="t-muted">' + u.esc(s.label) + '</span><b style="margin-left:auto">' +
          u.esc(fmt(s.valores[i] || 0)) + '</b></div>';
      });
      if (empilhado && series.length > 1) {
        html += '<div class="u-row u-gap-2" style="margin-top:4px;border-top:1px solid var(--border);padding-top:4px">' +
          '<span class="t-muted">Total</span><b style="margin-left:auto">' + u.esc(fmt(totais[i])) + '</b></div>';
      }
      const rw = wrap.getBoundingClientRect();
      tip.mostrar(html, ((ML + larguraFaixa * (i + 0.5)) / W) * rw.width, 6);
    });
    capa.addEventListener('mouseleave', () => { realce.setAttribute('opacity', 0); tip.esconder(); });

    if (series.length > 1) wrap.appendChild(legenda(series));
    return wrap;
  };

  /* ====================================================================== */
  /*  BARRAS HORIZONTAIS — ranking                                          */
  /*  cfg: { itens:[{label, valor, cor?, sub?}], formatar, maxLinhas }       */
  /* ====================================================================== */
  G.ranking = function (cfg) {
    const itens = (cfg.itens || []).slice(0, cfg.maxLinhas || 12);
    if (!itens.length) return vazio(cfg.msgVazio);
    const fmt = cfg.formatar || (v => u.fmtNum(v));
    const max = Math.max.apply(null, itens.map(i => Math.abs(i.valor)).concat([1]));

    const box = u.el('div.u-col.u-gap-3');
    itens.forEach((it, i) => {
      const pct = u.clamp((it.valor / max) * 100, 0, 100);
      box.appendChild(u.el('div', {}, [
        u.el('div.u-between.u-gap-3', {}, [
          u.el('div.u-row.u-gap-2.u-truncate', {}, [
            it.no ? u.el('span.t-xs.t-muted2.t-num', { text: (i + 1) + '.' }) : null,
            u.el('span.t-md.t-semi.u-truncate', { text: it.label })
          ]),
          u.el('span.t-sm.t-strong.t-num.u-nowrap', { text: fmt(it.valor) })
        ]),
        u.el('div.bar.u-mt-2', {}, [
          u.el('div.bar__fill', { style: { width: pct + '%', background: it.cor || G.cor(i) } })
        ]),
        it.sub ? u.el('div.t-xs.t-muted2', { style: { marginTop: '3px' }, text: it.sub }) : null
      ]));
    });
    return box;
  };

  /**
   * A paleta categorica tem 8 posicoes e nao pode ser reciclada: duas series
   * com a mesma cor sao indistinguiveis. Acima do limite, o excedente vira
   * uma unica fatia "Outros" (com o detalhe no rotulo).
   */
  G.dobrarEmOutros = function (itens, limite) {
    const max = limite || 8;
    if (itens.length <= max) return itens.slice();
    const ord = u.sortBy(itens, x => -x.valor);
    const principais = ord.slice(0, max - 1);
    const resto = ord.slice(max - 1);
    principais.push({
      label: 'Outros (' + resto.length + ' tipos)',
      emoji: '•',
      valor: u.sum(resto, x => x.valor),
      cor: 'var(--text-4)',
      detalhe: resto.map(x => x.label).join(', ')
    });
    return principais;
  };

  /* ====================================================================== */
  /*  DONUT — distribuicao                                                  */
  /*  cfg: { itens:[{label, valor, cor}], centroTitulo, centroValor }        */
  /* ====================================================================== */
  G.donut = function (cfg) {
    const itens = (cfg.itens || []).filter(i => i.valor > 0);
    if (!itens.length) return vazio(cfg.msgVazio);
    const total = u.sum(itens, i => i.valor);
    const W = 260, H = 260, R = 108, r = 68, cx = W / 2, cy = H / 2;

    const wrap = u.el('div', { style: { display: 'flex', gap: 'var(--sp-5)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' } });
    const svg = base(W, H);
    svg.style.maxWidth = '240px';

    let ang = -Math.PI / 2;
    const gap = itens.length > 1 ? 0.022 : 0;
    itens.forEach((it, i) => {
      const frac = it.valor / total;
      const a0 = ang + gap / 2, a1 = ang + frac * Math.PI * 2 - gap / 2;
      ang += frac * Math.PI * 2;
      if (a1 <= a0) return;
      const grande = (a1 - a0) > Math.PI ? 1 : 0;
      const p = [
        'M', cx + R * Math.cos(a0), cy + R * Math.sin(a0),
        'A', R, R, 0, grande, 1, cx + R * Math.cos(a1), cy + R * Math.sin(a1),
        'L', cx + r * Math.cos(a1), cy + r * Math.sin(a1),
        'A', r, r, 0, grande, 0, cx + r * Math.cos(a0), cy + r * Math.sin(a0), 'Z'
      ].join(' ');
      const path = svgEl('path', { d: p, fill: it.cor || G.cor(i), class: 'bar-r' });
      path.style.cursor = 'default';
      const t = svgEl('title');
      t.textContent = it.label + ': ' + it.valor + ' (' + u.fmtPct((it.valor / total) * 100) + ')' +
        (it.detalhe ? ' — ' + it.detalhe : '');
      path.appendChild(t);
      svg.appendChild(path);
    });

    const tCentro = txt(cx, cy - 2, String(cfg.centroValor !== undefined ? cfg.centroValor : total), 'val-t');
    tCentro.setAttribute('style', 'font-size:30px;font-weight:700;fill:var(--text)');
    svg.appendChild(tCentro);
    const sub = txt(cx, cy + 20, cfg.centroTitulo || 'registros', 'axis-t');
    svg.appendChild(sub);

    const leg = u.el('div.u-col.u-gap-2', { style: { minWidth: '170px', flex: '1 1 170px' } });
    itens.forEach((it, i) => {
      leg.appendChild(u.el('div.u-row.u-gap-2', {}, [
        u.el('span.chart-legend__sw', { style: { background: it.cor || G.cor(i) } }),
        u.el('span.t-sm.u-grow.u-truncate', { text: (it.emoji ? it.emoji + ' ' : '') + it.label }),
        u.el('span.t-sm.t-strong.t-num', { text: it.valor }),
        u.el('span.t-xs.t-muted2.t-num', { text: u.fmtPct((it.valor / total) * 100) })
      ]));
    });

    wrap.appendChild(svg); wrap.appendChild(leg);
    return wrap;
  };

  /* ====================================================================== */
  /*  RADAR — competencias                                                  */
  /*  cfg: { eixos:[label], series:[{label, valores, cor}], max:5 }          */
  /* ====================================================================== */
  G.radar = function (cfg) {
    const eixos = cfg.eixos || [];
    const series = (cfg.series || []).map((s, i) => Object.assign({ cor: G.cor(i) }, s));
    if (eixos.length < 3 || !series.length) return vazio(cfg.msgVazio);

    const W = 460, H = 400, cx = W / 2, cy = H / 2 + 4, R = 132, max = cfg.max || 5;
    const wrap = u.el('div');
    const svg = base(W, H);

    const ponto = (i, v) => {
      const a = -Math.PI / 2 + (i / eixos.length) * Math.PI * 2;
      const raio = (v / max) * R;
      return [cx + raio * Math.cos(a), cy + raio * Math.sin(a)];
    };

    /* teias */
    for (let n = 1; n <= max; n++) {
      const d = eixos.map((_, i) => ponto(i, n).join(' ')).join(' L');
      svg.appendChild(svgEl('path', { class: 'radar-grid', d: 'M' + d + ' Z' }));
    }
    /* raios + rotulos */
    eixos.forEach((lb, i) => {
      const p = ponto(i, max);
      svg.appendChild(svgEl('line', { class: 'radar-grid', x1: cx, y1: cy, x2: p[0], y2: p[1] }));
      const pl = ponto(i, max + 0.72);
      const anchor = pl[0] > cx + 8 ? 'start' : pl[0] < cx - 8 ? 'end' : 'middle';
      const t = txt(pl[0], pl[1] + 4, lb, 'axis-t', anchor);
      svg.appendChild(t);
    });

    series.forEach(s => {
      const pts = eixos.map((_, i) => ponto(i, s.valores[i] || 0));
      const d = 'M' + pts.map(p => p.join(' ')).join(' L') + ' Z';
      svg.appendChild(svgEl('path', { d, fill: s.cor, 'fill-opacity': series.length > 1 ? .16 : .2, stroke: s.cor, class: 'radar-area' }));
      pts.forEach((p, i) => {
        const c = svgEl('circle', { cx: p[0], cy: p[1], r: 4, fill: s.cor, stroke: 'var(--surface)', 'stroke-width': 2 });
        const t = svgEl('title'); t.textContent = eixos[i] + ' · ' + s.label + ': ' + (s.valores[i] || '—') + '/' + max;
        c.appendChild(t); svg.appendChild(c);
      });
    });

    wrap.appendChild(svg);
    if (series.length > 1) wrap.appendChild(legenda(series));
    return wrap;
  };

  /* ====================================================================== */
  /*  SPARKLINE                                                             */
  /* ====================================================================== */
  G.spark = function (valores, cor, altura) {
    const v = (valores || []).filter(x => x !== null && x !== undefined);
    if (v.length < 2) return u.el('span');
    const W = 120, H = altura || 30;
    const max = Math.max.apply(null, v), min = Math.min.apply(null, v);
    const y = escala(min, max, H, 3, H - 3);
    const x = i => (i / (v.length - 1)) * W;
    const svg = base(W, H);
    svg.style.maxWidth = W + 'px';
    svg.appendChild(svgEl('path', {
      d: 'M' + v.map((val, i) => x(i) + ' ' + y(val)).join(' L'),
      fill: 'none', stroke: cor || G.cor(0), 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));
    svg.appendChild(svgEl('circle', { cx: x(v.length - 1), cy: y(v[v.length - 1]), r: 3, fill: cor || G.cor(0) }));
    return svg;
  };

  /* ====================================================================== */
  /*  TABELA equivalente (acessibilidade / leitura exata)                    */
  /* ====================================================================== */
  G.tabela = function (labels, series, formatar) {
    const fmt = formatar || (v => u.fmtNum(v));
    const t = u.el('table.tbl');
    const thead = u.el('thead', {}, [u.el('tr', {}, [u.el('th', { text: '' })].concat(
      series.map(s => u.el('th', { class: 'u-right', text: s.label }))))]);
    const tb = u.el('tbody');
    labels.forEach((l, i) => {
      tb.appendChild(u.el('tr', {}, [u.el('td', { class: 't-semi', text: l })].concat(
        series.map(s => u.el('td', { class: 'u-right t-num', text: fmt(s.valores[i] || 0) })))));
    });
    t.appendChild(thead); t.appendChild(tb);
    return u.el('div.tbl-wrap', {}, [t]);
  };

  /** Card de grafico com alternancia Gráfico / Tabela. */
  G.card = function (cfg) {
    const corpo = u.el('div');
    let modo = 'grafico';
    function pintar() {
      u.clear(corpo);
      corpo.appendChild(modo === 'grafico' ? cfg.grafico() : cfg.tabela());
    }
    const alternar = cfg.tabela ? u.el('div.seg', {}, [
      u.el('button.seg__btn.is-on', { type: 'button', text: 'Gráfico' }),
      u.el('button.seg__btn', { type: 'button', text: 'Tabela' })
    ]) : null;
    if (alternar) {
      u.$$('.seg__btn', alternar).forEach((b, i) => b.addEventListener('click', () => {
        modo = i === 0 ? 'grafico' : 'tabela';
        u.$$('.seg__btn', alternar).forEach((x, j) => x.classList.toggle('is-on', j === i));
        pintar();
      }));
    }
    pintar();
    return u.el('div.card', {}, [
      u.el('div.card__head', {}, [
        u.el('div', {}, [
          u.el('div.card__title', { text: cfg.titulo }),
          cfg.desc ? u.el('div.t-sm.t-muted', { text: cfg.desc }) : null
        ]),
        alternar
      ]),
      u.el('div.card__body', {}, [corpo])
    ]);
  };

  App.g = G;

  /* redesenha graficos ao trocar de tema */
  App.bus.on('tema:mudou', () => App.bus.emit('tela:repintar'));
})(window.App);
