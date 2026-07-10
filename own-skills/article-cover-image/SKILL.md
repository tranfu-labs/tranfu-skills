---
name: article-cover-image
display_name: Article Cover Image
display_name_zh: 文章封面图生成
description: >
  Use when the user provides a title or article and wants one horizontal article, content, video, PPT, or banner cover image, or a prompt for that cover image.
  Also trigger for Chinese phrasing such as 做个文章封面, 生成公众号封面, 视频封面, PPT 首页图, Banner 封面, 给这个标题配封面.
  Do NOT trigger when the user wants an icon or symbol; route to black-line-icon-style.
  Do NOT trigger when the user wants an infographic, knowledge card, comparison table, process diagram, long chart, or formal logo; route to the matching visual workflow.
  Do NOT trigger when the user only wants article copywriting, non-visual analysis, or a prompt unrelated to cover-image generation; route to the matching writing workflow.
version: 0.2.0
author: aquarius-wing
updated_at: 2026-07-10
origin: own
---

# Skill：article-cover-image
# 文章封面图｜默认 16:9｜主色 E63A46｜轻量多风格｜MiSans｜非塑料质感

## 0. 最高优先级规则

你的任务是：根据用户输入的标题或文章，直接生成一张横版文章封面图，默认比例为 16:9。

默认行为：

```text
直接调用图像生成能力出图
默认带标题文字
标题文字必须少
标题默认使用 MiSans 字体风格
整体视觉系统必须统一
主色固定使用 #E63A46
默认避免塑料感、玩具感、廉价 C4D 感
不要先输出大段分析
不要只输出 Prompt
```

只有用户明确要求：

```text
只要方案
只要 Prompt
先分析
不生成图
```

才输出文字方案。

### 0.1 适用边界与重定向

触发范围：

```text
用户给标题，或给标题 + 正文，并要求生成文章、内容、视频、PPT 首页或网站 Banner 类封面图。
默认输出一张横版封面图；默认比例 16:9，除非用户显式指定其它比例。
```

不触发范围：

```text
icon / 符号 / 黑白线性图标 → 转到 black-line-icon-style
信息图 / 知识卡片 / 对比表 / 流程长图 / 课程大纲图 → 转到专门的信息图或图表工作流
品牌正式 Logo 定稿 → 转到 logo 设计工作流或人工设计
只要文章文案 / 普通写作 Prompt / 非视觉分析 → 转到写作或 prompt 相关工作流
```

意图歧义处理：

```text
用户说“只要 Prompt”且目标是文章封面图 → 使用本 Skill 的文字模式，输出封面图生成 Prompt，不调用图像生成。
用户说“只要 Prompt”但目标是文章写作、营销文案或普通提示词 → 不触发本 Skill。
用户说“不生成图”但仍要求封面视觉方案 → 使用文字模式；如果完全不需要视觉产物 → 不触发本 Skill。
```

ownership：

```text
默认 ownership = edit/generate image：直接调用图像生成能力产出图片。
仅当用户显式说“只要 Prompt / 不生成图 / 先给方案”时，ownership = rewrite inline：只输出可复制的生成 Prompt 或方案，不生成图片。
```

完成标准：

```text
done = 产出一张封面图，且 §5.6 的 9 项自检全部通过。
若用户只要 Prompt，done = 输出 §11 主 Prompt + §12 Negative Prompt，且不调用图像生成。
```

### 0.2 主流程

CREATE A TODO LIST FOR THE TASKS BELOW（内部执行，不向用户展示）：

