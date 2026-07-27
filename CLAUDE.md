# CLAUDE.md — post maintenance rules

A fully static personal site. GitHub Pages serves these files directly (`.nojekyll`
disables Jekyll). The only build step is `build_pages.py`, which generates one
HTML file per post so each article has a real URL and its own `<head>` metadata.

## Commit messages: content and site are two different records

The commit history of `posts/<slug>.md` *is* the post's own history, surfaced next
to the article with its diffs and commentary (see the history panel below). That only
works if content commits and site-development commits are distinguishable at a glance,
and if the content ones carry an argument.

**Never mix the two in one commit.** A change that touches both `posts/*.md` (or
`posts.json` content fields) and `assets/` / `build_pages.py` / `index.html` gets
split into two commits. Regenerated `<slug>.html` goes with whichever commit
caused it.

### Content commits — the user writes these

```
post(<slug>): <what changed, one line>

<why. The user's own words: what was wrong or missing before, what prompted
the change, what the new version is claiming. This body is the commentary
that will be published beside the diff.>
```

Rule for Claude: **do not write, draft, paraphrase, or "clean up" the body of a
content commit, and do not commit content changes unprompted.** Stage the change,
show the diff, and ask the user for the message. The subject line may be proposed;
the body may not. An empty or generic body ("update wording") defeats the purpose —
if the user hasn't supplied a why yet, wait rather than fill it in.

**The body is published.** The History panel renders it verbatim on the public post
page, so writing one is an act of publishing, not a private note to the repo. Say so
before asking the user for a body, especially when the change is personal — the
alternative to a public body is a dated note in `commentary.json`, or nothing.
Commit it byte for byte, typos included; do not silently rewrap or fix punctuation.

For a brand-new post: `post(<slug>): Add <Title>`, body = why this post exists.

### Site commits — Claude writes these, minimal and uniform

```
site: <imperative summary, ≤72 chars>
```

One line. No body unless a non-obvious cause needs recording (an iOS/WebKit
quirk, a GitHub Pages behaviour) — then one short paragraph of fact, no
narrative. No co-author or generated-by trailers, ever.

Examples: `site: Fix footnote links on iOS`, `site: Serve posts at /<slug>`.

## Published history is append-only from `af8e60f`

On 2026-07-27 the whole history was deliberately collapsed to two commits —
`ddbf51b` (the entire site) and `af8e60f` (the first writing of Write Your Own
History) — to set the baseline before the practice began. That was a one-time
re-founding, **not a precedent**. Do not rewrite, squash, amend or force-push
anything already pushed, and do not offer to:

- every `sha` in `commentary.json` is pinned to a commit, so a rewrite silently
  orphans every note. The placeholder notes written before the collapse had to be
  thrown away for exactly this reason — the SHAs all changed.
- the panel's diffs are computed against the previous commit of the file, so a
  rewritten past changes what every future diff appears to say.
- the post itself argues against smoothing a record to look tidier.

Amending a commit that has **not** been pushed is fine. `git push --force` is not,
without the user asking for it in those terms.

## The history panel (`commentary.json`)

Every post page carries a `History` rail listing the commits that touched
`posts/<slug>.md` — read live from the GitHub API, so it needs no build step and
shows nothing until the commit is pushed. Because it queries that one path, `site:`
commits never appear in it. Clicking a revision opens the commit's *why* (the
message body), a word-level diff of the markdown, and the readings attached to it.

`commentary.json` is the 史論 layer and the only hand-written part:

```json
{ "<slug>": [ { "sha": "<prefix>", "date": "YYYY-MM-DD", "note": "inline markdown" } ] }
```

- The `sha` to pin a note to comes from
  `git log --format='%h %ad %s' --date=short -- posts/<slug>.md`.
- A commit may carry any number of notes. **Never edit or delete an old note** —
  a rereading is a new entry with a new date, not a correction of the previous one.
  That is the whole point of the file; collapsing them would be exactly the smoothing
  the post argues against.
- Notes are the user's voice. Claude does not write them, same rule as commit bodies.
- The diff renders word-by-word for edited paragraphs, and whole-paragraph
  strike/insert when a paragraph was replaced rather than edited (similarity < 0.4).
  `wordDiff()` returns `null` in that case — that is the signal, not a failure.
- The `updated:` frontmatter line shows up as a change in every content diff. It is
  not filtered out on purpose: it is part of the source.

What the panel depends on, all of it load-bearing:

- **The repo must stay public.** The panel reads the GitHub API anonymously from the
  browser; a private repo means no history for every visitor, with no other symptom.
- 60 requests/hour unauthenticated, so answers are cached in `sessionStorage`. A panel
  showing stale commits after a push is that cache — `sessionStorage.clear()`, not a bug.
- `REPO` at the top of `assets/app.js` is the hardcoded `owner/name`. Renaming the
  GitHub repo breaks the panel silently; update it there.
- Nothing appears until the commit is **pushed**. Local commits are invisible here.

## Layout conventions

