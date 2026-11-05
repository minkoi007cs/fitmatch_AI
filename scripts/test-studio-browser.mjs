/** Runs inside the isolated auth fixture. Geometry is synthetic, never an AI avatar. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
function mesh(color) {
  const positions = Buffer.from(new Float32Array([-.4, 0, 0, .4, 0, 0, 0, 1.8, 0]).buffer);
  const doc = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }], materials: [{ doubleSided: true, pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: 0, roughnessFactor: .9 } }], buffers: [{ byteLength: positions.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.length }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-.4,0,0], max: [.4,1.8,0] }] };
  const raw = Buffer.from(JSON.stringify(doc)); const json = Buffer.alloc(Math.ceil(raw.length/4)*4, 32); raw.copy(json);
  const out = Buffer.alloc(28 + json.length + positions.length);
  out.writeUInt32LE(0x46546c67,0); out.writeUInt32LE(2,4); out.writeUInt32LE(out.length,8);
  out.writeUInt32LE(json.length,12); out.writeUInt32LE(0x4e4f534a,16); json.copy(out,20);
  out.writeUInt32LE(positions.length,20+json.length); out.writeUInt32LE(0x004e4942,24+json.length); positions.copy(out,28+json.length); return out;
}
export async function testStudio(base, jar) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([...jar].map(([name,value]) => ({ name, value, url: base })));
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/studio');
    await page.getByRole('heading', { name: 'Phòng thử đồ của bạn.' }).waitFor();
    await mkdir('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/studio-desktop-empty.png', fullPage: true });
    const input = page.locator('input[type=file]');
    await input.setInputFiles([{ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') }]);
    await page.getByRole('alert').filter({ hasText: 'manifest.json' }).waitFor();
    const manifest = { version: 1, avatar: { id: 'synthetic-avatar', name: 'Synthetic geometry test', file: 'avatar.glb' }, garments: [{ id: 'tee', name: 'Synthetic tee', file: 'tee.glb', category: 't-shirt', avatarId: 'synthetic-avatar' }] };
    await input.setInputFiles([
      { name: 'manifest.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(manifest)) },
      { name: 'avatar.glb', mimeType: 'model/gltf-binary', buffer: mesh([.8,.8,.8,1]) },
      { name: 'tee.glb', mimeType: 'model/gltf-binary', buffer: mesh([.8,.3,.1,1]) },
    ]);
    await page.locator('canvas').waitFor();
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Trước')?.disabled);
    const tee = page.getByRole('button', { name: /Synthetic tee/ });
    await tee.click(); assert.equal(await tee.getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Ghi nhớ look A' }).click();
    await page.getByRole('button', { name: 'Chỉ xem avatar' }).click();
    await page.getByRole('button', { name: 'So sánh A ↔ B' }).click();
    assert.equal(await tee.getAttribute('aria-pressed'), 'true');
    for (const name of ['Bên','Sau','Đặt lại']) await page.getByRole('button', { name, exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: 'test-results/studio-synthetic-mesh.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole('button', { name: 'Đóng bộ 3D' }).click();
    await page.getByRole('heading', { name: 'Bắt đầu với avatar của bạn' }).waitFor();
    assert.equal(await page.locator('canvas').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: Studio browser import validation, real WebGL load, cached selection, compare, views, responsive layout and cleanup (synthetic geometry only)');
  } finally { await browser.close(); }
}
