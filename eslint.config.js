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
]
