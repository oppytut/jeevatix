<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import {
    ArrowLeft,
    ArrowRight,
    CalendarRange,
    Check,
    ImagePlus,
    LoaderCircle,
    MapPinned,
    Plus,
    Sparkles,
    Ticket,
    Trash2,
  } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { Button, Card, Input, Textarea, Toast } from '@jeevatix/ui';

  import { ApiError, apiGet, apiPost } from '$lib/api';

  type CategoryOption = {
    id: number;
    name: string;
    slug: string;
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

  type SellerEventDetail = {
    id: string;
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

  let categoryOptions = $state<CategoryOption[]>([]);
  let isCategoriesLoading = $state(true);

  let currentStep = $state(1);
  let isSubmitting = $state(false);
  let isUploadingBanner = $state(false);
  let isUploadingGallery = $state(false);
  let formError = $state('');
  let toast = $state<ToastState | null>(null);
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
    tiers: [createEmptyTier(0)],
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
        title: 'Banner terunggah',
        description: 'Banner event siap dipakai pada preview dan publikasi.',
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
        description: `${uploads.length} gambar berhasil ditambahkan ke galeri event.`,
        variant: 'success',
      });
    } catch (error) {
      formError = error instanceof ApiError ? error.message : 'Gagal mengunggah galeri event.';
    } finally {
      isUploadingGallery = false;
      input.value = '';
    }
  }

  function validateStep(step: number) {
    if (step === 1) {
      if (!form.title.trim() || !form.venue_city.trim() || form.category_ids.length === 0) {
        formError = 'Lengkapi title, kota event, dan minimal satu kategori sebelum lanjut.';
        return false;
      }
    }

    if (step === 2) {
      if (
        !form.venue_name.trim() ||
        !form.start_at ||
        !form.end_at ||
        !form.sale_start_at ||
        !form.sale_end_at
      ) {
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

  async function submitForm() {
    if (!validateStep(4) || isSubmitting) {
      return;
    }

    isSubmitting = true;
    formError = '';

    try {
      const createdEvent = await apiPost<SellerEventDetail>('/seller/events', buildPayload());
      setToast({
        title: 'Event dibuat',
        description: 'Event baru berhasil disimpan sebagai draft seller.',
        variant: 'success',
      });
      await goto(resolve(`/events/${createdEvent.id}`));
    } catch (error) {
      formError = error instanceof ApiError ? error.message : 'Gagal membuat event baru.';
    } finally {
      isSubmitting = false;
    }
  }

  const soldPotential = $derived(
    form.tiers.reduce((sum, tier) => sum + Number(tier.quota || 0), 0),
  );

  onMount(async () => {
    try {
      const categories = await apiGet<CategoryOption[]>('/categories', { requiresAuth: false });
      categoryOptions = categories;
    } catch {
      categoryOptions = [];
    } finally {
      isCategoriesLoading = false;
    }
  });
</script>

<svelte:head>
  <title>Create Seller Event | Jeevatix</title>
  <meta
    name="description"
    content="Buat event seller baru melalui form multi-step untuk info dasar, lokasi, gambar, dan tier tiket."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="border-border bg-card/90 rounded-[2rem] border p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10"
  >
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.32em] uppercase">S7</p>
        <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          Buat event baru
        </h1>
        <p class="text-muted-foreground max-w-3xl text-base leading-7 sm:text-lg">
          Susun event dari info dasar sampai tier tiket dalam satu alur kerja seller. Event akan
          disimpan sebagai draft terlebih dulu.
        </p>
      </div>

      <Button variant="outline" type="button" onclick={() => goto(resolve('/events'))}>
        <ArrowLeft class="mr-2 size-4" />
        Kembali ke daftar event
      </Button>
    </div>

    <div class="mt-8 grid gap-3 md:grid-cols-5">
      {#each steps as step (step.id)}
        <button
          class={`rounded-[1.5rem] border px-4 py-4 text-left transition ${currentStep === step.id ? 'border-jeevatix-600 bg-jeevatix-600 text-white' : currentStep > step.id ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-border bg-muted/70 text-muted-foreground'}`}
          onclick={() => {
            if (step.id <= currentStep || validateStep(currentStep)) {
              currentStep = step.id;
            }
          }}
          type="button"
        >
          <step.icon class="size-5" />
          <p class="mt-4 text-xs font-semibold tracking-[0.28em] uppercase">Step {step.id}</p>
          <p class="mt-1 text-sm font-medium">{step.label}</p>
        </button>
      {/each}
    </div>
  </div>

  {#if toast}
    <Toast
      title={toast.title}
      description={toast.description}
      variant={toast.variant}
      actionLabel={undefined}
    />
  {/if}

  {#if formError}
    <Toast
      title="Perlu perhatian"
      description={formError}
      variant="warning"
      actionLabel={undefined}
    />
  {/if}

  <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
    <Card
      title={steps[currentStep - 1].label}
      description="Lengkapi informasi di tiap langkah sebelum lanjut ke review akhir."
      class="border-border bg-card/95 rounded-[2rem] border"
    >
      {#if currentStep === 1}
        <div class="space-y-5">
          <div class="space-y-2">
            <label class="text-foreground text-sm font-medium" for="title">Title Event</label>
            <Input
              id="title"
              bind:value={form.title}
              placeholder="Festival Musik Nusantara"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-foreground text-sm font-medium" for="description">Deskripsi</label>
            <Textarea
              id="description"
              bind:value={form.description}
              class="min-h-36"
              placeholder="Tuliskan konsep event, headline performer, dan pengalaman yang akan didapat pembeli tiket."
            />
          </div>

          <div class="space-y-2">
            <label class="text-foreground text-sm font-medium" for="venue-city">Kota Event</label>
            <Input id="venue-city" bind:value={form.venue_city} placeholder="Jakarta" required />
          </div>

          <div class="space-y-3">
            <p class="text-foreground text-sm font-medium">Kategori</p>
            <div class="flex flex-wrap gap-2">
              {#if isCategoriesLoading}
                <span class="text-muted-foreground text-sm">Memuat kategori...</span>
              {:else if categoryOptions.length === 0}
                <span class="text-muted-foreground text-sm">Gagal memuat kategori.</span>
              {:else}
                {#each categoryOptions as category (category.id)}
                  <button
                    class={`rounded-full border px-4 py-2 text-sm font-medium transition ${form.category_ids.includes(category.id) ? 'border-jeevatix-600 bg-jeevatix-600 text-white' : 'hover:border-jeevatix-300 hover:bg-jeevatix-50 border-border bg-card text-muted-foreground hover:text-foreground'}`}
                    onclick={() => toggleCategory(category.id)}
                    type="button"
                  >
                    {category.name}
                  </button>
                {/each}
              {/if}
            </div>
          </div>
        </div>
      {:else if currentStep === 2}
        <div class="space-y-5">
          <div class="space-y-2">
            <label class="text-foreground text-sm font-medium" for="venue-name">Venue Name</label>
            <Input
              id="venue-name"
              bind:value={form.venue_name}
              placeholder="Istora Senayan"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-foreground text-sm font-medium" for="venue-address"
              >Venue Address</label
            >
            <Textarea
              id="venue-address"
              bind:value={form.venue_address}
              class="min-h-28"
              placeholder="Jl. Pintu Satu Senayan, Jakarta Pusat"
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label class="text-foreground text-sm font-medium" for="venue-latitude"
                >Latitude</label
              >
              <Input id="venue-latitude" bind:value={form.venue_latitude} placeholder="-6.2187" />
            </div>
            <div class="space-y-2">
              <label class="text-foreground text-sm font-medium" for="venue-longitude"
                >Longitude</label
              >
              <Input
                id="venue-longitude"
                bind:value={form.venue_longitude}
                placeholder="106.8022"
              />
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label class="text-foreground text-sm font-medium" for="start-at">Start At</label>
              <Input id="start-at" type="datetime-local" bind:value={form.start_at} required />
            </div>
            <div class="space-y-2">
              <label class="text-foreground text-sm font-medium" for="end-at">End At</label>
              <Input id="end-at" type="datetime-local" bind:value={form.end_at} required />
            </div>
            <div class="space-y-2">
              <label class="text-foreground text-sm font-medium" for="sale-start">Sale Start</label>
              <Input
                id="sale-start"
                type="datetime-local"
                bind:value={form.sale_start_at}
                required
              />
            </div>
            <div class="space-y-2">
              <label class="text-foreground text-sm font-medium" for="sale-end">Sale End</label>
              <Input id="sale-end" type="datetime-local" bind:value={form.sale_end_at} required />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-foreground text-sm font-medium" for="max-order"
              >Max Tickets per Order</label
            >
            <Input
              id="max-order"
              type="number"
              min="1"
              max="20"
              bind:value={form.max_tickets_per_order}
            />
          </div>
        </div>
      {:else if currentStep === 3}
        <div class="space-y-6">
          <div class="border-border bg-muted/70 rounded-[1.5rem] border p-5">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p class="text-foreground font-semibold">Banner Event</p>
                <p class="text-muted-foreground mt-1 text-sm">
                  Unggah visual utama untuk kartu event dan halaman detail.
                </p>
              </div>
              <label
                class="hover:border-jeevatix-300 hover:bg-jeevatix-50 border-border bg-card text-foreground inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-medium transition"
              >
                {#if isUploadingBanner}
                  <LoaderCircle class="mr-2 size-4 animate-spin" />
                  Uploading...
                {:else}
                  <ImagePlus class="mr-2 size-4" />
                  Upload Banner
                {/if}
                <input
                  class="hidden"
                  type="file"
                  accept="image/*"
                  onchange={handleBannerUpload}
                  disabled={isUploadingBanner}
                />
              </label>
            </div>

            {#if form.banner_url}
              <img
                class="mt-5 h-60 w-full rounded-[1.4rem] object-cover"
                src={form.banner_url}
                alt="Banner event preview"
                loading="lazy"
                decoding="async"
              />
            {:else}
              <div
                class="border-border bg-card text-muted-foreground mt-5 flex h-52 items-center justify-center rounded-[1.4rem] border border-dashed text-sm"
              >
                Banner belum diunggah.
              </div>
            {/if}
          </div>

          <div class="border-border bg-muted/70 rounded-[1.5rem] border p-5">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p class="text-foreground font-semibold">Galeri Event</p>
                <p class="text-muted-foreground mt-1 text-sm">
                  Tambahkan visual pendukung venue, performer, atau ambience event.
                </p>
              </div>
              <label
                class="hover:border-jeevatix-300 hover:bg-jeevatix-50 border-border bg-card text-foreground inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-medium transition"
              >
                {#if isUploadingGallery}
                  <LoaderCircle class="mr-2 size-4 animate-spin" />
                  Uploading...
                {:else}
                  <Plus class="mr-2 size-4" />
                  Tambah Gambar
                {/if}
                <input
                  class="hidden"
                  type="file"
                  accept="image/*"
                  multiple
                  onchange={handleGalleryUpload}
                  disabled={isUploadingGallery}
                />
              </label>
            </div>

            {#if form.images.length > 0}
              <div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {#each form.images as image (image.clientId)}
                  <div class="border-border bg-card overflow-hidden rounded-[1.3rem] border">
                    <img
                      class="h-40 w-full object-cover"
                      src={image.image_url}
                      alt="Galeri event"
                      loading="lazy"
                      decoding="async"
                    />
                    <div class="flex items-center justify-between px-4 py-3">
                      <p
                        class="text-muted-foreground text-xs font-medium tracking-[0.28em] uppercase"
                      >
                        Sort {image.sort_order}
                      </p>
                      <button
                        class="text-sm font-medium text-rose-700"
                        type="button"
                        onclick={() => removeImage(image.clientId)}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div
                class="border-border bg-card text-muted-foreground mt-5 flex h-40 items-center justify-center rounded-[1.4rem] border border-dashed text-sm"
              >
                Belum ada galeri tambahan.
              </div>
            {/if}
          </div>
        </div>
      {:else if currentStep === 4}
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-foreground font-semibold">Tier tiket</p>
              <p class="text-muted-foreground mt-1 text-sm">
                Tambahkan semua tier yang akan muncul saat event mulai dijual.
              </p>
            </div>
            <Button type="button" variant="outline" onclick={addTier}>
              <Plus class="mr-2 size-4" />
              Tambah Tier
            </Button>
          </div>

          {#each form.tiers as tier, index (tier.clientId)}
            <div class="border-border bg-muted/70 rounded-[1.5rem] border p-5">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-foreground font-semibold">Tier {index + 1}</p>
                  <p class="text-muted-foreground mt-1 text-sm">
                    Urutan tampil akan mengikuti posisi tier di bawah ini.
                  </p>
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
                  <label
                    class="text-foreground text-sm font-medium"
                    for={`tier-name-${tier.clientId}`}>Nama Tier</label
                  >
                  <Input
                    id={`tier-name-${tier.clientId}`}
                    bind:value={tier.name}
                    placeholder="VIP Early Bird"
                    required
                  />
                </div>
                <div class="space-y-2 sm:col-span-2">
                  <label
                    class="text-foreground text-sm font-medium"
                    for={`tier-description-${tier.clientId}`}>Deskripsi</label
                  >
                  <Textarea
                    id={`tier-description-${tier.clientId}`}
                    bind:value={tier.description}
                    class="min-h-24"
                    placeholder="Benefit, area duduk, atau akses khusus untuk tier ini."
                  />
                </div>
                <div class="space-y-2">
                  <label
                    class="text-foreground text-sm font-medium"
                    for={`tier-price-${tier.clientId}`}>Harga</label
                  >
                  <Input
                    id={`tier-price-${tier.clientId}`}
                    type="number"
                    min="0"
                    bind:value={tier.price}
                    placeholder="350000"
                    required
                  />
                </div>
                <div class="space-y-2">
                  <label
                    class="text-foreground text-sm font-medium"
                    for={`tier-quota-${tier.clientId}`}>Quota</label
                  >
                  <Input
                    id={`tier-quota-${tier.clientId}`}
                    type="number"
                    min="1"
                    bind:value={tier.quota}
                    placeholder="100"
                    required
                  />
                </div>
                <div class="space-y-2">
                  <label
                    class="text-foreground text-sm font-medium"
                    for={`tier-sale-start-${tier.clientId}`}>Sale Start Tier</label
                  >
                  <Input
                    id={`tier-sale-start-${tier.clientId}`}
                    type="datetime-local"
                    bind:value={tier.sale_start_at}
                  />
                </div>
                <div class="space-y-2">
                  <label
                    class="text-foreground text-sm font-medium"
                    for={`tier-sale-end-${tier.clientId}`}>Sale End Tier</label
                  >
                  <Input
                    id={`tier-sale-end-${tier.clientId}`}
                    type="datetime-local"
                    bind:value={tier.sale_end_at}
                  />
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="space-y-6">
          <div class="rounded-[1.5rem] border border-emerald-200 bg-emerald-50/60 p-5">
            <p class="text-sm font-semibold tracking-[0.28em] text-emerald-700 uppercase">
              Review Ringkas
            </p>
            <h2 class="text-foreground mt-2 text-2xl font-semibold tracking-tight">
              {form.title || 'Untitled Event'}
            </h2>
            <p class="text-muted-foreground mt-2 text-sm leading-6">
              {form.description || 'Belum ada deskripsi event.'}
            </p>
          </div>

          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div class="border-border bg-muted/70 rounded-[1.3rem] border p-4">
              <p class="text-muted-foreground text-sm">Kategori</p>
              <p class="text-foreground mt-3 text-lg font-semibold">{form.category_ids.length}</p>
            </div>
            <div class="border-border bg-muted/70 rounded-[1.3rem] border p-4">
              <p class="text-muted-foreground text-sm">Tier</p>
              <p class="text-foreground mt-3 text-lg font-semibold">{form.tiers.length}</p>
            </div>
            <div class="border-border bg-muted/70 rounded-[1.3rem] border p-4">
              <p class="text-muted-foreground text-sm">Potensi Kuota</p>
              <p class="text-foreground mt-3 text-lg font-semibold">{soldPotential}</p>
            </div>
            <div class="border-border bg-muted/70 rounded-[1.3rem] border p-4">
              <p class="text-muted-foreground text-sm">Galeri</p>
              <p class="text-foreground mt-3 text-lg font-semibold">{form.images.length}</p>
            </div>
          </div>

          <div class="grid gap-5 lg:grid-cols-2">
            <div class="border-border bg-card rounded-[1.5rem] border p-5">
              <p class="text-foreground font-semibold">Lokasi & Waktu</p>
              <div class="text-muted-foreground mt-4 space-y-2 text-sm">
                <p>
                  <span class="text-foreground font-medium">Venue:</span>
                  {form.venue_name || '—'}
                </p>
                <p>
                  <span class="text-foreground font-medium">Alamat:</span>
                  {form.venue_address || '—'}
                </p>
                <p>
                  <span class="text-foreground font-medium">Kota:</span>
                  {form.venue_city || '—'}
                </p>
                <p>
                  <span class="text-foreground font-medium">Start:</span>
                  {form.start_at || '—'}
                </p>
                <p><span class="text-foreground font-medium">End:</span> {form.end_at || '—'}</p>
              </div>
            </div>

            <div class="border-border bg-card rounded-[1.5rem] border p-5">
              <p class="text-foreground font-semibold">Tier Preview</p>
              <div class="mt-4 space-y-3">
                {#each form.tiers as tier (tier.clientId)}
                  <div
                    class="border-border bg-muted/70 text-muted-foreground rounded-[1.1rem] border p-4 text-sm"
                  >
                    <div class="flex items-center justify-between gap-4">
                      <p class="text-foreground font-semibold">{tier.name || 'Tier tanpa nama'}</p>
                      <p class="text-foreground font-medium">
                        Rp {Number(tier.price || 0).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <p class="mt-2">Quota: {tier.quota || 0}</p>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>
      {/if}

      <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          type="button"
          onclick={goToPreviousStep}
          disabled={currentStep === 1 || isSubmitting}
        >
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
              Simpan Event Draft
            {/if}
          </Button>
        {/if}
      </div>
    </Card>

    <div class="space-y-6">
      <Card
        title="Checklist create"
        description="Gunakan panel ini untuk memastikan data inti event tidak terlewat."
        class="border-border bg-card/95 rounded-[2rem] border"
      >
        <div class="text-muted-foreground space-y-3 text-sm">
          <p class={form.title && form.category_ids.length > 0 ? 'text-emerald-700' : ''}>
            1. Info dasar dan kategori dipilih.
          </p>
          <p class={form.venue_name && form.start_at && form.end_at ? 'text-emerald-700' : ''}>
            2. Venue dan jadwal event lengkap.
          </p>
          <p class={form.banner_url ? 'text-emerald-700' : ''}>3. Banner utama sudah diunggah.</p>
          <p
            class={form.tiers.every((tier) => tier.name && tier.price && tier.quota)
              ? 'text-emerald-700'
              : ''}
          >
            4. Semua tier tiket terisi dengan harga dan quota.
          </p>
        </div>
      </Card>

      <Card
        title="Preview operasi"
        description="Ringkasan cepat untuk keputusan sebelum event disimpan."
        class="border-border bg-card/95 rounded-[2rem] border"
      >
        <div class="text-muted-foreground space-y-4 text-sm">
          <div class="border-border bg-muted/70 rounded-[1.2rem] border p-4">
            <p class="text-muted-foreground text-xs font-semibold tracking-[0.26em] uppercase">
              Status awal
            </p>
            <p class="text-foreground mt-2 text-base font-semibold">Draft</p>
          </div>
          <div class="border-border bg-muted/70 rounded-[1.2rem] border p-4">
            <p class="text-muted-foreground text-xs font-semibold tracking-[0.26em] uppercase">
              Sale Window
            </p>
            <p class="text-foreground mt-2 text-base font-semibold">
              {form.sale_start_at || '—'} → {form.sale_end_at || '—'}
            </p>
          </div>
          <div class="border-border bg-muted/70 rounded-[1.2rem] border p-4">
            <p class="text-muted-foreground text-xs font-semibold tracking-[0.26em] uppercase">
              Banner
            </p>
            <p class="text-foreground mt-2 text-base font-semibold">
              {form.banner_url ? 'Ready' : 'Belum ada'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  </div>
</section>
