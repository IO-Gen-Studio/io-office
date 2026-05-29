import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";
export const Route = createFileRoute("/_authenticated/outreach")({
  component: () => <PagePlaceholder title="Email Outreach" description="Campaigns, contacts, templates and Gmail sending." />,
});
