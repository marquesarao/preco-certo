/**
 * Preço Certo – Oficina
 * Backend Google Apps Script (projeto vinculado à planilha).
 *
 * Fonte da verdade das regras: docs/DESENHO.md
 * Públicas (as únicas que a página chama): doGet, obterDados, salvarDados, obterTaxasPadraoVisa.
 * Todas as outras terminam em "_" e são internas: o google.script.run não as enxerga.
 *
 * Regra geral: tudo o que obterDados() devolve precisa passar em validarDados_() sem erro.
 * Por isso leitura e validação usam os MESMOS limites
 * (LIMITES_PARAMETROS_, LIMITE_TAXA_, LIMITE_VALOR_GASTO_, MAX_CARTOES_, MAX_NOME_CARTAO_).
 *
 * @OnlyCurrentDoc
 */

// ============================================================
// Constantes
// ============================================================

var ABA_GASTOS_ = 'Gastos';
var ABA_PARAMETROS_ = 'Parâmetros';
var ABA_TAXAS_ = 'Taxas';
var ABA_TAXAS_ANTIGA_ = 'Taxas (antigo)';

var CAB_GASTOS_ = ['Tipo', 'Descrição', 'Valor por mês (R$)'];
var CAB_PARAMETROS_ = ['Chave', 'Valor'];

