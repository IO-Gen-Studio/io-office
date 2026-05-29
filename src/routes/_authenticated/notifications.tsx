import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";
export const Route = createFileRoute("/_authenticated/notifications")({
  component: () => <PagePlaceholder title="Notifications" description="In-app notifications and email alerts." />,
});
