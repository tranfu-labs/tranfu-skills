# 小红书知识卡片视觉系统规范（通用可复用版）

> 用途：这是一份**只保留配图视觉风格与组件规范**的通用文档。任何作图 AI / Agent 接手后，可根据新的主题内容生成同一视觉风格的系列配图。  
> 边界：本文档**不包含任何固定选题、案例、观点或行业内容**。所有具体文案均应由接手方根据新内容另行填入。

---

## 1. 总体风格定位

这套视觉适合用于小红书图文笔记、知识科普、概念拆解、轻教程类内容。

核心气质：

- 温暖、明快、亲和
- 像「手账式知识卡片」，不是冷冰冰的科技海报
- 信息图感强，但不要像 PPT 截图
- 有年轻化装饰，但整体要克制、清晰、可读
- 适合用户快速滑读、收藏、转发

关键词：

`小红书知识笔记风` / `暖橙色` / `米白纸张` / `撕纸边缘` / `轻网格背景` / `粗黑标题` / `圆角卡片` / `贴纸感` / `清单感` / `轻信息图`

---

## 2. 画布与基础背景

### 2.1 画布比例

- 固定使用：**竖版 3:4**
- 推荐尺寸：`1080 × 1440`、`1086 × 1448` 或同等 3:4 比例
- 适配小红书图文封面与多图笔记

### 2.2 背景结构

背景由三层组成：

1. **外层暖橙色背景**
   - 四周铺满橙色
   - 提供强识别度与系列感

2. **内层米白纸张区域**
   - 位于画面中央
   - 使用撕纸边缘或手工剪纸边缘
   - 留出明显橙色边框

3. **浅网格纸纹理**
   - 米白纸张内叠加非常淡的方格纸纹
   - 不能过深，否则影响文字可读性

### 2.3 边缘质感

- 内层纸张边缘建议使用：
  - 撕纸边
  - 毛边
  - 不规则白色边
  - 轻微阴影
- 不要做成规整硬边矩形，否则会丢失手账感。

---

## 3. 色彩系统

### 3.1 主色

| 用途 | 建议颜色倾向 | 说明 |
|---|---|---|
| 主强调色 | 暖橙 / 橘橙 | 用于边框、重点标签、按钮、强调词 |
| 背景色 | 米白 / 奶油白 | 用于主纸张区域 |
| 主文字 | 黑色 / 深灰黑 | 用于标题和主要正文 |
| 辅助强调色 | 深绿 / 青绿色 | 用于对比卡片、正向信息、解释型模块 |
| 高亮色 | 暖黄 / 浅橙黄 | 用于标题下划线、关键词高亮、贴纸底色 |

### 3.2 色彩使用原则

- 一页内不要使用过多颜色。
- 主体保持：**橙 + 米白 + 黑 + 绿 + 少量黄**。
- 橙色负责热度和吸引力。
- 绿色负责稳定、解释、建议、理性信息。
- 黄色只用于局部高亮，不要大面积铺满。
- 避免科技感过重的蓝紫霓虹、深色赛博背景、金属质感。

---

## 4. 字体与文字层级

### 4.1 字体风格

- 主标题：粗黑、厚重、强冲击力
- 副标题：中粗，放在橙色圆角胶囊内
- 正文：清晰、略圆润、适合移动端阅读
- 英文：只作为小标签或装饰性信息，不要喧宾夺主

### 4.2 层级规范

每页建议包含以下层级：

1. **主标题**
2. **副标题胶囊**
3. **核心内容区**
4. **强调语 / 转折语**
5. **底部 Key Point 总结条**

### 4.3 标题长度

- 主标题尽量控制在 1–2 行。
- 每行不宜太长。
- 标题宁可短、准、有力，也不要完整复述正文。
- 避免标题过大导致画面头重脚轻。

### 4.4 英文元素使用

可保留少量英文小标签，用于增加专业感，例如：

- `Quick Guide`
- `Key Point`
- `Tips`
- `Checklist`

注意：英文只作为视觉辅助，不承担主要信息表达。

---

## 5. 固定视觉组件

为了让系列图看起来统一，以下组件应尽量固定。

### 5.1 左上角呼吸区

位置：左上角。
样式：

- 保持自然留白或只使用少量手绘点线装饰
- 不绘制页码、编号徽章、贴纸编号或分页标签
- 不放置正文重点、图标主体或结论文字

注意：系列顺序通过文件名和 manifest 记录，不在画面中绘制页码。

### 5.2 右上角功能标签

位置：右上角。  
组成：