- `posts/<slug>.md` — one post = one markdown file. `slug` is lowercase kebab-case, ASCII only.
- `posts/_template.md` — the starting template. **Copy it for a new post. It is NOT listed in `posts.json`, so it never shows on the site.** Files whose name starts with `_` are non-posts.
- `posts.json` — the index the home page reads. **Every post must have exactly one record here** (except the template).
- `<slug>.html` — **generated**, never hand-edited. Produced by `build_pages.py` from `posts.json`; carries the per-post `<title>`, description and Open Graph tags. Marked with a `<!-- generated by build_pages.py -->` first line, which is also how the script knows a stale page is safe to delete. A slug may not be `index`, `assets`, `posts`, `404` or `CNAME`; the script refuses those.
- `assets/` — `style.css`, `app.js`, and the vendored `marked.min.js` (do not switch to a CDN). `assets/images/` holds post images.
- The home identity block and academic timeline are hardcoded in `renderHome()` in `assets/app.js`; the four epigraph quotes live in `QUOTES` / `renderEpigraphs()` there too.
- The site name / pinyin / English name are in `SITE` at the top of `assets/app.js`.

## Post content features (handled in `renderMarkdown()` in `assets/app.js`)

- **Markdown**: standard, via the vendored `marked`.
- **LaTeX**: `$…$` inline, `$$…$$` display, rendered by KaTeX (loaded from CDN in `index.html`). Literal dollar sign = `\$`.
- **Images**: `![alt](assets/images/foo.png)` — paths are relative to the **site root** (not the `.md` file), because the article HTML is injected into `index.html`. Put files under `assets/images/`.
- **Video**: put a bare YouTube or Bilibili video URL **alone on its own line**; it auto-embeds as a responsive 16:9 iframe. (`youtube.com/watch?v=…`, `youtu.be/…`, or `bilibili.com/video/BV…`.)

## Browser floor: no regex lookbehind in `assets/app.js`

An iPad showed a permanently blank page (just the `…` placeholder from `index.html`)
while phone and desktop were fine. Cause: `renderMarkdown()` used `(?<!\\)\$…` — regex
lookbehind, unsupported by Safari before 16.4. It is a **parse-time** SyntaxError, so the
entire `app.js` never runs and nothing renders; there is no partial degradation and no
console-visible clue unless you attach a debugger. Every iOS/iPadOS browser (Chrome, Edge,
Firefox) uses WebKit, so this hits all of them.

Rule: keep `app.js` to syntax Safari 14 understands — no `(?<=…)` / `(?<!…)`, no `?.`,
no `??`, no class private fields. Consume the preceding character in the match instead
(`/(^|[^\\])\$…/`). The vendored `marked.min.js` does use `?.` / `??` / `#private`
(Safari 15+), but it is a separate `<script>`, so if it fails only article rendering
breaks — the home page survives. Do not inline it into `app.js`.

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
   One field is deliberately not identical in the two places: `tags` is a comma-separated
   string in the frontmatter and a JSON **array** in `posts.json`.
3. Run `python3 build_pages.py` and commit the generated `<slug>.html` along with the
   post. Forgetting this means the post is reachable only at the legacy `?post=` URL.

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

Client-side, but on real paths. GitHub Pages resolves an extensionless request to
`<path>.html`, so the generated `<slug>.html` is served at **`/<slug>`** — 200 directly,
no redirect, no trailing slash, no visible extension. That is the URL to share. `route()`
in `assets/app.js` takes the slug from `location.pathname` (stripping a `.html` suffix if
someone types one), falling back to a `?post=<slug>` query param so links shared before
this change keep working. Internal links use `history.pushState`. Do not reintroduce hash
routing.

An earlier version of this scheme used `<slug>/index.html` served at `/<slug>/`. That
works too, but GitHub 301s the no-slash form to the slash form, and the slash is what
ends up in people's clipboards. Flat files avoid it. `build_pages.py` deletes leftover
directories from that scheme.

Every asset path in `index.html`, in the generated pages, and in every `fetch()` in
`app.js` is **root-absolute** (`/assets/…`, `/posts.json`) — keep it that way.
`renderMarkdown()` rewrites relative `<img src>` in posts to match, so posts can go on
citing images as `assets/images/foo.png`.

### `route()` must ignore hash-only changes

Footnote links (`#fn-…` / `#fnref-…`) worked on desktop and did nothing on iPhone.
Cause: **WebKit fires `popstate` for in-page fragment navigation; Blink does not.** On iOS
a footnote tap therefore ran `route()`, which re-rendered the post (async `fetch` of the
`.md`, so the anchor node was destroyed) and called `window.scrollTo(0, 0)`. The jump was
undone a moment after it happened, which reads as "the link is dead."

`route()` now early-returns when `location.pathname + location.search` matches the last
render (`rendered`). Any new in-page anchor gets correct native behaviour for free. Do not
remove that guard, and do not add a `hashchange` listener that re-renders.

## Local preview

```
python3 build_pages.py && python3 -m http.server 8000
```
then open http://localhost:8000 (must be served over http; opening file:// directly breaks fetch).

`http.server` does **not** resolve an extensionless path to `<path>.html` the way
GitHub Pages does, so `/write-your-own-history` 404s locally. Preview a post at
`/write-your-own-history.html` — `route()` strips the suffix, so the page behaves
identically. Do not "fix" the routing over this; nothing is wrong with it.

## Deploy

Run `python3 build_pages.py` first, then push to `main`; GitHub Pages (Settings → Pages → Source = `main` / root) serves it.
The custom domain is set by the root `CNAME` file (`haotianfang.com`) — keep it.
