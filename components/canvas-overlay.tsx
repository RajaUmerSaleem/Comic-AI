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
}

interface CanvasOverlayProps {
  imageUrl: string
  speechBubbles: SpeechBubble[]
  pageId: number
  onBubbleClick?: (bubble: SpeechBubble) => void
  selectedBubbleId?: number | null
  isAddingBubble?: boolean
  onPolygonSelect?: (coordinates: number[][]) => void
}

export function CanvasOverlay({
  imageUrl,
  speechBubbles,
  pageId,
  onBubbleClick,
  selectedBubbleId,
  isAddingBubble = false,
  onPolygonSelect,
}: CanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [polygonPoints, setPolygonPoints] = useState<number[][]>([])

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

  const drawPolygonWithText = (ctx: CanvasRenderingContext2D, bubble: SpeechBubble, scaleX: number, scaleY: number) => {
    if (!bubble.mask_coordinates || bubble.mask_coordinates.length === 0) {
      return
    }

    const isSelected = selectedBubbleId === bubble.bubble_id

    // Draw polygon outline
    ctx.beginPath()
    ctx.strokeStyle = isSelected ? "#ef4444" : "#3b82f6"
    ctx.lineWidth = isSelected ? 3 : 2

    const firstPoint = bubble.mask_coordinates[0]
    ctx.moveTo(firstPoint[0] * scaleX, firstPoint[1] * scaleY)

    for (let i = 1; i < bubble.mask_coordinates.length; i++) {
      const point = bubble.mask_coordinates[i]
      ctx.lineTo(point[0] * scaleX, point[1] * scaleY)
    }

    ctx.closePath()
    ctx.stroke()

    // Fill polygon with semi-transparent background
    ctx.fillStyle = isSelected ? "rgba(239, 68, 68, 0.1)" : "rgba(255, 255, 255, 0.9)"
    ctx.fill()

    // Draw translation text if available
    const textToShow = bubble.translation || bubble.text
    if (textToShow && textToShow.trim()) {
      // Calculate polygon bounds for text positioning
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

      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      const maxWidth = (maxX - minX) * 0.8
      const maxHeight = (maxY - minY) * 0.8

      // Set font properties
      const fontSize = Math.max(12, Math.min((bubble.font_size || 14) * Math.min(scaleX, scaleY), maxHeight / 4))
      ctx.font = `${fontSize}px Arial`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      // Set text color
      if (bubble.font_color && Array.isArray(bubble.font_color)) {
        ctx.fillStyle = `rgb(${bubble.font_color[0]}, ${bubble.font_color[1]}, ${bubble.font_color[2]})`
      } else {
        ctx.fillStyle = "#000000"
      }

      // Word wrap text to fit in polygon bounds
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

      // Constrain lines to fit within polygon height
      const lineHeight = fontSize * 1.2
      const totalTextHeight = lines.length * lineHeight
      const maxLines = Math.floor(maxHeight / lineHeight)

      if (lines.length > maxLines) {
        lines.splice(maxLines - 1)
        if (lines.length > 0) {
          lines[lines.length - 1] += "..."
        }
      }

      // Draw each line, ensuring it stays within polygon bounds
      const startY = centerY - ((lines.length - 1) * lineHeight) / 2

      lines.forEach((line, index) => {
        const y = startY + index * lineHeight
        // Check if text position is within polygon bounds
        if (y >= minY && y <= maxY) {
          ctx.fillText(line, centerX, y)
        }
      })
    }

    // Draw bubble number
    ctx.font = `${Math.max(10, 12 * Math.min(scaleX, scaleY))}px Arial`
    ctx.fillStyle = isSelected ? "#ef4444" : "#3b82f6"
    ctx.strokeStyle = "white"
    ctx.lineWidth = 2
    const numberText = `#${bubble.bubble_no}`
    const numberX = bubble.coordinates[0] * scaleX
    const numberY = bubble.coordinates[1] * scaleY - 5
    ctx.strokeText(numberText, numberX, numberY)
    ctx.fillText(numberText, numberX, numberY)
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
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

      // If right click or double click, finish polygon
      if (event.detail === 2 || event.button === 2) {
        if (newPoints.length >= 3) {
          onPolygonSelect?.(newPoints)
          setPolygonPoints([])
          setIsDrawing(false)
        }
      }
      return
    }

    // Check if click is inside any bubble
    for (const bubble of speechBubbles) {
      if (bubble.mask_coordinates && bubble.mask_coordinates.length > 0) {
        if (isPointInPolygon([imageX, imageY], bubble.mask_coordinates)) {
          onBubbleClick?.(bubble)
          return
        }
      }
    }
  }

  const redrawCanvas = () => {
    const canvas = canvasRef.current
    const image = imageRef.current

    if (!canvas || !image) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate scale factors
    const scaleX = canvas.width / image.naturalWidth
    const scaleY = canvas.height / image.naturalHeight

    // Draw all speech bubbles
    speechBubbles.forEach((bubble) => {
      drawPolygonWithText(ctx, bubble, scaleX, scaleY)
    })

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
  }, [speechBubbles, selectedBubbleId, isAddingBubble, polygonPoints])

  useEffect(() => {
    setIsDrawing(isAddingBubble)
    if (!isAddingBubble) {
      setPolygonPoints([])
    }
  }, [isAddingBubble])

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
          cursor: isAddingBubble ? "crosshair" : "pointer",
        }}
        onClick={handleCanvasClick}
        onContextMenu={(e) => {
          e.preventDefault()
          if (isAddingBubble && polygonPoints.length >= 3) {
            onPolygonSelect?.(polygonPoints)
            setPolygonPoints([])
            setIsDrawing(false)
          }
        }}
      />
      {isAddingBubble && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
          Click to add points. Double-click or right-click to finish polygon.
        </div>
      )}
    </div>
  )
}
