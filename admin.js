/* =========================
   ADMIN PAGE
========================= */

/*
    Everything here talks to GitHub with the token you paste in. Photos are
    committed straight into images/<show>/ on main, so the site picks them
    up after GitHub Pages rebuilds (a minute or two).

    The token is kept in this browser's localStorage only.
*/

const REPO = "KarolPasko/KarolPasko.github.io";
const BRANCH = "main";
const TOKEN_KEY = "kp-admin-token";
const IMAGE_TYPES = /\.(jpe?g|png|webp|gif)$/i;
const OTHER_PHOTO_TYPES = /\.(heic|heif|avif|tiff?|bmp)$/i;

/* Photos bigger than this are shrunk to a JPEG before upload */
const MAX_SIDE = 2000;
const MAX_BYTES = 1024 * 1024;

/* Saved photo order and captions, read by projects.js too */
const PHOTO_INFO = "images/photos.json";

const $ = (id) => document.getElementById(id);

let token = "";
let shows = [];          // [{ folder, title }]
let photosByFolder = {}; // { folder: ["images/folder/1.jpg", …] }
let pending = [];        // [{ file, name, preview }]
let photoInfo = {};      // images/photos.json: { folder: [{ file, caption }] }
let editing = [];        // photos of the chosen show being reordered: [{ path, caption }]
let editingDirty = false;


/* =========================
   GITHUB API
========================= */

async function github(path, options = {}) {
    const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
        ...options,
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            ...(options.body ? { "Content-Type": "application/json" } : {})
        },
        cache: "no-store"
    });

    if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.message || `GitHub returned ${response.status}`);
    }

    return response.json();
}

