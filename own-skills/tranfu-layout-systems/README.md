# tranfu-layout-systems

为 TranFu 页面选择主布局系统、页面框架和页面模式，输出可被实现或评审流程直接消费的结构化布局产物。

## 什么时候用它

- 创建、修改或评审官网、SaaS、操作台、知识库、表单、向导和详情页。
- 需要先确定页面骨架、导航、主工作区、Section 顺序和移动端重排。
- 不用于纯视觉样式、Logo、Token 或组件外观调整。

## 同类 Skill 对比

> 由 tranfu-publish 起草，帮助阅读者横向决定使用哪个 Skill。

### 公司库内

- [tranfu-website-design](../tranfu-website-design/SKILL.md) — 落地 TranFu 品牌、组件和响应式实现；**本 Skill 区别**：只负责页面结构，是它的上游布局决策。
- [visual-pipeline](../visual-pipeline/SKILL.md) — 从已知内容推进高保真视觉方案；**本 Skill 区别**：先确定产品外壳、页面框架和任务模式。
- [ui-ux-pro-max](../../external-skills/ui-ux-pro-max/SKILL.md) — 提供通用 UI 风格与材料库；**本 Skill 区别**：输出 TranFu 专用布局 Schema。

### 外部世界

- 暂无。

### 本 skill 独特价值

- 三层模型区分系统、框架与页面模式。
- 决策和评审都有稳定命名产物。
- 调用守卫避免两个设计 Skill 循环。

## 使用技巧

> 由 tranfu-publish 根据本次验证整理，横向定位见上方同类对比。

### 材料方案

- 结构规则与视觉规则分开维护。
- 以用户主要活动代替页面名称猜测。

### 推荐用法

- 页面级任务先运行本 Skill。
- 提供路由、截图和同类页面基准。
- 只需判断时使用 `classify` 模式。

### 已知限制

- 不编辑代码或设计文件。
- 缺少主要活动时会追问一次。
- 未观察视口不会声明通过。
