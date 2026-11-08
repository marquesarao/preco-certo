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
  acrescimoPecasPadrao: { min: 0, max: MAX_ACRESCIMO },
  descontoAVistaPadrao: { min: 0, max: 99 }
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
  acrescimoPecasPadrao: 'Use um número de 0 a 1000.',
  descontoAVistaPadrao: 'Use um número de 0 a 99.'
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

// ---------------- Neste serviço: oficina, casa e sobra ----------------

/** Mínimo por hora de um tipo só ('Oficina' ou 'Casa'). Os dois somados = precoMinimoHora. Sem arredondar. */
function minimoHoraDoTipo(gastos, p, tipo) {
  var h = horasCobradasMes(p);
  return h > 0 ? totalGastos(gastos, tipo) / h : 0;
}

/**
 * Separa o que o serviço paga (sem arredondar no meio):
 * - pagaOficina = horas × mínimo/hora da oficina;  vaiParaCasa = horas × mínimo/hora da casa (o "salário");
 * - sobra = preço cobrado − pagaOficina − vaiParaCasa − peças pagas − imposto (= o antigo "lucro");
 * - totalSeu = vaiParaCasa + sobra;
 * - pisoOficina = (pagaOficina + peças pagas) ÷ (1 − imposto%);  pisoCasa = (… + vaiParaCasa) ÷ (1 − imposto%) (= piso antigo);
 * - estado: 'verde' (sobra ≥ 0) · 'ambar' (sobra < 0, mas preço ≥ pisoOficina) · 'vermelho' (preço < pisoOficina).
 * @param res calcularOrcamento   @param preco calcularPrecoComDesconto (preço oferecido e imposto sobre ele)
 */
function separarGanho(res, preco, parametros, minimoOficina, minimoCasa) {
  var impostoPct = typeof parametros.impostoPercentual === 'number' ? parametros.impostoPercentual : 0;
  var horas = typeof res.horas === 'number' && res.horas > 0 ? res.horas : 0;
  var valor = preco.precoCentavos / 100;
  var pagaOficina = horas * minimoOficina;
  var vaiParaCasa = horas * minimoCasa;
  var sobra = valor - pagaOficina - vaiParaCasa - res.pecasPagar - preco.imposto;
  var fator = 1 - impostoPct / 100;
  var pisoOficina = (pagaOficina + res.pecasPagar) / fator;
  var pisoCasa = (pagaOficina + vaiParaCasa + res.pecasPagar) / fator;
  return {
    pagaOficina: pagaOficina,
    vaiParaCasa: vaiParaCasa,
    sobra: sobra,
    totalSeu: vaiParaCasa + sobra,
    pisoOficina: pisoOficina,
    pisoCasa: pisoCasa,
    temCasa: minimoCasa > 0,
    estado: centavos(sobra) >= 0 ? 'verde' : (valor >= pisoOficina ? 'ambar' : 'vermelho')
  };
}

/**
 * Linhas de "Ver detalhes" em centavos, para a soma VISÍVEL fechar no centavo com a "Sobra extra":
 * cada linha é arredondada sozinha e UMA linha absorve a diferença de arredondamento (no máximo poucos centavos):
 * "Vai para a sua casa" quando há gastos de casa; senão "Paga os gastos da oficina"; sem horas, "Lucro nas peças".
 * totalSeu exibido = casa exibida + sobra exibida.
 * @return {maoDeObra, lucroPecas, diferenca|null, imposto|null, pagaOficina, vaiParaCasa|null, sobra, totalSeu|null}
 */
function linhasDetalheServico(res, preco, ganho) {
  var c = {
    maoDeObra: centavos(res.maoDeObra),
    lucroPecas: centavos(res.lucroPecas),
    diferenca: null,
    imposto: null,
    pagaOficina: centavos(ganho.pagaOficina),
    vaiParaCasa: ganho.temCasa ? centavos(ganho.vaiParaCasa) : null,
    sobra: centavos(ganho.sobra),
    totalSeu: null
  };
  var dif = preco.precoCentavos / 100 - res.aVista.totalExato;
  if (preco.temAncora && centavos(dif) !== 0) c.diferenca = centavos(dif);
  if (preco.imposto > 0) c.imposto = centavos(preco.imposto);
  var soma = c.maoDeObra + c.lucroPecas + (c.diferenca || 0) - (c.imposto || 0) - c.pagaOficina - (c.vaiParaCasa || 0);
  var falta = soma - c.sobra; // > 0: as linhas dão mais que a sobra
  var absorve = ganho.temCasa && ganho.vaiParaCasa > 0 ? 'vaiParaCasa' : (ganho.pagaOficina > 0 ? 'pagaOficina' : 'lucroPecas');
  if (absorve === 'lucroPecas') c.lucroPecas -= falta; else c[absorve] += falta;
  if (ganho.temCasa) c.totalSeu = c.vaiParaCasa + c.sobra;
  return c;
}

// ---------------- Orçamentos salvos (fase 10): foto, refazer a conta, fechamento e resumo do mês ----------------

/** Limites dos orçamentos salvos: espelho EXATO do backend (MAX_CLIENTE_ … do Codigo.gs). */
var MAX_CLIENTE = 60;
var MAX_TELEFONE = 20;
var MAX_MOTIVO = 80;
var MAX_SERVICO = 100;
var MAX_TEXTO_CAMPO = 40;
var RE_TELEFONE = /^[0-9 ()+.\-]*$/;
var MSG_HORAS_SERVICO = 'Digite as horas. Ex.: 2,5';
var MSG_VALOR_ORCAMENTO = 'Digite um valor igual ou maior que zero.';
var MSG_DESCONTO = 'Use um número de 0 a 99.';

