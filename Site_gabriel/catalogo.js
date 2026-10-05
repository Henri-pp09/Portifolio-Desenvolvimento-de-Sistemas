// catalogo.js
// Requer armazenamento.js, especies.js e estado.js antes deste arquivo.
//
// Foto: busca ao vivo na API do iNaturalist (https://api.inaturalist.org/v1/taxa)
// a partir do nome cientifico. Se a chamada falhar por qualquer motivo, usa a
// foto local de "foto de passaros/" como reserva - assim uma falha pontual de
// rede nao derruba o card inteiro.
// Áudio e nomes vêm de especies.js. Xeno-canto permanece desativado.

const listaCatalogo = document.getElementById("listaCatalogo");
const mensagemCatalogo = document.getElementById("mensagemCatalogo");

let audioTocandoAgora = null;
let botaoTocandoAgora = null;

function escaparTextoCatalogo(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

const TEMPO_LIMITE_FOTO = 8000;
const REQUISICOES_PARALELAS = 4;

async function buscarFotoINaturalist(nomeCientifico) {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_FOTO);
    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(nomeCientifico)}&rank=species&per_page=5`;

    try {
        const resposta = await fetch(url, { signal: controle.signal });
        if (!resposta.ok) throw new Error(`iNaturalist: HTTP ${resposta.status}`);
        const dados = await resposta.json();
        if (!Array.isArray(dados.results)) throw new Error("Resposta inválida");
        // Busca textual pode devolver uma espécie parecida: nunca usa essa foto.
        const taxon = dados.results.find((ave) =>
            ave.name?.toLowerCase() === nomeCientifico.toLowerCase());
        const foto = taxon?.default_photo;
        if (!foto?.medium_url) throw new Error("Sem foto disponível");
        const urlFoto = new URL(foto.medium_url);
        if (urlFoto.protocol !== "https:") throw new Error("URL de foto inválida");
        return { url: urlFoto.href, credito: foto.attribution || "iNaturalist",
            fonte: `https://www.inaturalist.org/taxa/${taxon.id}` };
    } finally {
        clearTimeout(limite);
    }
}

function criarFoto(especie, foto) {
    const area = document.createElement("div");
    area.className = "area-foto";
    const reserva = document.createElement("span");
    reserva.className = "sem-foto";
    reserva.textContent = "Foto não disponível";
    area.appendChild(reserva);
    const url = foto?.url || especie.fotoLocal;
    if (!url) return area;

    const img = document.createElement("img");
    img.alt = especie.nomePopular || especie.nomeCientifico;
    img.loading = "lazy";
    img.decoding = "async";
    img.className = "imagem-carregando";
    img.style.visibility = "hidden";
    reserva.textContent = "Carregando foto...";
    img.addEventListener("load", () => {
        img.classList.remove("imagem-carregando");
        img.style.visibility = "visible";
        reserva.hidden = true;
    });
    let tentouReserva = !foto || !especie.fotoLocal;
    img.addEventListener("error", () => {
        if (!tentouReserva) {
            tentouReserva = true;
            img.src = especie.fotoLocal;
            area.querySelector(".credito-foto")?.remove();
        } else {
            img.remove();
            reserva.hidden = false;
            reserva.textContent = "Foto não disponível";
            area.querySelector(".credito-foto")?.remove();
        }
    });
    img.src = url;
    area.appendChild(img);
    if (foto) {
        const credito = document.createElement("a");
        credito.className = "credito-foto";
        credito.href = foto.fonte;
        credito.target = "_blank";
        credito.rel = "noopener noreferrer";
        credito.textContent = foto.credito;
        area.appendChild(credito);
    }
    return area;
}

function criarBotaoFavorito(especie) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "botao-favorito";
    function atualizar() {
        const usuario = usuarioLogado();
        const ativo = usuario && listarFavoritos(usuario.id).includes(especie.id);
        botao.setAttribute("aria-pressed", String(Boolean(ativo)));
        botao.textContent = ativo ? "★ Remover favorito" : "☆ Favoritar";
    }
    atualizar();
    botao.addEventListener("click", () => {
        const usuario = usuarioLogado();
        if (!usuario) {
            definirMensagem(mensagemCatalogo, "Entre na sua conta para salvar favoritos.", "erro");
            return;
        }
        try {
            alternarFavorito(usuario.id, especie.id);
            atualizar();
            definirMensagem(mensagemCatalogo, "Favoritos atualizados.", "sucesso");
        } catch (erro) {
            definirMensagem(mensagemCatalogo, "Não foi possível salvar o favorito neste navegador.", "erro");
        }
    });
    return botao;
}

function atualizarBotaoAudio(botao, estado) {
    botao.classList.toggle("em-carregamento", estado === "carregando");
    botao.toggleAttribute("aria-busy", estado === "carregando");
    botao.setAttribute("aria-pressed", estado === "tocando" ? "true" : "false");

    if (estado === "carregando") {
        botao.textContent = "Carregando audio...";
    } else if (estado === "tocando") {
        botao.innerHTML = `<i class="fa-solid fa-pause" aria-hidden="true"></i>Pausar`;
    } else {
        botao.innerHTML = `<i class="fa-solid fa-play" aria-hidden="true"></i>Reproduzir`;
    }
}

