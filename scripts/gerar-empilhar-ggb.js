// Gera treinamento-ggb-empilhar/index.html a partir de uma base única (T, MATRIZ, CORINGAS).
// Uso: node scripts/gerar-empilhar-ggb.js  — depois rodar scripts/gerar-indice-busca.ps1.
// Editar o texto AQUI, não no index.html (ele é sobrescrito).
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'treinamento-ggb-empilhar', 'index.html');

const T = [
  { sig: 'CIS', nome: 'Método CIS', emo: '🧠',
    entrega: 'inteligência emocional e reprogramação das crenças que travam.',
    diz: 'Sei o que tenho que fazer, mas não faço. Procrastino, me saboto.',
    revela: 'Crença limitante e falta de controle emocional. Não é falta de informação.',
    aprofunde: ['Há quanto tempo isso se repete?', 'O que isso já te custou?'],
    consciencia: 'O problema não é saber, é o que ele acredita sobre si.',
    gatilhos: ['Quando você muda, quem ao seu redor percebe primeiro?', 'Já fez um curso que empolgou e depois esfriou?', 'Como você garante que essa mudança vai durar?', 'Tem alguém próximo que você tenta ajudar e não consegue?'],
    novaDor: 'Eu mudo, mas não sei manter, nem levar isso para os outros.',
    frase: 'Mudar você é o primeiro passo. Manter e saber conduzir outras pessoas é outro nível.',
    como: 'Valide a mudança dele antes. A próxima dor vem da pergunta "como manter?", não de você.',
    story: ['Uma empresária fez o CIS e saiu outra pessoa.', 'Três meses depois, a rotina começou a puxá-la de volta.', 'Ela viveu a mudança, mas não dominava o método por trás dela.', 'Cada recaída era recomeçar do zero, e ela não conseguia ajudar a equipe.', 'Transformar a experiência em método: FCIS.'],
    pensa: 'Crença, não informação', pergunta: 'O que isso já te custou?', dor: 'Autossabotagem' },
  { sig: 'FCIS', nome: 'FCIS', emo: '🎓',
    entrega: 'o domínio do método, com certificação internacional, para aplicar em si e conduzir pessoas.',
    diz: 'Já mudei muito, mas tenho medo de voltar. E queria ajudar quem está comigo.',
    revela: 'Mudança sem método e vontade de conduzir outras pessoas.',
    aprofunde: ['O que acontece quando a empolgação passa?', 'Quem você mais queria ajudar hoje?'],
    consciencia: 'Sentir a mudança é diferente de dominar o método.',
    gatilhos: ['No um a um você consegue ajudar. E com o time inteiro?', 'Tem alguém na equipe que você não consegue alcançar?', 'Você conduz todo mundo do mesmo jeito?', 'Quanto tempo você gasta resolvendo conflito entre pessoas?'],
    novaDor: 'Com uma pessoa funciona. Com o time, cada um reage de um jeito.',
    frase: 'Então o método funciona com pessoas. O que trava é ler cada perfil, certo?',
    como: 'Pergunte pelo time, não pelo curso. Quando ele falar de "gente difícil", a ponte está pronta.',
    story: ['Um gestor saiu do FCIS e começou a conduzir conversas com o time.', 'Com dois funcionou. Com outros três, a mesma conversa gerou resistência.', 'As pessoas não eram resistentes: tinham perfis diferentes.', 'Tratando todos igual, ele estava perdendo os melhores.', 'Ler cada perfil e liderar do jeito certo: FGPC.'],
    pensa: 'Quer conduzir pessoas', pergunta: 'E com o time inteiro?', dor: 'Mudança sem método' },
  { sig: 'FGPC', nome: 'FGPC', emo: '🧩',
    entrega: 'gestão de pessoas pelo perfil comportamental (DISC). Time complementar e que fica.',
    diz: 'Meu time não entrega. Cada um puxa pra um lado e eu troco gente toda hora.',
    revela: 'Lidera todos do mesmo jeito. Contrata e gere sem ler perfil.',
    aprofunde: ['Quantas pessoas saíram no último ano?', 'Quanto te custa cada troca?'],
    consciencia: 'O problema não é a pessoa, é o encaixe entre perfil, função e liderança.',
    gatilhos: ['Se o time estivesse perfeito amanhã, a empresa andaria sem você?', 'Você tem indicadores claros de cada área?', 'Quantas decisões por dia passam pela sua mesa?', 'Você planeja o mês ou reage ao mês?'],
    novaDor: 'O time é bom, mas a empresa não tem processo nem número. Vivo apagando incêndio.',
    frase: 'Pessoas certas resolvem metade. A outra metade é a máquina: processo e número.',
    como: 'Elogie a evolução do time e pergunte pelo resultado. A falta de método aparece sozinha.',
    story: ['Um empresário montou o time pelos perfis, e o clima melhorou.', 'Mas o resultado não subiu na mesma proporção.', 'Cada um fazia bem a sua parte, sem processo nem meta comum.', 'Ele continuava no centro de tudo, apagando incêndio.', 'Organizar a gestão e o resultado: BHP.'],
    pensa: 'Lidera todos igual', pergunta: 'Quanto custa cada troca?', dor: 'Time desalinhado' },
  { sig: 'BHP', nome: 'BHP', emo: '📈',
    entrega: 'gestão de negócios com método e mais de 28 ferramentas. Sair do incêndio e liderar resultado.',
    diz: 'Vivo apagando incêndio. Se eu paro, a empresa para.',
    revela: 'Empresa sem método de gestão. O dono é a operação.',
    aprofunde: ['Quando foram suas últimas férias sem celular?', 'Que número da empresa você acompanha toda semana?'],
    consciencia: 'Crescimento vem de método, não de esforço.',
    gatilhos: ['Com os processos rodando, quem decide quando você não está?', 'Você tem alguém pronto para te substituir?', 'Seus gestores executam ou lideram?', 'O que acontece se você ficar 30 dias fora?'],
    novaDor: 'O processo existe, mas não tenho líderes. Tudo volta pra mim.',
    frase: 'Processo sem líder volta para a sua mesa. O próximo passo é formar quem conduz.',
    como: 'Pergunte pelo dia em que ele não estiver. A falta de líderes é a resposta dele, não a sua.',
    story: ['A dona de uma rede organizou processos e indicadores.', 'Quando abriu a segunda unidade, os números caíram.', 'O processo existia, mas ninguém liderava sem ela.', 'Ela voltou a se dividir entre duas operações.', 'Formar líderes que conduzem sem ela: ML5.'],
    pensa: 'Dono é a operação', pergunta: 'Últimas férias sem celular?', dor: 'Sem método de gestão' },
  { sig: 'ML5', nome: 'ML5', emo: '👑',
    entrega: 'liderança de alto impacto: os 13 princípios e os 5 níveis de liderança.',
    diz: 'Não tenho em quem confiar. Tudo passa por mim.',
    revela: 'Falta de líderes e centralização.',
    aprofunde: ['Quem da equipe poderia assumir mais hoje?', 'O que te impede de delegar?'],
    consciencia: 'Liderança é método e mentalidade: dá para formar.',
    gatilhos: ['O faturamento cresceu. Seu patrimônio cresceu junto?', 'Quanto do que a empresa ganha fica com você?', 'Suas finanças pessoais e as da empresa estão separadas?', 'Se a renda parasse hoje, quantos meses você aguenta?'],
    novaDor: 'Faturo mais, mas o dinheiro não fica comigo.',
    frase: 'Liderança multiplica resultado. A pergunta agora é: esse resultado está virando patrimônio?',
    como: 'Comemore o crescimento e pergunte o que sobrou. O número dele faz a ponte.',
    story: ['Um empresário formou líderes, e o faturamento subiu.', 'No fim do ano, a conta pessoal estava igual.', 'Ganhava mais e gastava mais: o problema era a relação com o dinheiro.', 'Trabalhava para a empresa crescer, não para ele prosperar.', 'Reprogramar a relação com o dinheiro: IF.'],
    pensa: 'Centraliza tudo', pergunta: 'O que te impede de delegar?', dor: 'Falta de líderes' },
  { sig: 'IF', nome: 'IF', emo: '💰',
    entrega: 'reprogramar as crenças sobre dinheiro: ganhar, multiplicar, usufruir e doar.',
    diz: 'Eu ganho bem, mas o dinheiro some.',
    revela: 'Crença financeira e ausência de plano.',
    aprofunde: ['Para onde foi o dinheiro do ano passado?', 'Você sabe quanto custa o seu mês?'],
    consciencia: 'Não é quanto ganha, é o que acredita e faz com o dinheiro.',
    gatilhos: ['Com o dinheiro organizado, de onde vem o próximo salto de renda?', 'Como estão suas vendas hoje (ou as do seu time)?', 'Quantas vendas você perde no preço?', 'Seu time vende com processo ou no feeling?'],
    novaDor: 'Para crescer preciso vender mais, e hoje vendo no feeling.',
    frase: 'Organizar segura o dinheiro. Para ele crescer, precisa entrar mais. E entrar mais é vender melhor.',
    como: 'Pergunte de onde vem o próximo salto. Quase sempre a resposta é vender.',
    story: ['Um profissional liberal organizou as finanças e saiu das dívidas.', 'Mas a renda ficou travada no mesmo teto.', 'Ele perdia cliente na hora do preço e vendia no improviso.', 'Guardava bem, mas crescia pouco.', 'Vender com processo: TAV.'],
    pensa: 'Crença sobre dinheiro', pergunta: 'Para onde foi o dinheiro?', dor: 'Dinheiro que some' },
  { sig: 'TAV', nome: 'TAV', emo: '🎯',
    entrega: 'técnicas avançadas em vendas, da abordagem ao fechamento.',
    diz: 'Vendo no feeling. Quando falam de preço, perco a venda.',
    revela: 'Sem processo comercial. Objeção sem resposta.',
    aprofunde: ['Quantas propostas você perdeu este mês?', 'O que o cliente disse antes de sumir?'],
    consciencia: 'Venda é processo, e processo se aprende.',
    gatilhos: ['No um a um você vai bem. E falando para um grupo?', 'Como você se sai em reunião, palestra ou vídeo?', 'Já deixou de falar numa reunião por insegurança?', 'Seu time compra a ideia quando você apresenta?'],
    novaDor: 'No um a um eu vendo. Para um grupo, eu travo.',
    frase: 'Vender para um é técnica. Convencer muitos de uma vez é outro nível: comunicação.',
    como: 'Pergunte pela última reunião ou apresentação dele. A insegurança aparece no relato.',
    story: ['Um consultor dominou o processo de vendas e bateu meta.', 'Promovido a líder, passou a conduzir a reunião do time.', 'A técnica de venda não resolvia a voz trêmula nem a falta de presença.', 'O time não comprava as ideias dele.', 'Comunicar e convencer muitos: CEOP.'],
    pensa: 'Sem processo de venda', pergunta: 'Quantas perdeu este mês?', dor: 'Perde no preço' },
  { sig: 'CEOP', nome: 'CEOP', emo: '🎤',
    entrega: 'comunicação eficaz e oratória persuasiva: storytelling, presença e o fim do medo de falar.',
    diz: 'Travo para falar em público. Sei o que dizer e não convenço.',
    revela: 'Medo de exposição e falta de técnica de comunicação.',
    aprofunde: ['Quantas oportunidades passaram por você não falar?', 'Como você se sente antes de apresentar?'],
    consciencia: 'A comunicação define o tamanho da liderança.',
    gatilhos: ['Agora que você influencia muita gente, o que quer deixar nelas?', 'Quer só falar bem ou transformar quem te escuta?', 'Já pensou em conduzir processos de transformação?', 'Qual legado você quer construir?'],
    novaDor: 'Eu inspiro, mas quero transformar as pessoas de verdade.',
    frase: 'Falar bem move as pessoas por um dia. Transformar em profundidade é o topo da jornada.',
    como: 'Pergunte pelo impacto que ele quer deixar. O desejo de legado é a ponte.',
    story: ['Um líder passou a palestrar com segurança.', 'A plateia saía empolgada e, semanas depois, nada mudava.', 'Ele inspirava, mas não sabia transformar crenças profundas.', 'O impacto dele era passageiro.', 'Transformar pessoas em profundidade: Master Coaching.'],
    pensa: 'Medo de exposição', pergunta: 'O que já passou por não falar?', dor: 'Trava em público' },
  { sig: 'Master', nome: 'Master Coaching', emo: '🏆',
    entrega: 'perícia em coaching e desenvolvimento humano pela reprogramação profunda de crenças.',
    diz: 'Quero ir ao nível mais profundo e transformar pessoas de verdade.',
    revela: 'Busca de domínio e de legado.',
    aprofunde: ['Quem você quer transformar?', 'O que te falta para chegar lá?'],
    consciencia: 'O topo integra todas as competências anteriores.',
    gatilhos: ['Do que conversamos, quantas dessas dores você reconheceu em você?', 'Se resolver só uma, o que acontece com as outras?', 'Faz sentido tratar isso como jornada, e não como cursos soltos?'],
    novaDor: 'Cada degrau depende do anterior. Um curso só não segura.',
    frase: 'Você viu que cada dor resolvida revelou a próxima. Isso tem nome: Green Golden Belt.',
    como: 'Recapitule as dores com as palavras dele. A grade completa vira conclusão dele, não oferta sua.',
    story: ['Um aluno fez um curso, depois outro, ao longo de anos, sem ordem.', 'Cada um empolgava e depois esfriava.', 'As dores estavam ligadas: faltava a base para segurar a próxima.', 'Foram anos e dinheiro gastos em recomeços.', 'A jornada inteira, na ordem: Green Golden Belt.'],
    pensa: 'Busca legado', pergunta: 'O que te falta para chegar lá?', dor: 'Quer ir ao topo' },
];
const prox = i => (i < 8 ? T[i + 1].nome : 'Grade completa');
const proxCurto = i => (i < 8 ? T[i + 1].sig : 'GGB');

