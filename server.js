// AI Tech Treasure Hunt - zero-dependency server (Node 18+)
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "navjot";
const ADMIN_PASS = process.env.ADMIN_PASS || "welcome@ggi";
const DATA_FILE = path.join(process.env.DATA_DIR || __dirname, "data.json");
const MAX_MEMBERS = 3, LOCS = 5, STEPS = LOCS + 1, WAIT_MS = 10000;

// ===== DEFAULT CONTENT (editable later from Admin > Questions & Clues) =====
const Q = (q, o, a) => ({ q, o, a });
const DEFAULT_Q = [
 Q("Which of these is an INPUT device?", ["Monitor", "Printer", "Keyboard", "Speaker"], 2),
 Q("Which part is called the 'brain' of the computer?", ["Mouse", "CPU", "Monitor", "Keyboard"], 1),
 Q("What does AI stand for?", ["Auto Internet", "Advanced Input", "Artificial Intelligence", "All Information"], 2),
 Q("Which one is an Operating System?", ["Google Chrome", "MS Paint", "Facebook", "Windows"], 3),
 Q("What does WWW stand for?", ["World Wide Web", "Wide World Window", "Web World Wire", "World Web Work"], 0),
 Q("Which of these is an OUTPUT device?", ["Mouse", "Scanner", "Printer", "Keyboard"], 2),
 Q("Which key deletes the character to the left of the cursor?", ["Enter", "Backspace", "Shift", "Tab"], 1),
 Q("How many bits are there in 1 byte?", ["2", "4", "8", "16"], 2),
 Q("Which of these is a search engine?", ["Google", "Windows", "Paint", "Excel"], 0),
 Q("What does USB stand for?", ["Universal Serial Bus", "United System Board", "Universal Software Base", "Unique Serial Box"], 0),
 Q("Which of these is a programming language?", ["Chrome", "Python", "Windows", "Mouse"], 1),
 Q("Which shortcut is used to COPY?", ["Ctrl+V", "Ctrl+X", "Ctrl+C", "Ctrl+Z"], 2),
 Q("Which device stores data permanently?", ["Hard disk", "RAM", "Cache", "Keyboard"], 0),
 Q("ChatGPT is an example of a...?", ["Printer", "AI chatbot", "Game console", "Hard disk"], 1)
];
const DEFAULT_L = [
 { token: "k8Qz2", label: "Library", clue: "📚 I hold thousands of stories but I never speak. Silence is my only rule. Where am I?" },
 { token: "m4Xp9", label: "Canteen", clue: "🍟 Hungry brains need fuel! Follow your nose to where tea, samosas and sandwiches wait." },
 { token: "t7Lw3", label: "Computer Lab", clue: "💻 Rows of glowing screens and clicking keys, the place where code comes alive. Find it!" },
 { token: "v2Rn6", label: "Chemistry Lab", clue: "🧪 Colourful liquids bubble in glass tubes and goggles are a must. Where do reactions happen?" },
 { token: "z9Hc1", label: "Auditorium", clue: "🎤 A big stage, hundreds of seats and loud applause. Where are winners celebrated?" }
];

