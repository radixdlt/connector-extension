module.exports = {
  branches: [
    'main',
    {
      name: 'develop',
      channel: 'alpha',
      prerelease: 'alpha',
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
            release: 'patch',
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
      '@semantic-release/exec',
      {
        prepareCmd: './update-version-name.sh ${nextRelease.version}',
        publishCmd: 'npm run build:cd',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          {
            path: 'production--radix-connector.zip',
            label: 'production--radix-connector.zip',
          },
          {
            path: 'production--radix-connector-with-dev-tools.zip',
            label: 'production--radix-connector-with-dev-tools.zip',
          },
          {
            path: 'rcnet--radix-connector.zip',
            label: 'rcnet--radix-connector.zip',
          },
          {
            path: 'rcnet--radix-connector-with-dev-tools.zip',
            label: 'rcnet--radix-connector-with-dev-tools.zip',
          },
          {
            path: 'development--radix-connector.zip',
            label: 'development--radix-connector.zip',
          },
          {
            path: 'development--radix-connector-with-dev-tools.zip',
            label: 'development--radix-connector-with-dev-tools.zip',
          },
        ],
      },
    ],
    [
      'semantic-release-chrome',
      {
        extensionId: '${EXTENSION_ID}',
        asset: 'radix-connector.zip',
        target: '${TARGET}',
      },
    ],
  ],
}