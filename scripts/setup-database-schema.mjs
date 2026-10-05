import {createHash} from 'node:crypto';

// Canonical bootstrap SQL defines no application functions, user triggers,
// rewrite rules or database event triggers. Internal FK triggers must retain
// canonical origin-enabled enforcement. Reject hooks on the ledger too;
// their effects can otherwise escape the topology/schema observation contract.
export async function assertNoExecutionHooks(client) {
  const result=await client.query(`SELECT
    NOT EXISTS(SELECT FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE (NOT t.tgisinternal OR t.tgenabled<>'O') AND n.nspname IN ('public','castlink_control'))
    AND NOT EXISTS(SELECT FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','castlink_control'))
    AND NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname IN ('public','castlink_control'))
    AND NOT EXISTS(SELECT FROM pg_event_trigger) AS safe`);
  if(result.rows[0]?.safe!==true)throw Error('Unexpected bootstrap execution hooks');
}

// A ledger is never schema proof. Include every column/type/default and actual
// PK/FK/CHECK/UNIQUE/index definition (including validity), not just table names.
export async function schemaHash(client) {
  await assertNoExecutionHooks(client);
  const result = await client.query(`
    SELECT n.nspname AS schema,c.relname AS name,c.relkind,c.relrowsecurity,
      (SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
        pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated) ORDER BY a.attnum)
       FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
       WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
      (SELECT jsonb_agg(jsonb_build_array(k.conname,k.contype,pg_get_constraintdef(k.oid),
        k.convalidated,k.condeferrable,k.condeferred) ORDER BY k.conname)
       FROM pg_constraint k WHERE k.conrelid=c.oid) AS constraints,
      (SELECT jsonb_agg(jsonb_build_array(i.relname,pg_get_indexdef(x.indexrelid),x.indisvalid,x.indisready)
        ORDER BY i.relname) FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid WHERE x.indrelid=c.oid) AS indexes
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p','v','m','f') AND
      (n.nspname='castlink_control' OR n.nspname='public' AND c.relname<>'castlink_setup_bootstrap')
    ORDER BY n.nspname,c.relname`);
  return createHash('sha256').update(JSON.stringify(result.rows)).digest('hex');
}
