# offerpilot-app env update redaction pitfall (2026-07-03)

## What happened

During an env update for `tranfu-labs/offerpilot-app`, the user pasted ASR/LLM keys directly in chat. The flow correctly located the existing Coolify Application and checked that the target env keys were missing before creating them. However, one secret value embedded directly in the tool script was transformed by the runtime redaction layer into a masked placeholder, so Coolify received the placeholder instead of the real `LLM_API_KEY`.

## Durable lesson

For user-provided secrets in chat, do not paste secret literals into shell/Python source, JSON literals, logs, temp files, or patch content. The transcript/redaction layer can rewrite them before execution, and even when it does not, it increases leakage risk.

## Preferred pattern

- If the key is new and reversible-ops allows direct create, pass values through a channel that avoids literalizing them in generated code whenever available.
- If no safe non-literal channel is available, give the operator a copy-paste command/template or UI steps instead of executing the secret write yourself.
- After creating envs, verify only key existence and HTTP status; never print values.
- If a secret value may have been redacted or placeholder-written, report the affected key and require manual overwrite/rotation.

## Related safety notes

- Chat-posted secrets should be treated as compromised and rotated.
- Existing-key overwrite remains constrained by `reversible-ops`; do not patch/overwrite existing Coolify env values outside its allowed paths.
- Normalize Feishu/Markdown auto-linked URLs before writing env values, e.g. convert `wss://[host/path](http://host/path)` to a plain `wss://host/path` string.
