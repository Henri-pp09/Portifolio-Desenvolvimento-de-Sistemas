// auth.js
// Cadastro e login usando o armazenamento local (armazenamento.js).
// Requer que armazenamento.js e cursor.js estejam incluidos ANTES deste
// arquivo no HTML.

const formCadastro = document.getElementById("formCadastro");
const formLogin = document.getElementById("formLogin");

if (formCadastro) {
    formCadastro.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const mensagem = document.getElementById("mensagemCadastro");
        const botao = formCadastro.querySelector("button[type='submit']");
        if (botao.disabled || !validarFormulario(formCadastro, mensagem)) return;

        const dados = {
            nome: document.getElementById("cadastroNome").value.trim(),
            usuario: document
                .getElementById("cadastroUsuario")
                .value.trim()
                .replace(/\s+/g, "_"),
            bio: document.getElementById("cadastroBio").value.trim(),
            senha: document.getElementById("cadastroSenha").value,
        };

        formCadastro.setAttribute("aria-busy", "true");
        definirBotaoCarregando(botao, true, "Criando perfil...");
        definirMensagem(mensagem, "Criando perfil...", "carregando");

        try {
            const usuarioCriado = await cadastrarUsuario(dados);
            iniciarSessao(usuarioCriado.id);
            definirMensagem(mensagem, "Perfil criado! Abrindo sua pagina...", "sucesso");
            setTimeout(() => {
                navegarComTransicao("perfil.html");
            }, 600);
        } catch (erro) {
            definirMensagem(mensagem, erro.message, "erro");
            definirBotaoCarregando(botao, false);
            formCadastro.removeAttribute("aria-busy");
        }
    });
}

if (formLogin) {
    formLogin.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const mensagem = document.getElementById("mensagemLogin");
        const botao = formLogin.querySelector("button[type='submit']");
        if (botao.disabled || !validarFormulario(formLogin, mensagem)) return;
        const usuario = document.getElementById("loginUsuario").value.trim();
        const senha = document.getElementById("loginSenha").value;

        formLogin.setAttribute("aria-busy", "true");
        definirBotaoCarregando(botao, true, "Verificando...");
        definirMensagem(mensagem, "Verificando...", "carregando");

        try {
            const usuarioEncontrado = await autenticarUsuario(usuario, senha);

            if (usuarioEncontrado) {
                iniciarSessao(usuarioEncontrado.id);
                definirMensagem(mensagem, "Login aceito! Indo para o perfil...", "sucesso");
                setTimeout(() => {
                    navegarComTransicao("perfil.html");
                }, 600);
                return;
            }

            definirMensagem(mensagem, "Usuario ou senha nao combinam.", "erro");
            definirBotaoCarregando(botao, false);
            formLogin.removeAttribute("aria-busy");
        } catch (erro) {
            definirMensagem(mensagem, "Nao foi possivel verificar o login. Tente novamente.", "erro");
            definirBotaoCarregando(botao, false);
            formLogin.removeAttribute("aria-busy");
        }
    });
}
