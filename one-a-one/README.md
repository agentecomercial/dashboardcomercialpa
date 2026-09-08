# Evolui — Feedback contínuo, observações e One a One

Plataforma de gestão de desenvolvimento individual para equipes comerciais.

O ciclo do produto:

```
OBSERVAÇÃO → REGISTRO → EVIDÊNCIA → ONE A ONE → FEEDBACK → PLANO DE AÇÃO → ACOMPANHAMENTO → EVOLUÇÃO
```

## Como abrir

Duplo clique em `index.html`. Não precisa de servidor, build nem internet — são scripts clássicos
(sem `type="module"`), então funciona em `file://`.

A equipe começa **vazia**, pronta para receber as pessoas reais. O material de demonstração
(6 consultores fictícios com observações, feedbacks, One a Ones e planos) fica em
**Configurações › Exemplos**, separado da operação.

## Atalhos

| Atalho | Ação |
|---|---|
| `Ctrl + N` | Nova observação (funciona em qualquer tela) |
| `Ctrl + K` ou `/` | Busca global |
| `Ctrl + Enter` | Salvar dentro de um modal |
| `ESC` | Fechar modal, menu ou painel |
| `G` depois `D` / `E` / `O` / `R` / `F` / `P` / `I` / `C` | Ir para Dashboard, Equipe, One a One, Registros, Feedbacks, Planos, Indicadores, Configurações |

## Arquitetura

```
index.html                 carrega CSS + JS na ordem de dependência
assets/css/
  01-tokens.css            design tokens (cores, tipografia, sombra, motion) — light e dark
  02-base.css              reset, utilitários, animações
  03-layout.css            shell: sidebar, topbar, área principal, nav mobile
  04-components.css        biblioteca de componentes (botão, card, modal, toast, timeline…)
  05-pages.css             estilos específicos de cada módulo
  06-responsive.css        breakpoints + impressão
assets/js/
  core/00-utils.js         helpers puros (DOM, datas, números, texto, arquivos)
  core/01-icons.js         ícones SVG
  core/02-bus.js           barramento de eventos + estado de UI
  core/03-router.js        roteador por hash
  data/20-catalogo.js      catálogos de domínio (tipos, contextos, competências, status)
  data/21-seed.js          dados de demonstração (sempre relativos a hoje)
  services/10-adapter.js   PERSISTÊNCIA PLUGÁVEL (localStorage | memória | REST)
  services/11-db.js        repositórios por coleção, com cache e write-through
  services/12-analise.js   regras de negócio: resumos, alertas, preparação do 1:1, séries
  components/30-ui.js      toast, modal, confirm, tooltip, popover, drawer
  components/31-partes.js  peças reutilizáveis (avatar, badges, cards, timeline, campos)
  components/32-graficos.js gráficos SVG (linha, barras, donut, radar, ranking, sparkline)
  components/4x-*.js       modais de observação, feedback, plano, colaborador, busca, notificações
  pages/5x-*.js            uma página por arquivo
  99-app.js                shell, rotas, tema, atalhos, bootstrap
```

### Base compartilhada (Firebase)

Os três endereços em que o dashboard é aberto — `localhost:5500`, o arquivo local (`file://`) e o
GitHub Pages — leem e gravam a **mesma base**, no Realtime Database que o dashboard já usava
(`dashboardcomercialpa-default-rtdb`, nó `evolui`). Cadastrou um consultor num deles, aparece nos
outros; o `onValue` reflete a mudança sem recarregar.

Isso é possível porque a persistência sempre foi isolada atrás de `App.adapter`: entrou
`FirebaseAdapter` no lugar de `LocalAdapter` e **nenhuma tela mudou**.

O SDK é carregado por um `<script type="module">` **inline** no `index.html` — módulo externo via
`src` é bloqueado em `file://`, e o app precisa abrir por duplo clique. O import é dinâmico e o
boot tem prazo máximo de 12s: sem internet, o app cai no `localStorage`, continua funcionando e
o ícone de sincronização na topbar fica cinza em vez de verde.

Na primeira conexão, se a base compartilhada ainda não tiver **nenhum colaborador real**, a
operação deste navegador é enviada para lá. Havendo operação, nada é sobrescrito.

### Perguntas do feedback por classificação

O feedback tem sempre a mesma espinha — fato → impacto → esperado → ação — mas a **pergunta** muda
com a intenção. "O que deveria acontecer?" não faz sentido num reconhecimento.