function tnote(min, html) {
  return `      <div class="tnote">
        <div class="tk">🎤 Roteiro do treinador <span>${min} min</span></div>
        <p>${html}</p>
      </div>`;
}
function slide(inner, attrs = '') { return `    <section class="slide"${attrs}>\n${inner}\n    </section>\n`; }
function header(blk, cls, title, sub) {
  return `      <header class="slide-header">
        <div>
          <span class="blk ${cls}">${blk}</span>
          <h2 class="slide-title">${title}</h2>${sub ? `\n          <p class="slide-subtitle">${sub}</p>` : ''}
        </div>
      </header>`;
}

let S = '';

// 1 — Capa
S += `    <section class="slide module-cover">
      <div class="slide-header" style="border:0; justify-content:center;">
        <span class="module-badge">Treinamento GGB · Na venda</span>
      </div>
      <div class="slide-body" style="align-items:center; text-align:center;">
        <h1 class="slide-title">Empilhar 1 por 1<br><span style="color:#fff; font-size:44px; font-weight:600;">a jornada comercial dos 9 treinamentos</span></h1>
        <p class="lead" style="max-width:920px;"><b>Eu não vendo o próximo treinamento. Eu descubro a próxima dor.</b><br>
        Cada dor resolvida revela a seguinte, e o cliente chega sozinho à grade completa.<br>
        <span style="color: var(--cis-muted); font-size:18px;">Playbook de bolso para ligação e WhatsApp: diagnóstico antes da oferta, sempre.</span></p>
      </div>
${tnote(2, 'Abra perguntando: <b>“quem aqui já ouviu ‘você só quer me vender outro curso’?”</b> Deixe as mãos subirem. Hoje a gente aprende o contrário: o cliente descobre a próxima dor com as próprias palavras, e o próximo treinamento vira necessidade dele. <b>Tecla T</b> liga e desliga este roteiro.')}
    </section>
`;