async function readText(path) {
    const file = await github(`/contents/${path}?ref=${BRANCH}`);
    const bytes = Uint8Array.from(atob(file.content.replace(/\n/g, "")), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function textToBase64(text) {
    let binary = "";
    for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
    return btoa(binary);
}

/*
    Makes one commit on main. changes = [{ path, base64 }] to add or
    replace a file, or [{ path, remove: true }] to delete one.
*/
async function commit(message, changes) {
    const ref = await github(`/git/ref/heads/${BRANCH}`);
    const parent = await github(`/git/commits/${ref.object.sha}`);

    const tree = [];
    for (const change of changes) {
        if (change.remove) {
            tree.push({ path: change.path, mode: "100644", type: "blob", sha: null });
            continue;
        }
        const blob = await github("/git/blobs", {
            method: "POST",
            body: JSON.stringify({ content: change.base64, encoding: "base64" })
        });
        tree.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    const newTree = await github("/git/trees", {
        method: "POST",
        body: JSON.stringify({ base_tree: parent.tree.sha, tree })
    });

    const newCommit = await github("/git/commits", {
        method: "POST",
        body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] })
    });

    await github(`/git/refs/heads/${BRANCH}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: newCommit.sha })
    });
}


/* =========================
   SIGN IN
========================= */

async function connect(newToken) {
    token = newToken;
    $("signInStatus").className = "form-status";
    $("signInStatus").textContent = "Checking…";

    try {
        const repo = await github("");
        if (!repo.permissions || !repo.permissions.push) {
            throw new Error("This token can't change the website. Check that Contents is set to Read and write.");
        }

        try { localStorage.setItem(TOKEN_KEY, token); } catch (error) { /* private window */ }

        $("signIn").hidden = true;
        $("photosPanel").hidden = false;
        $("enquiriesPanel").hidden = false;
        $("worksPanel").hidden = false;

        await Promise.all([loadShows(), loadEnquirySettings()]);
    }

    catch (error) {
        token = "";
        $("signInStatus").className = "form-status error";
        $("signInStatus").textContent =
            error.message === "Bad credentials"
                ? "GitHub didn't accept that token. Check it was copied in full and hasn't expired."
                : error.message;
    }
}

$("tokenForm").addEventListener("submit", (event) => {
    event.preventDefault();
    connect($("tokenInput").value.trim());
});

$("signOut").addEventListener("click", () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch (error) { /* ignore */ }
    location.reload();
});


/* =========================
   SHOWS
========================= */

async function loadShows() {
    const [projectsFile, repoTree, infoFile] = await Promise.all([
        readText("projects.js"),
        github(`/git/trees/${BRANCH}?recursive=1`),
        readText(PHOTO_INFO).catch(() => "{}")
    ]);

    try { photoInfo = JSON.parse(infoFile) || {}; } catch (error) { photoInfo = {}; }

    shows = [...projectsFile.matchAll(/folder:\s*"([^"]+)",\s*title:\s*"([^"]+)"/g)]
        .map(([, folder, title]) => ({ folder, title }));

    photosByFolder = {};
    for (const file of repoTree.tree) {
        const parts = file.path.split("/");
        if (file.type === "blob" && parts.length === 3 && parts[0] === "images" && IMAGE_TYPES.test(parts[2])) {
            (photosByFolder[parts[1]] ||= []).push(file.path);
        }
    }
    for (const folder in photosByFolder) {
        photosByFolder[folder].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }

    const select = $("showSelect");
    const previous = select.value;
    select.innerHTML = "";

    for (const show of shows) {
        select.add(new Option(show.title, show.folder));
    }
    select.add(new Option("+ New show…", "__new"));

    if ([...select.options].some((option) => option.value === previous)) {
        select.value = previous;
    }

    showChanged();
    startShowOrder();
}

function slugify(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "show";
}

function selectedFolder() {
    const value = $("showSelect").value;
    if (value !== "__new") return value;

    let folder = slugify($("newTitle").value.trim());
    const taken = new Set([...shows.map((show) => show.folder), ...Object.keys(photosByFolder)]);
    for (let n = 2; taken.has(folder); n++) folder = `${slugify($("newTitle").value.trim())}-${n}`;
    return folder;
}

function showChanged() {
    const isNew = $("showSelect").value === "__new";
    $("newShow").hidden = !isNew;
    currentShow = $("showSelect").value;
    setOrderStatus("");
    startEditing();
    updateUploadButton();
}

let currentShow = "";
$("showSelect").addEventListener("change", () => {
    if (editingDirty && !confirm("You have unsaved changes to the photo order or comments. Discard them?")) {
        $("showSelect").value = currentShow;
        return;
    }
    showChanged();
});
$("newTitle").addEventListener("input", updateUploadButton);


/* =========================
   EXISTING PHOTOS
========================= */

/* Photos in the saved order first, then any not ordered yet by number */
function orderedPhotos(folder) {
    const photos = photosByFolder[folder] || [];
    const saved = (photoInfo[folder] || []).map((entry) => `images/${folder}/${entry.file}`);
    return [
        ...saved.filter((path) => photos.includes(path)),
        ...photos.filter((path) => !saved.includes(path))
    ];
}

function savedCaption(path) {
    const [, folder, file] = path.split("/");
    return (photoInfo[folder] || []).find((entry) => entry.file === file)?.caption || "";
}

function startEditing() {
    editing = orderedPhotos($("showSelect").value)
        .map((path) => ({ path, caption: savedCaption(path) }));
    setDirty(false);
    renderExisting();
}

function setOrderStatus(text, kind = "") {
    $("orderStatus").className = `form-status ${kind}`;
    $("orderStatus").textContent = text;
}

function setDirty(dirty) {
    editingDirty = dirty;
    $("saveOrderButton").disabled = !dirty;
    $("undoOrderButton").hidden = !dirty;
}

function movePhoto(from, to) {
    if (to < 0 || to >= editing.length || from === to) return;
    editing.splice(to, 0, editing.splice(from, 1)[0]);
    setDirty(true);
    renderExisting();
}

let dragFrom = null;

function renderExisting() {
    const grid = $("existingGrid");
    grid.innerHTML = "";
    $("orderActions").hidden = editing.length === 0;

    if (editing.length === 0) {
        grid.innerHTML = '<p class="admin-help">No photos yet.</p>';
        return;
    }

    editing.forEach((item, index) => {
        const name = item.path.split("/").pop();

        const tile = document.createElement("figure");
        tile.className = "admin-thumb admin-photo";
        tile.draggable = true;

        tile.addEventListener("dragstart", (event) => {
            dragFrom = index;
            tile.classList.add("dragging");
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", name);
        });
        tile.addEventListener("dragend", () => {
            dragFrom = null;
            tile.classList.remove("dragging");
        });
        tile.addEventListener("dragover", (event) => {
            if (dragFrom === null) return;
            event.preventDefault();
            tile.classList.add("drop-target");
        });
        tile.addEventListener("dragleave", () => tile.classList.remove("drop-target"));
        tile.addEventListener("drop", (event) => {
            if (dragFrom === null) return;
            event.preventDefault();
            event.stopPropagation();
            movePhoto(dragFrom, index);
        });

        const img = document.createElement("img");
        img.src = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${item.path}`;
        img.alt = name;
        img.loading = "lazy";
        img.draggable = false;

        const label = document.createElement("figcaption");
        label.textContent = index === 0 ? `${index + 1}. Cover` : `${index + 1}.`;

        const caption = document.createElement("textarea");
        caption.className = "admin-caption";
        caption.rows = 2;
        caption.placeholder = "Add a comment…";
        caption.value = item.caption;
        caption.setAttribute("aria-label", `Comment for photo ${index + 1}`);
        caption.addEventListener("input", () => {
            item.caption = caption.value;
            setDirty(true);
        });

        const moves = document.createElement("div");
        moves.className = "admin-moves";

        const earlier = document.createElement("button");
        earlier.type = "button";
        earlier.textContent = "◀";
        earlier.setAttribute("aria-label", `Move photo ${index + 1} earlier`);
        earlier.disabled = index === 0;
        earlier.addEventListener("click", () => movePhoto(index, index - 1));

        const later = document.createElement("button");
        later.type = "button";
        later.textContent = "▶";
        later.setAttribute("aria-label", `Move photo ${index + 1} later`);
        later.disabled = index === editing.length - 1;
        later.addEventListener("click", () => movePhoto(index, index + 1));

        moves.append(earlier, later);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "admin-thumb-remove";
        remove.setAttribute("aria-label", `Delete photo ${index + 1}`);
        remove.textContent = "×";
        remove.addEventListener("click", () => deletePhoto(item.path));

        tile.append(img, remove, label, moves, caption);
        grid.appendChild(tile);
    });
}

