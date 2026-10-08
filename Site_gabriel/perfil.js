// Perfil público por ID; sem ID, mostra a conta da sessão existente.
// Requer armazenamento.js, especies.js e estado.js.
const parametrosPerfil = new URLSearchParams(window.location.search);
const mensagemPerfil = document.getElementById("mensagemPerfil");
const conteudoPerfil = document.getElementById("conteudoPerfil");
const controlesPerfil = document.getElementById("controlesPerfil");
const botaoSair = document.getElementById("botaoSair");
const campoAvatar = document.getElementById("campoAvatar");
const campoBanner = document.getElementById("campoBanner");
let perfilVisualizado = null;

function ehMeuPerfil() {
    const usuarioLogadoAtual = usuarioLogado();
    return Boolean(usuarioLogadoAtual && perfilVisualizado &&
        usuarioLogadoAtual.id === perfilVisualizado.id);
}

function renderizarFavoritos() {
    const lista = document.getElementById("listaFavoritos");
    lista.replaceChildren();
    const ids = listarFavoritos(perfilVisualizado.id);
    const favoritas = ESPECIES_CATALOGO.filter(especie => ids.includes(especie.id));
    document.getElementById("contagemFavoritos").textContent = favoritas.length;
    document.getElementById("rotuloFavoritos").textContent = favoritas.length === 1 ? "pássaro favorito" : "pássaros favoritos";
    document.getElementById("explorarCatalogo").hidden = !ehMeuPerfil();
    if (!favoritas.length) {
        const vazio = document.createElement("p");
        vazio.className = "estado-vazio";
        vazio.textContent = ehMeuPerfil()
            ? "Você ainda não favoritou nenhum pássaro."
            : "Este usuário ainda não favoritou nenhum pássaro.";
        lista.appendChild(vazio);
        return;
    }
    favoritas.forEach(especie => {
        const card = document.createElement("article");
        card.className = "card-favorito";
        const foto = document.createElement("div");
        foto.className = "foto-favorito";
        const reserva = document.createElement("span");
        reserva.textContent = "Foto não disponível";
        foto.appendChild(reserva);
        if (especie.fotoLocal) {
            const imagem = document.createElement("img");
            imagem.alt = especie.nomePopular || "Pássaro";
            imagem.loading = "lazy";
            imagem.decoding = "async";
            imagem.addEventListener("error", () => imagem.remove(), { once: true });
            imagem.src = especie.fotoLocal;
            foto.appendChild(imagem);
        }
        const nome = document.createElement("h3");
        nome.textContent = especie.nomePopular || "Pássaro";
        card.append(foto, nome);
        lista.appendChild(card);
    });
}

function renderizarPublicacoes() {
    const posts = postsDoUsuario(perfilVisualizado.id);
    document.getElementById("contagemPosts").textContent = posts.length;
    document.getElementById("rotuloPublicacoes").textContent = posts.length === 1 ? "publicação" : "publicações";
    const coluna = document.getElementById("colunaPosts");
    coluna.replaceChildren();
    if (!posts.length) {
        const vazio = document.createElement("p");
        vazio.className = "estado-vazio painel";
        vazio.textContent = ehMeuPerfil()
            ? "Você ainda não publicou nada."
            : "Este usuário ainda não publicou nada.";
        coluna.appendChild(vazio);
        return;
    }
    posts.forEach(post => {
        const artigo = document.createElement("article");
        artigo.className = "post";
        const texto = document.createElement("p");
        texto.textContent = post.texto;
        artigo.append(criarCabecalhoPost(post), texto);
        const midia = criarMidiaPost(post);
        if (midia) artigo.appendChild(midia);
        const curtidas = document.createElement("div");
        curtidas.className = "acoes-post";
        curtidas.textContent = `${Array.isArray(post.curtidas) ? post.curtidas.length : 0} curtida(s)`;
        artigo.appendChild(curtidas);
        coluna.appendChild(artigo);
    });
    informarFalhasDeImagem(coluna);
}

