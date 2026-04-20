/* ═══════════════════════════════════════════════════════════════
   FORMAL PDFs — إنذارات، تحقيقات، إفادات رسمية (v6.51)
   Uses browser print-to-PDF with proper Arabic rendering
   ═══════════════════════════════════════════════════════════════ */

const HMA_HEADER_HTML = `
<div class="formal-hdr">
  <img src="/hma-logo.png" alt="HMA" class="formal-logo" />
  <div class="formal-title-ar">مكتب هاني محمد عسيري للاستشارات الهندسية</div>
  <div class="formal-title-en">H. M. Asiri Engineering Consultant</div>
</div>`;

const FORMAL_CSS = `
  @page { size: A4; margin: 1.8cm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Cairo','Tajawal','Segoe UI',Tahoma,sans-serif;
    direction: rtl; color: #1a1a1a; background: #fff;
    line-height: 1.75;
    font-size: 12pt;
  }
  .formal-hdr {
    display: flex; align-items: center; gap: 18px;
    padding-bottom: 16px; border-bottom: 3px solid #c9a84c;
    margin-bottom: 22px;
  }
  .formal-logo { width: 110px; height: auto; flex-shrink: 0; }
  .formal-title-ar { font-size: 16pt; font-weight: 900; color: #1a3a6e; }
  .formal-title-en { font-size: 9pt; color: #666; font-family: 'Segoe UI',sans-serif; direction: ltr; text-align: left; }
  .formal-hdr > div { display: flex; flex-direction: column; gap: 4px; flex: 1; }

  .doc-ref { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 10pt; color: #555; padding: 8px 12px; background: #f8f8f8; border-radius: 6px; border: 1px solid #e5e5e5; }
  .doc-ref strong { color: #1a1a1a; }

  .doc-title { text-align: center; font-size: 20pt; font-weight: 900; color: #1a3a6e; margin: 20px 0 8px; padding: 14px; background: linear-gradient(135deg, #fef9e7 0%, #faf5d8 100%); border: 2px solid #c9a84c; border-radius: 12px; }
  .doc-subtitle { text-align: center; font-size: 11pt; color: #666; margin-bottom: 24px; }

  .emp-box { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; }
  .emp-box h3 { font-size: 12pt; font-weight: 800; color: #1a3a6e; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px dashed #c9a84c; }
  .emp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; font-size: 10.5pt; }
  .emp-grid .label { color: #777; font-weight: 700; }
  .emp-grid .value { color: #1a1a1a; font-weight: 800; }

  .section { margin-bottom: 18px; }
  .section h3 { font-size: 12pt; font-weight: 800; color: #1a3a6e; margin-bottom: 10px; padding-right: 10px; border-right: 4px solid #c9a84c; }

  .warning-box { background: #fef3c7; border-right: 5px solid #f59e0b; padding: 14px 18px; border-radius: 8px; margin: 14px 0; font-size: 11pt; color: #78350f; }
  .danger-box  { background: #fee2e2; border-right: 5px solid #ef4444; padding: 14px 18px; border-radius: 8px; margin: 14px 0; font-size: 11pt; color: #7f1d1d; }
  .info-box    { background: #dbeafe; border-right: 5px solid #3b82f6; padding: 14px 18px; border-radius: 8px; margin: 14px 0; font-size: 11pt; color: #1e3a8a; }

  .statement { padding: 18px 22px; background: #fcfcfc; border: 1px solid #e5e5e5; border-radius: 10px; margin-bottom: 18px; line-height: 2; font-size: 11.5pt; text-align: justify; }

  .qa-block { margin-bottom: 14px; padding: 12px 16px; background: #f8f8f8; border-radius: 8px; border-right: 3px solid #1a3a6e; }
  .qa-q { font-weight: 800; color: #1a3a6e; margin-bottom: 6px; font-size: 11pt; }
  .qa-a { color: #1a1a1a; padding-right: 14px; font-size: 10.5pt; line-height: 1.8; }

  .sig-section { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
  .sig-box { text-align: center; padding-top: 40px; border-top: 2px solid #1a3a6e; }
  .sig-box .title { font-size: 11pt; font-weight: 800; color: #1a3a6e; margin-bottom: 4px; }
  .sig-box .name { font-size: 10pt; color: #555; }
  .sig-box .date { font-size: 9pt; color: #999; margin-top: 6px; }

  .doc-footer { margin-top: 30px; padding-top: 14px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; font-size: 9pt; color: #999; }

  .stamp-placeholder { border: 2px dashed #c9a84c; border-radius: 50%; width: 90px; height: 90px; display: inline-flex; align-items: center; justify-content: center; color: #c9a84c; font-size: 9pt; font-weight: 700; margin-top: 10px; }

  table.penalty-table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10.5pt; }
  table.penalty-table th { background: #1a3a6e; color: #fff; padding: 8px 10px; text-align: right; font-weight: 800; }
  table.penalty-table td { padding: 8px 10px; border: 1px solid #e0e0e0; }
  table.penalty-table .highlight { background: #fef3c7; font-weight: 800; }

  @media print {
    body { padding: 0; }
    .doc-title { page-break-after: avoid; }
    .emp-box, .qa-block { page-break-inside: avoid; }
  }
`;

