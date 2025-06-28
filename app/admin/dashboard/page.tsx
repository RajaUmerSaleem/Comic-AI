"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/api"
import { Building2, Users, Plus, Edit, Trash2, UserCheck, UserX, LogOut } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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

export default function AdminDashboard() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newBusinessName, setNewBusinessName] = useState("")
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null)
  const [editBusinessName, setEditBusinessName] = useState("")
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
      const response = await apiRequest("/v1/business/", {}, token!)
      setBusinesses(response.businesses)
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

  const createBusiness = async () => {
    if (!newBusinessName.trim()) return

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

      setNewBusinessName("")
      fetchBusinesses()
      toast({
        title: "Success",
        description: "Business created successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const updateBusiness = async () => {
    if (!editingBusiness || !editBusinessName.trim()) return

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

      setEditingBusiness(null)
      setEditBusinessName("")
      fetchBusinesses()
      toast({
        title: "Success",
        description: "Business updated successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
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

      fetchBusinesses()
      toast({
        title: "Success",
        description: "Business deleted successfully",
      })
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
          body: JSON.stringify({ user_id: userId, is_activated: !isActivated }),
        },
        token!,
      )

      fetchBusinesses()
      toast({
        title: "Success",
        description: `User ${!isActivated ? "activated" : "deactivated"} successfully`,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("adminToken")
    router.push("/admin/login")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Business Management</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Business
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Business</DialogTitle>
                  <DialogDescription>Add a new business to the platform</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input
                      id="businessName"
                      value={newBusinessName}
                      onChange={(e) => setNewBusinessName(e.target.value)}
                      placeholder="Enter business name"
                    />
                  </div>
                  <Button onClick={createBusiness} className="w-full">
                    Create Business
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-6">
            {businesses.map((business) => (
              <Card key={business.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center">
                        <Building2 className="h-5 w-5 mr-2" />
                        {business.name}
                      </CardTitle>
                      <CardDescription>Created: {new Date(business.created_at).toLocaleDateString()}</CardDescription>
                    </div>
                    <div className="flex space-x-2">
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
                              <Label htmlFor="editBusinessName">Business Name</Label>
                              <Input
                                id="editBusinessName"
                                value={editBusinessName}
                                onChange={(e) => setEditBusinessName(e.target.value)}
                                placeholder="Enter business name"
                              />
                            </div>
                            <Button onClick={updateBusiness} className="w-full">
                              Update Business
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="outline" size="sm" onClick={() => deleteBusiness(business.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center mb-4">
                    <Users className="h-4 w-4 mr-2" />
                    <span className="font-medium">Users ({business.users.length})</span>
                  </div>
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
                            {user.first_name} {user.last_name}
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
                              {user.is_activated ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
