# 分类、供应商和大包装数

从成本文件中找出缺失项，按供应商和货号匹配产品图片。图片通常位于
`~/Library/CloudStorage/OneDrive-Personal/source_files/产品图片/<货柜目录>/`。
用实际图片和现有 K2046 分类判断，不仅凭文件名猜测。

```bash
npm run classify <成本Excel>
npm run classify <成本Excel> -- --image-folder <图片目录>
npm run classify <成本Excel> -- --output template.json
npm run classify <成本Excel> -- --apply template.json
npm run classify <成本Excel> -- --apply-packing
```

现有分类例子包括 calzon 的 clasico、tanga、brasilera、mami、boxer、
nina-calzon，以及 cace 的 bebe、hombre、mujer。以当前系统分类为准。

应用分类时，女士内裤 clasico/tanga/brasilera/mami/boxer 的大包装数为 12，
其他分类为 1。用现有命令应用并检查结果，避免另写填充规则。

供应商名称应匹配 K2046。明确的简称或错别字可按已查到的完整名称纠正，
例如唐潮对应唐潮服饰。无法唯一匹配的情况保留待确认；新供应商不能伪装成
既有供应商。纠正后再验证。

完成时列出已补齐和仍不确定的项目。上传前必须填写完整分类1、分类2。
