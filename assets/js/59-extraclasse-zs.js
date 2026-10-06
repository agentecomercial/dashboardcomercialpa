/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   59-extraclasse-zs.js â€” VENDAS DO ZS DO PABLO (EXTRACLASSE)

   ARQUIVO GERADO AUTOMATICAMENTE â€” nÃ£o edite Ã  mÃ£o.
   Fonte: Sync-Extraclasse-ZS.ps1 (lÃª o ZS via API REST).
   Gerado em: 05/10/2026 16:55 Â· MÃªs: 2026-10 Â· 0 venda(s)

   O Pablo nÃ£o lanÃ§a no HUD; as vendas dele estÃ£o sÃ³ no ZS, que o navegador
   nÃ£o consegue ler (login + CORS). Este arquivo Ã© a ponte: o 58-frz-sync.js
   lÃª window.EXTRACLASSE_ZS e importa como EXTRACLASSE na Pipeline Comercial,
   sem passar pelo pipeline_entries.

   Para atualizar:  .\Sync-Extraclasse-ZS.ps1 -Aplicar
   Depois clique em "âŸ³ Sincronizar FRZ" na Pipeline Comercial.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
window.EXTRACLASSE_ZS = {
  mes: '2026-10',
  geradoEm: '05/10/2026 16:55',
  vendas: []
};