<script lang="ts" setup>
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getIconSource } from '@vasakgroup/plugin-vicons';
import { onMounted, Ref, ref } from 'vue';

const appWindow = getCurrentWindow();
const closeIcon: Ref<string> = ref('');
const minimizeIcon: Ref<string> = ref('');
const maximizeIcon: Ref<string> = ref('');

onMounted(async () => {
	closeIcon.value = await getIconSource('window-close');
	minimizeIcon.value = await getIconSource('window-minimize');
	maximizeIcon.value = await getIconSource('window-maximize');
});
</script>
<template>
  <div class="flex gap-1" data-tauri-drag-region>
    <span class="p-1 bg-ui-bg/80 rounded-corner hover:bg-status-success border border-ui-border" @click="appWindow.minimize()">
      <img :src="minimizeIcon" class="h-6 w-6 inline-block" alt="Minimize">
    </span>
    <span class="p-1 bg-ui-bg/80 rounded-corner hover:bg-status-warning border border-ui-border" @click="appWindow.toggleMaximize()">
      <img :src="maximizeIcon" class="h-6 w-6 inline-block" alt="Maximize">
    </span>
    <span class="p-1 bg-ui-bg/80 rounded-corner hover:bg-status-error border border-ui-border" @click="appWindow.close()">
      <img :src="closeIcon" class="h-6 w-6 inline-block" alt="Close">
    </span>
  </div>
</template>