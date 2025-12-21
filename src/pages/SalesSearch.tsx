import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  Search, 
  Building2, 
  FileText, 
  Sparkles, 
  Globe,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Loader2,
  Users,
  Download,
  Save
} from "lucide-react";

export default function SalesSearch() {
  const queryClient = useQueryClient();
  const [datasheetText, setDatasheetText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [includeExternal, setIncludeExternal] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Fetch saved manufacturer matches
  const { data: savedMatches } = useQuery({
    queryKey: ['manufacturer-matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manufacturer_matches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    }
  });

  // Analyze datasheet for applications
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      setIsSearching(true);
      const { data, error } = await supabase.functions.invoke('analyze-datasheet', {
        body: {
          datasheetText,
          analysisType: 'sales_search'
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setAnalysisResult(data.result);
      // Convert to search results format
      const results = data.result.potential_manufacturers?.map((mfr: any) => ({
        manufacturer_name: mfr.company_name,
        industry: mfr.industry,
        application_areas: mfr.products,
        address: mfr.location,
        website: mfr.website,
        notes: mfr.notes,
        source: 'ai_search',
        confidence_score: 0.75
      })) || [];
      setSearchResults(results);
      toast.success(`${results.length} potenzielle Kunden gefunden`);
    },
    onError: (error) => {
      toast.error(`Analyse fehlgeschlagen: ${error.message}`);
    },
    onSettled: () => {
      setIsSearching(false);
    }
  });

  // Search manufacturers
  const searchMutation = useMutation({
    mutationFn: async () => {
      setIsSearching(true);
      const { data, error } = await supabase.functions.invoke('search-manufacturers', {
        body: {
          searchQuery: searchQuery || datasheetText,
          materialProperties: analysisResult?.composition,
          includeExternal
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSearchResults(data.results || []);
      toast.success(`${data.internalCount} interne, ${data.externalCount} externe Ergebnisse`);
    },
    onError: (error) => {
      toast.error(`Suche fehlgeschlagen: ${error.message}`);
    },
    onSettled: () => {
      setIsSearching(false);
    }
  });

  // Save match mutation
  const saveMatchMutation = useMutation({
    mutationFn: async (match: any) => {
      const { error } = await supabase
        .from('manufacturer_matches')
        .insert({
          search_query: searchQuery || datasheetText.slice(0, 200),
          manufacturer_name: match.manufacturer_name,
          product_name: match.product_name,
          application_areas: match.application_areas,
          contact_name: match.contact_name,
          contact_email: match.contact_email,
          contact_phone: match.contact_phone,
          website: match.website,
          address: match.address,
          notes: match.notes,
          source: match.source,
          confidence_score: match.confidence_score,
          company_id: match.company_id
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturer-matches'] });
      toast.success('Kontakt gespeichert');
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    }
  });

  const exportResults = () => {
    if (!searchResults.length) return;
    
    const csvContent = [
      ['Firma', 'Branche', 'Anwendungen', 'Kontakt', 'E-Mail', 'Telefon', 'Adresse', 'Website', 'Quelle'].join(';'),
      ...searchResults.map(r => [
        r.manufacturer_name,
        r.industry || '',
        (r.application_areas || []).join(', '),
        r.contact_name || '',
        r.contact_email || '',
        r.contact_phone || '',
        r.address || '',
        r.website || '',
        r.source
      ].join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vertriebskontakte_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-7 w-7 text-primary" />
              KI Vertriebssuche
            </h1>
            <p className="text-muted-foreground mt-1">
              Finde passende Kunden und Hersteller basierend auf Materialdaten
            </p>
          </div>
          {searchResults.length > 0 && (
            <Button variant="outline" onClick={exportResults}>
              <Download className="h-4 w-4 mr-2" />
              Exportieren
            </Button>
          )}
        </div>

        <Tabs defaultValue="search" className="space-y-4">
          <TabsList>
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Suche
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2">
              <Users className="h-4 w-4" />
              Gespeicherte ({savedMatches?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Search Input */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Datenblatt eingeben
                  </CardTitle>
                  <CardDescription>
                    Geben Sie Materialdaten ein, um passende Anwendungen und Kunden zu finden
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Suchbegriff / Materialname (optional)</Label>
                    <Input
                      placeholder="z.B. PP-GF30 Hochfest"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Datenblatt / Materialeigenschaften</Label>
                    <Textarea
                      placeholder="Fügen Sie hier das Datenblatt ein...&#10;&#10;Beispiel:&#10;Material: PP-GF30&#10;Zugfestigkeit: 85 MPa&#10;Wärmeformbeständigkeit: 150°C&#10;Anwendung: Strukturbauteile"
                      value={datasheetText}
                      onChange={(e) => setDatasheetText(e.target.value)}
                      className="min-h-[180px] font-mono text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="external-search"
                        checked={includeExternal}
                        onCheckedChange={setIncludeExternal}
                      />
                      <Label htmlFor="external-search" className="flex items-center gap-1">
                        <Globe className="h-4 w-4" />
                        Externe Suche
                      </Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={() => analyzeMutation.mutate()}
                      disabled={!datasheetText.trim() || isSearching}
                      variant="outline"
                    >
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Analysieren
                    </Button>
                    <Button 
                      onClick={() => searchMutation.mutate()}
                      disabled={(!datasheetText.trim() && !searchQuery.trim()) || isSearching}
                    >
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Suchen
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Analysis Summary */}
              {analysisResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Analyse-Ergebnis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">{analysisResult.material_summary}</p>
                    
                    {analysisResult.applications?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Passende Anwendungen</h4>
                        <div className="space-y-2">
                          {analysisResult.applications.slice(0, 5).map((app: any, idx: number) => (
                            <div key={idx} className="p-2 bg-muted rounded-lg">
                              <p className="font-medium text-sm">{app.name}</p>
                              <p className="text-xs text-muted-foreground">{app.industry}</p>
                              {app.typical_components && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {app.typical_components.slice(0, 3).map((comp: string, i: number) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {comp}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysisResult.market_insights && (
                      <div>
                        <h4 className="font-medium mb-1">Markt-Insights</h4>
                        <p className="text-sm text-muted-foreground">{analysisResult.market_insights}</p>
                      </div>
                    )}

                    {analysisResult.recommended_approach && (
                      <div>
                        <h4 className="font-medium mb-1">Empfohlene Vorgehensweise</h4>
                        <p className="text-sm text-muted-foreground">{analysisResult.recommended_approach}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Gefundene Kontakte ({searchResults.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchResults.map((result, idx) => (
                      <Card key={idx} className="relative">
                        <CardContent className="pt-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold">{result.manufacturer_name}</h4>
                            <Badge 
                              variant={result.source === 'internal' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {result.source === 'internal' ? 'Intern' : 'KI'}
                            </Badge>
                          </div>
                          
                          {result.industry && (
                            <p className="text-sm text-muted-foreground">{result.industry}</p>
                          )}

                          {result.application_areas?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {result.application_areas.slice(0, 3).map((area: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {area}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div className="space-y-1 text-sm">
                            {result.contact_name && (
                              <p className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {result.contact_name}
                              </p>
                            )}
                            {result.contact_email && (
                              <p className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                <a href={`mailto:${result.contact_email}`} className="text-primary hover:underline">
                                  {result.contact_email}
                                </a>
                              </p>
                            )}
                            {result.contact_phone && (
                              <p className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {result.contact_phone}
                              </p>
                            )}
                            {result.address && (
                              <p className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {result.address}
                              </p>
                            )}
                            {result.website && (
                              <p className="flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" />
                                <a 
                                  href={result.website.startsWith('http') ? result.website : `https://${result.website}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline truncate"
                                >
                                  {result.website.replace(/^https?:\/\//, '')}
                                </a>
                              </p>
                            )}
                          </div>

                          {result.notes && (
                            <p className="text-xs text-muted-foreground italic">{result.notes}</p>
                          )}

                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full mt-2"
                            onClick={() => saveMatchMutation.mutate(result)}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Speichern
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="saved">
            <Card>
              <CardHeader>
                <CardTitle>Gespeicherte Kontakte</CardTitle>
              </CardHeader>
              <CardContent>
                {savedMatches?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Firma</TableHead>
                        <TableHead>Anwendungen</TableHead>
                        <TableHead>Kontakt</TableHead>
                        <TableHead>E-Mail</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>Quelle</TableHead>
                        <TableHead>Gespeichert</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedMatches.map((match) => (
                        <TableRow key={match.id}>
                          <TableCell className="font-medium">{match.manufacturer_name}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(match.application_areas || []).slice(0, 2).map((area: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {area}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>{match.contact_name || '-'}</TableCell>
                          <TableCell>
                            {match.contact_email ? (
                              <a href={`mailto:${match.contact_email}`} className="text-primary hover:underline">
                                {match.contact_email}
                              </a>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{match.contact_phone || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{match.source}</Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(match.created_at).toLocaleDateString('de-DE')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">
                    Noch keine Kontakte gespeichert
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
