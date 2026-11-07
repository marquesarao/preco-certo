/* =====================================================================
   Chamada à API da planilha (Apps Script /exec). Mesmo padrão do app Pendências:
   - só POST, corpo JSON enviado como TEXTO (Content-Type text/plain) → sem preflight de CORS;
   - o fetch segue sozinho o redirecionamento do Apps Script para script.googleusercontent.com;
   - a resposta é lida como texto e depois JSON (página HTML do Google = configuração errada);
   - tempo limite de 30 s.
   Erros viram Error com .tipo: 'rede' | 'acesso' (token inválido) | 'servidor'.
   ===================================================================== */
var PrecoCertoApi = (function () {
  'use strict';

  var TEMPO_LIMITE_MS = 30000;
  var MSG_SEM_ACESSO = 'Acesso não autorizado'; // igual ao backend (MSG_SEM_ACESSO_)

  function erro(mensagem, tipo) {
    var e = new Error(mensagem);
    e.tipo = tipo;
    return e;
  }

  /**
   * @param conexao {api, token}
   * @param acao 'obterDados' | 'salvarDados' | 'obterTaxasPadraoVisa'
   * @param dados (só para salvarDados)
   * @return Promise do JSON de resposta (sempre com ok:true; senão rejeita)
   */
  function chamar(conexao, acao, dados) {
    var corpo = { token: conexao.token, action: acao };
    if (dados !== undefined) corpo.dados = dados;
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TEMPO_LIMITE_MS);

    return fetch(conexao.api, {
      method: 'POST',
      body: JSON.stringify(corpo), // string → text/plain;charset=UTF-8
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (resp) { return resp.text(); }, function (e) {
        if (e && e.name === 'AbortError') throw erro('A planilha demorou demais para responder. Tente de novo.', 'rede');
        throw erro(navigator.onLine === false ? 'Sem conexão.' : 'Não foi possível falar com a planilha. Confira a internet.', 'rede');
      })
      .then(function (texto) {
        var json;
        try { json = JSON.parse(texto); } catch (e) {
          throw erro('Resposta inesperada da planilha. Confira se a implantação está como "Qualquer pessoa" e se o endereço termina em /exec.', 'servidor');
        }
        if (!json || json.ok !== true) {
          var msg = (json && typeof json.erro === 'string' && json.erro) || 'Erro desconhecido na planilha.';
          throw erro(msg, msg === MSG_SEM_ACESSO ? 'acesso' : 'servidor');
        }
        return json;
      })
      .then(function (json) { clearTimeout(timer); return json; }, function (e) { clearTimeout(timer); throw e; });
  }

  return { chamar: chamar, MSG_SEM_ACESSO: MSG_SEM_ACESSO };
})();
