/* =========================
   BASKET AND CHECKOUT (basket.html)
   Three steps, switched with the address bar hash so the back button works:
     #basket   change quantities, pick the hire dates
     #details  contact details, then "Send enquiry"
     #sent     the receipt

   Sending: if a Formspree form ID is set in site-config.js (admin page),
   the enquiry goes through Formspree. Otherwise it goes through
   FormSubmit (formsubmit.co), which needs no account: the very first
   enquiry makes FormSubmit email SITE_CONFIG.contactEmail an "Activate
   form" link, and every enquiry after that is emailed straight there.
   If sending fails, the visitor can send it from their own email app.
========================= */

(async function () {
    const $ = (id) => document.getElementById(id);
    const LAST_KEY = "kp-hire-last";

    const steps = { basket: $("stepBasket"), details: $("stepDetails"), sent: $("stepSent") };
    const items = await Basket.loadItems();
    Basket.keepOnly(items);
    const byId = (id) => items.find((item) => item.id === id);

    /* ---- Dates ---- */
    const dateFrom = $("dateFrom");
    const dateTo = $("dateTo");
    const today = isoDate(new Date());

    function isoDate(date) {
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }

    function niceDate(iso) {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
            weekday: "short", day: "numeric", month: "short", year: "numeric"
        });
    }

    function dayCount(from, to) {
        const ms = new Date(to + "T12:00:00") - new Date(from + "T12:00:00");
        return Math.round(ms / 86400000) + 1;
    }

    function datesText(dates) {
        if (!dates.from) return "";
        const to = dates.to || dates.from;
        const days = dayCount(dates.from, to);
        return to === dates.from
            ? `${niceDate(dates.from)} (1 day)`
            : `${niceDate(dates.from)} to ${niceDate(to)} (${days} days)`;
    }

    dateFrom.min = today;
    dateTo.min = today;
    const saved = Basket.dates();
    if (saved.from && saved.from >= today) dateFrom.value = saved.from;
    if (saved.to && saved.to >= (dateFrom.value || today)) dateTo.value = saved.to;

    function saveDates() {
        if (dateFrom.value) dateTo.min = dateFrom.value;
        if (dateFrom.value && (!dateTo.value || dateTo.value < dateFrom.value)) dateTo.value = dateFrom.value;
        Basket.setDates(dateFrom.value, dateTo.value);
    }
    dateFrom.addEventListener("change", saveDates);
    dateTo.addEventListener("change", saveDates);

    /* ---- Step 1: basket ---- */
    function renderBasket() {
        const list = $("basketItems");
        const entries = Basket.entries();
        list.innerHTML = "";

        entries.forEach((entry) => {
            const item = byId(entry.id);
            if (!item) return;
            const row = document.createElement("li");
            row.className = "basket-item";

            if (item.photo) {
                const img = document.createElement("img");
                img.src = item.photo;
                img.alt = "";
                row.appendChild(img);
            } else {
                row.appendChild(document.createElement("span"));
            }

            const name = document.createElement("div");
            name.className = "basket-item-name";
            const title = document.createElement("h3");
            title.textContent = item.name;
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "basket-remove";
            remove.textContent = "Remove";
            remove.setAttribute("aria-label", `Remove ${item.name}`);
            remove.addEventListener("click", () => Basket.remove(entry.id));
            name.append(title, remove);

            const stepper = quantityStepper(entry.qty, (qty) => Basket.set(entry.id, qty), item.name);

            row.append(name, stepper);
            list.appendChild(row);
        });

        const empty = entries.length === 0;
        list.hidden = empty;
        $("basketEmpty").hidden = !empty;
        $("basketSummary").hidden = empty;

        renderTotal();
    }

    function renderTotal() {
        const total = Basket.totalQty();
        $("basketTotal").textContent = `${total} ${total === 1 ? "item" : "items"} on your enquiry`;
    }

    $("datesForm").addEventListener("submit", (event) => {
        event.preventDefault();
        saveDates();
        location.hash = "details";
    });

    /* ---- Step 2: details ---- */
    function renderSummary(listEl, datesEl, entries, dates) {
        listEl.innerHTML = "";
        entries.forEach((entry) => {
            const li = document.createElement("li");
            const qty = document.createElement("span");
            qty.className = "summary-qty";
            qty.textContent = `${entry.qty} ×`;
            const name = document.createElement("span");
            name.textContent = entry.name || (byId(entry.id) || {}).name || "";
            li.append(qty, name);
            listEl.appendChild(li);
        });
        datesEl.textContent = datesText(dates);
    }

    function equipmentText(entries) {
        return entries.map((entry) => `${entry.qty} x ${entry.name}`).join("\n");
    }

    function reference() {
        const d = new Date();
        const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
        const random = Math.random().toString(36).slice(2, 6).toUpperCase();
        return `KLD-${stamp}-${random}`;
    }

    const form = $("checkoutForm");
    const status = $("checkoutStatus");
    const sendButton = $("sendButton");

    async function send(order) {
        const fields = {
            "Reference": order.ref,
            "Name": order.name,
            "Email": order.email,
            "Phone": order.phone || "-",
            "Organisation": order.organisation || "-",
            "Venue": order.venue,
            "Hire dates": datesText(order.dates),
            "How they want it": order.service,
            "Equipment": equipmentText(order.entries),
            "Message": order.message || "-"
        };
        const subject = `Hire enquiry ${order.ref} from ${order.name}`;

        if (SITE_CONFIG.formspreeForm) {
            const data = new FormData();
            Object.entries(fields).forEach(([key, value]) => data.append(key, value));
            data.append("email", order.email);
            data.append("_subject", subject);
            const response = await fetch(`https://formspree.io/f/${SITE_CONFIG.formspreeForm}`, {
                method: "POST", body: data, headers: { Accept: "application/json" }
            });
            if (!response.ok) throw new Error(`Formspree returned ${response.status}`);
            return;
        }

        const response = await fetch(`https://formsubmit.co/ajax/${SITE_CONFIG.contactEmail}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(Object.assign({}, fields, {
                _subject: subject,
                _replyto: order.email,
                _template: "table",
                _captcha: "false"
            }))
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || String(result.success) !== "true") {
            throw new Error(result.message || `FormSubmit returned ${response.status}`);
        }
    }

    function mailtoLink(order) {
        const body = [
            `Reference: ${order.ref}`,
            `Name: ${order.name}`,
            `Email: ${order.email}`,
            `Phone: ${order.phone || "-"}`,
            `Organisation: ${order.organisation || "-"}`,
            `Venue: ${order.venue}`,
            `Hire dates: ${datesText(order.dates)}`,
            `How I want it: ${order.service}`,
            "",
            "Equipment:",
            equipmentText(order.entries),
            "",
            order.message || ""
        ].join("\n");
        return `mailto:${SITE_CONFIG.contactEmail}?subject=${encodeURIComponent(`Hire enquiry ${order.ref} from ${order.name}`)}&body=${encodeURIComponent(body)}`;
    }

    function currentOrder() {
        const data = new FormData(form);
        return {
            ref: reference(),
            name: data.get("name").trim(),
            email: data.get("email").trim(),
            phone: data.get("phone").trim(),
            organisation: data.get("organisation").trim(),
            venue: data.get("venue").trim(),
            service: data.get("service"),
            message: data.get("message").trim(),
            dates: Basket.dates(),
            entries: Basket.entries().map((entry) => ({ qty: entry.qty, name: byId(entry.id).name }))
        };
    }

    /* "Or send it from your email app": same enquiry, opened as an email */
    $("mailtoAlt").addEventListener("click", (event) => {
        if (!form.reportValidity()) {
            event.preventDefault();
            return;
        }
        event.currentTarget.href = mailtoLink(currentOrder());
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        status.className = "form-status";
        status.textContent = "";

        if (!form.reportValidity()) return;
        if (form.elements._honey.value) return;   /* a bot filled the hidden field */

        const order = currentOrder();

        sendButton.disabled = true;
        status.textContent = "Sending…";

        try {
            await send(order);
            try { sessionStorage.setItem(LAST_KEY, JSON.stringify(order)); } catch (error) { /* ignore */ }
            Basket.clear();
            form.reset();
            status.textContent = "";
            location.hash = "sent";
        } catch (error) {
            console.error("Could not send enquiry:", error);
            status.className = "form-status error";
            status.innerHTML = "Sorry, that didn't send. ";
            const link = document.createElement("a");
            link.href = mailtoLink(order);
            link.textContent = "Send it from your email app instead";
            status.appendChild(link);
            status.append(` or email me at ${SITE_CONFIG.contactEmail}.`);
        }
        sendButton.disabled = false;
    });

    /* ---- Step 3: sent ---- */
    function renderSent() {
        let order = null;
        try { order = JSON.parse(sessionStorage.getItem(LAST_KEY) || "null"); } catch (error) { /* ignore */ }
        if (!order) return false;
        $("sentLead").textContent =
            `Thanks ${order.name.split(" ")[0]}. I've got your hire enquiry and I'll email you at ${order.email} with availability and a quote, usually within a day or two.`;
        $("sentRef").textContent = `Reference ${order.ref}`;
        renderSummary($("sentItems"), $("sentDates"), order.entries, order.dates);
        return true;
    }

    /* ---- Switching steps ---- */
    function readyForDetails() {
        return Basket.entries().length > 0 && Boolean(Basket.dates().from);
    }

    function show() {
        let step = location.hash.replace("#", "") || "basket";
        if (!steps[step]) step = "basket";
        if (step === "details" && !readyForDetails()) step = "basket";
        if (step === "sent" && !renderSent()) step = "basket";

        if (step === "basket") renderBasket();
        if (step === "details") {
            const entries = Basket.entries().map((entry) => ({ qty: entry.qty, name: byId(entry.id).name }));
            renderSummary($("summaryItems"), $("summaryDates"), entries, Basket.dates());
        }

        Object.entries(steps).forEach(([name, el]) => { el.hidden = name !== step; });
        document.querySelectorAll(".checkout-steps li").forEach((li) => {
            const order = ["basket", "details", "sent"];
            li.classList.toggle("is-current", li.dataset.step === step);
            li.classList.toggle("is-done", order.indexOf(li.dataset.step) < order.indexOf(step));
            if (li.dataset.step === step) li.setAttribute("aria-current", "step");
            else li.removeAttribute("aria-current");
        });
        if (location.hash.replace("#", "") !== step && location.hash) history.replaceState(null, "", `#${step}`);
        window.scrollTo(0, 0);
    }

    Basket.onChange(() => {
        const step = location.hash.replace("#", "") || "basket";
        if (step !== "basket") return;
        /* Only rebuild when a line is added or removed, so the + and - buttons keep focus */
        if ($("basketItems").children.length !== Basket.entries().length) renderBasket();
        else renderTotal();
    });
    window.addEventListener("hashchange", show);
    show();
})();
