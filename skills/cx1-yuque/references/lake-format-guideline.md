# Lake 格式书写指南

> 从原 OpenAuth 技能移植的结构与设计参考，不是公网 API 的完整稳定规范。提交使用 `doc create/update --format lake --body-file FILE`（Open API 的 `body`）；不要使用内网 `body_asl` 参数。保留已有卡片编码与未知字段。新卡片须在 Chrome 验证渲染；API 回读相同只证明存储。

Lake 格式是语雀（Yuque）编辑器的富文本序列化格式，MIME 类型为 `text/lake`。它本质上是一个 **HTML 子集**，通过自定义 `<card>` 标签扩展，用于表示代码块、图片、公式等复杂内容。

Lake 不是自由的 HTML——它有严格的结构规则。只有遵循这些规则的内容才能被编辑器正确解析和渲染。

## 格式约定

| 规则 | 说明 |
|------|------|
| 单行格式 | 整个文档是一个连续字符串，生成时可不换行；不要为了格式化破坏原文 |
| 小写标签 | 所有标签名必须小写 |
| 双引号属性 | 属性值使用双引号：`data-lake-id="u0001"` |
| 自闭合标签 | 以 `/>` 结尾：`<br />`、`<meta ... />` |

> 本文档中的代码示例为了可读性做了换行和缩进，生成时建议保持连续结构；原文已有换行时无需删除。

## 文档结构

一个完整的 Lake 文档由三部分按顺序组成：

```
① <!doctype lake>                        （可选，文档类型声明）
② <meta name="..." content="..." /> ...  （可选，紧跟 doctype）
③ 正文内容                                （必需）
```

**最简文档**——只有正文：

```html
<p data-lake-id="u0001"><span data-lake-id="u0002">Hello World</span></p>
```

**完整文档**——带 doctype 和 meta：

```html
<!doctype lake><meta name="doc-version" content="1" /><meta name="typography" content="classic" /><p data-lake-id="u0001"><span data-lake-id="u0002">Hello World</span></p>
```

### Meta 字段

只有非默认值才需要写入。`doc-version` 固定写 `"1"`。

| 字段 | 可选值 | 默认值 |
|------|--------|--------|
| `doc-version` | `"1"` | — |
| `typography` | `"traditional"` / `"classic"` | `"traditional"` |
| `viewport` | `"fixed"` / `"adapt"` | 无 |
| `paragraphSpacing` | `"default"` / `"relax"` | `"default"` |
| `autoSpacing` | `"1"` / `"0"` | `"0"` |
| `defaultFontsize` | `"12"` ~ `"24"` | 无 |

## 节点 ID

每个元素都需要唯一 ID，这是 Lake 格式的核心要求。

- **普通元素**用 `data-lake-id` 属性
- **标题元素**（h1~h6）用 `id` 属性（因为标题 ID 同时作为页面锚点跳转目标）
- ID 格式建议：`u` + 8 位十六进制，如 `u81faf6bf`；简单场景可用递增序号 `u0001`、`u0002`

```html
<p data-lake-id="u0001">...</p>
<h2 id="u0002">...</h2>
```

## 块级元素

### 段落 `<p>`

文本内容包裹在 `<span>` 中。空段落用 `<br />` 占位。

```html
<p data-lake-id="u0001"><span data-lake-id="u0002">一段文字</span></p>
<p data-lake-id="u0003"><br /></p>
```

段落内的 `<br>` 表示软换行（不是新段落）。注意：块级元素末尾的 `<br>` 在解析时会被移除，它只是编辑器的占位符。

### 标题 `<h1>` ~ `<h6>`

标题用 `id` 属性而非 `data-lake-id`。

```html
<h1 id="u0010"><span data-lake-id="u0011">一级标题</span></h1>
<h2 id="u0012"><span data-lake-id="u0013">二级标题</span></h2>
```

### 引用块 `<blockquote>`

引用块内部可嵌套段落、标题等块级元素。

```html
<blockquote data-lake-id="u0020">
  <p data-lake-id="u0021"><span data-lake-id="u0022">引用的文字</span></p>
</blockquote>
```

### 列表（新格式）

Lake 列表有新旧两种格式，**写入时使用新格式**。新格式的核心思想是扁平化：相邻的、相同 `list` ID 且相同层级的列表项共享一个 `<ul>`/`<ol>` 包装元素。

#### 无序列表

```html
<ul list="ua001">
  <li fid="ua001" data-lake-id="u0031"><span data-lake-id="u0032">项目一</span></li>
  <li fid="ua001" data-lake-id="u0033"><span data-lake-id="u0034">项目二</span></li>
</ul>
```

#### 有序列表

```html
<ol list="ua002">
  <li fid="ua002" data-lake-id="u0041"><span data-lake-id="u0042">第一步</span></li>
  <li fid="ua002" data-lake-id="u0043"><span data-lake-id="u0044">第二步</span></li>
</ol>
```

#### 嵌套列表

层级变化时产生新的包装元素，通过 `data-lake-indent` 表示缩进深度：

