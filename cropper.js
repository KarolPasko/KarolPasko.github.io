/* =========================
   PHOTO CROPPER (admin page)

   openCropper(file, options) shows a window where a photo can be
   cropped to the shape of the frame it appears in on the site, zoomed,
   moved and turned. It resolves with the cropped photo as a new File,
   or null if Cancel was pressed.

   options:
     frame:  [width, height] of the frame on the site, e.g. [4, 3]
     where:  words for where the photo shows, e.g. "the lighting page"
     type:   "image/jpeg" (default), "image/png" or "image/webp"
========================= */

const CROP_MAX_SIDE = 2000;

const CROP_SHAPES = [
    { id: "site", label: "Fit the site" },
    { id: "original", label: "Original shape" },
    { id: "wide", label: "Wide 16:9", ratio: 16 / 9 },
    { id: "landscape", label: "4:3", ratio: 4 / 3 },
    { id: "square", label: "Square", ratio: 1 },
    { id: "portrait", label: "Portrait 4:5", ratio: 4 / 5 }
];

let cropDialog = null;

function buildCropDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = "cropper";
    dialog.setAttribute("aria-labelledby", "cropTitle");
    dialog.innerHTML = `
        <form method="dialog" class="cropper-inner">
            <h2 id="cropTitle">Crop photo</h2>
            <p class="admin-help cropper-where"></p>

            <div class="cropper-stage">
                <canvas class="cropper-canvas" tabindex="0"
                    aria-label="Photo preview. Drag or use the arrow keys to move it, scroll or use + and - to zoom."></canvas>
            </div>

            <div class="cropper-shapes" role="radiogroup" aria-label="Shape"></div>

            <div class="cropper-controls">
                <label class="cropper-zoom">
                    Zoom
                    <input type="range" min="1" max="4" step="0.01" value="1">
                </label>
                <button type="button" class="button button-ghost cropper-rotate">Turn 90°</button>
                <button type="button" class="button button-ghost cropper-reset">Reset</button>
            </div>

            <p class="admin-help cropper-size"></p>

            <div class="admin-actions cropper-actions">
                <button type="button" class="button button-ghost cropper-cancel">Cancel</button>
                <button type="submit" value="apply" class="button cropper-apply">Use this crop</button>
            </div>
        </form>
    `;
    document.body.appendChild(dialog);
    return dialog;
}

/* A canvas copy of the photo, turned by quarter turns */
function turnedCopy(source, quarterTurns) {
    const turns = ((quarterTurns % 4) + 4) % 4;
    const sideways = turns % 2 === 1;
    const canvas = document.createElement("canvas");
    canvas.width = sideways ? source.height : source.width;
    canvas.height = sideways ? source.width : source.height;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((turns * Math.PI) / 2);
    ctx.drawImage(source, -source.width / 2, -source.height / 2);
    return canvas;
}

