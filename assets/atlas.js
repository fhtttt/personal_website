/* ---------- the world history: one axis, one map ----------
   /world-history is an index of events, one markdown file each in posts/events/. The
   build reads their frontmatter into events.json, so what arrives here is already checked
   and normalised, and the prose of an event is fetched only when it is opened.

   Fetched by mountAtlas() in app.js the first time this page opens: no other page needs it,
   and a parse error here costs this page rather than the whole site. The syntax floor is
   the same as app.js all the same: nothing Safari 14 cannot read. No `?.`, no `??`, no
   lookbehind, and margins rather than flex gap in anything geometric.

   Wrapped in a function so nothing here can collide with a top-level name of app.js, from
   which it borrows state, bare, esc, isolateRtl, parseFrontmatter and renderMarkdown. */
(function () {
  const WORLD_URL = "/assets/world.json";
  const EVENT_BASE = "/" + EVENT_DIR + "/";

  /* The axis, in CSS pixels. Every year with something recorded is one tick, and the space
     to the next tick grows with the log of the years between them, so a dense century stays
     hoverable and a silent millennium does not run for ten screens. That makes the scale
     elastic: order is true, distance is only a hint. A bar's length therefore cannot be
     read as a duration, which is why a bar states its duration in words. */
  const SPINE_X = 100, LANE_X = 112;
  const LANE_W = 18, LANE_MIN = 4;   // see laneWidth()
  const AXIS_SHARE = 0.52;           // the most of a two-column page the axis and its card may take
  const TOP = 18, TAIL = 18;
  const CARD_W = 272;
  const GAP_MIN = 26, GAP_PER_TENFOLD = 20;
  const FAR = 100;              // a gap this long is drawn dashed and says how long it is
  const BAR_LABEL_MIN = 52;     // a bar shorter than this has no room for its duration
  const SEARCH_FROM = 8;        // below this many events a search box is only furniture
  const INTENT_MS = 140;        // see hoverSoon()
  const SIDE_GAP = 6;           // between the riding map, or the sheet, and what is under them
  const BAND_MIN = 120;         // the least of the axis worth leaving in view around a sheet
  const FLY_MS = 520;

  /* the narrowest a view may get, in map units: one place keeps enough of the world around
     it to say where on earth it is; several places may come closer, or they would touch */
  const ONE_PLACE_W = 130, SOME_PLACES_W = 56;
  const ARROW_LEG_MIN = 34;     // on a leg shorter than this, in pixels, a chevron sits on both its dots

  /* ---- the projection ----
     Natural Earth I, the same polynomial d3 calls geoNaturalEarth1. The coastlines and the
     annotations both go through this one function, so the two can never disagree. */
  const RAD = Math.PI / 180;
  const UNIT = 500 / (Math.PI * 0.8707);    // the equator is 1000 map units wide
  const northing = p => {
    const p2 = p * p, p4 = p2 * p2;
    return p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
  };
  const POLE = UNIT * northing(Math.PI / 2);
  function project(lat, lon) {
    const l = lon * RAD, p = lat * RAD, p2 = p * p, p4 = p2 * p2;
    const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
    return [500 + UNIT * x, POLE - UNIT * northing(p)];
  }
  const WORLD = { x: -2, y: -2, w: 1004, h: 2 * POLE + 4 };
  const ASPECT = WORLD.h / WORLD.w;

  const n2 = v => v.toFixed(2);
  const pair = p => n2(p[0]) + " " + n2(p[1]);

  function polyline(points) {
    return points.map((p, i) => (i ? "L" : "M") + pair(p)).join("");
  }

  /* world.json holds flat rings of [dlon, dlat, ...] in hundredths of a degree, each pair a
     delta from the one before. Summed as integers, so no drift accumulates along a coast. */
  function ringPath(flat, closed) {
    let d = "", lon = 0, lat = 0;
    for (let i = 0; i < flat.length; i += 2) {
      lon += flat[i];
      lat += flat[i + 1];
      d += (i ? "L" : "M") + pair(project(lat / 100, lon / 100));
    }
    return closed ? d + "Z" : d;
  }

  function sphere() {
    const east = [], west = [];
    for (let lat = -90; lat <= 90; lat += 3) {
      east.push(project(lat, 180));
      west.unshift(project(lat, -180));
    }
    return polyline(east.concat(west)) + "Z";
  }

  function graticule() {
    let d = "";
    for (let lon = -150; lon <= 150; lon += 30) {
      const line = [];
      for (let lat = -90; lat <= 90; lat += 5) line.push(project(lat, lon));
      d += polyline(line);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const line = [];
      for (let lon = -180; lon <= 180; lon += 5) line.push(project(lat, lon));
      d += polyline(line);
    }
    return d;
  }

  /* land, then the water on top of it. Rivers and coasts, and no borders: a border is the
     thing this timeline is about, and a modern one under a medieval event would be wrong. */
  let worldLoad = null;
  function loadWorld() {
    if (!worldLoad) worldLoad = fetch(WORLD_URL).then(r => {
      if (!r.ok) throw new Error("world " + r.status);
      return r.json();
    }).then(w => ({
      land: w.land.map(r => ringPath(r, true)).join(""),
      lakes: w.lakes.map(r => ringPath(r, true)).join(""),
      rivers: w.rivers.map(r => ringPath(r, false)).join(""),
    })).catch(() => { worldLoad = null; return null; });
    return worldLoad;
  }

  /* ---- time ----
     Years arrive signed, BCE negative, and there is no year 0. Anything that subtracts goes
     through astro(), which counts 1 BCE as 0: 27 BCE to 14 CE is 40 years, not 41. */
  const today = new Date();
  const NOW = today.getFullYear();
  const TODAY = { y: NOW, m: today.getMonth() + 1, d: today.getDate() };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December"];
  const astro = y => (y < 0 ? y + 1 : y);
  const endYear = e => (e.end ? (e.end.now ? NOW : e.end.y) : e.start.y);
  const grouped = n => (n >= 10000 ? n.toLocaleString("en-US") : String(n));

  function yearText(y) {
    const n = grouped(Math.abs(y));
    return y < 0 ? n + " BCE" : y < 1000 ? n + " CE" : n;
  }

  function whenText(t) {
    return (t.c ? "c. " : "") + (t.d ? t.d + " " : "") + (t.m ? MONTHS[t.m - 1] + " " : "") + yearText(t.y);
  }

  function rangeText(e) {
    const a = e.start, b = e.end;
    if (!b) return whenText(a);
    if (b.now) return whenText(a) + " - present";
    if (a.y === b.y && a.m === b.m && a.d === b.d && !a.c === !b.c) return whenText(a);
    const plain = !a.m && !b.m && !a.c && !b.c;
    if (plain && a.y < 0 && b.y < 0) return grouped(-a.y) + "-" + grouped(-b.y) + " BCE";
    if (plain && a.y >= 1000) return a.y + "-" + b.y;
    if (plain && a.y > 0 && b.y < 1000) return a.y + "-" + b.y + " CE";
    if (a.y === b.y && a.m && b.m && !a.c && !b.c) {
      if (a.m !== b.m) return (a.d ? a.d + " " : "") + MONTHS[a.m - 1] + " - " + whenText(b);
      if (a.d && b.d) return a.d + "-" + b.d + " " + MONTHS[a.m - 1] + " " + yearText(a.y);
    }
    return whenText(a) + " - " + whenText(b);
  }

  /* A day count that needs no Date, whose range stops well short of the Palaeolithic: the
     Julian day number, on the calendar a source of the time would be using, Julian up to
     4 October 1582 and Gregorian from the 15th. */
  function dayNumber(t) {
    const year = astro(t.y), shift = Math.floor((14 - t.m) / 12);
    const y = year + 4800 - shift, m = t.m + 12 * shift - 3;
    const gregorian = year > 1582 || (year === 1582 && (t.m > 10 || (t.m === 10 && t.d >= 15)));
    return t.d + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) -
      (gregorian ? Math.floor(y / 100) - Math.floor(y / 400) + 32045 : 32083);
  }

  /* how long, in the finest unit both ends are known to, and a span still running ends today.
     `short` is what fits along a bar */
  function spanText(e, short) {
    const a = e.start, b = e.end && e.end.now ? TODAY : e.end;
    if (!b) return "";
    const near = a.c || b.c ? (short ? "~" : "about ") : "";
    const say = (n, word) => near + n.toLocaleString("en-US") + " " + word + (n === 1 ? "" : "s");
    let years = astro(b.y) - astro(a.y);
    if (a.d && b.d) {
      const days = dayNumber(b) - dayNumber(a);
      if (days < 1) return "";
      if (days < 60) return say(days, "day");
      if (days < 730) return say(Math.round(days / 30.44), "month");
      years = Math.round(days / 365.25);
    } else if (a.m && b.m) {
      const months = years * 12 + b.m - a.m;
      if (months < 1) return "";
      if (months < 24) return say(months, "month");
      years = Math.round(months / 12);
    }
    if (years < 1) return "";
    return short ? near + years.toLocaleString("en-US") + (years === 1 ? " yr" : " yrs") : say(years, "year");
  }

  /* ---- the page ---- */
  let A = null;                 // the page as it stands; mount() makes a new one
  const bodies = bare();        // an event's prose, rendered once
  let hooked = false;
  let usingKeys = false;

  const alive = () => !!A && A.host.isConnected;
  const canHover = () => !window.matchMedia || matchMedia("(hover: hover)").matches;
  const still = () => !!window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const closest = (node, sel) => (node && node.closest ? node.closest(sel) : null);

  function mount(host) {
    const events = state.events;
    const by = bare();
    events.forEach(e => { by[e.slug] = e; });
    A = {
      host, events, by, shown: events, query: "",
      years: [], ty: [], spot: bare(),
      hover: null, pin: null, sel: null, peek: null, bar: null, barY: 0,
      view: WORLD, target: WORLD, k: 1, raf: 0, timer: 0, waiting: null, lanes: 0, laneW: LANE_W,
      scaled: [], legs: [], drawn: null, cardKey: null,
    };
    document.body.classList.remove("ev-open");
    host.innerHTML = `
      <div class="at-grid">
        <div class="at-axis">
          ${events.length >= SEARCH_FROM ? `
          <div class="controls at-controls">
            <input id="atlas-search" type="search" placeholder="Search the events…" autocomplete="off">
          </div>` : ""}
          <div class="tl"></div>
        </div>
        <div class="at-side">
          <figure class="at-map">
            <div class="at-stamp" hidden></div>
            <svg viewBox="${WORLD.x} ${WORLD.y} ${WORLD.w} ${WORLD.h}" role="img" aria-label="Map of the world">
              <path class="w-sphere" d="${sphere()}"/>
              <path class="w-grat" d="${graticule()}"/>
              <g class="w-geo"></g>
              <path class="mk-dots"/>
              <g class="mk-layer"></g>
            </svg>
          </figure>
          <div class="at-caption"></div>
          <div class="at-detail"></div>
        </div>
      </div>`;
    A.grid = host.querySelector(".at-grid");
    A.side = host.querySelector(".at-side");
    A.tl = host.querySelector(".tl");
    A.axis = host.querySelector(".at-axis");
    A.svg = host.querySelector("svg");
    A.geo = host.querySelector(".w-geo");
    A.dots = host.querySelector(".mk-dots");
    A.layer = host.querySelector(".mk-layer");
    A.detail = host.querySelector(".at-detail");
    A.frame = host.querySelector(".at-map");
    A.stamp = host.querySelector(".at-stamp");

    const mine = A;
    loadWorld().then(w => {
      if (!w || A !== mine) return;
      mine.geo.innerHTML = `<path class="w-land" d="${w.land}"/><path class="w-lakes" d="${w.lakes}"/><path class="w-rivers" d="${w.rivers}"/>`;
    });

    buildAxis();
    bindAxis();
    hookOnce();
    const search = host.querySelector("#atlas-search");
    if (search) search.addEventListener("input", e => {
      A.query = e.target.value.trim().toLowerCase();
      A.pin = A.hover = A.bar = A.peek = null;
      buildAxis();
      paint();
    });
    A.detail.addEventListener("click", onDetailClick);
    setView(WORLD);
    renderCaption();
    paint();

    const slug = fragment();
    if (slug && A.by[slug]) open(slug);
  }

  function fragment() {
    try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ""; }
  }

  /* replaceState, not pushState: picking an event leaves a link to copy, and the Back button
     still means "leave this page" rather than walking back through everything looked at.
     route() ignores a change of fragment, so nothing here re-renders the page. */
  function setFragment(slug) {
    const url = location.pathname + location.search + (slug ? "#" + encodeURIComponent(slug) : "");
    history.replaceState(history.state, "", url);
  }

  function matches(e) {
    const labels = e.map.map(m => m.stops.map(s => s[2] || "").join(" ")).join(" ");
    const hay = [e.title, e.summary || "", e.countries.join(" "), (e.tags || []).join(" "), rangeText(e), labels].join(" ");
    return hay.toLowerCase().indexOf(A.query) >= 0;
  }

  /* ---- the axis ----
     Laid out from numbers alone, nothing measured: the rows carry only short labels, so no
     wrap or late webfont can move a tick, and the bars can use the same y values directly. */
  function gapFor(years) {
    return Math.round(GAP_MIN + GAP_PER_TENFOLD * Math.log(years) / Math.LN10);
  }

  /* A lane is wide enough for a bar and its duration, until there are too many to fit: then
     the lanes narrow and only the card gives the durations, rather than the axis pushing a
     phone sideways or squeezing the map to a thumbnail. Worked out from the most lanes the
     unfiltered axis needs and held there, so that typing in the search moves no column. */
  function laneWidth() {
    if (!A.lanes) return LANE_W;
    const room = isNarrow() ? A.grid.clientWidth - LANE_X - 6
      : A.grid.clientWidth * AXIS_SHARE - LANE_X - 16 - CARD_W;
    return Math.min(LANE_W, Math.max(LANE_MIN, room / A.lanes));
  }

  function buildAxis() {
    const evs = A.query ? A.events.filter(matches) : A.events;
    A.shown = evs;
    A.spot = bare();
    A.cardKey = null;
    A.drawn = null;

    if (!evs.length) {
      A.years = A.ty = [];
      A.rows = A.bars = A.card = null;
      A.tl.style.height = "";
      A.tl.innerHTML = `<p class="empty">${A.query ? "No event matches that." : "No events yet."}</p>`;
      return;
    }

    const seen = new Map();
    evs.forEach(e => { seen.set(e.start.y, 1); seen.set(endYear(e), 1); });
    const years = Array.from(seen.keys()).sort((a, b) => astro(a) - astro(b));
    const index = new Map(years.map((y, i) => [y, i]));
    const ty = [TOP];
    for (let i = 1; i < years.length; i++) ty.push(ty[i - 1] + gapFor(astro(years[i]) - astro(years[i - 1])));

    /* a tick says "c." only when everything anchored to it is approximate, and "now" only
       when all that is anchored to it is a span that has not ended */
    const circa = years.map(() => true), nowOnly = years.map(() => true);
    evs.forEach(e => {
      const a = index.get(e.start.y), b = index.get(endYear(e));
      A.spot[e.slug] = { a, b, lane: -1 };
      if (!e.start.c) circa[a] = false;
      nowOnly[a] = false;
      if (e.end) {
        if (!e.end.c) circa[b] = false;
        if (!e.end.now) nowOnly[b] = false;
      }
    });
    const label = i => (nowOnly[i] ? "now" : (circa[i] ? "c. " : "") + yearText(years[i]));
    A.years = years;
    A.ty = ty;
    A.labelOf = label;

    /* first-fit by start, longest first on a tie, so a long span settles in an early lane.
       Strictly less than: two bars meeting at one year would read as a single longer bar. */
    const laneEnd = [];
    const spans = evs.filter(e => A.spot[e.slug].a < A.spot[e.slug].b).sort((p, q) => {
      const s = A.spot[p.slug], t = A.spot[q.slug];
      return s.a - t.a || t.b - s.b;
    });
    spans.forEach(e => {
      const s = A.spot[e.slug];
      let l = 0;
      while (l < laneEnd.length && laneEnd[l] >= s.a) l++;
      laneEnd[l] = s.b;
      s.lane = l;
    });

    const last = years.length - 1;
    A.lanes = Math.max(A.lanes, laneEnd.length);
    const laneW = A.laneW = laneWidth();
    const axisW = LANE_X + A.lanes * laneW + 6;
    A.axis.style.setProperty("--axis-w", axisW + "px");
    A.axis.style.setProperty("--card-l", (axisW + 10) + "px");
    A.axis.style.setProperty("--tl-w", (axisW + 10 + CARD_W) + "px");
    A.axis.style.setProperty("--spine-x", SPINE_X + "px");
    A.tl.style.height = (ty[last] + TAIL + 10) + "px";

    let spine = `<i class="ts tail" style="top:${ty[0] - TAIL}px;height:${TAIL}px"></i>
      <i class="ts tail end" style="top:${ty[last]}px;height:${TAIL}px"></i>`;
    for (let i = 0; i < last; i++) {
      const gap = astro(years[i + 1]) - astro(years[i]);
      const far = gap >= FAR;
      spine += `<i class="ts${far ? " far" : ""}" style="top:${ty[i]}px;height:${ty[i + 1] - ty[i]}px"></i>`;
      if (far) spine += `<span class="tg" style="top:${(ty[i] + ty[i + 1]) / 2}px">${circa[i] || circa[i + 1] ? "~" : ""}${gap.toLocaleString("en-US")} yrs</span>`;
    }

    const rows = years.map((y, i) => {
      const top = i ? (ty[i - 1] + ty[i]) / 2 : ty[0] - TAIL;
      const bottom = i < last ? (ty[i] + ty[i + 1]) / 2 : ty[i] + TAIL;
      const count = evs.filter(e => A.spot[e.slug].a <= i && i <= A.spot[e.slug].b).length;
      return `<button class="ty" data-i="${i}" tabindex="${i ? -1 : 0}" aria-pressed="false"
        aria-label="${esc(label(i))}: ${count} event${count === 1 ? "" : "s"}" style="top:${top}px;height:${bottom - top}px">
        <span class="ty-label" style="top:${ty[i] - top}px">${esc(label(i))}</span>
        <i class="ty-tick" style="top:${ty[i] - top}px"></i>
        <i class="ty-guide" style="top:${ty[i] - top}px"></i>
      </button>`;
    }).join("");

    const bars = spans.map(e => {
      const s = A.spot[e.slug], h = ty[s.b] - ty[s.a], dur = spanText(e, true);
      return `<button class="tb" data-slug="${esc(e.slug)}" tabindex="-1"
        aria-label="${esc(e.title)}, ${esc(rangeText(e))}" style="left:${LANE_X + s.lane * laneW}px;top:${ty[s.a]}px;height:${h}px;width:${laneW}px">
        <i></i>${laneW >= LANE_W && h >= BAR_LABEL_MIN && dur ? `<span class="tb-dur">${esc(dur)}</span>` : ""}
      </button>`;
    }).join("");

    A.tl.innerHTML = spine + rows + bars + `<div class="tl-card" hidden></div>`;
    A.rows = Array.prototype.slice.call(A.tl.querySelectorAll(".ty"));
    A.bars = Array.prototype.slice.call(A.tl.querySelectorAll(".tb"));
    A.card = A.tl.querySelector(".tl-card");
  }

  /* what the world was doing in one recorded year: what began or happened then, what ended
     then, and what was already under way. The last is the point of a world history. */
  function eventsAt(i) {
    const out = { opens: [], closes: [], during: [] };
    A.shown.forEach(e => {
      const s = A.spot[e.slug];
      if (s.a === i) out.opens.push(e);
      else if (s.b === i) out.closes.push(e);
      else if (s.a < i && i < s.b) out.during.push(e);
    });
    return out;
  }

  const shownYear = () => (A.hover !== null ? A.hover : A.pin);

  /* ---- the card beside the tick ---- */
  function entry(e) {
    const dur = spanText(e);
    return `<button class="ce" data-slug="${esc(e.slug)}">
      <span class="ce-title">${isolateRtl(esc(e.title))}<span class="ce-where">${isolateRtl(esc(e.countries.join(", ")))}</span></span>
      <span class="ce-meta">${esc(rangeText(e))}${dur ? " · " + esc(dur) : ""}</span>
    </button>`;
  }

  function yearCard(i) {
    const at = eventsAt(i);
    return `<div class="c-year">${esc(A.labelOf(i))}</div>` +
      at.opens.concat(at.closes).map(entry).join("") +
      (at.during.length ? `<div class="c-sub">Under way</div>` + at.during.map(entry).join("") : "");
  }

  function paintCard() {
    const card = A.card;
    if (!card) return;
    const i = shownYear();
    if (A.bar === null && i === null) {
      if (!card.hidden) card.hidden = true;
      A.cardKey = null;
      return;
    }
    /* rewritten only when what it shows changes: rewriting it under the pointer would refire
       mouseover on the new nodes and lose the card's scroll position */
    const key = A.bar !== null ? "b:" + A.bar : "y:" + i;
    if (key !== A.cardKey) {
      A.cardKey = key;
      card.innerHTML = A.bar !== null ? entry(A.by[A.bar]) : yearCard(i);
      card.hidden = false;
      card.scrollTop = 0;
      placeCard(A.bar !== null ? A.barY : A.ty[i]);
    }
    card.classList.toggle("pinned", A.bar === null && A.hover === null && A.pin !== null);
    Array.prototype.forEach.call(card.querySelectorAll(".ce"), b =>
      b.classList.toggle("sel", b.getAttribute("data-slug") === A.sel));
  }

  /* Below the breakpoint the map rides at the top of the window and an opened event comes up
     from the bottom, so what can be seen of the axis is the band between them. Asking the CSS
     keeps the breakpoint in style.css alone. */
  const isNarrow = () => getComputedStyle(A.grid).flexDirection === "column";

  function band() {
    if (!isNarrow()) return { top: 12, bottom: window.innerHeight - 12 };
    return {
      top: A.side.getBoundingClientRect().bottom + SIDE_GAP,
      bottom: (A.sel ? A.detail.getBoundingClientRect().top : window.innerHeight) - SIDE_GAP,
    };
  }

  /* Level with its tick, and held inside the band while the tick is in it. With the tick
     scrolled away the card goes with it: a pinned card clamped to the window would sit beside
     the wrong years. `dy` is a scroll that has been asked for and has not happened yet. */
  function placeCard(y, dy) {
    const card = A.card, at = A.tl.getBoundingClientRect().top - (dy || 0), b = band();
    let top = y - 15;
    card.style.maxHeight = "";
    if (at + y >= b.top && at + y <= b.bottom) {
      card.style.maxHeight = (b.bottom - b.top) + "px";
      const h = card.offsetHeight;
      if (at + top + h > b.bottom) top = b.bottom - h - at;
      if (at + top < b.top) top = b.top - at;
    }
    card.style.top = top + "px";
  }

  /* Bring a tick into the band, if it is not there, or if the band is too thin to show its card:
     at the top of the page the map has not stuck yet and the sheet can leave a sliver. The height
     of the side, not its current bottom edge: by the time the scroll has finished it may have stuck. */
  function reveal(i, smooth) {
    const b = band(), y = A.tl.getBoundingClientRect().top + A.ty[i];
    if (y >= b.top + 8 && y <= b.bottom - 8 && b.bottom - b.top >= BAND_MIN) return 0;
    const top = isNarrow() ? A.side.offsetHeight + SIDE_GAP : b.top;
    const dy = y - (top + b.bottom) / 2;
    if (smooth && !still()) window.scrollBy({ top: dy, behavior: "smooth" });
    else window.scrollBy(0, dy);
    return dy;
  }

  function settle(i, smooth) {
    const dy = reveal(i, smooth);
    if (A.card && !A.card.hidden && shownYear() === i) placeCard(A.ty[i], dy);
  }

  function paintAxis() {
    const i = shownYear();
    const sel = A.sel ? A.spot[A.sel] : null;
    A.tl.classList.toggle("previewing", A.hover !== null || A.bar !== null);
    if (A.rows) A.rows.forEach((row, j) => {
      row.classList.toggle("on", j === A.hover);
      row.classList.toggle("pin", j === A.pin);
      row.classList.toggle("sel", !!sel && (j === sel.a || j === sel.b));
      row.setAttribute("aria-pressed", String(j === A.pin));
    });
    if (A.bars) A.bars.forEach(bar => {
      const slug = bar.getAttribute("data-slug"), s = A.spot[slug];
      bar.classList.toggle("on", slug === A.bar || slug === A.peek || (A.bar === null && i !== null && s.a <= i && i <= s.b));
      bar.classList.toggle("sel", slug === A.sel);
    });
  }

  /* ---- hovering ----
     Sliding along the axis has to feel like scrubbing, so with nothing pinned a row answers
     at once. With a year pinned its card holds things to click, and the line from a tick to a
     lower entry in that card crosses other rows and bars: if they answered, the card would be
     gone before the pointer reached it. So they answer only once the pointer has stopped, and
     not merely once it has stayed a moment in one row, which a slow hand does on every row. */
  function hoverSoon(v) {
    clearHoverWait();
    const wait = A.pin !== null ? INTENT_MS : v === null ? 80 : 0;
    if (!wait) { setHover(v); return; }
    A.waiting = { v, wait };
    A.timer = setTimeout(hoverNow, wait);
  }

  function hoverNow() {
    if (!alive() || !A.waiting) return;
    const v = A.waiting.v;
    A.waiting = null;
    setHover(v);
  }

  function clearHoverWait() {
    clearTimeout(A.timer);
    A.waiting = null;
  }

  function setHover(v) {
    /* the pinned year's own tick previews nothing: its card is already up, and has to stay
       clickable while the pointer sets off from that tick towards it */
    const hover = v && "i" in v && v.i !== A.pin ? v.i : null;
    const bar = v && "bar" in v ? v.bar : null;
    if (hover === A.hover && bar === A.bar) return;
    A.hover = hover;
    A.bar = bar;
    A.peek = bar;
    if (v && "y" in v) A.barY = v.y;
    paint();
  }

  function setPeek(slug) {
    if (A.peek === slug) return;
    A.peek = slug;
    paint();
  }

  function bindAxis() {
    const tl = A.tl;
    if (canHover()) {
      tl.addEventListener("mouseover", e => {
        const hit = e.target;
        const ce = closest(hit, ".ce");
        if (ce) { clearHoverWait(); setPeek(ce.getAttribute("data-slug")); return; }
        if (closest(hit, ".tl-card")) { clearHoverWait(); setPeek(null); return; }
        const bar = closest(hit, ".tb");
        if (bar) {
          const r = tl.getBoundingClientRect();
          hoverSoon({ bar: bar.getAttribute("data-slug"), y: e.clientY - r.top });
          return;
        }
        const row = closest(hit, ".ty");
        hoverSoon(row ? { i: Number(row.getAttribute("data-i")) } : null);
      });
      tl.addEventListener("mouseleave", () => hoverSoon(null));
      tl.addEventListener("mousemove", () => {
        if (A.pin === null || !A.waiting) return;
        clearTimeout(A.timer);
        A.timer = setTimeout(hoverNow, A.waiting.wait);
      });
    }
    tl.addEventListener("click", e => {
      const ce = closest(e.target, ".ce");
      if (ce) { select(ce.getAttribute("data-slug")); return; }
      const bar = closest(e.target, ".tb");
      if (bar) { clearHoverWait(); A.pin = null; select(bar.getAttribute("data-slug")); return; }
      const row = closest(e.target, ".ty");
      if (row) clickYear(Number(row.getAttribute("data-i")), e.detail === 0);
    });
    tl.addEventListener("keydown", e => {
      const row = closest(e.target, ".ty");
      if (!row || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
      e.preventDefault();
      const i = Number(row.getAttribute("data-i")) + (e.key === "ArrowDown" ? 1 : -1);
      const next = A.rows[i];
      if (!next) return;
      row.setAttribute("tabindex", "-1");
      next.setAttribute("tabindex", "0");
      next.focus();
      settle(i);       // the browser's own scroll to a focused element knows nothing of the map
    });
    tl.addEventListener("focusin", e => {
      const row = closest(e.target, ".ty");
      if (row && usingKeys) { clearHoverWait(); setHover({ i: Number(row.getAttribute("data-i")) }); }
    });
    tl.addEventListener("focusout", e => {
      if (usingKeys && !tl.contains(e.relatedTarget)) hoverSoon(null);
    });
  }

  /* A click is a new question, so it clears the map of whatever was open. A year holding one
     event has nothing to choose between, so that event simply opens. */
  function clickYear(i, keyed) {
    clearHoverWait();
    if (A.pin === i) {
      A.pin = null;
      A.hover = null;
      closeEvent();
      return;
    }
    A.pin = i;
    A.hover = null;
    A.bar = null;
    A.peek = null;
    const at = eventsAt(i), all = at.opens.concat(at.closes, at.during);
    if (all.length === 1) select(all[0].slug);
    else closeEvent();
    if (keyed && A.card) {
      const first = A.card.querySelector(".ce");
      if (first) first.focus();
    }
  }

  /* ---- an event, opened ---- */
  /* `arriving`: the page has just been reached by a link, so the tick goes straight to where it
     can be seen, at any width. A tap only has to keep it clear of the sheet, and may take its time. */
  function select(slug, arriving) {
    const e = A.by[slug];
    if (!e) return;
    A.sel = slug;
    A.peek = null;
    A.bar = null;
    setFragment(slug);
    A.target = fit(e);
    document.body.classList.add("ev-open");
    A.side.classList.add("open");
    renderDetail(e);
    paint();
    flyTo(A.target);
    if (A.pin !== null && (arriving || isNarrow())) settle(A.pin, !arriving);
  }

  function closeEvent() {
    A.sel = null;
    A.peek = null;
    setFragment("");
    A.target = WORLD;
    document.body.classList.remove("ev-open");
    A.side.classList.remove("open");
    A.detail.classList.remove("open");
    A.detail.innerHTML = "";
    paint();
    flyTo(WORLD);
    /* the band has just grown, and the card can stretch back out into it */
    if (A.pin !== null && A.card && !A.card.hidden && A.hover === null) placeCard(A.ty[A.pin]);
  }

  /* from a link or the page's own URL, where nothing on the axis has been touched yet: put
     the event's tick in view too, and take off a search that would be hiding it */
  function open(slug) {
    if (!alive() || !A.by[slug]) return;
    if (A.query && !A.spot[slug]) {
      A.query = "";
      const search = A.host.querySelector("#atlas-search");
      if (search) search.value = "";
      buildAxis();
    }
    clearHoverWait();
    A.pin = A.spot[slug] ? A.spot[slug].a : null;
    A.hover = null;
    select(slug, true);
  }

  /* one line under the map saying what there is and how to get at it, worked out from the
     whole axis before any search has narrowed it */
  function renderCaption() {
    const n = A.events.length;
    const el = A.host.querySelector(".at-caption");
    if (!n) return;
    const hint = canHover()
      ? "Hover a year on the line to see what the world was doing then. Click to open it."
      : "Tap a year on the line to see what the world was doing then.";
    const first = A.labelOf(0), last = A.labelOf(A.years.length - 1);
    el.innerHTML = `
      <p class="at-rest">${n} event${n === 1 ? "" : "s"} · ${esc(first === last ? first : first + " - " + last)}</p>
      <p class="at-rest hint">${hint}</p>`;
  }

  function renderDetail(e) {
    const dur = spanText(e);
    const search = !!A.host.querySelector("#atlas-search");
    const places = e.countries.map(c => search
      ? `<button class="ev-country" data-q="${esc(c)}">${isolateRtl(esc(c))}</button>`
      : isolateRtl(esc(c))).join(", ");
    A.detail.classList.add("open");
    A.detail.innerHTML = `
      <div class="ev-head">
        <h2 class="ev-title">${isolateRtl(esc(e.title))}</h2>
        <button class="rev-close ev-close" aria-label="Close">×</button>
      </div>
      <div class="ev-meta">${esc(rangeText(e))}${dur ? " · " + esc(dur) : ""} · ${places}</div>
      ${e.summary ? `<p class="ev-sum">${isolateRtl(esc(e.summary))}</p>` : ""}
      <div class="prose ev-body"></div>`;
    A.detail.scrollTop = 0;
    const body = A.detail.querySelector(".ev-body");
    const at = e.slug;
    loadBody(e).then(html => { if (alive() && A.sel === at && body.isConnected) body.innerHTML = html; });
  }

  async function loadBody(e) {
    if (e.slug in bodies) return bodies[e.slug];
    let html = "";
    try {
      const res = await fetch(EVENT_BASE + encodeURIComponent(e.slug) + ".md", { cache: "no-cache" });
      if (res.ok) html = renderMarkdown(parseFrontmatter(await res.text()).body);
      else return "";
    } catch (err) { return ""; }
    bodies[e.slug] = html;
    return html;
  }

  function onDetailClick(e) {
    if (closest(e.target, ".ev-close")) { closeEvent(); return; }
    const c = closest(e.target, ".ev-country");
    if (c) {
      const search = A.host.querySelector("#atlas-search");
      if (!search) return;
      search.value = c.getAttribute("data-q");
      search.dispatchEvent(new Event("input"));
      search.focus();
    }
  }

  /* ---- the map ---- */
  function pxPerUnit(v) {
    const r = A.svg.getBoundingClientRect();
    return Math.min(r.width / v.w, r.height / v.h) || 1;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function fit(e) {
    const ps = [];
    e.map.forEach(m => m.stops.forEach(s => ps.push(project(s[0], s[1]))));
    if (!ps.length) return WORLD;
    const xs = ps.map(p => p[0]), ys = ps.map(p => p[1]);
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    const y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    const floor = Math.max(x1 - x0, y1 - y0) < 1 ? ONE_PLACE_W : SOME_PLACES_W;
    const w = Math.max((x1 - x0) * 1.7, (y1 - y0) * 1.7 / ASPECT, floor);
    if (w >= WORLD.w * 0.8) return WORLD;
    const h = w * ASPECT;
    return {
      x: clamp((x0 + x1) / 2 - w / 2, WORLD.x, WORLD.x + WORLD.w - w),
      y: clamp((y0 + y1) / 2 - h / 2, WORLD.y, WORLD.y + WORLD.h - h),
      w, h,
    };
  }

  /* Marks and labels are sized in pixels and undo the zoom at every step, so they stay the
     same size while the land grows under them. Lines get the same from non-scaling-stroke. */
  function setView(v) {
    A.view = v;
    A.svg.setAttribute("viewBox", v.x + " " + v.y + " " + v.w + " " + v.h);
    A.k = pxPerUnit(v);
    rescale();
  }

  function rescale() {
    const s = 1 / A.k;
    for (let i = 0; i < A.scaled.length; i++) {
      const m = A.scaled[i];
      m.node.setAttribute("transform", "translate(" + m.x + " " + m.y + ") scale(" + s + ")" + (m.rot ? " rotate(" + m.rot + ")" : ""));
    }
  }

  /* The box edges move in straight lines, so a place being flown to stays inside the frame
     for the whole flight; easing out then hides how fast the scale changes near the end. */
  function flyTo(v) {
    cancelAnimationFrame(A.raf);
    A.frame.classList.toggle("near", v !== WORLD);
    const from = A.view, mine = A;
    if (still() || (from.x === v.x && from.y === v.y && from.w === v.w)) {
      A.frame.classList.remove("flying");
      setView(v);
      return;
    }
    /* the names are placed for where the map is going, so on the way there they would pile up */
    A.frame.classList.add("flying");
    let t0 = 0;
    const step = now => {
      if (A !== mine || !alive()) return;
      if (!t0) t0 = now;
      const t = Math.min(1, (now - t0) / FLY_MS), e = 1 - Math.pow(1 - t, 3);
      const mix = (a, b) => a + (b - a) * e;
      setView(t === 1 ? v : { x: mix(from.x, v.x), y: mix(from.y, v.y), w: mix(from.w, v.w), h: mix(from.h, v.h) });
      if (t < 1) A.raf = requestAnimationFrame(step);
      else A.frame.classList.remove("flying");
    };
    A.raf = requestAnimationFrame(step);
  }

  function centroid(ps) {
    let x = 0, y = 0;
    ps.forEach(p => { x += p[0]; y += p[1]; });
    return [x / ps.length, y / ps.length];
  }

  /* a region is a loose claim, so it is drawn as a soft shape through the midpoints of its
     sides rather than as a polygon, whose corners would claim a precision nobody has */
  function blob(ps) {
    const n = ps.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let d = "M" + pair(mid(ps[n - 1], ps[0]));
    for (let i = 0; i < n; i++) d += "Q" + pair(ps[i]) + " " + pair(mid(ps[i], ps[(i + 1) % n]));
    return d + "Z";
  }

  /* a leg that crosses the date line would otherwise be drawn the long way round the map:
     run it to the edge of the world and carry on from the opposite edge */
  function routePath(stops) {
    let d = "M" + pair(project(stops[0][0], stops[0][1]));
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1], b = stops[i];
      if (Math.abs(b[1] - a[1]) > 180) {
        const edge = a[1] > 0 ? 180 : -180;
        const lon = a[1] > 0 ? b[1] + 360 : b[1] - 360;
        const lat = a[0] + (edge - a[1]) / (lon - a[1]) * (b[0] - a[0]);
        d += "L" + pair(project(lat, edge)) + "M" + pair(project(lat, -edge));
      }
      d += "L" + pair(project(b[0], b[1]));
    }
    return d;
  }

  /* which events the map is showing, and how strongly. An opened event holds the map still
     under anything else the pointer does, because the reader is reading it. */
  function wanted() {
    const out = [];
    if (A.sel) {
      out.push({ e: A.by[A.sel], level: 2 });
      if (A.peek && A.peek !== A.sel && A.by[A.peek]) out.push({ e: A.by[A.peek], level: 1 });
      return out;
    }
    const i = shownYear();
    if (i !== null && A.bar === null) {
      const at = eventsAt(i);
      at.opens.concat(at.closes).forEach(e => out.push({ e, level: A.peek && A.peek !== e.slug ? 1 : 2 }));
      at.during.forEach(e => out.push({ e, level: A.peek === e.slug ? 2 : 1 }));
    } else if (A.peek && A.by[A.peek]) {
      out.push({ e: A.by[A.peek], level: 2 });
    }
    return out;
  }

  function paintMap() {
    const shown = wanted();
    const key = shown.map(s => s.e.slug + ":" + s.level).join("|") + "@" + A.target.x + "," + A.target.w;
    if (key === A.drawn) return;
    A.drawn = key;

    /* a faint point for every event but those being marked properly, whose own marks say more:
       a region's point, left under its shape, would read as a place inside it */
    const marked = bare();
    shown.forEach(x => { marked[x.e.slug] = true; });
    A.dots.setAttribute("d", A.shown.filter(e => !marked[e.slug]).map(e => e.map.map(m => {
      const p = m.kind === "area" ? centroid(m.stops.map(q => project(q[0], q[1]))) : project(m.stops[0][0], m.stops[0][1]);
      return "M" + pair(p) + "h.01";
    }).join("")).join(""));

    let areas = "", routes = "", marks = "", texts = "";
    const points = new Map(), labels = [];
    A.legs = [];
    const addPoint = (s, level) => {
      const id = s[0] + "," + s[1], had = points.get(id);
      if (had) {
        had.level = Math.max(had.level, level);
        if (!had.label && s[2]) had.label = s[2];
      } else points.set(id, { p: project(s[0], s[1]), label: s[2] || "", level });
    };
    shown.forEach(({ e, level }) => e.map.forEach(m => {
      if (m.kind === "area") {
        const ps = m.stops.map(s => project(s[0], s[1])), c = centroid(ps);
        areas += `<path class="mk-area lv${level}" d="${blob(ps)}"/>`;
        if (m.stops[0][2]) {
          const xs = ps.map(q => q[0]), ys = ps.map(q => q[1]);
          labels.push({
            p: c, label: m.stops[0][2], level, area: true,
            rx: (Math.max.apply(null, xs) - Math.min.apply(null, xs)) / 2,
            ry: (Math.max.apply(null, ys) - Math.min.apply(null, ys)) / 2,
          });
        }
        return;
      }
      if (m.kind === "route") {
        routes += `<path class="mk-route lv${level}" d="${routePath(m.stops)}"/>`;
        m.stops.slice(1).forEach((s, i) => {
          if (Math.abs(s[1] - m.stops[i][1]) <= 180) A.legs.push([project(m.stops[i][0], m.stops[i][1]), project(s[0], s[1])]);
        });
        const a = project(m.stops[m.stops.length - 2][0], m.stops[m.stops.length - 2][1]);
        const b = project(m.stops[m.stops.length - 1][0], m.stops[m.stops.length - 1][1]);
        const rot = Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
        const legPx = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2)) * pxPerUnit(A.target);
        if (legPx >= ARROW_LEG_MIN) marks += `<path class="mk-arrow lv${level}" data-x="${n2(b[0])}" data-y="${n2(b[1])}" data-r="${n2(rot)}" d="M-14 -4.5L-7 0L-14 4.5"/>`;
      }
      m.stops.forEach(s => addPoint(s, level));
    }));
    points.forEach(pt => {
      marks += `<circle class="mk-pt lv${pt.level}" data-x="${n2(pt.p[0])}" data-y="${n2(pt.p[1])}" r="${pt.level === 2 ? 3.6 : 2.6}"/>`;
      if (pt.label) labels.push(pt);
    });
    /* the strong ones choose first, so a crowded year loses its faintest names, not its main ones */
    labels.sort((a, b) => b.level - a.level);
    labels.forEach(l => {
      const size = l.area ? ` data-rx="${n2(l.rx)}" data-ry="${n2(l.ry)}"` : "";
      texts += `<text class="mk-label lv${l.level}${l.area ? " area" : ""}" data-x="${n2(l.p[0])}" data-y="${n2(l.p[1])}"${size} dy=".35em" text-anchor="middle">${esc(l.label)}</text>`;
    });
    A.layer.innerHTML = areas + routes + marks + texts;

    A.scaled = Array.prototype.map.call(A.layer.querySelectorAll("[data-x]"), node => ({
      node,
      x: Number(node.getAttribute("data-x")),
      y: Number(node.getAttribute("data-y")),
      rot: node.getAttribute("data-r"),
    }));
    placeLabels();
    rescale();
  }

  /* Each name takes the first spot beside its mark that is inside the frame and clear of
     every other mark and name, judged at the view being flown to, and clear of the routes too if
     any spot is: a line through a name reads as struck out. A name with nowhere at all to go is
     dropped: the card and the article still give it, and two names on top of each other give
     neither. */
  const SPOTS = [
    [10, 0, "start"], [-10, 0, "end"], [0, -13, "middle"], [0, 14, "middle"],
    [9, -10, "start"], [9, 11, "start"], [-9, -10, "end"], [-9, 11, "end"],
  ];

  /* a region's name goes inside it if it fits, and otherwise stands just outside its edge */
  function regionSpots(t, k) {
    const rx = Number(t.getAttribute("data-rx")) * k, ry = Number(t.getAttribute("data-ry")) * k;
    return [[0, 0, "middle"], [0, -ry - 11, "middle"], [0, ry + 11, "middle"], [rx + 6, 0, "start"], [-rx - 6, 0, "end"]];
  }

  /* does the line from a to b pass through the box r? Liang-Barsky */
  function crosses(r, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const p = [-dx, dx, -dy, dy], q = [a[0] - r[0], r[2] - a[0], a[1] - r[1], r[3] - a[1]];
    let t0 = 0, t1 = 1;
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return false;
        continue;
      }
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
    return true;
  }

  function placeLabels() {
    const v = A.target, k = pxPerUnit(v);
    const W = v.w * k, H = v.h * k;
    const taken = [];
    const toPx = (x, y) => [(x - v.x) * k, (y - v.y) * k];
    const legs = A.legs.map(l => [toPx(l[0][0], l[0][1]), toPx(l[1][0], l[1][1])]);
    Array.prototype.forEach.call(A.layer.querySelectorAll(".mk-pt"), c => {
      const p = toPx(Number(c.getAttribute("data-x")), Number(c.getAttribute("data-y")));
      taken.push([p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5]);
    });
    const clear = r => r[0] >= 4 && r[1] >= 4 && r[2] <= W - 4 && r[3] <= H - 4 &&
      !taken.some(t => r[0] < t[2] && t[0] < r[2] && r[1] < t[3] && t[1] < r[3]);
    const offLines = r => !legs.some(l => crosses(r, l[0], l[1]));

    Array.prototype.forEach.call(A.layer.querySelectorAll(".mk-label"), t => {
      const p = toPx(Number(t.getAttribute("data-x")), Number(t.getAttribute("data-y")));
      const box = t.getBBox(), w = box.width, h = box.height;
      const spots = t.classList.contains("area") ? regionSpots(t, k) : SPOTS;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < spots.length; i++) {
          const s = spots[i];
          const x0 = s[2] === "start" ? p[0] + s[0] : s[2] === "end" ? p[0] + s[0] - w : p[0] + s[0] - w / 2;
          const y0 = p[1] + s[1] - h / 2;
          const r = [x0, y0, x0 + w, y0 + h];
          if (clear(r) && (pass || offLines(r))) {
            taken.push(r);
            t.setAttribute("x", s[0]);
            t.setAttribute("y", s[1]);
            t.setAttribute("text-anchor", s[2]);
            return;
          }
        }
      }
      t.setAttribute("display", "none");
    });
  }

  /* the eye is on the map while the hand is on the axis, so the map says which year it is */
  function paintStamp() {
    const i = A.sel || A.bar !== null ? null : shownYear();
    A.stamp.hidden = i === null;
    if (i !== null) A.stamp.textContent = A.labelOf(i);
  }

  function paint() {
    paintAxis();
    paintCard();
    paintStamp();
    paintMap();
  }

  /* These live for as long as the document does, and do nothing unless this page is up. */
  function hookOnce() {
    if (hooked) return;
    hooked = true;
    document.addEventListener("keydown", e => {
      if (e.key === "Tab" || e.key.indexOf("Arrow") === 0) usingKeys = true;
      if (e.key !== "Escape" || !alive()) return;
      const pinned = A.pin;
      clearHoverWait();
      if (A.sel) closeEvent();
      else if (A.pin !== null) {
        A.pin = null;
        paint();
      }
      if (usingKeys && pinned !== null && A.rows && A.rows[pinned]) A.rows[pinned].focus();
    });
    document.addEventListener("mousedown", () => { usingKeys = false; });
    document.addEventListener("touchstart", () => { usingKeys = false; }, { passive: true });
    /* A click anywhere off the atlas puts the pinned card away; the event stays open. A link
       in the prose redraws the prose before the click gets here, so its target is no longer
       anywhere: that click came from inside, and looking it up would say otherwise. */
    document.addEventListener("click", e => {
      if (!alive() || A.pin === null || !e.target.isConnected || closest(e.target, ".at-grid")) return;
      clearHoverWait();
      A.pin = null;
      paint();
    });
    /* An edit of the URL or a followed link. A footnote changes the fragment as well, and
       that is not an event, so anything unknown is left alone. Selecting here re-renders
       nothing, which is the rule route() is guarding. */
    window.addEventListener("hashchange", () => {
      if (!alive()) return;
      const slug = fragment();
      if (A.by[slug] && slug !== A.sel) open(slug);
    });
    const redraw = () => {
      if (!alive()) return;
      A.drawn = null;
      paintMap();
      setView(A.view);
    };
    window.addEventListener("resize", () => {
      if (!alive()) return;
      if (A.years.length && laneWidth() !== A.laneW) {
        buildAxis();
        A.cardKey = null;
        paint();
      }
      redraw();
    });
    /* Names are measured to be placed, and the webfont changes every one of them. `ready` alone
       is not enough: the font comes in unicode-range subsets, requested only once a character
       needs them, which is after `ready` has already resolved. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(redraw);
      if (document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", redraw);
    }
  }

  window.Atlas = { mount, open };
})();
