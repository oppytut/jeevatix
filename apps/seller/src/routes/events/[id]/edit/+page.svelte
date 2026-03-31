<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import {
    ArrowLeft,
    ArrowRight,
    Check,
    ImagePlus,
    LoaderCircle,
    MapPinned,
    Plus,
    Sparkles,
    Ticket,
    Trash2,
  } from '@lucide/svelte';
  import { Button, Card, Input, Toast } from '@jeevatix/ui';

  import { ApiError, apiGet, apiPatch, apiPost } from '$lib/api';

  type EventStatus =
    | 'draft'
    | 'pending_review'
    | 'published'
    | 'rejected'
    | 'ongoing'
    | 'completed'
    | 'cancelled';

  type CategoryOption = {
    id: number;
    name: string;
    slug: string;
  };

  type SellerEventDetail = {
    id: string;
    title: string;
    description: string | null;
    venue_name: string;
    venue_address: string | null;
    venue_city: string;
    venue_latitude: number | null;
    venue_longitude: number | null;
    start_at: string;
    end_at: string;
    sale_start_at: string;
    sale_end_at: string;
    banner_url: string | null;
    status: EventStatus;
    max_tickets_per_order: number;
    categories: Array<{ id: number; name: string; slug: string }>;
    images: Array<{ id: string; image_url: string; sort_order: number }>;
    tiers: Array<{
      id: string;
      name: string;
      description: string | null;
      price: number;
      quota: number;
      sold_count: number;
      sort_order: number;
      sale_start_at: string | null;
      sale_end_at: string | null;
    }>;
  };

  type EventImageInput = {
    clientId: string;
    image_url: string;
    sort_order: number;
  };

  type TicketTierInput = {
    clientId: string;
    name: string;
    description: string;
    price: string;
    quota: string;
    sort_order: number;
    sale_start_at: string;
    sale_end_at: string;
  };

  type EventFormState = {
    title: string;
    description: string;
    venue_name: string;
    venue_address: string;
    venue_city: string;
    venue_latitude: string;
    venue_longitude: string;
    start_at: string;
    end_at: string;
    sale_start_at: string;
    sale_end_at: string;
    banner_url: string;
    max_tickets_per_order: string;
    category_ids: number[];
    images: EventImageInput[];
    tiers: TicketTierInput[];
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  const steps = [
    { id: 1, label: 'Info Dasar', icon: Sparkles },
    { id: 2, label: 'Lokasi & Waktu', icon: MapPinned },
    { id: 3, label: 'Gambar', icon: ImagePlus },
    { id: 4, label: 'Tier Tiket', icon: Ticket },
    { id: 5, label: 'Review', icon: Check },
  ] as const;

  const fallbackCategoryOptions: CategoryOption[] = [
    { id: 1, name: 'Musik', slug: 'musik' },
    { id: 2, name: 'Olahraga', slug: 'olahraga' },
    { id: 3, name: 'Workshop', slug: 'workshop' },
    { id: 4, name: 'Konser', slug: 'konser' },
    { id: 5, name: 'Festival', slug: 'festival' },
  ];

  const eventId = $derived(page.params.id);

  let currentStep = $state(1);
  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let isUploadingBanner = $state(false);
  let isUploadingGallery = $state(false);
  let pageError = $state('');
  let formError = $state('');
  let toast = $state<ToastState | null>(null);
  let eventDetail = $state<SellerEventDetail | null>(null);
  let form = $state<EventFormState>({
    title: '',
    description: '',
    venue_name: '',
    venue_address: '',
    venue_city: '',
    venue_latitude: '',
    venue_longitude: '',
    start_at: '',
    end_at: '',
    sale_start_at: '',
    sale_end_at: '',
    banner_url: '',
    max_tickets_per_order: '5',
    category_ids: [],
    images: [],
    tiers: [],
  });

  function createClientId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function createEmptyTier(sortOrder: number): TicketTierInput {
    return {
      clientId: createClientId(),
      name: '',
      description: '',
      price: '',
      quota: '',
      sort_order: sortOrder,
      sale_start_at: '',
      sale_end_at: '',
    };
  }

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3600);
  }

  function toDateTimeLocal(value: string | null) {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60_000);
    return localDate.toISOString().slice(0, 16);
  }

  function toIsoString(value: string) {
    return new Date(value).toISOString();
  }

  function toggleCategory(categoryId: number) {
    form.category_ids = form.category_ids.includes(categoryId)
      ? form.category_ids.filter((id) => id !== categoryId)
      : [...form.category_ids, categoryId];
  }

  function addTier() {
    form.tiers = [...form.tiers, createEmptyTier(form.tiers.length)];
  }

  function removeTier(clientId: string) {
    if (form.tiers.length === 1) {
      return;
    }

    form.tiers = form.tiers
      .filter((tier) => tier.clientId !== clientId)
      .map((tier, index) => ({ ...tier, sort_order: index }));
  }

  function removeImage(clientId: string) {
    form.images = form.images
      .filter((image) => image.clientId !== clientId)
      .map((image, index) => ({ ...image, sort_order: index }));
  }

  async function uploadSingleImage(file: File) {
    const body = new FormData();
    body.append('file', file);
    return apiPost<{ url: string }>('/upload', body);
  }

  async function handleBannerUpload(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    isUploadingBanner = true;
    formError = '';

    try {
      const uploaded = await uploadSingleImage(file);
      form.banner_url = uploaded.url;
      setToast({
        title: 'Banner diperbarui',
        description: 'Banner event berhasil diganti.',
        variant: 'success',
      });
    } catch (error) {
      formError = error instanceof ApiError ? error.message : 'Gagal mengunggah banner event.';
    } finally {
      isUploadingBanner = false;
      input.value = '';
    }
  }

  async function handleGalleryUpload(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];

    if (files.length === 0) {
      return;
    }

    isUploadingGallery = true;
    formError = '';

    try {
      const uploads = await Promise.all(files.map((file) => uploadSingleImage(file)));
      form.images = [
        ...form.images,
        ...uploads.map((upload, index) => ({
          clientId: createClientId(),
          image_url: upload.url,
          sort_order: form.images.length + index,
        })),
      ];
      setToast({
        title: 'Galeri diperbarui',
        description: `${uploads.length} gambar baru ditambahkan ke event.`,
        variant: 'success',
      });
    } catch (error) {
      formError = error instanceof ApiError ? error.message : 'Gagal mengunggah galeri event.';
    } finally {
      isUploadingGallery = false;
      input.value = '';
    }
  }

  function populateForm(detail: SellerEventDetail) {
    eventDetail = detail;

    const mergedCategoryOptions = [...fallbackCategoryOptions];
    for (const category of detail.categories) {
      if (!mergedCategoryOptions.some((option) => option.id === category.id)) {
        mergedCategoryOptions.push(category);
      }
    }

    form = {
      title: detail.title,
      description: detail.description ?? '',
      venue_name: detail.venue_name,
      venue_address: detail.venue_address ?? '',
      venue_city: detail.venue_city,
      venue_latitude: detail.venue_latitude?.toString() ?? '',
      venue_longitude: detail.venue_longitude?.toString() ?? '',
      start_at: toDateTimeLocal(detail.start_at),
      end_at: toDateTimeLocal(detail.end_at),
      sale_start_at: toDateTimeLocal(detail.sale_start_at),
      sale_end_at: toDateTimeLocal(detail.sale_end_at),
      banner_url: detail.banner_url ?? '',
      max_tickets_per_order: detail.max_tickets_per_order.toString(),
      category_ids: detail.categories.map((category) => category.id),
      images: detail.images.map((image, index) => ({
        clientId: image.id,
        image_url: image.image_url,
        sort_order: index,
      })),
      tiers: detail.tiers.map((tier, index) => ({
        clientId: tier.id,
        name: tier.name,
        description: tier.description ?? '',
        price: tier.price.toString(),
        quota: tier.quota.toString(),
        sort_order: index,
        sale_start_at: toDateTimeLocal(tier.sale_start_at),
        sale_end_at: toDateTimeLocal(tier.sale_end_at),
      })),
    };

    fallbackCategoryOptions.splice(0, fallbackCategoryOptions.length, ...mergedCategoryOptions);
  }

  function validateStep(step: number) {
    if (step === 1) {
      if (!form.title.trim() || !form.venue_city.trim() || form.category_ids.length === 0) {
        formError = 'Lengkapi title, kota event, dan minimal satu kategori sebelum lanjut.';
        return false;
      }
    }

    if (step === 2) {
      if (!form.venue_name.trim() || !form.start_at || !form.end_at || !form.sale_start_at || !form.sale_end_at) {
        formError = 'Lengkapi venue serta seluruh field waktu penjualan dan event.';
        return false;
      }
    }

    if (step === 4) {
      if (form.tiers.some((tier) => !tier.name.trim() || !tier.price || !tier.quota)) {
        formError = 'Setiap tier wajib punya nama, harga, dan kuota.';
        return false;
      }
    }

    formError = '';
    return true;
  }

  function goToNextStep() {
    if (currentStep < steps.length && validateStep(currentStep)) {
      currentStep += 1;
    }
  }

  function goToPreviousStep() {
    formError = '';
    if (currentStep > 1) {
      currentStep -= 1;
    }
  }

  function buildPayload() {
    return {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      venue_name: form.venue_name.trim(),
      venue_address: form.venue_address.trim() || undefined,
      venue_city: form.venue_city.trim(),
      venue_latitude: form.venue_latitude ? Number(form.venue_latitude) : undefined,
      venue_longitude: form.venue_longitude ? Number(form.venue_longitude) : undefined,
      start_at: toIsoString(form.start_at),
      end_at: toIsoString(form.end_at),
      sale_start_at: toIsoString(form.sale_start_at),
      sale_end_at: toIsoString(form.sale_end_at),
      banner_url: form.banner_url || undefined,
      max_tickets_per_order: Number(form.max_tickets_per_order || 5),
      category_ids: form.category_ids,
      images: form.images.map((image, index) => ({
        image_url: image.image_url,
        sort_order: index,
      })),
      tiers: form.tiers.map((tier, index) => ({
        name: tier.name.trim(),
        description: tier.description.trim() || undefined,
        price: Number(tier.price),
        quota: Number(tier.quota),
        sort_order: index,
        sale_start_at: tier.sale_start_at ? toIsoString(tier.sale_start_at) : undefined,
        sale_end_at: tier.sale_end_at ? toIsoString(tier.sale_end_at) : undefined,
      })),
    };
  }

  async function loadEventDetail() {
    isLoading = true;
    pageError = '';

    try {
      const detail = await apiGet<SellerEventDetail>(`/seller/events/${eventId}`);
      populateForm(detail);
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat detail event untuk diedit.';
    } finally {
      isLoading = false;
    }
  }

  async function submitForm() {
    if (!validateStep(4) || isSubmitting) {
      return;
    }

    isSubmitting = true;
    formError = '';

    try {
      await apiPatch<SellerEventDetail>(`/seller/events/${eventId}`, buildPayload());
      setToast({
        title: 'Event diperbarui',
        description: 'Perubahan event berhasil disimpan.',
        variant: 'success',
      });
      await goto(resolve(`/events/${eventId}`));
    } catch (error) {
      formError = error instanceof ApiError ? error.message : 'Gagal memperbarui event.';
    } finally {
      isSubmitting = false;
    }
  }

  const totalQuota = $derived(form.tiers.reduce((sum, tier) => sum + Number(tier.quota || 0), 0));

  onMount(async () => {
    await loadEventDetail();
  });
