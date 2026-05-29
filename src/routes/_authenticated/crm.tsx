import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";
export const Route = createFileRoute("/_authenticated/crm")({
  component: () => <PagePlaceholder title="CRM" description="Contacts, organisations, and relationships." />,
});
