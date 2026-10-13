/* =========================
   PROJECTS
========================= */

/*
    Add projects here.

    title       = name displayed on the website
    type        = your role, shown under the title
    description = a sentence or two about the job
    image       = optional photo, e.g. "projects/oliver/cover.jpg"
*/

const projects = [
    {
        title: "Oliver! Jr.",
        type: "School Production",
        description:
            "Lighting programming, operation and technical production."
    },
    {
        title: "Beauty and the Beast",
        type: "Lighting Design",
        description:
            "Lighting design, programming and operation."
    },
    {
        title: "Aladdin Jr.",
        type: "Lighting Programming & Operation",
        description:
            "Console programming and show operation."
    }
];


function loadProjects() {
    const grid = document.getElementById("projectGrid");

    for (const project of projects) {
        const card = document.createElement("article");
        card.className = "card project-card";

        if (project.image) {
            const img = document.createElement("img");
            img.src = project.image;
            img.alt = project.title;
            img.loading = "lazy";
            card.appendChild(img);
        }

        const role = document.createElement("p");
        role.className = "project-role";
        role.textContent = project.type;

        const title = document.createElement("h3");
        title.textContent = project.title;

        const description = document.createElement("p");
        description.textContent = project.description;

        card.append(role, title, description);
        grid.appendChild(card);
    }
}


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
