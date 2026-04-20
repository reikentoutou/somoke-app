<script setup lang="ts">
import { onLaunch, onError } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'

onLaunch(() => {
  const w = typeof wx !== 'undefined' ? wx : undefined
  if (w && typeof w.cloud?.init === 'function') {
    w.cloud.init({ traceUser: true })
  }
  useAuthStore().hydrateFromStorage()
})

onError(err => {
  console.error('[App] runtime error', err)
})
</script>

<style>
page {
  background: #f9f9fb;
}
</style>
