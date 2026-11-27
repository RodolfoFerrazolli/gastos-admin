// Copiado do app de gastos (v13) sem mudanças: o Administrador mostra as mesmas telas (rel-ponte.js).
// =====================================================================
//  RELATÓRIO DO VEÍCULO (V7)
//  Menu "+" do veículo > Relatório: Gastos (lista e gráfico) e
//  Desempenho (km rodados, consumo, custo por km e média por tanque).
//  Num veículo compartilhado o relatório soma os gastos de todos
//  (é igual para o dono e para quem recebeu o compartilhamento).
//  As contas ficam em funções puras (calcularGastos e
//  calcularDesempenho), usadas também nos testes.
// =====================================================================
const Relatorio = (() => {
  const $ = (id) => document.getElementById(id);
  const App = () => window.App;
  const U = () => Veiculos._util; // utilidades do veiculos.js (carregado antes)

  const DESPESAS = ['seguro', 'ipva', 'licenciamento', 'multa', 'outros'];
  const NOME_TIPO = { seguro: 'Seguro', ipva: 'IPVA', licenciamento: 'Licenciamento', multa: 'Multa', outros: 'Outros' };
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const QUEDA = 0.8; // tanque que rendeu menos de 80% da média dos outros: barra laranja

  // ------------------------------------------------------------------
  //  Formatação
  // ------------------------------------------------------------------
  function num(n, casas) { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }); }
  function brl(v) { return 'R$ ' + num(Math.round((Number(v) || 0) * 100) / 100, 2); }
  function km(n) { return Math.round(n).toLocaleString('pt-BR') + ' km'; }
  /** aaaa-mm-dd -> dd/mm/aa */
  function dataAA(iso) { const p = String(iso || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : ''; }
  /** aaaa-mm-dd -> dd/mm */
  function dataDM(iso) { const p = String(iso || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : ''; }
  function mesLongo(chave) { const [a, m] = String(chave).split('-'); return `${MESES[Number(m) - 1]} de ${a}`; }
  function plural(n, um, varios) { return n === 1 ? um : varios.replace('#', n); }
  function diasEntre(de, ate) {
    const [a1, m1, d1] = de.split('-').map(Number);
    const [a2, m2, d2] = ate.split('-').map(Number);
    return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
  }
  function familia(comb) {
    const c = String(comb || '').toLowerCase();
    if (c.startsWith('etanol')) return 'etanol';
    if (c.startsWith('gasolina')) return 'gasolina';
    return '';
  }
  const valor = (r) => (Number(r.valor) > 0 ? Number(r.valor) : 0);
  const litros = (r) => (Number(r.litros) > 0 ? Number(r.litros) : 0);
  const temKm = (r) => r.hodometro != null && r.hodometro !== '' && isFinite(Number(r.hodometro));
  const ordem = (a, b) => String(a.data || '').localeCompare(String(b.data || '')) ||
    ((temKm(a) && temKm(b)) ? Number(a.hodometro) - Number(b.hodometro) : 0) || (a.criadoEm || 0) - (b.criadoEm || 0);

  // ------------------------------------------------------------------
  //  Contas
  // ------------------------------------------------------------------
  /** Período padrão: do gasto mais velho ao mais novo (sem a Galeria). */
  function periodoPadrao(regs) {
    const datas = regs.filter(r => r.tipo !== 'galeria' && r.data).map(r => r.data).sort();
    return datas.length ? { de: datas[0], ate: datas[datas.length - 1] } : null;
  }
  function noPeriodo(regs, de, ate) {
    return regs.filter(r => r.tipo !== 'galeria' && !r.excluirPendente && r.data && r.data >= de && r.data <= ate);
  }

  /** Gastos do período em 3 grupos (a Galeria fica de fora). */
  function calcularGastos(regs, de, ate) {
    const lista = noPeriodo(regs, de, ate).sort((a, b) => ordem(b, a)); // do mais novo para o mais velho
    const grupo = (filtro) => {
      const itens = lista.filter(filtro);
      return { itens, qtd: itens.length, total: Math.round(itens.reduce((s, r) => s + valor(r), 0) * 100) / 100 };
    };
    const abastecimentos = grupo(r => r.tipo === 'abastecimento');
    const manutencoes = grupo(r => r.tipo === 'manutencao');
    const despesas = grupo(r => DESPESAS.includes(r.tipo));
    const total = Math.round((abastecimentos.total + manutencoes.total + despesas.total) * 100) / 100;
    return { abastecimentos, manutencoes, despesas, total };
  }

  /**
   * Desempenho do período.
   * - Média por tanque(s): de um tanque cheio (com hodômetro) até o próximo tanque cheio; os abastecimentos
   *   do meio (mesmo sem hodômetro) somam os litros no trecho.
   * - Sem nenhum trecho fechado: média aproximada (km entre o primeiro e o último hodômetro dividido pelos
   *   litros colocados depois do primeiro) e a lista "Média aproximada por mês" (cada abastecimento com
   *   hodômetro vale até o próximo com hodômetro e conta no mês em que foi feito).
   */
  // ------------------------------------------------------------------
  //  V11: consumo a cada ~1.000 km e o aviso de "consumo caindo".
  //  Conta aproximada: os litros colocados num abastecimento (e nos sem km logo depois) ÷ os km até o próximo
  //  abastecimento com hodômetro. Os trechos são juntados de trás para a frente em blocos de pelo menos 1.000 km
  //  (o bloco mais recente fica sempre completo; a sobra mais antiga, com menos de 1.000 km, fica de fora).
  //  Aviso: o último bloco ficou 15% ou mais abaixo da média de antes (com pelo menos ~3.000 km de antes).
  // ------------------------------------------------------------------
  const BLOCO_KM = 1000;
  const QUEDA_BLOCO = 0.85;
  const HISTORICO_MIN = 3000;
  function trechosAprox(abast) {
    const comKm = [];
    abast.forEach((r, i) => { if (temKm(r)) comKm.push(i); });
    const trechos = [];
    for (let k = 0; k < comKm.length - 1; k++) {
      const i = comKm[k];
      const j = comKm[k + 1];
      const L = abast.slice(i, j).reduce((s, r) => s + litros(r), 0);
      const dist = Number(abast[j].hodometro) - Number(abast[i].hodometro);
      if (L > 0 && dist > 0) trechos.push({ de: abast[i].data, ate: abast[j].data, km: dist, litros: L });
    }
    return trechos;
  }
  function blocosDeConsumo(abast) {
    const trechos = trechosAprox(abast);
    const blocos = [];
    let b = null;
    for (let k = trechos.length - 1; k >= 0; k--) {
      const t = trechos[k];
      if (!b) b = { ate: t.ate, km: 0, litros: 0 };
      b.km += t.km; b.litros += t.litros; b.de = t.de;
      if (b.km >= BLOCO_KM) { blocos.unshift(b); b = null; }
    }
    blocos.forEach((x) => { x.kml = x.km / x.litros; });
    // cada bloco comparado com a média dos de antes dele (quando já há histórico)
    let km = 0;
    let L = 0;
    blocos.forEach((x) => {
      x.antes = km >= HISTORICO_MIN ? km / L : null;
      x.baixo = x.antes != null && x.kml <= x.antes * QUEDA_BLOCO;
      km += x.km; L += x.litros;
    });
    return blocos;
  }
  /** Aviso do último bloco (null: sem aviso). */
  function quedaDosBlocos(blocos) {
    const u = blocos[blocos.length - 1];
    if (!u || !u.baixo) return null;
    return { pct: Math.round((1 - u.kml / u.antes) * 100), agora: u.kml, antes: u.antes, km: u.km, de: u.de, ate: u.ate };
  }
  function abastOrdenados(regs) {
    return regs.filter(r => r.tipo === 'abastecimento' && !r.excluirPendente && r.status !== 'aguardando_ia').sort(ordem);
  }
  /**
   * V11: cartão da tela do veículo. fechadoAte = data do último bloco quando a pessoa tocou no ✕:
   * o aviso só volta se o consumo melhorou depois disso (algum abastecimento sem aviso) e caiu de novo.
   */
  function avisoConsumo(regs, fechadoAte) {
    const abast = abastOrdenados(regs);
    const blocos = blocosDeConsumo(abast);
    const queda = quedaDosBlocos(blocos);
    if (!queda) return null;
    if (fechadoAte) {
      let melhorou = false;
      const depois = abast.filter(r => r.data > fechadoAte && temKm(r));
      for (const r of depois) {
        const ate = abast.filter(x => x.data < r.data || (x.data === r.data && Number(x.hodometro || 0) <= Number(r.hodometro)));
        if (!quedaDosBlocos(blocosDeConsumo(ate))) { melhorou = true; break; }
      }
      if (!melhorou) return null;
    }
    return Object.assign(queda, { mini: blocos.slice(-7).map(b => ({ kml: b.kml, baixo: b === blocos[blocos.length - 1] })) });
  }

  function calcularDesempenho(regs, de, ate) {
    const periodo = noPeriodo(regs, de, ate);
    const abast = periodo.filter(r => r.tipo === 'abastecimento').sort(ordem);
    const outros = periodo.filter(r => r.tipo !== 'abastecimento');
    const res = { dias: Math.max(1, diasEntre(de, ate) + 1), abastecimentos: abast.length };

    // km rodados: do menor ao maior hodômetro (abastecimentos e manutenções)
    const kms = periodo.filter(r => (r.tipo === 'abastecimento' || r.tipo === 'manutencao') && temKm(r)).map(r => Number(r.hodometro));
    res.kmRodados = kms.length >= 2 ? Math.max(...kms) - Math.min(...kms) : null;
    res.kmPorDia = res.kmRodados != null ? res.kmRodados / res.dias : null;

    // combustível
    const totalComb = abast.reduce((s, r) => s + valor(r), 0);
    const totalL = abast.reduce((s, r) => s + litros(r), 0);
    const comPreco = abast.filter(r => Number(r.precoLitro) > 0);
    const paraMedia = abast.filter(r => valor(r) > 0 && litros(r) > 0);
    res.combustivel = {
      litros: totalL,
      total: totalComb,
      precoMedio: paraMedia.length ? paraMedia.reduce((s, r) => s + valor(r), 0) / paraMedia.reduce((s, r) => s + litros(r), 0) : null,
      barato: comPreco.length ? comPreco.reduce((m, r) => (Number(r.precoLitro) < Number(m.precoLitro) ? r : m)) : null,
      caro: comPreco.length ? comPreco.reduce((m, r) => (Number(r.precoLitro) > Number(m.precoLitro) ? r : m)) : null
    };
    const totalOutros = outros.reduce((s, r) => s + valor(r), 0);
    res.custoCombKm = res.kmRodados > 0 && totalComb > 0 ? totalComb / res.kmRodados : null;
    res.custoTotalKm = res.kmRodados > 0 && (totalComb + totalOutros) > 0 ? (totalComb + totalOutros) / res.kmRodados : null;

    // ---- trechos de tanque cheio a tanque cheio ----
    const ancoras = [];
    abast.forEach((r, i) => { if (r.tanqueCheio && temKm(r)) ancoras.push(i); });
    const tanques = [];
    for (let k = 1; k < ancoras.length; k++) {
      const i = ancoras[k - 1];
      const j = ancoras[k];
      const meio = abast.slice(i + 1, j + 1);
      const L = meio.reduce((s, r) => s + litros(r), 0);
      const dist = Number(abast[j].hodometro) - Number(abast[i].hodometro);
      if (!(L > 0) || !(dist > 0)) continue; // trecho sem litros ou com o km fora de ordem: não entra
      const fams = new Set(meio.map(r => familia(r.combustivel)));
      tanques.push({
        de: abast[i].data, ate: abast[j].data, km: dist, litros: L, kml: dist / L, n: meio.length,
        valor: meio.reduce((s, r) => s + valor(r), 0), inicio: abast[i], itens: meio,
        familia: fams.size === 1 ? [...fams][0] : ''
      });
    }
    res.tanques = tanques;
    const ultimaAncora = ancoras.length ? ancoras[ancoras.length - 1] : -1;
    const depois = ultimaAncora >= 0 ? abast.slice(ultimaAncora + 1) : [];
    res.tanqueAberto = ultimaAncora >= 0 && depois.length ? { desde: abast[ultimaAncora].data, n: depois.length, litros: depois.reduce((s, r) => s + litros(r), 0) } : null;

    // ---- trechos aproximados (de um abastecimento com hodômetro até o próximo com hodômetro) ----
    const comKm = [];
    abast.forEach((r, i) => { if (temKm(r)) comKm.push(i); });
    const trechos = [];
    for (let k = 0; k < comKm.length - 1; k++) {
      const i = comKm[k];
      const j = comKm[k + 1];
      const parte = abast.slice(i, j); // o que foi colocado no início do trecho e os abastecimentos sem km do meio
      const L = parte.reduce((s, r) => s + litros(r), 0);
      const dist = Number(abast[j].hodometro) - Number(abast[i].hodometro);
      if (!(L > 0) || !(dist > 0)) continue;
      trechos.push({ mes: abast[i].data.slice(0, 7), km: dist, litros: L, n: parte.length, itens: parte, valor: parte.reduce((s, r) => s + valor(r), 0), familia: familia(abast[i].combustivel) });
    }
    const aberto = comKm.length ? abast.slice(comKm[comKm.length - 1]) : [];

    res.aproximado = !tanques.length;
    if (tanques.length) {
      const kmT = tanques.reduce((s, t) => s + t.km, 0);
      const lT = tanques.reduce((s, t) => s + t.litros, 0);
      res.consumo = kmT / lT;
    } else if (comKm.length >= 2) {
      const i = comKm[0];
      const j = comKm[comKm.length - 1];
      const L = abast.slice(i + 1, j + 1).reduce((s, r) => s + litros(r), 0);
      const dist = Number(abast[j].hodometro) - Number(abast[i].hodometro);
      res.consumo = L > 0 && dist > 0 ? dist / L : null;
    } else {
      res.consumo = null;
    }
    res.semDados = comKm.length < 2; // menos de 2 abastecimentos com hodômetro: ainda não dá para calcular

    // ---- média aproximada por mês (só quando não há trecho de tanque cheio) ----
    if (res.aproximado) {
      const meses = new Map();
      trechos.forEach((t) => {
        const m = meses.get(t.mes) || { mes: t.mes, km: 0, litros: 0, n: 0, itens: [] };
        m.km += t.km; m.litros += t.litros; m.n += t.n; m.itens = m.itens.concat(t.itens);
        meses.set(t.mes, m);
      });
      res.meses = [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes)).map(m => Object.assign(m, { kml: m.km / m.litros }));
      res.mesAberto = aberto.length && comKm.length ? {
        mes: aberto[0].data.slice(0, 7), desde: aberto[0].data, n: aberto.length, itens: aberto,
        litros: aberto.reduce((s, r) => s + litros(r), 0)
      } : null;
      if (res.mesAberto) res.mesAberto.juntoDeOutro = res.meses.some(m => m.mes === res.mesAberto.mes);
    } else {
      res.meses = [];
      res.mesAberto = null;
    }

    // ---- etanol x gasolina (só quando os dois foram usados) ----
    const fonte = res.aproximado ? trechos : tanques;
    const porFam = {};
    fonte.filter(t => t.familia).forEach((t) => {
      const f = porFam[t.familia] || (porFam[t.familia] = { km: 0, litros: 0, valor: 0 });
      f.km += t.km; f.litros += t.litros; f.valor += t.valor;
    });
    if (porFam.etanol && porFam.gasolina) {
      const lado = (f) => ({ kml: f.km / f.litros, custoKm: f.valor > 0 ? f.valor / f.km : null });
      res.etanolGasolina = { etanol: lado(porFam.etanol), gasolina: lado(porFam.gasolina) };
    } else {
      res.etanolGasolina = null;
    }

    // ---- gráfico "Consumo de cada tanque" e o aviso de queda ----
    res.barras = tanques.map((t, i, arr) => { // V11: todos os tanques (o gráfico rola para o lado)
      const outrosT = tanques.filter(x => x !== t);
      const media = outrosT.length ? outrosT.reduce((s, x) => s + x.km, 0) / outrosT.reduce((s, x) => s + x.litros, 0) : t.kml;
      return { kml: t.kml, data: t.ate, baixo: tanques.length >= 2 && t.kml < media * QUEDA, ultimo: i === arr.length - 1 };
    });
    const ult = res.barras[res.barras.length - 1];
    if (ult && ult.baixo) {
      const outrosT = tanques.slice(0, -1);
      const media = outrosT.reduce((s, x) => s + x.km, 0) / outrosT.reduce((s, x) => s + x.litros, 0);
      res.queda = { pct: Math.round((1 - ult.kml / media) * 100), kml: ult.kml };
    } else {
      res.queda = null;
    }
    // V11: consumo a cada ~1.000 km
    res.blocos = blocosDeConsumo(abast);
    const kmB = res.blocos.reduce((s, b) => s + b.km, 0);
    res.mediaBlocos = kmB > 0 ? kmB / res.blocos.reduce((s, b) => s + b.litros, 0) : null;
    res.quedaBlocos = quedaDosBlocos(res.blocos);
    return res;
  }

  // ------------------------------------------------------------------
  //  V8: dados da planilha exportada (as mesmas contas da tela).
  //  O servidor só monta a planilha com o que vai daqui.
  // ------------------------------------------------------------------
  const NOME_PLANILHA = {
    abastecimento: 'Abastecimento', manutencao: 'Manutenção', seguro: 'Seguro', ipva: 'IPVA',
    licenciamento: 'Licenciamento', multa: 'Multa', outros: 'Outros'
  };
  const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function dataLonga(iso) { const p = String(iso || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ''; }
  function linhasTexto(t) { return String(t || '').split('\n').map(s => s.trim()).filter(Boolean).join(' · '); }
  /** V11: "4 × Óleo (R$ 42,90) = R$ 171,60; Filtro de óleo = R$ 38,00". */
  function textoItensMan(r) {
    return (r.itens || []).filter(i => i && i.nome).map((i) => {
      const q = Number(i.qtd) || 1;
      return (q !== 1 ? String(q).replace('.', ',') + ' × ' : '') + i.nome + (q !== 1 && i.unitario != null ? ` (${brl(i.unitario)})` : '') +
        (i.valor != null ? ' = ' + brl(i.valor) : '');
    }).join('; ');
  }
  /** V12: os itens da manutenção (bem resumido), com o desconto quando a soma passa do total. */
  function caixaItensMan(r) {
    const esc = App().esc;
    const it = (r.itens || []).filter(i => i && i.nome);
    const q = (x) => String(Math.round((Number(x) || 1) * 1000) / 1000).replace('.', ',');
    const soma = it.reduce((s, i) => s + (Number(i.valor) || 0), 0);
    const total = Number(valor(r)) || 0;
    const dif = Math.round((soma - total) * 100) / 100;
    return '<div class="man-itens">' + it.map(i => `<div class="mi"><span>${Number(i.qtd || 1) !== 1 ? q(i.qtd) + '× ' : ''}${esc(i.nome)}</span>` +
      `<span>${i.valor != null ? brl(i.valor) : '—'}</span></div>`).join('') +
      (dif >= 0.01 ? `<div class="mi desc"><span>Desconto</span><span>− ${brl(dif)}</span></div>` : '') +
      `<div class="mi tot"><span>Total</span><span>${brl(total)}</span></div></div>`;
  }
  function nomeManutencaoRel(r) {
    if (r.descricao) return String(r.descricao).split('\n')[0].trim();
    const it = (r.itens || []).filter(i => i && i.nome);
    if (!it.length) return 'Manutenção';
    return it[0].nome + (it.length > 1 ? ` e mais ${it.length - 1} ${it.length - 1 === 1 ? 'item' : 'itens'}` : '');
  }
  function descricaoPlanilha(r) {
    const nome = NOME_PLANILHA[r.tipo] || 'Outros';
    if (r.tipo === 'abastecimento') {
      return [r.combustivel, litros(r) ? num(r.litros, 3) + (r.combustivel === 'GNV' ? ' m³' : ' L') : '', r.tanqueCheio ? 'tanque cheio' : '',
        Number(r.desconto) > 0 ? 'desconto ' + brl(r.desconto) : ''] // V11
        .filter(Boolean).join(' · ') || nome;
    }
    if (r.tipo === 'manutencao' && (r.itens || []).length) { // V11: o nome e os itens
      return [r.descricao ? linhasTexto(r.descricao) : '', textoItensMan(r)].filter(Boolean).join(' · ');
    }
    if (r.tipo === 'seguro') {
      return [r.seguradora || 'Seguro', r.apolice ? 'apólice ' + r.apolice : '', r.validade ? 'validade ' + dataLonga(r.validade) : '', linhasTexto(r.descricao)]
        .filter(Boolean).join(' · ');
    }
    return linhasTexto(r.descricao) || nome;
  }
  /** Lista de meses (aaaa-mm) de "de" até "ate". */
  function mesesEntre(de, ate) {
    const out = [];
    let a = Number(de.slice(0, 4));
    let m = Number(de.slice(5, 7));
    const fimA = Number(ate.slice(0, 4));
    const fimM = Number(ate.slice(5, 7));
    while ((a < fimA || (a === fimA && m <= fimM)) && out.length < 120) {
      out.push(`${a}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) { m = 1; a++; }
    }
    return out;
  }
  /**
   * Tudo o que a planilha mostra. info: { eu (nome de quem gera), compartilhado, agora (Date) }.
   * Linhas em listas simples (o servidor confere cada coluna).
   */
  function dadosPlanilha(v, regs, de, ate, info = {}) {
    const g = calcularGastos(regs, de, ate);
    const d = calcularDesempenho(regs, de, ate);
    const periodo = noPeriodo(regs, de, ate).sort(ordem);
    const quem = (r) => {
      const p = String(r.participante || '').trim();
      return p || (r.meu === false ? '' : (info.eu || ''));
    };
    const precoDe = (r) => (Number(r.precoLitro) > 0 ? Number(r.precoLitro) : (valor(r) > 0 && litros(r) > 0 ? valor(r) / litros(r) : null));
    const km = (r) => (temKm(r) ? Number(r.hodometro) : null);

    const gastos = periodo.map(r => [r.data, NOME_PLANILHA[r.tipo] || 'Outros', descricaoPlanilha(r), r.local || '', km(r),
      r.formaPagamento || '', quem(r), valor(r)]);
    const abast = periodo.filter(r => r.tipo === 'abastecimento');
    const abastecimentos = abast.map(r => [r.data, r.local || '', r.combustivel || '', litros(r) || null, precoDe(r), valor(r), km(r),
      !!r.tanqueCheio, r.formaPagamento || '', quem(r)]);

    // resumo
    const kms = periodo.filter(r => (r.tipo === 'abastecimento' || r.tipo === 'manutencao') && temKm(r)).map(r => Number(r.hodometro));
    const porTipo = Object.keys(NOME_PLANILHA).map((t) => {
      const itens = periodo.filter(r => r.tipo === t);
      return [NOME_PLANILHA[t], itens.length, Math.round(itens.reduce((s, r) => s + valor(r), 0) * 100) / 100];
    });
    const meses = mesesEntre(de, ate);
    const totalMes = meses.map(m => periodo.filter(r => r.data.slice(0, 7) === m).reduce((s, r) => s + valor(r), 0));
    const destaques = [];
    const maior = periodo.reduce((m, r) => (valor(r) > (m ? valor(m) : 0) ? r : m), null);
    if (maior) destaques.push(['Maior gasto', `${descricaoPlanilha(maior)} · ${brl(valor(maior))} (${dataLonga(maior.data)})`]);
    if (meses.length >= 2) {
      const i = totalMes.indexOf(Math.max(...totalMes));
      if (totalMes[i] > 0) destaques.push(['Mês mais caro', `${mesLongo(meses[i])} · ${brl(totalMes[i])}`]);
      destaques.push(['Gasto médio por mês', brl(g.total / meses.length)]);
    }
    if (d.tanques.length >= 2) {
      const melhor = d.tanques.reduce((m, t) => (t.kml > m.kml ? t : m));
      destaques.push(['Melhor tanque', `${num(melhor.kml, 1)} km/L · de ${dataLonga(melhor.de)} a ${dataLonga(melhor.ate)}`]);
    }
    const c = d.combustivel;
    if (c.precoMedio != null) destaques.push(['Preço médio do litro', brl(c.precoMedio)]);
    if (c.barato) destaques.push(['Litro mais barato', `R$ ${num(c.barato.precoLitro, 3)} · ${dataLonga(c.barato.data)}${c.barato.local ? ' · ' + c.barato.local : ''}`]);
    if (c.caro && c.caro !== c.barato) destaques.push(['Litro mais caro', `R$ ${num(c.caro.precoLitro, 3)} · ${dataLonga(c.caro.data)}${c.caro.local ? ' · ' + c.caro.local : ''}`]);

    // desempenho
    const tanques = d.tanques.map((t) => {
      const outrosT = d.tanques.filter(x => x !== t);
      const media = outrosT.length ? outrosT.reduce((s, x) => s + x.km, 0) / outrosT.reduce((s, x) => s + x.litros, 0) : t.kml;
      return [t.de, t.ate, t.km, t.litros, t.n, t.kml, t.valor, t.valor > 0 ? t.valor / t.km : null, d.tanques.length >= 2 && t.kml < media * QUEDA];
    });
    let conclusao = '';
    const eg = d.etanolGasolina;
    if (eg && eg.etanol.custoKm != null && eg.gasolina.custoKm != null && eg.etanol.custoKm !== eg.gasolina.custoKm) {
      const barato = eg.etanol.custoKm < eg.gasolina.custoKm ? 'o etanol' : 'a gasolina';
      const dif = Math.abs(eg.etanol.custoKm - eg.gasolina.custoKm) / Math.max(eg.etanol.custoKm, eg.gasolina.custoKm);
      conclusao = `Neste veículo, ${barato} saiu ${dif < 0.1 ? 'um pouco ' : ''}mais ${barato === 'o etanol' ? 'barato' : 'barata'} por km.`;
    }
    const combustivel = abast.length ? [
      ['Litros abastecidos', num(c.litros, 1) + ' L'],
      ['Total em combustível', brl(c.total)],
      ['Preço médio do litro', c.precoMedio != null ? brl(c.precoMedio) : '—']
    ].concat(c.barato ? [['Mais barato', `R$ ${num(c.barato.precoLitro, 3)} · ${dataLonga(c.barato.data)}`]] : [])
      .concat(c.caro ? [['Mais caro', `R$ ${num(c.caro.precoLitro, 3)} · ${dataLonga(c.caro.data)}`]] : []) : [];

    // mês a mês: km pelo hodômetro (do último registro antes do mês até o último do mês)
    const leituras = periodo.filter(r => (r.tipo === 'abastecimento' || r.tipo === 'manutencao') && temKm(r))
      .map(r => ({ mes: r.data.slice(0, 7), km: Number(r.hodometro) }));
    let anterior = null;
    const kmMes = meses.map((m) => {
      const doMes = leituras.filter(x => x.mes === m).map(x => x.km);
      if (!doMes.length) return null;
      const fim = Math.max(...doMes);
      const ini = anterior != null ? anterior : Math.min(...doMes);
      anterior = Math.max(fim, anterior != null ? anterior : fim);
      return fim - ini > 0 ? fim - ini : null;
    });
    const somaMes = (f) => meses.map(m => Math.round(abast.filter(r => r.data.slice(0, 7) === m).reduce((s, r) => s + f(r), 0) * 1000) / 1000);

    return {
      modelo: v.modelo || '', placa: v.placa || '', de, ate, compartilhado: !!info.compartilhado,
      geradoEm: (() => { const a = info.agora || new Date(); return `${String(a.getDate()).padStart(2, '0')}/${String(a.getMonth() + 1).padStart(2, '0')}/${a.getFullYear()} ${String(a.getHours()).padStart(2, '0')}:${String(a.getMinutes()).padStart(2, '0')}`; })(),
      resumo: {
        total: g.total, qtd: periodo.length,
        kmRodados: d.kmRodados, kmIni: kms.length >= 2 ? Math.min(...kms) : null, kmFim: kms.length >= 2 ? Math.max(...kms) : null,
        kmPorDia: d.kmPorDia != null ? Math.round(d.kmPorDia) : null,
        consumo: d.consumo, nTanques: d.tanques.length,
        consumoNota: d.consumo == null ? 'precisa de 2 abastecimentos com hodômetro' : d.aproximado ? 'média aproximada' : 'de tanque cheio a tanque cheio',
        custoTotalKm: d.custoTotalKm, custoCombKm: d.custoCombKm,
        porTipo, destaques
      },
      gastos, abastecimentos,
      desempenho: {
        combustivel, tanques,
        tanqueAberto: d.tanqueAberto ? `Tanque em aberto desde ${dataLonga(d.tanqueAberto.desde)} (${plural(d.tanqueAberto.n, '1 abastecimento', '# abastecimentos')}): fecha no próximo tanque cheio.` : '',
        aproximado: d.aproximado ? d.meses.map(m => [mesLongo(m.mes), m.km, m.litros, m.n, m.kml]) : [],
        etanolGasolina: eg ? [['Etanol', eg.etanol.kml, eg.etanol.custoKm], ['Gasolina', eg.gasolina.kml, eg.gasolina.custoKm]] : [],
        conclusao
      },
      meses: {
        nomes: meses.map(m => `${MES_CURTO[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`),
        tipos: Object.keys(NOME_PLANILHA).map(t => [NOME_PLANILHA[t], meses.map(m => Math.round(periodo.filter(r => r.tipo === t && r.data.slice(0, 7) === m).reduce((s, r) => s + valor(r), 0) * 100) / 100)]),
        km: kmMes, litros: somaMes(litros), combustivel: somaMes(valor)
      }
    };
  }

  // ------------------------------------------------------------------
  //  Telas
  // ------------------------------------------------------------------
  const R = { veiculoId: null, de: '', ate: '', aba: 'lista', abertos: new Set(), itensAbertos: new Set(), regs: [], ordem: 'recentes' };

  function limpar() {
    R.veiculoId = null; R.de = ''; R.ate = ''; R.aba = 'lista'; R.abertos = new Set(); R.itensAbertos = new Set(); R.assinatura = '';
    $('rg-corpo').innerHTML = ''; $('rd-corpo').innerHTML = '';
  }

  /** Só o que muda as contas (a sincronização não redesenha a tela à toa, nem no meio de um arrastar). */
  function assinatura(regs) {
    const n = (x) => (x == null || x === '' ? null : Number(x));
    return JSON.stringify(regs.map(r => [r.id, r.tipo, r.data || '', n(r.valor), n(r.litros), n(r.precoLitro), n(r.hodometro), !!r.tanqueCheio,
      r.combustivel || '', r.descricao || '', !!r.excluirPendente, n(r.desconto), JSON.stringify(r.itens || [])])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  }
  async function prepararVeiculo(dados) {
    const v = await U().veiculoAtivo(dados.veiculoId);
    if (!v) return null;
    R.regs = (await U().gastosDo(v.id));
    const ass = assinatura(R.regs);
    R.mudou = ass !== R.assinatura || R.veiculoId !== v.id;
    R.assinatura = ass;
    if (R.veiculoId !== v.id) {
      R.veiculoId = v.id;
      const p = periodoPadrao(R.regs);
      R.de = p ? p.de : '';
      R.ate = p ? p.ate : '';
      R.abertos = new Set();
    }
    return v;
  }
  function subtitulo(v) { return `${v.modelo} · ${v.placa}`; }

  function periodoHtml(prefixo) {
    return '<div class="periodo">' +
      `<div><label for="${prefixo}-de">De</label><button type="button" class="campo-data" id="${prefixo}-de"></button></div>` +
      `<div><label for="${prefixo}-ate">Até</label><button type="button" class="campo-data" id="${prefixo}-ate"></button></div></div>`;
  }
  function preencherPeriodo(prefixo) {
    U().definirData($(prefixo + '-de'), R.de);
    U().definirData($(prefixo + '-ate'), R.ate);
  }
  function aoMudarPeriodo(prefixo, e, render) {
    const de = $(prefixo + '-de').value;
    const ate = $(prefixo + '-ate').value;
    R.de = de; R.ate = ate;
    // "De" depois do "Até" (ou o contrário): o outro acompanha
    if (R.de && R.ate && R.de > R.ate) { if (e.target.id === prefixo + '-de') R.ate = R.de; else R.de = R.ate; }
    R.abertos = new Set();
    render();
  }

  // ---- Relatório (escolher Gastos ou Desempenho) ----
  async function renderMenu(dados) {
    const v = await U().veiculoAtivo(dados.veiculoId);
    if (!v) return false;
    $('rl-sub').textContent = subtitulo(v);
    return true;
  }

  // ---- Gastos ----
  async function renderGastos(dados) {
    const v = await prepararVeiculo(dados);
    if (!v) return false;
    $('rg-sub').textContent = subtitulo(v);
    if (R.mudou || !$('rg-corpo').innerHTML) desenharGastos();
    return true;
  }
  function desenharGastos() {
    const corpo = $('rg-corpo');
    if (!R.de) { corpo.innerHTML = '<div class="vazio">Nenhum gasto lançado neste veículo ainda.</div>'; return; }
    const g = calcularGastos(R.regs, R.de, R.ate);
    let html = periodoHtml('rg') +
      `<div class="abas-rel" role="tablist"><button type="button" role="tab" data-aba="lista" class="${R.aba === 'lista' ? 'ativa' : ''}">Lista</button>` +
      `<button type="button" role="tab" data-aba="grafico" class="${R.aba === 'grafico' ? 'ativa' : ''}">Gráfico</button></div>`;
    if (!g.abastecimentos.qtd && !g.manutencoes.qtd && !g.despesas.qtd) {
      html += '<div class="vazio">Nenhum gasto neste período.</div>';
    } else if (R.aba === 'lista') {
      const grupo = (chave, titulo, dadosG, cab, linha) => {
        const aberto = R.abertos.has(chave) && dadosG.qtd > 0;
        let h = `<div class="grupo${aberto ? ' aberto' : ''}"><button type="button" class="grupo-topo" data-grupo="${chave}"${dadosG.qtd ? '' : ' disabled'}>` +
          `<span>${titulo} <small>(${dadosG.qtd})</small></span><span><b>${brl(dadosG.total)}</b>${dadosG.qtd ? ` <span class="setinha">${aberto ? '▲' : '▼'}</span>` : ''}</span></button>`;
        if (aberto) h += cab + dadosG.itens.map(linha).join('');
        return h + '</div>';
      };
      const esc = App().esc;
      html += grupo('abast', '⛽ Abastecimentos', g.abastecimentos,
        '<div class="lin4 cab"><span>Data</span><span>Valor litro</span><span>Litros</span><span>Total</span></div>',
        r => `<div class="lin4"><span>${dataAA(r.data)}</span><span>${Number(r.precoLitro) > 0 ? 'R$ ' + num(r.precoLitro, 3) + '/L' : '—'}</span>` +
          `<span>${litros(r) ? num(r.litros, 3) + ' L' : '—'}</span><b>${brl(valor(r))}</b></div>`);
      html += grupo('manut', '🔧 Manutenções', g.manutencoes,
        '<div class="lin4 cab"><span>Data</span><span>Descrição</span><span>Km</span><span>Total</span></div>',
        r => {
          // V12: com 2 itens ou mais, tocar na linha abre a lista dos itens logo abaixo
          const varios = (r.itens || []).filter(i => i && i.nome).length >= 2;
          const ab = varios && R.itensAbertos.has(r.id);
          return `<div class="lin4${varios ? ' tem-itens' : ''}${ab ? ' aberta' : ''}"${varios ? ` data-itens="${esc(r.id)}" role="button" tabindex="0"` : ''}>` +
            `<span>${dataAA(r.data)}</span><span class="quebra">${esc(nomeManutencaoRel(r))}${varios ? `<span class="seta-it">${ab ? '▲' : '▼'}</span>` : ''}</span>` +
            `<span>${temKm(r) ? km(r.hodometro) : '—'}</span><b>${brl(valor(r))}</b></div>` + (ab ? caixaItensMan(r) : '');
        });
      html += grupo('desp', '🧾 Despesas', g.despesas,
        '<div class="lin3 cab"><span>Data</span><span>Tipo</span><span>Total</span></div>',
        r => `<div class="lin3"><span>${dataAA(r.data)}</span><span>${esc(NOME_TIPO[r.tipo] || r.tipo)}</span><b>${brl(valor(r))}</b></div>`);
      html += `<div class="total-rel">Total <b>${brl(g.total)}</b></div><p class="dica centro">Arraste para o lado para ver o gráfico.</p>`;
    } else {
      const maior = Math.max(g.abastecimentos.total, g.manutencoes.total, g.despesas.total) || 1;
      const barra = (titulo, t) => {
        const pct = g.total > 0 ? Math.round(t / g.total * 100) : 0;
        return `<div class="barra-rel"><div class="barra-topo"><span>${titulo}</span><span><b>${brl(t)}</b> · ${pct}%</span></div>` +
          `<div class="trilho"><div style="width:${Math.max(t > 0 ? 2 : 0, Math.round(t / maior * 100))}%"></div></div></div>`;
      };
      html += '<div class="grafico-rel">' + barra('⛽ Abastecimentos', g.abastecimentos.total) + barra('🔧 Manutenções', g.manutencoes.total) +
        barra('🧾 Despesas', g.despesas.total) + `<div class="total-rel">Total <b>${brl(g.total)}</b></div></div>` +
        '<p class="dica centro">Arraste para o lado para ver a lista.</p>';
    }
    corpo.innerHTML = html;
    preencherPeriodo('rg');
  }
  function trocarAba(aba) {
    if (aba === R.aba) return;
    R.aba = aba;
    desenharGastos();
  }

  // ---- Desempenho ----
  async function renderDesempenho(dados) {
    const v = await prepararVeiculo(dados);
    if (!v) return false;
    $('rd-sub').textContent = subtitulo(v);
    const ordemSalva = await Banco.lerConfig('ordemDesempenho', 'recentes');
    if (ordemSalva !== R.ordem) { R.ordem = ordemSalva; R.mudou = true; }
    if (R.mudou || !$('rd-corpo').innerHTML) desenharDesempenho();
    else rolarGraficosAoFim();
    return true;
  }
  function linhaDetalhe(r) {
    return `<div class="det-lin"><span>${dataAA(r.data)}</span><span>${temKm(r) ? km(r.hodometro) : '—'}</span>` +
      `<span>${litros(r) ? num(r.litros, 1) + ' L' : '—'}</span><span>${Number(r.precoLitro) > 0 ? 'R$ ' + num(r.precoLitro, 2) + '/L' : '—'}</span></div>`;
  }
  const CAB_DETALHE = '<div class="det-lin cab"><span>Data</span><span>Hodômetro</span><span>Litros</span><span>Valor litro</span></div>';
  function desenharDesempenho() {
    const corpo = $('rd-corpo');
    if (!R.de) { corpo.innerHTML = '<div class="vazio">Nenhum gasto lançado neste veículo ainda.</div>'; return; }
    const d = calcularDesempenho(R.regs, R.de, R.ate);
    const aprox = d.aproximado && !d.semDados;
    const pre = aprox ? '≈ ' : '';
    let html = periodoHtml('rd');
    html += '<div class="numeros dois">' +
      `<div><small>Km rodados</small><b>${d.kmRodados != null ? km(d.kmRodados) : '—'}</b>${d.kmPorDia != null ? `<small>${num(Math.round(d.kmPorDia), 0)} km por dia</small>` : ''}</div>` +
      `<div><small>Consumo médio</small><b>${d.consumo != null ? pre + num(d.consumo, 1) + ' km/L' : '—'}</b>` +
      (d.consumo == null ? '' : aprox ? '<span class="selo aguardando">média aproximada</span>' : '<small>de tanque cheio a tanque cheio</small>') + '</div>' +
      `<div><small>Custo do combustível</small><b>${d.custoCombKm != null ? brl(d.custoCombKm) + '/km' : '—'}</b></div>` +
      `<div><small>Custo total</small><b>${d.custoTotalKm != null ? brl(d.custoTotalKm) + '/km' : '—'}</b><small>com manutenções e despesas</small></div></div>`;
    if (d.semDados) {
      html += '<div class="grupo"><p class="dica centro sem-margem">Ainda não dá para calcular o consumo: são precisos pelo menos 2 abastecimentos com o hodômetro neste período.</p></div>';
    }
    if (d.abastecimentos) {
      const c = d.combustivel;
      html += '<div class="grupo"><div class="grupo-titulo">⛽ Combustível</div>' +
        `<div class="lin2"><span>Litros abastecidos</span><b>${num(c.litros, 1)} L</b></div>` +
        `<div class="lin2"><span>Preço médio pago</span><b>${c.precoMedio != null ? brl(c.precoMedio) + '/L' : '—'}</b></div>` +
        (c.barato ? `<div class="lin2"><span>Mais barato</span><b>${brl(c.barato.precoLitro)}/L · ${dataAA(c.barato.data)}</b></div>` : '') +
        (c.caro ? `<div class="lin2"><span>Mais caro</span><b>${brl(c.caro.precoLitro)}/L · ${dataAA(c.caro.data)}</b></div>` : '') + '</div>';
    }
    if (d.etanolGasolina) {
      const eg = d.etanolGasolina;
      const custo = (x) => (x.custoKm != null ? brl(x.custoKm) + '/km' : '—');
      let conclusao = '';
      if (eg.etanol.custoKm != null && eg.gasolina.custoKm != null && eg.etanol.custoKm !== eg.gasolina.custoKm) {
        const barato = eg.etanol.custoKm < eg.gasolina.custoKm ? 'o etanol' : 'a gasolina';
        const dif = Math.abs(eg.etanol.custoKm - eg.gasolina.custoKm) / Math.max(eg.etanol.custoKm, eg.gasolina.custoKm);
        conclusao = `<div class="conclusao">✓ No seu veículo, ${barato} saiu ${dif < 0.1 ? 'um pouco ' : ''}mais ${barato === 'o etanol' ? 'barato' : 'barata'} por km.</div>`;
      }
      html += `<div class="grupo"><div class="grupo-titulo">Etanol x gasolina${aprox ? ' <span class="selo aguardando">aproximado</span>' : ''}</div>` +
        '<div class="lin3 cab"><span></span><span>Consumo</span><span>Custo</span></div>' +
        `<div class="lin3"><span>Etanol</span><span>${pre}${num(eg.etanol.kml, 1)} km/L</span><b>${custo(eg.etanol)}</b></div>` +
        `<div class="lin3"><span>Gasolina</span><span>${pre}${num(eg.gasolina.kml, 1)} km/L</span><b>${custo(eg.gasolina)}</b></div>` + conclusao + '</div>';
    }
    if (d.blocos.length >= 2) { // V11: consumo a cada ~1.000 km (valores dentro das barras e a linha da média)
      const maior = Math.max(...d.blocos.map(b => b.kml));
      const alt = Math.round(d.mediaBlocos / maior * 100);
      const q = d.quedaBlocos;
      html += '<div class="grupo"><div class="grupo-titulo">Consumo a cada ~1.000 km <span class="selo aguardando">aproximado</span></div>' +
        '<div class="rolar-graf"><div class="colunas largas">' +
        d.blocos.map(b => `<div class="col"><div class="c${b.baixo ? ' baixo' : ''}" style="height:${Math.max(24, Math.round(b.kml / maior * 100))}px">` +
          `<span class="vin">${num(b.kml, 1)}</span></div><span class="d">${dataAA(b.ate)}</span></div>`).join('') +
        `<div class="linha-media" style="bottom:${alt + 19}px"></div></div></div>` +
        `<div class="legenda-media"><span class="tracejado"></span> média: ${num(d.mediaBlocos, 1)} km/L</div>` +
        (q ? `<div class="aviso-rel">⚠️ Nos últimos ${km(q.km)} o consumo caiu ${q.pct}%: ${num(q.agora, 1)} km/L (antes fazia ${num(q.antes, 1)} km/L).</div>` : '') +
        '<div class="como-calc">Conta aproximada: os litros que você colocou ÷ os km rodados até o abastecimento seguinte, em blocos de uns 1.000 km. ' +
        'Como o tanque nem sempre é completado, o aviso só aparece quando a queda passa de 15%: assim não dá alarme falso.</div></div>';
    }
    if (d.barras.length) {
      const maior = Math.max(...d.barras.map(b => b.kml));
      html += '<div class="grupo"><div class="grupo-titulo">Consumo de cada tanque</div><div class="rolar-graf"><div class="colunas largas">' +
        d.barras.map(b => `<div class="col"><span class="v">${num(b.kml, 1)}</span><div class="c${b.baixo ? ' baixo' : ''}" style="height:${Math.max(6, Math.round(b.kml / maior * 100))}px"></div>` +
          `<span class="d">${dataAA(b.data)}</span></div>`).join('') + '</div></div>' +
        (d.queda ? `<div class="aviso-rel">⚠️ No último tanque o consumo caiu ${d.queda.pct}% (${num(d.queda.kml, 1)} km/L).</div>` : '') + '</div>';
    }
    if (d.tanques.length) {
      html += `<div class="grupo"><div class="grupo-titulo">Média por tanque(s) ${botaoOrdem()}</div>`;
      const abertoT = d.tanqueAberto ? `<div class="tanque em-aberto"><div><div class="tq-datas">Desde ${dataAA(d.tanqueAberto.desde)}</div>` +
        `<div class="tq-meta">${plural(d.tanqueAberto.n, '1 abastecimento', '# abastecimentos')} · fecha no próximo tanque cheio</div></div><div class="tq-kml">—</div></div>` : '';
      if (R.ordem !== 'antigos') html += abertoT; // o que ainda está aberto é o mais recente
      emOrdem(d.tanques.map((t, i) => [t, i])).forEach(([t, i]) => {
        const chave = 't' + i + '|' + t.de + '|' + t.ate;
        const podeAbrir = t.n > 1;
        const aberto = podeAbrir && R.abertos.has(chave);
        html += `<div class="tanque${aberto ? ' aberto' : ''}${podeAbrir ? ' abre' : ''}"${podeAbrir ? ` data-abrir="${chave}" role="button"` : ''}>` +
          `<div><div class="tq-datas">${dataAA(t.de)} → ${dataAA(t.ate)}</div><div class="tq-meta">${km(t.km)} · ${num(t.litros, 1)} L · ${plural(t.n, '1 abastecimento', '# abastecimentos')}</div></div>` +
          `<div class="tq-kml">${num(t.kml, 1)} <small>km/L</small>${podeAbrir ? ` <span class="setinha">${aberto ? '▲' : '▼'}</span>` : ''}</div></div>`;
        if (aberto) {
          html += '<div class="tq-detalhe">' + CAB_DETALHE +
            `<div class="det-lin inicio"><span>${dataAA(t.inicio.data)}</span><span>${km(t.inicio.hodometro)}</span><span>início (tanque cheio)</span></div>` +
            t.itens.map(linhaDetalhe).join('') + '<div class="det-tag">⛽ tanque cheio</div></div>';
        }
      });
      if (R.ordem === 'antigos') html += abertoT;
      html += '</div>';
    } else if (!d.semDados && (d.meses.length || d.mesAberto)) {
      html += `<div class="grupo"><div class="grupo-titulo">Média aproximada por mês ${botaoOrdem()}</div>`;
      const a = d.mesAberto;
      const abertoM = a ? `<div class="tanque em-aberto"><div><div class="tq-datas">${a.juntoDeOutro ? 'Desde ' + dataAA(a.desde) : mesLongo(a.mes)}</div>` +
        `<div class="tq-meta">${num(a.litros, 1)} L · ${plural(a.n, '1 abastecimento', '# abastecimentos')} · fecha no próximo abastecimento</div></div><div class="tq-kml">—</div></div>` : '';
      if (R.ordem !== 'antigos') html += abertoM;
      emOrdem(d.meses).forEach((m) => {
        const chave = 'm' + m.mes;
        const aberto = R.abertos.has(chave);
        html += `<div class="tanque abre${aberto ? ' aberto' : ''}" data-abrir="${chave}" role="button"><div><div class="tq-datas">${mesLongo(m.mes)}</div>` +
          `<div class="tq-meta">${km(m.km)} · ${num(m.litros, 1)} L · ${plural(m.n, '1 abastecimento', '# abastecimentos')}</div></div>` +
          `<div class="tq-kml">≈ ${num(m.kml, 1)} <small>km/L</small> <span class="setinha">${aberto ? '▲' : '▼'}</span></div></div>`;
        if (aberto) html += '<div class="tq-detalhe">' + CAB_DETALHE + m.itens.map(linhaDetalhe).join('') + '</div>';
      });
      if (R.ordem === 'antigos') html += abertoM;
      html += '</div>';
    }
    corpo.innerHTML = html;
    preencherPeriodo('rd');
    rolarGraficosAoFim();
  }
  // V11: os gráficos abrem no mais recente (à direita); a pessoa arrasta para ver os de antes
  function rolarGraficosAoFim() {
    const ir = () => document.querySelectorAll('#rd-corpo .rolar-graf').forEach((x) => { x.scrollLeft = x.scrollWidth; });
    ir();
    requestAnimationFrame(ir);
    setTimeout(ir, 120);
  }
  // V11: ordem das listas (⇅), lembrada
  function botaoOrdem() {
    return `<button class="ordem-btn" type="button" data-ordem>⇅ ${R.ordem === 'antigos' ? 'Mais antigos primeiro' : 'Mais recentes primeiro'}</button>`;
  }
  function emOrdem(lista) { return R.ordem === 'antigos' ? lista : lista.slice().reverse(); }

  /** Telas do relatório: devolve false se o veículo não existe mais. */
  async function preparar(tela, dados) {
    if (tela === 'v-relatorio') return renderMenu(dados || {});
    if (tela === 'v-gastos') return renderGastos(dados || {});
    if (tela === 'v-desempenho') return renderDesempenho(dados || {});
    return false;
  }

  function ligar() {
    $('rl-opcoes').addEventListener('click', (e) => {
      if (e.target.closest('#rl-exportar')) { Exportar.abrir((App().dadosTela() || {}).veiculoId); return; } // V8
      const b = e.target.closest('[data-rel]');
      if (!b) return;
      limpar(); // cada vez que abre, começa no período completo
      Veiculos.ir(b.dataset.rel, { veiculoId: (App().dadosTela() || {}).veiculoId });
    });
    // Gastos: período, abas, grupos e arrastar para o lado
    const rg = $('rg-corpo');
    rg.addEventListener('click', (e) => {
      const li = e.target.closest('[data-itens]');
      if (li) { // V12: abre ou fecha os itens da manutenção
        const id = li.dataset.itens;
        if (R.itensAbertos.has(id)) R.itensAbertos.delete(id); else R.itensAbertos.add(id);
        const y = window.scrollY;
        desenharGastos();
        window.scrollTo(0, y);
        return;
      }
      const b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('campo-data')) { U().abrirCalendario(b); return; }
      if (b.dataset.aba) { trocarAba(b.dataset.aba); return; }
      if (b.dataset.grupo) {
        if (R.abertos.has(b.dataset.grupo)) R.abertos.delete(b.dataset.grupo); else R.abertos.add(b.dataset.grupo);
        desenharGastos();
      }
    });
    rg.addEventListener('change', (e) => { if (e.target.classList.contains('campo-data')) aoMudarPeriodo('rg', e, desenharGastos); });
    let toque = null;
    $('tela-v-gastos').addEventListener('touchstart', (e) => {
      toque = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, x1: e.touches[0].clientX, y1: e.touches[0].clientY } : null;
    }, { passive: true });
    $('tela-v-gastos').addEventListener('touchmove', (e) => {
      if (toque && e.touches.length === 1) { toque.x1 = e.touches[0].clientX; toque.y1 = e.touches[0].clientY; }
    }, { passive: true });
    const soltar = () => {
      if (!toque) return;
      const dx = toque.x1 - toque.x;
      const dy = toque.y1 - toque.y;
      toque = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      trocarAba(dx < 0 ? 'grafico' : 'lista'); // para a esquerda: gráfico; para a direita: lista
    };
    $('tela-v-gastos').addEventListener('touchend', soltar, { passive: true });
    $('tela-v-gastos').addEventListener('touchcancel', soltar, { passive: true });
    // Desempenho: período e abrir os trechos
    const rd = $('rd-corpo');
    rd.addEventListener('click', (e) => {
      const b = e.target.closest('button.campo-data');
      if (b) { U().abrirCalendario(b); return; }
      if (e.target.closest('[data-ordem]')) { // V11: ⇅ inverte a ordem e lembra
        R.ordem = R.ordem === 'antigos' ? 'recentes' : 'antigos';
        Banco.gravarConfig('ordemDesempenho', R.ordem);
        const y = window.scrollY;
        desenharDesempenho();
        window.scrollTo(0, y);
        return;
      }
      const t = e.target.closest('[data-abrir]');
      if (!t) return;
      if (R.abertos.has(t.dataset.abrir)) R.abertos.delete(t.dataset.abrir); else R.abertos.add(t.dataset.abrir);
      const y = window.scrollY;
      desenharDesempenho();
      window.scrollTo(0, y);
    });
    rd.addEventListener('change', (e) => { if (e.target.classList.contains('campo-data')) aoMudarPeriodo('rd', e, desenharDesempenho); });
    ['rl-voltar', 'rg-voltar', 'rd-voltar'].forEach((id) => { $(id).onclick = () => App().voltar(); });
  }
  ligar();

  return {
    preparar, limpar, abaAtual: () => R.aba,
    periodoAtual: () => (R.de ? { de: R.de, ate: R.ate } : null),
    dadosPlanilha, mesesEntre, avisoConsumo, // V11
    // usados nos testes
    calcularGastos, calcularDesempenho, periodoPadrao, blocosDeConsumo
  };
})();
