const expoPreset = require("jest-expo/jest-preset");
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Lucide's native entry uses .mjs; apply Expo's same Babel transform.
  transform: {
    ...expoPreset.transform,
    "\\.mjs$": expoPreset.transform["\\.[jt]sx?$"],
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native(?:-.*)?|@react-native(-community)?|expo(?:-.*)?|@expo(?:nent)?/.*|@sentinel/.*|@gorhom/.*|lucide-react-native)/)",
  ],
};