function fmtDateAr(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch(e) { return String(d); }
}

function openPrintWindow(title, bodyHtml) {
  var html = '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>' + title + '</title><style>' + FORMAL_CSS + '</style></head><body>' +
    HMA_HEADER_HTML + bodyHtml +
    '<script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>' +
    '</body></html>';
  var w = window.open("", "_blank", "width=900,height=700");
  if (w) { w.document.write(html); w.document.close(); }
  else { alert("يرجى السماح بالنوافذ المنبثقة لعرض الملف"); }
}

/* ════════════ 1. إنذار رسمي ════════════ */
export function exportFormalWarning(violation, employee) {
  var v = violation || {};
  var e = employee || {};
  var ref = "V-" + (v.serial || v.id || Date.now());
  var occurrence = v.occurrence || 1;
  var penaltyLabel = v.penaltyLabel || v.penalty || "—";
  var description = v.description || v.violationName || "—";

  var body =
    '<div class="doc-ref">' +
      '<div><strong>رقم المستند:</strong> ' + ref + '</div>' +
      '<div><strong>التاريخ:</strong> ' + fmtDateAr(new Date()) + '</div>' +
    '</div>' +

    '<div class="doc-title">📋 إنذار رسمي</div>' +
    '<div class="doc-subtitle">وفقاً لنظام العمل السعودي ولائحة تنظيم العمل المعتمدة برقم 978004</div>' +

    '<div class="emp-box"><h3>بيانات الموظف</h3>' +
      '<div class="emp-grid">' +
        '<div class="label">الاسم:</div><div class="value">' + (e.name || '—') + '</div>' +
        '<div class="label">الرقم الوظيفي:</div><div class="value">' + (e.id || e.empNo || '—') + '</div>' +
        '<div class="label">المسمى الوظيفي:</div><div class="value">' + (e.role || e.title || '—') + '</div>' +
        '<div class="label">الإدارة:</div><div class="value">' + (e.department || '—') + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="section"><h3>تفاصيل المخالفة</h3>' +
      '<div class="warning-box">' +
        '<strong>البند:</strong> ' + (v.violationId || v.code || '—') + '<br/>' +
        '<strong>الوصف:</strong> ' + description + '<br/>' +
        '<strong>تاريخ وقوع المخالفة:</strong> ' + fmtDateAr(v.occurredAt || v.createdAt) +
      '</div>' +
      '<table class="penalty-table">' +
        '<thead><tr><th>المرة</th><th>الجزاء المقرر</th><th>الحالة</th></tr></thead>' +
        '<tbody>' +
          '<tr' + (occurrence === 1 ? ' class="highlight"' : '') + '><td>الأولى</td><td>إنذار كتابي</td><td>' + (occurrence === 1 ? '✓ الحالية' : '—') + '</td></tr>' +
          '<tr' + (occurrence === 2 ? ' class="highlight"' : '') + '><td>الثانية</td><td>خصم يوم من الراتب</td><td>' + (occurrence === 2 ? '✓ الحالية' : '—') + '</td></tr>' +
          '<tr' + (occurrence === 3 ? ' class="highlight"' : '') + '><td>الثالثة</td><td>خصم يومين من الراتب</td><td>' + (occurrence === 3 ? '✓ الحالية' : '—') + '</td></tr>' +
          '<tr' + (occurrence >= 4 ? ' class="highlight"' : '') + '><td>الرابعة فأكثر</td><td>الفصل من العمل</td><td>' + (occurrence >= 4 ? '✓ الحالية' : '—') + '</td></tr>' +
        '</tbody>' +
      '</table>' +
      '<div class="info-box"><strong>الجزاء المطبّق:</strong> ' + penaltyLabel + '</div>' +
    '</div>' +

    '<div class="section"><h3>نص الإنذار</h3>' +
      '<div class="statement">' +
        'السيد/ة الموظف/ة الكريم/ة،<br/><br/>' +
        'بناءً على ما ورد أعلاه من تفاصيل المخالفة، نوجّه إليك هذا الإنذار الرسمي الكتابي لوقوعك في المخالفة المشار إليها للمرة <strong>' + occurrence + '</strong>. ' +
        'نؤكّد لك ضرورة الالتزام بكافة أنظمة وتعليمات العمل المعتمدة، ونذكّرك بأن تكرار المخالفة سيترتب عليه تطبيق الجزاءات الأشد وفقاً لما ورد في لائحة تنظيم العمل.<br/><br/>' +
        'نأمل منك الحرص على أداء واجباتك الوظيفية بالشكل المطلوب، وتجنب الوقوع في مثل هذه المخالفات مستقبلاً.<br/><br/>' +
        'مع تحيات إدارة الموارد البشرية.' +
      '</div>' +
    '</div>' +

    '<div class="sig-section">' +
      '<div class="sig-box"><div class="title">توقيع الموظف (علماً بالاطلاع)</div><div class="name">' + (e.name || '—') + '</div><div class="date">التاريخ: ............</div></div>' +
      '<div class="sig-box"><div class="title">إدارة الموارد البشرية</div><div class="name">ختم وتوقيع</div><div class="date">التاريخ: ' + fmtDateAr(new Date()) + '</div></div>' +
    '</div>' +

    '<div class="doc-footer">' +
      '<div>مكتب هاني محمد عسيري للاستشارات الهندسية</div>' +
      '<div>مستند مُولَّد من نظام بصمة HMA</div>' +
    '</div>';

  openPrintWindow("إنذار رسمي — " + (e.name || ''), body);
}

