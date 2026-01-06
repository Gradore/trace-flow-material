import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Recycle } from "lucide-react";

export default function AGB() {
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
            <CardTitle className="text-2xl">Allgemeine Geschäftsbedingungen (AGB)</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">§ 1 Geltungsbereich</h2>
              <p className="text-muted-foreground">
                (1) Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Software-as-a-Service 
                (SaaS) Lösung "RecyTrack" (nachfolgend "Dienst") der [Firmenname] (nachfolgend "Anbieter").
              </p>
              <p className="text-muted-foreground">
                (2) Abweichende Bedingungen des Kunden werden nicht anerkannt, es sei denn, der Anbieter 
                stimmt ihrer Geltung ausdrücklich schriftlich zu.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">§ 2 Vertragsgegenstand</h2>
              <p className="text-muted-foreground">
                (1) Der Anbieter stellt dem Kunden die cloudbasierte Anwendung RecyTrack zur Verfügung. 
                Die Anwendung dient der Verwaltung und Nachverfolgung von Materialflüssen in der 
                Recycling-Industrie.
              </p>
              <p className="text-muted-foreground">
                (2) Der Funktionsumfang ergibt sich aus der aktuellen Leistungsbeschreibung auf der 
                Website des Anbieters.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">§ 3 Registrierung und Zugang</h2>
              <p className="text-muted-foreground">
                (1) Die Nutzung des Dienstes erfordert eine Registrierung. Der Kunde ist verpflichtet, 
                wahrheitsgemäße Angaben zu machen.
              </p>
              <p className="text-muted-foreground">
                (2) Die Registrierung wird erst nach Freigabe durch den Administrator wirksam.
              </p>
              <p className="text-muted-foreground">
                (3) Der Kunde ist für die Geheimhaltung seiner Zugangsdaten verantwortlich und haftet 
                für alle Aktivitäten, die unter seinem Benutzerkonto erfolgen.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">§ 4 Nutzungsrechte</h2>
              <p className="text-muted-foreground">
                (1) Der Anbieter räumt dem Kunden für die Dauer des Vertrages ein einfaches, nicht 
                übertragbares und nicht unterlizenzierbares Recht zur Nutzung des Dienstes ein.
              </p>
              <p className="text-muted-foreground">
                (2) Der Kunde darf den Dienst ausschließlich für eigene geschäftliche Zwecke nutzen.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">§ 5 Pflichten des Kunden</h2>
              <p className="text-muted-foreground">
                Der Kunde verpflichtet sich:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Den Dienst nicht missbräuchlich zu nutzen</li>
                <li>Keine rechtswidrigen Inhalte zu speichern oder zu verbreiten</li>
                <li>Die technische Infrastruktur nicht zu beeinträchtigen</li>
                <li>Zugangsdaten sicher aufzubewahren und vor unbefugtem Zugriff zu schützen</li>
                <li>Sicherheitsvorfälle unverzüglich zu melden</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">§ 6 Verfügbarkeit</h2>
              <p className="text-muted-foreground">
                (1) Der Anbieter bemüht sich um eine Verfügbarkeit des Dienstes von 99% im Jahresmittel.
              </p>
              <p className="text-muted-foreground">
                (2) Geplante Wartungsarbeiten werden nach Möglichkeit vorab angekündigt und finden 
                vorzugsweise außerhalb der üblichen Geschäftszeiten statt.
              </p>
              <p className="text-muted-foreground">
                (3) Die Verfügbarkeitsgarantie gilt nicht bei Störungen, die außerhalb des 
                Einflussbereichs des Anbieters liegen.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">§ 7 Datensicherung</h2>
              <p className="text-muted-foreground">
                (1) Der Anbieter führt regelmäßige Backups der Kundendaten durch.
              </p>
              <p className="text-muted-foreground">
                (2) Der Kunde ist dennoch angehalten, eigene Sicherungskopien seiner Daten zu erstellen.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">§ 8 Datenschutz</h2>
              <p className="text-muted-foreground">
                (1) Der Anbieter verarbeitet personenbezogene Daten gemäß der geltenden 
                Datenschutzgrundverordnung (DSGVO).
              </p>
              <p className="text-muted-foreground">
                (2) Einzelheiten zur Datenverarbeitung sind der Datenschutzerklärung zu entnehmen.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">§ 9 Haftung</h2>
              <p className="text-muted-foreground">
                (1) Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für 
                Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit.
              </p>
              <p className="text-muted-foreground">
                (2) Bei leichter Fahrlässigkeit haftet der Anbieter nur bei Verletzung wesentlicher 
                Vertragspflichten, begrenzt auf den typischerweise vorhersehbaren Schaden.
              </p>
              <p className="text-muted-foreground">
                (3) Die Haftung für Datenverlust ist auf den typischen Wiederherstellungsaufwand 
                beschränkt, der bei ordnungsgemäßer Datensicherung entstanden wäre.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">§ 10 Vertragslaufzeit und Kündigung</h2>
              <p className="text-muted-foreground">
                (1) Der Vertrag wird auf unbestimmte Zeit geschlossen.
              </p>
              <p className="text-muted-foreground">
                (2) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.
              </p>
              <p className="text-muted-foreground">
                (3) Nach Vertragsbeendigung werden die Kundendaten nach einer Übergangsfrist von 30 Tagen 
                gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">§ 11 Änderungen der AGB</h2>
              <p className="text-muted-foreground">
                (1) Der Anbieter behält sich vor, diese AGB zu ändern. Änderungen werden dem Kunden 
                rechtzeitig mitgeteilt.
              </p>
              <p className="text-muted-foreground">
                (2) Widerspricht der Kunde nicht innerhalb von 30 Tagen nach Mitteilung, gelten die 
                neuen AGB als angenommen.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">§ 12 Schlussbestimmungen</h2>
              <p className="text-muted-foreground">
                (1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
              </p>
              <p className="text-muted-foreground">
                (2) Gerichtsstand für alle Streitigkeiten ist, soweit gesetzlich zulässig, der Sitz 
                des Anbieters.
              </p>
              <p className="text-muted-foreground">
                (3) Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die 
                Wirksamkeit der übrigen Bestimmungen unberührt.
              </p>
            </section>

            <section className="mt-8 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Stand: Januar 2026
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