// 2 — Regra de ouro (Como usar)
S += slide(`${header('Como usar', 'b0', 'A regra de ouro', 'Uma frase para memorizar. O resto do material é aplicação dela.')}
      <div class="slide-body">
        <div class="regra">
          <div class="k">💎 Regra de ouro do consultor</div>
          <p>“Eu não vendo o próximo treinamento. Eu descubro a próxima dor.”</p>
        </div>
        <div class="seq cadeia">
          <div class="step"><span class="n">1</span><h4>Dor</h4><p>O cliente fala o problema com as palavras dele.</p></div>
          <div class="step"><span class="n">2</span><h4>Consequência</h4><p>Você pergunta o que isso já custou. Ele sente o peso.</p></div>
          <div class="step"><span class="n">3</span><h4>Treinamento</h4><p>Só agora entra o treinamento que resolve aquela dor.</p></div>
          <div class="step"><span class="n">4</span><h4>Nova dor</h4><p>Uma pergunta-gatilho mostra o que aparece depois de resolver.</p></div>
          <div class="step"><span class="n">5</span><h4>Próximo nível</h4><p>Ele mesmo pede o próximo passo. Repita até a grade completa.</p></div>
        </div>
        <div class="grid grid-3 como-aplica">
          <div class="card ghost"><h3>Pergunte antes de oferecer</h3><p class="muted">Sem dor dita por ele, não existe próximo treinamento.</p></div>
          <div class="card ghost"><h3>Siga a dor, não a ordem</h3><p class="muted">Se ele revelar a dor de outro degrau, vá para ele.</p></div>
          <div class="card ghost"><h3>Deixe ele concluir</h3><p class="muted">A frase “eu preciso resolver isso” tem que sair da boca dele.</p></div>
        </div>
      </div>
${tnote(4, 'Faça a sala repetir a regra em voz alta três vezes. Depois revele a cadeia passo a passo e pergunte: <b>“em qual desses passos vocês costumam pular direto para a oferta?”</b> Quase sempre é o 2: ninguém pergunta o que a dor já custou.')}`);

// 3 — Mapa da jornada
S += slide(`${header('Bloco 1 • O mapa', 'b1', 'Mapa da jornada comercial', 'Dor → treinamento → nova dor → próximo treinamento → … → grade completa.')}
      <div class="slide-body">
        <div class="mapa-j">
          <div class="no ini"><span class="d">Dor de entrada</span><b>“Sei o que fazer e não faço”</b></div>
${T.map((t, i) => `          <div class="no"><b>${t.emo} ${t.nome}</b><span class="d">→ “${t.novaDor}”</span></div>`).join('\n')}
          <div class="no fim"><b>🥋 Grade completa · Green Golden Belt</b><span class="d">“Eu preciso da jornada inteira.”</span></div>
        </div>
      </div>
${tnote(3, 'Leia o mapa como uma conversa: <b>cada seta é uma frase que o cliente diz</b>, não um produto que você oferece. Pergunte à sala qual dessas frases eles mais ouvem. É por ela que costumam entrar, e a pilha se monta a partir dali.')}`, ' id="empMapa"');

