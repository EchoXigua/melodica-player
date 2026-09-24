if (!process.env.npm_config_user_agent?.startsWith('pnpm/')) {
  console.error('本项目使用 pnpm。请运行 pnpm install。');
  process.exit(1);
}