```text
1. 读取用户输入。若既没有标题，也无法从文章中提取主题 → 向用户索要标题并退出。
2. 识别输出模式。若用户显式要求“只要 Prompt / 不生成图 / 先分析” → 生成文字方案并结束；否则继续出图。
3. 提取原标题。若输入包含正文 → 用正文辅助理解主题，但正文不直接进入画面。
4. 生成短标题：若原标题包含解释、对比、流程、方法、教程或论证结构 → 执行子流程「复杂标题降维」；否则按 §4.1 压缩为短标题。
5. 选择风格：按 §8 路由到 §7.1 风格池；若没有明确命中 → 默认使用 B 现代产品 UI 风或 A 极简杂志风。
6. 确定单主体：按 §5.5 选择一个核心视觉主体；若标题含多个对象 → 先找单一视觉隐喻覆盖全部语义。
7. 拼接内部 Prompt：使用 §11 主 Prompt；若运行时支持 Negative Prompt → 附加 §12；否则按 §5.8 把关键负面约束写回主 Prompt。
8. 跑 §5.6 自检。若任一项不通过 → 按 §5.7 或 §5.8 纠偏后跳回第 5 步；若同一失败连续 2 次出现 → 降级为无字图或更抽象单主体方案后再试一次；仍失败 → 简短说明失败原因并结束，不宣称 done。
9. 调用图像生成能力产出封面图，简短回复结果，并结束。
```

子流程「复杂标题降维」：

```text
1. 识别标题类型：对比型 → §5.3；流程型 → §5.4；其它解释 / 方法 / 教程型 → §5.1。
2. 删除解释词、修饰词、副标题、括号内容和长句结构。
3. 只保留一个核心判断或一个核心对象。
4. 输出符合 §4.1 的短标题，并返回主流程第 5 步。
```

---

## 1. 视觉系统统一规则

所有封面必须属于同一个品牌视觉系统。

统一要素包括：

### 1.1 主色统一

```text
品牌主色：#E63A46
```

规则：

```text
主色必须在画面中出现
主色可用于标题强调、图形主体、装饰色块、UI 高亮、发光核心、几何元素、按钮式卡片等
不允许主色完全缺席
```

### 1.2 字体统一

```text
使用 MiSans-style Chinese typography
中文标题使用 MiSans Bold 或 MiSans SemiBold 风格
字体现代、干净、几何感、清晰可读
```

### 1.3 排版统一

```text
标题最多 2 行
优先左对齐
标题区域留白充足
标题不能贴边
标题不能被主体遮挡
```

### 1.4 图形语言统一

```text
保持轻量、现代、克制
使用干净几何形、柔和渐变、抽象图形、轻 UI 卡片、单个主体
优先使用平面 Editorial、纸感、雾面、磨砂、低反射的轻量质感
避免塑料感、玩具感、果冻感、充气感和廉价 C4D 素材感
避免复杂堆叠和廉价素材感
```

### 1.5 品质统一

```text
专业封面设计
清晰焦点
高级但不沉重
材质克制、低反射、非塑料
适合公众号、视频封面、PPT 首页、网站 Banner
```

### 1.6 去塑料感材质规则

默认禁止把封面做成高光塑料、玩具 3D、果冻树脂、充气软胶或廉价 C4D 渲染。

材质倾向：

```text
matte finish
low-reflective surface
paper-like texture
soft editorial shading
frosted glass only when very subtle
brushed metal only when restrained
matte ceramic only when premium and non-toy-like
flat vector with slight depth
clean 2.5D editorial object
```

避免材质：

```text
glossy plastic
shiny toy-like 3D
cheap C4D plastic render
jelly / gelatin look
transparent resin
rubber toy
inflated soft plastic
over-smooth rounded blob
strong specular highlights
wet reflective surface
```

立体元素规则：

```text
如需立体元素，优先 2.5D、哑光、低反射、轻阴影。
不要生成像玩具、塑料摆件、膨胀气球、果冻糖一样的主体。
不要用强高光、过度圆润、半透明树脂感来表现高级感。
更推荐纸张、卡片、磨砂金属、雾面玻璃、细腻陶瓷、平面几何与轻微空间层次。
```

---

## 2. 品牌色彩系统

### 2.1 主色

```text
Primary Color: #E63A46
```

使用方式：

```text
#E63A46 as brand accent color, used in key visual element, highlight shape, title emphasis, UI accent, abstract symbol, or central object
```

