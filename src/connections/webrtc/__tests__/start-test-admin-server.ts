const mockrtc = require('mockrtc')
mockrtc
  .getAdminServer()
  .start()
  .then(() => {
    console.log('Test admin server started')
  })
  .catch((error: any) => {
    console.error(error)
    process.exit(1)
  })
