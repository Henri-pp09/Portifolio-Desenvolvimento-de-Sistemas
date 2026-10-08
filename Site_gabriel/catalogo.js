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
const buscaEspecies = document.getElementById("buscaEspecies");
const filtroSituacao = document.getElementById("filtroSituacao");
const filtroConservacao = document.getElementById("filtroConservacao");
const resultadoBusca = document.getElementById("resultadoBusca");
const mostrarMaisAves = document.getElementById("mostrarMaisAves");
const fichaEspecie = document.getElementById("fichaEspecie");
const fotosCatalogo = new Map();
const cardsCatalogo = new Map();
const AVES_POR_LOTE = 24;
let limiteExibicao = AVES_POR_LOTE;
let fichaAberta = null;

let audioTocandoAgora = null;
let botaoTocandoAgora = null;

const TEMPO_LIMITE_FOTO = 8000;
const REQUISICOES_PARALELAS = 4;

async function buscarFotoINaturalist(nomeCientifico, termoBusca = nomeCientifico) {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_FOTO);
    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(termoBusca)}&rank=species&per_page=5`;

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
    img.alt = especie.nomePopular || "Pássaro";
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
            definirMensagem(fichaEspecie.open ? document.getElementById("mensagemFicha") : mensagemCatalogo, "Entre na sua conta para salvar favoritos.", "erro");
            return;
        }
        try {
            const estavaFavoritado = listarFavoritos(usuario.id).includes(especie.id);
            alternarFavorito(usuario.id, especie.id);
            atualizar();
            definirMensagem(fichaEspecie.open ? document.getElementById("mensagemFicha") : mensagemCatalogo, estavaFavoritado ? "Removido dos favoritos." : "Adicionado aos favoritos.", "sucesso");
        } catch (erro) {
            definirMensagem(fichaEspecie.open ? document.getElementById("mensagemFicha") : mensagemCatalogo, "Não foi possível salvar o favorito neste navegador.", "erro");
        }
    });
    return botao;
}

function atualizarBotaoAudio(botao, estado) {
    botao.classList.toggle("em-carregamento", estado === "carregando");
    botao.toggleAttribute("aria-busy", estado === "carregando");
    botao.setAttribute("aria-pressed", estado === "tocando" ? "true" : "false");
    botao.disabled = estado === "carregando";

    if (estado === "carregando") {
        botao.textContent = "Carregando áudio...";
    } else if (estado === "tocando") {
        botao.innerHTML = `<i class="fa-solid fa-pause" aria-hidden="true"></i>Pausar`;
    } else {
        botao.innerHTML = `<i class="fa-solid fa-play" aria-hidden="true"></i>Reproduzir canto`;
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
    nome.textContent = especie.nomePopular || "Pássaro";
    card.appendChild(nome);
    const selo = document.createElement("p");
    selo.className = `selo-conservacao status-${especie.statusConservacao.toLowerCase()}`;
    selo.textContent = `${especie.statusConservacao} — ${especie.statusConservacaoNome}`;
    card.appendChild(selo);
    const detalhes = document.createElement("button");
    detalhes.type = "button";
    detalhes.className = "botao-ficha";
    detalhes.textContent = "Ver ficha";
    detalhes.setAttribute("aria-label", `Ver ficha de ${especie.nomePopular}`);
    detalhes.setAttribute("aria-haspopup", "dialog");
    detalhes.addEventListener("click", () => abrirFicha(especie, card, detalhes));
    card.appendChild(detalhes);
    card.appendChild(criarBotaoFavorito(especie));
    if (!especie.audioUrl || especie.audioDisponivel === false) {
        const indisponivel = document.createElement("p");
        indisponivel.className = "audio-indisponivel";
        indisponivel.textContent = "Áudio indisponível para esta espécie.";
        card.appendChild(indisponivel);
        return card;
    }

    const audio = document.createElement("audio");
    audio.src = especie.audioUrl;
    audio.preload = "none";
    audio.setAttribute("aria-label", `Canto de ${especie.nomePopular || "Pássaro"}`);
    card.appendChild(audio);

    const mensagemAudio = document.createElement("p");
    mensagemAudio.id = `audio-${especie.id}`;
    mensagemAudio.className = "mensagem mensagem-audio";
    mensagemAudio.setAttribute("role", "status");
    mensagemAudio.setAttribute("aria-live", "polite");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.setAttribute("aria-describedby", mensagemAudio.id);
    botao.setAttribute("aria-label", `Reproduzir canto de ${especie.nomePopular || "Pássaro"}`);
    atualizarBotaoAudio(botao, "parado");
    let tempoLimite;
    let indisponivel = false;
    function limparLimite() { clearTimeout(tempoLimite); }

    function falhaAudio() {
        indisponivel = true;
        limparLimite();
        if (audioTocandoAgora === audio) pararAudioAtual();
        atualizarBotaoAudio(botao, "parado");
        botao.disabled = true;
        botao.textContent = "Áudio indisponível";
        definirMensagem(mensagemAudio, "Não foi possível carregar este canto.", "erro");
    }

    botao.addEventListener("click", async () => {
        if (audioTocandoAgora && audioTocandoAgora !== audio) pararAudioAtual();
        if (!audio.paused) {
            pararAudioAtual();
            return;
        }
        audioTocandoAgora = audio;
        botaoTocandoAgora = botao;
        atualizarBotaoAudio(botao, "carregando");
        definirMensagem(mensagemAudio, "Carregando áudio...", "carregando");
        tempoLimite = setTimeout(() => {
            if (audioTocandoAgora === audio) falhaAudio();
        }, 12000);
        try {
            await audio.play();
            limparLimite();
            // Uma promessa antiga não pode reiniciar a faixa depois da troca.
            if (audioTocandoAgora !== audio) { audio.pause(); return; }
            atualizarBotaoAudio(botao, "tocando");
            botao.setAttribute("aria-label", `Pausar canto de ${especie.nomePopular || "Pássaro"}`);
            definirMensagem(mensagemAudio, "Reproduzindo canto.");
        } catch (erro) {
            limparLimite();
            if (audioTocandoAgora !== audio || botao.disabled && audio.error) return;
            if (audio.error) { falhaAudio(); return; }
            pararAudioAtual();
            definirMensagem(mensagemAudio, "Não foi possível iniciar a reprodução. Tente novamente.", "erro");
        }
    });
    audio.addEventListener("error", falhaAudio);
    audio.addEventListener("pause", () => {
        limparLimite();
        if (!audio.error && !indisponivel) {
            atualizarBotaoAudio(botao, "parado");
            botao.setAttribute("aria-label", `Reproduzir canto de ${especie.nomePopular || "Pássaro"}`);
            definirMensagem(mensagemAudio, "Reprodução pausada.");
        }
    });
    audio.addEventListener("waiting", () => {
        if (audioTocandoAgora === audio) definirMensagem(mensagemAudio, "Carregando áudio...", "carregando");
    });
    audio.addEventListener("playing", () => {
        if (audioTocandoAgora === audio) definirMensagem(mensagemAudio, "Reproduzindo canto.");
    });
    audio.addEventListener("ended", () => {
        limparLimite();
        atualizarBotaoAudio(botao, "parado");
        botao.setAttribute("aria-label", `Reproduzir canto de ${especie.nomePopular || "Pássaro"}`);
        definirMensagem(mensagemAudio, "Canto concluído.");
        if (audioTocandoAgora === audio) {
            audioTocandoAgora = null;
            botaoTocandoAgora = null;
        }
    });
    card.append(botao, mensagemAudio);
    return card;
}

function normalizarBusca(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function especiesFiltradas() {
    const termo = normalizarBusca(buscaEspecies.value);
    return ESPECIES_CATALOGO.filter(especie => {
        const nome = normalizarBusca(`${especie.nomePopular} ${especie.nomeCientifico} ${(especie.sinonimos || []).join(" ")}`);
        const situacao = filtroSituacao.value;
        const corresponde = !situacao || (situacao === "ameacada"
            ? ["VU", "EN", "CR"].includes(especie.statusConservacao)
            : especie.grupo === situacao);
        return nome.includes(termo) && corresponde &&
            (!filtroConservacao.value || especie.statusConservacao === filtroConservacao.value);
    });
}

function atualizarResultados() {
    const especies = especiesFiltradas();
    const visiveis = especies.slice(0, limiteExibicao);
    const ids = new Set(visiveis.map(especie => especie.id));
    if (audioTocandoAgora && !ids.has(audioTocandoAgora.closest(".card-catalogo")?.dataset.especieId)) pararAudioAtual();
    // Reutiliza os mesmos cards e players; filtrar não consulta a API.
    for (const [id, card] of cardsCatalogo) card.hidden = !ids.has(id);
    const fragmento = document.createDocumentFragment();
    for (const especie of visiveis) {
        if (!cardsCatalogo.has(especie.id)) {
            const card = criarCard(especie, fotosCatalogo.get(especie.id));
            cardsCatalogo.set(especie.id, card);
            fragmento.appendChild(card);
        }
    }
    listaCatalogo.appendChild(fragmento);
    // Cards criados em buscas anteriores voltam à ordem original.
    visiveis.forEach(especie => listaCatalogo.appendChild(cardsCatalogo.get(especie.id)));
    document.getElementById("catalogoVazio").hidden = especies.length !== 0;
    mostrarMaisAves.hidden = visiveis.length >= especies.length;
    mostrarMaisAves.textContent = `Mostrar mais aves (${especies.length - visiveis.length} restantes)`;
    resultadoBusca.textContent = `Mostrando ${visiveis.length} de ${especies.length} aves encontradas. Catálogo com ${ESPECIES_CATALOGO.length} espécies.`;
}

function abrirFicha(especie, card, origem) {
    if (audioTocandoAgora && !card.contains(audioTocandoAgora)) pararAudioAtual();
    document.getElementById("tituloFicha").textContent = especie.nomePopular;
    const dados = document.getElementById("dadosFicha");
    dados.replaceChildren();
    const dl = document.createElement("dl");
    const campos = [
        ["Situação", especie.grupo === "extinta" ? "Extinta" : especie.grupo === "extinta-na-natureza" ? "Extinta na natureza (indivíduos ainda existem)" : "Viva"],
        ["Conservação", `${especie.statusConservacao} — ${especie.statusConservacaoNome}`],
        ["Referência da classificação", especie.conservacaoReferencia],
        [especie.grupo === "extinta" ? "Ocorrência histórica" : "Ocorrência / distribuição", especie.ocorrencia],
        [especie.grupo === "extinta" ? "Habitat histórico" : "Habitat", especie.habitat],
        ["Características", especie.caracteristicas],
    ];
    if (especie.notaConservacao) campos.push(["Observação", especie.notaConservacao]);
    if (especie.grupo === "extinta") campos.push(["Sobre a imagem", "Imagens de espécies extintas podem ser ilustrações, reconstruções ou exemplares de museu; não representam uma ave viva atual."]);
    for (const [rotulo, texto] of campos) {
        const dt = document.createElement("dt"); dt.textContent = rotulo;
        const dd = document.createElement("dd"); dd.textContent = texto;
        dl.append(dt, dd);
    }
    dados.appendChild(dl);
    const tituloFontes = document.createElement("h3"); tituloFontes.textContent = "Fontes";
    dados.appendChild(tituloFontes);
    const fontes = document.createElement("ul");
    for (const [texto, url] of [["Identificação, habitat e características", especie.fonteUrl], ["Conservação", especie.fonteConservacao], ["Registro de conservação no iNaturalist", especie.fonteConservacaoConsulta], ["Referência taxonômica", especie.fonteTaxonomia]]) {
        if (!url) continue;
        const li = document.createElement("li"); const link = document.createElement("a");
        link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.textContent = `${texto} (abre em outra aba)`; li.appendChild(link); fontes.appendChild(li);
    }
    dados.appendChild(fontes);
    const consulta = document.createElement("p"); consulta.className = "nota-conservacao";
    consulta.textContent = `Fontes consultadas em ${especie.dataConsulta.split("-").reverse().join("/")}. A classificação pode mudar após nova avaliação.`;
    dados.appendChild(consulta);
    definirMensagem(document.getElementById("mensagemFicha"), "");
    // Move o card, sem clonar áudio/favorito ou criar IDs duplicados.
    const lugar = document.createElement("div");
    lugar.className = "lugar-ficha"; lugar.style.height = `${card.getBoundingClientRect().height}px`;
    lugar.setAttribute("aria-hidden", "true");
    card.replaceWith(lugar);
    fichaAberta = { card, lugar, origem };
    document.getElementById("midiaFicha").appendChild(card);
    document.body.classList.add("ficha-aberta");
    fichaEspecie.showModal();
}

document.getElementById("fecharFicha").addEventListener("click", () => fichaEspecie.close());
fichaEspecie.addEventListener("keydown", evento => {
    if (evento.key !== "Tab") return;
    const controles = [...fichaEspecie.querySelectorAll("a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")]
        .filter(elemento => elemento.getClientRects().length && elemento.tabIndex >= 0);
    const primeiro = controles[0], ultimo = controles[controles.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault(); ultimo?.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault(); primeiro?.focus();
    }
});
fichaEspecie.addEventListener("close", () => {
    document.body.classList.remove("ficha-aberta");
    if (!fichaAberta) return;
    const { card, lugar, origem } = fichaAberta;
    if (card.contains(audioTocandoAgora)) pararAudioAtual();
    lugar.replaceWith(card);
    fichaAberta = null;
    origem.focus();
});

for (const codigo of Object.keys(CATEGORIAS_CONSERVACAO)) {
    if (!ESPECIES_CATALOGO.some(especie => especie.statusConservacao === codigo)) continue;
    const opcao = document.createElement("option");
    opcao.value = codigo; opcao.textContent = `${codigo} — ${CATEGORIAS_CONSERVACAO[codigo]}`;
    filtroConservacao.appendChild(opcao);
}
for (const campo of [buscaEspecies, filtroSituacao, filtroConservacao]) {
    campo.addEventListener(campo === buscaEspecies ? "input" : "change", () => {
        limiteExibicao = AVES_POR_LOTE;
        atualizarResultados();
    });
}
document.querySelector(".filtros-catalogo").addEventListener("submit", evento => evento.preventDefault());
document.querySelector(".filtros-catalogo").addEventListener("reset", () => {
    setTimeout(() => { limiteExibicao = AVES_POR_LOTE; atualizarResultados(); }, 0);
});
mostrarMaisAves.addEventListener("click", () => {
    const quantidadeAnterior = Math.min(limiteExibicao, especiesFiltradas().length);
    limiteExibicao += AVES_POR_LOTE;
    atualizarResultados();
    const proxima = especiesFiltradas()[quantidadeAnterior];
    cardsCatalogo.get(proxima?.id)?.querySelector(".botao-ficha")?.focus();
});

async function carregarCatalogo() {
    const especies = ESPECIES_CATALOGO;
    let proxima = 0, carregadas = 0, semFotoAPI = 0;
    atualizarResultados(); // Nomes, fichas e filtros funcionam antes das fotos.
    listaCatalogo.setAttribute("aria-busy", "true");
    definirMensagem(mensagemCatalogo, `Carregando fotos: 0 de ${especies.length} aves...`, "carregando");
    async function carregarProxima() {
        while (proxima < especies.length) {
            const especie = especies[proxima++];
            let foto = null;
            try { foto = await buscarFotoINaturalist(especie.nomeCientifico, especie.termoBuscaFoto); }
            catch (erro) { semFotoAPI++; console.warn(`Foto indisponível para ${especie.nomeCientifico}:`, erro.message); }
            fotosCatalogo.set(especie.id, foto);
            cardsCatalogo.get(especie.id)?.querySelector(".area-foto")?.replaceWith(criarFoto(especie, foto));
            carregadas++;
            definirMensagem(mensagemCatalogo, `Carregando fotos: ${carregadas} de ${especies.length} aves...`, "carregando");
        }
    }
    try {
        await Promise.all(Array.from({ length: Math.min(REQUISICOES_PARALELAS, especies.length) }, carregarProxima));
        definirMensagem(mensagemCatalogo, `${especies.length} aves no catálogo.${semFotoAPI ? ` ${semFotoAPI} sem foto da API; usando alternativa quando disponível.` : ""}`);
    } finally { listaCatalogo.removeAttribute("aria-busy"); }
}
carregarCatalogo();
