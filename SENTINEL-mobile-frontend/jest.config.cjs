module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.tsx"],
  transformIgnorePatterns: ["node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(?:-.*)?|@expo(?:nent)?/.*|react-native-safe-area-context|@sentinel/.*)/)"],
};
