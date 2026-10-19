// Общее оформление осей, сетки и тултипов Recharts — через токены темы,
// чтобы графики не выбивались из нейтральной палитры интерфейса.
export const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' };
export const AXIS_LINE = { stroke: 'var(--border)' };
export const GRID_STROKE = 'var(--border)';
export const CURSOR_FILL = 'var(--muted)';
export const TOOLTIP_STYLE = {
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
  fontSize: '12px',
};
