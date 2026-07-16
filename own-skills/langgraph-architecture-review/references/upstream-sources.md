# Current LangGraph Sources

Use live primary sources for current API claims. Do not freeze a “latest” version in `SKILL.md`.

## Source priority

1. Installed project package and lockfile.
2. LangGraph official release and source repository.
3. Current official documentation index and relevant pages.
4. Official LangChain Skills as implementation guidance.
5. Community Skills only for optional scripts or evaluation patterns after license and compatibility checks.

## Official sources

- Repository and releases: https://github.com/langchain-ai/langgraph
- Documentation index: https://docs.langchain.com/llms.txt
- Graph API: https://docs.langchain.com/oss/python/langgraph/graph-api
- Workflows and agents: https://docs.langchain.com/oss/python/langgraph/workflows-agents
- Persistence: https://docs.langchain.com/oss/python/langgraph/persistence
- Interrupts: https://docs.langchain.com/oss/python/langgraph/interrupts
- Subgraphs: https://docs.langchain.com/oss/python/langgraph/use-subgraphs
- Testing: https://docs.langchain.com/oss/python/langgraph/test
- Official Skills: https://github.com/langchain-ai/langchain-skills
- Academy examples: https://github.com/langchain-ai/langchain-academy

## Current-version checks

Python project:

```bash
python -c "from importlib.metadata import version; print(version('langgraph'))"
```

GitHub release:

```bash
gh repo view langchain-ai/langgraph \
  --json latestRelease,updatedAt,licenseInfo,url
```

Documentation discovery:

```bash
curl -fsSL https://docs.langchain.com/llms.txt | rg 'oss/python/langgraph'
```

## Reference dispositions verified 2026-07-16

| Reference | Disposition | Use | Caveat |
|---|---|---|---|
| `langchain-ai/langgraph` | adopt | API and runtime truth | Match guidance to installed major/minor version |
| `langchain-ai/langchain-skills` | adopt as live reference | Fundamentals, persistence, HITL | Repository describes itself as early development; no GitHub-detected license at review time |
| `langchain-ai/langchain-academy` | absorb | Runnable graph pattern examples | Teaching notebooks are not production architecture |
| `Lubu-Labs/langchain-agent-skills` | spike/absorb | Mermaid, graph validation, state and trajectory ideas | MIT, but community scripts must be checked against current public APIs |
| `langchain-ai/deepagents` | defer/reject for graph review | Compare only when a full agent harness is actually needed | Do not turn a graph review into a multi-agent migration |

## API drift checks

Before recommending a change, verify at least:

- graph state schema support and performance notes;
- `Runtime` and run-scoped context APIs;
- `Command`, `Send`, and `Overwrite` imports and semantics;
- streaming API and private-channel visibility;
- checkpointer/Store separation;
- interrupt resume and node re-execution behavior;
- current persistence backend package names;
- `get_graph(xray=True)` and Mermaid rendering availability.
