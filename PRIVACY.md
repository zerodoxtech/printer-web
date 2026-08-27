# Política de Privacidade — Zerodox Printer Web

Última atualização: 22/07/2026

A extensão **Zerodox Printer Web** é uma ferramenta de uso interno criada
pela Zerodox para ajudar profissionais de saúde e equipes administrativas a
enviar guias e documentos (PDFs de operadoras de convênio, guias geradas por
sistemas de ERP como ClinicWeb, etc.) para o sistema Zerodox, preservando o
texto pesquisável (OCR) e a orientação original do documento.

## O que a extensão faz

- Detecta quando a aba ativa está exibindo um arquivo PDF (aberto
  diretamente ou embutido num iframe) e, quando a pessoa clica para enviar,
  baixa esse PDF **exatamente como foi gerado pelo site de origem** para
  uma subpasta dentro da pasta padrão de Downloads do navegador.
- Detecta quando a aba ativa é uma página HTML de um ERP (uma guia gerada na
  tela, sem link direto para PDF) e, quando a pessoa clica para enviar,
  converte essa página em um PDF pesquisável usando o mecanismo de
  impressão nativo do próprio Chrome (o mesmo motor usado pelo recurso
  "Salvar como PDF"), e salva o resultado na mesma subpasta de Downloads.
- Um aplicativo separado, de instalação local (NoPaper-Print-API, não
  incluso nesta extensão), monitora essa subpasta e move os arquivos para a
  pasta de trabalho do sistema Zerodox no computador da pessoa.

## Quais dados a extensão acessa

- **URLs e cabeçalhos de resposta HTTP** das páginas abertas nas abas do
  navegador -- usado apenas para detectar se o conteúdo é um PDF e para
  extrair o nome de arquivo original (via cabeçalho `Content-Disposition`),
  garantindo que o arquivo salvo tenha o mesmo nome que teria se baixado
  manualmente.
- **Conteúdo da página ativa**, apenas no momento em que a pessoa clica
  para converter uma página HTML em PDF -- necessário para gerar o PDF a
  partir do conteúdo renderizado na tela (guia, formulário, etc.).
- **Configurações da própria extensão** (nome da subpasta de Downloads,
  orientação padrão escolhida, se o modo automático está ligado) --
  guardadas localmente pelo mecanismo de sincronização de configurações do
  próprio Chrome (`chrome.storage`), vinculado à conta Google da pessoa que
  usa o navegador, do mesmo jeito que qualquer outra extensão guarda
  preferências.

## O que a extensão NÃO faz

- **Não envia nenhum dado para servidores da Zerodox, de terceiros ou de
  qualquer serviço de analytics/rastreamento.** Toda a atividade da
  extensão acontece localmente, dentro do navegador da pessoa e do
  computador dela.
- Não lê, coleta nem transmite senhas, dados de login, dados de pagamento,
  histórico de navegação ou qualquer informação além do necessário para
  identificar e converter o documento que a própria pessoa escolheu enviar.
- Não compartilha, vende nem usa os dados de nenhuma outra forma além da
  descrita acima.

## Por que a extensão pede permissões amplas

- **`<all_urls>` / acesso a todos os sites**: necessário porque cada
  cliente da Zerodox usa um sistema de ERP diferente, com domínios
  diferentes (ClinicWeb, portais de operadoras de convênio, etc.); não é
  possível prever de antemão em qual site a pessoa vai precisar enviar um
  documento.
- **`debugger`**: usado exclusivamente para acionar o comando
  `Page.printToPDF` do próprio Chrome (o mesmo mecanismo interno por trás
  do "Salvar como PDF"), que é a única forma de converter uma página HTML
  em PDF pesquisável programaticamente. Não é usado para inspecionar,
  registrar ou alterar nada além do necessário para essa conversão, e a
  conexão de depuração é encerrada imediatamente após gerar o PDF.
- **`webRequest`**: usado apenas para ler o cabeçalho `Content-Disposition`
  das respostas HTTP e identificar PDFs, sem modificar nenhuma requisição.
- **`downloads`**: usado para salvar o PDF (original ou convertido) na
  subpasta configurada dentro de Downloads.
- **`scripting`**: usado para pequenos ajustes de layout na página antes de
  gerar o PDF (remover barras de rolagem internas que cortariam o
  conteúdo, ocultar botões da tela que não devem aparecer no PDF impresso).
- **`storage`**: guarda as preferências da extensão (subpasta, orientação
  padrão, modo automático).
- **`contextMenus`, `notifications`, `tabs`, `commands`**: usados para o
  menu de botão direito, atalhos de teclado e avisos de sucesso/erro ao
  enviar um documento.

## Contato

Dúvidas sobre esta política ou sobre a extensão: entre em contato com a
equipe Zerodox pelo repositório
https://github.com/zerodoxtech/printer-web.
