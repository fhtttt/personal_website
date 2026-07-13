# personal_website

A fully static personal site — no build step, push and it's live at
[haotianfang.com](https://haotianfang.com).

- **Posts**: `posts/*.md`, indexed by `posts.json`; start from `posts/_template.md`.
- **Home**: bio + ventures + academic + post list with full-text search, category
  filter, excerpts, and pagination; plus a multilingual epigraph section.
- **Article features**: Markdown (vendored `marked`), LaTeX via KaTeX (`$…$`, `$$…$$`),
  images under `assets/images/`, and auto-embedded YouTube / Bilibili links.
- **Routing**: client-side `?post=<slug>` (no `#`), refresh-safe.

Conventions for writing posts and maintaining the index are in [`CLAUDE.md`](./CLAUDE.md).

## Local preview

```sh
python3 -m http.server 8000   # open http://localhost:8000
```

## Deploy

Push to `main`. GitHub Pages: Settings → Pages → Source = `main` / root. The custom
domain `haotianfang.com` is set by the root `CNAME` file.
