import { FlatCompat } from "@eslint/eslintrc";

/** @type {import("eslint").Linter.FlatConfig} */
export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly"
      }
    },
    rules: {
      // Add or override rules as needed
    }
  }
]; 