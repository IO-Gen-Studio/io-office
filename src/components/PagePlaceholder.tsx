import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>
      <Card className="shadow-soft">
        <CardHeader><CardTitle>Coming up next</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This module is scaffolded and will be built out in the next iteration.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
