import { runClaudeCommand } from './claude.js'
import { errorExit } from './utils.js'

export async function generateCommitMessage(): Promise<string> {
  console.error('Generating commit message...')

  const message = await runClaudeCommand(
    '/commit-composer/commit-message',
    true,
    true,
  )

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
