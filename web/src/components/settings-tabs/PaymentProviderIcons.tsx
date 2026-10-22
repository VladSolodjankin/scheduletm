import type { PaymentProviderId } from '../../shared/types/api';

/**
 * Accent colours only. The official Stripe, YooKassa and Bank of Georgia logos are not
 * reproduced here; each provider gets a neutral monogram tile in its accent colour.
 */
export const PAYMENT_PROVIDER_ACCENT: Record<PaymentProviderId, string> = {
  stripe: '#635BFF',
  yookassa: '#0070F0',
  bog: '#F26B21',
};

const MONOGRAM: Record<PaymentProviderId, string> = {
  stripe: 'S',
  yookassa: 'Y',
  bog: 'B',
};

export function PaymentProviderMonogram({ provider }: { provider: PaymentProviderId }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <text
        x="12"
        y="17.5"
        textAnchor="middle"
        fontSize="17"
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
        fill="currentColor"
      >
        {MONOGRAM[provider]}
      </text>
    </svg>
  );
}
