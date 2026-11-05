/**
 * Lit toutes les lignes d'une requête Supabase, page par page.
 * PostgREST renvoie au plus 1000 lignes par requête (max_rows) : sans
 * pagination, les données au-delà sont perdues sans erreur.
 * `builder` est une requête prête (select / filtres / tri) ; un tri par id est
 * ajouté pour que les pages ne se chevauchent pas.
 */
export async function fetchAllRows<T = any>(
  builder: any,
  { pageSize = 1000, maxRows = 50000, orderById = true }: { pageSize?: number; maxRows?: number; orderById?: boolean } = {},
): Promise<{ data: T[] | null; error: any }> {
  const query = orderById ? builder.order("id", { ascending: true }) : builder;
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const res = await query.range(from, from + pageSize - 1);
    if (res.error) return { data: rows.length ? rows : null, error: res.error };
    const page = (res.data || []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return { data: rows, error: null };
}
