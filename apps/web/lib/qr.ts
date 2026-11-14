// QR code rendering for room invites. Uses the vendored QR Code Generator
// (Kazuhiko Arase, MIT) instead of an npm dependency, so the install graph
// — which is tight on the Botkeep Free disk quota — stays untouched.
import qrcode from "./vendor/qrcode-generator.js";

/** Returns an inline SVG string encoding `text` (medium error correction). */
export function qrSvgTag(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 5, margin: 10, scalable: true });
}
