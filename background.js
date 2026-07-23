// Zerodox Printer Web (v1.0)
//
// Resumo do que a extensão faz:
// - Rastreia, por aba, a última URL cuja resposta foi um PDF (funciona até
//   quando o PDF está embutido num iframe do ERP) e captura o NOME REAL do
//   arquivo a partir do cabeçalho Content-Disposition ou do parâmetro
//   response-content-disposition da URL (padrão S3/CloudFront), forçando
//   esse nome no diálogo "Salvar como" (o Chrome às vezes ignora o filename
//   da API quando o Content-Disposition é "inline").
// - Converte páginas HTML em PDF pesquisável (motor do "Salvar como PDF"),
//   com seletor de orientação Retrato/Paisagem e orientação padrão
//   configurável (começa vazia -- só assume um valor se a pessoa escolher e
//   salvar em Configurações). Neutraliza @page CSS do site que tenta forçar
//   orientação própria (bug conhecido do Chromium) e remove containers com
//   rolagem/corte de conteúdo antes de capturar.
// - Detecta ERPs com <frameset> clássico (frame de botões + frame de
//   conteúdo, ex: ClinicWeb) e gera o PDF só do frame de conteúdo. Sistema
//   de perfis por ERP (PERFIS_SITE) para acomodar próximos clientes.
// - Menu de botão direito e atalhos de teclado como alternativa ao ícone da
//   extensão, que some em janelas com toolbar reduzida (window.open sem
//   barra completa).
//
// Publicada no Chrome Web Store (Não listada) -- as atualizações são
// automáticas via o próprio mecanismo do Chrome, não precisa de nenhum
// verificador próprio aqui.

const PADROES = {
  subpasta: "zerodox",
  automatico: false,
  orientacaoPadrao: "",
};

async function getConfig() {
  const cfg = await chrome.storage.sync.get(PADROES);
  cfg.subpasta = (cfg.subpasta || "zerodox").replace(/[\\/]+$/, "");
  return cfg;
}