/** Desconto à vista padrão dos Ajustes (aba Parâmetros): 0 a 99; ausente/inválido → 5. */
function descontoPadraoDosParametros(p) {
  var n = p ? p.descontoAVistaPadrao : null;
  return dentroDoLimite(n, LIMITE_DESCONTO) ? n : DESCONTO_PADRAO_DE_FABRICA;
}

/** Telefone: '' se válido; senão a mensagem. */
function validarTelefone(t) {
  var s = String(t === null || t === undefined ? '' : t).trim();
  if (s.length > MAX_TELEFONE) return 'Use no máximo ' + MAX_TELEFONE + ' caracteres.';
  if (!RE_TELEFONE.test(s)) return 'Use só números, espaço, ( ) + - e ponto.';
  return '';
}

/** "(11) 98888-7777" → "11988887777" (para a busca). */
function soNumeros(t) { return String(t === null || t === undefined ? '' : t).replace(/\D/g, ''); }

/**
 * Foto do que entra na conta, a partir dos dados de hoje (gastos, ajustes e cartões).
 * É o que fica gravado com o orçamento: ele não muda quando os gastos ou as taxas mudarem.
 */
function fotoDeHoje(dados, em) {
  var p = dados.parametros;
  return {
    em: em || '',
    parametros: JSON.parse(JSON.stringify(p)),
    gastosOficina: totalGastos(dados.gastos, 'Oficina'),
    gastosCasa: totalGastos(dados.gastos, 'Casa'),
    horasCobradasMes: horasCobradasMes(p),
    minimoHoraOficina: minimoHoraDoTipo(dados.gastos, p, 'Oficina'),
    minimoHoraCasa: minimoHoraDoTipo(dados.gastos, p, 'Casa'),
    cartoes: JSON.parse(JSON.stringify(dados.cartoes))
  };
}

/** Duas fotos com os mesmos valores (ignora a data "em"). */
function fotosIguais(a, b) {
  function sem(f) { var c = JSON.parse(JSON.stringify(f)); delete c.em; return JSON.stringify(c); }
  return !!a && !!b && sem(a) === sem(b);
}

/** O que o cálculo usa, a partir de uma foto. */
function contextoDaFoto(foto) {
  var h = foto.horasCobradasMes;
  return {
    parametros: foto.parametros,
    cartoes: foto.cartoes,
    minimoOficina: foto.minimoHoraOficina,
    minimoCasa: foto.minimoHoraCasa,
    precoMinimoHora: h > 0 ? (foto.gastosOficina + foto.gastosCasa) / h : 0,
    gastosTotal: foto.gastosOficina + foto.gastosCasa
  };
}

/**
 * Lê os textos do rascunho do orçamento (como foram digitados) e devolve números + erros por campo.
 * É a MESMA leitura da tela; serve também para refazer a conta de um orçamento salvo.
 * Acréscimo/desconto null = segue o padrão dos ajustes (da foto).
 */
function lerEntradaOrcamento(e, parametros) {
  var erros = {};
  function campo(id, texto, lim, msg) {
    var r = validarNumeroCampo(texto, lim, { vazioPermitido: true, mensagem: msg });
    if (r.erro) erros[id] = r.erro;
    return r.valor;
  }
  var fechado = e.modo === 'fechado';
  var porAcrescimo = e.pecasModo !== 'valor';
  var acrescimoTexto = e.acrescimoTexto !== null && e.acrescimoTexto !== undefined
    ? e.acrescimoTexto : numeroParaCampo(parametros.acrescimoPecasPadrao, false);
  var descontoTexto = e.descontoTexto !== null && e.descontoTexto !== undefined
    ? e.descontoTexto : numeroParaCampo(descontoPadraoDosParametros(parametros), false);
  var pecas = porAcrescimo ? (e.pecas || []).map(function (p) {
    var q = validarQtdPeca(p.qtdTexto);
    var v = validarNumeroCampo(p.valorTexto, LIMITE_VALOR_ORCAMENTO, { vazioPermitido: true, mensagem: MSG_VALOR_ORCAMENTO });
    if (q.erro || v.erro) erros.pecas = true;
    return { descricao: p.descricao, qtd: q.valor, valor: v.valor, erroQtd: q.erro, erroValor: v.erro };
  }) : [];
  var entrada = {
    modo: fechado ? 'fechado' : 'horas',
    horas: fechado
      ? campo('orc-horas-fechado', e.horasFechadoTexto, LIMITE_HORAS_SERVICO, MSG_HORAS_SERVICO)
      : campo('orc-horas', e.horasTexto, LIMITE_HORAS_SERVICO, MSG_HORAS_SERVICO),
    valorFechado: fechado ? campo('orc-valor', e.valorTexto, LIMITE_VALOR_ORCAMENTO, MSG_VALOR_ORCAMENTO) : null,
    pecasPagar: porAcrescimo
      ? totalPecasItens(pecas)
      : campo('orc-pecas-pagar', e.pecasPagarTexto, LIMITE_VALOR_ORCAMENTO, MSG_VALOR_ORCAMENTO),
    pecasModo: porAcrescimo ? 'acrescimo' : 'valor',
    pecasAcrescimo: porAcrescimo ? campo('orc-acrescimo', acrescimoTexto, LIMITE_ACRESCIMO, MENSAGENS_PARAMETROS.acrescimoPecasPadrao) : null,
    pecasCobrar: porAcrescimo ? null : campo('orc-pecas-cobrar', e.pecasCobrarTexto, LIMITE_VALOR_ORCAMENTO, MSG_VALOR_ORCAMENTO)
  };
  return {
    entrada: entrada,
    pecas: pecas,
    desconto: campo('orc-desconto', descontoTexto, LIMITE_DESCONTO, MSG_DESCONTO),
    extra: campo('orc-extra', e.extraTexto, LIMITE_DESCONTO, MSG_DESCONTO),
    erros: erros,
    acrescimoTexto: acrescimoTexto,
    descontoTexto: descontoTexto
  };
}

