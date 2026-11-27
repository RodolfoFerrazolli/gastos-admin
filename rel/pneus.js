// Copiado do app de gastos (v13) sem mudanças: o Administrador mostra as mesmas telas (rel-ponte.js).
// =====================================================================
//  V12: PNEUS
//  - Na manutenção com "Pneu" nos itens (ou no botão "🛞 Trocou pneus?"),
//    a pessoa marca quais pneus foram trocados no desenho do carro.
//  - Relatório · Pneus: os pneus de agora (desde quando e quantos km) e
//    quanto os pneus trocados duraram (datas, km, tempo e R$/km).
//  - "Informar uma troca antiga": a última troca antes de usar o app
//    (fica no cadastro do veículo; não é gasto).
// =====================================================================
const Pneus = (() => {
  const App = () => window.App;
  const $ = (id) => document.getElementById(id);
  const U = () => Veiculos._util;
  const esc = (s) => App().esc(s);
  const POS = ['de', 'dd', 'te', 'td', 'estepe'];
  const QUATRO = ['de', 'dd', 'te', 'td'];
  const NOME = { de: 'Dianteiro esquerdo', dd: 'Dianteiro direito', te: 'Traseiro esquerdo', td: 'Traseiro direito', estepe: 'Estepe' };
  const ATALHOS = { quatro: ['de', 'dd', 'te', 'td'], frente: ['de', 'dd'], tras: ['te', 'td'] };

  const temPneu = (t) => /\bpneus?\b/i.test(String(t || ''));
  const fmtKm = (n) => Math.round(Number(n)).toLocaleString('pt-BR') + ' km';
  const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
  const brl = (v) => App().brl(v);

  /** "Pirelli P400 165/70 R13" → marca "Pirelli P400", medida "165/70 R13". */
  function separarMarcaMedida(texto) {
    const t = String(texto || '').replace(/\bpneus?\b/ig, ' ').replace(/\s+/g, ' ').trim();
    const m = /\b(\d{3})\s*\/\s*(\d{2})\s*(?:Z?R)?\s*(\d{2})\b/i.exec(t);
    if (!m) return { marca: t.slice(0, 60), medida: '' };
    const marca = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).replace(/\s+/g, ' ').replace(/^[-–·,\s]+|[-–·,\s]+$/g, '').trim();
    return { marca: marca.slice(0, 60), medida: `${m[1]}/${m[2]} R${m[3]}` };
  }

  function itensDePneu(r) { return (r.itens || []).filter(i => i && temPneu(i.nome)); }

  /** Cada pneu colocado: { pos, data, km, marca, medida, chave, valorPorPneu, antigo }. */
  function eventos(v, regs, excetoId) {
    const lista = [];
    const ini = (v && v.pneusInicio) || {};
    POS.forEach((p) => {
      const x = ini[p];
      if (!x || (!x.data && x.km == null)) return;
      lista.push({ pos: p, data: x.data || '', km: x.km != null ? Number(x.km) : null, marca: x.marca || '', medida: x.medida || '', antigo: true,
        chave: 'antigo|' + (x.data || '') + '|' + (x.km == null ? '' : x.km) + '|' + (x.marca || ''), valorPorPneu: null });
    });
    regs.forEach((r) => {
      if (r.id === excetoId || r.excluirPendente || r.tipo !== 'manutencao' || !r.pneus || !(r.pneus.pos || []).length) return;
      const pos = r.pneus.pos.filter(p => POS.includes(p));
      const comValor = itensDePneu(r).filter(i => i.valor != null);
      const soma = comValor.reduce((s, i) => s + Number(i.valor), 0);
      const mm = (r.pneus.marca || r.pneus.medida) ? { marca: r.pneus.marca || '', medida: r.pneus.medida || '' } : separarMarcaMedida((itensDePneu(r)[0] || {}).nome);
      pos.forEach(p => lista.push({
        pos: p, data: r.data || '', km: r.hodometro != null ? Number(r.hodometro) : null, marca: mm.marca, medida: mm.medida, antigo: false,
        chave: 'reg|' + r.id, valorPorPneu: comValor.length && pos.length ? soma / pos.length : null, regId: r.id
      }));
    });
    return lista.sort((a, b) => (a.data || '').localeCompare(b.data || '') || ((a.km || 0) - (b.km || 0)) || (a.antigo ? -1 : 0));
  }

  /** Por pneu: o que está agora e as "vidas" (de uma troca à seguinte). */
  function historico(v, regs, excetoId) {
    const evs = eventos(v, regs, excetoId);
    const atual = {};
    const vidas = [];
    POS.forEach((p) => {
      const meus = evs.filter(e => e.pos === p);
      for (let i = 0; i + 1 < meus.length; i++) {
        const de = meus[i];
        const ate = meus[i + 1];
        vidas.push({ pos: p, de, ate, km: de.km != null && ate.km != null && ate.km >= de.km ? ate.km - de.km : null, dias: dias(de.data, ate.data) });
      }
      atual[p] = meus.length ? meus[meus.length - 1] : null;
    });
    return { evs, atual, vidas };
  }

  /** O pneu que estava em cada posição antes de uma data (para a manutenção que está sendo lançada). */
  function antesDe(v, regs, excetoId, data, km) {
    const evs = eventos(v, regs, excetoId).filter(e => !data || !e.data || e.data < data || (e.data === data && km != null && e.km != null && e.km < km));
    const r = {};
    POS.forEach((p) => { const m = evs.filter(e => e.pos === p); r[p] = m.length ? m[m.length - 1] : null; });
    return r;
  }

  function dias(a, b) {
    if (!a || !b) return null;
    const d = (Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000;
    return isFinite(d) && d >= 0 ? Math.round(d) : null;
  }
  /** "5 anos e 6 meses", "8 meses", "20 dias". */
  function tempo(a, b) {
    if (!a || !b || b < a) return '';
    const [y1, m1, d1] = a.split('-').map(Number);
    const [y2, m2, d2] = b.split('-').map(Number);
    let meses = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
    if (meses < 1) { const n = dias(a, b); return !n ? '' : n === 1 ? '1 dia' : n + ' dias'; }
    const anos = Math.floor(meses / 12);
    meses %= 12;
    const pa = anos ? (anos === 1 ? '1 ano' : anos + ' anos') : '';
    const pm = meses ? (meses === 1 ? '1 mês' : meses + ' meses') : '';
    return [pa, pm].filter(Boolean).join(' e ');
  }
  function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Nome de um conjunto de pneus: "Os 4", "Dianteiros (2)", "Traseiro esquerdo"... */
  function nomeGrupo(pos) {
    const s = POS.filter(p => pos.includes(p));
    const sem = s.filter(p => p !== 'estepe');
    let t;
    if (sem.length === 4) t = 'Os 4';
    else if (sem.length === 2 && sem.join() === 'de,dd') t = 'Dianteiros (2)';
    else if (sem.length === 2 && sem.join() === 'te,td') t = 'Traseiros (2)';
    else t = sem.map(p => NOME[p]).join(', ');
    if (s.includes('estepe')) t = t ? t + ' + estepe' : 'Estepe';
    return t;
  }
  function listaTexto(nomes) { return nomes.length < 2 ? nomes.join('') : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1]; }

  // ------------------------------------------------------------------
  //  No formulário da manutenção
  // ------------------------------------------------------------------
  let F = null; // { r, v, outros, pos: Set, aberto, aoMudar }

  function iniciarForm({ r, v, outros, somenteLeitura, aoMudar }) {
    F = { r, v, outros: outros || [], pos: new Set(((r.pneus && r.pneus.pos) || []).filter(p => POS.includes(p))), aberto: false, somenteLeitura, aoMudar };
    F.aberto = F.pos.size > 0;
    desenharForm();
  }

  function itensDoForm() {
    return Array.from(document.querySelectorAll('#vr-itens .item-man .i-nome')).map(i => ({ nome: i.value }));
  }
  function deveMostrar() { return F && (F.aberto || F.pos.size > 0 || itensDoForm().some(i => temPneu(i.nome))); }

  function botaoPneu(p, lado, sub, on) {
    return `<button type="button" class="pn${lado === 'd' ? ' dir' : ''}${on ? ' on' : ''}" data-pn="${p}" aria-pressed="${on}"${F.somenteLeitura ? ' disabled' : ''}>` +
      `<span class="roda" aria-hidden="true"></span><span><b>${NOME[p]}</b><small>${sub}</small></span></button>`;
  }

  function desenharForm() {
    const caixa = $('vr-pneus');
    if (!caixa || !F) return;
    if (!deveMostrar()) {
      caixa.innerHTML = F.somenteLeitura ? '' : '<button type="button" class="link-pequeno" id="pn-abrir">🛞 Trocou pneus?</button>';
      return;
    }
    const data = ($('vr-data') && $('vr-data').value) || F.r.data || hojeISO();
    const km = kmDoForm();
    const antes = antesDe(F.v, F.outros, F.r.id, data, km);
    const sub = (p) => (F.pos.has(p) ? 'NOVO ✓' : antes[p] ? (antes[p].data ? 'desde ' + dataBR(antes[p].data) : 'desde ' + fmtKm(antes[p].km)) : 'sem registro');
    const igual = (lista) => lista.length === [...F.pos].filter(p => p !== 'estepe').length && lista.every(p => F.pos.has(p));
    const porItem = itensDoForm().some(i => temPneu(i.nome));
    caixa.innerHTML = '<div class="pn-bloco"><div class="pn-tit">🛞 Quais pneus foram trocados?</div>' +
      `<div class="pn-sub">${porItem ? 'Apareceu porque tem “Pneu” nos itens. ' : ''}Toque nos pneus trocados: o app guarda a data e o km de cada um para dizer quanto ele durou.</div>` +
      '<div class="pn-carro">' + botaoPneu('de', 'e', sub('de'), F.pos.has('de')) + '<div class="pn-corpo" aria-hidden="true"><span>▲ FRENTE</span></div>' +
      botaoPneu('dd', 'd', sub('dd'), F.pos.has('dd')) + botaoPneu('te', 'e', sub('te'), F.pos.has('te')) + botaoPneu('td', 'd', sub('td'), F.pos.has('td')) + '</div>' +
      `<button type="button" class="pn-estepe${F.pos.has('estepe') ? ' on' : ''}" data-pn="estepe" aria-pressed="${F.pos.has('estepe')}"${F.somenteLeitura ? ' disabled' : ''}>` +
      `<span class="roda-e" aria-hidden="true"></span>Estepe <span class="pn-estepe-sub">${F.pos.has('estepe') ? 'NOVO ✓' : '(toque se trocou)'}</span></button>` +
      (F.somenteLeitura ? '' : '<div class="pn-rapidos">' +
        `<button class="chip${igual(ATALHOS.quatro) ? ' on' : ''}" type="button" data-pn-atalho="quatro">Os 4</button>` +
        `<button class="chip${igual(ATALHOS.frente) ? ' on' : ''}" type="button" data-pn-atalho="frente">Os 2 da frente</button>` +
        `<button class="chip${igual(ATALHOS.tras) ? ' on' : ''}" type="button" data-pn-atalho="tras">Os 2 de trás</button></div>`) +
      resumoForm(antes, data, km) + '</div>';
  }

  function kmDoForm() {
    const t = ($('vr-km') && $('vr-km').value) || '';
    const n = Number(t.replace(/\D/g, ''));
    return t.trim() && isFinite(n) ? n : (F && F.r.hodometro != null ? Number(F.r.hodometro) : null);
  }

  function resumoForm(antes, data, km) {
    if (!F.pos.size) return '';
    const sel = POS.filter(p => F.pos.has(p));
    let h = `✔ Trocados agora: <b>${listaTexto(sel.map(p => NOME[p].toLowerCase()))}</b>${km != null ? ` (${fmtKm(km)})` : ''}.`;
    // os que saíram: agrupados pela troca em que tinham sido colocados
    const grupos = {};
    sel.forEach((p) => { const e = antes[p]; const k = e ? e.chave : 'nada'; (grupos[k] = grupos[k] || { e, pos: [] }).pos.push(p); });
    const lista = Object.values(grupos);
    lista.forEach((g) => {
      const quem = lista.length > 1 ? `<br>${nomeGrupo(g.pos)}: ` : '<br>';
      if (!g.e) { h += quem + 'não sei quando os que saíram foram colocados.'; return; }
      const partes = [];
      if (g.e.km != null && km != null && km >= g.e.km) partes.push(fmtKm(km - g.e.km));
      const t = tempo(g.e.data, data);
      if (t) partes.push(t);
      const de = [g.e.marca, g.e.data ? 'colocados em ' + dataBR(g.e.data) : ''].filter(Boolean).join(', ');
      h += quem + `Os que saíram${de ? ` (${esc(de)})` : ''} ${partes.length ? `<b>duraram ${partes.join(' · ')}</b>.` : 'saíram agora.'}`;
    });
    return `<div class="pn-resumo">${h}</div>`;
  }

  function aoClicarForm(ev) {
    if (!F || F.somenteLeitura) return;
    if (ev.target.closest('#pn-abrir')) { F.aberto = true; desenharForm(); return; }
    const b = ev.target.closest('[data-pn]');
    const a = ev.target.closest('[data-pn-atalho]');
    if (!b && !a) return;
    if (b) { const p = b.dataset.pn; if (F.pos.has(p)) F.pos.delete(p); else F.pos.add(p); }
    if (a) {
      const lista = ATALHOS[a.dataset.pnAtalho];
      const estepe = F.pos.has('estepe');
      F.pos = new Set(lista.concat(estepe ? ['estepe'] : []));
    }
    F.aberto = true;
    desenharForm();
    if (F.aoMudar) F.aoMudar();
  }

  /** O que vai para o registro: sempre manda (com a lista vazia, os pneus saem). */
  function lerForm() {
    if (!F) return undefined;
    const pos = POS.filter(p => F.pos.has(p));
    if (!pos.length) return { pos: [] };
    const nome = (itensDoForm().find(i => temPneu(i.nome)) || {}).nome || '';
    const mm = separarMarcaMedida(nome);
    const o = { pos };
    if (mm.marca) o.marca = mm.marca;
    if (mm.medida) o.medida = mm.medida;
    return o;
  }

  /** Os pneus de um lançamento, para a tela de ver. */
  function textoVer(r) {
    if (!r || !r.pneus || !(r.pneus.pos || []).length) return '';
    const extra = [r.pneus.marca, r.pneus.medida].filter(Boolean).join(' ');
    return nomeGrupo(r.pneus.pos) + (extra ? ` (${extra})` : '');
  }

  // ------------------------------------------------------------------
  //  Relatório · Pneus
  // ------------------------------------------------------------------
  const RP = { veiculoId: null, ordem: 'recentes', antiga: null };

  async function preparar(dados) {
    const v = await U().veiculoAtivo(dados.veiculoId);
    if (!v) return false;
    if (RP.veiculoId !== v.id) RP.antiga = null;
    RP.veiculoId = v.id;
    RP.ordem = (await Banco.lerConfig('ordemPneus', 'recentes')) || 'recentes';
    $('rp-sub').textContent = `${v.modelo} · ${v.placa}`;
    await desenhar();
    return true;
  }

  async function dadosDoVeiculo() {
    const v = await U().veiculoAtivo(RP.veiculoId);
    if (!v) return null;
    const regs = await U().gastosDo(v.id);
    return { v, regs };
  }

  function kmAtual(v, regs) {
    let m = null;
    regs.forEach((r) => { if (!r.excluirPendente && r.hodometro != null && Number(r.hodometro) > (m || 0)) m = Number(r.hodometro); });
    Object.values((v && v.pneusInicio) || {}).forEach((x) => { if (x && x.km != null && x.km > (m || 0)) m = Number(x.km); });
    return m;
  }

  function pnFixo(p, lado, e, kmHoje) {
    const km = e && e.km != null && kmHoje != null ? kmHoje - e.km : null;
    const em = !e ? '—' : km == null ? '' : km < 100 ? 'novo' : fmtKm(km);
    const sub = !e ? 'sem registro' : e.data ? 'desde ' + dataBR(e.data).slice(3) : 'desde ' + fmtKm(e.km);
    return `<div class="pn${lado === 'd' ? ' dir' : ''}"><span class="roda" aria-hidden="true"></span><span><b>${NOME[p]}</b>${em ? `<em>${em}</em>` : ''}<small>${sub}</small></span></div>`;
  }

  function linhaTq(titulo, meta, direita) {
    return `<div class="tanque"><div><div class="tq-datas">${titulo}</div><div class="tq-meta">${meta}</div></div><div class="tq-kml">${direita}</div></div>`;
  }

  async function desenhar() {
    const d = await dadosDoVeiculo();
    const corpo = $('rp-corpo');
    if (!d) { corpo.innerHTML = ''; return; }
    if (RP.antiga) { corpo.innerHTML = htmlAntiga(); prepararAntiga(); return; }
    const h = historico(d.v, d.regs);
    const somenteLeitura = d.v.meu === false;
    if (!h.evs.length) {
      corpo.innerHTML = '<div class="grupo"><div class="vazio-pn"><div class="ic">🛞</div>' +
        '<h3>Ainda não sei quando os pneus de agora foram colocados</h3>' +
        '<p>Daqui para frente, ao lançar uma manutenção com pneu, é só marcar quais pneus foram trocados.</p>' +
        (somenteLeitura ? '' : '<p>Se você lembra da última troca, conte aqui: o app já começa a contar a partir dela.</p>' +
          '<button class="botao primario" type="button" id="rp-antiga">🛞 Informar uma troca antiga</button>') + '</div></div>';
      return;
    }
    const kmHoje = kmAtual(d.v, d.regs);
    const hoje = hojeISO();
    let html = '<div class="grupo"><div class="grupo-titulo">Pneus de agora</div><div class="pn-carro">' +
      pnFixo('de', 'e', h.atual.de, kmHoje) + '<div class="pn-corpo" aria-hidden="true"><span>▲ FRENTE</span></div>' +
      pnFixo('dd', 'd', h.atual.dd, kmHoje) + pnFixo('te', 'e', h.atual.te, kmHoje) + pnFixo('td', 'd', h.atual.td, kmHoje) + '</div>';
    // uma linha para cada troca que está no carro agora (ex.: dianteiros juntos)
    const agora = {};
    POS.forEach((p) => { const e = h.atual[p]; if (e) (agora[e.chave] = agora[e.chave] || { e, pos: [] }).pos.push(p); });
    Object.values(agora).sort((a, b) => POS.indexOf(a.pos[0]) - POS.indexOf(b.pos[0])).forEach((g) => {
      const km = g.e.km != null && kmHoje != null ? kmHoje - g.e.km : null;
      const marca = [g.e.marca, g.e.medida].filter(Boolean).join(' ');
      const meta = [g.e.data ? 'desde ' + dataBR(g.e.data) : '', g.e.km != null ? `(${fmtKm(g.e.km)})` : ''].filter(Boolean).join(' ') +
        (g.e.data && tempo(g.e.data, hoje) ? ' · ' + tempo(g.e.data, hoje) : '');
      html += linhaTq(esc(nomeGrupo(g.pos) + (marca ? ' · ' + marca : '')), meta, km == null ? '—' : km < 100 ? 'novos' : fmtKm(km));
    });
    if (!h.atual.estepe) html += '<div class="pn-evento">Estepe: nenhuma troca registrada.</div>';
    html += '</div>';
    // quanto duraram (agrupados: os pneus que entraram e saíram juntos)
    const grupos = {};
    h.vidas.forEach((x) => { const k = x.de.chave + '>' + x.ate.chave; (grupos[k] = grupos[k] || { de: x.de, ate: x.ate, pos: [], km: x.km }).pos.push(x.pos); });
    let lista = Object.values(grupos).sort((a, b) => (a.ate.data || '').localeCompare(b.ate.data || '') || ((a.ate.km || 0) - (b.ate.km || 0)) || POS.indexOf(a.pos[0]) - POS.indexOf(b.pos[0]));
    if (RP.ordem !== 'antigos') lista = lista.reverse();
    html += '<div class="grupo pn-hist"><div class="grupo-titulo">Quanto duraram' +
      (lista.length > 1 ? ` <button class="ordem-btn" type="button" data-pn-ordem>⇅ ${RP.ordem === 'antigos' ? 'Mais antigos primeiro' : 'Mais recentes primeiro'}</button>` : '') + '</div>';
    if (!lista.length) {
      html += '<p class="dica sem-margem">Quando um pneu registrado for trocado, aparece aqui quanto ele durou (km e tempo).</p>';
    } else {
      lista.forEach((g) => {
        const marca = [g.de.marca, g.de.medida].filter(Boolean).join(' ');
        const t = tempo(g.de.data, g.ate.data);
        const datas = (g.de.data && g.ate.data ? `${dataBR(g.de.data)} → ${dataBR(g.ate.data)}` : '') + (t ? ' · ' + t : '');
        const kms = g.de.km != null && g.ate.km != null ? `de ${fmtKm(g.de.km).replace(' km', '')} a ${fmtKm(g.ate.km)}` : '';
        const porKm = g.de.valorPorPneu != null && g.km > 0 ? ' · R$ ' + (g.de.valorPorPneu * g.pos.length / g.km).toFixed(3).replace('.', ',') + '/km' : '';
        html += linhaTq(esc(nomeGrupo(g.pos) + (marca ? ' · ' + marca : '')), [datas, kms + porKm].filter(Boolean).join('<br>'), g.km != null ? fmtKm(g.km) : '—');
      });
      const comKm = h.vidas.filter(x => x.pos !== 'estepe' && x.km != null && x.km > 0);
      if (comKm.length) {
        const media = Math.round(comKm.reduce((s, x) => s + x.km, 0) / comKm.length / 100) * 100;
        html += `<div class="pn-media">Em média, cada pneu durou ${fmtKm(media)} (${comKm.length} ${comKm.length === 1 ? 'pneu' : 'pneus'}).</div>`;
      }
    }
    html += '</div>';
    if (!somenteLeitura) html += '<button class="link-pequeno pn-link" type="button" id="rp-antiga">🛞 Informar uma troca antiga</button>';
    corpo.innerHTML = html;
  }

  // ---- Informar uma troca antiga ----
  function htmlAntiga() {
    const A = RP.antiga;
    const igual = (l) => !A.escolher && l.length === A.pos.size && l.every(p => A.pos.has(p));
    return '<div class="grupo"><div class="grupo-titulo">Informar uma troca antiga</div>' +
      '<label for="rp-a-data">Quando foi?</label><button type="button" class="campo-data" id="rp-a-data"></button>' +
      `<label for="rp-a-km">Hodômetro (km) <small class="opcional">(se lembrar)</small></label><input id="rp-a-km" inputmode="numeric" autocomplete="off" value="${A.km != null ? A.km.toLocaleString('pt-BR') : ''}">` +
      '<label>Quais pneus?</label><div class="pn-rapidos">' +
      `<button class="chip${igual(ATALHOS.quatro) ? ' on' : ''}" type="button" data-pa="quatro">Os 4</button>` +
      `<button class="chip${igual(ATALHOS.frente) ? ' on' : ''}" type="button" data-pa="frente">Os 2 da frente</button>` +
      `<button class="chip${igual(ATALHOS.tras) ? ' on' : ''}" type="button" data-pa="tras">Os 2 de trás</button>` +
      `<button class="chip${A.escolher ? ' on' : ''}" type="button" data-pa="escolher">Escolher…</button></div>` +
      (A.escolher ? '<div class="pn-escolher">' + POS.map(p => `<button type="button" class="chip${A.pos.has(p) ? ' on' : ''}" data-pa-pos="${p}">${NOME[p]}</button>`).join('') + '</div>' : '') +
      `<label for="rp-a-marca">Marca e medida <small class="opcional">(opcional)</small></label><input id="rp-a-marca" autocapitalize="words" autocomplete="off" placeholder="Ex.: Goodyear Kelly Edge 165/70 R13" value="${esc(A.marca || '')}">` +
      '<p class="dica">Não entra como gasto (não precisa do valor). Fica só para contar quanto os pneus duraram.</p>' +
      '<p class="erro" id="rp-a-erro"></p>' +
      '<div class="linha-botoes"><button class="botao" type="button" id="rp-a-cancelar">Cancelar</button>' +
      '<button class="botao primario" type="button" id="rp-a-salvar">Salvar</button></div></div>';
  }
  function prepararAntiga() { U().definirData($('rp-a-data'), RP.antiga.data || ''); }
  function lerAntiga() {
    const A = RP.antiga;
    if (!A) return;
    if ($('rp-a-data')) A.data = $('rp-a-data').value || '';
    if ($('rp-a-km')) { const t = $('rp-a-km').value.replace(/\D/g, ''); A.km = t ? Number(t) : null; }
    if ($('rp-a-marca')) A.marca = $('rp-a-marca').value.trim();
  }
  async function salvarAntiga() {
    lerAntiga();
    const A = RP.antiga;
    const erro = (m) => { $('rp-a-erro').textContent = m; };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(A.data || '')) return erro('Informe quando foi a troca.');
    if (A.data > hojeISO()) return erro('A data não pode ser depois de hoje.');
    if (!A.pos.size) return erro('Escolha quais pneus foram trocados.');
    if (A.km != null && A.km > 1000000) return erro('Confira o hodômetro.');
    const v = await Banco.obter('veiculos', RP.veiculoId);
    if (!v || v.excluirPendente) return;
    if (v.meu === false) return erro('Só quem cadastrou o veículo pode informar.');
    const mm = separarMarcaMedida(A.marca);
    const ini = Object.assign({}, v.pneusInicio || {});
    A.pos.forEach((p) => {
      const x = { data: A.data, km: A.km };
      if (mm.marca) x.marca = mm.marca;
      if (mm.medida) x.medida = mm.medida;
      ini[p] = x;
    });
    v.pneusInicio = ini;
    v.alteradoEm = Date.now();
    v.sync = 'pendente';
    await Banco.gravar('veiculos', v);
    RP.antiga = null;
    App().toast('Troca antiga guardada 🛞');
    await desenhar();
    window.scrollTo(0, 0);
    App().agendarSync(800);
  }

  function ligar() {
    document.addEventListener('click', (ev) => { if (ev.target.closest('#vr-pneus')) aoClicarForm(ev); });
    $('rp-corpo').addEventListener('click', async (ev) => {
      const t = ev.target;
      if (t.closest('button.campo-data')) { U().abrirCalendario(t.closest('button.campo-data')); return; }
      if (t.closest('#rp-antiga')) {
        RP.antiga = { data: '', km: null, pos: new Set(ATALHOS.quatro), escolher: false, marca: '' };
        await desenhar();
        window.scrollTo(0, 0);
        return;
      }
      if (t.closest('[data-pn-ordem]')) {
        RP.ordem = RP.ordem === 'antigos' ? 'recentes' : 'antigos';
        Banco.gravarConfig('ordemPneus', RP.ordem);
        const y = window.scrollY;
        await desenhar();
        window.scrollTo(0, y);
        return;
      }
      if (!RP.antiga) return;
      const pa = t.closest('[data-pa]');
      const pp = t.closest('[data-pa-pos]');
      if (pa || pp) {
        lerAntiga();
        if (pa && pa.dataset.pa === 'escolher') RP.antiga.escolher = true;
        else if (pa) { RP.antiga.escolher = false; RP.antiga.pos = new Set(ATALHOS[pa.dataset.pa]); }
        if (pp) { const p = pp.dataset.paPos; if (RP.antiga.pos.has(p)) RP.antiga.pos.delete(p); else RP.antiga.pos.add(p); }
        $('rp-corpo').innerHTML = htmlAntiga();
        prepararAntiga();
        return;
      }
      if (t.closest('#rp-a-cancelar')) { RP.antiga = null; await desenhar(); return; }
      if (t.closest('#rp-a-salvar')) salvarAntiga();
    });
    $('rp-corpo').addEventListener('input', (ev) => {
      if (ev.target.id === 'rp-a-km') {
        const t = ev.target.value.replace(/\D/g, '').slice(0, 7);
        ev.target.value = t ? Number(t).toLocaleString('pt-BR') : '';
      }
    });
    $('rp-voltar').onclick = () => App().voltar();
  }
  ligar();

  return {
    preparar, iniciarForm, atualizarForm: desenharForm, lerForm, textoVer, temPneu,
    // usados nos testes
    _historico: historico, _separarMarcaMedida: separarMarcaMedida, _tempo: tempo, _nomeGrupo: nomeGrupo
  };
})();
