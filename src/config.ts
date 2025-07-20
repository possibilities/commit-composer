export const SECURITY_CHECK_SUCCESS_FILE = './SUCCEEDED-SECURITY-CHECK.txt'
export const SECURITY_CHECK_FAILURE_FILE = './FAILED-SECURITY-CHECK.txt'

export interface CommitComposerOptions {
  dangerouslySkipSecurityCheck: boolean
  verboseClaudeOutput: boolean
  verbosePromptOutput: boolean
}
