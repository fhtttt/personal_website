# The Learning Map — how to run it

`/learning-map` is an index, not an essay. Under it live **atomic notes**: one idea per
note, a video at the top and a hand-typed transcript below it. The page renders a graph
of them and a search box over their full text.

This file is the procedure. The division of labour is fixed:

> **You write markdown. Claude does everything else.**
>
> You touch `posts/learning/<slug>.md` and nothing else. Claude keeps `learning.json`,
> the generated pages and the commits in step with it.

The conventions this rests on — and the traps that are easy to reintroduce — are in
[`CLAUDE.md`](./CLAUDE.md). Read that before changing how any of it works.

---

## The two layers

| | file | who writes it | what it is |
|---|---|---|---|
| **the note** | `posts/learning/<slug>.md` | **you** | one idea: a video and its transcript |
| **the map** | `learning.json` | Claude | which notes exist, and which leads to which |

They are separate on purpose, and the separation is what makes the History panel work:
a change to a note is an argument and carries a reason you wrote; a change to the map is
a change of structure and carries an automatic message.

**Notes are never listed in `posts.json`.** That one fact is the whole reason they stay
off the home page and out of the site-wide search. Nothing else enforces it.

---

## Adding a knowledge point

Say the idea is *Dedekind cuts*.

### 1. You: write the note

Copy the template and fill it in:

```sh
cp posts/learning/_template.md posts/learning/dedekind-cut.md
```

The slug (`dedekind-cut`) is the filename and the URL. Lowercase, ASCII, hyphens, no
underscores — the build rejects anything else.

```markdown
---
title: Dedekind Cuts
created: 2026-07-31
updated: 2026-07-31
summary: Constructing the reals out of the rationals by cutting the line in two.
tags: analysis, construction of the reals
---

https://www.youtube.com/watch?v=XXXXXXXXXXX

## Transcript

The rationals are dense and still full of holes. There is no rational $q$ with
$q^2 = 2$, yet …

$$
A = \{\, q \in \mathbb{Q} : q < 0 \ \text{or}\ q^2 < 2 \,\}
$$

That question is [comparing infinities](/learning/infinity-comparison), and it has to be
settled first.
```

Three things about that file and nothing else matters:

- **The video is a bare URL alone on its own line.** No markdown link, no iframe. It
  auto-embeds as a responsive 16:9 player. YouTube (`youtube.com/watch?v=…`,
  `youtu.be/…`) and Bilibili (`bilibili.com/video/BV…`) both work. A URL that shares a
  line with anything else will *not* embed.
- **The transcript is ordinary markdown.** Inline maths in `$…$`, display maths in
  `$$…$$`, rendered by KaTeX. A literal dollar sign is `\$`. Footnotes (`[^id]` plus a
  `[^id]: …` line) work here exactly as in a post.
- **A link to another note is a root-absolute path**: `[text](/learning/<slug>)`, never a
  relative one and never `.html`. Those stay inside the app instead of reloading the page.

Leave `created` and `updated` as today's date; Claude backfills them from git after the
first commit.

### 2. Claude: wire it in

- adds the node to `learning.json` — `slug`, `file`, `title`, `created`, `updated`,
  `summary`, `tags` — every field matching the frontmatter. (`tags` is a comma-separated
  string in the frontmatter and a JSON **array** here. That is the one deliberate
  difference; `build_pages.py` warns about every other kind of drift.)
- adds any `edges` you asked for
- runs `python3 build_pages.py`, which writes `learning/dedekind-cut.html`
- previews it locally and shows you the result

### 3. Commits — two of them, never one

```
post(learning/dedekind-cut): Add Dedekind Cuts     ← the note. You write the body.
map: Add Dedekind cuts                             ← the map. Claude writes it. One line.
```

The body of the first one **is published**: the History panel renders it verbatim beside
the note. Write it as the note's own reason for existing, not as a note to the repo. The
second one never has a body — see below.

---

## Linking two notes

An edge means **leads to**: the note at the tail assumes, or opens onto, the note at the
head. Any note may point at any number of others.

