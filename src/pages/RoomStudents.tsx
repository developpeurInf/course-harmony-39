import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, UserX, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StudentExcelManager } from "@/components/StudentExcelManager";

interface Student {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: string;
  avatar_url?: string;
  created_at: string;
}

const RoomStudents = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { refreshData } = useCourses();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && roomId) {
      loadStudents();
    }
  }, [user, roomId]);

  const loadStudents = async () => {
    if (!roomId) return;
    
    setLoading(true);
    try {
      // Get all students for professors (they can manage and enroll them as needed)
      // This includes newly imported students who may not be enrolled in courses yet
      const { data: allStudents, error: allStudentsError } = await supabase
        .from('profiles')
        .select('id, name, email, username, role, avatar_url, created_at')
        .eq('role', 'student');

      if (allStudentsError) {
        console.error('Error fetching students:', allStudentsError);
        toast.error("Failed to load students");
        return;
      }

      setStudents(allStudents || []);

    } catch (error) {
      console.error('Error in loadStudents:', error);
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    try {
      // Remove all enrollments for this student in courses from this room
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('student_id', studentId)
        .eq('room_id', roomId);

      if (error) {
        toast.error("Failed to remove student");
        return;
      }

      // Remove from local state
      setStudents(prev => prev.filter(s => s.id !== studentId));
      toast.success("Student removed from class");
    } catch (error) {
      console.error('Error removing student:', error);
      toast.error("Failed to remove student");
    }
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.username && student.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!roomId) {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect students away from this page
  if (user?.role !== 'professor') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Students</h1>
          <p className="text-muted-foreground">
            Manage students in this class
          </p>
        </div>
        <Badge variant="secondary">
          {students.length} student{students.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Student Excel Manager */}
      <StudentExcelManager 
        roomId={roomId} 
        onStudentsImported={loadStudents}
      />

      {/* Search */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search students..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Students List */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading students...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Students Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No students match your search." : "Import students using Excel to get started."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => (
            <Card key={student.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={student.avatar_url || undefined} />
                    <AvatarFallback>
                      {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{student.name}</CardTitle>
                    <CardDescription className="truncate">
                      {student.username ? `@${student.username}` : student.email}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {student.role}
                  </Badge>
                  <div className="flex space-x-1">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <UserX className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Student</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {student.name} from this class? 
                            This will unenroll them from all courses in this class.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveStudent(student.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Joined {new Date(student.created_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoomStudents;