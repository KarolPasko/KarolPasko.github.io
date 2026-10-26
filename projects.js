/* =========================
   PROJECTS
========================= */

/*
    Add projects here.

    folder      = the folder name inside /images/ that holds this
                  project's photos, e.g. "lionking" for images/lionking/
    title       = name displayed on the website
    type        = your role, shown under the title
    date        = when the show was (optional, any wording, e.g. "March 2025")
    description = a sentence or two about the job
    notes       = extra detail, shown smaller under the description (optional)

    The admin page (admin.html) can add, edit, reorder and delete these.

    Every photo in the folder is shown automatically (.jpg, .jpeg,
    .png, .webp, .gif), so just upload pictures to the folder on GitHub.
*/

const projects = [
    {
        folder: "lightning-seeds-lytham",
        title: "Lightning Seeds Lytham",
        type: "Lighting Designer & Operator",
        date: "December 2025",
        description:
            "Lighting Designer & Operator for lightning seeds for their visit to Lowther Pavilion Lytham"
    },
    {
        folder: "addams-family",
        title: "Addams Family",
        type: "Lighting Designer",
        date: "August 2026",
        description:
            "Lighting design, program and operation for Addams family performance. Featuring a DMX controlled moon!"
    },
    {
        folder: "beauty-and-the-beast",
        title: "Beauty and the Beast",
        type: "Lighting Design",
        date: "July 2026",
        description:
            "Lighting design, programming and operation."
    },
    {
        folder: "oliver",
        title: "Oliver! Jr.",
        type: "Lighting Design, Lighting Hire, Lighting Operation",
        date: "February 2026",
        description:
            "Lighting programming, operation and technical production."
    }
];


/* =========================
   FIND PHOTOS
========================= */

/*
    images/photos.json (kept up to date by the admin page) lists each
    project's photos in order, with any comments. The site reads that
    first, so photos show even if GitHub's API is busy.

    GitHub Pages can't list a folder, so the site also asks GitHub's API
    for the files in this repository. That catches photos uploaded on
    GitHub directly, which are added after the listed ones, by number.
    If the API is unavailable (it allows 60 requests an hour per visitor),
    the list in photos.json is used on its own.
*/

const GITHUB_REPO = "KarolPasko/KarolPasko.github.io";
const GITHUB_BRANCH = "main";
const IMAGE_TYPES = /\.(jpe?g|png|webp|gif)$/i;

const photoCaptions = {}; // "images/folder/1.jpg" -> comment

async function getPhotoInfo() {
    try {
        const response = await fetch("images/photos.json", { cache: "no-cache" });
        return response.ok ? await response.json() : {};
    } catch (error) {
        console.error("Could not load images/photos.json:", error);
        return {};
    }
}

