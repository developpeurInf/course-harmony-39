import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet, Users } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { downloadExcelFile } from '@/lib/download';
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

interface StudentData {
  prenom: string;
  nom: string;
  username?: string;
  temporaryPassword?: string;
}

interface StudentExcelManagerProps {
  roomId: string;
  onStudentsImported?: () => void;
  existingStudents?: StudentData[];
}

export const StudentExcelManager: React.FC<StudentExcelManagerProps> = ({ 
  roomId, 
  onStudentsImported,
  existingStudents = []
}) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [generatedStudents, setGeneratedStudents] = useState<StudentData[]>([]);
  const [allStudentsForDownload, setAllStudentsForDownload] = useState<StudentData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Arabic to Latin mapping for username generation
  const arabicToLatinMap: Record<string, string> = {
    'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
    'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'ch',
    'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'ou', 'ي': 'y', 'ى': 'a',
    'ة': 'a', 'ء': '', 'ئ': 'y', 'ؤ': 'ou'
  };

  const transliterateArabic = (text: string): string => {
    return text
      .split('')
      .map(char => arabicToLatinMap[char] ?? char)
      .join('');
  };

  // Generate username from name
  const generateUsername = (prenom: string, nom: string): string => {
    const latinPrenom = transliterateArabic(prenom.trim().toLowerCase());
    const latinNom = transliterateArabic(nom.trim().toLowerCase());
    const cleanPrenom = latinPrenom.replace(/[^a-z0-9]/g, '') || `std${Math.floor(100 + Math.random() * 900)}`;
    const cleanNom = latinNom.replace(/[^a-z0-9]/g, '') || `${Math.floor(100 + Math.random() * 900)}`;
    return `${cleanPrenom}.${cleanNom}`;
  };

  // Generate temporary password
  const generateTempPassword = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error(language === "ar" ? "يرجى اختيار ملف بصيغة Excel (.xlsx أو .xls)" : "Please select an Excel file (.xlsx or .xls)");
      return;
    }

    setSelectedFile(file);
  };

  // Safe ArrayBuffer reader compatible with iOS 12 Safari
  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            resolve(e.target.result as ArrayBuffer);
          } else {
            reject(new Error('Empty file read result'));
          }
        };
        reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
        reader.readAsArrayBuffer(file);
      } catch (err) {
        if (typeof file.arrayBuffer === 'function') {
          file.arrayBuffer().then(resolve).catch(reject);
        } else {
          reject(err);
        }
      }
    });
  };

  // Helper to extract value from row matching various possible column headers
  const getRowVal = (row: any, candidates: string[]): string => {
    for (const [key, val] of Object.entries(row)) {
      if (val === null || val === undefined) continue;
      const cleanKey = key.toString().trim().toLowerCase().replace(/[_\-\s]+/g, ' ');
      for (const cand of candidates) {
        const cleanCand = cand.trim().toLowerCase().replace(/[_\-\s]+/g, ' ');
        if (cleanKey === cleanCand || cleanKey.includes(cleanCand)) {
          const strVal = String(val).trim();
          if (strVal) return strVal;
        }
      }
    }
    return '';
  };

  // Download a template Excel file
  const handleDownloadTemplate = async () => {
    try {
      const ws = XLSX.utils.json_to_sheet([
        { 'الاسم': 'أحمد', 'النسب': 'العلوي' },
        { 'الاسم': 'فاطمة', 'النسب': 'الزهراء' },
        { 'الاسم': 'يوسف', 'النسب': 'المرابط' }
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      await downloadExcelFile(wb, "Modele_Eleves.xlsx");
    } catch (e: any) {
      console.error('Template download error:', e);
      toast.error(language === "ar" ? "فشل تحميل نموذج Excel" : "Failed to download template");
    }
  };

  const handleImportStudents = async () => {
    if (!selectedFile || !user) return;

    setImporting(true);
    try {
      // 1. Read file with iOS-safe FileReader
      const data = await readFileAsArrayBuffer(selectedFile);
      const workbook = XLSX.read(data, { type: 'array' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error(language === "ar" ? "الملف فارغ أو غير صالح" : "Empty or invalid Excel file");
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (!jsonData || jsonData.length === 0) {
        toast.error(language === "ar" ? "ملف Excel فارغ أو لا يحتوي على صفوف بيانات" : "Excel file is empty or has no data rows");
        return;
      }

      const studentsToCreate: StudentData[] = [];
      const usedUsernames = new Set<string>();

      // Process each row
      for (const row of jsonData) {
        // Support French, English, Arabic, and Massar column headers
        let prenom = getRowVal(row, [
          'Prénom', 'prenom', 'Prenoms', 'Prénoms',
          'First name', 'First Name', 'firstname', 'first_name',
          'الاسم', 'اسم', 'الإسم', 'إسم', 'الاسم الشخصي', 'الاسم الشخصي بالعربية', 'الاسم الشخصي بالفرنسية'
        ]);

        let nom = getRowVal(row, [
          'Nom', 'nom', 'Noms',
          'Last name', 'Last Name', 'lastname', 'last_name',
          'النسب', 'نسب', 'اللقب', 'لقب', 'الاسم العائلي', 'الاسم العائلي بالعربية', 'الاسم العائلي بالفرنسية'
        ]);

        // If not found in separate columns, check for combined full name column
        if (!prenom || !nom) {
          const fullName = getRowVal(row, [
            'Nom et Prénom', 'Nom & Prénom', 'Nom et Prenom', 'Nom Prénom', 'Nom Prenom',
            'Nom complet', 'Nom Complet', 'Full Name', 'fullname',
            'الاسم الكامل', 'الاسم والنسب', 'اسم التلميذ', 'التلميذ'
          ]);

          if (fullName) {
            const parts = fullName.trim().split(/\s+/);
            if (parts.length >= 2) {
              nom = parts[0];
              prenom = parts.slice(1).join(' ');
            } else if (parts.length === 1) {
              nom = parts[0];
              prenom = parts[0];
            }
          }
        }

        // Positional fallback: if still empty, take first two non-numeric string values
        if (!prenom || !nom) {
          const textValues = Object.values(row)
            .map(v => String(v ?? '').trim())
            .filter(v => v.length > 0 && isNaN(Number(v)) && !/^\d+$/.test(v));

          if (textValues.length >= 2) {
            prenom = textValues[0];
            nom = textValues[1];
          }
        }

        if (!prenom.trim() || !nom.trim()) {
          console.warn('Skipping unparseable row:', row);
          continue;
        }

        // Generate clean unique username
        const baseUsername = generateUsername(prenom.trim(), nom.trim());
        let username = baseUsername;
        let counter = 1;
        while (usedUsernames.has(username)) {
          username = `${baseUsername}${counter}`;
          counter++;
        }
        usedUsernames.add(username);

        const temporaryPassword = generateTempPassword();

        studentsToCreate.push({
          prenom: prenom.trim(),
          nom: nom.trim(),
          username,
          temporaryPassword
        });
      }

      if (studentsToCreate.length === 0) {
        toast.error(
          language === "ar"
            ? "لم يتم العثور على بيانات تلاميذ صالحة في ملف Excel. تأكد من وجود عمودي الاسم والنسب."
            : "No valid student data found in the Excel file. Please ensure 'First name' and 'Last name' columns exist."
        );
        return;
      }

      // Create students using edge function
      try {
        console.log('Creating students:', studentsToCreate);
        const { data: result, error: functionError } = await supabase.functions.invoke('create-student', {
          body: { 
            students: studentsToCreate,
            roomId: roomId 
          }
        });

        if (functionError) {
          console.error('Edge function error:', functionError);
          toast.error((language === "ar" ? "فشل إنشاء حسابات التلاميذ: " : "Failed to create students: ") + functionError.message);
          return;
        }

        if (result && result.success) {
          setGeneratedStudents(result.createdStudents || studentsToCreate);
          
          if (result.errors && result.errors.length > 0) {
            console.warn('Some students failed to create:', result.errors);
            toast.error(
              language === "ar"
                ? `تم إنشاء ${result.created} من أصل ${result.total} تلميذ. تعذر إنشاء بعض الحسابات.`
                : `Created ${result.created} out of ${result.total} students. Some failed.`
            );
            onStudentsImported?.();
          } else {
            toast.success(
              language === "ar"
                ? `تم استيراد ${result.created} تلميذ بنجاح!`
                : `Successfully imported ${result.created} students!`
            );
            onStudentsImported?.();
          }
        } else {
          console.error('Function result indicates failure:', result);
          throw new Error(result?.error || 'Unknown error occurred');
        }
      } catch (error: any) {
        console.error('Error calling create-student function:', error);
        toast.error((language === "ar" ? "خطأ في إنشاء التلاميذ: " : "Failed to import students: ") + (error?.message || ''));
        return;
      }

      setIsImportDialogOpen(false);
      setSelectedFile(null);

    } catch (error: any) {
      console.error('Error importing students:', error);
      const msg = error?.message ? `: ${error.message}` : '';
      toast.error(
        language === "ar"
          ? `فشل في استيراد التلاميذ من ملف الإكسل${msg}`
          : `Failed to import students from Excel file${msg}`
      );
    } finally {
      setImporting(false);
    }
  };

  // Fetch existing students from database
  const fetchExistingStudents = async () => {
    try {
      const { data: students, error } = await supabase
        .from('profiles')
        .select('name, username, email, temporary_password')
        .eq('role', 'student')
        .eq('room_id', roomId);

      if (error) {
        console.error('Error fetching students:', error);
        return;
      }

      const formattedStudents: StudentData[] = students.map(student => ({
        prenom: student.name.split(' ')[0] || '',
        nom: student.name.split(' ').slice(1).join(' ') || '',
        username: student.username || '',
        temporaryPassword: student.temporary_password || ''
      }));

      setAllStudentsForDownload(formattedStudents);
    } catch (error) {
      console.error('Error fetching existing students:', error);
    }
  };

  // Load existing students on component mount
  useEffect(() => {
    fetchExistingStudents();
  }, [roomId]);

  // Update download list when students are imported or deleted
  useEffect(() => {
    fetchExistingStudents();
  }, [existingStudents]);

  // Download student list with credentials
  const handleDownloadList = async () => {
    if (allStudentsForDownload.length === 0) {
      toast.error("No students to download. Add students first.");
      return;
    }

    try {
      const worksheetData = allStudentsForDownload.map(student => ({
        'Prénom': student.prenom,
        'Nom': student.nom,
        'Username': student.username,
        'Temporary Password': student.temporaryPassword
      }));

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `students_credentials_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, filename);
      toast.success("Student list downloaded successfully");
    } catch (error) {
      console.error('Error downloading student list:', error);
      toast.error("Failed to download student list");
    }
  };

  if (user?.role !== 'professor') {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {language === "ar" ? "إدارة التلاميذ" : "Student Management"}
        </CardTitle>
        <CardDescription>
          {language === "ar" ? "استيراد التلاميذ عبر ملف Excel وإدارة بيانات الدخول" : "Import students from Excel and manage student credentials"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
            setIsImportDialogOpen(open);
            if (!open) {
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                {language === "ar" ? "استيراد من Excel" : "Import from Excel"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{language === "ar" ? "استيراد التلاميذ من Excel" : "Import Students from Excel"}</DialogTitle>
                <DialogDescription>
                  {language === "ar" 
                    ? "قم برفع ملف Excel يحتوي على عمودي الاسم والنسب (أو Prénom/Nom أو First name/Last name) لإنشاء حسابات التلاميذ." 
                    : "Upload an Excel file with First Name and Last Name columns (supports Arabic, French, and English headers)."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="excel-file">{language === "ar" ? "ملف Excel" : "Excel File"}</Label>
                  <input
                    ref={fileInputRef}
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 shrink-0"
                    >
                      <Upload className="h-4 w-4" />
                      {language === "ar" ? "اختيار ملف" : "Choose File"}
                    </Button>
                    <span className="text-sm text-muted-foreground truncate max-w-full sm:max-w-[260px]">
                      {selectedFile 
                        ? selectedFile.name 
                        : (language === "ar" ? "لم يتم اختيار أي ملف" : "No file chosen")}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground">{language === "ar" ? "الأعمدة المدعومة (اختر لغة واحدة):" : "Supported column headers:"}</p>
                  <div className="space-y-2 text-xs bg-muted/50 p-3 rounded-md border">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{language === "ar" ? "بالعربية:" : "Arabic:"}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono bg-background px-2 py-0.5 rounded border">الاسم</span>
                        <span>+</span>
                        <span className="font-mono bg-background px-2 py-0.5 rounded border">النسب</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{language === "ar" ? "بالفرنسية:" : "French:"}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono bg-background px-2 py-0.5 rounded border">Prénom</span>
                        <span>+</span>
                        <span className="font-mono bg-background px-2 py-0.5 rounded border">Nom</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{language === "ar" ? "بالإنجليزية:" : "English:"}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono bg-background px-2 py-0.5 rounded border">First name</span>
                        <span>+</span>
                        <span className="font-mono bg-background px-2 py-0.5 rounded border">Last name</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsImportDialogOpen(false)}
                >
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button 
                  onClick={handleImportStudents}
                  disabled={!selectedFile || importing}
                >
                  {importing ? (language === "ar" ? "جاري الاستيراد..." : "Importing...") : (language === "ar" ? "استيراد التلاميذ" : "Import Students")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={handleDownloadList}
            disabled={allStudentsForDownload.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {language === "ar" ? "تحميل القائمة" : "Download List"}
          </Button>
        </div>

        {allStudentsForDownload.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              {allStudentsForDownload.length} {language === "ar" ? "تلميذ متاح للتحميل" : "students available for download"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};