// ---- extração do nome do arquivo -------------------------------------------
function nomeDeDisposition(valor) {
  if (!valor) return null;
  try {
    // filename*=UTF-8''nome%20com%20acentos.pdf (RFC 5987) tem prioridade
    const mStar = valor.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i);
    if (mStar) {
      const nome = decodeURIComponent(mStar[1].replace(/["']/g, "").trim());
      if (nome) return nome;
    }
    const m = valor.match(/filename\s*=\s*"?([^";]+)"?/i);
    if (m) {
      let nome = m[1].trim();
      try { nome = decodeURIComponent(nome); } catch (e) {}
      if (nome) return nome;
    }
  } catch (e) {}
  return null;
}

function nomeDaUrl(url, fallback) {
  try {
    const u = new URL(url);

    // 1. Parâmetro response-content-disposition (S3/CloudFront) ou similares.
    for (const [chave, valor] of u.searchParams) {
      if (chave.toLowerCase().includes("content-disposition")) {
        const nome = nomeDeDisposition(valor);
        if (nome) return garantirPdf(nome);
      }
    }

    // 2. Último segmento do caminho.
    const base = decodeURIComponent(u.pathname.split("/").pop() || "");
    if (base) return garantirPdf(base);
  } catch (e) {}
  return fallback || "documento.pdf";
}

function garantirPdf(nome) {
  nome = nome.replace(/[\\/:*?"<>|]+/g, " ").trim();
  return /\.pdf$/i.test(nome) ? nome : nome + ".pdf";
}

// ---- rastreio da última resposta PDF por aba --------------------------------
// tabId -> { url, nome }
const ultimoPdfPorAba = new Map();

// downloadId -> nome de arquivo que a extensão exige para este download.
// Necessário porque o Chrome, ao receber um Content-Disposition do tipo
// "inline" (em vez de "attachment"), re-determina o nome do arquivo a partir
// da URL e IGNORA o filename que já passamos em chrome.downloads.download,
// mostrando o nome errado no diálogo "Salvar como". Forçamos aqui de novo.
const nomesForcados = new Map();

const recentes = new Map();
function jaCapturada(url) {
  const agora = Date.now();
  for (const [u, t] of recentes) if (agora - t > 15000) recentes.delete(u);
  if (recentes.has(url)) return true;
  recentes.set(url, agora);
  return false;
}

chrome.webRequest.onHeadersReceived.addListener(
  (d) => {
    try {
      const headers = d.responseHeaders || [];
      const ct = headers.find((x) => x.name.toLowerCase() === "content-type");
      const tipo = ct && ct.value ? ct.value.toLowerCase() : "";
      if (!tipo.includes("pdf")) return;
      if (!d.url.startsWith("http")) return;

      // Nome real: cabeçalho Content-Disposition > parâmetro da URL > caminho.
      const cd = headers.find((x) => x.name.toLowerCase() === "content-disposition");
      const nome =
        nomeDeDisposition(cd && cd.value) || nomeDaUrl(d.url, "documento.pdf");

      if (d.tabId >= 0) ultimoPdfPorAba.set(d.tabId, { url: d.url, nome: garantirPdf(nome) });

      getConfig().then((cfg) => {
        if (cfg.automatico && !jaCapturada(d.url)) {
          const caminho = `${cfg.subpasta}/${garantirPdf(nome)}`;
          chrome.downloads.download({ url: d.url, filename: caminho, conflictAction: "uniquify" }, (id) => {
            if (id !== undefined) nomesForcados.set(id, caminho);
          });
        }
      });
    } catch (e) {}
  },
  {
    urls: ["<all_urls>"],
    types: ["main_frame", "sub_frame", "object", "xmlhttprequest", "other"],
  },
  ["responseHeaders"]
);

chrome.tabs.onRemoved.addListener((tabId) => ultimoPdfPorAba.delete(tabId));

// Modo automático: downloads de PDF feitos pelo usuário também vão pra subpasta.
chrome.downloads.onDeterminingFilename.addListener((item, sugerir) => {
  // Se este download foi iniciado por nós (botão "Enviar" ou modo automático),
  // o nome já foi decidido -- força ele e ignora qualquer re-determinação do
  // Chrome baseada em Content-Disposition "inline" ou na URL.
  const forcado = nomesForcados.get(item.id);
  if (forcado) {
    nomesForcados.delete(item.id);
    sugerir({ filename: forcado, conflictAction: "uniquify" });
    return true;
  }

  (async () => {
    try {
      const cfg = await getConfig();
      const nome = item.filename || "";
      const ehPdf =
        (item.mime && item.mime.toLowerCase().includes("pdf")) ||
        /\.pdf$/i.test(nome);

      if (cfg.automatico && ehPdf && !nome.startsWith(cfg.subpasta + "/")) {
        jaCapturada(item.url);
        const base = nome.split(/[\\/]/).pop() || "documento.pdf";
        sugerir({ filename: `${cfg.subpasta}/${base}`, conflictAction: "uniquify" });
        return;
      }
    } catch (e) {}
    sugerir();
  })();
  return true;
});

// ---- prepara a página antes de capturar o PDF -------------------------------
// Dois problemas comuns em guias de ERP:
// 1. A guia fica dentro de um container com largura/altura fixa e
//    overflow:hidden|auto|scroll (responsivo, pra rolar em telas pequenas).
//    O Page.printToPDF captura exatamente o que está renderizado, então esse
//    recorte "vaza" pro PDF (conteúdo cortado, sobra um traço de scrollbar).
// 2. Botões/controles da tela (ex: "Salvar e Imprimir") deveriam sumir via
//    CSS de impressão, mas a folha de estilo do site pode ter erro (ex:
//    "display: hidden" não existe, o valor certo é "none") ou não cobrir o
//    elemento certo -- então o botão aparece no PDF gerado.
// Corrigimos os dois à força via JS (que sempre vence a cascata do CSS do
// site) e SEMPRE em todos os frames da aba (allFrames), porque a guia às
// vezes está dentro de um <iframe> e um script só no frame principal não
// alcança nada.
function zxPrepararImpressao(landscape) {
  const alterados = [];
  function salvar(el, props) {
    const original = {};
    props.forEach((p) => { original[p] = el.style.getPropertyValue(p); });
    alterados.push({ el, props, original });
  }

  // 0. Bug antigo e conhecido do Chromium: se a página define sua própria
  //    regra @page { size: landscape/portrait } no CSS (comum em guias tipo
  //    SADT, que são naturalmente largas), ela costuma "ganhar" do parâmetro
  //    landscape que mandamos pela API do Chrome, ignorando a escolha da
  //    pessoa -- não importa o que a gente passe pro Page.printToPDF.
  //    Neutralizamos qualquer @page existente e forçamos a nossa por cima,
  //    com !important, pra a escolha da pessoa realmente prevalecer.
  try {
    for (const sheet of document.styleSheets) {
      let regras;
      try {
        regras = sheet.cssRules;
      } catch (e) {
        continue; // stylesheet de outra origem, sem acesso -- ignora
      }
      if (!regras) continue;
      for (const regra of regras) {
        if (regra && regra.type === CSSRule.PAGE_RULE) {
          const original = regra.style.getPropertyValue("size");
          alterados.push({ regraPagina: regra, original });
          try {
            regra.style.setProperty("size", landscape ? "landscape" : "portrait", "important");
          } catch (e) {}
        }
      }
    }
  } catch (e) {}

  const estiloForcado = document.createElement("style");
  estiloForcado.setAttribute("data-zx-orientacao", "1");
  estiloForcado.textContent = `@page { size: ${landscape ? "landscape" : "portrait"} !important; }`;
  document.head.appendChild(estiloForcado);
  alterados.push({ elementoParaRemover: estiloForcado });

  // 1. Esconde botões/controles (a página tenta via CSS e costuma falhar).
  document.querySelectorAll(
    'button, [role="button"], .controles, .toolbar, .btn-imprimir, .btn-print'
  ).forEach((el) => {
    salvar(el, ["display"]);
    el.style.setProperty("display", "none", "important");
  });

  // 2. Remove qualquer corte de conteúdo (largura ou altura), seja
  //    overflow auto, scroll, hidden ou clip. Guardamos a largura que o
  //    conteúdo realmente precisa (scrollWidth) SÓ desses elementos
  //    genuinamente cortados -- não a largura do documento inteiro, que pode
  //    incluir rodapés/elementos de largura fixa decorativos (ex: um bloco
  //    de código de barras com width:980px) que não representam o conteúdo
  //    principal e fariam encolher a guia à toa.
  let larguraNecessariaPx = 0;
  document.querySelectorAll("*").forEach((el) => {
    try {
      const cs = getComputedStyle(el);
      const podeCortar = ["hidden", "auto", "scroll", "clip"];
      const temOverflow =
        podeCortar.includes(cs.overflow) ||
        podeCortar.includes(cs.overflowY) ||
        podeCortar.includes(cs.overflowX);
      const cortado = el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
      if (temOverflow && cortado) {
        larguraNecessariaPx = Math.max(larguraNecessariaPx, el.scrollWidth);
        const props = ["overflow", "overflow-y", "overflow-x", "max-height", "max-width", "height", "width"];
        salvar(el, props);
        el.style.setProperty("overflow", "visible", "important");
        el.style.setProperty("overflow-y", "visible", "important");
        el.style.setProperty("overflow-x", "visible", "important");
        el.style.setProperty("max-height", "none", "important");
        el.style.setProperty("max-width", "none", "important");
        el.style.setProperty("height", "auto", "important");
      }
    } catch (e) {}
  });

  window.__zxAlterados = alterados;

  // 0 = nenhum corte real encontrado -> não força nenhuma escala, deixa o
  // layout responsivo/percentual da própria página se ajustar à página.
  return larguraNecessariaPx;
}

function zxRestaurarImpressao() {
  const lista = window.__zxAlterados || [];
  lista.forEach((item) => {
    try {
      if (item.elementoParaRemover) {
        item.elementoParaRemover.remove();
      } else if (item.regraPagina) {
        if (item.original) item.regraPagina.style.setProperty("size", item.original, "important");
        else item.regraPagina.style.removeProperty("size");
      } else if (item.el && item.props) {
        item.props.forEach((p) => {
          if (item.original[p]) item.el.style.setProperty(p, item.original[p]);
          else item.el.style.removeProperty(p);
        });
      }
    } catch (e) {}
  });
  window.__zxAlterados = null;
}

// ---- perfis por ERP/site -----------------------------------------------------
// Alguns ERPs mostram a guia dentro de um <frameset> clássico: um frame
// pequeno com os botões (ex: "Salvar e Imprimir") e outro frame com o
// formulário da guia em si. O botão nativo deles nunca "esconde via CSS" --
// ele chama print() só dentro do frame de conteúdo, então o frame do botão
// nunca entra na impressão. Fazemos o mesmo: achamos a URL do frame de
// conteúdo e geramos o PDF só dela, numa aba oculta separada.
//
// Cada cliente pode ter um seletor de frame diferente; adicione aqui quando
// aparecer um novo. Se a URL não bater com nenhum perfil, ainda tentamos o
// seletor genérico (SELETOR_FRAME_PADRAO) -- funciona de graça pra ERPs
// parecidos sem precisar cadastrar cada um.
const PERFIS_SITE = [
  {
    nome: "ClinicWeb (Linx)",
    corresponde: (url) => /clinicweb\.linx\.com\.br/i.test(url || ""),
    seletorFrameConteudo: 'frame[name="mainFrame"], iframe[name="mainFrame"]',
  },
  // Próximos clientes/ERPs entram aqui com seu próprio seletor, sem afetar
  // os demais.
];

const SELETOR_FRAME_PADRAO =
  'frame[name="mainFrame"], iframe[name="mainFrame"], ' +
  'frame[name="main"], iframe[name="main"], ' +
  'frame[name="conteudo"], iframe[name="conteudo"], ' +
  'frame[name="content"], iframe[name="content"]';

function seletorFrameConteudo(urlAba) {
  const perfil = PERFIS_SITE.find((p) => p.corresponde(urlAba));
  return (perfil && perfil.seletorFrameConteudo) || SELETOR_FRAME_PADRAO;
}

function esperarAbaCarregar(tabId) {
  return new Promise((resolve) => {
    function ouvinte(id, info) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(ouvinte);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(ouvinte);
    // trava de segurança: se não carregar em 8s, segue em frente mesmo assim.
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(ouvinte);
      resolve();
    }, 8000);
  });
}

// Se a aba usa um frameset conhecido, gera o PDF a partir do frame de
// conteúdo isolado (numa aba oculta); senão, converte a aba normalmente.
async function converterComPossivelFrameset(tabId, titulo, cfg, landscape, urlAba) {
  let urlFrame = null;
  try {
    const seletor = seletorFrameConteudo(urlAba);
    const [primeiro] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel) => {
        const el = document.querySelector(sel);
        return el ? el.src : null;
      },
      args: [seletor],
    });
    urlFrame = primeiro && primeiro.result;
  } catch (e) {}

  if (!urlFrame) {
    await converterHtmlEmPdf(tabId, titulo, cfg, landscape);
    return;
  }

  const novaAba = await chrome.tabs.create({ url: urlFrame, active: false });
  try {
    await esperarAbaCarregar(novaAba.id);
    await new Promise((r) => setTimeout(r, 300));

    // Segurança: se o servidor redirecionou de volta pra outro frameset
    // (bloqueio anti-frame-busting), volta pro comportamento padrão na aba
    // original em vez de gerar um PDF vazio/errado.
    let aindaTemFrameset = false;
    try {
      const [chk] = await chrome.scripting.executeScript({
        target: { tabId: novaAba.id },
        func: () => !!document.querySelector("frameset"),
      });
      aindaTemFrameset = !!(chk && chk.result);
    } catch (e) {}

    if (aindaTemFrameset) {
      await converterHtmlEmPdf(tabId, titulo, cfg, landscape);
    } else {
      await converterHtmlEmPdf(novaAba.id, titulo, cfg, landscape);
    }
  } finally {
    try {
      await chrome.tabs.remove(novaAba.id);
    } catch (e) {}
  }
}

