/* =====================================================================
   PWA: registro do service worker, aviso de nova versão e instalação.
   Mesmo comportamento do app Pendências:
   - versão nova publicada → "Nova versão disponível · ATUALIZAR"; só recarrega quando a pessoa toca;
   - botão "Instalar app" quando o navegador oferece (beforeinstallprompt), com um aviso único.
   ===================================================================== */
var PrecoCertoPwa = (function () {
  'use strict';

  var CHAVE_AVISO_INSTALAR = 'precoCerto.avisoInstalar';
  var estado = { versao: '', atualizacao: false, podeInstalar: false, instalado: false };
  var ouvintes = [];
  var registro = null;
  var esperando = null;   // service worker novo, instalado e esperando
  var atualizando = false; // só recarrega quando a própria pessoa pediu
  var pedidoInstalacao = null;
  var aoNovaVersao = function () {};
  var aoSugerirInstalar = function () {};

  function avisar() { ouvintes.forEach(function (fn) { fn(estado); }); }
  function modoApp() {
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }

  /** @param op {aoMudar(estado), aoNovaVersao(), aoSugerirInstalar()} */
  function iniciar(op) {
    if (op.aoMudar) ouvintes.push(op.aoMudar);
    if (op.aoNovaVersao) aoNovaVersao = op.aoNovaVersao;
    if (op.aoSugerirInstalar) aoSugerirInstalar = op.aoSugerirInstalar;
    estado.instalado = modoApp();
    iniciarInstalacao();
    if (!('serviceWorker' in navigator)) { avisar(); return; }

    // Caminho relativo: o escopo é a pasta do app (/preco-certo/ no GitHub Pages).
    // updateViaCache 'none': a checagem de versão do sw.js nunca usa o cache HTTP.
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
      registro = reg;
      if (reg.waiting && navigator.serviceWorker.controller) novaVersao(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var novo = reg.installing;
        if (!novo) return;
        novo.addEventListener('statechange', function () {
          // "installed" com um controlador já ativo = atualização (não é a primeira instalação).
          if (novo.state === 'installed' && navigator.serviceWorker.controller) novaVersao(novo);
        });
      });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) reg.update().catch(function () {});
      });
      lerVersao();
    }, function (e) {
      console.error('[Preço Certo] Service worker não registrado:', e);
      avisar();
    });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (atualizando) { atualizando = false; location.reload(); return; }
      lerVersao();
    });
  }

  function lerVersao() {
    var sw = navigator.serviceWorker.controller || (registro && registro.active);
    if (!sw) { avisar(); return; }
    var canal = new MessageChannel();
    var limite = setTimeout(function () { avisar(); }, 2000);
    canal.port1.onmessage = function (e) { clearTimeout(limite); estado.versao = e.data || ''; avisar(); };
    sw.postMessage({ tipo: 'versao' }, [canal.port2]);
  }

  function novaVersao(sw) {
    esperando = sw;
    estado.atualizacao = true;
    avisar();
    aoNovaVersao();
  }

  /** Ativa a versão nova (skipWaiting no service worker) e recarrega uma única vez. */
  function atualizar() {
    if (!esperando) return;
    atualizando = true;
    esperando.postMessage({ tipo: 'atualizar' });
  }

  function iniciarInstalacao() {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); // sem mini-barra automática: o app oferece no momento certo
      pedidoInstalacao = e;
      estado.podeInstalar = !estado.instalado;
      avisar();
      if (!estado.podeInstalar) return;
      var jaAvisou = true;
      try { jaAvisou = !!localStorage.getItem(CHAVE_AVISO_INSTALAR); } catch (err) { /* ignora */ }
      if (!jaAvisou) {
        try { localStorage.setItem(CHAVE_AVISO_INSTALAR, '1'); } catch (err) { /* ignora */ }
        aoSugerirInstalar();
      }
    });
    window.addEventListener('appinstalled', function () {
      pedidoInstalacao = null;
      estado.podeInstalar = false;
      estado.instalado = true;
      avisar();
    });
  }

  function instalar() {
    if (!pedidoInstalacao) return;
    var pedido = pedidoInstalacao;
    pedidoInstalacao = null; // o mesmo evento só pode ser usado uma vez
    estado.podeInstalar = false;
    avisar();
    pedido.prompt();
  }

  return { estado: estado, iniciar: iniciar, atualizar: atualizar, instalar: instalar };
})();
