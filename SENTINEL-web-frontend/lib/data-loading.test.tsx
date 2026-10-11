import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { dataset, emptyDataset } from "@sentinel/core";
import { InspectionDataProvider } from "./inspection-data";
import { QueueProvider } from "./queue-data";
import { AppShell } from "../components/app-shell";
import { Overview } from "../features/overview";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
afterEach(() => vi.unstubAllGlobals());

function renderApp() {
  return render(
    <InspectionDataProvider>
      <QueueProvider>
        <AppShell>
          <Overview />
        </AppShell>
      </QueueProvider>
    </InspectionDataProvider>,
  );
}

it("waits for both requests before showing metrics or empty queue claims", async () => {
  let resolveData!: (value: Response) => void;
  let resolveQueue!: (value: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url) =>
        new Promise<Response>((resolve) => {
          if (url === "/api/dataset") resolveData = resolve;
          else if (url === "/api/queue") resolveQueue = resolve;
          else throw new Error("Unexpected URL");
        }),
    ),
  );
  renderApp();
  expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  expect(
    screen.queryByLabelText("Operational metrics"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /^Missions/ })).not.toHaveTextContent(
    "0",
  );
  await act(async () => resolveData(Response.json(dataset)));
  expect(screen.queryByText("Queue is clear.")).not.toBeInTheDocument();
  await act(async () => resolveQueue(Response.json([])));
  expect(
    await screen.findByLabelText("Operational metrics"),
  ).toBeInTheDocument();
});

it.each(["/api/dataset", "/api/queue"])(
  "shows a recoverable error when %s fails",
  async (failedUrl) => {
    let failing = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) =>
        failing && url === failedUrl
          ? Response.json({ error: "unavailable" }, { status: 503 })
          : Response.json(url === "/api/dataset" ? dataset : []),
      ),
    );
    renderApp();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn.t load/i,
    );
    expect(screen.queryByText("Queue is clear.")).not.toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByLabelText("Operational metrics"),
    ).toBeInTheDocument();
  },
);

it("rejects a malformed dataset rather than crashing the dashboard", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      Response.json(url === "/api/dataset" ? { missions: [] } : []),
    ),
  );
  renderApp();
  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t load/i);
});

it("distinguishes a successfully fetched empty dataset from a loading state", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      Response.json(url === "/api/dataset" ? emptyDataset : []),
    ),
  );
  renderApp();
  expect(await screen.findByText("No inspection data yet")).toBeInTheDocument();
  expect(
    screen.queryByLabelText("Operational metrics"),
  ).not.toBeInTheDocument();
});

it("opens and closes the side chat without pretending it can respond", async () => {
  localStorage.removeItem("sentinel:chat-open");
  render(
    <InspectionDataProvider initial={dataset}>
      <QueueProvider initial={[]}>
        <AppShell>
          <Overview />
        </AppShell>
      </QueueProvider>
    </InspectionDataProvider>,
  );
  expect(screen.queryByRole("complementary", { name: "Chat" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "AI assistant" }));
  const chat = screen.getByRole("complementary", { name: "Chat" });
  expect(within(chat).getByText("Ask about an inspection or a review priority.")).toBeInTheDocument();
  expect(screen.getByRole("main")).toBeInTheDocument();
  await userEvent.click(within(chat).getByRole("button", { name: "Close chat" }));
  expect(screen.queryByRole("complementary", { name: "Chat" })).not.toBeInTheDocument();
});

it("sends a chat message through the assistant route", async () => {
  localStorage.removeItem("sentinel:chat-open");
  sessionStorage.removeItem("sentinel:chat-session");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/agent/chat") {
        const body = JSON.parse(String(init?.body));
        expect(body.message).toBe("Which pump is failing?");
        expect(body.session_id).toMatch(/^[A-Za-z0-9-]{8,}$/);
        return Response.json({ session_id: body.session_id, reply: "Pump 1 is on the queue." });
      }
      return Response.json(url === "/api/dataset" ? dataset : []);
    }),
  );
  render(
    <InspectionDataProvider initial={dataset}>
      <QueueProvider initial={[]}>
        <AppShell>
          <Overview />
        </AppShell>
      </QueueProvider>
    </InspectionDataProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "AI assistant" }));
  const chat = screen.getByRole("complementary", { name: "Chat" });
  await userEvent.type(within(chat).getByLabelText("Message"), "Which pump is failing?");
  await userEvent.click(within(chat).getByRole("button", { name: "Send message" }));
  expect(await within(chat).findByText("Pump 1 is on the queue.")).toBeInTheDocument();
});

it("picks up new results in the background without returning to loading", async () => {
  let current = emptyDataset;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => Response.json(url === "/api/dataset" ? current : [])),
  );
  renderApp();
  expect(await screen.findByText("No inspection data yet")).toBeInTheDocument();
  current = dataset;
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(
    await screen.findByLabelText("Operational metrics"),
  ).toBeInTheDocument();
  expect(screen.queryByRole("status", { name: /loading/i })).toBeNull();
});
