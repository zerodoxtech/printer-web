# Extensão Chrome: Zerodox Printer Web (v1.0)

Repositório: https://github.com/tec-zerodox/zerodox-printer-web

## O que faz

O usuário clica no **ícone da extensão** (ou usa o botão direito, veja
"Quando o ícone não aparece" mais abaixo) e ela decide sozinha o melhor
caminho:

- **A aba é um PDF** (aberto direto ou embutido em iframe do ERP): envia o
  **arquivo original intacto** — OCR, orientação e tamanho exatamente como
  foram gerados. O nome do arquivo é extraído do cabeçalho
  `Content-Disposition` da resposta (ou do parâmetro
  `response-content-disposition` da URL, padrão usado por S3/CloudFront);
  se nenhum dos dois existir, usa o nome no caminho da URL.
- **A aba é uma página HTML** (guia gerada na tela pelo ERP): converte a
  página em **PDF pesquisável** usando o mesmo motor do "Salvar como PDF"
  do Chrome (texto preservado, sem virar imagem) e envia. Antes de enviar,
  o popup mostra um seletor **Retrato / Paisagem** para escolher a
  orientação do PDF gerado (veja "Orientação padrão" abaixo).

Obs.: na conversão de HTML o Chrome exibe por alguns segundos uma barra
"...começou a depurar este navegador" — é o mecanismo oficial de
conversão, inofensivo, e fecha sozinho.

Em ambos os casos o arquivo cai numa subpasta de `Downloads` (o Chrome
proíbe extensões de salvar em qualquer outro lugar). O **NoPaper-Print-API**
é quem monitora essa subpasta e move o arquivo para a pasta `documents` do
Zerodox, em até ~3 segundos — não é a extensão quem faz esse último passo.

A impressora virtual continua existindo em paralelo para o ERP desktop
(que imprime de verdade e preserva texto por natureza).

## Configurações da extensão

- **Subpasta de captura**: nome da subpasta dentro de Downloads (padrão
  `zerodox`).
- **Modo automático**: hoje cobre só PDFs — todo PDF aberto/baixado é
  enviado sem precisar clicar.
- **Orientação padrão** (Retrato/Paisagem) da conversão HTML→PDF: começa
  **vazia**. Enquanto ninguém escolher e salvar uma: o popup não vem com
  nada pré-selecionado (é preciso escolher antes de poder converter) e o
  menu de botão direito só mostra as duas opções explícitas. Depois de
  escolhida e salva, ela passa a vir pré-selecionada no popup e ganha uma
  opção extra no topo do menu de botão direito ("Zerodox: Enviar (Padrão:
  Retrato/Paisagem)") e um atalho de teclado próprio — as opções explícitas
  continuam sempre disponíveis pra sobrescrever pontualmente.

## Quando o ícone da extensão não aparece (janelas de "Visualizar guia")

Alguns ERPs (ex: ClinicWeb/Linx) abrem a guia numa **janela separada** via
`window.open()` com a barra de ferramentas reduzida. O Chrome esconde a
fileira de ícones de extensão nesse tipo de janela — não é um bug nosso, é
assim que o navegador se comporta.

Nesses casos, use o **botão direito do mouse** em qualquer lugar da página:

- **"Zerodox: Enviar (Retrato)"**
- **"Zerodox: Enviar (Paisagem)"**
- **"Zerodox: Enviar (Padrão: ...)"** (só aparece se você configurou uma
  orientação padrão)

Funciona igual ao clique no ícone (detecta sozinho se é PDF ou HTML) e
mostra uma notificação do Windows confirmando o envio ou o erro, já que
esse fluxo não abre o popup. Também dá pra usar atalhos de teclado
(configuráveis em `chrome://extensions/shortcuts`).

## Perfis por ERP (ajustes específicos de cada cliente)

