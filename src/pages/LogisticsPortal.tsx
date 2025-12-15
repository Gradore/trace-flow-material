import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Package, Truck, MapPin, Calendar, Check, X } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

export default function LogisticsPortal() {
  const queryClient = useQueryClient();

  // Get pending announcements
  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ["logistics-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_announcements")
        .select("*, company:companies(name)")
        .in("status", ["pending", "confirmed"])
        .order("preferred_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Get pending pickup requests
  const { data: pickups, isLoading: pickupsLoading } = useQuery({
    queryKey: ["logistics-pickups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_requests")
        .select("*, company:companies(name, address, city, postal_code)")
        .in("status", ["pending", "confirmed"])
        .order("preferred_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Get containers with materials
  const { data: containers, isLoading: containersLoading } = useQuery({
    queryKey: ["logistics-containers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("containers")
        .select("*, material_inputs(*)")
        .neq("status", "empty")
        .order("location", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("material_announcements")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logistics-announcements"] });
      toast.success("Status aktualisiert");
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  const updatePickupMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("pickup_requests")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logistics-pickups"] });
      toast.success("Status aktualisiert");
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      confirmed: "default",
      arrived: "default",
      processed: "outline",
      cancelled: "destructive",
      picked_up: "outline",
    };
    const labels: Record<string, string> = {
      pending: "Ausstehend",
      confirmed: "Bestätigt",
      arrived: "Eingetroffen",
      processed: "Verarbeitet",
      cancelled: "Storniert",
      picked_up: "Abgeholt",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const getTimeSlotLabel = (slot: string | null) => {
    if (!slot) return "";
    const labels: Record<string, string> = {
      morning: "Vormittag",
      afternoon: "Nachmittag",
      flexible: "Flexibel",
    };
    return labels[slot] || slot;
  };

  // Calculate summary stats
  const pendingAnnouncements = announcements?.filter((a) => a.status === "pending").length || 0;
  const pendingPickups = pickups?.filter((p) => p.status === "pending").length || 0;
  const activeContainers = containers?.length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Logistik-Portal</h1>
        <p className="text-muted-foreground">Übersicht über Materialfluss und Transporte</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offene Anmeldungen</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingAnnouncements}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offene Abholungen</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPickups}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktive Container</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeContainers}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="announcements">
        <TabsList>
          <TabsTrigger value="announcements">Materialanmeldungen</TabsTrigger>
          <TabsTrigger value="pickups">Abholungsanfragen</TabsTrigger>
          <TabsTrigger value="containers">Container-Übersicht</TabsTrigger>
        </TabsList>

        <TabsContent value="announcements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Geplante Anlieferungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              {announcementsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Lädt...</div>
              ) : announcements?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine offenen Anmeldungen
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Lieferant</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Menge</TableHead>
                        <TableHead>Termin</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {announcements?.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-sm">{a.announcement_id}</TableCell>
                          <TableCell>{a.company?.name}</TableCell>
                          <TableCell>
                            {a.material_type}
                            {a.material_subtype && ` (${a.material_subtype})`}
                          </TableCell>
                          <TableCell>
                            {a.container_count}x {a.container_type} ({a.estimated_weight_kg} kg)
                          </TableCell>
                          <TableCell>
                            {a.preferred_date && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(a.preferred_date), "dd.MM.yyyy", { locale: de })}
                                {a.preferred_time_slot && ` (${getTimeSlotLabel(a.preferred_time_slot)})`}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(a.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {a.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateAnnouncementMutation.mutate({ id: a.id, status: "confirmed" })
                                  }
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Bestätigen
                                </Button>
                              )}
                              {a.status === "confirmed" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateAnnouncementMutation.mutate({ id: a.id, status: "arrived" })
                                  }
                                >
                                  Eingetroffen
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  updateAnnouncementMutation.mutate({ id: a.id, status: "cancelled" })
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
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

        <TabsContent value="pickups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Geplante Abholungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pickupsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Lädt...</div>
              ) : pickups?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine offenen Abholungsanfragen
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Firma</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Adresse</TableHead>
                        <TableHead>Termin</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pickups?.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-sm">{p.request_id}</TableCell>
                          <TableCell>{p.company?.name}</TableCell>
                          <TableCell>
                            {p.material_description}
                            {p.weight_kg && ` (${p.weight_kg} kg)`}
                          </TableCell>
                          <TableCell>
                            {p.pickup_address || (
                              p.company && `${p.company.address}, ${p.company.postal_code} ${p.company.city}`
                            ) || "-"}
                          </TableCell>
                          <TableCell>
                            {p.preferred_date && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(p.preferred_date), "dd.MM.yyyy", { locale: de })}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(p.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {p.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updatePickupMutation.mutate({ id: p.id, status: "confirmed" })
                                  }
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Bestätigen
                                </Button>
                              )}
                              {p.status === "confirmed" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updatePickupMutation.mutate({ id: p.id, status: "picked_up" })
                                  }
                                >
                                  Abgeholt
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  updatePickupMutation.mutate({ id: p.id, status: "cancelled" })
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
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

        <TabsContent value="containers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Container & Materialstandorte
              </CardTitle>
            </CardHeader>
            <CardContent>
              {containersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Lädt...</div>
              ) : containers?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine aktiven Container
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Container-ID</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Standort</TableHead>
                        <TableHead>Inhalt</TableHead>
                        <TableHead>Gewicht</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {containers?.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-sm">{c.container_id}</TableCell>
                          <TableCell>{c.type}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {c.location || "Nicht zugewiesen"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {c.material_inputs?.length > 0 ? (
                              <span>{c.material_inputs.length} Material(ien)</span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{c.weight_kg ? `${c.weight_kg} kg` : "-"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                c.status === "full" ? "default" : c.status === "partial" ? "secondary" : "outline"
                              }
                            >
                              {c.status === "full" ? "Voll" : c.status === "partial" ? "Teilweise" : c.status}
                            </Badge>
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
