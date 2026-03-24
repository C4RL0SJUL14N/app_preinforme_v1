import http from 'node:http';
import handler from '../api/index.js';

const server = http.createServer(async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message || 'Error interno del servidor' }));
  }
});

const port = 3000;
server.listen(port, () => {
  console.log(`API local disponible en http://localhost:${port}`);
});