// 4.. — por treinamento: Diagnóstico + Ponte
T.forEach((t, i) => {
  const n = i + 1;
  S += slide(`${header(`Bloco 2 • Degrau ${n} de 9 · Diagnóstico`, 'b2', `${n} · ${t.nome} <span class="emo">${t.emo}</span>`)}
      <div class="slide-body">
        <div class="emp">
          <div><div class="pilha-cap">A pilha</div><div class="pilha" data-at="${n}"></div></div>
          <div class="dir">
            <div class="diag">
              <div><span class="k">💬 Se ele disser</span>“${t.diz}”</div>
              <div><span class="k">🔎 Isso revela</span>${t.revela}</div>
              <div><span class="k">❓ Aprofunde com</span>${t.aprofunde.map(q => '“' + q + '”').join(' ')}</div>
              <div><span class="k">💡 Gere consciência</span>${t.consciencia}</div>
            </div>
            <p class="entrega"><strong>${t.nome} entrega:</strong> ${t.entrega}</p>
            <div class="gat-cap">Perguntas-gatilho · descubra a próxima dor</div>
            <div class="script-list gat">
${t.gatilhos.map((q, k) => `              <div class="item"><span class="n">${k + 1}</span><div><p>“${q}”</p></div></div>`).join('\n')}
            </div>
            <p class="sinal">Se ele responder <b>“${t.novaDor}”</b> → avance para <em>${prox(i)}</em></p>
          </div>
        </div>
      </div>
${tnote(3, `Leia o “Se ele disser” e peça para a sala completar o “Aprofunde com” antes de você mostrar. Depois revele as perguntas-gatilho uma a uma e pergunte: <b>qual delas vocês fariam no WhatsApp?</b> A linha verde é o sinal: só avance para ${prox(i)} quando o cliente disser algo parecido.`)}`);

  const lbl = ['Situação', 'Problema', 'Descoberta', 'Consequência', 'Necessidade'];
  S += slide(`${header(`Bloco 2 • Ponte ${n} → ${i < 8 ? n + 1 : 'grade'}`, 'b2', `${t.sig} → ${proxCurto(i)}`, `Como fazer a transição: ${t.como[0].toLowerCase() + t.como.slice(1)}`)}
      <div class="slide-body">
        <div class="hist-cap">📖 Storytelling · 30 segundos</div>
        <div class="seq hist">
${t.story.map((s, k) => `          <div class="step"><span class="n">${k + 1}</span><h4>${lbl[k]}</h4><p>${s}</p></div>`).join('\n')}
        </div>
        <div class="regra">
          <div class="k">🗣️ Frase de transição</div>
          <p>“${t.frase}”</p>
        </div>
      </div>
${tnote(3, `Conte a história em voz alta, um passo por vez, em no máximo 40 segundos. Depois peça para um consultor contá-la <b>trocando pelo caso de um cliente real dele</b>. A frase de transição só entra depois que o cliente reconhecer a própria situação na história.`)}`);
});

// Tabela playbook (2 slides)
function linhaTab(t, i) {
  // A linha leva ao treinamento que resolve a fala; a transição é a que entra nele.
  const entra = i === 0 ? 'Isso não é falta de conhecimento, é crença. É exatamente aí que o CIS trabalha.' : T[i - 1].frase;
  return `            <tr><td>“${t.diz}”</td><td>${t.revela}</td><td>“${t.aprofunde[0]}”</td><td>${t.consciencia}</td><td><b>${t.emo} ${t.sig}</b></td><td>“${entra}”</td></tr>`;
}
const linhaGrade = `            <tr><td>“Cada coisa que eu resolvo abre outra.”</td><td>As dores estão ligadas. Curso solto não segura.</td><td>“Se resolver só uma, o que acontece com as outras?”</td><td>Não são cursos, é uma jornada em ordem.</td><td><b>🥋 GGB</b></td><td>“${T[8].frase}”</td></tr>`;
const thead = `<thead><tr><th>Se o cliente disser…</th><th>O que revela</th><th>Aprofunde com…</th><th>Gere consciência sobre…</th><th>Treinamento</th><th>Como fazer a transição</th></tr></thead>`;
[[0, 5], [5, 9]].forEach(([a, b], k) => {
  S += slide(`${header(`Bloco 3 • Playbook · ${k + 1} de 2`, 'b3', 'Se ele disser isso, eu avanço para aquilo')}
      <div class="slide-body">
        <table class="cis-table tab-play">
          ${thead}
          <tbody>
${T.slice(a, b).map((t, j) => linhaTab(t, a + j)).join('\n')}${b === 9 ? '\n' + linhaGrade : ''}
          </tbody>
        </table>
      </div>
${tnote(4, 'Esta é a tabela de consulta. Não leia linha por linha: escolha <b>uma fala do cliente</b>, peça para alguém dizer qual é o próximo treinamento e a transição, e confira na linha.')}`, ' id="tabPlay' + (k + 1) + '"');
});

// Modo rápido
S += slide(`${header('Bloco 3 • Modo rápido', 'b3', 'Na ligação: fala → pensa → pergunta → dor → próximo')}
      <div class="slide-body">
        <table class="cis-table tab-rapido">
          <thead><tr><th>Cliente fala</th><th>Você pensa</th><th>Pergunta</th><th>Dor</th><th>Treinamento</th></tr></thead>
          <tbody>
${T.map(t => `            <tr><td>“${t.diz.split('.')[0]}”</td><td>${t.pensa}</td><td>“${t.pergunta}”</td><td>${t.dor}</td><td><b>${t.emo} ${t.sig}</b></td></tr>`).join('\n')}
          </tbody>
        </table>
      </div>
${tnote(3, 'Este slide é para deixar aberto durante a ligação. Treine em dupla: um lê a fala do cliente, o outro responde só com a pergunta, <b>sem dizer o nome do treinamento</b>. O nome só aparece depois da dor confirmada.')}`, ' id="tabRapido"');

// Frases de transição
S += slide(`${header('Bloco 3 • Frases de transição', 'b3', 'Frases de transição', 'Curtas, para falar ou mandar no WhatsApp.')}
      <div class="slide-body">
        <div class="coringas">
          <span>“Interessante você trazer isso. Normalmente, quando resolvemos esse ponto, aparece outro desafio…”</span>
          <span>“Então talvez o problema não esteja só em X. O que está acontecendo com Y?”</span>
          <span>“É justamente aqui que entra o próximo nível.”</span>
        </div>
        <div class="frases">
${T.map(t => `          <div><b>${t.sig} → ${proxCurto(T.indexOf(t))}</b>“${t.frase}”</div>`).join('\n')}
        </div>
      </div>
${tnote(4, 'As três coringas de cima servem em qualquer degrau. As 9 de baixo são a sequência padrão; nos próximos 9 slides está a matriz completa, para quando a dor do cliente pular degraus. Peça para cada um escolher <b>as 3 que mais vai usar</b> e reescrever com as próprias palavras.')}`, ' id="frasesT" data-frases');

