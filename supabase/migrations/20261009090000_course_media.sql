-- Supports de cours : autoriser les images et les vidéos (en plus des PDF)
-- dans le bucket "course-materials". Sans effet si le bucket n'avait aucune restriction.
update storage.buckets
set allowed_mime_types = null
where id = 'course-materials';