Alguns ERPs mostram a guia dentro de um `<frameset>` clássico: um frame
pequeno com os botões ("Salvar e Imprimir") e outro frame com o formulário
da guia. O botão nativo deles nunca esconde o frame de botões via CSS — ele
chama a impressão só dentro do frame de conteúdo, então o frame de botões
nunca entra na impressão. A extensão faz o mesmo: acha a URL do frame de
conteúdo e gera o PDF só a partir dele, numa aba oculta em segundo plano
(fecha sozinha depois).

O ClinicWeb (Linx) já está cadastrado (`clinicweb.linx.com.br`, frame
`mainFrame`). Pra próximos clientes com o mesmo problema, adicione uma
entrada em `PERFIS_SITE` no `background.js` com o domínio e o seletor do
frame de conteúdo — me manda o HTML da tela (Ctrl+U ou "Exibir
código-fonte") que eu identifico e cadastro. Sites sem cadastro ainda
tentam um seletor genérico (`mainFrame`, `main`, `conteudo`, `content`),
que já cobre vários ERPs parecidos automaticamente.

## Instalação e atualização

A extensão é distribuída pelo Chrome Web Store como **"Não listada"** (não
aparece em busca, só instala quem tiver o link direto). Basta abrir o link
da loja em cada máquina e clicar em "Usar no Chrome" — sem Modo do
desenvolvedor, sem copiar pasta. Atualizações de versão também são
automáticas: o Chrome verifica e aplica sozinho, em segundo plano; basta
subir a versão nova no Developer Dashboard com o `version` do
`manifest.json` incrementado.

Veja `PRIVACY.md` (política de privacidade exigida pela loja) e
`STORE-LISTING.md` (texto pronto pra colar no formulário de publicação)
nesta mesma pasta.

Enquanto a conta ainda estiver em análise (ou pra testar uma alteração
antes de subir uma versão nova na loja), instale manualmente:

1. Copie a pasta da extensão para a máquina (ex: `C:\ZerodoxExtensao`).
2. Chrome → menu ⋮ → Extensões → Gerenciar extensões (ou digite
   `chrome://extensions`).
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique **Carregar sem compactação** e selecione a pasta.
5. Teste: abra qualquer PDF numa aba do Chrome e confira se ele aparece na
   pasta `documents` do Zerodox (passa por `Downloads\zerodox` e o
   NoPaper-Print-API move em até ~3 segundos — ele precisa estar rodando).

## Evitar o prompt "Salvar como" do Windows/Chrome

Se o Chrome estiver configurado para "Perguntar onde salvar cada arquivo
antes de baixar" (`chrome://settings/downloads`), ele sempre mostra a
janela de salvar, mesmo a extensão já tendo decidido a pasta e o nome
corretos — nenhuma extensão consegue evitar esse prompt enquanto essa opção
estiver ligada, é uma trava do próprio navegador.

Duas formas de resolver, por máquina:

1. **Manual**: `chrome://settings/downloads` → desligar "Perguntar onde
   salvar cada arquivo antes de baixar".
2. **Automático (recomendado para várias máquinas)**: aplicar o arquivo
   `desligar-prompt-salvar.reg` (nesta mesma pasta) como administrador. Ele
   desliga a opção via política do Chrome a nível de máquina e a deixa
   travada/cinza nas configurações. Precisa fechar e abrir o Chrome de novo
   depois.

## Requisitos

- **NoPaper-Print-API** em execução — é quem monitora a subpasta de
  captura e move os arquivos para `documents`.
- A subpasta monitorada deve ser a mesma configurada nas Opções da
  extensão.

## Limitações conhecidas

- PDFs protegidos por sessões muito restritas (URL que só funciona uma
  vez) podem falhar na captura da visualização; o download manual sempre
  funciona.
- A extensão captura TODO PDF do navegador (foi a opção escolhida). Se
  algum cliente reclamar de arquivos indevidos na pasta, dá pra filtrar por
  domínio do ERP editando o `background.js` (me peça que eu preparo).