### 2.2 推荐辅助色

```text
暖白：#FFF7F3
浅粉：#FBE6E8
深红棕：#5A1F24
炭黑：#171717
暖灰：#F2EFEC
浅灰：#EAEAEA
深灰：#333333
```

### 2.3 色彩原则

必须保证：

```text
主色 #E63A46 是视觉识别核心
背景可以变化
风格可以变化
但整体品牌感要统一
标题必须清晰可读
不要使用过多高饱和杂色
不要让主色被其他强色抢走
```

推荐色彩方向：

```text
暖白背景 + E63A46 主体
浅灰背景 + E63A46 强调
深色背景 + E63A46 发光核心
米白背景 + 黑字 + E63A46 点缀
低饱和渐变 + E63A46 视觉锚点
```

---

## 3. 输入识别

用户可能输入：

```text
{标题}
```

或：

```text
标题：{标题}
```

或：

```text
标题：{标题}
文章：{正文}
```

只要能识别标题，就直接执行。

如果没有正文：

```text
基于标题自动推断主题、主体、风格、色彩和构图。
不要追问正文。
```

---

## 4. 封面文字规则：必须少

封面图里只允许出现：

```text
主标题
```

默认不出现：

```text
副标题
说明文字
标签
日期
作者名
栏目名
营销口号
长段文案
```

### 4.1 标题字数限制

中文标题控制规则：

```text
硬性上限：不超过 12 个汉字
推荐区间：4-10 个汉字
```

英文标题优先控制在：

```text
2-6 个单词
```

如果原标题过长，必须压缩。

压缩原则：

```text
保留关键词
保留观点
删除修饰词
删除解释性内容
删除括号内容
删除副标题
不要把整句标题全部塞进画面
```

示例：

```text
原标题：为什么 AI Agent 将成为下一代产品最重要的入口形态
封面标题：Agent 重构入口
```

```text
原标题：如何用统一视觉系统提升内容封面的品牌识别度
封面标题：统一视觉系统
```

---

## 5. 复杂标题降维与防信息图化规则

本 Skill 生成的是文章封面图，不是信息图、知识卡片、流程说明图、对比表、方法论长图、课程大纲图或说明型海报。

无论标题是否包含解释、对比、流程、方法、原因，都必须先把复杂语义压缩成一个封面短标题，并用一个核心视觉主体进行隐喻表达。

### 5.1 复杂标题降维规则

当用户输入的标题具有解释型、论证型、对比型、流程型或教程型特征时，必须先将原标题降维为一个适合封面展示的短标题。

这些标题通常包含：

```text
为什么
如何
怎么
……而不是……
A vs B
A 和 B 的区别
从……到……
入门到精通
完整路径
系统性方法
底层逻辑
默认工作流
复杂任务
自动化流水线
最佳实践
```

处理原则：

```text
原标题只用于理解主题，不直接进入封面画面。
封面图里只出现压缩后的短标题。
不要把完整原标题塞进图片。
不要为了表达完整语义而增加说明文字、标签、表格或小字。
```

短标题规则：

```text
只保留一个核心判断或一个核心对象
标题长度遵守 §4.1，不另设第二套字数上限
删除“为什么 / 如何 / 怎么 / 而不是 / 区别 / 原因 / 说明 / 完整路径”等解释性词
删除副标题、括号内容、修饰语和长句结构
标题最多 2 行
优先左对齐
保持清晰、克制、有封面感
```

示例：

```text
原标题：为什么复杂任务的默认工作流应该写在 AGENTS.md 而不是某个 Skill 里
封面标题：AGENTS.md 优先
```

```text
原标题：基于 Cursor + Git Worktree 的多 Agent 自动化串行流水线
封面标题：多 Agent 流水线
```

```text
原标题：skill 入门到精通完整路径
封面标题：Skill 精通路径
```

```text
原标题：如何用统一视觉系统提升内容封面的品牌识别度
封面标题：统一视觉系统
```

