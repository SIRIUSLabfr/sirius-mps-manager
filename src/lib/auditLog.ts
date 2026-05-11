import { supabase } from '@/integrations/supabase/client';

export type AuditAction = 'insert' | 'update' | 'delete';

interface LogEditArgs {
  projectId: string;
  tableName: string;
  recordId?: string | null;
  action: AuditAction;
  /** Vorher-Zustand (für update/delete). */
  before?: Record<string, any> | null;
  /** Nachher-Zustand (für insert/update). */
  after?: Record<string, any> | null;
  /** Optionaler Klartext zur Anzeige im History-Feed. */
  description?: string;
  /** Whitelist der Felder, die verglichen werden sollen.
   *  Wenn nicht gesetzt: Diff über alle Keys aus before/after. */
  fields?: string[];
}

/**
 * Vergleicht before/after und liefert nur die geänderten Felder als
 * `{ field: { from, to } }`. Wenn fields gegeben, wird der Diff darauf
 * begrenzt.
 */
function diff(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined,
  fields?: string[],
): Record<string, { from: any; to: any }> {
  const out: Record<string, { from: any; to: any }> = {};
  const keys =
    fields ??
    Array.from(
      new Set([
        ...Object.keys(before || {}),
        ...Object.keys(after || {}),
      ]),
    );
  for (const k of keys) {
    const f = before?.[k];
    const t = after?.[k];
    // primitiver Vergleich; reicht für unsere Skalarfelder
    if (JSON.stringify(f) !== JSON.stringify(t)) {
      out[k] = { from: f ?? null, to: t ?? null };
    }
  }
  return out;
}

/**
 * Schreibt einen Audit-Log-Eintrag. Fehler werden nur geloggt, NICHT
 * geworfen — die Audit-Schicht darf den eigentlichen Save-Flow nie
 * blockieren.
 */
export async function logEdit(args: LogEditArgs): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let changes: Record<string, any> = {};
    if (args.action === 'update') {
      changes = diff(args.before, args.after, args.fields);
      // Update ohne tatsächliche Änderung → nichts loggen
      if (Object.keys(changes).length === 0) return;
    } else if (args.action === 'insert') {
      changes = { after: args.after || {} };
    } else {
      changes = { before: args.before || {} };
    }

    await supabase.from('audit_log' as any).insert({
      project_id: args.projectId,
      user_id: user?.id || null,
      user_email: user?.email || null,
      table_name: args.tableName,
      record_id: args.recordId ? String(args.recordId) : null,
      action: args.action,
      changes,
      description: args.description || null,
    } as any);
  } catch (err) {
    console.warn('[auditLog] write failed:', err);
  }
}
