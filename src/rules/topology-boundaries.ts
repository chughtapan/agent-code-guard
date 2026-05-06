import {
  createTopologyDiagnosticRule,
  topologyDiagnosticRuleIds,
} from "./topology-diagnostic-rule.js";

export default createTopologyDiagnosticRule(
  "topology-boundaries",
  topologyDiagnosticRuleIds,
  "Compatibility meta-rule that reports every topology diagnostic from the project graph.",
);
