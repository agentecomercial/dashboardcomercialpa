/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   59-extraclasse-zs.js â€” VENDAS DO ZS DO PABLO (EXTRACLASSE)

   ARQUIVO GERADO AUTOMATICAMENTE â€” nÃ£o edite Ã  mÃ£o.
   Fonte: Sync-Extraclasse-ZS.ps1 (lÃª o ZS via API REST).
   Gerado em: 17/09/2026 18:05 Â· MÃªs: 2026-09 Â· 6 venda(s)

   O Pablo nÃ£o lanÃ§a no HUD; as vendas dele estÃ£o sÃ³ no ZS, que o navegador
   nÃ£o consegue ler (login + CORS). Este arquivo Ã© a ponte: o 58-frz-sync.js
   lÃª window.EXTRACLASSE_ZS e importa como EXTRACLASSE na Pipeline Comercial,
   sem passar pelo pipeline_entries.

   Para atualizar:  .\Sync-Extraclasse-ZS.ps1 -Aplicar
   Depois clique em "âŸ³ Sincronizar FRZ" na Pipeline Comercial.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
window.EXTRACLASSE_ZS = {
  mes: '2026-09',
  geradoEm: '17/09/2026 18:05',
  vendas: [
    {
        "id":  "2000379056",
        "cliente":  "Giumar de Oliveira",
        "produto":  "MASTER - Master Coaching x5",
        "valor":  15892.25,
        "data":  "2026-09-17",
        "status":  "FECHADO"
    },
    {
        "id":  "2000379317",
        "cliente":  "Isabely Vicentim de Oliveira",
        "produto":  "CEOP - Comunicação Eficaz e Oratória Persuasiva x2",
        "valor":  6996.46,
        "data":  "2026-09-17",
        "status":  "FECHADO"
    },
    {
        "id":  "2000374631",
        "cliente":  "ADRIANA VERMELHO",
        "produto":  "Método CIS - Presencial",
        "valor":  3997,
        "data":  "2026-09-16",
        "status":  "FECHADO"
    },
    {
        "id":  "2000374630",
        "cliente":  "ADRIANA VERMELHO",
        "produto":  "Método CIS - Presencial",
        "valor":  3997,
        "data":  "2026-09-15",
        "status":  "FECHADO"
    },
    {
        "id":  "2000365314",
        "cliente":  "Vitor Rafael Dias Borges",
        "produto":  "Método CIS - Global x2",
        "valor":  4792.81,
        "data":  "2026-09-03",
        "status":  "FECHADO"
    },
    {
        "id":  "2000365145",
        "cliente":  "Fabiano De souza Lopes",
        "produto":  "Método CIS - Global",
        "valor":  1198.2,
        "data":  "2026-09-02",
        "status":  "FECHADO"
    }
]
};