const status = document.getElementById("status");
const botao = document.getElementById("acao");
const resultado = document.getElementById("resultado");
const badge = document.getElementById("badge");
const orientacaoBox = document.getElementById("orientacao");
const opRetrato = document.getElementById("opRetrato");
const opPaisagem = document.getElementById("opPaisagem");

let modo = null; // "pdf" | "html"
let urlPdf = null;
let nomePdf = null;
let abaAtual = null;
let landscape = null; // null = ainda não escolhida (sem orientação padrão configurada)

function selecionarOrientacao(valor) {
  landscape = valor === "paisagem";
  opRetrato.classList.toggle("ativo", !landscape);
  opPaisagem.classList.toggle("ativo", landscape);
  if (modo === "html") {
    botao.disabled = false;
    botao.textContent = "Converter em PDF e enviar";
  }
}
opRetrato.addEventListener("click", () => selecionarOrientacao("retrato"));
opPaisagem.addEventListener("click", () => selecionarOrientacao("paisagem"));

function pareceUrlDePdf(url) {
  return /\.pdf($|[?#])/i.test(url || "");
}

async function iniciar() {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!aba) return;
  abaAtual = aba;

  // 1. Última resposta PDF vista nesta aba (cobre PDF embutido em iframe).
  const resposta = await chrome.runtime.sendMessage({
    type: "obterPdfDaAba",
    tabId: aba.id,
  });

  if (resposta && resposta.url) {
    urlPdf = resposta.url;
    nomePdf = resposta.nome || null;
  } else if (pareceUrlDePdf(aba.url)) {
    urlPdf = aba.url;
  }

  if (urlPdf) {
    modo = "pdf";
    if (!nomePdf) {
      // Tenta o filename do content-disposition embutido na URL (S3/CloudFront),
      // senão usa o último segmento do caminho.
      try {
        const u = new URL(urlPdf);
        for (const [chave, valor] of u.searchParams) {
          if (chave.toLowerCase().includes("content-disposition")) {
            const m = valor.match(/filename\*?\s*=\s*(?:UTF-8'')?"?([^";]+)"?/i);
            if (m) {
              try { nomePdf = decodeURIComponent(m[1].trim()); }
              catch (e) { nomePdf = m[1].trim(); }
              break;
            }
          }
        }
        if (!nomePdf) {
          nomePdf = decodeURIComponent(u.pathname.split("/").pop() || "") || "documento.pdf";
        }
      } catch (e) {
        nomePdf = "documento.pdf";
      }
    }
    if (!/\.pdf$/i.test(nomePdf)) nomePdf += ".pdf";
    badge.textContent = "PDF ORIGINAL";
    badge.className = "badge pdf";
    badge.hidden = false;
    status.innerHTML = "Documento: <b>" + nomePdf + "</b><br>Será enviado o arquivo original, intacto e pesquisável.";
    botao.textContent = "Enviar PDF original";
    botao.disabled = false;
  } else if ((aba.url || "").startsWith("http")) {
    modo = "html";
    badge.textContent = "PÁGINA HTML";
    badge.className = "badge html";
    badge.hidden = false;
    orientacaoBox.hidden = false;

    let orientacaoPadrao = "";
    try {
      const cfg = await chrome.storage.sync.get({ orientacaoPadrao: "" });
      orientacaoPadrao = cfg.orientacaoPadrao === "paisagem" || cfg.orientacaoPadrao === "retrato" ? cfg.orientacaoPadrao : "";
    } catch (e) {}

    if (orientacaoPadrao) {
      selecionarOrientacao(orientacaoPadrao);
      status.innerHTML = "Página: <b>" + (aba.title || aba.url) + "</b><br>Será convertida em PDF pesquisável (texto preservado) e enviada.";
      botao.textContent = "Converter em PDF e enviar";
      botao.disabled = false;
    } else {
      // Sem orientação padrão configurada: não assume nada, a pessoa
      // precisa escolher Retrato ou Paisagem antes de poder enviar.
      landscape = null;
      opRetrato.classList.remove("ativo");
      opPaisagem.classList.remove("ativo");
      status.innerHTML = "Página: <b>" + (aba.title || aba.url) + "</b><br>Escolha a orientação abaixo antes de converter.";
      botao.textContent = "Escolha a orientação";
      botao.disabled = true;
    }
  } else {
    status.textContent = "Esta aba não tem um documento que possa ser enviado.";
    botao.textContent = "Nada para enviar";
  }
}

botao.addEventListener("click", async () => {
  botao.disabled = true;
  resultado.className = "";
  resultado.innerHTML = '<span class="spinner"></span>Enviando...';

  let r;
  if (modo === "pdf") {
    r = await chrome.runtime.sendMessage({ type: "baixar", url: urlPdf, nome: nomePdf });
  } else {
    r = await chrome.runtime.sendMessage({
      type: "converterHtml",
      tabId: abaAtual.id,
      titulo: abaAtual.title,
      url: abaAtual.url,
      landscape,
    });
  }

  if (r && r.ok) {
    resultado.textContent = "Enviado! O documento chega à pasta do Zerodox em instantes.";
    resultado.className = "ok";
  } else {
    resultado.textContent = "Falhou: " + (r && r.erro ? r.erro : "erro desconhecido");
    resultado.className = "erro";
    botao.disabled = false;
  }
});

document.getElementById("opcoes").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

iniciar();
