import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Building2, Users, Phone, Mail, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CompanyDialog } from "@/components/companies/CompanyDialog";
import { ContactsDialog } from "@/components/companies/ContactsDialog";
import { useExport } from "@/hooks/useExport";
import { PageDescription } from "@/components/layout/PageDescription";

// ... keep existing code

type Company = {
  id: string;
  company_id: string;
  name: string;
  type: "customer" | "supplier" | "both";
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  tax_id: string | null;
  notes: string | null;
  status: "active" | "inactive";
  created_at: string;
};

export default function Companies() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contactsDialogOpen, setContactsDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const queryClient = useQueryClient();
  const { exportDataToCSV } = useExport();

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies", search, typeFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("companies")
        .select("*")
        .order("name", { ascending: true });

      if (search) {
        query = query.or(`name.ilike.%${search}%,company_id.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Company[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Firma gelöscht");
    },
    onError: (error) => {
      toast.error("Fehler beim Löschen: " + error.message);
    },
  });

  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    setDialogOpen(true);
  };

  const handleContacts = (company: Company) => {
    setSelectedCompany(company);
    setContactsDialogOpen(true);
  };

  const handleExport = () => {
    if (companies) {
      exportDataToCSV(companies as Record<string, unknown>[], "firmen");
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "customer":
        return <Badge variant="default">Kunde</Badge>;
      case "supplier":
        return <Badge variant="secondary">Lieferant</Badge>;
      case "both":
        return <Badge variant="outline">Kunde & Lieferant</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageDescription
        title="Kunden- und Lieferantenverwaltung"
        description="Stammdaten aller Geschäftspartner (Kunden, Lieferanten oder beides). Firmendaten werden für Materialeingänge, Aufträge, Lieferscheine und Verträge verwendet. Hier hinterlegte Ansprechpartner erscheinen in den Auswahllisten."
        nextSteps={[
          "Neue Firma anlegen → Für Geschäftsbeziehung",
          "Ansprechpartner hinzufügen → Für Kontaktdaten",
          "Vertrag hochladen → Für Konditionen"
        ]}
        workflowLinks={[
          { label: "Materialeingang", path: "/intake", direction: "next" },
          { label: "Aufträge", path: "/orders", direction: "next" },
          { label: "Lieferscheine", path: "/delivery-notes", direction: "next" },
          { label: "Vertriebssuche", path: "/sales-search", direction: "next" },
        ]}
      />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Firmenverwaltung</h1>
          <p className="text-muted-foreground">
            Kunden und Lieferanten verwalten
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            Exportieren
          </Button>
          <Button onClick={() => { setSelectedCompany(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Firma
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Firmen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Name, ID oder E-Mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Typ filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                <SelectItem value="customer">Kunden</SelectItem>
                <SelectItem value="supplier">Lieferanten</SelectItem>
                <SelectItem value="both">Kunde & Lieferant</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="inactive">Inaktiv</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Lädt...
            </div>
          ) : companies?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Keine Firmen gefunden
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firmen-ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead>Ort</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies?.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-mono text-sm">
                        {company.company_id}
                      </TableCell>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{getTypeBadge(company.type)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {company.email && (
                            <span className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" /> {company.email}
                            </span>
                          )}
                          {company.phone && (
                            <span className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" /> {company.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {company.city && company.postal_code
                          ? `${company.postal_code} ${company.city}`
                          : company.city || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={company.status === "active" ? "default" : "secondary"}>
                          {company.status === "active" ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleContacts(company)}
                            title="Ansprechpartner"
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(company)}
                            title="Bearbeiten"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(company.id)}
                            title="Löschen"
                          >
                            <Trash2 className="h-4 w-4" />
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

      <CompanyDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ["companies"] });
          }
        }}
        company={selectedCompany}
      />

      {selectedCompany && (
        <ContactsDialog
          open={contactsDialogOpen}
          onOpenChange={setContactsDialogOpen}
          company={selectedCompany}
        />
      )}
    </div>
  );
}
