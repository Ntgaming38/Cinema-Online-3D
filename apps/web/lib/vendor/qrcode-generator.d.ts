// Type declarations for the vendored QR Code Generator for JavaScript
// (Kazuhiko Arase, MIT license — see qrcode-generator.js in this folder).
interface QrCodeInstance {
  addData(text: string): void;
  make(): void;
  createSvgTag(options: { cellSize: number; margin: number; scalable?: boolean }): string;
}

declare const qrcode: (typeNumber: number, errorCorrectionLevel: string) => QrCodeInstance;

export default qrcode;
