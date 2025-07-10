#!/usr/bin/env bash
set -x

# Create a test directory
TEST_DIR=$(mktemp -d /tmp/debug-test.XXXXXX)
cd "$TEST_DIR"

# Initialize git
git init
git config user.email "test@example.com"
git config user.name "Test User"

# Create initial commit
echo "Initial content" > test.txt
git add .
git commit -m "Initial commit"

# Make a change
echo "Modified content" >> test.txt

# Run commit-composer with debugging
node "$HOME/code/commit-composer/dist/cli.js" 2>&1 | tee debug.log

echo "Exit code: $?"
echo "Test dir: $TEST_DIR"