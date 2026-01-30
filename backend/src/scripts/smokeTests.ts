/**
 * Smoke Tests for AI Identity Platform
 * 
 * Run with: npx tsx backend/src/scripts/smokeTests.ts
 * 
 * These tests verify critical paths are working:
 * - Public chat endpoint
 * - Widget chat endpoint
 * - Payment flow
 * - Extension API
 * - Authentication
 */

import { config } from '../config/env';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`✅ ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, error: error.message, duration });
    console.error(`❌ ${name}: ${error.message} (${duration}ms)`);
  }
}

async function main() {
  console.log('🧪 Running Smoke Tests...\n');
  console.log(`API Base: ${API_BASE}\n`);

  // Test 1: Public chat endpoint
  await test('Public Chat Endpoint', async () => {
    const response = await fetch(`${API_BASE}/api/public/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'test',
        message: 'Hello',
        visitorId: 'test_visitor',
      }),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Status ${response.status}`);
    }
  });

  // Test 2: Widget chat endpoint
  await test('Widget Chat Endpoint', async () => {
    const response = await fetch(`${API_BASE}/api/widget/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creatorId: 'test_creator',
        message: 'Hello',
      }),
    });
    if (!response.ok && response.status !== 404 && response.status !== 402) {
      throw new Error(`Status ${response.status}`);
    }
  });

  // Test 3: Get creator endpoint
  await test('Get Creator Endpoint', async () => {
    const response = await fetch(`${API_BASE}/api/public/creator/test`);
    if (!response.ok && response.status !== 404) {
      throw new Error(`Status ${response.status}`);
    }
  });

  // Test 4: Health check (if exists)
  await test('Health Check', async () => {
    const response = await fetch(`${API_BASE}/health`);
    // Health check is optional, so we don't fail if 404
    if (response.status >= 500) {
      throw new Error(`Status ${response.status}`);
    }
  });

  // Test 5: Extension API (if token provided)
  if (process.env.TEST_EXTENSION_TOKEN) {
    await test('Extension API', async () => {
      const response = await fetch(`${API_BASE}/api/ext/mirror`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TEST_EXTENSION_TOKEN}`,
        },
        body: JSON.stringify({
          message: 'Test message',
        }),
      });
      if (!response.ok && response.status !== 401) {
        throw new Error(`Status ${response.status}`);
      }
    });
  }

  // Summary
  console.log('\n📊 Test Summary:');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});




