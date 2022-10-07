module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
    jest: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
    "prettier/@typescript-eslint",
  ],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import", "unused-imports"],
  settings: {
    "import/extensions": [".js", ".ts"],
    "import/internal-regex": "^src",
  },
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "CallExpression[callee.object.name='console'][callee.property.name=/^(log|warn|error|info|trace)$/]",
        message:
          "Don't use console, use pino logger (or another library) instead",
      },
      {
        selector: "TSEnumDeclaration",
        message: "Don't declare enums",
      },
      {
        selector: "CallExpression[callee.property.name='save']",
        message: "Don't use typeorm save, use insert or update instead",
      },
    ],
    "import/no-duplicates": "warn",
    "import/order": [
      "warn",
      {
        alphabetize: { order: "asc", caseInsensitive: true },
        "newlines-between": "always",
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "index",
          "sibling",
          "unknown",
        ],
        pathGroupsExcludedImportTypes: [],
      },
    ],
    // es-lint rules:
    "comma-spacing": ["warn", { before: false, after: true }],
    curly: "warn",
    indent: "off",
    "linebreak-style": [
      "warn",
      require("os").EOL === "\r\n" ? "windows" : "unix",
    ],
    "no-case-declarations": "off",
    "no-console": "off",
    "no-constant-condition": "off",
    "no-dupe-else-if": ["error"],
    "no-empty": "off",
    "no-inner-declarations": ["error", "both"],
    "no-unneeded-ternary": "warn",
    "no-unused-labels": "warn",
    "object-shorthand": ["warn", "always"],
    "padding-line-between-statements": [
      "warn",
      { blankLine: "always", prev: "*", next: "return" },
      { blankLine: "always", prev: "*", next: "block-like" },
      { blankLine: "always", prev: "block-like", next: "*" },
    ],
    "prefer-arrow-callback": "error",
    "prefer-const": [
      "warn",
      {
        destructuring: "any",
        ignoreReadBeforeAssign: false,
      },
    ],
    "require-atomic-updates": "warn",
    semi: ["off"],
    "no-extra-semi": "warn",
    yoda: "warn",

    // @typescript-eslint rules:
    "@typescript-eslint/array-type": ["warn", { default: "array-simple" }],
    "@typescript-eslint/naming-convention": [
      "error",
      {
        selector: "variable",
        modifiers: ["destructured"],
        format: null,
      },
    ],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/explicit-member-accessibility": [
      "error",
      { accessibility: "no-public" },
    ],
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/no-type-alias": "off",
    "@typescript-eslint/no-empty-interface": "off",
    // Проверки в тайпскрипте лучше
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-object-literal-type-assertion": "off",
    "@typescript-eslint/no-parameter-properties": "off",
    "@typescript-eslint/no-var-requires": "off",
    // note you must disable the base eslint rule as it can report incorrect errors
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { args: "none", ignoreRestSiblings: true },
    ],
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/prefer-interface": "off",
    "@typescript-eslint/no-inferrable-types": [
      "warn",
      { ignoreParameters: true },
    ],
    // note you must disable the base eslint rule as it can report incorrect errors
    "no-empty-function": "off",
    "@typescript-eslint/no-empty-function": [
      "error",
      { allow: ["arrowFunctions"] },
    ],
    "@typescript-eslint/ban-ts-ignore": "off",

    // unused-imports rules
    "unused-imports/no-unused-imports-ts": "warn",
  },
  overrides: [
    Object.assign(require("eslint-plugin-jest").configs.recommended, {
      files: ["__tests__", "**/*.spec.ts", "**/*.spec.tsx", "**/*.test.ts"],
      env: {
        jest: true,
      },
      plugins: ["jest"],
      rules: {
        "jest/expect-expect": [
          "error",
          { assertFunctionNames: ["expect", "assertExpectations"] },
        ],
      },
    }),
  ],
};
