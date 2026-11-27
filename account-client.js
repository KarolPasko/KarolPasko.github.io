/* =========================
   ACCOUNTS (shared by account.html, the developer pages and the enquiry forms)
   Talks to the Google Apps Script web app whose address is "endpoint" in
   data/dev-projects.json (set on the admin page). The sign-in is a random
   session code kept in this browser's localStorage.
========================= */

const KLD = (function () {
    const SESSION_KEY = "kp-session";
    const ME_KEY = "kp-me";
    let endpointPromise = null;

    function read(key) {
        try { return localStorage.getItem(key) || ""; } catch (error) { return ""; }
    }

    function write(key, value) {
        try {
            if (value) localStorage.setItem(key, value);
            else localStorage.removeItem(key);
        } catch (error) { /* private window */ }
    }

    function config() {
        if (!endpointPromise) {
            endpointPromise = fetch(`data/dev-projects.json?t=${Date.now()}`, { cache: "no-store" })
                .then((response) => (response.ok ? response.json() : {}))
                .catch(() => ({}))
                .then((data) => ({ endpoint: data.endpoint || "", projects: (data.projects || []).filter((p) => p.id && p.name) }));
        }
        return endpointPromise;
    }

    async function call(action, data = {}) {
        const { endpoint } = await config();
        if (!endpoint) throw new Error("Accounts aren't switched on yet.");
        /* Sent as plain text so the browser doesn't need a CORS preflight */
        const response = await fetch(endpoint, {
            method: "POST",
            body: JSON.stringify({ action, session: read(SESSION_KEY), ...data })
        });
        const result = await response.json().catch(() => ({ ok: false, error: "The server didn't reply properly." }));
        if (!result.ok) {
            if (/sign in|signed out|no longer exists/i.test(result.error || "")) signOutLocally();
            throw new Error(result.error || "Something went wrong.");
        }
        if (result.session) write(SESSION_KEY, result.session);
        if (result.me) write(ME_KEY, JSON.stringify(result.me));
        return result;
    }

    function signOutLocally() {
        write(SESSION_KEY, "");
        write(ME_KEY, "");
    }

    /* The last details we saw, for filling in forms without waiting */
    function cachedMe() {
        if (!read(SESSION_KEY)) return null;
        try { return JSON.parse(read(ME_KEY) || "null"); } catch (error) { return null; }
    }

    async function signOut() {
        try { await call("logout"); } catch (error) { /* already gone */ }
        signOutLocally();
    }

    /* Keeps a copy of an enquiry under the person's account (or by email). Never throws. */
    async function recordEnquiry(entry) {
        try { await call("enquiry", entry); } catch (error) { /* the email copy already went */ }
    }

    /* Fills in name / email / phone on a form when someone is signed in */
    function prefill(form) {
        const me = cachedMe();
        if (!form || !me) return;
        [["name", me.name], ["email", me.email], ["phone", me.phone]].forEach(([field, value]) => {
            const input = form.elements[field];
            if (input && !input.value && value) input.value = value;
        });
    }

    return { config, call, signedIn: () => Boolean(read(SESSION_KEY)), cachedMe, signOut, signOutLocally, recordEnquiry, prefill };
})();
