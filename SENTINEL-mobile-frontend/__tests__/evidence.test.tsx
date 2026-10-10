import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { expect, it } from "@jest/globals";
import { createFixtureRepository } from "@sentinel/core";
import App from "../App";
import { createReviewStore } from "../src/state/review-store";
import { MemoryReviewStorage, deferred } from "./helpers/review-storage";

function deps() {
  const repository = createFixtureRepository();
  const storage = new MemoryReviewStorage();
  return {
    repository,
    storage,
    reviewStore: createReviewStore(storage, repository.namespace),
  };
}
async function openFinding(id = "AN014") {
  await fireEvent.changeText(screen.getByLabelText("Search findings"), id);
  await fireEvent.press(
    screen.getAllByRole("button", { name: /^Inspect (?!completed)/ })[0],
  );
}

it("persists review through restart and undo while retaining severity and total findings", async () => {
  const state = deps();
  const first = await render(<App {...state} />);
  await openFinding();
  await fireEvent.press(screen.getByRole("button", { name: "Mark reviewed" }));
  expect(await state.reviewStore.load()).toHaveLength(1);
  await first.unmount();
  await render(
    <App
      repository={state.repository}
      reviewStore={createReviewStore(state.storage, state.repository.namespace)}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Attention tab, 14 to review" }),
  ).toBeTruthy();
  expect(screen.getByLabelText("40 total findings")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Reviewed" }));
  await openFinding();
  expect(screen.getByLabelText("Finding severity: Critical")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Undo review" }));
  expect(await state.reviewStore.load()).toEqual([]);
  expect(
    screen.getByRole("button", { name: "Attention tab, 15 to review" }),
  ).toBeTruthy();
});

it("keeps an unsuccessful save pending and retries the same finding", async () => {
  const state = deps();
  await render(<App {...state} />);
  await openFinding();
  state.storage.writeError = new Error("disk unavailable");
  await fireEvent.press(screen.getByRole("button", { name: "Mark reviewed" }));
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(await state.reviewStore.load()).toEqual([]);
  state.storage.writeError = null;
  await fireEvent.press(screen.getByRole("button", { name: "Retry save" }));
  expect(await state.reviewStore.load()).toEqual([
    expect.objectContaining({ findingId: "AN014" }),
  ]);
  expect(
    screen.getByRole("button", { name: "Attention tab, 14 to review" }),
  ).toBeTruthy();
});

it("disables repeated taps while saving and waits for persistence before closing", async () => {
  const state = deps();
  await render(<App {...state} />);
  await openFinding();
  const write = deferred<void>();
  state.storage.beforeWrite = () => write.promise;
  await fireEvent.press(screen.getByRole("button", { name: "Mark reviewed" }));
  expect(
    screen.getByRole("button", { name: "Saving…" }).props.accessibilityState
      .disabled,
  ).toBe(true);
  await fireEvent.press(screen.getByRole("button", { name: "Saving…" }));
  await act(async () => {
    write.resolve();
    await write.promise;
  });
  expect(await state.reviewStore.load()).toHaveLength(1);
});

it("renders missing evidence without substituting an unrelated capture", async () => {
  const state = deps();
  const data = await state.repository.load();
  const repository = {
    ...state.repository,
    load: async () => ({
      ...data,
      actions: [],
      readings: [],
      assets: [],
      locations: [],
    }),
  };
  await render(<App repository={repository} reviewStore={state.reviewStore} />);
  await openFinding();
  expect(screen.getByText("No action recorded.")).toBeTruthy();
  expect(screen.getByText("No reading recorded.")).toBeTruthy();
  expect(screen.queryByLabelText("Illustrative inspection sample")).toBeNull();
  expect(screen.getByRole("button", { name: "Mark reviewed" })).toBeTruthy();
});

it("closes evidence removed by refresh while preserving the search", async () => {
  const state = deps();
  let data = await state.repository.load();
  const repository = { ...state.repository, load: async () => data };
  await render(<App repository={repository} reviewStore={state.reviewStore} />);
  await openFinding();
  data = {
    ...data,
    findings: data.findings.filter((f) => f.anomaly_id !== "AN014"),
  };
  const content = screen.getByLabelText("attention content", {
    includeHiddenElements: true,
  });
  await act(async () => {
    await content.props.refreshControl.props.onRefresh();
  });
  expect(screen.queryByRole("button", { name: "Mark reviewed" })).toBeNull();
  expect(screen.getByLabelText("Search findings").props.value).toBe("AN014");
  expect(screen.getByText("No matching findings")).toBeTruthy();
});

it("does not close a newly opened finding when an earlier save finishes", async () => {
  const state = deps();
  await render(<App {...state} />);
  await openFinding();
  const write = deferred<void>();
  state.storage.beforeWrite = () => write.promise;
  await fireEvent.press(screen.getByRole("button", { name: "Mark reviewed" }));
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  await openFinding("AN005");
  await act(async () => {
    write.resolve();
    await write.promise;
  });
  expect(
    screen.getByRole("header", { name: "Abnormal vibration" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Mark reviewed" })).toBeTruthy();
});

it("reloads unreadable saved reviews before permitting acknowledgment", async () => {
  const state = deps();
  state.storage.readError = new Error("Storage unavailable");
  await render(<App {...state} />);
  await openFinding();
  expect(screen.queryByRole("button", { name: "Mark reviewed" })).toBeNull();
  state.storage.readError = null;
  await fireEvent.press(
    screen.getByRole("button", { name: "Reload saved reviews" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Mark reviewed" }));
  expect(await state.reviewStore.load()).toHaveLength(1);
});
