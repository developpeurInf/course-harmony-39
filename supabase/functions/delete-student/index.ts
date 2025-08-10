import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { studentId, roomId } = await req.json()
    
    if (!studentId || !roomId) {
      return new Response(
        JSON.stringify({ error: 'Missing studentId or roomId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Deleting student ${studentId} from room ${roomId}`)

    // First, get the student profile to check if it exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .eq('room_id', roomId)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Student not found or not in this room' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Delete all enrollments for this student
    const { error: enrollmentError } = await supabase
      .from('enrollments')
      .delete()
      .eq('student_id', studentId)
      .eq('room_id', roomId)

    if (enrollmentError) {
      console.error('Error deleting enrollments:', enrollmentError)
    }

    // Delete student activities
    const { error: activitiesError } = await supabase
      .from('student_activities')
      .delete()
      .eq('student_id', studentId)
      .eq('room_id', roomId)

    if (activitiesError) {
      console.error('Error deleting activities:', activitiesError)
    }

    // Delete student sessions
    const { error: sessionsError } = await supabase
      .from('student_sessions')
      .delete()
      .eq('student_id', studentId)
      .eq('room_id', roomId)

    if (sessionsError) {
      console.error('Error deleting sessions:', sessionsError)
    }

    // Delete from profiles table
    const { error: deleteProfileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', studentId)
      .eq('room_id', roomId)

    if (deleteProfileError) {
      console.error('Error deleting profile:', deleteProfileError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete student profile' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Delete from auth.users table
    const { error: authError } = await supabase.auth.admin.deleteUser(studentId)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete user from authentication' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Successfully deleted student ${studentId}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Student deleted successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})