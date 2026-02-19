#!/usr/bin/env bash
set -e

echo "=== Installing dependencies ==="
npm install

echo "=== Setting up backend ==="
cd backend
cp -n .env.example .env 2>/dev/null || true
npx prisma generate
npx prisma db push
cd ..

echo "=== Building frontend ==="
cd frontend
npm run build
cd ..

echo "=== Building backend ==="
cd backend
npm run build
cd ..

echo "=== Build complete ==="
