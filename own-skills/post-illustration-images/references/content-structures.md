# Content Expression Structures

Content expression structure answers: "how is the information relationship organized in this image?"

Choose one main structure per image. Do not mix multiple structures unless the style file explicitly requires it.

| Structure | Use When | Guidance |
|---|---|---|
| Cover / hook | First image, topic entry, strong conclusion | One big claim, one visual hook, few supporting labels. |
| Workflow | Input, process, output, operation steps | Keep only key steps; show direction clearly. |
| System slice | Modules, sources, filters, agents, tool calls | Show 3-5 modules; avoid dense architecture diagrams. |
| Before-after | Manual vs automated, messy vs ordered, wrong vs right | Use left-right or top-bottom contrast; labels must be short. |
| Role state | User pain, creator stuck, agent handoff, state transition | Show 2-4 states; each state has an action. |
| Concept metaphor | Abstract judgment, relationship, invisible mechanism | One memorable object carries the idea. |
| Layered method | Capability stack, maturity ladder, strategy layers | Avoid rigid pyramid if a gentler layer or workspace metaphor works. |
| Map / route | Learning path, delivery path, progression | Few nodes, clear route, no decorative detours. |
| Checklist | Summary, acceptance criteria, boundary reminders | Use checks, warning labels, or cards; good for final images. |
| Decision tree | Branching choices, tool selection, conditional logic | Use one decision node and limited branches. |
| Mini comic | Failure to success, process change, scenario teaching | One action per panel; keep panels few. |

## Structure Selection

Select based on the anchor's relationship type:

- Sequential relation -> workflow.
- Two-sided contrast -> before-after.
- Abstract mechanism -> concept metaphor.
- Multiple comparable points -> cards/checklist/system slice.
- Levels or maturity -> layered method.
- Conditional choice -> decision tree.
- Human experience -> role state or mini comic.

## Shot List Fields

Use this structure for every planned image:

```markdown
### Image <n>: <topic>

- Sequence / placement:
- Core meaning:
- Content expression structure:
- Visual metaphor:
- Main actor/object action:
- Suggested elements:
- Short labels:
- Fixed component reservation:
- QA risk:
```

The `Core meaning` field must contain exactly one idea.
