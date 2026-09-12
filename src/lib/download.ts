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

export function iosCompatibleDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(url), 2000);
}

export function iosCompatibleXlsxDownload(XLSXModule: any, workbook: any, filename: string): void {
  downloadExcelFile(workbook, filename);
}
