import { existsSync } from 'fs'
import { getTreeOutput, getDiffCached, getGitStatus } from './git.js'
import { runClaude } from './claude.js'
import {
  SECURITY_CHECK_SUCCESS_FILE,
  SECURITY_CHECK_FAILURE_FILE,
} from './config.js'
import { cleanupFile, errorExit } from './utils.js'

export async function runSecurityCheck(): Promise<void> {
  console.error('Running security check...')

  const prompt = await getSafetyCheckPrompt()
  await runClaude(prompt, true)

  if (existsSync(SECURITY_CHECK_FAILURE_FILE)) {
    console.error('Error: Security check failed!')
    console.error('Security issues found:')

    const { readFileSync } = await import('fs')
    const content = readFileSync(SECURITY_CHECK_FAILURE_FILE, 'utf8')
    console.error(content)

    cleanupFile(SECURITY_CHECK_FAILURE_FILE)
    errorExit('Security check failed! Check the security issues above.')
  }

  if (!existsSync(SECURITY_CHECK_SUCCESS_FILE)) {
    errorExit(
      'Security check did not complete successfully! Missing ./SUCCEEDED-SECURITY-CHECK.txt file',
    )
  }

  cleanupFile(SECURITY_CHECK_SUCCESS_FILE)
  console.error('Security check passed.')
  cleanupFile(SECURITY_CHECK_FAILURE_FILE)
}

async function getSafetyCheckPrompt(): Promise<string> {
  const treeOutput = await getTreeOutput()
  const diffOutput = await getDiffCached()
  const statusOutput = await getGitStatus()

  return `<Role>
You are a engineer who is an expert at performing software security checks.
</Role>

<Context>
<Command>
<CommandDescription>
A tree of all repository files and directories
</CommandDescription>
<CommandInput>
tree --gitignore
</CommandInput>
<CommandOutput>
${treeOutput}
</CommandOutput>
</Command>

<Command>
<CommandDescription>
All staged changes
</CommandDescription>
<CommandInput>
git --no-pager diff --cached
</CommandInput>
<CommandOutput>
${diffOutput}
</CommandOutput>
</Command>

<Command>
<CommandDescription>
Status of repo changes
</CommandDescription>
<CommandInput>
git status --porcelain
</CommandInput>
<CommandOutput>
${statusOutput}
</CommandOutput>
</Command>
</Context>

<Instructions>
All changes are in the working tree and all context to create a commit message are in the conversation.
Follow these instructions step-by-step:
- Perform a safety and security check of the current repo changes
- Look for the following unsafe scenarios:
  - Suspicious files or changes
  - Any credentials are present
  - Files are committed that should be ignored
  - Binaries are committed
  - Secrets accidentally embedded in code (e.g., API keys, tokens)
  - Executable scripts without shebang or unexpected permissions
  - Unexpected changes to configuration or dependency files (e.g., package-lock.json, requirements.txt)
- When complete save file with the contents of the security check 
  - If no unsafe scenarios are present, save the summary as SUCCEEDED-SECURITY-CHECK.txt in the current directory
  - If unsafe scenarios are present, save the summary as FAILED-SECURITY-CHECK.txt in the current directory
- If you need to save the commit message to a text file, use the /tmp directory (e.g., /tmp/commit_message.txt)
</Instructions>`
}
