import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAdminEmail, parseEmailList } from '@/lib/authz';

describe('parseEmailList', () => {
  it('splits, trims and lowercases a comma-separated list', () => {
    expect(parseEmailList(' Alice@Example.com, bob@example.com ,')).toEqual(['alice@example.com', 'bob@example.com']);
  });

  it('returns an empty list when the value is missing or blank', () => {
    expect(parseEmailList(undefined)).toEqual([]);
    expect(parseEmailList('  ')).toEqual([]);
  });
});

describe('isAdminEmail', () => {
  const original = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
  });

  afterEach(() => {
    process.env.ADMIN_EMAILS = original;
  });

  it('recognises an admin email whatever its case', () => {
    expect(isAdminEmail('Admin@Example.com')).toBe(true);
  });

  it('rejects other users, missing emails and an unset ADMIN_EMAILS', () => {
    expect(isAdminEmail('user@example.com')).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail('')).toBe(false);

    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail('admin@example.com')).toBe(false);
  });
});
