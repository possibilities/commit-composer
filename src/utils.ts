import { existsSync, unlinkSync } from 'fs'
import { basename } from 'path'
import { executeWithExitCode, sendNotification } from './process.js'

export function getProjectName(): string {
  return basename(process.cwd())
}

export async function errorExit(
  message: string,
  skipNotification: boolean = false,
): Promise<never> {
  console.error(message)
  if (!skipNotification) {
    const projectName = getProjectName()
    await sendNotification(
      '❌ Error: Commit Not Created',
      `Project: ${projectName}\n${message}`,
    )
  }
  process.exit(1)
}

export function cleanupFile(filePath: string): void {
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath)
    } catch {}
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
    await errorExit(
      '\nPlease install the missing executables before running this script.',
    )
  }
}
