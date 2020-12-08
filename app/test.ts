const http = require('http')

const data = JSON.stringify({
    MessageBody: 'Buy the milk'
})

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/message',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}

const req = http.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`)

  res.on('data', (d) => {
    process.stdout.write(d)
  })
})

req.on('error', (error) => {
  console.error(error)
})

req.write(data)
req.end()