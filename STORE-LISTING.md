# Texto para o formulário de publicação (Chrome Web Store Developer Dashboard)

Publicação: **Não listada** ("Unlisted" -- não aparece em busca, só quem
tiver o link direto consegue instalar). Link do Dashboard:
https://chrome.google.com/webstore/devconsole

## Descrição curta (até 132 caracteres)

```
Envia PDFs originais (com OCR) ou converte páginas HTML de ERPs em PDF pesquisável para o sistema Zerodox.
```
(106 caracteres)

## Descrição detalhada

```
Zerodox Printer Web ajuda equipes que usam sistemas de ERP de saúde
(ClinicWeb e outros) a enviar guias e documentos para o sistema Zerodox
sem perder o texto pesquisável (OCR) nem a orientação original -- o
problema comum de imprimir/converter esses documentos por outros meios.

Como funciona:

- Se a aba tem um PDF aberto (direto ou embutido numa guia do ERP), a
  extensão envia o arquivo ORIGINAL, exatamente como foi gerado, mantendo
  OCR e orientação intactos.

- Se a aba mostra uma página HTML (uma guia renderizada na tela pelo ERP,
  sem link de PDF), a extensão converte a página num PDF pesquisável
  usando o mecanismo nativo de impressão do próprio Chrome, com opção de
  orientação Retrato ou Paisagem.

Em ambos os casos, o arquivo é salvo numa subpasta configurável dentro da
pasta padrão de Downloads do navegador, pronta para um aplicativo local
(fora desta extensão) organizar dentro do sistema Zerodox.

Funciona também em janelas de ERP com barra de ferramentas reduzida (onde
o ícone da extensão não aparece), através de um menu de botão direito e
atalhos de teclado configuráveis.

Esta é uma ferramenta de uso interno da Zerodox e de seus clientes. Não
coleta, envia nem compartilha dados com nenhum servidor -- toda a
atividade acontece localmente no navegador da pessoa. Veja a política de
privacidade completa: https://raw.githubusercontent.com/zerodoxtech/printer-web/main/PRIVACY.md
```

## Categoria sugerida

Produtividade

## Idioma

Português (Brasil)

## Assets necessários (preparar antes de submeter)

- Ícone 128x128: já existe em `icons/icon128.png`.
- Pelo menos 1 screenshot (1280x800 ou 640x400): tirar um print do popup
  em uso (aba com PDF detectado, ou aba HTML com o seletor de orientação
  visível). Não consigo gerar isso aqui porque preciso ver a extensão
  rodando de verdade no seu navegador -- me manda um print quando puder
  que eu ajudo a redimensionar/ajustar se precisar.
- (Opcional, mas recomendado) trocar os ícones atuais pelos oficiais da
  Zerodox quando você mandar os arquivos -- os que estão na pasta hoje são
  uma reconstrução aproximada da logo, feita a partir de screenshots.

## Aba "Privacy practices" do Dashboard

**Finalidade única (single purpose)**:
```
Capturar documentos PDF originais de abas do navegador, ou converter
páginas HTML de sistemas de ERP em PDF pesquisável, e organizá-los numa
pasta local para importação no sistema Zerodox.
```

**Justificativa de cada permissão** (copiar no campo correspondente):

- **Acesso a todos os sites (`<all_urls>`)**: cada cliente usa um ERP em
  domínio diferente (ClinicWeb, portais de operadoras de convênio, etc);
  não dá pra prever de antemão em qual site a pessoa vai precisar enviar
  um documento, por isso o acesso precisa cobrir qualquer site.
- **`debugger`**: usado só para acionar o comando `Page.printToPDF` do
  próprio Chrome (o motor interno do "Salvar como PDF"), única forma de
  gerar um PDF pesquisável a partir de uma página HTML programaticamente.
  A conexão de depuração é aberta e fechada automaticamente em cada
  conversão, sem inspecionar nem alterar mais nada na página.
- **`webRequest`**: usado só para ler o cabeçalho `Content-Disposition`
  das respostas HTTP e identificar PDFs / extrair o nome de arquivo
  original, sem modificar nenhuma requisição.
- **`downloads`**: salva o PDF (original ou convertido) na subpasta de
  Downloads configurada pela pessoa.
- **`scripting`**: ajustes de layout na página antes de gerar o PDF
  (remove rolagem interna que cortaria conteúdo, oculta botões que não
  devem aparecer no PDF).
- **`storage`**: guarda as preferências da extensão localmente (subpasta
  de destino, orientação padrão, modo automático).
- **`tabs`**: identifica qual aba está ativa e sua URL/título, para saber
  o que enviar e nomear o arquivo.
- **`contextMenus`**: adiciona o menu de botão direito "Zerodox: Enviar",
  alternativa ao ícone da extensão em janelas com barra reduzida.
- **`notifications`**: mostra avisos de sucesso/erro ao enviar um
  documento, já que em alguns fluxos (menu de botão direito) não há popup
  visível pra mostrar o resultado.

**Uso remoto de código**: Não. Todo o código roda localmente, incluído no
pacote da extensão; nenhum script é baixado ou executado de fora.

**Coleta de dados do usuário**: Não coleta, transmite nem vende nenhum
dado. Ver `PRIVACY.md` para o texto completo da política de privacidade.
