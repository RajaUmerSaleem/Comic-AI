"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"

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
  onBubbleGeometrySave?: (pageId: number, bubbleId: number, mask_coordinates: number[][], coordinates: number[]) => void
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
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null)
  const [initialMousePos, setInitialMousePos] = useState<{
    x: number
    y: number
  } | null>(null)
  const [initialVertexPos, setInitialVertexPos] = useState<{
    x: number
    y: number
  } | null>(null)

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
      const fontSize = Math.max(12, Math.min((bubble.font_size || 14) * Math.min(scaleX, scaleY), maxHeight / 4))

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

  const handleCanvasMouseUp = () => {
    if (isDraggingVertex && draggedBubble) {
      const bubble = speechBubbles.find((b) => b.bubble_id === draggedBubble)
      if (bubble && onBubbleGeometrySave) {
        onBubbleGeometrySave(pageId, bubble.bubble_id, bubble.mask_coordinates, bubble.coordinates)
      }
    } else if (isDraggingBubble && draggedBubble) {
      const bubble = speechBubbles.find((b) => b.bubble_id === draggedBubble)
      if (bubble && onBubbleGeometrySave) {
        onBubbleGeometrySave(pageId, bubble.bubble_id, bubble.mask_coordinates, bubble.coordinates)
      }
    }
    // Always reset dragging states after potential save
    setIsDraggingBubble(false)
    setIsDraggingVertex(false)
    setDraggedBubble(null)
    setDragOffset({ x: 0, y: 0 })
    setDraggingVertexIndex(null)
    setInitialMousePos(null)
    setInitialVertexPos(null)
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Don't handle click if we were dragging (either bubble or vertex)
    if (isDraggingBubble || isDraggingVertex) {
      // Reset dragging states if they weren't reset by mouseUp (e.g., mouseUp outside canvas)
      setIsDraggingBubble(false)
      setIsDraggingVertex(false)
      setDraggedBubble(null)
      setDragOffset({ x: 0, y: 0 })
      setDraggingVertexIndex(null)
      setInitialMousePos(null)
      setInitialVertexPos(null)
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

    if (isAddingBubble) {
      // Add point to polygon
      const newPoints = [...polygonPoints, [imageX, imageY]]
      setPolygonPoints(newPoints)
      return
    }

    // Check if click is inside any bubble
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

    // Double click on empty area to create new bubble
    if (event.detail === 2 && !isAddingBubble) {
      // Create a small default polygon around the click point
      const size = 50 // Default bubble size
      const defaultPolygon = [
        [imageX - size, imageY - size],
        [imageX + size, imageY - size],
        [imageX + size, imageY + size],
        [imageX - size, imageY + size],
      ]
      onCanvasDoubleClick?.(defaultPolygon)
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
    const scaleY = image.height / image.naturalHeight // Use image.height for correct scaling

    // Draw all speech bubbles
    speechBubbles.forEach((bubble) => {
      drawPolygonWithText(ctx, bubble, scaleX, scaleY, hideUI)
    })

    // Only draw UI elements if not hiding UI
    if (!hideUI) {
      // Draw current polygon being created
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
    exportCanvas.width = canvas.width
    exportCanvas.height = canvas.height

    const ctx = exportCanvas.getContext("2d")
    if (!ctx) return null

    // Clear canvas
    ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height)

    // Calculate scale factors
    const scaleX = exportCanvas.width / image.naturalWidth
    const scaleY = exportCanvas.height / image.naturalHeight

    // Draw all speech bubbles WITHOUT UI elements
    speechBubbles.forEach((bubble) => {
      drawPolygonWithText(ctx, bubble, scaleX, scaleY, true) // hideUI = true
    })

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
  }, [speechBubbles])

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
        className="absolute top-0 left-0 w-full h-full cursor-pointer"
        style={{
          borderRadius: "0.375rem",
          cursor: isAddingBubble
            ? "crosshair"
            : isDraggingVertex
              ? "grabbing"
              : isDraggingBubble
                ? "grabbing"
                : "pointer",
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onClick={handleCanvasClick}
        onContextMenu={handleRightClick}
      />

      {/* Inline Text Editing */}
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

      {isAddingBubble && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm instruction-overlay">
          Click to add points. Right-click to finish polygon.
        </div>
      )}

      {!isAddingBubble && !editingBubble && (
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm instruction-overlay">
          Double-click speech bubble to edit text • Double-click empty area to add bubble • Drag bubbles to move
        </div>
      )}
    </div>
  )
}
