import { existsSync } from 'fs'
import { runContextComposerWithClaude } from './claude.js'
import {
  SECURITY_CHECK_SUCCESS_FILE,
  SECURITY_CHECK_FAILURE_FILE,
} from './config.js'
import { cleanupFile, errorExit } from './utils.js'

export async function runSecurityCheck(
  claudePath: string,
  verboseClaudeOutput: boolean = false,
  verbosePromptOutput: boolean = false,
): Promise<void> {
  console.error('Running security check...')

  await runContextComposerWithClaude(
    'safety-check.md',
    claudePath,
    true,
    false,
    verboseClaudeOutput,
    verbosePromptOutput,
  )

  if (existsSync(SECURITY_CHECK_FAILURE_FILE)) {
    console.error('Error: Security check failed!')
    console.error('Security issues found:')

    const { readFileSync } = await import('fs')
    const content = readFileSync(SECURITY_CHECK_FAILURE_FILE, 'utf8')
    console.error(content)

    cleanupFile(SECURITY_CHECK_FAILURE_FILE)
    await errorExit('Security check failed! Check the security issues above.')
  }

  if (!existsSync(SECURITY_CHECK_SUCCESS_FILE)) {
    await errorExit(
      'Security check did not complete successfully! Missing ./SUCCEEDED-SECURITY-CHECK.txt file',
    )
  }

  cleanupFile(SECURITY_CHECK_SUCCESS_FILE)
  console.error('Security check passed.')
  cleanupFile(SECURITY_CHECK_FAILURE_FILE)
}
