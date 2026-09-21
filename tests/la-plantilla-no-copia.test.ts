/**
 * La plantilla no trae copias de lo que la librería ya exporta.
 *
 * Esto no es una regla de estilo: es de donde salió el problema. `vapp` es el
 * molde del que nacen las aplicaciones de VasakOS, así que **lo que esté acá se
 * copia dieciséis veces** — y lo que estaba era un `useReactiveIcon()` propio de
 * noventa y una líneas, documentado en el README como algo que la plantilla
 * provee.
 *
 * De ahí salieron nueve copias repartidas por el taller, todas resolviendo el
 * icono y suscribiéndose al cambio de tema **una vez por instancia**. Ninguna
 * fallaba nunca; simplemente hacían de más y sabían de menos que la de la
 * librería, y se fueron separando entre ellas.
 *
 * Borrar las nueve copias no arregla nada si el molde vuelve a hacer la décima.
 */

import { describe, expect, test } from 'bun:test';

const RAIZ = new URL('..', import.meta.url).pathname;

/** Lo que la librería exporta, leído de los tipos que publica. */
async function loQueLaLibreriaExporta(): Promise<string[]> {
	const tipos = await Bun.file(
		`${RAIZ}node_modules/@vasakgroup/vue-libvasak/dist/types/index.d.ts`
	).text();

	const nombres = new Set<string>();
	for (const bloque of tipos.matchAll(/export\s*\{([^}]*)\}/g)) {
		for (const crudo of bloque[1].split(',')) {
			const nombre = crudo.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
			if (nombre) nombres.add(nombre);
		}
	}
	return [...nombres];
}

describe('lo que la plantilla no debe traer', () => {
	test('el composable del icono se fue, y con él el molde de las nueve copias', async () => {
		expect(await Bun.file(`${RAIZ}src/composables/useReactiveIcon.ts`).exists()).toBe(false);
	});

	test('y nadie lo importa', async () => {
		const fuentes = [...new Bun.Glob('src/**/*.{vue,ts}').scanSync(RAIZ)];
		expect(fuentes.length).toBeGreaterThan(3);

		const culpables: string[] = [];
		for (const ruta of fuentes) {
			const texto = await Bun.file(`${RAIZ}${ruta}`).text();
			if (/useReactiveIcon/.test(texto)) culpables.push(ruta);
		}

		expect(culpables).toEqual([]);
	});

	test('ningún componente propio se llama como uno de la librería', async () => {
		// El caso general. `ThemeIcon.vue`, `ProgressBar.vue`, `AlertMessage.vue`:
		// si la plantilla trae uno con el nombre de algo que la librería exporta,
		// cada aplicación nueva nace con esa copia y el nombre además tapa al
		// importado cuando alguien registra los dos.
		const deLaLibreria = new Set(await loQueLaLibreriaExporta());
		expect(deLaLibreria.size).toBeGreaterThan(30);

		const propios = [...new Bun.Glob('src/**/*.vue').scanSync(RAIZ)].map(
			(ruta) => ruta.split('/').pop()?.replace(/\.vue$/, '') ?? ''
		);

		expect(propios.filter((nombre) => deLaLibreria.has(nombre))).toEqual([]);
	});

	test('y el README enseña el de la librería, no uno propio', async () => {
		// El README es la mitad de la plantilla: lo que documenta es lo que la
		// próxima aplicación va a copiar. Enseñaba `useReactiveIcon()` en
		// `src/composables/` como la forma de poner un icono.
		const readme = await Bun.file(`${RAIZ}README.md`).text();
		const seccion = readme.slice(readme.indexOf('### Iconos'));

		expect(seccion).toContain('ThemeIcon');
		expect(seccion).toContain('@vasakgroup/vue-libvasak');
	});
});