/* ════════════ 2. محضر تحقيق ════════════ */
export function exportInvestigationRecord(investigation, employee) {
  var inv = investigation || {};
  var e = employee || {};
  var ref = "INV-" + (inv.serial || inv.id || Date.now());
  var qa = inv.questions || inv.qa || [];

  var qaHtml = '';
  if (Array.isArray(qa) && qa.length > 0) {
    qaHtml = qa.map(function(q, i){
      return '<div class="qa-block">' +
        '<div class="qa-q">سؤال ' + (i + 1) + ': ' + (q.question || q.q || '—') + '</div>' +
        '<div class="qa-a">' + (q.answer || q.a || 'لم يُجب') + '</div>' +
      '</div>';
    }).join('');
  } else {
    qaHtml = '<div class="info-box">لا توجد أسئلة وأجوبة مسجّلة في هذا التحقيق بعد.</div>';
  }

  var body =
    '<div class="doc-ref">' +
      '<div><strong>رقم المحضر:</strong> ' + ref + '</div>' +
      '<div><strong>التاريخ:</strong> ' + fmtDateAr(inv.createdAt || new Date()) + '</div>' +
    '</div>' +

    '<div class="doc-title">🔍 محضر تحقيق</div>' +
    '<div class="doc-subtitle">مستند رسمي وفقاً للإجراءات المعتمدة لدى المكتب</div>' +

    '<div class="emp-box"><h3>بيانات المعني بالتحقيق</h3>' +
      '<div class="emp-grid">' +
        '<div class="label">الاسم:</div><div class="value">' + (e.name || inv.empName || '—') + '</div>' +
        '<div class="label">الرقم الوظيفي:</div><div class="value">' + (e.id || inv.empId || '—') + '</div>' +
        '<div class="label">المسمى الوظيفي:</div><div class="value">' + (e.role || '—') + '</div>' +
        '<div class="label">الإدارة:</div><div class="value">' + (e.department || '—') + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="section"><h3>موضوع التحقيق</h3>' +
      '<div class="statement">' + (inv.subject || inv.description || inv.reason || 'لم يُحدَّد موضوع التحقيق') + '</div>' +
    '</div>' +

    (inv.violationRef ? '<div class="section"><h3>المخالفة المرتبطة</h3><div class="warning-box">رقم المخالفة: ' + inv.violationRef + '</div></div>' : '') +

    '<div class="section"><h3>الأسئلة والإجابات</h3>' + qaHtml + '</div>' +

    (inv.conclusion ? '<div class="section"><h3>الخلاصة والتوصيات</h3><div class="statement">' + inv.conclusion + '</div></div>' : '') +

    '<div class="sig-section">' +
      '<div class="sig-box"><div class="title">توقيع الموظف المعني</div><div class="name">' + (e.name || '—') + '</div><div class="date">التاريخ: ............</div></div>' +
      '<div class="sig-box"><div class="title">توقيع المحقق</div><div class="name">' + (inv.investigator || inv.investigatorName || '—') + '</div><div class="date">التاريخ: ' + fmtDateAr(new Date()) + '</div></div>' +
    '</div>' +

    '<div class="doc-footer">' +
      '<div>مكتب هاني محمد عسيري للاستشارات الهندسية</div>' +
      '<div>محضر تحقيق سري — لا يُفصَح عنه إلا للأطراف المعنية</div>' +
    '</div>';

  openPrintWindow("محضر تحقيق — " + (e.name || ''), body);
}

