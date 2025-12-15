import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Package, Truck, Plus, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { AnnouncementDialog } from "@/components/portal/AnnouncementDialog";
import { PickupRequestDialog } from "@/components/portal/PickupRequestDialog";

export default function SupplierPortal() {
  const { user } = useAuth();
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [pickupDialogOpen, setPickupDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Get supplier's company
  const { data: myContact } = useQuery({
    queryKey: ["my-contact", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, company:companies(*)")
        .eq("user_id", user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get announcements
  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ["my-announcements", myContact?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_announcements")
        .select("*")
        .eq("company_id", myContact?.company_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!myContact?.company_id,
  });

  // Get pickup requests
  const { data: pickupRequests, isLoading: pickupsLoading } = useQuery({
    queryKey: ["my-pickup-requests", myContact?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_requests")
        .select("*, container:containers(*)")
        .eq("company_id", myContact?.company_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!myContact?.company_id,
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
    if (!slot) return "-";
    const labels: Record<string, string> = {
      morning: "Vormittag (8-12 Uhr)",
      afternoon: "Nachmittag (12-17 Uhr)",
      flexible: "Flexibel",
    };
    return labels[slot] || slot;
  };

  if (!myContact) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Kein Zugang</CardTitle>
            <CardDescription>
              Ihr Benutzerkonto ist noch keiner Firma zugeordnet. Bitte kontaktieren Sie den Administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lieferanten-Portal</h1>
        <p className="text-muted-foreground">
          Willkommen, {myContact.first_name}! ({myContact.company?.name})
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setAnnouncementDialogOpen(true)}>
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Material anmelden</CardTitle>
              <CardDescription>Neue Lieferung ankündigen</CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setPickupDialogOpen(true)}>
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Abholung anfordern</CardTitle>
              <CardDescription>Container zur Abholung melden</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="announcements">
        <TabsList>
          <TabsTrigger value="announcements">Materialanmeldungen</TabsTrigger>
          <TabsTrigger value="pickups">Abholungsanfragen</TabsTrigger>
        </TabsList>

        <TabsContent value="announcements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Meine Anmeldungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              {announcementsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Lädt...</div>
              ) : announcements?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Anmeldungen vorhanden
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Menge</TableHead>
                        <TableHead>Behälter</TableHead>
                        <TableHead>Wunschtermin</TableHead>
                        <TableHead>Bestätigt</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {announcements?.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-sm">{a.announcement_id}</TableCell>
                          <TableCell>
                            {a.material_type}
                            {a.material_subtype && ` (${a.material_subtype})`}
                          </TableCell>
                          <TableCell>{a.estimated_weight_kg} kg</TableCell>
                          <TableCell>
                            {a.container_count}x {a.container_type}
                          </TableCell>
                          <TableCell>
                            {a.preferred_date && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(a.preferred_date), "dd.MM.yyyy", { locale: de })}
                              </div>
                            )}
                            {a.preferred_time_slot && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {getTimeSlotLabel(a.preferred_time_slot)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {a.confirmed_date ? (
                              <div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(a.confirmed_date), "dd.MM.yyyy", { locale: de })}
                                </div>
                                {a.confirmed_time_slot && (
                                  <div className="text-sm text-muted-foreground">
                                    {getTimeSlotLabel(a.confirmed_time_slot)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(a.status)}</TableCell>
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
                Meine Abholungsanfragen
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pickupsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Lädt...</div>
              ) : pickupRequests?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Abholungsanfragen vorhanden
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Container</TableHead>
                        <TableHead>Wunschtermin</TableHead>
                        <TableHead>Bestätigt</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pickupRequests?.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-sm">{p.request_id}</TableCell>
                          <TableCell>{p.material_description}</TableCell>
                          <TableCell>{p.container?.container_id || "-"}</TableCell>
                          <TableCell>
                            {p.preferred_date && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(p.preferred_date), "dd.MM.yyyy", { locale: de })}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {p.confirmed_date
                              ? format(new Date(p.confirmed_date), "dd.MM.yyyy", { locale: de })
                              : "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(p.status)}</TableCell>
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

      {myContact && (
        <>
          <AnnouncementDialog
            open={announcementDialogOpen}
            onOpenChange={setAnnouncementDialogOpen}
            companyId={myContact.company_id}
            contactId={myContact.id}
          />
          <PickupRequestDialog
            open={pickupDialogOpen}
            onOpenChange={setPickupDialogOpen}
            companyId={myContact.company_id}
            contactId={myContact.id}
          />
        </>
      )}
    </div>
  );
}
