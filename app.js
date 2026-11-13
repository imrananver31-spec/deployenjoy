/* Deploy&Enjoy Mini App */
const CONFIG = {
  CHANNEL_URL: "https://t.me/deployenjoy_ru",
  CHAT_URL: "",            // ссылка-приглашение в чат, например https://t.me/+xxxx
  BOT_URL: "https://t.me/deployenjoy_bot"
};

const tg = window.Telegram && window.Telegram.WebApp;
const ver = (v) => !!(tg && tg.isVersionAtLeast && tg.isVersionAtLeast(v));
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");

/* ---------------- Telegram ---------------- */
if (tg) {
  tg.ready();
  tg.expand();
  if (ver("6.1")) { tg.setHeaderColor("#0A0A0A"); tg.setBackgroundColor("#0A0A0A"); }
  if (ver("7.7")) tg.disableVerticalSwipes();
}
const haptic = (type) => { try { if (ver("6.1")) type === "tap" ? tg.HapticFeedback.impactOccurred("light") : tg.HapticFeedback.notificationOccurred(type); } catch (e) {} };
const openLink = (url) => {
  if (!url) return;
  if (tg && url.startsWith("https://t.me/")) tg.openTelegramLink(url);
  else if (tg) tg.openLink(url);
  else window.open(url, "_blank");
};

/* ---------------- хранилище: облако Telegram + localStorage ---------------- */
const cloud = ver("6.9") && tg.CloudStorage;
const store = {
  get(k) {
    const local = () => { try { return localStorage.getItem("de_" + k); } catch (e) { return null; } };
    return new Promise((res) => {
      if (!cloud) return res(local());
      tg.CloudStorage.getItem(k, (err, v) => res(err || !v ? local() : v));
    });
  },
  set(k, v) {
    try { localStorage.setItem("de_" + k, v); } catch (e) {}
    if (cloud) tg.CloudStorage.setItem(k, v, () => {});
  }
};

/* ---------------- данные ---------------- */
const LESSONS = COURSE.flatMap((m) => m.lessons.map((l) => ({ ...l, mod: m })));
const byId = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
let done = new Set();
let checks = {};

const save = () => { store.set("done", JSON.stringify([...done])); store.set("checks", JSON.stringify(checks)); };
const nextLesson = () => LESSONS.find((l) => !done.has(l.id));
const pct = () => Math.round((done.size / LESSONS.length) * 100);
const modDone = (m) => m.lessons.filter((l) => done.has(l.id)).length;

/* ---------------- утилиты ---------------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>");
const user = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;

function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1600);
}

async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }
  haptic("success");
  if (btn) { btn.textContent = "Скопировано ✓"; btn.classList.add("ok"); setTimeout(() => { btn.textContent = "Скопировать"; btn.classList.remove("ok"); }, 1500); }
}

/* ---------------- конфетти ---------------- */
function confetti() {
  const c = $("#confetti"), ctx = c.getContext("2d");
  const W = (c.width = innerWidth * devicePixelRatio), H = (c.height = innerHeight * devicePixelRatio);
  const colors = ["#FF3B1F", "#F4F2EC", "#3DDC84", "#FF8A73"];
  const P = Array.from({ length: 140 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.65,
    vx: (Math.random() - 0.5) * 22 * devicePixelRatio, vy: -(Math.random() * 22 + 14) * devicePixelRatio,
    s: (Math.random() * 6 + 4) * devicePixelRatio, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: colors[(Math.random() * colors.length) | 0]
  }));
  const start = performance.now();
  (function frame(t) {
    const k = (t - start) / 1900;
    ctx.clearRect(0, 0, W, H);
    for (const p of P) {
      p.vy += 0.9 * devicePixelRatio; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    if (k < 1) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  })(start);
}

/* ---------------- навигация ---------------- */
let stack = [{ name: "course" }];
let tab = "course";
const TABS = ["course", "prompts", "glossary", "profile"];

