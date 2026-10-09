<script setup lang="ts">
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useConfigStore } from '@vasakgroup/plugin-config-manager';
import { nextTick, onMounted, onUnmounted, type Ref, ref } from 'vue';
import WindowAppLayout from '@/layouts/WindowAppLayout.vue';

let unListenConfig: Ref<UnlistenFn | null> = ref(null);

// La primera lectura de la configuración va después del primer dibujo: en
// `onMounted` sin esperar, el layout se pinta con los valores por omisión y la
// configuración llega encima. Esperando a `nextTick`, la ventana ya está en
// pantalla cuando empieza la lectura, y si falla se avisa con el banner y se
// siguen usando los valores por defecto — una ventana con colores por omisión
// sigue siendo usable; una ventana que no monta no.
const configLoading = ref(true);
const configError = ref(false);

onMounted(async () => {
	// Que el layout se pinte primero, antes de cualquier lectura.
	await nextTick();

	const configStore = useConfigStore();

	try {
		await configStore.loadConfig();
		configLoading.value = false;
	} catch (error: any) {
		configLoading.value = false;
		configError.value = true;
		console.error('Error al cargar configuración en App.vue', error);
	}

	// Fuera del `try` de la lectura: aunque esa falle o nunca resuelva, los
	// cambios de configuración de después tienen que poder aplicarse. Antes,
	// un fallo en la primera lectura dejaba la suscripción sin registrar y la
	// app se quedaba con los valores por defecto hasta reiniciar.
	try {
		unListenConfig.value = await listen('config-changed', async () => {
			document.startViewTransition(() => {
				configStore.loadConfig();
			});
		});
	} catch (error: any) {
		console.error('No se pudo escuchar los cambios de configuración', error);
	}
});

onUnmounted(() => {
	if (unListenConfig.value !== null) {
		unListenConfig.value();
	}
});
</script>

<template>
  <div v-if="configLoading" class="config-status">
    Cargando configuración…
  </div>
  <div v-else-if="configError" class="error-banner">
    Error al cargar configuración. Usando valores por defecto.
  </div>
  <WindowAppLayout />
</template>
