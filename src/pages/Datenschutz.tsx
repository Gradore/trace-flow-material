import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Recycle } from "lucide-react";

export default function Datenschutz() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Recycle className="h-6 w-6 text-primary" />
          </div>
          <span className="text-2xl font-bold">RecyTrack</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Datenschutzerklärung</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">1. Datenschutz auf einen Blick</h2>
              <h3 className="text-base font-medium mt-4">Allgemeine Hinweise</h3>
              <p className="text-muted-foreground">
                Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen 
                Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen 
                Sie persönlich identifiziert werden können.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Verantwortliche Stelle</h2>
              <p className="text-muted-foreground">
                [Firmenname]<br />
                [Straße und Hausnummer]<br />
                [PLZ] [Ort]<br />
                Deutschland<br /><br />
                Telefon: [Telefonnummer]<br />
                E-Mail: [E-Mail-Adresse]
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Erhebung und Speicherung personenbezogener Daten</h2>
              <h3 className="text-base font-medium mt-4">Bei Registrierung und Nutzung</h3>
              <p className="text-muted-foreground">
                Bei der Registrierung für RecyTrack erheben wir folgende Daten:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Name</li>
                <li>E-Mail-Adresse</li>
                <li>Firmenname</li>
                <li>Gewählte Benutzerrolle</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Bei der Nutzung der Anwendung werden zusätzlich gespeichert:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Materialeingänge und -ausgänge</li>
                <li>Probendaten und Analyseergebnisse</li>
                <li>Aufträge und Lieferscheine</li>
                <li>Dokumente und Verträge</li>
                <li>Audit-Logs (Aktivitätsprotokoll)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Rechtsgrundlage der Verarbeitung</h2>
              <p className="text-muted-foreground">
                Die Verarbeitung Ihrer Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO 
                (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem 
                sicheren und effizienten Betrieb der Anwendung).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Datenweitergabe an Dritte</h2>
              <p className="text-muted-foreground">
                Eine Übermittlung Ihrer persönlichen Daten an Dritte zu anderen als den im Folgenden 
                aufgeführten Zwecken findet nicht statt:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Cloud-Hosting-Dienste (Supabase) zur Datenspeicherung</li>
                <li>E-Mail-Dienste (Resend) für Benachrichtigungen</li>
                <li>Optional: CRM-Integration (Pipedrive) für Vertriebsprozesse</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Cookies und Tracking</h2>
              <p className="text-muted-foreground">
                RecyTrack verwendet technisch notwendige Cookies für die Authentifizierung und 
                Session-Verwaltung. Es werden keine Tracking-Cookies oder Analyse-Tools von Drittanbietern 
                eingesetzt.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Datensicherheit</h2>
              <p className="text-muted-foreground">
                Wir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um Ihre Daten gegen 
                Manipulation, Verlust, Zerstörung oder Zugriff unberechtigter Personen zu schützen:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Verschlüsselte Datenübertragung (TLS/SSL)</li>
                <li>Row Level Security (RLS) für Datenzugriffskontrollen</li>
                <li>Regelmäßige Sicherheitsüberprüfungen</li>
                <li>Audit-Logging aller Datenänderungen</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Ihre Rechte</h2>
              <p className="text-muted-foreground">
                Sie haben folgende Rechte hinsichtlich Ihrer bei uns gespeicherten personenbezogenen Daten:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li><strong>Auskunft</strong> (Art. 15 DSGVO): Sie können Auskunft über Ihre gespeicherten Daten verlangen</li>
                <li><strong>Berichtigung</strong> (Art. 16 DSGVO): Sie können die Berichtigung unrichtiger Daten verlangen</li>
                <li><strong>Löschung</strong> (Art. 17 DSGVO): Sie können die Löschung Ihrer Daten verlangen</li>
                <li><strong>Einschränkung</strong> (Art. 18 DSGVO): Sie können die Einschränkung der Verarbeitung verlangen</li>
                <li><strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO): Sie können Ihre Daten in einem gängigen Format erhalten</li>
                <li><strong>Widerspruch</strong> (Art. 21 DSGVO): Sie können der Verarbeitung widersprechen</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                <strong>DSGVO-Datenexport:</strong> Sie können im Bereich "Mein Profil" einen vollständigen Export 
                Ihrer personenbezogenen Daten im JSON-Format anfordern.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Speicherdauer</h2>
              <p className="text-muted-foreground">
                Wir speichern Ihre personenbezogenen Daten nur so lange, wie dies für die Erfüllung der 
                Zwecke erforderlich ist, für die sie erhoben wurden. Nach Beendigung des Vertragsverhältnisses 
                werden die Daten gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten bestehen.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Beschwerderecht</h2>
              <p className="text-muted-foreground">
                Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung 
                Ihrer personenbezogenen Daten durch uns zu beschweren.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">11. Aktualität und Änderung dieser Datenschutzerklärung</h2>
              <p className="text-muted-foreground">
                Diese Datenschutzerklärung ist aktuell gültig und hat den Stand Januar 2026. Durch die 
                Weiterentwicklung unserer Anwendung oder aufgrund geänderter gesetzlicher beziehungsweise 
                behördlicher Vorgaben kann es notwendig werden, diese Datenschutzerklärung zu ändern.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
