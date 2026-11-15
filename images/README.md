# Project photos

Each project has its own folder here. Every photo you put in a folder shows up on the website automatically, however many there are.

- **Easiest way:** go to https://karolpasko.github.io/admin.html, pick the show (or "+ New show…"), drag your photos in and click **Upload**. The first time, it asks for a GitHub token and shows how to make one.
- **Add photos on GitHub instead:** open the project's folder on GitHub, click **Add file → Upload files**, drag your pictures in, and click **Commit changes**. The site updates within a minute or two.
- **Order and comments:** on the admin page, drag photos into the order you want and type a comment under any of them, then click **Save order and comments**. This is stored in `images/photos.json`. Photos not ordered there are shown last, in filename order (`1.jpg`, `2.jpg`, … `10.jpg`). The first photo is the cover on the project card.
- **Formats:** the admin page takes any photo, including iPhone HEIC, and turns it into a JPEG. If you upload straight to GitHub instead, use `.jpg`, `.jpeg`, `.png`, `.webp` or `.gif` (HEIC won't show on the site). Smaller files load faster, so aim for under about 1 MB each.
- **Videos:** drag videos onto the same admin box as photos. MP4 works in every browser; each video can be up to 50 MB (about a minute of phone video). Longer or bigger videos: put them on YouTube or Vimeo and paste the link under **Or add a YouTube or Vimeo video**. Links are stored in `images/photos.json` as `{ "link": "https://youtu.be/…" }` entries, in order with the photos. Videos open in the same viewer as photos, and the show's cover stays the first photo.
- **New project:** create a new folder here (for example `images/lionking/`), then add an entry with `folder: "lionking"` to the `projects` list at the top of `projects.js`.
- **Hire equipment:** the items on the hire page (hire.html) are set on the admin page under **Your equipment**. They are stored in `images/equipment.json` with their photos in `images/equipment/`.
