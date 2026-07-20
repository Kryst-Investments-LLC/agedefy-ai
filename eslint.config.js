// ESLint 9 flat config — replaces .eslintrc.json
// eslint-config-next@16 exports a ready-made flat config array; we spread it
// and append our project-level rule overrides.
const nextConfig = require("eslint-config-next")

// Borrow the already-resolved @typescript-eslint plugin from next/typescript so
// our override config object can reference its rules without a separate import.
const tsEntry = nextConfig.find((c) => c.name === "next/typescript")

module.exports = [
  // Global ignores in addition to those already in eslint-config-next
  // (.next/, out/, build/, next-env.d.ts are covered by the next config).
  { ignores: [".next-test/**", "dist/**", "coverage/**"] },

  ...nextConfig,

  {
    // Mirror the same file scope as the next/typescript config so the plugin
    // is always present when this rule is evaluated.
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tsEntry.plugins["@typescript-eslint"] },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["__tests__/**/*.ts", "tests/**/*.ts"],
    rules: {
      // Test fixtures intentionally retain named helpers/constants that make
      // scenario setup legible even when a specific case does not consume all
      // of them. Production source remains strict.
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["**/*.tsx", "hooks/**/*.ts"],
    rules: {
      // These effects initiate external synchronization (fetch/EventSource or
      // browser storage) and intentionally update loading/empty state. The rule
      // treats that standard synchronization pattern as an unconditional error.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["app/api/og/route.tsx"],
    rules: {
      // The try/catch protects ImageResponse construction in a route handler;
      // this is not a client component where a React error boundary can apply.
      "react-hooks/error-boundaries": "off",
    },
  },
]