function pararAudioAtual() {
    if (audioTocandoAgora) {
        audioTocandoAgora.pause();
        audioTocandoAgora.currentTime = 0;
    }
    if (botaoTocandoAgora) atualizarBotaoAudio(botaoTocandoAgora, "parado");
    audioTocandoAgora = null;
    botaoTocandoAgora = null;
}

function criarCard(especie, foto) {
    const card = document.createElement("section");
    card.className = "card-catalogo";
    card.dataset.especieId = especie.id;
    card.appendChild(criarFoto(especie, foto));

    const nome = document.createElement("h3");
    nome.textContent = especie.nomePopular || especie.nomeCientifico;
    card.appendChild(nome);
    const cientifico = document.createElement("p");
    cientifico.className = "nome-cientifico";
    cientifico.innerHTML = `<em>${escaparTextoCatalogo(especie.nomeCientifico)}</em>`;
    card.appendChild(cientifico);
    card.appendChild(criarBotaoFavorito(especie));
    if (!especie.audioUrl || especie.audioDisponivel === false) {
        const indisponivel = document.createElement("p");
        indisponivel.className = "audio-indisponivel";
        indisponivel.textContent = "Áudio indisponível";
        card.appendChild(indisponivel);
        return card;
    }

    const audio = document.createElement("audio");
    audio.src = especie.audioUrl;
    audio.preload = "none";
    card.appendChild(audio);

    const botao = document.createElement("button");
    botao.type = "button";
    atualizarBotaoAudio(botao, "parado");

    botao.addEventListener("click", async () => {
        if (audioTocandoAgora && audioTocandoAgora !== audio) pararAudioAtual();

        if (audio.paused) {
            audioTocandoAgora = audio;
            botaoTocandoAgora = botao;
            atualizarBotaoAudio(botao, "carregando");

            try {
                await audio.play();
                if (audioTocandoAgora === audio) atualizarBotaoAudio(botao, "tocando");
            } catch (erro) {
                if (audioTocandoAgora === audio) {
                    audioTocandoAgora = null;
                    botaoTocandoAgora = null;
                }
                if (!botao.disabled) atualizarBotaoAudio(botao, "parado");
                definirMensagem(
                    mensagemCatalogo,
                    "Nao foi possivel reproduzir este canto agora.",
                    "erro"
                );
            }
        } else {
            audio.pause();
            atualizarBotaoAudio(botao, "parado");
            audioTocandoAgora = null;
            botaoTocandoAgora = null;
        }
    });

    audio.addEventListener("error", () => {
        if (audioTocandoAgora === audio) pararAudioAtual();
        audio.remove();
        botao.classList.remove("em-carregamento");
        botao.removeAttribute("aria-busy");
        botao.disabled = true;
        botao.textContent = "Áudio indisponível";
    });

    audio.addEventListener("waiting", () => {
        if (audioTocandoAgora === audio) atualizarBotaoAudio(botao, "carregando");
    });

    audio.addEventListener("playing", () => {
        if (audioTocandoAgora === audio) atualizarBotaoAudio(botao, "tocando");
    });

    audio.addEventListener("ended", () => {
        atualizarBotaoAudio(botao, "parado");
        audioTocandoAgora = null;
        botaoTocandoAgora = null;
    });

    card.appendChild(botao);
    return card;
}

function mostrarEsqueletos(quantidade) {
    const fragmento = document.createDocumentFragment();

    for (let indice = 0; indice < quantidade; indice += 1) {
        const esqueleto = document.createElement("section");
        esqueleto.className = "card-catalogo esqueleto";
        esqueleto.setAttribute("aria-hidden", "true");
        esqueleto.innerHTML = `
            <span class="bloco-esqueleto imagem"></span>
            <span class="bloco-esqueleto titulo"></span>
            <span class="bloco-esqueleto botao"></span>
        `;
        fragmento.appendChild(esqueleto);
    }

    listaCatalogo.replaceChildren(fragmento);
}

async function carregarCatalogo() {
    const especies = ESPECIES_CATALOGO;
    listaCatalogo.setAttribute("aria-busy", "true");
    mostrarEsqueletos(especies.length);
    const lugares = [...listaCatalogo.children];
    let proxima = 0;
    let carregadas = 0;
    let semFotoAPI = 0;
    definirMensagem(mensagemCatalogo, `Carregando 0 de ${especies.length} aves...`, "carregando");

    // Quatro trabalhadores: cards chegam progressivamente na ordem da lista.
    async function carregarProxima() {
        while (proxima < especies.length) {
            const indice = proxima++;
            const especie = especies[indice];
            let foto = null;
            try {
                foto = await buscarFotoINaturalist(especie.nomeCientifico);
            } catch (erro) {
                semFotoAPI++;
                console.warn(`Foto indisponível para ${especie.nomeCientifico}:`, erro.message);
            }
            lugares[indice].replaceWith(criarCard(especie, foto));
            carregadas++;
            definirMensagem(mensagemCatalogo, `Carregando ${carregadas} de ${especies.length} aves...`, "carregando");
        }
    }

    try {
        await Promise.all(Array.from({ length: Math.min(REQUISICOES_PARALELAS, especies.length) }, carregarProxima));
        definirMensagem(mensagemCatalogo,
            `${carregadas} aves no catálogo.${semFotoAPI ? ` ${semFotoAPI} sem foto da API; usando alternativa quando disponível.` : ""}`);
    } finally {
        listaCatalogo.removeAttribute("aria-busy");
    }
}

carregarCatalogo();
