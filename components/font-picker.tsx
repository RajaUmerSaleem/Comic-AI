"use client"

import { useMemo, useState, useEffect } from "react"
import Select, { type SingleValue } from "react-select"
import { type Font, loadFont } from "@/lib/fonts" // Import Font interface and loadFont utility

type FontOption = {
  label: string
  value: string // The font name
  fontId: number // The font ID
}

export type FontPickerProps = {
  options: Font[] // Array of Font objects from your API
  value?: number | null // The selected font ID
  onChange: (fontId: number | null) => void // Callback with the selected font ID
}

export function FontPicker({ options, value, onChange }: FontPickerProps) {
  const [isFontsLoading, setIsFontsLoading] = useState(false)
  const [isFontsReady, setIsFontsReady] = useState(false)

  // Map Font objects to react-select options
  const fontOptions: FontOption[] = useMemo(
    () => options.map((font) => ({ label: font.name, value: font.name, fontId: font.id })),
    [options],
  )

  // Find the currently selected option based on the font ID
  const selectedOption = useMemo(() => {
    if (value === null || value === undefined) return null
    const selectedFont = options.find((font) => font.id === value)
    return selectedFont ? { label: selectedFont.name, value: selectedFont.name, fontId: selectedFont.id } : null
  }, [value, options])

  // Function to load all fonts when the picker is focused
  const uploadFonts = async () => {
    if (!isFontsReady && !isFontsLoading) {
      setIsFontsLoading(true)
      const loadAllFontsPromises = options.map((font) => loadFont(font))
      await Promise.all(loadAllFontsPromises)
      setIsFontsLoading(false)
      setIsFontsReady(true)
    }
  }

  // Load fonts initially if options are already available (e.g., from SSR or initial fetch)
  useEffect(() => {
    if (options.length > 0 && !isFontsReady && !isFontsLoading) {
      uploadFonts()
    }
  }, [options, isFontsReady, isFontsLoading]) // Added dependencies

  return (
    <Select<FontOption>
      value={selectedOption}
      onChange={(option: SingleValue<FontOption>) => onChange(option ? option.fontId : null)}
      options={fontOptions}
      isLoading={isFontsLoading}
      onFocus={uploadFonts}
      // Custom styles to apply the font family to options and the control
      styles={{
        option: (style, { data }) => ({
          ...style,
          fontFamily: data.value, // data.value is the font name
        }),
        control: (style, cp) => ({
          ...style,
          fontFamily: cp.getValue()?.[0]?.value, // cp.getValue() returns an array of selected options
        }),
      }}
    />
  )
}