// ---- conversão de página HTML em PDF pesquisável ----------------------------
const A4_LARGURA_IN = 8.27;
const A4_ALTURA_IN = 11.69;
const MARGEM_IN = 0.3;

async function converterHtmlEmPdf(tabId, titulo, cfg, landscape) {
  const alvo = { tabId };
  let larguraConteudoPx = 0;

  try {
    const execs = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: zxPrepararImpressao,
      args: [!!landscape],
    });
    larguraConteudoPx = Math.max(0, ...execs.map((r) => (typeof r.result === "number" ? r.result : 0)));
    // pequena pausa para o navegador recalcular o layout antes de capturar.
    await new Promise((r) => setTimeout(r, 120));
  } catch (e) {}

  await chrome.debugger.attach(alvo, "1.3");
  try {
    // IMPORTANTE: paperWidth/paperHeight ficam SEMPRE no tamanho "de pé"
    // (retrato) do A4. É o parâmetro "landscape" que manda o Chrome girar a
    // página -- se a gente também inverte largura/altura manualmente E manda
    // landscape:true, as duas inversões se cancelam e sai tudo em retrato de
    // novo (foi exatamente o bug relatado). Para o NOSSO cálculo de escala
    // (largura útil disponível), aí sim usamos a largura "efetiva" (a maior
    // dimensão do A4 quando for paisagem).
    const larguraEfetivaIn = landscape ? A4_ALTURA_IN : A4_LARGURA_IN;
    const larguraUtilPx = (larguraEfetivaIn - MARGEM_IN * 2) * 96;

    // Só encolhe (igual ao "Ajustar à página" do diálogo nativo) se algum
    // elemento REALMENTE precisava de mais espaço do que a página tem. Sem
    // isso, ficaríamos encolhendo a guia por causa de rodapés/elementos de
    // largura fixa decorativos que não são o conteúdo principal.
    let scale = 1;
    if (larguraConteudoPx > larguraUtilPx) {
      scale = Math.max(0.4, (larguraUtilPx / larguraConteudoPx) * 0.97);
    }

    const resultado = await chrome.debugger.sendCommand(alvo, "Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: false,
      landscape: !!landscape,
      paperWidth: A4_LARGURA_IN,
      paperHeight: A4_ALTURA_IN,
      marginTop: MARGEM_IN,
      marginBottom: MARGEM_IN,
      marginLeft: MARGEM_IN,
      marginRight: MARGEM_IN,
      scale,
    });

    const nome =
      (titulo || "pagina").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 120) || "pagina";

    const caminho = `${cfg.subpasta}/${nome}.pdf`;
    await new Promise((resolve) => {
      chrome.downloads.download(
        { url: "data:application/pdf;base64," + resultado.data, filename: caminho, conflictAction: "uniquify" },
        (id) => {
          if (id !== undefined) nomesForcados.set(id, caminho);
          resolve();
        }
      );
    });
  } finally {
    try {
      await chrome.debugger.detach(alvo);
    } catch (e) {}
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: zxRestaurarImpressao,
      });
    } catch (e) {}
  }
}

