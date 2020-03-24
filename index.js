const api = require('./api')
const config = require('./config')

const { port } = config
api.listen(port, () => {
  console.log(`The Fifth World API is listening on port ${port}`)
})
