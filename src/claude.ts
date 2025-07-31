import { existsSync, accessSync, constants } from 'fs'
import { spawn, execSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { errorExit, cleanupFile } from './utils.js'
import { getUntrackedFiles } from './git.js'

const disallowedTools = [
  'Read',
  'Bash',
  'Task',
  'Glob',
  'Grep',
  'LS',
  'Edit',
  'MultiEdit',
  'NotebookRead',
  'NotebookEdit',
  'WebFetch',
  'TodoRead',
  'TodoWrite',
  'WebSearch',
]

const claudeArgs = [
  '--print',
  '--verbose',
  '--output-format',
  'stream-json',
  '--permission-mode',
  'default',
  '--allowedTools',
  'Write',
  ...disallowedTools.flatMap(tool => ['--disallowedTools', tool]),
  '--add-dir',
  '/tmp',
  '--model',
  'sonnet',
]

interface ClaudeResponse {
  type: string
  subtype?: string
  result?: string
}

export async function runContextComposerWithClaude(
  promptFile: string,
  claudePath: string,
  validateResult: boolean = false,
  captureFileContent: boolean = false,
  verboseClaudeOutput: boolean = false,
  verbosePromptOutput: boolean = false,
): Promise<string> {
  const beforeFiles = await getUntrackedFiles()

  const promptPath = await resolvePromptPath(promptFile)

  const contextComposerArgs = [
    'context-composer',
    promptPath,
    '--invoke-commands',
    '--strip-frontmatter',
  ]

  let lastLine = ''
  let messageContent = ''
  const outputLines: string[] = []
  let claudeStderrOutput = ''
  let contextComposerStderrOutput = ''

  let contextComposerSpawnError: Error | null = null
  let claudeSpawnError: Error | null = null

  const exitCode = await new Promise<number>((resolve, reject) => {
    const contextComposer = spawn('npx', contextComposerArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const claude = spawn(claudePath, claudeArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    contextComposer.stdout.on('data', data => {
      if (verbosePromptOutput) {
        const output = data.toString()
        console.error('--------- CONTEXT-COMPOSER OUTPUT START ---------')
        console.error(output)
        console.error('--------- CONTEXT-COMPOSER OUTPUT END ---------')
      }

      claude.stdin.write(data)
    })

    contextComposer.stdout.on('end', () => {
      claude.stdin.end()
    })

    contextComposer.stderr.on('data', data => {
      const errorOutput = data.toString()
      contextComposerStderrOutput += errorOutput
      process.stderr.write(`context-composer: ${errorOutput}`)
    })

    claude.stdout.on('data', data => {
      const lines = data
        .toString()
        .split('\n')
        .filter((line: string) => line.trim())
      lines.forEach((line: string) => {
        outputLines.push(line)
        if (!captureFileContent && verboseClaudeOutput) {
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

    claude.stderr.on('data', data => {
      const errorOutput = data.toString()
      claudeStderrOutput += errorOutput
      process.stderr.write(errorOutput)
    })

    contextComposer.on('error', err => {
      contextComposerSpawnError = err
      reject(err)
    })

    claude.on('error', err => {
      claudeSpawnError = err
      reject(err)
    })

    claude.on('close', code => {
      resolve(code || 0)
    })
  }).catch(error => {
    if (contextComposerSpawnError) {
      throw new Error(
        `Failed to spawn context-composer: ${contextComposerSpawnError.message}`,
      )
    }
    if (claudeSpawnError) {
      throw new Error(`Failed to spawn Claude CLI: ${claudeSpawnError.message}`)
    }
    throw error
  })

  if (exitCode !== 0) {
    await cleanupNewFiles(beforeFiles)
    let errorMessage = `Claude command failed with exit code ${exitCode}`

    errorMessage += `\n\nContext: Running ${promptFile} prompt`

    if (claudeStderrOutput.trim()) {
      errorMessage += `\n\nClaude error output:\n${claudeStderrOutput.trim()}`
    }

    if (contextComposerStderrOutput.trim()) {
      errorMessage += `\n\nContext composer error output:\n${contextComposerStderrOutput.trim()}`
    }

    if (lastLine) {
      try {
        const parsed: ClaudeResponse = JSON.parse(lastLine)
        if (
          parsed.type === 'result' &&
          parsed.subtype === 'error' &&
          parsed.result
        ) {
          errorMessage += `\n\nClaude error message:\n${parsed.result}`
        }
      } catch {}
    }

    await errorExit(errorMessage)
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
      if (!lastLine) {
        await cleanupNewFiles(beforeFiles)
        await errorExit(
          `No response received from Claude while running ${promptFile} prompt`,
        )
      }

      const parsed: ClaudeResponse = JSON.parse(lastLine)
      if (parsed.type !== 'result' || parsed.subtype !== 'success') {
        await cleanupNewFiles(beforeFiles)
        let errorMessage = `Claude returned an error result while running ${promptFile} prompt`

        if (
          parsed.type === 'result' &&
          parsed.subtype === 'error' &&
          parsed.result
        ) {
          errorMessage += `\n\nError details: ${parsed.result}`
        }

        await errorExit(errorMessage)
      }
    } catch (parseError) {
      await cleanupNewFiles(beforeFiles)
      let errorMessage = `Invalid response format from Claude while running ${promptFile} prompt`

      if (lastLine) {
        errorMessage += `\n\nLast line received: ${lastLine}`
      }

      errorMessage += `\n\nParse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`

      await errorExit(errorMessage)
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

async function resolvePromptPath(promptFile: string): Promise<string> {
  const currentModuleDirectory = dirname(fileURLToPath(import.meta.url))

  const developmentPath = join(
    currentModuleDirectory,
    '..',
    'prompts',
    promptFile,
  )
  if (existsSync(developmentPath)) {
    return developmentPath
  }

  const productionPath = join(currentModuleDirectory, 'prompts', promptFile)
  if (existsSync(productionPath)) {
    return productionPath
  }

  await errorExit(
    `Prompt file not found: ${promptFile} (tried ${developmentPath} and ${productionPath})`,
  )
  throw new Error('Unreachable')
}

export async function verifyClaudeExecutable(): Promise<string> {
  try {
    const pathResult = execSync('which claude', { encoding: 'utf-8' }).trim()
    if (pathResult) {
      return pathResult
    }
  } catch {}

  try {
    const commandResult = execSync('command -v claude', {
      encoding: 'utf-8',
    }).trim()
    if (commandResult) {
      return commandResult
    }
  } catch {}

  const homeDir = process.env.HOME || process.env.USERPROFILE || ''
  const officialPath = join(homeDir, '.claude', 'local', 'claude')

  if (existsSync(officialPath)) {
    try {
      accessSync(officialPath, constants.F_OK | constants.X_OK)
      return officialPath
    } catch {
      await errorExit(
        `Claude CLI found at ${officialPath} but is not executable. Please ensure it has execute permissions.`,
      )
    }
  }

  await errorExit(
    'Claude CLI not found. Please ensure Claude CLI is installed either in your PATH or at ~/.claude/local/claude',
  )
  throw new Error('Unreachable')
}
