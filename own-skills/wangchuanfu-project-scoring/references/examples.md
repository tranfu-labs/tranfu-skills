# Calibrated Examples

## High-Potential Example: AI Customer Requirement Organizer

Input summary:
- Target users: design/service providers
- Pain: customer chat records are messy; requirement extraction takes time
- AI role: extract needs, open questions, quote prerequisites
- Evidence: L2 interviews/samples

Expected decision:
- Score: around 75-84
- Status: 小步立项 or 先验证 depending on evidence
- Strength: repeated workflow pain, strong AI fit, low MVP complexity
- Risk: privacy, template quality, payment willingness
- Next action: 7-day concierge validation with sanitized samples

## Medium Example: Generic AI Logo Generator

Input summary:
- Target users: broad entrepreneurs
- Pain: need logo quickly
- AI role: generate logo drafts
- Evidence: L1 public trend

Expected decision:
- Score: around 50-65
- Status: 先验证 or 重构方向
- Strength: visual demo and public interest
- Risk: crowded competitors, weak differentiation, high subjective revision cost, image model cost
- Next action: narrow to "brand direction pack for small teams" before scoring again

## Risk-Downgraded Example: AI Legal Contract Advisor

Input summary:
- Target users: small companies
- Pain: contract review is expensive
- AI role: give legal advice and risk judgment
- Evidence: L1 public demand

Expected decision:
- Status: 先验证 or 重构方向 regardless of apparent demand
- Reason: legal responsibility boundary is not defined
- Required change: reposition as clause summarization/checklist, not legal advice; add human lawyer boundary

## Low-Information Example: Smart Assistant For Everyone

Expected decision:
- Status: 重构方向 or 暂不立项
- Reason: target user, scene, demand, distribution, and evidence are too vague
- Next action: choose one role, one scene, one repeated workflow, and one current workaround

Initial response behavior:
- Do not score immediately when this is the user's first message.
- Ask 3-5 focused clarification questions before judging.
- Questions should cover the specific user/scene, current workaround, AI job, evidence, and first 7-day validation channel.
- Only produce a low-confidence provisional score if the user explicitly asks to skip clarification.