/**
 * A conta inteira do orçamento a partir do rascunho (textos) e de uma foto.
 * A tela usa esta função (com a foto de hoje, ou a gravada) e o orçamento salvo é refeito com ela.
 */
function calcularComFoto(e, foto) {
  var ctx = contextoDaFoto(foto);
  var lido = lerEntradaOrcamento(e, ctx.parametros);
  var bandeira = e.bandeira !== NAO_SEI && acharCartao(ctx.cartoes, e.bandeira) < 0 ? NAO_SEI : (e.bandeira || NAO_SEI);
  var res = calcularOrcamento(lido.entrada, ctx.parametros, ctx.cartoes, bandeira, ctx.precoMinimoHora);
  var preco = calcularPrecoComDesconto(res, ctx.parametros, lido.desconto, lido.extra);
  var ganho = separarGanho(res, preco, ctx.parametros, ctx.minimoOficina, ctx.minimoCasa);
  return { ctx: ctx, lido: lido, bandeira: bandeira, res: res, preco: preco, ganho: ganho, det: linhasDetalheServico(res, preco, ganho) };
}

/** O que vai para a planilha como "resultado" (centavos inteiros, os valores EXIBIDOS). */
function resultadoParaGravar(c) {
  function op(o) { return { parcelas: o.parcelas, totalC: o.totalCentavos, parcelaC: o.parcelaCentavos }; }
  var horas = typeof c.res.horas === 'number' && isFinite(c.res.horas) && c.res.horas > 0 ? c.res.horas : 0;
  return {
    horas: horas,
    pecasPagarC: centavos(c.res.pecasPagar),
    pecasCobrarC: centavos(c.res.pecasCobrar),
    aVistaBaseC: c.res.aVista.totalCentavos,
    ancora: c.preco.ancora ? op(c.preco.ancora) : null,
    descontoTotal: c.preco.descontoTotal,
    oferecidoC: c.preco.precoCentavos,
    destaques: c.res.destaques.map(op),
    pagaOficinaC: c.det.pagaOficina,
    vaiParaCasaC: c.det.vaiParaCasa,
    sobraC: c.det.sobra,
    totalSeuC: c.det.totalSeu,
    pisoOficinaC: centavos(c.ganho.pisoOficina),
    pisoCasaC: centavos(c.ganho.pisoCasa),
    estado: c.ganho.estado
  };
}

/** Campo de taxa da forma do fechamento: 'debito' ou 'p1'…'p12'. */
function campoDaFormaFechamento(forma, parcelas) {
  return forma === 'debito' ? 'debito' : 'p' + parcelas;
}

/** Formas que existem na foto para o cartão: {debito: bool, parcelas: [n…]} (só as que têm taxa). */
function formasDisponiveis(foto, cartao) {
  var ef = cartaoEfetivo(foto.cartoes, cartao);
  var parcelas = [];
  for (var n = 1; n <= 12; n++) if (foto.cartoes.length && taxaDaForma(foto.cartoes, 'p' + n, ef) !== null) parcelas.push(n);
  return { debito: foto.cartoes.length > 0 && taxaDaForma(foto.cartoes, 'debito', ef) !== null, parcelas: parcelas };
}

/**
 * Valor combinado que a tela de fechamento sugere: Pix → à vista oferecido do orçamento;
 * Débito/Nx → total daquela forma (regra B sobre a base, como em "Ver outras formas"), no cartão escolhido.
 * @return centavos ou null (forma sem taxa)
 */
function valorSugeridoFechamento(entrada, foto, resultado, forma, parcelas, cartao) {
  if (forma === 'pix') return resultado.oferecidoC;
  var c = calcularComFoto(Object.assign({}, entrada, { bandeira: cartao }), foto);
  var campo = campoDaFormaFechamento(forma, parcelas);
  var ops = c.res.opcoes.filter(function (o) { return (campo === 'debito' ? o.forma === 'Débito' : o.forma === 'Crédito' && o.parcelas === parcelas); });
  return ops.length ? ops[0].totalCentavos : null;
}

/**
 * Fechamento (sem arredondar no meio):
 * taxa = V × taxa%; imposto = V × imposto% (da foto); oficina e casa = horas × mínimos da foto;
 * sobra = V − taxa − imposto − peças pagas − oficina − casa; totalSeu = casa + sobra.
 * Cada linha é arredondada sozinha e "Vai para a sua casa" absorve a diferença (sem casa: "Paga a oficina";
 * sem horas: a própria sobra), para V − taxa − imposto − peças − oficina − casa = sobra no centavo.
 * @return objeto pronto para mudarSituacao (falta só a data) ou null se a forma não tem taxa
 */