As perguntas vivem em `C.PERGUNTAS_FEEDBACK`, uma trilha por classificação. As **chaves gravadas são
fixas** (`oQueAconteceu`, `impacto`, `oQueDeveria`, `comoMelhorar`): muda o rótulo, não o dado — então
nenhum feedback antigo quebra.

Trocar a classificação no modal repinta rótulos e placeholders **sem apagar o que já foi digitado**.
O card que exibe o feedback usa os mesmos rótulos, sem o "?" — ali é resposta, não pergunta.

### Editar competências de um encontro concluído

O card **6. Competências** de um One a One concluído tem `Editar` (ou `Avaliar`, se o encontro foi
fechado sem nota). Abre o mesmo formulário da etapa 6, e o que for salvo passa a valer como a
avaliação vigente — `A.competenciasAtuais` lê do último encontro concluído.

A referência "Antes: N/5" mostra a avaliação **anterior a este encontro**:
`A.competenciasAtuais(colabId, ignorarEncId)` desconsidera o próprio encontro, senão a comparação
seria consigo mesma. Nota limpa é removida do registro — guardar comentário sem nota faria a
competência contar como avaliada.

### Iniciar todas as atividades do plano

Na aba **Plano de desenvolvimento** do perfil, um botão `▶ Iniciar N atividades` põe em andamento
tudo o que ainda não começou. Só aparece quando há algum plano em `nao_iniciado`.

`db.planos.iniciarTodos(colabId)` mexe **apenas** em quem está em `nao_iniciado` — concluído,
cancelado e o que já roda ficam intactos. Quem não tem data de início ganha a de hoje, senão o plano
não teria de quando começou a contar.

Confirma antes, listando o que vai mudar: são vários registros de uma vez e não há desfazer. A
gravação é sequencial — falha em um não derruba os outros, e o toast diz quantos entraram.

### Cor do card por pendência

O card do consultor muda de cor conforme a pendência, para achar de longe quem precisa de atenção.
A regra de qual estado vence está em `A.estadoCard`:

| Classe | Cor | Quando |
|---|---|---|
| `est-atrasado` | vermelho | Passou da data marcada |
| `est-fechado` | amarelo | 1:1 pendente de um ciclo que **já fechou** |
| `est-hoje` | azul | Encontro marcado para hoje |
| — | normal | Sem pendência |

A ordem é deliberada: **atrasado** vence porque passar da data é mais grave; **fechado** vem antes de
**hoje** porque, marcado para hoje ou não, um encontro que trata de mês já virado muda como você se
prepara.

O tom é diluído (9%) de propósito — com quatro cards pendentes lado a lado, saturar deixaria a tela
cansativa e nada se destacaria. No tema escuro a proporção sobe para 14%, senão o mix escurece
demais. As caixinhas internas ganham fundo próprio para não sumirem no tingido.

### Servir.ps1 — para o botão sincronizar de verdade

O app roda em `file://` por design, e ali o navegador **não executa PowerShell**: o botão
**Atualizar valores** só conseguia reler a base compartilhada. Servido pelo `Servir.ps1`, ele passa
a fazer o trabalho inteiro.

```
Abrir Evolui.vbs  →  Servir.ps1  →  http://localhost:8791
```

| Rota | O que faz |
|---|---|
| `/api/estado` | De quando é o `meta-master/dados.js` e quais competências têm meta |
| `/api/sincronizar?periodo=AAAA-MM&gerar=1` | Roda o `Sincronizar-Faturamento.ps1 -Aplicar` |
| qualquer outra | Serve os arquivos da pasta |

O botão decide sozinho: consulta `/api/estado` e, se o `dados.js` estiver em outro mês, pede
`&gerar=1` — que consulta o Sales Cube antes (e demora, então o rótulo avisa
"Consultando o Sales Cube…"). Depois recarrega a base e repinta.

Em `file://` o botão continua funcionando como antes — relê a base — e o toast diz o que falta:
*"abra o app pelo Servir.ps1 para o botão sincronizar sozinho"*.

Porta ocupada não trava: o servidor tenta as cinco seguintes. O QuickEdit do console é desligado no
boot, senão um clique na janela preta congela o processo e vira "Failed to fetch".

### Guia dentro de cada etapa do roteiro

Cada uma das 10 etapas de `C.ETAPAS_1A1` ganha, no topo do painel, um bloco **Como conduzir** —
recolhível — montado dos registros reais daquele consultor: **o que fazer**, **falas prontas**
(copiáveis, com os números e fatos dentro) e **o que evitar**.

Vive em `B.ETAPAS_GUIA` (uma função por etapa) e é desenhado por `G.guiaEtapa`. Se não houver dado
que sustente a orientação, a etapa não ganha guia — orientação genérica é pior que nenhuma.

