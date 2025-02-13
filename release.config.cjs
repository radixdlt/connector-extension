module.exports = {
  branches: [
    'main',
    {
      name: 'develop',
      channel: 'alpha',
      prerelease: 'alpha',
    },
    {
      name: 'release/([a-z0-9-]+)',
      channel: '${name.replace(/^release\\//g, "")}',
      prerelease: '${name.replace(/^release\\//g, "")}',
    },
  ],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          {
            type: 'refactor',
            release: 'patch',
          },
          {
            type: 'major',
            release: 'major',
          },
          {
            type: 'docs',
            scope: 'README',
            release: 'patch',
          },
          {
            type: 'test',
            release: 'patch',
          },
          {
            type: 'style',
            release: 'patch',
          },
          {
            type: 'perf',
            release: 'patch',
          },
          {
            type: 'ci',
            release: false,
          },
          {
            type: 'build',
            release: 'patch',
          },
          {
            type: 'chore',
            release: 'patch',
          },
          {
            type: 'code',
            release: 'patch',
          },
          {
            type: 'no-release',
            release: false,
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
        preset: 'conventionalcommits',
        parserOpts: {
          noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES'],
        },
        writerOpts: {
          commitsSort: ['subject', 'scope'],
        },
        presetConfig: {
          types: [
            {
              type: 'feat',
              section: ':sparkles: Features',
              hidden: false,
            },
            {
              type: 'fix',
              section: ':bug: Fixes',
              hidden: false,
            },
            {
              type: 'major',
              hidden: true,
            },
            {
              type: 'docs',
              section: ':memo: Documentation',
              hidden: false,
            },
            {
              type: 'style',
              section: ':barber: Code-style',
              hidden: false,
            },
            {
              type: 'refactor',
              section: ':zap: Refactor',
              hidden: false,
            },
            {
              type: 'perf',
              section: ':fast_forward: Performance',
              hidden: false,
            },
            {
              type: 'test',
              section: ':white_check_mark: Tests',
              hidden: false,
            },
            {
              type: 'ci',
              section: ':repeat: CI',
              hidden: false,
            },
            {
              type: 'chore',
              section: ':repeat: Chore',
              hidden: false,
            },
            {
              type: 'build',
              section: ':wrench: Build',
              hidden: false,
            },
          ],
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
      'semantic-release-replace-plugin',
      {
        replacements: [
          {
            files: ['src/version.ts'],
            from: "export const __VERSION__ = '1.0.0'",
            to: "export const __VERSION__ = '${nextRelease.version}'",
            countMatches: true,
          },
        ],
      },
    ],
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'npm run build:cd',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          {
            path: 'radix-connector.zip',
            label: 'Chrome Extension',
          },
          {
            path: 'radix-connector-with-dev-tools.zip',
            label: 'Chrome Extension (Dev Tools included)',
          },
        ],
      },
    ],
    [
      '@owlcode/semantic-release-chrome',
      {
        extensionId: '${EXTENSION_ID}',
        asset: 'radix-connector_v${nextRelease.version}.zip',
        target: '${TARGET}',
        distFolder: 'radix-connector',
      },
    ],
    [
      '@saithodev/semantic-release-backmerge',
      {
        backmergeBranches: [{ from: 'main', to: 'develop' }],
        backmergeStrategy: 'merge',
        clearWorkspace: true,
        fastForwardMode: 'ff',
      },
    ],
  ],
}
