// catalogo.js
// Requer especies.js e estado.js incluidos ANTES deste arquivo.
//
// Foto: busca ao vivo na API do iNaturalist (https://api.inaturalist.org/v1/taxa)
// a partir do nome cientifico. Se a chamada falhar por qualquer motivo, usa a
// foto local de "foto de passaros/" como reserva - assim uma falha pontual de
// rede nao derruba o card inteiro.
// Audio + nome cientifico: vem de especies.js (ver o comentario la explicando
// por que nao e mais buscado ao vivo no Xeno-canto).

const listaCatalogo = document.getElementById("listaCatalogo");
const mensagemCatalogo = document.getElementById("mensagemCatalogo");

let audioTocandoAgora = null;
let botaoTocandoAgora = null;

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

async function buscarFotoINaturalist(nomeCientifico) {
    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(
        nomeCientifico
    )}&rank=species&per_page=1`;

    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error("iNaturalist respondeu com erro");

    const dados = await resposta.json();
    const taxon = dados.results && dados.results[0];
    if (!taxon || !taxon.default_photo) throw new Error("Sem foto disponivel");

    return taxon.default_photo.medium_url;
}

/*
 * DESATIVADO: busca ao vivo no Xeno-canto (ver explicacao em especies.js).
 * Deixado aqui pronto para o caso de voltar a funcionar no futuro.
 *
 * async function buscarGravacaoXenoCanto(nomeComumEmIngles) {
 *     const consulta = `en:"${nomeComumEmIngles}"`;
 *     const url = `https://xeno-canto.org/api/2/recordings?query=${encodeURIComponent(consulta)}`;
 *     const resposta = await fetch(url);
 *     if (!resposta.ok) throw new Error(`Xeno-canto respondeu com erro (${resposta.status})`);
 *     const dados = await resposta.json();
 *     if (!dados.recordings || dados.recordings.length === 0) return null;
 *     const gravacao = dados.recordings.find((r) => r.q === "A" || r.q === "B") || dados.recordings[0];
 *     return { nomeCientifico: `${gravacao.gen} ${gravacao.sp}`, audioUrl: gravacao.file };
 * }
 */

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

function criarCard(especie, fotoUrl) {
    const card = document.createElement("section");
    card.className = "card-catalogo";

    const img = document.createElement("img");
    img.alt = especie.nomeCientifico;
    img.loading = "lazy";
    img.className = "imagem-carregando";
    img.addEventListener("load", () => img.classList.remove("imagem-carregando"));
    img.addEventListener("error", () => {
        const fotoLocalAbsoluta = new URL(especie.fotoLocal, document.baseURI).href;
        if (img.src !== fotoLocalAbsoluta) {
            img.src = especie.fotoLocal;
        } else {
            img.classList.remove("imagem-carregando");
        }
    });
    img.src = fotoUrl;
    card.appendChild(img);

    const nome = document.createElement("h3");
    nome.innerHTML = `<em>${escaparHTML(especie.nomeCientifico)}</em>`;
    card.appendChild(nome);

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
                atualizarBotaoAudio(botao, "tocando");
            } catch (erro) {
                audioTocandoAgora = null;
                botaoTocandoAgora = null;
                atualizarBotaoAudio(botao, "parado");
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
    definirMensagem(mensagemCatalogo, "Carregando catalogo...", "carregando");

    const especies = ESPECIES_CATALOGO.slice(0, QUANTIDADE_ESPECIES);
    listaCatalogo.setAttribute("aria-busy", "true");
    mostrarEsqueletos(especies.length);

    const avesCarregadas = await Promise.all(
        especies.map(async (especie) => {
            let fotoUrl = especie.fotoLocal;

            try {
                fotoUrl = await buscarFotoINaturalist(especie.nomeCientifico);
            } catch (erro) {
                console.warn(
                    `Sem foto ao vivo para ${especie.nomeCientifico}, usando foto local.`,
                    erro
                );
            }

            return { especie, fotoUrl };
        })
    );

    await transicionarConteudo(listaCatalogo, () => {
        const fragmento = document.createDocumentFragment();
        avesCarregadas.forEach(({ especie, fotoUrl }) => {
            fragmento.appendChild(criarCard(especie, fotoUrl));
        });
        listaCatalogo.replaceChildren(fragmento);
    });

    listaCatalogo.removeAttribute("aria-busy");
    definirMensagem(
        mensagemCatalogo,
        avesCarregadas.length
            ? ""
            : "Nao foi possivel carregar nenhuma ave agora. Tente novamente mais tarde.",
        "erro"
    );
}

carregarCatalogo();
