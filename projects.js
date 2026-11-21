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

    Every photo and video in the folder is shown automatically (.jpg,
    .jpeg, .png, .webp, .gif, .mp4, .webm, .mov, .m4v), so just upload
    them to the folder on GitHub. YouTube and Vimeo videos are added as
    links on the admin page.
*/

const projects = [
    {
        folder: "forged-bonfire-night-special-event-pure-global",
        title: "FORGED – Bonfire Night Special Event | Pure Global",
        type: "Lighting Design, Programming and operation",
        date: "November 2026",
        venue: "Keighley",
        description:
            "Lighting Design, Programming and operation",
        notes: "I worked on the lighting and special effects for Pure Global’s Bonfire Night event, FORGED.\n\nMy role involved designing and programming a lighting cue stack across five separate music tracks, each approximately five minutes long. I used intelligent lighting to create different atmospheres throughout the event, setting a mood with atmospheric lighting as guests arrived before transitioning into more vibrant, upbeat lighting during the performances to enhance the energy and atmosphere.\n\nAlongside programming the lighting, I was responsible for the live operation of the lighting and special effects on the nights of the event. This included controlling the cold sparks, vertical jets and low fog, coordinating these effects with the music and lighting cues to create an engaging and synchronised experience for the audience.\n\nhttps://pureglobal.co.uk/"
    },
    {
        folder: "tallent-show",
        title: "Tallent Show",
        type: "Lighting Design, Lighting operation",
        date: "July 2026",
        description:
            "",
        notes: "I was brought in by a school to provide the lighting production for their talent show, taking an ordinary school hall and transforming it into a professional performance venue.\n\nI took responsibility for organising and sourcing all the required lighting hire, planning the lighting setup and overseeing the installation. Using intelligent lighting fixtures and a carefully designed lighting setup, I transformed the space into an exciting stage environment, bringing the performances to life and creating a real sense of occasion.\n\nThe show was operated using an Avolites Tiger Touch II lighting console, allowing me to programme and control dynamic lighting effects, colour changes, movements and atmospheric looks throughout the performances.\n\nFrom organising the equipment hire to delivering the final lighting production, I helped turn a standard school hall into a vibrant entertainment venue, elevating the overall experience for both performers and the audience."
    },
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
        folder: "lytham-festival",
        title: "Lytham Festival",
        type: "Lighting Shadow/Operation",
        date: "July 2026",
        venue: "Lytham Green",
        description:
            "Lytham Festival 2026",
        notes: "It was a pleasure to join the LCR Lighting team at Lytham Festival 2026, where I operated lighting on a grandMA3 for the festival’s DJ sets, including performances by DJ PHB and Dave Pearce. With no pre-programmed cue stack, every set was busked live, calling the show in real time to match the energy of the music and the crowd. Working alongside an experienced crew on a large scale outdoor event was a valuable opportunity to deliver dynamic, responsive lighting at a major festival."
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
const VIDEO_TYPES = /\.(mp4|webm|mov|m4v)$/i;
const MEDIA_TYPES = /\.(jpe?g|png|webp|gif|mp4|webm|mov|m4v)$/i;

/*
    A show's list mixes three kinds of item:
      "images/folder/3.jpg"            a photo
      "images/folder/4.mp4"            a video uploaded to the site
      "https://youtu.be/…" or Vimeo    a video link (kept in photos.json)
*/
function isVideoFile(item) {
    return VIDEO_TYPES.test(item);
}

function isLink(item) {
    return /^https?:\/\//i.test(item);
}

function isPhotoItem(item) {
    return !isLink(item) && IMAGE_TYPES.test(item);
}

/* YouTube or Vimeo link -> what's needed to play it, or null */
function videoLink(link) {
    let url;
    try { url = new URL(link); } catch (error) { return null; }
    const host = url.hostname.replace(/^(www|m)\./, "");

    let id = "";
    if (host === "youtu.be") id = url.pathname.slice(1);
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
        id = url.searchParams.get("v") ||
            (url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) || [])[1] || "";
    }
    id = id.split("/")[0];
    if (/^[\w-]{6,}$/.test(id)) {
        return {
            site: "YouTube",
            embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
            thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
        };
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
        const parts = url.pathname.split("/").filter(Boolean);
        const at = parts.findIndex((part) => /^\d+$/.test(part));
        if (at >= 0) {
            const hash = url.searchParams.get("h") || (/^[0-9a-f]{6,}$/i.test(parts[at + 1] || "") ? parts[at + 1] : "");
            return {
                site: "Vimeo",
                embed: `https://player.vimeo.com/video/${parts[at]}?autoplay=1${hash ? `&h=${hash}` : ""}`,
                thumb: ""
            };
        }
    }
    return null;
}

/* "View 4 photos", "View 3 photos and 1 video", "Coming soon" */
function mediaCount(items) {
    const videos = items.filter((item) => isLink(item) || isVideoFile(item)).length;
    const photos = items.length - videos;
    const words = [];
    if (photos) words.push(`${photos} photo${photos === 1 ? "" : "s"}`);
    if (videos) words.push(`${videos} video${videos === 1 ? "" : "s"}`);
    return words.length ? `View ${words.join(" and ")}` : "Photos coming soon";
}

