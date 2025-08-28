<script lang="ts" setup>
import { WindowFrame } from "@vasakgroup/vue-libvasak";
</script>
<template>
  <div style="background-color: aqua; height: 100vh; width: 100vw">
    <WindowFrame>
      <slot />
    </WindowFrame>
  </div>
</template>
