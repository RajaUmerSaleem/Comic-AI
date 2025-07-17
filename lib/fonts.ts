// This interface should match the structure of your font objects returned by the API.
export interface Font {
  id: number
  name: string
  file_url: string // Assuming the API provides a complete URL for the font file
}

/**
 * Dynamically loads a font into the browser's document.fonts registry.
 * @param font The font object containing name and file_url.
 */
export async function loadFont(font: Font) {
  const { name, file_url } = font
  if (!file_url) {
    console.warn(`Font "${name}" has no file_url, skipping loading.`)
    return
  }

  // Check if the font is already loaded to prevent redundant loading
  const fontAlreadyLoaded = document.fonts.check(`10px "${name}"`)
  if (!fontAlreadyLoaded) {
    const fontFace = new FontFace(name, `url(${file_url})`)
    try {
      await fontFace.load()
      document.fonts.add(fontFace)
      console.log(`Font "${name}" loaded successfully from ${file_url}.`)
    } catch (e) {
      console.error(`Font "${name}" failed to load from ${file_url}`, e)
    }
  }
}