/* ════════════ 3. إفادة (نموذج عام) ════════════ */
export function exportAffidavit(data, employee) {
  var d = data || {};
  var e = employee || {};
  var ref = "AFF-" + (d.serial || d.id || Date.now());

  var body =
    '<div class="doc-ref">' +
      '<div><strong>رقم المستند:</strong> ' + ref + '</div>' +
      '<div><strong>التاريخ:</strong> ' + fmtDateAr(new Date()) + '</div>' +
    '</div>' +

    '<div class="doc-title">📄 إفادة رسمية</div>' +
    '<div class="doc-subtitle">' + (d.title || 'مستند إداري رسمي') + '</div>' +

    '<div class="emp-box"><h3>بيانات الموظف</h3>' +
      '<div class="emp-grid">' +
        '<div class="label">الاسم:</div><div class="value">' + (e.name || '—') + '</div>' +
        '<div class="label">الرقم الوظيفي:</div><div class="value">' + (e.id || '—') + '</div>' +
        '<div class="label">المسمى:</div><div class="value">' + (e.role || '—') + '</div>' +
        '<div class="label">الإدارة:</div><div class="value">' + (e.department || '—') + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="section"><h3>نص الإفادة</h3>' +
      '<div class="statement">' + (d.body || d.reason || d.content || 'لم يُحدَّد نص الإفادة') + '</div>' +
    '</div>' +

    '<div class="sig-section">' +
      '<div class="sig-box"><div class="title">توقيع الموظف</div><div class="name">' + (e.name || '—') + '</div><div class="date">التاريخ: ' + fmtDateAr(new Date()) + '</div></div>' +
      '<div class="sig-box"><div class="title">اعتماد الإدارة</div><div class="name">ختم وتوقيع</div><div class="date">التاريخ: ............</div></div>' +
    '</div>' +

    '<div class="doc-footer">' +
      '<div>مكتب هاني محمد عسيري للاستشارات الهندسية</div>' +
      '<div>مستند مُولَّد من نظام بصمة HMA</div>' +
    '</div>';

  openPrintWindow("إفادة — " + (e.name || ''), body);
}

