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
  descontoAVistaPadrao: { min: 0, max: 99 },
  // Seção 16 (opcionais: planilha antiga não tem; os impostos novos nascem do impostoPercentual)
  impostoPecasPercentual:   { min: 0, max: MAX_TAXA },
  impostoServicoPercentual: { min: 0, max: MAX_TAXA },
  acrescimoTerceirosPadrao: { min: 0, max: MAX_ACRESCIMO },
  // Seção 16.9 (opcional: planilha antiga não tem; vale o descontoAVistaPadrao)
  descontoPecasPadrao: { min: 0, max: 99 }
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
  descontoAVistaPadrao: 'Use um número de 0 a 99.',
  impostoPecasPercentual: 'Use um número de 0 a 99.',
  impostoServicoPercentual: 'Use um número de 0 a 99.',
  acrescimoTerceirosPadrao: 'Use um número de 0 a 1000.',
  descontoPecasPadrao: 'Use um número de 0 a 99.'
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
  // Seção 16: com a lista de peças, cada uma tem o seu % (já somado por grupo de % em lerEntradaOrcamento).
  if (entrada.pecasModo === 'acrescimo' && typeof entrada.pecasCobrarItens === 'number') return entrada.pecasCobrarItens;
  if (entrada.pecasModo === 'acrescimo') {
    var acrescimo = typeof entrada.pecasAcrescimo === 'number' ? entrada.pecasAcrescimo : 0;
    return pagar * (1 + acrescimo / 100);
  }
  return typeof entrada.pecasCobrar === 'number' ? entrada.pecasCobrar : pagar;
}

