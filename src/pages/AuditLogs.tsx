import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Search, Eye, FileJson, Download, History } from "lucide-react";

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  user_id: string | null;
  user_email: string | null;
  created_at: string;
}

const AuditLogs = () => {
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", search, tableFilter, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (tableFilter !== "all") {
        query = query.eq("table_name", tableFilter);
      }
      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }
      if (search) {
        query = query.or(`user_email.ilike.%${search}%,record_id.eq.${search}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const tables = [
    "companies", "contacts", "containers", "delivery_notes", "documents",
    "equipment", "maintenance_records", "material_announcements", "material_inputs",
    "orders", "output_materials", "pickup_requests", "processing_steps", "samples"
  ];

  const getActionBadge = (action: string) => {
    switch (action) {
      case "INSERT":
        return <Badge className="bg-green-600">Erstellt</Badge>;
      case "UPDATE":
        return <Badge className="bg-blue-600">Geändert</Badge>;
      case "DELETE":
        return <Badge variant="destructive">Gelöscht</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const exportLogs = () => {
    if (!logs) return;
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit-Log</h1>
          <p className="text-muted-foreground">Vollständige Änderungshistorie aller Datensätze</p>
        </div>
        <Button onClick={exportLogs} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export JSON
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Änderungsverlauf
          </CardTitle>
          <CardDescription>
            {logs?.length || 0} Einträge gefunden
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach E-Mail oder Record-ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tabelle filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Tabellen</SelectItem>
                {tables.map((table) => (
                  <SelectItem key={table} value={table}>
                    {table}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Aktion filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Aktionen</SelectItem>
                <SelectItem value="INSERT">Erstellt</SelectItem>
                <SelectItem value="UPDATE">Geändert</SelectItem>
                <SelectItem value="DELETE">Gelöscht</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Lade Audit-Logs...</div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zeitpunkt</TableHead>
                    <TableHead>Benutzer</TableHead>
                    <TableHead>Tabelle</TableHead>
                    <TableHead>Aktion</TableHead>
                    <TableHead>Geänderte Felder</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), "dd.MM.yyyy HH:mm:ss", { locale: de })}
                      </TableCell>
                      <TableCell>{log.user_email || "System"}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {log.table_name}
                        </code>
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        {log.changed_fields?.length ? (
                          <span className="text-sm text-muted-foreground">
                            {log.changed_fields.slice(0, 3).join(", ")}
                            {log.changed_fields.length > 3 && ` +${log.changed_fields.length - 3}`}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!logs || logs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Keine Audit-Logs gefunden
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Audit-Log Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Zeitpunkt:</span>
                  <p>{format(new Date(selectedLog.created_at), "dd.MM.yyyy HH:mm:ss", { locale: de })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Benutzer:</span>
                  <p>{selectedLog.user_email || "System"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tabelle:</span>
                  <p><code className="bg-muted px-1 py-0.5 rounded">{selectedLog.table_name}</code></p>
                </div>
                <div>
                  <span className="text-muted-foreground">Record ID:</span>
                  <p className="font-mono text-xs">{selectedLog.record_id}</p>
                </div>
              </div>

              {selectedLog.old_data && (
                <div>
                  <h4 className="font-medium mb-2 text-red-600">Alte Werte:</h4>
                  <ScrollArea className="h-[150px] rounded-md border bg-muted/50 p-3">
                    <pre className="text-xs">{JSON.stringify(selectedLog.old_data, null, 2)}</pre>
                  </ScrollArea>
                </div>
              )}

              {selectedLog.new_data && (
                <div>
                  <h4 className="font-medium mb-2 text-green-600">Neue Werte:</h4>
                  <ScrollArea className="h-[150px] rounded-md border bg-muted/50 p-3">
                    <pre className="text-xs">{JSON.stringify(selectedLog.new_data, null, 2)}</pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLogs;
