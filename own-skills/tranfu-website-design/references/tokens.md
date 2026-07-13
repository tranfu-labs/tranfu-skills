# TranFu 设计 Token

当任务涉及颜色、字体排版、间距、圆角、图标尺寸、阴影、焦点状态或主题变量的创建、修改、评审与视觉 QA 时，应使用本参考。

本文件是 TranFu 基础视觉值与语义状态的权威来源。组件结构与使用场景以 `cards.md` 为准，响应式布局以 `responsive-layout.md` 为准；如具体数值存在冲突，以本文件定义的 Token 为准。

## 导航

- [Token 原则](#token-原则)
- [颜色 Token](#颜色-token)
- [字体排版 Token](#字体排版-token)
- [间距 Token](#间距-token)
- [圆角 Token](#圆角-token)
- [阴影与深度](#阴影与深度)
- [图标 Token](#图标-token)
- [状态 Token](#状态-token)

## Token 原则

- TranFu 的 Token 系统必须保持明亮、中性、系统化，并服务真实产品界面的信息层级与操作反馈。
- Brand Red 只用于 Logo、主操作、active / current、focus 和关键强调等品牌与交互信号；Error、Warning、Success 等语义状态不得默认复用 Brand Red、Featured Orange 或 Live Green，需要独立语义色时必须先定义对应的状态 Token。
- 不得引入与 Brand Red 争夺视觉焦点的高饱和主题色、大面积渐变表面、玻璃拟态、重阴影系统或纯装饰性色板。
- 新增视觉值前，必须先检查并复用现有 CSS 变量或主题 Token。现有 Token 无法覆盖时，应先定义具有明确语义、可复用且有使用边界的新 Token，不直接在组件中散落一次性原始值。

## 颜色 Token


| Token             | 值         | 用途                                      |
| ----------------- | --------- | --------------------------------------- |
| Brand Red         | `#E63A46` | Logo、主 CTA、active / current、focus 和关键强调 |
| Brand Red Hover   | `#D02E3A` | 主操作 hover                               |
| Brand Red Soft    | `#FEF2F3` | 主分类、选中和关键强调的低对比局部表面；不得作为 Error 表面 |
| Featured Orange   | `#FA5D19` | 最新、热门、推荐等运营型提示                          |
| Featured Orange Soft | `rgba(250, 93, 25, 0.10)` | 最新、热门、推荐等运营提示的低对比局部表面；不得作为 Warning 表面 |
| Live Green        | `#35C759` | 在线、运行中和 live 指示                         |
| Dark Badge        | `#2F2D2D` | `AI Agent OS` Badge 和深色紧凑标签             |
| Page Background   | `#F0F0F0` | 页面基础背景和中性控件底座                           |
| Section Surface   | `#F7F7F7` | 大区块、导航背景和 Section 表面                    |
| Secondary Surface | `#F5F5F5` | 次级标签、控件和局部内容表面                          |
| Soft Surface      | `#F2F2F2` | 低对比网格、背景变化和状态填充                         |
| Card Surface      | `#FFFFFF` | 卡片、面板和浮层基础表面                            |
| Selected Surface  | `#FFFFFF` | Tabs、分段控件等选中项表面                         |
| Utility Line      | `#E6E6E6` | 少量低对比分隔线；不作为默认卡片描边或焦点轮廓                 |
| Utility Contrast  | `#CFCFCF` | 低强调图标、装饰元素和辅助图形                         |
| Skeleton Line     | `#D9D9D9` | Skeleton、占位线和流式输出短线                     |
| Text Primary      | `#111111` | 强标题和主要正文                                |
| Text Secondary    | `#333333` | 导航、次级标题和高强调说明                           |
| Text Tertiary     | `#666666` | 元信息、辅助说明和次级正文                           |
| Text Muted        | `#777777` | 更弱的辅助信息和低优先级内容                          |
| Text Disabled     | `#999999` | 禁用、占位和非关键弱提示                            |
| Text Inverse      | `#FFFFFF` | 深色或品牌色表面上的反白文字                          |
| Focus Ring        | `#E63A46` | 关键交互控件的 `focus-visible` 轮廓              |


## 颜色规则

- `Page Background`、`Section Surface`、`Secondary Surface` 和白色表面构成 TranFu 的主导表面系统；页面层级优先通过这些中性色的对比建立。
- `Brand Red` 必须保持稀缺和聚焦，仅用于 Logo、主操作、active / current、focus 和关键强调。不得用于大面积背景、渐变、Hero 色洗、卡片墙或纯装饰色块。
- `Brand Red Soft` 只承载与 Brand Red 相同的品牌、选中或关键强调语义；不得把它当作通用错误背景。
- `Featured Orange Soft` 只承载运营型推荐语义；不得把它当作通用警告背景。
- 不得将 `1px solid #E6E6E6` 作为默认层级系统。优先使用表面对比、间距、分组、状态填充和内容结构建立层级；描边仅在分隔、可用性或状态表达必要时使用。
- `focus-visible` 应使用清晰的 Focus Ring Token，不使用低对比的 `Utility Line` 代替键盘焦点。
- Error、Warning、Success 等语义状态应保持局部、清楚且可解释。需要独立语义色时，必须先定义对应的状态 Token；不得默认将 Brand Red 等同于 Error、Featured Orange 等同于 Warning，或将 Live Green 等同于 Success，也不得让红色、橙色或绿色发展为页面级视觉主题。

## 字体排版 Token

TranFu 的字体系统分为「特殊展示文字」「标题文字」与「界面型文字」。

- 特殊展示文字使用 `Alimama_ShuHeiTi`，用于 Hero 品牌宣言和少量品牌展示内容，不计入 H1 标题层级。
- 标题文字包括 H1、H2、CTA 和 Section 标题，默认使用 `MiSans`，并根据 viewport 响应式调整字号。
- 界面型文字包括正文、按钮、导航、表单、菜单、元信息和标签，应优先保持稳定可读，不因移动端空间不足而随意缩小。
- 组件始终引用语义 Token，不直接选择 desktop、tablet 或 mobile Token。不同视口下的实际字号由 CSS 媒体查询自动切换。
- 移动端应优先通过重排、换行、减少列数和收敛间距解决空间问题，再调整特殊展示文字或标题字号。
- 特殊展示文字的最大字号不得超过 `48px`。

### 字体家族


| Token                   | 字体                 | 用途                    |
| ----------------------- | ------------------ | --------------------- |
| `--font-family-display` | `Alimama_ShuHeiTi` | Hero 特殊展示文字和少量品牌展示文字  |
| `--font-family-ui`      | `MiSans`           | 标题、正文、导航、按钮、表单和常规 UI  |
| `--font-family-system`  | `Hammersmith One`  | 英文 Badge、命令式短文本和代码感标签 |



### 基础字号

基础字号统一使用 `4px` 倍数，不新增非阶梯值。

| Token | 值 |
| --- | --- |
| `--font-size-12` | `12px` |
| `--font-size-16` | `16px` |
| `--font-size-20` | `20px` |
| `--font-size-24` | `24px` |
| `--font-size-28` | `28px` |
| `--font-size-32` | `32px` |
| `--font-size-36` | `36px` |
| `--font-size-40` | `40px` |
| `--font-size-44` | `44px` |
| `--font-size-48` | `48px` |


### 语义字体层级

字体 Token 按信息层级和阅读任务划分，不与特定页面模块或 HTML 标签强绑定。

| 层级 | 字体 | 桌面端 | 平板端 | 移动端 | 字重 | 行高 | 适用范围 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Brand Display | `Alimama_ShuHeiTi` | `48px` | `40px` | `32px` | `700` | `1.08–1.12` | 品牌宣言、核心概念和少量品牌展示文字 |
| Heading XL | `MiSans` | `48px` | `40px` | `32px` | `600` | `1.12–1.18` | 页面主标题、关键任务标题和重要转化标题 |
| Heading L | `MiSans` | `32px` | `32px` | `28px` | `600` | `1.2` | 一级内容区、产品能力和长页面章节标题 |
| Heading M | `MiSans` | `24px` | `24px` | `20px` | `600` | `1.3` | 面板、弹层、详情区、设置分组和独立模块标题 |
| Heading S | `MiSans` | `20px` | `20px` | `20px` | `600` | `1.4` | 卡片、列表项、表单分组和重复内容单元标题 |
| Body L | `MiSans` | `16px` | `16px` | `16px` | `400` | `1.8` | 正文、产品说明和连续阅读内容 |
| Body M | `MiSans` | `16px` | `16px` | `16px` | `400` | `1.6` | 紧凑说明、表格内容和列表补充信息 |
| UI Label L | `MiSans` | `16px` | `16px` | `16px` | `500` | `1.5` | 主要按钮、主导航、输入值和重要 Tabs |
| UI Label M | `MiSans` | `16px` | `16px` | `16px` | `500` | `1.4` | 菜单、筛选器、次级按钮、分页和紧凑控件 |
| Supporting Text | `MiSans` | `12px` | `12px` | `12px` | `400` | `1.6` | 元信息、时间、来源、辅助说明和字段提示 |
| Label | `MiSans` | `12px` | `12px` | `12px` | `500` | `1.4` | 标签、Badge、状态、计数和短属性说明 |
| Micro | `MiSans` | `12px` | `12px` | `12px` | `400` | `1.4` | 非关键角标、极短计数和紧凑辅助信息 |
| System Text | `Hammersmith One` | `16px` | `16px` | `16px` | `400` | `1.4` | 模型名、系统状态、技术属性和命令式短文本 |
| Brand Label | `Hammersmith One` | `12px` | `12px` | `12px` | `400` | `1.4` | 品牌说明、产品系列、版本和英文标识 |



### 响应式 Token 实现

```css
:root {
  /* Font families */
  --font-family-display: "Alimama_ShuHeiTi", sans-serif;
  --font-family-ui: "MiSans", sans-serif;
  --font-family-system: "Hammersmith One", sans-serif;

  /* Primitive font sizes: 4px scale */
  --font-size-12: 12px;
  --font-size-16: 16px;
  --font-size-20: 20px;
  --font-size-24: 24px;
  --font-size-28: 28px;
  --font-size-32: 32px;
  --font-size-36: 36px;
  --font-size-40: 40px;
  --font-size-44: 44px;
  --font-size-48: 48px;

  /* Mobile-first semantic tokens */
  --font-brand-display: var(--font-size-32);

  --font-heading-xl: var(--font-size-32);
  --font-heading-l: var(--font-size-28);
  --font-heading-m: var(--font-size-20);
  --font-heading-s: var(--font-size-20);

  --font-body-l: var(--font-size-16);
  --font-body-m: var(--font-size-16);

  --font-ui-label-l: var(--font-size-16);
  --font-ui-label-m: var(--font-size-16);

  --font-supporting: var(--font-size-12);
  --font-label: var(--font-size-12);
  --font-micro: var(--font-size-12);

  --font-system-text: var(--font-size-16);
  --font-brand-label: var(--font-size-12);

  /* Line heights */
  --line-height-brand-display: 1.12;
  --line-height-heading-xl: 1.16;
  --line-height-heading-l: 1.2;
  --line-height-heading-m: 1.3;
  --line-height-heading-s: 1.4;
  --line-height-body-l: 1.8;
  --line-height-body-m: 1.6;
  --line-height-ui-l: 1.5;
  --line-height-ui-m: 1.4;
  --line-height-supporting: 1.6;
  --line-height-label: 1.4;
}

@media (min-width: 768px) {
  :root {
    --font-brand-display: var(--font-size-40);

    --font-heading-xl: var(--font-size-40);
    --font-heading-l: var(--font-size-32);
    --font-heading-m: var(--font-size-24);
    --font-heading-s: var(--font-size-20);

    --line-height-brand-display: 1.1;
    --line-height-heading-xl: 1.14;
  }
}

@media (min-width: 1280px) {
  :root {
    --font-brand-display: var(--font-size-48);

    --font-heading-xl: var(--font-size-48);
    --font-heading-l: var(--font-size-32);
    --font-heading-m: var(--font-size-24);
    --font-heading-s: var(--font-size-20);

    --line-height-brand-display: 1.08;
    --line-height-heading-xl: 1.12;
  }
}
```

### 字号阶梯规则

- 所有字号必须使用 `4px` 倍数，当前允许值为：`12 / 16 / 20 / 24 / 28 / 32 / 36 / 40 / 44 / 48px`。
- 不新增 `11px`、`14px`、`18px`、`22px`、`26px`、`30px` 等非阶梯字号。
- 移动端最小字号为 `12px`；重要说明、控件文字和正文不得低于 `16px`。
- 当两个语义层级使用相同字号时，应通过字重、行高、颜色、位置和间距区分。
- 不为了制造层级临时新增一次性字号。
- `48px` 是桌面展示字号上限。

## 间距 Token

TranFu 的间距系统基于 `4px` 网格。组件应优先使用已有基础间距和语义间距，不在局部样式中新增一次性数值。

### 基础间距

| Token | 值 | 常见用途 |
| --- | ---: | --- |
| `--space-1` | `4px` | 图标与短文本、极紧凑状态元素 |
| `--space-2` | `8px` | 标签、图标、紧凑控件内部间距 |
| `--space-3` | `12px` | 卡片头部、字段、紧凑内容间距 |
| `--space-4` | `16px` | 默认组件内边距、控件组间距 |
| `--space-6` | `24px` | 模块内部、正文与元信息间距 |
| `--space-8` | `32px` | 内容分组、面板内部区域间距 |
| `--space-10` | `40px` | 重要内容组、图文模块间距 |
| `--space-12` | `48px` | 移动端 Section 纵向留白、较大模块间距 |
| `--space-16` | `64px` | 桌面安全边距、中等 Section 纵向留白 |
| `--space-20` | `80px` | 大型内容区和章节间距 |
| `--space-24` | `96px` | 桌面大型 Section 纵向留白 |

基础间距不要求连续覆盖所有 `4px` 倍数。只有在现有阶梯无法覆盖重复场景时，才新增新的基础 Token。

### 语义间距

- 卡片默认内边距：`16px`。
- 大型面板内边距：`24px` 或 `32px`。
- 紧凑控件、标签和图标间距：`8px`。
- 常规控件组间距：`12px` 或 `16px`。
- 正文、元信息和操作区间距：`16px` 或 `24px`。
- 独立内容分组间距：`24px`、`32px` 或 `40px`。
- 大型 Section 纵向内边距：桌面端 `80–96px`，平板端 `64px`，移动端 `48px`。
- Section 左右安全边距不在本节重复定义，以 `responsive-layout.md` 中的 Browser Header、Viewport Band 和 Content Rail 规则为准。

### 响应式语义 Token

间距采用 mobile-first。组件引用语义 Token，由 CSS 在不同断点自动调整实际值。

```css
:root {
  /* Primitive spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;

  /* Mobile-first semantic spacing */
  --space-section-block: var(--space-12);
  --space-section-gap: var(--space-10);
  --space-panel-inset: var(--space-6);
  --space-card-inset: var(--space-4);
  --space-content-group: var(--space-6);
  --space-control-group: var(--space-3);
  --space-inline-item: var(--space-2);
}

@media (min-width: 768px) {
  :root {
    --space-section-block: var(--space-16);
    --space-section-gap: var(--space-16);
    --space-panel-inset: var(--space-8);
    --space-content-group: var(--space-8);
    --space-control-group: var(--space-4);
  }
}

@media (min-width: 1280px) {
  :root {
    --space-section-block: var(--space-24);
    --space-section-gap: var(--space-20);
  }
}
```

### 间距规则

- 添加描边或阴影前，应优先通过间距、表面差异、内容分组和结构层级建立区分。

- 同一层级的组件应使用一致的间距 Token，不在相邻区域混用用途相同但数值接近的一次性间距。

- 重复卡片、列表行和同类组件必须保持尺寸与间距稳定。Hover、loading、selected、长标签和状态变化不得造成布局跳动或意外改变组件外部尺寸。

- 移动端应优先减少水平安全边距、收敛模块间距、减少列数，并对内容进行换行、堆叠或重排；不得为了容纳桌面布局，将正文、控件文字或辅助信息缩小到规定的可读下限以下。

- 大间距只用于章节分隔和重要内容节奏，不使用一次性巨大空白复刻固定设计稿或制造虚假的高级感。

## 圆角 Token

TranFu 圆角系统基于 `4px` 网格。圆角用于表达组件尺度、容器层级和交互形态，不通过一次性数值制造差异。

### 基础圆角

| Token | 值 | 主要用途 |
| --- | ---: | --- |
| `--radius-xs` | `4px` | 极小状态块、紧凑内部元素 |
| `--radius-sm` | `8px` | 标签、Badge、小按钮、菜单项、缩略图 |
| `--radius-md` | `12px` | 常规按钮、输入框、选中项、网格块和紧凑面板 |
| `--radius-lg` | `16px` | 卡片、筛选器、分段控件外壳、常规 CTA |
| `--radius-xl` | `24px` | 大型面板、弹层、Hero 内部媒体和重点容器 |
| `--radius-2xl` | `32px` | 产品截图容器、大型产品展示面板 |
| `--radius-3xl` | `40px` | Hero 主视觉外框和极少数大型品牌容器 |
| `--radius-full` | `9999px` | 状态点、圆形按钮、短装饰线和明确的胶囊结构 |

### 语义映射

- 小标签、小属性标签和紧凑 Badge：`--radius-sm`
- 常规按钮、输入框和分段控件选中项：`--radius-md`
- 卡片、筛选器、分段控件外壳和常规 CTA：`--radius-lg`
- 大型面板、对话框和重点内容容器：`--radius-xl`
- 产品截图和大型媒体容器：`--radius-2xl`
- Hero 主视觉外框：`--radius-3xl`
- 圆形或明确胶囊结构：`--radius-full`

### 局部圆角

当组件只需要顶部或单侧圆角时，应组合已有 Token，不新增一次性半径：

```css
.mediaPanel {
  border-radius:
    var(--radius-xl)
    var(--radius-xl)
    0
    0;
}
```


### 圆角规则

- TranFu 整体保持中等、克制的圆角风格。圆角用于表达组件尺度和容器层级，不作为装饰效果使用。

- 新增组件必须优先使用已定义的圆角 Token，不使用一次性数值，也不新增用途相近的圆角。

- 同一组件族应保持一致圆角。例如，同级卡片、按钮、输入框和菜单项不得因页面位置不同随意切换圆角。

- 大型容器通常可以使用比内部控件更大的圆角，但嵌套圆角必须保持清晰层级。父容器与子容器不应使用相同的大圆角形成卡片套卡片效果。

- 普通按钮、标签、输入框、卡片和面板不得默认使用 `full radius`。`--radius-full` 仅用于状态点、圆形按钮、头像、短装饰线或语义明确的胶囊结构。

- 标签和 Badge 只有在其形态明确需要胶囊表达时才使用 full radius；普通属性标签优先使用 `8px` 等中等圆角。

- 局部圆角应通过组合已有 Token 实现，例如只保留顶部圆角；不得为单侧、顶部或底部结构新增一次性圆角值。

- 圆角不能代替间距、表面差异、内容分组或交互状态。组件层级不清晰时，应优先调整结构，而不是继续放大圆角。

- 移动端默认保持按钮、输入框、标签和普通卡片的圆角不变。大型 Hero、产品截图或展示面板空间明显收窄时，可按既定 Token 向下收敛一级，不使用任意缩放值。

- 历史设计中的非阶梯值仅用于兼容既有页面，不得继续扩展到新组件；使用时应标记为继承值。

## 阴影与深度

TranFu 的层级优先通过表面色、间距、内容结构和状态填充建立。阴影只用于表达悬浮、交互反馈或临时前层关系，不作为默认卡片系统。

### 阴影 Token

| Token | 值 | 用途 |
| --- | --- | --- |
| `--shadow-none` | `none` | 默认卡片、面板、导航、标签和状态块 |
| `--shadow-hover` | `0 12px 32px rgba(17, 17, 17, 0.10)` | 普通卡片、按钮或可交互容器的 Hover |
| `--shadow-hover-strong` | `0 18px 48px rgba(17, 17, 17, 0.14)` | 资源卡、Skill 卡等明确前移的 Hover |
| `--shadow-popover` | `0 12px 32px rgba(17, 17, 17, 0.12)` | Menu、Popover、Dropdown、Tooltip |
| `--shadow-dialog` | `0 24px 64px rgba(17, 17, 17, 0.16)` | Dialog、Drawer 等模态前层 |

### 使用规则

- 默认卡片、面板、导航、状态块和标签不使用外描边，也不使用阴影。

- 阴影仅用于 Hover、Active、悬浮控件、菜单、Popover、对话框、抽屉或其他明确的前层界面。

- 资源卡、Skill 卡及同类信息卡片的 Hover 可使用 `--shadow-hover-strong`；普通卡片优先使用更轻的 `--shadow-hover`。

- Menu、Popover 和 Tooltip 使用轻量阴影表达与页面内容的悬浮关系；Dialog 和 Drawer 可以使用更高层级阴影，但不得形成厚重发光效果。

- Focus 状态不依赖阴影表达，应使用清晰的 `focus-visible` outline 或 Focus Ring Token。

- Selected / current 状态优先通过表面填充、字重、品牌色或位置标记表达，不默认增加阴影。

- Active / pressed 状态优先使用轻微位移、缩放或表面变化；避免在按下时突然出现重阴影。

- 同一界面不应混用多个接近但不一致的阴影值。新增阴影前应优先复用现有 Token。

- 不使用彩色阴影、外发光、多层重阴影或玻璃拟态阴影。

- 阴影不得改变组件尺寸，也不得在 Hover、Loading 或状态切换时造成布局跳动。

## 图标 Token

TranFu 的功能图标优先使用 Reicon，并保持统一的视觉语言、尺寸阶梯和交互状态。图标用于辅助识别功能、状态与操作，不替代文字说明或品牌标志。

### 图标尺寸

| Token | 值 | 主要用途 |
| --- | ---: | --- |
| `--icon-size-sm` | `16px` | 元信息、字段提示、状态、紧凑列表和行内图标 |
| `--icon-size-md` | `20px` | 按钮、输入框、菜单、Tabs 和常规导航控件 |
| `--icon-size-lg` | `24px` | 主要操作、卡片操作、独立图标按钮和高频入口 |
| `--icon-size-xl` | `32px` | 功能符号、空态图标和少量高强调视觉，不作为常规控件默认尺寸 |

### React/Vite 实际调用

Reicon 官方 React 包为 `reicon-react`。组件属性的精确写法为 `size={...}`、`color="..."` 和 `weight="Outline|Filled"`；`color` 默认继承 `currentColor`，`weight` 默认为 `Outline`。

优先使用直接导入，确保只加载实际图标：

```tsx
import Search from 'reicon-react/icons/Search';

export function SearchButton() {
  return (
    <button type="button" aria-label="搜索">
      <Search size={20} weight="Outline" aria-hidden="true" />
    </button>
  );
}
```

目标项目已统一使用包级命名导入时，可沿用官方写法：

```tsx
import { Home, Search, Bell } from 'reicon-react';

<Home size={24} weight="Outline" />
<Search size={20} />
<Bell size={24} weight="Filled" />
```

官方参考：

- 使用说明：`https://reicon.dev/usage`
- 面向模型的完整用法：`https://reicon.dev/llms-full.txt`
- 完整图标名与组件名映射：`https://reicon.dev/llms-icons.txt`

图标名不得凭记忆生成。实现前必须使用 Skill 自带的 `scripts/verify_reicon_icons.py` 针对目标项目已安装版本完成精确校验；官方在线映射只能用于未安装依赖时的候选选择。

### 使用规则

- TranFu UI 中新增的功能图标必须使用 Reicon；同一控件组已稳定使用其他图标库时保持一致，除非任务明确迁移。
- React / Vite 项目使用 `reicon-react`，只导入实际使用的图标，避免整库引入。
- 每个写入代码的 Reicon 组件名必须先通过 `verify_reicon_icons.py --exact <Name> --project <target> --require-installed` 校验；校验失败时不得猜测名称或生成近似导入。
- 默认使用 Outline 风格。Filled 仅用于 selected、active、current 或明确的高强调状态；同一控件在状态切换时应保持图形语义一致。
- 常规控件优先使用 `20px`；紧凑信息使用 `16px`；主要操作使用 `24px`。不得为相似场景随意新增一次性尺寸。
- 图标尺寸与点击热区必须分开处理。移动端可点击控件的热区至少为 `44 × 44px`，内部图标通常保持 `20–24px`，不应为扩大热区而同步放大图标。
- 图标默认继承 `currentColor`，跟随文字、状态和交互颜色变化。只有在线、错误、警告等已有语义 Token 明确要求时，才使用独立颜色。
- 图标与文字组合时必须保持视觉居中，并使用统一间距；常规间距为 `8px`，紧凑场景可使用 `4px`。
- 纯图标按钮必须提供 accessible name，例如 `aria-label`；不得仅依赖图形或颜色说明操作含义。
- 状态图标不得单独依赖颜色表达结果，应配合文字、位置、形状或状态说明。
- 找不到合适 Reicon 时，应优先选择语义最接近且已验证的现有图标；仍不合适时报告图标缺口，不得直接生成自定义 SVG。只有用户明确授权设计自定义功能图标时，才允许进入独立设计流程，并保持与 Reicon 一致的线宽、视图框、端点和视觉尺寸。
- 不使用表情符号、文字字符或风格不一致的图标库临时代替正式功能图标。
- 不使用图标库重绘、近似替代或变形 TranFu Logo 与其他品牌标志。

## 状态 Token

组件应根据自身功能定义适用状态，而不是机械覆盖全部状态。状态表达必须保持可预测、可辨认和尺寸稳定，不仅依赖颜色区分。

### 交互状态

| 状态 | Token 行为 |
| --- | --- |
| `default` | 使用中性表面和可读文字；默认不依赖外描边或阴影建立边界 |
| `hover` | 使用轻微表面变化、文字 / 图标对比增强或可选轻阴影；不得改变组件尺寸 |
| `active / pressed` | 使用按下态表面、轻微位移或缩放反馈；不默认使用品牌红 |
| `focus-visible` | 使用清晰且连续的 Focus Ring；不得被 hover、active 或 selected 状态覆盖 |
| `selected / current` | 使用选中表面、字重、位置标记、图标或品牌色信号表达当前状态 |
| `expanded / open` | 明确表示内容已展开或浮层已打开，并同步更新图标与可访问性状态 |
| `checked` | 使用勾选图标、填充、位置或文字表达已选择状态，不仅依赖颜色 |
| `indeterminate` | 明确表达部分选择状态，并与 checked / unchecked 保持区别 |
| `disabled` | 降低可操作感但保持内容可读；不响应 hover / active，也不得看起来仍可点击 |
| `read-only` | 保留内容可读与可选择，但不表现为可编辑控件 |

### 反馈与结果状态

| 状态 | Token 行为 |
| --- | --- |
| `loading` | 使用 spinner、skeleton、进度文本或局部占位；保持原有尺寸和布局稳定 |
| `empty` | 提供清楚标题、简短说明和可执行的下一步操作 |
| `error` | 说明原因、影响和恢复方式；使用局部语义色、图标和提示，不把整个区域刷红 |
| `warning` | 说明潜在风险和继续操作的后果；不默认复用运营橙色 |
| `success` | 使用局部确认、状态更新或短消息；不形成大面积绿色视觉主题 |
| `info` | 提供中性补充信息，不与主操作、错误或警告状态争夺注意力 |

### 状态使用规则

- 组件只需覆盖与其功能相关的状态。例如普通按钮不需要 `empty`，数据列表通常需要 `loading / empty / error`。
- Brand Red 仅用于主操作、focus、selected / current 和关键强调等明确场景，不自动用于所有 active、error 或危险状态。
- `focus-visible` 必须引用明确的 Focus Ring Token，不使用低对比分隔线代替键盘焦点。
- Hover、loading、selected、展开 / 折叠和文案变化不得改变组件外部尺寸或造成布局跳动。
- Selected / current、error、success 等状态不能仅依赖颜色，应结合字重、图标、文字、位置或形状表达。
- Disabled 与 read-only 必须区分：disabled 不可操作；read-only 不可编辑，但内容仍可阅读、选择或复制。
- Error、warning、success 和 info 如需独立语义色，必须先定义对应的状态 Token，不得直接复用 Brand Red、Featured Orange 或 Live Green。
