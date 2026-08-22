/* =========================================================================
   data/21-seed.js — Dados demonstrativos.
   Gerados SEMPRE relativos a data de hoje, para que o app abra com uma
   operacao viva: 1:1 atrasado, 1:1 de hoje, planos vencendo, etc.
   ========================================================================= */
(function (App) {
  'use strict';
  const u = App.u;

  /* Subir esta versao dispara a migracao automatica no proximo boot. */
  const SEED_VERSAO = 5;

  const D = n => u.toISODate(u.addDays(new Date(), -n));                 // data
  /* Encontros nunca caem em fim de semana ou feriado — nem nos exemplos. */
  const DU_PROX = n => u.toISODate(App.cal.proximoUtil(D(n)));           // agendamento futuro
  const DU_ANT  = n => u.toISODate(App.cal.utilAnterior(D(n)));          // encontro ja realizado
  const DT = (n, h, m) => D(n) + 'T' + String(h).padStart(2, '0') + ':' + String(m || 0).padStart(2, '0');
  const MES = n => { const d = u.addMonths(new Date(), -n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

  /* ------------------------------------------------------------------ */
  /*  Colaboradores                                                     */
  /* ------------------------------------------------------------------ */
  const COLABS = [
    {
      id: 'c_carlos', nome: 'Carlos Almeida', cargo: 'Consultor Comercial Sênior',
      dataEntrada: D(820), meta: 180000, telefone: '(27) 99812-4477', email: 'carlos.almeida@empresa.com.br',
      status: 'ativo', frequenciaDias: 14, proximoOneAOne: DU_PROX(-2), ultimoOneAOne: DU_ANT(13), cor: '#6366f1',
      indicadores: { realizado: 168400, vendas: 14, leads: 62, followups: 88, conversao: 22.6 },
      historico: [
        { mes: MES(5), meta: 170000, realizado: 152000, vendas: 12 },
        { mes: MES(4), meta: 170000, realizado: 174500, vendas: 15 },
        { mes: MES(3), meta: 175000, realizado: 181200, vendas: 16 },
        { mes: MES(2), meta: 175000, realizado: 166000, vendas: 13 },
        { mes: MES(1), meta: 180000, realizado: 189300, vendas: 17 },
        { mes: MES(0), meta: 180000, realizado: 168400, vendas: 14 }
      ]
    },
    {
      id: 'c_mariana', nome: 'Mariana Costa', cargo: 'Consultora Comercial',
      dataEntrada: D(400), meta: 150000, telefone: '(27) 99745-1180', email: 'mariana.costa@empresa.com.br',
      status: 'ativo', frequenciaDias: 14, proximoOneAOne: DU_PROX(-5), ultimoOneAOne: DU_ANT(9), cor: '#14b8a6',
      indicadores: { realizado: 162700, vendas: 16, leads: 71, followups: 124, conversao: 22.5 },
      historico: [
        { mes: MES(5), meta: 140000, realizado: 118000, vendas: 11 },
        { mes: MES(4), meta: 140000, realizado: 131500, vendas: 12 },
        { mes: MES(3), meta: 145000, realizado: 148900, vendas: 14 },
        { mes: MES(2), meta: 145000, realizado: 152300, vendas: 15 },
        { mes: MES(1), meta: 150000, realizado: 158100, vendas: 15 },
        { mes: MES(0), meta: 150000, realizado: 162700, vendas: 16 }
      ]
    },
    {
      id: 'c_rafael', nome: 'Rafael Santos', cargo: 'Consultor Comercial',
      dataEntrada: D(240), meta: 150000, telefone: '(27) 99633-2091', email: 'rafael.santos@empresa.com.br',
      status: 'ativo', frequenciaDias: 7, proximoOneAOne: DU_PROX(3), ultimoOneAOne: DU_ANT(11), cor: '#f59e0b',
      indicadores: { realizado: 96200, vendas: 8, leads: 84, followups: 51, conversao: 9.5 },
      historico: [
        { mes: MES(5), meta: 140000, realizado: 121000, vendas: 11 },
        { mes: MES(4), meta: 140000, realizado: 128400, vendas: 12 },
        { mes: MES(3), meta: 145000, realizado: 117600, vendas: 10 },
        { mes: MES(2), meta: 145000, realizado: 104300, vendas: 9 },
        { mes: MES(1), meta: 150000, realizado: 99800, vendas: 9 },
        { mes: MES(0), meta: 150000, realizado: 96200, vendas: 8 }
      ]
    },
    {
      id: 'c_juliana', nome: 'Juliana Oliveira', cargo: 'Closer',
      dataEntrada: D(1090), meta: 200000, telefone: '(27) 99501-7734', email: 'juliana.oliveira@empresa.com.br',
      status: 'ativo', frequenciaDias: 14, proximoOneAOne: DU_PROX(6), ultimoOneAOne: DU_ANT(20), cor: '#8b5cf6',
      indicadores: { realizado: 143500, vendas: 11, leads: 48, followups: 62, conversao: 22.9 },
      historico: [
        { mes: MES(5), meta: 190000, realizado: 201400, vendas: 16 },
        { mes: MES(4), meta: 190000, realizado: 196800, vendas: 15 },
        { mes: MES(3), meta: 195000, realizado: 188200, vendas: 15 },
        { mes: MES(2), meta: 195000, realizado: 179500, vendas: 14 },
        { mes: MES(1), meta: 200000, realizado: 161000, vendas: 12 },
        { mes: MES(0), meta: 200000, realizado: 143500, vendas: 11 }
      ]
    },
    {
      id: 'c_daniel', nome: 'Daniel Souza', cargo: 'SDR / Pré-vendas',
      dataEntrada: D(122), meta: 90000, telefone: '(27) 99388-6612', email: 'daniel.souza@empresa.com.br',
      status: 'ativo', frequenciaDias: 7, proximoOneAOne: DU_PROX(0), ultimoOneAOne: DU_ANT(7), cor: '#3b82f6',
      indicadores: { realizado: 74800, vendas: 7, leads: 96, followups: 141, conversao: 7.3 },
      historico: [
        { mes: MES(3), meta: 70000, realizado: 41200, vendas: 4 },
        { mes: MES(2), meta: 80000, realizado: 58600, vendas: 6 },
        { mes: MES(1), meta: 85000, realizado: 69400, vendas: 7 },
        { mes: MES(0), meta: 90000, realizado: 74800, vendas: 7 }
      ]
    },
    {
      id: 'c_patricia', nome: 'Patrícia Lima', cargo: 'Consultora Comercial',
      dataEntrada: D(640), meta: 140000, telefone: '(27) 99277-4408', email: 'patricia.lima@empresa.com.br',
      status: 'inativo', frequenciaDias: 14, proximoOneAOne: '', ultimoOneAOne: DU_ANT(96), cor: '#ec4899',
      indicadores: { realizado: 0, vendas: 0, leads: 0, followups: 0, conversao: 0 },
      historico: []
    }
  ];

  /* ------------------------------------------------------------------ */
  /*  Observacoes  [colab, diasAtras, hora, tipo, contexto, impacto, texto] */
  /* ------------------------------------------------------------------ */
  const OBS = [
    /* ---------------- Carlos ---------------- */
    ['c_carlos', 1, 9, 'positivo', 'negociacao', 'alto', 'Conduziu a negociação com o grupo Vitória Log sustentando o valor cheio mesmo depois de duas tentativas de desconto. Usou o case do cliente anterior como prova e fechou no mesmo dia.'],
    ['c_carlos', 3, 15, 'proatividade', 'rotina', 'medio', 'Reorganizou sozinho a fila de follow-up da semana e avisou a equipe sobre 4 leads quentes que estavam parados há mais de 10 dias.'],
    ['c_carlos', 6, 11, 'atencao', 'followup', 'medio', 'Três oportunidades da carteira dele estão sem contato há mais de 12 dias. O CRM mostra a última interação como "aguardando cliente", sem data de retorno definida.'],
    ['c_carlos', 9, 16, 'conhecimento', 'reuniao_interna', 'baixo', 'Explicou para o time a diferença de posicionamento entre os dois produtos principais com clareza. Vale transformar isso em treino interno.'],
    ['c_carlos', 12, 10, 'positivo', 'atendimento', 'medio', 'Cliente ligou reclamando de prazo e ele assumiu o problema, deu retorno em 40 minutos com solução e ainda registrou tudo no CRM.'],
    ['c_carlos', 18, 14, 'performance', 'rotina', 'alto', 'Fechou o mês 5% acima da meta mesmo com dois cancelamentos no meio do período.'],

    /* ---------------- Mariana ---------------- */
    ['c_mariana', 0, 10, 'positivo', 'ligacao', 'alto', 'Ligação de reativação impecável: abriu com contexto, fez 4 perguntas de diagnóstico antes de falar de produto e agendou reunião com decisor.'],
    ['c_mariana', 2, 17, 'evolucao', 'negociacao', 'alto', 'Aplicou a técnica de ancoragem que combinamos no último One a One. Foi a primeira vez que ela apresentou o valor antes do desconto.'],
    ['c_mariana', 4, 9, 'proatividade', 'reuniao_interna', 'medio', 'Se ofereceu para acompanhar o Daniel nas primeiras ligações da semana e montou um roteiro simples para ele.'],
    ['c_mariana', 7, 13, 'comunicacao', 'whatsapp', 'baixo', 'Mensagens de follow-up muito longas no WhatsApp. O cliente respondeu só a última linha. Vale trabalhar objetividade.'],
    ['c_mariana', 11, 11, 'positivo', 'reuniao', 'medio', 'Apresentação para a diretoria da Metalvix muito bem estruturada: dor, solução, prova e próximo passo, tudo em 18 minutos.'],
    ['c_mariana', 16, 15, 'oportunidade', 'rotina', 'medio', 'Tem perfil para assumir contas maiores. Vale testar com duas contas da carteira da Juliana no próximo ciclo.'],
    ['c_mariana', 22, 9, 'evolucao', 'followup', 'medio', 'Cadência de follow-up subiu de 3 para 7 toques por oportunidade. Reflexo direto no aumento de conversão.'],

    /* ---------------- Rafael ---------------- */
    ['c_rafael', 0, 14, 'atencao', 'followup', 'alto', 'Sete oportunidades em negociação sem nenhum toque nos últimos 15 dias. O pipeline está parado e ele não trouxe isso na reunião de rotina.'],
    ['c_rafael', 1, 11, 'critico', 'atendimento', 'alto', 'Cliente da carteira dele ligou na coordenação porque não conseguiu retorno em 4 dias. Ele havia marcado no CRM como "retornar hoje" três vezes seguidas.'],
    ['c_rafael', 3, 16, 'atencao', 'negociacao', 'alto', 'Na negociação com a Transcapixaba entregou 15% de desconto na primeira objeção de preço, sem tentar sustentar valor nem oferecer contrapartida.'],
    ['c_rafael', 5, 10, 'conhecimento', 'ligacao', 'medio', 'Errou a informação de prazo de implantação na ligação. O cliente questionou e ele não soube corrigir na hora.'],
    ['c_rafael', 8, 9, 'positivo', 'ligacao', 'medio', 'Excelente abertura de ligação fria hoje. Tom firme, foco em agenda e não em produto. Conseguiu a reunião.'],
    ['c_rafael', 10, 15, 'atencao', 'rotina', 'medio', 'Chegou 25 minutos atrasado na reunião de alinhamento pela terceira vez no mês.'],
    ['c_rafael', 14, 13, 'oportunidade', 'reuniao_interna', 'medio', 'Tem boa técnica de abertura mas perde no meio da conversa. Um treino de condução de diagnóstico resolveria boa parte do problema.'],
    ['c_rafael', 19, 11, 'atencao', 'whatsapp', 'baixo', 'Respondeu um cliente com mensagem de áudio de 4 minutos. O cliente pediu resumo por escrito depois.'],
    ['c_rafael', 25, 10, 'positivo', 'atendimento', 'baixo', 'Recuperou um cliente que já tinha dito não. Insistiu com educação e trouxe um argumento novo.'],

    /* ---------------- Juliana ---------------- */
    ['c_juliana', 2, 16, 'performance', 'rotina', 'alto', 'Terceiro mês consecutivo abaixo da meta. Volume de leads caiu, mas a conversão também caiu — não é só um problema de topo de funil.'],
    ['c_juliana', 4, 11, 'atencao', 'reuniao_interna', 'medio', 'Postura mais fechada nas reuniões do time. Participou pouco e saiu antes do encerramento duas vezes.'],
    ['c_juliana', 6, 15, 'positivo', 'negociacao', 'alto', 'Fechou o contrato mais complexo do mês. Segurou uma negociação de 6 semanas com 3 decisores diferentes sem perder o controle do processo.'],
    ['c_juliana', 9, 10, 'oportunidade', 'reuniao', 'medio', 'É a pessoa mais técnica do time em produto. Vale envolvê-la na formação dos novos consultores — pode reacender o engajamento dela.'],
    ['c_juliana', 13, 14, 'atencao', 'followup', 'medio', 'A carteira dela é a menor do time em número de leads ativos. Precisa retomar prospecção ativa.'],
    ['c_juliana', 20, 9, 'comunicacao', 'ligacao', 'baixo', 'Fala com muita segurança técnica, mas às vezes atropela o cliente. Duas vezes hoje respondeu antes da pergunta terminar.'],

    /* ---------------- Daniel ---------------- */
    ['c_daniel', 0, 9, 'evolucao', 'ligacao', 'medio', 'Primeira semana batendo a meta de agendamentos. Passou de 4 para 9 reuniões marcadas.'],
    ['c_daniel', 1, 13, 'positivo', 'ligacao', 'medio', 'Aplicou o roteiro novo de qualificação sem ler. Já está com o discurso na cabeça.'],
    ['c_daniel', 3, 10, 'conhecimento', 'ligacao', 'medio', 'Ainda trava quando o lead pergunta preço logo no começo. Precisa de um script de contorno.'],
    ['c_daniel', 5, 16, 'proatividade', 'rotina', 'baixo', 'Pediu para ouvir gravações das ligações da Mariana por conta própria para estudar.'],
    ['c_daniel', 8, 11, 'atencao', 'rotina', 'baixo', 'Registro no CRM incompleto em 6 dos 14 leads trabalhados na semana.'],
    ['c_daniel', 12, 15, 'positivo', 'reuniao_interna', 'baixo', 'Fez perguntas muito boas na reunião de produto. Está estudando por fora.'],
    ['c_daniel', 17, 9, 'oportunidade', 'rotina', 'medio', 'Perfil de curva de aprendizado rápida. Em 2 ciclos pode assumir uma carteira própria.']
  ];

  /* ------------------------------------------------------------------ */
  /*  Feedbacks                                                          */
  /* ------------------------------------------------------------------ */
  const FBS = [
    ['c_rafael', 2, 'correcao',
      'Cliente da carteira ficou 4 dias sem retorno e acionou a coordenação diretamente.',
      'A operação perdeu credibilidade com esse cliente e a coordenação precisou entrar para resolver algo que era da rotina do consultor.',
      'Todo compromisso de retorno marcado no CRM precisa ser cumprido no prazo ou renegociado com o cliente antes do vencimento.',
      'Bloquear 30 minutos no fim de cada dia para varrer os retornos pendentes e fechar o dia com zero compromisso vencido.'],
    ['c_rafael', 4, 'desenvolvimento',
      'Na negociação da Transcapixaba, concedeu 15% de desconto logo na primeira objeção de preço.',
      'Além da margem perdida na venda, isso ensina ao cliente que o preço inicial não é real e enfraquece as próximas negociações.',
      'Sustentar o valor com pelo menos duas tentativas de reforço de benefício antes de qualquer concessão, e sempre pedir contrapartida.',
      'Treinar o roteiro de contorno de objeção de preço comigo em duas simulações antes da próxima negociação.'],
    ['c_carlos', 6, 'acompanhamento',
      'Três oportunidades da carteira estão sem contato há mais de 12 dias.',
      'Oportunidade parada esfria e vira perda silenciosa: some do pipeline sem nunca ter sido trabalhada até o fim.',
      'Nenhuma oportunidade em negociação pode passar de 7 dias sem toque registrado.',
      'Revisar essas três hoje e definir data de retorno para cada uma ainda nesta semana.'],
    ['c_mariana', 2, 'reconhecimento',
      'Aplicou a técnica de ancoragem de valor combinada no último One a One e fechou no valor cheio.',
      'Mostrou que consegue transformar orientação em prática rápido — e o resultado apareceu já na semana seguinte.',
      'Manter esse padrão e virar referência da técnica para o restante do time.',
      'Gravar uma ligação modelo para usarmos no treinamento do Daniel e do Rafael.'],
    ['c_mariana', 7, 'orientacao',
      'Mensagens de follow-up muito longas no WhatsApp, o cliente respondeu apenas ao último parágrafo.',
      'Mensagem longa reduz a taxa de resposta e dilui o pedido de próximo passo.',
      'Follow-up por WhatsApp com no máximo 3 linhas e uma única pergunta objetiva ao final.',
      'Montar 3 modelos de mensagem curta e testar por duas semanas medindo a taxa de resposta.'],
    ['c_juliana', 4, 'acompanhamento',
      'Terceiro mês consecutivo abaixo da meta, com queda também na conversão.',
      'A queda combinada de volume e conversão indica que não é só o mercado — algo mudou no processo ou no engajamento.',
      'Retomar a prospecção ativa e reconstruir o pipeline até o patamar de 3x a meta.',
      'Definir juntos uma meta semanal de novos leads e revisar toda sexta-feira.'],
    ['c_daniel', 3, 'desenvolvimento',
      'Trava quando o lead pergunta preço logo na abertura da ligação.',
      'Sem contorno, a ligação vira cotação e o lead se desqualifica sozinho antes do diagnóstico.',
      'Devolver a pergunta de preço com uma pergunta de contexto e só falar de valor após o diagnóstico.',
      'Treinar o script de contorno em 10 simulações nesta semana com a Mariana.'],
    ['c_carlos', 12, 'reconhecimento',
      'Assumiu a reclamação de prazo de um cliente e resolveu em 40 minutos, registrando tudo.',
      'Transformou uma reclamação em prova de confiabilidade e o cliente comprou de novo no mês seguinte.',
      'Manter o padrão de assumir o problema em vez de repassar.',
      'Compartilhar o caso na reunião do time como padrão de atendimento.']
  ];

  /* ------------------------------------------------------------------ */
  /*  One a Ones concluidos                                              */
  /* ------------------------------------------------------------------ */
  const ONEONES = [
    {
      colaboradorId: 'c_carlos', dias: 13, duracao: 42,
      comoEsta: 'Bem, ritmo bom. Sente que o mês começou pesado mas conseguiu organizar a carteira na segunda semana.',
      conquistas: 'Fechou o contrato da Vitória Log e recuperou dois clientes que estavam parados desde o trimestre anterior.',
      dificuldades: 'Volume de follow-up manual está consumindo as manhãs. Sente falta de um processo de priorização.',
      auto: { fezBem: 'Conduzir negociações complexas sem ceder desconto.', poderiaMelhor: 'Organização do follow-up e uso do CRM.', dificuldade: 'Tempo. Muita coisa operacional na manhã.', apoio: 'Um critério claro de priorização de carteira.' },
      positivos: ['Sustentação de valor em negociação', 'Assumiu a reclamação do cliente e resolveu no mesmo dia'],
      desenvolver: ['Disciplina de follow-up no CRM', 'Priorização da carteira'],
      compromissos: ['Zerar oportunidades sem toque há mais de 7 dias', 'Usar o filtro de priorização do CRM toda segunda'],
      fechamento: 'Combinado revisar a fila de follow-up toda segunda-feira às 8h30 e trazer o print no próximo encontro.',
      comp: { prospeccao: [4, 'Mantém entrada constante, mas depende muito da base atual.'], comunicacao: [5, 'Clareza e firmeza acima da média do time.'], followup: [2, 'É o gargalo dele: oportunidades esfriam por falta de cadência.'], negociacao: [5, 'Sustenta valor com naturalidade e usa prova social muito bem.'], fechamento: [4, 'Fecha bem quando chega no fim do processo.'], organizacao: [2, 'CRM desatualizado e agenda reativa.'], postura: [5, 'Referência de postura para o time.'], produtos: [5, 'Domina os dois produtos com profundidade.'], proatividade: [4, 'Traz temas antes de virarem problema.'], emocional: [4, 'Estável mesmo sob pressão.'], tempo: [2, 'Perde as manhãs no operacional.'] }
    },
    {
      colaboradorId: 'c_carlos', dias: 41, duracao: 38,
      comoEsta: 'Motivado com o novo produto, mas incomodado com o tempo de resposta do time de implantação.',
      conquistas: 'Melhor mês do semestre em faturamento.',
      dificuldades: 'Dependência da equipe de implantação para fechar propostas.',
      auto: { fezBem: 'Manteve constância mesmo com dois cancelamentos.', poderiaMelhor: 'Registro das interações.', dificuldade: 'Prazo de implantação.', apoio: 'Interlocução com a implantação.' },
      positivos: ['Constância de resultado', 'Domínio de produto'],
      desenvolver: ['Registro no CRM'],
      compromissos: ['Registrar toda interação no mesmo dia'],
      fechamento: 'Vou intermediar a conversa com a implantação. Ele fica com o registro do CRM em dia.',
      comp: { prospeccao: [4, ''], comunicacao: [5, ''], followup: [2, 'Segue como principal ponto de atenção.'], negociacao: [4, ''], fechamento: [4, ''], organizacao: [2, ''], postura: [5, ''], produtos: [5, ''], proatividade: [4, ''], emocional: [4, ''], tempo: [2, ''] }
    },
    {
      colaboradorId: 'c_mariana', dias: 9, duracao: 47,
      comoEsta: 'Muito bem. Diz que finalmente "encaixou" o processo comercial e está confiante para contas maiores.',
      conquistas: 'Bateu a meta pelo quarto mês seguido e ajudou na integração do Daniel.',
      dificuldades: 'Sente que ainda perde tempo escrevendo follow-ups longos demais.',
      auto: { fezBem: 'Diagnóstico antes de apresentar produto.', poderiaMelhor: 'Objetividade nas mensagens escritas.', dificuldade: 'Dizer não para lead desqualificado.', apoio: 'Quero assumir contas maiores.' },
      positivos: ['Diagnóstico estruturado', 'Ajuda ativa na integração do time'],
      desenvolver: ['Objetividade na comunicação escrita', 'Qualificação mais dura no topo'],
      compromissos: ['Testar 3 modelos de follow-up curto por 2 semanas', 'Assumir 2 contas maiores no próximo ciclo'],
      fechamento: 'Combinado: a partir do próximo ciclo ela assume duas contas estratégicas e mede a taxa de resposta dos novos modelos.',
      comp: { prospeccao: [4, 'Consistente e organizada.'], comunicacao: [4, 'Excelente no oral, prolixa no escrito.'], followup: [5, 'Cadência é o ponto mais forte dela hoje.'], negociacao: [4, 'Evoluiu muito com a ancoragem de valor.'], fechamento: [4, ''], organizacao: [5, 'CRM impecável.'], postura: [5, ''], produtos: [4, 'Ainda insegura no produto novo.'], proatividade: [5, 'Se oferece antes de ser chamada.'], emocional: [4, ''], tempo: [4, ''] }
    },
    {
      colaboradorId: 'c_mariana', dias: 37, duracao: 40,
      comoEsta: 'Bem, mas ansiosa com a negociação da Metalvix.',
      conquistas: 'Primeira venda acima de 40 mil.',
      dificuldades: 'Insegurança para sustentar preço.',
      auto: { fezBem: 'Prospecção constante.', poderiaMelhor: 'Sustentação de valor.', dificuldade: 'Objeção de preço.', apoio: 'Treino de negociação.' },
      positivos: ['Prospecção constante'],
      desenvolver: ['Sustentação de valor na objeção de preço'],
      compromissos: ['Treinar ancoragem de valor em 5 simulações'],
      fechamento: 'Treino de ancoragem marcado. Revisar na próxima conversa.',
      comp: { prospeccao: [4, ''], comunicacao: [4, ''], followup: [4, ''], negociacao: [2, 'Cede rápido na objeção de preço.'], fechamento: [3, ''], organizacao: [5, ''], postura: [4, ''], produtos: [3, ''], proatividade: [4, ''], emocional: [3, ''], tempo: [4, ''] }
    },
    {
      colaboradorId: 'c_rafael', dias: 11, duracao: 51,
      comoEsta: 'Diz estar cansado e um pouco perdido com a quantidade de leads na carteira.',
      conquistas: 'Boa abertura de ligações frias, conseguiu 6 reuniões na quinzena.',
      dificuldades: 'Não consegue dar conta do follow-up de tudo o que abre. Perde o meio do processo.',
      auto: { fezBem: 'Abertura de ligação e prospecção.', poderiaMelhor: 'Organização e follow-up.', dificuldade: 'Volume de tarefas e priorização.', apoio: 'Ajuda para organizar a rotina e treinar negociação.' },
      positivos: ['Abertura de ligação fria muito boa'],
      desenvolver: ['Cadência de follow-up', 'Sustentação de valor', 'Pontualidade nas reuniões internas'],
      compromissos: ['Zerar oportunidades sem toque há mais de 7 dias', 'Treinar contorno de objeção de preço', 'Chegar no horário nas reuniões de rotina'],
      fechamento: 'Rafael sai com 3 compromissos claros e revisão semanal. Se não houver evolução em 2 semanas, revemos o desenho da carteira.',
      comp: { prospeccao: [4, 'É o melhor do time em abertura.'], comunicacao: [3, 'Bom no oral, desorganizado no escrito.'], followup: [1, 'Crítico: pipeline parado há semanas.'], negociacao: [2, 'Cede desconto na primeira objeção.'], fechamento: [2, 'Perde no meio do processo.'], organizacao: [1, 'CRM sem registro e agenda reativa.'], postura: [3, 'Atrasos recorrentes nas reuniões.'], produtos: [2, 'Errou informação de prazo com cliente.'], proatividade: [3, ''], emocional: [3, 'Fica defensivo quando recebe feedback.'], tempo: [2, ''] }
    },
    {
      colaboradorId: 'c_rafael', dias: 32, duracao: 44,
      comoEsta: 'Animado com o volume de leads novos.',
      conquistas: 'Recuperou um cliente que já tinha dito não.',
      dificuldades: 'Ainda aprendendo o processo do CRM.',
      auto: { fezBem: 'Volume de contatos.', poderiaMelhor: 'Registro e organização.', dificuldade: 'CRM.', apoio: 'Treinamento de CRM.' },
      positivos: ['Volume de prospecção acima da média'],
      desenvolver: ['Uso do CRM'],
      compromissos: ['Concluir o treinamento de CRM'],
      fechamento: 'Treinamento de CRM agendado para a semana seguinte.',
      comp: { prospeccao: [4, ''], comunicacao: [3, ''], followup: [2, ''], negociacao: [3, ''], fechamento: [3, ''], organizacao: [2, ''], postura: [4, ''], produtos: [2, ''], proatividade: [3, ''], emocional: [3, ''], tempo: [3, ''] }
    },
    {
      colaboradorId: 'c_juliana', dias: 5, duracao: 55,
      comoEsta: 'Sincera: disse que está desmotivada e sentindo que "virou operação" depois da mudança de carteira.',
      conquistas: 'Fechou o contrato mais complexo do mês, com 3 decisores.',
      dificuldades: 'Perdeu contas históricas na redistribuição e não reconstruiu o pipeline.',
      auto: { fezBem: 'Condução de negociações complexas.', poderiaMelhor: 'Prospecção ativa, que parei de fazer.', dificuldade: 'Motivação depois da mudança de carteira.', apoio: 'Clareza sobre o meu caminho aqui dentro.' },
      positivos: ['Domínio técnico de produto', 'Condução de negociação complexa'],
      desenvolver: ['Retomada da prospecção ativa', 'Engajamento com o time'],
      compromissos: ['Reconstruir pipeline até 3x a meta', 'Assumir a formação técnica dos novos consultores'],
      fechamento: 'Conversa importante. Ela precisa de perspectiva, não de cobrança. Vou desenhar com ela um papel de referência técnica no time.',
      comp: { prospeccao: [2, 'Parou de prospectar ativamente após a mudança de carteira.'], comunicacao: [4, 'Muito segura, às vezes atropela o cliente.'], followup: [3, ''], negociacao: [5, 'Melhor do time em negociação complexa.'], fechamento: [5, 'Fecha o que chega ao fim do processo.'], organizacao: [4, ''], postura: [3, 'Engajamento em queda nas reuniões do time.'], produtos: [5, 'Referência técnica da equipe.'], proatividade: [2, 'Deixou de trazer temas espontaneamente.'], emocional: [3, 'Momento de desmotivação declarada.'], tempo: [4, ''] }
    },
    {
      colaboradorId: 'c_juliana', dias: 33, duracao: 36,
      comoEsta: 'Neutra. Falou pouco.',
      conquistas: 'Manteve o ticket médio mais alto do time.',
      dificuldades: 'Mudança de carteira.',
      auto: { fezBem: 'Ticket médio.', poderiaMelhor: 'Volume.', dificuldade: 'Adaptação à nova carteira.', apoio: 'Mais leads qualificados.' },
      positivos: ['Maior ticket médio do time'],
      desenvolver: ['Volume de prospecção'],
      compromissos: ['Retomar 10 contatos novos por semana'],
      fechamento: 'Acompanhar de perto o engajamento nas próximas semanas.',
      comp: { prospeccao: [3, ''], comunicacao: [4, ''], followup: [4, ''], negociacao: [5, ''], fechamento: [5, ''], organizacao: [4, ''], postura: [4, ''], produtos: [5, ''], proatividade: [3, ''], emocional: [4, ''], tempo: [4, ''] }
    },
    {
      colaboradorId: 'c_daniel', dias: 7, duracao: 33,
      comoEsta: 'Empolgado. Primeira semana batendo a meta de agendamentos.',
      conquistas: 'Passou de 4 para 9 reuniões marcadas na semana.',
      dificuldades: 'Trava quando o lead pergunta preço logo na abertura.',
      auto: { fezBem: 'Constância de ligações.', poderiaMelhor: 'Contorno de objeção de preço.', dificuldade: 'Insegurança com preço.', apoio: 'Um script e mais simulações.' },
      positivos: ['Evolução rápida no roteiro de qualificação', 'Estuda por conta própria'],
      desenvolver: ['Contorno de objeção de preço', 'Registro completo no CRM'],
      compromissos: ['10 simulações de contorno de preço com a Mariana', 'Registrar 100% dos leads trabalhados'],
      fechamento: 'Ritmo de evolução muito bom para 4 meses de casa. Manter cadência semanal de 1:1.',
      comp: { prospeccao: [4, 'Volume acima do esperado para o tempo de casa.'], comunicacao: [3, 'Melhorou muito o tom ao telefone.'], followup: [3, ''], negociacao: [2, 'Ainda não sustenta preço.'], fechamento: [2, 'Não é o foco da função hoje.'], organizacao: [2, 'Registro incompleto no CRM.'], postura: [4, ''], produtos: [3, 'Estudando por fora, evoluindo rápido.'], proatividade: [5, 'Pediu material extra por conta própria.'], emocional: [4, ''], tempo: [3, ''] }
    },
    {
      colaboradorId: 'c_daniel', dias: 14, duracao: 30,
      comoEsta: 'Um pouco inseguro com o volume de ligações.',
      conquistas: 'Fez as primeiras 100 ligações.',
      dificuldades: 'Medo de abordagem fria.',
      auto: { fezBem: 'Não desistiu.', poderiaMelhor: 'Tom de voz e segurança.', dificuldade: 'Abordagem fria.', apoio: 'Acompanhamento nas primeiras ligações.' },
      positivos: ['Persistência'],
      desenvolver: ['Segurança na abordagem'],
      compromissos: ['Ouvir 5 gravações de ligações modelo'],
      fechamento: 'Combinado acompanhamento da Mariana nas ligações da semana.',
      comp: { prospeccao: [3, ''], comunicacao: [2, ''], followup: [2, ''], negociacao: [2, ''], fechamento: [2, ''], organizacao: [2, ''], postura: [4, ''], produtos: [2, ''], proatividade: [4, ''], emocional: [3, ''], tempo: [3, ''] }
    }
  ];

  /* ------------------------------------------------------------------ */
  /*  Planos de acao                                                     */
  /* ------------------------------------------------------------------ */
  const PLANOS = [
    ['c_rafael', 11, 'Cadência de follow-up', 'Nenhuma oportunidade em negociação sem toque há mais de 7 dias',
      'Bloquear 30 minutos no fim do dia para varrer os retornos pendentes e registrar no CRM', -4,
      'Zero oportunidades sem toque há mais de 7 dias no relatório de sexta', 'em_andamento'],
    ['c_rafael', 11, 'Sustentação de valor', 'Parar de conceder desconto na primeira objeção de preço',
      'Treinar o roteiro de contorno de objeção em 2 simulações semanais com o coordenador', -2,
      'Desconto médio concedido abaixo de 8% nas próximas 5 propostas', 'nao_iniciado'],
    ['c_rafael', 11, 'Pontualidade', 'Chegar no horário nas reuniões de rotina',
      'Agenda bloqueada 10 minutos antes com alerta no celular', 6,
      'Zero atrasos nas próximas 4 reuniões', 'em_andamento'],
    ['c_rafael', 32, 'Uso do CRM', 'Dominar o registro de interações no CRM',
      'Concluir o treinamento interno de CRM e aplicar por 2 semanas', 18,
      'Registro completo em 100% dos leads da semana', 'concluido'],

    ['c_carlos', 13, 'Disciplina de follow-up', 'Manter a carteira sem oportunidades esquecidas',
      'Revisar a fila de priorização toda segunda às 8h30 e levar o print para o 1:1', 3,
      'Nenhuma oportunidade com mais de 7 dias sem toque', 'em_andamento'],
    ['c_carlos', 41, 'Registro no CRM', 'Registrar toda interação no mesmo dia',
      'Fechar o dia com o CRM atualizado antes de sair', 27,
      '100% das interações da semana registradas', 'concluido'],

    ['c_mariana', 9, 'Objetividade no escrito', 'Aumentar a taxa de resposta do follow-up por WhatsApp',
      'Testar 3 modelos de mensagem com no máximo 3 linhas por 2 semanas', 5,
      'Taxa de resposta acima de 45% nas mensagens do período', 'em_andamento'],
    ['c_mariana', 9, 'Contas estratégicas', 'Preparar a transição para contas de maior porte',
      'Acompanhar a Juliana em 2 negociações complexas e assumir 2 contas no próximo ciclo', 21,
      'Duas contas estratégicas assumidas com plano de relacionamento', 'nao_iniciado'],
    ['c_mariana', 37, 'Ancoragem de valor', 'Sustentar preço na objeção',
      'Treinar ancoragem em 5 simulações e aplicar na próxima negociação real', 23,
      'Fechar uma negociação sem desconto', 'concluido'],

    ['c_juliana', 5, 'Retomada da prospecção', 'Reconstruir o pipeline até 3x a meta',
      'Definir meta semanal de 10 novos leads qualificados e revisar toda sexta', 9,
      'Pipeline em 3x a meta em até 45 dias', 'em_andamento'],
    ['c_juliana', 5, 'Referência técnica', 'Assumir a formação técnica dos novos consultores',
      'Montar e conduzir 1 treinamento de produto por mês para o time', 16,
      'Primeiro treinamento realizado e avaliado pelo time', 'nao_iniciado'],
    ['c_juliana', 33, 'Volume de contatos', 'Retomar 10 contatos novos por semana',
      'Bloco fixo de prospecção às terças e quintas pela manhã', 5,
      '40 novos contatos no mês', 'cancelado'],

    ['c_daniel', 7, 'Contorno de objeção de preço', 'Não travar quando o lead pergunta preço na abertura',
      'Fazer 10 simulações de contorno com a Mariana e gravar as 3 melhores', 4,
      'Nenhuma ligação encerrada por objeção de preço na abertura', 'em_andamento'],
    ['c_daniel', 7, 'Registro no CRM', 'Registrar 100% dos leads trabalhados',
      'Checklist de fim de dia com os campos obrigatórios do CRM', 11,
      '100% dos leads da semana com registro completo', 'nao_iniciado'],
    ['c_daniel', 14, 'Segurança na abordagem', 'Ganhar confiança na ligação fria',
      'Ouvir 5 gravações modelo e ser acompanhado pela Mariana em 3 ligações', 4,
      'Taxa de agendamento acima de 15%', 'concluido']
  ];

  /* ------------------------------------------------------------------ */
  /*  Autoavaliacao (demonstra o comparativo auto x coordenador)         */
  /* ------------------------------------------------------------------ */
  const AUTOS = [
    {
      colaboradorId: 'c_rafael', dias: 12,
      respostas: {
        performance: 'Acho que minha performance está mediana. Trago muito lead novo, mas não consigo fechar o que abro.',
        fezBem: 'Prospecção. Sou o que mais abre porta no time.',
        melhorar: 'Organização e o meio da negociação.',
        dificuldade: 'Me perco no volume. Começo o dia sem saber o que é prioridade.',
        lider: 'Queria ser cobrado com mais frequência e ter um processo pronto para seguir.',
        competencia: 'Negociação.'
      },
      competencias: { prospeccao: 5, comunicacao: 4, followup: 3, negociacao: 3, fechamento: 3, organizacao: 2, postura: 4, produtos: 3, proatividade: 4, emocional: 4, tempo: 2 }
    },
    {
      colaboradorId: 'c_mariana', dias: 10,
      respostas: {
        performance: 'Melhor momento desde que entrei. O processo finalmente encaixou.',
        fezBem: 'Diagnóstico antes de apresentar produto e cadência de follow-up.',
        melhorar: 'Preciso ser mais objetiva no escrito e mais dura na qualificação.',
        dificuldade: 'Dizer não para lead que não tem perfil.',
        lider: 'Quero um caminho claro para assumir contas maiores.',
        competencia: 'Negociação em contas complexas.'
      },
      competencias: { prospeccao: 4, comunicacao: 4, followup: 5, negociacao: 3, fechamento: 4, organizacao: 5, postura: 4, produtos: 3, proatividade: 5, emocional: 4, tempo: 4 }
    }
  ];

  /* ================================================================== */
  /*  Montagem                                                          */
  /* ================================================================== */
  function gerar() {
    const colaboradores = COLABS.map(c => Object.assign({ criadoEm: c.dataEntrada + 'T09:00' }, c));

    const observacoes = OBS.map((o, i) => ({
      id: 'o_' + i,
      colaboradorId: o[0], data: DT(o[1], o[2], (i * 7) % 60),
      tipo: o[3], contexto: o[4], impacto: o[5], texto: o[6],
      evidencias: [], criadoEm: DT(o[1], o[2], 0)
    }));

    /* algumas evidencias de exemplo (links, sem arquivos pesados) */
    if (observacoes[13]) observacoes[13].evidencias = [{ tipo: 'link', nome: 'Relatório de pipeline parado (CRM)', url: 'https://exemplo.com/crm/pipeline-parado' }];
    if (observacoes[14]) observacoes[14].evidencias = [{ tipo: 'link', nome: 'Registro da reclamação no atendimento', url: 'https://exemplo.com/atendimento/ticket-8842' }];
    if (observacoes[6])  observacoes[6].evidencias  = [{ tipo: 'link', nome: 'Gravação da ligação de reativação', url: 'https://exemplo.com/gravacoes/ligacao-1174' }];

    const feedbacks = FBS.map((f, i) => ({
      id: 'f_' + i, colaboradorId: f[0], data: DT(f[1], 17, 30),
      classificacao: f[2], oQueAconteceu: f[3], impacto: f[4], oQueDeveria: f[5], comoMelhorar: f[6],
      evidencias: [], criadoEm: DT(f[1], 17, 30)
    }));

    const oneones = ONEONES.map((o, i) => {
      const comp = {};
      Object.keys(o.comp).forEach(k => { comp[k] = { nota: o.comp[k][0], comentario: o.comp[k][1] || '' }; });
      const data = DT(o.dias, 15, 0);
      const obsPeriodo = observacoes.filter(x => x.colaboradorId === o.colaboradorId &&
        u.diffDays(x.data, u.parseDate(data)) >= 0 && u.diffDays(x.data, u.parseDate(data)) <= 20);
      return {
        id: 'e_' + i, colaboradorId: o.colaboradorId, data, status: 'concluido',
        duracaoMin: o.duracao,
        periodoInicio: DT(o.dias + 14, 9, 0), periodoFim: data,
        roteiro: {
          comoEsta: o.comoEsta, conquistas: o.conquistas, dificuldades: o.dificuldades,
          autoavaliacao: o.auto,
          positivos: o.positivos, desenvolver: o.desenvolver,
          compromissos: o.compromissos, fechamento: o.fechamento
        },
        observacoesDiscutidas: obsPeriodo.slice(0, 3).map(x => x.id),
        feedbacksDiscutidos: [],
        competencias: comp,
        resumoSalvo: {
          total: obsPeriodo.length,
          positivos: obsPeriodo.filter(x => App.cat.tipoObs(x.tipo).pol > 0).length,
          atencao: obsPeriodo.filter(x => App.cat.tipoObs(x.tipo).pol < 0).length
        },
        criadoEm: data
      };
    });

    /* mapa auxiliar para ligar cada plano ao encontro que o originou */
    const encontroPorChave = {};
    ONEONES.forEach((o, i) => { encontroPorChave[o.colaboradorId + '|' + o.dias] = 'e_' + i; });

    const planos = PLANOS.map((p, i) => {
      const inicio = D(p[1]);
      const prazo = u.toISODate(u.addDays(new Date(), p[5]));
      const status = p[7];
      return {
        id: 'p_' + i, colaboradorId: p[0],
        oneAOneId: encontroPorChave[p[0] + '|' + p[1]] || null,
        ponto: p[2], objetivo: p[3], acao: p[4],
        responsavel: (COLABS.find(c => c.id === p[0]) || {}).nome || '',
        inicio, prazo, indicador: p[6], status,
        concluidoEm: status === 'concluido' ? u.toISODate(u.addDays(new Date(), Math.min(-1, p[5] - 3))) : null,
        criadoEm: inicio + 'T15:30'
      };
    });

    const autoavaliacoes = AUTOS.map((a, i) => ({
      id: 'a_' + i, colaboradorId: a.colaboradorId, data: DT(a.dias, 20, 0),
      respostas: a.respostas, competencias: a.competencias, criadoEm: DT(a.dias, 20, 0)
    }));

    const config = [
      { id: 'coordenador', valor: { nome: 'Coordenador Comercial', iniciais: 'CC' } },
      { id: 'seedVersao', valor: SEED_VERSAO }
    ];

    /* Marca de demonstracao: estes registros existem no banco mas ficam
       FORA da operacao — aparecem apenas na aba Exemplos das Configuracoes. */
    [colaboradores, observacoes, feedbacks, oneones, planos, autoavaliacoes]
      .forEach(lista => lista.forEach(x => { x.exemplo = true; }));

    return { colaboradores, observacoes, feedbacks, oneones, planos, autoavaliacoes, notificacoes: [], config };
  }

  /* Colecoes que recebem material de demonstracao. */
  const COLECOES_EXEMPLO = ['colaboradores', 'observacoes', 'feedbacks', 'oneones', 'planos', 'autoavaliacoes'];

  App.seed = {
    gerar,
    versao: SEED_VERSAO,
    COLECOES_EXEMPLO,

    /** Zera o banco e reinstala apenas os exemplos (usado no "recarregar demo"). */
    aplicar() {
      return App.db.importar({ versao: 1, dados: gerar() });
    },

    /**
     * Reinstala os exemplos SEM tocar nos dados reais.
     * Registros do usuario ficam intactos; qualquer exemplo antigo
     * (inclusive de versoes anteriores, que nao tinham a marca) e
     * substituido pela versao atual — por isso o filtro tambem por id.
     */
    restaurar() {
      const d = gerar();
      const cache = App.db.cache;
      return Promise.all(COLECOES_EXEMPLO.map(c => {
        const ids = {};
        d[c].forEach(x => { ids[x.id] = true; });
        const reais = cache[c].filter(x => !x.exemplo && !ids[x.id]);
        const arr = reais.concat(d[c]);
        cache[c] = arr;
        return App.adapter.replaceAll(c, arr);
      })).then(() => {
        return App.db.config.set('seedVersao', SEED_VERSAO);
      }).then(() => {
        App.bus.emit('dados:mudou', { colecao: '*', acao: 'recarregar', doc: null });
        return true;
      });
    },

    /** Remove somente os exemplos, preservando tudo o que e real. */
    remover() {
      const cache = App.db.cache;
      return Promise.all(COLECOES_EXEMPLO.map(c => {
        const reais = cache[c].filter(x => !x.exemplo);
        cache[c] = reais;
        return App.adapter.replaceAll(c, reais);
      })).then(() => {
        App.bus.emit('dados:mudou', { colecao: '*', acao: 'recarregar', doc: null });
        return true;
      });
    },

    /**
     * Migracao das bases criadas antes da separacao operacao/exemplos:
     * move o material de demonstracao para fora da operacao e repoe o
     * que tiver sido excluido no caminho.
     */
    migrar() {
      const atual = +App.db.config.get('seedVersao', 0);
      if (atual >= SEED_VERSAO) return Promise.resolve(false);
      const tinhaAlgo = App.db.cache.colaboradores.length > 0;
      if (!tinhaAlgo) return Promise.resolve(false);
      return App.seed.restaurar().then(() => true);
    }
  };
})(window.App);