async function openCropper(file, options = {}) {
    cropDialog ||= buildCropDialog();
    const dialog = cropDialog;
    const q = (selector) => dialog.querySelector(selector);

    const canvas = q(".cropper-canvas");
    const ctx = canvas.getContext("2d");
    const zoomInput = q(".cropper-zoom input");
    const siteFrame = options.frame || null;
    const type = options.type || "image/jpeg";

    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    let turns = 0;
    let source = bitmap;          // the photo, turned
    let shape = siteFrame ? "site" : "original";
    let ratio = 1;                // width / height of the crop
    let zoom = 1;
    let cx = 0, cy = 0;           // centre of the crop, in photo pixels

    q(".cropper-where").textContent = siteFrame
        ? `The grey part gets cut off. "Fit the site" is the shape of ${options.where || "its frame on the site"}. Drag the box to move it and zoom to cut in closer.`
        : "The grey part gets cut off. Drag the box to move it and zoom to cut in closer.";

    function shapeRatio(id) {
        if (id === "site") return siteFrame[0] / siteFrame[1];
        if (id === "original") return source.width / source.height;
        return CROP_SHAPES.find((s) => s.id === id).ratio;
    }

    /* Biggest crop of this shape that fits inside the photo, at zoom 1 */
    function baseSize() {
        const W = source.width, H = source.height;
        return W / H > ratio ? { w: H * ratio, h: H } : { w: W, h: W / ratio };
    }

    function cropRect() {
        const base = baseSize();
        const w = base.w / zoom, h = base.h / zoom;
        cx = Math.min(Math.max(cx, w / 2), source.width - w / 2);
        cy = Math.min(Math.max(cy, h / 2), source.height - h / 2);
        return { x: cx - w / 2, y: cy - h / 2, w, h };
    }

    function outputSize(rect) {
        const scale = Math.min(1, CROP_MAX_SIDE / Math.max(rect.w, rect.h));
        return { w: Math.max(1, Math.round(rect.w * scale)), h: Math.max(1, Math.round(rect.h * scale)) };
    }

    /* The canvas shows the whole photo, with the part being cut off greyed out */
    let view = { scale: 1, w: 0, h: 0 };

    function layout() {
        const stage = q(".cropper-stage");
        const maxW = stage.clientWidth || 640;
        const maxH = Math.max(220, Math.min(window.innerHeight * 0.55, 560));
        const scale = Math.min(maxW / source.width, maxH / source.height);
        const dpr = window.devicePixelRatio || 1;
        view = { scale, w: Math.round(source.width * scale), h: Math.round(source.height * scale) };
        canvas.style.width = `${view.w}px`;
        canvas.style.height = `${view.h}px`;
        canvas.width = Math.round(view.w * dpr);
        canvas.height = Math.round(view.h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
        const rect = cropRect();
        const s = view.scale;
        ctx.clearRect(0, 0, view.w, view.h);
        ctx.drawImage(source, 0, 0, view.w, view.h);

        /* Grey out everything outside the crop */
        ctx.save();
        ctx.fillStyle = "rgba(11, 20, 38, 0.62)";
        ctx.beginPath();
        ctx.rect(0, 0, view.w, view.h);
        ctx.rect(rect.x * s, rect.y * s, rect.w * s, rect.h * s);
        ctx.fill("evenodd");

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x * s + 1, rect.y * s + 1, rect.w * s - 2, rect.h * s - 2);

        /* Thirds, to help line things up */
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < 3; i++) {
            const x = (rect.x + (rect.w * i) / 3) * s;
            const y = (rect.y + (rect.h * i) / 3) * s;
            ctx.moveTo(x, rect.y * s); ctx.lineTo(x, (rect.y + rect.h) * s);
            ctx.moveTo(rect.x * s, y); ctx.lineTo((rect.x + rect.w) * s, y);
        }
        ctx.stroke();
        ctx.restore();

        const out = outputSize(rect);
        q(".cropper-size").textContent = `Saved size: ${out.w} × ${out.h} pixels.`;
    }

    function renderShapes() {
        const box = q(".cropper-shapes");
        box.innerHTML = "";
        for (const s of CROP_SHAPES) {
            if (s.id === "site" && !siteFrame) continue;
            if (s.ratio && siteFrame && Math.abs(s.ratio - siteFrame[0] / siteFrame[1]) < 0.001) continue;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "cropper-shape";
            button.setAttribute("role", "radio");
            button.setAttribute("aria-checked", String(s.id === shape));
            button.textContent = s.id === "site" ? `Fit the site (${siteFrame[0]}:${siteFrame[1]})` : s.label;
            button.addEventListener("click", () => setShape(s.id));
            box.appendChild(button);
        }
    }

    function setShape(id) {
        shape = id;
        ratio = shapeRatio(id);
        zoom = 1;
        zoomInput.value = "1";
        cx = source.width / 2;
        cy = source.height / 2;
        renderShapes();
        draw();
    }

    function setZoom(value) {
        zoom = Math.min(4, Math.max(1, value));
        zoomInput.value = String(zoom);
        draw();
    }

    function turn() {
        turns++;
        source = turnedCopy(bitmap, turns);
        layout();
        setShape(shape);
    }

    function reset() {
        turns = 0;
        source = bitmap;
        layout();
        setShape(siteFrame ? "site" : "original");
    }

    /* Dragging moves the crop box (or pinch with two fingers to zoom) */
    const pointers = new Map();
    let pinchStart = null;

    function onDown(event) {
        canvas.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinchStart = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
        }
    }

    function onMove(event) {
        const last = pointers.get(event.pointerId);
        if (!last) return;
        const now = { x: event.clientX, y: event.clientY };
        pointers.set(event.pointerId, now);

        if (pointers.size === 2 && pinchStart) {
            const [a, b] = [...pointers.values()];
            setZoom(pinchStart.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.distance));
            return;
        }
        cx += (now.x - last.x) / view.scale;
        cy += (now.y - last.y) / view.scale;
        draw();
    }

    function onUp(event) {
        pointers.delete(event.pointerId);
        if (pointers.size < 2) pinchStart = null;
    }

    function onWheel(event) {
        event.preventDefault();
        setZoom(zoom * Math.exp(-event.deltaY * 0.0015));
    }

    function onKey(event) {
        const step = (event.shiftKey ? 40 : 10) / view.scale;
        const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (moves[event.key]) {
            event.preventDefault();
            cx += moves[event.key][0];
            cy += moves[event.key][1];
            draw();
        } else if (event.key === "+" || event.key === "=") {
            setZoom(zoom * 1.1);
        } else if (event.key === "-") {
            setZoom(zoom / 1.1);
        }
    }

    const onZoomInput = () => setZoom(parseFloat(zoomInput.value));
    const onResize = () => { layout(); draw(); };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKey);
    zoomInput.addEventListener("input", onZoomInput);
    q(".cropper-rotate").onclick = turn;
    q(".cropper-reset").onclick = reset;
    window.addEventListener("resize", onResize);

    dialog.showModal();
    layout();
    setShape(shape);
    canvas.focus();

    const answer = await new Promise((resolve) => {
        q(".cropper-cancel").onclick = () => dialog.close("cancel");
        dialog.addEventListener("close", () => resolve(dialog.returnValue), { once: true });
        dialog.returnValue = "";
    });

    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("keydown", onKey);
    zoomInput.removeEventListener("input", onZoomInput);
    window.removeEventListener("resize", onResize);

    if (answer !== "apply") {
        bitmap.close();
        return null;
    }

    /* Draw the cropped part at full quality */
    const rect = cropRect();
    const out = outputSize(rect);
    const result = document.createElement("canvas");
    result.width = out.w;
    result.height = out.h;
    const rctx = result.getContext("2d");
    rctx.imageSmoothingQuality = "high";
    if (type === "image/jpeg") {
        rctx.fillStyle = "#ffffff"; // JPEGs have no see-through parts
        rctx.fillRect(0, 0, out.w, out.h);
    }
    rctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, out.w, out.h);
    bitmap.close();

    const blob = await new Promise((resolve) => result.toBlob(resolve, type, 0.9));
    const ext = { "image/png": "png", "image/webp": "webp" }[type] || "jpg";
    const name = file.name.replace(/\.[^.]+$/, "") + "." + ext;
    return new File([blob], name, { type });
}
