/* ═══════════════════════════════════════════════════════════════════
   REGISTRO INICIAL · Treinamentos / Apresentações
   ───────────────────────────────────────────────────────────────────
   Estado inicial respeitado: só os conteúdos que VOCÊ adicionar
   explicitamente. Nenhum seed automático além do que está aqui.

   Atualmente: 1 entrada (Treinamento Método CIS), importada do
   diretório treinamento-cis/ via Caminho B (importar HTML existente).

   COMO ADICIONAR MAIS CONTEÚDOS:
   - Pela UI (recomendado): "+ Adicionar conteúdo" → Caminho A (Claude)
     ou Caminho B (importar pasta/arquivo HTML).
   - Manualmente: acrescente um objeto no array TRAP_REGISTRO abaixo.

   FORMATO DO OBJETO:
     id          : slug único e imutável
     titulo      : nome exibido no card
     descricao   : 1-2 frases pra listagem
     produto     : agrupador (filtro)
     tipo        : 'treinamento' | 'apresentacao'
     status      : 'publicado' | 'oculto'
     novo        : true | false (badge "✨ Novo")
     ordem       : número menor aparece primeiro
     url         : caminho do HTML standalone (capa/entry point)
     icone       : emoji do card
     origem      : 'claude' | 'html-existente'  (procedência)
     estrutura   : (opcional) sub-itens — útil pra treinamentos
                   multi-arquivo. Cada item: {titulo, url, tipo}.

   PERSISTÊNCIA:
   - Edições via UI (publicar/ocultar/marcar novo/reordenar) são
     gravadas em Firebase em treinamentos/overrides/{id} e
     sobrescrevem os defaults daqui na renderização.
   - Adições novas via "+ Adicionar conteúdo" são gravadas em
     Firebase em treinamentos/adicionados/{id}.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  window.TRAP_REGISTRO = [
    {
      id: 'treinamento-cis',
      titulo: 'Treinamento Método CIS',
      descricao: 'Treinamento completo do Método CIS para consultores e equipe interna. 7 HTMLs standalone importados de treinamento-cis/.',
      produto: 'CIS',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 10,
      url: 'treinamento-cis/index.html',
      icone: '🎓',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                       url: 'treinamento-cis/index.html',       tipo: 'index'  },
        { titulo: 'Módulo 1 — Produto (Método CIS)',     url: 'treinamento-cis/modulo-1.html',    tipo: 'modulo' },
        { titulo: 'Módulo 2 — Prospecção e Qualificação', url: 'treinamento-cis/modulo-2.html',    tipo: 'modulo' },
        { titulo: 'Módulo 3 — Apresentação e Proposta',  url: 'treinamento-cis/modulo-3.html',    tipo: 'modulo' },
        { titulo: 'Módulo 4 — Negociação e Objeções',    url: 'treinamento-cis/modulo-4.html',    tipo: 'modulo' },
        { titulo: 'SPIN Selling para Closer',            url: 'treinamento-cis/spin-closer.html', tipo: 'extra'  },
        { titulo: 'Fechamento · Scripts, Narrativas e Roteiros', url: 'treinamento-cis/fechamento.html', tipo: 'final' }
      ]
    },
    {
      id: 'treinamento-fgpc',
      titulo: 'Treinamento Comercial FGPC',
      descricao: 'Formação em Gestão de Pessoas com Perfil Comportamental — treinamento comercial para a equipe vender o FGPC. 7 HTMLs: índice + 4 módulos + SPIN Selling + Fechamento (115 slides).',
      produto: 'FGPC',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 20,
      url: 'treinamento-fgpc/index.html',
      icone: '🧭',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                        url: 'treinamento-fgpc/index.html',        tipo: 'index'  },
        { titulo: 'Módulo 1 — Produto (FGPC)',            url: 'treinamento-fgpc/modulo-1.html',     tipo: 'modulo' },
        { titulo: 'Módulo 2 — Prospecção e Qualificação', url: 'treinamento-fgpc/modulo-2.html',     tipo: 'modulo' },
        { titulo: 'Módulo 3 — Apresentação e Proposta',   url: 'treinamento-fgpc/modulo-3.html',     tipo: 'modulo' },
        { titulo: 'Módulo 4 — Negociação e Objeções',     url: 'treinamento-fgpc/modulo-4.html',     tipo: 'modulo' },
        { titulo: 'SPIN Selling — aplicado ao FGPC',      url: 'treinamento-fgpc/spin-selling.html', tipo: 'extra'  },
        { titulo: 'Fechamento · Scripts e Roteiros',      url: 'treinamento-fgpc/fechamento.html',   tipo: 'final' }
      ]
    },
    {
      id: 'treinamento-ml5',
      titulo: 'Treinamento Comercial ML5',
      descricao: 'ML5 — Formação de Líderes (Líderes Nível 5 de Jim Collins, alta performance e mentalidade empresarial) — treinamento comercial para a equipe vender o ML5. 7 HTMLs: índice + 4 módulos + SPIN Selling + Fechamento (115 slides). Inclui a versão ⚡ Essencial (33 slides, com modo treinador de duas telas), acessível pelo índice do próprio ML5.',
      produto: 'ML5',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 30,
      url: 'treinamento-ml5/index.html',
      icone: '👑',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                        url: 'treinamento-ml5/index.html',         tipo: 'index'  },
        /* Versão condensada: mora em pasta irmã, mas é parte do ML5 —
           não vira card próprio no catálogo, só aparece aqui e no índice. */
        { titulo: '⚡ ML5 Essencial (33 slides)',          url: 'treinamento-ml5-essencial/index.html', tipo: 'extra' },
        { titulo: 'Módulo 1 — Produto (ML5)',             url: 'treinamento-ml5/modulo-1.html',      tipo: 'modulo' },
        { titulo: 'Módulo 2 — Prospecção e Qualificação', url: 'treinamento-ml5/modulo-2.html',      tipo: 'modulo' },
        { titulo: 'Módulo 3 — Apresentação e Proposta',   url: 'treinamento-ml5/modulo-3.html',      tipo: 'modulo' },
        { titulo: 'Módulo 4 — Negociação e Objeções',     url: 'treinamento-ml5/modulo-4.html',      tipo: 'modulo' },
        { titulo: 'SPIN Selling — aplicado ao ML5',       url: 'treinamento-ml5/spin-selling.html',  tipo: 'extra'  },
        { titulo: 'Fechamento · Scripts e Roteiros',      url: 'treinamento-ml5/fechamento.html',    tipo: 'final' }
      ]
    },
    {
      id: 'treinamento-maestria',
      titulo: 'Treinamento Comercial MAESTRIA',
      descricao: 'Maestria Global Business — mastermind oficial Febracis (12 meses de mentoria premium com Paulo Vieira, imersões no Brasil e exterior, ecossistema contínuo de desenvolvimento empresarial) — treinamento comercial para a equipe vender a Maestria. 7 HTMLs: índice + 4 módulos + SPIN Selling + Fechamento (115 slides).',
      produto: 'MAESTRIA',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 20,
      url: 'treinamento-maestria/index.html',
      icone: '💎',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                        url: 'treinamento-maestria/index.html',        tipo: 'index'  },
        { titulo: 'Módulo 1 — Produto (Maestria)',        url: 'treinamento-maestria/modulo-1.html',     tipo: 'modulo' },
        { titulo: 'Módulo 2 — Prospecção e Qualificação', url: 'treinamento-maestria/modulo-2.html',     tipo: 'modulo' },
        { titulo: 'Módulo 3 — Apresentação e Proposta',   url: 'treinamento-maestria/modulo-3.html',     tipo: 'modulo' },
        { titulo: 'Módulo 4 — Negociação e Objeções',     url: 'treinamento-maestria/modulo-4.html',     tipo: 'modulo' },
        { titulo: 'SPIN Selling — aplicado à Maestria',   url: 'treinamento-maestria/spin-selling.html', tipo: 'extra'  },
        { titulo: 'Fechamento · Scripts e Roteiros',      url: 'treinamento-maestria/fechamento.html',   tipo: 'final' }
      ]
    },
    {
      id: 'treinamento-if',
      titulo: 'Treinamento Comercial IF',
      descricao: 'Inteligência Financeira — treinamento comercial para a equipe vender o IF. 7 HTMLs: índice + 4 módulos + SPIN Selling + Fechamento (115 slides).',
      produto: 'IF',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 21,
      url: 'treinamento-if/index.html',
      icone: '💰',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                        url: 'treinamento-if/index.html',        tipo: 'index'  },
        { titulo: 'Módulo 1 — Produto (IF)',              url: 'treinamento-if/modulo-1.html',     tipo: 'modulo' },
        { titulo: 'Módulo 2 — Prospecção e Qualificação', url: 'treinamento-if/modulo-2.html',     tipo: 'modulo' },
        { titulo: 'Módulo 3 — Apresentação e Proposta',   url: 'treinamento-if/modulo-3.html',     tipo: 'modulo' },
        { titulo: 'Módulo 4 — Negociação e Objeções',     url: 'treinamento-if/modulo-4.html',     tipo: 'modulo' },
        { titulo: 'SPIN Selling — aplicado ao IF',        url: 'treinamento-if/spin-selling.html', tipo: 'extra'  },
        { titulo: 'Fechamento · Scripts e Roteiros',      url: 'treinamento-if/fechamento.html',   tipo: 'final' }
      ]
    },
    {
      id: 'treinamento-bhp',
      titulo: 'Treinamento Comercial BHP',
      descricao: 'BHP — Gestão de Negócios — treinamento comercial para a equipe vender o BHP (programa empresarial presencial, 4 dias/40h). 7 HTMLs: índice + 4 módulos + SPIN Selling + Fechamento (115 slides).',
      produto: 'BHP',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 21,
      url: 'treinamento-bhp/index.html',
      icone: '📈',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                        url: 'treinamento-bhp/index.html',        tipo: 'index'  },
        { titulo: 'Módulo 1 — Produto (BHP)',             url: 'treinamento-bhp/modulo-1.html',     tipo: 'modulo' },
        { titulo: 'Módulo 2 — Prospecção e Qualificação', url: 'treinamento-bhp/modulo-2.html',     tipo: 'modulo' },
        { titulo: 'Módulo 3 — Apresentação e Proposta',   url: 'treinamento-bhp/modulo-3.html',     tipo: 'modulo' },
        { titulo: 'Módulo 4 — Negociação e Objeções',     url: 'treinamento-bhp/modulo-4.html',     tipo: 'modulo' },
        { titulo: 'SPIN Selling — aplicado ao BHP',       url: 'treinamento-bhp/spin-selling.html', tipo: 'extra'  },
        { titulo: 'Fechamento · Scripts e Roteiros',      url: 'treinamento-bhp/fechamento.html',   tipo: 'final' }
      ]
    },
    {
      id: 'treinamento-ceop',
      titulo: 'Treinamento Comercial CEOP',
      descricao: 'Comunicação Eficaz e Oratória Persuasiva — treinamento comercial para a equipe vender o CEOP. 7 HTMLs: índice + 4 módulos + SPIN Selling + Fechamento (115 slides).',
      produto: 'CEOP',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 30,
      url: 'treinamento-ceop/index.html',
      icone: '🎤',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                        url: 'treinamento-ceop/index.html',        tipo: 'index'  },
        { titulo: 'Módulo 1 — Produto (CEOP)',            url: 'treinamento-ceop/modulo-1.html',     tipo: 'modulo' },
        { titulo: 'Módulo 2 — Prospecção e Qualificação', url: 'treinamento-ceop/modulo-2.html',     tipo: 'modulo' },
        { titulo: 'Módulo 3 — Apresentação e Proposta',   url: 'treinamento-ceop/modulo-3.html',     tipo: 'modulo' },
        { titulo: 'Módulo 4 — Negociação e Objeções',     url: 'treinamento-ceop/modulo-4.html',     tipo: 'modulo' },
        { titulo: 'SPIN Selling — aplicado ao CEOP',      url: 'treinamento-ceop/spin-selling.html', tipo: 'extra'  },
        { titulo: 'Fechamento · Scripts e Roteiros',      url: 'treinamento-ceop/fechamento.html',   tipo: 'final' }
      ]
    },
    {
      id: 'treinamento-tav',
      titulo: 'Treinamento Comercial TAV',
      descricao: 'Técnicas Avançadas de Vendas — treinamento comercial para a equipe vender o TAV. 7 HTMLs: índice + 4 módulos + SPIN Selling + Fechamento (115 slides).',
      produto: 'TAV',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 40,
      url: 'treinamento-tav/index.html',
      icone: '🚀',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                        url: 'treinamento-tav/index.html',        tipo: 'index'  },
        { titulo: 'Módulo 1 — Produto (TAV)',             url: 'treinamento-tav/modulo-1.html',     tipo: 'modulo' },
        { titulo: 'Módulo 2 — Prospecção e Qualificação', url: 'treinamento-tav/modulo-2.html',     tipo: 'modulo' },
        { titulo: 'Módulo 3 — Apresentação e Proposta',   url: 'treinamento-tav/modulo-3.html',     tipo: 'modulo' },
        { titulo: 'Módulo 4 — Negociação e Objeções',     url: 'treinamento-tav/modulo-4.html',     tipo: 'modulo' },
        { titulo: 'SPIN Selling — aplicado ao TAV',       url: 'treinamento-tav/spin-selling.html', tipo: 'extra'  },
        { titulo: 'Fechamento · Scripts e Roteiros',      url: 'treinamento-tav/fechamento.html',   tipo: 'final' }
      ]
    },
    {
      id: 'treinamento-master-coaching',
      titulo: 'Treinamento Comercial Master Coaching',
      descricao: 'Master Coaching — a jornada definitiva do coach formado pela Febracis (CIS). Treinamento comercial para a equipe vender o Master Coaching. 7 HTMLs: índice + 4 módulos + SPIN Selling + Fechamento (115 slides).',
      produto: 'Master Coaching',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 50,
      url: 'treinamento-master-coaching/index.html',
      icone: '🏆',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                            url: 'treinamento-master-coaching/index.html',        tipo: 'index'  },
        { titulo: 'Módulo 1 — Produto (Master Coaching)',     url: 'treinamento-master-coaching/modulo-1.html',     tipo: 'modulo' },
        { titulo: 'Módulo 2 — Prospecção e Qualificação',     url: 'treinamento-master-coaching/modulo-2.html',     tipo: 'modulo' },
        { titulo: 'Módulo 3 — Apresentação e Proposta',       url: 'treinamento-master-coaching/modulo-3.html',     tipo: 'modulo' },
        { titulo: 'Módulo 4 — Negociação e Objeções',         url: 'treinamento-master-coaching/modulo-4.html',     tipo: 'modulo' },
        { titulo: 'SPIN Selling — aplicado ao Master Coaching', url: 'treinamento-master-coaching/spin-selling.html', tipo: 'extra'  },
        { titulo: 'Fechamento · Scripts e Roteiros',          url: 'treinamento-master-coaching/fechamento.html',   tipo: 'final' }
      ]
    },
    {
      id: 'treinamento-rac',
      titulo: 'Treinamento Comercial RAC',
      descricao: 'Reunião de Alta Conversão — método de condução da reunião de vendas consultiva. Não é sobre um produto: vale para todo o portfólio. 7 HTMLs: índice + 4 módulos + SPIN Selling + Fechamento (115 slides).',
      produto: 'RAC',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 1,
      url: 'treinamento-rac/index.html',
      icone: '🎯',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                          url: 'treinamento-rac/index.html',        tipo: 'index'  },
        { titulo: 'Módulo 1 — O Método (RAC)',              url: 'treinamento-rac/modulo-1.html',     tipo: 'modulo' },
        { titulo: 'Módulo 2 — Abertura e Controle',         url: 'treinamento-rac/modulo-2.html',     tipo: 'modulo' },
        { titulo: 'Módulo 3 — Diagnóstico',                 url: 'treinamento-rac/modulo-3.html',     tipo: 'modulo' },
        { titulo: 'Módulo 4 — Pit 01 e Objeções',           url: 'treinamento-rac/modulo-4.html',     tipo: 'modulo' },
        { titulo: 'SPIN Selling — aplicado ao método',      url: 'treinamento-rac/spin-selling.html', tipo: 'extra'  },
        { titulo: 'Fechamento · Pit 02, Pix e Follow-up',   url: 'treinamento-rac/fechamento.html',   tipo: 'final' }
      ]
    },
    {
      id: 'treinamento-fcis',
      titulo: 'Treinamento Comercial FCIS',
      descricao: 'Formação em Coaching Integral Sistêmico (certificação internacional FCU) — treinamento comercial para a equipe vender o FCIS. 7 HTMLs: índice + 4 módulos + SPIN Selling + Fechamento (115 slides).',
      produto: 'FCIS',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 25,
      url: 'treinamento-fcis/index.html',
      icone: '🧠',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                        url: 'treinamento-fcis/index.html',        tipo: 'index'  },
        { titulo: 'Módulo 1 — Produto (FCIS)',            url: 'treinamento-fcis/modulo-1.html',     tipo: 'modulo' },
        { titulo: 'Módulo 2 — Prospecção e Qualificação', url: 'treinamento-fcis/modulo-2.html',     tipo: 'modulo' },
        { titulo: 'Módulo 3 — Apresentação e Proposta',   url: 'treinamento-fcis/modulo-3.html',     tipo: 'modulo' },
        { titulo: 'Módulo 4 — Negociação e Objeções',     url: 'treinamento-fcis/modulo-4.html',     tipo: 'modulo' },
        { titulo: 'SPIN Selling — aplicado ao FCIS',      url: 'treinamento-fcis/spin-selling.html', tipo: 'extra'  },
        { titulo: 'Fechamento · Scripts e Roteiros',      url: 'treinamento-fcis/fechamento.html',   tipo: 'final' }
      ]
    },
    {
      id: 'treinamento-tce',
      titulo: 'Treinamento Comercial TCE',
      descricao: 'Tour Crescimento Empresarial — imersão de 1 dia com Paulo Vieira. Treinamento comercial para a equipe vender o TCE. 7 HTMLs: índice + 4 módulos + SPIN Selling + Fechamento (115 slides).',
      produto: 'TCE',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 15,
      url: 'treinamento-tce/index.html',
      icone: '🌱',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                        url: 'treinamento-tce/index.html',        tipo: 'index'  },
        { titulo: 'Módulo 1 — Produto (TCE)',             url: 'treinamento-tce/modulo-1.html',     tipo: 'modulo' },
        { titulo: 'Módulo 2 — Prospecção e Qualificação', url: 'treinamento-tce/modulo-2.html',     tipo: 'modulo' },
        { titulo: 'Módulo 3 — Apresentação e Proposta',   url: 'treinamento-tce/modulo-3.html',     tipo: 'modulo' },
        { titulo: 'Módulo 4 — Negociação e Objeções',     url: 'treinamento-tce/modulo-4.html',     tipo: 'modulo' },
        { titulo: 'SPIN Selling — aplicado ao TCE',       url: 'treinamento-tce/spin-selling.html', tipo: 'extra'  },
        { titulo: 'Fechamento · Scripts e Roteiros',      url: 'treinamento-tce/fechamento.html',   tipo: 'final' }
      ]
    },
    {
      id: 'treinamento-alinhamento',
      titulo: 'Alinhamento Inicial — Equipe Comercial',
      descricao: 'Onboarding da equipe comercial Febracis. Propósito, 10 Pilares, Rotina, Postura, Padrões Comerciais e SPIN, e Compromisso bilateral. 7 HTMLs: índice + 4 módulos + Padrões Comerciais + Encerramento (115 slides).',
      produto: 'Alinhamento',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 16,
      url: 'treinamento-alinhamento/index.html',
      icone: '🤝',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                          url: 'treinamento-alinhamento/index.html',        tipo: 'index'  },
        { titulo: 'Módulo 1 — Propósito e Mentalidade',     url: 'treinamento-alinhamento/modulo-1.html',     tipo: 'modulo' },
        { titulo: 'Módulo 2 — Os 10 Pilares da Excelência', url: 'treinamento-alinhamento/modulo-2.html',     tipo: 'modulo' },
        { titulo: 'Módulo 3 — Rotina, Resultado e Execução',url: 'treinamento-alinhamento/modulo-3.html',     tipo: 'modulo' },
        { titulo: 'Módulo 4 — Postura, Hierarquia e Liderança', url: 'treinamento-alinhamento/modulo-4.html', tipo: 'modulo' },
        { titulo: 'Padrões Comerciais e SPIN Selling',      url: 'treinamento-alinhamento/spin-selling.html', tipo: 'extra'  },
        { titulo: 'Meu Compromisso com Você',               url: 'treinamento-alinhamento/fechamento.html',   tipo: 'final'  }
      ]
    },
    {
      id: 'treinamento-ggb',
      titulo: 'Green Golden Belt — GGB',
      descricao: 'Treinamento comercial da TRILHA COMPLETA Green Golden Belt — argumento de venda da jornada Febracis inteira (CIS → FCIS → FGPC → BHP → ML5 → IF → TAV → CEOP → Master Coaching). Padrão FGPC. 8 HTMLs: índice + 4 módulos + SPIN + Fechamento + Módulo Especial "A Jornada GGB".',
      produto: 'GGB',
      tipo: 'treinamento',
      status: 'publicado',
      novo: true,
      ordem: 17,
      url: 'treinamento-ggb/index.html',
      icone: '🥋',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Capa / Índice',                          url: 'treinamento-ggb/index.html',        tipo: 'index'  },
        { titulo: 'Módulo 1 — O Produto: a Trilha GGB',     url: 'treinamento-ggb/modulo-1.html',     tipo: 'modulo' },
        { titulo: 'Módulo 2 — Prospecção e Qualificação',   url: 'treinamento-ggb/modulo-2.html',     tipo: 'modulo' },
        { titulo: 'Módulo 3 — Apresentação e Proposta',     url: 'treinamento-ggb/modulo-3.html',     tipo: 'modulo' },
        { titulo: 'Módulo 4 — Negociação e Objeções',       url: 'treinamento-ggb/modulo-4.html',     tipo: 'modulo' },
        { titulo: 'SPIN Selling — aplicado ao GGB',         url: 'treinamento-ggb/spin-selling.html', tipo: 'extra'  },
        { titulo: 'Fechamento · Scripts e Roteiros',        url: 'treinamento-ggb/fechamento.html',   tipo: 'final'  },
        { titulo: 'Módulo Especial — A Jornada GGB',        url: 'treinamento-ggb/jornada.html',      tipo: 'extra'  }
      ]
    },
    {
      id: 'apresentacao-ggb',
      titulo: 'Green Golden Belt — Apresentação Comercial',
      descricao: 'Apresentação de vendas CLIENTE-FINAL da trilha Green Golden Belt — deck premium (navy + dourado) para o consultor projetar e conduzir a conversa de venda. 16 slides: abertura, dor, solução, jornada das 9 etapas, prova, autoridade, investimento, garantia e CTA.',
      produto: 'GGB',
      tipo: 'apresentacao',
      status: 'publicado',
      novo: true,
      ordem: 18,
      url: 'apresentacao-ggb/index.html',
      icone: '🎯',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Apresentação Comercial GGB', url: 'apresentacao-ggb/index.html', tipo: 'index' }
      ]
    },
    {
      id: 'ring-treino-comercial',
      titulo: 'Ring — Treino com Clientes Difíceis',
      descricao: 'Arena de sparring do consultor: pratique respostas com clientes fictícios difíceis (filtráveis por perfil DISC: D/I/S/C e mistos), em modo Treino rápido (1 fala) ou Conversa completa, escolhendo etapa (abordagem, qualificação, apresentação, objeção, fechamento) e canal (WhatsApp, ligação, presencial). O agente avalia sua fala, atribui nota e sugere melhorias. App independente, abre direto no treino — sem login e sem os demais recursos do Agente Comercial.',
      produto: 'Agente Comercial',
      tipo: 'ring',
      status: 'publicado',
      novo: true,
      ordem: 5,
      url: 'ring-treino.html',
      icone: '🥊',
      origem: 'html-existente',
      estrutura: [
        { titulo: 'Treino com Clientes Difíceis', url: 'ring-treino.html', tipo: 'index' }
      ]
    }
  ];
})();
