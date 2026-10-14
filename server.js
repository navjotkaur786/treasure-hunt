// AI Tech Treasure Hunt - zero-dependency server (Node 18+)
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "navjot";
const ADMIN_PASS = process.env.ADMIN_PASS || "welcome@ggi";
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, "data.json");
const MAX_MEMBERS = 3;

// ===== EDIT QUESTIONS / CLUES HERE (answer = index of correct option, starting at 0) =====
const CPS = [
 {id:1,token:"k8Qz2",clue:"📚 I have thousands of stories but I never speak. Silence is my rule! Find the LIBRARY.",q:"Which of these is an INPUT device?",o:["Monitor","Printer","Speaker","Keyboard"],a:3},
 {id:2,token:"m4Xp9",clue:"🍟 Hungry brains need fuel! Find the place that smells of samosas, tea and sandwiches: the CANTEEN.",q:"Which part is called the 'brain' of the computer?",o:["CPU","Mouse","Monitor","Keyboard"],a:0},
 {id:3,token:"t7Lw3",clue:"💻 Rows of screens, keys clicking all day. Find the place where code comes alive: the COMPUTER LAB.",q:"What does AI stand for?",o:["Auto Internet","Artificial Intelligence","Advanced Input","All Information"],a:1},
 {id:4,token:"v2Rn6",clue:"🧪 Beakers, test tubes and colourful reactions! Walk to the CHEMISTRY LAB (no touching anything!).",q:"Which one is an Operating System?",o:["Google Chrome","MS Paint","Windows","Facebook"],a:2},
 {id:5,token:"z9Hc1",clue:"🎤 Final stop! The big hall with a stage and many seats, where winners are celebrated: the AUDITORIUM.",q:"What does WWW stand for?",o:["World Wide Web","Wide World Window","Web World Wire","World Web Work"],a:0}];
const cp = id => CPS.find(c => c.id === id);

// ===== STORAGE (JSON file, kept in memory) =====
let teams = [];
try { teams = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch (e) {}
const save = () => { try { fs.writeFileSync(DATA_FILE + ".tmp", JSON.stringify(teams)); fs.renameSync(DATA_FILE + ".tmp", DATA_FILE); } catch (e) { console.error("save failed", e.message); } };
const sessions = new Set();
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const newCode = () => { const ch = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let c; do c = "AIH-" + Array.from({length:4}, () => ch[crypto.randomInt(ch.length)]).join(""); while (teams.some(t => t.code === c)); return c; };
const winnerId = () => (teams.filter(t => t.finishedAt).sort((a, b) => a.finishedAt - b.finishedAt)[0] || {}).id;
const view = t => ({ name: t.name, code: t.code, members: t.members, progress: t.progress, started: !!t.route, finishedAt: t.finishedAt, winner: t.id === winnerId() && !!t.finishedAt, clue: t.route && !t.finishedAt ? cp(t.route[t.progress]).clue : null });

// ===== API =====
const routes = {
 "POST /api/register": b => {
  const name = String(b.name || "").trim().slice(0, 40);
  const members = (Array.isArray(b.members) ? b.members : []).map(m => String(m).trim().slice(0, 40)).filter(Boolean).slice(0, MAX_MEMBERS);
  if (!name || !members.length) return [400, { error: "Enter a team name and at least one member." }];
  if (teams.some(t => t.name.toLowerCase() === name.toLowerCase())) return [400, { error: "Team name already taken." }];
  const t = { id: crypto.randomUUID(), code: newCode(), name, members, createdAt: Date.now(), route: null, progress: 0, startedAt: null, finishedAt: null, log: [] };
  teams.push(t); save(); return [200, { code: t.code, name }];
 },
 "POST /api/start": b => {
  const t = teams.find(x => x.code === String(b.code || "").trim().toUpperCase());
  if (!t) return [404, { error: "Invalid team code." }];
  if (!t.route) {
   const used = teams.map(x => (x.route || []).join()); let r, n = 0;
   do r = shuffle(CPS.map(c => c.id)); while (used.includes(r.join()) && ++n < 50);
   t.route = r; t.startedAt = Date.now(); save();
  }
  return [200, view(t)];
 },
 "GET /api/team": (b, q) => { const t = teams.find(x => x.code === String(q.get("code") || "").toUpperCase()); return t ? [200, view(t)] : [404, { error: "Invalid team code." }]; },
 "GET /api/cp": (b, q) => {
  const c = CPS.find(x => x.token === q.get("token")); if (!c) return [200, { status: "invalid" }];
  const t = teams.find(x => x.code === String(q.get("code") || "").toUpperCase()); if (!t) return [200, { status: "nocode" }];
  if (!t.route) return [200, { status: "notstarted" }];
  if (t.finishedAt) return [200, { status: "finished" }];
  const i = t.route.indexOf(c.id);
  if (i < t.progress) return [200, { status: "done" }];
  if (i > t.progress) return [200, { status: "wrong" }];
  return [200, { status: "ok", q: c.q, o: c.o }];
 },
 "POST /api/answer": b => {
  const c = CPS.find(x => x.token === b.token), t = teams.find(x => x.code === String(b.code || "").toUpperCase());
  if (!c || !t || !t.route || t.finishedAt || t.route[t.progress] !== c.id) return [400, { error: "Not your next checkpoint." }];
  if (Number(b.choice) !== c.a) return [200, { correct: false }];
  t.progress++; t.log.push({ cp: c.id, at: Date.now() });
  if (t.progress === CPS.length) t.finishedAt = Date.now();
  save();
  return [200, { correct: true, progress: t.progress, finished: !!t.finishedAt, winner: t.id === winnerId() && !!t.finishedAt, nextClue: t.finishedAt ? null : cp(t.route[t.progress]).clue }];
 },
 "POST /api/admin/login": b => {
  if (b.user === ADMIN_USER && b.pass === ADMIN_PASS) { const tk = crypto.randomBytes(24).toString("hex"); sessions.add(tk); return [200, { token: tk }]; }
  return [401, { error: "Wrong credentials." }];
 },
 "GET /api/admin/teams": () => [200, { total: CPS.length, teams: teams.map(t => ({ name: t.name, code: t.code, members: t.members, createdAt: t.createdAt, route: t.route, progress: t.progress, startedAt: t.startedAt, finishedAt: t.finishedAt, winner: t.id === winnerId() && !!t.finishedAt })) }],
 "GET /api/admin/links": () => [200, { links: CPS.map(c => ({ id: c.id, token: c.token })) }],
 "POST /api/admin/reset": b => { teams = teams.filter(t => t.code !== String(b.code || "").toUpperCase()); save(); return [200, { ok: true }]; }
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
