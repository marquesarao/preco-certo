/**
 * Preço Certo – Oficina
 * API da planilha (Google Apps Script VINCULADO à planilha: Extensões → Apps Script).
 *
 * A tela do app fica no GitHub Pages; este script só lê e grava a planilha.
 * Implantação: App da Web · Executar como: Eu · Quem pode acessar: Qualquer pessoa.
 * Fonte da verdade das regras: docs/DESENHO.md (seções 5 e 11)
 *
 * PROTOCOLO (só POST; corpo JSON enviado como text/plain, para o navegador não fazer preflight de CORS):
 *   { token, action: "obterDados", forcar? }           → { ok:true, gastos, parametros, cartoes, atualizadoEm, urlPlanilha,
 *                                                          parametrosAusentes }   (forcar:true = ignora o cache)
 *   { token, action: "salvarDados", dados: {…} }       → { ok:true, atualizadoEm, fotoMes }
 *                                                          (fotoMes: a linha do mês corrente na aba Meses, se foi gravada)
 *   { token, action: "obterTaxasPadraoVisa" }          → { ok:true, taxas: { debito, p1 … p12 } }
 *   Orçamentos (um registro por vez; NUNCA regrava a aba inteira):
 *   { token, action: "listarOrcamentos", mes }         → { ok:true, mes, mesAnterior, primeiroMes, orcamentos:[resumo],
 *                                                          meses:{ mes: foto|null, mesAnterior: foto|null }, gastosHoje }
 *   { token, action: "obterOrcamento", id }            → { ok:true, orcamento } | { ok:false, excluido:true, erro }
 *   { token, action: "salvarOrcamento", orcamento }    → { ok:true, id, criadoEm, atualizadoEm, situacao }
 *   { token, action: "mudarSituacao", id, atualizadoEmBase, situacao, fechamento?, motivo? }
 *                                                       → { ok:true, atualizadoEm, situacao, mesGravado }
 *   { token, action: "excluirOrcamento", id, atualizadoEmBase } → { ok:true } | { ok:true, jaExcluido:true }
 *   { token, action: "usarGastosDeHojeNoMes", mes }    → { ok:true, foto }
 *   conflito (outro aparelho salvou antes)              → { ok:false, conflito:true, erro, atual: resumo }
 *   excluído em outro aparelho                          → { ok:false, excluido:true, erro }
 *   qualquer erro                                       → { ok:false, erro: "mensagem em português" }
 *   GET                                                 → { ok:false, erro: "Acesso não autorizado" }
 *
 * SEGURANÇA
 * - O token fica nas Propriedades do script (chave TOKEN). Nenhum segredo neste arquivo.
 * - A checagem do token acontece ANTES de qualquer acesso à planilha.
 * - Funções PÚBLICAS (sem "_") deste arquivo: doGet, doPost, onEdit, gerarLinkDeConfiguracao, trocarToken, testarApi.
 *   onEdit é o gatilho SIMPLES da planilha (edição feita à mão): só marca que a configuração mudou (para o cache).
 *   As três últimas são para rodar À MÃO no editor (menu "Executar") e por isso não podem terminar em "_"
 *   (funções com "_" são privadas e não aparecem no menu). Isso é seguro porque este projeto NÃO usa
 *   HtmlService: não existe google.script.run, e a ÚNICA porta de entrada externa é o doPost, que só
 *   executa as ações da lista ACOES_. Qualquer outro nome em "action" — inclusive o de uma função
 *   pública — recebe "Ação desconhecida.".
 * - Todas as demais funções terminam em "_" (privadas).
 *
 * Regra geral dos dados: tudo o que obterDados devolve precisa passar em validarDados_() sem erro.
 * Por isso leitura e validação usam os MESMOS limites
 * (LIMITES_PARAMETROS_, LIMITE_TAXA_, LIMITE_VALOR_GASTO_, MAX_CARTOES_, MAX_NOME_CARTAO_ e os MAX_* dos orçamentos).
 *
 * CONFLITO ENTRE APARELHOS (orçamentos): o servidor carimba "Atualizado em" (texto com milissegundos).
 * O aparelho manda o carimbo que leu (atualizadoEmBase): igual → grava; diferente → conflito;
 * ID que não existe mais, mas com base → "excluído em outro aparelho" (não ressuscita).
 * Só um ID inédito SEM base vira linha nova.
 *
 * DESEMPENHO (DESENHO seção 14):
 * - configurarPlanilha_ só roda quando a versão do esquema (DocumentProperties "esquemaV") é diferente de ESQUEMA_VERSAO_,
 *   ou quando uma aba esperada sumiu (aba_ refaz a configuração uma vez);
 * - gastos, ajustes e cartões ficam no CacheService (6 h). obterDados com cache não pega o lock nem lê a planilha.
 *   salvarDados repõe o cache dentro do lock. Edição à mão nas abas → onEdit sobe "configV" e o cache deixa de valer;
 * - o lock fica só nas GRAVAÇÕES. listarOrcamentos e obterOrcamento leem sem lock (as abas Orçamentos e Meses são
 *   gravadas linha a linha, nunca apagadas e regravadas). Gastos, Parâmetros e Taxas SÃO apagadas e regravadas no
 *   salvarDados: por isso só são lidas com o lock (quando falta o cache).
 *
 * @OnlyCurrentDoc
 */

// ============================================================
// PREENCHA (uma vez em cada planilha) — veja docs/DEPLOY.md
// ============================================================

/** Endereço do app no GitHub Pages. */
var URL_DO_APP = 'https://marquesarao.github.io/preco-certo/';

/** URL "/exec" DESTA implantação (Implantar → Gerenciar implantações → copiar URL do app da Web). */
var URL_DA_API = '';

// ============================================================
// Constantes
// ============================================================

var ABA_GASTOS_ = 'Gastos';
var ABA_PARAMETROS_ = 'Parâmetros';
var ABA_TAXAS_ = 'Taxas';
var ABA_TAXAS_ANTIGA_ = 'Taxas (antigo)';
var ABA_ORCAMENTOS_ = 'Orçamentos';
var ABA_MESES_ = 'Meses';

var CAB_GASTOS_ = ['Tipo', 'Descrição', 'Valor por mês (R$)'];
var CAB_PARAMETROS_ = ['Chave', 'Valor'];

/** Campos de taxa de cada cartão, na ordem das colunas B..N da aba Taxas. */
var CAMPOS_TAXA_ = ['debito', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12'];
var CAB_TAXAS_ = ['Cartão', 'Débito (%)', '1x (%)', '2x (%)', '3x (%)', '4x (%)', '5x (%)', '6x (%)',
  '7x (%)', '8x (%)', '9x (%)', '10x (%)', '11x (%)', '12x (%)'];

/**
 * Aba Orçamentos: colunas A..V (V = Dados em JSON) + W..Y (seção 16: terceiros pagos, entrada, forma da entrada)
 * + Z (seção 17: "Itens" = placa, modelo, serviços da oficina, parceiros e peças, para a busca da lista).
 * As colunas novas ficam DEPOIS do JSON, para nenhuma coluna existente mudar de lugar (registros antigos: vazio = 0).
 * A..U e W..Y são escritas pelo servidor a partir do JSON validado.
 */
var CAB_ORCAMENTOS_ = ['ID', 'Criado em', 'Atualizado em', 'Cliente', 'Telefone', 'Serviço / veículo', 'Situação',
  'Valor orçado (à vista)', 'Data do fechamento', 'Forma de pagamento', 'Parcelas', 'Cartão', 'Valor combinado',
  'Horas', 'Peças pagas', 'Taxa da maquininha', 'Imposto', 'Paga a oficina', 'Vai para a casa', 'Sobra extra',
  'Motivo', 'Dados (JSON)', 'Terceiros pagos', 'Entrada', 'Forma da entrada', 'Itens'];
var COL_ORC_ = {
  id: 1, criadoEm: 2, atualizadoEm: 3, cliente: 4, telefone: 5, servico: 6, situacao: 7, valorOrcado: 8,
  dataFechamento: 9, forma: 10, parcelas: 11, cartao: 12, valorCombinado: 13, horas: 14, pecasPagas: 15,
  taxa: 16, imposto: 17, pagaOficina: 18, vaiParaCasa: 19, sobra: 20, motivo: 21, dados: 22,
  terceiros: 23, entrada: 24, formaEntrada: 25, itens: 26
};
var DINHEIRO_ = '#,##0.00';
var TEXTO_ = '@';
/** Formato de cada coluna da aba Orçamentos (datas e IDs em texto, para a planilha não convertê-los). */
var FORMATOS_ORC_ = [TEXTO_, TEXTO_, TEXTO_, TEXTO_, TEXTO_, TEXTO_, TEXTO_, DINHEIRO_, TEXTO_, TEXTO_, '0', TEXTO_,
  DINHEIRO_, DINHEIRO_, DINHEIRO_, DINHEIRO_, DINHEIRO_, DINHEIRO_, DINHEIRO_, DINHEIRO_, TEXTO_, TEXTO_,
  DINHEIRO_, DINHEIRO_, TEXTO_, TEXTO_];

var CAB_MESES_ = ['Mês', 'Gastos da oficina (R$)', 'Gastos da casa (R$)', 'Horas que você pode cobrar', 'Gravado em', 'Origem'];
var FORMATOS_MESES_ = [TEXTO_, DINHEIRO_, DINHEIRO_, DINHEIRO_, TEXTO_, TEXTO_];
var ORIGEM_PRIMEIRO_FECHAMENTO_ = 'Primeiro fechamento';
var ORIGEM_GASTOS_DE_HOJE_ = 'Usar meus gastos de hoje';

var SITUACOES_ = ['Aberto', 'Fechado', 'Não fechou'];
var FORMAS_FECHAMENTO_ = { pix: 'Pix/dinheiro', debito: 'Débito', credito: 'Cartão', entrada: 'Entrada + cartão' };
var FORMAS_ENTRADA_ = { pix: 'Pix/dinheiro', debito: 'Débito' };
var MAX_TERCEIROS_ = 20;
var ESTADOS_ = ['verde', 'ambar', 'vermelho'];

var TIPOS_GASTO_ = ['Oficina', 'Casa'];

/** Ordem em que os parâmetros aparecem na aba. */
var ORDEM_PARAMETROS_ = [
  'diasPorSemana',
  'horasPorDia',
  'horasCobradasPorDia',
  'valorHoraCobrado',
  'impostoPercentual',
  'impostoPecasPercentual',
  'impostoServicoPercentual',
  'acrescimoPecasPadrao',
  'acrescimoTerceirosPadrao',
  'descontoAVistaPadrao',
  'descontoPecasPadrao',
  'parcelasDestaque',
  'nomeOficina'
];

var MAX_GASTOS_ = 200;
var MAX_DESCRICAO_ = 100;
var MAX_NOME_OFICINA_ = 60;
var MAX_VALOR_ = 1e9;
var MAX_TAXA_ = 99;
var MAX_ACRESCIMO_ = 1000;
var MAX_DESCONTO_ = 99;
var MAX_CARTOES_ = 12;
var MAX_NOME_CARTAO_ = 30;
var ESPERA_LOCK_MS_ = 10000;

/** Limites ÚNICOS dos orçamentos (mesmos valores no app). */
var MAX_CLIENTE_ = 60;
var MAX_TELEFONE_ = 20;
var MAX_MOTIVO_ = 80;
var MAX_SERVICO_ = 100;
var MAX_TEXTO_CAMPO_ = 40;
var MAX_DESCRICAO_PECA_ = 80;
var MAX_PECAS_ = 30;
var MAX_SERVICOS_ = 20;        // seção 17: serviços da oficina por orçamento
var MAX_ID_SERVICO_ = 20;
var RE_ID_SERVICO_ = /^[A-Za-z0-9_-]+$/;
var MAX_PLACA_ = 8;            // "ABC-1234"
var MAX_MODELO_ = 60;
var COMBUSTIVEIS_ = ['', 'Flex', 'Gasolina', 'Etanol', 'Diesel', 'GNV'];
var MAX_ITENS_ = 2000;         // coluna Z (texto da busca)
var MAX_JSON_ORCAMENTO_ = 30000;
var MAX_CENTAVOS_ = 1e11;      // R$ 1 bilhão
var MAX_HORAS_ = 10000;
var DATA_MINIMA_ = '2000-01-01';
var RE_ID_ = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
var RE_TELEFONE_ = /^[0-9 ()+.\-]*$/;
var RE_MES_ = /^(\d{4})-(0[1-9]|1[0-2])$/;
var RE_DATA_ = /^(\d{4})-(\d{2})-(\d{2})$/;

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
  acrescimoPecasPadrao: { nome: 'Acréscimo padrão nas peças (%)',  min: 0, max: MAX_ACRESCIMO_ },
  descontoAVistaPadrao: { nome: 'Desconto à vista padrão (%)',     min: 0, max: MAX_DESCONTO_ },
  // Seção 16
  impostoPecasPercentual:   { nome: 'Imposto sobre peças (%)',   min: 0, max: MAX_TAXA_ },
  impostoServicoPercentual: { nome: 'Imposto sobre serviço (%)', min: 0, max: MAX_TAXA_ },
  acrescimoTerceirosPadrao: { nome: 'Acréscimo padrão em serviços de terceiros (%)', min: 0, max: MAX_ACRESCIMO_ },
  // Seção 16.9
  descontoPecasPadrao:      { nome: 'Desconto padrão nas peças (%)', min: 0, max: MAX_DESCONTO_ }
};
var PARAMETROS_NUMERICOS_ = Object.keys(LIMITES_PARAMETROS_);

