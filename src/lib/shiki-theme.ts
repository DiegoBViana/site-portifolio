import { createCssVariablesTheme } from 'shiki/core';

/**
 * Shiki theme whose colours are CSS variables (--shiki-*), mapped to design tokens in
 * src/styles/tokens.css. Highlighting happens at build time; light/dark switch in CSS.
 */
export const tokenTheme = createCssVariablesTheme({
  name: 'tokens',
  variablePrefix: '--shiki-',
  fontStyle: true,
});
