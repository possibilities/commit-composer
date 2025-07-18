import prompts from 'prompts'
import { exec } from 'child_process'
import { runContextComposerWithClaude } from './claude.js'
import { errorExit } from './utils.js'

function sendDesktopNotification(title: string, message: string) {
  exec(
    `notify-send "${title}" "${message}" --urgency=critical`,
    error =>
      error && console.error('Failed to send notification:', error.message),
  )
}

async function handleCommitWordInMessage(
  cleanedMessage: string,
  verboseClaudeOutput: boolean,
  verbosePromptOutput: boolean,
): Promise<string> {
  console.error('\n⚠️  Generated message contains the word "commit":')
  console.error(`\n${cleanedMessage}\n`)

  sendDesktopNotification(
    'Commit Composer',
    "Generated message contains the word 'commit'. Please review.",
  )

  const response = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { title: 'Use this message anyway', value: 'use' },
      { title: 'Generate a new message', value: 'regenerate' },
      { title: 'Cancel', value: 'cancel' },
    ],
    initial: 0,
  })

  switch (response.action) {
    case 'use':
      console.error('\nUsing the generated message.')
      return cleanedMessage
    case 'regenerate':
      console.error('\nRegenerating commit message...')
      return generateCommitMessage(verboseClaudeOutput, verbosePromptOutput)
    default:
      await errorExit('Commit cancelled by user.')
      throw new Error('Unreachable')
  }
}

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
    return handleCommitWordInMessage(
      cleanedMessage,
      verboseClaudeOutput,
      verbosePromptOutput,
    )
  }

  console.error('Creating commit with message:')
  console.error(cleanedMessage)

  return cleanedMessage
}