/* { folder: [paths] } from GitHub's file list, or null if unavailable */
async function getRepoImages() {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`
        );

        if (!response.ok) {
            throw new Error(`GitHub API returned ${response.status}`);
        }

        const data = await response.json();
        const byFolder = {};

        for (const file of data.tree) {
            const parts = file.path.split("/");

            if (
                file.type === "blob" &&
                parts.length === 3 &&
                parts[0] === "images" &&
                IMAGE_TYPES.test(parts[2])
            ) {
                (byFolder[parts[1]] ||= []).push(file.path);
            }
        }

        for (const folder in byFolder) {
            byFolder[folder].sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true })
            );
        }

        return byFolder;
    }

    catch (error) {
        console.warn("Using images/photos.json only:", error);
        return null;
    }
}

async function getImagesByFolder() {
    const [photoInfo, repoImages] = await Promise.all([getPhotoInfo(), getRepoImages()]);
    const byFolder = {};

    const folders = new Set([...Object.keys(photoInfo), ...Object.keys(repoImages || {})]);

    for (const folder of folders) {
        const listed = (photoInfo[folder] || []).map((entry) => {
            const path = `images/${folder}/${entry.file}`;
            if (entry.caption) photoCaptions[path] = entry.caption;
            return path;
        });

        if (!repoImages) {
            byFolder[folder] = listed;
            continue;
        }

        const inRepo = repoImages[folder] || [];
        byFolder[folder] = [
            ...listed.filter((path) => inRepo.includes(path)),
            ...inRepo.filter((path) => !listed.includes(path))
        ];
    }

    return byFolder;
}


/* =========================
   PROJECT CARDS
========================= */

async function loadProjects() {
    const grid = document.getElementById("projectGrid");
    const imagesByFolder = await getImagesByFolder();

    // Replace the plain list written for search engines (scripts/build-credits.js)
    grid.textContent = "";

    for (const project of projects) {
        const images = imagesByFolder[project.folder] || [];

        const card = document.createElement("button");
        card.type = "button";
        card.className = "card project-card";

        if (images.length > 0) {
            const cover = document.createElement("img");
            cover.src = images[0];
            cover.alt = project.title;
            cover.loading = "lazy";
            card.appendChild(cover);
        }

        const role = document.createElement("p");
        role.className = "project-role";
        role.textContent = project.date ? `${project.type}  ·  ${project.date}` : project.type;

        const title = document.createElement("h3");
        title.textContent = project.title;

        const description = document.createElement("p");
        description.textContent = project.description;

        const count = document.createElement("p");
        count.className = "project-count";
        count.textContent =
            images.length === 0 ? "Photos coming soon"
            : images.length === 1 ? "View 1 photo"
            : `View ${images.length} photos`;

        card.append(role, title, description);

        if (project.notes) {
            const notes = document.createElement("p");
            notes.className = "project-notes";
            notes.textContent = project.notes;
            card.appendChild(notes);
        }

        card.appendChild(count);

        if (images.length > 0) {
            card.addEventListener("click", () => openGallery(project, images));
        } else {
            card.disabled = true;
        }

        grid.appendChild(card);
    }
}


/* =========================
   GALLERY
========================= */

const gallery = document.getElementById("gallery");
const galleryGrid = document.getElementById("galleryGrid");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxCaption = document.getElementById("lightboxCaption");

let currentImages = [];
let currentIndex = 0;
let currentTitle = "";

function openGallery(project, images) {
    currentImages = images;
    currentTitle = project.title;

    document.getElementById("galleryTitle").textContent = project.title;
    document.getElementById("galleryDescription").textContent =
        [project.date, project.description, project.notes].filter(Boolean).join("  ·  ");

    galleryGrid.innerHTML = "";

    images.forEach((src, index) => {
        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "gallery-thumb";

        const img = document.createElement("img");
        img.src = src;
        img.alt = photoCaptions[src] || `${project.title} photo ${index + 1}`;
        img.loading = "lazy";

        thumb.appendChild(img);
        thumb.addEventListener("click", () => openLightbox(index));
        galleryGrid.appendChild(thumb);
    });

    gallery.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeGallery() {
    gallery.classList.remove("active");
    document.body.style.overflow = "";
}

function openLightbox(index) {
    currentIndex = (index + currentImages.length) % currentImages.length;
    lightboxImage.src = currentImages[currentIndex];
    const comment = photoCaptions[currentImages[currentIndex]];
    lightboxImage.alt = comment || `${currentTitle} photo ${currentIndex + 1}`;
    lightboxCaption.textContent =
        `${currentTitle}  ·  ${currentIndex + 1} / ${currentImages.length}`;
    if (comment) {
        const text = document.createElement("strong");
        text.textContent = comment;
        lightboxCaption.prepend(text);
    }
    lightbox.classList.add("active");
}

function closeLightbox() {
    lightbox.classList.remove("active");
}

document.getElementById("galleryClose").addEventListener("click", closeGallery);
document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
document.getElementById("lightboxPrev")
    .addEventListener("click", () => openLightbox(currentIndex - 1));
document.getElementById("lightboxNext")
    .addEventListener("click", () => openLightbox(currentIndex + 1));

/* Clicking the dark background closes the window */
gallery.addEventListener("click", (event) => {
    if (event.target === gallery) closeGallery();
});
lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
});

document.addEventListener("keydown", (event) => {
    if (lightbox.classList.contains("active")) {
        if (event.key === "Escape") closeLightbox();
        if (event.key === "ArrowLeft") openLightbox(currentIndex - 1);
        if (event.key === "ArrowRight") openLightbox(currentIndex + 1);
    } else if (event.key === "Escape") {
        closeGallery();
    }
});


/* =========================
   START
========================= */

loadProjects();
