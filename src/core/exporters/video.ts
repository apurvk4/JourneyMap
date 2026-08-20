export interface VideoExportOptions {
  width: number
  height: number
  speed: number
  range?: { start:number, end:number }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function exportVideoPlaceholder(_opts: VideoExportOptions): Promise<Blob> {
  // Placeholder: implement with WebCodecs / ffmpeg.wasm
  return Promise.reject(new Error('Video export not implemented. Use this API to integrate WebCodecs or ffmpeg.wasm.'))
}