function go(name, params = {}) { stack.push({ name, params }); render(); haptic("tap"); }
function back() { if (stack.length > 1) { stack.pop(); render(true); } }
function setTab(t) { tab = t; stack = [{ name: t }]; render(); haptic("tap"); }

if (tg && ver("6.1")) tg.BackButton.onClick(back);

document.querySelectorAll("#tabbar button").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

function syncChrome(view) {
  const i = TABS.indexOf(tab);
  document.querySelectorAll("#tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $(".tab-indicator").style.transform = `translateX(${i * 74}px)`;
  $("#tabbar").classList.toggle("hidden", view === "lesson");
  if (tg && ver("6.1")) stack.length > 1 ? tg.BackButton.show() : tg.BackButton.hide();
}

function render(isBack = false) {
  const { name, params } = stack[stack.length - 1];
  window.scrollTo(0, 0);
  const el = document.createElement("div");
  el.className = "view" + (isBack ? " back" : "");
  ({ course: viewCourse, module: viewModule, lesson: viewLesson, prompts: viewPrompts, glossary: viewGlossary, profile: viewProfile })[name](el, params || {});
  app.replaceChildren(el);
  syncChrome(name);
}

/* ---------------- экран: курс ---------------- */
function viewCourse(el) {
  const nxt = nextLesson();
  const p = pct();
  const C = 2 * Math.PI * 32;
  const hello = user ? `Привет, ${esc(user.first_name)} 👋` : "Привет 👋";
  el.innerHTML = `
    <div class="top rise" style="--i:0"><div class="mini-logo">D<i>&amp;</i>E</div><div class="hello">${hello}</div></div>
    ${nxt ? "" : `<div class="cert rise" style="--i:1"><span class="lbl">КУРС ПРОЙДЕН</span><h2>Ты прошёл весь курс 🔥</h2><p>Теперь — практика. Делай проекты, показывай их в чате и бери первых клиентов.</p></div>`}
    <section class="hero rise" style="--i:1">
      <h1>Вайбкодинг <em>с нуля</em></h1>
      <p>Сайты, боты и первые деньги — с нейросетью и без двух лет учёбы.</p>
      <div class="hero-row">
        <div class="ring"><svg viewBox="0 0 76 76"><circle class="bg" cx="38" cy="38" r="32"/><circle class="fg" cx="38" cy="38" r="32" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><span>${p}%</span></div>
        <div class="hero-stat"><b>${done.size} из ${LESSONS.length} уроков</b><small>${COURSE.length} модулей · ~3 часа</small></div>
      </div>
      ${nxt ? `<button class="btn continue" data-l="${nxt.id}"><span>${done.size ? "Продолжить" : "Начать курс"}<small>${esc(nxt.mod.num)} · ${esc(nxt.title)}</small></span><span class="arr">→</span></button>` : ""}
    </section>
    <div class="marquee" aria-hidden="true"><div>${"PROMPT ✦ BUILD ✦ DEPLOY <b>&amp;</b> ENJOY ✦ ".repeat(6)}</div></div>
    <div class="sec-title rise" style="--i:2">Программа</div>
    ${COURSE.map((m, i) => {
      const d = modDone(m), all = m.lessons.length;
      return `<button class="mod rise ${d === all ? "done" : ""}" style="--i:${i + 3}" data-m="${m.id}">
        <span class="num">${m.num}</span>
        <h3>${esc(m.title)}</h3><p>${esc(m.desc)}</p>
        <div class="bar"><i data-w="${(d / all) * 100}"></i></div>
        <div class="mod-meta"><span>${d === all ? "✓ Пройден" : `${d} / ${all} уроков`}</span><span>${m.lessons.reduce((s, l) => s + parseInt(l.time), 0)} мин</span></div>
      </button>`;
    }).join("")}
  `;
  el.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => go("module", { id: b.dataset.m })));
  el.querySelectorAll("[data-l]").forEach((b) => b.addEventListener("click", () => go("lesson", { id: b.dataset.l })));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const fg = el.querySelector(".ring .fg"); if (fg) fg.style.strokeDashoffset = C * (1 - p / 100);
    el.querySelectorAll(".bar i").forEach((i) => (i.style.width = i.dataset.w + "%"));
  }));
}

