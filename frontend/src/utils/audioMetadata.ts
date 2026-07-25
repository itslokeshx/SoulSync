export interface AudioMetadataOptions {
  title?: string;
  artist?: string;
  album?: string;
  albumArtUrl?: string;
}

function encodeUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function createDataAtom(typeIndicator: number, data: Uint8Array): Uint8Array {
  const size = 16 + data.length;
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  view.setUint32(0, size);
  buf.set([100, 97, 116, 97], 4);
  view.setUint32(8, typeIndicator);
  view.setUint32(12, 0);
  buf.set(data, 16);
  return buf;
}

function createItemAtom(fourcc: string, typeIndicator: number, data: Uint8Array): Uint8Array {
  const dataAtom = createDataAtom(typeIndicator, data);
  const size = 8 + dataAtom.length;
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  view.setUint32(0, size);
  for (let i = 0; i < 4; i++) {
    buf[4 + i] = fourcc.charCodeAt(i);
  }
  buf.set(dataAtom, 8);
  return buf;
}

function buildIlstAtom(items: { fourcc: string; type: number; data: Uint8Array }[]): Uint8Array {
  const itemBuffers = items.map((it) => createItemAtom(it.fourcc, it.type, it.data));
  const totalItemsSize = itemBuffers.reduce((sum, b) => sum + b.length, 0);
  const size = 8 + totalItemsSize;
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  view.setUint32(0, size);
  buf.set([105, 108, 115, 116], 4);
  let offset = 8;
  for (const item of itemBuffers) {
    buf.set(item, offset);
    offset += item.length;
  }
  return buf;
}

function buildMetaAtom(ilstAtom: Uint8Array): Uint8Array {
  const hdlr = new Uint8Array([
    0, 0, 0, 33, 104, 100, 108, 114,
    0, 0, 0, 0,
    0, 0, 0, 0,
    109, 100, 105, 114,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0,
  ]);
  const size = 12 + hdlr.length + ilstAtom.length;
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  view.setUint32(0, size);
  buf.set([109, 101, 116, 97], 4);
  view.setUint32(8, 0);
  buf.set(hdlr, 12);
  buf.set(ilstAtom, 12 + hdlr.length);
  return buf;
}

function buildUdtaAtom(metaAtom: Uint8Array): Uint8Array {
  const size = 8 + metaAtom.length;
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  view.setUint32(0, size);
  buf.set([117, 100, 116, 97], 4);
  buf.set(metaAtom, 8);
  return buf;
}

