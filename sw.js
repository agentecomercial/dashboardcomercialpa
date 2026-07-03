// Service Worker para PWA - Agente Comercial Febracis
// v95 — Perfis CIS expandidos pra 50 (6 originais + 44 novos calibrados ao PDF Método CIS: 4 dias / 60h imersão, +1M treinadas, +650 turmas, modalidades Presencial e Global, 5 pilares (Finanças/Business/Performance Emocional/Saúde/Relacionamento), reprogramação crenças, EAI (Experiências Adversas Infância), autossabotagem, empoderamento mulher, fundamentação Neurociência/PNL/Psicologia Positiva/Antropologia/Pedagogia/Física Quântica, endossos Cury/Shinyashiki/Suzuki/Zé Roberto). Distribuição DISC: 11D + 11I + 11S + 11C + 6 mistos. FECHA SÉRIE: todos os 10 produtos com 50 perfis cada (500 perfis totais).
const CACHE_NAME = 'agente-febracis-v108';
const URLS = [
  './agente-comercial.html',
  './manifest.json',
  './js/data/treinamentos.js',
  './js/data/playbook-spin-tour.js',
  './js/data/perfis-treino.js'
  // api-key.js NÃO entra no cache (não está no git e pode mudar)
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(URLS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Network-first: tenta a rede primeiro, cai pro cache se offline.
// Garante que o HTML atualizado sempre seja servido quando online.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