function calcularFechamento(foto, resultado, forma, parcelas, cartao, valorCombinadoC) {
  var impPct = typeof foto.parametros.impostoPercentual === 'number' ? foto.parametros.impostoPercentual : 0;
  var ef = forma === 'pix' ? NAO_SEI : cartaoEfetivo(foto.cartoes, cartao);
  var taxaPct = forma === 'pix' ? 0 : taxaDaForma(foto.cartoes, campoDaFormaFechamento(forma, parcelas), ef);
  if (taxaPct === null || (forma !== 'pix' && !foto.cartoes.length)) return null;
  var V = valorCombinadoC / 100;
  var taxa = V * taxaPct / 100;
  var imposto = V * impPct / 100;
  var horas = resultado.horas > 0 ? resultado.horas : 0;
  var oficina = horas * foto.minimoHoraOficina;
  var casa = horas * foto.minimoHoraCasa;
  var temCasa = foto.minimoHoraCasa > 0;
  var pecas = resultado.pecasPagarC / 100;
  var sobra = V - taxa - imposto - pecas - oficina - casa;
  var c = { taxaC: centavos(taxa), impostoC: centavos(imposto), pagaOficinaC: centavos(oficina),
    vaiParaCasaC: temCasa ? centavos(casa) : null, sobraC: centavos(sobra) };
  var falta = valorCombinadoC - c.taxaC - c.impostoC - resultado.pecasPagarC - c.pagaOficinaC - (c.vaiParaCasaC || 0) - c.sobraC;
  if (falta !== 0) {
    if (temCasa && casa > 0 && c.vaiParaCasaC + falta >= 0) c.vaiParaCasaC += falta;
    else if (oficina > 0 && c.pagaOficinaC + falta >= 0) c.pagaOficinaC += falta;
    else c.sobraC += falta;
  }
  var depoisDaOficina = V - taxa - imposto - pecas - oficina;
  return {
    forma: forma,
    parcelas: forma === 'pix' ? null : forma === 'debito' ? 1 : parcelas,
    cartao: forma === 'pix' ? '' : ef,
    taxaPct: taxaPct,
    valorCombinadoC: valorCombinadoC,
    taxaC: c.taxaC,
    impostoC: c.impostoC,
    pecasPagarC: resultado.pecasPagarC,
    pagaOficinaC: c.pagaOficinaC,
    vaiParaCasaC: c.vaiParaCasaC,
    sobraC: c.sobraC,
    totalSeuC: temCasa ? c.vaiParaCasaC + c.sobraC : null,
    estado: c.sobraC >= 0 ? 'verde' : (depoisDaOficina >= 0 ? 'ambar' : 'vermelho')
  };
}

// ---------- Meses ----------
var NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** "2026-11-07…" → "2026-11"; outro texto → ''. */
function mesDe(texto) {
  var m = /^(\d{4})-(0[1-9]|1[0-2])/.exec(String(texto || ''));
  return m ? m[1] + '-' + m[2] : '';
}
function deslocarMes(mes, delta) {
  var a = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7)) - 1 + delta;
  a += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12 + 1;
  return a + '-' + (m < 10 ? '0' : '') + m;
}
function mesAnterior(mes) { return deslocarMes(mes, -1); }
function mesSeguinte(mes) { return deslocarMes(mes, 1); }
/** "2026-11" → "Novembro 2026"; curto → "novembro". */
function nomeDoMes(mes, curto) {
  var n = NOMES_MESES[Number(mes.slice(5, 7)) - 1] || '';
  return curto ? n.toLowerCase() : n + ' ' + mes.slice(0, 4);
}
/** Data local → "aaaa-mm-dd". */
function dataLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/** "2026-11-07" → "07/11/2026" (curto: "07/11"). */
function dataBR(texto, curto) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(texto || ''));
  if (!m) return '';
  return curto ? m[3] + '/' + m[2] : m[3] + '/' + m[2] + '/' + m[1];
}

/**
 * Resumo do mês a partir da lista (resumos de listarOrcamentos):
 * - contagem pelo MÊS DE CRIAÇÃO (feitos, fecharam, não fecharam, em aberto; taxa = fecharam ÷ feitos);
 * - dinheiro pela DATA DO FECHAMENTO (só Fechados): faturamento, peças, taxas, imposto, horas;
 * - resultado real (com a foto dos gastos do mês, em centavos):
 *   depoisDaOficina = F − P − T − I − GO; casaCoberta = mín(máx(depois, 0), GC);
 *   sobraDoMes = depois − GC; totalSeuNoMes = máx(depois, 0).
 * @param fotoMes {oficinaC, casaC, horas} ou null (sem foto → resultado null)
 */
function resumoDoMes(lista, mes, fotoMes) {
  var feitos = lista.filter(function (o) { return mesDe(o.criadoEm) === mes; });
  function conta(s) { return feitos.filter(function (o) { return o.situacao === s; }).length; }
  var fechados = lista.filter(function (o) { return o.situacao === 'Fechado' && mesDe(o.dataFechamento) === mes; });
  function soma(k) { return fechados.reduce(function (t, o) { return t + (typeof o[k] === 'number' ? o[k] : 0); }, 0); }
  var r = {
    mes: mes,
    feitos: feitos.length,
    fecharam: conta('Fechado'),
    naoFecharam: conta('Não fechou'),
    emAberto: conta('Aberto'),
    taxaFechamento: feitos.length ? conta('Fechado') / feitos.length : null,
    fechados: fechados.length,
    faturamentoC: soma('valorCombinadoC'),
    pecasC: soma('pecasPagarC'),
    taxasC: soma('taxaC'),
    impostoC: soma('impostoC'),
    horasVendidas: Math.round(soma('horas') * 10000) / 10000,
    horasPossiveis: fotoMes ? fotoMes.horas : null,
    resultado: null
  };
  r.pctHoras = fotoMes && fotoMes.horas > 0 ? r.horasVendidas / fotoMes.horas : null;
  if (fotoMes) {
    var depois = r.faturamentoC - r.pecasC - r.taxasC - r.impostoC - fotoMes.oficinaC;
    var casaCoberta = Math.min(Math.max(depois, 0), fotoMes.casaC);
    var sobra = depois - fotoMes.casaC;
    r.resultado = {
      gastosOficinaC: fotoMes.oficinaC,
      gastosCasaC: fotoMes.casaC,
      depoisDaOficinaC: depois,
      oficinaSePagou: depois >= 0,
      casaCobertaC: casaCoberta,
      casa: depois >= fotoMes.casaC ? 'toda' : depois > 0 ? 'parte' : 'nada',
      pctCasa: fotoMes.casaC > 0 ? casaCoberta / fotoMes.casaC : null,
      sobraDoMesC: sobra,
      totalSeuNoMesC: Math.max(depois, 0),
      estado: sobra >= 0 ? 'verde' : depois >= 0 ? 'ambar' : 'vermelho'
    };
  }
  return r;
}

