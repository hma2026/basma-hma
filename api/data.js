import { put, list, del } from '@vercel/blob';

const PFX = 'basma_';

async function dbGet(t) {
  try {
    const r = await fetch(process.env.BLOB_READ_WRITE_TOKEN ? undefined : '', { method: 'HEAD' }).catch(() => null);
    // Use list to find the blob, take the LATEST one
    const { blobs } = await list({ prefix: PFX + t + '.json' });
    if (!blobs.length) return null;
    // Sort by uploadedAt descending to get latest
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const res = await fetch(blobs[0].url);
    return await res.json();
  } catch(e) { console.error('[DB GET ERROR] ' + t + ':', e.message); return null; }
}

async function dbSet(t, d) {
  try {
    // Use addRandomSuffix: false to OVERWRITE instead of creating duplicates
    await put(PFX + t + '.json', JSON.stringify(d), { 
      access: 'public', 
      contentType: 'application/json',
      addRandomSuffix: false 
    });
    return true;
  } catch(e) { console.error('[DB SET ERROR] ' + t + ':', e.message); return false; }
}

// Cleanup function — delete all duplicate blobs, keep only latest of each
async function dbCleanup() {
  try {
    var allBlobs = [];
    var cursor = undefined;
    // Paginate through all blobs
    do {
      var result = await list({ prefix: PFX, cursor, limit: 1000 });
      allBlobs = allBlobs.concat(result.blobs);
      cursor = result.cursor;
    } while (cursor);

    // Group by pathname
    var groups = {};
    for (var b of allBlobs) {
      if (!groups[b.pathname]) groups[b.pathname] = [];
      groups[b.pathname].push(b);
    }

    var deleted = 0;
    for (var pathname in groups) {
      var blobs = groups[pathname];
      if (blobs.length <= 1) continue;
      // Sort by date, keep latest
      blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      // Delete all except the latest
      for (var i = 1; i < blobs.length; i++) {
        await del(blobs[i].url);
        deleted++;
      }
    }
    return { ok: true, totalFound: allBlobs.length, deleted, remaining: allBlobs.length - deleted };
  } catch(e) { return { ok: false, error: e.message }; }
}

const INIT_EMP = [
  { id: "E001", name: "أحمد محمد عسيري", role: "مهندس معماري", branch: "jed", code: "901234", isManager: true, salary: 15000, joinDate: "2024-03-15", dob: "1990-05-15", points: 780, type: "office", flexBase: false, flexOT: false, flexOTMax: 0, remote: false, managers: [], observed: false, onLeave: false, sceNumber: "ENG-12345", sceExpiry: "2026-05-15", sceStatus: "active" },
  { id: "E002", name: "خالد العتيبي", role: "مهندس مدني", branch: "riy", code: "887654", salary: 13000, joinDate: "2024-06-01", dob: "1992-11-20", points: 320, type: "mixed", flexBase: false, flexOT: false, flexOTMax: 0, remote: false, managers: ["E001"], observed: false, onLeave: false, sceNumber: "ENG-23456", sceExpiry: "2026-04-20", sceStatus: "active" },
  { id: "E003", name: "سارة الحربي", role: "مهندسة تصميم", branch: "jed", code: "776543", isAssistant: true, salary: 13000, joinDate: "2024-01-10", dob: "1995-03-08", points: 1450, type: "office", flexBase: false, flexOT: false, flexOTMax: 0, remote: false, managers: ["E001"], observed: false, onLeave: false, sceNumber: "ENG-34567", sceExpiry: "2026-09-01", sceStatus: "active" },
  { id: "E004", name: "فهد الدوسري", role: "مهندس إنشائي", branch: "jed", code: "443322", salary: 12000, joinDate: "2023-09-01", dob: "1988-07-22", points: 210, type: "field", flexBase: false, flexOT: false, flexOTMax: 0, remote: false, managers: ["E001"], observed: false, onLeave: false, sceNumber: "ENG-45678", sceExpiry: "2026-06-30", sceStatus: "active" },
  { id: "E005", name: "نورة القحطاني", role: "مهندسة كهربائية", branch: "riy", code: "556677", salary: 11000, joinDate: "2024-08-15", dob: "1996-12-05", points: 450, type: "remote", flexBase: true, flexOT: false, flexOTMax: 0, remote: true, managers: ["E002"], observed: false, onLeave: false, sceNumber: "ENG-56789", sceExpiry: "2026-12-15", sceStatus: "active" },
];

