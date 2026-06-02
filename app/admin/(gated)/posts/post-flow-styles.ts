const summaryButtonBase =
  'rounded border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500';

export function pickerSummaryButtonClassName(hasAttachedFlows: boolean): string {
  return hasAttachedFlows
    ? `${summaryButtonBase} border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900`
    : `${summaryButtonBase} border-neutral-300 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800`;
}

export const pickerPanelClassName =
  'absolute right-0 z-10 mt-1 w-64 space-y-1 rounded border border-neutral-200 bg-white p-2 text-neutral-900 shadow-lg dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100';
