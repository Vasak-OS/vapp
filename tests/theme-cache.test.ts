import { describe, expect, test } from 'bun:test';
import { applyTheme, saveTheme, THEME_KEY } from '../src/tools/theme-cache';

const ROOT = new URL('..', import.meta.url).pathname;

/** Un `Storage` mínimo en memoria, para no tocar el global. */
function memoryStore(): Storage {
	const data = new Map<string, string>();
	return {
		get length() {
			return data.size;
		},
		clear: () => data.clear(),
		getItem: (key) => data.get(key) ?? null,
		key: (index) => [...data.keys()][index] ?? null,
		removeItem: (key) => void data.delete(key),
		setItem: (key, value) => void data.set(key, String(value)),
	};
}

/** Un `Storage` que tira en cada llamada, como un `localStorage` bloqueado. */
function brokenStore(): Storage {
	const fail = () => {
		throw new Error('localStorage inaccesible');
	};
	return { ...memoryStore(), getItem: fail, setItem: fail } as Storage;
}

describe('theme-cache', () => {
	test('la clave es la misma que lee el script de index.html', () => {
		expect(THEME_KEY).toBe('vsk-theme');
	});

	test('saveTheme guarda la clase oscura y sólo las variables `--*`', () => {
		const root = document.createElement('div');
		const store = memoryStore();
		root.classList.add('dark');
		root.style.setProperty('--ui-background', '#111');
		root.style.setProperty('--ui-surface', '#222');
		root.style.setProperty('color', 'red');

		saveTheme(root, store);

		expect(JSON.parse(store.getItem(THEME_KEY) as string)).toEqual({
			dark: true,
			vars: { '--ui-background': '#111', '--ui-surface': '#222' },
		});
	});

	test('saveTheme recuerda también un tema claro', () => {
		const root = document.createElement('div');
		const store = memoryStore();

		saveTheme(root, store);

		expect(JSON.parse(store.getItem(THEME_KEY) as string).dark).toBe(false);
	});

	test('applyTheme reaplica la clase y las variables', () => {
		const root = document.createElement('div');
		const store = memoryStore();
		store.setItem(THEME_KEY, JSON.stringify({ dark: true, vars: { '--primary': '#abc' } }));

		applyTheme(root, store);

		expect(root.classList.contains('dark')).toBe(true);
		expect(root.style.getPropertyValue('--primary')).toBe('#abc');
	});

	test('ida y vuelta: lo guardado de una raíz se reaplica en otra', () => {
		const source = document.createElement('div');
		const target = document.createElement('div');
		const store = memoryStore();
		source.classList.add('dark');
		source.style.setProperty('--ui-line', '#333');

		saveTheme(source, store);
		applyTheme(target, store);

		expect(target.classList.contains('dark')).toBe(true);
		expect(target.style.getPropertyValue('--ui-line')).toBe('#333');
	});

	test('sin recuerdo no hace nada', () => {
		const root = document.createElement('div');

		applyTheme(root, memoryStore());

		expect(root.classList.contains('dark')).toBe(false);
		expect(root.getAttribute('style')).toBeNull();
	});

	test('un JSON inválido no lanza ni toca la raíz', () => {
		const root = document.createElement('div');
		const store = memoryStore();
		store.setItem(THEME_KEY, '{no es json');

		expect(() => applyTheme(root, store)).not.toThrow();
		expect(root.classList.contains('dark')).toBe(false);
	});

	test('un Storage que tira no rompe el arranque', () => {
		const root = document.createElement('div');

		expect(() => saveTheme(root, brokenStore())).not.toThrow();
		expect(() => applyTheme(root, brokenStore())).not.toThrow();
	});
});

describe('el cableado del tema recordado', () => {
	test('index.html reaplica el tema antes de montar', async () => {
		const html = await Bun.file(`${ROOT}index.html`).text();
		const script = html.indexOf("localStorage.getItem(\"vsk-theme\")");

		expect(script).toBeGreaterThan(-1);
		expect(html).toContain('classList.add("dark")');
		expect(html).toContain('setProperty');
		// Antes del bundle: si va después, el primer dibujo ya salió con el tema por omisión.
		expect(script).toBeLessThan(html.indexOf('type="module"'));
	});

	test('App.vue guarda el tema tras cada lectura de la configuración', async () => {
		const app = await Bun.file(`${ROOT}src/App.vue`).text();

		expect(app).toContain("from '@/tools/theme-cache'");
		// Una vez en la primera lectura y otra en el listener de `config-changed`.
		expect(app.match(/loadConfig\(\)\.then\(\(\) => saveTheme\(\)\)/g)?.length).toBe(2);
	});
});
