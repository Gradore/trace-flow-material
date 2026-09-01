import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Plus, Archive, Search, Filter, Loader2, AlertCircle,
  Package, Calendar, MapPin, Beaker, Warehouse 
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

interface RetentionSample {
  id: string;
  sample_id: string;
  material_input_id: string | null;
  output_material_id: string | null;
  customer_order_id: string | null;
  is_retention_sample: boolean;
  retention_purpose: string | null;
  storage_location: string | null;
  sampled_at: string;
  sampler_name: string;
  status: string;
  notes: string | null;
  material_inputs?: {
    input_id: string;
    material_type: string;
  } | null;
  output_materials?: {
    output_id: string;
    batch_id: string;
    output_type: string;
  } | null;
  orders?: {
    order_id: string;
    customer_name: string;
  } | null;
}

export default function RetentionSamples() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [purposeFilter, setPurposeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    customerId: undefined as string | undefined,
    batchId: undefined as string | undefined,
    materialType: "",
    storageLocationWarehouse: "",
    storageLocationLab: "",
  });

  // Fetch retention samples
  const { data: retentionSamples = [], isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ["retention-samples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("samples")
        .select(`
          *,
          material_inputs (input_id, material_type),
          output_materials!samples_output_material_id_fkey (output_id, batch_id, output_type),
          orders:customer_order_id (order_id, customer_name)
        `)
        .eq("is_retention_sample", true)
        .order("sampled_at", { ascending: false });
      
      if (error) throw error;
      return data as RetentionSample[];
    },
  });

  // Fetch available orders for selection
  const { data: orders = [] } = useQuery({
    queryKey: ["orders-for-retention"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_id, customer_name")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: dialogOpen,
  });

  // Fetch available output materials for selection
  const { data: outputMaterials = [] } = useQuery({
    queryKey: ["output-materials-for-retention"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("output_materials")
        .select("id, output_id, batch_id, output_type")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: dialogOpen,
  });

  // Removes an already created warehouse sample when the lab sample fails.
  // Returns false when RLS filters the delete out (nothing was removed).
  const rollbackWarehouseSample = async (id: string) => {
    const { data } = await supabase.from("samples").delete().eq("id", id).select("id");
    return !!data && data.length > 0;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formData.batchId || !formData.storageLocationWarehouse || !formData.storageLocationLab) {
        throw new Error("Bitte füllen Sie alle Pflichtfelder aus");
      }

      const now = new Date().toISOString();
      const selectedOutput = outputMaterials.find(o => o.id === formData.batchId);
      const selectedOrder = orders.find(o => o.id === formData.customerId);
      const batchLabel = selectedOutput?.batch_id || formData.batchId;
      const customerLabel = selectedOrder?.customer_name || "-";
      const materialLabel = formData.materialType.trim();
      const materialSuffix = materialLabel ? `, Material: ${materialLabel}` : "";

      // generate_unique_id derives the next number from the already stored rows,
      // so the second ID must be requested only after the first row is committed.
      const { data: warehouseId, error: warehouseIdError } = await supabase.rpc("generate_unique_id", { prefix: "RST" });
      if (warehouseIdError || !warehouseId) {
        throw new Error("Muster-ID konnte nicht generiert werden.");
      }

      // Create warehouse retention sample
      const { data: warehouseRows, error: warehouseError } = await supabase
        .from("samples")
        .insert({
          sample_id: warehouseId,
          sampled_at: now,
          sampler_name: "System",
          status: "approved",
          is_retention_sample: true,
          retention_purpose: "warehouse",
          storage_location: formData.storageLocationWarehouse,
          output_material_id: formData.batchId || null,
          customer_order_id: formData.customerId || null,
          notes: `Rückstellmuster für Lagerverbleib. Charge: ${batchLabel}, Kunde: ${customerLabel}${materialSuffix}`,
        })
        .select("id");

      if (warehouseError) throw warehouseError;
      if (!warehouseRows || warehouseRows.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden.");
      }

      const { data: labId, error: labIdError } = await supabase.rpc("generate_unique_id", { prefix: "RST" });
      if (labIdError || !labId) {
        await rollbackWarehouseSample(warehouseRows[0].id);
        throw new Error("Muster-ID für das Labormuster konnte nicht generiert werden.");
      }

      // Create lab retention sample
      const { data: labRows, error: labError } = await supabase
        .from("samples")
        .insert({
          sample_id: labId,
          sampled_at: now,
          sampler_name: "System",
          status: "approved",
          is_retention_sample: true,
          retention_purpose: "lab_complaint",
          storage_location: formData.storageLocationLab,
          output_material_id: formData.batchId || null,
          customer_order_id: formData.customerId || null,
          notes: `Rückstellmuster für Laborprüfung bei Beanstandung. Charge: ${batchLabel}, Kunde: ${customerLabel}${materialSuffix}`,
        })
        .select("id");

      if (labError || !labRows || labRows.length === 0) {
        // Never leave half a pair behind
        const rolledBack = await rollbackWarehouseSample(warehouseRows[0].id);
        const reason = labError?.message || "Keine Berechtigung oder Datensatz nicht gefunden.";
        throw new Error(
          rolledBack
            ? `Labormuster konnte nicht angelegt werden: ${reason}`
            : `Labormuster konnte nicht angelegt werden: ${reason} Das Lagermuster ${warehouseId} wurde bereits angelegt und muss manuell entfernt werden.`
        );
      }

      return { warehouseId, labId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["retention-samples"] });
      toast.success(`Rückstellmuster erstellt: ${data.warehouseId} (Lager) und ${data.labId} (Labor)`);
      setDialogOpen(false);
      setFormData({
        customerId: undefined,
        batchId: undefined,
        materialType: "",
        storageLocationWarehouse: "",
        storageLocationLab: "",
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Fehler beim Erstellen der Rückstellmuster");
    },
  });

  const filteredSamples = retentionSamples.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      s.sample_id.toLowerCase().includes(term) ||
      (s.storage_location || "").toLowerCase().includes(term) ||
      (s.orders?.customer_name || "").toLowerCase().includes(term) ||
      (s.output_materials?.batch_id || "").toLowerCase().includes(term);
    const matchesPurpose = purposeFilter === "all" || s.retention_purpose === purposeFilter;
    const sampledAt = new Date(s.sampled_at);
    const matchesFrom = !dateFrom || sampledAt >= new Date(`${dateFrom}T00:00:00`);
    const matchesTo = !dateTo || sampledAt <= new Date(`${dateTo}T23:59:59`);
    return matchesSearch && matchesPurpose && matchesFrom && matchesTo;
  });

  const activeFilterCount =
    (purposeFilter !== "all" ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  // KPI tiles describe the whole stock, so they must not follow search/filter
  // (the "Gesamt" and "Chargen" tiles below count retentionSamples as well).
  const warehouseSamples = retentionSamples.filter(s => s.retention_purpose === "warehouse");
  const labSamples = retentionSamples.filter(s => s.retention_purpose === "lab_complaint");

  const getPurposeBadge = (purpose: string | null) => {
    if (purpose === "warehouse") {
      return (
        <Badge variant="secondary" className="bg-primary/10 text-primary gap-1">
          <Warehouse className="h-3 w-3" />
          Lager
        </Badge>
      );
    }
    if (purpose === "lab_complaint") {
      return (
        <Badge variant="secondary" className="bg-info/10 text-info gap-1">
          <Beaker className="h-3 w-3" />
          Labor
        </Badge>
      );
    }
    return <Badge variant="outline">Unbekannt</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageDescription
        title="Rückstellmuster-Verwaltung"
        description="Verwalten Sie Rückstellmuster (RST-XXXX) für Qualitätssicherung und Reklamationsbearbeitung. Pro Lieferung werden automatisch zwei Muster angelegt: 1x für Lagerverbleib (Langzeitdokumentation), 1x für Laborprüfung bei Kundenreklamationen."
        nextSteps={[
          "Muster anlegen → Bei Verarbeitungsabschluss automatisch",
          "Manuell anlegen → Für nachträgliche Erfassung",
          "Bei Reklamation → Labormuster für Prüfung verwenden"
        ]}
        workflowLinks={[
          { label: "Verarbeitung", path: "/processing", direction: "previous" },
          { label: "Beprobung", path: "/sampling", direction: "previous" },
          { label: "Aufträge", path: "/orders", direction: "previous" },
          { label: "Traceability", path: "/traceability", direction: "next" },
        ]}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rückstellmuster</h1>
          <p className="text-muted-foreground mt-1">Verwaltung von Qualitäts-Rückstellmustern</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Rückstellmuster anlegen
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Archive className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{isError ? "–" : retentionSamples.length}</p>
                <p className="text-sm text-muted-foreground">Gesamt</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Warehouse className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{isError ? "–" : warehouseSamples.length}</p>
                <p className="text-sm text-muted-foreground">Lager</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Beaker className="h-8 w-8 text-info" />
              <div>
                <p className="text-2xl font-bold">{isError ? "–" : labSamples.length}</p>
                <p className="text-sm text-muted-foreground">Labor</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{isError ? "–" : Math.floor(retentionSamples.length / 2)}</p>
                <p className="text-sm text-muted-foreground">Chargen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen nach ID, Kunde, Charge, Lagerplatz..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Filter className="h-4 w-4" />
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-4 bg-popover">
            <div className="space-y-2">
              <Label>Zweck</Label>
              <Select value={purposeFilter} onValueChange={setPurposeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Zwecke" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Alle Zwecke</SelectItem>
                  <SelectItem value="warehouse">Lager</SelectItem>
                  <SelectItem value="lab_complaint">Labor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="dateFrom">Von</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">Bis</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={activeFilterCount === 0}
              onClick={() => {
                setPurposeFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Filter zurücksetzen
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">Rückstellmuster konnten nicht geladen werden</p>
              <p className="text-muted-foreground">
                {(loadError as Error)?.message || "Bitte versuchen Sie es erneut."}
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
                Erneut laden
              </Button>
            </div>
          ) : filteredSamples.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">Keine Rückstellmuster vorhanden</p>
              <p className="text-muted-foreground">Legen Sie ein neues Rückstellmuster-Paar an.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Muster-ID</TableHead>
                  <TableHead>Zweck</TableHead>
                  <TableHead>Charge</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Lagerplatz</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSamples.map((sample) => (
                  <TableRow key={sample.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Archive className="h-4 w-4 text-primary" />
                        <span className="font-mono font-medium">{sample.sample_id}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getPurposeBadge(sample.retention_purpose)}</TableCell>
                    <TableCell>
                      {sample.output_materials ? (
                        <span className="font-mono text-sm">{sample.output_materials.batch_id}</span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {sample.orders?.customer_name || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {sample.storage_location || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(sample.sampled_at), "dd.MM.yyyy", { locale: de })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-success/10 text-success">
                        Archiviert
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-primary" />
              Rückstellmuster anlegen
            </DialogTitle>
            <DialogDescription>
              Es werden automatisch <strong>zwei Rückstellmuster</strong> angelegt: 
              eines für den Verbleib im Lager und eines für Laborprüfungen bei Beanstandungen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-info/10 border border-info/20">
              <p className="text-sm text-info font-medium">ℹ️ Pro Charge werden 2 Muster angelegt:</p>
              <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside">
                <li><strong>1x Lager:</strong> Langzeitaufbewahrung zur Dokumentation</li>
                <li><strong>1x Labor:</strong> Für Prüfungen bei Kundenreklamationen</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerId">Kunde / Auftrag</Label>
                <Select
                  value={formData.customerId}
                  onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auftrag wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {orders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.order_id} - {order.customer_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="batchId">Charge / Ausgangsmaterial *</Label>
                <Select
                  value={formData.batchId}
                  onValueChange={(value) => setFormData({ ...formData, batchId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Charge wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {outputMaterials.map((output) => (
                      <SelectItem key={output.id} value={output.id}>
                        {output.batch_id} ({output.output_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="storageLocationWarehouse">
                  <Warehouse className="h-3 w-3 inline mr-1" />
                  Lagerplatz (Lager) *
                </Label>
                <Input
                  id="storageLocationWarehouse"
                  placeholder="z.B. Regal A-12, Fach 3"
                  value={formData.storageLocationWarehouse}
                  onChange={(e) => setFormData({ ...formData, storageLocationWarehouse: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="storageLocationLab">
                  <Beaker className="h-3 w-3 inline mr-1" />
                  Lagerplatz (Labor) *
                </Label>
                <Input
                  id="storageLocationLab"
                  placeholder="z.B. Labor-Kühlschrank B2"
                  value={formData.storageLocationLab}
                  onChange={(e) => setFormData({ ...formData, storageLocationLab: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="materialType">Material (optional)</Label>
              <Input
                id="materialType"
                placeholder="z.B. PA66-GF30"
                value={formData.materialType}
                onChange={(e) => setFormData({ ...formData, materialType: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !formData.batchId || !formData.storageLocationWarehouse || !formData.storageLocationLab}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              2 Rückstellmuster anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
