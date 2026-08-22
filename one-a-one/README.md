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
útil. Data escolhida à mão é sempre respeitada: o campo apenas avisa o motivo e oferece
"antecipar" / "adiar" em um clique. Agendamentos herdados que caem em dia não útil viram
alerta no painel do coordenador, nunca correção silenciosa.

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