```json
{ "from": "dedekind-cut", "to": "infinity-comparison" }
```

It shows up in three places at once: an arrow on the graph, a **Leads to** entry on
`dedekind-cut`, and a **Reached from** entry on `infinity-comparison`.

**A link in a note's prose and an edge on the map are different claims**, and neither
implies the other. Prose links are for reading; edges are the map's structure. Having one
without the other is allowed and sometimes right.

Cycles are fine. *A leads to B* and *B leads back to A* is a fair thing to say about two
notes; the graph lays them out on separate rows and draws both arrows.

Commit: `map: Link Dedekind cuts → Comparing infinities`

---

## Renaming, unlinking, removing

| what | what changes | commit |
|---|---|---|
| retitle a note | frontmatter `title` + the node's `title` | `post(learning/<slug>): …` + `map: Rename …` |
| change the slug | filename, node `slug` + `file`, every prose link to it, `commentary.json` key | `map: Rename <old> to <new>` |
| drop an edge | the `edges` entry | `map: Unlink A → B` |
| remove a note | the `.md`, the node, every edge touching it | `map: Remove <Title>` |

`build_pages.py` deletes the orphaned `learning/<slug>.html` on the next run, and removes
`learning/` entirely when the last note goes.

---

## Commit conventions, in one place

| touching | prefix | body | written by |
|---|---|---|---|
| `posts/learning/<slug>.md` | `post(learning/<slug>):` | **required**, published | **you** |
| `learning.json`, `posts/learning-map.md` | `map:` | none | Claude |
| `assets/`, `build_pages.py`, `index.html` | `site:` | none | Claude |

Never mix two kinds in one commit. A note's own change and the map entry that describes
it are two commits even when they happen in the same minute.

The order is fixed and does not get folded together: make the change → build and preview
→ **show you** → ask whether to commit → ask whether to push.

---

## Rereading a note later

`commentary.json` is the interpretation layer, and the only hand-written part of the
history. A note's readings are keyed `learning/<slug>` (a post's are keyed by its bare
slug):

```json
{ "learning/dedekind-cut": [
    { "sha": "a1b2c3d", "date": "2027-03-14", "note": "inline markdown" }
] }
```

The `sha` comes from `git log --format='%h %ad %s' --date=short -- posts/learning/<slug>.md`.
A commit can carry any number of dated readings. **Never edit or delete an old one** — a
rereading is a new entry, not a correction of the previous one. Claude does not write
these; they are your voice.

---

## Preview

```sh
python3 build_pages.py && python3 -m http.server 8000
```

- the index: <http://localhost:8000/learning-map.html>
- a note: <http://localhost:8000/learning/dedekind-cut.html>

`http.server` does not resolve extensionless paths, so locally you need the `.html`; on
GitHub Pages the same pages are `/learning-map` and `/learning/dedekind-cut`. Nothing is
wrong with the routing — `route()` strips the suffix and the page behaves identically.

The History panel shows **nothing until the commit is pushed** — it reads the GitHub API
live, and it only sees `main`. A panel showing stale commits after a push is the
`sessionStorage` cache: `sessionStorage.clear()`.

---

## Invariants — breaking any of these breaks the page silently

1. **A note is never added to `posts.json`.** It would appear on the home page and in the
   site-wide search, which is exactly what the map exists to avoid.
2. **`learning.json` and the frontmatter must agree.** `build_pages.py` warns on drift and
   refuses to build on a bad slug, a missing file, or an edge naming a node that is not in
   `nodes`. Do not commit a manifest edit without running it — an edge-only change
   regenerates no HTML, so `git status` will not remind you.
3. **The repo must stay public.** The History panel reads the GitHub API anonymously from
   the browser; a private repo means no history for every visitor, with no other symptom.
4. **Published history is append-only.** No rewriting, squashing, amending or force-pushing
   anything already pushed: every `sha` in `commentary.json` is pinned to a commit, and the
   panel's diffs are computed against the previous commit of the file.