/* A small still for a video: the YouTube picture, the video's first frame, or a plain dark box */
function videoStill(item, alt) {
    const link = isLink(item) ? videoLink(item) : null;

    if (link && link.thumb) {
        const img = document.createElement("img");
        img.src = link.thumb;
        img.alt = alt;
        img.loading = "lazy";
        return img;
    }

    if (!link && isVideoFile(item)) {
        const video = document.createElement("video");
        video.src = `${item}#t=0.1`;
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.setAttribute("aria-label", alt);
        return video;
    }

    const box = document.createElement("span");
    box.className = "video-still-blank";
    box.textContent = link ? `${link.site} video` : "Video";
    return box;
}

function playMark() {
    const mark = document.createElement("span");
    mark.className = "play-mark";
    mark.setAttribute("aria-hidden", "true");
    return mark;
}

const photoCaptions = {}; // "images/folder/1.jpg" -> comment
const photoAlts = {};     // "images/folder/1.jpg" -> description for search engines

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
                MEDIA_TYPES.test(parts[2])
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
        const entries = (photoInfo[folder] || []).filter((entry) => entry.file || videoLink(entry.link || ""));
        const links = entries.filter((entry) => entry.link).map((entry) => entry.link);

        const listed = entries.map((entry) => {
            const path = entry.link || `images/${folder}/${entry.file}`;
            if (entry.caption) photoCaptions[path] = entry.caption;
            if (entry.alt) photoAlts[path] = entry.alt;
            return path;
        });

        if (!repoImages) {
            byFolder[folder] = listed;
            continue;
        }

        const inRepo = repoImages[folder] || [];
        byFolder[folder] = [
            ...listed.filter((path) => inRepo.includes(path) || links.includes(path)),
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

        /* The cover is the first photo; a show with only videos uses the first video */
        const coverItem = images.find(isPhotoItem) || images[0];
        if (coverItem) {
            const coverAlt = photoAlts[coverItem] || `${project.title}, lighting by Karol Pasko`;
            if (isPhotoItem(coverItem)) {
                const cover = document.createElement("img");
                cover.src = coverItem;
                cover.alt = coverAlt;
                cover.loading = "lazy";
                card.appendChild(cover);
            } else {
                const cover = document.createElement("span");
                cover.className = "project-video-cover";
                cover.append(videoStill(coverItem, coverAlt), playMark());
                card.appendChild(cover);
            }
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
        count.textContent = mediaCount(images);

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
const lightboxVideo = document.getElementById("lightboxVideo");
const lightboxFrame = document.getElementById("lightboxFrame");
const lightboxCaption = document.getElementById("lightboxCaption");

let currentImages = [];
let currentIndex = 0;
let currentTitle = "";

function openGallery(project, images) {
    currentImages = images;
    currentTitle = project.title;

    document.getElementById("galleryTitle").textContent = project.title;
    const description = document.getElementById("galleryDescription");
    description.textContent =
        [project.date, project.venue, project.description, project.notes].filter(Boolean).join("  ·  ");

    /* Every show has its own page (written by scripts/build-credits.js) */
    const page = document.createElement("a");
    page.className = "gallery-page-link";
    page.href = `shows/${project.folder}.html`;
    page.textContent = "Page for this show";
    description.append(document.createElement("br"), page);

    galleryGrid.innerHTML = "";

    images.forEach((src, index) => {
        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "gallery-thumb";

        const alt = photoAlts[src] || photoCaptions[src] || `${project.title}, lighting by Karol Pasko, ${isPhotoItem(src) ? "photo" : "video"} ${index + 1}`;

        if (isPhotoItem(src)) {
            const img = document.createElement("img");
            img.src = src;
            img.alt = alt;
            img.loading = "lazy";
            thumb.appendChild(img);
        } else {
            thumb.classList.add("gallery-thumb-video");
            thumb.setAttribute("aria-label", `Play ${alt}`);
            thumb.append(videoStill(src, alt), playMark());
        }

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

/* Stops any video playing in the viewer */
function stopVideo() {
    lightboxVideo.pause();
    lightboxVideo.removeAttribute("src");
    lightboxVideo.load();
    lightboxFrame.src = "about:blank";
}

function openLightbox(index) {
    currentIndex = (index + currentImages.length) % currentImages.length;
    const item = currentImages[currentIndex];
    const comment = photoCaptions[item];
    const link = isLink(item) ? videoLink(item) : null;

    stopVideo();
    lightboxImage.hidden = !isPhotoItem(item);
    lightboxVideo.hidden = !(!link && isVideoFile(item));
    lightboxFrame.hidden = !link;

    if (link) {
        lightboxFrame.src = link.embed;
        lightboxFrame.title = comment || `${currentTitle} video`;
    } else if (isVideoFile(item)) {
        lightboxVideo.src = item;
        lightboxVideo.play().catch(() => {}); // the controls are there if the browser blocks autoplay
    } else {
        lightboxImage.src = item;
        lightboxImage.alt = photoAlts[item] || comment || `${currentTitle} photo ${currentIndex + 1}`;
    }

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
    stopVideo();
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
        if (event.target === lightboxVideo) return; // arrows skip through the video instead
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
