import { defineType } from '../../../runtime/core';

const ColorType = defineType('color', {
  label: 'Color',
  optionLabel: (value: string) => value.toUpperCase(),
});

export default ColorType;
