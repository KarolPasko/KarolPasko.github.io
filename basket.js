/* =========================
   HIRE BASKET
   Shared by the hire page (hire.js) and the basket/checkout page
   (checkout.js). The basket lives in this browser's localStorage until
   the enquiry is sent:
     kp-hire-list   [{ id, qty }]   what the visitor has picked
     kp-hire-dates  { from, to }    the hire dates (YYYY-MM-DD)
========================= */

const Basket = (function () {
    const LIST_KEY = "kp-hire-list";
    const DATES_KEY = "kp-hire-dates";
    const MAX_QTY = 99;

    function read(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value === null ? fallback : value;
        } catch (error) {
            return fallback;   /* private window or bad data */
        }
    }

    function write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* ignore */ }
    }

    let list = read(LIST_KEY, []);
    if (!Array.isArray(list)) list = [];
    list = list.filter((entry) => entry && entry.id).map((entry) => ({ id: entry.id, qty: clamp(entry.qty) }));

    let dates = read(DATES_KEY, {});
    if (!dates || typeof dates !== "object") dates = {};

    const listeners = [];

    function clamp(qty) {
        const n = parseInt(qty, 10);
        return n > 0 ? Math.min(n, MAX_QTY) : 1;
    }

    function changed() {
        write(LIST_KEY, list);
        write(DATES_KEY, dates);
        updateNav();
        listeners.forEach((fn) => fn());
    }

    /* The "Basket (3)" link in the menu */
    function updateNav() {
        const count = totalQty();
        document.querySelectorAll("[data-basket-count]").forEach((el) => {
            el.textContent = count ? `(${count})` : "";
            const link = el.closest("a");
            if (link) link.classList.toggle("has-items", count > 0);
        });
    }

    function totalQty() {
        return list.reduce((sum, entry) => sum + entry.qty, 0);
    }

    /* Some saved items may since have been removed on the admin page */
    function keepOnly(items) {
        const before = list.length;
        list = list.filter((entry) => items.some((item) => item.id === entry.id));
        if (list.length !== before) changed();
    }

    async function loadItems() {
        try {
            const response = await fetch("images/equipment.json", { cache: "no-cache" });
            if (response.ok) {
                return ((await response.json()).items || []).filter((item) => item.id && item.name);
            }
        } catch (error) {
            /* no list yet */
        }
        return [];
    }

    document.addEventListener("DOMContentLoaded", updateNav);
    if (document.readyState !== "loading") updateNav();

    /* Keep other open tabs in step */
    window.addEventListener("storage", (event) => {
        if (event.key !== LIST_KEY && event.key !== DATES_KEY) return;
        list = read(LIST_KEY, []);
        dates = read(DATES_KEY, {});
        updateNav();
        listeners.forEach((fn) => fn());
    });

    return {
        MAX_QTY,
        clamp,
        loadItems,
        keepOnly,
        totalQty,
        entries: () => list.slice(),
        get: (id) => list.find((entry) => entry.id === id),
        set(id, qty) {
            const entry = list.find((e) => e.id === id);
            if (entry) entry.qty = clamp(qty);
            else list.push({ id, qty: clamp(qty) });
            changed();
        },
        remove(id) {
            list = list.filter((entry) => entry.id !== id);
            changed();
        },
        clear() {
            list = [];
            dates = {};
            changed();
        },
        dates: () => Object.assign({}, dates),
        setDates(from, to) {
            dates = { from: from || "", to: to || "" };
            changed();
        },
        onChange: (fn) => listeners.push(fn)
    };
})();


/* A small "−  2  +" quantity control. onChange gets the new number. */
function quantityStepper(value, onChange, label) {
    const wrap = document.createElement("div");
    wrap.className = "qty-stepper";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `One fewer ${label}`);

    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = String(Basket.MAX_QTY);
    input.inputMode = "numeric";
    input.value = value;
    input.setAttribute("aria-label", `How many ${label}`);

    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `One more ${label}`);

    function setValue(n) {
        const qty = Basket.clamp(n);
        input.value = qty;
        minus.disabled = qty <= 1;
        plus.disabled = qty >= Basket.MAX_QTY;
        onChange(qty);
    }

    minus.addEventListener("click", () => setValue(Basket.clamp(input.value) - 1));
    plus.addEventListener("click", () => setValue(Basket.clamp(input.value) + 1));
    input.addEventListener("change", () => setValue(input.value));
    input.addEventListener("blur", () => { input.value = Basket.clamp(input.value); });

    minus.disabled = value <= 1;
    plus.disabled = value >= Basket.MAX_QTY;

    wrap.append(minus, input, plus);
    wrap.input = input;
    return wrap;
}