```html
<ul list="ua003">
  <li fid="ua003" data-lake-id="u0051"><span data-lake-id="u0052">父项</span></li>
</ul>
<ul list="ua003" data-lake-indent="1">
  <li fid="ua003" data-lake-id="u0053"><span data-lake-id="u0054">子项 A</span></li>
  <li fid="ua003" data-lake-id="u0055"><span data-lake-id="u0056">子项 B</span></li>
</ul>
<ul list="ua003">
  <li fid="ua003" data-lake-id="u0057"><span data-lake-id="u0058">下一个父项</span></li>
</ul>
```

#### 有序列表编号偏移

当列表项不从第 1 项开始时，用 `start` 属性（1-based）：

```html
<ol list="ua004" start="3">
  <li fid="ua004" data-lake-id="u0061"><span data-lake-id="u0062">第三步</span></li>
</ol>
```

#### 任务列表

任务列表使用 `tli` 节点类型，写入时用 `<ul class="lake-list">`，`<li>` 内含 checkbox 卡片：

```html
<ul list="ua005" class="lake-list">
  <li fid="ua005" data-lake-id="u0071" class="lake-list-node lake-list-task">
    <card type="inline" name="checkbox" value="false"></card>
    <span data-lake-id="u0072">待办事项</span>
  </li>
  <li fid="ua005" data-lake-id="u0073" class="lake-list-node lake-list-task">
    <card type="inline" name="checkbox" value="true"></card>
    <span data-lake-id="u0074">已完成事项</span>
  </li>
</ul>
```

#### 列表属性速查

| 属性 | 位置 | 说明 |
|------|------|------|
| `list` | `<ul>`/`<ol>` | 列表组 ID，相同 ID 的项属于同一列表 |
| `data-lake-indent` | `<ul>`/`<ol>` | 缩进层级，仅 level > 0 时写入 |
| `start` | `<ol>` | 起始编号（1-based），仅 index != 0 时写入 |
| `class="lake-list"` | `<ul>` | 仅任务列表 |
| `fid` | `<li>` | 子列表片段 ID |
| `data-lake-index-type` | `<li>` | 编号样式（如中文数字），仅 > 0 时写入 |

#### 旧格式（兼容）

旧格式是标准嵌套 HTML 列表，读取时仍然支持，但不推荐写入：

```html
<ul><li>项目一</li><li>项目二</li></ul>
```

### 分隔线

分隔线通过 `hr` 卡片表示，不使用原生 `<hr>` 标签：

```html
<card type="block" name="hr" value="null"></card>
```

## 内联样式

Lake 通过三种机制实现内联样式。

### 语义标签

| 标签 | 效果 | 别名 |
|------|------|------|
| `<strong>` | 加粗 | `<b>` |
| `<em>` | 斜体 | `<i>` |
| `<u>` | 下划线 | `<ins>` |
| `<s>` | 删除线 | `<del>`, `<strike>` |
| `<code>` | 行内代码 | — |
| `<sup>` | 上标 | — |
| `<sub>` | 下标 | — |

语义标签包裹在 `<span>` 外层，可嵌套：

```html
<strong><span data-lake-id="u0001">加粗</span></strong>
<strong><em><span data-lake-id="u0002">加粗斜体</span></em></strong>
```

### CSS style 属性

直接在 `<span>` 上设置：

```html
<span data-lake-id="u0003" style="color: #F5222D">红色文字</span>
<span data-lake-id="u0004" style="background-color: #FFF1F0">高亮背景</span>
```

支持的属性：`color`（文字颜色）、`background-color`（背景色）。颜色值用十六进制格式 `#XXXXXX`。

### CSS class 属性

字号通过 class 设置，格式为 `lake-fontsize-{N}`：

```html
<span data-lake-id="u0005" class="lake-fontsize-24">大号文字</span>
```

### 组合样式

多种样式可以自由组合：

```html
<strong><span data-lake-id="u0006" style="color: #1890FF" class="lake-fontsize-16">蓝色加粗大字</span></strong>
```

### 链接 `<a>`

```html
<a href="https://example.com" target="_blank" data-lake-id="u0010">
  <span data-lake-id="u0011">链接文字</span>
</a>
```

链接必须有 `href`，通常搭配 `target="_blank"`。链接内部的文本同样需要 `<span>` 包裹。

## 卡片系统

卡片是 Lake 格式的扩展点，用于所有纯文本之外的复杂内容。

### 语法

```html
<card type="block|inline" name="卡片名" value="URL编码的JSON"></card>
```

| 属性 | 说明 |
|------|------|
| `type` | `"block"`（独占一行）或 `"inline"`（与文本混排） |
| `name` | 卡片类型标识符 |
| `value` | `` + `encodeURIComponent(JSON.stringify(valueObject))` |

### Value 编码规则

1. 将 value 对象序列化为 JSON 字符串
2. 对 JSON 字符串做 URL 编码（`encodeURIComponent`）
3. 加上 `data:` 前缀

特殊值：`value="null"` 表示空值（如 `hr` 卡片使用）。

所有卡片的 value 对象都应包含 `id` 字段作为唯一标识。

### 常用卡片速查

#### 代码块 codeblock（block）

```json
{ "id": "c001", "mode": "javascript", "code": "console.log('hello')" }
```

