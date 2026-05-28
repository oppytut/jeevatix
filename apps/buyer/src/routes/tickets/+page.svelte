<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Ticket,
    TicketCheck,
  } from '@lucide/svelte';

  import { Button, Card } from '@jeevatix/ui';

  import type { BuyerTicketListItem, PaginationMeta } from '$lib/api';
  import { formatEventDateRange, formatRelativeTime } from '$lib/utils';

  type TicketsPageData = {
    tickets: BuyerTicketListItem[];
    meta: PaginationMeta;
  };

  type TicketGroup = {
    eventId: string;
    eventTitle: string;
    eventSlug: string;
    eventStartAt: string;
    venueName: string;
    venueCity: string;
    tickets: BuyerTicketListItem[];
  };

  let { data }: { data: TicketsPageData } = $props();

  function maskTicketCode(ticketCode: string) {
    const prefix = ticketCode.slice(0, 8);
    const suffix = ticketCode.slice(-4);
    return `${prefix}****${suffix}`;
  }

  function getStatusTone(status: BuyerTicketListItem['status']) {
    switch (status) {
      case 'used':
        return 'bg-muted text-foreground';
      case 'cancelled':
        return 'bg-rose-100 text-rose-700';
      case 'refunded':
        return 'bg-sky-100 text-sky-700';
      default:
        return 'bg-emerald-100 text-emerald-700';
    }
  }

  function getGroupedTickets() {
    const grouped: Record<string, TicketGroup> = {};

    for (const ticket of data.tickets) {
      const existingGroup = grouped[ticket.event_id];

      if (existingGroup) {
        existingGroup.tickets.push(ticket);
        continue;
      }

      grouped[ticket.event_id] = {
        eventId: ticket.event_id,
        eventTitle: ticket.event_title,
        eventSlug: ticket.event_slug,
        eventStartAt: ticket.event_start_at,
        venueName: ticket.venue_name,
        venueCity: ticket.venue_city,
        tickets: [ticket],
      };
    }

    return Object.values(grouped);
  }

  function goToTicket(ticketId: string) {
    void goto(resolve('/tickets/[id]', { id: ticketId }));
  }

  function goToPage(page: number) {
    if (page < 1 || page > data.meta.totalPages || page === data.meta.page) {
      return;
    }

    window.location.assign(`${resolve('/tickets')}?page=${page}`);
  }

  function getVisiblePages() {
    if (data.meta.totalPages <= 1) {
      return [1];
    }

    const start = Math.max(1, data.meta.page - 1);
    const end = Math.min(data.meta.totalPages, start + 2);
    const adjustedStart = Math.max(1, end - 2);

    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }
</script>

<svelte:head>
  <title>Tiket Saya | Jeevatix</title>
  <meta
    name="description"
    content="Akses semua tiket event Anda di Jeevatix, lengkap dengan status tiket dan detail event yang akan datang."
  />
</svelte:head>

