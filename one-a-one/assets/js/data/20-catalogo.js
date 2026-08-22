/* =========================================================================
   data/20-catalogo.js — Catalogos de dominio (tipos, contextos, competencias...)
   Fonte unica: qualquer tela que precise de rotulo/cor/emoji le daqui.
   ========================================================================= */
(function (App) {
  'use strict';

  const C = {};

  /* --------------------- Tipos de observacao --------------------- */
  /* polaridade: +1 reforca | -1 desenvolve | -2 critico | 0 neutro   */
  C.TIPOS_OBS = [
    { id: 'positivo',     label: 'Ponto positivo',       emoji: '⭐', tom: 'ok',      pol:  1 },
    { id: 'atencao',      label: 'Ponto de atenção',     emoji: '⚠️', tom: 'warn',    pol: -1 },
    { id: 'oportunidade', label: 'Oportunidade',         emoji: '💡', tom: 'info',    pol:  0 },
    { id: 'critico',      label: 'Comportamento crítico',emoji: '🚨', tom: 'danger',  pol: -2 },
    { id: 'performance',  label: 'Performance',          emoji: '🎯', tom: 'purple',  pol:  0 },
    { id: 'atendimento',  label: 'Atendimento',          emoji: '📞', tom: 'info',    pol:  0 },
    { id: 'comunicacao',  label: 'Comunicação',          emoji: '💬', tom: 'info',    pol:  0 },
    { id: 'conhecimento', label: 'Conhecimento',         emoji: '🧠', tom: 'purple',  pol:  0 },
    { id: 'proatividade', label: 'Proatividade',         emoji: '🔥', tom: 'brand',   pol:  1 },
    { id: 'evolucao',     label: 'Evolução',             emoji: '📈', tom: 'ok',      pol:  1 }
  ];

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
