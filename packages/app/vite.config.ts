import { defineConfig, type Plugin } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { resolve } from 'node:path'
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'

/**
 * uni-app (vue3 + mp-weixin) 不会把 `src/custom-tab-bar/index.vue` 编译成
 * 微信原生组件，导致自定义 tabBar 失效。解决办法是直接维护原生
 * `.js/.json/.wxml/.wxss` 文件，然后在构建/热更时拷贝到 mp-weixin 产物根。
 *
 * 约束：
 * - 仅在平台为 mp-weixin 时生效。
 * - `writeBundle` 末尾执行，确保 dist 目录已经就绪，watch 模式下每轮 rebuild 都会重跑。
 */
const UNI_PLATFORM = process.env.UNI_PLATFORM ?? 'mp-weixin'

async function copyDir(src: string, dest: string): Promise<void> {
  if (!existsSync(src)) return
  await mkdir(dest, { recursive: true })
  const entries = await readdir(src)
  await Promise.all(
    entries.map(async name => {
      const s = resolve(src, name)
      const d = resolve(dest, name)
      const info = await stat(s)
      if (info.isDirectory()) {
        await copyDir(s, d)
      } else {
        await copyFile(s, d)
      }
    })
  )
}

function copyCustomTabBarPlugin(): Plugin {
  const from = resolve(__dirname, 'src/custom-tab-bar')
  return {
    name: 'somoke:copy-custom-tab-bar',
    apply: () => UNI_PLATFORM === 'mp-weixin',
    async writeBundle() {
      const outDir = resolve(
        __dirname,
        'dist',
        process.env.NODE_ENV === 'production' ? 'build' : 'dev',
        UNI_PLATFORM,
        'custom-tab-bar'
      )
      await copyDir(from, outDir)
    }
  }
}

export default defineConfig({
  plugins: [uni(), copyCustomTabBarPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../shared/src')
    }
  }
})
