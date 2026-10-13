/* =========================
   PRESENTATIONS
========================= */

/*
    Any element like  <div class="slides" data-file="presentations/x.pptx">
    shows that PowerPoint as slides you can click through, using
    Microsoft's free Office viewer. Upload the .pptx to the presentations
    folder with the same name and it appears automatically.
*/

async function loadSlides(box) {
    const file = box.dataset.file;
    const fileURL = new URL(file, window.location.href).href;

    let exists = false;
    try {
        const response = await fetch(file, { method: "HEAD" });
        exists = response.ok;
    } catch (error) {
        exists = false;
    }

    if (!exists) {
        box.innerHTML = `<p class="slides-missing">Presentation coming soon</p>`;
        return;
    }

    const viewer = document.createElement("iframe");
    viewer.src =
        "https://view.officeapps.live.com/op/embed.aspx?src=" +
        encodeURIComponent(fileURL);
    viewer.title = "Presentation";
    viewer.loading = "lazy";
    viewer.allowFullscreen = true;

    const download = document.createElement("a");
    download.href = file;
    download.className = "text-link";
    download.textContent = "Download the PowerPoint";
    download.setAttribute("download", "");

    box.append(viewer, download);
}

document.querySelectorAll(".slides").forEach(loadSlides);
