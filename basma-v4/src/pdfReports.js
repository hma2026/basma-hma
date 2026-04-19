/* ═══════════════════════════════════════════════════════════════
   PDF Reports Generator — نظام التقارير PDF
   Uses browser print-to-PDF for perfect Arabic support
   ═══════════════════════════════════════════════════════════════ */

const HMA_LOGO = `<svg viewBox="0 0 100 100" style="width:60px;height:60px"><circle cx="50" cy="50" r="48" fill="#1a3a6e"/><text x="50" y="58" font-family="Cairo,sans-serif" font-size="24" font-weight="900" fill="#d4a949" text-anchor="middle">HMA</text></svg>`;

function todayAr() {
  return new Date().toLocaleDateString('ar-SA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDateAr(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA');
}

function formatDateTimeAr(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' });
}

/* ────── Shared CSS for all reports ────── */
const REPORT_CSS = `
  @page { size: A4; margin: 1.5cm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Cairo', 'Tajawal', sans-serif;
    direction: rtl;
    color: #1a1a1a;
    background: #fff;
    padding: 0;
  }
  .pdf-header {
    background: linear-gradient(135deg, #1a3a6e 0%, #2b5ea7 100%);
    color: #fff;
    padding: 20px 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    border-radius: 0;
  }
  .pdf-header-left { display: flex; align-items: center; gap: 14px; }
  .pdf-header h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
  .pdf-header h2 { font-size: 13px; font-weight: 500; opacity: 0.9; }
  .pdf-header .meta { text-align: left; font-size: 10px; line-height: 1.8; }
  .pdf-section { padding: 0 20px; margin-bottom: 20px; }
  .pdf-title { font-size: 16px; font-weight: 800; color: #1a3a6e; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #d4a949; }
  .pdf-subtitle { font-size: 13px; font-weight: 700; color: #333; margin-bottom: 8px; margin-top: 16px; }

  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
  .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
  .stat-box .num { font-size: 22px; font-weight: 900; color: #1a3a6e; }
  .stat-box .label { font-size: 10px; color: #64748b; margin-top: 4px; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px; }
  th { background: #1a3a6e; color: #fff; padding: 10px 8px; font-weight: 700; text-align: right; font-size: 10px; }
  td { padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr:hover td { background: #eff6ff; }

  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700; }
  .badge-success { background: #dcfce7; color: #166534; }
  .badge-warning { background: #fef3c7; color: #92400e; }
  .badge-danger { background: #fee2e2; color: #991b1b; }
  .badge-info { background: #dbeafe; color: #1e40af; }
  .badge-gray { background: #f1f5f9; color: #475569; }

  .pdf-footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    padding: 8px 20px;
    font-size: 9px;
    color: #64748b;
    display: flex;
    justify-content: space-between;
  }
  .no-data { text-align: center; padding: 40px; color: #94a3b8; font-size: 13px; }
  .alert-box { background: #fff7ed; border-right: 4px solid #f59e0b; padding: 12px; margin-bottom: 12px; border-radius: 6px; font-size: 11px; }
  .success-box { background: #f0fdf4; border-right: 4px solid #10b981; padding: 12px; margin-bottom: 12px; border-radius: 6px; font-size: 11px; }
  .print-btn {
    position: fixed; top: 20px; left: 20px;
    padding: 12px 24px; border-radius: 10px;
    background: #1a3a6e; color: #fff;
    font-size: 14px; font-weight: 700;
    border: none; cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 9999;
  }
  @media print {
    .print-btn { display: none; }
  }
`;

function openPdfWindow(title, htmlContent) {
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
  <style>${REPORT_CSS}</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
  ${htmlContent}
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('الرجاء السماح للنوافذ المنبثقة'); return; }
  win.document.write(html);
  win.document.close();

  // Auto-trigger print dialog after fonts load
  setTimeout(function() {
    try { win.focus(); } catch(e) {}
  }, 500);
}

