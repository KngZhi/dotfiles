# Source provenance

The image recovery resources were authored by Junwei for the local
`wechat-local-image-recovery` skill in 2026-09. They were migrated into this
unified skill on 2026-10-16 under the user's consolidation request. The source
directory had no explicit LICENSE or NOTICE. No new license is assigned.

Original resource SHA-256 values before migration:

- `scripts/recover_images.py`: `2cfc3c1c4aa033b1bf8427150e2bc49f1dbeee2c0c0e2bfa3c393ef28182adaf`
- `scripts/test_recovery.py`: `24313918bb5ef831663489115bcbbca4e2387f42b14d256530a0f68135eface6`
- `references/local-recovery.md`: `c6ffe190d95f04a6bdd19825b1276988a4bbd814f71f90571e2949016e165f30`
- `references/tencent-sheet.md`: `b111740b03e65498e4491f995d402e2c24d3ae3dc674319e2bea26501e501ace`

The V2/WXGF decoder is retained. Local changes add private output permissions
and accept the image locator's structured manifest. The original format and
algorithm references remain in `references/local-recovery.md`.

The database engine is dynamically called from the installed
[tzwkb/wechat-decrypt](https://github.com/tzwkb/wechat-decrypt) checkout. It is
not copied here. Its own LICENSE records MIT, Copyright (c) 2026 cocofeng.
The runtime backend path and version can be checked from that checkout.