### 5.2 防信息图化规则

禁止生成以下内容：

```text
表格
对比栏
VS 结构
左右双栏对照
多个说明卡片
多个标签
多个步骤节点
清单列表
Bullet points
结论栏
底部总结条
长句解释
小字说明
多段文案
多块文字
多个标题层级
```

画面文字只允许出现：

```text
一个短主标题
```

默认不允许出现：

```text
副标题
说明文字
标签
日期
作者
栏目名
营销口号
阶段名称
流程节点文字
结论文案
```

### 5.3 对比型标题处理规则

当标题包含以下结构时：

```text
A 而不是 B
A vs B
A 和 B 的区别
为什么选 A 不选 B
为什么 A 比 B 更适合
A 替代 B
A 优先于 B
```

必须避免生成对比图。

处理方式：

```text
1. 提取主张中的优先对象 A。
2. 将封面标题压缩为“A 优先”或“A 归位”。
3. 画面主体只表现 A。
4. B 不出现，或仅作为弱化、模糊、不可读的背景隐喻。
5. 禁止出现 “VS” 字样。
6. 禁止出现 A/B 双栏结构。
7. 禁止出现解释性表格。
8. 禁止出现两套阵营式构图。
```

示例：

```text
原标题：为什么复杂任务的默认工作流应该写在 AGENTS.md 而不是某个 Skill 里
封面标题：AGENTS.md 优先
主体建议：一个红色 AGENTS.md 文件作为系统规则中枢，周围有抽象工作流线条或轻量节点，但节点不带文字。
禁止：VS、Skill 文件夹、对比表、说明文字、结论栏、底部总结条、多段解释。
```

### 5.4 流程型标题处理规则

当标题包含：

```text
流程
流水线
路径
步骤
从 A 到 B
入门到精通
完整方法
自动化链路
工作流
```

不要生成带大量步骤标签的流程图。

处理方式：

```text
可以使用抽象路径、阶梯、轨道、箭头、连续形体作为视觉隐喻。
不能给每个步骤添加文字标签。
不能生成多个带文字的节点卡片。
不能把封面做成课程目录或流程说明图。
```

示例：

```text
原标题：skill 入门到精通完整路径
封面标题：Skill 精通路径
主体：一个向上延展的红色阶梯或路径
禁止：入门、基础、进阶、提升、精通等多个步骤标签
```

```text
原标题：基于 Cursor + Git Worktree 的多 Agent 自动化串行流水线
封面标题：多 Agent 流水线
主体：一条红色发光流水线或轨道
禁止：Agent 1、Agent 2、需求分析、开发实现、测试验证、集成发布等标签文字
```

### 5.5 单主体强化规则

每张封面只能有一个核心视觉主体。

允许：

```text
一个文件图标
一个抽象中枢
一条路径
一个非塑料立体图标
一个发光核心
一个界面卡片
一个抽象装置
一个隐喻物
```

禁止：

```text
多个主体并列
两个阵营对抗
多个卡片同时作为主体
多个文件夹对比
多个机器人角色
多个步骤节点堆叠
复杂故事场景
信息密集型画面
```

如果标题里出现多个对象：

```text
优先选择最能覆盖全部对象的单一视觉隐喻：流水线 / 路径 / 中枢 / 装置 / 发光核心 / 抽象图形。
如果没有合适隐喻，再选择标题中的第一核心关键词作为主体。
不要把语义等权的多个对象画成并列主体。
其他对象只能作为弱化背景元素，且不能出现可读文字。
```

### 5.6 封面生成前的内部检查与完成标准

生成图片前必须完成以下检查：

```text
1. 是否已将原标题压缩为短标题？
2. 图片里是否只会出现一个短主标题？
3. 是否删除了所有副标题、说明文字、标签和步骤文字？
4. 是否避免了表格、VS、对比栏、清单和结论栏？
5. 是否只有一个核心视觉主体？
6. #E63A46 是否会明确出现？
7. 标题是否使用 MiSans-style Chinese typography？
8. 是否避免了塑料感、玩具感、果冻感、充气感和强反光高光？
9. 是否仍然是一张文章封面，而不是信息图？
```

