import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function isSafePath(filePath) {
  const relativePath = path.relative(rootDir, filePath);
  return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function parseBody(rawBody, contentType = '') {
  if (contentType.includes('application/json')) {
    return JSON.parse(rawBody || '{}');
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(rawBody));
  }

  return {};
}

function normalizeInput(value) {
  return String(value || '').trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const portValue = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: portValue,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

async function handleContactRequest(request, response) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
    if (chunks.reduce((total, part) => total + part.length, 0) > 1_000_000) {
      sendJson(response, 413, { error: 'Request body is too large.' });
      return;
    }
  }

  let payload;

  try {
    payload = parseBody(Buffer.concat(chunks).toString('utf8'), request.headers['content-type']);
  } catch {
    sendJson(response, 400, { error: 'Invalid form submission.' });
    return;
  }

  const name = normalizeInput(payload.name);
  const email = normalizeInput(payload.email);
  const message = normalizeInput(payload.message);
  const recipient = normalizeInput(process.env.CONTACT_TO || 'nguyenanh.mywork@gmail.com');
  const sender = normalizeInput(process.env.CONTACT_FROM || process.env.SMTP_USER || 'no-reply@localhost');

  if (!name || !email || !message) {
    sendJson(response, 400, { error: 'Please fill in your name, email, and message.' });
    return;
  }

  const transporter = buildTransporter();

  if (!transporter) {
    sendJson(response, 500, {
      error: 'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in your environment.',
    });
    return;
  }

  try {
    await transporter.sendMail({
      from: sender,
      to: recipient,
      replyTo: email,
      subject: `New contact form message from ${name}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        '',
        message,
      ].join('\n'),
      html: `
        <h2>New contact form message</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `,
    });

    sendJson(response, 200, { message: 'Thanks. Your message has been sent to my email inbox.' });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Unable to send email at the moment.',
    });
  }
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'POST' && requestUrl.pathname === '/api/contact') {
    await handleContactRequest(request, response);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD, POST' });
    response.end('Method not allowed');
    return;
  }

  let pathname = requestUrl.pathname;
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.normalize(path.join(rootDir, pathname));

  if (!isSafePath(filePath)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error('Not a file');
    }

    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': contentType });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    const fileContent = await fs.readFile(filePath);
    response.end(fileContent);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});