// ---------------- Peças discriminadas ----------------
var MAX_PECAS = 30;
var MAX_TERCEIROS = 20; // seção 16: espelho de MAX_TERCEIROS_ do Codigo.gs
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
  // Seção 16: serviços de terceiros entram como as peças (custo = pago; cliente = pago × (1 + %)).
  var terceirosPagar = typeof entrada.terceirosPagar === 'number' ? entrada.terceirosPagar : 0;
  var terceirosCobrar = typeof entrada.terceirosCobrar === 'number' ? entrada.terceirosCobrar : terceirosPagar;
  var lucroTerceiros = terceirosCobrar - terceirosPagar;
  var aVista = mo.maoDeObra + pecasCobrar + terceirosCobrar;
  var gastoHoras = mo.horas * precoMinimoHora;
  var impostos = impostosDosParametros(parametros);
  var impostoPct = taxaImpostoEfetiva(impostos, mo.maoDeObra, pecasCobrar, terceirosCobrar);

  function montar(forma, parcelas, taxa) {
    var op = calcularOpcao(aVista, taxa, parcelas);
    op.forma = forma;
    op.imposto = (op.totalCentavos / 100) * impostoPct / 100;
    op.lucro = mo.maoDeObra - gastoHoras + lucroPecas + lucroTerceiros - op.imposto;
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
    terceirosPagar: terceirosPagar,
    terceirosCobrar: terceirosCobrar,
    lucroTerceiros: lucroTerceiros,
    impostoPct: impostoPct,           // taxa efetiva (seção 16)
    impostoPecasPct: impostos.pecas,
    impostoServicoPct: impostos.servico,
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
 * @param divisao (seção 16.9; ausente = regra antiga: desconto + extra sobre tudo) {descontoPecas}:
 *   o extra soma só no SERVIÇO (mão de obra + terceiros); as peças ficam com descontoPecas.
 *   A_serv = A × serviço_cliente ÷ base; A_peças = A × peças_cliente ÷ base (sem arredondar no meio);
 *   V = A_serv × (1 − (desconto + extra)/100) + A_peças × (1 − descontoPecas/100).
 *   Descontos iguais (ou sem peças / sem serviço): a conta é a de sempre, A × (1 − d/100).
 *   descontoTotal = desconto equivalente = (1 − V exato ÷ A) × 100 quando são diferentes.
 */
function calcularPrecoComDesconto(res, parametros, desconto, extra, divisao) {
  var impostoPct = typeof res.impostoPct === 'number' ? res.impostoPct : (typeof parametros.impostoPercentual === 'number' ? parametros.impostoPercentual : 0);
  var terceirosPagar = res.terceirosPagar || 0;
  var base = res.aVista.totalExato;
  var baseCentavos = res.aVista.totalCentavos;
  var ancora = res.destaques.length ? res.destaques[0] : null;
  var d = typeof desconto === 'number' && desconto > 0 ? desconto : 0;
  var x = typeof extra === 'number' && extra > 0 ? extra : 0;
  var total = ancora ? Math.min(LIMITE_DESCONTO.max, d + x) : 0;
  // Seção 16.9: desconto do serviço (com o extra) × desconto das peças
  var dServ = total;
  var dPec = total;
  var iguais = true;
  var precoExato = ancora ? ancora.totalExato * (1 - total / 100) : base;
  if (ancora && divisao) {
    var p = typeof divisao.descontoPecas === 'number' && divisao.descontoPecas > 0 ? Math.min(LIMITE_DESCONTO.max, divisao.descontoPecas) : 0;
    var pecCli = res.pecasCobrar > 0 ? res.pecasCobrar : 0;
    var servCli = res.maoDeObra + (res.terceirosCobrar || 0);
    dPec = p;
    if (!(pecCli > 0)) dPec = dServ;                       // sem peças: só o desconto do serviço
    else if (!(servCli > 0)) { dServ = dPec; total = dPec; precoExato = ancora.totalExato * (1 - dPec / 100); } // só peças
    iguais = dServ === dPec;
    if (!iguais) {
      var soma = servCli + pecCli;
      precoExato = ancora.totalExato * servCli / soma * (1 - dServ / 100) + ancora.totalExato * pecCli / soma * (1 - dPec / 100);
      total = (1 - precoExato / ancora.totalExato) * 100;
    }
  }
  var precoCentavos = ancora ? centavos(precoExato) : baseCentavos;
  var maximo = ancora ? (1 - base / ancora.totalExato) * 100 : 0;
  var imposto = (precoCentavos / 100) * impostoPct / 100;
  var lucro = precoCentavos / 100 - res.gastoHoras - res.pecasPagar - terceirosPagar - imposto;
  var difCentavos = precoCentavos - baseCentavos; // > 0: ainda pode dar; < 0: abre mão do lucro

  return {
    temAncora: !!ancora,
    ancora: ancora,
    descontoTotal: total,
    descontoServico: dServ,          // seção 16.9: % do serviço (com o extra)
    descontoPecas: dPec,             // % das peças
    descontosIguais: iguais,
    descontoReaisCentavos: ancora ? ancora.totalCentavos - precoCentavos : 0, // A − V (os valores exibidos)
    precoExato: precoExato,
    precoCentavos: precoCentavos,
    maximo: maximo,
    aindaPodePct: Math.max(0, Math.round((maximo - total) * 10000) / 10000),
    aindaPodeCentavos: Math.max(0, difCentavos),
    acimaDoMaximo: difCentavos < 0,
    abreMaoCentavos: Math.max(0, -difCentavos),
    imposto: imposto,
    lucro: lucro,
    piso: (res.gastoHoras + res.pecasPagar + terceirosPagar) / (1 - impostoPct / 100)
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
  var impostoPct = typeof res.impostoPct === 'number' ? res.impostoPct : (typeof parametros.impostoPercentual === 'number' ? parametros.impostoPercentual : 0);
  var terceiros = res.terceirosPagar || 0; // custo dos serviços de terceiros (não consome as horas dele)
  var horas = typeof res.horas === 'number' && res.horas > 0 ? res.horas : 0;
  var valor = preco.precoCentavos / 100;
  var pagaOficina = horas * minimoOficina;
  var vaiParaCasa = horas * minimoCasa;
  var sobra = valor - pagaOficina - vaiParaCasa - res.pecasPagar - terceiros - preco.imposto;
  var fator = 1 - impostoPct / 100;
  var pisoOficina = (pagaOficina + res.pecasPagar + terceiros) / fator;
  var pisoCasa = (pagaOficina + vaiParaCasa + res.pecasPagar + terceiros) / fator;
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
    lucroTerceiros: res.terceirosPagar > 0 || res.terceirosCobrar > 0 ? centavos(res.lucroTerceiros) : null,
    diferenca: null,
    imposto: null,
    impostoPecas: null,
    impostoServico: null,
    pagaOficina: centavos(ganho.pagaOficina),
    vaiParaCasa: ganho.temCasa ? centavos(ganho.vaiParaCasa) : null,
    sobra: centavos(ganho.sobra),
    totalSeu: null
  };
  var dif = preco.precoCentavos / 100 - res.aVista.totalExato;
  if (preco.temAncora && centavos(dif) !== 0) c.diferenca = centavos(dif);
  if (preco.imposto > 0) {
    c.imposto = centavos(preco.imposto);
    // "peças R$ X · serviço R$ Y" (proporcional às partes da taxa efetiva; o serviço absorve o centavo)
    var parteP = res.pecasCobrar * (res.impostoPecasPct || 0);
    var parteS = (res.maoDeObra + (res.terceirosCobrar || 0)) * (res.impostoServicoPct || 0);
    c.impostoPecas = parteP + parteS > 0 ? centavos(c.imposto / 100 * parteP / (parteP + parteS)) : 0;
    c.impostoServico = c.imposto - c.impostoPecas;
  }
  var soma = c.maoDeObra + c.lucroPecas + (c.lucroTerceiros || 0) + (c.diferenca || 0) - (c.imposto || 0) - c.pagaOficina - (c.vaiParaCasa || 0);
  var falta = soma - c.sobra; // > 0: as linhas dão mais que a sobra
  var absorve = ganho.temCasa && ganho.vaiParaCasa > 0 ? 'vaiParaCasa' : (ganho.pagaOficina > 0 ? 'pagaOficina' : 'lucroPecas');
  if (absorve === 'lucroPecas') c.lucroPecas -= falta; else c[absorve] += falta;
  if (ganho.temCasa) c.totalSeu = c.vaiParaCasa + c.sobra;
  return c;
}

// ---------------- Seção 16: imposto separado (peças × serviço) e entrada + cartão ----------------

/**
 * Os dois impostos dos parâmetros. Sem as chaves novas (planilha/foto antiga), os dois são o imposto antigo:
 * assim os números de antes não mudam.
 */
function impostosDosParametros(p) {
  var legado = typeof p.impostoPercentual === 'number' ? p.impostoPercentual : 0;
  return {
    pecas: typeof p.impostoPecasPercentual === 'number' ? p.impostoPecasPercentual : legado,
    servico: typeof p.impostoServicoPercentual === 'number' ? p.impostoServicoPercentual : legado
  };
}

/**
 * Taxa efetiva = (peças_cliente × tPeças + (mão de obra + terceiros_cliente) × tServiço) ÷ base.
 * Taxas iguais → a própria taxa (exatamente, sem conta: orçamentos antigos dão o mesmo número). Sem base → tServiço.
 */
function taxaImpostoEfetiva(impostos, maoDeObra, pecasCobrar, terceirosCobrar) {
  if (impostos.pecas === impostos.servico) return impostos.servico;
  var base = maoDeObra + pecasCobrar + terceirosCobrar;
  if (!(base > 0)) return impostos.servico;
  return (pecasCobrar * impostos.pecas + (maoDeObra + terceirosCobrar) * impostos.servico) / base;
}

/**
 * Entrada (sinal) + resto no cartão em n vezes. O desconto à vista vale só sobre a parte paga à vista:
 * V = à vista oferecido; f = E ÷ V; P_n = preço do cartão em n vezes (seção 15: até a referência = preço cheio);
 * R_n = P_n × (1 − f); parcela = arredondar(R_n ÷ n); total = E + R_n (arredondado).
 * @return null (sem entrada) | {erro} | {entradaC, parcelas, restoC, parcelaC, totalC, taxaCredito}
 */
function calcularEntradaCartao(res, preco, entrada, parcelas) {
  if (typeof entrada !== 'number' || !(entrada > 0)) return null;
  var V = preco.precoCentavos / 100;
  var entradaC = centavos(entrada);
  if (!(entradaC < preco.precoCentavos)) return { erro: 'A entrada precisa ser menor que o preço à vista (' + formatarCentavos(preco.precoCentavos) + ').' };
  var op = res.opcoes.filter(function (o) { return o.forma === 'Crédito' && o.parcelas === parcelas; })[0];
  if (!op) return null;
  var Pn = preco.temAncora && parcelas <= preco.ancora.parcelas ? preco.ancora.totalExato : op.totalExato;
  var R = Pn * (1 - entrada / V);
  var restoC = centavos(R);
  return { entradaC: entradaC, parcelas: parcelas, restoC: restoC, parcelaC: centavos(R / parcelas), totalC: entradaC + restoC, taxaCredito: op.taxa };
}

/** Parcelas que podem ir com a entrada (crédito com taxa), e a padrão = a parcela de referência (a âncora). */
function parcelasParaEntrada(res, preco) {
  var lista = res.opcoes.filter(function (o) { return o.forma === 'Crédito'; }).map(function (o) { return o.parcelas; });
  var padrao = preco.temAncora ? preco.ancora.parcelas : (lista.length ? lista[lista.length - 1] : null);
  return { lista: lista, padrao: padrao };
}

/** "Serviços inclusos" do WhatsApp, SEM valores: só as descrições (sem descrição não aparece). */
function linhasTerceirosWhatsApp(itens) {
  return (itens || []).filter(function (it) { return String(it.descricao || '').trim() !== ''; }).map(function (it) { return String(it.descricao).trim(); });
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

/** Seção 16.9: desconto padrão nas peças; sem a chave (planilha/foto antiga) = o desconto à vista padrão. */
function descontoPecasPadraoDosParametros(p) {
  var n = p ? p.descontoPecasPadrao : null;
  return dentroDoLimite(n, LIMITE_DESCONTO) ? n : descontoPadraoDosParametros(p);
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
 * Telefone: só os números, sem o +55/55 do começo (quando sobram 12 ou 13 números) e no máximo 11 (DDD + 9 números).
 * "+55 11 98888-7777" → "11988887777".
 */
function digitosDoTelefone(t) {
  var d = soNumeros(t);
  if (d.length >= 12 && d.length <= 13 && d.indexOf('55') === 0) d = d.slice(2);
  return d.slice(0, MAX_DIGITOS_TELEFONE);
}
var MAX_DIGITOS_TELEFONE = 11;

/**
 * Máscara brasileira enquanto digita: "(11" → "(11) 9888" → "(11) 3333-4444" (fixo, 10) → "(11) 98888-7777" (celular, 11).
 * Número incompleto fica como está (só formatado). Vazio → ''.
 */
function formatarTelefone(t) {
  var d = digitosDoTelefone(t);
  if (!d) return '';
  if (d.length <= 2) return '(' + d;
  var ddd = '(' + d.slice(0, 2) + ') ';
  var resto = d.slice(2);
  if (resto.length <= 4) return ddd + resto;
  var corte = d.length === 11 ? 5 : 4;
  return ddd + resto.slice(0, corte) + '-' + resto.slice(corte);
}

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

/**
 * Duas fotos com os mesmos valores (ignora a data "em").
 * Seção 16: foto de antes (sem os impostos novos nem o acréscimo dos terceiros) vale como os impostos = o antigo
 * e acréscimo 0, e a ordem das chaves não importa: um orçamento antigo não mostra "Valores de…" só por isso.
 */
function fotosIguais(a, b) {
  function ordenado(v) {
    if (Array.isArray(v)) return v.map(ordenado);
    if (!v || typeof v !== 'object') return v;
    var o = {};
    Object.keys(v).sort().forEach(function (k) { o[k] = ordenado(v[k]); });
    return o;
  }
  function sem(f) {
    var c = JSON.parse(JSON.stringify(f));
    delete c.em;
    if (c.parametros && typeof c.parametros === 'object') {
      var imp = impostosDosParametros(c.parametros);
      c.parametros.impostoPecasPercentual = imp.pecas;
      c.parametros.impostoServicoPercentual = imp.servico;
      if (typeof c.parametros.acrescimoTerceirosPadrao !== 'number') c.parametros.acrescimoTerceirosPadrao = 0;
      c.parametros.descontoPecasPadrao = descontoPecasPadraoDosParametros(c.parametros); // 16.9
    }
    return JSON.stringify(ordenado(c));
  }
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
  // Seção 16.9: descontoSeparado ausente = orçamento de antes (regra antiga: um desconto só, o extra sobre tudo);
  // null = automático (dois campos se os padrões dos Ajustes forem diferentes); true/false = escolha dele.
  var legadoDesconto = e.descontoSeparado === undefined;
  var descontoSeparado = legadoDesconto ? false
    : e.descontoSeparado === null ? descontoPecasPadraoDosParametros(parametros) !== descontoPadraoDosParametros(parametros)
    : e.descontoSeparado === true;
  var descontoPecasTexto = e.descontoPecasTexto !== null && e.descontoPecasTexto !== undefined
    ? e.descontoPecasTexto : numeroParaCampo(descontoPecasPadraoDosParametros(parametros), false);
  // % geral das peças (o do campo; inválido = 0, como antes)
  var rGeral = validarNumeroCampo(acrescimoTexto, LIMITE_ACRESCIMO, { vazioPermitido: true, mensagem: MENSAGENS_PARAMETROS.acrescimoPecasPadrao });
  var geralPecas = typeof rGeral.valor === 'number' ? rGeral.valor : 0;
  var pecas = porAcrescimo ? (e.pecas || []).map(function (p) {
    var q = validarQtdPeca(p.qtdTexto);
    var v = validarNumeroCampo(p.valorTexto, LIMITE_VALOR_ORCAMENTO, { vazioPermitido: true, mensagem: MSG_VALOR_ORCAMENTO });
    // Seção 16: % da peça (null = segue o geral)
    var proprio = p.acrescimoTexto !== null && p.acrescimoTexto !== undefined;
    var a = proprio ? validarNumeroCampo(p.acrescimoTexto, LIMITE_ACRESCIMO, { vazioPermitido: true, mensagem: MENSAGENS_PARAMETROS.acrescimoPecasPadrao }) : { valor: geralPecas, erro: '' };
    if (q.erro || v.erro || a.erro) erros.pecas = true;
    var acr = typeof a.valor === 'number' ? a.valor : 0;
    return { descricao: p.descricao, qtd: q.valor, valor: v.valor, erroQtd: q.erro, erroValor: v.erro, erroAcrescimo: a.erro || '',
      acrescimo: acr, acrescimoProprio: proprio };
  }) : [];
  // Seção 16: serviços de terceiros (sem quantidade); % de cada um (null = o padrão dos ajustes)
  var geralTerceiros = typeof parametros.acrescimoTerceirosPadrao === 'number' ? parametros.acrescimoTerceirosPadrao : 0;
  var terceiros = (e.terceiros || []).map(function (s) {
    var v = validarNumeroCampo(s.valorTexto, LIMITE_VALOR_ORCAMENTO, { vazioPermitido: true, mensagem: MSG_VALOR_ORCAMENTO });
    var proprio = s.acrescimoTexto !== null && s.acrescimoTexto !== undefined;
    var a = proprio ? validarNumeroCampo(s.acrescimoTexto, LIMITE_ACRESCIMO, { vazioPermitido: true, mensagem: MENSAGENS_PARAMETROS.acrescimoTerceirosPadrao }) : { valor: geralTerceiros, erro: '' };
    if (v.erro || a.erro) erros.terceiros = true;
    return { descricao: s.descricao, valor: v.valor, erroValor: v.erro, erroAcrescimo: a.erro || '', acrescimo: typeof a.valor === 'number' ? a.valor : 0, acrescimoProprio: proprio };
  });
  /** Σ por grupo de %: (Σ pago do grupo) × (1 + %/100). Um grupo só = a conta de antes, sem diferença de arredondamento. */
  function somaPorGrupo(itens, pago) {
    var grupos = [], porAcr = {};
    itens.forEach(function (it) {
      var k = String(it.acrescimo);
      if (!(k in porAcr)) { porAcr[k] = grupos.length; grupos.push({ acr: it.acrescimo, pago: 0 }); }
      grupos[porAcr[k]].pago += pago(it);
    });
    return grupos.reduce(function (s, g) { return s + g.pago * (1 + g.acr / 100); }, 0);
  }
  var pagoPeca = function (it) { return totalPecasItens([it]); };
  var pagoTerceiro = function (it) { return typeof it.valor === 'number' && it.valor > 0 ? it.valor : 0; };
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
    pecasCobrar: porAcrescimo ? null : campo('orc-pecas-cobrar', e.pecasCobrarTexto, LIMITE_VALOR_ORCAMENTO, MSG_VALOR_ORCAMENTO),
    pecasCobrarItens: porAcrescimo ? somaPorGrupo(pecas, pagoPeca) : null,
    terceirosPagar: terceiros.reduce(function (s, it) { return s + pagoTerceiro(it); }, 0),
    terceirosCobrar: somaPorGrupo(terceiros, pagoTerceiro)
  };
  // Seção 16: entrada (sinal) — valor, forma (pix | debito) e parcelas do resto no cartão (null = a de referência)
  var entradaSinal = campo('orc-entrada', e.entradaTexto, LIMITE_VALOR_ORCAMENTO, MSG_VALOR_ORCAMENTO);
  return {
    entrada: entrada,
    pecas: pecas,
    terceiros: terceiros,
    entradaSinal: entradaSinal,
    formaEntrada: e.formaEntrada === 'debito' ? 'debito' : 'pix',
    parcelasEntrada: typeof e.parcelasEntrada === 'number' ? e.parcelasEntrada : null,
    desconto: campo('orc-desconto', descontoTexto, LIMITE_DESCONTO, MSG_DESCONTO),
    legadoDesconto: legadoDesconto,
    descontoSeparado: descontoSeparado,
    descontoPecas: descontoSeparado ? campo('orc-desconto-pecas', descontoPecasTexto, LIMITE_DESCONTO, MSG_DESCONTO) : null,
    descontoPecasTexto: descontoPecasTexto,
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
  // Seção 16.9 (opção b): só com os DOIS campos abertos (serviço × peças) o extra soma só no serviço e as peças têm o
  // desconto delas. Campo único (e orçamento de antes): a regra de sempre, desconto + extra sobre o preço todo.
  var divisao = lido.descontoSeparado ? { descontoPecas: lido.descontoPecas } : undefined;
  var preco = calcularPrecoComDesconto(res, ctx.parametros, lido.desconto, lido.extra, divisao);
  var ganho = separarGanho(res, preco, ctx.parametros, ctx.minimoOficina, ctx.minimoCasa);
  var pe = parcelasParaEntrada(res, preco);
  var nEntrada = lido.parcelasEntrada !== null && pe.lista.indexOf(lido.parcelasEntrada) >= 0 ? lido.parcelasEntrada : pe.padrao;
  return { ctx: ctx, lido: lido, bandeira: bandeira, res: res, preco: preco, ganho: ganho, det: linhasDetalheServico(res, preco, ganho),
    outras: res.outras.map(function (op) { return precoNaForma(preco, op); }),
    parcelasEntrada: { lista: pe.lista, escolhida: nEntrada },
    entradaCartao: nEntrada ? calcularEntradaCartao(res, preco, lido.entradaSinal, nEntrada) : null };
}

/** O que vai para a planilha como "resultado" (centavos inteiros, os valores EXIBIDOS). */
function resultadoParaGravar(c) {
  function op(o) { return { parcelas: o.parcelas, totalC: o.totalCentavos, parcelaC: o.parcelaCentavos }; }
  var horas = typeof c.res.horas === 'number' && isFinite(c.res.horas) && c.res.horas > 0 ? c.res.horas : 0;
  return {
    horas: horas,
    pecasPagarC: centavos(c.res.pecasPagar),
    pecasCobrarC: centavos(c.res.pecasCobrar),
    terceirosPagarC: centavos(c.res.terceirosPagar || 0),
    terceirosCobrarC: centavos(c.res.terceirosCobrar || 0),
    impostoEfetivoPct: c.res.impostoPct,
    aVistaBaseC: c.res.aVista.totalCentavos,
    ancora: c.preco.ancora ? op(c.preco.ancora) : null,
    descontoTotal: c.preco.descontoTotal,
    descontoServico: c.preco.descontoServico, // seção 16.9
    descontoPecas: c.preco.descontoPecas,
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
  // Regra do preço por forma (DESENHO 15): com âncora, débito = o à vista oferecido; crédito até a parcela de
  // referência = o preço cheio (total da âncora). Acima da referência, ou sem âncora: como antes (sobre a base).
  if (resultado.ancora) {
    if (forma === 'debito') return resultado.oferecidoC;
    if (forma === 'credito' && parcelas <= resultado.ancora.parcelas) return resultado.ancora.totalC;
  }
  var c = calcularComFoto(Object.assign({}, entrada, { bandeira: cartao }), foto);
  var campo = campoDaFormaFechamento(forma, parcelas);
  var ops = c.res.opcoes.filter(function (o) { return (campo === 'debito' ? o.forma === 'Débito' : o.forma === 'Crédito' && o.parcelas === parcelas); });
  return ops.length ? ops[0].totalCentavos : null;
}

/**
 * Preço que o cliente paga numa forma (DESENHO 15). Com âncora (taxa na 1ª parcela em destaque):
 * - Débito: o à vista oferecido (o mesmo do Pix);
 * - Crédito 1x até a parcela de referência (a âncora): o preço cheio (total da âncora); parcela = arredondar(total exato ÷ n);
 * - Crédito acima da referência: como antes (base ÷ (1 − taxa da parcela)).
 * Sem âncora: como antes. Só muda o PREÇO (a sobra de cada forma é a do preço, menos a taxa daquela forma).
 * @return {forma, parcelas, taxa, totalCentavos, parcelaCentavos, regra: 'avista'|'cheio'|'base'}
 */
function precoNaForma(preco, op) {
  var p = { forma: op.forma, parcelas: op.parcelas, taxa: op.taxa, totalCentavos: op.totalCentavos, parcelaCentavos: op.parcelaCentavos, regra: 'base' };
  if (!preco || !preco.temAncora) return p;
  var anc = preco.ancora;
  if (op.forma === 'Débito') { p.totalCentavos = preco.precoCentavos; p.parcelaCentavos = preco.precoCentavos; p.regra = 'avista'; }
  else if (op.forma === 'Crédito' && op.parcelas <= anc.parcelas) { p.totalCentavos = anc.totalCentavos; p.parcelaCentavos = centavos(anc.totalExato / op.parcelas); p.regra = 'cheio'; }
  return p;
}

/**
 * Fechamento em débito com valor abaixo do preço que cobre a taxa do débito (base ÷ (1 − taxa)), por causa de um
 * desconto grande: quanto fica abaixo (centavos; 0 se não fica). Só para o aviso; a conta do fechamento não muda.
 */
function abaixoDoPrecoNoDebito(resultado, f) {
  if (!f || f.forma !== 'debito' || !(f.taxaPct > 0)) return 0;
  var precoDebito = centavos(resultado.aVistaBaseC / 100 / (1 - f.taxaPct / 100));
  return Math.max(0, precoDebito - f.valorCombinadoC);
}

/**
 * Fechamento (sem arredondar no meio):
 * taxa = V × taxa%; imposto = V × imposto% (da foto); oficina e casa = horas × mínimos da foto;
 * sobra = V − taxa − imposto − peças pagas − oficina − casa; totalSeu = casa + sobra.
 * Cada linha é arredondada sozinha e "Vai para a sua casa" absorve a diferença (sem casa: "Paga a oficina";
 * sem horas: a própria sobra), para V − taxa − imposto − peças − oficina − casa = sobra no centavo.
 * @return objeto pronto para mudarSituacao (falta só a data) ou null se a forma não tem taxa
 */
function calcularFechamento(foto, resultado, forma, parcelas, cartao, valorCombinadoC, entrada) {
  // Seção 16: imposto = a taxa efetiva gravada no orçamento (registro antigo: o imposto da foto, como antes);
  // terceiros pagos entram como as peças; forma 'entrada' = entrada (Pix ou débito) + resto no cartão em n vezes.
  var impPct = typeof resultado.impostoEfetivoPct === 'number' ? resultado.impostoEfetivoPct
    : (typeof foto.parametros.impostoPercentual === 'number' ? foto.parametros.impostoPercentual : 0);
  var comEntrada = forma === 'entrada';
  var ef = forma === 'pix' ? NAO_SEI : cartaoEfetivo(foto.cartoes, cartao);
  var campo = comEntrada ? 'p' + parcelas : campoDaFormaFechamento(forma, parcelas);
  var taxaPct = forma === 'pix' ? 0 : taxaDaForma(foto.cartoes, campo, ef);
  if (taxaPct === null || (forma !== 'pix' && !foto.cartoes.length)) return null;
  var entradaC = 0, formaEntrada = '', taxaEntradaPct = 0;
  if (comEntrada) {
    entradaC = entrada && typeof entrada.entradaC === 'number' ? entrada.entradaC : 0;
    formaEntrada = entrada && entrada.formaEntrada === 'debito' ? 'debito' : 'pix';
    if (!(entradaC > 0) || !(entradaC < valorCombinadoC)) return null;
    if (formaEntrada === 'debito') {
      taxaEntradaPct = taxaDaForma(foto.cartoes, 'debito', ef);
      if (taxaEntradaPct === null) return null;
    }
  }
  var V = valorCombinadoC / 100;
  var E = entradaC / 100;
  var taxa = comEntrada ? (V - E) * taxaPct / 100 + E * taxaEntradaPct / 100 : V * taxaPct / 100;
  var imposto = V * impPct / 100;
  var horas = resultado.horas > 0 ? resultado.horas : 0;
  var oficina = horas * foto.minimoHoraOficina;
  var casa = horas * foto.minimoHoraCasa;
  var temCasa = foto.minimoHoraCasa > 0;
  var pecas = resultado.pecasPagarC / 100;
  var terceirosC = resultado.terceirosPagarC || 0;
  var terceiros = terceirosC / 100;
  var sobra = V - taxa - imposto - pecas - terceiros - oficina - casa;
  var c = { taxaC: centavos(taxa), impostoC: centavos(imposto), pagaOficinaC: centavos(oficina),
    vaiParaCasaC: temCasa ? centavos(casa) : null, sobraC: centavos(sobra) };
  var falta = valorCombinadoC - c.taxaC - c.impostoC - resultado.pecasPagarC - terceirosC - c.pagaOficinaC - (c.vaiParaCasaC || 0) - c.sobraC;
  if (falta !== 0) {
    if (temCasa && casa > 0 && c.vaiParaCasaC + falta >= 0) c.vaiParaCasaC += falta;
    else if (oficina > 0 && c.pagaOficinaC + falta >= 0) c.pagaOficinaC += falta;
    else c.sobraC += falta;
  }
  var depoisDaOficina = V - taxa - imposto - pecas - terceiros - oficina;
  var f = {
    forma: forma,
    parcelas: forma === 'pix' ? null : forma === 'debito' ? 1 : parcelas,
    cartao: forma === 'pix' ? '' : ef,
    taxaPct: taxaPct,
    valorCombinadoC: valorCombinadoC,
    taxaC: c.taxaC,
    impostoC: c.impostoC,
    pecasPagarC: resultado.pecasPagarC,
    terceirosPagarC: terceirosC,
    pagaOficinaC: c.pagaOficinaC,
    vaiParaCasaC: c.vaiParaCasaC,
    sobraC: c.sobraC,
    totalSeuC: temCasa ? c.vaiParaCasaC + c.sobraC : null,
    estado: c.sobraC >= 0 ? 'verde' : (depoisDaOficina >= 0 ? 'ambar' : 'vermelho')
  };
  if (comEntrada) { f.entradaC = entradaC; f.formaEntrada = formaEntrada; f.taxaEntradaPct = taxaEntradaPct; }
  // Seção 16.9: os descontos do orçamento ficam gravados no fechamento (orçamento de antes não tem)
  if (typeof resultado.descontoServico === 'number' && typeof resultado.descontoPecas === 'number') {
    f.descontoServicoPct = resultado.descontoServico;
    f.descontoPecasPct = resultado.descontoPecas;
    f.descontoEquivalentePct = resultado.descontoTotal;
  }
  return f;
}

/**
 * Valor combinado sugerido na forma "Entrada + cartão": entrada + resto no cartão (seção 16), com os valores GRAVADOS
 * do orçamento (o à vista oferecido e o preço do cartão em n vezes pela regra da seção 15).
 * @return centavos ou null (entrada fora de 0 < E < à vista, ou parcela sem taxa)
 */
function valorSugeridoEntrada(entrada, foto, resultado, parcelas, cartao, entradaC) {
  if (!(entradaC > 0) || !(entradaC < resultado.oferecidoC)) return null;
  var PnC = valorSugeridoFechamento(entrada, foto, resultado, 'credito', parcelas, cartao);
  if (PnC === null) return null;
  var R = PnC / 100 * (1 - entradaC / resultado.oferecidoC);
  return entradaC + centavos(R);
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
    terceirosC: soma('terceirosPagarC'),  // seção 16 (registros antigos: 0)
    taxasC: soma('taxaC'),
    impostoC: soma('impostoC'),
    horasVendidas: Math.round(soma('horas') * 10000) / 10000,
    horasPossiveis: fotoMes ? fotoMes.horas : null,
    resultado: null
  };
  r.pctHoras = fotoMes && fotoMes.horas > 0 ? r.horasVendidas / fotoMes.horas : null;
  if (fotoMes) {
    var depois = r.faturamentoC - r.pecasC - r.terceirosC - r.taxasC - r.impostoC - fotoMes.oficinaC;
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

// ---------- Fase 11: card principal do mês, quanto falta trabalhar, extrato e alerta do piso ----------

/**
 * Card principal do mês (só apresentação; as contas são as do resumoDoMes):
 * livre = F − P − T − I; barra da oficina = livre ÷ GO; barra da casa = casa coberta ÷ GC;
 * frase: oficina não coberta → falta da oficina; casa não coberta → falta da casa; senão → sobrou.
 * No mês corrente a falta é âmbar (nunca vermelho); num mês que já passou, vermelho.
 * @return null sem gastos do mês
 */
function painelDoMes(resumo, corrente) {
  var r = resumo.resultado;
  if (!r) return null;
  var livreC = r.depoisDaOficinaC + r.gastosOficinaC;
  var p = {
    livreC: livreC,
    gastosOficinaC: r.gastosOficinaC,
    gastosCasaC: r.gastosCasaC,
    oficinaPaga: r.depoisDaOficinaC >= 0,
    oficinaCobertaC: Math.min(Math.max(livreC, 0), r.gastosOficinaC),
    pctOficina: r.gastosOficinaC > 0 ? Math.min(Math.max(livreC, 0) / r.gastosOficinaC, 1) : 1,
    temCasa: r.gastosCasaC > 0,
    casaCobertaC: r.casaCobertaC,
    pctCasa: r.gastosCasaC > 0 ? r.casaCobertaC / r.gastosCasaC : null,
    corrente: !!corrente
  };
  if (r.depoisDaOficinaC < 0) p.frase = { tipo: 'faltaOficina', valorC: -r.depoisDaOficinaC };
  else if (r.sobraDoMesC < 0) p.frase = { tipo: 'faltaCasa', valorC: -r.sobraDoMesC };
  else p.frase = { tipo: 'sobrou', valorC: r.sobraDoMesC };
  p.frase.tom = p.frase.tipo === 'sobrou' ? 'verde' : corrente ? 'ambar' : 'vermelho';
  return p;
}

/** A frase grande do card do mês (mês corrente: "este mês"; mês passado: no passado). */
function fraseDoMes(p) {
  var v = formatarCentavos(p.frase.valorC);
  var este = p.corrente ? ' este mês' : '';
  if (p.frase.tipo === 'sobrou') return 'Sobrou ' + v + ' além ' + (p.temCasa ? 'da casa' : 'da oficina') + este;
  var verbo = p.corrente ? 'Faltam ' : 'Faltaram ';
  return verbo + v + (p.frase.tipo === 'faltaOficina' ? ' para pagar a oficina' : ' para cobrir a casa') + este;
}

/**
 * Quanto falta trabalhar (só no mês corrente, só se a sobra do mês for negativa, com horas vendidas e livre > 0):
 * falta = −sobra do mês; ganho livre por hora = livre ÷ horas vendidas;
 * N = ⌈falta ÷ ganho por hora⌉ (conta feita como falta × horas ÷ livre, sem arredondar o R$/h no meio);
 * média = horas vendidas ÷ serviços fechados; M = ⌈N ÷ média⌉.
 * @return null ou {faltaC, porHoraC, horas, servicos, mediaHoras}
 */
function quantoFaltaTrabalhar(resumo, corrente) {
  var r = resumo.resultado;
  if (!corrente || !r || r.sobraDoMesC >= 0 || !(resumo.horasVendidas > 0) || !(resumo.fechados > 0)) return null;
  var livreC = r.depoisDaOficinaC + r.gastosOficinaC;
  if (livreC <= 0) return null;
  var faltaC = -r.sobraDoMesC;
  var horas = Math.ceil(faltaC * resumo.horasVendidas / livreC - 1e-9);
  var media = resumo.horasVendidas / resumo.fechados;
  return {
    faltaC: faltaC,
    porHoraC: Math.round(livreC / resumo.horasVendidas),
    horas: horas,
    servicos: Math.ceil(horas / media - 1e-9),
    mediaHoras: media
  };
}

/**
 * Extrato do mês, de cima para baixo, em centavos inteiros (fecha por construção):
 * Entrou − Peças − Maquininha − Imposto − Gastos da oficina = Ficou para a casa − Gastos da casa = Sobra extra.
 * @return [{rotulo, valorC, tipo: 'entrou'|'sai'|'subtotal'|'total'}] ou null sem gastos do mês
 */
function extratoDoMes(resumo) {
  var r = resumo.resultado;
  if (!r) return null;
  var linhas = [
    { rotulo: 'Entrou', valorC: resumo.faturamentoC, tipo: 'entrou' },
    { rotulo: 'Peças', valorC: resumo.pecasC, tipo: 'sai' }
  ].concat(resumo.terceirosC > 0 ? [{ rotulo: 'Serviços de terceiros', valorC: resumo.terceirosC, tipo: 'sai' }] : []).concat([
    { rotulo: 'Maquininha', valorC: resumo.taxasC, tipo: 'sai' },
    { rotulo: 'Imposto', valorC: resumo.impostoC, tipo: 'sai' },
    { rotulo: 'Gastos da oficina', valorC: r.gastosOficinaC, tipo: 'sai' },
    { rotulo: r.depoisDaOficinaC >= 0 ? 'Ficou para a casa' : 'Faltou para a oficina', valorC: r.depoisDaOficinaC, tipo: 'subtotal' }
  ]);
  if (r.gastosCasaC > 0) {
    linhas.push({ rotulo: 'Gastos da casa', valorC: r.gastosCasaC, tipo: 'sai' });
    linhas.push({ rotulo: r.sobraDoMesC >= 0 ? 'Sobra extra' : 'Faltou', valorC: r.sobraDoMesC, tipo: 'total' });
  } else {
    linhas[linhas.length - 1].tipo = 'total';
    if (r.depoisDaOficinaC >= 0) linhas[linhas.length - 1].rotulo = 'Sobra extra';
  }
  return linhas;
}

/**
 * Alerta do piso (só quando perto ou abaixo): preço abaixo do piso da oficina → vermelho;
 * senão, até 10% acima do piso da casa (sem casa: da oficina) → âmbar. Tudo em centavos.
 * @return null ou {tom: 'vermelho'|'ambar', piso: 'oficina'|'casa', pisoC}
 */
function alertaDoPiso(precoC, pisoOficinaC, pisoCasaC, temCasa) {
  if (precoC < pisoOficinaC) return { tom: 'vermelho', piso: 'oficina', pisoC: pisoOficinaC };
  var piso = temCasa ? pisoCasaC : pisoOficinaC;
  if (precoC * 100 <= piso * 110) return { tom: 'ambar', piso: temCasa ? 'casa' : 'oficina', pisoC: piso };
  return null;
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
/** Forma do fechamento em palavras: "Pix/dinheiro", "Débito", "Cartão em 5x", "Entrada + cartão em 5x". */
function descreverFormaFechamento(f) {
  if (f.forma === 'credito') return 'Cartão em ' + f.parcelas + 'x';
  if (f.forma === 'entrada') return 'Entrada + cartão em ' + f.parcelas + 'x';
  return f.forma === 'debito' ? 'Débito' : 'Pix/dinheiro';
}

function textoWhatsApp(res, parametros, descricao, preco, pecas, extras) {
  extras = extras || {};
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
  var listaTerceiros = linhasTerceirosWhatsApp(extras.terceiros);
  if (listaTerceiros.length) {
    linhas.push('Serviços inclusos:');
    listaTerceiros.forEach(function (l) { linhas.push(l); });
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

  // Seção 16: entrada + resto no cartão (uma linha só, com as parcelas escolhidas no bloco da entrada)
  var en = extras.entrada;
  if (en && !en.erro && en.entradaC > 0) {
    linhas.push('💳 Entrada de ' + formatarCentavos(en.entradaC) + (extras.formaEntrada === 'debito' ? ' no débito' : ' no Pix') + ' + ' + en.parcelas + 'x de ' +
      formatarCentavos(en.parcelaC) + ' no cartão (total ' + formatarCentavos(en.totalC) + ')');
  }
  var aVistaCentavos = preco ? preco.precoCentavos : res.aVista.totalCentavos;
  var comDesconto = preco && preco.temAncora && preco.descontoTotal > 0;
  // Com âncora, o débito paga o mesmo preço do Pix (DESENHO 15).
  var rotulo = preco && preco.temAncora ? 'À vista (Pix, dinheiro ou débito)' : 'À vista (Pix/dinheiro)';
  // Seção 16.9: descontos diferentes (serviço × peças) → o desconto em reais (A − V)
  var emReais = comDesconto && preco.descontosIguais === false;
  linhas.push('💵 ' + rotulo + ': *' + formatarCentavos(aVistaCentavos) + '*' +
    (emReais ? ' (' + formatarCentavos(preco.descontoReaisCentavos) + ' de desconto)'
      : comDesconto ? ' — ' + formatarPercentual(preco.descontoTotal) + ' de desconto' : ''));
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
                 esperado: [false, '💵 À vista (Pix, dinheiro ou débito): *R$ 2.186,14* — 5% de desconto', '💵 À vista (Pix, dinheiro ou débito): *R$ 2.301,20*', false] };
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
    { id: 'FC1', descricao: 'Fechamentos do cenário F: Pix 1.747,27 · Débito 1.747,27 (= Pix, regra da seção 15; antes 1.723,61) · 5x 1.839,23 · 10x 1.911,40 · Pix alterado 1.700 → taxa, imposto, oficina, casa, sobra e total que é seu',
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
          [174727, 2394, 10484, 40000, 24615, 18461, 78773, 97234], // débito = preço do Pix (seção 15); a casa absorve o centavo
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
      } },
    { id: 'TEL1', descricao: 'Máscara do telefone: celular (11) 98888-7777; fixo (11) 3333-4444; colar com +55/55 e símbolos; só números; no máximo 11; incompleto formatado como está; busca com e sem máscara',
      executar: function () {
        var o = { cliente: '', servico: '', telefone: '(11) 98888-7777' };
        var antigo = { cliente: '', servico: '', telefone: '11988887777' };
        return { obtido: [formatarTelefone('11988887777'), formatarTelefone('1133334444'), formatarTelefone('+55 11 98888-7777'), formatarTelefone('55 11 3333-4444'), formatarTelefone('(11)98888-7777'),
                          formatarTelefone('11a98b888'), formatarTelefone('119888877776'), formatarTelefone('1'), formatarTelefone('11'), formatarTelefone('119'), formatarTelefone('1198888'), formatarTelefone(''), formatarTelefone('55 98888-7777'),
                          combinaBusca(o, '98888'), combinaBusca(o, '(11) 9888'), combinaBusca(antigo, '(11) 9888'), combinaBusca(antigo, '98888-7777'), validarTelefone(formatarTelefone('+55 11 98888-7777'))],
                 esperado: ['(11) 98888-7777', '(11) 3333-4444', '(11) 98888-7777', '(11) 3333-4444', '(11) 98888-7777',
                            '(11) 9888-8', '(11) 98888-7777', '(1', '(11', '(11) 9', '(11) 9888-8', '', '(55) 98888-7777',
                            true, true, true, true, ''] };
      } },
    // ---- Seção 16: % por peça (PC), serviços de terceiros (TS), entrada + cartão (EN), imposto separado (IM) ----
    { id: 'PC1', descricao: '% por peça: A 2 × 50 a 47% (geral) = 147 + B 1 × 300 a 20% (à mão) = 360 → 507; geral 30% → A 130, B 360 (490); "↺" em B → 390 (520)',
      executar: function () {
        var p = { acrescimoPecasPadrao: 47, descontoAVistaPadrao: 5 };
        var e = function (geral, acrB) { return { modo: 'horas', horasTexto: '', pecasModo: 'acrescimo', acrescimoTexto: geral, descontoTexto: null, extraTexto: '',
          pecas: [{ descricao: 'A', qtdTexto: '2', valorTexto: '50', acrescimoTexto: null }, { descricao: 'B', qtdTexto: '1', valorTexto: '300', acrescimoTexto: acrB }] }; };
        var cobrar = function (x) { var l = lerEntradaOrcamento(x, p); return [centavos(calcularPecasCobrar(l.entrada)), l.pecas.map(function (it) { return centavos(totalPecasItens([it]) * (1 + it.acrescimo / 100)); }), l.pecas.map(function (it) { return it.acrescimoProprio; })]; };
        return { obtido: [cobrar(e(null, '20')), cobrar(e('30', '20')), cobrar(e('30', null))],
                 esperado: [[50700, [14700, 36000], [false, true]], [49000, [13000, 36000], [false, true]], [52000, [13000, 39000], [false, false]]] };
      } },
    { id: 'PC2', descricao: 'Orçamento antigo (peças sem % próprio) = a conta de antes, centavo por centavo (vários valores e % com casas decimais)',
      executar: function () {
        var p = { acrescimoPecasPadrao: 47, descontoAVistaPadrao: 5 };
        var ok = [['47', [['3', '33,33'], ['1', '0,07'], ['4,5', '30']]], ['12,5', [['7', '19,99'], ['2', '100,01']]], ['0', [['1', '1']]], ['33,3333', [['3', '10,10'], ['1', '9,99']]]].every(function (c) {
          var l = lerEntradaOrcamento({ modo: 'horas', pecasModo: 'acrescimo', acrescimoTexto: c[0], pecas: c[1].map(function (x) { return { descricao: 'x', qtdTexto: x[0], valorTexto: x[1] }; }) }, p);
          var antes = l.entrada.pecasPagar * (1 + l.entrada.pecasAcrescimo / 100); // a fórmula de antes da seção 16
          return calcularPecasCobrar(l.entrada) === antes;
        });
        return { obtido: ok, esperado: true };
      } },
    { id: 'PC3', descricao: '% da peça inválido (1001 ou letras) → erro na peça; vazio → 0%',
      executar: function () {
        var p = { acrescimoPecasPadrao: 47 };
        var l = function (acr) { return lerEntradaOrcamento({ modo: 'horas', pecasModo: 'acrescimo', acrescimoTexto: null, pecas: [{ descricao: 'x', qtdTexto: '1', valorTexto: '100', acrescimoTexto: acr }] }, p); };
        return { obtido: [!!l('1001').erros.pecas, !!l('abc').erros.pecas, centavos(calcularPecasCobrar(l('').entrada)), !!l('').erros.pecas], esperado: [true, true, 10000, false] };
      } },
    { id: 'TS1', descricao: 'Terceiros: eletricista 100 a 0% → cliente 100, ganho 0 (base 1.100); a 30% → cliente 130, ganho 30 (base 1.130)',
      executar: function () {
        var c0 = cenarioTerceiros('0').calc, c30 = cenarioTerceiros('30').calc;
        return { obtido: [[centavos(c0.res.terceirosCobrar), centavos(c0.res.lucroTerceiros), c0.res.aVista.totalCentavos], [centavos(c30.res.terceirosCobrar), centavos(c30.res.lucroTerceiros), c30.res.aVista.totalCentavos]],
                 esperado: [[10000, 0, 110000], [13000, 3000, 113000]] };
      } },
    { id: 'TS2', descricao: 'Terceiros a 30%: sobra = 1.130 − 246,15 − 184,62 − 100 = 599,23; pisos com o custo dos terceiros (oficina 346,15 · casa 530,77); detalhes com "Ganho nos serviços de terceiros" fecham no centavo (R8)',
      executar: function () {
        var c = cenarioTerceiros('30').calc, d = c.det;
        var soma = d.maoDeObra + d.lucroPecas + (d.lucroTerceiros || 0) + (d.diferenca || 0) - (d.imposto || 0) - d.pagaOficina - (d.vaiParaCasa || 0);
        return { obtido: [d.sobra, d.lucroTerceiros, centavos(c.ganho.pisoOficina), centavos(c.ganho.pisoCasa), soma === d.sobra, d.totalSeu],
                 esperado: [59923, 3000, 34615, 53077, true, 78385] };
      } },
    { id: 'TS3', descricao: 'Fechamento no Pix com terceiros: 1.130 − 100 (terceiros) − 246,15 − 184,62 = 599,23; terceiros pagos gravados (10.000); soma no centavo',
      executar: function () {
        var s = cenarioTerceiros('30');
        var f = calcularFechamento(s.foto, s.resultado, 'pix', null, NAO_SEI, s.resultado.oferecidoC);
        return { obtido: [s.resultado.terceirosPagarC, s.resultado.terceirosCobrarC, f.terceirosPagarC, f.sobraC, f.valorCombinadoC - f.taxaC - f.impostoC - f.pecasPagarC - f.terceirosPagarC - f.pagaOficinaC - (f.vaiParaCasaC || 0) === f.sobraC],
                 esperado: [10000, 13000, 10000, 59923, true] };
      } },
    { id: 'TS4', descricao: 'Extrato do mês com terceiros: "− Serviços de terceiros" entre Peças e Maquininha; fecha no centavo; mês sem terceiros = extrato de antes',
      executar: function () {
        var lista = listaDoMesQ().map(function (o, i) { var x = JSON.parse(JSON.stringify(o)); if (i === 0) x.terceirosPagarC = 20000; return x; });
        var foto = { oficinaC: 315000, casaC: 550000, horas: 130 };
        var m = resumoDoMes(lista, '2026-11', foto), e = extratoDoMes(m);
        var semTerc = extratoDoMes(resumoDoMes(listaDoMesQ(), '2026-11', foto)).map(function (l) { return l.rotulo; });
        var v = e.map(function (l) { return l.valorC; });
        return { obtido: [e.map(function (l) { return l.rotulo; }), v[0] - v[1] - v[2] - v[3] - v[4] - v[5] === v[6], v[6] - v[7] === v[8], m.resultado.depoisDaOficinaC, semTerc.indexOf('Serviços de terceiros')],
                 esperado: [['Entrou', 'Peças', 'Serviços de terceiros', 'Maquininha', 'Imposto', 'Gastos da oficina', 'Ficou para a casa', 'Gastos da casa', 'Faltou'], true, true, 58096, -1] };
      } },
    { id: 'EN1', descricao: 'Entrada: âncora 5x 5.000,00; desconto 5% → à vista 4.750,00; entrada 1.000 no Pix → f = 0,2105…; resto 5x = 3.947,37 (5× 789,47); total 4.947,37',
      executar: function () {
        var c = cenarioEntrada('1000', 'pix', 5).calc, en = c.entradaCartao;
        return { obtido: [c.preco.ancora.totalCentavos, c.preco.precoCentavos, en.entradaC, en.restoC, en.parcelaC, en.totalC], esperado: [500000, 475000, 100000, 394737, 78947, 494737] };
      } },
    { id: 'EN2', descricao: 'Entrada com 10x (acima da referência): P10 = 4.621,50 ÷ 0,8894 = 5.196,20 → resto 4.102,26 (10× 410,23); total 5.102,26; padrão das parcelas = a referência (5x)',
      executar: function () {
        var c10 = cenarioEntrada('1000', 'pix', 10).calc, c = cenarioEntrada('1000', 'pix', null).calc;
        return { obtido: [c10.entradaCartao.restoC, c10.entradaCartao.parcelaC, c10.entradaCartao.totalC, c.parcelasEntrada.escolhida, c.entradaCartao.parcelas], esperado: [410226, 41023, 510226, 5, 5] };
      } },
    { id: 'EN3', descricao: 'Fechamento "Entrada + cartão" 5x: valor sugerido 4.947,37; taxa só sobre o resto (3.947,37 × 7,57% = 298,82); entrada no débito: + 1.000 × 1,37% = 312,52; soma no centavo',
      executar: function () {
        var s = cenarioEntrada('1000', 'pix', 5);
        var v = valorSugeridoEntrada(s.e, s.foto, s.resultado, 5, NAO_SEI, 100000);
        var pix = calcularFechamento(s.foto, s.resultado, 'entrada', 5, NAO_SEI, v, { entradaC: 100000, formaEntrada: 'pix' });
        var deb = calcularFechamento(s.foto, s.resultado, 'entrada', 5, NAO_SEI, v, { entradaC: 100000, formaEntrada: 'debito' });
        var fecha = function (f) { return f.valorCombinadoC - f.taxaC - f.impostoC - f.pecasPagarC - f.terceirosPagarC - f.pagaOficinaC - (f.vaiParaCasaC || 0) === f.sobraC; };
        return { obtido: [v, pix.taxaC, [deb.taxaC, deb.taxaEntradaPct, deb.formaEntrada], fecha(pix) && fecha(deb), [pix.forma, pix.parcelas, pix.entradaC]], esperado: [494737, 29882, [31252, 1.37, 'debito'], true, ['entrada', 5, 100000]] };
      } },
    { id: 'EN4', descricao: 'Validação da entrada: igual ou maior que o à vista → aviso; 0/vazio → sem entrada; no fechamento, entrada ≥ valor combinado → sem conta; WhatsApp com UMA linha da entrada',
      executar: function () {
        var igual = cenarioEntrada('4750', 'pix', 5).calc.entradaCartao, zero = cenarioEntrada('0', 'pix', 5).calc.entradaCartao;
        var s = cenarioEntrada('1000', 'pix', 5);
        var f = calcularFechamento(s.foto, s.resultado, 'entrada', 5, NAO_SEI, 100000, { entradaC: 100000, formaEntrada: 'pix' });
        var zap = textoWhatsApp(s.calc.res, { nomeOficina: '' }, '', s.calc.preco, [], { entrada: s.calc.entradaCartao, formaEntrada: 'pix' }).split('\n');
        var linhasEntrada = zap.filter(function (l) { return /Entrada de/.test(l); }).map(function (l) { return l.replace(/\u00a0/g, ' '); });
        return { obtido: [igual.erro, zero, f, linhasEntrada, /À vista/.test(zap[zap.length - 1])],
                 esperado: ['A entrada precisa ser menor que o preço à vista (' + formatarCentavos(475000) + ').', null, null, ['💳 Entrada de R$ 1.000,00 no Pix + 5x de R$ 789,47 no cartão (total R$ 4.947,37)'], true] };
      } },
    { id: 'IM1', descricao: 'Imposto separado: mão de obra 1.000 + peças cliente 500 = base 1.500; peças 4%, serviço 6% → efetiva 80 ÷ 1.500 = 5,3333%; à vista 1.500 → imposto 80,00 (peças 20,00 · serviço 60,00)',
      executar: function () {
        var c = cenarioImposto(false).calc;
        return { obtido: [Math.round(c.res.impostoPct * 1e6) / 1e6, c.preco.precoCentavos, c.det.imposto, c.det.impostoPecas, c.det.impostoServico], esperado: [5.333333, 150000, 8000, 2000, 6000] };
      } },
    { id: 'IM2', descricao: 'Com terceiros 100 a 30% (cliente 130): base 1.630; efetiva = (20 + 67,80) ÷ 1.630 = 87,80 ÷ 1.630 = 5,3865%; imposto 87,80 (peças 20,00 · serviço 67,80)',
      executar: function () {
        var c = cenarioImposto(true).calc;
        return { obtido: [c.preco.precoCentavos, Math.round(c.res.impostoPct * 1e6) / 1e6, c.det.imposto, c.det.impostoPecas, c.det.impostoServico], esperado: [163000, Math.round(8780 / 1630 * 1e6) / 1e6, 8780, 2000, 6780] };
      } },
    { id: 'IM3', descricao: 'Planilha antiga (só imposto 10%): os dois impostos = 10%, a efetiva = 10% exata (sem conta) e o cenário D dá o mesmo de antes (lucro 930,61 com 5%)',
      executar: function () {
        var imp = impostosDosParametros({ impostoPercentual: 10 });
        var c = cenarioDesconto();
        var preco = calcularPrecoComDesconto(c.res, c.params, 5, 0);
        return { obtido: [imp, taxaImpostoEfetiva(imp, 1000, 333.33, 7), c.res.impostoPct, centavos(preco.lucro)], esperado: [{ pecas: 10, servico: 10 }, 10, 10, 93061] };
      } },
    { id: 'IM4', descricao: 'Fechamento usa a taxa efetiva gravada (5,3333% sobre 1.500 = 80,00); registro antigo (sem a efetiva) usa o imposto da foto, como antes',
      executar: function () {
        var s = cenarioImposto(false);
        var f = calcularFechamento(s.foto, s.resultado, 'pix', null, NAO_SEI, 150000);
        var antigo = JSON.parse(JSON.stringify(s.resultado)); delete antigo.impostoEfetivoPct;
        var fotoAntiga = JSON.parse(JSON.stringify(s.foto)); fotoAntiga.parametros.impostoPercentual = 6;
        return { obtido: [f.impostoC, calcularFechamento(fotoAntiga, antigo, 'pix', null, NAO_SEI, 150000).impostoC], esperado: [8000, 9000] };
      } },
    // ---- Seção 16.9: desconto à vista diferente para serviço e peças (base 1.500 = serviço 1.000 + peças 500; A 5x = 1.622,8497) ----
    { id: 'DS1', descricao: 'dServ 5%, dPeças 0%: A_serv 1.081,8998 · A_peças 540,9499 · V = 1.027,8048 + 540,9499 = 1.568,7547 → 1.568,75; desconto R$ 54,10; equivalente 3,3333%; ainda pode 4,2367% (R$ 68,75)',
      executar: function () {
        var p = cenarioDescontos({ descontoSeparado: true, descontoTexto: '5', descontoPecasTexto: '0' }).calc.preco;
        var A = p.ancora.totalExato;
        return { obtido: [Math.round(A * 10000), Math.round(A * 1000 / 1500 * 10000), Math.round(A * 500 / 1500 * 10000), Math.round(p.precoExato * 10000), p.precoCentavos, p.descontoReaisCentavos,
            Math.round(p.descontoTotal * 10000), p.aindaPodePct, p.aindaPodeCentavos, p.descontosIguais, p.descontoServico, p.descontoPecas],
          esperado: [16228497, 10818998, 5409499, 15687547, 156875, 5410, 33333, 4.2367, 6875, false, 5, 0] };
      } },
    { id: 'DS2', descricao: 'dServ = dPeças = 5% (dois campos) → igual à regra atual: 1.541,71; descontos iguais (texto em %)',
      executar: function () {
        var p = cenarioDescontos({ descontoSeparado: true, descontoTexto: '5', descontoPecasTexto: '5' }).calc.preco;
        var antigo = cenarioRegraPreco().calc.preco;
        return { obtido: [p.precoCentavos, p.descontosIguais, p.descontoTotal, antigo.precoCentavos], esperado: [154171, true, 5, 154171] };
      } },
    { id: 'DS3', descricao: 'Extra 2%: dois campos (5% + 2% no serviço, peças 0%) → 1.547,12; campo único 5% + extra 2% (orçamento novo) → 7% sobre tudo = 1.509,25, igual a hoje',
      executar: function () {
        var a = cenarioDescontos({ descontoSeparado: true, descontoTexto: '5', descontoPecasTexto: '0', extraTexto: '2' }).calc.preco;
        var b = cenarioDescontos({ descontoSeparado: false, descontoTexto: '5', extraTexto: '2' }).calc.preco;
        var A = a.ancora.totalExato;
        return { obtido: [a.precoCentavos, a.descontoServico, a.descontoPecas, b.precoCentavos, b.descontoServico, b.descontoPecas],
          esperado: [154712, 7, 0, 150925, 7, 7] };
      } },
    { id: 'DS4', descricao: 'Orçamento antigo (sem dPeças) abre igual ao de hoje: 5% → 1.541,71; 5% + extra 2% → 7% sobre tudo = 1.509,25',
      executar: function () {
        var a = cenarioRegraPreco().calc.preco;
        var b = cenarioDescontos({ extraTexto: '2' }).calc.preco; // sem descontoSeparado (legado)
        return { obtido: [a.precoCentavos, b.precoCentavos, b.descontoTotal, b.descontosIguais], esperado: [154171, 150925, 7, true] };
      } },
    { id: 'DS5', descricao: 'Automático: padrões diferentes (à vista 5, peças 0) → já abre com os dois campos (1.568,75); padrões iguais → um campo só (1.541,71); planilha sem a chave nova → peças = o desconto à vista',
      executar: function () {
        var a = cenarioDescontos({ descontoSeparado: null }, { descontoPecasPadrao: 0 }).calc;
        var b = cenarioDescontos({ descontoSeparado: null }, { descontoPecasPadrao: 5 }).calc;
        var c = cenarioDescontos({ descontoSeparado: null }).calc;
        return { obtido: [a.lido.descontoSeparado, a.preco.precoCentavos, b.lido.descontoSeparado, b.preco.precoCentavos, c.lido.descontoSeparado, descontoPecasPadraoDosParametros({ descontoAVistaPadrao: 7 })],
          esperado: [true, 156875, false, 154171, false, 7] };
      } },
    { id: 'DS6', descricao: 'Gravado: resultado com dServ/dPeças e o equivalente; fechamento grava os três; entrada usa V (E 500 → f = 500/1.568,75); WhatsApp "(R$ 54,10 de desconto)"; iguais: "— 5% de desconto"',
      executar: function () {
        var s = cenarioDescontos({ descontoSeparado: true, descontoTexto: '5', descontoPecasTexto: '0', entradaTexto: '500', formaEntrada: 'pix', parcelasEntrada: 5 });
        var f = calcularFechamento(s.foto, s.resultado, 'pix', null, NAO_SEI, s.resultado.oferecidoC);
        var en = s.calc.entradaCartao;
        var zap = textoWhatsApp(s.calc.res, s.foto.parametros, '', s.calc.preco, []).split('\n').pop();
        var zapIgual = textoWhatsApp(cenarioRegraPreco().calc.res, s.foto.parametros, '', cenarioRegraPreco().calc.preco, []).split('\n').pop();
        return { obtido: [s.resultado.descontoServico, s.resultado.descontoPecas, Math.round(s.resultado.descontoTotal * 10000), f.descontoServicoPct, f.descontoPecasPct, Math.round(f.descontoEquivalentePct * 10000),
            en.restoC, zap, zapIgual],
          esperado: [5, 0, 33333, 5, 0, 33333, centavos(s.calc.preco.ancora.totalExato * (1 - 500 / 1568.75)),
            '💵 À vista (Pix, dinheiro ou débito): *R$ 1.568,75* (R$ 54,10 de desconto)', '💵 À vista (Pix, dinheiro ou débito): *R$ 1.541,71* — 5% de desconto'] };
      } },
    // ---- Seção 15: preço por forma de pagamento (base 1.500; Visa débito 1,37%, 5x 7,57%; desconto 5%) ----
    { id: 'RP1', descricao: 'Âncora 5x 1.622,85 (1.500 ÷ 0,9243) · Pix 1.541,71 · Débito = Pix 1.541,71 · 1x/3x/4x/5x = 1.622,85 (3× 540,95; 5× 324,57) · 6x 1.635,41 (acima da âncora, sobre a base)',
      executar: function () {
        var c = cenarioRegraPreco().calc;
        var outra = function (forma, n) { return c.outras.filter(function (o) { return o.forma === forma && o.parcelas === n; })[0]; };
        var d = outra('Débito', 1), p1 = outra('Crédito', 1), p3 = outra('Crédito', 3), p4 = outra('Crédito', 4), p6 = outra('Crédito', 6);
        var anc = c.preco.ancora;
        return { obtido: [anc.totalCentavos, anc.parcelaCentavos, c.preco.precoCentavos, [d.totalCentavos, d.regra], [p1.totalCentavos, p1.parcelaCentavos], [p3.totalCentavos, p3.parcelaCentavos], [p4.totalCentavos, p4.parcelaCentavos], [p6.totalCentavos, p6.parcelaCentavos, p6.regra]],
                 esperado: [162285, 32457, 154171, [154171, 'avista'], [162285, 162285], [162285, 54095], [162285, 40571], [163541, 27257, 'base']] };
      } },
    { id: 'RP2', descricao: 'Fechamento: valor sugerido por forma (Pix e Débito 1.541,71; 1x/3x/5x 1.622,85; 6x 1.635,41); sobra Pix 722,15; Débito 722,15 − 21,12 = 701,03 (mesmo preço, mesmo imposto)',
      executar: function () {
        var p = cenarioRegraPreco();
        var sug = function (f, n) { return valorSugeridoFechamento(p.e, p.foto, p.resultado, f, n, NAO_SEI); };
        var pix = calcularFechamento(p.foto, p.resultado, 'pix', null, NAO_SEI, sug('pix', null));
        var deb = calcularFechamento(p.foto, p.resultado, 'debito', 1, NAO_SEI, sug('debito', 1));
        return { obtido: [sug('pix', null), sug('debito', 1), sug('credito', 1), sug('credito', 3), sug('credito', 5), sug('credito', 6), pix.sobraC, [deb.taxaC, deb.impostoC === pix.impostoC, deb.sobraC]],
                 esperado: [154171, 154171, 162285, 162285, 162285, 163541, 72215, [2112, true, 70103]] };
      } },
    { id: 'RP3', descricao: 'Nenhuma forma de cartão até a referência abaixo do Pix; débito = Pix (desconto 0, 5, 10, 20%); sem âncora → como antes (débito sobre a base 1.520,84)',
      executar: function () {
        var ok = [0, 5, 10, 20].every(function (d) {
          var c = cenarioRegraPreco(String(d)).calc;
          return c.outras.every(function (o) { return o.forma === 'Débito' ? o.totalCentavos === c.preco.precoCentavos : (o.parcelas > c.preco.ancora.parcelas || o.totalCentavos >= c.preco.precoCentavos); });
        });
        var sem = cenarioRegraPreco('5', '');
        var dSem = sem.calc.outras.filter(function (o) { return o.forma === 'Débito'; })[0];
        return { obtido: [ok, sem.calc.preco.temAncora, [dSem.totalCentavos, dSem.regra], valorSugeridoFechamento(sem.e, sem.foto, sem.resultado, 'debito', 1, NAO_SEI)], esperado: [true, false, [152084, 'base'], 152084] };
      } },
    { id: 'RP4', descricao: 'Débito com desconto grande (10%): Pix 1.460,56 fica abaixo de 1.500 ÷ 0,9863 = 1.520,84 → aviso de R$ 60,28 abaixo; com 5% (1.541,71) → sem aviso; Pix nunca',
      executar: function () {
        var p10 = cenarioRegraPreco('10'), p5 = cenarioRegraPreco('5');
        var deb = function (p) { return calcularFechamento(p.foto, p.resultado, 'debito', 1, NAO_SEI, valorSugeridoFechamento(p.e, p.foto, p.resultado, 'debito', 1, NAO_SEI)); };
        var f10 = deb(p10), f5 = deb(p5);
        return { obtido: [f10.valorCombinadoC, abaixoDoPrecoNoDebito(p10.resultado, f10), abaixoDoPrecoNoDebito(p5.resultado, f5), abaixoDoPrecoNoDebito(p5.resultado, calcularFechamento(p5.foto, p5.resultado, 'pix', null, NAO_SEI, 100000))],
                 esperado: [146056, 6028, 0, 0] };
      } },
    // ---- Fase 11: orçamento do print (dados reais) ----
    { id: 'PR1', descricao: 'Orçamento do print (aberto): 5x 6.648,27 (5× 1.329,65) · à vista 5% 6.315,86 · ainda pode 2,57% / 170,86 · imposto 631,59 · oficina 242,31 · casa 423,07 · sobra 1.518,89 · total seu 1.941,96 · pisos 4.158,12 / 4.628,21 · no cartão 5x: sobra 1.314,79, fica 1.737,86',
      executar: function () {
        var c = cenarioPrint().calc;
        var anc = c.preco.ancora;
        return { obtido: [anc.totalCentavos, anc.parcelaCentavos, c.preco.precoCentavos, c.preco.aindaPodePct, c.preco.aindaPodeCentavos, c.det.imposto, c.det.pagaOficina,
                          c.det.vaiParaCasa, c.det.sobra, c.det.totalSeu, centavos(c.ganho.pisoOficina), centavos(c.ganho.pisoCasa), centavos(anc.lucro), centavos(anc.lucro) + c.det.vaiParaCasa],
                 esperado: [664827, 132965, 631586, 2.57, 17086, 63159, 24231, 42307, 151889, 194196, 415812, 462821, 131479, 173786] };
      } },
    { id: 'PR2', descricao: 'Orçamento do print fechado em 5x por 6.648,27: taxa 503,27 · imposto 664,83 · oficina 242,31 · casa 423,08 + sobra 1.314,78 = total seu 1.737,86 (divergência aceita: no aberto a casa absorve o centavo, 423,07 + 1.314,79)',
      executar: function () {
        var p = cenarioPrint();
        var f = calcularFechamento(p.foto, p.resultado, 'credito', 5, NAO_SEI, 664827);
        return { obtido: [f.taxaC, f.impostoC, f.pecasPagarC, f.pagaOficinaC, f.vaiParaCasaC, f.sobraC, f.totalSeuC, f.estado],
                 esperado: [50327, 66483, 350000, 24231, 42308, 131478, 173786, 'verde'] };
      } },
    // ---- Fase 11: card do mês, quanto falta trabalhar, extrato e alerta do piso ----
    { id: 'Q1', descricao: 'Exemplo do print (Resultados): (9.126,93 − 3.780 − 503,27 − 912,70) = livre 3.930,96 em 30 h = 131,03/h; oficina paga; casa 780,96 de 5.500 (14%); falta 4.719,04 → 37 h (36,01) · média 10 h → 4 serviços',
      executar: function () {
        var m = resumoDoMes(listaDoMesQ(), '2026-11', { oficinaC: 315000, casaC: 550000, horas: 130 });
        var p = painelDoMes(m, true);
        var q = quantoFaltaTrabalhar(m, true);
        return { obtido: [p.livreC, p.oficinaPaga, p.casaCobertaC, porcentoInteiro(p.pctCasa), p.frase.tipo, p.frase.valorC, p.frase.tom, q.faltaC, q.porHoraC, q.horas, q.mediaHoras, q.servicos],
                 esperado: [393096, true, 78096, '14%', 'faltaCasa', 471904, 'ambar', 471904, 13103, 37, 10, 4] };
      } },
    { id: 'Q2', descricao: 'Quanto falta trabalhar não aparece: sem horas vendidas; ganho livre ≤ 0 (peças maiores que o faturamento); mês que já passou',
      executar: function () {
        var semHoras = listaDoMesQ().map(function (o) { o.horas = 0; return o; });
        var semLivre = listaDoMesQ().map(function (o) { o.pecasPagarC = o.valorCombinadoC; return o; });
        var foto = { oficinaC: 315000, casaC: 550000, horas: 130 };
        return { obtido: [quantoFaltaTrabalhar(resumoDoMes(semHoras, '2026-11', foto), true), quantoFaltaTrabalhar(resumoDoMes(semLivre, '2026-11', foto), true),
                          quantoFaltaTrabalhar(resumoDoMes(listaDoMesQ(), '2026-11', foto), false)],
                 esperado: [null, null, null] };
      } },
    { id: 'Q3', descricao: 'Quanto falta trabalhar não aparece com a sobra do mês ≥ 0 (casa 500 → sobra 280,96); sem gastos do mês → sem card',
      executar: function () {
        var m = resumoDoMes(listaDoMesQ(), '2026-11', { oficinaC: 315000, casaC: 50000, horas: 130 });
        return { obtido: [m.resultado.sobraDoMesC, quantoFaltaTrabalhar(m, true), painelDoMes(resumoDoMes(listaDoMesQ(), '2026-11', null), true)], esperado: [28096, null, null] };
      } },
    { id: 'Q4', descricao: 'Extrato do mês fecha no centavo: Entrou − Peças − Maquininha − Imposto − Gastos da oficina = Ficou para a casa; − Gastos da casa = Faltou (−4.719,04); sem casa e oficina não paga',
      executar: function () {
        function confere(linhas) {
          var sub = linhas[0].valorC - linhas[1].valorC - linhas[2].valorC - linhas[3].valorC - linhas[4].valorC;
          var ok = sub === linhas[5].valorC;
          if (linhas.length > 6) ok = ok && linhas[5].valorC - linhas[6].valorC === linhas[7].valorC;
          return ok;
        }
        var a = extratoDoMes(resumoDoMes(listaDoMesQ(), '2026-11', { oficinaC: 315000, casaC: 550000, horas: 130 }));
        var b = extratoDoMes(resumoDoMes(listaDoMesQ(), '2026-11', { oficinaC: 500000, casaC: 0, horas: 130 }));
        var c = extratoDoMes(resumoDoMes(listaDoMesQ(), '2026-11', { oficinaC: 315000, casaC: 0, horas: 130 }));
        return { obtido: [a.map(function (l) { return l.rotulo + ' ' + l.valorC; }), confere(a), b.map(function (l) { return l.rotulo + ' ' + l.valorC; }), confere(b), c[5].rotulo, c[5].tipo],
                 esperado: [['Entrou 912693', 'Peças 378000', 'Maquininha 50327', 'Imposto 91270', 'Gastos da oficina 315000', 'Ficou para a casa 78096', 'Gastos da casa 550000', 'Faltou -471904'], true,
                            ['Entrou 912693', 'Peças 378000', 'Maquininha 50327', 'Imposto 91270', 'Gastos da oficina 500000', 'Faltou para a oficina -106904'], true, 'Sobra extra', 'total'] };
      } },
    { id: 'Q5', descricao: 'Frases do card do mês nos estados × mês corrente/passado (falta: âmbar no corrente, vermelho no passado)',
      executar: function () {
        function frase(oficinaC, casaC, corrente) {
          var p = painelDoMes(resumoDoMes(listaDoMesQ(), '2026-11', { oficinaC: oficinaC, casaC: casaC, horas: 130 }), corrente);
          return fraseDoMes(p).replace(/ /g, ' ') + ' | ' + p.frase.tom;
        }
        return { obtido: [frase(315000, 50000, true), frase(315000, 50000, false), frase(315000, 550000, true), frase(315000, 550000, false),
                          frase(500000, 550000, true), frase(500000, 550000, false), frase(315000, 0, true)],
                 esperado: ['Sobrou R$ 280,96 além da casa este mês | verde', 'Sobrou R$ 280,96 além da casa | verde',
                            'Faltam R$ 4.719,04 para cobrir a casa este mês | ambar', 'Faltaram R$ 4.719,04 para cobrir a casa | vermelho',
                            'Faltam R$ 1.069,04 para pagar a oficina este mês | ambar', 'Faltaram R$ 1.069,04 para pagar a oficina | vermelho',
                            'Sobrou R$ 780,96 além da oficina este mês | verde'] };
      } },
    { id: 'Q6', descricao: 'Barras: oficina 100% e casa 14%; oficina parcial 79% (3.930,96 de 5.000) e casa 0%; sem casa → sem barra da casa',
      executar: function () {
        function barras(oficinaC, casaC) {
          var p = painelDoMes(resumoDoMes(listaDoMesQ(), '2026-11', { oficinaC: oficinaC, casaC: casaC, horas: 130 }), true);
          return [porcentoInteiro(p.pctOficina), p.oficinaPaga, p.oficinaCobertaC, p.temCasa, p.pctCasa === null ? null : porcentoInteiro(p.pctCasa)];
        }
        return { obtido: [barras(315000, 550000), barras(500000, 550000), barras(315000, 0)],
                 esperado: [['100%', true, 315000, true, '14%'], ['79%', false, 393096, true, '0%'], ['100%', true, 315000, false, null]] };
      } },
    { id: 'A1', descricao: 'Alerta do piso (pisos do print 4.158,12 / 4.628,21): 6.315,86 sem alerta; até 5.091,03 (10% acima do piso da casa) âmbar; 5.091,04 sem; abaixo de 4.158,12 vermelho; sem casa: âmbar até 4.573,93',
      executar: function () {
        function a(preco, temCasa) { var x = alertaDoPiso(preco, 415812, temCasa ? 462821 : 415812, temCasa); return x ? x.tom + ' ' + x.piso + ' ' + x.pisoC : null; }
        return { obtido: [a(631586, true), a(509103, true), a(509104, true), a(462821, true), a(415812, true), a(415811, true), a(457393, false), a(457394, false)],
                 esperado: [null, 'ambar casa 462821', null, 'ambar casa 462821', 'ambar casa 462821', 'vermelho oficina 415812', 'ambar oficina 415812', null] };
      } }
  ];
}

/**
 * Orçamento do print (fase 11, dados reais): oficina 3.150 e casa 5.500; 5 dias × 6 h = 130 h; hora R$ 100; imposto 10%;
 * serviço 10 h; peças 4 × 500 + 1 × 1.500, + 47%; desconto 5%; Visa/Master padrão e Elo (sem taxas); parcelas "5"; "Não sei".
 */
function cenarioPrint() {
  var dados = { gastos: [{ tipo: 'Oficina', valor: 3150 }, { tipo: 'Casa', valor: 5500 }],
    cartoes: [cartaoDeTeste('Visa/Master', VISA_TESTE), cartaoVazio('Elo')],
    parametros: { diasPorSemana: 5, horasPorDia: 8, horasCobradasPorDia: 6, valorHoraCobrado: 100, impostoPercentual: 10,
      acrescimoPecasPadrao: 47, descontoAVistaPadrao: 5, parcelasDestaque: '5', nomeOficina: '' } };
  var foto = fotoDeHoje(dados, '2026-11-08 10:00');
  var e = { descricao: 'Retífica', modo: 'horas', horasTexto: '10', valorTexto: '', horasFechadoTexto: '', pecasModo: 'acrescimo',
    pecas: [{ descricao: 'Valvulas', qtdTexto: '4', valorTexto: '500' }, { descricao: 'Bloco', qtdTexto: '1', valorTexto: '1500' }],
    pecasPagarTexto: '', pecasCobrarTexto: '', acrescimoTexto: null, descontoTexto: null, extraTexto: '', bandeira: NAO_SEI };
  var calc = calcularComFoto(e, foto);
  return { foto: foto, e: e, calc: calc, resultado: resultadoParaGravar(calc) };
}

/**
 * Cenário da seção 15 (exemplo do usuário): base 1.500 = mão de obra fechada 1.000 (8 h) + peças cobradas 500 (pagas 388,79);
 * oficina 4.000 e casa 3.000 em 130 h; imposto 0; Visa padrão; desconto 5% → sobra no Pix 722,15.
 * desconto: texto do campo (padrão = o dos ajustes, 5); parcelasDestaque: '' = sem âncora.
 */
function cenarioRegraPreco(desconto, parcelasDestaque) {
  var dados = { gastos: [{ tipo: 'Oficina', valor: 4000 }, { tipo: 'Casa', valor: 3000 }], cartoes: [cartaoDeTeste('Visa/Master', VISA_TESTE)],
    parametros: { diasPorSemana: 5, horasPorDia: 8, horasCobradasPorDia: 6, valorHoraCobrado: 150, impostoPercentual: 0,
      acrescimoPecasPadrao: 25, descontoAVistaPadrao: 5, parcelasDestaque: parcelasDestaque === undefined ? '5,10' : parcelasDestaque, nomeOficina: '' } };
  var foto = fotoDeHoje(dados, '2026-11-08 10:00');
  var e = { descricao: 'Serviço', modo: 'fechado', horasTexto: '', valorTexto: '1000', horasFechadoTexto: '8', pecasModo: 'valor', pecas: [],
    pecasPagarTexto: '388,79', pecasCobrarTexto: '500', acrescimoTexto: null, descontoTexto: desconto === undefined ? null : desconto, extraTexto: '', bandeira: NAO_SEI };
  var calc = calcularComFoto(e, foto);
  return { foto: foto, e: e, calc: calc, resultado: resultadoParaGravar(calc) };
}

/**
 * Cenário do adendo 16.9: o mesmo da seção 15 (base 1.500 = serviço 1.000 + peças 500; Visa; âncora 5x),
 * com campos do desconto separado (mud) e parâmetros extras (par).
 */
function cenarioDescontos(mud, par) {
  var dados = { gastos: [{ tipo: 'Oficina', valor: 4000 }, { tipo: 'Casa', valor: 3000 }], cartoes: [cartaoDeTeste('Visa/Master', VISA_TESTE)],
    parametros: Object.assign({ diasPorSemana: 5, horasPorDia: 8, horasCobradasPorDia: 6, valorHoraCobrado: 150, impostoPercentual: 0,
      acrescimoPecasPadrao: 25, descontoAVistaPadrao: 5, parcelasDestaque: '5,10', nomeOficina: '' }, par || {}) };
  var foto = fotoDeHoje(dados, '2026-11-08 10:00');
  var e = Object.assign({ descricao: 'Serviço', modo: 'fechado', horasTexto: '', valorTexto: '1000', horasFechadoTexto: '8', pecasModo: 'valor', pecas: [],
    pecasPagarTexto: '388,79', pecasCobrarTexto: '500', acrescimoTexto: null, descontoTexto: null, extraTexto: '', bandeira: NAO_SEI }, mud || {});
  var calc = calcularComFoto(e, foto);
  return { foto: foto, e: e, calc: calc, resultado: resultadoParaGravar(calc) };
}

/**
 * Cenário dos terceiros (seção 16): oficina 4.000 e casa 3.000 em 130 h; mão de obra fechada 1.000 (8 h); sem peças;
 * eletricista 100 com o % pedido; impostos 0; sem cartões (preço = base).
 */
function cenarioTerceiros(acrTexto) {
  var dados = { gastos: [{ tipo: 'Oficina', valor: 4000 }, { tipo: 'Casa', valor: 3000 }], cartoes: [],
    parametros: { diasPorSemana: 5, horasPorDia: 8, horasCobradasPorDia: 6, valorHoraCobrado: 150, impostoPercentual: 0, impostoPecasPercentual: 0, impostoServicoPercentual: 0,
      acrescimoPecasPadrao: 0, acrescimoTerceirosPadrao: 0, descontoAVistaPadrao: 5, parcelasDestaque: '5,10', nomeOficina: '' } };
  var foto = fotoDeHoje(dados, '2026-11-08 10:00');
  var e = { descricao: 'Serviço', modo: 'fechado', horasTexto: '', valorTexto: '1000', horasFechadoTexto: '8', pecasModo: 'acrescimo', pecas: [],
    pecasPagarTexto: '', pecasCobrarTexto: '', acrescimoTexto: null, descontoTexto: null, extraTexto: '', bandeira: NAO_SEI,
    terceiros: [{ descricao: 'Eletricista', valorTexto: '100', acrescimoTexto: acrTexto }] };
  var calc = calcularComFoto(e, foto);
  return { foto: foto, e: e, calc: calc, resultado: resultadoParaGravar(calc) };
}

/**
 * Cenário da entrada (seção 16): base 4.621,50 (mão de obra fechada, sem horas) → âncora 5x = 4.621,50 ÷ 0,9243 = 5.000,00;
 * Visa padrão; desconto 5% → à vista 4.750,00; imposto 0; sem gastos.
 */
function cenarioEntrada(entradaTexto, formaEntrada, parcelasEntrada) {
  var dados = { gastos: [], cartoes: [cartaoDeTeste('Visa/Master', VISA_TESTE)],
    parametros: { diasPorSemana: 5, horasPorDia: 8, horasCobradasPorDia: 6, valorHoraCobrado: 150, impostoPercentual: 0,
      acrescimoPecasPadrao: 0, descontoAVistaPadrao: 5, parcelasDestaque: '5,10', nomeOficina: '' } };
  var foto = fotoDeHoje(dados, '2026-11-08 10:00');
  var e = { descricao: 'Serviço', modo: 'fechado', horasTexto: '', valorTexto: '4621,50', horasFechadoTexto: '', pecasModo: 'acrescimo', pecas: [],
    pecasPagarTexto: '', pecasCobrarTexto: '', acrescimoTexto: null, descontoTexto: null, extraTexto: '', bandeira: NAO_SEI,
    entradaTexto: entradaTexto, formaEntrada: formaEntrada, parcelasEntrada: parcelasEntrada };
  var calc = calcularComFoto(e, foto);
  return { foto: foto, e: e, calc: calc, resultado: resultadoParaGravar(calc) };
}

/**
 * Cenário do imposto separado (seção 16): mão de obra fechada 1.000 (8 h) + peças pagas 400 cobradas 500 (valor direto);
 * peças 4%, serviço 6%; sem cartões (preço = base); com terceiros: + 100 a 30%.
 */
function cenarioImposto(comTerceiros) {
  var dados = { gastos: [{ tipo: 'Oficina', valor: 4000 }, { tipo: 'Casa', valor: 3000 }], cartoes: [],
    parametros: { diasPorSemana: 5, horasPorDia: 8, horasCobradasPorDia: 6, valorHoraCobrado: 150, impostoPercentual: 6, impostoPecasPercentual: 4, impostoServicoPercentual: 6,
      acrescimoPecasPadrao: 25, acrescimoTerceirosPadrao: 0, descontoAVistaPadrao: 5, parcelasDestaque: '5,10', nomeOficina: '' } };
  var foto = fotoDeHoje(dados, '2026-11-08 10:00');
  var e = { descricao: 'Serviço', modo: 'fechado', horasTexto: '', valorTexto: '1000', horasFechadoTexto: '8', pecasModo: 'valor', pecas: [],
    pecasPagarTexto: '400', pecasCobrarTexto: '500', acrescimoTexto: null, descontoTexto: null, extraTexto: '', bandeira: NAO_SEI,
    terceiros: comTerceiros ? [{ descricao: 'Eletricista', valorTexto: '100', acrescimoTexto: '30' }] : [] };
  var calc = calcularComFoto(e, foto);
  return { foto: foto, e: e, calc: calc, resultado: resultadoParaGravar(calc) };
}

/** Mês do exemplo da fase 11: 3 fechados de 10 h; faturamento 9.126,93 · peças 3.780 · maquininha 503,27 · imposto 912,70. */
function listaDoMesQ() {
  var v = [[304231, 126000, 16776, 30424], [304231, 126000, 16776, 30423], [304231, 126000, 16775, 30423]];
  return v.map(function (x, i) {
    return { criadoEm: '2026-11-0' + (i + 2) + ' 10:00:00', situacao: 'Fechado', dataFechamento: '2026-11-0' + (i + 3),
      valorCombinadoC: x[0], pecasPagarC: x[1], taxaC: x[2], impostoC: x[3], horas: 10 };
  });
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
  // (débito com o valor da 11.6, 1.723,61: o exemplo do mês é de antes da regra da seção 15 e continua valendo como valor combinado)
  var fechs = [['pix', null, null], ['debito', 1, 172361], ['credito', 5, null], ['credito', 10, null], ['pix', null, 170000]].map(function (x) {
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
