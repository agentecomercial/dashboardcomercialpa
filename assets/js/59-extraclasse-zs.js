/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   59-extraclasse-zs.js â€” VENDAS DO ZS DO PABLO (EXTRACLASSE)

   ARQUIVO GERADO AUTOMATICAMENTE â€” nÃ£o edite Ã  mÃ£o.
   Fonte: Sync-Extraclasse-ZS.ps1 (lÃª o ZS via API REST).
   Gerado em: 20/08/2026 10:18 Â· MÃªs: 2026-08 Â· 14 venda(s)

   O Pablo nÃ£o lanÃ§a no HUD; as vendas dele estÃ£o sÃ³ no ZS, que o navegador
   nÃ£o consegue ler (login + CORS). Este arquivo Ã© a ponte: o 58-frz-sync.js
   lÃª window.EXTRACLASSE_ZS e importa como EXTRACLASSE na Pipeline Comercial,
   sem passar pelo pipeline_entries.

   Para atualizar:  .\Sync-Extraclasse-ZS.ps1 -Aplicar
   Depois clique em "âŸ³ Sincronizar FRZ" na Pipeline Comercial.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
window.EXTRACLASSE_ZS = {
  mes: '2026-08',
  geradoEm: '20/08/2026 10:18',
  vendas: [
    {
        "id":  "2000349593",
        "cliente":  "Gabriel Rossoni Azeredo",
        "produto":  "BHP - Gestão de Negócios",
        "valor":  2973.89,
        "data":  "2026-08-11",
        "status":  "FECHADO"
    },
    {
        "id":  "2000349594",
        "cliente":  "JOSÉ DE SÁ CAVALCANTE NETO",
        "produto":  "BHP - Gestão de Negócios",
        "valor":  4000,
        "data":  "2026-08-11",
        "status":  "FECHADO"
    },
    {
        "id":  "2000349616",
        "cliente":  "Damião Bonomo",
        "produto":  "BHP - Gestão de Negócios",
        "valor":  3232.94,
        "data":  "2026-08-11",
        "status":  "FECHADO"
    },
    {
        "id":  "2000349617",
        "cliente":  "JOÃO PHILIPI DAMIANI PIRSCHNER",
        "produto":  "BHP - Gestão de Negócios",
        "valor":  2768.66,
        "data":  "2026-08-11",
        "status":  "FECHADO"
    },
    {
        "id":  "2000349618",
        "cliente":  "MARCOS ANDRE CASAGRANDE PINTO",
        "produto":  "BHP - Gestão de Negócios",
        "valor":  2768.66,
        "data":  "2026-08-11",
        "status":  "FECHADO"
    },
    {
        "id":  "2000349626",
        "cliente":  "JEAN ALESI SILVA GONÇALVES",
        "produto":  "FCIS - Formação em Coaching",
        "valor":  4499.77,
        "data":  "2026-08-11",
        "status":  "FECHADO"
    },
    {
        "id":  "2000349625",
        "cliente":  "Anderson de Abreu Fernandes Fernandes",
        "produto":  "FCIS - Formação em Coaching",
        "valor":  4500,
        "data":  "2026-08-07",
        "status":  "FECHADO"
    },
    {
        "id":  "2000349620",
        "cliente":  "FLAVIO DE ARRAZ CRISPIM",
        "produto":  "FCIS - Formação em Coaching",
        "valor":  3749.81,
        "data":  "2026-08-06",
        "status":  "FECHADO"
    },
    {
        "id":  "2000349622",
        "cliente":  "Richard Chamberlain Chamberlain",
        "produto":  "FCIS - Formação em Coaching",
        "valor":  4500,
        "data":  "2026-08-06",
        "status":  "FECHADO"
    },
    {
        "id":  "2000349628",
        "cliente":  "LETÍCIA HIMENES DA SILVA BIANCHI",
        "produto":  "FCIS - Formação em Coaching",
        "valor":  3749.81,
        "data":  "2026-08-06",
        "status":  "FECHADO"
    },
    {
        "id":  "2000349630",
        "cliente":  "pablo comerio",
        "produto":  "FCIS - Formação em Coaching",
        "valor":  3749.81,
        "data":  "2026-08-06",
        "status":  "FECHADO"
    },
    {
        "id":  "2000349631",
        "cliente":  "Vander Stoffel Pereira",
        "produto":  "FCIS - Formação em Coaching",
        "valor":  3749.81,
        "data":  "2026-08-06",
        "status":  "FECHADO"
    },
    {
        "id":  "2000349632",
        "cliente":  "WENDELL POUBEL CALIMAN",
        "produto":  "FCIS - Formação em Coaching",
        "valor":  3749.81,
        "data":  "2026-08-06",
        "status":  "FECHADO"
    },
    {
        "id":  "2000349741",
        "cliente":  "Simone Zamprogno Scalzer",
        "produto":  "LIVRÃO MÉTODO CIS",
        "valor":  2000,
        "data":  "2026-08-05",
        "status":  "FECHADO"
    }
]
};