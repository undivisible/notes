import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";

export default [
  js.configs.recommended,
  ...svelte.configs["flat/recommended"],
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["**/*.js", "**/*.svelte"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        Blob: "readonly",
        document: "readonly",
        fetch: "readonly",
        IntersectionObserver: "readonly",
        localStorage: "readonly",
        requestAnimationFrame: "readonly",
        require: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "no-unexpected-multiline": "off",
      "svelte/no-dom-manipulating": "off",
      "svelte/prefer-svelte-reactivity": "off",
      "svelte/prefer-writable-derived": "off",
      "svelte/require-each-key": "off",
    },
  },
];
