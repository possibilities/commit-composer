import { existsSync, unlinkSync } from 'fs'
import { basename } from 'path'
import { executeWithExitCode } from './process.js'

export function getProjectName(): string {
  return basename(process.cwd())
}

export function errorExit(message: string): never {
  console.error(message)
  process.exit(1)
}

export function cleanupFile(filePath: string): void {
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath)
    } catch {
      // Ignore cleanup errors
    }
  }
}

export async function checkRequiredExecutables(): Promise<void> {
  const missing: string[] = []

  const { exitCode: gitExists } = await executeWithExitCode('command -v git')
  if (gitExists !== 0) {
    missing.push('  - git: Git is required for version control operations')
  }

  const { exitCode: treeExists } = await executeWithExitCode('command -v tree')
  if (treeExists !== 0) {
    missing.push('  - tree: tree is required for displaying project structure')
  }

  if (missing.length > 0) {
    console.error('Error: Required executables are missing:')
    missing.forEach(msg => console.error(msg))
    errorExit(
      '\nPlease install the missing executables before running this script.',
    )
  }
}
