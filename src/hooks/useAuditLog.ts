import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

interface AuditLogParams {
  tableName: string;
  recordId: string;
  action: AuditAction;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  changedFields?: string[];
}

export const useAuditLog = () => {
  const logAudit = async ({
    tableName,
    recordId,
    action,
    oldData = null,
    newData = null,
    changedFields = [],
  }: AuditLogParams) => {
    const { data, error } = await supabase.rpc('log_audit', {
      _table_name: tableName,
      _record_id: recordId,
      _action: action,
      _old_data: oldData as Json,
      _new_data: newData as Json,
      _changed_fields: changedFields,
    });

    // A swallowed error means the caller reports a change as audited that was
    // never written - surface it instead.
    if (error) {
      console.error('Failed to log audit:', error);
      throw error;
    }

    return data;
  };

  const getChangedFields = (
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>
  ): string[] => {
    const changed: string[] = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    
    for (const key of allKeys) {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changed.push(key);
      }
    }
    
    return changed;
  };

  return { logAudit, getChangedFields };
};
