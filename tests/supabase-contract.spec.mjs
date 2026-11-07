import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
const source = readFileSync(fileURLToPath(new URL('../puzzle.html', import.meta.url)), 'utf8');
test('Hall of Fame reads the explicit labeled view without client writes', () => {
  expect(source).toContain("const TABLE_NAME = 'puzzle_leaderboard'");
  expect(source).toContain(".select('id, name, domain, created_at, verification_status')");
  expect(source).not.toMatch(/\.select\(\s*['"]\*['"]\s*\)/);
  expect(source).not.toMatch(/\.from\([^)]*\)\s*\.insert\s*\(/);
  expect(source).not.toMatch(/CORRECT_FLAG/);
});