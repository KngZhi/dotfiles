"""Add dynamic missing-price/category warnings without rewriting workbook data."""
import os
from pathlib import Path
import posixpath
import sys
import tempfile
import xml.etree.ElementTree as ET
from zipfile import ZipFile

NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
ET.register_namespace('', NS)


def tag(name):
    return f'{{{NS}}}{name}'


def highlight(path):
    path = Path(path)
    with ZipFile(path) as archive:
        entries = archive.infolist()
        contents = {entry.filename: archive.read(entry) for entry in entries}
    workbook = ET.fromstring(contents['xl/workbook.xml'])
    sheet = next(s for s in workbook.find(tag('sheets')) if s.get('name') == '成本计算结果')
    relationships = ET.fromstring(contents['xl/_rels/workbook.xml.rels'])
    target = next(r.get('Target') for r in relationships if r.get('Id') == sheet.get(f'{{{REL}}}id'))
    sheet_path = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
    root = ET.fromstring(contents[sheet_path])
    rows = root.find(tag('sheetData')).findall(tag('row'))
    last = max(int(row.get('r')) for row in rows)
    if last < 2:
        return
    styles = ET.fromstring(contents['xl/styles.xml'])
    dxfs = styles.find(tag('dxfs'))
    if dxfs is None:
        dxfs = ET.Element(tag('dxfs'), {'count': '0'})
        # dxfs precedes tableStyles/colors/extLst in the styles schema.
        index = next((i for i, child in enumerate(styles)
                      if child.tag in {tag('tableStyles'), tag('colors'), tag('extLst')}), len(styles))
        styles.insert(index, dxfs)
    dxf = ET.fromstring(f'<dxf xmlns="{NS}"><font><color rgb="FF9C0006"/></font>'
                        '<fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/>'
                        '<bgColor indexed="64"/></patternFill></fill></dxf>')
    serialized = ET.tostring(dxf)
    style_id = next((i for i, old in enumerate(dxfs) if ET.tostring(old) == serialized), len(dxfs))
    if style_id == len(dxfs):
        dxfs.append(dxf)
    dxfs.set('count', str(len(dxfs)))
    rules = [(f'F2:J{last}', 'OR(LEN(TRIM(F2&""))=0,IFERROR(VALUE(F2)=0,FALSE))'),
             (f'Q2:R{last}', 'LEN(TRIM(Q2&""))=0'),
             (f'G2:J{last}', 'IFERROR(AND(VALUE(G2)>0,VALUE($F2)>0,(VALUE(G2)-VALUE($F2))/VALUE(G2)<0.25),FALSE)')]
    priority = max([int(r.get('priority', '0')) for r in root.iter(tag('cfRule'))] or [0])
    for area, formula in rules:
        if any(c.get('sqref') == area and any(f.text == formula for f in c.iter(tag('formula')))
               for c in root.findall(tag('conditionalFormatting'))):
            continue
        priority += 1
        cf = ET.Element(tag('conditionalFormatting'), {'sqref': area})
        rule = ET.SubElement(cf, tag('cfRule'), {'type': 'expression', 'dxfId': str(style_id), 'priority': str(priority)})
        ET.SubElement(rule, tag('formula')).text = formula
        # Conditional formatting follows merged cells, before validation/printing/drawings.
        preceding = {tag(n) for n in ['sheetPr', 'dimension', 'sheetViews', 'sheetFormatPr',
                     'cols', 'sheetData', 'sheetCalcPr', 'sheetProtection', 'protectedRanges',
                     'scenarios', 'autoFilter', 'sortState', 'dataConsolidate', 'customSheetViews',
                     'mergeCells', 'phoneticPr', 'conditionalFormatting']}
        index = next((i for i, child in enumerate(root) if child.tag not in preceding), len(root))
        root.insert(index, cf)
    contents[sheet_path] = ET.tostring(root, encoding='utf-8', xml_declaration=True)
    contents['xl/styles.xml'] = ET.tostring(styles, encoding='utf-8', xml_declaration=True)
    fd, temporary = tempfile.mkstemp(suffix='.xlsx', dir=path.parent)
    os.close(fd)
    try:
        with ZipFile(temporary, 'w') as archive:
            for entry in entries:
                archive.writestr(entry, contents[entry.filename])
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


if __name__ == '__main__':
    highlight(sys.argv[1])