/** Campos de taxa de cada cartão, na ordem das colunas B..N da aba Taxas. */
var CAMPOS_TAXA_ = ['debito', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12'];
var CAB_TAXAS_ = ['Cartão', 'Débito (%)', '1x (%)', '2x (%)', '3x (%)', '4x (%)', '5x (%)', '6x (%)',
  '7x (%)', '8x (%)', '9x (%)', '10x (%)', '11x (%)', '12x (%)'];

var TIPOS_GASTO_ = ['Oficina', 'Casa'];

/** Ordem em que os parâmetros aparecem na aba. */
var ORDEM_PARAMETROS_ = [
  'diasPorSemana',
  'horasPorDia',
  'horasCobradasPorDia',
  'valorHoraCobrado',
  'impostoPercentual',
  'acrescimoPecasPadrao',
  'parcelasDestaque',
  'nomeOficina'
];

var MAX_GASTOS_ = 200;
var MAX_DESCRICAO_ = 100;
var MAX_NOME_OFICINA_ = 60;
var MAX_VALOR_ = 1e9;
var MAX_TAXA_ = 99;
var MAX_ACRESCIMO_ = 1000;
var MAX_CARTOES_ = 12;
var MAX_NOME_CARTAO_ = 30;
var ESPERA_LOCK_MS_ = 10000;

/**
 * Limites ÚNICOS dos parâmetros numéricos: usados pela leitura (fora do limite → padrão)
 * e pela validação (fora do limite → erro). "nome" é o texto mostrado ao usuário.
 */
var LIMITES_PARAMETROS_ = {
  diasPorSemana:        { nome: 'Dias de trabalho por semana',     min: 1, max: 7 },
  horasPorDia:          { nome: 'Horas de trabalho por dia',       min: 0, max: 24, minExclusivo: true },
  horasCobradasPorDia:  { nome: 'Horas que você cobra por dia',    min: 0, max: 24, minExclusivo: true },
  valorHoraCobrado:     { nome: 'Quanto você vai cobrar por hora', min: 0, max: MAX_VALOR_ },
  impostoPercentual:    { nome: 'Imposto (%)',                     min: 0, max: MAX_TAXA_ },
  acrescimoPecasPadrao: { nome: 'Acréscimo padrão nas peças (%)',  min: 0, max: MAX_ACRESCIMO_ }
};
var PARAMETROS_NUMERICOS_ = Object.keys(LIMITES_PARAMETROS_);

/** Limite de cada taxa (%) de cada cartão. */
var LIMITE_TAXA_ = { min: 0, max: MAX_TAXA_ };

/** Limite do valor mensal de cada gasto (R$). */
var LIMITE_VALOR_GASTO_ = { min: 0, max: MAX_VALOR_ };

/** Cartão de fábrica e suas taxas (InfinitePay, plano 1 dia útil): Débito, 1x … 12x. */
var NOME_CARTAO_PADRAO_ = 'Visa/Master';
var TAXAS_VISA_PADRAO_ = [1.37, 3.15, 5.39, 6.12, 6.85, 7.57, 8.28, 8.99, 9.69, 10.38, 11.06, 11.74, 12.40];

/**
 * Só para a MIGRAÇÃO do formato antigo da aba Taxas
 * (colunas: Forma de pagamento | Parcelas | Visa/Master | Elo | Amex | Hipercard).
 */
var COLUNAS_BANDEIRAS_ANTIGAS_ = [
  { nome: 'Visa/Master', coluna: 2 },
  { nome: 'Elo', coluna: 3 },
  { nome: 'Amex', coluna: 4 },
  { nome: 'Hipercard', coluna: 5 }
];

var PROP_ATUALIZADO_EM_ = 'atualizadoEm';

// ============================================================
// Funções públicas (chamadas pela página)
// ============================================================

/**
 * Abre o app. Garante que as abas existem (e migra a aba Taxas antiga) antes de servir a página.
 * Usa lock para evitar que dois acessos simultâneos (celular + notebook) criem a mesma aba.
 * Sem lock, segue em frente: o outro acesso está configurando.
 */
function doGet() {
  var lock = LockService.getScriptLock();
  if (lock.tryLock(ESPERA_LOCK_MS_)) {
    try {
      configurarPlanilha_();
    } finally {
      lock.releaseLock();
    }
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Preço Certo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** Retorna tudo o que a página precisa. */
function obterDados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    gastos: lerGastos_(ss),
    parametros: lerParametros_(ss),
    cartoes: lerCartoes_(ss),
    atualizadoEm: PropertiesService.getDocumentProperties().getProperty(PROP_ATUALIZADO_EM_),
    urlPlanilha: ss.getUrl()
  };
}

/**
 * Valida e regrava as 3 abas.
 * @param {Object} dados {gastos, parametros, cartoes}, no formato de docs/DESENHO.md, seção 5
 * @return {string} atualizadoEm (ISO 8601)
 */
function salvarDados(dados) {
  var limpo = validarDados_(dados);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(ESPERA_LOCK_MS_)) {
    throw new Error('A planilha está ocupada. Tente de novo em alguns segundos.');
  }
  try {
    configurarPlanilha_(); // já dentro do lock: chamada direta, sem lock aninhado
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var linhasGastos = limpo.gastos.map(function (g) {
      return [g.tipo, g.descricao, g.valor === null ? '' : g.valor];
    });
    regravarCorpo_(ss.getSheetByName(ABA_GASTOS_), CAB_GASTOS_.length, linhasGastos);

    var shParametros = ss.getSheetByName(ABA_PARAMETROS_);
    shParametros.getRange('B:B').setNumberFormat('@');
    regravarCorpo_(shParametros, CAB_PARAMETROS_.length, linhasParametros_(limpo.parametros));

    regravarCorpo_(ss.getSheetByName(ABA_TAXAS_), CAB_TAXAS_.length, linhasCartoes_(limpo.cartoes));

    SpreadsheetApp.flush();

    var atualizadoEm = new Date().toISOString();
    PropertiesService.getDocumentProperties().setProperty(PROP_ATUALIZADO_EM_, atualizadoEm);
    return atualizadoEm;
  } finally {
    lock.releaseLock();
  }
}

/** Taxas Visa/Master padrão da InfinitePay, para o botão "Preencher com as taxas padrão". */
function obterTaxasPadraoVisa() {
  var taxas = {};
  CAMPOS_TAXA_.forEach(function (campo, i) { taxas[campo] = TAXAS_VISA_PADRAO_[i]; });
  return taxas;
}

// ============================================================
// Configuração e migração da planilha
// ============================================================

