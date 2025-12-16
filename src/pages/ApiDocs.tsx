import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Code, Lock, Webhook, Database, FileJson, Users } from "lucide-react";

const ApiDocs = () => {
  const endpoints = [
    {
      method: "POST",
      path: "/functions/v1/pipedrive-sync",
      description: "Synchronisiert Daten mit Pipedrive CRM",
      auth: true,
      body: {
        action: "sync_company | sync_order | sync_activity | get_deals | get_persons",
        data: "Record<string, unknown> - Je nach action unterschiedlich"
      },
      example: `{
  "action": "sync_company",
  "data": {
    "name": "Musterfirma GmbH",
    "address": "Musterstraße 1, 12345 Musterstadt"
  }
}`
    },
    {
      method: "POST",
      path: "/functions/v1/gdpr-export",
      description: "Exportiert alle Nutzerdaten (DSGVO Art. 15)",
      auth: true,
      body: null,
      example: `// Keine Body-Parameter erforderlich
// Authorization Header mit Bearer Token erforderlich`
    },
    {
      method: "POST",
      path: "/functions/v1/send-notification-email",
      description: "Sendet E-Mail-Benachrichtigungen",
      auth: true,
      body: {
        to: "string - Empfänger E-Mail",
        subject: "string - Betreff",
        template: "string - Template-Name",
        data: "Record<string, unknown> - Template-Variablen"
      },
      example: `{
  "to": "kunde@beispiel.de",
  "subject": "Auftrag bestätigt",
  "template": "order_confirmed",
  "data": {
    "order_id": "AUF-2025-0001",
    "customer_name": "Max Mustermann"
  }
}`
    },
    {
      method: "POST",
      path: "/functions/v1/extract-contract",
      description: "Extrahiert Vertragsdaten aus PDF mittels KI",
      auth: true,
      body: {
        file_url: "string - URL zur PDF-Datei",
        company_id: "string - UUID der zugehörigen Firma"
      },
      example: `{
  "file_url": "https://storage.example.com/contracts/vertrag.pdf",
  "company_id": "550e8400-e29b-41d4-a716-446655440000"
}`
    }
  ];

  const dataModels = [
    {
      name: "companies",
      description: "Kunden- und Lieferantenverwaltung",
      fields: [
        { name: "id", type: "uuid", description: "Primärschlüssel" },
        { name: "company_id", type: "text", description: "Lesbare Firmen-ID" },
        { name: "name", type: "text", description: "Firmenname" },
        { name: "type", type: "text", description: "supplier | customer | both" },
        { name: "status", type: "text", description: "active | inactive" },
      ]
    },
    {
      name: "orders",
      description: "Kundenaufträge",
      fields: [
        { name: "id", type: "uuid", description: "Primärschlüssel" },
        { name: "order_id", type: "text", description: "Lesbare Auftrags-ID" },
        { name: "customer_name", type: "text", description: "Kundenname" },
        { name: "product_category", type: "text", description: "UP-Harz | EP-Harz" },
        { name: "quantity_kg", type: "numeric", description: "Bestellmenge in kg" },
        { name: "status", type: "text", description: "pending | in_production | ready | delivered" },
      ]
    },
    {
      name: "material_inputs",
      description: "Materialeingang",
      fields: [
        { name: "id", type: "uuid", description: "Primärschlüssel" },
        { name: "input_id", type: "text", description: "Lesbare Eingangs-ID" },
        { name: "material_type", type: "text", description: "gfk | pp | pa" },
        { name: "weight_kg", type: "numeric", description: "Gewicht in kg" },
        { name: "status", type: "text", description: "received | in_processing | processed" },
      ]
    },
    {
      name: "output_materials",
      description: "Ausgangsmaterialien / Fertigprodukte",
      fields: [
        { name: "id", type: "uuid", description: "Primärschlüssel" },
        { name: "output_id", type: "text", description: "Lesbare Ausgangs-ID" },
        { name: "output_type", type: "text", description: "glass_fiber | resin | pp_regrind | pa_regrind" },
        { name: "weight_kg", type: "numeric", description: "Gewicht in kg" },
        { name: "quality_grade", type: "text", description: "Qualitätsstufe" },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">API-Dokumentation</h1>
        <p className="text-muted-foreground">REST API Referenz für externe Integrationen</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Authentifizierung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Alle API-Anfragen erfordern einen gültigen JWT-Token im Authorization Header:
          </p>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`Authorization: Bearer <your-jwt-token>

// Token erhalten Sie nach erfolgreicher Anmeldung über:
const { data } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'your-password'
});
const token = data.session.access_token;`}
          </pre>
        </CardContent>
      </Card>

      <Tabs defaultValue="endpoints">
        <TabsList>
          <TabsTrigger value="endpoints" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Endpoints
          </TabsTrigger>
          <TabsTrigger value="models" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Datenmodelle
          </TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="space-y-4 mt-4">
          {endpoints.map((endpoint, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <Badge variant={endpoint.method === "GET" ? "secondary" : "default"}>
                    {endpoint.method}
                  </Badge>
                  <code className="text-sm font-mono">{endpoint.path}</code>
                  {endpoint.auth && (
                    <Badge variant="outline" className="ml-auto">
                      <Lock className="h-3 w-3 mr-1" />
                      Auth
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{endpoint.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {endpoint.body && (
                  <div>
                    <h4 className="font-medium mb-2">Request Body:</h4>
                    <div className="bg-muted rounded-lg p-3">
                      {Object.entries(endpoint.body).map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-sm">
                          <code className="text-primary">{key}:</code>
                          <span className="text-muted-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="font-medium mb-2">Beispiel:</h4>
                  <ScrollArea className="h-[150px]">
                    <pre className="bg-muted p-4 rounded-lg text-xs">{endpoint.example}</pre>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="models" className="space-y-4 mt-4">
          {dataModels.map((model, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  {model.name}
                </CardTitle>
                <CardDescription>{model.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">Feld</th>
                        <th className="p-2 text-left">Typ</th>
                        <th className="p-2 text-left">Beschreibung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.fields.map((field, fieldIndex) => (
                        <tr key={fieldIndex} className="border-b last:border-0">
                          <td className="p-2">
                            <code className="text-primary">{field.name}</code>
                          </td>
                          <td className="p-2">
                            <Badge variant="outline">{field.type}</Badge>
                          </td>
                          <td className="p-2 text-muted-foreground">{field.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Rate Limiting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Standard: 100 Anfragen pro Minute pro Benutzer</p>
          <p>• Bulk-Operationen: 10 Anfragen pro Minute</p>
          <p>• Bei Überschreitung: HTTP 429 Too Many Requests</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiDocs;
