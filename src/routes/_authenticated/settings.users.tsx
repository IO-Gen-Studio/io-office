import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";
export const Route = createFileRoute("/_authenticated/settings/users")({
  component: () => <PagePlaceholder title="Users & Access" description="Create users, set job titles, generate passwords, and control module access." />,
});
