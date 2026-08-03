'use strict';
/*
 * SaaS Ventures Lab — zero-dependency manager + waitlist server.
 * Run:  node server.js   (serves http://localhost:8787)
 * No npm installs. Pure Node stdlib (http, fs, path, url).
 *
 * Endpoints:
 *   GET  /                     -> manager dashboard (public/index.html)
 *   GET  /waitlist/:slug       -> public waitlist landing page (public/waitlist.html)
 *   GET  /api/projects         -> JSON of all projects (dashboard source)
 *   POST /api/signup           -> body {slug, name, email, channel} records a waitlist signup
 *   POST /api/projects/:id/advance  -> move status RESEARCH->POC->WAITLIST->BUILD
 *   POST /api/projects/:id/cancel   -> mark KILLED (+ reason)
 *   POST /api/projects/:id/simulate -> dev helper: add N signups to demo the funnel
 *   POST /api/projects/:id/publish  -> increment marketing_posts_published
 *   GET  /api/tick             -> evaluate auto-cancel rules across all projects
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 8787;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const STUDIO_FILE = path.join(DATA_DIR, 'studio.json');
const WAITLIST_FILE = path.join(DATA_DIR, 'waitlists.json');

const STATUS_ORDER = ['RESEARCH', 'POC', 'WAITLIST', 'BUILD', 'KILLED'];

function loadProjects() {
  return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
}
function saveProjects(projects) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}
function loadStudio() {
  try { return JSON.parse(fs.readFileSync(STUDIO_FILE, 'utf8')); } catch (e) { return {}; }
}
function loadWaitlists() {
  try {
    return JSON.parse(fs.readFileSync(WAITLIST_FILE, 'utf8'));
  } catch (e) {
    return { signups: [] };
  }
}
function saveWaitlists(data) {
  fs.writeFileSync(WAITLIST_FILE, JSON.stringify(data, null, 2));
}

function recomputeSignups(projects, waitlists) {
  // signups come from the persisted waitlist records, not the seed field,
  // so the dashboard always reflects reality.
  const counts = {};
  for (const s of waitlists.signups) {
    counts[s.projectId] = (counts[s.projectId] || 0) + 1;
  }
  // channel counts
  const channelCounts = {};
  for (const s of waitlists.signups) {
    channelCounts[s.projectId] = channelCounts[s.projectId] || {twitter:0,reddit:0,linkedin:0,other:0};
    const ch = (s.channel && channelCounts[s.projectId][s.channel] !== undefined) ? s.channel : 'other';
    channelCounts[s.projectId][ch]++;
  }
  for (const p of projects) {
    p.signups = counts[p.id] || 0;
    p.signups_by_channel = channelCounts[p.id] || {twitter:0,reddit:0,linkedin:0,other:0};
  }
  return projects;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

// Auto-cancel evaluation: pure function, returns enriched project list + report.
function evaluate(projects) {
  const report = [];
  for (const p of projects) {
    p.auto_cancel = null;
    if (p.status === 'KILLED' || p.status === 'BUILD') continue;
    const launched = p.poc_launched_at;
    const elapsed = daysSince(launched);
    const reached = p.signups >= p.waitlist_target;
    if (reached) {
      p.auto_cancel = { flag: false, reason: 'Target reached — green-light BUILD.' };
      report.push({ id: p.id, name: p.name, flag: false, reason: p.auto_cancel.reason });
      continue;
    }
    // Not reached. Auto-cancel only fires if deadline passed AND marketing was done.
    if (elapsed !== null && elapsed > p.decision_deadline_days) {
      const marketed = p.marketing_posts_published >= (p.marketing_required_posts || 3);
      if (marketed) {
        p.auto_cancel = {
          flag: true,
          reason: `Deadline passed (${elapsed}d > ${p.decision_deadline_days}d) with ${p.signups}/${p.waitlist_target} signups and marketing done. KILL.`
        };
      } else {
        p.auto_cancel = {
          flag: false,
          reason: `Deadline passed but marketing incomplete (${p.marketing_posts_published}/${p.marketing_required_posts||3} posts). Fix marketing before judging.`
        };
      }
    } else {
      const remaining = elapsed === null ? p.decision_deadline_days : (p.decision_deadline_days - elapsed);
      p.auto_cancel = {
        flag: false,
        reason: `In window. ${p.signups}/${p.waitlist_target} signups. ${remaining}d left.`
      };
    }
    report.push({ id: p.id, name: p.name, flag: !!p.auto_cancel.flag, reason: p.auto_cancel.reason });
  }
  return report;
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); } });
  });
}
function serveFile(res, file, type) {
  return new Promise((resolve) => {
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('Not found'); return resolve(); }
      res.writeHead(200, { 'Content-Type': type });
      res.end(buf);
      resolve();
    });
  });
}

async function handler(req, res) {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = u.pathname;

  // ---- API ----
  if (pathname.startsWith('/api/')) {
    // GET /api/projects
    if (pathname === '/api/projects' && req.method === 'GET') {
      const projects = recomputeSignups(loadProjects(), loadWaitlists());
      evaluate(projects);
      return sendJSON(res, 200, projects);
    }
    // GET /api/tick
    if (pathname === '/api/tick' && req.method === 'GET') {
      const projects = recomputeSignups(loadProjects(), loadWaitlists());
      const report = evaluate(projects);
      return sendJSON(res, 200, { report, evaluatedAt: new Date().toISOString() });
    }
    // GET /api/studio
    if (pathname === '/api/studio' && req.method === 'GET') {
      return sendJSON(res, 200, loadStudio());
    }
    // PUT /api/studio  (edit studio identity — kept separate from personal profiles)
    if (pathname === '/api/studio' && req.method === 'PUT') {
      const body = await readBody(req);
      const cur = loadStudio();
      const next = Object.assign({}, cur, body);
      fs.writeFileSync(STUDIO_FILE, JSON.stringify(next, null, 2));
      return sendJSON(res, 200, next);
    }
    // GET /api/waitlist  (live signup feed)
    if (pathname === '/api/waitlist' && req.method === 'GET') {
      const wl = loadWaitlists();
      const recent = wl.signups.slice(-50).reverse();
      return sendJSON(res, 200, { total: wl.signups.length, recent });
    }
    // POST /api/signup
    if (pathname === '/api/signup' && req.method === 'POST') {
      const body = await readBody(req);
      const slug = body.slug;
      const projects = loadProjects();
      const proj = projects.find((p) => p.slug === slug);
      if (!proj) return sendJSON(res, 404, { error: 'unknown project' });
      const waitlists = loadWaitlists();
      waitlists.signups.push({
        projectId: proj.id,
        name: (body.name || '').toString().slice(0, 80),
        email: (body.email || '').toString().slice(0, 160),
        channel: (body.channel || 'other').toString().slice(0, 20),
        at: new Date().toISOString()
      });
      saveWaitlists(waitlists);
      const total = waitlists.signups.filter((s) => s.projectId === proj.id).length;
      const reached = total >= proj.waitlist_target;
      if (reached && proj.status !== 'BUILD' && proj.status !== 'KILLED') {
        const ps = loadProjects();
        const p2 = ps.find((x) => x.id === proj.id);
        p2.status = 'BUILD';
        if (!p2.poc_launched_at) p2.poc_launched_at = new Date().toISOString().slice(0, 10);
        saveProjects(ps);
      }
      return sendJSON(res, 200, { ok: true, total, reached, target: proj.waitlist_target });
    }
    // /api/projects/:id/:action
    const m = pathname.match(/^\/api\/projects\/([\w-]+)\/([\w]+)$/);
    if (m && req.method === 'POST') {
      const id = m[1]; const action = m[2];
      const projects = loadProjects();
      const proj = projects.find((p) => p.id === id);
      if (!proj) return sendJSON(res, 404, { error: 'unknown project' });
      if (action === 'advance') {
        const idx = STATUS_ORDER.indexOf(proj.status);
        if (idx >= 0 && idx < STATUS_ORDER.length - 2) {
          proj.status = STATUS_ORDER[idx + 1];
          if (proj.status === 'POC' && !proj.poc_launched_at) proj.poc_launched_at = new Date().toISOString().slice(0,10);
          if (proj.status === 'WAITLIST' && !proj.poc_launched_at) proj.poc_launched_at = new Date().toISOString().slice(0,10);
          saveProjects(projects);
          return sendJSON(res, 200, { ok: true, status: proj.status });
        }
        return sendJSON(res, 400, { error: 'cannot advance from ' + proj.status });
      }
      if (action === 'cancel') {
        const body = await readBody(req);
        proj.status = 'KILLED';
        proj.notes = (proj.notes || '') + ' [KILLED ' + new Date().toISOString().slice(0,10) + ']: ' + (body.reason || 'auto-cancel');
        saveProjects(projects);
        return sendJSON(res, 200, { ok: true, status: proj.status });
      }
      if (action === 'publish') {
        proj.marketing_posts_published = (proj.marketing_posts_published || 0) + 1;
        saveProjects(projects);
        return sendJSON(res, 200, { ok: true, marketing_posts_published: proj.marketing_posts_published });
      }
      if (action === 'post') {
        // Mark a distribution channel as posted FROM THE STUDIO IDENTITY.
        // Never touches personal accounts. Counts toward the marketing gate.
        const body = await readBody(req);
        const ch = (body.channel || '').toString();
        if (!proj.distribution) proj.distribution = { posted: {} };
        if (!proj.distribution.posted) proj.distribution.posted = {};
        const already = !!proj.distribution.posted[ch];
        proj.distribution.posted[ch] = true;
        if (!already) proj.marketing_posts_published = (proj.marketing_posts_published || 0) + 1;
        saveProjects(projects);
        return sendJSON(res, 200, { ok: true, channel: ch, posted: proj.distribution.posted, marketing_posts_published: proj.marketing_posts_published });
      }
      if (action === 'update') {
        // Persist arbitrary editable fields from the dashboard (tagline, notes, waitlist_target,
        // decision_deadline_days, willingness_to_pay, status, etc.). Defensive: only known keys.
        const body = await readBody(req);
        const editable = ['tagline','notes','waitlist_target','decision_deadline_days','willingness_to_pay','marketing_required_posts','status','category','poc_scope'];
        for (const k of editable) {
          if (body[k] !== undefined && body[k] !== null) {
            if (typeof proj[k] === 'number') proj[k] = Number(body[k]);
            else proj[k] = String(body[k]);
          }
        }
        saveProjects(projects);
        return sendJSON(res, 200, { ok: true, project: proj });
      }
      if (action === 'clear') {
        // Archive + reset this project's waitlist to zero (keeps the project, clears signups).
        const wl = loadWaitlists();
        const kept = wl.signups.filter((s) => s.projectId !== proj.id);
        saveWaitlists({ signups: kept });
        return sendJSON(res, 200, { ok: true, remaining: kept.length });
      }
      if (action === 'simulate') {
        const body = await readBody(req);
        const n = Math.max(1, parseInt(body.n || '10', 10));
        const channels = ['twitter','reddit','linkedin','other'];
        const waitlists = loadWaitlists();
        for (let i = 0; i < n; i++) {
          waitlists.signups.push({
            projectId: proj.id,
            name: 'Sim User ' + (waitlists.signups.length + 1),
            email: 'sim' + (waitlists.signups.length + 1) + '@example.com',
            channel: channels[i % channels.length],
            at: new Date().toISOString(),
            simulated: true
          });
        }
        saveWaitlists(waitlists);
        const total = waitlists.signups.filter((s) => s.projectId === proj.id).length;
        const reached = total >= proj.waitlist_target;
        if (reached && proj.status !== 'BUILD' && proj.status !== 'KILLED') {
          const ps = loadProjects();
          const p2 = ps.find((x) => x.id === proj.id);
          p2.status = 'BUILD';
          if (!p2.poc_launched_at) p2.poc_launched_at = new Date().toISOString().slice(0, 10);
          saveProjects(ps);
        }
        return sendJSON(res, 200, { ok: true, total, reached: total >= proj.waitlist_target });
      }
      return sendJSON(res, 404, { error: 'unknown action' });
    }
    return sendJSON(res, 404, { error: 'not found' });
  }

  // Read FORMSPREE_ID from env or fall back to empty. When set, the waitlist page
  // dual-submits: Formspree (primary email capture, works on any public URL) AND
  // the local /api/signup (dashboard tracking, works when same-origin).
  const FORMSPREE_ID = process.env.FORMSPREE_ID || '';

  // ---- Waitlist landing page ----
    const wl = pathname.match(/^\/waitlist\/([\w-]+)$/);
    if (wl) {
      const slug = wl[1];
      const projects = loadProjects();
      const proj = projects.find((p) => p.slug === slug);
      if (!proj) return await serveFile(res, path.join(PUBLIC_DIR, 'waitlist.html'), 'text/html');
      const html = fs.readFileSync(path.join(PUBLIC_DIR, 'waitlist.html'), 'utf8')
        .replace('/*__PROJECT_JSON__*/null', JSON.stringify(proj))
        .replace('/*__FORMSPREE_ID__*/', FORMSPREE_ID);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }


  // ---- Public studio landing page ----
  if (pathname === '/') {
    return await serveFile(res, path.join(PUBLIC_DIR, 'studio.html'), 'text/html');
  }

  // ---- Dashboard ----
  if (pathname === '/dashboard' || pathname === '/index.html') {
    const DASHBOARD_KEY = process.env.DASHBOARD_KEY || '';
    if (DASHBOARD_KEY && u.searchParams.get('key') !== DASHBOARD_KEY) {
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    return await serveFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html');
  }

  res.writeHead(404); res.end('Not found');
}

const server = http.createServer(handler);
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`SaaS Ventures Lab running at http://localhost:${PORT}`);
    console.log(`  Dashboard:  http://localhost:${PORT}/`);
    console.log(`  Waitlist e.g.: http://localhost:${PORT}/waitlist/subtrack`);
  });
}

module.exports = { handler, evaluate, recomputeSignups, loadProjects, loadWaitlists, loadStudio };
