import assert from 'node:assert/strict';
import { createBrowserBetterCommerceClient } from '../dist/browser.js';
import { createServerBetterCommerceClient } from '../dist/server.js';

const browserRequests = [];
const browserClient = createBrowserBetterCommerceClient({
  baseUrl: 'https://shop.example.test',
  fetch: captureInto(browserRequests),
});

await browserClient.GET('/api/v1/auth/me');
assert.equal(browserRequests.length, 1);
assert.equal(browserRequests[0].credentials, 'include');
assert.equal(browserRequests[0].headers.has('cookie'), false);

const forwardedHeaders = new Headers({
  cookie: 'bc.sid=opaque-request-scoped-value',
  'x-request-id': 'request-1',
});
const serverRequests = [];
const serverClient = createServerBetterCommerceClient({
  baseUrl: 'http://api:3000',
  headers: forwardedHeaders,
  fetch: captureInto(serverRequests),
});

forwardedHeaders.set('cookie', 'mutated-after-client-construction');
await serverClient.GET('/api/v1/auth/me');

assert.equal(serverRequests.length, 1);
assert.equal(serverRequests[0].credentials, 'omit');
assert.equal(
  serverRequests[0].headers.get('cookie'),
  'bc.sid=opaque-request-scoped-value',
);
assert.equal(serverRequests[0].headers.get('x-request-id'), 'request-1');

assert.throws(
  () => createServerBetterCommerceClient({ baseUrl: '/api' }),
  /absolute HTTP\(S\) URL/,
);
assert.throws(
  () =>
    createServerBetterCommerceClient({
      baseUrl: 'https://user:password@api.example.test',
    }),
  /without credentials, query, or fragment/,
);

function captureInto(requests) {
  return async (request) => {
    requests.push(request);
    return new Response('{}', {
      headers: { 'content-type': 'application/json' },
      status: 200,
    });
  };
}
