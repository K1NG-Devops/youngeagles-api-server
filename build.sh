#!/bin/sh

# Exit on any error
set -e

# Install dependencies
echo "Installing dependencies..."
npm install --production --no-audit --no-fund

# Clean up
echo "Cleaning up..."
rm -rf .git .gitignore .npmrc .dockerignore Dockerfile build.sh

# Print success message
echo "Build completed successfully!" 