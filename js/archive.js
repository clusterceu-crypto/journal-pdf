(function (root) {
  'use strict';

  const SIG_EOCD = 0x06054b50;
  const SIG_CENTRAL = 0x02014b50;
  const SIG_LOCAL = 0x04034b50;
  const DEFAULTS = Object.freeze({
    maxEntries: 500,
    maxTotalUncompressed: 500 * 1024 * 1024,
    maxEntryUncompressed: 50 * 1024 * 1024,
    maxCompressionRatio: 250,
    maxArchiveBytes: 200 * 1024 * 1024,
  });

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function decodeName(bytes, utf8Flag) {
    if (utf8Flag) return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    // Google Drive exports in this project use ASCII #Uxxxx names. UTF-8 is a safer fallback
    // than silently reinterpreting bytes as platform-specific code pages.
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  function validatePath(name) {
    const raw = String(name || '').replace(/\\/g, '/');
    if (!raw || raw.includes('\0') || raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) {
      throw new Error(`Небезпечний шлях усередині ZIP: ${name}`);
    }
    const parts = raw.split('/').filter((p) => p !== '' && p !== '.');
    if (parts.some((p) => p === '..')) throw new Error(`Небезпечний шлях усередині ZIP: ${name}`);
    return parts.join('/');
  }

  function findEocd(view) {
    const min = Math.max(0, view.byteLength - 0xffff - 22);
    for (let p = view.byteLength - 22; p >= min; p -= 1) {
      if (view.getUint32(p, true) === SIG_EOCD) return p;
    }
    throw new Error('ZIP пошкоджений: не знайдено центральний каталог.');
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== 'function') {
      throw new Error('Цей браузер не підтримує локальне розпакування DEFLATE (DecompressionStream).');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  class ZipReader {
    constructor(arrayBuffer, options = {}) {
      this.buffer = arrayBuffer instanceof ArrayBuffer ? arrayBuffer : arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength);
      this.bytes = new Uint8Array(this.buffer);
      this.view = new DataView(this.buffer);
      this.options = { ...DEFAULTS, ...options };
      if (this.bytes.byteLength > this.options.maxArchiveBytes) throw new Error('ZIP-файл перевищує дозволений розмір.');
      this.entries = this._parseCentralDirectory();
    }

    _parseCentralDirectory() {
      const eocd = findEocd(this.view);
      const disk = this.view.getUint16(eocd + 4, true);
      const cdDisk = this.view.getUint16(eocd + 6, true);
      const entriesDisk = this.view.getUint16(eocd + 8, true);
      const entriesTotal = this.view.getUint16(eocd + 10, true);
      const cdSize = this.view.getUint32(eocd + 12, true);
      const cdOffset = this.view.getUint32(eocd + 16, true);
      if (disk !== 0 || cdDisk !== 0 || entriesDisk !== entriesTotal) throw new Error('Багатотомні ZIP-архіви не підтримуються.');
      if (entriesTotal === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new Error('ZIP64 не підтримується для журналів.');
      if (entriesTotal > this.options.maxEntries) throw new Error(`Архів містить понад ${this.options.maxEntries} файлів.`);
      if (cdOffset + cdSize > this.view.byteLength) throw new Error('ZIP пошкоджений: центральний каталог виходить за межі файлу.');

      const entries = [];
      let p = cdOffset;
      let totalUncompressed = 0;
      for (let i = 0; i < entriesTotal; i += 1) {
        if (p + 46 > this.view.byteLength || this.view.getUint32(p, true) !== SIG_CENTRAL) throw new Error('ZIP пошкоджений: некоректний запис центрального каталогу.');
        const flags = this.view.getUint16(p + 8, true);
        const method = this.view.getUint16(p + 10, true);
        const crc = this.view.getUint32(p + 16, true) >>> 0;
        const compressedSize = this.view.getUint32(p + 20, true);
        const uncompressedSize = this.view.getUint32(p + 24, true);
        const nameLen = this.view.getUint16(p + 28, true);
        const extraLen = this.view.getUint16(p + 30, true);
        const commentLen = this.view.getUint16(p + 32, true);
        const externalAttrs = this.view.getUint32(p + 38, true);
        const localOffset = this.view.getUint32(p + 42, true);
        if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error('ZIP64-записи не підтримуються.');
        const next = p + 46 + nameLen + extraLen + commentLen;
        if (next > this.view.byteLength) throw new Error('ZIP пошкоджений: обрізане ім’я файлу.');
        const nameBytes = this.bytes.subarray(p + 46, p + 46 + nameLen);
        const originalName = decodeName(nameBytes, Boolean(flags & 0x800));
        const name = validatePath(originalName);
        const isDirectory = originalName.endsWith('/');
        const unixMode = (externalAttrs >>> 16) & 0xffff;
        const isSymlink = (unixMode & 0xf000) === 0xa000;
        if (isSymlink) throw new Error(`ZIP містить символічне посилання, яке не дозволено: ${name}`);
        if (flags & 0x1) throw new Error(`Зашифрований ZIP-запис не підтримується: ${name}`);
        if (!isDirectory && method !== 0 && method !== 8) throw new Error(`Непідтримуваний метод стиснення ZIP (${method}): ${name}`);
        if (!isDirectory && uncompressedSize > this.options.maxEntryUncompressed) throw new Error(`Файл ${name} перевищує дозволений розмір після розпакування.`);
        if (!isDirectory && compressedSize > 0 && uncompressedSize > 1024 * 1024 && (uncompressedSize / compressedSize) > this.options.maxCompressionRatio) {
          throw new Error(`Підозрілий коефіцієнт стиснення ZIP (можлива ZIP-bomb): ${name}`);
        }
        totalUncompressed += isDirectory ? 0 : uncompressedSize;
        if (totalUncompressed > this.options.maxTotalUncompressed) throw new Error('Сумарний розпакований розмір ZIP перевищує дозволений ліміт.');
        entries.push({ name, originalName, isDirectory, flags, method, crc, compressedSize, uncompressedSize, localOffset });
        p = next;
      }
      return entries;
    }

    listFiles() {
      return this.entries.filter((e) => !e.isDirectory);
    }

    async readEntry(entryOrName) {
      const entry = typeof entryOrName === 'string' ? this.entries.find((e) => e.name === entryOrName) : entryOrName;
      if (!entry || entry.isDirectory) throw new Error('ZIP-запис не знайдено.');
      const p = entry.localOffset;
      if (p + 30 > this.view.byteLength || this.view.getUint32(p, true) !== SIG_LOCAL) throw new Error(`ZIP пошкоджений: локальний заголовок ${entry.name}.`);
      const nameLen = this.view.getUint16(p + 26, true);
      const extraLen = this.view.getUint16(p + 28, true);
      const start = p + 30 + nameLen + extraLen;
      const end = start + entry.compressedSize;
      if (end > this.view.byteLength) throw new Error(`ZIP пошкоджений: дані ${entry.name} обрізані.`);
      const compressed = this.bytes.subarray(start, end);
      let output;
      if (entry.method === 0) output = new Uint8Array(compressed);
      else output = await inflateRaw(compressed);
      if (output.byteLength !== entry.uncompressedSize) throw new Error(`ZIP пошкоджений: невірний розмір ${entry.name}.`);
      if (crc32(output) !== entry.crc) throw new Error(`ZIP пошкоджений: CRC-помилка ${entry.name}.`);
      return output;
    }
  }

  function decodeGoogleUnicodeName(text) {
    return String(text || '').replace(/#U([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  root.JournalArchive = { ZipReader, decodeGoogleUnicodeName, DEFAULTS, crc32, validatePath };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.JournalArchive;
})(typeof globalThis !== 'undefined' ? globalThis : self);
