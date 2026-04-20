import { defineStore } from 'pinia'
import { storeApi } from '@/api'
import { errorMessage } from '@/utils/errors'

interface RecorderNamesState {
  names: string[]
  loading: boolean
  loaded: boolean
  error: string
}

/**
 * 记账员姓名列表：在 storeDetail 接口里一并返回，这里只做"从 storeDetail 结果 patch"和
 * 直接 refresh 两种入口，避免各页面各自调 API。
 */
export const useRecorderNamesStore = defineStore('recorderNames', {
  state: (): RecorderNamesState => ({
    names: [],
    loading: false,
    loaded: false,
    error: ''
  }),

  actions: {
    async ensureLoaded(force = false): Promise<string[]> {
      if (this.loaded && !force) return this.names
      return this.refresh()
    },

    async refresh(): Promise<string[]> {
      this.loading = true
      this.error = ''
      try {
        const detail = await storeApi.getStoreDetail()
        this.names = Array.isArray(detail.recorder_names) ? detail.recorder_names : []
        this.loaded = true
        return this.names
      } catch (err) {
        this.error = errorMessage(err, '记账员加载失败')
        throw err
      } finally {
        this.loading = false
      }
    },

    /** 写操作返回的最新列表直接 patch */
    setNames(names: string[]) {
      this.names = Array.isArray(names) ? names : []
      this.loaded = true
    },

    reset() {
      this.$patch({ names: [], loading: false, loaded: false, error: '' })
    }
  }
})
