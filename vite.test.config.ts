import { mergeConfig } from "vite";
import baseConfig from "./vite.config";
import { resolve } from "path";

export default mergeConfig(baseConfig, {
  resolve: {
    alias: [
      {
        find: /.*\/data\/today\.json/,
        replacement: resolve(__dirname, "tests/fixtures/today.json"),
      },
      {
        find: /.*\/data\/archive\.json/,
        replacement: resolve(__dirname, "tests/fixtures/archive.json"),
      },
      {
        find: /.*\/data\/songList\.json/,
        replacement: resolve(__dirname, "tests/fixtures/songList.json"),
      },
    ],
  },
  server: { port: 5174 },
});
