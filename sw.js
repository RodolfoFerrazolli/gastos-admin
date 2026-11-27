// =====================================================================
//  SERVICE WORKER do "Controle de Gastos - Administrador".
//  Busca os arquivos sempre na internet (guardando uma cópia para abrir sem internet).
//  Ao publicar uma versão nova, aumente o número abaixo.
//  Só mexe nos caches que começam com "admin-" (os do app das pessoas ficam).
// =====================================================================
const VERSAO = 'admin-v6';
// v5: o pedido do 🐞 vai mesmo com o app fechado (quando a internet voltar) e os avisos no celular
try { importScripts('./config.js', './admin-fundo.js'); } catch (e) { /* sem o segundo plano */ }
const ARQUIVOS = [
  './',
  './index.html',
  './estilo.css',
  './admin.js',
  './config.js',
  './trava.js',
  './gravador.js',
  './admin-fundo.js',
  './rel-ponte.js', // v6: relatório do veículo (as telas do app)
  './rel/relatorio.js',
  './rel/pneus.js',
  './rel/exportar.js',
  './rel/rel-app.css',
  './vendor/html2canvas.min.js',
  './manifest.webmanifest',
  './icones/icone-192.png',
  './icones/badge-72.png',
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

self.addEventListener('sync', (e) => {
  if (typeof AdminFundo === 'undefined' || e.tag !== AdminFundo.ETIQUETA) return;
  e.waitUntil(AdminFundo.enviarTodos().then(async (r) => {
    if (r.enviados) for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage({ tipo: 'pedidosEnviados', enviados: r.enviados });
    if (r.semRede) throw new Error('sem internet: o Android tenta de novo mais tarde');
  }));
});

// v5: chegou um aviso (sem conteúdo): busca o texto no servidor e mostra a notificação
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let avisos = [];
    try { avisos = (await AdminFundo.buscarAvisos()).avisos || []; } catch (x) { avisos = []; }
    const base = { icon: './icones/icone-192.png', badge: './icones/badge-72.png', vibrate: [120, 60, 120] };
    if (!avisos.length) {
      // o Chrome sempre mostra alguma notificação para cada aviso recebido
      await self.registration.showNotification('🔔 Controle de Gastos', Object.assign({ body: 'Você tem um aviso novo. Toque para abrir.', tag: 'aviso', data: { abrir: '' } }, base));
      return;
    }
    for (const a of avisos.slice(-5)) {
      await self.registration.showNotification(a.titulo || '🔔 Controle de Gastos', Object.assign({ body: a.texto || '', tag: (a.tipo || 'aviso') + ':' + (a.em || ''), data: { abrir: a.abrir || '' } }, base));
    }
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const abrir = (e.notification.data && e.notification.data.abrir) || '';
  e.waitUntil((async () => {
    const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of lista) {
      if (c.url.indexOf(self.registration.scope) === 0) { c.postMessage({ tipo: 'abrir', abrir }); return c.focus(); }
    }
    return self.clients.openWindow('./' + (abrir ? '?abrir=' + encodeURIComponent(abrir) : ''));
  })());
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