// Matriz de transições: de cada treinamento para todos os outros + grade completa (9 × 9 = 81)
// MATRIZ[sig] segue a ordem de T; a posição do próprio treinamento é a saída para a GGB.
const MATRIZ = {
  CIS: [
    'O CIS abre a porta. As outras dores que você me contou têm cada uma o seu degrau: essa é a GGB.',
    null,
    'Você já se entende por dentro. E as pessoas do seu time, você consegue ler cada uma?',
    'Emoção no lugar ajuda a decidir. Mas a sua empresa cresce por método ou pelo seu esforço?',
    'Quem se domina está pronto para liderar. Quem toca as coisas quando você não está?',
    'A crença travava a sua ação. Será que ela também trava o seu dinheiro?',
    'Sem autossabotagem, sobra coragem. Falta a técnica para transformar isso em venda.',
    'Você destravou por dentro. Quando precisa falar para um grupo, isso aparece por fora?',
    'Você viveu a transformação. Já pensou em conduzir isso em profundidade nos outros?',
  ],
  FCIS: [
    'Para dominar o método, você precisa tê-lo vivido por dentro. Isso é o CIS.',
    'O FCIS te dá o método. As outras dores que você me contou têm cada uma o seu degrau: essa é a GGB.',
    null,
    'Você já sabe conduzir pessoas. A empresa tem processo para elas entregarem resultado?',
    'Conduzir uma pessoa é método. Formar líderes que conduzem outras é o próximo nível.',
    'Você domina o método para a vida. E para o dinheiro, ele já chegou lá?',
    'Quem sabe fazer boas perguntas está a um passo de vender bem. Falta o processo comercial.',
    'No um a um você conduz. Para uma sala inteira, a comunicação muda.',
    'O FCIS forma o coach. O Master leva esse domínio ao nível mais profundo.',
  ],
  FGPC: [
    'Você aprendeu a ler o perfil dos outros. E o seu, o que ainda te trava?',
    'Ler o perfil é o começo. Conduzir cada pessoa numa mudança real exige método.',
    'Time certo resolve gente. Empresa, dinheiro e liderança são os próximos degraus: é a GGB.',
    null,
    'Com o time certo, o próximo passo é transformar os melhores em líderes.',
    'Você reduziu a troca de gente e o custo dela. O que sobra está virando patrimônio?',
    'Você lê o perfil do time. Imagine usar isso para ler o perfil do cliente na venda.',
    'Cada perfil ouve de um jeito. Falar para todos ao mesmo tempo é comunicação.',
    'Entender pessoas é gestão. Transformar pessoas em profundidade é o topo.',
  ],
  BHP: [
    'A empresa ganhou método. E você, ainda se sabota quando a pressão aperta?',
    'Processo organiza a empresa. Conduzir as pessoas na mudança exige outro método.',
    'O processo está pronto. As pessoas certas estão nos lugares certos para rodá-lo?',
    'Empresa organizada é um degrau. Líderes, dinheiro e vendas completam a jornada: é a GGB.',
    null,
    'A empresa ficou previsível. O seu dinheiro pessoal também?',
    'Com a casa organizada, a alavanca é vender mais. Seu comercial tem processo?',
    'Você tem números e estratégia. Consegue apresentar isso e engajar o time?',
    'Você domina a gestão. O próximo nível é transformar as pessoas que fazem ela andar.',
  ],
  ML5: [
    'Você forma líderes. As suas próprias crenças ainda limitam até onde você vai?',
    'Líder que desenvolve gente precisa de método para conduzir mudança. Isso é o FCIS.',
    'Liderar é método. Liderar cada perfil do jeito certo é o FGPC.',
    'Os líderes estão prontos. Eles têm processo e indicador para seguir?',
    'Liderança multiplica. Dinheiro, vendas e comunicação fazem isso durar: é a GGB.',
    null,
    'Seus líderes conduzem o time. O time comercial vende com processo?',
    'Liderança se mede pela forma como você comunica. Sua voz move o time?',
    'Você forma líderes. O Master te prepara para transformar pessoas em profundidade.',
  ],
  IF: [
    'Você mudou a crença sobre dinheiro. Imagine fazer isso nas outras áreas da vida.',
    'Você reprogramou uma crença. Dominar o método por trás disso é o FCIS.',
    'Seu dinheiro está organizado. Na empresa, o maior custo não é a troca de gente?',
    'As finanças pessoais estão em ordem. As da empresa têm a mesma gestão?',
    'Para o patrimônio crescer sem você, alguém precisa liderar no seu lugar.',
    'Dinheiro organizado é um degrau. Vender, comunicar e liderar fazem ele crescer: é a GGB.',
    null,
    'Mais renda vem de mais influência. Como você se sai apresentando suas ideias?',
    'Você venceu a crença do dinheiro. O Master trabalha as crenças mais profundas.',
  ],
  TAV: [
    'Você domina a técnica. Mas, na hora do não, o emocional segura?',
    'Venda boa é pergunta boa. O FCIS aprofunda a arte de conduzir pela pergunta.',
    'Você vende bem. E o seu time, cada perfil vende do jeito certo?',
    'As vendas subiram. A empresa tem estrutura para entregar esse volume?',
    'Você vende bem sozinho. Formar líderes que multiplicam isso é o ML5.',
    'Você vende mais. Esse dinheiro está ficando ou indo embora?',
    'Vender bem é um degrau. Comunicar, liderar e prosperar completam a jornada: é a GGB.',
    null,
    'Você persuade. O Master ensina a transformar quem está do outro lado.',
  ],
  CEOP: [
    'Sua voz ficou segura. E a voz de dentro, ainda te sabota?',
    'Você inspira um público. Conduzir cada pessoa numa mudança real é o FCIS.',
    'Você fala bem para o grupo. Sabe falar com cada perfil do time?',
    'Você apresenta muito bem. A empresa por trás do discurso está organizada?',
    'Comunicação é a ferramenta do líder. O ML5 transforma isso em liderança.',
    'Sua palavra gera oportunidades. O dinheiro delas está ficando com você?',
    'Você convence uma sala. Fechar a venda no um a um tem técnica própria.',
    'Comunicar bem é um degrau. Com a jornada inteira, sua palavra tem o que sustentar: é a GGB.',
    null,
  ],
  Master: [
    'Quem transforma os outros revisita a própria base. O CIS é onde ela está.',
    'O Master aprofunda. O FCIS certifica o método que sustenta tudo.',
    'Você transforma pessoas. Aplicar isso no time, perfil por perfil, é o FGPC.',
    'Transformar pessoas gera resultado. A empresa tem método para escalar isso?',
    'Você transforma indivíduos. Formar líderes que transformam outros é o ML5.',
    'Você domina crenças profundas. As crenças sobre dinheiro também?',
    'Você transforma pessoas. Transformar isso em vendas é técnica: TAV.',
    'Você transforma no um a um. Levar isso a plateias é o CEOP.',
    null,
  ],
};
// Coringas por origem: servem para qualquer destino saindo daquele treinamento.
const CORINGAS = {
  CIS: ['Agora que você destravou por dentro, o que ainda trava por fora?', 'Quando você mudou, qual foi o próximo desafio que apareceu?'],
  FCIS: ['Você domina o método. Onde ele ainda não chegou na sua vida?', 'Com quem fica mais difícil aplicar o que você aprendeu?'],
  FGPC: ['Com o time certo, o que ainda depende de você?', 'Onde as pessoas ainda emperram o resultado?'],
  BHP: ['Com a empresa organizada, qual é o gargalo agora?', 'O que ainda passa pela sua mesa todo dia?'],
  ML5: ['Com os líderes formados, o que ainda não cresce?', 'O resultado multiplicou. O que ficou para trás?'],
  IF: ['Com o dinheiro organizado, de onde vem o próximo salto?', 'O que falta para esse dinheiro crescer?'],
  TAV: ['Vendendo mais, o que começou a pesar?', 'Onde a técnica sozinha não resolve?'],
  CEOP: ['Falando bem, o que você quer que as pessoas façam depois?', 'Onde a sua palavra ainda não chega?'],
  Master: ['Com o domínio que você tem, que área ainda ficou para trás?', 'Onde você ainda não aplicou o que domina?'],
};
T.forEach((t, i) => {
  const cards = T.map((d, j) => {
    const ggb = j === i;
    const txt = ggb ? null : (MATRIZ[t.sig][j] || t.frase);
    const seq = !ggb && j === i + 1;
    if (ggb) {
      return { k: 99, html: `          <div class="ggb"><b>${t.sig} → 🥋 GGB</b>“${MATRIZ[t.sig][i] || T[8].frase}”</div>` };
    }
    return { k: j, html: `          <div${seq ? ' class="seqp"' : ''}><b>${t.sig} → ${d.sig}${seq ? ' · sequência' : ''}</b>“${txt}”</div>` };
  }).sort((a, b) => a.k - b.k).map(c => c.html);
  S += slide(`${header(`Bloco 3 • Matriz · ${i + 1} de 9`, 'b3', `Saindo do ${t.nome} <span class="emo">${t.emo}</span>`, 'Para qualquer dor que aparecer depois deste treinamento.')}
      <div class="slide-body">
        <div class="coringas">
${CORINGAS[t.sig].map(c => `          <span>“${c}”</span>`).join('\n')}
          <span>“É justamente aqui que entra o próximo nível.”</span>
        </div>
        <div class="frases">
${cards.join('\n')}
        </div>
      </div>
${tnote(3, `Use este slide quando o cliente já tem o ${t.nome} (ou acabou de fechar) e revela uma dor fora da sequência. Primeiro a coringa, para abrir a dor; depois a frase do destino que a dor apontou. Peça para a sala achar <b>o destino pela dor</b>, não pela ordem.`)}`, ' data-frases');
});

