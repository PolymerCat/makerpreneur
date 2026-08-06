export type ShareListingInput = {
  id: string;
  name: string;
  price: number;
};

export type ShareListingResult =
  | { ok: true; method: 'native' | 'clipboard' }
  | { ok: false; reason: 'aborted' | 'unavailable'; url: string };

/**
 * Share a public product URL via Web Share API, or copy to clipboard.
 */
export async function shareListing(product: ShareListingInput): Promise<ShareListingResult> {
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/marketplace/products/${product.id}`
      : `/marketplace/products/${product.id}`;

  const title = product.name;
  const text = `${product.name} — RM ${product.price.toFixed(2)} on StudentHub USM Marketplace (campus deal, pay seller directly)`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return { ok: true, method: 'native' };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { ok: false, reason: 'aborted', url };
      }
      // Fall through to clipboard
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return { ok: true, method: 'clipboard' };
    } catch {
      return { ok: false, reason: 'unavailable', url };
    }
  }

  return { ok: false, reason: 'unavailable', url };
}
