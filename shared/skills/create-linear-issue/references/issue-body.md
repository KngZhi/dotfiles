# Two-audience Linear Issue writing

## Worked example

This is an illustrative scenario, not a discovered defect or a verified result.
The human part stays understandable without the Agent part.

Title: 改商品编号后，仍能看到完整的在途数量

```markdown
## 给人看

**问题**：示例商品 A100 有 100 件预计到货，其中 60 件已关联补货承诺，
40 件尚未关联。编号改成 A100-NEW 后，40 件仍显示在旧编号下，查看新编号
时会漏看这部分在途数量。

**改动与价值**：把两部分统一显示在当前编号下，方便判断完整的到货供应，
减少手工查找旧编号的工作。

**完成标准**：这个示例中，新编号下能看到全部 100 件；数量、关联状态、
到货日期保持原样，仍能追查原始订单。

---

## 给 Agent 看

**范围与约束**

- 按稳定商品身份归集，显示当前商品编号。先检查现有身份映射与展示入口。
- 保留已关联 60 件与未关联 40 件的状态和来源记录；不改变供应数量。

**验证与资料**

- 使用相同订单输入，对比改编号前后的总量、关联状态、日期和订单追溯。
- 实施前补充实际复现输入和项目验证入口；本示例的数值是预期验收条件。
```

## Maintenance and architecture work

Explain what makes maintenance difficult and which existing behavior is being
protected. Keep implementation vocabulary in the Agent part. For example:

> 每次预测已有固定的计算记录，方便对比采购建议为何变化。保存记录和更新
> 看板的步骤分散，修改流程时容易遗漏。把这些步骤集中管理；相同输入的
> 结果保持一致，保存失败时仍保留旧看板，更新看板失败时仍保留完整记录。

The Agent part can name the publication entrypoint, output contract and failure
tests. Distinguish the existing capability from the current refactor's benefit;
claim speed or correctness improvements only when supported by evidence.

## Investigation context

Include reproduction inputs, relevant entrypoints and necessary business
constraints in the Agent part. Label causal hypotheses and implementation
suggestions so an implementing Agent can revise them when evidence warrants it.
Preserve approved requirements when shortening an existing Issue, either in the
body or in an accessible linked contract. Give long investigation transcripts
and detailed review conditions a link rather than repeating them.

## Verification and evidence

Link the repository's verification skill when available. Reuse its operations;
keep setup instructions, long commands and full logs in the linked material.
Request observable evidence for the acceptance result, not a new verification
wrapper by default. A real E2E assertion can suffice without screenshots.

An input check establishes input validity and date; a prediction run establishes
that a snapshot was produced. Explain the additional comparison that demonstrates
the Issue's intended result. After implementation, put a short verified progress
statement in the human part and revision-specific results and limitations in the
Agent part or linked PR. CI counts and commit hashes belong there.