/**
 * Parâmetros que a tela ANTIGA (de antes da fase 10) não manda. Ausente no salvarDados → mantém o valor da aba.
 * Sem isso, um celular que ainda não tocou em ATUALIZAR não conseguiria salvar os gastos depois da troca do backend.
 */
var PARAMETROS_OPCIONAIS_ = ['descontoAVistaPadrao', 'impostoPecasPercentual', 'impostoServicoPercentual', 'acrescimoTerceirosPadrao', 'descontoPecasPadrao'];
/**
 * Imposto LEGADO (seção 16): a chave antiga impostoPercentual continua na aba para os aparelhos não atualizados
 * (a tela nova grava nela o imposto do serviço). Ela só vale para os impostos novos quando eles ainda NÃO têm linha na aba
 * (planilha que já existia antes da seção 16: os dois vêm dela). Planilha nova já nasce com as duas linhas (0).
 * Se a aba já tem os novos, um salvarDados da tela antiga (só com a chave antiga) NÃO mexe neles.
 */
var IMPOSTOS_NOVOS_ = ['impostoPecasPercentual', 'impostoServicoPercentual'];
/**
 * Parâmetros DERIVADOS (seções 16 e 16.9): sem linha na aba (planilha que já existia), valem a chave de origem.
 * A tela antiga não manda a chave nova e nunca a sobrescreve (PARAMETROS_OPCIONAIS_). Planilha nova já nasce com a linha.
 */
var DERIVADOS_ = { impostoPecasPercentual: 'impostoPercentual', impostoServicoPercentual: 'impostoPercentual', descontoPecasPadrao: 'descontoAVistaPadrao' };

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
var PROP_TOKEN_ = 'TOKEN';
var PROP_PROTECAO_ = 'protecaoAvisoV1';

/** Desempenho: versão do esquema das abas (suba quando configurarPlanilha_ mudar), versão da config e cache. */
var ESQUEMA_VERSAO_ = '3'; // 2 = seção 16 (colunas W–Y na aba Orçamentos); 3 = seção 17 (coluna Z "Itens", preenchida nas linhas antigas)
var PROP_ESQUEMA_ = 'esquemaV';
var PROP_CONFIG_V_ = 'configV';
var CHAVE_CACHE_DADOS_ = 'dadosConfigV1';
var CACHE_VALIDADE_S_ = 21600;      // 6 h: o máximo do CacheService
var CACHE_MAX_LETRAS_ = 90000;      // o limite do CacheService é 100 KB por item
/** Ações que não gravam: rodam SEM o lock. */
var ACOES_DE_LEITURA_ = { obterDados: true, obterTaxasPadraoVisa: true, listarOrcamentos: true, obterOrcamento: true };
var ABAS_DA_CONFIG_ = [ABA_GASTOS_, ABA_PARAMETROS_, ABA_TAXAS_];
var AVISO_EDICAO_MANUAL_ = 'Use o app para alterar orçamentos. Editar aqui pode deixar a lista diferente do orçamento.';
var MSG_SEM_ACESSO_ = 'Acesso não autorizado';
var MSG_ACAO_DESCONHECIDA_ = 'Ação desconhecida.';
var MSG_ERRO_INTERNO_ = 'Erro interno no servidor. Tente de novo.';
var MSG_CONFLITO_ = 'Esse orçamento foi alterado em outro aparelho.';
var MSG_EXCLUIDO_ = 'Esse orçamento foi excluído em outro aparelho.';
var MSG_DEFEITO_ = 'Esse orçamento está com defeito na planilha (coluna "Dados"). Ele foi ignorado.';

/** Formato da URL /exec (igual ao validado pelo app em js/config.js). */
var URL_API_VALIDA_ = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;

// ============================================================
// Entrada HTTP (a ÚNICA porta de entrada externa)
// ============================================================

/** GET nunca devolve dados nem HTML. */
function doGet() {
  return responder_({ ok: false, erro: MSG_SEM_ACESSO_ });
}

function doPost(e) {
  try {
    var req = lerRequisicao_(e);
    validarToken_(req.token); // antes de QUALQUER acesso à planilha
    if (typeof req.action !== 'string' || !Object.prototype.hasOwnProperty.call(ACOES_, req.action)) {
      throw erroApi_(MSG_ACAO_DESCONHECIDA_);
    }
    var acao = ACOES_[req.action];
    PEDIDO_ = { props: lerPropsDoc_(), travado: false, configurou: false };
    // Abas, migração e proteções: só quando o esquema mudou (ou na 1ª vez). Senão, nada a fazer.
    if (PEDIDO_.props[PROP_ESQUEMA_] !== ESQUEMA_VERSAO_) comLock_(configurarCompleto_);
    // Leitura: sem lock. Gravação: com lock (uma de cada vez).
    if (ACOES_DE_LEITURA_[req.action]) return responder_(acao(req));
    return responder_(comLock_(function () { return acao(req); }));
  } catch (err) {
    if (err && err.api) return responder_({ ok: false, erro: err.message });
    console.error('Preço Certo – erro interno: ' + (err && err.stack ? err.stack : err));
    return responder_({ ok: false, erro: MSG_ERRO_INTERNO_ });
  } finally {
    PEDIDO_ = null;
  }
}

/** Contexto do pedido em andamento: propriedades do documento (lidas uma vez) e se o lock está pego. */
var PEDIDO_ = null;

/** Todas as propriedades do documento numa leitura só (esquemaV, configV, atualizadoEm…). */
function lerPropsDoc_() {
  return PropertiesService.getDocumentProperties().getProperties() || {};
}

function propsDoPedido_() {
  return PEDIDO_ ? PEDIDO_.props : lerPropsDoc_();
}

/** Configuração completa (abas, migração, proteções) e grava a versão do esquema. Quem chama segura o lock. */
function configurarCompleto_() {
  configurarPlanilha_();
  PropertiesService.getDocumentProperties().setProperty(PROP_ESQUEMA_, ESQUEMA_VERSAO_);
  if (PEDIDO_) { PEDIDO_.props[PROP_ESQUEMA_] = ESQUEMA_VERSAO_; PEDIDO_.configurou = true; }
  apagarCacheDados_(); // a migração pode ter mudado a aba Taxas
}

/**
 * A aba pelo nome. Se ela sumiu (apagada à mão), refaz a configuração completa UMA vez por pedido e tenta de novo.
 * Use em todo acesso a abas fora de configurarPlanilha_.
 */
function aba_(nome) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(nome);
  if (sh) return sh;
  if (PEDIDO_ && PEDIDO_.configurou) return null;
  comLock_(configurarCompleto_);
  return ss.getSheetByName(nome);
}

/**
 * Gatilho SIMPLES (edição feita à mão na planilha; gravações do script não disparam).
 * Edição nas abas Gastos, Parâmetros ou Taxas → sobe "configV": o cache dos dados deixa de valer.
 * Usa só o PropertiesService (disponível em gatilho simples, conforme a documentação do Google).
 */
