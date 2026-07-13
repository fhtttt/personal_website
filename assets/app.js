/* ---- config: edit these two lines ---- */
const SITE = {
  name: "方皓天",           // 页头显示的中文名
  pinyin: "Fāng Hàotiān",   // 名字上方的注音
  enName: "Haotian Fang",   // 用于浏览器标签 + 页脚
};
const REPO = "fhtttt/personal_website";

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

const app = document.getElementById("app");
const PAGE_SIZE = 10;
const state = { posts: [], query: "", cat: "all", page: 0, bodies: {}, bodiesLoaded: false };

boot();

async function boot() {
  try {
    const res = await fetch("posts.json", { cache: "no-cache" });
    state.posts = await res.json();
  } catch (e) {
    state.posts = [];
  }
  window.addEventListener("popstate", route);
  document.addEventListener("click", onNavClick);
  route();
}

/* clean URLs via ?post=slug (no #, refresh-safe, works at any base path) */
function route() {
  const slug = new URLSearchParams(location.search).get("post");
  if (slug) renderPost(slug);
  else renderHome();
  window.scrollTo(0, 0);
}
function go(url) { history.pushState(null, "", url); route(); }
function onNavClick(e) {
  const a = e.target.closest("a");
  if (!a) return;
  if ("post" in a.dataset) { e.preventDefault(); go("?post=" + encodeURIComponent(a.dataset.post)); }
  else if ("home" in a.dataset) { e.preventDefault(); go(location.pathname); }
}

/* ---------- home ---------- */
function renderHome() {
  document.title = SITE.enName;
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

    <section class="section">
      <h2>La tour d’ivoire avant midi</h2>
      <div class="acad">
        <div class="item">
          <div class="yrs">2020-2024</div>
          <div class="body">
            <p class="deg">Philosophy (minor in Physics), History and Philosophy of Science, Computer Science</p>
            <p class="sub">University of Pittsburgh · advised by Paolo Palmieri and Lynne Sunderman</p>
          </div>
        </div>
        <div class="item">
          <div class="yrs">2024-2027</div>
          <div class="body">
            <p class="deg">Digital Humanities</p>
            <p class="sub">EPFL (School of Computer and Communication Sciences) · advised by xxx</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2>Uncorrelated bets on the world</h2>
      <div class="acad">
        <div class="item">
          <div class="yrs">2025–</div>
          <div class="body">
            <p class="deg"><a href="https://stegamatter.com" target="_blank" rel="noopener">StegaMatter</a></p>
            <p class="sub">Co-founder & COO</p>
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

    <div class="footer">© <span id="yr"></span> ${esc(SITE.enName)} · <a href="https://github.com/${REPO}" target="_blank" rel="noopener">source</a></div>
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
      const res = await fetch(p.file);
      if (!res.ok) return;
      const { body } = parseFrontmatter(await res.text());
      state.bodies[p.slug] = toPlain(body);   // 原文大小写、去 markdown、便于片段展示
    } catch (e) {}
  }));
  if (document.getElementById("list")) renderList();
}

function renderEpigraphs() {
  const cell = q => `
        <figure class="epi epi-${q.lang}" lang="${q.lang}"${q.lang === "fa" ? ' dir="rtl"' : ""}>
          <blockquote>${q.lines.map(esc).join("<br>")}</blockquote>
          <figcaption>${esc(q.cite)}</figcaption>
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
    return `<li><a class="row" data-post="${esc(p.slug)}" href="?post=${encodeURIComponent(p.slug)}">
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
      document.querySelector(".controls")?.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );
}

/* first ~120 chars of the article body (falls back to summary before bodies load) */
function excerpt(p) {
  const src = state.bodies[p.slug] || p.summary || "";
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
      const hay = `${p.title} ${p.summary || ""} ${p.category || ""} ${(p.tags || []).join(" ")} ${state.bodies[p.slug] || ""}`.toLowerCase();
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
    const res = await fetch(file, { cache: "no-cache" });
    if (res.ok) raw = await res.text();
  } catch (e) {}

  if (!raw) {
    app.innerHTML = `<a class="back" data-home href="?">← Back</a><p class="empty">Post not found.</p>`;
    return;
  }

  const { meta, body } = parseFrontmatter(raw);
  const title = (post && post.title) || meta.title || slug;
  const created = meta.created || (post && post.created) || "";
  const updated = meta.updated || (post && post.updated) || "";
  const cat = meta.category || (post && post.category) || "";
  document.title = title;

  app.innerHTML = `
    <a class="back" data-home href="?">← Back</a>
    <article>
      <h1>${esc(title)}</h1>
      <div class="post-meta">
        ${created ? `<span>${esc(created)}</span>` : ""}
        ${updated && updated !== created ? ` · updated ${esc(updated)}` : ""}
        ${cat ? ` · ${esc(cat)}` : ""}
      </div>
      <div class="prose">${renderMarkdown(body)}</div>
    </article>
    <div class="footer"><a data-home href="?">← All posts</a></div>
  `;
}

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
  md = md.replace(/(?<!\\)\$([^\$\n]+?)(?<!\\)\$/g, (_, tex) => `@@M${math.push({ display: false, tex }) - 1}@@`);
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
  // 3) markdown → html
  let html = marked.parse(md);
  // 4) restore math via KaTeX
  html = html.replace(/@@M(\d+)@@/g, (_, i) => {
    const { display, tex } = math[i];
    if (typeof katex === "undefined") return esc((display ? "$$" : "$") + tex + (display ? "$$" : "$"));
    try { return katex.renderToString(tex.trim(), { displayMode: display, throwOnError: false }); }
    catch (e) { return esc((display ? "$$" : "$") + tex + (display ? "$$" : "$")); }
  });
  return html;
}

function videoEmbed(src) {
  return `<div class="video"><iframe src="${src}" loading="lazy" allow="fullscreen; encrypted-media; picture-in-picture" allowfullscreen scrolling="no" frameborder="0"></iframe></div>`;
}
