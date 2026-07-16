# LANGGRAPH_ARCHITECTURE_PACKET Contract

Use this contract for the final review. Omit empty optional fields, but do not rename sections.

## Required report structure

````markdown
# LangGraph Architecture Review: <project or feature>

## Executive Summary
- Review mode: static-only | static-and-runtime
- Project root:
- Installed LangGraph version:
- Official version checked:
- Overall assessment:
- Highest-priority change:

## Product Workflow
<User action to final artifact, with deterministic, LLM, tool, human, and persistence steps identified.>

## Architecture Diagram
```mermaid
flowchart TD
  ...
```

## Graph Registry
| Graph | Entrypoint | Purpose | Compile/persistence | Evidence |

## Node Contracts
| Node | Type | Reads | Writes | Calls | Side effects | Failure behavior | Evidence |

## State Model
| Channel | Scope | Type | Reducer | Writers | Readers | Persistence owner | Risk |

## Routing And Termination
| Source | Route type | Condition | Target | Termination/fallback | Evidence |

## Persistence And Human Checkpoints
<Checkpointer, Store, database, thread ID, interrupt/resume, idempotency, isolation.>

## Model And Tool Budget
| Path | Model calls | Tool calls | Retry bound | Expected latency/cost risk |

## Findings
| ID | Priority | Evidence | Problem | Impact |

## Recommendations
| Priority | Change | Expected effect | Risk | Verification |

## Verification
- Commands run and results.
- Runtime paths not run.

## Unverified Items
- Explicit unknowns; write `none` when everything material was verified.
````

## Evidence rules

- Source findings use absolute or project-relative file paths with line numbers.
- Runtime findings cite test output, trace/run ID, compiled graph output, or an observed API result.
- Official API claims cite a current LangGraph documentation URL or release.
- Inferences are labeled `inference`; unverified behavior is never written as fact.

## Node type vocabulary

Use only these primary node types unless the project needs one additional domain-specific type:

```text
deterministic
llm
tool
retrieval
persistence
human_checkpoint
validation
side_effect
subgraph
```

## Recommendation priority

- `P0`: correctness, data isolation, unbounded execution, unsafe side effect, broken resume, or production blocker.
- `P1`: measurable quality, latency, maintainability, observability, or testability problem.
- `P2`: optional simplification, ergonomics, documentation, or future scalability.

## Completion gate

The packet is complete only when:

1. every discovered graph is in the registry;
2. every visible diagram node maps to source evidence;
3. state/persistence ownership is explicit;
4. all loops and human checkpoints have termination/resume behavior;
5. recommendations are tied to a concrete task and verification;
6. skipped runtime checks are visible.
