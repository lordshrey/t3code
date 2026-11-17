import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

export function companyTaskStage(
  thread: Pick<
    EnvironmentThreadShell,
    "hasPendingApprovals" | "hasPendingUserInput" | "settledAt"
  > & { latestRun: Pick<NonNullable<EnvironmentThreadShell["latestRun"]>, "status"> | null },
) {
  if (
    thread.hasPendingApprovals ||
    thread.hasPendingUserInput ||
    (thread.latestRun &&
      ["failed", "cancelled", "interrupted", "rolled_back"].includes(thread.latestRun.status))
  )
    return "attention";
  if (thread.settledAt !== null) return "done";
  if (
    thread.latestRun &&
    ["preparing", "starting", "running", "waiting"].includes(thread.latestRun.status)
  )
    return "running";
  if (thread.latestRun?.status === "queued") return "backlog";
  return thread.latestRun ? "review" : "backlog";
}
