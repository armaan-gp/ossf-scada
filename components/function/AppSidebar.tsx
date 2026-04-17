'use client';

// Primary navigation sidebar for app sections and logout control.
// Import required components and icons
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { Activity, AlertCircle, BarChart3, CircuitBoard, ClipboardList, LayoutDashboard, LayoutDashboardIcon, LogOut, MapPinned, Settings, UserCheck } from "lucide-react"
import Image from "next/image";
import tam_agrilife from '@/images/tamu_agrilife_logo.png';
import { handleLogout } from "@/lib/actions/auth";
import { User } from "@/db/schema";
import Link from 'next/link';

// AppSidebar component that provides the main navigation menu
export default function AppSidebar({ user }: { user: User }) {
    return (
        <div className="flex min-h-screen">
            {/* Main sidebar container */}
            <Sidebar className="border-r border-border bg-card hidden md:block">
                {/* Sidebar header with logo */}
                <SidebarHeader className="p-4 py-8">
                    <div className="flex items-center gap-2">
                        <Image src={tam_agrilife} alt="TAMU AgriLife Logo" className='w-full' />
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    {/* Overview section */}
                    <SidebarGroup>
                        <SidebarGroupLabel>Overview</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {/* Dashboard link */}
                                <SidebarMenuItem>
                                    <Link href="/app">
                                        <SidebarMenuButton className='flex justify-between font-semibold text-sm'>
                                            <span>Dashboard</span>
                                            <LayoutDashboardIcon className="h-4 w-4" />
                                        </SidebarMenuButton>
                                    </Link>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <Link href="/app/center-map">
                                        <SidebarMenuButton className='flex justify-between font-semibold text-sm'>
                                            <span>Center Map</span>
                                            <MapPinned className="h-4 w-4" />
                                        </SidebarMenuButton>
                                    </Link>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                    <hr />
                    {/* Management section */}
                    <SidebarGroup>
                        <SidebarGroupLabel>Management</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {/* User Management link (only visible to admins) */}
                                {user.isAdmin && (
                                    <SidebarMenuItem>
                                        <Link href="/app/user_management">
                                            <SidebarMenuButton className='flex justify-between font-semibold text-sm'>
                                                <span>User Management</span>
                                                <UserCheck className="h-4 w-4" />
                                            </SidebarMenuButton>
                                        </Link>
                                    </SidebarMenuItem>
                                )}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                {/* Sidebar footer with settings and logout */}
                <SidebarFooter className='pb-5'>
                    <SidebarGroup>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {/* Settings link */}
                                <SidebarMenuItem>
                                    <Link href="/app/settings">
                                        <SidebarMenuButton className='flex justify-between font-semibold text-sm'>
                                            <span>Settings</span>
                                            <Settings className="h-4 w-4" />
                                        </SidebarMenuButton>
                                    </Link>
                                </SidebarMenuItem>
                                {/* Logout button */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={handleLogout} className='text-destructive flex justify-between font-semibold text-sm'>
                                        <span>Logout</span>
                                        <LogOut className="h-4 w-4" />
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarFooter>
            </Sidebar>

            {/* <div className="flex-1 mb-10">
                <header className="border-b border-border">
                    <div className="flex h-16 items-center px-4">
                        <div className="ml-auto flex items-center space-x-4">
                        </div>
                    </div>
                </header>
            </div> */}
        </div>
    )
}
