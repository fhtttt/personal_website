# personal_website

A fully static personal site, live at [haotianfang.com](https://haotianfang.com).
One build step: `build_pages.py` writes a real HTML page per post.

- **Posts**: `posts/*.md`, indexed by `posts.json`; start from `posts/_template.md`.
- **Home**: bio + ventures + academic + post list with full-text search, category
  filter, excerpts, and pagination; plus a multilingual epigraph section.
- **Article features**: Markdown (vendored `marked`), LaTeX via KaTeX (`$…$`, `$$…$$`),
  footnotes, images under `assets/images/`, auto-embedded YouTube / Bilibili links.
- **History**: each post carries its own git record beside it — the commits that
  touched its `.md`, a readable word-level diff of each, the *why* from the commit
  message, and dated readings from `commentary.json`. Sources and interpretation are
  kept in separate layers, and neither is edited after the fact.
- **Routing**: real paths (`/<slug>`), client-side, refresh-safe.

Conventions for writing posts, commit messages and readings are in
[`CLAUDE.md`](./CLAUDE.md).

## Local preview

```sh
python3 build_pages.py && python3 -m http.server 8000
```

Open http://localhost:8000. `http.server` doesn't resolve extensionless paths, so
locally a post is at `/<slug>.html`; on GitHub Pages it is `/<slug>`.

## Deploy

Push to `main`. GitHub Pages: Settings → Pages → Source = `main` / root. The custom
domain `haotianfang.com` is set by the root `CNAME` file.