- 三个小圆点：黄 / 橙 / 红
- 一个贴纸式小标签：`Quick Guide`
- 小星星或线条装饰

作用：提升系列感和笔记封面感。

### 5.3 副标题胶囊

位置：主标题下方。  
样式：

- 橙色圆角胶囊
- 黑色文字
- 可有轻微描边或阴影

用途：承接主标题，补充一句核心判断。

### 5.4 圆角内容卡片

卡片是核心信息承载组件。

统一规范：

- 圆角较大
- 细虚线 / 缝线式描边
- 背景可为米白、浅绿、浅橙
- 卡片内部使用图标 + 短句
- 不要大段正文

### 5.5 高亮条 / 撕纸强调条

用于页面中部的关键转折。

常见形式：

- 白色撕纸条 + 黄色高亮线
- 橙色胶囊 + 黑字
- 粗黑句子 + 局部黄色底纹

适合承载：

- 核心结论
- 转折判断
- 关键区别
- 记忆点

### 5.6 底部 Key Point 总结条

每页底部建议保留统一总结条。

样式：

- 横向圆角长条
- 左侧可有星星、灯泡等小图标
- 右侧可放一个表情贴纸
- `Key Point:` 使用橙色
- 关键词可用绿色或橙色强调
- 下方可加一行小字解释

作用：形成系列统一收口，也方便用户收藏。

### 5.7 表情贴纸

建议在底部右侧使用一个友好表情：

- 微笑
- 眨眼
- 轻松夸张但不幼稚

注意：表情是点缀，不要让它抢走主体信息。

---

## 6. 图标与插画风格

### 6.1 图标风格

统一使用：

- 扁平化
- 圆润
- 轻阴影
- 贴纸感
- 颜色简洁

避免：

- 复杂 3D
- 金属质感
- 赛博霓虹
- 过度写实
- 杂乱 emoji 堆叠

### 6.2 常用图标类型

可根据新内容自由替换，但风格要统一。

常用类别：

- 对话气泡
- 文件夹
- 文档
- 清单
- 放大镜
- 箭头
- 勾选
- 警告
- 灯泡
- 星星
- 贴纸胶带
- 手指指向
- 小机器人或助手形象

### 6.3 插画使用原则

- 插画服务于信息，不做纯装饰。
- 场景插画不要太写实，建议用简化图标组合表达。
- 若画面有多个小图标，要用标签、虚线、箭头组织关系。
- 图标之间留足空间，避免像素材堆砌。

---

## 7. 版式结构模板

以下是可复用的页面结构类型。接手方可根据具体内容选择组合，不应每一页都用完全相同结构。

---

### 7.1 封面型

适合：系列第 1 页、总主题导入。

结构：

```text
左上角自然留白          Quick Guide 标签

大标题
副标题胶囊

左侧模块       VS / 箭头       右侧模块

底部 Key Point 总结条
```

特点：

- 标题强
- 对比明确
- 适合建立第一眼吸引力

---

### 7.2 澄清误解型

适合：解释为什么某两个概念容易混淆。

结构：

```text
大标题
副标题胶囊

“为什么容易混淆？”圆角卡片
- 共性 1
- 共性 2
- 共性 3

中部强转折高亮条

下方对比卡片 / 重点判断

底部 Key Point
```

注意：中间小节标题不要强行加小节编号，除非整页明确需要编号系统。

---

### 7.3 场景痛点型

适合：把抽象概念落到日常场景。

结构：

```text
大标题
副标题胶囊

大场景卡片
- 场景图标 / 小标签 / 混乱感或问题感
- 一句场景说明

中部关键痛点高亮条

左：表面问题 / 常见方法
右：真实困难 / 判断成本

底部 Key Point
```

特点：

- 代入感强
- 图标可以更丰富
- 适合小红书用户快速产生共鸣

---

### 7.4 方法建议型

适合：说明某个对象、工具、方法能提供什么帮助。

结构：

```text
大标题
副标题胶囊

上方示例问答 / 场景输入卡片

中部结论高亮条

下方清单卡片
- 建议 1 + 小字解释
- 建议 2 + 小字解释
- 建议 3 + 小字解释
- 建议 4 + 小字解释

侧边提醒卡片

底部 Key Point
```

特点：

- 信息更清单化
- 适合“能做什么 / 不能做什么”类页面

---

### 7.5 流程推进型

适合：说明一件事如何被连续推进。

结构：

```text
大标题
副标题胶囊

上方：目标输入 + 流程图

中部：核心能力高亮条

下方：
左侧较大卡片：可能会做的事
右侧提醒卡片：不能乱来的事
中间小圆章：执行 / 推进 / 重点

底部 Key Point
```

