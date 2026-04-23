/* v7.77 — i18n (Internationalization)
 *
 * نظام الترجمة البسيط:
 * - العربية هي اللغة الافتراضية
 * - الإنجليزية تُضاف عبر overrides
 * - إذا النص غير مترجم، يبقى بالعربية (لا يكسر الـ UI)
 *
 * Usage:
 *   import { t, setLang, getLang, getDir } from "./i18n";
 *   <div>{t("الحضور")}</div>  → يصبح "Attendance" إذا اللغة EN
 */

// ═════════════════════════════════════════════
// جدول الترجمة: مفتاح عربي → نص إنجليزي
// ═════════════════════════════════════════════
// الاستراتيجية: نستخدم النص العربي نفسه كـ key لتسهيل الترجمة
// حتى لو نص عربي لم يُترجم بعد، الكود لا ينكسر
var EN_TRANSLATIONS = {
  // ────── أزرار وعناصر مشتركة ──────
  "الحضور والانصراف": "Attendance",
  "الرئيسية": "Home",
  "حسابي": "My Account",
  "ملفي": "My Profile",
  "إنجازاتي": "Achievements",
  "فريقي": "My Team",
  "تواصل": "Tasks",
  "المعاملات الإدارية": "Admin Requests",
  "إجازات": "Leaves",
  "المزيد": "More",
  "الإعدادات": "Settings",
  "الامتيازات": "Benefits",
  "تقريري": "My Report",
  "الأداء": "Performance",
  "السجل القانوني": "Legal Record",
  "تسجيل الخروج": "Logout",
  "إلغاء": "Cancel",
  "حفظ": "Save",
  "تأكيد": "Confirm",
  "موافق": "OK",
  "رجوع": "Back",
  "التالي": "Next",
  "السابق": "Previous",
  "إغلاق": "Close",
  "تحديث": "Refresh",
  "بحث": "Search",
  "حذف": "Delete",
  "تعديل": "Edit",
  "إضافة": "Add",
  "عرض": "View",
  "تفاصيل": "Details",
  "نعم": "Yes",
  "لا": "No",
  "جاري التحميل...": "Loading...",
  "جارٍ الإرسال...": "Sending...",
  "اليوم": "Today",
  "أمس": "Yesterday",
  "هذا الأسبوع": "This Week",
  "هذا الشهر": "This Month",

  // ────── Home / الحضور ──────
  "سجّل حضورك": "Check In",
  "تسجيل حضور": "Check In",
  "تسجيل الحضور": "Check-in Registration",
  "تسجيل انصراف": "Check Out",
  "تسجيل الانصراف": "Check-out Registration",
  "بداية الاستراحة": "Start Break",
  "العودة من الاستراحة": "End Break",
  "اكتمل الدوام": "Work Day Complete",
  "✓ اكتمل الدوام": "✓ Work Day Complete",
  "☀️ سجّل حضورك": "☀️ Check In",
  "⏰ سجّل حضورك (متأخر)": "⏰ Check In (Late)",
  "☕ بداية الاستراحة": "☕ Start Break",
  "🔄 عودة من الاستراحة": "🔄 End Break",
  "🌙 تسجيل انصراف": "🌙 Check Out",
  "الدوام الآن": "Currently Working",
  "خارج الدوام": "Outside Hours",
  "يوم إجازة": "Day Off",
  "استراحة": "Break",
  "عودة": "Return",
  "انصراف": "Check-out",
  "حاضر": "Present",
  "متأخر": "Late",
  "غائب": "Absent",
  "أنت على بعد": "You are",
  "من موقع الدوام": "from work location",
  "متر": "m",
  "قبل الدوام": "before shift",
  "بعد الدوام": "after shift",
  "في النطاق — المركز الرئيسي بجدة": "In zone — Main Office (Jeddah)",
  "خارج النطاق — المركز الرئيسي بجدة": "Out of zone — Main Office (Jeddah)",
  "في النطاق — ": "In zone — ",
  "خارج النطاق — مواقع الإشراف والمركز الرئيسي": "Out of zone — Supervision sites & Main Office",
  "تحديد الموقع...": "Locating...",
  "جارٍ التسجيل...": "Registering...",

  // ────── Morning Challenge ──────
  "تحدي الصباح": "Morning Challenge",
  "حان وقت تحدي الصباح! ⚡": "Morning Challenge Time! ⚡",
  "إجابة صحيحة": "Correct!",
  "إجابة خاطئة": "Incorrect",
  "✓ أجبت على تحدي اليوم": "✓ Today's challenge answered",
  "نقطة عند الإجابة الصحيحة · يبقى السؤال حتى تجيب أو تغلق": "points for correct answer · question stays until you answer or close",

  // ────── Home buttons ──────
  "إجازة": "Leave",
  "إذن": "Permission",
  "إفادة": "Absence Notice",
  "ساعات إضافية": "Overtime",
  "مشروع": "Project",
  "أهلاً، ": "Welcome, ",
  "يوم إجازة — استمتع بوقتك 🏖️": "Day off — enjoy! 🏖️",

  // ────── Weekdays ──────
  "أحد": "Sun",
  "اثن": "Mon",
  "ثلا": "Tue",
  "أرب": "Wed",
  "خمي": "Thu",
  "جمع": "Fri",
  "سبت": "Sat",
  "الأحد": "Sunday",
  "الاثنين": "Monday",
  "الثلاثاء": "Tuesday",
  "الأربعاء": "Wednesday",
  "الخميس": "Thursday",
  "الجمعة": "Friday",
  "السبت": "Saturday",

  // ────── Stats / tabs ──────
  "ملخص اليوم": "Today's Summary",
  "إحصائيات الشهر": "Monthly Stats",
  "التقويم": "Calendar",
  "آخر البصمات": "Recent Check-ins",
  "لا توجد بصمات بعد": "No check-ins yet",
  "أيام إجازة": "Leave Days",
  "تصدير التقرير": "Export Report",
  "المرجعيات الإدارية": "Management Hierarchy",
  "⭐ تقييماتي": "⭐ My Evaluations",

  // (قسم Profile المكرر حُذف — الترجمات موحّدة في قسم "Profile sections" أدناه)

  // ────── Attendance stats / إحصائيات ──────
  "نسبة الحضور": "Attendance Rate",
  "أيام الحضور": "Days Present",
  "أيام الغياب": "Days Absent",
  "أيام التأخر": "Late Days",
  "ساعات العمل": "Work Hours",
  "نقاطي": "My Points",
  "السلسلة": "Streak",
  "يوم": "day",
  "أيام": "days",
  "ساعة": "hour",
  "ساعات": "hours",
  "دقيقة": "minute",
  "دقائق": "minutes",

  // (تم نقل Leave translations إلى قسم HR Requests أدناه لتجنب التكرار)

  "قريباً": "Soon",
  "قالب": "Template",
  "قيد التطوير — سيتوفر قريباً": "In development — coming soon",
  "✕ إغلاق": "✕ Close",
  "✏️ تعديل البيانات": "✏️ Update Data",
  "📄 طلب شهادة راتب": "📄 Salary Certificate Request",
  "طلب ": "Request ",
  "تحديث الهاتف/العنوان/...": "Update phone/address/...",
  "للبنوك والتأشيرات": "For banks and visas",
  "لأغراض التوظيف والهجرة": "For employment and immigration",
  "تعريف بجهة العمل": "Employer verification",
  "طلب ترقية وظيفية": "Career promotion request",
  "طلب سلفة مقدمة من الراتب": "Salary advance request",
  "نقل لفرع آخر": "Transfer to another branch",
  "تعديل وقت البداية/النهاية": "Adjust start/end time",
  "استفسار أو تعديل أو إضافة تابع": "Inquiry, modify, or add dependent",
  "طلب مخصص لم يرد أعلاه": "Custom request not listed above",

  // ────── Transfer Form extras ──────
  "فرعك الحالي": "Your Current Branch",
  "الفرع المطلوب الانتقال إليه": "Target Branch",
  "مثلاً: فرع مدينة معيّنة...": "E.g., specific city branch...",
  "التاريخ المُفضَّل للنقل (اختياري)": "Preferred Transfer Date (optional)",
  "سبب طلب التحويل": "Transfer Reason",
  "اذكر السبب بوضوح — ظروف عائلية، قرب السكن، فرصة مهنية...": "Explain clearly — family circumstances, proximity, career opportunity...",
  "قرار التحويل يخضع لحاجة العمل ومتطلبات كل فرع — قد يتطلب موافقة الإدارة العليا.": "Transfer decision depends on work needs and branch requirements — may require senior management approval.",
  "❓ فرع آخر (اكتبه)": "❓ Another branch (write it)",

  // ────── Leaves / إجازات ──────
  "طلب إجازة جديد": "New Leave Request",

  // ────── Profile sections ──────
  "البيانات الأساسية": "Basic Info",
  "الفرع · الدوام · المسمى · الالتحاق": "Branch · Shift · Title · Join Date",
  "البيانات الوظيفية": "Job Details",
  "شخصية · وظيفية · مالية · عقد · مرافقين · المسؤولون · الهيئة": "Personal · Job · Financial · Contract · Dependents · Managers · SCE",
  "الهيئة السعودية للمهندسين": "Saudi Council of Engineers",
  "رقم العضوية": "Membership ID",
  "ساري": "Active",
  "منتهي": "Expired",
  "انتهاء: ": "Expires: ",
  "المظهر · التذكيرات · بصمة الوجه · ربط الديسكتوب": "Theme · Reminders · Face ID · Desktop Pairing",
  "الفرع": "Branch",
  "نوع الدوام": "Shift Type",
  "الالتحاق": "Join Date",

  // Accordion titles
  "إجازاتي": "My Leaves",
  "الطلبات · التسليم · الرصيد": "Requests · Handover · Balance",
  "عقودي": "My Contracts",
  "العقود والتجديدات": "Contracts & Renewals",
  "الترقيات": "Promotions",
  "سجل الترقيات والتدرج الوظيفي": "Promotion History",
  "الإشعارات": "Notifications",
  "التحديثات والتنبيهات الإدارية": "Updates & Admin Alerts",
  "مهام مُسنَدة لي من موظف لغرض إجازة": "Tasks Assigned to Me for Leave Handover",
  "تسلّم مهام الزملاء الذاهبين في إجازة": "Receive tasks from colleagues going on leave",
  "طلباتي للموارد البشرية": "My HR Requests",
  "قوالب جاهزة · تعديل بيانات · دعم فني": "Templates · Data Updates · Support",
  "تفاصيل العُهَد": "Custody Details",
  "كل العُهَد والفواتير والاستلام": "All custody, invoices & receipts",
  "عرض تفاصيل كشف آخر راتب": "View Latest Payslip Details",

  // MyProfileCard section titles
  "الشخصية": "Personal",
  "الوظيفية": "Job",
  "المالية والحساب البنكي": "Financial & Bank Account",
  "البيانات الشخصية": "Personal Info",
  "المالية": "Financial",
  "العقد": "Contract",
  "المرفقات": "Attachments",
  "المرافقين": "Dependents",
  "الطبي": "Medical",
  "الاسم": "Name",
  "الرقم الوظيفي": "Employee ID",
  "رقم الهوية": "ID Number",
  "رقم الجوال": "Phone",
  "البريد الإلكتروني": "Email",
  "المسمى الوظيفي": "Job Title",
  "القسم": "Department",
  "تاريخ المباشرة": "Join Date",
  "الراتب الأساسي": "Basic Salary",
  "البدلات": "Allowances",
  "الإجمالي": "Total",
  "البيانات الوظيفية تُدار من كوادر — للتعديل تواصل مع HR": "Job info is managed from Kadwar — contact HR for edits",
  "الاسم الكامل": "Full Name",
  "الاسم بالإنجليزية": "Name in English",
  "الجنس": "Gender",
  "الجنسية": "Nationality",
  "الحالة الاجتماعية": "Marital Status",
  "تاريخ الميلاد": "Date of Birth",
  "مكان الميلاد": "Place of Birth",
  "تاريخ انتهاء الهوية": "ID Expiry Date",
  "العنوان": "Address",
  "المدينة": "City",
  "الدولة": "Country",
  "جوال احتياطي": "Backup Phone",
  "جهة اتصال للطوارئ": "Emergency Contact",
  "ذكر": "Male",
  "أنثى": "Female",
  "أعزب": "Single",
  "متزوج": "Married",
  "مطلق": "Divorced",
  "أرمل": "Widowed",
  "الوصف الوظيفي": "Job Description",
  "تاريخ التعيين": "Hire Date",
  "ساعات العمل (يومياً)": "Work Hours (daily)",
  "أيام العمل (أسبوعياً)": "Work Days (weekly)",
  "أيام الإجازة السنوية": "Annual Leave Days",
  "المدير المباشر": "Direct Manager",
  "المدير الثاني (فني)": "Second Manager (Technical)",
  "المشرف المباشر": "Direct Supervisor",
  "غير مكتمل": "Incomplete",
  "جيد": "Good",
  "حرج": "Critical",
  "حجم الملف كبير (الحد الأقصى 3 MB)": "File too large (max 3 MB)",
  "اختر ملفاً أولاً": "Select a file first",
  "فشل الرفع": "Upload failed",
  "✓ تم إرسال طلبك للموارد البشرية — ستصلك رسالة عند الاعتماد": "✓ Your request was sent to HR — you'll receive a message upon approval",

  // ────── Leaves (previous) ──────
  "سنوية": "Annual",
  "مرضية": "Sick",
  "طارئة": "Emergency",
  "شخصية": "Personal",
  "أمومة": "Maternity",
  "وفاة": "Bereavement",
  "حج": "Hajj",
  "بدون راتب": "Unpaid",
  "السبب (اختياري)": "Reason (optional)",
  "اكتب سبب الإجازة...": "Write leave reason...",
  "كيفية التواصل خلال الإجازة": "Contact during leave",
  "جوال احتياطي، إيميل، أو لا يمكن التواصل...": "Backup phone, email, or unreachable...",
  "بعد الإرسال:": "After submission:",
  "المدير المباشر يراجع الطلب": "Direct manager reviews the request",
  "إن وافق مبدئياً، ستفتح لك شاشة تسليم المهام": "If preliminarily approved, handover screen will open",
  "المفوَّضون يوافقون على استلام بنودك": "Delegates approve receiving your tasks",
  "المراجعة النهائية من المدير + HR": "Final review by manager + HR",
  "📤 إرسال الطلب": "📤 Submit Request",
  "حدد تاريخ البداية والنهاية": "Specify start and end date",
  "تاريخ النهاية قبل البداية": "End date is before start date",
  "✓ تم إرسال طلبك للمدير": "✓ Your request was sent to the manager",
  "فشل الإرسال": "Submission failed",
  "فشل: ": "Failed: ",

  // ────── Permission / استئذان ──────
  "طلب إذن": "Permission Request",
  "انصراف مبكر": "Early Leave",
  "حضور متأخر": "Late Arrival",
  "إذن شخصي": "Personal Permission",
  "مراجعة طبية": "Medical Appointment",
  "وقت الانصراف المطلوب": "Desired Leave Time",
  "وقت الحضور المتوقع": "Expected Arrival Time",
  "مدة الإذن (بالدقائق)": "Permission Duration (minutes)",
  "سبب الإذن...": "Permission reason...",
  "سيُرسل الطلب للمدير المباشر للموافقة — يُحسم من رصيد الإجازات إن تجاوز ساعتين": "Will be sent to direct manager — deducted from leave balance if over 2 hours",
  "إرسال الطلب": "Submit Request",

  // ────── Pre-Absence / إفادة غياب ──────
  "إفادة مسبقة بالغياب": "Advance Absence Notice",
  "الموظف لن يحضر غداً: ": "Employee won't attend tomorrow: ",
  "اختر الموظف": "Select Employee",
  "— اختر —": "— Select —",
  "سبب الغياب...": "Absence reason...",
  "احتساب من الإجازة السنوية": "Deduct from annual leave",
  "حسب لائحة العمل: طلب الإجازة يجب أن يكون قبل الغياب وليس بعده": "Per labor regulations: leave request must be before absence, not after",
  "تأكيد الإفادة": "Confirm Notice",

  // ────── HR Requests / طلبات الموارد البشرية ──────
  "قوالب طلبات الموارد البشرية": "HR Request Templates",
  "اختر نوع الطلب — سيُرسل للموارد البشرية للمراجعة والاعتماد": "Choose request type — it will be sent to HR for review and approval",
  "تعديل بياناتي": "Update My Info",
  "شهادة راتب": "Salary Certificate",
  "شهادة خبرة": "Experience Letter",
  "خطاب تعريف": "Introduction Letter",
  "طلب ترقية": "Promotion Request",
  "سلفة على الراتب": "Salary Advance",
  "تحويل فرع": "Branch Transfer",
  "تعديل ساعات الدوام": "Work Hours Adjustment",
  "تأمين طبي": "Medical Insurance",
  "طلب آخر": "Other Request",
  "الغرض من الطلب": "Purpose",
  "— اختر الغرض —": "— Select Purpose —",
  "اكتب الغرض": "Write Purpose",
  "لغة الوثيقة": "Document Language",
  "اللغة": "Language",
  "عدد النسخ": "Number of Copies",
  "ملاحظات إضافية (اختياري)": "Additional Notes (optional)",
  "أي تفاصيل تريد إبلاغها للموارد البشرية...": "Any details you want to share with HR...",
  "إرسال الطلب للموارد البشرية": "Submit to HR",
  "📤 إرسال الطلب للموارد البشرية": "📤 Submit to HR",
  "📤 إرسال طلب السلفة": "📤 Submit Advance Request",
  "طلباتي السابقة": "My Previous Requests",
  "طلب": "request",
  "إظهار المزيد": "Show More",
  "جاهز للتحميل": "Ready to Download",
  "تحميل الوثيقة / طباعة": "Download / Print",
  "📄 تحميل الوثيقة / طباعة": "📄 Download / Print",
  "📄 تحميل الشهادة / طباعة": "📄 Download Certificate / Print",
  "مُسلَّم": "Delivered",
  "مُوافق عليه": "Approved",
  "سبب الرفض": "Rejection Reason",
  "⏳ قيد المراجعة": "⏳ Under Review",
  "✓ مُوافق عليه": "✓ Approved",
  "📄 جاهز للتحميل": "📄 Ready to Download",
  "✅ مُسلَّم": "✅ Delivered",
  "✕ مرفوض": "✕ Rejected",
  "✓ تم إرسال طلبك للموارد البشرية — ستصلك إشعار عند الموافقة": "✓ Your request was sent to HR — you'll be notified upon approval",
  "✓ تم إرسال طلبك — سيتواصل معك قسم التأمين الطبي": "✓ Your request was sent — Medical Insurance team will contact you",
  "✓ تم إرسال طلبك — سيراجعه المختص في الموارد البشرية": "✓ Your request was sent — HR specialist will review it",
  "✓ تم إرسال طلب الترقية — سيُراجعه المدير والموارد البشرية": "✓ Promotion request sent — manager and HR will review it",
  "فشل إرسال الطلب": "Failed to send request",
  "فشل الاتصال: ": "Connection failed: ",
  "اختر الغرض من الطلب": "Select the purpose of the request",

  // Salary certificate purposes
  "🏦 للبنك (قرض/تمويل)": "🏦 For Bank (loan/financing)",
  "🛂 للتأشيرة/السفارة": "🛂 For Visa/Embassy",
  "🏠 للعقار/الإيجار": "🏠 For Real Estate/Rent",
  "🏛️ لجهة حكومية": "🏛️ For Government Entity",
  "❓ غرض آخر (اكتبه)": "❓ Other purpose (write it)",
  "مثلاً: لجهة معيّنة...": "E.g., for a specific entity...",

  // Experience purposes
  "💼 للتقديم على وظيفة": "💼 For Job Application",
  "🛂 للتأشيرة/الهجرة": "🛂 For Visa/Immigration",
  "🎓 للمنح الدراسية": "🎓 For Scholarships",
  "🏛️ للهيئة السعودية للمهندسين": "🏛️ For Saudi Council of Engineers",

  // Intro letter purposes
  "🏦 لفتح حساب بنكي": "🏦 For Bank Account Opening",
  "📱 للاتصالات (شريحة/اشتراك)": "📱 For Telecom (SIM/Subscription)",

  // Language options
  "🇸🇦 عربي": "🇸🇦 Arabic",
  "🇬🇧 إنجليزي": "🇬🇧 English",
  "🌐 كلاهما": "🌐 Both",
  "عربي": "Arabic",
  "إنجليزي": "English",
  "كلاهما": "Both",
  "العربية": "Arabic",
  "الإنجليزية": "English",
  "English": "English",

  // ────── Transfer / تحويل فرع ──────
  "الفرع الحالي": "Current Branch",
  "الفرع المطلوب": "Target Branch",
  "التاريخ المفضّل للتحويل": "Preferred Transfer Date",
  "سبب الطلب": "Request Reason",
  "اكتب سبب الطلب بوضوح (10 أحرف على الأقل)": "Write the reason clearly (at least 10 chars)",
  "اختر الفرع المطلوب الانتقال إليه": "Select the branch you want to transfer to",
  "جارٍ تحميل الفروع...": "Loading branches...",
  "— اختر الفرع —": "— Select Branch —",
  "فرع آخر (اكتبه)": "Another branch (write it)",
  "اسم الفرع المطلوب": "Target branch name",
  "اكتب اسم الفرع المطلوب": "Write target branch name",

  // ────── Hours Adjustment / تعديل الساعات ──────
  "الدوام الحالي": "Current Hours",
  "الدوام المطلوب": "Requested Hours",
  "من الساعة": "From",
  "إلى الساعة": "To",
  "تاريخ بدء التعديل": "Effective Date",
  "المدة المطلوبة": "Duration",
  "مؤقت (فترة محددة)": "Temporary (specific period)",
  "دائم": "Permanent",
  "اشرح سبب الحاجة لتعديل الساعات": "Explain the reason for adjusting hours",
  "اكتب المدة المطلوبة": "Write the duration",

  // ────── Advance / سلفة ──────
  "مبلغ السلفة (بالريال)": "Advance Amount (SAR)",
  "عدد أشهر السداد": "Repayment Months",
  "مستوى الأولوية": "Priority Level",
  "سبب الحاجة للسلفة": "Reason for Advance",
  "اشرح الغرض من السلفة بوضوح (مثل: نفقات طبية، ديون طارئة، ...)": "Explain the purpose clearly (e.g., medical expenses, urgent debts...)",
  "أدخل مبلغ السلفة": "Enter advance amount",
  "الحد الأقصى للسلفة: ": "Maximum advance: ",
  "ريال (راتب 3 أشهر)": "SAR (3 months salary)",
  "عدد الأشهر بين 1 و 12": "Months must be between 1 and 12",
  "اكتب سبب الحاجة بوضوح (10 أحرف على الأقل)": "Write the reason clearly (at least 10 chars)",
  "عادي": "Normal",
  "عاجل": "Urgent",
  "طارئ جداً": "Critical",
  "💡 راتبك الأساسي: ": "💡 Your basic salary: ",
  "راتب 3 أشهر": "3 months salary",
  "🧾 سيُخصم ": "🧾 Will deduct ",
  "من راتبك شهرياً لمدة ": " from your salary monthly for ",
  "شهر": "month",
  "ريال": "SAR",

  // ────── Promotion / ترقية ──────
  "المسمى الحالي": "Current Title",
  "المسمى المطلوب": "Desired Title",
  "سنوات الخدمة": "Years of Service",
  "أبرز الإنجازات": "Key Achievements",
  "مبرر طلب الترقية": "Promotion Justification",
  "اكتب المسمى الوظيفي المطلوب": "Write the desired job title",
  "اكتب إنجازاتك بوضوح (20 حرف على الأقل)": "Write your achievements clearly (at least 20 chars)",
  "اكتب مبرر طلب الترقية (20 حرف على الأقل)": "Write justification (at least 20 chars)",
  "اذكر أبرز إنجازاتك في الشركة...": "Mention your key achievements at the company...",
  "لماذا تستحق هذه الترقية؟": "Why do you deserve this promotion?",
  "سنة": "year",

  // ────── Medical Insurance / التأمين الطبي ──────
  "نوع الطلب": "Request Type",
  "📋 استفسار عن المنافع": "📋 Benefits Inquiry",
  "➕ إضافة مرافق (زوجة/أبناء)": "➕ Add Dependent (spouse/children)",
  "➖ حذف مرافق": "➖ Remove Dependent",
  "⬆️ ترقية الشريحة (class upgrade)": "⬆️ Class Upgrade",
  "اسم التابع": "Dependent Name",
  "العلاقة": "Relationship",
  "الاسم الكامل للتابع": "Full name of dependent",
  "زوجة": "Spouse",
  "ابن": "Son",
  "ابنة": "Daughter",
  "والد": "Father",
  "والدة": "Mother",
  "تفاصيل الطلب": "Request Details",
  "اشرح الطلب بالتفصيل...": "Explain the request in detail...",
  "اكتب تفاصيل الطلب (10 أحرف على الأقل)": "Write details (at least 10 chars)",
  "أدخل تاريخ ميلاد التابع": "Enter dependent's date of birth",

  // ────── Other Request / طلب آخر ──────
  "موضوع الطلب": "Request Subject",
  "تفاصيل كاملة": "Full Details",
  "الأولوية": "Priority",
  "اكتب موضوع الطلب (5 أحرف على الأقل)": "Write subject (at least 5 chars)",
  "اكتب تفاصيل الطلب (20 حرف على الأقل)": "Write details (at least 20 chars)",
  "اكتب موضوع مختصر للطلب": "Write a short subject",
  "اشرح طلبك بالتفصيل...": "Explain your request in detail...",
  "منخفضة": "Low",
  "عادية": "Normal",
  "مرتفعة": "High",
  "عاجلة": "Urgent",

  // ────── Leaves / إجازات ──────
  "طلب إجازة": "Request Leave",
  "نوع الإجازة": "Leave Type",
  "من تاريخ": "From Date",
  "إلى تاريخ": "To Date",
  "عدد الأيام": "Number of Days",
  "السبب": "Reason",
  "الرصيد": "Balance",
  "إجازة سنوية": "Annual Leave",
  "إجازة مرضية": "Sick Leave",
  "إجازة طارئة": "Emergency Leave",
  "إجازة بدون راتب": "Unpaid Leave",
  "إجازة زواج": "Marriage Leave",
  "إجازة وضع": "Maternity Leave",
  "إجازة وفاة": "Bereavement Leave",
  "إجازة حج": "Hajj Leave",
  "معلّق": "Pending",
  "معتمد": "Approved",
  "مرفوض": "Rejected",
  "قيد المراجعة": "Under Review",
  "طلباتي": "My Requests",
  "لا توجد طلبات": "No requests",
  "تم إرسال طلب الإجازة": "Leave request sent",

  // ────── Permission / استئذان ──────
  "استئذان": "Permission Request",
  "طلب استئذان": "Request Permission",
  "نوع الاستئذان": "Permission Type",
  "وقت الخروج": "Leave Time",
  "وقت العودة": "Return Time",
  "سبب الاستئذان": "Permission Reason",
  "استئذان شخصي": "Personal",
  "استئذان طبي": "Medical",
  "استئذان عائلي": "Family",
  "استئذان رسمي": "Official",

  // ────── Absence Notice / إفادة غياب ──────
  "إفادة غياب": "Absence Notice",
  "طلب إفادة غياب": "Submit Absence Notice",
  "تاريخ الغياب": "Absence Date",
  "سبب الغياب": "Absence Reason",
  "إثبات/مرفق": "Proof/Attachment",

  // ────── Status messages ──────
  "إرسال": "Submit",
  "تم بنجاح": "Success",
  "حدث خطأ": "An error occurred",
  "حقول مطلوبة": "Required fields missing",
  "يرجى ملء جميع الحقول": "Please fill all fields",

  // ────── Notifications / إشعارات ──────
  "لا توجد إشعارات": "No notifications",
  "قراءة الكل": "Mark all read",
  "الآن": "now",
  "منذ": "ago",

  // ────── Tickets / تذاكر ──────
  "تذاكر الدعم الفني": "Support Tickets",
  "تذكرة جديدة": "New Ticket",
  "الموضوع": "Subject",
  "الرسالة": "Message",
  "ردّ": "Reply",
  "مفتوحة": "Open",
  "محلولة": "Resolved",
  "مغلقة": "Closed",

  // ────── Settings / الإعدادات ──────
  "المظهر": "Theme",
  "الوضع الليلي": "Dark Mode",
  "الوضع النهاري": "Light Mode",
  "تغيير اللغة": "Change Language",
  "حول التطبيق": "About App",
  "الإصدار": "Version",

  // ────── Legal / الشؤون القانونية ──────
  "الشؤون القانونية": "Legal Affairs",
  "المخالفات": "Violations",
  "الشكاوى": "Complaints",
  "التحقيقات": "Investigations",
  "التظلمات": "Appeals",
  "لائحة العمل": "Work Regulations",

  // ────── Status messages / رسائل الحالة ──────
  "فشل الاتصال": "Connection failed",
  "غير متصل": "Offline",
  "الإنترنت غير متاح": "Internet unavailable",

  // ────── Common words ──────
  "من": "from",
  "إلى": "to",
  "في": "in",
  "و": "and",
  "أو": "or",
};

