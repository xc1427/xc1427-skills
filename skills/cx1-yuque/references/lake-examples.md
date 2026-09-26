# Lake 格式书写示例集

> 从原 OpenAuth 技能移植的结构与设计参考，不是公网 API 的完整稳定规范。提交使用 `doc create/update --format lake --body-file FILE`；CLI 将正文映射到 Web API 的 `body_asl` 并发布核验。保留已有卡片编码与未知字段。新卡片须在 Chrome 验证渲染；API 回读相同只证明存储。

实际场景下的 Lake 格式书写示例。所有示例先展示 value JSON，再展示完整 Lake HTML（为可读性做了换行，实际提交使用 UTF-8 正文文件）。

---

## 示例 1：简单文章

一篇包含标题、正文、加粗文字的简短文章。

```html
<!doctype lake>
<meta name="doc-version" content="1" />
<h1 id="u0001"><span data-lake-id="u0002">项目周报</span></h1>
<p data-lake-id="u0003">
  <span data-lake-id="u0004">本周完成了</span>
  <strong><span data-lake-id="u0005">核心功能开发</span></strong>
  <span data-lake-id="u0006">，具体进展如下。</span>
</p>
<h2 id="u0007"><span data-lake-id="u0008">已完成</span></h2>
<ul list="ua001">
  <li fid="ua001" data-lake-id="u0009"><span data-lake-id="u000a">用户登录模块</span></li>
  <li fid="ua001" data-lake-id="u000b"><span data-lake-id="u000c">权限管理</span></li>
</ul>
<h2 id="u000d"><span data-lake-id="u000e">进行中</span></h2>
<ol list="ua002">
  <li fid="ua002" data-lake-id="u000f"><span data-lake-id="u0010">数据导出功能</span></li>
  <li fid="ua002" data-lake-id="u0011"><span data-lake-id="u0012">性能优化</span></li>
</ol>
```

---

## 示例 2：富文本段落

展示各种内联样式的混合使用。

```html
<p data-lake-id="u1001">
  <span data-lake-id="u1002">这是</span>
  <strong><span data-lake-id="u1003">加粗</span></strong>
  <span data-lake-id="u1004">，这是</span>
  <em><span data-lake-id="u1005">斜体</span></em>
  <span data-lake-id="u1006">，这是</span>
  <u><span data-lake-id="u1007">下划线</span></u>
  <span data-lake-id="u1008">，这是</span>
  <s><span data-lake-id="u1009">删除线</span></s>
  <span data-lake-id="u100a">。</span>
</p>
<p data-lake-id="u100b">
  <span data-lake-id="u100c" style="color: #F5222D">红色警告</span>
  <span data-lake-id="u100d">、</span>
  <span data-lake-id="u100e" style="background-color: #FADB14">黄色高亮</span>
  <span data-lake-id="u100f">、</span>
  <span data-lake-id="u1010" class="lake-fontsize-24">大号字体</span>
  <span data-lake-id="u1011">。</span>
</p>
<p data-lake-id="u1012">
  <strong><em><span data-lake-id="u1013" style="color: #1890FF" class="lake-fontsize-16">组合样式：蓝色加粗斜体大字</span></em></strong>
</p>
```

---

## 示例 3：代码块

codeblock 卡片的 value JSON：

```json
{
  "id": "code01",
  "mode": "typescript",
  "code": "interface User {\n  name: string;\n  age: number;\n}\n\nfunction greet(user: User): string {\n  return `Hello, ${user.name}!`;\n}",
  "lineNumbers": true
}
```

完整 Lake HTML：

```html
<p data-lake-id="u2001"><span data-lake-id="u2002">以下是 TypeScript 示例：</span></p>
<card type="block" name="codeblock" value="%7B%22id%22%3A%22code01%22%2C%22mode%22%3A%22typescript%22%2C%22code%22%3A%22interface%20User%20%7B%5Cn%20%20name%3A%20string%3B%5Cn%20%20age%3A%20number%3B%5Cn%7D%5Cn%5Cnfunction%20greet(user%3A%20User)%3A%20string%20%7B%5Cn%20%20return%20%60Hello%2C%20%24%7Buser.name%7D!%60%3B%5Cn%7D%22%2C%22lineNumbers%22%3Atrue%7D"></card>
```

---

## 示例 4：嵌套列表

三级嵌套列表，同一个 `list` ID，通过 `data-lake-indent` 区分层级：

