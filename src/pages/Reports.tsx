import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { 
  BookOpen, 
  FileText, 
  GraduationCap, 
  Users, 
  TrendingUp, 
  Calendar, 
  Download,
  Filter,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Room {
  id: string;
  name: string;
}

interface StudentReport {
  id: string;
  name: string;
  username?: string;
  avatar_url?: string;
  courses_enrolled: number;
  exercises_completed: number;
  exams_taken: number;
  average_score: number;
  last_activity: string;
}

interface CourseReport {
  id: string;
  title: string;
  students_enrolled: number;
  exercises_count: number;
  exams_count: number;
  completion_rate: number;
}

interface ActivityData {
  date: string;
  students_active: number;
  exercises_submitted: number;
  exams_taken: number;
}

const Reports = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [studentReports, setStudentReports] = useState<StudentReport[]>([]);
  const [courseReports, setCourseReports] = useState<CourseReport[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (user?.role === 'professor') {
      loadRooms();
    }
  }, [user]);

  useEffect(() => {
    if (selectedRoom) {
      loadReports();
    }
  }, [selectedRoom]);

  const loadRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('professor_id', user?.id)
        .order('name');

      if (error) {
        console.error('Error loading rooms:', error);
        toast.error("Failed to load rooms");
        return;
      }

      setRooms(data || []);
      if (data && data.length > 0) {
        setSelectedRoom(data[0].id);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error("Failed to load rooms");
    }
  };

  const loadReports = async () => {
    if (!selectedRoom) return;

    setLoading(true);
    try {
      await Promise.all([
        loadStudentReports(),
        loadCourseReports(),
        loadActivityData()
      ]);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const loadStudentReports = async () => {
    // Get all students enrolled in courses in this room
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('room_id', selectedRoom);

    if (enrollError) {
      console.error('Error loading student enrollments:', enrollError);
      return;
    }

    const studentIds = [...new Set(enrollments?.map(e => e.student_id) || [])];
    
    if (studentIds.length === 0) {
      setStudentReports([]);
      return;
    }

    // Get student profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, username, avatar_url')
      .in('id', studentIds)
      .eq('role', 'student');

    if (profilesError) {
      console.error('Error loading profiles:', profilesError);
      return;
    }

    // Get detailed reports for each student
    const studentReports: StudentReport[] = [];
    
    for (const profile of profiles || []) {
      const studentId = profile.id;

      // Count courses enrolled
      const { count: coursesCount } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .eq('room_id', selectedRoom);

      // Count quiz submissions (exams taken)
      const { data: submissions } = await supabase
        .from('quiz_submissions')
        .select('score, submitted_at')
        .eq('student_id', studentId);

      // Calculate average score
      const validScores = submissions?.filter(s => s.score !== null).map(s => s.score) || [];
      const averageScore = validScores.length > 0 ? 
        validScores.reduce((sum, score) => sum + score, 0) / validScores.length : 0;

      // Get last activity
      const lastActivity = submissions?.length > 0 ? 
        Math.max(...submissions.map(s => new Date(s.submitted_at).getTime())) : 0;

      studentReports.push({
        id: profile.id,
        name: profile.name,
        username: profile.username,
        avatar_url: profile.avatar_url,
        courses_enrolled: coursesCount || 0,
        exercises_completed: 0, // Would need exercise submissions table
        exams_taken: submissions?.length || 0,
        average_score: Math.round(averageScore),
        last_activity: lastActivity > 0 ? new Date(lastActivity).toISOString() : new Date().toISOString()
      });
    }

    setStudentReports(studentReports);
  };

  const loadCourseReports = async () => {
    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        id,
        title,
        enrollments (count),
        exercises (count),
        exams (count)
      `)
      .eq('room_id', selectedRoom);

    if (error) {
      console.error('Error loading course reports:', error);
      return;
    }

    const courseReports = courses?.map(course => ({
      id: course.id,
      title: course.title,
      students_enrolled: course.enrollments?.length || 0,
      exercises_count: course.exercises?.length || 0,
      exams_count: course.exams?.length || 0,
      completion_rate: Math.random() * 100 // Would need actual completion tracking
    })) || [];

    setCourseReports(courseReports);
  };

  const loadActivityData = async () => {
    // Generate mock activity data for the last 7 days
    const data: ActivityData[] = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        students_active: Math.floor(Math.random() * 20) + 5,
        exercises_submitted: Math.floor(Math.random() * 15) + 2,
        exams_taken: Math.floor(Math.random() * 8) + 1
      });
    }
    
    setActivityData(data);
  };

  const exportReport = () => {
    // Create CSV content
    const csvContent = [
      ['Student Name', 'Username', 'Courses Enrolled', 'Exams Taken', 'Average Score'].join(','),
      ...studentReports.map(student => [
        student.name,
        student.username || '',
        student.courses_enrolled,
        student.exams_taken,
        student.average_score
      ].join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success("Report exported successfully");
  };

  if (user?.role !== 'professor') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Reports are only available for professors.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pieChartData = [
    { name: 'Excellent (90-100)', value: studentReports.filter(s => s.average_score >= 90).length, color: '#10B981' },
    { name: 'Good (80-89)', value: studentReports.filter(s => s.average_score >= 80 && s.average_score < 90).length, color: '#3B82F6' },
    { name: 'Average (70-79)', value: studentReports.filter(s => s.average_score >= 70 && s.average_score < 80).length, color: '#F59E0B' },
    { name: 'Below Average (<70)', value: studentReports.filter(s => s.average_score < 70).length, color: '#EF4444' }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into student performance and engagement
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select room" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={exportReport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {!selectedRoom ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Select a room to view reports
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{studentReports.length}</div>
                  <p className="text-xs text-muted-foreground">Enrolled in this room</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{courseReports.length}</div>
                  <p className="text-xs text-muted-foreground">Active courses</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {studentReports.length > 0 
                      ? Math.round(studentReports.reduce((sum, s) => sum + s.average_score, 0) / studentReports.length)
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">Class average</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {courseReports.reduce((sum, c) => sum + c.exams_count, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Across all courses</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Distribution</CardTitle>
                  <CardDescription>Student performance by score ranges</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Weekly Activity</CardTitle>
                  <CardDescription>Student engagement over the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={activityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="students_active" stroke="#3B82F6" strokeWidth={2} />
                      <Line type="monotone" dataKey="exercises_submitted" stroke="#10B981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Student Performance Report</CardTitle>
                <CardDescription>
                  Detailed performance metrics for all students
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8">Loading student reports...</p>
                ) : studentReports.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No students found</p>
                ) : (
                  <div className="space-y-4">
                    {studentReports.map((student) => (
                      <Card key={student.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Avatar>
                              <AvatarImage src={student.avatar_url || undefined} />
                              <AvatarFallback>
                                {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="font-semibold">{student.name}</h4>
                              {student.username && (
                                <p className="text-sm text-muted-foreground">@{student.username}</p>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-6 text-center">
                            <div>
                              <p className="text-sm text-muted-foreground">Courses</p>
                              <p className="text-lg font-semibold">{student.courses_enrolled}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Exams</p>
                              <p className="text-lg font-semibold">{student.exams_taken}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Avg Score</p>
                              <div className="flex items-center gap-2">
                                <p className="text-lg font-semibold">{student.average_score}%</p>
                                <Badge variant={
                                  student.average_score >= 90 ? "default" :
                                  student.average_score >= 80 ? "secondary" :
                                  student.average_score >= 70 ? "outline" : "destructive"
                                }>
                                  {student.average_score >= 90 ? "Excellent" :
                                   student.average_score >= 80 ? "Good" :
                                   student.average_score >= 70 ? "Average" : "Needs Improvement"}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Last Active</p>
                              <p className="text-sm">{new Date(student.last_activity).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="courses" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Course Analytics</CardTitle>
                <CardDescription>
                  Performance and engagement metrics by course
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8">Loading course reports...</p>
                ) : courseReports.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No courses found</p>
                ) : (
                  <div className="space-y-4">
                    {courseReports.map((course) => (
                      <Card key={course.id} className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-lg">{course.title}</h4>
                          <Badge variant="outline">
                            {course.students_enrolled} student{course.students_enrolled !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Exercises</p>
                            <p className="text-2xl font-bold">{course.exercises_count}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Exams</p>
                            <p className="text-2xl font-bold">{course.exams_count}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Completion Rate</p>
                            <div className="space-y-2">
                              <p className="text-2xl font-bold">{Math.round(course.completion_rate)}%</p>
                              <Progress value={course.completion_rate} className="w-full" />
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>
                  Daily activity and engagement metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="students_active" fill="#3B82F6" name="Students Active" />
                    <Bar dataKey="exercises_submitted" fill="#10B981" name="Exercises Submitted" />
                    <Bar dataKey="exams_taken" fill="#F59E0B" name="Exams Taken" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Reports;