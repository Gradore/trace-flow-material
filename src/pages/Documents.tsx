import { useState, useRef } from "react";
import { Search, FolderOpen, FileText, Image, File, MoreVertical, Upload, Trash2, Download, Tag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";

const tagConfig: Record<string, { label: string; class: string }> = {
  reach: { label: "REACH", class: "bg-info/10 text-info border-info/20" },
  delivery_note: { label: "Lieferschein", class: "bg-primary/10 text-primary border-primary/20" },
  sample_report: { label: "Laborbericht", class: "bg-warning/10 text-warning border-warning/20" },
  certificate: { label: "Zertifikat", class: "bg-success/10 text-success border-success/20" },
  photo: { label: "Foto", class: "bg-accent/10 text-accent border-accent/20" },
};

const fileTypeIcon: Record<string, typeof FileText> = {
  pdf: FileText,
  jpg: Image,
  png: Image,
  jpeg: Image,
  csv: File,
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Documents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          material_inputs ( input_id ),
          containers ( container_id ),
          samples ( sample_id ),
          output_materials ( output_id ),
          delivery_notes ( note_id )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredDocuments = documents.filter((doc) => {
    const batchId = doc.material_inputs?.input_id || 
                    doc.containers?.container_id || 
                    doc.samples?.sample_id || 
                    doc.output_materials?.output_id ||
                    doc.delivery_notes?.note_id || "";
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batchId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = !selectedTag || doc.tag === selectedTag;
    return matchesSearch && matchesTag;
  });

  const handleDownload = async (doc: typeof documents[0]) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(doc.file_url);
      
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: "Dokument konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (docId: string, fileUrl: string) => {
    try {
      // Delete from storage
      await supabase.storage.from("documents").remove([fileUrl]);
      
      // Delete from database
      const { error } = await supabase.from("documents").delete().eq("id", docId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Dokument gelöscht" });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Dokument konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dokumente</h1>
          <p className="text-muted-foreground mt-1">Alle Dokumente zentral verwalten</p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4" />
          Dokument hochladen
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Badge
          variant="outline"
          className={cn(
            "cursor-pointer transition-colors",
            !selectedTag && "bg-primary text-primary-foreground"
          )}
          onClick={() => setSelectedTag(null)}
        >
          Alle
        </Badge>
        {Object.entries(tagConfig).map(([key, config]) => (
          <Badge
            key={key}
            variant="outline"
            className={cn(
              "cursor-pointer transition-colors",
              selectedTag === key ? config.class : "hover:bg-secondary"
            )}
            onClick={() => setSelectedTag(selectedTag === key ? null : key)}
          >
            {config.label}
          </Badge>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen nach Dateiname, Charge..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const tag = tagConfig[doc.tag as keyof typeof tagConfig] || { label: doc.tag || "Sonstige", class: "bg-secondary text-secondary-foreground" };
            const fileExt = doc.name.split(".").pop()?.toLowerCase() || "";
            const FileIcon = fileTypeIcon[fileExt] || File;
            const batchId = doc.material_inputs?.input_id || 
                            doc.containers?.container_id || 
                            doc.samples?.sample_id || 
                            doc.output_materials?.output_id ||
                            doc.delivery_notes?.note_id || "—";
            
            return (
              <div
                key={doc.id}
                className="glass-card rounded-xl p-4 hover:shadow-lg transition-shadow cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-lg bg-secondary/50 group-hover:bg-secondary transition-colors">
                    <FileIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" title={doc.name}>
                      {doc.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {batchId} • {formatFileSize(doc.file_size)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => handleDownload(doc)}>
                        <Download className="h-4 w-4 mr-2" />
                        Herunterladen
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDelete(doc.id, doc.file_url)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <Badge variant="outline" className={cn("text-xs", tag.class)}>
                    {tag.label}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString("de-DE")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && filteredDocuments.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">Keine Dokumente gefunden</p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchTerm || selectedTag 
              ? "Versuchen Sie eine andere Suche oder einen anderen Filter"
              : "Laden Sie Ihr erstes Dokument hoch"
            }
          </p>
        </div>
      )}

      <DocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />
    </div>
  );
}
