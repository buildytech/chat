# ADR 0050: Versioned source of agent tool-choice policy

Status: accepted, 2026-11-16. First delivery of .project/.refactor/agent-system-plan.md.

The current runtime uses required in Build, auto in Ask, and a named write_page after one host nudge. The tool document still described Build as auto. Preserve the tested runtime behavior and move its default choice to agent-tools.v1.json, exposed by agentToolChoice(mode). The host may explicitly force its repair write; it does not redefine the default mode policy.

Tool document becomes version 3 and POLICY_VERSION page-agent/5. Existing contract fingerprint includes both; regenerate runtime bundles and deploy browser/runtime together. No new provider, tool, prompt semantics or page/session shape. Existing provider replay tests plus contract assertions verify mode behavior. This is policy synchronization, not the complete scenario profile/compiler planned for later stages.

Delivery follows the existing gate/push.sh rule. If the gate is absent, do not replace it with git push or invent a gate; report the delivery block after completing local work.
