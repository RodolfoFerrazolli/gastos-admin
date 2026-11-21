// =====================================================================
//  GRAVAÇÃO DE ÁUDIO (o Chrome grava em WebM/Opus, aceito pelo Gemini)
// =====================================================================
const Gravador = (() => {
  let rec = null;
  let fluxo = null;
  let partes = [];
  let inicio = 0;
  let travaTela = null;

  function suportado() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  function tipoPreferido() {
    const tipos = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    return tipos.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  }

  async function iniciar() {
    fluxo = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
    });
    const tipo = tipoPreferido();
    try {
      rec = new MediaRecorder(fluxo, tipo ? { mimeType: tipo, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
    } catch (e) {
      rec = new MediaRecorder(fluxo);
    }
    partes = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
    rec.start(1000);
    inicio = Date.now();
    // mantém a tela acesa durante a gravação
    try {
      if ('wakeLock' in navigator) travaTela = await navigator.wakeLock.request('screen');
    } catch (e) { travaTela = null; }
  }

  function parar() {
    return new Promise((ok) => {
      if (!rec) return ok(null);
      const r = rec;
      r.onstop = () => {
        const tipo = r.mimeType || 'audio/webm';
        const blob = new Blob(partes, { type: tipo });
        const duracao = Math.max(1, Math.round((Date.now() - inicio) / 1000));
        limpar();
        ok(blob.size ? { blob, duracao } : null);
      };
      try { r.stop(); } catch (e) { limpar(); ok(null); }
    });
  }

  function cancelar() {
    try {
      if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop(); }
    } catch (e) { /* ignora */ }
    limpar();
  }

  function limpar() {
    if (fluxo) fluxo.getTracks().forEach(t => t.stop());
    fluxo = null;
    rec = null;
    partes = [];
    if (travaTela) { travaTela.release().catch(() => {}); travaTela = null; }
  }

  const segundos = () => (rec ? Math.floor((Date.now() - inicio) / 1000) : 0);
  const gravando = () => !!rec && rec.state === 'recording';

  return { suportado, iniciar, parar, cancelar, segundos, gravando };
})();
