/* =====================================================================
   APP — telas, eventos e sincronização com a planilha (via js/api.js).
   ===================================================================== */
(function () {
'use strict';

var CHAVE_CACHE = 'precoCerto.dados.v1';
var CHAVE_ORCAMENTO = 'precoCerto.orcamento.v1';
var CHAVE_DESCONTO_PADRAO = 'precoCerto.descontoPadrao.v1'; // versão antiga (por aparelho): migrado para a aba Parâmetros e apagado
var CHAVE_FOTO_PENDENTE = 'precoCerto.fotoMesPendente.v1'; // (até a seção 14) pendência da foto do mês: só é apagada
var CHAVE_RESULTADOS = 'precoCerto.resultados.v1';        // última lista de cada mês (Resultados na hora), por planilha
var CHAVE_PIN = 'precoCerto.pin.v1';                        // só deste aparelho; "Desconectar" e novo link apagam
var ESPERA_SALVAR_MS = 800;
var BLOQUEIO_PIN_MS = 5 * 60 * 1000;  // PIN ligado: mais de 5 min em segundo plano → pede de novo
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
var nav = { tela: 'orcamento', aba: 'gastos', abaPin: 'gastos', voltarFechar: 'orcamento' }; // tela: 'orcamento' | 'resultados' | 'fechar' | 'pin' | 'config'
var ui = { cartao: 0, adicionandoCartao: false, outroAberto: false, maisDesconto: false, entradaAberta: false }; // entradaAberta: bloco "O cliente vai dar uma entrada?" aberto // tela "Seus cartões"; maisDesconto: "O cliente pediu mais desconto?" aberto
var SUGESTOES_CARTAO = ['Elo', 'Amex', 'Hipercard', 'Visa', 'Mastercard', 'Cabal', 'Banescard', 'Sorocred'];
var ultimoResultado = null;
var ultimasPecas = [];        // peças lidas no último render [{descricao, qtd, valor}] (vão para o WhatsApp, sem valores)
var ultimoPreco = null;       // calcularPrecoComDesconto do último render (vai para o WhatsApp)
var timerAviso = null;
var ultimoCalc = null;         // calcularComFoto do último render (vai para a planilha ao salvar)
var salvandoOrc = null;        // Promise do salvamento do orçamento em andamento
var desbloqueio = { ok: false, escondidoEm: null }; // PIN: um desbloqueio vale para Resultados e Configurações
var resul = { mes: null, dados: null, filtro: 'todos', busca: '', aberto: null, ocultos: {}, pedido: 0 }; // aba Resultados
var corrigir = { mes: null, dados: null, pedido: 0 }; // Ajustes → "Corrigir gastos de um mês passado"
var fech = null;               // tela de fechamento
var menuSit = { alvo: null, deFechar: false };  // menu "Mudar situação" (deFechar: aberto pela tela de fechamento)
var dialogo = { resolver: null, botoes: [] };
var situacaoPendente = false;  // fechamento enviado, esperando a confirmação do servidor (tela otimista)

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

function lerTexto(chave) {
  try { return localStorage.getItem(chave); } catch (e) { return null; }
}
function gravarTexto(chave, valor) {
  try { localStorage.setItem(chave, valor); return true; } catch (e) { return false; }
}

/** PIN deste aparelho (4 números) ou null se desligado. */
function lerPin() {
  var p = lerTexto(CHAVE_PIN);
  return p && /^\d{4}$/.test(p) ? p : null;
}

function clonar(o) { return JSON.parse(JSON.stringify(o)); }

function mensagemDoErro(e) {
  var m = e && e.message ? String(e.message) : '';
  m = m.replace(/^Exception:\s*/, '').replace(/^Error:\s*/, '');
  return m || 'Verifique a internet e tente de novo.';
}

/** tipo 'alerta': fundo vermelho e mais tempo na tela (ex.: "Sem conexão: orçamento NÃO foi salvo."). */
/** tipo: 'alerta' (vermelho, 7 s) · 'fixo' (fica até o próximo aviso: "Salvando…", "Fechando…") · padrão (3,5 s). */
function mostrarAviso(msg, tipo) {
  var el = $('aviso');
  el.textContent = msg;
  el.classList.toggle('toast-alerta', tipo === 'alerta');
  el.hidden = false;
  clearTimeout(timerAviso);
  if (tipo !== 'fixo') timerAviso = setTimeout(function () { el.hidden = true; }, tipo === 'alerta' ? 7000 : 3500);
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
  if (typeof estado.dados.parametros.descontoAVistaPadrao !== 'number') {
    estado.dados.parametros.descontoAVistaPadrao = descontoPadraoDoAparelho(lerTexto(CHAVE_DESCONTO_PADRAO)); // antes da fase 10
  }
  // Seção 16 (cache de versão anterior): os dois impostos nascem do antigo; acréscimo dos terceiros 0
  var imp = impostosDosParametros(estado.dados.parametros);
  estado.dados.parametros.impostoPecasPercentual = imp.pecas;
  estado.dados.parametros.impostoServicoPercentual = imp.servico;
  if (typeof estado.dados.parametros.acrescimoTerceirosPadrao !== 'number') estado.dados.parametros.acrescimoTerceirosPadrao = 0;
  estado.dados.parametros.descontoPecasPadrao = descontoPecasPadraoDosParametros(estado.dados.parametros); // 16.9
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

  var envio = montarEnvio();
  PrecoCertoApi.chamar(conexao, 'salvarDados', envio).then(function (r) {
    sync.salvando = false;
    estado.atualizadoEm = r.atualizadoEm;
    if (estado.migrandoDesconto) { apagarStorage(CHAVE_DESCONTO_PADRAO); estado.migrandoDesconto = false; }
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
  d.parametros.impostoPercentual = d.parametros.impostoServicoPercentual; // seção 16: a chave antiga (aparelhos não atualizados) = o imposto do serviço
  d.cartoes.forEach(function (c) { c.nome = String(c.nome || '').trim(); });
  return d;
}

/** Aplica a resposta de obterDados (vinda do servidor) e libera a edição. */
function receberDadosDoServidor(r) {
  aplicarDados({ gastos: r.gastos, parametros: r.parametros, cartoes: r.cartoes }, r.urlPlanilha, r.atualizadoEm);
  var migrar = migrarDescontoPadrao(r);
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
  if (migrar) alterou(); // grava o desconto do aparelho na aba Parâmetros
}

/**
 * Desconto à vista padrão: antes ficava no aparelho; agora fica na aba Parâmetros.
 * Planilha sem a linha → grava o valor deste aparelho (ou 5) e, depois do "Salvo ✓", apaga a chave local.
 * Planilha já com a linha → ela vence; a chave local é apagada (com aviso se era diferente).
 * @return true se precisa salvar
 */
function migrarDescontoPadrao(r) {
  var local = lerTexto(CHAVE_DESCONTO_PADRAO);
  var ausente = Array.isArray(r.parametrosAusentes) && r.parametrosAusentes.indexOf('descontoAVistaPadrao') >= 0;
  if (ausente) {
    estado.dados.parametros.descontoAVistaPadrao = descontoPadraoDoAparelho(local);
    estado.migrandoDesconto = true;
    return true;
  }
  if (local !== null && typeof r.parametros.descontoAVistaPadrao === 'number') {
    if (descontoPadraoDoAparelho(local) !== r.parametros.descontoAVistaPadrao) {
      mostrarAviso('O desconto padrão agora vem da planilha: ' + formatarPercentual(r.parametros.descontoAVistaPadrao) + '.');
    }
    apagarStorage(CHAVE_DESCONTO_PADRAO);
  }
  return false;
}

function carregarServidor() {
  if (!conexao) return;
  if (!estado.dados) mostrarStatus('carregando');
  var usada = conexao;
  PrecoCertoApi.chamar(conexao, 'obterDados').then(function (r) {
    if (conexao !== usada) return; // desconectou (ou trocou de planilha) enquanto esperava: resposta velha
    if (estado.carregadoDoServidor && temPendencia()) return; // mudou algo nesse meio tempo: mantém o que está na tela
    receberDadosDoServidor(r);
  }, function (e) {
    if (conexao !== usada) return;
    if (e && e.tipo === 'acesso') { perdeuAcesso(); return; }
    mostrarStatus('erroCarregar');
    if (!estado.dados) mostrarFalhaCarregamento(e && e.tipo === 'rede'
      ? 'Não foi possível carregar seus dados. Confira a internet.'
      : mensagemDoErro(e));
    else if (!estado.carregadoDoServidor) $('faixa-offline').hidden = false; // cache: só orçamento (edição bloqueada)
  });
}

/**
 * Ajustes → "Recarregar da planilha" (seção 14): lê as abas de novo, sem o cache do servidor (obterDados com forcar).
 * Para mudanças feitas à mão na planilha que ainda não apareceram (o cache do servidor dura até 6 h).
 */
function recarregarDaPlanilha() {
  if (!conexao) return;
  if (temPendencia()) { mostrarAviso('Espere suas mudanças serem salvas antes de recarregar.', 'alerta'); return; }
  mostrarAviso('Recarregando…', 'fixo');
  var usada = conexao;
  PrecoCertoApi.chamar(conexao, 'obterDados', undefined, { forcar: true }).then(function (r) {
    if (conexao !== usada) return;
    if (temPendencia()) { mostrarAviso('Você mudou algo enquanto recarregava: nada foi trocado.', 'alerta'); return; }
    usuarioEscolheuTela = true; // continua em Ajustes
    receberDadosDoServidor(r);
    mostrarAviso('Dados recarregados da planilha ✓');
  }, function (e) {
    if (e && e.tipo === 'acesso') { perdeuAcesso(); return; }
    mostrarAviso(e && e.tipo === 'rede' ? 'Sem conexão: não recarregou.' : 'Não recarregou: ' + mensagemDoErro(e), 'alerta');
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
    desbloqueio.escondidoEm = Date.now();
    salvarAoSair();
    return;
  }
  // PIN ligado: mais de 5 min em segundo plano → bloqueia de novo (e sai de Resultados/Configurações).
  if (desbloqueio.escondidoEm !== null && Date.now() - desbloqueio.escondidoEm > BLOQUEIO_PIN_MS) {
    desbloqueio.ok = false;
    if (lerPin() && (nav.tela === 'config' || nav.tela === 'resultados')) voltarAoOrcamento(false);
  }
  desbloqueio.escondidoEm = null;
  if (estado.carregadoDoServidor && !temPendencia()) carregarServidor();
  if (nav.tela === 'resultados') carregarMes();
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

/*
 * Navegação: a tela principal é só o Orçamento. A engrenagem abre "Configurações" (abas Meus gastos | Ajustes).
 * Abrir Configurações (ou a tela do PIN) empilha uma entrada no histórico: o botão "voltar" do celular
 * (popstate), o Esc e o "← Voltar ao orçamento" levam de volta ao orçamento.
 */
function mostrarTela(nome) {
  if (document.body.classList.contains('sem-conexao')) return; // tela "conectar" manda: nada aparece por trás
  nav.tela = nome;
  $('tela-orcamento').hidden = nome !== 'orcamento';
  $('tela-resultados').hidden = nome !== 'resultados';
  $('tela-fechar').hidden = nome !== 'fechar';
  var topo = nome === 'fechar' ? nav.voltarFechar : nome;
  $('aba-orcamento').setAttribute('aria-selected', String(topo === 'orcamento'));
  $('aba-resultados').setAttribute('aria-selected', String(topo === 'resultados'));
  $('tela-pin').hidden = nome !== 'pin';
  $('tela-config').hidden = nome !== 'config';
  ['gastos', 'ajustes'].forEach(function (t) {
    $('tela-' + t).hidden = !(nome === 'config' && nav.aba === t);
    $('aba-' + t).setAttribute('aria-selected', nav.aba === t ? 'true' : 'false');
  });
  document.body.classList.toggle('em-config', nome === 'pin' || nome === 'config' || nome === 'fechar');
}

function trocarAbaConfig(aba) {
  nav.aba = aba === 'ajustes' ? 'ajustes' : 'gastos';
  mostrarTela('config');
  window.scrollTo(0, 0);
}

function empilharHistorico(tela) {
  try {
    if (history.state && history.state.precoCerto) history.replaceState({ precoCerto: tela }, '');
    else history.pushState({ precoCerto: tela }, '');
  } catch (e) { /* sem histórico: os botões da tela continuam funcionando */ }
}

/** Engrenagem (ou link "Meus gastos"/"Ajustes"): pede o PIN se estiver ligado; senão abre direto. */
function abrirConfig(aba, peloUsuario) {
  if (peloUsuario) usuarioEscolheuTela = true;
  aba = aba === 'ajustes' ? 'ajustes' : 'gastos';
  if (nav.tela === 'config') { trocarAbaConfig(aba); return; }
  if (lerPin() && !desbloqueio.ok) { abrirPin(aba); return; }
  empilharHistorico('config');
  trocarAbaConfig(aba);
}

function abrirPin(aba) {
  nav.abaPin = aba;
  $('pin-titulo').textContent = aba === 'resultados' ? 'Resultados protegidos' : 'Configurações protegidas';
  empilharHistorico('pin');
  $('pin-entrada').value = '';
  $('pin-erro').textContent = '';
  $('pin-entrada').classList.remove('invalido');
  $('pin-esqueci').hidden = true;
  $('pin-confirma-desconectar').hidden = true;
  $('btn-pin-desconectar').hidden = false;
  mostrarTela('pin');
  window.scrollTo(0, 0);
  $('pin-entrada').focus();
}

function conferirPin() {
  var digitado = $('pin-entrada').value.trim();
  if (digitado !== lerPin()) {
    $('pin-erro').textContent = 'PIN errado. Tente de novo.';
    $('pin-entrada').classList.add('invalido');
    $('pin-entrada').value = '';
    $('pin-entrada').focus();
    return;
  }
  desbloqueio.ok = true; // vale para Resultados e Configurações enquanto o app estiver aberto
  if (nav.abaPin === 'resultados') { empilharHistorico('resultados'); mostrarResultados(); return; }
  empilharHistorico('config');
  trocarAbaConfig(nav.abaPin);
}

/** "← Voltar ao orçamento", Esc ou "Cancelar" do PIN. */
function voltarAoOrcamento(peloUsuario) {
  if (peloUsuario) usuarioEscolheuTela = true;
  if (nav.tela === 'orcamento') return;
  var temEntrada = false;
  try { temEntrada = !!(history.state && history.state.precoCerto); } catch (e) { /* ignora */ }
  if (temEntrada) { history.back(); return; } // o popstate mostra o orçamento
  mostrarTela('orcamento');
  window.scrollTo(0, 0);
}

function aoVoltarHistorico() {
  if (document.body.classList.contains('sem-conexao')) return;
  usuarioEscolheuTela = true;
  if (nav.tela === 'fechar' && nav.voltarFechar === 'resultados') { // "voltar" no fechamento aberto da lista: volta para a lista
    fech = null;
    empilharHistorico('resultados');
    mostrarTela('resultados');
    renderResultados();
    return;
  }
  fech = null;
  mostrarTela('orcamento'); // nunca reabre Configurações pelo "avançar" (o PIN seria pulado)
  try { if (history.state && history.state.precoCerto) history.replaceState(null, ''); } catch (e) { /* ignora */ }
  window.scrollTo(0, 0);
}

/** Aba "Orçamento" do topo (e depois de abrir/duplicar um orçamento salvo). */
function irParaOrcamento() {
  usuarioEscolheuTela = true;
  fech = null;
  if (nav.tela !== 'orcamento') voltarAoOrcamento(true);
  window.scrollTo(0, 0);
}

/** 1º acesso (sem gastos e sem PIN): abre direto em Configurações → Meus gastos. Senão, o orçamento. */
function escolherTelaInicial() {
  if (totalGastos(estado.dados.gastos) === 0 && !lerPin()) abrirConfig('gastos', false);
  else if (nav.tela !== 'orcamento') voltarAoOrcamento(false);
  else mostrarTela('orcamento');
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
    // Seção 17: veículo em campos + serviços da oficina [{id, descricao, horasTexto, valorTexto}] (novo já começa com 1 linha)
    veiculo: veiculoVazio(),
    servicos: [servicoVazio()],
    pecasPagarTexto: '', pecasModo: 'acrescimo', acrescimoTexto: null, pecasCobrarTexto: '',
    descontoTexto: null, extraTexto: '',   // descontoTexto null = segue o padrão dos Ajustes (da foto em uso)
    // Seção 16.9: descontoSeparado null = automático (dois campos se os padrões forem diferentes); true/false = escolha;
    // AUSENTE (undefined) = orçamento/rascunho de antes: regra antiga (um desconto só, o extra sobre tudo).
    descontoSeparado: null, descontoPecasTexto: null,
    pecas: [],                             // [{descricao, qtdTexto, valorTexto, acrescimoTexto}] (modo acréscimo; acrescimoTexto null = segue o geral)
    terceiros: [],                         // seção 16: [{descricao, valorTexto, acrescimoTexto}] (acrescimoTexto null = o padrão dos Ajustes)
    entradaTexto: '', formaEntrada: 'pix', parcelasEntrada: null, // seção 16: entrada + resto no cartão (parcelas null = a de referência)
    bandeira: NAO_SEI,
    cliente: '', telefone: '',
    // Orçamento salvo: {id, criadoEm, atualizadoEm, situacao, motivo, fechamento, foto, recalcular, assinatura}
    vinculo: null
  };
}

function pecaVazia() { return { descricao: '', qtdTexto: '1', valorTexto: '', acrescimoTexto: null }; }
function terceiroVazio() { return { descricao: '', valorTexto: '', acrescimoTexto: null }; }
function textoOuNulo(v) { return typeof v === 'string' ? v : null; }

function vinculoValido(v) {
  return !!(v && typeof v === 'object' && typeof v.id === 'string' && typeof v.atualizadoEm === 'string' &&
    typeof v.situacao === 'string' && v.foto && typeof v.foto === 'object' && v.foto.parametros && Array.isArray(v.foto.cartoes));
}

function carregarOrcamentoSalvo() {
  var o = lerStorage(CHAVE_ORCAMENTO);
  if (!o || typeof o !== 'object') return;
  var base = orcamentoVazio();
  Object.keys(base).forEach(function (k) { if (typeof o[k] === 'string') base[k] = o[k]; });
  // Seção 17: rascunho de antes (campo único + horas ou valor fechado) vira UMA linha de serviço, com os mesmos números
  base.servicos = Array.isArray(o.servicos) ? servicosLimpos(o.servicos) : servicosDoLegado(o);
  base.veiculo = veiculoLimpo(o.veiculo);
  if (base.pecasModo !== 'acrescimo' && base.pecasModo !== 'valor') base.pecasModo = 'acrescimo';
  if (Array.isArray(o.pecas)) {
    base.pecas = o.pecas.filter(function (p) { return p && typeof p === 'object'; }).slice(0, MAX_PECAS).map(function (p) {
      return {
        descricao: typeof p.descricao === 'string' ? p.descricao : '',
        qtdTexto: typeof p.qtdTexto === 'string' ? p.qtdTexto : '1',
        valorTexto: typeof p.valorTexto === 'string' ? p.valorTexto : '',
        acrescimoTexto: textoOuNulo(p.acrescimoTexto)
      };
    });
  } else if (base.pecasModo === 'acrescimo' && String(base.pecasPagarTexto).trim() !== '') {
    // Rascunho da versão anterior (um campo só): vira uma peça 1 × valor, sem perder o que estava digitado.
    base.pecas = [{ descricao: '', qtdTexto: '1', valorTexto: base.pecasPagarTexto }];
  }
  if (Array.isArray(o.terceiros)) {
    base.terceiros = o.terceiros.filter(function (s) { return s && typeof s === 'object'; }).slice(0, MAX_TERCEIROS).map(function (s) {
      return { descricao: typeof s.descricao === 'string' ? s.descricao : '', valorTexto: typeof s.valorTexto === 'string' ? s.valorTexto : '', acrescimoTexto: textoOuNulo(s.acrescimoTexto) };
    });
  }
  if (base.formaEntrada !== 'debito') base.formaEntrada = 'pix';
  // 16.9: rascunho de antes (sem a chave) continua na regra antiga
  base.descontoSeparado = !Object.prototype.hasOwnProperty.call(o, 'descontoSeparado') ? undefined : o.descontoSeparado === true ? true : o.descontoSeparado === false ? false : null;
  base.descontoPecasTexto = textoOuNulo(o.descontoPecasTexto);
  base.parcelasEntrada = typeof o.parcelasEntrada === 'number' ? o.parcelasEntrada : null;
  if (vinculoValido(o.vinculo)) base.vinculo = o.vinculo;
  orc = base;
}

function gravarRascunho() { gravarStorage(CHAVE_ORCAMENTO, orc); }

/** Orçamento salvo sem "Recalcular": a conta usa a foto gravada (os valores daquele dia). */
function usandoFotoGravada() { return !!(orc.vinculo && !orc.vinculo.recalcular); }

/** Foto que entra na conta: a gravada, ou a de hoje (gastos, ajustes e cartões atuais). */
function fotoEmUso() {
  if (usandoFotoGravada()) return orc.vinculo.foto;
  return estado.dados ? fotoDeHoje(estado.dados, '') : null;
}

function parametrosEmUso() { var f = fotoEmUso(); return f ? f.parametros : null; }

/** Fechado ou Não fechou: os valores ficam só para ver (cliente e telefone continuam editáveis). */
function travado() { return !!(orc.vinculo && orc.vinculo.situacao !== 'Aberto'); }

// ---------------- Peças discriminadas ----------------
/** Desenha as linhas de peças (só ao carregar, adicionar, remover ou começar um novo orçamento). */
function renderPecas() {
  var html = orc.pecas.map(function (p, i) {
    var nome = esc(p.descricao || 'peça');
    return '<div class="peca-linha" data-peca="' + i + '">' +
      '<div class="entrada peca-desc"><input type="text" data-peca-campo="descricao" data-indice="' + i + '" maxlength="80"' +
      ' placeholder="Peça (ex.: Pastilha de freio)" aria-label="Descrição da peça" autocomplete="off" value="' + esc(p.descricao) + '"></div>' +
      '<div class="entrada peca-qtd"><input type="text" class="num" inputmode="decimal" data-peca-campo="qtdTexto" data-indice="' + i + '" maxlength="40"' +
      ' placeholder="Qtd" aria-label="Quantidade de ' + nome + '" autocomplete="off" value="' + esc(p.qtdTexto) + '"></div>' +
      '<span class="peca-vezes" aria-hidden="true">×</span>' +
      '<div class="entrada com-prefixo peca-valor"><span class="prefixo">R$</span>' +
      '<input type="text" class="num" inputmode="decimal" data-peca-campo="valorTexto" data-formato="dinheiro" data-indice="' + i + '" maxlength="40"' +
      ' placeholder="0,00" aria-label="Valor unitário que você paga por ' + nome + '" autocomplete="off" value="' + esc(p.valorTexto) + '"></div>' +
      '<div class="entrada com-sufixo peca-acr' + (p.acrescimoTexto !== null ? ' acr-proprio' : '') + '"><input type="text" class="num" inputmode="decimal" data-peca-campo="acrescimoTexto" data-indice="' + i + '" maxlength="40"' +
      ' placeholder="%" aria-label="% em cima de ' + nome + '" autocomplete="off" value="' + esc(p.acrescimoTexto !== null ? p.acrescimoTexto : textoAcrescimo()) + '"><span class="sufixo">%</span></div>' +
      '<button type="button" class="btn-remover" data-remover-peca="' + i + '" aria-label="Remover ' + nome + '">' + icone('i-lixeira') + '</button>' +
      '<p class="erro"></p>' +
      '<p class="peca-cliente"><span class="peca-paga"></span><button type="button" class="link link-mini" data-voltar-acr="' + i + '" hidden></button></p>' +
      '</div>';
  }).join('');
  $('lista-pecas').innerHTML = html;
  $('pecas-cabecalho').hidden = orc.pecas.length === 0;
  $('pecas-vazia').hidden = orc.pecas.length > 0;
  $('btn-adicionar-peca').hidden = orc.pecas.length >= MAX_PECAS;
}

/** Mostra o erro de cada linha de peça (a leitura é de lerEntradaOrcamento, em calculo.js). */
function mostrarErrosPecas(pecas) {
  pecas.forEach(function (p, i) {
    var linha = document.querySelector('.peca-linha[data-peca="' + i + '"]');
    if (!linha) return;
    var inQtd = linha.querySelector('[data-peca-campo="qtdTexto"]');
    var inValor = linha.querySelector('[data-peca-campo="valorTexto"]');
    var inAcr = linha.querySelector('[data-peca-campo="acrescimoTexto"]');
    [[inQtd, p.erroQtd], [inValor, p.erroValor], [inAcr, p.erroAcrescimo]].forEach(function (par) {
      par[0].classList.toggle('invalido', !!par[1]);
      if (par[1]) par[0].setAttribute('aria-invalid', 'true'); else par[0].removeAttribute('aria-invalid');
    });
    linha.querySelector('.erro').textContent = p.erroQtd || p.erroValor || p.erroAcrescimo || '';
  });
}

function adicionarPeca() {
  if (orc.pecas.length >= MAX_PECAS || travado()) return;
  orc.pecas.push(pecaVazia());
  gravarRascunho();
  renderPecas();
  renderOrcamento();
  var campo = document.querySelector('[data-indice="' + (orc.pecas.length - 1) + '"][data-peca-campo="descricao"]');
  if (campo) campo.focus();
}

function onPecaInput(el) {
  var p = orc.pecas[Number(el.dataset.indice)];
  if (!p || travado()) return;
  p[el.dataset.pecaCampo] = el.value; // "% em cima" digitado: a peça passa a ter o próprio % (borda laranja e "↺")
  gravarRascunho();
  renderOrcamento();
}

/** "↺": a peça volta a seguir o % geral do orçamento. */
function voltarAcrescimoPeca(i) {
  var p = orc.pecas[i];
  if (!p || travado()) return;
  p.acrescimoTexto = null;
  gravarRascunho();
  var el = document.querySelector('[data-peca-campo="acrescimoTexto"][data-indice="' + i + '"]');
  if (el) el.value = textoAcrescimo();
  renderOrcamento();
  if (el) el.focus();
}

// ---------------- Serviços da oficina e veículo (seção 17) ----------------

/** Desenha as linhas (só ao carregar, adicionar, remover ou começar um novo orçamento). */
function renderServicos() {
  $('lista-servicos').innerHTML = orc.servicos.map(function (sv, i) {
    var nome = esc(sv.descricao || 'serviço');
    return '<div class="servico-linha" data-servico="' + i + '">' +
      '<div class="entrada serv-desc"><input type="text" data-servico-campo="descricao" data-indice="' + i + '" maxlength="80"' +
      ' placeholder="Serviço (ex.: Troca do radiador)" aria-label="Descrição do serviço da oficina" autocomplete="off" value="' + esc(sv.descricao) + '"></div>' +
      '<div class="entrada com-sufixo serv-horas"><input type="text" class="num" inputmode="decimal" data-servico-campo="horasTexto" data-indice="' + i + '" maxlength="40"' +
      ' placeholder="Horas" aria-label="Horas de ' + nome + '" autocomplete="off" value="' + esc(sv.horasTexto) + '"><span class="sufixo">h</span></div>' +
      '<div class="entrada com-prefixo serv-valor"><span class="prefixo">R$</span>' +
      '<input type="text" class="num" inputmode="decimal" data-servico-campo="valorTexto" data-formato="dinheiro" data-indice="' + i + '" maxlength="40"' +
      ' placeholder="Valor fechado (opcional)" aria-label="Valor fechado de ' + nome + ' (opcional)" autocomplete="off" value="' + esc(sv.valorTexto) + '"></div>' +
      '<button type="button" class="btn-remover" data-remover-servico="' + i + '" aria-label="Remover ' + nome + '">' + icone('i-lixeira') + '</button>' +
      '<p class="erro"></p>' +
      '<p class="serv-info"></p>' +
      (i === 0 ? '<p class="ajuda serv-ajuda" id="servicos-ajuda" hidden>Deixe o R$ vazio para calcular pelas horas.</p>' : '') +
      '</div>';
  }).join('');
  $('btn-adicionar-servico').hidden = orc.servicos.length >= MAX_SERVICOS;
}

function adicionarServico() {
  if (orc.servicos.length >= MAX_SERVICOS || travado()) return;
  orc.servicos.push(servicoVazio());
  gravarRascunho();
  renderServicos();
  renderOrcamento();
  var campo = document.querySelector('[data-servico-campo="descricao"][data-indice="' + (orc.servicos.length - 1) + '"]');
  if (campo) campo.focus();
}

function onServicoInput(el) {
  var sv = orc.servicos[Number(el.dataset.indice)];
  if (!sv || travado()) return;
  sv[el.dataset.servicoCampo] = el.value;
  gravarRascunho();
  renderOrcamento();
}

/** Horas sem zeros desnecessários: "12 h", "6,53 h". */
function horasCurtas(h) { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(h) + ' h'; }

/** Erros e apoio de cada serviço + "Total: 12 h · Mão de obra R$ 1.800,00". */
function mostrarServicos(lidos, res, p) {
  var porLinha = res.servicosLinhas || [];
  lidos.forEach(function (sv, i) {
    var linha = document.querySelector('.servico-linha[data-servico="' + i + '"]');
    if (!linha) return;
    var inHoras = linha.querySelector('[data-servico-campo="horasTexto"]');
    var inValor = linha.querySelector('[data-servico-campo="valorTexto"]');
    [[inHoras, sv.erroHoras], [inValor, sv.erroValor]].forEach(function (par) {
      par[0].classList.toggle('invalido', !!par[1]);
      if (par[1]) par[0].setAttribute('aria-invalid', 'true'); else par[0].removeAttribute('aria-invalid');
    });
    linha.querySelector('.erro').textContent = sv.erroHoras || sv.erroValor || '';
    var mo = porLinha[i];
    var info = '';
    if (mo && mo.horasEstimadas) info = 'Horas estimadas pelo valor da sua hora: ' + formatarHoras(mo.horas);
    else if (mo && typeof sv.valor !== 'number' && mo.horas > 0 && p.valorHoraCobrado > 0) info = 'Mão de obra: ' + formatarBRL(mo.maoDeObra);
    linha.querySelector('.serv-info').textContent = info;
  });
  // Ajuda de 1 linha embaixo do 1º serviço: só enquanto houver um serviço só, e sem valor
  var ajuda = $('servicos-ajuda');
  if (ajuda) ajuda.hidden = !(orc.servicos.length === 1 && String(orc.servicos[0].valorTexto || '').trim() === '');
  var tem = res.maoDeObra > 0 || res.horas > 0;
  $('servicos-totais').hidden = !tem;
  $('servicos-totais').innerHTML = tem
    ? '<span>Total: <strong>' + esc(horasCurtas(res.horas)) + '</strong></span>' +
      '<span>Mão de obra <strong>' + esc(formatarBRL(res.maoDeObra)) + '</strong></span>'
    : '';
  var semValorHora = !(p.valorHoraCobrado > 0) && lidos.some(function (sv) { return typeof sv.valor !== 'number' && sv.horas > 0; });
  $('info-servicos').textContent = semValorHora ? 'Coloque quanto você cobra por hora em Meus gastos.' : '';
}

/** Placa, ano e modelo (data-veiculo). Placa: maiúsculas e "-" do padrão antigo enquanto digita. */
function onVeiculoInput(el) {
  if (travado()) return;
  var k = el.dataset.veiculo;
  if (k === 'placa') {
    var fimDoCampo = el.selectionStart === el.value.length;
    var novo = formatarPlaca(el.value);
    if (novo !== el.value) {
      el.value = novo;
      if (fimDoCampo) try { el.setSelectionRange(novo.length, novo.length); } catch (err) { /* ignora */ }
    }
  } else if (k === 'ano') {
    var so = el.value.replace(/\D/g, '').slice(0, 4);
    if (so !== el.value) el.value = so;
  }
  orc.veiculo[k] = el.value;
  gravarRascunho();
  renderOrcamento();
}

/** Chip do combustível: toca de novo no escolhido → desmarca (é opcional). */
function escolherCombustivel(c) {
  if (travado()) return;
  orc.veiculo.combustivel = orc.veiculo.combustivel === c ? '' : c;
  gravarRascunho();
  renderOrcamento();
}

function preencherVeiculo() {
  ['placa', 'modelo', 'ano'].forEach(function (k) { var el = document.querySelector('[data-veiculo="' + k + '"]'); if (el) el.value = orc.veiculo[k] || ''; });
}

/** Avisos de formato (não impedem salvar) e os chips do combustível. */
function mostrarVeiculo() {
  mostrarErroCampo($('orc-placa'), validarPlaca(orc.veiculo.placa));
  mostrarErroCampo($('orc-ano'), validarAno(orc.veiculo.ano, new Date().getFullYear()));
  document.querySelectorAll('#chips-combustivel [data-combustivel]').forEach(function (b) {
    b.setAttribute('aria-checked', String(b.dataset.combustivel === orc.veiculo.combustivel));
  });
}

// ---------------- Serviços de terceiros (seção 16) ----------------

/** Desenha as linhas (só ao carregar, adicionar, remover ou começar um novo orçamento). */
function renderTerceiros() {
  var pad = textoAcrescimoTerceiros();
  $('lista-terceiros').innerHTML = orc.terceiros.map(function (s, i) {
    var nome = esc(s.descricao || 'serviço');
    return '<div class="terceiro-linha" data-terceiro="' + i + '">' +
      '<div class="entrada terc-desc"><input type="text" data-terceiro-campo="descricao" data-indice="' + i + '" maxlength="80"' +
      ' placeholder="Serviço (ex.: Retífica do cabeçote)" aria-label="Descrição do serviço de terceiro" autocomplete="off" value="' + esc(s.descricao) + '"></div>' +
      '<div class="entrada com-prefixo terc-valor"><span class="prefixo">R$</span>' +
      '<input type="text" class="num" inputmode="decimal" data-terceiro-campo="valorTexto" data-formato="dinheiro" data-indice="' + i + '" maxlength="40"' +
      ' placeholder="0,00" aria-label="Valor que você paga por ' + nome + '" autocomplete="off" value="' + esc(s.valorTexto) + '"></div>' +
      '<div class="entrada com-sufixo terc-acr"><input type="text" class="num" inputmode="decimal" data-terceiro-campo="acrescimoTexto" data-indice="' + i + '" maxlength="40"' +
      ' placeholder="%" aria-label="% em cima de ' + nome + '" autocomplete="off" value="' + esc(s.acrescimoTexto !== null ? s.acrescimoTexto : pad) + '"><span class="sufixo">%</span></div>' +
      '<button type="button" class="btn-remover" data-remover-terceiro="' + i + '" aria-label="Remover ' + nome + '">' + icone('i-lixeira') + '</button>' +
      '<p class="erro"></p>' +
      '<p class="peca-cliente"></p>' +
      '</div>';
  }).join('');
  $('terceiros-cabecalho').hidden = orc.terceiros.length === 0;
  $('terceiros-vazia').hidden = orc.terceiros.length > 0;
  $('btn-adicionar-terceiro').hidden = orc.terceiros.length >= MAX_TERCEIROS;
}

/** % padrão dos serviços de terceiros (da foto em uso). */
function textoAcrescimoTerceiros() {
  var p = parametrosEmUso();
  return numeroParaCampo(p && typeof p.acrescimoTerceirosPadrao === 'number' ? p.acrescimoTerceirosPadrao : 0, false);
}

function adicionarTerceiro() {
  if (orc.terceiros.length >= MAX_TERCEIROS || travado()) return;
  orc.terceiros.push(terceiroVazio());
  gravarRascunho();
  renderTerceiros();
  renderOrcamento();
  var campo = document.querySelector('[data-terceiro-campo="descricao"][data-indice="' + (orc.terceiros.length - 1) + '"]');
  if (campo) campo.focus();
}

function onTerceiroInput(el) {
  var s = orc.terceiros[Number(el.dataset.indice)];
  if (!s || travado()) return;
  s[el.dataset.terceiroCampo] = el.value;
  gravarRascunho();
  renderOrcamento();
}

/** Erros e "Cliente paga" de cada serviço + totais do card. */
function mostrarTerceiros(lidos, res) {
  lidos.forEach(function (s, i) {
    var linha = document.querySelector('.terceiro-linha[data-terceiro="' + i + '"]');
    if (!linha) return;
    var inValor = linha.querySelector('[data-terceiro-campo="valorTexto"]');
    var inAcr = linha.querySelector('[data-terceiro-campo="acrescimoTexto"]');
    [[inValor, s.erroValor], [inAcr, s.erroAcrescimo]].forEach(function (par) {
      par[0].classList.toggle('invalido', !!par[1]);
      if (par[1]) par[0].setAttribute('aria-invalid', 'true'); else par[0].removeAttribute('aria-invalid');
    });
    linha.querySelector('.erro').textContent = s.erroValor || s.erroAcrescimo || '';
    var pago = typeof s.valor === 'number' && s.valor > 0 ? s.valor : 0;
    if (!orc.terceiros[i] || orc.terceiros[i].acrescimoTexto === null) {
      var campo = linha.querySelector('[data-terceiro-campo="acrescimoTexto"]');
      if (campo && document.activeElement !== campo) campo.value = textoAcrescimoTerceiros();
    }
    linha.querySelector('.peca-cliente').textContent = pago > 0 ? 'Cliente paga: ' + formatarBRL(pago * (1 + s.acrescimo / 100)) : '';
  });
  var tem = res.terceirosPagar > 0;
  $('terceiros-totais').hidden = !tem;
  $('terceiros-totais').innerHTML = tem
    ? '<span>Você paga: <strong>' + esc(formatarBRL(res.terceirosPagar)) + '</strong></span>' +
      '<span>Cliente paga: <strong>' + esc(formatarBRL(res.terceirosCobrar)) + '</strong></span>'
    : '';
}

/** Texto do acréscimo deste orçamento: o digitado, ou o padrão dos ajustes (da foto em uso) enquanto ele não mexeu. */
function textoAcrescimo() {
  if (orc.acrescimoTexto !== null) return orc.acrescimoTexto;
  var p = parametrosEmUso();
  return p ? numeroParaCampo(p.acrescimoPecasPadrao, false) : '';
}

/** 16.9: texto do desconto das peças: o digitado, ou o padrão das peças dos Ajustes (da foto em uso). */
function textoDescontoPecas() {
  if (orc.descontoPecasTexto !== null && orc.descontoPecasTexto !== undefined) return orc.descontoPecasTexto;
  return numeroParaCampo(descontoPecasPadraoDosParametros(parametrosEmUso()), false);
}

/** Texto do desconto à vista deste orçamento: o digitado, ou o padrão dos Ajustes (da foto em uso). */
function textoDesconto() {
  if (orc.descontoTexto !== null) return orc.descontoTexto;
  return numeroParaCampo(descontoPadraoDosParametros(parametrosEmUso()), false);
}

function preencherOrcamento() {
  document.querySelectorAll('[data-orc]').forEach(function (el) {
    var k = el.dataset.orc;
    el.value = k === 'acrescimoTexto' ? textoAcrescimo() : k === 'descontoTexto' ? textoDesconto() : k === 'descontoPecasTexto' ? textoDescontoPecas() : (orc[k] || '');
  });
  preencherVeiculo();
  renderServicos();
  renderPecas();
  renderTerceiros();
}

var CAMPOS_NUMERICOS_ORC = ['orc-pecas-pagar', 'orc-acrescimo', 'orc-pecas-cobrar', 'orc-desconto', 'orc-desconto-pecas', 'orc-extra'];

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

/** Negativo sempre como "− R$ 130,77" (mesmo sinal das linhas de custo). */
function comSinal(c) { return c < 0 ? '− ' + formatarCentavos(-c) : formatarCentavos(c); }
function menos(c) { return (c < 0 ? '+ ' : '− ') + formatarCentavos(Math.abs(c)); }

function renderOrcamento() {
  if (!estado.dados) return;
  var calc = calcularComFoto(orc, fotoEmUso());
  var ctx = calc.ctx;
  var p = ctx.parametros;
  // Cartão escolhido que não existe mais (removido ou renomeado fora daqui) volta para "Não sei".
  if (orc.bandeira !== calc.bandeira) orc.bandeira = calc.bandeira;
  ultimoCalc = calc;
  ultimoResultado = calc.res;
  ultimoPreco = calc.preco;
  ultimasPecas = calc.lido.pecas;

  $('bloco-acrescimo').hidden = orc.pecasModo !== 'acrescimo';
  $('bloco-pecas-valor').hidden = orc.pecasModo !== 'valor';

  // Enquanto ele não mexeu no acréscimo/desconto deste orçamento, o campo acompanha o padrão (da foto em uso).
  var campoAcrescimo = $('orc-acrescimo');
  if (orc.acrescimoTexto === null && document.activeElement !== campoAcrescimo) campoAcrescimo.value = textoAcrescimo();
  var campoDesconto = $('orc-desconto');
  if (orc.descontoTexto === null && document.activeElement !== campoDesconto) campoDesconto.value = textoDesconto();
  var campoDescPecas = $('orc-desconto-pecas');
  if ((orc.descontoPecasTexto === null || orc.descontoPecasTexto === undefined) && document.activeElement !== campoDescPecas) campoDescPecas.value = textoDescontoPecas();

  $('faixa-sem-gastos-orc').hidden = ctx.gastosTotal !== 0;

  CAMPOS_NUMERICOS_ORC.forEach(function (id) { mostrarErroCampo($(id), calc.lido.erros[id] || ''); });
  mostrarErrosPecas(calc.lido.pecas);
  mostrarTerceiros(calc.lido.terceiros, calc.res);
  mostrarErroCampo($('orc-telefone'), validarTelefone(orc.telefone));

  var res = calc.res;
  renderVinculo();
  aplicarTrava();

  // Seção 17: serviços da oficina (apoio de cada linha e o total) e o veículo
  mostrarServicos(calc.lido.servicos, res, p);
  mostrarVeiculo();
  // Peças: "Cliente paga" em cada linha e os totais do card
  if (orc.pecasModo === 'acrescimo') {
    // Seção 16: cada peça com o seu % (sem % próprio = o geral, e o campo acompanha o geral)
    var geral = textoAcrescimo();
    calc.lido.pecas.forEach(function (pc, i) {
      var linha = document.querySelector('.peca-linha[data-peca="' + i + '"]');
      if (!linha) return;
      var proprio = !!(orc.pecas[i] && orc.pecas[i].acrescimoTexto !== null);
      var campoAcr = linha.querySelector('[data-peca-campo="acrescimoTexto"]');
      if (!proprio && campoAcr && document.activeElement !== campoAcr) campoAcr.value = geral;
      linha.querySelector('.peca-acr').classList.toggle('acr-proprio', proprio);
      var volta = linha.querySelector('[data-voltar-acr]');
      volta.hidden = !proprio || travado();
      volta.textContent = proprio ? '↺ usar o geral (' + (geral || '0') + '%)' : '';
      volta.setAttribute('aria-label', 'Voltar ' + (pc.descricao || 'esta peça') + ' para o % geral (' + (geral || '0') + '%)');
      var pagaLinha = totalPecasItens([pc]);
      linha.querySelector('.peca-paga').textContent = pagaLinha > 0 ? 'Cliente paga: ' + formatarBRL(pagaLinha * (1 + pc.acrescimo / 100)) : '';
      linha.querySelector('.peca-cliente').hidden = !(pagaLinha > 0) && volta.hidden;
    });
    $('pecas-totais').hidden = !(res.pecasPagar > 0);
    $('pecas-totais').innerHTML = res.pecasPagar > 0
      ? '<span>Você paga: <strong>' + esc(formatarBRL(res.pecasPagar)) + '</strong></span>' +
        '<span>Cliente paga: <strong>' + esc(formatarBRL(res.pecasCobrar)) + '</strong></span>'
      : '';
  }

  var temValor = res.aVista.totalCentavos > 0;
  $('orc-vazio').hidden = temValor;
  $('orc-resultado').hidden = !temValor;
  if (!temValor) return;

  var preco = calc.preco;
  atualizarDicaDesconto();

  // Preço cheio no cartão (âncora) + chips do cartão do cliente
  renderChipsBandeira(ctx.cartoes, res.cartao);
  aplicarTrava(); // os chips acabaram de ser desenhados
  $('card-ancora').hidden = res.semCartoes;
  var anc = preco.ancora;
  $('ancora-titulo').textContent = anc
    ? 'Cartão em ' + anc.parcelas + 'x' + (res.cartaoNoTexto ? ' (' + res.cartaoNoTexto + ')' : '')
    : 'Cartão';
  $('ancora-parcela').textContent = !anc ? '—'
    : anc.parcelas === 1 ? formatarCentavos(anc.totalCentavos)
    : anc.parcelas + '× de ' + formatarCentavos(anc.parcelaCentavos);
  $('ancora-total').textContent = anc && anc.parcelas > 1 ? 'Total ' + formatarCentavos(anc.totalCentavos) : '';
  $('ancora-total').hidden = !(anc && anc.parcelas > 1);

  // À vista oferecido
  $('res-avista').textContent = formatarCentavos(preco.precoCentavos);
  // 16.9: descontos diferentes (serviço × peças) → o desconto em reais (A − V), como no WhatsApp
  $('res-avista-desconto').textContent = !(preco.temAncora && preco.descontoTotal > 0) ? ''
    : preco.descontosIguais === false ? '· ' + formatarCentavos(preco.descontoReaisCentavos) + ' de desconto'
    : '· ' + formatarPercentual(preco.descontoTotal) + ' de desconto';
  // 16.9: "Desconto diferente nas peças?" (só com peças) abre "Desconto no serviço" + "Desconto nas peças"
  var separado = calc.lido.descontoSeparado;
  $('campo-desconto-pecas').hidden = !separado;
  $('rotulo-desconto').textContent = separado ? 'Desconto no serviço' : 'Desconto à vista';
  $('btn-desconto-pecas').hidden = !preco.temAncora || !(separado || res.pecasCobrar > 0);
  $('btn-desconto-pecas').textContent = separado ? 'Mesmo desconto para tudo' : 'Desconto diferente nas peças?';
  $('bloco-desconto').hidden = !preco.temAncora;
  $('dica-sem-ancora').hidden = preco.temAncora || res.semCartoes;
  // "O cliente pediu mais desconto?": o extra e a faixa "ainda pode dar" ficam escondidos até ele tocar (extra > 0 → aberto)
  if (calc.lido.extra > 0 || calc.lido.erros['orc-extra']) ui.maisDesconto = true;
  var maisAberto = preco.temAncora && ui.maisDesconto;
  $('campo-extra').hidden = !maisAberto;
  $('btn-mais-desconto').hidden = !preco.temAncora || ui.maisDesconto;

  // Só para o mecânico: quanto ainda pode dar (atrás do link) / quanto cobra abaixo do seu preço (base − à vista; aviso: sempre)
  var faixaAinda = $('faixa-ainda-pode');
  var faixaAbre = $('faixa-abre-mao');
  faixaAinda.hidden = !maisAberto || preco.acimaDoMaximo;
  faixaAbre.hidden = !preco.temAncora || !preco.acimaDoMaximo;
  if (preco.temAncora && !preco.acimaDoMaximo) {
    faixaAinda.textContent = preco.aindaPodeCentavos > 0
      ? 'Se o cliente pedir mais: ainda pode dar até ' + formatarPercentual(preco.aindaPodePct) +
        ' (' + formatarCentavos(preco.aindaPodeCentavos) + ') sem perder nada — é só a taxa da maquininha que você não vai pagar.'
      : 'Esse é o máximo de desconto sem perder nada — é toda a taxa da maquininha que você não vai pagar.';
  }
  if (preco.temAncora && preco.acimaDoMaximo) {
    faixaAbre.textContent = 'Com esse desconto você cobra ' + formatarCentavos(preco.abreMaoCentavos) + ' abaixo do seu preço.';
  }

  $('card-cartao').hidden = res.semCartoes;
  $('dica-sem-cartoes').hidden = !res.semCartoes;
  renderEntrada(calc, res);

  // Demais parcelas em destaque (sobre a base; a 1ª já está no card do cartão)
  var demais = preco.temAncora ? res.destaques.slice(1) : res.destaques;
  $('cards-destaque').innerHTML = demais.map(function (op) {
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
  // Só a âncora em destaque (ex.: parcelas "5"): nada de card vazio, só o link "Ver outras formas…".
  var soLink = demais.length === 0;
  $('cards-destaque').hidden = soLink;
  $('card-cartao').classList.toggle('card-so-link', soLink);
  $('card-cartao').hidden = res.semCartoes || (soLink && $('outras-formas').hidden);
  $('lista-outras').innerHTML = res.outras.length
    ? calc.outras.map(function (op) { // preço de cada forma pela regra da seção 15 (débito = à vista; até a âncora = preço cheio)
        var esquerda = op.forma === 'Débito' ? 'Débito' : op.parcelas + 'x de ' + formatarCentavos(op.parcelaCentavos);
        return '<li><span class="forma">' + esc(esquerda) + '</span><span class="total-li">total ' + esc(formatarCentavos(op.totalCentavos)) + '</span></li>';
      }).join('')
    : '<li>Nenhuma taxa cadastrada para este cartão. Veja em Ajustes.</li>';

  // Situação do orçamento salvo: Fechado e Não fechou trocam a cobrança por um resumo
  var situacao = orc.vinculo ? orc.vinculo.situacao : 'Aberto';
  var fechamento = situacao === 'Fechado' && orc.vinculo.fechamento ? orc.vinculo.fechamento : null;
  renderResumoSituacao(situacao, fechamento);
  renderBotoesOrcamento(situacao);
  if (fechamento) renderFicaFechado(fechamento);
  else renderFicaAberto(calc, res, preco);
}

/**
 * Seção 16: "O cliente vai dar uma entrada?" → Entrada (R$), forma (Pix/dinheiro | Débito) e parcelas do resto
 * (padrão = a parcela de referência). Resumo: "Entrada R$ 1.000,00 + 5x de R$ 789,47 no cartão · total R$ 4.947,37".
 */
function renderEntrada(calc, res) {
  var pe = calc.parcelasEntrada;
  var pode = !res.semCartoes && pe.lista.length > 0;
  if (String(orc.entradaTexto || '').trim() !== '') ui.entradaAberta = true;
  $('card-entrada').hidden = !pode;
  $('btn-entrada').hidden = ui.entradaAberta;
  $('bloco-entrada').hidden = !ui.entradaAberta;
  if (!pode || !ui.entradaAberta) return;
  document.querySelectorAll('#chips-forma-entrada [data-forma-entrada]').forEach(function (b) {
    b.setAttribute('aria-checked', String(b.dataset.formaEntrada === calc.lido.formaEntrada));
  });
  $('chips-parcelas-entrada').innerHTML = chipsHtml(pe.lista.map(function (n) { return [String(n), n + 'x']; }), 'data-parcelas-entrada', String(pe.escolhida));
  var ec = calc.entradaCartao;
  mostrarErroCampo($('orc-entrada'), calc.lido.erros['orc-entrada'] || (ec && ec.erro) || '');
  var ok = !!(ec && !ec.erro);
  $('entrada-resumo').hidden = !ok;
  $('entrada-resumo').innerHTML = ok
    ? '<span class="sem-quebra">Entrada ' + esc(formatarCentavos(ec.entradaC)) + (calc.lido.formaEntrada === 'debito' ? ' no débito' : ' no Pix') + '</span> + ' +
      '<strong class="sem-quebra">' + ec.parcelas + 'x de ' + esc(formatarCentavos(ec.parcelaC)) + '</strong> no cartão · ' +
      '<span class="sem-quebra">total ' + esc(formatarCentavos(ec.totalC)) + '</span>'
    : '';
}

/** 16.9: abre os dois campos (serviço e peças), os dois com o valor do campo único. */
function abrirDescontoPecas() {
  if (travado()) return;
  var atual = textoDesconto();
  orc.descontoSeparado = true;
  orc.descontoTexto = atual;
  orc.descontoPecasTexto = atual;
  $('orc-desconto-pecas').value = atual;
  gravarRascunho();
  renderOrcamento();
  $('orc-desconto-pecas').focus();
}

/** 16.9: volta ao campo único com o valor do serviço; se os dois eram diferentes, confirma antes (na página). */
function fecharDescontoPecas() {
  if (travado() || !ultimoCalc) return;
  var l = ultimoCalc.lido;
  function fechar() {
    orc.descontoSeparado = false;
    orc.descontoPecasTexto = null;
    gravarRascunho();
    renderOrcamento();
    $('btn-desconto-pecas').focus();
  }
  if (l.desconto === l.descontoPecas) { fechar(); return; }
  var serv = formatarPercentual(typeof l.desconto === 'number' ? l.desconto : 0);
  perguntar('Mesmo desconto para tudo?', 'O desconto das peças (' + formatarPercentual(typeof l.descontoPecas === 'number' ? l.descontoPecas : 0) +
    ') vai ficar igual ao do serviço (' + serv + ').', [{ chave: 'sim', texto: 'Usar ' + serv + ' para tudo', classe: 'btn-primario' }], 'Cancelar')
    .then(function (k) { if (k === 'sim') fechar(); });
}

function abrirEntrada() {
  if (travado()) return;
  ui.entradaAberta = true;
  renderOrcamento();
  $('orc-entrada').focus();
}

function tirarEntrada() {
  if (travado()) return;
  orc.entradaTexto = '';
  orc.formaEntrada = 'pix';
  orc.parcelasEntrada = null;
  $('orc-entrada').value = '';
  ui.entradaAberta = false;
  gravarRascunho();
  renderOrcamento();
  $('btn-entrada').focus();
}

/** "Fechado em 08/11 · Cartão em 5x · Cliente paga R$ 6.648,27" / "Não fechou · 08/11 · motivo". */
function renderResumoSituacao(situacao, f) {
  var aberto = situacao === 'Aberto';
  $('bloco-cobranca').hidden = !aberto;
  $('card-resumo-sit').hidden = aberto;
  $('card-lucro').hidden = situacao === 'Não fechou';
  if (aberto) return;
  var v = orc.vinculo;
  var partes = situacao === 'Fechado'
    ? (f ? ['Fechado em ' + dataBR(f.data, true), descreverForma(f), 'Cliente paga ' + formatarCentavos(f.valorCombinadoC)] : ['Fechado'])
    : ['Não fechou', dataBR(v.atualizadoEm, true)].concat(v.motivo ? [v.motivo] : []);
  $('resumo-sit-texto').innerHTML = partes.filter(Boolean).map(function (s) { return '<span class="sem-quebra">' + esc(s) + '</span>'; }).join(' · ');
  $('card-resumo-sit').className = 'card card-resumo-sit ' + classeSituacao(situacao);
}

/** Botões por situação: Aberto (Copiar · Salvar · O cliente fechou?), Fechado (Copiar · Mudar situação · Duplicar), Não fechou (Voltar para Aberto · Duplicar). */
function renderBotoesOrcamento(situacao) {
  $('btn-copiar').hidden = situacao === 'Não fechou';
  $('botoes-aberto').hidden = situacao !== 'Aberto';
  $('botoes-fechado').hidden = situacao !== 'Fechado';
  $('botoes-nao-fechou').hidden = situacao !== 'Não fechou';
  $('btn-mudar-situacao').disabled = situacaoPendente; // "Fechando…": espera a confirmação
  $('btn-compartilhar').hidden = !podeCompartilhar() || situacao === 'Não fechou';
}

var COR_ESTADO = { verde: 'positivo', ambar: 'ambar', vermelho: 'negativo' };

/** O card "Fica para você": número grande, cor do estado e alerta. */
function pintarFica(totalC, estadoConta, alertas) {
  $('res-fica').innerHTML = dinheiroComSinalHtml(totalC);
  $('res-fica').className = 'valor-grande ' + COR_ESTADO[estadoConta];
  $('card-lucro').className = 'card' + (estadoConta === 'vermelho' ? ' card-negativo' : estadoConta === 'ambar' ? ' card-ambar' : '');
  var alerta = $('res-lucro-alerta');
  var textos = alertas.filter(function (a) { return a.texto; });
  alerta.hidden = !textos.length;
  var vermelho = textos.some(function (a) { return a.tom === 'vermelho'; });
  alerta.className = 'alerta' + (vermelho ? '' : ' alerta-ambar');
  alerta.textContent = textos.map(function (a) { return a.texto; }).join(' ');
}

/** "R$ 423,07 do seu salário + R$ 1.518,89 de sobra" (sobra negativa: "…, menos R$ Y que faltou"; sem casa: só a sobra). */
function textoPartes(casaC, sobraC) {
  if (casaC === null) return sobraC >= 0 ? formatarCentavos(sobraC) + ' de sobra' : '';
  return formatarCentavos(casaC) + ' do seu salário' + (sobraC >= 0 ? ' + ' + formatarCentavos(sobraC) + ' de sobra' : ', menos ' + formatarCentavos(-sobraC) + ' que faltou');
}

/** Aberto: no à vista com o desconto atual; "No cartão em 5x fica"; pisos só como alerta. */
function renderFicaAberto(calc, res, preco) {
  var ganho = calc.ganho;
  var det = calc.det;
  var total = det.totalSeu !== null ? det.totalSeu : det.sobra;
  $('res-fica-partes').textContent = textoPartes(det.vaiParaCasa, det.sobra);
  var piso = alertaDoPiso(preco.precoCentavos, centavos(ganho.pisoOficina), centavos(ganho.pisoCasa), ganho.temCasa);
  pintarFica(total, ganho.estado, [
    { tom: ganho.estado, texto: ganho.estado === 'ambar' ? 'Paga a oficina, mas não cobre toda a sua casa.' : ganho.estado === 'vermelho' ? 'Com esse preço a oficina não se paga.' : '' },
    { tom: piso ? piso.tom : '', texto: !piso ? '' : piso.tom === 'vermelho'
      ? 'Abaixo de ' + formatarCentavos(piso.pisoC) + ' a oficina não se paga.'
      : 'Cuidado: abaixo de ' + formatarCentavos(piso.pisoC) + (piso.piso === 'casa' ? ' não sobra nada para a sua casa.' : ' a oficina não se paga.') }
  ]);

  // No cartão (parcela do card do cartão): salário exibido + sobra no cartão arredondada (soma dos valores mostrados, como no R8;
  // o imposto é sobre o total do cartão). Ex. do print: 423,07 + 1.314,79 = 1.737,86, igual ao fechamento em 5x.
  var anc = preco.ancora;
  var elCartao = $('res-fica-cartao');
  elCartao.hidden = !anc || res.semCartoes;
  elCartao.textContent = anc ? 'No cartão em ' + anc.parcelas + 'x fica: ' + comSinal(centavos(anc.lucro) + (det.vaiParaCasa || 0)) : '';
  // Adendo da seção 17: com a entrada preenchida, o que fica nesse cenário (mesma conta do fechamento "Entrada + cartão")
  var ce = calc.ficaComEntrada;
  var elEntrada = $('res-fica-entrada');
  elEntrada.hidden = !ce || res.semCartoes;
  elEntrada.innerHTML = ce ? '<span class="' + ({ verde: 'positivo', ambar: 'ambar', vermelho: 'negativo' }[ce.estado] || '') + '">Com essa entrada fica: ' + esc(comSinal(ce.totalC)) + '</span>' : '';

  // Ver detalhes (as linhas fecham no centavo com a sobra exibida: veja linhasDetalheServico)
  var linhas = [
    ['Mão de obra', formatarCentavos(det.maoDeObra)],
    ['Lucro nas peças', formatarCentavos(det.lucroPecas)]
  ];
  if (det.lucroTerceiros !== null) linhas.push(['Ganho nos serviços de terceiros', formatarCentavos(det.lucroTerceiros)]);
  if (det.diferenca !== null) {
    linhas.push(det.diferenca < 0
      ? ['Perda por desconto maior que a maquininha', '− ' + formatarCentavos(-det.diferenca)]
      : ['Ganho por ter desconto menor que a maquininha', '+ ' + formatarCentavos(det.diferenca)]);
  }
  // Seção 16: imposto separado: "peças R$ X · serviço R$ Y" (o serviço absorve o centavo)
  if (det.imposto !== null) linhas.push(['Imposto (à vista)', menos(det.imposto), det.impostoPecas > 0 ? 'peças ' + formatarCentavos(det.impostoPecas) + ' · serviço ' + formatarCentavos(det.impostoServico) : null]);
  linhas.push(['Paga os gastos da oficina', menos(det.pagaOficina)]);
  if (det.vaiParaCasa !== null) linhas.push(['Vai para a sua casa', menos(det.vaiParaCasa), 'é o seu salário']);
  linhas.push(['Sobra extra', comSinal(det.sobra), null, 'total']);
  if (det.totalSeu !== null) linhas.push(['Total que é seu (casa + sobra)', comSinal(det.totalSeu)]);
  $('res-detalhes').innerHTML = htmlDetalhes(linhas);
  $('res-piso-oficina').hidden = false;
  $('res-piso-oficina').textContent = 'Abaixo de ' + formatarBRL(ganho.pisoOficina) + ' a oficina não se paga.';
  $('res-piso').hidden = !ganho.temCasa; // sem gastos de casa: um só piso
  $('res-piso').textContent = ganho.temCasa ? 'Abaixo de ' + formatarBRL(ganho.pisoCasa) + ' não sobra nada para a sua casa.' : '';
}

/** Fechado: o que foi GRAVADO no fechamento (forma e valor combinado); nada é recalculado. */
function renderFicaFechado(f) {
  var total = f.totalSeuC !== null ? f.totalSeuC : f.sobraC;
  $('res-fica-partes').textContent = textoPartes(f.vaiParaCasaC, f.sobraC);
  pintarFica(total, f.estado, [{ tom: f.estado, texto: f.estado === 'ambar' ? 'Paga a oficina, mas não cobre toda a sua casa.' : f.estado === 'vermelho' ? 'Com esse valor a oficina não se paga.' : '' }]);
  $('res-fica-cartao').hidden = true;
  $('res-fica-entrada').hidden = true;
  var linhas = [
    ['Cliente paga (' + descreverForma(f) + ')', formatarCentavos(f.valorCombinadoC)],
    ['Taxa da maquininha', menos(f.taxaC)],
    ['Imposto', menos(f.impostoC)],
    ['Peças (o que você pagou)', menos(f.pecasPagarC)]
  ];
  if (f.terceirosPagarC > 0) linhas.push(['Serviços de terceiros (o que você pagou)', menos(f.terceirosPagarC)]);
  linhas.push(['Paga os gastos da oficina', menos(f.pagaOficinaC)]);
  if (f.vaiParaCasaC !== null) linhas.push(['Vai para a sua casa', menos(f.vaiParaCasaC), 'é o seu salário']);
  linhas.push(['Sobra extra', comSinal(f.sobraC), null, 'total']);
  if (f.totalSeuC !== null) linhas.push(['Total que é seu (casa + sobra)', comSinal(f.totalSeuC)]);
  $('res-detalhes').innerHTML = htmlDetalhes(linhas);
  $('res-piso-oficina').hidden = true;
  $('res-piso').hidden = true;
}

/** "Compartilhar" só no celular: o navegador tem o recurso E a tela é estreita (o mesmo corte das 2 colunas). */
var TELA_ESTREITA = '(max-width: 899px)';
function podeCompartilhar() {
  return typeof navigator.share === 'function' && !!window.matchMedia && window.matchMedia(TELA_ESTREITA).matches;
}

/** Linhas [rótulo, valor, nota?, classe?] → <dt>/<dd>. */
function htmlDetalhes(linhas) {
  return linhas.map(function (l) {
    var classe = l[3] ? ' class="' + l[3] + '"' : '';
    return '<dt' + classe + '>' + esc(l[0]) + (l[2] ? '<span class="nota-casa">' + esc(l[2]) + '</span>' : '') + '</dt>' +
      '<dd' + classe + '>' + esc(l[1]) + '</dd>';
  }).join('');
}

/**
 * Máscara do telefone enquanto digita: só números (no máximo 11), "(11) 98888-7777" / "(11) 3333-4444".
 * O cursor fica depois do mesmo número em que estava (não pula para o fim). Apagar um símbolo da máscara
 * ("-", ")", espaço) apaga o número ao lado. Colar aceita qualquer formato (+55, símbolos).
 */
function mascararTelefone(el, tipo) {
  var bruto = el.value;
  var pos = typeof el.selectionStart === 'number' ? el.selectionStart : bruto.length;
  var antes = soNumeros(orc.telefone);
  var digitos = soNumeros(bruto);
  var k = soNumeros(bruto.slice(0, pos)).length; // quantos números ficam antes do cursor
  var colou = tipo === 'insertFromPaste' || tipo === 'insertReplacementText';
  if (/^delete/.test(tipo) && digitos === antes && digitos.length) {
    if (tipo === 'deleteContentBackward' && k > 0) { digitos = digitos.slice(0, k - 1) + digitos.slice(k); k--; }
    else if (tipo === 'deleteContentForward') digitos = digitos.slice(0, k) + digitos.slice(k + 1);
  }
  if (!colou && digitos.length > MAX_DIGITOS_TELEFONE) { digitos = antes; k = Math.min(k - 1, antes.length); } // passou de 11: ignora a tecla
  var limpos = colou ? digitosDoTelefone(digitos) : digitos.slice(0, MAX_DIGITOS_TELEFONE);
  var novo = formatarTelefone(limpos);
  if (colou || limpos.length !== digitos.length) k = limpos.length;
  k = Math.max(0, Math.min(k, limpos.length));
  el.value = novo;
  if (document.activeElement !== el) return;
  var c = 0;
  if (k > 0) { var vistos = 0; for (var i = 0; i < novo.length; i++) { if (/\d/.test(novo[i]) && ++vistos === k) { c = i + 1; break; } } }
  else c = novo.indexOf('(') === 0 ? 1 : 0;
  if (tipo === 'deleteContentForward') while (c < novo.length && !/\d/.test(novo[c])) c++; // Delete: o cursor fica antes do próximo número
  try { el.setSelectionRange(c, c); } catch (err) { /* ignora */ }
}

function onOrcamentoInput(el) {
  var k = el.dataset.orc;
  if (travado() && k !== 'cliente' && k !== 'telefone') return;
  orc[k] = el.value;
  gravarRascunho();
  renderOrcamento();
}

function trocarModoPecas(modo) {
  if (travado()) return;
  orc.pecasModo = modo;
  gravarRascunho();
  renderOrcamento();
  $(modo === 'acrescimo' ? 'btn-adicionar-peca' : 'orc-pecas-pagar').focus();
}

/** Troca o rascunho (novo, reaberto ou cópia) e redesenha. */
function carregarRascunho(r, manterAssinatura) {
  if (doRascunho(desfazer.tipo) && desfazer.item) finalizarRemocao(); // a linha removida não volta em outro orçamento
  orc = r;
  ui.maisDesconto = false; // o extra volta escondido (abre sozinho se o orçamento tiver extra)
  ui.entradaAberta = false; // idem a entrada (abre sozinha se o orçamento tiver entrada)
  if (orc.vinculo && !manterAssinatura) orc.vinculo.assinatura = assinaturaDe(true);
  gravarRascunho();
  preencherOrcamento();
  $('outras-formas').open = false;
  renderOrcamento();
}

/** "+ Novo orçamento": com alteração não salva, pergunta antes (na página). */
function aoClicarNovo() {
  if (!temMudancaNaoSalva()) { novoOrcamento(); return; }
  perguntar('Começar um novo?', 'O que você fez aqui não foi salvo.', [
    { chave: 'salvar', texto: 'Salvar e começar novo', classe: 'btn-primario' },
    { chave: 'novo', texto: 'Começar sem salvar' }
  ], 'Cancelar').then(function (k) {
    if (k === 'novo') novoOrcamento();
    if (k === 'salvar') salvarOrcamento({}).then(function (x) {
      if (x.r === 'salvo' || x.r === 'semMudanca') novoOrcamento(); else avisarSalvamento(x, false);
    });
  });
}

function novoOrcamento() {
  carregarRascunho(orcamentoVazio());
  apagarStorage(CHAVE_ORCAMENTO);
  window.scrollTo(0, 0);
  var primeiro = document.querySelector('[data-servico-campo="descricao"]');
  if (primeiro) primeiro.focus();
  mostrarAviso('Pronto para um novo orçamento.');
}

// ---------------- Orçamento salvo: vínculo, foto e trava ----------------
var NOME_FORMA = { pix: 'Pix/dinheiro', debito: 'Débito', credito: 'Cartão' };

function descreverForma(f) { return descreverFormaFechamento(f); }

function classeSituacao(s) { return s === 'Fechado' ? 'sit-fechado' : s === 'Não fechou' ? 'sit-nao' : 'sit-aberto'; }

function chipSituacao(s) { return '<span class="chip-situacao ' + classeSituacao(s) + '">' + esc(s) + '</span>'; }

function renderVinculo() {
  var v = orc.vinculo;
  $('faixa-vinculo').hidden = !v;
  $('vinculo-foto').hidden = true;
  $('faixa-travado').hidden = true;
  if (!v) return;
  var quem = String(orc.cliente || '').trim();
  $('vinculo-texto').innerHTML = 'Salvo · ' + chipSituacao(v.situacao) + (quem ? ' · ' + esc(quem) : '');
  if (v.recalcular) {
    $('vinculo-foto').hidden = false;
    $('vinculo-foto-texto').textContent = 'Valores de hoje (ainda não salvos). Toque em "Salvar orçamento" para guardar.';
    $('btn-recalcular').hidden = true;
  } else if (estado.dados && !fotosIguais(fotoDeHoje(estado.dados, ''), v.foto)) {
    $('vinculo-foto').hidden = false;
    $('vinculo-foto-texto').textContent = 'Valores de ' + (dataBR(v.foto.em) || 'quando foi salvo') + '.';
    $('btn-recalcular').hidden = travado();
  }
  if (travado()) {
    $('faixa-travado').hidden = false;
    $('faixa-travado').textContent = 'Para mudar valores: Voltar para Aberto ou Duplicar.';
  }
}

/** Fechado/Não fechou: campos de valor desabilitados (cliente e telefone continuam). */
function aplicarTrava() {
  var t = travado();
  document.body.classList.toggle('orc-travado', t);
  document.querySelectorAll('#tela-orcamento [data-orc], #tela-orcamento [data-peca-campo], #tela-orcamento [data-terceiro-campo], #tela-orcamento [data-servico-campo], #tela-orcamento [data-veiculo]').forEach(function (el) {
    if (el.dataset.orc === 'cliente' || el.dataset.orc === 'telefone') return;
    el.disabled = t;
  });
  ['ir-pecas-valor', 'ir-pecas-acrescimo', 'btn-adicionar-servico', 'btn-adicionar-peca', 'btn-adicionar-terceiro', 'btn-entrada', 'btn-tirar-entrada', 'btn-desconto-pecas'].forEach(function (id) { $(id).disabled = t; });
  document.querySelectorAll('#tela-orcamento [data-remover-peca], #tela-orcamento [data-remover-terceiro], #tela-orcamento [data-remover-servico], #tela-orcamento [data-combustivel], #tela-orcamento [data-bandeira-indice], #tela-orcamento [data-voltar-acr], ' +
    '#tela-orcamento [data-forma-entrada], #tela-orcamento [data-parcelas-entrada]').forEach(function (b) { b.disabled = t; });
}

/** "Recalcular com os valores de hoje": só troca a conta na tela; grava só se ele salvar. */
function recalcularComHoje() {
  if (!orc.vinculo || travado()) return;
  orc.vinculo.recalcular = true;
  gravarRascunho();
  preencherOrcamento();
  renderOrcamento();
  mostrarAviso('Calculado com os valores de hoje. Toque em "Salvar orçamento" para guardar.');
}

// ---------------- Salvar orçamento ----------------
function textoCampo(s, max) { return String(s === null || s === undefined ? '' : s).slice(0, max || MAX_TEXTO_CAMPO); }

/** O rascunho no formato da coluna "Dados" → entrada (textos como foram digitados). */
function entradaDoRascunho() {
  // Seção 17: descricao = o texto da coluna F ("placa · modelo · 1º serviço (+N)"); modo/horas/valor = reserva para o
  // app antigo no cache (um serviço só com o total); a conta usa a lista "servicos".
  var p = parametrosEmUso();
  var legado = legadoDosServicos(orc.servicos, p && typeof p.valorHoraCobrado === 'number' ? p.valorHoraCobrado : 0);
  var e = {
    descricao: descricaoDoOrcamento(orc.veiculo, orc.servicos),
    modo: legado.modo,
    horasTexto: textoCampo(legado.horasTexto),
    valorTexto: textoCampo(legado.valorTexto),
    horasFechadoTexto: textoCampo(legado.horasFechadoTexto),
    servicos: orc.servicos.slice(0, MAX_SERVICOS).map(function (sv) {
      return { id: sv.id, descricao: textoCampo(sv.descricao, 80), horasTexto: textoCampo(sv.horasTexto), valorTexto: textoCampo(sv.valorTexto) };
    }),
    pecasModo: orc.pecasModo,
    pecas: orc.pecas.slice(0, MAX_PECAS).map(function (p) {
      var x = { descricao: textoCampo(p.descricao, 80), qtdTexto: textoCampo(p.qtdTexto), valorTexto: textoCampo(p.valorTexto) };
      if (p.acrescimoTexto !== null && p.acrescimoTexto !== undefined) x.acrescimoTexto = textoCampo(p.acrescimoTexto); // seção 16: % próprio
      return x;
    }),
    pecasPagarTexto: textoCampo(orc.pecasPagarTexto),
    pecasCobrarTexto: textoCampo(orc.pecasCobrarTexto),
    acrescimoTexto: orc.acrescimoTexto === null ? null : textoCampo(orc.acrescimoTexto),
    descontoTexto: orc.descontoTexto === null ? null : textoCampo(orc.descontoTexto),
    extraTexto: textoCampo(orc.extraTexto),
    bandeira: textoCampo(orc.bandeira, MAX_NOME_CARTAO)
  };
  // Seção 16.9: orçamento novo leva o modo do desconto (ausente = orçamento de antes, regra antiga)
  if (orc.descontoSeparado !== undefined) {
    e.descontoSeparado = orc.descontoSeparado;
    e.descontoPecasTexto = orc.descontoPecasTexto === null || orc.descontoPecasTexto === undefined ? null : textoCampo(orc.descontoPecasTexto);
  }
  // Seção 17: veículo só quando tem algo
  var v = orc.veiculo;
  if (['placa', 'modelo', 'ano', 'combustivel'].some(function (k) { return String(v[k] || '').trim() !== ''; })) {
    e.veiculo = { placa: textoCampo(String(v.placa || '').trim(), MAX_PLACA), modelo: textoCampo(String(v.modelo || '').trim(), MAX_MODELO),
      ano: textoCampo(String(v.ano || '').trim(), 4), combustivel: v.combustivel || '' };
  }
  // Seção 16: só entram quando usados (um orçamento sem eles grava exatamente como antes)
  if (orc.terceiros.length) {
    e.terceiros = orc.terceiros.slice(0, MAX_TERCEIROS).map(function (s) {
      return { descricao: textoCampo(s.descricao, 80), valorTexto: textoCampo(s.valorTexto), acrescimoTexto: s.acrescimoTexto === null ? null : textoCampo(s.acrescimoTexto) };
    });
  }
  if (String(orc.entradaTexto || '').trim() !== '') {
    e.entradaTexto = textoCampo(orc.entradaTexto);
    e.formaEntrada = orc.formaEntrada === 'debito' ? 'debito' : 'pix';
    e.parcelasEntrada = typeof orc.parcelasEntrada === 'number' ? orc.parcelasEntrada : null;
  }
  return e;
}

/** Assinatura do que seria gravado. gravada = com a foto gravada (depois de salvar, é sempre assim). */
function assinaturaDe(gravada) {
  return JSON.stringify([entradaDoRascunho(), String(orc.cliente || '').trim(), String(orc.telefone || '').trim(),
    gravada ? 'foto gravada' : (estado.dados ? JSON.stringify(fotoDeHoje(estado.dados, '')) : '')]);
}

function rascunhoTemConteudo() {
  return [orc.cliente, orc.telefone, orc.pecasPagarTexto, orc.entradaTexto, orc.veiculo.placa, orc.veiculo.modelo, orc.veiculo.ano, orc.veiculo.combustivel].some(function (s) { return String(s || '').trim() !== ''; }) ||
    orc.servicos.some(function (sv) { return ['descricao', 'horasTexto', 'valorTexto'].some(function (k) { return String(sv[k] || '').trim() !== ''; }); }) ||
    orc.pecas.some(function (p) { return String(p.descricao || '').trim() !== '' || String(p.valorTexto || '').trim() !== ''; }) ||
    orc.terceiros.some(function (s) { return String(s.descricao || '').trim() !== '' || String(s.valorTexto || '').trim() !== ''; });
}

function temMudancaNaoSalva() {
  if (!orc.vinculo) return rascunhoTemConteudo();
  return assinaturaDe(usandoFotoGravada()) !== orc.vinculo.assinatura;
}

function novoId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  var b = new Uint8Array(16);
  window.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

function agoraLocal() {
  var d = new Date();
  return dataLocal(d) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/** '' = pode salvar; 'semConexao'; ou a mensagem do que falta. */
function motivoNaoSalva() {
  if (!estado.dados) return 'Carregando…';
  if (!conexao || !estado.carregadoDoServidor || navigator.onLine === false) return 'semConexao';
  if (!ultimoCalc || ultimoCalc.res.aVista.totalCentavos <= 0) return 'Preencha as horas (ou o valor) e as peças antes de salvar.';
  if (Object.keys(ultimoCalc.lido.erros).length || validarTelefone(orc.telefone)) return 'Corrija o campo em vermelho antes de salvar.';
  return '';
}

/**
 * Salva (upsert) o orçamento da tela. op.comoNovo: ID novo, sem base (depois de conflito/excluído).
 * @return Promise<{r: 'salvo'|'semMudanca'|'semConexao'|'invalido'|'conflito'|'excluido'|'erro', msg?}>
 */
function salvarOrcamento(op) {
  op = op || {};
  if (salvandoOrc) return salvandoOrc;
  renderOrcamento();
  var motivo = motivoNaoSalva();
  if (motivo) return Promise.resolve({ r: motivo === 'semConexao' ? 'semConexao' : 'invalido', msg: motivo });
  var novo = !orc.vinculo || !!op.comoNovo;
  if (!novo && assinaturaDe(usandoFotoGravada()) === orc.vinculo.assinatura) return Promise.resolve({ r: 'semMudanca' });

  var gravada = usandoFotoGravada();
  var foto = clonar(fotoEmUso());
  if (!gravada) foto.em = agoraLocal();
  var pedido = {
    id: novo ? novoId() : orc.vinculo.id,
    atualizadoEmBase: novo ? null : orc.vinculo.atualizadoEm,
    cliente: String(orc.cliente || '').trim(),
    telefone: String(orc.telefone || '').trim(),
    dados: { v: 1, entrada: entradaDoRascunho(), foto: foto, resultado: resultadoParaGravar(ultimoCalc) }
  };
  var assinatura = assinaturaDe(true);
  var antigo = orc.vinculo;
  var usada = conexao;
  $('btn-salvar-orc').disabled = true;
  salvandoOrc = PrecoCertoApi.pedir(conexao, 'salvarOrcamento', { orcamento: pedido }).then(function (r) {
    salvandoOrc = null;
    $('btn-salvar-orc').disabled = false;
    if (conexao !== usada) return { r: 'erro', msg: 'O aparelho foi desconectado.' };
    var manter = antigo && !novo && antigo.situacao !== 'Aberto'; // Fechado/Não fechou: só cliente e telefone mudaram
    orc.vinculo = {
      id: r.id, criadoEm: r.criadoEm, atualizadoEm: r.atualizadoEm, situacao: r.situacao,
      motivo: manter ? antigo.motivo : '', fechamento: manter ? antigo.fechamento : null,
      foto: manter ? antigo.foto : foto, recalcular: false, assinatura: assinatura
    };
    gravarRascunho();
    renderOrcamento();
    resultadosMudaram();
    return { r: 'salvo' };
  }, function (e) {
    salvandoOrc = null;
    $('btn-salvar-orc').disabled = false;
    if (e && e.tipo === 'acesso') { perdeuAcesso(); return { r: 'erro', msg: mensagemDoErro(e) }; }
    if (e && e.tipo === 'conflito') { avisarConflito(); return { r: 'conflito' }; }
    if (e && e.tipo === 'excluido') { avisarExcluido(); return { r: 'excluido' }; }
    if (e && e.tipo === 'rede') return { r: 'semConexao' };
    return { r: 'erro', msg: mensagemDoErro(e) };
  });
  return salvandoOrc;
}

var MSG_NAO_SALVO_SEM_CONEXAO = 'Sem conexão: orçamento NÃO foi salvo.';

/** Aviso depois de salvar (copiou = veio do "Copiar para WhatsApp"). */
function avisarSalvamento(x, copiou) {
  var antes = copiou ? 'Copiado ✓ · ' : '';
  if (x.r === 'salvo') mostrarAviso(antes + 'Orçamento salvo ✓');
  else if (x.r === 'semMudanca') mostrarAviso(copiou ? 'Copiado! Agora é só colar no WhatsApp.' : 'Orçamento salvo ✓');
  else if (x.r === 'semConexao') mostrarAviso(antes + MSG_NAO_SALVO_SEM_CONEXAO, 'alerta');
  else if (x.r === 'invalido') mostrarAviso(antes + 'Orçamento não salvo: ' + x.msg, 'alerta');
  else if (x.r === 'erro') mostrarAviso(antes + 'Não foi salvo. Tente de novo.' + (x.msg ? ' (' + x.msg + ')' : ''), 'alerta');
  else if (copiou) mostrarAviso('Copiado ✓');
}

/** Seção 14: "Salvando…" na hora (sem travar os campos); "Orçamento salvo ✓" só com a resposta do servidor. */
function aoClicarSalvar() {
  var p = salvarOrcamento({});
  if (salvandoOrc) mostrarAviso('Salvando…', 'fixo');
  p.then(function (x) { avisarSalvamento(x, false); });
}

function avisarConflito() {
  perguntar('Esse orçamento foi alterado em outro aparelho.', 'Suas mudanças não foram salvas.', [
    { chave: 'ver', texto: 'Ver a versão nova', classe: 'btn-primario' },
    { chave: 'novo', texto: 'Salvar as minhas como um novo orçamento' }
  ]).then(function (k) {
    if (k === 'ver' && orc.vinculo) buscarOrcamento(orc.vinculo.id).then(function (o) { if (o) { carregarRascunho(rascunhoDoSalvo(o)); mostrarAviso('Versão nova carregada.'); } });
    if (k === 'novo') salvarOrcamento({ comoNovo: true }).then(function (x) { avisarSalvamento(x, false); });
  });
}

function avisarExcluido() {
  perguntar('Esse orçamento foi excluído em outro aparelho.', 'Suas mudanças não foram salvas, e ele não volta sozinho.', [
    { chave: 'novo', texto: 'Salvar as minhas como novo', classe: 'btn-primario' },
    { chave: 'descartar', texto: 'Descartar' }
  ]).then(function (k) {
    if (k === 'novo') salvarOrcamento({ comoNovo: true }).then(function (x) { avisarSalvamento(x, false); });
    if (k === 'descartar') { carregarRascunho(orcamentoVazio()); apagarStorage(CHAVE_ORCAMENTO); mostrarAviso('Orçamento descartado.'); }
  });
}

// ---------------- Reabrir, duplicar ----------------
var CAMPOS_ENTRADA = ['pecasModo', 'pecasPagarTexto',
  'pecasCobrarTexto', 'acrescimoTexto', 'descontoTexto', 'extraTexto', 'bandeira', 'entradaTexto', 'formaEntrada', 'parcelasEntrada'];

/** Orçamento vindo do servidor (obterOrcamento) → rascunho da tela. comoCopia: sem vínculo (Duplicar), valores de hoje. */
function rascunhoDoSalvo(o, comoCopia) {
  var e = o.dados.entrada;
  var r = orcamentoVazio();
  CAMPOS_ENTRADA.forEach(function (k) { if (e[k] !== undefined) r[k] = e[k]; });
  // Seção 17: orçamento de antes (sem a lista) abre como UMA linha com o texto antigo; veículo vazio. Nenhum número muda.
  r.servicos = Array.isArray(e.servicos) ? servicosLimpos(e.servicos) : servicosDoLegado(e);
  r.veiculo = veiculoLimpo(e.veiculo);
  r.pecas = (e.pecas || []).map(function (p) { return { descricao: p.descricao || '', qtdTexto: p.qtdTexto || '', valorTexto: p.valorTexto || '', acrescimoTexto: textoOuNulo(p.acrescimoTexto) }; });
  r.terceiros = (e.terceiros || []).map(function (s) { return { descricao: s.descricao || '', valorTexto: s.valorTexto || '', acrescimoTexto: textoOuNulo(s.acrescimoTexto) }; });
  if (r.formaEntrada !== 'debito') r.formaEntrada = 'pix';
  if (typeof r.parcelasEntrada !== 'number') r.parcelasEntrada = null;
  if (typeof r.entradaTexto !== 'string') r.entradaTexto = '';
  // 16.9: orçamento salvo antes do adendo (sem a chave) abre com a regra antiga (igual ao de antes)
  if (e.descontoSeparado === undefined) { r.descontoSeparado = undefined; r.descontoPecasTexto = null; }
  else { r.descontoSeparado = e.descontoSeparado === true ? true : e.descontoSeparado === false ? false : null; r.descontoPecasTexto = textoOuNulo(e.descontoPecasTexto); }
  r.cliente = o.cliente || '';
  r.telefone = formatarTelefone(o.telefone || ''); // telefone antigo sem máscara: aparece formatado (e vai formatado no próximo salvamento)
  if (!comoCopia) {
    r.vinculo = { id: o.id, criadoEm: o.criadoEm, atualizadoEm: o.atualizadoEm, situacao: o.situacao, motivo: o.motivo || '',
      fechamento: o.dados.fechamento || null, foto: o.dados.foto, recalcular: false, assinatura: '' };
  }
  return r;
}

/** obterOrcamento com os avisos de sempre. @return Promise<orcamento|null> */
function buscarOrcamento(id) {
  if (!conexao) return Promise.resolve(null);
  return PrecoCertoApi.pedir(conexao, 'obterOrcamento', { id: id }).then(function (r) { return r.orcamento; }, function (e) {
    if (e && e.tipo === 'acesso') perdeuAcesso();
    else if (e && e.tipo === 'excluido') { mostrarAviso('Esse orçamento foi excluído em outro aparelho.', 'alerta'); desvincularSe(id); resultadosMudaram(); }
    else mostrarAviso(e && e.tipo === 'rede' ? 'Sem conexão: não deu para abrir o orçamento.' : 'Não abriu: ' + mensagemDoErro(e), 'alerta');
    return null;
  });
}

function desvincularSe(id) {
  if (orc.vinculo && orc.vinculo.id === id) { orc.vinculo = null; gravarRascunho(); renderOrcamento(); }
}

/** Antes de trocar o rascunho: se houver orçamento não salvo, pergunta. fn roda depois (se ele quiser). */
function trocarRascunhoCom(fn) {
  if (!temMudancaNaoSalva()) { fn(); return; }
  perguntar('Você tem um orçamento que não foi salvo.', 'O que fazer com ele antes de abrir o outro?', [
    { chave: 'salvar', texto: 'Salvar e abrir', classe: 'btn-primario' },
    { chave: 'descartar', texto: 'Descartar e abrir' }
  ]).then(function (k) {
    if (k === 'descartar') fn();
    if (k === 'salvar') salvarOrcamento({}).then(function (x) {
      if (x.r === 'salvo' || x.r === 'semMudanca') fn(); else avisarSalvamento(x, false);
    });
  });
}

function abrirSalvo(id) {
  buscarOrcamento(id).then(function (o) {
    if (!o) return;
    trocarRascunhoCom(function () {
      carregarRascunho(rascunhoDoSalvo(o));
      irParaOrcamento();
      mostrarAviso('Orçamento aberto.');
    });
  });
}

function duplicarSalvo(id) {
  buscarOrcamento(id).then(function (o) {
    if (!o) return;
    trocarRascunhoCom(function () {
      carregarRascunho(rascunhoDoSalvo(o, true));
      irParaOrcamento();
      mostrarAviso('Cópia pronta, com os valores de hoje. Confira e salve.');
    });
  });
}

/** Duplicar o orçamento da tela: o mesmo rascunho, sem vínculo, com os valores de hoje. */
function duplicarRascunho() {
  var copia = clonar(orc);
  copia.vinculo = null;
  carregarRascunho(copia);
  window.scrollTo(0, 0);
  mostrarAviso('Cópia pronta, com os valores de hoje. Confira e salve.');
}

// ---------------- Situação: Aberto · Fechado · Não fechou ----------------
/** alvo = {id, atualizadoEm, situacao, cliente, servico, valorCombinadoC?, origem: 'orcamento'|'lista'} */
function alvoDoRascunho() {
  var v = orc.vinculo;
  return { id: v.id, atualizadoEm: v.atualizadoEm, situacao: v.situacao, cliente: orc.cliente, servico: descricaoDoOrcamento(orc.veiculo, orc.servicos),
    valorCombinadoC: v.fechamento ? v.fechamento.valorCombinadoC : null, origem: 'orcamento' };
}

/** "O cliente fechou?": salva antes (orçamento novo ou mudado) e abre a tela de fechamento. */
/**
 * O orçamento salvo da tela, no formato do obterOrcamento (sem pedir ao servidor). Só vale sem alteração não salva:
 * aí a foto em uso é a gravada e a conta é a mesma que foi salva. O servidor confere o fechamento com o que está gravado.
 */
function orcamentoDaTela() {
  var v = orc.vinculo;
  return { id: v.id, criadoEm: v.criadoEm, atualizadoEm: v.atualizadoEm, cliente: orc.cliente, telefone: orc.telefone,
    situacao: v.situacao, motivo: v.motivo || '',
    dados: { v: 1, entrada: entradaDoRascunho(), foto: clonar(v.foto), resultado: resultadoParaGravar(calcularComFoto(orc, v.foto)) } };
}

function clienteFechou() {
  // Seção 14: abre a tela de fechamento com o que já está no aparelho (sem obterOrcamento).
  var abrir = function () { abrirFechamento(orcamentoDaTela(), 'orcamento'); };
  if (orc.vinculo && !temMudancaNaoSalva()) { abrir(); return; }
  salvarOrcamento({}).then(function (x) {
    if ((x.r === 'salvo' || x.r === 'semMudanca') && orc.vinculo) abrir(); else avisarSalvamento(x, false);
  });
}

/** "Voltar para Aberto" do orçamento da tela (Não fechou) ou da tela de fechamento. */
function voltarParaAberto(alvo) {
  menuSit.alvo = alvo;
  escolherNoMenuSituacao('aberto');
}

/** Só o pedido do motivo ("O cliente não fechou", na tela de fechamento). */
function abrirNaoFechou(alvo) {
  menuSit.alvo = alvo;
  menuSit.deFechar = true;
  $('menu-situacao-titulo').textContent = 'O cliente não fechou';
  $('menu-situacao-quem').innerHTML = esc([alvo.cliente, alvo.servico].filter(function (s) { return String(s || '').trim(); }).join(' · ') || 'Orçamento sem nome');
  $('menu-situacao-botoes').innerHTML = '';
  $('bloco-motivo').hidden = false;
  $('motivo-texto').value = '';
  $('menu-situacao').hidden = false;
  $('motivo-texto').focus();
}

function alvoDoFechamento() {
  var o = fech.o;
  return { id: o.id, atualizadoEm: o.atualizadoEm, situacao: o.situacao, cliente: o.cliente, servico: o.dados.entrada.descricao,
    valorCombinadoC: null, origem: fech.voltarPara === 'resultados' ? 'lista' : 'orcamento' };
}

function abrirMenuSituacao(alvo) {
  menuSit.deFechar = false;
  $('menu-situacao-titulo').textContent = 'Mudar situação';
  menuSit.alvo = alvo;
  $('menu-situacao-quem').innerHTML = esc([alvo.cliente, alvo.servico].filter(function (s) { return String(s || '').trim(); }).join(' · ') || 'Orçamento sem nome') +
    ' · ' + chipSituacao(alvo.situacao);
  var b = [];
  if (alvo.situacao !== 'Fechado') b.push(['fechou', 'Fechou', 'btn-primario']);
  if (alvo.situacao === 'Aberto') b.push(['nao', 'Não fechou', 'btn-fantasma']);
  if (alvo.situacao !== 'Aberto') b.push(['aberto', 'Voltar para Aberto', 'btn-fantasma']);
  if (alvo.origem === 'orcamento') b.push(['excluir', 'Excluir orçamento', 'btn-fantasma btn-texto-perigo']);
  $('menu-situacao-botoes').innerHTML = b.map(function (x) {
    return '<button type="button" class="btn ' + x[2] + '" data-sit="' + x[0] + '">' + esc(x[1]) + '</button>';
  }).join('');
  $('bloco-motivo').hidden = true;
  $('motivo-texto').value = '';
  $('menu-situacao').hidden = false;
  var primeiro = $('menu-situacao-botoes').querySelector('button');
  if (primeiro) primeiro.focus();
}

function fecharMenuSituacao() { $('menu-situacao').hidden = true; }

function escolherNoMenuSituacao(acao) {
  var alvo = menuSit.alvo;
  if (!alvo) return;
  if (acao === 'nao') { $('bloco-motivo').hidden = false; $('motivo-texto').focus(); return; }
  fecharMenuSituacao();
  if (acao === 'fechou') {
    var abrir = function () {
      buscarOrcamento(alvo.id).then(function (o) { if (o) abrirFechamento(o, alvo.origem === 'lista' ? 'resultados' : 'orcamento'); });
    };
    // Do orçamento da tela: salva antes o que estiver mudado (o fechamento usa o que está gravado).
    if (alvo.origem === 'orcamento' && temMudancaNaoSalva()) {
      salvarOrcamento({}).then(function (x) { if (x.r === 'salvo' || x.r === 'semMudanca') { alvo.atualizadoEm = orc.vinculo.atualizadoEm; abrir(); } else avisarSalvamento(x, false); });
    } else abrir();
    return;
  }
  if (acao === 'aberto') {
    var texto = alvo.situacao === 'Fechado' && typeof alvo.valorCombinadoC === 'number'
      ? 'O fechamento de ' + formatarCentavos(alvo.valorCombinadoC) + ' será desfeito.'
      : 'O orçamento volta a ficar em aberto.';
    perguntar('Voltar para Aberto?', texto, [{ chave: 'sim', texto: 'Sim, voltar para Aberto', classe: 'btn-primario' }]).then(function (k) {
      if (k === 'sim') enviarSituacao(alvo, 'Aberto', {}).then(function (ok) { if (ok && nav.tela === 'fechar') sairDoFechamento(); });
    });
    return;
  }
  if (acao === 'duplicar') { duplicarRascunho(); return; }
  if (acao === 'excluir') excluirComDesfazer(alvo);
}

function confirmarNaoFechou() {
  var alvo = menuSit.alvo;
  var deFechar = menuSit.deFechar;
  fecharMenuSituacao();
  enviarSituacao(alvo, 'Não fechou', { motivo: $('motivo-texto').value.trim().slice(0, MAX_MOTIVO) }).then(function (ok) {
    if (ok && deFechar && nav.tela === 'fechar') sairDoFechamento();
  });
}

/** mudarSituacao no servidor + o que muda na tela. @return Promise<boolean> */
/**
 * opcoes (fechamento otimista): aoFalhar() volta o estado da tela antes do aviso; semConexao/falhou: textos do aviso.
 */
function enviarSituacao(alvo, situacao, campos, opcoes) {
  opcoes = opcoes || {};
  var falhou = function () { if (opcoes.aoFalhar) opcoes.aoFalhar(); };
  var txtSemConexao = opcoes.semConexao || 'Sem conexão: a situação NÃO foi mudada.';
  if (!conexao || navigator.onLine === false) { falhou(); mostrarAviso(txtSemConexao, 'alerta'); return Promise.resolve(false); }
  var pedido = { id: alvo.id, atualizadoEmBase: alvo.atualizadoEm, situacao: situacao };
  Object.keys(campos).forEach(function (k) { pedido[k] = campos[k]; });
  return PrecoCertoApi.pedir(conexao, 'mudarSituacao', pedido).then(function (r) {
    if (orc.vinculo && orc.vinculo.id === alvo.id) {
      var naoSalvo = temMudancaNaoSalva();
      orc.vinculo.atualizadoEm = r.atualizadoEm;
      orc.vinculo.situacao = situacao;
      orc.vinculo.motivo = situacao === 'Não fechou' ? (campos.motivo || '') : '';
      orc.vinculo.fechamento = situacao === 'Fechado' ? campos.fechamento : null;
      if (!naoSalvo) orc.vinculo.assinatura = assinaturaDe(usandoFotoGravada());
      gravarRascunho();
      renderOrcamento();
    }
    mostrarAviso(situacao === 'Fechado' ? 'Orçamento fechado ✓' : situacao === 'Aberto' ? 'Voltou para Aberto ✓' : 'Marcado como "Não fechou" ✓');
    resultadosMudaram();
    return true;
  }, function (e) {
    falhou();
    if (e && e.tipo === 'acesso') { perdeuAcesso(); if (opcoes.falhou) mostrarAviso(opcoes.falhou(''), 'alerta'); }
    else if (e && e.tipo === 'conflito') {
      perguntar('Esse orçamento foi alterado em outro aparelho.', 'Nada foi mudado. Veja a versão nova e tente de novo.', []);
      if (orc.vinculo && orc.vinculo.id === alvo.id) buscarOrcamento(alvo.id).then(function (o) { if (o && !temMudancaNaoSalva()) carregarRascunho(rascunhoDoSalvo(o)); });
      resultadosMudaram();
    } else if (e && e.tipo === 'excluido') {
      perguntar('Esse orçamento foi excluído em outro aparelho.', 'A situação não foi mudada.', []);
      desvincularSe(alvo.id);
      resultadosMudaram();
    } else mostrarAviso(e && e.tipo === 'rede' ? txtSemConexao : (opcoes.falhou ? opcoes.falhou(mensagemDoErro(e)) : 'Não mudou: ' + mensagemDoErro(e)), 'alerta');
    return false;
  });
}

// ---------------- Excluir (com DESFAZER) ----------------
/** Some na hora; o pedido só vai ao servidor quando a barra "DESFAZER" some (6 s). */
function excluirComDesfazer(alvo) {
  if (desfazer.timer !== null) finalizarRemocao(); // a remoção anterior vira definitiva
  var item = { id: alvo.id, atualizadoEm: alvo.atualizadoEm, rascunho: null };
  if (alvo.origem === 'orcamento') { item.rascunho = clonar(orc); carregarRascunho(orcamentoVazio()); }
  resul.ocultos[alvo.id] = true;
  resul.aberto = null; // com DESFAZER, o item volta fechado
  if (nav.tela === 'resultados') renderResultados();
  desfazer.tipo = 'orcamento';
  desfazer.item = item;
  desfazer.indice = -1;
  $('aviso').hidden = true;
  $('texto-desfazer').textContent = 'Orçamento excluído';
  $('barra-desfazer').hidden = false;
  desfazer.timer = setTimeout(finalizarRemocao, TEMPO_DESFAZER_MS);
}

function excluirNoServidor(item) {
  if (!conexao) { delete resul.ocultos[item.id]; return; }
  PrecoCertoApi.pedir(conexao, 'excluirOrcamento', { id: item.id, atualizadoEmBase: item.atualizadoEm }).then(function () {
    desvincularSe(item.id);
    delete resul.ocultos[item.id];
    resultadosMudaram();
  }, function (e) {
    delete resul.ocultos[item.id];
    if (item.rascunho && !rascunhoTemConteudo()) carregarRascunho(item.rascunho, true); // não excluiu: o orçamento volta para a tela
    if (e && e.tipo === 'acesso') perdeuAcesso();
    else if (e && e.tipo === 'conflito') perguntar('Esse orçamento foi alterado em outro aparelho.', 'Ele NÃO foi excluído. Veja a versão nova.', []);
    else mostrarAviso(e && e.tipo === 'rede' ? 'Sem conexão: o orçamento NÃO foi excluído.' : 'Não excluiu: ' + mensagemDoErro(e), 'alerta');
    resultadosMudaram();
  });
}

// ---------------- Tela de fechamento ----------------
function abrirFechamento(o, voltarPara) {
  var d = o.dados;
  var cartao = cartaoEfetivo(d.foto.cartoes, d.entrada.bandeira || NAO_SEI);
  var formas = formasDisponiveis(d.foto, cartao);
  fech = {
    o: o, voltarPara: voltarPara, forma: 'pix', cartao: cartao, valorEditado: false,
    parcelas: d.resultado.ancora && formas.parcelas.indexOf(d.resultado.ancora.parcelas) >= 0 ? d.resultado.ancora.parcelas : (formas.parcelas[0] || null),
    entradaTexto: '', formaEntrada: 'pix'
  };
  // Seção 16: orçamento com entrada → já abre em "Entrada + cartão", com a entrada, a forma e as parcelas dele
  var en = lerNumeroBR(d.entrada.entradaTexto);
  if (formas.parcelas.length && typeof en === 'number' && en > 0) {
    fech.forma = 'entrada';
    fech.entradaTexto = numeroParaCampo(en, true);
    fech.formaEntrada = d.entrada.formaEntrada === 'debito' && formas.debito ? 'debito' : 'pix';
    if (formas.parcelas.indexOf(d.entrada.parcelasEntrada) >= 0) fech.parcelas = d.entrada.parcelasEntrada;
  }
  $('fechar-entrada').value = fech.entradaTexto;
  $('fechar-quem').textContent = [o.cliente, d.entrada.descricao].filter(function (s) { return String(s || '').trim(); }).join(' · ') || 'Orçamento sem nome';
  var hoje = dataLocal(new Date());
  $('fechar-data').value = hoje;
  $('fechar-data').max = hoje;
  sugerirValorFechamento();
  nav.voltarFechar = voltarPara;
  empilharHistorico('fechar');
  mostrarTela('fechar');
  window.scrollTo(0, 0);
  renderFechamento();
}

function sugerirValorFechamento() {
  var d = fech.o.dados;
  var le = lerEntradaFechamento();
  var v = fech.forma === 'entrada'
    ? (le.erro ? null : valorSugeridoEntrada(d.entrada, d.foto, d.resultado, fech.parcelas, fech.cartao, le.entradaC))
    : valorSugeridoFechamento(d.entrada, d.foto, d.resultado, fech.forma, fech.parcelas, fech.cartao);
  $('fechar-valor').value = v === null ? '' : numeroParaCampo(v / 100, true);
  mostrarErroCampo($('fechar-valor'), '');
}

function chipsHtml(itens, atributo, selecionado) {
  return itens.map(function (x) {
    return '<button type="button" class="chip" role="radio" ' + atributo + '="' + esc(x[0]) + '" aria-checked="' + (x[0] === selecionado) + '">' + esc(x[1]) + '</button>';
  }).join('');
}

/** Seção 16: a entrada da forma "Entrada + cartão" (0 < E < à vista do orçamento). @return {entradaC, erro} */
function lerEntradaFechamento() {
  if (!fech || fech.forma !== 'entrada') return { entradaC: 0, erro: '' };
  var oferecidoC = fech.o.dados.resultado.oferecidoC;
  var r = validarNumeroCampo(fech.entradaTexto, LIMITE_VALOR_ORCAMENTO, { vazioPermitido: false, mensagem: MSG_VALOR_ORCAMENTO });
  if (r.erro) return { entradaC: 0, erro: String(fech.entradaTexto || '').trim() === '' ? 'Digite o valor da entrada.' : r.erro };
  var c = centavos(r.valor);
  if (!(c > 0)) return { entradaC: 0, erro: 'A entrada precisa ser maior que zero.' };
  if (!(c < oferecidoC)) return { entradaC: c, erro: 'A entrada precisa ser menor que o preço à vista (' + formatarCentavos(oferecidoC) + ').' };
  return { entradaC: c, erro: '' };
}

/** Lê a tela de fechamento e calcula. @return {f, erroValor, erroData, erroEntrada} */
function lerFechamento() {
  var d = fech.o.dados;
  var le = lerEntradaFechamento();
  var rv = validarNumeroCampo($('fechar-valor').value, LIMITE_VALOR_ORCAMENTO, { vazioPermitido: false, mensagem: MSG_VALOR_ORCAMENTO });
  var erroValor = rv.erro || (rv.valor <= 0 ? 'O valor combinado precisa ser maior que zero.' : '');
  if (!erroValor && fech.forma === 'entrada' && !le.erro && !(centavos(rv.valor) > le.entradaC)) erroValor = 'O valor combinado (total) precisa ser maior que a entrada.';
  if (fech.forma === 'entrada' && le.erro && String($('fechar-valor').value).trim() === '') erroValor = ''; // sem entrada ainda: o erro fica só na entrada
  var data = $('fechar-data').value;
  var erroData = !/^\d{4}-\d{2}-\d{2}$/.test(data) ? 'Escolha a data do fechamento.'
    : data > dataLocal(new Date()) ? 'A data do fechamento não pode ser no futuro.'
    : data < '2000-01-01' ? 'Data inválida.' : '';
  var f = erroValor || le.erro || rv.erro || !(rv.valor > 0) ? null
    : calcularFechamento(d.foto, d.resultado, fech.forma, fech.parcelas, fech.cartao, centavos(rv.valor),
      fech.forma === 'entrada' ? { entradaC: le.entradaC, formaEntrada: fech.formaEntrada } : undefined);
  return { f: f, erroValor: erroValor, erroData: erroData, data: data, erroEntrada: le.erro };
}

function renderFechamento() {
  if (!fech) return;
  var d = fech.o.dados;
  $('btn-fechar-nao-fechou').hidden = fech.o.situacao !== 'Aberto';
  $('btn-fechar-voltar-aberto').hidden = fech.o.situacao !== 'Não fechou';
  var foto = d.foto;
  var formas = formasDisponiveis(foto, fech.cartao);
  var opcoes = [['pix', 'Pix/dinheiro']];
  if (formas.debito) opcoes.push(['debito', 'Débito']);
  if (formas.parcelas.length) opcoes.push(['credito', 'Cartão'], ['entrada', 'Entrada + cartão']);
  if (opcoes.every(function (x) { return x[0] !== fech.forma; })) fech.forma = 'pix';
  var comEntrada = fech.forma === 'entrada';
  $('fechar-formas').innerHTML = chipsHtml(opcoes, 'data-fech-forma', fech.forma);
  $('fechar-bloco-parcelas').hidden = fech.forma !== 'credito' && !comEntrada;
  if ((fech.forma === 'credito' || comEntrada) && formas.parcelas.indexOf(fech.parcelas) < 0) fech.parcelas = formas.parcelas[0];
  // Seção 16: entrada (Pix/dinheiro ou débito) + resto no cartão
  $('fechar-bloco-entrada').hidden = !comEntrada;
  if (comEntrada && fech.formaEntrada === 'debito' && !formas.debito) fech.formaEntrada = 'pix';
  $('fechar-formas-entrada').innerHTML = chipsHtml([['pix', 'Pix/dinheiro']].concat(formas.debito ? [['debito', 'Débito']] : []), 'data-fech-forma-entrada', fech.formaEntrada);
  $('fechar-valor-rotulo').textContent = comEntrada ? 'Valor combinado (total: entrada + cartão)' : 'Valor combinado';
  $('fechar-parcelas').innerHTML = chipsHtml(formas.parcelas.map(function (n) { return [String(n), n + 'x']; }), 'data-fech-parcelas', String(fech.parcelas));
  $('fechar-bloco-cartao').hidden = fech.forma === 'pix' || foto.cartoes.length <= 1;
  $('fechar-cartoes').innerHTML = foto.cartoes.length > 1
    ? chipsHtml([[NAO_SEI, 'Não sei']].concat(foto.cartoes.map(function (c) { return [c.nome, c.nome]; })), 'data-fech-cartao', fech.cartao)
    : '';
  var desc = d.resultado.descontoTotal;
  var l = lerFechamento();
  var restoTexto = '';
  if (comEntrada && l.f) restoTexto = 'Resto no cartão: ' + fech.parcelas + 'x de ' + formatarCentavos(centavos((l.f.valorCombinadoC - l.f.entradaC) / 100 / fech.parcelas)) + '.';
  $('fechar-valor-ajuda').textContent = comEntrada
    ? (restoTexto || 'Entrada + o resto no cartão em ' + fech.parcelas + 'x.') + ' Pode mudar o total (ex.: desconto dado na hora): a entrada fica igual.'
    : (fech.forma === 'pix'
    ? (desc > 0 ? 'À vista com ' + (typeof d.resultado.descontoServico === 'number' && d.resultado.descontoServico !== d.resultado.descontoPecas && d.resultado.ancora
        ? formatarCentavos(d.resultado.ancora.totalC - d.resultado.oferecidoC) : formatarPercentual(desc)) + ' de desconto, como no orçamento.' : 'À vista, como no orçamento.')
    : fech.forma === 'debito' ? (d.resultado.ancora ? 'No débito, o mesmo preço do Pix.' : 'Total no débito.')
    : d.resultado.ancora && fech.parcelas < d.resultado.ancora.parcelas ? 'Cartão em ' + fech.parcelas + 'x: o mesmo preço do cartão em ' + d.resultado.ancora.parcelas + 'x.'
    : 'Total no cartão em ' + fech.parcelas + 'x.') +
    ' Pode mudar (ex.: desconto dado na hora).';

  mostrarErroCampo($('fechar-entrada'), comEntrada ? l.erroEntrada : '');
  mostrarErroCampo($('fechar-valor'), l.erroValor);
  mostrarErroCampo($('fechar-data'), l.erroData);
  var f = l.f;
  $('btn-confirmar-fechamento').disabled = !f || !!l.erroData;
  $('card-fechamento').hidden = !f;
  if (!f) return;
  var cor = { verde: 'positivo', ambar: 'ambar', vermelho: 'negativo' }[f.estado];
  // Débito com valor abaixo do preço que cobre a taxa do débito (desconto grande): a mesma faixa do orçamento (seção 15)
  var abaixo = abaixoDoPrecoNoDebito(d.resultado, f);
  $('fech-abaixo').hidden = !abaixo;
  $('fech-abaixo').textContent = abaixo ? 'Com esse valor no débito você cobra ' + formatarCentavos(abaixo) + ' abaixo do seu preço.' : '';
  $('fech-sobra').innerHTML = dinheiroComSinalHtml(f.sobraC);
  $('fech-sobra-linha').className = 'valor-grande ' + cor;
  $('card-fechamento').className = 'card' + (f.estado === 'vermelho' ? ' card-negativo' : f.estado === 'ambar' ? ' card-ambar' : '');
  $('fech-total-seu').hidden = f.totalSeuC === null;
  $('fech-total-seu').innerHTML = f.totalSeuC === null ? '' : 'Total que é seu (casa + sobra): <span class="sem-quebra">' + esc(comSinal(f.totalSeuC)) + '</span>';
  var alerta = $('fech-alerta');
  alerta.hidden = f.estado === 'verde';
  alerta.className = 'alerta' + (f.estado === 'ambar' ? ' alerta-ambar' : '');
  alerta.textContent = f.estado === 'ambar' ? 'Paga a oficina, mas não cobre toda a sua casa.'
    : f.estado === 'vermelho' ? 'Com esse valor a oficina não se paga.' : '';
  var linhas = [
    ['Valor combinado', formatarCentavos(f.valorCombinadoC), comEntrada ? 'entrada ' + formatarCentavos(f.entradaC) + (f.formaEntrada === 'debito' ? ' no débito' : ' no Pix') + ' + ' + formatarCentavos(f.valorCombinadoC - f.entradaC) + ' no cartão' : null],
    ['Taxa da maquininha', menos(f.taxaC)],
    ['Imposto', menos(f.impostoC)],
    ['Peças (o que você pagou)', menos(f.pecasPagarC)]
  ];
  if (f.terceirosPagarC > 0) linhas.push(['Serviços de terceiros (o que você pagou)', menos(f.terceirosPagarC)]);
  linhas.push(['Paga os gastos da oficina', menos(f.pagaOficinaC)]);
  if (f.vaiParaCasaC !== null) linhas.push(['Vai para a sua casa', menos(f.vaiParaCasaC), 'é o seu salário']);
  linhas.push(['Sobra extra', comSinal(f.sobraC), null, 'total']);
  $('fech-detalhes').innerHTML = htmlDetalhes(linhas);
}

function confirmarFechamento() {
  if (!fech) return;
  var l = lerFechamento();
  if (!l.f || l.erroData) { renderFechamento(); return; }
  var fechamento = l.f;
  fechamento.data = l.data;
  var o = fech.o;
  // Seção 14 (tela otimista): volta na hora, já como "Fechado", com "Fechando…" até a confirmação do servidor.
  // Nunca mostra "fechado ✓" antes da resposta. Se falhar, volta o estado anterior e avisa.
  var daTela = !!(orc.vinculo && orc.vinculo.id === o.id);
  var antes = daTela ? clonar(orc.vinculo) : null;
  if (daTela) {
    orc.vinculo.situacao = 'Fechado';
    orc.vinculo.fechamento = fechamento;
    orc.vinculo.motivo = '';
    gravarRascunho();
  }
  sairDoFechamento();
  mostrarAviso('Fechando…', 'fixo');
  situacaoPendente = true;
  renderOrcamento();
  enviarSituacao({ id: o.id, atualizadoEm: o.atualizadoEm }, 'Fechado', { fechamento: fechamento }, {
    aoFalhar: function () {
      if (daTela && orc.vinculo && orc.vinculo.id === o.id) { orc.vinculo = antes; gravarRascunho(); }
    },
    semConexao: 'Sem conexão: o orçamento NÃO foi fechado. Tente de novo.',
    falhou: function (msg) { return 'Não foi fechado. Tente de novo.' + (msg ? ' (' + msg + ')' : ''); }
  }).then(function () {
    situacaoPendente = false;
    renderOrcamento();
    if (nav.tela === 'resultados') resultadosMudaram();
  });
}

/** Sai da tela de fechamento para onde veio (Orçamento ou Resultados). */
function sairDoFechamento() {
  var destino = nav.voltarFechar;
  fech = null;
  if (destino === 'resultados') {
    empilharHistorico('resultados');
    mostrarTela('resultados');
    renderResultados();
    carregarMes();
  } else {
    voltarAoOrcamento(true);
  }
  window.scrollTo(0, 0);
}

// ---------------- Aba Resultados ----------------
function mesAtualLocal() { return dataLocal(new Date()).slice(0, 7); }

/** Tocar em "Resultados" (topo) ou "Ver em Resultados": pede o PIN se ligado e ainda bloqueado. */
function abrirResultados(peloUsuario, mes) {
  if (peloUsuario) usuarioEscolheuTela = true;
  if (mes) resul.mes = mes;
  if (nav.tela === 'resultados') { renderResultados(); carregarMes(); return; }
  if (lerPin() && !desbloqueio.ok) { abrirPin('resultados'); return; }
  empilharHistorico('resultados');
  mostrarResultados();
}

function mostrarResultados() {
  if (!resul.mes) resul.mes = mesAtualLocal();
  mostrarTela('resultados');
  window.scrollTo(0, 0);
  renderResultados();
  carregarMes();
}

/** Algo mudou nos orçamentos: recarrega a lista se a aba estiver aberta. */
function resultadosMudaram() {
  if (nav.tela === 'resultados') carregarMes();
}

/**
 * Carrega o mês em Resultados. Se o aparelho tem a última lista desse mês (desta planilha), ela aparece NA HORA
 * e a resposta do servidor substitui em segundo plano ("Atualizando…"). Seção 14, F1.
 */
function carregarMes() {
  var mes = resul.mes;
  var status = $('res-status');
  if (!conexao) { status.textContent = 'Este aparelho não está ligado a uma planilha.'; return; }
  if (!(resul.dados && resul.dados.mes === mes)) {
    var guardado = resultadosDoAparelho(mes);
    if (guardado) { resul.dados = guardado; renderResultados(); }
  }
  var temNaTela = !!(resul.dados && resul.dados.mes === mes);
  if (navigator.onLine === false) {
    status.textContent = temNaTela ? 'Sem conexão: mostrando a última lista guardada.' : 'Sem conexão: Resultados precisa da internet.';
    return;
  }
  var pedido = ++resul.pedido;
  var usada = conexao;
  status.textContent = temNaTela ? 'Atualizando…' : 'Carregando…';
  PrecoCertoApi.pedir(conexao, 'listarOrcamentos', { mes: mes }).then(function (r) {
    if (pedido !== resul.pedido || conexao !== usada) return; // resposta velha
    resul.dados = r;
    guardarResultadosNoAparelho(r);
    status.textContent = '';
    renderResultados();
  }, function (e) {
    if (pedido !== resul.pedido || conexao !== usada) return;
    if (e && e.tipo === 'acesso') { perdeuAcesso(); status.textContent = 'Este aparelho perdeu o acesso à planilha.'; return; }
    var msg = e && e.tipo === 'rede' ? 'Sem conexão: Resultados precisa da internet.' : 'Não carregou: ' + mensagemDoErro(e);
    if (temNaTela) msg = (e && e.tipo === 'rede' ? 'Sem conexão' : 'Não atualizou') + ': mostrando a última lista guardada.';
    status.innerHTML = esc(msg) + ' <button type="button" class="link link-inline" id="btn-res-tentar">Tentar de novo</button>';
  });
}

function trocarMes(delta) {
  var novo = deslocarMes(resul.mes, delta);
  if (novo > mesAtualLocal()) return;
  resul.mes = novo;
  resul.aberto = null;
  renderResultados();
  carregarMes();
}

/** Valor em reais que nunca quebra no meio ("R$" numa linha e o número na outra). */
function dinheiroHtml(c) { return '<span class="sem-quebra">' + esc(formatarCentavos(c)) + '</span>'; }
function dinheiroComSinalHtml(c) { return '<span class="sem-quebra">' + esc(comSinal(c)) + '</span>'; }

function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

function horasTexto(h) { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(h); }

function renderResultados() {
  var mes = resul.mes || mesAtualLocal();
  var atual = mesAtualLocal();
  $('mes-titulo').textContent = nomeDoMes(mes);
  $('mes-seguinte').disabled = mes >= atual;
  var r = resul.dados && resul.dados.mes === mes ? resul.dados : null;
  $('mes-anterior').disabled = !r || !r.primeiroMes || mes <= r.primeiroMes;
  if (!r) { $('res-conteudo').hidden = true; $('res-vazio').hidden = true; return; }

  var lista = r.orcamentos.filter(function (o) { return !resul.ocultos[o.id]; });
  var doMes = lista.filter(function (o) { return mesDe(o.criadoEm) === mes || (o.situacao === 'Fechado' && mesDe(o.dataFechamento) === mes); });
  if (!doMes.length) {
    $('res-conteudo').hidden = true;
    $('res-vazio').hidden = false;
    $('res-vazio').textContent = 'Nenhum orçamento em ' + nomeDoMes(mes, true) + '. Os orçamentos que você salvar aparecem aqui.';
    return;
  }
  $('res-vazio').hidden = true;
  $('res-conteudo').hidden = false;

  // Mês corrente: sempre os gastos de hoje (a linha do mês na planilha é atualizada pelo servidor).
  // Meses que já passaram: a última foto gravada.
  var corrente = mes === atual;
  var gravada = r.meses[mes] || null;
  var fotoMes = corrente ? r.gastosHoje : gravada;
  var resumo = resumoDoMes(lista, mes, fotoMes);
  var anterior = resumoDoMes(lista, r.mesAnterior, r.meses[r.mesAnterior] || null);
  var curto = nomeDoMes(mes, true);

  // Card principal: barras da oficina e da casa + a frase grande
  var nomeMes = curto.charAt(0).toUpperCase() + curto.slice(1);
  $('titulo-mes-real').textContent = corrente ? nomeMes + ' até agora' : 'Resultado de ' + curto;
  var hoje = new Date();
  $('mes-dia').hidden = !corrente;
  $('mes-dia').textContent = corrente ? 'dia ' + hoje.getDate() + ' de ' + new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate() : '';
  var pm = painelDoMes(resumo, corrente);
  $('mes-sem-foto').hidden = !!pm;
  $('mes-com-foto').hidden = !pm;
  if (pm) {
    $('mes-oficina-txt').innerHTML = pm.oficinaPaga ? '<span class="positivo">✓ paga</span>'
      : dinheiroHtml(pm.oficinaCobertaC) + ' de ' + dinheiroHtml(pm.gastosOficinaC);
    $('mes-oficina-barra').style.width = Math.round(pm.pctOficina * 100) + '%';
    $('mes-oficina-barra').className = 'barra-cheia ' + (pm.oficinaPaga ? 'verde' : 'ambar');
    $('mes-bloco-casa').hidden = !pm.temCasa;
    if (pm.temCasa) {
      var casaToda = pm.pctCasa >= 1;
      $('mes-casa-txt').innerHTML = casaToda ? '<span class="positivo">✓ coberta</span>'
        : dinheiroHtml(pm.casaCobertaC) + ' de ' + dinheiroHtml(pm.gastosCasaC);
      $('mes-casa-barra').style.width = Math.round(pm.pctCasa * 100) + '%';
      $('mes-casa-barra').className = 'barra-cheia ' + (casaToda ? 'verde' : 'ambar');
    }
    $('mes-frase').textContent = fraseDoMes(pm);
    var detalhe = detalheDoMes(pm);
    $('mes-detalhe').hidden = !detalhe;
    $('mes-detalhe').textContent = detalhe;
    $('mes-frase').className = 'frase-mes ' + { verde: 'positivo', ambar: 'ambar', vermelho: 'negativo-discreto' }[pm.frase.tom];
    var q = quantoFaltaTrabalhar(resumo, corrente);
    $('mes-falta-trabalhar').hidden = !q;
    $('mes-falta-trabalhar').innerHTML = q
      ? '<strong>Faltam cerca de ' + esc(plural(q.horas, 'hora', 'horas')) + ' de serviço (' + esc(q.servicos === 1 ? 'um serviço' : 'uns ' + q.servicos + ' serviços') + ' como os deste mês).</strong>' +
        'Você ganha uns ' + dinheiroHtml(q.porHoraC) + ' por hora de serviço, já tirando peças, maquininha e imposto.'
      : '';
    var cmp = compararMeses(resumo, anterior);
    $('mes-comparacao').hidden = !cmp;
    if (cmp) {
      var seta = function (c) { return c >= 0 ? '↑ ' : '↓ '; };
      $('mes-comparacao').innerHTML = 'Comparado com ' + esc(nomeDoMes(r.mesAnterior, true)) + ': entrou <span class="sem-quebra">' + seta(cmp.faturamentoDifC) +
        esc(formatarCentavos(Math.abs(cmp.faturamentoDifC))) + '</span>' + (cmp.faturamentoPct !== null ? ' (' + porcentoInteiro(Math.abs(cmp.faturamentoPct)) + ')' : '') +
        (cmp.sobraDifC !== null ? ' · sobra <span class="sem-quebra">' + seta(cmp.sobraDifC) + esc(formatarCentavos(Math.abs(cmp.sobraDifC))) + '</span>' : '');
    }
  }
  $('card-mes').className = 'card';
  $('mes-gastos').innerHTML = fotoMes
    ? 'Gastos do mês: oficina ' + dinheiroHtml(fotoMes.oficinaC) + ' · casa ' + dinheiroHtml(fotoMes.casaC) + ' · ' + horasTexto(fotoMes.horas) + ' h'
    : '';

  // Orçamentos feitos no mês (pelo mês de criação)
  $('titulo-contagem').textContent = 'Orçamentos feitos em ' + curto;
  $('mes-contagem').textContent = resumo.feitos + ' · ' + plural(resumo.fecharam, 'fechou', 'fecharam') + ' · ' +
    plural(resumo.naoFecharam, 'não fechou', 'não fecharam') + ' · ' + resumo.emAberto + ' em aberto';
  $('mes-taxa-fechamento').textContent = resumo.taxaFechamento === null ? 'Nenhum orçamento feito neste mês.' : 'Fecharam: ' + porcentoInteiro(resumo.taxaFechamento);

  // Extrato do mês (pela data do fechamento), de cima para baixo
  $('titulo-dinheiro').textContent = 'Dinheiro que entrou em ' + curto;
  var extrato = extratoDoMes(resumo) || [
    { rotulo: 'Entrou', valorC: resumo.faturamentoC, tipo: 'entrou' },
    { rotulo: 'Peças', valorC: resumo.pecasC, tipo: 'sai' },
    { rotulo: 'Maquininha', valorC: resumo.taxasC, tipo: 'sai' },
    { rotulo: 'Imposto', valorC: resumo.impostoC, tipo: 'sai' }
  ];
  $('mes-dinheiro').innerHTML = htmlDetalhes(extrato.map(function (l) {
    if (l.tipo === 'entrou') return [l.rotulo, formatarCentavos(l.valorC)];
    if (l.tipo === 'sai') return ['− ' + l.rotulo, formatarCentavos(l.valorC)];
    return ['= ' + l.rotulo, comSinal(l.valorC), null, l.tipo];
  }));

  // Horas
  $('mes-horas').textContent = resumo.horasPossiveis
    ? horasTexto(resumo.horasVendidas) + ' de ' + horasTexto(resumo.horasPossiveis) + ' horas — ' + porcentoInteiro(resumo.pctHoras)
    : horasTexto(resumo.horasVendidas) + ' horas vendidas';
  $('mes-horas-barra').style.width = Math.min(100, Math.round((resumo.pctHoras || 0) * 100)) + '%';

  renderListaResultados(doMes, mes);
}

function renderListaResultados(doMes, mes) {
  var lista = doMes.filter(function (o) {
    return (resul.filtro === 'todos' || o.situacao === resul.filtro) && combinaBusca(o, resul.busca);
  });
  function dataDe(o) { return o.situacao === 'Fechado' && mesDe(o.dataFechamento) === mes ? o.dataFechamento : o.criadoEm; }
  lista.sort(function (a, b) { return dataDe(b) < dataDe(a) ? -1 : dataDe(b) > dataDe(a) ? 1 : 0; });
  document.querySelectorAll('#res-filtros [data-filtro]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.filtro === resul.filtro)); });
  $('res-lista-vazia').hidden = lista.length > 0;
  $('res-lista').innerHTML = lista.map(function (o) {
    var fechado = o.situacao === 'Fechado';
    var valor = fechado ? o.valorCombinadoC : o.valorOrcadoC;
    var aberto = resul.aberto === o.id;
    var outroMes = mesDe(o.criadoEm) !== mes ? ' · orçado em ' + dataBR(o.criadoEm, true) : '';
    return '<div class="item-orc' + (aberto ? ' aberto' : '') + '">' +
      '<button type="button" class="item-orc-topo" data-item="' + esc(o.id) + '" aria-expanded="' + aberto + '">' +
        '<span class="item-linha1"><span class="item-cliente">' + esc(o.cliente || 'Sem nome') + '</span>' + chipSituacao(o.situacao) + '</span>' +
        '<span class="item-linha2">' + esc([o.servico || 'Serviço sem descrição', dataBR(dataDe(o), true), typeof valor === 'number' ? formatarCentavos(valor) : ''].filter(Boolean).join(' · ')) + esc(outroMes) + '</span>' +
      '</button>' +
      (aberto ? '<div class="item-acoes">' +
        '<button type="button" class="btn btn-fantasma btn-curto" data-item-acao="abrir" data-id="' + esc(o.id) + '">Abrir</button>' +
        '<button type="button" class="btn btn-fantasma btn-curto" data-item-acao="situacao" data-id="' + esc(o.id) + '">' + (o.situacao === 'Aberto' ? 'Fechou? / Não fechou?' : 'Mudar situação') + '</button>' +
        '<button type="button" class="btn btn-fantasma btn-curto" data-item-acao="duplicar" data-id="' + esc(o.id) + '">Duplicar</button>' +
        '<button type="button" class="btn btn-fantasma btn-curto btn-texto-perigo" data-item-acao="excluir" data-id="' + esc(o.id) + '">Excluir</button>' +
      '</div>' : '') +
      '</div>';
  }).join('');
}

function itemDaLista(id) {
  var r = resul.dados;
  return r ? r.orcamentos.filter(function (o) { return o.id === id; })[0] || null : null;
}

function acaoDoItem(acao, id) {
  var o = itemDaLista(id);
  if (!o) return;
  resul.aberto = null; // depois de qualquer ação, o card volta fechado
  if (acao === 'abrir') abrirSalvo(id);
  else if (acao === 'duplicar') duplicarSalvo(id);
  else if (acao === 'situacao') abrirMenuSituacao({ id: o.id, atualizadoEm: o.atualizadoEm, situacao: o.situacao, cliente: o.cliente, servico: o.servico, valorCombinadoC: o.valorCombinadoC, origem: 'lista' });
  else if (acao === 'excluir') excluirComDesfazer({ id: o.id, atualizadoEm: o.atualizadoEm, origem: 'lista' });
}

// ---------------- Mês atual acompanha os gastos (DESENHO 12.5 e 14) ----------------
// Desde a seção 14 quem atualiza a linha do mês corrente é o SERVIDOR: o salvarDados (no mesmo lock, quando os totais
// mudam) e o listarOrcamentos (quando a foto do mês corrente difere dos gastos de hoje). A tela não chama mais nada.
function mesmosTotais(a, b) { return !!a && !!b && a.oficinaC === b.oficinaC && a.casaC === b.casaC && a.horas === b.horas; }

// ---------------- Resultados: a última resposta de cada mês fica no aparelho (seção 14, F1) ----------------
var CACHE_RESULTADOS_MESES = 6;

/** Última resposta do listarOrcamentos para o mês, desta mesma planilha (ou null). */
function resultadosDoAparelho(mes) {
  var c = lerStorage(CHAVE_RESULTADOS);
  if (!c || !conexao || c.api !== conexao.api || !c.meses || !c.meses[mes]) return null;
  var r = c.meses[mes].r;
  return r && r.mes === mes && Array.isArray(r.orcamentos) ? r : null;
}

function guardarResultadosNoAparelho(r) {
  if (!conexao || !r || !r.mes) return;
  var c = lerStorage(CHAVE_RESULTADOS);
  if (!c || c.api !== conexao.api || !c.meses) c = { api: conexao.api, meses: {} };
  c.meses[r.mes] = { em: Date.now(), r: r };
  var meses = Object.keys(c.meses).sort(function (a, b) { return c.meses[b].em - c.meses[a].em; });
  meses.slice(CACHE_RESULTADOS_MESES).forEach(function (m) { delete c.meses[m]; });
  gravarStorage(CHAVE_RESULTADOS, c);
}

// ---------------- Ajustes → "Corrigir gastos de um mês passado" ----------------
function abrirCorrigirMes() {
  corrigir.mes = mesAnterior(mesAtualLocal());
  corrigir.dados = null;
  carregarCorrigir();
}

function carregarCorrigir() {
  var mes = corrigir.mes;
  renderCorrigir();
  if (!conexao || navigator.onLine === false) { $('cm-gravados').textContent = 'Sem conexão: isto precisa da internet.'; return; }
  var pedido = ++corrigir.pedido;
  $('cm-gravados').textContent = 'Carregando…';
  PrecoCertoApi.pedir(conexao, 'listarOrcamentos', { mes: mes }).then(function (r) {
    if (pedido !== corrigir.pedido) return;
    corrigir.dados = r;
    renderCorrigir();
  }, function (e) {
    if (pedido !== corrigir.pedido) return;
    if (e && e.tipo === 'acesso') { perdeuAcesso(); return; }
    $('cm-gravados').textContent = e && e.tipo === 'rede' ? 'Sem conexão: isto precisa da internet.' : 'Não carregou: ' + mensagemDoErro(e);
  });
}

function textoTotais(t) {
  return 'oficina ' + dinheiroHtml(t.oficinaC) + ' · casa ' + dinheiroHtml(t.casaC) + ' · ' + horasTexto(t.horas) + ' h';
}

function renderCorrigir() {
  var mes = corrigir.mes;
  if (!mes) return;
  $('cm-mes').textContent = nomeDoMes(mes);
  $('cm-seguinte').disabled = mes >= mesAnterior(mesAtualLocal());
  var r = corrigir.dados && corrigir.dados.mes === mes ? corrigir.dados : null;
  $('cm-anterior').disabled = !r || !r.primeiroMes || mes <= r.primeiroMes;
  $('cm-substituir').hidden = true;
  $('cm-hoje').innerHTML = '';
  if (!r) return;
  var g = r.meses[mes];
  $('cm-gravados').innerHTML = g ? 'Gravados neste mês: ' + textoTotais(g) : 'Sem gastos gravados neste mês.';
  if (mesmosTotais(g, r.gastosHoje)) { $('cm-hoje').textContent = 'Já são iguais aos seus gastos de hoje.'; return; }
  $('cm-hoje').innerHTML = 'Seus gastos de hoje: ' + textoTotais(r.gastosHoje);
  $('cm-substituir').hidden = false;
}

function trocarMesCorrigir(delta) {
  var novo = deslocarMes(corrigir.mes, delta);
  if (novo > mesAnterior(mesAtualLocal())) return;
  corrigir.mes = novo;
  carregarCorrigir();
}

function substituirGastosDoMes() {
  var r = corrigir.dados;
  var mes = corrigir.mes;
  if (!r || r.mes !== mes || !conexao) return;
  var g = r.meses[mes];
  var h = r.gastosHoje;
  var nome = nomeDoMes(mes, true);
  perguntar('Trocar os gastos de ' + nome + '?',
    (g ? 'Hoje estão gravados oficina ' + formatarCentavos(g.oficinaC) + ' e casa ' + formatarCentavos(g.casaC) + '. ' : '') +
    'Passam a ser os seus gastos de hoje: oficina ' + formatarCentavos(h.oficinaC) + ' e casa ' + formatarCentavos(h.casaC) + '. O resultado de ' + nome + ' muda.',
    [{ chave: 'sim', texto: 'Sim, trocar', classe: 'btn-primario' }], 'Cancelar').then(function (k) {
    if (k !== 'sim') return;
    PrecoCertoApi.pedir(conexao, 'usarGastosDeHojeNoMes', { mes: mes }).then(function () {
      mostrarAviso('Gastos de ' + nome + ' corrigidos ✓');
      carregarCorrigir();
    }, function (e) {
      if (e && e.tipo === 'acesso') perdeuAcesso();
      else mostrarAviso(e && e.tipo === 'rede' ? 'Sem conexão: nada foi mudado.' : 'Não mudou: ' + mensagemDoErro(e), 'alerta');
    });
  });
}

// ---------------- Pergunta com botões ----------------
/**
 * Mostra a pergunta e resolve com a chave do botão escolhido (ou null em "Agora não"/Esc).
 * botoes: [{chave, texto, classe?}]; sempre ganha um último "Agora não" (ou "Entendi", se não houver botões).
 */
function perguntar(titulo, texto, botoes, textoCancelar) {
  return new Promise(function (resolver) {
    if (dialogo.resolver) dialogo.resolver(null);
    dialogo.resolver = resolver;
    $('dialogo-titulo').textContent = titulo;
    $('dialogo-texto').textContent = texto || '';
    $('dialogo-texto').hidden = !texto;
    var todos = botoes.concat([{ chave: null, texto: textoCancelar || (botoes.length ? 'Agora não' : 'Entendi') }]);
    $('dialogo-botoes').innerHTML = todos.map(function (b, i) {
      return '<button type="button" class="btn ' + (b.classe || 'btn-fantasma') + '" data-dialogo="' + i + '">' + esc(b.texto) + '</button>';
    }).join('');
    dialogo.botoes = todos;
    $('dialogo').hidden = false;
    $('dialogo-botoes').querySelector('button').focus();
  });
}

function responderDialogo(i) {
  var b = dialogo.botoes[i];
  var resolver = dialogo.resolver;
  dialogo.resolver = null;
  $('dialogo').hidden = true;
  if (resolver) resolver(b ? b.chave : null);
}

// ---------------- Copiar e compartilhar ----------------
function textoAtual() {
  if (!ultimoResultado || !estado.dados) return '';
  // Lista de peças só no modo de lista (no "valor total direto" não há lista).
  // Seção 16: "Serviços inclusos" (sem valores) e a linha da entrada (só com o bloco aberto e a entrada válida)
  var extras = ultimoCalc ? { terceiros: ultimoCalc.lido.terceiros, formaEntrada: ultimoCalc.lido.formaEntrada,
    entrada: ui.entradaAberta && !ultimoResultado.semCartoes ? ultimoCalc.entradaCartao : null } : {};
  // Seção 17: veículo e serviços da oficina (só as descrições)
  extras.veiculo = orc.veiculo;
  extras.servicos = orc.servicos;
  return textoWhatsApp(ultimoResultado, estado.dados.parametros, '', ultimoPreco,
    orc.pecasModo === 'acrescimo' ? ultimasPecas : [], extras);
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

/** "Compartilhar" só no celular (recurso do navegador + tela estreita); acompanha a largura da tela. */
function testarCompartilhar() {
  $('btn-compartilhar').hidden = !podeCompartilhar();
  if (window.matchMedia) {
    var mq = window.matchMedia(TELA_ESTREITA);
    var aoMudar = function () { renderOrcamento(); };
    if (mq.addEventListener) mq.addEventListener('change', aoMudar); else if (mq.addListener) mq.addListener(aoMudar);
  }
}

function compartilhar() {
  var texto = textoAtual();
  if (!texto) return;
  function falhou(e) {
    if (e && e.name === 'AbortError') return; // a pessoa só fechou a janela
    mostrarAviso('Não deu para compartilhar. Use "Copiar para WhatsApp".');
  }
  try { navigator.share({ text: texto }).catch(falhou); } catch (e) { falhou(e); }
  salvarOrcamento({}).then(function (x) { if (x.r !== 'semMudanca') avisarSalvamento(x, false); });
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
/** Remoções que são só do rascunho do orçamento (nada a salvar na planilha). */
function doRascunho(tipo) { return tipo === 'peca' || tipo === 'terceiro' || tipo === 'servico'; }

function listaDoTipo(tipo) {
  if (tipo === 'servico') return orc.servicos;
  if (tipo === 'peca') return orc.pecas;
  if (tipo === 'terceiro') return orc.terceiros;
  return tipo === 'cartao' ? estado.dados.cartoes : estado.dados.gastos;
}

var NOMES_REMOCAO = { gasto: ['Gasto removido', 'Gasto de volta.'], cartao: ['Cartão removido', 'Cartão de volta.'], peca: ['Peça removida', 'Peça de volta.'], terceiro: ['Serviço de parceiro removido', 'Serviço de parceiro de volta.'],
  servico: ['Serviço removido', 'Serviço de volta.'] };

function redesenharDoTipo(tipo) {
  if (tipo === 'servico') { gravarStorage(CHAVE_ORCAMENTO, orc); renderServicos(); }
  else if (tipo === 'peca') { gravarStorage(CHAVE_ORCAMENTO, orc); renderPecas(); }
  else if (tipo === 'terceiro') { gravarStorage(CHAVE_ORCAMENTO, orc); renderTerceiros(); }
  else if (tipo === 'cartao') renderAjustes();
  else renderGastos();
  renderOrcamento();
}

function removerComDesfazer(tipo, indice) {
  if (desfazer.timer !== null) { clearTimeout(desfazer.timer); desfazer.timer = null; } // a anterior vira definitiva
  desfazer.tipo = tipo;
  desfazer.item = listaDoTipo(tipo).splice(indice, 1)[0];
  desfazer.indice = indice;
  if (!doRascunho(tipo)) remocoesNaoSalvas++; // peça/serviço é só do rascunho deste aparelho: nada a salvar na planilha
  if (tipo === 'cartao') ui.cartao = Math.min(indice, estado.dados.cartoes.length - 1);
  redesenharDoTipo(tipo);
  $('aviso').hidden = true;
  $('texto-desfazer').textContent = NOMES_REMOCAO[tipo][0];
  $('barra-desfazer').hidden = false;
  desfazer.timer = setTimeout(finalizarRemocao, TEMPO_DESFAZER_MS);
}

function finalizarRemocao() {
  if (desfazer.timer !== null) { clearTimeout(desfazer.timer); desfazer.timer = null; }
  var tipo = desfazer.tipo, item = desfazer.item;
  desfazer.item = null;
  $('barra-desfazer').hidden = true;
  if (tipo === 'orcamento') { if (item) excluirNoServidor(item); return; } // só agora o pedido vai ao servidor
  if (remocoesNaoSalvas > 0) alterou();
}

function desfazerRemocao() {
  if (!desfazer.item) return;
  if (desfazer.timer !== null) { clearTimeout(desfazer.timer); desfazer.timer = null; }
  var tipo = desfazer.tipo;
  if (tipo === 'orcamento') { // nada foi enviado: só volta a aparecer
    var item = desfazer.item;
    desfazer.item = null;
    $('barra-desfazer').hidden = true;
    delete resul.ocultos[item.id];
    if (item.rascunho) carregarRascunho(item.rascunho, true);
    if (nav.tela === 'resultados') renderResultados();
    mostrarAviso('Orçamento de volta.');
    return;
  }
  var lista = listaDoTipo(tipo);
  var posicao = Math.min(desfazer.indice, lista.length);
  lista.splice(posicao, 0, desfazer.item);
  desfazer.item = null;
  if (tipo === 'cartao') { ui.cartao = posicao; ui.adicionandoCartao = false; }
  $('barra-desfazer').hidden = true;
  redesenharDoTipo(tipo);
  if (doRascunho(tipo)) {
    // só o rascunho do orçamento mudou (já gravado em redesenharDoTipo)
  } else if (remocoesNaoSalvas > 0) {
    remocoesNaoSalvas--;                  // esta remoção nunca foi salva: voltar não precisa salvar
    if (remocoesNaoSalvas > 0) alterou(); // ainda há remoção anterior pendente
    else atualizarStatusSalvamento();
  } else {
    alterou();                            // a remoção já tinha ido num salvamento: salvar a volta
  }
  mostrarAviso(NOMES_REMOCAO[tipo][1]);
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
  ['orcamento', 'resultados', 'fechar', 'pin', 'config', 'gastos', 'ajustes'].forEach(function (t) { $('tela-' + t).hidden = true; });
  desbloqueio.ok = false;
  nav.tela = 'orcamento';
  usuarioEscolheuTela = false; // ao ligar de novo, a tela inicial é escolhida outra vez
  document.body.classList.remove('em-config');
  try { if (history.state && history.state.precoCerto) history.replaceState(null, ''); } catch (e) { /* ignora */ }
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
    if (anterior && anterior.api !== nova.api) {
      apagarStorage(CHAVE_CACHE);
      orc.vinculo = null; // o orçamento salvo era da outra planilha
      gravarRascunho();
      resul.dados = null;
    }
    if (!PrecoCertoConfig.salvar(nova)) return 'Este navegador não deixou guardar a configuração (modo anônimo?).';
    apagarStorage(CHAVE_PIN); // abrir o link de configuração de novo apaga o PIN ("Esqueci o PIN")
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

/**
 * Esquece a planilha neste aparelho: configuração, cache de dados e PIN.
 * Ficam: o rascunho do orçamento e o desconto à vista padrão deste aparelho.
 */
function desconectar() {
  PrecoCertoConfig.apagar();
  apagarStorage(CHAVE_CACHE);
  apagarStorage(CHAVE_PIN);
  apagarStorage(CHAVE_FOTO_PENDENTE); // (versão antiga) a pendência era da planilha desconectada
  apagarStorage(CHAVE_RESULTADOS);    // a lista guardada era da planilha desconectada
  conexao = null;
  estado.dados = null;
  estado.carregadoDoServidor = false;
  estado.urlPlanilha = '';
  cancelarTimer();
  sync.sujo = false; sync.erro = false;
  invalidos = {};
  $('confirma-desconectar').hidden = true;
  $('btn-desconectar').hidden = false;
  $('pin-novo').hidden = true;
  $('fs-gastos').disabled = true;
  $('fs-ajustes').disabled = true;
  mostrarTelaConectar('');
  renderAparelho();
  mostrarAviso('Aparelho desconectado.');
}

function renderAparelho() {
  $('aparelho-planilha').textContent = conexao ? PrecoCertoConfig.finalDaUrl(conexao.api) : '—';
  var pwa = PrecoCertoPwa.estado;
  $('aparelho-versao').textContent = pwa.versao || '—';
  $('btn-instalar').hidden = !pwa.podeInstalar;
  renderPin();
}

// ---------------- PIN (opcional; só deste aparelho) ----------------
function renderPin() {
  var ligado = !!lerPin();
  $('pin-situacao').textContent = ligado
    ? 'Ligado: Resultados e a engrenagem pedem o PIN.'
    : 'Desligado: qualquer pessoa com o aparelho abre as configurações.';
  $('btn-pin-ligar').hidden = ligado || !$('pin-novo').hidden;
  $('btn-pin-desligar').hidden = !ligado;
}

function abrirNovoPin() {
  $('pin-novo-1').value = '';
  $('pin-novo-2').value = '';
  $('pin-novo-erro').textContent = '';
  $('pin-novo').hidden = false;
  renderPin();
  $('pin-novo-1').focus();
}

function fecharNovoPin() {
  $('pin-novo').hidden = true;
  renderPin();
}

function salvarNovoPin() {
  var a = $('pin-novo-1').value.trim();
  var b = $('pin-novo-2').value.trim();
  var erro = !/^\d{4}$/.test(a) ? 'O PIN tem 4 números.' : a !== b ? 'Os dois PINs não são iguais.' : '';
  $('pin-novo-erro').textContent = erro;
  if (erro) return;
  if (!gravarTexto(CHAVE_PIN, a)) { $('pin-novo-erro').textContent = 'Este navegador não deixou guardar o PIN.'; return; }
  desbloqueio.ok = true; // quem acabou de criar o PIN já está dentro
  fecharNovoPin();
  mostrarAviso('PIN ligado neste aparelho.');
}

function desligarPin() {
  apagarStorage(CHAVE_PIN);
  renderPin();
  mostrarAviso('PIN desligado.');
}

// ------------------------------------------------------------------
// Dicas "?" — abrem por toque/clique (não por "passar o mouse", que não existe no celular).
// Uma aberta por vez; fecham com novo toque, toque fora ou Esc.
// ------------------------------------------------------------------
var DICAS = {
  servico: { alvo: '#titulo-servico', nome: 'Fica para você neste serviço',
    texto: 'Sua hora já inclui os gastos da oficina e os da sua casa. O número grande é o total que é seu: o seu salário (a parte da casa) mais a sobra extra. Embaixo, quanto fica se o cliente pagar no cartão. Orçamento fechado: a conta é com a forma e o valor do fechamento.' },
  acrescimo: { alvo: 'label[for="p-acrescimoPecasPadrao"]', nome: 'Acréscimo padrão nas peças',
    texto: 'Quanto você põe em cima do preço que paga pela peça. Ex.: paga R$ 100 com 47%, o cliente paga R$ 147. Cada orçamento novo começa com este número. Dá para mudar só naquele orçamento, no campo "Quanto você põe em cima da peça", ou peça por peça, no "% em cima" da linha.' },
  imposto: { alvo: '#rotulo-impostos', nome: 'Imposto',
    texto: 'Peças e serviço costumam ter impostos diferentes. Confirme os percentuais com o seu contador. MEI: deixe 0 nos dois e coloque o DAS em Meus gastos.' },
  parcelas: { alvo: 'label[for="p-parcelasDestaque"]', nome: 'Parcelas que aparecem no orçamento',
    texto: 'Quais parcelas do cartão aparecem em destaque no orçamento e no WhatsApp. Ex.: "5,10" mostra 5x e 10x. A primeira (5x) é o preço cheio do cartão, e o desconto à vista é calculado em cima dela. No débito e no Pix o preço é o mesmo. No cartão, até 5x o preço é o mesmo; acima disso fica mais caro. As demais formas ficam em "Ver outras formas de pagamento".' },
  nomeOficina: { alvo: 'label[for="p-nomeOficina"]', nome: 'Nome da oficina',
    texto: 'Aparece no título do texto do WhatsApp: "*Orçamento – CliniCar Motors Tech*". Se ficar vazio, o título fica só "*Orçamento*".' },
  horasCobradas: { alvo: 'label[for="p-horasCobradasPorDia"]', nome: 'Horas que você cobra por dia',
    texto: 'Das horas que você trabalha, quantas viram serviço cobrado do cliente? O resto vai em orçamento, busca de peça, espera… Normalmente 6 de 8. Quanto menor esse número, mais a sua hora precisa valer.' },
  valorHora: { alvo: 'label[for="p-valorHoraCobrado"]', nome: 'Quanto você vai cobrar por hora',
    texto: 'Quanto você cobra por hora de serviço. Precisa ser maior que "Sua hora precisa valer no mínimo", logo acima: a diferença é a sua sobra extra em cada hora. Ex.: mínimo R$ 33,08 e você cobra R$ 165, sobram R$ 131,92 por hora.' },
  desconto: { alvo: 'label[for="orc-desconto"]', nome: 'Desconto à vista', texto: function () {
    var ate = ultimoPreco && ultimoPreco.temAncora
      ? 'Neste orçamento, até ' + formatarPercentual(Math.round(ultimoPreco.maximo * 100) / 100) + ' você não perde nada'
      : 'Até a taxa do cartão em destaque você não perde nada';
    var ref = ultimoPreco && ultimoPreco.temAncora ? ultimoPreco.ancora.parcelas : 5;
    return 'Desconto para quem paga no Pix, dinheiro ou débito, em cima do preço do cartão. ' + ate +
      ', porque não paga a maquininha. No débito e no Pix o preço é o mesmo. No cartão, até ' + ref + 'x o preço é o mesmo; acima disso fica mais caro. ' +
      'Já vem com o seu número de sempre (Ajustes → Outros ajustes). O cliente pediu mais? Toque em "O cliente pediu mais desconto?".';
  } },
  extra: { alvo: 'label[for="orc-extra"]', nome: 'Desconto extra',
    texto: 'Se o cliente pedir um pouco mais. Soma com o desconto à vista (5% + 2% = 7%). Com desconto diferente nas peças, o extra vale só para o serviço. O app mostra até onde dá para ir sem perder nada. Passou disso, avisa em vermelho: "Com esse desconto você cobra R$ X abaixo do seu preço."' },
  cartoes: { alvo: '#titulo-cartoes', nome: 'Seus cartões',
    texto: 'As taxas que a maquininha cobra em cada parcela (Débito, 1x … 12x). Copie da calculadora de taxas do app da maquininha, um cartão de cada vez. Campo vazio = essa parcela não aparece no orçamento. Vazio é diferente de 0: 0 quer dizer "sem taxa".' },
  descontoPadrao: { alvo: 'label[for="p-descontoAVistaPadrao"]', nome: 'Desconto à vista padrão',
    texto: 'O desconto que todo orçamento novo já traz para Pix ou dinheiro. Ex.: 5. Vale para todos os aparelhos ligados a esta planilha. Em cada orçamento dá para mudar só naquele.' },
  pin: { alvo: '#rotulo-pin', nome: 'Proteger com PIN',
    texto: 'Pede 4 números para abrir Resultados, Meus gastos e Ajustes neste aparelho. Depois de digitar, fica liberado enquanto o app estiver aberto; se ficar mais de 5 minutos fora do app, pede de novo. Serve para ninguém mexer sem querer: não é uma senha forte. Esqueceu? Na tela do PIN, toque em "Esqueci o PIN".' },
  mesReal: { alvo: '#titulo-mes-real', nome: 'Resultado do mês',
    texto: 'Cada orçamento supõe que você vendeu todas as horas do mês. Aqui é o que aconteceu de verdade: o que entrou nos fechamentos, menos peças, maquininha e imposto, paga primeiro a oficina e depois a sua casa. "Pagar o mês" é pagar as duas: os gastos da oficina e a sua casa (o seu salário). Por isso, quando falta, o valor grande é o total que falta, e embaixo aparece quanto é de cada uma. O mês atual usa sempre os seus gastos de hoje; os meses que já passaram ficam como estavam.' },
  contagem: { alvo: '#titulo-contagem', nome: 'Orçamentos feitos',
    texto: 'Dos orçamentos feitos neste mês, quantos o cliente aceitou. Um orçamento feito em outubro e fechado em novembro conta como feito em outubro, mas o dinheiro entra em novembro.' },
  dinheiro: { alvo: '#titulo-dinheiro', nome: 'Dinheiro que entrou',
    texto: 'O caminho do dinheiro no mês, de cima para baixo: o que entrou nos orçamentos fechados, menos peças, maquininha e imposto, menos os gastos da oficina, e o que ficou para a casa. Um orçamento feito em outubro e fechado em novembro conta como feito em outubro, mas o dinheiro entra em novembro.' },
  gastos: { alvo: '#titulo-gastos-oficina', nome: 'Meus gastos',
    texto: 'Os gastos que se repetem todo mês. O mês atual, em Resultados, usa sempre estes valores; os meses que já passaram ficam como estavam. Se um gasto só começa no mês que vem (ex.: aumento do aluguel), lance no dia 1º.' },
  horas: { alvo: '#titulo-horas', nome: 'Horas',
    texto: 'Horas dos serviços fechados neste mês, comparadas com as horas que você pode cobrar no mês (Meus gastos → Sua rotina).' },
  fechamento: { alvo: '#titulo-fechamento', nome: 'Neste fechamento',
    texto: 'Valor combinado menos a taxa da maquininha da forma escolhida, o imposto, as peças e a parte da oficina e da sua casa.' }
};

function textoDaDica(chave) {
  var t = DICAS[chave].texto;
  return typeof t === 'function' ? t() : t;
}

/** Põe o botão "?" ao lado de cada rótulo e o balão (escondido) logo abaixo. */
function montarDicas() {
  Object.keys(DICAS).forEach(function (chave) {
    var alvo = document.querySelector(DICAS[chave].alvo);
    if (!alvo || alvo.parentNode.classList.contains('rotulo-dica')) return;
    var linha = document.createElement('div');
    linha.className = 'rotulo-dica' + (alvo.classList.contains('card-titulo') ? ' de-titulo' : '');
    alvo.parentNode.insertBefore(linha, alvo);
    linha.appendChild(alvo);
    var botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'btn-dica';
    botao.id = 'btn-dica-' + chave;
    botao.dataset.dica = chave;
    botao.setAttribute('aria-label', 'O que é "' + DICAS[chave].nome + '"?');
    botao.setAttribute('aria-expanded', 'false');
    botao.setAttribute('aria-controls', 'dica-' + chave);
    botao.innerHTML = '<span aria-hidden="true">?</span>';
    linha.appendChild(botao);
    var balao = document.createElement('div');
    balao.className = 'balao-dica';
    balao.id = 'dica-' + chave;
    balao.setAttribute('role', 'note');
    balao.hidden = true;
    // Nos dois campos lado a lado (desconto e extra), o balão vai embaixo dos dois, na largura toda do card.
    var lado = linha.closest('.campos-desconto');
    if (lado) lado.parentNode.insertBefore(balao, lado.nextSibling);
    else linha.parentNode.insertBefore(balao, linha.nextSibling);
  });
}

function alternarDica(chave) {
  var balao = $('dica-' + chave);
  var abrir = balao.hidden;
  fecharDicas(false);
  if (!abrir) return;
  balao.textContent = textoDaDica(chave);
  balao.hidden = false;
  $('btn-dica-' + chave).setAttribute('aria-expanded', 'true');
}

/** Fecha a dica aberta. @return true se havia uma aberta */
function fecharDicas(devolverFoco) {
  var aberta = document.querySelector('.btn-dica[aria-expanded="true"]');
  if (!aberta) return false;
  aberta.setAttribute('aria-expanded', 'false');
  $('dica-' + aberta.dataset.dica).hidden = true;
  if (devolverFoco) aberta.focus();
  return true;
}

/** A dica do desconto à vista depende do orçamento: atualiza se estiver aberta. */
function atualizarDicaDesconto() {
  var b = $('dica-desconto');
  if (b && !b.hidden) b.textContent = textoDaDica('desconto');
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
    else if (el.dataset.pecaCampo) onPecaInput(el);
    else if (el.dataset.terceiroCampo) onTerceiroInput(el);
    else if (el.dataset.servicoCampo) onServicoInput(el);
    else if (el.dataset.veiculo) onVeiculoInput(el);
    else if (el.dataset.orc) { if (el.id === 'orc-telefone') mascararTelefone(el, e.inputType || ''); onOrcamentoInput(el); }
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
    if (ds.abaConfig) { trocarAbaConfig(ds.abaConfig); return; }
    if (ds.ir) { abrirConfig(ds.ir, true); return; }
    if (ds.adicionar) { adicionarGasto(ds.adicionar, ''); return; }
    if (ds.sugestao) { adicionarGasto(ds.tipo, ds.sugestao); return; }
    if (ds.dica) { alternarDica(ds.dica); return; }
    if (ds.dialogo !== undefined) { responderDialogo(Number(ds.dialogo)); return; }
    if (ds.sit) { escolherNoMenuSituacao(ds.sit); return; }
    if (ds.motivo) { $('motivo-texto').value = ds.motivo; return; }
    if (ds.item) { resul.aberto = resul.aberto === ds.item ? null : ds.item; renderResultados(); return; }
    if (ds.itemAcao) { acaoDoItem(ds.itemAcao, ds.id); return; }
    if (ds.filtro) { resul.filtro = ds.filtro; resul.aberto = null; renderResultados(); return; }
    if (ds.fechForma && fech) { fech.forma = ds.fechForma; renderFechamento(); if (!fech.valorEditado) { sugerirValorFechamento(); renderFechamento(); } return; }
    if (ds.fechParcelas && fech) { fech.parcelas = Number(ds.fechParcelas); if (!fech.valorEditado) sugerirValorFechamento(); renderFechamento(); return; }
    if (ds.fechCartao !== undefined && fech) { fech.cartao = ds.fechCartao; if (!fech.valorEditado) sugerirValorFechamento(); renderFechamento(); return; }
    if (ds.fechFormaEntrada && fech) { fech.formaEntrada = ds.fechFormaEntrada; renderFechamento(); return; }
    if (ds.voltarAcr !== undefined) { voltarAcrescimoPeca(Number(ds.voltarAcr)); return; }
    if (ds.removerTerceiro !== undefined) { if (!travado()) removerComDesfazer('terceiro', Number(ds.removerTerceiro)); return; }
    if (ds.removerServico !== undefined) { if (!travado()) removerComDesfazer('servico', Number(ds.removerServico)); return; }
    if (ds.combustivel) { escolherCombustivel(ds.combustivel); return; }
    if (ds.formaEntrada && !travado()) { orc.formaEntrada = ds.formaEntrada; gravarRascunho(); renderOrcamento(); return; }
    if (ds.parcelasEntrada && !travado()) { orc.parcelasEntrada = Number(ds.parcelasEntrada); gravarRascunho(); renderOrcamento(); return; }
    if (alvo.id === 'btn-res-tentar') { carregarMes(); return; }
    if (ds.remover !== undefined) { removerComDesfazer('gasto', Number(ds.remover)); return; }
    if (ds.removerPeca !== undefined) { removerComDesfazer('peca', Number(ds.removerPeca)); return; }
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
      if (travado() || !ultimoCalc) return;
      orc.bandeira = i < 0 ? NAO_SEI : ultimoCalc.ctx.cartoes[i].nome;
      gravarStorage(CHAVE_ORCAMENTO, orc);
      renderOrcamento();
      var chip = document.querySelector('[data-bandeira-indice="' + i + '"]');
      if (chip) chip.focus();
    }
  });

  $('ir-pecas-valor').addEventListener('click', function () { trocarModoPecas('valor'); });
  $('ir-pecas-acrescimo').addEventListener('click', function () { trocarModoPecas('acrescimo'); });
  $('btn-novo').addEventListener('click', aoClicarNovo);

  // Copiar SEMPRE copia primeiro (não espera a rede); depois salva o orçamento (automático).
  $('btn-copiar').addEventListener('click', function () {
    var texto = textoAtual();
    if (!texto) return;
    copiarTexto(texto).then(function (r) {
      var p = salvarOrcamento({});
      if (salvandoOrc) mostrarAviso((r === 'ok' ? 'Copiado ✓ · ' : '') + 'Salvando…', 'fixo');
      p.then(function (x) { avisarSalvamento(x, r === 'ok'); });
    });
  });
  $('btn-salvar-orc').addEventListener('click', aoClicarSalvar);
  $('btn-mudar-situacao').addEventListener('click', function () { if (orc.vinculo) abrirMenuSituacao(alvoDoRascunho()); });
  $('btn-fechou').addEventListener('click', clienteFechou);
  $('btn-duplicar-fechado').addEventListener('click', duplicarRascunho);
  $('btn-duplicar-nao-fechou').addEventListener('click', duplicarRascunho);
  $('btn-voltar-aberto').addEventListener('click', function () { if (orc.vinculo) voltarParaAberto(alvoDoRascunho()); });
  $('btn-mais-desconto').addEventListener('click', function () {
    ui.maisDesconto = true;
    renderOrcamento();
    $('orc-extra').focus();
  });
  $('btn-fechar-nao-fechou').addEventListener('click', function () { if (fech) abrirNaoFechou(alvoDoFechamento()); });
  $('btn-fechar-voltar-aberto').addEventListener('click', function () { if (fech) voltarParaAberto(alvoDoFechamento()); });
  $('corrigir-mes').addEventListener('toggle', function () { if ($('corrigir-mes').open) abrirCorrigirMes(); });
  $('cm-anterior').addEventListener('click', function () { trocarMesCorrigir(-1); });
  $('cm-seguinte').addEventListener('click', function () { trocarMesCorrigir(1); });
  $('cm-substituir').addEventListener('click', substituirGastosDoMes);
  $('btn-recalcular').addEventListener('click', recalcularComHoje);
  $('btn-ver-resultados').addEventListener('click', function () { if (orc.vinculo) abrirResultados(true, mesDe(orc.vinculo.criadoEm)); });
  $('aba-orcamento').addEventListener('click', irParaOrcamento);
  $('aba-resultados').addEventListener('click', function () { abrirResultados(true); });
  $('mes-anterior').addEventListener('click', function () { trocarMes(-1); });
  $('mes-seguinte').addEventListener('click', function () { trocarMes(1); });
  $('res-busca').addEventListener('input', function (e) { resul.busca = e.target.value; resul.aberto = null; renderResultados(); });
  $('btn-fechar-menu-situacao').addEventListener('click', fecharMenuSituacao);
  $('btn-confirmar-nao-fechou').addEventListener('click', confirmarNaoFechou);
  $('btn-voltar-fechar').addEventListener('click', sairDoFechamento);
  $('btn-confirmar-fechamento').addEventListener('click', confirmarFechamento);
  $('fechar-valor').addEventListener('input', function () { if (fech) { fech.valorEditado = true; renderFechamento(); } });
  $('fechar-data').addEventListener('input', function () { if (fech) renderFechamento(); });
  $('btn-compartilhar').addEventListener('click', compartilhar);
  $('btn-recarregar-planilha').addEventListener('click', recarregarDaPlanilha);
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

  // Engrenagem, Configurações e PIN
  $('btn-engrenagem').addEventListener('click', function () { abrirConfig(nav.aba, true); });
  $('btn-voltar-orcamento').addEventListener('click', function () { voltarAoOrcamento(true); });
  window.addEventListener('popstate', aoVoltarHistorico);
  // Link de configuração aberto com o app já aberto na mesma aba (só muda o "#"): o navegador não recarrega.
  window.addEventListener('hashchange', function () {
    if (window.location.hash.indexOf('#cfg=') === 0) processarLinkDeConfiguracao();
  });
  $('btn-adicionar-servico').addEventListener('click', adicionarServico);
  $('btn-adicionar-peca').addEventListener('click', adicionarPeca);
  $('btn-adicionar-terceiro').addEventListener('click', adicionarTerceiro);
  $('btn-entrada').addEventListener('click', abrirEntrada);
  $('btn-desconto-pecas').addEventListener('click', function () {
    if (ultimoCalc && ultimoCalc.lido.descontoSeparado) fecharDescontoPecas(); else abrirDescontoPecas();
  });
  $('btn-tirar-entrada').addEventListener('click', tirarEntrada);
  $('fechar-entrada').addEventListener('input', function () {
    if (!fech) return;
    fech.entradaTexto = $('fechar-entrada').value;
    if (!fech.valorEditado) sugerirValorFechamento(); // o total editado à mão fica; muda só o resto no cartão
    renderFechamento();
  });
  // Dica aberta: toque/clique fora fecha.
  document.addEventListener('click', function (e) {
    if (!e.target.closest || e.target.closest('.btn-dica, .balao-dica')) return;
    fecharDicas(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('dialogo').hidden) { responderDialogo(-1); return; }
    if (e.key === 'Escape' && !$('menu-situacao').hidden) { fecharMenuSituacao(); return; }
    if (e.key === 'Escape' && fecharDicas(true)) return; // Esc fecha primeiro a dica aberta
    if (e.key === 'Escape' && nav.tela === 'fechar') { sairDoFechamento(); return; }
    if (e.key !== 'Escape' || nav.tela === 'orcamento' || document.body.classList.contains('sem-conexao')) return;
    if (!$('caixa-copia').hidden) return; // Esc fecha primeiro a caixa de copiar, se aberta
    voltarAoOrcamento(true);
  });
  $('btn-pin-entrar').addEventListener('click', conferirPin);
  $('pin-entrada').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); conferirPin(); }
  });
  $('pin-entrada').addEventListener('input', function () {
    $('pin-erro').textContent = '';
    $('pin-entrada').classList.remove('invalido');
  });
  $('btn-pin-cancelar').addEventListener('click', function () { voltarAoOrcamento(true); });
  $('btn-pin-esqueci').addEventListener('click', function () { $('pin-esqueci').hidden = !$('pin-esqueci').hidden; });
  $('btn-pin-desconectar').addEventListener('click', function () {
    $('pin-confirma-desconectar').hidden = false;
    $('btn-pin-desconectar').hidden = true;
    $('btn-pin-desconectar-sim').focus();
  });
  $('btn-pin-desconectar-nao').addEventListener('click', function () {
    $('pin-confirma-desconectar').hidden = true;
    $('btn-pin-desconectar').hidden = false;
  });
  $('btn-pin-desconectar-sim').addEventListener('click', desconectar);
  $('btn-pin-ligar').addEventListener('click', abrirNovoPin);
  $('btn-pin-cancelar-novo').addEventListener('click', fecharNovoPin);
  $('btn-pin-salvar').addEventListener('click', salvarNovoPin);
  $('btn-pin-desligar').addEventListener('click', desligarPin);

  document.addEventListener('visibilitychange', aoMudarVisibilidade);
  window.addEventListener('pagehide', salvarAoSair);
  $('btn-desfazer').addEventListener('click', desfazerRemocao);
}

// ------------------------------------------------------------------
// Início
// ------------------------------------------------------------------
function iniciar() {
  $('logo-carregando').src = $('logo').src;
  montarDicas();
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
