import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const BATCH_SIZE = 5
const MAX_IDS = 1000

type DeleteResult = { ok: true } | { ok: false; status: number; error: string }

/**
 * Supprime un élève d'une classe (inscriptions, activités, sessions, profil, compte auth).
 * Vérifie, pour CET élève, qu'il appartient bien à la classe indiquée.
 */
// deno-lint-ignore no-explicit-any
async function deleteOneStudent(supabase: any, studentId: string, roomId: string): Promise<DeleteResult> {
  console.log(`Deleting student ${studentId} from room ${roomId}`)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', studentId)
    .eq('room_id', roomId)
    .single()

  if (profileError || !profile) {
    return { ok: false, status: 404, error: 'Student not found or not in this room' }
  }

  const { error: enrollmentError } = await supabase
    .from('enrollments').delete().eq('student_id', studentId).eq('room_id', roomId)
  if (enrollmentError) console.error('Error deleting enrollments:', enrollmentError)

  const { error: activitiesError } = await supabase
    .from('student_activities').delete().eq('student_id', studentId).eq('room_id', roomId)
  if (activitiesError) console.error('Error deleting activities:', activitiesError)

  const { error: sessionsError } = await supabase
    .from('student_sessions').delete().eq('student_id', studentId).eq('room_id', roomId)
  if (sessionsError) console.error('Error deleting sessions:', sessionsError)

  const { error: deleteProfileError } = await supabase
    .from('profiles').delete().eq('id', studentId).eq('room_id', roomId)
  if (deleteProfileError) {
    console.error('Error deleting profile:', deleteProfileError)
    return { ok: false, status: 500, error: 'Failed to delete student profile' }
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(studentId)
  if (authError) {
    console.error('Error deleting auth user:', authError)
    return { ok: false, status: 500, error: 'Failed to delete user from authentication' }
  }

  console.log(`Successfully deleted student ${studentId}`)
  return { ok: true }
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

    const body = await req.json()
    const roomId: string | undefined = body?.roomId ?? body?.room_id
    // Contrat historique : { studentId, roomId } ; contrat groupé : { studentIds | student_ids: string[], roomId }
    const rawIds = body?.studentIds ?? body?.student_ids
    const isBatch = Array.isArray(rawIds)
    const singleId: string | undefined = body?.studentId ?? body?.student_id

    if (isBatch) {
      if (!roomId) return json({ error: 'Missing roomId' }, 400)
    } else if (!singleId || !roomId) {
      return json({ error: 'Missing studentId or roomId' }, 400)
    }

    const ids: string[] = isBatch
      ? Array.from(new Set((rawIds as unknown[]).filter((v): v is string => typeof v === 'string' && v.length > 0)))
      : [singleId as string]
    if (isBatch && ids.length > MAX_IDS) {
      return json({ error: `Too many studentIds (max ${MAX_IDS})` }, 400)
    }

    // --- Habilitations : propriétaire de la classe + permission « Supprimer un élève » ---
    const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    })
    const { data: who } = await caller.auth.getUser()
    if (!who?.user) {
      return json({ success: false, error: 'Non connecté' })
    }
    const { data: callerIsAdmin, error: adminCheckError } = await supabase.rpc('is_admin', { uid: who.user.id })
    if (!adminCheckError && !callerIsAdmin) {
      const { data: room } = await supabase.from('rooms').select('professor_id').eq('id', roomId).maybeSingle()
      const { data: allowed } = await supabase.rpc('has_permission', { p_key: 'student.delete', uid: who.user.id })
      const { data: allowedClear } = await supabase.rpc('has_permission', { p_key: 'class.clear', uid: who.user.id })
      if (!room || room.professor_id !== who.user.id || (allowed !== true && allowedClear !== true)) {
        return json({ success: false, error: 'Non inclus dans votre offre' })
      }
    }

    // --- Contrat historique : un seul élève, réponses inchangées ---
    if (!isBatch) {
      const r = await deleteOneStudent(supabase, ids[0], roomId as string)
      if (!r.ok) return json({ error: r.error }, r.status)
      return json({ success: true, message: 'Student deleted successfully' })
    }

    // --- Contrat groupé : par lots de 5 en parallèle ; chaque élève est vérifié (appartenance à la classe) ---
    const deleted: string[] = []
    const failed: { id: string; error: string }[] = []
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(chunk.map(async (id) => {
        try {
          return await deleteOneStudent(supabase, id, roomId as string)
        } catch (e) {
          return { ok: false, status: 500, error: (e as Error)?.message || 'Unknown error' } as DeleteResult
        }
      }))
      results.forEach((r, k) => {
        if (r.ok) deleted.push(chunk[k])
        else failed.push({ id: chunk[k], error: r.error })
      })
    }

    return json({ success: failed.length === 0, deleted, failed })

  } catch (error) {
    console.error('Edge function error:', error)
    return json({ error: (error as Error)?.message || 'Unknown error' }, 500)
  }
})