</script>

<svelte:head>
  <title>Edit Seller Event | Jeevatix</title>
  <meta
    name="description"
    content="Perbarui event seller yang sudah ada, termasuk jadwal, galeri, dan tier tiket."
  />
</svelte:head>

<section class="space-y-8">
  <div class="rounded-[2rem] border border-slate-200/80 bg-white/92 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">S8</p>
        <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Edit event</h1>
        <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          Revisi informasi event, susun ulang gambar, dan perbarui struktur tier tanpa berpindah workflow seller.
        </p>
      </div>

      <Button variant="outline" type="button" onclick={() => goto(resolve(`/events/${eventId}`))}>
        <ArrowLeft class="mr-2 size-4" />
        Kembali ke detail event
      </Button>
    </div>

    <div class="mt-8 grid gap-3 md:grid-cols-5">
      {#each steps as step (step.id)}
        <button
          class={`rounded-[1.5rem] border px-4 py-4 text-left transition ${currentStep === step.id ? 'border-jeevatix-600 bg-jeevatix-600 text-white' : currentStep > step.id ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50/70 text-slate-600'}`}
          onclick={() => {
            if (step.id <= currentStep || validateStep(currentStep)) {
              currentStep = step.id;
            }
          }}
          type="button"
          disabled={isLoading}
        >
          <step.icon class="size-5" />
          <p class="mt-4 text-xs font-semibold tracking-[0.28em] uppercase">Step {step.id}</p>
          <p class="mt-1 text-sm font-medium">{step.label}</p>
        </button>
      {/each}
    </div>
  </div>

  {#if toast}
    <Toast title={toast.title} description={toast.description} variant={toast.variant} actionLabel={undefined} />
  {/if}

  {#if pageError}
    <Toast title="Gagal memuat event" description={pageError} variant="warning" actionLabel={undefined} />
  {/if}

  {#if formError}
    <Toast title="Perlu perhatian" description={formError} variant="warning" actionLabel={undefined} />
  {/if}

  {#if isLoading}
    <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div class="h-170 animate-pulse rounded-[2rem] border border-slate-200 bg-slate-100"></div>
      <div class="space-y-6">
        <div class="h-56 animate-pulse rounded-[2rem] border border-slate-200 bg-slate-100"></div>
        <div class="h-56 animate-pulse rounded-[2rem] border border-slate-200 bg-slate-100"></div>
      </div>
    </div>
  {:else}
    <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card
        title={steps[currentStep - 1].label}
        description="Perubahan pada event draft atau rejected akan dikirim ulang ke status pending review saat disimpan."
        class="rounded-[2rem] border border-slate-200/80 bg-white/95"
      >
        {#if currentStep === 1}
          <div class="space-y-5">
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="title">Title Event</label>
              <Input id="title" bind:value={form.title} placeholder="Festival Musik Nusantara" required />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="description">Deskripsi</label>
              <textarea
                id="description"
                bind:value={form.description}
                class="min-h-36 w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                placeholder="Tuliskan konsep event, headline performer, dan pengalaman yang akan didapat pembeli tiket."
              ></textarea>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="venue-city">Kota Event</label>
              <Input id="venue-city" bind:value={form.venue_city} placeholder="Jakarta" required />
            </div>

            <div class="space-y-3">
              <div>
                <p class="text-sm font-medium text-slate-700">Kategori</p>
                <p class="mt-1 text-sm text-slate-500">Kategori mengikuti data event saat ini dan seed proyek yang tersedia.</p>
              </div>
              <div class="flex flex-wrap gap-2">
                {#each fallbackCategoryOptions as category (category.id)}
                  <button
                    class={`rounded-full border px-4 py-2 text-sm font-medium transition ${form.category_ids.includes(category.id) ? 'border-jeevatix-600 bg-jeevatix-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-jeevatix-300 hover:bg-jeevatix-50 hover:text-slate-900'}`}
                    onclick={() => toggleCategory(category.id)}
                    type="button"
                  >
                    {category.name}
                  </button>
                {/each}
              </div>
            </div>
          </div>
        {:else if currentStep === 2}
          <div class="space-y-5">
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="venue-name">Venue Name</label>
              <Input id="venue-name" bind:value={form.venue_name} placeholder="Istora Senayan" required />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="venue-address">Venue Address</label>
              <textarea
                id="venue-address"
                bind:value={form.venue_address}
                class="min-h-28 w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                placeholder="Jl. Pintu Satu Senayan, Jakarta Pusat"
              ></textarea>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <label class="text-sm font-medium text-slate-700" for="venue-latitude">Latitude</label>
                <Input id="venue-latitude" bind:value={form.venue_latitude} placeholder="-6.2187" />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium text-slate-700" for="venue-longitude">Longitude</label>
                <Input id="venue-longitude" bind:value={form.venue_longitude} placeholder="106.8022" />
              </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <label class="text-sm font-medium text-slate-700" for="start-at">Start At</label>
                <Input id="start-at" type="datetime-local" bind:value={form.start_at} required />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium text-slate-700" for="end-at">End At</label>
                <Input id="end-at" type="datetime-local" bind:value={form.end_at} required />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium text-slate-700" for="sale-start">Sale Start</label>
                <Input id="sale-start" type="datetime-local" bind:value={form.sale_start_at} required />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium text-slate-700" for="sale-end">Sale End</label>
                <Input id="sale-end" type="datetime-local" bind:value={form.sale_end_at} required />
              </div>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="max-order">Max Tickets per Order</label>
              <Input id="max-order" type="number" min="1" max="20" bind:value={form.max_tickets_per_order} />
            </div>
          </div>
        {:else if currentStep === 3}
          <div class="space-y-6">
            <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
              <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p class="font-semibold text-slate-950">Banner Event</p>
                  <p class="mt-1 text-sm text-slate-500">Ganti banner utama jika positioning visual perlu disegarkan.</p>
                </div>
                <label class="inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-jeevatix-300 hover:bg-jeevatix-50">
                  {#if isUploadingBanner}
                    <LoaderCircle class="mr-2 size-4 animate-spin" />
                    Uploading...
                  {:else}
                    <ImagePlus class="mr-2 size-4" />
                    Ganti Banner
                  {/if}
                  <input class="hidden" type="file" accept="image/*" onchange={handleBannerUpload} disabled={isUploadingBanner} />
                </label>
              </div>
              {#if form.banner_url}
                <img class="mt-5 h-60 w-full rounded-[1.4rem] object-cover" src={form.banner_url} alt="Banner event preview" />
              {:else}
                <div class="mt-5 flex h-52 items-center justify-center rounded-[1.4rem] border border-dashed border-slate-300 bg-white text-sm text-slate-500">Banner belum tersedia.</div>
              {/if}
            </div>

            <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
              <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p class="font-semibold text-slate-950">Galeri Event</p>
                  <p class="mt-1 text-sm text-slate-500">Tambahkan atau hapus visual pendukung sesuai kebutuhan detail page.</p>
                </div>
                <label class="inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-jeevatix-300 hover:bg-jeevatix-50">
                  {#if isUploadingGallery}
                    <LoaderCircle class="mr-2 size-4 animate-spin" />
                    Uploading...
                  {:else}
                    <Plus class="mr-2 size-4" />
                    Tambah Gambar
                  {/if}
                  <input class="hidden" type="file" accept="image/*" multiple onchange={handleGalleryUpload} disabled={isUploadingGallery} />
                </label>
              </div>

              {#if form.images.length > 0}
                <div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {#each form.images as image (image.clientId)}
                    <div class="overflow-hidden rounded-[1.3rem] border border-slate-200 bg-white">
                      <img class="h-40 w-full object-cover" src={image.image_url} alt="Galeri event" />
                      <div class="flex items-center justify-between px-4 py-3">
                        <p class="text-xs font-medium tracking-[0.28em] text-slate-500 uppercase">Sort {image.sort_order}</p>
                        <button class="text-sm font-medium text-rose-700" type="button" onclick={() => removeImage(image.clientId)}>
                          Hapus
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="mt-5 flex h-40 items-center justify-center rounded-[1.4rem] border border-dashed border-slate-300 bg-white text-sm text-slate-500">Belum ada galeri tambahan.</div>
              {/if}
            </div>
          </div>
        {:else if currentStep === 4}
          <div class="space-y-4">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-semibold text-slate-950">Tier tiket</p>
                <p class="mt-1 text-sm text-slate-500">Jika sudah ada penjualan, backend akan menolak penggantian tier secara destruktif.</p>
              </div>
              <Button type="button" variant="outline" onclick={addTier}>
                <Plus class="mr-2 size-4" />
                Tambah Tier
              </Button>
            </div>

            {#each form.tiers as tier, index (tier.clientId)}
              <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="font-semibold text-slate-950">Tier {index + 1}</p>
                    <p class="mt-1 text-sm text-slate-500">Perubahan tier akan diproses ulang saat event disimpan.</p>
                  </div>
                  <button
                    class="inline-flex items-center rounded-full px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                    type="button"
                    onclick={() => removeTier(tier.clientId)}
                    disabled={form.tiers.length === 1}
                  >
                    <Trash2 class="mr-2 size-4" />
                    Hapus
                  </button>
                </div>

                <div class="mt-5 grid gap-4 sm:grid-cols-2">
                  <div class="space-y-2 sm:col-span-2">
                    <label class="text-sm font-medium text-slate-700" for={`tier-name-${tier.clientId}`}>Nama Tier</label>
                    <Input id={`tier-name-${tier.clientId}`} bind:value={tier.name} placeholder="VIP Early Bird" required />
                  </div>
                  <div class="space-y-2 sm:col-span-2">
                    <label class="text-sm font-medium text-slate-700" for={`tier-description-${tier.clientId}`}>Deskripsi</label>
                    <textarea
                      id={`tier-description-${tier.clientId}`}
                      bind:value={tier.description}
                      class="min-h-24 w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      placeholder="Benefit, area duduk, atau akses khusus untuk tier ini."
                    ></textarea>
                  </div>
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-slate-700" for={`tier-price-${tier.clientId}`}>Harga</label>
                    <Input id={`tier-price-${tier.clientId}`} type="number" min="0" bind:value={tier.price} placeholder="350000" required />
                  </div>
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-slate-700" for={`tier-quota-${tier.clientId}`}>Quota</label>
                    <Input id={`tier-quota-${tier.clientId}`} type="number" min="1" bind:value={tier.quota} placeholder="100" required />
                  </div>
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-slate-700" for={`tier-sale-start-${tier.clientId}`}>Sale Start Tier</label>
                    <Input id={`tier-sale-start-${tier.clientId}`} type="datetime-local" bind:value={tier.sale_start_at} />
                  </div>
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-slate-700" for={`tier-sale-end-${tier.clientId}`}>Sale End Tier</label>
                    <Input id={`tier-sale-end-${tier.clientId}`} type="datetime-local" bind:value={tier.sale_end_at} />
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="space-y-6">
            <div class="rounded-[1.5rem] border border-emerald-200 bg-emerald-50/60 p-5">
              <p class="text-sm font-semibold tracking-[0.28em] text-emerald-700 uppercase">Review Ringkas</p>
              <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{form.title || 'Untitled Event'}</h2>
              <p class="mt-2 text-sm leading-6 text-slate-600">{form.description || 'Belum ada deskripsi event.'}</p>
            </div>

            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-[1.3rem] border border-slate-200 bg-slate-50/70 p-4">
                <p class="text-sm text-slate-500">Kategori</p>
                <p class="mt-3 text-lg font-semibold text-slate-950">{form.category_ids.length}</p>
              </div>
              <div class="rounded-[1.3rem] border border-slate-200 bg-slate-50/70 p-4">
                <p class="text-sm text-slate-500">Tier</p>
                <p class="mt-3 text-lg font-semibold text-slate-950">{form.tiers.length}</p>
              </div>
              <div class="rounded-[1.3rem] border border-slate-200 bg-slate-50/70 p-4">
                <p class="text-sm text-slate-500">Potensi Kuota</p>
                <p class="mt-3 text-lg font-semibold text-slate-950">{totalQuota}</p>
              </div>
              <div class="rounded-[1.3rem] border border-slate-200 bg-slate-50/70 p-4">
                <p class="text-sm text-slate-500">Status Saat Ini</p>
                <p class="mt-3 text-lg font-semibold text-slate-950">{eventDetail?.status ?? '—'}</p>
              </div>
            </div>
          </div>
        {/if}

        <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" type="button" onclick={goToPreviousStep} disabled={currentStep === 1 || isSubmitting}>
            <ArrowLeft class="mr-2 size-4" />
            Kembali
          </Button>

          {#if currentStep < 5}
            <Button type="button" onclick={goToNextStep}>
              Lanjut
              <ArrowRight class="ml-2 size-4" />
            </Button>
          {:else}
            <Button type="button" onclick={submitForm} disabled={isSubmitting}>
              {#if isSubmitting}
                <LoaderCircle class="mr-2 size-4 animate-spin" />
                Menyimpan...
              {:else}
                Simpan Perubahan
              {/if}
            </Button>
          {/if}
        </div>
      </Card>

      <div class="space-y-6">
        <Card
          title="Status edit"
          description="Konsekuensi update mengikuti aturan backend seller event."
          class="rounded-[2rem] border border-slate-200/80 bg-white/95"
        >
          <div class="space-y-3 text-sm text-slate-600">
            <p><span class="font-semibold text-slate-900">Draft / Rejected</span> akan berpindah ke pending review setelah disimpan.</p>
            <p><span class="font-semibold text-slate-900">Published / Ongoing</span> tetap butuh hati-hati karena perubahan tier destruktif akan ditolak jika sudah ada penjualan.</p>
            <p><span class="font-semibold text-slate-900">Galeri dan banner</span> bisa diperbarui kapan saja selama payload valid.</p>
          </div>
        </Card>

        <Card
          title="Preview operasi"
          description="Ringkasan cepat untuk final check sebelum patch request dikirim."
          class="rounded-[2rem] border border-slate-200/80 bg-white/95"
        >
          <div class="space-y-4 text-sm text-slate-600">
            <div class="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 p-4">
              <p class="text-xs font-semibold tracking-[0.26em] text-slate-500 uppercase">Banner</p>
              <p class="mt-2 text-base font-semibold text-slate-950">{form.banner_url ? 'Ready' : 'Belum ada'}</p>
            </div>
            <div class="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 p-4">
              <p class="text-xs font-semibold tracking-[0.26em] text-slate-500 uppercase">Sale Window</p>
              <p class="mt-2 text-base font-semibold text-slate-950">{form.sale_start_at || '—'} → {form.sale_end_at || '—'}</p>
            </div>
            <div class="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 p-4">
              <p class="text-xs font-semibold tracking-[0.26em] text-slate-500 uppercase">Gallery</p>
              <p class="mt-2 text-base font-semibold text-slate-950">{form.images.length} gambar</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  {/if}
</section>