/** Comparação com o mês anterior (só se o anterior teve fechamentos). Sobra: só a diferença em R$. */
function compararMeses(atual, anterior) {
  if (!anterior || anterior.fechados === 0) return null;
  var difFat = atual.faturamentoC - anterior.faturamentoC;
  return {
    faturamentoDifC: difFat,
    faturamentoPct: anterior.faturamentoC > 0 ? difFat / anterior.faturamentoC : null,
    sobraDifC: atual.resultado && anterior.resultado ? atual.resultado.sobraDoMesC - anterior.resultado.sobraDoMesC : null
  };
}

/** "63%" (sem casas). */
function porcentoInteiro(x) { return Math.round(x * 100) + '%'; }

/** A busca da lista: cliente e serviço sem acento/maiúscula; telefone só pelos números. */
function combinaBusca(o, termo) {
  var t = chaveNome(termo);
  if (!t) return true;
  if (chaveNome(o.cliente).indexOf(t) >= 0 || chaveNome(o.servico).indexOf(t) >= 0) return true;
  var n = soNumeros(termo);
  return n.length > 0 && n.length === t.replace(/[\s()+.\-]/g, '').length && soNumeros(o.telefone).indexOf(n) >= 0;
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
        var proibido = /ainda|lucro|taxa|piso|preju|sobra|casa|salário|oficina não se paga/i;
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
    // ---- Neste serviço: oficina, casa e sobra (cenário S) ----
    { id: 'R1', descricao: 'Paga a oficina = 8 × 4.000/130 = 246,15; vai para a casa = 8 × 3.000/130 = 184,62',
      executar: function () { var s = cenarioServico(); return { obtido: [centavos(s.ganho.pagaOficina), centavos(s.ganho.vaiParaCasa)], esperado: [24615, 18462] }; } },
    { id: 'R2', descricao: 'Sobra = 1.700 − 246,1538 − 184,6154 − 400 = 869,23 (= o antigo "lucro")',
      executar: function () {
        var s = cenarioServico();
        return { obtido: [s.preco.precoCentavos, centavos(s.ganho.sobra), centavos(s.preco.lucro), centavos(s.res.aVista.lucro)], esperado: [170000, 86923, 86923, 86923] };
      } },
    { id: 'R3', descricao: 'Total que é seu = 184,6154 + 869,2308 = 1.053,85',
      executar: function () { var s = cenarioServico(); return { obtido: [centavos(s.ganho.totalSeu), s.linhas.totalSeu], esperado: [105385, 105385] }; } },
    { id: 'R4', descricao: 'Piso da oficina = 646,15; piso da casa = 830,77 (= piso antigo); preço 1.700 → verde',
      executar: function () {
        var s = cenarioServico();
        return { obtido: [centavos(s.ganho.pisoOficina), centavos(s.ganho.pisoCasa), centavos(s.preco.piso), s.ganho.estado], esperado: [64615, 83077, 83077, 'verde'] };
      } },
    { id: 'R5', descricao: 'Preço 700 → sobra negativa (−130,77), mas ≥ piso da oficina → âmbar',
      executar: function () { var s = cenarioServico(200); return { obtido: [s.preco.precoCentavos, centavos(s.ganho.sobra), s.ganho.estado], esperado: [70000, -13077, 'ambar'] }; } },
    { id: 'R6', descricao: 'Preço 600 → abaixo do piso da oficina (646,15) → vermelho',
      executar: function () { var s = cenarioServico(100); return { obtido: [s.preco.precoCentavos, s.ganho.estado], esperado: [60000, 'vermelho'] }; } },
    { id: 'R7', descricao: 'Sem gastos de casa → sem linha da casa e sem "total que é seu"; um só piso (= piso da oficina)',
      executar: function () {
        var s = cenarioServico(null, true);
        return { obtido: [s.ganho.temCasa, s.linhas.vaiParaCasa, s.linhas.totalSeu, centavos(s.ganho.pisoCasa) === centavos(s.ganho.pisoOficina), centavos(s.ganho.pagaOficina)],
                 esperado: [false, null, null, true, 24615] }; // a oficina continua 8 × 4.000/130
      } },
    { id: 'R8', descricao: 'Linhas do detalhe fecham no centavo com a sobra exibida (cenário S, S 700, S sem casa e cenário D com 5% e 10%)',
      executar: function () {
        function fecha(l) {
          return l.maoDeObra + l.lucroPecas + (l.diferenca || 0) - (l.imposto || 0) - l.pagaOficina - (l.vaiParaCasa || 0) === l.sobra;
        }
        var casos = [cenarioServico().linhas, cenarioServico(200).linhas, cenarioServico(null, true).linhas];
        var d = cenarioDesconto();
        var gastosD = [{ tipo: 'Oficina', valor: 5000 }, { tipo: 'Casa', valor: 3433.33 }];
        var pD = { diasPorSemana: 5, horasPorDia: 8, horasCobradasPorDia: 6, impostoPercentual: 10 };
        [5, 10].forEach(function (desc) {
          var preco = calcularPrecoComDesconto(d.res, d.params, desc, 0);
          casos.push(linhasDetalheServico(d.res, preco, separarGanho(d.res, preco, d.params, minimoHoraDoTipo(gastosD, pD, 'Oficina'), minimoHoraDoTipo(gastosD, pD, 'Casa'))));
        });
        return { obtido: casos.map(fecha), esperado: [true, true, true, true, true] };
      } },
    { id: 'L1', descricao: 'Desconto padrão do aparelho (migração): nada salvo → 5; "7" → 7; "7,5" → 7,5; "0" → 0; inválido ("abc", "150", "-1") → 5',
      executar: function () {
        return { obtido: [null, '7', '7,5', '0', 'abc', '150', '-1'].map(descontoPadraoDoAparelho), esperado: [5, 7, 7.5, 0, 5, 5, 5] };
      } },
    { id: 'L2', descricao: 'Desconto padrão dos Ajustes (aba Parâmetros): 7,5 → 7,5; 0 → 0; ausente, 100 ou texto → 5',
      executar: function () {
        return { obtido: [{ descontoAVistaPadrao: 7.5 }, { descontoAVistaPadrao: 0 }, {}, { descontoAVistaPadrao: 100 }, { descontoAVistaPadrao: '7' }, null].map(descontoPadraoDosParametros),
                 esperado: [7.5, 0, 5, 5, 5, 5] };
      } },
    // ---- Fase 10: fechamento (cenário F, DESENHO 11.6) ----
    { id: 'FC1', descricao: 'Fechamentos do cenário F: Pix 1.747,27 · Débito 1.723,61 · 5x 1.839,23 · 10x 1.911,40 · Pix alterado 1.700 → taxa, imposto, oficina, casa, sobra e total que é seu',
      executar: function () {
        var f = cenarioFechamento();
        var linhas = [['pix', null], ['debito', 1], ['credito', 5], ['credito', 10]].map(function (x) {
          var v = valorSugeridoFechamento(f.e, f.foto, f.resultado, x[0], x[1], NAO_SEI);
          var c = calcularFechamento(f.foto, f.resultado, x[0], x[1], NAO_SEI, v);
          return [c.valorCombinadoC, c.taxaC, c.impostoC, c.pecasPagarC, c.pagaOficinaC, c.vaiParaCasaC, c.sobraC, c.totalSeuC];
        });
        var p = calcularFechamento(f.foto, f.resultado, 'pix', null, NAO_SEI, 170000);
        linhas.push([p.valorCombinadoC, p.taxaC, p.impostoC, p.pecasPagarC, p.pagaOficinaC, p.vaiParaCasaC, p.sobraC, p.totalSeuC]);
        return { obtido: linhas, esperado: [
          [174727, 0, 10484, 40000, 24615, 18462, 81166, 99628],
          [172361, 2361, 10342, 40000, 24615, 18462, 76581, 95043],
          [183923, 13923, 11035, 40000, 24615, 18462, 75888, 94350],
          [191140, 21140, 11468, 40000, 24615, 18462, 75455, 93917],
          [170000, 0, 10200, 40000, 24615, 18462, 76723, 95185]] };
      } },
    { id: 'FC2', descricao: 'Coerência: Pix pelo à vista oferecido = sobra de "Neste serviço" (811,66); 5x pelo total = sobra extra no cartão em 5x (758,88)',
      executar: function () {
        var f = cenarioFechamento();
        var pix = calcularFechamento(f.foto, f.resultado, 'pix', null, NAO_SEI, f.resultado.oferecidoC);
        var p5 = calcularFechamento(f.foto, f.resultado, 'credito', 5, NAO_SEI, f.calc.res.destaques[0].totalCentavos);
        return { obtido: [pix.sobraC, f.calc.det.sobra, p5.sobraC, centavos(f.calc.res.destaques[0].lucro)], esperado: [81166, 81166, 75888, 75888] };
      } },
    { id: 'FC3', descricao: 'Soma no centavo (regra do R8) em 20 valores combinados × (com casa, sem casa, sem horas), com imposto: V − taxa − imposto − peças − oficina − casa = sobra; nenhuma linha negativa',
      executar: function () {
        var ok = true;
        [false, true].forEach(function (semCasa) {
          [8, 0, 7.33].forEach(function (horas) {
            var f = cenarioFechamento(semCasa, horas);
            for (var i = 0; i < 20; i++) {
              var v = 50000 + i * 12347 + (i % 3);
              [['pix', null], ['debito', 1], ['credito', 7]].forEach(function (x) {
                var c = calcularFechamento(f.foto, f.resultado, x[0], x[1], NAO_SEI, v);
                if (v - c.taxaC - c.impostoC - c.pecasPagarC - c.pagaOficinaC - (c.vaiParaCasaC || 0) !== c.sobraC) ok = false;
                if (c.taxaC < 0 || c.impostoC < 0 || c.pagaOficinaC < 0 || (c.vaiParaCasaC !== null && c.vaiParaCasaC < 0)) ok = false;
                if (c.totalSeuC !== null && c.totalSeuC !== c.vaiParaCasaC + c.sobraC) ok = false;
                if ((c.vaiParaCasaC === null) !== semCasa) ok = false;
              });
            }
          });
        });
        return { obtido: ok, esperado: true };
      } },
    { id: 'FC4', descricao: 'Estados do fechamento: Pix 1.747,27 verde; Pix 800 âmbar (paga a oficina, sobra −78,77); Pix 600 vermelho (a oficina não se paga)',
      executar: function () {
        var f = cenarioFechamento();
        var e = [174727, 80000, 60000].map(function (v) { var c = calcularFechamento(f.foto, f.resultado, 'pix', null, NAO_SEI, v); return [c.estado, c.sobraC]; });
        return { obtido: e, esperado: [['verde', 81166], ['ambar', -7877], ['vermelho', -26677]] };
      } },
    { id: 'FC5', descricao: 'Foto × recalcular: com gastos novos (5.000/3.500) a conta de hoje muda (oficina 307,69); refeita com a foto gravada = resultado gravado; forma sem taxa → sem fechamento',
      executar: function () {
        var f = cenarioFechamento();
        var hoje = fotoDeHoje({ gastos: [{ tipo: 'Oficina', valor: 5000 }, { tipo: 'Casa', valor: 3500 }], parametros: f.foto.parametros, cartoes: f.foto.cartoes }, '');
        var deHoje = resultadoParaGravar(calcularComFoto(f.e, hoje));
        var refeito = resultadoParaGravar(calcularComFoto(f.e, JSON.parse(JSON.stringify(f.foto))));
        var semTaxa = calcularFechamento(f.foto, f.resultado, 'credito', 5, NAO_SEI, 100000);
        var foto2 = JSON.parse(JSON.stringify(f.foto)); foto2.cartoes = [cartaoDeTeste('Elo', { p3: 6 })];
        return { obtido: [fotosIguais(hoje, f.foto), deHoje.pagaOficinaC, JSON.stringify(refeito) === JSON.stringify(f.resultado), semTaxa !== null, calcularFechamento(foto2, f.resultado, 'credito', 5, NAO_SEI, 100000)],
                 esperado: [false, 30769, true, true, null] };
      } },
    // ---- Fase 10: resumo do mês (DESENHO 11.6) ----
    { id: 'M1', descricao: 'Mês do exemplo 11.6: faturamento 8.921,51 · peças 2.000 · taxas 374,24 · imposto 535,29 · depois da oficina 2.011,98 · casa em parte 67% · sobra −988,02 · total seu 2.011,98 · 40 de 130 h (31%) · 5 de 8 = 63% · ↑ R$ 1.421,51 (19%) · sobra ↑ R$ 511,98',
      executar: function () {
        var m = resumoDoMes(listaDoMesF(), '2026-11', { oficinaC: 400000, casaC: 300000, horas: 130 });
        var cmp = compararMeses(m, { faturamentoC: 750000, fechados: 3, resultado: { sobraDoMesC: -150000 } });
        var r = m.resultado;
        return { obtido: [m.faturamentoC, m.pecasC, m.taxasC, m.impostoC, r.depoisDaOficinaC, r.oficinaSePagou, r.casa, porcentoInteiro(r.pctCasa), r.sobraDoMesC, r.totalSeuNoMesC, r.estado,
                          m.horasVendidas, porcentoInteiro(m.pctHoras), [m.feitos, m.fecharam, m.naoFecharam, m.emAberto], porcentoInteiro(m.taxaFechamento),
                          cmp.faturamentoDifC, porcentoInteiro(cmp.faturamentoPct), cmp.sobraDifC],
                 esperado: [892151, 200000, 37424, 53529, 201198, true, 'parte', '67%', -98802, 201198, 'ambar', 40, '31%', [8, 5, 2, 1], '63%', 142151, '19%', 51198] };
      } },
    { id: 'M2', descricao: 'Mesmos fechamentos, outros gastos: casa 1.500 → casa toda, sobra 511,98 (verde); oficina 8.000 → oficina não se paga (−1.988,02), casa nada, total seu 0 (vermelho); sem foto → sem resultado',
      executar: function () {
        var verde = resumoDoMes(listaDoMesF(), '2026-11', { oficinaC: 400000, casaC: 150000, horas: 130 }).resultado;
        var verm = resumoDoMes(listaDoMesF(), '2026-11', { oficinaC: 800000, casaC: 300000, horas: 130 }).resultado;
        return { obtido: [verde.casa, verde.casaCobertaC, verde.sobraDoMesC, verde.estado, verm.depoisDaOficinaC, verm.casa, verm.casaCobertaC, verm.totalSeuNoMesC, verm.estado,
                          resumoDoMes(listaDoMesF(), '2026-11', null).resultado],
                 esperado: ['toda', 150000, 51198, 'verde', -198802, 'nada', 0, 0, 'vermelho', null] };
      } },
    { id: 'M3', descricao: 'Mês pela data do fechamento: feito em 28/10 e fechado em 03/11 → conta como feito em outubro e o dinheiro entra em novembro',
      executar: function () {
        var lista = [{ criadoEm: '2026-10-28 10:00:00', situacao: 'Fechado', dataFechamento: '2026-11-03', valorCombinadoC: 100000, pecasPagarC: 0, taxaC: 0, impostoC: 0, horas: 2 }];
        var out = resumoDoMes(lista, '2026-10', null), nov = resumoDoMes(lista, '2026-11', null);
        return { obtido: [out.feitos, out.fecharam, out.faturamentoC, nov.feitos, nov.faturamentoC, nov.horasVendidas], esperado: [1, 1, 0, 0, 100000, 2] };
      } },
    { id: 'M4', descricao: 'Navegação de meses: dez/2026 → jan/2027 e volta; nomes ("Novembro 2026", "novembro"); mesDe de data e de data e hora',
      executar: function () {
        return { obtido: [mesSeguinte('2026-12'), mesAnterior('2027-01'), deslocarMes('2026-11', -13), nomeDoMes('2026-11'), nomeDoMes('2026-03', true), mesDe('2026-11-07 10:00:00'), mesDe('2026-11-07'), mesDe('lixo'), dataBR('2026-11-07'), dataBR('2026-11-07 10:00', true)],
                 esperado: ['2027-01', '2026-12', '2025-10', 'Novembro 2026', 'março', '2026-11', '2026-11', '', '07/11/2026', '07/11'] };
      } },
    { id: 'M5', descricao: 'Busca: cliente e serviço sem acento/maiúscula; telefone só pelos números ("98888-77" acha "(11) 98888-7777"); texto não acha telefone',
      executar: function () {
        var o = { cliente: 'João da Silva', servico: 'Embreagem – Gol 2015', telefone: '(11) 98888-7777' };
        return { obtido: [combinaBusca(o, 'joao'), combinaBusca(o, 'GOL'), combinaBusca(o, '98888-77'), combinaBusca(o, '11 9888'), combinaBusca(o, 'maria'), combinaBusca(o, ''), validarTelefone('(11) 98888-7777'), validarTelefone('11 9888A') !== ''],
                 esperado: [true, true, true, true, false, true, '', true] };
      } }
  ];
}

