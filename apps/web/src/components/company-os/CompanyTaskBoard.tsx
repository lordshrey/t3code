import { Link } from "@tanstack/react-router";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { CircleIcon, CircleDotIcon, CircleAlertIcon, CircleCheckIcon, EyeIcon } from "lucide-react";
import { companyTaskStage } from "./CompanyDashboard.logic";

export const companyTaskStages = [
  { id: "backlog", title: "Backlog", icon: CircleIcon, color: "text-muted-foreground" },
  { id: "running", title: "In progress", icon: CircleDotIcon, color: "text-info" },
  { id: "attention", title: "Needs attention", icon: CircleAlertIcon, color: "text-warning" },
  { id: "review", title: "Review", icon: EyeIcon, color: "text-primary" },
  { id: "done", title: "Done", icon: CircleCheckIcon, color: "text-success" },
] as const;

export function CompanyTaskBoard({ threads }: { threads: ReadonlyArray<EnvironmentThreadShell> }) {
  return (
    <section
      aria-label="Task board"
      className="flex min-h-[calc(100dvh-12rem)] gap-3 overflow-x-auto pb-3"
    >
      {companyTaskStages.map(({ id, title, icon: Icon, color }) => {
        const tasks = threads.filter((thread) => companyTaskStage(thread) === id);
        return (
          <section
            key={id}
            aria-label={title}
            className="flex min-w-56 flex-1 flex-col rounded-lg border border-border bg-muted/20"
          >
            <header className="flex items-center gap-2 px-3 py-3">
              <Icon className={"size-3.5 shrink-0 " + color} />
              <h2 className="text-xs font-medium">{title}</h2>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {tasks.length}
              </span>
            </header>
            <div className="flex flex-col gap-2 px-2 pb-2">
              {tasks.map((thread) => (
                <Link
                  key={thread.id}
                  to="/$environmentId/$threadId"
                  params={{ environmentId: thread.environmentId, threadId: thread.id }}
                  className="rounded-lg border border-border bg-card p-3 shadow-xs transition-colors hover:border-input hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <h3 className="line-clamp-3 text-sm leading-5 font-medium">{thread.title}</h3>
                  {thread.source.latestVisibleMessage?.text ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {thread.source.latestVisibleMessage.text}
                    </p>
                  ) : null}
                  {thread.hasPendingApprovals || thread.hasPendingUserInput ? (
                    <p className="mt-2 text-xs text-warning">
                      {thread.hasPendingApprovals
                        ? "Waiting for approval"
                        : "Waiting for your answer"}
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between gap-2 text-2xs text-muted-foreground">
                    <span className="truncate">{thread.modelSelection.model}</span>
                    <time dateTime={thread.updatedAt} className="shrink-0">
                      {new Date(thread.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                  {thread.branch ? (
                    <span className="mt-2 block truncate font-mono text-3xs text-muted-foreground">
                      {thread.branch}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </section>
  );
}
