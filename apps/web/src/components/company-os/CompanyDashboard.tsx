import { scopedProjectKey, scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import * as Schema from "effect/Schema";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { companyTaskStage } from "./CompanyDashboard.logic";
import { openCommandPalette } from "../../commandPaletteBus";
import { useNewThreadHandler } from "../../hooks/useHandleNewThread";
import { useProjects, useVisibleThreadShells } from "../../state/entities";
import { workspaceAreaProps } from "../../lib/workspaceFocus";
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SidebarInset } from "../ui/sidebar";

const productSelectionSchema = Schema.NullOr(Schema.String);

const pages = [
  ["home", "Home"],
  ["messages", "Message Board"],
  ["references", "Design References"],
  ["tasks", "Project Tasks"],
  ["assets", "Project Assets & Proofs"],
  ["milestones", "Deadlines & Milestones"],
  ["workflow", "Workflow"],
  ["chat", "Chat"],
  ["checkins", "Automatic Check-ins"],
  ["activity", "Latest Activity"],
] as const;
const stages = [
  ["backlog", "Backlog", "bg-company-backlog"],
  ["running", "In progress", "bg-company-running"],
  ["attention", "Needs attention", "bg-company-attention"],
  ["review", "Review", "bg-company-review"],
  ["done", "Done", "bg-company-done"],
] as const;

function TaskLink({ thread, children }: { thread: EnvironmentThreadShell; children?: ReactNode }) {
  return (
    <Link
      to="/$environmentId/$threadId"
      params={{ environmentId: thread.environmentId, threadId: thread.id }}
      className="block rounded-md px-3 py-2 text-left transition-colors hover:bg-company-hover focus-visible:outline-2 focus-visible:outline-company-link"
    >
      {children ?? (
        <>
          <strong className="block truncate text-sm font-semibold text-company-text">
            {thread.title}
          </strong>
          <span className="mt-1 block truncate text-2xs text-company-muted">
            {thread.source.latestVisibleMessage?.text || thread.branch || thread.providerInstanceId}
          </span>
        </>
      )}
    </Link>
  );
}
function EmptyCard({ children }: { children: ReactNode }) {
  return <p className="p-3 text-sm leading-relaxed text-company-muted">{children}</p>;
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
          <span key={day} className="text-company-muted">
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
                ? "rounded bg-company-selected py-0.5 text-white"
                : "py-0.5 text-company-soft"
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
  const selectedPage = pages.find(([id]) => id === page)?.[0] ?? "home";
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
          threads.slice(0, selectedPage === "home" ? 8 : undefined).map((thread) => (
            <TaskLink key={thread.id} thread={thread}>
              <span className="flex items-center gap-2">
                <span className="text-company-muted">
                  {companyTaskStage(thread) === "done" ? "☑" : "☐"}
                </span>
                <strong className="truncate text-xs font-medium">{thread.title}</strong>
              </span>
              <small className="ml-5 mt-1 block text-3xs text-company-muted">
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
                className="block px-3 py-2 text-xs text-company-link hover:underline"
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
                <small className="mt-1 block truncate text-3xs text-company-muted">
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
          <div className="flex h-full min-h-48 gap-1 p-3">
            {stages.map(([stage, title, color]) => {
              const matching = threads.filter((thread) => companyTaskStage(thread) === stage);
              return (
                <Link
                  key={stage}
                  to="/"
                  search={{ product: key, page: "tasks" }}
                  className="flex min-w-0 flex-1 flex-col rounded bg-company-lane text-center hover:bg-company-lane-hover"
                >
                  <span className={"h-1 w-full rounded-t " + color} />
                  <small className="mt-2 text-3xs text-company-muted">{matching.length}</small>
                  <strong className="mx-auto mt-2 text-3xs font-medium tracking-wider uppercase [writing-mode:vertical-rl]">
                    {title}
                  </strong>
                </Link>
              );
            })}
          </div>
        );
      case "chat":
        return requests.length ? (
          requests.map((thread) => (
            <TaskLink key={thread.id} thread={thread}>
              <strong className="text-xs text-company-warning">{thread.title}</strong>
              <p className="mt-1 text-2xs text-company-soft">
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
              <p className="mt-1 line-clamp-3 text-2xs leading-relaxed text-company-soft">
                {thread.source.latestVisibleMessage?.text}
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
              <time className="text-3xs text-company-muted">
                {new Date(thread.updatedAt).toLocaleString()}
              </time>
              <strong className="mt-1 block truncate text-xs text-company-link">
                {thread.title}
              </strong>
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
      <div className="min-h-full bg-company-page text-company-text">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-company-divider px-5 py-3 lg:px-9">
          <div className="flex items-end gap-3">
            <div className="w-44">
              <label
                htmlFor="company-product"
                className="mb-1 block text-3xs font-semibold text-company-muted"
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
                <SelectTrigger id="company-product" size="sm">
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
            <div className="w-48">
              <label
                htmlFor="company-page"
                className="mb-1 block text-3xs font-semibold text-company-muted"
              >
                Pages
              </label>
              <Select
                items={pages.map(([value, label]) => ({ value, label }))}
                value={selectedPage}
                onValueChange={(value) => {
                  if (value) changePage(value);
                }}
              >
                <SelectTrigger id="company-page" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {pages.map(([value, title]) => (
                    <SelectItem key={value} value={value}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openCommandPalette({ open: "add-project" })}
            >
              Add project
            </Button>
            <Button size="sm" onClick={() => void createTask()}>
              + New task
            </Button>
          </div>
        </header>
        <div className="px-5 pt-7 pb-12 lg:px-9">
          <header className="mb-6">
            <h1 className="text-4xl leading-tight font-bold tracking-company-title">
              {selectedPage === "home"
                ? current.title
                : pages.find(([id]) => id === selectedPage)?.[1]}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-xs text-company-muted">
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
                    className="text-company-link hover:underline"
                  >
                    View activity
                  </Link>
                </>
              ) : (
                <Link
                  to="/"
                  search={{ product: key, page: "home" }}
                  className="text-company-link hover:underline"
                >
                  ‹ {current.title} home
                </Link>
              )}
            </div>
          </header>
          {error ? (
            <p role="alert" className="mb-4 text-sm text-company-warning">
              {error}
            </p>
          ) : null}
          {selectedPage === "home" ? (
            <div className="grid grid-cols-1 gap-3 min-[650px]:grid-cols-2 min-[1050px]:grid-cols-3 min-[1400px]:grid-cols-4">
              {pages
                .filter(([id]) => id !== "home")
                .map(([section, title]) => (
                  <section key={section} className="flex min-w-0 flex-col">
                    <Link
                      to="/"
                      search={{ product: key, page: section }}
                      className="mb-1.5 text-base font-semibold text-company-heading hover:underline"
                    >
                      {title}
                    </Link>
                    <div className="h-[clamp(216px,24dvh,290px)] min-w-0 overflow-auto rounded-lg border border-company-border bg-company-card">
                      {content(section)}
                    </div>
                  </section>
                ))}
            </div>
          ) : (
            <section className="min-h-80 overflow-auto rounded-lg border border-company-border bg-company-card">
              {content(selectedPage)}
            </section>
          )}
        </div>
      </div>
    </SidebarInset>
  );
}
