import { defineOption, defineType } from '../../../runtime/core';

const TableCellStyleType = defineType('tableCellStyle', {
  label: 'Table cell style',
  optionLabel: (value: string) => value,
});

defineOption(TableCellStyleType, 'Bold');
defineOption(TableCellStyleType, 'Italic');
defineOption(TableCellStyleType, 'Positive vs Negative');

export default TableCellStyleType;
