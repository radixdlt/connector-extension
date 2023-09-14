[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# Extension

To get you all ready

`npm install`

then build

* version with dev tools `npm run build:dev`
* version without dev tools `npm run build`

you can optionally start hot module reload by

`npm start`

## Known Development Issues

### Hot Module Reload `npm start`

Pages are initialized in a different way when working in HMR mode. You may encounter issues inside dev tools or ledger pages. When working particularly with chrome messaging it's safer to always rebuild using `npm run build:*` commands. 

### Chrome Extensions Jest Mocks

Currently, [`jest-chrome` does not support `jest` newer than 27](https://github.com/extend-chrome/jest-chrome/issues/19). Appropriate override has been set inside `package.json` in order to make installation pass smoothly
