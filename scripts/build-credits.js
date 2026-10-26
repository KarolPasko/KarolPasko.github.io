/*
    Writes the show list from projects.js into the lighting page as plain
    HTML and schema.org data, so search engines can read every credit
    without running the page's JavaScript.

    Runs on GitHub (.github/workflows/credits.yml) whenever projects.js or
    the page changes. The visible cards are still drawn by projects.js; this
    only fills in what's there before it runs.

    Run by hand with:  node scripts/build-credits.js
*/

const fs = require("fs");
const vm = require("vm");

const SITE = "https://karolpasko.github.io/";
const PAGES = ["index.html"];
const PERSON_ID = SITE + "#karol-pasko";

function readProjects() {
    const text = fs.readFileSync("projects.js", "utf8");
    const match = text.match(/const projects = (\[[\s\S]*?\n\]);/);
    if (!match) throw new Error("Couldn't find the projects list in projects.js.");
    return vm.runInNewContext(match[1]);
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function sentence(text) {
    text = String(text || "").trim();
    return text && !/[.!?]$/.test(text) ? text + "." : text;
}

function cardsHtml(projects) {
    return projects.map((project) => {
        const role = project.date ? `${project.type} · ${project.date}` : project.type;
        const notes = project.notes
            ? `\n            <p class="project-notes">${escapeHtml(project.notes)}</p>`
            : "";
        return `        <article class="card project-card">
            <p class="project-role">${escapeHtml(role)}</p>
            <h3>${escapeHtml(project.title)}</h3>
            <p>${escapeHtml(sentence(project.description))} Lighting by Karol Pasko (Karol Pasko Technical).</p>${notes}
        </article>`;
    }).join("\n");
}

function schemaJson(projects) {
    const data = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Lighting credits of Karol Pasko",
        "itemListElement": projects.map((project, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "item": {
                "@type": "Event",
                "name": project.title,
                "description": [project.description, project.notes].filter(Boolean).join(" "),
                "url": SITE + "#work",
                "contributor": {
                    "@type": "Role",
                    "roleName": project.type,
                    "contributor": {
                        "@type": "Person",
                        "@id": PERSON_ID,
                        "name": "Karol Pasko"
                    }
                }
            }
        }))
    };
    return JSON.stringify(data, null, 2).replace(/<\//g, "<\\/").replace(/\n/g, "\n    ");
}

/* Replaces the text between two marker comments, adding the markers at `anchor` the first time */
function fillBlock(html, name, content, anchor, place) {
    const start = `<!-- ${name}:start (written by scripts/build-credits.js) -->`;
    const end = `<!-- ${name}:end -->`;
    const block = place === "before" ? `    ${start}\n${content}\n    ${end}` : `${start}\n${content}\n${end}`;
    const existing = new RegExp(`[ \\t]*<!-- ${name}:start[^>]*-->[\\s\\S]*?<!-- ${name}:end -->`);
    if (existing.test(html)) return html.replace(existing, () => block);
    if (!anchor.test(html)) return null;
    return html.replace(anchor, (found) => place === "before" ? `${block}\n${found}` : `${found}\n${block}`);
}

const projects = readProjects();

for (const page of PAGES) {
    if (!fs.existsSync(page)) continue;
    let html = fs.readFileSync(page, "utf8");
    if (!html.includes('id="projectGrid"')) {
        console.log(`${page}: no show list on this page, skipped`);
        continue;
    }

    html = fillBlock(html, "credits-schema",
        `    <script type="application/ld+json">\n    ${schemaJson(projects)}\n    </script>`,
        /^<\/head>/m, "before");
    html = html && fillBlock(html, "credits",
        cardsHtml(projects),
        /<div id="projectGrid"[^>]*>/, "after");
    if (!html) throw new Error(`${page}: couldn't find where to put the credits.`);

    fs.writeFileSync(page, html);
    console.log(`${page}: wrote ${projects.length} credits`);
}
