import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Package, ShoppingCart, FileText, Plus, Eye } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CustomerOrderDialog } from "@/components/portal/CustomerOrderDialog";

export default function CustomerPortal() {
  const { user } = useAuth();
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);

  // Get customer's company
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

  // Get available stock (output materials in_stock)
  const { data: stock, isLoading: stockLoading } = useQuery({
    queryKey: ["available-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("output_materials")
        .select("*")
        .eq("status", "in_stock")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Get customer's orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["my-orders", myContact?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, delivery_note:delivery_notes(*)")
        .eq("company_id", myContact?.company_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!myContact?.company_id,
  });

  // Get customer's documents (delivery notes)
  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ["my-documents", myContact?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_notes")
        .select("*")
        .eq("partner_name", myContact?.company?.name)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!myContact?.company?.name,
  });

  const getOrderStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      in_production: "default",
      ready: "default",
      delivered: "outline",
      cancelled: "destructive",
    };
    const labels: Record<string, string> = {
      pending: "Ausstehend",
      in_production: "In Produktion",
      ready: "Fertig",
      delivered: "Geliefert",
      cancelled: "Storniert",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  // Group stock by output_type
  const stockByType = stock?.reduce((acc, item) => {
    const key = item.output_type;
    if (!acc[key]) {
      acc[key] = { count: 0, totalWeight: 0 };
    }
    acc[key].count += 1;
    acc[key].totalWeight += Number(item.weight_kg);
    return acc;
  }, {} as Record<string, { count: number; totalWeight: number }>);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kunden-Portal</h1>
          <p className="text-muted-foreground">
            Willkommen, {myContact.first_name}! ({myContact.company?.name})
          </p>
        </div>
        <Button onClick={() => setOrderDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Auftrag
        </Button>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Lagerbestand</TabsTrigger>
          <TabsTrigger value="orders">Meine Aufträge</TabsTrigger>
          <TabsTrigger value="documents">Dokumente</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {stockByType && Object.entries(stockByType).map(([type, data]) => (
              <Card key={type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{type}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalWeight.toLocaleString("de-DE")} kg</div>
                  <p className="text-sm text-muted-foreground">{data.count} Chargen verfügbar</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Verfügbare Materialien
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stockLoading ? (
                <div className="text-center py-8 text-muted-foreground">Lädt...</div>
              ) : stock?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aktuell keine Materialien verfügbar
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chargen-ID</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Qualität</TableHead>
                        <TableHead>Gewicht</TableHead>
                        <TableHead>Erstellt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stock?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">{item.batch_id}</TableCell>
                          <TableCell>{item.output_type}</TableCell>
                          <TableCell>
                            {item.quality_grade ? (
                              <Badge variant="outline">{item.quality_grade}</Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{Number(item.weight_kg).toLocaleString("de-DE")} kg</TableCell>
                          <TableCell>
                            {format(new Date(item.created_at), "dd.MM.yyyy", { locale: de })}
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

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Meine Aufträge
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Lädt...</div>
              ) : orders?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Aufträge vorhanden
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Auftrags-ID</TableHead>
                        <TableHead>Produkt</TableHead>
                        <TableHead>Menge</TableHead>
                        <TableHead>Produktionsfrist</TableHead>
                        <TableHead>Lieferfrist</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders?.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">{order.order_id}</TableCell>
                          <TableCell>{order.product_name}</TableCell>
                          <TableCell>{Number(order.quantity_kg).toLocaleString("de-DE")} kg</TableCell>
                          <TableCell>
                            {format(new Date(order.production_deadline), "dd.MM.yyyy", { locale: de })}
                          </TableCell>
                          <TableCell>
                            {format(new Date(order.delivery_deadline), "dd.MM.yyyy", { locale: de })}
                          </TableCell>
                          <TableCell>{getOrderStatusBadge(order.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Lieferscheine & Dokumente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {docsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Lädt...</div>
              ) : documents?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Dokumente vorhanden
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lieferschein-Nr.</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Gewicht</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead className="text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents?.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-mono text-sm">{doc.note_id}</TableCell>
                          <TableCell>
                            <Badge variant={doc.type === "incoming" ? "secondary" : "default"}>
                              {doc.type === "incoming" ? "Eingang" : "Ausgang"}
                            </Badge>
                          </TableCell>
                          <TableCell>{doc.material_description}</TableCell>
                          <TableCell>{Number(doc.weight_kg).toLocaleString("de-DE")} kg</TableCell>
                          <TableCell>
                            {format(new Date(doc.created_at), "dd.MM.yyyy", { locale: de })}
                          </TableCell>
                          <TableCell className="text-right">
                            {doc.pdf_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(doc.pdf_url!, "_blank")}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
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

      {myContact && (
        <CustomerOrderDialog
          open={orderDialogOpen}
          onOpenChange={setOrderDialogOpen}
          companyId={myContact.company_id}
          companyName={myContact.company?.name || ""}
        />
      )}
    </div>
  );
}
