// armazenamento.js
// Camada unica de dados do Aviario Sonoro.
// Tudo fica gravado no localStorage do proprio navegador do usuario -
// nao existe backend nem banco de dados nesta versao do projeto.
//
// Inclua este arquivo ANTES dos outros scripts da pagina, assim:
// <script src="armazenamento.js"></script>
// <script src="hub.js"></script>

const CHAVE_USUARIOS = "aviario_usuarios";
const CHAVE_SESSAO = "aviario_sessao";
const CHAVE_POSTS = "aviario_posts";

// ---------- Utilidades ----------

function lerDadosLocais(chave, padrao) {
    try {
        return JSON.parse(localStorage.getItem(chave)) ?? padrao;
    } catch {
        return padrao;
    }
}

function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Evita que texto digitado pelo usuario vire HTML/JS quando exibido na tela.
function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

// Gera um hash da senha usando a Web Crypto API do proprio navegador.
// Isso evita guardar a senha em texto puro no localStorage.
// Importante: como nao existe servidor, isso NAO substitui uma autenticacao
// real de producao - serve para nao deixar a senha "a vista" no navegador
// de quem esta usando o site localmente.
async function gerarHashSenha(senha) {
    const dados = new TextEncoder().encode(senha);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dados);
    return Array.from(new Uint8Array(hashBuffer))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function iniciais(nome) {
    return (
        (nome || "")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((parte) => parte[0])
            .join("")
            .toUpperCase() || "AS"
    );
}

// ---------- Imagens (posts, avatar, banner) ----------
// Como tudo fica no localStorage, imagens sao guardadas como Data URL
// (texto base64) dentro do proprio JSON. Para nao estourar o limite de
// espaco do localStorage (geralmente 5-10MB por site), toda imagem e
// redimensionada e comprimida antes de ser salva.

function validarArquivoDeImagem(arquivo, tamanhoMaximoEmMB = 8) {
    if (!arquivo.type.startsWith("image/")) {
        throw new Error("Escolha um arquivo de imagem (jpg, png, webp, etc).");
    }
    if (arquivo.size > tamanhoMaximoEmMB * 1024 * 1024) {
        throw new Error(`A imagem deve ter no maximo ${tamanhoMaximoEmMB}MB.`);
    }
}

function redimensionarImagem(arquivo, dimensaoMaxima = 800, qualidade = 0.75) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();

        leitor.onerror = () => reject(new Error("Nao foi possivel ler o arquivo."));
        leitor.onload = () => {
            const imagem = new Image();

            imagem.onerror = () => reject(new Error("Arquivo nao parece ser uma imagem valida."));
            imagem.onload = () => {
                const escala = Math.min(1, dimensaoMaxima / Math.max(imagem.width, imagem.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(imagem.width * escala);
                canvas.height = Math.round(imagem.height * escala);

                const contexto = canvas.getContext("2d");
                if (!contexto) { reject(new Error("Não foi possível processar a imagem.")); return; }
                contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);

                resolve(canvas.toDataURL("image/jpeg", qualidade));
            };

            imagem.src = leitor.result;
        };

        leitor.readAsDataURL(arquivo);
    });
}

// ---------- Usuarios ----------

function listarUsuarios() {
    const usuarios = lerDadosLocais(CHAVE_USUARIOS, []);
    return Array.isArray(usuarios) ? usuarios : [];
}

function salvarUsuarios(usuarios) {
    localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));
}

async function cadastrarUsuario({ nome, usuario, bio, senha }) {
    if (!nome || !usuario || !senha) {
        throw new Error("Preencha nome, usuario e senha.");
    }

    const usuarios = listarUsuarios();

    if (usuarios.some((u) => u.usuario === usuario)) {
        throw new Error("Esse nome de usuario ja existe. Escolha outro.");
    }

    const novoUsuario = {
        id: gerarId(),
        nome,
        usuario,
        bio: bio || "",
        senhaHash: await gerarHashSenha(senha),
        criadoEm: new Date().toISOString(),
    };

    usuarios.push(novoUsuario);
    salvarUsuarios(usuarios);
    return novoUsuario;
}

