import { isAxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { imageMediaApi } from './client';

type PreviewState = { accessToken: string | null; urls: Map<string, string> };

/**
 * Managed-image plumbing shared by catalog pages: authenticated previews for the given media ids,
 * upload/delete for form dialogs, and cleanup of replaced images with a retry list for failures.
 */
export function useManagedImages<TUploaded>(mediaIds: string[]) {
  const { accessToken } = useAuth();
  const [previews, setPreviews] = useState<PreviewState>(() => ({ accessToken: null, urls: new Map() }));
  const [failedCleanupMediaIds, setFailedCleanupMediaIds] = useState<string[]>([]);
  const [isRetryingCleanup, setIsRetryingCleanup] = useState(false);
  const previewUrlsRef = useRef<Map<string, string>>(new Map());
  const mediaIdsKey = [...new Set(mediaIds)].sort().join('|');

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.clear();
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let cancelled = false;
    const wanted = new Set(mediaIdsKey ? mediaIdsKey.split('|') : []);
    previewUrlsRef.current.forEach((url, mediaId) => {
      if (!wanted.has(mediaId)) {
        URL.revokeObjectURL(url);
        previewUrlsRef.current.delete(mediaId);
      }
    });
    void Promise.all([...wanted]
      .filter((mediaId) => !previewUrlsRef.current.has(mediaId))
      .map(async (mediaId) => {
        try {
          const response = await imageMediaApi.getPreview(accessToken, mediaId);
          if (cancelled) {
            return;
          }
          const previewUrl = URL.createObjectURL(response.data);
          if (previewUrlsRef.current.has(mediaId)) {
            URL.revokeObjectURL(previewUrl);
            return;
          }
          previewUrlsRef.current.set(mediaId, previewUrl);
          setPreviews({ accessToken, urls: new Map(previewUrlsRef.current) });
        } catch {
          // Keep the API-provided public URL; unpublished items show the empty image state.
        }
      }));
    return () => {
      cancelled = true;
    };
  }, [accessToken, mediaIdsKey]);

  const previewUrlFor = useCallback((mediaId: string | null | undefined) => (
    mediaId && previews.accessToken === accessToken ? previews.urls.get(mediaId) : undefined
  ), [accessToken, previews]);

  const markCleanup = (mediaId: string, failed: boolean) => setFailedCleanupMediaIds((current) => {
    const rest = current.filter((id) => id !== mediaId);
    return failed ? [...rest, mediaId] : rest;
  });

  /** Deletes a replaced or orphaned image; failures are remembered for `retryCleanup`. */
  const cleanupImage = async (mediaId: string) => {
    if (!accessToken) {
      markCleanup(mediaId, true);
      return false;
    }
    try {
      await imageMediaApi.delete(accessToken, mediaId);
      markCleanup(mediaId, false);
      return true;
    } catch (caught) {
      const alreadyGone = isAxiosError(caught) && caught.response?.status === 404;
      markCleanup(mediaId, !alreadyGone);
      return alreadyGone;
    }
  };

  const retryCleanup = async () => {
    if (!failedCleanupMediaIds.length || isRetryingCleanup) {
      return;
    }
    setIsRetryingCleanup(true);
    try {
      await Promise.all(failedCleanupMediaIds.map((mediaId) => cleanupImage(mediaId)));
    } finally {
      setIsRetryingCleanup(false);
    }
  };

  const uploadImage = async (file: File, onProgress: (percent: number) => void) => {
    if (!accessToken) {
      throw new Error('missing_access_token');
    }
    const response = await imageMediaApi.upload<TUploaded>(accessToken, file, onProgress);
    return response.data;
  };

  const deleteImage = async (mediaId: string) => {
    if (!accessToken) {
      throw new Error('missing_access_token');
    }
    await imageMediaApi.delete(accessToken, mediaId);
  };

  return {
    previewUrlFor,
    cleanupImage,
    retryCleanup,
    failedCleanupMediaIds,
    isRetryingCleanup,
    uploadImage,
    deleteImage,
  };
}
