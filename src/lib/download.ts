import { toast } from 'sonner';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Téléchargement Excel : la bibliothèque `xlsx` (~400 Ko) est chargée à la demande
 * pour ne pas alourdir les pages qui importent ce fichier (Exercices, Cours…).
 * Le classeur est converti en Blob puis passe par downloadBlob (même logique
 * iOS 12 / iOS 13+ / autres navigateurs). Signature inchangée (fonction asynchrone).
 */
export async function downloadExcelFile(workbook: any, filename: string): Promise<void> {
  const XLSX: any = await import('xlsx');
  const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const wbout: ArrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return downloadBlob(new Blob([wbout], { type: XLSX_MIME }), cleanFilename);
}

/** iPad / iPhone (y compris iPadOS 13+ qui se présente comme un Mac). */
export function isIOSDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Version majeure d'iOS / iPadOS, ou null hors iOS.
 * iPadOS 13+ en mode « bureau » se présente comme un Mac (MacIntel + écran tactile) :
 * il est forcément ≥ 13.
 */
export function getIOSMajorVersion(): number | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) {
    const m = ua.match(/OS (\d+)[_.]\d+/);
    if (m) return parseInt(m[1], 10);
    const v = ua.match(/Version\/(\d+)/);
    return v ? parseInt(v[1], 10) : 12; // inconnu : on suppose l'ancien Safari (chemin le plus sûr)
  }
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
    const v = ua.match(/Version\/(\d+)/);
    const n = v ? parseInt(v[1], 10) : 13;
    return n >= 13 ? n : 13;
  }
  return null;
}

/** iOS < 13 : Safari ignore l'attribut `download`. */
function isLegacyIOS(): boolean {
  const v = getIOSMajorVersion();
  return v !== null && v < 13;
}

/** Au-delà, la fonction Netlify (base64 +33 %, limite 6 Mo) échouerait. */
const NETLIFY_MAX_BYTES = 4.5 * 1024 * 1024;

function currentLang(): string {
  try { return localStorage.getItem('maataoui-language') || 'fr'; } catch { return 'fr'; }
}

/** Ouvre le Blob dans un nouvel onglet (iOS 12 : l'utilisateur l'enregistre via Partager). */
function openBlobInNewTab(blob: Blob, explain: boolean): void {
  const url = window.URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    // fenêtre bloquée : lien cible _blank
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  if (explain) {
    const lang = currentLang();
    toast.info(
      lang === 'ar'
        ? 'الملف كبير: فُتح في علامة تبويب جديدة. اضغط « مشاركة » ثم « حفظ في الملفات ».'
        : lang === 'en'
          ? 'Large file: it opened in a new tab. Tap "Share" > "Save to Files".'
          : 'Fichier volumineux : il s\'est ouvert dans un nouvel onglet. Touchez « Partager » > « Enregistrer dans Fichiers ».',
      { duration: 10000 },
    );
  }
  // l'onglet ouvert doit pouvoir lire l'URL un moment
  setTimeout(() => window.URL.revokeObjectURL(url), 120000);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      resolve(res.slice(res.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function postToDownloadFunction(base64Data: string, filename: string): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `/api/download/${encodeURIComponent(filename)}`;
  form.style.display = 'none';
  const inputData = document.createElement('input');
  inputData.type = 'hidden';
  inputData.name = 'data';
  inputData.value = base64Data;
  form.appendChild(inputData);
  const inputName = document.createElement('input');
  inputName.type = 'hidden';
  inputName.name = 'filename';
  inputName.value = filename;
  form.appendChild(inputName);
  document.body.appendChild(form);
  form.submit();
  setTimeout(() => { if (form.parentNode) form.parentNode.removeChild(form); }, 2000);
}

/**
 * Téléchargement universel d'un Blob (xlsx, csv, pdf).
 * - iOS < 13 (iPad Safari 12) : l'attribut `download` est ignoré → fonction Netlify
 *   /api/download qui renvoie le fichier avec son vrai nom ; au-delà de ~4,5 Mo
 *   (limite Netlify) ou en cas d'échec : ouverture dans un nouvel onglet.
 * - iOS 13+, Android, PC : lien <a download> sur une URL Blob, libérée après coup
 *   (la libérer tout de suite annulait parfois le téléchargement sur Android/iOS).
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isLegacyIOS()) {
    if (blob.size > NETLIFY_MAX_BYTES) {
      openBlobInNewTab(blob, true);
      return;
    }
    try {
      const base64 = await blobToBase64(blob);
      postToDownloadFunction(base64, filename);
      return;
    } catch (err) {
      console.error('iOS download error, falling back:', err);
      openBlobInNewTab(blob, false);
      return;
    }
  }
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(url), 10000);
}

export function iosCompatibleDownload(blob: Blob, filename: string): void {
  void downloadBlob(blob, filename);
}

export function iosCompatibleXlsxDownload(XLSXModule: any, workbook: any, filename: string): void {
  void downloadExcelFile(workbook, filename);
}
