@echo off
set "PATH=C:\Users\suleyman\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\suleyman\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback;%PATH%"
call pnpm install --offline --force --frozen-lockfile --node-linker=hoisted
