import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";
export const Route = createFileRoute("/_authenticated/projects")({
  component: () => <PagePlaceholder title="Projects & Works" description="Project tracking with milestones and cost split." />,
});
