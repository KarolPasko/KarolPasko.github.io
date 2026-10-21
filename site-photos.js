/* =========================
   LIGHTING PAGE PHOTOS
   Shows the photos from images/site-photos.json (set on the admin page)
   behind the hero title, one at a time with its note along the bottom,
   and the About photo. Hero photos fade to the next one every 10 seconds.
========================= */

(async function () {
    let info;
    try {
        const response = await fetch("images/site-photos.json", { cache: "no-cache" });
        if (!response.ok) return;
        info = await response.json();
    } catch (error) {
        return; // no photos set yet
    }

    const hero = (info.hero || []).filter((entry) => entry.file);
    const heroSection = document.getElementById("home");

    if (hero.length && heroSection) {
        const slides = heroSection.querySelectorAll(".hero-slide");
        const note = document.getElementById("heroNote");
        const count = document.getElementById("heroCount");
        const dots = document.getElementById("heroDots");
        const pad = (n) => String(n).padStart(2, "0");
        let current = -1;
        let front = 0;
        let timer = null;

        hero.forEach((entry, index) => {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.setAttribute("aria-label", `Show photo ${index + 1}`);
            dot.addEventListener("click", () => { show(index); restart(); });
            dots.appendChild(dot);
        });
        dots.hidden = hero.length < 2;

        /* Two stacked images: the new photo fades in over the old one */
        function show(index) {
            index = (index + hero.length) % hero.length;
            if (index === current) return;
            current = index;
            front = 1 - front;
            slides[front].src = hero[index].file;
            slides[front].classList.add("is-active");
            slides[1 - front].classList.remove("is-active");
            note.textContent = hero[index].note || "";
            count.textContent = `${pad(index + 1)} / ${pad(hero.length)}`;
            [...dots.children].forEach((dot, i) => dot.classList.toggle("is-active", i === index));
        }

        /* Moves on every 10 seconds, unless the visitor prefers reduced motion */
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        function restart() {
            clearInterval(timer);
            if (!still && hero.length > 1) timer = setInterval(() => show(current + 1), 10000);
        }

        show(0);
        restart();
        heroSection.classList.add("has-photo");
        document.getElementById("heroPhoto").hidden = false;
        document.getElementById("heroCaption").hidden = false;

        /* Fetch the rest now so each change is instant */
        hero.slice(1).forEach((entry) => { new Image().src = entry.file; });
    }

    const aboutFigure = document.getElementById("aboutPhoto");
    if (info.about && aboutFigure) {
        aboutFigure.querySelector("img").src = info.about;
        aboutFigure.hidden = false;
    }
})();
