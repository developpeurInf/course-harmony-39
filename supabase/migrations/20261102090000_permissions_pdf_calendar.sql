-- =====================================================================
-- Habilitations des fonctions ajoutées depuis l'espace d'administration
--
--   Calendrier des échéances :
--     class.calendar        : /calendar et /rooms/:id/calendar (lecture)
--   Éditeur PDF (module « pdf ») :
--     pdf.use               : ouvrir, lire, télécharger, mode tableau (lecture)
--     pdf.annotate          : onglet Commentaire (surligner, dessiner, notes)
--     pdf.edit              : onglets Modifier et Formulaire (texte, rechercher / remplacer,
--                             images, signature, tampon, lien, pièce jointe)
--     pdf.layout            : filigrane, en-tête / pied de page, numéros de page
--     pdf.watermark_remove  : suppression d'un filigrane ou d'éléments répétés
--     pdf.organize          : onglet Organiser (insérer, fusionner, supprimer, extraire,
--                             pivoter, scinder)
--     pdf.protect           : onglet Protéger (masquage / caviardage)
--   (« Enregistrer dans un cours » reste soumis à course.upload_pdf.)
--
--   Offres :
--     - toutes les offres qui voient les classes reçoivent le calendrier ;
--     - toutes les offres qui joignent des PDF aux cours reçoivent pdf.use, pdf.annotate
--       et pdf.organize ;
--     - les offres complètes (celles qui ont le modèle diagnostique 2 : Essai, Pro,
--       Fondateur) reçoivent tout l'éditeur PDF.
--
-- À exécuter à la main dans le SQL Editor de Supabase, APRÈS
-- 20261101090000_diagnostic_ai.sql et AVANT de publier le code (sinon l'éditeur PDF
-- et le calendrier sont verrouillés pour les profs). Idempotent.
-- =====================================================================

do $$
begin
  if to_regclass('public.permissions') is null then
    raise notice 'table permissions absente : habilitations non ajoutées';
    return;
  end if;

  insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
    ('class.calendar', 'class', 'Calendrier des échéances (exercices, quiz, examens)', 'يومية الآجال (تمارين، اختبارات، امتحانات)', 'Due-date calendar (exercises, quizzes, exams)', 'feature', false, 55),
    ('pdf.use', 'pdf', 'Ouvrir l''éditeur PDF (lire, télécharger, mode tableau)', 'فتح محرر PDF (قراءة، تحميل، وضع السبورة)', 'Open the PDF editor (read, download, board mode)', 'feature', false, 390),
    ('pdf.annotate', 'pdf', 'Annoter un PDF (surligner, dessiner, notes)', 'التعليق على PDF (تظليل، رسم، ملاحظات)', 'Annotate a PDF (highlight, draw, notes)', 'feature', true, 391),
    ('pdf.edit', 'pdf', 'Modifier le texte, insérer images et signatures, formulaires', 'تعديل النص وإدراج الصور والتوقيعات والنماذج', 'Edit text, insert images and signatures, forms', 'feature', true, 392),
    ('pdf.layout', 'pdf', 'Filigrane, en-tête / pied de page et numéros de page', 'العلامة المائية والرأس والتذييل وترقيم الصفحات', 'Watermark, header / footer and page numbers', 'feature', true, 393),
    ('pdf.watermark_remove', 'pdf', 'Supprimer un filigrane ou des éléments répétés', 'حذف علامة مائية أو عناصر مكررة', 'Remove a watermark or repeated elements', 'feature', true, 394),
    ('pdf.organize', 'pdf', 'Organiser les pages (insérer, fusionner, scinder, pivoter)', 'تنظيم الصفحات (إدراج، دمج، تقسيم، تدوير)', 'Organize pages (insert, merge, split, rotate)', 'feature', true, 395),
    ('pdf.protect', 'pdf', 'Masquer des informations (caviardage)', 'إخفاء المعلومات', 'Redact information', 'feature', true, 396)
  on conflict (key) do nothing;

  -- Calendrier : offres qui voient les classes
  insert into public.plan_permissions (plan_id, permission_key, limit_value)
  select pp.plan_id, 'class.calendar', null
  from public.plan_permissions pp
  where pp.permission_key = 'class.view'
  on conflict (plan_id, permission_key) do nothing;

  -- Éditeur PDF de base : offres qui joignent des PDF aux cours
  insert into public.plan_permissions (plan_id, permission_key, limit_value)
  select pp.plan_id, x.k, null
  from public.plan_permissions pp
  cross join (values ('pdf.use'), ('pdf.annotate'), ('pdf.organize')) as x(k)
  where pp.permission_key = 'course.upload_pdf'
  on conflict (plan_id, permission_key) do nothing;

  -- Éditeur PDF complet : offres complètes (modèle diagnostique 2)
  insert into public.plan_permissions (plan_id, permission_key, limit_value)
  select pp.plan_id, x.k, null
  from public.plan_permissions pp
  cross join (values ('pdf.use'), ('pdf.annotate'), ('pdf.edit'), ('pdf.layout'),
                     ('pdf.watermark_remove'), ('pdf.organize'), ('pdf.protect')) as x(k)
  where pp.permission_key = 'diagnostic.template2'
  on conflict (plan_id, permission_key) do nothing;
end $$;

notify pgrst, 'reload schema';
