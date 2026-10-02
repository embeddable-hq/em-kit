import { defineType } from '../../../runtime/core';

const MarkdownType = defineType('markdown', {
  label: 'Markdown',
  optionLabel: (value: string) => value.toUpperCase(),
});

export default MarkdownType;
