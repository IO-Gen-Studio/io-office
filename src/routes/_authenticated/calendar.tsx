import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";
export const Route = createFileRoute("/_authenticated/calendar")({
  component: () => <PagePlaceholder title="Calendar" description="Aggregated view of milestones, posts, renewals and custom events." />,
});
