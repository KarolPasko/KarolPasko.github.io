/*
    KLD website server: accounts, enquiries, the developer portal and the
    developer logs.

    It runs as a Google Apps Script web app under your Google account and
    keeps everything in a Google Sheet called "KLD developer log", one tab
    each for Accounts, Sessions, Resets, Enquiries, Tasks and Entries.

    - Visitors can create an account (account.html). Enquiries they send
      while signed in are saved under their account.
    - You choose on the admin page who is a developer and which projects
      they're in. On their first visit to the developer portal they pick a
      developer username. You see both their real name and that username.
    - Developers post log entries from the portal or the log page. Each one
      is saved as "pending" and you get an email with Accept and Reject
      buttons. Only accepted entries are shown on the website.
    - You set tasks per project on the admin page; developers see them in
      the portal and mark their progress.
    - The admin page proves it's you with the same GitHub token it already
      uses, which this script checks with GitHub.

    Passwords are stored only as salted hashes. No GitHub token or password
    is stored here.

    After pasting a new version: Deploy -> Manage deployments -> edit (pencil)
    -> Version: New version -> Deploy. The web app URL stays the same.
*/

const NOTIFY_EMAIL = "karolek01122@gmail.com";
const SITE = "https://karolpasko.github.io";
const REPO = "KarolPasko/KarolPasko.github.io";

const TABLES = {
    Entries: ["id", "project", "version", "developer", "feedback", "status", "submitted", "decided", "reply", "account"],
    Accounts: ["id", "email", "name", "phone", "hash", "salt", "created", "lastLogin", "developer", "devUsername", "projects"],
    Sessions: ["token", "account", "expires"],
    Resets: ["token", "account", "expires"],
    Enquiries: ["id", "account", "email", "name", "kind", "details", "created"],
    Tasks: ["id", "project", "title", "details", "assignee", "status", "created", "updated"]
};

const LIMITS = { version: 30, feedback: 4000, reply: 2000, name: 80, email: 120, phone: 40, username: 30, details: 6000, title: 150 };
const MAX_PER_10_MIN = 30;        // log entries, stops a flood of emails
const MAX_SIGNUPS_PER_HOUR = 40;
const MAX_ENQUIRIES_PER_10_MIN = 40;
const MAX_PENDING = 300;
const SESSION_DAYS = 60;
const HASH_ROUNDS = 400;
const TASK_STATUSES = ["To do", "In progress", "Done"];


/* =========================
   ONE-TIME SETUP
   Run this once from the editor (pick "setup" and press Run).
========================= */

function setup() {
    const props = PropertiesService.getScriptProperties();

    if (!props.getProperty("SECRET")) {
        props.setProperty("SECRET", Utilities.getUuid() + Utilities.getUuid());
    }

    if (!props.getProperty("SHEET_ID")) {
        const book = SpreadsheetApp.create("KLD developer log");
        book.getSheets()[0].setName("Entries");
        props.setProperty("SHEET_ID", book.getId());
    }

    Object.keys(TABLES).forEach(table);

    /* Asks for permission to send email now rather than on the first entry */
    MailApp.getRemainingDailyQuota();

    Logger.log("Ready. Everything is kept in https://docs.google.com/spreadsheets/d/" + props.getProperty("SHEET_ID"));
}


/* =========================
   WEB APP
========================= */

function doGet(e) {
    const p = e.parameter || {};

    try {
        if (p.action === "review") return reviewFromEmail(p);
        if (p.action === "list") return json({ ok: true, entries: publicEntries(p.project) });
        if (p.action === "ping") return json({ ok: true, version: 2 });
        return json({ ok: false, error: "Unknown action" });
    } catch (error) {
        return json({ ok: false, error: error.message });
    }
}

const ACTIONS = {
    signup, login, logout, me, updateMe, forgot, reset,
    setUsername, portal, taskStatus, submit, enquiry, admin
};

