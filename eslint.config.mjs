import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["js/md5.js"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { ...globals.browser },
    },
  },
];