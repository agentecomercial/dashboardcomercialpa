/* Meta Master — Service Worker (PWA / atalho no celular) */
/* Bump a cada mudança de comportamento: o `activate` apaga os caches antigos e o app volta
   a servir o index novo. Sem isso, o celular em PWA (e a aba já aberta) fica com a versão velha. */
const CACHE = 'mm-shell-v15';  // v15: cache curto dos comandos caros (?fresh=1 refaz)
const SHELL = ['/index.html', '/bg.css', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // CDNs (html2canvas/jszip/fontes) pela rede
  // API e dados SEMPRE pela rede — faturamento/ranking nao podem vir de cache
  if (url.pathname.startsWith('/api') ||
      url.pathname === '/dados.js' || url.pathname === '/mm-fotos.js') return;
  // navegacao: rede primeiro, cai para o cache se estiver offline.
  // O fallback so vale para a PROPRIA pagina do shell. Antes, qualquer navegacao que
  // falhasse recebia o index.html cacheado -- com o servidor fora, clicar em
  // "Slides p/ painel" abria o dashboard na URL da apresentacao, sem erro nenhum,
  // na frente da turma (auditoria 19/09/2026).
  if (req.mode === 'navigate') {
    const ehShell = (url.pathname === '/' || url.pathname === '/index.html');
    e.respondWith(fetch(req).catch(() => ehShell
      ? caches.match('/index.html')
      : new Response(
          '<!doctype html><meta charset="utf-8">'
          + '<body style="font-family:system-ui,sans-serif;background:#12151c;color:#e6edf6;padding:40px;line-height:1.6">'
          + '<h2 style="color:#f0d98a">Servidor do Meta Master fora do ar</h2>'
          + '<p>A pagina <b>' + url.pathname + '</b> precisa do servidor local para carregar.</p>'
          + '<p>Abra o <b>Meta Master.vbs</b> (ou o Servir.ps1) e recarregue esta pagina.</p>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
    return;
  }
  // estaticos (css, icones): cache primeiro, atualiza em segundo plano
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
    return res;
  }).catch(() => hit)));
});
