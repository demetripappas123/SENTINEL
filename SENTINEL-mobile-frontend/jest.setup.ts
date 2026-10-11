import "react-native-gesture-handler/jestSetup";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AccessibilityInfo } from "react-native";
import { afterEach, beforeEach, jest } from "@jest/globals";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);
jest.mock("@gorhom/bottom-sheet", () =>
  require("./__tests__/helpers/bottom-sheet-mock.cjs"),
);
beforeEach(async () => {
  await AsyncStorage.clear();
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false);
});
afterEach(() => {
  jest.restoreAllMocks();
});
