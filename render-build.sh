#!/usr/bin/env bash
set -e

# Force install ALL dependencies (including dev) during build
export NODE_ENV=development

echo "=== Installing root dependencies ==="
npm install

echo "=== Installing frontend dependencies ==="
cd frontend
npm install
cd ..

echo "=== Installing backend dependencies ==="
cd backend
npm install
cp -n .env.example .env 2>/dev/null || true
npx prisma generate
npx prisma db push
cd ..

# Switch to production for build
export NODE_ENV=production

echo "=== Building frontend ==="
cd frontend
npx vite build
cd ..

echo "=== Building backend ==="
cd backend
npx tsc
cd ..

echo "=== Build complete ==="
