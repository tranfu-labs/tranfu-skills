---
description: "Research AI and technology topics, verify claims, and save a traceable evidence package before writing begins."
prompt_examples:
  - prompt: "Research the latest open-source AI agent frameworks before I write an article."
    scene: Research a tech topic
  - prompt: "Enrich these reports and URLs with independent sources and check their claims."
    scene: Enrich source materials
  - prompt: "Find several current AI stories that have enough evidence for a Chinese article."
    scene: Find current AI stories
---

# Source Research and Fact-Checking

Build verified sources before AI content is written.

## When to use it

**Research a tech topic**

I have an AI model, developer tool, chip, robotics story, or platform event to cover. I want the facts, disagreements, and unknowns checked before anyone starts drafting.

**Enrich source materials**

I already have URLs, Markdown, text files, or PDFs. I want them treated as leads, compared with independent evidence, and turned into claims that a writer can safely use.

**Find current AI stories**

I need recent, evidence-backed story candidates rather than a list of headlines. I want each candidate ranked and tied to sources before I choose one.

**Won't take**

This is not for non-technology research, isolated fact lookups, rewriting a finished article, generating titles, or publishing content.

## What it produces

**A search result is never treated as proof until the original page has been opened and recorded.**

- **Independent run**: Appends a research brief, source notes, and an editorial brief under `reference/collect-sources/`
- **Orchestrated run**: Returns a validated research package to `content-production` without creating a second run
- **Evidence trail**: Gives sources and claims stable IDs, records conflicts, and labels what is ready, uncertain, or unusable
- **Research status**: Closes as complete, partial, or blocked with unresolved gaps named explicitly
- **External activity**: Searches and reads public web sources, then writes only the designated research files
- **Never**: Drafts the article, changes supplied source files, asks for logins, or copies full copyrighted pages

## Prerequisites & boundaries

**Prerequisites**

A supported AI or adjacent-technology topic, a writable working directory, and access to public search and page-reading tools are required. Supplied local materials must be readable.

**Neighbor skill split**

| Need | Hand off to |
|---|---|
| Run the full publishing package | **content-production** |
| Write from approved evidence | **draft-content** |
| Check a finished article | **credibility-review** |

**Scenarios it declines**

- Research unrelated to technology or content production
- Pages that require a login, payment, CAPTCHA, or manual verification
- Requests to write, format, illustrate, or publish the final content

**Subtle edges**

- A writing request may continue only after this skill returns a usable handoff; this skill itself stops at research
- Conflicting credible sources remain visible instead of being silently resolved
- If no candidate has traceable evidence, the result is blocked rather than padded with weak stories
