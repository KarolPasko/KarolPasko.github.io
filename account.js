/* =========================
   ACCOUNT PAGE (account.html)
   Sign in, create an account, reset a password, and once signed in:
   your details and the enquiries you've sent while signed in.
   account.html?next=<page> goes back to that page after signing in.
   account.html#reset=<code> comes from the password reset email.
========================= */

(async function () {
    const forms = ["signInForm", "signUpForm", "forgotForm", "resetForm"];

    function status(id, text, kind = "") {
        $(id).className = `form-status ${kind}`;
        $(id).textContent = text;
    }

    function showForm(id) {
        forms.forEach((name) => { $(name).hidden = name !== id; });
        document.querySelectorAll(".account-switch button").forEach((button) => {
            button.classList.toggle("is-current", button.dataset.show === id);
        });
        status("authStatus", "");
    }

    function $(id) {
        return id.startsWith(".") ? document.querySelector(id) : document.getElementById(id);
    }

    /* Only go back to pages on this site */
    function nextPage() {
        const next = new URLSearchParams(location.search).get("next") || "";
        return /^[\w\-/]+\.html$/.test(next) ? next : "";
    }

    function formatDate(iso) {
        const date = new Date(iso);
        return isNaN(date) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    }

    async function busy(form, work) {
        const button = form.querySelector("button[type=submit]");
        button.disabled = true;
        try {
            await work();
        } finally {
            button.disabled = false;
        }
    }

    /* ---- Signed in ---- */

    function renderSignedIn(me, enquiries) {
        $("signedOut").hidden = true;
        $("signedIn").hidden = false;
        $("accountTitle").textContent = `Hi ${me.name.split(" ")[0]}`;
        $("accountLead").textContent = "Your details and the enquiries you've sent me.";

        const form = $("detailsForm");
        form.name.value = me.name || "";
        form.email.value = me.email || "";
        form.phone.value = me.phone || "";
        $("portalLink").hidden = !me.developer;

        const list = $("enquiryList");
        list.innerHTML = "";
        enquiries.forEach((enquiry) => {
            const item = document.createElement("li");
            item.className = "dev-entry";
            const meta = document.createElement("p");
            meta.className = "dev-entry-meta";
            const kind = document.createElement("strong");
            kind.textContent = enquiry.kind;
            meta.append(kind, ` · ${formatDate(enquiry.created)}`);
            const text = document.createElement("p");
            text.className = "dev-entry-text";
            text.textContent = enquiry.details;
            item.append(meta, text);
            list.appendChild(item);
        });
        $("enquiryEmpty").hidden = enquiries.length > 0;
    }

    async function loadMe() {
        const result = await KLD.call("me");
        renderSignedIn(result.me, result.enquiries || []);
    }

    async function afterSignIn() {
        const next = nextPage();
        if (next) {
            location.href = next;
            return;
        }
        history.replaceState(null, "", location.pathname);
        await loadMe();
    }

    function renderSignedOut() {
        $("signedIn").hidden = true;
        $("signedOut").hidden = false;
        $("accountTitle").textContent = "Your account";
    }

    /* ---- Forms ---- */

    document.querySelectorAll("[data-show]").forEach((button) => {
        button.addEventListener("click", () => showForm(button.dataset.show));
    });

    $("signInForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.target;
        busy(form, async () => {
            status("authStatus", "Signing in…");
            try {
                await KLD.call("login", { email: form.email.value, password: form.password.value });
                status("authStatus", "");
                await afterSignIn();
            } catch (error) {
                status("authStatus", error.message, "error");
            }
        });
    });

    $("signUpForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.target;
        busy(form, async () => {
            status("authStatus", "Creating your account…");
            try {
                await KLD.call("signup", {
                    name: form.name.value, email: form.email.value, phone: form.phone.value,
                    password: form.password.value, website: form.website.value
                });
                status("authStatus", "");
                await afterSignIn();
            } catch (error) {
                status("authStatus", error.message, "error");
            }
        });
    });

    $("forgotForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.target;
        busy(form, async () => {
            status("authStatus", "Sending…");
            try {
                await KLD.call("forgot", { email: form.email.value });
                status("authStatus", "If there's an account with that email, a link is on its way. Check your spam folder too.", "success");
            } catch (error) {
                status("authStatus", error.message, "error");
            }
        });
    });

    $("resetForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.target;
        const code = (location.hash.match(/reset=([\w-]+)/) || [])[1] || "";
        busy(form, async () => {
            status("authStatus", "Saving…");
            try {
                await KLD.call("reset", { code, password: form.password.value });
                status("authStatus", "");
                await afterSignIn();
            } catch (error) {
                status("authStatus", error.message, "error");
            }
        });
    });

    $("detailsForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.target;
        busy(form, async () => {
            status("detailsStatus", "Saving…");
            try {
                const result = await KLD.call("updateMe", { name: form.name.value, phone: form.phone.value });
                $("accountTitle").textContent = `Hi ${result.me.name.split(" ")[0]}`;
                status("detailsStatus", "Saved.", "success");
            } catch (error) {
                status("detailsStatus", error.message, "error");
            }
        });
    });

    $("passwordForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.target;
        busy(form, async () => {
            status("detailsStatus", "Saving…");
            try {
                await KLD.call("updateMe", { password: form.password.value, newPassword: form.newPassword.value });
                form.reset();
                status("detailsStatus", "Password changed.", "success");
            } catch (error) {
                status("detailsStatus", error.message, "error");
            }
        });
    });

    $("signOutButton").addEventListener("click", async () => {
        await KLD.signOut();
        renderSignedOut();
        showForm("signInForm");
    });

    /* ---- Start ---- */

    window.addEventListener("hashchange", () => {
        if (/reset=/.test(location.hash)) location.reload();
    });

    const { endpoint } = await KLD.config();
    if (!endpoint) {
        $("accountOff").hidden = false;
        return;
    }

    if (/reset=/.test(location.hash)) {
        KLD.signOutLocally();
        renderSignedOut();
        $(".account-switch").hidden = true;
        $("accountTitle").textContent = "Choose a new password";
        showForm("resetForm");
        return;
    }

    if (nextPage()) $("accountLead").textContent = "Sign in to carry on. If you're new, create an account and Karol will add you.";

    if (KLD.signedIn()) {
        try {
            await afterSignIn();
            return;
        } catch (error) {
            /* signed out on the server: fall through to the sign-in form */
        }
    }
    renderSignedOut();
})();