// Recapitular
S += slide(`${header('Bloco 4 • Fechar a jornada', 'b4', 'Recapitule as dores e peça o sim', 'As dores que ele confirmou viram o argumento final.')}
      <div class="slide-body">
        <div class="emp">
          <div><div class="pilha-cap">A pilha</div><div class="pilha" data-at="10"></div></div>
          <div class="script-list recap">
            <div class="item"><span class="n">1</span><div><h4>Recapitule com as palavras dele</h4><p>“Você me disse que trava, que o time não entrega e que vive no incêndio. Cada um desses tem um degrau.”</p></div></div>
            <div class="item"><span class="n">2</span><div><h4>Mostre a ligação</h4><p>“Percebe que, quando resolve um, aparece o outro? Por isso um curso solto não segura.”</p></div></div>
            <div class="item"><span class="n">3</span><div><h4>Peça o sim e silencie</h4><p>“Faz sentido a gente começar pela base, já com a jornada inteira garantida?” Depois, silêncio.</p></div></div>
          </div>
        </div>
      </div>
${tnote(5, 'Faça em dupla: um é o cliente e diz 3 dores; o outro recapitula <b>usando as palavras exatas</b> e pede o sim. Cronometre: a recapitulação inteira cabe em 40 segundos.')}`);

// Erros
S += slide(`${header('Bloco 4 • Fechar a jornada', 'b4', 'Erros que devem ser evitados')}
      <div class="slide-body">
        <div class="naofaca" style="flex:1;">
          <h3>🚫 Não faça isso</h3>
          <ul class="x-list">
            <li><b>Oferecer antes de diagnosticar.</b> Sem a dor dita por ele, o próximo curso parece empurrado.</li>
            <li><b>Seguir a ordem da grade.</b> O próximo treinamento é o da dor revelada, não o do número seguinte.</li>
            <li><b>Inventar dor.</b> Se ele não sente aquilo, não force. Faça outra pergunta-gatilho.</li>
            <li><b>Pular a consequência.</b> Dor sem custo não gera decisão. Pergunte o que aquilo já custou.</li>
            <li><b>Despejar a grade no começo.</b> O cliente vê custo, não caminho. A grade aparece no fim, como conclusão.</li>
          </ul>
        </div>
        <div class="regra">
          <div class="k">💎 Regra de ouro</div>
          <p>Eu não vendo o próximo treinamento. Eu descubro a próxima dor.</p>
        </div>
      </div>
${tnote(3, 'O erro mais comum é o segundo: <b>seguir a grade em vez da dor.</b> Peça um exemplo de venda em que o consultor ofereceu “o próximo da lista” e o cliente esfriou.')}`);

// Resumo + Aplique
S += slide(`${header('Bloco 4 • Fechar a jornada', 'b4', 'Fecho do bloco')}
      <div class="slide-body">
        <div class="cols-aside">
          <div class="impacto">
            <h3>⚡ Resumo de impacto</h3>
            <ul class="dot-list">
              <li>Diagnóstico antes da oferta, sempre.</li>
              <li>Cada treinamento resolve uma dor e revela a próxima.</li>
              <li>A pergunta-gatilho faz o cliente dizer a nova dor.</li>
              <li>A história mostra que outro cliente passou pelo mesmo.</li>
              <li>A grade completa é a conclusão dele, não a sua oferta.</li>
            </ul>
          </div>
          <div class="aplique">
            <h3>🎯 Aplique agora</h3>
            <ol>
              <li><b>Agora, 10 min:</b> escolha <b>3 pontes</b> e reescreva a história com um caso real seu.</li>
              <li><b>Critério:</b> cada história tem os 5 passos e cabe em 40 segundos.</li>
              <li><b>Em 48h:</b> use uma pergunta-gatilho numa conversa real e volte com a resposta do cliente.</li>
            </ol>
          </div>
        </div>
      </div>
${tnote(12, 'As 3 histórias reescritas são o entregável deste módulo. <b>Não deixe ninguém sair sem elas.</b> Recolha, leia depois e devolva com correções na reunião seguinte.')}`);

