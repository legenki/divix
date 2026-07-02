// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getByPath, setByPath, buildPresetSection } from '../ui/panelBuilder.js';

describe('getByPath', () => {
  it('reads a top-level key', () => {
    expect(getByPath({ a: 1 }, 'a')).toBe(1);
  });

  it('reads a nested dotted path', () => {
    expect(getByPath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
  });

  it('returns undefined for missing key', () => {
    expect(getByPath({ a: 1 }, 'b')).toBeUndefined();
  });

  it('returns null without throwing when intermediate is null', () => {
    expect(getByPath({ a: null }, 'a.b')).toBeNull();
  });
});

describe('setByPath', () => {
  it('sets a top-level key', () => {
    const obj = { a: 0 };
    setByPath(obj, 'a', 99);
    expect(obj.a).toBe(99);
  });

  it('sets a nested dotted path', () => {
    const obj = { a: { b: { c: 0 } } };
    setByPath(obj, 'a.b.c', 7);
    expect(obj.a.b.c).toBe(7);
  });

  it('does not affect sibling keys', () => {
    const obj = { a: { x: 1, y: 2 } };
    setByPath(obj, 'a.x', 99);
    expect(obj.a.y).toBe(2);
  });
});

describe('buildPresetSection preset split', () => {
  it('renders free presets as options', () => {
    const root = document.createElement('div');
    buildPresetSection(root, {
      idPrefix: 'ri',
      presets: { freeA: {}, freeB: {} },
      proPresets: {},
      onOpenPaywall: null,
    });
    const options = [...root.querySelectorAll('option')];
    expect(options.map((o) => o.value)).toContain('freeA');
    expect(options.map((o) => o.value)).toContain('freeB');
  });

  it('renders Pro optgroup when proPresets provided, empty when not isPro', () => {
    const root = document.createElement('div');
    buildPresetSection(root, {
      idPrefix: 'ri',
      presets: { freeA: {} },
      proPresets: { proX: {} },
      onOpenPaywall: null,
    });
    const optgroup = root.querySelector('optgroup[label="Pro ✦"]');
    expect(optgroup).not.toBeNull();
    expect(optgroup.children.length).toBe(0);
  });

  it('renders Pro presets inside optgroup when isPro = true', () => {
    const root = document.createElement('div');
    buildPresetSection(root, {
      idPrefix: 'ri',
      presets: { freeA: {} },
      proPresets: { proX: {}, proY: {} },
      isPro: true,
      onOpenPaywall: null,
    });
    const optgroup = root.querySelector('optgroup[label="Pro ✦"]');
    expect(optgroup.children.length).toBe(2);
  });

  it('shows pro-preset-note when proPresets provided and not isPro', () => {
    const root = document.createElement('div');
    buildPresetSection(root, {
      idPrefix: 'ri',
      presets: { freeA: {} },
      proPresets: { proX: {} },
      isPro: false,
      onOpenPaywall: null,
    });
    expect(root.querySelector('.pro-preset-note')).not.toBeNull();
  });
});
