import { runContextComposerWithClaude } from './claude.js'
import { errorExit } from './utils.js'

export async function generateCommitMessage(
  verboseClaudeOutput: boolean = false,
  verbosePromptOutput: boolean = false,
): Promise<string> {
  console.error('Generating commit message...')

  const message = await runContextComposerWithClaude(
    'commit-message.md',
    true,
    true,
    verboseClaudeOutput,
    verbosePromptOutput,
  )

  if (!message) {
    await errorExit('No commit message was generated!')
  }

  let cleanedMessage = message
  if (message.startsWith('Initial commit: ')) {
    cleanedMessage = message.substring('Initial commit: '.length)
  }

  if (cleanedMessage.toLowerCase().includes('commit')) {
    await errorExit(
      `Commit message cannot contain the word 'commit'. Generated message: ${message}`,
    )
  }

  console.error('Creating commit with message:')
  console.error(cleanedMessage)

  return cleanedMessage
}
