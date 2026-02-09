import { useMemo } from 'react';
import { convertPrice, formatPrice, type Currency, type BillingCountry } from '@/lib/planPriceBook';
import { Tooltip } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface PriceDisplayProps {
  /** Price in cents in the creator's base currency */
  priceCents: number;
  /** Creator's base currency */
  creatorCurrency: Currency;
  /** Viewer's billing country (for displaying in their preferred currency) */
  viewerCountry?: BillingCountry;
  /** Whether to show both currencies when different */
  showBoth?: boolean;
  /** Optional CSS classes */
  className?: string;
  /** Show per-period label (e.g., "/month") */
  period?: string;
}

/**
 * Smart price display component with currency conversion
 * Based on MVP_CURRENCY_STRATEGY.md
 *
 * Examples:
 * - Indian creator, Indian viewer: "₹1,000"
 * - Indian creator, US viewer: "$12 (₹1,000)"
 * - US creator, Indian viewer: "₹840 ($10)"
 */
export function PriceDisplay({
  priceCents,
  creatorCurrency,
  viewerCountry,
  showBoth = true,
  className = '',
  period,
}: PriceDisplayProps) {
  const viewerCurrency: Currency = viewerCountry === 'IN' ? 'INR' : 'USD';

  const { displayText, showTooltip, tooltipText } = useMemo(() => {
    // Convert cents to amount (NOT in cents)
    const amount = priceCents / 100;

    // Same currency - just display
    if (creatorCurrency === viewerCurrency) {
      return {
        displayText: formatPrice(amount, creatorCurrency),
        showTooltip: false,
        tooltipText: '',
      };
    }

    // Different currency - show converted + original
    const converted = convertPrice(amount, creatorCurrency, viewerCurrency);
    const convertedFormatted = formatPrice(converted, viewerCurrency);
    const originalFormatted = formatPrice(amount, creatorCurrency);

    if (showBoth) {
      return {
        displayText: `${convertedFormatted} (${originalFormatted})`,
        showTooltip: true,
        tooltipText: `Original price: ${originalFormatted}\nConverted with smart rounding (< 2% difference)`,
      };
    }

    return {
      displayText: convertedFormatted,
      showTooltip: true,
      tooltipText: `Original price: ${originalFormatted}`,
    };
  }, [priceCents, creatorCurrency, viewerCurrency, showBoth]);

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <span className="font-semibold">
        {displayText}
        {period && <span className="text-sm text-muted-foreground">/{period}</span>}
      </span>

      {showTooltip && (
        <Tooltip content={tooltipText}>
          <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
        </Tooltip>
      )}
    </div>
  );
}

/**
 * Simple inline price display without tooltip
 */
export function SimplePriceDisplay({
  priceCents,
  creatorCurrency,
  viewerCountry,
  className = '',
}: Omit<PriceDisplayProps, 'showBoth' | 'period'>) {
  const viewerCurrency: Currency = viewerCountry === 'IN' ? 'INR' : 'USD';
  const amount = priceCents / 100;

  const displayText = useMemo(() => {
    if (creatorCurrency === viewerCurrency) {
      return formatPrice(amount, creatorCurrency);
    }

    const converted = convertPrice(amount, creatorCurrency, viewerCurrency);
    return formatPrice(converted, viewerCurrency);
  }, [amount, creatorCurrency, viewerCurrency]);

  return <span className={className}>{displayText}</span>;
}
