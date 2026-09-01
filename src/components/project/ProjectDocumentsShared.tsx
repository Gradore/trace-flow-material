/**
 * Shared vocabulary and data access for the project document store (plan 5.10).
 *
 * Project documents are attached through the generic bridge columns
 * public.documents.linked_to_type / linked_to_id, so one component serves every
 * project entity (Versuchslauf, Partner, Fraktion, Analyse, Produkttest).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ProtocolPhoto } from "./TestRunsProtocol";

type Tables = Database["public"]["Tables"];
export type ProjectDocument = Tables["documents"]["Row"];

/** The project entities a document can be linked to. */
export type DocumentEntityType =
  | "test_run"
  | "partner"
  | "output_fraction"
  | "fraction_analysis"
  | "product_test";

/** documents.document_type — the German choices of plan 5.10. */
export const DOCUMENT_TYPES = [
  { id: "datasheet", label: "Datenblatt" },
  { id: "test_report", label: "Prüfbericht" },
  { id: "photo", label: "Foto" },
  { id: "video", label: "Video" },
  { id: "contract", label: "Vertrag" },
  { id: "nda", label: "Geheimhaltung (NDA)" },
  { id: "invoice", label: "Rechnung" },
  { id: "spec_sheet", label: "Spezifikation" },
] as const;

export function documentTypeLabel(id: string | null | undefined): string {
  if (!id) return "Ohne Typ";
  return DOCUMENT_TYPES.find((entry) => entry.id === id)?.label ?? id;
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "heic"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "m4v"];

/** Extensions the accepted file dialog offers — matched by the upload check. */
export const ACCEPTED_EXTENSIONS = [
  "pdf", "jpg", "jpeg", "png", "webp", "csv", "txt",
  "doc", "docx", "xls", "xlsx", "mp4", "mov",
];

/** Storage bucket and the largest object we accept. */
export const DOCUMENT_BUCKET = "documents";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function isImageDocument(doc: ProjectDocument): boolean {
  return IMAGE_EXTENSIONS.includes((doc.file_type ?? "").toLowerCase());
}

export function isVideoDocument(doc: ProjectDocument): boolean {
  return VIDEO_EXTENSIONS.includes((doc.file_type ?? "").toLowerCase());
}

/** Photos and videos go into the gallery, everything else into the file list. */
export function isGalleryDocument(doc: ProjectDocument): boolean {
  return isImageDocument(doc) || isVideoDocument(doc);
}

/** The document type we preselect for a freshly picked file. */
export function suggestedDocumentType(fileName: string): string {
  const ext = fileExtension(fileName);
  if (IMAGE_EXTENSIONS.includes(ext)) return "photo";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  return "datasheet";
}

/**
 * Storage object keys must stay ASCII: umlauts are transliterated, every other
 * character outside [A-Za-z0-9._-] becomes an underscore — the same rule
 * DocumentUploadDialog uses for the operational module.
 */
export function sanitizeObjectName(name: string): string {
  return name
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const projectDocumentKey = (entityType: string, entityId: string) =>
  ["project", "documents", entityType, entityId] as const;

/** Every document linked to one project record, newest first. */
export function useLinkedDocuments(entityType: DocumentEntityType, entityId: string | null) {
  return useQuery({
    queryKey: projectDocumentKey(entityType, entityId ?? "none"),
    enabled: Boolean(entityId),
    queryFn: async (): Promise<ProjectDocument[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("linked_to_type", entityType)
        .eq("linked_to_id", entityId as string)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("useLinkedDocuments:", error);
        throw new Error(error.message);
      }
      return data ?? [];
    },
  });
}

/**
 * Signed URLs for the gallery thumbnails. The bucket is private, so a plain
 * public URL would render a broken image.
 */
export function useSignedDocumentUrls(paths: string[], expiresIn = 3600) {
  const key = paths.slice().sort().join("|");
  return useQuery({
    queryKey: ["project", "document-urls", key, expiresIn],
    enabled: paths.length > 0,
    staleTime: (expiresIn - 60) * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .createSignedUrls(paths, expiresIn);
      if (error) {
        console.error("useSignedDocumentUrls:", error);
        throw new Error(error.message);
      }
      const map: Record<string, string> = {};
      (data ?? []).forEach((entry) => {
        if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
      });
      return map;
    },
  });
}

/** One-off signed URL, used when the user opens a document. */
export async function signedDocumentUrl(path: string, expiresIn = 300): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("Die Datei konnte nicht geöffnet werden.");
  return data.signedUrl;
}

/** documents.uploaded_by is a FK to profiles.id, never auth.uid(). */
export async function resolveProfileId(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("resolveProfileId:", error);
    return null;
  }
  return data?.id ?? null;
}

/* ----------------------------------------------------------- PDF evidence */

/** jsPDF renders JPEG and PNG only — other pictures stay out of the protocol. */
const PDF_IMAGE_TYPES = ["jpg", "jpeg", "png"];

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Foto konnte nicht gelesen werden."));
    reader.readAsDataURL(blob);
  });
}

function measureImage(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    // A picture we cannot measure still prints - fall back to 4:3.
    image.onerror = () => resolve({ width: 4, height: 3 });
    image.src = dataUrl;
  });
}

/**
 * Loads the linked photos of a record as data URLs for the PDF. The patent
 * evidence needs the pictures inside the document, not as a link.
 */
export async function loadEntityPhotos(
  entityType: DocumentEntityType,
  entityId: string,
  limit = 8,
): Promise<ProtocolPhoto[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("name, file_url, file_type, document_type, created_at")
    .eq("linked_to_type", entityType)
    .eq("linked_to_id", entityId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const candidates = (data ?? [])
    .filter((row) => PDF_IMAGE_TYPES.includes((row.file_type ?? "").toLowerCase()))
    .slice(0, limit);
  if (!candidates.length) return [];

  const { data: signed, error: signError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrls(candidates.map((row) => row.file_url), 300);
  if (signError) throw new Error(signError.message);

  const urlByPath = new Map<string, string>();
  (signed ?? []).forEach((entry) => {
    if (entry.path && entry.signedUrl) urlByPath.set(entry.path, entry.signedUrl);
  });

  const photos: ProtocolPhoto[] = [];
  for (const row of candidates) {
    const url = urlByPath.get(row.file_url);
    if (!url) continue;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const dataUrl = await blobToDataUrl(await response.blob());
      const { width, height } = await measureImage(dataUrl);
      photos.push({
        name: row.name,
        dataUrl,
        width,
        height,
        format: fileExtension(row.file_url) === "png" ? "PNG" : "JPEG",
        capturedAt: row.created_at,
      });
    } catch (photoError) {
      // One unreadable picture must not cost the whole protocol.
      console.error("loadEntityPhotos:", photoError);
    }
  }
  return photos;
}
