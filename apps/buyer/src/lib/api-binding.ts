let currentBinding: { fetch: typeof globalThis.fetch } | undefined;

export function setApiBinding(binding: { fetch: typeof globalThis.fetch } | undefined) {
  currentBinding = binding;
}

export function getApiBinding(): { fetch: typeof globalThis.fetch } | undefined {
  return currentBinding;
}
