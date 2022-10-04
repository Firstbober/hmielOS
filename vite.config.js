import { resolve } from 'path'
import { defineConfig } from 'vite'
import fs from 'fs';

let rollupInput = {
	main: resolve(__dirname, 'index.html')
};

fs.readdirSync(resolve(__dirname, 'src/base')).forEach(dir => {
	rollupInput[dir] = resolve(__dirname, `src/base/${dir}/index.html`)
});

export default defineConfig({
  build: {
    rollupOptions: {
      input: rollupInput
    },
  }
})