function embedMp4Metadata(audioBuffer: Uint8Array, items: { fourcc: string; type: number; data: Uint8Array }[]): Uint8Array {
  if (items.length === 0) return audioBuffer;

  const ilst = buildIlstAtom(items);
  const meta = buildMetaAtom(ilst);
  const udta = buildUdtaAtom(meta);

  const view = new DataView(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength);
  let moovOffset = -1;
  let moovSize = 0;
  let offset = 0;

  while (offset + 8 <= audioBuffer.length) {
    const sz = view.getUint32(offset);
    const tp = String.fromCharCode(...audioBuffer.subarray(offset + 4, offset + 8));
    if (tp === "moov") {
      moovOffset = offset;
      moovSize = sz;
      break;
    }
    if (sz <= 1) break;
    offset += sz;
  }

  if (moovOffset === -1) return audioBuffer;

  let existingUdtaStart = -1;
  let existingUdtaSize = 0;
  let p = moovOffset + 8;
  const moovEndOriginal = moovOffset + moovSize;

  while (p + 8 <= moovEndOriginal) {
    const sz = view.getUint32(p);
    const tp = String.fromCharCode(...audioBuffer.subarray(p + 4, p + 8));
    if (tp === "udta") {
      existingUdtaStart = p;
      existingUdtaSize = sz;
      break;
    }
    if (sz <= 1) break;
    p += sz;
  }

  let baseBuffer: Uint8Array;
  let baseMoovSize: number;

  if (existingUdtaStart !== -1) {
    baseMoovSize = moovSize - existingUdtaSize;
    baseBuffer = new Uint8Array(audioBuffer.length - existingUdtaSize);
    baseBuffer.set(audioBuffer.subarray(0, existingUdtaStart), 0);
    baseBuffer.set(audioBuffer.subarray(existingUdtaStart + existingUdtaSize), existingUdtaStart);
  } else {
    baseBuffer = audioBuffer;
    baseMoovSize = moovSize;
  }

  const shift = udta.length;
  const insertPos = moovOffset + baseMoovSize;
  const finalBuf = new Uint8Array(baseBuffer.length + shift);

  finalBuf.set(baseBuffer.subarray(0, insertPos), 0);
  finalBuf.set(udta, insertPos);
  finalBuf.set(baseBuffer.subarray(insertPos), insertPos + shift);

  const finalView = new DataView(finalBuf.buffer);
  finalView.setUint32(moovOffset, baseMoovSize + shift);

  const netShift = finalBuf.length - audioBuffer.length;
  if (netShift !== 0) {
    let scanPtr = moovOffset + 8;
    const scanEnd = moovOffset + baseMoovSize + shift;
    while (scanPtr + 8 <= scanEnd) {
      const tag = String.fromCharCode(...finalBuf.subarray(scanPtr + 4, scanPtr + 8));
      if (tag === "stco") {
        const stcoSize = finalView.getUint32(scanPtr);
        const count = finalView.getUint32(scanPtr + 12);
        let entryPtr = scanPtr + 16;
        for (let c = 0; c < count; c++) {
          const oldOff = finalView.getUint32(entryPtr);
          if (oldOff >= insertPos) {
            finalView.setUint32(entryPtr, oldOff + netShift);
          }
          entryPtr += 4;
        }
        scanPtr += stcoSize;
      } else if (tag === "co64") {
        const co64Size = finalView.getUint32(scanPtr);
        const count = finalView.getUint32(scanPtr + 12);
        let entryPtr = scanPtr + 16;
        for (let c = 0; c < count; c++) {
          const oldOffHigh = finalView.getUint32(entryPtr);
          const oldOffLow = finalView.getUint32(entryPtr + 4);
          const oldOff = BigInt(oldOffHigh) * BigInt(4294967296) + BigInt(oldOffLow);
          if (oldOff >= BigInt(insertPos)) {
            const newOff = oldOff + BigInt(netShift);
            finalView.setUint32(entryPtr, Number(newOff >> BigInt(32)));
            finalView.setUint32(entryPtr + 4, Number(newOff & BigInt(4294967295)));
          }
          entryPtr += 8;
        }
        scanPtr += co64Size;
      } else {
        scanPtr++;
      }
    }
  }

  return finalBuf;
}

function createId3Frame(id: string, payload: Uint8Array): Uint8Array {
  const size = payload.length;
  const buf = new Uint8Array(10 + size);
  for (let i = 0; i < 4; i++) {
    buf[i] = id.charCodeAt(i);
  }
  const view = new DataView(buf.buffer);
  view.setUint32(4, size);
  buf[8] = 0;
  buf[9] = 0;
  buf.set(payload, 10);
  return buf;
}

function createTextFrame(id: string, text: string): Uint8Array {
  const textBytes = encodeUtf8(text);
  const payload = new Uint8Array(1 + textBytes.length);
  payload[0] = 3;
  payload.set(textBytes, 1);
  return createId3Frame(id, payload);
}

function createApicFrame(imgBytes: Uint8Array, mime: string): Uint8Array {
  const mimeBytes = encodeUtf8(mime);
  const headerLen = 1 + mimeBytes.length + 1 + 1 + 1;
  const payload = new Uint8Array(headerLen + imgBytes.length);
  let p = 0;
  payload[p++] = 3;
  payload.set(mimeBytes, p);
  p += mimeBytes.length;
  payload[p++] = 0;
  payload[p++] = 3;
  payload[p++] = 0;
  payload.set(imgBytes, p);
  return createId3Frame("APIC", payload);
}