/* photos.json entries for a list of photo paths, keeping saved comments */
function folderEntries(paths) {
    return paths.map((path) => {
        const entry = { file: path.split("/").pop() };
        const caption = savedCaption(path);
        if (caption) entry.caption = caption;
        return entry;
    });
}

function photoInfoChange(info) {
    return { path: PHOTO_INFO, base64: textToBase64(JSON.stringify(info, null, 2) + "\n") };
}

$("saveOrderButton").addEventListener("click", async () => {
    const folder = $("showSelect").value;
    const info = { ...photoInfo };
    info[folder] = editing.map(({ path, caption }) => {
        const entry = { file: path.split("/").pop() };
        if (caption.trim()) entry.caption = caption.trim();
        return entry;
    });

    $("saveOrderButton").disabled = true;
    setOrderStatus("Saving order and comments…");

    try {
        const title = shows.find((show) => show.folder === folder)?.title || folder;
        await commit(`Update photo order and comments for ${title} (admin page)`, [photoInfoChange(info)]);
        photoInfo = info;
        setDirty(false);
        setOrderStatus("Saved. The site updates in a minute or two.", "success");
    }
    catch (error) {
        $("saveOrderButton").disabled = false;
        setOrderStatus(`Couldn't save: ${error.message}`, "error");
    }
});

$("undoOrderButton").addEventListener("click", startEditing);

