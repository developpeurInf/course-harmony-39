import * as XLSX from 'xlsx';

/**
 * Universal Excel (.xlsx) file download helper.
 * 
 * On iOS Safari:
 * Submits the file via a hidden form to /api/download/:filename
 * which returns Content-Disposition: attachment; filename="liste_eleves.xlsx".
 * Because the URL ends with the real filename and the server sets the header,
 * iOS Safari downloads the file with its REAL name (e.g. liste_eleves.xlsx)
 * and NEVER names it "Unknown" or opens raw blob tabs!
 * 
 * On PC / Android / Mac:
 * Uses standard client-side XLSX.writeFile which triggers immediate download.
 */
export async function downloadExcelFile(workbook: any, filename: string): Promise<void> {
  const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS) {
    try {
      const base64Data: string = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
      
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `/api/download/${encodeURIComponent(cleanFilename)}`;
      form.style.display = 'none';

      const inputData = document.createElement('input');
      inputData.type = 'hidden';
      inputData.name = 'data';
      inputData.value = base64Data;
      form.appendChild(inputData);

      const inputName = document.createElement('input');
      inputName.type = 'hidden';
      inputName.name = 'filename';
      inputName.value = cleanFilename;
      form.appendChild(inputName);

      document.body.appendChild(form);
      form.submit();
      setTimeout(() => document.body.removeChild(form), 2000);
      return;
    } catch (err) {
      console.error('iOS form download error, falling back:', err);
    }
  }

  // Standard download for PC, Android, and fallback
  try {
    XLSX.writeFile(workbook, cleanFilename);
  } catch (e) {
    console.error('XLSX.writeFile error:', e);
    const wbout: ArrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = cleanFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(url), 2000);
  }
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
  downloadExcelFile(workbook, filename);
}
