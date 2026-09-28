// hub.js
// Feed real do Aviario Sonoro: le e grava posts no localStorage.
// Requer armazenamento.js e cursor.js incluidos ANTES deste arquivo.

const frases = [
    "Hoje o catalogo esta pronto para cantar.",
    "Escolha uma ave e entre no feed do Aviario.",
    "As penas sao coloridas, e o feed tambem.",
];

const usuarioAtual = usuarioLogado();
const listaFeed = document.getElementById("listaFeed");
const formNovoPost = document.getElementById("formNovoPost");
const mensagemPost = document.getElementById("mensagemPost");
const fraseDoDia = document.getElementById("frase-do-dia");
const campoFotoPost = document.getElementById("imagemPost");
const previaImagemPost = document.getElementById("previaImagemPost");

let imagemPostSelecionada = null;

if (fraseDoDia) {
    fraseDoDia.textContent = frases[new Date().getDay() % frases.length];
}

// Mini-perfil da barra lateral
if (usuarioAtual) {
    document.getElementById("nomeHub").textContent = usuarioAtual.nome;
    document.getElementById("usuarioHub").textContent = `@${usuarioAtual.usuario}`;
    document.getElementById("avatarHub").innerHTML = `<i class="fa-solid fa-fish" aria-hidden="true"></i>`;
}

function renderizarFeed() {
    const posts = listarPosts();
    listaFeed.innerHTML = "";

    if (posts.length === 0) {
        listaFeed.innerHTML = "<p>Nenhuma postagem ainda. Seja o primeiro a cantar!</p>";
        return;
    }

    posts.forEach((post) => {
        const jaCurtiu = Boolean(usuarioAtual) && post.curtidas.includes(usuarioAtual.id);

        const artigo = document.createElement("article");
        artigo.className = "post";
        artigo.innerHTML = `
            <div class="topo-post">
                <div class="avatar"><i class="fa-solid fa-fish" aria-hidden="true"></i></div>
                <div>
                    <strong>${escaparHTML(post.autorNome)}</strong>
                    <span>@${escaparHTML(post.autorUsuario)}</span>
                </div>
            </div>
            <p>${escaparHTML(post.texto)}</p>
            ${post.imagemUrl ? `<img src="${post.imagemUrl}" alt="Foto da postagem">` : ""}
            <div class="acoes-post">
                <button type="button" class="botao-curtir" data-id="${post.id}" ${
            usuarioAtual ? "" : "disabled title='Crie um perfil para curtir'"
        }>
                    ${jaCurtiu ? '<i class="fa-solid fa-heart" aria-hidden="true"></i>Descurtir' : '<i class="fa-regular fa-heart" aria-hidden="true"></i>Curtir'} (${post.curtidas.length})
                </button>
            </div>
        `;
        listaFeed.appendChild(artigo);
    });

    listaFeed.querySelectorAll(".botao-curtir").forEach((botao) => {
        botao.addEventListener("click", () => {
            if (!usuarioAtual) return;
            alternarLike(botao.dataset.id, usuarioAtual.id);
            renderizarFeed();
        });
    });
}

if (campoFotoPost) {
    campoFotoPost.addEventListener("change", async () => {
        const arquivo = campoFotoPost.files[0];
        imagemPostSelecionada = null;
        previaImagemPost.hidden = true;

        if (!arquivo) return;

        try {
            validarArquivoDeImagem(arquivo);
            imagemPostSelecionada = await redimensionarImagem(arquivo);
            previaImagemPost.src = imagemPostSelecionada;
            previaImagemPost.hidden = false;
            definirMensagem(mensagemPost, "");
        } catch (erro) {
            definirMensagem(mensagemPost, erro.message, "erro");
            campoFotoPost.value = "";
        }
    });
}

if (formNovoPost) {
    formNovoPost.addEventListener("submit", (evento) => {
        evento.preventDefault();

        if (!usuarioAtual) {
            definirMensagem(mensagemPost, "Crie um perfil para poder publicar.", "erro");
            return;
        }

        const campoTexto = document.getElementById("textoPost");
        const texto = campoTexto.value.trim();
        if (!texto) return;

        criarPost(usuarioAtual, texto, imagemPostSelecionada);

        campoTexto.value = "";
        if (campoFotoPost) campoFotoPost.value = "";
        imagemPostSelecionada = null;
        previaImagemPost.hidden = true;
        definirMensagem(mensagemPost, "");
        renderizarFeed();
    });
}

renderizarFeed();
