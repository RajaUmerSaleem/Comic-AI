"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, uploadFile } from "@/lib/api"
import { Upload, FileText, Download, Trash2, RefreshCw, ImageIcon, Clock, CheckCircle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"

interface FileData {
  id: number
  file_url: string
  detected_file_url: string | null
  text_removed_file_url: string | null
  text_translated_file_url: string | null
  status: string
  created_at: string
  updated_at: string
  user_id: number
  business_id: number
}

interface TaskStatus {
  status: string
  result: any
  task_id: string
}

export default function FilesPage() {
  const { token } = useAuth()
  const [files, setFiles] = useState<FileData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [processingTasks, setProcessingTasks] = useState<Map<number, string>>(new Map())
  const [taskProgress, setTaskProgress] = useState<Map<string, TaskStatus>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchFiles()
  }, [])

  useEffect(() => {
    // Poll task statuses
    const interval = setInterval(() => {
      processingTasks.forEach((taskId, fileId) => {
        pollTaskStatus(taskId, fileId)
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [processingTasks])

  const fetchFiles = async () => {
    try {
      const response = await apiRequest("/v1/file/", {}, token!)
      setFiles(response.files)
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

  const handleFileUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    try {
      const response = await uploadFile("/v1/file/", selectedFile, token!)
      toast({
        title: "Success",
        description: "File uploaded successfully",
      })
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      fetchFiles()
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

  const convertToImages = async (fileId: number) => {
    try {
      const response = await apiRequest(
        `/v1/file/async-images-from-pdf?file_id=${fileId}`,
        {
          method: "POST",
        },
        token!,
      )

      const newProcessingTasks = new Map(processingTasks)
      newProcessingTasks.set(fileId, response.task_id)
      setProcessingTasks(newProcessingTasks)

      toast({
        title: "Processing Started",
        description: "Converting PDF to images...",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const pollTaskStatus = async (taskId: string, fileId: number) => {
    try {
      const response = await apiRequest(`/v1/file/task-status/${taskId}`, {}, token!)

      const newTaskProgress = new Map(taskProgress)
      newTaskProgress.set(taskId, response)
      setTaskProgress(newTaskProgress)

      if (response.status === "SUCCESS" || response.status === "FAILED") {
        const newProcessingTasks = new Map(processingTasks)
        newProcessingTasks.delete(fileId)
        setProcessingTasks(newProcessingTasks)

        if (response.status === "SUCCESS") {
          toast({
            title: "Success",
            description: "PDF converted to images successfully",
          })
          fetchFiles()
        } else {
          toast({
            title: "Error",
            description: "Failed to convert PDF to images",
            variant: "destructive",
          })
        }
      }
    } catch (error: any) {
      console.error("Error polling task status:", error)
    }
  }

  const deleteFile = async (fileId: number) => {
    try {
      await apiRequest(
        `/v1/file/${fileId}`,
        {
          method: "DELETE",
        },
        token!,
      )

      toast({
        title: "Success",
        description: "File deleted successfully",
      })
      fetchFiles()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      uploaded: { variant: "secondary" as const, icon: Upload },
      detected: { variant: "default" as const, icon: CheckCircle },
      text_removed: { variant: "default" as const, icon: CheckCircle },
      translated: { variant: "default" as const, icon: CheckCircle },
      completed: { variant: "default" as const, icon: CheckCircle },
      delivered: { variant: "default" as const, icon: CheckCircle },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || { variant: "secondary" as const, icon: Clock }
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    )
  }

  const getTaskProgress = (fileId: number) => {
    const taskId = processingTasks.get(fileId)
    if (!taskId) return null

    const progress = taskProgress.get(taskId)
    if (!progress) return null

    if (progress.result && typeof progress.result === "object" && "done" in progress.result) {
      const percentage = (progress.result.done / progress.result.total) * 100
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">{progress.status}</span>
          </div>
          <Progress value={percentage} className="w-full" />
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm">{progress.status}</span>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading files...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">File Management</h1>
        <p className="text-muted-foreground">Upload and manage your comic PDF files for translation.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="mr-2 h-5 w-5" />
            Upload New File
          </CardTitle>
          <CardDescription>Upload a PDF file to start the comic translation process.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
            <Button onClick={handleFileUpload} disabled={!selectedFile || isUploading} className="w-full sm:w-auto">
              {isUploading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            Your Files
          </CardTitle>
          <CardDescription>Manage your uploaded comic files and track their processing status.</CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No files uploaded yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium">File #{file.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(file.status)}</TableCell>
                    <TableCell>{new Date(file.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{getTaskProgress(file.id) || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => convertToImages(file.id)}
                          disabled={processingTasks.has(file.id)}
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.open(file.file_url, "_blank")}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => deleteFile(file.id)}>
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
