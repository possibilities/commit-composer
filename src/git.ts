import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { execute, executeWithExitCode } from './process.js'
import { errorExit } from './utils.js'

export async function ensureGitRepository(): Promise<void> {
  const { exitCode } = await executeWithExitCode('git rev-parse --git-dir')
  if (exitCode !== 0) {
    errorExit('Not in a git repository')
  }
}

export function isInWorktree(): boolean {
  const gitPath = join(process.cwd(), '.git')
  if (existsSync(gitPath)) {
    try {
      const stats = statSync(gitPath)
      if (stats.isFile()) {
        const content = readFileSync(gitPath, 'utf8')
        return content.includes('gitdir:')
      }
    } catch {}
  }
  return false
}

export async function getStagedFiles(): Promise<string[]> {
  const { stdout } = await execute('git diff --cached --name-only')
  return stdout.split('\n').filter(file => file.length > 0)
}

export async function getUntrackedFiles(): Promise<string[]> {
  const { stdout } = await execute('git ls-files --others --exclude-standard')
  return stdout.split('\n').filter(file => file.length > 0)
}

export async function stageAllChanges(): Promise<boolean> {
  console.error('Adding all files to git...')
  await execute('git add .')

  const stagedFiles = await getStagedFiles()
  if (stagedFiles.length === 0) {
    console.log('There is nothing to commit.')
    return false
  }
  return true
}

export async function getTreeOutput(): Promise<string> {
  try {
    const { stdout } = await execute('tree --gitignore')
    return stdout
  } catch {
    return 'tree command failed'
  }
}

export async function getDiffCached(): Promise<string> {
  try {
    const { stdout } = await execute('git --no-pager diff --cached')
    return stdout
  } catch {
    return 'git diff failed'
  }
}

export async function getGitStatus(): Promise<string> {
  try {
    const { stdout } = await execute('git status --porcelain')
    return stdout
  } catch {
    return 'git status failed'
  }
}

export async function createCommit(message: string): Promise<void> {
  const { exitCode } = await executeWithExitCode(
    `git commit -m "${message.replace(/"/g, '\\"')}"`,
  )
  if (exitCode !== 0) {
    errorExit('Failed to create commit!')
  }
  console.error('Commit created successfully!')
  console.error('')
}

export async function showCommitSummary(): Promise<void> {
  try {
    const { stdout } = await execute('git --no-pager show --stat')
    console.log(stdout)
  } catch (error) {}
}

export async function getCurrentBranch(): Promise<string> {
  const { stdout } = await execute('git rev-parse --abbrev-ref HEAD')
  return stdout
}

export async function hasRemoteOrigin(): Promise<boolean> {
  const { exitCode } = await executeWithExitCode('git remote get-url origin')
  return exitCode === 0
}

export async function pushToRemote(): Promise<void> {
  const currentBranch = await getCurrentBranch()
  console.error('Pushing to origin...')
  const { exitCode } = await executeWithExitCode(
    `git push -u origin "${currentBranch}"`,
  )
  if (exitCode !== 0) {
    errorExit(
      'Failed to push to origin.\nCommit was created successfully but not pushed.',
    )
  }
  console.error('Pushed successfully!')
}

export async function setupRemoteAndPush(): Promise<void> {
  if (await hasRemoteOrigin()) {
    await pushToRemote()
    return
  }

  console.error('No origin remote found. Creating git repository...')

  const repoName = process.cwd().split('/').pop() || 'repo'

  const { exitCode: ghExists } = await executeWithExitCode('command -v gh')
  if (ghExists !== 0) {
    console.error(
      'GitHub CLI (gh) is not installed. Please install it to create a remote repository.',
    )
    console.error('Commit was created successfully but not pushed.')
    return
  }

  const { exitCode: ghAuth } = await executeWithExitCode('gh auth status')
  if (ghAuth !== 0) {
    errorExit(
      "GitHub CLI is not authenticated. Please run 'gh auth login' first.\nCommit was created successfully but not pushed.",
    )
  }

  console.error(`Creating private git repository: ${repoName}`)
  const { exitCode: createRepo } = await executeWithExitCode(
    `gh repo create "${repoName}" --private --source=. --remote=origin --push`,
  )

  if (createRepo === 0) {
    console.error('Repository created and pushed successfully!')
    return
  }

  console.error(
    'Repository creation failed. Attempting to use existing repository...',
  )

  const { stdout: githubUser } = await execute('gh api user --jq .login')
  if (!githubUser) {
    errorExit(
      'Failed to determine GitHub username.\nCommit was created successfully but not pushed.',
    )
  }

  const remoteUrl = `https://github.com/${githubUser}/${repoName}.git`
  console.error(`Setting up remote for existing repository: ${remoteUrl}`)

  await execute(`git remote add origin "${remoteUrl}"`)
  console.error('Remote added successfully')

  const currentBranch = await getCurrentBranch()
  console.error('Attempting to push to existing repository...')

  const { exitCode: pushNormal } = await executeWithExitCode(
    `git push -u origin "${currentBranch}"`,
  )
  if (pushNormal === 0) {
    console.error('Pushed successfully to existing repository!')
    return
  }

  const { exitCode: pushForce } = await executeWithExitCode(
    `git push -u origin "${currentBranch}" --force`,
  )
  if (pushForce === 0) {
    console.error('Force pushed successfully to existing repository!')
    return
  }

  errorExit(
    'Failed to push to repository. The repository might not exist or you might not have access.\nCommit was created successfully but not pushed.',
  )
}
