"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/api"
import { Building2, Users, Plus, Edit, Trash2, UserCheck, UserX, RefreshCw } from "lucide-react"
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

interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: string
  is_activated: boolean
}

interface Business {
  id: number
  name: string
  created_at: string
  updated_at: string
  users: User[]
}

interface BusinessResponse {
  message: string
  businesses: Business[]
  total: number
}

export default function AdminDashboard() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newBusinessName, setNewBusinessName] = useState("")
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null)
  const [editBusinessName, setEditBusinessName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const token = localStorage.getItem("adminToken")
    if (!token) {
      router.push("/admin/login")
      return
    }
    fetchBusinesses()
  }, [router])

  const fetchBusinesses = async () => {
    try {
      const token = localStorage.getItem("adminToken")
      const response: BusinessResponse = await apiRequest("/v1/business/", {}, token!)
      setBusinesses(response.businesses)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
      if (error.status === 401) {
        localStorage.removeItem("adminToken")
        router.push("/admin/login")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const createBusiness = async () => {
    if (!newBusinessName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a business name",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)
    try {
      const token = localStorage.getItem("adminToken")
      await apiRequest(
        "/v1/business/",
        {
          method: "POST",
          body: JSON.stringify({ name: newBusinessName }),
        },
        token!,
      )

      toast({
        title: "Success",
        description: "Business created successfully",
      })
      setNewBusinessName("")
      fetchBusinesses()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const updateBusiness = async () => {
    if (!editingBusiness || !editBusinessName.trim()) return

    setIsUpdating(true)
    try {
      const token = localStorage.getItem("adminToken")
      await apiRequest(
        `/v1/business/${editingBusiness.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ name: editBusinessName }),
        },
        token!,
      )

      toast({
        title: "Success",
        description: "Business updated successfully",
      })
      setEditingBusiness(null)
      setEditBusinessName("")
      fetchBusinesses()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const deleteBusiness = async (businessId: number) => {
    try {
      const token = localStorage.getItem("adminToken")
      await apiRequest(
        `/v1/business/${businessId}`,
        {
          method: "DELETE",
        },
        token!,
      )

      toast({
        title: "Success",
        description: "Business deleted successfully",
      })
      fetchBusinesses()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const toggleUserActivation = async (userId: number, isActivated: boolean) => {
    try {
      const token = localStorage.getItem("adminToken")
      await apiRequest(
        "/v1/business/user/activate",
        {
          method: "PUT",
          body: JSON.stringify({
            user_id: userId,
            is_activated: !isActivated,
          }),
        },
        token!,
      )

      toast({
        title: "Success",
        description: `User ${!isActivated ? "activated" : "deactivated"} successfully`,
      })
      fetchBusinesses()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const logout = () => {
    localStorage.removeItem("adminToken")
    router.push("/admin/login")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage businesses and users</p>
          </div>
          <Button onClick={logout} variant="outline">
            Logout
          </Button>
        </div>

        <div className="grid gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Plus className="mr-2 h-5 w-5" />
                Create New Business
              </CardTitle>
              <CardDescription>Add a new business to the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="business-name">Business Name</Label>
                  <Input
                    id="business-name"
                    value={newBusinessName}
                    onChange={(e) => setNewBusinessName(e.target.value)}
                    placeholder="Enter business name"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={createBusiness} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Business
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="mr-2 h-5 w-5" />
                Businesses ({businesses.length})
              </CardTitle>
              <CardDescription>Manage all businesses and their users</CardDescription>
            </CardHeader>
            <CardContent>
              {businesses.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No businesses found.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {businesses.map((business) => (
                    <div key={business.id} className="border rounded-lg p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold">{business.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Created: {new Date(business.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingBusiness(business)
                                  setEditBusinessName(business.name)
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Business</DialogTitle>
                                <DialogDescription>Update business information</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="edit-business-name">Business Name</Label>
                                  <Input
                                    id="edit-business-name"
                                    value={editBusinessName}
                                    onChange={(e) => setEditBusinessName(e.target.value)}
                                    placeholder="Enter business name"
                                  />
                                </div>
                                <Button onClick={updateBusiness} disabled={isUpdating} className="w-full">
                                  {isUpdating ? "Updating..." : "Update Business"}
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
                                <AlertDialogTitle>Delete Business</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{business.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteBusiness(business.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-3 flex items-center">
                          <Users className="mr-2 h-4 w-4" />
                          Users ({business.users.length})
                        </h4>
                        {business.users.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No users in this business.</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {business.users.map((user) => (
                                <TableRow key={user.id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">
                                        {user.first_name} {user.last_name}
                                      </p>
                                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>{user.email}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{user.role}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={user.is_activated ? "default" : "destructive"}>
                                      {user.is_activated ? "Active" : "Inactive"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => toggleUserActivation(user.id, user.is_activated)}
                                    >
                                      {user.is_activated ? (
                                        <>
                                          <UserX className="h-4 w-4 mr-1" />
                                          Deactivate
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="h-4 w-4 mr-1" />
                                          Activate
                                        </>
                                      )}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
