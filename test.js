// In-process integration test for SaaS Ventures Lab.
// Drives the REAL handler from server.js through every route using fake
// req/res objects. No localhost egress (which is blocked in this env).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { handler, evaluate, recomputeSignups, loadProjects, loadWaitlists, loadStudio } = require('./server.js');

const ROOT = __dirname;
const PROJECTS_FILE = path.join(ROOT, 'data', 'projects.json');
const WAITLIST_FILE = path.join(ROOT, 'data', 'waitlists.json');

// backup originals so the test is non-destructive
const projBak = fs.readFileSync(PROJECTS_FILE, 'utf8');
const wlBak = fs.readFileSync(WAITLIST_FILE, 'utf8');
function restore() { fs.writeFileSync(PROJECTS_FILE, projBak); fs.writeFileSync(WAITLIST_FILE, wlBak); }

let passed = 0, failed = 0;
function ok(name, cond) { if (cond) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name); } }

// fake response captures status + body
function mkRes() {
  return {
    _status: 200, _body: '', _headers: {},
    writeHead(s, h) { this._status = s; this._headers = h || {}; },
    end(b) { this._body += (b || ''); },
    get json() { try { return JSON.parse(this._body); } catch (e) { return this._body; } }
  };
}
// fake request
function mkReq(method, url, body) {
  const chunks = body ? [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))] : [];
  return {
    method, url,
    _chunks: chunks,
    on(ev, cb) {
      if (ev === 'data') chunks.forEach(c => cb(c));
      if (ev === 'end') cb();
    },
    destroy() {}
  };
}

