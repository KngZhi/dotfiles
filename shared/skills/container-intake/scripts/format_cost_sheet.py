"""Apply readable native Google formatting to the existing cost-result tab."""
import sys
from decimal import Decimal
from sheets import connect, open_sheet


def main(ref):
    sh = open_sheet(connect(), ref)
    ws = sh.worksheet('成本计算结果')
    before = ws.get_all_values()
    assert before[0][5:10] == ['成本价', '箱价格', '大包价格', '包价格', '单价']
    assert before[0][16:18] == ['分类1', '分类2']
    sid, end = ws.id, len(before)
    meta = next(s for s in sh.fetch_sheet_metadata()['sheets'] if s['properties']['sheetId'] == sid)
    def area(a=0, b=18, start=0, stop=end):
        return dict(sheetId=sid, startRowIndex=start, endRowIndex=stop, startColumnIndex=a, endColumnIndex=b)
    plain = {'backgroundColor': {'red': 1, 'green': 1, 'blue': 1}, 'textFormat': {'foregroundColor': {'red': 0, 'green': 0, 'blue': 0}, 'fontSize': 10}, 'verticalAlignment': 'MIDDLE', 'wrapStrategy': 'CLIP'}
    req = [{'deleteConditionalFormatRule': {'sheetId': sid, 'index': i}} for i in reversed(range(len(meta.get('conditionalFormats', []))))]
    for rg, fmt in [(area(), plain), (area(stop=1), {**plain, 'textFormat': {**plain['textFormat'], 'bold': True}, 'backgroundColor': {'red': .94, 'green': .94, 'blue': .94}}), (area(2, 4, 1), {**plain, 'wrapStrategy': 'WRAP'}), (area(5, 15, 1), {**plain, 'numberFormat': {'type': 'NUMBER', 'pattern': '#,##0'}})]:
        req.append({'repeatCell': {'range': rg, 'cell': {'userEnteredFormat': fmt}, 'fields': 'userEnteredFormat'}})
    req.append({'updateSheetProperties': {'properties': {'sheetId': sid, 'gridProperties': {'frozenRowCount': 1, 'frozenColumnCount': 1}}, 'fields': 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'}})
    for a, b, width in [(0, 1, 100), (1, 2, 150), (2, 4, 250), (4, 5, 90), (5, 10, 105), (10, 15, 85), (15, 18, 110)]:
        req.append({'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': a, 'endIndex': b}, 'properties': {'pixelSize': width}, 'fields': 'pixelSize'}})
    formulas = ws.get_all_values(value_render_option='FORMULA')
    for r, row in enumerate(before[1:], 1):
        for c in range(5, 15):
            v = row[c] if c < len(row) else ''
            if not v or str(formulas[r][c]).startswith('='):
                continue
            try:
                n = float(v.replace(',', ''))
                if Decimal(str(n)) != Decimal(v.replace(',', '')):
                    continue
            except (ValueError, ArithmeticError):
                continue
            req.append({'updateCells': {'range': area(c, c+1, r, r+1), 'rows': [{'values': [{'userEnteredValue': {'numberValue': n}}]}], 'fields': 'userEnteredValue'}})
    red = {'backgroundColor': {'red': 1, 'green': .88, 'blue': .88}, 'textFormat': {'foregroundColor': {'red': .61, 'green': 0, 'blue': .024}}}
    yellow = {'backgroundColor': {'red': 1, 'green': .96, 'blue': .8}, 'textFormat': {'foregroundColor': {'red': .45, 'green': .3, 'blue': 0}}}
    for i, (rg, formula, fmt) in enumerate([(area(5, 10, 1), '=IFERROR(OR(LEN(TRIM(F2&""))=0,VALUE(F2)<=0),TRUE)', red), (area(16, 18, 1), '=LEN(TRIM(Q2&""))=0', red), (area(6, 10, 1), '=IFERROR(AND(VALUE(G2)>0,VALUE($F2)>0,(VALUE(G2)-VALUE($F2))/VALUE(G2)<0.25),FALSE)', yellow)]):
        req.append({'addConditionalFormatRule': {'index': i, 'rule': {'ranges': [rg], 'booleanRule': {'condition': {'type': 'CUSTOM_FORMULA', 'values': [{'userEnteredValue': formula}]}, 'format': fmt}}}})
    for c in range(5, 10):
        req.append({'updateCells': {'range': area(c,c+1,0,1), 'rows': [{'values': [{'note': '浅红：价格缺失、无效或不大于0，阻断导入。浅黄：毛利率低于25%，需审查。'}]}], 'fields': 'note'}})
    req.append({'autoResizeDimensions': {'dimensions': {'sheetId': sid, 'dimension': 'ROWS', 'startIndex': 0, 'endIndex': end}}})
    assert ws.get_all_values() == before, '表格变化，请重试'
    sh.batch_update({'requests': req})
    after = ws.get_all_values()
    assert len(before) == len(after)
    for old, new in zip(before[1:], after[1:]):
        for c, v in enumerate(old):
            if 5 <= c < 15 and v:
                assert Decimal(v.replace(',', '')) == Decimal(new[c].replace(',', ''))
            else:
                assert v == new[c]
    print(f'格式已更新，{end-1}行值核对一致：{sh.url}#gid={sid}')


if __name__ == '__main__':
    main(sys.argv[1])