如果任意一项不满足，必须重新简化构图。

```text
done = 上述 9 项全部通过，并且最终产物是一张封面图。
如果任一项为“否”，不能宣称完成；必须按 §5.7 或 §5.8 纠偏后重新生成。
```

### 5.7 失败案例纠偏规则

如果生成结果出现以下情况，视为失败：

```text
出现超过一个主标题
出现副标题或解释文字
出现多个标签
出现表格
出现 VS
出现对比栏
出现清单
出现底部结论条
出现多个步骤节点文字
出现多个主体并列
画面像信息图而不是封面
```

纠偏方式：

```text
重新生成时必须进一步压缩标题。
删除所有说明文字。
删除所有节点标签。
删除表格和对比结构。
只保留一个主体。
将复杂语义转为抽象隐喻。
```

纠偏示例：

```text
错误方向：
AGENTS.md vs Skill 对比表 + 多行解释 + 底部结论

正确方向：
短标题「AGENTS.md 优先」
一个红色 AGENTS.md 文件中枢
抽象工作流线条
无 VS
无 Skill 可读文字
无说明文字
无表格
无结论栏
```

### 5.8 运行时失败路径

当图像模型或调用方式不完全支持本 Skill 的约束时，按以下路径降级：

```text
中文标题乱码 / 伪中文 / 错字 → 进一步压缩标题；若仍失败，改用支持中文文字渲染的模型，或先生成无字图并保留文字安全区。
Negative Prompt 被忽略 → 把关键负面规则写回主 Prompt：not an infographic, no subtitle, no labels, no table, no VS, one main visual subject, matte non-plastic surface。
MiSans 不可精确指定 → 改写为 geometric sans-serif similar to MiSans, clean readable Chinese typography。
模型持续生成信息图 → 回到 §5.1 缩短标题，并把主体改为单一抽象隐喻。
模型持续生成塑料感 → 回到 §11，明确 matte finish, paper-like texture, low-reflective editorial surface。
```

---

## 6. MiSans 字体规则

标题文字默认使用 MiSans 字体风格。

字体要求：

```text
MiSans-style Chinese typography
modern sans-serif
geometric
clean
compact but readable
accurate readable Chinese title text
```

字重规则：

```text
主标题：MiSans Bold 或 MiSans SemiBold
短标题 / 强观点：MiSans Bold
理性分析类标题：MiSans SemiBold
```

排版规则：

```text
标题最多 2 行
优先左对齐
行距紧凑但可读
字间距略微收紧
标题区域留白充足
标题不能贴边
标题不能被主体遮挡
标题不能变成乱码、伪中文或错误汉字
```

生成 Prompt 中必须包含：

```text
use clean MiSans-style Chinese typography, bold modern sans-serif, accurate readable Chinese title text
```

Negative Prompt 中必须包含：

```text
too much text, long paragraph, subtitle, small text, fake Chinese characters, unreadable typography, distorted text
```

---

## 7. 风格多样化规则

视觉系统要统一，但风格不能单一。

不要每次都使用：

```text
深蓝科技风
黑金商务风
发光球体
右侧主体左侧标题
数据流背景
```

必须根据标题语义，在统一品牌色 #E63A46 的前提下选择合适风格。

### 7.1 风格池

#### A. 极简杂志风

适合：观点、认知、商业评论、个人成长

```text
大留白
暖白或浅灰背景
一个隐喻主体
高级杂志排版
#E63A46 作为小面积强调色
```

#### B. 现代产品 UI 风

适合：产品、设计、工具、方法论、工作流

```text
轻量界面卡片
柔和渐变
悬浮 UI
清爽明亮
#E63A46 用作按钮、选中态、高亮线条
```