/**
 * Cria as abas que faltam (ou que estão totalmente vazias) com cabeçalho, formatos e dados padrão,
 * e migra a aba Taxas do formato antigo (uma única vez). Idempotente.
 * Quem chama deve segurar o lock (doGet e salvarDados já fazem isso).
 */
function configurarPlanilha_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  garantirAba_(ss, ABA_GASTOS_, CAB_GASTOS_, [], function (sh) {
    sh.getRange('C:C').setNumberFormat('#,##0.00');
    sh.setColumnWidth(1, 90);
    sh.setColumnWidth(2, 260);
    sh.setColumnWidth(3, 150);
  });

  garantirAba_(ss, ABA_PARAMETROS_, CAB_PARAMETROS_, linhasParametros_(parametrosPadrao_()), function (sh) {
    sh.getRange('B:B').setNumberFormat('@');
    sh.setColumnWidth(1, 190);
    sh.setColumnWidth(2, 200);
  });

  migrarTaxasAntigas_(ss);
  garantirAba_(ss, ABA_TAXAS_, CAB_TAXAS_, linhasCartoes_(cartoesPadrao_()), formatarAbaTaxas_);
}

function formatarAbaTaxas_(sh) {
  sh.getRange(1, 2, sh.getMaxRows(), CAMPOS_TAXA_.length).setNumberFormat('0.00');
  sh.setColumnWidth(1, 160);
  sh.setColumnWidths(2, CAMPOS_TAXA_.length, 78);
}

/**
 * Se a aba Taxas estiver no formato ANTIGO (cabeçalho "Forma de pagamento"), converte para o novo:
 * guarda uma cópia como "Taxas (antigo)" (não é apagada) e regrava a aba com um cartão por linha.
 * @return {boolean} true se migrou
 */
function migrarTaxasAntigas_(ss) {
  var sh = ss.getSheetByName(ABA_TAXAS_);
  if (!sh || !ehFormatoAntigoTaxas_(sh)) return false;

  var cartoes = converterTaxasAntigas_(lerCorpo_(sh, 6));
  var copia = sh.copyTo(ss);
  copia.setName(nomeDeAbaLivre_(ss, ABA_TAXAS_ANTIGA_));

  sh.clear();
  garantirAba_(ss, ABA_TAXAS_, CAB_TAXAS_, linhasCartoes_(cartoes), formatarAbaTaxas_);
  return true;
}

function ehFormatoAntigoTaxas_(sh) {
  if (sh.getLastRow() < 1) return false;
  return chaveNome_(sh.getRange(1, 1).getValue()) === 'forma de pagamento';
}

/**
 * Converte as linhas do formato antigo em cartões (função pura, testável).
 * Cada bandeira antiga com pelo menos uma taxa preenchida vira um cartão; Visa/Master sempre vira.
 * Vazio continua vazio (null); 0 continua 0; inválido ou fora do limite vira vazio.
 */
function converterTaxasAntigas_(linhas) {
  var porCampo = {};
  linhas.forEach(function (l) {
    var forma = chaveNome_(l[0]);
    var parcelas = lerNumeroBR_(l[1]);
    if (forma === 'debito') porCampo.debito = l;
    else if (forma === 'credito' && parcelas !== null && parcelas >= 1 && parcelas <= 12 && parcelas === Math.floor(parcelas)) {
      porCampo['p' + parcelas] = l;
    }
  });

  var cartoes = [];
  COLUNAS_BANDEIRAS_ANTIGAS_.forEach(function (b) {
    var cartao = cartaoVazio_(b.nome);
    var temTaxa = false;
    CAMPOS_TAXA_.forEach(function (campo) {
      var linha = porCampo[campo];
      if (!linha) return;
      var n = lerNumeroBR_(linha[b.coluna]);
      cartao[campo] = dentroDoLimite_(n, LIMITE_TAXA_) ? n : null;
      if (cartao[campo] !== null) temTaxa = true;
    });
    if (b.nome === NOME_CARTAO_PADRAO_ || temTaxa) cartoes.push(cartao);
  });
  return cartoes;
}

