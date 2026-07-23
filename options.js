const PADROES = {
  subpasta: "zerodox",
  automatico: false,
  orientacaoPadrao: "",
};

function normalizarOrientacao(v) {
  return v === "paisagem" || v === "retrato" ? v : "";
}

async function carregar() {
  const cfg = await chrome.storage.sync.get(PADROES);
  document.getElementById("subpasta").value = cfg.subpasta;
  document.getElementById("automatico").checked = cfg.automatico;
  document.getElementById("orientacaoPadrao").value = normalizarOrientacao(cfg.orientacaoPadrao);
  document.getElementById("versaoAtual").textContent = chrome.runtime.getManifest().version;
}

document.getElementById("salvar").addEventListener("click", async () => {
  const subpasta = (document.getElementById("subpasta").value || "zerodox")
    .trim()
    .replace(/[\\/]+$/, "")
    .replace(/[^\w\-. ]/g, "") || "zerodox";
  const automatico = document.getElementById("automatico").checked;
  const orientacaoPadrao = normalizarOrientacao(document.getElementById("orientacaoPadrao").value);

  await chrome.storage.sync.set({ subpasta, automatico, orientacaoPadrao });
  document.getElementById("subpasta").value = subpasta;
  document.getElementById("salvo").textContent = "Salvo!";
  setTimeout(() => (document.getElementById("salvo").textContent = ""), 2000);
});

carregar();
