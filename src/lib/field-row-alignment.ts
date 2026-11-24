export type FieldRowMeasurement = {
  /** First form control's top, relative to its field. */
  controlOffset: number;
  /** Label area's top, relative to its field. */
  labelAreaOffset: number;
  /** Natural height of the label area, including its own wrapping. */
  labelAreaHeight: number;
};

/**
 * Give every label area enough height for the row's highest first control.
 * Existing gaps stay with their own field; later hints and errors are excluded.
 */
export function alignedLabelAreaHeights(fields: FieldRowMeasurement[]): number[] {
  if (fields.length < 2) return fields.map((field) => field.labelAreaHeight);
  const controlTop = Math.max(...fields.map((field) => field.controlOffset));
  return fields.map((field) => {
    const gap = field.controlOffset - field.labelAreaOffset - field.labelAreaHeight;
    return controlTop - field.labelAreaOffset - gap;
  });
}
