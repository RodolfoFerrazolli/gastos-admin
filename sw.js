// =====================================================================
//  SERVICE WORKER do "Controle de Gastos - Administrador".
//  Busca os arquivos sempre na internet (guardando uma cópia para abrir sem internet).
//  Ao publicar uma versão nova, aumente o número abaixo.
//  Só mexe nos caches que começam com "admin-" (os do app das pessoas ficam).
// =====================================================================
const VERSAO = 'admin-v2';
const ARQUIVOS = [
  './',
  './index.html',
  './estilo.css',
  './admin.js',
  './config.js',
  './trava.js',
  './gravador.js',
  './vendor/html2canvas.min.js',
  './manifest.webmanifest',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(k => k.startsWith('admin-') && k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'atualizar') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // o servidor (Apps Script) nunca passa pelo cache
  // o app do administrador só funciona com internet (os dados vêm do servidor): primeiro da internet,
  // guardando uma cópia; sem internet, abre a cópia (e avisa que está sem conexão)
  e.respondWith(
    fetch(req).then(resp => {
      if (resp && resp.ok) { const copia = resp.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); }
      return resp;
    }).catch(() => caches.open(VERSAO).then(c => c.match(req, { ignoreSearch: true })).then(r => r ||
      (req.mode === 'navigate' ? caches.open(VERSAO).then(c => c.match('./index.html')) : Response.error())))
  );
});
