#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function getVersion() {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

function getHash() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  if (process.env.COMMIT_HASH) return process.env.COMMIT_HASH;
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

function getBuildDate() {
  return new Date().toISOString();
}

const version = getVersion();
const hash = getHash();
const buildDate = getBuildDate();

// All args after script name are forwarded to ng build (e.g. --configuration=..., --base-href ...)
const extraArgs = process.argv.slice(2);

const defines = [
  '--define',
  `import.meta.env.APP_VERSION=${JSON.stringify(version)}`,
  '--define',
  `import.meta.env.APP_COMMIT_HASH=${JSON.stringify(hash)}`,
  '--define',
  `import.meta.env.APP_BUILD_DATE=${JSON.stringify(buildDate)}`,
];

const ngArgs = ['build', ...defines, ...extraArgs];

const result = spawnSync('bunx', ['ng', ...ngArgs], { stdio: 'inherit' });
process.exit(result.status ?? 1);
