import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useSession, authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2, Eye, EyeOff, Check } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export const Route = createFileRoute('/settings/account')({
  component: AccountSettingsPage,
  staticData: {
    title: 'Account Settings'
  }
})

function AccountSettingsPage() {
  const { data: session, refetch } = useSession()

  return (
    <div className="space-y-6">
      <ProfileCard session={session} onUpdate={refetch} />
      <PasswordCard />
    </div>
  )
}

function ProfileCard({
  session,
  onUpdate
}: {
  session: ReturnType<typeof useSession>['data']
  onUpdate: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(session?.user?.name || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return

    setIsLoading(true)
    setIsSuccess(false)

    try {
      await authClient.updateUser({
        name: name.trim(),
      })
      onUpdate()
      setIsSuccess(true)
      toast({
        title: 'Profile updated',
        description: 'Your name has been updated successfully.',
      })
      setTimeout(() => setIsSuccess(false), 2000)
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const hasChanges = name.trim() !== (session?.user?.name || '')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Profile</CardTitle>
        <CardDescription>
          Manage your account profile information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={session?.user?.email || ''}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            Email cannot be changed.
          </p>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isLoading || !hasChanges || !name.trim()}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSuccess && <Check className="h-4 w-4 mr-2" />}
            {isSuccess ? 'Saved' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const { toast } = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const isValid =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword

  const handleChangePassword = async () => {
    if (!isValid) return

    setIsLoading(true)

    try {
      await authClient.changePassword({
        currentPassword,
        newPassword,
      })
      toast({
        title: 'Password changed',
        description: 'Your password has been updated successfully.',
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      toast({
        title: 'Password change failed',
        description: error instanceof Error ? error.message : 'Failed to change password',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Change Password</CardTitle>
        <CardDescription>
          Update your password to keep your account secure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current-password">Current Password</Label>
          <div className="relative">
            <Input
              id="current-password"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              {showCurrentPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-xs text-red-500">
              Password must be at least 8 characters.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm New Password</Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <p className="text-xs text-red-500">
              Passwords do not match.
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleChangePassword}
            disabled={isLoading || !isValid}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Change Password
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