async function autenticarUsuario(usuario, senha) {
    const usuarios = listarUsuarios();
    const senhaHash = await gerarHashSenha(senha);
    return usuarios.find((u) => u.usuario === usuario && u.senhaHash === senhaHash) || null;
}

function buscarUsuarioPorId(id) {
    return listarUsuarios().find((u) => u.id === id) || null;
}

// Atualiza campos soltos do usuario (avatarUrl, bannerUrl, favoritos, etc.)
// sem precisar reescrever o objeto inteiro na mao.
function atualizarUsuario(usuarioId, camposNovos) {
    const usuarios = listarUsuarios();
    const indice = usuarios.findIndex((u) => u.id === usuarioId);
    if (indice === -1) return null;

    usuarios[indice] = { ...usuarios[indice], ...camposNovos };
    salvarUsuarios(usuarios);
    return usuarios[indice];
}

// Adiciona/remove uma especie (pelo id em ESPECIES_CATALOGO) da lista de
// favoritos do usuario.
function alternarFavorito(usuarioId, especieId) {
    const usuario = buscarUsuarioPorId(usuarioId);
    if (!usuario) return null;

    const favoritosAtuais = listarFavoritos(usuarioId);
    const novosFavoritos = favoritosAtuais.includes(especieId)
        ? favoritosAtuais.filter((id) => id !== especieId)
        : [...favoritosAtuais, especieId];

    return atualizarUsuario(usuarioId, { favoritos: novosFavoritos });
}

// ---------- Sessao (quem esta logado neste navegador agora) ----------

function iniciarSessao(usuarioId) {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify({ usuarioId }));
}

function encerrarSessao() {
    localStorage.removeItem(CHAVE_SESSAO);
}

function usuarioLogado() {
    const sessao = lerDadosLocais(CHAVE_SESSAO, null);
    if (!sessao) return null;
    return buscarUsuarioPorId(sessao.usuarioId);
}

// ---------- Posts ----------

function listarPosts() {
    const dados = lerDadosLocais(CHAVE_POSTS, []);
    const posts = Array.isArray(dados) ? dados : [];
    return posts.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
}

function salvarPosts(posts) {
    localStorage.setItem(CHAVE_POSTS, JSON.stringify(posts));
}

function criarPost(autor, texto, imagemUrl = null) {
    const posts = listarPosts();
    const novoPost = {
        id: gerarId(),
        autorId: autor.id,
        autorNome: autor.nome,
        autorUsuario: autor.usuario,
        texto,
        imagemUrl: imagemUrl || null, // null = post sem imagem (compativel com posts antigos)
        criadoEm: new Date().toISOString(),
        curtidas: [], // guarda os IDs de quem curtiu, para nao deixar curtir 2x
    };
    posts.push(novoPost);
    salvarPosts(posts);
    return novoPost;
}

// Curtir/descurtir. Impede que o mesmo usuario conte 2 curtidas no mesmo post.
function alternarLike(postId, usuarioId) {
    const posts = listarPosts();
    const post = posts.find((p) => p.id === postId);
    if (!post) return null;

    const curtidas = Array.isArray(post.curtidas) ? post.curtidas : [];
    const jaCurtiu = curtidas.includes(usuarioId);
    post.curtidas = jaCurtiu
        ? curtidas.filter((id) => id !== usuarioId)
        : [...curtidas, usuarioId];

    salvarPosts(posts);
    return post;
}

function postsDoUsuario(usuarioId) {
    return listarPosts().filter((p) => p.autorId === usuarioId);
}

// Compatibilidade com favoritos salvos nas duas versões anteriores.
function listarFavoritos(usuarioId) {
    const usuario = buscarUsuarioPorId(usuarioId);
    const favoritos = Array.isArray(usuario?.favoritos) ? usuario.favoritos : [];
    return [...new Set(favoritos.map((favorito) => {
        if (typeof favorito === "string") return favorito;
        return favorito?.id || (typeof ESPECIES_CATALOGO !== "undefined"
            ? ESPECIES_CATALOGO.find((ave) => ave.nomeCientifico === favorito?.nomeCientifico)?.id
            : null);
    }).filter(Boolean))];
}
