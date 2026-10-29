// Publica a extensão no Chrome Web Store pela API v2 (service account).
//
//   npm run publish  (sem opção)     gera o zip, sobe e envia para revisão
//   npm run upload   (--upload-only) sobe o pacote sem enviar para revisão
//   npm run status   (--status)      mostra a versão publicada e a em revisão
//   npm run build    (--zip)         só gera o zip em dist/
//
// Configuração (uma vez por máquina) no README, seção "Publicar uma versão nova".

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const RAIZ = path.join(__dirname, "..");
const API = process.env.CWS_API || "https://chromewebstore.googleapis.com";
const PUBLISHER_ID = process.env.CWS_PUBLISHER_ID || "c4b34f40-de1c-40b7-874f-5eab20759148";
const ITEM_ID = process.env.CWS_ITEM_ID || "oabgfhnclpeidaecaefghoiddmofgnbc";
const ARQUIVO_CHAVE =
  process.env.CWS_KEY_FILE || path.join(os.homedir(), ".config", "zerodox", "chrome-web-store.json");
const ESCOPO = "https://www.googleapis.com/auth/chromewebstore";
const ITEM = `publishers/${PUBLISHER_ID}/items/${ITEM_ID}`;

function arquivosDoPacote() {
  const icones = fs
    .readdirSync(path.join(RAIZ, "icons"))
    .filter((f) => f.endsWith(".png"))
    .map((f) => `icons/${f}`);
  return ["background.js", "manifest.json", "offscreen.html", "offscreen.js", "options.html", "options.js", "popup.html", "popup.js", ...icones];
}

function versaoDoManifest() {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, "manifest.json"), "utf8")).version;
}

function compararVersoes(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// O pacote da loja tem que bater com um commit: nada de alteração pendente.
function exigirArvoreLimpa(arquivos) {
  const pendentes = execFileSync("git", ["status", "--porcelain", "--", ...arquivos], { cwd: RAIZ, encoding: "utf8" });
  if (pendentes.trim()) {
    throw new Error(`Há alterações não commitadas nos arquivos da extensão:\n${pendentes}`);
  }
}

function gerarZip(versao, arquivos) {
  const destino = path.join(RAIZ, "dist", `zerodox-printer-web-${versao}.zip`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.rmSync(destino, { force: true });
  execFileSync("zip", ["-q", "-X", destino, ...arquivos], { cwd: RAIZ });
  return destino;
}

async function obterToken() {
  if (process.env.CWS_ACCESS_TOKEN) return process.env.CWS_ACCESS_TOKEN;
  if (!fs.existsSync(ARQUIVO_CHAVE)) {
    throw new Error(`Chave da service account não encontrada em ${ARQUIVO_CHAVE} (veja o README).`);
  }
  const chave = JSON.parse(fs.readFileSync(ARQUIVO_CHAVE, "utf8"));
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const corpo =
    b64({ alg: "RS256", typ: "JWT", kid: chave.private_key_id }) +
    "." +
    b64({ iss: chave.client_email, scope: ESCOPO, aud: chave.token_uri, iat: agora, exp: agora + 3600 });
  const assinatura = crypto.sign("RSA-SHA256", Buffer.from(corpo), chave.private_key).toString("base64url");

  const r = await fetch(chave.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${corpo}.${assinatura}`,
    }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || !json.access_token) {
    throw new Error(`Falha ao obter token do Google (HTTP ${r.status}): ${json.error_description || json.error || ""}`);
  }
  return json.access_token;
}

async function api(token, metodo, caminho, corpo, tipo) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(tipo ? { "Content-Type": tipo } : {}) },
    body: corpo,
  });
  const texto = await r.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch (e) {}
  if (!r.ok) {
    const msg = (json && json.error && json.error.message) || texto;
    throw new Error(`${metodo} ${caminho} -> HTTP ${r.status}: ${msg}`);
  }
  return json || {};
}

function resumoRevisao(rev) {
  if (!rev) return "nenhuma";
  const versoes = (rev.distributionChannels || []).map((c) => c.crxVersion).filter(Boolean);
  return `${versoes.join(", ") || "?"} (${rev.state})`;
}

function versoesNaLoja(status) {
  return [status.publishedItemRevisionStatus, status.submittedItemRevisionStatus]
    .flatMap((rev) => (rev && rev.distributionChannels) || [])
    .map((c) => c.crxVersion)
    .filter(Boolean);
}

async function esperarUpload(token) {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const status = await api(token, "GET", `/v2/${ITEM}:fetchStatus`);
    if (status.lastAsyncUploadState === "SUCCEEDED") return;
    if (status.lastAsyncUploadState === "FAILED" || status.lastAsyncUploadState === "NOT_FOUND") {
      throw new Error(`Upload falhou na loja (${status.lastAsyncUploadState}).`);
    }
  }
  throw new Error("A loja não terminou de processar o upload em 2 minutos. Confira com --status.");
}

async function main() {
  const args = process.argv.slice(2);
  const versao = versaoDoManifest();
  const arquivos = arquivosDoPacote();

  if (args.includes("--zip")) {
    console.log(gerarZip(versao, arquivos));
    return;
  }

  const token = await obterToken();
  const status = await api(token, "GET", `/v2/${ITEM}:fetchStatus`);
  console.log(`Publicada:  ${resumoRevisao(status.publishedItemRevisionStatus)}`);
  console.log(`Em revisão: ${resumoRevisao(status.submittedItemRevisionStatus)}`);
  if (args.includes("--status")) return;

  const maiorNaLoja = versoesNaLoja(status).sort(compararVersoes).pop();
  if (maiorNaLoja && compararVersoes(versao, maiorNaLoja) <= 0) {
    throw new Error(`O manifest.json está na ${versao}, e a loja já tem a ${maiorNaLoja}. Suba o "version" antes.`);
  }

  exigirArvoreLimpa(arquivos);
  const zip = gerarZip(versao, arquivos);
  console.log(`\nSubindo ${path.relative(RAIZ, zip)}...`);
  const upload = await api(token, "POST", `/upload/v2/${ITEM}:upload`, fs.readFileSync(zip), "application/zip");
  if (upload.uploadState === "IN_PROGRESS" || upload.uploadState === "UPLOAD_IN_PROGRESS") {
    await esperarUpload(token);
  } else if (upload.uploadState !== "SUCCEEDED") {
    throw new Error(`Upload recusado pela loja: ${JSON.stringify(upload)}`);
  }
  console.log(`Pacote ${versao} recebido pela loja.`);

  if (args.includes("--upload-only")) {
    console.log("Não enviado para revisão (--upload-only). Envie pelo painel ou rode npm run publish.");
    return;
  }

  const publicado = await api(token, "POST", `/v2/${ITEM}:publish`, "{}", "application/json");
  console.log(`Enviado para revisão: ${publicado.state || "?"}`);
  for (const aviso of (publicado.warningInfo && publicado.warningInfo.warnings) || []) {
    console.log(`  aviso: ${aviso.reason} - ${aviso.description}`);
  }
}

main().catch((e) => {
  console.error(`\nErro: ${e.message}`);
  process.exit(1);
});
