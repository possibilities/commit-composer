import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { ALLOWED_TOOLS, CLAUDE_EXECUTABLE, DISALLOWED_TOOLS } from './config.js'
import { errorExit, cleanupFile } from './utils.js'
import { getUntrackedFiles } from './git.js'

interface ClaudeResponse {
  type: string
  subtype?: string
  result?: string
}

export async function runClaude(
  prompt: string,
  validateResult: boolean = false,
  captureFileContent: boolean = false,
): Promise<string> {
  const beforeFiles = await getUntrackedFiles()

  if (!captureFileContent && process.env.VERBOSE_CLAUDE_OUTPUT === 'true') {
    console.error('-----')
    console.error(prompt)
    console.error('-----')
  }

  const args = [
    '--print',
    '--verbose',
    '--output-format',
    'stream-json',
    '--model',
    'sonnet',
    '--add-dir',
    '/tmp',
    '--add-dir',
    process.cwd(),
  ]

  ALLOWED_TOOLS.forEach(tool => {
    args.push('--allowedTools', tool)
  })

  DISALLOWED_TOOLS.forEach(tool => {
    args.push('--disallowedTools', tool)
  })

  let lastLine = ''
  let messageContent = ''
  const outputLines: string[] = []

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(CLAUDE_EXECUTABLE, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    child.stdin.write(prompt)
    child.stdin.end()

    child.stdout.on('data', data => {
      const lines = data
        .toString()
        .split('\n')
        .filter((line: string) => line.trim())
      lines.forEach((line: string) => {
        outputLines.push(line)
        if (
          !captureFileContent &&
          process.env.VERBOSE_CLAUDE_OUTPUT === 'true'
        ) {
          try {
            const parsed = JSON.parse(line)
            console.error(JSON.stringify(parsed, null, 2))
          } catch {
            console.error(line)
          }
        }
        lastLine = line
      })
    })

    child.stderr.on('data', data => {
      process.stderr.write(data)
    })

    child.on('close', code => {
      resolve(code || 0)
    })

    child.on('error', err => {
      reject(err)
    })
  })

  if (exitCode !== 0) {
    await cleanupNewFiles(beforeFiles)
    errorExit(`Claude command failed with exit code ${exitCode}`)
  }

  if (captureFileContent) {
    try {
      const parsed: ClaudeResponse = JSON.parse(lastLine)
      if (
        parsed.type === 'result' &&
        parsed.subtype === 'success' &&
        parsed.result
      ) {
        messageContent = parsed.result
      }
    } catch {}
  }

  if (validateResult) {
    try {
      const parsed: ClaudeResponse = JSON.parse(lastLine)
      if (parsed.type !== 'result' || parsed.subtype !== 'success') {
        await cleanupNewFiles(beforeFiles)
        errorExit('Claude returned an error result')
      }
    } catch {
      await cleanupNewFiles(beforeFiles)
      errorExit('Invalid response format from Claude')
    }
  }

  await cleanupNewFiles(beforeFiles, [
    'SUCCEEDED-SECURITY-CHECK.txt',
    'FAILED-SECURITY-CHECK.txt',
  ])

  return messageContent
}

export async function runClaudeCommand(
  command: string,
  validateResult: boolean = false,
  captureFileContent: boolean = false,
): Promise<string> {
  const beforeFiles = await getUntrackedFiles()

  const args = [
    command,
    '--print',
    '--verbose',
    '--output-format',
    'stream-json',
    '--model',
    'sonnet',
    '--add-dir',
    '/tmp',
    '--add-dir',
    process.cwd(),
  ]

  ALLOWED_TOOLS.forEach(tool => {
    args.push('--allowedTools', tool)
  })

  DISALLOWED_TOOLS.forEach(tool => {
    args.push('--disallowedTools', tool)
  })

  let lastLine = ''
  let messageContent = ''
  const outputLines: string[] = []

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(CLAUDE_EXECUTABLE, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    child.stdout.on('data', data => {
      const lines = data
        .toString()
        .split('\n')
        .filter((line: string) => line.trim())
      lines.forEach((line: string) => {
        outputLines.push(line)
        if (
          !captureFileContent &&
          process.env.VERBOSE_CLAUDE_OUTPUT === 'true'
        ) {
          try {
            const parsed = JSON.parse(line)
            console.error(JSON.stringify(parsed, null, 2))
          } catch {
            console.error(line)
          }
        }
        lastLine = line
      })
    })

    child.stderr.on('data', data => {
      process.stderr.write(data)
    })

    child.on('close', code => {
      resolve(code || 0)
    })

    child.on('error', err => {
      reject(err)
    })
  })

  if (exitCode !== 0) {
    await cleanupNewFiles(beforeFiles)
    errorExit(`Claude command failed with exit code ${exitCode}`)
  }

  if (captureFileContent) {
    try {
      const parsed: ClaudeResponse = JSON.parse(lastLine)
      if (
        parsed.type === 'result' &&
        parsed.subtype === 'success' &&
        parsed.result
      ) {
        messageContent = parsed.result
      }
    } catch {}
  }

  if (validateResult) {
    try {
      const parsed: ClaudeResponse = JSON.parse(lastLine)
      if (parsed.type !== 'result' || parsed.subtype !== 'success') {
        await cleanupNewFiles(beforeFiles)
        errorExit('Claude returned an error result')
      }
    } catch {
      await cleanupNewFiles(beforeFiles)
      errorExit('Invalid response format from Claude')
    }
  }

  await cleanupNewFiles(beforeFiles, [
    'SUCCEEDED-SECURITY-CHECK.txt',
    'FAILED-SECURITY-CHECK.txt',
  ])

  return messageContent
}

async function cleanupNewFiles(
  beforeFiles: string[],
  excludeFiles: string[] = [],
): Promise<void> {
  const afterFiles = await getUntrackedFiles()

  for (const file of afterFiles) {
    if (!beforeFiles.includes(file) && !excludeFiles.includes(file)) {
      console.error(`Cleaning up created file: ${file}`)
      cleanupFile(file)
    }
  }
}

export function verifyClaudeExecutable(): void {
  if (!existsSync(CLAUDE_EXECUTABLE)) {
    errorExit(
      `Claude CLI not found at ${CLAUDE_EXECUTABLE}. Please ensure Claude CLI is installed.`,
    )
  }
}
