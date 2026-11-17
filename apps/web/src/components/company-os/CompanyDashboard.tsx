import { scopedProjectKey, scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import * as Schema from "effect/Schema";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { companyTaskStage } from "./CompanyDashboard.logic";
import { useNewThreadHandler } from "../../hooks/useHandleNewThread";
import { useProjects, useVisibleThreadShells } from "../../state/entities";
import { workspaceAreaProps } from "../../lib/workspaceFocus";
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SidebarInset } from "../ui/sidebar";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { isElectron } from "../../env";
import { CompanyTaskBoard, companyTaskStages } from "./CompanyTaskBoard";

const productSelectionSchema = Schema.NullOr(Schema.String);

const pages = [
  ["home", "Home"],
  ["messages", "Message Board"],
  ["references", "Design References"],
  ["tasks", "Task board"],
  ["assets", "Project Assets & Proofs"],
  ["milestones", "Deadlines & Milestones"],
  ["workflow", "Workflow"],
  ["chat", "Chat"],
  ["checkins", "Automatic Check-ins"],
  ["activity", "Latest Activity"],
] as const;
const stages = companyTaskStages.map(({ id, title, color }) => [id, title, color] as const);

function TaskLink({ thread, children }: { thread: EnvironmentThreadShell; children?: ReactNode }) {
  return (
    <Link
      to="/$environmentId/$threadId"
      params={{ environmentId: thread.environmentId, threadId: thread.id }}
      className="block rounded-md px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
    >
      {children ?? (
        <>
          <strong className="block truncate text-sm font-semibold text-foreground">
            {thread.title}
          </strong>
          <span className="mt-1 block truncate text-2xs text-muted-foreground">
            {thread.source.latestVisibleMessage?.text || thread.branch || thread.providerInstanceId}
          </span>
        </>
      )}
    </Link>
  );
}
function EmptyCard({ children }: { children: ReactNode }) {
  return <p className="p-3 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function Calendar() {
  const [now] = useState(() => new Date());
  const first = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const length = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return (
    <div className="p-3">
      <h3 className="mb-3 text-center text-xs font-semibold">
        {now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
      </h3>
      <div className="grid grid-cols-7 gap-y-2 text-center text-3xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day} className="text-muted-foreground">
            {day}
          </span>
        ))}
        {Array.from({ length: first }, (_, index) => (
          <span key={"blank" + index} />
        ))}
        {Array.from({ length }, (_, index) => (
          <span
            key={index}
            className={
              index + 1 === now.getDate()
                ? "rounded bg-primary py-0.5 text-white"
                : "py-0.5 text-secondary-label"
            }
          >
            {index + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CompanyDashboard({
  product,
  page = "home",
}: {
  product?: string | undefined;
  page?: string | undefined;
}) {
  const projects = useProjects().filter(
    (project) => project.archivedAt == null && !project.isScratch,
  );
  const allThreads = useVisibleThreadShells();
  const [lastProduct, setLastProduct] = useLocalStorage<string | null, string | null>(
    "company-os:dashboard-product",
    null,
    productSelectionSchema,
  );
  const current =
    projects.find(
      (project) =>
        scopedProjectKey(scopeProjectRef(project.environmentId, project.id)) ===
        (product ?? lastProduct),
    ) ?? projects[0];
  const navigate = useNavigate();
  const newThread = useNewThreadHandler();
  const [error, setError] = useState<string | null>(null);
  if (!current) return null;
  const key = scopedProjectKey(scopeProjectRef(current.environmentId, current.id));
  const threads = allThreads
    .filter(
      (thread) =>
        thread.projectId === current.id &&
        thread.environmentId === current.environmentId &&
        thread.deletedAt === null &&
        thread.archivedAt === null &&
        thread.lineage.relationshipToParent !== "subagent",
    )
    .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const requests = threads.filter((thread) => companyTaskStage(thread) === "attention");
  const messages = threads.filter((thread) => thread.visibleItemCount > 0);
  const checkins = messages.filter((thread) => thread.latestRun?.status === "completed");
  const proofs = threads.flatMap((thread) => thread.pullRequests.map((pr) => ({ thread, pr })));
  const branches = threads.filter((thread) => thread.branch || thread.worktreePath);
  const selectedPage =
    page === "workflow" ? "tasks" : (pages.find(([id]) => id === page)?.[0] ?? "home");
  const items = projects.map((project) => ({
    value: scopedProjectKey(scopeProjectRef(project.environmentId, project.id)),
    label: project.title,
  }));
  const changePage = (next: string) => {
    void navigate({ to: "/", search: { product: key, page: next } });
  };
  const createTask = async () => {
    setError(null);
    await newThread(scopeProjectRef(current.environmentId, current.id)).catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : "Could not open a new task."),
    );
  };
  const content = (section: string) => {
    switch (section) {
      case "messages":
        return messages.length ? (
          messages.slice(0, 6).map((thread) => <TaskLink key={thread.id} thread={thread} />)
        ) : (
          <EmptyCard>Project conversations appear here as you work with agents.</EmptyCard>
        );
      case "references":
        return <EmptyCard>Design references can be attached to a task conversation.</EmptyCard>;
      case "tasks":
        return threads.length ? (
          threads.slice(0, 8).map((thread) => (
            <TaskLink key={thread.id} thread={thread}>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {companyTaskStage(thread) === "done" ? "☑" : "☐"}
                </span>
                <strong className="truncate text-xs font-medium">{thread.title}</strong>
              </span>
              <small className="ml-5 mt-1 block text-3xs text-muted-foreground">
                {stages.find(([id]) => id === companyTaskStage(thread))?.[1]}
              </small>
            </TaskLink>
          ))
        ) : (
          <EmptyCard>Create a task to start working with Claude Code or Codex.</EmptyCard>
        );
      case "assets":
        return (
          <>
            {proofs.map(({ thread, pr }) => (
              <a
                key={pr.url}
                className="block px-3 py-2 text-xs text-primary hover:underline"
                href={pr.url}
                target="_blank"
                rel="noreferrer"
              >
                {thread.title} ↗
              </a>
            ))}
            {branches.map((thread) => (
              <TaskLink key={thread.id} thread={thread}>
                <strong className="block truncate text-xs">{thread.branch}</strong>
                <small className="mt-1 block truncate text-3xs text-muted-foreground">
                  {thread.worktreePath || current.workspaceRoot}
                </small>
              </TaskLink>
            ))}
            {!proofs.length && !branches.length ? (
              <EmptyCard>Branches, worktrees, and linked pull requests appear here.</EmptyCard>
            ) : null}
          </>
        );
      case "milestones":
        return <Calendar />;
      case "workflow":
        return (
          <div className="space-y-1 px-1">
            {companyTaskStages.map(({ id, title, icon: Icon, color }) => (
              <Link
                key={id}
                to="/"
                search={{ product: key, page: "tasks" }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs hover:bg-accent"
              >
                <Icon className={"size-3.5 " + color} />
                <span>{title}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {threads.filter((thread) => companyTaskStage(thread) === id).length}
                </span>
              </Link>
            ))}
          </div>
        );
      case "chat":
        return requests.length ? (
          requests.map((thread) => (
            <TaskLink key={thread.id} thread={thread}>
              <strong className="text-xs text-warning">{thread.title}</strong>
              <p className="mt-1 text-2xs text-secondary-label">
                {thread.hasPendingApprovals
                  ? "Waiting for your approval"
                  : thread.hasPendingUserInput
                    ? "Waiting for your answer"
                    : thread.source.lastError || "Needs attention"}
              </p>
            </TaskLink>
          ))
        ) : (
          <EmptyCard>Open a task to discuss its work with an agent.</EmptyCard>
        );
      case "checkins":
        return checkins.length ? (
          checkins.slice(0, 4).map((thread) => (
            <TaskLink key={thread.id} thread={thread}>
              <strong className="block truncate text-xs">{thread.title}</strong>
              <p className="mt-1 line-clamp-3 text-2xs leading-relaxed text-secondary-label">
                {thread.source.latestVisibleMessage?.text ||
                  (thread.latestRun?.completedAt
                    ? "Finished " + new Date(thread.latestRun.completedAt).toLocaleString()
                    : "Agent turn completed")}
              </p>
            </TaskLink>
          ))
        ) : (
          <EmptyCard>Agents’ latest updates will appear here.</EmptyCard>
        );
      case "activity":
        return threads.length ? (
          threads.slice(0, 8).map((thread) => (
            <TaskLink key={thread.id} thread={thread}>
              <time className="text-3xs text-muted-foreground">
                {new Date(thread.updatedAt).toLocaleString()}
              </time>
              <strong className="mt-1 block truncate text-xs text-primary">{thread.title}</strong>
            </TaskLink>
          ))
        ) : (
          <EmptyCard>No task activity yet.</EmptyCard>
        );
      default:
        return null;
    }
  };
  return (
    <SidebarInset
      {...workspaceAreaProps("home", 1, "Company OS")}
      role="main"
      className="h-dvh min-h-0 overflow-auto"
    >
      <div className="min-h-full bg-background text-foreground">
        <WorkspacePageHeader
          electron={isElectron}
          className="justify-between gap-4 border-b border-border"
        >
          <div className="flex items-end gap-2 sm:gap-3">
            <div className="w-28 sm:w-44">
              <label
                htmlFor="company-product"
                className="mb-1 block text-3xs font-semibold text-muted-foreground"
              >
                Product
              </label>
              <Select
                items={items}
                value={key}
                onValueChange={(value) => {
                  if (value) {
                    setLastProduct(value);
                    void navigate({ to: "/", search: { product: value, page: selectedPage } });
                  }
                }}
              >
                <SelectTrigger id="company-product" size="sm" className="min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            <div className="w-24 sm:w-44">
              <label
                htmlFor="company-page"
                className="mb-1 block text-3xs font-semibold text-muted-foreground"
              >
                Pages
              </label>
              <Select
                items={pages
                  .filter(([value]) => value !== "workflow")
                  .map(([value, label]) => ({ value, label }))}
                value={selectedPage}
                onValueChange={(value) => {
                  if (value) changePage(value);
                }}
              >
                <SelectTrigger id="company-page" size="sm" className="min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {pages
                    .filter(([value]) => value !== "workflow")
                    .map(([value, title]) => (
                      <SelectItem key={value} value={value}>
                        {title}
                      </SelectItem>
                    ))}
                </SelectPopup>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" aria-label="New task" onClick={() => void createTask()}>
              <PlusIcon />
              <span className="hidden sm:inline">New task</span>
            </Button>
          </div>
        </WorkspacePageHeader>
        <div className="px-5 pt-6 pb-8 lg:px-7">
          <header className="mb-6">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight">
              {selectedPage === "home"
                ? current.title
                : pages.find(([id]) => id === selectedPage)?.[1]}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {selectedPage === "home" ? (
                <>
                  <span>
                    {threads.filter((thread) => companyTaskStage(thread) === "running").length}{" "}
                    running
                  </span>
                  <span>·</span>
                  <Link
                    to="/"
                    search={{ product: key, page: "activity" }}
                    className="text-primary hover:underline"
                  >
                    View activity
                  </Link>
                </>
              ) : (
                <Link
                  to="/"
                  search={{ product: key, page: "home" }}
                  className="text-primary hover:underline"
                >
                  ‹ {current.title} home
                </Link>
              )}
            </div>
          </header>
          {error ? (
            <p role="alert" className="mb-4 text-sm text-warning">
              {error}
            </p>
          ) : null}
          {selectedPage === "home" ? (
            <div className="grid grid-cols-1 gap-3 min-[650px]:grid-cols-2 min-[1050px]:grid-cols-3 min-[1400px]:grid-cols-4">
              {pages
                .filter(([id]) => id !== "home")
                .map(([section, title]) => (
                  <section
                    key={section}
                    className="flex min-w-0 flex-col rounded-lg border border-border bg-card"
                  >
                    <Link
                      to="/"
                      search={{ product: key, page: section }}
                      className="px-4 pt-4 pb-2 text-sm font-medium text-foreground hover:text-primary"
                    >
                      {title}
                    </Link>
                    <div className="h-48 min-w-0 overflow-auto px-1 pb-2">{content(section)}</div>
                  </section>
                ))}
            </div>
          ) : selectedPage === "tasks" ? (
            <CompanyTaskBoard threads={threads} />
          ) : (
            <section className="min-h-80 overflow-auto rounded-lg border border-border bg-card">
              {content(selectedPage)}
            </section>
          )}
        </div>
      </div>
    </SidebarInset>
  );
}