/** "Taxas (antigo)" se estiver livre; senão "Taxas (antigo) 2", "Taxas (antigo) 3"… */
function nomeDeAbaLivre_(ss, base) {
  if (!ss.getSheetByName(base)) return base;
  var i = 2;
  while (ss.getSheetByName(base + ' ' + i)) i++;
  return base + ' ' + i;
}

// ============================================================
// Dados padrão
// ============================================================

function parametrosPadrao_() {
  return {
    diasPorSemana: 5,
    horasPorDia: 8,
    horasCobradasPorDia: 6,
    valorHoraCobrado: 150,
    impostoPercentual: 0,
    acrescimoPecasPadrao: 47,
    parcelasDestaque: '5,10',
    nomeOficina: 'CliniCar Motors Tech'
  };
}

function cartaoVazio_(nome) {
  var cartao = { nome: nome };
  CAMPOS_TAXA_.forEach(function (campo) { cartao[campo] = null; });
  return cartao;
}

/** Fábrica: um único cartão "Visa/Master" com as taxas da InfinitePay. */
function cartoesPadrao_() {
  var cartao = cartaoVazio_(NOME_CARTAO_PADRAO_);
  CAMPOS_TAXA_.forEach(function (campo, i) { cartao[campo] = TAXAS_VISA_PADRAO_[i]; });
  return [cartao];
}

// ============================================================
// Leitura da planilha (tolerante: o que estiver fora do limite vira padrão ou vazio)
// ============================================================

function lerGastos_(ss) {
  var valores = lerCorpo_(ss.getSheetByName(ABA_GASTOS_), CAB_GASTOS_.length);
  var gastos = [];
  valores.forEach(function (l) {
    var tipoTxt = String(l[0]).trim();
    var descricao = String(l[1]).trim().slice(0, MAX_DESCRICAO_).trim();
    var valor = lerNumeroBR_(l[2]);
    if (tipoTxt === '' && descricao === '' && valor === null) return; // linha em branco
    gastos.push({
      tipo: normalizarTipo_(tipoTxt),
      descricao: descricao,
      valor: dentroDoLimite_(valor, LIMITE_VALOR_GASTO_) ? valor : null
    });
  });
  return gastos.slice(0, MAX_GASTOS_);
}

function lerParametros_(ss) {
  var padrao = parametrosPadrao_();
  var p = parametrosPadrao_();
  var valores = lerCorpo_(ss.getSheetByName(ABA_PARAMETROS_), CAB_PARAMETROS_.length);
  valores.forEach(function (l) {
    var chave = String(l[0]).trim();
    if (!padrao.hasOwnProperty(chave)) return;
    if (LIMITES_PARAMETROS_.hasOwnProperty(chave)) {
      var n = lerNumeroBR_(l[1]);
      p[chave] = dentroDoLimite_(n, LIMITES_PARAMETROS_[chave]) ? n : padrao[chave];
    } else if (chave === 'parcelasDestaque') {
      p[chave] = normalizarParcelas_(String(l[1])).texto; // descarta itens inválidos
    } else {
      p[chave] = String(l[1]).trim().slice(0, MAX_NOME_OFICINA_).trim();
    }
  });
  // horasPorDia já está no limite (> 0); ao limitar por ele, horasCobradasPorDia continua > 0.
  if (p.horasCobradasPorDia > p.horasPorDia) p.horasCobradasPorDia = p.horasPorDia;
  return p;
}

/**
 * Um cartão por linha. Linha sem nome → descartada; nome repetido → fica o primeiro;
 * taxa vazia, inválida ou fora de LIMITE_TAXA_ → null; 0 continua 0; no máximo MAX_CARTOES_.
 * Se a aba ainda estiver no formato antigo (migração não rodou), converte em memória.
 */