function onEdit(e) {
  try {
    var nome = e && e.range ? e.range.getSheet().getName() : '';
    if (ABAS_DA_CONFIG_.indexOf(nome) < 0) return;
    // hora + sufixo aleatório: duas edições no mesmo milissegundo também mudam a versão
    PropertiesService.getDocumentProperties().setProperty(PROP_CONFIG_V_, Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  } catch (err) {
    // nunca atrapalha a edição na planilha
  }
}

/** As únicas ações que a API executa. */
var ACOES_ = {
  obterDados: function (req) {
    var dados = obterDados_(req.forcar === true);
    dados.ok = true;
    return dados;
  },
  salvarDados: function (req) {
    var limpo = comMensagem_(function () { return validarDados_(req.dados); });
    var r = salvarDados_(limpo);
    return { ok: true, atualizadoEm: r.atualizadoEm, fotoMes: r.fotoMes };
  },
  obterTaxasPadraoVisa: function () {
    return { ok: true, taxas: obterTaxasPadraoVisa_() };
  },
  listarOrcamentos: function (req) {
    return listarOrcamentos_(validarMes_(req.mes));
  },
  obterOrcamento: function (req) {
    return obterOrcamento_(validarId_(req.id));
  },
  salvarOrcamento: function (req) {
    return salvarOrcamento_(validarPedidoSalvar_(req.orcamento));
  },
  mudarSituacao: function (req) {
    return mudarSituacao_(validarPedidoSituacao_(req));
  },
  excluirOrcamento: function (req) {
    return excluirOrcamento_(validarId_(req.id), validarBase_(req.atualizadoEmBase, true));
  },
  usarGastosDeHojeNoMes: function (req) {
    var mes = validarMes_(req.mes);
    if (mes > mesDe_(hojeTexto_(Date.now()))) throw erroApi_('Esse mês ainda não chegou.');
    return { ok: true, foto: gravarFotoDoMes_(mes, ORIGEM_GASTOS_DE_HOJE_, true) };
  }
};

function lerRequisicao_(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (_) {
    throw erroApi_('Pedido inválido.');
  }
  if (!req || typeof req !== 'object' || Array.isArray(req)) throw erroApi_('Pedido inválido.');
  return req;
}

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Erro cuja mensagem pode ir para o usuário. */
function erroApi_(mensagem) {
  var e = new Error(mensagem);
  e.api = true;
  return e;
}

/** Roda uma validação "antiga" (que lança Error comum) e faz a mensagem ir para o usuário. */
function comMensagem_(fn, prefixo) {
  try {
    return fn();
  } catch (e) {
    if (e && e.api) throw e;
    throw erroApi_((prefixo || '') + (e && e.message ? e.message : 'Dados inválidos.'));
  }
}

/** Token ausente, errado, ou servidor sem token → "Acesso não autorizado". Não toca na planilha. */
function validarToken_(token) {
  var esperado = PropertiesService.getScriptProperties().getProperty(PROP_TOKEN_);
  if (!esperado || typeof token !== 'string' || !iguais_(token, esperado)) throw erroApi_(MSG_SEM_ACESSO_);
}

/** Comparação em tempo constante (não revela quantos caracteres coincidem). */
function iguais_(a, b) {
  if (a.length !== b.length) return false;
  var dif = 0;
  for (var i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/** Roda fn com o lock do script. Se o lock já está pego neste pedido, só roda (não pega de novo). */
function comLock_(fn) {
  if (PEDIDO_ && PEDIDO_.travado) return fn();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(ESPERA_LOCK_MS_)) throw erroApi_('A planilha está ocupada. Tente de novo em alguns segundos.');
  if (PEDIDO_) PEDIDO_.travado = true;
  try {
    return fn();
  } finally {
    if (PEDIDO_) PEDIDO_.travado = false;
    lock.releaseLock();
  }
}

// ============================================================
// Cache dos dados de configuração (gastos, ajustes, cartões) — CacheService, 6 h
// ============================================================

function cacheDoScript_() {
  try { return CacheService.getScriptCache(); } catch (e) { return null; }
}

/** Dados do cache, ou null (sem cache, configV diferente, ou defeituoso). */
function lerCacheDados_() {
  var c = cacheDoScript_();
  if (!c) return null;
  try {
    var s = c.get(CHAVE_CACHE_DADOS_);
    if (!s) return null;
    var o = JSON.parse(s);
    if (!o || o.configV !== (propsDoPedido_()[PROP_CONFIG_V_] || '') || !o.dados) return null;
    return o.dados;
  } catch (e) {
    return null;
  }
}

function gravarCacheDados_(dados) {
  var c = cacheDoScript_();
  if (!c) return;
  try {
    var s = JSON.stringify({ configV: propsDoPedido_()[PROP_CONFIG_V_] || '', dados: dados });
    if (s.length > CACHE_MAX_LETRAS_) { c.remove(CHAVE_CACHE_DADOS_); return; } // grande demais: lê a planilha
    c.put(CHAVE_CACHE_DADOS_, s, CACHE_VALIDADE_S_);
  } catch (e) {
    // sem cache: segue lendo a planilha
  }
}

function apagarCacheDados_() {
  var c = cacheDoScript_();
  if (c) { try { c.remove(CHAVE_CACHE_DADOS_); } catch (e) { /* ignora */ } }
}

/**
 * Gastos, ajustes e cartões (e urlPlanilha, parametrosAusentes): do cache, sem tocar na planilha;
 * sem cache (ou forcar): lê a planilha COM lock (as abas são apagadas e regravadas no salvarDados) e repõe o cache.
 */
function dadosDaConfig_(forcar) {
  if (!forcar) {
    var c = lerCacheDados_();
    if (c) return c;
  }
  return comLock_(function () {
    var d = lerDadosDaPlanilha_();
    gravarCacheDados_(d);
    return d;
  });
}

/** Leitura completa das abas Gastos, Parâmetros e Taxas. Quem chama segura o lock. */
function lerDadosDaPlanilha_() {
  var ausentes = [];
  var d = {
    gastos: gastosDasLinhas_(lerCorpo_(aba_(ABA_GASTOS_), CAB_GASTOS_.length)),
    parametros: parametrosDasLinhas_(lerCorpo_(aba_(ABA_PARAMETROS_), CAB_PARAMETROS_.length), ausentes),
    parametrosAusentes: null,
    cartoes: aba_(ABA_TAXAS_) ? lerCartoes_(SpreadsheetApp.getActiveSpreadsheet()) : [],
    urlPlanilha: SpreadsheetApp.getActiveSpreadsheet().getUrl()
  };
  d.parametrosAusentes = ausentes.filter(function (k) { return PARAMETROS_OPCIONAIS_.indexOf(k) >= 0 && !DERIVADOS_.hasOwnProperty(k); }); // derivados ausentes = vêm da chave de origem (não é pendência)
  return d;
}

/** Totais de hoje (centavos e horas do mês) a partir dos dados de configuração. */
function totaisDosDados_(d) {
  var soma = function (tipo) {
    return d.gastos.reduce(function (t, g) { return t + (g.tipo === tipo && typeof g.valor === 'number' ? g.valor : 0); }, 0);
  };
  var p = d.parametros;
  return {
    oficinaC: Math.round(soma('Oficina') * 100),
    casaC: Math.round(soma('Casa') * 100),
    horas: Math.round(p.horasCobradasPorDia * p.diasPorSemana * 52 / 12 * 10000) / 10000
  };
}

function mesmosTotais_(a, b) {
  return !!a && !!b && a.oficinaC === b.oficinaC && a.casaC === b.casaC && a.horas === b.horas;
}

/** Mês corrente no fuso do script ("aaaa-mm"). */
function mesCorrente_() {
  return mesDe_(hojeTexto_(Date.now()));
}

// ============================================================
// Funções para rodar À MÃO no editor (Executar). Não são ações da API.
// ============================================================

/**
 * Gera (ou reaproveita) o token e mostra no Registro de execução o LINK DE CONFIGURAÇÃO do aparelho:
 *   URL_DO_APP + "#cfg=" + base64url({"api": URL_DA_API, "token": …})
 * Abra o link no aparelho (no do mecânico, mande pelo WhatsApp e depois apague a mensagem).
 */
function gerarLinkDeConfiguracao() {
  var problema = problemaNasUrls_(URL_DO_APP, URL_DA_API);
  if (problema) {
    Logger.log('⚠️ ' + problema);
    return;
  }
  var token = obterOuCriarToken_();
  var link = montarLinkDeConfiguracao_(URL_DO_APP, URL_DA_API, token);
  Logger.log(
    'LINK DE CONFIGURAÇÃO deste aparelho (copie a linha inteira):\n\n' + link + '\n\n' +
    'Como usar:\n' +
    '1. Abra o link no navegador do aparelho (Chrome). Deve aparecer "Aparelho conectado à planilha ✓".\n' +
    '2. No celular do mecânico: mande o link pelo WhatsApp, peça para ele abrir e DEPOIS APAGUE a mensagem.\n' +
    '3. Este link dá acesso aos dados desta planilha: mande só para o dono. Se vazar, rode trocarToken() e gere um link novo.'
  );
  return link;
}

/**
 * Troca o token: TODOS os aparelhos ligados a esta planilha perdem o acesso na hora.
 * Use se o link de configuração vazou ou se um aparelho foi perdido. Depois rode gerarLinkDeConfiguracao().
 */
function trocarToken() {
  PropertiesService.getScriptProperties().setProperty(PROP_TOKEN_, gerarToken_());
  Logger.log('Token trocado. Todos os aparelhos ligados a esta planilha perderam o acesso.\n' +
    'Agora rode gerarLinkDeConfiguracao() e abra o link novo em cada aparelho que deve continuar usando o app.');
}

/**
 * Teste de ponta a ponta da API, rodando doPost() aqui no editor. Não altera os dados:
 * regrava os mesmos gastos/ajustes/cartões e cria um orçamento de TESTE (cliente "TESTE testarApi",
 * fechado em 2000-01) que é apagado no fim, junto com a linha "2000-01" da aba Meses, se foi ele que a criou.
 */
function testarApi() {
  var token = obterOuCriarToken_();
  var chamar = function (corpo) { return JSON.parse(doPost({ postData: { contents: corpo } }).getContent()); };
  var json = function (obj) { return JSON.stringify(obj); };
  var pedir = function (acao, extra) { var c = { token: token, action: acao }; for (var k in extra) c[k] = extra[k]; return chamar(json(c)); };
  var conferir = function (condicao, descricao, r) {
    if (!condicao) throw new Error('FALHOU: ' + descricao + '\nResposta: ' + JSON.stringify(r));
    Logger.log('✓ ' + descricao);
  };
  var r;

  r = JSON.parse(doGet().getContent());
  conferir(r.ok === false && r.erro === MSG_SEM_ACESSO_, 'GET é recusado', r);
  r = chamar(json({ action: 'obterDados' }));
  conferir(r.ok === false && r.erro === MSG_SEM_ACESSO_, 'pedido sem token é recusado', r);
  r = chamar(json({ token: 'token-errado', action: 'obterDados' }));
  conferir(r.ok === false && r.erro === MSG_SEM_ACESSO_, 'token errado é recusado', r);
  r = chamar(json({ token: 'token-errado', action: 'salvarOrcamento' }));
  conferir(r.ok === false && r.erro === MSG_SEM_ACESSO_, 'token errado é recusado também nas ações de orçamento', r);
  r = chamar('isto não é json');
  conferir(r.ok === false, 'corpo que não é JSON é recusado', r);
  ['apagarTudo', 'gerarLinkDeConfiguracao', 'trocarToken', 'testarApi', 'salvarOrcamento_', 'gravarFotoDoMes_'].forEach(function (acao) {
    r = pedir(acao, {});
    conferir(r.ok === false && r.erro === MSG_ACAO_DESCONHECIDA_, 'ação "' + acao + '" não é executada pela API', r);
  });
  r = pedir('obterDados', {});
  conferir(r.ok === true && Array.isArray(r.cartoes) && r.parametros, 'obterDados devolve os dados', r);
  var atuais = { gastos: r.gastos, parametros: r.parametros, cartoes: r.cartoes };
  var antigos = JSON.parse(JSON.stringify(atuais));
  delete antigos.parametros.descontoAVistaPadrao;
  r = pedir('salvarDados', { dados: antigos });
  conferir(r.ok === true, 'salvarDados da tela antiga (sem o desconto padrão) continua funcionando', r);
  r = pedir('salvarDados', { dados: atuais });
  conferir(r.ok === true && r.atualizadoEm, 'salvarDados regrava os mesmos dados', r);
  r = pedir('salvarDados', { dados: { gastos: [], parametros: {}, cartoes: [] } });
  conferir(r.ok === false && typeof r.erro === 'string' && r.erro !== MSG_ERRO_INTERNO_, 'dados inválidos voltam com mensagem clara', r);
  r = pedir('obterTaxasPadraoVisa', {});
  conferir(r.ok === true && r.taxas && r.taxas.p5 === 7.57, 'obterTaxasPadraoVisa devolve as taxas', r);

  // ---- Desempenho: esquema, cache (sem apagar nenhuma aba da planilha real) ----
  conferir(lerPropsDoc_()[PROP_ESQUEMA_] === ESQUEMA_VERSAO_, 'versão do esquema gravada: configurarPlanilha_ não roda mais a cada pedido', null);
  conferir(lerCacheDados_() !== null, 'salvarDados deixou o cache preenchido', null);
  var doCache = pedir('obterDados', {});
  var daPlanilha = pedir('obterDados', { forcar: true });
  var semData = function (o) { return json({ g: o.gastos, p: o.parametros, c: o.cartoes, a: o.parametrosAusentes, u: o.urlPlanilha }); };
  conferir(doCache.ok && daPlanilha.ok && semData(doCache) === semData(daPlanilha), 'cache = leitura da planilha (obterDados com forcar)', [doCache, daPlanilha]);
  var configV = lerPropsDoc_()[PROP_CONFIG_V_] || null;
  PropertiesService.getDocumentProperties().setProperty(PROP_CONFIG_V_, 'testarApi-' + Date.now()); // como o onEdit faz
  conferir(lerCacheDados_() === null, 'edição à mão (configV nova) faz o cache deixar de valer', null);
  r = pedir('obterDados', {});
  conferir(r.ok === true && lerCacheDados_() !== null && semData(r) === semData(daPlanilha), 'obterDados sem cache lê a planilha e repõe o cache', r);
  if (configV === null) PropertiesService.getDocumentProperties().deleteProperty(PROP_CONFIG_V_);
  else PropertiesService.getDocumentProperties().setProperty(PROP_CONFIG_V_, configV);
  apagarCacheDados_();

  // ---- Orçamentos (registro de teste, apagado no fim) ----
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mesDeTeste = '2000-01';
  var tinhaMesDeTeste = !!acharLinhaMes_(ss.getSheetByName(ABA_MESES_), mesDeTeste);
  var id = Utilities.getUuid().toLowerCase();
  try {
    var dados = orcamentoDeTeste_(atuais.parametros, atuais.cartoes);
    // Seção 17: veículo em campos e a lista de serviços da oficina
    dados.entrada.veiculo = { placa: 'TST-0001', modelo: 'Carro de teste', ano: '', combustivel: 'Flex' };
    dados.entrada.servicos = [{ id: 's_teste', descricao: 'Serviço de teste', horasTexto: '', valorTexto: '100' }];
    r = pedir('salvarOrcamento', { orcamento: { id: id, atualizadoEmBase: null, cliente: 'TESTE testarApi', telefone: '', dados: dados } });
    conferir(r.ok === true && r.situacao === 'Aberto' && r.atualizadoEm, 'salvarOrcamento cria o orçamento (Aberto)', r);
    var a1 = r.atualizadoEm;
    r = pedir('salvarOrcamento', { orcamento: { id: id, atualizadoEmBase: a1, cliente: 'TESTE testarApi 2', telefone: '', dados: dados } });
    conferir(r.ok === true && r.atualizadoEm !== a1, 'salvar de novo (mesmo ID) atualiza o mesmo registro', r);
    var a2 = r.atualizadoEm;
    conferir(contarLinhasDoId_(id) === 1, 'continua 1 linha só para esse ID', null);
    r = pedir('salvarOrcamento', { orcamento: { id: id, atualizadoEmBase: a1, cliente: 'versão velha', telefone: '', dados: dados } });
    conferir(r.ok === false && r.conflito === true && r.erro === MSG_CONFLITO_, 'salvar sobre versão mais nova → conflito', r);
    r = pedir('obterOrcamento', { id: id });
    conferir(r.ok === true && r.orcamento.cliente === 'TESTE testarApi 2', 'obterOrcamento devolve o registro', r);
    var ent = r.orcamento.dados.entrada;
    conferir(ent.veiculo && ent.veiculo.placa === 'TST-0001' && ent.servicos && ent.servicos[0].id === 's_teste',
      'o orçamento guarda o veículo e os serviços da oficina (seção 17)', r);
    var imposto = Math.round(10000 * atuais.parametros.impostoPercentual / 100);
    r = pedir('mudarSituacao', { id: id, atualizadoEmBase: a2, situacao: 'Fechado', fechamento: {
      forma: 'pix', parcelas: null, cartao: '', taxaPct: 0, valorCombinadoC: 10000, data: '2000-01-15',
      taxaC: 0, impostoC: imposto, pecasPagarC: 0, pagaOficinaC: 0, vaiParaCasaC: null,
      sobraC: 10000 - imposto, totalSeuC: null, estado: 'verde' } });
    conferir(r.ok === true && r.situacao === 'Fechado', 'mudarSituacao → Fechado', r);
    r = pedir('listarOrcamentos', { mes: mesDeTeste });
    conferir(r.ok === true && r.meses[mesDeTeste] && r.orcamentos.some(function (o) { return o.id === id && o.valorCombinadoC === 10000; }),
      'listarOrcamentos traz o fechamento e a foto dos gastos do mês', r);
    conferir(r.orcamentos.some(function (o) { return o.id === id && o.itens.indexOf('TST-0001') >= 0 && o.itens.indexOf('Serviço de teste') >= 0; }),
      'listarOrcamentos traz os itens da coluna Z para a busca (seção 17)', r);
    r = pedir('mudarSituacao', { id: id, atualizadoEmBase: r.orcamentos.filter(function (o) { return o.id === id; })[0].atualizadoEm, situacao: 'Aberto' });
    conferir(r.ok === true && r.situacao === 'Aberto', 'voltar para Aberto desfaz o fechamento', r);
    r = pedir('mudarSituacao', { id: id, atualizadoEmBase: r.atualizadoEm, situacao: 'Não fechou', motivo: 'Achou caro' });
    conferir(r.ok === true && r.situacao === 'Não fechou', 'mudarSituacao → Não fechou (com motivo)', r);
    var a3 = r.atualizadoEm;
    r = pedir('excluirOrcamento', { id: id, atualizadoEmBase: a3 });
    conferir(r.ok === true, 'excluirOrcamento apaga o registro', r);
    r = pedir('salvarOrcamento', { orcamento: { id: id, atualizadoEmBase: a3, cliente: 'ressuscitar?', telefone: '', dados: dados } });
    conferir(r.ok === false && r.excluido === true && r.erro === MSG_EXCLUIDO_ && contarLinhasDoId_(id) === 0,
      'salvar um orçamento excluído em outro aparelho é recusado (não ressuscita)', r);
    r = pedir('obterOrcamento', { id: id });
    conferir(r.ok === false && r.excluido === true, 'obterOrcamento de um excluído avisa', r);
  } finally {
    var linha = acharLinhaOrcamento_(ss.getSheetByName(ABA_ORCAMENTOS_), id);
    if (linha) ss.getSheetByName(ABA_ORCAMENTOS_).deleteRow(linha);
    var linhaMes = acharLinhaMes_(ss.getSheetByName(ABA_MESES_), mesDeTeste);
    if (linhaMes && !tinhaMesDeTeste) ss.getSheetByName(ABA_MESES_).deleteRow(linhaMes);
  }
  Logger.log('Todos os testes da API passaram (o orçamento de teste foi apagado).');
}

/** Dados mínimos e válidos de um orçamento de teste (para o testarApi). */
function orcamentoDeTeste_(parametros, cartoes) {
  return {
    v: 1,
    entrada: { descricao: 'TESTE testarApi', modo: 'fechado', horasTexto: '', valorTexto: '100', horasFechadoTexto: '',
      pecasModo: 'acrescimo', pecas: [], pecasPagarTexto: '', pecasCobrarTexto: '', acrescimoTexto: null,
      descontoTexto: '0', extraTexto: '', bandeira: '' },
    foto: { em: hojeTexto_(Date.now()), parametros: parametros, gastosOficina: 0, gastosCasa: 0, horasCobradasMes: 0,
      minimoHoraOficina: 0, minimoHoraCasa: 0, cartoes: cartoes },
    resultado: { horas: 0, pecasPagarC: 0, pecasCobrarC: 0, aVistaBaseC: 10000, ancora: null, descontoTotal: 0,
      oferecidoC: 10000, destaques: [], pagaOficinaC: 0, vaiParaCasaC: null, sobraC: 10000, totalSeuC: null,
      pisoOficinaC: 0, pisoCasaC: 0, estado: 'verde' }
  };
}

function contarLinhasDoId_(id) {
  var sh = aba_(ABA_ORCAMENTOS_);
  return lerCorpo_(sh, 1).filter(function (l) { return String(l[0]).trim() === id; }).length;
}

/** Diz o que falta/está errado nas URLs do topo do arquivo; '' = tudo certo. (Pura, testável.) */
function problemaNasUrls_(urlApp, urlApi) {
  if (!urlApp) return 'Preencha URL_DO_APP com o endereço do app (ex.: https://marquesarao.github.io/preco-certo/) e rode de novo.';
  if (!/^https:\/\/[^\s#?]+$/.test(urlApp)) return 'A URL_DO_APP precisa começar com https:// e não pode ter espaços, "#" nem "?". Corrija e rode de novo.';
  if (!urlApi) return 'Preencha URL_DA_API com a URL /exec da implantação (Implantar → Gerenciar implantações) e rode de novo.';
  if (!URL_API_VALIDA_.test(urlApi)) return 'A URL_DA_API não está no formato https://script.google.com/macros/s/…/exec. Copie de novo em Implantar → Gerenciar implantações e rode de novo.';
  return '';
}

function montarLinkDeConfiguracao_(urlApp, urlApi, token) {
  var conteudo = JSON.stringify({ api: urlApi, token: token });
  var b64 = Utilities.base64EncodeWebSafe(conteudo, Utilities.Charset.UTF_8).replace(/=+$/, '');
  return urlApp + '#cfg=' + b64;
}

function obterOuCriarToken_() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty(PROP_TOKEN_);
  if (!token) {
    token = gerarToken_();
    props.setProperty(PROP_TOKEN_, token);
  }
  return token;
}

/** 64 caracteres hexadecimais (dois UUIDs aleatórios sem hífen). */
function gerarToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

// ============================================================
// Ações (internas): gastos, ajustes e cartões
// ============================================================

/**
 * Gastos, ajustes e cartões. Com cache: sem lock e sem tocar na planilha. forcar (link "Recarregar da planilha"):
 * lê a planilha com o lock e repõe o cache. atualizadoEm vem das propriedades (lidas no começo do pedido).
 */
function obterDados_(forcar) {
  var d = dadosDaConfig_(forcar);
  return {
    gastos: d.gastos,
    parametros: d.parametros,
    parametrosAusentes: d.parametrosAusentes || [],
    cartoes: d.cartoes,
    atualizadoEm: propsDoPedido_()[PROP_ATUALIZADO_EM_] || null,
    urlPlanilha: d.urlPlanilha
  };
}

/**
 * Regrava SÓ as abas Gastos, Parâmetros e Taxas com dados JÁ validados (nunca Orçamentos nem Meses).
 * Parâmetro opcional ausente (tela antiga) → mantém o valor que já está na aba. Quem chama segura o lock.
 * Depois de gravar: repõe o cache (montado das MESMAS linhas gravadas, com a regra da leitura) e, se os totais do
 * mês mudaram, atualiza a linha do mês corrente na aba Meses (no mesmo lock).
 * @return {atualizadoEm (ISO), fotoMes (foto gravada ou null)}
 */
function salvarDados_(limpo) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var antes = lerCacheDados_(); // para saber se os totais do mês mudaram (sem cache: confere a aba Meses)

  var linhasGastos = limpo.gastos.map(function (g) {
    return [g.tipo, g.descricao, g.valor === null ? '' : g.valor];
  });
  regravarCorpo_(aba_(ABA_GASTOS_), CAB_GASTOS_.length, linhasGastos);

  var faltando = PARAMETROS_OPCIONAIS_.filter(function (k) { return limpo.parametros[k] === undefined; });
  if (faltando.length) {
    var ausentesNaAba = [];
    var naAba = lerParametros_(ss, ausentesNaAba);
    faltando.forEach(function (k) {
      if (ausentesNaAba.indexOf(k) < 0) limpo.parametros[k] = naAba[k]; // senão: continua sem a linha (migração depois)
    });
  }
  var shParametros = aba_(ABA_PARAMETROS_);
  shParametros.getRange('B:B').setNumberFormat('@');
  var linhasParam = linhasParametros_(limpo.parametros);
  regravarCorpo_(shParametros, CAB_PARAMETROS_.length, linhasParam);

  var linhasTaxas = linhasCartoes_(limpo.cartoes);
  regravarCorpo_(aba_(ABA_TAXAS_), CAB_TAXAS_.length, linhasTaxas);

  SpreadsheetApp.flush();

  var atualizadoEm = new Date().toISOString();
  PropertiesService.getDocumentProperties().setProperty(PROP_ATUALIZADO_EM_, atualizadoEm);
  if (PEDIDO_) PEDIDO_.props[PROP_ATUALIZADO_EM_] = atualizadoEm;

  // Cache = o que a leitura devolveria (mesmas linhas, mesmas regras).
  var ausentes = [];
  var dados = {
    gastos: gastosDasLinhas_(linhasGastos),
    parametros: parametrosDasLinhas_(linhasParam, ausentes),
    parametrosAusentes: null,
    cartoes: cartoesDasLinhas_(linhasTaxas),
    urlPlanilha: antes && antes.urlPlanilha ? antes.urlPlanilha : ss.getUrl()
  };
  dados.parametrosAusentes = ausentes.filter(function (k) { return PARAMETROS_OPCIONAIS_.indexOf(k) >= 0 && !DERIVADOS_.hasOwnProperty(k); }); // derivados ausentes = vêm da chave de origem (não é pendência)
  gravarCacheDados_(dados);

  // Mês corrente acompanha os gastos (antes era uma 2ª chamada da tela: usarGastosDeHojeNoMes).
  var hoje = totaisDosDados_(dados);
  var fotoMes = null;
  if (!antes || !mesmosTotais_(totaisDosDados_(antes), hoje)) fotoMes = atualizarFotoDoMesCorrente_(hoje);
  return { atualizadoEm: atualizadoEm, fotoMes: fotoMes };
}

/** Grava a linha do mês corrente com os totais de hoje, se ela não existe ou está diferente. Quem chama segura o lock. */
function atualizarFotoDoMesCorrente_(hoje) {
  var mes = mesCorrente_();
  var foto = lerMeses_()[mes] || null;
  if (mesmosTotais_(foto, hoje)) return null;
  return gravarFotoDoMes_(mes, ORIGEM_GASTOS_DE_HOJE_, true, hoje);
}

/** Taxas Visa/Master padrão da InfinitePay, para o botão "Preencher com as taxas padrão". */
function obterTaxasPadraoVisa_() {
  var taxas = {};
  CAMPOS_TAXA_.forEach(function (campo, i) { taxas[campo] = TAXAS_VISA_PADRAO_[i]; });
  return taxas;
}

// ============================================================
// Ações (internas): orçamentos — um registro por vez
// ============================================================

/**
 * Lista do mês, SEM lock: resumos (colunas A–U) dos orçamentos FEITOS ou FECHADOS no mês pedido e no anterior
 * (o anterior serve para a comparação). O JSON não é devolvido, mas o das linhas do MÊS PEDIDO é conferido
 * (linha com JSON corrompido é ignorada e registrada no log), lido em trechos de linhas seguidas.
 * Leituras: Orçamentos A–U (1) + trechos do mês (normalmente 1–2) + Meses (1); gastos de hoje vêm do cache.
 * Mês corrente com a foto diferente dos gastos de hoje (ou sem foto): grava a linha ali mesmo (lock só para isso).
 * Leitura sem lock no meio de uma exclusão pode pular ou repetir uma linha por um instante: ID repetido entra uma vez só.
 */
function listarOrcamentos_(mes) {
  var sh = aba_(ABA_ORCAMENTOS_);
  var anterior = mesAnterior_(mes);
  var linhas = lerCorpo_(sh, COL_ORC_.motivo);
  // Seções 16 e 17: W..Z (terceiros, entrada, itens) numa leitura estreita à parte (o JSON fica no meio, em V)
  var extras = linhas.length ? sh.getRange(2, COL_ORC_.terceiros, linhas.length, 4).getValues() : [];
  var escolhidas = [];
  var vistos = {};
  var primeiroMes = null;
  linhas.forEach(function (l, i) {
    var r = resumoDaLinha_(l, extras[i] || ['', '', '', '']);
    if (!r || vistos[r.id]) return; // sem ID válido, ou ID repetido: entra uma vez só
    vistos[r.id] = true;
    var mesCriado = mesDe_(r.criadoEm);
    if (mesCriado && (!primeiroMes || mesCriado < primeiroMes)) primeiroMes = mesCriado;
    var mesFechado = r.situacao === 'Fechado' ? mesDe_(r.dataFechamento) : '';
    if (mesCriado === mes || mesCriado === anterior || mesFechado === mes || mesFechado === anterior) {
      escolhidas.push({ linha: i + 2, resumo: r, doMes: mesCriado === mes || mesFechado === mes });
    }
  });

  // Confere o JSON só das linhas do mês pedido, uma leitura (A..V) por trecho de linhas seguidas.
  var defeito = {};
  trechosDeLinhas_(escolhidas.filter(function (e) { return e.doMes; }).map(function (e) { return e.linha; })).forEach(function (t) {
    var vals = sh.getRange(t.de, 1, t.ate - t.de + 1, COL_ORC_.dados).getValues();
    escolhidas.forEach(function (e) {
      if (!e.doMes || e.linha < t.de || e.linha > t.ate) return;
      var l = vals[e.linha - t.de];
      if (String(l[0]).trim() !== e.resumo.id) return; // a linha mudou de lugar (exclusão no meio): não descarta
      if (!lerJsonOrcamento_(l[COL_ORC_.dados - 1], e.linha, e.resumo.id)) defeito[e.resumo.id] = true;
    });
  });
  var orcamentos = escolhidas.filter(function (e) { return !defeito[e.resumo.id]; }).map(function (e) { return e.resumo; });

  var fotos = lerMeses_();
  var hoje = totaisDosDados_(dadosDaConfig_());
  var fotoMes = fotos[mes] || null;
  if (mes === mesCorrente_() && !mesmosTotais_(fotoMes, hoje)) {
    fotoMes = comLock_(function () { return gravarFotoDoMes_(mes, ORIGEM_GASTOS_DE_HOJE_, true, hoje); });
  }
  var meses = {};
  meses[mes] = fotoMes;
  meses[anterior] = fotos[anterior] || null;
  return {
    ok: true,
    mes: mes,
    mesAnterior: anterior,
    primeiroMes: primeiroMes,
    orcamentos: orcamentos,
    meses: meses,
    gastosHoje: hoje
  };
}

/** [5, 6, 7, 12, 13] → [{de:5, ate:7}, {de:12, ate:13}] (números de linha em ordem crescente). */
function trechosDeLinhas_(numeros) {
  var t = [];
  numeros.slice().sort(function (a, b) { return a - b; }).forEach(function (n) {
    var u = t[t.length - 1];
    if (u && n === u.ate + 1) u.ate = n; else if (!u || n > u.ate) t.push({ de: n, ate: n });
  });
  return t;
}

/** SEM lock. Se a linha achada não for a do ID (exclusão no meio da leitura) ou não der para ler, confere com o lock. */
function obterOrcamento_(id) {
  var reg = lerRegistroSemLock_(id);
  if (!reg) return { ok: false, excluido: true, erro: MSG_EXCLUIDO_ };
  return { ok: true, orcamento: publicoDoRegistro_(reg) };
}

function lerRegistroSemLock_(id) {
  var sh = aba_(ABA_ORCAMENTOS_);
  var linha = acharLinhaOrcamento_(sh, id);
  if (linha) {
    var reg = lerRegistroDaLinha_(sh, linha);
    if (reg && reg.id === id) return reg;
  }
  return comLock_(function () { return lerRegistro_(id); });
}

/**
 * Upsert por ID com controle de conflito:
 * - sem base: ID inédito → linha nova "Aberto"; ID que já existe → conflito;
 * - com base: ID sumiu → "excluído em outro aparelho" (não ressuscita); base diferente → conflito; igual → grava.
 * Em Fechado/Não fechou só cliente e telefone mudam (a conta e a foto ficam).
 */
function salvarOrcamento_(pedido) {
  var sh = aba_(ABA_ORCAMENTOS_);
  var linha = acharLinhaOrcamento_(sh, pedido.id);
  var agora = Date.now();

  if (!linha) {
    if (pedido.base !== null) return { ok: false, excluido: true, erro: MSG_EXCLUIDO_ };
    var novo = {
      id: pedido.id,
      criadoEm: dataHoraTexto_(agora),
      atualizadoEm: carimbo_(agora, ''),
      cliente: pedido.cliente,
      telefone: pedido.telefone,
      dados: pedido.dados
    };
    novo.dados.situacao = 'Aberto';
    novo.dados.fechamento = null;
    novo.dados.motivo = '';
    var ultima = Math.max(sh.getLastRow(), 1);
    escreverRegistro_(sh, ultima + 1, novo);
    return { ok: true, id: novo.id, criadoEm: novo.criadoEm, atualizadoEm: novo.atualizadoEm, situacao: 'Aberto' };
  }

  var reg = lerRegistroDaLinha_(sh, linha);
  if (!reg) throw erroApi_(MSG_DEFEITO_);
  if (pedido.base === null || pedido.base !== reg.atualizadoEm) return conflito_(reg);

  reg.cliente = pedido.cliente;
  reg.telefone = pedido.telefone;
  if (reg.dados.situacao === 'Aberto') {
    pedido.dados.situacao = 'Aberto';
    pedido.dados.fechamento = null;
    pedido.dados.motivo = '';
    reg.dados = pedido.dados;
  }
  reg.atualizadoEm = carimbo_(agora, reg.atualizadoEm);
  escreverRegistro_(sh, linha, reg);
  return { ok: true, id: reg.id, criadoEm: reg.criadoEm, atualizadoEm: reg.atualizadoEm, situacao: reg.dados.situacao };
}

/**
 * Fechado (com o fechamento já conferido), Aberto (desfaz o fechamento e o motivo) ou Não fechou (com motivo).
 * O 1º fechamento de um mês grava a foto dos gastos daquele mês na aba Meses.
 */
function mudarSituacao_(p) {
  var sh = aba_(ABA_ORCAMENTOS_);
  var linha = acharLinhaOrcamento_(sh, p.id);
  if (!linha) return { ok: false, excluido: true, erro: MSG_EXCLUIDO_ };
  var reg = lerRegistroDaLinha_(sh, linha);
  if (!reg) throw erroApi_(MSG_DEFEITO_);
  if (p.base !== reg.atualizadoEm) return conflito_(reg);

  var mesGravado = null;
  if (p.situacao === 'Fechado') {
    if (reg.dados.situacao === 'Fechado') throw erroApi_('Este orçamento já está fechado. Volte para Aberto antes de fechar de novo.');
    conferirFechamento_(p.fechamento, reg.dados);
    reg.dados.fechamento = p.fechamento;
    reg.dados.motivo = '';
    var mes = mesDe_(p.fechamento.data);
    if (!lerMeses_()[mes]) {
      gravarFotoDoMes_(mes, ORIGEM_PRIMEIRO_FECHAMENTO_, false);
      mesGravado = mes;
    }
  } else if (p.situacao === 'Aberto') {
    reg.dados.fechamento = null;
    reg.dados.motivo = '';
  } else {
    reg.dados.fechamento = null;
    reg.dados.motivo = p.motivo;
  }
  reg.dados.situacao = p.situacao;
  reg.atualizadoEm = carimbo_(Date.now(), reg.atualizadoEm);
  escreverRegistro_(sh, linha, reg);
  return { ok: true, atualizadoEm: reg.atualizadoEm, situacao: p.situacao, mesGravado: mesGravado };
}

/** Apaga a linha. ID que já não existe → ok (nada a fazer). Base diferente → conflito. */
function excluirOrcamento_(id, base) {
  var sh = aba_(ABA_ORCAMENTOS_);
  var linha = acharLinhaOrcamento_(sh, id);
  if (!linha) return { ok: true, jaExcluido: true };
  var atual = textoCelula_(sh.getRange(linha, COL_ORC_.atualizadoEm).getValue());
  if (atual !== base) {
    var reg = lerRegistroDaLinha_(sh, linha);
    return reg ? conflito_(reg) : { ok: false, conflito: true, erro: MSG_CONFLITO_ };
  }
  sh.deleteRow(linha);
  return { ok: true };
}

function conflito_(reg) {
  return { ok: false, conflito: true, erro: MSG_CONFLITO_, atual: resumoDoRegistro_(reg) };
}

// ---------- Foto dos gastos por mês (aba Meses) ----------

/** Totais de hoje (centavos e horas do mês), dos dados de configuração (cache; sem cache: leitura com lock). */
function gastosDeHoje_() {
  return totaisDosDados_(dadosDaConfig_());
}

/**
 * Grava (ou, com sobrescrever, troca) a linha do mês com os gastos de hoje (ou com "hoje", se vier). Quem chama segura o lock.
 * @return a foto gravada
 */
function gravarFotoDoMes_(mes, origem, sobrescrever, hoje) {
  var sh = aba_(ABA_MESES_);
  var linha = acharLinhaMes_(sh, mes);
  if (linha && !sobrescrever) return lerMeses_()[mes] || null;
  hoje = hoje || gastosDeHoje_();
  var gravadoEm = dataHoraTexto_(Date.now()).slice(0, 16);
  var valores = [mes, hoje.oficinaC / 100, hoje.casaC / 100, hoje.horas, gravadoEm, origem];
  var destino = linha || Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(destino, 1, 1, CAB_MESES_.length).setNumberFormats([FORMATOS_MESES_]).setValues([valores]);
  return { mes: mes, oficinaC: hoje.oficinaC, casaC: hoje.casaC, horas: hoje.horas, gravadoEm: gravadoEm, origem: origem };
}

/** Foto do mês ou null (sem linha, ou linha inválida). Leitura tolerante. */
function lerFotoDoMes_(ss, mes) {
  return lerMeses_()[mes] || null;
}

/** A aba Meses inteira numa leitura só → { "aaaa-mm": foto }. Linha inválida fica de fora (e vai para o log). */
function lerMeses_() {
  var fotos = {};
  lerCorpo_(aba_(ABA_MESES_), CAB_MESES_.length).forEach(function (l, i) {
    var mes = textoMes_(l[0]);
    if (!mes || fotos.hasOwnProperty(mes)) return; // mês repetido: vale a 1ª linha (a que acharLinhaMes_ grava)
    var oficina = lerNumeroBR_(l[1]);
    var casa = lerNumeroBR_(l[2]);
    var horas = lerNumeroBR_(l[3]);
    if (!dentroDoLimite_(oficina, LIMITE_VALOR_FOTO_) || !dentroDoLimite_(casa, LIMITE_VALOR_FOTO_) ||
        !dentroDoLimite_(horas, { min: 0, max: MAX_HORAS_ })) {
      avisoNoLog_('Meses: linha ' + (i + 2) + ' (' + mes + ') ignorada: valores inválidos.');
      fotos[mes] = null;
      return;
    }
    fotos[mes] = { mes: mes, oficinaC: Math.round(oficina * 100), casaC: Math.round(casa * 100), horas: horas,
      gravadoEm: textoCelula_(l[4]), origem: textoCelula_(l[5]) };
  });
  return fotos;
}
var LIMITE_VALOR_FOTO_ = { min: 0, max: MAX_VALOR_ * MAX_GASTOS_ };

function acharLinhaMes_(sh, mes) {
  if (!sh) return 0;
  var col = lerCorpo_(sh, 1);
  for (var i = 0; i < col.length; i++) {
    if (textoMes_(col[i][0]) === mes) return i + 2;
  }
  return 0;
}

// ---------- Linhas da aba Orçamentos ----------

function acharLinhaOrcamento_(sh, id) {
  if (!sh) return 0;
  var col = lerCorpo_(sh, 1);
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]).trim() === id) return i + 2;
  }
  return 0;
}

