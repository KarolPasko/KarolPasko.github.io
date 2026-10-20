/* =========================
   STAGE FX
   Fades sections in as they scroll into view, and moves a soft
   follow spot around cards under the pointer.
========================= */

(function () {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if ("IntersectionObserver" in window && !reduceMotion) {
        const targets = document.querySelectorAll(
            ".section-header, .card-grid:not(.project-grid) > *, .console, .about-text, .about-facts li, .timeline > *, .project-list > *, .study-card, .enquiry-form, .services-note, .home-choice"
        );

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("in");
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: "0px 0px -8% 0px" });

        targets.forEach((el) => {
            const siblings = Array.from(el.parentElement.children);
            el.style.setProperty("--reveal-delay", (Math.min(siblings.indexOf(el), 5) * 0.08) + "s");
            el.classList.add("reveal");
            observer.observe(el);
        });
    }

    document.addEventListener("pointermove", (event) => {
        const card = event.target.closest && event.target.closest(".card, .home-choice, .console");
        if (!card) return;
        const box = card.getBoundingClientRect();
        card.style.setProperty("--mx", (event.clientX - box.left) + "px");
        card.style.setProperty("--my", (event.clientY - box.top) + "px");
    });
})();
