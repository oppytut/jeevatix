<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import PartySocket from 'partysocket';
  import { env } from '$env/dynamic/public';

  export type LiveAvailabilityTier = {
    tierId: string;
    remaining: number;
    name?: string;
    quota?: number;
  };

  type Props = {
    eventId: string;
    initialTiers: LiveAvailabilityTier[];
    onAvailabilityChange?: (tiers: LiveAvailabilityTier[]) => void;
  };

  let { eventId, initialTiers, onAvailabilityChange }: Props = $props();

  let tiers = $state<LiveAvailabilityTier[]>([]);
  let socket: PartySocket | null = null;

  function normalizeTiers(nextTiers: LiveAvailabilityTier[]) {
    return nextTiers.map((tier, index) => ({
      tierId: tier.tierId,
      remaining: Math.max(0, tier.remaining),
      name: tier.name ?? `Tier ${index + 1}`,
      quota: tier.quota,
    }));
  }

  function emitChange(nextTiers: LiveAvailabilityTier[]) {
    onAvailabilityChange?.(nextTiers);
  }

  function setTiers(nextTiers: LiveAvailabilityTier[]) {
    const normalized = normalizeTiers(nextTiers);
    tiers = normalized;
    emitChange(normalized);
  }

  function mergeAvailability(
    currentTiers: LiveAvailabilityTier[],
    updates: Array<{ tierId: string; remaining: number }>,
  ) {
    const updateMap = new Map(updates.map((item) => [item.tierId, item.remaining]));

    return currentTiers.map((tier) => ({
      ...tier,
      remaining: updateMap.has(tier.tierId)
        ? Math.max(0, updateMap.get(tier.tierId) ?? tier.remaining)
        : tier.remaining,
    }));
  }

  function getTone(remaining: number, quota?: number) {
    if (remaining <= 0) {
      return 'bg-slate-950 text-white';
    }

    const ratio = quota && quota > 0 ? remaining / quota : 1;

    if (ratio <= 0.1) {
      return 'bg-rose-100 text-rose-700';
    }

    if (ratio <= 0.5) {
      return 'bg-amber-100 text-amber-700';
    }

    return 'bg-emerald-100 text-emerald-700';
  }

  function handleMessage(event: MessageEvent<string>) {
    try {
      const parsed = JSON.parse(event.data) as {
        type?: string;
        data?: Array<{ tierId: string; remaining: number }>;
      };

      if (parsed.type !== 'availability' || !Array.isArray(parsed.data)) {
        return;
      }

      const nextTiers = mergeAvailability(tiers, parsed.data);
      setTiers(nextTiers);
    } catch {
      return;
    }
  }

  onMount(() => {
    setTiers(initialTiers);

    if (!env.PUBLIC_PARTYKIT_HOST) {
      return;
    }

    socket = new PartySocket({
      host: env.PUBLIC_PARTYKIT_HOST,
      party: 'main',
      room: `event-${eventId}`,
      minReconnectionDelay: 1000,
      maxReconnectionDelay: 5000,
    });

    socket.addEventListener('message', handleMessage as EventListener);

    return () => {
      socket?.removeEventListener('message', handleMessage as EventListener);
      socket?.close();
      socket = null;
    };
  });

  onDestroy(() => {
    socket?.close();
  });
</script>

<div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
  <div class="flex items-center justify-between gap-4">
    <div>
      <p class="text-sm font-semibold tracking-[0.24em] text-slate-500 uppercase">
        Live Availability
      </p>
      <p class="mt-2 text-sm leading-6 text-slate-600">
        Ketersediaan tiket diperbarui otomatis tanpa refresh halaman.
      </p>
    </div>
    <div
      class="rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-[0.2em] text-slate-600 uppercase"
    >
      Live
    </div>
  </div>

  <div class="mt-4 grid gap-3">
    {#each tiers as tier (tier.tierId)}
      <div
        class="flex items-center justify-between gap-4 rounded-[1.25rem] border border-white bg-white px-4 py-3 shadow-sm"
      >
        <div>
          <p class="text-sm font-semibold text-slate-950">{tier.name}</p>
          <p class="mt-1 text-sm text-slate-600">Sisa: {tier.remaining} tiket</p>
        </div>
        <span
          class={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.2em] uppercase ${getTone(tier.remaining, tier.quota)}`}
        >
          {tier.remaining <= 0 ? 'Sold Out' : `${tier.remaining} Left`}
        </span>
      </div>
    {/each}
  </div>
</div>