重点：

- 这一页要和方法建议型区分开。
- 多用流程节点、箭头、进度条、编号圆点。
- 不要做成普通左右对称对比页。

---

### 7.6 最终总结型

适合：系列最后一页。

结构：

```text
大标题
副标题胶囊

一句话总结横向流转图
左模块  →  右模块

“什么时候更适合用？”
两个错位卡片 / 贴纸卡片

小提示条

底部 Key Point
```

特点：

- 比较完整收束
- 可加入记忆口诀
- 适合增强收藏价值

---

## 8. 组件统一规则

这是最重要的系列一致性原则。

### 8.1 保持统一的组件，不等于每页照搬结构

应统一：

- 背景
- 色彩
- 右上角标签
- 圆角卡片
- 虚线描边
- 高亮方式
- 底部 Key Point
- 图标风格

可以变化：

- 页面主体结构
- 卡片数量
- 内容排列方向
- 是否使用流程图
- 是否使用对比结构
- 插画大小与位置

这样既能形成系列感，又不会让每一页看起来重复。

### 8.2 内容决定结构

不要为了统一而强行使用同一种布局。  
不同类型内容应选择不同版式：

- 对比内容：用左右对比
- 过程内容：用流程图
- 场景内容：用大插画卡片
- 建议内容：用清单卡片
- 总结内容：用流转图 + 适用场景

### 8.3 不要让画面头重脚轻

常见问题：标题太大，中下部分太空。

解决方式：

- 标题控制在合理大小
- 中部加入高亮转折条
- 下方卡片增加小字解释
- 底部 Key Point 保持足够分量
- 插画和清单在视觉上分布均匀

---

## 9. 文案放置规范

### 9.1 单页文案密度

建议：

- 主标题：1 句
- 副标题：1 句
- 主体信息：3–6 个短点
- 高亮结论：1 句
- 底部总结：1 句 + 1 行小字

### 9.2 用短句，不用长段落

每个卡片里尽量使用：

```text
短标题
一行解释
```

或：

```text
图标 + 短句
小字补充
```

避免把文章正文直接塞进图里。

### 9.3 强调词控制

一页内重点词不要太多。  
建议每页只突出 1–2 个关键词。

常用强调方式：

- 黄色笔刷下划线
- 橙色胶囊
- 绿色 / 橙色关键词
- 撕纸条

---

## 10. 通用生图 Prompt 模板

接手方可复制以下模板，并替换方括号中的内容。

```text
Create a vertical 3:4 Xiaohongshu-style knowledge-card infographic in Simplified Chinese.

Visual style:
Warm orange outer border, cream torn-paper inner canvas, subtle grid-paper background, bold black headline typography, rounded cards, stitched/dotted borders, orange subtitle pill, green/orange accent color system, yellow highlight strokes, playful but clean sticker-like icons, small doodle accents, bottom Key Point strip, friendly winking emoji sticker at the bottom-right. The design should feel like a warm, polished Xiaohongshu knowledge note, not a cold tech poster.

Fixed components:
- No page number badge; keep the top-left area naturally open or lightly decorated
- Top-right small sticker label: Quick Guide
- Three small colored dots near the top-right
- Main title: [MAIN_TITLE]
- Subtitle pill: [SUBTITLE]
- Bottom Key Point strip with one main takeaway and one smaller supporting line

Page layout type:
[CHOOSE ONE: cover comparison / misconception clarification / scenario pain point / method list / workflow process / final summary]

Main content:
[INSERT PAGE-SPECIFIC CONTENT HERE]

Design requirements:
- Keep text concise and readable.
- Use large bold titles but avoid a top-heavy layout.
- Use rounded cards and consistent icon style.
- Use orange for emphasis and green for explanatory or supportive modules.
- Keep all icons flat, friendly, rounded, and sticker-like.
- Avoid cyberpunk, neon, dark background, metallic 3D, dense paragraphs, and inconsistent icons.
```

---

## 11. 分页生成 Prompt 骨架

以下骨架只描述版式，不包含具体主题内容。

### 11.1 第 1 页：封面型

```text
Page [01]. Create a cover page.
Use a bold main title, one orange subtitle pill, and a central left-right comparison structure.
Left card: [OBJECT_A] + [SHORT_DESCRIPTION_A]
Right card: [OBJECT_B] + [SHORT_DESCRIPTION_B]
Center: circular VS badge or arrow.
Bottom Key Point: [ONE_SENTENCE_TAKEAWAY]
```

### 11.2 第 2 页：澄清误解型