/* ---------------- экран: модуль ---------------- */
function viewModule(el, { id }) {
  const m = COURSE.find((x) => x.id === id);
  const nxt = nextLesson();
  el.innerHTML = `
    <button class="back-link" data-back>← Все модули</button>
    <div class="mod-head">
      <div class="big rise" style="--i:0">${m.num}</div>
      <h2 class="rise" style="--i:1">${esc(m.title)}</h2>
      <p class="rise" style="--i:2">${esc(m.desc)}</p>
    </div>
    ${m.lessons.map((l, i) => {
      const st = done.has(l.id) ? "done" : nxt && nxt.id === l.id ? "next" : "";
      return `<button class="lesson-item rise ${st}" style="--i:${i + 3}" data-l="${l.id}">
        <span class="dot">${st === "done" ? "✓" : i + 1}</span><span class="t">${esc(l.title)}</span><small>${l.time}</small></button>`;
    }).join("")}
  `;
  el.querySelector("[data-back]").addEventListener("click", back);
  el.querySelectorAll("[data-l]").forEach((b) => b.addEventListener("click", () => go("lesson", { id: b.dataset.l })));
}

/* ---------------- экран: урок ---------------- */
function block(b, lid, bi) {
  switch (b.t) {
    case "p": return `<p>${fmt(b.v)}</p>`;
    case "h": return `<h4>${fmt(b.v)}</h4>`;
    case "list": return `<ul>${b.v.map((x) => `<li>${fmt(x)}</li>`).join("")}</ul>`;
    case "steps": return `<ol>${b.v.map((x) => `<li>${fmt(x)}</li>`).join("")}</ol>`;
    case "tip": return `<div class="callout tip"><span class="ic">💡</span><div>${fmt(b.v)}</div></div>`;
    case "warn": return `<div class="callout warn"><span class="ic">⚠️</span><div>${fmt(b.v)}</div></div>`;
    case "task": return `<div class="callout task"><div><span class="lbl">ЗАДАНИЕ</span>${fmt(b.v)}</div></div>`;
    case "prompt": return `<div class="prompt"><div class="prompt-head"><span>${esc(b.label || "Промпт")}</span><button class="copy" data-copy="${lid}:${bi}">Скопировать</button></div><pre>${esc(b.v)}</pre></div>`;
    case "code": return `<div class="code"><div class="prompt-head"><span>Код</span><button class="copy" data-copy="${lid}:${bi}">Скопировать</button></div><pre>${esc(b.v)}</pre></div>`;
    case "check": return `<div class="checks"><span class="lbl">ПРОВЕРЬ СЕБЯ</span>${b.v.map((x, ci) => {
      const key = `${lid}:${bi}:${ci}`;
      return `<button class="chk ${checks[key] ? "on" : ""}" data-chk="${key}"><span class="box"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span><span>${fmt(x)}</span></button>`;
    }).join("")}</div>`;
  }
  return "";
}