// Eu aprendi?
S += slide(`${header('Fecho', 'b0', '<span class="emo">✅</span> Eu aprendi?', 'Marque só o que você consegue fazer agora, sem consultar o material.')}
      <div class="slide-body">
        <div class="check" style="flex:1;">
          <div class="it">Sei dizer a <b>regra de ouro</b> de cor?</div>
          <div class="it">Reconheço a <b>fala do cliente</b> que leva a cada treinamento?</div>
          <div class="it">Pergunto a <b>consequência</b> antes de oferecer?</div>
          <div class="it">Tenho <b>uma pergunta-gatilho</b> pronta para cada degrau?</div>
          <div class="it">Conto uma <b>história de transição</b> em até 40 segundos?</div>
          <div class="it">Sigo a <b>dor revelada</b>, não a ordem da grade?</div>
          <div class="it">Uso as <b>frases de transição</b> sem parecer script?</div>
          <div class="it">Recapitulo as dores e <b>sustento o silêncio</b> depois do pedido?</div>
        </div>
      </div>
${tnote(3, 'Peça honestidade: <b>“quem marcou menos de 6?”</b> Ninguém precisa levantar a mão. O objetivo é que cada um saiba o próprio gap antes do teste.')}`);

// Teste
S += slide(`${header('Teste rápido', 'b0', 'O cliente diz. Para onde você vai?', 'Responda antes de revelar. A coluna da direita é o gabarito.')}
      <div class="slide-body">
        <table class="cis-table por-celula">
          <thead><tr><th style="width:42%;">O cliente diz</th><th>O que você faz</th></tr></thead>
          <tbody>
            <tr><td><b>1.</b> “Depois que organizei a empresa, tudo ainda volta pra minha mesa.”</td><td>Dor de líderes. Aprofunde: “o que acontece se você ficar 30 dias fora?” → <b>ML5</b>.</td></tr>
            <tr><td><b>2.</b> Ele fez o CIS e você quer oferecer o FCIS porque “é o próximo”.</td><td>Não ofereça ainda. Faça uma pergunta-gatilho e espere a dor dele aparecer.</td></tr>
            <tr><td><b>3.</b> “Meu faturamento dobrou, mas eu continuo sem reserva.”</td><td>Dor financeira. Pergunte para onde foi o dinheiro → <b>IF</b>.</td></tr>
            <tr><td><b>4.</b> “No WhatsApp eu vendo bem, mas na reunião com o time eu travo.”</td><td>Dor de comunicação. Conte a história TAV → CEOP e use a frase de transição.</td></tr>
            <tr><td><b>5.</b> “Você só quer me vender outro curso.”</td><td>Volte ao diagnóstico: “faz sentido. Me conta: o que mudou desde o último treinamento?”</td></tr>
          </tbody>
        </table>
      </div>
${tnote(6, 'A situação aparece sozinha: leia em voz alta, <b>deixe dois responderem</b> e só então revele o gabarito. A questão 2 é a que mais separa quem entendeu a regra de ouro.')}`);

// Encerramento
S += slide(`${header('Encerramento', 'b0', 'O que você leva daqui')}
      <div class="slide-body">
        <div class="grid grid-4">
          <div class="card"><h3>1 · Diagnóstico</h3><p>Antes de qualquer oferta, a dor dita por ele.</p></div>
          <div class="card"><h3>2 · Consequência</h3><p>Pergunto o que a dor já custou.</p></div>
          <div class="card"><h3>3 · Nova dor</h3><p>A pergunta-gatilho revela o próximo degrau.</p></div>
          <div class="card"><h3>4 · Jornada</h3><p>A grade completa é a conclusão dele.</p></div>
        </div>
        <p class="pullquote">“Eu não vendo o próximo treinamento. Eu descubro a próxima dor.”<cite>Regra de ouro do Closer GGB</cite></p>
        <div class="end-cta">
          <a class="home-button" href="../treinamento-ggb/index.html" style="position:static;">📚 Voltar ao Treinamento Comercial GGB ▶</a>
        </div>
      </div>
${tnote(3, 'Feche com o compromisso: <b>cada um diz em voz alta qual pergunta-gatilho vai usar na próxima conversa</b>. Anote e cobre na semana seguinte.')}`);

