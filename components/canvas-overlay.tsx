"use client"

import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { hexToRgbArray, rgbArrayToHex } from "@/lib/utilsss" // Import from utils
import { apiRequest } from "@/lib/api"
import { useAuth } from "./auth-provider"
import { toast } from "@/hooks/use-toast"

interface SpeechBubble {
  bubble_id: number
  bubble_no: number
  coordinates: number[] // [x1, y1, x2, y2]
  mask_coordinates: number[][] // [[x, y], [x, y], ...]
  text: string
  translation: string | null
  font_size?: number | null
  font_color?: number[] | null
  font_id?: number | null
}

interface CanvasOverlayProps {
  imageUrl: string
  speechBubbles: SpeechBubble[]
  pageId: number
  onBubbleClick?: (bubble: SpeechBubble) => void
  selectedBubbleId?: number | null
  isAddingBubble?: boolean
  onPolygonSelect?: (coordinates: number[][]) => void
  onBubbleTextUpdate?: (bubbleId: number, text: string, translation: string) => void
  onCanvasDoubleClick?: (coordinates: number[][]) => void
  onBubbleUpdate?: (pageId: number, bubbleId: number, updates: Partial<SpeechBubble>) => void
  onBubbleGeometrySave?: (pageId: number, bubble: SpeechBubble) => void // Updated type definition
  isExporting?: boolean
  fonts?: Array<{ id: number; name: string; file_url?: string }>
}