function embedMp3Metadata(audioBuffer: Uint8Array, options: AudioMetadataOptions, imgBytes: Uint8Array, imgMime: string): Uint8Array {
  const frames: Uint8Array[] = [];
  if (options.title) frames.push(createTextFrame("TIT2", options.title));
  if (options.artist) frames.push(createTextFrame("TPE1", options.artist));
  if (options.album) frames.push(createTextFrame("TALB", options.album));
  if (imgBytes.length > 0) frames.push(createApicFrame(imgBytes, imgMime));

  if (frames.length === 0) return audioBuffer;

  const framesTotalSize = frames.reduce((s, f) => s + f.length, 0);
  const headerSize = 10 + framesTotalSize;

  const header = new Uint8Array(10);
  header[0] = 0x49;
  header[1] = 0x44;
  header[2] = 0x33;
  header[3] = 3;
  header[4] = 0;
  header[5] = 0;

  const s = framesTotalSize;
  header[6] = (s >> 21) & 0x7f;
  header[7] = (s >> 14) & 0x7f;
  header[8] = (s >> 7) & 0x7f;
  header[9] = s & 0x7f;

  let existingTagSize = 0;
  if (audioBuffer.length >= 10 && audioBuffer[0] === 0x49 && audioBuffer[1] === 0x44 && audioBuffer[2] === 0x33) {
    const sz = ((audioBuffer[6] & 0x7f) << 21) | ((audioBuffer[7] & 0x7f) << 14) | ((audioBuffer[8] & 0x7f) << 7) | (audioBuffer[9] & 0x7f);
    existingTagSize = 10 + sz;
  }

  const audioPayload = audioBuffer.subarray(existingTagSize);
  const result = new Uint8Array(headerSize + audioPayload.length);
  result.set(header, 0);
  let offset = 10;
  for (const frame of frames) {
    result.set(frame, offset);
    offset += frame.length;
  }
  result.set(audioPayload, headerSize);
  return result;
}

export async function embedAudioMetadata(audioBuffer: Uint8Array, options: AudioMetadataOptions): Promise<Uint8Array> {
  if (!audioBuffer || audioBuffer.length === 0) return audioBuffer;

  let imgBytes = new Uint8Array(0);
  let imgType = 13;
  let imgMime = "image/jpeg";

  if (options.albumArtUrl) {
    try {
      const res = await fetch(options.albumArtUrl);
      if (res.ok) {
        imgBytes = new Uint8Array(await res.arrayBuffer());
        if (imgBytes.length >= 8 && imgBytes[0] === 0x89 && imgBytes[1] === 0x50 && imgBytes[2] === 0x4e && imgBytes[3] === 0x47) {
          imgType = 14;
          imgMime = "image/png";
        }
      }
    } catch {
      imgBytes = new Uint8Array(0);
    }
  }

  const isMp4 = audioBuffer.length >= 8 && String.fromCharCode(...audioBuffer.subarray(4, 8)) === "ftyp";

  if (isMp4) {
    const items: { fourcc: string; type: number; data: Uint8Array }[] = [];
    if (options.title && options.title.trim()) {
      items.push({ fourcc: "\xa9nam", type: 1, data: encodeUtf8(options.title.trim()) });
    }
    if (options.artist && options.artist.trim()) {
      items.push({ fourcc: "\xa9ART", type: 1, data: encodeUtf8(options.artist.trim()) });
    }
    if (options.album && options.album.trim()) {
      items.push({ fourcc: "\xa9alb", type: 1, data: encodeUtf8(options.album.trim()) });
    }
    if (imgBytes.length > 0) {
      items.push({ fourcc: "covr", type: imgType, data: imgBytes });
    }
    try {
      return embedMp4Metadata(audioBuffer, items);
    } catch {
      return audioBuffer;
    }
  } else {
    try {
      return embedMp3Metadata(audioBuffer, options, imgBytes, imgMime);
    } catch {
      return audioBuffer;
    }
  }
}

