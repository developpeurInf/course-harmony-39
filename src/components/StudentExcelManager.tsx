import { useAccess } from "@/contexts/AccessContext";
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet, Users, UserPlus, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type * as ExcelJSTypes from 'exceljs';
import { downloadExcelFile } from '@/lib/download';
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { downloadBlob } from "@/lib/download";
import { fetchRoomPasswords } from "@/lib/studentPasswords";

/** xlsx chargé seulement quand on en a besoin (allège le chargement de la page). */
const loadXlsx = async (): Promise<any> => {
  const mod: any = await import('xlsx');
  return mod && mod.utils ? mod : mod.default;
};

interface StudentData {
  prenom: string;
  nom: string;
  codeMassar?: string;
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
  const { guard, guardQuota } = useAccess();
  const tr = (ar: string, fr: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [generatedStudents, setGeneratedStudents] = useState<StudentData[]>([]);
  const [allStudentsForDownload, setAllStudentsForDownload] = useState<StudentData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Manual (single) student creation
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [manualPrenom, setManualPrenom] = useState('');
  const [manualNom, setManualNom] = useState('');
  const [manualMassar, setManualMassar] = useState('');
  const [manualCreating, setManualCreating] = useState(false);
  const [manualCreated, setManualCreated] = useState<StudentData | null>(null);
  const [manualCopied, setManualCopied] = useState(false);
  const manualLockRef = useRef(false);
  // Lignes non importées (nom + raison), affichées dans la boîte d'import
  const [importFailures, setImportFailures] = useState<{ name: string; reason: string }[]>([]);

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

  // Generate temporary password (crypto.getRandomValues, repli Math.random)
  const generateTempPassword = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    try {
      const buf = new Uint32Array(8);
      window.crypto.getRandomValues(buf);
      for (let i = 0; i < 8; i++) password += chars.charAt(buf[i] % chars.length);
      return password;
    } catch {
      password = '';
    }
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
      toast.error(language === "ar" ? "يرجى اختيار ملف بصيغة Excel (.xlsx أو .xls)" : language === "fr" ? "Veuillez sélectionner un fichier Excel (.xlsx ou .xls)" : "Please select an Excel file (.xlsx or .xls)");
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
      const XLSX = await loadXlsx();
      const ws = XLSX.utils.json_to_sheet([
        { 'الاسم': 'أحمد', 'النسب': 'العلوي', 'Code Massar': 'M130012345' },
        { 'الاسم': 'فاطمة', 'النسب': 'الزهراء', 'Code Massar': 'M130012346' },
        { 'الاسم': 'يوسف', 'النسب': 'المرابط', 'Code Massar': 'M130012347' }
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      await downloadExcelFile(wb, "Modele_Eleves.xlsx");
    } catch (e: any) {
      console.error('Template download error:', e);
      toast.error(language === "ar" ? "فشل تحميل نموذج Excel" : language === "fr" ? "Échec du téléchargement du modèle" : "Failed to download template");
    }
  };

  const handleImportStudents = async () => {
    if (!selectedFile || !user) return;

    setImporting(true);
    setImportFailures([]);
    try {
      // 1. Read file with iOS-safe FileReader (xlsx chargé à la demande)
      const [data, XLSX] = await Promise.all([readFileAsArrayBuffer(selectedFile), loadXlsx()]);
      const workbook = XLSX.read(data, { type: 'array' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error(language === "ar" ? "الملف فارغ أو غير صالح" : language === "fr" ? "Fichier Excel vide ou invalide" : "Empty or invalid Excel file");
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (!jsonData || jsonData.length === 0) {
        toast.error(language === "ar" ? "ملف Excel فارغ أو لا يحتوي على صفوف بيانات" : language === "fr" ? "Le fichier Excel est vide ou ne contient aucune ligne de données" : "Excel file is empty or has no data rows");
        return;
      }

      const studentsToCreate: StudentData[] = [];
      const usedUsernames = new Set<string>();
      const skipped: { name: string; reason: string }[] = [];

      // Process each row
      for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
        const row = jsonData[rowIndex];
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

        // Parse Code Massar column
        const codeMassar = getRowVal(row, [
          'Code Massar', 'code massar', 'CodeMassar', 'Massar', 'massar',
          'رمز مسار', 'رمز المسار', 'كود مسار', 'مسار'
        ]);

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
          skipped.push({
            name: (prenom || nom || '').trim() || tr(`السطر ${rowIndex + 2}`, `Ligne ${rowIndex + 2}`, `Row ${rowIndex + 2}`),
            reason: tr("الاسم أو النسب غير موجود", "Prénom ou nom manquant", "Missing first or last name"),
          });
          continue;
        }

        // Use Code Massar as username if available, otherwise generate from name
        let username: string;
        if (codeMassar && codeMassar.trim()) {
          username = codeMassar.trim();
        } else {
          const baseUsername = generateUsername(prenom.trim(), nom.trim());
          username = baseUsername;
          let counter = 1;
          while (usedUsernames.has(username)) {
            username = `${baseUsername}${counter}`;
            counter++;
          }
        }
        usedUsernames.add(username);

        const temporaryPassword = generateTempPassword();

        studentsToCreate.push({
          prenom: prenom.trim(),
          nom: nom.trim(),
          codeMassar: codeMassar ? codeMassar.trim() : undefined,
          username,
          temporaryPassword
        });
      }

      if (studentsToCreate.length > 0 && !guardQuota("students.max", studentsToCreate.length)) {
        return;
      }

      if (studentsToCreate.length === 0) {
        setImportFailures(skipped);
        toast.error(tr(
          "لم يتم العثور على بيانات تلاميذ صالحة في ملف Excel. تأكد من وجود عمودي الاسم والنسب.",
          "Aucun élève valide trouvé dans le fichier Excel. Vérifiez les colonnes « Prénom » et « Nom ».",
          "No valid student data found in the Excel file. Please ensure 'First name' and 'Last name' columns exist."
        ));
        return;
      }

      // Create students using edge function
      try {
        const { data: result, error: functionError } = await supabase.functions.invoke('create-student', {
          body: { 
            students: studentsToCreate,
            roomId: roomId,
            purpose: 'import'
          }
        });

        if (functionError) {
          console.error('Edge function error:', functionError);
          toast.error(tr("فشل إنشاء حسابات التلاميذ", "Échec de la création des élèves", "Failed to create students"));
          return;
        }

        if (result && result.success) {
          setGeneratedStudents(result.createdStudents || studentsToCreate);
          
          const serverFailures: { name: string; reason: string }[] = (result.errors || []).map((e: any) => ({
            name: String(e?.student || '?'),
            reason: String(e?.error || tr("خطأ غير معروف", "Erreur inconnue", "Unknown error")),
          }));
          const failures = [...skipped, ...serverFailures];
          if (failures.length > 0) {
            // On garde la boîte ouverte pour montrer les lignes non importées
            setImportFailures(failures);
            toast.error(tr(
              `تم إنشاء ${result.created} تلميذ. تعذر استيراد ${failures.length} سطر.`,
              `${result.created} élève(s) créé(s). ${failures.length} ligne(s) non importée(s).`,
              `Created ${result.created} student(s). ${failures.length} row(s) not imported.`
            ));
            onStudentsImported?.();
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }
          toast.success(tr(
            `تم استيراد ${result.created} تلميذ بنجاح!`,
            `${result.created} élève(s) importé(s) avec succès`,
            `Successfully imported ${result.created} students!`
          ));
          onStudentsImported?.();
        } else {
          console.error('Function result indicates failure:', result);
          throw new Error(result?.error || 'Unknown error occurred');
        }
      } catch (error: any) {
        console.error('Error calling create-student function:', error);
        toast.error(tr("خطأ في إنشاء التلاميذ", "Échec de l'importation des élèves", "Failed to import students"));
        return;
      }

      setIsImportDialogOpen(false);
      setSelectedFile(null);

    } catch (error: any) {
      console.error('Error importing students:', error);
      toast.error(tr(
        "فشل في استيراد التلاميذ من ملف الإكسل",
        "Échec de l'importation du fichier Excel",
        "Failed to import students from Excel file"
      ));
    } finally {
      setImporting(false);
    }
  };

  const resetManualForm = () => {
    setManualPrenom('');
    setManualNom('');
    setManualMassar('');
    setManualCreated(null);
    setManualCopied(false);
  };

  // Create one student manually (same pipeline as the Excel import)
  const handleCreateManualStudent = async () => {
    if (manualLockRef.current) return;
    const prenom = manualPrenom.trim().replace(/\s+/g, ' ');
    const nom = manualNom.trim().replace(/\s+/g, ' ');
    const codeMassar = manualMassar.trim().replace(/\s+/g, '').toUpperCase();

    if (!prenom || !nom) {
      toast.error(tr("يرجى إدخال الاسم والنسب", "Veuillez saisir le prénom et le nom", "Please enter first and last name"));
      return;
    }
    if (codeMassar && !/^[A-Z0-9]{4,20}$/.test(codeMassar)) {
      toast.error(tr("رمز مسار غير صالح (حروف وأرقام فقط)", "Code Massar invalide (lettres et chiffres uniquement)", "Invalid Massar code (letters and digits only)"));
      return;
    }

    manualLockRef.current = true;
    setManualCreating(true);
    try {
      let username = codeMassar || generateUsername(prenom, nom);

      // Never overwrite an existing account: the edge function recreates existing users.
      const { data: existing } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('username', username)
        .maybeSingle();
      const inRoom = existingStudents.some(s => (s.username || '').toLowerCase() === username.toLowerCase());
      if (existing || inRoom) {
        if (codeMassar) {
          toast.error(tr(
            `رمز مسار ${codeMassar} مستعمل مسبقاً${existing?.name ? ` (${existing.name})` : ''}`,
            `Le code Massar ${codeMassar} existe déjà${existing?.name ? ` (${existing.name})` : ''}`,
            `Massar code ${codeMassar} already exists${existing?.name ? ` (${existing.name})` : ''}`
          ));
          return;
        }
        username = `${username}${Math.floor(100 + Math.random() * 900)}`;
      }

      const student: StudentData = {
        prenom,
        nom,
        codeMassar: codeMassar || undefined,
        username,
        temporaryPassword: generateTempPassword(),
      };

      const { data: result, error: functionError } = await supabase.functions.invoke('create-student', {
        body: { students: [student], roomId, purpose: 'create' }
      });
      if (functionError) throw functionError;
      if (!result?.success || (result.errors && result.errors.length > 0) || !result.created) {
        const msg = result?.errors?.[0]?.error || result?.error || 'Unknown error';
        throw new Error(msg);
      }

      const created: StudentData = { ...student, ...(result.createdStudents?.[0] || {}) };
      setManualCreated(created);
      setAllStudentsForDownload(prev => [...prev, created]);
      toast.success(tr(
        `تم إنشاء حساب ${prenom} ${nom}`,
        `Compte de ${prenom} ${nom} créé`,
        `Account for ${prenom} ${nom} created`
      ));
      onStudentsImported?.();
    } catch (error: any) {
      console.error('Manual student creation failed:', error?.message || error);
      toast.error(tr("فشل إنشاء التلميذ", "Échec de la création de l'élève", "Failed to create student"));
    } finally {
      manualLockRef.current = false;
      setManualCreating(false);
    }
  };

  const copyManualCredentials = async () => {
    if (!manualCreated) return;
    const text = `${manualCreated.prenom} ${manualCreated.nom}\n${tr("اسم المستخدم", "Identifiant", "Username")}: ${manualCreated.username}\n${tr("كلمة المرور", "Mot de passe", "Password")}: ${manualCreated.temporaryPassword}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setManualCopied(true);
      setTimeout(() => setManualCopied(false), 2000);
    } catch {
      toast.error(tr("تعذر النسخ", "Copie impossible", "Copy failed"));
    }
  };

  // Fetch existing students from database
  const fetchExistingStudents = async () => {
    if (!roomId) return;
    try {
      const { data: students, error } = await supabase
        .from('profiles')
        .select('id, name, username, email')
        .eq('role', 'student')
        .eq('room_id', roomId);
      const passwords = await fetchRoomPasswords(roomId);

      if (error) {
        console.error('Error fetching students:', error);
        return;
      }

      if (students && students.length > 0) {
        const formattedStudents: StudentData[] = students.map(student => {
          const parts = (student.name || '').trim().split(/\s+/);
          const prenom = parts[0] || '';
          const nom = parts.slice(1).join(' ') || student.name || '';
          return {
            prenom,
            nom,
            codeMassar: student.username || '',
            username: student.username || '',
            temporaryPassword: passwords.get(student.id) || ''
          };
        });

        setAllStudentsForDownload(formattedStudents);
      }
    } catch (error) {
      console.error('Error fetching existing students:', error);
    }
  };

  // Load existing students on component mount and when props change
  useEffect(() => {
    if (existingStudents && existingStudents.length > 0) {
      setAllStudentsForDownload(existingStudents);
    } else {
      fetchExistingStudents();
    }
  }, [roomId, existingStudents]);

  // Download student list with credentials (4 columns with black borders)
  const handleDownloadList = async () => {
    if (!guard("student.export_excel")) return;
    let studentList = allStudentsForDownload;
    if (studentList.length === 0 && existingStudents && existingStudents.length > 0) {
      studentList = existingStudents;
    }

    if (studentList.length === 0 && roomId) {
      const { data: dbStudents } = await supabase
        .from('profiles')
        .select('id, name, username, email')
        .eq('role', 'student')
        .eq('room_id', roomId);
      const passwords = await fetchRoomPasswords(roomId);

      if (dbStudents && dbStudents.length > 0) {
        studentList = dbStudents.map(student => {
          const parts = (student.name || '').trim().split(/\s+/);
          return {
            prenom: parts[0] || '',
            nom: parts.slice(1).join(' ') || student.name || '',
            codeMassar: student.username || '',
            username: student.username || '',
            temporaryPassword: passwords.get(student.id) || ''
          };
        });
        setAllStudentsForDownload(studentList);
      }
    }

    // mots de passe provisoires manquants (liste fournie par la page parente)
    if (roomId && studentList.some((s) => !s.temporaryPassword)) {
      const passwords = await fetchRoomPasswords(roomId);
      studentList = studentList.map((s) => ({ ...s, temporaryPassword: s.temporaryPassword || passwords.get(`u:${s.username}`) || '' }));
    }

    if (studentList.length === 0) {
      toast.error(tr(
        "لا يوجد تلاميذ في هذا القسم لتحميل القائمة.",
        "Aucun élève trouvé dans cette classe pour le téléchargement.",
        "No students in this class to download."
      ));
      return;
    }

    try {
      // Génération d'un vrai fichier .xlsx avec bordures noires via ExcelJS (chargé à la demande)
      const excelMod: any = await import('exceljs');
      const ExcelJS = excelMod.default && excelMod.default.Workbook ? excelMod.default : excelMod;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Course Harmony';
      workbook.created = new Date();

      // Noms des colonnes selon la langue (le contenu des cellules n'est pas traduit)
      const colHeaders = language === 'ar'
        ? { nom: 'النسب', prenom: 'الاسم', massar: 'رمز مسار', pwd: 'كلمة المرور المؤقتة', sheet: 'بيانات التلاميذ' }
        : language === 'fr'
        ? { nom: 'Nom', prenom: 'Prénom', massar: 'Code Massar', pwd: 'Mot de passe temporaire', sheet: 'Identifiants Élèves' }
        : { nom: 'Last Name', prenom: 'First Name', massar: 'Massar Code', pwd: 'Temporary Password', sheet: 'Student Credentials' };

      const sheet = workbook.addWorksheet(colHeaders.sheet);

      // Largeurs des colonnes
      sheet.columns = [
        { header: colHeaders.nom,    key: 'nom',    width: 28 },
        { header: colHeaders.prenom, key: 'prenom', width: 28 },
        { header: colHeaders.massar, key: 'massar', width: 22 },
        { header: colHeaders.pwd,    key: 'pwd',    width: 28 },
      ];

      // Style partagé pour les bordures noires
      const thinBlack: Partial<ExcelJSTypes.Borders> = {
        top:    { style: 'thin', color: { argb: 'FF000000' } },
        left:   { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right:  { style: 'thin', color: { argb: 'FF000000' } },
      };

      // Style de l'en-tête
      const headerRow = sheet.getRow(1);
      headerRow.height = 22;
      headerRow.eachCell((cell: any) => {
        cell.font      = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF000000' } };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border    = thinBlack;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Ajout des lignes de données
      studentList.forEach((s, idx) => {
        const row = sheet.addRow({
          nom:    s.nom    || '',
          prenom: s.prenom || '',
          massar: s.codeMassar || s.username || '',
          pwd:    s.temporaryPassword || '',
        });
        row.height = 18;
        row.eachCell((cell: any, colNumber: number) => {
          cell.border    = thinBlack;
          cell.font      = { size: 11, name: 'Calibri', color: { argb: 'FF000000' } };
          cell.fill      = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB' },
          };
          cell.alignment = { vertical: 'middle', horizontal: colNumber >= 3 ? 'center' : 'left' };
          // Forcer le format texte pour Code Massar et mot de passe (évite la conversion numérique)
          if (colNumber >= 3) cell.numFmt = '@';
        });
      });

      // Figer la première ligne (en-tête)
      sheet.views = [{ state: 'frozen', ySplit: 1 }];

      // Générer le buffer et télécharger
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `liste_identifiants_eleves_${timestamp}.xlsx`;

      await downloadBlob(blob, filename);

      toast.success(tr(
        "تم تحميل لائحة التلاميذ وبيانات الدخول بنجاح",
        "Liste des élèves et identifiants téléchargée avec succès",
        "Student list and credentials downloaded"
      ));
    } catch (error) {
      console.error('Error downloading student list:', error);
      toast.error(tr("فشل تحميل القائمة", "Échec du téléchargement de la liste", "Failed to download student list"));
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
          {language === "ar" ? "إدارة التلاميذ" : language === "fr" ? "Gestion des élèves" : "Student Management"}
        </CardTitle>
        <CardDescription>
          {language === "ar" ? "استيراد التلاميذ عبر ملف Excel وإدارة بيانات الدخول" : language === "fr" ? "Importer des élèves via Excel et gérer les identifiants" : "Import students from Excel and manage student credentials"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
            if (open && !guard("student.import_excel")) return;
            setIsImportDialogOpen(open);
            if (!open) {
              setSelectedFile(null);
              setImportFailures([]);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }
          }}>
            <DialogTrigger asChild>
              <Button className="font-semibold text-xs sm:text-sm">
                <Upload className="h-4 w-4" />
                {language === "ar" ? "استيراد من Excel" : language === "fr" ? "Importer depuis Excel" : "Import from Excel"}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{language === "ar" ? "استيراد التلاميذ من Excel" : language === "fr" ? "Importer des élèves depuis Excel" : "Import Students from Excel"}</DialogTitle>
                <DialogDescription>
                  {tr(
                    "قم برفع ملف Excel يحتوي على أعمدة الاسم والنسب ورمز مسار (Code Massar) لإنشاء حسابات التلاميذ.",
                    "Envoyez un fichier Excel avec les colonnes Prénom, Nom et Code Massar (en-têtes en arabe, français ou anglais).",
                    "Upload an Excel file with Prénom, Nom and Code Massar columns (Arabic, French and English headers supported)."
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {importFailures.length > 0 && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
                    <p className="font-semibold text-destructive mb-2">
                      {tr(
                        `${importFailures.length} سطر لم يتم استيراده :`,
                        `${importFailures.length} ligne(s) non importée(s) :`,
                        `${importFailures.length} row(s) not imported:`
                      )}
                    </p>
                    <ul className="max-h-48 overflow-y-auto space-y-1">
                      {importFailures.map((f, i) => (
                        <li key={i} className="flex flex-wrap gap-x-2 min-w-0">
                          <span className="font-medium break-all">{f.name}</span>
                          <span className="text-muted-foreground break-all">— {f.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="excel-file">{language === "ar" ? "ملف Excel" : language === "fr" ? "Fichier Excel" : "Excel File"}</Label>
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
                      {language === "ar" ? "اختيار ملف" : language === "fr" ? "Choisir un fichier" : "Choose File"}
                    </Button>
                    <span className="text-sm text-muted-foreground truncate max-w-full sm:max-w-[260px]">
                      {selectedFile 
                        ? selectedFile.name 
                        : (language === "ar" ? "لم يتم اختيار أي ملف" : language === "fr" ? "Aucun fichier choisi" : "No file chosen")}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground">{language === "ar" ? "الأعمدة المدعومة (اختر لغة واحدة):" : language === "fr" ? "En-têtes de colonnes acceptés :" : "Supported column headers:"}</p>
                  <div className="space-y-2 text-xs bg-muted/50 p-3 rounded-md border">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{language === "ar" ? "بالعربية:" : language === "fr" ? "Arabe :" : "Arabic:"}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono bg-background px-2 py-0.5 rounded border">الاسم</span>
                        <span>+</span>
                        <span className="font-mono bg-background px-2 py-0.5 rounded border">النسب</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{language === "ar" ? "بالفرنسية:" : language === "fr" ? "Français :" : "French:"}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono bg-background px-2 py-0.5 rounded border">Prénom</span>
                        <span>+</span>
                        <span className="font-mono bg-background px-2 py-0.5 rounded border">Nom</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{language === "ar" ? "بالإنجليزية:" : language === "fr" ? "Anglais :" : "English:"}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono bg-background px-2 py-0.5 rounded border">First name</span>
                        <span>+</span>
                        <span className="font-mono bg-background px-2 py-0.5 rounded border">Last name</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2 mt-1">
                      <span className="font-semibold text-foreground text-primary">{language === "ar" ? "رمز مسار (مُعرِّف):" : language === "fr" ? "Identifiant :" : "Identifier:"}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/30">Code Massar</span>
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
                  {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button 
                  onClick={handleImportStudents}
                  disabled={!selectedFile || importing}
                >
                  {importing ? (language === "ar" ? "جاري الاستيراد..." : language === "fr" ? "Importation..." : "Importing...") : (language === "ar" ? "استيراد التلاميذ" : language === "fr" ? "Importer les élèves" : "Import Students")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isManualDialogOpen} onOpenChange={(open) => {
            if (manualCreating) return;
            if (open && (!guard("student.create") || !guardQuota("students.max"))) return;
            setIsManualDialogOpen(open);
            if (!open) resetManualForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="font-semibold text-xs sm:text-sm">
                <UserPlus className="h-4 w-4" />
                {tr("إضافة تلميذ يدوياً", "Ajouter un élève", "Add a student")}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{tr("إضافة تلميذ جديد", "Ajouter un nouvel élève", "Add a new student")}</DialogTitle>
                <DialogDescription>
                  {tr(
                    "سيتم إنشاء الحساب تلقائياً (اسم المستخدم = رمز مسار) مع كلمة مرور مؤقتة، وإضافته إلى هذا القسم.",
                    "Le compte est créé automatiquement (identifiant = code Massar) avec un mot de passe temporaire, puis ajouté à cette classe.",
                    "The account is created automatically (username = Massar code) with a temporary password and added to this class."
                  )}
                </DialogDescription>
              </DialogHeader>

              {manualCreated ? (
                <div className="space-y-3 py-2">
                  <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-2">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                      {manualCreated.prenom} {manualCreated.nom}
                    </p>
                    <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
                      <span className="text-muted-foreground">{tr("اسم المستخدم", "Identifiant", "Username")}</span>
                      <span className="font-mono font-semibold break-all" dir="ltr">{manualCreated.username}</span>
                      <span className="text-muted-foreground">{tr("كلمة المرور", "Mot de passe", "Password")}</span>
                      <span className="font-mono font-semibold break-all" dir="ltr">{manualCreated.temporaryPassword}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tr(
                      "سيُقترح على التلميذ تغيير كلمة المرور عند أول تسجيل دخول.",
                      "À la première connexion, l'élève pourra changer son mot de passe.",
                      "At first login, the student will be offered to change the password."
                    )}
                  </p>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={copyManualCredentials}>
                      {manualCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      {manualCopied ? tr("تم النسخ", "Copié", "Copied") : tr("نسخ البيانات", "Copier les identifiants", "Copy credentials")}
                    </Button>
                    <Button variant="outline" onClick={resetManualForm}>
                      <UserPlus className="h-4 w-4" />
                      {tr("إضافة آخر", "Ajouter un autre", "Add another")}
                    </Button>
                    <Button onClick={() => { setIsManualDialogOpen(false); resetManualForm(); }}>
                      {tr("إغلاق", "Fermer", "Close")}
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <form
                  className="space-y-4 py-2"
                  onSubmit={(e) => { e.preventDefault(); handleCreateManualStudent(); }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-prenom">{tr("الاسم", "Prénom", "First name")} *</Label>
                    <Input id="manual-prenom" value={manualPrenom} onChange={(e) => setManualPrenom(e.target.value)} disabled={manualCreating} autoComplete="off" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-nom">{tr("النسب", "Nom", "Last name")} *</Label>
                    <Input id="manual-nom" value={manualNom} onChange={(e) => setManualNom(e.target.value)} disabled={manualCreating} autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-massar">Code Massar</Label>
                    <Input id="manual-massar" value={manualMassar} onChange={(e) => setManualMassar(e.target.value)} disabled={manualCreating} autoComplete="off" autoCapitalize="characters" placeholder="M130012345" dir="ltr" className="font-mono" />
                    <p className="text-xs text-muted-foreground">
                      {tr(
                        "اختياري — إن تُرك فارغاً يُنشأ اسم المستخدم من الاسم والنسب.",
                        "Facultatif — si vide, l'identifiant est généré à partir du prénom et du nom.",
                        "Optional — if empty, the username is generated from the name."
                      )}
                    </p>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsManualDialogOpen(false)} disabled={manualCreating}>
                      {tr("إلغاء", "Annuler", "Cancel")}
                    </Button>
                    <Button type="submit" disabled={manualCreating || !manualPrenom.trim() || !manualNom.trim()}>
                      {manualCreating ? tr("جاري الإنشاء...", "Création...", "Creating...") : tr("إنشاء الحساب", "Créer le compte", "Create account")}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={handleDownloadList}
            disabled={allStudentsForDownload.length === 0 && (!existingStudents || existingStudents.length === 0)}
            className="font-medium"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
            {language === "ar" ? "تحميل قائمة الحسابات" : language === "fr" ? "Télécharger la liste" : "Download List"}
          </Button>
        </div>

        {(allStudentsForDownload.length > 0 || (existingStudents && existingStudents.length > 0)) && (
          <div className="text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              {allStudentsForDownload.length || existingStudents?.length} {language === "ar" ? "تلميذ متاح للتحميل مع كلمات المرور" : language === "fr" ? "élèves disponibles au téléchargement avec mots de passe" : "students available for download with passwords"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};