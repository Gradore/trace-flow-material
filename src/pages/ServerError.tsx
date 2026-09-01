import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

interface ServerErrorProps {
  /** The crash that produced this page - only rendered during development. */
  error?: Error | null;
  /** React component stack of that crash - only rendered during development. */
  componentStack?: string | null;
}

/**
 * 5xx page. Rendered by <ErrorBoundary>, which sits above <BrowserRouter>,
 * so the way back home is a plain anchor and not a react-router <Link>.
 */
export default function ServerError({ error = null, componentStack = null }: ServerErrorProps) {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">500 - Serverfehler</CardTitle>
          <CardDescription>
            Ein unerwarteter Fehler ist aufgetreten. Wir arbeiten daran, das Problem zu beheben.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bitte versuchen Sie es in einigen Minuten erneut. 
            Falls das Problem weiterhin besteht, kontaktieren Sie bitte unseren Support.
          </p>

          {import.meta.env.DEV && error && (
            <div className="bg-muted rounded-lg p-4 overflow-auto max-h-48 text-left">
              <p className="text-sm font-mono text-destructive">{error.message}</p>
              {componentStack && (
                <pre className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                  {componentStack}
                </pre>
              )}
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={handleReload} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Erneut versuchen
            </Button>
            <Button asChild variant="outline">
              <a href="/">
                <Home className="mr-2 h-4 w-4" />
                Zur Startseite
              </a>
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground pt-4">
            Support: info@gradore.de
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
