import xlrd
import pprint
import json

book = 'questions.xlsx'

def parseSheet(sheet):
    data = []
    for row in range(0, sheet.nrows):
        if(not sheet.row_values(row)[0]):
            continue
        else:
            data.append(sheet.row_values(row)[0])
    return data

def parseWorkbook(path):
    data = []
    workbook = xlrd.open_workbook(path)
    for sheet in workbook.sheet_names():
        if workbook.sheet_by_name(sheet).nrows:
            data = (parseSheet(workbook.sheet_by_name(sheet)))
    return data

pprint.pprint(parseWorkbook(book))
with open('questions.json', 'w') as outfile:
    json.dump(parseWorkbook(book), outfile, sort_keys = True, indent = 4,
               ensure_ascii = False)