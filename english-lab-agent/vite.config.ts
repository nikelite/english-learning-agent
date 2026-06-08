import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

let commitTime = ''
try {
  commitTime = execSync('git log -1 --format="%cd" --date=format:"%Y-%m-%d %H:%M:%S"').toString().trim()
} catch (e) {
  commitTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(commitTime)
  }
})
