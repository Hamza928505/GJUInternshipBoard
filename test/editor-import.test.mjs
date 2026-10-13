import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Exercise the page's actual import gate without adding a browser dependency.
const source = fs.readFileSync(new URL('../js/editor.js', import.meta.url), 'utf8');
const start = source.indexOf('async function importJson(file)');
const end = source.indexOf('// ---------------------------------------------------------------------------', start);
const importer = source.slice(start, end);

async function check(payload) {
  let error, prompted = false;
  const context = vm.createContext({
    dialog: {},
    alertError: (title, message) => { error = { title, message }; },
    Swal: { fire: () => { prompted = true; return { isConfirmed: false }; } },
  });
  vm.runInContext(importer, context);
  await context.importJson({ name: 'profile.json', text: async () => payload });
  return { error, prompted };
}

test('accepts version 1 exports and requests confirmation before replacing a draft', async () => {
  const result = await check(JSON.stringify({ version: 1, profile: { firstName: 'Test', skills: ['Python'] },
    certificates: [{ imageKey: 'scan' }], images: { scan: { type: 'image/png', dataUrl: 'data:image/png;base64,AA==' } } }));
  assert.equal(result.error, undefined);
  assert.equal(result.prompted, true);
});

test('rejects malformed profiles and remote attachment URLs before changing data', async () => {
  for (const payload of ['{bad', '{}', '{"profile":"bad"}', '{"profile":{},"certificates":[null]}',
    '{"profile":{},"images":{"scan":{"dataUrl":"https://example.com/private"}}}']) {
    const result = await check(payload);
    assert.ok(result.error, payload);
    assert.equal(result.prompted, false);
  }
});
