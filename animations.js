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
            const travel = rect.height - window.innerHeight;
            const p = clamp(-rect.top / travel); // 0 at top of section, 1 at the end

            // 0 → 0.4 chunks come together, 0.4 → 0.62 hold, 0.62 → 1 break apart
            let spread;
            if (p < 0.4) spread = 1 - ease(p / 0.4);
            else if (p < 0.62) spread = 0;
            else spread = ease((p - 0.62) / 0.38) * 1.6;

            const dist = 260; // logo units at full spread
            chunks.forEach((c) => {
                if (!c.el) return;
                const s = spread;
                c.el.style.transform =
                    `translate(${c.x * dist * s}px, ${c.y * dist * s}px) rotate(${c.r * s}deg) scale(${1 - 0.15 * Math.min(s, 1)})`;
                c.el.style.opacity = String(1 - clamp((s - 0.9) / 0.7));
            });

            const held = p >= 0.36 && p < 0.7 ? 1 : 0;
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
        ".section-header, .card, .console, .about-text, .about-side, .contact h2, .enquiry-form, .photo-band img"
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
        if (el.matches(".card, .console, .photo-band img")) {
            el.style.transitionDelay = `${(index % 4) * 80}ms`;
        }
        el.classList.add("reveal");
        io.observe(el);
    });
})();
