# Checklist manual — Meta Master

O front tem 21.878 linhas sem framework e sem build: teste automatizado de JS
custaria mais do que entrega. A rede de segurança do front é esta lista.

**Quando usar:** antes de commitar qualquer mudança no `index.html`, rode a
seção do módulo que você tocou. Leva ~2 min por módulo.

---

## Antes de qualquer commit (30 s)

```powershell
.\_tests\Smoke-Rotas.ps1 -Rapido      # ~10 s, só rotas locais
```
Mexeu no `Servir.ps1` ou em script `.ps1`? Rode o completo:
```powershell
.\_tests\Smoke-Rotas.ps1              # ~2-4 min, bate no CRM
.\_tests\Teste-Integridade.ps1        # prova que nenhum dado foi tocado
```

> **Feche a aba do app antes do Teste-Integridade.** Com ela aberta, o próprio
> app grava `estado.json` sozinho e o resultado fica poluído (o teste avisa).

Mexeu no `index.html`? **Bumpe o `sw.js`** — senão o navegador serve a versão
velha e você vai caçar um bug que não existe.

---

## Aba Card (`hub*`, `mm*`, `fat*`, `mt*`)

- [ ] Abre mostrando os consultores com foto e números
- [ ] Trocar o mês recarrega os valores
- [ ] "Recarregar dados" atualiza sem zerar o painel
- [ ] Gerar card de imagem: a imagem sai com foto, nome e valores certos
- [ ] Ranking em ordem, sem nome repetido nem faltando

## Aba Leads (`lea*`, `conv*`, `eq1c*`, `rgc*`, `rcc*`)

- [ ] Abre com a matriz consultor × etapa preenchida
- [ ] O carimbo mostra a competência e a hora da carga
- [ ] "↻ Atualizar agora" traz números e **não** zera nada
- [ ] **Com a internet desligada**: aparece "CRM indisponível" e a tabela some
      — nunca uma tabela de zeros *(este é o teste do incidente de 18/09)*
- [ ] Taxa de conversão (2ª tabela) bate com a matriz
- [ ] Equilibrar leads: a prévia abre e mostra o plano **antes** de aplicar
- [ ] Relatório Consolidado abre e o histórico dos 3 meses aparece

## Aba Comandos (`W`, `CMDS`, `exec*`)

- [ ] O seletor lista os comandos e cada um abre seu formulário
- [ ] Faturamento, Metas e Negociações devolvem tabela
- [ ] Um comando que falha mostra o erro — não uma tela vazia
- [ ] Voltar e trocar de comando não mistura dado do anterior

## Aba SF × ZS (`sfx*`, `tw*`)

- [ ] Buscar por CPF traz os 11 campos lado a lado
- [ ] Cliente inexistente diz "não encontrado" — não fica em branco
- [ ] O bloco copiável copia com um clique

## Aba Turmas (`tz*`, `pnf*`, `fc*`)

- [ ] A turma carrega com a lista de alunos
- [ ] Trocar de turma troca a lista inteira
- [ ] Faixa GGB aparece para quem tem
- [ ] Painel TV abre em janela nova e mostra a turma escolhida
- [ ] Sincronizar FRZ: mostra a prévia antes de aplicar

## Depois de mexer em rota de escrita

- [ ] A prévia (GET) mostra o que vai acontecer
- [ ] Nada é gravado sem o clique de confirmação
- [ ] Recarregar a página não repete a ação
- [ ] Conferir no Sales Cube que o registro ficou como esperado

---

## Teste de fonte fora (1 min, faça de vez em quando)

O que causou o incidente. Desligue o Wi-Fi e:

- [ ] `.\_tests\Teste-Integridade.ps1` → **INTEGRIDADE OK**
- [ ] Aba Leads → "CRM indisponível", sem tabela de zeros
- [ ] Nenhum arquivo em `_tmp/snapshots` muda de tamanho
- [ ] `meta-master\servir-erros.log` registra a falha *(silêncio aqui é o problema)*

Religue a internet e confira que "↻ Atualizar agora" traz os números de volta.