function renderizarPerfil() {
    atualizarNavegacaoDaSessao();
    controlesPerfil.hidden = true;
    botaoSair.hidden = true;
    campoAvatar.disabled = true;
    campoBanner.disabled = true;
    conteudoPerfil.hidden = true;
    // Um ID inválido nunca deve cair silenciosamente no perfil da sessão.
    perfilVisualizado = parametrosPerfil.has("id")
        ? buscarUsuarioPorId(parametrosPerfil.get("id"))
        : usuarioLogado();
    if (!perfilVisualizado) {
        definirMensagem(mensagemPerfil, parametrosPerfil.has("id")
            ? "Perfil não encontrado."
            : "Entre na sua conta para ver seu perfil.", parametrosPerfil.has("id") ? "erro" : "info");
        document.getElementById("entrarPerfil").hidden = parametrosPerfil.has("id");
        document.title = "Perfil | Aviário Sonoro";
        conteudoPerfil.removeAttribute("aria-busy");
        return;
    }
    const meuPerfil = ehMeuPerfil();
    document.getElementById("entrarPerfil").hidden = true;
    document.getElementById("nomePerfil").textContent = perfilVisualizado.nome || "Usuário do Aviário";
    document.getElementById("usuarioPerfil").textContent = `@${perfilVisualizado.usuario || "usuario"}`;
    document.getElementById("bioPerfil").textContent = perfilVisualizado.bio || "Este usuário ainda não escreveu uma bio.";
    document.title = `${perfilVisualizado.nome || "Perfil"} | Aviário Sonoro`;
    renderizarAvatar(document.getElementById("avatarPerfil"), perfilVisualizado);
    const banner = document.getElementById("bannerPerfil");
    banner.replaceChildren();
    const bannerUrl = urlImagemPermitida(perfilVisualizado.bannerUrl);
    if (bannerUrl) {
        const imagem = document.createElement("img");
        imagem.alt = `Banner de ${perfilVisualizado.nome || "usuário"}`;
        imagem.addEventListener("error", () => imagem.remove(), { once: true });
        imagem.src = bannerUrl;
        banner.appendChild(imagem);
    }
    controlesPerfil.hidden = !meuPerfil;
    botaoSair.hidden = !meuPerfil;
    campoAvatar.disabled = !meuPerfil;
    campoBanner.disabled = !meuPerfil;
    renderizarFavoritos();
    renderizarPublicacoes();
    definirMensagem(mensagemPerfil, "");
    conteudoPerfil.hidden = false;
    conteudoPerfil.removeAttribute("aria-busy");
}

function prepararUpload(campo, propriedade, dimensao, descricao) {
    campo.addEventListener("change", async () => {
        if (!ehMeuPerfil() || campo.disabled) return;
        const arquivo = campo.files[0];
        if (!arquivo) return;
        const donoId = perfilVisualizado.id;
        const rotulo = campo.closest(".rotulo-arquivo");
        const mensagem = document.getElementById("mensagemImagens");
        campo.disabled = true;
        rotulo.classList.add("em-carregamento");
        rotulo.setAttribute("aria-busy", "true");
        definirMensagem(mensagem, `Processando ${descricao}...`, "carregando");
        try {
            validarArquivoDeImagem(arquivo);
            const dataUrl = await redimensionarImagem(arquivo, dimensao);
            // Revalida a sessão depois do processamento assíncrono da foto.
            if (!ehMeuPerfil() || usuarioLogado()?.id !== donoId) {
                throw new Error("Entre novamente na sua conta para alterar esta imagem.");
            }
            if (!atualizarUsuario(donoId, { [propriedade]: dataUrl })) {
                throw new Error("Perfil não encontrado.");
            }
            renderizarPerfil();
            definirMensagem(mensagem, "Imagem do perfil atualizada!", "sucesso");
        } catch (erro) {
            definirMensagem(mensagem, erro.message, "erro");
        } finally {
            campo.value = "";
            campo.disabled = !ehMeuPerfil();
            rotulo.classList.remove("em-carregamento");
            rotulo.removeAttribute("aria-busy");
        }
    });
}

prepararUpload(campoAvatar, "avatarUrl", 300, "foto de perfil");
prepararUpload(campoBanner, "bannerUrl", 1200, "banner");
botaoSair.addEventListener("click", () => {
    if (!ehMeuPerfil()) return;
    encerrarSessao();
    navegarComTransicao("hub.html");
});
// Atualiza também ao voltar do catálogo e quando outra aba muda os dados.
window.addEventListener("pageshow", evento => {
    if (evento.persisted) renderizarPerfil();
});
window.addEventListener("storage", evento => {
    if ([CHAVE_USUARIOS, CHAVE_POSTS, CHAVE_SESSAO, null].includes(evento.key)) renderizarPerfil();
});
definirMensagem(mensagemPerfil, "Carregando perfil...", "carregando");
requestAnimationFrame(() => setTimeout(renderizarPerfil, 0));
