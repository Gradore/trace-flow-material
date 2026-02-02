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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, X, Loader2, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useMaterialFlowHistory } from "@/hooks/useMaterialFlowHistory";
import { useAuth } from "@/contexts/AuthContext";

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedMaterialInputId?: string;
  preselectedSampleId?: string;
}

const tagOptions = [
  { value: "reach", label: "REACH Dokument" },
  { value: "delivery_note", label: "Lieferschein" },
  { value: "sample_report", label: "Laborbericht" },
  { value: "certificate", label: "Zertifikat" },
  { value: "photo", label: "Foto" },
];

export function DocumentUploadDialog({ 
  open, 
  onOpenChange,
  preselectedMaterialInputId,
  preselectedSampleId,
}: DocumentUploadDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { logEvent } = useMaterialFlowHistory();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    tag: "",
    linkType: "",
    linkId: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch options for linking
  const { data: materialInputs = [] } = useQuery({
    queryKey: ["material-inputs-for-docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_inputs")
        .select("id, input_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open && formData.linkType === "material_input",
  });

  const { data: containers = [] } = useQuery({
    queryKey: ["containers-for-docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("containers")
        .select("id, container_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open && formData.linkType === "container",
  });

  const { data: samples = [] } = useQuery({
    queryKey: ["samples-for-docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("samples")
        .select("id, sample_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open && formData.linkType === "sample",
  });

  const { data: outputMaterials = [] } = useQuery({
    queryKey: ["outputs-for-docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("output_materials")
        .select("id, output_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open && formData.linkType === "output_material",
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (selectedFile.size > maxSize) {
      toast({
        title: "Datei zu groß",
        description: "Die maximale Dateigröße beträgt 50 MB.",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const allowedTypes = ['pdf', 'jpg', 'jpeg', 'png', 'csv', 'doc', 'docx', 'xls', 'xlsx'];
    const fileExt = selectedFile.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedTypes.includes(fileExt)) {
      toast({
        title: "Dateityp nicht unterstützt",
        description: `Erlaubte Formate: ${allowedTypes.join(', ').toUpperCase()}`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Create unique file path - sanitize filename
      const timestamp = Date.now();
      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${timestamp}_${sanitizedName}`;

      // Upload to storage with retry
      let uploadAttempts = 0;
      let uploadError: Error | null = null;
      
      while (uploadAttempts < 2) {
        const result = await supabase.storage
          .from("documents")
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (!result.error) {
          uploadError = null;
          break;
        }
        
        uploadError = result.error;
        uploadAttempts++;
        
        if (uploadAttempts < 2) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      if (uploadError) {
        console.error("Upload storage error:", uploadError);
        throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);
      }

      // Prepare document record
      let materialInputId: string | null = null;
      let containerId: string | null = null;
      let sampleId: string | null = null;
      let outputMaterialId: string | null = null;

      // Add link based on selection
      if (formData.linkType === "material_input" && formData.linkId) {
        materialInputId = formData.linkId;
      } else if (formData.linkType === "container" && formData.linkId) {
        containerId = formData.linkId;
      } else if (formData.linkType === "sample" && formData.linkId) {
        sampleId = formData.linkId;
      } else if (formData.linkType === "output_material" && formData.linkId) {
        outputMaterialId = formData.linkId;
      }

      // Handle preselected values
      if (preselectedMaterialInputId) {
        materialInputId = preselectedMaterialInputId;
      }
      if (preselectedSampleId) {
        sampleId = preselectedSampleId;
      }

      // Insert document record
      const { error: dbError } = await supabase
        .from("documents")
        .insert([{
          name: selectedFile.name,
          file_url: filePath,
          file_type: fileExt || "unknown",
          file_size: selectedFile.size,
          tag: formData.tag || null,
          uploaded_by: user?.id || null,
          material_input_id: materialInputId,
          container_id: containerId,
          sample_id: sampleId,
          output_material_id: outputMaterialId,
        }]);

      if (dbError) throw dbError;

      // Log event
      await logEvent({
        eventType: "document_uploaded",
        eventDescription: `Dokument "${selectedFile.name}" hochgeladen`,
        eventDetails: {
          file_name: selectedFile.name,
          file_type: fileExt,
          tag: formData.tag,
        },
        materialInputId: materialInputId || undefined,
        containerId: containerId || undefined,
        sampleId: sampleId || undefined,
        outputMaterialId: outputMaterialId || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["sample-documents"] });

      toast({
        title: "Dokument hochgeladen",
        description: `${selectedFile.name} wurde erfolgreich gespeichert.`,
      });

      handleClose();
    } catch (error: any) {
      console.error("Upload error:", error);
      let errorMessage = "Das Dokument konnte nicht hochgeladen werden.";
      
      if (error.message) {
        if (error.message.includes("storage")) {
          errorMessage = "Speicherfehler: Bitte versuchen Sie es erneut.";
        } else if (error.message.includes("permission") || error.message.includes("policy")) {
          errorMessage = "Keine Berechtigung zum Hochladen. Bitte kontaktieren Sie den Administrator.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Fehler beim Hochladen",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFormData({ tag: "", linkType: "", linkId: "" });
    setSelectedFile(null);
    onOpenChange(false);
  };

  const getLinkOptions = () => {
    switch (formData.linkType) {
      case "material_input":
        return materialInputs.map((m) => ({ value: m.id, label: m.input_id }));
      case "container":
        return containers.map((c) => ({ value: c.id, label: c.container_id }));
      case "sample":
        return samples.map((s) => ({ value: s.id, label: s.sample_id }));
      case "output_material":
        return outputMaterials.map((o) => ({ value: o.id, label: o.output_id }));
      default:
        return [];
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Dokument hochladen
          </DialogTitle>
          <DialogDescription>
            Laden Sie ein Dokument hoch und verknüpfen Sie es optional mit einem Datensatz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Selection */}
          <div className="space-y-2">
            <Label>Datei auswählen</Label>
            {selectedFile ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-secondary/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Datei wählen</p>
                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG, CSV</p>
                </div>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-secondary/30 transition-colors"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Foto aufnehmen</p>
                  <p className="text-xs text-muted-foreground">Kamera verwenden</p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.csv"
              onChange={handleFileSelect}
            />
            <input
              ref={cameraInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
            />
          </div>

          {/* Tag Selection */}
          <div className="space-y-2">
            <Label>Dokumenttyp / Tag</Label>
            <Select
              value={formData.tag}
              onValueChange={(value) => setFormData({ ...formData, tag: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {tagOptions.map((tag) => (
                  <SelectItem key={tag.value} value={tag.value}>
                    {tag.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Link Type Selection */}
          {!preselectedMaterialInputId && !preselectedSampleId && (
            <>
              <div className="space-y-2">
                <Label>Verknüpfen mit (optional)</Label>
                <Select
                  value={formData.linkType}
                  onValueChange={(value) => setFormData({ ...formData, linkType: value, linkId: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nicht verknüpft" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="material_input">Materialeingang</SelectItem>
                    <SelectItem value="container">Container</SelectItem>
                    <SelectItem value="sample">Probe</SelectItem>
                    <SelectItem value="output_material">Ausgangsmaterial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.linkType && (
                <div className="space-y-2">
                  <Label>Datensatz auswählen</Label>
                  <Select
                    value={formData.linkId}
                    onValueChange={(value) => setFormData({ ...formData, linkId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auswählen" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {getLinkOptions().map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || isUploading}
          >
            {isUploading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Hochladen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
