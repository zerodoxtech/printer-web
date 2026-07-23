# Extensão Chrome: Zerodox Printer Web (v1.0)

Repositório: https://github.com/tec-zerodox/zerodox-printer-web

## O que faz

O usuário clica no **ícone da extensão** (ou usa o botão direito, veja abaixo)
e ela decide sozinha o melhor caminho:

- **A aba é um PDF** (aberto direto ou embutido em iframe do ERP): envia o
  **arquivo original intacto** — OCR, orientação e tamanho exatamente como
  foram gerados. O nome do arquivo é extraído do cabeçalho
  `Content-Disposition` da resposta (ou do parâmetro
  `response-content-disposition` da URL, padrão usado por S3/CloudFront);
  se nenhum dos dois existir, usa o nome no caminho da URL.
- **A aba é uma página HTML** (guia gerada na tela pelo ERP): converte a página
  em **PDF pesquisável** usando o mesmo motor do "Salvar como PDF" do Chrome
  (texto preservado, sem virar imagem) e envia. Antes de enviar, o popup mostra
  um seletor **Retrato / Paisagem** para escolher a orientação do PDF gerado.

Nos dois casos o arquivo cai em `Downloads\zerodox` e o ícone da bandeja
(ConfigTray) move em até ~3 segundos para a pasta do Zerodox (`documents`).

Obs.: na conversão de HTML o Chrome exibe por alguns segundos uma barra
"...começou a depurar este navegador" — é o mecanismo oficial de conversão,
inofensivo, e fecha sozinho.

Nas **Configurações** da extensão dá para: trocar a subpasta de captura,
ligar o **modo automático** (hoje cobre apenas PDFs -- todo PDF
aberto/baixado é enviado sem clique) e escolher a **orientação padrão**
(Retrato/Paisagem) da conversão de HTML em PDF.

Essa orientação padrão começa **vazia** -- enquanto ninguém escolher e
salvar uma: o popup não vem com Retrato nem Paisagem pré-selecionado (é
preciso escolher antes de poder converter) e o menu de botão direito só
mostra as duas opções explícitas. Assim que alguém escolher e salvar, ela
passa a vir pré-selecionada no popup e ganha uma opção extra no topo do menu
de botão direito ("Zerodox: Enviar (Padrão: Retrato/Paisagem)") e um atalho
de teclado próprio -- mas as opções explícitas de Retrato/Paisagem continuam
sempre disponíveis pra sobrescrever pontualmente.

Importante: o Chrome PROÍBE extensões de salvar fora da pasta Downloads —
por isso não é possível gravar direto em D:\...\documents. O trajeto
Downloads\zerodox → documents é feito pelo ConfigTray automaticamente e leva
segundos; para o usuário final o efeito é "apareceu na pasta do Zerodox".

A impressora virtual continua existindo em paralelo para o ERP desktop
(que imprime de verdade e preserva texto por natureza).

## Publicação e atualização (Chrome Web Store, Não listada)

A extensão é distribuída pelo Chrome Web Store como **"Não listada"** (não
aparece em busca, só instala quem tiver o link direto). Isso resolve dois
problemas do modo "Carregar sem compactação":

- **Atualização automática de verdade**: o Chrome verifica e aplica
  versões novas sozinho, em segundo plano, sem precisar extrair .zip nem
  clicar em "Recarregar". Basta subir a versão nova na Play Console
  (Chrome Web Store Developer Dashboard) com o `version` do `manifest.json`
  incrementado.
- **Instalação em 1 clique**: não precisa mais ativar "Modo do
  desenvolvedor" nem usar "Carregar sem compactação" -- é só abrir o link
  da loja e clicar em "Usar no Chrome".

Veja `PRIVACY.md` (política de privacidade exigida pela loja, por causa das
permissões `debugger`/`webRequest`/`downloads`/acesso a todos os sites) e
`STORE-LISTING.md` (texto pronto pra colar no formulário de publicação,
incluindo a justificativa de cada permissão) nesta mesma pasta.

## Perfis por ERP (ajustes específicos de cada cliente)

Alguns ERPs mostram a guia dentro de um `<frameset>` clássico: um frame
pequeno com os botões ("Salvar e Imprimir") e outro frame com o formulário da
guia. O botão nativo deles nunca esconde o frame de botões via CSS -- ele
chama a impressão só dentro do frame de conteúdo, então o frame de botões
nunca entra na impressão. A extensão faz o mesmo: acha a URL do frame de
conteúdo e gera o PDF só a partir dele, numa aba oculta em segundo plano
(fecha sozinha depois).

