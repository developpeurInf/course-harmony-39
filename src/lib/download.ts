import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

/**
 * Universal Excel (.xlsx) file download helper.
 * 
 * Works seamlessly on iPad (iOS 12+), iPhone, Android, PC, and Mac:
 * 1. Generates the binary workbook.
 * 2. Uploads the spreadsheet to Supabase Storage temporarily and gets a real HTTPS URL
 *    with '?download=filename.xlsx' which sends Content-Disposition: attachment; filename=...
 * 3. Triggers download via real URL. Safari on iPad treats this as a real file download
 *    (saving as a real .xlsx file without opening raw 'blob:' pages!).
 * 4. Falls back to standard XLSX.writeFile if offline or storage upload fails.
 */
export async function downloadExcelFile(workbook: any, filename: string): Promise<void> {
  const wbout: ArrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  // Try real server-backed download via Supabase storage
  try {
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `temp-exports/${Date.now()}_${cleanFilename}`;
    const { error: uploadError } = await supabase.storage
      .from('course-materials')
      .upload(storagePath, blob, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true
      });

    if (!uploadError) {
      const { data } = supabase.storage
        .from('course-materials')
        .getPublicUrl(storagePath, { download: filename });

      if (data?.publicUrl) {
        const link = document.createElement('a');
        link.href = data.publicUrl;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
    }
  } catch (err) {
    console.warn('Supabase storage export fallback:', err);
  }

  // Fallback: direct anchor download
  try {
    XLSX.writeFile(workbook, filename);
  } catch (e) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
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
