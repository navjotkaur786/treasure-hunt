# AI Tech Treasure Hunt (online version)

Zero-dependency Node.js app (Node 18+). No `npm install` needed.
Run locally: `node server.js`  ->  http://localhost:3000

## How the hunt works
1. ONE registration QR (same for all teams) -> team name, up to 3 members,
   contact number, school name. A unique team code (AIH-XXXX) is created.
2. The team answers a first question. Correct -> gets the clue for location 1.
3. At each location the team scans that location's QR, enters the team code
   again, answers a question. Correct -> gets the clue for the next location.
4. After the 5th location the team sees the celebration screen with its name.
   The first team to finish is the WINNER (trophy + confetti); others see
   their finishing position.
Each team gets a different random order of the 5 locations and a different
random set of 6 questions (1 start + 5 locations), so teams can't copy.
A wrong answer locks the options for 10 seconds (stops random guessing).

## QR codes (6 in total)
Admin > "QR Codes (6)": 1 registration QR + 5 location QRs. Print with Ctrl+P.
The place name shown under each location QR tells you where to put it.

## Admin
Login: navjot / welcome@ggi  (change with ADMIN_USER / ADMIN_PASS variables)
- Registered Teams (with contact + school)  - Team Progress (live)
- QR Codes (6)  - Questions & Clues (add / delete questions, edit clues)
- "Clear all teams" button to remove test data before the event.
Keep at least 6 questions in the pool. Write clues WITHOUT the place name.

## Put it online (Render.com - free)
1. Upload this folder's contents to a new GitHub repository.
2. render.com > New > Web Service > connect repo.
3. Start command: `node server.js` (build command empty). Instance: Free.
4. Optional environment variables: ADMIN_USER, ADMIN_PASS.
5. Deploy. Your https://xxxx.onrender.com link is the site.

DATA SAFETY: on Render's free plan data is lost if the server restarts/redeploys,
and it sleeps after ~15 min unused. Open the site 10 min before the event, do not
redeploy during it. Safer: add a Render Disk and set DATA_DIR to its path, or
use Railway with a volume, or run on a college PC with a Cloudflare Tunnel/ngrok.
NOTE: questions/clues you edit in Admin are saved in the same data file, so
re-check them after any restart.
