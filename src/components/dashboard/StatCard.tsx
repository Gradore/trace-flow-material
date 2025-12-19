import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  variant?: "default" | "primary" | "warning" | "success";
  href?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = "default", href }: StatCardProps) {
  const navigate = useNavigate();
  
  const iconColors = {
    default: "bg-secondary text-secondary-foreground",
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
  };

  const handleClick = () => {
    if (href) {
      navigate(href);
    }
  };

  return (
    <div 
      className={cn(
        "stat-card group p-3 md:p-4 transition-all duration-200",
        href && "cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-primary/30"
      )}
      onClick={handleClick}
      role={href ? "button" : undefined}
      tabIndex={href ? 0 : undefined}
      onKeyDown={(e) => {
        if (href && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("p-2 md:p-3 rounded-lg transition-transform group-hover:scale-110 shrink-0", iconColors[variant])}>
          <Icon className="h-4 w-4 md:h-5 md:w-5" />
        </div>
        {trend && (
          <span className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            trend.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {trend.positive ? "+" : ""}{trend.value}%
          </span>
        )}
      </div>
      <div className="mt-2 md:mt-4">
        <p className="text-lg md:text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1 line-clamp-2">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground/70 mt-0.5 hidden sm:block">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
