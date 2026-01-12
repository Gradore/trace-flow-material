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
import { Upload, FileText, X, Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useMaterialFlowHistory } from "@/hooks/useMaterialFlowHistory";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FileUploadStatus {
  file: File;
  status: "pending" | "uploading" | "analyzing" | "success" | "error";
  extractedData?: any;
  error?: string;
}

const documentTypes = [
  { value: "delivery_note", label: "Lieferscheine" },
  { value: "sample_report", label: "Laborberichte" },
  { value: "material_intake", label: "Materialeingänge" },
  { value: "auto", label: "Automatisch erkennen" },
];

export function BulkUploadDialog({ open, onOpenChange }: BulkUploadDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { logEvent } = useMaterialFlowHistory();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [documentType, setDocumentType] = useState("auto");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [enableOCR, setEnableOCR] = useState(true);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles = selectedFiles.map(file => ({
      file,
      status: "pending" as const,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const readFileAsText = async (file: File): Promise<string> => {
    // For PDFs and images, we'll need to extract text
    // For now, return the file name as placeholder
    // In production, you'd use a proper PDF parser or send the base64 to the AI
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // For images, convert to base64 for AI vision
        if (file.type.startsWith("image/")) {
          resolve(`[Bild: ${file.name}]\nBase64: ${result.split(",")[1]?.substring(0, 500)}...`);
        } else if (file.type === "application/pdf") {
          // For PDFs, we'll send a placeholder - in production use pdf.js
          resolve(`[PDF Dokument: ${file.name}]`);
        } else {
          resolve(result);
        }
      };
      reader.onerror = () => resolve("");
      if (file.type.startsWith("image/")) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const processFiles = async () => {
    setIsProcessing(true);
    
    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i);
      const fileStatus = files[i];
      
      // Update status to uploading
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: "uploading" } : f
      ));

      try {
        // Upload file to storage
        const timestamp = Date.now();
        const filePath = `${timestamp}_${fileStatus.file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, fileStatus.file);

        if (uploadError) throw uploadError;

        let extractedData = null;
        
        if (enableOCR) {
          // Update status to analyzing
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, status: "analyzing" } : f
          ));

          // Read file content for OCR
          const fileContent = await readFileAsText(fileStatus.file);
          
          // Call OCR analysis
          const { data: ocrResult, error: ocrError } = await supabase.functions.invoke(
            "analyze-document-ocr",
            {
              body: {
                fileContent,
                fileName: fileStatus.file.name,
                documentType: documentType === "auto" ? null : documentType,
              },
            }
          );

          if (!ocrError && ocrResult?.success) {
            extractedData = ocrResult.data;
          }
        }

        // Determine tag from file name or extracted data
        let tag = null;
        const fileName = fileStatus.file.name.toLowerCase();
        if (fileName.includes("lieferschein") || documentType === "delivery_note") {
          tag = "delivery_note";
        } else if (fileName.includes("labor") || fileName.includes("bericht") || documentType === "sample_report") {
          tag = "sample_report";
        } else if (fileName.includes("zertifikat")) {
          tag = "certificate";
        }

        // Insert document record
        const fileExt = fileStatus.file.name.split(".").pop() || "unknown";
        const { error: dbError } = await supabase
          .from("documents")
          .insert([{
            name: fileStatus.file.name,
            file_url: filePath,
            file_type: fileExt,
            file_size: fileStatus.file.size,
            tag,
            uploaded_by: user?.id || null,
          }]);

        if (dbError) throw dbError;

        // Log event
        await logEvent({
          eventType: "document_uploaded",
          eventDescription: `Dokument "${fileStatus.file.name}" hochgeladen (Massenupload)`,
          eventDetails: {
            file_name: fileStatus.file.name,
            file_type: fileExt,
            tag,
            ocr_extracted: !!extractedData,
            extracted_data: extractedData,
          },
        });

        // Update status to success
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: "success", extractedData } : f
        ));

      } catch (error: any) {
        console.error("Upload error:", error);
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: "error", error: error.message } : f
        ));
      }
    }

    queryClient.invalidateQueries({ queryKey: ["documents"] });
    setIsProcessing(false);

    const successCount = files.filter(f => f.status === "success").length;
    toast({
      title: "Upload abgeschlossen",
      description: `${successCount} von ${files.length} Dokumenten erfolgreich hochgeladen.`,
    });
  };

  const handleClose = () => {
    if (!isProcessing) {
      setFiles([]);
      setDocumentType("auto");
      setCurrentFileIndex(0);
      onOpenChange(false);
    }
  };

  const progress = isProcessing ? ((currentFileIndex + 1) / files.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Massenupload mit KI-Analyse
          </DialogTitle>
          <DialogDescription>
            Laden Sie mehrere Dokumente hoch. Die KI extrahiert automatisch relevante Daten per OCR.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Type Selection */}
          <div className="space-y-2">
            <Label>Dokumenttyp</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {documentTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* OCR Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableOCR"
              checked={enableOCR}
              onChange={(e) => setEnableOCR(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="enableOCR" className="flex items-center gap-2 cursor-pointer">
              <Sparkles className="h-4 w-4 text-primary" />
              KI-Textanalyse aktivieren (OCR)
            </Label>
          </div>

          {/* File Drop Zone */}
          {files.length === 0 ? (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-secondary/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Dateien auswählen oder hierher ziehen</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG - Mehrfachauswahl möglich</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{files.length} Dateien ausgewählt</span>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Weitere hinzufügen
                </Button>
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Verarbeite {currentFileIndex + 1} von {files.length}...
                  </p>
                </div>
              )}

              <ScrollArea className="h-[200px] rounded-lg border border-border">
                <div className="p-2 space-y-2">
                  {files.map((fileStatus, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30"
                    >
                      <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fileStatus.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(fileStatus.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      
                      {fileStatus.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeFile(index)}
                          disabled={isProcessing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      {fileStatus.status === "uploading" && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      )}
                      {fileStatus.status === "analyzing" && (
                        <div className="flex items-center gap-1">
                          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                          <span className="text-xs text-primary">KI-Analyse...</span>
                        </div>
                      )}
                      {fileStatus.status === "success" && (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      )}
                      {fileStatus.status === "error" && (
                        <div className="flex items-center gap-1" title={fileStatus.error}>
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.csv"
            multiple
            onChange={handleFileSelect}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            {isProcessing ? "Wird verarbeitet..." : "Abbrechen"}
          </Button>
          <Button 
            onClick={processFiles} 
            disabled={files.length === 0 || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Verarbeite...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {files.length} Dateien hochladen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