function lerCartoes_(ss) {
  var sh = ss.getSheetByName(ABA_TAXAS_);
  if (!sh) return [];
  if (ehFormatoAntigoTaxas_(sh)) return limparCartoesLidos_(converterTaxasAntigas_(lerCorpo_(sh, 6)));

  var brutos = lerCorpo_(sh, CAB_TAXAS_.length).map(function (l) {
    var cartao = { nome: String(l[0]) };
    CAMPOS_TAXA_.forEach(function (campo, i) { cartao[campo] = l[1 + i]; });
    return cartao;
  });
  return limparCartoesLidos_(brutos);
}

/** Limpeza tolerante dos cartões lidos (função pura, testável). */
function limparCartoesLidos_(brutos) {
  var vistos = {};
  var cartoes = [];
  brutos.forEach(function (b) {
    var nome = String(b.nome === null || b.nome === undefined ? '' : b.nome).trim().slice(0, MAX_NOME_CARTAO_).trim();
    if (nome === '') return;
    var chave = chaveNome_(nome);
    if (vistos[chave]) return;
    vistos[chave] = true;
    var cartao = { nome: nome };
    CAMPOS_TAXA_.forEach(function (campo) {
      var n = lerNumeroBR_(b[campo]);
      cartao[campo] = dentroDoLimite_(n, LIMITE_TAXA_) ? n : null;
    });
    cartoes.push(cartao);
  });
  return cartoes.slice(0, MAX_CARTOES_);
}

// ============================================================
// Validação (servidor: rígida, mesmos limites da leitura)
// ============================================================

/**
 * Valida e normaliza os dados recebidos da página.
 * Lança Error com mensagem em português se algo estiver errado.
 */
function validarDados_(dados) {
  if (!dados || typeof dados !== 'object') throw new Error('Dados inválidos.');
  return {
    gastos: validarGastos_(dados.gastos),
    parametros: validarParametros_(dados.parametros),
    cartoes: validarCartoes_(dados.cartoes)
  };
}

function validarGastos_(gastos) {
  if (!Array.isArray(gastos)) throw new Error('Lista de gastos inválida.');
  if (gastos.length > MAX_GASTOS_) throw new Error('Gastos demais: o limite é ' + MAX_GASTOS_ + '.');
  return gastos.map(function (g, i) {
    var pos = 'Gasto nº ' + (i + 1);
    if (!g || typeof g !== 'object') throw new Error(pos + ': inválido.');
    if (TIPOS_GASTO_.indexOf(g.tipo) < 0) throw new Error(pos + ': o tipo deve ser "Oficina" ou "Casa".');
    var descricao = g.descricao === null || g.descricao === undefined ? '' : g.descricao;
    if (typeof descricao !== 'string') throw new Error(pos + ': descrição inválida.');
    descricao = descricao.trim();
    if (descricao.length > MAX_DESCRICAO_) throw new Error(pos + ': descrição muito longa (máx. ' + MAX_DESCRICAO_ + ' letras).');
    var valor = null;
    if (g.valor !== null && g.valor !== undefined) {
      valor = exigirNumero_(g.valor, pos + ' – valor', LIMITE_VALOR_GASTO_);
    }
    return { tipo: g.tipo, descricao: descricao, valor: valor };
  });
}

function validarParametros_(p) {
  if (!p || typeof p !== 'object') throw new Error('Ajustes inválidos.');
  var limpo = {};
  PARAMETROS_NUMERICOS_.forEach(function (chave) {
    var lim = LIMITES_PARAMETROS_[chave];
    limpo[chave] = exigirNumero_(p[chave], lim.nome, lim);
  });
  if (limpo.horasCobradasPorDia > limpo.horasPorDia) {
    throw new Error('As horas que você cobra por dia não podem ser maiores que as horas de trabalho por dia.');
  }

  var destaque = p.parcelasDestaque === null || p.parcelasDestaque === undefined ? '' : p.parcelasDestaque;
  if (typeof destaque !== 'string') throw new Error('Parcelas que aparecem no orçamento: valor inválido.');
  var parcelas = normalizarParcelas_(destaque);
  if (parcelas.invalidas) {
    throw new Error('Parcelas que aparecem no orçamento: use números de 1 a 12 separados por vírgula (ex.: 5,10).');
  }
  limpo.parcelasDestaque = parcelas.texto;

  var nome = p.nomeOficina === null || p.nomeOficina === undefined ? '' : p.nomeOficina;
  if (typeof nome !== 'string') throw new Error('Nome da oficina inválido.');
  nome = nome.trim();
  if (nome.length > MAX_NOME_OFICINA_) throw new Error('Nome da oficina muito longo (máx. ' + MAX_NOME_OFICINA_ + ' letras).');
  limpo.nomeOficina = nome;

  return limpo;
}

