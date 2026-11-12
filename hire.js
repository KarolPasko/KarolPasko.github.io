/* =========================
   EQUIPMENT HIRE
   Shows the equipment from images/equipment.json (set on the admin page).
   Visitors pick how many they want and add them to their basket
   (basket.js), then check out on basket.html, which emails the enquiry.
========================= */

(async function () {
    const grid = document.getElementById("equipmentGrid");
    const bar = document.getElementById("hireBar");
    const barCount = document.getElementById("hireBarCount");

    const items = await Basket.loadItems();
    Basket.keepOnly(items);

    const cards = {};
    let lastAdded = "";
    let lastCount = Basket.totalQty();

    /* Each item has its own page at hire/<name>.html (written by scripts/build-credits.js) */
    const pages = itemPages(items);

    function renderGrid() {
        grid.innerHTML = "";

        if (!items.length) {
            const empty = document.createElement("p");
            empty.className = "hire-empty";
            empty.innerHTML = 'I\'m still putting the list together. <a href="index.html#contact">Ask me</a> about what you need.';
            grid.appendChild(empty);
            return;
        }

        items.forEach((item) => {
            const card = document.createElement("article");
            card.className = "card hire-card";
            card.id = item.id;   /* matches the links in the schema.org data */

            if (item.photo) {
                const img = document.createElement("img");
                img.src = item.photo;
                img.alt = item.alt || `${item.name} for hire in Blackpool`;
                img.loading = "lazy";
                card.appendChild(img);
            }

            const name = document.createElement("h3");
            const link = document.createElement("a");
            link.href = pages[item.id];
            link.textContent = item.name;
            name.appendChild(link);
            card.appendChild(name);

            if (item.description) {
                const text = document.createElement("p");
                text.className = "hire-description";
                text.textContent = item.description;
                card.appendChild(text);
            }

            /* How many to add. Once it's in the basket this changes the basket directly. */
            let wanted = 1;
            const stepper = quantityStepper(1, (qty) => {
                wanted = qty;
                if (Basket.get(item.id)) Basket.set(item.id, qty);
            }, item.name);

            const add = document.createElement("button");
            add.type = "button";
            add.className = "button hire-add";
            add.addEventListener("click", () => {
                if (Basket.get(item.id)) return;   /* already on: the "Remove" link takes it off */
                lastAdded = item.name;
                Basket.set(item.id, wanted);
            });

            const status = document.createElement("p");
            status.className = "hire-in-basket";
            status.setAttribute("role", "status");
            status.addEventListener("click", (event) => {
                if (event.target.closest(".hire-remove")) Basket.remove(item.id);
            });

            /* Shows on the photo once it's on the enquiry */
            const badge = document.createElement("span");
            badge.className = "hire-added-badge";
            badge.setAttribute("aria-hidden", "true");
            badge.textContent = "\u2713 Added";
            card.appendChild(badge);

            const actions = document.createElement("div");
            actions.className = "hire-actions";
            actions.append(stepper, add);
            card.append(actions, status);

            cards[item.id] = { card, stepper, add, status };
            grid.appendChild(card);
        });
    }

    function render() {
        items.forEach((item) => {
            const parts = cards[item.id];
            if (!parts) return;
            const entry = Basket.get(item.id);

            parts.card.classList.toggle("is-added", Boolean(entry));
            parts.add.textContent = entry ? "\u2713 Added" : "Add to enquiry";
            parts.add.classList.toggle("is-added", Boolean(entry));
            parts.add.setAttribute("aria-pressed", entry ? "true" : "false");
            if (entry && document.activeElement !== parts.stepper.input) {
                parts.stepper.input.value = entry.qty;
            }
            parts.status.innerHTML = entry
                ? `On your enquiry. <a href="basket.html">View your enquiry</a> or <button type="button" class="hire-remove">remove it</button>`
                : "";
        });

        const count = Basket.totalQty();
        const total = `${count} ${count === 1 ? "item" : "items"} on your enquiry`;
        barCount.textContent = lastAdded && count > lastCount ? `${lastAdded} added. ${total}` : total;
        bar.hidden = count === 0;

        /* A short flash of blue on the bar each time something is added */
        if (count > lastCount && !bar.hidden) {
            bar.classList.remove("is-flashing");
            void bar.offsetWidth;
            bar.classList.add("is-flashing");
        }
        lastCount = count;
        lastAdded = "";
        document.body.classList.toggle("has-hire-bar", count > 0);
    }

    Basket.onChange(render);
    renderGrid();
    render();
})();

/* hire/<name>.html for each item; must match itemPages() in scripts/build-credits.js */
function itemPages(items) {
    const pages = {};
    const used = new Set();
    for (const item of items) {
        const base = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
        let slug = base;
        for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
        used.add(slug);
        pages[item.id] = `hire/${slug}.html`;
    }
    return pages;
}
