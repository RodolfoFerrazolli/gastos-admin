// Copiado do app de gastos (v13) sem mudanças: o Administrador mostra as mesmas telas (rel-ponte.js).
// =====================================================================
//  EXPORTAR PLANILHA DO VEÍCULO (V8)
//  Relatório > "Exportar planilha": escolhe o período e o formato
//  (Excel, LibreOffice, Google Planilhas por link ou PDF). O servidor
//  monta a planilha com as contas feitas aqui (relatorio.js) e devolve
//  o arquivo (ou o link). Depois dá para compartilhar pelo celular
//  (WhatsApp, Bluetooth, Drive...) ou mandar por e-mail.
//  Tudo acontece numa janela só: cada passo troca o conteúdo dela, e o
//  "voltar" do celular fecha a janela.
// =====================================================================
const Exportar = (() => {
  const $ = (id) => document.getElementById(id);
  const App = () => window.App;
  const esc = (s) => App().esc(s);

  const FORMATOS = [
    { id: 'xlsx', sigla: 'XLSX', cor: '#1e7145', nome: 'Excel', texto: 'Abre no Excel, no celular e também no LibreOffice' },
    { id: 'ods', sigla: 'ODS', cor: '#18a303', nome: 'LibreOffice Calc', texto: 'Formato aberto e gratuito' },
    { id: 'link', sigla: 'G', cor: '#0f9d58', nome: 'Google Planilhas', texto: 'Um link para abrir no navegador ou no app do Google (vale por 30 dias)' },
    { id: 'pdf', sigla: 'PDF', cor: '#c62828', nome: 'PDF', texto: 'Só para ver ou imprimir (não dá para editar)' }
  ];
  const E = { aberto: false, vez: 0, veiculo: null, regs: [], de: '', ate: '', formato: 'xlsx', resultado: null, titulo: '', periodo: '' };

  function hojeIso() {
    const a = new Date();
    return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}-${String(a.getDate()).padStart(2, '0')}`;
  }
  function iso(a) { return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}-${String(a.getDate()).padStart(2, '0')}`; }
  function dataBR(s) { const p = String(s || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ''; }
  function tamanho(b) { return b < 1024 ? b + ' bytes' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB'; }

  /** Atalhos do período (devolve null quando não tem gasto nenhum ali). */
  function atalho(qual) {
    const p = Relatorio.periodoPadrao(E.regs);
    if (!p) return null;
    const hoje = new Date();
    if (qual === 'tudo') return p;
    if (qual === 'ano') return { de: `${hoje.getFullYear()}-01-01`, ate: hojeIso() };
    if (qual === 'tres') return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)), ate: hojeIso() };
    if (qual === 'mes') return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: hojeIso() };
    return null;
  }

  function janela(html) {
    const caixa = $('exp-caixa');
    if (caixa) caixa.innerHTML = html;
  }

  // ---- 1) período e formato ----
  async function abrir(veiculoId) {
    const v = await Veiculos._util.veiculoAtivo(veiculoId);
    if (!v) return;
    E.veiculo = v;
    E.regs = await Veiculos._util.gastosDo(v.id);
    const p = Relatorio.periodoAtual() || Relatorio.periodoPadrao(E.regs);
    if (!p) { App().toast('Nenhum gasto lançado neste veículo ainda.'); return; }
    E.de = p.de;
    E.ate = p.ate;
    E.formato = 'xlsx'; // V11: sem o "Lembrar este formato": sempre começa no Excel
    E.resultado = null;
    E.aberto = true;
    E.vez++;
    App().abrirDialogo('<div class="fundo-dialogo"><div class="dialogo exportar" role="dialog" aria-label="Exportar planilha" id="exp-caixa"></div></div>',
      () => { E.aberto = false; E.vez++; });
    passoEscolher();
  }

  function passoEscolher(erro = '') {
    const v = E.veiculo;
    janela(`<h2>📥 Exportar planilha</h2><p class="exp-sub">${esc(v.modelo)} · ${esc(v.placa)}</p>` +
      '<div class="exp-rotulo">Período</div>' +
      `<div class="periodo"><div><label for="exp-de">De</label><input type="date" id="exp-de" value="${esc(E.de)}"></div>` +
      `<div><label for="exp-ate">Até</label><input type="date" id="exp-ate" value="${esc(E.ate)}"></div></div>` +
      '<div class="exp-atalhos" id="exp-atalhos"><button type="button" data-atalho="tudo">Tudo</button><button type="button" data-atalho="ano">Este ano</button>' +
      '<button type="button" data-atalho="tres">Últimos 3 meses</button><button type="button" data-atalho="mes">Este mês</button></div>' +
      '<div class="exp-rotulo">Formato</div><div id="exp-formatos">' +
      FORMATOS.map(f => `<button type="button" class="exp-formato${f.id === E.formato ? ' marcado' : ''}" data-formato="${f.id}" aria-pressed="${f.id === E.formato}">` +
        `<span class="exp-sigla" style="background:${f.cor}">${f.sigla}</span><span class="exp-ftexto"><b>${esc(f.nome)}</b><small>${esc(f.texto)}</small></span>` +
        '<span class="exp-radio"></span></button>').join('') + '</div>' +
      `<p class="erro" id="exp-erro">${esc(erro)}</p>` +
      '<div class="botoes"><button class="botao" type="button" id="exp-cancelar">Cancelar</button><button class="botao primario" type="button" id="exp-gerar">Gerar planilha</button></div>');
    marcarAtalho();
    $('exp-de').onchange = () => { E.de = $('exp-de').value; if (E.de && E.ate && E.de > E.ate) { E.ate = E.de; $('exp-ate').value = E.ate; } marcarAtalho(); };
    $('exp-ate').onchange = () => { E.ate = $('exp-ate').value; if (E.de && E.ate && E.de > E.ate) { E.de = E.ate; $('exp-de').value = E.de; } marcarAtalho(); };
    $('exp-atalhos').onclick = (e) => {
      const b = e.target.closest('[data-atalho]');
      if (!b) return;
      const p = atalho(b.dataset.atalho);
      if (!p) return;
      E.de = p.de; E.ate = p.ate;
      $('exp-de').value = E.de; $('exp-ate').value = E.ate;
      marcarAtalho();
    };
    $('exp-formatos').onclick = (e) => {
      const b = e.target.closest('[data-formato]');
      if (!b) return;
      E.formato = b.dataset.formato;
      document.querySelectorAll('#exp-formatos [data-formato]').forEach((x) => {
        x.classList.toggle('marcado', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
    };
    $('exp-cancelar').onclick = () => fechar();
    $('exp-gerar').onclick = () => gerar();
  }
  function marcarAtalho() {
    document.querySelectorAll('#exp-atalhos [data-atalho]').forEach((b) => {
      const p = atalho(b.dataset.atalho);
      b.classList.toggle('marcado', !!p && p.de === E.de && p.ate === E.ate);
    });
  }

  function fechar() {
    if (!E.aberto) return;
    E.aberto = false;
    E.vez++;
    App().fecharDialogo();
  }

  // ---- 2) montando ----
  async function gerar() {
    if (!E.de || !E.ate) { passoEscolher('Escolha as datas do período.'); return; }
    if (E.de > E.ate) { passoEscolher('A data "De" está depois da data "Até".'); return; }
    if (!navigator.onLine) { passoEscolher('Sem internet: a planilha é montada no servidor. Conecte e tente de novo.'); return; }
    const v = E.veiculo;
    const regs = await Veiculos._util.gastosDo(v.id); // o que estiver no celular agora (inclusive o que ainda não subiu)
    if (!regs.some(r => r.tipo !== 'galeria' && !r.excluirPendente && r.data && r.data >= E.de && r.data <= E.ate)) {
      passoEscolher('Nenhum gasto neste período.');
      return;
    }
    try {
    } catch (e) { /* só uma preferência */ }
    const perfil = (await Perfil.obter()) || {};
    const dados = Relatorio.dadosPlanilha(v, regs, E.de, E.ate, {
      eu: perfil.nome || '', compartilhado: await Veiculos._util.compartilhado(v, regs), agora: new Date()
    });
    E.titulo = `Relatório do ${v.modelo} · ${v.placa}`;
    E.periodo = `${dataBR(E.de)} a ${dataBR(E.ate)}`;
    const minha = ++E.vez;
    janela('<div class="exp-montando"><div class="exp-giro"></div><div><b>Montando a planilha…</b>' +
      '<small>Calculando e desenhando os gráficos. Pode levar uns 20 segundos.</small></div></div>' +
      '<div class="botoes"><button class="botao" type="button" id="exp-cancelar">Cancelar</button></div>');
    $('exp-cancelar').onclick = () => fechar();
    let r;
    try {
      r = await Api.chamar('exportarPlanilha', { veiculoId: v.id, formato: E.formato, planilha: dados }, { tempoMs: 150000 });
    } catch (e) {
      if (minha !== E.vez || !E.aberto) return;
      passoEscolher(e && e.codigo === 'acao_desconhecida'
        ? 'O servidor ainda está na versão antiga. Avise o organizador para atualizar o código no Apps Script (V9).'
        : App().mensagemErroGeral(e));
      return;
    }
    if (minha !== E.vez || !E.aberto) return; // fechou enquanto montava
    if (r.formato === 'link') {
      E.resultado = { link: true, url: r.url, nome: r.nome, apagaEm: r.apagaEm };
    } else {
      const blob = await base64ParaBlob(r.base64, r.mime);
      E.resultado = { link: false, nome: r.nome, mime: r.mime, tamanho: r.tamanho || blob.size, base64: r.base64, arquivo: new File([blob], r.nome, { type: r.mime }) };
    }
    passoPronta();
  }

  async function base64ParaBlob(base64, mime) {
    try {
      return await (await fetch(`data:${mime};base64,${base64}`)).blob();
    } catch (e) {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
  }

  // ---- 3) pronta: compartilhar pelo celular ou por e-mail ----
  function podeCompartilharArquivo() {
    try { return !!(navigator.canShare && E.resultado && E.resultado.arquivo && navigator.canShare({ files: [E.resultado.arquivo] })); } catch (e) { return false; }
  }
  function passoPronta(msg = '') {
    const r = E.resultado;
    const f = FORMATOS.find(x => x.id === (r.link ? 'link' : E.formato)) || FORMATOS[0];
    const ate = r.link && r.apagaEm ? new Date(r.apagaEm) : null;
    const meta = r.link
      ? `Link válido até ${ate ? dataBR(`${ate.getFullYear()}-${String(ate.getMonth() + 1).padStart(2, '0')}-${String(ate.getDate()).padStart(2, '0')}`) : '30 dias'}`
      : `5 abas · ${tamanho(r.tamanho)}`;
    const compartilhar = r.link
      ? { icone: '📤', titulo: 'Compartilhar o link', texto: 'Abre a lista do celular para escolher', chips: ['WhatsApp', 'Telegram', 'SMS'] }
      : podeCompartilharArquivo()
        ? { icone: '📤', titulo: 'Compartilhar pelo celular', texto: 'Abre a lista do celular para escolher', chips: ['WhatsApp', 'Bluetooth', 'Drive', 'Salvar'] }
        : { icone: '💾', titulo: 'Baixar o arquivo', texto: 'Salva a planilha neste aparelho', chips: [] };
    janela('<div class="exp-ok">✓</div><h2 class="centro">Planilha pronta!</h2>' +
      `<div class="exp-arq"><span class="exp-sigla grande" style="background:${f.cor}">${f.sigla}</span><div><b>${esc(r.nome)}</b><small>${esc(meta)}</small></div></div>` +
      (r.link ? '<div class="exp-links"><button type="button" class="botao" id="exp-abrir">🔗 Abrir</button><button type="button" class="botao" id="exp-copiar">📋 Copiar link</button></div>' : '') +
      '<p class="exp-pergunta">Como você quer mandar?</p>' +
      `<button type="button" class="exp-opcao" id="exp-celular"><span class="exp-icone azul">${compartilhar.icone}</span><span class="exp-ftexto"><b>${compartilhar.titulo}</b>` +
      `<small>${compartilhar.texto}</small>${compartilhar.chips.length ? `<span class="exp-chips">${compartilhar.chips.map(c => `<i>${c}</i>`).join('')}</span>` : ''}</span><span class="exp-seta">›</span></button>` +
      '<button type="button" class="exp-opcao" id="exp-email"><span class="exp-icone laranja">✉️</span><span class="exp-ftexto"><b>Enviar por e-mail</b>' +
      `<small>${r.link ? 'O servidor manda o link' : 'O servidor manda a planilha anexada'} para o e-mail que você escolher</small></span><span class="exp-seta">›</span></button>` +
      (!r.link && podeCompartilharArquivo() ? '<button type="button" class="botao-link" id="exp-baixar">💾 Só baixar o arquivo</button>' : '') +
      `<p class="exp-msg" id="exp-msg">${esc(msg)}</p>` +
      '<div class="botoes"><button class="botao" type="button" id="exp-fechar">Fechar</button></div>');
    $('exp-fechar').onclick = () => fechar();
    $('exp-email').onclick = () => passoEmail();
    $('exp-celular').onclick = () => compartilharCelular();
    if ($('exp-baixar')) $('exp-baixar').onclick = () => baixar();
    if ($('exp-abrir')) $('exp-abrir').onclick = () => { window.open(r.url, '_blank', 'noopener'); };
    if ($('exp-copiar')) $('exp-copiar').onclick = () => copiarLink();
  }

  async function compartilharCelular() {
    const r = E.resultado;
    try {
      if (r.link) {
        if (navigator.share) {
          await navigator.share({ title: E.titulo, text: `${E.titulo} (${E.periodo})`, url: r.url });
        } else {
          await copiarLink();
        }
        return;
      }
      if (!podeCompartilharArquivo()) { baixar(); return; }
      await navigator.share({ files: [r.arquivo], title: E.titulo, text: `${E.titulo} (${E.periodo})` });
    } catch (e) {
      if (e && e.name === 'AbortError') return; // a pessoa fechou a lista do celular
      if ($('exp-msg')) $('exp-msg').textContent = 'Não deu para abrir a lista do celular. Use "Só baixar o arquivo" ou "Enviar por e-mail".';
    }
  }

  function baixar() {
    const r = E.resultado;
    const url = URL.createObjectURL(r.arquivo);
    const a = document.createElement('a');
    a.href = url;
    a.download = r.nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if ($('exp-msg')) $('exp-msg').textContent = '💾 Arquivo baixado: fica na pasta Downloads do aparelho.';
  }

  async function copiarLink() {
    const r = E.resultado;
    let ok = false;
    try { await navigator.clipboard.writeText(r.url); ok = true; } catch (e) { ok = false; }
    if ($('exp-msg')) $('exp-msg').textContent = ok ? '📋 Link copiado.' : 'Não deu para copiar. Use "Compartilhar o link".';
  }

  // ---- 4) e-mail ----
  async function passoEmail(erro = '', valor = null) {
    const perfil = (await Perfil.obter()) || {};
    const r = E.resultado;
    const email = valor != null ? valor : (perfil.email || '');
    const f = FORMATOS.find(x => x.id === (r.link ? 'link' : E.formato)) || FORMATOS[0];
    janela('<h2>✉️ Enviar por e-mail</h2><p class="exp-sub">Confira o e-mail. Se quiser mandar para outro, é só apagar e digitar.</p>' +
      `<label for="exp-para">Mandar para${perfil.email && email === perfil.email ? ' <span class="exp-tag">e-mail do seu cadastro</span>' : ''}</label>` +
      `<input id="exp-para" type="email" inputmode="email" autocomplete="email" placeholder="nome@gmail.com" value="${esc(email)}" multiple>` +
      '<p class="dica">Trocar aqui <b>não muda</b> o e-mail do seu cadastro. Dá para colocar mais de um, separando por vírgula.</p>' +
      `<div class="exp-anexo"><span class="exp-sigla" style="background:${f.cor}">${f.sigla}</span><div>${esc(r.link ? 'Link da planilha' : r.nome)}` +
      `<small>assunto: “${esc(E.titulo)} · ${esc(E.periodo)}”</small></div></div>` +
      `<p class="erro" id="exp-erro">${esc(erro)}</p>` +
      '<div class="botoes"><button class="botao" type="button" id="exp-voltar">Voltar</button><button class="botao primario" type="button" id="exp-enviar">Enviar</button></div>');
    const campo = $('exp-para');
    campo.addEventListener('input', () => {
      const tag = document.querySelector('label[for="exp-para"] .exp-tag');
      if (tag) tag.remove();
    });
    campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('exp-enviar').click(); } });
    $('exp-voltar').onclick = () => passoPronta();
    $('exp-enviar').onclick = () => enviarEmail();
  }

  async function enviarEmail() {
    const r = E.resultado;
    const texto = $('exp-para').value.trim();
    const lista = texto.split(/[,;\s]+/).filter(Boolean);
    if (!lista.length) { passoEmail('Digite pelo menos um e-mail.', texto); return; }
    const ruim = lista.find(e => !App().normalizarEmail(e));
    if (ruim) { passoEmail(`Este e-mail não parece certo: ${ruim}`, texto); return; }
    if (lista.length > 5) { passoEmail('Dá para mandar para no máximo 5 e-mails de uma vez.', texto); return; }
    if (!navigator.onLine) { passoEmail('Sem internet. Conecte e tente de novo.', texto); return; }
    const minha = ++E.vez;
    $('exp-enviar').disabled = true;
    $('exp-enviar').textContent = 'Enviando…';
    $('exp-voltar').disabled = true;
    try {
      const dados = { emails: lista.join(','), titulo: E.titulo, periodo: E.periodo };
      if (r.link) dados.url = r.url;
      else Object.assign(dados, { nome: r.nome, mime: r.mime, base64: r.base64 });
      const resp = await Api.chamar('enviarPlanilha', dados, { tempoMs: 90000 });
      if (minha !== E.vez || !E.aberto) return;
      fechar();
      App().toast(`✅ Planilha enviada para ${(resp.enviadoPara || lista).join(', ')}`, 5000);
    } catch (e) {
      if (minha !== E.vez || !E.aberto) return;
      passoEmail(App().mensagemErroGeral(e), texto);
    }
  }

  return { abrir, _formatos: FORMATOS };
})();