/**
 * Cenário S (oficina/casa/sobra): gastos Oficina 4.000 e Casa 3.000; 5 dias × 6 h × 52/12 = 130 h;
 * serviço 8 h; peças pagas 400 (cobra 500, valor direto); sem cartões (âncora = base); imposto 0.
 * maoDeObraFechada: null = 8 h × 150 (preço 1.700); número = valor fechado com as mesmas 8 h (preço = valor + 500).
 */
function cenarioServico(maoDeObraFechada, semCasa) {
  var gastos = [{ tipo: 'Oficina', descricao: 'A', valor: 4000 }];
  if (!semCasa) gastos.push({ tipo: 'Casa', descricao: 'B', valor: 3000 });
  var params = { diasPorSemana: 5, horasPorDia: 8, horasCobradasPorDia: 6, valorHoraCobrado: 150, impostoPercentual: 0, parcelasDestaque: '5,10' };
  var entrada = typeof maoDeObraFechada === 'number'
    ? { modo: 'fechado', valorFechado: maoDeObraFechada, horas: 8, pecasPagar: 400, pecasModo: 'valor', pecasCobrar: 500 }
    : { modo: 'horas', horas: 8, pecasPagar: 400, pecasModo: 'valor', pecasCobrar: 500 };
  var res = calcularOrcamento(entrada, params, [], NAO_SEI, precoMinimoHora(gastos, params));
  var preco = calcularPrecoComDesconto(res, params, 5, 0);
  var ganho = separarGanho(res, preco, params, minimoHoraDoTipo(gastos, params, 'Oficina'), minimoHoraDoTipo(gastos, params, 'Casa'));
  return { res: res, preco: preco, ganho: ganho, linhas: linhasDetalheServico(res, preco, ganho) };
}

