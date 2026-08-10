import { describe, expect, it } from 'vitest';

import { decryptText, encryptText } from '../src/utils/crypto.js';

const SECRET = 'test-encryption-secret';

function flipFirstHexByte(value: string): string {
  return `${value.slice(0, 1) === '0' ? '1' : '0'}${value.slice(1)}`;
}

describe('text encryption', () => {
  it('round-trips Unicode text', () => {
    const plaintext = 'Привет, 世界 👋 café';

    expect(decryptText(encryptText(plaintext, SECRET), SECRET)).toBe(plaintext);
  });

  it('decrypts ciphertext produced by the previous wire-compatible implementation', () => {
    const legacyCiphertext =
      '000102030405060708090a0b:cbc12e35275215632932fc03ff21c424:8850ed62bd5a8abd5106be4b7dea';

    expect(decryptText(legacyCiphertext, 'legacy-fixture-secret')).toBe('legacy payload');
  });

  it('returns null for a wrong key', () => {
    const encrypted = encryptText('sensitive value', SECRET);

    expect(decryptText(encrypted, 'wrong-secret')).toBeNull();
  });

  it('returns null for a tampered authentication tag', () => {
    const [iv, tag, ciphertext] = encryptText('sensitive value', SECRET).split(':');

    expect(decryptText(`${iv}:${flipFirstHexByte(tag)}:${ciphertext}`, SECRET)).toBeNull();
  });

  it('returns null for tampered ciphertext', () => {
    const [iv, tag, ciphertext] = encryptText('sensitive value', SECRET).split(':');

    expect(decryptText(`${iv}:${tag}:${flipFirstHexByte(ciphertext)}`, SECRET)).toBeNull();
  });

  it.each([
    ['empty input', ''],
    ['malformed structure', 'not-encrypted'],
    ['non-hex fields', 'zzzzzzzzzzzzzzzzzzzzzzzz:zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz:zz'],
    ['wrong IV length', '000102030405060708090a:000102030405060708090a0b0c0d0e0f:00'],
    ['wrong tag length', '000102030405060708090a0b:000102030405060708090a0b0c0d0e:00'],
    ['empty ciphertext', '000102030405060708090a0b:000102030405060708090a0b0c0d0e0f:'],
  ])('returns null for %s', (_case, value) => {
    expect(decryptText(value, SECRET)).toBeNull();
  });
});