```html
<ul list="ua010">
  <li fid="ua010" data-lake-id="u3001"><span data-lake-id="u3002">前端</span></li>
</ul>
<ul list="ua010" data-lake-indent="1">
  <li fid="ua010" data-lake-id="u3003"><span data-lake-id="u3004">React</span></li>
  <li fid="ua010" data-lake-id="u3005"><span data-lake-id="u3006">Vue</span></li>
</ul>
<ul list="ua010" data-lake-indent="2">
  <li fid="ua010" data-lake-id="u3007"><span data-lake-id="u3008">Vue 2</span></li>
  <li fid="ua010" data-lake-id="u3009"><span data-lake-id="u300a">Vue 3</span></li>
</ul>
<ul list="ua010">
  <li fid="ua010" data-lake-id="u300b"><span data-lake-id="u300c">后端</span></li>
</ul>
<ul list="ua010" data-lake-indent="1">
  <li fid="ua010" data-lake-id="u300d"><span data-lake-id="u300e">Node.js</span></li>
  <li fid="ua010" data-lake-id="u300f"><span data-lake-id="u3010">Java</span></li>
</ul>
```

渲染效果：
```
• 前端
  • React
  • Vue
    • Vue 2
    • Vue 3
• 后端
  • Node.js
  • Java
```

---

## 示例 5：表格

一个 3x3 表格（含表头行），table 卡片的 value JSON：

```json
{
  "id": "t01",
  "rows": 3,
  "cols": 3,
  "html": "<table class=\"lake-table\" style=\"width: 600px;\"><colgroup><col width=\"200\"><col width=\"200\"><col width=\"200\"></colgroup><tbody><tr style=\"height: 33px;\"><td style=\"background-color: #F5F5F5;\"><p>功能</p></td><td style=\"background-color: #F5F5F5;\"><p>状态</p></td><td style=\"background-color: #F5F5F5;\"><p>负责人</p></td></tr><tr style=\"height: 33px;\"><td><p>用户管理</p></td><td><p>已完成</p></td><td><p>张三</p></td></tr><tr style=\"height: 33px;\"><td><p>数据导出</p></td><td><p>进行中</p></td><td><p>李四</p></td></tr></tbody></table>"
}
```

完整 Lake HTML：

```html
<card type="block" name="table" value="%7B%22id%22%3A%22t01%22%2C%22rows%22%3A3%2C%22cols%22%3A3%2C%22html%22%3A%22%3Ctable%20class%3D%5C%22lake-table%5C%22%20style%3D%5C%22width%3A%20600px%3B%5C%22%3E%3Ccolgroup%3E%3Ccol%20width%3D%5C%22200%5C%22%3E%3Ccol%20width%3D%5C%22200%5C%22%3E%3Ccol%20width%3D%5C%22200%5C%22%3E%3C%2Fcolgroup%3E%3Ctbody%3E%3Ctr%20style%3D%5C%22height%3A%2033px%3B%5C%22%3E%3Ctd%20style%3D%5C%22background-color%3A%20%23F5F5F5%3B%5C%22%3E%3Cp%3E%E5%8A%9F%E8%83%BD%3C%2Fp%3E%3C%2Ftd%3E%3Ctd%20style%3D%5C%22background-color%3A%20%23F5F5F5%3B%5C%22%3E%3Cp%3E%E7%8A%B6%E6%80%81%3C%2Fp%3E%3C%2Ftd%3E%3Ctd%20style%3D%5C%22background-color%3A%20%23F5F5F5%3B%5C%22%3E%3Cp%3E%E8%B4%9F%E8%B4%A3%E4%BA%BA%3C%2Fp%3E%3C%2Ftd%3E%3C%2Ftr%3E%3Ctr%20style%3D%5C%22height%3A%2033px%3B%5C%22%3E%3Ctd%3E%3Cp%3E%E7%94%A8%E6%88%B7%E7%AE%A1%E7%90%86%3C%2Fp%3E%3C%2Ftd%3E%3Ctd%3E%3Cp%3E%E5%B7%B2%E5%AE%8C%E6%88%90%3C%2Fp%3E%3C%2Ftd%3E%3Ctd%3E%3Cp%3E%E5%BC%A0%E4%B8%89%3C%2Fp%3E%3C%2Ftd%3E%3C%2Ftr%3E%3Ctr%20style%3D%5C%22height%3A%2033px%3B%5C%22%3E%3Ctd%3E%3Cp%3E%E6%95%B0%E6%8D%AE%E5%AF%BC%E5%87%BA%3C%2Fp%3E%3C%2Ftd%3E%3Ctd%3E%3Cp%3E%E8%BF%9B%E8%A1%8C%E4%B8%AD%3C%2Fp%3E%3C%2Ftd%3E%3Ctd%3E%3Cp%3E%E6%9D%8E%E5%9B%9B%3C%2Fp%3E%3C%2Ftd%3E%3C%2Ftr%3E%3C%2Ftbody%3E%3C%2Ftable%3E%22%7D"></card>
```

---

## 示例 6：图片与文字混排