function lerRegistro_(id) {
  var sh = aba_(ABA_ORCAMENTOS_);
  var linha = acharLinhaOrcamento_(sh, id);
  if (!linha) return null;
  var reg = lerRegistroDaLinha_(sh, linha);
  if (!reg) throw erroApi_(MSG_DEFEITO_);
  return reg;
}

/** Registro completo da linha (com o JSON). JSON corrompido → null (e registro no log). */
function lerRegistroDaLinha_(sh, linha) {
  var l = sh.getRange(linha, 1, 1, CAB_ORCAMENTOS_.length).getValues()[0];
  var id = String(l[0]).trim();
  var dados = lerJsonOrcamento_(l[COL_ORC_.dados - 1], linha, id);
  if (!dados) return null;
  return {
    id: id,
    criadoEm: textoCelula_(l[COL_ORC_.criadoEm - 1]),
    atualizadoEm: textoCelula_(l[COL_ORC_.atualizadoEm - 1]),
    cliente: textoCelula_(l[COL_ORC_.cliente - 1]).slice(0, MAX_CLIENTE_),
    telefone: textoCelula_(l[COL_ORC_.telefone - 1]).slice(0, MAX_TELEFONE_),
    dados: dados
  };
}

/** JSON da coluna "Dados" → objeto, ou null (registrado no log). */
function lerJsonOrcamento_(texto, linha, id) {
  var dados = null;
  try {
    dados = JSON.parse(String(texto));
  } catch (_) {
    dados = null;
  }
  if (!dados || typeof dados !== 'object' || dados.v !== 1 || !dados.entrada || !dados.resultado) {
    avisoNoLog_('Orçamentos: linha ' + linha + ' ignorada (JSON inválido), ID ' + id);
    return null;
  }
  if (SITUACOES_.indexOf(dados.situacao) < 0) dados.situacao = 'Aberto';
  return dados;
}

