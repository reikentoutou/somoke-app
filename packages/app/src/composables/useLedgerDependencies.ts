import { computed, ref } from 'vue'
import type { ShiftConfigListItem } from '@somoke/shared'
import { storeApi } from '@/api'
import { useShiftConfigsStore } from '@/stores/shiftConfigs'
import { useRecorderNamesStore } from '@/stores/recorderNames'
import { useAuthStore } from '@/stores/auth'
import {
  buildRecorderNameList,
  pickRecorderIndex,
  recorderStorageKey
} from '@/utils/ledgerRecorderNames'
import { storage } from '@/stores/keys'

/**
 * 录入依赖加载：班次配置 + 记账员列表 + 当前门店实时库存/现金。
 *
 * 这是表单容器之下的一层，只负责"异步读"，不管表单字段。页面在 onShow 里
 * 调 `reload({ ensureRecorderName })` 即可，`loadCurrentBalances()` 内部会在
 * storeDetail 缓存失效后获取新值；成功后由调用方决定是否 prefill。
 */
export interface LedgerDependenciesOptions {
  /** 编辑态需要保证记录上的记账人出现在 picker 列表里 */
  ensureRecorderName?: string | null
}

export function useLedgerDependencies() {
  const shiftStore = useShiftConfigsStore()
  const recorderStore = useRecorderNamesStore()
  const auth = useAuthStore()

  const activeShifts = computed<ShiftConfigListItem[]>(() => shiftStore.active)
  const recorderList = ref<string[]>([])
  const selectedRecorder = ref('')

  const currentStock = ref(0)
  const currentCash = ref(0)
  const balancesLoaded = ref(false)

  const initialZero = computed(
    () => balancesLoaded.value && currentStock.value === 0 && currentCash.value === 0
  )

  function refreshRecorderPicker(ensureName?: string | null): void {
    const user = auth.userInfo
    const { list, savedKey } = buildRecorderNameList({
      detail: { recorder_names: recorderStore.names },
      userInfo: user,
      ensureName: ensureName ?? null
    })
    const saved = storage.get<string>(savedKey)
    const picked = pickRecorderIndex(list, saved ?? '', ensureName ?? null)
    recorderList.value = list
    selectedRecorder.value = picked.display
  }

  function persistRecorderChoice(name: string): void {
    const key = recorderStorageKey(auth.userInfo)
    if (name) storage.set(key, name)
  }

  async function reloadShifts(): Promise<void> {
    await shiftStore.ensureLoaded()
  }

  async function reloadRecorders(ensureName?: string | null): Promise<void> {
    const detail = await storeApi.getStoreDetail()
    recorderStore.setNames(detail.recorder_names ?? [])
    refreshRecorderPicker(ensureName)
  }

  async function reloadBalances(): Promise<void> {
    const detail = await storeApi.getStoreDetail()
    const s = Number(detail.current_stock)
    const c = Number(detail.current_cash)
    currentStock.value = Number.isFinite(s) ? s : 0
    currentCash.value = Number.isFinite(c) ? c : 0
    balancesLoaded.value = true
  }

  async function reloadAll(opts: LedgerDependenciesOptions = {}): Promise<void> {
    // 三个接口可以并发，storeDetail 只会真正命中一次（rpcCached 去重）
    await Promise.all([reloadShifts(), reloadRecorders(opts.ensureRecorderName)])
    await reloadBalances()
  }

  return {
    activeShifts,
    recorderList,
    selectedRecorder,
    currentStock,
    currentCash,
    balancesLoaded,
    initialZero,

    refreshRecorderPicker,
    persistRecorderChoice,
    reloadShifts,
    reloadRecorders,
    reloadBalances,
    reloadAll
  }
}
