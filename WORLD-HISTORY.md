# The World History - how to run it

`/world-history` is a timeline of world history with a map beside it. It grows one event at
a time, as you learn them: you say what you learned, Claude files it.

> **Only what you have told Claude goes in.** No sample events, no "while we are here", no
> filling in a neighbouring century. The timeline is a record of what you have learned, and
> its gaps are part of that record.
>
> **Everything on the page is in English:** titles, countries, place names, summaries and
> details, whatever language the event was mentioned in.

## Adding an event

You say something like *"I just learned about the fall of Constantinople."* Claude then:

1. **Settles the facts.** The date, how long it lasted if it lasted, where it happened and
   the coordinates of those places. Anything not certain is looked up rather than guessed,
   and where historians disagree the file says so.
2. **Writes `posts/events/<slug>.md`** from `posts/events/_template.md`. The slug is the
   filename: lowercase kebab-case, ASCII (`fall-of-constantinople`).
3. **Runs `python3 build_pages.py`**, which checks the file and rewrites `events.json`.
4. **Previews it** and shows you: `http://localhost:8000/world-history.html#<slug>`.
5. **Asks whether to commit, then whether to push.** Two questions, never one.

You can add or change details at any time, in Obsidian or by telling Claude.

## The file

```markdown
---
title: Fall of Constantinople
start: 1453-04-06
end: 1453-05-29
countries:
  - Ottoman Empire
  - Byzantine Empire
map:
  - 41.01 28.98 Constantinople
summary: One line.
tags:
---

The details go here, in ordinary Markdown: footnotes, wikilinks and images work as in a post.
```

| field | required | what it is |
|---|---|---|
| `title` | yes | the name, in English |
| `start` | yes | when it began, or when it happened |
| `end` | no | when it ended; leave it empty for a moment in time, `present` if it has not ended |
| `countries` | yes | the countries or regions, as a list; searchable and shown beside the title |
| `map` | no | what to mark on the map, one line per mark; the build warns if it is empty |
| `summary` | no | one line, shown above the details and searched |
| `tags` | no | searched, not shown |

### Dates

`1453` · `1453-05` · `1453-05-29` · `221 BCE` · `44-03-15 BCE` · `c. 3100 BCE`

Write the date as precisely as it is known and no further. `c.` marks it approximate, and
the page then says *about 80 years* rather than *80 years*. A bare year goes in quotes
(`start: "1453"`): YAML reads it as a number, and Obsidian then marks the field as the wrong
type. The build takes it either way.

There is no year 0, and the build refuses one: 1 BCE is followed by 1 CE, and durations across
the two are counted that way. It also refuses a span that ends before it starts, which catches
a BCE range written backwards, anything in the future, and a 29 February in a year that had
none. Durations count days on the Julian calendar before 15 October 1582 and on the Gregorian
from then on.

### Marks on the map

Each line of `map` is one mark. Latitude first, as a map application copies it; south and
west are negative. A name is optional.

| a line like | draws |
|---|---|
| `41.01 28.98 Constantinople` | a place |
| `32.06 118.78 Nanjing → 2.20 102.25 Malacca → 11.25 75.77 Calicut` | a route, in the order travelled, with an arrow at the end |
| `area 34 108 Tang → 40 116 → 30 120 → 22 110` | a region, named by its first corner, drawn as a soft shape |

A route may cross the date line and is drawn off one edge of the world and back on at the
other. `->` works as well as `→`; other arrows and decimal commas are refused rather than
swallowed into a name. Do not put a `: ` in a line, or YAML reads it as a mapping and Obsidian
shows the whole field as invalid.

### What the build refuses

The frontmatter stays in the narrow form Obsidian writes: `key: value`, or `key:` with `- item`
lines under it. A value stays on one line, and one holding `: ` or starting with a YAML symbol
goes in quotes. Anything else stops the build and names the line, because a line it skipped
would be a date or a place quietly lost. A field it does not use, in any language, is only
warned about and left alone.

## What the page does with it

- **Each year with a record is one tick.** The space between ticks grows with the log of the
  years between them, so order is true and distance is only a hint. A gap of a century or
  more is dashed and says how long it is. Because of that a bar's length cannot be read as a
  duration, so a bar states its duration in words.
- **Hover a year:** a card lists what happened then and what was already under way anywhere
  in the world, the map marks all of it, and the year shows in the map's corner. **Click:** the
  card stays and can be chosen from, or, if there is only one event, that event opens. **Click a
  bar:** that span opens.
- **An opened event** flies the map to it and shows its details under the map, and its URL is
  `/world-history#<slug>`, which can be shared. `[[fall-of-constantinople]]` from any post or
  any other event opens it the same way. Esc closes the event, then the card.
- **The map at rest** shows one faint point for every event, so it fills in as you learn. It
  has coasts, rivers and lakes and deliberately no borders: a modern border under a medieval
  event would be wrong, and borders are what the timeline is about.
- A search box appears once there are eight events. It narrows the axis to what matches, so
  searching a country gives that country's own timeline. Countries on an opened event are
  links into it.
- When too many spans overlap to fit, the lanes narrow and the bars drop their duration labels;
  the card still gives every duration. On a phone the map rides at the top, the axis scrolls
  under it, and an opened event comes up from the bottom.

## Commits

| touching | prefix | body | written by |
|---|---|---|---|
| a new event, or its frontmatter (`events.json` goes with it) | `event:` | none | Claude |
| the details, when you write them and want to say why | `post(events/<slug>):` | **yours, and published** | you |
| `assets/`, `build_pages.py`, this file | `site:` | none | Claude |

```
event: Add Fall of Constantinople
event: Correct the date of Fall of Constantinople
post(events/fall-of-constantinople): Add what Mehmed did with the ships
```

The page's History rail lists the commits of `posts/events/` and `posts/world-history.md`,
so it reads as the order you learned things in, beside the timeline's order of when they
happened. Readings in `commentary.json` are keyed `world-history`.

Never mix kinds in one commit. `events.json` is generated: never edit it by hand, and always
commit it with the event that changed it.

## Preview

```sh
python3 build_pages.py && python3 -m http.server 8000
```

Open <http://localhost:8000/world-history.html>. The History rail shows nothing until a
commit is pushed.

## Invariants

1. **Only events you asked for.** Test data never goes in `posts/events/`; to try something
   out, work on a copy of the site outside the repo.
2. **Events are never listed in `posts.json`.** They would turn up in the home list.
3. **The build is the gate.** It refuses a bad date, an impossible coordinate, a missing title
   or a missing `countries`. Run it before every commit, because `events.json` is what the
   page reads and nothing else writes it.
4. **Slugs do not change lightly.** A slug is the filename, the URL, and the target of every
   `[[wikilink]]` to it, and renaming a file cuts its git history in two.

## The map data

`assets/world.json` is Natural Earth 1:50m land, lakes and rivers (public domain), simplified
with mapshaper and packed as delta-coded rings in hundredths of a degree. It comes from the
`ne_50m_land` source rather than world-atlas' `land-50m`: the latter has its rings stitched
across the date line for spherical clipping, and on this flat projection each stitched edge
draws a line across the world. It is a one-time vendored file; regenerate it only if the map
itself needs to change.

The reasoning behind all of this, and what not to simplify, is in
[`CLAUDE.md`](./CLAUDE.md) under *The world history*.