/* ════════════ 4. إفادة تعريف بموظف (employment verification) ════════════ */
export function exportEmploymentLetter(employee, options) {
  var e = employee || {};
  var opt = options || {};
  var ref = "EMP-" + (e.id || Date.now());
  var toEntity = opt.toEntity || 'لمن يهمه الأمر';

  var body =
    '<div class="doc-ref">' +
      '<div><strong>رقم المستند:</strong> ' + ref + '</div>' +
      '<div><strong>التاريخ:</strong> ' + fmtDateAr(new Date()) + '</div>' +
    '</div>' +

    '<div class="doc-title">📄 إفادة تعريف بموظف</div>' +
    '<div class="doc-subtitle">' + toEntity + '</div>' +

    '<div class="section"><h3>نص الإفادة</h3>' +
      '<div class="statement">' +
        'تشهد إدارة الموارد البشرية بمكتب هاني محمد عسيري للاستشارات الهندسية بأن:<br/><br/>' +
        '<strong>' + (e.name || '—') + '</strong>' +
        ' يحمل الرقم الوظيفي <strong>' + (e.id || '—') + '</strong>' +
        '، ويعمل لدينا بوظيفة <strong>' + (e.role || '—') + '</strong>' +
        (e.department ? ' بإدارة <strong>' + e.department + '</strong>' : '') +
        (e.joinDate ? '، وذلك منذ تاريخ <strong>' + fmtDateAr(e.joinDate) + '</strong>' : '') +
        '، وهو على رأس العمل حتى تاريخه.<br/><br/>' +
        'وقد أُعطيت له هذه الإفادة بناءً على طلبه دون أدنى مسؤولية على المكتب.<br/><br/>' +
        'تحريراً في: ' + fmtDateAr(new Date()) +
      '</div>' +
    '</div>' +

    '<div class="sig-section">' +
      '<div class="sig-box"><div class="title">ختم وتوقيع المكتب</div><div class="name">إدارة الموارد البشرية</div><div class="date">التاريخ: ' + fmtDateAr(new Date()) + '</div></div>' +
      '<div class="sig-box"><div class="title">المسؤول</div><div class="name">' + (opt.signedBy || 'مدير الموارد البشرية') + '</div><div class="date">ختم رسمي: ............</div></div>' +
    '</div>' +

    '<div class="doc-footer">' +
      '<div>مكتب هاني محمد عسيري للاستشارات الهندسية</div>' +
      '<div>جدة — المملكة العربية السعودية</div>' +
    '</div>';

  openPrintWindow("إفادة تعريف — " + (e.name || ''), body);
}

/* ════════════ 5. إفادة راتب (salary certificate — HR only) ════════════ */
export function exportSalaryLetter(employee, options) {
  var e = employee || {};
  var opt = options || {};
  var ref = "SAL-" + (e.id || Date.now());
  var toEntity = opt.toEntity || 'لمن يهمه الأمر';
  var salary = opt.salary || e.salary || e.basicSalary || '—';
  var allowances = opt.allowances || '—';
  var total = opt.total || e.totalSalary || '—';

  var body =
    '<div class="doc-ref">' +
      '<div><strong>رقم المستند:</strong> ' + ref + '</div>' +
      '<div><strong>التاريخ:</strong> ' + fmtDateAr(new Date()) + '</div>' +
    '</div>' +

    '<div class="doc-title">💵 شهادة راتب</div>' +
    '<div class="doc-subtitle">' + toEntity + '</div>' +

    '<div class="emp-box"><h3>بيانات الموظف</h3>' +
      '<div class="emp-grid">' +
        '<div class="label">الاسم:</div><div class="value">' + (e.name || '—') + '</div>' +
        '<div class="label">الرقم الوظيفي:</div><div class="value">' + (e.id || '—') + '</div>' +
        '<div class="label">المسمى الوظيفي:</div><div class="value">' + (e.role || '—') + '</div>' +
        '<div class="label">تاريخ المباشرة:</div><div class="value">' + fmtDateAr(e.joinDate) + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="section"><h3>تفاصيل الراتب</h3>' +
      '<table class="penalty-table">' +
        '<thead><tr><th>البيان</th><th>المبلغ (ر.س)</th></tr></thead>' +
        '<tbody>' +
          '<tr><td>الراتب الأساسي</td><td>' + salary + '</td></tr>' +
          '<tr><td>البدلات</td><td>' + allowances + '</td></tr>' +
          '<tr class="highlight"><td><strong>الإجمالي</strong></td><td><strong>' + total + '</strong></td></tr>' +
        '</tbody>' +
      '</table>' +
    '</div>' +

    '<div class="section"><h3>نص الشهادة</h3>' +
      '<div class="statement">' +
        'تشهد إدارة الموارد البشرية بمكتب هاني محمد عسيري للاستشارات الهندسية بأن الموظف المذكور أعلاه يعمل لدينا ويتقاضى الراتب المبيّن في الجدول.<br/><br/>' +
        'وقد أُعطيت له هذه الشهادة بناءً على طلبه لاستخدامها في الأغراض النظامية، دون أدنى مسؤولية على المكتب.<br/><br/>' +
        'تحريراً في: ' + fmtDateAr(new Date()) +
      '</div>' +
    '</div>' +

    '<div class="sig-section">' +
      '<div class="sig-box"><div class="title">ختم وتوقيع المكتب</div><div class="name">إدارة الموارد البشرية</div><div class="date">التاريخ: ' + fmtDateAr(new Date()) + '</div></div>' +
      '<div class="sig-box"><div class="title">المدير المالي</div><div class="name">' + (opt.signedBy || '—') + '</div><div class="date">ختم رسمي: ............</div></div>' +
    '</div>' +

    '<div class="doc-footer">' +
      '<div>مكتب هاني محمد عسيري للاستشارات الهندسية</div>' +
      '<div>شهادة سرية — للمستفيد فقط</div>' +
    '</div>';

  openPrintWindow("شهادة راتب — " + (e.name || ''), body);
}