function doPost(e) {
    try {
        const body = JSON.parse((e.postData && e.postData.contents) || "{}");
        const action = ACTIONS[body.action];
        if (!action || !Object.prototype.hasOwnProperty.call(ACTIONS, body.action)) throw new Error("Unknown action");
        return json(action(body));
    } catch (error) {
        return json({ ok: false, error: error.message });
    }
}

function json(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}


/* =========================
   SHEET TABLES
========================= */

function book() {
    const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
    if (!id) throw new Error("The server isn't set up yet. Run setup in Apps Script.");
    return SpreadsheetApp.openById(id);
}

/* Makes the tab if it's missing and adds any new columns to its header */
function table(name) {
    const headers = TABLES[name];
    const spreadsheet = book();
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);

    const values = sheet.getDataRange().getValues();
    const current = values.length && values[0].some((v) => v !== "") ? values[0].map(String) : [];
    headers.forEach((header) => {
        if (current.indexOf(header) === -1) {
            current.push(header);
            sheet.getRange(1, current.length).setValue(header);
        }
    });
    return { sheet, columns: current };
}

function rows(name) {
    const { sheet, columns } = table(name);
    const values = sheet.getDataRange().getValues();
    values.shift();
    return values.map((row, i) => {
        const item = { _row: i + 2 };
        columns.forEach((key, c) => {
            let value = row[c];
            if (value instanceof Date) value = value.toISOString();
            item[key] = value === undefined || value === null ? "" : value;
        });
        TABLES[name].forEach((key) => {
            if (typeof item[key] === "number") item[key] = String(item[key]);
        });
        return item;
    });
}

/* Every text value is stored with a leading ' so Sheets keeps it as typed (no formulas, dates or numbers) */
function stored(value) {
    if (typeof value === "string") return value === "" ? "" : "'" + value;
    return value;
}

function insert(name, item) {
    const { sheet, columns } = table(name);
    sheet.appendRow(columns.map((key) => stored(item[key] === undefined ? "" : item[key])));
}

function update(name, item, changes) {
    const { sheet, columns } = table(name);
    Object.keys(changes).forEach((key) => {
        const c = columns.indexOf(key);
        if (c === -1) return;
        sheet.getRange(item._row, c + 1).setValue(stored(changes[key]));
        item[key] = changes[key];
    });
}

function removeRow(name, item) {
    table(name).sheet.deleteRow(item._row);
}

function newId(prefix) {
    return prefix + Utilities.getUuid().replace(/-/g, "").slice(0, 14);
}

function now() {
    return new Date().toISOString();
}

function withLock(work) {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
        return work();
    } finally {
        lock.releaseLock();
    }
}

function clean(value, max) {
    return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

function bump(key, seconds, max, message) {
    const cache = CacheService.getScriptCache();
    const count = Number(cache.get(key) || 0);
    if (count >= max) throw new Error(message);
    cache.put(key, String(count + 1), seconds);
}


/* =========================
   PROJECTS (read from the website)
========================= */

function projects() {
    const cache = CacheService.getScriptCache();
    const cached = cache.get("projects");
    if (cached) return JSON.parse(cached);

    const response = UrlFetchApp.fetch(SITE + "/data/dev-projects.json?t=" + Date.now(), { muteHttpExceptions: true });
    const list = response.getResponseCode() === 200 ? (JSON.parse(response.getContentText()).projects || []) : [];
    cache.put("projects", JSON.stringify(list), 300);
    return list;
}

function projectName(id) {
    const project = projects().find((item) => item.id === id);
    return project ? project.name : id;
}


/* =========================
   ACCOUNTS AND SIGNING IN
========================= */

function hashPassword(password, salt) {
    let hash = password;
    for (let i = 0; i < HASH_ROUNDS; i++) {
        hash = Utilities.base64Encode(Utilities.computeHmacSha256Signature(hash + password, salt));
    }
    return hash;
}

function digest(text) {
    return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text));
}

function normalEmail(email) {
    return clean(email, LIMITS.email).toLowerCase();
}

function accountList(account) {
    return String(account.projects || "").split(",").map((id) => id.trim()).filter(Boolean);
}

