/* =========================
   ANIMATIONS
   1. Header logo builds itself on load (CSS, see style.css).
   2. The big KLD logo flies together from chunks as you scroll down to it,
      then breaks back apart into chunks as you scroll past.
   3. Sections fade up as they come into view.
   Everything is skipped for people who ask for reduced motion.
========================= */

(function () {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    document.documentElement.classList.add("motion");

    /* ---- Logo burst ---- */
    const burst = document.querySelector(".logo-burst");
    if (burst) {
        // Direction each chunk travels (x, y in logo units) and how far it spins.
        const chunks = [
            { el: burst.querySelector(".c1"), x: -1.1, y: 0.7, r: -28 },
            { el: burst.querySelector(".c2"), x: -0.4, y: -1.2, r: 34 },
            { el: burst.querySelector(".c3"), x: 0.3, y: 1.3, r: -46 },
            { el: burst.querySelector(".c4"), x: 0.2, y: -1.4, r: 18 },
            { el: burst.querySelector(".c5"), x: 1.3, y: 0.3, r: 24 }
        ];
        const word = burst.querySelector(".burst-word");
        const caption = burst.querySelector(".burst-caption");
        const ease = (t) => 1 - Math.pow(1 - t, 3);
        const clamp = (v) => Math.min(1, Math.max(0, v));

        let ticking = false;
        const update = () => {
            ticking = false;
            const rect = burst.getBoundingClientRect();
            // Starts as the section enters from the bottom of the screen, so the
            // chunks come together while it scrolls up and little extra scrolling is needed.
            const vh = window.innerHeight;
            const range = rect.height; // from entering to the end of the pinned part
            const p = clamp((vh - rect.top) / range);
            const pinned = vh / range; // the point where the panel locks in place

            // chunks come together until the panel locks, hold briefly, then break apart
            const holdEnd = pinned + (1 - pinned) * 0.35;
            let spread;
            if (p < pinned) spread = 1 - ease(p / pinned);
            else if (p < holdEnd) spread = 0;
            else spread = ease((p - holdEnd) / (1 - holdEnd)) * 1.6;

            const dist = 260; // logo units at full spread
            chunks.forEach((c) => {
                if (!c.el) return;
                const s = spread;
                c.el.style.transform =
                    `translate(${c.x * dist * s}px, ${c.y * dist * s}px) rotate(${c.r * s}deg) scale(${1 - 0.15 * Math.min(s, 1)})`;
                c.el.style.opacity = String(1 - clamp((s - 0.9) / 0.7));
            });

            const held = p >= pinned * 0.9 && p < holdEnd + (1 - holdEnd) * 0.25 ? 1 : 0;
            if (word) word.style.opacity = String(held);
            if (caption) caption.classList.toggle("on", held === 1);
        };
        const onScroll = () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        update();
    }

    /* ---- Fade up on scroll ---- */
    const targets = document.querySelectorAll(
        ".section-header, .card, .service-list > div, .desks, .about-text, .about-side, .contact h2, .enquiry-form"
    );
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("in");
                io.unobserve(entry.target);
            }
        });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });

    targets.forEach((el) => {
        // stagger cards that sit side by side in a grid
        const siblings = el.parentElement ? Array.from(el.parentElement.children) : [];
        const index = siblings.indexOf(el);
        if (el.matches(".card, .service-list > div")) {
            el.style.transitionDelay = `${(index % 4) * 80}ms`;
        }
        el.classList.add("reveal");
        io.observe(el);
    });
})();
