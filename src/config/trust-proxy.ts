import { isIP } from 'node:net';

export type TrustProxyValue = false | number | string[];

export function parseTrustProxy(value?: string): TrustProxyValue {
  const trustProxy = value?.trim().toLowerCase();
  if (!trustProxy || trustProxy === 'false') return false;
  if (trustProxy === 'true') return 1;
  if (/^\d+$/.test(trustProxy)) return Number(trustProxy);

  const proxies = trustProxy.split(',').map(item => item.trim()).filter(Boolean);
  const validos = proxies.every(proxy => {
    const [ip, prefix] = proxy.split('/');
    const versao = isIP(ip);
    if (!versao) return false;
    if (prefix === undefined) return true;
    const bits = Number(prefix);
    return Number.isInteger(bits) && bits >= 0 && bits <= (versao === 4 ? 32 : 128);
  });
  if (!validos || proxies.length === 0) {
    throw new Error('TRUST_PROXY inválido. Use false, true, número de saltos ou IP/CIDR de proxy confiável.');
  }
  return proxies;
}
