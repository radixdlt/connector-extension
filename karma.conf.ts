// @ts-nocheck
const CONTINUOUS = process.env.CONTINUOUS_TEST === 'true'
const HEADFUL = process.env.HEADFUL_TEST === 'true'

import * as ChildProcess from 'child_process'

import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'

if (CONTINUOUS) {
  const adminProc = ChildProcess.spawn(
    './node_modules/.bin/node-dev',
    ['--notify=false', './test/start-test-admin-server.ts'],
    { stdio: 'inherit' }
  )

  process.on('exit', () => adminProc.kill())

  adminProc.on('exit', (code) => {
    process.exit(code ?? 0) // Signalled = null = we killed it
  })
} else {
  require('./src/connections/webrtc/__tests__/start-test-admin-server')
}

module.exports = function (config: any) {
  config.set({
    client: { mocha: { timeout: 10000 } },
    frameworks: ['mocha', 'chai'],
    files: ['src/**/*.spec.ts'],
    preprocessors: {
      'src/**/*.ts': ['esbuild'],
      './src/connections/webrtc/__tests__/*.ts': ['esbuild'],
    },
    esbuild: {
      format: 'esm',
      target: 'esnext',
      loader: { '.*': 'file', '.data': 'binary' },
      plugins: [
        NodeModulesPolyfillPlugin(),
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true,
        }),
      ],
    },
    plugins: [
      'karma-chrome-launcher',
      'karma-chai',
      'karma-mocha',
      'karma-mocha-reporter',
      'karma-esbuild',
    ],

    reporters: ['mocha'],
    mochaReporter: {
      showDiff: true,
    },

    port: 9876,
    logLevel: config.LOG_INFO,

    browsers: HEADFUL
      ? ['ChromeWithFakeMedia']
      : ['ChromeHeadlessWithFakeMedia'],

    customLaunchers: {
      ChromeHeadlessWithFakeMedia: {
        base: 'ChromeHeadless',
        flags: [
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
        ],
      },
      ChromeWithFakeMedia: {
        base: 'Chrome',
        flags: [
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
        ],
      },
    },

    autoWatch: CONTINUOUS,
    singleRun: !CONTINUOUS,
    concurrency: Infinity,
  })
}
