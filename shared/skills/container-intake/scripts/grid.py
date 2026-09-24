"""Uniform read-only cell grid over an xlsx file or Google Sheets value matrices."""
from dataclasses import dataclass
import re

from openpyxl.utils import get_column_letter

SHEET_ERROR = re.compile(r'#(NULL!|DIV/0!|VALUE!|REF!|NAME\?|NUM!|N/A|ERROR!)')


@dataclass(frozen=True)
class Cell:
    sheet: str
    coordinate: str
    value: object  # computed value; None when blank or when a formula has no usable result
    formula: bool = False
    error: bool = False
    stale: bool = False  # formula without any cached result (xlsx saved without recalculation)


class Sheet:
    def __init__(self, title, cells, max_row, max_column):
        self.title = title
        self._cells = cells
        self.max_row = max(max_row, 1)
        self.max_column = max(max_column, 1)

    def cell(self, row, column):
        key = (row, column)
        if key not in self._cells:
            self._cells[key] = Cell(self.title, f'{get_column_letter(column)}{row}', None)
        return self._cells[key]

    def row_values(self, row):
        return [self.cell(row, c).value for c in range(1, self.max_column + 1)]

    def blank_row(self, row):
        return all(v is None for v in self.row_values(row))


class Book:
    def __init__(self, sheets):
        self.sheets = {s.title: s for s in sheets}

    def __contains__(self, title):
        return title in self.sheets

    def __getitem__(self, title):
        return self.sheets[title]


def load_xlsx(path):
    import openpyxl
    formulas = openpyxl.load_workbook(path, data_only=False)
    cache = openpyxl.load_workbook(path, data_only=True)
    sheets = []
    for ws in formulas:
        cached = cache[ws.title]
        cells = {}
        for row in ws.iter_rows():
            for c in row:
                if c.value is None:
                    continue
                if c.data_type == 'e':
                    cells[(c.row, c.column)] = Cell(ws.title, c.coordinate, None, error=True)
                elif c.data_type == 'f':
                    v = cached[c.coordinate]
                    if v.value is None or v.data_type == 'e':
                        cells[(c.row, c.column)] = Cell(ws.title, c.coordinate, None, formula=True, stale=True)
                    else:
                        cells[(c.row, c.column)] = Cell(ws.title, c.coordinate, None if v.value == '' else v.value, formula=True)
                else:
                    cells[(c.row, c.column)] = Cell(ws.title, c.coordinate, c.value)
        sheets.append(Sheet(ws.title, cells, ws.max_row, ws.max_column))
    formulas.close()
    cache.close()
    return Book(sheets)


def book_from_matrices(values, formulas):
    """values: {title: [[computed]]} (UNFORMATTED_VALUE, dates as ISO strings); formulas: {title: [[FORMULA render]]}."""
    sheets = []
    for title, grid in values.items():
        fgrid = formulas.get(title, [])
        cells = {}
        max_column = 0
        for r, row in enumerate(grid, start=1):
            max_column = max(max_column, len(row))
            for c, v in enumerate(row, start=1):
                frow = fgrid[r - 1] if r - 1 < len(fgrid) else []
                f = frow[c - 1] if c - 1 < len(frow) else ''
                is_formula = isinstance(f, str) and f.startswith('=')
                coordinate = f'{get_column_letter(c)}{r}'
                if isinstance(v, str) and SHEET_ERROR.fullmatch(v):
                    cells[(r, c)] = Cell(title, coordinate, None, formula=is_formula, error=True)
                elif v == '' or v is None:
                    if is_formula:
                        cells[(r, c)] = Cell(title, coordinate, None, formula=True)
                else:
                    cells[(r, c)] = Cell(title, coordinate, v, formula=is_formula)
        sheets.append(Sheet(title, cells, len(grid), max_column))
    return Book(sheets)
