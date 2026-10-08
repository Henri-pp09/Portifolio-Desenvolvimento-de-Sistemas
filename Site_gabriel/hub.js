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
    const acaoPerfil = document.getElementById("acaoPerfilHub");
    acaoPerfil.href = "perfil.html";
    acaoPerfil.querySelector("i").className = "fa-solid fa-address-card";
    acaoPerfil.querySelector("span").textContent = "Ver meu perfil";
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
            ${post.imagemUrl ? `<div class="midia-post"><img src="${escaparHTML(post.imagemUrl)}" alt="Imagem publicada por @${escaparHTML(post.autorUsuario)}" loading="lazy" decoding="async"></div>` : ""}
            <div class="acoes-post">
                <button type="button" class="botao-curtir" data-id="${post.id}" aria-pressed="${jaCurtiu}" aria-label="${jaCurtiu ? "Remover curtida" : "Curtir publicação"}" ${
            usuarioAtual ? "" : "disabled title='Crie um perfil para curtir'"
        }>
                    <i class="${jaCurtiu ? "fa-solid" : "fa-regular"} fa-heart" aria-hidden="true"></i><span>${post.curtidas.length}</span>
                </button>
            </div>
        `;
        listaFeed.appendChild(artigo);
    });

    informarFalhasDeImagem(listaFeed);

    listaFeed.querySelectorAll(".botao-curtir").forEach((botao) => {
        botao.addEventListener("click", () => {
            if (!usuarioAtual) return;
            const curtiu = botao.getAttribute("aria-pressed") === "true";
            alternarLike(botao.dataset.id, usuarioAtual.id);
            renderizarFeed();
            definirMensagem(mensagemPost, curtiu ? "Curtida removida." : "Curtida registrada.", "sucesso");
        });
    });
}

if (campoFotoPost) {
    campoFotoPost.addEventListener("change", async () => {
        const arquivo = campoFotoPost.files[0];
        const rotuloArquivo = campoFotoPost.closest(".rotulo-arquivo");
        imagemPostSelecionada = null;
        previaImagemPost.hidden = true;

        if (!arquivo) return;

        campoFotoPost.disabled = true;
        rotuloArquivo?.classList.add("em-carregamento");
        rotuloArquivo?.setAttribute("aria-busy", "true");
        definirMensagem(mensagemPost, "Preparando imagem...", "carregando");

        try {
            validarArquivoDeImagem(arquivo);
            imagemPostSelecionada = await redimensionarImagem(arquivo);
            previaImagemPost.src = imagemPostSelecionada;
            previaImagemPost.hidden = false;
            definirMensagem(mensagemPost, "Imagem pronta para publicar.", "sucesso");
        } catch (erro) {
            definirMensagem(mensagemPost, erro.message, "erro");
            campoFotoPost.value = "";
        } finally {
            campoFotoPost.disabled = false;
            rotuloArquivo?.classList.remove("em-carregamento");
            rotuloArquivo?.removeAttribute("aria-busy");
        }
    });
}

if (formNovoPost) {
    formNovoPost.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        if (!usuarioAtual) {
            definirMensagem(mensagemPost, "Crie um perfil para poder publicar.", "erro");
            return;
        }

        const botao = formNovoPost.querySelector("button[type=submit]");
        if (botao.disabled || !validarFormulario(formNovoPost, mensagemPost)) return;
        const campoTexto = document.getElementById("textoPost");
        const texto = campoTexto.value.trim();
        if (!texto) return;

        if (campoFotoPost?.disabled) {
            definirMensagem(mensagemPost, "Aguarde a preparação da imagem antes de publicar.", "carregando");
            return;
        }
        definirBotaoCarregando(botao, true, "Publicando...");
        formNovoPost.setAttribute("aria-busy", "true");
        definirMensagem(mensagemPost, "Publicando...", "carregando");
        try {
            // Permite ao navegador pintar o estado antes da gravação síncrona.
            await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
            criarPost(usuarioAtual, texto, imagemPostSelecionada);
        } catch (erro) {
            definirMensagem(mensagemPost, "Não foi possível salvar. O armazenamento pode estar cheio; tente uma foto menor.", "erro");
            return;
        } finally {
            definirBotaoCarregando(botao, false);
            formNovoPost.removeAttribute("aria-busy");
        }

        campoTexto.value = "";
        if (campoFotoPost) campoFotoPost.value = "";
        imagemPostSelecionada = null;
        previaImagemPost.hidden = true;
        definirMensagem(mensagemPost, "Publicação criada com sucesso.", "sucesso");
        renderizarFeed();
    });
}

renderizarFeed();
