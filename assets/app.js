/* ---- config: edit these two lines ---- */
const SITE = {
  name: "方皓天",           // 页头显示的中文名
  pinyin: "Fāng Hàotiān",   // 名字上方的注音
  enName: "Haotian Fang",   // 用于浏览器标签 + 页脚
};

/* fixed category order + labels (must match `category` in posts.json) */
const CATS = ["Information Theory", "Complex System", "History of Philosophy", "Others"];

/* four corner quotes: tl, tr, bl, br (row-major) */
const QUOTES = [
  {
    pos: "tl", lang: "zh",
    lines: [
      "錦瑟無端五十弦，一弦一柱思華年。",
      "莊生曉夢迷蝴蝶，望帝春心托杜鵑。",
      "滄海月明珠有淚，藍田日暖玉生煙。",
      "此情可待成追憶，只是當時已惘然。",
    ],
    cite: "李商隱 ·《錦瑟》",
    post: "write-your-own-history",
  },
  {
    pos: "tr", lang: "fa",
    lines: [
      "بنی‌آدم اعضای یکدیگرند",
      "که در آفرینش ز یک گوهرند",
      "چو عضوی به درد آورد روزگار",
      "دگر عضوها را نماند قرار",
      "تو کز محنت دیگران بی‌غمی",
      "نشاید که نامت نهند آدمی",
    ],
    cite: "سعدی شیرازی · گلستان",
  },
  {
    pos: "bl", lang: "en",
    lines: ["When everything else has gone from my brain — the President’s name, the state capitals, the neighborhoods where I lived, and then my own name and what it was on earth I sought, and then at length the faces of my friends, and finally the faces of my family — when all this has dissolved, what will be left, I believe, is topology: the dreaming memory of land as it lay this way and that."],
    cite: "Annie Dillard · An American Childhood",
  },
];

/* the record lives in git; this is where it is read from */
const REPO = "fhtttt/personal_website";

/* ---- the learning map ----
   One post (`/learning-map`) is an index rather than an essay: its body is followed by
   a searchable graph of atomic notes. The notes live in their own manifest, NOT in
   posts.json — that is the whole reason they never show up in the home list or the
   site-wide search. They are served from /learning/<slug>. */
const MAP_SLUG = "learning-map";
const MAP_FILE = "learning.json";
const NOTE_DIR = "learning";

/* Every lookup table below is keyed by a slug, and a slug is whatever is written in
   posts.json or learning.json. `{}` answers `t["constructor"]` with an inherited
   function even when nothing was ever stored there, which turns a plausible slug into
   a crash or a phantom match. A prototype-less object answers only what was put in it. */
function bare() { return Object.create(null); }

const app = document.getElementById("app");
const PAGE_SIZE = 10;
const state = {
  posts: [], query: "", cat: "all", page: 0, bodies: bare(), excerpts: bare(), bodiesLoaded: false,
  commentary: null, hist: null,
  map: { nodes: [], edges: [] },
  mapQuery: "", mapBodies: bare(), mapExcerpts: bare(), mapBodiesLoaded: false, mapHits: null,
};

boot();

async function boot() {
  const [posts, map] = await Promise.all([
    fetchJSON("/posts.json"),
    fetchJSON("/" + MAP_FILE),
  ]);
  state.posts = Array.isArray(posts) ? posts : [];
  state.map = normalizeMap(map);
  window.addEventListener("popstate", route);
  document.addEventListener("click", onNavClick);
  /* the graph's edges are drawn from measured node boxes, so they have to be
     redrawn whenever the boxes move — reflow on resize, and again once the
     webfonts land and change every text metric on the page */
  window.addEventListener("resize", scheduleEdges);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleEdges);
  route();
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

/* tolerate a missing or half-written manifest: an absent map must degrade to an
   empty graph, never to a page that fails to render */
function normalizeMap(m) {
  const nodes = m && Array.isArray(m.nodes) ? m.nodes.filter(n => n && n.slug) : [];
  const known = bare(), once = bare();
  nodes.forEach(n => { known[n.slug] = true; });
  /* `=== true`, not a truthiness test: a plain object answers `known["toString"]` with
     an inherited function, and a typo like that would sail through as a real node */
  const edges = m && Array.isArray(m.edges) ? m.edges.filter(e => {
    if (!e || known[e.from] !== true || known[e.to] !== true || e.from === e.to) return false;
    const k = e.from + ">" + e.to;
    if (once[k] === true) return false;          // the same relation stated twice
    once[k] = true;
    return true;
  }) : [];
  return { nodes, edges };
}

function mapNode(slug) {
  const ns = state.map.nodes;
  for (let i = 0; i < ns.length; i++) if (ns[i].slug === slug) return ns[i];
  return null;
}
function noteFile(slug) {
  const n = mapNode(slug);
  return n && n.file ? n.file : "posts/" + NOTE_DIR + "/" + slug + ".md";
}
function noteHref(slug) { return "/" + NOTE_DIR + "/" + encodeURIComponent(slug); }

/* clean URLs: /<slug> is served from the generated <slug>.html, so it is a real
   200 — refresh-safe, crawlable, no trailing slash. ?post=<slug> still resolves,
   for links shared before this scheme. */
/* WebKit fires popstate for in-page fragment navigation (`#fn-1`), Blink does not.
   Without this guard a footnote tap on iOS re-rendered the whole post and scrolled
   to the top, so the anchor never stuck. Only re-render when the page itself changed. */
let rendered = null;
function route() {
  const path = location.pathname.replace(/^\/+|\/+$/g, "").replace(/\.html$/, "");
  const qs = new URLSearchParams(location.search);
  /* /learning/<slug> — one level of nesting, and only this one */
  const inDir = path.indexOf(NOTE_DIR + "/") === 0 ? path.slice(NOTE_DIR.length + 1) : "";
  const note = qs.get("note") || (inDir && !inDir.includes("/") ? decodeURIComponent(inDir) : "");
  const slug = qs.get("post")
    || (path && !path.includes("/") ? decodeURIComponent(path) : "");
  const key = location.pathname + location.search;
  if (key === rendered) return;
  rendered = key;
  if (note) renderNote(note);
  else if (slug) renderPost(slug);
  else renderHome();
  window.scrollTo(0, 0);
}
function go(url) { history.pushState(null, "", url); route(); }
function onNavClick(e) {
  /* cmd/ctrl/shift/alt-click and middle-click are the reader asking for a new tab or
     window; taking them over navigates this one instead and loses their place. Checked
     first, so it holds for the app's own links too, not only for links found in prose. */
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest("a");
  if (!a || a.target || a.hasAttribute("download")) return;
  if ("post" in a.dataset) { e.preventDefault(); go("/" + encodeURIComponent(a.dataset.post)); return; }
  if ("note" in a.dataset) { e.preventDefault(); go(noteHref(a.dataset.note)); return; }
  if ("home" in a.dataset) { e.preventDefault(); go("/"); return; }
  /* a note's prose links to other notes as plain markdown — [x](/learning/y). Take
     those over, but only those: a link this router cannot resolve must stay the
     browser's, or it turns into "Post not found" at a URL the server would have served. */
  const href = a.getAttribute("href") || "";
  if (href.charAt(0) !== "/" || href.charAt(1) === "/") return;
  if (href.indexOf("#") >= 0) return;                    // let anchors scroll natively
  if (href === location.pathname + location.search) return;   // a link to this very page
  if (!routable(href)) return;
  e.preventDefault();
  go(href);
}

/* the three shapes route() understands: home, a listed post, a note of the map */
function routable(href) {
  const path = href.split("?")[0].replace(/^\/+|\/+$/g, "").replace(/\.html$/, "");
  if (!path) return true;
  if (path.indexOf(NOTE_DIR + "/") === 0) {
    const s = path.slice(NOTE_DIR.length + 1);
    return !!s && !s.includes("/");
  }
  if (path.includes("/")) return false;
  const slug = decodeURIComponent(path);
  return state.posts.some(p => p.slug === slug);
}

