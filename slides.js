/* =========================
   PRESENTATIONS
========================= */

/*
    Any element like  <div class="slides" data-file="presentations/x.pptx">
    shows that PowerPoint as slides you can click through, using
    Microsoft's free Office viewer. Upload the .pptx to the presentations
    folder with the same name and it appears automatically.
    Word documents (.docx) work the same way.
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
        // Nothing uploaded yet: show nothing rather than a "coming soon" box
        if (box.dataset.missing) box.innerHTML = `<p class="slides-missing">${box.dataset.missing}</p>`;
        else box.hidden = true;
        return;
    }

    const viewer = document.createElement("iframe");
    viewer.src =
        "https://view.officeapps.live.com/op/embed.aspx?src=" +
        encodeURIComponent(fileURL);
    viewer.title = box.dataset.title || "Presentation";
    viewer.loading = "lazy";
    viewer.allowFullscreen = true;

    const download = document.createElement("a");
    download.href = file;
    download.className = "text-link";
    download.textContent = box.dataset.label || "Download the PowerPoint";
    download.setAttribute("download", "");

    box.append(viewer, download);
}

document.querySelectorAll(".slides").forEach(loadSlides);
