import { expect, it } from "vite-plus/test";
import { companyTaskStage } from "./CompanyDashboard.logic";

it.each([
  [null, "backlog"],
  ["queued", "backlog"],
  ["preparing", "running"],
  ["starting", "running"],
  ["running", "running"],
  ["waiting", "running"],
  ["completed", "review"],
  ["failed", "attention"],
  ["cancelled", "attention"],
  ["interrupted", "attention"],
  ["rolled_back", "attention"],
] as const)("maps %s to the right dashboard stage", (status, expected) => {
  expect(
    companyTaskStage({
      hasPendingApprovals: false,
      hasPendingUserInput: false,
      settledAt: null,
      latestRun: status === null ? null : { status },
    }),
  ).toBe(expected);
});

it("keeps an approval visible until the founder responds", () => {
  const thread: Parameters<typeof companyTaskStage>[0] = {
    hasPendingApprovals: true,
    hasPendingUserInput: false,
    settledAt: null,
    latestRun: { status: "waiting" },
  };
  expect(companyTaskStage(thread)).toBe("attention");
  expect(
    companyTaskStage({ ...thread, hasPendingApprovals: false, hasPendingUserInput: true }),
  ).toBe("attention");
});

it("uses settlement to mark completed work done", () => {
  expect(
    companyTaskStage({
      hasPendingApprovals: false,
      hasPendingUserInput: false,
      settledAt: "2026-11-17T00:00:00Z",
      latestRun: { status: "completed" },
    }),
  ).toBe("done");
});
