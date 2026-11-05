/** Modèles de classeurs (Excel) : vierge, carnet de notes, budget, facture, présence, emploi du temps */
import type { IWorkbookData, IWorksheetData } from "@univerjs/presets";
import { blankWorkbook } from "./xlsxConvert";
import type { Tr } from "../shared/useOfficeEnv";

type AnyObj = Record<string, any>;

const HEAD = { bl: 1, cl: { rgb: "#FFFFFF" }, bg: { rgb: "#217346" }, ht: 2, vt: 2, bd: border() };
const CELL = { bd: border(), vt: 2 };
const TITLE = { bl: 1, fs: 16, cl: { rgb: "#217346" } };
function border() {
  const e = { s: 1, cl: { rgb: "#BFBFBF" } };
  return { t: e, b: e, l: e, r: e };
}

function build(name: string, id: string, sheetName: string, rows: (string | number | { f: string } | null)[][], opts: {
  headRow?: number; titleRow?: boolean; widths?: number[]; formats?: Record<number, string>; freeze?: number; totalRow?: number;
} = {}): IWorkbookData {
  const wb = blankWorkbook(name, id, sheetName);
  const sh = wb.sheets["sheet-1"] as IWorksheetData;
  const styles: AnyObj = { head: HEAD, cell: CELL, title: TITLE, total: { ...CELL, bl: 1, bg: { rgb: "#E2EFDA" } } };
  Object.entries(opts.formats || {}).forEach(([c, p]) => {
    styles[`n${c}`] = { ...CELL, n: { pattern: p } };
    styles[`tn${c}`] = { ...styles.total, n: { pattern: p } };
  });
  wb.styles = styles;
  const cd: AnyObj = {};
  rows.forEach((row, r) => row.forEach((v, c) => {
    if (v === null || v === undefined) return;
    const cell: AnyObj = {};
    if (typeof v === "object") cell.f = v.f;
    else { cell.v = v; cell.t = typeof v === "number" ? 2 : 1; }
    if (opts.titleRow && r === 0) cell.s = "title";
    else if (r === opts.headRow) cell.s = "head";
    else if (opts.headRow !== undefined && r > opts.headRow) {
      const isTotal = opts.totalRow === r;
      cell.s = opts.formats?.[c] ? `${isTotal ? "t" : ""}n${c}` : isTotal ? "total" : "cell";
    }
    (cd[r] ||= {})[c] = cell;
  }));
  sh.cellData = cd;
  sh.columnData = Object.fromEntries((opts.widths || []).map((w, i) => [i, { w }])) as any;
  if (opts.headRow !== undefined) sh.rowData = { [opts.headRow]: { h: 30 } } as any;
  if (opts.freeze) sh.freeze = { xSplit: 0, ySplit: opts.freeze, startRow: opts.freeze, startColumn: -1 };
  if (opts.titleRow) sh.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: Math.max(0, (rows[opts.headRow ?? 1] || []).length - 1) }];
  return wb;
}

export function excelTemplates(L: Tr) {
  return [
    { id: "blank", label: L("Classeur vide", "مصنف فارغ", "Blank workbook") },
    { id: "grades", label: L("Carnet de notes", "دفتر النقط", "Gradebook"), desc: L("Moyennes et mentions automatiques", "معدلات وميزات تلقائية", "Automatic averages") },
    { id: "budget", label: L("Budget mensuel", "الميزانية الشهرية", "Monthly budget"), desc: L("Recettes, dépenses, solde", "المداخيل والمصاريف والرصيد", "Income, expenses, balance") },
    { id: "invoice", label: L("Facture", "فاتورة", "Invoice"), desc: L("Quantités, prix, TVA", "الكميات والأثمان والضريبة", "Quantities, prices, VAT") },
    { id: "attendance", label: L("Feuille de présence", "ورقة الحضور", "Attendance sheet") },
    { id: "timetable", label: L("Emploi du temps", "استعمال الزمن", "Timetable") },
  ];
}