内联图片嵌入段落中：

```html
<p data-lake-id="u4001">
  <span data-lake-id="u4002">系统架构如下图所示：</span>
</p>
<p data-lake-id="u4003">
  <card type="inline" name="image" value="data:%7B%22id%22%3A%22img01%22%2C%22src%22%3A%22https%3A%2F%2Fcdn.example.com%2Farch.png%22%2C%22width%22%3A800%2C%22height%22%3A500%2C%22status%22%3A%22done%22%2C%22style%22%3A%22none%22%2C%22margin%22%3A%7B%22top%22%3Atrue%2C%22bottom%22%3Atrue%7D%7D"></card>
</p>
```

---

## 示例 7：Mermaid 图表

diagram 卡片的 value JSON：

```json
{
  "id": "diag01",
  "type": "mermaid",
  "code": "graph TD\n  A[用户请求] --> B{鉴权}\n  B -->|通过| C[业务处理]\n  B -->|拒绝| D[返回 403]\n  C --> E[返回结果]",
  "margin": { "top": true, "bottom": true }
}
```

完整 Lake HTML：

```html
<card type="block" name="diagram" value="%7B%22id%22%3A%22diag01%22%2C%22type%22%3A%22mermaid%22%2C%22code%22%3A%22graph%20TD%5Cn%20%20A%5B%E7%94%A8%E6%88%B7%E8%AF%B7%E6%B1%82%5D%20--%3E%20B%7B%E9%89%B4%E6%9D%83%7D%5Cn%20%20B%20--%3E%7C%E9%80%9A%E8%BF%87%7C%20C%5B%E4%B8%9A%E5%8A%A1%E5%A4%84%E7%90%86%5D%5Cn%20%20B%20--%3E%7C%E6%8B%92%E7%BB%9D%7C%20D%5B%E8%BF%94%E5%9B%9E%20403%5D%5Cn%20%20C%20--%3E%20E%5B%E8%BF%94%E5%9B%9E%E7%BB%93%E6%9E%9C%5D%22%2C%22margin%22%3A%7B%22top%22%3Atrue%2C%22bottom%22%3Atrue%7D%7D"></card>
```

---

## 示例 8：链接与 @提及混排

```html
<p data-lake-id="u5001">
  <span data-lake-id="u5002">请 </span>
  <card type="inline" name="mention" value="%7B%22id%22%3A%22mt01%22%2C%22name%22%3A%22%E5%BC%A0%E4%B8%89%22%2C%22userid%22%3A%2212345%22%7D"></card>
  <span data-lake-id="u5003"> 查看 </span>
  <a href="https://www.yuque.com/OWNER/BOOK/DOC" target="_blank" data-lake-id="u5004">
    <span data-lake-id="u5005">需求文档</span>
  </a>
  <span data-lake-id="u5006"> 并在周五前反馈。</span>
</p>
```

---

## 示例 9：引用块 + 分隔线

```html
<blockquote data-lake-id="u6001">
  <p data-lake-id="u6002">
    <em><span data-lake-id="u6003" style="color: #8C8C8C">注意：以下内容仅供内部参考，请勿外传。</span></em>
  </p>
</blockquote>
<card type="block" name="hr" value="null"></card>
<p data-lake-id="u6004"><span data-lake-id="u6005">正文内容从这里开始。</span></p>
```

---

## 示例 10：综合技术文档

包含标题层级、代码块、列表、表格、图片、链接的完整文档。

