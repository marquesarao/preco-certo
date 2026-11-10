/* =====================================================================
   PDF do orçamento (onda do PDF, DESENHO seção 20). Desenha, no aparelho, o documento montado por
   documentoDoPdf() (js/calculo.js): só o que o cliente vê. A biblioteca jsPDF (MIT, js/vendor/) é
   carregada só na primeira vez que alguém gera um PDF e fica no cache do service worker (funciona offline).
   A4 retrato, Helvetica (acentos do português corretos), quebra de página automática.
   ===================================================================== */
var PrecoCertoPdf = (function () {
  'use strict';

  var ARQUIVO_JSPDF = 'js/vendor/jspdf.umd.min.js';
  var carregando = null;

  /** Carrega a jsPDF uma vez. @return Promise<jsPDF> */
  function carregar() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (carregando) return carregando;
    carregando = new Promise(function (ok, falha) {
      var s = document.createElement('script');
      s.src = ARQUIVO_JSPDF;
      s.onload = function () { window.jspdf && window.jspdf.jsPDF ? ok(window.jspdf.jsPDF) : falha(new Error('PDF indisponível.')); };
      s.onerror = function () { carregando = null; falha(new Error('Não deu para carregar o gerador de PDF. Confira a internet e tente de novo.')); };
      document.head.appendChild(s);
    });
    return carregando;
  }

  /** Imagem (mesma origem) → data URL JPEG/PNG, para o logo. Falhou → null (o PDF sai sem logo). */
  function imagemComoDataUrl(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('logo'); return r.blob(); }).then(function (b) {
      return new Promise(function (ok) {
        var fr = new FileReader();
        fr.onload = function () { ok(fr.result); };
        fr.onerror = function () { ok(null); };
        fr.readAsDataURL(b);
      });
    }).catch(function () { return null; });
  }

  // Cores (cinza-grafite do texto; laranja da marca nos títulos)
  var TEXTO = [31, 41, 55], SUAVE = [107, 114, 128], LINHA = [209, 213, 219], FUNDO = [243, 244, 246], MARCA = [194, 65, 12];

  /**
   * Desenha o documento. @param doc saída de documentoDoPdf; @param logo data URL ou null
   * @return Blob (application/pdf)
   */
  function gerar(JsPdf, doc, logo) {
    var pdf = new JsPdf({ unit: 'mm', format: 'a4', compress: true });
    pdf.setProperties({ title: doc.titulo, subject: doc.titulo, creator: 'Preço Certo' });
    var L = 15, R = 195, W = R - L, ALTURA = 297, FIM = ALTURA - 18;
    var y = 14;

    function cor(c) { pdf.setTextColor(c[0], c[1], c[2]); }
    function fonte(peso, tam) { pdf.setFont('helvetica', peso); pdf.setFontSize(tam); }
    function alturaLinha(tam) { return tam * 0.42; }
    function novaPagina() { pdf.addPage(); y = 15; }
    function garantir(h) { if (y + h > FIM) novaPagina(); }
    function linhaH(yy, c) { pdf.setDrawColor((c || LINHA)[0], (c || LINHA)[1], (c || LINHA)[2]); pdf.setLineWidth(0.3); pdf.line(L, yy, R, yy); }
    /** Texto quebrado na largura; devolve a altura usada. */
    function paragrafo(texto, x, largura, peso, tam, c) {
      fonte(peso, tam); cor(c || TEXTO);
      var linhas = pdf.splitTextToSize(String(texto), largura);
      var h = alturaLinha(tam) + 0.6;
      linhas.forEach(function (l) { garantir(h); pdf.text(l, x, y); y += h; });
      return linhas.length * h;
    }
    function tituloSecao(t) {
      garantir(12);
      y += 3;
      fonte('bold', 10.5); cor(MARCA);
      pdf.text(t.toUpperCase(), L, y);
      y += 1.6; linhaH(y, MARCA); y += 4.6;
    }

    // ---- Cabeçalho: logo + oficina | número, data, validade ----
    var xNome = L;
    if (logo) {
      try { pdf.addImage(logo, logo.indexOf('image/png') >= 0 ? 'PNG' : 'JPEG', L, y - 4, 22, 22); xNome = L + 26; } catch (e) { /* sem logo */ }
    }
    var yTopo = y;
    fonte('bold', 15); cor(TEXTO);
    pdf.text(doc.oficina.nome || 'Orçamento', xNome, y + 1);
    y += 6.5;
    [[doc.oficina.documento, doc.oficina.telefone].filter(Boolean).join('   ·   '), [doc.oficina.endereco, doc.oficina.cidadeUf].filter(Boolean).join(' – ')]
      .filter(Boolean).forEach(function (l) {
        fonte('normal', 9); cor(SUAVE);
        pdf.splitTextToSize(l, 105).forEach(function (p) { pdf.text(p, xNome, y); y += 4.2; });
      });
    var yDir = yTopo;
    fonte('bold', 13); cor(MARCA); pdf.text(doc.titulo, R, yDir + 1, { align: 'right' }); yDir += 6.5;
    fonte('normal', 9.5); cor(TEXTO); pdf.text('Data: ' + doc.data, R, yDir, { align: 'right' }); yDir += 4.6;
    pdf.text('Válido até: ' + doc.validoAte, R, yDir, { align: 'right' }); yDir += 4.6;
    y = Math.max(y, yDir, logo ? yTopo + 19 : 0) + 2;
    linhaH(y, TEXTO); y += 6;

    // ---- Cliente ----
    tituloSecao('Cliente');
    fonte('bold', 10.5); cor(TEXTO);
    pdf.text(doc.cliente.nome || '—', L, y);
    if (doc.cliente.telefone) { fonte('normal', 10); pdf.text('Telefone: ' + doc.cliente.telefone, R, y, { align: 'right' }); }
    y += 6;

    // ---- Veículo (só o que tiver) ----
    if (doc.veiculo.length) {
      tituloSecao('Informações básicas do veículo');
      var col = W / 4;
      doc.veiculo.forEach(function (v, i) {
        var x = L + (i % 4) * col;
        if (i && i % 4 === 0) y += 10;
        fonte('normal', 8.5); cor(SUAVE); pdf.text(v[0], x, y);
        fonte('bold', 10.5); cor(TEXTO); pdf.text(pdf.splitTextToSize(v[1], col - 3)[0], x, y + 4.8);
      });
      y += 11;
    }

    // ---- Tabelas ----
    // Uma margem direita só (XV) para a coluna "Valor", os subtotais e o quadro de totais.
    // Linhas da tabela com altura fixa (LINHA_MIN) e o texto centralizado na faixa: o mesmo respiro antes e depois de cada separador.
    var XV = R - 2;
    var CAP = function (tam) { return tam * 0.3528 * 0.718; }; // altura das maiúsculas da Helvetica, em mm
    var ENTRE = 4.6, LINHA_MIN = 7.4, CAB = 7;
    function cabecalhoTabela(colunas) {
      var topo = y - 4.6;
      if (topo + CAB + LINHA_MIN > FIM) { novaPagina(); topo = y; }
      pdf.setFillColor(FUNDO[0], FUNDO[1], FUNDO[2]); pdf.rect(L, topo, W, CAB, 'F');
      fonte('bold', 9); cor(SUAVE);
      var base = topo + (CAB + CAP(9)) / 2;
      colunas.forEach(function (c) { pdf.text(c.t, c.x, base, c.alinhar ? { align: c.alinhar } : undefined); });
      y = topo + CAB; // daqui para baixo, y = topo da próxima linha
    }
    /** Linha da tabela (y = topo da linha): descrição quebrada; os outros campos na 1ª linha; separador embaixo. */
    function linhaTabela(campos, xDesc, larguraDesc, descricao) {
      fonte('normal', 10);
      var linhas = pdf.splitTextToSize(descricao, larguraDesc);
      var h = LINHA_MIN + (linhas.length - 1) * ENTRE;
      if (y + h > FIM) novaPagina();
      var base = y + (LINHA_MIN + CAP(10)) / 2;
      cor(TEXTO);
      linhas.forEach(function (l, i) { pdf.text(l, xDesc, base + i * ENTRE); });
      campos.forEach(function (c) { pdf.text(c.t, c.x, base, c.alinhar ? { align: c.alinhar } : undefined); });
      y += h;
      pdf.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); pdf.setLineWidth(0.15); pdf.line(L, y, R, y);
    }
    /** Subtotal (y = topo): valor na margem XV; o rótulo à esquerda dele, sem empurrá-lo. */
    function subtotal(rotulo, valor) {
      if (y + LINHA_MIN > FIM) novaPagina();
      fonte('bold', 10); cor(TEXTO);
      var base = y + (LINHA_MIN + CAP(10)) / 2;
      pdf.text(valor, XV, base, { align: 'right' });
      pdf.text(rotulo, Math.min(XV - 30, XV - pdf.getTextWidth(valor) - 5), base, { align: 'right' });
      y += LINHA_MIN + 3;
    }

    if (doc.servicos.length) {
      tituloSecao('Serviços');
      cabecalhoTabela([{ t: 'Descrição', x: L + 2 }].concat(doc.precoServico ? [{ t: 'Valor', x: XV, alinhar: 'right' }] : []));
      doc.servicos.forEach(function (it) {
        linhaTabela(doc.precoServico ? [{ t: it.valor, x: XV, alinhar: 'right' }] : [], L + 2, doc.precoServico ? W - 42 : W - 4, it.descricao);
      });
      subtotal('Subtotal serviços', doc.subtotalServicos);
    }
    if (doc.pecas.length) {
      tituloSecao('Peças');
      cabecalhoTabela([{ t: 'Qtd', x: L + 2 }, { t: 'Descrição', x: L + 18 }].concat(doc.precoPeca ? [{ t: 'Valor', x: XV, alinhar: 'right' }] : []));
      doc.pecas.forEach(function (it) {
        var campos = [{ t: it.qtd, x: L + 2 }].concat(doc.precoPeca ? [{ t: it.valor, x: XV, alinhar: 'right' }] : []);
        linhaTabela(campos, L + 18, doc.precoPeca ? W - 58 : W - 20, it.descricao);
      });
      subtotal('Subtotal peças', doc.subtotalPecas);
    }

    // ---- Totais (valores na mesma margem XV da coluna "Valor") ----
    var topoCaixa = y - 2.5;
    if (topoCaixa + 22 > FIM) { novaPagina(); topoCaixa = y; }
    var xCaixa = R - 78;
    pdf.setFillColor(FUNDO[0], FUNDO[1], FUNDO[2]); pdf.rect(xCaixa, topoCaixa, 78, 22, 'F');
    fonte('normal', 10); cor(TEXTO);
    pdf.text('Serviços', xCaixa + 3, topoCaixa + 5.5); pdf.text(doc.subtotalServicos, XV, topoCaixa + 5.5, { align: 'right' });
    pdf.text('Peças', xCaixa + 3, topoCaixa + 11); pdf.text(doc.subtotalPecas, XV, topoCaixa + 11, { align: 'right' });
    fonte('bold', 12.5); cor(MARCA);
    pdf.text('Total', xCaixa + 3, topoCaixa + 18.2); pdf.text(doc.total, XV, topoCaixa + 18.2, { align: 'right' });
    y = topoCaixa + 28.5;

    // ---- Pagamento ----
    tituloSecao('Pagamento');
    doc.pagamento.forEach(function (l) {
      fonte('normal', 10); cor(TEXTO);
      var linhas = pdf.splitTextToSize(l, W - 6);
      garantir(linhas.length * 4.8 + 1);
      pdf.text('•', L + 1, y);
      linhas.forEach(function (p, i) { pdf.text(p, L + 5, y + i * 4.8); });
      y += linhas.length * 4.8 + 1;
    });

    // ---- Observações ----
    if (doc.observacoes.length) {
      tituloSecao('Observações');
      doc.observacoes.forEach(function (o) { paragrafo(o, L, W, 'normal', 10); y += 1; });
    }

    // ---- Rodapé: cidade e data; assinaturas ----
    y += 4;
    garantir(doc.assinaturas ? 34 : 10);
    fonte('normal', 10); cor(TEXTO);
    pdf.text(doc.rodape, L, y);
    y += 6;
    if (doc.assinaturas) {
      y = Math.max(y + 16, Math.min(FIM - 4, y + 16));
      var largura = (W - 20) / 2;
      [[L, doc.assinaturaOficina], [L + largura + 20, 'Cliente']].forEach(function (a) {
        pdf.setDrawColor(TEXTO[0], TEXTO[1], TEXTO[2]); pdf.setLineWidth(0.3);
        pdf.line(a[0], y, a[0] + largura, y);
        fonte('normal', 9); cor(SUAVE);
        pdf.text(a[1], a[0] + largura / 2, y + 4.5, { align: 'center' });
      });
      y += 8;
    }

    // ---- Número da página (só com mais de uma) ----
    var total = pdf.getNumberOfPages();
    if (total > 1) {
      for (var i = 1; i <= total; i++) {
        pdf.setPage(i); fonte('normal', 8); cor(SUAVE);
        pdf.text(doc.titulo + ' · página ' + i + ' de ' + total, R, ALTURA - 8, { align: 'right' });
      }
    }
    return pdf.output('blob');
  }

  /** Carrega a jsPDF e o logo e desenha. @return Promise<Blob> */
  function gerarPdf(doc, urlLogo) {
    return Promise.all([carregar(), urlLogo ? imagemComoDataUrl(urlLogo) : Promise.resolve(null)]).then(function (r) {
      return gerar(r[0], doc, r[1]);
    });
  }

  return { carregar: carregar, gerarPdf: gerarPdf };
})();
