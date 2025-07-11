import { homedir } from 'os'
import { join } from 'path'

export const CLAUDE_EXECUTABLE =
  process.env.CLAUDE_EXECUTABLE || join(homedir(), '.claude', 'local', 'claude')

export const SECURITY_CHECK_SUCCESS_FILE = './SUCCEEDED-SECURITY-CHECK.txt'
export const SECURITY_CHECK_FAILURE_FILE = './FAILED-SECURITY-CHECK.txt'

export interface CommitComposerOptions {
  dangerouslySkipSecurityCheck: boolean
  verboseClaudeOutput: boolean
  verbosePromptOutput: boolean
}
