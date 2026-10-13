import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center text-center py-16 px-4", className)}
    >
      {Icon && (
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && (
        <Button onClick={action.onClick} className="mt-4" size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}