export function buildExcelTemplate(tid: string, name: string, id: string, L: Tr): IWorkbookData {
  const sheet = L("Feuil1", "ورقة1", "Sheet1");
  switch (tid) {
    case "grades": {
      const students = ["Amine", "Sara", "Youssef", "Imane", "Omar", "Salma", "Hamza", "Nour"];
      const rows: any[][] = [
        [L("Carnet de notes — Mathématiques", "دفتر النقط — الرياضيات", "Gradebook — Mathematics")],
        [L("Élève", "التلميذ", "Student"), L("Devoir 1", "الفرض 1", "Test 1"), L("Devoir 2", "الفرض 2", "Test 2"), L("Devoir 3", "الفرض 3", "Test 3"), L("Activités", "الأنشطة", "Activities"), L("Moyenne", "المعدل", "Average"), L("Mention", "الميزة", "Grade"), L("Rang", "الرتبة", "Rank")],
      ];
      students.forEach((s, i) => {
        const r = i + 3;
        rows.push([s, 8 + ((i * 7) % 12), 9 + ((i * 5) % 11), 7 + ((i * 3) % 13), 12 + (i % 8),
          { f: `=ROUND(AVERAGE(B${r}:E${r}),2)` },
          { f: `=IF(F${r}>=16,"${L("Très bien", "حسن جدا", "Excellent")}",IF(F${r}>=14,"${L("Bien", "حسن", "Good")}",IF(F${r}>=12,"${L("Assez bien", "مستحسن", "Fair")}",IF(F${r}>=10,"${L("Passable", "مقبول", "Pass")}","${L("Insuffisant", "غير كاف", "Fail")}"))))` },
          { f: `=RANK(F${r},$F$3:$F$${2 + students.length})` }]);
      });
      const last = 2 + students.length;
      rows.push([L("Moyenne de la classe", "معدل القسم", "Class average"), { f: `=ROUND(AVERAGE(B3:B${last}),2)` }, { f: `=ROUND(AVERAGE(C3:C${last}),2)` }, { f: `=ROUND(AVERAGE(D3:D${last}),2)` }, { f: `=ROUND(AVERAGE(E3:E${last}),2)` }, { f: `=ROUND(AVERAGE(F3:F${last}),2)` }, { f: `=COUNTIF(F3:F${last},">=10")&" ${L("admis", "ناجح", "passed")}"` }, null]);
      return build(name, id, sheet, rows, { titleRow: true, headRow: 1, widths: [170, 80, 80, 80, 90, 90, 110, 60], formats: { 1: "0.##", 2: "0.##", 3: "0.##", 4: "0.##", 5: "0.00" }, freeze: 2, totalRow: last });
    }
    case "budget": {
      const rows: any[][] = [
        [L("Budget mensuel", "الميزانية الشهرية", "Monthly budget")],
        [L("Poste", "البند", "Item"), L("Catégorie", "الفئة", "Category"), L("Prévu", "المتوقع", "Planned"), L("Réel", "الفعلي", "Actual"), L("Écart", "الفرق", "Difference")],
        [L("Salaire", "الأجرة", "Salary"), L("Recette", "مدخول", "Income"), 9000, 9000],
        [L("Cours particuliers", "دروس خصوصية", "Tutoring"), L("Recette", "مدخول", "Income"), 2000, 2400],
        [L("Loyer", "الكراء", "Rent"), L("Dépense", "مصروف", "Expense"), 3000, 3000],
        [L("Alimentation", "التغذية", "Food"), L("Dépense", "مصروف", "Expense"), 2000, 2250],
        [L("Transport", "النقل", "Transport"), L("Dépense", "مصروف", "Expense"), 600, 540],
        [L("Internet et téléphone", "الإنترنت والهاتف", "Internet & phone"), L("Dépense", "مصروف", "Expense"), 350, 350],
        [L("Loisirs", "الترفيه", "Leisure"), L("Dépense", "مصروف", "Expense"), 500, 720],
      ];
      for (let r = 3; r <= 9; r++) rows[r - 1][4] = { f: `=D${r}-C${r}` };
      rows.push([L("Solde", "الرصيد", "Balance"), "", { f: `=SUMIF(B3:B9,"${L("Recette", "مدخول", "Income")}",C3:C9)-SUMIF(B3:B9,"${L("Dépense", "مصروف", "Expense")}",C3:C9)` }, { f: `=SUMIF(B3:B9,"${L("Recette", "مدخول", "Income")}",D3:D9)-SUMIF(B3:B9,"${L("Dépense", "مصروف", "Expense")}",D3:D9)` }, { f: "=D10-C10" }]);
      return build(name, id, sheet, rows, { titleRow: true, headRow: 1, widths: [200, 110, 100, 100, 100], formats: { 2: "#,##0.00", 3: "#,##0.00", 4: "#,##0.00;[Red]-#,##0.00" }, totalRow: 9 });
    }
    case "invoice": {
      const rows: any[][] = [
        [L("FACTURE N° 2026-001", "فاتورة رقم 2026-001", "INVOICE No. 2026-001")],
        [L("Désignation", "البيان", "Description"), L("Quantité", "الكمية", "Qty"), L("Prix unitaire", "الثمن الأحادي", "Unit price"), L("Total HT", "المجموع دون رسوم", "Subtotal")],
        [L("Cours de soutien (heure)", "دروس الدعم (ساعة)", "Tutoring (hour)"), 10, 150],
        [L("Polycopié d'exercices", "مطبوع التمارين", "Exercise booklet"), 25, 20],
        [L("Examen blanc corrigé", "امتحان تجريبي مصحح", "Corrected mock exam"), 25, 30],
      ];
      for (let r = 3; r <= 5; r++) rows[r - 1][3] = { f: `=B${r}*C${r}` };
      rows.push(["", "", L("Total HT", "المجموع دون رسوم", "Subtotal"), { f: "=SUM(D3:D5)" }]);
      rows.push(["", "", L("TVA 20 %", "الضريبة 20٪", "VAT 20%"), { f: "=D6*20%" }]);
      rows.push(["", "", L("Total TTC", "المجموع مع الرسوم", "Total"), { f: "=D6+D7" }]);
      return build(name, id, sheet, rows, { titleRow: true, headRow: 1, widths: [260, 90, 120, 130], formats: { 2: "#,##0.00", 3: "#,##0.00 \"DH\"" }, totalRow: 7 });
    }
    case "attendance": {
      const days = Array.from({ length: 10 }, (_, i) => `J${i + 1}`);
      const rows: any[][] = [[L("Feuille de présence", "ورقة الحضور", "Attendance sheet")], [L("Élève", "التلميذ", "Student"), ...days, L("Absences", "الغياب", "Absences"), L("Taux", "النسبة", "Rate")]];
      ["Amine", "Sara", "Youssef", "Imane", "Omar", "Salma"].forEach((s, i) => {
        const r = i + 3;
        rows.push([s, ...days.map((_, d) => ((i + d) % 7 === 0 ? "A" : "P")), { f: `=COUNTIF(B${r}:K${r},"A")` }, { f: `=COUNTIF(B${r}:K${r},"P")/10` }]);
      });
      return build(name, id, sheet, rows, { titleRow: true, headRow: 1, widths: [150, ...days.map(() => 40), 80, 70], formats: { 12: "0%" }, freeze: 2 });
    }
    case "timetable": {
      const d = [L("Lundi", "الإثنين", "Monday"), L("Mardi", "الثلاثاء", "Tuesday"), L("Mercredi", "الأربعاء", "Wednesday"), L("Jeudi", "الخميس", "Thursday"), L("Vendredi", "الجمعة", "Friday"), L("Samedi", "السبت", "Saturday")];
      const rows: any[][] = [[L("Emploi du temps", "استعمال الزمن", "Timetable")], [L("Horaire", "التوقيت", "Time"), ...d]];
      ["08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00", "14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00"].forEach((h) => rows.push([h, "", "", "", "", "", ""]));
      return build(name, id, sheet, rows, { titleRow: true, headRow: 1, widths: [120, 130, 130, 130, 130, 130, 130] });
    }
    default:
      return blankWorkbook(name, id, sheet);
  }
}