function isDeveloper(account) {
    return account.developer === true || account.developer === "TRUE" || account.developer === "true";
}

/* What a signed-in person gets to see about themselves */
function publicMe(account) {
    const me = { id: account.id, name: account.name, email: account.email, phone: account.phone, developer: isDeveloper(account) };
    if (me.developer) {
        me.devUsername = account.devUsername || "";
        me.projects = accountList(account)
            .map((id) => projects().find((project) => project.id === id))
            .filter(Boolean)
            .map((project) => ({ id: project.id, name: project.name }));
    }
    return me;
}

function startSession(account) {
    const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    insert("Sessions", { token: digest(token), account: account.id, expires });
    update("Accounts", account, { lastLogin: now() });
    return token;
}

/* Finds the account for a session, or throws */
function signedIn(body) {
    if (!body.session) throw new Error("Please sign in.");
    const key = "sess-" + digest(String(body.session));
    const cache = CacheService.getScriptCache();
    let accountId = cache.get(key);

    if (!accountId) {
        const session = rows("Sessions").find((item) => item.token === key.slice(5));
        if (!session || session.expires < now()) throw new Error("You've been signed out. Please sign in again.");
        accountId = session.account;
        cache.put(key, accountId, 3600);
    }

    const account = rows("Accounts").find((item) => item.id === accountId);
    if (!account) throw new Error("That account no longer exists.");
    return account;
}

function checkPassword(password) {
    if (String(password || "").length < 8) throw new Error("Use a password with at least 8 characters.");
}

function signup(body) {
    if (body.website) throw new Error("Please try again.");
    const name = clean(body.name, LIMITS.name);
    const email = normalEmail(body.email);
    const phone = clean(body.phone, LIMITS.phone);
    if (!name) throw new Error("Please add your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please check your email address.");
    checkPassword(body.password);

    return withLock(() => {
        bump("signups", 3600, MAX_SIGNUPS_PER_HOUR, "Lots of accounts have been made just now. Please try again later.");
        if (rows("Accounts").some((item) => item.email === email)) {
            throw new Error("There's already an account with that email. Try signing in, or reset your password.");
        }

        const salt = Utilities.getUuid();
        const account = {
            id: newId("a"), email, name, phone, salt,
            hash: hashPassword(String(body.password), salt),
            created: now(), lastLogin: "", developer: false, devUsername: "", projects: ""
        };
        insert("Accounts", account);
        const saved = rows("Accounts").find((item) => item.id === account.id);
        return { ok: true, session: startSession(saved), me: publicMe(saved) };
    });
}

function login(body) {
    const email = normalEmail(body.email);
    bump("login-" + email, 900, 8, "Too many tries. Wait 15 minutes, or reset your password.");

    const account = rows("Accounts").find((item) => item.email === email);
    if (!account || hashPassword(String(body.password || ""), account.salt) !== account.hash) {
        throw new Error("That email and password don't match.");
    }
    return { ok: true, session: startSession(account), me: publicMe(account) };
}

function logout(body) {
    if (!body.session) return { ok: true };
    const key = digest(String(body.session));
    CacheService.getScriptCache().remove("sess-" + key);
    withLock(() => {
        const session = rows("Sessions").find((item) => item.token === key);
        if (session) removeRow("Sessions", session);
    });
    return { ok: true };
}

function me(body) {
    const account = signedIn(body);
    const enquiries = rows("Enquiries")
        .filter((item) => item.account === account.id)
        .map((item) => ({ kind: item.kind, details: item.details, created: item.created }))
        .sort((a, b) => (a.created < b.created ? 1 : -1));
    return { ok: true, me: publicMe(account), enquiries };
}

