// Home page: shows a few photos from the hire list (images/equipment.json)
// next to the "Need lights for your event?" section.
(function () {
    var box = document.getElementById("hirePromoPhotos");
    if (!box || !window.fetch) return;

    fetch("images/equipment.json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
            var items = ((data && data.items) || []).filter(function (i) {
                return i && i.photo;
            }).slice(0, 4);
            if (!items.length) return;

            items.forEach(function (item) {
                var a = document.createElement("a");
                a.href = "hire.html";
                a.className = "hire-promo-photo";

                var img = document.createElement("img");
                img.src = item.photo;
                img.alt = item.name || "Lighting equipment for hire";
                img.loading = "lazy";

                var name = document.createElement("span");
                name.textContent = item.name || "";

                a.appendChild(img);
                a.appendChild(name);
                box.appendChild(a);
            });
            box.hidden = false;
        })
        .catch(function () {});
})();
