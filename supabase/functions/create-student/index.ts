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
    
    const { students, roomId, purpose } = await req.json()
    
    if (!students || !Array.isArray(students) || !roomId) {
      return new Response(
        JSON.stringify({ error: 'Missing students array or roomId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // --- Habilitations : appelant connecté, propriétaire de la classe, permission + quota d'élèves ---
    const deny = (error: string) => new Response(
      JSON.stringify({ success: false, created: 0, total: students.length, error }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    })
    const { data: who } = await caller.auth.getUser()
    if (!who?.user) return deny('Non connecté')
    const callerId = who.user.id
    const { data: callerIsAdmin, error: adminCheckError } = await supabase.rpc('is_admin', { uid: callerId })
    // (si la migration « abonnements » n'est pas encore appliquée, la fonction n'existe pas : comportement d'avant)
    const accessControl = !adminCheckError
    if (accessControl && !callerIsAdmin) {
      const { data: room } = await supabase.from('rooms').select('professor_id').eq('id', roomId).maybeSingle()
      if (!room || room.professor_id !== callerId) return deny('Cette classe ne vous appartient pas')
      const keys = purpose === 'import' ? ['student.import_excel']
        : purpose === 'reset' ? ['student.reset_password']
        : purpose === 'create' ? ['student.create']
        : ['student.create', 'student.import_excel', 'student.reset_password']
      let allowed = false
      for (const key of keys) {
        const { data } = await supabase.rpc('has_permission', { p_key: key, uid: callerId })
        if (data === true) { allowed = true; break }
      }
      if (!allowed) return deny('Non inclus dans votre offre')

      if (purpose !== 'reset') {
        const { data: limit } = await supabase.rpc('quota_limit', { p_key: 'students.max', uid: callerId })
        if (limit !== null && limit !== undefined) {
          const { data: used } = await supabase.rpc('quota_usage', { p_key: 'students.max', uid: callerId })
          const usernames = (students as Student[]).map(s => s.username)
          const { data: existing } = await supabase.from('profiles').select('username').in('username', usernames)
          const newOnes = usernames.length - (existing?.length || 0)
          if ((used || 0) + newOnes > limit) {
            return deny(`Limite de votre offre atteinte : ${limit} élèves maximum (${used || 0} déjà créés)`)
          }
        }
      }
    }

    const results = []
    const errors = []
    let created = 0

    console.log(`Creating ${students.length} students for room ${roomId}`)

    // Cours de la classe : lus UNE fois (et non pour chaque élève)
    let roomCourseIds: string[] = []
    {
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id')
        .eq('room_id', roomId)
      if (coursesError) console.error('Failed to get courses for room:', coursesError.message)
      else roomCourseIds = (courses || []).map((c: { id: string }) => c.id)
    }

    // Comptes déjà existants : retrouvés par le profil (une seule requête), sans parcourir
    // toute la liste des utilisateurs Auth (auth.admin.listUsers) pour chaque élève.
    // (même format qu'avant ; Supabase Auth compare les e-mails sans tenir compte de la casse)
    const emailOf = (s: Student) => `${s.username}@student.internal`
    const existingByEmail = new Map<string, string>()
    {
      const emails = Array.from(new Set((students as Student[]).flatMap(s => [emailOf(s), emailOf(s).toLowerCase()])))
      // par paquets de 100 pour garder des URL courtes
      for (let i = 0; i < emails.length; i += 100) {
        const { data: existingProfiles, error: existingError } = await supabase
          .from('profiles')
          .select('id, email')
          .in('email', emails.slice(i, i + 100))
        if (existingError) console.error('Error checking existing profiles:', existingError.message)
        for (const p of existingProfiles || []) {
          if (p.email) existingByEmail.set(String(p.email).toLowerCase(), p.id)
        }
      }
    }

    // Dernier recours (rare) : compte Auth sans profil → recherche paginée par e-mail
    const findAuthUserId = async (email: string): Promise<string | null> => {
      for (let page = 1; page <= 50; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
        if (error) return null
        const users = data?.users || []
        const found = users.find(u => (u.email || '').toLowerCase() === email)
        if (found) return found.id
        if (users.length < 1000) return null
      }
      return null
    }

    const isAlreadyRegistered = (err: { message?: string; status?: number; code?: string } | null) =>
      !!err && (
        err.status === 422 ||
        err.code === 'email_exists' ||
        /already (been )?registered|already exists/i.test(err.message || '')
      )

    const enrollmentRows: { student_id: string; course_id: string; room_id: string }[] = []

    for (const student of students as Student[]) {
      try {
        // Compte Auth : identifiant fictif construit à partir du nom d'utilisateur
        const fakeEmail = emailOf(student)
        const userMetadata = {
          name: `${student.prenom} ${student.nom}`,
          username: student.username,
          role: 'student'
        }

        let userId: string | null = existingByEmail.get(fakeEmail.toLowerCase()) || null
        // compte existant : on met à jour le mot de passe au lieu de supprimer / recréer le
        // compte (l'élève garde son identifiant et tout son historique)
        let needsUpdate = !!userId

        if (!userId) {
          const { data: createData, error: authError } = await supabase.auth.admin.createUser({
            email: fakeEmail,
            password: student.temporaryPassword,
            email_confirm: true, // Auto-confirm email for students
            user_metadata: userMetadata
          })
          if (authError) {
            if (isAlreadyRegistered(authError)) {
              userId = await findAuthUserId(fakeEmail.toLowerCase())
              needsUpdate = !!userId
            }
            if (!userId) {
              console.error('Auth error for student:', student.username, authError.message)
              errors.push({
                student: `${student.prenom} ${student.nom}`,
                error: authError.message
              })
              continue
            }
          } else {
            userId = createData.user.id
          }
        }

        if (userId && needsUpdate) {
          const { error: updError } = await supabase.auth.admin.updateUserById(userId, {
            password: student.temporaryPassword,
            email_confirm: true,
            user_metadata: userMetadata
          })
          if (updError) {
            console.error('Auth update error for student:', student.username, updError.message)
            errors.push({
              student: `${student.prenom} ${student.nom}`,
              error: updError.message
            })
            continue
          }
        }

        // Update the profile with username, email, temporary password and room_id
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            username: student.username,
            email: fakeEmail, // Store the fake email for login purposes
            temporary_password: student.temporaryPassword,
            role: 'student',
            room_id: roomId // Associate student with the room
          })
          .eq('id', userId)

        if (profileError) {
          console.error('Profile update error:', profileError.message)
          errors.push({
            student: `${student.prenom} ${student.nom}`,
            error: `Profile update failed: ${profileError.message}`
          })
          continue
        }

        for (const courseId of roomCourseIds) {
          enrollmentRows.push({ student_id: userId as string, course_id: courseId, room_id: roomId })
        }

        results.push({
          ...student,
          id: userId
        })
        created++

      } catch (error) {
        console.error('Unexpected error creating student:', student.username, (error as Error)?.message)
        errors.push({
          student: `${student.prenom} ${student.nom}`,
          error: (error as Error)?.message || String(error)
        })
      }
    }

    // Inscriptions aux cours de la classe : un seul envoi groupé (les doublons sont ignorés)
    if (enrollmentRows.length > 0) {
      const { error: batchError } = await supabase
        .from('enrollments')
        .upsert(enrollmentRows, { onConflict: 'student_id,course_id', ignoreDuplicates: true })
      if (batchError) {
        // pas de contrainte unique adaptée (ou autre erreur) : on retombe sur un envoi par élève
        console.error('Batch enrollment error, falling back:', batchError.message)
        const byStudent = new Map<string, typeof enrollmentRows>()
        for (const row of enrollmentRows) {
          const list = byStudent.get(row.student_id) || []
          list.push(row)
          byStudent.set(row.student_id, list)
        }
        for (const [studentId, rows] of byStudent) {
          const { data: already } = await supabase
            .from('enrollments')
            .select('course_id')
            .eq('student_id', studentId)
            .in('course_id', rows.map(r => r.course_id))
          const have = new Set((already || []).map((r: { course_id: string }) => r.course_id))
          const missing = rows.filter(r => !have.has(r.course_id))
          if (missing.length > 0) {
            const { error: enrollmentError } = await supabase.from('enrollments').insert(missing)
            if (enrollmentError) console.error('Enrollment error:', enrollmentError.message)
          }
        }
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