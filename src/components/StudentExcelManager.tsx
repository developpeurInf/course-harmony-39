import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet, Users } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { iosCompatibleXlsxDownload } from '@/lib/download';
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

  // Helper to extract value from row matching various possible column headers
  const getRowVal = (row: any, candidates: string[]): string => {
    for (const [key, val] of Object.entries(row)) {
      const cleanKey = key.trim().toLowerCase();
      for (const cand of candidates) {
        if (cleanKey === cand.trim().toLowerCase()) {
          return String(val ?? '').trim();
        }
      }
    }
    return '';
  };

  // Parse Excel file and import students
  const handleImportStudents = async () => {
    if (!selectedFile || !user) return;

    setImporting(true);
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      const studentsToCreate: StudentData[] = [];

      // Process each row
      for (const row of jsonData) {
        // Support French (Prénom/Nom), English (First name/Last name), and Arabic (الاسم/النسب)
        const prenom = getRowVal(row, [
          'Prénom', 'prenom', 'Prenom', 'Prenoms', 'Prénoms',
          'First name', 'First Name', 'firstname', 'FirstName', 'First_Name', 'first_name',
          'الاسم', 'اسم', 'الإسم', 'إسم', 'الاسم الشخصي'
        ]);

        const nom = getRowVal(row, [
          'Nom', 'nom', 'Noms',
          'Last name', 'Last Name', 'lastname', 'LastName', 'Last_Name', 'last_name',
          'النسب', 'نسب', 'اللقب', 'لقب', 'الاسم العائلي'
        ]);

        if (!prenom.trim() || !nom.trim()) {
          console.warn('Skipping row with missing name:', row);
          continue;
        }

        const username = generateUsername(prenom.trim(), nom.trim());
        const temporaryPassword = generateTempPassword();

        studentsToCreate.push({
          prenom: prenom.trim(),
          nom: nom.trim(),
          username,
          temporaryPassword
        });
      }

      if (studentsToCreate.length === 0) {
        toast.error(language === "ar" ? "لم يتم العثور على بيانات تلاميذ صالحة في ملف Excel" : "No valid student data found in the Excel file");
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

        console.log('Edge function result:', result);
        console.log('Edge function error:', functionError);

        if (functionError) {
          console.error('Edge function error:', functionError);
          toast.error("Failed to create students: " + functionError.message);
          return;
        }

        if (result && result.success) {
          setGeneratedStudents(result.createdStudents || studentsToCreate);
          
          if (result.errors && result.errors.length > 0) {
            console.warn('Some students failed to create:', result.errors);
            toast.error(`Created ${result.created} out of ${result.total} students. Some failed - check console for details.`);
            
            // Still consider it partially successful, so refresh the parent
            onStudentsImported?.();
          } else {
            toast.success(`Successfully imported ${result.created} students`);
            onStudentsImported?.();
          }
        } else {
          console.error('Function result indicates failure:', result);
          throw new Error(result?.error || 'Unknown error occurred');
        }
      } catch (error) {
        console.error('Error calling create-student function:', error);
        toast.error("Failed to import students");
        return;
      }

      setIsImportDialogOpen(false);
      setSelectedFile(null);

    } catch (error) {
      console.error('Error importing students:', error);
      toast.error("Failed to import students from Excel file");
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

      iosCompatibleXlsxDownload(XLSX, workbook, filename);
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