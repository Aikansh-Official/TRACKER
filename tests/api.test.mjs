import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../src/api.js', import.meta.url), 'utf8'))
  .replace("import.meta.env.VITE_API_URL", "undefined");
const { api, clearApiCache } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('caches authenticated reads and returns independent objects', async () => {
  clearApiCache();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({count:1}); };
  await api('/cached', {token:'a'});
  const cached = await api('/cached', {token:'a'});
  cached.count = 99;
  assert.equal((await api('/cached', {token:'a'})).count, 1);
  assert.equal(calls, 1);
  await api('/cached', {token:'a',cache:false});
  assert.equal(calls, 2);
});
test('cache expires after 20 seconds', async () => {
  clearApiCache();
  const originalNow = Date.now;
  let now = originalNow(), calls = 0;
  Date.now = () => now;
  try {
    globalThis.fetch = async () => { calls++; return Response.json({}); };
    await api('/expiry', {token:'a'});
    now += 20001;
    await api('/expiry', {token:'a'});
    assert.equal(calls, 2);
  } finally { Date.now = originalNow; }
});
test('writes invalidate cached responses', async () => {
  clearApiCache();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}); };
  await api('/dashboard', {token:'a'});
  await api('/progress', {token:'a',method:'PATCH',body:{completed:true}});
  await api('/dashboard', {token:'a'});
  assert.equal(calls, 3);
});
test('a read started before a write cannot repopulate the cache', async () => {
  clearApiCache();
  let release;
  globalThis.fetch = () => new Promise(resolve => { release = resolve; });
  const oldRead = api('/race', {token:'a'});
  globalThis.fetch = async () => Response.json({fresh:true});
  await api('/save', {token:'a',method:'POST'});
  release(Response.json({fresh:false}));
  await oldRead;
  assert.deepEqual(await api('/race', {token:'a'}), {fresh:true});
});

test('shares concurrent GETs, but does not cache completed reads', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ ok:true }); };
  await Promise.all([api('/same'), api('/same')]);
  assert.equal(calls, 1);
  await api('/same');
  assert.equal(calls, 2);
});
test('keeps different users and all writes separate', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ ok:true }); };
  await Promise.all([api('/same',{token:'a'}), api('/same',{token:'b'})]);
  await Promise.all([api('/save',{method:'POST',body:{}}),api('/save',{method:'POST',body:{}})]);
  assert.equal(calls, 4);
});
test('failed requests can be retried', async () => {
  globalThis.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(api('/retry'), /Check your internet/);
  globalThis.fetch = async () => Response.json({ ok:true });
  assert.deepEqual(await api('/retry'), {ok:true});
});
test('handles HTML errors, malformed success, and no-content responses', async () => {
  globalThis.fetch = async () => new Response('<html>Unavailable</html>',{status:503});
  await assert.rejects(api('/html'), error => error.status === 503);
  globalThis.fetch = async () => new Response('<html>Oops</html>');
  await assert.rejects(api('/bad-json'), /unexpected response/);
  globalThis.fetch = async () => new Response(null,{status:204});
  assert.equal(await api('/empty'), null);
});
