<script lang="ts" setup>
import { WindowFrame } from '@vasakgroup/vue-libvasak';
</script>
<template>
    <WindowFrame class="flex rounded-t-corner-window bg-primary dark:bg-primary-dark justify-between items-center h-6 h-8 inline-block px-4 py-1">
      <div class="h-[calc(100vh-32px)] rounded-b-corner-window background">
        <slot />
      </div>
    </WindowFrame>
</template>
