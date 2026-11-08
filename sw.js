// Service worker do Preço Certo: a "casca" do app (HTML, CSS, JS, fonte, ícones) em cache,
// para abrir rápido e funcionar sem internet. Mesmo padrão do app Pendências.
// A cada publicação que mude QUALQUER arquivo abaixo, AUMENTE A VERSÃO — é isso que faz os
// aparelhos baixarem a versão nova (o app mostra "Nova versão disponível · ATUALIZAR").
// Todos os caminhos são relativos à pasta do sw.js (funciona em /preco-certo/ e em localhost).

const VERSAO = 'v9';
const CACHE = `preco-certo-${VERSAO}`;

const CASCA = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'fonts/inter-var.woff2',
  'js/calculo.js',
  'js/config.js',
  'js/api.js',
  'js/pwa.js',
  'js/app.js',
  'icons/logo-clinicar.jpg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  // cache: 'reload' ignora o cache HTTP (o GitHub Pages guarda arquivos por ~10 min): a versão nova
  // nunca é montada com arquivos velhos. Não chama skipWaiting: o app pergunta antes de trocar.
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CASCA.map(url => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n.startsWith('preco-certo-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // Só GET da própria origem. A planilha (script.google.com, POST) passa direto pela rede.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Abrir o app (inclusive em modo avião): sempre o index.html do cache.
    event.respondWith(caches.match('index.html', { cacheName: CACHE }).then(r => r || fetch(req)));
    return;
  }
  event.respondWith(
    caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then(r => r || fetch(req)),
  );
});

self.addEventListener('message', event => {
  const msg = event.data || {};
  if (msg.tipo === 'versao' && event.ports[0]) event.ports[0].postMessage(VERSAO);
  if (msg.tipo === 'atualizar') self.skipWaiting();
});