// ---- menu de botão direito (funciona em janelas sem a fileira de ícones) ----
function notificar(ok, nome, erro) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: ok ? "Zerodox: enviado" : "Zerodox: falhou",
      message: ok
        ? `"${nome}" foi enviado para o Zerodox.`
        : erro || "Não foi possível enviar este documento.",
    });
  } catch (e) {}
}

async function detectarModo(tab) {
  const info = tab && tab.id != null ? ultimoPdfPorAba.get(tab.id) : null;
  if (info && info.url) return { modo: "pdf", url: info.url, nome: info.nome };
  if (/\.pdf($|[?#])/i.test((tab && tab.url) || "")) return { modo: "pdf", url: tab.url, nome: null };
  if ((tab && tab.url || "").startsWith("http")) return { modo: "html" };
  return { modo: null };
}

async function enviarDaAba(tab, landscape) {
  if (!tab) return;
  try {
    const cfg = await getConfig();
    const info = await detectarModo(tab);

    if (info.modo === "pdf") {
      const nomeFinal = info.nome ? garantirPdf(info.nome) : nomeDaUrl(info.url);
      const caminho = `${cfg.subpasta}/${nomeFinal}`;
      chrome.downloads.download({ url: info.url, filename: caminho, conflictAction: "uniquify" }, (id) => {
        if (id !== undefined) nomesForcados.set(id, caminho);
        notificar(id !== undefined, nomeFinal, chrome.runtime.lastError?.message);
      });
    } else if (info.modo === "html") {
      const nomeAproximado = (tab.title || "pagina").trim() + ".pdf";
      await converterComPossivelFrameset(tab.id, tab.title, cfg, landscape, tab.url);
      notificar(true, nomeAproximado);
    } else {
      notificar(false, null, "Esta aba não tem um documento que possa ser enviado.");
    }
  } catch (e) {
    notificar(false, null, e && e.message ? e.message : String(e));
  }
}

// O item "Zerodox: Enviar (Padrão)" só existe quando a pessoa realmente
// escolheu uma orientação padrão nas Configurações -- enquanto não escolher,
// fica só com as duas opções explícitas (Retrato/Paisagem), sem assumir nada
// por conta própria. Reconstrói o menu sempre que a config mudar.
async function atualizarMenuContexto() {
  const cfg = await getConfig();
  const temPadrao = cfg.orientacaoPadrao === "retrato" || cfg.orientacaoPadrao === "paisagem";

  chrome.contextMenus.removeAll(() => {
    if (temPadrao) {
      const rotulo = cfg.orientacaoPadrao === "paisagem" ? "Paisagem" : "Retrato";
      chrome.contextMenus.create({
        id: "zx-enviar-padrao",
        title: `Zerodox: Enviar (Padrão: ${rotulo})`,
        contexts: ["page", "frame", "selection", "image", "link"],
      });
    }
    chrome.contextMenus.create({
      id: "zx-enviar-retrato",
      title: "Zerodox: Enviar (Retrato)",
      contexts: ["page", "frame", "selection", "image", "link"],
    });
    chrome.contextMenus.create({
      id: "zx-enviar-paisagem",
      title: "Zerodox: Enviar (Paisagem)",
      contexts: ["page", "frame", "selection", "image", "link"],
    });
  });
}

chrome.runtime.onInstalled.addListener(atualizarMenuContexto);
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === "sync" && mudancas.orientacaoPadrao) atualizarMenuContexto();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let landscape = info.menuItemId === "zx-enviar-paisagem";
  if (info.menuItemId === "zx-enviar-padrao") {
    const cfg = await getConfig();
    landscape = cfg.orientacaoPadrao === "paisagem";
  }
  enviarDaAba(tab, landscape);
});

