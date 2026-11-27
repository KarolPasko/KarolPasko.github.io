/* =========================
   DEVELOPER PORTAL (development/portal.html)
   For accounts Karol has made developers on the admin page.
   First visit: pick a developer username (shown on the logs).
   Then: each project you're in, its tasks (update your progress), and a
   form to post to its log. Everything posted waits for Karol's approval.
========================= */

(async function () {
    const $ = (id) => document.getElementById(id);
    const VERSION_KEY = "kp-dev-version";
    let data = null;

    function formatDate(iso) {
        const date = new Date(iso);
        return isNaN(date) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function setStatus(text) {
        $("portalStatus").hidden = !text;
        $("portalStatus").innerHTML = text;
    }

    /* ---- Tasks ---- */

    function taskItem(task) {
        const item = el("li", "portal-task");
        const head = el("div", "portal-task-head");
        const title = el("strong", "", task.title);
        head.appendChild(title);

        const select = document.createElement("select");
        select.setAttribute("aria-label", `Progress on ${task.title}`);
        data.statuses.forEach((status) => select.appendChild(new Option(status, status)));
        select.value = task.status;
        select.dataset.status = task.status;
        select.addEventListener("change", async () => {
            select.disabled = true;
            try {
                await KLD.call("taskStatus", { id: task.id, status: select.value });
                task.status = select.value;
                select.dataset.status = task.status;
            } catch (error) {
                select.value = task.status;
                alertLine(item, error.message);
            }
            select.disabled = false;
        });
        head.appendChild(select);
        item.appendChild(head);

        if (task.forYou) item.appendChild(el("p", "portal-task-for", "Set for you"));
        if (task.details) item.appendChild(el("p", "dev-entry-text", task.details));
        return item;
    }

    function alertLine(parent, message) {
        const line = el("p", "form-status error", message);
        parent.appendChild(line);
        setTimeout(() => line.remove(), 5000);
    }

    /* ---- Posting to a log ---- */

    function postForm(project) {
        const form = el("form", "account-form portal-post");
        form.innerHTML = `
            <label>Version
                <input type="text" name="version" maxlength="30" placeholder="e.g. 0.3.1" required>
            </label>
            <label>Feedback
                <textarea name="feedback" rows="5" maxlength="4000" placeholder="What happened, what you expected, and how to make it happen again" required></textarea>
            </label>
            <button type="submit" class="button">Send for approval</button>
            <p class="form-status" role="status"></p>`;
        try { form.version.value = localStorage.getItem(VERSION_KEY) || ""; } catch (error) { /* ignore */ }

        const status = form.querySelector(".form-status");
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const button = form.querySelector("button");
            button.disabled = true;
            status.className = "form-status";
            status.textContent = "Sending…";
            const version = form.version.value.trim();
            try {
                await KLD.call("submit", { project: project.id, version, feedback: form.feedback.value.trim() });
                try { localStorage.setItem(VERSION_KEY, version); } catch (error) { /* ignore */ }
                form.feedback.value = "";
                status.className = "form-status success";
                status.textContent = "Sent. It goes on the log once Karol has read it.";
                refreshEntries();
            } catch (error) {
                status.className = "form-status error";
                status.textContent = `Sorry, that didn't send: ${error.message}`;
            }
            button.disabled = false;
        });
        return form;
    }

    /* ---- Page ---- */

    function renderProjects(config) {
        const box = $("portalProjects");
        box.innerHTML = "";

        if (data.me.projects.length === 0) {
            box.appendChild(el("p", "dev-empty", "You haven't been added to any projects yet. Karol will add you."));
            return;
        }

        data.me.projects.forEach((project) => {
            const info = config.projects.find((item) => item.id === project.id) || project;
            const card = el("article", "portal-project");
            card.appendChild(el("h2", "", info.name));
            if (info.description) card.appendChild(el("p", "dev-empty", info.description));

            const link = el("a", "dev-project-link", "Read the public log →");
            link.href = `development/log.html?project=${encodeURIComponent(project.id)}`;
            card.appendChild(link);

            card.appendChild(el("h3", "", "Tasks"));
            const tasks = data.tasks.filter((task) => task.project === project.id);
            if (tasks.length) {
                const list = el("ol", "portal-tasks");
                tasks.forEach((task) => list.appendChild(taskItem(task)));
                card.appendChild(list);
            } else {
                card.appendChild(el("p", "dev-empty", "No tasks at the moment."));
            }

            card.appendChild(el("h3", "", "Post to the log"));
            if (info.open === false) card.appendChild(el("p", "dev-empty", "This log isn't taking new entries right now."));
            else card.appendChild(postForm(project));

            box.appendChild(card);
        });
    }

    function renderEntries() {
        const list = $("portalEntries");
        list.innerHTML = "";
        const names = Object.fromEntries(data.me.projects.map((project) => [project.id, project.name]));
        const labels = { pending: "Waiting for Karol", accepted: "On the log", rejected: "Not posted" };

        data.entries.forEach((entry) => {
            const item = el("li", "dev-entry");
            const meta = el("p", "dev-entry-meta");
            meta.append(el("strong", "", `${names[entry.project] || entry.project}, version ${entry.version}`));
            meta.append(` · ${formatDate(entry.date)} · `);
            meta.append(el("span", `portal-state is-${entry.status}`, labels[entry.status] || entry.status));
            item.append(meta, el("p", "dev-entry-text", entry.feedback));
            if (entry.reply) {
                const reply = el("div", "dev-reply");
                reply.append(el("p", "dev-reply-who", "Karol replied"), el("p", "", entry.reply));
                item.appendChild(reply);
            }
            list.appendChild(item);
        });
        $("portalEntriesEmpty").hidden = data.entries.length > 0;
    }

    async function refreshEntries() {
        try {
            data.entries = (await KLD.call("portal")).entries;
            renderEntries();
        } catch (error) { /* keep what's shown */ }
    }

    async function load() {
        const config = await KLD.config();
        if (!config.endpoint) {
            setStatus("The developer portal isn't switched on yet.");
            return;
        }
        if (!KLD.signedIn()) {
            setStatus('Sign in to use the developer portal. <a href="account.html?next=development/portal.html">Sign in or create an account</a>');
            return;
        }

        try {
            data = await KLD.call("portal");
        } catch (error) {
            if (!KLD.signedIn()) {
                setStatus('Sign in to use the developer portal. <a href="account.html?next=development/portal.html">Sign in</a>');
            } else {
                $("portalStatus").textContent = error.message;
                $("portalStatus").hidden = false;
            }
            return;
        }

        setStatus("");
        if (!data.me.devUsername) {
            $("usernameForm").hidden = false;
            $("portalTitle").textContent = `Welcome, ${data.me.name.split(" ")[0]}`;
            $("portalLead").textContent = "Before you start, pick the name you'll go by on the developer logs.";
            return;
        }

        $("usernameForm").hidden = true;
        $("portalMain").hidden = false;
        $("portalUser").textContent = data.me.devUsername;
        renderProjects(config);
        renderEntries();
    }

    $("usernameForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        const button = form.querySelector("button");
        button.disabled = true;
        $("usernameStatus").className = "form-status";
        $("usernameStatus").textContent = "Saving…";
        try {
            await KLD.call("setUsername", { username: form.username.value });
            $("portalTitle").textContent = "Developer portal";
            $("portalLead").textContent = "Your projects, your tasks, and where you post to the logs.";
            await load();
        } catch (error) {
            $("usernameStatus").className = "form-status error";
            $("usernameStatus").textContent = error.message;
        }
        button.disabled = false;
    });

    load();
})();
