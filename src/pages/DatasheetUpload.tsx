import { useState, useCallback } from "react";
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "analyzing" | "completed" | "error";
  progress: number;
  result?: any;
  error?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function DatasheetUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const { user } = useAuth();

  const validateFile = (file: File): string | null => {
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return "Nur PDF-Dateien sind erlaubt.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Die Datei ist zu groß (max. 10 MB). Aktuelle Größe: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    }
    return null;
  };

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: UploadedFile[] = [];

    fileArray.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        toast({
          title: "Ungültige Datei",
          description: `${file.name}: ${error}`,
          variant: "destructive",
        });
      } else {
        validFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          status: "pending",
          progress: 0,
        });
      }
    });

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadAndAnalyze = async (uploadFile: UploadedFile) => {
    if (!user) return;

    // Update status to uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, status: "uploading", progress: 10 } : f
      )
    );

    try {
      // Upload file to storage
      const fileExt = uploadFile.file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `datasheets/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, uploadFile.file);

      if (uploadError) throw uploadError;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, progress: 40 } : f
        )
      );

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      // Update status to analyzing
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: "analyzing", progress: 60 } : f
        )
      );

      // Call edge function for AI analysis
      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
        "analyze-datasheet",
        {
          body: {
            fileUrl: urlData.publicUrl,
            fileName: uploadFile.file.name,
          },
        }
      );

      if (analysisError) throw analysisError;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "completed", progress: 100, result: analysisResult }
            : f
        )
      );

      toast({
        title: "Analyse abgeschlossen",
        description: `${uploadFile.file.name} wurde erfolgreich analysiert.`,
      });
    } catch (error: any) {
      console.error("Upload/Analysis error:", error);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "error", error: error.message || "Unbekannter Fehler" }
            : f
        )
      );
      toast({
        title: "Fehler",
        description: `${uploadFile.file.name}: ${error.message || "Analyse fehlgeschlagen"}`,
        variant: "destructive",
      });
    }
  };

  const startUpload = () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    pendingFiles.forEach((file) => {
      uploadAndAnalyze(file);
    });
  };

  const getStatusIcon = (status: UploadedFile["status"]) => {
    switch (status) {
      case "pending":
        return <FileText className="h-5 w-5 text-muted-foreground" />;
      case "uploading":
      case "analyzing":
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case "completed":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getStatusText = (status: UploadedFile["status"]) => {
    switch (status) {
      case "pending":
        return "Bereit zum Hochladen";
      case "uploading":
        return "Wird hochgeladen...";
      case "analyzing":
        return "KI-Analyse läuft...";
      case "completed":
        return "Erfolgreich analysiert";
      case "error":
        return "Fehler aufgetreten";
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Datenblatt-Upload</h1>
        <p className="text-muted-foreground mt-1">
          Laden Sie PDF-Datenblätter hoch, um sie automatisch per KI analysieren zu lassen
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Dateien hochladen
            </CardTitle>
            <CardDescription>
              Nur PDF-Dateien, maximal 10 MB pro Datei
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Dateien hierher ziehen
                  </p>
                  <p className="text-sm text-muted-foreground">
                    oder klicken, um Dateien auszuwählen
                  </p>
                </div>
              </div>
            </div>

            {/* Start Upload Button */}
            {pendingCount > 0 && (
              <Button onClick={startUpload} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                {pendingCount} {pendingCount === 1 ? "Datei" : "Dateien"} hochladen & analysieren
              </Button>
            )}
          </CardContent>
        </Card>

        {/* File List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Hochgeladene Dateien
            </CardTitle>
            <CardDescription>
              {files.length === 0
                ? "Noch keine Dateien ausgewählt"
                : `${files.length} ${files.length === 1 ? "Datei" : "Dateien"}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Keine Dateien vorhanden</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border"
                  >
                    {getStatusIcon(file.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{file.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getStatusText(file.status)}
                        {file.error && ` - ${file.error}`}
                      </p>
                      {(file.status === "uploading" || file.status === "analyzing") && (
                        <Progress value={file.progress} className="h-1 mt-2" />
                      )}
                    </div>
                    {file.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(file.id)}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analysis Results */}
      {files.some((f) => f.status === "completed" && f.result) && (
        <Card>
          <CardHeader>
            <CardTitle>Analyse-Ergebnisse</CardTitle>
            <CardDescription>
              Automatisch extrahierte Informationen aus den Datenblättern
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {files
                .filter((f) => f.status === "completed" && f.result)
                .map((file) => (
                  <div key={file.id} className="p-4 rounded-lg border bg-card">
                    <h4 className="font-medium mb-2">{file.file.name}</h4>
                    <pre className="text-sm bg-muted p-3 rounded overflow-x-auto">
                      {JSON.stringify(file.result, null, 2)}
                    </pre>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