/** Cenário dos casos D: MO 12 h × 165; peças = 1 item 1 × 100, + 47%; Visa (padrão InfinitePay); imposto 10%; gasto das horas 936,92. */
function cenarioDesconto(cartoes) {
  var params = { valorHoraCobrado: 165, impostoPercentual: 10, parcelasDestaque: '5,10' };
  var entrada = { modo: 'horas', horas: 12, pecasPagar: totalPecasItens([{ qtd: 1, valor: 100 }]), pecasModo: 'acrescimo', pecasAcrescimo: 47 };
  var res = calcularOrcamento(entrada, params, cartoes || [cartaoDeTeste('Visa/Master', VISA_TESTE)], NAO_SEI, 936.92 / 12);
  return { res: res, params: params };
}

/**
 * Cenário F (DESENHO 11.6): oficina 4.000, casa 3.000, 130 h; hora 150; imposto 6%; Visa padrão; parcelas 5,10;
 * serviço 8 h; 1 peça 400 + 25%; desconto 5% → base 1.700, âncora 1.839,23, oferecido 1.747,27.
 * semCasa: sem gastos de casa; horas: outras horas de serviço (0 = sem horas).
 */
function cenarioFechamento(semCasa, horas) {
  var gastos = [{ tipo: 'Oficina', valor: 4000 }];
  if (!semCasa) gastos.push({ tipo: 'Casa', valor: 3000 });
  var dados = { gastos: gastos, cartoes: [cartaoDeTeste('Visa/Master', VISA_TESTE)],
    parametros: { diasPorSemana: 5, horasPorDia: 8, horasCobradasPorDia: 6, valorHoraCobrado: 150, impostoPercentual: 6,
      acrescimoPecasPadrao: 25, descontoAVistaPadrao: 5, parcelasDestaque: '5,10', nomeOficina: '' } };
  var foto = fotoDeHoje(dados, '2026-11-03 10:00');
  var e = { descricao: 'Pastilhas Gol 2015', modo: 'horas', horasTexto: String(horas === undefined ? 8 : horas).replace('.', ','), valorTexto: '', horasFechadoTexto: '',
    pecasModo: 'acrescimo', pecas: [{ descricao: 'Pastilha', qtdTexto: '1', valorTexto: '400' }], pecasPagarTexto: '', pecasCobrarTexto: '',
    acrescimoTexto: null, descontoTexto: null, extraTexto: '', bandeira: NAO_SEI };
  var calc = calcularComFoto(e, foto);
  return { dados: dados, foto: foto, e: e, calc: calc, resultado: resultadoParaGravar(calc) };
}

