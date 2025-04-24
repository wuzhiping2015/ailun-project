import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        }
    },
    server: {
        fs: {
            // 允许服务访问上层目录，这样才能访问public文件夹
            allow: ['..']
        }
    },
    assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.fbx']
})