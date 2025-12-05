import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".next/**",
      ".turbo/**",
      "coverage/**",
      "cdk.out/**"
    ]
  },
  {
    files: ["**/*.{js,jsx,cjs,mjs}"],
    ...js.configs.recommended
  },
  ...tseslint.configs.recommended,
  prettierConfig
);