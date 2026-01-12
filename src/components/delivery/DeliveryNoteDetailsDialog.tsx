import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Calendar, 
  Package, 
  Scale, 
  Building2, 
  ArrowDownLeft, 
  ArrowUpRight,
  Trash2,
  Download,
  ExternalLink 
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeliveryNote {
  id: string;
  note_id: string;
  type: string;
  partner_name: string;
  material_description: string;
  weight_kg: number;
  waste_code: string | null;
  batch_reference: string | null;
  created_at: string;
  pdf_url: string | null;
  material_input_id: string | null;
  output_material_id: string | null;
}

interface DeliveryNoteDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: DeliveryNote | null;
}

const typeConfig = {
  incoming: { label: "Eingang", icon: ArrowDownLeft, class: "bg-info/10 text-info" },
  outgoing: { label: "Ausgang", icon: ArrowUpRight, class: "bg-success/10 text-success" },
};

export function DeliveryNoteDetailsDialog({ open, onOpenChange, note }: DeliveryNoteDetailsDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!note) return null;

  const type = typeConfig[note.type as keyof typeof typeConfig] || typeConfig.incoming;
  const TypeIcon = type.icon;

  const handleDelete = async () => {
    try {
      // Delete PDF from storage if exists
      if (note.pdf_url) {
        await supabase.storage.from("documents").remove([note.pdf_url]);
      }
      
      // Delete from database
      const { error } = await supabase
        .from("delivery_notes")
        .delete()
        .eq("id", note.id);
      
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      toast({ title: "Lieferschein gelöscht" });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Lieferschein konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPDF = async () => {
    if (!note.pdf_url) return;
    
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(note.pdf_url);
      
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Lieferschein Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header with ID and Type */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
            <div>
              <p className="text-sm text-muted-foreground">Lieferschein-Nr.</p>
              <p className="text-lg font-mono font-bold">{note.note_id}</p>
            </div>
            <Badge className={cn("text-sm", type.class)}>
              <TypeIcon className="h-4 w-4 mr-1" />
              {type.label}
            </Badge>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Datum</span>
              </div>
              <p className="font-medium pl-6">
                {format(new Date(note.created_at), "dd. MMMM yyyy", { locale: de })}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Scale className="h-4 w-4" />
                <span className="text-sm">Gewicht</span>
              </div>
              <p className="font-medium pl-6">
                {Number(note.weight_kg).toLocaleString("de-DE")} kg
              </p>
            </div>

            <div className="space-y-1 col-span-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="text-sm">{note.type === "incoming" ? "Lieferant" : "Kunde"}</span>
              </div>
              <Button 
                variant="link" 
                className="p-0 h-auto pl-6 font-medium"
                onClick={() => {
                  navigate("/companies");
                  onOpenChange(false);
                }}
              >
                {note.partner_name}
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>

            <div className="space-y-1 col-span-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <span className="text-sm">Material</span>
              </div>
              <p className="font-medium pl-6">{note.material_description}</p>
            </div>

            {note.batch_reference && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Chargen-Nr.</p>
                <Button 
                  variant="link" 
                  className="p-0 h-auto font-mono font-medium"
                  onClick={() => {
                    if (note.material_input_id) {
                      navigate("/intake");
                    } else if (note.output_material_id) {
                      navigate("/output");
                    }
                    onOpenChange(false);
                  }}
                >
                  {note.batch_reference}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}

            {note.waste_code && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Abfallschlüssel</p>
                <p className="font-mono font-medium">{note.waste_code}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-4 border-t border-border">
            {note.pdf_url && (
              <Button variant="outline" onClick={handleDownloadPDF}>
                <Download className="h-4 w-4 mr-2" />
                PDF herunterladen
              </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="ml-auto">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Lieferschein löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Aktion kann nicht rückgängig gemacht werden. Der Lieferschein {note.note_id} wird dauerhaft gelöscht.
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
