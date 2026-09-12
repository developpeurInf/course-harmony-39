
/**
 * Direct file download helper.
 * Downloads real files (.xlsx, .pdf, .csv) with their proper filenames
 * WITHOUT opening any "blob:" tabs in the browser.
 */
export function iosCompatibleDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(url), 3000);
}

export function iosCompatibleXlsxDownload(XLSX: any, workbook: any, filename: string): void {
  XLSX.writeFile(workbook, filename);
}
