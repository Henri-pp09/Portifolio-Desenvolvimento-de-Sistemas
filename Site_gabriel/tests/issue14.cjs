// Regressão em um navegador isolado: nunca usa os dados do navegador pessoal.
// Execute: node tests/issue14.cjs (Playwright disponível no NODE_PATH).
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const raiz = path.resolve(__dirname, "..");
const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDa8AAAAASUVORK5CYII=";
const foto = `data:image/png;base64,${pixel}`;
const erros = [];
const consultas = [];
let browser;
let servidor;
let aprovados = 0;

async function verificar(nome, acao) {
    await acao();
    aprovados++;
    console.log(`OK ${aprovados}: ${nome}`);
}

async function executar() {
    servidor = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, "http://localhost");
            const arquivo = path.resolve(raiz, `.${decodeURIComponent(url.pathname)}`);
            if (!arquivo.startsWith(raiz + path.sep)) { res.writeHead(403).end(); return; }
            const tipos = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                ".css": "text/css; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png",
                ".mp3": "audio/mpeg", ".woff2": "font/woff2" };
            res.writeHead(200, { "Content-Type": tipos[path.extname(arquivo)] || "application/octet-stream" });
            res.end(await fs.readFile(arquivo));
        } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
    const origem = `http://127.0.0.1:${servidor.address().port}`;
    browser = await chromium.launch({ headless: true, channel: process.env.ISSUE14_BROWSER || "chromium" });
    const contexto = await browser.newContext({ reducedMotion: "reduce" });
    await contexto.route("https://fonts.googleapis.com/**", route => route.abort());
    await contexto.route("https://fonts.gstatic.com/**", route => route.abort());
    // Resposta determinística, mantendo a consulta e identificação científica reais.
    await contexto.route("https://api.inaturalist.org/**", async route => {
        const q = new URL(route.request().url()).searchParams.get("q");
        consultas.push(q);
        await route.fulfill({ json: { results: [{ id: 18793, name: q,
            default_photo: { medium_url: "https://teste.invalid/ave.png", attribution: "Foto de teste" } }] } });
    });
    await contexto.route("https://teste.invalid/**", route => route.fulfill({
        contentType: "image/png", body: Buffer.from(pixel, "base64") }));
    const pagina = await contexto.newPage();
    pagina.on("pageerror", erro => erros.push(erro.message));
    const abrir = async arquivo => {
        await pagina.goto(`${origem}/${arquivo}`, { waitUntil: "domcontentloaded" });
        await pagina.waitForFunction(() => !document.body.classList.contains("pagina-carregando"));
        if (arquivo.startsWith("perfil")) {
            await pagina.waitForFunction(() => !document.getElementById("conteudoPerfil").hasAttribute("aria-busy"));
        }
    };
    const nomesFavoritos = () => pagina.locator("#listaFavoritos h3").allTextContents();
    const esperarPerfil = () => pagina.waitForURL("**/perfil.html");
    await abrir("hub.html");
    const legado = { id: "legado", nome: "Usuário Antigo", usuario: "antigo", senhaHash: "hash-preservado", extra: "preservar" };
    await pagina.evaluate(u => localStorage.setItem("aviario_usuarios", JSON.stringify([u])), legado);
    let a, b;

    await verificar("cadastro A e B preserva o usuário antigo e inicia a sessão", async () => {
        for (const [nome, usuario, bio] of [["João Silva", "joao", "Observando aves"], ["Maria Souza", "maria", ""]]) {
            await abrir("cadastro.html");
            await pagina.locator("#cadastroNome").fill(nome);
            await pagina.locator("#cadastroUsuario").fill(usuario);
            await pagina.locator("#cadastroBio").fill(bio);
            await pagina.locator("#cadastroSenha").fill("senha-de-teste");
            await pagina.locator("button[type=submit]").click();
            await esperarPerfil();
            await pagina.locator("#nomePerfil").filter({ hasText: nome }).waitFor();
        }
        [a, b] = await pagina.evaluate(() => listarUsuarios().filter(u => u.id !== "legado"));
        assert.deepEqual(await pagina.evaluate(() => buscarUsuarioPorId("legado")), legado);
        assert.equal(await pagina.locator("#botaoSair").isVisible(), true);
    });

    await verificar("login A, perfil próprio, favoritos e posts vazios", async () => {
        await pagina.locator("#botaoSair").click();
        await pagina.waitForURL("**/hub.html");
        await abrir("login.html");
        await pagina.locator("#loginUsuario").fill("joao");
        await pagina.locator("#loginSenha").fill("senha-de-teste");
        await pagina.locator("button[type=submit]").click();
        await esperarPerfil();
        await pagina.locator("#nomePerfil").filter({ hasText: a.nome }).waitFor();
        assert.equal(await pagina.locator("#controlesPerfil").isVisible(), true);
        assert.equal(await pagina.locator("#campoAvatar").isEnabled(), true);
        assert.match(await pagina.locator("#listaFavoritos").innerText(), /Você ainda não favoritou nenhum pássaro/);
        assert.match(await pagina.locator("#colunaPosts").innerText(), /Você ainda não publicou nada/);
        assert.equal(await pagina.locator("#explorarCatalogo").isVisible(), true);
    });

    await verificar("catálogo adiciona Sabiá e Tucano; perfil mostra somente os dois", async () => {
        await abrir("catalogo.html");
        for (const id of ["sabia-laranjeira", "tucano-toco"]) {
            await pagina.locator(`[data-especie-id="${id}"] .botao-favorito`).click();
        }
        await abrir("perfil.html");
        assert.deepEqual((await nomesFavoritos()).sort(), ["Sabiá-laranjeira", "Tucano-toco"].sort());
        assert.equal(await pagina.locator("#contagemFavoritos").innerText(), "2");
        assert.equal(await pagina.locator("#listaFavoritos button").count(), 0);
    });

    await verificar("remover Sabiá no catálogo atualiza o perfil, inclusive ao voltar", async () => {
        await pagina.locator("#explorarCatalogo").click();
        await pagina.waitForURL("**/catalogo.html");
        await pagina.locator('[data-especie-id="sabia-laranjeira"] .botao-favorito').click();
        await pagina.goBack();
        await pagina.locator("#listaFavoritos h3").filter({ hasText: "Tucano-toco" }).waitFor();
        assert.deepEqual(await nomesFavoritos(), ["Tucano-toco"]);
    });

    await verificar("upload de avatar e banner; feed usa a foto atual e preserva posts", async () => {
        const arquivo = { name: "foto.png", mimeType: "image/png", buffer: Buffer.from(pixel, "base64") };
        for (const campo of ["#campoAvatar", "#campoBanner"]) {
            await pagina.locator(campo).setInputFiles(arquivo);
            await pagina.waitForFunction(() => document.getElementById("mensagemImagens").classList.contains("sucesso"));
        }
        assert.equal(await pagina.locator("#avatarPerfil img").count(), 1);
        assert.equal(await pagina.locator("#bannerPerfil img").count(), 1);
        await abrir("hub.html");
        await pagina.locator("#textoPost").fill("Publicação do João");
        await pagina.locator("#formNovoPost button[type=submit]").click();
        await pagina.locator("#listaFeed .post").filter({ hasText: "Publicação do João" }).waitFor();
        assert.equal(await pagina.locator("#listaFeed .avatar img").count(), 1);
        assert.equal(await pagina.locator("#avatarHub img").count(), 1);
        await pagina.evaluate(({ id, foto }) => atualizarUsuario(id, { avatarUrl: foto }), { id: a.id, foto });
        await pagina.reload();
        await pagina.locator("#listaFeed .avatar img").waitFor();
        assert.equal(await pagina.locator("#listaFeed .avatar img").getAttribute("src"), foto);
        assert.equal(await pagina.evaluate(() => listarPosts()[0].avatarUrl), undefined);
    });

    await verificar("post B e favorito Ema permanecem separados dos dados de A", async () => {
        await pagina.evaluate(id => iniciarSessao(id), b.id);
        await abrir("hub.html");
        await pagina.locator("#textoPost").fill("Publicação da Maria");
        await pagina.locator("#imagemPost").setInputFiles({ name: "post.png", mimeType: "image/png", buffer: Buffer.from(pixel, "base64") });
        await pagina.locator("#previaImagemPost").waitFor();
        await pagina.locator("#formNovoPost button[type=submit]").click();
        await pagina.locator("#listaFeed .post").filter({ hasText: "Publicação da Maria" }).waitFor();
        await abrir("catalogo.html");
        await pagina.locator("#buscaEspecies").fill("Ema");
        await pagina.locator('[data-especie-id="ema"] .botao-favorito').click();
        await abrir("perfil.html");
        assert.deepEqual(await nomesFavoritos(), ["Ema"]);
        assert.match(await pagina.locator("#colunaPosts").innerText(), /Publicação da Maria/);
        assert.equal(await pagina.locator("#colunaPosts .midia-post img").count(), 1);
        assert.doesNotMatch(await pagina.locator("#colunaPosts").innerText(), /Publicação do João/);
        await pagina.evaluate(id => iniciarSessao(id), a.id);
    });

    await verificar("A visita B sem controles privados; handlers também recusam alteração", async () => {
        await abrir(`perfil.html?id=${b.id}`);
        assert.equal(await pagina.locator("#nomePerfil").innerText(), b.nome);
        assert.equal(await pagina.locator("#controlesPerfil").isVisible(), false);
        assert.equal(await pagina.locator("#botaoSair").isVisible(), false);
        assert.equal(await pagina.locator("#campoAvatar").isEnabled(), false);
        assert.equal(await pagina.locator("#campoBanner").isEnabled(), false);
        assert.equal(await pagina.locator("#explorarCatalogo").isVisible(), false);
        assert.deepEqual(await nomesFavoritos(), ["Ema"]);
        assert.match(await pagina.locator("#bioPerfil").innerText(), /ainda não escreveu uma bio/);
        const antes = await pagina.evaluate(() => localStorage.getItem("aviario_usuarios"));
        await pagina.evaluate(() => {
            document.getElementById("botaoSair").click();
            document.getElementById("campoAvatar").dispatchEvent(new Event("change"));
            document.getElementById("campoBanner").dispatchEvent(new Event("change"));
        });
        assert.equal(await pagina.evaluate(() => usuarioLogado().id), a.id);
        assert.equal(await pagina.evaluate(() => localStorage.getItem("aviario_usuarios")), antes);
        const html = await pagina.locator("main").innerHTML();
        assert.doesNotMatch(html, /senhaHash|senha-de-teste|aviario_sessao/);
        assert.ok(!html.includes(b.senhaHash));
    });

    await verificar("links de avatar, nome e @ levam a A e B; likes ainda alternam", async () => {
        await abrir("hub.html");
        const maria = pagina.locator("#listaFeed .post").filter({ hasText: "Publicação da Maria" });
        await maria.locator(".botao-curtir").click();
        assert.equal(await maria.locator(".botao-curtir").getAttribute("aria-pressed"), "true");
        await maria.locator(".botao-curtir").click();
        assert.equal(await maria.locator(".botao-curtir").getAttribute("aria-pressed"), "false");
        const joao = pagina.locator("#listaFeed .post").filter({ hasText: "Publicação do João" });
        assert.equal(await joao.locator(".autor-post").getAttribute("href"), `perfil.html?id=${a.id}`);
        await joao.locator(".autor-post .avatar").click();
        await pagina.waitForURL(`**/perfil.html?id=${a.id}`);
        await pagina.locator("#nomePerfil").filter({ hasText: a.nome }).waitFor();
        assert.match(await pagina.locator("#colunaPosts").innerText(), /Publicação do João/);
        assert.doesNotMatch(await pagina.locator("#colunaPosts").innerText(), /Publicação da Maria/);
        assert.equal(await pagina.locator("#botaoSair").isVisible(), true);
        await pagina.locator(".voltar-feed").first().click();
        await pagina.waitForURL("**/hub.html");
        await maria.locator(".autor-post strong").click();
        await pagina.waitForURL(`**/perfil.html?id=${b.id}`);
        await pagina.locator("#nomePerfil").filter({ hasText: b.nome }).waitFor();
    });

    await verificar("logout mantém perfis públicos; ID inválido e perfil sem sessão têm estados próprios", async () => {
        await abrir("perfil.html");
        await pagina.locator("#botaoSair").click();
        await pagina.waitForURL("**/hub.html");
        await abrir(`perfil.html?id=${a.id}`);
        assert.equal(await pagina.locator("#nomePerfil").innerText(), a.nome);
        assert.equal(await pagina.locator("#botaoSair").isVisible(), false);
        assert.deepEqual(await nomesFavoritos(), ["Tucano-toco"]);
        await abrir("perfil.html?id=inexistente");
        assert.match(await pagina.locator("#mensagemPerfil").innerText(), /Perfil não encontrado/);
        assert.equal(await pagina.locator("#conteudoPerfil").isVisible(), false);
        await abrir("perfil.html?id=");
        assert.match(await pagina.locator("#mensagemPerfil").innerText(), /Perfil não encontrado/);
        await abrir("perfil.html");
        assert.equal(await pagina.locator("#entrarPerfil").isVisible(), true);
        await abrir("perfil.html?id=legado");
        assert.match(await pagina.locator("#colunaPosts").innerText(), /Este usuário ainda não publicou nada/);
        assert.match(await pagina.locator("#listaFavoritos").innerText(), /Este usuário ainda não favoritou nenhum pássaro/);
        assert.equal(await pagina.locator("#avatarPerfil").innerText(), "UA");
    });

    await verificar("favoritos antigos: IDs, objetos e nomes científicos são lidos sem apagar dados", async () => {
        await pagina.evaluate(() => atualizarUsuario("legado", { favoritos: [
            "tucano-toco", { id: "ema" }, { nomeCientifico: "Turdus rufiventris" }, "tucano-toco", "id-antigo-desconhecido" ] }));
        await abrir("perfil.html?id=legado");
        assert.deepEqual((await nomesFavoritos()).sort(), ["Ema", "Sabiá-laranjeira", "Tucano-toco"].sort());
        assert.equal(await pagina.evaluate(() => buscarUsuarioPorId("legado").favoritos.length), 5);
        assert.equal(await pagina.evaluate(() => buscarUsuarioPorId("legado").extra), "preservar");
        assert.equal(await pagina.evaluate(() => listarUsuarios().length), 3);
    });

    await verificar("alterações em outra aba atualizam favoritos e retiram controles após logout", async () => {
        await pagina.evaluate(id => iniciarSessao(id), a.id);
        await abrir(`perfil.html?id=${a.id}`);
        const outra = await contexto.newPage();
        await outra.goto(`${origem}/catalogo.html`);
        await outra.locator('[data-especie-id="sabia-laranjeira"] .botao-favorito').click();
        await pagina.waitForFunction(() => document.querySelectorAll("#listaFavoritos h3").length === 2);
        await outra.evaluate(() => encerrarSessao());
        await pagina.waitForFunction(() => document.getElementById("botaoSair").hidden);
        await outra.close();
    });

    await verificar("catálogo e ficha usam nomes populares; busca científica, filtros, API e áudio funcionam", async () => {
        await abrir("catalogo.html");
        await pagina.locator("#buscaEspecies").fill("Turdus rufiventris");
        const sabia = pagina.locator('[data-especie-id="sabia-laranjeira"]');
        assert.equal(await sabia.locator("h3").innerText(), "Sabiá-laranjeira");
        assert.equal(await pagina.locator(".card-catalogo:visible").count(), 1);
        await sabia.locator(".botao-ficha").click();
        assert.equal(await pagina.locator("#tituloFicha").innerText(), "Sabiá-laranjeira");
        assert.doesNotMatch(await pagina.locator("#fichaEspecie").innerText(), /Turdus rufiventris|Nome científico|Outros nomes científicos/);
        assert.equal(await pagina.evaluate(() => ESPECIES_CATALOGO.find(e => e.id === "sabia-laranjeira").nomeCientifico), "Turdus rufiventris");
        assert.match(await sabia.innerText(), /Áudio indisponível/);
        await pagina.locator("#fecharFicha").click();
        await pagina.locator("#buscaEspecies").fill("Ramphastos toco");
        const tucano = pagina.locator('[data-especie-id="tucano-toco"]');
        await tucano.locator(".botao-ficha").click();
        assert.equal(await pagina.locator("#tituloFicha").innerText(), "Tucano-toco");
        const audio = tucano.locator("audio");
        await tucano.locator('button[aria-label="Reproduzir canto de Tucano-toco"]').click();
        await pagina.waitForFunction(() => !document.querySelector('[data-especie-id="tucano-toco"] audio').paused);
        assert.equal(await audio.evaluate(el => el.error), null);
        await tucano.locator('button[aria-label="Pausar canto de Tucano-toco"]').click();
        assert.equal(await audio.evaluate(el => el.paused), true);
        await pagina.locator("#fecharFicha").click();
        assert.equal(await pagina.locator("#fichaEspecie").isVisible(), false);
        await pagina.locator("#buscaEspecies").fill("");
        await pagina.locator("#filtroSituacao").selectOption("extinta");
        const grupos = await pagina.locator(".card-catalogo:visible").evaluateAll(cards => cards.map(c => c.dataset.especieId));
        assert.ok(grupos.length > 0);
        assert.ok(await pagina.evaluate(ids => ids.every(id => ESPECIES_CATALOGO.find(e => e.id === id).grupo === "extinta"), grupos));
        await pagina.locator("#buscaEspecies").fill("ave-que-não-existe");
        assert.equal(await pagina.locator("#catalogoVazio").isVisible(), true);
        assert.ok(consultas.includes("Turdus rufiventris"));
        assert.ok(consultas.includes("Ramphastos toco"));
        assert.ok(consultas.includes("Ara ararauna"));
    });

    await verificar("texto malicioso, imagens inválidas e posts antigos têm fallbacks seguros", async () => {
        await pagina.evaluate(() => {
            atualizarUsuario("legado", { nome: '<img src=x onerror="window.injetado=true">', bio: '<script>window.injetado=true</script>',
                avatarUrl: "javascript:alert(1)", bannerUrl: "data:text/html,<script>alert(1)</script>" });
            const posts = listarPosts();
            posts.push({ id: 'id"inseguro', autorId: "legado", autorNome: "Antigo", autorUsuario: 'antigo" onerror="window.injetado=true',
                texto: '<img src=x onerror="window.injetado=true">', criadoEm: new Date().toISOString() });
            salvarPosts(posts);
        });
        await abrir("perfil.html?id=legado");
        assert.equal(await pagina.locator("#nomePerfil img").count(), 0);
        assert.equal(await pagina.locator("#avatarPerfil img").count(), 0);
        assert.equal(await pagina.locator("#bannerPerfil img").count(), 0);
        assert.match(await pagina.locator(".acoes-post").innerText(), /0 curtida/);
        assert.equal(await pagina.evaluate(() => window.injetado), undefined);
        await pagina.evaluate(() => iniciarSessao(buscarUsuarioPorId("legado").id));
        await abrir("hub.html");
        const post = pagina.locator("#listaFeed .post").filter({ hasText: 'window.injetado=true' });
        await post.locator(".botao-curtir").click();
        assert.equal(await post.locator(".botao-curtir").getAttribute("aria-pressed"), "true");
        await pagina.evaluate(() => atualizarUsuario("legado", { nome: "Usuário Antigo", bio: "" }));
    });

    await verificar("estado carregando e sessão trocada durante upload protegem o dono", async () => {
        await pagina.evaluate(id => iniciarSessao(id), a.id);
        let liberarScript;
        let avisarInterceptacao;
        const interceptado = new Promise(resolve => { avisarInterceptacao = resolve; });
        const espera = new Promise(resolve => { liberarScript = resolve; });
        const segurarScript = async route => {
            avisarInterceptacao();
            await espera;
            await route.continue();
        };
        await pagina.route("**/perfil.js", segurarScript);
        const navegacao = pagina.goto(`${origem}/perfil.html`);
        await interceptado;
        assert.equal(await pagina.locator("#mensagemPerfil").textContent(), "Carregando perfil...");
        assert.equal(await pagina.locator("#conteudoPerfil").getAttribute("aria-busy"), "true");
        assert.equal(await pagina.locator("#controlesPerfil").getAttribute("hidden"), "");
        liberarScript();
        await navegacao;
        await pagina.unroute("**/perfil.js", segurarScript);
        await pagina.locator("#nomePerfil").filter({ hasText: a.nome }).waitFor();
        const antes = await pagina.evaluate(id => buscarUsuarioPorId(id).avatarUrl, a.id);
        await pagina.evaluate(({ id, foto }) => {
            redimensionarImagem = async () => { iniciarSessao(id); return foto; };
        }, { id: b.id, foto });
        await pagina.locator("#campoAvatar").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from(pixel, "base64") });
        await pagina.waitForFunction(() => document.getElementById("mensagemImagens").classList.contains("erro"));
        assert.equal(await pagina.evaluate(id => buscarUsuarioPorId(id).avatarUrl, a.id), antes);
        assert.equal(await pagina.locator("#campoAvatar").isEnabled(), false);
    });

    await verificar("perfil em 375, 768 e 1440 px sem overflow, com imagens e posts responsivos", async () => {
        await pagina.evaluate(id => atualizarUsuario(id, {
            avatarUrl: "foto de passaros/tucano_toco.jpg", bannerUrl: "Outras Fotos/Frutiger aero wallpaper.jpg"
        }), a.id);
        await abrir(`perfil.html?id=${a.id}`);
        for (const largura of [375, 768, 1440]) {
            await pagina.setViewportSize({ width: largura, height: 1000 });
            assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
            assert.ok(await pagina.locator(".card-favorito").evaluateAll(cards => cards.every(c => c.getBoundingClientRect().right <= innerWidth)));
            if (process.env.ISSUE14_SCREENSHOTS) {
                await fs.mkdir(process.env.ISSUE14_SCREENSHOTS, { recursive: true });
                await pagina.screenshot({ path: path.join(process.env.ISSUE14_SCREENSHOTS, `perfil-${largura}.png`), fullPage: true });
            }
        }
        assert.deepEqual(erros, []);
    });
    console.log(`${aprovados} grupos de cenários aprovados; nenhum erro JavaScript.`);
}

executar().catch(erro => { console.error(erro); process.exitCode = 1; }).finally(async () => {
    if (browser) await browser.close();
    if (servidor) await new Promise(resolve => servidor.close(resolve));
});
