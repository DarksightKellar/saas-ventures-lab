# Deploy your first waitlist page in 3 minutes

## Step 1: Get a Formspree endpoint (free)

1. Go to https://formspree.io → sign up (free tier: 50 submissions/month)
2. Click "New Form" → give it a name like "SubTrack Waitlist"
3. Copy the **Form ID** from the URL or dashboard — looks like `xwkdzbng`
4. Formspree will ask you to verify your email the first time. Do it.

## Step 2: Choose your deploy method

### Option A — ngrok (fastest, local-first, keeps dashboard live)

```bash
# Terminal 1: start the server (if not already running)
cd /Users/kellar/saas-ventures-lab
FORMSPREE_ID=xwkdzbng node server.js

# Terminal 2: expose to the internet
ngrok http 8787
```

Copy the ngrok URL (e.g. `https://abc123.ngrok.io`). That's your waitlist link:
`https://abc123.ngrok.io/waitlist/subtrack`

Signups flow: visitor → Formspree (email capture) + local API (dashboard tracking).
Both fire. Your dashboard at localhost:8787 shows the signup instantly.

### Option B — Netlify (free static hosting, no server needed)

1. Edit `public/waitlist.html` — change line ~57:
   ```
   var FORMSPREE_ID = 'xwkdzbng';   // ← your real Formspree ID
   ```

2. Drag `public/waitlist.html` onto https://app.netlify.com/drop

3. Netlify gives you a URL like `https://lucky-narwhal-abc123.netlify.app`

4. But wait — a single HTML file won't know which project to show (SubTrack? PricePulse?).

   **Fix:** copy waitlist.html and edit the PROJECT constant for each project:
   ```bash
   # Generate per-project pages (automated)
   cd /Users/kellar/saas-ventures-lab
   node -e "
   const proj=require('./data/projects.json');
   const fs=require('fs');
   const tpl=fs.readFileSync('public/waitlist.html','utf8');
   proj.forEach(p=>{
     const html=tpl.replace('/*__PROJECT_JSON__*/',JSON.stringify(p));
     fs.writeFileSync('public/waitlist-'+p.slug+'.html',html);
   });
   console.log('Generated 10 deployable pages');
   "
   ```

5. Drag each `public/waitlist-*.html` to Netlify. You now have 10 live waitlist pages.

6. Signups go to Formspree only (no dashboard tracking). Use the "＋ 1 Real signup" button
   on your dashboard at localhost:8787 to manually log each one.

### Option C — Railway / Render (deploy the whole server, zero-config)

1. Push the repo to GitHub
2. Connect Railway → point at the repo → it detects `node server.js`
3. Set env var: `FORMSPREE_ID=xwkdzbng`
4. Railway gives you a URL. Everything works: waitlist pages + dashboard.

## Step 3: Post the link

Copy the launch post from `STUDIO_LAUNCH_COPY.md` (SubTrack section). Replace `[LINK]` with
your real waitlist URL. Post from the @leverwrightlabs account.

## Step 4: Watch the live feed

Open http://localhost:8787/ — hit "refresh" under "Live waitlist feed."
If using Option A (ngrok), signups appear automatically. If using Option B (Netlify),
click "＋ 1 Real signup" on the SubTrack card to log each Formspree signup manually.

## How the Formspree integration works

The waitlist page does a dual-submit:
1. POST to `https://formspree.io/f/{YOUR_ID}` → Formspree captures the email, sends you a
   notification (free tier: 50/month).
2. POST to `/api/signup` (local server) → dashboard tracking. If this fails (Netlify can't
   reach your localhost), Formspree still succeeded.

If only Formspree fires (Option B), log it manually with "＋ 1 Real signup" on the dashboard.
If both fire (Option A/C), the dashboard updates automatically.
