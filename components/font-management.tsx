"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/api"
import { Type, Upload, Download, Trash2, Edit, FileText } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Font {
  id: number
  name: string
  file_url: string
  file_name: string
  file_size: number
  mime_type: string
  created_at: string
  updated_at: string
}

export function FontManagement() {
  const { token } = useAuth()
  const [fonts, setFonts] = useState<Font[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fontName, setFontName] = useState("")
  const [editingFont, setEditingFont] = useState<Font | null>(null)
  const [editFontName, setEditFontName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchFonts()
  }, [])

  const fetchFonts = async () => {
    try {
      const response = await apiRequest("/v1/fonts/", {}, token!)
      setFonts(response)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const uploadFont = async () => {
    if (!selectedFile || !fontName.trim()) {
      toast({
        title: "Error",
        description: "Please select a file and enter a font name",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await fetch(`http://54.91.239.105/v1/fonts/?name=${encodeURIComponent(fontName)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      toast({
        title: "Success",
        description: "Font uploaded successfully",
      })

      setSelectedFile(null)
      setFontName("")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      fetchFonts()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const updateFont = async () => {
    if (!editingFont || !editFontName.trim()) return

    try {
      await apiRequest(
        `/v1/fonts/${editingFont.id}?name=${encodeURIComponent(editFontName)}`,
        {
          method: "PUT",
        },
        token!,
      )

      toast({
        title: "Success",
        description: "Font updated successfully",
      })

      setEditingFont(null)
      setEditFontName("")
      fetchFonts()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const deleteFont = async (fontId: number) => {
    try {
      await apiRequest(
        `/v1/fonts/${fontId}`,
        {
          method: "DELETE",
        },
        token!,
      )

      toast({
        title: "Success",
        description: "Font deleted successfully",
      })
      fetchFonts()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p>Loading fonts...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Type className="mr-2 h-4 w-4" />
            Font Management
          </CardTitle>
          <CardDescription>Upload and manage fonts for comic translation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="font-name">Font Name</Label>
              <Input
                id="font-name"
                value={fontName}
                onChange={(e) => setFontName(e.target.value)}
                placeholder="Enter font name"
              />
            </div>
            <div>
              <Label htmlFor="font-file">Font File</Label>
              <Input
                ref={fileInputRef}
                id="font-file"
                type="file"
                accept=".ttf,.otf,.pil"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground mt-1">Supported formats: TTF, OTF, PIL</p>
            </div>
            <Button onClick={uploadFont} disabled={!selectedFile || !fontName.trim() || isUploading} className="w-full">
              {isUploading ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Font
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Fonts</CardTitle>
          <CardDescription>Manage your uploaded fonts</CardDescription>
        </CardHeader>
        <CardContent>
          {fonts.length === 0 ? (
            <div className="text-center py-8">
              <Type className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No fonts uploaded yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fonts.map((font) => (
                  <TableRow key={font.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        <span className="font-medium">{font.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{font.file_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{formatFileSize(font.file_size)}</Badge>
                    </TableCell>
                    <TableCell>{new Date(font.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingFont(font)
                                setEditFontName(font.name)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Font</DialogTitle>
                              <DialogDescription>Update font information</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="edit-font-name">Font Name</Label>
                                <Input
                                  id="edit-font-name"
                                  value={editFontName}
                                  onChange={(e) => setEditFontName(e.target.value)}
                                  placeholder="Enter font name"
                                />
                              </div>
                              <Button onClick={updateFont} className="w-full">
                                Update Font
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button variant="outline" size="sm" onClick={() => window.open(font.file_url, "_blank")}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => deleteFont(font.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