/* ════════════ 6. إفادة إجازة (leave confirmation) ════════════ */
export function exportLeaveLetter(employee, leave, options) {
  var e = employee || {};
  var l = leave || {};
  var opt = options || {};
  var ref = "LV-" + (l.id || Date.now());
  var toEntity = opt.toEntity || 'لمن يهمه الأمر';

  var leaveTypes = { annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة', personal: 'شخصية' };
  var typeLabel = leaveTypes[l.type] || l.type || '—';

  var body =
    '<div class="doc-ref">' +
      '<div><strong>رقم المستند:</strong> ' + ref + '</div>' +
      '<div><strong>التاريخ:</strong> ' + fmtDateAr(new Date()) + '</div>' +
    '</div>' +

    '<div class="doc-title">✈️ إفادة إجازة</div>' +
    '<div class="doc-subtitle">' + toEntity + '</div>' +

    '<div class="emp-box"><h3>بيانات الموظف</h3>' +
      '<div class="emp-grid">' +
        '<div class="label">الاسم:</div><div class="value">' + (e.name || '—') + '</div>' +
        '<div class="label">الرقم الوظيفي:</div><div class="value">' + (e.id || '—') + '</div>' +
        '<div class="label">المسمى الوظيفي:</div><div class="value">' + (e.role || '—') + '</div>' +
        '<div class="label">الإدارة:</div><div class="value">' + (e.department || '—') + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="section"><h3>تفاصيل الإجازة</h3>' +
      '<div class="info-box">' +
        '<strong>نوع الإجازة:</strong> ' + typeLabel + '<br/>' +
        '<strong>من تاريخ:</strong> ' + fmtDateAr(l.from) + '<br/>' +
        '<strong>إلى تاريخ:</strong> ' + fmtDateAr(l.to) + '<br/>' +
        '<strong>عدد الأيام:</strong> ' + (l.days || 1) + ' يوم' +
        (l.reason ? '<br/><strong>السبب:</strong> ' + l.reason : '') +
      '</div>' +
    '</div>' +

    '<div class="section"><h3>نص الإفادة</h3>' +
      '<div class="statement">' +
        'تشهد إدارة الموارد البشرية بمكتب هاني محمد عسيري للاستشارات الهندسية بأن الموظف المذكور أعلاه حاصل على إجازة ' + typeLabel +
        ' اعتباراً من <strong>' + fmtDateAr(l.from) + '</strong>' +
        ' وحتى <strong>' + fmtDateAr(l.to) + '</strong>' +
        '، بمجموع <strong>' + (l.days || 1) + '</strong> يوم.<br/><br/>' +
        'وقد أُعطيت له هذه الإفادة بناءً على طلبه لاستخدامها عند الحاجة.<br/><br/>' +
        'تحريراً في: ' + fmtDateAr(new Date()) +
      '</div>' +
    '</div>' +

    '<div class="sig-section">' +
      '<div class="sig-box"><div class="title">ختم وتوقيع المكتب</div><div class="name">إدارة الموارد البشرية</div><div class="date">التاريخ: ' + fmtDateAr(new Date()) + '</div></div>' +
      '<div class="sig-box"><div class="title">المسؤول المباشر</div><div class="name">' + (opt.signedBy || 'مدير الإدارة') + '</div><div class="date">التاريخ: ............</div></div>' +
    '</div>' +

    '<div class="doc-footer">' +
      '<div>مكتب هاني محمد عسيري للاستشارات الهندسية</div>' +
      '<div>إفادة رسمية مُعتمدة</div>' +
    '</div>';

  openPrintWindow("إفادة إجازة — " + (e.name || ''), body);
}
