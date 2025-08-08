import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { students, roomId } = await req.json()

    if (!Array.isArray(students) || students.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid students data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const createdStudents = []
    const errors = []

    for (const student of students) {
      try {
        const { prenom, nom, username, temporaryPassword } = student

        if (!prenom?.trim() || !nom?.trim() || !username || !temporaryPassword) {
          errors.push({ student, error: 'Missing required fields' })
          continue
        }

        // Create user in Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: `${username}@school.edu`,
          password: temporaryPassword,
          user_metadata: {
            name: `${prenom} ${nom}`,
            role: 'student',
            room_id: roomId
          }
        })

        if (authError) {
          console.error(`Failed to create user ${username}:`, authError)
          errors.push({ student, error: authError.message })
          continue
        }

        if (!authData.user) {
          errors.push({ student, error: 'Failed to create user' })
          continue
        }

        // Create profile (this should be handled by the trigger, but let's ensure it)
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: authData.user.id,
            name: `${prenom} ${nom}`,
            email: `${username}@school.edu`,
            role: 'student'
          })

        if (profileError) {
          console.error(`Failed to create profile for ${username}:`, profileError)
          errors.push({ student, error: `Profile creation failed: ${profileError.message}` })
          continue
        }

        createdStudents.push(student)

      } catch (error) {
        console.error(`Error creating student ${student.username}:`, error)
        errors.push({ student, error: error.message })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: createdStudents.length, 
        total: students.length,
        createdStudents,
        errors 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})