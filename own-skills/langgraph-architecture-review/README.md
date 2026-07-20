---
description: Inspect a real Python LangGraph project and turn its code into an evidence-backed architecture map, review, and improvement plan.
prompt_examples:
  - prompt: Map this LangGraph workflow and explain every node and edge.
    scene: Map the workflow
  - prompt: Review our interrupt, checkpointer, and state design for risks.
    scene: Review graph safety
  - prompt: Propose LangGraph changes for this feature using source evidence.
    scene: Plan graph changes
---

# langgraph-architecture-review

Make a Python LangGraph architecture understandable and improvable without inventing nodes that are not in the source.

## When to use it

**Map the workflow**

I need a source-grounded Mermaid diagram and a plain explanation of how graph state, nodes, routes, tools, and outputs deliver a real product task.

**Review graph safety**

I want to inspect reducers, persistence, human checkpoints, retry paths, side effects, termination, or sensitive streamed state before changing the graph.

**Plan graph changes**

I have a concrete feature or architecture concern and want prioritized changes tied to file and line evidence, expected effects, risks, and verification steps.

**Not for**

Use another workflow for generic AI architecture selection, ordinary code review without LangGraph, TypeScript-only graphs, or implementation of a brand-new graph when no inspection was requested.

## What it produces

**Source code and the compiled graph are evidence; a plausible-looking diagram is not.**

- **Architecture packet**: returns `LANGGRAPH_ARCHITECTURE_PACKET` with a Mermaid graph, task-level explanation, boundaries, findings, and prioritized recommendations.
- **Static inventory**: runs the bundled scanner and validator, using temporary Markdown and JSON reports to trace graph elements back to source.
- **Runtime inspection**: uses public graph introspection only when importing the project is demonstrably free of dangerous side effects.
- **Current guidance**: when current APIs or migration guidance matter, checks official sources and labels the review `local-only` if live verification fails.
- **Default side effects**: review-only mode does not edit project code, install or upgrade LangGraph, or require LangSmith.
- **Never does**: it does not expose secrets or private streamed state, fabricate runtime tests, or treat checkpoint data as canonical business truth.

## Prerequisites and boundaries

**Prerequisites**

Provide a readable existing Python project that imports LangGraph. The installed package version, graph builders, state schemas, node callables, routers, persistence configuration, and graph-facing APIs must be inspectable.

**Verification boundaries**

- Dynamic graph construction that the scanner misses is inspected manually and uncertain edges remain `unverified`.
- Unsafe imports stay static-only; missing tests, credentials, renderers, or official documentation are reported as `not_run` or incomplete.
- Mermaid source is required, but rendering it into an image is optional.

**Nearby responsibilities**

| Need | Use instead |
|---|---|
| Choose an AI architecture from scratch | architecture selection workflow |
| Review unrelated Python code | general code review |
| Implement approved changes | explicit implementation follow-up |

**Subtle boundary**

Review-only is the default. Project files change only after the user explicitly requests implementation following the architecture review.
