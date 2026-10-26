import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarBloqueioLogin, registrarFalhaLogin, limparTentativasLogin } from '../src/services/login-rate-limiter';

test('bloqueia após cinco falhas para a combinação IP/usuário', () => {
  const ip = 'test-ip-user-limit';
  const usuario = 'admin-test';
  const agora = Date.now();
  for (let i = 0; i < 5; i++) registrarFalhaLogin(ip, usuario, agora + i);
  assert.ok(consultarBloqueioLogin(ip, usuario, agora + 5) > 0);
});

test('limita password spraying no IP mesmo quando os nomes de usuário mudam', () => {
  const ip = 'test-ip-spraying';
  const agora = Date.now();
  for (let i = 0; i < 100; i++) registrarFalhaLogin(ip, `usuario-${i}`, agora + i);
  assert.ok(consultarBloqueioLogin(ip, 'outro-usuario', agora + 31) > 0);
});

test('as tentativas expiram após a janela de 15 minutos', () => {
  const ip = 'test-ip-ttl';
  const usuario = 'usuario-ttl';
  const agora = Date.now();
  for (let i = 0; i < 5; i++) registrarFalhaLogin(ip, usuario, agora + i);
  assert.equal(consultarBloqueioLogin(ip, usuario, agora + 16 * 60 * 1000), 0);
});

test('limpar tentativas remove o bloqueio individual após login válido', () => {
  const ip = 'test-ip-clear';
  const usuario = 'usuario-clear';
  const agora = Date.now();
  for (let i = 0; i < 5; i++) registrarFalhaLogin(ip, usuario, agora + i);
  limparTentativasLogin(ip, usuario);
  assert.equal(consultarBloqueioLogin(ip, usuario, agora + 5), 0);
  assert.equal(consultarBloqueioLogin(ip, 'outro-usuario', agora + 5), 0);
});