function viewLesson(el, { id }) {
  const l = byId[id];
  const idx = LESSONS.indexOf(l);
  const next = LESSONS[idx + 1];
  const li = l.mod.lessons.findIndex((x) => x.id === id) + 1;
  el.innerHTML = `
    <div class="read-bar"></div>
    <button class="back-link" data-back>← ${esc(l.mod.title)}</button>
    <div class="lesson-head rise" style="--i:0">
      <div class="crumb">Модуль ${l.mod.num} · урок ${li}</div>
      <h1>${esc(l.title)}</h1>
      <div class="meta">⏱ ${l.time} · ${done.has(id) ? "✓ пройден" : "не пройден"}</div>
    </div>
    ${l.blocks.map((b, bi) => `<div class="blk rise" style="--i:${Math.min(bi + 1, 8)}">${block(b, id, bi)}</div>`).join("")}
    <div style="height:40px"></div>
    <div class="finish"></div>
  `;
  el.querySelector("[data-back]").addEventListener("click", back);
  el.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => {
    const bi = +b.dataset.copy.split(":")[1];
    copy(l.blocks[bi].v, b);
  }));
  el.querySelectorAll("[data-chk]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.chk;
    checks[k] = !checks[k];
    b.classList.toggle("on", checks[k]);
    haptic("tap");
    save();
  }));

  const fin = el.querySelector(".finish");
  const drawFinish = () => {
    if (done.has(id)) {
      fin.innerHTML = next
        ? `<button class="btn ghost" style="flex:0 0 30%" data-home>Курс</button><button class="btn" data-next>Дальше <span class="arr">→</span></button>`
        : `<button class="btn" data-home>К курсу <span class="arr">→</span></button>`;
    } else {
      fin.innerHTML = `<button class="btn" data-done>Урок пройден ✓</button>`;
    }
    const d = fin.querySelector("[data-done]");
    if (d) d.addEventListener("click", () => {
      done.add(id); save();
      haptic("success"); confetti();
      toast(next ? `+1 урок · ${pct()}% курса` : "Курс пройден! 🔥");
      el.querySelector(".meta").textContent = `⏱ ${l.time} · ✓ пройден`;
      drawFinish();
    });
    const n = fin.querySelector("[data-next]");
    if (n) n.addEventListener("click", () => { stack[stack.length - 1] = { name: "lesson", params: { id: next.id } }; render(); haptic("tap"); });
    const h = fin.querySelector("[data-home]");
    if (h) h.addEventListener("click", () => setTab("course"));
  };
  drawFinish();
}

/* полоса прочтения */
window.addEventListener("scroll", () => {
  const bar = $(".read-bar");
  if (!bar) return;
  const h = document.documentElement.scrollHeight - innerHeight;
  bar.style.width = (h > 0 ? (scrollY / h) * 100 : 100) + "%";
}, { passive: true });

/* ---------------- экран: промпты ---------------- */
function viewPrompts(el) {
  const all = LESSONS.flatMap((l) => l.blocks.map((b, bi) => ({ b, bi, l })).filter((x) => x.b.t === "prompt"));
  let filter = "all";
  el.innerHTML = `
    <h1 class="page-title rise" style="--i:0">Промпты</h1>
    <p class="page-sub rise" style="--i:1">${all.length} готовых промптов из курса. Копируй, подставляй своё — и в нейросеть.</p>
    <div class="chips rise" style="--i:2"><button class="chip on" data-f="all">Все</button>${COURSE.filter((m) => all.some((x) => x.l.mod.id === m.id)).map((m) => `<button class="chip" data-f="${m.id}">${m.num} ${esc(m.title)}</button>`).join("")}</div>
    <div class="list"></div>
  `;
  const list = el.querySelector(".list");
  const draw = () => {
    const items = all.filter((x) => filter === "all" || x.l.mod.id === filter);
    list.innerHTML = items.map((x, i) => `
      <div class="prompt-card rise" style="--i:${Math.min(i, 8)}">
        <div class="prompt"><div class="prompt-head"><span>${esc(x.b.label || "Промпт")}</span><button class="copy" data-i="${all.indexOf(x)}">Скопировать</button></div><pre>${esc(x.b.v)}</pre></div>
        <div class="from">из урока «${esc(x.l.title)}»</div>
      </div>`).join("");
    list.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => copy(all[+b.dataset.i].b.v, b)));
  };
  el.querySelectorAll("[data-f]").forEach((c) => c.addEventListener("click", () => {
    filter = c.dataset.f;
    el.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === c));
    haptic("tap"); draw();
  }));
  draw();
}

