/*
    KLD developer log: the small free server behind development/log.html.

    It runs as a Google Apps Script web app under your Google account and
    keeps every log entry in a Google Sheet called "KLD developer log".

    - Anyone can send an entry from the log page. It is saved as "pending"
      and you get an email with Accept and Reject buttons.
    - Only accepted entries are shown on the website.
    - The admin page (admin.html) can list, accept, reject, reply to and
      remove entries. It proves it's you with the same GitHub token it
      already uses, which this script checks with GitHub each time.

    No GitHub token or password is stored here. Setup steps are on the
    admin page under "Development projects".
*/

const NOTIFY_EMAIL = "karolek01122@gmail.com";
const SITE = "https://karolpasko.github.io";
const REPO = "KarolPasko/KarolPasko.github.io";
const SHEET_NAME = "Entries";
const HEADERS = ["id", "project", "version", "developer", "feedback", "status", "submitted", "decided", "reply"];

const LIMITS = { version: 30, developer: 40, feedback: 4000, reply: 2000 };
const MAX_PER_10_MIN = 30;   // stops a flood of spam emails
const MAX_PENDING = 300;


/* =========================
   ONE-TIME SETUP
   Run this once from the editor (pick "setup" and press Run).
========================= */

function setup() {
    const props = PropertiesService.getScriptProperties();

    if (!props.getProperty("SECRET")) {
        props.setProperty("SECRET", Utilities.getUuid() + Utilities.getUuid());
    }

    let sheetId = props.getProperty("SHEET_ID");
    if (!sheetId) {
        const book = SpreadsheetApp.create("KLD developer log");
        const sheet = book.getSheets()[0];
        sheet.setName(SHEET_NAME);
        sheet.appendRow(HEADERS);
        sheet.setFrozenRows(1);
        sheetId = book.getId();
        props.setProperty("SHEET_ID", sheetId);
    }

    /* Asks for permission to send email now rather than on the first entry */
    MailApp.getRemainingDailyQuota();

    Logger.log("Ready. Entries are kept in https://docs.google.com/spreadsheets/d/" + sheetId);
}


/* =========================
   WEB APP
========================= */

function doGet(e) {
    const p = e.parameter || {};

    try {
        if (p.action === "review") return reviewFromEmail(p);
        if (p.action === "list") return json({ ok: true, entries: publicEntries(p.project) });
        if (p.action === "ping") return json({ ok: true });
        return json({ ok: false, error: "Unknown action" });
    } catch (error) {
        return json({ ok: false, error: error.message });
    }
}

function doPost(e) {
    try {
        const body = JSON.parse((e.postData && e.postData.contents) || "{}");
        if (body.action === "submit") return json(submit(body));
        if (body.action === "admin") return json(admin(body));
        return json({ ok: false, error: "Unknown action" });
    } catch (error) {
        return json({ ok: false, error: error.message });
    }
}

function json(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}


/* =========================
   SHEET
========================= */

function sheet() {
    const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
    if (!id) throw new Error("The log isn't set up yet. Run setup in Apps Script.");
    return SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME);
}

function allEntries() {
    const rows = sheet().getDataRange().getValues();
    rows.shift();
    return rows.map((row, i) => {
        const entry = { row: i + 2 };
        HEADERS.forEach((key, c) => { entry[key] = row[c]; });
        entry.submitted = toIso(entry.submitted);
        entry.decided = toIso(entry.decided);
        entry.id = String(entry.id);
        entry.version = String(entry.version);
        return entry;
    });
}

function toIso(value) {
    if (value instanceof Date) return value.toISOString();
    return value ? String(value) : "";
}

function findEntry(id) {
    const entry = allEntries().find((item) => item.id === String(id));
    if (!entry) throw new Error("That entry doesn't exist any more.");
    return entry;
}

function setCell(entry, key, value) {
    sheet().getRange(entry.row, HEADERS.indexOf(key) + 1).setValue(value);
}