const CSS = `
  /* ===== Pilha: 9 blocos, o 1 embaixo, o 9 em cima ===== */
  .emp { display: grid; grid-template-columns: 210px 1fr; gap: 26px; flex: 1; min-height: 0; }
  .pilha { display: flex; flex-direction: column-reverse; gap: 5px; justify-content: flex-start; }
  .pilha .bl {
    display: grid; grid-template-columns: 24px 1fr; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 9px; font-size: 14px; font-weight: 700;
    border: 1px dashed rgba(255,255,255,0.14); color: rgba(242,247,240,0.32);
    background: transparent;
  }
  .pilha .bl b {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 999px; font-size: 12px;
    background: rgba(255,255,255,0.06); color: inherit;
  }
  .pilha .bl.feito { border: 1px solid rgba(230,180,34,0.35); color: var(--cis-yellow-soft); background: rgba(230,180,34,0.08); }
  .pilha .bl.feito b { background: rgba(230,180,34,0.25); }
  .pilha .bl.agora {
    border: 1px solid var(--cis-yellow); color: var(--cis-blue-900);
    background: linear-gradient(90deg, var(--cis-yellow), var(--cis-yellow-soft));
    box-shadow: 0 8px 22px -10px rgba(230,180,34,0.8); transform: translateX(8px);
  }
  .pilha .bl.agora b { background: var(--cis-blue-900); color: var(--cis-yellow); }
  .pilha-cap, .gat-cap, .hist-cap { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--cis-muted); font-weight: 800; margin-bottom: 8px; }

  /* Diagnóstico */
  .dir { display: flex; flex-direction: column; min-width: 0; }
  .diag { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
  .diag > div { background: var(--cis-card-bg); border: 1px solid var(--cis-card-border); border-radius: 10px; padding: 8px 12px; font-size: 14px; line-height: 1.4; }
  .diag > div:first-child { border-color: rgba(155,180,255,0.45); background: rgba(155,180,255,0.06); }
  .diag .k { display: block; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; font-weight: 800; color: var(--cis-yellow); margin-bottom: 2px; }
  .diag > div:first-child .k { color: #9bb4ff; }
  .entrega { font-size: 13.5px; color: var(--cis-muted); border-left: 3px solid var(--cis-yellow); padding: 2px 0 2px 10px; margin: 0 0 10px; line-height: 1.4; }
  .entrega strong { color: var(--cis-yellow); }
  .gat { display: grid !important; grid-template-columns: 1fr 1fr; gap: 8px !important; }
  .gat .item { padding: 8px 12px; grid-template-columns: 26px 1fr; gap: 8px; align-items: center; }
  .gat .item .n { width: 22px; height: 22px; font-size: 12px; }
  .gat .item p { margin: 0; font-size: 14.5px; line-height: 1.35; color: var(--cis-text); }
  .sinal { margin: 10px 0 0; font-size: 14.5px; line-height: 1.4; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(127,224,164,0.45); background: rgba(127,224,164,0.07); }
  .sinal b { color: #fff; }
  .sinal em { color: #7fe0a4; font-style: normal; font-weight: 800; }

  /* Ponte: história em 5 passos */
  .hist .step { padding: 14px 16px; }
  .hist .step h4 { color: var(--cis-yellow); font-size: 13px; letter-spacing: .12em; text-transform: uppercase; }
  .hist .step p { font-size: 18px; line-height: 1.45; color: var(--cis-text); }
  .hist .step:last-child { border-color: rgba(127,224,164,0.55); background: rgba(127,224,164,0.07); }
  .hist .step:last-child h4 { color: #7fe0a4; }
  .seq.hist { margin-bottom: 22px; }
  .hist .step { min-height: 230px; }

  /* Regra de ouro: cadeia */
  .cadeia { margin: 16px 0; }
  .cadeia .step p { font-size: 14px; color: var(--cis-text); }
  .como-aplica .card { padding: 12px 16px; }

  /* Mapa da jornada */
  #empMapa .mapa-j { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  #empMapa .no { position: relative; background: var(--cis-card-bg); border: 1px solid var(--cis-card-border); border-radius: 11px; padding: 14px 14px; display: flex; flex-direction: column; gap: 6px; }
  #empMapa .no b { font-size: 17px; color: var(--cis-yellow); }
  #empMapa .no .d { font-size: 14.5px; color: var(--cis-muted); line-height: 1.35; }
  #empMapa .no.ini { border-color: rgba(155,180,255,0.45); background: rgba(155,180,255,0.06); }
  #empMapa .no.ini b { color: #c9d6ff; }
  #empMapa .no.fim { grid-column: 1 / -1; flex-direction: row; align-items: baseline; gap: 14px; border-color: var(--cis-yellow); background: linear-gradient(160deg, rgba(230,180,34,0.95), rgba(245,165,0,0.92)); }
  #empMapa .no.fim b, #empMapa .no.fim .d { color: var(--cis-blue-900); }
  #empMapa .no.fim b { font-size: 18px; }

  /* Tabelas */
  .tab-play { font-size: 12.5px; }
  .tab-play td { padding: 8px 10px; line-height: 1.35; }
  .tab-play td:first-child { width: 19%; }
  .tab-play td:nth-child(5) { width: 11%; color: #7fe0a4; }
  .tab-rapido { font-size: 13.5px; border-spacing: 0 4px; }
  .tab-rapido td { padding: 6px 12px; }
  .tab-rapido td:last-child { color: #7fe0a4; white-space: nowrap; }

  /* Frases */
  [data-frases] .coringas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
  [data-frases] .coringas span { font-size: 14px; line-height: 1.4; font-style: italic; color: var(--cis-yellow-soft); background: rgba(230,180,34,0.07); border-left: 3px solid var(--cis-yellow); padding: 8px 12px; border-radius: 0 10px 10px 0; }
  [data-frases] .frases { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  [data-frases] .frases div { background: var(--cis-card-bg); border: 1px solid var(--cis-card-border); border-radius: 10px; padding: 8px 12px; font-size: 13.5px; line-height: 1.4; }
  [data-frases] .frases .seqp { border-color: rgba(127,224,164,0.55); background: rgba(127,224,164,0.07); }
  [data-frases] .frases .ggb { border-color: var(--cis-yellow); background: rgba(230,180,34,0.12); }
  [data-frases] .frases .ggb b { color: var(--cis-yellow); }
  [data-frases] .frases b { display: block; color: #7fe0a4; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 2px; }

  .recap .item h4 { font-size: 18px; }
  .recap .item p { font-size: 17px; line-height: 1.5; }
`;

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Empilhar 1 por 1 | Treinamento Comercial GGB · A jornada comercial dos 9 treinamentos</title>
<link rel="stylesheet" href="assets/ggb.css?v=20261002-2" />
<link rel="stylesheet" href="assets/essencial.css?v=20261002-2" />
<link rel="stylesheet" href="assets/treinador.css?v=20261002-2" />
<style>${CSS}</style>
</head>
<body data-marca="Empilhar 1 por 1">

<div class="progress"><span></span></div>
<a class="home-button" href="../treinamento-ggb/index.html">📚 Treinamento GGB</a>

<div class="stage">
  <div class="deck">

${S}
  </div>
</div>

<div class="hud">
  <div class="counter" data-counter></div>
  <div class="nav-buttons">
    <button class="fs-btn" data-nav="fullscreen" title="Tela cheia (F)" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/></svg>
      <span class="fs-label">Tela cheia</span>
    </button>
    <button data-nav="prev" title="Anterior (←)">◀ Anterior</button>
    <button data-nav="next" title="Próximo (→ / Espaço)">Próximo ▶</button>
  </div>
</div>

<script>
  /* Monta a pilha de cada slide: data-at = degrau atual (10 = pilha completa) */
  (function () {
    var NOMES = ${JSON.stringify(T.map(t => t.nome))};
    document.querySelectorAll('.pilha[data-at]').forEach(function (p) {
      var at = Number(p.dataset.at);
      p.innerHTML = NOMES.map(function (n, i) {
        var k = i + 1;
        var cls = k < at ? 'feito' : (k === at ? 'agora' : '');
        return '<div class="bl ' + cls + '"><b>' + k + '</b>' + n + '</div>';
      }).join('');
    });
  })();
</script>
<script src="assets/ggb.js?v=20261002-2"></script>
<script src="assets/essencial.js?v=20261002-2"></script>
</body>
</html>
`;
fs.writeFileSync(OUT, html, 'utf8');
console.log('ok', (S.match(/<section class="slide/g) || []).length, 'slides');
