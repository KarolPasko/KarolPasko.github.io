/*
    Writes the show list and photos into the site as plain HTML,
    schema.org data and sitemap entries, so search engines can read every
    credit and photo without running the page's JavaScript.

    - index.html: the show cards, schema.org data for every show and
      lighting page photo, and the share image
    - hire.html: the equipment cards and schema.org data for the hire kit
      (from images/equipment.json, set on the admin page)
    - other pages in PAGES: the share image
    - shows/<folder>.html: a page for every show, with its own title,
      Google description, share image, every photo (with its alt text)
      and schema.org data
    - hire/<name>.html: the same for every hire item
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
const PAGES = ["index.html", "hire.html", "education.html", "how-light-travels.html"];

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
            .map((photo) => ({
                path: `${folder}/${photo.file}`,
                note: photo.caption || photo.comment || photo.note || "",
                alt: photo.alt || ""
            }));
        const known = new Set(photos.map((photo) => photo.path));
        const others = fs.existsSync(folder)
            ? fs.readdirSync(folder)
                .filter((file) => IMAGE_TYPES.test(file) && !known.has(`${folder}/${file}`))
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                .map((file) => ({ path: `${folder}/${file}`, note: "", alt: "" }))
            : [];
        result[project.folder] = photos.concat(others);
    }
    return result;
}

function sitePhotos() {
    const data = readJson("images/site-photos.json", {});
    const hero = (data.hero || [])
        .filter((photo) => photo.file && fs.existsSync(photo.file))
        .map((photo) => ({ path: photo.file, note: photo.note || "", alt: photo.alt || "" }));
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
            ? `\n            <img src="${escapeHtml(cover.path)}" alt="${escapeHtml(photoAlt(cover, project, 0))}" loading="lazy">`
            : "";
        const notes = project.notes
            ? `\n            <p class="project-notes">${escapeHtml(project.notes)}</p>`
            : "";
        return `        <article class="card project-card">${image}
            <p class="project-role">${escapeHtml(role)}</p>
            <h3><a href="${showPage(project)}">${escapeHtml(project.title)}</a></h3>
            <p>${escapeHtml(sentence(project.description))} Lighting by Karol Pasko (Karol Pasko Technical).</p>${notes}
        </article>`;
    }).join("\n");
}

function imageObject(photo, fallbackCaption) {
    const image = {
        "@type": "ImageObject",
        "contentUrl": url(photo.path),
        "url": url(photo.path),
        "caption": photo.note || photo.alt || fallbackCaption,
        "creditText": "Karol Pasko",
        "creator": { "@id": PERSON_ID },
        "copyrightNotice": "Karol Pasko"
    };
    if (photo.alt) image.description = photo.alt;
    return image;
}

/* The alt text for a show photo: what mike typed, else the comment, else made up from the show */
function photoAlt(photo, project, index) {
    if (photo.alt) return photo.alt;
    const where = project.venue ? ` at ${project.venue}` : "";
    const base = `${project.title}${where}, lighting by Karol Pasko`;
    if (photo.note) return `${photo.note} (${base})`;
    return index ? `${base}, photo ${index + 1}` : base;
}

function showPage(project) {
    return `shows/${project.folder}.html`;
}

