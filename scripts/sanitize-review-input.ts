export const isSensitiveFilePath = (filePath: string): boolean => {
  const fileName = filePath.toLowerCase().split('/').at(-1) ?? '';

  return (
    fileName === '.env' ||
    fileName.startsWith('.env.') ||
    fileName === '.npmrc' ||
    fileName === '.pypirc' ||
    fileName === '.netrc' ||
    (fileName.includes('credential') && fileName.endsWith('.json')) ||
    (fileName.includes('private') && fileName.includes('key')) ||
    /^(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)$/.test(fileName) ||
    /\.(?:key|pem|p12|pfx|jks|keystore)$/.test(fileName)
  );
};

const secretAssignmentPattern =
  /(^|[^A-Za-z0-9_])(["']?(?:api[_-]?key|token|_?auth[_-]?token|secret|password|passwd|private[_-]?key|client[_-]?secret)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;}\n]+)/gim;
const knownTokenPattern =
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g;
const bearerTokenPattern = /(Bearer\s+)[A-Za-z0-9._~+/-]{12,}={0,2}/gi;
const privateKeyBlockPattern =
  /-----BEGIN [^-\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\n]*PRIVATE KEY-----/gi;

export const scrubSensitiveText = (value: string): string =>
  value
    .replace(privateKeyBlockPattern, '[AI_REVIEW_REDACTED_PRIVATE_KEY_BLOCK]')
    .replace(bearerTokenPattern, '$1[AI_REVIEW_REDACTED_TOKEN]')
    .replace(knownTokenPattern, '[AI_REVIEW_REDACTED_TOKEN]')
    .replace(secretAssignmentPattern, '$1$2[AI_REVIEW_REDACTED_SECRET_VALUE]');

const isDiffMetadata = (line: string): boolean =>
  /^(?:old mode |new mode |deleted file mode |new file mode |similarity index |rename from |rename to |index |--- |\+\+\+ |@@|\\ No newline)/.test(
    line,
  );

export const redactSensitiveDiff = (diff: string): string => {
  const output: string[] = [];
  let sensitiveSection = false;
  let markerWritten = false;
  let privateKeyBlock = false;

  const writeMarker = (): void => {
    if (!markerWritten) {
      output.push('+[AI_REVIEW_REDACTED_SENSITIVE_FILE_CONTENT]');
      markerWritten = true;
    }
  };

  for (const line of diff.split(/\r?\n/)) {
    const headerMatch = /^diff --git a\/(.+) b\/(.+)$/.exec(line);

    if (headerMatch) {
      if (sensitiveSection) {
        writeMarker();
      }

      sensitiveSection = isSensitiveFilePath(headerMatch[1]) || isSensitiveFilePath(headerMatch[2]);
      markerWritten = false;
      privateKeyBlock = false;
      output.push(line);
      continue;
    }

    if (!sensitiveSection) {
      if (/-----BEGIN [^-\n]*PRIVATE KEY-----/i.test(line)) {
        const prefix = /^[+\- ]/.test(line) ? line[0] : '';
        output.push(`${prefix}[AI_REVIEW_REDACTED_PRIVATE_KEY_BLOCK]`);
        privateKeyBlock = true;
        continue;
      }

      if (privateKeyBlock) {
        if (/-----END [^-\n]*PRIVATE KEY-----/i.test(line)) {
          privateKeyBlock = false;
        }

        continue;
      }

      output.push(scrubSensitiveText(line));
      continue;
    }

    if (isDiffMetadata(line)) {
      output.push(line);

      if (line.startsWith('@@')) {
        writeMarker();
      }

      continue;
    }

    writeMarker();
  }

  if (sensitiveSection) {
    writeMarker();
  }

  return output.join('\n');
};