export function readAudioMetadata(buf: Uint8Array): { title?: string; artist?: string; album?: string; albumArtUrl?: string } {
  const result: { title?: string; artist?: string; album?: string; albumArtUrl?: string } = {};
  if (!buf || buf.length === 0) return result;

  const isMp4 = buf.length >= 8 && String.fromCharCode(...buf.subarray(4, 8)) === "ftyp";

  if (isMp4) {
    try {
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      let p = 0;
      let ilstOffset = -1;
      let ilstSize = 0;

      while (p + 8 <= buf.length) {
        const tag = String.fromCharCode(...buf.subarray(p + 4, p + 8));
        if (tag === "ilst") {
          ilstOffset = p;
          ilstSize = view.getUint32(p);
          break;
        }
        p++;
      }

      if (ilstOffset !== -1) {
        let itemPtr = ilstOffset + 8;
        const ilstEnd = ilstOffset + ilstSize;

        while (itemPtr + 8 <= ilstEnd) {
          const itemSize = view.getUint32(itemPtr);
          const itemTag = String.fromCharCode(...buf.subarray(itemPtr + 4, itemPtr + 8));
          if (itemSize <= 8) break;

          let dataPtr = itemPtr + 8;
          const itemEnd = itemPtr + itemSize;

          while (dataPtr + 16 <= itemEnd) {
            const dataSize = view.getUint32(dataPtr);
            const dataTag = String.fromCharCode(...buf.subarray(dataPtr + 4, dataPtr + 8));

            if (dataTag === "data") {
              const typeInd = view.getUint32(dataPtr + 8);
              const payload = buf.subarray(dataPtr + 16, dataPtr + dataSize);

              if (itemTag === "\xa9nam") {
                result.title = new TextDecoder().decode(payload);
              } else if (itemTag === "\xa9ART") {
                result.artist = new TextDecoder().decode(payload);
              } else if (itemTag === "\xa9alb") {
                result.album = new TextDecoder().decode(payload);
              } else if (itemTag === "covr") {
                const mime = typeInd === 14 ? "image/png" : "image/jpeg";
                if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
                  const blob = new Blob([payload.buffer as ArrayBuffer], { type: mime });
                  result.albumArtUrl = URL.createObjectURL(blob);
                } else {
                  let binary = "";
                  for (let i = 0; i < payload.length; i++) {
                    binary += String.fromCharCode(payload[i]);
                  }
                  result.albumArtUrl = `data:${mime};base64,${btoa(binary)}`;
                }
              }
            }
            dataPtr += dataSize;
          }
          itemPtr += itemSize;
        }
      }
    } catch {}
  } else if (buf.length >= 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    try {
      const tagSize = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
      let ptr = 10;
      const tagEnd = Math.min(10 + tagSize, buf.length);
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

      while (ptr + 10 <= tagEnd) {
        const frameId = String.fromCharCode(...buf.subarray(ptr, ptr + 4));
        const frameSize = view.getUint32(ptr + 4);
        if (frameSize <= 0 || ptr + 10 + frameSize > tagEnd) break;

        const payload = buf.subarray(ptr + 10, ptr + 10 + frameSize);
        if (frameId === "TIT2") {
          result.title = new TextDecoder().decode(payload.subarray(1));
        } else if (frameId === "TPE1") {
          result.artist = new TextDecoder().decode(payload.subarray(1));
        } else if (frameId === "TALB") {
          result.album = new TextDecoder().decode(payload.subarray(1));
        } else if (frameId === "APIC") {
          let mimeEnd = 1;
          while (mimeEnd < payload.length && payload[mimeEnd] !== 0) mimeEnd++;
          const mime = new TextDecoder().decode(payload.subarray(1, mimeEnd)) || "image/jpeg";
          const imgStart = mimeEnd + 3;
          if (imgStart < payload.length) {
            const imgData = payload.subarray(imgStart);
            if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
              const blob = new Blob([imgData.buffer as ArrayBuffer], { type: mime });
              result.albumArtUrl = URL.createObjectURL(blob);
            } else {
              let binary = "";
              for (let i = 0; i < imgData.length; i++) {
                binary += String.fromCharCode(imgData[i]);
              }
              result.albumArtUrl = `data:${mime};base64,${btoa(binary)}`;
            }
          }
        }
        ptr += 10 + frameSize;
      }
    } catch {}
  }

  return result;
}
