// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      // Expo 57 habilita reglas experimentales del compilador que rechazan patrones
      // válidos y ya extendidos en React Native (Animated.Value y sincronización de sheets).
      // Mantenemos las reglas estables de hooks y TypeScript activas.
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/static-components": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  }
]);