<section class="space-y-8 py-6 sm:py-8 lg:py-10">
  <div
    class="rounded-[2.5rem] border border-white/80 bg-[var(--gradient-section-alt)] p-7 shadow-[0_26px_90px_rgba(15,23,42,0.08)] sm:p-9"
  >
    <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.3em] uppercase">
          Tickets
        </p>
        <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          Semua tiket Anda siap dipakai kapan saja.
        </h1>
        <p class="text-muted-foreground max-w-3xl text-base leading-7 sm:text-lg">
          Simpan akses cepat ke tiket aktif, lihat event yang akan datang, dan buka QR code tiket
          hanya dalam satu langkah.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="bg-card/80 rounded-[1.5rem] border border-white/70 px-5 py-4 backdrop-blur">
          <p class="text-muted-foreground text-xs font-semibold tracking-[0.24em] uppercase">
            Total Tickets
          </p>
          <p class="text-foreground mt-2 text-3xl font-semibold">{data.meta.total}</p>
        </div>
        <div class="bg-card/80 rounded-[1.5rem] border border-white/70 px-5 py-4 backdrop-blur">
          <p class="text-muted-foreground text-xs font-semibold tracking-[0.24em] uppercase">
            Grouped Events
          </p>
          <p class="text-foreground mt-2 text-3xl font-semibold">{getGroupedTickets().length}</p>
        </div>
      </div>
    </div>
  </div>

  <Card
    class="bg-card/92 rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
  >
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
          Ticket Wallet
        </p>
        <h2 class="text-foreground mt-2 text-3xl font-semibold tracking-tight">
          Daftar tiket buyer
        </h2>
      </div>

      <div class="bg-muted text-muted-foreground rounded-full px-4 py-2 text-sm">
        Menampilkan {data.tickets.length} dari {data.meta.total} tiket
      </div>
    </div>

    {#if data.tickets.length === 0}
      <div
        class="border-border bg-muted mt-8 rounded-[1.75rem] border border-dashed px-6 py-14 text-center"
      >
        <div
          class="bg-muted text-muted-foreground mx-auto flex size-16 items-center justify-center rounded-full"
        >
          <Ticket class="size-7" />
        </div>
        <h3 class="text-foreground mt-5 text-2xl font-semibold tracking-tight">
          Belum ada tiket aktif
        </h3>
        <p class="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-7">
          Setelah pembayaran sukses, tiket Anda akan otomatis muncul di sini lengkap dengan kode
          tiket dan detail event.
        </p>
        <Button class="mt-6 rounded-full px-5" onclick={() => goto(resolve('/events'))}
          >Jelajahi Event</Button
        >
      </div>
    {:else}
      <div class="mt-8 space-y-6">
        {#each getGroupedTickets() as group (group.eventId)}
          <section class="border-border bg-muted space-y-4 rounded-[1.75rem] border p-5 sm:p-6">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p class="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
                  {group.tickets.length} tiket
                </p>
                <h3 class="text-foreground mt-2 text-2xl font-semibold tracking-tight">
                  {group.eventTitle}
                </h3>
                <div
                  class="text-muted-foreground mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
                >
                  <span class="inline-flex items-center gap-2">
                    <CalendarDays class="size-4 text-emerald-700" />
                    {formatEventDateRange(group.eventStartAt)}
                  </span>
                  <span class="inline-flex items-center gap-2">
                    <MapPin class="size-4 text-orange-700" />
                    {group.venueName}, {group.venueCity}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                class="rounded-full px-5"
                onclick={() => goto(resolve('/events/[slug]', { slug: group.eventSlug }))}
              >
                Lihat Event
              </Button>
            </div>

            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {#each group.tickets as ticket (ticket.id)}
                <button
                  type="button"
                  class="bg-card hover:border-border rounded-[1.5rem] border border-white/80 p-5 text-left shadow-[0_18px_50px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_55px_rgba(15,23,42,0.10)]"
                  onclick={() => goToTicket(ticket.id)}
                >
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <p
                        class="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase"
                      >
                        {ticket.order_number}
                      </p>
                      <h4 class="text-foreground mt-2 text-lg font-semibold">{ticket.tier_name}</h4>
                    </div>
                    <span
                      class={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.2em] uppercase ${getStatusTone(ticket.status)}`}
                    >
                      {ticket.status}
                    </span>
                  </div>

                  <div class="mt-5 space-y-3">
                    <div class="bg-muted rounded-2xl px-4 py-3">
                      <p
                        class="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase"
                      >
                        Kode Tiket
                      </p>
                      <p
                        class="text-foreground mt-2 font-mono text-sm font-semibold tracking-[0.22em]"
                      >
                        {maskTicketCode(ticket.ticket_code)}
                      </p>
                    </div>

                    <div
                      class="bg-muted text-muted-foreground flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
                    >
                      <TicketCheck class="mt-0.5 size-4 text-emerald-700" />
                      <div>
                        <p class="text-foreground font-medium">
                          Diterbitkan {formatRelativeTime(ticket.issued_at)}
                        </p>
                        <p class="mt-1">Tap untuk membuka detail dan QR code tiket.</p>
                      </div>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          </section>
        {/each}
      </div>

      {#if data.meta.totalPages > 1}
        <div class="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-muted-foreground text-sm">
            Halaman {data.meta.page} dari {data.meta.totalPages}
          </p>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              class="rounded-full px-4"
              disabled={data.meta.page <= 1}
              onclick={() => goToPage(data.meta.page - 1)}
            >
              <ChevronLeft class="size-4" />
              Sebelumnya
            </Button>

            {#each getVisiblePages() as pageNumber (pageNumber)}
              <button
                type="button"
                class={`flex size-11 items-center justify-center rounded-full border text-sm font-semibold transition ${pageNumber === data.meta.page ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:border-border hover:bg-muted'}`}
                onclick={() => goToPage(pageNumber)}
              >
                {pageNumber}
              </button>
            {/each}

            <Button
              type="button"
              variant="outline"
              class="rounded-full px-4"
              disabled={data.meta.page >= data.meta.totalPages}
              onclick={() => goToPage(data.meta.page + 1)}
            >
              Berikutnya
              <ChevronRight class="size-4" />
            </Button>
          </div>
        </div>
      {/if}
    {/if}
  </Card>
</section>
