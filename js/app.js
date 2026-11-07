/* =====================================================================
   APP — telas, eventos e sincronização com a planilha (via js/api.js).
   ===================================================================== */
(function () {
'use strict';

var CHAVE_CACHE = 'precoCerto.dados.v1';
var CHAVE_ORCAMENTO = 'precoCerto.orcamento.v1';
var ESPERA_SALVAR_MS = 800;
var TEMPO_DESFAZER_MS = 6000;
var TIPOS = ['Oficina', 'Casa'];
var SUGESTOES = {
  Oficina: ['Aluguel', 'Luz', 'Água', 'Internet/Telefone', 'Contador/MEI', 'Ferramentas/Manutenção', 'Ajudante'],
  Casa: ['Aluguel/Financiamento', 'Mercado', 'Luz/Água', 'Escola', 'Carro/Combustível', 'Plano de saúde']
};

var estado = { dados: null, urlPlanilha: '', atualizadoEm: null, carregadoDoServidor: false };
var conexao = null;            // {api, token} deste aparelho (js/config.js); null = não ligado a uma planilha
var orc = orcamentoVazio();
var invalidos = {};            // campos salváveis com erro: chave → true
var sync = { sujo: false, salvando: false, erro: false, timer: null };
var desfazer = { tipo: null, item: null, indice: -1, timer: null }; // último gasto/cartão removido (barra "Desfazer")
var remocoesNaoSalvas = 0;     // remoções que ainda não entraram em nenhum salvamento
var usuarioEscolheuTela = false;
var ui = { cartao: 0, adicionandoCartao: false, outroAberto: false }; // tela "Seus cartões"
var SUGESTOES_CARTAO = ['Elo', 'Amex', 'Hipercard', 'Visa', 'Mastercard', 'Cabal', 'Banescard', 'Sorocred'];
var ultimoResultado = null;
var timerAviso = null;

// ------------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------------
function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function icone(id, classe) {
  return '<svg class="ic' + (classe ? ' ' + classe : '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
}

function lerStorage(chave) {
  try { var s = localStorage.getItem(chave); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function gravarStorage(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem cache: segue normal */ }
}
function apagarStorage(chave) {
  try { localStorage.removeItem(chave); } catch (e) { /* ignora */ }
}

function clonar(o) { return JSON.parse(JSON.stringify(o)); }

function mensagemDoErro(e) {
  var m = e && e.message ? String(e.message) : '';
  m = m.replace(/^Exception:\s*/, '').replace(/^Error:\s*/, '');
  return m || 'Verifique a internet e tente de novo.';
}

function mostrarAviso(msg) {
  var el = $('aviso');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(function () { el.hidden = true; }, 3500);
}

// ------------------------------------------------------------------
// Dados
// ------------------------------------------------------------------
function dadosComFormatoValido(d) {
  return !!(d && Array.isArray(d.gastos) && d.parametros && typeof d.parametros === 'object' && Array.isArray(d.cartoes));
}

function aplicarDados(dados, url, atualizadoEm) {
  estado.dados = clonar(dados);
  if (typeof estado.dados.parametros.acrescimoPecasPadrao !== 'number') {
    estado.dados.parametros.acrescimoPecasPadrao = 47; // cache de versão anterior
  }
  if (url) estado.urlPlanilha = url;
  estado.atualizadoEm = atualizadoEm || null;
  invalidos = {};
}

function salvarCache() {
  if (!estado.dados) return;
  gravarStorage(CHAVE_CACHE, { dados: estado.dados, urlPlanilha: estado.urlPlanilha, atualizadoEm: estado.atualizadoEm });
}

// ------------------------------------------------------------------
// Status e salvamento
// ------------------------------------------------------------------
function mostrarStatus(tipo) {
  var el = $('status');
  var textos = {
    carregando: 'Carregando…',
    salvando: 'Salvando…',
    salvo: 'Salvo ✓',
    erro: 'Erro ao salvar – tentar de novo',
    invalido: 'Corrija o campo em vermelho',
    erroCarregar: 'Sem conexão – tentar de novo',
    semAcesso: 'Sem acesso à planilha'
  };
  var animado = tipo === 'salvando' || tipo === 'carregando';
  el.innerHTML = (animado ? '<span class="ponto"></span>' : '') + esc(textos[tipo] || '');
  el.dataset.tipo = tipo;
  var clicavel = tipo === 'erro' || tipo === 'erroCarregar';
  el.disabled = !clicavel;
  el.className = 'status' +
    (clicavel ? ' status-erro' : '') +
    (tipo === 'invalido' || tipo === 'semAcesso' ? ' status-alerta' : '') +
    (tipo === 'salvo' ? ' status-ok' : '');
}

function temInvalidos() { return Object.keys(invalidos).length > 0; }

function temPendencia() {
  return sync.sujo || sync.salvando || sync.erro || sync.timer !== null || temInvalidos() ||
    remocoesNaoSalvas > 0 || desfazer.timer !== null;
}

function cancelarTimer() {
  if (sync.timer !== null) { clearTimeout(sync.timer); sync.timer = null; }
}

/** Chamar depois de QUALQUER mudança válida em gastos, parâmetros ou taxas. */
function alterou() {
  remocoesNaoSalvas = 0; // o próximo salvamento leva o estado inteiro, inclusive as remoções
  sync.sujo = true;
  salvarCache();
  atualizarStatusSalvamento();
}

/** Decide o que fazer com o salvamento conforme o estado atual. */
function atualizarStatusSalvamento() {
  if (temInvalidos()) {
    cancelarTimer();
    mostrarStatus('invalido');
    return;
  }
  if (sync.sujo && !sync.salvando) {
    agendarSalvar();
  } else if (!sync.sujo && !sync.salvando && !sync.erro && estado.carregadoDoServidor) {
    mostrarStatus('salvo');
  }
}

function agendarSalvar() {
  cancelarTimer();
  mostrarStatus('salvando');
  sync.timer = setTimeout(function () { sync.timer = null; salvarAgora(); }, ESPERA_SALVAR_MS);
}

function salvarAgora() {
  cancelarTimer();
  if (!sync.sujo) return;
  if (temInvalidos()) { mostrarStatus('invalido'); return; }
  if (!conexao || !estado.carregadoDoServidor) return;
  if (sync.salvando) return; // ao terminar, confere se ficou algo pendente

  sync.salvando = true;
  sync.sujo = false;
  sync.erro = false;
  mostrarStatus('salvando');

  PrecoCertoApi.chamar(conexao, 'salvarDados', montarEnvio()).then(function (r) {
    sync.salvando = false;
    estado.atualizadoEm = r.atualizadoEm;
    salvarCache();
    atualizarInfoSalvo();
    if (sync.sujo) atualizarStatusSalvamento();
    else mostrarStatus('salvo');
  }, function (e) {
    sync.salvando = false;
    sync.sujo = true;
    sync.erro = true;
    if (e && e.tipo === 'acesso') { perdeuAcesso(); return; }
    mostrarStatus('erro');
    mostrarAviso('Não salvou: ' + mensagemDoErro(e));
  });
}

function montarEnvio() {
  var d = clonar(estado.dados);
  d.gastos.forEach(function (g) { g.descricao = String(g.descricao || '').trim(); });
  d.parametros.nomeOficina = String(d.parametros.nomeOficina || '').trim();
  d.cartoes.forEach(function (c) { c.nome = String(c.nome || '').trim(); });
  return d;
}

/** Aplica a resposta de obterDados (vinda do servidor) e libera a edição. */
function receberDadosDoServidor(r) {
  aplicarDados({ gastos: r.gastos, parametros: r.parametros, cartoes: r.cartoes }, r.urlPlanilha, r.atualizadoEm);
  estado.carregadoDoServidor = true;
  sync.sujo = false;
  sync.erro = false;
  $('faixa-offline').hidden = true;
  $('faixa-acesso').hidden = true;
  $('fs-gastos').disabled = false;
  $('fs-ajustes').disabled = false;
  salvarCache();
  mostrarApp();
  renderTudo();
  if (!usuarioEscolheuTela) escolherTelaInicial();
  mostrarStatus('salvo');
}

function carregarServidor() {
  if (!conexao) return;
  if (!estado.dados) mostrarStatus('carregando');
  PrecoCertoApi.chamar(conexao, 'obterDados').then(function (r) {
    if (estado.carregadoDoServidor && temPendencia()) return; // mudou algo nesse meio tempo: mantém o que está na tela
    receberDadosDoServidor(r);
  }, function (e) {
    if (e && e.tipo === 'acesso') { perdeuAcesso(); return; }
    mostrarStatus('erroCarregar');
    if (!estado.dados) mostrarFalhaCarregamento(e && e.tipo === 'rede'
      ? 'Não foi possível carregar seus dados. Confira a internet.'
      : mensagemDoErro(e));
    else if (!estado.carregadoDoServidor) $('faixa-offline').hidden = false; // cache: só orçamento (edição bloqueada)
  });
}

/** Token trocado (ou link revogado): avisa e bloqueia a edição; o orçamento com o cache continua. */
function perdeuAcesso() {
  mostrarStatus('semAcesso');
  $('faixa-acesso').hidden = false;
  $('faixa-offline').hidden = true;
  $('fs-gastos').disabled = true;
  $('fs-ajustes').disabled = true;
  if (!estado.dados) mostrarTelaConectar('Este aparelho perdeu o acesso à planilha. Abra o novo link de configuração.');
}

function mostrarFalhaCarregamento(msg) {
  $('carregando').hidden = false;
  $('carregando-texto').textContent = msg;
  $('btn-tentar-carregar').hidden = !conexao;
}

/** Ao sair do app: confirma remoção pendente e salva na hora o que estiver esperando. */
function salvarAoSair() {
  if (desfazer.timer !== null || remocoesNaoSalvas > 0) finalizarRemocao();
  if (sync.timer !== null) salvarAgora();
}

function aoMudarVisibilidade() {
  if (document.visibilityState === 'hidden') {
    salvarAoSair();
    return;
  }
  if (estado.carregadoDoServidor && !temPendencia()) carregarServidor();
}

function atualizarInfoSalvo() {
  var el = $('info-salvo');
  if (!estado.atualizadoEm) { el.textContent = ''; return; }
  var d = new Date(estado.atualizadoEm);
  if (isNaN(d.getTime())) { el.textContent = ''; return; }
  el.textContent = 'Última alteração salva: ' + d.toLocaleDateString('pt-BR') + ' às ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.';
}

// ------------------------------------------------------------------
// Erros de campo
// ------------------------------------------------------------------
function caixaErro(el) {
  var box = el.closest('.campo, .gasto-linha, .taxa-linha');
  return box ? box.querySelector('.erro') : null;
}

function mostrarErroCampo(el, msg) {
  var p = caixaErro(el);
  if (p) p.textContent = msg || '';
  el.classList.toggle('invalido', !!msg);
  if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
}

/** Para campos que vão para a planilha: também controla o bloqueio do salvamento. */
function marcarCampo(el, chave, msg) {
  mostrarErroCampo(el, msg);
  if (msg) invalidos[chave] = true; else delete invalidos[chave];
}

function limparInvalidos(prefixo) {
  Object.keys(invalidos).forEach(function (k) { if (k.indexOf(prefixo) === 0) delete invalidos[k]; });
}

// ------------------------------------------------------------------
// Telas
// ------------------------------------------------------------------
function mostrarApp() { $('carregando').hidden = true; }

function trocarTela(nome, peloUsuario) {
  if (peloUsuario) usuarioEscolheuTela = true;
  ['orcamento', 'gastos', 'ajustes'].forEach(function (t) {
    $('tela-' + t).hidden = t !== nome;
    $('aba-' + t).setAttribute('aria-selected', t === nome ? 'true' : 'false');
  });
  if (peloUsuario) window.scrollTo(0, 0);
}

function escolherTelaInicial() {
  trocarTela(totalGastos(estado.dados.gastos) === 0 ? 'gastos' : 'orcamento', false);
}

function renderTudo() {
  preencherParametros();
  renderGastos();
  renderAjustes();
  preencherOrcamento();
  renderOrcamento();
}

// ---------------- Orçamento ----------------
function orcamentoVazio() {
  return {
    descricao: '', modo: 'horas',
    horasTexto: '', valorTexto: '', horasFechadoTexto: '',
    pecasPagarTexto: '', pecasModo: 'acrescimo', acrescimoTexto: null, pecasCobrarTexto: '',
    bandeira: NAO_SEI
  };
}

function carregarOrcamentoSalvo() {
  var o = lerStorage(CHAVE_ORCAMENTO);
  if (!o || typeof o !== 'object') return;
  var base = orcamentoVazio();
  Object.keys(base).forEach(function (k) { if (typeof o[k] === 'string') base[k] = o[k]; });
  if (base.modo !== 'horas' && base.modo !== 'fechado') base.modo = 'horas';
  if (base.pecasModo !== 'acrescimo' && base.pecasModo !== 'valor') base.pecasModo = 'acrescimo';
  orc = base;
}

/** Texto do acréscimo deste orçamento: o digitado, ou o padrão de Ajustes enquanto ele não mexeu. */
function textoAcrescimo() {
  if (orc.acrescimoTexto !== null) return orc.acrescimoTexto;
  return estado.dados ? numeroParaCampo(estado.dados.parametros.acrescimoPecasPadrao, false) : '';
}

function preencherOrcamento() {
  document.querySelectorAll('[data-orc]').forEach(function (el) {
    el.value = el.dataset.orc === 'acrescimoTexto' ? textoAcrescimo() : (orc[el.dataset.orc] || '');
  });
}

function lerCampoOrcamento(id, texto, lim, msg) {
  var r = validarNumeroCampo(texto, lim, { vazioPermitido: true, mensagem: msg });
  mostrarErroCampo($(id), r.erro);
  return r.valor;
}

function montarEntrada() {
  var msgHoras = 'Digite as horas. Ex.: 2,5';
  var msgValor = 'Digite um valor igual ou maior que zero.';
  var fechado = orc.modo === 'fechado';
  var porAcrescimo = orc.pecasModo === 'acrescimo';
  return {
    modo: orc.modo,
    horas: fechado
      ? lerCampoOrcamento('orc-horas-fechado', orc.horasFechadoTexto, LIMITE_HORAS_SERVICO, msgHoras)
      : lerCampoOrcamento('orc-horas', orc.horasTexto, LIMITE_HORAS_SERVICO, msgHoras),
    valorFechado: fechado ? lerCampoOrcamento('orc-valor', orc.valorTexto, LIMITE_VALOR_ORCAMENTO, msgValor) : null,
    pecasPagar: lerCampoOrcamento('orc-pecas-pagar', orc.pecasPagarTexto, LIMITE_VALOR_ORCAMENTO, msgValor),
    pecasModo: orc.pecasModo,
    pecasAcrescimo: porAcrescimo ? lerCampoOrcamento('orc-acrescimo', textoAcrescimo(), LIMITE_ACRESCIMO, MENSAGENS_PARAMETROS.acrescimoPecasPadrao) : null,
    pecasCobrar: porAcrescimo ? null : lerCampoOrcamento('orc-pecas-cobrar', orc.pecasCobrarTexto, LIMITE_VALOR_ORCAMENTO, msgValor)
  };
}

/** Chips "Não sei · cartão · cartão…" — só aparecem com 2 ou mais cartões. */
function renderChipsBandeira(cartoes, efetivo) {
  $('bloco-bandeiras').hidden = cartoes.length <= 1;
  if (cartoes.length <= 1) { $('chips-bandeira').innerHTML = ''; return; }
  var html = '<button type="button" class="chip" role="radio" data-bandeira-indice="-1" aria-checked="' + (efetivo === NAO_SEI) + '">Não sei</button>';
  cartoes.forEach(function (c, i) {
    var sel = efetivo !== NAO_SEI && chaveNome(c.nome) === chaveNome(efetivo);
    html += '<button type="button" class="chip" role="radio" data-bandeira-indice="' + i + '" aria-checked="' + sel + '">' + esc(c.nome) + '</button>';
  });
  $('chips-bandeira').innerHTML = html;
}

function renderOrcamento() {
  if (!estado.dados) return;
  var d = estado.dados;

  // Cartão escolhido que não existe mais (removido ou renomeado fora daqui) volta para "Não sei".
  if (orc.bandeira !== NAO_SEI && acharCartao(d.cartoes, orc.bandeira) < 0) orc.bandeira = NAO_SEI;

  $('bloco-horas').hidden = orc.modo !== 'horas';
  $('bloco-fechado').hidden = orc.modo !== 'fechado';
  $('bloco-acrescimo').hidden = orc.pecasModo !== 'acrescimo';
  $('bloco-pecas-valor').hidden = orc.pecasModo !== 'valor';

  // Enquanto ele não mexeu no acréscimo deste orçamento, o campo acompanha o padrão de Ajustes.
  var campoAcrescimo = $('orc-acrescimo');
  if (orc.acrescimoTexto === null && document.activeElement !== campoAcrescimo) campoAcrescimo.value = textoAcrescimo();

  $('faixa-sem-gastos-orc').hidden = totalGastos(d.gastos) !== 0;

  var entrada = montarEntrada();
  var res = calcularOrcamento(entrada, d.parametros, d.cartoes, orc.bandeira, precoMinimoHora(d.gastos, d.parametros));
  ultimoResultado = res;

  // Linhas de apoio
  var infoMao = '';
  if (orc.modo === 'horas' && res.horas > 0) {
    infoMao = d.parametros.valorHoraCobrado > 0
      ? 'Mão de obra: <strong>' + esc(formatarBRL(res.maoDeObra)) + '</strong>'
      : 'Coloque quanto você cobra por hora em Meus gastos.';
  }
  $('info-mao-horas').innerHTML = infoMao;
  $('info-horas-estimadas').textContent = res.horasEstimadas
    ? 'Horas estimadas pelo valor da sua hora: ' + formatarHoras(res.horas)
    : '';
  $('info-pecas-cliente').innerHTML = res.pecasPagar > 0
    ? 'Cliente paga pelas peças: <strong>' + esc(formatarBRL(res.pecasCobrar)) + '</strong>'
    : '';

  var temValor = res.aVista.totalCentavos > 0;
  $('orc-vazio').hidden = temValor;
  $('orc-resultado').hidden = !temValor;
  if (!temValor) return;

  $('res-avista').textContent = formatarCentavos(res.aVista.totalCentavos);
  renderChipsBandeira(d.cartoes, res.cartao);
  $('card-cartao').hidden = res.semCartoes;
  $('dica-sem-cartoes').hidden = !res.semCartoes;

  // Parcelas em destaque
  $('cards-destaque').innerHTML = res.destaques.map(function (op) {
    var valor = op.parcelas === 1
      ? formatarCentavos(op.totalCentavos)
      : op.parcelas + '× de ' + formatarCentavos(op.parcelaCentavos);
    return '<div class="parcela">' +
      '<div class="titulo-valor">' + icone('i-cartao', 'ic-sm') + 'Cartão em ' + op.parcelas + 'x</div>' +
      '<div class="parcela-valor">' + esc(valor) + '</div>' +
      (op.parcelas === 1 ? '' : '<div class="parcela-total">Total ' + esc(formatarCentavos(op.totalCentavos)) + '</div>') +
      '</div>';
  }).join('');

  // Outras formas (sem repetir as em destaque)
  $('outras-formas').hidden = res.outras.length === 0 && res.destaques.length > 0;
  $('lista-outras').innerHTML = res.outras.length
    ? res.outras.map(function (op) {
        var esquerda = op.forma === 'Débito' ? 'Débito' : op.parcelas + 'x de ' + formatarCentavos(op.parcelaCentavos);
        return '<li><span class="forma">' + esc(esquerda) + '</span><span class="total-li">total ' + esc(formatarCentavos(op.totalCentavos)) + '</span></li>';
      }).join('')
    : '<li>Nenhuma taxa cadastrada para este cartão. Veja em Ajustes.</li>';

  // Lucro (opção à vista)
  var lucro = centavos(res.aVista.lucro);
  var negativo = lucro < 0;
  $('res-lucro').textContent = formatarCentavos(lucro);
  $('res-lucro').className = 'valor-grande ' + (negativo ? 'negativo' : 'positivo');
  $('card-lucro').className = 'card' + (negativo ? ' card-negativo' : '');
  $('res-lucro-alerta').hidden = !negativo;

  var impostoPct = d.parametros.impostoPercentual;
  var maiorDestaque = res.destaques.length ? res.destaques[res.destaques.length - 1] : null;
  var elCartao = $('res-lucro-cartao');
  if (impostoPct > 0 && maiorDestaque) {
    elCartao.textContent = 'No cartão em ' + maiorDestaque.parcelas + 'x: ' + formatarBRL(maiorDestaque.lucro);
    elCartao.hidden = false;
  } else {
    elCartao.hidden = true;
  }

  var linhas = [
    ['Mão de obra', formatarBRL(res.maoDeObra)],
    ['Gasto das suas ' + formatarHoras(res.horas), '− ' + formatarBRL(res.gastoHoras)],
    ['Lucro nas peças', formatarBRL(res.lucroPecas)]
  ];
  if (impostoPct > 0) linhas.push(['Imposto (à vista)', '− ' + formatarBRL(res.aVista.imposto)]);
  $('res-detalhes').innerHTML = linhas.map(function (l) {
    return '<dt>' + esc(l[0]) + '</dt><dd>' + esc(l[1]) + '</dd>';
  }).join('');
}

function onOrcamentoInput(el) {
  orc[el.dataset.orc] = el.value;
  gravarStorage(CHAVE_ORCAMENTO, orc);
  renderOrcamento();
}

function trocarModo(modo) {
  orc.modo = modo;
  gravarStorage(CHAVE_ORCAMENTO, orc);
  renderOrcamento();
  $(modo === 'horas' ? 'orc-horas' : 'orc-valor').focus();
}

function trocarModoPecas(modo) {
  orc.pecasModo = modo;
  gravarStorage(CHAVE_ORCAMENTO, orc);
  renderOrcamento();
  $(modo === 'acrescimo' ? 'orc-acrescimo' : 'orc-pecas-cobrar').focus();
}

function novoOrcamento() {
  orc = orcamentoVazio();
  apagarStorage(CHAVE_ORCAMENTO);
  preencherOrcamento();
  $('outras-formas').open = false;
  renderOrcamento();
  window.scrollTo(0, 0);
  $('orc-descricao').focus();
  mostrarAviso('Pronto para um novo orçamento.');
}

// ---------------- Copiar e compartilhar ----------------
function textoAtual() {
  if (!ultimoResultado || !estado.dados) return '';
  return textoWhatsApp(ultimoResultado, estado.dados.parametros, orc.descricao);
}

/**
 * 2 níveis: área de transferência → caixa com o texto selecionado (para copiar à mão).
 * Fora do iframe do Apps Script, o navigator.clipboard funciona em HTTPS. Resolve 'ok' ou 'manual'.
 */
function copiarTexto(texto) {
  function manual() {
    mostrarCaixaCopia(texto);
    return 'manual';
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(texto).then(function () { return 'ok'; }, manual);
  }
  return Promise.resolve(manual());
}

function mostrarCaixaCopia(texto) {
  var ta = $('texto-copia');
  ta.value = texto;
  $('caixa-copia').hidden = false;
  ta.focus();
  ta.select();
  try { ta.setSelectionRange(0, texto.length); } catch (e) { /* ignora */ }
}

/** "Compartilhar" aparece sempre que o navegador tiver o recurso (celular, em geral). */
function testarCompartilhar() {
  $('btn-compartilhar').hidden = typeof navigator.share !== 'function';
}

function compartilhar() {
  var texto = textoAtual();
  if (!texto) return;
  function falhou(e) {
    if (e && e.name === 'AbortError') return; // a pessoa só fechou a janela
    mostrarAviso('Não deu para compartilhar. Use "Copiar para WhatsApp".');
  }
  try { navigator.share({ text: texto }).catch(falhou); } catch (e) { falhou(e); }
}

// ---------------- Meus gastos ----------------
function renderGastos() {
  if (!estado.dados) return;
  var gastos = estado.dados.gastos;
  var cheio = gastos.length >= MAX_GASTOS;
  TIPOS.forEach(function (tipo) {
    var html = '';
    var quantos = 0;
    gastos.forEach(function (g, i) {
      if (g.tipo !== tipo) return;
      quantos++;
      var nome = esc(g.descricao || 'gasto');
      html += '<div class="gasto-linha">' +
        '<div class="entrada"><input type="text" data-gasto-campo="descricao" data-indice="' + i + '" maxlength="100"' +
        ' placeholder="O que é?" aria-label="Descrição do gasto" autocomplete="off" value="' + esc(g.descricao) + '"></div>' +
        '<div class="entrada com-prefixo"><span class="prefixo">R$</span>' +
        '<input type="text" class="num" inputmode="decimal" data-gasto-campo="valor" data-formato="dinheiro" data-indice="' + i + '"' +
        ' placeholder="0,00" aria-label="Valor por mês de ' + nome + '" autocomplete="off" value="' + esc(numeroParaCampo(g.valor, true)) + '"></div>' +
        '<button type="button" class="btn-remover" data-remover="' + i + '" aria-label="Remover ' + nome + '">' + icone('i-lixeira') + '</button>' +
        '<p class="erro"></p>' +
        '</div>';
    });
    $('lista-' + tipo).innerHTML = html;
    $('sugestoes-' + tipo).innerHTML = quantos === 0 && !cheio
      ? SUGESTOES[tipo].map(function (s) {
          return '<button type="button" class="chip chip-sugestao" data-sugestao="' + esc(s) + '" data-tipo="' + tipo + '">' + esc(s) + '</button>';
        }).join('')
      : '';
  });
  document.querySelectorAll('[data-adicionar]').forEach(function (b) { b.hidden = cheio; });
  limparInvalidos('g:');
  atualizarResultadosGastos();
}

function atualizarResultadosGastos() {
  if (!estado.dados) return;
  var d = estado.dados;
  TIPOS.forEach(function (tipo) { $('total-' + tipo).textContent = formatarBRL(totalGastos(d.gastos, tipo)); });
  var total = totalGastos(d.gastos);
  var pmh = precoMinimoHora(d.gastos, d.parametros);
  $('faixa-primeiro').hidden = total !== 0;
  $('res-gasto-mes').textContent = formatarBRL(total);
  $('res-preco-minimo').textContent = formatarBRL(pmh);

  var el = $('res-ganho-hora');
  if (total === 0) {
    el.innerHTML = '';
  } else {
    var diferenca = d.parametros.valorHoraCobrado - pmh;
    if (centavos(diferenca) >= 0) {
      el.innerHTML = 'Você ganha <strong class="positivo">' + esc(formatarBRL(diferenca)) + '</strong> a mais por hora';
    } else {
      el.innerHTML = 'Você cobra <strong class="negativo">' + esc(formatarBRL(-diferenca)) + '</strong> a menos do que precisa por hora';
    }
  }
}

function adicionarGasto(tipo, descricao) {
  var gastos = estado.dados.gastos;
  if (gastos.length >= MAX_GASTOS) return;
  gastos.push({ tipo: tipo, descricao: descricao || '', valor: null });
  var indice = gastos.length - 1;
  renderGastos();
  alterou();
  var campo = document.querySelector('[data-indice="' + indice + '"][data-gasto-campo="' + (descricao ? 'valor' : 'descricao') + '"]');
  if (campo) campo.focus();
}

/**
 * Remoção com "Desfazer" (gasto ou cartão): some na hora e mostra a barra por 6 s.
 * O salvamento só dispara quando a barra some (ou junto com a próxima alteração).
 */
function listaDoTipo(tipo) { return tipo === 'cartao' ? estado.dados.cartoes : estado.dados.gastos; }

function redesenharDoTipo(tipo) {
  if (tipo === 'cartao') renderAjustes(); else renderGastos();
  renderOrcamento();
}

function removerComDesfazer(tipo, indice) {
  if (desfazer.timer !== null) { clearTimeout(desfazer.timer); desfazer.timer = null; } // a anterior vira definitiva
  desfazer.tipo = tipo;
  desfazer.item = listaDoTipo(tipo).splice(indice, 1)[0];
  desfazer.indice = indice;
  remocoesNaoSalvas++;
  if (tipo === 'cartao') ui.cartao = Math.min(indice, estado.dados.cartoes.length - 1);
  redesenharDoTipo(tipo);
  $('aviso').hidden = true;
  $('texto-desfazer').textContent = tipo === 'cartao' ? 'Cartão removido' : 'Gasto removido';
  $('barra-desfazer').hidden = false;
  desfazer.timer = setTimeout(finalizarRemocao, TEMPO_DESFAZER_MS);
}

function finalizarRemocao() {
  if (desfazer.timer !== null) { clearTimeout(desfazer.timer); desfazer.timer = null; }
  desfazer.item = null;
  $('barra-desfazer').hidden = true;
  if (remocoesNaoSalvas > 0) alterou();
}

function desfazerRemocao() {
  if (!desfazer.item) return;
  if (desfazer.timer !== null) { clearTimeout(desfazer.timer); desfazer.timer = null; }
  var tipo = desfazer.tipo;
  var lista = listaDoTipo(tipo);
  var posicao = Math.min(desfazer.indice, lista.length);
  lista.splice(posicao, 0, desfazer.item);
  desfazer.item = null;
  if (tipo === 'cartao') { ui.cartao = posicao; ui.adicionandoCartao = false; }
  $('barra-desfazer').hidden = true;
  redesenharDoTipo(tipo);
  if (remocoesNaoSalvas > 0) {
    remocoesNaoSalvas--;                  // esta remoção nunca foi salva: voltar não precisa salvar
    if (remocoesNaoSalvas > 0) alterou(); // ainda há remoção anterior pendente
    else atualizarStatusSalvamento();
  } else {
    alterou();                            // a remoção já tinha ido num salvamento: salvar a volta
  }
  mostrarAviso(tipo === 'cartao' ? 'Cartão de volta.' : 'Gasto de volta.');
}

function onGastoInput(el) {
  var i = Number(el.dataset.indice);
  var g = estado.dados.gastos[i];
  if (!g) return;
  if (el.dataset.gastoCampo === 'descricao') {
    g.descricao = el.value;
    alterou();
    return;
  }
  var r = validarNumeroCampo(el.value, LIMITE_VALOR_GASTO, { vazioPermitido: true, mensagem: 'Digite um valor igual ou maior que zero.' });
  marcarCampo(el, 'g:' + i, r.erro);
  if (r.erro) { atualizarStatusSalvamento(); return; }
  g.valor = r.valor;
  atualizarResultadosGastos();
  renderOrcamento();
  alterou();
}

// ---------------- Parâmetros (Meus gastos + Ajustes) ----------------
function preencherParametros() {
  if (!estado.dados) return;
  var p = estado.dados.parametros;
  document.querySelectorAll('[data-param]').forEach(function (el) {
    var chave = el.dataset.param;
    if (chave === 'nomeOficina' || chave === 'parcelasDestaque') el.value = p[chave] || '';
    else el.value = numeroParaCampo(p[chave], el.dataset.formato === 'dinheiro');
    mostrarErroCampo(el, '');
  });
  limparInvalidos('p:');
}

function revalidarHorasCobradas() {
  var el = $('p-horasCobradasPorDia');
  var p = estado.dados.parametros;
  var r = validarHorasCobradas(el.value, p.horasPorDia);
  marcarCampo(el, 'p:horasCobradasPorDia', r.erro);
  if (!r.erro && r.valor !== p.horasCobradasPorDia) {
    p.horasCobradasPorDia = r.valor;
    return true; // mudou
  }
  return false;
}

function onParametroInput(el) {
  var chave = el.dataset.param;
  var p = estado.dados.parametros;

  if (chave === 'nomeOficina') {
    p.nomeOficina = el.value;
    alterou();
    return;
  }

  // Regra: valor válido entra no estado e chama alterou() (que segura o envio se houver
  // qualquer campo inválido); valor inválido só marca o campo e atualiza o status.
  var mudou = false;

  if (chave === 'parcelasDestaque') {
    var np = normalizarParcelas(el.value);
    marcarCampo(el, 'p:parcelasDestaque', np.invalidas ? 'Use números de 1 a 12 separados por vírgula. Ex.: 5,10' : '');
    if (!np.invalidas) { p.parcelasDestaque = np.texto; mudou = true; }
  } else if (chave === 'horasCobradasPorDia') {
    mudou = revalidarHorasCobradas();
  } else {
    var r = validarNumeroCampo(el.value, LIMITES_PARAMETROS[chave], { vazioPermitido: false, mensagem: MENSAGENS_PARAMETROS[chave] });
    marcarCampo(el, 'p:' + chave, r.erro);
    if (!r.erro) { p[chave] = r.valor; mudou = true; }
    if (chave === 'horasPorDia' && revalidarHorasCobradas()) mudou = true;
  }

  atualizarResultadosGastos();
  renderOrcamento();
  if (mudou) alterou(); else atualizarStatusSalvamento();
}

// ---------------- Ajustes ----------------
// ---------------- Ajustes: Seus cartões ----------------
function cartaoAtual() {
  var cartoes = estado.dados.cartoes;
  return ui.cartao >= 0 && ui.cartao < cartoes.length ? cartoes[ui.cartao] : null;
}

function renderChipsCartoes() {
  var cartoes = estado.dados.cartoes;
  var html = cartoes.map(function (c, i) {
    var sel = !ui.adicionandoCartao && i === ui.cartao;
    return '<button type="button" class="chip" role="radio" data-editar-cartao="' + i + '" aria-checked="' + sel + '">' + esc(c.nome || '(sem nome)') + '</button>';
  }).join('');
  if (cartoes.length < MAX_CARTOES) {
    html += '<button type="button" class="chip chip-adicionar" data-acao="adicionar-cartao" aria-pressed="' + ui.adicionandoCartao + '">' +
      icone('i-mais') + 'Adicionar cartão</button>';
  }
  $('chips-cartoes').innerHTML = html;
}

function renderAjustes() {
  if (!estado.dados) return;
  var cartoes = estado.dados.cartoes;
  if (cartoes.length === 0) ui.cartao = -1;
  else if (ui.cartao < 0 || ui.cartao >= cartoes.length) ui.cartao = 0;
  if (cartoes.length >= MAX_CARTOES) ui.adicionandoCartao = false;

  renderChipsCartoes();
  $('sem-cartoes').hidden = cartoes.length > 0 || ui.adicionandoCartao;

  // Painel "Adicionar cartão"
  $('painel-adicionar').hidden = !ui.adicionandoCartao;
  if (ui.adicionandoCartao) {
    var sugestoes = SUGESTOES_CARTAO.filter(function (s) { return acharCartao(cartoes, s) < 0; });
    $('sugestoes-cartao').innerHTML = sugestoes.map(function (s) {
      return '<button type="button" class="chip chip-sugestao" data-sugestao-cartao="' + esc(s) + '">' + esc(s) + '</button>';
    }).join('') + '<button type="button" class="chip chip-sugestao" data-sugestao-cartao="" aria-pressed="' + ui.outroAberto + '">Outro…</button>';
    $('bloco-outro').hidden = !ui.outroAberto;
  }

  // Painel do cartão em edição
  var cartao = cartaoAtual();
  $('painel-cartao').hidden = ui.adicionandoCartao || !cartao;
  limparInvalidos('t:');
  limparInvalidos('c:');
  if (cartao && !ui.adicionandoCartao) {
    var campoNome = $('cartao-nome');
    campoNome.value = cartao.nome;
    mostrarErroCampo(campoNome, '');
    $('lista-taxas').innerHTML = FORMAS.map(function (f) {
      return '<div class="taxa-linha">' +
        '<label for="taxa-' + f.campo + '">' + f.rotulo + '</label>' +
        '<div class="entrada com-sufixo"><input id="taxa-' + f.campo + '" class="num" type="text" inputmode="decimal" data-taxa-campo="' + f.campo + '"' +
        ' placeholder="sem taxa" autocomplete="off" value="' + esc(numeroParaCampo(cartao[f.campo], false)) + '"><span class="sufixo">%</span></div>' +
        '<p class="erro"></p>' +
        '</div>';
    }).join('');
    $('aviso-cartao-vazio').hidden = !cartaoTodoVazio(cartao);
    $('confirma-padrao').hidden = true;
    $('btn-preencher-padrao').hidden = false;
  }

  var link = $('link-planilha');
  if (estado.urlPlanilha) { link.href = estado.urlPlanilha; link.hidden = false; } else { link.hidden = true; }
  atualizarInfoSalvo();
}

function editarCartao(indice) {
  ui.cartao = indice;
  ui.adicionandoCartao = false;
  ui.outroAberto = false;
  renderAjustes();
  atualizarStatusSalvamento(); // campos com erro do cartão anterior foram descartados
}

function abrirAdicionarCartao() {
  ui.adicionandoCartao = !ui.adicionandoCartao;
  ui.outroAberto = false;
  renderAjustes();
  atualizarStatusSalvamento();
}

/** Cria o cartão (nome já validado) com as taxas vazias e abre para edição, com foco no Débito. */
function criarCartao(nome) {
  var cartoes = estado.dados.cartoes;
  var erro = validarNomeCartao(nome, cartoes, -1);
  if (erro || cartoes.length >= MAX_CARTOES) return erro || 'Você pode cadastrar no máximo ' + MAX_CARTOES + ' cartões.';
  cartoes.push(cartaoVazio(String(nome).trim()));
  ui.cartao = cartoes.length - 1;
  ui.adicionandoCartao = false;
  ui.outroAberto = false;
  renderAjustes();
  renderOrcamento();
  alterou();
  $('taxa-debito').focus();
  return '';
}

function criarCartaoOutro() {
  var campo = $('novo-cartao-nome');
  var erro = criarCartao(campo.value);
  mostrarErroCampo(campo, erro);
  if (!erro) campo.value = '';
}

function onNomeCartaoInput(el) {
  var cartao = cartaoAtual();
  if (!cartao) return;
  var erro = validarNomeCartao(el.value, estado.dados.cartoes, ui.cartao);
  marcarCampo(el, 'c:nome', erro);
  if (erro) { atualizarStatusSalvamento(); return; }
  var nomeAntigo = cartao.nome;
  cartao.nome = el.value.trim();
  if (orc.bandeira !== NAO_SEI && chaveNome(orc.bandeira) === chaveNome(nomeAntigo)) {
    orc.bandeira = cartao.nome; // o orçamento continua com o mesmo cartão escolhido
    gravarStorage(CHAVE_ORCAMENTO, orc);
  }
  renderChipsCartoes();
  renderOrcamento();
  alterou();
}

function onTaxaInput(el) {
  var cartao = cartaoAtual();
  if (!cartao) return;
  var campo = el.dataset.taxaCampo;
  var r = validarNumeroCampo(el.value, LIMITE_TAXA, { vazioPermitido: true, mensagem: 'Use um número de 0 a 99.' });
  marcarCampo(el, 't:' + campo, r.erro);
  if (r.erro) { atualizarStatusSalvamento(); return; }
  cartao[campo] = r.valor; // vazio → null (sem taxa); "0" → 0
  $('aviso-cartao-vazio').hidden = !cartaoTodoVazio(cartao);
  renderOrcamento();
  alterou();
}

function preencherTaxasPadrao() {
  if (!conexao) return;
  var botao = $('btn-padrao-sim');
  botao.disabled = true;
  PrecoCertoApi.chamar(conexao, 'obterTaxasPadraoVisa').then(function (r) {
    botao.disabled = false;
    var cartao = cartaoAtual();
    if (!cartao) return;
    var padrao = r.taxas || {};
    CAMPOS_TAXA.forEach(function (campo) { cartao[campo] = typeof padrao[campo] === 'number' ? padrao[campo] : null; });
    renderAjustes();
    renderOrcamento();
    alterou();
    mostrarAviso('Taxas da InfinitePay preenchidas.');
  }, function (e) {
    botao.disabled = false;
    if (e && e.tipo === 'acesso') { perdeuAcesso(); return; }
    mostrarAviso('Não deu para preencher as taxas: ' + mensagemDoErro(e));
  });
}

// ------------------------------------------------------------------
// Este aparelho: ligar à planilha (link #cfg= ou manual), desconectar
// ------------------------------------------------------------------
function mostrarTelaConectar(mensagemErro) {
  document.body.classList.add('sem-conexao');
  ['orcamento', 'gastos', 'ajustes'].forEach(function (t) { $('tela-' + t).hidden = true; });
  $('carregando').hidden = true;
  $('faixa-offline').hidden = true;
  $('faixa-acesso').hidden = true;
  $('tela-conectar').hidden = false;
  $('conectar-erro').textContent = mensagemErro || '';
}

function esconderTelaConectar() {
  document.body.classList.remove('sem-conexao');
  $('tela-conectar').hidden = true;
}

/**
 * Testa a conexão (obterDados) e, só se der certo, guarda no aparelho e abre o app.
 * Trocar de planilha apaga o cache de dados da planilha anterior.
 * @return Promise<string> '' se conectou; senão a mensagem de erro
 */
function conectar(nova) {
  return PrecoCertoApi.chamar(nova, 'obterDados').then(function (r) {
    var anterior = PrecoCertoConfig.ler();
    if (anterior && anterior.api !== nova.api) apagarStorage(CHAVE_CACHE);
    if (!PrecoCertoConfig.salvar(nova)) return 'Este navegador não deixou guardar a configuração (modo anônimo?).';
    conexao = nova;
    esconderTelaConectar();
    receberDadosDoServidor(r);
    renderAparelho();
    mostrarAviso('Aparelho conectado à planilha ✓');
    return '';
  }, function (e) {
    return e && e.tipo === 'acesso'
      ? 'Este link não dá mais acesso à planilha. Peça um link novo.'
      : mensagemDoErro(e);
  });
}

/** Abriu com "#cfg=…": valida, testa, guarda e limpa o endereço. @return true se havia link */
function processarLinkDeConfiguracao() {
  var lido = PrecoCertoConfig.lerLinkDeConfiguracao(window.location.hash);
  if (!lido) return false;
  // Tira o token do endereço na hora (histórico, favoritos, prints).
  try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) { /* ignora */ }
  if (!lido.ok) { mostrarTelaConectar(lido.erro); return true; }
  mostrarTelaConectar('');
  $('conectar-texto').textContent = 'Conectando este aparelho à planilha…';
  conectar(lido.config).then(function (erro) {
    $('conectar-texto').textContent = 'Este aparelho ainda não está ligado a uma planilha. Abra o link de configuração que você recebeu.';
    if (erro) mostrarTelaConectar(erro);
  });
  return true;
}

function conectarManual() {
  var api = $('manual-api').value.trim();
  var token = $('manual-token').value.trim();
  var erro = PrecoCertoConfig.validarManual(api, token);
  $('manual-erro').textContent = erro;
  if (erro) return;
  var botao = $('btn-conectar');
  botao.disabled = true;
  conectar({ api: api, token: token }).then(function (msg) {
    botao.disabled = false;
    $('manual-erro').textContent = msg;
    if (!msg) { $('manual-api').value = ''; $('manual-token').value = ''; }
  });
}

/** Esquece a planilha neste aparelho: configuração e cache de dados (o rascunho do orçamento fica). */
function desconectar() {
  PrecoCertoConfig.apagar();
  apagarStorage(CHAVE_CACHE);
  conexao = null;
  estado.dados = null;
  estado.carregadoDoServidor = false;
  estado.urlPlanilha = '';
  cancelarTimer();
  sync.sujo = false; sync.erro = false;
  invalidos = {};
  $('confirma-desconectar').hidden = true;
  $('btn-desconectar').hidden = false;
  $('fs-gastos').disabled = true;
  $('fs-ajustes').disabled = true;
  mostrarTelaConectar('');
  mostrarAviso('Aparelho desconectado.');
}

function renderAparelho() {
  $('aparelho-planilha').textContent = conexao ? PrecoCertoConfig.finalDaUrl(conexao.api) : '—';
  var pwa = PrecoCertoPwa.estado;
  $('aparelho-versao').textContent = pwa.versao || '—';
  $('btn-instalar').hidden = !pwa.podeInstalar;
}

// ------------------------------------------------------------------
// Autoteste (?teste=1)
// ------------------------------------------------------------------
function verificarModoTeste() {
  if (/[?&]teste=1(&|$)/.test(window.location.search)) executarAutoteste();
}

function executarAutoteste() {
  var resultados = rodarCasosDeTeste();
  var passaram = resultados.filter(function (r) { return r.passou; }).length;
  var html = '<div class="card"><h2 class="card-titulo">Autoteste de cálculo</h2>' +
    '<p><strong>' + passaram + ' de ' + resultados.length + ' passaram.</strong></p>' +
    '<table><thead><tr><th>Caso</th><th>Resultado</th><th>Obtido</th><th>Esperado</th></tr></thead><tbody>' +
    resultados.map(function (r) {
      return '<tr><td><strong>' + esc(r.id) + '</strong> ' + esc(r.descricao) + '</td>' +
        '<td class="' + (r.passou ? 'ok">PASSOU' : 'falha">FALHOU') + '</td>' +
        '<td>' + esc(JSON.stringify(r.obtido)) + '</td><td>' + esc(JSON.stringify(r.esperado)) + '</td></tr>';
    }).join('') +
    '</tbody></table></div>';
  var el = $('tela-teste');
  el.innerHTML = html;
  el.hidden = false;
}

// ------------------------------------------------------------------
// Eventos
// ------------------------------------------------------------------
function ligarEventos() {
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!estado.dados) return;
    if (el.dataset.param) onParametroInput(el);
    else if (el.dataset.gastoCampo) onGastoInput(el);
    else if (el.dataset.taxaCampo) onTaxaInput(el);
    else if (el.dataset.cartaoNome) onNomeCartaoInput(el);
    else if (el.dataset.orc) onOrcamentoInput(el);
  });

  // Ao sair do campo: deixa o número bonito (só se estiver válido).
  document.addEventListener('focusout', function (e) {
    var el = e.target;
    if (!el.matches || !el.matches('input') || el.classList.contains('invalido')) return;
    if (el.dataset.formato === 'dinheiro' && el.value.trim() !== '') {
      var n = lerNumeroBR(el.value);
      if (n !== null) el.value = numeroParaCampo(n, true);
    } else if (el.dataset.param === 'parcelasDestaque') {
      el.value = normalizarParcelas(el.value).texto;
    }
  });

  document.addEventListener('click', function (e) {
    var alvo = e.target.closest('button, a');
    if (!alvo) return;
    var ds = alvo.dataset;
    if (ds.tela) { trocarTela(ds.tela, true); return; }
    if (ds.ir) { trocarTela(ds.ir, true); return; }
    if (ds.adicionar) { adicionarGasto(ds.adicionar, ''); return; }
    if (ds.sugestao) { adicionarGasto(ds.tipo, ds.sugestao); return; }
    if (ds.remover !== undefined) { removerComDesfazer('gasto', Number(ds.remover)); return; }
    if (ds.editarCartao !== undefined) { editarCartao(Number(ds.editarCartao)); return; }
    if (ds.acao === 'adicionar-cartao') { abrirAdicionarCartao(); return; }
    if (ds.sugestaoCartao !== undefined) {
      if (ds.sugestaoCartao === '') { // "Outro…"
        ui.outroAberto = true;
        renderAjustes();
        $('novo-cartao-nome').focus();
      } else {
        criarCartao(ds.sugestaoCartao);
      }
      return;
    }
    if (ds.bandeiraIndice !== undefined) {
      var i = Number(ds.bandeiraIndice);
      orc.bandeira = i < 0 ? NAO_SEI : estado.dados.cartoes[i].nome;
      gravarStorage(CHAVE_ORCAMENTO, orc);
      renderOrcamento();
      var chip = document.querySelector('[data-bandeira-indice="' + i + '"]');
      if (chip) chip.focus();
    }
  });

  $('ir-fechado').addEventListener('click', function () { trocarModo('fechado'); });
  $('ir-horas').addEventListener('click', function () { trocarModo('horas'); });
  $('ir-pecas-valor').addEventListener('click', function () { trocarModoPecas('valor'); });
  $('ir-pecas-acrescimo').addEventListener('click', function () { trocarModoPecas('acrescimo'); });
  $('btn-novo').addEventListener('click', novoOrcamento);

  $('btn-copiar').addEventListener('click', function () {
    var texto = textoAtual();
    if (!texto) return;
    copiarTexto(texto).then(function (r) {
      if (r === 'ok') mostrarAviso('Copiado! Agora é só colar no WhatsApp.');
    });
  });
  $('btn-compartilhar').addEventListener('click', compartilhar);
  $('btn-fechar-copia').addEventListener('click', function () { $('caixa-copia').hidden = true; });

  // Seus cartões
  $('btn-cancelar-adicionar').addEventListener('click', function () {
    ui.adicionandoCartao = false;
    ui.outroAberto = false;
    renderAjustes();
  });
  $('btn-criar-cartao').addEventListener('click', criarCartaoOutro);
  $('novo-cartao-nome').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); criarCartaoOutro(); }
  });
  $('novo-cartao-nome').addEventListener('input', function (e) { mostrarErroCampo(e.target, ''); });
  $('btn-preencher-padrao').addEventListener('click', function () {
    $('confirma-padrao').hidden = false;
    $('btn-preencher-padrao').hidden = true;
    $('btn-padrao-sim').focus();
  });
  $('btn-padrao-nao').addEventListener('click', function () {
    $('confirma-padrao').hidden = true;
    $('btn-preencher-padrao').hidden = false;
  });
  $('btn-padrao-sim').addEventListener('click', preencherTaxasPadrao);
  $('btn-remover-cartao').addEventListener('click', function () {
    if (cartaoAtual()) removerComDesfazer('cartao', ui.cartao);
  });

  $('status').addEventListener('click', function () {
    var tipo = $('status').dataset.tipo;
    if (tipo === 'erro') salvarAgora();
    else if (tipo === 'erroCarregar') carregarServidor();
  });
  $('btn-tentar-carregar').addEventListener('click', function () {
    $('carregando-texto').textContent = 'Carregando seus dados…';
    $('btn-tentar-carregar').hidden = true;
    carregarServidor();
  });

  // Este aparelho
  $('btn-config-manual').addEventListener('click', function () {
    $('config-manual').hidden = !$('config-manual').hidden;
    if (!$('config-manual').hidden) $('manual-api').focus();
  });
  $('btn-conectar').addEventListener('click', conectarManual);
  $('btn-desconectar').addEventListener('click', function () {
    $('confirma-desconectar').hidden = false;
    $('btn-desconectar').hidden = true;
    $('btn-desconectar-sim').focus();
  });
  $('btn-desconectar-nao').addEventListener('click', function () {
    $('confirma-desconectar').hidden = true;
    $('btn-desconectar').hidden = false;
  });
  $('btn-desconectar-sim').addEventListener('click', desconectar);
  $('btn-instalar').addEventListener('click', function () { PrecoCertoPwa.instalar(); });
  $('btn-instalar-aviso').addEventListener('click', function () { $('barra-instalar').hidden = true; PrecoCertoPwa.instalar(); });
  $('btn-atualizar').addEventListener('click', function () { PrecoCertoPwa.atualizar(); });
  window.addEventListener('online', function () { if (conexao && !estado.carregadoDoServidor) carregarServidor(); });

  document.addEventListener('visibilitychange', aoMudarVisibilidade);
  window.addEventListener('pagehide', salvarAoSair);
  $('btn-desfazer').addEventListener('click', desfazerRemocao);
}

