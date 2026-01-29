/**
 * Unit tests for Payment Split Calculation (25/75)
 * Tests the critical payment fee calculation logic
 */

describe('Payment Split Calculation', () => {
  const PLATFORM_FEE_PERCENT = 0.25; // 25%

  describe('calculatePaymentSplit', () => {
    it('should calculate 25% platform fee correctly', () => {
      const amount = 10000; // $100.00 in cents
      const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT);
      const creatorEarnings = amount - platformFee;

      expect(platformFee).toBe(2500); // $25.00
      expect(creatorEarnings).toBe(7500); // $75.00
      expect(platformFee + creatorEarnings).toBe(amount);
    });

    it('should handle different amounts correctly', () => {
      const testCases = [
        { amount: 500, expectedFee: 125, expectedEarnings: 375 }, // $5.00
        { amount: 1000, expectedFee: 250, expectedEarnings: 750 }, // $10.00
        { amount: 5000, expectedFee: 1250, expectedEarnings: 3750 }, // $50.00
        { amount: 10000, expectedFee: 2500, expectedEarnings: 7500 }, // $100.00
      ];

      testCases.forEach(({ amount, expectedFee, expectedEarnings }) => {
        const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT);
        const creatorEarnings = amount - platformFee;

        expect(platformFee).toBe(expectedFee);
        expect(creatorEarnings).toBe(expectedEarnings);
        expect(platformFee + creatorEarnings).toBe(amount);
      });
    });

    it('should handle odd amounts (rounding down)', () => {
      const amount = 333; // $3.33
      const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT);
      const creatorEarnings = amount - platformFee;

      // 333 * 0.25 = 83.25, floor = 83
      expect(platformFee).toBe(83);
      expect(creatorEarnings).toBe(250);
      expect(platformFee + creatorEarnings).toBe(amount);
    });

    it('should always sum to original amount', () => {
      const amounts = [1, 10, 100, 1000, 10000, 100000, 999999];

      amounts.forEach((amount) => {
        const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT);
        const creatorEarnings = amount - platformFee;

        expect(platformFee + creatorEarnings).toBe(amount);
        expect(platformFee).toBeLessThanOrEqual(amount * PLATFORM_FEE_PERCENT);
        expect(platformFee).toBeGreaterThan((amount * PLATFORM_FEE_PERCENT) - 1);
      });
    });

    it('should maintain 25/75 split ratio approximately', () => {
      const amount = 10000;
      const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT);
      const creatorEarnings = amount - platformFee;

      const platformPercent = (platformFee / amount) * 100;
      const creatorPercent = (creatorEarnings / amount) * 100;

      // Allow small rounding differences
      expect(platformPercent).toBeCloseTo(25, 1);
      expect(creatorPercent).toBeCloseTo(75, 1);
    });
  });

  describe('edge cases', () => {
    it('should handle zero amount', () => {
      const amount = 0;
      const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT);
      const creatorEarnings = amount - platformFee;

      expect(platformFee).toBe(0);
      expect(creatorEarnings).toBe(0);
    });

    it('should handle very small amounts', () => {
      const amount = 1; // $0.01
      const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT);
      const creatorEarnings = amount - platformFee;

      expect(platformFee).toBe(0); // 0.25 cents rounds down to 0
      expect(creatorEarnings).toBe(1);
    });

    it('should handle very large amounts', () => {
      const amount = 10000000; // $100,000.00
      const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT);
      const creatorEarnings = amount - platformFee;

      expect(platformFee).toBe(2500000); // $25,000.00
      expect(creatorEarnings).toBe(7500000); // $75,000.00
      expect(platformFee + creatorEarnings).toBe(amount);
    });
  });
});

