#!/bin/bash
set -e
npm run lint
npx tsc --noEmit
npx vitest run