```text
Page [02]. Create a misconception clarification page.
Top title: [TITLE]
Subtitle: [SUBTITLE]
Upper card heading: [WHY_CONFUSING_HEADING]
Show 3 compact commonality items with icons.
Middle highlight strip: [REAL_DIFFERENCE]
Lower section: two comparison cards or key distinction cards.
Bottom Key Point: [TAKEAWAY]
```

### 11.3 第 3 页：场景痛点型

```text
Page [03]. Create a scenario pain-point page.
Top title: [TITLE]
Subtitle: [SUBTITLE]
Large scenario card with scattered icons and labels representing the situation.
Middle highlight strip: [REAL_BLOCKER]
Bottom two cards:
Left: [SURFACE_PROBLEM_OR_METHOD]
Right: [REAL_DIFFICULTY]
Center small badge: [KEY_LABEL]
Bottom Key Point: [TAKEAWAY]
```

### 11.4 第 4 页：方法建议型

```text
Page [04]. Create a method/advice explanation page.
Top title: [TITLE]
Subtitle: [SUBTITLE]
Upper scenario/prompt card: [USER_INPUT_OR_CONTEXT]
Main card: [METHOD_LIST] with icons and short sublines.
Side reminder card: [LIMITATION_OR_NOTE]
Middle highlight: [WHAT_THIS_PAGE_OBJECT_IS_GOOD_AT]
Bottom Key Point: [TAKEAWAY]
```

### 11.5 第 5 页：流程推进型

```text
Page [05]. Create a workflow/process page.
Top title: [TITLE]
Subtitle: [SUBTITLE]
Upper card:
Left: [GOAL_INPUT]
Right: [PROCESS_FLOW] with 4–6 numbered steps and arrows.
Middle highlight strip: [PROCESS_CORE_MESSAGE]
Lower asymmetric cards:
Large card: [WHAT_IT_CAN_DO]
Warning card: [WHAT_REQUIRES_CAUTION]
Small center badge: [ACTION_LABEL]
Bottom Key Point: [TAKEAWAY]
```

### 11.6 第 6 页：最终总结型

```text
Page [06]. Create a final summary page.
Top title: [TITLE]
Subtitle: [SUBTITLE]
Middle section heading: [ONE_SENTENCE_SUMMARY]
Show left-to-right progression:
[OBJECT_A] -> [OBJECT_B]
Below: [WHEN_TO_USE_HEADING]
Use two staggered cards for different use cases.
Add a small tip strip: [PRACTICAL_USAGE_TIP]
Bottom Key Point: [FINAL_TAKEAWAY]
```

---

## 12. 负面约束 / 避免事项

生成时应明确避免：

- 深色赛博背景
- 蓝紫霓虹科技风
- 复杂玻璃拟态
- 过度 3D 和金属质感
- 过多渐变
- 文字过小
- 大段正文堆叠
- 每页结构完全复制
- 图标风格混乱
- 色彩过多
- 标题过长
- 过度拟人化表情
- 过多 emoji
- 像企业 PPT 模板
- 像网页落地页
- 像硬核技术架构图

---

## 13. 出图检查清单

每张图生成后，检查以下问题：

### 13.1 系列一致性

- 是否保留橙色外框？
- 是否保留米白纸张和撕纸边？
- 是否有浅网格背景？
- 是否没有页码徽章、编号贴纸或分页标签？
- 右上角标签是否统一？
- 底部 Key Point 是否统一？
- 图标风格是否统一？

### 13.2 单页可读性

- 主标题是否一眼能看懂？
- 副标题是否补充了判断？
- 中间是否有清晰视觉重点？
- 文字是否过密？
- 小字在手机上是否可读？
- 画面是否头重脚轻？

### 13.3 内容适配性

- 版式是否符合当前内容类型？
- 是否为了统一而强行套模板？
- 是否出现与当前主题无关的固定案例？
- 是否保留了不该出现的旧内容？
- 是否有内容污染或主题串台？

### 13.4 视觉完成度

- 颜色是否克制？
- 高亮词是否过多？
- 卡片间距是否舒服？
- 装饰是否服务阅读？
- 表情和贴纸是否不过度抢戏？

---

## 14. 最简执行原则

给任何作图 AI / Agent 的一句话版本：

> 使用暖橙外框、米白撕纸网格背景、粗黑标题、橙色胶囊副标题、圆角虚线卡片、绿色/橙色信息模块、黄色高亮笔刷、统一图标贴纸、底部 Key Point 条和右下角友好表情，生成小红书知识笔记风格的竖版 3:4 系列图；具体内容全部由当前主题注入，不要复用旧案例或旧文案。
