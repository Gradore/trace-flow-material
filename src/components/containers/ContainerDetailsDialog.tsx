import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, QrCode, Download, Loader2, Trash2, Save } from "lucide-react";
import { generateLabelPDF, downloadPDF } from "@/lib/pdf";
import { buildContainerQRUrl } from "@/lib/qrcode";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Container {
  id: string;
  container_id: string;
  type: string;
  weight_kg: number | null;
  location: string | null;
  status: string;
  qr_code: string | null;
  created_at: string;
}

interface ContainerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: Container | null;
}

const containerTypes = {
  bigbag: { label: "BigBag", prefix: "BB" },
  box: { label: "Box", prefix: "BX" },
  cage: { label: "Gitterbox", prefix: "GX" },
  container: { label: "Container", prefix: "CT" },
};

const statusOptions = [
  { value: "empty", label: "Leer" },
  { value: "filling", label: "Befüllung" },
  { value: "full", label: "Voll" },
  { value: "in_processing", label: "In Verarbeitung" },
  { value: "processed", label: "Verarbeitet" },
];

export function ContainerDetailsDialog({ open, onOpenChange, container }: ContainerDetailsDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    type: container?.type || "",
    weight: container?.weight_kg?.toString() || "",
    location: container?.location || "",
    status: container?.status || "empty",
  });

  // Update form when container changes
  if (container && formData.type !== container.type && formData.location !== container.location) {
    setFormData({
      type: container.type,
      weight: container.weight_kg?.toString() || "",
      location: container.location || "",
      status: container.status,
    });
  }

  const handleSave = async () => {
    if (!container) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("containers")
        .update({
          type: formData.type,
          weight_kg: formData.weight ? parseFloat(formData.weight) : null,
          location: formData.location || null,
          status: formData.status,
        })
        .eq("id", container.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["containers"] });
      toast({
        title: "Container aktualisiert",
        description: `${container.container_id} wurde erfolgreich aktualisiert.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Container konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!container) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("containers")
        .delete()
        .eq("id", container.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["containers"] });
      toast({
        title: "Container gelöscht",
        description: `${container.container_id} wurde unwiderruflich gelöscht.`,
      });
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Container konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadLabel = async () => {
    if (!container) return;

    setIsGenerating(true);
    try {
      const qrUrl = buildContainerQRUrl(container.container_id);
      const typeLabel = containerTypes[container.type as keyof typeof containerTypes]?.label || container.type;
      const pdfBlob = await generateLabelPDF(
        {
          id: container.container_id,
          type: typeLabel,
          location: container.location || "Nicht zugewiesen",
          date: new Date(container.created_at).toLocaleDateString("de-DE"),
        },
        qrUrl
      );

      downloadPDF(pdfBlob, `Etikett_${container.container_id}.pdf`);

      toast({
        title: "Etikett heruntergeladen",
        description: "Das PDF-Etikett mit QR-Code wurde erstellt.",
      });
    } catch (error) {
      console.error("Error generating label:", error);
      toast({
        title: "Fehler",
        description: "Das Etikett konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!container) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Container bearbeiten
            </DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Details für Container {container.container_id}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Container ID (read-only) */}
            <div className="p-3 rounded-lg bg-secondary/30 border border-dashed border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <QrCode className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-mono text-lg font-bold text-foreground">{container.container_id}</p>
                  <p className="text-xs text-muted-foreground">
                    Erstellt am {new Date(container.created_at).toLocaleDateString("de-DE")}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Container-Typ</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Typ wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="bigbag">BigBag</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="cage">Gitterbox</SelectItem>
                    <SelectItem value="container">Container</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Gewicht (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  placeholder="z.B. 500"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Standort</Label>
                <Input
                  id="location"
                  placeholder="z.B. Halle A, Regal 12"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            {/* QR Label Download */}
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleDownloadLabel}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              QR-Etikett herunterladen
            </Button>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteConfirm(true)}
              className="sm:mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Löschen
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Save className="h-4 w-4 mr-2" />
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Container löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Container <strong>{container.container_id}</strong> wirklich unwiderruflich löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Unwiderruflich löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
