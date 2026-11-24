// =====================================================================
//  v5: O QUE O APP DO ADMINISTRADOR FAZ EM SEGUNDO PLANO
//  (roda na página e no service worker; banco próprio "gastos-admin",
//  separado do banco do app das pessoas, que fica no mesmo endereço)
//  - Pedido do 🐞: fica guardado e vai com qualquer internet. Sem internet,
//    o Android avisa quando ela voltar (Background Sync) e o pedido vai
//    sozinho, mesmo com o app fechado.
//  - Avisos no celular: guarda a "chave de avisos" deste aparelho, que o
//    service worker usa para buscar o texto do aviso no servidor.
// =====================================================================
const AdminFundo = (() => {
  const NOME_BANCO = 'gastos-admin';
  const TRAVA = 'admin-envio-pedidos'; // o app das pessoas usa outro nome
  const ETIQUETA = 'admin-enviar-pedidos';

  function abrir() {
    return new Promise((ok) => {
      let req;
      try { req = indexedDB.open(NOME_BANCO, 1); } catch (e) { ok(null); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('config')) db.createObjectStore('config', { keyPath: 'chave' });
        if (!db.objectStoreNames.contains('fila')) db.createObjectStore('fila', { keyPath: 'id' });
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ok(null);
      req.onblocked = () => ok(null);
    });
  }
  function pedido(r) { return new Promise((ok, falha) => { r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error); }); }
  async function usar(store, modo, fn) {
    const db = await abrir();
    if (!db) return undefined;
    try {
      const t = db.transaction(store, modo);
      const r = await fn(t.objectStore(store));
      if (modo === 'readwrite') await new Promise((ok, falha) => { t.oncomplete = ok; t.onerror = () => falha(t.error); t.onabort = () => falha(t.error); });
      return r;
    } finally {
      db.close();
    }
  }
  async function lerConfig(chave, padrao) {
    const r = await usar('config', 'readonly', s => pedido(s.get(chave)));
    return r === undefined ? padrao : r.valor;
  }
  function gravarConfig(chave, valor) {
    return usar('config', 'readwrite', s => (valor == null ? s.delete(chave) : s.put({ chave, valor })));
  }
  async function pendentes() { return (await usar('fila', 'readonly', s => pedido(s.getAll()))) || []; }
  function enfileirar(p) { return usar('fila', 'readwrite', s => s.put(p)); }
  function tirar(id) { return usar('fila', 'readwrite', s => s.delete(id)); }

  function urlDoServidor() {
    const u = (typeof CONFIG !== 'undefined' && CONFIG.URL_SERVIDOR) || '';
    return (/^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u)) ? u : '';
  }
  async function base64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  async function postar(corpo, ms = 180000) {
    const url = urlDoServidor();
    if (!url) return { rede: true };
    try {
      const controle = new AbortController();
      const relogio = setTimeout(() => controle.abort(), ms);
      const resp = await fetch(url, { method: 'POST', body: JSON.stringify(corpo), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', cache: 'no-store', signal: controle.signal });
      const texto = await resp.text();
      clearTimeout(relogio);
      return JSON.parse(texto);
    } catch (e) {
      return { rede: true };
    }
  }

  // ---- pedido do 🐞 ----
  async function semTrava() {
    const fila = await pendentes();
    const token = await lerConfig('token', '');
    if (!fila.length || !token) return { enviados: 0, restantes: fila.length, semRede: false };
    let enviados = 0;
    let semRede = false;
    const erros = [];
    const numeros = [];
    for (const m of fila.sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0))) {
      const melhoria = { id: m.id, criadoEm: m.criadoEm, tela: m.tela, nomeTela: m.nomeTela, texto: m.texto || '', duracao: m.duracao || 0, versaoApp: m.versaoApp || '', aparelho: m.aparelho || '' };
      if (m.audio) melhoria.audio = { mime: m.audio.type || 'audio/webm', base64: await base64(m.audio) };
      if (m.imagem) melhoria.imagem = { mime: 'image/jpeg', base64: await base64(m.imagem) };
      if (Array.isArray(m.fotos) && m.fotos.length) {
        melhoria.fotos = [];
        for (const f of m.fotos.slice(0, 5)) melhoria.fotos.push({ mime: f.type || 'image/jpeg', base64: await base64(f) });
      }
      const r = await postar({ admin: true, acao: 'melhoria', token, melhoria });
      if (r.rede) { semRede = true; break; }
      if (!r.ok) { erros.push({ codigo: r.erro || '', mensagem: r.mensagem || '' }); if (r.erro === 'sessao_invalida') break; continue; }
      enviados++;
      numeros.push(r.numero);
      await tirar(m.id);
    }
    return { enviados, numeros, restantes: (await pendentes()).length, semRede, erros };
  }
  function enviarTodos() {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav && nav.locks && nav.locks.request) return nav.locks.request(TRAVA, semTrava);
    return semTrava();
  }
  async function agendar() {
    try {
      if (typeof navigator === 'undefined' || !navigator.serviceWorker) return false;
      const reg = await navigator.serviceWorker.ready;
      if (!reg.sync) return false;
      await reg.sync.register(ETIQUETA);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---- avisos no celular: o texto do aviso (o aviso chega sem conteúdo; o celular busca com a chave de avisos) ----
  async function buscarAvisos() {
    const chave = await lerConfig('chaveAvisos', '');
    if (!chave) return { avisos: [], semChave: true };
    const r = await postar({ admin: true, acao: 'avisos', chave }, 20000);
    if (r.rede) return { avisos: [], rede: true };
    if (!r.ok) return { avisos: [], erro: r.erro || 'erro' };
    return { avisos: r.avisos || [] };
  }

  return { lerConfig, gravarConfig, enfileirar, pendentes, enviarTodos, agendar, buscarAvisos, ETIQUETA };
})();
