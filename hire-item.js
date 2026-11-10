/* =========================
   ONE HIRE ITEM (hire/<name>.html, written by scripts/build-credits.js)
   Adds the "how many" stepper and "Add to enquiry" button, using the
   same enquiry list as the hire page (basket.js).
========================= */

(function () {
    const page = document.querySelector("[data-hire-id]");
    const actions = document.getElementById("itemActions");
    const status = document.getElementById("itemStatus");
    if (!page || !actions || typeof Basket === "undefined") return;

    const id = page.dataset.hireId;
    const name = page.querySelector("h1").textContent.replace(/ hire$/, "");

    let wanted = 1;
    const stepper = quantityStepper(1, (qty) => {
        wanted = qty;
        if (Basket.get(id)) Basket.set(id, qty);
    }, name);

    const add = document.createElement("button");
    add.type = "button";
    add.className = "button hire-add";
    add.addEventListener("click", () => {
        if (Basket.get(id)) Basket.remove(id);
        else Basket.set(id, wanted);
    });

    actions.append(stepper, add);

    function render() {
        const entry = Basket.get(id);
        add.textContent = entry ? "Remove" : "Add to enquiry";
        add.classList.toggle("button-ghost", Boolean(entry));
        if (entry && document.activeElement !== stepper.input) stepper.input.value = entry.qty;
        status.innerHTML = entry
            ? 'On your enquiry. <a href="basket.html">View your enquiry</a> or <a href="hire.html#equipment">add more kit</a>.'
            : "";
    }

    Basket.onChange(render);
    render();
})();
