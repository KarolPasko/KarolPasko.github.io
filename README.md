# Karol Pasko Technical

Website for Karol Pasko Technical, a freelance lighting, sound, AV and technical production service. Hosted on GitHub Pages at https://karolpasko.github.io.

Plain HTML, CSS and JavaScript with no build step. The home page `index.html` is the lighting site, and its About section links to the education page (`education.html`). `technical.html` only redirects old links to the home page. Edit those files for page text. `how-light-travels.html` shows the How Light Travels Word document from `documents/`, and PowerPoints for the education page go in `presentations/` (see `presentations/README.md`), and the `projects` list at the top of `projects.js` to add or change portfolio work. Project photos go in `images/<project>/`; see `images/README.md`.

`admin.html` is a private-use page for adding project photos (it commits to this repo through the GitHub API using a token kept in the browser) and for connecting the enquiry form to Formspree. Settings for the contact form live in `site-config.js`.

`counter.js` counts visits on every public page using the free [Abacus](https://abacus.jasoncameron.dev) counter service (no account needed). The numbers show in the Visitors section of `admin.html`.
