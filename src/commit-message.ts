import { getTreeOutput, getDiffCached, getGitStatus } from './git.js'
import { runClaude } from './claude.js'
import { errorExit } from './utils.js'

export async function generateCommitMessage(): Promise<string> {
  console.error('Generating commit message...')

  const prompt = await getCreateCommitPrompt()
  const message = await runClaude(prompt, true, true)

  if (!message) {
    errorExit('No commit message was generated!')
  }

  let cleanedMessage = message
  if (message.startsWith('Initial commit: ')) {
    cleanedMessage = message.substring('Initial commit: '.length)
  }

  if (cleanedMessage.toLowerCase().includes('commit')) {
    errorExit(
      `Commit message cannot contain the word 'commit'. Generated message: ${message}`,
    )
  }

  console.error('Creating commit with message:')
  console.error(cleanedMessage)

  return cleanedMessage
}

async function getCreateCommitPrompt(): Promise<string> {
  const treeOutput = await getTreeOutput()
  const diffOutput = await getDiffCached()
  const statusOutput = await getGitStatus()

  return `<Role>
You are a engineer who is an expert at git and writing commit messages. You are a human making a commit for code written by you, a human.
</Role>

<Rules>
- When writing a commit message summarize the changes
  - Explain _what_ changed and what the effects on users will be
  - **Never** try to explain _why_ the changes were made unless it is explicit in the context
</Rules>

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
All changes are in the working tree and all context to create a commit message are in the conversation. Analyze the changes and respond with ONLY the commit message text - no explanations, no additional commentary, just the commit message itself.
If you need to save the commit message to a text file, use the /tmp directory (e.g., /tmp/commit_message.txt).
</Instructions>`
}
