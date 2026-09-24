# 富格式与附件

## Lake 保真编辑

Open API 文档详情读取 `body_lake`，创建/更新用 `format:"lake", body: LAKE_SOURCE`，不要混用 Web API 的 body_asl。

```bash
yq doc create OWNER/BOOK --title '标题' --format lake --body-file body.lake
yq doc update DOC_URL --format lake --body-file updated.lake
```

创建需要 title、format、body-file；创建私有文档显式 `public:0`。更新既有文档不要顺手改变 public。写前保留原始 Lake；只修改目标结构，保留 data-lake-id、未知属性及其他卡片，不使用脆弱的全局字符串替换编辑任意嵌套结构。

已实测 Open API 创建/更新、精确回读及 Chrome 显示：

```html
<article class="lake-columns">
  <article class="lake-column-item" style="width: 50.000000%"><p>左栏</p></article>
  <article class="lake-column-item" style="width: 50.000000%"><p>右栏</p></article>
</article>
<blockquote class="lake-alert lake-alert-warning"><p>提示内容</p></blockquote>
```

原生样本包含每个节点的 data-lake-id/id；生成新节点用唯一 ID。基础文本必须 HTML 转义。卡片 value 是 `encodeURIComponent(JSON.stringify(value))`，再安全写入 HTML 属性：

```js
const value = {id: uniqueId, mode:'typescript', code:'console.log("hello");',
  autoWrap:true, lineNumbers:true, theme:'github'};
// <card type="block" name="codeblock" value="ENCODED_JSON"></card>
```

不要把这些字段当作完整或永久稳定的 Lake 规范。需要新卡片类型时，从网页原生样本获取源结构再验证。

## 上传与嵌入是两步

```bash
yq attachment upload --file ./attachment.txt --output upload.json
# 一步上传并嵌入现有 Lake 文档
yq attachment add DOC_URL --file ./attachment.txt
```

调用 Web multipart `/api/upload/attach`，自动生成 boundary。限制本地普通文件 ≤100 MiB（工具限制，不是产品额度承诺）。返回 `data.url`、attachment_id、filename、size、extname；没有把返回 URL 当作可匿名公开访问证明。

将上传结果转换为 Lake localdoc 卡片：

```js
const value = {id:uniqueId,src:upload.url,name:upload.filename,
 size:upload.size,ext:upload.extname,status:'done',download:true,
 mode:'card',type:'block'};
// <card type="block" name="localdoc" value="ENCODED_JSON"></card>
```

再用 Open API 更新文档并回读。附件卡片显示不证明内容下载和 Office/PDF 内嵌预览；按用户目标实际点击核验。已有私有附件的跨库引用不意味着权限已迁移。

HTML 文件导入仍属于公网不支持的独立能力，不能用上述正文写入宣称支持。

## 更多结构与画板

按需读取 [Lake 基础](lake-format-guideline.md)、[卡片字段](lake-card-reference.md)、[示例](lake-examples.md)。这些是从原技能迁移的参考，不是所有卡片均已公网实测。

生成架构图读 [architecture-diagram.md](architecture-diagram.md)，工程蓝图读 [blueprint-diagram.md](blueprint-diagram.md)；生成 Lake board 卡片后用 doc create/update 提交并在 Chrome 验证。公开资源接口也可用 `resource create --doc DOC_URL --type architecturediagram --dsl-file diagram.txt`，resource get/update 用 src 标识；其 DSL 契约以当前官方 CLI/spec 为准，不把 Lake board 的 JSON 直接当作 DSL。资源写入返回 submitted，需另行读取和显示验证。
