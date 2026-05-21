<!--
tranfu-publish 同类 Skill 对比 — README.md body section 模板.
own / external 路径必跑, case 跳过. 不进 frontmatter. {…} 占位符替换.

落点 (HARD): 落 README.md, **不**落 SKILL.md — README 给人横向定位看, SKILL.md 给 LLM 执行看, 不同读者.
  - own:      own-skills/{name}/README.md
  - external: external-skills/{name}/README.md
紧跟在 `## 什么时候用它` / `## 推荐场景` 之后. 横向同类对比 vs 纵向使用技巧, 焦点严格分离.
-->

## 同类 Skill 对比

> 由 tranfu-publish 起草, 作者 / 推荐者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内
- [{name}](../{own|external}-skills/{name}/SKILL.md) — {对方 1 句话做什么}; **本 skill 区别**: {1 句, 在 X 场景更合适 / 输入输出不同}
- (≤3 条; 0 条则 "暂无")

### 外部世界
- [{name}]({url}) — {…}; **本 skill 区别**: {…}
- (≤3 条; 0 条则 "暂无")

### 本 skill 独特价值
- {≤3 行, 每行 ≤30 字, 具体到能力 / 场景 / 输出, 不空话}
