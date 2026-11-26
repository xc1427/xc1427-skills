# 语雀数据表写入

语雀读取与写入走已安装的 `cx1-yuque`。按该技能运行 `scripts/yuque.sh`，沿用其站点与会话核对流程。下面的 `YQ` 是安装目录下该脚本的路径。只读预览使用粘贴正文时无需设置 `YQ` 或目标表。

```bash
bash "$YQ" doc read "<语雀源文档链接>" --format markdown
: "${RECIPE_YUQUE_URI:?请在 shell 中导出目标语雀数据表路径}"
bash "$YQ" table schema "$RECIPE_YUQUE_URI"
bash "$YQ" table records "$RECIPE_YUQUE_URI"
```

1. 确认目标是数据表，找到唯一的「名称」文本字段和「图片」图片字段。多子表用 `--sheet` 明确指定，视图用 `--view` 选择现有视图。字段不匹配时报告实际差异，保持表结构。
2. 将照片按菜品整理成每条记录的一个图片数组。沿用目标表已有的原生图片结构，优先用已核验的 `q_90` CDN 地址。通用附件上传只有在 `cx1-yuque` 已确认其结果可用于目标图片字段时才用。如果确有授权工作所需的通用能力缺失，说明具体命令、输入和缺口，与用户完善 `cx1-yuque`，再用完善后的能力继续。会话、上传、表格请求都由 `cx1-yuque` 处理。
3. 写前比较目标表中的图片来源和本次拟写内容。比较时识别只差 OSS 处理参数的同一原图，保留其他有意义的 URL 参数。已经有同一道菜和同一组照片的记录时，报告已存在并跳过。同名且照片或烹饪批次不同，仍可新增。只有部分照片重合或同一来源对应多个候选时，先核对归属。
4. 每道菜只提交「名称」和「图片」，其他手工字段留空。可逐条运行 `table record add`，也可按 `cx1-yuque` 的 `batch` 格式顺序提交。保留每条请求结果和成功返回的记录 ID，供本次回读定位。
5. 回读核对本次创建的记录 ID、名称、图片数量、地址和尺寸，以及其他手工字段为空。结果不明确时，用已知 ID 或写前后的记录与图片来源定位。若已创建，跳过重试。若能唯一确认本次创建的是缺字段的记录，用 `table record set --record` 补写已经确认缺失的字段。只有确认未创建时才重试新增。无法判断是否存在部分写入时，将该条标为待核验。批处理部分失败时按条恢复，避免重跑已经生效的步骤。

```bash
bash "$YQ" table record add "$RECIPE_YUQUE_URI" --view "<现有视图名或 ID>" --values-file "<本次值文件>"
bash "$YQ" table records "$RECIPE_YUQUE_URI"
```

下面是虚构的字段值示例，地址仅用于展示结构。实际写入可用 `table schema` 返回的字段 ID 代替字段名。

```json
{
  "名称": "柠檬煎豆腐",
  "图片": [
    {
      "uid": "a1b2c3",
      "name": "tofu.jpeg",
      "width": 2400,
      "height": 1600,
      "status": "success",
      "src": "https://images.example.invalid/tofu.jpeg?x-oss-process=image%2Fquality%2Cq_90",
      "size": 1234567
    }
  ]
}
```
