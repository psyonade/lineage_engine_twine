import { defineConfig } from '@playwright/test';

const edgePath = process.env.PLAYWRIGHT_BROWSER_PATH || (
  process.platform === 'win32'
    ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    : undefined
);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    headless: true,
    launchOptions: {
      ...(edgePath ? { executablePath: edgePath } : {}),
      args: ['--no-sandbox'],
    },
  },
});
