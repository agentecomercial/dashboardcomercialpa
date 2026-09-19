/* Meta Master — Service Worker (PWA / atalho no celular) */
/* Bump a cada mudança de comportamento: o `activate` apaga os caches antigos e o app volta
   a servir o index novo. Sem isso, o celular em PWA (e a aba já aberta) fica com a versão velha. */
const CACHE = 'mm-shell-v6';   // v6: dossie dos treinamentos + quem fechou cada treinamento nos cards
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
  // navegacao: rede primeiro, cai para o cache se estiver offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }
  // estaticos (css, icones): cache primeiro, atualiza em segundo plano
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
    return res;
  }).catch(() => hit)));
});
