/* =========================
   PROJECTS
========================= */

/*
    Add projects here.

    folder      = the folder name inside /images/ that holds this
                  project's photos, e.g. "lionking" for images/lionking/
    title       = name displayed on the website
    type        = your role, shown under the title
    description = a sentence or two about the job

    Every photo in the folder is shown automatically (.jpg, .jpeg,
    .png, .webp, .gif), so just upload pictures to the folder on GitHub.
*/

const projects = [
    {
        folder: "oliver",
        title: "Oliver! Jr.",
        type: "School Production",
        description:
            "Lighting programming, operation and technical production."
    },
    {
        folder: "beauty-and-the-beast",
        title: "Beauty and the Beast",
        type: "Lighting Design",
        description:
            "Lighting design, programming and operation."
    },
    {
        folder: "aladdin",
        title: "Aladdin Jr.",
        type: "Lighting Programming & Operation",
        description:
            "Console programming and show operation."
    }
];


/* =========================
   FIND PHOTOS
========================= */

/*
    GitHub Pages can't list a folder, so the site asks GitHub's API for
    the list of files in this repository (one request for all projects).
*/

const GITHUB_REPO = "KarolPasko/KarolPasko.github.io";
const GITHUB_BRANCH = "main";
const IMAGE_TYPES = /\.(jpe?g|png|webp|gif)$/i;

async function getImagesByFolder() {
    const byFolder = {};

    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`
        );

        if (!response.ok) {
            throw new Error(`GitHub API returned ${response.status}`);
        }

        const data = await response.json();

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
    }

    catch (error) {
        console.error("Could not load project photos:", error);
    }

    return byFolder;
}


/* =========================
   PROJECT CARDS
========================= */

async function loadProjects() {
    const grid = document.getElementById("projectGrid");
    const imagesByFolder = await getImagesByFolder();

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
        role.textContent = project.type;

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

        card.append(role, title, description, count);

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
        project.description;

    galleryGrid.innerHTML = "";

    images.forEach((src, index) => {
        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "gallery-thumb";

        const img = document.createElement("img");
        img.src = src;
        img.alt = `${project.title} photo ${index + 1}`;
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
    lightboxImage.alt = `${currentTitle} photo ${currentIndex + 1}`;
    lightboxCaption.textContent =
        `${currentTitle}  ·  ${currentIndex + 1} / ${currentImages.length}`;
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
   MOBILE MENU
========================= */

const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.getElementById("navLinks");

navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", open);
});

navLinks.addEventListener("click", (event) => {
    if (event.target.tagName === "A") {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
    }
});


/* =========================
   START WEBSITE
========================= */

document.getElementById("year").textContent = new Date().getFullYear();

loadProjects();
