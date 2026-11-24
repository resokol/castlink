import next from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import parser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser },
    plugins: { "@next/next": next, "react-hooks": reactHooks },
    rules: { ...next.configs.recommended.rules, "react-hooks/exhaustive-deps": "warn" },
  },
];
