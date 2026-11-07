/* =========================
   EQUIPMENT HIRE
   Shows the equipment from images/equipment.json (set on the admin page).
   Visitors add items to a list, set how many they need, and send the list
   with the enquiry form (sent by contact.js, the same as the lighting page).
   The list is remembered in this browser until it's sent.
========================= */

(async function () {
    const LIST_KEY = "kp-hire-list";

    const grid = document.getElementById("equipmentGrid");
    const listEl = document.getElementById("hireList");
    const listEmpty = document.getElementById("hireListEmpty");
    const field = document.getElementById("equipmentField");
    const submit = document.getElementById("hireSubmit");
    const bar = document.getElementById("hireBar");
    const barCount = document.getElementById("hireBarCount");
    const form = document.getElementById("enquiryForm");

    let items = [];   // [{ id, name, description, photo }]
    let list = [];    // [{ id, qty }] what the visitor has picked

    try {
        const response = await fetch("images/equipment.json", { cache: "no-cache" });
        if (response.ok) items = ((await response.json()).items || []).filter((item) => item.id && item.name);
    } catch (error) {
        /* no list yet */
    }

    try {
        const saved = JSON.parse(localStorage.getItem(LIST_KEY) || "[]");
        if (Array.isArray(saved)) list = saved;
    } catch (error) {
        /* private window */
    }
    list = list.filter((entry) => items.some((item) => item.id === entry.id));

    const byId = (id) => items.find((item) => item.id === id);
    const inList = (id) => list.find((entry) => entry.id === id);

    function save() {
        try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch (error) { /* ignore */ }
    }

    function toggle(id) {
        if (inList(id)) list = list.filter((entry) => entry.id !== id);
        else list.push({ id, qty: 1 });
        save();
        render();
    }

    /* ---- Equipment cards ---- */
    const buttons = {};

    function renderGrid() {
        grid.innerHTML = "";

        if (!items.length) {
            const empty = document.createElement("p");
            empty.className = "hire-empty";
            empty.innerHTML = 'I\'m still putting the list together. <a href="#enquire">Ask me</a> about what you need.';
            grid.appendChild(empty);
            return;
        }

        items.forEach((item) => {
            const card = document.createElement("article");
            card.className = "card hire-card";

            if (item.photo) {
                const img = document.createElement("img");
                img.src = item.photo;
                img.alt = item.name;
                img.loading = "lazy";
                card.appendChild(img);
            }

            const name = document.createElement("h3");
            name.textContent = item.name;
            card.appendChild(name);

            if (item.description) {
                const text = document.createElement("p");
                text.className = "hire-description";
                text.textContent = item.description;
                card.appendChild(text);
            }

            const button = document.createElement("button");
            button.type = "button";
            button.addEventListener("click", () => toggle(item.id));
            card.appendChild(button);
            buttons[item.id] = button;

            grid.appendChild(card);
        });
    }

    /* ---- The visitor's list ---- */
    function renderList() {
        listEl.innerHTML = "";

        list.forEach((entry) => {
            const item = byId(entry.id);
            const row = document.createElement("li");

            const name = document.createElement("span");
            name.className = "hire-list-name";
            name.textContent = item.name;

            const qtyLabel = document.createElement("label");
            qtyLabel.className = "hire-qty";
            qtyLabel.textContent = "How many ";
            const qty = document.createElement("input");
            qty.type = "number";
            qty.min = "1";
            qty.max = "999";
            qty.inputMode = "numeric";
            qty.value = entry.qty;
            qty.addEventListener("input", () => {
                const n = parseInt(qty.value, 10);
                entry.qty = n > 0 ? Math.min(n, 999) : 1;
                save();
                updateField();
            });
            qty.addEventListener("blur", () => { qty.value = entry.qty; });
            qtyLabel.appendChild(qty);

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "hire-remove";
            remove.textContent = "Remove";
            remove.setAttribute("aria-label", `Remove ${item.name} from your list`);
            remove.addEventListener("click", () => toggle(entry.id));

            row.append(name, qtyLabel, remove);
            listEl.appendChild(row);
        });

        listEmpty.hidden = list.length > 0;
        listEl.hidden = list.length === 0;
    }

    function updateField() {
        field.value = list.map((entry) => `${entry.qty} x ${byId(entry.id).name}`).join("\n");
    }

    function render() {
        items.forEach((item) => {
            const button = buttons[item.id];
            if (!button) return;
            const added = Boolean(inList(item.id));
            button.className = added ? "button button-ghost hire-toggle is-added" : "button hire-toggle";
            button.textContent = added ? "Remove from list" : "Add to list";
            button.closest(".hire-card").classList.toggle("is-added", added);
        });

        renderList();
        updateField();

        submit.disabled = list.length === 0;
        const count = list.length;
        barCount.textContent = `${count} ${count === 1 ? "item" : "items"} on your list`;
        bar.hidden = count === 0 || formInView;
    }

    /* Hide the bottom bar while the list itself is on screen */
    let formInView = false;
    if ("IntersectionObserver" in window) {
        new IntersectionObserver((entries) => {
            /* also hidden once scrolled past it, so it doesn't cover the footer */
            formInView = entries[0].isIntersecting || entries[0].boundingClientRect.top < 0;
            bar.hidden = list.length === 0 || formInView;
        }).observe(document.getElementById("enquire"));
    }

    /* Clear the list once the enquiry has gone through */
    form.addEventListener("enquiry-sent", () => {
        list = [];
        save();
        render();
    });

    renderGrid();
    render();
})();
