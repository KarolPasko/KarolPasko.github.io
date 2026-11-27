/* =========================
   SIGN IN TO ENQUIRE
   Used by the enquiry forms (contact.js on the home and hire pages,
   checkout.js on basket.html). Before someone can send an enquiry they
   sign in or create an account right there. Once signed in, the form only
   asks about the job: their name, email and phone come from the account.

   Mark the contact fields in the form with data-contact. They're hidden
   and filled in from the account, so the code that sends the enquiry
   doesn't change.

   If accounts aren't running yet (no endpoint, or the Google script hasn't
   been updated), the form works the old way so enquiries never stop.
========================= */

const AccountGate = (function () {
    let readyPromise = null;

    /* Accounts need version 2 of the Google script */
    function accountsReady() {
        if (!readyPromise) {
            readyPromise = KLD.config().then(async ({ endpoint }) => {
                if (!endpoint) return false;
                try {
                    const reply = await fetch(`${endpoint}?action=ping`).then((response) => response.json());
                    return reply.ok && reply.version >= 2;
                } catch (error) {
                    return false;
                }
            });
        }
        return readyPromise;
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function field(label, name, type, autocomplete, extra = {}) {
        const wrap = el("label", "", label);
        const input = document.createElement("input");
        input.type = type;
        input.name = name;
        if (autocomplete) input.autocomplete = autocomplete;
        Object.assign(input, extra);
        wrap.appendChild(input);
        return wrap;
    }

    function attach(form) {
        if (!form || typeof KLD === "undefined") return;

        const contact = [...form.querySelectorAll("[data-contact]")];
        const gate = el("div", "account-gate");
        gate.hidden = true;
        form.parentNode.insertBefore(gate, form);

        /* Shown above the form once signed in */
        const who = el("p", "account-gate-who");
        who.hidden = true;
        form.insertBefore(who, form.firstChild);

        function setContact(me) {
            contact.forEach((node) => { node.hidden = true; });
            [["name", me.name], ["email", me.email], ["phone", me.phone || ""]].forEach(([name, value]) => {
                const input = form.elements[name];
                if (input) input.value = value;
            });
            who.innerHTML = "";
            const strong = el("strong", "", me.name);
            const out = el("button", "link-button", "Not you? Sign out");
            out.type = "button";
            out.addEventListener("click", async () => {
                await KLD.signOut();
                current = null;
                showGate();
            });
            who.append("Sending as ", strong, ` (${me.email}). `, out);
            who.hidden = false;
        }

        let current = null;

        /* The send code resets the form after sending; put the account details back */
        form.addEventListener("reset", () => {
            if (current) setTimeout(() => setContact(current));
        });

        function showForm(me) {
            current = me;
            setContact(me);
            gate.hidden = true;
            form.hidden = false;
            form.classList.add("in"); /* skip the scroll fade-in, it was waiting while hidden */
            form.dispatchEvent(new CustomEvent("account-ready", { detail: me }));
        }

        function showGate() {
            form.hidden = true;
            who.hidden = true;
            gate.hidden = false;
            renderGate("in");
        }

        function renderGate(mode) {
            gate.innerHTML = "";
            gate.appendChild(el("p", "account-gate-lead", mode === "in"
                ? "To send an enquiry, sign in. If you're new, it only takes a moment to make an account, and you can see everything you've sent me in one place."
                : "Make an account so I know who I'm talking to. You can see everything you've sent me on your account page."));

            const tabs = el("p", "account-switch");
            [["in", "Sign in"], ["up", "Create an account"]].forEach(([key, label]) => {
                const button = el("button", key === mode ? "is-current" : "", label);
                button.type = "button";
                button.addEventListener("click", () => renderGate(key));
                tabs.appendChild(button);
            });
            gate.appendChild(tabs);

            /* Same look as the enquiry form, without its scroll fade-in classes */
            const look = form.className.split(/\s+/).filter((name) => name && name !== "reveal" && name !== "in").join(" ");
            const auth = el("form", `${look} account-gate-form`);
            if (mode === "up") {
                auth.append(
                    field("Your name", "name", "text", "name", { required: true, maxLength: 80 }),
                    field("Email", "email", "email", "email", { required: true }),
                    field("Phone (optional)", "phone", "tel", "tel", { maxLength: 40 }),
                    field("Password (at least 8 characters)", "password", "password", "new-password", { required: true, minLength: 8 })
                );
            } else {
                auth.append(
                    field("Email", "email", "email", "email", { required: true }),
                    field("Password", "password", "password", "current-password", { required: true })
                );
            }

            const submit = el("button", "button", mode === "up" ? "Create account and carry on" : "Sign in and carry on");
            submit.type = "submit";
            const status = el("p", "form-status");
            status.setAttribute("role", "status");
            auth.append(submit, status);

            if (mode === "in") {
                const forgot = el("p", "account-small");
                const link = el("a", "", "Forgot your password?");
                link.href = "account.html";
                forgot.appendChild(link);
                auth.appendChild(forgot);
            }

            auth.addEventListener("submit", async (event) => {
                event.preventDefault();
                submit.disabled = true;
                status.className = "form-status";
                status.textContent = mode === "up" ? "Creating your account…" : "Signing in…";
                try {
                    const data = Object.fromEntries(new FormData(auth));
                    const result = await KLD.call(mode === "up" ? "signup" : "login", data);
                    showForm(result.me);
                } catch (error) {
                    status.className = "form-status error";
                    status.textContent = error.message;
                }
                submit.disabled = false;
            });

            gate.appendChild(auth);
        }

        /* Start: hide everything until we know whether accounts are on */
        form.hidden = true;
        accountsReady().then(async (ready) => {
            if (!ready) {
                form.hidden = false;
                return;
            }
            if (KLD.signedIn()) {
                const cached = KLD.cachedMe();
                if (cached) showForm(cached);
                try {
                    showForm((await KLD.call("me")).me);
                    return;
                } catch (error) {
                    /* signed out on the server */
                }
            }
            showGate();
        });
    }

    return { attach, accountsReady };
})();
