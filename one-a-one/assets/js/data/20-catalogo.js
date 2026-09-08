/* =========================================================================
   data/20-catalogo.js — Catalogos de dominio (tipos, contextos, competencias...)
   Fonte unica: qualquer tela que precise de rotulo/cor/emoji le daqui.
   ========================================================================= */
(function (App) {
  'use strict';

  const C = {};

  /* --------------------- Tipos de observacao ---------------------
     A ORDEM E DELIBERADA: primeiro o que SOMA ponto, depois o neutro,
     por ultimo o que DESCONTA — com o critico no fim, que e o mais pesado.
     Quem escolhe o tipo ve a consequencia antes de clicar.

     polaridade: quanto o tipo vale no saldo. Evolucao pesa mais (+3) porque
     exige um ANTES e um DEPOIS — e mudanca comprovada vale mais que fato
     isolado. Ponto positivo e Proatividade valem +2. Do lado negativo,
     atencao (-1) e critico (-2). A escala e deliberadamente assimetrica:
     reconhecimento pesa mais que correcao, na linha da proporcao de Losada.
     O saldo do consultor e a soma de (polaridade x peso do impacto).
     ---------------------------------------------------------------- */
  C.TIPOS_OBS = [
    /* ---- somam ponto ---- */
    { id: 'evolucao',     label: 'Evolução',             emoji: '📈', tom: 'ok',      pol:  3 },
    { id: 'positivo',     label: 'Ponto positivo',       emoji: '⭐', tom: 'ok',      pol:  2 },
    { id: 'proatividade', label: 'Proatividade',         emoji: '🔥', tom: 'brand',   pol:  2 },
    /* ---- nao somam nem descontam ---- */
    { id: 'oportunidade', label: 'Oportunidade',         emoji: '💡', tom: 'info',    pol:  0 },
    { id: 'performance',  label: 'Performance',          emoji: '🎯', tom: 'purple',  pol:  0 },
    { id: 'atendimento',  label: 'Atendimento',          emoji: '📞', tom: 'info',    pol:  0 },
    { id: 'comunicacao',  label: 'Comunicação',          emoji: '💬', tom: 'info',    pol:  0 },
    { id: 'conhecimento', label: 'Conhecimento',         emoji: '🧠', tom: 'purple',  pol:  0 },
    /* ---- descontam ---- */
    { id: 'atencao',      label: 'Ponto de atenção',     emoji: '⚠️', tom: 'warn',    pol: -1 },
    { id: 'critico',      label: 'Comportamento crítico',emoji: '🚨', tom: 'danger',  pol: -2 }
  ];

  /** '+1' | '0' | '−1' | '−2' — o rotulo de pontuacao mostrado no botao. */
  C.pontos = function (pol) {
    const n = +pol || 0;
    return n > 0 ? '+' + n : (n < 0 ? '−' + Math.abs(n) : '0');
  };

  /* --------------------- Contextos --------------------- */
  C.CONTEXTOS = [
    { id: 'ligacao',         label: 'Ligação',         emoji: '📱' },
    { id: 'whatsapp',        label: 'WhatsApp',        emoji: '💬' },
    { id: 'reuniao',         label: 'Reunião',         emoji: '🤝' },
    { id: 'atendimento',     label: 'Atendimento',     emoji: '🎧' },
    { id: 'negociacao',      label: 'Negociação',      emoji: '🤑' },
    { id: 'followup',        label: 'Follow-up',       emoji: '🔁' },
    { id: 'reuniao_interna', label: 'Reunião interna', emoji: '🏢' },
    { id: 'rotina',          label: 'Rotina',          emoji: '📋' },
    { id: 'outro',           label: 'Outro',           emoji: '📌' }
  ];

  /* --------------------- Impacto --------------------- */
  C.IMPACTOS = [
    { id: 'baixo', label: 'Baixo', peso: 1, tom: 'neutral' },
    { id: 'medio', label: 'Médio', peso: 2, tom: 'warn' },
    { id: 'alto',  label: 'Alto',  peso: 3, tom: 'danger' }
  ];

  /* --------------------- Classificacao de feedback --------------------- */
  C.CLASSIF_FEEDBACK = [
    { id: 'reconhecimento', label: 'Reconhecimento', emoji: '🏆', tom: 'ok'     },
    { id: 'desenvolvimento',label: 'Desenvolvimento',emoji: '🌱', tom: 'info'   },
    { id: 'correcao',       label: 'Correção',       emoji: '🔧', tom: 'danger' },
    { id: 'orientacao',     label: 'Orientação',     emoji: '🧭', tom: 'purple' },
    { id: 'acompanhamento', label: 'Acompanhamento', emoji: '👀', tom: 'warn'   }
  ];

  /* --------------------- Perguntas do feedback ---------------------
     O feedback tem sempre a mesma espinha — fato, impacto, esperado, acao —
     mas a PERGUNTA muda com a intencao. "O que deveria acontecer?" nao faz
     sentido num reconhecimento, e "qual foi o impacto?" pede outra resposta
     quando se corrige e quando se elogia.

     As CHAVES sao fixas (oQueAconteceu, impacto, oQueDeveria, comoMelhorar)
     para nao quebrar o que ja esta gravado: muda o rotulo, nao o dado.
     ---------------------------------------------------------------- */
  C.PERGUNTAS_FEEDBACK = {
    reconhecimento: [
      { rot: 'O que ele fez?',              ph: 'O comportamento específico, com data e contexto. "Foi bem" não ensina nada.' },
      { rot: 'Que efeito isso teve?',       ph: 'O que mudou para o cliente, para o time ou para o número por causa disso.' },
      { rot: 'O que isso mostra?',          ph: 'A força que apareceu ali — é isso que você quer ver de novo.' },
      { rot: 'Como ampliar?',               ph: 'Onde mais essa força cabe. Mais responsabilidade, mais autonomia, mais alcance.' }
    ],
    desenvolvimento: [
      { rot: 'O que você observou?',        ph: 'O padrão que se repete, com pelo menos um exemplo concreto.' },
      { rot: 'Onde isso limita hoje?',      ph: 'O que ele deixa de conseguir por causa disso. Sem consequência clara, não vira prioridade.' },
      { rot: 'Onde ele precisa chegar?',    ph: 'O nível esperado, em comportamento observável — não em adjetivo.' },
      { rot: 'Qual o primeiro passo?',      ph: 'Uma coisa só, treinável no próximo ciclo. Cinco frentes não viram nenhuma.' }
    ],
    correcao: [
      { rot: 'O que aconteceu?',            ph: 'Fato observado, sem julgamento: o que foi dito ou feito, quando e onde.' },
      { rot: 'Qual foi o impacto?',         ph: 'A consequência para o cliente, para o time ou para o resultado.' },
      { rot: 'O que deveria ter acontecido?', ph: 'O comportamento esperado naquela situação, com clareza.' },
      { rot: 'O que muda a partir de agora?', ph: 'O combinado, com prazo e como você vai verificar.' }
    ],
    orientacao: [
      { rot: 'Qual é a situação?',          ph: 'O contexto que motivou a orientação — o que ele está enfrentando.' },
      { rot: 'O que está em jogo?',         ph: 'O que se ganha acertando e o que se perde errando aqui.' },
      { rot: 'Qual caminho você recomenda?', ph: 'A direção, e por quê. Orientar é explicar o critério, não só mandar.' },
      { rot: 'Como vamos acompanhar?',      ph: 'Quando vocês voltam a esse assunto e o que indica que funcionou.' }
    ],
    acompanhamento: [
      { rot: 'O que tinha sido combinado?', ph: 'O compromisso anterior, do jeito que foi acordado.' },
      { rot: 'Onde está hoje?',             ph: 'O que já andou, com evidência. Percepção não serve para medir compromisso.' },
      { rot: 'O que ainda falta?',          ph: 'A distância entre o combinado e o feito — e o que travou.' },
      { rot: 'Qual o próximo checkpoint?',  ph: 'Nova data e o que precisa estar pronto até lá.' }
    ]
  };

  /** As 4 perguntas dessa classificacao (cai na de correcao se nao houver). */
  C.perguntasFeedback = function (classif) {
    return C.PERGUNTAS_FEEDBACK[classif] || C.PERGUNTAS_FEEDBACK.correcao;
  };

  /* --------------------- Competencias --------------------- */
  C.COMPETENCIAS = [
    { id: 'prospeccao',    label: 'Prospecção' },
    { id: 'comunicacao',   label: 'Comunicação' },
    { id: 'followup',      label: 'Follow-up' },
    { id: 'negociacao',    label: 'Negociação' },
    { id: 'fechamento',    label: 'Fechamento' },
    { id: 'organizacao',   label: 'Organização' },
    { id: 'postura',       label: 'Postura comercial' },
    { id: 'produtos',      label: 'Conhecimento dos produtos' },
    { id: 'proatividade',  label: 'Proatividade' },
    { id: 'emocional',     label: 'Inteligência emocional' },
    { id: 'tempo',         label: 'Gestão do tempo' }
  ];

  C.ESCALA = {
    1: 'Muito abaixo do esperado',
    2: 'Abaixo do esperado',
    3: 'Dentro do esperado',
    4: 'Acima do esperado',
    5: 'Referência para o time'
  };

  /* --------------------- Planos de acao --------------------- */
  C.STATUS_PLANO = [
    { id: 'nao_iniciado', label: 'Não iniciado', tom: 'neutral', emoji: '⚪' },
    { id: 'em_andamento', label: 'Em andamento', tom: 'info',    emoji: '🔵' },
    { id: 'concluido',    label: 'Concluído',    tom: 'ok',      emoji: '🟢' },
    { id: 'atrasado',     label: 'Atrasado',     tom: 'danger',  emoji: '🔴' },
    { id: 'cancelado',    label: 'Cancelado',    tom: 'neutral', emoji: '⚫' }
  ];

  /* --------------------- One a One --------------------- */
  C.STATUS_1A1 = [
    { id: 'agendado',    label: 'Agendado',    tom: 'info'    },
    { id: 'em_andamento',label: 'Em andamento',tom: 'warn'    },
    { id: 'concluido',   label: 'Concluído',   tom: 'ok'      },
    { id: 'cancelado',   label: 'Cancelado',   tom: 'neutral' }
  ];

  C.FREQUENCIAS = [
    { id: 7,  label: 'Semanal' },
    { id: 14, label: 'Quinzenal' },
    { id: 21, label: 'A cada 3 semanas' },
    { id: 30, label: 'Mensal' },
    { id: 60, label: 'Bimestral' }
  ];

  C.CARGOS = [
    'Consultor Comercial', 'Consultor Comercial Sênior', 'Closer',
    'SDR / Pré-vendas', 'Coordenador Comercial', 'Gerente de Contas'
  ];

  /* --------------------- Roteiro do One a One --------------------- */
  C.ETAPAS_1A1 = [
    { id: 'preparo',      n: '·', titulo: 'Preparação',              hint: 'O que aconteceu desde o último encontro' },
    { id: 'como_esta',    n: 1,   titulo: 'Como você está?',         hint: 'Abra a conversa pelo humano, não pelo número.' },
    { id: 'conquistas',   n: 2,   titulo: 'Principais conquistas',   hint: 'O que ele destaca como vitória do período.' },
    { id: 'dificuldades', n: 3,   titulo: 'Principais dificuldades', hint: 'Onde travou, o que atrapalhou.' },
    { id: 'autoavaliacao',n: 4,   titulo: 'Autoavaliação',           hint: 'A visão dele antes da sua.' },
    { id: 'feedback',     n: 5,   titulo: 'Feedback do coordenador', hint: 'Selecione as evidências que serão discutidas.' },
    { id: 'competencias', n: 6,   titulo: 'Competências',            hint: 'Avaliação de 1 a 5 com justificativa.' },
    { id: 'positivos',    n: 7,   titulo: 'Pontos positivos',        hint: 'Reconhecimentos registrados na conversa.' },
    { id: 'desenvolver',  n: 8,   titulo: 'Pontos de desenvolvimento', hint: 'Oportunidades acordadas.' },
    { id: 'compromissos', n: 9,   titulo: 'Compromissos',            hint: 'O que vira plano de ação.' },
    { id: 'fechamento',   n: 10,  titulo: 'Fechamento',              hint: 'Alinhamento final e próximos passos.' }
  ];

  C.PERGUNTAS_AUTO = [
    { id: 'fezBem',       label: 'O que você acredita que fez bem?' },
    { id: 'poderiaMelhor',label: 'Onde acredita que poderia ter feito melhor?' },
    { id: 'dificuldade',  label: 'Qual foi sua maior dificuldade?' },
    { id: 'apoio',        label: 'Que apoio você precisa do coordenador?' }
  ];

  /* Autoavaliacao do colaborador (modulo preparado para o futuro) */
  C.PERGUNTAS_AUTOAVALIACAO = [
    { id: 'performance', label: 'Como avalio minha performance?' },
    { id: 'fezBem',      label: 'O que fiz bem?' },
    { id: 'melhorar',    label: 'Onde preciso melhorar?' },
    { id: 'dificuldade', label: 'Qual minha maior dificuldade?' },
    { id: 'lider',       label: 'O que espero do meu líder?' },
    { id: 'competencia', label: 'Qual competência quero desenvolver?' }
  ];

  /* --------------------- Tipos da timeline --------------------- */
  C.TIPOS_TIMELINE = [
    { id: 'todos',      label: 'Todos' },
    { id: 'positivo',   label: 'Positivos' },
    { id: 'atencao',    label: 'Atenção' },
    { id: 'feedback',   label: 'Feedback' },
    { id: 'oneone',     label: 'One a One' },
    { id: 'plano',      label: 'Plano de ação' },
    { id: 'evolucao',   label: 'Evolução' }
  ];

  /* --------------------- Helpers de lookup --------------------- */
  function indexar(lista) {
    const m = {};
    lista.forEach(x => { m[x.id] = x; });
    return m;
  }
  const IX = {
    tipoObs:    indexar(C.TIPOS_OBS),
    contexto:   indexar(C.CONTEXTOS),
    impacto:    indexar(C.IMPACTOS),
    classif:    indexar(C.CLASSIF_FEEDBACK),
    competencia:indexar(C.COMPETENCIAS),
    statusPlano:indexar(C.STATUS_PLANO),
    status1a1:  indexar(C.STATUS_1A1),
    frequencia: indexar(C.FREQUENCIAS)
  };

  C.tipoObs     = id => IX.tipoObs[id]     || { id, label: id || '—', emoji: '📌', tom: 'neutral', pol: 0 };
  C.contexto    = id => IX.contexto[id]    || { id, label: id || '—', emoji: '📌' };
  C.impacto     = id => IX.impacto[id]     || C.IMPACTOS[0];
  C.classif     = id => IX.classif[id]     || { id, label: id || '—', emoji: '💬', tom: 'neutral' };
  C.competencia = id => IX.competencia[id] || { id, label: id || '—' };
  C.statusPlano = id => IX.statusPlano[id] || C.STATUS_PLANO[0];
  C.status1a1   = id => IX.status1a1[id]   || C.STATUS_1A1[0];
  C.frequencia  = id => IX.frequencia[+id] || { id: +id || 14, label: (+id || 14) + ' dias' };

  App.cat = C;
})(window.App);