/** O que obterOrcamento devolve ao app. */
function publicoDoRegistro_(reg) {
  return {
    id: reg.id,
    criadoEm: reg.criadoEm,
    atualizadoEm: reg.atualizadoEm,
    cliente: reg.cliente,
    telefone: reg.telefone,
    situacao: reg.dados.situacao,
    motivo: reg.dados.motivo || '',
    dados: reg.dados
  };
}

/** Linha da planilha (A..Z) a partir do registro. As colunas legíveis vêm do JSON. */
function linhaDoRegistro_(reg) {
  var d = reg.dados;
  var f = d.situacao === 'Fechado' ? d.fechamento : null;
  var reais = function (c) { return c === null || c === undefined ? '' : c / 100; };
  return [
    reg.id,
    reg.criadoEm,
    reg.atualizadoEm,
    reg.cliente,
    reg.telefone,
    d.entrada.descricao,
    d.situacao,
    reais(d.resultado.oferecidoC),
    f ? f.data : '',
    f ? FORMAS_FECHAMENTO_[f.forma] : '',
    f && f.forma !== 'pix' ? f.parcelas : '',
    f && f.forma !== 'pix' ? (f.cartao || 'Não sei') : '',
    f ? reais(f.valorCombinadoC) : '',
    d.resultado.horas,
    reais(f ? f.pecasPagarC : d.resultado.pecasPagarC),
    f ? reais(f.taxaC) : '',
    f ? reais(f.impostoC) : '',
    f ? reais(f.pagaOficinaC) : '',
    f ? reais(f.vaiParaCasaC) : '',
    f ? reais(f.sobraC) : '',
    d.situacao === 'Não fechou' ? (d.motivo || '') : '',
    JSON.stringify(d),
    reais(f ? (f.terceirosPagarC || 0) : (d.resultado.terceirosPagarC || 0)),
    f && f.forma === 'entrada' ? reais(f.entradaC) : '',
    f && f.forma === 'entrada' ? FORMAS_ENTRADA_[f.formaEntrada] || '' : '',
    itensDoOrcamento_(d.entrada)
  ];
}

