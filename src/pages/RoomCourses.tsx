import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useAuth, UserProfile } from "@/contexts/AuthContext";
import { useCourses, Course, Room } from "@/contexts/CourseContext";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter,
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  BookOpen, 
  Eye, 
  EyeOff, 
  Edit, 
  Trash, 
  Plus
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MultiPdfUpload from "@/components/MultiPdfUpload";
import CourseMaterials from "@/components/CourseMaterials";

interface CourseMaterial {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  uploaded_at: string;
}

const RoomCourses = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { 
    rooms, 
    courses, 
    refreshData, 
    addCourse, 
    updateCourse, 
    deleteCourse, 
    toggleCourseVisibility 
  } = useCourses();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [courseMaterials, setCourseMaterials] = useState<Record<string, CourseMaterial[]>>({});
  const [existingFiles, setExistingFiles] = useState<CourseMaterial[]>([]);
  
  const isProfessor = user?.role === "professor";
  
  // Load room-specific data when component mounts
  useEffect(() => {
    if (user && roomId) {
      refreshData(roomId);
    }
  }, [user, roomId, refreshData]);

  // Redirect if no roomId
  if (!roomId) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Get current room
  const currentRoom = rooms.find(room => room.id === roomId);
  
  // Filter courses for current room
  const roomCourses = courses.filter(course => course.room_id === roomId);

  // Load course materials
  const loadCourseMaterials = async () => {
    try {
      if (roomCourses.length === 0) return;
      
      const courseIds = roomCourses.map(course => course.id);
      const { data: materials, error } = await supabase
        .from('course_materials')
        .select('*')
        .in('course_id', courseIds)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      // Group materials by course_id
      const materialsByCode: Record<string, CourseMaterial[]> = {};
      materials?.forEach((material) => {
        if (!materialsByCode[material.course_id]) {
          materialsByCode[material.course_id] = [];
        }
        materialsByCode[material.course_id].push(material);
      });

      setCourseMaterials(materialsByCode);
    } catch (error) {
      console.error('Error loading course materials:', error);
    }
  };

  // Load course materials when room courses change
  useEffect(() => {
    if (roomCourses.length > 0) {
      loadCourseMaterials();
    }
  }, [roomCourses]);

  // Load specific course materials
  const loadCourseSpecificMaterials = async (courseId: string) => {
    try {
      const { data: materials, error } = await supabase
        .from('course_materials')
        .select('*')
        .eq('course_id', courseId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return materials || [];
    } catch (error) {
      console.error('Error loading course materials:', error);
      return [];
    }
  };
  
  // Handle form submission
  const handleAddCourse = async () => {
    if (!title.trim()) {
      toast.error("Course title is required");
      return;
    }

    const success = await addCourse({
      title: title.trim(),
      description: description.trim(),
      room_id: roomId,
      is_visible: isVisible
    });

    if (success && selectedFiles.length > 0) {
      // Refresh data first to get the new course
      await refreshData(roomId);
      // Find the newly created course by title and room
      const newCourse = courses.find(course => 
        course.title === title.trim() && course.room_id === roomId
      );
      if (newCourse) {
        await uploadFiles(newCourse.id);
      }
    }

    if (success) {
      resetForm();
    }
  };

  // Upload files
  const uploadFiles = async (courseId: string) => {
    for (const file of selectedFiles) {
      try {
        // Upload file to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data, error: uploadError } = await supabase.storage
          .from('course-materials')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save file info to database
        const { error: dbError } = await supabase
          .from('course_materials')
          .insert({
            course_id: courseId,
            file_name: file.name,
            file_path: data.path,
            file_size: file.size,
            uploaded_by: user?.id
          });

        if (dbError) throw dbError;
      } catch (error) {
        console.error('Error uploading file:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    
    // Reload materials after upload
    loadCourseMaterials();
    toast.success('Course materials uploaded successfully');
  };

  // Reset form
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setIsVisible(true);
    setSelectedFiles([]);
    setExistingFiles([]);
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setCurrentCourse(null);
  };
  
  // Handle edit submission
  const handleEditCourse = async () => {
    if (!currentCourse) return;
    
    if (!title.trim()) {
      toast.error("Course title is required");
      return;
    }

    const success = await updateCourse(currentCourse.id, {
      title: title.trim(),
      description: description.trim(),
      is_visible: isVisible
    });

    // Upload new files if any
    if (success && selectedFiles.length > 0) {
      await uploadFiles(currentCourse.id);
    }

    if (success) {
      resetForm();
    }
  };
  
  // Handle delete
  const handleDeleteCourse = async (courseId: string) => {
    const success = await deleteCourse(courseId);
    if (success) {
      // Refresh data to update the view
      refreshData(roomId);
    }
  };
  
  // Open edit dialog
  const openEditDialog = async (course: Course) => {
    setCurrentCourse(course);
    setTitle(course.title);
    setDescription(course.description || "");
    setIsVisible(course.is_visible);
    
    // Load existing materials for this course
    const materials = await loadCourseSpecificMaterials(course.id);
    setExistingFiles(materials);
    
    setIsEditDialogOpen(true);
  };

  // Remove existing file
  const removeExistingFile = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('course_materials')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      setExistingFiles(prev => prev.filter(file => file.id !== fileId));
      loadCourseMaterials();
      toast.success('File removed successfully');
    } catch (error) {
      console.error('Error removing file:', error);
      toast.error('Failed to remove file');
    }
  };
  
  if (!currentRoom) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Class not found.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Courses</h1>
          <p className="text-muted-foreground">
            Manage courses in {currentRoom.name}
          </p>
        </div>
        {isProfessor && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Course</DialogTitle>
                <DialogDescription>
                  Create a new course in {currentRoom.name}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Course Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Introduction to Computer Science"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Course Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide a detailed description of the course content, objectives, and what students will learn..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Course Materials (PDFs)</Label>
                  <MultiPdfUpload
                    selectedFiles={selectedFiles}
                    onFilesChange={setSelectedFiles}
                    maxFiles={10}
                    maxSizeMB={50}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="visible"
                    checked={isVisible}
                    onCheckedChange={setIsVisible}
                  />
                  <Label htmlFor="visible">Make course visible to students</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button onClick={handleAddCourse}>Create Course</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      {roomCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roomCourses.map((course) => (
            <Card key={course.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{course.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {course.description || "No description available"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Badge variant={course.is_visible ? "default" : "secondary"}>
                      {course.is_visible ? "Visible" : "Hidden"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-3">
                  Created {new Date(course.created_at).toLocaleDateString()}
                </div>
                {courseMaterials[course.id] && courseMaterials[course.id].length > 0 && (
                  <CourseMaterials 
                    materials={courseMaterials[course.id]} 
                    compact={true}
                  />
                )}
              </CardContent>
              {isProfessor && (
                <CardFooter className="pt-0 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleCourseVisibility(course.id)}
                  >
                    {course.is_visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(course)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteCourse(course.id)}
                  >
                    <Trash className="h-3 w-3" />
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/30">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium">No courses found</h3>
          <p className="text-muted-foreground text-center max-w-md mt-2">
            {isProfessor 
              ? `There are no courses in ${currentRoom.name} yet. Add your first course to get started.`
              : `You are not enrolled in any courses in ${currentRoom.name}.`}
          </p>
          {isProfessor && (
            <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Course
            </Button>
          )}
        </div>
      )}
      
      {/* Edit Course Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update the course details and visibility.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Course Title *</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Introduction to Computer Science"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Course Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a detailed description of the course content, objectives, and what students will learn..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Course Materials (PDFs)</Label>
              <MultiPdfUpload
                selectedFiles={selectedFiles}
                onFilesChange={setSelectedFiles}
                existingFiles={existingFiles}
                onRemoveExisting={removeExistingFile}
                maxFiles={10}
                maxSizeMB={50}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-visible"
                checked={isVisible}
                onCheckedChange={setIsVisible}
              />
              <Label htmlFor="edit-visible">Make course visible to students</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={handleEditCourse}>Update Course</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoomCourses;