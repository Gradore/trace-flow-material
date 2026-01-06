import { Link } from "react-router-dom";
import { Recycle } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Recycle className="h-4 w-4 text-primary" />
            <span>© {currentYear} RecyTrack. Alle Rechte vorbehalten.</span>
          </div>
          
          <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm">
            <Link 
              to="/impressum" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Impressum
            </Link>
            <Link 
              to="/datenschutz" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Datenschutz
            </Link>
            <Link 
              to="/agb" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              AGB
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
