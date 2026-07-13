# CLAUDE.md — post maintenance rules

A fully static personal site, no build step. GitHub Pages serves these files directly
(`.nojekyll` disables Jekyll).

## Layout conventions

- `posts/<slug>.md` — one post = one markdown file. `slug` is lowercase kebab-case, ASCII only.
- `posts/_template.md` — the starting template. **Copy it for a new post. It is NOT listed in `posts.json`, so it never shows on the site.** Files whose name starts with `_` are non-posts.
- `posts.json` — the index the home page reads. **Every post must have exactly one record here** (except the template).
- `assets/` — `style.css`, `app.js`, and the vendored `marked.min.js` (do not switch to a CDN). `assets/images/` holds post images.
- The home identity block and academic timeline are hardcoded in `renderHome()` in `assets/app.js`; the four epigraph quotes live in `QUOTES` / `renderEpigraphs()` there too.
- The site name / pinyin / English name are in `SITE` at the top of `assets/app.js`.

## Post content features (handled in `renderMarkdown()` in `assets/app.js`)

- **Markdown**: standard, via the vendored `marked`.
- **LaTeX**: `$…$` inline, `$$…$$` display, rendered by KaTeX (loaded from CDN in `index.html`). Literal dollar sign = `\$`.
- **Images**: `![alt](assets/images/foo.png)` — paths are relative to the **site root** (not the `.md` file), because the article HTML is injected into `index.html`. Put files under `assets/images/`.
- **Video**: put a bare YouTube or Bilibili video URL **alone on its own line**; it auto-embeds as a responsive 16:9 iframe. (`youtube.com/watch?v=…`, `youtu.be/…`, or `bilibili.com/video/BV…`.)

## Categories (fixed four, do not add new ones)

`Information Theory` · `Complex System` · `History of Philosophy` · `Others`

Order and exact strings are defined by `CATS` at the top of `assets/app.js`. A post's
`category` must equal one of them exactly. Anything not in the first three goes to `Others`.

## When adding/maintaining a post (what I = Claude do)

1. Write `posts/<slug>.md` with frontmatter on top:
   ```yaml
   ---
   title: <title>
   category: <one of the four categories>
   created: <YYYY-MM-DD>
   updated: <YYYY-MM-DD>
   summary: <one line, used in list + search>
   tags: <comma-separated, optional>
   ---
   ```
2. Add/update the matching record in `posts.json`, fields consistent with the frontmatter,
   plus `slug` and `file` (`posts/<slug>.md`). **Frontmatter and posts.json must stay in sync.**

## created / updated come from git

Don't invent dates. Use the file's git history:

- Created (date of the first commit that added the file):
  ```
  git log --diff-filter=A --format=%ad --date=short -- posts/<slug>.md | tail -1
  ```
- Updated (date of the most recent commit touching the file):
  ```
  git log -1 --format=%ad --date=short -- posts/<slug>.md
  ```

For a brand-new file not yet committed, fill `created`/`updated` with today's date, then
backfill from the commands above after committing. When editing an existing post, update only `updated`.

## Routing

Client-side, via a `?post=<slug>` query param (no `#` hash) — see `route()` in `assets/app.js`.
This is refresh-safe on static hosting and works at any base path; internal links use
`history.pushState`. Do not reintroduce hash routing.

## Local preview

```
python3 -m http.server 8000
```
then open http://localhost:8000 (must be served over http; opening file:// directly breaks fetch).

## Deploy

Push to `main`; GitHub Pages (Settings → Pages → Source = `main` / root) serves it.
The custom domain is set by the root `CNAME` file (`haotianfang.com`) — keep it.
