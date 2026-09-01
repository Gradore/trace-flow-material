/**
 * Dokumentenablage (plan 5.10) for one project record.
 *
 * Lists, uploads and deletes the documents attached through
 * public.documents.linked_to_type / linked_to_id. Photos and videos are shown
 * as a gallery, everything else as a file list — mobile first, because the
 * pictures are taken with a phone standing at the machine.
 */
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Film,
  FileText,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { ErrorState, formatDateTime } from "@/components/project/ProjectUI";
import {
  ACCEPTED_EXTENSIONS,
  DOCUMENT_BUCKET,
  DOCUMENT_TYPES,
  MAX_UPLOAD_BYTES,
  type DocumentEntityType,
  type ProjectDocument,
  documentTypeLabel,
  fileExtension,
  formatFileSize,
  isGalleryDocument,
  isVideoDocument,
  projectDocumentKey,
  resolveProfileId,
  sanitizeObjectName,
  suggestedDocumentType,
  useLinkedDocuments,
  useSignedDocumentUrls,
} from "@/components/project/ProjectDocumentsShared";

const NOT_FOUND = "Keine Berechtigung oder Datensatz nicht gefunden.";

interface ProjectDocumentsProps {
  entityType: DocumentEntityType;
  entityId: string;
  title?: string;
  /** Short hint under the heading, e.g. what belongs into this store. */
  description?: string;
}

