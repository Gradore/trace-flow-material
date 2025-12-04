import { useState } from "react";
import { Search, Filter, FolderOpen, FileText, Image, File, MoreVertical, Upload, Trash2, Download, Tag } from "lucide-react";
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

const tagConfig = {
  reach: { label: "REACH", class: "bg-info/10 text-info border-info/20" },
  delivery_note: { label: "Lieferschein", class: "bg-primary/10 text-primary border-primary/20" },
  sample_report: { label: "Laborbericht", class: "bg-warning/10 text-warning border-warning/20" },
  certificate: { label: "Zertifikat", class: "bg-success/10 text-success border-success/20" },
  photo: { label: "Foto", class: "bg-accent/10 text-accent border-accent/20" },
};

const fileTypeIcon = {
  pdf: FileText,
  jpg: Image,
  png: Image,
  csv: File,
};

const mockDocuments = [
  {
    id: "1",
    name: "REACH_Zertifikat_Recycling_GmbH.pdf",
    type: "pdf",
    tag: "reach",
    batch: "ME-2024-0089",
    size: "245 KB",
    uploadedAt: "2024-12-03",
    uploadedBy: "M. Schmidt",
  },
  {
    id: "2",
    name: "Lieferschein_LS-2024-0089.pdf",
    type: "pdf",
    tag: "delivery_note",
    batch: "ME-2024-0089",
    size: "128 KB",
    uploadedAt: "2024-12-03",
    uploadedBy: "System",
  },
  {
    id: "3",
    name: "Laborprotokoll_PRB-2024-0154.pdf",
    type: "pdf",
    tag: "sample_report",
    batch: "CHG-2024-087",
    size: "512 KB",
    uploadedAt: "2024-12-02",
    uploadedBy: "K. Weber",
  },
  {
    id: "4",
    name: "Foto_Materialeingang.jpg",
    type: "jpg",
    tag: "photo",
    batch: "ME-2024-0088",
    size: "1.2 MB",
    uploadedAt: "2024-12-02",
    uploadedBy: "L. Müller",
  },
  {
    id: "5",
    name: "Qualitaetszertifikat_OUT-2024-0089.pdf",
    type: "pdf",
    tag: "certificate",
    batch: "OUT-2024-0089",
    size: "312 KB",
    uploadedAt: "2024-12-01",
    uploadedBy: "QA System",
  },
];

export default function Documents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const filteredDocuments = mockDocuments.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.batch.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = !selectedTag || doc.tag === selectedTag;
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dokumente</h1>
          <p className="text-muted-foreground mt-1">Alle Dokumente zentral verwalten</p>
        </div>
        <Button>
          <Upload className="h-4 w-4" />
          Dokument hochladen
        </Button>
      </div>

      {/* Tag Filter */}
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

      {/* Search */}
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
        <Button variant="outline">
          <Filter className="h-4 w-4" />
          Erweiterte Filter
        </Button>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocuments.map((doc) => {
          const tag = tagConfig[doc.tag as keyof typeof tagConfig];
          const FileIcon = fileTypeIcon[doc.type as keyof typeof fileTypeIcon] || File;
          
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
                    {doc.batch} • {doc.size}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Download className="h-4 w-4 mr-2" />
                      Herunterladen
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Tag className="h-4 w-4 mr-2" />
                      Tag ändern
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
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
                  {new Date(doc.uploadedAt).toLocaleDateString("de-DE")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredDocuments.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">Keine Dokumente gefunden</p>
          <p className="text-sm text-muted-foreground mt-1">
            Versuchen Sie eine andere Suche oder einen anderen Filter
          </p>
        </div>
      )}
    </div>
  );
}
