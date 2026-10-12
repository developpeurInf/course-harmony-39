// Espace administration : création et gestion des comptes professeurs
// et de l'équipe d'administration. Seule cette fonction utilise la clé de
// service ; elle vérifie d'abord que l'appelant est administrateur et qu'il
// a la permission demandée.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Mot de passe lisible (sans 0/O/1/l) : 10 caractères
function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86400000).toISOString()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization') || ''

    // 1. Qui appelle ?
    const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: who, error: whoError } = await asCaller.auth.getUser()
    if (whoError || !who?.user) return json({ error: 'Non connecté' }, 401)
    const callerId = who.user.id

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const can = async (key: string) => {
      const { data } = await admin.rpc('has_admin_permission', { p_key: key, uid: callerId })
      return data === true
    }
    const audit = (action: string, teacherId: string | null, data: Record<string, unknown>) =>
      admin.from('audit_log').insert({
        actor_id: callerId, action, table_name: 'auth.users', target_id: teacherId, teacher_id: teacherId, new_data: data,
      })

    const body = await req.json()
    const action = body?.action as string

    // ---------------------------------------------------------------
    if (action === 'create_teacher') {
      if (!(await can('admin.teachers.manage'))) return json({ error: 'Permission refusée' }, 403)
      const email = String(body.email || '').trim().toLowerCase()
      const name = String(body.name || '').trim()
      if (!email || !name) return json({ error: 'Nom et e-mail obligatoires' }, 400)
      const password = String(body.password || '').trim() || generatePassword()
      if (password.length < 6) return json({ error: 'Mot de passe : 6 caractères minimum' }, 400)

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { name, role: 'professor' },
      })
      if (createError || !created?.user) {
        const msg = createError?.message || 'Création impossible'
        return json({ error: /already|registered|exists/i.test(msg) ? 'Un compte existe déjà avec cet e-mail' : msg }, 400)
      }
      const uid = created.user.id

      await admin.from('profiles').upsert({ id: uid, name, email, role: 'professor' }, { onConflict: 'id' })
      await admin.from('teacher_accounts').upsert({
        user_id: uid, must_change_password: true, created_by: callerId,
        phone: body.phone || null, school: body.school || null, city: body.city || null,
        subject: body.subject || null, notes: body.notes || null,
      }, { onConflict: 'user_id' })

      // Abonnement initial
      let subscriptionId: string | null = null
      if (body.plan_id) {
        if (!(await can('admin.subscriptions.manage'))) return json({ error: 'Compte créé, mais pas d\'abonnement : permission refusée' }, 403)
        const { data: plan } = await admin.from('plans').select('*').eq('id', body.plan_id).single()
        if (plan) {
          const kind = body.kind === 'trial' || body.kind === 'free' ? body.kind : 'paid'
          const startsAt = body.starts_at ? new Date(body.starts_at).toISOString() : new Date().toISOString()
          const days = kind === 'trial' ? (plan.trial_days || plan.duration_days) : plan.duration_days
          const endsAt = body.ends_at ? new Date(body.ends_at).toISOString() : (days ? addDays(startsAt, days) : null)
          const { data: sub } = await admin.from('subscriptions').insert({
            teacher_id: uid, plan_id: plan.id, kind, starts_at: startsAt, ends_at: endsAt,
            grace_days: plan.grace_days ?? 7, price_mad: body.price_mad ?? plan.price_mad, created_by: callerId,
            notes: body.subscription_notes || null,
          }).select('id').single()
          subscriptionId = sub?.id ?? null
          if (subscriptionId && Number(body.payment_amount) > 0) {
            await admin.from('payments').insert({
              teacher_id: uid, subscription_id: subscriptionId, amount_mad: Number(body.payment_amount),
              method: body.payment_method || 'transfer', reference: body.payment_reference || null, created_by: callerId,
            })
          }
        }
      }
      await audit('create_teacher', uid, { email, name, plan_id: body.plan_id || null })
      return json({ success: true, user_id: uid, email, password, subscription_id: subscriptionId })
    }

    // ---------------------------------------------------------------
    if (action === 'reset_password') {
      if (!(await can('admin.teachers.manage'))) return json({ error: 'Permission refusée' }, 403)
      const uid = String(body.user_id || '')
      const password = String(body.password || '').trim() || generatePassword()
      const { error } = await admin.auth.admin.updateUserById(uid, { password })
      if (error) return json({ error: error.message }, 400)
      await admin.from('teacher_accounts').upsert({ user_id: uid, must_change_password: true }, { onConflict: 'user_id' })
      await audit('reset_password', uid, {})
      return json({ success: true, password })
    }

    // ---------------------------------------------------------------
    if (action === 'set_status') {
      if (!(await can('admin.teachers.manage'))) return json({ error: 'Permission refusée' }, 403)
      const uid = String(body.user_id || '')
      const status = body.status === 'suspended' ? 'suspended' : 'active'
      const { error } = await admin.from('teacher_accounts').upsert({
        user_id: uid, status, suspended_reason: status === 'suspended' ? (body.reason || null) : null,
      }, { onConflict: 'user_id' })
      if (error) return json({ error: error.message }, 400)
      // Suspendu : connexion bloquée (et sessions en cours invalidées au prochain rafraîchissement)
      await admin.auth.admin.updateUserById(uid, { ban_duration: status === 'suspended' ? '876000h' : 'none' } as any)
      await audit(status === 'suspended' ? 'suspend_teacher' : 'reactivate_teacher', uid, { reason: body.reason || null })
      return json({ success: true })
    }

    // ---------------------------------------------------------------
    if (action === 'update_teacher') {
      if (!(await can('admin.teachers.manage'))) return json({ error: 'Permission refusée' }, 403)
      const uid = String(body.user_id || '')
      const name = String(body.name || '').trim()
      const email = String(body.email || '').trim().toLowerCase()
      if (email) {
        const { error } = await admin.auth.admin.updateUserById(uid, { email, email_confirm: true } as any)
        if (error) return json({ error: /already|registered|exists/i.test(error.message) ? 'Cet e-mail est déjà utilisé' : error.message }, 400)
      }
      const profileUpdate: Record<string, unknown> = {}
      if (name) profileUpdate.name = name
      if (email) profileUpdate.email = email
      if (Object.keys(profileUpdate).length) await admin.from('profiles').update(profileUpdate).eq('id', uid)
      await admin.from('teacher_accounts').upsert({
        user_id: uid, phone: body.phone ?? null, school: body.school ?? null, city: body.city ?? null,
        subject: body.subject ?? null, notes: body.notes ?? null,
      }, { onConflict: 'user_id' })
      await audit('update_teacher', uid, { name, email })
      return json({ success: true })
    }

    // ---------------------------------------------------------------
    if (action === 'create_admin') {
      if (!(await can('admin.roles.manage'))) return json({ error: 'Réservé au super administrateur' }, 403)
      const email = String(body.email || '').trim().toLowerCase()
      const name = String(body.name || '').trim() || email
      const role = body.role === 'super_admin' ? 'super_admin' : 'admin'
      const perms = Array.isArray(body.admin_permissions) && body.admin_permissions.length ? body.admin_permissions : null
      if (!email) return json({ error: 'E-mail obligatoire' }, 400)
      const password = String(body.password || '').trim() || generatePassword()

      // compte existant (ex. un professeur) ou nouveau compte
      let uid: string | null = null
      const { data: existing } = await admin.from('profiles').select('id').ilike('email', email).maybeSingle()
      if (existing?.id) {
        uid = existing.id
      } else {
        const { data: created, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true, user_metadata: { name, role: 'professor' },
        })
        if (error || !created?.user) return json({ error: error?.message || 'Création impossible' }, 400)
        uid = created.user.id
        await admin.from('profiles').upsert({ id: uid, name, email, role: 'professor' }, { onConflict: 'id' })
      }
      const { error: roleError } = await admin.from('user_roles').upsert({
        user_id: uid, role, admin_permissions: role === 'super_admin' ? null : perms, created_by: callerId,
      }, { onConflict: 'user_id' })
      if (roleError) return json({ error: roleError.message }, 400)
      await audit('create_admin', uid, { email, role, admin_permissions: perms })
      return json({ success: true, user_id: uid, password: existing?.id ? null : password })
    }

    return json({ error: 'Action inconnue' }, 400)
  } catch (error) {
    console.error('admin-teachers error:', error)
    return json({ error: (error as Error).message }, 500)
  }
})
