// Lê o PDF aberto do computador (file://) para o service worker, que não
// consegue fazer fetch de arquivo local. Devolve o conteúdo como data: URL.
chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (!msg || msg.type !== "lerArquivoLocal") return;
  fetch(msg.url)
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise((ok, falha) => {
          const leitor = new FileReader();
          leitor.onload = () => ok(leitor.result);
          leitor.onerror = () => falha(leitor.error);
          leitor.readAsDataURL(blob);
        })
    )
    .then((dataUrl) => responder({ dataUrl }))
    .catch((e) => responder({ erro: e && e.message ? e.message : String(e) }));
  return true;
});
