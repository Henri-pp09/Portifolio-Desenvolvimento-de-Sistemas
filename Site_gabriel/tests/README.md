# Validação da Issue #14

Execute dentro de `Site_gabriel/`:

```powershell
$env:ISSUE14_BROWSER = 'msedge'
node tests/issue14.cjs
```

Requer Node.js e o pacote Playwright disponível na resolução de módulos do Node
(por exemplo, via `NODE_PATH`). Usa o Edge instalado; também aceita `chrome` ou
`chromium` em `ISSUE14_BROWSER`. Não adiciona dependências ao site.

O teste cria um servidor temporário em `127.0.0.1`, abre um navegador sem janela
com contexto isolado e encerra ambos ao terminar. Os dados do navegador pessoal
não são acessados ou modificados. Defina `ISSUE14_SCREENSHOTS` com uma pasta para
salvar capturas de 375, 768 e 1440 px.

Os 15 grupos cobrem cadastro e login, preservação de usuários antigos, perfis
próprios e alheios, acesso público sem sessão, navegação pelo autor no feed,
posts separados por conta, fotos de posts, curtidas, uploads de avatar/banner,
favoritos adicionados e removidos pelo catálogo, separação entre contas,
favoritos antigos em IDs ou objetos, sincronização entre abas e retorno ao
perfil, nomes populares, busca científica, filtros, ficha e áudio local,
privacidade, texto malicioso, imagens inválidas, estado de carregamento,
troca de sessão durante um upload e responsividade.

As respostas de foto do iNaturalist são simuladas para que disponibilidade de
rede não altere o resultado. As consultas por nome científico e a seleção do
taxon continuam sendo exercitadas pelo código real. O áudio usa o arquivo MP3
local do Tucano-toco; o Sabiá-laranjeira tem estado de áudio indisponível porque
não possui gravação local nos dados atuais.

Perfis públicos continuam limitados aos usuários existentes no localStorage da
mesma origem e navegador. Esta implementação não publica contas na internet
nem estabelece autenticação de servidor. Espécies sem foto local têm uma
mensagem de imagem indisponível nos cards de favoritos.
