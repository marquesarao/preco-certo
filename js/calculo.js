/** "Não sei" o cartão do cliente. String vazia: nenhum cartão pode ter nome vazio. */
var NAO_SEI = '';

/** Campos de taxa de cada cartão (Débito, 1x … 12x) — mesma ordem do backend (CAMPOS_TAXA_). */
var CAMPOS_TAXA = ['debito', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12'];
var FORMAS = CAMPOS_TAXA.map(function (campo) {
  return campo === 'debito'
    ? { campo: campo, forma: 'Débito', parcelas: 1, rotulo: 'Débito' }
    : { campo: campo, forma: 'Crédito', parcelas: Number(campo.slice(1)), rotulo: campo.slice(1) + 'x' };
});

// Limites: espelho EXATO do backend (Codigo.gs).
var MAX_VALOR = 1e9;
var MAX_TAXA = 99;
var MAX_ACRESCIMO = 1000;
var MAX_GASTOS = 200;
var MAX_CARTOES = 12;
var MAX_NOME_CARTAO = 30;
var LIMITES_PARAMETROS = {
  diasPorSemana:        { min: 1, max: 7 },
  horasPorDia:          { min: 0, max: 24, minExclusivo: true },
  horasCobradasPorDia:  { min: 0, max: 24, minExclusivo: true },
  valorHoraCobrado:     { min: 0, max: MAX_VALOR },
  impostoPercentual:    { min: 0, max: MAX_TAXA },
  acrescimoPecasPadrao: { min: 0, max: MAX_ACRESCIMO }
};
var LIMITE_TAXA = { min: 0, max: MAX_TAXA };
var LIMITE_VALOR_GASTO = { min: 0, max: MAX_VALOR };
// Só do orçamento (não vai para a planilha).
var LIMITE_HORAS_SERVICO = { min: 0, max: 10000 };
var LIMITE_VALOR_ORCAMENTO = { min: 0, max: MAX_VALOR };
var LIMITE_ACRESCIMO = LIMITES_PARAMETROS.acrescimoPecasPadrao;

var MENSAGENS_PARAMETROS = {
  diasPorSemana: 'Use um número de 1 a 7.',
  horasPorDia: 'Use um número maior que 0 e até 24.',
  horasCobradasPorDia: 'Use um número maior que 0 e até 24.',
  valorHoraCobrado: 'Digite um valor igual ou maior que zero.',
  impostoPercentual: 'Use um número de 0 a 99.',
  acrescimoPecasPadrao: 'Use um número de 0 a 1000.'
};
var MENSAGEM_NAO_NUMERO = 'Digite só números. Ex.: 150,50';

var FORMATO_BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Texto brasileiro → número. MESMAS regras do lerNumeroBR_ do backend:
 * "150,50" → 150.5 · "1.234,56" → 1234.56 · "R$ 1.234,56" → 1234.56 · "7,57%" → 7.57
 * sem vírgula: "1.234" → 1234 (milhar) · "1.5" → 1.5 (decimal) · vazio/inválido → null
 */
function lerNumeroBR(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var s = String(v).trim().replace(/^R\$/i, '').replace(/[\s%]/g, '');
  if (s === '') return null;
  if (s.indexOf(',') >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  var n = Number(s);
  return isFinite(n) ? n : null;
}

function dentroDoLimite(n, lim) {
  if (typeof n !== 'number' || !isFinite(n)) return false;
  if (lim.minExclusivo ? n <= lim.min : n < lim.min) return false;
  return n <= lim.max;
}

/**
 * Valida o texto de um campo numérico.
 * @return {{valor: number|null, erro: string}}  erro vazio = válido
 */
function validarNumeroCampo(texto, lim, opcoes) {
  var t = texto === null || texto === undefined ? '' : String(texto).trim();
  if (t === '') {
    return opcoes.vazioPermitido ? { valor: null, erro: '' } : { valor: null, erro: 'Preencha este campo.' };
  }
  var n = lerNumeroBR(t);
  if (n === null) return { valor: null, erro: MENSAGEM_NAO_NUMERO };
  if (!dentroDoLimite(n, lim)) return { valor: null, erro: opcoes.mensagem };
  return { valor: n, erro: '' };
}

/** Horas cobradas: limite próprio + não pode passar das horas de trabalho. */
function validarHorasCobradas(texto, horasPorDia) {
  var r = validarNumeroCampo(texto, LIMITES_PARAMETROS.horasCobradasPorDia,
    { vazioPermitido: false, mensagem: MENSAGENS_PARAMETROS.horasCobradasPorDia });
  if (!r.erro && typeof horasPorDia === 'number' && r.valor > horasPorDia) {
    return { valor: null, erro: 'Não pode passar das horas de trabalho por dia (' + numeroParaCampo(horasPorDia, false) + ').' };
  }
  return r;
}

/** "10, 5,5" → {texto: "5,10", invalidas: false}. Mesmas regras do backend. */
function normalizarParcelas(s) {
  var invalidas = false;
  var vistos = {};
  String(s === null || s === undefined ? '' : s).split(/[,;\s]+/).forEach(function (parte) {
    if (parte === '') return;
    if (!/^\d+$/.test(parte)) { invalidas = true; return; }
    var n = Number(parte);
    if (n < 1 || n > 12) { invalidas = true; return; }
    vistos[n] = true;
  });
  var lista = Object.keys(vistos).map(Number).sort(function (a, b) { return a - b; });
  return { texto: lista.join(','), invalidas: invalidas };
}

function listaParcelas(texto) {
  var t = normalizarParcelas(texto).texto;
  return t === '' ? [] : t.split(',').map(Number);
}

/**
 * Reais → centavos inteiros, arredondamento comercial (meio centavo sobe, longe do zero).
 * toPrecision(15) remove o ruído de ponto flutuante (ex.: 528,485 × 100 = 52848,49999…).
 */
function centavos(valor) {
  if (typeof valor !== 'number' || !isFinite(valor)) return 0;
  var x = Number((Math.abs(valor) * 100).toPrecision(15));
  var r = Math.round(x) * (valor < 0 ? -1 : 1);
  return r === 0 ? 0 : r; // evita "-0"
}

function formatarCentavos(c) {
  return FORMATO_BRL.format(c / 100).split(String.fromCharCode(160)).join(' ');
}

function formatarBRL(valor) {
  return formatarCentavos(centavos(valor));
}

/** Número → texto do campo. dinheiro: "2.000,00"; senão: "5,5". null → "". */
function numeroParaCampo(n, dinheiro) {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  if (dinheiro) {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }
  return String(Math.round(n * 10000) / 10000).replace('.', ',');
}

/** Horas por extenso, sem zeros desnecessários: "8 horas", "6,5 horas", "1 hora", "6,67 horas". */
function formatarHoras(h) {
  var texto = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(h);
  return texto + (texto === '1' ? ' hora' : ' horas');
}

function horasCobradasMes(p) {
  return p.horasCobradasPorDia * p.diasPorSemana * 52 / 12;
}

/** Soma dos gastos (valor vazio conta 0). tipo opcional: 'Oficina' ou 'Casa'. */
function totalGastos(gastos, tipo) {
  return gastos.reduce(function (soma, g) {
    if (tipo && g.tipo !== tipo) return soma;
    return soma + (typeof g.valor === 'number' ? g.valor : 0);
  }, 0);
}

/** Sem arredondar. Horas cobradas no mês = 0 → 0 (sem erro). */
function precoMinimoHora(gastos, p) {
  var h = horasCobradasMes(p);
  return h > 0 ? totalGastos(gastos) / h : 0;
}

/**
 * Mão de obra e horas do serviço.
 * entrada.modo 'horas': horas × valor da hora.
 * entrada.modo 'fechado': valor digitado; horas vazias → valor ÷ valor da hora (horasEstimadas = true).
 */
function calcularMaoDeObra(entrada, valorHoraCobrado) {
  var horas = typeof entrada.horas === 'number' ? entrada.horas : null;
  if (entrada.modo === 'fechado') {
    var valor = typeof entrada.valorFechado === 'number' ? entrada.valorFechado : 0;
    if (horas !== null) return { maoDeObra: valor, horas: horas, horasEstimadas: false };
    if (valorHoraCobrado > 0 && valor > 0) {
      return { maoDeObra: valor, horas: valor / valorHoraCobrado, horasEstimadas: true };
    }
    return { maoDeObra: valor, horas: 0, horasEstimadas: false };
  }
  var h = horas === null ? 0 : horas;
  return { maoDeObra: h * valorHoraCobrado, horas: h, horasEstimadas: false };
}

/**
 * Quanto o cliente paga pelas peças (sem arredondar).
 * entrada.pecasModo 'acrescimo': paga × (1 + acréscimo/100); acréscimo vazio = 0%.
 * Outro modo (ou ausente): valor digitado; vazio = o que você paga.
 */
function calcularPecasCobrar(entrada) {
  var pagar = typeof entrada.pecasPagar === 'number' ? entrada.pecasPagar : 0;
  if (entrada.pecasModo === 'acrescimo') {
    var acrescimo = typeof entrada.pecasAcrescimo === 'number' ? entrada.pecasAcrescimo : 0;
    return pagar * (1 + acrescimo / 100);
  }
  return typeof entrada.pecasCobrar === 'number' ? entrada.pecasCobrar : pagar;
}

// ---------------- Peças discriminadas ----------------
var MAX_PECAS = 30;
var LIMITE_QTD_PECA = { min: 0, max: 9999 }; // e maior que zero
var MENSAGEM_QTD_PECA = 'Quantidade maior que zero. Ex.: 2 ou 4,5';

/** Quantidade de uma peça: obrigatória, maior que zero, aceita decimal ("4,5"). */
function validarQtdPeca(texto) {
  var r = validarNumeroCampo(texto, LIMITE_QTD_PECA, { vazioPermitido: false, mensagem: MENSAGEM_QTD_PECA });
  if (r.erro) return { valor: null, erro: r.erro === MENSAGEM_NAO_NUMERO ? r.erro : MENSAGEM_QTD_PECA };
  if (!(r.valor > 0)) return { valor: null, erro: MENSAGEM_QTD_PECA };
  return r;
}

/** Quanto você paga pelas peças: Σ qtd × valor unitário (itens com número inválido contam 0). Sem arredondar. */
function totalPecasItens(itens) {
  return (itens || []).reduce(function (soma, it) {
    var q = typeof it.qtd === 'number' && it.qtd > 0 ? it.qtd : 0;
    var v = typeof it.valor === 'number' && it.valor > 0 ? it.valor : 0;
    return soma + q * v;
  }, 0);
}

/**
 * Linhas "Peças inclusas" do WhatsApp, SEM valores: "2× Pastilha de freio", "4,5× Óleo 5W30".
 * Item sem descrição (ou com quantidade inválida) não aparece (mas entra no cálculo, se tiver número).
 */
function linhasPecasWhatsApp(itens) {
  return (itens || []).filter(function (it) {
    return String(it.descricao || '').trim() !== '' && typeof it.qtd === 'number' && it.qtd > 0;
  }).map(function (it) {
    return numeroParaCampo(it.qtd, false) + '× ' + String(it.descricao).trim();
  });
}

// ---------------- Cartões ----------------

/** Faixa Unicode dos acentos combinantes (U+0300 a U+036F), escrita por código para ficar legível. */
var RE_ACENTOS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

/** Chave para comparar nomes sem diferenciar maiúsculas, acentos e espaços repetidos (igual a chaveNome_ do backend). */
function chaveNome(s) {
  return String(s === null || s === undefined ? '' : s).normalize('NFD').replace(RE_ACENTOS, '')
    .trim().toLowerCase().replace(/\s+/g, ' ');
}

function cartaoVazio(nome) {
  var cartao = { nome: nome };
  CAMPOS_TAXA.forEach(function (campo) { cartao[campo] = null; });
  return cartao;
}

function cartaoTodoVazio(cartao) {
  return CAMPOS_TAXA.every(function (campo) { return typeof cartao[campo] !== 'number'; });
}

/** Posição do cartão pelo nome (sem diferenciar maiúsculas/acentos); -1 se não existe. */
function acharCartao(cartoes, nome) {
  var chave = chaveNome(nome);
  for (var i = 0; i < cartoes.length; i++) if (chaveNome(cartoes[i].nome) === chave) return i;
  return -1;
}

/**
 * Cartão que vale no cálculo: com UM só cartão, é ele (sem escolha);
 * senão, o escolhido se existir; senão "Não sei".
 */
function cartaoEfetivo(cartoes, escolhido) {
  if (cartoes.length === 1) return cartoes[0].nome;
  if (escolhido === NAO_SEI || escolhido === null || escolhido === undefined) return NAO_SEI;
  var i = acharCartao(cartoes, escolhido);
  return i >= 0 ? cartoes[i].nome : NAO_SEI;
}

/**
 * Taxa (%) de uma forma (campo) para o cartão. null = sem taxa (a forma não aparece).
 * "Não sei": a MAIOR taxa entre os cartões que têm aquela forma preenchida.
 */
function taxaDaForma(cartoes, campo, cartao) {
  if (cartao === NAO_SEI) {
    var maior = null;
    cartoes.forEach(function (c) {
      var t = c[campo];
      if (typeof t === 'number' && (maior === null || t > maior)) maior = t;
    });
    return maior;
  }
  var i = acharCartao(cartoes, cartao);
  var v = i >= 0 ? cartoes[i][campo] : null;
  return typeof v === 'number' ? v : null;
}

/** Valida o nome de um cartão. indiceProprio: posição do próprio cartão (para não se comparar consigo). '' = válido. */
function validarNomeCartao(nome, cartoes, indiceProprio) {
  var n = String(nome === null || nome === undefined ? '' : nome).trim();
  if (n === '') return 'Dê um nome ao cartão.';
  if (n.length > MAX_NOME_CARTAO) return 'Use no máximo ' + MAX_NOME_CARTAO + ' letras.';
  var i = acharCartao(cartoes, n);
  if (i >= 0 && i !== indiceProprio) return 'Já existe um cartão com esse nome.';
  return '';
}

/**
 * Uma opção de pagamento (regra B):
 * totalExato = aVista ÷ (1 − taxa/100); total = arredondar(totalExato); parcela = arredondar(totalExato ÷ n).
 */
function calcularOpcao(aVista, taxa, n) {
  var totalExato = aVista / (1 - taxa / 100);
  return {
    taxa: taxa,
    parcelas: n,
    totalExato: totalExato,
    totalCentavos: centavos(totalExato),
    parcelaCentavos: centavos(totalExato / n)
  };
}

/**
 * Orçamento completo.
 * @param entrada {modo:'horas'|'fechado', horas, valorFechado,
 *                 pecasPagar, pecasModo:'acrescimo'|'valor', pecasAcrescimo, pecasCobrar} (números ou null)
 * @param parametros {valorHoraCobrado, impostoPercentual, parcelasDestaque}
 * @param cartoes [{nome, debito, p1 … p12}] (null = sem taxa)
 * @param cartaoEscolhido nome do cartão ou NAO_SEI
 * @param precoMinimoHora calculado fora (sem arredondar)
 */
function calcularOrcamento(entrada, parametros, cartoes, cartaoEscolhido, precoMinimoHora) {
  var mo = calcularMaoDeObra(entrada, parametros.valorHoraCobrado);
  var pecasPagar = typeof entrada.pecasPagar === 'number' ? entrada.pecasPagar : 0;
  var pecasCobrar = calcularPecasCobrar(entrada);
  var lucroPecas = pecasCobrar - pecasPagar;
  var aVista = mo.maoDeObra + pecasCobrar;
  var gastoHoras = mo.horas * precoMinimoHora;
  var impostoPct = typeof parametros.impostoPercentual === 'number' ? parametros.impostoPercentual : 0;

  function montar(forma, parcelas, taxa) {
    var op = calcularOpcao(aVista, taxa, parcelas);
    op.forma = forma;
    op.imposto = (op.totalCentavos / 100) * impostoPct / 100;
    op.lucro = mo.maoDeObra - gastoHoras + lucroPecas - op.imposto;
    return op;
  }

  var efetivo = cartaoEfetivo(cartoes, cartaoEscolhido);
  var opcoes = [];
  FORMAS.forEach(function (f) {
    if (!cartoes.length) return;
    var t = taxaDaForma(cartoes, f.campo, efetivo);
    if (t === null) return; // sem taxa: a forma não aparece
    opcoes.push(montar(f.forma, f.parcelas, t));
  });

  var destaques = [];
  listaParcelas(parametros.parcelasDestaque).forEach(function (n) {
    var op = opcoes.filter(function (o) { return o.forma === 'Crédito' && o.parcelas === n; })[0];
    if (op) destaques.push(op);
  });

  return {
    maoDeObra: mo.maoDeObra,
    horas: mo.horas,
    horasEstimadas: mo.horasEstimadas,
    pecasPagar: pecasPagar,
    pecasCobrar: pecasCobrar,
    lucroPecas: lucroPecas,
    gastoHoras: gastoHoras,
    precoMinimoHora: precoMinimoHora,
    aVista: montar('Pix', 1, 0), // Pix: sempre 0%, fixo no código
    opcoes: opcoes,
    destaques: destaques,
    outras: opcoes.filter(function (o) { return destaques.indexOf(o) < 0; }),
    semCartoes: cartoes.length === 0,
    cartao: efetivo,
    // Nome que vai no texto do cliente: só quando há escolha de verdade (2+ cartões e um escolhido).
    cartaoNoTexto: cartoes.length > 1 && efetivo !== NAO_SEI ? efetivo : null
  };
}

// ---------------- Desconto à vista (âncora no cartão) ----------------

/** Desconto padrão deste aparelho (texto guardado no localStorage) → número de 0 a 99; inválido/ausente → 5. */
var DESCONTO_PADRAO_DE_FABRICA = 5;
var LIMITE_DESCONTO = { min: 0, max: 99 };
function descontoPadraoDoAparelho(texto) {
  var n = lerNumeroBR(texto);
  return dentroDoLimite(n, LIMITE_DESCONTO) ? n : DESCONTO_PADRAO_DE_FABRICA;
}

/**
 * Preço com desconto à vista, ancorado no cartão.
 * - Base = res.aVista (mão de obra + peças cobradas): o piso sem perder lucro.
 * - Âncora (preço cheio) = PRIMEIRA parcela em destaque com taxa, no cartão escolhido ("Não sei" = maior taxa).
 *   Sem nenhuma → âncora = base e o desconto não se aplica (temAncora = false).
 * - À vista oferecido = âncora exata × (1 − (desconto + extra)/100); desconto e extra SOMAM, total limitado a 99.
 * - Máximo sem perder lucro = (1 − base ÷ âncora) × 100 (= a taxa da âncora).
 * - Ainda pode dar = máximo − total (mín. 0), em % e em R$ (= oferecido − base, mín. 0).
 * - Acima do máximo: abreMao = base − oferecido (R$ do lucro de que ele abre mão).
 * - Lucro = oferecido − gasto das horas − peças pagas − imposto sobre o oferecido (arredondado, o que o cliente paga).
 * - Piso de prejuízo = (gasto das horas + peças pagas) ÷ (1 − imposto/100).
 * @param res resultado de calcularOrcamento
 * @param parametros {impostoPercentual}
 * @param desconto % oferecido (0 a 99)   @param extra % extra (0 a 99)
 */
function calcularPrecoComDesconto(res, parametros, desconto, extra) {
  var impostoPct = typeof parametros.impostoPercentual === 'number' ? parametros.impostoPercentual : 0;
  var base = res.aVista.totalExato;
  var baseCentavos = res.aVista.totalCentavos;
  var ancora = res.destaques.length ? res.destaques[0] : null;
  var d = typeof desconto === 'number' && desconto > 0 ? desconto : 0;
  var x = typeof extra === 'number' && extra > 0 ? extra : 0;
  var total = ancora ? Math.min(LIMITE_DESCONTO.max, d + x) : 0;

  var precoExato = ancora ? ancora.totalExato * (1 - total / 100) : base;
  var precoCentavos = ancora ? centavos(precoExato) : baseCentavos;
  var maximo = ancora ? (1 - base / ancora.totalExato) * 100 : 0;
  var imposto = (precoCentavos / 100) * impostoPct / 100;
  var lucro = precoCentavos / 100 - res.gastoHoras - res.pecasPagar - imposto;
  var difCentavos = precoCentavos - baseCentavos; // > 0: ainda pode dar; < 0: abre mão do lucro

  return {
    temAncora: !!ancora,
    ancora: ancora,
    descontoTotal: total,
    precoExato: precoExato,
    precoCentavos: precoCentavos,
    maximo: maximo,
    aindaPodePct: Math.max(0, Math.round((maximo - total) * 10000) / 10000),
    aindaPodeCentavos: Math.max(0, difCentavos),
    acimaDoMaximo: difCentavos < 0,
    abreMaoCentavos: Math.max(0, -difCentavos),
    imposto: imposto,
    lucro: lucro,
    piso: (res.gastoHoras + res.pecasPagar) / (1 - impostoPct / 100)
  };
}

/** "5%", "7,5%" (sem zeros desnecessários). */
function formatarPercentual(p) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(p) + '%';
}

/**
 * Texto para o cliente (WhatsApp), ancorado no cartão: primeiro as parcelas em destaque, depois o à vista
 * (com "— X% de desconto" só se houver desconto). Negrito do WhatsApp com *…* no título e no à vista.
 * Sem quebra mão de obra/peças, sem custo, lucro, taxa, piso ou "ainda pode dar";
 * sem nome de cartão quando for "Não sei" (ou quando só há um cartão).
 * @param preco resultado de calcularPrecoComDesconto (opcional: sem ele, à vista = base)
 * @param pecas itens [{descricao, qtd}] (opcional): seção "Peças inclusas:" sem valores
 */
function textoWhatsApp(res, parametros, descricao, preco, pecas) {
  var linhas = [];
  var nome = String(parametros.nomeOficina || '').trim();
  linhas.push(nome ? '*Orçamento – ' + nome + '*' : '*Orçamento*');
  var desc = String(descricao || '').trim();
  if (desc) linhas.push(desc);
  linhas.push('');

  var listaPecas = linhasPecasWhatsApp(pecas);
  if (listaPecas.length) {
    linhas.push('Peças inclusas:');
    listaPecas.forEach(function (l) { linhas.push(l); });
    linhas.push('');
  }

  var cartao = '💳 Cartão' + (res.cartaoNoTexto ? ' ' + res.cartaoNoTexto : '');
  res.destaques.forEach(function (op) {
    if (op.parcelas === 1) {
      linhas.push(cartao + ' em 1x: ' + formatarCentavos(op.totalCentavos));
    } else {
      linhas.push(cartao + ' em até ' + op.parcelas + 'x: ' + formatarCentavos(op.totalCentavos) +
        ' (' + op.parcelas + 'x de ' + formatarCentavos(op.parcelaCentavos) + ')');
    }
  });

  var aVistaCentavos = preco ? preco.precoCentavos : res.aVista.totalCentavos;
  var comDesconto = preco && preco.temAncora && preco.descontoTotal > 0;
  linhas.push('💵 À vista (Pix/dinheiro): *' + formatarCentavos(aVistaCentavos) + '*' +
    (comDesconto ? ' — ' + formatarPercentual(preco.descontoTotal) + ' de desconto' : ''));
  return linhas.join('\n');
}

// ---------------------------------------------------------------------
// Casos de teste (usados pelo autoteste ?teste=1 e pelo teste em Node).
// Fatia 4 completa com T14 e T15. T8–T12 foram substituídos por C1–C8 (cartões cadastráveis).
// ---------------------------------------------------------------------

/** Taxas Visa/Master da InfinitePay usadas como DADO DE TESTE (o padrão oficial fica no backend). */
var VISA_TESTE = { debito: 1.37, p1: 3.15, p2: 5.39, p3: 6.12, p4: 6.85, p5: 7.57, p6: 8.28, p7: 8.99, p8: 9.69, p9: 10.38, p10: 11.06, p11: 11.74, p12: 12.40 };

/** Cartão de teste: nome + taxas informadas (o resto vazio). */
function cartaoDeTeste(nome, taxas) {
  var c = cartaoVazio(nome);
  Object.keys(taxas || {}).forEach(function (k) { c[k] = taxas[k]; });
  return c;
}

function casosDeTeste() {
  function opcao(base, taxa, n) {
    var o = calcularOpcao(base, taxa, n);
    return [o.totalCentavos, o.parcelaCentavos];
  }
  var visa = function () { return cartaoDeTeste('Visa/Master', VISA_TESTE); };
  var paramsT6 = { valorHoraCobrado: 150, impostoPercentual: 0, parcelasDestaque: '5,10' };
  var entradaT6 = { modo: 'horas', horas: 8, valorFechado: null, pecasPagar: 400, pecasCobrar: 500 };
  var entrada1700 = { modo: 'horas', horas: 8, pecasPagar: 500, pecasCobrar: 500 }; // à vista 1.700
  var semMao = { valorHoraCobrado: 150, impostoPercentual: 0, parcelasDestaque: '' };
  function soPecas(pagar, acrescimo) {
    return calcularOrcamento({ modo: 'horas', horas: null, pecasPagar: pagar, pecasModo: 'acrescimo', pecasAcrescimo: acrescimo },
      semMao, [visa()], NAO_SEI, 0);
  }
  function opDe(res, parcelas) {
    return res.opcoes.filter(function (o) { return o.forma === 'Crédito' && o.parcelas === parcelas; })[0] || null;
  }
  return [
    { id: 'T1', descricao: 'Visa, à vista 1.000, 1x 3,15% → total 1.032,52 · parcela 1.032,52 (o app InfinitePay mostra 1.032,53: divergência conhecida e aceita)',
      executar: function () { return { obtido: opcao(1000, 3.15, 1), esperado: [103252, 103252] }; } },
    { id: 'T2', descricao: 'Visa, à vista 1.000, 2x 5,39% → 1.056,97 · 528,49',
      executar: function () { return { obtido: opcao(1000, 5.39, 2), esperado: [105697, 52849] }; } },
    { id: 'T3', descricao: 'Visa, à vista 1.000, 3x 6,12% → 1.065,19 · 355,06',
      executar: function () { return { obtido: opcao(1000, 6.12, 3), esperado: [106519, 35506] }; } },
    { id: 'T4', descricao: 'Visa, à vista 1.000, 4x 6,85% → 1.073,54 · 268,38',
      executar: function () { return { obtido: opcao(1000, 6.85, 4), esperado: [107354, 26838] }; } },
    { id: 'T5', descricao: 'Gastos 4.000 + 3.000; 5 dias × 6 h × 52/12 → 130 h · R$ 53,85',
      executar: function () {
        var gastos = [{ tipo: 'Oficina', descricao: 'A', valor: 4000 }, { tipo: 'Casa', descricao: 'B', valor: 3000 }];
        var p = { diasPorSemana: 5, horasPorDia: 8, horasCobradasPorDia: 6 };
        return { obtido: [horasCobradasMes(p), centavos(precoMinimoHora(gastos, p))], esperado: [130, 5385] };
      } },
    { id: 'T6', descricao: '8 h × 150; preço mínimo da hora 70 (injetado); peças 400 → 500 → à vista 1.700,00 · lucro 740,00',
      executar: function () {
        var r = calcularOrcamento(entradaT6, paramsT6, [visa()], NAO_SEI, 70);
        return { obtido: [r.aVista.totalCentavos, centavos(r.aVista.lucro)], esperado: [170000, 74000] };
      } },
    { id: 'T7', descricao: 'T6 em 5x Visa/Master 7,57% → 1.839,23 · 5× 367,85',
      executar: function () {
        var r = calcularOrcamento(entradaT6, paramsT6, [visa()], 'Visa/Master', 70);
        var op = r.destaques[0];
        return { obtido: [op.parcelas, op.totalCentavos, op.parcelaCentavos], esperado: [5, 183923, 36785] };
      } },
    { id: 'T13', descricao: 'lerNumeroBR("1.234,56"), ("150,50"), ("") → 1234,56 · 150,5 · vazio',
      executar: function () {
        return { obtido: [lerNumeroBR('1.234,56'), lerNumeroBR('150,50'), lerNumeroBR('')], esperado: [1234.56, 150.5, null] };
      } },
    { id: 'C1', descricao: 'Um só cartão (Elo, 5x 8,00): usado direto, sem escolha; nome não vai para o texto do cliente',
      executar: function () {
        var cartoes = [cartaoDeTeste('Elo', { p5: 8 })];
        var semEscolha = calcularOrcamento(entrada1700, paramsT6, cartoes, NAO_SEI, 0);
        var escolhido = calcularOrcamento(entrada1700, paramsT6, cartoes, 'Elo', 0);
        return { obtido: [semEscolha.cartao, semEscolha.cartaoNoTexto, semEscolha.opcoes.length, opDe(semEscolha, 5).totalCentavos, opDe(escolhido, 5).totalCentavos],
                 esperado: ['Elo', null, 1, 184783, 184783] };
      } },
    { id: 'C2', descricao: '"Não sei" com Visa/Master 5x 7,57 e Elo 5x 8,00 → usa 8,00 (1.700 → 1.847,83 · 5× 369,57); 6x (Elo vazio) usa Visa/Master 8,28',
      executar: function () {
        var r = calcularOrcamento(entrada1700, paramsT6, [visa(), cartaoDeTeste('Elo', { p5: 8 })], NAO_SEI, 0);
        var p5 = opDe(r, 5), p6 = opDe(r, 6);
        return { obtido: [p5.taxa, p5.totalCentavos, p5.parcelaCentavos, p6.taxa, r.cartaoNoTexto], esperado: [8, 184783, 36957, 8.28, null] };
      } },
    { id: 'C3', descricao: 'Cartão escolhido com só 5x preenchido → só a linha 5x aparece; nenhum total igual ao à vista por causa de vazio',
      executar: function () {
        var r = calcularOrcamento(entrada1700, paramsT6, [visa(), cartaoDeTeste('Elo', { p5: 8 })], 'elo', 0);
        var totalIgualAVista = r.opcoes.some(function (o) { return o.totalCentavos === r.aVista.totalCentavos; });
        return { obtido: [r.cartao, r.opcoes.length, r.opcoes[0].parcelas, totalIgualAVista], esperado: ['Elo', 1, 5, false] };
      } },
    { id: 'C4', descricao: 'Nome repetido ("Elo" e "elo", "ÉLO") é recusado com mensagem simples; o próprio cartão pode manter o nome',
      executar: function () {
        var cartoes = [cartaoDeTeste('Visa/Master'), cartaoDeTeste('Elo')];
        return { obtido: [validarNomeCartao('elo', cartoes, -1), validarNomeCartao(' ÉLO ', cartoes, 0), validarNomeCartao('Elo', cartoes, 1),
                          validarNomeCartao('  ', cartoes, -1), validarNomeCartao('Cabal', cartoes, -1)],
                 esperado: ['Já existe um cartão com esse nome.', 'Já existe um cartão com esse nome.', '', 'Dê um nome ao cartão.', ''] };
      } },
    { id: 'C5', descricao: 'Nenhum cartão → orçamento só com à vista, sem erro',
      executar: function () {
        var r = calcularOrcamento(entrada1700, paramsT6, [], NAO_SEI, 0);
        return { obtido: [r.semCartoes, r.aVista.totalCentavos, r.opcoes.length, r.destaques.length], esperado: [true, 170000, 0, 0] };
      } },
    { id: 'C8', descricao: 'WhatsApp com cartão "Cabal" escolhido contém "Cartão Cabal"; com "Não sei" não contém nome de cartão',
      executar: function () {
        var cartoes = [visa(), cartaoDeTeste('Cabal', VISA_TESTE)];
        var comCabal = textoWhatsApp(calcularOrcamento(entrada1700, paramsT6, cartoes, 'Cabal', 0), { nomeOficina: '' }, '');
        var naoSei = textoWhatsApp(calcularOrcamento(entrada1700, paramsT6, cartoes, NAO_SEI, 0), { nomeOficina: '' }, '');
        return { obtido: [comCabal.indexOf('💳 Cartão Cabal em até 5x') >= 0, /Cabal|Visa/.test(naoSei), naoSei.indexOf('💳 Cartão em até 5x') >= 0],
                 esperado: [true, false, true] };
      } },
    { id: 'P1', descricao: 'Peças: paga 500 + 47% → cliente paga 735,00',
      executar: function () {
        var r = soPecas(500, 47);
        return { obtido: [centavos(r.pecasCobrar), r.aVista.totalCentavos], esperado: [73500, 73500] };
      } },
    { id: 'P2', descricao: 'Peças: acréscimo 0% → mesmo valor (500,00); acréscimo vazio também',
      executar: function () {
        return { obtido: [centavos(soPecas(500, 0).pecasCobrar), centavos(soPecas(500, null).pecasCobrar)], esperado: [50000, 50000] };
      } },
    { id: 'P3', descricao: 'Peças: 333,33 + 47% = 489,9951 (sem arredondar no meio) → 490,00',
      executar: function () {
        var r = soPecas(333.33, 47);
        return { obtido: [Math.round(r.pecasCobrar * 10000) / 10000, centavos(r.pecasCobrar), r.aVista.totalCentavos], esperado: [489.9951, 49000, 49000] };
      } },
    { id: 'P4', descricao: 'Peças: lucro nas peças = cobrar − pagar (333,33 + 47% → 156,67); 8 h × 150 + peças 400 + 25% → à vista 1.700,00 · lucro 740,00',
      executar: function () {
        var r = soPecas(333.33, 47);
        var t6 = calcularOrcamento({ modo: 'horas', horas: 8, pecasPagar: 400, pecasModo: 'acrescimo', pecasAcrescimo: 25 },
          paramsT6, [visa()], NAO_SEI, 70);
        return { obtido: [centavos(r.lucroPecas), centavos(t6.lucroPecas), t6.aVista.totalCentavos, centavos(t6.aVista.lucro)],
                 esperado: [15667, 10000, 170000, 74000] };
      } },
    { id: 'P5', descricao: 'Peças discriminadas: 2 × 50 + 1 × 350 = 450 pagos; + 47% → cliente paga 661,50',
      executar: function () {
        var pagar = totalPecasItens([{ qtd: 2, valor: 50 }, { qtd: 1, valor: 350 }]);
        var r = soPecas(pagar, 47);
        return { obtido: [centavos(pagar), centavos(r.pecasCobrar), r.aVista.totalCentavos], esperado: [45000, 66150, 66150] };
      } },
    { id: 'P6', descricao: 'Quantidade decimal: 4,5 × 30 = 135 → cliente 198,45; "4,5" aceito; 0, vazio e "-1" recusados',
      executar: function () {
        var pagar = totalPecasItens([{ qtd: 4.5, valor: 30 }]);
        return { obtido: [centavos(pagar), centavos(soPecas(pagar, 47).pecasCobrar), validarQtdPeca('4,5').valor,
                          validarQtdPeca('0').erro !== '', validarQtdPeca('').erro !== '', validarQtdPeca('-1').erro !== ''],
                 esperado: [13500, 19845, 4.5, true, true, true] };
      } },
    { id: 'P7', descricao: 'Lista vazia → peças 0, sem erro; base = só a mão de obra (8 h × 150 = 1.200,00)',
      executar: function () {
        var pagar = totalPecasItens([]);
        var r = calcularOrcamento({ modo: 'horas', horas: 8, pecasPagar: pagar, pecasModo: 'acrescimo', pecasAcrescimo: 47 }, paramsT6, [visa()], NAO_SEI, 0);
        return { obtido: [pagar, centavos(r.pecasCobrar), r.aVista.totalCentavos], esperado: [0, 0, 120000] };
      } },
    { id: 'P9', descricao: 'WhatsApp: "Peças inclusas:" sem nenhum "R$"; "1×" aparece; item sem descrição não aparece; sem peças, sem a seção',
      executar: function () {
        var c = cenarioDesconto();
        var itens = [{ descricao: 'Pastilha de freio', qtd: 2 }, { descricao: 'Disco de freio', qtd: 1 }, { descricao: '  ', qtd: 3 }, { descricao: 'Óleo 5W30', qtd: 4.5 }];
        var texto = textoWhatsApp(c.res, { nomeOficina: 'CliniCar Motors Tech' }, 'Freio – Gol 2015', calcularPrecoComDesconto(c.res, c.params, 5, 0), itens);
        var l = texto.split('\n');
        var i = l.indexOf('Peças inclusas:');
        var secao = l.slice(i, l.indexOf('', i));
        var semPecas = textoWhatsApp(c.res, { nomeOficina: '' }, '', null, []);
        return { obtido: [secao, /R\$/.test(secao.join(' ')), l[i + 5].indexOf('💳 Cartão em até 5x') === 0, /Peças inclusas/.test(semPecas)],
                 esperado: [['Peças inclusas:', '2× Pastilha de freio', '1× Disco de freio', '4,5× Óleo 5W30'], false, true, false] };
      } },
    { id: 'W4', descricao: 'WhatsApp: negrito no título e no à vista; cartão primeiro, à vista por último; sem a quebra mão de obra/peças e sem o acréscimo',
      executar: function () {
        var r = calcularOrcamento({ modo: 'horas', horas: 8, pecasPagar: 500, pecasModo: 'acrescimo', pecasAcrescimo: 47 },
          paramsT6, [visa()], NAO_SEI, 0);
        var texto = textoWhatsApp(r, { nomeOficina: 'CliniCar Motors Tech' }, '');
        var linhas = texto.split('\n');
        var semNome = textoWhatsApp(r, { nomeOficina: '' }, '').split('\n')[0];
        return { obtido: [linhas[0], linhas[2].indexOf('💳 Cartão em até 5x') === 0, linhas[linhas.length - 1], semNome,
                          /Mão de obra|Peças|47/.test(texto)],
                 esperado: ['*Orçamento – CliniCar Motors Tech*', true, '💵 À vista (Pix/dinheiro): *R$ 1.935,00*', '*Orçamento*', false] };
      } },
    // ---- Desconto à vista (cenário: MO 12 h × 165 = 1.980; peças 100 + 47% = 147; base 2.127;
    //      Visa 5x 7,57%; imposto 10%; gasto das horas 936,92) ----
    { id: 'D1', descricao: 'Âncora = Visa 5x 7,57% sobre a base 2.127 → Total 2.301,20 · 5× 460,24',
      executar: function () {
        var c = cenarioDesconto();
        var p = calcularPrecoComDesconto(c.res, c.params, 5, 0);
        return { obtido: [c.res.aVista.totalCentavos, p.ancora.parcelas, p.ancora.totalCentavos, p.ancora.parcelaCentavos], esperado: [212700, 5, 230120, 46024] };
      } },
    { id: 'D2', descricao: 'Desconto 5% → à vista 2.186,14',
      executar: function () { var c = cenarioDesconto(); return { obtido: calcularPrecoComDesconto(c.res, c.params, 5, 0).precoCentavos, esperado: 218614 }; } },
    { id: 'D3', descricao: 'Máximo sem perder lucro 7,57%; com 5% ainda pode 2,57% / R$ 59,14',
      executar: function () {
        var c = cenarioDesconto(); var p = calcularPrecoComDesconto(c.res, c.params, 5, 0);
        return { obtido: [Math.round(p.maximo * 100) / 100, p.aindaPodePct, p.aindaPodeCentavos, p.acimaDoMaximo], esperado: [7.57, 2.57, 5914, false] };
      } },
    { id: 'D4', descricao: 'Lucro com 5% = 2.186,14 − 936,92 − 100 − 218,61 = 930,61',
      executar: function () {
        var c = cenarioDesconto(); var p = calcularPrecoComDesconto(c.res, c.params, 5, 0);
        return { obtido: [centavos(c.res.gastoHoras), centavos(p.imposto), centavos(p.lucro)], esperado: [93692, 21861, 93061] };
      } },
    { id: 'D5', descricao: 'Desconto 10% → 2.071,08; ainda pode 0; abre mão de R$ 55,92',
      executar: function () {
        var c = cenarioDesconto(); var p = calcularPrecoComDesconto(c.res, c.params, 10, 0);
        return { obtido: [p.precoCentavos, p.aindaPodePct, p.aindaPodeCentavos, p.acimaDoMaximo, p.abreMaoCentavos], esperado: [207108, 0, 0, true, 5592] };
      } },
    { id: 'D6', descricao: 'Extra 2% SOMA aos 5% (total 7%) → 2.140,12; ainda pode 0,57%; total limitado a 99',
      executar: function () {
        var c = cenarioDesconto(); var p = calcularPrecoComDesconto(c.res, c.params, 5, 2);
        return { obtido: [p.descontoTotal, p.precoCentavos, p.aindaPodePct, calcularPrecoComDesconto(c.res, c.params, 90, 50).descontoTotal],
                 esperado: [7, 214012, 0.57, 99] };
      } },
    { id: 'D7', descricao: 'Piso de prejuízo = (936,92 + 100) ÷ 0,9 = 1.152,13',
      executar: function () { var c = cenarioDesconto(); return { obtido: centavos(calcularPrecoComDesconto(c.res, c.params, 5, 0).piso), esperado: 115213 }; } },
    { id: 'D8', descricao: 'Sem taxa em nenhuma parcela em destaque → âncora = base, sem desconto, sem erro',
      executar: function () {
        var c = cenarioDesconto([cartaoDeTeste('Elo', { debito: 1.89, p3: 6.89 })]);
        var p = calcularPrecoComDesconto(c.res, c.params, 5, 2);
        return { obtido: [p.temAncora, p.descontoTotal, p.precoCentavos, p.aindaPodeCentavos, p.acimaDoMaximo], esperado: [false, 0, 212700, 0, false] };
      } },
    { id: 'D9', descricao: 'WhatsApp sem "ainda", "lucro", "taxa", "piso", "prejuízo"; com desconto 0 → sem "de desconto"',
      executar: function () {
        var c = cenarioDesconto();
        var com = textoWhatsApp(c.res, { nomeOficina: 'CliniCar Motors Tech' }, 'Troca de embreagem', calcularPrecoComDesconto(c.res, c.params, 5, 0));
        var acima = textoWhatsApp(c.res, { nomeOficina: '' }, '', calcularPrecoComDesconto(c.res, c.params, 10, 0));
        var zero = textoWhatsApp(c.res, { nomeOficina: '' }, '', calcularPrecoComDesconto(c.res, c.params, 0, 0));
        var proibido = /ainda|lucro|taxa|piso|preju/i;
        return { obtido: [proibido.test(com + acima + zero), com.split('\n').pop(), zero.split('\n').pop(), /de desconto/.test(zero)],
                 esperado: [false, '💵 À vista (Pix/dinheiro): *R$ 2.186,14* — 5% de desconto', '💵 À vista (Pix/dinheiro): *R$ 2.301,20*', false] };
      } },
    { id: 'D11', descricao: '10x Visa 11,06% sobre a BASE: 2.127 ÷ 0,8894 = 2.391,4999 → Total 2.391,50 · 10× 239,15 (também no WhatsApp)',
      executar: function () {
        var c = cenarioDesconto();
        var op10 = c.res.destaques[1];
        var texto = textoWhatsApp(c.res, { nomeOficina: '' }, '', calcularPrecoComDesconto(c.res, c.params, 5, 0));
        return { obtido: [op10.parcelas, op10.totalCentavos, op10.parcelaCentavos, texto.indexOf('💳 Cartão em até 10x: R$ 2.391,50 (10x de R$ 239,15)') >= 0],
                 esperado: [10, 239150, 23915, true] };
      } },
    { id: 'D12', descricao: 'Nenhuma parcela em destaque com total menor que o à vista oferecido (0%, 5%, 7%, 10%)',
      executar: function () {
        var c = cenarioDesconto();
        var ok = [[0, 0], [5, 0], [5, 2], [10, 0]].every(function (dx) {
          var p = calcularPrecoComDesconto(c.res, c.params, dx[0], dx[1]);
          return c.res.destaques.every(function (op) { return op.totalCentavos >= p.precoCentavos; });
        });
        return { obtido: ok, esperado: true };
      } },
    { id: 'L1', descricao: 'Desconto padrão do aparelho: nada salvo → 5; "7" → 7; "7,5" → 7,5; "0" → 0; inválido ("abc", "150", "-1") → 5',
      executar: function () {
        return { obtido: [null, '7', '7,5', '0', 'abc', '150', '-1'].map(descontoPadraoDoAparelho), esperado: [5, 7, 7.5, 0, 5, 5, 5] };
      } }
  ];
}

/** Cenário dos casos D: MO 12 h × 165; peças = 1 item 1 × 100, + 47%; Visa (padrão InfinitePay); imposto 10%; gasto das horas 936,92. */
function cenarioDesconto(cartoes) {
  var params = { valorHoraCobrado: 165, impostoPercentual: 10, parcelasDestaque: '5,10' };
  var entrada = { modo: 'horas', horas: 12, pecasPagar: totalPecasItens([{ qtd: 1, valor: 100 }]), pecasModo: 'acrescimo', pecasAcrescimo: 47 };
  var res = calcularOrcamento(entrada, params, cartoes || [cartaoDeTeste('Visa/Master', VISA_TESTE)], NAO_SEI, 936.92 / 12);
  return { res: res, params: params };
}

/** Roda os casos e devolve [{id, descricao, passou, obtido, esperado}]. */
function rodarCasosDeTeste() {
  return casosDeTeste().map(function (c) {
    var r;
    try { r = c.executar(); } catch (e) { r = { obtido: 'ERRO: ' + e.message, esperado: '(sem erro)' }; }
    return { id: c.id, descricao: c.descricao, passou: JSON.stringify(r.obtido) === JSON.stringify(r.esperado), obtido: r.obtido, esperado: r.esperado };
  });
}
