# AUDITORIA ARQUITETURAL — APLICATIVO META MASTER

**Data:** 19/09/2026 · **Versão:** 2 (escopo corrigido)
**Nada foi alterado no código.** FATO = visto no código com linha, ou provado em teste. HIPÓTESE = inferido, com o que falta para confirmar.

## ESCOPO

Auditoria **exclusiva do aplicativo Meta Master**. Uma primeira versão deste documento extrapolou a fronteira e auditou o dashboard/Pipeline Comercial e o Firebase — material removido, porque o Meta Master **não usa Firebase** e não compartilha código com aquele app.

| Dentro do escopo | Fora |
|---|---|
| `meta-master/index.html` (22.170 linhas) | `dashboard.html` e `assets/js/**` |
| `meta-master/Servir.ps1` (1.725 linhas, 26 rotas) | Firebase (regras, nós, autenticação) |
| `meta-master/turma-apresentacao.html` (1.210 linhas) | `one-a-one/`, `chamados/`, `agenda-pessoal/`, `pitch/` |
| `meta-master/sw.js`, `manifest.webmanifest` | `Sincronizar-FRZ.ps1`, `Extraclasse-Pablo.ps1`, `Sync-Extraclasse-ZS.ps1` (falam com Firebase) |
| `meta-master/*.ps1` (Gerar-Dados, Backup-Dados, Publicar-Online, Liberar-Acesso-Rede) | `Conferir-Pipeline-ZS.ps1`, `Lancar-Venda-Turma.ps1`, `Consultores-Vitoria.ps1` (uso por terminal) |
| **Os 32 scripts `.ps1` que o `Servir.ps1` invoca** — a camada de dados do app | |
| Dados: `estado.json`, `dados.js`, `mm-fotos.js`, `mapeamentos-turma.json`, `_tmp/`, `_backup/` | |
| Testes: `_tests/Smoke-Rotas.ps1`, `_tests/Teste-Integridade.ps1` | |

---

## SUMÁRIO EXECUTIVO

O Meta Master **não é um espaguete**: são 1.231 funções de 22 linhas em média, e a auditoria de 13/09 já instalou proteções reais (escrita atômica com `.prev`, gate de payload nos Leads, backup diário, smoke de 23 rotas, teste de integridade).

O problema é outro e se repete: **as correções certas foram escritas e não foram generalizadas.** O app tem hoje **três soluções artesanais diferentes** para a mesma classe de bug — `_carteiraSeq` (corrida), `TZ.beltReq` (corrida), `mmApi`+`RGC_ERRO` (erro ≠ zero) —, cada uma criada depois de um incidente real, nenhuma virou padrão. Por isso sobram pontos descobertos.

Três frases resumem o estado:

1. **O crítico já foi resolvido onde doeu.** O módulo de Leads, o SF×ZS e os relatórios de Coaching distinguem corretamente "não há dados" de "não consegui carregar".
2. **A mesma falha continua viva onde ainda não doeu.** Oito pontos repetem o padrão do incidente, dois deles gravando dado errado no CRM.
3. **O app inteiro depende de um servidor que atende uma requisição por vez.** Medido: 3 requisições simultâneas levam 3× o tempo de uma. Com timeout de 240 s por rota, uma consulta lenta congela todas as abas e o painel de TV.

---

## A. DIAGNÓSTICO

### A.1 As camadas

```
  NAVEGADOR                       SERVIDOR LOCAL                  FONTES
  ┌────────────────────────┐      ┌──────────────────────┐        ┌──────────────┐
  │ index.html  22.170 l.  │ HTTP │ Servir.ps1  1.725 l. │ spawn  │ MCP Sales    │
  │ 1.231 funções          │─────▶│ 26 rotas /api/*      │───────▶│ Cube         │
  │ escopo global único    │ 26   │ 1 REQUISIÇÃO POR VEZ │ 32     │ REST ZS      │
  ├────────────────────────┤ rotas│                      │ .ps1   │ Salesforce   │
  │ turma-apresentacao.html│      │                      │        │ Supabase/FRZ │
  │ (Slides p/ painel)     │      │                      │        └──────────────┘
  └────────────────────────┘      └──────────────────────┘
        │ localStorage                   │ arquivos
        │ (monkey-patch global)          │ estado.json · dados.js · mm-fotos.js · _tmp/
        ▼                                ▼
  ┌──────────────────────────────────────────────┐
  │ sw.js (PWA) — cacheia o shell                │
  └──────────────────────────────────────────────┘
```

