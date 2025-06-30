"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, uploadFont } from "@/lib/api"
import { Type, Upload, Trash2, Edit, RefreshCw } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Font {
  id: number
  name: string
  file_path: string
  file_size: number
  created_at: string
  updated_at: string
}

interface FontsResponse {
  fonts: Font[]
  total: number
}

export function FontManagement() {
  const [fonts, setFonts] = useState<Font[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fontName, setFontName] = useState("")
  const [editingFont, setEditingFont] = useState<Font | null>(null)
  const [editFontName, setEditFontName] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchFonts()
  }, [])

  const fetchFonts = async () => {
    try {
      const token = localStorage.getItem("userToken")
      const response: FontsResponse = await apiRequest("/v1/fonts/", {}, token!)
      setFonts(response.fonts || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch fonts",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "")
      setFontName(nameWithoutExt)
    }
  }

  const handleUpload = async () => {
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
      const token = localStorage.getItem("userToken")
      const response = await uploadFont(fontName, selectedFile, token!)

      toast({
        title: "Success",
        description: "Font uploaded successfully",
      })
      setSelectedFile(null)
      setFontName("")
      const fileInput = document.getElementById("font-upload") as HTMLInputElement
      if (fileInput) fileInput.value = ""

      fetchFonts()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload font",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const updateFont = async () => {
    if (!editingFont || !editFontName.trim()) return

    setIsUpdating(true)
    try {
      const token = localStorage.getItem("userToken")
      const response = await apiRequest(
        `/v1/fonts/${editingFont.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ name: editFontName }),
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
        description: error.message || "Failed to update font",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const deleteFont = async (fontId: number) => {
    try {
      const token = localStorage.getItem("userToken")
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
        description: error.message || "Failed to delete font",
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
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading fonts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="mr-2 h-5 w-5" />
            Upload New Font
          </CardTitle>
          <CardDescription>Upload TTF, OTF, or WOFF font files</CardDescription>
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
              <Label htmlFor="font-upload">Select Font File</Label>
              <Input
                id="font-upload"
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>
            <Button onClick={handleUpload} disabled={isUploading || !selectedFile || !fontName.trim()}>
              {isUploading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
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
          <CardTitle className="flex items-center">
            <Type className="mr-2 h-5 w-5" />
            Your Fonts ({fonts.length})
          </CardTitle>
          <CardDescription>Manage your uploaded fonts</CardDescription>
        </CardHeader>
        <CardContent>
          {fonts.length === 0 ? (
            <div className="text-center py-8">
              <Type className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No fonts uploaded yet. Upload your first font above.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Font Name</TableHead>
                  <TableHead>File Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fonts.map((font) => (
                  <TableRow key={font.id}>
                    <TableCell>
                      <div className="font-medium">{font.name}</div>
                      <div className="text-sm text-muted-foreground">ID: {font.id}</div>
                    </TableCell>
                    <TableCell>{formatFileSize(font.file_size)}</TableCell>
                    <TableCell>{new Date(font.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
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
                              <Button onClick={updateFont} disabled={isUpdating} className="w-full">
                                {isUpdating ? "Updating..." : "Update Font"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Font</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{font.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteFont(font.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