/** Lista do mês da 11.6: os 5 fechamentos do cenário F (em novembro) + 2 "Não fechou" + 1 Aberto. */
function listaDoMesF() {
  var f = cenarioFechamento();
  var fechs = [['pix', null, null], ['debito', 1, null], ['credito', 5, null], ['credito', 10, null], ['pix', null, 170000]].map(function (x) {
    var v = x[2] || valorSugeridoFechamento(f.e, f.foto, f.resultado, x[0], x[1], NAO_SEI);
    return calcularFechamento(f.foto, f.resultado, x[0], x[1], NAO_SEI, v);
  });
  var lista = fechs.map(function (c, i) {
    return { criadoEm: '2026-11-0' + (i + 1) + ' 10:00:00', situacao: 'Fechado', dataFechamento: '2026-11-07', valorCombinadoC: c.valorCombinadoC,
      pecasPagarC: c.pecasPagarC, taxaC: c.taxaC, impostoC: c.impostoC, horas: f.resultado.horas };
  });
  return lista.concat([{ criadoEm: '2026-11-02 11:00:00', situacao: 'Não fechou' }, { criadoEm: '2026-11-03 11:00:00', situacao: 'Não fechou' },
    { criadoEm: '2026-11-04 11:00:00', situacao: 'Aberto' }]);
}

/** Roda os casos e devolve [{id, descricao, passou, obtido, esperado}]. */
function rodarCasosDeTeste() {
  return casosDeTeste().map(function (c) {
    var r;
    try { r = c.executar(); } catch (e) { r = { obtido: 'ERRO: ' + e.message, esperado: '(sem erro)' }; }
    return { id: c.id, descricao: c.descricao, passou: JSON.stringify(r.obtido) === JSON.stringify(r.esperado), obtido: r.obtido, esperado: r.esperado };
  });
}
