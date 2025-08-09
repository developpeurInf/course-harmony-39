import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Student {
  prenom: string;
  nom: string;
  username: string;
  temporaryPassword: string;
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
    
    const { students, roomId } = await req.json()
    
    if (!students || !Array.isArray(students) || !roomId) {
      return new Response(
        JSON.stringify({ error: 'Missing students array or roomId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const results = []
    const errors = []
    let created = 0

    console.log(`Creating ${students.length} students for room ${roomId}`)

    for (const student of students as Student[]) {
      try {
        // Create auth user with username as email (temporary approach)
        const fakeEmail = `${student.username}@student.internal`
        
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: fakeEmail,
          password: student.temporaryPassword,
          user_metadata: {
            name: `${student.prenom} ${student.nom}`,
            username: student.username,
            role: 'student'
          }
        })

        if (authError) {
          console.error('Auth error for student:', student.username, authError)
          errors.push({ 
            student: `${student.prenom} ${student.nom}`, 
            error: authError.message 
          })
          continue
        }

        console.log('Created auth user:', authData.user.id)

        // Update the profile with username and temporary password
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            username: student.username,
            temporary_password: student.temporaryPassword,
            role: 'student'
          })
          .eq('id', authData.user.id)

        if (profileError) {
          console.error('Profile update error:', profileError)
          errors.push({ 
            student: `${student.prenom} ${student.nom}`, 
            error: `Profile update failed: ${profileError.message}` 
          })
          continue
        }

        // Get all courses in this room to auto-enroll the student
        const { data: courses, error: coursesError } = await supabase
          .from('courses')
          .select('id')
          .eq('room_id', roomId)

        if (coursesError) {
          console.error('Failed to get courses for room:', coursesError)
        } else if (courses && courses.length > 0) {
          // Create enrollments for all courses in the room
          const enrollments = courses.map(course => ({
            student_id: authData.user.id,
            course_id: course.id,
            room_id: roomId
          }))

          const { error: enrollmentError } = await supabase
            .from('enrollments')
            .insert(enrollments)

          if (enrollmentError) {
            console.error('Enrollment error:', enrollmentError)
          }
        }

        results.push({
          ...student,
          id: authData.user.id
        })
        created++

      } catch (error) {
        console.error('Unexpected error creating student:', student.username, error)
        errors.push({ 
          student: `${student.prenom} ${student.nom}`, 
          error: error.message 
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        created,
        total: students.length,
        createdStudents: results,
        errors: errors.length > 0 ? errors : undefined
      }),
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