import { put, list, del } from '@vercel/blob';

const PFX = 'basma_';

async function dbGet(t) {
  try {
    const { blobs } = await list({ prefix: PFX + t + '.json' });
    if (!blobs.length) return null;
    const r = await fetch(blobs[0].url);
    return await r.json();
  } catch { return null; }
}

async function dbSet(t, d) {
  try {
    const { blobs } = await list({ prefix: PFX + t + '.json' });
    for (const b of blobs) await del(b.url);
    await put(PFX + t + '.json', JSON.stringify(d), { access: 'public', contentType: 'application/json' });
    return true;
  } catch { return false; }
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
          if (!faceId) return res.status(400).json({ error: 'empId required' });
          const faces = await dbGet('faces') || {};
          if (faces[faceId]) return res.json({ ok: true, descriptor: faces[faceId] });
          return res.json({ ok: false });
        }
        if (req.method === 'POST') {
          const { empId, descriptor } = req.body || {};
          if (!empId || !descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) return res.status(400).json({ error: 'empId + descriptor[128] required' });
          const faces = await dbGet('faces') || {};
          faces[empId] = descriptor;
          await dbSet('faces', faces);
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          const faceId = req.query.empId;
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
          reqs.push({ id: 'REQ' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() });
          await dbSet('admin_requests', reqs);
          return res.json({ ok: true });
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
        if (req.method === 'POST') { const es = await dbGet('events') || []; es.push({ id: 'EV' + Date.now(), ...req.body }); await dbSet('events', es); return res.json({ ok: true }); }
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

      default: return res.status(400).json({ error: 'unknown action' });
    }
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
