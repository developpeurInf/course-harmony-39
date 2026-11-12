/**
 * Traduction arabe de l'interface du visualiseur EmbedPDF (qui fournit déjà le français et l'anglais).
 * Clés identiques à la traduction anglaise d'origine ; une clé absente retombe sur l'anglais.
 */
export const ARABIC_LOCALE = {
  code: "ar",
  name: "العربية",
  translations: {
    search: { placeholder: "بحث", caseSensitive: "مطابقة حالة الأحرف", wholeWord: "الكلمة كاملة", resultsFound: "{count} نتيجة", page: "الصفحة {page}" },
    zoom: { in: "تكبير", out: "تصغير", fitWidth: "ملاءمة العرض", fitPage: "ملاءمة الصفحة", marquee: "تكبير منطقة", menu: "قائمة التكبير", level: "مستوى التكبير ({level}%)", dragTip: "اسحب لتحديد المنطقة المراد تكبيرها" },
    pan: { toggle: "وضع التحريك" },
    pointer: { toggle: "وضع المؤشر" },
    capture: { screenshot: "لقطة شاشة", dragTip: "اسحب لتحديد المنطقة المراد التقاطها", title: "معاينة اللقطة", download: "تحميل", cancel: "إلغاء" },
    document: { menu: "قائمة الوثيقة", open: "فتح", close: "إغلاق", print: "طباعة", protect: "الحماية", export: "تصدير", fullscreen: "ملء الشاشة", loading: "جارٍ تحميل الوثيقة..." },
    emptyState: { title: "لا توجد وثيقة مفتوحة", description: "افتح وثيقة PDF للبدء.", descriptionMulti: "يمكنك عرض عدة وثائق باستعمال التبويبات.", openButton: "فتح وثيقة", supportedFormats: "الصيغة المدعومة: PDF" },
    passwordPrompt: { title: "كلمة المرور مطلوبة", required: "هذه الوثيقة محمية بكلمة مرور. أدخل كلمة المرور لفتحها.", incorrect: "كلمة المرور غير صحيحة. حاول مرة أخرى.", incorrectWarning: "كلمة مرور غير صحيحة. تحقق منها وحاول مجددا.", label: "كلمة المرور", placeholder: "أدخل كلمة مرور الوثيقة", open: "فتح", opening: "جارٍ الفتح...", cancel: "إلغاء", close: "إغلاق" },
    documentError: { title: "خطأ في تحميل الوثيقة", unknown: "حدث خطأ غير معروف", errorCode: "رمز الخطأ: {code}", close: "إغلاق الوثيقة" },
    panel: { sidebar: "الشريط الجانبي", search: "بحث", comment: "التعليقات", thumbnails: "الصفحات المصغرة", outline: "الفهرس", annotationStyle: "نمط التعليق", redaction: "الإخفاء" },
    menu: { viewControls: "خيارات العرض", zoomControls: "خيارات التكبير", moreOptions: "خيارات أخرى" },
    outline: { title: "الفهرس", loading: "جارٍ تحميل الفهرس...", noOutline: "لا يوجد فهرس", noBookmarks: "لا تحتوي هذه الوثيقة على إشارات مرجعية" },
    page: { settings: "إعدادات الصفحة", single: "صفحة واحدة", twoOdd: "صفحتان (فردية)", twoEven: "صفحتان (زوجية)", vertical: "عمودي", horizontal: "أفقي", spreadMode: "طريقة العرض", scrollLayout: "اتجاه التمرير", rotation: "تدوير الصفحة", next: "الصفحة التالية", previous: "الصفحة السابقة" },
    rotate: { clockwise: "تدوير مع عقارب الساعة", counterClockwise: "تدوير عكس عقارب الساعة" },
    selection: { copy: "نسخ التحديد" },
    mode: { view: "عرض", annotate: "تعليق", shapes: "أشكال", form: "نموذج", redact: "إخفاء", insert: "إدراج" },
    form: { textfield: "حقل نص", checkbox: "خانة اختيار", radio: "زر اختيار", select: "قائمة منسدلة", listbox: "قائمة" },
    annotation: {
      text: "ملاحظة", highlight: "تظليل", strikeout: "شطب", underline: "تسطير", squiggly: "تسطير متموج", rectangle: "مستطيل", circle: "دائرة", line: "خط", arrow: "سهم", polygon: "مضلع", polyline: "خط متعدد", ink: "رسم حر", inkHighlighter: "قلم تظليل", stamp: "ختم", caret: "علامة إدراج", insertText: "إدراج نص", replaceText: "استبدال نص", freeText: "نص حر", square: "مربع",
      style: "نمط التعليق", styles: "أنماط {type}", defaults: "إعدادات {type}", color: "اللون", opacity: "الشفافية", blendMode: "وضع المزج", strokeWidth: "سمك الخط", strokeColor: "لون الخط", borderStyle: "نمط الإطار", fillColor: "لون التعبئة", fontSize: "حجم الخط", fontFamily: "الخط", textAlign: "محاذاة النص", verticalAlign: "المحاذاة العمودية", lineEnding: "نهاية الخط", lineStart: "بداية الخط", lineEnd: "نهاية الخط", font: "الخط", fontColor: "لون الخط", backgroundColor: "لون الخلفية",
      noStyles: "لا توجد أنماط لهذا التعليق.", noStylesStamp: "لا توجد أنماط للأختام.", selectAnnotation: "حدد تعليقا لعرض أنماطه", deleteSelected: "حذف التعليق المحدد", deleteAllSelected: "حذف المحدد", multiSelect: "{count} تعليقات محددة", group: "تجميع", ungroup: "فك التجميع", moreTools: "أدوات أخرى", addLink: "إضافة رابط", removeLink: "إزالة الرابط", gotoLink: "الانتقال إلى الرابط", comment: "تعليق", callout: "فقاعة نص", redact: "إخفاء", overlayText: "نص فوق الإخفاء", overlayTextPlaceholder: "مثال: محذوف", rotation: "التدوير",
    },
    insert: { image: "صورة", rubberStamp: "ختم" },
    redaction: {
      redact: "إخفاء", area: "إخفاء منطقة", text: "إخفاء نص", apply: "تطبيق الإخفاء", applyAll: "تطبيق الكل", clearAll: "مسح الكل", deleteSelected: "حذف الإخفاء المحدد", commitSelected: "تطبيق الإخفاء المحدد", emptyState: "لا توجد عمليات إخفاء معلقة",
      panel: { title: "عمليات الإخفاء", itemCount: "{count} إخفاء معلق", itemCountPlural: "{count} عمليات إخفاء معلقة", clearAll: "مسح الكل", redactAll: "إخفاء الكل" },
    },
    history: { undo: "تراجع", redo: "إعادة" },
    comments: { page: "الصفحة {page}", commentCount: "{count} تعليق", commentCountPlural: "{count} تعليقات", addComment: "أضف تعليقا...", addReply: "أضف ردا...", showAllAnnotations: "عرض كل التعليقات", closeAllAnnotations: "إغلاق كل التعليقات", save: "حفظ", cancel: "إلغاء", edit: "تعديل", delete: "حذف", showMore: "المزيد", showLess: "أقل", emptyState: "أضف تعليقات توضيحية لتتمكن من التعليق عليها." },
    blendMode: { normal: "عادي", multiply: "ضرب", screen: "شاشة", overlay: "تراكب", darken: "تغميق", lighten: "تفتيح", colorDodge: "تفادي اللون", colorBurn: "حرق اللون", hardLight: "ضوء قوي", softLight: "ضوء خافت", difference: "فرق", exclusion: "استبعاد", hue: "تدرج اللون", saturation: "التشبع", color: "اللون", luminosity: "الإضاءة" },
    print: { title: "إعدادات الطباعة", loading: "جارٍ تجهيز الوثيقة...", pages: "الصفحات المراد طباعتها", all: "كل الصفحات", current: "الصفحة الحالية ({currentPage})", specify: "تحديد الصفحات", specifyEG: "مثال: 1-3، 5، 8-10", total: "عدد صفحات الوثيقة: {totalPages}", annotation: "تضمين التعليقات", printing: "جارٍ الطباعة...", print: "طباعة", cancel: "إلغاء" },
    protect: {
      title: "حماية الوثيقة", cancel: "إلغاء", apply: "تطبيق الحماية", applying: "جارٍ التطبيق...", applyFailed: "تعذر تطبيق الحماية. حاول مرة أخرى.", removeFailed: "تعذرت إزالة الحماية. حاول مرة أخرى.", passwordMismatch: "كلمتا المرور غير متطابقتين", noProtectionSelected: "اختر خيار حماية واحدا على الأقل.", bothPasswordsNote: "من يفتح الوثيقة بكلمة مرورها تكون صلاحياته محدودة. استعمل كلمة مرور المالك للوصول الكامل.",
      openPassword: { title: "طلب كلمة مرور للفتح", description: "يجب إدخال كلمة مرور لعرض هذه الوثيقة.", label: "كلمة مرور الوثيقة", placeholder: "أدخل كلمة المرور", confirm: "تأكيد كلمة المرور", confirmPlaceholder: "أكد كلمة المرور" },
      ownerPassword: { label: "كلمة مرور المالك", placeholder: "أدخل كلمة مرور المالك", confirm: "تأكيد كلمة مرور المالك", confirmPlaceholder: "أكد كلمة مرور المالك" },
      permissions: { title: "تقييد الصلاحيات", description: "حدد ما يمكن للمستخدمين فعله بهذه الوثيقة.", allowedActions: "العمليات المسموح بها", print: "الطباعة", printHighQuality: "طباعة بجودة عالية", copy: "نسخ المحتوى", accessibility: "الاستخراج لتسهيل الوصول", modify: "تعديل المحتوى", annotations: "إضافة/تعديل التعليقات", fillForms: "ملء النماذج والتوقيع", assemble: "تجميع واستخراج الصفحات" },
      encrypted: { title: "الوثيقة محمية", description: "هذه الوثيقة محمية من طرف مالكها. أدخل كلمة مرور المالك لتعديل إعدادات الأمان.", enterOwnerPassword: "أدخل كلمة مرور المالك للتعديل", unlockAndEdit: "فتح وتعديل" },
      modifyProtection: { title: "تعديل الحماية", description: "اختر طريقة تعديل حماية الوثيقة.", changeOption: "تغيير كلمات المرور أو الصلاحيات", changeDescription: "تحديث كلمة مرور الوثيقة أو إعدادات الصلاحيات.", removeOption: "إزالة كل الحماية", removeDescription: "إزالة الحماية بكلمة المرور من هذه الوثيقة." },
      removeProtection: { title: "إزالة الحماية", warning: "هل تريد فعلا إزالة الحماية؟", description: "ستُزال كل حماية بكلمة المرور، وسيتمكن أي شخص من فتح الوثيقة وتعديلها.", confirm: "إزالة الحماية" },
    },
    security: {
      protected: { title: "هذه الوثيقة محمية", description: "هذا الملف محمي وقد تكون بعض الوظائف معطلة. افتح « الحماية » في قائمة الوثيقة لعرض الصلاحيات أو فتحها.", viewPermissions: "عرض الصلاحيات" },
      viewPermissions: { title: "صلاحيات الوثيقة", description: "هذا الملف مقيد من طرف مالكه ويتطلب كلمة مرور لبعض العمليات.", restrictedActions: "العمليات المقيدة" },
      unlock: { label: "أدخل كلمة مرور المالك لفتح الملف", placeholder: "أدخل كلمة مرور المالك", button: "فتح الملف", invalidPassword: "كلمة مرور غير صحيحة. حاول مرة أخرى.", failed: "تعذر الفتح. حاول مرة أخرى.", success: "تم فتح صلاحيات المالك! لديك الآن وصول كامل." },
    },
    common: { close: "إغلاق", back: "رجوع", cancel: "إلغاء" },
    link: { title: "إدراج رابط", url: "الرابط", page: "الصفحة", enterUrl: "أدخل الرابط", enterPage: "أدخل رقم الصفحة", pageRange: "من الصفحة 1 إلى {totalPages}", link: "رابط" },
    stamp: { title: "الأختام", allStamps: "كل الأختام", export: "تصدير الأختام", emptyState: "لا توجد أختام في المكتبة المحددة.", createFromSelected: "إنشاء ختم", createFromGroup: "إنشاء ختم من المجموعة", library: { custom: "أختام مخصصة" } },
    signature: {
      title: "التوقيعات", createNew: "إنشاء توقيع جديد", createNewWithInitials: "إنشاء توقيع وأحرف أولى", placeSignature: "توقيع", placeInitials: "أحرف أولى", remove: "حذف التوقيع", emptyState: "لا توجد توقيعات بعد. أنشئ توقيعا للبدء.",
      create: { title: "إنشاء توقيع", draw: "رسم", type: "كتابة", upload: "رفع", signatureLabel: "التوقيع", initialsLabel: "الأحرف الأولى", clear: "مسح", typePlaceholder: "مثال: يوسف المعطاوي", initialsPlaceholder: "مثال: ي.م", uploadPlaceholder: "انقر أو اسحب صورة هنا", font: "الخط", color: "اللون", cancel: "إلغاء", save: "حفظ" },
    },
  },
};