// ═════════════════════════════════════════════
// Language state management
// ═════════════════════════════════════════════
var currentLang = (function(){
  try {
    return localStorage.getItem("basma_lang") || "ar";
  } catch(e) { return "ar"; }
})();

// قائمة المشتركين للتحديث الفوري عند تبديل اللغة
var subscribers = [];

/* تغيير اللغة الحالية */
export function setLang(lang) {
  if (lang !== "ar" && lang !== "en") return;
  currentLang = lang;
  try { localStorage.setItem("basma_lang", lang); } catch(e) {}
  // تبديل dir على body
  try {
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lang);
  } catch(e) {}
  // إعلام المشتركين
  subscribers.forEach(function(fn){ try { fn(lang); } catch(e){} });
}

/* الحصول على اللغة الحالية */
export function getLang() {
  return currentLang;
}

/* الحصول على الاتجاه */
export function getDir() {
  return currentLang === "ar" ? "rtl" : "ltr";
}

/* هل اللغة عربية؟ (للقرارات الشرطية) */
export function isRTL() {
  return currentLang === "ar";
}

/* دالة الترجمة الأساسية
 * t("الحضور") → "Attendance" (إن EN)، وإلا "الحضور"
 */
export function t(arText) {
  if (!arText || typeof arText !== "string") return arText;
  if (currentLang === "en") {
    var trans = EN_TRANSLATIONS[arText];
    if (trans) return trans;
    // إذا لم يوجد ترجمة، أرجع النص العربي (الـ UI لا ينكسر)
  }
  return arText;
}

/* اشتراك لتحديث المكوّن عند تبديل اللغة */
export function subscribeLangChange(fn) {
  subscribers.push(fn);
  return function unsub() {
    var i = subscribers.indexOf(fn);
    if (i >= 0) subscribers.splice(i, 1);
  };
}

/* تهيئة عند تحميل الصفحة (لو كان المستخدم اختار EN سابقاً) */
try {
  document.documentElement.setAttribute("dir", currentLang === "ar" ? "rtl" : "ltr");
  document.documentElement.setAttribute("lang", currentLang);
} catch(e) {}
