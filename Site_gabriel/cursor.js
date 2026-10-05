// cursor.js
// Cursor personalizado do Aviario Sonoro.
// Em telas com mouse/trackpad, mostra um anel suave + ponto central + pena.
// Em telas touch, o cursor original do dispositivo continua funcionando.

document.addEventListener("DOMContentLoaded", () => {
    const cursor = document.querySelector(".cursor");
    if (!cursor || !window.matchMedia("(pointer: fine)").matches) return;

    document.body.classList.add("cursor-personalizado");

    const ring = cursor.querySelector(".cursor-ring");
    const dot = cursor.querySelector(".cursor-dot");
    const icon = cursor.querySelector(".cursor-icon");

    const mover = (evento) => {
        const x = evento.clientX;
        const y = evento.clientY;

        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
        cursor.classList.add("visivel");
    };

    const elementosInterativos = "a, button, input, textarea, select, label, [role='button'], audio";

    document.addEventListener("mousemove", mover, { passive: true });

    document.addEventListener("mouseover", (evento) => {
        if (evento.target.closest(elementosInterativos)) {
            cursor.classList.add("hover");
        }
    });

    document.addEventListener("mouseout", (evento) => {
        if (evento.target.closest(elementosInterativos)) {
            cursor.classList.remove("hover");
        }
    });

    document.addEventListener("mousedown", () => {
        cursor.classList.add("clicking");
    });

    document.addEventListener("mouseup", () => {
        cursor.classList.remove("clicking");
    });

    window.addEventListener("blur", () => {
        cursor.classList.remove("visivel", "hover", "clicking");
    });

    // Evita avisos de lint caso a estrutura do cursor seja alterada futuramente.
    void ring;
    void dot;
    void icon;
});
