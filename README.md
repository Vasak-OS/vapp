# Tauri + Vue + TypeScript — Sistema de Iconos VasakOS

Plantilla base para aplicaciones VasakOS construidas con Tauri, Vue 3 y TypeScript. Incluye el sistema centralizado de iconos reactivos con detección automática de cambios de tema.

---

## Configuración Inicial

**Antes de comenzar**, reemplaza todas las ocurrencias de `vaap` por el nombre real de tu aplicación:

| Archivo | Qué reemplazar |
|---|---|
| `package.json` | `"vaap"` → `"vasak-<tu-app>"` (ej: `"vasak-terminal"`) |
| `vite.config.ts` | Referencias a `vaap` |
| `src/main.ts` | Título de la ventana y configuración |
| `tauri.conf.json` | Identificador y nombre de la ventana |
| `Cargo.toml` | Nombre del crate y binario |

---

## Tabla de Contenidos

- [Arquitectura General](#arquitectura-general)
- [Diseño del Sistema de Iconos](#diseño-del-sistema-de-iconos)
- [Uso de los Composables](#uso-de-los-composables)
- [Componentes de Ejemplo](#componentes-de-ejemplo)
- [Características Clave](#características-clave)
- [Configuración de Desarrollo](#configuración-de-desarrollo)
- [Beneficios Arquitectónicos](#beneficios-arquitectónicos)
- [Guía de Migración](#guía-de-migración)

---

## Arquitectura General

```mermaid
flowchart TD
    A[Sistema de Temas de Iconos] --> B[Monitor GTK IconTheme]
    A --> C[Backend Tauri]
    A --> D[Frontend Vite]

    B --> C[Limpiar Caché de Iconos]
    B --> C[Emitir 'vicons:theme-changed']

    C --> E[Servicio de Carga de Iconos]
    C --> F[Servicio de Carga de Símbolos]

    D --> G[Composable useReactiveIcons]
    D --> H[useThemeListener]

    G --> I[Ref de Fuente del Icono]
    G --> J[Re-obtención de Iconos]

    H --> K[Conteo de Suscriptores]
    H --> L[Listener Global de Tema]

    I --> M[<img src="{{iconSource}}">]
    J --> K
    L --> K

    M --> N[Aplicaciones VasakOS]
    N --> O[ActionControlsComponent]
    N --> P[WeatherIcon]
    N --> Q[EntryIconComponent]
    N --> R[MusicPlayer]

    G --> S[Proyectos VasakOS]
    S --> T[vasak-file-manager]
    T --> U[useReactiveIcon]
    T --> V[EntryIconComponent]

    S --> X[vasak-terminal]
    X --> Y[useReactiveIcon]

    S --> Z[vasak-resonance]
    Z --> AA[useReactiveIcon]

    S --> AB[vasak-desktop]
    AB --> AC[useIcon/useSymbol/useIcons]
    AB --> AD[WeatherIcon]
    AB --> AE[useMusicPlayer]

    D --> AF[Gestión de Caché]
    AF --> AG[TTL de 30 minutos]
    AF --> AH[Persistente entre Apps]
```

### ¿Por qué esta arquitectura?

VasakOS unifica la carga de iconos en **todas sus aplicaciones** a través de un plugin Tauri compartido (`tauri-plugin-vicons`). En lugar de que cada app implemente su propio monitoreo de temas GTK, todas se suscriben a un mismo evento (`vicons:theme-changed`) y se benefician de una caché centralizada con TTL de 30 minutos. Esto reduce drásticamente la duplicación de código, asegura consistencia visual y simplifica el mantenimiento.

---

## Diseño del Sistema de Iconos

### Componentes del Backend (`tauri-plugin-vicons`)

- **Carga de Símbolos**: `getSymbolSource()` para iconos simbólicos GTK
- **Carga de Iconos**: `getIconSource()` para iconos de sistema regulares
- **Monitoreo de Tema**: Listener GTK IconTheme que limpia la caché y emite `vicons:theme-changed`
- **Caché**: TTL de 30 minutos con cachés independientes `ICON_CACHE` y `SYMBOL_CACHE`

### Componentes del Frontend

El sistema expone **dos patrones de composable**:

1. **Icono individual**: `useReactiveIcon(fetcher)` para obtener un solo icono
2. **Múltiples iconos**: `useReactiveIcons(config)` para carga por lote

### Flujo de Cambio de Tema

```mermaid
sequenceDiagram
    participant GTK as GTK IconTheme
    participant Plugin as tauri-plugin-vicons
    participant Frontend as Vue App
    participant Componente as Componente Vue

    GTK->>Plugin: Tema cambiado
    Plugin->>Plugin: Limpiar caché
    Plugin->>Frontend: emit('vicons:theme-changed')
    Frontend->>Frontend: themeVersion.value++
    Frontend->>Componente: watch(themeVersion)
    Componente->>Componente: Ejecutar fetcher()
    Componente->>Plugin: invoke('get_symbol', 'icon-name')
    Plugin-->>Componente: data:image/svg+xml;base64,...
    Componente->>Componente: source.value = resultado
    Componente->>Componente: Renderizado reactivo
```

---

## Uso de los Composables

### Instalación

Agrega el composable a tu aplicación:

```typescript
// src/composables/useReactiveIcon.ts
import { listen } from '@tauri-apps/api/event';
import { getIconSource, getSymbolSource } from '@vasakgroup/plugin-vicons';
import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue';

export type IconConfig = string | { name: string; type?: 'icon' | 'symbol' };

let unlisten: any = null;
let subscribers = 0;
const themeVersion = ref(0);

function useThemeListener() {
  onMounted(() => {
    subscribers++;
    if (subscribers === 1) {
      listen('vicons:theme-changed', () => {
        themeVersion.value++;
      }).then((fn) => { unlisten = fn; });
    }
  });

  onUnmounted(() => {
    subscribers--;
    if (subscribers <= 0 && unlisten) {
      unlisten();
      unlisten = null;
    }
  });

  return themeVersion;
}

export function useReactiveIcon(fetcher: () => Promise<string>) {
  const source = ref('');
  const version = useThemeListener();
  let id = 0;

  watch(
    version,
    async () => {
      const requestId = ++id;
      try {
        const result = await fetcher();
        if (requestId === id) source.value = result;
      } catch {
        if (requestId === id) source.value = '';
      }
    },
    { immediate: true }
  );

  return source;
}

export function useReactiveIcons<T extends Record<string, IconConfig>>(
  icons: T
): { [K in keyof T]: Ref<string> } {
  const result = {} as { [K in keyof T]: Ref<string> };
  const entries = Object.entries(icons);
  const version = useThemeListener();
  const keyTokens: Record<string, number> = {};

  for (const [key] of entries) {
    (result as Record<string, Ref<string>>)[key] = ref('');
    keyTokens[key] = 0;
  }

  async function refreshAll() {
    for (const [key, config] of entries) {
      const keyId = ++keyTokens[key];
      const resolved =
        typeof config === 'string'
          ? { name: config, type: 'symbol' as const }
          : { name: config.name, type: config.type ?? ('symbol' as const) };

      const src =
        resolved.type === 'icon'
          ? await getIconSource(resolved.name)
          : await getSymbolSource(resolved.name);

      if (keyId === keyTokens[key]) {
        (result as Record<string, Ref<string>>)[key].value = src;
      }
    }
  }

  watch(version, refreshAll, { immediate: true });

  return result;
}
```

### Integración en Componentes

Reemplaza las llamadas directas a `getSymbolSource` con los composables:

#### Antes

```vue
<script lang="ts" setup>
import { onMounted, Ref, ref } from 'vue';
import { getSymbolSource } from '@vasakgroup/plugin-vicons';

const closeIcon: Ref<string> = ref('');

onMounted(async () => {
  closeIcon.value = await getSymbolSource('window-close');
});
</script>

<template>
  <img :src="closeIcon">
</template>
```

#### Después

```vue
<script lang="ts" setup>
import { useReactiveIcon } from '@/composables/useReactiveIcon';

const closeIcon = useReactiveIcon(() => getSymbolSource('window-close'));
</script>

<template>
  <img :src="closeIcon">
</template>
```

### Ejemplo de Carga por Lote

```vue
<script lang="ts" setup>
import { useReactiveIcons } from '@/composables/useReactiveIcon';

const { closeIcon, minimizeIcon, maximizeIcon } = useReactiveIcons({
  closeIcon: 'window-close',
  minimizeIcon: 'window-minimize',
  maximizeIcon: 'window-maximize',
});
</script>
```

---

## Componentes de Ejemplo

### ActionControlsComponent.vue

Los iconos de control de ventana de la aplicación demo:

```vue
<script lang="ts" setup>
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useReactiveIcons } from '@/composables/useReactiveIcon';

const appWindow = getCurrentWindow();
const { closeIcon, minimizeIcon, maximizeIcon } = useReactiveIcons({
  closeIcon: 'window-close',
  minimizeIcon: 'window-minimize',
  maximizeIcon: 'window-maximize',
});
</script>

<template>
  <div class="flex gap-1" data-tauri-drag-region>
    <span
      class="p-1 bg-ui-bg/80 rounded-corner hover:bg-status-success border border-ui-border"
      @click="appWindow.minimize()"
    >
      <img :src="minimizeIcon" class="h-6 w-6 inline-block" alt="Minimizar" />
    </span>
    <span
      class="p-1 bg-ui-bg/80 rounded-corner hover:bg-status-warning border border-ui-border"
      @click="appWindow.toggleMaximize()"
    >
      <img :src="maximizeIcon" class="h-6 w-6 inline-block" alt="Maximizar" />
    </span>
    <span
      class="p-1 bg-ui-bg/80 rounded-corner hover:bg-status-error border border-ui-border"
      @click="appWindow.close()"
    >
      <img :src="closeIcon" class="h-6 w-6 inline-block" alt="Cerrar" />
    </span>
  </div>
</template>
```

---

## Características Clave

### 1. Sincronización de Tema

- **Listener Global**: Un solo `listen('vicons:theme-changed')` en toda la app
- **Conteo de Suscriptores**: Rastrea instancias de componentes para limpiar listeners adecuadamente
- **Carga Inmediata**: Los iconos se cargan al instante y se refrescan al cambiar el tema

### 2. Protección contra Condiciones de Carrera

- **Tokens de Petición**: Cada refresco usa un `requestId` único para evitar promesas obsoletas
- **Tokens por Clave**: La carga por lote usa tokens únicos por icono
- **Actualizaciones Seguras**: Solo actualiza si el requestId coincide con la petición actual

### 3. Tipado Seguro

- **IconConfig**: Soporta tanto shorthand de string como objeto completo de configuración
- **Tipos Genéricos**: Retornos type-safe para carga individual y por lote
- **Refinamiento de Tipos**: Tipado correcto para el sistema de reactividad de Vue

### 4. Manejo de Errores

- **Degradación Graceful**: Los iconos vuelven a string vacío si falla la carga
- **Fallo Silencioso**: Los cambios de tema no rompen componentes con errores de carga
- **Reintento**: La caché permite recuperación rápida de errores transitorios

---

## Configuración de Desarrollo

### Prerrequisitos

- Node.js 18+
- Tauri con toolchain Rust
- Sistema de ventanas GTK

### Instalación

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
npm run tauri build
```

### Testing

Las aplicaciones VasakOS siguen los patrones de iconos de:

- `vasak-file-manager/src/composables/useReactiveIcon.ts`
- `vasak-terminal/src/utils/useReactiveIcon.ts`
- `vasak-desktop/src/tools/composables/useReactiveIcon.ts`

---

## Beneficios Arquitectónicos

### 1. Gestión Centralizada de Temas

El sistema de iconos provee una **única fuente de verdad** para los temas de iconos en todas las aplicaciones VasakOS:

- **Reducción de Duplicación**: No es necesario implementar listeners GTK en cada aplicación
- **Comportamiento Consistente**: Todas las apps responden idénticamente a cambios de tema
- **Mantenimiento Simplificado**: La lógica de monitoreo está en un solo lugar

### 2. Arquitectura Reactiva

El uso de **refs reactivos** y **watchers** permite actualizaciones automáticas de UI:

- **Actualizaciones en Tiempo Real**: La UI se actualiza inmediatamente al cambiar el tema
- **Código Simplificado**: Sin necesidad de gestión manual de suscripciones a eventos
- **Limpieza Automática**: Los hooks de ciclo de vida de Vue manejan la limpieza de listeners

### 3. Escalabilidad

El sistema escala desde **componentes individuales hasta ecosistemas completos**:

- **Por Componente**: Carga de icono individual para componentes ligeros
- **Por App**: Carga por lote para elementos de UI de la aplicación
- **Multi-App**: Listener compartido en todo el ecosistema VasakOS

### 4. Optimización de Rendimiento

- **Conteo de Suscriptores**: Un solo listener global para cambios de tema
- **Tokenización de Peticiones**: Previene condiciones de carrera y datos obsoletos
- **Caché Backend**: La caché del plugin reduce carga redundante

### 5. Experiencia de Usuario Consistente

Todas las aplicaciones VasakOS comparten el mismo sistema de iconos:

- **Consistencia Visual**: Los iconos se ven y comportan igual en todas las apps
- **Unidad Temática**: Los cambios de tema se propagan consistentemente
- **Simplicidad de Desarrollo**: Misma API y patrones en todas las apps

---

## Guía de Migración

### Desde Carga Tradicional de Iconos

Si vienes de llamadas manuales a `getSymbolSource` o `getIconSource`:

1. **Crea `src/composables/useReactiveIcon.ts`** con el código de esta guía
2. **Reemplaza en componentes**:
   - Icono individual: `useReactiveIcon(() => getSymbolSource('icon-name'))`
   - Múltiples: `useReactiveIcons({ iconName: 'icon-name' })`
3. **Actualiza imports** de `@vasakgroup/plugin-vicons` según sea necesario

### Beneficios tras la Migración

- **Sin `onMounted` manual**: Los iconos se cargan automáticamente y reaccionan a cambios de tema
- **Sin gestión de listeners**: El conteo de suscriptores maneja los listeners globales
- **Mejor manejo de errores**: Fallbacks gracefull en fallos de carga
- **Comportamiento consistente**: Mismo comportamiento que otras aplicaciones VasakOS

---

## Recursos Relacionados

### Otras Implementaciones VasakOS

| Proyecto | Archivo |
|---|---|
| vasak-file-manager | `src/composables/useReactiveIcon.ts` |
| vasak-terminal | `src/utils/useReactiveIcon.ts` |
| vasak-resonance | `src/composables/useReactiveIcon.ts` |
| vasak-desktop | `src/tools/composables/useReactiveIcon.ts` |

### Documentación del Plugin de Iconos

- **Plugin**: `tauri-plugin-vicons/`
- **API**: `@vasakgroup/plugin-vicons`
  - `getIconSource(name: string)` — Carga iconos de sistema regulares
  - `getSymbolSource(name: string)` — Carga iconos simbólicos

### Enlaces Útiles

- [Documentación Tauri](https://tauri.app/v1/guides/)
- [Guía Vue 3](https://v3.vuejs.org/guide/)
- [Documentación Vite](https://vitejs.dev/guide/)

---

## Licencia

Esta plantilla está basada en la plantilla oficial Tauri + Vue + TypeScript. La implementación del sistema de iconos es específica de VasakOS y sigue los patrones establecidos en todo el ecosistema VasakOS.
