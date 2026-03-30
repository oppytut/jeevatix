<script lang="ts">
	import { cn } from '../../utils';

	type DataTableColumn = {
		key: string;
		header: string;
		align?: 'left' | 'center' | 'right';
	};

	type DataTableRow = Record<string, string | number | boolean | null | undefined>;
	type DataTableColumnView = {
		key: string;
		header: string;
		align?: 'left' | 'center' | 'right';
	};

	const alignmentClasses = {
		left: 'text-left',
		center: 'text-center',
		right: 'text-right'
	} as const;

	const getAlignClass = (align: DataTableColumn['align'] = 'left') => alignmentClasses[align];

	let className = '';
	export { className as class };

	export let columns: DataTableColumn[] = [];
	export let rows: DataTableRow[] = [];
	export let title: string | undefined;
	export let description: string | undefined;
	export let emptyMessage = 'No records available.';

	let normalizedColumns: DataTableColumnView[] = [];
	let normalizedRows: DataTableRow[] = [];

	$: normalizedColumns = columns.map((column): DataTableColumnView => ({
		key: column.key,
		header: column.header,
		align: column.align
	}));

	$: normalizedRows = rows.map((row) => ({ ...row }));

	const getCellValue = (row: unknown, key: string) => (row as DataTableRow)[key] ?? '—';
	const getColumnKey = (column: unknown) => (column as DataTableColumnView).key;
	const getColumnHeader = (column: unknown) => (column as DataTableColumnView).header;
	const getColumnAlign = (column: unknown) => (column as DataTableColumnView).align;
</script>

<section class={cn('overflow-hidden rounded-(--radius-card) border border-slate-200/80 bg-white shadow-sm', className)}>
	{#if title || description}
		<header class="border-b border-slate-100 px-6 py-5">
			{#if title}
				<h3 class="text-lg font-semibold text-slate-950">{title}</h3>
			{/if}
			{#if description}
				<p class="mt-1 text-sm leading-6 text-slate-600">{description}</p>
			{/if}
		</header>
	{/if}

	<div class="overflow-x-auto">
		<table class="min-w-full divide-y divide-slate-100 text-sm">
			<thead class="bg-slate-50/80">
				<tr>
					{#each normalizedColumns as column (getColumnKey(column))}
						<th class={cn('px-6 py-4 font-semibold text-slate-600', getAlignClass(getColumnAlign(column)))}>
							{getColumnHeader(column)}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if normalizedRows.length > 0}
					{#each normalizedRows as row, index (index)}
						<tr class="transition hover:bg-jeevatix-50/60">
							{#each normalizedColumns as column (getColumnKey(column))}
								<td class={cn('px-6 py-4 text-slate-700', getAlignClass(getColumnAlign(column)))}>
									{getCellValue(row, getColumnKey(column))}
								</td>
							{/each}
						</tr>
					{/each}
				{:else}
					<tr>
						<td class="px-6 py-10 text-center text-slate-500" colspan={normalizedColumns.length}>
							{emptyMessage}
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</section>