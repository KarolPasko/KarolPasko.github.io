/* =========================
   PORTFOLIO PROJECT SYSTEM
========================= */

/*
    Add projects here.

    folder = the exact folder name inside /projects/
    title  = name displayed on the website
    type   = small description underneath the title
*/

const projects = [

    {
        folder: "oliver",
        title: "Oliver! Jr.",
        type: "School Production",
        description:
            "My technical work on Oliver! Jr., including lighting programming, operation and technical production."
    },

    {
        folder: "beauty",
        title: "Beauty and the Beast",
        type: "Lighting Design",
        description:
            "Lighting design, programming and operation for Beauty and the Beast."
    },

    {
        folder: "aladdin",
        title: "Aladdin Jr.",
        type: "Lighting Programming & Operation",
        description:
            "Lighting programming and operation for Aladdin Jr."
    }

];


/* =========================
   CREATE PROJECT FOLDERS
========================= */

async function loadProjects() {

    const projectGrid =
        document.getElementById("projectGrid");

    projectGrid.innerHTML = "";


    for (const project of projects) {

        const folder =
            document.createElement("div");

        folder.className =
            "project-folder";


        folder.innerHTML = `

            <div class="folder-icon">
                📁
            </div>

            <h3>
                ${project.title}
            </h3>

            <p>
                ${project.type}
            </p>

        `;


        folder.addEventListener(
            "click",
            () => openProject(project)
        );


        projectGrid.appendChild(folder);

    }

}


/* =========================
   GET GITHUB INFORMATION
========================= */

function getGitHubDetails() {

    const hostname =
        window.location.hostname;

    const path =
        window.location.pathname;


    /*
        Works with:

        username.github.io

        and

        username.github.io/repository/
    */

    let owner =
        hostname.split(".")[0];


    let pathParts =
        path.split("/").filter(Boolean);


    let repository = "";


    /*
        If your website is:

        username.github.io

        there is no repository
        in the URL.
    */

    if (
        hostname.endsWith(".github.io") &&
        pathParts.length > 0
    ) {

        repository =
            pathParts[0];

    }


    return {
        owner: owner,
        repository: repository
    };

}


/* =========================
   GET IMAGES FROM GITHUB
========================= */

async function getProjectImages(folder) {

    const github =
        getGitHubDetails();


    let apiURL;


    /*
        GitHub Pages user site:

        username.github.io

        Repository is normally:

        username.github.io
    */

    if (github.repository === "") {

        apiURL =
            `https://api.github.com/repos/${github.owner}/${github.owner}.github.io/contents/projects/${folder}`;

    }

    /*
        GitHub Pages project site:

        username.github.io/repository
    */

    else {

        apiURL =
            `https://api.github.com/repos/${github.owner}/${github.repository}/contents/projects/${folder}`;

    }


    try {

        const response =
            await fetch(apiURL);


        if (!response.ok) {

            throw new Error(
                "Could not load project images."
            );

        }


        const files =
            await response.json();


        /*
            Only allow common image formats.
        */

        return files.filter(file => {

            const name =
                file.name.toLowerCase();

            return (
                name.endsWith(".jpg") ||
                name.endsWith(".jpeg") ||
                name.endsWith(".png") ||
                name.endsWith(".webp") ||
                name.endsWith(".gif")
            );

        });

    }

    catch (error) {

        console.error(error);

        return [];

    }

}


/* =========================
   OPEN PROJECT
========================= */

async function openProject(project) {

    const projectViewer =
        document.getElementById(
            "projectViewer"
        );


    const projectTitle =
        document.getElementById(
            "projectTitle"
        );


    const projectDescription =
        document.getElementById(
            "projectDescription"
        );


    const imageContainer =
        document.getElementById(
            "projectImages"
        );


    projectTitle.textContent =
        project.title;


    projectDescription.textContent =
        project.description;


    /*
        Show loading message
    */

    imageContainer.innerHTML = `

        <div class="loading">

            <div class="loading-spinner"></div>

            <p>
                Loading images...
            </p>

        </div>

    `;


    projectViewer.classList.add(
        "active"
    );


    document.body.style.overflow =
        "hidden";


    /*
        Get images from GitHub
    */

    const images =
        await getProjectImages(
            project.folder
        );


    imageContainer.innerHTML = "";


    if (images.length === 0) {

        imageContainer.innerHTML = `

            <div class="no-images">

                <h3>
                    No images found
                </h3>

                <p>
                    Add images to the
                    <strong>
                        projects/${project.folder}
                    </strong>
                    folder on GitHub.
                </p>

            </div>

        `;

        return;

    }


    /*
        Create image cards
    */

    images.forEach(
        (image, index) => {

            const imageElement =
                document.createElement(
                    "div"
                );


            imageElement.className =
                "project-image";


            imageElement.innerHTML = `

                <img
                    src="${image.download_url}"
                    alt="${project.title} - Image ${index + 1}"
                    loading="lazy"
                >

            `;


            imageElement.addEventListener(
                "click",
                () => {

                    openImage(

                        image.download_url,

                        `${project.title} - Image ${index + 1}`,

                        `Photography from ${project.title}.`

                    );

                }
            );


            imageContainer.appendChild(
                imageElement
            );

        }
    );

}


/* =========================
   CLOSE PROJECT
========================= */

function closeProject() {

    document
        .getElementById(
            "projectViewer"
        )
        .classList.remove(
            "active"
        );


    document.body.style.overflow =
        "";

}


/* =========================
   OPEN IMAGE
========================= */

function openImage(
    src,
    title,
    description
) {

    document.getElementById(
        "largeImage"
    ).src = src;


    document.getElementById(
        "largeImage"
    ).alt = title;


    document.getElementById(
        "imageTitle"
    ).textContent = title;


    document.getElementById(
        "imageDescription"
    ).textContent = description;


    document
        .getElementById(
            "imageViewer"
        )
        .classList.add(
            "active"
        );

}


/* =========================
   CLOSE IMAGE
========================= */

function closeImage() {

    document
        .getElementById(
            "imageViewer"
        )
        .classList.remove(
            "active"
        );

}


/* =========================
   ESCAPE KEY
========================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Escape"
        ) {

            closeImage();

            closeProject();

        }

    }
);


/* =========================
   START WEBSITE
========================= */

loadProjects();