As fronteiras existem fisicamente. O que falta é **contrato em cada travessia**: hoje uma resposta é boa se "parseia como JSON", e um script filho é bem-sucedido conforme uma variável que não é dele.

### A.2 O que está certo (não mexer)

- `Gravar-Atomico` ([Servir.ps1:44](Servir.ps1#L44)): recusa gravar vazio sobre arquivo cheio, faz `.prev`, grava `.tmp` e troca. Cobre `estado.json`, `metas-vitoria.json`, `mapeamentos-turma.json`, `mm-fotos.js`.
- `/api/leads`: gate `Leads-PayloadSuspeito`, fallback ao último snapshot bom, HTTP 503 dedicado, stderr logado.
- Gravação em massa no CRM com confirmação, contagem e aviso de irreversibilidade ([index.html:14724](index.html#L14724)).
- `Backup-Dados.ps1` ao subir o servidor: 30 dias de cópias em `_backup/AAAA-MM-DD/`.
- Fluxos prévia → `-Aplicar` com plano congelado (`Turma-Lancar-FRZ.ps1`, `lancamentos-zs/Lancar-Vendas-SF.ps1`).
- **`turma-apresentacao.html` é o módulo mais bem desacoplado do app**: comunica-se com o `index.html` só por URL (`?turma=`) e pelo `estado.json`, sem variável global nem `postMessage`. Todo `fetch` tem `try/catch` que preserva o que já estava na tela.

### A.3 O monolito, medido

| Métrica | Valor |
|---|---|
| Funções nomeadas | 1.231 |
| Tamanho médio | ~22 linhas |
| Funções > 100 linhas | 11 |
| Funções > 300 linhas | 3 (`rgiMontar` 366, `rccFolha` 341, `rccCompor` 306 — geradores de PDF) |

**O item "funções gigantes" do roteiro não se aplica.** Quebrar funções seria refatorar o sintoma errado; o risco está no estado global e na ausência de contratos.

---

## B. INCIDENTE DOS LEADS — causa raiz

**O "Slides p/ painel" não tem participação. FATO.**

| Hora (18/09) | Evento | Evidência |
|---|---|---|
| 11:01:04 | `/api/atualizar` → `Invoke-WebRequest : no available server` (MCP caiu) | `servir-erros.log:231` |
| 11:06:43 | Coletor regrava `leads-cache-opps.json` como `{}` | mtime |
| 11:06:44 | Servidor sobrescreve o snapshot bom com zeros | mtime |
| 11:10:51 | Relato: "leads zerados após a atualização do Slides" | — |

**A cadeia:** MCP caiu → coletor sem `$ErrorActionPreference='Stop'` seguiu com sessão nula e emitiu **JSON válido, zerado, exit 0** → servidor aceitou ("exit 0 + JSON parseável") e gravou por cima do snapshot bom, sem `.prev` → front carimbou "dados de 18/09 11:06". Durou 2 h porque snapshot de mês corrente vale 2 h.

**Por que o Slides foi acusado** — verificação superfície por superfície, todas descartadas:

| Superfície | Slides | Leads |
|---|---|---|
| Estado global | `FC.*`, `FRZ_DATA`, `FC_VAGAS` | `LEADSCTX`, `LEADS_PER`, `MMLEADS` |
| localStorage | `fcisTurma` | `rccHist*` |
| Rotas | `/api/cmd?id=leituraFrz`, `/api/consumidores-vaga` | `/api/leads` |
| Arquivos | `estado.json` (chave `turmaFcis`) | `_tmp/snapshots/leads-*.json` |

Nenhum símbolo, chave, rota ou arquivo em comum. `fcSlidesLed` ([index.html:19963](index.html#L19963)) só faz `window.open` — zero fetch, zero storage. A associação veio de duas coincidências: o Slides foi a última entrega da véspera, e "atualização" é o nome do botão **RECARREGAR DADOS**, que foi a primeira coisa a falhar no dia (11:01:04).

**Achado de processo:** `git log -S"fcSlidesLed"` e `git log -S"Leads-PayloadSuspeito"` caem no **mesmo commit** — o `Servir.ps1` tinha 413 linhas versionadas contra 1.556 em disco. O histórico não conseguia responder "o que mudou antes da quebra?".

### A classe do bug

> Falha de dependência externa degenera em **valor vazio**, atravessa uma fronteira **sem contrato**, e é **persistida por cima do último estado bom**, carimbada como fresca.

---

## C. OS RISCOS DA MESMA CLASSE QUE CONTINUAM VIVOS

### C.1 🔴 Cinco rotas tratam falha como sucesso

**FATO, provado em teste:** `Exec-Filho` usa `Start-Process`, que não popula `$LASTEXITCODE`. Teste: filho com `exit 3` → `$LASTEXITCODE` ficou **0**.

| Rota | Linha | Falha do script vira |
|---|---|---|
| `/api/cmd` (15 comandos, inclui Leitura FRZ, Faturamento, Metas, Painel) | [Servir.ps1:705](Servir.ps1#L705) | HTTP 200 |
| `/api/turma` | [Servir.ps1:730](Servir.ps1#L730) | HTTP 200 |
| `/api/acao` (escreve no CRM) | [Servir.ps1:906](Servir.ps1#L906), 925 | HTTP 200 |
| `/api/atualizar` (regera `dados.js`) | [Servir.ps1:1487](Servir.ps1#L1487) | HTTP 200 — clica "RECARREGAR", recebe OK, vê dado velho |

O valor correto existe (`$script:ultimoExit`, [Servir.ps1:106](Servir.ps1#L106)) e é usado em `/api/leads:491`. E `Falha-DoFilho` ([Servir.ps1:277](Servir.ps1#L277)), escrita para unificar o critério, **não é chamada por nenhuma rota**.

### C.2 🔴 O servidor atende uma requisição por vez

**FATO, medido:** `GetContext()` síncrono em `while` ([Servir.ps1:388](Servir.ps1#L388)), sem job nem runspace.

| Teste | Resultado |
|---|---|
| 1 requisição a `/api/cmd?id=tabelaPrecos` | 0,50 s |
| 3 simultâneas | 1,32 s (≈ 3 × 0,44 s) |

Com timeout de 240 s por rota, **uma consulta lenta ao CRM congela o app inteiro** — sua aba, o celular na rede e o painel de TV. O `turma-apresentacao.html` sofre disso sem nenhum `AbortController`: "Lendo o 9.1…" pode ficar pendurado indefinidamente, sem botão de cancelar.

### C.3 🔴 Erro de rede vira matrícula sem turma — em dois wizards

Mesmo bug, duas telas, mesma consequência: o consultor lança matrícula **sem `class_id`** no CRM.

| Onde | Linha | Comportamento |
|---|---|---|
| "Lançar em turma" (`twP2`) | [index.html:16762](index.html#L16762) | `catch(e){ TW.turmas=[]; }` → a tela **afirma** "Este produto não tem turma cadastrada nesta unidade" e oferece "Continuar sem turma" |
| "Lançar Cliente" (`lwCarregarTurmas`) | [index.html:17533](index.html#L17533) | `catch` produz **exatamente o mesmo DOM** que o caminho de sucesso vazio (linha 17525): o campo de turma some, sem toast, sem aviso |

O segundo é pior: não sobra nem uma frase na tela. No mesmo wizard, `twBuscarProduto` e `twP5` tratam erro corretamente — ou seja, não é falta de padrão, é ponto não seguido.

### C.4 🔴 A carga base do app não trata erro nenhum

**FATO.** [index.html:126](index.html#L126): `<script src="dados.js"></script>`, sem `onerror`. É o arquivo que cria `window.MM` (faturamento, consultores, metas). Se faltar, vier vazio ou for lido enquanto o `Gerar-Dados-MetaMaster.ps1` ainda escreve (a escrita **não** é atômica — ver C.6), o app quebra mudo: o erro cai no handler global de [index.html:4594](index.html#L4594), que **manda para o log do servidor e não mostra nada ao usuário**.

### C.5 🔴 O service worker serve a página errada

**FATO.** [sw.js:25](sw.js#L25): `fetch(req).catch(() => caches.match('/index.html'))` — o fallback de navegação ignora qual página foi pedida, e só o `index.html` está no `SHELL` pré-cacheado.

Consequência: com o `Servir.ps1` fora do ar, clicar **"🖥️ Slides p/ painel"** abre `turma-apresentacao.html` e recebe o **dashboard cacheado** naquela URL, sem erro visível — na frente da turma.

### C.6 🟠 `dados.js` é gravado sem rede de proteção

**FATO.** `Gerar-Dados-MetaMaster.ps1:246` usa `[IO.File]::WriteAllText` cru — sem `Gravar-Atomico`, sem `.prev`, sem escrita atômica. É o único dado central do app fora da proteção que já existe no projeto. Combina com C.1 (`/api/atualizar` não detecta falha) e C.4 (o front não detecta arquivo quebrado).

### C.7 🟠 Coletores que transformam "não consegui perguntar" em "não existe"

Todos são scripts chamados pelo `Servir.ps1`:

| Script | Linha | Falha de rede vira | Quem consome |
|---|---|---|---|
| `Consumidores-Vaga.ps1` | 61, 72 | "pessoa não encontrada", `ok:true`, exit 0 | selo Green/Golden Belt, "Clientes que fecharam", apresentação da turma |
| `Painel-Vitoria.ps1` | 54 | `if ($parsed.error) { return @() }` → "0 turmas — 0 pessoas" | Painel de Turmas (exibido em TV) |
| `Turma-Aluno.ps1` | 75 | `catch { return 0 }` → "aluno sem venda" | aba Turmas |
| `Ponte-SF.ps1` | 583, 665, 722 | ficha sem credenciamentos/GGB, com `ok=true` | aba SF×ZS |
| `Faturamento-Vitoria.ps1`, `Meta-Vitoria.ps1`, `Movimentacao-Leads.ps1`, `Negociacoes-Vitoria.ps1`, `Buscar-Clientes-Vitoria.ps1` | várias | resposta degenerada → `$rows=@()` → "R$ 0,00" / "0 registros" | relatórios e cards |

### C.8 🔴 Bug de sintaxe deixa o Salesforce quebrado

**FATO, provado em teste** (`CommandNotFoundException`). O backtick de continuação é seguido de texto, então **não há continuação** e a linha seguinte vira comando inexistente:

| Arquivo | Linha | Efeito |
|---|---|---|
| `Ponte-SF.ps1` | 86-87 | relogin SOAP falha sempre que a sessão em cache expira |
| `Pegar-Link-SF.ps1` | 105-106 | idem |
| `Configurar-SF.ps1` | 43-44 | `-Testar` quebrado; bloqueia configurar credencial do zero |

Hoje está mascarado pelo cache `sf-session.json`. Quando expirar, a aba SF×ZS e o "Pegar link SF" param.

### C.9 🔴 `/api/atualizar` executa escrita por GET

**FATO.** [Servir.ps1:1480](Servir.ps1#L1480) não verifica o método. Um GET (link, `<img src>`, pré-fetch) regenera `dados.js`. A correção equivalente já existe em `/api/lancar` ([Servir.ps1:851](Servir.ps1#L851)).

### C.10 🔴 Escritas críticas no ZS rodam no executor frágil

**FATO.** `/api/vendas-zs` (fecha Ganho, remove vaga, muda etapa) e `/api/link-sf` usam `Rodar-Filho` ([Servir.ps1:289](Servir.ps1#L289)), baseado em `Start-Job`: sem kill garantido, sem log de stderr, sem exit code. Maior poder de escrita no mecanismo menos confiável.

### C.11 🟠 O gate dos Leads aceita payload parcial

**FATO.** `Leads-PayloadSuspeito` retorna "ok" assim que `totalGeral > 0` ([Servir.ps1:151](Servir.ps1#L151)). Se o MCP cair **depois** das 6 etapas, durante o enriquecimento (produtos/notas), a carga passa com vendas, conversão e "parados" degradados, e fica assim por 2 h. O coletor já emite `avisos.notasSemLeitura` / `produtosSemLeitura` ([Leads-Vitoria-Campanha.ps1:809](../Leads-Vitoria-Campanha.ps1#L809)) — o gate só não os consulta. Correção barata.

### C.12 🟠 Corrida ao trocar de turma

**FATO estrutural.** `tzAbrir(id)` ([index.html:7600](index.html#L7600)) não tem guarda de sequência. Clicar na turma A e, antes de responder, na turma B, deixa `TZ.det`/`TZ.pessoas` com os alunos de A sob o cabeçalho de B. O padrão certo existe **na função vizinha** (`TZ.beltReq`, [index.html:7628](index.html#L7628), com o comentário "troca de turma no meio: só a última vale") e não foi aplicado aqui. Mesma ausência em `lwCarregarTurmas` (17517) e `sfxRun` (16120).

### C.13 🟠 `estado.json` cresce para sempre

**FATO.** A curadoria da apresentação (`turmaFcis`) **nunca é expurgada entre turmas**: `carregarTurma()` troca o roster mas não limpa `EST.fotos` ([turma-apresentacao.html:755](turma-apresentacao.html#L755)), e o registro só faz `unshift` (linha 862) — o `slice(0,30)` limita a exibição, não o que é salvo. O arquivo já está em **1.039.187 bytes**, e o `index.html` o lê com **XHR síncrono no boot** ([index.html:42](index.html#L42)). Cada turma curada deixa o app mais lento para abrir, permanentemente.

### C.14 🟠 Fotos de pessoas versionadas no Git

**FATO, verificado.** `meta-master/mm-fotos.js` (512 KB de fotos em base64 de consultores e alunos) está **rastreado** no Git (3 commits) e **não** está no `.gitignore` — ao contrário de `estado.json` e `dados.js`, corretamente ignorados. O repositório tem remoto no GitHub. `mapeamentos-turma.json` também está fora do `.gitignore` (ainda não commitado, mas exposto a um `git add -A`).

### C.15 🟡 Outros

- `MM_REDE_T = setInterval(...)` ([index.html:5021](index.html#L5021)) nunca recebe `clearInterval` — roda a cada 20 s pela vida da aba (mitigado: sai cedo se `document.hidden`).
- `carregarJuntos()` ([turma-apresentacao.html:858](turma-apresentacao.html#L858)) engole qualquer erro sem log nem toast.
- Dois handlers globais de `error`/`unhandledrejection` independentes (index.html:4594 e 13210).
- `/api/lancamentos` decide sucesso por regex em texto (`ERRO|Exception`), [Servir.ps1:1447](Servir.ps1#L1447).
- `/api/img` grava PNG em `_tmp/` e devolve uma URL que a própria blacklist de pastas bloqueia (403) — recurso quebrado, [Servir.ps1:1524](Servir.ps1#L1524) vs 1691.
- Path traversal: o código não neutraliza `..` ([Servir.ps1:1676](Servir.ps1#L1676)), mas testei 6 variantes com socket cru e **todas deram 403 do `Microsoft-HTTPAPI/2.0`** — o kernel barra antes. Risco hoje 🟡, é dependência implícita de proteção externa.

---

## D. ACOPLAMENTO DENTRO DO META MASTER

Das ~55 variáveis globais mapeadas no `index.html`, a **maioria é isolada** ao próprio prefixo. O dominó real está em seis pontos:

| De → Para | Evidência | Risco |
|---|---|---|
| Turmas → Painel | `PN_DRILL = TZ.det` — sobrescreve o estado inteiro de outro módulo ([index.html:7918](index.html#L7918)) | 🔴 |
| Hub → Faturamento-imagem | `renderHub()` recria `FATIMG` inteiro ([index.html:6111](index.html#L6111)) | 🔴 |
| RCC ↔ Leads | `LEADS_PER = {...RCC_PER}` e o inverso ([index.html:11089](index.html#L11089), 11112) | 🔴 |
| Motor de Comandos → módulos | escreve `LT_PRES`, `FRZ_CONS_SEL`, `PESQ_MODO` de dentro do executor genérico | 🟠 |
| Carteira → Comandos/Wizards | lê `CMD_ID`, `WIZT`, `WIZI`, `WIZC` | 🟠 |
| Qualquer módulo → boot | monkey-patch de `Storage.prototype` ([index.html:28](index.html#L28)): toda escrita em `localStorage` com prefixo reconhecido é sincronizada sem o módulo saber; chave fora da lista fica fora do sync em silêncio (já acontece com `lt_modo`/`lt_sit`) | 🟠 |

**Positivo:** `turma-apresentacao.html` ↔ `index.html` é o acoplamento mais bem-feito do app — só URL e arquivo compartilhado, sem estado em comum.

---

## E. ROTAS E ACESSO A DADOS (26 rotas `/api/*`)

| Garantia | Situação |
|---|---|
| Gate de payload antes de persistir | 1 rota (`/api/leads`) 🟢 |
| Escrita atômica + `.prev` | 4 arquivos (`estado`, `metas`, `mapeamento-turma`, `fotos`) 🟢 |
| Escrita exige POST | 8 rotas 🟢 |
| **Escrita disparável por GET** | `/api/atualizar` 🔴 |
| Decide status por `$LASTEXITCODE` (inerte) | 4 rotas 🔴 |
| Decide sucesso por regex em texto | `/api/lancamentos` 🟠 |
| Extrai JSON por posição de `{`/`}` sem validar | ~8 rotas 🟡 |
| Autenticação | só para tráfego "de fora", e só se existir `.auth` 🟠 |
| CSRF / CORS | inexistente 🟠 |
| Concorrência | **uma requisição por vez** 🔴 |

---

## F. DADOS DO META MASTER

| Arquivo | Tamanho | Escritor | Proteção | `.gitignore` |
|---|---|---|---|---|
| `estado.json` | 1.039.187 B | `/api/estado` | atômica + `.prev` + recusa gravar sobre leitura falha | ✅ |
| `dados.js` | 47.062 B | `Gerar-Dados-MetaMaster.ps1:246` | **nenhuma** (`WriteAllText` cru) 🟠 | ✅ |
| `mm-fotos.js` | 524.009 B | `/api/fotos` | atômica + `.bak` | ❌ **versionado (3 commits)** 🟠 |
| `mapeamentos-turma.json` | 259 B | `/api/mapeamento-turma` | atômica | ❌ 🟡 |
| `_tmp/snapshots/leads-*.json` | — | `/api/leads` | gate + `.prev` de **uma** geração | ✅ |
| `_backup/AAAA-MM-DD/` | — | `Backup-Dados.ps1` (30 dias) | — | ✅ |

Nenhum arquivo tem dois produtores — o risco é sempre "um produtor grava vazio por cima de si mesmo".

---

## G. MATRIZ DE RISCO

| # | Problema | Impacto | Probabilidade | Risco | Justificativa |
|---|---|---|---|---|---|
| 1 | 5 rotas tratam falha como sucesso | Dado velho/errado como verdadeiro | **Alta** | 🔴 | Provado: `Start-Process` não seta `$LASTEXITCODE` |
| 2 | Erro de rede vira matrícula sem turma (2 wizards) | Dado errado gravado no CRM | Média | 🔴 | `twP2:16762`, `lwCarregarTurmas:17533` |
| 3 | Servidor de 1 requisição por vez + timeout 240 s | App inteiro congela | **Alta** | 🔴 | Medido: 3 simultâneas = 3× o tempo |
| 4 | `dados.js` sem `onerror` no front | App quebra mudo | Média | 🔴 | `index.html:126` |
| 5 | SW serve `index.html` no lugar da apresentação | Tela errada na frente da turma | Média | 🔴 | `sw.js:25` |
| 6 | Backtick quebrado no Salesforce | SF×ZS e link SF param | **Alta** ao expirar sessão | 🔴 | Provado: `CommandNotFoundException` |
| 7 | `/api/atualizar` aceita GET | Regeração não intencional | Média | 🔴 | Sem checagem de método |
| 8 | `/api/vendas-zs` no executor frágil | Fechar Ganho sem confirmar resultado | Média | 🔴 | `Start-Job` sem kill/exit/stderr |
| 9 | `dados.js` gravado sem atomicidade | Arquivo truncado = app quebrado | Baixa | 🟠 | `WriteAllText` cru |
| 10 | 5 coletores convertem falha em "não existe" | Decisão errada (belt, turma, venda) | **Alta** | 🟠 | `catch → null/@()/0` verificados |
| 11 | Gate dos Leads aceita payload parcial | Conversão/parados errados por 2 h | Média | 🟠 | `Servir.ps1:151` |
| 12 | Corrida ao trocar de turma | Alunos de uma turma sob o título de outra | Média | 🟠 | `tzAbrir` sem seq-guard |
| 13 | `estado.json` cresce sem expurgo | Boot cada vez mais lento (XHR síncrono) | **Certa** | 🟠 | Já em 1 MB |
| 14 | Fotos de pessoas no Git | Dado pessoal no repositório remoto | **Certa** | 🟠 | `mm-fotos.js` rastreado |
| 15 | 61 de 64 chamadas fora do `mmApi` | Erro vira tela vazia | **Alta** | 🟠 | Medido |
| 16 | 6 acoplamentos diretos entre módulos | Quebra silenciosa ao evoluir | Média | 🟠 | `PN_DRILL`, `FATIMG`, `LEADS_PER` |
| 17 | Commits gigantes / arquivos não versionados | Impossível responder "o que mudou?" | **Alta** | 🟠 | Comprovado no incidente |

---

## H. PLANO (proposta — nada será executado sem aprovação)

### FASE 0 — Mecânicas, sem tocar em regra de negócio (1 sessão)
1. `/api/atualizar` exige POST (#7) — 3 linhas, igual ao que já existe em `/api/lancar`.
2. Backtick do Salesforce (#6) — juntar 3 linhas quebradas.
3. `sw.js`: fallback de navegação só serve `index.html` quando a página pedida **é** o `index.html` (#5).
4. `mm-fotos.js` e `mapeamentos-turma.json` para o `.gitignore` (#14). O histórico permanece — decisão sua se vale reescrever.

### FASE 1 — Ligar as correções já escritas (1 sessão)
5. Chamar `Falha-DoFilho` nas 5 rotas e trocar `$LASTEXITCODE` por `$script:ultimoExit` (#1).
6. Migrar `/api/vendas-zs` e `/api/link-sf` de `Rodar-Filho` para `Exec-Filho` (#8).
7. `dados.js` via `Gravar-Atomico` (#9) + `onerror` no `<script src>` com mensagem de verdade (#4).

### FASE 2 — Contrato nos coletores (1–2 sessões)
8. Padrão do coletor de Leads (`EAP Stop` + `Sair-FonteIndisponivel` + `exit 2`) nos 5 scripts do #10.
9. Gate dos Leads passa a olhar `avisos.*SemLeitura` (#11).

### FASE 3 — Os dois wizards e o resto do front (2–3 sessões)
10. `twP2` e `lwCarregarTurmas` (#2) — os dois que gravam dado errado, primeiro.
11. Migração gradual para `mmApi` (#15), começando pelo que decide negócio.
12. Guarda de sequência em `tzAbrir`, `lwCarregarTurmas`, `sfxRun` (#12), reaproveitando o padrão de `TZ.beltReq`.

### FASE 4 — Estrutural (só depois)
13. Expurgo do `turmaFcis` + trocar o XHR síncrono do boot por assíncrono (#13).
14. Concorrência do servidor (#3): fila com resposta imediata para rotas rápidas, ou runspace pool. **É a mudança de maior impacto e a de maior risco — deve ser a última.**
15. Eliminar os 6 acoplamentos diretos (#16) com funções de acesso, sem reorganizar arquivos.

**Não entra:** quebrar funções por tamanho, reorganizar pastas, trocar framework, renomear campos.

---

## I. TESTES

| Teste | Existe? | Falta |
|---|---|---|
| Rotas respondem (`Smoke-Rotas.ps1`, 23 rotas + goldens) | ✅ | Não cobre `leituraFrz`, `leituraFrzTurmas` nem o POST real de `/api/consumidores-vaga` — as três rotas que alimentam a apresentação da turma. Ainda marca como "bug conhecido" o GET em `/api/lancar`, **já corrigido**, e não cobre `/api/atualizar`, que é o bug real |
| Integridade dos dados (`Teste-Integridade.ps1`) | ✅ | Não vigia `_tmp/leads-cache-opps.json` |
| Fonte fora do ar não zera nada | ⚠️ manual | Automatizar: servidor com MCP inacessível deve dar 503 e não tocar arquivo nenhum |
| Falha do filho vira 500 | ❌ | Novo: script que sai com `exit 2` deve produzir HTTP 500 nas 5 rotas |
| Valores, não só chaves | ❌ | O smoke aceita 200 com payload zerado |

**Processo:** 1 alteração → teste → commit. `Servir.ps1` e `index.html` não devem passar de uma sessão sem commit — foi exatamente isso que impediu o diagnóstico do incidente.

---

## DECISÕES DO GESTOR — não reabrir

- **19/09/2026:** Firebase não será alterado; o token do CRM permanece como está. Ambos fora do escopo desta auditoria (pertencem ao dashboard/Pipeline Comercial).
- **19/09/2026:** o Editor de Apresentações do dashboard fica como está — fora do escopo do Meta Master.

## PENDÊNCIAS DECLARADAS

- Os 32 scripts da camada de dados foram auditados quanto a "erro vira vazio", escrita externa e segredos; **não** foi auditada a correção das regras de negócio dentro deles (cálculo de metas, faixas, classificação de treinamento).
- `index.html`: listeners e timers foram varridos; **não** foi feita revisão de acessibilidade, CSS ou compatibilidade de navegador.
- Não medido: comportamento real do SW em queda do servidor (inferido do código; confirmação exige teste com o servidor parado e SW ativo).