O ClinicWeb (Linx) já está cadastrado (`clinicweb.linx.com.br`, frame
`mainFrame`). Pra próximos clientes com o mesmo problema, basta adicionar uma
entrada em `PERFIS_SITE` no `background.js` com o domínio e o seletor do
frame de conteúdo -- me manda o HTML da tela (Ctrl+U ou "Exibir código-fonte")
que eu identifico e cadastro. Sites sem cadastro ainda tentam um seletor
genérico (`mainFrame`, `main`, `conteudo`, `content`), que já cobre vários
ERPs parecidos automaticamente.

## Quando o ícone da extensão não aparece (janelas de "Visualizar guia")

Alguns ERPs (ex: ClinicWeb/Linx) abrem a guia numa **janela separada** via
`window.open()` com a barra de ferramentas reduzida (sem barra de endereço
completa, sem favoritos). O Chrome esconde a fileira de ícones de extensão
nessas janelas — não é um bug nosso, é assim que o navegador se comporta, e
por isso o ícone da extensão simplesmente não aparece ali.

Para esses casos, use o **botão direito do mouse** em qualquer lugar da
página e escolha:

- **"Zerodox: Enviar (Retrato)"**
- **"Zerodox: Enviar (Paisagem)"**

Funciona exatamente igual ao clique no ícone (detecta sozinho se é PDF ou
HTML) e mostra uma notificação do Windows confirmando o envio ou o erro.
Também dá pra usar os atalhos de teclado **Ctrl+Shift+Y** (Retrato) e
**Ctrl+Shift+U** (Paisagem) com a janela em foco — configuráveis em
`chrome://extensions/shortcuts`.

## Instalação (por máquina)

**Depois de publicada no Chrome Web Store** (veja seção acima): abra o link
da loja em cada máquina cliente e clique em "Usar no Chrome". Pronto --
sem Modo do desenvolvedor, sem copiar pasta, e atualiza sozinha depois.

Enquanto a publicação ainda não saiu do forno (ou pra testar uma alteração
antes de subir uma versão nova na loja), o modo antigo continua funcionando:

1. Copie a pasta `extensao-chrome` para a máquina (ex: `C:\ZerodoxExtensao`).
2. Chrome → menu ⋮ → Extensões → Gerenciar extensões
   (ou digite `chrome://extensions`).
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique **Carregar sem compactação** e selecione a pasta da extensão.
5. Teste: abra qualquer PDF numa aba do Chrome e confira a pasta
   `documents` do Zerodox (o arquivo passa por `Downloads\zerodox` e é movido
   em até ~3 segundos pelo ConfigTray, que precisa estar rodando).

## Evitar o prompt "Salvar como" do Windows/Chrome

Se o Chrome estiver configurado para "Perguntar onde salvar cada arquivo antes
de baixar" (`chrome://settings/downloads`), ele sempre mostra a janela de
salvar, mesmo a extensão já tendo decidido a pasta e o nome corretos —
nenhuma extensão consegue evitar esse prompt enquanto essa opção estiver
ligada, é uma trava do próprio navegador.

Duas formas de resolver, por máquina:

1. **Manual**: `chrome://settings/downloads` → desligar "Perguntar onde
   salvar cada arquivo antes de baixar".
2. **Automático (recomendado para várias máquinas)**: aplicar o arquivo
   `desligar-prompt-salvar.reg` (nesta mesma pasta) como administrador. Ele
   desliga a opção via política do Chrome a nível de máquina (chave
   `HKLM\SOFTWARE\Policies\Google\Chrome\PromptForDownloadLocation = 0`) e a
   deixa travada/cinza nas configurações, então o usuário não reativa sem
   querer. Precisa fechar e abrir o Chrome de novo depois.

Depois disso, ao clicar em "Enviar" na extensão, o arquivo vai direto para
`Downloads\zerodox` com o nome certo, sem nenhuma janela aparecer, e o
ConfigTray move para a pasta do Zerodox em segundos.

## Requisitos

- ConfigTray.exe em execução (ícone da bandeja) — ele é quem move os arquivos.
- A pasta de captura pode ser alterada no `config.json`
  (`C:\ProgramData\VirtualPdfPrinter\config.json`, campo `CaptureFolder`).

## Limitações conhecidas

- PDFs protegidos por sessões muito restritas (URL que só funciona uma vez)
  podem falhar na captura da visualização; o download manual sempre funciona.
- A extensão captura TODO PDF do navegador (foi a opção escolhida). Se algum
  cliente reclamar de arquivos indevidos na pasta, dá para filtrar por domínio
  do ERP editando o `background.js` (me peça que eu preparo).
