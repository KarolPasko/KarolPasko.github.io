/* =========================
   VISITOR COUNTER
========================= */

/*
    Counts visits with abacus.jasoncameron.dev, a free counter service
    that needs no account. The admin page reads the same counters.

    visits            = every visit (one per browser tab session)
    day-YYYY-MM-DD    = visits on that day (UK time)
    page-<name>       = every time that page is opened

    Visits from a browser that has opened the admin page are not counted.
*/

const COUNTER = {
    api: "https://abacus.jasoncameron.dev",
    namespace: "karolpasko-github-io",
    ignoreKey: "kp-dont-count",
    sessionKey: "kp-counted"
};

function counterDay(date) {
    /* en-CA formats as YYYY-MM-DD */
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(date);
}

function counterPage() {
    const file = location.pathname.split("/").pop().replace(/\.html$/, "");
    return file || "index";
}

(function countVisit() {
    if (!location.hostname.endsWith("github.io")) return;
    if (counterPage() === "admin") return;

    try {
        if (localStorage.getItem(COUNTER.ignoreKey) === "1") return;
    } catch (error) { /* storage blocked: count anyway */ }

    const hit = (key) =>
        fetch(`${COUNTER.api}/hit/${COUNTER.namespace}/${key}`, { keepalive: true })
            .catch(() => {});

    hit(`page-${counterPage()}`);

    let counted = false;
    try {
        counted = sessionStorage.getItem(COUNTER.sessionKey);
        sessionStorage.setItem(COUNTER.sessionKey, "1");
    } catch (error) { /* storage blocked */ }

    if (!counted) {
        hit("visits");
        hit(`day-${counterDay(new Date())}`);
    }
})();
