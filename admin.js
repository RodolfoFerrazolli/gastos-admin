// =====================================================================
//  CONTROLE DE GASTOS - ADMINISTRADOR (v2)
//  App só do organizador: faz tudo o que o painel do script.google faz.
//  Entra com a senha do painel; o servidor devolve uma chave (token) que
//  fica neste aparelho. Os dados vêm sempre do servidor (precisa de internet).
//  v2: endereço próprio no GitHub (repositório "gastos-admin"), com o
//  config.js dele (o mesmo endereço do servidor do app das pessoas);
//  o 🐞 de pedido de correção ou melhoria; a bolinha branca em cima de
//  "Filtros" saiu; com uma janela aberta, a tela de trás não rola.
// =====================================================================
const VERSAO_ADMIN = '3';

(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------------
  //  Utilidades
  // ------------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function brl(v) {
    if (v == null || v === '' || !isFinite(Number(v))) return '—';
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function brlUnit(v) {
    const n = Number(v);
    const tres = Math.abs(Math.round(n * 100) - n * 100) > 1e-6;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: tres ? 3 : 2, maximumFractionDigits: tres ? 3 : 2 });
  }
  function hora(ms) { return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function dataHora(ms) { return ms ? new Date(ms).toLocaleDateString('pt-BR') + ' ' + hora(ms) : '—'; }
  function dataDia(s) { if (!s) return '—'; const p = String(s).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : esc(s); }
  function km(n) { return n == null || n === '' ? '' : Number(n).toLocaleString('pt-BR') + ' km'; }
  function chaveDia(ms) { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  function rotuloDia(ms) {
    const k = chaveDia(ms);
    if (k === chaveDia(Date.now())) return 'Hoje';
    if (k === chaveDia(Date.now() - 86400000)) return 'Ontem';
    const d = new Date(ms);
    return `${DIAS[d.getDay()]}, ${d.toLocaleDateString('pt-BR')}`;
  }
  function quandoCurto(ms) {
    if (!ms) return '—';
    const k = chaveDia(ms);
    if (k === chaveDia(Date.now())) return 'hoje, ' + hora(ms);
    if (k === chaveDia(Date.now() - 86400000)) return 'ontem, ' + hora(ms);
    return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ', ' + hora(ms);
  }
  function zapTexto(n) {
    let d = String(n || '').replace(/\D/g, '');
    if (d.indexOf('55') === 0 && d.length >= 12) d = d.slice(2);
    return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
  }
  function linkZap(numero, texto) { return 'https://wa.me/' + String(numero || '').replace(/\D/g, '') + (texto ? '?text=' + encodeURIComponent(texto) : ''); }
  function primeiroNome(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function iniciais(n) { const p = String(n || '').trim().split(/\s+/); return ((p[0] || '')[0] || '') + (p.length > 1 ? (p[p.length - 1][0] || '') : ''); }
  function semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function chaveNome(s) { return semAcento(String(s || '').replace(/\s+/g, ' ').trim()).toLowerCase(); }
  function chavePlaca(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function lerValor(t) {
    if (t == null) return null;
    let s = String(t).trim().replace(/[R$\s]/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  function lerNumero(t) {
    let s = String(t == null ? '' : t).trim().replace(/[R$\s]/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return isFinite(n) ? n : null;
  }
  function valorTexto(v) { return v == null ? '' : String(v).replace('.', ','); }
  function paraInputLocal(ms) { if (!ms) return ''; const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
  function ehDinheiro(meio) { return /^(dinheiro|especie|espécie|em espécie)$/i.test(String(meio || '').trim()); }
  function plural(n, um, varios) { return n === 1 ? um : varios.replace('#', n); }
  function mapa(lat, lng) { return 'https://www.google.com/maps?q=' + lat + ',' + lng; }

  let toastRelogio = null;
  function aviso(msg, ms = 3500) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('oculto');
    clearTimeout(toastRelogio);
    toastRelogio = setTimeout(() => t.classList.add('oculto'), ms);
  }

  // ------------------------------------------------------------------
  //  Servidor
  // ------------------------------------------------------------------
  function urlServidor() {
    const u = (typeof CONFIG !== 'undefined' && CONFIG.URL_SERVIDOR) || '';
    return (/^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u)) ? u : '';
  }
  let TOKEN = '';
  try { TOKEN = localStorage.getItem('adm_token') || ''; } catch (e) { TOKEN = ''; }
  let INFO = {};
  try { INFO = JSON.parse(localStorage.getItem('adm_info') || '{}') || {}; } catch (e) { INFO = {}; }
  function guardar(chave, valor) { try { if (valor == null) localStorage.removeItem(chave); else localStorage.setItem(chave, valor); } catch (e) { /* sem armazenamento */ } }

  let nCarregando = 0;
  function carregando(liga) {
    nCarregando = Math.max(0, nCarregando + (liga ? 1 : -1));
    $('carregando').classList.toggle('oculto', nCarregando === 0);
    document.querySelectorAll('[data-atualizar]').forEach(b => b.classList.toggle('girando', nCarregando > 0));
  }
  class ErroSessao extends Error {}

  async function api(acao, dados = {}, { tempoMs = 120000 } = {}) {
    const url = urlServidor();
    if (!url) throw new Error('O app não encontrou o endereço do servidor (arquivo config.js).');
    const corpo = Object.assign({ admin: true, acao, token: TOKEN || undefined }, dados);
    const ctl = new AbortController();
    const relogio = setTimeout(() => ctl.abort(), tempoMs);
    carregando(true);
    let r;
    try {
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo), signal: ctl.signal, redirect: 'follow' });
      r = await resp.json();
    } catch (e) {
      throw new Error(navigator.onLine === false ? 'Sem internet no momento.' : 'Sem conexão com o servidor. Confira a internet e tente de novo.');
    } finally {
      clearTimeout(relogio);
      carregando(false);
    }
    if (r && r.erro) {
      if (r.erro === 'sessao_invalida' && acao !== 'entrar') {
        sairLocal(r.mensagem || 'Entre de novo com a senha do painel.');
        throw new ErroSessao(r.mensagem);
      }
      // servidor de antes da V8 (não conhece o app do administrador): ele pede o código do grupo e o aparelho
      const antigo = r.erro === 'aparelho_invalido' || r.erro === 'codigo_invalido';
      const e = new Error(antigo ? 'O servidor está numa versão antiga, sem o app do administrador. Cole o código da V8 no Apps Script (Nova versão).' : (r.mensagem || r.erro));
      e.codigo = antigo ? 'servidor_antigo' : r.erro;
      throw e;
    }
    if (r && r.versaoServidor) INFO.versaoServidor = r.versaoServidor;
    if (r && r.dataServidor) INFO.dataServidor = r.dataServidor; // v3: "servidor v10 · 21/11"
    return r;
  }
  async function chamar(fn, ...args) {
    const r = await api('chamar', { fn, args });
    return r.resultado;
  }
  function erroMsg(e) { return (e && e.message) || String(e); }
  /** Faz a ação e mostra o erro (se houver). Devolve o resultado ou undefined. */
  async function tentar(promessa, sucesso) {
    try {
      const r = await promessa;
      if (sucesso) aviso(sucesso);
      return r === undefined ? true : r;
    } catch (e) {
      if (!(e instanceof ErroSessao)) aviso('Erro: ' + erroMsg(e), 5000);
      return undefined;
    }
  }

  // ------------------------------------------------------------------
  //  Dados (os mesmos do painel)
  // ------------------------------------------------------------------
  let D = null;
  let carregadoEm = 0;
  async function carregar({ silencioso = false } = {}) {
    try {
      const dados = await chamar('admCarregar');
      D = dados;
      D.carregadoEm = Date.now();
      carregadoEm = Date.now();
      D.lancamentos.sort((a, b) => (b.dataHora || 0) - (a.dataHora || 0));
      atualizarContadores();
      redesenhar();
      return true;
    } catch (e) {
      if (!(e instanceof ErroSessao) && !silencioso) aviso('Não foi possível carregar: ' + erroMsg(e), 5000);
      return false;
    }
  }
  const TIPO_REG = {
    abastecimento: ['⛽', 'Abastecimento'], manutencao: ['🔧', 'Manutenção'], seguro: ['🛡️', 'Seguro'], ipva: ['🏛️', 'IPVA'],
    licenciamento: ['📄', 'Licenciamento'], multa: ['🚨', 'Multa'], outros: ['📦', 'Outros'], galeria: ['📷', 'Galeria']
  };
  const DESPESAS = ['seguro', 'ipva', 'licenciamento', 'multa', 'outros'];
  const COMBUSTIVEIS = ['Gasolina Comum', 'Gasolina Aditivada', 'Gasolina Premium', 'Etanol Comum', 'Etanol Aditivado', 'Diesel S10', 'Diesel S500', 'GNV'];
  const ROTULO = { confirmado: 'Confirmado', revisar: 'Para revisar', aguardando_ia: 'Aguardando IA', erro_ia: 'Erro na IA', excluido: 'Excluído' };
  const FONTE = { sefaz: 'Site da SEFAZ (pelo QR Code)', ia: 'IA (foto da nota)', 'sefaz+ia': 'IA (site da SEFAZ + foto da nota)' };
  const SELO_FONTE = { sefaz: ['sefaz', 'QR Code · SEFAZ'], ia: ['ia', 'IA · foto'], 'sefaz+ia': ['ia', 'SEFAZ + IA'], pendente: ['aguardando', 'não lida'] };
  function situacao(l) { return l.excluido ? 'excluido' : (l.status || 'confirmado'); }
  function fonteNota(l) { return FONTE[l.fonteDados] ? l.fonteDados : 'pendente'; }
  function seloSit(l) {
    const s = situacao(l);
    const cls = { revisar: 'revisar', aguardando_ia: 'aguardando', erro_ia: 'erro', excluido: 'exc', confirmado: 'ok' }[s] || '';
    return `<span class="selo ${cls}">${ROTULO[s] || s}</span>`;
  }
  function seloFonte(l) {
    if (l.origem !== 'foto') return '';
    const f = SELO_FONTE[fonteNota(l)];
    return `<span class="selo ${f[0]}">${f[1]}</span>`;
  }
  function veiculoPorId(id) { return (D.veiculos || []).find(v => v.id === id); }
  function registroPorId(id) { return (D.registros || []).find(r => r.id === id); }
  function contaPorId(id) { return (D.contas || []).find(c => c.id === id); }
  function lancPorId(id) { return D.lancamentos.find(l => l.id === id); }
  function nomeVeic(v) { return v ? `${v.modelo} (${v.placa})` : 'veículo'; }
  function detalheRegistro(r) {
    const p = [];
    if (r.tipo === 'abastecimento') {
      if (r.combustivel) p.push(r.combustivel);
      if (r.litros != null) p.push(String(r.litros).replace('.', ',') + (r.combustivel === 'GNV' ? ' m³' : ' L'));
      if (r.precoLitro != null) p.push(brlUnit(r.precoLitro) + (r.combustivel === 'GNV' ? '/m³' : '/L'));
      if (r.tanqueCheio) p.push('tanque cheio');
    }
    if (r.tipo === 'seguro') {
      if (r.seguradora) p.push(r.seguradora);
      if (r.apolice) p.push('apólice ' + r.apolice);
      if (r.validade) p.push('válido até ' + dataDia(r.validade));
    }
    if (r.descricao) p.push(String(r.descricao).split('\n')[0]);
    return p.join(' · ');
  }
  /** Os gastos dos veículos entram na lista e no resumo dos lançamentos (como no painel). */
  function gastosDeVeiculos() {
    const veics = {};
    (D.veiculos || []).forEach(v => { veics[v.id] = v; });
    return (D.registros || []).filter(r => {
      const v = veics[r.veiculoId];
      return r.tipo !== 'galeria' && r.valor != null && !r.excluido && v && !v.excluido;
    }).map(r => {
      const v = veics[r.veiculoId];
      const t = TIPO_REG[r.tipo] || ['', r.tipo];
      let quando = r.data ? new Date(r.data + 'T12:00:00').getTime() : r.criadoEm;
      if (r.criadoEm && r.data && chaveDia(r.criadoEm) === r.data) quando = r.criadoEm;
      return {
        id: 'veic:' + r.id, veiculo: true, registro: r, dataHora: quando, participante: r.participante, aparelhoId: r.aparelhoId || '',
        descricao: `${t[0]} ${t[1]} · ${v.modelo}`, categoria: r.tipo === 'abastecimento' ? 'Combustível' : 'Veículo',
        meioPagamento: r.formaPagamento, valorTotal: r.valor, status: r.status || 'confirmado', excluido: false, endereco: r.local,
        origem: 'veiculo', itens: []
      };
    });
  }
  function todosLancamentos() { return D.lancamentos.concat(gastosDeVeiculos()); }
  function unicos(lista) { const v = {}; lista.forEach(x => { if (x) v[x] = 1; }); return Object.keys(v).sort((a, b) => a.localeCompare(b, 'pt-BR')); }

  // ---- lixeira (30 dias) ----
  const DIA_MS = 86400000;
  function agoraServidor() { return D && D.lixeira && D.lixeira.agora ? D.lixeira.agora + (Date.now() - D.carregadoEm) : Date.now(); }
  function diasRestantes(excluidoEm) {
    const dias = (D.lixeira && D.lixeira.dias) || 30;
    if (!excluidoEm) return dias;
    return Math.max(0, Math.ceil((excluidoEm + dias * DIA_MS - agoraServidor()) / DIA_MS));
  }
  function prazoHtml(excluidoEm) {
    const d = diasRestantes(excluidoEm);
    return d <= 0 ? '<span class="prazo hoje">⏳ Apaga de vez hoje</span>' : `<span class="prazo${d <= 3 ? ' hoje' : ''}">⏳ Apaga de vez em ${d} dia${d > 1 ? 's' : ''}</span>`;
  }
  function itensLixeira() {
    if (!D) return [];
    const itens = [];
    const contasEx = {}; (D.contas || []).forEach(c => { if (c.excluido) contasEx[c.id] = c; });
    const veicEx = {}; (D.veiculos || []).forEach(v => { if (v.excluido) veicEx[v.id] = v; });
    function junto(com) {
      if (!com) return '';
      const [tipo, id] = String(com).split(':');
      if (tipo === 'conta' && contasEx[id]) return 'foi junto com a conta de ' + contasEx[id].nome;
      if (tipo === 'veiculo' && veicEx[id]) return 'foi junto com o veículo ' + nomeVeic(veicEx[id]);
      return '';
    }
    (D.contas || []).forEach(c => {
      if (c.excluido) itens.push({ grupo: 'pessoas', tipo: 'conta', id: c.id, em: c.excluidoEm, titulo: '👤 ' + c.nome, detalhe: [c.whatsapp ? zapTexto(c.whatsapp) : '', c.email].filter(Boolean).join(' · ') });
    });
    (D.veiculos || []).forEach(v => {
      if (v.excluido) itens.push({ grupo: 'veiculos', tipo: 'veiculo', id: v.id, em: v.excluidoEm, titulo: '🚗 ' + nomeVeic(v), detalhe: 'de ' + v.participante, junto: junto(v.excluidoCom) });
    });
    D.lancamentos.forEach(l => {
      if (l.excluido) itens.push({ grupo: 'lancamentos', tipo: 'lancamento', id: l.id, em: l.excluidoEm, titulo: '🧾 ' + (l.descricao || '(sem descrição)') + ' · ' + brl(l.valorTotal), detalhe: l.participante + ' · ' + dataHora(l.dataHora), junto: junto(l.excluidoCom) });
    });
    (D.registros || []).forEach(r => {
      if (!r.excluido) return;
      const t = TIPO_REG[r.tipo] || ['', r.tipo];
      itens.push({ grupo: 'gastos', tipo: 'registro', id: r.id, em: r.excluidoEm, titulo: `${t[0]} ${t[1]}${r.tipo === 'galeria' ? '' : ' · ' + brl(r.valor)}`, detalhe: `${nomeVeic(veiculoPorId(r.veiculoId))} · ${dataDia(r.data)} · por ${r.participante}`, junto: junto(r.excluidoCom) });
    });
    (D.melhorias || []).forEach(m => {
      if (m.excluido) itens.push({ grupo: 'melhorias', tipo: 'melhoria', id: m.id, em: m.excluidoEm, titulo: '🐞 Pedido nº ' + m.numero + (m.nomeTela ? ' · ' + m.nomeTela : ''), detalhe: m.participante + ' · ' + dataHora(m.criadoEm) });
    });
    return itens.sort((a, b) => (a.em || 0) - (b.em || 0));
  }
  function pedidosCadastroPendentes() { return (D.pedidosCadastro || []).filter(p => p.situacao === 'Pendente'); }
  function melhoriaConcluida(m) { return m.situacao === 'Resolvido' || m.situacao === 'Descartado'; }
  function melhoriasNovas() { return (D.melhorias || []).filter(m => m.situacao === 'Novo' && !m.excluido).length; }
  function filaIA() { return D.lancamentos.filter(l => !l.excluido && (l.status === 'aguardando_ia' || l.status === 'erro_ia')); }

  function atualizarContadores() {
    if (!D) return;
    const ped = (D.pedidosSenha || []).length + pedidosCadastroPendentes().length;
    const lixo = itensLixeira().length;
    const melh = melhoriasNovas();
    const ia = filaIA().length;
    const pon = (id, n) => { const el = $(id); if (el) { el.textContent = n ? String(n) : ''; el.classList.toggle('zero', !n); } };
    pon('nb-pessoas', ped);
    pon('nb-mais', melh + (D.ia.erros || 0)); // v3: Excluídos, Melhorias e IA ficam só dentro de Mais
    void lixo; void ia;
  }

  // ------------------------------------------------------------------
  //  Navegação (o "voltar" do celular volta uma tela)
  // ------------------------------------------------------------------
  const RAIZES = ['inicio', 'lanc', 'pessoas', 'veiculos', 'mais'];
  const ABA_DE = {
    'lanc-ver': 'lanc', 'lanc-editar': 'lanc', pessoa: 'pessoas', veiculo: 'veiculos', gasto: 'veiculos', 'gasto-editar': 'veiculos',
    'veiculo-editar': 'veiculos', lixo: 'mais', melh: 'mais', ia: 'mais', listas: 'mais', convite: 'mais', aparelhos: 'mais'
  };
  let TELA = 'entrar';
  let DADOS = {};
  let profundidade = 0;
  let abaPendente = null;
  let irDepois = null; // tela para abrir depois de voltar para a aba (menu lateral do computador)
  let ignorarPop = 0;
  const rolagem = {};

  function mostrar(tela, dados = {}, { manterRolagem = false } = {}) {
    if (TELA && TELA !== 'entrar') rolagem[TELA + '|' + JSON.stringify(DADOS || {})] = window.scrollY;
    document.querySelectorAll('.tela').forEach(t => t.classList.add('oculto'));
    $('tela-' + tela).classList.remove('oculto');
    TELA = tela;
    DADOS = dados || {};
    const comNav = tela !== 'entrar';
    $('nav').classList.toggle('oculto', !comNav);
    document.body.classList.toggle('com-nav', comNav);
    const aba = RAIZES.includes(tela) ? tela : (ABA_DE[tela] || '');
    const naLateral = false; // v3: a lateral não tem mais atalhos próprios (Excluídos, Melhorias e IA ficam em Mais)
    document.querySelectorAll('#nav [data-aba]').forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba && !naLateral));
    document.querySelectorAll('#nav [data-ir]').forEach(b => b.classList.toggle('ativa', b.dataset.ir === tela));
    if (!desenhar()) return;
    const y = rolagem[tela + '|' + JSON.stringify(DADOS)];
    window.scrollTo(0, manterRolagem && y ? y : 0);
  }
  function ir(tela, dados = {}) {
    profundidade++;
    history.pushState({ tela, dados, d: profundidade }, '');
    mostrar(tela, dados);
  }
  function irAba(aba) {
    fecharJanela(true);
    if (visorAberto()) fecharVisor(true);
    // a tela inicial fica na base do histórico: o "voltar" de outra aba vai para ela (e só dela sai do app)
    if (profundidade > 0) {
      abaPendente = aba;
      history.go(-profundidade);
    } else if (aba === 'inicio') {
      mostrar('inicio');
    } else {
      ir(aba);
    }
  }
  function voltar() { history.back(); }
  window.addEventListener('popstate', (e) => {
    if (ignorarPop) { ignorarPop--; return; }
    if (visorAberto()) { fecharVisor(false); return; } // v3: a foto pode estar por cima de uma janela (ℹ️ do veículo)
    if (janelaAberta) { fecharJanela(true, true); return; }
    if (TELA === 'entrar') return;
    const st = e.state || { tela: 'inicio', d: 0 };
    if (abaPendente && (st.d || 0) === 0) {
      const aba = abaPendente;
      abaPendente = null;
      profundidade = 0;
      history.replaceState({ tela: 'inicio', d: 0 }, '');
      if (aba === 'inicio') mostrar('inicio');
      else ir(aba);
      if (irDepois) { const t = irDepois; irDepois = null; ir(t); }
      return;
    }
    if (st.janela || st.visor) { history.back(); return; } // sobrou de uma janela ou foto fechada
    profundidade = st.d || 0;
    mostrar(st.tela || 'inicio', st.dados || {}, { manterRolagem: true });
  });

  /** Desenha a tela atual com os dados atuais. Devolve false se o item não existe mais (volta uma tela). */
  function desenhar() {
    const f = RENDER[TELA];
    if (!f) return true;
    if (TELA !== 'entrar' && !D) {
      const corpo = $(TELA + '-corpo');
      if (corpo) corpo.innerHTML = '<div class="vazio-adm">Carregando…</div>';
      return true;
    }
    const ok = f(DADOS);
    if (ok === false) {
      // o item sumiu (excluído aqui, em outro aparelho ou no painel): volta uma tela, uma vez só
      if (!desenhar.voltando) {
        desenhar.voltando = true;
        aviso('Este item não existe mais.');
        setTimeout(() => { voltar(); setTimeout(() => { desenhar.voltando = false; }, 600); }, 50);
      }
      return false;
    }
    return true;
  }
  function redesenhar() {
    if (TELA === 'entrar') return;
    const y = window.scrollY;
    desenhar();
    window.scrollTo(0, y);
  }

  // ------------------------------------------------------------------
  //  Janelas (perguntas, formulários curtos, filtros)
  // ------------------------------------------------------------------
  let janelaAberta = null;
  function abrirJanela(html, { deBaixo = false, aoFechar = null, fecharFora = true } = {}) {
    fecharJanela(true);
    const raiz = $('janela');
    raiz.innerHTML = `<div class="fundo-adm${deBaixo ? ' de-baixo' : ''}"><div class="janela${deBaixo ? ' folha' : ''}" role="dialog">${deBaixo ? '<div class="puxador-adm" aria-hidden="true"></div>' : ''}${html}</div></div>`;
    const fundo = raiz.firstChild;
    janelaAberta = { aoFechar };
    history.pushState({ janela: true, tela: TELA, dados: DADOS, d: profundidade }, '');
    if (fecharFora) fundo.addEventListener('click', (e) => { if (e.target === fundo) fecharJanela(); });
    return fundo.firstChild;
  }
  /** Fecha a janela aberta. pelaHistoria: já voltou no histórico (o "voltar" do celular). */
  function fecharJanela(semAviso = false, pelaHistoria = false) {
    if (!janelaAberta) return;
    const j = janelaAberta;
    janelaAberta = null;
    $('janela').innerHTML = '';
    if (!pelaHistoria) { ignorarPop++; history.back(); }
    // "voltar" do celular ou tocar fora: a pergunta fica sem resposta (vale como Cancelar)
    if (j.aoFechar && (pelaHistoria || !semAviso)) j.aoFechar();
  }
  function confirmar(msg, textoSim = 'Confirmar', { perigo = false, titulo = '' } = {}) {
    return new Promise((ok) => {
      const j = abrirJanela((titulo ? `<h3>${esc(titulo)}</h3>` : '') + `<p>${esc(msg)}</p><div class="botoes-j"><button class="botao" data-nao type="button">Cancelar</button>` +
        `<button class="botao ${perigo ? 'perigo' : 'primario'}" data-sim type="button">${esc(textoSim)}</button></div>`, { aoFechar: () => ok(false) });
      j.querySelector('[data-nao]').onclick = () => { janelaAberta.aoFechar = null; fecharJanela(); ok(false); };
      j.querySelector('[data-sim]').onclick = () => { janelaAberta.aoFechar = null; fecharJanela(); ok(true); };
    });
  }
  /** Duas confirmações: 1) o que vai junto; 2) digitar o nome (ou a placa) para liberar o botão. */
  function confirmarDuasVezes(titulo, resumoHtml, pedido, conferir, textoBotao) {
    return new Promise((ok) => {
      const j = abrirJanela(`<h3>${esc(titulo)}</h3><div class="confirmar-resumo">${resumoHtml}</div>` +
        `<div class="botoes-j"><button class="botao" data-nao type="button">Cancelar</button><button class="botao perigo" data-sim type="button">Continuar</button></div>`,
      { aoFechar: () => ok(null) });
      j.querySelector('[data-nao]').onclick = () => { janelaAberta.aoFechar = null; fecharJanela(); ok(null); };
      j.querySelector('[data-sim]').onclick = () => {
        // 2ª confirmação na mesma janela
        j.innerHTML = `<h3>Confirmação final</h3><p>${pedido}</p><input id="c2-texto" autocomplete="off" spellcheck="false" autocapitalize="off">` +
          `<div class="botoes-j"><button class="botao" data-nao type="button">Cancelar</button><button class="botao perigo" id="c2-sim" type="button" disabled>${esc(textoBotao)}</button></div>`;
        const inp = j.querySelector('#c2-texto');
        const sim = j.querySelector('#c2-sim');
        inp.addEventListener('input', () => { sim.disabled = !conferir(inp.value); });
        j.querySelector('[data-nao]').onclick = () => { janelaAberta.aoFechar = null; fecharJanela(); ok(null); };
        sim.onclick = () => { if (!conferir(inp.value)) return; const v = inp.value; janelaAberta.aoFechar = null; fecharJanela(); ok(v); };
        setTimeout(() => inp.focus(), 50);
      };
    });
  }
  function pedirTexto(titulo, texto, { valor = '', tipo = 'text', botao = 'Salvar', dica = '' } = {}) {
    return new Promise((ok) => {
      const j = abrirJanela(`<h3>${esc(titulo)}</h3>${texto ? `<p class="dica-txt">${texto}</p>` : ''}<input id="pt-valor" type="${tipo}" value="${esc(valor)}" autocomplete="off">` +
        (dica ? `<p class="dica-txt">${dica}</p>` : '') +
        `<div class="botoes-j"><button class="botao" data-nao type="button">Cancelar</button><button class="botao primario" data-sim type="button">${esc(botao)}</button></div>`,
      { aoFechar: () => ok(null) });
      const inp = j.querySelector('#pt-valor');
      const enviar = () => { const v = inp.value; janelaAberta.aoFechar = null; fecharJanela(); ok(v); };
      j.querySelector('[data-nao]').onclick = () => { janelaAberta.aoFechar = null; fecharJanela(); ok(null); };
      j.querySelector('[data-sim]').onclick = enviar;
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });
      setTimeout(() => inp.focus(), 50);
    });
  }

  // ---- v3: nome comercial do celular (o servidor procura na lista do Google Play) ----
  /** "Samsung Galaxy S24+ <small>SM-S926B</small>" (sem o nome: só o código). */
  function celularHtml(nome, codigo, padrao = 'Celular') {
    if (nome) return esc(nome) + (codigo ? ` <small class="cod-cel">${esc(String(codigo).split(' · ')[0])}</small>` + (String(codigo).indexOf(' · ') > 0 ? esc(String(codigo).slice(String(codigo).indexOf(' · '))) : '') : '');
    return esc(codigo || padrao);
  }
  function celularTexto(a) { return a ? (a.modeloNome ? `${a.modeloNome} (${a.modelo})` : (a.modelo || '')) : ''; }

  // ---- fotos e áudios (vêm do Drive pelo servidor) ----
  const cacheArq = {};
  async function baixarArquivo(driveId, melhoria) {
    const chave = melhoria ? 'm:' + melhoria.id + ':' + melhoria.qual : driveId;
    if (cacheArq[chave]) return cacheArq[chave];
    const a = melhoria ? await chamar('admArquivoMelhoria', melhoria.id, melhoria.qual) : await chamar('admArquivo', driveId);
    cacheArq[chave] = 'data:' + a.mime + ';base64,' + a.base64;
    return cacheArq[chave];
  }
  function abrirVisor(src) {
    const v = document.createElement('div');
    v.className = 'visor-adm';
    v.id = 'visor-adm';
    v.innerHTML = `<img src="${src}" alt="Foto"><button type="button" aria-label="Fechar">✕</button>`;
    v.querySelector('button').onclick = () => { fecharVisor(true); };
    v.addEventListener('click', (e) => { if (e.target === v) fecharVisor(true); });
    document.body.appendChild(v);
    history.pushState({ visor: true, tela: TELA, dados: DADOS, d: profundidade }, '');
  }
  function visorAberto() { return !!$('visor-adm'); }
  /** Fecha a foto; peloBotao: tira também a entrada do histórico (o "voltar" do celular já tirou). */
  function fecharVisor(peloBotao) {
    const v = $('visor-adm');
    if (!v) return;
    v.remove();
    if (peloBotao) { ignorarPop++; history.back(); }
  }
  /** Miniaturas das fotos e dos áudios de um lançamento ou gasto (tocar abre). */
  function anexosHtml(arqs) {
    if (!arqs.length) return '<div class="dica-txt" style="margin:6px 16px">Sem fotos nem áudio.</div>';
    return '<div class="anexos">' + arqs.map(a => `<button class="anexo" type="button" data-arq="${esc(a.driveId)}" data-tipo="${a.tipo}">` +
      (a.tipo === 'foto' ? '📷<small>ver</small>' : '🎤<small>ouvir</small>') + '</button>').join('') + '</div>' +
      '<div class="audio-caixa" data-audio></div>' +
      `<div class="dica-txt" style="margin:0 16px 8px">${arqs.map((a, i) => `<a href="${esc(a.url)}" target="_blank" rel="noopener">${a.tipo === 'foto' ? 'foto' : 'áudio'} ${i + 1} no Drive</a>`).join(' · ')}</div>`;
  }
  async function aoTocarAnexo(e) {
    const b = e.target.closest('[data-arq]');
    if (!b) return false;
    const tipo = b.dataset.tipo;
    b.disabled = true;
    try {
      const src = await baixarArquivo(b.dataset.arq);
      if (tipo === 'foto') {
        b.innerHTML = `<img src="${src}" alt="foto">`;
        abrirVisor(src);
      } else {
        const caixa = b.closest('.tela').querySelector('[data-audio]');
        if (caixa) caixa.innerHTML = `<audio controls autoplay src="${src}"></audio>`;
      }
    } catch (err) {
      if (!(err instanceof ErroSessao)) aviso('Não foi possível abrir: ' + erroMsg(err), 5000);
    } finally { b.disabled = false; }
    return true;
  }
  document.addEventListener('click', (e) => { aoTocarAnexo(e); });

  // ------------------------------------------------------------------
  //  Telas
  // ------------------------------------------------------------------
  const RENDER = {};
  const F = { de: '', ate: '', part: '', apar: '', cat: '', meio: '', sit: '', fonte: '', busca: '' };
  let LANC_ABA = 'lista';
  const VF = { part: '', tipo: '' };
  let MF = 'pendentes';
  let LF = '';
  let LISTA_ABA = 'categorias';
  let LISTAS_EDIT = null;
  let VG = '';

  function cartaoLanc(l) {
    if (l.veiculo) {
      const r = l.registro;
      const det = [hora(l.dataHora), l.categoria, r.formaPagamento, detalheRegistro(r)].filter(Boolean).join(' · ');
      return `<div class="cartao" data-gasto="${esc(r.id)}"><div class="corpo"><div class="desc">🚗 ${esc(l.descricao)}</div>` +
        `<div class="meta"><span class="quem">${esc(primeiroNome(l.participante))}</span>${esc(det)}</div></div>` +
        `<div class="direita"><span class="valor">${brl(r.valor)}</span>${r.status && r.status !== 'confirmado' ? seloSit(r) : ''}</div></div>`;
    }
    const arqs = D.arquivos[l.id] || [];
    const fotos = arqs.filter(a => a.tipo === 'foto').length;
    const audio = arqs.some(a => a.tipo === 'audio');
    let desc = l.descricao || ((l.itens || []).map(i => i.nome).filter(Boolean).join(', '));
    if (!desc) desc = l.status === 'aguardando_ia' ? (l.origem === 'foto' ? 'Nota aguardando leitura' : 'Áudio aguardando interpretação')
      : l.status === 'erro_ia' ? (l.origem === 'foto' ? 'Nota não lida' : 'Áudio não interpretado') : (l.categoria || 'Lançamento');
    const icones = (l.origem === 'foto' ? '🧾' : fotos ? '📷' : '') + (audio ? '🎤' : '') + (l.lat != null ? '📍' : '');
    const meta = [hora(l.dataHora), l.categoria, l.meioPagamento].filter(Boolean).join(' · ');
    const selos = [];
    if (situacao(l) !== 'confirmado') selos.push(seloSit(l));
    else if (l.origem === 'foto') selos.push(seloFonte(l));
    return `<div class="cartao${l.excluido ? ' excluido' : ''}" data-lanc="${esc(l.id)}"><div class="corpo"><div class="desc">${esc(desc)}</div>` +
      `<div class="meta"><span class="quem">${esc(primeiroNome(l.participante))}</span>${esc(meta)} ${icones}</div></div>` +
      `<div class="direita"><span class="valor">${l.valorTotal != null ? brl(l.valorTotal) : '—'}</span>${selos.join('')}</div></div>`;
  }
  function listaPorDia(itens, cartaoFn) {
    let html = '';
    let dia = '';
    itens.forEach(x => {
      const k = chaveDia(x.dataHora || 0);
      if (k !== dia) { dia = k; html += `<div class="dia">${esc(rotuloDia(x.dataHora || 0))}</div>`; }
      html += cartaoFn(x);
    });
    return html;
  }

  // ---------------- Início ----------------
  RENDER.inicio = () => {
    $('ini-versao').textContent = 'v' + VERSAO_ADMIN;
    $('ini-sub').textContent = 'Controle de Gastos · atualizado ' + (carregadoEm ? quandoCurto(carregadoEm).replace(/^hoje, /, 'às ') : '');
    const lixo = itensLixeira();
    const proxLixo = lixo.length ? Math.min(...lixo.map(x => diasRestantes(x.em))) : null;
    const pedCad = pedidosCadastroPendentes().length;
    const pedSenha = (D.pedidosSenha || []).length;
    const melh = melhoriasNovas();
    const fila = filaIA();
    const erros = fila.filter(l => l.status === 'erro_ia').length;
    const revisar = D.lancamentos.filter(l => !l.excluido && l.status === 'revisar').length + (D.registros || []).filter(r => !r.excluido && r.status === 'revisar').length;
    const caixa = (acao, n, texto, extra) => `<button type="button" class="${n ? 'tem' : ''}" data-pend="${acao}"><b>${n}</b><span>${texto}</span>${extra ? `<small>${extra}</small>` : ''}</button>`;
    let html = '';
    if (swEsperando) html += '<div class="alerta-caixa azul"><span>Há uma nova versão do app do administrador.</span><button class="botao pequeno" data-acao="atualizar-app" type="button">Atualizar</button></div>';
    html += '<div class="secao">Esperando você</div><div class="pend">' +
      caixa('pessoas', pedCad, plural(pedCad, 'Pedido de cadastro', 'Pedidos de cadastro')) +
      caixa('pessoas', pedSenha, plural(pedSenha, 'Pedido de senha', 'Pedidos de senha')) +
      caixa('melh', melh, plural(melh, 'Melhoria nova', 'Melhorias novas')) +
      `<button type="button" class="${erros ? 'tem' : ''}" data-pend="ia"><b>${fila.length}</b><span>Na fila da IA</span>${erros ? `<small>${plural(erros, 'erro em 1 item', 'erro em # itens')}</small>` : ''}</button>` +
      `<button type="button" data-pend="lixo"><b>${lixo.length}</b><span>Nos Excluídos</span>${proxLixo != null ? `<small>⏳ ${proxLixo <= 0 ? 'um apaga de vez hoje' : 'o próximo apaga em ' + plural(proxLixo, '1 dia', '# dias')}</small>` : ''}</button>` +
      `<button type="button" data-pend="revisar"><b>${revisar}</b><span>Para revisar</span><small>nos celulares</small></button></div>`;
    const todos = todosLancamentos().filter(l => !l.excluido);
    const hoje = chaveDia(Date.now());
    const totalHoje = todos.filter(l => chaveDia(l.dataHora || 0) === hoje).reduce((s, l) => s + (Number(l.valorTotal) || 0), 0);
    const total = todos.reduce((s, l) => s + (Number(l.valorTotal) || 0), 0);
    html += `<div class="secao">Gastos</div><div class="numeros" style="margin-top:0"><div><small>Hoje</small><b>${brl(totalHoje)}</b></div><div><small>Total</small><b>${brl(total)}</b></div></div>`;
    const g = {};
    todos.forEach(l => { const k = l.participante || '(sem nome)'; g[k] = (g[k] || 0) + (Number(l.valorTotal) || 0); });
    const ks = Object.keys(g).sort((a, b) => g[b] - g[a]);
    const max = ks.length ? Math.max(...ks.map(k => g[k])) : 0;
    html += '<div class="caixa" style="margin-top:10px"><h4>Por pessoa</h4>' + (ks.length ? ks.map(k =>
      `<div class="lin res" data-por-pessoa="${esc(k)}" style="cursor:pointer"><div><span>${esc(k)}</span><b>${brl(g[k])}</b></div><div class="barrinha"><div style="width:${max ? g[k] / max * 100 : 0}%"></div></div></div>`).join('')
      : '<p class="dica-txt">Nenhum gasto lançado ainda.</p>') + '</div>';
    html += '<div class="caixa"><h4>Atalhos</h4><div class="acoes" style="margin:6px 0 0">' +
      `<a class="botao pequeno" target="_blank" rel="noopener" href="${esc(INFO.urlPlanilha || '#')}">📊 Abrir planilha</a>` +
      `<a class="botao pequeno" target="_blank" rel="noopener" href="${esc(INFO.urlPasta || '#')}">📁 Pasta no Drive</a></div></div>`;
    $('inicio-corpo').innerHTML = html;
  };
  $('inicio-corpo').addEventListener('click', (e) => {
    const p = e.target.closest('[data-pend]');
    if (p) {
      const a = p.dataset.pend;
      if (a === 'pessoas') irAba('pessoas');
      else if (a === 'revisar') { Object.keys(F).forEach(k => { F[k] = ''; }); F.sit = 'revisar'; LANC_ABA = 'lista'; irAba('lanc'); }
      else ir(a);
      return;
    }
    const pp = e.target.closest('[data-por-pessoa]');
    if (pp) { Object.keys(F).forEach(k => { F[k] = ''; }); F.part = pp.dataset.porPessoa; LANC_ABA = 'lista'; irAba('lanc'); return; }
    if (e.target.closest('[data-acao="atualizar-app"]') && swEsperando) { pedimosAtualizacao = true; swEsperando.postMessage('atualizar'); }
  });

  // ---------------- Lançamentos (lista e resumo) ----------------
  function filtrados(resumo) {
    const de = F.de ? new Date(F.de + 'T00:00:00').getTime() : null;
    const ate = F.ate ? new Date(F.ate + 'T23:59:59.999').getTime() : null;
    const busca = F.busca.trim().toLowerCase();
    return todosLancamentos().filter(l => {
      const s = situacao(l);
      if (!resumo) {
        if (F.sit) { if (s !== F.sit) return false; } else if (s === 'excluido') return false;
      } else {
        if (s === 'excluido') return false;
        if (F.sit && F.sit !== 'excluido' && s !== F.sit) return false;
      }
      if (de && (l.dataHora || 0) < de) return false;
      if (ate && (l.dataHora || 0) > ate) return false;
      if (F.part && l.participante !== F.part) return false;
      if (F.apar && l.aparelhoId !== F.apar) return false;
      if (F.cat && l.categoria !== F.cat) return false;
      if (F.meio && l.meioPagamento !== F.meio) return false;
      if (F.fonte) {
        if (l.origem !== 'foto') return false;
        if (F.fonte !== 'nota' && fonteNota(l) !== F.fonte) return false;
      }
      if (busca) {
        const t = [l.descricao, l.estabelecimento, l.endereco, l.banco, l.titular, l.transcricao, (l.itens || []).map(i => i.nome).join(' '),
          l.registro ? detalheRegistro(l.registro) : '', l.participante].join(' ').toLowerCase();
        if (t.indexOf(busca) < 0) return false;
      }
      return true;
    }).sort((a, b) => (b.dataHora || 0) - (a.dataHora || 0));
  }
  const ROT_FILTRO = {
    de: (v) => 'desde ' + dataDia(v), ate: (v) => 'até ' + dataDia(v), part: (v) => v, cat: (v) => v, meio: (v) => v,
    apar: (v) => { const a = D.aparelhos.find(x => x.aparelhoId === v); return a ? (a.modeloNome || a.modelo || a.nomeInformado || 'aparelho') : 'aparelho'; },
    sit: (v) => ({ confirmado: 'Confirmados', revisar: 'Para revisar', aguardando_ia: 'Aguardando IA', erro_ia: 'Erro na IA', excluido: 'Excluídos' }[v] || v),
    fonte: (v) => ({ nota: 'Só notas fiscais', sefaz: 'QR Code (SEFAZ)', ia: 'IA (foto)', 'sefaz+ia': 'SEFAZ + IA', pendente: 'Notas não lidas' }[v] || v)
  };
  RENDER.lanc = () => {
    const resumo = LANC_ABA === 'resumo';
    const lista = filtrados(resumo);
    const nFiltros = Object.keys(ROT_FILTRO).filter(k => F[k]).length;
    const total = lista.filter(l => !l.excluido).reduce((s, l) => s + (Number(l.valorTotal) || 0), 0);
    const todosAtivos = todosLancamentos().filter(l => !l.excluido);
    $('lanc-sub').textContent = `${todosAtivos.length} lançamentos · ${brl(todosAtivos.reduce((s, l) => s + (Number(l.valorTotal) || 0), 0))}`;
    let html = `<div class="abas2"><button type="button" data-lanc-aba="lista" class="${resumo ? '' : 'ativa'}">Lista</button><button type="button" data-lanc-aba="resumo" class="${resumo ? 'ativa' : ''}">Resumo</button></div>`;
    html += `<div class="busca"><input type="search" id="lanc-busca" placeholder="Buscar descrição, itens, local…" value="${esc(F.busca)}"></div>`;
    html += `<div class="chips"><button type="button" class="chip${nFiltros ? ' on' : ''}" data-filtros>⚙️ Filtros${nFiltros ? ' (' + nFiltros + ')' : ''}</button>` +
      Object.keys(ROT_FILTRO).filter(k => F[k]).map(k => `<button type="button" class="chip on" data-tirar-filtro="${k}">${esc(ROT_FILTRO[k](F[k]))} ✕</button>`).join('') +
      (nFiltros ? '' : '<button type="button" class="chip" data-filtro-rapido="revisar">Para revisar</button><button type="button" class="chip" data-filtro-rapido="hoje">Hoje</button><button type="button" class="chip" data-filtro-rapido="excluido">Excluídos</button>') + '</div>';
    if (!resumo) {
      html += `<div class="resumo-f"><b>${lista.length}</b> ${plural(lista.length, 'lançamento', 'lançamentos')} · <b>${brl(total)}</b></div>`;
      html += lista.length ? listaPorDia(lista, cartaoLanc) : '<div class="vazio-adm">Nenhum lançamento com esses filtros.</div>';
    } else {
      const incompletos = lista.filter(l => l.status !== 'confirmado').length;
      html += `<div class="numeros"><div><small>Total do período</small><b>${brl(total)}</b></div><div><small>Lançamentos</small><b>${lista.length}</b></div></div>`;
      if (incompletos) html += `<div class="alerta-caixa laranja" style="margin-top:10px"><span>${plural(incompletos, '1 ainda não confirmado', '# ainda não confirmados')}: os valores podem mudar.</span></div>`;
      const bloco = (titulo, chave) => {
        const g = {};
        lista.forEach(l => { const k = chave(l) || '(sem informação)'; g[k] = g[k] || { v: 0, n: 0 }; g[k].v += Number(l.valorTotal) || 0; g[k].n++; });
        const ks = Object.keys(g).sort((a, b) => g[b].v - g[a].v);
        const max = ks.length ? Math.max(...ks.map(k => g[k].v)) : 0;
        return `<div class="caixa" style="margin-top:10px"><h4>${titulo}</h4>` + (ks.length ? ks.map(k => {
          const pct = total ? Math.round(g[k].v / total * 100) : 0;
          return `<div class="lin res"><div><span>${esc(k)} <small>(${g[k].n})</small></span><b>${brl(g[k].v)}</b></div><div class="barrinha"><div style="width:${max ? g[k].v / max * 100 : 0}%"></div></div><small>${pct}% do total</small></div>`;
        }).join('') : '<p class="dica-txt">Sem dados.</p>') + '</div>';
      };
      const g = {};
      lista.forEach(l => { if (!l.dataHora) return; const k = chaveDia(l.dataHora); g[k] = g[k] || { v: 0, n: 0 }; g[k].v += Number(l.valorTotal) || 0; g[k].n++; });
      const dias = Object.keys(g).sort().reverse();
      const maxD = dias.length ? Math.max(...dias.map(k => g[k].v)) : 0;
      html += bloco('Por participante', l => l.participante) + bloco('Por categoria', l => l.categoria) + bloco('Por meio de pagamento', l => l.meioPagamento) +
        '<div class="caixa" style="margin-top:10px"><h4>Por dia</h4>' + (dias.length ? dias.map(k =>
          `<div class="lin res"><div><span>${dataDia(k)} <small>(${g[k].n})</small></span><b>${brl(g[k].v)}</b></div><div class="barrinha"><div style="width:${maxD ? g[k].v / maxD * 100 : 0}%"></div></div></div>`).join('')
          : '<p class="dica-txt">Sem dados.</p>') + '</div>';
      html += '<p class="dica-txt" style="margin:8px 16px 20px">Os excluídos ficam de fora. Os gastos dos veículos entram para quem lançou: o abastecimento em Combustível e o resto em Veículo.</p>';
    }
    const corpo = $('lanc-corpo');
    const foco = document.activeElement && document.activeElement.id === 'lanc-busca' ? document.activeElement.selectionStart : null;
    corpo.innerHTML = html;
    if (foco != null) { const b = $('lanc-busca'); b.focus(); try { b.setSelectionRange(foco, foco); } catch (e) { /* */ } }
  };
  $('lanc-corpo').addEventListener('input', (e) => { if (e.target.id === 'lanc-busca') { F.busca = e.target.value; RENDER.lanc(); } });
  $('lanc-corpo').addEventListener('click', (e) => {
    const t = e.target;
    const aba = t.closest('[data-lanc-aba]');
    if (aba) { LANC_ABA = aba.dataset.lancAba; RENDER.lanc(); return; }
    if (t.closest('[data-filtros]')) { abrirFiltros(); return; }
    const tf = t.closest('[data-tirar-filtro]');
    if (tf) { F[tf.dataset.tirarFiltro] = ''; RENDER.lanc(); return; }
    const fr = t.closest('[data-filtro-rapido]');
    if (fr) {
      const v = fr.dataset.filtroRapido;
      if (v === 'hoje') { F.de = F.ate = chaveDia(Date.now()); } else F.sit = v;
      RENDER.lanc();
      return;
    }
    const g = t.closest('[data-gasto]');
    if (g) { ir('gasto', { id: g.dataset.gasto }); return; }
    const c = t.closest('[data-lanc]');
    if (c) ir('lanc-ver', { id: c.dataset.lanc });
  });
  function opcoesHtml(valores, atual, rotuloTodos) {
    return `<option value="">${rotuloTodos}</option>` + valores.map(v => `<option value="${esc(v.valor)}"${v.valor === atual ? ' selected' : ''}>${esc(v.rotulo)}</option>`).join('');
  }
  function abrirFiltros() {
    const L = todosLancamentos();
    const vs = (lista) => lista.map(v => ({ valor: v, rotulo: v }));
    const html = '<h3>Filtros</h3>' +
      `<div class="grade2"><div><label for="ff-de">De</label><input type="date" id="ff-de" value="${esc(F.de)}"></div><div><label for="ff-ate">Até</label><input type="date" id="ff-ate" value="${esc(F.ate)}"></div></div>` +
      `<label for="ff-part">Participante</label><select id="ff-part">${opcoesHtml(vs(unicos(L.map(l => l.participante))), F.part, 'Todos')}</select>` +
      `<div class="grade2"><div><label for="ff-apar">Aparelho</label><select id="ff-apar">${opcoesHtml(D.aparelhos.map(a => ({ valor: a.aparelhoId, rotulo: (a.nomeInformado || '—') + ' · ' + (celularTexto(a) || a.aparelhoId.slice(0, 8)) })), F.apar, 'Todos')}</select></div>` +
      `<div><label for="ff-cat">Categoria</label><select id="ff-cat">${opcoesHtml(vs(unicos(D.listas.categorias.concat(L.map(l => l.categoria)))), F.cat, 'Todas')}</select></div></div>` +
      `<div class="grade2"><div><label for="ff-meio">Pagamento</label><select id="ff-meio">${opcoesHtml(vs(unicos(D.listas.meios.concat(L.map(l => l.meioPagamento)))), F.meio, 'Todos')}</select></div>` +
      `<div><label for="ff-sit">Situação</label><select id="ff-sit">${opcoesHtml([['confirmado', 'Confirmados'], ['revisar', 'Para revisar'], ['aguardando_ia', 'Aguardando IA'], ['erro_ia', 'Erro na IA'], ['excluido', 'Excluídos']].map(x => ({ valor: x[0], rotulo: x[1] })), F.sit, 'Todas (menos excluídos)')}</select></div></div>` +
      `<label for="ff-fonte">Leitura da nota fiscal</label><select id="ff-fonte">${opcoesHtml([['nota', 'Só notas fiscais'], ['sefaz', 'QR Code (SEFAZ)'], ['ia', 'IA (foto)'], ['sefaz+ia', 'SEFAZ + IA'], ['pendente', 'Ainda não lidas']].map(x => ({ valor: x[0], rotulo: x[1] })), F.fonte, 'Todos')}</select>` +
      '<div class="botoes-j"><button class="botao" type="button" id="ff-limpar">Limpar filtros</button><button class="botao primario" type="button" id="ff-ver">Ver</button></div>';
    const j = abrirJanela(html, { deBaixo: true });
    const ids = { de: 'ff-de', ate: 'ff-ate', part: 'ff-part', apar: 'ff-apar', cat: 'ff-cat', meio: 'ff-meio', sit: 'ff-sit', fonte: 'ff-fonte' };
    const contar = () => {
      const salvo = Object.assign({}, F);
      Object.keys(ids).forEach(k => { F[k] = j.querySelector('#' + ids[k]).value; });
      const n = filtrados(LANC_ABA === 'resumo').length;
      Object.assign(F, salvo);
      j.querySelector('#ff-ver').textContent = `Ver ${n} ${plural(n, 'lançamento', 'lançamentos')}`;
    };
    j.addEventListener('change', contar);
    contar();
    j.querySelector('#ff-limpar').onclick = () => { Object.keys(ids).forEach(k => { j.querySelector('#' + ids[k]).value = ''; }); contar(); };
    j.querySelector('#ff-ver').onclick = () => {
      Object.keys(ids).forEach(k => { F[k] = j.querySelector('#' + ids[k]).value; });
      fecharJanela();
      RENDER.lanc();
    };
  }

  // ---------------- Lançamento (ver) ----------------
  RENDER['lanc-ver'] = ({ id }) => {
    const l = lancPorId(id);
    if (!l) return false;
    const arqs = D.arquivos[id] || [];
    $('lanc-ver-sub').textContent = l.participante + (l.aparelhoId ? ' · ' + (celularTexto(D.aparelhos.find(a => a.aparelhoId === l.aparelhoId)) || 'celular') : '');
    const lin = (a, b) => b ? `<div class="lin"><span>${a}</span><span>${b}</span></div>` : '';
    let html = `<div class="vtopo"><div class="linha1"><div class="n">${esc(l.descricao || '(sem descrição)')}</div><b>${brl(l.valorTotal)}</b></div>` +
      `<div class="s">${dataHora(l.dataHora)} · ${seloSit(l)} ${seloFonte(l)}</div>${l.excluido ? `<div style="margin-top:6px">${prazoHtml(l.excluidoEm)}</div>` : ''}</div>`;
    html += '<div class="det">' +
      lin('Participante', esc(l.participante)) + lin('Categoria', esc(l.categoria) || '—') + lin('Pagamento', esc([l.meioPagamento, l.banco].filter(Boolean).join(' · ')) || '—') +
      lin('Titular', esc(l.titular)) + lin('Estabelecimento', esc(l.estabelecimento)) + lin('Endereço', esc(l.endereco)) +
      lin('Localização', l.lat != null ? `<a target="_blank" rel="noopener" href="${mapa(l.lat, l.lng)}">🗺️ ver no mapa</a>${l.precisao ? ' (±' + l.precisao + ' m)' : ''}` : '') +
      lin('Lançado por', l.origem === 'voz' ? 'voz' : l.origem === 'foto' ? 'foto da nota' : 'texto');
    if (l.origem === 'foto') {
      html += lin('Dados lidos de', esc(FONTE[l.fonteDados] || (l.status === 'aguardando_ia' ? 'ainda não lida' : '—'))) +
        lin('Chave da nota', l.chaveNota ? `<small>${esc(l.chaveNota.replace(/(\d{4})(?=\d)/g, '$1 '))}</small>` : '') +
        lin('Leitura na SEFAZ', esc(l.motivoSefaz || '')) + // v3: por que veio (ou não) do site da SEFAZ
        lin('QR Code', l.qrNota ? (/^https?:\/\/[^\/?#]*\.gov\.br(\/|$)/i.test(l.qrNota) ? `<a target="_blank" rel="noopener" href="${esc(l.qrNota)}">abrir a nota na SEFAZ</a>` : '<small>' + esc(l.qrNota.slice(0, 80)) + '</small>') : 'não encontrado');
    }
    html += lin('Transcrição', esc(l.transcricao)) + lin('Observação da IA', esc(l.observacaoIA)) + lin('Criado em', dataHora(l.criadoEm)) +
      lin('Alterado em', dataHora(l.alteradoEm) + (l.alteradoPor ? ' por ' + esc(l.alteradoPor) : '')) + '</div>';
    if ((l.itens || []).length) {
      html += '<div class="caixa"><h4>Itens</h4>' + l.itens.map(i => {
        // v3: por peso: "0,194 kg × R$ 35,99 o kg"
        const peso = i.unidade && i.unidade !== 'un' && i.qtd != null;
        const qt = i.qtd != null ? String(Math.round(i.qtd * 1000) / 1000).replace('.', ',') : '';
        const q = peso ? '' : (i.qtd != null && i.qtd !== 1 ? qt + ' × ' : '');
        const u = peso ? ` <small class="dica-txt">(${qt} ${esc(i.unidade)}${i.unitario != null ? ' × ' + brlUnit(i.unitario) + ' o ' + esc(i.unidade) : ''})</small>`
          : (i.qtd != null && i.qtd !== 1 && i.unitario != null ? ` <small class="dica-txt">(${brlUnit(i.unitario)} cada)</small>` : '');
        return `<div class="lin"><span>${q}${esc(i.nome || '(sem nome)')}${u}</span><b>${i.valor != null ? brl(i.valor) : ''}</b></div>`;
      }).join('') + '</div>';
    }
    html += '<div class="secao">Fotos e áudio</div>' + anexosHtml(arqs);
    const podeLer = (l.status === 'aguardando_ia' || l.status === 'erro_ia') && !l.excluido && arqs.some(a => a.tipo === (l.origem === 'foto' ? 'foto' : 'audio'));
    html += `<div class="acoes ${podeLer ? 'tres' : ''}">` +
      (l.excluido ? '<button class="botao" type="button" data-restaurar>Restaurar</button>' : '<button class="botao perigo" type="button" data-excluir>Excluir</button>') +
      (podeLer ? '<button class="botao" type="button" data-ler>🤖 Ler agora</button>' : '') +
      '<button class="botao primario" type="button" data-editar>Editar</button></div>';
    $('lanc-ver-corpo').innerHTML = html;
    return true;
  };
  $('lanc-ver-corpo').addEventListener('click', async (e) => {
    const id = DADOS.id;
    if (e.target.closest('[data-editar]')) { ir('lanc-editar', { id }); return; }
    if (e.target.closest('[data-excluir]')) {
      if (!(await confirmar('Excluir este lançamento? Ele vai para os Excluídos (30 dias para restaurar).', 'Excluir', { perigo: true }))) return;
      if (await tentar(chamar('admExcluir', id), 'Lançamento excluído.')) await carregar();
      return;
    }
    if (e.target.closest('[data-restaurar]')) {
      if (await tentar(chamar('admRestaurar', id), 'Lançamento restaurado.')) await carregar();
      return;
    }
    const b = e.target.closest('[data-ler]');
    if (b) { await lerAgora(id, b); }
  });
  async function lerAgora(id, b) {
    b.disabled = true;
    const txt = b.textContent;
    b.textContent = 'Lendo…';
    const r = await tentar(chamar('admReprocessarIA', id));
    b.disabled = false;
    b.textContent = txt;
    if (!r) return;
    const msgs = { ok: 'Pronto. O participante vai revisar no celular.', limite: 'Limite gratuito da IA atingido. A fila tenta de novo sozinha.', config: 'IA indisponível: ' + (r.mensagem || ''),
      temporario: 'A IA falhou agora; a fila tenta de novo.', erro: 'Não foi possível ler: ' + (r.mensagem || ''), sem_fotos: 'Ainda faltam fotos da nota chegarem do celular.' };
    aviso(msgs[r.aviso] || ('Situação: ' + ((r.lancamento && r.lancamento.status) || '')), 5000);
    await carregar();
  }

  // ---------------- Lançamento (editar) ----------------
  function selectHtml(id, lista, atual, vazio = '—') {
    const v = lista.slice();
    if (atual && v.indexOf(atual) < 0) v.unshift(atual);
    return `<select id="${id}"><option value="">${vazio}</option>` + v.map(x => `<option${x === atual ? ' selected' : ''}>${esc(x)}</option>`).join('') + '</select>';
  }
  function itemEdHtml(i = {}) {
    return `<div class="item-ed"><input placeholder="Item" value="${esc(i.nome || '')}"><input placeholder="Qtd." inputmode="decimal" value="${i.qtd != null ? String(i.qtd).replace('.', ',') : ''}">` +
      `<input placeholder="Valor" inputmode="decimal" value="${valorTexto(i.valor)}"><button type="button" data-tirar-item aria-label="Tirar o item">✕</button></div>`;
  }
  RENDER['lanc-editar'] = ({ id }) => {
    const l = lancPorId(id);
    if (!l) return false;
    $('lanc-editar-sub').textContent = l.participante;
    const html = '<div class="conteudo-adm">' + (l.transcricao ? `<div class="alerta-caixa azul" style="margin:12px 0 0"><span><b>Transcrição:</b> ${esc(l.transcricao)}</span></div>` : '') +
      `<label for="le-part">Participante</label><input id="le-part" value="${esc(l.participante)}">` +
      `<label for="le-desc">Descrição</label><input id="le-desc" value="${esc(l.descricao)}">` +
      `<div class="grade2"><div><label for="le-data">Data e hora</label><input type="datetime-local" id="le-data" value="${paraInputLocal(l.dataHora)}"></div>` +
      `<div><label for="le-valor">Valor total (R$)</label><input id="le-valor" inputmode="decimal" value="${valorTexto(l.valorTotal)}"></div></div>` +
      `<div class="grade2"><div><label for="le-cat">Categoria</label>${selectHtml('le-cat', D.listas.categorias, l.categoria)}</div>` +
      `<div><label for="le-meio">Pagamento</label>${selectHtml('le-meio', D.listas.meios, l.meioPagamento)}</div></div>` +
      `<div class="grade2"><div><label for="le-banco">Banco/conta</label><input id="le-banco" value="${esc(l.banco)}"></div>` +
      `<div><label for="le-titular">Titular</label><input id="le-titular" value="${esc(l.titular)}"></div></div>` +
      `<label for="le-estab">Estabelecimento</label><input id="le-estab" value="${esc(l.estabelecimento)}">` +
      `<label for="le-sit">Situação</label><select id="le-sit">${['confirmado', 'revisar', 'aguardando_ia', 'erro_ia'].map(s => `<option value="${s}"${s === (l.status || 'confirmado') ? ' selected' : ''}>${ROTULO[s]}</option>`).join('')}</select>` +
      '<label>Itens</label><div class="item-cab"><span>Item</span><span>Qtd.</span><span>Valor</span><span></span></div>' +
      `<div id="le-itens">${(l.itens || []).map(itemEdHtml).join('')}</div><button class="mini-btn" type="button" id="le-add">+ Adicionar item</button>` +
      '<p class="dica-txt" id="le-soma"></p>' +
      '<div class="acoes" style="margin:18px 0"><button class="botao" type="button" data-voltar-form>Cancelar</button><button class="botao primario" type="button" id="le-salvar">Salvar</button></div></div>';
    $('lanc-editar-corpo').innerHTML = html;
    travarBanco();
    somaItens();
    return true;
  };
  function travarBanco() {
    const m = $('le-meio');
    if (!m) return;
    const d = ehDinheiro(m.value);
    $('le-banco').disabled = d;
    if (d) $('le-banco').value = '';
  }
  function lerItensEd() {
    return [...$('le-itens').querySelectorAll('.item-ed')].map(d => {
      const ins = d.querySelectorAll('input');
      const qtd = lerNumero(ins[1].value);
      const valor = lerValor(ins[2].value);
      return { nome: ins[0].value.trim(), qtd: qtd && qtd > 0 ? qtd : null, unitario: qtd && qtd > 0 && valor != null ? Math.round(valor / qtd * 1000) / 1000 : null, valor };
    }).filter(i => i.nome || i.valor != null);
  }
  function somaItens() {
    const it = lerItensEd();
    const s = it.reduce((t, i) => t + (i.valor || 0), 0);
    $('le-soma').textContent = it.length ? `Soma dos itens: ${brl(s)} (se o total ficar em branco, vale a soma).` : '';
  }
  $('lanc-editar-corpo').addEventListener('change', (e) => { if (e.target.id === 'le-meio') travarBanco(); });
  $('lanc-editar-corpo').addEventListener('input', (e) => { if (e.target.closest('#le-itens')) somaItens(); });
  $('lanc-editar-corpo').addEventListener('click', async (e) => {
    if (e.target.closest('[data-voltar-form]')) { voltar(); return; }
    if (e.target.id === 'le-add') { $('le-itens').insertAdjacentHTML('beforeend', itemEdHtml()); return; }
    const ti = e.target.closest('[data-tirar-item]');
    if (ti) { ti.closest('.item-ed').remove(); somaItens(); return; }
    if (e.target.id !== 'le-salvar') return;
    const l = lancPorId(DADOS.id);
    const dados = {
      id: l.id,
      dataHora: $('le-data').value ? new Date($('le-data').value).getTime() : l.dataHora,
      participante: $('le-part').value.trim(), descricao: $('le-desc').value.trim(), itens: lerItensEd(),
      valorTotal: lerValor($('le-valor').value), categoria: $('le-cat').value, meioPagamento: $('le-meio').value,
      banco: ehDinheiro($('le-meio').value) ? '' : $('le-banco').value.trim(), titular: $('le-titular').value.trim(),
      estabelecimento: $('le-estab').value.trim(), status: $('le-sit').value
    };
    e.target.disabled = true;
    const ok = await tentar(chamar('admSalvarLancamento', dados), 'Lançamento salvo.');
    e.target.disabled = false;
    if (ok) { await carregar(); voltar(); }
  });

  // ---------------- Pessoas ----------------
  function textoCodigo(p) {
    const v = new Date(p.validoAte);
    return `Olá, ${primeiroNome(p.nome)}! Aqui é do Controle de Gastos. Seu código para criar uma senha nova é *${p.codigo}*.\n` +
      `Digite no app, na tela "Esqueci minha senha". O código vale até ${v.toLocaleDateString('pt-BR')} às ${hora(v.getTime())}.`;
  }
  function linkConvite() { const c = D.convite || {}; return c.urlApp && c.codigo ? c.urlApp + '?codigo=' + encodeURIComponent(c.codigo) : ''; }
  function msgConvite() { return 'Oi! Este é o link do app de gastos da viagem: ' + linkConvite() + '\n\nAbra no Google Chrome, crie sua conta (nome, senha e WhatsApp) e toque em "Instalar".'; }
  RENDER.pessoas = () => {
    const contas = (D.contas || []).filter(c => !c.excluido).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    $('pessoas-sub').textContent = plural(contas.length, '1 conta', '# contas');
    let html = '';
    const ped = pedidosCadastroPendentes();
    const pedS = D.pedidosSenha || [];
    if (ped.length || pedS.length) html += '<div class="secao">Pedidos</div>';
    ped.forEach(p => {
      const antiga = p.contaExcluidaId ? contaPorId(p.contaExcluidaId) : null;
      html += `<div class="pedido"><div class="t">🆕 ${esc(p.nome)} quer se cadastrar de novo</div><div class="s">Pedido de cadastro · ${esc(p.motivo)} · ${quandoCurto(p.criadoEm)}` +
        `${p.whatsapp ? '<br>WhatsApp ' + esc(zapTexto(p.whatsapp)) : ''}${p.email ? ' · ' + esc(p.email) : ''}</div><div class="bts">` +
        `<button class="botao pequeno primario" type="button" data-cadastro="${esc(p.id)}" data-acao="nova">Aceitar como conta nova</button>` +
        (antiga && antiga.excluido ? `<button class="botao pequeno" type="button" data-cadastro="${esc(p.id)}" data-acao="restaurar">Aceitar e trazer os dados</button>` : '') +
        `<button class="botao pequeno perigo" type="button" data-cadastro="${esc(p.id)}" data-acao="recusar">Recusar</button></div></div>`;
    });
    pedS.forEach(p => {
      html += `<div class="pedido senha"><div class="t">🔑 ${esc(p.nome)} esqueceu a senha</div><div class="s">Código: <span class="codigo">${esc(p.codigo)}</span> · pediu ${quandoCurto(p.pedidoEm)}</div>` +
        `<div class="bts"><a class="botao pequeno zap" target="_blank" rel="noopener" href="${esc(linkZap(p.whatsapp, textoCodigo(p)))}">Enviar pelo WhatsApp</a>` +
        `<button class="botao pequeno" type="button" data-cancelar-pedido="${esc(p.contaId)}">Cancelar pedido</button></div></div>`;
    });
    const org = contas.find(c => c.organizador);
    if (contas.length && !org) html += '<div class="alerta-caixa laranja coluna" style="margin-top:12px"><span><b>Escolha a conta do organizador</b> (a sua): abra a conta e toque em <b>Tornar organizador</b>. O organizador recebe no app os pedidos de senha, e o WhatsApp dele aparece para quem esqueceu a senha.</span></div>';
    else if (org && !org.whatsapp) html += `<div class="alerta-caixa laranja" style="margin-top:12px"><span>A conta do organizador (${esc(org.nome)}) ainda não tem WhatsApp.</span></div>`;
    html += '<div class="secao">Contas</div>';
    html += contas.length ? contas.map(c => `<div class="pessoa" data-pessoa="${esc(c.id)}"><div class="av">${esc(iniciais(c.nome).toUpperCase())}</div>` +
      `<div style="min-width:0"><div class="n">${esc(c.nome)}${c.organizador ? '<span class="org">★ Organizador</span>' : ''}</div>` +
      `<div class="s">${c.whatsapp ? esc(zapTexto(c.whatsapp)) : '<span style="color:var(--vermelho)">sem WhatsApp</span>'} · ${plural(c.aparelhos.filter(a => a.conectado).length, '1 celular', '# celulares')}</div></div>` +
      `<div class="d"><b>${c.lancamentos}</b>${c.lancamentos === 1 ? 'lançamento' : 'lançamentos'}</div></div>`).join('') : '<div class="vazio-adm">Nenhuma conta criada ainda.</div>';
    const link = linkConvite();
    html += '<div class="caixa"><h4>🔗 Link de convite</h4>' + (link
      ? `<p class="dica-txt">A pessoa só cria a conta, sem digitar o código.</p><div class="acoes" style="margin:6px 0 0"><button class="botao pequeno" type="button" data-copiar-convite>Copiar link</button>` +
        `<a class="botao pequeno zap" target="_blank" rel="noopener" href="${esc('https://wa.me/?text=' + encodeURIComponent(msgConvite()))}">Enviar pelo WhatsApp</a></div>`
      : '<p class="dica-txt">O endereço do app ainda não é conhecido.</p>') +
      '<button class="mini-btn" type="button" data-ir-convite>Endereço do app ›</button></div>';
    const antigos = D.aparelhosSemConta || [];
    if (antigos.length) {
      html += '<div class="caixa"><h4>Celulares da versão anterior (sem conta)</h4><p class="dica-txt">Quando a pessoa criar a conta (ou entrar) nesse celular, os lançamentos passam para a conta sozinhos.</p>' +
        antigos.map(a => `<div class="lin"><span>${esc(a.nomeInformado || '—')} · ${esc(a.modelo || 'celular')}<div class="sub">${a.lancamentos} lançamento(s) · último contato ${dataHora(a.ultimoUso)}</div></span></div>`).join('') + '</div>';
    }
    $('pessoas-corpo').innerHTML = html;
  };
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); } catch (e) {
      const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    aviso('Link copiado.');
  }
  $('pessoas-corpo').addEventListener('click', async (e) => {
    const t = e.target;
    const p = t.closest('[data-pessoa]');
    if (p) { ir('pessoa', { id: p.dataset.pessoa }); return; }
    if (t.closest('[data-copiar-convite]')) { copiar(linkConvite()); return; }
    if (t.closest('[data-ir-convite]')) { ir('convite'); return; }
    const cp = t.closest('[data-cancelar-pedido]');
    if (cp) {
      if (!(await confirmar('Cancelar este pedido de senha? O código deixa de valer.', 'Cancelar pedido'))) return;
      if (await tentar(chamar('admCancelarPedidoSenha', cp.dataset.cancelarPedido), 'Pedido cancelado.')) await carregar();
      return;
    }
    const cad = t.closest('[data-cadastro]');
    if (cad) {
      const ped = (D.pedidosCadastro || []).find(x => x.id === cad.dataset.cadastro);
      if (!ped) return;
      const acao = cad.dataset.acao;
      const textos = {
        nova: [`Aceitar o cadastro de ${ped.nome} como uma conta nova? Ela começa do zero. Os dados antigos (se ainda estiverem nos Excluídos) continuam lá até o prazo acabar.`, 'Aceitar como conta nova'],
        restaurar: [`Aceitar e trazer de volta os dados de ${ped.contaExcluidaNome} (lançamentos e veículos)? A pessoa entra com o nome e a senha que escolheu agora.`, 'Aceitar e trazer de volta'],
        recusar: [`Recusar o cadastro de ${ped.nome}?`, 'Recusar']
      };
      if (!(await confirmar(textos[acao][0], textos[acao][1], { perigo: acao === 'recusar' }))) return;
      const r = await tentar(chamar('admResolverPedidoCadastro', ped.id, acao));
      if (r) {
        aviso(acao === 'recusar' ? 'Pedido recusado.' : `Aceito. Avise ${primeiroNome(ped.nome)} para tocar em "Já tenho conta" e entrar.`, 6000);
        await carregar();
      }
    }
  });

  // ---------------- Pessoa ----------------
  RENDER.pessoa = ({ id }) => {
    const c = contaPorId(id);
    if (!c || c.excluido) return false;
    $('pessoa-titulo').textContent = c.nome;
    $('pessoa-sub').textContent = 'conta criada em ' + (c.criadaEm ? new Date(c.criadaEm).toLocaleDateString('pt-BR') : '—');
    const veics = (D.veiculos || []).filter(v => v.contaId === id && !v.excluido);
    const total = D.lancamentos.filter(l => l.contaId === id && !l.excluido).reduce((s, l) => s + (Number(l.valorTotal) || 0), 0);
    let html = '<div class="conteudo-adm">' +
      `<label for="pe-nome">Nome e sobrenome <small>(usado para entrar no app)</small></label><div class="edit-lin"><input id="pe-nome" value="${esc(c.nome)}"><button type="button" data-salvar="nome">Salvar</button></div>` +
      `<label for="pe-zap">WhatsApp</label><div class="edit-lin"><input id="pe-zap" inputmode="tel" placeholder="(83) 99999-8888" value="${esc(zapTexto(c.whatsapp))}"><button type="button" data-salvar="zap">Salvar</button></div>` +
      (c.whatsapp ? `<a class="dica-txt" target="_blank" rel="noopener" href="${esc(linkZap(c.whatsapp))}">abrir conversa no WhatsApp</a>` : '') +
      `<label for="pe-email">E-mail</label><div class="edit-lin"><input id="pe-email" type="email" placeholder="nome@gmail.com" value="${esc(c.email || '')}"><button type="button" data-salvar="email">Salvar</button></div></div>`;
    html += '<div class="caixa"><h4>Celulares</h4>' + (c.aparelhos.length ? c.aparelhos.map(a =>
      `<div class="lin"><div>${celularHtml(a.modeloNome, a.modelo)}${a.android ? ' · Android ' + esc(a.android) : ''}<div class="sub">último contato ${quandoCurto(a.ultimoUso)}${a.versaoApp ? ' · app ' + esc(a.versaoApp) : ''}</div></div>` +
      (a.conectado ? `<button class="botao pequeno" type="button" data-desconectar="${esc(a.aparelhoId)}">Desconectar</button>` : '<span class="sub">desconectado</span>') + '</div>').join('')
      : '<p class="dica-txt">Nenhum celular.</p>') + '</div>';
    html += '<div class="det">' +
      `<div class="lin"><span>Último acesso</span><span>${quandoCurto(c.ultimoAcesso)}</span></div>` +
      `<div class="lin"><span>Lançamentos</span><span><a href="#" data-ver-lanc>${c.lancamentos} · ${brl(total)} ›</a></span></div>` +
      `<div class="lin"><span>Veículos</span><span>${veics.length ? veics.map(v => esc(nomeVeic(v))).join('<br>') : '—'}</span></div>` +
      `<div class="lin"><span>Senha alterada</span><span>${c.senhaAlteradaEm ? dataHora(c.senhaAlteradaEm) : '—'}</span></div></div>`;
    html += '<div class="acoes"><button class="botao" type="button" data-nova-senha>🔑 Definir nova senha</button>' +
      (c.organizador ? '<button class="botao" type="button" disabled>★ É o organizador</button>' : '<button class="botao" type="button" data-organizador>★ Tornar organizador</button>') + '</div>' +
      '<div style="margin:0 14px 20px"><button class="botao perigo grande" style="min-height:48px;font-size:16px" type="button" data-excluir-pessoa>Excluir pessoa</button></div>';
    $('pessoa-corpo').innerHTML = html;
    return true;
  };
  $('pessoa-corpo').addEventListener('click', async (e) => {
    const t = e.target;
    const c = contaPorId(DADOS.id);
    if (!c) return;
    const s = t.closest('[data-salvar]');
    if (s) {
      const q = s.dataset.salvar;
      if (q === 'nome') {
        const r = await tentar(chamar('admRenomearConta', c.id, $('pe-nome').value.trim()));
        if (r) { aviso('Nome salvo. Avise a pessoa: ela entra com o nome novo.', 5000); await carregar(); }
      } else if (q === 'zap') {
        const r = await tentar(chamar('admSalvarWhatsapp', c.id, $('pe-zap').value.trim()));
        if (r) { aviso(r.whatsapp ? 'WhatsApp salvo.' : 'WhatsApp removido.'); await carregar(); }
      } else {
        const r = await tentar(chamar('admSalvarEmail', c.id, $('pe-email').value.trim()));
        if (r) { aviso(r.email ? 'E-mail salvo.' : 'E-mail removido.'); await carregar(); }
      }
      return;
    }
    if (t.closest('[data-ver-lanc]')) { e.preventDefault(); Object.keys(F).forEach(k => { F[k] = ''; }); F.part = c.nome; LANC_ABA = 'lista'; irAba('lanc'); return; }
    const dc = t.closest('[data-desconectar]');
    if (dc) {
      if (!(await confirmar('Desconectar este celular? A pessoa vai precisar entrar de novo com nome e senha nele.', 'Desconectar'))) return;
      if (await tentar(chamar('admDesconectarAparelho', dc.dataset.desconectar), 'Celular desconectado.')) await carregar();
      return;
    }
    if (t.closest('[data-nova-senha]')) {
      const v = await pedirTexto('Nova senha para ' + c.nome, 'Use pelo menos 4 caracteres (pode ser só números). Depois passe a senha para a pessoa. Os celulares já conectados continuam funcionando.', { botao: 'Salvar senha' });
      if (v == null) return;
      if (await tentar(chamar('admDefinirSenha', c.id, v), 'Senha nova definida para ' + c.nome + '.')) await carregar();
      return;
    }
    if (t.closest('[data-organizador]')) {
      if (!(await confirmar(`Tornar "${c.nome}" o organizador? Essa conta passa a receber no app os pedidos de senha nova, e o WhatsApp dela aparece para quem esqueceu a senha.`, 'Tornar organizador'))) return;
      if (await tentar(chamar('admDefinirOrganizador', c.id), c.nome + ' agora é o organizador.')) await carregar();
      return;
    }
    if (t.closest('[data-excluir-pessoa]')) await excluirConta(c);
  });
  async function excluirConta(c) {
    const id = c.id;
    const lancs = D.lancamentos.filter(l => l.contaId === id && !l.excluido);
    const veics = (D.veiculos || []).filter(v => v.contaId === id && !v.excluido);
    const ids = {}; veics.forEach(v => { ids[v.id] = true; });
    const gastos = (D.registros || []).filter(r => ids[r.veiculoId] && !r.excluido);
    const emOutros = (D.registros || []).filter(r => r.contaId === id && !ids[r.veiculoId] && !r.excluido);
    const soma = (l, campo) => l.reduce((s, x) => s + (Number(x[campo]) || 0), 0);
    const resumo = `<p>Vai junto para os <b>Excluídos</b> (30 dias para restaurar):</p><ul><li><b>${lancs.length}</b> lançamento(s) · ${brl(soma(lancs, 'valorTotal'))}</li>` +
      (veics.length ? veics.map(v => { const g = gastos.filter(r => r.veiculoId === v.id); return `<li>🚗 ${esc(nomeVeic(v))} com <b>${g.length}</b> gasto(s) · ${brl(soma(g.filter(r => r.tipo !== 'galeria'), 'valor'))}</li>`; }).join('') : '<li>nenhum veículo</li>') + '</ul>' +
      (emOutros.length ? `<p class="dica-txt">Os ${emOutros.length} gasto(s) que ${esc(primeiroNome(c.nome))} lançou em veículos de outras pessoas ficam nesses veículos, como “por ${esc(primeiroNome(c.nome))} (conta excluída)”.</p>` : '') +
      '<p class="dica-txt">No celular dela, o app sai da conta e avisa que a conta foi excluída. Se ela se cadastrar de novo com os mesmos dados, chega um pedido para você aprovar.</p>';
    const texto = await confirmarDuasVezes('Excluir ' + c.nome + '?', resumo, `Para confirmar, digite o nome da pessoa: <b>${esc(c.nome)}</b>`, (v) => chaveNome(v) === chaveNome(c.nome), 'Excluir pessoa');
    if (texto == null) return;
    const r = await tentar(chamar('admExcluirConta', id, texto));
    if (r) {
      aviso(`${c.nome} foi para os Excluídos (${r.lancamentos} lançamento(s), ${r.veiculos} veículo(s)).`, 5000);
      voltar();
      await carregar();
    }
  }

  // ---------------- Veículos ----------------
  RENDER.veiculos = () => {
    const vs = (D.veiculos || []).filter(v => !v.excluido);
    const regs = (D.registros || []).filter(r => !r.excluido);
    const nomes = {};
    vs.forEach(v => { nomes[v.contaId] = v.participante; });
    const visiveis = vs.filter(v => !VF.part || v.contaId === VF.part).sort((a, b) => String(a.modelo).localeCompare(String(b.modelo), 'pt-BR'));
    const doTipo = (r) => !VF.tipo || (VF.tipo === 'despesas' ? DESPESAS.includes(r.tipo) : r.tipo === VF.tipo);
    const totalDe = (v) => regs.filter(r => r.veiculoId === v.id && r.tipo !== 'galeria' && doTipo(r)).reduce((s, r) => s + (Number(r.valor) || 0), 0);
    const total = visiveis.reduce((s, v) => s + totalDe(v), 0);
    $('veiculos-sub').textContent = `${plural(visiveis.length, '1 veículo', '# veículos')} · ${brl(total)}`;
    let html = '<div class="conteudo-adm" style="padding-bottom:0"><div class="grade2">' +
      `<div><label for="vf-part">Pessoa</label><select id="vf-part">${opcoesHtml(Object.keys(nomes).map(k => ({ valor: k, rotulo: nomes[k] })).sort((a, b) => a.rotulo.localeCompare(b.rotulo)), VF.part, 'Todas')}</select></div>` +
      `<div><label for="vf-tipo">Tipo de gasto</label><select id="vf-tipo">${opcoesHtml([['abastecimento', 'Abastecimento'], ['manutencao', 'Manutenção'], ['despesas', 'Despesas'], ...DESPESAS.map(t => [t, '· ' + TIPO_REG[t][1]])].map(x => ({ valor: x[0], rotulo: x[1] })), VF.tipo, 'Todos')}</select></div></div></div>`;
    html += visiveis.length ? '<div style="margin-top:12px">' + visiveis.map(v => {
      const comps = (D.compartilhamentos || []).filter(c => c.veiculoId === v.id);
      const n = regs.filter(r => r.veiculoId === v.id && doTipo(r)).length;
      return `<div class="cartao" data-veiculo="${esc(v.id)}"><div class="corpo"><div class="desc">🚗 ${esc(v.modelo)} · ${esc(v.placa)}</div>` +
        `<div class="meta">${esc([v.cor || 'sem cor', [v.montadora, v.ano].filter(Boolean).join(' '), v.participante].filter(Boolean).join(' · '))}` +
        `${comps.length ? '<br>👥 com ' + esc(comps.map(c => c.nome).join(', ')) : ''}<br>${plural(n, '1 gasto', '# gastos')}</div></div>` +
        `<div class="direita"><span class="valor">${brl(totalDe(v))}</span></div></div>`;
    }).join('') + '</div>' : '<div class="vazio-adm">Nenhum veículo.</div>';
    $('veiculos-corpo').innerHTML = html;
  };
  $('veiculos-corpo').addEventListener('change', (e) => {
    if (e.target.id === 'vf-part') VF.part = e.target.value;
    if (e.target.id === 'vf-tipo') VF.tipo = e.target.value;
    RENDER.veiculos();
  });
  $('veiculos-corpo').addEventListener('click', (e) => {
    const c = e.target.closest('[data-veiculo]');
    if (c) { VG = VF.tipo; ir('veiculo', { id: c.dataset.veiculo }); }
  });

  // ---------------- Veículo ----------------
  function cartaoGasto(r) {
    const t = TIPO_REG[r.tipo] || ['•', r.tipo];
    let titulo = t[1];
    if (r.tipo === 'abastecimento' && r.combustivel) titulo += ' · ' + r.combustivel;
    if ((r.tipo === 'manutencao' || r.tipo === 'outros' || r.tipo === 'galeria') && r.descricao) titulo = String(r.descricao).split('\n')[0];
    const meta = [dataDia(r.data).slice(0, 5), r.hodometro != null ? km(r.hodometro) : '', r.tipo === 'abastecimento' && r.litros ? String(r.litros).replace('.', ',') + ' L' : '',
      r.tanqueCheio ? 'tanque cheio' : '', r.formaPagamento].filter(Boolean).join(' · ');
    const fotos = (D.arquivos[r.id] || []).filter(a => a.tipo === 'foto').length;
    return `<div class="cartao" data-gasto="${esc(r.id)}"><div class="corpo"><div class="desc">${t[0]} ${esc(titulo)}</div>` +
      `<div class="meta"><span class="quem">${esc(primeiroNome(String(r.participante || '').replace(/\s*\(conta excluída\)$/, '')))}${/\(conta excluída\)$/.test(r.participante || '') ? ' (excluída)' : ''}</span>${esc(meta)}${fotos ? ' · 📷' + (fotos > 1 ? fotos : '') : ''}</div></div>` +
      `<div class="direita"><span class="valor">${r.tipo === 'galeria' ? '📷' : brl(r.valor)}</span>${r.status && r.status !== 'confirmado' ? seloSit(r) : ''}</div></div>`;
  }
  /** v3: ℹ️ do veículo (folha de baixo): o cadastro todo e as fotos. */
  function infoVeiculo(v) {
    const comps = (D.compartilhamentos || []).filter(c => c.veiculoId === v.id);
    const fotos = (D.arquivos[v.id] || []).filter(a => a.tipo === 'foto');
    const lin = (r, val) => `<div class="lin"><span>${r}</span><span>${val || '<span class="dica-txt">—</span>'}</span></div>`;
    const j = abrirJanela('<h3>ℹ️ Informações do veículo</h3><div class="det info-veic">' +
      lin('Montadora', esc(v.montadora)) + lin('Modelo', esc(v.modelo)) + lin('Ano', v.ano ? esc(String(v.ano)) : '') + lin('Placa', esc(v.placa)) +
      lin('Cor', esc(v.cor)) + lin('Observação', v.observacao ? `<span class="info-obs">${esc(v.observacao)}</span>` : '') + lin('Dono', esc(v.participante)) +
      lin('Compartilhado com', comps.length ? comps.map(c => esc(c.nome) + (c.situacao === 'pendente' ? ' <small>(pendente)</small>' : '')).join(', ') : 'ninguém') +
      lin('Cadastrado em', v.criadoEm ? dataHora(v.criadoEm) : '') + '</div>' +
      `<div class="secao" style="margin:14px 0 6px">Fotos</div>` +
      (fotos.length ? '<div class="fotos-veic">' + fotos.map(a => `<button class="anexo" type="button" data-arq="${esc(a.driveId)}" data-tipo="foto">📷<small>carregando…</small></button>`).join('') + '</div>'
        : '<p class="dica-txt">Nenhuma foto.</p>') +
      '<div class="botoes-j"><button class="botao primario" type="button" data-fechar-info>Fechar</button></div>', { deBaixo: true });
    j.querySelector('[data-fechar-info]').onclick = () => fecharJanela();
    // as miniaturas vão aparecendo (cada foto vem do Drive)
    j.querySelectorAll('[data-arq]').forEach(async (b) => {
      try { const src = await baixarArquivo(b.dataset.arq); if (b.isConnected) b.innerHTML = `<img src="${src}" alt="foto do veículo">`; }
      catch (e) { if (b.isConnected) b.innerHTML = '📷<small>tocar para ver</small>'; }
    });
  }
  $('veiculo-info').onclick = () => { const v = veiculoPorId(DADOS.id); if (v) infoVeiculo(v); };

  RENDER.veiculo = ({ id }) => {
    const v = veiculoPorId(id);
    if (!v || v.excluido) return false;
    $('veiculo-titulo').textContent = `${v.modelo} · ${v.placa}`;
    $('veiculo-sub').textContent = v.participante;
    const regs = (D.registros || []).filter(r => r.veiculoId === id && !r.excluido)
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || (b.criadoEm || 0) - (a.criadoEm || 0));
    const comps = (D.compartilhamentos || []).filter(c => c.veiculoId === id);
    const total = regs.filter(r => r.tipo !== 'galeria').reduce((s, r) => s + (Number(r.valor) || 0), 0);
    let html = `<div class="vtopo"><div class="n">${esc(v.modelo)}${v.cor ? ' · ' + esc(v.cor) : ' · <span style="color:var(--vermelho)">sem cor</span>'}</div>` +
      `<div class="s">${esc([v.montadora, v.ano].filter(Boolean).join(' '))} · ${plural(regs.length, '1 gasto', '# gastos')} · ${brl(total)}</div>` +
      (v.observacao ? `<div class="s" style="margin-top:6px;white-space:pre-wrap">📝 ${esc(v.observacao)}</div>` : '') +
      (comps.length ? '<div class="comp">👥 Compartilhado com ' + comps.map(c => `<b>${esc(c.nome)}</b>${c.situacao === 'pendente' ? ' <small>(pendente)</small>' : ''} <button class="tirar" type="button" data-tirar="${esc(c.id)}">✕ tirar</button>`).join(' ') + '</div>' : '') +
      '<div class="acoes" style="margin:12px 0 0"><button class="botao pequeno" type="button" data-editar-veic>Editar veículo</button><button class="botao pequeno perigo" type="button" data-excluir-veic>Excluir veículo</button></div></div>';
    const tipos = [['', 'Todos'], ['abastecimento', '⛽ Abastecimento'], ['manutencao', '🔧 Manutenção'], ['despesas', '🧾 Despesas'], ['galeria', '📷 Galeria']];
    html += '<div class="chips" style="padding-top:2px">' + tipos.map(([k, r]) => `<button type="button" class="chip${VG === k ? ' on' : ''}" data-vg="${k}">${r}</button>`).join('') + '</div>';
    const lista = regs.filter(r => !VG || (VG === 'despesas' ? DESPESAS.includes(r.tipo) : r.tipo === VG));
    if (!lista.length) html += '<div class="vazio-adm">Nenhum gasto aqui.</div>';
    let mes = '';
    lista.forEach(r => {
      const m = String(r.data || '').slice(0, 7);
      if (m !== mes) { mes = m; const [a, mm] = m.split('-'); html += `<div class="dia">${MESES[Number(mm) - 1] || ''} de ${a || ''}</div>`; }
      html += cartaoGasto(r);
    });
    $('veiculo-corpo').innerHTML = html;
    return true;
  };
  $('veiculo-corpo').addEventListener('click', async (e) => {
    const t = e.target;
    const v = veiculoPorId(DADOS.id);
    if (!v) return;
    const vg = t.closest('[data-vg]');
    if (vg) { VG = vg.dataset.vg; RENDER.veiculo(DADOS); return; }
    const g = t.closest('[data-gasto]');
    if (g) { ir('gasto', { id: g.dataset.gasto }); return; }
    if (t.closest('[data-editar-veic]')) { ir('veiculo-editar', { id: v.id }); return; }
    const tc = t.closest('[data-tirar]');
    if (tc) {
      const c = (D.compartilhamentos || []).find(x => x.id === tc.dataset.tirar);
      if (!c) return;
      if (!(await confirmar(`Tirar ${c.nome} do compartilhamento do ${nomeVeic(v)}? O veículo some do celular de ${primeiroNome(c.nome)}. Os gastos que ${primeiroNome(c.nome)} lançou continuam no veículo.`, 'Tirar do compartilhamento', { perigo: true }))) return;
      if (await tentar(chamar('admRemoverCompartilhamento', c.id), 'Compartilhamento removido.')) await carregar();
      return;
    }
    if (t.closest('[data-excluir-veic]')) {
      const gastos = (D.registros || []).filter(r => r.veiculoId === v.id && !r.excluido);
      const comps = (D.compartilhamentos || []).filter(c => c.veiculoId === v.id);
      const resumo = `<p>Excluir o veículo <b>${esc(nomeVeic(v))}</b> de ${esc(v.participante)}? Vai junto para os <b>Excluídos</b> (30 dias para restaurar):</p><ul>` +
        `<li><b>${gastos.length}</b> gasto(s) · ${brl(gastos.filter(r => r.tipo !== 'galeria').reduce((s, r) => s + (Number(r.valor) || 0), 0))}</li>` +
        (comps.length ? `<li>Compartilhado com ${esc(comps.map(c => c.nome).join(', '))} (deixam de ver o veículo)</li>` : '') + '</ul>';
      const texto = await confirmarDuasVezes('Excluir veículo', resumo, `Para confirmar, digite a placa: <b>${esc(v.placa)}</b>`, (x) => chavePlaca(x) === chavePlaca(v.placa), 'Excluir o veículo');
      if (texto == null) return;
      const r = await tentar(chamar('admExcluirVeiculo', v.id, texto));
      if (r) { aviso(`Veículo excluído (${r.gastos} gasto(s) foram junto).`); voltar(); await carregar(); }
    }
  });

  // ---------------- Veículo (editar) ----------------
  RENDER['veiculo-editar'] = ({ id }) => {
    const v = veiculoPorId(id);
    if (!v || v.excluido) return false;
    $('veiculo-editar-sub').textContent = 'Dono: ' + v.participante;
    $('veiculo-editar-corpo').innerHTML = '<div class="conteudo-adm"><p class="dica-txt">A mudança chega aos celulares na próxima sincronização.</p>' +
      `<div class="grade2"><div><label for="ve-montadora">Montadora</label><input id="ve-montadora" value="${esc(v.montadora)}"></div><div><label for="ve-modelo">Modelo</label><input id="ve-modelo" value="${esc(v.modelo)}"></div></div>` +
      `<div class="grade2"><div><label for="ve-ano">Ano</label><input id="ve-ano" inputmode="numeric" value="${esc(v.ano || '')}"></div><div><label for="ve-placa">Placa</label><input id="ve-placa" value="${esc(v.placa)}"></div></div>` +
      `<label for="ve-cor">Cor</label><input id="ve-cor" value="${esc(v.cor || '')}">` +
      `<label for="ve-obs">Observação <small>(até 1000 letras)</small></label><textarea id="ve-obs" maxlength="1000" rows="4">${esc(v.observacao || '')}</textarea>` +
      '<div class="acoes" style="margin:18px 0"><button class="botao" type="button" data-voltar-form>Cancelar</button><button class="botao primario" type="button" id="ve-salvar">Salvar</button></div></div>';
    return true;
  };
  $('veiculo-editar-corpo').addEventListener('click', async (e) => {
    if (e.target.closest('[data-voltar-form]')) { voltar(); return; }
    if (e.target.id !== 've-salvar') return;
    const d = { montadora: $('ve-montadora').value, modelo: $('ve-modelo').value, ano: Number($('ve-ano').value) || '', placa: $('ve-placa').value, cor: $('ve-cor').value, observacao: $('ve-obs').value };
    e.target.disabled = true;
    const ok = await tentar(chamar('admSalvarVeiculo', DADOS.id, d), 'Veículo salvo.');
    e.target.disabled = false;
    if (ok) { await carregar(); voltar(); }
  });

  // ---------------- Gasto do veículo (ver) ----------------
  RENDER.gasto = ({ id }) => {
    const r = registroPorId(id);
    if (!r) return false;
    const v = veiculoPorId(r.veiculoId) || {};
    const t = TIPO_REG[r.tipo] || ['', r.tipo];
    $('gasto-titulo').textContent = t[1];
    $('gasto-sub').textContent = `${v.modelo || ''} · lançado por ${r.participante}`;
    const lin = (a, b) => b ? `<div class="lin"><span>${a}</span><span>${b}</span></div>` : '';
    let html = `<div class="vtopo"><div class="linha1"><div class="n">${t[0]} ${esc(r.tipo === 'abastecimento' ? (r.combustivel || t[1]) : (String(r.descricao || '').split('\n')[0] || t[1]))}</div><b>${r.tipo === 'galeria' ? '' : brl(r.valor)}</b></div>` +
      `<div class="s">${dataDia(r.data)} · ${seloSit(r)}${r.fonte ? ' · lido por ' + esc(String(r.fonte).replace(/\+/g, ' + ').replace('sefaz', 'QR Code').replace('ia', 'IA')) : ''}</div>` +
      (r.excluido ? `<div style="margin-top:6px">${prazoHtml(r.excluidoEm)}</div>` : '') + '</div>';
    html += '<div class="det">' + lin('Veículo', esc(nomeVeic(v)) + (v.participante ? ` <small>(${esc(v.participante)})</small>` : '')) +
      (r.tipo === 'abastecimento' ? lin('Valor do litro', r.precoLitro != null ? brlUnit(r.precoLitro) : '—') + lin('Litros', r.litros != null ? String(r.litros).replace('.', ',') + (r.combustivel === 'GNV' ? ' m³' : ' L') : '—') +
        lin('Tanque cheio', r.tanqueCheio ? 'Sim' : 'Não') : '') +
      (r.tipo === 'abastecimento' || r.tipo === 'manutencao' ? lin('Hodômetro', km(r.hodometro) || '—') : '') +
      (r.tipo === 'seguro' ? lin('Seguradora', esc(r.seguradora)) + lin('Apólice', esc(r.apolice)) + lin('Validade', r.validade ? dataDia(r.validade) : '') : '') +
      lin('Descrição', r.tipo !== 'abastecimento' ? esc(r.descricao) : esc(r.descricao)) +
      lin('Pagamento', esc(r.formaPagamento)) + lin('Local', esc(r.local) + (r.lat != null ? ` · <a target="_blank" rel="noopener" href="${mapa(r.lat, r.lng)}">🗺️ mapa</a>` : '')) +
      lin('Observação', esc(r.observacao)) + lin('Alterado em', dataHora(r.alteradoEm) + (r.alteradoPor ? ' por ' + esc(r.alteradoPor) : '')) + '</div>';
    html += '<div class="secao">Fotos e áudios</div>' + anexosHtml(D.arquivos[r.id] || []);
    html += r.excluido ? (r.excluidoCom ? '<p class="dica-txt" style="margin:14px">Este gasto foi excluído junto com o veículo ou a conta: ele volta ao restaurar.</p>'
      : '<div class="acoes um"><button class="botao primario" type="button" data-restaurar-gasto>Restaurar</button></div>')
      : '<div class="acoes"><button class="botao perigo" type="button" data-excluir-gasto>Excluir</button><button class="botao primario" type="button" data-editar-gasto>Editar</button></div>';
    $('gasto-corpo').innerHTML = html;
    return true;
  };
  $('gasto-corpo').addEventListener('click', async (e) => {
    const r = registroPorId(DADOS.id);
    if (!r) return;
    if (e.target.closest('[data-editar-gasto]')) { ir('gasto-editar', { id: r.id }); return; }
    if (e.target.closest('[data-excluir-gasto]')) {
      const t = TIPO_REG[r.tipo] || ['', r.tipo];
      if (!(await confirmar(`Excluir ${t[1].toLowerCase()} de ${dataDia(r.data)}${r.tipo === 'galeria' ? '' : ' (' + brl(r.valor) + ')'}, lançado por ${r.participante}? Vai para os Excluídos (30 dias para restaurar).`, 'Excluir', { perigo: true }))) return;
      if (await tentar(chamar('admExcluirRegistro', r.id), 'Gasto excluído.')) { voltar(); await carregar(); }
      return;
    }
    if (e.target.closest('[data-restaurar-gasto]')) {
      if (await tentar(chamar('admRestaurarRegistro', r.id), 'Gasto restaurado.')) await carregar();
    }
  });

  // ---------------- Gasto do veículo (editar) ----------------
  RENDER['gasto-editar'] = ({ id }) => {
    const r = registroPorId(id);
    if (!r || r.excluido) return false;
    const v = veiculoPorId(r.veiculoId) || {};
    const t = TIPO_REG[r.tipo] || ['', r.tipo];
    const ab = r.tipo === 'abastecimento', comKm = ab || r.tipo === 'manutencao', seg = r.tipo === 'seguro', gal = r.tipo === 'galeria';
    $('gasto-editar-titulo').textContent = 'Editar ' + t[1].toLowerCase();
    $('gasto-editar-sub').textContent = `${nomeVeic(v)} · ${r.participante}`;
    const meios = D.listas.meios.slice();
    if (!meios.some(x => /boleto/i.test(x))) meios.push('Boleto');
    const num = (x) => x == null ? '' : String(x).replace('.', ',');
    let html = '<div class="conteudo-adm"><p class="dica-txt">A mudança chega aos celulares na próxima sincronização.</p>' +
      `<div class="grade2"><div><label for="ge-data">Data</label><input type="date" id="ge-data" value="${esc(r.data || '')}"></div>` +
      (gal ? '<div></div>' : `<div><label for="ge-valor">Valor (R$)</label><input id="ge-valor" inputmode="decimal" value="${valorTexto(r.valor)}"></div>`) + '</div>';
    if (!gal) html += `<label for="ge-pag">Forma de pagamento</label>${selectHtml('ge-pag', meios, r.formaPagamento)}`;
    if (ab) {
      html += `<label for="ge-comb">Combustível</label>${selectHtml('ge-comb', COMBUSTIVEIS, r.combustivel)}` +
        `<div class="grade2"><div><label for="ge-preco">Valor do litro</label><input id="ge-preco" inputmode="decimal" value="${num(r.precoLitro)}"></div>` +
        `<div><label for="ge-litros">Litros</label><input id="ge-litros" inputmode="decimal" value="${num(r.litros)}"></div></div>` +
        `<label class="marcar"><input type="checkbox" id="ge-cheio"${r.tanqueCheio ? ' checked' : ''}> Tanque cheio</label>`;
    }
    if (comKm) html += `<label for="ge-km">Hodômetro (km)</label><input id="ge-km" inputmode="numeric" value="${r.hodometro == null ? '' : r.hodometro}">`;
    if (seg) {
      html += `<div class="grade2"><div><label for="ge-seguradora">Seguradora</label><input id="ge-seguradora" value="${esc(r.seguradora || '')}"></div>` +
        `<div><label for="ge-apolice">Nº da apólice</label><input id="ge-apolice" value="${esc(r.apolice || '')}"></div></div>` +
        `<label for="ge-validade">Validade</label><input type="date" id="ge-validade" value="${esc(r.validade || '')}">`;
    }
    html += `<label for="ge-local">Local</label><input id="ge-local" value="${esc(r.local || '')}">` +
      `<label for="ge-sit">Situação</label><select id="ge-sit">${['confirmado', 'revisar', 'aguardando_ia'].map(s => `<option value="${s}"${s === (r.status || 'confirmado') ? ' selected' : ''}>${ROTULO[s]}</option>`).join('')}</select>` +
      `<label for="ge-desc">Descrição</label><textarea id="ge-desc" rows="3">${esc(r.descricao || '')}</textarea>` +
      '<div class="acoes" style="margin:18px 0"><button class="botao" type="button" data-voltar-form>Cancelar</button><button class="botao primario" type="button" id="ge-salvar">Salvar</button></div></div>';
    $('gasto-editar-corpo').innerHTML = html;
    return true;
  };
  $('gasto-editar-corpo').addEventListener('click', async (e) => {
    if (e.target.closest('[data-voltar-form]')) { voltar(); return; }
    if (e.target.id !== 'ge-salvar') return;
    const r = registroPorId(DADOS.id);
    const q = (id) => $(id);
    const d = { id: r.id, data: q('ge-data').value, descricao: q('ge-desc').value, local: q('ge-local').value, status: q('ge-sit').value };
    if (q('ge-valor')) { d.valor = lerValor(q('ge-valor').value); d.formaPagamento = q('ge-pag').value; }
    if (q('ge-comb')) { d.combustivel = q('ge-comb').value; d.precoLitro = lerNumero(q('ge-preco').value); d.litros = lerNumero(q('ge-litros').value); d.tanqueCheio = q('ge-cheio').checked; }
    if (q('ge-km')) d.hodometro = lerNumero(q('ge-km').value.replace(/\./g, ''));
    if (q('ge-seguradora')) { d.seguradora = q('ge-seguradora').value; d.apolice = q('ge-apolice').value; d.validade = q('ge-validade').value; }
    e.target.disabled = true;
    const ok = await tentar(chamar('admSalvarRegistro', d), 'Gasto salvo.');
    e.target.disabled = false;
    if (ok) { await carregar(); voltar(); }
  });

  // ---------------- Mais ----------------
  RENDER.mais = () => {
    const lixo = itensLixeira();
    const prox = lixo.length ? Math.min(...lixo.map(x => diasRestantes(x.em))) : null;
    const melh = melhoriasNovas();
    const fila = filaIA().length;
    const badge = (n) => n ? `<span class="badge">${n}</span>` : '';
    $('mais-corpo').innerHTML = '<div class="secao">Cuidar</div><div class="menu-lista">' +
      `<button type="button" data-ir="lixo"><span class="ic">🗑️</span>Excluídos<span class="x">${prox != null ? '⏳ próximo em ' + plural(prox, '1 dia', '# dias') : 'vazio'} ${badge(lixo.length)}</span></button>` +
      `<button type="button" data-ir="melh"><span class="ic">🐞</span>Melhorias<span class="x">${melh ? '' : 'nada novo'} ${badge(melh)}</span></button>` +
      `<button type="button" data-ir="ia"><span class="ic">🤖</span>IA<span class="x">${fila ? plural(fila, '1 na fila', '# na fila') : 'fila vazia'}</span></button></div>` +
      '<div class="secao">Configurar</div><div class="menu-lista">' +
      '<button type="button" data-ir="listas"><span class="ic">🏷️</span>Listas<span class="x">categorias e pagamentos</span></button>' +
      '<button type="button" data-ir="convite"><span class="ic">🔗</span>Link de convite e endereço do app<span class="x">›</span></button>' +
      '<button type="button" data-ir="aparelhos"><span class="ic">📱</span>Aparelhos conectados<span class="x">deste app</span></button></div>' +
      '<div class="secao">Google</div><div class="menu-lista">' +
      `<a target="_blank" rel="noopener" href="${esc(INFO.urlPlanilha || '#')}"><span class="ic">📊</span>Abrir a planilha<span class="x">↗</span></a>` +
      `<a target="_blank" rel="noopener" href="${esc(INFO.urlPasta || '#')}"><span class="ic">📁</span>Abrir a pasta no Drive<span class="x">↗</span></a></div>` +
      '<div class="menu-lista"><button type="button" data-sair class="sair"><span class="ic">🚪</span>Sair deste aparelho</button></div>' +
      `<p class="dica-txt" style="text-align:center">Administrador v${VERSAO_ADMIN} · servidor v${esc(INFO.versaoServidor || '?')}${INFO.dataServidor ? ' · ' + esc(INFO.dataServidor) : ''}</p>`;
    // v3: Segurança (a digital deste celular)
    if (Digital.celular() && Digital.disponivelCache !== false) {
      const sec = document.createElement('div');
      sec.innerHTML = '<div class="secao">Segurança</div><div class="menu-lista"><button type="button" data-digital><span class="ic">👆</span>Entrar com a digital' +
        `<span class="x">neste celular <span class="interruptor${Digital.ligada() ? ' on' : ''}" role="switch" aria-checked="${Digital.ligada()}"></span></span></button></div>`;
      $('mais-corpo').insertBefore(sec, $('mais-corpo').firstChild);
    }
  };
  $('mais-corpo').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ir]');
    if (b) { ir(b.dataset.ir); return; }
    if (e.target.closest('[data-digital]')) {
      if (Digital.ligada()) {
        if (!(await confirmar('Desligar a digital neste celular? Ao abrir o app, vai pedir a senha do painel.', 'Desligar'))) return;
        Digital.desligar();
        aviso('Digital desligada neste celular.');
      } else if (await Digital.cadastrar()) aviso('Pronto! Nas próximas vezes, é só a digital.', 3500);
      redesenhar();
      return;
    }
    if (e.target.closest('[data-sair]')) {
      if (!(await confirmar('Sair deste aparelho? Para entrar de novo, é preciso a senha do painel.', 'Sair'))) return;
      try { await api('sair'); } catch (err) { /* sai assim mesmo */ }
      sairLocal('Você saiu deste aparelho.');
    }
  });

  // ---------------- Excluídos ----------------
  RENDER.lixo = () => {
    const itens = itensLixeira();
    const grupos = [['', 'Tudo'], ['pessoas', 'Pessoas'], ['veiculos', 'Veículos'], ['lancamentos', 'Lançamentos'], ['gastos', 'Gastos dos veículos'], ['melhorias', 'Melhorias']];
    $('lixo-sub').textContent = 'apaga de vez ' + ((D.lixeira && D.lixeira.dias) || 30) + ' dias depois';
    let html = '<div class="chips">' + grupos.map(([k, r]) => {
      const n = k ? itens.filter(x => x.grupo === k).length : itens.length;
      return `<button type="button" class="chip${LF === k ? ' on' : ''}" data-lf="${k}">${r} (${n})</button>`;
    }).join('') + '</div>';
    html += '<p class="dica-txt" style="margin:6px 16px 10px">Tudo o que for excluído (aqui ou pelas pessoas no app) fica aqui. Restaurar traz de volta; depois do prazo, a rotina automática apaga de vez (as fotos e os áudios vão para a lixeira do Drive).</p>';
    const lista = itens.filter(x => !LF || x.grupo === LF);
    html += lista.length ? lista.map(x => `<div class="lixo"><div class="t">${esc(x.titulo)}</div><div class="s">${esc(x.detalhe || '')} · excluído em ${dataHora(x.em)}` +
      `${x.junto ? '<br>↪ ' + esc(x.junto) : ''}</div><div class="r">${prazoHtml(x.em)}` +
      (x.junto ? '<span class="dica-txt">volta junto</span>' : `<button class="botao pequeno" type="button" data-restaurar-tipo="${x.tipo}" data-restaurar-id="${esc(x.id)}">Restaurar</button>`) + '</div></div>').join('')
      : '<div class="vazio-adm">Nada aqui. 👍</div>';
    $('lixo-corpo').innerHTML = html;
  };
  $('lixo-corpo').addEventListener('click', async (e) => {
    const f = e.target.closest('[data-lf]');
    if (f) { LF = f.dataset.lf; RENDER.lixo(); return; }
    const b = e.target.closest('[data-restaurar-tipo]');
    if (!b) return;
    const fn = { conta: 'admRestaurarConta', veiculo: 'admRestaurarVeiculo', lancamento: 'admRestaurar', registro: 'admRestaurarRegistro', melhoria: 'admRestaurarMelhoria' }[b.dataset.restaurarTipo];
    b.disabled = true;
    b.textContent = 'Restaurando…';
    if (await tentar(chamar(fn, b.dataset.restaurarId), 'Restaurado. Os celulares recebem na próxima sincronização.')) await carregar();
    else { b.disabled = false; b.textContent = 'Restaurar'; }
  });

  // ---------------- Melhorias ----------------
  RENDER.melh = () => {
    const todos = (D.melhorias || []).filter(m => !m.excluido);
    const pend = todos.filter(m => !melhoriaConcluida(m));
    const conc = todos.filter(melhoriaConcluida);
    $('melh-sub').textContent = 'pedidos do ícone 🐞 do app';
    let html = '<div class="chips">' + [['pendentes', `Pendentes (${pend.length})`], ['concluidos', `Concluídos (${conc.length})`], ['', `Todos (${todos.length})`]]
      .map(([k, r]) => `<button type="button" class="chip${MF === k ? ' on' : ''}" data-mf="${k}">${r}</button>`).join('') + '</div>';
    const lista = MF === 'pendentes' ? pend : MF === 'concluidos' ? conc : todos;
    const cls = { Novo: 'aguardando', 'Em andamento': 'revisar', Resolvido: 'ok', Descartado: 'exc' };
    html += lista.length ? lista.map(m => `<div class="melh${melhoriaConcluida(m) ? ' concluida' : ''}" data-melh="${esc(m.id)}">` +
      `<div class="cab">Pedido nº ${m.numero} <span class="selo ${cls[m.situacao] || ''}">${esc(m.situacao)}</span></div>` +
      `<div class="m-tela">${m.tela ? 'Tela #' + esc(m.tela) + ' ' : ''}${esc(m.nomeTela || 'tela não identificada')} · ${esc(m.participante)} · ${quandoCurto(m.criadoEm)}` +
      `${m.versaoApp ? ' · app v' + esc(m.versaoApp) : ''}${m.aparelho ? ' · ' + celularHtml(m.aparelhoNome, m.aparelho) : ''}${m.janela ? ' · janela: “' + esc(m.janela) + '”' : ''}</div>` +
      (m.texto ? `<div class="m-txt">✍️ ${esc(m.texto)}</div>` : '') +
      // v3: só a transcrição dá para selecionar (e copiar)
      (m.transcricao ? `<div class="m-txt selecionavel">🎤 “${esc(m.transcricao)}”</div>` : m.audioId ? `<div class="dica-txt">${m.iaErro ? '<span style="color:var(--vermelho)">' + esc(m.iaErro) + '</span> ' : 'Transcrição ainda não feita. '}</div>` : '') +
      '<div class="m-fotos oculto" data-fotos></div><div class="m-midia" data-midia></div><div class="bts">' +
      (nImagens(m) ? `<button class="botao pequeno" type="button" data-carregar="imagens">🖼️ ${nImagens(m) > 1 ? 'Ver as imagens (' + nImagens(m) + ')' : (m.imagemId ? 'Ver a tela' : 'Ver a foto')}</button>` : '') +
      (m.audioId ? '<button class="botao pequeno" type="button" data-carregar="audio">▶️ Ouvir</button>' : '') +
      (m.audioId && !m.transcricao ? '<button class="botao pequeno" type="button" data-transcrever>📝 Transcrever o áudio</button>' : '') + '</div>' +
      `<div class="grade2"><div><label>Situação</label><select data-situacao>${['Novo', 'Em andamento', 'Resolvido', 'Descartado'].map(x => `<option${x === m.situacao ? ' selected' : ''}>${x}</option>`).join('')}</select></div>` +
      `<div><label>Anotação</label><input data-anotacao placeholder="só você vê" value="${esc(m.anotacao || '')}"></div></div>` +
      // v3: quem pediu vê no app (Resolvido: mensagem opcional; Descartado: o motivo, obrigatório)
      `<div class="m-resposta${melhoriaConcluida(m) ? '' : ' oculto'}" data-resposta-caixa><label data-resposta-rotulo>${rotuloResposta(m.situacao)}</label>` +
      `<textarea data-resposta rows="2" maxlength="1000" placeholder="${m.situacao === 'Descartado' ? 'Explique por que não vai ser feito' : 'Ex.: Arrumado na versão nova!'}">${esc(m.resposta || '')}</textarea>` +
      '<p class="dica-txt">Quem pediu vê esta mensagem no app, junto com o aviso.</p></div>' +
      '<div class="acoes" style="margin:12px 0 0"><button class="botao pequeno perigo" type="button" data-excluir-melh>Excluir</button><button class="botao pequeno primario" type="button" data-salvar-melh>Salvar</button></div></div>').join('')
      : `<div class="vazio-adm">${MF === 'pendentes' ? 'Nenhum pedido pendente.' : 'Nenhum pedido aqui.'}</div>`;
    $('melh-corpo').innerHTML = html;
  };
  function nImagens(m) { return (m.imagemId ? 1 : 0) + (Number(m.fotos) || 0); }
  function rotuloResposta(sit) { return sit === 'Descartado' ? 'Motivo (obrigatório)' : 'Mensagem para quem pediu (opcional)'; }
  $('melh-corpo').addEventListener('change', (e) => {
    const sel = e.target.closest('[data-situacao]');
    if (!sel) return;
    const caixa = sel.closest('[data-melh]');
    const conc = sel.value === 'Resolvido' || sel.value === 'Descartado';
    caixa.querySelector('[data-resposta-caixa]').classList.toggle('oculto', !conc);
    caixa.querySelector('[data-resposta-rotulo]').textContent = rotuloResposta(sel.value);
    caixa.querySelector('[data-resposta]').placeholder = sel.value === 'Descartado' ? 'Explique por que não vai ser feito' : 'Ex.: Arrumado na versão nova!';
  });
  $('melh-corpo').addEventListener('click', async (e) => {
    const f = e.target.closest('[data-mf]');
    if (f) { MF = f.dataset.mf; RENDER.melh(); return; }
    const caixa = e.target.closest('[data-melh]');
    if (!caixa) return;
    const m = (D.melhorias || []).find(x => x.id === caixa.dataset.melh);
    if (!m) return;
    const img = e.target.closest('[data-fotos] img');
    if (img) { abrirVisor(img.src); return; }
    const c = e.target.closest('[data-carregar]');
    if (c && c.dataset.carregar === 'imagens') {
      // v3: a imagem da tela e as fotos (tiradas ou da galeria)
      c.disabled = true;
      const quais = (m.imagemId ? [['imagem', 'a tela']] : []).concat(Array.from({ length: Number(m.fotos) || 0 }, (_, k) => ['foto' + (k + 1), 'foto ' + (k + 1)]));
      const grade = caixa.querySelector('[data-fotos]');
      grade.classList.remove('oculto');
      grade.innerHTML = quais.map(([q, r]) => `<div data-q="${q}"><span class="carr">…</span><small>${r}</small></div>`).join('');
      for (const [q] of quais) {
        try {
          const src = await baixarArquivo(null, { id: m.id, qual: q });
          const el = grade.querySelector(`[data-q="${q}"]`);
          if (el) el.insertAdjacentHTML('afterbegin', `<img src="${src}" alt="imagem do pedido">`);
        } catch (err) { if (!(err instanceof ErroSessao)) aviso('Erro: ' + erroMsg(err), 5000); }
        const el = grade.querySelector(`[data-q="${q}"] .carr`); if (el) el.remove();
      }
      c.remove();
      return;
    }
    if (c) {
      const qual = c.dataset.carregar;
      c.disabled = true;
      try {
        const src = await baixarArquivo(null, { id: m.id, qual });
        const midia = caixa.querySelector('[data-midia]');
        if (qual === 'audio') midia.insertAdjacentHTML('beforeend', `<audio controls autoplay src="${src}"></audio>`);
        else { midia.insertAdjacentHTML('beforeend', `<img src="${src}" alt="foto da tela">`); midia.querySelector('img:last-child').onclick = () => abrirVisor(src); }
        c.remove();
      } catch (err) { c.disabled = false; if (!(err instanceof ErroSessao)) aviso('Erro: ' + erroMsg(err), 5000); }
      return;
    }
    const tr = e.target.closest('[data-transcrever]');
    if (tr) {
      tr.disabled = true; tr.textContent = 'Transcrevendo…';
      if (await tentar(chamar('admTranscreverMelhoria', m.id))) await carregar();
      else { tr.disabled = false; tr.textContent = '📝 Transcrever o áudio'; }
      return;
    }
    if (e.target.closest('[data-excluir-melh]')) {
      if (!(await confirmar(`Excluir o pedido nº ${m.numero}? Ele vai para os Excluídos (30 dias para restaurar).`, 'Excluir', { perigo: true }))) return;
      if (await tentar(chamar('admExcluirMelhoria', m.id), 'Pedido excluído.')) await carregar();
      return;
    }
    const s = e.target.closest('[data-salvar-melh]');
    if (s) {
      const sit = caixa.querySelector('[data-situacao]').value;
      const resposta = caixa.querySelector('[data-resposta]').value.trim();
      if (sit === 'Descartado' && !resposta) {
        aviso('Escreva o motivo: quem pediu vai ver no app.', 4000);
        caixa.querySelector('[data-resposta]').focus();
        return;
      }
      s.disabled = true;
      const ok = await tentar(chamar('admSalvarMelhoria', m.id, { situacao: sit, anotacao: caixa.querySelector('[data-anotacao]').value, resposta }), 'Pedido salvo.');
      s.disabled = false;
      if (ok) await carregar();
    }
  });

  // ---------------- IA ----------------
  RENDER.ia = () => {
    const ia = D.ia;
    const fila = filaIA();
    $('ia-sub').textContent = 'leitura de áudios e notas fiscais';
    let html = ia.chaveConfigurada ? '<div class="alerta-caixa azul" style="margin-top:12px"><span>✅ Chave do Gemini configurada (fica só no servidor).</span></div>'
      : '<div class="alerta-caixa vermelho" style="margin-top:12px"><span>✕ A propriedade GEMINI_API_KEY não foi criada no Apps Script.</span></div>';
    const sefaz = ia.ultimaSefaz;
    const motivo = sefaz ? (sefaz.ok ? 'dados lidos (sem usar a IA)' : ({ nao_encontrada: 'nota ainda não estava no site (a IA leu a foto)', desconhecido: 'página num formato desconhecido (a IA leu a foto e o texto)', sem_dados: 'a página não trouxe a nota (a IA leu a foto)', erro: 'site com problema: ' + (sefaz.mensagem || '') + ' (a IA leu a foto)' }[sefaz.motivo] || sefaz.motivo)) : '';
    html += '<div class="caixa"><h4>Situação</h4>' +
      `<div class="lin"><span>Última leitura que deu certo</span><span class="sub" style="text-align:right">${ia.ultimoSucesso ? quandoCurto(ia.ultimoSucesso.quando) + '<br>' + esc(ia.ultimoSucesso.detalhe) : '—'}</span></div>` +
      `<div class="lin"><span>Último problema</span><span class="sub" style="text-align:right">${ia.ultimoErro ? quandoCurto(ia.ultimoErro.quando) + '<br>' + esc(ia.ultimoErro.detalhe) : '—'}</span></div>` +
      `<div class="lin"><span>Última consulta na SEFAZ</span><span class="sub" style="text-align:right">${sefaz ? quandoCurto(sefaz.quando) + ' · ' + esc(sefaz.site) + '<br>' + esc(motivo) : '—'}</span></div>` +
      `<p class="dica-txt">Modelos tentados, em ordem: ${esc((ia.modelos || []).join(', '))}</p></div>`;
    html += '<div class="caixa"><h4>Testar a conexão</h4><p class="dica-txt">Usa 1 pedido do limite gratuito.</p><button class="botao pequeno" type="button" id="ia-testar">Testar conexão com a IA</button><div id="ia-teste"></div></div>';
    html += '<div class="caixa"><h4>Fila da IA</h4><p class="dica-txt">Áudios e notas aguardando leitura ou com erro. A rotina tenta de novo a cada 15 minutos; aqui você força na hora.</p>' +
      (fila.length ? fila.map(l => {
        const nota = l.origem === 'foto';
        const tem = (D.arquivos[l.id] || []).some(a => a.tipo === (nota ? 'foto' : 'audio'));
        return `<div class="lin"><div>${nota ? '🧾 Nota' : '🎤 Áudio'} de ${esc(l.participante)}<div class="sub">${quandoCurto(l.dataHora)} · ${ROTULO[l.status]}` +
          `${l.tentativasIA ? ' · ' + l.tentativasIA + ' tentativa(s)' : ''}${tem ? (l.observacaoIA ? '<br>' + esc(l.observacaoIA) : '') : '<br><i>' + (nota ? 'a foto' : 'o áudio') + ' ainda não chegou do celular</i>'}</div></div>` +
          (tem ? `<button class="botao pequeno" type="button" data-ler="${esc(l.id)}">Ler agora</button>` : '') + '</div>';
      }).join('') : '<p class="dica-txt">Nada na fila. 👍</p>') + '</div>';
    const c = { sefaz: 0, ia: 0, 'sefaz+ia': 0, pendente: 0 };
    let n = 0;
    D.lancamentos.forEach(l => { if (!l.excluido && l.origem === 'foto') { c[fonteNota(l)]++; n++; } });
    html += `<div class="caixa"><h4>Notas fiscais lidas (${n})</h4>` + (n ? `<div class="lin"><span>QR Code (SEFAZ)</span><b>${c.sefaz}</b></div><div class="lin"><span>IA (foto)</span><b>${c.ia}</b></div>` +
      `<div class="lin"><span>SEFAZ + IA</span><b>${c['sefaz+ia']}</b></div><div class="lin"><span>Ainda não lidas</span><b>${c.pendente}</b></div>` : '<p class="dica-txt">Nenhuma nota fiscal lançada ainda.</p>') + '</div>';
    $('ia-corpo').innerHTML = html;
  };
  $('ia-corpo').addEventListener('click', async (e) => {
    if (e.target.id === 'ia-testar') {
      const caixa = $('ia-teste');
      caixa.innerHTML = '<p class="dica-txt">Testando…</p>';
      try {
        const r = await chamar('admTestarIA');
        caixa.innerHTML = `<p class="${r.ok ? 'ok-txt' : 'erro-txt'}">${esc(r.mensagem)}</p>` + (r.tentativas || []).map(t => `<div class="dica-txt">${esc(t.modelo)}: ${t.ok ? '✓' : '✕'} ${esc(t.mensagem)}</div>`).join('');
      } catch (err) { caixa.innerHTML = `<p class="erro-txt">${esc(erroMsg(err))}</p>`; }
      return;
    }
    const b = e.target.closest('[data-ler]');
    if (b) await lerAgora(b.dataset.ler, b);
  });

  // ---------------- Listas ----------------
  RENDER.listas = () => {
    if (!LISTAS_EDIT) LISTAS_EDIT = { categorias: D.listas.categorias.slice(), meios: D.listas.meios.slice() };
    const cat = LISTA_ABA === 'categorias';
    const lista = LISTAS_EDIT[LISTA_ABA];
    $('listas-sub').textContent = 'aparecem nos celulares na próxima sincronização';
    $('listas-corpo').innerHTML = `<div class="abas2"><button type="button" data-lista-aba="categorias" class="${cat ? 'ativa' : ''}">Categorias</button><button type="button" data-lista-aba="meios" class="${cat ? '' : 'ativa'}">Pagamentos</button></div>` +
      '<div class="conteudo-adm">' + lista.map((v, i) => `<div class="edit-lin" data-i="${i}"><button type="button" data-subir aria-label="Subir"${i ? '' : ' disabled'}>↑</button><input value="${esc(v)}" data-item>` +
        '<button type="button" class="x" data-tirar aria-label="Tirar">✕</button></div>').join('') +
      `<button class="mini-btn" type="button" data-add>+ Adicionar ${cat ? 'categoria' : 'forma de pagamento'}</button>` +
      '<button class="botao primario grande" type="button" data-salvar-listas style="margin-top:18px">Salvar listas</button>' +
      '<p class="dica-txt">Salva as categorias e as formas de pagamento juntas. Lançamentos antigos não mudam.</p></div>';
  };
  function lerListaAtual() {
    LISTAS_EDIT[LISTA_ABA] = [...$('listas-corpo').querySelectorAll('[data-item]')].map(i => i.value);
  }
  $('listas-corpo').addEventListener('click', async (e) => {
    const t = e.target;
    const aba = t.closest('[data-lista-aba]');
    if (aba) { lerListaAtual(); LISTA_ABA = aba.dataset.listaAba; RENDER.listas(); return; }
    const linha = t.closest('[data-i]');
    if (t.closest('[data-subir]') && linha) {
      lerListaAtual();
      const i = Number(linha.dataset.i);
      const l = LISTAS_EDIT[LISTA_ABA];
      [l[i - 1], l[i]] = [l[i], l[i - 1]];
      RENDER.listas();
      return;
    }
    if (t.closest('[data-tirar]') && linha) { lerListaAtual(); LISTAS_EDIT[LISTA_ABA].splice(Number(linha.dataset.i), 1); RENDER.listas(); return; }
    if (t.closest('[data-add]')) {
      lerListaAtual();
      LISTAS_EDIT[LISTA_ABA].push('');
      RENDER.listas();
      const ins = $('listas-corpo').querySelectorAll('[data-item]');
      ins[ins.length - 1].focus();
      return;
    }
    if (t.closest('[data-salvar-listas]')) {
      lerListaAtual();
      const limpar = (l) => l.map(x => String(x).trim()).filter(Boolean);
      const r = await tentar(chamar('admSalvarListas', limpar(LISTAS_EDIT.categorias), limpar(LISTAS_EDIT.meios)), 'Listas salvas.');
      if (r) { D.listas = r; LISTAS_EDIT = null; RENDER.listas(); }
    }
  });

  // ---------------- Convite ----------------
  RENDER.convite = () => {
    const c = D.convite || {};
    const link = linkConvite();
    $('convite-sub').textContent = 'para quem vai usar o app de gastos';
    $('convite-corpo').innerHTML = '<div class="conteudo-adm">' +
      '<p class="dica-txt">Mande este link para quem vai usar o app. O código do grupo já vai junto: a pessoa só cria a conta (não precisa digitar o código).</p>' +
      (link ? `<label>Link de convite</label><input readonly value="${esc(link)}" id="cv-link"><div class="acoes" style="margin:10px 0 0">` +
        '<button class="botao pequeno" type="button" data-copiar-convite>Copiar link</button>' +
        `<a class="botao pequeno zap" target="_blank" rel="noopener" href="${esc('https://wa.me/?text=' + encodeURIComponent(msgConvite()))}">Enviar pelo WhatsApp</a></div>`
        : `<p class="erro-txt">${!c.codigo ? 'Falta criar a propriedade CODIGO_GRUPO no Apps Script.' : 'O endereço do app ainda não é conhecido: abra o app uma vez (ele avisa o servidor sozinho) ou informe abaixo.'}</p>`) +
      `<label for="cv-url">Endereço do app das pessoas</label><input id="cv-url" placeholder="https://seu-usuario.github.io/gastos/" value="${esc(c.urlApp || '')}">` +
      '<button class="botao primario" type="button" data-salvar-url style="margin-top:12px;width:100%">Salvar endereço</button></div>';
  };
  $('convite-corpo').addEventListener('click', async (e) => {
    if (e.target.closest('[data-copiar-convite]')) { copiar(linkConvite()); return; }
    if (e.target.closest('[data-salvar-url]')) {
      const r = await tentar(chamar('admSalvarUrlApp', $('cv-url').value.trim()), 'Endereço salvo.');
      if (r) { D.convite = r; RENDER.convite(); }
    }
  });

  // ---------------- Aparelhos conectados (deste app) ----------------
  let SESSOES = null;
  RENDER.aparelhos = () => {
    $('aparelhos-sub').textContent = 'onde o app do administrador está aberto';
    if (!SESSOES) { $('aparelhos-corpo').innerHTML = '<div class="vazio-adm">Carregando…</div>'; carregarSessoes(); return; }
    $('aparelhos-corpo').innerHTML = '<p class="dica-txt" style="margin:12px 16px">Trocar a senha do painel (propriedade SENHA_ADMIN) desconecta todos de uma vez.</p><div class="caixa">' +
      (SESSOES.length ? SESSOES.map(s => `<div class="lin"><div>${s.atual ? '📍 ' : ''}${esc(s.aparelho || 'Aparelho')}${s.atual ? ' <b style="font-size:12px">(este)</b>' : ''}` +
        `<div class="sub">entrou ${quandoCurto(s.criadoEm)} · último uso ${quandoCurto(s.ultimoUso)}</div></div>` +
        (s.atual ? '<button class="botao pequeno" type="button" data-sair-este>Sair</button>' : `<button class="botao pequeno perigo" type="button" data-desconectar-sessao="${esc(s.id)}">Desconectar</button>`) + '</div>').join('')
        : '<p class="dica-txt">Nenhum aparelho.</p>') + '</div>';
  };
  async function carregarSessoes() {
    try {
      const r = await api('sessoes');
      SESSOES = r.sessoes || [];
      if (TELA === 'aparelhos') RENDER.aparelhos();
    } catch (e) { if (!(e instanceof ErroSessao)) $('aparelhos-corpo').innerHTML = `<p class="erro-txt" style="margin:16px">${esc(erroMsg(e))}</p>`; }
  }
  $('aparelhos-corpo').addEventListener('click', async (e) => {
    const d = e.target.closest('[data-desconectar-sessao]');
    if (d) {
      if (!(await confirmar('Desconectar este aparelho? Para usar o app de novo nele, será preciso a senha do painel.', 'Desconectar', { perigo: true }))) return;
      if (await tentar(api('desconectar', { id: d.dataset.desconectarSessao }), 'Aparelho desconectado.')) { SESSOES = null; RENDER.aparelhos(); }
      return;
    }
    if (e.target.closest('[data-sair-este]')) {
      if (!(await confirmar('Sair deste aparelho? Para entrar de novo, é preciso a senha do painel.', 'Sair'))) return;
      try { await api('sair'); } catch (err) { /* sai assim mesmo */ }
      sairLocal('Você saiu deste aparelho.');
    }
  });

  // ------------------------------------------------------------------
  //  Entrar e sair
  // ------------------------------------------------------------------
  function descricaoAparelho() {
    const ua = navigator.userAgent || '';
    let m = /Android ([\d.]+);\s*([^;)]+)/.exec(ua);
    if (m) return `${m[2].replace(/ Build.*$/, '').trim()} · Android ${m[1].split('.')[0]}`;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
    const so = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'computador';
    return `Computador ${so} · ${nav}`;
  }
  // ------------------------------------------------------------------
  //  v3: digital (biometria do celular) para abrir o app
  //  No celular com a digital ligada, toda vez que o app abre (não quando volta do fundo) pede a digital;
  //  "Entrar com a senha" sempre vale. No computador (ou sem a digital), pede a senha toda vez que abre.
  //  A digital fica só neste aparelho (WebAuthn: o Android confere o dedo; a senha nunca é guardada).
  // ------------------------------------------------------------------
  const Digital = {
    disponivelCache: null,
    celular() { return /Android|iPhone|iPad/i.test(navigator.userAgent || '') || !!(navigator.userAgentData && navigator.userAgentData.mobile); },
    ligada() { try { return !!localStorage.getItem('adm_digital'); } catch (e) { return false; } },
    desligar() { guardar('adm_digital', null); },
    async disponivel() {
      try {
        const ok = !!(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
        this.disponivelCache = ok;
        return ok;
      } catch (e) { this.disponivelCache = false; return false; }
    },
    aleatorio(n) { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; },
    paraTexto(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    deTexto(t) {
      const b = atob(String(t).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(t).length + 3) % 4));
      return Uint8Array.from(b, (c) => c.charCodeAt(0));
    },
    /** Cadastra a digital neste celular. Devolve true se deu certo. */
    async cadastrar() {
      if (!(await this.disponivel())) { aviso('Este celular não tem a digital (ou ela não está cadastrada nas configurações do Android).', 5000); return false; }
      try {
        const cred = await navigator.credentials.create({ publicKey: {
          challenge: this.aleatorio(32),
          rp: { name: 'Controle de Gastos - Administrador' },
          user: { id: this.aleatorio(16), name: 'administrador', displayName: 'Administrador' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
          timeout: 60000, attestation: 'none'
        } });
        if (!cred) return false;
        guardar('adm_digital', this.paraTexto(cred.rawId));
        guardar('adm_digital_perguntado', '1');
        return true;
      } catch (e) {
        if (e && e.name !== 'NotAllowedError' && e.name !== 'AbortError') aviso('Não foi possível usar a digital: ' + erroMsg(e), 5000);
        return false;
      }
    },
    /** Pede a digital. Devolve true se a pessoa confirmou. */
    async conferir() {
      const id = (() => { try { return localStorage.getItem('adm_digital'); } catch (e) { return ''; } })();
      if (!id) return false;
      try {
        const r = await navigator.credentials.get({ publicKey: {
          challenge: this.aleatorio(32), timeout: 60000, userVerification: 'required',
          allowCredentials: [{ type: 'public-key', id: this.deTexto(id), transports: ['internal'] }]
        } });
        return !!r;
      } catch (e) {
        return false;
      }
    }
  };
  let PORTAO = false;   // true: o aparelho já está conectado; falta só a digital ou a senha para abrir
  let DIGITAL_FALHOU = false;
  function liberarApp() {
    PORTAO = false;
    history.replaceState({ tela: 'inicio', d: 0 }, '');
    mostrar('inicio');
    carregar();
  }
  function modoEntrar(digital) {
    $('ent-digital').classList.toggle('oculto', !digital);
    $('ent-com-senha').classList.toggle('oculto', !!digital);
  }
  /** Abrindo o app com o aparelho já conectado. */
  async function mostrarPortao() {
    PORTAO = true;
    D = null;
    profundidade = 0;
    history.replaceState({ tela: 'entrar', d: 0 }, '');
    mostrar('entrar');
    $('entrar-versao').textContent = 'v' + VERSAO_ADMIN;
    $('ent-erro').textContent = '';
    $('ent-senha').value = '';
    $('ent-texto').textContent = 'Por segurança, digite a senha do painel para abrir.';
    $('ent-rodape').classList.add('oculto');
    const comDigital = Digital.celular() && Digital.ligada() && (await Digital.disponivel());
    modoEntrar(comDigital);
    if (comDigital) setTimeout(entrarComDigital, 350);
  }
  async function entrarComDigital() {
    if (!PORTAO) return;
    $('ent-digital-msg').textContent = 'Confirme com a sua digital…';
    if (await Digital.conferir()) { liberarApp(); return; }
    DIGITAL_FALHOU = true;
    $('ent-digital-msg').textContent = 'A digital não deu certo.';
    $('ent-digital-ok').textContent = '👆 Tentar de novo';
  }
  /** Depois de entrar com a senha num celular: oferece a digital (uma vez; ou de novo, se ela deixou de funcionar). */
  async function oferecerDigital() {
    if (!Digital.celular() || !(await Digital.disponivel())) return;
    const falhou = DIGITAL_FALHOU && Digital.ligada();
    DIGITAL_FALHOU = false;
    let perguntado = false;
    try { perguntado = !!localStorage.getItem('adm_digital_perguntado'); } catch (e) { perguntado = true; }
    if (!falhou && (Digital.ligada() || perguntado)) return;
    guardar('adm_digital_perguntado', '1');
    const titulo = falhou ? '👆 A digital não funcionou' : '👆 Usar a digital para entrar?';
    const texto = falhou
      ? 'Se você trocou de celular ou mudou as digitais cadastradas, cadastre de novo. Ou continue só com a senha.'
      : 'Nas próximas vezes que abrir o app neste celular, é só encostar o dedo. Se a digital não der certo, a senha continua valendo.';
    const sim = await new Promise((ok) => {
      const j = abrirJanela(`<h3>${titulo}</h3><p>${texto}</p>` + (falhou ? '' : '<p class="dica-txt">Prefere só a senha? Toque em <b>Agora não</b>. Dá para ligar depois em <b>Mais</b>.</p>') +
        `<div class="botoes-j"><button class="botao" data-nao type="button">${falhou ? 'Só a senha' : 'Agora não'}</button>` +
        `<button class="botao primario" data-sim type="button">${falhou ? 'Cadastrar de novo' : 'Usar a digital'}</button></div>`, { aoFechar: () => ok(false), fecharFora: false });
      j.classList.add('janela-digital');
      j.querySelector('[data-nao]').onclick = () => { janelaAberta.aoFechar = null; fecharJanela(); ok(false); };
      j.querySelector('[data-sim]').onclick = () => { janelaAberta.aoFechar = null; fecharJanela(); ok(true); };
    });
    if (falhou && !sim) { Digital.desligar(); return; }
    if (sim && await Digital.cadastrar()) aviso('Pronto! Nas próximas vezes, é só a digital.', 3500);
  }
  $('ent-dedo').onclick = () => entrarComDigital();
  $('ent-digital-ok').onclick = () => entrarComDigital();
  $('ent-usar-senha').onclick = () => { modoEntrar(false); setTimeout(() => $('ent-senha').focus(), 50); };

  function mostrarEntrar(msg = '') {
    PORTAO = false;
    D = null;
    SESSOES = null;
    fecharJanela(true);
    profundidade = 0;
    abaPendente = null;
    history.replaceState({ tela: 'entrar', d: 0 }, '');
    mostrar('entrar');
    $('ent-erro').textContent = msg;
    $('ent-senha').value = '';
    $('entrar-versao').textContent = 'v' + VERSAO_ADMIN;
    $('ent-texto').textContent = 'Área só do organizador. Entre com a senha do painel.';
    $('ent-rodape').classList.remove('oculto');
    modoEntrar(false);
    if (!urlServidor()) $('ent-erro').textContent = 'O app não encontrou o endereço do servidor (arquivo config.js).';
  }
  function sairLocal(msg) {
    TOKEN = '';
    guardar('adm_token', null);
    mostrarEntrar(msg);
  }
  async function entrar() {
    const senha = $('ent-senha').value;
    $('ent-erro').textContent = '';
    if (!senha) { $('ent-erro').textContent = 'Digite a senha do painel.'; return; }
    const b = $('ent-entrar');
    b.disabled = true;
    b.textContent = 'Entrando…';
    try {
      if (PORTAO && TOKEN) {
        // o aparelho já está conectado: só confere a senha (sem criar outra conexão)
        let conferido = true;
        try {
          await api('conferirSenha', { senha });
        } catch (e) {
          if (e instanceof ErroSessao) return; // a conexão caiu: a tela de entrar normal já apareceu
          if (e.codigo !== 'acao_desconhecida') throw e;
          conferido = false; // servidor antigo (sem conferirSenha): entra do jeito de sempre
        }
        if (conferido) { liberarApp(); oferecerDigital(); return; }
      }
      const r = await api('entrar', { senha, aparelho: descricaoAparelho() });
      TOKEN = r.token;
      guardar('adm_token', TOKEN);
      INFO = { urlPlanilha: r.urlPlanilha, urlPasta: r.urlPasta, versaoServidor: r.versaoServidor, dataServidor: r.dataServidor || '' };
      guardar('adm_info', JSON.stringify(INFO));
      PORTAO = false;
      history.replaceState({ tela: 'inicio', d: 0 }, '');
      mostrar('inicio');
      oferecerDigital();
      await carregar();
    } catch (e) {
      $('ent-erro').textContent = erroMsg(e);
    } finally {
      b.disabled = false;
      b.textContent = 'Entrar';
    }
  }
  $('ent-entrar').onclick = entrar;
  $('ent-senha').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
  $('ent-mostrar').addEventListener('change', (e) => { $('ent-senha').type = e.target.checked ? 'text' : 'password'; });

  // ------------------------------------------------------------------
  //  Botões gerais
  // ------------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const v = e.target.closest('[data-voltar]');
    if (v) { voltar(); return; }
    const a = e.target.closest('[data-atualizar]');
    if (a) { atualizarAgora(); return; }
    const aba = e.target.closest('#nav [data-aba]');
    if (aba) { irAba(aba.dataset.aba); return; }
    const extra = e.target.closest('#nav [data-ir]');
    if (extra) {
      if (TELA === extra.dataset.ir) return;
      fecharJanela(true);
      if (profundidade > 0) { irDepois = extra.dataset.ir; abaPendente = 'mais'; history.go(-profundidade); }
      else { ir('mais'); ir(extra.dataset.ir); }
    }
  });
  async function atualizarAgora() {
    LISTAS_EDIT = null;
    SESSOES = null;
    const ok = await carregar();
    if (ok) aviso('Atualizado.', 1500);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && TOKEN && D && Date.now() - carregadoEm > 2 * 60 * 1000) carregar({ silencioso: true });
  });

  // ------------------------------------------------------------------
  //  Instalação e versão nova do app
  // ------------------------------------------------------------------
  let swEsperando = null;
  let pedimosAtualizacao = false;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (pedimosAtualizacao) { pedimosAtualizacao = false; location.reload(); } });
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
        const avisar = (w) => { swEsperando = w; if (TELA === 'inicio') redesenhar(); };
        if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const novo = reg.installing;
          if (novo) novo.addEventListener('statechange', () => { if (novo.state === 'installed' && navigator.serviceWorker.controller) avisar(novo); });
        });
      } catch (e) { /* sem service worker: funciona online */ }
    });
  }

  // ------------------------------------------------------------------
  //  Pedido de correção ou melhoria (v2): o mesmo 🐞 do app das pessoas.
  //  Vai direto para o servidor (com o áudio e uma imagem da tela) e
  //  aparece em Melhorias como pedido do "Administrador".
  // ------------------------------------------------------------------
  const TELAS_ADM = {
    inicio: ['A1', 'Início'], lanc: ['A2', 'Lançamentos'], 'lanc-ver': ['A3', 'Lançamento'], 'lanc-editar': ['A4', 'Editar lançamento'],
    pessoas: ['A5', 'Pessoas'], pessoa: ['A6', 'Pessoa'], veiculos: ['A7', 'Veículos'], veiculo: ['A8', 'Veículo'],
    'veiculo-editar': ['A9', 'Editar veículo'], gasto: ['A10', 'Gasto do veículo'], 'gasto-editar': ['A11', 'Editar gasto do veículo'],
    entrar: ['A19', 'Entrar'],
    mais: ['A12', 'Mais'], lixo: ['A13', 'Lixeira'], melh: ['A14', 'Melhorias'], ia: ['A15', 'IA (uso e chave)'], listas: ['A16', 'Listas'],
    convite: ['A17', 'Convite'], aparelhos: ['A18', 'Aparelhos conectados']
  };
  const SVG_BUG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 8h-2.81a5.985 5.985 0 0 0-1.82-1.96L17 4.41 15.59 3l-2.17 2.17a6.002 6.002 0 0 0-2.83 0L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-4 7c0 2.21-1.79 4-4 4s-4-1.79-4-4v-4c0-2.21 1.79-4 4-4s4 1.79 4 4v4zm-6-1h4v2h-4v-2zm0-4h4v2h-4v-2z"/></svg>';
  function telaMelhoria() {
    const t = TELAS_ADM[TELA] || ['', TELA];
    return { num: t[0], nome: 'Administrador: ' + t[1] };
  }
  function colocarBugs() {
    document.querySelectorAll('section.tela').forEach((sec) => {
      const topo = sec.querySelector('header.topo');
      if (!topo || sec.id === 'tela-entrar' || topo.querySelector('.botao-bug')) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'botao-bug';
      b.setAttribute('aria-label', 'Avisar um problema ou dar uma ideia');
      b.title = 'Avisar um problema ou dar uma ideia';
      b.innerHTML = SVG_BUG;
      b.addEventListener('click', abrirPedido);
      const acoes = topo.querySelector('.topo-acoes');
      if (acoes) acoes.insertBefore(b, acoes.firstChild);
      else if (topo.lastElementChild && topo.lastElementChild.tagName === 'SPAN' && !topo.lastElementChild.children.length) topo.replaceChild(b, topo.lastElementChild);
      else topo.appendChild(b);
    });
  }
  let html2canvasCarregando = null;
  function carregarHtml2canvas() {
    if (window.html2canvas) return Promise.resolve();
    if (!html2canvasCarregando) {
      html2canvasCarregando = new Promise((ok, falhou) => {
        const sc = document.createElement('script');
        sc.src = 'vendor/html2canvas.min.js';
        sc.onload = () => ok();
        sc.onerror = () => { html2canvasCarregando = null; falhou(new Error('não carregou')); };
        document.head.appendChild(sc);
      });
    }
    return html2canvasCarregando;
  }
  async function imagemDaTela() {
    try {
      await carregarHtml2canvas();
      const canvas = await window.html2canvas(document.body, {
        backgroundColor: '#eef2f6', logging: false, useCORS: true, scale: Math.min(2, window.devicePixelRatio || 1),
        x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight,
        windowWidth: document.documentElement.clientWidth, windowHeight: window.innerHeight,
        ignoreElements: (el) => el.id === 'toast' || el.id === 'carregando'
      });
      return await new Promise((ok) => canvas.toBlob((b) => ok(b), 'image/jpeg', 0.72));
    } catch (e) {
      return null; // sem a imagem, o pedido vai assim mesmo
    }
  }
  function blobParaBase64(blob) {
    return new Promise((ok, falhou) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1] || '');
      r.onerror = () => falhou(r.error);
      r.readAsDataURL(blob);
    });
  }
  function fmtDur(seg) { return Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0'); }
  let PED = null;
  async function abrirPedido() {
    if (PED) return;
    if (Gravador.gravando()) return;
    const pedido = { id: (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)), tela: telaMelhoria(),
      imagem: null, audio: null, duracao: 0, relogio: null, url: '', urlAudio: '', fotos: [] };
    PED = pedido;
    aviso('Preparando…', 1500);
    pedido.imagem = await imagemDaTela();
    if (PED !== pedido) return;
    $('toast').classList.add('oculto');
    pedido.url = pedido.imagem ? URL.createObjectURL(pedido.imagem) : '';
    const j = abrirJanela('<div class="pedido-melhoria"><h3>🐞 Problema ou ideia</h3>' +
      '<p class="dica-txt">Conte o que está errado nesta tela ou o que pode melhorar. O pedido aparece em <b>Melhorias</b>, junto com uma imagem desta tela.</p>' +
      // v3: a imagem da tela (com × para tirar) e fotos (tirar foto ou da galeria), até 5 no total
      '<div class="pm-fotos" data-pm-fotos></div>' +
      '<div class="pm-botoes"><label class="botao arquivo" data-pm-camera-b>📷 Tirar foto<input type="file" accept="image/*" capture="environment" data-pm-camera></label>' +
      '<label class="botao arquivo" data-pm-galeria-b>🖼️ Galeria<input type="file" accept="image/*" multiple data-pm-galeria></label></div>' +
      '<div class="pm-conta" data-pm-conta></div>' +
      '<button class="botao largo" type="button" data-pm-gravar>🎤 Gravar áudio</button><div data-pm-audio></div>' +
      '<label for="pm-texto">Ou escreva (opcional)</label>' +
      '<textarea id="pm-texto" rows="3" maxlength="3000" autocapitalize="sentences" placeholder="Ex.: o botão Salvar está cobrindo o campo do valor"></textarea>' +
      '<p class="erro-txt" data-pm-erro></p>' +
      '<div class="botoes-j"><button class="botao" type="button" data-pm-cancelar>Cancelar</button><button class="botao primario" type="button" data-pm-enviar>Enviar</button></div></div>',
    { aoFechar: () => descartarPedido(), fecharFora: false });
    const q = (sel) => j.querySelector(sel);
    const erro = (m) => { const e = q('[data-pm-erro]'); if (e) e.textContent = m; };
    const cabem = () => MAX_IMAGENS_PEDIDO - (pedido.imagem ? 1 : 0) - pedido.fotos.length;
    const desenharFotos = () => {
      const itens = [];
      if (pedido.imagem && pedido.url) itens.push(`<div class="pm-foto"><img src="${pedido.url}" alt="Imagem desta tela"><button class="x" type="button" data-tirar="tela" aria-label="Tirar a imagem da tela">×</button><small>esta tela</small></div>`);
      pedido.fotos.forEach((f) => itens.push(`<div class="pm-foto"><img src="${f.url}" alt="foto"><button class="x" type="button" data-tirar="${f.id}" aria-label="Tirar esta foto">×</button><small>foto</small></div>`));
      q('[data-pm-fotos]').innerHTML = itens.join('');
      q('[data-pm-fotos]').classList.toggle('oculto', !itens.length);
      q('[data-pm-conta]').textContent = itens.length ? `${itens.length} de ${MAX_IMAGENS_PEDIDO} fotos` : `Você pode juntar até ${MAX_IMAGENS_PEDIDO} fotos.`;
      const cheio = cabem() <= 0;
      ['[data-pm-camera]', '[data-pm-galeria]'].forEach((sel) => { q(sel).disabled = cheio; });
      ['[data-pm-camera-b]', '[data-pm-galeria-b]'].forEach((sel) => q(sel).classList.toggle('desativado', cheio));
    };
    const juntar = async (input) => {
      const arqs = Array.from(input.files || []).slice(0, Math.max(0, cabem()));
      input.value = '';
      for (const a of arqs) {
        try {
          const blob = await reduzirFoto(a);
          if (PED !== pedido) return;
          pedido.fotos.push({ id: 'f' + Math.random().toString(36).slice(2), blob, url: URL.createObjectURL(blob) });
        } catch (e) { erro('Não foi possível usar uma das fotos.'); }
      }
      desenharFotos();
    };
    q('[data-pm-camera]').onchange = (e) => juntar(e.target);
    q('[data-pm-galeria]').onchange = (e) => juntar(e.target);
    q('[data-pm-fotos]').addEventListener('click', (e) => {
      const x = e.target.closest('[data-tirar]');
      if (!x) return;
      if (x.dataset.tirar === 'tela') { if (pedido.url) URL.revokeObjectURL(pedido.url); pedido.imagem = null; pedido.url = ''; }
      else pedido.fotos = pedido.fotos.filter((f) => { if (f.id === x.dataset.tirar) URL.revokeObjectURL(f.url); return f.id !== x.dataset.tirar; });
      desenharFotos();
    });
    desenharFotos();
    const parar = async () => {
      clearInterval(pedido.relogio);
      const res = await Gravador.parar();
      if (PED !== pedido) return;
      const b = q('[data-pm-gravar]');
      b.classList.remove('gravando');
      if (!res) { b.textContent = '🎤 Gravar áudio'; return; }
      pedido.audio = res.blob;
      pedido.duracao = res.duracao;
      b.textContent = '🎤 Gravar de novo';
      if (pedido.urlAudio) URL.revokeObjectURL(pedido.urlAudio);
      pedido.urlAudio = URL.createObjectURL(res.blob);
      q('[data-pm-audio]').innerHTML = `<audio controls src="${pedido.urlAudio}"></audio>`;
    };
    q('[data-pm-gravar]').onclick = async () => {
      if (Gravador.gravando()) { await parar(); return; }
      if (!Gravador.suportado()) { erro('Este navegador não permite gravar áudio. Escreva o pedido.'); return; }
      try { await Gravador.iniciar(); } catch (e) {
        erro(e && e.name === 'NotAllowedError' ? 'Permita o uso do microfone para gravar.' : 'Não foi possível usar o microfone.');
        return;
      }
      erro('');
      const b = q('[data-pm-gravar]');
      b.classList.add('gravando');
      const tique = () => { if (Gravador.gravando()) b.textContent = `⏹ Parar (${fmtDur(Gravador.segundos())})`; };
      tique();
      pedido.relogio = setInterval(tique, 500);
    };
    q('[data-pm-cancelar]').onclick = () => { fecharJanela(); };
    q('[data-pm-enviar]').onclick = async () => {
      if (Gravador.gravando()) await parar();
      const texto = (q('#pm-texto').value || '').trim();
      if (!pedido.audio && !texto) { erro('Grave um áudio ou escreva o que aconteceu.'); return; }
      const b = q('[data-pm-enviar]');
      b.disabled = true;
      b.textContent = 'Enviando…';
      try {
        const melhoria = { id: pedido.id, criadoEm: Date.now(), tela: pedido.tela.num, nomeTela: pedido.tela.nome, texto, duracao: pedido.duracao || 0,
          versaoApp: 'admin ' + VERSAO_ADMIN, aparelho: descricaoAparelho() };
        if (pedido.audio) melhoria.audio = { mime: pedido.audio.type || 'audio/webm', base64: await blobParaBase64(pedido.audio) };
        if (pedido.imagem) melhoria.imagem = { mime: 'image/jpeg', base64: await blobParaBase64(pedido.imagem) };
        if (pedido.fotos.length) {
          melhoria.fotos = [];
          for (const f of pedido.fotos) melhoria.fotos.push({ mime: f.blob.type || 'image/jpeg', base64: await blobParaBase64(f.blob) });
        }
        const r = await api('melhoria', { melhoria });
        if (PED !== pedido) return;
        janelaAberta.aoFechar = null;
        fecharJanela();
        descartarPedido();
        aviso(`Obrigado! Pedido nº ${r.numero} registrado em Melhorias.`, 4000);
        if (D) carregar({ silencioso: true });
      } catch (e) {
        if (PED !== pedido) return;
        b.disabled = false;
        b.textContent = 'Enviar';
        erro(erroMsg(e));
      }
    };
  }
  function descartarPedido() {
    const pedido = PED;
    if (!pedido) return;
    clearInterval(pedido.relogio);
    if (Gravador.gravando()) Gravador.cancelar();
    if (pedido.url) URL.revokeObjectURL(pedido.url);
    if (pedido.urlAudio) URL.revokeObjectURL(pedido.urlAudio);
    (pedido.fotos || []).forEach((f) => URL.revokeObjectURL(f.url));
    PED = null;
  }
  const MAX_IMAGENS_PEDIDO = 5;
  /** Foto do celular ou da galeria, reduzida (lado maior até 1600 px, JPEG) para o pedido não ficar pesado. */
  async function reduzirFoto(arquivo) {
    const url = URL.createObjectURL(arquivo);
    try {
      const img = await new Promise((ok, falhou) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falhou(new Error('imagem inválida')); i.src = url; });
      const f = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * f);
      c.height = Math.round(img.naturalHeight * f);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((ok) => c.toBlob((b) => ok(b || arquivo), 'image/jpeg', 0.8));
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  colocarBugs();
  // com uma janela ou a foto aberta, a tela de trás não rola (v2)
  TravaFundo.vigiar(() => !!$('janela').firstElementChild || !!$('visor-adm'), [$('janela'), document.body]);

  // ------------------------------------------------------------------
  //  Começo
  // ------------------------------------------------------------------
  $('nav-versao').textContent = 'v' + VERSAO_ADMIN;
  if (TOKEN && urlServidor()) {
    mostrarPortao(); // v3: digital (celular) ou a senha, toda vez que o app abre
    Digital.disponivel();
  } else {
    mostrarEntrar();
  }
  // para os testes
  window.Admin = { tela: () => TELA, dados: () => D, carregar, ir, irAba, Digital };
})();