export function CanvasOverlay({
  imageUrl,
  speechBubbles,
  pageId,
  onBubbleClick,
  selectedBubbleId,
  isAddingBubble = false,
  onPolygonSelect,
  onBubbleTextUpdate,
  onCanvasDoubleClick,
  onBubbleUpdate,
  onBubbleGeometrySave,
  isExporting = false,
  fonts = [],
}: CanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [polygonPoints, setPolygonPoints] = useState<number[][]>([])
  const [editingBubble, setEditingBubble] = useState<number | null>(null)
  const [editText, setEditText] = useState("")
  const [editTranslation, setEditTranslation] = useState("")
  const [editBounds, setEditBounds] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  })
  const [draggedBubble, setDraggedBubble] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDraggingBubble, setIsDraggingBubble] = useState(false)
  const [isDraggingVertex, setIsDraggingVertex] = useState(false)
  const { token } = useAuth()
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null)
  const [initialMousePos, setInitialMousePos] = useState<{
    x: number
    y: number
  } | null>(null)
  const [initialVertexPos, setInitialVertexPos] = useState<{
    x: number
    y: number
  } | null>(null)

  // New states for temporary box
  const [tempBoxCoordinates, setTempBoxCoordinates] = useState<number[][] | null>(null)
  const [isResizingTempBox, setIsResizingTempBox] = useState(false)
  const [resizingTempBoxVertexIndex, setResizingTempBoxVertexIndex] = useState<number | null>(null)
  const [isDraggingTempBox, setIsDraggingTempBox] = useState(false)
  const [tempBoxDragOffset, setTempBoxDragOffset] = useState({ x: 0, y: 0 })
  const [tempBoxText, setTempBoxText] = useState("")
  const [isEditingTempBoxText, setIsEditingTempBoxText] = useState(false)
  const [tempBoxEditBounds, setTempBoxEditBounds] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  })
  const [initialTempBoxMousePos, setInitialTempBoxMousePos] = useState<{
    x: number
    y: number
  } | null>(null)
  const [initialTempBoxVertexPos, setInitialTempBoxVertexPos] = useState<{
    x: number
    y: number
  } | null>(null)
  const [initialTempBoxPolygon, setInitialTempBoxPolygon] = useState<number[][] | null>(null)

  // New states for temporary box font properties
  const [tempBoxFontSize, setTempBoxFontSize] = useState<number>(16)
  const [tempBoxFontColor, setTempBoxFontColor] = useState<number[]>([0, 0, 0]) // Default black
  const [tempBoxFontId, setTempBoxFontId] = useState<number>(fonts[0]?.id || 1) // Default to first font or 1

  // Loading state for API call
  const [isSavingTempBox, setIsSavingTempBox] = useState(false)

  useEffect(() => {
    if (fonts.length > 0 && tempBoxFontId === 1) {
      // Only set if default and fonts are loaded
      setTempBoxFontId(fonts[0].id)
    }
  }, [fonts, tempBoxFontId])

  // API function to create speech bubble
  const createSpeechBubble = async (bubbleData: {
    page_id: number
    bubble_no: number
    coordinates_xyxy: number[]
    mask_coordinates_xyxy: number[][]
    text?: string
    translation?: string
    font_id?: number
    text_coordinates_xyxy?: number[]
  }) => {
    try {
      const result = await apiRequest(
        "/v1/pages/bubble",
        {
          method: "POST",
          body: JSON.stringify(bubbleData),
        },
        token ?? undefined,
      )

      return result
    } catch (error) {
      console.error("Error creating speech bubble:", error)
      throw error
    }
  }

  // API function to update speech bubble
  const updateSpeechBubble = async (
    bubbleId: number,
    updateData: {
      coordinates_xyxy?: number[]
      mask_coordinates_xyxy?: number[][]
      text?: string
      translation?: string
      font_id?: number
      text_coordinates_xyxy?: number[]
    },
  ) => {
    try {
      const result = await apiRequest(
        `/v1/pages/bubble/${bubbleId}`,
        {
          method: "PUT",
          body: JSON.stringify(updateData),
        },
        token ?? undefined,
      )

      return result
    } catch (error) {
      console.error("Error updating speech bubble:", error)
      throw error
    }
  }

  const isPointInPolygon = (point: [number, number], polygon: number[][]): boolean => {
    const [x, y] = point
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i]
      const [xj, yj] = polygon[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside
      }
    }
    return inside
  }

  const drawPolygonWithText = (
    ctx: CanvasRenderingContext2D,
    bubble: SpeechBubble,
    scaleX: number,
    scaleY: number,
    hideUI = false,
  ) => {
    if (!bubble.mask_coordinates || bubble.mask_coordinates.length === 0) {
      return
    }

    const isSelected = selectedBubbleId === bubble.bubble_id
    const isEditing = editingBubble === bubble.bubble_id
    const isDraggedBubble = draggedBubble === bubble.bubble_id

    // Calculate polygon bounds for bounding box
    let minX = Number.POSITIVE_INFINITY,
      maxX = Number.NEGATIVE_INFINITY,
      minY = Number.POSITIVE_INFINITY,
      maxY = Number.NEGATIVE_INFINITY

    for (const point of bubble.mask_coordinates) {
      minX = Math.min(minX, point[0] * scaleX)
      maxX = Math.max(maxX, point[0] * scaleX)
      minY = Math.min(minY, point[1] * scaleY)
      maxY = Math.max(maxY, point[1] * scaleY)
    }

    // Only draw UI elements (borders, bounding boxes) if not exporting
    if (!hideUI) {
      // Draw bounding box around every bubble
      ctx.beginPath()
      ctx.strokeStyle = isSelected ? "#ef4444" : isEditing ? "#10b981" : isDraggedBubble ? "#f59e0b" : "#94a3b8"
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.rect(minX, minY, maxX - minX, maxY - minY)
      ctx.stroke()
      ctx.setLineDash([])

      // Draw polygon outline
      ctx.beginPath()
      ctx.strokeStyle = isSelected ? "#ef4444" : isEditing ? "#10b981" : isDraggedBubble ? "#f59e0b" : "#3b82f6"
      ctx.lineWidth = isSelected ? 3 : isEditing ? 3 : isDraggedBubble ? 3 : 2
      const firstPoint = bubble.mask_coordinates[0]
      ctx.moveTo(firstPoint[0] * scaleX, firstPoint[1] * scaleY)
      for (let i = 1; i < bubble.mask_coordinates.length; i++) {
        const point = bubble.mask_coordinates[i]
        ctx.lineTo(point[0] * scaleX, point[1] * scaleY)
      }
      ctx.closePath()
      ctx.stroke()

      if (isSelected) {
        // Draw resize handles (dots) for selected bubble
        ctx.fillStyle = "#ef4444" // Red for selected handles
        bubble.mask_coordinates.forEach((point) => {
          ctx.beginPath()
          ctx.arc(point[0] * scaleX, point[1] * scaleY, 5, 0, 2 * Math.PI) // Radius 5
          ctx.fill()
        })
      }

      // Fill polygon with semi-transparent background
      ctx.fillStyle = isSelected
        ? "rgba(239, 68, 68, 0.1)"
        : isEditing
          ? "rgba(16, 185, 129, 0.1)"
          : isDraggedBubble
            ? "rgba(245, 158, 11, 0.1)"
            : "rgba(255, 255, 255, 0.9)"
      ctx.fill()
    } else {
      // For export: Fill polygon with white background (no transparency)
      ctx.beginPath()
      const firstPoint = bubble.mask_coordinates[0]
      ctx.moveTo(firstPoint[0] * scaleX, firstPoint[1] * scaleY)
      for (let i = 1; i < bubble.mask_coordinates.length; i++) {
        const point = bubble.mask_coordinates[i]
        ctx.lineTo(point[0] * scaleX, point[1] * scaleY)
      }
      ctx.closePath()
      ctx.fillStyle = "rgba(255, 255, 255, 1)" // Solid white background for export
      ctx.fill()
    }

    // Don't draw text if currently editing this bubble
    if (isEditing && !hideUI) {
      return
    }

    // Draw ONLY translation text (not original text)
    const textToShow = bubble.translation || ""
    if (textToShow && textToShow.trim()) {
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      const maxWidth = (maxX - minX) * 0.8
      const maxHeight = (maxY - minY) * 0.8

      // Set font properties - APPLY FONT CHANGES IMMEDIATELY
      // Changed Math.max(12, ...) to Math.max(1, ...) to allow smaller font sizes if set
      const fontSize = Math.max(1, Math.min((bubble.font_size || 14) * Math.min(scaleX, scaleY), maxHeight / 4))

      // Apply font family if font_id is available - USE FONTS PROP
      let fontFamily = "Arial" // Default fallback
      if (bubble.font_id && fonts) {
        const font = fonts.find((f) => f.id === bubble.font_id)
        if (font) {
          // Use the actual font name from the fonts array
          fontFamily = font.name
        }
      }

      ctx.font = `${fontSize}px ${fontFamily}`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      // Set text color
      if (bubble.font_color && Array.isArray(bubble.font_color)) {
        ctx.fillStyle = `rgb(${bubble.font_color[0]}, ${bubble.font_color[1]}, ${bubble.font_color[2]})`
      } else {
        ctx.fillStyle = "#000000"
      }

      // Word wrap text to fit in polygon bounds - REMOVED TRUNCATION
      const words = textToShow.split(/\s+/)
      const lines: string[] = []
      let currentLine = ""

      for (const word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word
        const metrics = ctx.measureText(testLine)
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      if (currentLine) {
        lines.push(currentLine)
      }

      // Draw all lines without truncation - allow overflow
      const lineHeight = fontSize * 1.2
      const startY = centerY - ((lines.length - 1) * lineHeight) / 2

      lines.forEach((line, index) => {
        const y = startY + index * lineHeight
        ctx.fillText(line, centerX, y)
      })
    }

    // Only draw bubble number if not exporting
    if (!hideUI) {
      ctx.font = `${Math.max(10, 12 * Math.min(scaleX, scaleY))}px Arial`
      ctx.fillStyle = isSelected ? "#ef4444" : isEditing ? "#10b981" : isDraggedBubble ? "#f59e0b" : "#3b82f6"
      ctx.strokeStyle = "white"
      ctx.lineWidth = 2
      const numberText = `#${bubble.bubble_no}`
      const numberX = bubble.coordinates[0] * scaleX
      const numberY = bubble.coordinates[1] * scaleY - 5
      ctx.strokeText(numberText, numberX, numberY)
      ctx.fillText(numberText, numberX, numberY)
    }
  }

  // New function to draw the temporary box
  const drawTempBox = (
    ctx: CanvasRenderingContext2D,
    coordinates: number[][],
    scaleX: number,
    scaleY: number,
    hideUI = false, // Added hideUI parameter
    boxText: string,
    boxFontSize: number,
    boxFontColor: number[],
    boxFontId: number,
    availableFonts: Array<{ id: number; name: string; file_url?: string }>,
  ) => {
    if (!coordinates || coordinates.length === 0) return

    // Only draw UI elements (borders, handles) if not hiding UI
    if (!hideUI) {
      // Draw polygon outline (solid border)
      ctx.beginPath()
      ctx.strokeStyle = "#8b5cf6" // Purple
      ctx.lineWidth = 2
      ctx.setLineDash([]) // Solid line
      const firstPoint = coordinates[0]
      ctx.moveTo(firstPoint[0] * scaleX, firstPoint[1] * scaleY)
      for (let i = 1; i < coordinates.length; i++) {
        const point = coordinates[i]
        ctx.lineTo(point[0] * scaleX, point[1] * scaleY)
      }
      ctx.closePath()
      ctx.stroke()

      // Fill polygon with semi-transparent background
      ctx.fillStyle = "rgba(139, 92, 246, 0.1)" // Light purple fill
      ctx.fill()

      // Draw resize handles (dots) on corners
      ctx.fillStyle = "#8b5cf6" // Purple for handles
      coordinates.forEach((point) => {
        ctx.beginPath()
        ctx.arc(point[0] * scaleX, point[1] * scaleY, 5, 0, 2 * Math.PI) // Radius 5
        ctx.fill()
      })
    } else {
      // For export: Fill polygon with solid white background
      ctx.beginPath()
      const firstPoint = coordinates[0]
      ctx.moveTo(firstPoint[0] * scaleX, firstPoint[1] * scaleY)
      for (let i = 1; i < coordinates.length; i++) {
        const point = coordinates[i]
        ctx.lineTo(point[0] * scaleX, point[1] * scaleY)
      }
      ctx.closePath()
      ctx.fillStyle = "rgba(255, 255, 255, 1)" // Solid white background for export
      ctx.fill()
    }

    // Draw text for temporary box
    // Always draw text for temporary box, even when editing, for real-time preview
    if (boxText && boxText.trim()) {
      // Calculate bounds for text positioning
      let minX = Number.POSITIVE_INFINITY,
        maxX = Number.NEGATIVE_INFINITY,
        minY = Number.POSITIVE_INFINITY,
        maxY = Number.NEGATIVE_INFINITY

      for (const point of coordinates) {
        minX = Math.min(minX, point[0] * scaleX)
        maxX = Math.max(maxX, point[0] * scaleX)
        minY = Math.min(minY, point[1] * scaleY)
        maxY = Math.max(maxY, point[1] * scaleY)
      }

      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      const maxWidth = (maxX - minX) * 0.9
      const maxHeight = (maxY - minY) * 0.9

      // Apply font family if font_id is available
      let fontFamily = "Arial" // Default fallback
      if (boxFontId && availableFonts) {
        const font = availableFonts.find((f) => f.id === boxFontId)
        if (font) {
          fontFamily = font.name
        }
      }

      ctx.font = `${boxFontSize * Math.min(scaleX, scaleY)}px ${fontFamily}` // Apply font size and family
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = `rgb(${boxFontColor[0]}, ${boxFontColor[1]}, ${boxFontColor[2]})` // Apply font color

      const words = boxText.split(/\s+/)
      const lines: string[] = []
      let currentLine = ""

      for (const word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word
        const metrics = ctx.measureText(testLine)
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      if (currentLine) {
        lines.push(currentLine)
      }

      const lineHeight = boxFontSize * Math.min(scaleX, scaleY) * 1.2
      const startY = centerY - ((lines.length - 1) * lineHeight) / 2

      lines.forEach((line, index) => {
        const y = startY + index * lineHeight
        ctx.fillText(line, centerX, y)
      })
    }
  }

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Convert to image coordinates
    const scaleX = image.naturalWidth / canvas.width
    const scaleY = image.naturalHeight / canvas.height
    const imageX = x * scaleX
    const imageY = y * scaleY

    // --- Handle Temporary Box Interactions ---
    if (tempBoxCoordinates) {
      // Check if clicking on a vertex of the temporary box
      for (let i = 0; i < tempBoxCoordinates.length; i++) {
        const [vx, vy] = tempBoxCoordinates[i]
        const distance = Math.sqrt(Math.pow(imageX - vx, 2) + Math.pow(imageY - vy, 2))
        const hitRadius = 10 / Math.min(scaleX, scaleY)
        if (distance < hitRadius) {
          setResizingTempBoxVertexIndex(i)
          setIsResizingTempBox(true)
          setInitialTempBoxMousePos({ x: event.clientX, y: event.clientY })
          setInitialTempBoxVertexPos({ x: vx, y: vy })
          setInitialTempBoxPolygon([...tempBoxCoordinates]) // Store initial polygon for relative movement
          return // Stop further processing
        }
      }

      // Check if clicking inside the temporary box for dragging
      if (isPointInPolygon([imageX, imageY], tempBoxCoordinates)) {
        setIsDraggingTempBox(true)
        // Calculate offset from box center
        const centerX = tempBoxCoordinates.reduce((sum, point) => sum + point[0], 0) / tempBoxCoordinates.length
        const centerY = tempBoxCoordinates.reduce((sum, point) => sum + point[1], 0) / tempBoxCoordinates.length
        setTempBoxDragOffset({
          x: imageX - centerX,
          y: imageY - centerY,
        })
        setInitialTempBoxPolygon([...tempBoxCoordinates]) // Store initial polygon for relative movement
        return // Stop further processing
      }
    }

    // --- Handle Existing Bubble Interactions (only if no temp box interaction) ---
    // Check if we're clicking on a vertex of the selected bubble
    if (selectedBubbleId !== null) {
      const selectedBubble = speechBubbles.find((b) => b.bubble_id === selectedBubbleId)
      if (selectedBubble && selectedBubble.mask_coordinates) {
        for (let i = 0; i < selectedBubble.mask_coordinates.length; i++) {
          const [vx, vy] = selectedBubble.mask_coordinates[i]
          // Check if mouse click is close to this vertex (in image coordinates)
          const distance = Math.sqrt(Math.pow(imageX - vx, 2) + Math.pow(imageY - vy, 2))
          const hitRadius = 10 / Math.min(scaleX, scaleY) // Adjust hit radius based on scale
          if (distance < hitRadius) {
            setDraggingVertexIndex(i)
            setDraggedBubble(selectedBubbleId ?? null)
            setInitialMousePos({ x: event.clientX, y: event.clientY })
            setInitialVertexPos({ x: vx, y: vy })
            setIsDraggingVertex(true) // New state for vertex dragging
            return // Stop further processing, we're dragging a vertex
          }
        }
      }
    }

    // Check if we're clicking on a bubble for dragging
    for (const bubble of speechBubbles) {
      if (bubble.mask_coordinates && bubble.mask_coordinates.length > 0) {
        if (isPointInPolygon([imageX, imageY], bubble.mask_coordinates)) {
          setDraggedBubble(bubble.bubble_id)
          setIsDraggingBubble(true) // New state for bubble dragging
          // Calculate offset from bubble center
          const centerX =
            bubble.mask_coordinates.reduce((sum, point) => sum + point[0], 0) / bubble.mask_coordinates.length
          const centerY =
            bubble.mask_coordinates.reduce((sum, point) => sum + point[1], 0) / bubble.mask_coordinates.length
          setDragOffset({
            x: imageX - centerX,
            y: imageY - centerY,
          })
          return
        }
      }
    }
  }

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return

    const rect = canvas.getBoundingClientRect()
    const currentClientX = event.clientX
    const currentClientY = event.clientY
    const scaleX = image.naturalWidth / canvas.width
    const scaleY = image.naturalHeight / canvas.height

    // --- Handle Temporary Box Interactions ---
    if (
      isResizingTempBox &&
      tempBoxCoordinates &&
      resizingTempBoxVertexIndex !== null &&
      initialTempBoxMousePos &&
      initialTempBoxVertexPos &&
      initialTempBoxPolygon
    ) {
      const dx = currentClientX - initialTempBoxMousePos.x
      const dy = currentClientY - initialTempBoxMousePos.y
      const deltaImageX = dx / (canvas.width / image.naturalWidth)
      const deltaImageY = dy / (canvas.height / image.naturalHeight)

      const newTempBoxCoordinates = [...initialTempBoxPolygon]
      newTempBoxCoordinates[resizingTempBoxVertexIndex] = [
        initialTempBoxVertexPos.x + deltaImageX,
        initialTempBoxVertexPos.y + deltaImageY,
      ]

      setTempBoxCoordinates(newTempBoxCoordinates)
      return
    }

    if (isDraggingTempBox && tempBoxCoordinates && tempBoxDragOffset && initialTempBoxPolygon) {
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const imageX = x * scaleX
      const imageY = y * scaleY

      // Calculate new center position
      const newCenterX = imageX - tempBoxDragOffset.x
      const newCenterY = imageY - tempBoxDragOffset.y

      // Calculate current center of the initial polygon
      const currentInitialCenterX =
        initialTempBoxPolygon.reduce((sum, point) => sum + point[0], 0) / initialTempBoxPolygon.length
      const currentInitialCenterY =
        initialTempBoxPolygon.reduce((sum, point) => sum + point[1], 0) / initialTempBoxPolygon.length

      // Calculate offset to apply to all points
      const offsetX = newCenterX - currentInitialCenterX
      const offsetY = newCenterY - currentInitialCenterY

      const newTempBoxCoordinates = initialTempBoxPolygon.map((point) => [point[0] + offsetX, point[1] + offsetY])

      setTempBoxCoordinates(newTempBoxCoordinates)
      return
    }

    // --- Handle Existing Bubble Interactions ---
    if (isDraggingVertex && draggedBubble && draggingVertexIndex !== null) {
      if (!initialMousePos || !initialVertexPos) return

      const dx = currentClientX - initialMousePos.x
      const dy = currentClientY - initialMousePos.y

      // Convert pixel delta to image coordinate delta
      const deltaImageX = dx / (canvas.width / image.naturalWidth)
      const deltaImageY = dy / (canvas.height / image.naturalHeight)

      const bubble = speechBubbles.find((b) => b.bubble_id === draggedBubble)
      if (!bubble || !bubble.mask_coordinates) return

      const newMaskCoordinates = [...bubble.mask_coordinates]
      newMaskCoordinates[draggingVertexIndex] = [initialVertexPos.x + deltaImageX, initialVertexPos.y + deltaImageY]

      // Recalculate bounding box (coordinates) from new mask_coordinates
      let minX = Number.POSITIVE_INFINITY,
        maxX = Number.NEGATIVE_INFINITY,
        minY = Number.POSITIVE_INFINITY,
        maxY = Number.NEGATIVE_INFINITY

      for (const point of newMaskCoordinates) {
        minX = Math.min(minX, point[0])
        maxX = Math.max(maxX, point[0])
        minY = Math.min(minY, point[1])
        maxY = Math.max(maxY, point[1])
      }

      const newBoundingBox = [minX, minY, maxX, maxY]

      if (onBubbleUpdate) {
        onBubbleUpdate(pageId, draggedBubble, {
          mask_coordinates: newMaskCoordinates,
          coordinates: newBoundingBox,
        })
      }
      return // Stop further processing, we're dragging a vertex
    }

    if (!isDraggingBubble || !draggedBubble) return

    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Convert to image coordinates
    const imageX = x * scaleX
    const imageY = y * scaleY

    // Find the bubble being dragged
    const bubble = speechBubbles.find((b) => b.bubble_id === draggedBubble)
    if (!bubble) return

    // Calculate new center position
    const newCenterX = imageX - dragOffset.x
    const newCenterY = imageY - dragOffset.y

    // Calculate current center
    const currentCenterX =
      bubble.mask_coordinates.reduce((sum, point) => sum + point[0], 0) / bubble.mask_coordinates.length
    const currentCenterY =
      bubble.mask_coordinates.reduce((sum, point) => sum + point[1], 0) / bubble.mask_coordinates.length

    // Calculate offset to apply to all points
    const offsetX = newCenterX - currentCenterX
    const offsetY = newCenterY - currentCenterY

    // Update bubble coordinates locally for real-time preview
    const newMaskCoordinates = bubble.mask_coordinates.map((point) => [point[0] + offsetX, point[1] + offsetY])

    const newBoundingBox = [
      bubble.coordinates[0] + offsetX,
      bubble.coordinates[1] + offsetY,
      bubble.coordinates[2] + offsetX,
      bubble.coordinates[3] + offsetY,
    ]

    // Update local state for real-time preview
    if (onBubbleUpdate) {
      onBubbleUpdate(pageId, draggedBubble, {
        mask_coordinates: newMaskCoordinates,
        coordinates: newBoundingBox,
      })
    }
  }

  const handleCanvasMouseUp = async () => {
    let bubbleToSave: SpeechBubble | undefined = undefined
    let bubbleIdToSave: number | null = null

    if (isDraggingVertex && draggedBubble) {
      bubbleToSave = speechBubbles.find((b) => b.bubble_id === draggedBubble)
      bubbleIdToSave = draggedBubble
    } else if (isDraggingBubble && draggedBubble) {
      bubbleToSave = speechBubbles.find((b) => b.bubble_id === draggedBubble)
      bubbleIdToSave = draggedBubble
    }

    if (bubbleToSave && bubbleIdToSave) {
      try {
        const updateData = {
          coordinates_xyxy: bubbleToSave.coordinates.map((coord) => Number(coord)), // Convert to floats
          mask_coordinates_xyxy: bubbleToSave.mask_coordinates.map((coord) => [
            Math.round(coord[0]),
            Math.round(coord[1]),
          ]), // Convert to integers
        }

        await updateSpeechBubble(bubbleIdToSave, updateData)

        toast({ title: "Success", description: "Bubble position updated successfully" })

        // Only call this if the API update was successful
        if (onBubbleGeometrySave) {
          onBubbleGeometrySave(pageId, bubbleToSave)
        }
      } catch (error) {
        console.error("Failed to update bubble position:", error)
        toast({
          title: "Error",
          description: "Failed to update bubble position. Please try again.",
          variant: "destructive",
        })
      } finally {
        // Reset states for existing bubbles after API call attempt
        setIsDraggingBubble(false)
        setIsDraggingVertex(false)
        setDraggedBubble(null)
        setDragOffset({ x: 0, y: 0 })
        setDraggingVertexIndex(null)
        setInitialMousePos(null)
        setInitialVertexPos(null)
      }
    }

    // Reset states for temporary box (these are independent of bubble drag/resize save)
    setIsResizingTempBox(false)
    setResizingTempBoxVertexIndex(null)
    setIsDraggingTempBox(false)
    setTempBoxDragOffset({ x: 0, y: 0 })
    setInitialTempBoxMousePos(null)
    setInitialTempBoxVertexPos(null)
    setInitialTempBoxPolygon(null)
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Don't handle click if we were dragging/resizing (either bubble or temp box)
    if (isDraggingBubble || isDraggingVertex || isResizingTempBox || isDraggingTempBox) {
      // Reset dragging states if they weren't reset by mouseUp (e.g., mouseUp outside canvas)
      setIsDraggingBubble(false)
      setIsDraggingVertex(false)
      setDraggedBubble(null)
      setDragOffset({ x: 0, y: 0 })
      setDraggingVertexIndex(null)
      setInitialMousePos(null)
      setInitialVertexPos(null)
      setIsResizingTempBox(false)
      setResizingTempBoxVertexIndex(null)
      setIsDraggingTempBox(false)
      setTempBoxDragOffset({ x: 0, y: 0 })
      setInitialTempBoxMousePos(null)
      setInitialTempBoxVertexPos(null)
      setInitialTempBoxPolygon(null)
      return
    }

    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Convert to image coordinates
    const scaleX = image.naturalWidth / canvas.width
    const scaleY = image.naturalHeight / canvas.height
    const imageX = x * scaleX
    const imageY = y * scaleY

    // --- Handle Temporary Box Interactions (Editor Activation/Deactivation) ---
    if (tempBoxCoordinates) {
      const clickedInsideTempBox = isPointInPolygon([imageX, imageY], tempBoxCoordinates)
      if (clickedInsideTempBox) {
        if (event.detail === 2) {
          // Double-clicked inside temp box, activate its editor
          setIsEditingTempBoxText(true)
          // Recalculate bounds for the editor based on current tempBoxCoordinates
          const canvas = canvasRef.current
          const image = imageRef.current
          if (canvas && image) {
            let minX = Number.POSITIVE_INFINITY,
              maxX = Number.NEGATIVE_INFINITY,
              minY = Number.POSITIVE_INFINITY,
              maxY = Number.NEGATIVE_INFINITY
            for (const point of tempBoxCoordinates) {
              minX = Math.min(minX, (point[0] / image.naturalWidth) * canvas.width)
              maxX = Math.max(maxX, (point[0] / image.naturalWidth) * canvas.width)
              minY = Math.min(minY, (point[1] / image.naturalHeight) * canvas.height)
              maxY = Math.max(maxY, (point[1] / image.naturalHeight) * canvas.height)
            }
            setTempBoxEditBounds({
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            })
          }
          return // Consume the event
        } else if (event.detail === 1 && isEditingTempBoxText) {
          // Single-clicked inside temp box while editor is active, dismiss editor
          setIsEditingTempBoxText(false)
          return // Consume the event
        }
        // If single click inside and editor is not active, do nothing (box remains selected/active)
      } else {
        // Clicked outside the temporary box
        // Per user request, DO NOT DISMISS THE BOX.
        // However, if the editor was active, it should dismiss.
        if (isEditingTempBoxText) {
          setIsEditingTempBoxText(false)
        }
        // Do not return here, allow other bubble interactions if applicable
      }
    }

    // --- Handle Polygon Drawing for Actual Bubble Creation ---
    if (isAddingBubble) {
      // Add point to polygon
      const newPoints = [...polygonPoints, [imageX, imageY]]
      setPolygonPoints(newPoints)
      return
    }

    // --- Handle Existing Bubble Selection / Editing ---
    // Check if click is inside any existing bubble
    for (const bubble of speechBubbles) {
      if (bubble.mask_coordinates && bubble.mask_coordinates.length > 0) {
        if (isPointInPolygon([imageX, imageY], bubble.mask_coordinates)) {
          // Double click to edit
          if (event.detail === 2) {
            // Calculate polygon bounds for positioning edit fields
            let minX = Number.POSITIVE_INFINITY,
              maxX = Number.NEGATIVE_INFINITY,
              minY = Number.POSITIVE_INFINITY,
              maxY = Number.NEGATIVE_INFINITY
            for (const point of bubble.mask_coordinates) {
              minX = Math.min(minX, (point[0] / image.naturalWidth) * canvas.width)
              maxX = Math.max(maxX, (point[0] / image.naturalWidth) * canvas.width)
              minY = Math.min(minY, (point[1] / image.naturalHeight) * canvas.height)
              maxY = Math.max(maxY, (point[1] / image.naturalHeight) * canvas.height)
            }

            setEditingBubble(bubble.bubble_id)
            setEditText(bubble.text)
            setEditTranslation(bubble.translation || "")
            setEditBounds({
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            })
          } else {
            onBubbleClick?.(bubble) // Select bubble on single click
          }
          return
        }
      }
    }

    // --- Create New Temporary Box on Double-Click Empty Area ---
    // If a temporary box exists, and we double-click outside it, replace it.
    // If no temporary box exists, create a new one.
    if (event.detail === 2 && !isAddingBubble) {
      // If we reach here, it means it's a double-click on an empty area or on the existing temp box itself.
      // If it's on the existing temp box, the logic above will handle activating its editor.
      // If it's on an empty area, we create a new one.
      if (!tempBoxCoordinates || !isPointInPolygon([imageX, imageY], tempBoxCoordinates)) {
        const size = 100 // Default box size (increased from 50 to 100)
        const defaultPolygon = [
          [imageX - size, imageY - size],
          [imageX + size, imageY - size],
          [imageX + size, imageY + size],
          [imageX - size, imageY + size],
        ]

        setTempBoxCoordinates(defaultPolygon)
        setTempBoxText("") // Initialize with empty text
        setTempBoxFontSize(16) // Reset to default font size
        setTempBoxFontColor([0, 0, 0]) // Reset to default font color (black)
        setTempBoxFontId(fonts[0]?.id || 1) // Reset to default font ID
        setIsEditingTempBoxText(true)

        const canvas = canvasRef.current
        const image = imageRef.current
        if (canvas && image) {
          let minX = Number.POSITIVE_INFINITY,
            maxX = Number.NEGATIVE_INFINITY,
            minY = Number.POSITIVE_INFINITY,
            maxY = Number.NEGATIVE_INFINITY
          for (const point of defaultPolygon) {
            minX = Math.min(minX, (point[0] / image.naturalWidth) * canvas.width)
            maxX = Math.max(maxX, (point[0] / image.naturalWidth) * canvas.width)
            minY = Math.min(minY, (point[1] / image.naturalHeight) * canvas.height)
            maxY = Math.max(maxY, (point[1] / image.naturalHeight) * canvas.height)
          }
          setTempBoxEditBounds({
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          })
        }
        return
      }
    }
  }

  const handleRightClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    if (isAddingBubble && polygonPoints.length >= 3) {
      onPolygonSelect?.(polygonPoints)
      setPolygonPoints([])
      setIsDrawing(false)
    }
  }

  const handleSaveEdit = () => {
    if (editingBubble && onBubbleTextUpdate) {
      onBubbleTextUpdate(editingBubble, editText, editTranslation)
    }
    setEditingBubble(null)
    setEditText("")
    setEditTranslation("")
  }

  const handleCancelEdit = () => {
    setEditingBubble(null)
    setEditText("")
    setEditTranslation("")
  }

  // Handlers for temporary box text editing
  const handleSaveTempBoxEdit = async () => {
    if (!tempBoxCoordinates || !tempBoxText.trim()) {
      // If no text, just close the editor
      setIsEditingTempBoxText(false)
      return
    }

    setIsSavingTempBox(true)

    try {
      // Calculate bounding box from polygon coordinates
      let minX = Number.POSITIVE_INFINITY,
        maxX = Number.NEGATIVE_INFINITY,
        minY = Number.POSITIVE_INFINITY,
        maxY = Number.NEGATIVE_INFINITY

      for (const point of tempBoxCoordinates) {
        minX = Math.min(minX, point[0])
        maxX = Math.max(maxX, point[0])
        minY = Math.min(minY, point[1])
        maxY = Math.max(maxY, point[1])
      }

      const coordinates_xyxy = [minX, minY, maxX, maxY]

      // Generate bubble number (next in sequence)
      const maxBubbleNo = speechBubbles.length > 0 ? Math.max(...speechBubbles.map((b) => b.bubble_no)) : 0
      const bubble_no = maxBubbleNo + 1

      // Prepare API data
      const bubbleData = {
        page_id: pageId,
        bubble_no: bubble_no,
        coordinates_xyxy: coordinates_xyxy,
        mask_coordinates_xyxy: tempBoxCoordinates.map((coord) => [Math.round(coord[0]), Math.round(coord[1])]), // Convert to integers
        text: tempBoxText,
        translation: tempBoxText, // Use same text for translation initially
        font_id: tempBoxFontId,
        text_coordinates_xyxy: coordinates_xyxy, // Use same coordinates for text
      }

      // Call API to create speech bubble
      const result = await createSpeechBubble(bubbleData)

      console.log("Speech bubble created successfully:", result)

      // Show success toast
      toast({ title: "Success", description: "Bubble created successfully" })

      // Create new bubble object for real-time update
      const newBubble: SpeechBubble = {
        bubble_id: result.bubble_id || Date.now(), // Use returned ID or fallback
        bubble_no: bubble_no,
        coordinates: coordinates_xyxy,
        mask_coordinates: tempBoxCoordinates,
        text: tempBoxText,
        translation: tempBoxText,
        font_size: tempBoxFontSize,
        font_color: tempBoxFontColor,
        font_id: tempBoxFontId,
      }

      // Add to speechBubbles array for real-time update
      if (onBubbleUpdate) {
        // If there's a callback to update bubbles, use it
        speechBubbles.push(newBubble)
      }

      // Clear temporary box after successful save
      setTempBoxCoordinates(null)
      setTempBoxText("")
      setTempBoxFontSize(16)
      setTempBoxFontColor([0, 0, 0])
      setTempBoxFontId(fonts[0]?.id || 1)
      setIsEditingTempBoxText(false)
    } catch (error) {
      console.error("Failed to create speech bubble:", error)
      toast({
        title: "Error",
        description: "Failed to save speech bubble. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingTempBox(false)
    }
  }

  const handleCancelTempBoxEdit = () => {
    setTempBoxCoordinates(null) // Discard the temporary box
    setTempBoxText("")
    setTempBoxFontSize(16) // Reset to default
    setTempBoxFontColor([0, 0, 0]) // Reset to default
    setTempBoxFontId(fonts[0]?.id || 1) // Reset to default
    setIsEditingTempBoxText(false)
  }

  const redrawCanvas = (hideUI = false) => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate scale factors
    const scaleX = canvas.width / image.naturalWidth
    const scaleY = canvas.height / image.naturalHeight // Use image.height for correct scaling

    // Draw all speech bubbles
    speechBubbles.forEach((bubble) => {
      drawPolygonWithText(ctx, bubble, scaleX, scaleY, hideUI)
    })

    // Only draw UI elements if not hiding UI
    if (!hideUI) {
      // Draw current polygon being created (for actual bubble creation flow)
      if (isAddingBubble && polygonPoints.length > 0) {
        ctx.beginPath()
        ctx.strokeStyle = "#10b981"
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        const firstPoint = polygonPoints[0]
        ctx.moveTo(
          (firstPoint[0] / image.naturalWidth) * canvas.width,
          (firstPoint[1] / image.naturalHeight) * canvas.height,
        )
        for (let i = 1; i < polygonPoints.length; i++) {
          const point = polygonPoints[i]
          ctx.lineTo((point[0] / image.naturalWidth) * canvas.width, (point[1] / image.naturalHeight) * canvas.height)
        }
        ctx.stroke()
        ctx.setLineDash([])

        // Draw points
        polygonPoints.forEach((point, index) => {
          ctx.beginPath()
          ctx.arc(
            (point[0] / image.naturalWidth) * canvas.width,
            (point[1] / image.naturalHeight) * canvas.height,
            4,
            0,
            2 * Math.PI,
          )
          ctx.fillStyle = index === 0 ? "#ef4444" : "#10b981"
          ctx.fill()
        })
      }

      // Draw temporary box if it exists
      if (tempBoxCoordinates) {
        // Always draw temp box, even when editing text, for real-time preview
        drawTempBox(
          ctx,
          tempBoxCoordinates,
          scaleX,
          scaleY,
          false, // hideUI = false for display
          tempBoxText,
          tempBoxFontSize,
          tempBoxFontColor,
          tempBoxFontId,
          fonts,
        )
      }
    }
  }

  // Function to get canvas for export (without UI elements)
  const getExportCanvas = (): {
    canvas: HTMLCanvasElement
    originalWidth: number
    originalHeight: number
  } | null => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return null

    // Create a new canvas for export
    const exportCanvas = document.createElement("canvas")
    exportCanvas.width = image.naturalWidth // Use original image dimensions for export canvas
    exportCanvas.height = image.naturalHeight
    const ctx = exportCanvas.getContext("2d")
    if (!ctx) return null

    // Clear canvas
    ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height)

    // Draw all speech bubbles WITHOUT UI elements, using 1:1 scale
    speechBubbles.forEach((bubble) => {
      drawPolygonWithText(ctx, bubble, 1, 1, true) // hideUI = true, scaleX=1, scaleY=1
    })

    // Draw temporary box if it exists for export
    if (tempBoxCoordinates) {
      drawTempBox(
        ctx,
        tempBoxCoordinates,
        1, // scaleX = 1 for export
        1, // scaleY = 1 for export
        true, // hideUI = true for export
        tempBoxText,
        tempBoxFontSize,
        tempBoxFontColor,
        tempBoxFontId,
        fonts,
      )
    }

    return {
      canvas: exportCanvas,
      originalWidth: image.naturalWidth,
      originalHeight: image.naturalHeight,
    }
  }

  useEffect(() => {
    const image = imageRef.current
    if (!image) return

    const handleImageLoad = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      // Set canvas size to match image display size
      const rect = image.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height

      redrawCanvas()
    }

    if (image.complete) {
      handleImageLoad()
    } else {
      image.addEventListener("load", handleImageLoad)
      return () => image.removeEventListener("load", handleImageLoad)
    }
  }, [imageUrl])

  useEffect(() => {
    redrawCanvas()
  }, [
    speechBubbles,
    selectedBubbleId,
    isAddingBubble,
    polygonPoints,
    editingBubble,
    draggedBubble,
    fonts,
    isDraggingVertex,
    isDraggingBubble,
    tempBoxCoordinates, // Added for temporary box
    isEditingTempBoxText, // Added for temporary box
    tempBoxText, // Added for temporary box text changes
    tempBoxFontSize, // Added for temporary box font changes
    tempBoxFontColor, // Added for temporary box font changes
    tempBoxFontId, // Added for temporary box font changes
  ])

  useEffect(() => {
    setIsDrawing(isAddingBubble)
    if (!isAddingBubble) {
      setPolygonPoints([])
    }
  }, [isAddingBubble])

  // Expose the export canvas function to parent components
  useEffect(() => {
    if (canvasRef.current) {
      ;(canvasRef.current as any).getExportCanvas = getExportCanvas
    }
  }, [speechBubbles, tempBoxCoordinates, tempBoxText, tempBoxFontSize, tempBoxFontColor, tempBoxFontId, fonts]) // Depend on temp box states for export

  const getCursorStyle = () => {
    if (isAddingBubble) return "crosshair"
    if (isResizingTempBox || isDraggingVertex) return "grabbing"
    if (isDraggingTempBox || isDraggingBubble) return "grabbing"
    return "pointer"
  }

  return (
    <div className="relative inline-block">
      <img
        ref={imageRef}
        src={imageUrl || "/placeholder.svg"}
        alt="Page with speech bubbles"
        className="w-full h-auto rounded block"
        crossOrigin="anonymous"
        onError={(e) => {
          console.error("Image failed to load:", imageUrl)
          e.currentTarget.src = "/placeholder.svg?height=400&width=300"
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{
          borderRadius: "0.375rem",
          cursor: getCursorStyle(),
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onClick={handleCanvasClick}
        onContextMenu={handleRightClick}
      />

      {/* Inline Text Editing for Existing Bubbles */}
      {editingBubble && (
        <div
          className="absolute bg-white bg-opacity-95 border-2 border-green-500 rounded p-2 z-50"
          style={{
            left: editBounds.x,
            top: editBounds.y,
            width: Math.max(editBounds.width, 200),
            minHeight: Math.max(editBounds.height, 100),
          }}
        >
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Original Text:</label>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full p-1 border rounded text-xs resize-none"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    handleSaveEdit()
                  }
                  if (e.key === "Escape") {
                    handleCancelEdit()
                  }
                }}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Translation:</label>
              <textarea
                value={editTranslation}
                onChange={(e) => setEditTranslation(e.target.value)}
                className="w-full p-1 border rounded text-xs resize-none"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    handleSaveEdit()
                  }
                  if (e.key === "Escape") {
                    handleCancelEdit()
                  }
                }}
              />
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleSaveEdit}
                className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 flex-1"
              >
                Save (Ctrl+Enter)
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 flex-1"
              >
                Cancel (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Text Editing for Temporary Box */}
      {isEditingTempBoxText && tempBoxCoordinates && (
        <div
          className="absolute bg-white bg-opacity-95 border-2 border-purple-500 rounded p-2 z-50"
          style={{
            left: tempBoxEditBounds.x,
            top: tempBoxEditBounds.y,
            width: Math.max(tempBoxEditBounds.width, 200),
            minHeight: Math.max(tempBoxEditBounds.height, 100),
          }}
        >
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Bubble Text:</label>
              <textarea
                value={tempBoxText}
                onChange={(e) => setTempBoxText(e.target.value)}
                className="w-full p-1 border rounded text-xs resize-none"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    handleSaveTempBoxEdit()
                  }
                  if (e.key === "Escape") {
                    handleCancelTempBoxEdit()
                  }
                }}
                autoFocus
                disabled={isSavingTempBox}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col w-1/2">
                <label className="text-xs font-medium text-gray-700">Font Size</label>
                <input
                  type="number"
                  className="border rounded px-2 py-1 text-sm"
                  value={tempBoxFontSize}
                  onChange={(e) => setTempBoxFontSize(Number(e.target.value))}
                  disabled={isSavingTempBox}
                />
              </div>
              <div className="flex flex-col w-1/2">
                <label className="text-xs font-medium text-gray-700">Font Color</label>
                <input
                  type="color"
                  className="h-9 rounded"
                  value={rgbArrayToHex(tempBoxFontColor)}
                  onChange={(e) => setTempBoxFontColor(hexToRgbArray(e.target.value))}
                  disabled={isSavingTempBox}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700 block mb-1">Font Family</label>
              <Select
                value={tempBoxFontId.toString()}
                onValueChange={(value) => setTempBoxFontId(Number(value))}
                disabled={isSavingTempBox}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select font">
                    {fonts.find((f) => f.id === tempBoxFontId)?.name || "Select font"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {fonts.map((font) => (
                    <SelectItem key={font.id} value={font.id.toString()}>
                      <div className="flex flex-col">
                        <span className="font-medium">{font.name}</span>
                        {font.file_url && <span className="text-xs text-muted-foreground">Custom Font</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleSaveTempBoxEdit}
                className="px-2 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSavingTempBox}
              >
                {isSavingTempBox ? "Saving..." : "Save (Ctrl+Enter)"}
              </button>
              <button
                onClick={handleCancelTempBoxEdit}
                className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 flex-1"
                disabled={isSavingTempBox}
              >
                Cancel (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddingBubble && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm instruction-overlay">
          Click to add points. Right-click to finish polygon.
        </div>
      )}

      {!isAddingBubble && !editingBubble && !isEditingTempBoxText && (
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm instruction-overlay">
          Double-click speech bubble to edit text • Double-click empty area to add/edit temporary box • Drag bubbles to
          move
        </div>
      )}
    </div>
  )
}
