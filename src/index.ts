import { Command } from 'commander'
import packageJson from '../package.json' assert { type: 'json' }
import { CommitComposerOptions, SECURITY_CHECK_SUCCESS_FILE } from './config.js'
import {
  checkRequiredExecutables,
  cleanupFile,
  errorExit,
  getProjectName,
} from './utils.js'
import { sendNotification } from './process.js'
import {
  ensureGitRepository,
  stageAllChanges,
  createCommit,
  showCommitSummary,
  setupRemoteAndPush,
  isInWorktree,
} from './git.js'
import { verifyClaudeExecutable } from './claude.js'
import { runSecurityCheck } from './security.js'
import { formatAndLintCode, runTests } from './package-scripts.js'
import { generateCommitMessage } from './commit-message.js'

async function commitComposer(options: CommitComposerOptions) {
  const projectName = getProjectName()

  process.on('exit', () => {
    cleanupFile(SECURITY_CHECK_SUCCESS_FILE)
  })

  process.on('uncaughtException', async error => {
    const message = error.message || 'Unknown error'
    console.error(`Error: ${message}`)
    await sendNotification(
      '❌ Error: Commit Not Created',
      `Project: ${projectName}\n${message}`,
    )
    process.exit(1)
  })

  try {
    cleanupFile(SECURITY_CHECK_SUCCESS_FILE)

    await checkRequiredExecutables()
    await verifyClaudeExecutable()
    await ensureGitRepository()

    await formatAndLintCode()

    const hasChanges = await stageAllChanges()

    if (!hasChanges) {
      console.error(
        'No changes to commit. Ensuring repository is pushed to git repo...',
      )
      if (isInWorktree()) {
        console.error('Skipping sync - detected git worktree')
      } else {
        await setupRemoteAndPush()
        await sendNotification(
          '📋 Repository Synced',
          `Project: ${projectName}\nRepository synced with git repo (no new changes)`,
        )
      }
      return
    }

    await runTests()

    if (options.dangerouslySkipSecurityCheck) {
      console.error(
        '⚠️  WARNING: Security check is being skipped! (--dangerously-skip-security-check flag is set)',
      )
      console.error(
        "⚠️  This is potentially dangerous - ensure you've reviewed all changes manually!",
      )
    } else {
      await runSecurityCheck(
        options.verboseClaudeOutput,
        options.verbosePromptOutput,
      )
    }

    const commitMessage = await generateCommitMessage(
      options.verboseClaudeOutput,
      options.verbosePromptOutput,
    )

    await createCommit(commitMessage)

    if (isInWorktree()) {
      console.error('Skipping push - detected git worktree')
      await sendNotification(
        '✅ Commit Created (Worktree)',
        `Project: ${projectName}\n${commitMessage.split('\n')[0]}`,
      )
    } else {
      await setupRemoteAndPush()
      await sendNotification(
        '✅ Commit Created',
        `Project: ${projectName}\n${commitMessage.split('\n')[0]}`,
      )
    }

    try {
      await showCommitSummary()
    } catch (error) {}
  } catch (error: any) {
    const message = error.message || 'Unknown error'
    console.error('Error details:', error)
    await sendNotification(
      '❌ Error: Commit Not Created',
      `Project: ${projectName}\n${message}`,
    )
    await errorExit(message, true)
  }
}

async function main() {
  const program = new Command()

  program
    .name('commit-composer')
    .description('Automatically create commits with AI-generated messages')
    .version(packageJson.version)
    .option(
      '--dangerously-skip-security-check',
      'Skip security check (use with caution!)',
    )
    .option(
      '--verbose-claude-output',
      'Show verbose Claude output (JSON stream)',
    )
    .option('--verbose-prompt-output', 'Show the full prompt sent to Claude')
    .action(async options => {
      await commitComposer({
        dangerouslySkipSecurityCheck:
          options.dangerouslySkipSecurityCheck || false,
        verboseClaudeOutput: options.verboseClaudeOutput || false,
        verbosePromptOutput: options.verbosePromptOutput || false,
      })
    })

  try {
    program.exitOverride()
    program.configureOutput({
      writeErr: str => process.stderr.write(str),
    })

    await program.parseAsync(process.argv)
  } catch (error: any) {
    if (
      error.code === 'commander.help' ||
      error.code === 'commander.helpDisplayed' ||
      error.code === 'commander.version'
    ) {
      process.exit(0)
    }
    console.error('Error:', error.message || error)
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