/* ---------------- экран: словарь ---------------- */
function viewGlossary(el) {
  el.innerHTML = `
    <h1 class="page-title rise" style="--i:0">Словарь</h1>
    <p class="page-sub rise" style="--i:1">Все непонятные слова — простым языком.</p>
    <input class="search rise" style="--i:2" placeholder="Найти слово…" />
    <div class="list"></div>
  `;
  const list = el.querySelector(".list");
  const draw = (q = "") => {
    const items = GLOSSARY.filter(([w, d]) => (w + d).toLowerCase().includes(q.toLowerCase()));
    list.innerHTML = items.length
      ? items.map(([w, d], i) => `<div class="term rise" style="--i:${Math.min(i, 10)}"><b>${esc(w)}</b><span>${esc(d)}</span></div>`).join("")
      : `<div class="empty">Ничего не нашёл 🤷</div>`;
  };
  el.querySelector(".search").addEventListener("input", (e) => draw(e.target.value));
  draw();
}

/* ---------------- экран: профиль ---------------- */
function viewProfile(el) {
  const name = user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Гость";
  const initial = (user && user.first_name ? user.first_name[0] : "D").toUpperCase();
  const prompts = LESSONS.reduce((s, l) => s + l.blocks.filter((b) => b.t === "prompt").length, 0);
  const modsDone = COURSE.filter((m) => modDone(m) === m.lessons.length).length;
  el.innerHTML = `
    <div class="avatar rise" style="--i:0">${user && user.photo_url ? `<img src="${esc(user.photo_url)}" alt="">` : initial}</div>
    <h1 class="page-title rise" style="--i:1">${esc(name)}</h1>
    <p class="page-sub rise" style="--i:2">${done.size ? "Так держать. Каждый урок — ближе к первому заказу." : "Начни с первого урока — это 4 минуты."}</p>
    <div class="stats rise" style="--i:3">
      <div class="stat"><b>${pct()}%</b><small>курса</small></div>
      <div class="stat"><b>${done.size}</b><small>уроков</small></div>
      <div class="stat"><b>${modsDone}</b><small>модулей</small></div>
    </div>
    <div class="sec-title rise" style="--i:4">Сообщество</div>
    <div class="links rise" style="--i:5">
      <button class="btn" data-url="${CONFIG.CHANNEL_URL}">📢 Канал Deploy&amp;Enjoy</button>
      ${CONFIG.CHAT_URL ? `<button class="btn ghost" data-url="${CONFIG.CHAT_URL}">💬 Чат — вопросы и работы</button>` : ""}
    </div>
    <p class="page-sub rise" style="--i:6">В курсе ${LESSONS.length} уроков и ${prompts} готовых промптов. Прогресс сохраняется в твоём Telegram — можно продолжить с любого устройства.</p>
    <button class="reset" data-reset>Сбросить прогресс</button>
  `;
  el.querySelectorAll("[data-url]").forEach((b) => b.addEventListener("click", () => openLink(b.dataset.url)));
  el.querySelector("[data-reset]").addEventListener("click", () => {
    const doReset = () => { done = new Set(); checks = {}; save(); toast("Прогресс сброшен"); render(); };
    if (tg && ver("6.2")) tg.showConfirm("Сбросить весь прогресс?", (ok) => ok && doReset());
    else if (confirm("Сбросить весь прогресс?")) doReset();
  });
}

/* ---------------- старт ---------------- */
(async function init() {
  try { done = new Set(JSON.parse((await store.get("done")) || "[]")); } catch (e) {}
  try { checks = JSON.parse((await store.get("checks")) || "{}"); } catch (e) {}
  // переход сразу в урок по ссылке ?startapp=m2l1
  const sp = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || new URLSearchParams(location.search).get("l");
  if (sp && byId[sp]) stack.push({ name: "lesson", params: { id: sp } });
  render();
  const seen = sessionStorage.getItem("de_splash");
  setTimeout(() => $("#splash").classList.add("hide"), seen ? 0 : 1500);
  sessionStorage.setItem("de_splash", "1");
})();