function updateMe(body) {
    const account = signedIn(body);
    const changes = {};
    if (body.name !== undefined) {
        changes.name = clean(body.name, LIMITS.name);
        if (!changes.name) throw new Error("Please add your name.");
    }
    if (body.phone !== undefined) changes.phone = clean(body.phone, LIMITS.phone);
    if (body.newPassword) {
        if (hashPassword(String(body.password || ""), account.salt) !== account.hash) throw new Error("Your current password isn't right.");
        checkPassword(body.newPassword);
        changes.salt = Utilities.getUuid();
        changes.hash = hashPassword(String(body.newPassword), changes.salt);
    }
    withLock(() => update("Accounts", account, changes));
    return { ok: true, me: publicMe(account) };
}

function forgot(body) {
    const email = normalEmail(body.email);
    bump("forgot-" + email, 3600, 3, "A reset email has already been sent. Check your inbox and spam folder.");
    const account = rows("Accounts").find((item) => item.email === email);

    /* Says the same thing either way, so nobody can test which emails have accounts */
    if (account) {
        const code = Utilities.getUuid().replace(/-/g, "");
        insert("Resets", { token: digest(code), account: account.id, expires: new Date(Date.now() + 3600000).toISOString() });
        const link = SITE + "/account.html#reset=" + code;
        MailApp.sendEmail({
            to: account.email,
            subject: "Reset your KLD Lighting password",
            body: "Hi " + account.name + ",\n\nUse this link within an hour to choose a new password:\n" + link
                + "\n\nIf you didn't ask for this, you can ignore this email.\n\nKarol Pasko, KLD Lighting",
            name: "KLD Lighting"
        });
    }
    return { ok: true };
}

function reset(body) {
    checkPassword(body.password);
    const key = digest(String(body.code || ""));
    return withLock(() => {
        const request = rows("Resets").find((item) => item.token === key);
        if (!request || request.expires < now()) throw new Error("That reset link has run out. Ask for a new one.");
        const account = rows("Accounts").find((item) => item.id === request.account);
        if (!account) throw new Error("That account no longer exists.");

        const salt = Utilities.getUuid();
        update("Accounts", account, { salt, hash: hashPassword(String(body.password), salt) });
        removeRow("Resets", request);

        /* Signs out everywhere else */
        rows("Sessions").filter((item) => item.account === account.id).reverse().forEach((item) => removeRow("Sessions", item));
        return { ok: true, session: startSession(account), me: publicMe(account) };
    });
}


/* =========================
   ENQUIRIES
   The site's enquiry forms send a copy here as well as to your email,
   so they show under the person's account.
========================= */

function enquiry(body) {
    if (body.website) return { ok: true };
    let account = null;
    try { account = body.session ? signedIn(body) : null; } catch (error) { account = null; }

    const details = clean(body.details, LIMITS.details);
    if (!details) throw new Error("Nothing to save.");

    withLock(() => {
        bump("enquiries", 600, MAX_ENQUIRIES_PER_10_MIN, "Please try again in a few minutes.");
        insert("Enquiries", {
            id: newId("q"),
            account: account ? account.id : "",
            email: normalEmail(body.email),
            name: clean(body.name, LIMITS.name),
            kind: clean(body.kind, 60) || "Enquiry",
            details,
            created: now()
        });
    });
    return { ok: true };
}


/* =========================
   DEVELOPER PORTAL
========================= */

function developer(body) {
    const account = signedIn(body);
    if (!isDeveloper(account)) throw new Error("Your account hasn't been added to the developer portal yet.");
    return account;
}

function setUsername(body) {
    const account = developer(body);
    const username = clean(body.username, LIMITS.username);
    if (username.length < 2) throw new Error("Pick a username with at least 2 characters.");
    if (!/^[\w .-]+$/.test(username)) throw new Error("Use letters, numbers, spaces, dots, dashes or underscores.");

    return withLock(() => {
        const taken = rows("Accounts").some((item) => item.id !== account.id
            && String(item.devUsername).toLowerCase() === username.toLowerCase());
        if (taken) throw new Error("Someone already has that username. Try another.");
        update("Accounts", account, { devUsername: username });
        return { ok: true, me: publicMe(account) };
    });
}

