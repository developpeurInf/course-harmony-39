/**
 * Téléchargement Excel : la bibliothèque `xlsx` (~400 Ko) est chargée à la demande
 * depuis ./downloadExcel pour ne pas alourdir les pages qui importent ce fichier
 * (Exercices, Cours…). Signature et comportement inchangés (fonction asynchrone).
 */
export async function downloadExcelFile(workbook: any, filename: string): Promise<void> {
  const mod = await import('./downloadExcel');
  return mod.downloadExcelFile(workbook, filename);
}

/** iPad / iPhone (y compris iPadOS 13+ qui se présente comme un Mac). */
export function isIOSDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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
 * - iPad / iPhone : Safari 12 ignore l'attribut `download` → on passe par la
 *   fonction Netlify /api/download qui renvoie le fichier avec son vrai nom.
 * - Android / PC : lien <a download>, URL libérée après coup (la libérer tout de
 *   suite annulait parfois le téléchargement sur Android et iOS récents).
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isIOSDevice()) {
    try {
      const base64 = await blobToBase64(blob);
      postToDownloadFunction(base64, filename);
      return;
    } catch (err) {
      console.error('iOS download error, falling back:', err);
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