| Etapa | Guia genérico | Com o quadro real |
|---|---|---|
| 1 · Como você está | "Abra pelo humano" | **"Primeiro encontro: combine o jogo antes de tudo"** + 3 falas |
| 2 · Conquistas | "Deixe contar" | **"Bateu a Master — extraia a receita"** |
| 4 · Autoavaliação | as 4 fixas | **"Você registrou 3 perguntas no período"** + as três |
| 7 · Positivos | "Nomeie o comportamento" | **os 4 reconhecimentos registrados**, prontos para transcrever |
| 8 · Desenvolver | "Fato e data" | **os 2 pontos** + aviso da proporção em 2,0:1 |

### Perguntas na autoavaliação (etapa 4)

As quatro perguntas de `C.PERGUNTAS_AUTO` são fixas. Abaixo delas o encontro aceita perguntas
próprias, guardadas em `roteiro.perguntasExtras` — `[{ id, pergunta, resposta, obsId }]`:

- **Nova pergunta** — escrita na hora.
- **Puxar do período (N)** — lista os registros do período cujo texto **termina em `?`**. Uma
  observação que é pergunta não é evidência: o lugar dela é aqui, virando resposta do colaborador.
  O registro de origem fica em `obsId` e o campo aparece marcado como `do período`.

As respondidas entram na **pauta impressa** e no **resumo copiado**, depois das quatro fixas.

### Ordem das evidências: a sequência da conversa

Na etapa 5 do roteiro, as observações do período podem ser reordenadas — arrastando pela alça `⠿`
ou pelas setas. A ordem escolhida é a **sequência em que você vai contar**: ela vale na tela, no
array `observacoesDiscutidas` e na **pauta impressa**.

Guardada em `ordemObs` no encontro, com os ids de todas as observações do período. Quem não estiver
na lista entra depois, em ordem cronológica — assim uma observação registrada **depois** da
reordenação não some nem embaralha o que já foi montado.

O seletor **ordenar por** tem três critérios: `Data` (cronológica), `Pontuação` (do que mais soma
para o que mais desconta, desempatando pela data) e `Manual` — que só aparece depois de você
arrastar alguma coisa. Qualquer critério grava a sequência resultante em `ordemObs`, então a pauta
impressa sempre segue o que está na tela. No celular a alça some (arrastar não funciona bem no
toque) e ficam só as setas.

### Base de referência: como o app sugere o feedback

`data/22-biblioteca.js` guarda 33 livros, as regras de tom e o gerador de enredo.
`components/33-guia-feedback.js` transforma isso em tela. Nenhuma regra de conteúdo mora na
tela: ela só desenha o que a base decide.

Aparece em três lugares:

| Tela | O que mostra |
|---|---|
| **Preparar One a One** | O enredo: onde está o número, comparação com o mês anterior, o que foi observado, como conectar, e a frase de abertura. Copiável. |
| **Etapa 5 · Feedback** | O painel `Como abrir esta conversa`, que muda a cada evidência marcada |
| **Etapa 6 · Competências** | A pergunta diagnóstica de cada competência, com o propósito e o botão de dispensar |

**Duas camadas independentes.** A abertura (*o que* dizer) vem do que foi marcado na etapa 5. A
calibragem (*em que tom*) vem da Linha de Losada — a proporção reconhecimento : correção do
período. Piso 3:1, alvo 5:1, teto 11:1, em `B.LOSADA`.

Isso resolve a tensão entre Losada e o "sem sanduíche": **a proporção se mede no período, não na
frase**. A correção sai limpa; o que muda é o que a sustenta antes e depois.

O positivo abre por padrão — mas só quando existe positivo **registrado**. Sem isso o app não manda
inventar elogio: troca para a abertura pela intenção (o *contrasting* do Crucial Conversations).

**O enredo nunca afirma causa.** Apresenta número, trajetória e padrão, e devolve a leitura:
"o que você acha que mais pesou aqui?". O que não está registrado aparece como lacuna `[assim]`.

**As perguntas das competências** começam ligadas. `dispensar` desliga uma; a escolha fica em
`db.config('biblioPerguntas')` e acompanha os três endereços.

### Observação em lote

No modal **Nova observação**, o chip **Todos (N)** no seletor de colaborador liga o modo lote: a
mesma observação é gravada **uma vez para cada consultor ativo**. O botão primário muda para
`Registrar para N consultores`, para não haver surpresa no clique.

