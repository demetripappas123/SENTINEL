import { API_URL } from "./helpers/api-env";
import { render, screen } from "@testing-library/react-native";
import { beforeEach, expect, it, jest } from "@jest/globals";
import challenge from "../../packages/core/src/data/challenge.json";
import App from "../App";

let fetchMock: jest.Mock<typeof fetch>;

beforeEach(() => {
  fetchMock = jest.fn<typeof fetch>();
  global.fetch = fetchMock;
});

it("loads inspection data from the configured API", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => challenge,
  } as Response);
  await render(<App />);
  expect(
    await screen.findByRole("button", { name: "Attention tab, 15 to review" }),
  ).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledWith(
    API_URL + "/dataset?source=kit",
    expect.anything(),
  );
});

it("shows the load error instead of bundled data when the API is down", async () => {
  fetchMock.mockRejectedValue(new TypeError("Network request failed"));
  await render(<App />);
  expect(
    await screen.findByText("Could not load inspection data. Try again."),
  ).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledWith(
    API_URL + "/dataset?source=kit",
    expect.anything(),
  );
  expect(
    screen.queryByRole("button", { name: "Attention tab, 15 to review" }),
  ).toBeNull();
});