function schemaJson(projects, photos, site) {
    const shows = {
        "@type": "ItemList",
        "name": "Lighting credits of Karol Pasko",
        "itemListElement": projects.map((project, index) => {
            const caption = `${project.title}, lighting by Karol Pasko`;
            const show = {
                "@type": "CreativeWork",
                "name": project.title,
                "description": [project.description, project.notes].filter(Boolean).join(" "),
                "url": url(showPage(project)),
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
            if (project.venue) show.locationCreated = { "@type": "Place", "name": project.venue };
            const images = photos[project.folder].map((photo) => imageObject(photo, caption));
            if (images.length) show.image = images;
            return { "@type": "ListItem", "position": index + 1, "item": show };
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

/* The hire equipment (images/equipment.json, set on the admin page), each with its own page */
function equipmentItems() {
    const items = (readJson("images/equipment.json", {}).items || []).filter((item) => item.id && item.name);
    /* hire/<name>.html; must match itemPages() in hire.js */
    const used = new Set();
    for (const item of items) {
        const base = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
        let slug = base;
        for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
        used.add(slug);
        item.page = `hire/${slug}.html`;
    }
    return items;
}

function equipmentAlt(item) {
    return item.alt || `${item.name} for hire in Blackpool from Karol Pasko`;
}

function equipmentPhotos() {
    return equipmentItems().map((item) => item.photo).filter(Boolean);
}

const HIRE_AREA = "Blackpool, the Fylde Coast and Lancashire";

/* Plain cards so search engines can read the kit list; hire.js swaps in the interactive ones */
function equipmentHtml(items) {
    if (!items.length) {
        return `        <p class="hire-empty">I'm still putting the list together. <a href="index.html#contact">Ask me</a> about what you need.</p>`;
    }
    return items.map((item) => {
        const image = item.photo
            ? `\n            <img src="${escapeHtml(item.photo)}" alt="${escapeHtml(equipmentAlt(item))}" loading="lazy">`
            : "";
        const text = item.description
            ? `\n            <p class="hire-description">${escapeHtml(item.description)}</p>`
            : "";
        return `        <article class="card hire-card" id="${escapeHtml(item.id)}">${image}
            <h3><a href="${item.page}">${escapeHtml(item.name)}</a></h3>${text}
            <p class="hire-in-basket">Available to hire in ${HIRE_AREA}.</p>
        </article>`;
    }).join("\n");
}

function equipmentSchema(items) {
    const data = {
        "@context": "https://schema.org",
        "@graph": [{
            "@type": "Service",
            "@id": SITE + "hire.html#hire",
            "name": "Lighting equipment hire in Blackpool",
            "serviceType": "Stage lighting and effects equipment hire",
            "url": SITE + "hire.html",
            "description": `Karol Pasko (KLD Lighting) hires out his own lighting, effects and control equipment across ${HIRE_AREA}, with or without someone to set it up and run the show.`,
            "provider": { "@id": SITE + "#business" },
            "areaServed": [
                { "@type": "City", "name": "Blackpool" },
                { "@type": "Place", "name": "Fylde Coast" },
                { "@type": "AdministrativeArea", "name": "Lancashire" }
            ],
            "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Equipment for hire",
                "itemListElement": items.map((item) => {
                    const product = {
                        "@type": "Product",
                        "name": item.name,
                        "description": item.description || `${item.name} for hire`,
                        "category": "Lighting equipment hire"
                    };
                    if (item.photo) product.image = url(item.photo);
                    product.url = url(item.page);
                    return {
                        "@type": "Offer",
                        "name": `${item.name} hire`,
                        "url": url(item.page),
                        "areaServed": "Blackpool",
                        "businessFunction": "http://purl.org/goodrelations/v1#LeaseOut",
                        "itemOffered": product
                    };
                })
            }
        }]
    };
    return JSON.stringify(data, null, 2).replace(/<\//g, "<\\/").replace(/\n/g, "\n    ");
}

function sitemapXml(projects, photos, site) {
    const images = {
        "index.html": [...site.hero.map((photo) => photo.path), site.about, ...projects.flatMap((project) => photos[project.folder].map((photo) => photo.path))],
        "education.html": [site.about],
        "hire.html": equipmentPhotos()
    };
    for (const project of projects) images[showPage(project)] = photos[project.folder].map((photo) => photo.path);
    for (const item of equipmentItems()) images[item.page] = [item.photo];
    const pages = [...PAGES, ...projects.map(showPage), ...equipmentItems().map((item) => item.page)];
    const entries = pages.filter((page) => fs.existsSync(page)).map((page) => {
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

/* =========================
   A PAGE FOR EVERY SHOW AND HIRE ITEM
   Same header and footer as hire.html. <base href="../"> keeps every
   link and photo path the same as on the pages at the top level.
========================= */

const GENERATED = "<!-- Written by scripts/build-credits.js from projects.js, images/photos.json and images/equipment.json. Edit those (or the admin page), not this file. -->";

/* Shortens text to about `max` characters at a word break, for meta descriptions */
function clip(text, max = 158) {
    text = String(text || "").replace(/\s+/g, " ").trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max - 1);
    return cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length).replace(/[,;:.\s]+$/, "") + "…";
}

function jsonLd(data) {
    const text = JSON.stringify({ "@context": "https://schema.org", ...data }, null, 2).replace(/<\//g, "<\\/").replace(/\n/g, "\n    ");
    return `    <script type="application/ld+json">\n    ${text}\n    </script>`;
}

function chrome() {
    const hire = fs.readFileSync("hire.html", "utf8");
    const header = hire.match(/<header>[\s\S]*?<\/header>/);
    const footer = hire.match(/<footer class="site-footer">[\s\S]*?<\/footer>/);
    if (!header || !footer) throw new Error("hire.html: couldn't find the header or footer to copy.");
    const head = hire.match(/^\s*<link rel="preconnect"[\s\S]*?<link rel="stylesheet"[^>]*>/m);
    return {
        header: header[0],
        footer: footer[0],
        head: head ? head[0].replace(/^\s*/, "    ") : '    <link rel="stylesheet" href="style.css">'
    };
}

function pageHtml({ path, title, description, image, imageAlt, schema, body, scripts, header }) {
    const canonical = url(path);
    const share = image ? `\n${shareImageHtml(image, imageAlt)}` : "";
    return `<!DOCTYPE html>
${GENERATED}
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base href="../">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="author" content="Karol Pasko">
    <link rel="icon" href="brand/kld-icon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="brand/kld-icon.png">
    <link rel="canonical" href="${canonical}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta property="og:locale" content="en_GB">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonical}">
    <meta property="og:site_name" content="Karol Pasko">
    <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">${share}
${chromeParts.head}
${schema}
</head>
<body id="top">

${header}

<main>
${body}
</main>

${chromeParts.footer}

${scripts.map((src) => `<script src="${src}"></script>`).join("\n")}
</body>
</html>
`;
}

function breadcrumbs(trail) {
    return {
        "@type": "BreadcrumbList",
        "itemListElement": trail.map(([name, path], index) => ({
            "@type": "ListItem", "position": index + 1, "name": name, "item": url(path)
        }))
    };
}

function showPageHtml(project, photos) {
    const path = showPage(project);
    const where = project.venue ? ` at ${project.venue}` : "";
    const role = [project.type, project.venue, project.date].filter(Boolean).join(" · ");
    const description = clip(project.seo ||
        `Lighting by Karol Pasko for ${project.title}${where}${project.date ? `, ${project.date}` : ""}. ${sentence(project.description)} ${project.notes || ""}`);
    const cover = photos[0];

    const figures = photos.map((photo, index) => {
        const caption = photo.note ? `\n            <figcaption>${escapeHtml(photo.note)}</figcaption>` : "";
        return `        <figure class="show-photo">
            <a href="${escapeHtml(photo.path)}"><img src="${escapeHtml(photo.path)}" alt="${escapeHtml(photoAlt(photo, project, index))}"${index > 1 ? ' loading="lazy"' : ""}></a>${caption}
        </figure>`;
    }).join("\n");

    const work = {
        "@type": "CreativeWork",
        "@id": url(path) + "#show",
        "name": project.title,
        "url": url(path),
        "description": [project.description, project.notes].filter(Boolean).join(" "),
        "contributor": {
            "@type": "Role",
            "roleName": project.type,
            "contributor": { "@type": "Person", "@id": PERSON_ID, "name": "Karol Pasko" }
        }
    };
    if (project.venue) work.locationCreated = { "@type": "Place", "name": project.venue };
    if (photos.length) work.image = photos.map((photo, index) => imageObject({ ...photo, alt: photoAlt(photo, project, index) }, `${project.title}, lighting by Karol Pasko`));

    const body = `
<section class="section show-page">
    <p class="show-back"><a href="index.html#work">&larr; All work</a></p>
    <h1>${escapeHtml(project.title)}</h1>
    <p class="show-role">${escapeHtml(role)}</p>
    <p class="show-lead">${escapeHtml(sentence(project.description))}</p>${project.notes ? `\n    <p class="show-notes">${escapeHtml(project.notes)}</p>` : ""}

    <div class="show-photos">
${figures || '        <p class="show-notes">Photos coming soon.</p>'}
    </div>

    <p class="show-next">Want lighting like this for your show or event? <a href="index.html#contact">Get in touch</a> or have a look at the <a href="hire.html">equipment I hire out</a>.</p>
</section>
`;

    return pageHtml({
        path,
        title: `${project.title}${project.venue ? ` | ${project.venue}` : ""} | Lighting by Karol Pasko`,
        description,
        image: cover && cover.path,
        imageAlt: cover ? photoAlt(cover, project, 0) : "",
        schema: jsonLd({ "@graph": [work, breadcrumbs([["Home", "index.html"], ["Work", "index.html"], [project.title, path]])] }),
        body,
        header: chromeParts.header.replace('<a href="#equipment">Equipment</a>', '<a href="hire.html">Hire</a>'),
        scripts: ["site.js", "animations.js", "basket.js", "counter.js"]
    });
}

function itemPageHtml(item) {
    const description = clip(item.seo || `${item.name} for hire in Blackpool, the Fylde Coast and Lancashire from Karol Pasko (KLD Lighting). ${item.description || ""}`);
    const service = {
        "@type": "Service",
        "@id": url(item.page) + "#hire",
        "name": `${item.name} hire`,
        "serviceType": "Lighting equipment hire",
        "url": url(item.page),
        "description": item.description || `${item.name} for hire`,
        "provider": { "@id": SITE + "#business" },
        "areaServed": [
            { "@type": "City", "name": "Blackpool" },
            { "@type": "Place", "name": "Fylde Coast" },
            { "@type": "AdministrativeArea", "name": "Lancashire" }
        ],
        "isRelatedTo": { "@id": SITE + "hire.html#hire" }
    };
    if (item.photo) service.image = imageObject({ path: item.photo, alt: equipmentAlt(item), note: "" }, `${item.name} for hire`);

    const body = `
<section class="section hire-item-page" data-hire-id="${escapeHtml(item.id)}">
    <p class="show-back"><a href="hire.html#equipment">&larr; All equipment</a></p>
    <div class="hire-item">${item.photo ? `
        <img class="hire-item-photo" src="${escapeHtml(item.photo)}" alt="${escapeHtml(equipmentAlt(item))}">` : ""}
        <div class="hire-item-text">
            <h1>${escapeHtml(item.name)} hire</h1>
            ${item.description ? `<p class="hire-description">${escapeHtml(item.description)}</p>` : ""}
            <p>Available to hire in ${HIRE_AREA}, on its own or with me to set it up and run it. Add it to your enquiry with your dates and I'll come back to you with availability and a quote.</p>
            <div class="hire-actions" id="itemActions"></div>
            <p class="hire-in-basket" id="itemStatus" role="status"></p>
        </div>
    </div>
</section>
`;

    return pageHtml({
        path: item.page,
        title: `${item.name} Hire Blackpool | KLD Lighting, Karol Pasko`,
        description,
        image: item.photo,
        imageAlt: equipmentAlt(item),
        schema: jsonLd({ "@graph": [service, breadcrumbs([["Home", "index.html"], ["Hire", "hire.html"], [item.name, item.page]])] }),
        body,
        header: chromeParts.header,
        scripts: ["site.js", "animations.js", "basket.js", "hire-item.js", "counter.js"]
    });
}

/* Writes every page into its folder and removes pages this script wrote before that are no longer needed */
function writePages(folder, pages) {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);
    for (const file of fs.readdirSync(folder)) {
        const path = `${folder}/${file}`;
        if (file.endsWith(".html") && !pages[path] && fs.readFileSync(path, "utf8").includes(GENERATED)) {
            fs.unlinkSync(path);
            console.log(`${path}: removed`);
        }
    }
    for (const [path, html] of Object.entries(pages)) fs.writeFileSync(path, html);
    console.log(`${folder}/: wrote ${Object.keys(pages).length} pages`);
}

const chromeParts = chrome();
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

    if (page === "hire.html" && html.includes('id="equipmentGrid"')) {
        const items = equipmentItems();
        html = fillBlock(html, "equipment-schema",
            `    <script type="application/ld+json">\n    ${equipmentSchema(items)}\n    </script>`,
            /^<\/head>/m, "before");
        html = html && fillBlock(html, "equipment",
            equipmentHtml(items),
            /<div id="equipmentGrid"[^>]*>/, "after");
        if (!html) throw new Error(`${page}: couldn't find where to put the equipment.`);
        console.log(`${page}: wrote ${items.length} hire items`);
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

writePages("shows", Object.fromEntries(projects.map((project) => [showPage(project), showPageHtml(project, photos[project.folder])])));
writePages("hire", Object.fromEntries(equipmentItems().map((item) => [item.page, itemPageHtml(item)])));

fs.writeFileSync("sitemap.xml", sitemapXml(projects, photos, site));
console.log("sitemap.xml: written");
