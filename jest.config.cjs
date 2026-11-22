module.exports = {
  projects: [
    {
      displayName: "unit",
      rootDir: __dirname,
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/unit/**/*.test.js"],
    },
    {
      displayName: "integration",
      rootDir: __dirname,
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/integration/**/*.test.js"],
      testTimeout: 10000,
    },
  ],
};
