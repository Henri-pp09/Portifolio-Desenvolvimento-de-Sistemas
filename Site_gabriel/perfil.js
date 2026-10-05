// perfil.js
// Mostra os dados reais do usuario logado, seus posts, e permite alterar
// avatar, banner e passaros favoritos.
// Requer armazenamento.js, especies.js e cursor.js incluidos ANTES deste arquivo.

const usuarioAtual = usuarioLogado();

if (!usuarioAtual) {
    // Ninguem logado neste navegador: manda para o login em vez de
    // mostrar um perfil fictício.
    window.location.href = "login.html";
} else {
    document.getElementById("nomePerfil").textContent = usuarioAtual.nome;
    document.getElementById("bioPerfil").textContent =
        usuarioAtual.bio || "Esse usuario ainda nao escreveu uma bio.";
    document.getElementById("usuarioPerfil").textContent = `@${usuarioAtual.usuario}`;

    const avatarEl = document.getElementById("avatarPerfil");
    if (usuarioAtual.avatarUrl) {
        avatarEl.style.backgroundImage = `url(${usuarioAtual.avatarUrl})`;
        avatarEl.style.backgroundSize = "cover";
        avatarEl.style.backgroundPosition = "center";
        avatarEl.textContent = "";
    } else {
        avatarEl.innerHTML = `<i class="fa-solid fa-fish" aria-hidden="true"></i>`;
    }

    const capaPerfil = document.getElementById("capaPerfil");
    if (usuarioAtual.bannerUrl && capaPerfil) {
        capaPerfil.style.backgroundImage = `linear-gradient(135deg, rgba(13, 54, 58, 0.85), rgba(255, 122, 69, 0.35)), url(${usuarioAtual.bannerUrl})`;
    }

    const meusPosts = postsDoUsuario(usuarioAtual.id);
    const contagemPosts = document.getElementById("contagemPosts");
    if (contagemPosts) contagemPosts.textContent = meusPosts.length;

    const colunaPosts = document.getElementById("colunaPosts");
    colunaPosts.innerHTML = "";

    if (meusPosts.length === 0) {
        colunaPosts.innerHTML =
            "<p>Voce ainda nao publicou nada. Va ate o feed e cante alguma coisa!</p>";
    } else {
        meusPosts.forEach((post) => {
            const artigo = document.createElement("article");
            artigo.className = "post";
            artigo.innerHTML = `
                <div class="topo-post">
                    <div class="avatar"><i class="fa-solid fa-fish" aria-hidden="true"></i></div>
                    <div><strong>${escaparHTML(usuarioAtual.nome)}</strong></div>
                </div>
                <p>${escaparHTML(post.texto)}</p>
                ${post.imagemUrl ? `<img src="${post.imagemUrl}" alt="Foto da postagem" loading="lazy">` : ""}
                <div class="acoes-post">
                    <span>${post.curtidas.length} curtida(s)</span>
                </div>
            `;
            colunaPosts.appendChild(artigo);
        });
    }

    // ---------- Avatar e banner ----------
    const campoAvatar = document.getElementById("campoAvatar");
    const campoBanner = document.getElementById("campoBanner");
    const mensagemImagens = document.getElementById("mensagemImagens");

    if (campoAvatar) {
        campoAvatar.addEventListener("change", async () => {
            const arquivo = campoAvatar.files[0];
            if (!arquivo) return;

            const rotuloArquivo = campoAvatar.closest(".rotulo-arquivo");
            campoAvatar.disabled = true;
            rotuloArquivo?.classList.add("em-carregamento");
            rotuloArquivo?.setAttribute("aria-busy", "true");
            definirMensagem(mensagemImagens, "Processando foto de perfil...", "carregando");

            try {
                validarArquivoDeImagem(arquivo);
                const dataUrl = await redimensionarImagem(arquivo, 300);
                atualizarUsuario(usuarioAtual.id, { avatarUrl: dataUrl });
                definirMensagem(mensagemImagens, "Foto de perfil atualizada!", "sucesso");
                setTimeout(() => navegarComTransicao(window.location.href), 500);
            } catch (erro) {
                definirMensagem(mensagemImagens, erro.message, "erro");
            } finally {
                campoAvatar.disabled = false;
                rotuloArquivo?.classList.remove("em-carregamento");
                rotuloArquivo?.removeAttribute("aria-busy");
            }
        });
    }

    if (campoBanner) {
        campoBanner.addEventListener("change", async () => {
            const arquivo = campoBanner.files[0];
            if (!arquivo) return;

            const rotuloArquivo = campoBanner.closest(".rotulo-arquivo");
            campoBanner.disabled = true;
            rotuloArquivo?.classList.add("em-carregamento");
            rotuloArquivo?.setAttribute("aria-busy", "true");
            definirMensagem(mensagemImagens, "Processando banner...", "carregando");

            try {
                validarArquivoDeImagem(arquivo);
                const dataUrl = await redimensionarImagem(arquivo, 1200);
                atualizarUsuario(usuarioAtual.id, { bannerUrl: dataUrl });
                definirMensagem(mensagemImagens, "Banner atualizado!", "sucesso");
                setTimeout(() => navegarComTransicao(window.location.href), 500);
            } catch (erro) {
                definirMensagem(mensagemImagens, erro.message, "erro");
            } finally {
                campoBanner.disabled = false;
                rotuloArquivo?.classList.remove("em-carregamento");
                rotuloArquivo?.removeAttribute("aria-busy");
            }
        });
    }

    // ---------- Passaros favoritos ----------
    const listaFavoritos = document.getElementById("listaFavoritos");

    function renderizarFavoritos() {
        if (!listaFavoritos) return;
        listaFavoritos.innerHTML = "";

        ESPECIES_CATALOGO.forEach((especie) => {
            const favoritado = listarFavoritos(usuarioAtual.id).includes(especie.id);

            const item = document.createElement("button");
            item.type = "button";
            item.setAttribute("aria-pressed", String(favoritado));
            item.className = favoritado ? "tag-favorito ativo" : "tag-favorito";
            item.innerHTML = `${favoritado ? "★" : "☆"} <em>${escaparHTML(especie.nomeCientifico)}</em>`;

            item.addEventListener("click", () => {
                const usuarioAtualizado = alternarFavorito(usuarioAtual.id, especie.id);
                if (usuarioAtualizado) {
                    usuarioAtual.favoritos = usuarioAtualizado.favoritos;
                    renderizarFavoritos();
                }
            });

            listaFavoritos.appendChild(item);
        });
    }

    renderizarFavoritos();
}

const botaoSair = document.getElementById("botaoSair");
if (botaoSair) {
    botaoSair.addEventListener("click", () => {
        encerrarSessao();
        navegarComTransicao("hub.html");
    });
}