Cada consultor fica com o **próprio registro** — dá para editar ou excluir o de um sem mexer nos
outros. Tipo, contexto, impacto, data e evidência são os mesmos do formulário: a polaridade segue
exatamente o tipo escolhido, o lote não muda regra nenhuma. Os registros irmãos compartilham um
campo `loteId`, que identifica de onde vieram.

Com o lote ligado, **clicar num nome tira aquele consultor** — o chip fica riscado e o contador vira
`3 de 4`. Clicar de novo devolve. Não dá para esvaziar o lote: ao tentar tirar o último, o app pede
para desligar o lote em vez disso.

A gravação é sequencial de propósito: falha em um não derruba os demais, e o toast final diz
quantos entraram e quem ficou de fora.

**Onde fica registrado.** Os registros irmãos compartilham um `loteId`, e isso aparece em:

| Lugar | O que mostra |
|---|---|
| Card em **Registros** | Badge `👥 Em lote · 4`, clicável — abre quem recebeu |
| Filtro em **Registros** | `Só lançamentos em lote` / `Só registros individuais` |
| KPI em **Registros** | `Lançamentos em lote` com o total de registros gerados |
| **Timeline** do perfil | `Em lote · 4` junto de contexto e impacto |
| **CSV** exportado | Coluna `Lote`: `Em lote (4)` ou `Individual` |

O modal de quem recebeu marca quem foi **editado depois do lançamento** — porque cada consultor tem
o próprio registro e editar um não mexe nos outros.

Clicar em qualquer nome desliga o lote e volta ao registro individual. O chip não aparece quando há
um só consultor ativo, nem ao editar uma observação existente.

### Área de testes: exemplos e modo demonstração

A equipe fictícia não é só vitrine — é onde você **experimenta**. Dá para editar cadastro e metas,
registrar observações, dar feedback, montar planos e conduzir One a Ones do começo ao fim, para ver
como o app vai ficar quando estiver cheio de dados reais.

O que garante que isso não contamina a operação é uma regra só, em `services/11-db.js`: todo
registro criado enquanto a tela lê no escopo `exemplos` — ou cujo dono é um colaborador de
demonstração — **nasce com `exemplo: true`**. Nenhuma tela precisa saber disso.

**Modo demonstração** (botão ✨ na topbar, ou Configurações › Exemplos): liga o escopo `exemplos`
para o app inteiro. Dashboard, Equipe, One a One, Indicadores e busca passam a mostrar a equipe
fictícia, com a mesma lógica de análise da operação. Uma faixa fixa no rodapé avisa que o modo está
ligado. A escolha é **deste navegador** (`localStorage`, chave `oao:demo`): ligar aqui não muda o
que os outros endereços veem.

| Botão | O que faz |
|---|---|
| **Restaurar exemplos** | Repõe os 6 figurantes originais na versão do seed. Preserva a operação **e** os figurantes que você criou. É o desfazer de quem bagunçou a demonstração. |
| **Remover exemplos** | Apaga tudo o que é demonstração. A operação fica intacta. |
| **Novo colaborador de exemplo** | Cria um figurante seu, já marcado, para testar faixas de meta e cards. |

Os figurantes vêm com as três faixas de meta e histórico de seis meses, na mesma proporção da
operação real — por isso o card do Dashboard e a tabela de histórico ficam idênticos aos de verdade.
O `Sincronizar-Faturamento.ps1` **ignora exemplos** de propósito: figurante não tem venda no Sales
Cube, então a meta dele é a que você digitar no cadastro.

### Meta do mês e faturamento (Meta Master)

A meta de cada consultor e o quanto falta para batê-la **não são digitados à mão**: vêm do
Meta Master, sempre pela competência vigente.

```
metas-vitoria.json      -> faixas Mínima / Básica / Master do mês
meta-master/dados.js    -> faturamento bruto e LÍQUIDO (window.MM)
        |
        v
one-a-one/Sincronizar-Faturamento.ps1
        |
        v
Firebase RTDB  evolui/colaboradores/<id>
   meta                    Master do mês
   metaFaixas              { minima, basica, master }
   indicadores.realizado   faturamento LÍQUIDO  <- o atingimento conta por este
   indicadores.realizadoBruto
   faturamentoPeriodo      'AAAA-MM'
   historico[]             uma linha por competência sincronizada
```

O atingimento do consultor conta **sempre pelo líquido** — Coaching Individual entra pela
metade, a mesma regra do Meta Master. O bruto aparece só como referência.

```powershell
cd one-a-one
.\Sincronizar-Faturamento.ps1                      # prévia do mês que está no dados.js
.\Sincronizar-Faturamento.ps1 -Aplicar             # grava no Firebase
.\Sincronizar-Faturamento.ps1 -Periodo 2026-07 -Gerar -Aplicar
```