/** Escreve UMA linha (formatos + valores). Nunca regrava a aba inteira. */
function escreverRegistro_(sh, linha, reg) {
  sh.getRange(linha, 1, 1, CAB_ORCAMENTOS_.length).setNumberFormats([FORMATOS_ORC_]).setValues([linhaDoRegistro_(reg)]);
}

/**
 * Resumo de uma linha lida (colunas A..U), tolerante. Sem ID válido → null.
 * extra (seções 16 e 17): as colunas W..Z da mesma linha (lidas à parte no listarOrcamentos); sem extra, vêm da própria linha (A..Z).
 */
function resumoDaLinha_(l, extra) {
  var w = extra || [l[COL_ORC_.terceiros - 1], l[COL_ORC_.entrada - 1], l[COL_ORC_.formaEntrada - 1], l[COL_ORC_.itens - 1]];
  var id = String(l[0]).trim();
  if (!RE_ID_.test(id)) return null;
  var centavos = function (v) {
    var n = lerNumeroBR_(v);
    return n === null || !isFinite(n) || Math.abs(n) * 100 > MAX_CENTAVOS_ ? null : Math.round(n * 100);
  };
  var situacao = textoCelula_(l[COL_ORC_.situacao - 1]);
  if (SITUACOES_.indexOf(situacao) < 0) situacao = 'Aberto';
  var parcelas = lerNumeroBR_(l[COL_ORC_.parcelas - 1]);
  var horas = lerNumeroBR_(l[COL_ORC_.horas - 1]);
  return {
    id: id,
    criadoEm: textoCelula_(l[COL_ORC_.criadoEm - 1]),
    atualizadoEm: textoCelula_(l[COL_ORC_.atualizadoEm - 1]),
    cliente: textoCelula_(l[COL_ORC_.cliente - 1]).slice(0, MAX_CLIENTE_),
    telefone: textoCelula_(l[COL_ORC_.telefone - 1]).slice(0, MAX_TELEFONE_),
    servico: textoCelula_(l[COL_ORC_.servico - 1]).slice(0, MAX_SERVICO_),
    situacao: situacao,
    valorOrcadoC: centavos(l[COL_ORC_.valorOrcado - 1]),
    dataFechamento: situacao === 'Fechado' ? textoData_(l[COL_ORC_.dataFechamento - 1]) : '',
    forma: textoCelula_(l[COL_ORC_.forma - 1]),
    parcelas: parcelas !== null && parcelas >= 1 && parcelas <= 12 ? parcelas : null,
    cartao: textoCelula_(l[COL_ORC_.cartao - 1]).slice(0, MAX_NOME_CARTAO_),
    valorCombinadoC: centavos(l[COL_ORC_.valorCombinado - 1]),
    horas: horas !== null && horas >= 0 && horas <= MAX_HORAS_ ? horas : 0,
    pecasPagarC: centavos(l[COL_ORC_.pecasPagas - 1]),
    taxaC: centavos(l[COL_ORC_.taxa - 1]),
    impostoC: centavos(l[COL_ORC_.imposto - 1]),
    pagaOficinaC: centavos(l[COL_ORC_.pagaOficina - 1]),
    vaiParaCasaC: centavos(l[COL_ORC_.vaiParaCasa - 1]),
    sobraC: centavos(l[COL_ORC_.sobra - 1]),
    motivo: textoCelula_(l[COL_ORC_.motivo - 1]).slice(0, MAX_MOTIVO_),
    terceirosPagarC: centavos(w[0]) || 0,
    entradaC: centavos(w[1]),
    formaEntrada: textoCelula_(w[2]).slice(0, 20),
    itens: textoCelula_(w[3]).slice(0, MAX_ITENS_) // seção 17
  };
}

/** Resumo (mesmo formato da lista) a partir de um registro completo. */
function resumoDoRegistro_(reg) {
  return resumoDaLinha_(linhaDoRegistro_(reg));
}

// ============================================================
// Validação dos orçamentos (rígida; a mensagem vai para o usuário)
// ============================================================

function validarId_(id) {
  if (typeof id !== 'string' || !RE_ID_.test(id)) throw erroApi_('Orçamento inválido: ID.');
  return id;
}

/** atualizadoEmBase: null/ausente (só quando "obrigatorio" é falso) ou texto. */
function validarBase_(base, obrigatorio) {
  if (base === null || base === undefined) {
    if (obrigatorio) throw erroApi_('Pedido inválido.');
    return null;
  }
  if (typeof base !== 'string' || base.length > 40) throw erroApi_('Pedido inválido.');
  return base;
}

function validarMes_(mes) {
  if (typeof mes !== 'string' || !RE_MES_.test(mes)) throw erroApi_('Mês inválido.');
  return mes;
}

function validarPedidoSalvar_(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw erroApi_('Orçamento inválido.');
  return {
    id: validarId_(o.id),
    base: validarBase_(o.atualizadoEmBase, false),
    cliente: exigirTexto_(o.cliente, MAX_CLIENTE_, 'Cliente'),
    telefone: validarTelefone_(o.telefone),
    dados: validarDadosOrcamento_(o.dados)
  };
}

function validarPedidoSituacao_(req) {
  var p = {
    id: validarId_(req.id),
    base: validarBase_(req.atualizadoEmBase, true),
    situacao: req.situacao,
    fechamento: null,
    motivo: ''
  };
  if (SITUACOES_.indexOf(p.situacao) < 0) throw erroApi_('Situação inválida.');
  if (p.situacao === 'Fechado') p.fechamento = validarFechamento_(req.fechamento);
  if (p.situacao === 'Não fechou') p.motivo = exigirTexto_(req.motivo, MAX_MOTIVO_, 'Motivo');
  return p;
}

function validarTelefone_(v) {
  var t = exigirTexto_(v, MAX_TELEFONE_, 'Telefone');
  if (!RE_TELEFONE_.test(t)) throw erroApi_('Telefone: use só números, espaço, ( ) + - e ponto.');
  return t;
}

/** Texto opcional: null/undefined → ''; aparado; acima do máximo → erro. */
function exigirTexto_(v, max, nome) {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'string') throw erroApi_(nome + ': texto inválido.');
  var t = v.trim();
  if (t.length > max) throw erroApi_(nome + ': muito longo (máx. ' + max + ' letras).');
  return t;
}

/** Texto de campo da tela (guardado como foi digitado); null permitido quando "podeNulo". */
function textoDeCampo_(v, max, nome, podeNulo) {
  if (v === null && podeNulo) return null;
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' || v.length > max) throw erroApi_('Orçamento inválido: ' + nome + '.');
  return v;
}

function exigirCentavos_(v, nome, opcoes) {
  opcoes = opcoes || {};
  if (v === null && opcoes.nulo) return null;
  if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v || Math.abs(v) > MAX_CENTAVOS_ || (!opcoes.negativo && v < 0)) {
    throw erroApi_('Orçamento inválido: ' + nome + '.');
  }
  return v;
}

function exigirNumeroOrc_(v, nome, min, max) {
  if (typeof v !== 'number' || !isFinite(v) || v < min || v > max) throw erroApi_('Orçamento inválido: ' + nome + '.');
  return v;
}

function exigirOpcao_(v, lista, nome) {
  if (lista.indexOf(v) < 0) throw erroApi_('Orçamento inválido: ' + nome + '.');
  return v;
}

/** {v, entrada, foto, resultado} → cópia limpa (só os campos conhecidos). */
function validarDadosOrcamento_(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw erroApi_('Orçamento inválido.');
  var tamanho;
  try { tamanho = JSON.stringify(d).length; } catch (_) { throw erroApi_('Orçamento inválido.'); }
  if (tamanho > MAX_JSON_ORCAMENTO_) throw erroApi_('Orçamento grande demais.');
  if (d.v !== 1) throw erroApi_('Orçamento inválido: versão.');
  return {
    v: 1,
    entrada: validarEntrada_(d.entrada),
    foto: validarFoto_(d.foto),
    resultado: validarResultado_(d.resultado)
  };
}

function validarEntrada_(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) throw erroApi_('Orçamento inválido: entrada.');
  if (!Array.isArray(e.pecas)) throw erroApi_('Orçamento inválido: peças.');
  if (e.pecas.length > MAX_PECAS_) throw erroApi_('Peças demais: o limite é ' + MAX_PECAS_ + '.');
  var descricao = exigirTexto_(e.descricao, MAX_SERVICO_, 'Serviço / veículo');
  var limpo = {
    descricao: descricao,
    modo: exigirOpcao_(e.modo, ['horas', 'fechado'], 'modo'),
    horasTexto: textoDeCampo_(e.horasTexto, MAX_TEXTO_CAMPO_, 'horas'),
    valorTexto: textoDeCampo_(e.valorTexto, MAX_TEXTO_CAMPO_, 'valor'),
    horasFechadoTexto: textoDeCampo_(e.horasFechadoTexto, MAX_TEXTO_CAMPO_, 'horas'),
    pecasModo: exigirOpcao_(e.pecasModo, ['acrescimo', 'valor'], 'modo das peças'),
    pecas: e.pecas.map(function (p, i) {
      if (!p || typeof p !== 'object') throw erroApi_('Orçamento inválido: peça nº ' + (i + 1) + '.');
      var desc = textoDeCampo_(p.descricao, MAX_DESCRICAO_PECA_, 'peça nº ' + (i + 1));
      return {
        descricao: desc,
        qtdTexto: textoDeCampo_(p.qtdTexto, MAX_TEXTO_CAMPO_, 'peça nº ' + (i + 1)),
        valorTexto: textoDeCampo_(p.valorTexto, MAX_TEXTO_CAMPO_, 'peça nº ' + (i + 1)),
        acrescimoTexto: textoOuNulo_(p.acrescimoTexto, MAX_TEXTO_CAMPO_, 'peça nº ' + (i + 1)) // seção 16: null = segue o geral
      };
    }),
    terceiros: validarTerceiros_(e.terceiros),
    entradaTexto: textoDeCampo_(e.entradaTexto, MAX_TEXTO_CAMPO_, 'entrada'),
    formaEntrada: e.formaEntrada === undefined || e.formaEntrada === null ? 'pix' : exigirOpcao_(e.formaEntrada, ['pix', 'debito'], 'forma da entrada'),
    parcelasEntrada: e.parcelasEntrada === undefined || e.parcelasEntrada === null ? null : exigirParcelas_(e.parcelasEntrada, 'parcelas da entrada'),
    pecasPagarTexto: textoDeCampo_(e.pecasPagarTexto, MAX_TEXTO_CAMPO_, 'peças'),
    pecasCobrarTexto: textoDeCampo_(e.pecasCobrarTexto, MAX_TEXTO_CAMPO_, 'peças'),
    acrescimoTexto: textoDeCampo_(e.acrescimoTexto, MAX_TEXTO_CAMPO_, 'acréscimo', true),
    descontoTexto: textoDeCampo_(e.descontoTexto, MAX_TEXTO_CAMPO_, 'desconto', true),
    extraTexto: textoDeCampo_(e.extraTexto, MAX_TEXTO_CAMPO_, 'desconto extra'),
    bandeira: textoDeCampo_(e.bandeira, MAX_NOME_CARTAO_, 'cartão')
  };
  // Seção 17: veículo em campos e vários serviços da oficina. AUSENTES = orçamento de antes (ficam ausentes).
  if (e.veiculo !== undefined && e.veiculo !== null) limpo.veiculo = validarVeiculo_(e.veiculo);
  if (e.servicos !== undefined && e.servicos !== null) limpo.servicos = validarServicos_(e.servicos);
  // Seção 16.9: desconto separado serviço × peças. AUSENTE = orçamento de antes (fica ausente: a tela usa a regra antiga).
  if (e.descontoSeparado !== undefined) {
    if (e.descontoSeparado !== null && e.descontoSeparado !== true && e.descontoSeparado !== false) throw erroApi_('Orçamento inválido: desconto separado.');
    limpo.descontoSeparado = e.descontoSeparado;
    limpo.descontoPecasTexto = textoOuNulo_(e.descontoPecasTexto, MAX_TEXTO_CAMPO_, 'desconto das peças');
  }
  return limpo;
}

/** Seção 17: veículo {placa, modelo, ano, combustivel}, tudo opcional (só tamanho e opção; o formato da placa é aviso na tela). */
function validarVeiculo_(v) {
  if (typeof v !== 'object' || Array.isArray(v)) throw erroApi_('Orçamento inválido: veículo.');
  return {
    placa: textoDeCampo_(v.placa, MAX_PLACA_, 'placa'),
    modelo: textoDeCampo_(v.modelo, MAX_MODELO_, 'modelo'),
    ano: textoDeCampo_(v.ano, 4, 'ano'),
    combustivel: exigirOpcao_(v.combustivel === undefined || v.combustivel === null ? '' : v.combustivel, COMBUSTIVEIS_, 'combustível')
  };
}

