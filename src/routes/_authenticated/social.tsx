import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";
export const Route = createFileRoute("/_authenticated/social")({
  component: () => <PagePlaceholder title="Social Planner" description="Plan, draft and schedule social posts." />,
});
