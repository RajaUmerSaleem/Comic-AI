const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://54.91.239.105"

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function apiRequest(endpoint: string, options: RequestInit = {}, token?: string) {
  const url = `${BASE_URL}${endpoint}`

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new ApiError(response.status, errorData.detail || errorData.message || "An error occurred")
  }

  return response.json()
}

export async function uploadFile(
  endpoint: string,
  file: File,
  token?: string,
  additionalData?: Record<string, string>,
) {
  const url = `${BASE_URL}${endpoint}`
  const formData = new FormData()
  formData.append("uploaded_file", file)

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value)
    })
  }

  const headers: HeadersInit = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new ApiError(response.status, errorData.detail || errorData.message || "Upload failed")
  }

  return response.json()
}