/** Seção 17: serviços da oficina [{id, descricao, horasTexto, valorTexto}] (id estável, sem repetir). */
function validarServicos_(lista) {
  if (!Array.isArray(lista)) throw erroApi_('Orçamento inválido: serviços da oficina.');
  if (lista.length > MAX_SERVICOS_) throw erroApi_('Serviços da oficina demais: o limite é ' + MAX_SERVICOS_ + '.');
  var ids = {};
  return lista.map(function (s, i) {
    var nome = 'serviço da oficina nº ' + (i + 1);
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw erroApi_('Orçamento inválido: ' + nome + '.');
    if (typeof s.id !== 'string' || !s.id || s.id.length > MAX_ID_SERVICO_ || !RE_ID_SERVICO_.test(s.id) || ids[s.id]) throw erroApi_('Orçamento inválido: ' + nome + '.');
    ids[s.id] = true;
    return {
      id: s.id,
      descricao: textoDeCampo_(s.descricao, MAX_DESCRICAO_PECA_, nome),
      horasTexto: textoDeCampo_(s.horasTexto, MAX_TEXTO_CAMPO_, nome),
      valorTexto: textoDeCampo_(s.valorTexto, MAX_TEXTO_CAMPO_, nome)
    };
  });
}

/**
 * Seção 17: texto da coluna Z "Itens" (só para a busca): placa · modelo · serviços da oficina (ou a descrição antiga)
 * · parceiros · peças. Sem descrição não entra. Até MAX_ITENS_ letras.
 */
function itensDoOrcamento_(entrada) {
  var e = entrada || {};
  var partes = [];
  var add = function (t) { t = String(t === undefined || t === null ? '' : t).trim(); if (t) partes.push(t); };
  if (e.veiculo && typeof e.veiculo === 'object') { add(e.veiculo.placa); add(e.veiculo.modelo); }
  if (Array.isArray(e.servicos)) e.servicos.forEach(function (s) { if (s) add(s.descricao); });
  else add(e.descricao);
  (Array.isArray(e.terceiros) ? e.terceiros : []).forEach(function (s) { if (s) add(s.descricao); });
  (Array.isArray(e.pecas) ? e.pecas : []).forEach(function (p) { if (p) add(p.descricao); });
  return partes.join(' · ').slice(0, MAX_ITENS_);
}

/** null/ausente → null (segue o padrão); senão, texto de campo. */
function textoOuNulo_(v, max, nome) {
  return v === undefined || v === null ? null : textoDeCampo_(v, max, nome);
}

function exigirParcelas_(v, nome) {
  if (typeof v !== 'number' || Math.floor(v) !== v || v < 1 || v > 12) throw erroApi_('Orçamento inválido: ' + nome + '.');
  return v;
}

/** Seção 16: serviços de terceiros do orçamento (sem quantidade). Ausente → []. */
function validarTerceiros_(lista) {
  if (lista === undefined || lista === null) return [];
  if (!Array.isArray(lista)) throw erroApi_('Orçamento inválido: serviços de terceiros.');
  if (lista.length > MAX_TERCEIROS_) throw erroApi_('Serviços de terceiros demais: o limite é ' + MAX_TERCEIROS_ + '.');
  return lista.map(function (s, i) {
    if (!s || typeof s !== 'object') throw erroApi_('Orçamento inválido: serviço nº ' + (i + 1) + '.');
    return {
      descricao: textoDeCampo_(s.descricao, MAX_DESCRICAO_PECA_, 'serviço nº ' + (i + 1)),
      valorTexto: textoDeCampo_(s.valorTexto, MAX_TEXTO_CAMPO_, 'serviço nº ' + (i + 1)),
      acrescimoTexto: textoOuNulo_(s.acrescimoTexto, MAX_TEXTO_CAMPO_, 'serviço nº ' + (i + 1))
    };
  });
}

function validarFoto_(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) throw erroApi_('Orçamento inválido: foto.');
  var limiteGastos = { min: 0, max: MAX_VALOR_ * MAX_GASTOS_ };
  var num = function (v, nome, lim) {
    if (!dentroDoLimite_(v, lim)) throw erroApi_('Orçamento inválido: ' + nome + '.');
    return v;
  };
  return {
    em: textoDeCampo_(f.em, 20, 'data da foto'),
    parametros: comMensagem_(function () { return validarParametros_(f.parametros); }, 'Orçamento inválido (ajustes): '),
    gastosOficina: num(f.gastosOficina, 'gastos da oficina', limiteGastos),
    gastosCasa: num(f.gastosCasa, 'gastos da casa', limiteGastos),
    horasCobradasMes: num(f.horasCobradasMes, 'horas do mês', { min: 0, max: MAX_HORAS_ }),
    minimoHoraOficina: num(f.minimoHoraOficina, 'mínimo por hora', limiteGastos),
    minimoHoraCasa: num(f.minimoHoraCasa, 'mínimo por hora', limiteGastos),
    cartoes: comMensagem_(function () { return validarCartoes_(f.cartoes); }, 'Orçamento inválido (cartões): ')
  };
}

function validarOpcaoGravada_(o, nome) {
  if (!o || typeof o !== 'object') throw erroApi_('Orçamento inválido: ' + nome + '.');
  return {
    parcelas: exigirNumeroOrc_(o.parcelas, nome, 1, 12),
    totalC: exigirCentavos_(o.totalC, nome),
    parcelaC: exigirCentavos_(o.parcelaC, nome)
  };
}

function validarResultado_(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) throw erroApi_('Orçamento inválido: resultado.');
  if (!Array.isArray(r.destaques) || r.destaques.length > 12) throw erroApi_('Orçamento inválido: parcelas em destaque.');
  var limpo = {
    horas: exigirNumeroOrc_(r.horas, 'horas', 0, MAX_HORAS_),
    pecasPagarC: exigirCentavos_(r.pecasPagarC, 'peças pagas'),
    pecasCobrarC: exigirCentavos_(r.pecasCobrarC, 'peças cobradas'),
    aVistaBaseC: exigirCentavos_(r.aVistaBaseC, 'à vista'),
    ancora: r.ancora === null ? null : validarOpcaoGravada_(r.ancora, 'cartão em destaque'),
    descontoTotal: exigirNumeroOrc_(r.descontoTotal, 'desconto', 0, MAX_DESCONTO_),
    oferecidoC: exigirCentavos_(r.oferecidoC, 'à vista oferecido'),
    destaques: r.destaques.map(function (o) { return validarOpcaoGravada_(o, 'parcelas em destaque'); }),
    pagaOficinaC: exigirCentavos_(r.pagaOficinaC, 'oficina'),
    vaiParaCasaC: exigirCentavos_(r.vaiParaCasaC, 'casa', { nulo: true }),
    sobraC: exigirCentavos_(r.sobraC, 'sobra extra', { negativo: true }),
    totalSeuC: exigirCentavos_(r.totalSeuC, 'total que é seu', { nulo: true, negativo: true }),
    pisoOficinaC: exigirCentavos_(r.pisoOficinaC, 'piso'),
    pisoCasaC: exigirCentavos_(r.pisoCasaC, 'piso'),
    estado: exigirOpcao_(r.estado, ESTADOS_, 'estado')
  };
  if ((limpo.vaiParaCasaC === null) !== (limpo.totalSeuC === null)) throw erroApi_('Orçamento inválido: total que é seu.');
  // Seção 16 (opcionais: orçamentos de antes não têm)
  if (r.terceirosPagarC !== undefined) limpo.terceirosPagarC = exigirCentavos_(r.terceirosPagarC, 'terceiros pagos');
  if (r.terceirosCobrarC !== undefined) limpo.terceirosCobrarC = exigirCentavos_(r.terceirosCobrarC, 'terceiros cobrados');
  if (r.impostoEfetivoPct !== undefined) limpo.impostoEfetivoPct = exigirNumeroOrc_(r.impostoEfetivoPct, 'imposto', 0, MAX_TAXA_);
  // Seção 16.9 (opcionais): desconto do serviço (com o extra) e das peças; descontoTotal = o equivalente
  if (r.descontoServico !== undefined) limpo.descontoServico = exigirNumeroOrc_(r.descontoServico, 'desconto do serviço', 0, MAX_DESCONTO_);
  if (r.descontoPecas !== undefined) limpo.descontoPecas = exigirNumeroOrc_(r.descontoPecas, 'desconto das peças', 0, MAX_DESCONTO_);
  return limpo;
}

/** Forma, valor e data do fechamento + as contas (a conferência com a foto fica em conferirFechamento_). */
function validarFechamento_(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) throw erroApi_('Fechamento inválido.');
  var forma = f.forma;
  if (!FORMAS_FECHAMENTO_.hasOwnProperty(forma)) throw erroApi_('Fechamento inválido: forma de pagamento.');
  var parcelas = null;
  if (forma === 'debito') parcelas = 1;
  if (forma === 'credito' || forma === 'entrada') parcelas = exigirNumeroOrc_(f.parcelas, 'parcelas', 1, 12);
  if ((forma === 'credito' || forma === 'entrada') && Math.floor(parcelas) !== parcelas) throw erroApi_('Fechamento inválido: parcelas.');
  var limpo = {
    forma: forma,
    parcelas: parcelas,
    cartao: forma === 'pix' ? '' : exigirTexto_(f.cartao, MAX_NOME_CARTAO_, 'Cartão'),
    taxaPct: forma === 'pix' ? 0 : exigirNumeroOrc_(f.taxaPct, 'taxa', 0, MAX_TAXA_),
    valorCombinadoC: exigirCentavos_(f.valorCombinadoC, 'valor combinado'),
    data: validarDataFechamento_(f.data),
    taxaC: exigirCentavos_(f.taxaC, 'taxa da maquininha'),
    impostoC: exigirCentavos_(f.impostoC, 'imposto'),
    pecasPagarC: exigirCentavos_(f.pecasPagarC, 'peças pagas'),
    terceirosPagarC: f.terceirosPagarC === undefined ? 0 : exigirCentavos_(f.terceirosPagarC, 'terceiros pagos'),
    pagaOficinaC: exigirCentavos_(f.pagaOficinaC, 'oficina'),
    vaiParaCasaC: exigirCentavos_(f.vaiParaCasaC, 'casa', { nulo: true }),
    sobraC: exigirCentavos_(f.sobraC, 'sobra extra', { negativo: true }),
    totalSeuC: exigirCentavos_(f.totalSeuC, 'total que é seu', { nulo: true, negativo: true }),
    estado: exigirOpcao_(f.estado, ESTADOS_, 'estado')
  };
  if (forma === 'pix' && f.taxaPct !== undefined && f.taxaPct !== 0) throw erroApi_('Fechamento inválido: Pix não tem taxa.');
  if (limpo.valorCombinadoC <= 0) throw erroApi_('Valor combinado: deve ser maior que zero.');
  if (forma === 'entrada') {
    limpo.entradaC = exigirCentavos_(f.entradaC, 'entrada');
    if (!(limpo.entradaC > 0)) throw erroApi_('Entrada: deve ser maior que zero.');
    if (!(limpo.entradaC < limpo.valorCombinadoC)) throw erroApi_('Entrada: deve ser menor que o valor combinado.');
    limpo.formaEntrada = exigirOpcao_(f.formaEntrada, ['pix', 'debito'], 'forma da entrada');
    limpo.taxaEntradaPct = limpo.formaEntrada === 'pix' ? 0 : exigirNumeroOrc_(f.taxaEntradaPct, 'taxa da entrada', 0, MAX_TAXA_);
    if (limpo.formaEntrada === 'pix' && f.taxaEntradaPct !== undefined && f.taxaEntradaPct !== 0) throw erroApi_('Fechamento inválido: entrada no Pix não tem taxa.');
  }
  // Seção 16.9 (opcionais): os descontos do orçamento no fechamento (serviço, peças e o equivalente)
  ['descontoServicoPct', 'descontoPecasPct', 'descontoEquivalentePct'].forEach(function (k) {
    if (f[k] !== undefined) limpo[k] = exigirNumeroOrc_(f[k], 'desconto', 0, MAX_DESCONTO_);
  });
  var casa = limpo.vaiParaCasaC === null ? 0 : limpo.vaiParaCasaC;
  if (limpo.valorCombinadoC - limpo.taxaC - limpo.impostoC - limpo.pecasPagarC - limpo.terceirosPagarC - limpo.pagaOficinaC - casa !== limpo.sobraC) {
    throw erroApi_('Fechamento com contas que não batem. Recarregue o app e tente de novo.');
  }
  if ((limpo.vaiParaCasaC === null) !== (limpo.totalSeuC === null) ||
      (limpo.totalSeuC !== null && limpo.totalSeuC !== limpo.vaiParaCasaC + limpo.sobraC)) {
    throw erroApi_('Fechamento com contas que não batem. Recarregue o app e tente de novo.');
  }
  return limpo;
}

