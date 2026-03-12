'use client';
// Import required components and hooks
import { redirect } from 'next/navigation'
import React, { useActionState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { handleLogin } from '@/lib/actions/auth';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginFormSchema, LoginFormSchemaType } from '@/forms/login';
import { useToast } from '@/hooks/use-toast';

// Initial state for form errors
const initialState = {
    errors: {
        email: [],
        password: []
    },
    message: ''
}

// Login form component that handles user authentication
export default function LoginForm() {
    const { toast } = useToast();

    // Initialize form state and actions
    const [state, action, pending] = useActionState(handleLogin, initialState);
    const form = useForm({
        resolver: zodResolver(loginFormSchema),
        defaultValues: {
            email: '',
            password: ''
        }
    })

    const formRef = useRef<HTMLFormElement>(null);

    // Show toast notification for error messages
    React.useEffect(() => {
        if (state?.message) {
            toast({
                variant: "destructive",
                title: "Error",
                description: state.message,
            });
        }
    }, [state, toast]);

    return (
        <>
            <Form {...form}>
                <form ref={formRef}
                    action={action}
                    onSubmit={() => formRef.current?.requestSubmit()}>

                    {/* Email input field */}
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input placeholder="Enter your email adress" {...field} />
                                </FormControl>
                                <div className='flex gap-2'>
                                    <FormMessage>
                                        {state?.errors?.email?.[0]}
                                    </FormMessage>
                                </div>
                            </FormItem>
                        )}
                    />

                    {/* Password input field */}
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                    <Input type='password' placeholder="Enter your password" {...field} />
                                </FormControl>
                                <div className='flex gap-2'>
                                    <FormMessage>
                                        {state?.errors?.password?.[0]}
                                    </FormMessage>
                                </div>
                            </FormItem>
                        )}
                    />
                    {/* Submit button */}
                    <Button 
                        type="submit" 
                        variant={'default'} 
                        className="w-full hover:bg-tama-secondary bg-tama text-white py-2 mt-10"
                        disabled={pending}
                    >
                        {pending ? 'Logging in...' : 'Log In'}
                    </Button>

                </form>
            </Form>
        </>
    )
}
