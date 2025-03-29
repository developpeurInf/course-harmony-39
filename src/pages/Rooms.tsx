
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses, Room, Course } from "@/contexts/CourseContext";
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
  Plus,
  Building,
  LayoutGrid,
  LayoutList
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

const Rooms = () => {
  const { user } = useAuth();
  const { 
    rooms, 
    courses,
    addRoom, 
    updateRoom, 
    deleteRoom, 
    toggleRoomVisibility,
    getCoursesForRoom,
    addCourseToRoom,
    removeCourseFromRoom
  } = useCourses();
  
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageCoursesDialogOpen, setIsManageCoursesDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  
  const isProfessor = user?.role === "professor";
  
  // Filter rooms based on user role
  const displayedRooms = isProfessor 
    ? rooms 
    : rooms.filter(room => room.isVisible);

  // Reset form
  const resetForm = () => {
    setName("");
    setDescription("");
    setIsVisible(true);
    setCurrentRoom(null);
    setSelectedCourseId("");
  };

  // Add new room
  const handleAddRoom = () => {
    addRoom({
      name,
      description,
      isVisible,
      courses: []
    });
    setIsAddDialogOpen(false);
    resetForm();
  };

  // Edit room
  const handleEditRoom = () => {
    if (currentRoom) {
      updateRoom(currentRoom.id, {
        name,
        description,
        isVisible
      });
      setIsEditDialogOpen(false);
      resetForm();
    }
  };

  // Delete room
  const handleDeleteRoom = () => {
    if (currentRoom) {
      deleteRoom(currentRoom.id);
      setIsDeleteDialogOpen(false);
      resetForm();
    }
  };

  // Open edit dialog with room data
  const openEditDialog = (room: Room) => {
    setCurrentRoom(room);
    setName(room.name);
    setDescription(room.description);
    setIsVisible(room.isVisible);
    setIsEditDialogOpen(true);
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (room: Room) => {
    setCurrentRoom(room);
    setIsDeleteDialogOpen(true);
  };

  // Open manage courses dialog
  const openManageCoursesDialog = (room: Room) => {
    setCurrentRoom(room);
    setIsManageCoursesDialogOpen(true);
  };

  // Toggle room visibility
  const handleToggleVisibility = (roomId: string) => {
    toggleRoomVisibility(roomId);
  };

  // Toggle view mode between grid and list
  const toggleViewMode = () => {
    setViewMode(viewMode === "grid" ? "list" : "grid");
  };

  // Add course to room
  const handleAddCourseToRoom = () => {
    if (currentRoom && selectedCourseId) {
      addCourseToRoom(currentRoom.id, selectedCourseId);
      setSelectedCourseId("");
    }
  };

  // Remove course from room
  const handleRemoveCourseFromRoom = (roomId: string, courseId: string) => {
    removeCourseFromRoom(roomId, courseId);
  };

  // Navigate to courses page filtered by room
  const navigateToCourses = (roomId: string) => {
    navigate(`/courses?room=${roomId}`);
  };

  // Get available courses for a room (courses not already in the room)
  const getAvailableCourses = (roomId: string): Course[] => {
    return courses.filter(course => !course.roomId || course.roomId !== roomId);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Rooms</h1>
          <p className="text-muted-foreground mt-1">
            {isProfessor 
              ? "Manage your rooms and associated courses" 
              : "View available rooms and their courses"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={toggleViewMode}
            title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
          >
            {viewMode === "grid" ? (
              <LayoutList className="h-4 w-4" />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )}
          </Button>
          
          {isProfessor && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Room
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Room</DialogTitle>
                  <DialogDescription>
                    Create a new room to organize courses.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Room Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Computer Science Department"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter room description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="visibility"
                      checked={isVisible}
                      onCheckedChange={setIsVisible}
                    />
                    <Label htmlFor="visibility">Visible to students</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddRoom} disabled={!name}>
                    Create Room
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {displayedRooms.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedRooms.map((room) => {
              const roomCourses = getCoursesForRoom(room.id);
              
              return (
                <Card key={room.id} className="overflow-hidden card-hover">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle>{room.name}</CardTitle>
                      {!room.isVisible && (
                        <Badge variant="outline">Hidden</Badge>
                      )}
                    </div>
                    <CardDescription className="mt-2">
                      {room.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center text-muted-foreground">
                        <BookOpen className="h-4 w-4 mr-1" />
                        <span>{roomCourses.length} {roomCourses.length === 1 ? "course" : "courses"}</span>
                      </div>
                    </div>
                    
                    {roomCourses.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <h4 className="text-sm font-medium">Courses in this room:</h4>
                        <ul className="space-y-1">
                          {roomCourses.slice(0, 3).map(course => (
                            <li key={course.id} className="text-sm text-muted-foreground truncate">
                              • {course.title}
                            </li>
                          ))}
                          {roomCourses.length > 3 && (
                            <li className="text-sm text-muted-foreground italic">
                              + {roomCourses.length - 3} more courses
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    
                    <div className="mt-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => navigateToCourses(room.id)}
                      >
                        <BookOpen className="h-3.5 w-3.5 mr-1" />
                        View All Courses
                      </Button>
                    </div>
                  </CardContent>
                  {isProfessor && (
                    <CardFooter className="border-t bg-muted/30 px-6 py-3">
                      <div className="flex justify-between w-full">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleToggleVisibility(room.id)}
                          title={room.isVisible ? "Hide from students" : "Make visible to students"}
                        >
                          {room.isVisible ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openManageCoursesDialog(room)}
                            title="Manage courses"
                          >
                            <BookOpen className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEditDialog(room)}
                            title="Edit room"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openDeleteDialog(room)}
                            title="Delete room"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardFooter>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedRooms.map((room) => {
              const roomCourses = getCoursesForRoom(room.id);
              
              return (
                <div key={room.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-card">
                  <div className="space-y-1 mb-2 sm:mb-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{room.name}</h3>
                      {!room.isVisible && <Badge variant="outline" className="h-5">Hidden</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{room.description}</p>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <BookOpen className="h-3 w-3 mr-1" />
                      <span>{roomCourses.length} {roomCourses.length === 1 ? "course" : "courses"}</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 w-full sm:w-auto justify-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigateToCourses(room.id)}
                    >
                      <BookOpen className="h-4 w-4 mr-1" />
                      <span>View Courses</span>
                    </Button>
                    
                    {isProfessor && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openManageCoursesDialog(room)}
                        >
                          <BookOpen className="h-4 w-4 mr-1" />
                          <span>Manage</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEditDialog(room)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          <span>Edit</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openDeleteDialog(room)}
                        >
                          <Trash className="h-4 w-4 mr-1" />
                          <span>Delete</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/30">
          <Building className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium">No rooms found</h3>
          <p className="text-muted-foreground text-center max-w-md mt-2">
            {isProfessor 
              ? "You haven't created any rooms yet. Add your first room to get started."
              : "There are no rooms available at the moment."}
          </p>
          {isProfessor && (
            <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Room
            </Button>
          )}
        </div>
      )}
      
      {/* Edit Room Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
            <DialogDescription>
              Update the room details and visibility.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Room Name</Label>
              <Input
                id="edit-name"
                placeholder="Room name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Room description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-visibility"
                checked={isVisible}
                onCheckedChange={setIsVisible}
              />
              <Label htmlFor="edit-visibility">Visible to students</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditRoom} disabled={!name}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Room Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Room</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {currentRoom?.name}? The associated courses will not be deleted, but they will no longer be part of this room.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRoom}>
              Delete Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Courses Dialog */}
      <Dialog open={isManageCoursesDialogOpen} onOpenChange={setIsManageCoursesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Courses</DialogTitle>
            <DialogDescription>
              Add or remove courses in {currentRoom?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add course */}
            <div className="space-y-2">
              <Label>Add course</Label>
              <div className="flex space-x-2">
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentRoom && getAvailableCourses(currentRoom.id).map(course => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAddCourseToRoom} 
                  disabled={!selectedCourseId}
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Courses in room */}
            <div className="space-y-2">
              <Label>Courses in this room</Label>
              <div className="border rounded-md overflow-hidden">
                {currentRoom && getCoursesForRoom(currentRoom.id).length === 0 ? (
                  <div className="p-3 text-center text-muted-foreground">
                    No courses in this room yet
                  </div>
                ) : (
                  <ul className="divide-y">
                    {currentRoom && getCoursesForRoom(currentRoom.id).map(course => (
                      <li key={course.id} className="flex justify-between items-center p-3">
                        <span>{course.title}</span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => currentRoom && handleRemoveCourseFromRoom(currentRoom.id, course.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsManageCoursesDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Rooms;