/**
 * Cartões: no máximo MAX_CARTOES_; nome de 1 a MAX_NOME_CARTAO_ letras, único (sem diferenciar
 * maiúsculas/acentos); cada taxa null/undefined (= vazio, sem taxa) ou número dentro de LIMITE_TAXA_.
 */
function validarCartoes_(cartoes) {
  if (!Array.isArray(cartoes)) throw new Error('Lista de cartões inválida.');
  if (cartoes.length > MAX_CARTOES_) throw new Error('Você pode cadastrar no máximo ' + MAX_CARTOES_ + ' cartões.');
  var vistos = {};
  return cartoes.map(function (c, i) {
    if (!c || typeof c !== 'object') throw new Error('Cartão nº ' + (i + 1) + ': inválido.');
    var nome = typeof c.nome === 'string' ? c.nome.trim() : '';
    if (nome === '') throw new Error('Dê um nome ao cartão nº ' + (i + 1) + '.');
    if (nome.length > MAX_NOME_CARTAO_) throw new Error('O nome do cartão "' + nome.slice(0, 12) + '…" é muito longo (máx. ' + MAX_NOME_CARTAO_ + ' letras).');
    var chave = chaveNome_(nome);
    if (vistos[chave]) throw new Error('Já existe um cartão chamado "' + nome + '". Use outro nome.');
    vistos[chave] = true;

    var limpo = { nome: nome };
    CAMPOS_TAXA_.forEach(function (campo) {
      var v = c[campo];
      limpo[campo] = v === null || v === undefined
        ? null // vazio = sem taxa (não é zero)
        : exigirNumero_(v, 'Taxa ' + rotuloCampoTaxa_(campo) + ' do cartão ' + nome, LIMITE_TAXA_);
    });
    return limpo;
  });
}

function rotuloCampoTaxa_(campo) {
  return campo === 'debito' ? 'Débito' : campo.slice(1) + 'x';
}

/** true se n é número finito dentro do limite {min, max, minExclusivo}. */
function dentroDoLimite_(n, lim) {
  if (typeof n !== 'number' || !isFinite(n)) return false;
  if (lim.minExclusivo ? n <= lim.min : n < lim.min) return false;
  return n <= lim.max;
}

/** Exige número finito dentro do limite; senão lança erro com mensagem para o usuário. */
function exigirNumero_(v, nome, lim) {
  if (typeof v !== 'number' || !isFinite(v)) throw new Error(nome + ': digite um número.');
  if (lim.minExclusivo ? v <= lim.min : v < lim.min) {
    throw new Error(nome + ': deve ser maior ' + (lim.minExclusivo ? 'que ' : 'ou igual a ') + formatarNumeroBR_(lim.min) + '.');
  }
  if (v > lim.max) throw new Error(nome + ': deve ser no máximo ' + formatarNumeroBR_(lim.max) + '.');
  return v;
}

// ============================================================
// Utilitários de planilha
// ============================================================

/** Cria a aba se não existir; se existir mas estiver vazia, preenche. */
function garantirAba_(ss, nome, cabecalho, linhasPadrao, formatar) {
  var sh = ss.getSheetByName(nome);
  if (!sh) sh = ss.insertSheet(nome);
  if (sh.getLastRow() > 0) return sh; // já tem conteúdo: não mexe

  if (formatar) formatar(sh); // formatos antes dos valores (ex.: coluna texto "@")
  sh.getRange(1, 1, 1, cabecalho.length)
    .setValues([cabecalho])
    .setFontWeight('bold')
    .setBackground('#eeeeee');
  sh.setFrozenRows(1);
  if (linhasPadrao.length) {
    sh.getRange(2, 1, linhasPadrao.length, cabecalho.length).setValues(linhasPadrao);
  }
  return sh;
}

