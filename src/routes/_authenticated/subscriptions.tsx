import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";
export const Route = createFileRoute("/_authenticated/subscriptions")({
  component: () => <PagePlaceholder title="Subscriptions" description="Recurring services and renewals." />,
});
