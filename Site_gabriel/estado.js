// estado.js
// Pequeno utilitario compartilhado por todas as paginas para mostrar
// mensagens (sucesso, erro, carregando) com a aparencia certa.
// Inclua este arquivo ANTES de auth.js, hub.js, perfil.js e catalogo.js.

// tipo pode ser: "info" (padrao, sem cor extra), "sucesso", "erro" ou
// "carregando". O estilo de cada um esta em ui.css (classe .mensagem.*).
function definirMensagem(elemento, texto, tipo = "info") {
    if (!elemento) return;

    elemento.textContent = texto || "";
    elemento.classList.remove("sucesso", "erro", "carregando");

    if (texto && tipo !== "info") {
        elemento.classList.add(tipo);
    }
}
