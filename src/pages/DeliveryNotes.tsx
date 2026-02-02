import { useState } from "react";
import { Plus, Search, Filter, FileText, MoreVertical, Download, Mail, Eye, ArrowDownLeft, ArrowUpRight, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: deliveryNotes = [], isLoading } = useQuery({
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

  const filteredNotes = deliveryNotes.filter(
    (n) =>
      n.note_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.partner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.material_description.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handleDelete = async () => {
    if (!noteToDelete) return;
    
    try {
      if (noteToDelete.pdf_url) {
        await supabase.storage.from("documents").remove([noteToDelete.pdf_url]);
      }
      
      const { error } = await supabase
        .from("delivery_notes")
        .delete()
        .eq("id", noteToDelete.id);
      
      if (error) throw error;

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
        description="Dokumentieren Sie alle Warenein- und -ausgänge mit rechtskonformen Lieferscheinen. Jeder Schein enthält Chargen-Referenz, Gewicht und Abfallschlüssel."
        nextSteps={[
          "PDF herunterladen → Archivieren",
          "Per E-Mail senden → Partner informieren",
          "Traceability → Materialnachverfolgung"
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
        <Button variant="outline">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                          <DropdownMenuItem>
                            <Download className="h-4 w-4 mr-2" />
                            PDF herunterladen
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="h-4 w-4 mr-2" />
                            Per E-Mail senden
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