/* ---------- home ---------- */
function renderHome() {
  document.title = SITE.enName;
  document.body.classList.remove("post");
  app.innerHTML = `
    <div class="namewrap">
      <span class="pinyin">${esc(SITE.pinyin)}</span>
      <span class="name">${esc(SITE.name)}</span>
    </div>
    <div class="bio">
      <p>An architect of complex systems</p>
      <p>A theorist who insists on interpretability</p>
      <p class="tc">一個廿一世紀的楚地巫史</p>
    </div>
    <p class="links">
      <a href="https://www.linkedin.com/in/haotian-fang-354933254/" target="_blank" rel="noopener">LinkedIn</a>
    </p>
    <p class="creed">I study how to be a good listener.</p>

    <section class="section">
      <h2>La tour d’ivoire avant midi</h2>
      <div class="acad">
        <div class="item">
          <div class="yrs">2020-2024</div>
          <div class="body">
            <p class="deg">Philosophy (minor in Physics), History and Philosophy of Science, Computer Science</p>
            <p class="sub">University of Pittsburgh · advised by Paolo Palmieri (History, Philosophy, Science) and Lynne Sunderman (Language, Writing)</p>
          </div>
        </div>
        <div class="item">
          <div class="yrs">2024-2027</div>
          <div class="body">
            <p class="deg">Digital Humanities</p>
            <p class="sub">EPFL (School of Computer and Communication Sciences) · advised by Frédéric Kaplan (Digital Humanities) and Rüdiger Urbanke (Information Theory)</p>
          </div>
        </div>
      </div>
      <p class="sec-contact">haotian.fang@epfl.ch</p>
    </section>

    <section class="section">
      <h2>Uncorrelated bets on the world</h2>
      <div class="acad">
        <div class="item">
          <div class="yrs">2025–</div>
          <div class="body">
            <p class="deg"><a href="https://stegamatter.com" target="_blank" rel="noopener">StegaMatter</a></p>
            <p class="sub">Co-founder & COO</p>
            <p class="sub">haotian@stegamatter.com</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2>Selected contexts for public sphere</h2>
      <div class="controls">
        <input id="search" type="search" placeholder="Search…" value="${esc(state.query)}" autocomplete="off">
        <div class="cats">
          <button class="cat ${state.cat === "all" ? "active" : ""}" data-cat="all">All</button>
          ${CATS.map(c => `<button class="cat ${state.cat === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
        </div>
      </div>
      <div id="list"></div>
    </section>

    ${renderEpigraphs()}

    <section class="section">
      <h2>What came through</h2>
      <div class="acad epiph">
        <div class="item">
          <div class="yrs">Age 15</div>
          <div class="body">
            <p class="deg">that love can fabricate a fact more factual than the facts.</p>
          </div>
        </div>
        <div class="item">
          <div class="yrs">Age 25</div>
          <div class="body">
            <p class="deg">that the in-time manifestation of humanity can be anything at all, but never reason — reason is always post hoc; and that reason can still retrain your humanity afterwards, by rote memorization.</p>
          </div>
        </div>
      </div>
    </section>

    <div class="footer">© <span id="yr"></span> ${esc(SITE.enName)}</div>
  `;

  document.getElementById("yr").textContent = new Date().getFullYear();

  const search = document.getElementById("search");
  search.addEventListener("input", e => { state.query = e.target.value; state.page = 0; renderList(); });
  app.querySelectorAll(".cat").forEach(b =>
    b.addEventListener("click", () => {
      state.cat = b.dataset.cat;
      state.page = 0;
      app.querySelectorAll(".cat").forEach(x => x.classList.toggle("active", x.dataset.cat === state.cat));
      renderList();
    })
  );

  renderList();
  ensureBodies();   // 后台抓正文，建全文搜索索引
}

/* fetch every post body once so search can match article content, not just titles */
async function ensureBodies() {
  if (state.bodiesLoaded) return;
  state.bodiesLoaded = true;
  await Promise.all(state.posts.map(async p => {
    if (p.unlisted === true) return;   // filtered() can never surface it, so never index it
    try {
      const res = await fetch("/" + p.file);
      if (!res.ok) return;
      const { body } = parseFrontmatter(await res.text());
      state.bodies[p.slug] = toPlain(body);        // 全文，用于搜索匹配
      state.excerpts[p.slug] = toPlain(leadText(body));   // 首页摘要只要正文本身
    } catch (e) {}
  }));
  if (document.getElementById("list")) renderList();
}

function renderEpigraphs() {
  /* a quote may carry `post: "<slug>"` — then its citation links to that article */
  const cite = q => q.post
    ? `<a data-post="${esc(q.post)}" href="/${encodeURIComponent(q.post)}">${esc(q.cite)}</a>`
    : esc(q.cite);
  const cell = q => `
        <figure class="epi epi-${q.lang}" lang="${q.lang}"${q.lang === "fa" ? ' dir="rtl"' : ""}>
          <blockquote>${q.lines.map(esc).join("<br>")}</blockquote>
          <figcaption>${cite(q)}</figcaption>
        </figure>`;
  const byLang = l => QUOTES.find(q => q.lang === l);
  const blessing = `
        <figure class="epi epi-ja" lang="ja">
          <div class="bl-body">
            <p class="bl-sm aoko">「私だって鬼じゃないわ。ほら、こっち向いて。おまじない、かけてあげる」</p>
            <p class="bl-lg aoko">「──空気のおもり、胸のふるえ。<br>ひかりは先立つ、かげは遅れる」<br>「鳥は空に、魚は海に、貴方は彼方に。<br>疑問も不安も鞄の底に、旅路の一歩は曙に。<br>輝く星はするりと落ちて、今は貴方の心の内に」</p>
            <p class="bl-sm usu">「‥‥‥はあ。そこは“空気のおもり、胸のふるえ。ひかりは遅れる、かげは先立つ”よ。気をつけなさい。それだと逆に落ち着かなくなるわ」</p>
          </div>
          <figcaption>奈須きのこ『魔法使いの夜』</figcaption>
        </figure>`;
  return `
    <section class="section epigraphs">
      <h2>A borrowed peep-show of the interior</h2>
      <div class="epi-col">
        ${cell(byLang("zh"))}
        ${blessing}
      </div>
      <div class="epi-col">
        ${cell(byLang("en"))}
        ${cell(byLang("fa"))}
      </div>
    </section>`;
}

function renderList() {
  const list = document.getElementById("list");
  const q = state.query.trim();
  const all = filtered();
  if (!all.length) {
    list.innerHTML = `<p class="empty">No posts found.</p>`;
    return;
  }
  const pages = Math.ceil(all.length / PAGE_SIZE);
  state.page = Math.min(Math.max(0, state.page), pages - 1);
  const items = all.slice(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE);

  const rows = items.map(p => {
    const preview = q ? buildSnippet(p, q) : excerpt(p);
    return `<li><a class="row" data-post="${esc(p.slug)}" href="/${encodeURIComponent(p.slug)}">
      <span class="date">${esc(p.created || "")}</span>
      <span class="rowmain">
        <span class="title">${hl(p.title, q)}</span>
        ${preview ? `<span class="snippet">${preview}</span>` : ""}
      </span>
      <span class="tag">${esc(p.category || "")}</span>
    </a></li>`;
  }).join("");

  const pager = pages > 1 ? `
    <div class="pager">
      <button class="pg" data-pg="-1" ${state.page === 0 ? "disabled" : ""} aria-label="Previous page">‹</button>
      <span class="pg-info">${state.page + 1} / ${pages}</span>
      <button class="pg" data-pg="1" ${state.page >= pages - 1 ? "disabled" : ""} aria-label="Next page">›</button>
    </div>` : "";

  list.innerHTML = `<ul class="list">${rows}</ul>${pager}`;
  list.querySelectorAll(".pg").forEach(b =>
    b.addEventListener("click", () => {
      state.page += Number(b.dataset.pg);
      renderList();
      const c = document.querySelector(".controls");
      if (c) c.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );
}

/* a post usually opens with an epigraph; the list should show what the post itself
   says, so skip leading quotes/headings/rules/images and start at the first prose
   paragraph. Headings and rules are dropped throughout; the rest is joined until
   there is comfortably more than one excerpt's worth of text. */
function leadText(md) {
  const blocks = md.replace(/```[\s\S]*?```/g, "").split(/\n\s*\n/);
  const skip = t => {
    const c = t.charAt(0);
    return c === ">" || c === "!" || c === "|";        // quote, image, table
  };
  const drop = t => t.charAt(0) === "#" || /^([-*_])\s*\1\s*\1/.test(t);  // heading, rule
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const t = blocks[i].trim();
    if (!t || drop(t)) continue;
    if (!out.length && skip(t)) continue;
    out.push(t);
    if (out.join(" ").length > 200) break;
  }
  return out.join(" ");
}

/* first ~120 chars of the article body (falls back to summary before bodies load) */
function excerpt(p, store) {
  const src = (store || state.excerpts)[p.slug] || p.summary || "";
  if (!src) return "";
  const n = 120;
  if (src.length <= n) return esc(src);
  return esc(src.slice(0, n).replace(/\s+\S*$/, "")) + " …";
}

/* markdown → rough plain text, for search matching + snippet display */
function toPlain(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")            // code blocks
    .replace(/`[^`]*`/g, " ")                    // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")       // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")     // links → link text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")          // headings
    .replace(/[>*_~#`]/g, " ")                   // leftover md punctuation
    .replace(/\$\$?([^$]*)\$\$?/g, "$1")         // math delimiters, keep content
    // …then drop the TeX control words the math left behind: a transcript is mostly
    // formulae, and a snippet reading "x 1, x 2, \dots" helps nobody
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* escape, then wrap query matches in <mark> */
function hl(text, q) {
  const e = esc(text);
  if (!q) return e;
  const rx = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
  return e.replace(rx, "<mark>$1</mark>");
}

/* a highlighted window of context around the first match (body, else summary) */
function buildSnippet(p, q, store) {
  const ql = q.toLowerCase();
  let src = (store || state.bodies)[p.slug] || "";
  let i = src.toLowerCase().indexOf(ql);
  if (i < 0) { src = p.summary || ""; i = src.toLowerCase().indexOf(ql); }
  if (i < 0) return "";                            // match was only in title/tags
  const r = 80;
  const start = Math.max(0, i - r), end = Math.min(src.length, i + q.length + r);
  const s = (start > 0 ? "… " : "") + src.slice(start, end) + (end < src.length ? " …" : "");
  return hl(s, q);
}

/* An unlisted post is served, routed and linkable exactly like any other one; what it
   is kept out of is the two places the site *offers* a post — the home list and the
   site-wide search. Both read this function, so this one line is the whole gate.
   `renderPost()` and `resolveWiki()` deliberately ignore the flag: a wikilink pointing
   at an unlisted post has to keep working, or hiding a post would quietly rot the prose
   of every post that cites it. `=== true`, not truthiness, for the reason bare() exists. */
function filtered() {
  const q = state.query.trim().toLowerCase();
  return state.posts
    .filter(p => {
      if (p.unlisted === true) return false;
      const okCat = state.cat === "all" || p.category === state.cat;
      const tags = Array.isArray(p.tags) ? p.tags.join(" ") : (p.tags || "");
      const hay = `${p.title} ${p.summary || ""} ${p.category || ""} ${tags} ${state.bodies[p.slug] || ""}`.toLowerCase();
      return okCat && (!q || hay.includes(q));
    })
    .sort((a, b) => String(b.created || "").localeCompare(String(a.created || "")));
}

/* ---------- article ---------- */
async function renderPost(slug) {
  const at = rendered;                  // the page this render belongs to
  const post = state.posts.find(p => p.slug === slug);
  const file = post ? post.file : `posts/${slug}.md`;
  let raw = "";
  try {
    const res = await fetch("/" + file, { cache: "no-cache" });
    if (res.ok) raw = await res.text();
  } catch (e) {}
  if (at !== rendered) return;          // navigated away while the markdown loaded

  document.body.classList.add("post");

  if (!raw) {
    app.innerHTML = `<a class="back" data-home href="/">← Back</a><p class="empty">Post not found.</p>`;
    return;
  }

  const { meta, body } = parseFrontmatter(raw);
  const title = (post && post.title) || meta.title || slug;
  const created = meta.created || (post && post.created) || "";
  const updated = meta.updated || (post && post.updated) || "";
  const cat = meta.category || (post && post.category) || "";
  const isMap = slug === MAP_SLUG;
  document.title = title;

  app.innerHTML = `
    <a class="back" data-home href="/">← Back</a>
    <div class="post-wrap">
      <article>
        <h1>${esc(title)}</h1>
        <div class="post-meta">
          ${created ? `<span>${esc(created)}</span>` : ""}
          ${updated && updated !== created ? ` · updated ${esc(updated)}` : ""}
          ${cat ? ` · ${esc(cat)}` : ""}
        </div>
        <div class="prose">${renderMarkdown(body)}</div>
        ${isMap ? mapShell() : ""}
      </article>
      <aside class="rail">
        <h2>History</h2>
        <div id="rail-body" class="rail-body"><p class="empty">Loading…</p></div>
      </aside>
      <div id="rev-detail" class="rev-detail"></div>
    </div>
    <div class="footer"><a data-home href="/">← All posts</a></div>
  `;

  if (isMap) initMap();
  /* the index is two files — the prose and the manifest the graph is drawn from —
     and both belong to its record, so the rail merges the commits of each */
  renderHistory(slug, isMap ? [file, MAP_FILE] : [file]);
  scrollToHash();
}

/* Arriving at /post#heading, the browser looks for the anchor at load time — before
   the markdown has been fetched, so there is nothing to find and it stays at the top.
   Every render therefore re-honours the fragment itself, once the content exists. */
function scrollToHash() {
  if (!location.hash) return;
  let id = location.hash.slice(1);
  try { id = decodeURIComponent(id); } catch (e) {}
  const el = document.getElementById(id);
  if (el) el.scrollIntoView();
}

/* ---------- a note of the learning map ---------- */
async function renderNote(slug) {
  const at = rendered;
  const node = mapNode(slug);
  const file = noteFile(slug);
  let raw = "";
  try {
    const res = await fetch("/" + file, { cache: "no-cache" });
    if (res.ok) raw = await res.text();
  } catch (e) {}
  if (at !== rendered) return;

  document.body.classList.add("post");

  const back = `<a class="back" data-post="${MAP_SLUG}" href="/${MAP_SLUG}">← Learning Map</a>`;
  if (!raw) {
    app.innerHTML = back + `<p class="empty">Note not found.</p>`;
    return;
  }

  const { meta, body } = parseFrontmatter(raw);
  const title = (node && node.title) || meta.title || slug;
  const created = meta.created || (node && node.created) || "";
  const updated = meta.updated || (node && node.updated) || "";
  document.title = title;

  app.innerHTML = `
    ${back}
    <div class="post-wrap">
      <article>
        <h1>${esc(title)}</h1>
        <div class="post-meta">
          <span class="kicker">Learning Map</span>
          ${created ? ` · <span>${esc(created)}</span>` : ""}
          ${updated && updated !== created ? ` · updated ${esc(updated)}` : ""}
        </div>
        <div class="prose">${renderMarkdown(body)}</div>
        ${connections(slug)}
      </article>
      <aside class="rail">
        <h2>History</h2>
        <div id="rail-body" class="rail-body"><p class="empty">Loading…</p></div>
      </aside>
      <div id="rev-detail" class="rev-detail"></div>
    </div>
    <div class="footer"><a data-post="${MAP_SLUG}" href="/${MAP_SLUG}">← Learning Map</a></div>
  `;

  /* a note keeps its own record, on the ordinary rules; its readings are keyed
     `learning/<slug>` in commentary.json so they cannot collide with a post's */
  renderHistory(NOTE_DIR + "/" + slug, [file]);
  scrollToHash();
}

/* the edges of the map, seen from one node: what it opens onto, and what opened
   onto it. Drawn from learning.json, not from the links in the prose. */
function connections(slug) {
  const out = state.map.edges.filter(e => e.from === slug).map(e => e.to);
  const back = state.map.edges.filter(e => e.to === slug).map(e => e.from);
  if (!out.length && !back.length) return "";
  const link = s => {
    const n = mapNode(s);
    return `<li><a data-note="${esc(s)}" href="${noteHref(s)}">${esc(n && n.title ? n.title : s)}</a>${
      n && n.summary ? `<span class="conn-sum">${esc(n.summary)}</span>` : ""}</li>`;
  };
  const block = (label, arr, cls) => arr.length
    ? `<div class="conn-block ${cls}"><h3>${label}</h3><ul>${arr.map(link).join("")}</ul></div>` : "";
  return `<section class="conns">
    ${block("Leads to", out, "conn-out")}
    ${block("Reached from", back, "conn-in")}
  </section>`;
}

/* ---------- the map itself: one search box over the notes, one graph ----------
   The same search the home page runs, pointed at a different corpus. An empty
   query shows the graph alone; a query puts the matching notes above it and dims
   every node the query does not reach, so the two views answer together. */
function mapShell() {
  const n = state.map.nodes.length;
  return `
    <section class="section mapsec">
      <h2>The map</h2>
      <div class="controls">
        <input id="map-search" type="search" placeholder="Search the notes…" value="${esc(state.mapQuery)}" autocomplete="off">
        <span class="map-count" id="map-count">${n} note${n === 1 ? "" : "s"}</span>
      </div>
      <div id="map-list" class="map-list"></div>
      <div class="graph-wrap"><div id="graph" class="graph"><div class="gedges"></div></div></div>
    </section>`;
}

function initMap() {
  /* the query survives navigation, the same way the home page's does — mapShell()
     has already put it back in the box, so clearing it here would desync the two */
  renderGraph();
  const s = document.getElementById("map-search");
  if (s) s.addEventListener("input", e => { state.mapQuery = e.target.value; renderMapList(); });
  renderMapList();
  ensureMapBodies();
}

/* same idea as ensureBodies(), against learning.json instead of posts.json */
async function ensureMapBodies() {
  if (state.mapBodiesLoaded) return;
  state.mapBodiesLoaded = true;
  await Promise.all(state.map.nodes.map(async n => {
    try {
      const res = await fetch("/" + (n.file || noteFile(n.slug)));
      if (!res.ok) return;
      const { body } = parseFrontmatter(await res.text());
      state.mapBodies[n.slug] = toPlain(body);
      state.mapExcerpts[n.slug] = toPlain(leadText(body));
    } catch (e) {}
  }));
  if (document.getElementById("map-list")) renderMapList();
}

function mapMatches() {
  const q = state.mapQuery.trim().toLowerCase();
  return state.map.nodes.filter(n => {
    if (!q) return true;
    const tags = Array.isArray(n.tags) ? n.tags.join(" ") : (n.tags || "");
    const hay = `${n.title || ""} ${n.summary || ""} ${tags} ${state.mapBodies[n.slug] || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderMapList() {
  const list = document.getElementById("map-list");
  if (!list) return;
  const q = state.mapQuery.trim();
  const hits = mapMatches();
  const total = state.map.nodes.length;
  const count = document.getElementById("map-count");
  if (count) count.textContent = q
    ? `${hits.length} of ${total}`
    : `${total} note${total === 1 ? "" : "s"}`;

  if (!q) {
    list.innerHTML = "";
    highlightGraph(null);
    return;
  }
  if (!hits.length) {
    list.innerHTML = `<p class="empty">No note matches “${esc(q)}”.</p>`;
    highlightGraph({});
    return;
  }
  const rows = hits.map(n => {
    const preview = buildSnippet(n, q, state.mapBodies) || excerpt(n, state.mapExcerpts);
    return `<li><a class="row" data-note="${esc(n.slug)}" href="${noteHref(n.slug)}">
      <span class="date">${esc(n.created || "")}</span>
      <span class="rowmain">
        <span class="title">${hl(n.title || n.slug, q)}</span>
        ${preview ? `<span class="snippet">${preview}</span>` : ""}
      </span>
    </a></li>`;
  }).join("");
  list.innerHTML = `<ul class="list">${rows}</ul>`;

  const set = bare();
  hits.forEach(n => { set[n.slug] = true; });
  highlightGraph(set);
}

function highlightGraph(set) {
  const box = document.getElementById("graph");
  if (!box) return;
  box.classList.toggle("filtering", !!set);
  box.querySelectorAll(".gnode").forEach(el =>
    el.classList.toggle("hit", !set || !!set[el.getAttribute("data-note")])
  );
  state.mapHits = set;
  drawEdges();
}

/* layered layout: layer = longest path from a root, so an edge always points
   downward; order inside a layer is settled by a few barycentre sweeps, which is
   enough to keep the lines from crossing on a map of this size. */
function graphLayers() {
  const nodes = state.map.nodes, edges = state.map.edges;
  const idx = bare();
  nodes.forEach((n, i) => { idx[n.slug] = i; });
  const all = [];
  edges.forEach(e => {
    const a = idx[e.from], b = idx[e.to];
    if (typeof a !== "number" || typeof b !== "number") return;   // never an inherited key
    all.push([a, b]);
  });

  /* "A leads to B" and "B leads back to A" are both fair things to say about two
     notes, but a cycle has no longest path. Find the edges that close one — a DFS
     edge landing on a node still on the stack — and layer without them. They are
     still drawn; they just point back up. */
  const mark = nodes.map(() => 0);              // 0 unseen · 1 on the stack · 2 done
  const adj = nodes.map(() => []);
  all.forEach(p => adj[p[0]].push(p[1]));
  const back = bare();
  const walk = i => {
    mark[i] = 1;
    adj[i].forEach(j => {
      if (mark[j] === 1) back[i + ">" + j] = true;
      else if (mark[j] === 0) walk(j);
    });
    mark[i] = 2;
  };
  for (let i = 0; i < nodes.length; i++) if (!mark[i]) walk(i);

  const outs = nodes.map(() => []), ins = nodes.map(() => []), deg = nodes.map(() => 0);
  all.forEach(p => {
    if (back[p[0] + ">" + p[1]]) return;
    outs[p[0]].push(p[1]); ins[p[1]].push(p[0]); deg[p[1]]++;
  });

  const layer = nodes.map(() => 0);
  let q = [];
  for (let i = 0; i < nodes.length; i++) if (!deg[i]) q.push(i);
  while (q.length) {
    const next = [];
    q.forEach(i => {
      outs[i].forEach(j => {
        if (layer[j] < layer[i] + 1) layer[j] = layer[i] + 1;
        if (--deg[j] === 0) next.push(j);
      });
    });
    q = next;
  }

  let maxL = 0;
  layer.forEach(l => { if (l > maxL) maxL = l; });
  const layers = [];
  for (let l = 0; l <= maxL; l++) layers.push([]);
  nodes.forEach((n, i) => layers[layer[i]].push(i));

  const pos = nodes.map(() => 0);
  const settle = () => layers.forEach(L => L.forEach((i, k) => { pos[i] = k; }));
  const bary = (nb, self) => {
    if (!nb.length) return self;
    let s = 0;
    nb.forEach(j => { s += pos[j]; });
    return s / nb.length;
  };
  settle();
  for (let sweep = 0; sweep < 4; sweep++) {
    for (let l = 1; l < layers.length; l++) {
      layers[l].sort((a, b) => bary(ins[a], pos[a]) - bary(ins[b], pos[b]));
      settle();
    }
    for (let l = layers.length - 2; l >= 0; l--) {
      layers[l].sort((a, b) => bary(outs[a], pos[a]) - bary(outs[b], pos[b]));
      settle();
    }
  }
  return layers.map(L => L.map(i => nodes[i]));
}

function renderGraph() {
  const box = document.getElementById("graph");
  if (!box) return;
  if (!state.map.nodes.length) {
    box.innerHTML = `<p class="empty">The map is empty.</p>`;
    return;
  }
  const layers = graphLayers();
  const cell = n => `
    <a class="gnode hit" data-note="${esc(n.slug)}" href="${noteHref(n.slug)}">
      <span class="gtitle">${esc(n.title || n.slug)}</span>
      ${n.summary ? `<span class="gsum">${esc(n.summary)}</span>` : ""}
    </a>`;
  box.innerHTML = `<div class="gedges"></div>` +
    layers.filter(L => L.length)
          .map(L => `<div class="glayer">${L.map(cell).join("")}</div>`).join("");
  scheduleEdges();
}

/* Edges are drawn from the boxes the browser actually laid out, not from a
   geometry computed here — that way the graph stays responsive and the curves
   keep meeting the nodes after a resize or a late webfont. */
let edgeTimer = null;
function scheduleEdges() {
  if (edgeTimer) clearTimeout(edgeTimer);
  edgeTimer = setTimeout(() => { edgeTimer = null; drawEdges(); }, 60);
}

function drawEdges() {
  const box = document.getElementById("graph");
  if (!box) return;
  const layer = box.querySelector(".gedges");
  if (!layer) return;
  const at = bare();
  box.querySelectorAll(".gnode").forEach(el => {
    at[el.getAttribute("data-note")] = {
      slug: el.getAttribute("data-note"),
      x: el.offsetLeft + el.offsetWidth / 2,
      w: el.offsetWidth,
      left: el.offsetLeft,
      right: el.offsetLeft + el.offsetWidth,
      top: el.offsetTop,
      mid: el.offsetTop + el.offsetHeight / 2,
      bottom: el.offsetTop + el.offsetHeight,
    };
  });
  const hits = state.mapHits;
  const geo = state.map.edges.filter(e => at[e.from] && at[e.to]).map(e => {
    const a = at[e.from], b = at[e.to];
    const down = b.top >= a.bottom, up = b.bottom <= a.top;
    return { e: e, a: a, b: b, down: down, row: !down && !up };
  });

  /* Several arrows can want the same point: two notes pointing at a third one, or a
     mutual pair whose two directions both run down the same corridor. Bucket by the
     *side of the node* an arrow attaches to — not by direction — and spread each
     bucket along that side, ordered by where its other end sits. */
  const other = (g, node) => (g.a === node ? g.b : g.a);
  const bucket = bare();
  const put = (node, side, g) => {
    const k = node.slug + "#" + side;
    if (!bucket[k]) bucket[k] = { node: node, list: [] };
    bucket[k].list.push(g);
  };
  geo.forEach(g => {
    if (g.row) return;
    put(g.a, g.down ? "b" : "t", g);
    put(g.b, g.down ? "t" : "b", g);
  });
  Object.keys(bucket).forEach(k => {
    const node = bucket[k].node;
    bucket[k].list.sort((p, q) => other(p, node).x - other(q, node).x);
  });
  const fan = (node, side, g) => {
    const b = bucket[node.slug + "#" + side];
    const n = b ? b.list.length : 1;
    if (n < 2) return node.x;
    const w = Math.min(node.w * 0.6, 30 * (n - 1));
    return node.x - w / 2 + w * (b.list.indexOf(g) / (n - 1));
  };

  const W = box.clientWidth, H = box.clientHeight;
  const paths = geo.map(g => {
    const a = g.a, b = g.b, e = g.e;
    const on = !hits || (hits[e.from] && hits[e.to]);
    const draw = d => `<path class="gedge${on ? "" : " dim"}" d="${d}" marker-end="url(#garrow)"/>`;

    /* two notes on the same row — siblings that reference each other — get a horizontal
       arrow between their facing sides; a vertical curve between boxes at the same
       height would leave the drawing area and come back through the text */
    if (g.row) {
      const l2r = a.x <= b.x, d = l2r ? 1 : -1;
      const x1 = l2r ? a.right : a.left, x2 = l2r ? b.left : b.right;
      const k = Math.max(14, Math.abs(x2 - x1) * 0.4);
      return draw(`M ${x1} ${a.mid} C ${x1 + d * k} ${a.mid} ${x2 - d * k} ${b.mid} ${x2} ${b.mid}`);
    }

    const x1 = fan(a, g.down ? "b" : "t", g), x2 = fan(b, g.down ? "t" : "b", g);
    const y1 = g.down ? a.bottom : a.top;                 // a back edge leaves the top
    const y2 = g.down ? b.top : b.bottom;
    const s = g.down ? 1 : -1;
    const k = Math.max(22, Math.abs(y2 - y1) * 0.45);
    return draw(`M ${x1} ${y1} C ${x1} ${y1 + s * k} ${x2} ${y2 - s * k} ${x2} ${y2}`);
  }).join("");
  layer.innerHTML = `<svg width="${W}" height="${H}" aria-hidden="true" focusable="false">
    <defs><marker id="garrow" viewBox="0 0 10 10" refX="10" refY="5"
      markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
      <path d="M 0 1.2 L 10 5 L 0 8.8 z"/></marker></defs>${paths}</svg>`;
}

/* ---------- history: git is the record, commentary.json is the reading ----------
   Two layers, deliberately kept apart. The commit list and its diffs come from
   GitHub and are not editable after the fact; the notes come from a file in the
   repo and are dated, so a commit can accumulate several readings over years.
   Only commits touching posts/<slug>.md are queried, and `site:` ones are dropped
   below, so site-development commits never show up here. */
async function renderHistory(slug, files) {
  const body = document.getElementById("rail-body");
  const at = rendered;
  const logs = files.map(f => `https://github.com/${REPO}/commits/main/${f}`);
  const fallback = `<p class="empty">History unavailable — <a href="${logs[0]}" target="_blank" rel="noopener">read it on GitHub</a>.</p>`;

  /* one request per file, each free to fail on its own: a rate-limited or missing path
     must not take the other one's commits down with it, and a hand-edited commentary
     entry that is not an array must not leave the rail stuck on "Loading…" */
  const lists = await Promise.all(files.map(f =>
    ghJSON(`https://api.github.com/repos/${REPO}/commits?per_page=100&path=${encodeURIComponent(f)}`)
      .then(r => (Array.isArray(r) ? r : null), () => null)
  ));
  const filed = await loadCommentary();
  const notes = Array.isArray(filed[slug]) ? filed[slug] : [];
  if (at !== rendered) return;                 // navigated away mid-fetch
  if (!lists.some(Boolean)) { body.innerHTML = fallback; return; }

  /* one page's record can be spread over several files (the map is its prose plus
     its manifest); merge them into a single dated list, a commit counted once */
  const seen = bare(), commits = [];
  lists.forEach(l => {
    if (!l) return;
    /* A `site:` commit is the site's record, not the post's, and querying by path used
       to be enough to keep it out: it never touched posts/<slug>.md. Retagging and
       resummarising broke that — both live in the frontmatter of that very file — so
       they are dropped by subject instead. Nothing about filing belongs in this rail. */
    l.forEach(c => {
      if (/^site:\s/.test(String(c.commit.message))) return;
      if (!seen[c.sha]) { seen[c.sha] = true; commits.push(c); }
    });
  });
  commits.sort((a, b) => String(b.commit.author.date).localeCompare(String(a.commit.author.date)));
  if (!commits.length) { body.innerHTML = fallback; return; }

  const revs = commits.map(c => {
    const msg = String(c.commit.message).split(/\r?\n/);
    return {
      sha: c.sha,
      date: String(c.commit.author.date).slice(0, 10),
      subject: msg[0].replace(/^(post|note)\([^)]*\):\s*/, "").replace(/^map:\s*/, ""),
      why: msg.slice(1).join("\n").trim(),
      notes: notes.filter(n => n.sha && c.sha.indexOf(String(n.sha)) === 0)
                  .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    };
  });
  /* hold the article as it stands, because opening a revision replaces it with the
     same article marked up as that revision's diff, and closing has to put it back */
  const proseEl = document.querySelector("article .prose");
  state.hist = { files, revs, open: -1, prose: proseEl, proseHTML: proseEl ? proseEl.innerHTML : "" };

  body.innerHTML = `
    <ol class="revs">
      ${revs.map((r, i) => `
        <li><button class="rev-item" data-rev="${i}">
          <span class="rev-date">${esc(r.date)}</span>
          <span class="rev-sub">${esc(r.subject)}</span>
          ${r.notes.length ? `<span class="rev-badge">${r.notes.length} reading${r.notes.length > 1 ? "s" : ""}</span>` : ""}
        </button></li>`).join("")}
    </ol>
    ${logs.map((u, i) => `<a class="rail-more" href="${u}" target="_blank" rel="noopener">${
      files.length > 1 ? esc(files[i].split("/").pop()) : "Full log"}</a>`).join("")}`;

  body.querySelectorAll(".rev-item").forEach(b =>
    b.addEventListener("click", () => openRev(Number(b.dataset.rev)))
  );

  loadBlame(state.hist);
}

/* ---------- blame: which revision put this line here ----------
   A running list grows one entry at a time, and the question a reader has of any single
   entry is *when did this arrive*. The rail answers that for the article as a whole; this
   answers it per line, on hover, without the reader having to open anything.

   There is no blame in GitHub's REST API — it exists only in GraphQL, which needs a token
   this site does not have. So it is computed here: every version of the file, oldest to
   newest, diffed against the one before it, each line carrying the revision that produced
   it. `git blame` semantics — a line edited later belongs to the edit, not to its first
   appearance. The versions come from raw.githubusercontent and are cached per sha, so the
   cost is one plain fetch per revision, once per session, and none of the API budget.

   Lines are matched to the rendered page by their text, not by number, because the HTML
   carries no line numbers. Two identical lines in one post therefore share an answer —
   the later one wins. That is a real limit, and the reason this is a hint on hover rather
   than a claim printed in the page. */
async function loadBlame(h) {
  const mdPath = h.files.filter(f => /\.md$/.test(f))[0];
  if (!mdPath || h.revs.length < 1) return;
  const order = h.revs.slice().reverse();               // oldest first
  try {
    const texts = [];
    for (let i = 0; i < order.length; i++) texts.push(parseFrontmatter(await rawAt(order[i].sha, mdPath)).body);
    if (state.hist !== h) return;

    let prev = [], origin = [];
    for (let v = 0; v < texts.length; v++) {
      const curr = texts[v].split("\n");
      const next = [];
      let pi = 0, ci = 0;
      lineOps(prev, curr).forEach(o => {
        if (o.op === "=") { next[ci] = origin[pi]; pi++; ci++; }
        else if (o.op === "+") { next[ci] = v; ci++; }
        else pi++;
      });
      prev = curr; origin = next;
    }

    const byText = bare();
    for (let i = 0; i < prev.length; i++) {
      const key = lineKey(prev[i]);
      if (key) byText[key] = order[origin[i] === undefined ? 0 : origin[i]];
    }
    h.blame = byText;
    bindBlameHover(h);
  } catch (e) { /* the article is readable without it; say nothing */ }
}

/* the source line reduced to the text a reader actually sees, so a rendered block can be
   looked up by what it says. Rendering the line is more honest than stripping syntax with
   regexes — it goes through the same wikilink and inline-markdown path the article did. */
function lineKey(line) {
  const body = String(line).replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+|>+\s*|#{1,6}\s+)/, "");
  if (!body.trim()) return "";
  const d = document.createElement("div");
  try { d.innerHTML = marked.parseInline(wikiLinks(body)); } catch (e) { d.textContent = body; }
  return d.textContent.replace(/\s+/g, "");
}

/* what a rendered block says, on the same terms: the named source chip is furniture the
   markdown never had, and footnote markers are not part of the sentence either */
function blockKey(el) {
  const c = el.cloneNode(true);
  c.querySelectorAll(".src, .fnref").forEach(n => n.parentNode.removeChild(n));
  return c.textContent.replace(/\s+/g, "");
}

const BLAME_BLOCKS = "li, p, h2, h3, h4, h5, h6, blockquote";

/* The chip has to be clickable, and it stands over the prose box — so reaching for it is
   a `mouseleave` on the prose, which used to hide it, which put the pointer back over the
   prose, which showed it again: a flicker loop that made it impossible to click. Leaving
   towards the chip is therefore not leaving, and every hide waits a moment in case the
   pointer is only crossing a gap. */
let blameFor = null, blameTimer = 0;

function bindBlameHover(h) {
  const prose = h.prose;
  if (!prose || prose.dataset.blameBound) return;
  prose.dataset.blameBound = "1";

  prose.addEventListener("mouseover", e => {
    const hist = state.hist;
    if (!hist || !hist.blame || hist.open >= 0) return;   // a revision is open: that view is the diff
    let el = e.target;
    while (el && el !== prose && !el.matches(BLAME_BLOCKS)) el = el.parentNode;
    if (!el || el === prose) return scheduleHideBlame(null);
    if (el.querySelector && el.querySelector(BLAME_BLOCKS)) return scheduleHideBlame(null);  // a list, not an item
    const hit = hist.blame[blockKey(el)];
    if (!hit) return scheduleHideBlame(null);
    showBlame(el, hit, hist.revs.indexOf(hit));
  });
  prose.addEventListener("mouseleave", scheduleHideBlame);
}

function blameChip() {
  let el = document.getElementById("blame-chip");
  if (el) return el;
  el = document.createElement("button");
  el.id = "blame-chip";
  el.className = "blame";
  el.addEventListener("click", () => {
    const i = Number(el.dataset.rev);
    if (i >= 0) openRev(i);
  });
  el.addEventListener("mouseenter", () => clearTimeout(blameTimer));
  el.addEventListener("mouseleave", () => scheduleHideBlame(null));
  document.body.appendChild(el);
  return el;
}

function scheduleHideBlame(e) {
  const chip = document.getElementById("blame-chip");
  const to = e && e.relatedTarget;
  if (to && chip && (to === chip || chip.contains(to))) return;   // heading for the chip, not away
  clearTimeout(blameTimer);
  blameTimer = setTimeout(hideBlame, 140);
}

function hideBlame() {
  clearTimeout(blameTimer);
  blameFor = null;
  const el = document.getElementById("blame-chip");
  if (el) el.classList.remove("on");
}

/* Placed off the end of the line's own last line-box, so on a short entry it sits in open
   margin and touches nothing. A full-width paragraph has no such gap, so it is clamped
   inside the column and left translucent: legible as an annotation, and never hiding a
   word outright. It is out of the text flow entirely, so selecting the prose is unaffected. */
function showBlame(block, rev, idx) {
  clearTimeout(blameTimer);
  const el = blameChip();
  if (blameFor === block && el.classList.contains("on")) return;   // same line: do not re-measure
  blameFor = block;
  el.textContent = rev.date;
  el.dataset.rev = String(idx);
  el.classList.add("on");

  const range = document.createRange();
  range.selectNodeContents(block);
  const rects = range.getClientRects();
  const last = rects.length ? rects[rects.length - 1] : block.getBoundingClientRect();
  const bound = (state.hist.prose || block).getBoundingClientRect();
  const w = el.offsetWidth;
  const left = Math.min(last.right + 14, Math.max(bound.left, bound.right - w));
  el.style.left = (window.pageXOffset + left) + "px";
  el.style.top = (window.pageYOffset + last.top + (last.height - el.offsetHeight) / 2) + "px";
}

async function openRev(i) {
  const h = state.hist;
  const detail = document.getElementById("rev-detail");
  if (!h || !detail) return;

  const close = h.open === i;
  h.open = close ? -1 : i;
  document.querySelectorAll(".rev-item").forEach(b =>
    b.classList.toggle("active", Number(b.dataset.rev) === h.open)
  );
  if (close) { detail.innerHTML = ""; restoreProse(h); return; }

  const r = h.revs[i];
  const head = `
    <div class="rev-head">
      <span class="rev-date">${esc(r.date)}</span>
      <a class="rev-sha" href="https://github.com/${REPO}/commit/${esc(r.sha)}" target="_blank" rel="noopener">${esc(r.sha.slice(0, 7))}</a>
      <button class="rev-close" aria-label="Close">×</button>
    </div>
    <h3>${esc(r.subject)}</h3>
    ${r.why ? `<div class="rev-block"><h4>Why</h4><div class="rev-why">${nl(r.why)}</div></div>` : ""}`;
  const tail = r.notes.length ? `
    <div class="rev-block"><h4>Readings</h4>
      ${r.notes.map(n => `<div class="note"><span class="note-date">${esc(n.date)}</span><div class="note-body">${marked.parseInline(String(n.note || ""))}</div></div>`).join("")}
    </div>` : "";

  /* No "what changed" block: the change is shown on the article itself, below. What
     stays here is the diff of any *non*-prose file in the page's record — the map's
     learning.json — which has no prose to be shown on. */
  detail.innerHTML = head + tail;
  bindClose(detail);
  detail.scrollIntoView({ behavior: "smooth", block: "start" });

  showProseDiff(h, i, r);

  const others = h.files.filter(f => !/\.md$/.test(f));
  if (!others.length) return;
  let diff;
  try {
    const c = await ghJSON(`https://api.github.com/repos/${REPO}/commits/${r.sha}`);
    const touched = (c.files || []).filter(x => others.indexOf(x.filename) >= 0);
    if (!touched.length) return;
    diff = touched.map(f => `<p class="diff-file">${esc(f.filename)}</p>` + (f.status === "added"
      ? `<p class="empty">Created — ${f.additions} lines.</p>`
      : `<div class="diff mono">${renderPatch(f.patch)}</div>`)).join("");
  } catch (e) {
    diff = `<p class="empty">Diff unavailable — <a href="https://github.com/${REPO}/commit/${esc(r.sha)}" target="_blank" rel="noopener">read it on GitHub</a>.</p>`;
  }
  if (state.hist !== h || h.open !== i) return;
  detail.innerHTML = head + `<div class="rev-block"><h4>Manifest</h4>${diff}</div>` + tail;
  bindClose(detail);
}

function restoreProse(h) {
  if (!h || !h.prose) return;
  h.prose.innerHTML = h.proseHTML;
  h.prose.classList.remove("diffing");
}

/* Re-render the article from the revision's own markdown, marked against the state of
   the file one commit earlier — so every revision is read against its predecessor, the
   way `git show` reads. Both versions come from raw.githubusercontent, not the API:
   they are plain file fetches and do not spend the 60-an-hour budget the rail runs on. */
async function showProseDiff(h, i, r) {
  const el = h.prose;
  const mdPath = h.files.filter(f => /\.md$/.test(f))[0];
  if (!el || !mdPath) return;
  try {
    const c = await ghJSON(`https://api.github.com/repos/${REPO}/commits/${r.sha}`);
    if (state.hist !== h || h.open !== i) return;
    const parents = c.parents || [];
    const now = await rawAt(r.sha, mdPath);
    /* The commit that created the post has a parent, but the parent has no such file:
       raw answers 404. That is not a failure, it is "there was nothing here before" —
       treat it as empty so the founding revision reads as one whole addition. */
    let before = "";
    if (parents.length) {
      try { before = await rawAt(parents[0].sha, mdPath); } catch (e) { before = ""; }
    }
    if (state.hist !== h || h.open !== i) return;
    el.innerHTML = renderMarkdown(diffMarkdown(parseFrontmatter(before).body, parseFrontmatter(now).body));
    el.classList.add("diffing");
  } catch (e) {
    restoreProse(h);                       // a missing revision is not worth a broken article
  }
}

/* the file exactly as it stood at one commit; 404 for a path that did not exist yet */
async function rawAt(sha, path) {
  const url = "https://raw.githubusercontent.com/" + REPO + "/" + sha + "/" +
    path.split("/").map(encodeURIComponent).join("/");
  const key = "raw:" + url;
  try { const hit = sessionStorage.getItem(key); if (hit !== null) return hit; } catch (e) {}
  const res = await fetch(url);
  if (!res.ok) throw new Error("raw " + res.status);
  const text = await res.text();
  try { sessionStorage.setItem(key, text); } catch (e) {}
  return text;
}

/* markdown in, markdown out: the newer text with the older text's removed lines put
   back where they stood, each changed line wrapped so it renders struck or highlighted */
function diffMarkdown(a, b) {
  return lineOps(a.split("\n"), b.split("\n")).map(o =>
    o.op === "=" ? o.t : markLine(o.t, o.op === "-" ? "del" : "ins")
  ).join("\n");
}

/* Wrap what the line *says*, never what the line *is*: the bullet, the hashes and the
   quote marker stay outside the tag. Wrapping the whole line would turn a list item
   into a paragraph, and the diff would destroy the structure it exists to show. */
function markLine(line, kind) {
  if (!line.trim()) return line;
  const m = line.match(/^(\s*(?:[-*+]\s+|\d+[.)]\s+|>+\s*|#{1,6}\s+)?)([\s\S]*)$/);
  const lead = m ? m[1] : "", rest = m ? m[2] : line;
  if (!rest.trim()) return line;
  return lead + "<" + kind + ' class="dprose">' + rest + "</" + kind + ">";
}

/* longest common subsequence over whole lines — the same shape as wordDiff() below,
   one level up. Bail out on a pair too large to diff rather than freeze the page. */
function lineOps(A, B) {
  const n = A.length, m = B.length;
  if (!n) return B.map(t => ({ op: "+", t }));
  if (!m) return A.map(t => ({ op: "-", t }));
  if (n * m > 4000000) return B.map(t => ({ op: "=", t }));
  const w = m + 1;
  const d = new Uint32Array((n + 1) * w);
  for (let x = n - 1; x >= 0; x--)
    for (let y = m - 1; y >= 0; y--)
      d[x * w + y] = A[x] === B[y]
        ? d[(x + 1) * w + y + 1] + 1
        : Math.max(d[(x + 1) * w + y], d[x * w + y + 1]);

  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push({ op: "=", t: A[i] }); i++; j++; }
    else if (d[(i + 1) * w + j] >= d[i * w + j + 1]) { ops.push({ op: "-", t: A[i] }); i++; }
    else { ops.push({ op: "+", t: B[j] }); j++; }
  }
  while (i < n) { ops.push({ op: "-", t: A[i] }); i++; }
  while (j < m) { ops.push({ op: "+", t: B[j] }); j++; }
  return ops;
}

function bindClose(detail) {
  const b = detail.querySelector(".rev-close");
  if (b) b.addEventListener("click", () => openRev(state.hist.open));
}

async function loadCommentary() {
  if (state.commentary) return state.commentary;
  try {
    const res = await fetch("/commentary.json", { cache: "no-cache" });
    state.commentary = res.ok ? await res.json() : {};
  } catch (e) { state.commentary = {}; }
  return state.commentary;
}

/* GitHub allows 60 unauthenticated calls an hour, so hold answers for the session */
async function ghJSON(url) {
  const key = "gh:" + url;
  try {
    const hit = sessionStorage.getItem(key);
    if (hit) return JSON.parse(hit);
  } catch (e) {}
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error("github " + res.status);
  const data = await res.json();
  try { sessionStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
  return data;
}

/* a unified diff read as prose: each -/+ run becomes one paragraph with the
   changed words marked inline, rather than two walls of text to compare by eye */
function renderPatch(patch) {
  if (!patch) return `<p class="empty">Diff too large to show inline.</p>`;
  const out = [];
  let del = [], add = [];
  const flush = () => {
    if (del.length || add.length) out.push(diffBlock(del.join("\n"), add.join("\n")));
    del = []; add = [];
  };
  patch.split("\n").forEach(l => {
    const c = l.charAt(0);
    if (c === "-") del.push(l.slice(1));
    else if (c === "+") add.push(l.slice(1));
    else flush();                       // context line, hunk header, or blank
  });
  flush();
  return out.join("") || `<p class="empty">Whitespace only.</p>`;
}

/* one markdown line = one paragraph, so pair the removed and added paragraphs
   positionally and diff each pair on its own; interleaving a whole multi-paragraph
   rewrite produces word salad that is technically correct and unreadable */
function diffBlock(a, b) {
  const A = a.split("\n").filter(s => s.trim());
  const B = b.split("\n").filter(s => s.trim());
  const del = s => `<p class="dline"><del>${nl(s)}</del></p>`;
  const ins = s => `<p class="dline"><ins>${nl(s)}</ins></p>`;
  if (!A.length) return B.map(ins).join("");
  if (!B.length) return A.map(del).join("");

  const out = [];
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (i >= A.length) { out.push(ins(B[i])); continue; }
    if (i >= B.length) { out.push(del(A[i])); continue; }
    const w = wordDiff(A[i], B[i]);
    out.push(w === null ? del(A[i]) + ins(B[i]) : `<p class="dline">${w}</p>`);
  }
  return out.join("");
}

/* CJK has no spaces, so single characters are tokens too; everything else
   splits on whitespace, which is kept as its own token to rebuild the text */
const CJK = "\\u3000-\\u303f\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef";
const TOKEN = new RegExp("[" + CJK + "]|[^\\s" + CJK + "]+|\\s+", "g");

/* returns null when the two paragraphs share too little to be worth interleaving —
   the caller then shows them whole, one struck out above the other */
function wordDiff(a, b) {
  const A = a.match(TOKEN) || [], B = b.match(TOKEN) || [];
  const n = A.length, m = B.length;
  if (!n || !m || n * m > 1000000) return null;

  const w = m + 1;
  const d = new Uint32Array((n + 1) * w);            // longest common subsequence, from the end
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      d[i * w + j] = A[i] === B[j]
        ? d[(i + 1) * w + j + 1] + 1
        : Math.max(d[(i + 1) * w + j], d[i * w + j + 1]);
  if (2 * d[0] / (n + m) < 0.4) return null;              // a replacement, not an edit

  const ops = [];
  const push = (op, t) => {
    const last = ops[ops.length - 1];
    if (last && last.op === op) last.t += t; else ops.push({ op, t });
  };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { push("=", A[i]); i++; j++; }
    else if (d[(i + 1) * w + j] >= d[i * w + j + 1]) { push("-", A[i]); i++; }
    else { push("+", B[j]); j++; }
  }
  while (i < n) { push("-", A[i]); i++; }
  while (j < m) { push("+", B[j]); j++; }

  return ops.map(o => {
    const h = nl(o.t);
    return o.op === "=" ? h : o.op === "-" ? `<del>${h}</del>` : `<ins>${h}</ins>`;
  }).join("");
}

function nl(s) { return esc(s).replace(/\n/g, "<br>"); }

/* ---------- helpers ---------- */
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  /* Obsidian writes YAML, and its property editor turns a list into block form:
       tags:
         - foo
         - bar
     Flatten that back to "foo, bar", so a file edited in Obsidian reads the same as
     one typed by hand. Without this the key silently becomes an empty string. */
  let last = "";
  m[1].split(/\r?\n/).forEach(line => {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && last) {
      const v = item[1].trim().replace(/^["']|["']$/g, "");
      meta[last] = meta[last] ? meta[last] + ", " + v : v;
      return;
    }
    const i = line.indexOf(":");
    if (i > 0) {
      last = line.slice(0, i).trim();
      meta[last] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  });
  return { meta, body: text.slice(m[0].length) };
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* markdown + LaTeX ($…$, $$…$$) + auto-embed YouTube/Bilibili URLs on their own line */
function renderMarkdown(md) {
  const math = [];
  // 1) stash math so markdown doesn't mangle it
  md = md.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => `\n\n@@M${math.push({ display: true, tex }) - 1}@@\n\n`);
  // 不用后行断言 (?<!\\)：Safari 16.4 以前不支持，会让整个文件解析失败。
  // 改成把前一个字符一起吃进来 —— `\$` 里的 $ 既不能开启也不能闭合公式。
  md = md.replace(/(^|[^\\])\$([^$\n]*?[^$\n\\])\$/g,
    (_, pre, tex) => `${pre}@@M${math.push({ display: false, tex }) - 1}@@`);
  // 2) a bare video URL alone on a line → responsive embed
  md = md.split("\n").map(line => {
    const t = line.trim();
    let m;
    if ((m = t.match(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/)))
      return videoEmbed(`https://www.youtube.com/embed/${m[1]}`);
    if ((m = t.match(/^(?:https?:\/\/)?(?:www\.)?bilibili\.com\/video\/(BV[0-9A-Za-z]+)/)))
      return videoEmbed(`https://player.bilibili.com/player.html?bvid=${m[1]}&page=1&high_quality=1&autoplay=0`);
    return line;
  }).join("\n");
  // 3) Obsidian wikilinks — [[note]], [[note|alias]], ![[image.png]]
  md = wikiLinks(md);
  // 4) footnotes: `[^id]` in the text + `[^id]: …` definitions → a numbered Notes list
  const fn = footnotes(md);
  md = fn.md + fn.notes;
  // 5) markdown → html
  let html = marked.parse(md);
  // 6) give headings an id, so [[note#heading]] has something to land on
  html = html.replace(/<h([2-6])>([\s\S]*?)<\/h\1>/g,
    (_, lvl, inner) => `<h${lvl} id="${esc(headingId(inner))}">${inner}</h${lvl}>`);
  // 7) post images are written relative to the site root; make that explicit
  html = html.replace(/(<img\b[^>]*?\ssrc=")(?!\/|https?:|data:)/g, "$1/");
  // 8) name where an outward link goes, and stop it reading as emphasis
  html = nameSources(html);
  // 9) restore math via KaTeX
  html = html.replace(/@@M(\d+)@@/g, (_, i) => {
    const { display, tex } = math[i];
    if (typeof katex === "undefined") return esc((display ? "$$" : "$") + tex + (display ? "$$" : "$"));
    try { return katex.renderToString(tex.trim(), { displayMode: display, throwOnError: false }); }
    catch (e) { return esc((display ? "$$" : "$") + tex + (display ? "$$" : "$")); }
  });
  return html;
}

/* footnotes — marked v12 has no footnote extension, so do it here.
   `[^id]` marks a reference; `[^id]: text` (one line, anywhere) defines it.
   Numbering follows order of first appearance in the text, not definition order. */
function footnotes(md) {
  const defs = new Map();
  md = md.replace(/^\[\^([^\]\s]+)\]:[ \t]*(.+)$/gm, (_, id, text) => {
    defs.set(id, text.trim());
    return " ";                       // placeholder, stripped below
  });
  md = md.replace(/^ \n?/gm, "");
  if (!defs.size) return { md, notes: "" };

  const order = [];
  md = md.replace(/\[\^([^\]\s]+)\]/g, (whole, id) => {
    if (!defs.has(id)) return whole;
    let i = order.indexOf(id);
    if (i === -1) i = order.push(id) - 1;
    return `<sup class="fnref" id="fnref-${id}"><a href="#fn-${id}">${i + 1}</a></sup>`;
  });
  if (!order.length) return { md, notes: "" };

  const items = order.map(id =>
    // U+FE0E forces text presentation: bare U+21A9 renders as a blue emoji on iOS
    `<li id="fn-${id}">${marked.parseInline(defs.get(id))} <a class="fnback" href="#fnref-${id}">↩︎</a></li>`
  ).join("\n");
  return { md, notes: `\n\n<section class="footnotes"><h2>Notes</h2><ol>\n${items}\n</ol></section>\n` };
}

/* ---------- Obsidian wikilinks ----------
   Everything here is written in Obsidian, in the vault rooted at posts/, so a link
   between two pieces of writing is `[[…]]` and nothing else. Filenames are kebab-case
   and equal to the slug, which is what makes resolution a lookup rather than a guess.

     [[dedekind-cut]]            → the note, shown under its own title
     [[dedekind-cut|the cut]]    → the note, shown as "the cut"
     [[dedekind-cut#Transcript]] → straight to that heading
     ![[diagram.png]]           → the image, from posts/attachments/
     [[nothing-here]]           → rendered plain and faded, the way Obsidian shows an
                                  unresolved link. A dead <a> would be worse.

   `![[note]]` (transclusion) is not supported and degrades to a link. */
const ATTACHMENTS = "attachments";
const IMG_EXT = /\.(png|jpe?g|gif|svg|webp|avif)$/i;

function headingId(html) {
  return String(html).replace(/<[^>]*>/g, "").trim().toLowerCase()
    .replace(/[^\w一-鿿]+/g, "-").replace(/^-+|-+$/g, "") || "section";
}

/* the vault's note names are slugs, so a name resolves by slug first; matching the
   title too is a courtesy for when a title is typed by hand instead of autocompleted */
function resolveWiki(name) {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  let i;
  for (i = 0; i < state.posts.length; i++) {
    const p = state.posts[i];
    if (String(p.slug).toLowerCase() === key || String(p.title || "").toLowerCase() === key)
      return { href: "/" + encodeURIComponent(p.slug), title: p.title || p.slug, attr: "post", slug: p.slug };
  }
  const ns = state.map.nodes;
  for (i = 0; i < ns.length; i++) {
    const n = ns[i];
    if (String(n.slug).toLowerCase() === key || String(n.title || "").toLowerCase() === key)
      return { href: noteHref(n.slug), title: n.title || n.slug, attr: "note", slug: n.slug };
  }
  return null;
}

function wikiLinks(md) {
  let fenced = false;
  return md.split("\n").map(line => {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return line; }
    if (fenced) return line;
    return line.replace(/(!?)\[\[([^\][]+)\]\]/g, (whole, bang, body) => {
      const bar = body.indexOf("|");
      const alias = bar >= 0 ? body.slice(bar + 1).trim() : "";
      let name = (bar >= 0 ? body.slice(0, bar) : body).trim();
      const hash = name.indexOf("#");
      let heading = "";
      if (hash >= 0) { heading = name.slice(hash + 1).trim(); name = name.slice(0, hash).trim(); }

      if (bang && IMG_EXT.test(name)) {
        // Obsidian embeds an attachment by bare filename; a name with a slash is a
        // path from the vault root, which is posts/
        const src = "/posts/" + (name.indexOf("/") >= 0 ? name : ATTACHMENTS + "/" + name)
          .split("/").map(encodeURIComponent).join("/");
        return `<img src="${esc(src)}" alt="${esc(alias || name)}" loading="lazy">`;
      }

      const hit = resolveWiki(name);
      if (!hit) return `<span class="wiki-dead" title="No note named &quot;${esc(name)}&quot;">${esc(alias || body)}</span>`;
      const anchor = heading ? "#" + encodeURIComponent(headingId(heading)) : "";
      const text = alias || (heading ? hit.title + " › " + heading : hit.title);
      /* no data-* when the link carries an anchor: the in-app route would land on the
         page and drop the fragment, because the heading does not exist until the
         markdown has been fetched and rendered. A real navigation gets it right. */
      const data = anchor ? "" : ` data-${hit.attr}="${esc(hit.slug)}"`;
      return `<a class="wiki"${data} href="${esc(hit.href + anchor)}">${esc(text)}</a>`;
    });
  }).join("\n");
}

/* ---------- outward links ----------
   A link written `[歐麗娟：孤獨的多棱鏡](https://youtu.be/…)` is a citation: the text is
   the work's own name, and the URL says where it lives. Rendered as bare accent-coloured
   text it reads as emphasis — four words singled out for no stated reason — and gives no
   hint that a video is on the other end.

   So the anchor is **taken off the title entirely**. The work's name becomes ordinary,
   unclickable prose, and a small named source is put beside it carrying the link on its
   own. Nothing in the sentence pretends to be a control, and the one thing that is a
   control says where it goes before you follow it. Same ↗ idiom as the identity and
   venture links on the home page.

   This is a rendering concern only: the vault keeps writing plain markdown links. */
const SOURCES = [
  [/(^|\.)youtu\.be$|(^|\.)youtube\.com$/, "YouTube"],
  [/(^|\.)bilibili\.com$/, "Bilibili"],
  [/(^|\.)arxiv\.org$/, "arXiv"],
  [/(^|\.)github\.com$/, "GitHub"],
  [/(^|\.)wikipedia\.org$/, "Wikipedia"],
];

function sourceName(href) {
  let host;
  try { host = new URL(href).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  for (let i = 0; i < SOURCES.length; i++) if (SOURCES[i][0].test(host)) return SOURCES[i][1];
  return host;                            // anything else is named by its own domain
}

function nameSources(html) {
  return html.replace(/<a\s([^>]*?)>([\s\S]*?)<\/a>/g, (whole, attrs, text) => {
    const m = attrs.match(/href="([^"]*)"/);
    if (!m || !/^https?:/i.test(m[1])) return whole;          // internal links are not citations
    if (/\bclass="[^"]*\b(wiki|fnback)\b/.test(attrs)) return whole;
    const name = sourceName(m[1]);
    if (!name) return whole;
    return text + '<a class="src" href="' + m[1] + '" target="_blank" rel="noopener">' + esc(name) + "</a>";
  });
}

function videoEmbed(src) {
  return `<div class="video"><iframe src="${src}" loading="lazy" allow="fullscreen; encrypted-media; picture-in-picture" allowfullscreen scrolling="no" frameborder="0"></iframe></div>`;
}