export function ProjectDocuments({
  entityType,
  entityId,
  title = "Dokumente",
  description,
}: ProjectDocumentsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("datasheet");
  const [displayName, setDisplayName] = useState("");
  const [toDelete, setToDelete] = useState<ProjectDocument | null>(null);

  const documentsQuery = useLinkedDocuments(entityType, entityId);
  const documents = documentsQuery.data ?? [];
  const urlsQuery = useSignedDocumentUrls(documents.map((doc) => doc.file_url));
  const urlFor = (doc: ProjectDocument) => urlsQuery.data?.[doc.file_url];

  const gallery = documents.filter(isGalleryDocument);
  const files = documents.filter((doc) => !isGalleryDocument(doc));

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: projectDocumentKey(entityType, entityId) });

  const resetForm = () => {
    setFile(null);
    setDisplayName("");
    setDocumentType("datasheet");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    setFile(picked);
    setDisplayName(picked.name);
    setDocumentType(suggestedDocumentType(picked.name));
  };

  /* -------------------------------------------------------------- upload */

  const upload = useMutation({
    mutationFn: async (selected: File) => {
      const extension = fileExtension(selected.name);
      if (!ACCEPTED_EXTENSIONS.includes(extension)) {
        throw new Error(`Erlaubte Formate: ${ACCEPTED_EXTENSIONS.join(", ").toUpperCase()}`);
      }
      if (selected.size > MAX_UPLOAD_BYTES) {
        throw new Error("Die maximale Dateigröße beträgt 50 MB.");
      }

      // documents.uploaded_by references profiles(id), never auth.uid().
      const profileId = await resolveProfileId(user?.id);

      // The storage policies key the per-user folder off auth.uid(), so the
      // object must live below it. The key itself must stay ASCII.
      const objectKey = [
        user?.id ?? "shared",
        "projekt",
        entityType,
        `${Date.now()}_${sanitizeObjectName(selected.name)}`,
      ].join("/");

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(objectKey, selected, { cacheControl: "3600", upsert: false });
      if (uploadError) throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);

      const { data, error } = await supabase
        .from("documents")
        .insert({
          name: displayName.trim() || selected.name,
          file_url: objectKey,
          file_type: extension,
          file_size: selected.size,
          document_type: documentType,
          linked_to_type: entityType,
          linked_to_id: entityId,
          uploaded_by: profileId,
        })
        .select("id");
      if (error || !data || data.length === 0) {
        // Never leave an orphan object behind when the row was rejected.
        await supabase.storage.from(DOCUMENT_BUCKET).remove([objectKey]);
        throw new Error(error?.message ?? NOT_FOUND);
      }
    },
    onSuccess: () => {
      toast({ title: "Dokument hochgeladen" });
      resetForm();
      refresh();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Dokument konnte nicht hochgeladen werden",
        description: error.message,
      });
    },
  });

  /* -------------------------------------------------------------- delete */

  const remove = useMutation({
    mutationFn: async (doc: ProjectDocument) => {
      // The row is the authoritative permission check - RLS can filter the
      // delete away silently, so the returned rows decide success.
      const { data, error } = await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error(NOT_FOUND);

      const { error: storageError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .remove([doc.file_url]);
      // The record is gone either way; a left-over object is not worth an
      // error the user cannot act on.
      if (storageError) console.error("ProjectDocuments delete object:", storageError);
    },
    onSuccess: () => {
      toast({ title: "Dokument gelöscht" });
      setToDelete(null);
      refresh();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Dokument konnte nicht gelöscht werden",
        description: error.message,
      });
    },
  });

  /* ---------------------------------------------------------------- view */

  return (
    <div className="space-y-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge variant="outline" className="text-xs">{documents.length}</Badge>
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>

      {/* ------------------------------------------------------- upload */}
      <div className="space-y-3 rounded-lg border border-border p-3">
        {file ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Auswahl verwerfen"
              disabled={upload.isPending}
              onClick={resetForm}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto flex-col gap-1 py-3"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-5 w-5" aria-hidden />
              <span className="text-xs">Datei wählen</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto flex-col gap-1 py-3"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-5 w-5" aria-hidden />
              <span className="text-xs">Foto aufnehmen</span>
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_EXTENSIONS.map((entry) => `.${entry}`).join(",")}
          onChange={(event) => pickFile(event.target.files?.[0])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={(event) => pickFile(event.target.files?.[0])}
        />

        {file && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`doc-name-${entityId}`}>Bezeichnung</Label>
              <Input
                id={`doc-name-${entityId}`}
                value={displayName}
                disabled={upload.isPending}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Dateiname"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`doc-type-${entityId}`}>Dokumenttyp</Label>
              <Select
                value={documentType}
                onValueChange={setDocumentType}
                disabled={upload.isPending}
              >
                <SelectTrigger id={`doc-type-${entityId}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={upload.isPending}
              onClick={() => upload.mutate(file)}
            >
              {upload.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Hochladen
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Max. 50 MB · {ACCEPTED_EXTENSIONS.join(", ").toUpperCase()}
        </p>
      </div>

      {/*
        Without this the failure is silent: every thumbnail stays a skeleton and
        every "Öffnen" button is disabled for good, with nothing telling the
        user why. The list itself is still readable, so this is a hint, not a
        replacement for the list.
      */}
      {urlsQuery.isError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="min-w-0 text-xs text-destructive">
            Die Vorschau- und Download-Links konnten nicht erzeugt werden.
          </p>
          <Button variant="outline" size="sm" onClick={() => void urlsQuery.refetch()}>
            Erneut versuchen
          </Button>
        </div>
      )}

      {/* --------------------------------------------------------- list */}
      {documentsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : documentsQuery.isError ? (
        <ErrorState
          error={documentsQuery.error as Error}
          onRetry={() => void documentsQuery.refetch()}
        />
      ) : documents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Noch keine Dokumente hinterlegt. Fotos, Prüfberichte und Datenblätter gehören hierher.
        </p>
      ) : (
        <div className="space-y-4">
          {gallery.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                Fotos &amp; Videos ({gallery.length})
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {gallery.map((doc) => {
                  const url = urlFor(doc);
                  const video = isVideoDocument(doc);
                  return (
                    <figure key={doc.id} className="min-w-0 space-y-1">
                      <div className="relative overflow-hidden rounded-md border border-border bg-muted">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block aspect-square"
                            aria-label={`${doc.name} öffnen`}
                          >
                            {video ? (
                              <span className="flex h-full w-full items-center justify-center">
                                <Film className="h-8 w-8 text-muted-foreground" aria-hidden />
                              </span>
                            ) : (
                              <img
                                src={url}
                                alt={doc.name}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            )}
                          </a>
                        ) : urlsQuery.isError ? (
                          <span className="flex aspect-square w-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                            Vorschau nicht verfügbar
                          </span>
                        ) : (
                          <Skeleton className="aspect-square w-full" />
                        )}
                        <Button
                          variant="secondary"
                          size="icon"
                          aria-label={`${doc.name} löschen`}
                          className="absolute right-1 top-1 opacity-90"
                          onClick={() => setToDelete(doc)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <figcaption className="truncate text-[11px] text-muted-foreground">
                        {doc.name}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Dateien ({files.length})
              </p>
              <ul className="space-y-2">
                {files.map((doc) => {
                  const url = urlFor(doc);
                  return (
                    <li
                      key={doc.id}
                      className="space-y-2 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium">{doc.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[11px]">
                            {documentTypeLabel(doc.document_type)}
                          </Badge>
                          <span>{doc.file_type.toUpperCase()}</span>
                          <span aria-hidden>·</span>
                          <span>{formatFileSize(doc.file_size)}</span>
                          <span aria-hidden>·</span>
                          <span>{formatDateTime(doc.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {url ? (
                          <Button asChild variant="outline" size="sm">
                            <a href={url} target="_blank" rel="noreferrer">Öffnen</a>
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" disabled>
                            Öffnen
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setToDelete(doc)}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4 text-destructive" />
                          Löschen
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(next) => {
          if (!remove.isPending && !next) setToDelete(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">
              Dokument „{toDelete?.name}“ löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Die Datei wird aus der Ablage entfernt. Dieser Schritt kann nicht rückgängig
              gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (toDelete) remove.mutate(toDelete);
              }}
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ProjectDocuments;