const INIT_BRANCHES = [
  { id: "jed", name: "جدة", start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "friday", tz: "Asia/Riyadh", radius: 150, lat: 21.5433, lng: 39.1728 },
  { id: "riy", name: "الرياض", start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "friday", tz: "Asia/Riyadh", radius: 150, lat: 24.7136, lng: 46.6753 },
  { id: "ist", name: "اسطنبول", start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "friday", tz: "Europe/Istanbul", radius: 200, lat: 41.0082, lng: 28.9784 },
  { id: "gaz", name: "غازي عنتاب", start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "friday", tz: "Europe/Istanbul", radius: 120, lat: 37.0662, lng: 37.3833 },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;
  try {
    switch (action) {

      case 'init': {
        const ex = await dbGet('employees');
        if (ex) return res.json({ ok: true, msg: 'exists', count: ex.length });
        await dbSet('employees', INIT_EMP);
        await dbSet('branches', INIT_BRANCHES);
        await dbSet('attendance', []);
        await dbSet('violations', []);
        await dbSet('warnings', []);
        await dbSet('leaves', []);
        await dbSet('dependents', []);
        await dbSet('tickets', []);
        await dbSet('projects', []);
        await dbSet('delegations', []);
        await dbSet('exceptions', []);
        await dbSet('events', []);
        await dbSet('manual_attendance', []);
        await dbSet('settings', { breakRandomMin: 2, breakRandomMax: 7, autoCheckoutDelay: 5, callRetryDelay: 10 });
        return res.json({ ok: true, msg: 'initialized' });
      }

      case 'login': {
        const { empId, code } = req.body || {};
        const emps = await dbGet('employees') || INIT_EMP;
        const e = emps.find(x => x.id === empId?.toUpperCase());
        if (!e) return res.status(404).json({ error: 'غير موجود' });
        if (e.code !== code) return res.status(401).json({ error: 'رمز خاطئ' });
        return res.json({ ok: true, employee: e });
      }

      case 'employees': {
        if (req.method === 'GET') return res.json(await dbGet('employees') || INIT_EMP);
        if (req.method === 'PUT') {
          const emps = await dbGet('employees') || [];
          const { id, ...up } = req.body;
          const i = emps.findIndex(e => e.id === id);
          if (i >= 0) { emps[i] = { ...emps[i], ...up }; await dbSet('employees', emps); }
          return res.json({ ok: true });
        }
        if (req.method === 'POST') {
          const emps = await dbGet('employees') || [];
          emps.push(req.body);
          await dbSet('employees', emps);
          return res.json({ ok: true });
        }
        break;
      }

      case 'checkin': {
        const { empId, type, lat, lng, facePhoto } = req.body || {};
        const recs = await dbGet('attendance') || [];
        const rec = { id: 'A' + Date.now(), empId, type, lat, lng, facePhoto: facePhoto ? '[captured]' : null, ts: new Date().toISOString(), date: new Date().toISOString().split('T')[0] };
        recs.push(rec);
        await dbSet('attendance', recs);
        // Add points
        const emps = await dbGet('employees') || [];
        const ei = emps.findIndex(e => e.id === empId);
        if (ei >= 0) { emps[ei].points = (emps[ei].points || 0) + 10; await dbSet('employees', emps); }
        return res.json({ ok: true, record: rec });
      }

      case 'face': {
        if (req.method === 'GET') {
          const faceId = req.query.empId;
          // Admin: list all enrolled employees
          if (req.query.listAll === '1') {
            const faces = await dbGet('faces') || {};
            return res.json({ ok: true, enrolled: Object.keys(faces) });
          }
          if (!faceId) return res.status(400).json({ error: 'empId required' });
          const faces = await dbGet('faces') || {};
          if (faces[faceId]) return res.json({ ok: true, descriptor: faces[faceId] });
          return res.json({ ok: false });
        }
        if (req.method === 'POST') {
          const { empId, descriptor } = req.body || {};
          if (!empId || !descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) return res.status(400).json({ error: 'empId + descriptor[128] required' });
          const faces = await dbGet('faces') || {};
          // Check if similar face exists for another employee — notify admin, don't block
          var similarFound = null;
          for (const [existingId, existingDesc] of Object.entries(faces)) {
            if (existingId === empId) continue;
            if (!Array.isArray(existingDesc) || existingDesc.length !== 128) continue;
            let sum = 0;
            for (let i = 0; i < 128; i++) sum += (descriptor[i] - existingDesc[i]) ** 2;
            const dist = Math.sqrt(sum);
            if (dist < 0.35) { similarFound = { empId: existingId, distance: dist }; break; }
          }
          // Save the face regardless
          faces[empId] = descriptor;
          await dbSet('faces', faces);
          // If similar face found, create admin notification
          if (similarFound) {
            const violations = await dbGet('violations') || [];
            violations.push({ id: 'V' + Date.now(), status: 'open', empId, type: 'similar_face', details: 'تنبيه: وجه مشابه للموظف ' + similarFound.empId + ' (المسافة: ' + similarFound.distance.toFixed(3) + ') — قد يكون توأم أو قريب', date: new Date().toISOString().split('T')[0], ts: new Date().toISOString() });
            await dbSet('violations', violations);
            return res.json({ ok: true, warning: 'similar_face', matchedEmpId: similarFound.empId });
          }
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          const faceId = req.query.empId;
          if (faceId === 'ALL') {
            // Admin: clear all faces
            await dbSet('faces', {});
            return res.json({ ok: true, msg: 'all faces cleared' });
          }
          if (!faceId) return res.status(400).json({ error: 'empId required' });
          const faces = await dbGet('faces') || {};
          delete faces[faceId];
          await dbSet('faces', faces);
          return res.json({ ok: true });
        }
        return res.json({ error: 'method not allowed' });
      }

      case 'attendance': {
        let recs = await dbGet('attendance') || [];
        const { empId, date, from, to } = req.query;
        if (empId) recs = recs.filter(r => r.empId === empId);
        if (date) recs = recs.filter(r => r.date === date);
        if (from) recs = recs.filter(r => r.date >= from);
        if (to) recs = recs.filter(r => r.date <= to);
        return res.json(recs);
      }

      case 'manual_checkin': {
        const { empId, type, date, adminId } = req.body || {};
        const recs = await dbGet('manual_attendance') || [];
        recs.push({ id: 'M' + Date.now(), empId, type, date, adminId, ts: new Date().toISOString(), manual: true });
        await dbSet('manual_attendance', recs);
        // Also add to regular attendance
        const att = await dbGet('attendance') || [];
        att.push({ id: 'MA' + Date.now(), empId, type, date, ts: new Date().toISOString(), manual: true, adminId });
        await dbSet('attendance', att);
        return res.json({ ok: true });
      }

      case 'branches': {
        if (req.method === 'GET') return res.json(await dbGet('branches') || INIT_BRANCHES);
        if (req.method === 'PUT') { await dbSet('branches', req.body); return res.json({ ok: true }); }
        if (req.method === 'POST') { const bs = await dbGet('branches') || []; bs.push(req.body); await dbSet('branches', bs); return res.json({ ok: true }); }
        break;
      }

      case 'projects': {
        if (req.method === 'GET') return res.json(await dbGet('projects') || []);
        if (req.method === 'POST') { const ps = await dbGet('projects') || []; ps.push({ id: 'P' + Date.now(), ...req.body }); await dbSet('projects', ps); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const ps = await dbGet('projects') || [];
          const { id, ...up } = req.body;
          const i = ps.findIndex(p => p.id === id);
          if (i >= 0) { ps[i] = { ...ps[i], ...up }; await dbSet('projects', ps); }
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') { const ps = await dbGet('projects') || []; await dbSet('projects', ps.filter(p => p.id !== req.query.id)); return res.json({ ok: true }); }
        break;
      }

      case 'delegations': {
        if (req.method === 'GET') return res.json(await dbGet('delegations') || []);
        if (req.method === 'POST') { const ds = await dbGet('delegations') || []; ds.push({ id: 'D' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() }); await dbSet('delegations', ds); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const ds = await dbGet('delegations') || [];
          const { id, status } = req.body;
          const i = ds.findIndex(d => d.id === id);
          if (i >= 0) { ds[i].status = status; ds[i].decidedAt = new Date().toISOString(); await dbSet('delegations', ds); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'exceptions': {
        if (req.method === 'GET') return res.json(await dbGet('exceptions') || []);
        if (req.method === 'POST') { const es = await dbGet('exceptions') || []; es.push({ id: 'EX' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() }); await dbSet('exceptions', es); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const es = await dbGet('exceptions') || [];
          const { id, status } = req.body;
          const i = es.findIndex(e => e.id === id);
          if (i >= 0) { es[i].status = status; await dbSet('exceptions', es); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'leaves': {
        if (req.method === 'GET') return res.json(await dbGet('leaves') || []);
        if (req.method === 'POST') { const ls = await dbGet('leaves') || []; ls.push({ id: 'L' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() }); await dbSet('leaves', ls); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const ls = await dbGet('leaves') || [];
          const { id, status } = req.body;
          const i = ls.findIndex(l => l.id === id);
          if (i >= 0) { ls[i].status = status; await dbSet('leaves', ls); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'violations': {
        if (req.method === 'GET') {
          let vs = await dbGet('violations') || [];
          const { empId } = req.query;
          if (empId) vs = vs.filter(v => v.empId === empId);
          return res.json(vs);
        }
        if (req.method === 'POST') { const vs = await dbGet('violations') || []; vs.push({ id: 'V' + Date.now(), status: 'open', ...req.body, ts: new Date().toISOString() }); await dbSet('violations', vs); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const vs = await dbGet('violations') || [];
          const { id, ...up } = req.body;
          const i = vs.findIndex(v => v.id === id);
          if (i >= 0) { vs[i] = { ...vs[i], ...up, updatedAt: new Date().toISOString() }; await dbSet('violations', vs); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'warnings': {
        if (req.method === 'GET') {
          let ws = await dbGet('warnings') || [];
          const { empId } = req.query;
          if (empId) ws = ws.filter(w => w.empId === empId);
          return res.json(ws);
        }
        if (req.method === 'POST') { const ws = await dbGet('warnings') || []; ws.push({ id: 'W' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() }); await dbSet('warnings', ws); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const ws = await dbGet('warnings') || [];
          const { id, ...up } = req.body;
          const i = ws.findIndex(w => w.id === id);
          if (i >= 0) { ws[i] = { ...ws[i], ...up, updatedAt: new Date().toISOString() }; await dbSet('warnings', ws); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'pre_absence': {
        if (req.method === 'GET') return res.json(await dbGet('pre_absences') || []);
        if (req.method === 'POST') {
          const pas = await dbGet('pre_absences') || [];
          pas.push({ id: 'PA' + Date.now(), ...req.body, ts: new Date().toISOString() });
          await dbSet('pre_absences', pas);
          return res.json({ ok: true });
        }
        break;
      }

      case 'custody': {
        if (req.method === 'GET') {
          let items = await dbGet('custody') || [];
          const { empId } = req.query;
          if (empId) items = items.filter(c => c.empId === empId);
          return res.json(items);
        }
        if (req.method === 'POST') {
          const items = await dbGet('custody') || [];
          items.push({ id: 'CUS' + Date.now(), status: 'active', ...req.body, createdAt: new Date().toISOString() });
          await dbSet('custody', items);
          return res.json({ ok: true });
        }
        if (req.method === 'PUT') {
          const items = await dbGet('custody') || [];
          const { id, ...up } = req.body;
          const i = items.findIndex(c => c.id === id);
          if (i >= 0) { items[i] = { ...items[i], ...up, updatedAt: new Date().toISOString() }; await dbSet('custody', items); }
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          const items = await dbGet('custody') || [];
          await dbSet('custody', items.filter(c => c.id !== req.query.id));
          return res.json({ ok: true });
        }
        break;
      }

      case 'custody_maintenance': {
        if (req.method === 'GET') {
          let logs = await dbGet('custody_maint') || [];
          const { custodyId } = req.query;
          if (custodyId) logs = logs.filter(l => l.custodyId === custodyId);
          return res.json(logs);
        }
        if (req.method === 'POST') {
          const logs = await dbGet('custody_maint') || [];
          logs.push({ id: 'CM' + Date.now(), ...req.body, ts: new Date().toISOString() });
          await dbSet('custody_maint', logs);
          return res.json({ ok: true });
        }
        break;
      }

      case 'gps_log': {
        if (req.method === 'GET') {
          let logs = await dbGet('gps_logs') || [];
          const { empId, date } = req.query;
          if (empId) logs = logs.filter(l => l.empId === empId);
          if (date) logs = logs.filter(l => l.date === date);
          return res.json(logs);
        }
        if (req.method === 'POST') {
          const logs = await dbGet('gps_logs') || [];
          const entry = { ...req.body, ts: new Date().toISOString(), date: new Date().toISOString().split('T')[0] };
          logs.push(entry);
          // Keep only last 7 days
          const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
          const filtered = logs.filter(l => new Date(l.ts) > cutoff);
          await dbSet('gps_logs', filtered);
          return res.json({ ok: true });
        }
        break;
      }

      case 'termination': {
        if (req.method === 'GET') return res.json(await dbGet('terminations') || []);
        if (req.method === 'POST') {
          const ts = await dbGet('terminations') || [];
          ts.push({ id: 'TERM' + Date.now(), status: 'pending', ...req.body, createdAt: new Date().toISOString() });
          await dbSet('terminations', ts);
          // Deactivate employee
          const emps = await dbGet('employees') || [];
          const ei = emps.findIndex(e => e.id === req.body.empId);
          if (ei >= 0) { emps[ei].terminated = true; emps[ei].terminatedAt = new Date().toISOString(); await dbSet('employees', emps); }
          return res.json({ ok: true });
        }
        if (req.method === 'PUT') {
          const ts = await dbGet('terminations') || [];
          const { id, ...up } = req.body;
          const i = ts.findIndex(t => t.id === id);
          if (i >= 0) { ts[i] = { ...ts[i], ...up }; await dbSet('terminations', ts); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'requests': {
        if (req.method === 'GET') {
          let reqs = await dbGet('admin_requests') || [];
          const { empId } = req.query;
          if (empId) reqs = reqs.filter(r => r.empId === empId);
          return res.json(reqs);
        }
        if (req.method === 'POST') {
          const reqs = await dbGet('admin_requests') || [];
          const newReq = { id: 'REQ' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() };
          reqs.push(newReq);
          const saved = await dbSet('admin_requests', reqs);
          return res.json({ ok: saved, saved, id: newReq.id, total: reqs.length });
        }
        if (req.method === 'PUT') {
          const reqs = await dbGet('admin_requests') || [];
          const { id, ...up } = req.body;
          const i = reqs.findIndex(r => r.id === id);
          if (i >= 0) { reqs[i] = { ...reqs[i], ...up }; await dbSet('admin_requests', reqs); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'clusters': {
        // Detect employee clusters (groups in same location)
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const logs = (await dbGet('gps_logs') || []).filter(l => l.date === targetDate && l.lat && l.lat !== 0);
        const settings = await dbGet('settings') || {};
        const clusterRadius = settings.clusterRadius || 30; // meters
        const clusterMinPeople = settings.clusterMinPeople || 3;
        const clusterMinMinutes = settings.clusterMinMinutes || 30;

        // Group logs by time windows (15-min blocks)
        var timeBlocks = {};
        logs.forEach(function(l) {
          var h = new Date(l.ts).getHours(), m = new Date(l.ts).getMinutes();
          var block = h + ":" + (m < 15 ? "00" : m < 30 ? "15" : m < 45 ? "30" : "45");
          if (!timeBlocks[block]) timeBlocks[block] = [];
          timeBlocks[block].push(l);
        });

        // Find clusters in each block
        var clusters = [];
        Object.keys(timeBlocks).forEach(function(block) {
          var bl = timeBlocks[block];
          var grouped = {};
          bl.forEach(function(l) {
            var key = Math.round(l.lat * 1000) + "," + Math.round(l.lng * 1000); // ~100m grid
            if (!grouped[key]) grouped[key] = { lat: l.lat, lng: l.lng, emps: new Set() };
            grouped[key].emps.add(l.empId);
          });
          Object.values(grouped).forEach(function(g) {
            if (g.emps.size >= clusterMinPeople) {
              clusters.push({ time: block, lat: g.lat, lng: g.lng, employees: Array.from(g.emps), count: g.emps.size });
            }
          });
        });

        return res.json({ date: targetDate, clusters, settings: { clusterRadius, clusterMinPeople, clusterMinMinutes } });
      }

      case 'comparison': {
        // Weekly employee movement comparison
        const emps = await dbGet('employees') || [];
        const logs = await dbGet('gps_logs') || [];
        const now = new Date();
        var weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        var weekLogs = logs.filter(l => new Date(l.ts) >= weekAgo && l.lat && l.lat !== 0);

        var comparison = emps.filter(e => !e.terminated).map(function(e) {
          var myLogs = weekLogs.filter(l => l.empId === e.id);
          var stationary = 0, moving = 0;
          for (var i = 1; i < myLogs.length; i++) {
            var d = Math.sqrt(Math.pow(myLogs[i].lat - myLogs[i-1].lat, 2) + Math.pow(myLogs[i].lng - myLogs[i-1].lng, 2)) * 111000;
            if (d < 20) stationary++; else moving++;
          }
          var total = stationary + moving || 1;
          var appEvents = logs.filter(l => l.empId === e.id && l.event);
          var closedCount = appEvents.filter(l => l.event === "app_closed" || l.event === "app_hidden").length;
          return {
            id: e.id, name: e.name, branch: e.branch,
            totalPoints: myLogs.length,
            movementPct: Math.round(moving / total * 100),
            stationaryPct: Math.round(stationary / total * 100),
            appCloses: closedCount,
          };
        }).sort(function(a, b) { return b.movementPct - a.movementPct; });

        return res.json({ from: weekAgo.toISOString().split('T')[0], to: now.toISOString().split('T')[0], employees: comparison });
      }

      case 'auto_check': {
        // Auto-detect violations for today
        const today = new Date().toISOString().split('T')[0];
        const emps = await dbGet('employees') || [];
        const att = (await dbGet('attendance') || []).filter(a => a.date === today);
        const violations = await dbGet('violations') || [];
        const preAbs = (await dbGet('pre_absences') || []).filter(p => p.date === today);
        const branches = await dbGet('branches') || [];
        const settings = await dbGet('settings') || {};
        var newViolations = [];
        var hour = new Date().getHours(), min = new Date().getMinutes();
        var curMin = hour * 60 + min;

        for (const emp of emps) {
          if (emp.terminated || emp.onLeave) continue;
          if (preAbs.find(p => p.empId === emp.id)) continue; // Pre-notified absence
          var empAtt = att.filter(a => a.empId === emp.id);
          var hasCheckin = empAtt.find(a => a.type === "الحضور");
          var br = branches.find(b => b.id === emp.branch) || { start: "08:30" };
          var startMin = parseInt(br.start?.split(":")[0] || 8) * 60 + parseInt(br.start?.split(":")[1] || 30);

          // Late detection (after start + 15 min grace)
          if (curMin > startMin + 15 && hasCheckin) {
            var checkinTime = new Date(hasCheckin.ts);
            var checkinMin = checkinTime.getHours() * 60 + checkinTime.getMinutes();
            if (checkinMin > startMin + 5) {
              var lateMin = checkinMin - startMin;
              var existing = violations.find(v => v.empId === emp.id && v.date === today && v.type === "late");
              if (!existing) newViolations.push({ empId: emp.id, empName: emp.name, type: "late", date: today, details: "تأخر " + lateMin + " دقيقة" });
            }
          }

          // Absent detection (after start + 60 min, no checkin)
          if (curMin > startMin + 60 && !hasCheckin) {
            var existing2 = violations.find(v => v.empId === emp.id && v.date === today && v.type === "absent");
            if (!existing2) newViolations.push({ empId: emp.id, empName: emp.name, type: "absent", date: today, details: "غياب بدون إفادة مسبقة" });
          }
        }

        // Save new violations
        if (newViolations.length > 0) {
          for (const v of newViolations) violations.push({ id: 'V' + Date.now() + Math.random().toString(36).substr(2, 4), status: 'open', ...v, ts: new Date().toISOString() });
          await dbSet('violations', violations);
        }

        // Auto-escalate overdue warnings
        const warnings = await dbGet('warnings') || [];
        var escalated = 0;
        for (const w of warnings) {
          if (w.status === 'pending' && w.deadline && new Date(w.deadline) < new Date()) {
            w.status = 'escalated';
            w.escalatedAt = new Date().toISOString();
            escalated++;
          }
        }
        if (escalated > 0) await dbSet('warnings', warnings);

        return res.json({ ok: true, newViolations: newViolations.length, escalated, date: today });
      }

      case 'dependents': {
        if (req.method === 'GET') { const ds = await dbGet('dependents') || []; const { empId } = req.query; return res.json(empId ? ds.filter(d => d.empId === empId) : ds); }
        if (req.method === 'POST') { const ds = await dbGet('dependents') || []; ds.push({ id: 'DEP' + Date.now(), status: 'pending', ...req.body }); await dbSet('dependents', ds); return res.json({ ok: true }); }
        break;
      }

      case 'tickets': {
        if (req.method === 'GET') return res.json(await dbGet('tickets') || []);
        if (req.method === 'POST') { const ts = await dbGet('tickets') || []; ts.push({ id: 'T' + Date.now(), status: 'open', ...req.body, ts: new Date().toISOString() }); await dbSet('tickets', ts); return res.json({ ok: true }); }
        break;
      }

      case 'events': {
        if (req.method === 'GET') return res.json(await dbGet('events') || []);
        if (req.method === 'POST') {
          // Bulk save (full array) or single add
          if (Array.isArray(req.body)) {
            await dbSet('events', req.body);
            return res.json({ ok: true });
          }
          const es = await dbGet('events') || []; es.push({ id: 'EV' + Date.now(), ...req.body }); await dbSet('events', es); return res.json({ ok: true });
        }
        if (req.method === 'PUT') {
          const es = await dbGet('events') || [];
          const { id, ...up } = req.body;
          const i = es.findIndex(e => e.id === id);
          if (i >= 0) { es[i] = { ...es[i], ...up }; await dbSet('events', es); }
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') { const es = await dbGet('events') || []; await dbSet('events', es.filter(e => e.id !== req.query.id)); return res.json({ ok: true }); }
        break;
      }

      case 'settings': {
        if (req.method === 'GET') return res.json(await dbGet('settings') || {});
        if (req.method === 'PUT') { await dbSet('settings', req.body); return res.json({ ok: true }); }
        break;
      }

      case 'kadwar-sync': {
        if (req.method === 'GET') {
          const emps = await dbGet('employees') || [];
          return res.json({ employees: emps.map(e => ({ id: e.id, compliance: Math.round((e.points || 0) / 15), points: e.points || 0 })), syncDate: new Date().toISOString() });
        }
        break;
      }

      case 'report': {
        const { period } = req.query; // 'weekly' or 'monthly'
        const emps = await dbGet('employees') || [];
        const att = await dbGet('attendance') || [];
        const violations = await dbGet('violations') || [];
        const warnings = await dbGet('warnings') || [];
        const leaves = await dbGet('leaves') || [];
        const now = new Date();
        var startDate, endDate = now.toISOString().split('T')[0];

        if (period === 'weekly') {
          var d = new Date(); d.setDate(d.getDate() - 7);
          startDate = d.toISOString().split('T')[0];
        } else {
          var d2 = new Date(); d2.setMonth(d2.getMonth() - 1);
          startDate = d2.toISOString().split('T')[0];
        }

        var periodAtt = att.filter(a => a.date >= startDate && a.date <= endDate);
        var periodViol = violations.filter(v => (v.date || v.ts?.split('T')[0]) >= startDate);
        var periodWarn = warnings.filter(w => w.ts?.split('T')[0] >= startDate);
        var periodLeaves = leaves.filter(l => l.ts?.split('T')[0] >= startDate);

        // Build per-employee summary
        var empSummary = emps.filter(e => !e.terminated).map(function(e) {
          var myAtt = periodAtt.filter(a => a.empId === e.id);
          var checkins = myAtt.filter(a => a.type === "الحضور").length;
          var myViol = periodViol.filter(v => v.empId === e.id);
          var myWarn = periodWarn.filter(w => w.empId === e.id);
          var lateCount = myViol.filter(v => v.type === "late").length;
          var absentCount = myViol.filter(v => v.type === "absent").length;
          return {
            id: e.id, name: e.name, branch: e.branch, role: e.role,
            daysPresent: checkins, lateCount, absentCount,
            violationCount: myViol.length, warningCount: myWarn.length,
            pendingWarnings: myWarn.filter(w => w.status === "pending").length,
          };
        });

        return res.json({
          period: period || 'monthly',
          from: startDate, to: endDate,
          totalEmployees: emps.filter(e => !e.terminated).length,
          totalAttendance: periodAtt.length,
          totalViolations: periodViol.length,
          totalWarnings: periodWarn.length,
          pendingWarnings: periodWarn.filter(w => w.status === "pending").length,
          escalatedWarnings: periodWarn.filter(w => w.status === "escalated").length,
          pendingLeaves: periodLeaves.filter(l => l.status === "pending").length,
          employees: empSummary,
          generatedAt: now.toISOString()
        });
      }

      case 'export': {
        const { type } = req.query;
        const emps = await dbGet('employees') || [];
        const att = await dbGet('attendance') || [];
        if (type === 'payroll') {
          const vs = await dbGet('violations') || [];
          let csv = 'الرقم,الاسم,الراتب,الخصومات,الصافي\n';
          emps.forEach(e => { const d = vs.filter(v => v.empId === e.id).reduce((a, v) => a + (v.deduction || 0), 0); csv += `${e.id},${e.name},${e.salary},${d},${e.salary - d}\n`; });
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send('\uFEFF' + csv);
        }
        if (type === 'attendance') {
          let csv = 'التاريخ,الرقم,الاسم,النوع,الوقت,يدوي\n';
          att.forEach(r => { const e = emps.find(x => x.id === r.empId); csv += `${r.date},${r.empId},${e?.name || ''},${r.type},${r.ts},${r.manual ? 'نعم' : 'لا'}\n`; });
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send('\uFEFF' + csv);
        }
        return res.json({ error: 'unknown type' });
      }

      case 'cleanup': {
        var result = await dbCleanup();
        return res.json(result);
      }

      /* ═══ KADWAR NOTIFICATIONS (إشعارات كوادر) ═══ */
      case 'kadwar_notifs': {
        // Returns notification counts for kadwar badges in basma
        // In future: read from shared Redis with kadwar
        var empId = req.query.empId;
        var notifs = await dbGet('kadwar_notifs') || {};
        var empNotifs = notifs[empId] || { tasks: 0, exams: 0, alerts: 0 };
        return res.json(empNotifs);
      }

      /* ═══ PERMISSIONS (طلب إذن) ═══ */
      case 'permissions': {
        if (req.method === 'GET') {
          var perms = await dbGet('permissions') || [];
          if (req.query.empId) perms = perms.filter(p => p.empId === req.query.empId);
          return res.json(perms);
        }
        if (req.method === 'POST') {
          var perms = await dbGet('permissions') || [];
          var newPerm = { id: 'PERM' + Date.now(), status: 'pending', ts: new Date().toISOString(), ...req.body };
          perms.push(newPerm);
          await dbSet('permissions', perms);
          return res.json({ ok: true, permission: newPerm });
        }
        if (req.method === 'PUT') {
          var perms = await dbGet('permissions') || [];
          var idx = perms.findIndex(p => p.id === req.body.id);
          if (idx >= 0) { perms[idx] = { ...perms[idx], ...req.body }; await dbSet('permissions', perms); }
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ HEALTH DISCLOSURE (الإفصاح الصحي) ═══ */
      case 'health_disclosure': {
        if (req.method === 'GET') {
          var hd = await dbGet('health_disclosures') || [];
          if (req.query.empId) hd = hd.filter(h => h.empId === req.query.empId);
          return res.json(hd);
        }
        if (req.method === 'POST') {
          var hd = await dbGet('health_disclosures') || [];
          var existing = hd.findIndex(h => h.empId === req.body.empId);
          var record = { ...req.body, status: 'pending', updatedAt: new Date().toISOString() };
          if (existing >= 0) { hd[existing] = { ...hd[existing], ...record }; } else { hd.push(record); }
          await dbSet('health_disclosures', hd);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ ATTACHMENTS (المرفقات) ═══ */
      case 'attachments': {
        if (req.method === 'GET') {
          var docs = await dbGet('attachments') || [];
          if (req.query.empId) docs = docs.filter(d => d.empId === req.query.empId);
          return res.json(docs);
        }
        if (req.method === 'POST') {
          var docs = await dbGet('attachments') || [];
          var fileData = req.body.data; // base64
          delete req.body.data; // don't store base64 in main DB
          var newDoc = { id: 'ATT' + Date.now(), status: 'pending', ts: new Date().toISOString(), ...req.body };
          // Store file separately in blob
          if (fileData) {
            try { await put(PFX + 'files/' + newDoc.id, fileData, { access: 'public', contentType: 'text/plain', addRandomSuffix: false }); newDoc.hasFile = true; } catch(e) { /**/ }
          }
          docs.push(newDoc);
          await dbSet('attachments', docs);
          return res.json({ ok: true, doc: newDoc });
        }
        if (req.method === 'PUT') {
          var docs = await dbGet('attachments') || [];
          var idx = docs.findIndex(d => d.id === req.body.id);
          if (idx >= 0) { docs[idx] = { ...docs[idx], ...req.body }; await dbSet('attachments', docs); }
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          var docs = await dbGet('attachments') || [];
          docs = docs.filter(d => d.id !== req.query.id);
          await dbSet('attachments', docs);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ ATTACHMENT TYPES (أنواع المرفقات — يديرها الأدمن) ═══ */
      case 'attachment_types': {
        if (req.method === 'GET') {
          var types = await dbGet('attachment_types');
          if (!types) types = ["بطاقة هوية", "جواز سفر", "رخصة قيادة", "عقد عمل", "IBAN بنكي", "أخرى"];
          return res.json(types);
        }
        if (req.method === 'POST') {
          await dbSet('attachment_types', req.body.types || []);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ LAIHA SETTINGS (إعدادات لائحة المخالفات — يديرها المدير العام) ═══ */
      case 'laiha_settings': {
        if (req.method === 'GET') {
          // Returns admin overrides: { "WH-01": { enabled: true, autoApply: false, customPenalties: {...} } }
          var settings = await dbGet('laiha_settings') || {};
          return res.json(settings);
        }
        if (req.method === 'POST') {
          // Update single item: { id, enabled, autoApply, customDescription, customPenalties }
          var settings = await dbGet('laiha_settings') || {};
          settings[req.body.id] = {
            enabled: req.body.enabled !== undefined ? req.body.enabled : true,
            autoApply: req.body.autoApply !== undefined ? req.body.autoApply : false,
            customDescription: req.body.customDescription || null,
            customPenalties: req.body.customPenalties || null,
            updatedAt: new Date().toISOString(),
            updatedBy: req.body.updatedBy || 'admin',
          };
          await dbSet('laiha_settings', settings);
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          // Reset specific item to default
          var settings = await dbGet('laiha_settings') || {};
          delete settings[req.query.id];
          await dbSet('laiha_settings', settings);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ COMPLAINTS (الشكاوى الرسمية) ═══ */
      case 'complaints': {
        if (req.method === 'GET') {
          var complaints = await dbGet('complaints') || [];
          if (req.query.filedBy) complaints = complaints.filter(c => c.filedBy === req.query.filedBy);
          if (req.query.against) complaints = complaints.filter(c => c.against === req.query.against);
          if (req.query.status) complaints = complaints.filter(c => c.status === req.query.status);
          if (req.query.id) complaints = complaints.filter(c => c.id === req.query.id);
          return res.json(complaints);
        }
        if (req.method === 'POST') {
          var complaints = await dbGet('complaints') || [];
          var newComplaint = {
            id: 'CMP' + Date.now(),
            status: 'PENDING_HR',
            createdAt: new Date().toISOString(),
            filedBy: req.body.filedBy,       // ID الشاكي
            filedByName: req.body.filedByName,
            against: req.body.against,        // ID المشكو عليه
            againstName: req.body.againstName,
            violationId: req.body.violationId, // من اللائحة
            chapter: req.body.chapter,         // الفصل
            title: req.body.title,
            details: req.body.details,
            evidence: req.body.evidence || [], // مرفقات
            hrNotes: null,
            hrDecision: null,                  // rejected | investigate | convert
            decidedAt: null,
            decidedBy: null,
            investigationId: null,
            violationCreatedId: null,
          };
          complaints.push(newComplaint);
          await dbSet('complaints', complaints);
          return res.json({ ok: true, complaint: newComplaint });
        }
        if (req.method === 'PUT') {
          // HR decision or status update
          var complaints = await dbGet('complaints') || [];
          var idx = complaints.findIndex(c => c.id === req.body.id);
          if (idx >= 0) {
            complaints[idx] = { ...complaints[idx], ...req.body, updatedAt: new Date().toISOString() };
            await dbSet('complaints', complaints);
          }
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ INVESTIGATIONS (التحقيقات) ═══ */
      case 'investigations': {
        if (req.method === 'GET') {
          var investigations = await dbGet('investigations') || [];
          if (req.query.empId) investigations = investigations.filter(i => i.empId === req.query.empId);
          if (req.query.complaintId) investigations = investigations.filter(i => i.complaintId === req.query.complaintId);
          if (req.query.status) investigations = investigations.filter(i => i.status === req.query.status);
          if (req.query.id) investigations = investigations.filter(i => i.id === req.query.id);
          return res.json(investigations);
        }
        if (req.method === 'POST') {
          var investigations = await dbGet('investigations') || [];
          var newInv = {
            id: 'INV' + Date.now(),
            complaintId: req.body.complaintId,
            empId: req.body.empId,
            empName: req.body.empName,
            violationId: req.body.violationId,
            chapter: req.body.chapter,
            title: req.body.title,
            description: req.body.description,
            questions: req.body.questions || [], // الأسئلة الموجهة للموظف
            createdAt: new Date().toISOString(),
            createdBy: req.body.createdBy,
            deadline: req.body.deadline,          // 24 ساعة من الإنشاء
            status: 'WAITING_RESPONSE',
            empResponse: null,                     // نص الرد
            empResponseAttachments: [],            // مرفقات الرد
            empResponseAt: null,
            hrDecision: null,                      // convert_to_violation | close_innocent
            hrDecisionNotes: null,
            hrDecidedAt: null,
            hrDecidedBy: null,
          };
          investigations.push(newInv);
          await dbSet('investigations', investigations);
          // Link to complaint
          if (req.body.complaintId) {
            var complaints = await dbGet('complaints') || [];
            var cIdx = complaints.findIndex(c => c.id === req.body.complaintId);
            if (cIdx >= 0) {
              complaints[cIdx].status = 'UNDER_INVESTIGATION';
              complaints[cIdx].investigationId = newInv.id;
              await dbSet('complaints', complaints);
            }
          }
          // Auto-notify employee about investigation
          try {
            var notifs = await dbGet('notifications') || [];
            notifs.push({
              id: 'NTF' + Date.now(),
              empId: newInv.empId,
              type: 'investigation',
              title: '🔍 استمارة تحقيق',
              body: 'فُتح تحقيق بخصوص: ' + (newInv.title || '').slice(0, 60) + ' — يجب الرد خلال 24 ساعة',
              refId: newInv.id,
              read: false,
              createdAt: new Date().toISOString(),
            });
            await dbSet('notifications', notifs);
          } catch(e) { /**/ }
          return res.json({ ok: true, investigation: newInv });
        }
        if (req.method === 'PUT') {
          var investigations = await dbGet('investigations') || [];
          var idx = investigations.findIndex(i => i.id === req.body.id);
          if (idx >= 0) {
            investigations[idx] = { ...investigations[idx], ...req.body, updatedAt: new Date().toISOString() };
            await dbSet('investigations', investigations);
          }
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ VIOLATIONS V2 (المخالفات الرسمية) — الجدول الجديد ═══ */
      case 'violations_v2': {
        if (req.method === 'GET') {
          var vios = await dbGet('violations_v2') || [];
          if (req.query.empId) vios = vios.filter(v => v.empId === req.query.empId);
          if (req.query.status) vios = vios.filter(v => v.status === req.query.status);
          return res.json(vios);
        }
        if (req.method === 'POST') {
          var vios = await dbGet('violations_v2') || [];
          // Count previous same-violation for this employee (within 180 days)
          var now = new Date();
          var oneEightyAgo = new Date(now.getTime() - 180 * 24 * 3600 * 1000);
          var sameViolationCount = vios.filter(v =>
            v.empId === req.body.empId &&
            v.violationId === req.body.violationId &&
            v.status === 'ACTIVE' &&
            new Date(v.createdAt) > oneEightyAgo
          ).length;
          var occurrence = sameViolationCount + 1; // 1=first, 2=second, 3=third, 4=fourth
          var penaltyKey = occurrence === 1 ? 'first' : occurrence === 2 ? 'second' : occurrence === 3 ? 'third' : 'fourth';
          var newVio = {
            id: 'VIO' + Date.now(),
            empId: req.body.empId,
            empName: req.body.empName,
            violationId: req.body.violationId,
            chapter: req.body.chapter,
            description: req.body.description,
            occurrence: occurrence,
            penaltyCode: req.body.penaltyCode || (req.body.penalties && req.body.penalties[penaltyKey]),
            penaltyLabel: req.body.penaltyLabel,
            complaintId: req.body.complaintId || null,
            investigationId: req.body.investigationId || null,
            source: req.body.source || 'manual', // auto | manual | from_investigation
            legalRef: req.body.legalRef || 'اللائحة التنفيذية لنظام العمل السعودي - رقم الاعتماد 978004',
            createdAt: new Date().toISOString(),
            createdBy: req.body.createdBy,
            approvedBy: req.body.approvedBy || null,
            status: 'ACTIVE',
            appealedAt: null,
            appealResponse: null,
            notes: req.body.notes || null,
          };
          vios.push(newVio);
          await dbSet('violations_v2', vios);
          // Auto-notify employee
          try {
            var notifs = await dbGet('notifications') || [];
            notifs.push({
              id: 'NTF' + Date.now(),
              empId: newVio.empId,
              type: 'violation',
              title: '⚖️ مخالفة جديدة',
              body: 'صدرت مخالفة بحقك: ' + (newVio.description || '').slice(0, 80) + ' — الجزاء: ' + (newVio.penaltyLabel || ''),
              refId: newVio.id,
              read: false,
              createdAt: new Date().toISOString(),
            });
            await dbSet('notifications', notifs);
          } catch(e) { /**/ }
          return res.json({ ok: true, violation: newVio });
        }
        if (req.method === 'PUT') {
          var vios = await dbGet('violations_v2') || [];
          var idx = vios.findIndex(v => v.id === req.body.id);
          if (idx >= 0) {
            vios[idx] = { ...vios[idx], ...req.body, updatedAt: new Date().toISOString() };
            await dbSet('violations_v2', vios);
          }
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ APPEALS (التظلمات) ═══ */
      case 'appeals': {
        if (req.method === 'GET') {
          var appeals = await dbGet('appeals') || [];
          if (req.query.empId) appeals = appeals.filter(a => a.empId === req.query.empId);
          if (req.query.violationId) appeals = appeals.filter(a => a.violationId === req.query.violationId);
          return res.json(appeals);
        }
        if (req.method === 'POST') {
          var appeals = await dbGet('appeals') || [];
          var newAppeal = {
            id: 'APL' + Date.now(),
            violationId: req.body.violationId,
            empId: req.body.empId,
            empName: req.body.empName,
            reason: req.body.reason,
            attachments: req.body.attachments || [],
            createdAt: new Date().toISOString(),
            deadline: new Date(new Date().getTime() + 5 * 24 * 3600 * 1000).toISOString(),
            status: 'PENDING',
            decision: null,
            decisionNotes: null,
            decidedAt: null,
            decidedBy: null,
          };
          appeals.push(newAppeal);
          // Link to violation
          var vios = await dbGet('violations_v2') || [];
          var vIdx = vios.findIndex(v => v.id === req.body.violationId);
          if (vIdx >= 0) {
            vios[vIdx].status = 'APPEALED';
            vios[vIdx].appealedAt = new Date().toISOString();
            await dbSet('violations_v2', vios);
          }
          await dbSet('appeals', appeals);
          return res.json({ ok: true, appeal: newAppeal });
        }
        if (req.method === 'PUT') {
          var appeals = await dbGet('appeals') || [];
          var idx = appeals.findIndex(a => a.id === req.body.id);
          if (idx >= 0) {
            appeals[idx] = { ...appeals[idx], ...req.body, updatedAt: new Date().toISOString() };
            await dbSet('appeals', appeals);
          }
          return res.json({ ok: true });
        }
        break;
      }


      /* ═══ AUTO VIOLATIONS (الإنذارات التلقائية) ═══ */
      case 'auto_violations': {
        // Called by cron daily 6pm — checks today's attendance and generates violations per laiha
        var emps = await dbGet('employees') || [];
        var att = await dbGet('attendance') || [];
        var violationsV2 = await dbGet('violations_v2') || [];
        var preAbs = await dbGet('pre_absences') || [];
        var branches = await dbGet('branches') || [];
        var laihaSettings = await dbGet('laiha_settings') || {};
        var today = new Date().toISOString().split('T')[0];
        var todayAtt = att.filter(a => a.date === today);
        var todayPreAbs = preAbs.filter(p => p.date === today);
        var generated = [];

        // Penalties lookup (mirrors laiha.js PENALTY_TYPES)
        var penaltyLabels = {
          WARNING: 'إنذار كتابي', FINE_5: 'خصم 5%', FINE_10: 'خصم 10%', FINE_15: 'خصم 15%',
          FINE_20: 'خصم 20%', FINE_25: 'خصم 25%', FINE_30: 'خصم 30%', FINE_50: 'خصم 50%',
          FINE_75: 'خصم 75%', FINE_1DAY: 'خصم يوم', FINE_2DAYS: 'خصم يومين',
          FINE_3DAYS: 'خصم 3 أيام', FINE_4DAYS: 'خصم 4 أيام', FINE_5DAYS: 'خصم 5 أيام',
          DENY_PROMOTION: 'حرمان من الترقية/العلاوة',
          TERMINATION_WITH: 'فصل مع المكافأة', TERMINATION_WITHOUT: 'فصل دون مكافأة (م.80)',
        };

        // Laiha rules (auto-detectable only)
        var laihaRules = [
          { id: 'WH-01', maxLate: 15, penalties: { first: 'WARNING', second: 'FINE_5', third: 'FINE_10', fourth: 'FINE_20' }, desc: 'التأخر لغاية 15 دقيقة دون إذن' },
          { id: 'WH-03', minLate: 16, maxLate: 30, penalties: { first: 'FINE_10', second: 'FINE_15', third: 'FINE_25', fourth: 'FINE_50' }, desc: 'التأخر أكثر من 15 وحتى 30 دقيقة دون إذن' },
          { id: 'WH-05', minLate: 31, maxLate: 60, penalties: { first: 'FINE_25', second: 'FINE_50', third: 'FINE_75', fourth: 'FINE_1DAY' }, desc: 'التأخر أكثر من 30 وحتى 60 دقيقة دون إذن' },
          { id: 'WH-07', minLate: 61, penalties: { first: 'WARNING', second: 'FINE_1DAY', third: 'FINE_2DAYS', fourth: 'FINE_3DAYS' }, desc: 'التأخر لمدة تزيد على ساعة دون إذن' },
          { id: 'WH-11', absentDays: 1, penalties: { first: 'FINE_2DAYS', second: 'FINE_3DAYS', third: 'FINE_4DAYS', fourth: 'DENY_PROMOTION' }, desc: 'الغياب يوم دون إذن كتابي' },
        ];

        emps.forEach(function(emp) {
          if (emp.terminated || emp.onLeave) return;
          if (todayPreAbs.some(p => p.empId === emp.id)) return;

          var branch = branches.find(b => b.id === emp.branch || b.name === emp.branch);
          if (!branch) return;

          var empAtt = todayAtt.filter(a => a.empId === emp.id);
          var checkin = empAtt.find(a => a.type === 'checkin');
          var nowH = new Date().getHours();

          function applyRule(rule, extraDesc) {
            // Check admin settings — is this rule enabled?
            var setting = laihaSettings[rule.id];
            var enabled = setting && setting.enabled !== undefined ? setting.enabled : true;
            var autoApply = setting && setting.autoApply !== undefined ? setting.autoApply : (rule.id.startsWith('WH-0')); // defaults per laiha.js
            if (!enabled) return;

            // Count previous occurrences of same violation in 180 days (per المادة 44)
            var d180 = new Date(); d180.setDate(d180.getDate() - 180);
            var prevCount = violationsV2.filter(v =>
              v.empId === emp.id && v.violationId === rule.id &&
              v.status === 'ACTIVE' && new Date(v.createdAt) > d180
            ).length;
            var occurrence = Math.min(prevCount + 1, 4);
            var penaltyKey = ['first','second','third','fourth'][occurrence - 1];
            var penaltyCode = rule.penalties[penaltyKey];
            if (!penaltyCode) return;

            var chapter = rule.id.startsWith('WH') ? 'مواعيد العمل' : rule.id.startsWith('WO') ? 'تنظيم العمل' : 'سلوك العامل';
            var newVio = {
              id: 'VIO' + Date.now() + emp.id,
              empId: emp.id,
              empName: emp.name,
              violationId: rule.id,
              chapter: chapter,
              description: rule.desc + (extraDesc ? ' — ' + extraDesc : ''),
              occurrence: occurrence,
              penaltyCode: penaltyCode,
              penaltyLabel: penaltyLabels[penaltyCode] || penaltyCode,
              source: 'auto',
              legalRef: 'لائحة تنظيم العمل المعتمدة رقم 978004 — الفصل الثامن عشر، جدول المخالفات، البند ' + rule.id,
              createdAt: new Date().toISOString(),
              createdBy: 'system_cron',
              status: autoApply ? 'ACTIVE' : 'PENDING_APPROVAL',
              autoGenerated: true,
            };
            violationsV2.push(newVio);
            generated.push({ empId: emp.id, name: emp.name, rule: rule.id, occurrence: occurrence, penalty: newVio.penaltyLabel, needsApproval: !autoApply });
          }

          // Check absence
          if (!checkin && nowH >= 18) { // 6pm or later
            var absRule = laihaRules.find(r => r.absentDays === 1);
            if (absRule) applyRule(absRule, today);
          }

          // Check late arrival
          if (checkin && branch.start) {
            var checkinTime = new Date(checkin.ts);
            var startParts = branch.start.split(':');
            var startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
            var checkinMin = checkinTime.getHours() * 60 + checkinTime.getMinutes();
            var lateMinutes = checkinMin - startMin;
            if (lateMinutes > 0) {
              var lateRule = laihaRules.find(r => {
                var min = r.minLate !== undefined ? r.minLate : 1;
                var max = r.maxLate !== undefined ? r.maxLate : Infinity;
                return lateMinutes >= min && lateMinutes <= max && !r.absentDays;
              });
              if (lateRule) applyRule(lateRule, 'تأخر ' + lateMinutes + ' دقيقة');
            }
          }
        });

        await dbSet('violations_v2', violationsV2);
        // Auto-notify employees about their violations
        if (generated.length > 0) {
          try {
            var notifs = await dbGet('notifications') || [];
            generated.forEach(function(g) {
              notifs.push({
                id: 'NTF' + Date.now() + g.empId,
                empId: g.empId,
                type: 'violation',
                title: g.needsApproval ? '📋 مخالفة بانتظار الاعتماد' : '⚖️ مخالفة جديدة',
                body: 'البند ' + g.rule + ' — المرة ' + g.occurrence + ' — الجزاء: ' + g.penalty,
                read: false,
                createdAt: new Date().toISOString(),
              });
            });
            await dbSet('notifications', notifs);
          } catch(e) { /**/ }
        }
        return res.json({ ok: true, generated: generated, count: generated.length, ranAt: new Date().toISOString() });
      }

      /* ═══ NOTIFICATIONS (إشعارات الموظفين) ═══ */
      case 'notifications': {
        if (req.method === 'GET') {
          var notifs = await dbGet('notifications') || [];
          if (req.query.empId) notifs = notifs.filter(n => n.empId === req.query.empId);
          if (req.query.unread === '1') notifs = notifs.filter(n => !n.read);
          return res.json(notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50));
        }
        if (req.method === 'POST') {
          var notifs = await dbGet('notifications') || [];
          var newNotif = {
            id: 'NTF' + Date.now(),
            empId: req.body.empId,
            type: req.body.type, // violation | investigation | appeal_result | complaint_update
            title: req.body.title,
            body: req.body.body,
            refId: req.body.refId || null, // ID of related entity
            read: false,
            createdAt: new Date().toISOString(),
          };
          notifs.push(newNotif);
          // Keep only last 200 per employee
          var empNotifs = notifs.filter(n => n.empId === req.body.empId);
          if (empNotifs.length > 200) {
            var keep = new Set(empNotifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 200).map(n => n.id));
            notifs = notifs.filter(n => n.empId !== req.body.empId || keep.has(n.id));
          }
          await dbSet('notifications', notifs);
          return res.json({ ok: true, notification: newNotif });
        }
        if (req.method === 'PUT') {
          // Mark as read
          var notifs = await dbGet('notifications') || [];
          if (req.body.markAllRead && req.body.empId) {
            notifs = notifs.map(n => n.empId === req.body.empId ? { ...n, read: true } : n);
          } else if (req.body.id) {
            var idx = notifs.findIndex(n => n.id === req.body.id);
            if (idx >= 0) notifs[idx].read = true;
          }
          await dbSet('notifications', notifs);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ EXPORT INSURANCE (تصدير بيانات التأمين) ═══ */
      case 'export_insurance': {
        var emps = await dbGet('employees') || [];
        var deps = await dbGet('dependents') || [];
        var hd = await dbGet('health_disclosures') || [];
        var rows = ['رقم الموظف,الاسم,المرافق,القرابة,الميلاد,الهوية,تأمين خارجي,شركة التأمين,إفصاح صحي'];
        emps.forEach(function(emp) {
          // Employee row
          var empHd = hd.find(h => h.empId === emp.id);
          rows.push([emp.id, emp.name, '—', 'موظف', emp.dob || '', emp.idNumber || '', emp.externalInsurance ? 'نعم' : 'لا', emp.insurerName || '', empHd ? 'مقدّم' : 'لم يُقدّم'].join(','));
          // Dependents rows
          var empDeps = deps.filter(d => d.empId === emp.id && d.status === 'approved');
          empDeps.forEach(function(dep) {
            rows.push([emp.id, emp.name, dep.name, dep.relation, dep.dob || '', dep.idNumber || '', dep.externalInsurance ? 'نعم' : 'لا', dep.insurerName || '', '—'].join(','));
          });
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        return res.send('\uFEFF' + rows.join('\n'));
      }

      case 'diagnostic': {
        // Test database read/write
        var results = { token: !!process.env.BLOB_READ_WRITE_TOKEN, tokenPrefix: (process.env.BLOB_READ_WRITE_TOKEN || '').substring(0, 10) + '...', tests: {} };
        try {
          // Test write
          await put(PFX + 'test_diag.json', JSON.stringify({ test: true, ts: new Date().toISOString() }), { access: 'public', contentType: 'application/json' });
          results.tests.write = 'OK';
        } catch(e) { results.tests.write = 'FAIL: ' + e.message; }
        try {
          // Test read
          var { blobs } = await list({ prefix: PFX + 'test_diag.json' });
          results.tests.read = blobs.length > 0 ? 'OK (' + blobs.length + ' blobs)' : 'FAIL: no blobs found';
          // List all basma blobs
          var allBlobs = await list({ prefix: PFX });
          results.tests.totalBlobs = allBlobs.blobs.length;
          results.tests.blobNames = allBlobs.blobs.map(b => b.pathname);
          // Cleanup test
          for (var b of blobs) await del(b.url);
          results.tests.delete = 'OK';
        } catch(e) { results.tests.read = 'FAIL: ' + e.message; }
        // Test existing data
        try {
          var emps = await dbGet('employees');
          results.tests.employees = emps ? (Array.isArray(emps) ? emps.length + ' employees' : typeof emps) : 'NULL';
        } catch(e) { results.tests.employees = 'FAIL: ' + e.message; }
        try {
          var settings = await dbGet('settings');
          results.tests.settings = settings ? 'exists' : 'NULL';
        } catch(e) { results.tests.settings = 'FAIL: ' + e.message; }
        try {
          var reqs = await dbGet('admin_requests');
          results.tests.requests = reqs ? (Array.isArray(reqs) ? reqs.length + ' requests' : typeof reqs) : 'NULL (empty)';
        } catch(e) { results.tests.requests = 'FAIL: ' + e.message; }
        return res.json(results);
      }

      default: return res.status(400).json({ error: 'unknown action' });
    }
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
