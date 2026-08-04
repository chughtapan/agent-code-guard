/**
 * @file Vertical-organization rule registry. Exposes the three public,
 * non-fixing navigation rules through one plugin-facing family map.
 */

import { noVacuousJsdoc } from "./no-vacuous-jsdoc.js";
import { preferStepdownFunctionOrder } from "./prefer-stepdown-function-order.js";
import { requireStableFileShell } from "./require-stable-file-shell.js";

/** Public vertical-organization rules, intentionally disabled by PR 1 presets. */
export const verticalOrganizationRules = {
  "no-vacuous-jsdoc": noVacuousJsdoc,
  "require-stable-file-shell": requireStableFileShell,
  "prefer-stepdown-function-order": preferStepdownFunctionOrder,
} as const;
