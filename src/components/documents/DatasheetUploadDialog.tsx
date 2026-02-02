import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { FileUp, Upload, X, Loader2, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface DatasheetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DatasheetUploadDialog({ open, onOpenChange }: DatasheetUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [linkedMaterialId, setLinkedMaterialId] = useState("");
  const [linkedOutputId, setLinkedOutputId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch material inputs for linking
  const { data: materialInputs = [] } = useQuery({
    queryKey: ["material-inputs-for-datasheet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_inputs")
        .select("id, input_id, material_type")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch output materials for linking
  const { data: outputMaterials = [] } = useQuery({
    queryKey: ["output-materials-for-datasheet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("output_materials")
        .select("id, output_id, batch_id, output_type")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Only allow PDF files for datasheets
      if (file.type !== 'application/pdf') {
        toast({
          title: "Ungültiger Dateityp",
          description: "Nur PDF-Dateien werden für Datenblätter akzeptiert.",
          variant: "destructive",
        });
        return;
      }

      // Max file size: 20MB
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "Datei zu groß",
          description: "Die maximale Dateigröße beträgt 20 MB.",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // Create unique file path
      const timestamp = Date.now();
      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `datasheets/${timestamp}_${sanitizedName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      // Save document reference
      const { error: dbError } = await supabase.from("documents").insert({
        name: selectedFile.name,
        file_url: urlData.publicUrl,
        file_type: 'pdf',
        file_size: selectedFile.size,
        tag: 'datasheet',
        material_input_id: linkedMaterialId || null,
        output_material_id: linkedOutputId || null,
      });

      if (dbError) {
        console.error("DB error:", dbError);
        throw new Error(`Dokumenteintrag konnte nicht erstellt werden: ${dbError.message}`);
      }

      toast({
        title: "Datenblatt hochgeladen",
        description: `${selectedFile.name} wurde erfolgreich gespeichert.`,
      });

      queryClient.invalidateQueries({ queryKey: ["documents"] });
      handleClose();
    } catch (error: any) {
      console.error("Datasheet upload failed:", error);
      toast({
        title: "Upload fehlgeschlagen",
        description: error.message || "Das Datenblatt konnte nicht hochgeladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setLinkedMaterialId("");
    setLinkedOutputId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Datenblatt hochladen
          </DialogTitle>
          <DialogDescription>
            Laden Sie ein PDF-Datenblatt hoch und verknüpfen Sie es optional mit einem Material oder einer Charge.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Area */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Klicken Sie hier oder ziehen Sie eine PDF-Datei hierher
                </p>
                <p className="text-xs text-muted-foreground">
                  Maximal 20 MB, nur PDF
                </p>
              </div>
            )}
          </div>

          {/* Material Linking */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mit Materialeingang verknüpfen</Label>
              <Select value={linkedMaterialId} onValueChange={setLinkedMaterialId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine Verknüpfung</SelectItem>
                  {materialInputs.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.input_id} - {m.material_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mit Ausgangsmaterial verknüpfen</Label>
              <Select value={linkedOutputId} onValueChange={setLinkedOutputId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine Verknüpfung</SelectItem>
                  {outputMaterials.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.output_id} - {o.batch_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-3 rounded-lg bg-info/10 border border-info/20 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong>Hinweis:</strong> Das hochgeladene Datenblatt wird für eine spätere KI-Analyse gespeichert. 
              Die automatische Extraktion von Materialeigenschaften erfolgt in einer zukünftigen Version.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Hochladen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
