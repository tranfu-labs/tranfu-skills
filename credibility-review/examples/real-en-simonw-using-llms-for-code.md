---
source_url: https://simonwillison.net/2025/Mar/11/using-llms-for-code/
source_org: Simon Willison's Weblog
fetched_date: 2026-05-08
published_date: 2025-03-11
language: en
tier_hint: T2-personal
excerpt: true
note: |
  Excerpt — kept intro + Set reasonable expectations + Account for training cut-off + Context is king + first half of Tell them exactly what to do.
  Skipped 后半段 detailed Claude Code 例子 / vibe-coding section / 收尾 advice sections.
  完整原文见 source_url。
---

# Here's how I use LLMs to help me write code

11th March 2025

Online discussions about using Large Language Models to help write code inevitably produce comments from developers who's experiences have been disappointing. They often ask what they're doing wrong—how come some people are reporting such great results when their own experiments have proved lacking?

Using LLMs to write code is **difficult** and **unintuitive**. It takes significant effort to figure out the sharp and soft edges of using them in this way, and there's precious little guidance to help people figure out how best to apply them.

If someone tells you that coding with LLMs is _easy_ they are (probably unintentionally) misleading you. They may well have stumbled on to patterns that work, but those patterns do not come naturally to everyone.

I've been getting great results out of LLMs for code for over two years now. Here's my attempt at transferring some of that experience and intution to you.

#### Set reasonable expectations

Ignore the "AGI" hype—LLMs are still fancy autocomplete. All they do is predict a sequence of tokens—but it turns out writing code is mostly about stringing tokens together in the right order, so they can be _extremely_ useful for this provided you point them in the right direction.

If you assume that this technology will implement your project perfectly without you needing to exercise any of your own skill you'll quickly be disappointed.

Instead, use them to _augment_ your abilities. My current favorite mental model is to think of them as an over-confident pair programming assistant who's lightning fast at looking things up, can churn out relevant examples at a moment's notice and can execute on tedious tasks without complaint.

**Over-confident** is important. They'll absolutely make mistakes—sometimes subtle, sometimes huge. These mistakes can be deeply inhuman—if a human collaborator hallucinated a non-existent library or method you would instantly lose trust in them.

**Don't fall into the trap of anthropomorphizing LLMs and assuming that failures which would discredit a human should discredit the machine in the same way.**

When working with LLMs you'll often find things that they just cannot do. Make a note of these—they are useful lessons! They're also valuable examples to stash away for the future—a sign of a strong new model is when it produces usable results for a task that previous models had been unable to handle.

#### Account for training cut-off dates

A crucial characteristic of any model is its **training cut-off date**. This is the date at which the data they were trained on stopped being collected. For OpenAI's models this is usually October 2023 or May 2024. Other providers may have more recent dates.

This is _extremely_ important for code, because it influences what libraries they will be familiar with. If the library you are using had a major breaking change since October 2023, some OpenAI models won't know about it!

I gain enough value from LLMs that I now deliberately consider this when picking a library—I try to stick with libraries with good stability and that are popular enough that many examples of them will have made it into the training data. I like applying the principles of boring technology—innovate on your project's unique selling points, stick with tried and tested solutions for everything else.

#### Context is king

Most of the craft of getting good results out of an LLM comes down to managing its context—the text that is part of your current conversation.

This context isn't just the prompt that you have fed it: successful LLM interactions usually take the form of conversations, and the context consists of every message from you _and_ every reply from the LLM that exist in the current conversation thread.

When you start a new conversation you reset that context back to zero. This is important to know, as often the fix for a conversation that has stopped being useful is to wipe the slate clean and start again.

One of the reasons I mostly work directly with the ChatGPT and Claude web or app interfaces is that it makes it easier for me to understand exactly what is going into the context. LLM tools that obscure that context from me are _less_ effective.

You can use the fact that previous replies are also part of the context to your advantage. For complex coding tasks try getting the LLM to write a simpler version first, check that it works and then iterate on building to the more sophisticated implementation.

#### Tell them exactly what to do

Once I've completed the initial research I change modes dramatically. For production code my LLM usage is much more authoritarian: I treat it like a digital intern, hired to type code for me based on my detailed instructions.

Here's a recent example:

> Write a Python function that uses asyncio httpx with this signature:
>
>     async def download_db(url, max_size_bytes=5 * 1025 * 1025): -> pathlib.Path
>
> Given a URL, this downloads the database to a temp directory and returns a path to it. BUT it checks the content length header at the start of streaming back that data and, if it's more than the limit, raises an error.

I could write this function myself, but it would take me the better part of fifteen minutes to look up all of the details and get the code working right. Claude knocked it out in 15 seconds.

I find LLMs respond extremely well to function signatures like the one I use here. I get to act as the function designer, the LLM does the work of building the body to my specification.

[... vibe-coding section, detailed Claude Code walkthrough, and closing advice omitted in excerpt ...]