async function deletePhoto(path) {
    if (!confirm(`Delete photo ${path.split("/").pop()} from the website?`)) return;

    const [, folder] = path.split("/");
    const info = {
        ...photoInfo,
        [folder]: folderEntries(orderedPhotos(folder).filter((p) => p !== path))
    };
    const changes = [{ path, remove: true }, photoInfoChange(info)];

    setOrderStatus("Deleting…");
    try {
        await commit(`Delete ${path} (admin page)`, changes);
        photoInfo = info;
        photosByFolder[folder] = photosByFolder[folder].filter((p) => p !== path);
        editing = editing.filter((item) => item.path !== path);
        renderExisting();
        setOrderStatus("Deleted. The site updates in a minute or two.", "success");
    }
    catch (error) {
        setOrderStatus(`Couldn't delete: ${error.message}`, "error");
    }
}


/* =========================
   SHOW ORDER
========================= */

/*
    The order of shows on the lighting page is the order of the entries
    in the projects list in projects.js, so saving rewrites that list
    with the same entries moved around.
*/

let showOrder = []; // folders, in the order being edited
let showDragFrom = null;

function startShowOrder() {
    showOrder = shows.map((show) => show.folder);
    setShowsDirty(false);
    renderShowOrder();
}

function setShowsDirty(dirty) {
    $("saveShowsButton").disabled = !dirty;
    $("undoShowsButton").hidden = !dirty;
}

function moveShow(from, to) {
    if (to < 0 || to >= showOrder.length || from === to) return;
    showOrder.splice(to, 0, showOrder.splice(from, 1)[0]);
    setShowsDirty(true);
    renderShowOrder();
}

function renderShowOrder() {
    const grid = $("showOrderGrid");
    grid.innerHTML = "";

    showOrder.forEach((folder, index) => {
        const title = shows.find((show) => show.folder === folder)?.title || folder;
        const cover = orderedPhotos(folder)[0];

        const tile = document.createElement("figure");
        tile.className = "admin-thumb admin-photo admin-show";
        tile.draggable = true;

        tile.addEventListener("dragstart", (event) => {
            showDragFrom = index;
            tile.classList.add("dragging");
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", title);
        });
        tile.addEventListener("dragend", () => {
            showDragFrom = null;
            tile.classList.remove("dragging");
        });
        tile.addEventListener("dragover", (event) => {
            if (showDragFrom === null) return;
            event.preventDefault();
            tile.classList.add("drop-target");
        });
        tile.addEventListener("dragleave", () => tile.classList.remove("drop-target"));
        tile.addEventListener("drop", (event) => {
            if (showDragFrom === null) return;
            event.preventDefault();
            event.stopPropagation();
            moveShow(showDragFrom, index);
        });

        let picture;
        if (cover) {
            picture = document.createElement("img");
            picture.src = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${cover}`;
            picture.alt = title;
            picture.loading = "lazy";
            picture.draggable = false;
        } else {
            picture = document.createElement("div");
            picture.className = "admin-no-photo";
            picture.textContent = "No photos yet";
        }

        const label = document.createElement("figcaption");
        label.textContent = `${index + 1}. ${title}`;

        const moves = document.createElement("div");
        moves.className = "admin-moves";

        const earlier = document.createElement("button");
        earlier.type = "button";
        earlier.textContent = "◀";
        earlier.setAttribute("aria-label", `Move ${title} earlier`);
        earlier.disabled = index === 0;
        earlier.addEventListener("click", () => moveShow(index, index - 1));

        const later = document.createElement("button");
        later.type = "button";
        later.textContent = "▶";
        later.setAttribute("aria-label", `Move ${title} later`);
        later.disabled = index === showOrder.length - 1;
        later.addEventListener("click", () => moveShow(index, index + 1));

        moves.append(earlier, later);
        tile.append(picture, label, moves);
        grid.appendChild(tile);
    });
}

/*
    Splits projects.js into the text before the list, each { … } entry,
    and the text after, skipping braces inside strings and comments.
*/
function splitProjects(text) {
    const listStart = text.indexOf("const projects = [");
    if (listStart === -1) throw new Error("Couldn't find the projects list in projects.js.");

    const entries = [];
    let i = listStart + "const projects = [".length;
    let depth = 0;
    let entryStart = -1;

    for (; i < text.length; i++) {
        const char = text[i];

        if (char === '"' || char === "'" || char === "`") {
            for (i++; i < text.length && text[i] !== char; i++) {
                if (text[i] === "\\") i++;
            }
        } else if (char === "/" && text[i + 1] === "/") {
            i = text.indexOf("\n", i);
        } else if (char === "/" && text[i + 1] === "*") {
            i = text.indexOf("*/", i) + 1;
        } else if (char === "{") {
            if (depth === 0) entryStart = i;
            depth++;
        } else if (char === "}") {
            depth--;
            if (depth === 0) entries.push(text.slice(entryStart, i + 1));
        } else if (char === "]" && depth === 0) {
            break;
        }
    }

    if (i >= text.length) throw new Error("Couldn't read the projects list in projects.js.");

    return {
        before: text.slice(0, listStart + "const projects = [".length),
        entries,
        after: text.slice(i)
    };
}

function entryFolder(entry) {
    return (entry.match(/folder:\s*"([^"]+)"/) || [])[1];
}

$("saveShowsButton").addEventListener("click", async () => {
    $("saveShowsButton").disabled = true;
    $("showsStatus").className = "form-status";
    $("showsStatus").textContent = "Saving show order…";

    try {
        const projectsFile = await readText("projects.js");
        const { before, entries, after } = splitProjects(projectsFile);

        /* Shows added since this page loaded keep their place at the end */
        const position = (entry) => {
            const index = showOrder.indexOf(entryFolder(entry));
            return index === -1 ? showOrder.length : index;
        };
        const sorted = [...entries].sort((a, b) => position(a) - position(b));

        const updated = `${before}\n    ${sorted.join(",\n    ")}\n${after}`;
        await commit("Update show order (admin page)", [
            { path: "projects.js", base64: textToBase64(updated) }
        ]);

        shows.sort((a, b) => showOrder.indexOf(a.folder) - showOrder.indexOf(b.folder));
        setShowsDirty(false);
        $("showsStatus").className = "form-status success";
        $("showsStatus").textContent = "Saved. The site updates in a minute or two.";
    }

    catch (error) {
        $("saveShowsButton").disabled = false;
        $("showsStatus").className = "form-status error";
        $("showsStatus").textContent = `Couldn't save: ${error.message}`;
    }
});

$("undoShowsButton").addEventListener("click", startShowOrder);


/* =========================
   NEW PHOTOS
========================= */

const dropZone = $("dropZone");

dropZone.addEventListener("click", () => $("fileInput").click());
dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        $("fileInput").click();
    }
});
$("fileInput").addEventListener("change", (event) => {
    addFiles(event.target.files);
    event.target.value = "";
});

