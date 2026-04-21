import { defineConfig, type Plugin } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { resolve } from 'node:path'
import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  stat,
  symlink,
  unlink,
  writeFile
} from 'node:fs/promises'
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

/**
 * 微信开发者工具以「小程序根」为文件树根，写在 project.config 里的相对 cloudfunctionRoot
 * 若指向树外目录，左侧**不会**出现 cloudfunctions，右键也就没有「上传并部署」。
 *
 * 做法：在 mp-weixin 产物根下创建 `cloudfunctions` → 仓库 `cloudfunctions` 的符号链接（或 Windows junction），
 * 并把 `cloudfunctionRoot` 固定为 `cloudfunctions`，与 monorepo 布局无关、也不必手填绝对路径。
 */
function patchMpProjectCloudRootPlugin(): Plugin {
  return {
    name: 'somoke:patch-mp-project-cloud-root',
    apply: () => UNI_PLATFORM === 'mp-weixin',
    async writeBundle() {
      const sub = process.env.NODE_ENV === 'production' ? 'build' : 'dev'
      const mpRoot = resolve(__dirname, 'dist', sub, UNI_PLATFORM)
      const cfgPath = resolve(mpRoot, 'project.config.json')
      if (!existsSync(cfgPath)) return
      const cloudRoot = resolve(__dirname, '../../cloudfunctions')
      if (!existsSync(cloudRoot)) return

      const linkPath = resolve(mpRoot, 'cloudfunctions')
      try {
        if (existsSync(linkPath)) {
          const st = await lstat(linkPath)
          if (st.isSymbolicLink()) {
            await unlink(linkPath)
          }
        }
        if (!existsSync(linkPath)) {
          const type = process.platform === 'win32' ? 'junction' : 'dir'
          await symlink(cloudRoot, linkPath, type)
        }
      } catch (err) {
        console.warn('[somoke:patch-mp-project-cloud-root] symlink cloudfunctions failed', err)
      }

      const raw = await readFile(cfgPath, 'utf8')
      const j = JSON.parse(raw) as Record<string, unknown>
      j.cloudfunctionRoot = 'cloudfunctions'
      delete j.cloudfunctionTemplateRoot
      await writeFile(cfgPath, `${JSON.stringify(j, null, 2)}\n`, 'utf8')
    }
  }
}

export default defineConfig({
  plugins: [uni(), copyCustomTabBarPlugin(), patchMpProjectCloudRootPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../shared/src')
    }
  }
})