Sem `-Gerar` ele usa o `meta-master/dados.js` como está. Com `-Gerar`, roda o
`Gerar-Dados-MetaMaster.ps1` antes (consulta o Sales Cube e demora).

O casamento entre as três bases é por **primeiro + último nome** sem acento:
`Gabriela Souza de Jesus` (Evolui e metas-vitoria.json) casa com `Gabriela Jesus` (Meta Master).
Quem não casar é listado no fim da prévia, sem ser gravado.

Cada mês sincronizado vira uma linha no `historico[]` do colaborador — é isso que alimenta a
curva **Meta x realizado** e a tabela **Histórico de faturamento** no perfil, usadas no feedback
do One a One. Meses anteriores nunca são apagados.

Onde a meta aparece no app:

| Tela | O que mostra |
|---|---|
| Dashboard, card do consultor | Barra com marcadores das faixas, % pelo líquido, `Faltam R$ X para a <faixa>` |
| Equipe (cards e tabela) | Mesma barra + coluna `Falta` |
| Perfil do consultor | Card da meta do mês, tiles Master/Líquido/Bruto/Falta e o histórico mês a mês |
| Preparar One a One | Bloco de meta no painel de indicadores do período |

### Trocar de backend

Toda leitura e escrita passa por `App.adapter`. Para migrar para Supabase, Firebase ou API
própria, implemente os mesmos métodos e registre o adapter:

```js
App.adapter = new App.RestAdapter('https://api.suaempresa.com', () => meuToken);
// init(), list(colecao), insert(colecao, doc), update(colecao, id, patch),
// remove(colecao, id), replaceAll(colecao, arr), limparTudo()
```

Nenhuma tela precisa ser alterada — `services/11-db.js` já isola o resto do app.
`App.RestAdapter` já vem escrito como ponto de partida.

### Operação × Exemplos

Registros de demonstração são gravados com `exemplo: true` e ficam **fora de toda consulta
operacional** — não aparecem na Equipe, no Dashboard, no One a One, nos Indicadores nem na busca.

O corte é feito por **escopo de leitura**, num único ponto (`services/11-db.js`): toda consulta
passa por `Repo.base()`, que filtra pelo escopo ativo. As telas leem em `operacao`; a aba
Exemplos e o perfil de um colaborador fictício elevam para `exemplos` com `db.setEscopo()`.
Por isso um exemplo abre o **perfil completo** — timeline, competências, preparação de One a One —
reaproveitando a mesma lógica das telas reais, sem nenhum código duplicado. O roteador devolve o
escopo para `operacao` antes de cada render.

Em Configurações › Exemplos você **restaura** (repõe o que foi excluído, sem tocar na operação)
ou **remove** os exemplos. Em Configurações › Dados existe também "Limpar dados da operação",
que zera só o que é real.

### Dias úteis e feriados

Nenhuma data calculada pelo sistema cai em fim de semana ou feriado. `services/13-calendario.js`
resolve os feriados nacionais de qualquer ano — fixos e móveis (Carnaval, Sexta-feira Santa,
Corpus Christi, derivados da Páscoa pelo algoritmo de Meeus) — e aceita feriados locais
cadastrados em Configurações › Preferências.

`App.cal.agendar(base, dias)` soma os dias corridos da frequência e desloca para o próximo dia
útil.

**No salvamento, a regra é automática:** se a data cair em fim de semana ou feriado, o app move
para o próximo dia útil e avisa no toast. A exceção do "colocado manualmente" existe, mas exige
confirmação explícita — o botão **"Manter nesta data mesmo assim"** no aviso do campo. Sem esse
clique, nenhum One a One é gravado em dia não útil, mesmo que a data tenha sido digitada à mão.

Agendamentos herdados que caem em dia não útil viram alerta no painel do coordenador.

### Coleções

`colaboradores`, `observacoes`, `feedbacks`, `oneones`, `planos`, `autoavaliacoes`,
`notificacoes`, `config`.

### Perfis de acesso

Hoje o sistema opera no perfil **Coordenador / Administrador**. A coleção `autoavaliacoes` e o
comparativo *autoavaliação × avaliação do coordenador* já existem, prontos para o perfil
Colaborador quando houver login.

## Gráficos

Paleta categórica e de status validadas para daltonismo e contraste, com passos próprios para o
tema escuro. A paleta nunca é reciclada: acima de 8 séries o excedente vira uma fatia "Outros".
Todo gráfico tem legenda quando há duas ou mais séries e alternância **Gráfico / Tabela** para
leitura exata.