["dragenter", "dragover"].forEach((type) =>
    dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        dropZone.classList.add("dragging");
    })
);
["dragleave", "drop"].forEach((type) =>
    dropZone.addEventListener(type, () => dropZone.classList.remove("dragging"))
);
dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
});

/* Stop a stray drop elsewhere from opening the photo in the tab */
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => event.preventDefault());

/* Loads the HEIC converter the first time an iPhone photo is added */
let heicLoader = null;
function loadHeicConverter() {
    heicLoader ||= new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "vendor/heic2any.min.js";
        script.onload = () => resolve(window.heic2any);
        script.onerror = () => { heicLoader = null; reject(new Error("Couldn't load the HEIC converter.")); };
        document.head.appendChild(script);
    });
    return heicLoader;
}

function isPhoto(file) {
    return file.type.startsWith("image/") || OTHER_PHOTO_TYPES.test(file.name);
}

async function canDecode(file) {
    try {
        (await createImageBitmap(file)).close();
        return true;
    } catch (error) {
        return false;
    }
}

/*
    Photos the browser can't show (HEIC in most browsers) are turned into
    JPEGs here, so they can be previewed and the
    website can display them.
*/
async function toWebPhoto(file) {
    if (await canDecode(file)) return file;

    /* Not readable: most likely HEIC, sometimes even with a .jpg name */
    const heic2any = await loadHeicConverter();
    let jpeg = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    if (Array.isArray(jpeg)) jpeg = jpeg[0]; // burst/live photos: keep the first frame
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([jpeg], name, { type: "image/jpeg" });
}

