/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync } = require('fs')
const { join } = require('path')

module.exports = {
  branches: ['main'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          {
            type: 'docs',
            release: 'patch',
          },
          {
            type: 'refactor',
            release: 'patch',
          },
          {
            type: 'style',
            release: 'patch',
          },
          {
            type: 'chore',
            release: 'patch',
          },
          {
            type: 'perf',
            release: 'patch',
          },
        ],
        parserOpts: {
          noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES'],
        },
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        writerOpts: {
          commitPartial: readFileSync(join(__dirname, 'commit.hbs'), 'utf-8'),
        },
      },
    ],
    [
      '@semantic-release/npm',
      {
        npmPublish: false,
      },
    ],
    [
      '@semantic-release/exec',
      {
        publishCmd: './build.sh',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          {
            path: 'radix-connect.zip',
            label: 'radix-connect',
          },
          {
            path: 'radix-connect-dev.zip',
            label: 'radix-connect-dev.zip',
          },
        ],
      },
    ],
  ],
}