```html
<!doctype lake>
<meta name="doc-version" content="1" />
<meta name="typography" content="classic" />
<meta name="viewport" content="fixed" />
<h1 id="u7001"><span data-lake-id="u7002">API 接入指南</span></h1>
<p data-lake-id="u7003">
  <span data-lake-id="u7004">本文档描述如何接入 </span>
  <strong><span data-lake-id="u7005">LakeX 编辑器 API</span></strong>
  <span data-lake-id="u7006">。</span>
</p>
<card type="block" name="hr" value="null"></card>
<h2 id="u7007"><span data-lake-id="u7008">环境要求</span></h2>
<card type="block" name="table" value="%7B%22id%22%3A%22t02%22%2C%22rows%22%3A3%2C%22cols%22%3A2%2C%22html%22%3A%22%3Ctable%20class%3D%5C%22lake-table%5C%22%20style%3D%5C%22width%3A%20400px%3B%5C%22%3E%3Ccolgroup%3E%3Ccol%20width%3D%5C%22200%5C%22%3E%3Ccol%20width%3D%5C%22200%5C%22%3E%3C%2Fcolgroup%3E%3Ctbody%3E%3Ctr%20style%3D%5C%22height%3A%2033px%3B%5C%22%3E%3Ctd%20style%3D%5C%22background-color%3A%20%23F5F5F5%3B%5C%22%3E%3Cp%3E%E4%BE%9D%E8%B5%96%3C%2Fp%3E%3C%2Ftd%3E%3Ctd%20style%3D%5C%22background-color%3A%20%23F5F5F5%3B%5C%22%3E%3Cp%3E%E7%89%88%E6%9C%AC%3C%2Fp%3E%3C%2Ftd%3E%3C%2Ftr%3E%3Ctr%20style%3D%5C%22height%3A%2033px%3B%5C%22%3E%3Ctd%3E%3Cp%3ENode.js%3C%2Fp%3E%3C%2Ftd%3E%3Ctd%3E%3Cp%3E%26gt%3B%3D%2016.0%3C%2Fp%3E%3C%2Ftd%3E%3C%2Ftr%3E%3Ctr%20style%3D%5C%22height%3A%2033px%3B%5C%22%3E%3Ctd%3E%3Cp%3EReact%3C%2Fp%3E%3C%2Ftd%3E%3Ctd%3E%3Cp%3E%26gt%3B%3D%2018.0%3C%2Fp%3E%3C%2Ftd%3E%3C%2Ftr%3E%3C%2Ftbody%3E%3C%2Ftable%3E%22%7D"></card>
<h2 id="u7009"><span data-lake-id="u700a">快速开始</span></h2>
<p data-lake-id="u700b"><span data-lake-id="u700c">安装依赖：</span></p>
<card type="block" name="codeblock" value="%7B%22id%22%3A%22c02%22%2C%22mode%22%3A%22shell%22%2C%22code%22%3A%22npm%20install%20%40alipay%2Flakex-doc%22%7D"></card>
<p data-lake-id="u700d"><span data-lake-id="u700e">创建编辑器实例：</span></p>
<card type="block" name="codeblock" value="%7B%22id%22%3A%22c03%22%2C%22mode%22%3A%22typescript%22%2C%22code%22%3A%22import%20%7B%20createOpenEditor%20%7D%20from%20'%40alipay%2Flakex-doc'%3B%5Cn%5Cnconst%20editor%20%3D%20createOpenEditor(%7B%5Cn%20%20el%3A%20document.getElementById('editor')%2C%5Cn%7D)%3B%5Cneditor.setContent(data)%3B%22%2C%22lineNumbers%22%3Atrue%7D"></card>
<h2 id="u700f"><span data-lake-id="u7010">注意事项</span></h2>
<ul list="ua020">
  <li fid="ua020" data-lake-id="u7011">
    <span data-lake-id="u7012">确保容器元素已挂载到 DOM</span>
  </li>
  <li fid="ua020" data-lake-id="u7013">
    <span data-lake-id="u7014">编辑器销毁时调用 </span>
    <code><span data-lake-id="u7015">editor.destroy()</span></code>
  </li>
</ul>
<p data-lake-id="u7016">
  <span data-lake-id="u7017">更多信息请参考 </span>
  <a href="https://www.yuque.com/OWNER/BOOK/GUIDE" target="_blank" data-lake-id="u7018">
    <span data-lake-id="u7019">完整文档</span>
  </a>
  <span data-lake-id="u701a">。</span>
</p>
```

---

## 示例 11：数学公式混排

```html
<p data-lake-id="u8001">
  <span data-lake-id="u8002">根据勾股定理，直角三角形满足 </span>
  <card type="inline" name="math" value="data:%7B%22id%22%3A%22m01%22%2C%22code%22%3A%22a%5E2%20%2B%20b%5E2%20%3D%20c%5E2%22%7D"></card>
  <span data-lake-id="u8003">，其中 </span>
  <card type="inline" name="math" value="data:%7B%22id%22%3A%22m02%22%2C%22code%22%3A%22c%22%7D"></card>
  <span data-lake-id="u8004"> 为斜边长度。</span>
</p>
```

---

## 示例 12：任务列表

```html
<h2 id="u9001"><span data-lake-id="u9002">本周待办</span></h2>
<ul list="ua030" class="lake-list">
  <li fid="ua030" data-lake-id="u9003" class="lake-list-node lake-list-task">
    <card type="inline" name="checkbox" value="true"></card>
    <span data-lake-id="u9004">完成 API 文档</span>
  </li>
  <li fid="ua030" data-lake-id="u9005" class="lake-list-node lake-list-task">
    <card type="inline" name="checkbox" value="false"></card>
    <span data-lake-id="u9006">代码评审</span>
  </li>
  <li fid="ua030" data-lake-id="u9007" class="lake-list-node lake-list-task">
    <card type="inline" name="checkbox" value="false"></card>
    <span data-lake-id="u9008">部署上线</span>
  </li>
</ul>
```
