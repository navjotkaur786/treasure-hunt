# AI Tech Treasure Hunt (online version)

Zero-dependency Node.js app (Node 18+). No `npm install` needed.

## Run on your computer
    node server.js
Open http://localhost:3000

## Put it online (Render.com - free)
1. Upload this folder to a new GitHub repository.
2. On render.com: New > Web Service > connect the repo.
3. Build command: (leave empty)   Start command: `node server.js`
4. Environment variables (recommended):
   - ADMIN_USER = navjot
   - ADMIN_PASS = welcome@ggi   (change if you like)
5. Deploy. Your site URL (https://xxxx.onrender.com) is the link for students.

IMPORTANT (data safety): on Render's free plan the disk is wiped when the
server restarts or redeploys, and the app sleeps after ~15 min of no use.
- Open the site a few minutes before the event so it is awake.
- Do NOT redeploy during the event.
- For extra safety add a Render Disk and set DATA_DIR to its mount path
  (e.g. /var/data), or host on Railway with a volume.
- Alternative: run `node server.js` on a college PC and share it with a
  free tunnel (e.g. Cloudflare Tunnel / ngrok) for an https link.

## Event day
1. Open <your-site>/#/admin and log in.
2. "Checkpoint Links / QR" -> print the 5 QR codes and place them at the locations.
3. Students register at <your-site>/#/register, then start at <your-site>/#/start.
4. Watch "Team Progress" live. First team with 5/5 is the winner.

## Customise
Questions, clues and tokens are at the top of server.js (CPS array).
Answers and the admin password stay on the server (not visible to students).
Do a full test run with dummy teams, then restart the server to clear data
(or delete data.json).
