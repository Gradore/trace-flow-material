import { useState, useCallback } from "react";
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle, FileSearch, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
  const [datasheetText, setDatasheetText] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Previously stored analyses so the page is not empty after a reload
  const {
    data: analyses = [],
    isLoading: analysesLoading,
    isError: analysesError,
    refetch: refetchAnalyses,
  } = useQuery({
    queryKey: ["datasheet-analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("datasheet_analyses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const validateFile = (file: File): string | null => {
    // Check file type first
    const isPDF = file.type === "application/pdf" ||
                  file.type.includes("pdf") ||
                  file.name.toLowerCase().endsWith(".pdf");

    if (!isPDF) {
      return "Ungültiges Dateiformat. Es werden nur PDF-Dateien akzeptiert (.pdf).";
    }

    if (file.size > MAX_FILE_SIZE) {
      return `Die Datei ist zu groß (max. 10 MB). Aktuelle Größe: ${(file.size / 1024 / 1024).toFixed(2)} MB. Bitte komprimieren Sie die Datei.`;
    }

    if (file.size === 0) {
      return "Die Datei ist leer oder beschädigt. Bitte wählen Sie eine gültige PDF-Datei.";
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
      // documents.uploaded_by / datasheet_analyses.created_by reference
      // profiles(id) - a surrogate key that is never equal to auth.uid().
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profileError) {
        console.error("Profile lookup error:", profileError);
      }
      const profileId = profile?.id ?? null;

      // Upload file to storage. The storage delete policy matches on the first
      // path segment being the auth user id.
      const fileExt = uploadFile.file.name.split(".").pop() || "pdf";
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${user.id}/datasheets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, uploadFile.file);

      if (uploadError) throw uploadError;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, progress: 40 } : f
        )
      );

      // Register the file as a document so it stays reachable after the upload
      const { data: documentRow, error: documentError } = await supabase
        .from("documents")
        .insert({
          name: uploadFile.file.name,
          file_url: filePath,
          file_type: fileExt.toLowerCase(),
          file_size: uploadFile.file.size,
          tag: "other",
          document_type: "datasheet",
          uploaded_by: profileId,
        })
        .select("id")
        .single();

      if (documentError) throw documentError;

      const trimmedText = datasheetText.trim();

      // Without datasheet text there is nothing the analysis function can read
      // (a PDF cannot be parsed in the browser), so the file is only archived.
      if (!trimmedText) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: "completed", progress: 100 } : f
          )
        );
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        toast({
          title: "Datenblatt gespeichert",
          description: `${uploadFile.file.name} wurde abgelegt. Für die KI-Analyse fügen Sie den Datenblatt-Text ein.`,
        });
        return;
      }

      // Update status to analyzing
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: "analyzing", progress: 60 } : f
        )
      );

      // Call edge function for AI analysis (contract: datasheetText + analysisType)
      const { data: analysisResponse, error: analysisError } = await supabase.functions.invoke(
        "analyze-datasheet",
        {
          body: {
            datasheetText: trimmedText,
            materialContext: `Datenblatt: ${uploadFile.file.name}`,
            analysisType: "recipe_matching",
          },
        }
      );

      if (analysisError) throw analysisError;

      const result = analysisResponse?.result;
      if (!result) {
        throw new Error("Die KI hat kein Analyseergebnis zurückgegeben.");
      }

      // Persist the analysis so it survives a page reload
      const { data: analysisId, error: idError } = await supabase
        .rpc("generate_unique_id", { prefix: "DB" });
      if (idError) throw idError;

      const { error: persistError } = await supabase
        .from("datasheet_analyses")
        .insert({
          analysis_id: analysisId,
          document_id: documentRow.id,
          original_filename: uploadFile.file.name,
          extracted_properties: result.properties ?? result,
          material_type: result.material_type ?? null,
          material_grade: result.material_grade ?? null,
          analysis_summary: result.summary ?? null,
          suggested_applications: Array.isArray(result.applications)
            ? result.applications.map((a: any) => a?.name).filter(Boolean)
            : null,
          status: "analyzed",
          analyzed_at: new Date().toISOString(),
          created_by: profileId,
        });

      if (persistError) throw persistError;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "completed", progress: 100, result }
            : f
        )
      );

      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["datasheet-analyses"] });

      toast({
        title: "Analyse abgeschlossen",
        description: `${uploadFile.file.name} wurde erfolgreich analysiert.`,
      });
    } catch (error: any) {
      console.error("Upload/Analysis error:", error);

      // Provide specific error messages based on error type
      let errorMessage = "Unbekannter Fehler";
      if (error.message?.includes("storage")) {
        errorMessage = "Fehler beim Hochladen. Bitte überprüfen Sie Ihre Internetverbindung.";
      } else if (error.message?.includes("timeout")) {
        errorMessage = "Zeitüberschreitung bei der Analyse. Die Datei ist möglicherweise zu komplex.";
      } else if (error.message?.includes("parse") || error.message?.includes("PDF")) {
        errorMessage = "Die PDF-Datei konnte nicht gelesen werden. Möglicherweise ist sie beschädigt oder passwortgeschützt.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "error", error: errorMessage }
            : f
        )
      );
      toast({
        title: "Fehler bei der Verarbeitung",
        description: `${uploadFile.file.name}: ${errorMessage}`,
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
        return "Erfolgreich gespeichert";
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
          Laden Sie PDF-Datenblätter hoch und lassen Sie den Datenblatt-Text per KI analysieren
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

            {/* Datasheet text for the AI analysis */}
            <div className="space-y-2">
              <Label htmlFor="datasheet-text" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Datenblatt-Text für die KI-Analyse
              </Label>
              <Textarea
                id="datasheet-text"
                rows={6}
                placeholder="Text aus dem Datenblatt hier einfügen (Kennwerte, Zusammensetzung, Verarbeitungshinweise)..."
                value={datasheetText}
                onChange={(e) => setDatasheetText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Der Inhalt einer PDF kann im Browser nicht ausgelesen werden. Ohne eingefügten
                Text wird die Datei nur archiviert, es findet keine KI-Analyse statt.
              </p>
            </div>

            {/* Start Upload Button */}
            {pendingCount > 0 && (
              <Button onClick={startUpload} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                {pendingCount} {pendingCount === 1 ? "Datei" : "Dateien"}{" "}
                {datasheetText.trim() ? "hochladen & analysieren" : "hochladen"}
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

      {/* Stored analyses */}
      <Card>
        <CardHeader>
          <CardTitle>Analyse-Ergebnisse</CardTitle>
          <CardDescription>
            Gespeicherte KI-Analysen der hochgeladenen Datenblätter
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analysesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : analysesError ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
              <p className="text-foreground font-medium">Analysen konnten nicht geladen werden</p>
              <p className="text-sm mt-1">
                Möglicherweise fehlt die Berechtigung oder die Verbindung ist unterbrochen.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => refetchAnalyses()}>
                Erneut versuchen
              </Button>
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSearch className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Noch keine Analysen vorhanden</p>
            </div>
          ) : (
            <div className="space-y-4">
              {analyses.map((analysis) => (
                <div key={analysis.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-medium">
                      {analysis.original_filename || analysis.analysis_id}
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(analysis.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </span>
                  </div>
                  {analysis.material_type && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Materialtyp: {analysis.material_type}
                      {analysis.material_grade ? ` (${analysis.material_grade})` : ""}
                    </p>
                  )}
                  {analysis.analysis_summary && (
                    <p className="text-sm mt-2">{analysis.analysis_summary}</p>
                  )}
                  {analysis.suggested_applications && analysis.suggested_applications.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Anwendungen: {analysis.suggested_applications.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
