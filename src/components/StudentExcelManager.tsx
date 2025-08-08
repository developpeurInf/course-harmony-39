import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet, Users } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { useAuth } from "@/contexts/AuthContext";
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
}

export const StudentExcelManager: React.FC<StudentExcelManagerProps> = ({ 
  roomId, 
  onStudentsImported 
}) => {
  const { user } = useAuth();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [generatedStudents, setGeneratedStudents] = useState<StudentData[]>([]);

  // Generate username from name
  const generateUsername = (prenom: string, nom: string): string => {
    const cleanPrenom = prenom.toLowerCase().replace(/[^a-z]/g, '');
    const cleanNom = nom.toLowerCase().replace(/[^a-z]/g, '');
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
      toast.error("Please select an Excel file (.xlsx or .xls)");
      return;
    }

    setSelectedFile(file);
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
      const createdStudents: StudentData[] = [];

      // Process each row
      for (const row of jsonData) {
        const prenom = row['Prénom'] || row['prenom'] || row['Prenom'] || '';
        const nom = row['Nom'] || row['nom'] || '';

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
        toast.error("No valid student data found in the Excel file");
        return;
      }

      // Create students in Supabase Auth and profiles
      for (const student of studentsToCreate) {
        try {
          // Create user account
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: `${student.username}@school.edu`,
            password: student.temporaryPassword,
            user_metadata: {
              name: `${student.prenom} ${student.nom}`,
              role: 'student',
              room_id: roomId
            }
          });

          if (authError) {
            console.error(`Failed to create user ${student.username}:`, authError);
            continue;
          }

          // Create profile (this should be handled by the trigger, but let's ensure it)
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: authData.user.id,
              name: `${student.prenom} ${student.nom}`,
              email: `${student.username}@school.edu`,
              role: 'student'
            });

          if (profileError) {
            console.error(`Failed to create profile for ${student.username}:`, profileError);
          }

          createdStudents.push(student);
        } catch (error) {
          console.error(`Error creating student ${student.username}:`, error);
        }
      }

      setGeneratedStudents(createdStudents);
      toast.success(`Successfully imported ${createdStudents.length} students`);
      setIsImportDialogOpen(false);
      setSelectedFile(null);
      onStudentsImported?.();

    } catch (error) {
      console.error('Error importing students:', error);
      toast.error("Failed to import students from Excel file");
    } finally {
      setImporting(false);
    }
  };

  // Download student list with credentials
  const handleDownloadList = async () => {
    if (generatedStudents.length === 0) {
      toast.error("No students to download. Import students first.");
      return;
    }

    try {
      const worksheetData = generatedStudents.map(student => ({
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
          Student Management
        </CardTitle>
        <CardDescription>
          Import students from Excel and manage student credentials
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Import from Excel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Students from Excel</DialogTitle>
                <DialogDescription>
                  Upload an Excel file with columns "Prénom" and "Nom" to create student accounts.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="excel-file">Excel File</Label>
                  <Input
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                  />
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium">Required columns:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Prénom (or prenom, Prenom)</li>
                    <li>Nom (or nom)</li>
                  </ul>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsImportDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleImportStudents}
                  disabled={!selectedFile || importing}
                >
                  {importing ? "Importing..." : "Import Students"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={handleDownloadList}
            disabled={generatedStudents.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Download List
          </Button>
        </div>

        {generatedStudents.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              {generatedStudents.length} students imported and ready for download
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};