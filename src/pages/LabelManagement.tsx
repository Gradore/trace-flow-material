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
  Search, Tag, Download, Printer, AlertCircle,
  Package, FileOutput, FileText, Loader2, QrCode
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { generateLabelPDF, downloadPDF, printPDF } from "@/lib/pdf";
import { buildContainerQRUrl, buildOutputMaterialQRUrl, buildDeliveryNoteQRUrl } from "@/lib/qrcode";

type LabelType = "all" | "container" | "output" | "delivery";

interface LabelItem {
  id: string;
  labelId: string;
  type: LabelType;
  description: string;
  createdAt: string;
  qrCode: string | null;
  /** Fields printed on the label - kept separate from the display description */
  labelHeading: string;
  material?: string;
  location?: string;
  batch?: string;
  partner?: string;
}

const containerTypeLabels: Record<string, string> = {
  bigbag: "BigBag",
  box: "Box",
  cage: "Gitterbox",
  container: "Container",
};

const outputTypeLabels: Record<string, string> = {
  glass_fiber: "Recycelte Glasfasern",
  resin_powder: "Harzpulver",
  pp_regrind: "PP Regranulat",
  pa_regrind: "PA Regranulat",
};

export default function LabelManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<LabelType>("all");
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Fetch containers
  const {
    data: containers = [],
    isError: containersError,
  } = useQuery({
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
  const {
    data: outputs = [],
    isError: outputsError,
  } = useQuery({
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
  const {
    data: deliveryNotes = [],
    isError: deliveryNotesError,
  } = useQuery({
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

  const hasLoadError = containersError || outputsError || deliveryNotesError;

  // Combine all labels
  const allLabels: LabelItem[] = [
    ...containers.map((c) => {
      const typeLabel = containerTypeLabels[c.type] || c.type;
      return {
        id: c.id,
        labelId: c.container_id,
        type: "container" as LabelType,
        description: `${typeLabel} - ${c.location || "Kein Standort"}`,
        createdAt: c.created_at,
        qrCode: c.qr_code,
        labelHeading: typeLabel,
        location: c.location || undefined,
      };
    }),
    ...outputs.map((o) => {
      const typeLabel = outputTypeLabels[o.output_type] || o.output_type;
      return {
        id: o.id,
        labelId: o.output_id,
        type: "output" as LabelType,
        description: `${typeLabel} - Charge: ${o.batch_id}`,
        createdAt: o.created_at,
        qrCode: o.qr_code,
        labelHeading: "Ausgangsmaterial",
        material: typeLabel,
        batch: o.batch_id,
      };
    }),
    ...deliveryNotes.map((d) => {
      const directionLabel = d.type === "incoming" ? "Eingang" : "Ausgang";
      return {
        id: d.id,
        labelId: d.note_id,
        type: "delivery" as LabelType,
        description: `${directionLabel} - ${d.partner_name}`,
        createdAt: d.created_at,
        qrCode: d.qr_code,
        labelHeading: `Lieferschein ${directionLabel}`,
        partner: d.partner_name,
      };
    }),
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

  /**
   * Stored QR codes written before the /scan resolver existed point at detail
   * routes that do not exist and would land on the 404 page when scanned.
   */
  const isResolvableQrUrl = (value: string | null): value is string => {
    if (!value) return false;
    try {
      return new URL(value).pathname.replace(/\/+$/, "") === "/scan";
    } catch {
      return false;
    }
  };

  const buildLabelPDF = async (label: LabelItem): Promise<Blob> => {
    let qrUrl = label.qrCode;

    if (!isResolvableQrUrl(qrUrl)) {
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
        default:
          qrUrl = buildContainerQRUrl(label.labelId);
      }
    }

    return generateLabelPDF(
      {
        id: label.labelId,
        type: label.labelHeading,
        material: label.material,
        location: label.location,
        batch: label.batch,
        partner: label.partner,
        date: format(new Date(label.createdAt), "dd.MM.yyyy", { locale: de }),
      },
      qrUrl
    );
  };

  const handleDownloadLabel = async (label: LabelItem) => {
    setGeneratingId(label.id);
    try {
      const pdfBlob = await buildLabelPDF(label);

      downloadPDF(pdfBlob, `Etikett_${label.labelId}.pdf`);

      toast.success("Etikett heruntergeladen");
    } catch (error) {
      console.error("Error generating label:", error);
      toast.error("Etikett konnte nicht erstellt werden");
    } finally {
      setGeneratingId(null);
    }
  };

  const handlePrintLabel = async (label: LabelItem) => {
    setGeneratingId(label.id);
    try {
      const pdfBlob = await buildLabelPDF(label);

      printPDF(pdfBlob);

      toast.success("Etikett wird gedruckt");
    } catch (error) {
      console.error("Error printing label:", error);
      toast.error("Etikett konnte nicht gedruckt werden");
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
            {hasLoadError ? "Etiketten konnten nicht geladen werden" : `${allLabels.length} Etiketten insgesamt`}
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
                <p className="text-2xl font-bold">{hasLoadError ? "–" : allLabels.length}</p>
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
                <p className="text-2xl font-bold">{containersError ? "–" : containers.length}</p>
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
                <p className="text-2xl font-bold">{outputsError ? "–" : outputs.length}</p>
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
                <p className="text-2xl font-bold">{deliveryNotesError ? "–" : deliveryNotes.length}</p>
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
          {hasLoadError ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">Etiketten konnten nicht geladen werden</p>
              <p className="text-muted-foreground">
                Bitte laden Sie die Seite neu oder prüfen Sie Ihre Berechtigungen.
              </p>
            </div>
          ) : filteredLabels.length === 0 ? (
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
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadLabel(label)}
                          disabled={generatingId === label.id}
                          title="Herunterladen"
                        >
                          {generatingId === label.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          <span className="sr-only">Herunterladen</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrintLabel(label)}
                          disabled={generatingId === label.id}
                          title="Drucken"
                        >
                          <Printer className="h-4 w-4" />
                          <span className="sr-only">Drucken</span>
                        </Button>
                      </div>
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