async function addFiles(fileList) {
    const files = [...fileList].filter(isPhoto);
    const skipped = fileList.length - files.length;
    const failed = [];

    for (let i = 0; i < files.length; i++) {
        setPhotoStatus(`Reading photo ${i + 1} of ${files.length}…`);
        try {
            const file = await toWebPhoto(files[i]);
            pending.push({ file, preview: URL.createObjectURL(file) });
        } catch (error) {
            console.error(`Could not read ${files[i].name}:`, error);
            failed.push(files[i].name);
        }
        renderPending();
    }

    const problems = [];
    if (failed.length) problems.push(`Couldn't open ${failed.join(", ")}. Try exporting it as a JPEG first.`);
    if (skipped) problems.push(`Skipped ${skipped} file${skipped === 1 ? "" : "s"} that ${skipped === 1 ? "isn't a photo" : "aren't photos"}.`);
    setPhotoStatus(problems.join(" "), problems.length ? "error" : "");
}

function renderPending() {
    const grid = $("pendingGrid");
    grid.innerHTML = "";

    pending.forEach((item, index) => {
        const tile = document.createElement("figure");
        tile.className = "admin-thumb";

        const img = document.createElement("img");
        img.src = item.preview;
        img.alt = item.file.name;

        const caption = document.createElement("figcaption");
        caption.textContent = item.file.name;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "admin-thumb-remove";
        remove.setAttribute("aria-label", `Remove ${item.file.name}`);
        remove.textContent = "×";
        remove.addEventListener("click", () => {
            URL.revokeObjectURL(item.preview);
            pending.splice(index, 1);
            renderPending();
        });

        tile.append(img, caption, remove);
        grid.appendChild(tile);
    });

    $("clearButton").hidden = pending.length === 0;
    updateUploadButton();
}

$("clearButton").addEventListener("click", () => {
    pending.forEach((item) => URL.revokeObjectURL(item.preview));
    pending = [];
    renderPending();
});

function updateUploadButton() {
    const needsTitle = $("showSelect").value === "__new" && !$("newTitle").value.trim();
    $("uploadButton").disabled = pending.length === 0 || needsTitle;
    $("uploadButton").textContent =
        pending.length > 1 ? `Upload ${pending.length} photos` : "Upload to website";
}

function setPhotoStatus(text, kind = "") {
    $("photoStatus").className = `form-status ${kind}`;
    $("photoStatus").textContent = text;
}


/* =========================
   SHRINK + ENCODE
========================= */

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/* Returns { base64, ext }, shrinking large photos to a JPEG */
async function preparePhoto(file) {
    const ext = (file.name.match(IMAGE_TYPES) || [".jpg"])[0].slice(1).toLowerCase().replace("jpeg", "jpg");

    if (ext === "gif") {
        return { base64: await blobToBase64(file), ext };
    }

    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= MAX_SIDE && file.size <= MAX_BYTES && IMAGE_TYPES.test(file.name)) {
        bitmap.close();
        return { base64: await blobToBase64(file), ext };
    }

    const scale = Math.min(1, MAX_SIDE / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return { base64: await blobToBase64(jpeg), ext: "jpg" };
}


/* =========================
   UPLOAD
========================= */

function projectEntry(folder, title, type, description) {
    return [
        "    {",
        `        folder: ${JSON.stringify(folder)},`,
        `        title: ${JSON.stringify(title)},`,
        `        type: ${JSON.stringify(type || "Lighting")},`,
        "        description:",
        `            ${JSON.stringify(description || "")}`,
        "    },"
    ].join("\n");
}

