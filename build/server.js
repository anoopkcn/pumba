const express = require('express')
var path = require('path');

const app = express()
const port = 3000

app.use(express.static(path.join(__dirname, 'resources')));
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'test')));
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => console.log(`pumba listening to port http://localhost:${port}/`))