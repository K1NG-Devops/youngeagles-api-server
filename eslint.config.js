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
        clearInterval: "readonly",
        console: "readonly",
        global: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "destructuredArrayIgnorePattern": "^_",
        "ignoreRestSiblings": true
      }],
      "no-console": "off",
      "semi": ["error", "always"],
      "quotes": ["error", "single", { "allowTemplateLiterals": true }]
    }
  }
]; 