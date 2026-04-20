import { defineStore } from 'pinia'
import type { ShiftConfigListItem } from '@somoke/shared'
import { shiftApi } from '@/api'
import { errorMessage } from '@/utils/errors'

interface ShiftConfigsState {
  items: ShiftConfigListItem[]
  loading: boolean
  loaded: boolean
  error: string
}

/**
 * 班次配置：读路径走 rpcCached（shifts: 前缀），写路径在端点层失效缓存。
 * store 里只保留展示用状态，不做缓存层（已在 rpcCached 内完成）。
 *
 * 存储的是 wire 类型 `ShiftConfigListItem`（不含 is_active / store_id），
 * 与云函数 `handleGetShifts` 的响应一一对应，避免"按后端未返回的字段再过滤"。
 */
export const useShiftConfigsStore = defineStore('shiftConfigs', {
  state: (): ShiftConfigsState => ({
    items: [],
    loading: false,
    loaded: false,
    error: ''
  }),

  getters: {
    // 云函数已按 is_active=1 过滤，这里直接透出即可
    active: (s): ShiftConfigListItem[] => s.items
  },

  actions: {
    async ensureLoaded(force = false): Promise<ShiftConfigListItem[]> {
      if (this.loaded && !force) return this.items
      return this.refresh()
    },

    async refresh(): Promise<ShiftConfigListItem[]> {
      this.loading = true
      this.error = ''
      try {
        const list = await shiftApi.getShifts()
        this.items = Array.isArray(list) ? list : []
        this.loaded = true
        return this.items
      } catch (err) {
        this.error = errorMessage(err, '班次加载失败')
        throw err
      } finally {
        this.loading = false
      }
    },

    reset() {
      this.$patch({ items: [], loading: false, loaded: false, error: '' })
    }
  }
})