// ------------------------------------------------------------------
// Início
// ------------------------------------------------------------------
function iniciar() {
  $('logo-carregando').src = $('logo').src;
  ligarEventos();
  carregarOrcamentoSalvo();
  preencherOrcamento();
  testarCompartilhar();
  verificarModoTeste();

  PrecoCertoPwa.iniciar({
    aoMudar: renderAparelho,
    aoNovaVersao: function () { $('barra-versao').hidden = false; },
    aoSugerirInstalar: function () {
      $('barra-instalar').hidden = false;
      setTimeout(function () { $('barra-instalar').hidden = true; }, 12000);
    }
  });

  // 1) Abriu pelo link de configuração (#cfg=…)?
  if (processarLinkDeConfiguracao()) return;

  // 2) Aparelho ainda não ligado a uma planilha?
  conexao = PrecoCertoConfig.ler();
  if (!conexao) { mostrarTelaConectar(''); renderAparelho(); return; }

  // 3) Normal: abre rápido com o cache e depois busca a planilha (fonte da verdade).
  var cache = lerStorage(CHAVE_CACHE);
  if (cache && dadosComFormatoValido(cache.dados)) {
    aplicarDados(cache.dados, cache.urlPlanilha, cache.atualizadoEm);
    mostrarApp();
    renderTudo();
    escolherTelaInicial();
  }
  renderAparelho();
  carregarServidor();
}

iniciar();
})();
