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
      "دوباره، یک روز آشنا",
      "سیاهی از خانه می‌رود",
      "به شعر خود رنگ می‌زنم",
      "ز آبی آسمان خویش",
    ],
    cite: "سیمین بهبهانی · دوباره می‌سازمت وطن",
  },
  {
    pos: "bl", lang: "en",
    lines: ["When everything else has gone from my brain — the President’s name, the state capitals, the neighborhoods where I lived, and then my own name and what it was on earth I sought, and then at length the faces of my friends, and finally the faces of my family — when all this has dissolved, what will be left, I believe, is topology: the dreaming memory of land as it lay this way and that."],
    cite: "Annie Dillard · An American Childhood",
  },
];

/* the record lives in git; this is where it is read from */
const REPO = "fhtttt/personal_website";

const app = document.getElementById("app");
const PAGE_SIZE = 10;
const state = {
  posts: [], query: "", cat: "all", page: 0, bodies: {}, excerpts: {}, bodiesLoaded: false,
  commentary: null, hist: null,
};

boot();

async function boot() {
  try {
    const res = await fetch("/posts.json", { cache: "no-cache" });
    state.posts = await res.json();
  } catch (e) {
    state.posts = [];
  }
  window.addEventListener("popstate", route);
  document.addEventListener("click", onNavClick);
  route();
}

/* clean URLs: /<slug> is served from the generated <slug>.html, so it is a real
   200 — refresh-safe, crawlable, no trailing slash. ?post=<slug> still resolves,
   for links shared before this scheme. */
/* WebKit fires popstate for in-page fragment navigation (`#fn-1`), Blink does not.
   Without this guard a footnote tap on iOS re-rendered the whole post and scrolled
   to the top, so the anchor never stuck. Only re-render when the page itself changed. */