$("uploadButton").addEventListener("click", async () => {
    const isNew = $("showSelect").value === "__new";
    const folder = selectedFolder();
    const existing = photosByFolder[folder] || [];

    /* New photos are numbered after the highest number already in the folder */
    let next = existing.reduce((max, path) => {
        const number = parseInt(path.split("/").pop(), 10);
        return Number.isNaN(number) ? max : Math.max(max, number);
    }, 0) + 1;

    $("uploadButton").disabled = true;
    const changes = [];

    try {
        for (let i = 0; i < pending.length; i++) {
            setPhotoStatus(`Preparing photo ${i + 1} of ${pending.length}…`);
            const { base64, ext } = await preparePhoto(pending[i].file);
            changes.push({ path: `images/${folder}/${next++}.${ext}`, base64 });
        }

        let title = shows.find((show) => show.folder === folder)?.title || folder;

        if (isNew) {
            title = $("newTitle").value.trim();
            const projectsFile = await readText("projects.js");
            const entry = projectEntry(
                folder, title, $("newType").value.trim(), $("newDescription").value.trim()
            );
            const updated = projectsFile.replace("const projects = [", `const projects = [\n${entry}`);
            if (updated === projectsFile) throw new Error("Couldn't find the projects list in projects.js.");
            changes.push({ path: "projects.js", base64: textToBase64(updated) });
        }

        /* Keep photos.json listing every photo, so the site can show them without GitHub's API */
        const newPaths = changes.filter((change) => change.path.startsWith(`images/${folder}/`))
            .map((change) => change.path);
        const info = { ...photoInfo, [folder]: folderEntries([...orderedPhotos(folder), ...newPaths]) };
        changes.push(photoInfoChange(info));

        setPhotoStatus("Uploading to GitHub…");
        const count = pending.length;
        await commit(
            `Add ${count} photo${count === 1 ? "" : "s"} to ${title} (admin page)`,
            changes
        );

        pending.forEach((item) => URL.revokeObjectURL(item.preview));
        pending = [];
        renderPending();

        if (isNew) {
            $("newTitle").value = $("newType").value = $("newDescription").value = "";
        }
        await loadShows();
        $("showSelect").value = folder;
        showChanged();

        setPhotoStatus(
            `Done! ${count} photo${count === 1 ? "" : "s"} added to “${title}”. The site updates in a minute or two.`,
            "success"
        );
    }

    catch (error) {
        setPhotoStatus(`Upload failed: ${error.message}`, "error");
        updateUploadButton();
    }
});


/* =========================
   ENQUIRIES
========================= */

let formspreeId = "";

function renderEnquiries() {
    $("enquiriesReady").hidden = !formspreeId;
    $("enquiriesSetup").hidden = Boolean(formspreeId);
    $("formspreeInput").value = formspreeId;
    if (formspreeId) {
        $("enquiriesLink").href = `https://formspree.io/forms/${formspreeId}/submissions`;
    }
}

async function loadEnquirySettings() {
    const config = await readText("site-config.js");
    formspreeId = (config.match(/formspreeForm:\s*"([^"]*)"/) || [])[1] || "";
    renderEnquiries();
}

$("formspreeForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    /* Accept the bare ID or a pasted endpoint like https://formspree.io/f/xyzabcde */
    const value = $("formspreeInput").value.trim();
    const id = (value.match(/\/f\/([A-Za-z0-9]+)/) || [])[1] || value;

    if (id && !/^[A-Za-z0-9]+$/.test(id)) {
        $("enquiryStatus").className = "form-status error";
        $("enquiryStatus").textContent = "That doesn't look like a Formspree form ID.";
        return;
    }

    $("enquiryStatus").className = "form-status";
    $("enquiryStatus").textContent = "Saving…";

    try {
        const config = await readText("site-config.js");
        const updated = config.replace(/formspreeForm:\s*"[^"]*"/, `formspreeForm: "${id}"`);
        await commit(
            id ? "Connect enquiry form to Formspree (admin page)" : "Disconnect Formspree (admin page)",
            [{ path: "site-config.js", base64: textToBase64(updated) }]
        );
        formspreeId = id;
        renderEnquiries();
        $("enquiryStatus").className = "form-status success";
        $("enquiryStatus").textContent = "Saved. The contact form will use it in a minute or two.";
    }
    catch (error) {
        $("enquiryStatus").className = "form-status error";
        $("enquiryStatus").textContent = `Couldn't save: ${error.message}`;
    }
});


/* =========================
   START
========================= */

let savedToken = "";
try { savedToken = localStorage.getItem(TOKEN_KEY) || ""; } catch (error) { /* ignore */ }
if (savedToken) connect(savedToken);
