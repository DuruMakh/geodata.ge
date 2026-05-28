import type { ReactNode } from "react";

type ChildrenProps = {
  children: ReactNode;
};

type TestIdProps = ChildrenProps & {
  testId?: string;
};

type ChartPanelProps = ChildrenProps & {
  mode?: string;
  measure?: string;
  toolbar?: ReactNode;
  legend?: ReactNode;
  rangeStrip?: ReactNode;
};

export function ScreenCard({ children }: ChildrenProps) {
  return (
    <section
      data-testid="screen-card"
      className="rounded-[24px] bg-[var(--surface)] p-4 shadow-[0_20px_40px_var(--shadow)] sm:p-6"
    >
      {children}
    </section>
  );
}

export function ContentSection({ children, testId }: TestIdProps) {
  return (
    <section
      data-testid={testId}
      className="rounded-[24px] border border-[var(--hairline)] bg-[var(--surface)] p-4 shadow-[0_20px_40px_var(--shadow)] sm:p-5"
    >
      {children}
    </section>
  );
}

export function ChartPanel({ children, mode, measure, toolbar, legend, rangeStrip }: ChartPanelProps) {
  return (
    <section
      data-testid="chart-panel"
      data-mode={mode}
      data-measure={measure}
      className="min-w-0"
    >
      <div data-testid="chart-plot" className="rounded-[20px] bg-[var(--canvas)] px-5 pb-5 pt-4">
        {toolbar ? <div data-testid="chart-toolbar" className="mb-5">{toolbar}</div> : null}
        {children}
      </div>
      {mode !== "table" && legend ? <div className="mt-3">{legend}</div> : null}
      {mode !== "table" && rangeStrip ? <div className="mt-4">{rangeStrip}</div> : null}
    </section>
  );
}

export function TableSurface({ children, testId }: TestIdProps) {
  return (
    <div
      data-testid={testId}
      className="overflow-x-auto rounded-[12px] border border-[var(--hairline)] bg-[var(--surface)]"
    >
      {children}
    </div>
  );
}

export function StatusSurface({ children }: ChildrenProps) {
  return (
    <div className="rounded-[16px] border border-[var(--hairline)] bg-[var(--soft)] p-4 text-sm text-[var(--body)]">
      {children}
    </div>
  );
}
