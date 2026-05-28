<script lang="ts">
  import type { Snippet } from 'svelte';

  import { cn } from '../../utils';

  type DataTableColumn = {
    key: string;
    header: string;
    align?: 'left' | 'center' | 'right';
  };

  type DataTableRow = Record<string, unknown>;
  type DataTableColumnView = {
    key: string;
    header: string;
    align?: 'left' | 'center' | 'right';
  };

  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  } as const;

  const getAlignClass = (align: DataTableColumn['align'] = 'left') => alignmentClasses[align];

  type Props = {
    class?: string;
    columns?: DataTableColumn[];
    rows?: DataTableRow[];
    title?: string;
    description?: string;
    emptyMessage?: string;
    actionHeader?: string;
    cell?: Snippet<[DataTableRow, DataTableColumnView]>;
    rowActions?: Snippet<[DataTableRow]>;
    onRowClick?: (row: DataTableRow) => void;
  };

  let {
    class: className = '',
    columns = [],
    rows = [],
    title,
    description,
    emptyMessage = 'No records available.',
    actionHeader = 'Actions',
    cell,
    rowActions,
    onRowClick,
  }: Props = $props();

  const normalizedColumns = $derived(
    columns.map(
      (column): DataTableColumnView => ({
        key: column.key,
        header: column.header,
        align: column.align,
      }),
    ),
  );

  const normalizedRows = $derived(rows.map((row) => ({ ...row })));

  const getCellValue = (row: unknown, key: string) => {
    const value = (row as DataTableRow)[key];

    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return '—';
  };
  const getColumnKey = (column: unknown) => (column as DataTableColumnView).key;
  const getColumnHeader = (column: unknown) => (column as DataTableColumnView).header;
  const getColumnAlign = (column: unknown) => (column as DataTableColumnView).align;
</script>

<section
  class={cn(
    'overflow-hidden rounded-(--radius-card) border border-border bg-card shadow-sm',
    className,
  )}
>
  {#if title || description}
    <header class="border-b border-border px-6 py-5">
      {#if title}
        <h3 class="text-lg font-semibold text-foreground">{title}</h3>
      {/if}
      {#if description}
        <p class="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      {/if}
    </header>
  {/if}

  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-border text-sm">
      <thead class="bg-muted/80">
        <tr>
          {#each normalizedColumns as column (getColumnKey(column))}
            <th
              class={cn(
                'px-6 py-4 font-semibold text-muted-foreground',
                getAlignClass(getColumnAlign(column)),
              )}
            >
              {getColumnHeader(column)}
            </th>
          {/each}
          {#if rowActions}
            <th class="px-6 py-4 text-right font-semibold text-muted-foreground">{actionHeader}</th>
          {/if}
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        {#if normalizedRows.length > 0}
          {#each normalizedRows as row, index (index)}
            <tr
              class={cn(
                'transition',
                onRowClick ? 'hover:bg-jeevatix-50/60 cursor-pointer' : 'hover:bg-jeevatix-50/60',
              )}
              onclick={() => onRowClick?.(row)}
            >
              {#each normalizedColumns as column (getColumnKey(column))}
                <td class={cn('px-6 py-4 text-foreground', getAlignClass(getColumnAlign(column)))}>
                  {#if cell}
                    {@render cell(row, column)}
                  {:else}
                    {getCellValue(row, getColumnKey(column))}
                  {/if}
                </td>
              {/each}
              {#if rowActions}
                <td class="px-6 py-4 text-right">
                  {@render rowActions(row)}
                </td>
              {/if}
            </tr>
          {/each}
        {:else}
          <tr>
            <td
              class="px-6 py-10 text-center text-muted-foreground"
              colspan={normalizedColumns.length + (rowActions ? 1 : 0)}
            >
              {emptyMessage}
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</section>
