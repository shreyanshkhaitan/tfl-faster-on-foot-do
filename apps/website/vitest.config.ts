import { defineConfig } from 'vite-plus';

// Dedicated test config avoids mounting Nitro's HTTP upgrade listener in Vitest's middleware server.
export default defineConfig({
    resolve: {
        tsconfigPaths: true
    }
});
