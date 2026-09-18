import { describe, it, expect } from 'vitest';
import { validateName, validatePhone, validateDate, validateType, validateMessage, validateHoneypot, validateForm } from '../assets/js/validate.js';

describe('validateName', () => {
  it('accepts 2-30 chars', () => { expect(validateName('张三')).toBeNull(); });
  it('rejects empty', () => { expect(validateName('')).toMatch(/必填/); });
  it('rejects > 30', () => { expect(validateName('a'.repeat(31))).toMatch(/过长/); });
});

describe('validatePhone', () => {
  it('accepts mainland mobile', () => { expect(validatePhone('15210475723')).toBeNull(); });
  it('rejects landline', () => { expect(validatePhone('01012345678')).toMatch(/手机号/); });
  it('rejects too short', () => { expect(validatePhone('1521047')).toMatch(/手机号/); });
  it('strips spaces and dashes', () => { expect(validatePhone('152-1047-5723')).toBeNull(); });
});

describe('validateDate', () => {
  const today = new Date('2026-09-14T00:00:00Z');
  it('accepts today', () => { expect(validateDate('2026-09-14', today)).toBeNull(); });
  it('accepts +30d', () => { expect(validateDate('2026-10-14', today)).toBeNull(); });
  it('rejects past', () => { expect(validateDate('2026-09-13', today)).toMatch(/过去/); });
  it('rejects > +365d', () => { expect(validateDate('2027-12-31', today)).toMatch(/一年/); });
  it('rejects malformed', () => { expect(validateDate('not-a-date', today)).toMatch(/格式/); });
});

describe('validateType', () => {
  it('accepts enum', () => { for (const t of ['portrait','wedding','event','other']) expect(validateType(t)).toBeNull(); });
  it('rejects unknown', () => { expect(validateType('xxx')).toMatch(/类型/); });
});

describe('validateMessage', () => {
  it('accepts empty', () => { expect(validateMessage('')).toBeNull(); });
  it('accepts 500', () => { expect(validateMessage('a'.repeat(500))).toBeNull(); });
  it('rejects 501', () => { expect(validateMessage('a'.repeat(501))).toMatch(/过长/); });
});

describe('validateHoneypot', () => {
  it('accepts empty', () => { expect(validateHoneypot('')).toBeNull(); });
  it('rejects non-empty', () => { expect(validateHoneypot('bot')).toBe('spam'); });
});

describe('validateForm', () => {
  const today = new Date('2026-09-14T00:00:00Z');
  it('returns ok for valid payload', () => {
    const r = validateForm({ name:'张三', phone:'15210475723', date:'2026-10-01', type:'portrait', message:'你好', website:'' }, today);
    expect(r.ok).toBe(true);
  });
  it('collects all errors', () => {
    const r = validateForm({ name:'', phone:'bad', date:'2020-01-01', type:'xxx', message:'a'.repeat(600), website:'' }, today);
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['date','message','name','phone','type']);
  });
  it('flags spam when honeypot filled', () => {
    const r = validateForm({ name:'张三', phone:'15210475723', date:'2026-10-01', type:'portrait', message:'', website:'http://spam' }, today);
    expect(r.ok).toBe(false);
    expect(r.errors.website).toBe('spam');
  });
});
