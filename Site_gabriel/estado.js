// estado.js
// Pequeno utilitario compartilhado por todas as paginas para mostrar
// mensagens (sucesso, erro, carregando) com a aparencia certa.
// Inclua este arquivo ANTES de auth.js, hub.js, perfil.js e catalogo.js.

// tipo pode ser: "info", "sucesso", "erro", "aviso" ou
// "carregando". O estilo de cada um esta em ui.css (classe .mensagem.*).
function definirMensagem(elemento, texto, tipo = "info") {
    if (!elemento) return;

    const simbolo = { sucesso: "✓ ", erro: "⚠ ", aviso: "! " }[tipo] || "";
    elemento.setAttribute("role", tipo === "erro" ? "alert" : "status");
    elemento.setAttribute("aria-live", tipo === "erro" ? "assertive" : "polite");
    elemento.setAttribute("aria-atomic", "true");
    elemento.textContent = texto ? simbolo + texto : "";
    elemento.classList.remove("sucesso", "erro", "aviso", "carregando", "mensagem-ativa");

    if (texto && tipo !== "info") {
        elemento.classList.add(tipo);
    }

    if (texto) {
        // Reinicia a animacao mesmo quando duas mensagens seguidas usam o mesmo tipo.
        void elemento.offsetWidth;
        elemento.classList.add("mensagem-ativa");
    }
}

// Aproveita as regras nativas dos campos, com mensagem no contexto e foco no erro.
function validarFormulario(formulario, mensagem) {
    const campos = [...formulario.querySelectorAll("input, textarea, select")];
    campos.forEach((campo) => campo.removeAttribute("aria-invalid"));
    const invalido = campos.find((campo) => !campo.disabled && (
        !campo.validity.valid || (campo.required && !campo.value.trim())
    ));
    if (!invalido) return true;
    const rotulo = invalido.labels?.[0]?.textContent.trim().replace(/\s+/g, " ") || "campo";
    invalido.setAttribute("aria-invalid", "true");
    definirMensagem(mensagem, `Confira ${rotulo}: ${invalido.validity.valueMissing || !invalido.value.trim()
        ? "preencha este campo." : invalido.validationMessage}`, "erro");
    invalido.focus();
    return false;
}

function informarFalhasDeImagem(container) {
    container.querySelectorAll(".midia-post img").forEach((imagem) => {
        imagem.addEventListener("error", () => {
            const aviso = document.createElement("p");
            aviso.className = "foto-indisponivel";
            aviso.textContent = "Imagem da publicação indisponível.";
            imagem.replaceWith(aviso);
        }, { once: true });
    });
}

// Mantem o texto original do botao e expõe o estado de espera tambem para
// tecnologias assistivas. Pode ser usado em formularios, uploads e audio.
function definirBotaoCarregando(botao, carregando, texto = "Carregando...") {
    if (!botao) return;

    if (carregando) {
        if (!botao.dataset.conteudoOriginal) {
            botao.dataset.conteudoOriginal = botao.innerHTML;
        }
        botao.classList.add("em-carregamento");
        botao.setAttribute("aria-busy", "true");
        botao.disabled = true;
        botao.textContent = texto;
        return;
    }

    botao.classList.remove("em-carregamento");
    botao.removeAttribute("aria-busy");
    botao.disabled = false;
    if (botao.dataset.conteudoOriginal) {
        botao.innerHTML = botao.dataset.conteudoOriginal;
        delete botao.dataset.conteudoOriginal;
    }
}

function prefereMovimentoReduzido() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function navegarComTransicao(destino) {
    if (prefereMovimentoReduzido()) {
        window.location.href = destino;
        return;
    }

    document.body.classList.add("pagina-saindo");
    window.setTimeout(() => {
        window.location.href = destino;
    }, 220);
}

function transicionarConteudo(container, atualizar) {
    if (!container || prefereMovimentoReduzido()) {
        atualizar();
        return Promise.resolve();
    }

    container.classList.add("conteudo-saindo");
    return new Promise((resolve) => {
        window.setTimeout(() => {
            atualizar();
            container.classList.remove("conteudo-saindo");
            resolve();
        }, 180);
    });
}

// A tela inicial permanece ate os recursos da pagina terminarem, mas tem um
// limite para nunca prender a pessoa caso uma fonte ou imagem externa falhe.
(function prepararExperienciaDaPagina() {
    const inicio = performance.now();
    let finalizado = false;

    function finalizarCarregamentoInicial() {
        if (finalizado) return;
        finalizado = true;

        const esperaRestante = Math.max(0, 260 - (performance.now() - inicio));
        window.setTimeout(() => {
            document.body.classList.remove("pagina-carregando");
            const tela = document.querySelector(".tela-carregamento");
            if (tela) tela.setAttribute("aria-hidden", "true");
        }, esperaRestante);
    }

    if (document.readyState !== "loading") {
        finalizarCarregamentoInicial();
    } else {
        document.addEventListener("DOMContentLoaded", finalizarCarregamentoInicial, {
            once: true,
        });
    }

    window.setTimeout(finalizarCarregamentoInicial, 4000);

    document.querySelectorAll(".mensagem").forEach((mensagem) => {
        mensagem.setAttribute("role", "status");
        mensagem.setAttribute("aria-live", "polite");
    });

    document.addEventListener("click", (evento) => {
        const interativo = evento.target.closest(
            "button, .botao-link, .botao-menor, .rotulo-arquivo, .links-nav a"
        );
        if (interativo && !interativo.disabled) {
            interativo.classList.remove("interacao-confirmada");
            void interativo.offsetWidth;
            interativo.classList.add("interacao-confirmada");
            interativo.addEventListener(
                "animationend",
                () => interativo.classList.remove("interacao-confirmada"),
                { once: true }
            );
        }

        const link = evento.target.closest("a[href]");
        if (
            !link ||
            evento.defaultPrevented ||
            evento.button !== 0 ||
            evento.ctrlKey ||
            evento.metaKey ||
            evento.shiftKey ||
            evento.altKey ||
            link.target ||
            link.hasAttribute("download")
        ) {
            return;
        }

        const url = new URL(link.href, window.location.href);
        if (
            url.origin !== window.location.origin ||
            (url.pathname === window.location.pathname && url.hash)
        ) {
            return;
        }

        evento.preventDefault();
        navegarComTransicao(url.href);
    });

    window.addEventListener("pageshow", () => {
        document.body.classList.remove("pagina-saindo");
    });
})();
