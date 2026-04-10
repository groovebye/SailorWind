const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";

export function nanoid(size = 8): string {
  let id = "";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  for (let i = 0; i < size; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}
