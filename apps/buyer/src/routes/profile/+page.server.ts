import { fail, redirect } from '@sveltejs/kit';

import { apiGet, apiPatch, apiPost } from '$lib/api';
import {
  ApiError,
  clearAuthSession,
  persistStoredUser,
  type BuyerAuthUser,
} from '$lib/auth';

type MessagePayload = {
  message: string;
};

function requireBuyerSession(locals: App.Locals) {
  if (!locals.buyerRefreshToken || locals.currentUser?.role !== 'buyer') {
    redirect(303, '/login');
  }
}

function normalizeFile(entry: FormDataEntryValue | null) {
  if (!(entry instanceof File) || entry.size === 0) {
    return null;
  }

  return entry;
}

export const load = (async ({ fetch, cookies, locals }) => {
  requireBuyerSession(locals);

  try {
    const profile = await apiGet<BuyerAuthUser>('/users/me', {
      fetchFn: fetch,
      cookies,
    });

    return { profile };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearAuthSession(cookies);
      redirect(303, '/login');
    }

    throw error;
  }
}) satisfies import('./$types').PageServerLoad;

export const actions = {
  updateProfile: async ({ request, fetch, cookies, locals }) => {
    requireBuyerSession(locals);

    const formData = await request.formData();
    const fullName = formData.get('full_name')?.toString().trim() ?? '';
    const phone = formData.get('phone')?.toString().trim() ?? '';
    const avatarFile = normalizeFile(formData.get('avatar'));

    if (!fullName) {
      return fail(400, {
        profileError: 'Nama lengkap wajib diisi.',
      });
    }

    try {
      let avatarUrl: string | undefined;

      if (avatarFile) {
        const uploadForm = new FormData();
        uploadForm.set('file', avatarFile);

        const uploadResult = await apiPost<{ url: string }>('/upload', uploadForm, {
          fetchFn: fetch,
          cookies,
        });

        avatarUrl = uploadResult.url;
      }

      const profile = await apiPatch<BuyerAuthUser>(
        '/users/me',
        {
          full_name: fullName,
          phone: phone || undefined,
          avatar_url: avatarUrl,
        },
        {
          fetchFn: fetch,
          cookies,
        },
      );

      persistStoredUser(cookies, profile);

      return {
        profile,
        profileSuccess: 'Profil berhasil diperbarui.',
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearAuthSession(cookies);
        redirect(303, '/login');
      }

      return fail(error instanceof ApiError ? error.status : 500, {
        profileError:
          error instanceof ApiError ? error.message : 'Gagal memperbarui profil buyer.',
      });
    }
  },

  changePassword: async ({ request, fetch, cookies, locals }) => {
    requireBuyerSession(locals);

    const formData = await request.formData();
    const oldPassword = formData.get('old_password')?.toString() ?? '';
    const newPassword = formData.get('new_password')?.toString() ?? '';
    const confirmPassword = formData.get('confirm_password')?.toString() ?? '';

    if (!oldPassword || !newPassword || !confirmPassword) {
      return fail(400, {
        passwordError: 'Semua field password wajib diisi.',
      });
    }

    if (newPassword.length < 8) {
      return fail(400, {
        passwordError: 'Password baru minimal 8 karakter.',
      });
    }

    if (newPassword !== confirmPassword) {
      return fail(400, {
        passwordError: 'Konfirmasi password baru tidak cocok.',
      });
    }

    try {
      const result = await apiPatch<MessagePayload>(
        '/users/me/password',
        {
          old_password: oldPassword,
          new_password: newPassword,
        },
        {
          fetchFn: fetch,
          cookies,
        },
      );

      return {
        passwordSuccess: result.message,
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearAuthSession(cookies);
        redirect(303, '/login');
      }

      return fail(error instanceof ApiError ? error.status : 500, {
        passwordError:
          error instanceof ApiError ? error.message : 'Gagal memperbarui password.',
      });
    }
  },
} satisfies import('./$types').Actions;