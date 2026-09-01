import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Filter, FileText, MoreVertical, Download, Eye, ArrowDownLeft, ArrowUpRight, Loader2, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageDescription } from "@/components/layout/PageDescription";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DeliveryNoteDialog } from "@/components/delivery/DeliveryNoteDialog";
import { DeliveryNoteDetailsDialog } from "@/components/delivery/DeliveryNoteDetailsDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, startOfMonth, endOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const typeConfig = {
  incoming: { label: "Eingang", icon: ArrowDownLeft, class: "bg-info/10 text-info" },
  outgoing: { label: "Ausgang", icon: ArrowUpRight, class: "bg-success/10 text-success" },
};

export default function DeliveryNotes() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<any>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const { data: deliveryNotes = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["delivery-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_notes")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const filteredNotes = deliveryNotes.filter((n) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      n.note_id.toLowerCase().includes(term) ||
      n.partner_name.toLowerCase().includes(term) ||
      n.material_description.toLowerCase().includes(term);

    const matchesType = typeFilter === "all" || n.type === typeFilter;

    const created = new Date(n.created_at);
    const matchesFrom = !dateFrom || created >= new Date(`${dateFrom}T00:00:00`);
    const matchesTo = !dateTo || created <= new Date(`${dateTo}T23:59:59`);

    return matchesSearch && matchesType && matchesFrom && matchesTo;
  });

  const activeFilterCount =
    (typeFilter !== "all" ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  // Calculate stats
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  
  const incomingToday = deliveryNotes.filter(n => n.type === 'incoming' && isToday(new Date(n.created_at))).length;
  const outgoingToday = deliveryNotes.filter(n => n.type === 'outgoing' && isToday(new Date(n.created_at))).length;
  const incomingMonth = deliveryNotes.filter(n => {
    const date = new Date(n.created_at);
    return n.type === 'incoming' && date >= monthStart && date <= monthEnd;
  }).length;
  const outgoingMonth = deliveryNotes.filter(n => {
    const date = new Date(n.created_at);
    return n.type === 'outgoing' && date >= monthStart && date <= monthEnd;
  }).length;

  const handleViewDetails = (note: any) => {
    setSelectedNote(note);
    setDetailsOpen(true);
  };

  // Deep link support: /delivery-notes?id=<uuid|LS-Nummer> opens that note.
  const deepLinkId = searchParams.get("id");
  useEffect(() => {
    if (!deepLinkId || isLoading || isError) return;
    const match = deliveryNotes.find(
      (n) => n.id === deepLinkId || n.note_id === deepLinkId
    );
    if (match) {
      setSelectedNote(match);
      setDetailsOpen(true);
    } else {
      toast({
        title: "Lieferschein nicht gefunden",
        description: `Es existiert kein Lieferschein mit der Kennung ${deepLinkId}.`,
        variant: "destructive",
      });
    }
    const params = new URLSearchParams(searchParams);
    params.delete("id");
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId, isLoading, isError, deliveryNotes]);

  // Older rows stored a (never resolvable) public URL instead of the object
  // path; storage.download() needs the bucket-relative path.
  const toStoragePath = (value: string) => {
    const marker = "/documents/";
    const index = value.indexOf(marker);
    return index >= 0 ? value.slice(index + marker.length) : value;
  };

  const handleDownloadPDF = async (note: any) => {
    if (!note.pdf_url) {
      toast({
        title: "Kein PDF vorhanden",
        description: `Für ${note.note_id} wurde kein PDF gespeichert.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(toStoragePath(note.pdf_url));

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Lieferschein_${note.note_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: "PDF konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!noteToDelete) return;

    try {
      // Delete the row first: an RLS-filtered delete returns zero rows and no
      // error, and the PDF must not be removed while the record survives.
      const { data: deleted, error } = await supabase
        .from("delivery_notes")
        .delete()
        .eq("id", noteToDelete.id)
        .select();

      if (error) throw error;

      if (!deleted || deleted.length === 0) {
        toast({
          title: "Fehler",
          description: "Keine Berechtigung oder Datensatz nicht gefunden.",
          variant: "destructive",
        });
        return;
      }

      if (noteToDelete.pdf_url) {
        const { error: storageError } = await supabase.storage
          .from("documents")
          .remove([toStoragePath(noteToDelete.pdf_url)]);
        if (storageError) {
          console.error("Storage delete error:", storageError);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      toast({ title: "Lieferschein gelöscht" });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Lieferschein konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageDescription
        title="Lieferscheine & Warenbewegungen"
        description="Dokumentieren Sie alle Warenein- und -ausgänge mit Lieferscheinen (LS-XXXX). Jeder Schein enthält Partner, Material, Gewicht, Chargen-Referenz und optional Abfallschlüssel. PDF-Export für Archivierung verfügbar."
        nextSteps={[
          "Neuen Lieferschein anlegen → Für Ein- oder Ausgang",
          "PDF herunterladen → Für Papierdokumentation",
          "Mit Auftrag verknüpfen → Für Nachverfolgung"
        ]}
        workflowLinks={[
          { label: "Materialeingang", path: "/intake", direction: "previous" },
          { label: "Ausgangsmaterial", path: "/output", direction: "previous" },
          { label: "Aufträge", path: "/orders", direction: "previous" },
          { label: "Traceability", path: "/traceability", direction: "next" },
        ]}
      />

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lieferscheine</h1>
          <p className="text-muted-foreground mt-1">Eingangs- und Ausgangslieferscheine verwalten</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Neuer Lieferschein
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Eingang heute</p>
          <p className="text-2xl font-bold text-foreground mt-1">{incomingToday}</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Ausgang heute</p>
          <p className="text-2xl font-bold text-foreground mt-1">{outgoingToday}</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Eingang diesen Monat</p>
          <p className="text-2xl font-bold text-foreground mt-1">{incomingMonth}</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Ausgang diesen Monat</p>
          <p className="text-2xl font-bold text-foreground mt-1">{outgoingMonth}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen nach ID, Partner, Material..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Filter className="h-4 w-4" />
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-4 bg-popover">
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Typen" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Alle Typen</SelectItem>
                  {Object.entries(typeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Datum von</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Datum bis</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={activeFilterCount === 0}
              onClick={() => {
                setTypeFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Filter zurücksetzen
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">Lieferscheine konnten nicht geladen werden</p>
            <p className="text-muted-foreground">
              Möglicherweise fehlt die Berechtigung oder die Verbindung ist unterbrochen.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Erneut versuchen
            </Button>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">Keine Lieferscheine gefunden</p>
            <p className="text-muted-foreground">Erstellen Sie einen neuen Lieferschein um zu beginnen.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Lieferschein-ID</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Charge</TableHead>
                <TableHead>Gewicht</TableHead>
                <TableHead>Abfallschlüssel</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNotes.map((note) => {
                const type = typeConfig[note.type as keyof typeof typeConfig] || typeConfig.incoming;
                const TypeIcon = type.icon;
                return (
                  <TableRow 
                    key={note.id} 
                    className="cursor-pointer"
                    onClick={() => handleViewDetails(note)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="font-mono font-medium">{note.note_id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium", type.class)}>
                        <TypeIcon className="h-3 w-3" />
                        {type.label}
                      </span>
                    </TableCell>
                    <TableCell>{format(new Date(note.created_at), "dd.MM.yyyy", { locale: de })}</TableCell>
                    <TableCell className="font-medium">{note.partner_name}</TableCell>
                    <TableCell>{note.material_description}</TableCell>
                    <TableCell className="font-mono text-sm">{note.batch_reference || "-"}</TableCell>
                    <TableCell>{Number(note.weight_kg).toLocaleString("de-DE")} kg</TableCell>
                    <TableCell className="font-mono text-sm">{note.waste_code || "-"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => handleViewDetails(note)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Anzeigen
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadPDF(note)}>
                            <Download className="h-4 w-4 mr-2" />
                            PDF herunterladen
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => {
                              setNoteToDelete(note);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <DeliveryNoteDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
      
      <DeliveryNoteDetailsDialog 
        open={detailsOpen} 
        onOpenChange={setDetailsOpen} 
        note={selectedNote} 
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lieferschein löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Der Lieferschein {noteToDelete?.note_id} wird dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