// ---- atalho de teclado (alternativa extra ao menu de contexto) --------------
chrome.commands.onCommand.addListener(async (comando) => {
  if (comando !== "enviar-retrato" && comando !== "enviar-paisagem" && comando !== "enviar-padrao") return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  let landscape = comando === "enviar-paisagem";
  if (comando === "enviar-padrao") {
    const cfg = await getConfig();
    if (cfg.orientacaoPadrao !== "retrato" && cfg.orientacaoPadrao !== "paisagem") {
      notificar(false, null, "Nenhuma orientação padrão configurada ainda. Defina em Configurações da extensão.");
      return;
    }
    landscape = cfg.orientacaoPadrao === "paisagem";
  }
  enviarDaAba(tab, landscape);
});

// ---- comunicação com o popup -------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg && msg.type === "obterPdfDaAba") {
    const info = ultimoPdfPorAba.get(msg.tabId) || null;
    responder(info ? { url: info.url, nome: info.nome } : { url: null, nome: null });
  }
  if (msg && msg.type === "baixar") {
    getConfig().then((cfg) => {
      const nomeFinal = msg.nome ? garantirPdf(msg.nome) : nomeDaUrl(msg.url);
      const caminho = `${cfg.subpasta}/${nomeFinal}`;
      chrome.downloads.download(
        {
          url: msg.url,
          filename: caminho,
          conflictAction: "uniquify",
        },
        (id) => {
          if (id !== undefined) nomesForcados.set(id, caminho);
          responder({ ok: id !== undefined, erro: chrome.runtime.lastError?.message });
        }
      );
    });
    return true;
  }
  if (msg && msg.type === "converterHtml") {
    getConfig()
      .then((cfg) => converterComPossivelFrameset(msg.tabId, msg.titulo, cfg, msg.landscape, msg.url))
      .then(() => responder({ ok: true }))
      .catch((e) => responder({ ok: false, erro: e && e.message ? e.message : String(e) }));
    return true;
  }
});