function publicEntries(project) {
    return allEntries()
        .filter((entry) => entry.status === "accepted" && entry.project === project)
        .map((entry) => ({
            id: entry.id,
            version: entry.version,
            developer: entry.developer,
            feedback: entry.feedback,
            reply: entry.reply,
            date: entry.submitted
        }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
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
   NEW ENTRY FROM THE LOG PAGE
========================= */

function clean(value, max) {
    return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

/* Stops text like "=SUM(…)" being run as a formula in the sheet */
function cell(text) {
    return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function submit(body) {
    if (body.website) return { ok: true }; // filled in by a bot

    const project = clean(body.project, 60);
    const version = clean(body.version, LIMITS.version);
    const developer = clean(body.developer, LIMITS.developer);
    const feedback = clean(body.feedback, LIMITS.feedback);

    if (!version || !developer || !feedback) throw new Error("Please fill in the version, your name and your feedback.");

    const known = projects().find((item) => item.id === project);
    if (!known) throw new Error("That project isn't on the list.");
    if (known.open === false) throw new Error("This log isn't taking new entries right now.");

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);

    try {
        const cache = CacheService.getScriptCache();
        const recent = Number(cache.get("recent") || 0);
        if (recent >= MAX_PER_10_MIN) throw new Error("Lots of entries have come in just now. Please try again in a few minutes.");

        const pendingCount = allEntries().filter((entry) => entry.status === "pending").length;
        if (pendingCount >= MAX_PENDING) throw new Error("There are too many entries waiting to be checked. Please try again later.");

        const id = "e" + Utilities.getUuid().replace(/-/g, "").slice(0, 12);
        const submitted = new Date().toISOString();
        sheet().appendRow([id, project, "'" + version, cell(developer), cell(feedback), "pending", "'" + submitted, "", ""]);
        cache.put("recent", String(recent + 1), 600);

        sendReviewEmail({ id, project, version, developer, feedback, submitted });
    } finally {
        lock.releaseLock();
    }

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

function sendReviewEmail(entry) {
    const name = projectName(entry.project);
    const button = (href, label, colour) =>
        '<a href="' + href + '" style="display:inline-block;padding:12px 26px;margin-right:10px;background:' + colour
        + ';color:#ffffff;text-decoration:none;font-weight:600;font-family:Arial,sans-serif">' + label + "</a>";

    const html =
        '<div style="font-family:Arial,sans-serif;color:#0b1426;max-width:560px">'
        + '<p style="margin:0 0 16px">New entry for the <strong>' + escapeHtml(name) + "</strong> developer log. It isn't on the website until you accept it.</p>"
        + '<table style="border-collapse:collapse;margin:0 0 16px">'
        + '<tr><td style="padding:4px 16px 4px 0;color:#4e5d78">Version</td><td style="padding:4px 0">' + escapeHtml(entry.version) + "</td></tr>"
        + '<tr><td style="padding:4px 16px 4px 0;color:#4e5d78">Developer</td><td style="padding:4px 0">' + escapeHtml(entry.developer) + "</td></tr>"
        + "</table>"
        + '<div style="white-space:pre-wrap;padding:16px;background:#f2f5fa;border-left:3px solid #1a7fc1;margin:0 0 24px">' + escapeHtml(entry.feedback) + "</div>"
        + "<p>" + button(reviewLink(entry.id, "accept"), "Accept", "#1a7fc1") + button(reviewLink(entry.id, "reject"), "Reject", "#0b1426") + "</p>"
        + '<p style="color:#4e5d78;font-size:13px;margin-top:24px">You can also do this, or reply to it, on your <a href="' + SITE + '/admin.html#devPanel">admin page</a>.</p>'
        + "</div>";

    MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: name + " log: " + entry.version + " from " + entry.developer,
        htmlBody: html,
        body: name + " log entry from " + entry.developer + " (version " + entry.version + "):\n\n" + entry.feedback
            + "\n\nAccept: " + reviewLink(entry.id, "accept") + "\nReject: " + reviewLink(entry.id, "reject"),
        name: "KLD developer log"
    });
}

function reviewFromEmail(p) {
    const decision = p.decision === "accept" ? "accept" : p.decision === "reject" ? "reject" : "";
    if (!decision || !p.id || p.sig !== signature(p.id, decision)) {
        return page("That link doesn't look right", "Open the admin page to accept or reject this entry instead.");
    }

    const entry = findEntry(p.id);
    decide(entry, decision === "accept" ? "accepted" : "rejected");

    const logUrl = SITE + "/development/log.html?project=" + encodeURIComponent(entry.project);
    return decision === "accept"
        ? page("Accepted", "The entry from " + entry.developer + " (version " + entry.version + ") is now on the <a href=\"" + logUrl + "\">" + escapeHtml(projectName(entry.project)) + " log</a>.")
        : page("Rejected", "The entry from " + entry.developer + " (version " + entry.version + ") won't be shown. You can change your mind on the admin page.");
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
    setCell(entry, "status", status);
    setCell(entry, "decided", "'" + new Date().toISOString());
}


/* =========================
   ADMIN PAGE
========================= */

/* The admin page sends its GitHub token; only someone who can change the website gets in */
function checkAdmin(token) {
    if (!token) throw new Error("Not signed in.");

    const cache = CacheService.getScriptCache();
    const key = "admin-" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
    if (cache.get(key)) return;

    const response = UrlFetchApp.fetch("https://api.github.com/repos/" + REPO, {
        headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" },
        muteHttpExceptions: true
    });
    const repo = response.getResponseCode() === 200 ? JSON.parse(response.getContentText()) : null;
    if (!repo || !repo.permissions || !repo.permissions.push) throw new Error("GitHub didn't accept the admin token.");

    cache.put(key, "1", 600);
}

function admin(body) {
    checkAdmin(body.token);

    if (body.op === "list") {
        return {
            ok: true,
            entries: allEntries()
                .map((entry) => { delete entry.row; return entry; })
                .sort((a, b) => (a.submitted < b.submitted ? 1 : -1))
        };
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);

    try {
        const entry = findEntry(body.id);

        if (body.op === "accept") decide(entry, "accepted");
        else if (body.op === "reject") decide(entry, "rejected");
        else if (body.op === "reply") setCell(entry, "reply", cell(clean(body.reply, LIMITS.reply)));
        else if (body.op === "delete") sheet().deleteRow(entry.row);
        else throw new Error("Unknown admin action");
    } finally {
        lock.releaseLock();
    }

    return { ok: true };
}
