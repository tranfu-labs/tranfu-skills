---
title: 我们让 Claude 写 SQL 时差点删了客户库
date: 2026-05-07
tag: 踩坑
description: 让 Claude 3.5 Sonnet 帮某零售客户生成数据清洗 SQL，它写出了一个语法合法、逻辑致命的 UPDATE，DBA 老 W 在 commit 前 30 秒拦下来。这篇是关于我们一开始为什么没拦住的复盘。
slug: claude-sql-almost-dropped-customer-db
---

周二下午，我们让 Claude 3.5 Sonnet (2024-10-22) 帮某零售客户生成一段订单表清洗 SQL，目标是把 90 天前的 `status='pending'` 行迁到归档表。Claude 给的 SQL 在 staging 跑得一切正常，到生产前 DBA 老 W 在 commit 前 30 秒拦下来——那条 UPDATE 的 WHERE 子句少了一个括号，会把全表 200 万行的 status 全部覆写成 NULL。这篇是关于我们一开始为什么没看出来的复盘，不是关于我们最后怎么补救的。

---

我们当时给 Claude 的 prompt 大致是：

> 这是 schema：
> orders(id bigint, status varchar, created_at timestamp)
> 请写一段 SQL，把 90 天前 status 为 pending 的行的 status 字段置为 NULL。

Claude 回的 SQL 长这样（这就是后来差点炸库的那一段）：

```sql
UPDATE orders
SET status = NULL
WHERE created_at < NOW() - INTERVAL '90 days'
  OR status = 'pending'  -- ← 这里少了一对括号
;
```

### 第一反应：以为是 Claude 用错了字段名

我看到 SQL 的第一眼，下意识扫的是 `SET status = NULL` 这行——`status` 是我们最近刚加的字段，我以为 Claude 用了旧 schema 的字段名。这个怀疑被 30 秒打脸：我把 schema 复制到一个新对话里让 Claude 自己 review，它一秒钟回：

> 字段名没问题。`orders` 表的 `status` 字段是 varchar 类型，可以接受 NULL 值。整段 UPDATE 语法合法。

字段名确实没问题。我合上对话，准备点 merge。

### 再查：怀疑是 staging 数据太干净

老 W 拦下来的时候我第一反应是"staging 上跑过没事啊"。我又跑了一遍 staging：

```
UPDATE 8432
```

8432 行——staging 库里只有 1 万行测试数据，里面凑巧没有 `created_at >= 90 天 AND status != 'pending'` 的行，所以那个少括号的 WHERE 在 staging 上恰好等价于正确版本。生产 200 万行里这种行有 180 万。

我同事老 C 那天还在 PR 里留了一句 review 评论：「staging 跑过了应该没问题，你们要不要加个 EXPLAIN 看一眼？」我当时没仔细看那条评论。

### 第三次：以为是 Claude 在 review 时漏了

我又把那段 SQL 直接贴回 Claude，问"这段 SQL 有 bug 吗"。Claude 回：

> 这段 UPDATE 在语法上合法。`WHERE created_at < NOW() - INTERVAL '90 days' OR status = 'pending'` 这个条件会匹配创建于 90 天前的行，或 status 为 pending 的行。如果你的意图是同时满足两个条件，需要用 AND；OR 在这里语义是任一满足。

我盯着那句"OR 在这里语义是任一满足"看了 5 秒钟才反应过来——它说出了真因，但是用陈述句说的，没有"这是 bug"的标记，我前面读得太快没意识到这就是我要找的答案。

### 真相：OR 优先级 + LLM 自洽偏见的双杀

真因有两层。第一层是 SQL 本身：`WHERE A OR B` 在 OR 是顶层算子时，任何 `status = 'pending'` 的行都会被命中，无论 created_at 是不是 90 天前。这是 SQL 初学者第二周就会学到的坑。本地复现：

```sql
CREATE TABLE orders (id int, status varchar, created_at timestamp);
INSERT INTO orders VALUES
  (1, 'pending', '2025-12-01'),  -- 才 5 个月前，不该被命中
  (2, 'paid',    '2024-01-01');  -- 1 年多前，不该被命中（status != pending）
UPDATE orders
  SET status = NULL
  WHERE created_at < NOW() - INTERVAL '90 days' OR status = 'pending';
SELECT * FROM orders WHERE status IS NULL;
-- 两行都被命中。
```

第二层是为什么我们前面三次都没看到。事后我们排了一下：

- 第一次：我扫的是字段名，没看 WHERE 结构。
- 第二次：staging 数据的分布恰好让 bug 不可见——这是最阴险的一种 false negative，不是 staging 本身有问题，是我们没构造能暴露 bug 的 staging 数据。
- 第三次：让 Claude review 自己的 SQL，相当于让一个有特定盲点的人复查自己的作业；它生成时没考虑到的边界，review 时也只是在描述行为，没有触发"这是错"的判断。我同事老 C 那条 PR 评论里其实点出了 EXPLAIN，我读的时候眼睛滑过去了。

### 现在

我们把这件事改成了三条规则：

1. 任何 LLM 生成的 UPDATE/DELETE，必须先在本地 psql 跑一遍 `EXPLAIN` 看 estimated rows，对不上数量级就退回。
2. staging 库里专门塞了一批"边界数据"——包括能触发常见 SQL 优先级 bug 的行。
3. LLM review LLM 这个步骤被我们删了，没用，反而给人虚假安全感。现在的兜底是 DBA 必须看一眼，5 分钟的事情。

老 W 那 30 秒拦截的事我们记着。这件事最终让我们认真去做了 staging 边界数据这件事，之前一直拖。
