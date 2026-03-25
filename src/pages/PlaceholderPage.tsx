interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-heading font-bold text-foreground">{title}</h1>
      <p className="text-muted-foreground font-body">
        {description || `Modul "${title}" wird in einem späteren Schritt implementiert.`}
      </p>
      <div className="h-64 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
        <span className="text-muted-foreground text-sm">Inhalt folgt</span>
      </div>
    </div>
  );
}