/** Taxa e imposto do fechamento conferem com o valor combinado e o imposto da foto (±1 centavo). */
function conferirFechamento_(f, dados) {
  // Seção 16: imposto pela taxa efetiva gravada no orçamento (antigo: o imposto da foto); taxa da entrada + resto no cartão.
  var impostoPct = typeof dados.resultado.impostoEfetivoPct === 'number' ? dados.resultado.impostoEfetivoPct
    : (dados.foto && dados.foto.parametros ? dados.foto.parametros.impostoPercentual : 0);
  var perto = function (c, exato) { return Math.abs(c - exato) <= 1; };
  var taxaExata = f.forma === 'entrada'
    ? (f.valorCombinadoC - f.entradaC) * f.taxaPct / 100 + f.entradaC * f.taxaEntradaPct / 100
    : f.valorCombinadoC * f.taxaPct / 100;
  if (f.forma === 'entrada' && !(f.entradaC < dados.resultado.oferecidoC)) throw erroApi_('A entrada precisa ser menor que o preço à vista do orçamento.');
  if (!perto(f.taxaC, taxaExata) || !perto(f.impostoC, f.valorCombinadoC * impostoPct / 100) ||
      f.pecasPagarC !== dados.resultado.pecasPagarC || f.terceirosPagarC !== (dados.resultado.terceirosPagarC || 0)) {
    throw erroApi_('Fechamento com contas que não batem. Recarregue o app e tente de novo.');
  }
}

/** "aaaa-mm-dd" válida, de 2000-01-01 até amanhã (folga de fuso). */
function validarDataFechamento_(v) {
  var m = typeof v === 'string' ? RE_DATA_.exec(v) : null;
  if (!m) throw erroApi_('Data do fechamento inválida.');
  var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() + 1 !== Number(m[2]) || d.getUTCDate() !== Number(m[3])) {
    throw erroApi_('Data do fechamento inválida.');
  }
  if (v < DATA_MINIMA_) throw erroApi_('Data do fechamento inválida.');
  if (v > hojeTexto_(Date.now() + 24 * 3600 * 1000)) throw erroApi_('A data do fechamento não pode ser no futuro.');
  return v;
}

// ============================================================
// Datas e carimbos (fuso do script: America/Sao_Paulo)
// ============================================================

function fuso_() {
  return Session.getScriptTimeZone() || 'America/Sao_Paulo';
}

function dataHoraTexto_(ms) {
  return Utilities.formatDate(new Date(ms), fuso_(), 'yyyy-MM-dd HH:mm:ss');
}

function hojeTexto_(ms) {
  return Utilities.formatDate(new Date(ms), fuso_(), 'yyyy-MM-dd');
}

/** Carimbo de "Atualizado em" (com milissegundos), sempre diferente do anterior. */
function carimbo_(ms, anterior) {
  var t = Utilities.formatDate(new Date(ms), fuso_(), 'yyyy-MM-dd HH:mm:ss.SSS');
  while (t === anterior) {
    ms += 1;
    t = Utilities.formatDate(new Date(ms), fuso_(), 'yyyy-MM-dd HH:mm:ss.SSS');
  }
  return t;
}

/** "2026-11-07…" → "2026-11"; outro texto → ''. */
function mesDe_(texto) {
  var m = /^(\d{4}-\d{2})/.exec(String(texto || ''));
  return m && RE_MES_.test(m[1]) ? m[1] : '';
}

function mesAnterior_(mes) {
  var m = RE_MES_.exec(mes);
  var ano = Number(m[1]);
  var n = Number(m[2]) - 1;
  if (n === 0) { n = 12; ano -= 1; }
  return ano + '-' + (n < 10 ? '0' : '') + n;
}

/** Célula → texto (Date vira "aaaa-mm-dd hh:mm:ss", caso alguém mude o formato da coluna). */
function textoCelula_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : dataHoraTexto_(v.getTime());
  return String(v).trim();
}

/** Célula de data → "aaaa-mm-dd" ou ''. */
function textoData_(v) {
  var t = textoCelula_(v).slice(0, 10);
  return RE_DATA_.test(t) ? t : '';
}

/** Célula do mês → "aaaa-mm" ou ''. */
function textoMes_(v) {
  var t = textoCelula_(v).slice(0, 7);
  return RE_MES_.test(t) ? t : '';
}

function avisoNoLog_(msg) {
  console.warn(msg);
  Logger.log(msg);
}

// ============================================================
// Configuração e migração da planilha
// ============================================================

/**
 * Cria as abas que faltam (ou que estão totalmente vazias) com cabeçalho, formatos e dados padrão,
 * e migra a aba Taxas do formato antigo (uma única vez). Idempotente. Quem chama segura o lock.
 */
function configurarPlanilha_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  garantirAba_(ss, ABA_GASTOS_, CAB_GASTOS_, [], function (sh) {
    sh.getRange('C:C').setNumberFormat('#,##0.00');
    sh.setColumnWidth(1, 90);
    sh.setColumnWidth(2, 260);
    sh.setColumnWidth(3, 150);
  });

  // Seção 16: planilha NOVA já nasce com as linhas dos impostos novos (impostoPecasPercentual e impostoServicoPercentual,
  // padrão 0), visíveis. A derivação a partir do imposto antigo vale só para planilha que já existia (migração).
  // A linha impostoPercentual continua (LEGADO: a tela antiga ainda manda e lê essa chave; não é usada quando as novas existem).
  garantirAba_(ss, ABA_PARAMETROS_, CAB_PARAMETROS_, linhasParametros_(parametrosPadrao_()), function (sh) {
    sh.getRange('B:B').setNumberFormat('@');
    sh.setColumnWidth(1, 190);
    sh.setColumnWidth(2, 200);
  });

  migrarTaxasAntigas_(ss);
  garantirAba_(ss, ABA_TAXAS_, CAB_TAXAS_, linhasCartoes_(cartoesPadrao_()), formatarAbaTaxas_);

  garantirAba_(ss, ABA_ORCAMENTOS_, CAB_ORCAMENTOS_, [], function (sh) {
    sh.setColumnWidth(1, 90);
    sh.setColumnWidths(2, 2, 150);
    sh.setColumnWidth(6, 220);
    sh.setColumnWidth(22, 120);
  });

  garantirColunasOrcamentos_(ss);

  garantirAba_(ss, ABA_MESES_, CAB_MESES_, [], function (sh) {
    sh.setColumnWidths(1, CAB_MESES_.length, 150);
  });

  protegerComAviso_(ss);
}

/**
 * Seção 16: na aba Orçamentos que JÁ existe, acrescenta os cabeçalhos W–Y (uma vez). Nada muda de lugar.
 * Seção 17: acrescenta o cabeçalho Z "Itens" e, NESSA MESMA VEZ, preenche Z de todas as linhas a partir do JSON
 * (roda só na troca de esquema, dentro do lock; com o cabeçalho Z já lá, não faz nada).
 */
function garantirColunasOrcamentos_(ss) {
  var sh = ss.getSheetByName(ABA_ORCAMENTOS_);
  if (!sh || sh.getLastRow() < 1) return;
  var n = CAB_ORCAMENTOS_.length;
  if (typeof sh.getMaxColumns === 'function' && sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());
  var atual = sh.getRange(1, COL_ORC_.terceiros, 1, 4).getValues()[0];
  if (String(atual[0]).trim() !== CAB_ORCAMENTOS_[COL_ORC_.terceiros - 1]) {
    sh.getRange(1, COL_ORC_.terceiros, 1, 3).setValues([CAB_ORCAMENTOS_.slice(COL_ORC_.terceiros - 1, COL_ORC_.itens - 1)]).setFontWeight('bold').setBackground('#eeeeee');
  }
  if (String(atual[3]).trim() === CAB_ORCAMENTOS_[COL_ORC_.itens - 1]) return;
  sh.getRange(1, COL_ORC_.itens, 1, 1).setValues([[CAB_ORCAMENTOS_[COL_ORC_.itens - 1]]]).setFontWeight('bold').setBackground('#eeeeee');
  preencherItensAntigos_(sh);
}

/** Seção 17 (migração, uma vez): coluna Z de cada linha a partir do JSON (JSON inválido → vazio). Uma leitura e uma escrita. */
function preencherItensAntigos_(sh) {
  var linhas = lerCorpo_(sh, COL_ORC_.dados);
  if (!linhas.length) return;
  var itens = linhas.map(function (l, i) {
    var id = String(l[0]).trim();
    var dados = id ? lerJsonOrcamento_(l[COL_ORC_.dados - 1], i + 2, id) : null;
    return [dados ? itensDoOrcamento_(dados.entrada) : ''];
  });
  sh.getRange(2, COL_ORC_.itens, itens.length, 1).setNumberFormats(itens.map(function () { return [TEXTO_]; })).setValues(itens);
}

/**
 * Proteção "somente aviso" + nota em A1 nas abas Orçamentos e Meses: quem editar à mão vê o aviso
 * (o app continua gravando normalmente). Idempotente: uma marca nas Propriedades do documento evita
 * consultar a cada pedido, e a busca pela descrição evita duplicar mesmo sem a marca.
 * Se a pessoa remover a proteção de propósito, ela não volta sozinha (a marca já existe).
 */
function protegerComAviso_(ss) {
  var props = PropertiesService.getDocumentProperties();
  if (props.getProperty(PROP_PROTECAO_) === '1') return;
  [ABA_ORCAMENTOS_, ABA_MESES_].forEach(function (nome) {
    var sh = ss.getSheetByName(nome);
    if (!sh) return;
    var jaTem = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).some(function (p) {
      return p.getDescription() === AVISO_EDICAO_MANUAL_;
    });
    if (!jaTem) sh.protect().setDescription(AVISO_EDICAO_MANUAL_).setWarningOnly(true);
    sh.getRange(1, 1).setNote(AVISO_EDICAO_MANUAL_);
  });
  props.setProperty(PROP_PROTECAO_, '1');
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
    impostoPecasPercentual: 0,
    impostoServicoPercentual: 0,
    acrescimoPecasPadrao: 47,
    acrescimoTerceirosPadrao: 0,
    descontoAVistaPadrao: 5,
    descontoPecasPadrao: 5,
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
  return gastosDasLinhas_(lerCorpo_(ss.getSheetByName(ABA_GASTOS_), CAB_GASTOS_.length));
}

/** Linhas da aba Gastos (como estão na planilha) → gastos. Mesma regra da leitura (usada também para montar o cache). */
function gastosDasLinhas_(valores) {
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

/**
 * @param ausentes (opcional) lista que recebe as chaves que NÃO têm linha na aba (para a migração do desconto padrão)
 */
function lerParametros_(ss, ausentes) {
  return parametrosDasLinhas_(lerCorpo_(ss.getSheetByName(ABA_PARAMETROS_), CAB_PARAMETROS_.length), ausentes);
}

/** Linhas da aba Parâmetros → parâmetros (mesma regra da leitura; usada também para montar o cache). */
function parametrosDasLinhas_(valores, ausentes) {
  var padrao = parametrosPadrao_();
  var p = parametrosPadrao_();
  var vistos = {};
  valores.forEach(function (l) {
    var chave = String(l[0]).trim();
    if (!padrao.hasOwnProperty(chave)) return;
    vistos[chave] = true;
    if (LIMITES_PARAMETROS_.hasOwnProperty(chave)) {
      var n = lerNumeroBR_(l[1]);
      p[chave] = dentroDoLimite_(n, LIMITES_PARAMETROS_[chave]) ? n : padrao[chave];
    } else if (chave === 'parcelasDestaque') {
      p[chave] = normalizarParcelas_(String(l[1])).texto; // descarta itens inválidos
    } else {
      p[chave] = String(l[1]).trim().slice(0, MAX_NOME_OFICINA_).trim();
    }
  });
  // Imposto legado: sem as linhas novas, os dois impostos nascem do imposto antigo (os números de antes não mudam).
  Object.keys(DERIVADOS_).forEach(function (k) { if (!vistos[k]) p[k] = p[DERIVADOS_[k]]; });
  if (ausentes) Object.keys(padrao).forEach(function (k) { if (!vistos[k]) ausentes.push(k); });
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

  return cartoesDasLinhas_(lerCorpo_(sh, CAB_TAXAS_.length));
}

/** Linhas da aba Taxas (formato novo) → cartões (mesma regra da leitura; usada também para montar o cache). */
function cartoesDasLinhas_(linhas) {
  var brutos = linhas.map(function (l) {
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
// Validação (rígida, mesmos limites da leitura)
// ============================================================

/**
 * Valida e normaliza os dados recebidos do app.
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

/** Parâmetro de PARAMETROS_OPCIONAIS_ ausente (tela antiga) fica de fora do resultado (undefined). */
function validarParametros_(p) {
  if (!p || typeof p !== 'object') throw new Error('Ajustes inválidos.');
  var limpo = {};
  PARAMETROS_NUMERICOS_.forEach(function (chave) {
    var lim = LIMITES_PARAMETROS_[chave];
    if (PARAMETROS_OPCIONAIS_.indexOf(chave) >= 0 && (p[chave] === null || p[chave] === undefined)) return;
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

/** Parâmetros → linhas [Chave, Valor], com números em texto pt-BR ("150,5"). Chave sem valor (undefined) fica de fora. */
function linhasParametros_(p) {
  return ORDEM_PARAMETROS_.filter(function (chave) { return p[chave] !== undefined; }).map(function (chave) {
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
 * Converte texto em formato brasileiro para número. Mesmas regras do app (js/calculo.js):
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