#### C. 电影感隐喻风

适合：思考、选择、趋势、长期主义、人生主题

```text
单点光源
人物剪影或抽象物
空间感
情绪克制
#E63A46 作为光源或核心符号
```

#### D. 年轻潮流插画风

适合：小红书、生活方式、轻知识、年轻化内容

```text
大胆色块
简洁插画
轻松活泼
图形化主体
#E63A46 作为主色块
```

#### E. 高级商业 Editorial 风

适合：增长、战略、品牌、创业、商业分析

```text
商业杂志封面感
克制高级
结构化图形
数据隐喻
#E63A46 作为关键商业图形色
```

#### F. 柔和立体图标风（非塑料）

适合：工具、教程、清单、效率、互联网内容

```text
单个非塑料立体图标主体
哑光纸感、雾面陶瓷、磨砂金属或低反射材质
浅色背景
轻微体积感与柔和阴影
简洁易懂
#E63A46 用于主体色、图形色或局部高亮
禁止 glossy plastic、玩具 3D、果冻树脂、充气软胶和强反光高光
```

#### G. 抽象艺术风

适合：趋势、认知、哲学、复杂概念

```text
抽象几何
渐变形体
符号化表达
高级感
#E63A46 作为核心抽象形体
```

#### H. 科技未来风

适合：AI、大模型、Agent、机器人、自动化、算法

```text
深色或浅色未来空间
发光核心
数字粒子
未来感
#E63A46 作为发光核心或能量线
```

注意：

```text
即使是科技未来风，也不要默认深蓝。
可以使用深灰、炭黑、暖白、浅灰作为背景，让 #E63A46 成为识别锚点。
```

---

## 8. 风格选择逻辑

根据标题关键词选择风格：

```text
AI / Agent / 大模型 / 自动化 / 算法
→ H 科技未来风 或 B 现代产品 UI 风

产品 / 功能 / 体验 / 设计 / 工作流
→ B 现代产品 UI 风 或 F 柔和立体图标风（非塑料）

增长 / 商业 / 品牌 / 战略 / 创业
→ E 高级商业 Editorial 风 或 A 极简杂志风

认知 / 思考 / 选择 / 成长 / 长期主义
→ C 电影感隐喻风 或 G 抽象艺术风

趋势 / 未来 / 机会 / 变化 / 周期
→ G 抽象艺术风 或 C 电影感隐喻风

教程 / 方法 / 指南 / 清单 / 步骤
→ F 柔和立体图标风（非塑料） 或 B 现代产品 UI 风

年轻 / 情绪 / 生活 / 小红书
→ D 年轻潮流插画风
```

如果同一主题可以使用多种风格：

```text
优先选择更有差异化的一种
避免总是科技风
避免总是商务风
避免总是左文右图
```

---

## 9. 主体规则：只要一个

本节不维护第二套主体规则，所有主体判断以 §5.5 为唯一来源。

额外禁止：

```text
Logo
水印
签名
```

---

## 10. 构图规则

构图可以变化，但必须保持统一视觉秩序。

可选构图：

```text
左标题 + 右主体
居中大标题 + 背景主体
上方标题 + 下方主体
中心主体 + 角落标题
大留白标题区 + 小主体
杂志封面式上下结构
标题压左上 + 主体居中偏右
主体居中 + 标题底部留白区
```

必须保证：

```text
标题清晰
主体明确
画面不乱
16:9 横版
主色 #E63A46 明确出现
适合封面传播
```

---

## 11. 默认生成 Prompt 逻辑

生成图片时，内部 Prompt 必须包含：

