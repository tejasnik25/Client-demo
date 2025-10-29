'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FiBarChart2, FiDollarSign, FiUser, FiTrendingUp } from 'react-icons/fi';

import Card, { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import UserLayout from '@/components/UserLayout';

// Dashboard page content
function DashboardPageContent() {
  const { data: session } = useSession();
  const router = useRouter();
  // Removed analysis history logic

  return (
    <div className="w-full py-6 space-y-6">
      {/* Navigation Boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        <button 
          onClick={() => router.push('/strategies')}
          className="group relative flex flex-col items-center justify-center p-6 rounded-xl bg-[#161d31] border border-[#283046] text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.03] overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#7367f0]/10 to-transparent group-hover:from-[#7367f0]/20 transition-colors duration-300"></div>
          <div className="relative w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-[#7367f0]/15 text-[#7367f0] group-hover:bg-[#7367f0]/25 transition-colors duration-300">
            <FiTrendingUp className="h-8 w-8" />
          </div>
          <h3 className="text-base font-medium text-center text-white">Strategies</h3>
          <p className="text-xs text-gray-300 text-center mt-1">Explore trading strategies</p>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-tr from-primary/5 to-transparent rounded-full transform rotate-45 transition-transform duration-500 group-hover:rotate-0"></div>
        </button>
        

        <button 
          onClick={() => router.push('/wallet')}
          className="group relative flex flex-col items-center justify-center p-6 rounded-xl bg-[#161d31] border border-[#283046] text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.03] overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent group-hover:from-emerald-500/20 transition-colors duration-300"></div>
          <div className="relative w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25 transition-colors duration-300">
            <FiDollarSign className="h-8 w-8" />
          </div>
          <h3 className="text-base font-medium text-center text-white">Wallet</h3>
          <p className="text-xs text-gray-300 text-center mt-1">Manage your tokens</p>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-tr from-green-500/5 to-transparent rounded-full transform rotate-45 transition-transform duration-500 group-hover:rotate-0"></div>
        </button>
        
        <button 
          onClick={() => router.push('/dashboard?tab=profile')}
          className="group relative flex flex-col items-center justify-center p-6 rounded-xl bg-[#161d31] border border-[#283046] text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.03] overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#7367f0]/10 to-transparent group-hover:from-[#7367f0]/20 transition-colors duration-300"></div>
          <div className="relative w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-[#7367f0]/15 text-[#7367f0] group-hover:bg-[#7367f0]/25 transition-colors duration-300">
            <FiUser className="h-8 w-8" />
          </div>
          <h3 className="text-base font-medium text-center text-white">Profile</h3>
          <p className="text-xs text-gray-300 text-center mt-1">Account settings</p>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-tr from-purple-500/5 to-transparent rounded-full transform rotate-45 transition-transform duration-500 group-hover:rotate-0"></div>
        </button>
      </div>
      
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="grid w-full grid-cols-4 bg-[#283046] text-gray-200">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tokens">Buy Tokens</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6 space-y-4">
          <Card className="bg-[#161d31] border border-[#283046] text-white">
            <CardHeader>
              <CardTitle className="text-white">Overview</CardTitle>
              <CardDescription className="text-gray-300">Quick access to key features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={() => router.push('/strategies')} className="w-full bg-[#7367f0] hover:bg-[#6a5ce6] text-white">Explore Strategies</Button>
                <Button onClick={() => router.push('/wallet')} className="w-full bg-[#283046] text-gray-200 hover:bg-[#2e3650]">Manage Wallet</Button>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={() => router.push('/strategies')} className="w-full bg-[#7367f0] hover:bg-[#6a5ce6] text-white">Get Started</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="tokens" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Tokens</CardTitle>
              <CardDescription>
                Buy tokens for platform features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>10 Tokens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">$4.99</p>
                    <p className="text-muted-foreground">Basic package</p>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full">Purchase</Button>
                  </CardFooter>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>50 Tokens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">$19.99</p>
                    <p className="text-muted-foreground">Standard package</p>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full">Purchase</Button>
                  </CardFooter>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>100 Tokens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">$29.99</p>
                    <p className="text-muted-foreground">Premium package</p>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full">Purchase</Button>
                  </CardFooter>
                </Card>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Premium Subscription</CardTitle>
              <CardDescription>
                Get unlimited stock analysis access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-2">Premium Plan</h3>
                <p className="mb-4">Unlimited stock analyses, priority support, and more</p>
                <div className="flex items-baseline mb-4">
                  <span className="text-3xl font-bold">$19.99</span>
                  <span className="ml-2">/month</span>
                </div>
                <Button variant="secondary">Subscribe Now</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="profile" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                View and update your profile details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <input 
                      type="text" 
                      className="w-full p-2 border rounded-md" 
                      value={session?.user?.name || ''} 
                      readOnly 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <input 
                      type="email" 
                      className="w-full p-2 border rounded-md" 
                      value={session?.user?.email || ''} 
                      readOnly 
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Account Type</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded-md" 
                    value={'Standard'} 
                    readOnly 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Member Since</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded-md" 
                    value={new Date().toLocaleDateString()} 
                    readOnly 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button disabled>Update Profile</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Email Notifications</h3>
                    <p className="text-sm text-muted-foreground">Receive email updates about your account</p>
                  </div>
                  <div className="h-6 w-11 bg-muted rounded-full p-1 cursor-pointer">
                    <div className="h-4 w-4 rounded-full bg-primary ml-auto"></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">SMS Alerts</h3>
                    <p className="text-sm text-muted-foreground">Get text messages for important updates</p>
                  </div>
                  <div className="h-6 w-11 bg-muted rounded-full p-1 cursor-pointer">
                    <div className="h-4 w-4 rounded-full bg-muted-foreground"></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Two-Factor Authentication</h3>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                  </div>
                  <Button variant="outline">Enable</Button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Cancel</Button>
              <Button>Save Changes</Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>
                Irreversible account actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border border-destructive/20 rounded-md">
                  <h3 className="font-medium text-destructive">Delete Account</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <Button variant="outline" className="text-destructive">Delete Account</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Main dashboard page
function DashboardPage() {
  return (
    <UserLayout>
      <DashboardPageContent />
    </UserLayout>
  );
}

export default DashboardPage;