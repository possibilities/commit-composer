import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { executeWithExitCode } from './process.js'
import { errorExit } from './utils.js'

interface PackageJson {
  scripts?: Record<string, string>
}

async function hasScript(scriptName: string): Promise<boolean> {
  const packageJsonPath = join(process.cwd(), 'package.json')
  if (!existsSync(packageJsonPath)) {
    return false
  }

  try {
    const content = readFileSync(packageJsonPath, 'utf8')
    const packageJson: PackageJson = JSON.parse(content)
    return !!packageJson.scripts?.[scriptName]
  } catch {
    return false
  }
}

export async function formatAndLintCode(): Promise<void> {
  const packageJsonPath = join(process.cwd(), 'package.json')
  if (!existsSync(packageJsonPath)) {
    console.error('No package.json found - skipping code quality checks')
    return
  }

  if (await hasScript('format')) {
    console.error('Formatting with pnpm...')
    const { exitCode } = await executeWithExitCode('pnpm run format')
    if (exitCode !== 0) {
      errorExit('Code formatting failed')
    }
  } else {
    console.error('No format script found in package.json')
  }

  if (await hasScript('lint')) {
    console.error('Linting with pnpm...')
    const { exitCode } = await executeWithExitCode('pnpm run lint')
    if (exitCode !== 0) {
      errorExit('Code linting failed')
    }
  } else {
    console.error('No lint script found in package.json')
  }

  if (await hasScript('typecheck')) {
    console.error('Type checking with pnpm...')
    const { exitCode } = await executeWithExitCode('pnpm run typecheck')
    if (exitCode !== 0) {
      errorExit('Type checking failed')
    }
  } else {
    console.error('No typecheck script found in package.json')
  }
}

export async function runTests(): Promise<void> {
  const packageJsonPath = join(process.cwd(), 'package.json')
  if (!existsSync(packageJsonPath)) {
    console.error('No package.json found - skipping tests')
    return
  }

  if (await hasScript('test')) {
    console.error('Running tests with pnpm test...')
    const { exitCode } = await executeWithExitCode('pnpm run test')
    if (exitCode !== 0) {
      errorExit('Tests failed')
    }
  } else {
    console.error('No test script found in package.json')
  }
}
