import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Archive, Tag, FlaskConical, Search, Download, Filter, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { generateLabelPDF, downloadPDF } from "@/lib/pdf";
import { buildContainerQRUrl, buildOutputMaterialQRUrl } from "@/lib/qrcode";
import { toast } from "@/hooks/use-toast";

interface LabelRecord {
  id: string;
  record_id: string;
  type: 'container' | 'output_material';
  label_type: string;
  material?: string;
  weight?: string;
  location?: string;
  created_at: string;
}

interface RetentionSample {
  id: string;
  sample_id: string;
  sampler_name: string;
  status: string;
  is_retention_sample: boolean;
  retention_purpose: string | null;
  storage_location: string | null;
  sampled_at: string;
  created_at: string;
  notes: string | null;
  material_inputs?: {
    input_id: string;
    material_type: string;
  } | null;
  output_materials?: {
    batch_id: string;
    output_type: string;
  } | null;
  orders?: {
    order_id: string;
    customer_name: string;
  } | null;
}

export default function ArchivePage() {
  const [activeTab, setActiveTab] = useState("labels");
  const [labelSearch, setLabelSearch] = useState("");
  const [sampleSearch, setSampleSearch] = useState("");
  const [labelTypeFilter, setLabelTypeFilter] = useState("all");
  const [samplePurposeFilter, setSamplePurposeFilter] = useState("all");
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  // Fetch containers for label archive
  const { data: containers = [], isLoading: containersLoading } = useQuery({
    queryKey: ["archive-containers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("containers")
        .select("id, container_id, type, location, weight_kg, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch output materials for label archive
  const { data: outputMaterials = [], isLoading: outputsLoading } = useQuery({
    queryKey: ["archive-outputs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("output_materials")
        .select("id, output_id, batch_id, output_type, weight_kg, created_at, fiber_size")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch retention samples
  const { data: retentionSamples = [], isLoading: samplesLoading } = useQuery({
    queryKey: ["archive-retention-samples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("samples")
        .select(`
          id,
          sample_id,
          sampler_name,
          status,
          is_retention_sample,
          retention_purpose,
          storage_location,
          sampled_at,
          created_at,
          notes,
          material_inputs (
            input_id,
            material_type
          ),
          output_materials (
            batch_id,
            output_type
          ),
          orders:customer_order_id (
            order_id,
            customer_name
          )
        `)
        .eq("is_retention_sample", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as RetentionSample[]) || [];
    },
  });

  // Combine containers and outputs into label records
  const labelRecords: LabelRecord[] = [
    ...containers.map((c) => ({
      id: c.id,
      record_id: c.container_id,
      type: "container" as const,
      label_type: c.type,
      location: c.location || undefined,
      weight: c.weight_kg ? `${c.weight_kg} kg` : undefined,
      created_at: c.created_at,
    })),
    ...outputMaterials.map((o) => ({
      id: o.id,
      record_id: o.output_id,
      type: "output_material" as const,
      label_type: o.output_type,
      material: o.batch_id,
      weight: o.weight_kg ? `${o.weight_kg} kg` : undefined,
      created_at: o.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Filter labels
  const filteredLabels = labelRecords.filter((label) => {
    const matchesSearch =
      label.record_id.toLowerCase().includes(labelSearch.toLowerCase()) ||
      label.label_type.toLowerCase().includes(labelSearch.toLowerCase()) ||
      label.material?.toLowerCase().includes(labelSearch.toLowerCase());
    
    const matchesType =
      labelTypeFilter === "all" ||
      (labelTypeFilter === "container" && label.type === "container") ||
      (labelTypeFilter === "output" && label.type === "output_material");

    return matchesSearch && matchesType;
  });

  // Filter retention samples
  const filteredSamples = retentionSamples.filter((sample) => {
    const matchesSearch =
      sample.sample_id.toLowerCase().includes(sampleSearch.toLowerCase()) ||
      sample.sampler_name.toLowerCase().includes(sampleSearch.toLowerCase()) ||
      sample.storage_location?.toLowerCase().includes(sampleSearch.toLowerCase()) ||
      sample.material_inputs?.material_type.toLowerCase().includes(sampleSearch.toLowerCase()) ||
      sample.output_materials?.batch_id.toLowerCase().includes(sampleSearch.toLowerCase()) ||
      sample.orders?.customer_name.toLowerCase().includes(sampleSearch.toLowerCase());

    const matchesPurpose =
      samplePurposeFilter === "all" ||
      sample.retention_purpose === samplePurposeFilter;

    return matchesSearch && matchesPurpose;
  });

  const handleDownloadLabel = async (label: LabelRecord) => {
    setIsGenerating(label.id);
    try {
      const qrUrl =
        label.type === "container"
          ? buildContainerQRUrl(label.record_id)
          : buildOutputMaterialQRUrl(label.record_id);

      const pdfBlob = await generateLabelPDF(
        {
          id: label.record_id,
          type: label.label_type,
          material: label.material,
          weight: label.weight,
          location: label.location,
          date: format(new Date(label.created_at), "dd.MM.yyyy", { locale: de }),
        },
        qrUrl
      );

      downloadPDF(pdfBlob, `Etikett_${label.record_id}.pdf`);
      toast({
        title: "Etikett heruntergeladen",
        description: `${label.record_id} wurde als PDF gespeichert.`,
      });
    } catch (error) {
      console.error("Error generating label:", error);
      toast({
        title: "Fehler",
        description: "Das Etikett konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Ausstehend", variant: "secondary" },
      in_analysis: { label: "In Analyse", variant: "default" },
      approved: { label: "Freigegeben", variant: "default" },
      rejected: { label: "Abgelehnt", variant: "destructive" },
    };
    const { label, variant } = config[status] || { label: status, variant: "outline" };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getPurposeLabel = (purpose: string | null) => {
    if (purpose === "warehouse") return "Lager";
    if (purpose === "lab_complaint") return "Labor (Beanstandung)";
    return purpose || "-";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Archive className="h-8 w-8 text-primary" />
            Archiv
          </h1>
          <p className="text-muted-foreground mt-1">
            Etiketten und Rückstellmuster durchsuchen und herunterladen
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="labels" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Etiketten
          </TabsTrigger>
          <TabsTrigger value="retention" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Rückstellmuster
          </TabsTrigger>
        </TabsList>

        {/* Labels Tab */}
        <TabsContent value="labels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Etiketten-Archiv
              </CardTitle>
              <CardDescription>
                Alle erstellten Etiketten für Container und Ausgangsmaterialien
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suche nach ID, Typ, Material..."
                    value={labelSearch}
                    onChange={(e) => setLabelSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={labelTypeFilter} onValueChange={setLabelTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Typ filtern" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Typen</SelectItem>
                    <SelectItem value="container">Container</SelectItem>
                    <SelectItem value="output">Ausgangsmaterial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {containersLoading || outputsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredLabels.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Keine Etiketten gefunden</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Kategorie</TableHead>
                        <TableHead>Gewicht</TableHead>
                        <TableHead>Erstellt am</TableHead>
                        <TableHead className="text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLabels.map((label) => (
                        <TableRow key={`${label.type}-${label.id}`}>
                          <TableCell className="font-mono font-medium">
                            {label.record_id}
                          </TableCell>
                          <TableCell>
                            <Badge variant={label.type === "container" ? "secondary" : "outline"}>
                              {label.type === "container" ? "Container" : "Ausgangsmaterial"}
                            </Badge>
                          </TableCell>
                          <TableCell>{label.label_type}</TableCell>
                          <TableCell>{label.weight || "-"}</TableCell>
                          <TableCell>
                            {format(new Date(label.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadLabel(label)}
                              disabled={isGenerating === label.id}
                            >
                              {isGenerating === label.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              <span className="ml-2 hidden sm:inline">PDF</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retention Samples Tab */}
        <TabsContent value="retention" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Rückstellmuster-Archiv
              </CardTitle>
              <CardDescription>
                Alle erstellten Rückstellproben für Lager und Labor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suche nach ID, Kunde, Charge, Lagerplatz..."
                    value={sampleSearch}
                    onChange={(e) => setSampleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={samplePurposeFilter} onValueChange={setSamplePurposeFilter}>
                  <SelectTrigger className="w-[220px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Zweck filtern" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Zwecke</SelectItem>
                    <SelectItem value="warehouse">Lager</SelectItem>
                    <SelectItem value="lab_complaint">Labor (Beanstandung)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {samplesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredSamples.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Keine Rückstellmuster gefunden</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proben-ID</TableHead>
                        <TableHead>Zweck</TableHead>
                        <TableHead>Lagerplatz</TableHead>
                        <TableHead>Material / Charge</TableHead>
                        <TableHead>Kunde</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Erstellt am</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSamples.map((sample) => (
                        <TableRow key={sample.id}>
                          <TableCell className="font-mono font-medium">
                            {sample.sample_id}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={
                                sample.retention_purpose === "warehouse" 
                                  ? "bg-amber-500/10 text-amber-700 border-amber-500/30" 
                                  : "bg-blue-500/10 text-blue-700 border-blue-500/30"
                              }
                            >
                              {getPurposeLabel(sample.retention_purpose)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {sample.storage_location || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              {sample.material_inputs && (
                                <span className="text-sm">{sample.material_inputs.material_type}</span>
                              )}
                              {sample.output_materials && (
                                <span className="text-xs text-muted-foreground">
                                  Charge: {sample.output_materials.batch_id}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {sample.orders?.customer_name || "-"}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(sample.status)}
                          </TableCell>
                          <TableCell>
                            {format(new Date(sample.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