// ===== STORAGE =====
let db = { teams: [], questions: [], locations: [], nextQ: 1 };
try { db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch (e) {}
if (!db.questions || !db.questions.length) { db.questions = DEFAULT_Q.map((x, i) => ({ id: i + 1, ...x })); db.nextQ = DEFAULT_Q.length + 1; }
if (!db.locations || db.locations.length !== LOCS) db.locations = DEFAULT_L.map((x, i) => ({ id: i + 1, ...x }));
const save = () => { try { fs.writeFileSync(DATA_FILE + ".tmp", JSON.stringify(db)); fs.renameSync(DATA_FILE + ".tmp", DATA_FILE); } catch (e) { console.error("save failed", e.message); } };
save();
const sessions = new Set();
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const newCode = () => { const ch = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let c; do c = "AIH-" + Array.from({ length: 4 }, () => ch[crypto.randomInt(ch.length)]).join(""); while (db.teams.some(t => t.code === c)); return c; };
const byCode = c => db.teams.find(t => t.code === String(c || "").trim().toUpperCase());
const loc = id => db.locations.find(l => l.id === id);
const rankOf = t => t.finishedAt ? db.teams.filter(x => x.finishedAt).sort((a, b) => a.finishedAt - b.finishedAt).findIndex(x => x.id === t.id) + 1 : null;
// the question for step i of a team (replaces it if admin deleted it from the pool)
const qFor = (t, i) => {
 let q = db.questions.find(x => x.id === t.qs[i]);
 if (!q) { const free = db.questions.filter(x => !t.qs.includes(x.id)); q = free.length ? free[crypto.randomInt(free.length)] : db.questions[0]; t.qs[i] = q.id; save(); }
 return q;
};
const clueFor = t => (t.progress >= 1 && t.progress < STEPS) ? loc(t.route[t.progress - 1]).clue : null;
const view = t => ({ name: t.name, code: t.code, progress: t.progress, total: STEPS, finishedAt: t.finishedAt, rank: rankOf(t), clue: clueFor(t) });
// where must this team be? returns a status string
function check(t, token) {
 if (t.progress >= STEPS) return "finished";
 if (token === "start") return t.progress === 0 ? "ok" : "startdone";
 const l = db.locations.find(x => x.token === token);
 if (!l) return "invalid";
 if (t.progress === 0) return "needstart";
 const want = t.route[t.progress - 1];
 if (l.id === want) return "ok";
 return t.route.indexOf(l.id) < t.progress - 1 ? "done" : "wrong";
}

// ===== API =====
const routes = {
 "POST /api/register": b => {
  const name = String(b.name || "").trim().slice(0, 40), school = String(b.school || "").trim().slice(0, 80), phone = String(b.phone || "").replace(/[^\d+]/g, "");
  const members = (Array.isArray(b.members) ? b.members : []).map(m => String(m).trim().slice(0, 40)).filter(Boolean).slice(0, MAX_MEMBERS);
  if (!name || !members.length || !school) return [400, { error: "Please fill team name, at least one member, and school name." }];
  if (phone.replace(/\D/g, "").length < 10) return [400, { error: "Enter a valid contact number (10 digits)." }];
  if (db.teams.some(t => t.name.toLowerCase() === name.toLowerCase())) return [400, { error: "This team name is already taken. Choose another." }];
  if (db.questions.length < STEPS) return [500, { error: "Event not ready (admin must add more questions)." }];
  const used = db.teams.map(x => x.route.join()); let route, n = 0;
  do route = shuffle(db.locations.map(l => l.id)); while (used.includes(route.join()) && ++n < 50);
  const qs = shuffle(db.questions.map(q => q.id)).slice(0, STEPS);
  const t = { id: crypto.randomUUID(), code: newCode(), name, members, phone, school, createdAt: Date.now(), route, qs, progress: 0, finishedAt: null, lockUntil: 0, log: [] };
  db.teams.push(t); save(); return [200, { code: t.code, name }];
 },
 "GET /api/team": (b, q) => { const t = byCode(q.get("code")); return t ? [200, view(t)] : [404, { error: "Invalid team code." }]; },
 "GET /api/question": (b, q) => {
  const t = byCode(q.get("code")); if (!t) return [200, { status: "nocode" }];
  const s = check(t, q.get("token")); if (s !== "ok") return [200, { status: s, team: view(t) }];
  const x = qFor(t, t.progress);
  return [200, { status: "ok", q: x.q, o: x.o, step: t.progress + 1, total: STEPS, wait: Math.max(0, Math.ceil((t.lockUntil - Date.now()) / 1000)), name: t.name }];
 },
 "POST /api/answer": b => {
  const t = byCode(b.code); if (!t) return [400, { error: "Invalid team code." }];
  if (check(t, b.token) !== "ok") return [400, { error: "This is not your current step." }];
  if (Date.now() < t.lockUntil) return [200, { correct: false, wait: Math.ceil((t.lockUntil - Date.now()) / 1000) }];
  if (Number(b.choice) !== qFor(t, t.progress).a) { t.lockUntil = Date.now() + WAIT_MS; save(); return [200, { correct: false, wait: WAIT_MS / 1000 }]; }
  t.progress++; t.log.push({ step: t.progress, at: Date.now() });
  if (t.progress >= STEPS) t.finishedAt = Date.now();
  save(); const v = view(t);
  return [200, { correct: true, finished: !!t.finishedAt, rank: v.rank, name: t.name, progress: t.progress, total: STEPS, clue: v.clue }];
 },
 "POST /api/admin/login": b => {
  if (b.user === ADMIN_USER && b.pass === ADMIN_PASS) { const tk = crypto.randomBytes(24).toString("hex"); sessions.add(tk); return [200, { token: tk }]; }
  return [401, { error: "Wrong credentials." }];
 },
 "GET /api/admin/teams": () => [200, { total: STEPS, teams: db.teams.map(t => ({ name: t.name, code: t.code, members: t.members, phone: t.phone, school: t.school, createdAt: t.createdAt, route: t.route.map(id => loc(id).label), progress: t.progress, finishedAt: t.finishedAt, rank: rankOf(t) })) }],
 "GET /api/admin/config": () => [200, { locations: db.locations, questions: db.questions, need: STEPS }],
 "POST /api/admin/location": b => { const l = loc(Number(b.id)); if (!l) return [404, { error: "Not found" }]; l.label = String(b.label || "").trim().slice(0, 60) || l.label; l.clue = String(b.clue || "").trim().slice(0, 400) || l.clue; save(); return [200, { ok: true }]; },
 "POST /api/admin/question": b => {
  const o = (Array.isArray(b.o) ? b.o : []).map(x => String(x).trim().slice(0, 100)), q = String(b.q || "").trim().slice(0, 250), a = Number(b.a);
  if (!q || o.length !== 4 || o.some(x => !x) || !(a >= 0 && a <= 3)) return [400, { error: "Enter the question, all 4 options and pick the correct one." }];
  db.questions.push({ id: db.nextQ++, q, o, a }); save(); return [200, { ok: true }];
 },
 "POST /api/admin/question/delete": b => { if (db.questions.length <= STEPS) return [400, { error: "Keep at least " + STEPS + " questions." }]; db.questions = db.questions.filter(x => x.id !== Number(b.id)); save(); return [200, { ok: true }]; },
 "POST /api/admin/reset-all": () => { db.teams = []; save(); return [200, { ok: true }]; }
};

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
http.createServer((req, res) => {
 const u = new URL(req.url, "http://x"), key = req.method + " " + u.pathname;
 if (u.pathname.startsWith("/api/")) {
  const h = routes[key];
  const send = (s, o) => { res.writeHead(s, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(o)); };
  if (!h) return send(404, { error: "Not found" });
  if (u.pathname.startsWith("/api/admin/") && u.pathname !== "/api/admin/login" && !sessions.has((req.headers.authorization || "").replace("Bearer ", ""))) return send(401, { error: "Admin login required." });
  let body = ""; req.on("data", d => { body += d; if (body.length > 1e5) req.destroy(); });
  req.on("end", () => { let b = {}; try { b = body ? JSON.parse(body) : {}; } catch (e) {} try { const [s, o] = h(b, u.searchParams); send(s, o); } catch (e) { console.error(e); send(500, { error: "Server error" }); } });
  return;
 }
 const f = path.join(__dirname, "public", u.pathname === "/" ? "index.html" : path.normalize(u.pathname).replace(/^(\.\.[\/\\])+/, ""));
 fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end("Not found"); } res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(d); });
}).listen(PORT, () => console.log("Treasure Hunt running on port " + PORT));
