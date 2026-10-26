/*
    Writes the show list and photos into the site as plain HTML,
    schema.org data and sitemap entries, so search engines can read every
    credit and photo without running the page's JavaScript.

    - index.html: the show cards, schema.org data for every show and
      lighting page photo, and the share image
    - other pages in PAGES: the share image
    - sitemap.xml: every page plus every photo

    Runs on GitHub (.github/workflows/credits.yml) whenever projects.js,
    the photos or the pages change. The visible cards are still drawn by
    projects.js; this only fills in what's there before it runs.

    Run by hand with:  node scripts/build-credits.js
*/

const fs = require("fs");
const vm = require("vm");

const SITE = "https://karolpasko.github.io/";
const PERSON_ID = SITE + "#karol-pasko";
const IMAGE_TYPES = /\.(jpe?g|png|webp|gif)$/i;

/* Pages search engines should list, in sitemap order */
const PAGES = ["index.html", "education.html", "how-light-travels.html"];

function readProjects() {
    const text = fs.readFileSync("projects.js", "utf8");
    const match = text.match(/const projects = (\[[\s\S]*?\n\]);/);
    if (!match) throw new Error("Couldn't find the projects list in projects.js.");
    return vm.runInNewContext(match[1]);
}

function readJson(path, fallback) {
    try {
        return JSON.parse(fs.readFileSync(path, "utf8"));
    } catch {
        return fallback;
    }
}

/* Each project's photos in the same order the site shows them: photos.json first, then the rest by number */
function projectPhotos(projects) {
    const listed = readJson("images/photos.json", {});
    const result = {};
    for (const project of projects) {
        const folder = `images/${project.folder}`;
        const photos = (listed[project.folder] || [])
            .filter((photo) => fs.existsSync(`${folder}/${photo.file}`))
            .map((photo) => ({ path: `${folder}/${photo.file}`, note: photo.comment || photo.note || "" }));
        const known = new Set(photos.map((photo) => photo.path));
        const others = fs.existsSync(folder)
            ? fs.readdirSync(folder)
                .filter((file) => IMAGE_TYPES.test(file) && !known.has(`${folder}/${file}`))
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                .map((file) => ({ path: `${folder}/${file}`, note: "" }))
            : [];
        result[project.folder] = photos.concat(others);
    }
    return result;
}

function sitePhotos() {
    const data = readJson("images/site-photos.json", {});
    const hero = (data.hero || [])
        .filter((photo) => photo.file && fs.existsSync(photo.file))
        .map((photo) => ({ path: photo.file, note: photo.note || "" }));
    const about = data.about && fs.existsSync(data.about) ? data.about : null;
    return { hero, about };
}

function url(path) {
    return SITE + path.split("/").map(encodeURIComponent).join("/");
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

function cardsHtml(projects, photos) {
    return projects.map((project) => {
        const role = project.date ? `${project.type} · ${project.date}` : project.type;
        const cover = photos[project.folder][0];
        const image = cover
            ? `\n            <img src="${escapeHtml(cover.path)}" alt="${escapeHtml(project.title)}, lighting by Karol Pasko" loading="lazy">`
            : "";
        const notes = project.notes
            ? `\n            <p class="project-notes">${escapeHtml(project.notes)}</p>`
            : "";
        return `        <article class="card project-card">${image}
            <p class="project-role">${escapeHtml(role)}</p>
            <h3>${escapeHtml(project.title)}</h3>
            <p>${escapeHtml(sentence(project.description))} Lighting by Karol Pasko (Karol Pasko Technical).</p>${notes}
        </article>`;
    }).join("\n");
}

function imageObject(photo, fallbackCaption) {
    return {
        "@type": "ImageObject",
        "contentUrl": url(photo.path),
        "caption": photo.note || fallbackCaption,
        "creditText": "Karol Pasko",
        "creator": { "@id": PERSON_ID }
    };
}

function schemaJson(projects, photos, site) {
    const shows = {
        "@type": "ItemList",
        "name": "Lighting credits of Karol Pasko",
        "itemListElement": projects.map((project, index) => {
            const caption = `${project.title}, lighting by Karol Pasko`;
            const event = {
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
            };
            const images = photos[project.folder].map((photo) => imageObject(photo, caption));
            if (images.length) event.image = images;
            return { "@type": "ListItem", "position": index + 1, "item": event };
        })
    };

    const graph = [shows];
    if (site.hero.length) {
        graph.push({
            "@type": "ImageGallery",
            "name": "Lighting by Karol Pasko",
            "url": SITE,
            "image": site.hero.map((photo) => imageObject(photo, "Lighting by Karol Pasko"))
        });
    }

    const data = { "@context": "https://schema.org", "@graph": graph };
    return JSON.stringify(data, null, 2).replace(/<\//g, "<\\/").replace(/\n/g, "\n    ");
}

function shareImageHtml(image, alt) {
    return [
        `    <meta property="og:image" content="${escapeHtml(url(image))}">`,
        `    <meta property="og:image:alt" content="${escapeHtml(alt)}">`,
        `    <meta name="twitter:image" content="${escapeHtml(url(image))}">`
    ].join("\n");
}

function sitemapXml(projects, photos, site) {
    const images = {
        "index.html": [...site.hero.map((photo) => photo.path), site.about, ...projects.flatMap((project) => photos[project.folder].map((photo) => photo.path))],
        "education.html": [site.about]
    };
    const entries = PAGES.filter((page) => fs.existsSync(page)).map((page) => {
        const loc = page === "index.html" ? SITE : SITE + page;
        const pageImages = [...new Set((images[page] || []).filter(Boolean))]
            .map((path) => `\n    <image:image><image:loc>${escapeHtml(url(path))}</image:loc></image:image>`)
            .join("");
        return `  <url>\n    <loc>${loc}</loc>${pageImages}\n  </url>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Written by scripts/build-credits.js; edit PAGES there to add a page -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join("\n")}
</urlset>
`;
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
const photos = projectPhotos(projects);
const site = sitePhotos();
const shareImage = site.hero[0] ? site.hero[0] : null;

for (const page of PAGES) {
    if (!fs.existsSync(page)) continue;
    let html = fs.readFileSync(page, "utf8");

    if (page === "index.html" && html.includes('id="projectGrid"')) {
        html = fillBlock(html, "credits-schema",
            `    <script type="application/ld+json">\n    ${schemaJson(projects, photos, site)}\n    </script>`,
            /^<\/head>/m, "before");
        html = html && fillBlock(html, "credits",
            cardsHtml(projects, photos),
            /<div id="projectGrid"[^>]*>/, "after");
        if (!html) throw new Error(`${page}: couldn't find where to put the credits.`);
        console.log(`${page}: wrote ${projects.length} credits`);
    }

    const image = page === "index.html" && shareImage
        ? { path: shareImage.path, alt: shareImage.note || "Lighting by Karol Pasko" }
        : site.about ? { path: site.about, alt: "Karol Pasko" } : null;
    if (image) {
        const filled = fillBlock(html, "share-image",
            shareImageHtml(image.path, image.alt),
            /^\s*<meta name="twitter:card"[^>]*>/m, "after");
        if (filled) html = filled;
    }

    fs.writeFileSync(page, html);
}

fs.writeFileSync("sitemap.xml", sitemapXml(projects, photos, site));
console.log("sitemap.xml: written");
