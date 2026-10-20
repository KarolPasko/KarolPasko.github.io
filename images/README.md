# Project photos

Each project has its own folder here. Every photo you put in a folder shows up on the website automatically, however many there are.

- **Easiest way:** go to https://karolpasko.github.io/admin.html, pick the show (or "+ New show…"), drag your photos in and click **Upload**. The first time, it asks for a GitHub token and shows how to make one.
- **Add photos on GitHub instead:** open the project's folder on GitHub, click **Add file → Upload files**, drag your pictures in, and click **Commit changes**. The site updates within a minute or two.
- **Order and comments:** on the admin page, drag photos into the order you want and type a comment under any of them, then click **Save order and comments**. This is stored in `images/photos.json`. Photos not ordered there are shown last, in filename order (`1.jpg`, `2.jpg`, … `10.jpg`). The first photo is the cover on the project card.
- **Formats:** the admin page takes any photo, including iPhone HEIC, and turns it into a JPEG. If you upload straight to GitHub instead, use `.jpg`, `.jpeg`, `.png`, `.webp` or `.gif` (HEIC won't show on the site). Smaller files load faster, so aim for under about 1 MB each.
- **New project:** create a new folder here (for example `images/lionking/`), then add an entry with `folder: "lionking"` to the `projects` list at the top of `projects.js`.
