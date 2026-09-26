import * as XLSX from "xlsx";
import { downloadExcelFile } from "@/lib/download";
import { DiagnosticStudent } from "./diagnosticStatsEngine";

const SAMPLE_NAMES = [
  "ALAMI MOHAMMED", "BENNANI SALMA", "CHRAIBI YOUSSEF", "DAOUDI FATIMA ZAHRA",
  "EL FASSI OMAR", "IDRISSI HOUDA", "KABBAJ HAMZA", "LAHLOU KENZA",
  "MANSOURI AMINE", "NACIRI MERIEM", "OUAZZANI REDA", "QADIRI ASMAA",
  "RAHMANI ANAS", "SEBTI ZINEB", "TAZI WALID", "YAZAMI IMANE",
  "ZAHIR MEHDI", "BOUZID DOUAA", "CHAKIR SAAD", "EL AMRI SOUKAINA",
  "FILALI ISMAIL", "HASSANI NADA", "JAAFARI AYMANE", "KHLIFI HIBA", "MOKHTARI RAYAN"
];

const SAMPLE_NOTES = [
  6.5, 7.0, 5.0, 11.0, 13.5, 16.0, 4.5, 7.5, 9.0, 10.5,
  14.0, 15.5, 6.0, 8.0, 11.5, 12.0, 7.0, 5.5, 10.0, 13.0,
  17.0, 8.5, 6.0, 10.5, "" // Dernier absent
];

/**
 * Génère et télécharge un fichier Excel type conforme au format Massar marocain.
 */
export async function downloadSampleDiagnosticExcel(className = "2Bac-Classe"): Promise<void> {
  const wb = XLSX.utils.book_new();

  const data: (string | number)[][] = [
    ["N°", "Code Massar", "Nom et Prénom", "Date de Naissance", "Note / 20"]
  ];

  for (let i = 0; i < SAMPLE_NAMES.length; i++) {
    data.push([
      i + 1,
      `M13${100000 + i}`,
      SAMPLE_NAMES[i],
      "15/05/2007",
      SAMPLE_NOTES[i] ?? ""
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Définition des largeurs de colonnes
  ws["!cols"] = [
    { wch: 8 },  // N°
    { wch: 18 }, // Code Massar
    { wch: 30 }, // Nom et Prénom
    { wch: 18 }, // Date de Naissance
    { wch: 14 }  // Note / 20
  ];

  const sheetName = (className || "Eleves").substring(0, 30);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  await downloadExcelFile(wb, `modele_eleves_${className}.xlsx`);
}

/**
 * Analyse un fichier Excel (Massar officiel ou tableau personnalisé) et extrait les élèves.
 */
export async function parseExcelStudentsFile(file: File): Promise<DiagnosticStudent[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Le fichier Excel ne contient aucune feuille.");
  }

  const ws = wb.Sheets[firstSheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (!rows || rows.length === 0) {
    return [];
  }

  // Détection de l'en-tête
  let headerRowIdx = -1;
  const colMap: { name?: number; massar?: number; note?: number; num?: number } = {};

  const maxHeaderSearch = Math.min(12, rows.length);
  for (let rIdx = 0; rIdx < maxHeaderSearch; rIdx++) {
    const row = rows[rIdx];
    if (!Array.isArray(row)) continue;

    const rowStr = row.map(c => String(c ?? "").trim().toLowerCase());

    for (let cIdx = 0; cIdx < rowStr.length; cIdx++) {
      const val = rowStr[cIdx];
      if (["nom", "prénom", "prenom", "apprenant", "élève", "eleve", "النسب", "الاسم"].some(k => val.includes(k))) {
        colMap.name = cIdx;
      } else if (["massar", "cne", "matricule", "code", "مسار"].some(k => val.includes(k))) {
        colMap.massar = cIdx;
      } else if (["note", "point", "résultat", "resultat", "نقطة", "النقطة"].some(k => val.includes(k))) {
        colMap.note = cIdx;
      } else if (["n°", "num", "ordre", "ر.ت", "رقم"].some(k => val.includes(k))) {
        colMap.num = cIdx;
      }
    }

    if (colMap.name !== undefined) {
      headerRowIdx = rIdx;
      break;
    }
  }

  // Si aucun en-tête n'est trouvé, utiliser des index par défaut
  if (headerRowIdx === -1) {
    headerRowIdx = 0;
    colMap.num = 0;
    colMap.massar = 1;
    colMap.name = 2;
    colMap.note = rows[0]?.length && rows[0].length > 4 ? 4 : undefined;
  }

  const nameCol = colMap.name ?? 2;
  const massarCol = colMap.massar ?? (nameCol !== 1 ? 1 : 0);
  const noteCol = colMap.note;
  const numCol = colMap.num ?? (nameCol !== 0 ? 0 : undefined);

  const students: DiagnosticStudent[] = [];
  let studentCounter = 1;

  for (let rIdx = headerRowIdx + 1; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawName = row[nameCol];
    if (rawName === undefined || rawName === null || String(rawName).trim() === "") {
      continue;
    }

    const nameVal = String(rawName).trim();
    // Ignorer les lignes de totaux, moyennes ou bas de page
    const nameLower = nameVal.toLowerCase();
    if (["total", "moyenne", "somme", "signature", "المجموع"].some(ign => nameLower.includes(ign))) {
      continue;
    }

    let massarVal = "";
    if (massarCol !== undefined && row[massarCol] !== undefined && String(row[massarCol]).trim() !== "") {
      massarVal = String(row[massarCol]).trim();
    } else {
      massarVal = `E${studentCounter}`;
    }

    let noteVal: number | string | null = null;
    if (noteCol !== undefined && row[noteCol] !== undefined) {
      const rawNote = String(row[noteCol]).trim().toUpperCase();
      if (rawNote === "ABS") {
        noteVal = "ABS";
      } else if (rawNote !== "") {
        const parsed = parseFloat(rawNote.replace(",", "."));
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 20) {
          noteVal = Math.round(parsed * 100) / 100;
        }
      }
    }

    let numVal = studentCounter;
    if (numCol !== undefined && row[numCol] !== undefined) {
      const parsedNum = parseInt(String(row[numCol]).trim(), 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        numVal = parsedNum;
      }
    }

    students.push({
      id: studentCounter,
      num: numVal,
      massar: massarVal,
      name: nameVal,
      note: noteVal
    });

    studentCounter++;
  }

  return students;
}
