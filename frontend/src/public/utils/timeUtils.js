(function () {
  'use strict';

  /**
   * Convert input to Date object (handles ISO strings, timestamps, Date objects)
   */
  function toDate(input) {
    if (!input) return null;
    if (input instanceof Date) return input;
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /**
   * Format relative time (e.g., "1 min ago", "in 2 hours", "3 days ago")
   * Uses Intl.RelativeTimeFormat for proper localization
   */
  function formatRelativeTime(input) {
    const d = toDate(input);
    if (!d) return '';

    const diffMs = d.getTime() - Date.now();
    const abs = Math.abs(diffMs);

    // Less than 45 seconds: show as "just now" or seconds
    if (abs < 45000) {
      const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      return rtf.format(Math.round(diffMs / 1000), 'second');
    }

    // Less than 1 hour: show as minutes
    if (abs < 3600000) {
      const mins = Math.round(diffMs / 60000);
      const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      return rtf.format(mins, 'minute');
    }

    // Less than 24 hours: show as hours
    if (abs < 86400000) {
      const hrs = Math.round(diffMs / 3600000);
      const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      return rtf.format(hrs, 'hour');
    }

    // Less than 30 days: show as days
    if (abs < 2592000000) {
      const days = Math.round(diffMs / 86400000);
      const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      return rtf.format(days, 'day');
    }

    // Otherwise: show as local date/time
    return formatLocalDateTime(d);
  }

  /**
   * Format date/time in user's local timezone
   * Uses Intl.DateTimeFormat for proper localization
   */
  function formatLocalDateTime(input) {
    const d = toDate(input);
    if (!d) return '';

    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d);
    } catch (e) {
      // Fallback to ISO string if Intl fails
      return d.toLocaleString();
    }
  }

  /**
   * Format date only (no time)
   */
  function formatLocalDate(input) {
    const d = toDate(input);
    if (!d) return '';

    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
      }).format(d);
    } catch (e) {
      return d.toLocaleDateString();
    }
  }

  /**
   * Format time only (no date)
   */
  function formatLocalTime(input) {
    const d = toDate(input);
    if (!d) return '';

    try {
      return new Intl.DateTimeFormat(undefined, {
        timeStyle: 'short',
      }).format(d);
    } catch (e) {
      return d.toLocaleTimeString();
    }
  }

  // Export to window
  window.TimeUtils = {
    formatRelativeTime,
    formatLocalDateTime,
    formatLocalDate,
    formatLocalTime,
    toDate,
  };
})();













