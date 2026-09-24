#!/usr/bin/env python3
"""Read-only column validation of a container table (xlsx file or loaded grid); no formula calculation or source inference."""
import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).parent))
from grid import load_xlsx  # noqa: E402

HEADERS = ['货号', '条形码', '品名', '图片', '工艺', '单价（元/打）', '装箱数',
           '件数', '总价格', '总数量', '立方', '长', '宽', '高', '总立方', '供应商',
           '备     注', '计价单位']
SCHEMA = json.loads((Path(__file__).parents[1] / 'references/template-schema.json').read_text())
STANDARD_HEADERS = [c['header'] for c in SCHEMA['columns']]
NUMERIC = {6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
REQUIRED = {1, 3, 6, 7, 8, 10, 15, 16, 18}
FEES = {'海运费', '内陆费', '卸柜费', '清关杂费', 'IVA'}
RATES = {'CNY-CLP', 'USD-CLP', 'USD-CNY'}
EXIT_CODES = {'PASS': 0, 'ERROR': 1, 'PENDING': 2, 'REVIEW': 3}


def number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def strip_trailing(values):
    values = list(values)
    while values and values[-1] is None:
        values.pop()
    return values


def validate_book(book, source, sha256=None):
    issues = []
    def issue(level, sheet, cell, message):
        issues.append(dict(level=level, sheet=sheet, cell=cell, message=message))
    def read(cell):
        if cell.error:
            issue('error', cell.sheet, cell.coordinate, '公式错误值')
            return None
        if cell.formula and cell.stale:
            issue('pending', cell.sheet, cell.coordinate, '公式无有效缓存；须重算并保存后复验')
            return None
        return cell.value
    def compare(s, coordinate, actual, expected, label, level='error'):
        if number(actual) and not math.isclose(actual, expected, rel_tol=1e-6, abs_tol=0.01 if label == '货值' else 1e-6):
            issue(level, s, coordinate, f'{label}不符：实际 {actual}，参照值 {expected}' + ('；须对照原件判断口径，不自动改值' if level == 'review' else ''))
    if set(book.sheets) != {'data', 'config'}:
        issue('error', '', '', '工作簿必须且只能包含 data、config')
    totals = {c: [] for c in (8, 9, 10, 15)}
    rows = 0
    unit_totals = {}
    loose_totals = {}
    standard = False
    headers = []
    if 'data' in book:
        ws = book['data']
        headers = strip_trailing(ws.row_values(1))
        expected_headers = HEADERS + (['散件数'] if len(headers) == 19 else [])
        if len(headers) in (18, 19) and headers[5] in ('单价（元）', '单价（元/条）'):
            expected_headers[5] = headers[5]
        standard = headers == STANDARD_HEADERS
        mapping = {c['legacyColumn']: i + 1 for i, c in enumerate(SCHEMA['columns'])} if standard else {i: i for i in range(1, len(headers) + 1)}
        def dc(row, column):
            return ws.cell(row, mapping[column])
        if not standard and headers != expected_headers:
            issue('error', 'data', '1', f'列顺序或标题错误；新表应为 {STANDARD_HEADERS}；旧表仅兼容既定18/19列')
        else:
            if 19 in mapping:
                totals[19] = []
            ends = [r for r in range(2, ws.max_row + 1) if ws.cell(r, 1).value == 'DATA_END']
            if len(ends) != 1:
                issue('error', 'data', 'A', '必须且只能有一个 DATA_END')
            else:
                end = ends[0]
                if end == 2:
                    issue('error', 'data', 'A2', '没有商品明细')
                for r in range(2, end):
                    rows += 1
                    vals = {c: None for c in range(1, 20)}
                    for c in mapping:
                        cell = dc(r, c)
                        v = vals[c] = read(cell)
                        if v in (None, ''):
                            if c in REQUIRED or c == 2 or (standard and c == 19):
                                issue('pending', 'data', cell.coordinate, f'{headers[mapping[c]-1]}缺失，需来源或明确例外')
                            continue
                        if c in NUMERIC or c == 19:
                            if not number(v) or (v < 0 if c in (8, 19) else v <= 0):
                                issue('error', 'data', cell.coordinate, '必须为非负数字' if c in (8, 19) else '必须为大于 0 的数字；未知值留空')
                            elif c in (8, 19) and int(v) != v:
                                issue('error', 'data', cell.coordinate, '件数必须是整数')
                        elif not isinstance(v, str):
                            issue('error', 'data', cell.coordinate, '必须是文本，货号和条码不得存成数字')
                        elif c == 18 and v not in ('打', '条'):
                            issue('error', 'data', cell.coordinate, '计价单位必须为打或条')
                        elif c == 2:
                            if not re.fullmatch(r'\d{13}', v) or sum(int(n) * (1 if i % 2 == 0 else 3) for i, n in enumerate(v)) % 10:
                                issue('error', 'data', cell.coordinate, 'EAN-13 格式或校验位错误')
                    loose = vals.get(19) or 0
                    unit = vals.get(18)
                    if unit in ('打', '条'):
                        unit_totals.setdefault(unit, []).append(vals[10])
                        loose_totals.setdefault(unit, []).append(loose)
                    if (headers[5] == '单价（元/打）' and unit != '打') or (headers[5] == '单价（元/条）' and unit != '条'):
                        issue('error', 'data', dc(r, 18).coordinate, '计价单位与单价标题冲突')
                    for target, factors, label in [(10, (7, 8), '数量'), (9, (6, 10), '货值'), (15, (11, 8), '体积')]:
                        if target == 15 and loose:
                            issue('review', 'data', dc(r, 15).coordinate, '含散件，须对照源行核对整件与尾包体积之和')
                            continue
                        if all(number(vals[c]) for c in factors):
                            expected = math.prod(vals[c] for c in factors)
                            if target == 10 and number(loose):
                                expected += loose
                            compare('data', dc(r, target).coordinate, vals[target], expected, label, 'review' if target == 15 else 'error')
                            if vals[target] in (None, '') and not dc(r, target).formula:
                                issue('pending', 'data', dc(r, target).coordinate, f'缺少可核对的{label}')
                    dims = [vals[c] for c in (12, 13, 14)]
                    if any(v is not None for v in dims):
                        if all(number(v) for v in dims):
                            compare('data', f'K{r}', vals[11], math.prod(dims) / 1000000, '箱体积（厘米换立方米）', 'review')
                        else:
                            issue('pending', 'data', f'L{r}:N{r}', '长宽高未完整填写')
                    for c in totals:
                        totals[c].append(vals[c])
                tail = [r for r in range(end + 1, ws.max_row + 1)
                        if any(ws.cell(r, c).value is not None for c in range(1, len(headers) + 1))]
                main = [r for r in tail if ws.cell(r, 1).value in ('合计', '总计')]
                by_unit = [r for r in tail if ws.cell(r, 1).value in ('打数合计', '条数合计')]
                if len(main) != 1 or len(main) + len(by_unit) != len(tail):
                    issue('error', 'data', f'A{end+1}', 'DATA_END 后只允许一行合计及分单位数量合计')
                else:
                    for c, values in totals.items():
                        if c in (10, 19) and (len(unit_totals) > 1 or by_unit):
                            if len(unit_totals) > 1 and read(dc(main[0], c)) not in (None, ''):
                                issue('error', 'data', dc(main[0], c).coordinate, '不同单位数量不能相加')
                            continue
                        cell = dc(main[0], c)
                        v = read(cell)
                        if all(number(x) for x in values):
                            if not number(v):
                                issue('pending', 'data', cell.coordinate, '合计缺少有效数字或公式缓存')
                            else:
                                compare('data', cell.coordinate, v, sum(values), '货值' if c == 9 else '合计')
                    if len(unit_totals) > 1 or by_unit:
                        for unit, values in unit_totals.items():
                            matches = [r for r in by_unit if dc(r, 18).value == unit]
                            if len(matches) != 1:
                                issue('error', 'data', f'A{end+1}', f'{unit}数量必须单独合计一次')
                            elif all(number(x) for x in values):
                                cell = dc(matches[0], 10)
                                value = read(cell)
                                if not number(value):
                                    issue('pending', 'data', cell.coordinate, '分单位合计缺少数字')
                                else:
                                    compare('data', cell.coordinate, value, sum(values), '数量合计')
                            if len(matches) == 1 and 19 in totals:
                                cell = dc(matches[0], 19)
                                value = read(cell)
                                loose_values = loose_totals[unit]
                                if all(number(x) for x in loose_values):
                                    if not number(value):
                                        issue('pending', 'data', cell.coordinate, '分单位散件合计缺少数字')
                                    else:
                                        compare('data', cell.coordinate, value, sum(loose_values), '散件合计')
    if 'config' in book:
        ws = book['config']
        config_headers = strip_trailing(ws.row_values(1))
        if config_headers != ['参数', '值', '说明']:
            issue('review', 'config', '1', '模板布局偏差：应为 参数 / 值 / 说明；检查多余空列及说明位置，不代表费用数值错误')
        note_column = config_headers.index('说明') + 1 if '说明' in config_headers else 3
        keys = set()
        for r in range(2, ws.max_row + 1):
            if ws.blank_row(r):
                continue
            key, cell = ws.cell(r, 1).value, ws.cell(r, 2)
            if not isinstance(key, str) or key in keys:
                issue('error', 'config', f'A{r}', '参数名缺失或重复')
            keys.add(key)
            v = read(cell)
            if v in (None, ''):
                if key in {'货柜号', '海运费', '内陆费', '发柜日期', 'ETA'}:
                    issue('pending', 'config', cell.coordinate, f'{key}待补')
            elif key in FEES | RATES:
                if not number(v) or v < 0 or (key in RATES and v == 0):
                    issue('error', 'config', cell.coordinate, '费用须非负数字，汇率须大于 0')
            elif key == '货柜号':
                if not isinstance(v, str) or not re.fullmatch(r'[A-Z]{4}\d{7}', v):
                    issue('error', 'config', cell.coordinate, '柜号须为四个大写字母加七位数字')
            elif key in {'ETA', '发柜日期'}:
                try:
                    if not isinstance(v, (dt.date, dt.datetime)):
                        dt.date.fromisoformat(v)
                except (TypeError, ValueError):
                    issue('error', 'config', cell.coordinate, f'{key} 须为日期或 YYYY-MM-DD')
            else:
                issue('review', 'config', cell.coordinate, f'参数 {key} 无自动业务规则，须 AI 对照来源核对')
            note = read(ws.cell(r, note_column))
            if note is not None and not isinstance(note, str):
                issue('error', 'config', ws.cell(r, note_column).coordinate, '说明必须为文本')
        for key in ({'货柜号', '海运费', '内陆费', '发柜日期', 'ETA'} if standard else {'货柜号', '海运费', '内陆费'}) - keys:
            issue('pending', 'config', 'A', f'缺少参数 {key}')
    return dict(workbook=source, sha256=sha256,
                rows=rows, template_version=2 if standard else 1, columns=headers, issues=issues,
                source_review=dict(status='NOT_PERFORMED', checks=[
                    '对照原件逐行确认柜号、商品、供应商和主条码身份',
                    '核对源行覆盖：遗漏、重复、尾包合并及拆分均有对应关系',
                    '确认每行源单位和销售单位，独立核对数量与单价转换、货值守恒',
                    '核对尺寸、未压缩体积、实际装柜体积及尾包分摊依据',
                    '核对费用范围、币种、承担方、汇率来源和 ETA 查询日期',
                    '检查图片与商品对应及排版']),
                status='ERROR' if any(i['level'] == 'error' for i in issues) else 'PENDING' if any(i['level'] == 'pending' for i in issues) else 'REVIEW' if issues else 'PASS',
                scope='表内列契约与算术；原件归属、单价依据、条码身份、图片、压缩体积和排版须独立核对')


def validate(path):
    path = Path(path)
    return validate_book(load_xlsx(path), str(path.resolve()), hashlib.sha256(path.read_bytes()).hexdigest())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook', type=Path)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    if args.report.resolve() == args.workbook.resolve():
        parser.error('报告不能覆盖输入工作簿')
    result = validate(args.workbook)
    args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"{result['status']}: {result['rows']} rows; {len(result['issues'])} issues; {args.report}")
    return EXIT_CODES[result['status']]


if __name__ == '__main__':
    raise SystemExit(main())
