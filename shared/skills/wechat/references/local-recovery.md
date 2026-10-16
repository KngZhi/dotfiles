# 本地恢复操作

## 环境与命令

脚本使用 Python 3、`cryptography`、`Pillow`；WXGF 转码另需 PATH 中已有的 `ffmpeg`。缺依赖时使用独立虚拟环境，不更改系统 Python。脚本没有网络、微信 UI、数据库或配置写入能力。

以下路径均为占位示例。命令从技能目录执行；`--account` 指向实际账号目录，`--scope` 必须是它下面的附件/缓存子目录。月份从任务证据确定。

```sh
python3 scripts/wechat.py images match \
  --account /path/to/xwechat_files/account_suffix \
  --scope /path/to/xwechat_files/account_suffix/msg/attach/conversation/2026-09/Img \
  --queries /path/to/cropped-product-photos \
  --out /path/to/new-match-results
```

`match` 读取查询目录顶层的 PNG/JPG 图片，只解密扫描范围内的 `.dat` 到内存，输出 `candidates.json`。每张查询最多列六个候选及尺寸/哈希，不能将分数当作概率。商品局部裁切会影响匹配质量，需要视觉核对；分数越低表示指纹差异越小。脚本不从截图自动切图；由 agent 根据实际边界提取，保留原始截图作为报价证据。

对每个已匹配哈希，列出同目录下同 stem 的各版本，比较尺寸与内容。不能只选匹配分数最低或文件字节数最大的版本：已验证同一照片可能有小图副本与另一哈希的完整版本。

创建恢复清单，允许同一照片的多个候选，但 `id` 唯一：

```json
[
  {"id": "photo-01", "dat": "/path/to/account/msg/attach/conversation/2026-09/Img/hash.dat"},
  {"id": "photo-01-h", "dat": "/path/to/account/msg/attach/conversation/2026-09/Img/hash_h.dat"}
]
```

```sh
python3 scripts/wechat.py images recover \
  --account /path/to/xwechat_files/account_suffix \
  --manifest /path/to/selected-candidates.json \
  --out /path/to/new-recovered-images
```

两种模式都拒绝覆盖已有输出目录；失败可能留下部分结果，检查后使用新的输出目录。恢复清单必须限定于指定账号的 `msg/attach` 或 `cache`；越界路径和重复编号会被拒绝。账号拥有者的批准仍是前置条件，路径校验不提供授权。

`recover` 使用清单文件并在这些文件的同目录最多补取少量模板，以验证密钥。输出每个候选平面的 PNG 和 `recovered.json`（原 `.dat` SHA-256、尺寸、平面序号、输出路径）。只把视觉确认的平面放进最终交付包；白色平面不是恢复成功的商品图。

## 已验证格式与边界

2026-09-08 在 macOS 微信 4.1.11 实测：V2 图片可以从本地 kvcomm 文件名派生密钥，22 张任务图片完成匹配与大图恢复；无需进程读取。这个版本证据不能保证所有微信 4.x 均兼容。

- `xor_key = uin & 255`。
- `aes_key = MD5(str(uin) + normalized_account).hexdigest()[:16]` 的 **16 个 ASCII 字节**，不是把 hex 再解成 8 字节。
- V2 布局：6 字节 magic、两个 little-endian uint32（AES 原长、XOR 尾长）、1 字节标志，然后是带 PKCS7 padding 的 AES-ECB 区段、明文区段、XOR 尾段。AES 原长正好对齐时仍有完整 padding 块。
- WXGF 内可能出现多个 HEVC VPS 起点 `00 00 00 01 40 01`。已验证部分表格的第一个流为白色平面，第二个流才是图像。脚本逐个尝试静态首帧并记录序号，不宣称支持动画、Live Photo 或所有 WXGF 变体。
- 未命中 kvcomm 不代表文件不能解密，只代表本脚本没有验证可用密钥；它不实现穷举或进程扫描兜底。

算法来源与实现依据（读取而非安装来源中的整套程序）：

- [macOS 派生算法及交叉验证实现](https://gitcode.com/gcw_xlkU87N4/wechat-decrypt/blob/main/find_image_key_macos.py)
- [V2 解码格式参考](https://github.com/ylytdeng/wechat-decrypt/blob/main/decode_image.py)
- [WXGF HEVC 流说明](https://github.com/CN-Grace/Wechat-Emoticon-Parser)

部分上游链接可能失效；本包脚本独立实现上述格式，不在运行时下载上游代码。
