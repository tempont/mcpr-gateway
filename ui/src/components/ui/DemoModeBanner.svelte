<script lang="ts">
  let { visible = false }: { visible: boolean } = $props();
</script>

{#if visible}
  <div
    class="sticky top-0 z-[1000] w-full bg-[#fff3cd] px-4 py-2 text-center text-sm font-medium text-[#664d03]"
  >
    ⚠️ DEMO MODE — This is a demonstration environment. No data is persisted. Do not enter any credentials or sensitive information.
  </div>
{/if}
