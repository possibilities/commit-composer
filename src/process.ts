import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface ExecResult {
  stdout: string
  stderr: string
}

export async function execute(command: string): Promise<ExecResult> {
  try {
    const result = await execAsync(command, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    })
    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    }
  } catch (error: any) {
    if (error.stdout || error.stderr) {
      return {
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || '',
      }
    }
    throw error
  }
}

export async function executeWithExitCode(
  command: string,
): Promise<{ exitCode: number } & ExecResult> {
  try {
    const result = await execAsync(command, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    })
    return {
      exitCode: 0,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    }
  } catch (error: any) {
    return {
      exitCode: error.code || 1,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || '',
    }
  }
}

export function spawnStreaming(
  command: string,
  args: string[],
  onData: (data: string) => void,
  onError?: (data: string) => void,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: true })

    child.stdout.on('data', data => {
      onData(data.toString())
    })

    child.stderr.on('data', data => {
      if (onError) {
        onError(data.toString())
      } else {
        process.stderr.write(data)
      }
    })

    child.on('close', code => {
      resolve(code || 0)
    })

    child.on('error', err => {
      reject(err)
    })
  })
}

export async function commandExists(command: string): Promise<boolean> {
  try {
    const result = await executeWithExitCode(`command -v ${command}`)
    return result.exitCode === 0
  } catch {
    return false
  }
}

export async function sendNotification(
  title: string,
  message: string,
): Promise<void> {
  try {
    if (await commandExists('notify-send')) {
      await execute(
        `notify-send "${title}" "${message}" --urgency=critical --expire-time=12000`,
      )
    }
  } catch {}
}
