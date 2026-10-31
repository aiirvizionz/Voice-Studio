import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const code = fs.readFileSync(new URL('../src/lib/voice.ts', import.meta.url), 'utf8');
const transpiled = ts.transpileModule(code, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
const exports = {};
vm.runInNewContext(transpiled, {exports});

test('genera un prompt con las características vocales', () => {
  const prompt = exports.createVoicePrompt(exports.defaultStyle);
  assert.match(prompt, /mexicano contemporáneo/);
  assert.match(prompt, /voz adulta original/);
  assert.match(prompt, /conversacional/);
});

test('no permite rangos de slider fuera de la lista', () => {
  const prompt = exports.createVoicePrompt({...exports.defaultStyle, pitch: -10, pace: 999});
  assert.match(prompt, /Registro muy grave/);
  assert.match(prompt, /ritmo muy rápido/);
});