`mode` 常用值：`plain`、`javascript`、`typescript`、`python`、`java`、`go`、`rust`、`sql`、`json`、`html`、`css`、`shell`、`markdown`。

#### 图片 image（inline）

```json
{ "id": "i001", "src": "https://example.com/photo.png", "width": 600, "height": 400, "status": "done" }
```

`src` 是必需字段。图片是内联卡片，放在 `<p>` 内部。

#### 数学公式 math（inline）

```json
{ "id": "m001", "code": "E = mc^2" }
```

`code` 为 LaTeX 字符串。

#### @提及 mention（inline）

```json
{ "id": "mt001", "name": "张三", "userid": "12345" }
```

#### 图表 diagram（block）

```json
{ "id": "d001", "type": "mermaid", "code": "graph LR\nA --> B" }
```

`type` 可选：`mermaid`、`puml`、`flowchart`、`graphviz`。

#### 画板 board（block）

画板卡片支持画板、思维导图、UML、流程图四种子类型。**生成时使用 v2 格式**（`version: "2.0.0"`），board 自动处理转换。

`diagramData.body` 数组中每个元素是一个图形对象，支持以下类型：

| 元素类型 | 说明 | 关键字段 |
|---------|------|---------|
| `geometry` | 形状元素 | `shape`（形状名）、`html`（文本）、`x/y/width/height`、`fill`、`stroke` |
| `line` | 连接线 | `shape`（`elbow`/`straight`/`curve`）、`source`/`target`（连接信息）、`stroke` |
| `text` | 浮动文本 | `html`、`x/y` |
| `mindmap` | 思维导图根节点 | `html`、`children`（递归）、`layout`、`border`、`treeEdge` |
| `image` | 图片 | `href`（URL）、`x/y/width/height` |
| `freehand` | 手绘 | `shape`（`pencil`/`mark-pencil`）、`points` |
| `swimlane` | 泳道图 | `shape`（`swimlane-horizontal/vertical`）、`children` |

```json
{
  "id": "b001",
  "cardType": "flowchart",
  "viewportOption": "adapt",
  "diagramData": {
    "head": { "version": "2.0.0" },
    "body": [
      { "type": "geometry", "shape": "start-end", "id": "s1", "x": 0, "y": 0, "width": 120, "height": 60, "html": "<div style=\"text-align:center;\">开始</div>", "zIndex": 0 },
      { "type": "line", "shape": "elbow", "id": "l1", "source": { "id": "s1", "connection": "E" }, "target": { "marker": "arrow", "id": "p1" }, "zIndex": 1 },
      { "type": "geometry", "shape": "process", "id": "p1", "x": 200, "y": 0, "width": 120, "height": 60, "html": "<div style=\"text-align:center;\">处理</div>", "zIndex": 2 }
    ]
  }
}
```

`cardType`：`board`（空画板）、`mindmap`（思维导图）、`uml`、`flowchart`。常用 geometry shape：`process`、`start-end`、`decision`、`database`、`rounded-rect`、`actor`、`use-case`。详细的 body 元素结构和完整 shape 列表参见 `lake-card-reference.md`。

#### 表格 table（block）

表格推荐用卡片形式。value 的 `html` 字段包含完整的表格 HTML：

```json
{
  "id": "t001",
  "rows": 2,
  "cols": 2,
  "html": "<table class=\"lake-table\" style=\"width: 400px;\"><colgroup><col width=\"200\"><col width=\"200\"></colgroup><tbody><tr style=\"height: 33px;\"><td style=\"background-color: #F5F5F5;\"><p>表头1</p></td><td style=\"background-color: #F5F5F5;\"><p>表头2</p></td></tr><tr style=\"height: 33px;\"><td><p>内容1</p></td><td><p>内容2</p></td></tr></tbody></table>"
}
```

表格 `html` 字段内的 `<p>`、`<span>` 不需要 `data-lake-id`——预处理展开后会被重新赋予 ID。

> 更多卡片类型的完整字段说明，参见 `lake-card-reference.md`。
> 更多实际书写示例，参见 `lake-examples.md`。

## 书写清单

生成 Lake 格式时，逐条检查：

1. **每个元素都有唯一 ID**——普通元素用 `data-lake-id`，标题用 `id`
2. **文本包裹在 `<span>` 中**——段落、标题、列表项的文本内容用 `<span data-lake-id="...">` 包裹
3. **空块用 `<br />`**——空段落等块级元素内放 `<br />` 占位
4. **保持结构与空白**——新生成内容可连续书写，既有正文不做无关格式化
5. **卡片 value 正确编码**——`data:` + URL 编码的 JSON
6. **颜色用十六进制**——`#F5222D`，不用 `rgb()` 或颜色名
7. **列表用新格式**——`<ul list="...">` / `<ol list="...">`，`<li fid="...">`
8. **标签全小写**——`<p>` 不是 `<P>`
9. **属性用双引号**——`id="u0001"` 不是 `id='u0001'`
10. **使用公网 CLI 契约**——`doc create/update --format lake --body-file FILE` 映射到 Open API 的 `body`，不要照搬内网的 `body_asl`。