function tasksFor(account) {
    const mine = accountList(account);
    return rows("Tasks")
        .filter((task) => mine.indexOf(task.project) !== -1 && (!task.assignee || task.assignee === account.id))
        .map((task) => ({
            id: task.id, project: task.project, title: task.title, details: task.details,
            status: task.status || TASK_STATUSES[0], forYou: Boolean(task.assignee), updated: task.updated
        }));
}

function portal(body) {
    const account = developer(body);
    const entries = rows("Entries")
        .filter((entry) => entry.account === account.id)
        .map((entry) => ({ project: entry.project, version: String(entry.version), feedback: entry.feedback, status: entry.status, reply: entry.reply, date: entry.submitted }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
    return { ok: true, me: publicMe(account), tasks: tasksFor(account), entries, statuses: TASK_STATUSES };
}

function taskStatus(body) {
    const account = developer(body);
    if (TASK_STATUSES.indexOf(body.status) === -1) throw new Error("Unknown status");
    return withLock(() => {
        const task = rows("Tasks").find((item) => item.id === body.id);
        if (!task || tasksFor(account).every((item) => item.id !== task.id)) throw new Error("That task isn't yours.");
        update("Tasks", task, { status: body.status, updated: now() });
        return { ok: true };
    });
}


/* =========================
   LOG ENTRIES
========================= */

function publicEntries(project) {
    return rows("Entries")
        .filter((entry) => entry.status === "accepted" && entry.project === project)
        .map((entry) => ({
            id: entry.id,
            version: String(entry.version),
            developer: entry.developer,
            feedback: entry.feedback,
            reply: entry.reply,
            date: entry.submitted
        }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function submit(body) {
    const account = developer(body);
    if (!account.devUsername) throw new Error("Pick your developer username in the portal first.");

    const project = clean(body.project, 60);
    const version = clean(body.version, LIMITS.version);
    const feedback = clean(body.feedback, LIMITS.feedback);
    if (!version || !feedback) throw new Error("Please fill in the version and your feedback.");

    const known = projects().find((item) => item.id === project);
    if (!known) throw new Error("That project isn't on the list.");
    if (known.open === false) throw new Error("This log isn't taking new entries right now.");
    if (accountList(account).indexOf(project) === -1) throw new Error("You haven't been added to this project.");

    const entry = withLock(() => {
        bump("recent", 600, MAX_PER_10_MIN, "Lots of entries have come in just now. Please try again in a few minutes.");
        if (rows("Entries").filter((item) => item.status === "pending").length >= MAX_PENDING) {
            throw new Error("There are too many entries waiting to be checked. Please try again later.");
        }
        const item = {
            id: newId("e"), project, version, developer: account.devUsername, feedback,
            status: "pending", submitted: now(), decided: "", reply: "", account: account.id
        };
        insert("Entries", item);
        return item;
    });

    sendReviewEmail(entry, account);
    return { ok: true };
}


/* =========================
   EMAIL WITH ACCEPT / REJECT
========================= */

function signature(id, decision) {
    const secret = PropertiesService.getScriptProperties().getProperty("SECRET");
    const bytes = Utilities.computeHmacSha256Signature(id + ":" + decision, secret);
    return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "");
}

function reviewLink(id, decision) {
    return ScriptApp.getService().getUrl()
        + "?action=review&id=" + encodeURIComponent(id)
        + "&decision=" + decision
        + "&sig=" + signature(id, decision);
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function sendReviewEmail(entry, account) {
    const name = projectName(entry.project);
    const who = entry.developer + " (" + account.name + ", " + account.email + ")";
    const button = (href, label, colour) =>
        '<a href="' + href + '" style="display:inline-block;padding:12px 26px;margin-right:10px;background:' + colour
        + ';color:#ffffff;text-decoration:none;font-weight:600;font-family:Arial,sans-serif">' + label + "</a>";

    const html =
        '<div style="font-family:Arial,sans-serif;color:#0b1426;max-width:560px">'
        + '<p style="margin:0 0 16px">New entry for the <strong>' + escapeHtml(name) + "</strong> developer log. It isn't on the website until you accept it.</p>"
        + '<table style="border-collapse:collapse;margin:0 0 16px">'
        + '<tr><td style="padding:4px 16px 4px 0;color:#4e5d78">Version</td><td style="padding:4px 0">' + escapeHtml(entry.version) + "</td></tr>"
        + '<tr><td style="padding:4px 16px 4px 0;color:#4e5d78">Developer</td><td style="padding:4px 0">' + escapeHtml(who) + "</td></tr>"
        + "</table>"
        + '<div style="white-space:pre-wrap;padding:16px;background:#f2f5fa;border-left:3px solid #1a7fc1;margin:0 0 24px">' + escapeHtml(entry.feedback) + "</div>"
        + "<p>" + button(reviewLink(entry.id, "accept"), "Accept", "#1a7fc1") + button(reviewLink(entry.id, "reject"), "Reject", "#0b1426") + "</p>"
        + '<p style="color:#4e5d78;font-size:13px;margin-top:24px">You can also do this, or reply to it, on your <a href="' + SITE + '/admin.html#devPanel">admin page</a>.</p>'
        + "</div>";

    MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: name + " log: " + entry.version + " from " + entry.developer,
        htmlBody: html,
        body: name + " log entry from " + who + ", version " + entry.version + ":\n\n" + entry.feedback
            + "\n\nAccept: " + reviewLink(entry.id, "accept") + "\nReject: " + reviewLink(entry.id, "reject"),
        name: "KLD developer log"
    });
}

function reviewFromEmail(p) {
    const decision = p.decision === "accept" ? "accept" : p.decision === "reject" ? "reject" : "";
    if (!decision || !p.id || p.sig !== signature(p.id, decision)) {
        return page("That link doesn't look right", "Open the admin page to accept or reject this entry instead.");
    }

    const entry = withLock(() => {
        const found = rows("Entries").find((item) => item.id === String(p.id));
        if (found) decide(found, decision === "accept" ? "accepted" : "rejected");
        return found;
    });
    if (!entry) return page("Not found", "That entry has been deleted.");

    const logUrl = SITE + "/development/log.html?project=" + encodeURIComponent(entry.project);
    return decision === "accept"
        ? page("Accepted", "The entry from " + escapeHtml(entry.developer) + " (version " + escapeHtml(entry.version) + ") is now on the <a href=\"" + logUrl + "\">" + escapeHtml(projectName(entry.project)) + " log</a>.")
        : page("Rejected", "The entry from " + escapeHtml(entry.developer) + " (version " + escapeHtml(entry.version) + ") won't be shown. You can change your mind on the admin page.");
}

function page(title, text) {
    const html =
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_top"></head>'
        + '<body style="font-family:Arial,sans-serif;color:#0b1426;background:#f2f5fa;padding:48px 24px;margin:0">'
        + '<div style="max-width:520px;margin:0 auto"><h1 style="font-size:28px;margin:0 0 12px">' + escapeHtml(title) + "</h1>"
        + '<p style="font-size:17px;line-height:1.5;color:#4e5d78">' + text + "</p>"
        + '<p><a href="' + SITE + '/admin.html#devPanel" style="color:#1a7fc1">Open the admin page</a></p></div></body></html>';
    return HtmlService.createHtmlOutput(html).setTitle(title);
}

function decide(entry, status) {
    update("Entries", entry, { status, decided: now() });
}


/* =========================
   ADMIN PAGE
========================= */

/* The admin page sends its GitHub token; only someone who can change the website gets in */
function checkAdmin(token) {
    if (!token) throw new Error("Not signed in.");

    const cache = CacheService.getScriptCache();
    const key = "admin-" + digest(String(token));
    if (cache.get(key)) return;

    const response = UrlFetchApp.fetch("https://api.github.com/repos/" + REPO, {
        headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" },
        muteHttpExceptions: true
    });
    const repo = response.getResponseCode() === 200 ? JSON.parse(response.getContentText()) : null;
    if (!repo || !repo.permissions || !repo.permissions.push) throw new Error("GitHub didn't accept the admin token.");

    cache.put(key, "1", 600);
}

function strip(item) {
    const copy = Object.assign({}, item);
    delete copy._row;
    delete copy.hash;
    delete copy.salt;
    return copy;
}

const ADMIN = {
    /* Log entries */
    list() {
        const accounts = rows("Accounts");
        return {
            entries: rows("Entries")
                .map((entry) => {
                    const account = accounts.find((item) => item.id === entry.account);
                    const copy = strip(entry);
                    copy.version = String(copy.version);
                    if (account) copy.realName = account.name;
                    return copy;
                })
                .sort((a, b) => (a.submitted < b.submitted ? 1 : -1))
        };
    },
    accept: (body) => withEntry(body, (entry) => decide(entry, "accepted")),
    reject: (body) => withEntry(body, (entry) => decide(entry, "rejected")),
    reply: (body) => withEntry(body, (entry) => update("Entries", entry, { reply: clean(body.reply, LIMITS.reply) })),
    delete: (body) => withEntry(body, (entry) => removeRow("Entries", entry)),

    /* Accounts, with their enquiries */
    accounts() {
        return {
            accounts: rows("Accounts").map((account) => {
                const copy = strip(account);
                copy.developer = isDeveloper(account);
                copy.projects = accountList(account);
                return copy;
            }).sort((a, b) => (a.created < b.created ? 1 : -1)),
            enquiries: rows("Enquiries").map(strip).sort((a, b) => (a.created < b.created ? 1 : -1))
        };
    },
    setAccess(body) {
        return withLock(() => {
            const account = rows("Accounts").find((item) => item.id === body.id);
            if (!account) throw new Error("That account no longer exists.");
            const known = projects().map((project) => project.id);
            const list = (body.projects || []).filter((id) => known.indexOf(id) !== -1);
            update("Accounts", account, { developer: Boolean(body.developer), projects: list.join(",") });
            return {};
        });
    },
    deleteAccount(body) {
        return withLock(() => {
            const account = rows("Accounts").find((item) => item.id === body.id);
            if (!account) return {};
            rows("Sessions").filter((item) => item.account === account.id).reverse().forEach((item) => removeRow("Sessions", item));
            removeRow("Accounts", rows("Accounts").find((item) => item.id === account.id));
            return {};
        });
    },

    /* Tasks */
    tasks() {
        return { tasks: rows("Tasks").map(strip).sort((a, b) => (a.created < b.created ? 1 : -1)), statuses: TASK_STATUSES };
    },
    saveTask(body) {
        const title = clean(body.title, LIMITS.title);
        if (!title) throw new Error("Give the task a title.");
        const status = TASK_STATUSES.indexOf(body.status) === -1 ? TASK_STATUSES[0] : body.status;
        const changes = {
            project: clean(body.project, 60),
            title,
            details: clean(body.details, LIMITS.details),
            assignee: clean(body.assignee, 40),
            status,
            updated: now()
        };
        return withLock(() => {
            if (body.id) {
                const task = rows("Tasks").find((item) => item.id === body.id);
                if (!task) throw new Error("That task no longer exists.");
                update("Tasks", task, changes);
                return { id: task.id };
            }
            const id = newId("t");
            insert("Tasks", Object.assign({ id, created: now() }, changes));
            return { id };
        });
    },
    deleteTask(body) {
        return withLock(() => {
            const task = rows("Tasks").find((item) => item.id === body.id);
            if (task) removeRow("Tasks", task);
            return {};
        });
    }
};

function withEntry(body, work) {
    return withLock(() => {
        const entry = rows("Entries").find((item) => item.id === String(body.id));
        if (!entry) throw new Error("That entry doesn't exist any more.");
        work(entry);
        return {};
    });
}

function admin(body) {
    checkAdmin(body.token);
    const op = ADMIN[body.op];
    if (!op || !Object.prototype.hasOwnProperty.call(ADMIN, body.op)) throw new Error("Unknown admin action");
    return Object.assign({ ok: true }, op(body));
}
