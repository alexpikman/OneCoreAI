import crypto from 'crypto';
import fs from 'fs';

export interface VerificationCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export interface VerificationReport {
  verified: boolean;
  checkedAt: string;
  checks: VerificationCheck[];
  sha256?: string;
}

function report(checks: VerificationCheck[], sha256?: string): VerificationReport {
  return {
    verified: checks.every((check) => check.passed),
    checkedAt: new Date().toISOString(),
    checks,
    ...(sha256 ? { sha256 } : {}),
  };
}

export function verifyFileContent(filePath: string, expectedContent: string): VerificationReport {
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return report([{ id: 'regular-file', passed: false, detail: 'Destination is not a regular file.' }]);
    }

    const actualContent = fs.readFileSync(filePath);
    const expected = Buffer.from(expectedContent, 'utf-8');
    const sha256 = crypto.createHash('sha256').update(actualContent).digest('hex');
    const contentMatches = actualContent.equals(expected);
    return report([
      { id: 'regular-file', passed: true, detail: 'Destination is a regular file.' },
      {
        id: 'content-match',
        passed: contentMatches,
        detail: contentMatches ? 'Persisted bytes match the proposed content.' : 'Persisted bytes differ from the proposed content.',
      },
    ], sha256);
  } catch (error) {
    return report([{
      id: 'file-readable',
      passed: false,
      detail: error instanceof Error ? error.message : 'Unable to inspect the destination file.',
    }]);
  }
}

export function verifyFileRemoved(filePath: string): VerificationReport {
  try {
    fs.lstatSync(filePath);
    return report([{ id: 'file-removed', passed: false, detail: 'The destination still exists after deletion.' }]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return report([{ id: 'file-removed', passed: true, detail: 'The destination is absent.' }]);
    }
    return report([{
      id: 'file-removed',
      passed: false,
      detail: error instanceof Error ? error.message : 'Unable to verify destination removal.',
    }]);
  }
}

export function verifyCommandResult(input: {
  exitCode: number;
  timedOut: boolean;
  cancelled: boolean;
}): VerificationReport {
  return report([
    {
      id: 'process-exit',
      passed: input.exitCode === 0,
      detail: input.exitCode === 0 ? 'Process exited with code 0.' : `Process exited with code ${input.exitCode}.`,
    },
    {
      id: 'not-timed-out',
      passed: !input.timedOut,
      detail: input.timedOut ? 'Process exceeded its execution timeout.' : 'Process completed within its timeout.',
    },
    {
      id: 'not-cancelled',
      passed: !input.cancelled,
      detail: input.cancelled ? 'Process was cancelled before successful completion.' : 'Process was not cancelled.',
    },
  ]);
}
