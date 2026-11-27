// =====================================================================
//  v6: RELATÓRIO DO VEÍCULO NO ADMINISTRADOR
//  As telas são as mesmas do app (relatorio.js, pneus.js e exportar.js,
//  copiados do app sem mudança). Esta ponte entrega a elas, no lugar do
//  banco do celular, os dados que o Administrador já carregou.
//  A pessoa dona do veículo não fica sabendo de nada.
// =====================================================================
const RelAdm = (() => {
  const $ = (id) => document.getElementById(id);
  const A = () => window.Admin;
  const TELA_DO_APP = { 'v-relatorio': 'rel', 'v-gastos': 'rel-gastos', 'v-desempenho': 'rel-desempenho', 'v-pneus': 'rel-pneus' };
  const memoria = {};
  let dialogo = null; // { aoVoltar }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function brl(v) { return 'R$ ' + (Math.round((Number(v) || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function dataCurta(iso) { const p = String(iso || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ''; }

  // ---- os dados: os veículos e gastos que o Administrador carregou ----
  async function veiculoAtivo(id) {
    const D = A().dados();
    const v = D && (D.veiculos || []).find(x => x.id === id && !x.excluido);
    // meu: false = só leitura (o "Informar uma troca antiga" do Pneus fica escondido; no Administrador isso é no Editar veículo)
    return v ? Object.assign({}, v, { meu: false }) : null;
  }
  async function gastosDo(veiculoId) {
    const D = A().dados();
    return ((D && D.registros) || []).filter(r => r.veiculoId === veiculoId && !r.excluido);
  }
  async function compartilhado(v) {
    const D = A().dados();
    return ((D && D.compartilhamentos) || []).some(c => c.veiculoId === v.id);
  }

  // ---- datas: o calendário do próprio celular ----
  function definirData(campo, iso) {
    if (!campo) return;
    campo.value = iso || '';
    campo.textContent = iso ? dataCurta(iso) : (campo.dataset.opcional ? 'Não informada' : 'Escolha a data');
    campo.classList.toggle('vazio', !iso);
  }
  function abrirCalendario(campo) {
    const ent = document.createElement('input');
    ent.type = 'date';
    ent.value = campo.value || '';
    ent.className = 'rel-data-oculta';
    document.body.appendChild(ent);
    const fim = () => setTimeout(() => ent.remove(), 0);
    ent.addEventListener('change', () => {
      if (ent.value) {
        definirData(campo, ent.value);
        campo.dispatchEvent(new Event('change', { bubbles: true }));
      }
      fim();
    });
    ent.addEventListener('blur', fim);
    try { ent.showPicker(); } catch (e) { ent.focus(); ent.click(); }
  }

  // ---- janelas do relatório (exportar) ----
  function abrirDialogo(html, aoVoltar, { fora = false } = {}) {
    const raiz = $('rel-dialogo');
    raiz.innerHTML = html;
    dialogo = { aoVoltar };
    history.pushState({ janela: true, tela: A().tela(), dados: A().dadosTela(), relDialogo: true }, '');
    const fundo = raiz.firstElementChild;
    if (fora && fundo) fundo.addEventListener('click', (e) => { if (e.target === fundo) { fecharDialogo(); if (aoVoltar) aoVoltar(); } });
  }
  function fecharDialogo() {
    if (!dialogo) return;
    dialogo = null;
    $('rel-dialogo').innerHTML = '';
    A().voltarSemDesenhar();
  }
  /** O "voltar" do celular com a janela aberta: só fecha a janela. Devolve true se fechou. */
  function aoVoltarCelular() {
    if (!dialogo) return false;
    const d = dialogo;
    dialogo = null;
    $('rel-dialogo').innerHTML = '';
    if (d.aoVoltar) d.aoVoltar();
    return true;
  }

  /** Abre o relatório do veículo (menu "segurar" da lista de Veículos). */
  function abrir(veiculoId) {
    if (typeof Relatorio !== 'undefined') Relatorio.limpar();
    A().ir('rel', { veiculoId });
  }

  // ---- as pontes que os arquivos do app usam ----
  window.App = {
    esc, brl,
    dadosTela: () => A().dadosTela(),
    voltar: () => A().voltar(),
    toast: (msg, ms) => A().aviso(String(msg || '').replace(/<[^>]+>/g, ''), ms),
    abrirDialogo, fecharDialogo,
    mensagemErroGeral: (e) => (e && e.message) || 'Não deu certo. Tente de novo.',
    normalizarEmail: (e) => { const s = String(e || '').trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : ''; },
    agendarSync: () => { /* no Administrador, nada fica para enviar */ }
  };
  window.Veiculos = {
    ir: (tela, dados) => { if (TELA_DO_APP[tela]) A().ir(TELA_DO_APP[tela], dados); },
    _util: { veiculoAtivo, gastosDo, abrirCalendario, definirData, compartilhado }
  };
  window.Banco = {
    lerConfig: async (k, padrao) => (Object.prototype.hasOwnProperty.call(memoria, k) ? memoria[k] : padrao),
    gravarConfig: async (k, v) => { memoria[k] = v; },
    obter: async () => null,
    gravar: async () => { throw new Error('No Administrador, a troca antiga dos pneus fica em Editar veículo.'); }
  };
  window.Perfil = { obter: async () => ({ nome: 'Administrador', email: '' }) };
  // a planilha é montada no servidor como se fosse a dona do veículo pedindo
  window.Api = {
    chamar: async (acao, dados) => {
      if (acao === 'exportarPlanilha') return A().chamar('admExportarPlanilha', dados.veiculoId, dados.formato, dados.planilha);
      if (acao === 'enviarPlanilha') return A().chamar('admEnviarPlanilha', dados);
      const e = new Error('Ação indisponível no Administrador.');
      e.codigo = 'acao_desconhecida';
      throw e;
    }
  };

  return { abrir, aoVoltarCelular, TELAS: Object.values(TELA_DO_APP) };
})();
