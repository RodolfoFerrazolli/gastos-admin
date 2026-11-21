// =====================================================================
//  TELA DE TRÁS PARADA (V9)
//  Com uma janela aberta (aviso, filtros, menu, foto em tela cheia,
//  câmera, recorte), arrastar o dedo não pode mexer a tela de trás.
//  - a página fica sem rolagem (classe "fundo-travado" no <html>);
//  - o arrastar só passa quando começa dentro de algo que rola de
//    verdade (o conteúdo comprido de uma janela) e enquanto ainda há
//    para onde rolar; no resto, é bloqueado.
//  O mesmo arquivo vai no app do administrador.
// =====================================================================
const TravaFundo = (() => {
  let ativo = false;
  let inicioY = 0;

  /** O primeiro elemento (do dedo para fora) que rola de verdade na vertical. */
  function rolavelAcima(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.nodeType === 1) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el;
      }
      el = el.parentNode;
    }
    return null;
  }
  document.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length) inicioY = e.touches[0].clientY;
  }, { passive: true, capture: true });
  document.addEventListener('touchmove', (e) => {
    if (!ativo || !e.cancelable) return;
    if (e.touches && e.touches.length > 1) return; // pinça (zoom da foto): fica com quem cuida dela
    const alvo = e.target;
    if (alvo && alvo.closest && alvo.closest('input[type="range"]')) return;
    const r = rolavelAcima(alvo);
    if (r) {
      const dy = e.touches[0].clientY - inicioY; // > 0: dedo descendo (rola para cima)
      const noTopo = r.scrollTop <= 0;
      const noFim = r.scrollTop + r.clientHeight >= r.scrollHeight - 1;
      if ((dy > 0 && noTopo) || (dy < 0 && noFim)) e.preventDefault(); // chegou na ponta: não passa para trás
      return;
    }
    e.preventDefault();
  }, { passive: false, capture: true });

  function definir(v) {
    v = !!v;
    if (v === ativo) return;
    ativo = v;
    document.documentElement.classList.toggle('fundo-travado', v);
  }
  /** Fica olhando os elementos: testar() diz se há alguma janela aberta. */
  function vigiar(testar, elementos) {
    const atualizar = () => definir(testar());
    const obs = new MutationObserver(atualizar);
    elementos.forEach((el) => { if (el) obs.observe(el, { childList: true, attributes: true, attributeFilter: ['class'] }); });
    atualizar();
    return atualizar;
  }
  return { definir, vigiar, ativo: () => ativo };
})();
