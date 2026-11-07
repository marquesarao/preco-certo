/* =====================================================================
   Conexão DESTE aparelho com a planilha do dono: URL da API (/exec) e token.
   Ficam só no localStorage do aparelho — nunca em arquivos do projeto.
   Link de configuração: <app>#cfg=<base64url de {"api":"…/exec","token":"…"}>
   (gerado por gerarLinkDeConfiguracao() no Apps Script; a parte depois do "#"
   não é enviada a nenhum servidor).
   Script comum (sem módulos): também é carregado pelos testes em Node.
   ===================================================================== */
var PrecoCertoConfig = (function () {
  'use strict';

  var CHAVE = 'precoCerto.conexao.v1';
  /** Mesmo formato validado no backend (URL_API_VALIDA_). */
  var URL_VALIDA = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
  var TOKEN_VALIDO = /^[A-Za-z0-9_-]{32,256}$/;
  var ERRO_LINK = 'O link de configuração está incompleto ou foi copiado errado. Peça um link novo.';

  function urlValida(url) { return typeof url === 'string' && URL_VALIDA.test(url.trim()); }
  function tokenValido(token) { return typeof token === 'string' && TOKEN_VALIDO.test(token.trim()); }

  /** base64url (com ou sem "=") → texto UTF-8. null se não for base64url válido. */
  function decodificarBase64Url(s) {
    if (typeof s !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(s)) return null;
    var b64 = s.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
    if (b64.length % 4 === 1) return null;
    while (b64.length % 4) b64 += '=';
    try {
      var binario = atob(b64);
      var bytes = new Uint8Array(binario.length);
      for (var i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      return null;
    }
  }

  /**
   * Lê o "#cfg=…" do endereço.
   * @return null (não é link de configuração) | {ok:true, config:{api, token}} | {ok:false, erro}
   */
  function lerLinkDeConfiguracao(hash) {
    var m = /^#?cfg=(.*)$/.exec(hash || '');
    if (!m) return null;
    var texto = decodificarBase64Url(m[1]);
    if (texto === null) return { ok: false, erro: ERRO_LINK };
    var obj;
    try { obj = JSON.parse(texto); } catch (e) { return { ok: false, erro: ERRO_LINK }; }
    if (!obj || typeof obj !== 'object') return { ok: false, erro: ERRO_LINK };
    if (!urlValida(obj.api)) return { ok: false, erro: 'O link não tem um endereço de planilha válido. Peça um link novo.' };
    if (!tokenValido(obj.token)) return { ok: false, erro: 'O link não tem uma chave de acesso válida. Peça um link novo.' };
    return { ok: true, config: { api: obj.api.trim(), token: obj.token.trim() } };
  }

  /** Configuração manual (colar URL e token): mesmas regras do link. */
  function validarManual(api, token) {
    if (!urlValida(api)) return 'Cole a URL completa da planilha: começa com https://script.google.com/macros/s/ e termina em /exec.';
    if (!tokenValido(token)) return 'Cole a chave de acesso completa (pelo menos 32 letras e números, sem espaços).';
    return '';
  }

  function ler() {
    try {
      var c = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      return c && urlValida(c.api) && tokenValido(c.token) ? { api: c.api, token: c.token } : null;
    } catch (e) {
      return null;
    }
  }

  function salvar(config) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ api: config.api, token: config.token }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function apagar() {
    try { localStorage.removeItem(CHAVE); } catch (e) { /* ignora */ }
  }

  /** Final da URL para mostrar em Ajustes, sem revelar o endereço inteiro: "…/s/…a1B2c3/exec". */
  function finalDaUrl(api) {
    var m = /\/s\/([\w-]+)\/exec$/.exec(api || '');
    return m ? '…/s/…' + m[1].slice(-6) + '/exec' : '';
  }

  return {
    URL_VALIDA: URL_VALIDA,
    urlValida: urlValida,
    tokenValido: tokenValido,
    decodificarBase64Url: decodificarBase64Url,
    lerLinkDeConfiguracao: lerLinkDeConfiguracao,
    validarManual: validarManual,
    ler: ler,
    salvar: salvar,
    apagar: apagar,
    finalDaUrl: finalDaUrl
  };
})();
