import { describe, it, expect } from 'vitest';
import { parseProjectHash, buildProjectHash } from '../../src/lib/project-hash';

describe('project deep links', () => {
  it('parses PT and EN hashes to the same route', () => {
    expect(parseProjectHash('#projeto/api-pedidos/testar')).toEqual({ slug: 'api-pedidos', tab: 'try' });
    expect(parseProjectHash('#project/api-pedidos/try')).toEqual({ slug: 'api-pedidos', tab: 'try' });
    expect(parseProjectHash('#projeto/api-pedidos/codigo')).toEqual({ slug: 'api-pedidos', tab: 'code' });
    expect(parseProjectHash('#projeto/encurtador-url/telas')).toEqual({ slug: 'encurtador-url', tab: 'screens' });
    expect(parseProjectHash('#project/encurtador-url/screens')).toEqual({ slug: 'encurtador-url', tab: 'screens' });
  });
  it('defaults to the overview tab', () => {
    expect(parseProjectHash('#projeto/encurtador-url')).toEqual({ slug: 'encurtador-url', tab: 'overview' });
    expect(parseProjectHash('#projeto/encurtador-url/xyz')).toEqual({ slug: 'encurtador-url', tab: 'overview' });
  });
  it('ignores unrelated hashes', () => {
    expect(parseProjectHash('')).toBeNull();
    expect(parseProjectHash('#projetos')).toBeNull();
    expect(parseProjectHash('#contato')).toBeNull();
    expect(parseProjectHash('#projeto/<script>/x')).toBeNull();
    expect(parseProjectHash('#%E0%A4%A')).toBeNull();
  });
  it('builds localized hashes', () => {
    expect(buildProjectHash({ slug: 'api-pedidos', tab: 'try' }, 'pt')).toBe('#projeto/api-pedidos/testar');
    expect(buildProjectHash({ slug: 'api-pedidos', tab: 'overview' }, 'en')).toBe('#project/api-pedidos/overview');
    expect(buildProjectHash({ slug: 'encurtador-url', tab: 'screens' }, 'pt')).toBe('#projeto/encurtador-url/telas');
  });
});
