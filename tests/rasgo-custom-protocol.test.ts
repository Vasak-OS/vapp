/**
 * Que la plantilla declare el rasgo que abre la ventana compilada.
 *
 * En depuración, el WebView carga el `devUrl` de `tauri.conf.json` salvo que se
 * compile con `custom-protocol`. Sin ese rasgo y sin servidor de desarrollo
 * detrás, la ventana abre **vacía**: no hay error, no hay registro, no hay nada
 * que mirar. Es el modo de falla más caro de todos, porque parece un problema
 * de la aplicación.
 *
 * El nombre corto no existe solo. Un rasgo de una dependencia no es un rasgo
 * propio hasta que el paquete lo reexporta, así que sin la línea
 * `custom-protocol = ["tauri/custom-protocol"]` la orden que todo el mundo
 * escribe responde «the package does not contain this feature». La forma
 * calificada anda igual sin declarar nada —y es la que el CLI de Tauri pasa por
 * su cuenta—, pero es la que nadie recuerda.
 *
 * Esto va en la plantilla, que es de donde nacen las aplicaciones: cada una que
 * nazca sin el rasgo se lo encuentra sola, y ya pasó.
 */

import { describe, expect, test } from 'bun:test';

const manifiesto = await Bun.file(new URL('../src-tauri/Cargo.toml', import.meta.url)).text();

/** Lo que hay debajo de `[features]`, hasta la sección siguiente. */
function seccion(nombre: string): string {
	const desde = manifiesto.indexOf(`[${nombre}]`);
	if (desde < 0) return '';
	const resto = manifiesto.slice(desde + nombre.length + 2);
	const hasta = resto.search(/^\[/m);
	return hasta < 0 ? resto : resto.slice(0, hasta);
}

describe('el rasgo custom-protocol', () => {
	test('está declarado', () => {
		expect(seccion('features')).toMatch(/^\s*custom-protocol\s*=/m);
	});

	test('y apunta al de Tauri', () => {
		// Declararlo vacío —`custom-protocol = []`— también hace que la orden
		// deje de fallar, y no enciende nada: la ventana sigue abriendo vacía y
		// ahora sin ni siquiera un mensaje que lo delate.
		expect(seccion('features')).toMatch(/custom-protocol\s*=\s*\[\s*"tauri\/custom-protocol"\s*\]/);
	});
});
