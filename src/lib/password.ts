function getRandomIndex(max: number): number {
  const arr = new Uint32Array(1);
  // Available in browsers, Node 18+, and Cloudflare Workers
  crypto.getRandomValues(arr);
  // Unbiased modulo: discard values that would skew distribution
  const limit = Math.floor(0xffffffff / max) * max;
  let v = arr[0];
  while (v >= limit) {
    crypto.getRandomValues(arr);
    v = arr[0];
  }
  return v % max;
}

export function generatePassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_=+";
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[getRandomIndex(set.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = getRandomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