/** Lê as linhas abaixo do cabeçalho (sempre com o número de colunas pedido). */
function lerCorpo_(sh, numColunas) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, numColunas).getValues();
}

/** Apaga o conteúdo abaixo do cabeçalho e escreve as novas linhas. */
function regravarCorpo_(sh, numColunas, linhas) {
  var ultimaLinha = sh.getLastRow();
  if (ultimaLinha > 1) {
    sh.getRange(2, 1, ultimaLinha - 1, Math.max(numColunas, sh.getLastColumn())).clearContent();
  }
  if (linhas.length) {
    sh.getRange(2, 1, linhas.length, numColunas).setValues(linhas);
  }
}

/** Parâmetros → linhas [Chave, Valor], com números em texto pt-BR ("150,5"). */
function linhasParametros_(p) {
  return ORDEM_PARAMETROS_.map(function (chave) {
    var v = p[chave];
    return [chave, LIMITES_PARAMETROS_.hasOwnProperty(chave) ? formatarNumeroBR_(v) : String(v)];
  });
}

/** Cartões → linhas da aba [Cartão, Débito, 1x … 12x]. null vira célula vazia. */
function linhasCartoes_(cartoes) {
  return cartoes.map(function (c) {
    return [c.nome].concat(CAMPOS_TAXA_.map(function (campo) {
      return c[campo] === null || c[campo] === undefined ? '' : c[campo];
    }));
  });
}

// ============================================================
// Utilitários gerais
// ============================================================

/**
 * Converte texto em formato brasileiro para número. Mesmas regras do frontend:
 *   "150,50" → 150.5 · "1.234,56" → 1234.56 · "R$ 1.234,56" → 1234.56 · "7,57%" → 7.57
 *   sem vírgula: "1.234" → 1234 (milhar) · "1.5" → 1.5 (decimal)
 *   vazio ou inválido → null
 * Números já numéricos passam direto (se finitos).
 */
function lerNumeroBR_(v) {
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

/** Número → texto pt-BR sem separador de milhar ("150,5"). Até 4 casas decimais. */
function formatarNumeroBR_(n) {
  var arredondado = Math.round(n * 10000) / 10000;
  return String(arredondado).replace('.', ',');
}

/**
 * "5, 10" → {texto: "5,10", invalidas: false}. Remove repetidos e ordena.
 * Itens fora de 1..12 ou não inteiros marcam invalidas = true (e são descartados do texto).
 */
function normalizarParcelas_(s) {
  var invalidas = false;
  var vistos = {};
  String(s).split(/[,;\s]+/).forEach(function (parte) {
    if (parte === '') return;
    if (!/^\d+$/.test(parte)) { invalidas = true; return; }
    var n = Number(parte);
    if (n < 1 || n > 12) { invalidas = true; return; }
    vistos[n] = true;
  });
  var lista = Object.keys(vistos).map(Number).sort(function (a, b) { return a - b; });
  return { texto: lista.join(','), invalidas: invalidas };
}

/** "oficina" (qualquer caixa/acento) → "Oficina"; qualquer outro → "Casa". */
function normalizarTipo_(s) {
  return chaveNome_(s) === 'oficina' ? 'Oficina' : 'Casa';
}

/** Chave para comparar nomes sem diferenciar maiúsculas, acentos e espaços repetidos. */
function chaveNome_(s) {
  return semAcento_(String(s === null || s === undefined ? '' : s)).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Faixa Unicode dos acentos combinantes (U+0300 a U+036F), escrita por código para ficar legível. */
var RE_ACENTOS_ = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

function semAcento_(s) {
  return String(s).normalize('NFD').replace(RE_ACENTOS_, '');
}
