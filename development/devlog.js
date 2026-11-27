/* =========================
   DEVELOPMENT PAGES
   development/index.html lists the projects in data/dev-projects.json.
   development/log.html?project=<id> shows that project's log and the form.

   Log entries live in a Google Sheet behind a small Apps Script web app
   (scripts/devlog-apps-script.gs). Its address is "endpoint" in
   data/dev-projects.json, set from the admin page. Only entries Karol has
   accepted come back from it, and only developers he has added to a
   project can post (account-client.js handles signing in).
========================= */

(function () {
    const $ = (id) => document.getElementById(id);
    const VERSION_KEY = "kp-dev-version";

    function remember(key, value) {
        try { localStorage.setItem(key, value); } catch (error) { /* private window */ }
    }

    function recall(key) {
        try { return localStorage.getItem(key) || ""; } catch (error) { return ""; }
    }

    function formatDate(iso) {
        const date = new Date(iso);
        if (isNaN(date)) return "";
        return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    }

    /* ---- Project list ---- */

    function renderProjects(projects) {
        const list = $("devProjects");
        list.innerHTML = "";

        if (projects.length === 0) {
            list.innerHTML = '<p class="dev-empty">Nothing here yet.</p>';
            return;
        }

        projects.forEach((project) => {
            const link = document.createElement("a");
            link.className = "dev-project";
            link.href = `development/log.html?project=${encodeURIComponent(project.id)}`;

            const name = document.createElement("h2");
            name.textContent = project.name;
            link.appendChild(name);

            if (project.description) {
                const text = document.createElement("p");
                text.textContent = project.description;
                link.appendChild(text);
            }

            const more = document.createElement("span");
            more.className = "dev-project-link";
            more.textContent = "Open the developer log →";
            link.appendChild(more);

            list.appendChild(link);
        });
    }

    /* ---- One project's log ---- */

    let entries = [];

    function entryElement(entry) {
        const item = document.createElement("li");
        item.className = "dev-entry";

        const meta = document.createElement("p");
        meta.className = "dev-entry-meta";
        const version = document.createElement("strong");
        version.textContent = `Version ${entry.version}`;
        meta.append(version, ` · ${entry.developer}`);
        const date = formatDate(entry.date);
        if (date) meta.append(` · ${date}`);

        const text = document.createElement("p");
        text.className = "dev-entry-text";
        text.textContent = entry.feedback;

        item.append(meta, text);

        if (entry.reply) {
            const reply = document.createElement("div");
            reply.className = "dev-reply";
            const who = document.createElement("p");
            who.className = "dev-reply-who";
            who.textContent = "Karol replied";
            const words = document.createElement("p");
            words.textContent = entry.reply;
            reply.append(who, words);
            item.appendChild(reply);
        }

        return item;
    }

    /* Newest version first, comparing 1.10 after 1.9 */
    function compareVersions(a, b) {
        return b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" });
    }

    function renderLog() {
        const filter = $("devFilter").value;
        const shown = filter ? entries.filter((entry) => entry.version === filter) : entries;
        const list = $("devLog");
        list.innerHTML = "";
        shown.forEach((entry) => list.appendChild(entryElement(entry)));

        $("devLogStatus").hidden = shown.length > 0;
        $("devLogStatus").textContent = "Nothing on the log yet. Be the first to add something below.";
    }

    function renderFilter() {
        const versions = [...new Set(entries.map((entry) => entry.version))].sort(compareVersions);
        const select = $("devFilter");
        select.innerHTML = "";
        select.appendChild(new Option("All versions", ""));
        versions.forEach((version) => select.appendChild(new Option(version, version)));
        $("devFilterWrap").hidden = versions.length < 2;
    }

    async function loadEntries(endpoint, project) {
        const response = await fetch(`${endpoint}?action=list&project=${encodeURIComponent(project.id)}`);
        const data = await response.json();
        if (!data.ok) throw new Error(data.error || "The log didn't load.");
        entries = data.entries || [];
        renderFilter();
        renderLog();
    }

    function setFormStatus(text, kind = "") {
        $("devFormStatus").className = `form-status ${kind}`;
        $("devFormStatus").textContent = text;
    }

    /* Only developers Karol has added to this project can post */
    async function setupForm(project) {
        if (!KLD.signedIn()) return;

        let me;
        try {
            me = (await KLD.call("me")).me;
        } catch (error) {
            return;
        }

        const gate = $("devFormGate");
        const inProject = me.developer && (me.projects || []).some((item) => item.id === project.id);
        if (!me.developer || !inProject) {
            gate.textContent = "You're signed in, but you haven't been added to this project yet. Karol will add you if you're helping with it.";
            return;
        }
        if (!me.devUsername) {
            gate.innerHTML = 'Pick your developer username in the <a href="development/portal.html">developer portal</a> first.';
            return;
        }

        const form = $("devForm");
        gate.hidden = true;
        form.hidden = false;
        $("devPostingAs").textContent = me.devUsername;
        form.version.value = recall(VERSION_KEY);

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const button = form.querySelector("button");
            button.disabled = true;
            setFormStatus("Sending…");

            const version = form.version.value.trim();
            try {
                await KLD.call("submit", { project: project.id, version, feedback: form.feedback.value.trim() });
                remember(VERSION_KEY, version);
                form.feedback.value = "";
                setFormStatus("Thanks, that's been sent. It will show on the log once I've read it.", "success");
            }

            catch (error) {
                setFormStatus(`Sorry, that didn't send: ${error.message}`, "error");
            }

            finally {
                button.disabled = false;
            }
        });
    }

    async function startLog(config) {
        const id = new URLSearchParams(location.search).get("project") || "";
        const project = config.projects.find((item) => item.id === id);

        if (!project) {
            $("devTitle").textContent = "Project not found";
            $("devIntro").textContent = "That project isn't on the list.";
            $("devLogStatus").textContent = "";
            $("devFormSection").hidden = true;
            return;
        }

        document.title = `${project.name} developer log | Karol Pasko`;
        $("devTitle").textContent = `${project.name} developer log`;
        $("devIntro").textContent = project.description || "";

        if (!config.endpoint) {
            $("devLogStatus").textContent = "The log isn't switched on yet. Check back soon.";
            $("devFormSection").hidden = true;
            return;
        }

        if (project.open === false) $("devFormSection").hidden = true;
        else setupForm(project);

        $("devFilter").addEventListener("change", renderLog);

        try {
            await loadEntries(config.endpoint, project);
        } catch (error) {
            $("devLogStatus").textContent = "The log didn't load. Try refreshing the page.";
        }
    }

    async function start() {
        let config;
        try {
            config = await KLD.config();
        } catch (error) {
            const target = $("devProjects") || $("devLogStatus");
            target.textContent = error.message;
            return;
        }

        if ($("devProjects")) renderProjects(config.projects);
        if ($("devLog")) startLog(config);
    }

    start();
})();
