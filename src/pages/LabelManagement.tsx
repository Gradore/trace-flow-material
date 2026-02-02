import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageDescription } from "@/components/layout/PageDescription";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, Tag, Download, Printer, 
  Package, FileOutput, FileText, Loader2, QrCode 
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { generateLabelPDF, downloadPDF } from "@/lib/pdf";
import { buildContainerQRUrl, buildOutputMaterialQRUrl, buildDeliveryNoteQRUrl } from "@/lib/qrcode";

type LabelType = "all" | "container" | "output" | "delivery";

interface LabelItem {
  id: string;
  labelId: string;
  type: LabelType;
  description: string;
  createdAt: string;
  qrCode: string | null;
}

export default function LabelManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<LabelType>("all");
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Fetch containers
  const { data: containers = [] } = useQuery({
    queryKey: ["containers-labels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("containers")
        .select("id, container_id, type, location, created_at, qr_code")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch output materials
  const { data: outputs = [] } = useQuery({
    queryKey: ["outputs-labels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("output_materials")
        .select("id, output_id, batch_id, output_type, created_at, qr_code")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch delivery notes
  const { data: deliveryNotes = [] } = useQuery({
    queryKey: ["delivery-notes-labels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_notes")
        .select("id, note_id, type, partner_name, created_at, qr_code")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Combine all labels
  const allLabels: LabelItem[] = [
    ...containers.map((c) => ({
      id: c.id,
      labelId: c.container_id,
      type: "container" as LabelType,
      description: `${c.type} - ${c.location || "Kein Standort"}`,
      createdAt: c.created_at,
      qrCode: c.qr_code,
    })),
    ...outputs.map((o) => ({
      id: o.id,
      labelId: o.output_id,
      type: "output" as LabelType,
      description: `${o.output_type} - Charge: ${o.batch_id}`,
      createdAt: o.created_at,
      qrCode: o.qr_code,
    })),
    ...deliveryNotes.map((d) => ({
      id: d.id,
      labelId: d.note_id,
      type: "delivery" as LabelType,
      description: `${d.type === "incoming" ? "Eingang" : "Ausgang"} - ${d.partner_name}`,
      createdAt: d.created_at,
      qrCode: d.qr_code,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredLabels = allLabels.filter((label) => {
    const matchesSearch = 
      label.labelId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      label.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || label.type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: LabelType) => {
    switch (type) {
      case "container":
        return <Package className="h-4 w-4 text-primary" />;
      case "output":
        return <FileOutput className="h-4 w-4 text-success" />;
      case "delivery":
        return <FileText className="h-4 w-4 text-info" />;
      default:
        return <Tag className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: LabelType) => {
    switch (type) {
      case "container":
        return <Badge variant="secondary" className="bg-primary/10 text-primary">Container</Badge>;
      case "output":
        return <Badge variant="secondary" className="bg-success/10 text-success">Ausgangsmaterial</Badge>;
      case "delivery":
        return <Badge variant="secondary" className="bg-info/10 text-info">Lieferschein</Badge>;
      default:
        return <Badge variant="outline">Unbekannt</Badge>;
    }
  };

  const handleDownloadLabel = async (label: LabelItem) => {
    setGeneratingId(label.id);
    try {
      let qrUrl = label.qrCode;
      
      // Generate QR URL if not present
      if (!qrUrl) {
        switch (label.type) {
          case "container":
            qrUrl = buildContainerQRUrl(label.labelId);
            break;
          case "output":
            qrUrl = buildOutputMaterialQRUrl(label.labelId);
            break;
          case "delivery":
            qrUrl = buildDeliveryNoteQRUrl(label.labelId);
            break;
        }
      }

      const pdfBlob = await generateLabelPDF(
        {
          id: label.labelId,
          type: label.description.split(" - ")[0],
          location: label.description.split(" - ")[1] || "",
          date: format(new Date(label.createdAt), "dd.MM.yyyy", { locale: de }),
        },
        qrUrl!
      );

      downloadPDF(pdfBlob, `Etikett_${label.labelId}.pdf`);

      toast.success("Etikett heruntergeladen");
    } catch (error) {
      console.error("Error generating label:", error);
      toast.error("Etikett konnte nicht erstellt werden");
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageDescription
        title="Etiketten-Verwaltung"
        description="Übersicht aller erstellten Etiketten für Container, Ausgangsmaterial und Lieferscheine. Laden Sie Etiketten erneut herunter oder drucken Sie diese nach."
        nextSteps={[
          "Etikett suchen → Nach ID oder Beschreibung filtern",
          "Herunterladen → PDF mit QR-Code generieren",
          "Drucken → Auf Etikettendrucker ausgeben"
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Etiketten-Verwaltung</h1>
          <p className="text-muted-foreground mt-1">
            {allLabels.length} Etiketten insgesamt
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Tag className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{allLabels.length}</p>
                <p className="text-sm text-muted-foreground">Gesamt</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{containers.length}</p>
                <p className="text-sm text-muted-foreground">Container</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <FileOutput className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{outputs.length}</p>
                <p className="text-sm text-muted-foreground">Ausgangsmaterial</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-info" />
              <div>
                <p className="text-2xl font-bold">{deliveryNotes.length}</p>
                <p className="text-sm text-muted-foreground">Lieferscheine</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen nach ID oder Beschreibung..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as LabelType)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Alle Typen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="container">Container</SelectItem>
            <SelectItem value="output">Ausgangsmaterial</SelectItem>
            <SelectItem value="delivery">Lieferscheine</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredLabels.length === 0 ? (
            <div className="text-center py-12">
              <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">Keine Etiketten gefunden</p>
              <p className="text-muted-foreground">
                {searchTerm ? "Versuchen Sie einen anderen Suchbegriff" : "Noch keine Etiketten erstellt"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Etikett-ID</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>Erstellt am</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLabels.map((label) => (
                  <TableRow key={`${label.type}-${label.id}`}>
                    <TableCell>{getTypeBadge(label.type)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(label.type)}
                        <span className="font-mono font-medium">{label.labelId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {label.description}
                    </TableCell>
                    <TableCell>
                      {format(new Date(label.createdAt), "dd.MM.yyyy HH:mm", { locale: de })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadLabel(label)}
                        disabled={generatingId === label.id}
                      >
                        {generatingId === label.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        <span className="sr-only">Herunterladen</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