```text
Create a 16:9 horizontal article cover image, not an infographic.
Include only one short readable Chinese title text: 「{短标题}」.
Use clean MiSans-style Chinese typography, bold modern sans-serif, accurate readable Chinese title text.
Use minimal text only. The image must contain no subtitle, no paragraph, no labels, no list, no table, no VS, no explanatory cards, no conclusion bar.
Use only one main visual subject.
If the original title contains comparison, reason, workflow, method, process, tutorial, or explanation, convert it into a symbolic editorial cover, not a diagram or infographic.
Use a unified brand visual system with primary color #E63A46.
Make #E63A46 clearly visible as the main accent color or key visual color.
Choose a visual style based on the topic, but keep the design lightweight, modern, restrained, and premium.
Avoid plastic-looking rendering: no glossy plastic, no shiny toy-like 3D, no cheap C4D plastic render, no jelly resin, no inflated rubber shapes, no excessive specular highlights. Prefer matte finish, low-reflective surfaces, paper-like texture, subtle frosted glass, restrained brushed metal, flat vector with slight depth, and soft editorial shading.
Professional editorial cover design, strong composition, clear focal point, clean layout, generous whitespace.
```

如果用户明确说“不加字 / 无字图”，才改为：

```text
Do not generate any text.
Leave a clean text-safe area.
Use a unified brand visual system with primary color #E63A46.
Avoid glossy plastic, toy-like 3D, jelly resin, inflated rubber shapes, and excessive specular highlights; prefer matte, paper-like, low-reflective editorial materials.
```

---

## 12. Negative Prompt

默认 Negative Prompt：

```text
too much text, long paragraph, subtitle, multiple text blocks, tiny text, unreadable typography, fake Chinese characters, wrong Chinese characters, distorted Chinese title, messy layout, cluttered background, multiple main subjects, extra objects, watermark, logo, signature, low quality, blurry, pixelated, cheap design, overcomplicated composition, same futuristic blue tech style every time, inconsistent brand color, missing primary color, too many colors, chaotic color palette, infographic, comparison chart, table, versus layout, VS text, two-column comparison, bullet list, checklist, step labels, explanatory cards, conclusion bar, bottom summary banner, multiple labels, workflow diagram with text labels, readable small text, dense information design, glossy plastic, plastic texture, shiny toy-like 3D, toy render, cheap C4D plastic render, resin material, jelly look, gelatin texture, transparent resin, rubber toy, inflated soft plastic, over-smooth rounded blob, excessive specular highlights, wet reflective surface, fake premium plastic
```

中文含义：

```text
文字太多，长段文字，副标题，多块文字，小字，不可读字体，伪中文，错误中文，标题变形，布局混乱，背景杂乱，多个主体，多余物体，水印，Logo，签名，低质量，模糊，像素化，廉价设计，构图过度复杂，每次都是同一种蓝色科技风，品牌色不一致，缺少主色，颜色过多，色彩混乱，信息图，对比图，表格，VS 布局，左右双栏对照，项目符号列表，清单，步骤标签，说明卡片，结论栏，底部总结条，多标签，带文字标签的流程图，可读小字，信息密集型设计，高光塑料，塑料质感，玩具 3D，廉价 C4D 塑料渲染，树脂材质，果冻质感，透明树脂，橡胶玩具，充气软胶，过度圆润的 blob，强烈镜面高光，潮湿反光表面，伪高级塑料感
```

---

## 13. 一键使用摘要

本节只保留派生摘要，不维护第二份完整规则。修改规则时只改前 12 节：

```text
单一来源：
- 执行顺序：§0.2 主流程
- 标题长度：§4.1
- 复杂标题降维与防信息图化：§5
- 字体与运行时文字失败处理：§6 与 §5.8
- 风格选择：§7.1 与 §8
- 主体规则：§5.5
- 主 Prompt：§11
- Negative Prompt：§12
- 完成标准：§5.6
```

需要给外部图像模型时，复制 §11 主 Prompt，并按运行时能力附加 §12 Negative Prompt；如果运行时不支持 Negative Prompt，就按 §5.8 将关键负面约束写回主 Prompt。

默认回复：

```text
已生成封面图，标题已压缩为「{短标题}」，使用 #E63A46 统一视觉系统、MiSans 风格标题排版与非塑料哑光质感。
```
