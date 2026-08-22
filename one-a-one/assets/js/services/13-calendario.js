/* =========================================================================
   services/13-calendario.js — Dias úteis, feriados e agendamento.

   Regra do produto: NENHUM One a One calculado pelo sistema cai em fim de
   semana ou feriado. Data escolhida à mão pelo coordenador é sempre
   respeitada — o app só avisa que o dia não é útil e oferece o ajuste.

   Feriados nacionais fixos + móveis (derivados da Páscoa) são calculados
   para qualquer ano. Feriados locais ficam em config('feriados').
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u;
  const C = {};

  /* ------------------------------------------------------------------ */
  /*  Feriados nacionais                                                */
  /* ------------------------------------------------------------------ */
  const FIXOS = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['11-20', 'Consciência Negra'],
    ['12-25', 'Natal']
  ];

  /** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
  C.pascoa = function (ano) {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia);
  };

  const cacheAno = {};

  /** Mapa { 'YYYY-MM-DD': 'Nome do feriado' } do ano informado. */
  C.feriadosDoAno = function (ano) {
    if (cacheAno[ano]) return cacheAno[ano];
    const mapa = {};
    FIXOS.forEach(([md, nome]) => { mapa[ano + '-' + md] = nome; });

    const pascoa = C.pascoa(ano);
    const mover = (dias, nome) => { mapa[u.toISODate(u.addDays(pascoa, dias))] = nome; };
    mover(-48, 'Carnaval');
    mover(-47, 'Carnaval');
    mover(-46, 'Quarta-feira de Cinzas');
    mover(-2,  'Sexta-feira Santa');
    mover(60,  'Corpus Christi');

    cacheAno[ano] = mapa;
    return mapa;
  };

  /** Feriados locais cadastrados pelo coordenador. */
  C.feriadosLocais = function () {
    const lista = App.db.config.get('feriados', []) || [];
    return Array.isArray(lista) ? lista : [];
  };

  C.adicionarFeriadoLocal = function (data, nome) {
    const lista = C.feriadosLocais().slice();
    const iso = u.toISODate(data);
    if (lista.some(f => f.data === iso)) return Promise.resolve(false);
    lista.push({ data: iso, nome: (nome || 'Feriado local').trim() });
    return App.db.config.set('feriados', u.sortBy(lista, f => f.data)).then(() => true);
  };

  C.removerFeriadoLocal = function (data) {
    const iso = u.toISODate(data);
    return App.db.config.set('feriados', C.feriadosLocais().filter(f => f.data !== iso)).then(() => true);
  };

  /* ------------------------------------------------------------------ */
  /*  Consultas                                                         */
  /* ------------------------------------------------------------------ */
  C.ehFimDeSemana = function (d) {
    const x = u.parseDate(d);
    if (!x) return false;
    const dia = x.getDay();
    return dia === 0 || dia === 6;
  };

  /** Nome do feriado nessa data, ou null. */
  C.feriado = function (d) {
    const x = u.parseDate(d);
    if (!x) return null;
    const iso = u.toISODate(x);
    const local = C.feriadosLocais().find(f => f.data === iso);
    if (local) return local.nome;
    return C.feriadosDoAno(x.getFullYear())[iso] || null;
  };

  C.ehUtil = function (d) {
    const x = u.parseDate(d);
    if (!x) return false;
    return !C.ehFimDeSemana(x) && !C.feriado(x);
  };

  /** Por que a data não serve: 'Sábado', 'Domingo' ou o nome do feriado. */
  C.motivo = function (d) {
    const x = u.parseDate(d);
    if (!x) return null;
    const f = C.feriado(x);
    if (f) return f;
    const dia = x.getDay();
    if (dia === 0) return 'Domingo';
    if (dia === 6) return 'Sábado';
    return null;
  };

  /* ------------------------------------------------------------------ */
  /*  Ajuste de datas                                                   */
  /* ------------------------------------------------------------------ */
  /** Primeiro dia útil a partir da data (a própria data, se já for útil). */
  C.proximoUtil = function (d) {
    let x = u.startOfDay(d);
    for (let i = 0; i < 30 && !C.ehUtil(x); i++) x = u.addDays(x, 1);
    return x;
  };

  /** Último dia útil até a data (a própria data, se já for útil). */
  C.utilAnterior = function (d) {
    let x = u.startOfDay(d);
    for (let i = 0; i < 30 && !C.ehUtil(x); i++) x = u.addDays(x, -1);
    return x;
  };

  /**
   * Agendamento automático: soma os dias corridos da frequência e desloca
   * para o dia útil mais próximo. Devolve SEMPRE 'YYYY-MM-DD'.
   */
  C.agendar = function (base, dias) {
    return u.toISODate(C.proximoUtil(u.addDays(base || new Date(), dias || 0)));
  };

  /** Dias úteis (exclusivos) entre duas datas — usado nos textos de apoio. */
  C.diasUteisEntre = function (de, ate) {
    let x = u.addDays(de, 1);
    const fim = u.startOfDay(ate);
    let n = 0;
    while (x <= fim && n < 400) { if (C.ehUtil(x)) n++; x = u.addDays(x, 1); }
    return n;
  };

  /** Próximos feriados a partir de hoje (para a tela de configurações). */
  C.proximosFeriados = function (limite) {
    const hoje = u.startOfDay(new Date());
    const anos = [hoje.getFullYear(), hoje.getFullYear() + 1];
    let lista = [];
    anos.forEach(ano => {
      const m = C.feriadosDoAno(ano);
      Object.keys(m).forEach(data => lista.push({ data, nome: m[data], tipo: 'nacional' }));
    });
    C.feriadosLocais().forEach(f => lista.push({ data: f.data, nome: f.nome, tipo: 'local' }));
    lista = u.sortBy(lista.filter(f => u.parseDate(f.data) >= hoje), f => f.data);
    return limite ? lista.slice(0, limite) : lista;
  };

  App.cal = C;
})(window.App);
