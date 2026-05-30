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
    selectable?: boolean;
    selectedIds?: string[];
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
    selectable = false,
    selectedIds = $bindable([]),
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

  const allRowIds = $derived(normalizedRows.map((row) => String(row.id)));
  const allSelected = $derived(
    selectable && allRowIds.length > 0 && allRowIds.every((id) => selectedIds.includes(id)),
  );
  const someSelected = $derived(
    selectable && selectedIds.length > 0 && !allSelected,
  );

  function toggleSelectAll() {
    if (allSelected) {
      selectedIds = [];
    } else {
      selectedIds = [...allRowIds];
    }
  }

  function toggleSelectRow(rowId: string) {
    if (selectedIds.includes(rowId)) {
      selectedIds = selectedIds.filter((id) => id !== rowId);
    } else {
      selectedIds = [...selectedIds, rowId];
    }
  }

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
    'border-border bg-card overflow-hidden rounded-(--radius-card) border shadow-sm',
    className,
  )}
>
  {#if title || description}
    <header class="border-border border-b px-6 py-5">
      {#if title}
        <h3 class="text-foreground text-lg font-semibold">{title}</h3>
      {/if}
      {#if description}
        <p class="text-muted-foreground mt-1 text-sm leading-6">{description}</p>
      {/if}
    </header>
  {/if}

  <div class="overflow-x-auto">
    <table class="divide-border min-w-full divide-y text-sm">
      <thead class="bg-muted/80">
        <tr>
          {#if selectable}
            <th class="px-6 py-4">
              <input
                type="checkbox"
                checked={allSelected}
                indeterminate={someSelected}
                onchange={toggleSelectAll}
                class="border-border accent-jeevatix-600 size-4 cursor-pointer rounded border transition focus:ring-2 focus:ring-jeevatix-600/20"
                aria-label="Pilih semua"
              />
            </th>
          {/if}
          {#each normalizedColumns as column (getColumnKey(column))}
            <th
              class={cn(
                'text-muted-foreground px-6 py-4 font-semibold',
                getAlignClass(getColumnAlign(column)),
              )}
            >
              {getColumnHeader(column)}
            </th>
          {/each}
          {#if rowActions}
            <th class="text-muted-foreground px-6 py-4 text-right font-semibold">{actionHeader}</th>
          {/if}
        </tr>
      </thead>
      <tbody class="divide-border divide-y">
        {#if normalizedRows.length > 0}
          {#each normalizedRows as row, index (row.id ?? index)}
            <tr
              class={cn(
                'transition',
                onRowClick ? 'hover:bg-jeevatix-50/60 cursor-pointer' : 'hover:bg-jeevatix-50/60',
              )}
            >
              {#if selectable}
                <td class="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(String(row.id))}
                    onchange={() => toggleSelectRow(String(row.id))}
                    onclick={(e) => e.stopPropagation()}
                    class="border-border accent-jeevatix-600 size-4 cursor-pointer rounded border transition focus:ring-2 focus:ring-jeevatix-600/20"
                    aria-label="Pilih baris"
                  />
                </td>
              {/if}
              {#each normalizedColumns as column (getColumnKey(column))}
                <td
                  class={cn('text-foreground px-6 py-4', getAlignClass(getColumnAlign(column)))}
                  onclick={() => onRowClick?.(row)}
                >
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
              class="text-muted-foreground px-6 py-10 text-center"
              colspan={normalizedColumns.length + (rowActions ? 1 : 0) + (selectable ? 1 : 0)}
            >
              {emptyMessage}
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</section>
