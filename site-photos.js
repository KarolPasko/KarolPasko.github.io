/* =========================
   LIGHTING PAGE PHOTOS
   Shows the photos from images/site-photos.json (set on the admin page)
   behind the hero title, one at a time with its note, and the About
   photo. Photos only change when a visitor clicks the arrows.
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
        const image = document.getElementById("heroImage");
        const note = document.getElementById("heroNote");
        const count = document.getElementById("heroCount");
        let current = 0;

        function show(index) {
            current = (index + hero.length) % hero.length;
            image.src = hero[current].file;
            note.textContent = hero[current].note || "";
            count.textContent = `${String(current + 1).padStart(2, "0")} / ${String(hero.length).padStart(2, "0")}`;
        }

        document.getElementById("heroPrev").addEventListener("click", () => show(current - 1));
        document.getElementById("heroNext").addEventListener("click", () => show(current + 1));
        document.getElementById("heroPhotoNav").hidden = hero.length < 2;

        show(0);
        heroSection.classList.add("has-photo");
        document.getElementById("heroPhoto").hidden = false;

        /* Fetch the rest now so clicking through is instant */
        hero.slice(1).forEach((entry) => { new Image().src = entry.file; });
    }

    const aboutFigure = document.getElementById("aboutPhoto");
    if (info.about && aboutFigure) {
        aboutFigure.querySelector("img").src = info.about;
        aboutFigure.hidden = false;
    }
})();
