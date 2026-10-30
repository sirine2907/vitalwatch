import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const restrict = (files, group, message) => ({
  files,
  rules: {
    "no-restricted-imports": ["error", { patterns: [{ group, message }] }],
  },
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  restrict(
    ["src/domain/**"],
    ["@/app/**", "@/components/**", "@/services/**", "@/data/**", "@/integrations/**", "@/lib/env"],
    "Domain code is pure logic and can't depend on other layers.",
  ),
  restrict(
    ["src/components/**"],
    ["@/data/**", "@/integrations/**", "@/services/**"],
    "UI components can't reach data or integrations directly.",
  ),
  restrict(
    ["src/services/**"],
    ["@/app/**", "@/components/**"],
    "Services can't depend on the UI.",
  ),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
