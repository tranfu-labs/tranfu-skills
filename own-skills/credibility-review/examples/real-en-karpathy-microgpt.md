---
source_url: http://karpathy.github.io/2026/02/12/microgpt/
source_org: Karpathy's blog
fetched_date: 2026-05-08
published_date: 2026-02-12
language: en
tier_hint: T2-personal
excerpt: true
note: |
  Excerpt — kept intro + Dataset + Tokenizer.
  Skipped Autograd / Architecture / Training loop / Inference / Run it / Real stuff sections.
  完整原文见 source_url。
---

# microgpt

Feb 12, 2026

This is a brief guide to my new art project microgpt, a single file of 200 lines of pure Python with no dependencies that trains and inferences a GPT. This file contains the full algorithmic content of what is needed: dataset of documents, tokenizer, autograd engine, a GPT-2-like neural network architecture, the Adam optimizer, training loop, and inference loop. Everything else is just efficiency. I cannot simplify this any further. This script is the culmination of multiple projects (micrograd, makemore, nanogpt, etc.) and a decade-long obsession to simplify LLMs to their bare essentials, and I think it is beautiful 🥹. It even breaks perfectly across 3 columns.

Where to find it:

*   This GitHub gist has the full source code: microgpt.py
*   It's also available on this web page: https://karpathy.ai/microgpt.html
*   Also available as a Google Colab notebook
*   **NEW**: buy microgpt as a triptych on my art store at karpathy.art :)

The following is my guide on stepping an interested reader through the code.

## Dataset

The fuel of large language models is a stream of text data, optionally separated into a set of documents. In production-grade applications, each document would be an internet web page but for microgpt we use a simpler example of 32,000 names, one per line:

```python
# Let there be an input dataset `docs`: list[str] of documents (e.g. a dataset of names)
if not os.path.exists('input.txt'):
    import urllib.request
    names_url = 'https://raw.githubusercontent.com/karpathy/makemore/refs/heads/master/names.txt'
    urllib.request.urlretrieve(names_url, 'input.txt')
docs = [l.strip() for l in open('input.txt').read().strip().split('\n') if l.strip()]
random.shuffle(docs)
print(f"num docs: {len(docs)}")
```

The dataset looks like this. Each name is a document:

```
emma
olivia
ava
isabella
sophia
charlotte
mia
amelia
harper
... (~32,000 names follow)
```

The goal of the model is to learn the patterns in the data and then generate similar new documents that share the statistical patterns within. As a preview, by the end of the script our model will generate ("hallucinate"!) new, plausible-sounding names.

It doesn't look like much, but from the perspective of a model like ChatGPT, your conversation with it is just a funny looking "document". When you initialize the document with your prompt, the model's response from its perspective is just a statistical document completion.

## Tokenizer

Under the hood, neural networks work with numbers, not characters, so we need a way to convert text into a sequence of integer token ids and back. Production tokenizers like tiktoken (used by GPT-4) operate on chunks of characters for efficiency, but the simplest possible tokenizer just assigns one integer to each unique character in the dataset:

```python
uchars = sorted(set(''.join(docs)))
BOS = len(uchars)
vocab_size = len(uchars) + 1
print(f"vocab size: {vocab_size}")
```

In the code above, we collect all unique characters across the dataset (which are just all the lowercase letters a-z), sort them, and each letter gets an id by its index. Note that the integer values themselves have no meaning at all; each token is just a separate discrete symbol. Instead of 0, 1, 2 they might as well be different emoji. In addition, we create one more special token called `BOS` (Beginning of Sequence), which acts as a delimiter: it tells the model "a new document starts/ends here". Later during training, each document gets wrapped with `BOS` on both sides: `[BOS, e, m, m, a, BOS]`. The model learns that `BOS` initates a new name, and that another `BOS` ends it. Therefore, we have a final vocavulary of 27 (26 possible lowercase characters a-z and +1 for the BOS token).

[... Autograd / Architecture / Training loop / Inference / Run it / Real stuff sections omitted in excerpt ...]
