import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Truck, Package, Calendar, User } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { OrderDialog } from "@/components/orders/OrderDialog";

type Order = {
  id: string;
  order_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  product_category: string;
  product_grain_size: string;
  product_subcategory: string;
  product_name: string;
  quantity_kg: number;
  production_deadline: string;
  delivery_deadline: string;
  delivery_partner: string | null;
  delivery_address: string | null;
  status: string;
  output_material_id: string | null;
  delivery_note_id: string | null;
  notes: string | null;
  created_at: string;
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Ausstehend", variant: "outline" },
  in_production: { label: "In Produktion", variant: "secondary" },
  produced: { label: "Produziert", variant: "default" },
  shipped: { label: "Versendet", variant: "default" },
  delivered: { label: "Geliefert", variant: "default" },
  cancelled: { label: "Storniert", variant: "destructive" },
};

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Status aktualisiert");
    },
    onError: () => {
      toast.error("Fehler beim Aktualisieren");
    },
  });

  const filteredOrders = orders?.filter(
    (order) =>
      order.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDeadlineStatus = (deadline: string) => {
    const date = new Date(deadline);
    if (isPast(date) && !isToday(date)) return "overdue";
    if (isToday(date) || isPast(addDays(new Date(), 3))) return "urgent";
    return "ok";
  };

  const handleEdit = (order: Order) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedOrder(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Aufträge</h1>
          <p className="text-muted-foreground">Kundenaufträge und Produktionsplanung</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Neuer Auftrag
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Auftrag, Kunde, Produkt..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Package className="h-4 w-4" />
            <span className="text-sm">Offene Aufträge</span>
          </div>
          <p className="text-2xl font-bold">
            {orders?.filter((o) => ["pending", "in_production"].includes(o.status)).length || 0}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Heute fällig</span>
          </div>
          <p className="text-2xl font-bold">
            {orders?.filter((o) => isToday(new Date(o.production_deadline))).length || 0}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Truck className="h-4 w-4" />
            <span className="text-sm">Versandbereit</span>
          </div>
          <p className="text-2xl font-bold">
            {orders?.filter((o) => o.status === "produced").length || 0}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <User className="h-4 w-4" />
            <span className="text-sm">Kunden</span>
          </div>
          <p className="text-2xl font-bold">
            {new Set(orders?.map((o) => o.customer_name)).size || 0}
          </p>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Auftrag</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Produkt</TableHead>
              <TableHead className="text-right">Menge</TableHead>
              <TableHead>Produktion bis</TableHead>
              <TableHead>Lieferung bis</TableHead>
              <TableHead>Lieferpartner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Lädt...
                </TableCell>
              </TableRow>
            ) : filteredOrders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Keine Aufträge gefunden
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders?.map((order) => {
                const prodDeadlineStatus = getDeadlineStatus(order.production_deadline);
                const deliveryDeadlineStatus = getDeadlineStatus(order.delivery_deadline);

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.customer_name}</p>
                        {order.customer_email && (
                          <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.product_category}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{order.quantity_kg} kg</TableCell>
                    <TableCell>
                      <span
                        className={
                          prodDeadlineStatus === "overdue"
                            ? "text-destructive font-medium"
                            : prodDeadlineStatus === "urgent"
                            ? "text-orange-500 font-medium"
                            : ""
                        }
                      >
                        {format(new Date(order.production_deadline), "dd.MM.yyyy", { locale: de })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          deliveryDeadlineStatus === "overdue"
                            ? "text-destructive font-medium"
                            : deliveryDeadlineStatus === "urgent"
                            ? "text-orange-500 font-medium"
                            : ""
                        }
                      >
                        {format(new Date(order.delivery_deadline), "dd.MM.yyyy", { locale: de })}
                      </span>
                    </TableCell>
                    <TableCell>{order.delivery_partner || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[order.status]?.variant || "outline"}>
                        {statusConfig[order.status]?.label || order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(order)}>
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateStatusMutation.mutate({ id: order.id, status: "in_production" })
                            }
                            disabled={order.status !== "pending"}
                          >
                            Produktion starten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateStatusMutation.mutate({ id: order.id, status: "produced" })
                            }
                            disabled={order.status !== "in_production"}
                          >
                            Als produziert markieren
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateStatusMutation.mutate({ id: order.id, status: "shipped" })
                            }
                            disabled={order.status !== "produced"}
                          >
                            Als versendet markieren
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateStatusMutation.mutate({ id: order.id, status: "delivered" })
                            }
                            disabled={order.status !== "shipped"}
                          >
                            Als geliefert markieren
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateStatusMutation.mutate({ id: order.id, status: "cancelled" })
                            }
                            className="text-destructive"
                          >
                            Stornieren
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <OrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={selectedOrder}
      />
    </div>
  );
}