let rendered = null;
function route() {
  const path = location.pathname.replace(/^\/+|\/+$/g, "").replace(/\.html$/, "");
  const slug = new URLSearchParams(location.search).get("post")
    || (path && !path.includes("/") ? decodeURIComponent(path) : "");
  const key = location.pathname + location.search;
  if (key === rendered) return;
  rendered = key;
  if (slug) renderPost(slug);
  else renderHome();
  window.scrollTo(0, 0);
}
function go(url) { history.pushState(null, "", url); route(); }
function onNavClick(e) {
  const a = e.target.closest("a");
  if (!a) return;
  if ("post" in a.dataset) { e.preventDefault(); go("/" + encodeURIComponent(a.dataset.post)); }
  else if ("home" in a.dataset) { e.preventDefault(); go("/"); }
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
function excerpt(p) {
  const src = state.excerpts[p.slug] || p.summary || "";
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
function buildSnippet(p, q) {
  const ql = q.toLowerCase();
  let src = state.bodies[p.slug] || "";
  let i = src.toLowerCase().indexOf(ql);
  if (i < 0) { src = p.summary || ""; i = src.toLowerCase().indexOf(ql); }
  if (i < 0) return "";                            // match was only in title/tags
  const r = 80;
  const start = Math.max(0, i - r), end = Math.min(src.length, i + q.length + r);
  const s = (start > 0 ? "… " : "") + src.slice(start, end) + (end < src.length ? " …" : "");
  return hl(s, q);
}

function filtered() {
  const q = state.query.trim().toLowerCase();
  return state.posts
    .filter(p => {
      const okCat = state.cat === "all" || p.category === state.cat;
      const tags = Array.isArray(p.tags) ? p.tags.join(" ") : (p.tags || "");
      const hay = `${p.title} ${p.summary || ""} ${p.category || ""} ${tags} ${state.bodies[p.slug] || ""}`.toLowerCase();
      return okCat && (!q || hay.includes(q));
    })
    .sort((a, b) => String(b.created || "").localeCompare(String(a.created || "")));
}

/* ---------- article ---------- */
async function renderPost(slug) {
  const post = state.posts.find(p => p.slug === slug);
  const file = post ? post.file : `posts/${slug}.md`;
  let raw = "";
  try {
    const res = await fetch("/" + file, { cache: "no-cache" });
    if (res.ok) raw = await res.text();
  } catch (e) {}

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
      </article>
      <aside class="rail">
        <h2>History</h2>
        <div id="rail-body" class="rail-body"><p class="empty">Loading…</p></div>
      </aside>
      <div id="rev-detail" class="rev-detail"></div>
    </div>
    <div class="footer"><a data-home href="/">← All posts</a></div>
  `;

  renderHistory(slug, file);
}

/* ---------- history: git is the record, commentary.json is the reading ----------
   Two layers, deliberately kept apart. The commit list and its diffs come from
   GitHub and are not editable after the fact; the notes come from a file in the
   repo and are dated, so a commit can accumulate several readings over years.
   Only commits touching posts/<slug>.md are queried, which is why site-development
   commits never show up here. */
async function renderHistory(slug, file) {
  const body = document.getElementById("rail-body");
  const at = rendered;
  const fallback = `<p class="empty">History unavailable — <a href="https://github.com/${REPO}/commits/main/${file}" target="_blank" rel="noopener">read it on GitHub</a>.</p>`;

  let commits, notes;
  try {
    const both = await Promise.all([
      ghJSON(`https://api.github.com/repos/${REPO}/commits?per_page=100&path=${encodeURIComponent(file)}`),
      loadCommentary(),
    ]);
    commits = both[0];
    notes = both[1][slug] || [];
  } catch (e) {
    if (at === rendered) body.innerHTML = fallback;
    return;
  }
  if (at !== rendered) return;                 // navigated away mid-fetch
  if (!Array.isArray(commits) || !commits.length) { body.innerHTML = fallback; return; }

  const revs = commits.map(c => {
    const msg = String(c.commit.message).split(/\r?\n/);
    return {
      sha: c.sha,
      date: String(c.commit.author.date).slice(0, 10),
      subject: msg[0].replace(/^post\([^)]*\):\s*/, ""),
      why: msg.slice(1).join("\n").trim(),
      notes: notes.filter(n => n.sha && c.sha.indexOf(String(n.sha)) === 0)
                  .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    };
  });
  state.hist = { file, revs, open: -1 };

  body.innerHTML = `
    <ol class="revs">
      ${revs.map((r, i) => `
        <li><button class="rev-item" data-rev="${i}">
          <span class="rev-date">${esc(r.date)}</span>
          <span class="rev-sub">${esc(r.subject)}</span>
          ${r.notes.length ? `<span class="rev-badge">${r.notes.length} reading${r.notes.length > 1 ? "s" : ""}</span>` : ""}
        </button></li>`).join("")}
    </ol>
    <a class="rail-more" href="https://github.com/${REPO}/commits/main/${file}" target="_blank" rel="noopener">Full log</a>`;

  body.querySelectorAll(".rev-item").forEach(b =>
    b.addEventListener("click", () => openRev(Number(b.dataset.rev)))
  );
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
  if (close) { detail.innerHTML = ""; return; }

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

  detail.innerHTML = head + `<div class="rev-block"><h4>What changed</h4><p class="empty">Loading diff…</p></div>` + tail;
  bindClose(detail);
  detail.scrollIntoView({ behavior: "smooth", block: "start" });

  let diff;
  try {
    const c = await ghJSON(`https://api.github.com/repos/${REPO}/commits/${r.sha}`);
    const f = (c.files || []).filter(x => x.filename === h.file)[0];
    diff = !f ? `<p class="empty">This commit does not touch the post file.</p>`
      : f.status === "added" ? `<p class="empty">Post created — ${f.additions} lines.</p>`
      : renderPatch(f.patch);
  } catch (e) {
    diff = `<p class="empty">Diff unavailable — <a href="https://github.com/${REPO}/commit/${esc(r.sha)}" target="_blank" rel="noopener">read it on GitHub</a>.</p>`;
  }
  if (state.hist !== h || h.open !== i) return;
  detail.innerHTML = head + `<div class="rev-block"><h4>What changed</h4><div class="diff">${diff}</div></div>` + tail;
  bindClose(detail);
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
  m[1].split(/\r?\n/).forEach(line => {
    const i = line.indexOf(":");
    if (i > 0) {
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      meta[k] = v;
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
  // 3) footnotes: `[^id]` in the text + `[^id]: …` definitions → a numbered Notes list
  const fn = footnotes(md);
  md = fn.md + fn.notes;
  // 4) markdown → html
  let html = marked.parse(md);
  // 5) post images are written relative to the site root; make that explicit
  html = html.replace(/(<img\b[^>]*?\ssrc=")(?!\/|https?:|data:)/g, "$1/");
  // 6) restore math via KaTeX
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

function videoEmbed(src) {
  return `<div class="video"><iframe src="${src}" loading="lazy" allow="fullscreen; encrypted-media; picture-in-picture" allowfullscreen scrolling="no" frameborder="0"></iframe></div>`;
}
