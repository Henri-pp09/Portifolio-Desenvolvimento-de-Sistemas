// aparencia.js
// Papel de parede personalizavel do Aviario Sonoro.
// A escolha fica salva no localStorage do navegador da propria pessoa (nao
// existe backend nesta versao do projeto) e e aplicada em toda pagina que
// tiver a classe "fundo-personalizavel" no <body> (feed, catalogo e perfil;
// as paginas de login/cadastro mantem o visual proprio delas).

const CHAVE_PAPEL_PAREDE = "aviario_papel_parede";

const PAPEIS_DE_PAREDE = [
    { id: "padrao", nome: "Aviario classico", icone: "fa-feather" },
    { id: "folhagem", nome: "Folhagem", icone: "fa-seedling" },
    { id: "amanhecer", nome: "Ceu ao amanhecer", icone: "fa-sun" },
    { id: "ninho", nome: "Ninho aconchegante", icone: "fa-kiwi-bird" },
];

function papelDeParedeAtual() {
    try {
        const salvo = localStorage.getItem(CHAVE_PAPEL_PAREDE);
        return PAPEIS_DE_PAREDE.some((papel) => papel.id === salvo) ? salvo : "padrao";
    } catch {
        return "padrao";
    }
}

function aplicarPapelDeParede(id) {
    document.body.dataset.papel = id;
}

function definirPapelDeParede(id) {
    try {
        localStorage.setItem(CHAVE_PAPEL_PAREDE, id);
    } catch {
        // A escolha continua funcionando nesta página sem armazenamento.
    }
    aplicarPapelDeParede(id);
}

// Aplica assim que o script carrega, para a pagina ja nascer com o papel de
// parede certo (sem esperar o resto do HTML).
aplicarPapelDeParede(papelDeParedeAtual());

// Monta as amostras clicaveis dentro do elemento com o id informado. So faz
// alguma coisa se esse elemento existir na pagina (hoje, so o perfil tem).
function montarSeletorDePapelDeParede(idContainer) {
    const container = document.getElementById(idContainer);
    if (!container) return;

    const atual = papelDeParedeAtual();
    container.className = "grade-papeis";
    container.innerHTML = "";

    PAPEIS_DE_PAREDE.forEach((papel) => {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "amostra-papel" + (papel.id === atual ? " ativo" : "");
        botao.setAttribute("aria-pressed", papel.id === atual ? "true" : "false");
        botao.innerHTML = `
            <span class="cor-amostra amostra-${papel.id}" aria-hidden="true"></span>
            <span><i class="fa-solid ${papel.icone}" aria-hidden="true"></i>${papel.nome}</span>
        `;

        botao.addEventListener("click", () => {
            definirPapelDeParede(papel.id);
            container.querySelectorAll(".amostra-papel").forEach((item) => {
                item.classList.remove("ativo");
                item.setAttribute("aria-pressed", "false");
            });
            botao.classList.add("ativo");
            botao.setAttribute("aria-pressed", "true");
        });

        container.appendChild(botao);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    montarSeletorDePapelDeParede("seletorPapel");
});
