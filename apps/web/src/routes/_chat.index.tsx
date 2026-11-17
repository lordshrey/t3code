import { createFileRoute } from "@tanstack/react-router";
import { CompanyDashboard } from "../components/company-os/CompanyDashboard";
import { NoProjectsHero } from "../components/NoProjectsHero";
import { HostedEmptyState } from "../components/HostedEmptyState";
import { useAllEnvironmentShellsBootstrapped, useProjects } from "../state/entities";
import { useEnvironments } from "../state/environments";

function ChatIndexRouteView() {
  const { authGateState } = Route.useRouteContext();
  const search = Route.useSearch();
  const { environments, isReady } = useEnvironments();
  const projects = useProjects();
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  if (authGateState.status === "hosted-static") {
    if (!isReady) return null;
    if (environments.length === 0) return <HostedEmptyState />;
  }
  if (!projects.some((project) => project.archivedAt == null && !project.isScratch))
    return bootstrapped ? <NoProjectsHero /> : null;
  return <CompanyDashboard product={search.product} page={search.page} />;
}

export const Route = createFileRoute("/_chat/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { product?: string | undefined; page?: string | undefined } => ({
    product: typeof search.product === "string" ? search.product : undefined,
    page: typeof search.page === "string" ? search.page : undefined,
  }),
  component: ChatIndexRouteView,
});
