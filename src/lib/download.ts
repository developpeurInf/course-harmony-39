
/**
 * iOS/Safari compatible download helper.
 * iOS Safari does NOT support the <a href="blob:..." download="filename"> trick.
 * Instead we open the blob URL in a new tab, letting iOS share/save it natively.
 */
export function iosCompatibleDownload(blob: Blob, filename: string): void {
  const isIOS = /iP(hone|ad|od)/i.test(navigator.userAgent);
  const url = window.URL.createObjectURL(blob);
  if (isIOS) {
    // Open directly - iOS will show the Share sheet so user can save or view
    window.open(url, '_blank');
    setTimeout(() => window.URL.revokeObjectURL(url), 10000);
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

/**
 * iOS-safe XLSX workbook download using the 'xlsx' library.
 */
export function iosCompatibleXlsxDownload(XLSX: any, workbook: any, filename: string): void {
  const isIOS = /iP(hone|ad|od)/i.test(navigator.userAgent);
  if (isIOS) {
    // Write to array buffer then create blob
    const wbout: ArrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => window.URL.revokeObjectURL(url), 10000);
  } else {
    XLSX.writeFile(workbook, filename);
  }
}
