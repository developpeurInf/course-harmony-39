import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Download, Eye, User, Activity, Calendar, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, formatDistanceToNow } from "date-fns";

interface StudentActivity {
  id: string;
  student_id: string;
  activity_type: string;
  activity_data: any;
  created_at: string;
  session_id: string;
  student?: {
    name: string;
    email: string;
    username: string;
    avatar_url?: string;
  };
}

interface StudentSession {
  id: string;
  student_id: string;
  session_start: string;
  session_end?: string;
  duration_minutes?: number;
  is_active: boolean;
  last_activity: string;
  student?: {
    name: string;
    email: string;
    username: string;
    avatar_url?: string;
  };
}

interface StudentActivityProps {
  roomId: string;
}

const StudentActivities = ({ roomId }: StudentActivityProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [allActiveSessions, setAllActiveSessions] = useState<StudentSession[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("7");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user && roomId) {
      loadStudents();
      loadActivities();
      loadSessions();
      loadAllActiveSessions(); // This will clean up stale sessions first
    }
  }, [user, roomId, selectedStudent, dateRange]);

  // Real-time subscription for sessions
  useEffect(() => {
    if (!user || !roomId) return;

    console.log('Setting up realtime subscription for room:', roomId);

    const channel = supabase
      .channel('student-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'student_sessions',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('Realtime session change:', payload);
          // Reload both filtered and all active sessions
          loadSessions();
          loadAllActiveSessions();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    // Also refresh every 30 seconds to catch any missed updates
    const refreshInterval = setInterval(() => {
      console.log('Periodic refresh of sessions');
      loadSessions();
      loadAllActiveSessions();
    }, 30000);

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
    };
  }, [user, roomId]);

  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, username, avatar_url')
        .eq('role', 'student')
        .eq('room_id', roomId);

      if (error) {
        console.error('Error loading students:', error);
        return;
      }

      setStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadActivities = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('student_activities')
        .select(`
          id,
          student_id,
          activity_type,
          activity_data,
          created_at,
          session_id
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      // Filter by student if selected
      if (selectedStudent !== "all") {
        query = query.eq('student_id', selectedStudent);
      }

      // Filter by date range
      const daysAgo = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      query = query.gte('created_at', startDate.toISOString());

      const { data, error } = await query.limit(100);

      if (error) {
        console.error('Error loading activities:', error);
        toast.error("Failed to load activities");
        return;
      }

      // For now, show placeholder data since we have basic structure
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
      toast.error("Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      let query = supabase
        .from('student_sessions')
        .select(`
          id,
          student_id,
          session_start,
          session_end,
          duration_minutes,
          is_active,
          last_activity
        `)
        .eq('room_id', roomId)
        .order('session_start', { ascending: false });

      // Filter by student if selected
      if (selectedStudent !== "all") {
        query = query.eq('student_id', selectedStudent);
      }

      // Filter by date range
      const daysAgo = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      query = query.gte('session_start', startDate.toISOString());

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('Error loading sessions:', error);
        toast.error("Failed to load sessions");
        return;
      }

      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
      toast.error("Failed to load sessions");
    }
  };

  const loadAllActiveSessions = async () => {
    try {
      console.log('=== Loading All Active Sessions ===');
      
      // First, clean up stale sessions and duplicates
      console.log('Calling close_stale_sessions()...');
      const { error: cleanupError } = await supabase.rpc('close_stale_sessions');
      
      if (cleanupError) {
        console.error('Error cleaning up stale sessions:', cleanupError);
      } else {
        console.log('✓ Stale sessions cleaned up successfully');
      }

      // Wait a moment for the cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Load all currently active sessions regardless of date filter
      console.log('Fetching active sessions...');
      const { data, error } = await supabase
        .from('student_sessions')
        .select(`
          id,
          student_id,
          session_start,
          session_end,
          duration_minutes,
          is_active,
          last_activity
        `)
        .eq('room_id', roomId)
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (error) {
        console.error('Error loading active sessions:', error);
        return;
      }

      console.log('✓ Loaded', data?.length || 0, 'active sessions');
      
      // Log how many sessions per student
      const sessionsByStudent = new Map();
      data?.forEach(session => {
        const count = sessionsByStudent.get(session.student_id) || 0;
        sessionsByStudent.set(session.student_id, count + 1);
      });
      
      console.log('Sessions per student:', Object.fromEntries(sessionsByStudent));
      
      setAllActiveSessions(data || []);
    } catch (error) {
      console.error('Error loading active sessions:', error);
    }
  };

  const exportActivities = async () => {
    try {
      // Get activities with student details
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('student_activities')
        .select('created_at, activity_type, activity_data, student_id')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (activitiesError) {
        toast.error("Failed to export activities");
        return;
      }

      if (!activitiesData || activitiesData.length === 0) {
        toast.error("No activities to export");
        return;
      }

      // Get student details
      const studentIds = [...new Set(activitiesData.map(activity => activity.student_id))];
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('id, name, email, username')
        .in('id', studentIds);

      if (studentsError) {
        toast.error("Failed to load student details for export");
        return;
      }

      const studentsMap = new Map(studentsData?.map(student => [student.id, student]) || []);

      // Convert to CSV
      const csvData = [
        ['Date', 'Student Name', 'Username', 'Activity Type', 'Details'],
        ...activitiesData.map(activity => {
          const student = studentsMap.get(activity.student_id);
          return [
            format(new Date(activity.created_at), 'yyyy-MM-dd HH:mm:ss'),
            student?.name || 'Unknown',
            student?.username || '',
            activity.activity_type,
            JSON.stringify(activity.activity_data || {})
          ];
        })
      ];

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `student-activities-${format(new Date(), 'yyyy-MM-dd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Activities exported successfully");
      }
    } catch (error) {
      console.error('Error exporting activities:', error);
      toast.error("Failed to export activities");
    }
  };

  const getOnlineStudents = () => {
    const now = new Date();
    const ninetySecondsAgo = new Date(now.getTime() - 90 * 1000); // 90 seconds ago
    
    console.log('=== Getting Online Students ===');
    console.log('Total active sessions in state:', allActiveSessions.length);
    
    // Use allActiveSessions and filter by recent activity
    const activeSessions = allActiveSessions.filter(session => {
      const isActive = session.is_active;
      const lastActivity = new Date(session.last_activity);
      const isRecent = lastActivity > ninetySecondsAgo;
      
      return isActive && isRecent;
    });

    console.log('Active recent sessions:', activeSessions.length);
    console.log('Active recent sessions details:', activeSessions.map(s => ({
      student_id: s.student_id,
      last_activity: s.last_activity
    })));

    // Group by student_id to get unique students (take the most recent session per student)
    const uniqueStudentsMap = new Map();
    
    activeSessions.forEach(session => {
      const existing = uniqueStudentsMap.get(session.student_id);
      if (!existing || new Date(session.last_activity) > new Date(existing.last_activity)) {
        uniqueStudentsMap.set(session.student_id, session);
      }
    });

    console.log('Unique students map size:', uniqueStudentsMap.size);
    console.log('Unique student IDs:', Array.from(uniqueStudentsMap.keys()));

    // Convert map to array and add student details
    const result = Array.from(uniqueStudentsMap.values()).map(session => {
      const student = students.find(s => s.id === session.student_id);
      return {
        ...session,
        student_name: student?.name || 'Unknown Student',
        student_avatar: student?.avatar_url || null
      };
    });

    console.log('Final online students count:', result.length);
    return result;
  };

  const getTotalStudyTime = () => {
    return sessions.reduce((total, session) => {
      return total + (session.duration_minutes || 0);
    }, 0);
  };

  const filteredActivities = activities.filter(activity =>
    activity.student?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.activity_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (user?.role !== 'professor') {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("activities.student.activities")}</h2>
          <p className="text-muted-foreground">
            {t("activities.monitor")}
          </p>
        </div>
        <Button onClick={exportActivities} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          {t("activities.export")}
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("activities.total.students")}</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("activities.online.now")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {getOnlineStudents().length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("activities.total.study.time")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(getTotalStudyTime() / 60)}h
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("activities.today")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activities.filter(a => 
                new Date(a.created_at).toDateString() === new Date().toDateString()
              ).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="search">{t("activities.search")}</Label>
          <Input
            id="search"
            placeholder={t("activities.search.placeholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="min-w-[150px]">
          <Label htmlFor="student-filter">{t("activities.student.filter")}</Label>
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger>
              <SelectValue placeholder={t("activities.select.student")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("activities.all.students")}</SelectItem>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[120px]">
          <Label htmlFor="date-range">{t("activities.date.range")}</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{t("activities.last.week")}</SelectItem>
              <SelectItem value="7">{t("activities.last.week")}</SelectItem>
              <SelectItem value="30">{t("activities.last.month")}</SelectItem>
              <SelectItem value="90">{t("activities.last.3.months")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Activity Tabs */}
      <Tabs defaultValue="activities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activities">{t("activities.activities")}</TabsTrigger>
          <TabsTrigger value="sessions">{t("activities.sessions")}</TabsTrigger>
          <TabsTrigger value="online">{t("activities.online.students")}</TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t("students.loading")}</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t("activities.no.activities")}</h3>
                  <p className="text-muted-foreground">
                    {t("activities.tracking.desc")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t("activities.tracking.ready")}</h3>
                  <p className="text-muted-foreground">
                    {t("activities.tracking.desc")}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t("activities.no.sessions")}</h3>
                  <p className="text-muted-foreground">
                    {t("activities.tracking.desc")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t("activities.tracking.ready")}</h3>
                  <p className="text-muted-foreground">
                    {t("activities.tracking.desc")}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="online" className="space-y-4">
          {getOnlineStudents().length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t("activities.online.students")}</h3>
                  <p className="text-muted-foreground">
                    {t("activities.no.online")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {getOnlineStudents().map((onlineSession) => {
                const student = students.find(s => s.id === onlineSession.student_id);
                if (!student) return null;
                
                return (
                  <Card key={onlineSession.student_id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={student.avatar_url} />
                          <AvatarFallback>
                            {student.name.split(' ').map((n: string) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">{student.name}</p>
                          <p className="text-sm text-muted-foreground">
                            @{student.username}
                          </p>
                          <div className="flex items-center space-x-1 mt-1">
                            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                            <p className="text-xs text-muted-foreground">
                              {t("activities.active.for")} {formatDistanceToNow(new Date(onlineSession.last_activity), { addSuffix: true })}
                            </p>
                          </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentActivities;