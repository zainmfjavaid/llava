#!/bin/bash

# =====================================
# Development Build Script for llava (macOS only)
# No notarization - for development/testing
# =====================================

echo "Building llava for macOS (development)…"
npm run dist -- --mac

echo "macOS development build process completed."

echo "Checking app signature status..."
# Adjust path if your output directory or app name differs
APP_PATH_ARM64="dist/mac-arm64/llava.app"
APP_PATH_UNIVERSAL="dist/mac/llava.app"

if [ -d "$APP_PATH_ARM64" ]; then
  echo "Checking ARM64 app: $APP_PATH_ARM64"
  codesign --verify --verbose=4 "$APP_PATH_ARM64"
elif [ -d "$APP_PATH_UNIVERSAL" ]; then
  echo "Checking Universal app: $APP_PATH_UNIVERSAL"
  codesign --verify --verbose=4 "$APP_PATH_UNIVERSAL"
else
  echo "Warning: macOS app not found in expected locations (dist/mac-arm64/ or dist/mac/)"
fi

echo "Done! llava macOS development build complete." 