(async () => {
  // fresh state
  restore();
  fs.writeFileSync(WAITLIST_FILE, JSON.stringify({ signups: [] }));

  console.log('\n[1] GET /api/projects');
  let res = mkRes();
  await handler(mkReq('GET', '/api/projects'), res);
  ok('200 status', res._status === 200);
  const projects = res.json;
  ok('returns 10 projects', Array.isArray(projects) && projects.length === 10);
  ok('subtrack present + status POC', projects.find(p => p.id === 'subtrack').status === 'POC');
  ok('auto_cancel computed (no false kills)', projects.every(p => p.auto_cancel && typeof p.auto_cancel.flag === 'boolean'));

  console.log('\n[2] GET / (dashboard HTML)');
  res = mkRes();
  await handler(mkReq('GET', '/'), res);
  ok('200 status', res._status === 200);
  ok('is html', String(res._body).startsWith('<!DOCTYPE html>'));
  ok('contains brand title', String(res._body).includes('SaaS Ventures Lab'));

  console.log('\n[3] GET /waitlist/subtrack (landing page)');
  res = mkRes();
  await handler(mkReq('GET', '/waitlist/subtrack'), res);
  ok('200 + injects project', res._status === 200 && res._body.includes('The problem:'));
  ok('contains tagline', res._body.includes('SaaS spend tracker'));

  console.log('\n[4] POST /api/signup (record a waitlist signup)');
  res = mkRes();
  await handler(mkReq('POST', '/api/signup', { slug: 'subtrack', name: 'Test', email: 't@example.com', channel: 'reddit' }), res);
  ok('200 ok', res._status === 200 && res.json.ok === true);
  ok('total = 1', res.json.total === 1);
  ok('not yet reached (target 50)', res.json.reached === false);

  console.log('\n[5] Simulate 60 signups -> should flip subtrack to BUILD');
  res = mkRes();
  await handler(mkReq('POST', '/api/projects/subtrack/simulate', { n: 60 }), res);
  ok('200 + reached true', res._status === 200 && res.json.reached === true);
  ok('total = 61', res.json.total === 61);

  // verify via /api/projects that signups persisted + engine sees target reached
  res = mkRes();
  await handler(mkReq('GET', '/api/projects'), res);
  const sub = res.json.find(p => p.id === 'subtrack');
  ok('signups persisted = 61', sub.signups === 61);
  ok('status auto-flipped to BUILD', sub.status === 'BUILD');

  console.log('\n[6] Advance status machine (clientreport RESEARCH -> POC -> WAITLIST)');
  res = mkRes(); await handler(mkReq('POST', '/api/projects/clientreport/advance'), res);
  ok('RESEARCH -> POC', res.json.status === 'POC');
  res = mkRes(); await handler(mkReq('POST', '/api/projects/clientreport/advance'), res);
  ok('POC -> WAITLIST', res.json.status === 'WAITLIST');

  console.log('\n[7] publish marketing post');
  res = mkRes(); await handler(mkReq('POST', '/api/projects/clientreport/publish'), res);
  ok('marketing_posts_published incremented', res.json.marketing_posts_published >= 1);

  console.log('\n[8] Auto-cancel logic: overdue + marketed + under target => KILL flag');
  // craft a project in seed JSON with an old poc_launched_at and 0 signups but 3 posts
  const seed = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
  const victim = seed.find(p => p.id === 'legalquick');
  victim.status = 'WAITLIST';
  victim.poc_launched_at = '2026-01-01'; // ~195 days ago, far past 30d deadline
  victim.marketing_posts_published = 3;
  victim.signups = 0;
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(seed, null, 2));

  // recompute + evaluate directly (pure functions)
  const wl = loadWaitlists();
  const recomp = recomputeSignups(loadProjects(), wl);
  const report = evaluate(recomp);
  const v = report.find(r => r.id === 'legalquick');
  ok('legalquick flagged for KILL', v && v.flag === true);
  ok('reason mentions KILL', /KILL/.test(v.reason));

  console.log('\n[9] Cancel endpoint marks KILLED');
  res = mkRes(); await handler(mkReq('POST', '/api/projects/legalquick/cancel', { reason: 'auto-cancel test' }), res);
  ok('status KILLED', res.json.status === 'KILLED');

  console.log('\n[10] /api/tick returns report');
  res = mkRes(); await handler(mkReq('GET', '/api/tick'), res);
  ok('tick returns report', Array.isArray(res.json.report));
  ok('report excludes BUILD/KILLED', res.json.report.length === 8); // subtrack=BUILD, legalquick=KILLED

  console.log('\n[11] GET /api/studio');
  res = mkRes(); await handler(mkReq('GET', '/api/studio'), res);
  ok('studio returns name', res._status === 200 && res.json.name && res.json.handle);
  ok('studio policy forbids personal accounts', /Personal/i.test(res.json.policy || ''));

  console.log('\n[12] POST /api/projects/subtrack/post (studio channel mark)');
  res = mkRes(); await handler(mkReq('POST', '/api/projects/subtrack/post', { channel: 'Reddit' }), res);
  ok('200 + channel posted', res._status === 200 && res.json.posted && res.json.posted.Reddit === true);
  ok('marketing_posts_published incremented', res.json.marketing_posts_published >= 1);
  ok('posted map persisted', loadProjects().find(p => p.id === 'subtrack').distribution.posted.Reddit === true);

  console.log('\n[13] PUT /api/studio (edit studio identity)');
  res = mkRes(); await handler(mkReq('PUT', '/api/studio', { name: 'Venturewright', handle: '@venturewright' }), res);
  ok('200 + name updated', res._status === 200 && res.json.name === 'Venturewright');
  // restore studio name for cleanliness
  await handler(mkReq('PUT', '/api/studio', { name: 'Leverwright Labs', handle: '@leverwrightlabs' }), res);
  ok('studio name restored', loadStudio().name === 'Leverwright Labs');

  console.log('\n[14] POST /api/projects/subtrack/update (persist editable fields)');
  res = mkRes(); await handler(mkReq('POST', '/api/projects/subtrack/update', { waitlist_target: 75, tagline: 'Edited tagline', status: 'WAITLIST' }), res);
  ok('200 + target persisted', res._status === 200 && res.json.project.waitlist_target === 75);
  ok('tagline persisted', res.json.project.tagline === 'Edited tagline');
  ok('status persisted', res.json.project.status === 'WAITLIST');
  const sub2 = loadProjects().find(p => p.id === 'subtrack');
  ok('disk reflects update', sub2.waitlist_target === 75 && sub2.status === 'WAITLIST');

  console.log('\n[15] GET /api/waitlist (live feed)');
  res = mkRes(); await handler(mkReq('POST', '/api/signup', { slug: 'subtrack', name: 'Feed Tester', email: 'f@e.com', channel: 'reddit' }), res);
  res = mkRes(); await handler(mkReq('GET', '/api/waitlist'), res);
  ok('feed returns total + recent', res._status === 200 && typeof res.json.total === 'number' && Array.isArray(res.json.recent));
  ok('recent includes the new signup', res.json.recent.some(f => f.name === 'Feed Tester'));

  console.log('\n[16] POST /api/projects/subtrack/clear (reset waitlist)');
  res = mkRes(); await handler(mkReq('POST', '/api/projects/subtrack/clear'), res);
  ok('200 + waitlist cleared', res._status === 200 && res.json.remaining === 0);

  restore();
  console.log(`\n==== RESULT: ${passed} passed, ${failed} failed ====`);
  process.exit(failed ? 1 : 0);
})().catch(e => { restore(); console.error('TEST ERROR:', e); process.exit(2); });