/* ═══ 1. ATTENDANCE REPORT — تقرير الحضور ═══ */
export function generateAttendanceReport(data) {
  const { period, dateFrom, dateTo, attendance, employees, branches } = data;
  const empMap = {};
  (employees || []).forEach(e => empMap[e.id] = e);
  const branchMap = {};
  (branches || []).forEach(b => branchMap[b.id] = b);

  // Group by employee
  const byEmp = {};
  (attendance || []).forEach(a => {
    if (!byEmp[a.empId]) byEmp[a.empId] = [];
    byEmp[a.empId].push(a);
  });

  const totalRecords = (attendance || []).length;
  const uniqueEmps = Object.keys(byEmp).length;
  const checkins = (attendance || []).filter(a => a.type === 'checkin').length;
  const checkouts = (attendance || []).filter(a => a.type === 'checkout').length;

  let html = `
    <div class="pdf-header">
      <div class="pdf-header-left">
        ${HMA_LOGO}
        <div>
          <h1>تقرير الحضور والانصراف</h1>
          <h2>${period || 'الفترة الكاملة'}</h2>
        </div>
      </div>
      <div class="meta">
        <div>📅 ${todayAr()}</div>
        ${dateFrom ? `<div>من: ${formatDateAr(dateFrom)}</div>` : ''}
        ${dateTo ? `<div>إلى: ${formatDateAr(dateTo)}</div>` : ''}
      </div>
    </div>

    <div class="pdf-section">
      <div class="stats-grid">
        <div class="stat-box"><div class="num">${totalRecords}</div><div class="label">إجمالي السجلات</div></div>
        <div class="stat-box"><div class="num">${uniqueEmps}</div><div class="label">موظفين نشطين</div></div>
        <div class="stat-box"><div class="num">${checkins}</div><div class="label">تسجيلات حضور</div></div>
        <div class="stat-box"><div class="num">${checkouts}</div><div class="label">تسجيلات انصراف</div></div>
      </div>

      <div class="pdf-subtitle">تفاصيل الحضور</div>
      ${totalRecords === 0 ? '<div class="no-data">لا توجد سجلات حضور في هذه الفترة</div>' : `
      <table>
        <thead>
          <tr>
            <th>الموظف</th>
            <th>الفرع</th>
            <th>النوع</th>
            <th>التاريخ</th>
            <th>الوقت</th>
          </tr>
        </thead>
        <tbody>
          ${(attendance || []).slice(0, 500).map(a => {
            const emp = empMap[a.empId] || { name: 'غير معروف' };
            const branch = branchMap[emp.branch] || { name: '—' };
            const typeLabels = { checkin: 'حضور', checkout: 'انصراف', break_start: 'استراحة', break_end: 'عودة' };
            const typeBadge = { checkin: 'success', checkout: 'info', break_start: 'warning', break_end: 'gray' };
            return `
              <tr>
                <td><strong>${emp.name}</strong></td>
                <td>${branch.name || '—'}</td>
                <td><span class="badge badge-${typeBadge[a.type] || 'gray'}">${typeLabels[a.type] || a.type}</span></td>
                <td>${formatDateAr(a.ts)}</td>
                <td>${new Date(a.ts).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      ${totalRecords > 500 ? `<div class="alert-box">⚠️ يتم عرض أول 500 سجل فقط. الإجمالي: ${totalRecords}</div>` : ''}
      `}
    </div>

    <div class="pdf-footer">
      <span>مكتب هاني محمد عسيري للاستشارات الهندسية</span>
      <span>تم توليد التقرير في: ${todayAr()}</span>
    </div>
  `;
  openPdfWindow('تقرير الحضور', html);
}

/* ═══ 2. EMPLOYEE REPORT — تقرير الموظف الفردي ═══ */
export function generateEmployeeReport(data) {
  const { employee, attendance, violations, leaves, tickets, branches } = data;
  const branchMap = {};
  (branches || []).forEach(b => branchMap[b.id] = b);
  const branch = branchMap[employee.branch] || {};

  const empAtt = (attendance || []).filter(a => a.empId === employee.id);
  const empViol = (violations || []).filter(v => v.empId === employee.id);
  const empLeaves = (leaves || []).filter(l => l.empId === employee.id);
  const empTickets = (tickets || []).filter(t => t.empId === employee.id);

  const presentDays = new Set(empAtt.filter(a => a.type === 'checkin').map(a => a.ts.split('T')[0])).size;

  let html = `
    <div class="pdf-header">
      <div class="pdf-header-left">
        ${HMA_LOGO}
        <div>
          <h1>ملف الموظف</h1>
          <h2>${employee.name}</h2>
        </div>
      </div>
      <div class="meta">
        <div>📅 ${todayAr()}</div>
        <div>🆔 ${employee.idNumber || employee.id}</div>
      </div>
    </div>

    <div class="pdf-section">
      <div class="pdf-title">📋 المعلومات الأساسية</div>
      <table>
        <tr><th style="width:30%">الاسم الكامل</th><td>${employee.name || '—'}</td></tr>
        <tr><th>المسمى الوظيفي</th><td>${employee.role || '—'}</td></tr>
        <tr><th>الإدارة</th><td>${employee.department || '—'}</td></tr>
        <tr><th>الفرع</th><td>${branch.name || employee.branchName || '—'}</td></tr>
        <tr><th>البريد الإلكتروني</th><td style="direction:ltr;text-align:right">${employee.email || '—'}</td></tr>
        <tr><th>الجوال</th><td style="direction:ltr;text-align:right">${employee.phone || '—'}</td></tr>
        <tr><th>النقاط</th><td><strong style="color:#d4a949">⭐ ${employee.points || 0}</strong></td></tr>
        <tr><th>الحالة</th><td><span class="badge badge-${employee.status === 'active' ? 'success' : 'gray'}">${employee.status === 'active' ? 'نشط' : employee.status || '—'}</span></td></tr>
      </table>

      <div class="stats-grid" style="margin-top:16px">
        <div class="stat-box"><div class="num">${presentDays}</div><div class="label">أيام حضور</div></div>
        <div class="stat-box"><div class="num">${empViol.length}</div><div class="label">مخالفات</div></div>
        <div class="stat-box"><div class="num">${empLeaves.length}</div><div class="label">طلبات إجازة</div></div>
        <div class="stat-box"><div class="num">${empTickets.length}</div><div class="label">تذاكر دعم</div></div>
      </div>

      ${empAtt.length > 0 ? `
      <div class="pdf-subtitle">🕐 آخر سجلات الحضور (آخر 20)</div>
      <table>
        <thead>
          <tr><th>التاريخ</th><th>النوع</th><th>الوقت</th></tr>
        </thead>
        <tbody>
          ${empAtt.slice(0, 20).map(a => {
            const typeLabels = { checkin: 'حضور', checkout: 'انصراف', break_start: 'استراحة', break_end: 'عودة' };
            const typeBadge = { checkin: 'success', checkout: 'info', break_start: 'warning', break_end: 'gray' };
            return `<tr>
              <td>${formatDateAr(a.ts)}</td>
              <td><span class="badge badge-${typeBadge[a.type] || 'gray'}">${typeLabels[a.type] || a.type}</span></td>
              <td>${new Date(a.ts).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>` : ''}

      ${empViol.length > 0 ? `
      <div class="pdf-subtitle">⚠️ المخالفات</div>
      <table>
        <thead>
          <tr><th>التاريخ</th><th>النوع</th><th>التفاصيل</th></tr>
        </thead>
        <tbody>
          ${empViol.slice(0, 20).map(v => `
            <tr>
              <td>${formatDateAr(v.date)}</td>
              <td><span class="badge badge-warning">${v.type || '—'}</span></td>
              <td>${v.details || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>` : ''}

      ${empLeaves.length > 0 ? `
      <div class="pdf-subtitle">🏖️ طلبات الإجازات</div>
      <table>
        <thead>
          <tr><th>من</th><th>إلى</th><th>النوع</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          ${empLeaves.slice(0, 20).map(l => {
            const statusBadge = l.status === 'approved' ? 'success' : l.status === 'rejected' ? 'danger' : 'warning';
            const statusLabel = l.status === 'approved' ? 'موافق' : l.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار';
            return `<tr>
              <td>${formatDateAr(l.fromDate)}</td>
              <td>${formatDateAr(l.toDate)}</td>
              <td>${l.type || '—'}</td>
              <td><span class="badge badge-${statusBadge}">${statusLabel}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>` : ''}
    </div>

    <div class="pdf-footer">
      <span>مكتب هاني محمد عسيري للاستشارات الهندسية</span>
      <span>ملف سري — للاستخدام الداخلي فقط</span>
    </div>
  `;
  openPdfWindow('ملف ' + employee.name, html);
}

/* ═══ 3. MONTHLY SUMMARY — التقرير الشهري ═══ */
export function generateMonthlySummary(data) {
  const { month, year, attendance, employees, violations, leaves } = data;
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });

  // Calculate per employee
  const perEmp = (employees || []).map(emp => {
    const empAtt = (attendance || []).filter(a => a.empId === emp.id);
    const presentDays = new Set(empAtt.filter(a => a.type === 'checkin').map(a => a.ts.split('T')[0])).size;
    const empViol = (violations || []).filter(v => v.empId === emp.id).length;
    const empLeaves = (leaves || []).filter(l => l.empId === emp.id && l.status === 'approved').length;
    const workingDays = 22; // approximate
    const attendanceRate = Math.round((presentDays / workingDays) * 100);
    return { ...emp, presentDays, empViol, empLeaves, attendanceRate };
  }).sort((a, b) => b.attendanceRate - a.attendanceRate);

  const totalEmps = perEmp.length;
  const avgAttendance = Math.round(perEmp.reduce((s, e) => s + e.attendanceRate, 0) / (totalEmps || 1));
  const totalViolations = perEmp.reduce((s, e) => s + e.empViol, 0);
  const excellent = perEmp.filter(e => e.attendanceRate >= 95).length;

  let html = `
    <div class="pdf-header">
      <div class="pdf-header-left">
        ${HMA_LOGO}
        <div>
          <h1>التقرير الشهري</h1>
          <h2>${monthName}</h2>
        </div>
      </div>
      <div class="meta">
        <div>📅 ${todayAr()}</div>
      </div>
    </div>

    <div class="pdf-section">
      <div class="stats-grid">
        <div class="stat-box"><div class="num">${totalEmps}</div><div class="label">إجمالي الموظفين</div></div>
        <div class="stat-box"><div class="num" style="color:#10b981">${avgAttendance}%</div><div class="label">متوسط الحضور</div></div>
        <div class="stat-box"><div class="num" style="color:#d4a949">${excellent}</div><div class="label">حضور ممتاز (95%+)</div></div>
        <div class="stat-box"><div class="num" style="color:#ef4444">${totalViolations}</div><div class="label">إجمالي المخالفات</div></div>
      </div>

      <div class="pdf-title">📊 ترتيب الموظفين حسب الحضور</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الموظف</th>
            <th>الإدارة</th>
            <th>أيام الحضور</th>
            <th>نسبة الحضور</th>
            <th>مخالفات</th>
            <th>إجازات</th>
          </tr>
        </thead>
        <tbody>
          ${perEmp.map((e, i) => {
            const rateColor = e.attendanceRate >= 95 ? 'success' : e.attendanceRate >= 80 ? 'info' : e.attendanceRate >= 60 ? 'warning' : 'danger';
            return `<tr>
              <td>${i + 1}</td>
              <td><strong>${e.name}</strong></td>
              <td>${e.department || '—'}</td>
              <td>${e.presentDays}</td>
              <td><span class="badge badge-${rateColor}">${e.attendanceRate}%</span></td>
              <td>${e.empViol || '—'}</td>
              <td>${e.empLeaves || '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="pdf-footer">
      <span>مكتب هاني محمد عسيري للاستشارات الهندسية</span>
      <span>تقرير شهري — ${monthName}</span>
    </div>
  `;
  openPdfWindow('التقرير الشهري - ' + monthName, html);
}

/* ═══ 4. VIOLATIONS REPORT — تقرير المخالفات ═══ */
export function generateViolationsReport(data) {
  const { violations, employees, dateFrom, dateTo } = data;
  const empMap = {};
  (employees || []).forEach(e => empMap[e.id] = e);

  const filtered = (violations || []).filter(v => {
    if (!v) return false;
    if (dateFrom && v.date < dateFrom) return false;
    if (dateTo && v.date > dateTo) return false;
    return true;
  });

  // Group by type
  const byType = {};
  filtered.forEach(v => {
    const t = v.type || 'أخرى';
    if (!byType[t]) byType[t] = 0;
    byType[t]++;
  });

  let html = `
    <div class="pdf-header">
      <div class="pdf-header-left">
        ${HMA_LOGO}
        <div>
          <h1>تقرير المخالفات</h1>
          <h2>${filtered.length} مخالفة مسجّلة</h2>
        </div>
      </div>
      <div class="meta">
        <div>📅 ${todayAr()}</div>
        ${dateFrom ? `<div>من: ${formatDateAr(dateFrom)}</div>` : ''}
        ${dateTo ? `<div>إلى: ${formatDateAr(dateTo)}</div>` : ''}
      </div>
    </div>

    <div class="pdf-section">
      <div class="pdf-title">📊 توزيع المخالفات حسب النوع</div>
      <div class="stats-grid" style="grid-template-columns:repeat(${Math.min(Object.keys(byType).length || 1, 4)}, 1fr)">
        ${Object.keys(byType).map(t => `
          <div class="stat-box"><div class="num" style="color:#ef4444">${byType[t]}</div><div class="label">${t}</div></div>
        `).join('')}
      </div>

      <div class="pdf-title">📋 قائمة المخالفات</div>
      ${filtered.length === 0 ? '<div class="success-box">✅ لا توجد مخالفات في هذه الفترة</div>' : `
      <table>
        <thead>
          <tr><th>التاريخ</th><th>الموظف</th><th>النوع</th><th>التفاصيل</th></tr>
        </thead>
        <tbody>
          ${filtered.map(v => {
            const emp = empMap[v.empId] || { name: 'غير معروف' };
            return `<tr>
              <td>${formatDateAr(v.date)}</td>
              <td><strong>${emp.name}</strong></td>
              <td><span class="badge badge-warning">${v.type || '—'}</span></td>
              <td>${v.details || '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`}
    </div>

    <div class="pdf-footer">
      <span>مكتب هاني محمد عسيري للاستشارات الهندسية</span>
      <span>تقرير المخالفات</span>
    </div>
  `;
  openPdfWindow('تقرير المخالفات', html);
}

/* ═══ 5. EMPLOYEES LIST — قائمة الموظفين ═══ */
export function generateEmployeesListReport(data) {
  const { employees, branches } = data;
  const branchMap = {};
  (branches || []).forEach(b => branchMap[b.id] = b);

  const byBranch = {};
  (employees || []).forEach(e => {
    const b = e.branch || 'unknown';
    if (!byBranch[b]) byBranch[b] = [];
    byBranch[b].push(e);
  });

  let html = `
    <div class="pdf-header">
      <div class="pdf-header-left">
        ${HMA_LOGO}
        <div>
          <h1>قائمة الموظفين</h1>
          <h2>${(employees || []).length} موظف</h2>
        </div>
      </div>
      <div class="meta">
        <div>📅 ${todayAr()}</div>
      </div>
    </div>

    <div class="pdf-section">
  `;

  Object.keys(byBranch).forEach(bid => {
    const branch = branchMap[bid] || { name: byBranch[bid][0]?.branchName || 'غير محدد' };
    const emps = byBranch[bid];
    html += `
      <div class="pdf-subtitle">🏢 ${branch.name} — ${emps.length} موظف</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الاسم</th>
            <th>الوظيفة</th>
            <th>الإدارة</th>
            <th>الجوال</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${emps.map((e, i) => {
            const statusBadge = e.status === 'active' ? 'success' : 'gray';
            return `<tr>
              <td>${i + 1}</td>
              <td><strong>${e.name}</strong></td>
              <td>${e.role || '—'}</td>
              <td>${e.department || '—'}</td>
              <td style="direction:ltr;text-align:right">${e.phone || '—'}</td>
              <td><span class="badge badge-${statusBadge}">${e.status === 'active' ? 'نشط' : e.status || '—'}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  });

  html += `
    </div>
    <div class="pdf-footer">
      <span>مكتب هاني محمد عسيري للاستشارات الهندسية</span>
      <span>قائمة الموظفين</span>
    </div>
  `;
  openPdfWindow('قائمة الموظفين', html);
}

/* ═══ 6. BENEFITS/COUPONS REPORT — تقرير الكوبونات ═══ */
export function generateBenefitsReport(data) {
  const { coupons, redemptions, employees } = data;
  const empMap = {};
  (employees || []).forEach(e => empMap[e.id] = e);
  const couponMap = {};
  (coupons || []).forEach(c => couponMap[c.id] = c);

  const totalPoints = (redemptions || []).reduce((s, r) => s + (r.pts || 0), 0);

  let html = `
    <div class="pdf-header">
      <div class="pdf-header-left">
        ${HMA_LOGO}
        <div>
          <h1>تقرير الامتيازات</h1>
          <h2>${(coupons || []).length} كوبون • ${(redemptions || []).length} عملية صرف</h2>
        </div>
      </div>
      <div class="meta">
        <div>📅 ${todayAr()}</div>
      </div>
    </div>

    <div class="pdf-section">
      <div class="stats-grid">
        <div class="stat-box"><div class="num">${(coupons || []).length}</div><div class="label">كوبون</div></div>
        <div class="stat-box"><div class="num" style="color:#10b981">${(coupons || []).filter(c => c.active !== false).length}</div><div class="label">مفعّل</div></div>
        <div class="stat-box"><div class="num" style="color:#d4a949">${(redemptions || []).length}</div><div class="label">مرات الصرف</div></div>
        <div class="stat-box"><div class="num" style="color:#8b5cf6">${totalPoints}</div><div class="label">نقاط مصروفة</div></div>
      </div>

      <div class="pdf-subtitle">🎟️ قائمة الكوبونات</div>
      <table>
        <thead>
          <tr>
            <th>الكوبون</th>
            <th>الخصم</th>
            <th>الفئة</th>
            <th>النقاط</th>
            <th>المستوى</th>
            <th>الحالة</th>
            <th>استخدم</th>
          </tr>
        </thead>
        <tbody>
          ${(coupons || []).map(c => {
            const usedCount = (redemptions || []).filter(r => r.couponId === c.id).length;
            const tierName = c.minTier === 2 ? 'نخبة' : c.minTier === 1 ? 'تميّز' : 'فعّال';
            return `<tr>
              <td><strong>${c.icon || '🎁'} ${c.brand}</strong></td>
              <td>${c.discount}</td>
              <td>${c.cat || '—'}</td>
              <td><strong style="color:#d4a949">⭐ ${c.pts}</strong></td>
              <td><span class="badge badge-info">${tierName}</span></td>
              <td><span class="badge badge-${c.active === false ? 'danger' : 'success'}">${c.active === false ? 'معطّل' : 'مفعّل'}</span></td>
              <td>${usedCount}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>

      ${(redemptions || []).length > 0 ? `
      <div class="pdf-subtitle">📊 سجل عمليات الصرف</div>
      <table>
        <thead>
          <tr><th>التاريخ</th><th>الموظف</th><th>الكوبون</th><th>النقاط</th></tr>
        </thead>
        <tbody>
          ${(redemptions || []).slice(0, 100).map(r => {
            const emp = empMap[r.empId] || { name: 'غير معروف' };
            return `<tr>
              <td>${formatDateTimeAr(r.ts)}</td>
              <td><strong>${emp.name}</strong></td>
              <td>${r.couponName || '—'}</td>
              <td><strong style="color:#d4a949">-${r.pts}</strong></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>` : '<div class="alert-box">💡 لم يتم صرف أي كوبون بعد</div>'}
    </div>

    <div class="pdf-footer">
      <span>مكتب هاني محمد عسيري للاستشارات الهندسية</span>
      <span>تقرير الامتيازات</span>
    </div>
  `;
  openPdfWindow('تقرير الامتيازات', html);
}

/* ═══ 7. ANNOUNCEMENTS REPORT — تقرير التعاميم ═══ */
export function generateAnnouncementsReport(data) {
  const { announcements, employees } = data;
  const empMap = {};
  (employees || []).forEach(e => empMap[e.id] = e);
  const totalEmps = (employees || []).length;

  let html = `
    <div class="pdf-header">
      <div class="pdf-header-left">
        ${HMA_LOGO}
        <div>
          <h1>تقرير التعاميم</h1>
          <h2>${(announcements || []).length} تعميم</h2>
        </div>
      </div>
      <div class="meta">
        <div>📅 ${todayAr()}</div>
      </div>
    </div>

    <div class="pdf-section">
      <div class="stats-grid">
        <div class="stat-box"><div class="num">${(announcements || []).length}</div><div class="label">إجمالي</div></div>
        <div class="stat-box"><div class="num" style="color:#10b981">${(announcements || []).filter(a => a.published).length}</div><div class="label">منشورة</div></div>
        <div class="stat-box"><div class="num" style="color:#f59e0b">${(announcements || []).filter(a => !a.published).length}</div><div class="label">مسودات</div></div>
        <div class="stat-box"><div class="num" style="color:#ef4444">${(announcements || []).filter(a => a.priority === 'urgent').length}</div><div class="label">عاجلة</div></div>
      </div>

      <div class="pdf-title">📋 قائمة التعاميم</div>
      ${(announcements || []).map(a => {
        const readCount = (a.readBy || []).length;
        const readPct = totalEmps > 0 ? Math.round((readCount / totalEmps) * 100) : 0;
        const priorityLabel = { urgent: 'عاجل', important: 'مهم', normal: 'عادي' };
        const priorityBadge = { urgent: 'danger', important: 'warning', normal: 'info' };
        return `
          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;border-right:4px solid #8b5cf6">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;margin-bottom:8px">
              <div style="flex:1">
                <div style="font-size:14px;font-weight:800;color:#1a3a6e;margin-bottom:4px">
                  ${a.icon || '📢'} ${a.title}
                  ${a.priority && a.priority !== 'normal' ? `<span class="badge badge-${priorityBadge[a.priority]}" style="margin-right:8px">${priorityLabel[a.priority]}</span>` : ''}
                  ${!a.published ? '<span class="badge badge-gray">مسودة</span>' : ''}
                </div>
                <div style="font-size:10px;color:#64748b">${formatDateTimeAr(a.ts)}</div>
              </div>
              <div style="text-align:center">
                <div style="font-size:18px;font-weight:900;color:#1a3a6e">${readCount}/${totalEmps}</div>
                <div style="font-size:9px;color:#64748b">${readPct}% قراءة</div>
              </div>
            </div>
            <div style="font-size:11px;color:#333;line-height:1.8;padding-top:8px;border-top:1px solid #f1f5f9;white-space:pre-wrap">${a.body}</div>
          </div>
        `;
      }).join('')}
      ${(announcements || []).length === 0 ? '<div class="no-data">لم يتم إنشاء أي تعميم بعد</div>' : ''}
    </div>

    <div class="pdf-footer">
      <span>مكتب هاني محمد عسيري للاستشارات الهندسية</span>
      <span>تقرير التعاميم</span>
    </div>
  `;
  openPdfWindow('تقرير التعاميم', html);
}
