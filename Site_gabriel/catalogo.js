// catalogo.js
// Requer especies.js incluido ANTES deste arquivo.
//
// Foto: busca ao vivo na API do iNaturalist (https://api.inaturalist.org/v1/taxa)
// a partir do nome cientifico. Se a chamada falhar por qualquer motivo, usa a
// foto local de "foto de passaros/" como reserva - assim uma falha pontual de
// rede não derruba o card inteiro.
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

function pararAudioAtual() {
    if (audioTocandoAgora) {
        audioTocandoAgora.pause();
        audioTocandoAgora.currentTime = 0;
    }
    if (botaoTocandoAgora) {
        botaoTocandoAgora.textContent = "▶️ Reproduzir";
    }
    audioTocandoAgora = null;
    botaoTocandoAgora = null;
}

function criarCard(especie, fotoUrl) {
    const card = document.createElement("section");
    card.className = "card-catalogo";

    const img = document.createElement("img");
    img.src = fotoUrl;
    img.alt = especie.nomeCientifico;
    img.loading = "lazy";
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
    botao.innerHTML = `<i class="fa-solid fa-play" aria-hidden="true"></i>Reproduzir`;

    botao.addEventListener("click", () => {
        if (audioTocandoAgora && audioTocandoAgora !== audio) {
            pararAudioAtual();
        }

        if (audio.paused) {
            audio.play();
            botao.innerHTML = `<i class="fa-solid fa-pause" aria-hidden="true"></i>Pausar`;
            audioTocandoAgora = audio;
            botaoTocandoAgora = botao;
        } else {
            audio.pause();
            botao.innerHTML = `<i class="fa-solid fa-play" aria-hidden="true"></i>Reproduzir`;
            audioTocandoAgora = null;
            botaoTocandoAgora = null;
        }
    });

    audio.addEventListener("ended", () => {
        botao.innerHTML = `<i class="fa-solid fa-play" aria-hidden="true"></i>Reproduzir`;
        audioTocandoAgora = null;
        botaoTocandoAgora = null;
    });

    card.appendChild(botao);
    return card;
}

async function carregarCatalogo() {
    definirMensagem(mensagemCatalogo, "Carregando catalogo...", "carregando");
    listaCatalogo.innerHTML = "";

    const especies = ESPECIES_CATALOGO.slice(0, QUANTIDADE_ESPECIES);
    let algumaAveCarregada = false;

    for (const especie of especies) {
        let fotoUrl = especie.fotoLocal;

        try {
            fotoUrl = await buscarFotoINaturalist(especie.nomeCientifico);
        } catch (erro) {
            console.warn(`Sem foto ao vivo para ${especie.nomeCientifico}, usando foto local.`, erro);
        }

        listaCatalogo.appendChild(criarCard(especie, fotoUrl));
        algumaAveCarregada = true;
    }

    definirMensagem(
        mensagemCatalogo,
        algumaAveCarregada ? "" : "Nao foi possivel carregar nenhuma ave agora. Tente novamente mais tarde.",
        "erro"
    );
}

carregarCatalogo();
